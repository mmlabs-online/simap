# SIM-058: Presence record and check-in, check-out and move-seat API

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | db, api, architecture, security |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T13:01Z |
| PR | — |

## Goal
A member checks in to a room where they have a seat, moves to another of their seats there, and checks out; the
server keeps one presence row per member per UTC+7 work day and every member of the org can read a room's presence.

## Scope reference
`docs/spec-v1.md` PRE-03, PRE-05, §4 Presence row; decisions D77 (lowest seat code, move seat), D78 (display only),
D79 (UTC+7 work day, D35), D81 (same-day reopen), D82 (losing the seat ends the check-in); rules R2, R6, R7.

## Scope
- Forward-only migration: presence table per §4 (org, member, seat, work date, checked-in at, source, checked-out
  at, checked-out by), unique (org, member, work date).
- Check-in (by room), check-out and move-seat route handlers and server code; room presence read endpoint for the
  polling client.
- End of presence computed on read (no background job); D82 system check-out inside the existing seat release /
  reassign and member deactivation transactions.
- Audit entries for check-in, check-out, move and system check-out.

## Out of scope
- UI (SIM-057, SIM-059, SIM-060); provider source (SIM-063); retention cleanup (OQ-70).

## Acceptance criteria
- [ ] Check-in names a room; the server requires a seat of the member in that room (422 `no_seat_in_room`), uses the
  lowest seat code when there are several (D77), records source `self`, server time and today's UTC+7 work date; the
  client never sends a time.
- [ ] Idempotent: check-in again to the same room while checked in returns the existing record with 200 and writes
  nothing; check-in to another room while checked in returns 409 `already_checked_in` naming the current room;
  check-out with no active check-in returns 200 and changes nothing.
- [ ] Move seat targets another of the member's own seats in the room of the active check-in (422 `seat_not_yours`
  otherwise, 409 `not_checked_in` with no active check-in); moving to the seat already used returns 200 and writes
  nothing; every move is audited.
- [ ] A second check-in the same day after check-out reopens that day's row (new seat, source, time; checked-out
  cleared); the audit log keeps the earlier check-in (D81).
- [ ] A row with a work date before today (UTC+7) counts as ended when read; losing the checked-in seat (released,
  reassigned) or deactivation ends the check-in in the same transaction, checked out by `system`, audited (D82).
- [ ] Every query is scoped by the token's `org` (R6); auth refusals come only from the auth wrapper before any write
  (R7); domain refusals use 409/422. A room presence read endpoint lists who is checked in to a room for any member of
  the org.
- [ ] The migration is forward-only (R2); unit tests cover the work-day boundary and the rules above, DB tests cover
  the reopen and D82 paths.

## Technical notes
- Files: `db/migrations/<ts>_presence.sql` (High path), new `src/server/presence/**`, new `src/app/api/rooms/[...]/presence`
  and check-in/check-out/move routes (paths are a plan choice), `src/server/seats/seats.ts` and
  `src/server/members/manage.ts` (D82 hooks), `src/lib/validate/`, `src/lib/` UTC+7 work-date helper.
- Presence is display-only (D78): never in exports, reports or the dashboard.
- Risks: D82 touches the seat release / reassign and deactivation transactions; size is at the top of M.

## Test plan
- Unit: UTC+7 work date around midnight, ended-on-read, idempotency, error codes.
- DB (`pnpm test:db`): unique row per day, reopen, move, system check-out on release/reassign/deactivate, org scope.
- `pnpm schema:check` against the local DB.

## Notes / answers from Ming

## Handoff
