# Impl log — SIM-058

## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `db/migrations/20261126150000_presence.sql` | new presence table (§4, R2) |
| `db/migrations/README.md` | schema doc bullet |
| `scripts/schema-check.mjs` | "1 later run applies presence" + section 14 |
| `src/lib/presence/{work-date,rules,types}.ts` + tests | D79 date, pure rules, DTOs |
| `src/lib/validate/presence.ts` + test | `{ roomId }` / `{ seatId }` validators |
| `src/lib/api/error.ts`, `src/ui/copy/api.ts` | three new codes, `room?` on the error body |
| `src/server/presence/{sql,presence,read,end}.ts` | active rule, check-in/out/move, room read, D82 helpers |
| `src/server/seats/seats.ts` | D82 hooks in `writeOccupant` (replace/unassign) and `releaseSeat` |
| `src/server/members/manage.ts` | D82 hook in `deactivateMember` |
| `src/server/rooms/rooms.ts` | D82 hook in `deleteRoom` (forced delete) |
| `src/app/api/me/presence/route.ts`, `src/app/api/rooms/[id]/presence/route.ts` | API |

### Tests added / changed
- `src/lib/presence/work-date.test.ts`, `rules.test.ts`, `src/lib/validate/presence.test.ts`
- `src/app/api/me/presence/route.test.ts`, `src/app/api/rooms/[id]/presence/route.test.ts`
- `src/server/presence/presence.db.test.ts` (check-in, reopen, race, move, work-day boundary, org scope, recent, read guard, D82 for release / replace / unassign / deactivate / room delete / other seat / deleteSeat)
- `src/server/rooms/rooms.test.ts` › "forced delete order" updated: one extra statement (`update presence p set`) before `delete from seats`, indices shifted by one.
- `scripts/schema-check.mjs` section 14 (9 checks).

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: exit 0; check:layers: 924 files, no violations.
- test: 352 files passed | 1 skipped; 3465 passed | 9 skipped.
- build: exit 0.
- test:db: 23 files passed; 365 passed.
- migrate:smoke: migrate smoke ok.
- schema:check: schema check ok (incl. "1 later run applies presence", all "14 ..." pass).

### Out-of-plan files
- `src/server/rooms/rooms.test.ts` — the existing deleteRoom statement-order unit test breaks by design when the D82 hook adds a statement.

### Follow-ups (noticed, not done)
- Deviations from plan wording (same behaviour): check-in insert uses the select-from-subselect form with no `on conflict` (the member row lock serialises all presence writers, the concurrent test proves it); reopen is a separate `update`.
- `GET /api/me/presence` and the room read are not yet wired to any UI (SIM-059/060).

### Scope self-check
- Could the diff be smaller? No; the plan files only.
- Diff size: about +1300 / -5 lines including tests (production code about 600).
