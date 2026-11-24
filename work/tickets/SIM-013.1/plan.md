Status: READY

# Plan: SIM-013.1 Device create, edit and delete API

This is slice 2 of 4 of SIM-013, as set out in `work/tickets/SIM-013/plan.md` → Split proposal. The slice is API only. It adds `POST /api/devices`, `PATCH /api/devices/[id]` and `DELETE /api/devices/[id]`, MAC normalisation and length caps in the device validator, and four new error codes. It needs no schema change. It fits in one cycle: about 330 source lines plus tests.

## Scope summary
From `docs/spec-v1.md` §6 DEV-01 (lines 259-267):
- "A device has type, inventory number (unique), MAC (unique if set; format checked), name and owner (exactly one member)."
- "A User or Manager creates devices only for their own member and edits or deletes only their own devices. An Admin can do this for any member. Editing or deleting a device: its owner or an Admin only (D19)."
- "New devices start in inventory. Editing a device cannot change its owner (seatMGT)."
- "Deleting a device that is placed at a seat is blocked: a warning says it must go back to inventory first and offers "Move to inventory"; delete is allowed once it is in inventory (D31)." The server side is the refusal. The warning and the offer are UI work (SIM-013.2), which uses the existing `PUT /api/devices/[id]/placement`.
- DEV-01 line 260: "A device type is picked from a suggested list (PC, Laptop, Monitor, IP phone, Other) or typed freely (D37)." So the server keeps the type as free text.

DEV-02 is already done on the API side in SIM-013. New and edited devices return the same `DeviceDto`, with `placement`.

From `work/decisions.md`:
- D19: "editing/deleting a device is owner or Admin only."
- D31: "A placed device cannot be deleted: warn, offer "move to inventory", then allow delete."
- D37: "Device type: suggested list (PC, Laptop, Monitor, IP phone, Other) plus free text."

From the ticket scope: `member_not_assignable` for an inactive owner, `ownerId` in a PATCH body is a 400, the MAC forms `-` `:` `.` in mixed case are stored as lowercase colon form (blank → null), there are caps on name, type and inventory number, and a 23505 maps to 409 `inventory_number_taken` / `mac_taken`.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Deleting a placed device is refused (409 `device_placed`) until it is in inventory. | `src/server/devices/devices.db.test.ts` › "delete: placed → 409 device_placed and row kept; after return to inventory the delete succeeds (204 path), audit device.delete; a deleted device then answers 404 to get and to place". The order is unit-tested in `devices.test.ts` › "deleteDevice: not_allowed is decided before device_placed; refusals write nothing". |
| 2 | A User or Manager creates, edits and deletes only their own devices; an Admin can do this for any member. | `devices.db.test.ts` › "create permission matrix", "edit permission matrix", "delete permission matrix" (each cell listed under Tests). The pure rules are already covered by `src/lib/devices/rules.test.ts` (`canEdit`, `canCreateFor`). |
| 3 | Different spellings of one MAC are stored the same way, and a duplicate MAC or inventory number is a 409, not a 500. | Unit: `src/lib/validate/device.test.ts` › "normalizeMac: …". DB: `devices.db.test.ts` › "uniqueness: duplicate inventory number → 409 inventory_number_taken; same MAC in another spelling → 409 mac_taken; …" (create and PATCH). Mapping: `src/server/devices/pg-error.test.ts` › "maps devices_org_inventory_number_key and devices_org_mac_key". |
| 4 | Unit and DB tests cover the permission matrix, the MAC normaliser and the D31 refusal. | `pnpm test` runs `device.test.ts`, `pg-error.test.ts`, `devices.test.ts`, `devices-routes.test.ts`. `pnpm test:db` runs in CI and covers `devices.db.test.ts`. |

These checks must all be green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. `pnpm test:db` must be green in CI before PASS (R5). This was the follow-up from the SIM-013 security review.

## Ming verification after merge
None. The slice is API only, and CI covers the DB behaviour. The manual checks come with the UI in SIM-013.2.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/devices/types.ts` | Change line 1 to `DEVICE_LIMITS = { list: 1000, name: 120, type: 60, inventoryNumber: 60 }`. Add `DeviceCreateValue` and `DevicePatchValue`. | The caps are shared with the later UI (R1: lib). | no |
| `src/lib/validate/device.ts` | Add `normalizeMac`, `validateDeviceCreate` and `validateDevicePatch`, plus a local `text(v, max)` helper. | Boundary validation and MAC normalisation (ticket scope). | no |
| `src/lib/validate/device.test.ts` | Add cases (see Tests). | AC3, AC4 | no |
| `src/server/devices/pg-error.ts` | Map 23505 `devices_org_inventory_number_key` → `inventory_number_taken` and 23505 `devices_org_mac_key` → `mac_taken`. Widen the return type to `DeviceConflictCode`. | Duplicates become 409, not 500 (AC3). | no |
| `src/server/devices/pg-error.test.ts` | Add the two mappings, plus an unrelated 23505 constraint mapping to `null`. | AC3 | no |
| `src/server/devices/devices.ts` | Widen `Refusal.code` (lines 26-30). Add `createDevice`, `updateDevice` and `deleteDevice`. Change line 229 so that `!cur[0]` → `notFound`. Add an owner-immutability comment at line 185. | Service layer (R6, R7, audit). | no |
| `src/server/devices/devices.test.ts` | Add fake-db tests (see Tests). | R6, R7, the SQL whitelist. | no |
| `src/server/devices/devices.db.test.ts` | Add a `describe("devices (db): create / edit / delete")` block, reusing `world()` (lines 34-45). | AC1-AC4 | no |
| `src/app/api/devices/route.ts` | Add `POST` (tier `user`), which returns 201. | Create endpoint | no |
| `src/app/api/devices/[id]/route.ts` | Add `PATCH` (200) and `DELETE` (204), both tier `user`. | Edit and delete endpoints | no |
| `src/app/api/devices/devices-routes.test.ts` | Add `createDevice`/`updateDevice`/`deleteDevice` to the hoisted mock (lines 3-7), plus the new route cases. | Route contract | no |
| `src/lib/api/error.ts` | Add `device_placed`, `inventory_number_taken` and `mac_taken` to `API_ERROR_CODES` (after line 33). | New domain refusals | no |
| `src/ui/copy/api.ts` | Add the three messages after line 39. Without them `satisfies Record<ApiErrorCode, string>` fails typecheck. | D36 | no |

`src/app/api/routes-guarded.test.ts` discovers every route by itself, so it needs no edit. No file matches a High path. The `ticket.md` Gate (plan-approval) comes from the `high-paths+P1` policy, because the ticket is P1.

## Data model / migration
None. `db/migrations/20261120150000_init.sql:113-136` already has every column, the non-blank checks (lines 125-127), the MAC format check `^([0-9a-f]{2}:){5}[0-9a-f]{2}$` (line 128), `devices_org_inventory_number_key unique (org_id, inventory_number)` (line 131) and the partial unique index `devices_org_mac_key on devices (org_id, mac) where mac is not null` (line 136). No table has a foreign key to `devices` (grep `references devices` finds nothing), so a plain `delete` is safe. The caps live in the validator only, so R2 does not apply.

## API contract
Every route uses `withAuth(..., { tier: "user" })`, `dynamic = "force-dynamic"` and `Cache-Control: no-store`. The order inside the handler copies `src/app/api/rooms/[id]/route.ts:13-42`: uuid check (404), then pool (503), then `readJson` and the validator (400), then the service. 401/403 come only from `withAuth`, and the service returns only 404/409/422 (R7).

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `/api/devices` | `{ name, type, inventoryNumber, mac?: string \| null, ownerId?: uuid }`. Any other key is a 400. | 201 `DeviceDto`, created in inventory (`placement: null`, role secondary) | 400 `invalid_request`. 404 `not_found` (ownerId unknown or in another org). 409 `inventory_number_taken`, `mac_taken`. 422 `not_allowed` (non-Admin with another member's `ownerId`), `member_not_assignable` (owner deactivated), `no_linked_member` (caller has no member row and gave no `ownerId`). 503. | Self: any member. Another member: Admin (`canCreateFor`). |
| PATCH | `/api/devices/[id]` | A non-empty partial of `{ name, type, inventoryNumber, mac }`. `mac: null` or `""` clears it. `ownerId` or any other key (`seatId`, `role`, …) is a 400. | 200 `DeviceDto`. This includes a no-op, which writes nothing. | 400. 404 (bad uuid, missing, other org). 409 `inventory_number_taken`, `mac_taken`. 422 `not_allowed`. 503. | Owner or Admin (`canEdit`, D19) |
| DELETE | `/api/devices/[id]` | none | 204, empty body | 404. 409 `device_placed`. 422 `not_allowed`. 503. | Owner or Admin (`canEdit`, D19) |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/validate/device.test.ts` › "normalizeMac: `AA:BB:CC:DD:EE:FF`, `aa-bb-cc-dd-ee-ff`, `AaBb.CcDd.EeFf`, `aabbccddeeff` all → `aa:bb:cc:dd:ee:ff`; surrounding spaces trimmed; blank/whitespace → null; every accepted output matches `^([0-9a-f]{2}:){5}[0-9a-f]{2}$`" | AC3 |
| `device.test.ts` › "normalizeMac rejects: mixed separators (`aa:bb-cc:dd:ee:ff`), 5 or 7 groups, 11/13 hex digits, non-hex (`gg:…`), inner spaces, Cisco with 2-digit groups, non-strings (number, object)" | AC3 |
| `device.test.ts` › "validateDeviceCreate: trims, NFC; Vietnamese diacritics kept (`Máy in tầng 3`); name 120 code points ok / 121 invalid; type 60 / 61; inventoryNumber 60 / 61; whitespace-only invalid; control or format characters (`\n`, `\t`, `​`) invalid; missing name/type/inventoryNumber invalid; mac absent/null/blank → null; ownerId canonical uuid or absent, non-canonical invalid; unknown key, array or null body invalid" | AC3, Domain focus |
| `device.test.ts` › "validateDevicePatch: single field ok; mac null and mac '' clear; empty body invalid; `ownerId` (even alone) invalid; `seatId`/`role` invalid; bad value in any field invalid" | DEV-01 "cannot change its owner" |
| `src/server/devices/pg-error.test.ts` › "maps devices_org_inventory_number_key → inventory_number_taken and devices_org_mac_key → mac_taken; another 23505 constraint → null" | AC3 |
| `src/server/devices/devices.test.ts` › "createDevice: non-Admin with another ownerId → 422 not_allowed and no insert/audit; owner row read `for share`; insert has seat_id null and role secondary" | AC2, R7 |
| `devices.test.ts` › "updateDevice: SET clause only names whitelisted columns; values are parameters; no-op patch (all values equal) issues no update and no audit" | SQL safety |
| `devices.test.ts` › "deleteDevice: not_allowed is decided before device_placed; refusals write nothing (no delete, no audit)" | AC1, R7 order |
| `devices.test.ts` › "create/update/delete: every query passes org_id as $1" | R6 |
| `devices.test.ts` › "placeDevice: device gone at the locked read → 404 not_found" | changed line 229 |
| `src/server/devices/devices.db.test.ts` › "create permission matrix: own device as User/Manager/Admin → 201 path, in inventory, audit device.create; Admin for another member → ok; User/Manager for another → 422 not_allowed; deactivated owner → 422 member_not_assignable; unknown ownerId and another org's member → 404" | AC2 |
| `devices.db.test.ts` › "edit permission matrix: owner edits own; User/Manager editing another's → 422 and row unchanged; Admin edits another's; edit of a placed device keeps its placement; audit device.update lists the changed fields only" | AC2 |
| `devices.db.test.ts` › "delete permission matrix: owner deletes own inventory device; User/Manager deleting another's → 422; Admin deletes another's" | AC2 |
| `devices.db.test.ts` › "delete: placed → 409 device_placed and row kept; after return to inventory the delete succeeds, audit device.delete; a deleted device then answers 404 to get and to place" | AC1, D31 |
| `devices.db.test.ts` › "uniqueness: duplicate inventory number → 409 inventory_number_taken (create and patch); same MAC in another spelling → 409 mac_taken; two devices with null MAC ok; the same MAC and inventory number in another org ok" | AC3 |
| `devices.db.test.ts` › "delete and place race: delete holds the device lock, place waits (`waitForLockWait`), delete commits → place answers 404; no 500" | D31 race |
| `src/app/api/devices/devices-routes.test.ts` › "POST/PATCH/DELETE call the service with ctx.scope, ctx.sub, ctx.tier; POST 201, PATCH 200, DELETE 204, all no-store" | route contract |
| `devices-routes.test.ts` › "PATCH/DELETE non-uuid id → 404 without calling the service; bad JSON or invalid body (incl. `ownerId` on PATCH) → 400; refusal → apiError(status, code)" | route contract, R7 |

## Approach
1. **Types** (`src/lib/devices/types.ts`):
   - `DEVICE_LIMITS = { list: 1000, name: 120, type: 60, inventoryNumber: 60 } as const`.
   - `DeviceCreateValue = { name: string; type: string; inventoryNumber: string; mac: string | null; ownerId: string | null }`.
   - `DevicePatchValue = Partial<{ name: string; type: string; inventoryNumber: string; mac: string | null }>`.
2. **Validator** (`src/lib/validate/device.ts`), reusing `isPlainObject` (line 24) and the `Validated` type:
   - `normalizeMac(v: unknown): string | null | undefined`. `undefined` means invalid and `null` means blank, as `optionalText` does in `room.ts:32-39`. Non-string and non-null input is `undefined`. Trim it, and an empty result is `null`. Test the input against four anchored, case-insensitive regexes, one per form: `^([0-9a-f]{2}:){5}[0-9a-f]{2}$`, `^([0-9a-f]{2}-){5}[0-9a-f]{2}$`, `^([0-9a-f]{4}\.){2}[0-9a-f]{4}$` and `^[0-9a-f]{12}$`. Then remove `[:.-]`, lowercase it, and re-chunk it as `xx:xx:xx:xx:xx:xx`. Do not use a strip-then-count approach.
   - `text(v, max)` follows `normalizeDisplayName` in `member.ts:9-27`, minus the whitespace collapse so inner spacing of inventory numbers is kept. Steps: string only, `normalize("NFC").trim()`, non-empty, reject `[\p{Cc}\p{Cf}]` (u flag), and at most `max` code points (`[...s].length`). Otherwise `null`.
   - `validateDeviceCreate(body)` allows only the keys `name`, `type`, `inventoryNumber`, `mac` and `ownerId`. Unknown key → invalid, as in `validatePlacementPut` (line 31). `ownerId` is absent → `null`, or `isCanonicalUuid`. It returns the `field` on failure, like the other validators.
   - `validateDevicePatch(body)` allows only the keys `name`, `type`, `inventoryNumber` and `mac`. `ownerId` falls under the unknown-key rule. It requires at least one key, as `validateRoomPatch` does (`room.ts:85`).
3. **pg-error.** Export `type DeviceConflictCode = "seat_has_primary" | "owner_not_occupant" | "inventory_number_taken" | "mac_taken"`. Add two 23505 branches keyed on the exact names from `init.sql:131` and `:136`.
4. **Service** (`src/server/devices/devices.ts`). Every query goes through `orgQuery` with `$1 = org_id` (R6). Every refusal is thrown as `Abort` before any write (R7).
   - `Refusal.code` becomes `"not_found" | PlacementRefusalCode | DeviceConflictCode | "device_placed" | "member_not_assignable" | "no_linked_member"`.
   - **`createDevice(db, scope, actorSub, tier, v: DeviceCreateValue)`** runs in `inTx`:
     1. Look up the actor (unlocked): `select id from members where org_id = $1 and sub = $2`.
     2. `ownerId = v.ownerId ?? me?.id`. If there is none → 422 `no_linked_member`, as in `requests.ts:111`.
     3. `canCreateFor(tier, ownerId === me?.id)` false → 422 `not_allowed`. This comes before the owner lookup, so a non-Admin does not learn whether a member id exists.
     4. Lock the owner: `select id, status from members where org_id = $1 and id = $2 for share`, as in `seats.ts:395-401`. Missing → 404. Status other than `active` → 422 `member_not_assignable`.
     5. Insert with the select-from-subselect form of `rooms.ts:92-99` (the orgQuery guard): `insert into devices (org_id, name, type, inventory_number, mac, owner_id) select o.org_id, $2, $3, $4, $5, $6::uuid from (select $1::uuid as org_id) o where o.org_id = $1::uuid returning id`. `seat_id` defaults to null and `role` defaults to `'secondary'`.
     6. `writeAudit` action `device.create`, entity `device`, meta `{ inventoryNumber, ownerId }`.
     7. `reload`.
   - **`updateDevice(db, scope, actorSub, tier, id, patch)`**:
     1. Look up the actor.
     2. `select id, name, type, inventory_number, mac, owner_id from devices where org_id = $1 and id = $2 for update`. Missing → 404.
     3. `canEdit(tier, me?.id === owner_id)` false → 422 `not_allowed`.
     4. Take `COLUMNS = [["name","name"],["type","type"],["inventoryNumber","inventory_number"],["mac","mac"]] as const`, then keep the supplied keys whose value differs from the locked row. If none are left → `reload` (no-op).
     5. Otherwise run `update devices set <col> = $n, …, updated_at = now() where org_id = $1 and id = $2`. The column names come only from the constant. The pattern is `rooms.ts:138-145`.
     6. Audit `device.update` with meta `{ fields: [...] }`. When the inventory number changed, also add `{ from, to }` for it.
     7. `reload`.
     Only the device row is locked. Editing does not touch placement, so the lock order stays acyclic with `placeDevice`, which takes the device lock last.
   - **`deleteDevice(db, scope, actorSub, tier, id): Promise<Result<null>>`**:
     1. Look up the actor.
     2. `select inventory_number, owner_id, seat_id from devices where org_id = $1 and id = $2 for update`. Missing → 404.
     3. `!canEdit` → 422 `not_allowed`. Permission comes first, as in `decidePlacement`.
     4. `seat_id !== null` → 409 `device_placed` (D31).
     5. `delete from devices where org_id = $1 and id = $2`.
     6. Audit `device.delete` with meta `{ inventoryNumber, ownerId }`.
     The device lock serialises the delete against `placeDevice`, which also locks the device `for update`, so a place and a delete cannot both win.
   - **`placeDevice` edits.** Line 229 becomes `if (!cur[0]) throw new Abort(notFound); if (cur[0].seat_id !== dev[0].seat_id) throw refuse(409, "placement_changed");`, so a device deleted mid-flight answers 404. At line 185 add a comment that the unlocked `owner_id` read is safe only because `owner_id` is immutable (DEV-01, SIM-013.1 PATCH rejects `ownerId`), so any future transfer must re-read it under the device lock. This settles the SIM-013 security 🟡.
5. **Routes.**
   - `POST` in `src/app/api/devices/route.ts` copies `rooms/route.ts:22-35`, with tier `user`, and passes `ctx.tier`.
   - `PATCH` and `DELETE` in `src/app/api/devices/[id]/route.ts` copy `rooms/[id]/route.ts:13-42`. They have no `force` param: D31 is a refusal, and the UI moves the device through `PUT …/placement` first.
   - Add `const NO_STORE`.
   - R1: only these routes import `src/server/devices/*`.
6. **Error codes and copy** (D36):
   - `device_placed`: "This device is at a seat. Move it to inventory before deleting it."
   - `inventory_number_taken`: "Another device already has this inventory number."
   - `mac_taken`: "Another device already has this MAC address."
7. Run all Checks. Record in `impl-log.md` whether `pnpm test:db` ran locally or only in CI.

Rules:
- R1: layers as above.
- R6: `org_id` is `$1` on every query. The owner lookup is org-scoped, so a cross-org `ownerId` is a 404.
- R7: refusals are 404/409/422, and every refusal comes before the insert, update, delete or audit.
- R3: no new env.
- R4: no UI and no bulk import.
- R5: the tests above.
- R2 does not apply.

## Specialist input used
api-platform-engineer (`consult-api-platform-engineer.md`):
- **Adopted:**
  - The owner is immutable, and any `ownerId` in a PATCH is a 400. This is also DEV-01's wording ("Editing a device cannot change its owner").
  - Unknown keys are a 400. The existing validators do this (`validatePlacementPut` line 31, `room.ts:41-47`), so this answers its Q5.
  - The create flow, with `for share` on the owner and `member_not_assignable`. An unknown or cross-org owner is a 404.
  - The device-only lock for edit and delete.
  - Permission is checked before `device_placed`.
  - No server-side `force` delete.
  - The per-form MAC regexes, and the test that every output matches the DB regex.
  - Caps of 120/60/60, trimmed, counted in code points, with control characters rejected.
  - The type stays free text (D37).
  - The two constraint mappings, plus an unrelated 23505 → null. The constraint names were confirmed from `init.sql:131,136`.
  - The 409 does not echo the conflicting device.
  - The no-op PATCH writes nothing.
  - The DB test list.
- **Adopted with change:**
  - **Audit meta is codes and ids only:** `{inventoryNumber, ownerId}` on create and delete, and `{fields}` on update. `src/server/audit/write.ts:6` says "`meta` holds codes, field names and counts only". So the device name, type and MAC (its Q8) stay out of the audit, and the update meta lists field names, not values. The exception is the inventory number, which is a code.
  - **The permission check comes before the owner lookup on create**, so a non-Admin cannot probe member ids (404 vs 422).
  - **A caller with no member row gets `no_linked_member`** on create, as in `requests.ts:111`.
- **Bare 12-hex-digit MAC accepted** (its Q4). The input is unambiguous, and the ticket's list does not exclude it. This is noted under Assumptions.
- **`!cur[0]` → 404** in `placeDevice` (its Q7) is taken into this ticket. It is a one-line change in a file this ticket already edits, and the new race test depends on it.
- **Not adopted:**
  - Full before/after snapshots in the audit (see above).
  - Changing `placeDevice` to use the locked `owner_id`. The owner is now immutable by construction, so a comment is enough (R4).

## Assumptions
1. **Inventory number uniqueness is case-sensitive**, as the DB index is (`init.sql:131`). `AB-1` and `ab-1` are distinct, and the value is stored as typed (trimmed, NFC). A case-insensitive rule would need a migration, so it would be a follow-up if Ming wants it (consult Q3).
2. **A bare MAC (`aabbccddeeff`) is accepted** as well as the `:`, `-` and `.` forms (consult Q4). Mixed separators are rejected. Multicast, broadcast and all-zero MACs are accepted.
3. **Caps:** name 120, type 60, inventory number 60 code points (consult Q2). Lowering them later needs no migration.
4. **An Admin may edit or delete a device whose owner is deactivated.** A deactivated owner cannot act at all, because `withAuth` answers `member_deactivated` first (consult Q6). Creating a device for a deactivated member is refused (ticket scope).
5. **The MAC is not written to the audit** (consult Q8). It is visible in the device row and the DTO.
6. **The `member_not_assignable` copy stays as is** ("This member can't be assigned to a seat."). That wording is seat-specific. SIM-013.2 can show a device-specific message from `src/ui/copy/devices.ts` when it handles this code on the device form. That way this API slice does not change the seat UI text.
7. **POST answers 201 without a `Location` header**, as `rooms/route.ts:32` does.
8. **Hotspots.** No other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board. `src/lib/api/error.ts` and `src/ui/copy/api.ts` are edited by most API tickets, so a rebase may be needed if another API ticket merges first.

## Blocking questions
None.

## Split proposal
None. This ticket is itself slice 2 of the SIM-013 split, and it fits in one cycle (about 330 source lines without tests).
