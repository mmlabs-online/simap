Status: READY

# Plan — SIM-012: Seat list, add/delete seats, seat detail and occupancy

> **Plan approval gate: not triggered.** No file in this plan matches a High path in `.claude/loop.config.md` or
> `.github/risk-tiers.yml`: no `db/migrations/**`, no `**/*.sql`, no `src/server/http/**`, no `src/server/**/auth*`, no
> `src/server/identity/**`, no `**/config.*`. The ticket's `Gate: none` stands. The PR is Medium tier (default), and the
> security reviewer still runs because `src/server/` changes.
>
> **Split:** this plan covers slice 1 only: the seats API, server and lib, with their tests. The room detail page, seat
> panel and dialogs are slice 2 (proposed `SIM-012.2`, see `## Split proposal`). This follows SIM-010 / SIM-010.2 and
> SIM-011 / SIM-011.2. This plan does not create that ticket or edit the board.

## Scope summary
Spec `docs/spec-v1.md`:
- ROO-02 (lines 222-224): "A new seat's code is `<room code>-<NN>`. NN is the highest existing sequence number in the room plus 1, padded to 2 digits. Numbers are never reused: the room keeps a counter of the highest number ever issued (D30)." "No API or form lets anyone type in a seat code."
- SEA-01 (lines 229-233): "An Admin adds seats to a room and deletes them through the API and a plain seat list on the room page (D47)". "Deleting a seat that has an occupant or any device is refused with a clear message (seatMGT guard)." "An Admin or Manager marks a seat "cannot seat" with a reason (broken, storage…). Such a seat cannot be assigned or requested and shows grey with the reason; its status is still derived (D26)."
- SEA-02 (line 236): "Every view shows a seat as empty or occupied, computed from its occupant. No status column exists."
- SEA-03 (lines 239-244): "A Manager+ sets a seat's occupant to any member, or clears it." "Clearing the occupant turns the seat's primary device into secondary (invariant 8)." "Assigning a different member to an occupied seat asks for confirmation ("X sits here. Replace with Y?"); on confirm it replaces the occupant and demotes the primary (D18)." "Only members known to simap can be assigned (D16)." "Assigning the current occupant again changes nothing."
- SEA-04 (line 249): "On assign, a seat with no group takes the occupant's group; a Manager+ can change it afterwards (D32)."
- SEA-05 (lines 252-255): "Any user opens a seat's detail: code, room, status, occupant, primary device, secondary devices with their owners, group/project tags." "The detail is addressable by URL (seatMGT `?seat=<code>` drawer) and always shows current data." "Actions in the panel show only to roles allowed to use them."
- DEV-06 (lines 287-288): "Every path that removes or replaces an occupant turns the seat's primary device into secondary, in the same transaction."
- REG-03 (line 388): "A user releases a seat they occupy without approval; the occupant is cleared and DEV-06 runs."
- MEM-01 (via SIM-011 plan, spec line 292 onward): a deactivated member "is hidden from pickers".

`work/decisions.md`: D18 (confirm, replace, demote), D22 (self-release), D26 (flag with a reason, "blocks assignment and requests; status stays derived"), D30 ("Seat numbers are never reused (per-room counter)"), D32 (group inheritance), D47 ("Admins add and delete a room's seats through the API (D30 counter, SEA-01 guard, default geometry) and the room detail page lists seats in the clean UI kit, with the seat panel opened from the list (`?seat=<code>`), in SIM-012"), D52 ("room/seat tables" use the clean UI kit).

## Acceptance criteria → verification
| # | Ticket criterion | Slice | How the reviewer verifies it |
|---|---|---|---|
| 1 | An Admin adds seats to `C302` after `C302-01..03` were issued and `-03` deleted, and gets `C302-04` onward; non-Admins get 403. | **This plan (full)** | `seats.db.test.ts › add after delete: 01..03, delete 03, add 2 → C302-04, C302-05`. `seats-routes.test.ts › User and Manager: POST room seats and DELETE seat → 403 forbidden, service not called`. |
| 2 | Deleting a seat with an occupant or a device is refused with a clear message; an empty seat is deleted and its number is not reused. | **This plan (full)** | `seats.db.test.ts › delete refused: occupant → 409 seat_not_empty; secondary device on an empty seat → 409 seat_not_empty; nothing changed`. `› delete empty seat: row gone, counter unchanged, one seat.delete audit`. Clear message: the `seat_not_empty` text in `src/ui/copy/api.ts` (`auth.test.ts:63` checks every code has text). |
| 3 | The room detail page lists every seat (code, status, occupant, devices); choosing a row opens the panel at `?seat=<code>`. | SIM-012.2 | Data half here: `seats.db.test.ts › list: every seat in seq order with derived status, occupant, devices, tags`. Page and panel are SIM-012.2. |
| 4 | Assigning to an occupied seat asks "X sits here. Replace with Y?" and on confirm demotes X's primary device. | Server here, dialog in SIM-012.2 | `rules.test.ts › decideOccupantChange` (full table). `seats.db.test.ts › replace: occupant is Y, X's primary is secondary and still on the seat, COMMIT passes the deferred trigger`. `› stale expectedOccupantId → 409 occupant_changed, nothing changed`. |
| 5 | A cannot-seat seat cannot be assigned (server refuses, UI disables). | Server here, UI in SIM-012.2 | `seats.db.test.ts › cannot-seat: assign and replace → 409 seat_cannot_seat; remove and release still work`. |
| 6 | The occupant can release their own seat; others cannot. | Server here, button in SIM-012.2 | `seats.db.test.ts › release: occupant clears and demotes; another member, including a Manager → 409 not_allowed, nothing changed`. `seats-routes.test.ts › release refusal is 409, never 403`. |
| 7 | A seat with no group takes the occupant's group on assign. | **This plan (full)** | `seats.db.test.ts › D32: null seat group inherits; existing seat group kept; member with no group leaves null; no-op does not inherit`. |
| 8 | Unit tests cover assign/replace/release rules and demotion. | **This plan (full)** | `src/lib/seats/rules.test.ts`, `src/server/seats/seats.test.ts`, in `pnpm test` (no DB). |

All Checks green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `pnpm test:db` in CI.

## Ming verification after merge
None for this slice. The ticket's manual test ("assign, replace, release on a seeded room") moves to SIM-012.2, where the UI exists. Please confirm the defaults under `## Assumptions`.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/seats/types.ts` (new) | `SEAT_LIMITS`, `SeatStatus`, `SeatDeviceDto`, `SeatDto`, `RoomSeatsResponse`. | Shared API contract | No |
| `src/lib/seats/rules.ts` (new) | Pure: `seatStatus`, `decideOccupantChange`, `decideRelease`, `decideDelete`, `inheritedGroup`. | AC4-AC8, pure logic first | No |
| `src/lib/seats/rules.test.ts` (new) | Decision tables. | AC8 | No |
| `src/lib/validate/seat.ts` (new) | `validateSeatAdd`, `validateOccupantPut`, `validateCannotSeat`. | Boundary validation | No |
| `src/lib/validate/seat.test.ts` (new) | Validator tests. | R5 | No |
| `src/lib/api/error.ts` | Append `seat_not_empty`, `seat_cannot_seat`, `occupant_changed`, `not_allowed`, `member_not_assignable`. | One error shape; none exists yet | No |
| `src/ui/copy/api.ts` | Add the five messages (its `satisfies Record<ApiErrorCode, string>` at line 21 forces this). | D36; typecheck | No |
| `src/server/seats/seats.ts` (new) | `listRoomSeats`, `getSeat`, `addSeats`, `deleteSeat`, `setOccupant`, `releaseSeat`, `setCannotSeat`; local `Refusal`/`Result`/`Abort`/`inTx` (the `manage.ts:27-61` pattern; those helpers are private). | Service layer | No |
| `src/server/seats/seats.test.ts` (new) | Fake-Db tests: lock order, rollback, no-op writes nothing. | AC8, deadlock safety | No |
| `src/server/seats/seats.db.test.ts` (new) | DB tests using `src/test/db/fixtures.ts` (no fixture change). | AC1-AC7, triggers, races | No |
| `src/server/seats/pg-error.ts` (new) | `seatConflict(err)`: 23503 on `devices_seat_fkey` → `seat_not_empty`. | Keeps the DB backstop from surfacing as a 500 | No |
| `src/server/seats/pg-error.test.ts` (new) | Mapper tests. | R5 | No |
| `src/server/rooms/rooms.ts` | **Comment only**, line 215: record the `for share` member lock taken when assigning (SIM-012). | Keeps the single lock-order doc true | No |
| `src/app/api/rooms/[id]/seats/route.ts` (new) | `GET` (user), `POST` (admin). | SEA-01, SEA-05 | No |
| `src/app/api/seats/[id]/route.ts` (new) | `GET` (user), `DELETE` (admin). | SEA-01, SEA-05 | No |
| `src/app/api/seats/[id]/occupant/route.ts` (new) | `PUT` (manager). | SEA-03 | No |
| `src/app/api/seats/[id]/release/route.ts` (new) | `POST` (user). | REG-03 | No |
| `src/app/api/seats/[id]/cannot-seat/route.ts` (new) | `PATCH` (manager). | SEA-01, D26 | No |
| `src/app/api/seats/seats-routes.test.ts` (new) | Route tests for all five route files (pattern of `src/app/api/rooms/route.test.ts`). | Tiers, codes, R7 | No |

Not touched: `db/migrations/**`, `src/server/http/**`, `src/server/members/**`, `src/lib/session.ts`, `src/ui/auth/**`, `src/ui/copy/audit.ts`. `src/app/api/routes-guarded.test.ts` needs no change: it discovers every `route.ts` (lines 12-18, 56-69).

## Data model / migration
None (R2 met trivially). Verified in `db/migrations/20261120150000_init.sql`:
- `seats` (79-107): `occupant_id`, `group_id`, `project_id`, `cannot_seat`, `cannot_seat_reason`; geometry defaults `x`, `y`, `rotation` = 0, `w`, `h` null, so an insert that omits them gets the default geometry. `seats_cannot_seat_reason_check` (99) means clearing the flag must null the reason in the same UPDATE. `seats_org_room_seq_key` (101) and `seats_org_code_key` (100) back the D30 rule.
- `rooms.seat_counter` (67). `db/seeder.js:99-101` sets it to the seeded seat count, so a seeded `C302` continues at `C302-05`.
- `devices`: `devices_seat_fkey ... on delete restrict` (134), `devices_one_primary_per_seat` (137).
- Deferred constraint triggers `devices_primary_owner_trg` (243-246) and `seats_primary_owner_trg` (268-271) check at COMMIT.
- `seat_requests.seat_id ... on delete cascade` (158). `audit_log` is append-only (273-282).

## API contract
All routes: `export const dynamic = "force-dynamic"`, `Cache-Control: no-store`, wrapped in `withAuth`, non-canonical `[id]` → 404 `not_found` (`isCanonicalUuid`), `getPool()` null → 503 `unavailable`, bodies via `readJson` (400 `invalid_request`). Every query goes through `orgQuery`, and every join and subquery repeats the `org_id` match (R6). Errors are `{ error: { code } }` only. Handlers never return 401/403 (R7); all such codes come from `withAuth`. Every route below can also answer the wrapper's 401, 403 and 503.

| Method | Path | Request | Response | Domain codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/rooms/[id]/seats` | none | `200 RoomSeatsResponse` | 404 `not_found` | user |
| POST | `/api/rooms/[id]/seats` | `{ count }`, integer 1..50, no other key | `201 { items: SeatDto[] }` in `seq` order | 400, 404 | admin |
| GET | `/api/seats/[id]` | none | `200 SeatDto` (detail device cap) | 404 | user |
| DELETE | `/api/seats/[id]` | none | `204` | 404, 409 `seat_not_empty` | admin |
| PUT | `/api/seats/[id]/occupant` | `{ memberId: uuid \| null, expectedOccupantId: uuid \| null }`, both keys **required**; `memberId: null` clears | `200 SeatDto`. No-op → 200, no write, no audit | 400, 404, 409 `occupant_changed`, 409 `seat_cannot_seat`, 422 `member_not_assignable` | manager |
| POST | `/api/seats/[id]/release` | none (body ignored) | `200 SeatDto`. Already empty → 200, no write, no audit | 404, 409 `not_allowed` | user |
| PATCH | `/api/seats/[id]/cannot-seat` | `{ cannotSeat: true, reason: string }` (reason **required**, NFC, trimmed, 1..200) or `{ cannotSeat: false }` (`reason` absent or null) | `200 SeatDto`. Same state → 200, no audit | 400, 404 | manager |

```ts
SEAT_LIMITS = { addMax: 50, list: 500, listDevices: 20, detailDevices: 200, reason: 200 }
SeatDeviceDto = { id, name, type, inventoryNumber, role: "primary" | "secondary", owner: { id, displayName } }
SeatDto = { id, code, seq, roomId, roomCode, status: "empty" | "occupied", cannotSeat, cannotSeatReason: string | null,
  occupant: { id, displayName } | null, mine: boolean, group: { id, name, color } | null,
  project: { id, code, name } | null, deviceCount: number, devices: SeatDeviceDto[] }
RoomSeatsResponse = { room: { id, code, name }, items: SeatDto[], truncated: boolean }
```
`mine` is computed on the server from `ctx.sub` (occupant's `sub` = caller). `sub` and `mac` are never returned. `deviceCount` is the true count; `devices` is ordered primary first, then `lower(name), id`, capped per `SEAT_LIMITS`. `truncated` is true when the room has more than 500 seats (query `limit 501`), so a capped list is never silent.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/seats/rules.test.ts › seatStatus: null → empty, id → occupied` | SEA-02 |
| `rules.test.ts › decideOccupantChange: same member → noop, even on a cannot-seat seat or with a stale expected; both null → noop; empty + expected null → assign; occupied + expected current → replace; expected differs → refuse_changed; cannot-seat + assign or replace → refuse_cannot_seat; cannot-seat + clear → remove; clear with a stale expected → refuse_changed` | AC4, AC5, AC8 |
| `rules.test.ts › decideRelease: empty → noop; actor is occupant → release; other member → refuse; actor without a member row on an occupied seat → refuse` | AC6, AC8 |
| `rules.test.ts › decideDelete: occupant → refuse; deviceCount > 0 → refuse; empty → delete` | AC2 |
| `rules.test.ts › inheritedGroup: seat null + member group → member group; seat group kept; both null → null` | AC7 |
| `src/lib/validate/seat.test.ts › validateSeatAdd: 1 and 50 ok; 0, 51, 1.5, "2", null, missing, extra key → error` | Bounds |
| `validate/seat.test.ts › validateOccupantPut: uuid/null combinations ok; missing expectedOccupantId, missing memberId, uppercase or non-canonical uuid, extra key → error` | Stale guard is mandatory |
| `validate/seat.test.ts › validateCannotSeat: true + Vietnamese reason kept in NFC; true with missing, blank or 201-char reason → error; false ok; false + non-null reason → error; non-boolean → error` | D26, diacritics, empty/null |
| `src/server/seats/pg-error.test.ts › 23503 devices_seat_fkey → seat_not_empty; other constraints or codes → null` | Backstop |
| `src/server/seats/seats.test.ts › setOccupant lock order: member for share, room for share, seat for update, then devices, seat, audit` | Deadlock safety |
| `seats.test.ts › clear and release take no member lock; add and delete take the room for update before any seat` | Lock order |
| `seats.test.ts › a no-op writes nothing and no audit; a refusal issues ROLLBACK; an error after the seat update issues ROLLBACK, no COMMIT` | AC8 |
| `seats.test.ts › add allocates through allocateSeatSeq count times and writes one audit per seat` | AC1, D30 |
| `src/server/seats/seats.db.test.ts › add after delete: 01..03, delete 03, add 2 → C302-04, C302-05` | AC1, D30 |
| `seats.db.test.ts › add: default geometry (x, y, rotation 0; w, h null); seq 100 → C302-100; another org's room → 404` | D47, ROO-02, R6 |
| `seats.db.test.ts › concurrent adds to one room: no duplicate seq, counter equals the total` | D30 |
| `seats.db.test.ts › delete refused: occupant → 409 seat_not_empty; secondary device on an empty seat → 409 seat_not_empty; nothing changed` | AC2 |
| `seats.db.test.ts › delete empty seat: row gone, counter unchanged, one seat.delete audit with droppedRequests, its requests cascade` | AC2 |
| `seats.db.test.ts › delete vs assign race: with the assign holding its locks, delete waits (waitForLockWait), then gets 409 seat_not_empty` | Race |
| `seats.db.test.ts › list: every seat in seq order with derived status, occupant, devices, tags; device cap with true deviceCount; mine true only for the occupant; other org's seats never appear` | AC3 data, SEA-05, R6 |
| `seats.db.test.ts › assign to empty seat: occupant set, seat.assign audit` | SEA-03 |
| `seats.db.test.ts › replace: occupant is Y, X's primary is secondary and still on the seat, COMMIT passes the deferred trigger, one seat.replace audit` | AC4, DEV-06 |
| `seats.db.test.ts › same member again: nothing changes, primary stays primary, no audit` | SEA-03 |
| `seats.db.test.ts › stale expectedOccupantId → 409 occupant_changed, nothing changed` | AC4 race |
| `seats.db.test.ts › clear: occupant null, primary demoted, seat.unassign audit; seat group kept` | SEA-03, DEV-06 |
| `seats.db.test.ts › assign refused: deactivated member, unknown id, another org's member → 422 member_not_assignable` | D16, MEM-01, R6 |
| `seats.db.test.ts › assign vs deactivate race: with deactivateMember holding the member lock, assign waits, then gets 422 member_not_assignable; the seat stays empty` | Lock order |
| `seats.db.test.ts › cannot-seat: assign and replace → 409 seat_cannot_seat; remove and release still work` | AC5, D26 |
| `seats.db.test.ts › cannot-seat: set on an occupied seat keeps the occupant; clear nulls the reason; audit meta has hasReason and never the reason text` | D26, privacy |
| `seats.db.test.ts › release: occupant clears and demotes; another member, including a Manager → 409 not_allowed, nothing changed; already empty → 200, no audit` | AC6, REG-03 |
| `seats.db.test.ts › D32: null seat group inherits; existing seat group kept; member with no group leaves null; no-op does not inherit` | AC7 |
| `src/app/api/seats/seats-routes.test.ts › no Authorization → 401 on every handler` | Guard |
| `seats-routes.test.ts › User and Manager: POST room seats and DELETE seat → 403 forbidden, service not called; User: PUT occupant and PATCH cannot-seat → 403; User: GET and release pass the guard` | AC1, tiers |
| `seats-routes.test.ts › non-canonical id → 404; bad JSON or invalid body → 400; refusals map to status and code; release refusal is 409, never 403; responses carry Cache-Control: no-store` | R7, error shape |

## Approach
1. **Lib first.** Types, `rules.ts`, `validate/seat.ts` with their tests. `decideOccupantChange({ current, target, expected, cannotSeat })` checks in this order: `current === target` → `noop`; `target === null` → (`current === expected` ? `remove` : `refuse_changed`); `cannotSeat` → `refuse_cannot_seat`; `current !== expected` → `refuse_changed`; `current === null` → `assign`; else `replace`.
2. **Error codes and copy.** `seat_not_empty`: "This seat still has an occupant or devices. Clear them first."; `seat_cannot_seat`: "This seat is marked as not available for seating."; `occupant_changed`: "This seat just changed. Check it and try again."; `not_allowed`: "This action is not allowed."; `member_not_assignable`: "This member can't be assigned to a seat."
3. **Service `src/server/seats/seats.ts`** (starts with `import "server-only"`). The lock order is the one in `rooms.ts:213-223`. To find a seat's room before locking, read `room_id` unlocked (no API moves a seat between rooms), lock the room, then lock the seat and re-read it. A row missing at either lock → 404.
   - **`addSeats`:** room `for update` (404 if missing) → `allocateSeatSeq` `count` times → `formatSeatCode(roomCode, seq)` → one `insert ... select ... from unnest($3::int[], $4::text[])` omitting geometry → one `seat.create` audit per seat, meta `{ code, room }` → load DTOs.
   - **`deleteSeat`:** room `for update` → seat `for update` → count devices → `decideDelete` (refuse: Abort 409 `seat_not_empty`) → count the seat's request rows → delete → `seat.delete` audit, meta `{ code, room, droppedRequests }`. The counter is not touched (D30). `inTx` maps `seatConflict`.
   - **`setOccupant`:**
     1. If `memberId` is set: `select id, status, group_id from members where org_id = $1 and id = $2 for share`. Missing or not `active` → Abort 422 `member_not_assignable`.
     2. Room `for share`.
     3. Seat `for update`.
     4. `decideOccupantChange`; `noop` returns the DTO, refusals Abort.
     5. `update devices set role = 'secondary', updated_at = now() where org_id = $1 and seat_id = $2 and role = 'primary' returning id`. `orgQuery` exposes `rows` only, so `returning id` gives the `demoted` count.
     6. `update seats set occupant_id = $3, group_id = $4, updated_at = now()`, with `$4 = inheritedGroup(...)` for assign and replace, and the seat's current group for a clear.
     7. Audit `seat.assign`, `seat.replace` or `seat.unassign`, meta `{ code, memberId, previousOccupantId, demoted, groupInherited }`.
   - **`releaseSeat`:** read the actor's member id (`where org_id = $1 and sub = $2`, no lock) → room `for share` → seat `for update` → `decideRelease` (refuse: Abort 409 `not_allowed`) → demote → clear → `seat.release` audit, meta `{ code, demoted }`.
   - **`setCannotSeat`:** room `for share` → seat `for update` → same state is a no-op → update flag and reason together → `seat.cannot_seat` audit, meta `{ code, cannotSeat, hasReason }`. The free-text reason stays out of the audit.
   - **Reads:** one query per call, with correlated subqueries for devices and `deviceCount` (no seat × device fan-out); `left join` occupant, group and project, each matching `org_id`.
4. **Lock-order comment** in `rooms.ts` line 215: add that assigning takes the target member `for share` at this step (SIM-012). Comment only.
5. **Routes**, copying `src/app/api/rooms/[id]/route.ts`. Routes import only `@/server/*` and `@/lib/*`, and never read `authorization`.
6. Run all Checks. `pnpm test:db` runs in CI; run it locally only against the local compose Postgres.

**Rules:** R1 (layers above, `pnpm check:layers`). R2 (no migration). R3 (no new env, no PII in logs). R4 (listed files only). R5 (unit, DB and route tests). R6 (`orgQuery` everywhere; tiers from the token's `org_roles` via `withAuth`). R7 (every domain refusal is 404, 409 or 422; no handler returns 401/403).

### Consultant claims checked against the code
| Claim | Result | Evidence |
|---|---|---|
| No migration needed | **Confirmed** | See `## Data model / migration`. |
| `[code]` conflicts with `[id]` | **Confirmed.** `src/app/api/rooms/[id]/` already exists, and Next.js rejects two slug names at one level. Use `[id]`. The page tree keeps `[roomCode]`. | `src/app/api/rooms/[id]/route.ts`; `src/app/(app)/rooms/[roomCode]/page.tsx` |
| Lock order: member, room, seat, devices | **Confirmed, and the member step is mandatory.** The FK on `seats.occupant_id` takes `KEY SHARE` on the member row. Without the lock taken first, assign would hold the seat and wait on the member while `deactivateMember` holds the member `for update` and waits on the seat: a deadlock. | `rooms.ts:213-223`; `manage.ts:219-233, 343-361`; `init.sql:104` |
| Deferred triggers allow occupant change + demotion in one tx | **Confirmed, one correction.** The API consult says demoting *after* the occupant update risks a 23514. It does not: both orders pass, because the check runs at COMMIT. Only *skipping* the demotion fails, and `withTx` then rolls back. The plan demotes first for clarity. | `init.sql:243-246, 268-271`; `tx.ts:13-23` |
| `not_allowed` as a 409 | **Confirmed.** R7 names it, and `apiFetch` re-sends only on 401/403. The code **does not exist yet** and is added here. | `CLAUDE.md` R7; `fetch.ts:57-75`; `error.ts:1-16` |
| Session exposes "my seat" | **It does not.** `Session` is `{ tier, email, orgName?, devToken? }`. `/api/me` returns `member.id`, but the session drops it. **Resolved with a server-computed `SeatDto.mine`**, so no auth UI changes. | `src/lib/session.ts:4`; `src/app/api/me/route.ts:12-16` |
| `GET /api/members?status=active` serves the picker | **Confirmed.** Tier user; `active` is the default status. | `members/route.ts:9-19`; `member-query.ts:23, 33-37` |

## Specialist input used
`consult-api-platform-engineer.md`:
- Adopted: `[id]` routes; `expectedOccupantId` required; member → room → seat lock order; no-op check first; refusal codes as 409; audit meta without free text; list cap; `count` cap of 50; API-first split.
- Adapted: `member_inactive` became `member_not_assignable`, because it also covers unknown and other-org ids, so a caller cannot tell whether an id exists in another org.
- Rejected: optional cannot-seat `reason` (SEA-01 and D26 require one). A separate `DELETE /occupant` (it has no stale-occupant guard and could clear someone who just replaced X; `PUT` with `memberId: null` reuses the guard). Audit labels for `seat.*`: `member.*` also shows raw today (SIM-011 A8), the ticket does not ask for labels, and `audit-state.test.ts:48` asserts `seat.assign` stays raw.

`consult-frontend-developer.md`:
- Adopted: mutations keyed by seat id; `SeatDto` shape; server-computed status; all UI recommendations are carried into the SIM-012.2 defaults.
- Rejected: 409 `seat_occupied` carrying the occupant's name (`respond.ts` allows `{ error: { code } }` only; the UI refetches on `occupant_changed` instead). A `routes-guarded.test.ts` entry (not needed, it auto-discovers). An on-page room switcher (spec line 437 places it in the shell).

## Assumptions
**Spec-versus-ticket conflicts (the spec wins):**
- **C1 Cannot-seat reason.** The ticket says "with reason", and SEA-01 and D26 agree; the API consult made it optional. Required here.
- **C2 Route params.** The ticket's `{code}` paths and `rooms/[code]` file paths cannot coexist with the existing `rooms/[id]`. The ticket marks them "e.g." and the spec names no path, so this plan uses ids.
- **C3 Numbering.** ROO-02 opens with "highest existing sequence number … plus 1", which would reuse a deleted top number. Its next sentence, D30 and ticket AC1 require the counter. The counter is used (`seat-code.ts:3` records the same reading).
- **C4 "Any member".** SEA-03 says "any member"; MEM-01 and the ticket restrict pickers to active members. The server also refuses deactivated members.
- **C5 Room page.** Spec line 366 describes `/rooms/<code>` as the pixel layout; D47 and spec line 229 put a plain seat list there for now. SIM-012.2 builds the list. SIM-015.1 reconciles the two later.

**Defaults for Ming to confirm (none block implementation):**
- **A1 Ids in API paths** (`/api/rooms/[id]/seats`, `/api/seats/[id]`). Seat codes change on a room rename (D29); ids do not.
- **A2 Add cap:** `count` is 1..50 per call; no start number.
- **A3 Cannot-seat on an occupied seat is allowed.** The occupant stays until removed, and remove and release still work (D26: "status stays derived").
- **A4 Admin is included** in cannot-seat and assign (SEA-01 "An Admin or Manager"; tiers are hierarchical).
- **A5 Idempotent no-ops.** Clearing or releasing an empty seat is 200 with no audit. Releasing a seat held by someone else is 409 `not_allowed`.
- **A6 A Manager uses the occupant action to clear someone else's seat.** The release endpoint is strictly for the occupant, whatever their tier.
- **A7 Direct assign leaves pending requests alone.** SIM-014 owns them. SIM-014 must also refuse approval on a cannot-seat seat and follow this lock order.
- **A8 Devices stay on the seat as secondary** after replace, remove or release (DEV-06). Only the demotion runs, as D18 says.
- **A9 Replace keeps the seat's group.** Only a null seat group inherits (D32). Clearing an occupant does not clear the group.
- **A10 Deleting a seat removes all its request rows,** including decided history, through the existing cascade (`init.sql:158`). The `seat.delete` audit records the count. Keeping that history would need a migration, so it is out of scope.
- **A11 Audit meta holds member UUIDs** (`memberId`, `previousOccupantId`), so the log can answer who sat here. No names or emails. `write.ts:6` says "codes, field names and counts only", so the reviewer should treat these opaque ids as the one deliberate addition.
- **A12 Seat list cap of 500** with a `truncated` flag rather than paging. Rooms are small.
- **A13 Size.** This slice is above the ~400-line guide (about 600 production lines plus tests), as SIM-011 was. It is one cohesive server change, and splitting it further would separate the occupancy rules from the delete guard they share locks with.

**Hotspots:** no open ticket in `IN_PROGRESS` or `REVIEW`. SIM-009.2 and SIM-024.1 (`DONE`) do not edit these files. SIM-011.2, SIM-013, SIM-014 and SIM-016 will append to `src/lib/api/error.ts` and `src/ui/copy/api.ts`, so expect trivial rebases.

**Follow-up seen, not fixed here (R4):** two simultaneous `deactivateMember` calls where A deactivates B and B deactivates A, both with pending requests, can deadlock. Each holds its target `for update`, then the `decided_by_id` FK needs `KEY SHARE` on the other row (`manage.ts:344, 406-412`). Postgres aborts one and it returns 500, with no bad data. Rare; worth a small ticket.

## Blocking questions
None.

## Split proposal
The full ticket is well above one implement/review cycle. Both consultants propose API first, and I agree.

**SIM-012 (this plan): API, server and lib.** Fully covers AC1, AC2, AC7, AC8. Covers the server half of AC4, AC5, AC6 and the data half of AC3.

**SIM-012.2 (proposed, Areas `ui`, depends on SIM-012): room detail page and seat panel.** Covers AC3 and the UI halves of AC4, AC5, AC6, plus the ticket's manual test. No server or API change.

Files: `src/app/(app)/rooms/[roomCode]/page.tsx`; `src/ui/seats/*` (`SeatsPage`, pure `SeatsView` / `SeatsTable`, `SeatDetailPanel`, `useSeats`, `seats-api`, assign / replace / delete / cannot-seat / add dialogs, member picker, pure helpers); `src/ui/copy/seats.ts`; `src/ui/index.ts`; `src/ui/rooms/RoomCard.tsx` (link to detail); the shell for the room switcher.

Settled defaults:
1. **Style:** clean UI kit, no pixel art (D47, D52). `SeatDetailPanel` is props-driven with no map assumptions, so a later pixel skin can wrap it.
2. **Route:** keep `[roomCode]`. Resolve code → id from `GET /api/rooms`; unknown code shows a not-found state.
3. **Room switcher in the shell** (spec line 437), navigating to `/rooms/<code>`. Re-key with `<SeatsPage key={roomCode} />` so panel, dialog and fetch state reset.
4. **`?seat=<code>`:** push on open (Back closes), replace on close by button. Validate and cap the param. Find the seat in this room's list, then fetch `GET /api/seats/[id]` for current data. Not in this room → not-found state in the panel. `useSearchParams` is new in `src/ui`, so wrap it in `<Suspense>`.
5. **Table:** real `<table>`, native button in the code cell, status as text plus icon, horizontal scroll at 390 px, a notice when `truncated`.
6. **Panel:** native `<dialog>`, full-width sheet at 390 px, focus returns to the row.
7. **Gating:** Admin sees add and delete; Manager+ sees assign, remove and cannot-seat; `seat.mine` shows Release. No session change.
8. **Replace:** when the seat shows an occupant, ask "X sits here. Replace with Y?" before sending, with `expectedOccupantId` = the shown occupant. On `occupant_changed`, reload and ask again with the fresh name.
9. **Mutations:** reload the seats after every success and after any 404, 409 or 422.
10. **Picker:** `GET /api/members?status=active&q=`, debounced, stale responses dropped, radio list showing display name and employee code, "Load more" by cursor.
11. **Cannot-seat:** Assign is disabled and the reason is shown; the reason field is required when setting the flag.
12. **Tags are read-only** (editing is SIM-016).
