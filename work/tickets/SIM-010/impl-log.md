## Attempt 1 — 2026-11-20 (Slice A, API only; Slice B is SIM-010.2)

### Files touched
| File | Required because |
|---|---|
| `src/lib/api/error.ts` | Append `invalid_request`, `not_found`, `room_code_taken`, `room_not_empty` |
| `src/lib/rooms/types.ts`, `seat-code.ts`, `delete-impact.ts` | Shared DTOs, ROO-02/D29/D30 pure logic, delete rule |
| `src/lib/validate/room.ts` | Boundary validation; code `trim().toUpperCase()` first (Q2/Q22) |
| `src/server/db/tx.ts` | `withTx` |
| `src/server/audit/write.ts` | `writeAudit` (SYS-03) |
| `src/server/request/read-json.ts` | Capped JSON body reader (outside `http/`, Q10) |
| `src/server/rooms/pg-error.ts`, `rooms.ts` | 23505 mapping; list/create/update/impact/delete/allocateSeatSeq |
| `src/app/api/rooms/route.ts`, `[id]/route.ts`, `[id]/delete-impact/route.ts` | The 5 endpoints, all `withAuth` with `ctx.scope` |
| tests (8 files, see below) | R5 |

### Tests added / changed
- `src/lib/rooms/seat-code.test.ts`, `delete-impact.test.ts`; `src/lib/validate/room.test.ts` (uppercase, charset, NFC, unknown keys, patch rules)
- `src/server/rooms/pg-error.test.ts`, `rooms.test.ts` (fake client: org scoping, create/409, rename order and unnest payload, no seat touch without code change, rollback, 404s, 409 room_not_empty, forced-delete order, allocateSeatSeq, audit meta), `src/server/request/read-json.test.ts`, `src/server/db/tx.test.ts`
- `src/app/api/rooms/route.test.ts` (401 on all handlers, 403 for user/manager on writes, user GET passes gate, non-UUID 404, no-DB 503). The faking seam is `globalThis.__simapAuth` as on main (same as `me/route.test.ts`); no adaptation needed.
- `routes-guarded.test.ts` picks up the 3 new route files automatically.

### Checks (actual output summary)
- format:check: "All matched files use the correct format."
- typecheck: exit 0
- check:layers: "121 files, no violations"
- test: 48 files passed; 461 passed, 3 skipped
- build: exit 0

### Real-DB check
Not run (no local Postgres). Transactions are covered by fake-client unit tests only. The plan's one-off psql replay (rename C302 to C303, forced delete with occupant and primary device, deferred trigger passes at COMMIT) remains for CI / Ming.

### Notes
- Route handlers return only domain codes (400/404/409) after any write; 401/403 come solely from `withAuth` before the handler runs (SIM-006 review rule).
- Insert statements use `select ... from (select $1::uuid as org_id) o where o.org_id = $1::uuid` so every statement passes the `orgQuery` `org_id = $1` guard.
- 409 `room_not_empty` and 404 inside a transaction use an internal `Abort` so the transaction rolls back.
- `allocateSeatSeq` returns `{seq, roomCode}` (the issued number is the post-increment counter).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Optional `check (code = upper(code))` migration on `rooms` (plan Assumptions).
- Real-DB integration check of the transactions (CI/Ming).

### Scope self-check
- Could the diff be smaller? No; every file is in the plan list.
- Diff size: about +1,280 lines new (about 560 of them tests), +4 in `error.ts`.
