SIM-013 consult (read-only). Based on the ticket, spec DEV-01..06 and REG-03, D19/D22/D31, `src/server/seats/seats.ts`, `src/server/http/with-auth.ts`, the seat occupant route, and the devices DDL in `db/migrations/20261120150000_init.sql`. I did not read `docs/spec-v1.md` invariants 3 and 8 or seatMGT's `devices.ts`.

## Findings
- **Schema is already complete, so no migration is needed.**
  - `devices` columns: `id`, `org_id`, `name`, `type`, `inventory_number`, `mac` (nullable), `owner_id`, `seat_id` (null means inventory), `role`.
  - Constraints: name, type and inventory number must be non-blank. MAC must match `^([0-9a-f]{2}:){5}[0-9a-f]{2}$`, so it is stored lowercase and colon-separated.
  - Uniqueness: `unique(org_id, inventory_number)`, and a partial unique index on `(org_id, mac)` where mac is not null.
  - Role rules: `devices_one_primary_per_seat` is a partial unique index. A primary device must have a seat.
  - FKs: the owner FK is `on delete restrict` and the seat FK is `on delete restrict`.
  - A deferred constraint trigger, `devices_primary_owner_trg`, checks at COMMIT that a primary device's owner is the seat occupant. It raises 23514 with constraint `devices_primary_owner_is_occupant`. This is the DB re-check DEV-03 asks for.
  - There is also a mirror trigger on seats.
  - The seat code in `src/server/seats/pg-error.ts` only maps the `devices_seat_fkey` 23503.
- **API pattern to copy.**
  - Routes use `withAuth<{id}>(handler, {tier})`.
  - A handler does these steps in order: `isCanonicalUuid(id)` else 404 `not_found`; `getPool()` else 503; `readJson` and a `src/lib/validate/*` validator else 400 `invalid_request`; then a service call returning `Result<T>`. Refusals go out via `apiError(r.status, r.code)`.
  - Services live in `src/server/<area>/*.ts` and start with `import "server-only"`. They run `inTx`, which turns `Abort` into a domain refusal. Every query goes through `orgQuery(c, scope, sql, [..])` with `$1 = org_id` (R6). Every write calls `writeAudit`.
  - The auth wrapper only supplies the minimum tier. It does not know ownership. Owner-or-Admin decisions must be made in the service, after the row is loaded, and refused as 409/422. 403 is off limits there (R7).
  - `ctx.sub` is the actor. Resolve the actor's member id with `select id from members where org_id=$1 and sub=$2` (as `releaseSeat` does).
- **Reusable pieces.**
  - `demotePrimary` (not exported) and the lock helpers `lockSeat`, `lockSeatIn` and `lockRoom` in `seats.ts`.
  - The lock order, documented in the file, is member, room, seat, devices. Pure rules sit in `src/lib/seats/rules.ts` (`decide*`) with unit tests. Follow that split: pure `src/lib/devices/rules.ts` plus `src/server/devices/devices.ts`.
- **Existing device reads.** `seatRows` and the member listings already embed device refs. SIM-013 needs its own list read that left-joins seats and rooms to produce a `placement` object.
- **Tier notes.** `Tier` is user < manager < admin. `admin` is the Admin role, and "Manager+" means `atLeast(manager)`.

## Recommendations

### Endpoint contract
All routes are `withAuth`, `dynamic = "force-dynamic"`, and set `Cache-Control: no-store`. Fields are camelCase to match the existing DTOs.

| Method and path | Tier | Notes |
|---|---|---|
| `GET /api/devices?placement=all\|placed\|inventory&ownerId=` | user | Returns `{items, truncated}` with a cap, like `SEAT_LIMITS`. Order by `lower(name), id`. Each item has `id, name, type, inventoryNumber, mac, owner{id,displayName}, placement: null \| {seatId, seatCode, roomId, roomCode, role}`. |
| `POST /api/devices` | user | Body: `{name, type, inventoryNumber, mac?, ownerId?}`. 201 on success. Always created in inventory. |
| `GET /api/devices/[id]` | user | Same DTO. |
| `PATCH /api/devices/[id]` | user | Accepts `name, type, inventoryNumber, mac`. An `ownerId` in the body is rejected as 400 (DEV-01: the owner cannot change). |
| `DELETE /api/devices/[id]` | user | 204 or the same body style as the room delete. |
| `PUT /api/devices/[id]/placement` | user | Body: `{seatId: uuid\|null, role: "primary"\|"secondary", expectedSeatId?: uuid\|null}`. A null `seatId` means return to inventory. One verb covers place, lend, move and return. |

- **POST ownerId.** If `ownerId` is absent or is the caller's own member, that is allowed for everyone. If `ownerId` is another member, require Admin and check that the member is active. Otherwise answer 422 `not_allowed`.
- **PATCH and DELETE.** The caller must be the owner or an Admin. This is checked in the service.
- **Placement.** Owner, or Manager+, per D19 and D22.
- **Single placement endpoint.** It avoids separate lend, move and return verbs that duplicate the DEV-03 checks.
- **Response shape.** Return the full device DTO after the change.
- **Optional extra.** A `GET /api/devices/[id]/delete-impact` is not needed. The refusal on DELETE carries the message, and the UI already knows the placement from the list.

### Error codes (HTTP status, code)
- 400 `invalid_request`: shape, bad MAC format, a UUID in the wrong format, or `ownerId` on PATCH.
- 404 `not_found`: device, seat, or an owner outside the org. Cross-org ids look the same as missing ones.
- 409 `inventory_number_taken` and `mac_taken`: from the unique index violations 23505, mapped by constraint name. Add `src/server/devices/pg-error.ts` in the style of the seats one.
- 409 `device_placed`: delete while the device is at a seat (D31). The UI offers "Move to inventory".
- 409 `primary_requires_occupant_owner`: split into finer codes only if the UI needs them. Suggested split: `seat_no_occupant`, `not_seat_occupant` and `seat_has_primary`. A single code is simpler, and the UI only needs to show a message.
- 409 `placement_changed`: the `expectedSeatId` guard failed. It mirrors `occupant_changed` and is optional.
- 409 `seat_cannot_seat`: needs a decision (see open questions).
- 422 `not_allowed`: actor is not owner, Manager+ or Admin, as the case may be.
- 422 `member_not_assignable`: the new device's `ownerId` is not an active member.
- Never return 401 or 403 from the service (R7).

### Placement rule enforcement and concurrency
Pure `decidePlacement({actorTier, actorMemberId, ownerId, targetSeat:{occupantId, hasPrimary, cannotSeat}, role})` goes in `src/lib/devices/rules.ts` with the matrix tested. Rules:
- **Return to inventory (`seatId` null):** owner or Manager+. The role is forced to secondary.
- **Role primary:**
  - The seat must have an occupant.
  - The occupant must equal the device owner.
  - The seat must have no other primary. If the device is already the primary on the same seat, treat it as a no-op.
- **Role secondary:** no ownership check. A borrowed device (owner is not the occupant) can only be secondary, so the primary check covers it.
- **Actor:**
  - The owner may place their own device as primary or secondary on any seat.
  - A Manager+ may place any device.
  - A plain User may not place another member's device.
  - Admin is covered by the Manager+ rule.
- **Transaction order (inside `inTx`):**
  1. Take the device lock with `select ... for update`. This must follow the documented order member, room, seat, then devices. Take the device lock last, after the room and seat. That means reading `device.seat_id` unlocked first and locking its old seat as well.
  2. If the move spans two seats, lock both seats in a fixed order (by id) to avoid deadlocks.
  3. Lock the target room in `share` mode and the target seat `for update`.
  4. Re-check the rules under lock.
  5. `update devices set seat_id, role`.
  6. Audit as `device.place`, `device.move`, `device.return`, with `{from, to, role}`.
- **Do not lock the owner's member row for update.** Take `for share` only if you check the owner's status.
- **Backstops.** The partial unique index (23505 on `devices_one_primary_per_seat`) and the deferred trigger (23514 on `devices_primary_owner_is_occupant`) are the DB check required by DEV-03. Map them in `devices/pg-error.ts` to the same 409 code, not to 500. The trigger fires at COMMIT, so catch it around `withTx` and not only around the update statement.
- **Primary-slot swap.** If a device moves from seat A (primary) to seat B, the old primary slot on A is freed. When a primary move to the same seat needs to demote another primary, refuse it. Do not auto-demote, because the spec says the placement is refused.
- **Owner changes the device role in place (primary to secondary on the same seat).** Allowed through the same PUT.
- **DEV-06 stays in seats.ts**, which is already done. `releaseSeat` (REG-03 seat side) already exists. D22 for devices is covered by "return to inventory (owner)" in the placement route.

### Permission matrix
| Action | User | Manager | Admin |
|---|---|---|---|
| List or read devices | yes | yes | yes |
| Create own device | yes | yes | yes |
| Create for another member | no | no | yes |
| Edit or delete own device | yes | yes | yes |
| Edit or delete another's device | no | no | yes |
| Place, lend, move or return own device | yes | yes | yes |
| Place, lend, move or return another's device | no | yes | yes |

Tests should cover each cell of this matrix. Also cover: primary refusal reasons (no occupant, wrong owner, seat already has a primary), secondary has no ownership check, delete while placed, delete after return, the MAC normalization, and uniqueness.

### Other
- **MAC.** Normalize in `src/lib/validate/device.ts` before storing. Accept `AA-BB-...`, `AA:BB:...`, and probably `aabb.ccdd.eeff`. Store lowercase colon-separated. Treat empty or blank input as null. Check `/\S/` on name, type and inventory number to avoid the DB check erroring as 500.
- **Length caps.** Cap name, type and inventory number (for example 120, 60, 60), because the DB has no caps.
- **Type suggestions** (PC, Laptop, Monitor, IP phone, Other) are UI copy in `src/ui/copy/devices.ts`. The server stores free text (D37).
- **UI.** Page at `src/app/(app)/devices/`, components `DeviceTable` and `DeviceFormDialog` in `src/ui/devices/`, and the filter as a query param on the list route. The UI calls the API only through `apiFetch`. Layers: ui imports lib only (R1).
- **`pnpm check:layers`:** a new `src/server/devices/*` file needs `import "server-only"`.
- **Tests.** Add `devices.test.ts` for the pure rules and permissions, `devices.db.test.ts` for concurrency and constraints (run in CI via `pnpm test:db`), and a `with-auth` mark test for each new route if the existing tests enumerate routes.

## Risks
- **Lock-order deadlocks.** A device move spans two seats and the device row. A mistake in lock order against `setOccupant` or `deleteMember` (which lock member, then room, then seat, then devices) can deadlock. Mitigation: follow the documented order and add a DB test with parallel `setOccupant` and `placeDevice`.
- **Occupant race.** The occupant can change between the check and the commit. Locking the seat `for update` serializes it, and the COMMIT trigger is the last line.
- **Late 401/403.** If an ownership check returned 403, `apiFetch` would re-send once and repeat a write. Keep refusals at 409/422.
- **Silent MAC duplicates.** Different spellings of one MAC bypass the unique index unless normalized before insert.
- **Deleting a device that has history.** Audit rows stay, but `devices.owner_id` restricts member deletion. That is existing behavior.
- **List size.** An unbounded list for a large org. Use a cap with `truncated`, or add paging.

## Open questions
1. Should placing on a seat with `cannot_seat = true` be refused for devices? The spec's cannot-seat is about people. I would allow devices and flag it for Ming.
2. Does "Manager creates for another member" stay refused? Spec DEV-01 says only Admin may, so yes. Ticket scope says "any member creates their own". Confirm.
3. One `PUT /placement` versus separate `/lend`, `/move` and `/return` routes. I recommend one. Does the spec or UI copy name the three actions separately?
4. A single refusal code for primary failures, or three? Does the UI need distinct messages?
5. Should `expectedSeatId` be mandatory like `expectedOccupantId`, or optional?
6. Does the Devices list need paging or a search box in this ticket, or only the three-way filter and a cap?
7. When the owner is deactivated (SIM-011), may a Manager still move their devices? Deactivation already handles placed devices (`manage.ts` around lines 381-395), so probably yes, but confirm.
