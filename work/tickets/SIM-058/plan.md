Status: READY

# Plan — SIM-058: Presence record and check-in, check-out and move-seat API

## Scope summary
- `docs/spec-v1.md` §4 (l.139), Presence row: "org, member, seat, work date (UTC+7 day, D35/D79), checked-in at,
  source (`self` / `provider`), checked-out at (optional), checked-out by (`self` / `provider` / `day_end` /
  `system`, optional) | One row per member per work date (unique (org, member, work date)); a second check-in that
  day reopens it (D81). Active = checked in today and not checked out; at most one active per member (PRE-03). A row
  of an earlier work date counts as ended (PRE-05). Display only, never an attendance record (D78)".
- PRE-03 (l.720-737): "Check-in names a room. The server checks that the member occupies a seat in that room (422
  `no_seat_in_room` otherwise) and records presence with source `self` and the server time. The client never sends a
  time. When the member has several seats in that room, the check-in uses the lowest seat code (D77)." Move seat:
  "The server refuses a seat that is not theirs or not in the room of the active check-in (422 `seat_not_yours`), or
  a move with no active check-in (409 `not_checked_in`). Moving to the seat already used returns 200 and writes
  nothing (idempotent). Every move is audited." Idempotent re-check-in "returns the existing record with 200 and
  writes nothing new"; another room while checked in "is refused with 409 `already_checked_in` (naming the current
  room)"; "Checking out with no active check-in changes nothing and returns 200"; reopen (D81); "Every check-in and
  check-out is audited (SYS-03) and scoped by the token's `org` (R6). Auth refusals come only from the auth wrapper,
  before any write (R7); domain refusals use 409/422."
- PRE-05 (l.750-756): "The day boundary needs no background job: a record whose work date is before "today" (UTC+7)
  counts as ended when read. Check-in always writes today's UTC+7 work date." "If the member loses the checked-in seat
  (released, reassigned) or is deactivated while checked in, the check-in ends in the same transaction (checked out
  by `system`) and is audited (D82)."
- PRE-06 (l.759): "Every member of the org sees presence in every room: who is here, check-in time and source (self /
  third-party). There is no hidden presence."
- `work/decisions.md`: D77 (lowest seat code; move must target "the member's own seat in the same room as the active
  check-in (422 otherwise), is idempotent and audited"), D78 (display-only, "never used for ... reporting or
  exports"), D79 (UTC+7 work day for every org), D81 (reopen; "the audit log keeps the earlier check-in"), D82.
- Rules R1, R2, R6, R7 (CLAUDE.md).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Check-in names a room; 422 `no_seat_in_room` without a seat there; lowest seat code (D77); source `self`; server time; today's UTC+7 work date; client never sends a time | `presence.db.test.ts` › "check-in records self, server time and today's UTC+7 date", "no seat in room → 422 no_seat_in_room", "several seats → lowest seat code (seq 2 before seq 10)"; `rules.test.ts` › `pickCheckInSeat`; route test › "check-in ignores any request body" |
| 2 | Idempotent re-check-in (200, nothing written); other room → 409 `already_checked_in` naming the room; check-out with nothing active → 200, no change | `presence.db.test.ts` › "same-room check-in again → 200, same record, no new row or audit", "other room → 409 already_checked_in with room id/code/name", "check-out with nothing active → 200, no write"; `presence-routes.test.ts` › 409 body shape; `presence.test.ts` › "noop writes nothing" |
| 3 | Move to own seat in the active room; 422 `seat_not_yours`; 409 `not_checked_in`; same seat → 200 no write; every move audited | `presence.db.test.ts` › "move to own seat in room → audited presence.move", "move to other member's seat / seat in another room / unknown seat → 422 seat_not_yours", "move with no active check-in (incl. prior-day open row) → 409 not_checked_in", "move to current seat → 200, no audit"; `rules.test.ts` › `decideMove` |
| 4 | Second check-in the same day after check-out reopens the row (new seat, source, time; checked-out cleared); audit keeps the earlier check-in | `presence.db.test.ts` › "check-in, check-out, check-in another room → one row, reopened, two presence.check_in audit rows" |
| 5 | Prior-day row counts as ended on read; losing the checked-in seat (release, reassign) or deactivation ends the check-in in the same tx, by `system`, audited | `rules.test.ts` › `isActive` / work-day boundary; `presence.db.test.ts` › "yesterday's open row is not active and does not block", "releaseSeat / setOccupant replace / setOccupant unassign / deactivateMember / deleteRoom force → checked_out_by system + presence.system_check_out audit", "releasing a seat that is not the checked-in seat leaves presence open", "a refused deactivation leaves presence open"; `seats.test.ts`, `manage.test.ts` › presence update inside the tx after the seat/member locks |
| 6 | R6 org scope; R7 auth refusals only from the wrapper before any write; domain refusals 409/422; room presence read for any member | `presence.test.ts` › "every statement filters org_id = $1 and binds the scope org first"; `presence-routes.test.ts` › "all four routes use tier user", "no 401/403 emitted by handlers", 404 bad uuid; `presence.db.test.ts` › "org B cannot check in to or read org A's room (404)", "room read lists active members only, no email, no checked_out_by" |
| 7 | Forward-only migration (R2); unit tests for work-day boundary and rules; DB tests for reopen and D82 | `db/migrations/20261126150000_presence.sql` reviewed (new table only); `pnpm migrate:smoke`; `pnpm schema:check` (new presence section); `pnpm test`; `pnpm test:db` (CI) |

Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; locally `pnpm migrate`,
`pnpm schema:check` and `pnpm test:db` against `compose.dev.yml` Postgres.

## Ming verification after merge
- The release applies `20261126150000_presence.sql` cleanly on the shared Postgres (Ming's release step).
- End-to-end check-in on a real device waits for the UI tickets (SIM-059/SIM-060); nothing to click in this ticket.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261126150000_presence.sql` | New: `presence` table, constraints, indexes | §4 Presence row, R2 | **Yes** (`db/migrations/**`, `**/*.sql`) |
| `db/migrations/README.md` | Add "Presence (SIM-058)" paragraph (columns, delete rule cascade on seat, no stored room, rollback note) | Migration docs convention | No |
| `scripts/schema-check.mjs` | Add a presence section (see Tests) and add `presence` to the seed count list (l.206-220) | `pnpm schema:check` in the ticket test plan | No |
| `src/lib/presence/types.ts` | New: `PresenceDto`, `RoomPresenceItem`, `RoomPresenceResponse`, `PresenceSource`, `PRESENCE_LIMITS` | Shared DTOs (UI tickets import from lib, R1) | No |
| `src/lib/presence/rules.ts` | New, pure: `isActive`, `pickCheckInSeat`, `decideCheckIn`, `decideMove` | Rule 6 (pure logic first) | No |
| `src/lib/presence/rules.test.ts` | New unit tests | R5 | No |
| `src/lib/validate/presence.ts` | New: `validatePresenceMove(body)` → `{ seatId }` (canonical uuid, no extra keys) | Boundary validation | No |
| `src/lib/validate/presence.test.ts` | New unit tests | R5 | No |
| `src/lib/api/error.ts` | Add codes `no_seat_in_room`, `already_checked_in`, `not_checked_in`; add optional `room?: { id: string; code: string; name: string }` to `ApiErrorBody` | New domain codes; 409 names the room | No |
| `src/ui/copy/api.ts` | English messages for the three new codes (typecheck forces it, l.4) | D36, exhaustive copy map | No |
| `src/server/presence/end.ts` | New, server-only: `endPresence(c, scope, actorSub, target, reason, now)` (D82 helper) | One shared D82 step for all seat-loss paths | No |
| `src/server/presence/presence.ts` | New, server-only: `checkIn`, `checkOut`, `moveSeat`, `getRoomPresence`, own `Refusal`/`inTx` | Service code | No |
| `src/server/presence/presence.test.ts` | New fake-DB unit tests (org scope, lock order, no write on noop) | R5, R6 | No |
| `src/server/presence/presence.db.test.ts` | New DB integration tests | Ticket test plan | No |
| `src/server/presence/display-only.test.ts` | New: source of `src/server/export/export.ts`, `src/server/dashboard/dashboard.ts`, `src/server/search/search.ts` contains no `presence` | D78 guard | No |
| `src/app/api/rooms/[id]/check-in/route.ts` | New `POST` | Check-in | No |
| `src/app/api/rooms/[id]/presence/route.ts` | New `GET` | Room presence read | No |
| `src/app/api/presence/check-out/route.ts` | New `POST` | Check-out | No |
| `src/app/api/presence/seat/route.ts` | New `PUT` | Move seat | No |
| `src/app/api/presence/presence-routes.test.ts` | New route tests (mock service, as `src/app/api/devices/devices-routes.test.ts`) | R5, R7 | No |
| `src/server/seats/seats.ts` | D82 hook in `writeOccupant` (l.312-344) and `releaseSeat` (l.504-517) | D82 | No |
| `src/server/seats/seats.test.ts` | Add hook-order tests | R5 | No |
| `src/server/members/manage.ts` | D82 hook in `deactivateMember` after the release block (after l.422, before the member status update l.467) | D82 | No |
| `src/server/members/manage.test.ts` | Add hook-order test | R5 | No |
| `src/server/rooms/rooms.ts` | D82 hook in `deleteRoom` before `delete from seats` (l.251) | Force delete of an occupied seat loses the seat (see Assumptions A3) | No |

`respond.ts` (High path `src/server/http/**`) is **not** touched: the 409 with `room` builds its body in the route,
as `src/app/api/map-items/[key]/route.ts:16-17` already does for `item_in_use` + `rooms`.

## Data model / migration
`db/migrations/20261126150000_presence.sql` (sorts after `20261126140000_members_pixel_look.sql`; no begin/commit,
no `concurrently`, no grants; header comment "SIM-058 / PRE, D76-D82. Expand-only: a new table; the previous image
never reads or writes it."):

```sql
create table presence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  member_id uuid not null,
  seat_id uuid not null,
  work_date date not null,
  checked_in_at timestamptz not null,
  source text not null,
  checked_out_at timestamptz null,
  checked_out_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presence_org_id_key unique (org_id, id),
  constraint presence_org_member_day_key unique (org_id, member_id, work_date),
  constraint presence_source_check check (source in ('self', 'provider')),
  constraint presence_checked_out_by_check
    check (checked_out_by in ('self', 'provider', 'day_end', 'system')),
  constraint presence_checked_out_pair_check check ((checked_out_at is null) = (checked_out_by is null)),
  constraint presence_member_fkey foreign key (org_id, member_id) references members (org_id, id),
  constraint presence_seat_fkey foreign key (org_id, seat_id) references seats (org_id, id) on delete cascade
);
create index presence_org_seat_idx on presence (org_id, seat_id);
create index presence_org_day_open_idx on presence (org_id, work_date) where checked_out_at is null;
```
- `seat_id` not null: a check-in always has a seat; the room is derived from the seat (no `room_id` column; seats
  never change room, `seats.ts:261`).
- `checked_in_at` has no default: the service always writes the request instant (one instant for time and work date).
- `provider` / `day_end` are allowed now (spec §4 lists them) so SIM-063 needs no contract migration; SIM-058 writes
  only `self` (source, checked-out by) and `system` (checked-out by).
- Member FK is NO ACTION (members are never deleted). Seat FK cascades (see A3), like `seat_requests_seat_fkey`.
- `(org_id, member_id, work_date)` covers the member lookups; `presence_org_seat_idx` indexes the FK and the D82
  seat update; the partial index serves the room read and stays small (only open rows).
- Downgrade: none (forward-only, R2). Rolling back the image leaves the table unused; D82 hooks are then absent, so a
  stale open row may survive until the end of that UTC+7 day, when it counts as ended. One line in the README.

## API contract
All routes: `withAuth(..., { tier: "user" })`, `export const dynamic = "force-dynamic"`, `Cache-Control: no-store`,
`isCanonicalUuid(id)` else 404 `not_found`, `getPool()` null → 503 `unavailable`. Handlers never emit 401/403 (R7).

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `/api/rooms/[id]/check-in` | No body; any body is ignored (never read) | `{ presence: PresenceDto }` | 201 new or reopened row; 200 already checked in to this room (no write); 404 `not_found` (room not in org); 422 `no_linked_member`; 422 `no_seat_in_room`; 409 `already_checked_in` with `error.room = { id, code, name }` | any member (user) |
| POST | `/api/presence/check-out` | No body (ignored) | `{ presence: null }` | 200 always (closed or nothing to close) | any member |
| PUT | `/api/presence/seat` | `{ "seatId": "<uuid>" }` (validated, no extra keys) | `{ presence: PresenceDto }` | 200 (moved or same seat); 400 `invalid_request`; 422 `no_linked_member`; 409 `not_checked_in`; 422 `seat_not_yours` (also for an unknown seat or another org's seat) | any member |
| GET | `/api/rooms/[id]/presence` | — | `RoomPresenceResponse` | 200; 404 `not_found` | any member |

Types (`src/lib/presence/types.ts`), times ISO 8601 UTC strings, camelCase:
- `PresenceSource = "self" | "provider"`.
- `PresenceDto = { id, memberId, roomId, roomCode, seatId, seatCode, workDate /* YYYY-MM-DD UTC+7 */, checkedInAt, source }`
  (active check-ins only; no checked-out fields).
- `RoomPresenceItem = { memberId, displayName, hasPhoto, photoVersion, seatId, seatCode, checkedInAt, source }` (same
  member fields Users already get in the seats DTO occupant, `seats.ts:97-104`; never email, employee code, group,
  devices, `checked_out_by` or history).
- `RoomPresenceResponse = { room: { id, code, name }, items: RoomPresenceItem[], truncated: boolean, me: PresenceDto | null }`;
  `items` ordered by `checked_in_at, id`, limit `PRESENCE_LIMITS.list = 500` (fetch 501 → `truncated`); `me` is the
  caller's active check-in in any room (null when none or no member row).

Audit (entity `presence`, entity id = presence row id, actor = `ctx.sub`):
- `presence.check_in` meta `{ memberId, roomId, roomCode, seatId, seatCode, source: "self", reopened }`.
- `presence.check_out` meta `{ memberId, seatId, seatCode, by: "self" }`.
- `presence.move` meta `{ memberId, roomId, fromSeatId, fromSeatCode, toSeatId, toSeatCode }`.
- `presence.system_check_out` meta `{ memberId, seatId, by: "system", reason }`, reason one of `seat_released`,
  `seat_unassigned`, `seat_reassigned`, `member_deactivated`, `room_deleted`; actor = the user whose action caused it.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/presence/rules.test.ts` › work day: `todayUtc7` at `2026-11-26T16:59:59.999Z` → `2026-11-26`, `17:00:00.000Z` → `2026-11-27`, `2026-12-31T17:00Z` → `2027-01-01` | UTC+7 boundary (Domain focus) |
| `rules.test.ts` › `isActive`: today open → true; today checked out → false; yesterday open → false | Ended on read (PRE-05) |
| `rules.test.ts` › `pickCheckInSeat`: seq 10 vs 2 → seq 2 (codes `R-10`/`R-02`, and `R-100` vs `R-99`); one seat; empty → null | D77 lowest seat code |
| `rules.test.ts` › `decideCheckIn`: no seats → `refuse_no_seat`; active same room → `noop`; active other room → `refuse_already`; closed today row → `reopen`; no row → `insert` | Rules, error precedence |
| `rules.test.ts` › `decideMove`: no active → `refuse_not_checked_in`; target not among own seats in the room → `refuse_not_yours`; target = current → `noop`; else `move` | D77 move |
| `src/lib/validate/presence.test.ts` › canonical `seatId` ok; non-uuid, upper-case/non-canonical, missing, extra key, non-object, array → invalid | Boundary validation |
| `src/server/presence/presence.test.ts` › every statement filters `org_id = $1` and binds the scope org first (checkIn, checkOut, moveSeat, getRoomPresence, endPresence) | R6 |
| `presence.test.ts` › checkIn lock order: member `for share` → room `for share` → member's seats in room `order by id for share` → presence `for update` → insert/update → audit | Deadlock safety |
| `presence.test.ts` › noop check-in / same-seat move / empty check-out issue no `insert`/`update` | Idempotency |
| `presence.test.ts` › insert conflict (zero rows returned) re-reads the row and decides again (noop) | Race handling |
| `src/server/presence/display-only.test.ts` › export, dashboard and search sources never mention `presence` | D78 |
| `src/app/api/presence/presence-routes.test.ts` › bad uuid → 404; no pool → 503; move bad body → 400; check-in insert → 201, noop → 200; 409 body `{ error: { code: "already_checked_in", room: {...} } }`; check-out → 200 `{ presence: null }`; a plain user reaches every route; no handler returns 401/403 for a service refusal | API contract, R7 |
| `src/server/seats/seats.test.ts` › releaseSeat (non-noop): presence update after `update seats`, before commit; noop release: no presence statement | D82 in tx |
| `seats.test.ts` › setOccupant replace and unassign: presence update after the seat update; assign to an empty seat: none | D82 reassign |
| `src/server/members/manage.test.ts` › deactivateMember: presence update after the member/room/seat locks and before `update members set status`; refused (`member_not_empty`, self) → none | D82 deactivate |
| `src/server/presence/presence.db.test.ts` › check-in records `self`, `checked_in_at` ≈ now, `work_date` = `todayUtc7(now)`; audit `presence.check_in` | AC1 |
| `presence.db.test.ts` › no seat in room → 422; several seats → lowest seq; deactivated/unknown member → 422 `no_linked_member` | AC1 |
| `presence.db.test.ts` › same-room again → 200, same id, audit count unchanged; other room → 409 with room id/code/name; check-out twice → second is a no-op | AC2 |
| `presence.db.test.ts` › move own seat (audited), same seat (no audit), other member's seat / other room / unknown → 422, none active → 409 | AC3 |
| `presence.db.test.ts` › check-in A, check-out, check-in B same day → one row, seat B, checked-out null, two `presence.check_in` audit rows (second `reopened: true`) | AC4, D81 |
| `presence.db.test.ts` › yesterday's open row (inserted directly with `work_date = today - 1`) → read excludes it, `me` null, check-in today inserts a second row, move → 409 | AC5 ended on read |
| `presence.db.test.ts` › D82: releaseSeat, setOccupant replace, setOccupant unassign, deactivateMember(release), deleteRoom(force) each end the open row by `system` with a `presence.system_check_out` audit row in the same tx; releasing a non-checked-in seat of the same member leaves the row open; a refused deactivation leaves it open; deleteSeat / deleteRoom of seats with old rows succeed (cascade) | AC5, D82, FK |
| `presence.db.test.ts` › org scope: org B member cannot check in to / read org A room (404), cannot move to an org A seat (422) | AC6, R6 |
| `presence.db.test.ts` › room read: lists only today's open rows of that room, ordered, no `email` key; any member (no seat) can read | AC6, PRE-06 |
| `presence.db.test.ts` › two parallel check-ins of one member → one row, one audit row, both answers ok | Race |
| `scripts/schema-check.mjs` › "12 presence": second row same (org, member, work_date) refused `23505 presence_org_member_day_key`; bad source refused `23514 presence_source_check`; checked_out_at without by refused `23514 presence_checked_out_pair_check`; cross-org seat refused `23503`; deleting a seat cascades its presence rows | Schema, R2/R6 |

## Approach
1. **Migration + README + schema-check** as above. Run `pnpm migrate`, `pnpm migrate:smoke`, `pnpm schema:check`
   locally (R2: new table only, expand step).
2. **Pure lib** (`src/lib/presence/`): reuse the existing UTC+7 helper `todayUtc7(now)` in
   `src/lib/devices/holding.ts:5` (do not add a second one; import it into rules/server). Write `isActive`,
   `pickCheckInSeat` (min `seq`, then id), `decideCheckIn`, `decideMove`, types and limits. Validator in
   `src/lib/validate/presence.ts` mirroring `validate/seat.ts` (`isPlainObject`, `unknownKey`, `isCanonicalUuid`).
3. **Error codes**: add three codes + optional `room` to `ApiErrorBody` in `src/lib/api/error.ts`; copy in
   `src/ui/copy/api.ts`.
4. **`src/server/presence/end.ts`** (`import "server-only"`): `endPresence(c, scope, actorSub, target, reason, now)`,
   `target` = `{ seatIds: string[] }` or `{ memberId: string }`:
   `update presence set checked_out_at = $3, checked_out_by = 'system', updated_at = now() where org_id = $1 and
   work_date = $2 and checked_out_at is null and (seat_id = any($4::uuid[]) | member_id = $4) returning id, member_id, seat_id`;
   one `writeAudit` per returned row. `now` defaults to `new Date()`; `work_date = todayUtc7(now)`. Only today's rows
   are touched (older open rows are already ended on read and keep their history).
5. **D82 hooks** (all inside the existing transaction; the presence row is always the last lock, after member, room,
   seat, so no new lock-order edge):
   - `writeOccupant` (`seats.ts:312`): after the seats update, `if (seat.occupant_id !== null && seat.occupant_id !==
     memberId)` → `endPresence({ seatIds: [seat.id] }, memberId === null ? "seat_unassigned" : "seat_reassigned")`.
     Covers `setOccupant` replace/unassign; `approveRequest` (`requests.ts:201`) only assigns empty seats, so it never
     triggers it. Signature of `writeOccupant` unchanged (`now` taken inside).
   - `releaseSeat` (`seats.ts:504-517`): after the seats update in the non-noop branch, reason `seat_released`.
   - `deactivateMember` (`manage.ts`): after the `if (decision === "release")` block (l.422), before the status
     update (l.467) → `endPresence({ memberId: id }, "member_deactivated")`. Runs only past the noop/refuse checks,
     so refused deactivations change nothing.
   - `deleteRoom` (`rooms.ts:251`): before `delete from seats` → `endPresence({ seatIds: <room's seat ids from the
     locked select at l.234-239> }, "room_deleted")` (audit before the cascade removes the rows).
   - `deleteSeat` needs no hook: it refuses an occupied seat (`seats.ts:409`), and D82 guarantees an open row's seat
     is occupied; old rows cascade.
   - Only the checked-in seat matters: losing another seat in the same room leaves the check-in (D82 "loses the
     checked-in seat").
6. **`src/server/presence/presence.ts`** (own `Refusal` union `404|409|422` with codes `not_found`,
   `no_linked_member`, `no_seat_in_room`, `already_checked_in`, `not_checked_in`, `seat_not_yours` and optional
   `room`; own `Abort`/`inTx` as `manage.ts:30-60` does; every statement through `orgQuery`; inserts use the
   `select ... from (select $1::uuid as org_id) o where o.org_id = $1::uuid` form of `audit/write.ts:22-24`).
   One instant per request: `now = new Date()` (injectable for tests), `today = todayUtc7(now)`; `checked_in_at` /
   `checked_out_at` are written as `$n::timestamptz` from `now`.
   - `checkIn(db, scope, sub, roomId, now?)`: tx → member by sub `for share` (missing or not `active` → 422
     `no_linked_member`; the gate already refuses deactivated callers before the handler, this covers the race) →
     room `for share` (404) → `select id, code, seq from seats where org_id = $1 and room_id = $2 and occupant_id = $3
     order by id for share` → today's row `for update` (joined to seats for room id/code/name) → `decideCheckIn`.
     `insert`: `insert ... on conflict (org_id, member_id, work_date) do nothing returning *`; zero rows (parallel
     insert won) → re-select `for update` and decide once more. `reopen`: update seat, source `self`,
     `checked_in_at`, clear checked-out fields. Write `presence.check_in` audit only on insert/reopen. Return
     `{ presence, created: boolean }` (route maps created → 201, else 200).
   - `checkOut(db, scope, sub, now?)`: tx → member by sub (no row → value null) → `update ... set checked_out_at,
     checked_out_by = 'self' where org_id, member_id, work_date = today, checked_out_at is null returning` → audit
     only if a row changed. Returns null.
   - `moveSeat(db, scope, sub, seatId, now?)`: tx → member by sub `for share` (422 `no_linked_member`) → today's open
     row unlocked with its room (none → 409 `not_checked_in`) → room `for share` → member's seats in that room
     `order by id for share` → presence row `for update` and re-check it is still open (else 409) → `decideMove` →
     update `seat_id` (keep `checked_in_at`) + `presence.move` audit; noop returns the current DTO.
   - `getRoomPresence(db, scope, sub, roomId, now?)`: no tx; room (404) → items join `presence p`, `seats s`,
     `members m` (every join repeats `org_id`) where `p.work_date = $3 and p.checked_out_at is null and s.room_id = $2`
     → `me` by sub.
   - Lock order everywhere: member → room → seats (id order) → presence row, matching `rooms.ts:213-224`.
7. **Routes** as in the API contract, copying `src/app/api/seats/[id]/release/route.ts`; check-in/check-out never
   call `readJson`; move uses `readJson` + `validatePresenceMove` (400). The 409 `already_checked_in` response is
   built in the check-in route with `satisfies ApiErrorBody` (map-items precedent).
8. **Tests** per the table; run all Checks; `pnpm test:db` locally.

Rules: R1 (lib has no server imports; routes are the only entry to `src/server/presence`; `pnpm check:layers`), R2
(new forward-only migration), R6 (`orgQuery`, composite FKs, org-scoped joins, DB org test), R7 (handlers emit only
404/400/409/422/503; every refusal is decided before any write in the tx), R3 (no config), R5 (tests above). D78:
no change to export, dashboard, search or reports (guard test). Idempotency: `apiFetch` re-sends only on 401/403,
which come only from `withAuth` before the handler runs, so a replay never follows a write; every call is also a
no-op on state replay except a check-in after an intended check-out, which cannot be replayed late for this reason.

## Specialist input used
- consult-database-optimizer: adopted the table shape, explicit constraint names, composite FKs, enum checks incl.
  `provider`/`day_end` (Q7), pair check, partial open-row index, no `room_id` column, lock order member → room → seat
  → presence, upsert with conflict handling, one shared D82 helper with today's work date, hooks in `writeOccupant`
  (not each caller) / `releaseSeat` / `deactivateMember`, own `Refusal`/`inTx`, audit actions. Q2 resolved: order by
  `seq` (codes are `<room>-<seq padded to 2>`, `seat-code.ts:8`, so text order breaks at seq ≥ 100; within one room
  seq order is the numeric code order). Q3 resolved by schema: `actor_sub` is `uuid not null`, so the acting user's
  sub + `meta.by = "system"` + `reason`. Q4 yes (from/to in meta). Q5 resolved from code: approval assigns only empty
  seats, so the `writeOccupant` hook is enough. Q6: no D82 action on `cannot_seat` (D82 lists only release,
  reassign, deactivation). Q1: see A3. Adjusted: the work date uses the app instant passed as a parameter (one
  instant for time and date, testable) instead of `now()` in SQL; the DB consult's member-id end in deactivation is
  kept, its seat-id variant dropped (the member-id update already covers it).
- consult-api-platform-engineer: adopted route conventions, `tier: "user"`, the four paths, room-less check-out
  (Q2), `PUT` move with `{ seatId }`, 201 write / 200 no-op (Q1), same 422 for unknown seats, response shapes, `me` in
  the room read (Q3) so the popup needs no second call, user-safe member fields only (Q6: `display_name`,
  `hasPhoto`, `photoVersion` as in the seats DTO), `room` in the 409 body (Q4, as `{ id, code, name }` since the
  spec says "naming the current room"), end rather than repoint on seat loss (Q5, D82 wording). Rejected:
  denormalised `room_id` (Q7; derived from the seat, one less invariant to keep), `apiError` extras in `respond.ts`
  (High path; the route builds the body like map-items), check-in returning a reopened record with 200 (201 for any
  write).

## Assumptions
- A1 Status codes: check-in answers 201 for an insert or a reopen and 200 for the idempotent no-op; move and
  check-out always 200; check-out returns `{ presence: null }`. Ming may prefer 200 everywhere (cheap to change).
- A2 Lowest seat code = lowest `seats.seq` in that room (equals numeric code order; avoids `R-100` < `R-99`).
- A3 `presence.seat_id` FK is `on delete cascade`: presence is display-only (D78) and history stays in `audit_log`;
  otherwise deleting a seat or room with any old presence row would fail with 23503. `deleteRoom(force)` can delete
  an occupied seat, so it ends open check-ins first (`room_deleted`, audited) — treated as "losing the seat" (D82).
- A4 409 `already_checked_in` names the room as `error.room = { id, code, name }` (additive optional field in
  `ApiErrorBody`).
- A5 The room read includes `me` (the caller's active check-in in any room); SIM-059/060 may add fields (e.g. pixel
  look, last check-in per room) in their own tickets.
- A6 D82 ends only today's open row; an older open row already counts as ended and is left as is. A check-in
  survives losing another (not checked-in) seat in the same room.
- A7 A missing or deactivated member row inside the check-in/move transaction answers 422 `no_linked_member` (no
  401/403 after the wrapper, R7).
- A8 Retention of presence rows stays open (OQ-70); no cleanup here.
- Hotspots: no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board. `seats.ts`, `manage.ts`, `rooms.ts`,
  `error.ts` and `api.ts` are shared, frequently edited files; SIM-060 / SIM-063 will later build on
  `src/server/presence/**`.

## Blocking questions
None.

## Split proposal
None required: estimated ~550 changed product lines plus tests, at the top of M as the ticket says; the D82 hooks
are ~40 lines and must ship with the presence table so no window exists where a lost seat keeps a check-in. If the
implementation runs well past that, move the `GET /api/rooms/[id]/presence` read (and its tests) to a follow-up
SIM-058.1 before SIM-060 starts, and record it in impl-log.
