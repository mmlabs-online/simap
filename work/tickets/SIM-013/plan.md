Status: READY

# Plan: SIM-013 Devices (slice 1: placement rules, device read API, placement API)

This plan covers **slice 1 only**. See `## Split proposal`. Slice 1 is API-only. It adds the pure placement and permission rules, the device list/detail read API with the placement DTO, and one placement endpoint for place, lend, move and return. It also adds the new error codes. Device create, edit and delete (with MAC) and all UI are in SIM-013.1..SIM-013.3.

## Scope summary
Quoted from `docs/spec-v1.md` §6 (lines 257-288), §5 invariants (lines 139-146), REG-03 (lines 387-389) and `work/decisions.md`:

- Invariant 3: "A seat has at most one primary device, and it must be owned by the seat's current occupant."
- Invariant 4: "A seat may hold any number of secondary ("borrowed") devices, owned by anyone."
- Invariant 5: "A device may be unassigned, in inventory."
- DEV-02: "Every device list and device detail shows "at seat X" or "in inventory". The Devices page filters by all / placed / inventory." (Slice 1 covers the API side: the `placement` field and the `?placement=` filter.)
- DEV-03: "Placing a device as primary is refused unless the seat has an occupant, that occupant owns the device, and the seat has no primary yet (invariant 3). The check runs in the app and again in the DB." / "Secondary placement has no ownership check."
- DEV-04: "The device's owner places it as secondary on any seat. A borrowed device is never primary." / "A Manager+ may do this for any device of the org (D19)."
- DEV-05: "A device moves seat to seat (it takes the chosen role; the DEV-03 rules apply) or back to inventory." / "The owner moves their own devices; a Manager+ moves any device of the org (D19)."
- REG-03: "A user returns their own device from a seat to inventory."
- §3 roles (line 64), User: "Views all rooms, seats, members and devices of the org. … Manages own devices."
- §8 size (line 505): "Lists are paginated or bounded."
- D19: "Managers and Admins place, move and return any device of the org; editing/deleting a device is owner or Admin only."
- D22: "REG-03 in v1: users … return their own devices to inventory."
- DEV-01 (permission part, used by the `canEdit` rule and the DTO only. The endpoints are in SIM-013.1): "A User or Manager creates devices only for their own member and edits or deletes only their own devices. An Admin can do this for any member."

## Acceptance criteria → verification
Ticket criteria and the slice that closes each one:

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Placing as primary is refused unless the seat's occupant owns the device and the seat has no primary. (slice 1) | `src/lib/devices/rules.test.ts` › "primary: refused when seat has no occupant / occupant is not the owner / seat already has a primary; allowed for the occupant-owner on a seat without a primary; re-placing the current primary is a noop". DB side (CI): `src/server/devices/devices.db.test.ts` › "primary refusals return 409 with seat_has_no_occupant / owner_not_occupant / seat_has_primary and change nothing". Backstop mapping: `src/server/devices/pg-error.test.ts` maps 23505 `devices_one_primary_per_seat` and 23514 `devices_primary_owner_is_occupant`. |
| 2 | A Manager can move another member's device; a User cannot. (slice 1) | `rules.test.ts` › "permission matrix: place/move/return". DB: `devices.db.test.ts` › "manager moves another member's device seat to seat; user gets 422 not_allowed and the row is unchanged". |
| 3 | Deleting a placed device is refused until it is in inventory. | **SIM-013.1** (DELETE endpoint). Slice 1 only provides the "Move to inventory" path (`PUT …/placement` with `seatId: null`), tested in `devices.db.test.ts` › "owner returns own device to inventory (REG-03)". |
| 4 | Devices list shows placement for every device. | API in slice 1: `devices.db.test.ts` › "list: every item has placement (seat code + room code + role, or null), filter all/placed/inventory, truncated flag". UI in **SIM-013.2**. |
| 5 | Unit tests cover placement rules and permission matrix. (slice 1) | `pnpm test` runs `src/lib/devices/rules.test.ts`. It covers every cell of the matrix in `## Approach` step 2 and every placement decision. |

The required checks must all be green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. `pnpm test:db` runs in CI.

## Ming verification after merge
None for slice 1. Slice 1 is API-only, and the DB behaviour is covered by `pnpm test:db` in CI. The ticket's manual check, "lend and move devices between seats", happens after SIM-013.3 ships the place dialog.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/devices/types.ts` | new: `DEVICE_LIMITS { list: 1000 }`, `DeviceRole`, `PlacementFilter = "all" \| "placed" \| "inventory"`, `DevicePlacementDto`, `DeviceDto`, `DeviceListResponse` | shared DTO for the server and the later UI slices (R1: lib) | no |
| `src/lib/devices/rules.ts` | new: pure `canPlace`, `canEdit`, `canCreateFor`, `decidePlacement` | DEV-01/03/04/05, D19, D22; pure logic first | no |
| `src/lib/devices/rules.test.ts` | new: permission matrix and placement decisions | AC1, AC2, AC5 | no |
| `src/lib/validate/device.ts` | new: `parseDeviceQuery(URLSearchParams)` and `validatePlacementPut(body)` (SIM-013.1 adds create/patch/MAC here later) | boundary validation | no |
| `src/lib/validate/device.test.ts` | new | validator edge cases | no |
| `src/server/devices/pg-error.ts` | new (`import "server-only"`): `deviceConflict(err)` maps 23505 `devices_one_primary_per_seat` → `seat_has_primary` and 23514 `devices_primary_owner_is_occupant` → `owner_not_occupant` | DEV-03 "again in the DB" becomes a 409, not a 500 | no |
| `src/server/devices/pg-error.test.ts` | new | mapping, plus `null` for other errors | no |
| `src/server/devices/devices.ts` | new (`import "server-only"`): `listDevices`, `getDevice`, `placeDevice`, plus local `inTx`/`Abort`/`refuse` copied from `src/server/seats/seats.ts:21-54` | the service layer (R6 org scoping, audit) | no |
| `src/server/devices/devices.test.ts` | new: fake-db lock-order and no-write-on-refusal tests (pattern `src/server/seats/seats.test.ts:12-28`) | lock order and R7 | no |
| `src/server/devices/devices.db.test.ts` | new: real-Postgres tests using `src/test/db/fixtures.ts` (`addDevice` at line 67, `waitForLockWait` at line 96) | AC1, AC2, AC4; constraints and concurrency | no |
| `src/app/api/devices/route.ts` | new: `GET` (tier user) | list endpoint | no |
| `src/app/api/devices/[id]/route.ts` | new: `GET` (tier user). SIM-013.1 adds PATCH/DELETE later | detail endpoint (DEV-02 "device detail") | no |
| `src/app/api/devices/[id]/placement/route.ts` | new: `PUT` (tier user) | place / lend / move / return | no |
| `src/app/api/devices/devices-routes.test.ts` | new: route tests (pattern `src/app/api/seats/seats-routes.test.ts:1-58`) | 400/404/503 mapping, ctx.tier passed through, no-store | no |
| `src/lib/api/error.ts` | add `placement_changed`, `seat_has_no_occupant`, `owner_not_occupant`, `seat_has_primary` to `API_ERROR_CODES` (lines 1-28) | new domain refusals | no |
| `src/ui/copy/api.ts` | add the four messages (the `satisfies Record<ApiErrorCode, string>` at line 33 forces this) | otherwise `pnpm typecheck` fails; D36 | no |

`src/app/api/routes-guarded.test.ts` needs no edit, because it discovers every `route.ts` automatically (lines 12-18, 55-69). No file matches a High path.

## Data model / migration
None. `devices` already has every column, constraint, partial index and the deferred trigger (`db/migrations/20261120150000_init.sql:112-139, 223-262`).

## API contract
All routes use `withAuth(..., { tier: "user" })` with `dynamic = "force-dynamic"` and `Cache-Control: no-store`. Fields are camelCase. The auth wrapper returns the 401/403 codes. The service returns only 404/409/422 (R7).

`DeviceDto`:
```ts
{
  id, name, type, inventoryNumber, mac: string | null,
  owner: { id, displayName },
  placement: null | { seatId, seatCode, roomId, roomCode, role: "primary" | "secondary" },
  mine: boolean,      // caller is the owner (owner.sub = token sub, as SeatDto.mine)
  canEdit: boolean,   // canEdit(tier, mine): owner or Admin (D19). Used by SIM-013.1/.2
  canPlace: boolean,  // canPlace(tier, mine): owner or Manager+ (D19)
}
```

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/devices?placement=all\|placed\|inventory` | query: `placement` optional (default `all`; blank = absent; repeated or unknown → 400) | 200 `{ items: DeviceDto[], truncated: boolean }`, ordered by `lower(name), id`, capped at `DEVICE_LIMITS.list` | 400 `invalid_request`, 503 `unavailable` | any member (spec §3: a User views all devices) |
| GET | `/api/devices/[id]` | none | 200 `DeviceDto` | 404 `not_found` (bad uuid, missing, other org), 503 | any member |
| PUT | `/api/devices/[id]/placement` | `{ seatId: uuid \| null, role?: "primary" \| "secondary", expectedSeatId: uuid \| null }`. `role` is required when `seatId` is a uuid. When `seatId` is null, `role` must be absent or `"secondary"`. Unknown keys → 400 | 200 `DeviceDto` (also for a no-op) | 400 `invalid_request`; 404 `not_found` (device or target seat); 409 `placement_changed`, `seat_has_no_occupant`, `owner_not_occupant`, `seat_has_primary`; 422 `not_allowed`; 503 | owner, or Manager+ (D19, D22) |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/devices/rules.test.ts` › "canPlace: owner yes for user/manager/admin; non-owner: user no, manager yes, admin yes" | AC2, AC5, D19 |
| `rules.test.ts` › "canEdit: owner yes for all tiers; non-owner only admin" | AC5, D19 |
| `rules.test.ts` › "canCreateFor: self yes for all tiers; other member only admin" | AC5, DEV-01 |
| `rules.test.ts` › "decidePlacement: not_allowed is checked first (a user moving another's device is refused even when the target is valid)" | AC2, R7 order |
| `rules.test.ts` › "placement_changed when expectedSeatId differs from the current seat (both null/uuid mixes)" | concurrency guard |
| `rules.test.ts` › "return: from a seat → return; already in inventory → noop" | DEV-05, REG-03 |
| `rules.test.ts` › "same seat and same role → noop; same seat role change primary→secondary → move; secondary→primary on own occupied seat → move" | DEV-05 |
| `rules.test.ts` › "primary: no occupant → seat_has_no_occupant; occupant ≠ owner → owner_not_occupant; another primary → seat_has_primary; the device itself as the existing primary is not 'another'" | AC1, DEV-03 |
| `rules.test.ts` › "secondary: no ownership check (empty seat, other occupant, seat with a primary all OK)" | DEV-03, DEV-04, invariant 4 |
| `rules.test.ts` › "manager places another member's device as primary only when that member is the occupant" | D19 + DEV-03 |
| `src/lib/validate/device.test.ts` › "parseDeviceQuery: default all; placed; inventory; blank = all; unknown, repeated or other keys…" (unknown keys are ignored, as in `parseMemberQuery`) | boundary |
| `device.test.ts` › "validatePlacementPut: uuid/null seatId; role required with a seat; role absent or secondary for inventory; primary + null seat → invalid; non-canonical uuid, missing expectedSeatId, extra key, array/null body → invalid" | boundary |
| `src/server/devices/pg-error.test.ts` › "maps the one-primary index and the owner trigger; ignores other codes and constraints" | DEV-03 DB backstop |
| `src/server/devices/devices.test.ts` › "placeDevice lock order: rooms for share (ascending id) before seats for update (ascending id) before the device for update, then update, then audit" | lock order (`rooms.ts:213-224`) |
| `devices.test.ts` › "refusal writes nothing: no update and no audit insert for not_allowed / owner_not_occupant" | R7, AC1, AC2 |
| `devices.test.ts` › "the unlocked seat_id differs from the locked one → 409 placement_changed" | race |
| `devices.test.ts` › "every query passes org_id as $1" | R6 |
| `src/server/devices/devices.db.test.ts` › "list: every item has placement (seat code + room code + role, or null); filters all/placed/inventory; ordered by name; truncated when over the cap (small cap via a loop or the limit const)" | AC4, DEV-02 |
| `devices.db.test.ts` › "list and get are org-scoped: another org's device is absent / 404" | R6 |
| `devices.db.test.ts` › "owner places own device as primary on the seat they occupy; audit device.place" | DEV-03 |
| `devices.db.test.ts` › "primary refusals return 409 with seat_has_no_occupant / owner_not_occupant / seat_has_primary and change nothing" | AC1 |
| `devices.db.test.ts` › "owner lends own device as secondary to another member's seat" | DEV-04 |
| `devices.db.test.ts` › "manager moves another member's device seat to seat (across two rooms); user gets 422 not_allowed and the row is unchanged" | AC2, D19 |
| `devices.db.test.ts` › "owner returns own device to inventory (role becomes secondary); audit device.return" | REG-03, D22, AC3 path |
| `devices.db.test.ts` › "moving the primary off seat A frees A's primary slot (A has no primary, nothing auto-promoted)" | DEV-05 |
| `devices.db.test.ts` › "a stale expectedSeatId → 409 placement_changed" | race |
| `devices.db.test.ts` › "placement waits for a held seat lock; when the holder changes the occupant and commits, the primary placement is refused owner_not_occupant" (`waitForLockWait`) | concurrency, DEV-03 under lock |
| `devices.db.test.ts` › "unknown target seat or seat of another org → 404" | R6 |
| `src/app/api/devices/devices-routes.test.ts` › "401 without token; GET list/detail and PUT placement call the service with ctx.scope, ctx.sub, ctx.tier; non-uuid id → 404 without calling the service; bad body/query → 400; refusal → apiError(status, code); 200 has Cache-Control no-store" | route contract |

## Approach
1. **Types** (`src/lib/devices/types.ts`). Define the DTO from `## API contract`. `DEVICE_LIMITS.list = 1000`. Spec §8 allows "hundreds of … devices", and "Lists are paginated or bounded". `SeatDeviceDto` in `src/lib/seats/types.ts` stays unchanged.
2. **Rules** (`src/lib/devices/rules.ts`, pure, imports only `@/lib/auth/tier` `atLeast` and the types). `canPlace` takes `atLeast(tier,"manager")` as Manager+.

   | Action | User | Manager | Admin |
   |---|---|---|---|
   | `canPlace(tier, isOwner)`: place, lend, move or return | own only | any | any |
   | `canEdit(tier, isOwner)`: edit or delete | own only | own only | any |
   | `canCreateFor(tier, isSelf)` | self only | self only | anyone |

   `decidePlacement(a: { tier; isOwner; deviceId; ownerId; current: { seatId: string | null; role }; expectedSeatId: string | null; target: null | { seatId; occupantId: string | null; primaryId: string | null }; role })` returns `{ kind: "noop" | "place" | "move" | "return" }` or `{ kind: "refuse"; status: 409 | 422; code }`. It checks in this order:
   1. `!canPlace` → 422 `not_allowed`.
   2. `current.seatId !== expectedSeatId` → 409 `placement_changed`.
   3. `target === null`: if the device is in inventory → `noop`, else `return`.
   4. Same seat and same role → `noop`.
   5. `role === "primary"`: no occupant → 409 `seat_has_no_occupant`. Occupant ≠ owner → 409 `owner_not_occupant`. `primaryId !== null && primaryId !== deviceId` → 409 `seat_has_primary`.
   6. `current.seatId === null` → `place`, else `move`.

   No auto-demote of another primary: the spec says the placement "is refused".
3. **Validator** (`src/lib/validate/device.ts`). `parseDeviceQuery` follows `parseMemberQuery` (`src/lib/validate/member-query.ts:16-57`) for blank and duplicate handling. `validatePlacementPut` follows `validateOccupantPut` (`src/lib/validate/seat.ts:29-43`): `isPlainObject`, the unknown-key check, `uuidOrNull`, and `expectedSeatId` required. It returns `{ seatId, role, expectedSeatId }` with `role = "secondary"` when `seatId` is null.
4. **pg-error** (`src/server/devices/pg-error.ts`), in the style of `src/server/seats/pg-error.ts:1-7`.
5. **Service** (`src/server/devices/devices.ts`, `import "server-only"`, every query via `orgQuery` with `$1 = org_id` (R6)):
   - **Reads.** `deviceRows(db, scope, sub, tier, where, values, limit)` runs one select. It does `devices d join members m on (m.org_id = d.org_id and m.id = d.owner_id)`, then `left join seats s` and `left join rooms r`, each join repeating `org_id`. It returns `m.sub = $2::uuid as mine`, ordered by `lower(d.name), d.id`. `toDto` builds `placement`, `canEdit` and `canPlace` from the rules. The filter maps `placed` → `d.seat_id is not null` and `inventory` → `d.seat_id is null`. `listDevices` fetches `limit + 1` and sets `truncated`, as `listRoomSeats` does (`seats.ts:149-179`). `getDevice` returns the DTO or 404.
   - **`placeDevice(db, scope, actorSub, tier, deviceId, v)`** runs inside `inTx`:
     1. Unlocked: the actor's member id (`select id from members where org_id = $1 and sub = $2`, as `releaseSeat` does at `seats.ts:416-421`).
     2. Unlocked: the device's `seat_id` and `owner_id`. Missing → 404.
     3. Unlocked: `select id, room_id from seats where org_id = $1 and id = any($2::uuid[])` for {old seat, target seat}. A missing target → 404.
     4. Lock the rooms: `select id, code from rooms where org_id = $1 and id = any($2::uuid[]) order by id for share`.
     5. Lock the seats: `select id, code, room_id, occupant_id from seats where org_id = $1 and id = any($2::uuid[]) order by id for update`.
     6. Lock the device: `select id, seat_id, role, owner_id from devices where org_id = $1 and id = $2 for update`. If its `seat_id` differs from step 2 → 409 `placement_changed`, because the old seat it now sits on is not locked.
     7. For a target seat: `select id from devices where org_id = $1 and seat_id = $2 and role = 'primary'`. This read is stable because the seat lock serialises every placement and every demote on that seat.
     8. Call `decidePlacement`. A refusal throws `Abort` before any write (R7). A `noop` returns the DTO.
     9. `update devices set seat_id = $3, role = $4, updated_at = now() where org_id = $1 and id = $2`.
     10. `writeAudit` with action `device.place` / `device.move` / `device.return`, entity `device`. `meta` is `{ fromSeatId, fromCode, toSeatId, toCode, role, ownerId }`: ids and codes only, no PII.
     11. Return the DTO.

     This order matches `rooms.ts:213-224`: rooms for share, then seats for update in ascending id, then devices. No member row is locked. `inTx` maps `Abort` and `deviceConflict` (around `withTx`, so the deferred trigger's COMMIT error is caught) to the refusal, and rethrows anything else.
6. **Routes**:
   - `GET /api/devices` parses `new URL(req.url).searchParams`.
   - `GET /api/devices/[id]` and `PUT /api/devices/[id]/placement` follow `src/app/api/seats/[id]/occupant/route.ts:11-26`: `isCanonicalUuid`, then `getPool`, then `readJson`, then validate, then the service with `ctx.tier`, then `apiError` or `Response.json` with no-store.

   R1: routes are the only importers of `src/server/devices/*`. `pnpm check:layers` must pass.
7. **Error codes and copy**. Add the four codes to `src/lib/api/error.ts`, and add English messages to `src/ui/copy/api.ts` (D36):
   - `placement_changed`: "This device was moved by someone else. Refresh and try again."
   - `seat_has_no_occupant`: "Only a seat with an occupant can have a primary device."
   - `owner_not_occupant`: "A primary device must belong to the person at the seat."
   - `seat_has_primary`: "This seat already has a primary device."
8. Run all Checks. Record in `impl-log.md` that `pnpm test:db` runs in CI (or locally if a DB is available).

Rules: R1 (layers), R6 (org_id `$1` on every query and join), R7 (refusals are 409/422 and come before any write; 401/403 come only from `withAuth`), R3 (no new env), R4 (no CRUD or UI in this slice), R5 (tests above). R2 does not apply because there is no migration.

## Specialist input used
- api-platform-engineer:
  - **Adopted:**
    - The endpoint set and a single `PUT /placement` verb, so the DEV-03 checks exist once.
    - The `withAuth` tier `user` with ownership decided in the service, refused as 422 (R7).
    - The lock order: rooms, then seats in id order, then the device. No member lock.
    - Mapping the 23505/23514 backstops in `devices/pg-error.ts` and catching them around `withTx`.
    - No auto-demote.
    - The permission matrix.
    - The list cap with `truncated`.
    - The audit actions `device.place` / `device.move` / `device.return`.
  - **Adopted with change:**
    - `expectedSeatId` is **required**, not optional, to mirror `expectedOccupantId` (`validate/seat.ts:36`). The UI always knows the current placement.
    - The primary refusal is split into three codes, which answers its Q4. The UI shows a distinct, actionable message for each.
  - **Deferred:**
    - The `ownerId` list filter is not needed by the ticket (R4).
    - CRUD, MAC normalisation and `device_placed` move to SIM-013.1.
- frontend-developer:
  - **Adopted:**
    - `canEdit`/`canPlace`/`mine` computed on the server in the DTO. The session has no member id.
    - Server-side `?placement=` filter.
    - Placement rules in `src/lib/devices/rules.ts`.
  - **Deferred to SIM-013.2/.3:**
    - All UI files, the shared member picker move, and `DeleteDeviceDialog`.
  - **Not adopted:**
    - The DTO field name `seat`. It is renamed `placement` to match DEV-02's wording, and it carries `roomId` too.

## Assumptions
1. **Cannot-seat seats accept devices.** Spec SEA-01 says a cannot-seat seat "cannot be assigned or requested", which is about occupants. No refusal code is added. Ming can ask for a refusal later.
2. **Only an Admin creates a device for another member** (DEV-01 is explicit). A Manager creates only their own. This lives in `canCreateFor` now and is enforced in SIM-013.1.
3. **A Manager+ may still move or return devices of a deactivated owner.** Deactivation already returns placed devices (SIM-011). A primary is impossible anyway, because a deactivated member occupies no seat and the DB trigger enforces it.
4. **Secondary placement on an empty seat is allowed** (DEV-03: "Secondary placement has no ownership check").
5. **Moving a primary off seat A leaves A without a primary.** Nothing is promoted.
6. **List is bounded rather than paged** (cap 1000 with `truncated`). This fits spec §8 "paginated or bounded" and the expected size of "hundreds".
7. **Device detail is `GET /api/devices/[id]`.** Whether the UI shows it as a row plus dialog or a separate view is decided in SIM-013.2.
8. **Hotspots.** `src/lib/api/error.ts` and `src/ui/copy/api.ts` are edited by most API tickets. No other ticket is currently `IN_PROGRESS`, `REVIEW` or `DONE` (SIM-011.2 is `ESCALATED`; UI only). SIM-014 (BACKLOG) will touch the same two files and the seat lock order, so a rebase is likely if they overlap.
9. **The audit screen accepts free-text actions.** `src/ui` has no action enum (grep for `seat.release` only hits server code), so `device.*` actions need no copy change.

## Blocking questions
None.

## Split proposal
The whole ticket is about 750 source lines on the API and 900 on the UI, excluding tests. That is well over one cycle. Proposed slices (sub-IDs are free in `work/backlog.md`):

| Slice | Scope | Closes | Depends on |
|---|---|---|---|
| **SIM-013 (this plan)** | Pure rules and permission matrix, device list/detail read API with `placement`, `PUT /api/devices/[id]/placement` (place, lend, move, return), 4 error codes. About 480 source lines plus tests. | AC1, AC2, AC5; API side of AC4 | SIM-012 |
| SIM-013.1 | Device CRUD API: `POST /api/devices` (own member; Admin for anyone via `canCreateFor`; `member_not_assignable` for an inactive owner), `PATCH /api/devices/[id]` (owner or Admin; `ownerId` → 400), `DELETE /api/devices/[id]` (owner or Admin; 409 `device_placed` while placed, D31). MAC normalisation in `src/lib/validate/device.ts` (accepts `-`, `:`, `.` forms and mixed case; stores lowercase colon form; blank → null), caps on name, type and inventory number, and 23505 → `inventory_number_taken` / `mac_taken`. | AC3; DEV-01 | SIM-013 |
| SIM-013.2 | Devices page UI: `DevicesPage`/`DevicesView`/`DeviceTable` with all/placed/inventory filter, `DeviceFormDialog` (type datalist, D37; owner picker for Admin only), `DeleteDeviceDialog` with "Move to inventory" (D31), `devices-api.ts`, `useDevices.ts`, `src/ui/copy/devices.ts`, `src/app/(app)/devices/page.tsx`. | UI of AC4; D31 UI | SIM-013.1 |
| SIM-013.3 | `PlaceDeviceDialog` (seat picker, role select with primary offered only when allowed, lend/move/return), row actions gated by `canPlace`. Ming's manual check: lend and move between seats. | ticket Test plan "Manual" | SIM-013.2 |

The orchestrator adds the SIM-013.1..3 rows to the board on `main`.
