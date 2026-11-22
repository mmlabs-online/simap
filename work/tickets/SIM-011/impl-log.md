## Attempt 1 — 2026-11-22

### Files touched
| File | Required because |
|---|---|
| `src/server/http/with-auth.ts`, `with-auth.test.ts` | AC1: real deny-list gate replaces `allowAll` (High path, plan approved) |
| `src/server/members/gate.ts` (+ test) | AC1: per-request `members.status` lookup, no cache |
| `src/server/members/manage.ts` (+ `manage.test.ts`, `manage.db.test.ts`) | MEM-01/02, AC2, AC3: list, detail, update, impact, deactivate, reactivate, invitations |
| `src/server/members/pg-error.ts` (+ test) | AC3: employee code / group constraint mapping |
| `src/server/rooms/rooms.ts` | Comment only: lock-order step 0 (member row) |
| `src/lib/members/types.ts`, `deactivation.ts`, `profile.ts`, `cursor.ts`, `search.ts` (+ tests) | Shared DTOs and pure logic (AC5) |
| `src/lib/validate/member.ts` (+ test), `member-query.ts` (+ test) | AC3, AC5: validators |
| `src/lib/api/error.ts`, `src/ui/copy/api.ts` | Three new error codes and messages |
| `src/app/api/members/**` (6 route files) + `route.test.ts` | API contract; User/Manager tiers |

### Tests added / changed
- Unit: deactivation, profile, cursor, search, member validators, member-query, gate, pg-error, manage (fake db: lock order, refusals, rollback, no-op, 23505), members routes, with-auth default-deps wiring.
- DB (`manage.db.test.ts`): impact counts; release with DEV-06 demotion and deferred trigger commit; not-empty refusal; self/idempotency/reactivate; gate before/after; employee code uniqueness per org; update audit; list search/paging/counts/isolation; invitations.

### Checks (actual output summary)
- typecheck: `next typegen && tsc --noEmit` clean; `check:layers`: 258 files, no violations
- format:check: All matched files use the correct format.
- test: Test Files 105 passed, Tests 1046 passed
- build: exit 0
- test:db (local Postgres): Test Files 3 passed, Tests 29 passed

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- SIM-011.2: Members page UI.
- `with-auth.test.ts` default-deps test relies on `MM_IDENTITY_ISSUER` stub and no network (401 path before JWKS fetch).

### Scope self-check
- Could the diff be smaller? No; most lines are tests.
- Diff size: see `git diff --stat` on the commit.
