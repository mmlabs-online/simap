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
