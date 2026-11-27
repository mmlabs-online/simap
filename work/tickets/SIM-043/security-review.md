## Attempt 1

## SIM-043 attempt 1: security review (AI-generated-code auditor)

I could only read files in this session (no Bash), so I did not run `git diff` or any checks. I read the files named in the brief directly, plus `src/lib/audit/route.ts` and its test, `src/server/audit/write.ts` and `src/server/members/members.ts`.

**Verdict:** no blockers. One should-fix in the audit meta (the `route` value) and a few notes.

### Findings

**🔴 Blockers**
None.

**🟡 Should-fix**

1. **`auditRoute` keeps about a third of UUIDs as raw values instead of `:id`.** `/home/user/simap/src/lib/audit/route.ts:1`, `KEEP = /^[a-z][a-z0-9-]{0,40}$/`.
   - **Why it happens:** a canonical lowercase UUID is 36 characters, all from `[0-9a-f-]`. When it starts with a letter `a` to `f` (6 of 16 first characters, about 37%), it matches `KEEP` and stays as is. For example, `/api/rooms/a1b2c3d4-1111-4111-8111-111111111111` is stored unchanged in `audit_log.meta.route`.
   - **Risk:** it is not a secret, but it breaks the planned meta shape ("every other segment becomes `:id`"). Rows for the same route end up with different values, which hurts grouping and facets. Entity IDs leak into a field meant to hold codes only (SYS-03).
   - **Why the test misses it:** `/home/user/simap/src/lib/audit/route.test.ts:6` uses `6f1c2a52-…`, which starts with a digit.
   - **Fix:** check UUIDs before the word rule. Map any segment matching `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` (or `isCanonicalUuid` from `@/lib/validate/uuid`) to `:id`. Better still, require word segments to contain no digits that look like hex IDs, e.g. `^[a-z][a-z-]{0,40}$`, since all simap route segments are plain words like `rooms`, `delete-impact` and `take-back`. Add a test with a UUID that starts with a letter.

**💭 Notes (verified as correct; no change needed)**

2. **Grant rule matches D86 exactly.** `/home/user/simap/src/lib/auth/tier.ts:41-57`.
   - It requires `orgAccess === "super_admin"`, a non-null and non-empty key, an exact `Array.prototype.includes` match, `orgRoles.length === 0` and `lifetimeS <= 3600`. It never falls back to the member path.
   - There is no object lookup on role strings, and `tierFromOrgRoles` uses `Object.hasOwn` (`:20`), so `__proto__` and `constructor` entries are harmless.
   - Near-miss keys, trailing spaces, case variants, `__proto__` and 3601 s are all covered in `tier.test.ts:27,61-62,75,90-93`.
   - Mixed claims fail closed in both directions:
     - `org_access: "member"` (or absent) with the key in `roles` takes the member path, which ignores `roles`.
     - `org_access: "super_admin"` with non-empty `org_roles` gets null, so 403.

3. **Claims are parsed fail-closed.** `/home/user/simap/src/server/identity/verify.ts:147-171`.
   - `roles` and `org_access` are read only after `org` and `org_roles` are validated.
   - A bad shape gives `appRoles: []` or `orgAccess: null`, so no grant, and the token is not rejected.
   - The no-`org` branch (`:148-150`) returns no app claims.
   - `lifetimeS = exp - iat` is safe: jose's `requiredClaims` makes both numeric, and `maxTokenAge` makes jose reject a future `iat`, so a negative or NaN lifetime cannot pass.

4. **Config fails closed.** `/home/user/simap/src/server/identity/config.ts:38-49`.
   - Unset or empty means the feature is off.
   - The strict regex rejects uppercase, spaces, `admin:` prefixes and a bare `simap:`, and the four membership keys are blocked.
   - The error message never contains the value.
   - Side effect: an invalid value makes `getAuthDeps` (`with-auth.ts:135`) throw on every request, so all of simap answers 503, including normal members, with one `identity_config_invalid` log. That is fail-closed by design (plan Approach step 3); Ming should know a typo in this env takes the whole app down.

5. **Scope is never widened (R6).** `with-auth.ts:89` builds the scope only through `scopeFor(org)` from the verified claim. `org === null` returns 403 `org_required` before the grant (`:75`). The only non-test uses of `ctx.access` are in `/home/user/simap/src/app/api/me/route.ts:22,38`, and neither picks a scope.

6. **Auth codes come before side effects (R7).** The order in `with-auth.ts:63-117` is: verify, `org_required`, grant and `forbidden`, member gate (`member_deactivated`), access audit, handler. The access-audit insert is the only side effect before the handler, and the wrapper returns no 401/403 after it. A missing or throwing audit returns 503 with a log entry `{event:"access_audit_failed"}` that carries no sub, org or message (`:99-109`).

7. **The audit row is correct and scoped.**
   - `/home/user/simap/src/server/audit/access.ts:13-23` goes through `writeAudit`, which goes through `orgQuery` (`/home/user/simap/src/server/audit/write.ts:19-32`).
   - It writes `org_id` and `entity_id` = the token org, `actor_sub` = sub, and meta `{method, route}` only: no role, token, query or body. `auditRoute` strips the query string (apart from Finding 1).
   - By design, the row is written in its own statement before the handler, so it records attempts the handler later refuses. A re-sent write after a 401/403 cannot happen from the wrapper.

8. **No member row is created.** The only `insert into members` is `ensure` (`/home/user/simap/src/server/members/members.ts:51-75`), reached only from `getOrCreateMember` and `setOwnDisplayName`.
   - `/api/me` GET skips `getOrCreateMember` for super admins (`me/route.ts:22`).
   - PATCH returns 422 `no_linked_member` before `setOwnDisplayName` when no row exists (`:38-40`). With an existing row, `ensure` just finds it.
   - `getMember` is read-only (`members.ts:90-93`).

9. **Reads are not audited in simap** (agreed decision, Q2). This covers `GET /api/export/[kind]`, `/api/search` and `/api/audit`, so bulk export by a super admin leaves no simap-side record, only the Identity mint audit. That is acceptable under D86, but worth one line in the PR so Ming accepts it knowingly.

10. **Contract dependency.** `verify.ts:153` still rejects an `org` token with no `org_roles` claim (`org_roles_missing`, 401). If Identity ever leaves `org_roles` out of super-admin tokens instead of sending `[]`, staff get 401 (fail closed, not an escalation). This needs checking in the post-M-90 Ming verification.

11. **Secrets (R3).** `/home/user/simap/.env.example:32-33` has the name only and no value. No secret appears in code or logs, and none of the new code goes into the client bundle: the new lib files are pure, and `access.ts` starts with `import "server-only"`.

### Follow-ups (out of scope)
- Option B: mark each domain action row written by a super admin, or add a read audit for export and search, if Ming wants reads in simap's own audit trail.
- If Ming wants to know ahead of time, document that an invalid `SIMAP_SUPER_ADMIN_ROLE` makes every request answer 503.

## Attempt 2

## SIM-043 attempt 2: security re-review of finding 🟡 1 (auditRoute)

I only read files. I did not run `git diff` or `pnpm test`, so I have not confirmed the tests pass. The orchestrator's check run has to confirm that.

**Verdict:** finding 🟡 1 is fixed and covered by tests. The change adds no new issue. No 🔴 and no 🟡.

### Findings

**🔴 Blockers:** none.

**🟡 Should-fix:** none.

**🟢 Verified**

1. **Fixed: UUIDs are always masked now.** `/home/user/simap/src/lib/audit/route.ts:4,11`
   - The function checks `isCanonicalUuid(s)` before the word rule, so a UUID becomes `:id` whatever its first character.
   - `KEEP` is now `/^[a-z][a-z-]{0,40}$/` with no digits. Any segment with a digit becomes `:id`, which also covers hex ids that are not canonical UUIDs.
   - Every real `/api` route segment under `src/app/api/**` is a plain lowercase word or a kebab-case word (`delete-impact`, `take-back`, `deactivation-impact`, `pixel-look`), so no static segment is masked by mistake.

2. **Covered by tests.** `/home/user/simap/src/lib/audit/route.test.ts:12-20`
   - UUIDs starting with a letter: `a1b2c3d4-…` (`:13`) and `f0000000-…` (`:16`). These are the exact cases attempt 1 missed.
   - A UUID starting with a digit (`:17`).
   - A kebab-case word that must be kept (`:18`).
   - A hex id that is not a UUID (`deadbeef1234`, `:19`).
   - The existing tests still cover query stripping, non-ASCII or encoded segments, numeric ids and the 200-char cap (`:5-10,21-23`).

3. **No new issue.**
   - `isCanonicalUuid` (`/home/user/simap/src/lib/validate/uuid.ts:1-6`) is a pure function in lib, so R1 layers hold. Its regex is anchored with no nested quantifiers, so there is no ReDoS risk.
   - The only caller is unchanged: `/home/user/simap/src/server/http/with-auth.ts:104` passes `new URL(req.url).pathname` only, so the query and fragment never reach it.
   - The output is still at most 200 chars and contains only kept words, `/` and `:id`.

### 💭 Notes (no action)
- A segment of 41 chars or fewer made only of the letters a to f and dashes, such as an all-letter string shaped like a UUID that is not canonical, would still be kept. Real ids come from `gen_random_uuid()`, which always contains the version digit `4`, so `KEEP` rejects them. This is not a practical leak.
- Dynamic segments that are codes, not entity ids (`map-items/[key]`, `export/[kind]`, `art/[dir]`), are kept when they are plain words and become `:id` when they contain a digit. That only loses some detail, it is safe, and it was the same before.

### Follow-ups
None.
