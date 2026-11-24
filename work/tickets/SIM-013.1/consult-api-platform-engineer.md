SIM-013.1 consult (read-only). I read the ticket, the SIM-013 API consult, `src/server/devices/devices.ts`, `src/lib/devices/{rules,types}.ts`, `src/server/devices/pg-error.ts`, the device routes, `seats.ts` setOccupant (lines 385-414) and D19/D31/D37. I did not open `src/lib/validate/device.ts` beyond its exports, `docs/spec-v1.md`, or the DB migration (I rely on the SIM-013 consult for the DDL).

## Findings
- **Reusable already in place.**
  - `canEdit`, `canCreateFor` and `canPlace` are in `src/lib/devices/rules.ts`. `DeviceDto` carries `canEdit`.
  - `inTx`, `Abort` and `refuse` are in `devices.ts`, and `reload` returns the DTO.
  - The route pattern is in `src/app/api/devices/[id]/placement/route.ts`: UUID check (404), pool (503), `readJson` and a validator (400), then the service result.
- **`[id]/route.ts` has GET only, and `route.ts` has GET only.** POST, PATCH and DELETE are new.
- **`Refusal.code` is typed** as `"not_found" | PlacementRefusalCode`. It must be widened with `device_placed`, `member_not_assignable`, `inventory_number_taken` and `mac_taken`.
- **`inTx` maps only the two placement constraints** through `deviceConflict`. The mapping needs the uniqueness constraint names added. I did not read the DDL, so the names must be confirmed from the migration. Postgres auto-names would be `devices_org_id_inventory_number_key` for the table unique and a custom name for the partial MAC index. The pg-error test must pin them.
- **The unique-violation timing is not deferred.** 23505 on inventory number or MAC fires at statement time inside the tx, and `inTx` already wraps `withTx`, so the existing structure catches it.
- **The security 🟡 on `placeDevice`.** It reads `owner_id` before the device lock (lines 185-190, and `dev[0].owner_id` is used at lines 246-248 and 275). If PATCH never changes `owner_id`, that read is stable and the 🟡 is harmless. This is a second reason to keep owner immutable.
- **Design of the `placeDevice` read.** It also reads `seat_id` before the lock and handles that by re-reading under lock (`placement_changed`). `owner_id` has no equivalent re-read.

## Recommendations

### Owner immutability decision
Keep `owner_id` immutable after create: no PATCH path, no ownership transfer.
- It is DEV-01 and the ticket scope.
- It keeps `placeDevice`'s pre-lock `owner_id` read safe by construction.
- It avoids the primary/occupant trigger being re-evaluated on an owner change.
- Reassignment, if ever needed, belongs in a separate ticket that locks the device before reading the owner.
- Add a code comment in `placeDevice` at line 185 stating this dependency, and add a test that a PATCH with `ownerId` is 400 (see below).

### POST /api/devices
- **Tier:** `user`. **Body:** `{name, type, inventoryNumber, mac?, ownerId?}`.
- **Response:** 201 with the full `DeviceDto` and `Cache-Control: no-store`. A `Location` header is optional.
- **Unknown keys:** reject unknown keys with 400 (consistent with the `ownerId`-on-PATCH rule). Check whether the existing validators do this and copy their behaviour.
- **Service `createDevice(db, scope, actorSub, tier, v)` in one `inTx`:**
  1. Resolve the actor: `select id from members where org_id=$1 and sub=$2`.
  2. `ownerId = v.ownerId ?? me.id`.
  3. If `!canCreateFor(tier, ownerId === me.id)`, throw `refuse(422, "not_allowed")`.
  4. Owner check, only when `ownerId` is not the actor's own id:
     - `select id, status from members where org_id=$1 and id=$2 for share`.
     - Missing: 404 `not_found`. The SIM-013 consult says cross-org and unknown ids look the same. Unknown `ownerId` is 404, not 422 and not 400.
     - Not active: 422 `member_not_assignable` (same as `setOccupant`, `seats.ts:401`).
  5. For a self-create, still verify the actor's own status. The auth wrapper's member gate already returns `member_deactivated` before the handler, so this is redundant and can be skipped. The `for share` lock keeps the owner from being deactivated mid-insert (same pattern as `setOccupant`).
  6. `insert ... returning id` with `seat_id` null and `role` secondary (inventory).
  7. `writeAudit` action `device.create`, meta `{inventoryNumber, ownerId, name, type}` (see audit).
  8. `reload` and return.
- **Order matters for R7:** permission (422 `not_allowed`) must be decided before any write, which it is.
- **Manager creating for another member** stays 422 `not_allowed`, per DEV-01 and `canCreateFor`. The ticket text ("Admin for any member") agrees. This answers open question 2 from SIM-013.

### PATCH /api/devices/[id]
- **Body:** partial of `{name, type, inventoryNumber, mac}`.
  - Require at least one key, else 400.
  - `mac: null` or blank clears the MAC. `mac` absent leaves it unchanged.
  - Any `ownerId` key (even the same value), or any other unknown key such as `seatId` or `role`, is 400 `invalid_request`. Placement goes through the placement route only.
- **Service `updateDevice(db, scope, actorSub, tier, id, v)`:**
  1. Load the actor and the device without a lock to learn the owner. This is safe because the owner is immutable.
  2. `select ... from devices where org_id=$1 and id=$2 for update`. Missing: 404.
  3. Compute `isOwner`. If `!canEdit(tier, isOwner)`, 422 `not_allowed`.
  4. Update only the supplied columns, set `updated_at = now()`, and build the SQL from a fixed column whitelist, never from body keys (R3/SQL safety with hand-written SQL).
  5. Audit `device.update` with before and after only for the changed fields (see audit).
  6. `reload`.
- **Lock order:** the device row only, no seat or room lock. Editing name, type, inventory number or MAC does not touch the placement invariants, and `placeDevice` takes the device lock last, so there is no cycle.
- **No-op edits:** an edit where every supplied value equals the stored value is still 200, writes no audit row and does not bump `updated_at`. If that is more than the plan wants, bump anyway; just keep it consistent and tested.
- **A placed device can be edited.** This is not restricted by D31, which covers delete only.

### DELETE /api/devices/[id]
- **Tier:** `user`. **Response:** 204, no body, or whatever the room delete returns. Copy the room delete for consistency.
- **Service `deleteDevice`:**
  1. Load the actor.
  2. `select ... for update` on the device (404 if missing).
  3. `!canEdit` -> 422 `not_allowed`.
  4. If `seat_id` is not null, 409 `device_placed`.
  5. Delete the row, audit `device.delete` with a snapshot (`name`, `type`, `inventoryNumber`, `mac`, `ownerId`), because the row is gone afterwards.
- **Permission is checked before the placement check.** A non-owner then does not learn the placement status from a different error. Use the same order as `decidePlacement` (permission first).
- **D31 race:** the device lock is the serialiser. `placeDevice` takes the device row `for update` as well, so a place and a delete cannot interleave. If the place commits first, the delete sees `seat_id` set and refuses. If the delete commits first, `placeDevice`'s locked re-read returns zero rows and the code at `devices.ts:229` (`!cur[0]`) answers `placement_changed`. Prefer 404 there, and consider changing `!cur[0]` to throw `notFound`. This is a small fix in the existing file.
- **No cascade needed.** I did not check for FKs that reference `devices`. Confirm that none exist before relying on a bare delete.
- **D31 UI contract.** The server only refuses. "Warn and offer move to inventory" is the UI's job (SIM-013.2/3), through the existing `PUT .../placement` with `seatId: null`. No server-side `force` flag, because that would hide a placement change inside a delete and bypass `expectedSeatId`.

### MAC normalisation (`src/lib/validate/device.ts`)
Export a pure `normalizeMac(input: string): string | null | "invalid"` or a `Validated` equivalent.
1. Trim. If the result is empty, return null.
2. Accept exactly these shapes (case-insensitive):
   - `aa:bb:cc:dd:ee:ff`
   - `aa-bb-cc-dd-ee-ff`
   - `aabb.ccdd.eeff` (Cisco, 3 groups of 4)
   - Optionally also bare `aabbccddeeff`. The ticket does not list bare hex. Decide with Ming. I would accept it, since it is unambiguous.
3. Do not accept mixed separators in one value, and do not accept partial or overlong values. The check should be one regex per form, then strip the separators and re-chunk into `xx:xx:...` lowercase. A "strip everything non-hex then check length 12" approach would accept garbage such as `zz aa bb...` after the strip, and would accept stray characters. Prefer the per-form regexes.
4. The output must match the DB check `^([0-9a-f]{2}:){5}[0-9a-f]{2}$`. Add a test asserting every accepted form passes that regex.
5. Reject non-strings (number, object) as invalid. A value that is not a string and not null is 400.
6. Leave multicast, broadcast and all-zeros MACs accepted. Rejecting them would be policy the spec does not ask for.

### Length caps
In `src/lib/devices/types.ts` as `DEVICE_LIMITS`: `nameMax: 120, typeMax: 60, inventoryNumberMax: 60` (the SIM-013 consult suggested these; confirm). Trim all three, require non-blank after trim, and count characters (code points, not UTF-16 units) for the cap, so the same count applies as in the UI. Apply the cap after trimming. A cap that is too low is more annoying than one that is too high, so 120/60/60 is fine.
- Reject control characters (newline, tab) in name, type and inventory number. They break table and CSV views.
- Whitespace-only fails the non-blank rule before the DB check can raise a 23514, so it is a 400 and not a 500.
- Keep the type as free text (D37). Do not enforce the suggested list on the server.
- Case sensitivity: `unique(org_id, inventory_number)` is case-sensitive. `AB-1` and `ab-1` are distinct. This is a decision for Ming (see open questions).
- Add `ownerId` to the POST validator as an optional canonical UUID, using `isCanonicalUuid`.

### Error codes
| Case | Status | Code |
|---|---|---|
| Bad JSON, shape, MAC, caps, `ownerId` on PATCH, empty PATCH | 400 | `invalid_request` |
| Device or owner not found, bad id format | 404 | `not_found` |
| Not owner/Admin (edit, delete), or non-Admin creating for another | 422 | `not_allowed` |
| Owner not active | 422 | `member_not_assignable` |
| Delete while placed | 409 | `device_placed` |
| 23505 on inventory-number unique | 409 | `inventory_number_taken` |
| 23505 on MAC partial unique | 409 | `mac_taken` |
- Extend `deviceConflict` in `pg-error.ts` with the two new constraint names, and widen its return type and `Refusal.code`. The existing test (`pg-error.test.ts`) gets cases for both, plus an unrelated 23505 mapping to null (so it stays a 500).
- No 401 or 403 in the service (R7). These are domain refusals.
- Do not echo the conflicting device id or its owner in the 409. That leaks cross-user data. The code alone is enough.

### Audit
`writeAudit` in the same tx, with these actions: `device.create`, `device.update`, `device.delete`. Meta should be small and free of secrets.
- create: `{ownerId, inventoryNumber, name, type, mac}`.
- update: `{changes: {field: {from, to}}}` for changed fields only.
- delete: the full snapshot, since the row is gone.
- The MAC is not a secret, but it is network-identifying. The audit is org-scoped and keeps rows indefinitely (D38), so this matches the existing `ownerId` in placement meta. Flag to Ming if MACs must stay out of the audit.

### Tests
- **Unit** (`src/lib/validate/device.test.ts` or the existing rules test):
  - MAC: each accepted form, mixed case, mixed separators rejected, wrong length, non-hex, blank to null, non-string.
  - Caps: boundary (exactly max and max+1), whitespace-only, control characters.
  - PATCH: `ownerId` rejected, unknown key rejected, empty body rejected.
  - Permission rules: the existing `canEdit` and `canCreateFor` tests already cover the matrix, so add only what is missing.
- **Route tests** (`devices-routes.test.ts`): POST, PATCH and DELETE require the wrapper (a `user`-tier mark, as for GET), return 400 on a bad body and 404 on a non-UUID id, and never return 401/403 from the handler.
- **DB tests** (`devices.db.test.ts`, run by `pnpm test:db` in CI), one per matrix cell:
  - Create: own as User/Manager/Admin (ok), another as Admin (ok), another as User/Manager (422), inactive owner (422), unknown owner (404), cross-org owner (404). Created in inventory.
  - Edit and delete: own (ok), another's as User/Manager (422), another's as Admin (ok).
  - Uniqueness: duplicate inventory number (409, not 500), duplicate MAC in different spellings (409 `mac_taken`), two devices with null MAC (ok), the same MAC in a different org (ok).
  - D31: delete while placed is 409 `device_placed`, then return to inventory, then delete succeeds. Also a deleted device cannot be placed (404).
  - Edit of a placed device keeps its placement.
  - Race: parallel `deleteDevice` and `placeDevice` end in a consistent state (either order is acceptable, no 500).
  - Audit rows exist for create, update (changed fields only) and delete.
- `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check` and `pnpm test` stay green (R5). The new service code is under `src/server/devices/`, which already starts with `import "server-only"`.

## Risks
- **Constraint names are unverified.** If the unique constraint names in the DDL differ from what I guess, the 409 mapping silently falls through to a 500. The pg-error and DB tests must exercise the real constraints.
- **Owner immutability is load-bearing.** If a later ticket adds ownership transfer, the unlocked `owner_id` read in `placeDevice` becomes a real race. Leave the comment so that ticket sees it.
- **Late 401/403.** `apiFetch` re-sends once on 401/403. Any permission failure in the new code must be 422, never 403.
- **Dynamic SQL in PATCH.** Building the SET clause from the body is the one injection-prone spot. Use a fixed whitelist of column names and parameters for values.
- **MAC normalisation drift.** If the UI also normalises (for display), it must import the same lib function (R1: ui may import lib), or the two will diverge.
- **Existing rows.** The DB already stores lowercase colon MACs, so no data migration is needed. No schema change means R2 does not apply, provided the caps stay in the validator. If Ming wants DB-level caps, that needs a forward-only migration (expand then contract).
- **Stale-delete UX.** A device placed between the list load and the delete click gets 409 `device_placed`. The UI must handle it by refreshing, and this is acceptable.

## Open questions
1. **Owner immutable in PATCH** (my recommendation: yes, 400 on any `ownerId`). Confirm, since it also settles the SIM-013 security 🟡.
2. **Length caps**: are 120/60/60 acceptable?
3. **Inventory number case**: should `AB-1` and `ab-1` count as duplicates? The DB unique index is case-sensitive. A case-insensitive rule would need a migration (unique index on `lower(inventory_number)`), so I suggest leaving it as is for v1 and flagging it.
4. **Bare-hex MAC** (`aabbccddeeff`): accept or reject? I suggest accepting it.
5. **Unknown keys** on POST and PATCH: confirm 400 matches the project's other validators. (I did not check them.)
6. **Delete of a device when the owner is deactivated**: allowed for an Admin (owner or Admin rule). Confirm, and confirm that a deactivated owner cannot delete their own (they are blocked by the auth gate before the handler anyway).
7. **`!cur[0]` in `placeDevice`** currently answers `placement_changed` when the device was deleted mid-flight. Change it to 404 as part of this ticket? It is a tiny edit to SIM-013 code, but the ticket scope (R4) does not name it. Follow-up or in scope?
8. **MAC in audit meta**: keep, or omit?
