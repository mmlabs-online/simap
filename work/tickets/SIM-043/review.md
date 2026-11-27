# Review — SIM-043 (slice 1)

## Attempt 1 — 2026-11-27
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (1046 files)
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 991 files, no violations"
- `pnpm test` — exit 0, "Test Files 378 passed | 1 skipped (379)", "Tests 3664 passed | 7 skipped (3671)" (matches impl-log)
- `pnpm build` — exit 0
- `pnpm test:db` — not run: no Docker daemon in the review sandbox (`docker compose up` fails, no `/var/run/docker.sock`). CI-only. The diff adds no SQL and no DB test (`getMember` reuses the existing `find`).

### Acceptance criteria
- [x] AC1 super admin (D86 claims, `org_roles: []`) gets admin in org X — evidence: `with-auth.test.ts` › "super admin (D86) › reaches an admin route with tier admin, access super_admin"; `tier.test.ts` › "grants admin on the exact D86 condition …"; `verify.test.ts` › "org present: roles and org_access are returned normalized …". Code: `src/lib/auth/tier.ts:41-56`, `src/server/http/with-auth.ts:74-90`.
- [x] AC2 other `roles` values grant nothing — evidence: `tier.test.ts` › "near-miss keys and partial D86 claims grant nothing" (all 8 near-miss keys, 4 bad `org_access` values, key unset, TTL 3601/undefined, non-empty `org_roles`), "member path unchanged …", "__proto__ / constructor … never throw"; `with-auth.test.ts` › "near-miss role / org_access member / role unset in config -> 403 forbidden, handler and gate not called"; the existing `simap:admin only in roles -> 403` test still passes. Role match is `Array.prototype.includes` (exact `===`), with no object lookup.
- [x] AC3 no scope widening — evidence: `with-auth.test.ts` › "claims without org -> 403 org_required", "ctx.scope is {orgId: org}, frozen, same object given to gate and audit". Scope is still built only by `scopeFor(org)` (`with-auth.ts:89`). `grep ctx.access` outside tests: only `src/app/api/me/route.ts:14,22,38`.
- [x] AC4 audit row for super-admin writes — evidence: `with-auth.test.ts` › "write (POST/PUT/PATCH/DELETE) calls accessAudit once before the handler …" (route `/api/t/:id`, no query), "GET/HEAD: no access audit; member token write: no access audit", "accessAudit throws or is missing -> 503 …"; `audit/access.test.ts` › values `[org, sub, "access.super_admin", "org", org, {"method","route"}]`; `lib/audit/route.test.ts`. The log test (`with-auth.test.ts` "logs never contain …") now includes a failing super-admin audit and stays clean of sub/org.
- [x] AC5 member gate and `/api/me` — evidence: `me/route.test.ts` › "super admin (D86) on /api/me" (4 tests: no row gives `member: null` and no create; an existing row is returned; PATCH with no row gives 422 `no_linked_member`; a member token still calls `getOrCreateMember`); `with-auth.test.ts` › "deactivated row -> 403 member_deactivated, no access audit, handler not called". `gate.ts` is unchanged, so a missing row counts as active. `ensure` (`members.ts:51`) stays the only member insert, reached only through `getOrCreateMember` and `setOwnDisplayName`, and both are guarded for super admins with no row.
- [x] AC6 docs — evidence: `docs/spec-v1.md` §2 Organizations (:43-45), Roles (:54-64), AUT-02 (:185-191), AUT-04 (:206), change-log row (:1042); `CLAUDE.md` R6 (:38-40); `.env.example` `SIMAP_SUPER_ADMIN_ROLE=` (no value).

Ming verification after merge (needs real Identity, after M-90 / M-92). These go in the PR:
- With `SIMAP_SUPER_ADMIN_ROLE=simap:super-admin`, a staff non-member opens org X, opens rooms and seats, and creates, edits and deletes a room.
- X's Audit page shows one "Support access (mmlabs)" row per write with the staff `sub` (Who: "Unknown member").
- The staff account is absent from Members, the seat-assignment picker and the dashboard counts.
- With the env unset, the same account gets 403 `forbidden` (kill switch).
- Invitations as a super admin (Identity cookie): check whether Identity accepts them (Q9).

### Issues
None.

### Scope
Every product file in the diff is in the plan's files table. `work/ming-todo.md` (M-91, M-92) and `ticket.md` are orchestrator bookkeeping that the plan asks for (Q1). `gate.ts` is untouched, as planned. High paths changed: `src/server/identity/verify.ts`, `config.ts`, `src/server/http/with-auth.ts`, `.env.example`, plus `src/lib/auth/tier.ts`, reviewed as High. All of them are named in the plan, and the plan gate was approved (M-91, ticket Notes 2026-11-27).

R7 order checked in `with-auth.ts:63-112`: verify → `org_required` → grant/tier `forbidden` → member gate `member_deactivated` → access audit (the only side effect, 503 on failure) → handler. No 401/403 comes after the audit write.

### Rules (CLAUDE.md)
No violations found. R1: `src/lib/audit/route.ts` imports nothing, and `src/server/audit/access.ts` starts with `import "server-only"`. R3: env name only, and the config error message never carries the value (`config.test.ts`). R6: the audit insert goes through `writeAudit`/`orgQuery` with `ctx.scope`. R5: new logic has tests.

### Blockers from review agents
None. The orchestrator fills this from security-review.md.

### Nits (do not block)
- `src/server/http/with-auth.ts:135` sets `superAdminRole: loadSuperAdminRole(process.env)` in `getAuthDeps`, but no test covers it. A test where the env is set (grant works through default deps) and one where it is invalid (503 plus one `identity_config_invalid` log) would pin the kill switch. Today, losing this line fails safe (feature off).
- `docs/spec-v1.md`: the AUT-02 line (:190) and the AUT-04 line (:206) run past the 120-column wrap used in the rest of the spec, and the Roles paragraph reflow (:55-56) is uneven.
- `src/server/identity/verify.ts:170` computes `(payload.exp as number) - (payload.iat as number)` and relies on jose `requiredClaims` plus jose's numeric checks. That is correct today. A short comment would stop a later change from dropping `iat` from `requiredClaims`. If `iat` were dropped, the result would be NaN, which still fails closed.

### Follow-ups (out of scope)
- Ticket wording is stale against D86: Scope bullet 1 says `simap:superadmin`, the Notes say `admin:super-admin`, and AC1 lacks `org_access` (plan Q11). The orchestrator should fix it.
- `MM_IDENTITY_ISSUER` is missing from `.env.example` (plan Q13).
- Option B: mark each domain audit row as written via super admin (plan Q2).
- Check how member-dependent routes (seat requests, My seats, Profile) answer a super admin with no row (Q10). Slice 2 or a later polish ticket.
- Slice 2 (SIM-043.1): picker `access` badge and 429 Retry-After.

### Blockers from review agents
- None: security-review.md Attempt 1 has no 🔴 (one 🟡: auditRoute keeps UUIDs that start with a–f; listed for Ming in the PR).
