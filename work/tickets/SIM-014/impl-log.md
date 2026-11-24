## Attempt 1 — 2026-11-24 (slice 1: request state machine and write API)

### Files touched
| File | Required because |
|---|---|
| `src/lib/requests/types.ts`, `rules.ts`, `rules.test.ts` | pure state machine, DTO types, AC5 |
| `src/lib/validate/request.ts`, `request.test.ts` | D23 boundary: only `seatId` accepted |
| `src/server/seats/seats.ts` | exported `inTx`, `refuse`, `lockSeatIn`, `SeatLock`, new `writeOccupant` (extracted from `setOccupant`, behaviour-preserving); `Refusal.code` widened |
| `src/server/requests/requests.ts` | service: create / approve / reject / cancel, lock order members -> room -> seat -> request |
| `src/server/requests/requests.db.test.ts` | AC1-AC4 against real SQL |
| `src/app/api/requests/route.ts`, `[id]/{approve,reject,cancel}/route.ts` | four write endpoints |
| `src/app/api/requests/requests-routes.test.ts` | tiers, mapping, R7 |
| `src/lib/api/error.ts`, `src/ui/copy/api.ts` | codes `seat_taken`, `no_linked_member` + copy |

### Tests added / changed
- `rules.test.ts` (nextStatus, decideCreate, decideApprove, decideCancel tables), `request.test.ts`, `requests-routes.test.ts`
- `requests.db.test.ts`: create (basic, duplicate, concurrent, rival, refusals, no member/404), approve (two rivals + audit, D32 group, 409 rollback, deactivated subject, 404, noop on decided, concurrent rivals, concurrent approve vs cancel), reject, cancel (own, other/none/other-org 404, noop)
- Existing `seats.test.ts` / `seats.db.test.ts` unchanged. DB tests were NOT run locally (no DATABASE_URL); they run in CI via `pnpm test:db`.

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0; `pnpm check:layers`: 425 files, no violations
- format:check: All matched files use the correct format
- test: Test Files 169 passed; Tests 1801 passed | 3 skipped
- build: exit 0, `/api/requests` and `[id]/approve|cancel|reject` listed
- test:db: not run locally (CI only)

### Out-of-plan files
None. Deviation: `notFound` in seats.ts is not exported (the service uses `refuse(404, "not_found")`, so the export was unneeded).

### Follow-ups (noticed, not done)
- DB tests unverified locally; check the first CI run of `pnpm test:db`.
- As in the plan: auto-reject pending requests on direct assign/release/cannot-seat; pending marker on seat DTOs.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +1000 lines including tests (about 450 source); seats.ts net near zero.

## Attempt 2 (REWORK: CI `pnpm test:db` red, run 45324267204)

### Root causes
1. Four create tests, `orgQuery: SQL must filter org_id = $1` at requests.ts:125. The `orgQuery` guard (`src/server/http/org-scope.ts`) requires the text `org_id = $1`; the insert used `values ($1, ...)`, which has no such predicate. Fix in `requests.ts`: use the repo's insert shape (`select o.org_id, ... from (select $1::uuid as org_id) o where o.org_id = $1::uuid`), as in members/rooms/audit inserts. All 13 other `orgQuery` calls in requests.ts were checked and contain `org_id = $1`.
2. Approve test "two rivals", `devices_primary_owner_is_occupant` (23514) in the test fixture `addDevice(..., w.seat1, "primary")`. Test setup bug, not an approve bug: seat1 is empty (approve only works on empty seats), and the constraint trigger forbids a primary device on a seat whose occupant is not its owner, so such a state cannot exist. Fix: the test now places a secondary device on the empty seat and asserts it stays secondary and on seat1 after approve. Test renamed (no "primary demoted"). Demotion on assign is covered in seats tests and cannot occur in approve.

### Files touched
- `src/server/requests/requests.ts` (insert SQL), `src/server/requests/requests.db.test.ts` (fixture role and assertions).

### Checks
- format:check ok, typecheck ok, check:layers 425 files no violations, test ok, build ok. `pnpm test:db` not run locally (CI re-run on PR #58).

### Out-of-plan files / Follow-ups
None.
