## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 924 files, no violations".
- `pnpm test` — exit 0; "Test Files 352 passed | 1 skipped (353)", "Tests 3465 passed | 9 skipped (3474)".
- `pnpm build` — exit 0; routes `/api/me/presence` and `/api/rooms/[id]/presence` built.
- `pnpm test:db` (local docker Postgres) — exit 0; "Test Files 23 passed (23)", "Tests 365 passed (365)" (23 = every
  `*.db.test.ts`, including `src/server/presence/presence.db.test.ts`).
- `pnpm migrate:smoke` — "migrate smoke ok". `pnpm migrate` — "applied 20261126150000_presence (18 ms)".
- `pnpm schema:check` — "schema check ok"; "pass: 1 later run applies presence" and all ten "pass: 14 ..." lines
  (duplicate key 23505, source / checked_out_by / pair / order checks 23514, cross-org member and seat 23503, cascade).
- Results match impl-log.md.

### Acceptance criteria
- [x] AC1 Check-in by room, 422 `no_seat_in_room`, lowest seat (D77), source `self`, server time, UTC+7 work date, no
  client time — evidence: presence.db.test.ts "records self, server time and today's work date on the lowest seat by
  seq" (seq 99 before seq 100), "no seat in the room -> 422 no_seat_in_room, no row, no audit; unknown room -> 404";
  validate/presence.test.ts "a time or any extra key is refused"; route.test.ts "PUT bad JSON, a missing roomId or an
  extra key -> 400"; `checkIn` passes `now` and `workDateUtc7(now)` (presence.ts), SQL never computes the date.
- [x] AC2 Idempotent same room, 409 `already_checked_in` naming the room, check-out of nothing 200 — evidence:
  "same room twice -> same row, one audit; other room -> 409 with the room code" (`room: "R1"`), "check-out of nothing
  -> 200 with no audit; check-out ends the row by self"; route test "PUT 409 already_checked_in carries the room code";
  rules.test.ts decideCheckIn / decideCheckOut.
- [x] AC3 Move seat: 422 `seat_not_yours` (other member's seat, other room, unknown id), 409 `not_checked_in` first,
  same seat no write, audited — evidence: "moves to the member's other seat; the same seat writes nothing" (audit meta
  `{ room, from, to }`), "another member's seat, a seat in another room and an unknown id -> 422 seat_not_yours", "no
  active check-in -> 409 not_checked_in, even with a bad seat"; rules.test.ts decideMove.
- [x] AC4 Same-day reopen (D81) — evidence: "reopen after check-out the same day keeps one row and two check-in audits"
  (new seat, new time, checked_out_* null).
- [x] AC5 Earlier work date ended on read; D82 release / reassign / unassign / deactivate (and forced room delete) end
  the check-in by `system`, audited, same tx — evidence: work-date.test.ts boundary cases; "a check-in before 17:00Z
  ends at 17:00Z ..."; D82 block: "releaseSeat", "setOccupant replace and unassign", "deactivateMember with release",
  "deleteRoom force ends the check-in, then the row is gone by cascade", "releasing another seat of the member leaves
  the check-in active", "deleting an empty seat that has an ended row succeeds". Hooks are inside the existing
  transactions: seats.ts:330-339 (`writeOccupant`), seats.ts:522 (`releaseSeat`), manage.ts:424 (`deactivateMember`,
  both branches), rooms.ts:252 (`deleteRoom`).
- [x] AC6 R6 org scope, R7, 409/422, room read for any member — evidence: "org scope: another org gets 404 on check-in
  and read; the read lists only own org rows"; rooms/[id]/presence route.test.ts "200 for a simap:user token, scoped by
  the token org", "a non-uuid id is 404 without a service call"; me/presence route.test.ts "401 without a token and the
  service is not called". Grep: every SQL in `src/server/presence/*.ts` goes through `orgQuery`, every join repeats
  `org_id`; no `401`/`403`/`unauthenticated`/`forbidden` in the new routes or server files.
- [x] AC7 Forward-only migration, unit + DB tests — evidence: `db/migrations/20261126150000_presence.sql` is a new
  file (expand-only, one `create table` + one index, no begin/commit/grant), sorts after the latest on origin/main
  (`20261126140000_members_pixel_look.sql`); no applied migration edited; schema:check section 14 green.
- [x] D78 — `grep -rln presence src/` outside the new presence files hits only the D82 hook call sites
  (seats.ts, manage.ts, rooms.ts, rooms.test.ts) and the pre-existing UI copy/check-in page; nothing in
  `src/server/export/**`, `src/server/dashboard/**`, `src/server/search/**`, and `impactOf` in manage.ts is unchanged.
- Ming verification after merge (not verified here, carry into the PR): after the release deploys the migration, sign
  in as a User with a seat, check in, check out and check in again on the hosted app and confirm `presence` rows and
  `presence.*` audit entries appear.

### Concurrency and lock order (orchestrator question)
Global order (rooms.ts:215-224): member row, then room, then seats (id order), then devices/requests; presence rows are
always last in every writer.
- `checkIn`: member `for no key update` -> room `for share` -> lowest held seat `for share` -> presence insert/update.
  Every presence insert goes through `checkIn`, so the member lock serialises the only path that can hit
  `presence_org_member_date_key`; dropping `on conflict` is safe (the "two concurrent check-ins" DB test passes, one
  row, one audit). Presence FKs take KEY SHARE on member and seat, compatible with the locks already held.
- `checkOut`: member lock -> presence update. `moveSeat`: member lock -> room `for share` -> both seats `for share` in
  id order -> re-check old seat still held and target owned -> presence update.
- D82 hooks do not take the checked-in member's lock, and do not need it: each runs after the caller's seat lock
  (`for update`; deactivateMember also holds the member `for update`, deleteRoom the room `for update`). A check-in or
  move holds the seat `for share`, so either it commits first and the hook's statement-level snapshot sees and ends
  its row, or the hook commits first and the check-in's `for share` re-check drops the seat (occupant changed ->
  422 / other seat; move -> 409 / 422). Concurrent `checkOut` vs hook both update the same presence row; the second
  re-evaluates `checked_out_at is null` and skips, so no double audit.
- Member-lock conflicts: `for no key update` conflicts with `setOccupant` / `approveRequest` / handoffs `for share` and
  `deactivateMember` / `updateMember` `for update`; all of those take the member row first, before rooms/seats, so no
  cycle. `releaseSeat`, `deleteRoom`, `deleteSeat` and devices take no member lock. No deadlock path found.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: routes import only `@/server/presence/*`, `@/server/http/*`, lib; every new server file starts
with `import "server-only"`; check:layers clean. R2: new forward-only file. R3: no config. R4: one out-of-plan file
(`src/server/rooms/rooms.test.ts`, index shift for the extra `update presence` statement in deleteRoom's statement-order
test) is justified in impl-log. R5: green checks, tests for all new logic. R6 / R7: see AC6.

### Blockers from review agents
None.

### Nits (do not block)
- presence.ts `checkIn`: the `same` decision returns the `active` row read before the room/seat locks; if a release of
  that seat commits in between, the 200 carries a presence the hook has just ended. Display-only and corrected on the
  next poll; re-reading after the seat lock (or deciding after it) would close it.
- presence.ts `checkIn` insert uses `select ... from (select $1::uuid as org_id) o where o.org_id = $1::uuid` only to
  satisfy the `orgQuery` text guard; a one-line comment would save the next reader the puzzle.
- end.ts: `presence.system_check_out` audit meta `seat` is the seat id, while `check_in` / `check_out` / `move` store the
  seat code; after a forced room delete the id no longer resolves. Consider `seat` = code (and `seatId` = id).
- `checkOut` also closes (and audits) a today row that is open but stale (seat lost via a path that skipped the hooks);
  harmless, as the plan notes.

### Follow-ups (out of scope)
- SIM-063 (provider source) must take the same member row lock before writing presence, or add `on conflict`, since the
  insert now relies on the lock instead of `on conflict`.
