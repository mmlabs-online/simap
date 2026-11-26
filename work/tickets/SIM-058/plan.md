Status: READY

# Plan — SIM-058: Presence record and check-in, check-out and move-seat API

## Scope summary
- `docs/spec-v1.md` §4 (line 139), entity **Presence**: "org, member, seat, work date (UTC+7 day, D35/D79), checked-in
  at, source (`self` / `provider`), checked-out at (optional), checked-out by (`self` / `provider` / `day_end` /
  `system`, optional) | One row per member per work date (unique (org, member, work date)); a second check-in that day
  reopens it (D81). Active = checked in today and not checked out; at most one active per member (PRE-03). A row of an
  earlier work date counts as ended (PRE-05). Display only, never an attendance record (D78); retention: OQ-70."
- PRE-03 (lines 720-737): "Check-in names a room. The server checks that the member occupies a seat in that room (422
  `no_seat_in_room` otherwise) and records presence with source `self` and the server time. The client never sends a
  time. When the member has several seats in that room, the check-in uses the lowest seat code (D77)." / "Move seat …
  refuses a seat that is not theirs or not in the room of the active check-in (422 `seat_not_yours`), or a move with no
  active check-in (409 `not_checked_in`). Moving to the seat already used returns 200 and writes nothing" / "checking in
  again to the same room while checked in there returns the existing record with 200 and writes nothing new" /
  "checking in to another room while checked in is refused with 409 `already_checked_in` (naming the current room)" /
  "Checking out with no active check-in changes nothing and returns 200." / "reopens that day's row with the new seat,
  source and time and clears checked-out; the audit log keeps the earlier check-in (D81)." / "Every check-in and
  check-out is audited (SYS-03) and scoped by the token's `org` (R6). Auth refusals come only from the auth wrapper,
  before any write (R7); domain refusals use 409/422."
- PRE-05 (lines 750-756): "a record whose work date is before "today" (UTC+7) counts as ended when read. Check-in always
  writes today's UTC+7 work date." / "If the member loses the checked-in seat (released, reassigned) or is deactivated
  while checked in, the check-in ends in the same transaction (checked out by `system`) and is audited (D82)."
- PRE-06 (line 759): "Every member of the org sees presence in every room: who is here, check-in time and source …
  There is no hidden presence."
- Decisions: D77 (lowest seat code; move "must target the member's own seat in the same room as the active check-in
  (422 otherwise), is idempotent and audited"), D78 (display-only, never in reporting or exports), D79 (UTC+7 work day
  for every org), D81 (same-day reopen), D82 (losing the seat or deactivation ends the check-in, system, audited).
- Rules R2 (forward-only migration), R6 (org scope), R7 (auth refusals only from the wrapper).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Check-in names a room; requires a seat of the member there (422 `no_seat_in_room`); lowest seat code (D77); source `self`, server time, today's UTC+7 work date; the client never sends a time | `presence.db.test.ts` › "check-in records self, server time and today's work date", "uses the lowest seat by seq (99 before 100)", "no seat in room → 422 no_seat_in_room, no row, no audit"; `validate/presence.test.ts` › "a time or any extra key is refused"; route test "PUT with checkedInAt → 400" |
| 2 | Idempotent same-room check-in (200, no write); other room → 409 `already_checked_in` naming the room; check-out with nothing active → 200, no change | `presence.db.test.ts` › "same room twice → same row, one audit", "other room → 409 with the current room code", "check-out with nothing active → 200, no audit"; `rules.test.ts` › decideCheckIn / decideCheckOut cases; route test "409 body is { error: { code, room } }" |
| 3 | Move seat: own seat in the active room (422 `seat_not_yours` otherwise, 409 `not_checked_in` with none); same seat → 200 no write; every move audited | `presence.db.test.ts` › "move to own other seat", "move to the same seat writes nothing", "seat of another member / other room / unknown id → 422", "no active check-in → 409 (before seat checks)"; `rules.test.ts` › decideMove order |
| 4 | Same-day check-in after check-out reopens the row (new seat, source, time; checked-out cleared); audit keeps the earlier check-in | `presence.db.test.ts` › "reopen keeps one row and two presence.check_in audits" |
| 5 | Earlier work date counts as ended on read; losing the seat (released, reassigned) or deactivation ends it in the same tx, by `system`, audited | `work-date.test.ts` (boundary); `presence.db.test.ts` › "yesterday's open row is ended on read (injected now)", "D82: releaseSeat / setOccupant replace / setOccupant unassign / deactivateMember / deleteRoom force end the check-in with presence.system_check_out", "releasing another seat leaves the check-in active" |
| 6 | Org scope (R6), auth refusals only from the wrapper (R7), domain refusals 409/422; room read lists who is checked in for any org member | `presence.db.test.ts` › "org scope: other org's room → 404, read lists only own org"; route tests "401 without token, service not called", "tier user can read the room"; reviewer greps the new server files: every SQL goes through `orgQuery`, and no handler returns 401/403 itself |
| 7 | Forward-only migration (R2); unit tests cover the work-day boundary and rules; DB tests cover reopen and D82 | Review of `db/migrations/20261126150000_presence.sql` (new table only, no edits to applied files); `pnpm schema:check` section 14 green locally; `pnpm test`, `pnpm test:db` (CI) green |
| — | D78: presence stays out of exports, reports and the dashboard | Reviewer greps `src/server/export/**`, `src/server/dashboard/**`, `src/server/members/manage.ts` `impactOf`: no `presence` reference |

## Ming verification after merge
- After the next release deploys the migration: sign in as a User with a seat, check in, check out and check in again
  on the hosted app (via the API or the SIM-059 UI once it lands) and confirm `presence` rows and `presence.*` audit
  entries appear in the audit view. No other Ming-only checks.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261126150000_presence.sql` | new: `presence` table, constraints, one index | §4 Presence row, R2 | **Yes** (`db/migrations/**`, `**/*.sql`) |
| `db/migrations/README.md` | add a "Presence (SIM-058, D77-D82)" bullet after the pixel-look bullet (line 80), incl. delete rules and the rollback note | schema docs convention | No |
| `scripts/schema-check.mjs` | add "1 later run applies presence" next to lines 161-176; new section `// 14 presence (SIM-058)` after line 1178 (before `// extras`) | constraint coverage on a real DB | No |
| `src/lib/presence/work-date.ts` | new: `workDateUtc7(now: Date): string` (`YYYY-MM-DD`, fixed +7 h, no DST) | D79, single date source | No |
| `src/lib/presence/work-date.test.ts` | new: boundary tests | test plan | No |
| `src/lib/presence/rules.ts` | new: pure `decideCheckIn`, `decideMove`, `decideCheckOut`, `isActive` | pure logic first | No |
| `src/lib/presence/rules.test.ts` | new | test plan | No |
| `src/lib/presence/types.ts` | new: `MyPresenceDto`, `MyPresenceResponse`, `RoomPresenceResponse`, `PresenceSource` | shared DTOs for SIM-057/059/060 | No |
| `src/lib/validate/presence.ts` | new: `validateCheckIn` (`{ roomId }`), `validateMove` (`{ seatId }`); unknown keys refused | boundary validation | No |
| `src/lib/validate/presence.test.ts` | new | test plan | No |
| `src/lib/api/error.ts` | add `no_seat_in_room`, `already_checked_in`, `not_checked_in` to `API_ERROR_CODES`; `ApiErrorBody` gets optional `room?: string` | new domain codes, 409 names the room | No |
| `src/ui/copy/api.ts` | add messages for the three new codes (the `satisfies Record<ApiErrorCode, string>` at line 77 requires it) | typecheck; `auth.test.ts` line 63 checks every code | No |
| `src/server/presence/sql.ts` | new: `activeWhere(todayParam)` SQL fragment, shared selects (ISO time format) | one "active" rule for every query | No |
| `src/server/presence/presence.ts` | new: `checkIn`, `checkOut`, `moveSeat`, `getMyPresence`; own `Result`/`Refusal` (with `room?`) and `inTx` on `withTx` | PRE-03 | No |
| `src/server/presence/read.ts` | new: `listRoomPresence` | PRE-06 room read | No |
| `src/server/presence/end.ts` | new: D82 helpers `endPresenceForSeat`, `endPresenceForMember`, `endPresenceForRoom` (take the caller's tx client) | D82 | No |
| `src/server/presence/presence.db.test.ts` | new: DB integration tests | test plan | No |
| `src/server/seats/seats.ts` | `writeOccupant` (line 312, after the update at 323-328) and `releaseSeat` (after the update at 505-510) call `endPresenceForSeat` | D82 release / reassign | No |
| `src/server/members/manage.ts` | `deactivateMember`: after the `release` block (ends line 422), call `endPresenceForMember` | D82 deactivation | No |
| `src/server/rooms/rooms.ts` | `deleteRoom`: before `delete from seats` (line 251), call `endPresenceForRoom` | D82: a forced room delete removes occupied seats | No |
| `src/app/api/me/presence/route.ts` | new: `GET`, `PUT` (check-in), `PATCH` (move), `DELETE` (check-out) | API | No |
| `src/app/api/me/presence/route.test.ts` | new: route tests (service mocked, pattern of `src/app/api/me/pixel-look/route.test.ts`) | R7, codes | No |
| `src/app/api/rooms/[id]/presence/route.ts` | new: `GET` room presence | PRE-06 polling read | No |
| `src/app/api/rooms/[id]/presence/route.test.ts` | new | codes, tier | No |

Not touched: `src/server/http/**` (High path; the 409 with `room` is built in the route with `Response.json(... satisfies
ApiErrorBody)` like `src/app/api/map-items/[key]/route.ts` lines 16-17), `src/test/db/fixtures.ts`, the dev seed, the UI.

## Data model / migration
`db/migrations/20261126150000_presence.sql` (latest applied is `20261126140000_members_pixel_look.sql`; the implementer
re-checks `db/migrations` on the ticket branch and takes the next free timestamp if another session added one). One
transaction, no `begin`/`commit`, no `concurrently`, no grant (db/migrations/README.md lines 6-10). Header comment
cites SIM-058, §4, D77-D82 and says the previous image never reads the table.

```
create table presence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  member_id uuid not null,
  seat_id uuid not null,
  work_date date not null,                  -- UTC+7 day, written by the server (D79)
  checked_in_at timestamptz not null,
  source text not null,
  checked_out_at timestamptz null,
  checked_out_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presence_org_id_key unique (org_id, id),
  constraint presence_org_member_date_key unique (org_id, member_id, work_date),
  constraint presence_member_fkey foreign key (org_id, member_id) references members (org_id, id),
  constraint presence_seat_fkey foreign key (org_id, seat_id) references seats (org_id, id) on delete cascade,
  constraint presence_source_check check (source in ('self', 'provider')),
  constraint presence_checked_out_by_check
    check (checked_out_by is null or checked_out_by in ('self', 'provider', 'day_end', 'system')),
  constraint presence_checkout_pair_check check ((checked_out_at is null) = (checked_out_by is null)),
  constraint presence_checkout_order_check check (checked_out_at is null or checked_out_at >= checked_in_at)
);
create index presence_org_seat_date_idx on presence (org_id, seat_id, work_date);
```
- No `room_id` column: the room comes from the seat (no API moves a seat between rooms, seats.ts line 261), so move
  needs no room update and no extra FK.
- Member FK NO ACTION: members are never deleted (no `delete from members` in `src/server`).
- Seat FK `on delete cascade`: `deleteSeat` (seats.ts 394-426) and `deleteRoom` (rooms.ts 251) delete seats; presence is
  display-only (D78) and the audit log keeps the history.
- Index: the unique key serves "the member's row today" and the per-member history; `presence_org_seat_date_idx` serves
  the cascade, the D82 updates by seat and the room read (seats by room → presence by seat and date). Starts with
  `org_id` (schema-check section 2).
- `provider` and `day_end` are allowed now so SIM-063 needs no contract migration; this ticket writes only `self` and
  `system` (`day_end` is never written: end of day is computed on read).
- Downgrade: forward-only. Rollback to the previous image is safe (it ignores the table); while it runs, its
  `releaseSeat` / `deactivateMember` do not end presence, and the read guard below hides such rows. Note this in the
  README bullet.

## API contract
All routes `withAuth(..., { tier: "user" })`, `export const dynamic = "force-dynamic"`, `Cache-Control: no-store`,
camelCase JSON like the existing DTOs (`toRequestDto`, requests.ts 69-77), times ISO 8601 UTC (`ISO` format from
requests.ts line 54).

`MyPresenceDto = { roomId, roomCode, seatId, seatCode, checkedInAt, source: "self" | "provider" }`

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/me/presence` | — | 200 `{ workDate, presence: MyPresenceDto \| null, recent: [{ roomId, roomCode, lastCheckedInAt }] }` (`recent` = latest check-in per room, newest first, at most 100; a caller with no member row gets `presence: null, recent: []`) | 200, 503 | user |
| PUT | `/api/me/presence` | `{ roomId }` (only key) | 200 `{ presence: MyPresenceDto }` for new, reopened and repeated check-in | 400 `invalid_request`; 404 `not_found` (room not in org); 409 `already_checked_in` body `{ error: { code, room: "<room code>" } }`; 422 `no_seat_in_room`, `no_linked_member`, `member_not_assignable`; 503 | user |
| PATCH | `/api/me/presence` | `{ seatId }` (only key) | 200 `{ presence: MyPresenceDto }` | 400 `invalid_request`; 409 `not_checked_in` (checked first); 422 `seat_not_yours` (not the member's seat, other room, or unknown/other-org id), `no_linked_member`; 503 | user |
| DELETE | `/api/me/presence` | — | 200 `{ presence: null }` (also when nothing was active) | 422 `no_linked_member`; 503 | user |
| GET | `/api/rooms/[id]/presence` | — | 200 `{ roomId, workDate, members: [{ memberId, displayName, seatId, seatCode, checkedInAt, source }] }` sorted by `checkedInAt`, then `seatCode` | 404 `not_found` (non-uuid or not in org); 503 | user |

401/403 come only from `withAuth` before the handler. The room read exposes only what the room map already shows a User
(seat occupant `id` and `displayName`, seats.ts 97-104): no email, sub, group, photo URL, `checkedOutBy` or ended rows.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/presence/work-date.test.ts` › 2026-11-26T16:59:59.999Z → 2026-11-26; 17:00:00.000Z → 2026-11-27; month rollover 2026-11-30T17:00Z → 2026-12-01; year rollover 2026-12-31T17:00Z → 2027-01-01; leap day 2028-02-28T17:00Z → 2028-02-29; invalid Date throws | AC5, D79 |
| `src/lib/presence/rules.test.ts` › decideCheckIn: active same room → `same`; active other room → `refuse_other_room` (even when the target room has no seat); no active, no seat → `refuse_no_seat`; closed or stale row today → `reopen`; no row → `insert` | AC1, AC2, AC4 |
| `rules.test.ts` › decideMove: no active → `refuse_not_checked_in` (also with a bad target); target null / not mine / other room → `refuse_not_yours`; same seat → `noop`; else `move` | AC3 |
| `rules.test.ts` › decideCheckOut (none → `noop`, active → `check_out`); isActive: earlier work date ended; checked out ended; seat no longer held ended; today, open, held active | AC2, AC5 |
| `src/lib/validate/presence.test.ts` › valid `{ roomId }` / `{ seatId }`; non-uuid, missing, non-object, array refused; any extra key (e.g. `checkedInAt`) refused | AC1 (client never sends a time) |
| `src/app/api/me/presence/route.test.ts` › 401 without token and service not called; PUT bad JSON / extra key → 400; PUT 200 passes `ctx.sub`, `ctx.scope`; 409 body `{ error: { code: "already_checked_in", room: "C302" } }`; 422 / 404 pass-through; PATCH 409 / 422; DELETE 200 `{ presence: null }`; GET 200; no pool → 503 | AC6, R7 |
| `src/app/api/rooms/[id]/presence/route.test.ts` › non-uuid → 404 without service call; 200 for a `simap:user` token; 404 pass-through; 503 | AC6 |
| `src/server/presence/presence.db.test.ts` › check-in records source self, `checked_in_at` = injected now, `work_date` = workDateUtc7(now); lowest seat by `seq` (seq 99 code `R-99` before seq 100 code `R-100`); no seat → 422, no row, no audit | AC1 |
| `presence.db.test.ts` › same room twice → same row id, one `presence.check_in` audit; other room → 409 with room code, no write; check-out of nothing → 200, no audit; check-out → `checked_out_by = 'self'`, one `presence.check_out` audit | AC2 |
| `presence.db.test.ts` › move to own other seat (seat changed, `presence.move` audit with from/to codes); same seat → no audit; another member's seat, own seat in another room, unknown id → 422 `seat_not_yours`; no active check-in → 409 `not_checked_in` even with a bad seat | AC3 |
| `presence.db.test.ts` › reopen after check-out (same day, other room): one row, new seat/source/time, `checked_out_*` null, two `presence.check_in` audits | AC4, D81 |
| `presence.db.test.ts` › injected now 16:59:59Z check-in, then at 17:00:01Z the room read omits it, GET me shows `presence: null`, and a new check-in creates a second row for the next work date | AC5 |
| `presence.db.test.ts` › D82: `releaseSeat` (reason `seat_released`), `setOccupant` replace (`seat_reassigned`), `setOccupant` unassign (`seat_unassigned`), `deactivateMember` with release (`member_deactivated`), `deleteRoom` force (`room_deleted`, then the row is gone by cascade): row has `checked_out_by = 'system'`, one `presence.system_check_out` audit with the acting sub; releasing another seat of the same member leaves the check-in active; `deleteSeat` of an empty seat with an ended row succeeds | AC5, D82 |
| `presence.db.test.ts` › read guard: a row whose seat occupant was changed by raw SQL (bypassing the hooks) is not listed in the room read and does not count as active for check-in (reopen path) | defence in depth |
| `presence.db.test.ts` › org scope: org B scope cannot check in to an org A room (404) or read it (404); the room read lists only the scope org's rows; two concurrent check-ins of one member (`Promise.all`) → one row, one audit, both 200 | AC6, R6, race |
| `presence.db.test.ts` › GET me: `recent` holds the latest check-in per room, newest first; `workDate` = today | SIM-057 inputs |
| `scripts/schema-check.mjs` › `1 later run applies presence`; `14 duplicate (org, member, work_date) refused (23505 presence_org_member_date_key)`; `14 bad source (23514 presence_source_check)`; `14 bad checked_out_by (23514 presence_checked_out_by_check)`; `14 checked_out_by without checked_out_at (23514 presence_checkout_pair_check)`; `14 checked out before checked in (23514 presence_checkout_order_check)`; `14 cross-org member (23503 presence_member_fkey)`; `14 cross-org seat (23503 presence_seat_fkey)`; `14 seat delete cascades presence` (rolled back) | AC7, migration |

## Approach
1. **Migration** as above; README bullet; schema-check additions (use `tx()`/`refused()` at lines 246-262, seed rows
   `seatA`/`freeSeatA`/`m1..m3` at lines 264-269 and org B from `SEED_ORGS`). Presence is not added to the `counts()`
   list (lines 203-223): the dev seed writes no presence and that check asserts every count > 0.
2. **Pure lib**: `workDateUtc7(now)` = `new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10)` (throws on
   an invalid Date). `rules.ts` decisions take plain values (`active: { roomId, seatId } | null`, `todayRowExists`,
   `lowestSeatId`, `target`), order exactly as in the tests. Validators follow `src/lib/validate/seat.ts`
   (`Validated` from `./room`, `isCanonicalUuid`, unknown keys refused).
3. **One clock**: every server function takes `now: Date = new Date()` (read once per request), passes `$now::timestamptz`
   for `checked_in_at` / `checked_out_at` and `workDateUtc7(now)` as `$today::date`. SQL never computes the work date.
   Check-out and D82 write `checked_out_at = greatest($now, checked_in_at)` so a clock step back can never trip
   `presence_checkout_order_check`. `updated_at = now()` (DB clock) is bookkeeping only.
4. **Active rule in one place** (`sql.ts`): a row is active when `p.work_date = $today and p.checked_out_at is null and
   s.occupant_id = p.member_id` (joined `seats s on s.org_id = p.org_id and s.id = p.seat_id`); the room read also joins
   `members m` (for `display_name`) with `m.status = 'active'`. `isActive` in lib mirrors it for unit tests. Every query
   goes through `orgQuery` with `org_id = $1` and every join repeats `org_id` (R6).
5. **Lock order** (fits rooms.ts 213-221 and manage.ts 355-358; presence rows always last):
   - `checkIn`: member by sub `for no key update` (serialises one member's presence writes and the `apiFetch` re-send,
     waits for `deactivateMember`'s `for update`, does not block the `seats.occupant_id` FK key-share checks); no row
     → 422 `no_linked_member`, not active → 422 `member_not_assignable`. Read today's row with the active rule; decide
     same / other room before seat checks. Room `for share` (missing → 404). Lowest seat `select id, code from seats
     where org_id = $1 and room_id = $2 and occupant_id = $3 order by seq limit 1 for share`. Then insert, or reopen by
     `update … where id = $row` (`seat_id`, `source = 'self'`, `checked_in_at`, `checked_out_at/by = null`). The insert
     keeps `on conflict (org_id, member_id, work_date) do nothing` and re-reads, so a unique violation never surfaces as
     500. Audit `presence.check_in` `{ room, seat, reopened }`.
   - `checkOut`: member lock; `update presence … checked_out_by = 'self' where org_id = $1 and member_id = $2 and
     work_date = $today and checked_out_at is null returning`; audit `presence.check_out` `{ room, seat }` only when a
     row changed. A today row that is open but no longer held (stale) is closed too, without a separate code path.
   - `moveSeat`: member lock; active row (none → 409 `not_checked_in`); target seat looked up unlocked (unknown →
     422 `seat_not_yours`); room of the active row `for share`; old and target seats `for share` in id order; re-check
     old seat still held (else 409 `not_checked_in`) and target `occupant_id = member` and same room (else 422); same
     seat → 200 no write; update `seat_id`; audit `presence.move` `{ room, from, to }`.
6. **D82 helpers** (`end.ts`, `import "server-only"`, take the caller's tx client and `actorSub`, `now` default
   `new Date()`): `update presence set checked_out_at = greatest($now, checked_in_at), checked_out_by = 'system',
   updated_at = now() where org_id = $1 and <seat_id = $2 and member_id = $3 | member_id = $2 | seat_id in (seats of
   room $2)> and work_date = $today and checked_out_at is null returning id, seat_id, member_id`, then one audit
   `presence.system_check_out` per row (`entity: "presence"`, meta `{ reason, memberId, seat }`, actor = the acting
   human's sub, since `audit_log.actor_sub` is `uuid not null`). They only update presence rows, after the caller's
   member/room/seat locks.
   - `writeOccupant` (seats.ts 312): after the seat update, when `seat.occupant_id !== null && seat.occupant_id !==
     memberId`, call `endPresenceForSeat(c, scope, actorSub, seat.id, seat.occupant_id, memberId === null ?
     "seat_unassigned" : "seat_reassigned")`. Covers `setOccupant` and `approveRequest` (the latter only assigns empty
     seats, so it never fires there).
   - `releaseSeat` (seats.ts 505-510): after the update, `endPresenceForSeat(…, seatId, seat.occupant_id,
     "seat_released")` (non-noop path only).
   - `deactivateMember` (manage.ts, after line 422, both the release and the no-seat branch): `endPresenceForMember(…,
     id, "member_deactivated")`. Not added to `impactOf` (D78).
   - `deleteRoom` (rooms.ts, before line 251): `endPresenceForRoom(…, id, "room_deleted")`; the cascade then removes the
     rows.
   - The complete list of `seats.occupant_id` writers (grep `occupant_id =` in `src/server`): seats.ts 326
     (`writeOccupant`), 508 (`releaseSeat`), manage.ts 412 (`deactivateMember`), plus seat deletes at seats.ts 416
     (empty seats only) and rooms.ts 251. All covered.
7. **Routes**: copy the shape of `src/app/api/me/pixel-look/route.ts` and `src/app/api/seats/[id]/release/route.ts`
   (`readJson`, validator, `getPool` → 503, `isCanonicalUuid` → 404 for the room id). The 409 `already_checked_in` is
   returned with `Response.json({ error: { code, room } } satisfies ApiErrorBody, { status: 409, headers: no-store })`.
8. Rules: R1 (routes → server, lib; server files start with `import "server-only"`; `pnpm check:layers`), R2 (new
   file only), R3 (no config), R6 (orgQuery everywhere), R7 (no 401/403 in handlers or services), R5 (tests above).
   Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; locally
   `pnpm schema:check` and `pnpm test:db`.

## Specialist input used
- database-optimizer: adopted the table shape, composite FKs, named checks incl. pair and order checks, member FK NO
  ACTION, no denormalised `room_id`, `provider` kept in the checks, `order by seq` for "lowest seat code", D82 helper
  design and call sites (`writeOccupant` gated on replace/unassign, `releaseSeat`, `deactivateMember` in both branches),
  actor = acting human's sub, presence locks last, schema-check cases, not adding presence to `counts()`.
  - **Seat FK**: adopted its preferred `on delete cascade` (restrict would turn `deleteSeat` of an empty seat with an
    ended row into a 23503/500).
  - **Index**: one plain `(org_id, seat_id, work_date)` instead of a partial one, because the cascade and the D82
    updates by seat need the plain prefix too; no EXPLAIN test (tiny table, brittle plans).
  - **Work date**: rejected "compute in SQL". Reason: the TS helper is then the only implementation, the boundary is
    unit-tested on the exact production code, DB tests inject `now` for the midnight case, and `checked_in_at` and
    `work_date` still come from one clock read (its own condition: "do not mix `now()` and app clock").
  - **Member lock**: used `for no key update` instead of its `for share`, because two `for share` lockers do not
    serialise each other.
  - **Read guard**: it advised against `s.occupant_id = p.member_id`; overruled (see api-platform-engineer).
  - Added `deleteRoom` (forced delete removes occupied seats), which it did not list.
- api-platform-engineer: adopted `/api/me/presence` GET/PUT/PATCH/DELETE plus `GET /api/rooms/[id]/presence`, 200 for
  every successful check-in, check order for move (409 before 422), additive error field, no ETag (house style
  `no-store`), minimal privacy-safe room read, `src/server/presence/` structure, own-state GET in SIM-058.
  - **Casing**: camelCase, not snake_case (the existing DTOs are camelCase, requests.ts 69-77).
  - **409 field**: `room` with the room code, not `room_id`; the check-in client works with room codes
    (`src/lib/checkin-room.ts`, `CheckinPage.tsx` 54-61).
  - **Unknown seat on move**: 422 `seat_not_yours` instead of 404 (the AC names only 409/422 for move, and it avoids
    an existence oracle).
  - **Audit names**: adopted `presence.check_in`, `presence.check_out`, `presence.move`, `presence.system_check_out`
    (repo convention `entity.snake_case`, e.g. `device.transfer_start`; a separate system action keeps the human actor
    from being read as having checked the member out, and lets the audit filter pick it out).
  - **Read guard**: adopted the join on `seats.occupant_id = presence.member_id` as belt and braces (covers a rollback
    to the previous image and any future occupant writer). The DB tests assert the hooks on the table directly, so the
    guard cannot hide a missing hook (the database-optimizer's concern).
  - Not changing `apiError` in `respond.ts` (a High path); the route builds the 409 body like the map-items routes.

## Assumptions
- **Who owns what (SIM-057/059/060).** SIM-058 owns `GET /api/me/presence`: `CheckinPage.tsx` line 54 and
  `checkin-room.ts` line 2 expect SIM-058 to supply `activeCheckinRoom` and `recentCheckins` (`recent` here), and the
  writes need the client to know its own state on load. PRE-02's "how many members are checked in there now" is not a
  new endpoint here: SIM-059 can call `GET /api/rooms/[id]/presence` for each of the member's seat rooms (usually 1-3)
  or add a count read itself; its ticket allows "a small read addition if the plan finds one is missing". PRE-02's "last
  check-in to that room" is `recent`. "No check-in today" for the popup = `presence === null` and no `recent` entry
  whose `lastCheckedInAt` falls on `workDate` (via `workDateUtc7`). Wiring `CheckinPage` to this API is SIM-059/060,
  not here.
- "Lowest seat code" (D77) = lowest `seq` in the room. Codes are `<room>-<seq>` padded to 2 digits
  (`src/lib/rooms/seat-code.ts` line 8), so text order breaks at seq 100 (`R-100` < `R-99`); `seq` order equals the
  intended code order.
- `deactivateMember` ends an active presence even when the member holds no seat (harmless, always correct).
- `deleteRoom` force also ends presence with an audit (reason `room_deleted`), a D82 case beyond "released,
  reassigned"; it is two lines in `rooms.ts`, a file not named in the ticket's technical notes.
- D82 helpers end only today's open rows; an open row from an earlier work date is already ended on read and keeps its
  history unchanged.
- A cascade on seat delete also removes old presence rows of that seat (they drop out of `recent`); acceptable because
  presence is display-only (D78) and retention is still open (OQ-70).
- `PUT` on another room while checked in there returns 409 even if the target room has no seat for the member (the "one
  active check-in" refusal comes first).
- Next free migration timestamp checked on `main` today: `20261126150000`. No other ticket is `IN_PROGRESS`, `REVIEW`
  or `DONE` on the board, so no rebase hotspot. `seats.ts`, `manage.ts` and `rooms.ts` are shared files; any ticket that
  starts after this one in parallel should expect a rebase.
- Size: about 650 lines of production code plus about 700 lines of tests and checks, above the ~400-line guide (see
  Split proposal).

## Blocking questions
None.

## Split proposal
None proposed. The ticket is already at the top of M (ticket, "Risks"). The D82 hooks are about 40 lines in four call
sites, and splitting the routes from the server code would leave SIM-059/060 with nothing usable. Fallback if the
implementer passes ~900 production lines or the first review asks for it: slice A = migration, lib, server, routes and
the read guard (AC1-4, AC6, AC7); slice B (SIM-058.1) = the D82 hooks in `seats.ts`, `manage.ts`, `rooms.ts` and their
DB tests (AC5 second half). Until slice B ships, the read guard already hides check-ins on a lost seat, but they are
not audited.
