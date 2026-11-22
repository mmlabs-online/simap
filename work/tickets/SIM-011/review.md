## Attempt 1 — 2026-11-22
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (309 files)
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 258 files, no violations"
- `pnpm test` — exit 0, "Test Files 105 passed (105), Tests 1046 passed (1046)"
- `pnpm build` — exit 0; routes `/api/members`, `/api/members/[id]`, `.../deactivate`, `.../deactivation-impact`, `.../reactivate`, `/api/members/invitations` built as dynamic
- `pnpm test:db` (local Postgres, DATABASE_URL=127.0.0.1/simap) — exit 0, "Test Files 3 passed (3), Tests 29 passed (29)"

All results match the impl-log claims.

### Acceptance criteria
- [x] A deactivated member's next API call to org data is refused; reactivation restores access. Evidence: `src/server/http/with-auth.ts:109` wires `dbMemberGate` (no `allowAll` left); `src/server/members/gate.ts:12-25` does one org-scoped lookup per call with no cache, missing row = active, throws on no pool (fail closed, 503). Tests: `gate.test.ts` (4 tests, including "no caching between calls" and "reads getPool on every call"), `with-auth.test.ts › default deps wire the DB member gate`, `manage.db.test.ts:200 › gate: deactivate ... reactivate returns active on the next call`. The existing with-auth test still covers `deactivated` → 403 `member_deactivated`.
- [x] Deactivating a member with seats/devices shows the counts and, on confirm, releases them in one transaction with DEV-06 demotion. API half (UI dialog is SIM-011.2, split approved in M-22): `GET .../deactivation-impact` → `manage.db.test.ts:88`; release in one `withTx` with demote → clear occupant → return devices (`manage.ts:376-399`), commit passes the deferred primary-owner trigger, `manage.db.test.ts:107` checks the seat is cleared, the primary is demoted, the borrowed and placed devices are returned, another member's secondary is untouched, the subject's pending request is cancelled and requests for others are not, with exactly one audit row (counts only). `manage.test.ts › an error after the seat update rolls back` and `› lock order`.
- [x] Employee code is unique within the org. `manage.db.test.ts:215` (duplicate → 409 `employee_code_taken`, same code in another org OK, clearing frees it); `pg-error.test.ts`; `member.test.ts › normalizeEmployeeCode` (uppercase normalisation).
- [x] Users see the list read-only; Managers see edit actions. Server half: `route.test.ts:89` (User: GET list/detail pass; PATCH, deactivate, reactivate, impact, invitations → 403 `forbidden`) and `:111` (Manager passes). UI half is SIM-011.2.
- [x] Unit tests cover the deactivation impact and validation. `src/lib/members/deactivation.test.ts`, `profile.test.ts`, `cursor.test.ts`, `search.test.ts`, `src/lib/validate/member.test.ts`, `member-query.test.ts`, all in `pnpm test`.

Ming verification after merge (from plan.md, carried to the PR):
- Manual: `POST /api/members/<id>/deactivate {"release":true}` for a seeded member who holds a seat, then call any `/api/*` as that member → 403 `member_deactivated`; reactivate → access restored (easier after SIM-011.2).
- Confirm assumptions A1-A11 (recorded as approved in ticket.md, 2026-11-22).

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: routes import only `@/server/*` and `@/lib/*`; new server files start with `import "server-only"`; `check:layers` clean.
- R2: no schema change, no migration.
- R4: every changed code file is in plan.md's file table. Workflow files (`work/ming-todo.md` M-22, ticket/plan/consult/impl-log) are expected.
- R6: every statement goes through `orgQuery`, and every subquery and join repeats `org_id = $1` (`manage.ts:112-125, 296-301, 329-330`). Tiers come from `withAuth`. The DB test covers org isolation for list, impact and group.
- R7: 401/403 come only from `withAuth` (the gate runs before the handler). Domain refusals are 400/404/409.
- High path `src/server/http/with-auth.ts` (+ test) is named in the plan, and plan approval is recorded (ticket.md Notes, M-22 checked).

### Blockers from review agents
None (the orchestrator fills this in from security-review.md if that agent runs).

### Nits (do not block)
- `src/server/http/with-auth.ts:4`: the `@/server/members/gate` import sits between two `@/server/identity/*` imports. Put it after them so the imports stay in order.
- `src/server/members/manage.ts:171`: `listMembers` re-reads the group options on every page, including cursor pages. The client only needs them once. This is harmless at a cap of 500.
- `src/server/members/gate.ts:6`: `rows: any[]`. `unknown[]` would be enough.

### Follow-ups (out of scope)
- SIM-011.2: Members page UI (dialogs, read-only for Users, mmlabs note, no delete action, manual test).
- Assumption A9: SIM-012 / SIM-014 writers must lock the member row (`for share`) before the room/seat locks. Record this in those tickets' plans.
- Accent-insensitive member search (`unaccent`) needs a separate DB ticket (A7).
