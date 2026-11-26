# Consult — database-optimizer — SIM-058

SIM-058 consult (database). Read-only; nothing changed.

## Findings

1. Migration conventions (db/migrations/README.md, init.sql). Each table has `org_id uuid not null`, a uuid `id` PK and `unique (org_id, id)`. Every FK is composite `(org_id, x)` and every unique key or index starts with `org_id`. Constraints are named `<table>_<cols>_key|_fkey|_check|_idx`. Enums are `text` plus a named check. The file runs in one transaction, with no begin/commit, no CONCURRENTLY and no grant. `schema:check` section 2 asserts org_id, composite FKs and org-first unique indexes from the catalogue for ALL tables, so the new table is covered for free.
2. `seats.occupant_id` is a single column, so there is no member to seat join table. Seat release, replace, assign and deactivate release are the only places an occupant stops being the occupant. The write points are:
   - `releaseSeat` (seats.ts ~486)
   - `setOccupant`, via `writeOccupant` (seats.ts 312): `seat.replace` and `seat.unassign` change an occupant away; `seat.assign` onto an empty seat does not.
   - `approveRequest`, via `writeOccupant` with `seat.assign` onto an empty seat only (decideApprove refuses a taken seat). It never removes an occupant.
   - `deactivateMember` with `release` (manage.ts 399-422).
   - `deleteSeat` requires an empty seat (409 `seat_not_empty`), so no D82 hook is needed there.
   - Without `release`, `deactivateMember` is refused (`member_not_empty`) when the member has seats. A member with no seats can still be checked in only if they lost seats earlier, and D82 already ended that.
3. Lock order is already fixed. For seats it is member `for share`, room, then seat `for update`. For `deactivateMember` it is member, rooms `for share` (id order), seats `for update` (id order). The presence code must fit into this order. It must not lock a presence row before a seat or member row, or it can deadlock with `releaseSeat` and `deactivateMember`.
4. The audit table has `actor_sub uuid not null`, so the `system` actor is a problem. D82 system check-out inside `releaseSeat` and `deactivateMember` still has the acting human's `actorSub`. Audit that sub and put `by: "system"` and the reason in `meta`. Do not invent a null actor.
5. Spec §4 allows `checked_out_by` in (`self`, `provider`, `day_end`, `system`). The ticket lists only self and system. `day_end` is never written, because the end of day is computed on read.

## Recommendations

**Table `presence`** (name is a plan choice; `member_presence` is fine):
```
id uuid pk default gen_random_uuid(),
org_id uuid not null,
member_id uuid not null,
seat_id uuid not null,
room_id uuid not null,            -- denormalised, see below
work_date date not null,
checked_in_at timestamptz not null default now(),
source text not null,
checked_out_at timestamptz null,
checked_out_by text null,
created_at, updated_at timestamptz not null default now()
constraint presence_org_id_key unique (org_id, id)
constraint presence_org_member_date_key unique (org_id, member_id, work_date)
constraint presence_member_fkey foreign key (org_id, member_id) references members (org_id, id)   -- no action
constraint presence_seat_fkey foreign key (org_id, seat_id) references seats (org_id, id)
constraint presence_source_check check (source in ('self','provider'))
constraint presence_checked_out_by_check check (checked_out_by is null or checked_out_by in ('self','provider','day_end','system'))
constraint presence_checkout_pair_check check ((checked_out_at is null) = (checked_out_by is null))
constraint presence_checkout_order_check check (checked_out_at is null or checked_out_at >= checked_in_at)
```
- `seat_id` FK is `on delete restrict` (no action is also fine). `deleteSeat` only works on an unoccupied seat. An unoccupied seat's presence is ended by D82, but the ended row still references it, so `deleteSeat` would fail with an FK error.
  - **Choose one of two options.** Preferred: `on delete cascade` on the seat FK (presence is display-only, D78). The audit log keeps the history, and this avoids a new `deleteSeat` refusal. If instead you keep restrict, `deleteSeat` must delete or null those rows first. A nullable `seat_id` with `on delete set null` also works but makes the room read join harder.
- `room_id`: skip denormalising unless the polling read needs it. Seats already carry `room_id`, so a join `presence p join seats s on (org_id,id)` is cheap. A denormalised `room_id` would need its own composite FK `(org_id, room_id)`, and the seat could change rooms only via delete, so it is safe. Prefer the join and add nothing. Move seat then needs no room update.
- Member FK: leave NO ACTION. Members are deactivated, never deleted (check `members` delete paths).
- The work date is not stored with a generated expression. It is a plain `date` column written by the server.

**Indexes.**
- The unique `(org_id, member_id, work_date)` serves the per-member lookup ("today's row"), so add no separate index for that.
- Room presence read: filter on `org_id`, `work_date = today`, `checked_out_at is null`, joined to seats by room. A partial index is the cheap choice: `create index presence_org_seat_active_idx on presence (org_id, seat_id) where checked_out_at is null`. The read is `seats where room_id=$2` (existing seats index on room) joined to this index, plus `work_date = $today` as a filter. Alternatively `(org_id, work_date, seat_id)`. The table is small (one row per member per day), so do not over-index; the unique key `(org_id, member_id, work_date)` is enough for a first version. Plan: one partial index `(org_id, work_date, seat_id) where checked_out_at is null`, and run EXPLAIN in the DB test on realistic seed data.
- The seat FK needs its own index for cascade and delete checks (the partial index above covers only active rows). Add `(org_id, seat_id)` plain if you use cascade. For retention (OQ-70) later, `(org_id, work_date)` can be added then.

**Work date in SQL or app.**
- Compute it in ONE place. Recommended: in SQL in the write statement, `(now() at time zone 'Asia/Ho_Chi_Minh')::date`. This needs no tzdata assumptions in Node, uses the same `now()` as `checked_in_at` (one transaction clock), and avoids a client/server clock skew race at midnight. The app also needs "today" for read decisions: compute it in SQL in the same query (`work_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date` as `ended`). A fixed `interval '7 hours'` (no DST in Vietnam) is equivalent and avoids a tzdata dependency: `(now() at time zone 'UTC' + interval '7 hours')::date`.
- A `src/lib` pure helper `workDateUtc7(date: Date): string` is still wanted for the unit test of the boundary (23:59:59.999 UTC+7 vs 00:00:00) and for the UI; but keep it consistent with SQL, and have a DB test compare both around midnight with an injected time (use `set_config`/`timestamptz` params rather than `now()` for testability: e.g. pass `$now` from the service so tests can control it). If you take `$now` from the app, take it from one place (the service) and use it for both checked_in_at and work_date. Do not mix `now()` and app clock.

**Reopen (D81) under concurrency.** The unique key makes check-in a natural single upsert. Recommended: lock first, then decide in app code.
1. In the transaction: `select id from members where org_id=$1 and sub=$2 for share` (same first lock as `setOccupant`) to get the member and check `status = 'active'`. Locking the member row serializes the same member's concurrent check-ins and also blocks a concurrent deactivation (`lockMember` takes it `for update`).
2. Lock seats: `select ... from seats where occupant_id=$member and room_id=$room order by code limit 1 for share` (for share so releases block; release takes `for update` on the seat). Use `order by code` carefully: `seats.code` is text, so seat codes like `A-10` sort before `A-2`. D77 says "lowest seat code"; use `order by seq` if the code is `<room>-<seq>` with the same room prefix (all seats in one room share the room code, so `seq` order equals numeric order). Confirm with Ming whether "lowest" means numeric (`seq`) or text; a plan note is enough.
3. Then `insert into presence (...) values (...) on conflict (org_id, member_id, work_date) do update set seat_id = excluded.seat_id, source = excluded.source, checked_in_at = excluded.checked_in_at, checked_out_at = null, checked_out_by = null, updated_at = now() where presence.checked_out_at is not null returning *`. The `where` makes it a no-op for an active row (returns no row), and you then `select` the existing row. Idempotent "same room" check and 409 `already_checked_in` need to read the existing row first (`select ... for update` on the presence row after member and seat locks). Simpler and correct under the member lock: select the row `for update`; if none, insert; if checked out or ended-by-date (can't be, same date) update; else decide same room (200 no write) or 409. With the member row locked there is no race, so the upsert is only a safety net; keep `on conflict` anyway so a unique violation never surfaces as 500.
4. Never rely on `on conflict do update` alone to decide idempotence: it writes a row version even when nothing changed.

**D82 system check-out hooks.** Add one helper in `src/server/presence/` (say `endPresenceForSeat(c, scope, actorSub, seatId|memberId, reason)`) that runs `update presence set checked_out_at = now(), checked_out_by = 'system', updated_at = now() where org_id=$1 and seat_id=$2 and member_id=$3 and checked_out_at is null returning id, member_id` and writes one audit row per ended row (`action: presence.checkout`, `meta: { by: 'system', reason: 'seat_released' | 'seat_reassigned' | 'member_deactivated', seatCode }`). It takes no extra locks beyond the row it updates, so it fits after the seat lock.
- `releaseSeat`: call after the `update seats set occupant_id = null`, with the previous occupant (`seat.occupant_id`). Only when the decision is not noop.
- `writeOccupant`: add the call there so that `setOccupant` and `approveRequest` both get it, but gate it on `seat.occupant_id !== null && seat.occupant_id !== memberId` (a replace or unassign). One place covers both callers and any future caller.
- `deactivateMember`: end every active presence of the member (`where member_id=$2`), not just ones at released seats, in both branches (`release` true and the case where the member holds no seats). Do it before the `update members set status` line or after, within the same tx; it is independent. Also covers a member with a seat that stays assigned (`release=false` is refused with seats, so this covers a member who has no seat but a stale active row; harmless).
- Also consider a presence row on a seat whose occupant lost the seat via a path I did not find: none of the grep hits write `occupant_id` outside these places. Add a DB test to guard this.
- Reads must apply "ended" by the same rule in all queries: `active = checked_out_at is null and work_date = today_utc7`. Put it in one SQL fragment/constant to avoid drift.
- The room read must also require `s.occupant_id = p.member_id` as defence in depth? Not needed if D82 is complete, and hiding data on a mismatch would mask a bug. Instead add a DB test.

**Move seat.** Lock order: member, then target seat `for share` via `lockSeatIn`-style (room for share, seat for update is used elsewhere; here `for share` on the target seat is enough to block release, since release takes `for update` on the seat). Check `occupant_id = member` and `room_id` matches the row's room (join seats of the old seat id). Update `seat_id` in place. Audit `presence.move` with from and to seat codes.

**Check constraint on source in the check-in path.** Only `self` is written in this ticket. Keep `provider` in the check constraint now (SIM-063 later) so it needs no migration, which fits expand-then-contract.

**schema-check.mjs.**
- Add `presence` to the `counts()` table list (line ~207-220); since seed:dev will not seed presence unless you add it, either leave it out of that list (the list asserts `> 0` after seed, line 239) or add a presence row to the dev seed. Prefer adding a presence row to the dev seed, so the idempotency check still works; otherwise do not add it to `counts`.
- Add constraint cases using the existing `tx()` helper (lines 246-262): duplicate (org, member, work_date) gives 23505 `presence_org_member_date_key`; bad `source` gives 23514 `presence_source_check`; `checked_out_by` without `checked_out_at` gives 23514 `presence_checkout_pair_check`; cross-org member or seat gives 23503 `presence_member_fkey` / `presence_seat_fkey`; seat delete behaviour per your FK choice. Add a "later run applies presence" migration check next to lines 170-176.
- `db/README`: add a "Presence (SIM-058, D77-D82)" bullet like the others.
- The new DB tests (`pnpm test:db`): reopen, move, D82 on release, replace, unassign, request approval, and deactivate, org scope, midnight boundary with an injected `now`, and two concurrent check-ins for the same member (one row, one 200 and 200 or 200 and 409).

## Risks
- Deadlock: any presence lock taken before member/room/seat locks, or the D82 helper locking rows in a different order than `deactivateMember` (member, rooms id order, seats id order). Keep presence updates last.
- `deleteSeat` after D82 with a restrict FK would produce a 23503 mapped to 500 unless handled; choose cascade or clean up first (see Recommendations).
- Midnight race: checking `work_date` in app and writing with another clock. Use one source.
- `seats.code` text ordering for "lowest seat code" (e.g. `R1-10` vs `R1-2`): use `seq`.
- Rollback to the previous image is safe (new table only, old code ignores it), but the old image's `releaseSeat` and `deactivateMember` will not end presence, leaving a stale active row with a vanished seat occupant until the day ends. Acceptable, since reads end it at the date boundary; mention it in the README rollback note.
- `audit_log.actor_sub` is `uuid not null`: for system check-outs use the acting admin's sub (not a fake sub).
- Presence is display-only (D78): keep the table out of the dashboard, exports and reports queries (including the `deactivateMember` impact numbers).
- R7: all domain refusals (`no_seat_in_room`, `already_checked_in`, `not_checked_in`, `seat_not_yours`) come after auth wrapper, 409/422 only. A "member has no linked member record" case should be a domain 422 or the existing org/member guard, not 401/403 from inside the handler.
- Polling load: the room read every 30-60 s per client; one indexed query per call, no N+1 (return members with names in one join).

## Open questions
1. FK for `presence.seat_id` on seat delete: cascade (my recommendation) or restrict plus cleanup in `deleteSeat`?
2. "Lowest seat code" (D77): numeric order by `seq`, or text order by `code`? Confirm `seq`.
3. Work date in SQL (`now()` at UTC+7) versus app-supplied: confirm SQL as the single source; the `src/lib` helper then serves tests and UI only.
4. Should `deactivateMember` without `release` for a member who holds no seat still end an active presence? Recommended yes.
5. Audit action names: `presence.checkin`, `presence.checkout`, `presence.move`, with system check-out as `presence.checkout` plus `meta.by = 'system'` and `meta.reason`, or a separate `presence.system_checkout`. Ticket says "audit entries for check-in, check-out, move and system check-out"; either works, pick one for the plan.
6. A room-view read endpoint: does it also need the viewer's own state (active room, seats) in the same call to save a round trip? Not a DB concern, but it affects the index choice.

Key files: `src/server/seats/seats.ts` (releaseSeat 486, writeOccupant 312, lockSeatIn 278), `src/server/members/manage.ts` (deactivateMember 359), `src/server/requests/requests.ts` (approveRequest 160, via writeOccupant), `scripts/schema-check.mjs` (catalogue checks 180-200, counts 203-221, tx helper 246), `db/migrations/README.md`, `docs/spec-v1.md` (§4 line 139, PRE-03/05 720-756).
