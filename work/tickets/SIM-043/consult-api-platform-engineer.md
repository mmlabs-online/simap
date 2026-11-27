SIM-043 consult (API/contract). Read-only; I read the ticket, D75, D86, with-auth.ts, verify.ts, tier.ts, gate.ts, write.ts, members.ts (ensure/getOrCreateMember), identityClient.ts parseOrgs and types.ts. I did not read the spec, AUT-02/04, every write route, apiFetch or the token store.

## Findings
1. D86 overrides the ticket text and D75. The role key is `simap:super-admin` (not `admin:super-admin`) and must be configurable. A grant needs all four of: token verifies, `org` present, `org_access === "super_admin"` exactly, and `roles` contains the key. The token then has `org_roles: []`. Ticket AC1 and Scope say only "role in `roles`"; they need `org_access` added.
2. Verifier today (verify.ts:140-151).
   - `roles` is ignored by design (comment at line 140).
   - `org` present with `org_roles` undefined fails with `org_roles_missing`. An `[]` passes, so D86 tokens do verify.
   - `VerifiedIdentity` has no `roles` or `orgAccess`, so both must be added.
   - Nothing else may change: `ent` stays ignored, and `org` absent with `org_roles` present still fails.
3. Grant point. with-auth.ts:69 `tierFromOrgRoles(orgRoles ?? [])` returns null for `[]`, giving 403 `forbidden`. This is the single place to add the super-admin path.
   - Compute `tier = tierFromOrgRoles(...)`, and if the super-admin condition holds, `tier = "admin"`.
   - Keep the order: `org_required`, then tier check, then member gate, then handler. R7 is satisfied because everything stays before any side effect.
4. `AuthContext` has no marker today. The audit requirement needs a flag such as `viaSuperAdmin: boolean` on the frozen ctx. It must be true only when the super-admin condition held AND `tierFromOrgRoles` returned null. A member who also holds the role should be treated as a normal member, which avoids audit noise and keeps their own tier. This is my proposal, not something D86 states. Ming should confirm it, because it also decides whether a member's super-admin use is flagged.
5. The member gate (gate.ts) treats a missing row as `active`, and a deactivated row as `deactivated`. That already satisfies AC5 "deactivated row gives 403" with no change, so a deactivated super-admin member row still blocks.
6. `/api/me` (members.ts `getOrCreateMember`/`ensure`) inserts a member row on first visit and writes a `member.create` audit with `source: "first_visit"`. For a super admin this would make staff appear in the org's member list, seat assignment and dashboards. That is the proposed-against default in D75 ("no member row / not listed") and a planner assumption still needing Ming.
7. Audit (write.ts) is only callable inside a write's transaction with `{actorSub, action, entity, entityId, meta}`. There is no per-request hook, and each route writes its own audit row. There is no place to mark cross-org access globally without touching every write route.

## Recommendations
- verify.ts: parse `roles` and `org_access` only when `org` is present.
  - `roles`: an array of strings, otherwise fail closed. Absent means `[]`. Decide whether an invalid shape should reject the token or only deny the grant. I suggest the second: a malformed `roles` denies the grant (via a new verify code or `roles: []`) and does not break normal member tokens.
  - `org_access`: a string, otherwise null.
  - Return `roles` and `orgAccess` on `VerifiedIdentity`. Update the comment at line 140. Add tests for valid, wrong type, absent, and unknown value.
- tier.ts, new pure helper `isSuperAdmin(roles, orgAccess, key)`. The key comes from env, e.g. `SIMAP_SUPER_ADMIN_ROLE`, default `simap:super-admin`.
  - Use exact `===` matching, `Object.hasOwn`-style and never prefix or case-insensitive.
  - Add the env name to `.env.example` (R3) and read it through `loadIdentityConfig`. Fail closed if it is set to an empty string.
  - Tests for AC2: `simap:member`, `simap:admin`, `admin:super-admin`, `simap:super-admin ` (trailing space), and uppercase variants all grant nothing. Also `org_access: "member"` with the role, and `org_access: "super_admin"` without the role, each grant nothing.
- with-auth.ts: grant admin only when the full D86 condition holds. Add `viaSuperAdmin` to `AuthContext`. Add route tests for grant, near-miss, no `org` (403 `org_required`, even with the role), deactivated row (403 `member_deactivated`), and scope still `{orgId: org}`.
- Audit shape. Options:
  - (a) Per-write: extend `writeAudit` with an optional `viaSuperAdmin` that merges `meta.access = "super_admin"` and passes it from `ctx`. Callers must pass it, so a missed route silently loses the marker.
  - (b) Make `writeAudit` take a context object instead. That is a larger change and touches every call site.
  - Preferred: (a) as an opt-in that defaults safely, plus a test that counts write routes missing it. Alternatively add a small helper `auditMeta(ctx, meta)` and enforce its use via a test. Per-write audit meets "at least every write". Auditing reads would need a new log entry. I suggest a structured `d.log({event: "super_admin_access", sub, org, method, path})` on every super-admin request, which has no DB cost and complements Identity's mint audit, plus audit rows for writes.
  - Keep `meta` to codes only (SYS-03). Do not put the role value or token data in it.
- Member row. Default to no row for super admins, with `/api/me` returning a virtual member DTO (`viaSuperAdmin: true`) and no insert. Reasons: it stays out of lists, seats and dashboards (Risk 2), and avoids `member.create` rows from a support visit.
  - Check every place that dereferences the caller's member row (my-seats, requests, presence, photo, pixel-look). A virtual member could break flows that expect a `members.id`, so consider a 403 `not_allowed` 409/422 for user-personal actions, or hide those UI tabs.
  - `getOrCreateMember` must not create a row in this case: ensure `/api/me` receives the flag and skips `ensure`.
- Org picker (identityClient.ts parseOrgs). It currently ignores `access` and extra fields.
  - Add `access: "member" | "super_admin"` to `OrgChoice` (types.ts:50).
  - Unknown values must be dropped from the list or marked not openable, per D86 ("unknown values = not openable"). Dropping them silently risks the existing "list non-empty but zero parsed" `unknownError` check, so decide whether to keep them as disabled entries or drop and exclude them from that check.
  - Label super_admin orgs in the UI (copy in `src/ui/copy/`), and consider sorting them separately because the list may be long.
- 429 on `POST /auth/token`: D86 allows 30 super-admin mints per account per hour. errors.ts already maps `rate_limited` with `retryAfterSeconds`, and flow.ts treats it as a retry code. Check the tokenStore/apiFetch behaviour:
  - apiFetch re-mints on 401/403. A 429 on re-mint must surface as an error and not retry in a loop (ticket risk 4).
  - Mints should be cached for the token life (up to 3600 s, no `sid`). Do not re-mint per org switch if the same org token is still valid.
  - Switching orgs counts against the 30/hour budget, so consider a UI message using `retryAfterSeconds`.
- Docs (AC6): update spec §2 (Roles, Super Admin), AUT-02, AUT-04 and CLAUDE.md R6. Also adjust the D5/D10/D14 references. Use the D86 key and the `org_access` condition. Fix the Ticket Notes line 73, which still says `admin:super-admin`.
- Sequence: verify/tier/with-auth, then audit marker, then `/api/me` and gate, then picker. The ticket's size M is realistic, but the audit threading may push it up if many write routes exist. Count the `writeAudit` call sites before planning.

## Risks
- Trust: simap trusts the `roles` and `org_access` claims entirely. Identity enforcing staff-only issuance (ADR-0030) is out of our control. Require both claims (as D86 does) and document that.
- Silent loss of the audit marker on new routes if the marker is opt-in per call site (see Recommendations).
- Full admin means a super admin can do everything, including deleting data, with no read-only default. Ticket risk 3 is settled by D75 as full CRUD, but ask again if Ming wants this changed at the plan gate.
- With tokens valid up to 3600 s, a removed staff role still works for up to 1 hour. Normal 12 h tokens (D7) are unaffected. Same for the deny list: the member gate is the only revocation, and a staff account is not in `members`, so there is no per-org revoke other than Identity.
- Release waits for M-90 (org-admin-api deploy and setup). Do not merge before it, or the picker may show unknown `access` values or none.
- Picker: with the current permissive parseOrgs, a missing `access` would silently default to "member". Be explicit: missing equals "member" for old Identity, or not openable once D86 is live. Decide which.
- Rate limit 30/hour per account may be hit when staff browse many orgs.

## Open questions (for Ming at the plan gate)
1. Member row on first visit: no row and a virtual `/api/me` member (my recommendation), or create one? If created, should it be hidden from lists?
2. Audit shape: marker in `meta` (e.g. `meta.access = "super_admin"`) on writes plus a structured log line for reads, or something else? Should reads be audited in the DB?
3. If a member also holds the super-admin role and `org_roles` gives a lower tier, does the super-admin grant raise them to admin? (I assumed yes, with no flag when `org_roles` already gives a tier. Confirm that this should not be marked.)
4. What does the UI show for personal features (My seat, My devices, requests) for a virtual member?
5. Unknown or missing `access` values in the picker: drop them or show them as disabled?
6. Should the role key env var name be `SIMAP_SUPER_ADMIN_ROLE`, and should it be required or defaulted?

Files: /home/user/simap/src/server/http/with-auth.ts, /home/user/simap/src/server/identity/verify.ts, /home/user/simap/src/lib/auth/tier.ts, /home/user/simap/src/server/members/gate.ts, /home/user/simap/src/server/members/members.ts, /home/user/simap/src/server/audit/write.ts, /home/user/simap/src/ui/auth/identityClient.ts, /home/user/simap/src/lib/identity/types.ts, /home/user/simap/work/decisions.md (D75 line 82, D86 line 93), /home/user/simap/work/tickets/SIM-043/ticket.md.
