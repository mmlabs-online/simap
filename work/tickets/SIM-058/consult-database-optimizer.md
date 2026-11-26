## Findings

**Spec/ticket.** Spec §4 (line 139) defines the Presence row as: org, member, seat, work date, checked-in at, source (`self`/`provider`), checked-out at (nullable), checked-out by (`self`/`provider`/`day_end`/`system`, nullable). Unique key is (org, member, work date). Active means today's work date and not checked out. A row from an earlier work date counts as ended when read.
- The ticket says only `self` and `system` are written in SIM-058. `provider` is for SIM-063. `day_end` is allowed by the spec but is never written, because end of day is computed on read.

**Migration conventions** (`db/migrations/README.md`, `20261125200000_map_items.sql`):
- File name is `YYYYMMDDHHMMSS_snake_case.sql`. It must sort after `20261126140000_members_pixel_look.sql`, so use `20261126150000_presence.sql` or later.
- No begin/commit, no `create index concurrently`, no grants.
- Every table has `org_id uuid not null`. Every unique key and foreign key includes `org_id`. Every FK is `foreign key (org_id, x) references t (org_id, id)`. Both `members` and `seats` already have `unique (org_id, id)`.
- Every non-PK index starts with `org_id`. Constraint and index names are explicit, in the form `<table>_<cols>_key|_fkey|_check|_idx`.
- `pnpm schema:check` verifies the org rules from the catalogue.
- Enums are `text` plus a named check.
- Add a "Presence (SIM-058)" paragraph to the README schema list.

**Seat and member code (lock order: member, room, seat, devices/requests).**
- `src/server/seats/seats.ts`:
  - `releaseSeat` (~l.486) locks the seat `for share` on the room and `for update` on the seat via `lockSeat`. It reads the actor's member row unlocked, then sets `occupant_id = null`.
  - `setOccupant` (~l.428) locks the member row `for share`, then the room, then the seat. It calls `writeOccupant`. The replace case is where a seat is reassigned.
  - `writeOccupant` (l.312) is the shared SEA-03 write step. It is also called from `src/server/requests/requests.ts:201` (approveRequest).
  - `deleteSeat` and `deleteRoom` (rooms.ts:225, which uses `force`) delete seats. `deleteSeat` refuses when the seat is occupied. `deleteRoom` with `force` deletes seats, and an occupied seat can be deleted there.
- `src/server/members/manage.ts`:
  - `deactivateMember` (l.359) locks the member `for update`, then the rooms `for share`, then the seats `for update` in id order. This lock set covers the member's occupied seats.
  - On the release path it sets `occupant_id = null` for all the member's seats. The "keep seats" path (`release=false`) is allowed only when impact is empty (`member_not_empty` otherwise).
  - Deactivation is refused for a member with seats unless `release` is set.
- `writeAudit` (`src/server/audit/write.ts`) must be called inside the tx. `audit_log` is append-only.
- `inTx` in seats.ts maps `Abort` to a refusal. Its `Refusal` code union has no presence codes, so presence needs its own `inTx`/`Refusal` (as manage.ts does) rather than widening the seats one.

## Recommendations

**1. Schema** (`db/migrations/<ts>_presence.sql`, High path, expand-only: a new table only, so the previous image is unaffected):
```
create table presence (
  org_id uuid not null,
  id uuid not null default gen_random_uuid(),
  member_id uuid not null,
  seat_id uuid null,            -- see Open question 1
  work_date date not null,
  checked_in_at timestamptz not null default now(),
  source text not null,
  checked_out_at timestamptz null,
  checked_out_by text null,
  created_at, updated_at timestamptz not null default now(),
  constraint presence_pkey primary key (id),
  constraint presence_org_id_key unique (org_id, id),
  constraint presence_org_member_day_key unique (org_id, member_id, work_date),
  constraint presence_member_fkey foreign key (org_id, member_id) references members (org_id, id),
  constraint presence_seat_fkey foreign key (org_id, seat_id) references seats (org_id, id),
  constraint presence_source_check check (source in ('self','provider')),
  constraint presence_out_by_check check (checked_out_by in ('self','provider','day_end','system')),
  constraint presence_out_pair_check check ((checked_out_at is null) = (checked_out_by is null))
);
create index presence_org_seat_idx on presence (org_id, seat_id);          -- FK index, room read
create index presence_org_day_idx  on presence (org_id, work_date) where checked_out_at is null;  -- room read
```
- The `(org_id, member_id, work_date)` unique key already indexes the member lookup.
- The room read joins presence to `seats` (room_id) for the day and filters `checked_out_at is null`. `presence_org_day_idx` is a partial index on active rows.
- Delete rules, as `seats_occupant_fkey` does with NO ACTION: seats are deleted by `deleteSeat` and `deleteRoom`. Both must be checked (see the reopen/deletion risk below).
- Do not add a "room_id" column. Derive the room from the seat, because D82 guarantees the check-in ends when the seat is lost.
- Presence is display only (D78): do not touch `audit`, exports or the dashboard.

**2. Unique row and reopen.**
- Check-in is an upsert in a single statement:
  ```
  insert into presence (org_id, member_id, seat_id, work_date, checked_in_at, source)
  values (...) on conflict (org_id, member_id, work_date)
  do update set seat_id = excluded.seat_id, source = excluded.source, checked_in_at = now(),
                checked_out_at = null, checked_out_by = null, updated_at = now()
  where presence.checked_out_at is not null
  returning ...
  ```
  The `where` makes a reopen happen only when the row is closed. An already-active row returns no row, so re-select it (idempotent 200, nothing written).
- Work date comes from a pure `src/lib` helper: `(now + 7h)` as a UTC date. It takes `Date` as an argument so the 16:59:59.999Z / 17:00:00Z boundary is testable. The server computes it with the same expression in SQL, or the helper passes the instant into SQL, so the date and `checked_in_at` agree.
- Prefer a single instant: use one `now` for both `checked_in_at` and the work date.
- "Active" read predicate (shared by all code): `work_date = today and checked_out_at is null`. Put it in one helper/SQL fragment and reuse it everywhere.
- Audit actions to write: `presence.check_in`, `presence.check_out`, `presence.move`, `presence.system_check_out`. Entity is `presence`. Record the reopen in `meta` (e.g. `reopened: true`, seat code, room code). The audit log keeps the earlier check-in (D81).

**3. Concurrency (double check-in races).**
- The unique key plus `on conflict` already makes two parallel check-ins safe: one inserts, the other conflicts and sees the active row, so it is idempotent.
- Lock order for check-in: member row `for share` (check the member is active, as `setOccupant` does), then room `for share`, then the member's seats in the room `order by code`. Lock the chosen seat row `for share` so a concurrent release or reassign (which takes it `for update`) waits and then re-checks. Without this lock, a check-in could land on a seat that has just been released.
- Re-read the seats under the lock: the lowest seat code is `order by s.code, s.id` where `occupant_id = member`. That matches manage.ts's seat ordering.
- Move seat uses the same order. Read the active row `for update` after the member lock, then lock the target seat and the room. The row lock serialises check-out vs. move vs. check-in for the same member.
- To keep `already_checked_in` (409) race-free: lock the member's presence row first (`select ... for update`, only today's date), then decide. When no row exists, the insert's unique conflict resolves a parallel insert.
- Check-out is `update ... where checked_out_at is null and work_date = today returning`. Zero rows means 200 with no change.
- Auth refusals (R7) must come only from the auth wrapper before any write. Domain refusals are 409/422 and happen inside the tx before any write. Codes: `no_seat_in_room` 422, `seat_not_yours` 422, `already_checked_in` 409 (name the current room), `not_checked_in` 409.

**4. D82 system check-out inside existing transactions.**
- Add one helper (e.g. `endPresenceForSeats` in `src/server/presence/`, server-only, taking the tx client) that runs
  ```
  update presence set checked_out_at = now(), checked_out_by = 'system', updated_at = now()
  where org_id = $1 and seat_id = any($2) and work_date = $3 and checked_out_at is null
  returning id, member_id, seat_id
  ```
  and writes one `presence.system_check_out` audit row per returned row. Use `actorSub` of the acting user (audit `actor_sub` is `uuid not null`, so there is no "system" actor sub).
- Call it from every place that removes the occupant:
  - `releaseSeat`: after the seat update, only in the non-noop branch.
  - `writeOccupant`, the one place for `seat.replace` and `seat.unassign`. A replace changes the occupant. Gate on `seat.occupant_id !== memberId`. This also covers `approveRequest`, which calls `writeOccupant`. `writeOccupant` is exported and its signature is shared. Add the call inside it rather than at each caller.
  - `deactivateMember`: end the member's active row regardless of the `release` flag (a deactivated member must not stay checked in). Do this on the "release" path with a seat-based update, and also by member id (`member_id = $2`), since a member with no seats is still `noop` or deactivates directly.
  - `deleteRoom` with `force` and `deleteSeat`: the FK from `presence.seat_id` is NO ACTION by default, so a delete would fail with `23503` if an active or historical row points at the seat. See Open question 1.
- The helper takes locks in the existing order. The seat is already locked `for update` in these transactions, so the presence update does not add a new lock-order edge. The presence row is the last lock (after member, room, seat).
- A member's checked-in seat only changes in these paths. The moves done by the same member (SIM-058 move seat) are not D82.
- Do not update the previous image's behaviour: the old image never reads or writes `presence`, so the expand-then-contract rule holds. Rolling back the image leaves D82 hooks absent. That means stale active rows could survive until end of day; acceptable and worth one line in the README.

**5. Read endpoint** (`GET` room presence, any member role): join `presence p` to `seats s` and `members m` on `org_id` and ids, `s.room_id = $2`, `p.work_date = today`, `p.checked_out_at is null`. Apply a result limit (the codebase uses limits, e.g. `SEAT_LIMITS`). Return member id, display name, photo flags, seat id/code, `checkedInAt`, `source`. Order by `checked_in_at, id`. Do not expose `provider` internals. Ended-on-read happens through the date predicate.

**6. Tests.**
- Unit: work-date boundary at 16:59:59.999Z and 17:00:00Z, ended-on-read, lowest seat code selection (`A10` vs `A2`, see seat-code ordering below), idempotency, error codes.
- DB (`pnpm test:db`): unique row per day, reopen keeps the one row, move, system check-out on release / reassign / approve / deactivate, org scope (another org's member and room refuse), parallel check-in race (two clients, one row).

## Risks

- **Lowest seat code.** "Lowest seat code" is ambiguous with `order by code` text sort (`R1-10` sorts before `R1-2`). Seats have `seq` (unique per room) and `members` refs sort by `s.code`. D77 and the ticket say code. Pick one ordering and test it. `seq` gives numeric order and `(room_id, seq)` is unique. Check `src/lib/rooms/seat-code.ts` for the format before deciding.
- **`deleteRoom` with `force` and `deleteSeat`.** `deleteRoom` force-deletes occupied seats and `deleteSeat` can delete a seat that has historical presence rows from earlier days. A plain FK blocks both with `23503`; `seatConflict` maps pg errors in `src/server/seats/pg-error.ts` and would not recognise it.
- **Deadlocks.** Check-in must follow member, room, seat, presence. A presence row lock taken before the seat lock would invert the order used by `deactivateMember`, which locks the member row and then rooms/seats.
- **Transaction rollback.** D82 helper writes must be inside the existing tx so an abort rolls them back. Do not run them after `withTx`.
- **Late 401/403.** The route must not return any 401/403 after the tx starts (R7). Re-send on 401/403 by `apiFetch` makes check-in idempotence mandatory.
- **Deactivated/non-linked members.** The member row must be active and linked (`sub`) for check-in. A deactivated member's active row is ended by D82. A check-in by a deactivated member must be refused; there is no existing refusal code for this in the presence Refusal union.
- **Retention (OQ-70).** Rows accumulate (one per member per day), with no cleanup. The unique key index and `presence_org_day_idx` stay small. Fine for now.
- **Size.** The ticket is at the top of M, touching two High-path transaction files (`seats.ts`, `manage.ts`) plus `requests.ts` indirectly via `writeOccupant`.

## Open questions

1. **Seat reference on delete.** Should `presence.seat_id` be `on delete cascade`, `on delete set null` (nullable, as above), or a plain restrict? R2's expand-only rule and "history stays in audit_log" suggest nullable plus `set null` for ended rows. Active rows are ended before the seat disappears, so the deletion paths need the D82 helper too (force delete of an occupied seat in `deleteRoom`). Ming or the planner should confirm.
2. **Lowest seat code:** text order of `seats.code` or numeric `seq`? (See Risks.)
3. **Actor for system check-out in the audit log:** `actor_sub` is the acting admin/user (no system uuid exists). Confirm the audit meta should carry `by: "system"` and the reason (`released`, `reassigned`, `deactivated`, `seat_deleted`).
4. **Move seat audit identity.** Is `presence.move` recorded with `fromSeatId` and `toSeatId` in meta? Assumed yes.
5. **Seat request approval (`approveRequest`).** Confirm that D82 applies when approval reassigns a seat that another member was checked in on. `writeOccupant` is the single hook; the replace is only through `setOccupant`, but the helper is cheap.
6. **Seat `cannot_seat` or a seat becoming "cannot seat" while checked in.** The spec does not say; recommend no D82 action (the member keeps the seat).
7. **Provider source:** is the `provider` value to be accepted by the check constraint now (recommended, to avoid a contract migration in SIM-063)?
