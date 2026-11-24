## Attempt 1 — 2026-11-22

Slice 1 only (API, server, lib). The UI slice (SIM-012.2) is not built. No High path touched.

### Files touched
| File | Required because |
|---|---|
| `src/lib/seats/types.ts` (new) | Shared API contract |
| `src/lib/seats/rules.ts` (new) | Pure decisions (AC4-AC8) |
| `src/lib/seats/rules.test.ts` (new) | AC8 decision tables |
| `src/lib/validate/seat.ts` (new) | Boundary validation |
| `src/lib/validate/seat.test.ts` (new) | R5 |
| `src/lib/api/error.ts` | Five new error codes |
| `src/ui/copy/api.ts` | Messages for them (typecheck forces it) |
| `src/server/seats/seats.ts` (new) | Service layer |
| `src/server/seats/seats.test.ts` (new) | Fake-Db lock order, rollback, no-op |
| `src/server/seats/seats.db.test.ts` (new) | DB proof of AC1-AC7 and races |
| `src/server/seats/pg-error.ts` (new) + `.test.ts` | `devices_seat_fkey` backstop to `seat_not_empty` |
| `src/server/rooms/rooms.ts` | Comment only: member `for share` lock on assign |
| `src/app/api/rooms/[id]/seats/route.ts` (new) | GET, POST |
| `src/app/api/seats/[id]/route.ts` (new) | GET, DELETE |
| `src/app/api/seats/[id]/occupant/route.ts` (new) | PUT |
| `src/app/api/seats/[id]/release/route.ts` (new) | POST |
| `src/app/api/seats/[id]/cannot-seat/route.ts` (new) | PATCH |
| `src/app/api/seats/seats-routes.test.ts` (new) | Route tiers, codes, R7 (service and pool mocked) |

### Tests added / changed
- `rules.test.ts`: seatStatus, decideOccupantChange (full table), decideRelease, decideDelete, inheritedGroup.
- `validate/seat.test.ts`: validateSeatAdd, validateOccupantPut, validateCannotSeat.
- `pg-error.test.ts`: seatConflict.
- `seats.test.ts`: org scoping, setOccupant lock order, clear/release no member lock, add/delete room `for update` first, no-op writes nothing, refusal and late-error ROLLBACK, FK backstop, add allocates count times.
- `seats-routes.test.ts`: 401 on every handler, 403 for User/Manager, non-canonical id 404, 400s, refusal mapping, release refusal is 409, no-store, 201/204.
- `seats.db.test.ts` (18 tests): add after delete (04, 05), geometry/seq 100/other org, concurrent adds, delete refusals, delete empty + cascade + audit, delete vs assign race, list/detail, assign, replace + deferred trigger at COMMIT, same member, stale expected, clear, unassignable members, assign vs deactivate race, cannot-seat (both), release, D32.

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0 (next typegen + tsc).
- check:layers: exit 0, "291 files, no violations".
- format:check: exit 0, "All matched files use the correct format."
- test: `pnpm test` exit 0, "Test Files 119 passed (119); Tests 1194 passed | 3 skipped (1197)".
- build: `pnpm build` exit 0.
- test:db: ran locally against a throwaway `postgres:17` container `simap-sim012-test` on 127.0.0.1:55432 (removed afterwards): "Test Files 5 passed (5); Tests 51 passed (51)", including the 18 seats tests.
- Bug found while testing: the first `validate/seat.test.ts` used an all-digit UUID, so its uppercase variant was identical; fixed the test fixture, not the code.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Race tests simulate `deactivateMember` and the assign with raw `for update` / `for share` holder connections rather than calling `deactivateMember`; the lock sequence is the same as in `manage.ts`.
- Two simultaneous `deactivateMember` calls on each other can deadlock (already in plan).
- `seats.test.ts` fake counter always returns 4, so the add test asserts call counts, not distinct seqs (the DB tests cover the seqs).

### Scope self-check
- Could the diff be smaller? No; every file is in the plan, `rooms.ts` is comment only.
- Diff size: 3 modified files +12 / -1; the rest are new files.

## Attempt 2 (REWORK) - 2026-11-22

Fixes review Issue 1 only (blocker): `validateCannotSeat` accepted NUL (Postgres 22021, 500) and invisible-only reasons.

### Files touched
- `src/lib/validate/seat.ts`: local `INVISIBLE` / `VISIBLE` regexes (same classes as `member.ts`); after NFC + trim, reject with `field: "reason"` if the reason has a control, format or filler character, or no visible character. Required because: review Issue 1 fix instruction; `member.ts` not touched.
- `src/lib/validate/seat.test.ts`: new case for NUL, zero-width only, Hangul filler only (plus filler + zero-width) as errors; Vietnamese reason with diacritics stays valid.

### Checks
- format:check exit 0; typecheck exit 0; check:layers exit 0 (291 files, no violations); build exit 0.
- test: "Test Files 119 passed (119); Tests 1195 passed | 3 skipped (1198)".
- test:db: throwaway `postgres:17` container `simap-sim012-test` on 127.0.0.1:55432, removed afterwards: "Test Files 5 passed (5); Tests 51 passed (51)".

### Out-of-plan files
None.

### Follow-ups
None new (room.ts gap already noted in review).

### Scope self-check
Two files, validator and its test only.

## Attempt 3 (REWORK, approved beyond the normal limit)

### Files touched
- `src/lib/validate/seat.ts` — `INVISIBLE` replaced with `/[\p{C}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}⠀]/u` (Attempt 2 findings 1, 2). Required because U+2800, line separators, default-ignorable, private-use, unassigned and lone surrogates passed.
- `src/lib/validate/seat.test.ts` — escaped rejected-case list from the finding (no raw invisible literals) plus an NFD Vietnamese reason that must pass and be stored as NFC (Attempt 2 finding 3).
- `src/server/seats/seats.db.test.ts` — one test calling `deleteSeat`, `setOccupant`, `releaseSeat`, `setCannotSeat` with this org's scope and another org's seat id: 404 `not_found`, foreign row unchanged, audit counts unchanged in both orgs (Attempt 1 finding 2).

### Check results
- format:check: all files correct format. typecheck: OK. check:layers: 291 files, no violations.
- test: 119 files passed; 1195 passed, 3 skipped.
- test:db (throwaway container `simap-sim012-test`, removed): 5 files, 52 tests passed.
- build: exit 0.

### Out-of-plan files
None.

### Follow-ups
Unchanged 🟢 items; `member.ts` and `room.ts` share the same invisible-character gap (not touched).

### Scope self-check
Only the three listed items changed.
