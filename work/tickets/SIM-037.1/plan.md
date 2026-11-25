Status: READY

# Plan — SIM-037.1: Device lifecycle schema and unowned devices

Gate: plan-approval (P1, touches High path `db/migrations/**`). Ming approves the assumptions A1 to A12 with the plan.

## Scope summary
- `docs/spec-v1.md` §4 Device: "owner (member, optional; empty = org inventory, D63), expiry date and note of the current
  holding, seat (optional; empty = not placed) … serial number (unique, optional), manufacturer, brand". Rule: "Owner
  changes only through assign, transfer and return (DEV-07 to DEV-09)."
- §4 DeviceHandoff: "org, device, kind (transfer / return / extension), from member, to member (transfer), requested by,
  note, new expiry (extension), status (pending / confirmed / declined / cancelled), decided by, decided at. At most one
  pending per device."
- §5 invariant 5: "A device with no owner (org inventory, D63) is never at a seat."
- §6 DEV-01: "serial number (unique if set, trimmed, at most 100 characters), manufacturer and brand (free text, at most
  100 characters each). Owner is optional: empty means the device is in the org inventory." / "Only an Admin creates
  devices (OQ-41); a new device has no owner and is in the org inventory." / "Only an Admin deletes a device, and only
  while it is in the org inventory with no pending handoff. Deleting a device that is placed at a seat is blocked … (D31)."
- §6 DEV-02: "Every device list and device detail shows where the device is (… "in org inventory") … The Devices page
  filters by all / placed / not placed / org inventory / overdue." (this slice adds only the org inventory filter).
- §6 DEV-03: "A device in the org inventory (no owner) is never placed at a seat; the app and the DB refuse it." /
  "Secondary placement has no ownership check beyond the device having an owner."
- §11 OQ-41 default: "Admin only; Users and Managers no longer create devices (supersedes D19 for create)."
  OQ-45 default: "the migration keeps each device's owner with no expiry; no backfill."

## Acceptance criteria → verification
AC 4 is corrected (ticket wording issue, see A1): an unowned device is never at a seat (invariant 5, enforced by the new
CHECK), so seat detail and room layout `seatDevices` can never contain one. The corrected criterion is 4 below plus 4b.

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | `pnpm migrate` on a DB with existing devices succeeds; every existing device keeps its owner; `pnpm schema:check` passes. | `pnpm schema:check` against `compose.dev.yml` Postgres: new step "10 existing device keeps its owner after the lifecycle migration" (device inserted in stage 1, before the migration) passes, plus all section 10 checks below. `pnpm migrate` then `pnpm seed:dev` on the dev DB succeed. |
| 2 | POST a device as Admin creates it with `owner: null`; as Manager or User the call is refused (422 `not_allowed`). A body with `ownerId` is 400 `invalid_request`. | `devices.db.test.ts` › "create: Admin creates an unowned device (owner null, audit ownerId null); Manager and User -> 422 not_allowed, no row, no audit"; `devices-routes.test.ts` › "POST with ownerId -> 400"; `device.test.ts` › "create rejects ownerId as an unknown key". |
| 3 | Placing an unowned device at any seat is refused by the API (422 `device_unowned`) and by the DB check. | `rules.test.ts` › "unowned device: target seat -> 422 device_unowned; return to inventory stays noop"; `devices.db.test.ts` › "placing an unowned device (primary or secondary, empty or occupied seat) -> 422 device_unowned, row unchanged"; `pg-error.test.ts` maps `23514 devices_unowned_not_placed_check` to `device_unowned`; `schema:check` › "10 unowned device at a seat refused (23514 devices_unowned_not_placed_check)". |
| 4 | Device list (all and the new `unowned` filter), device detail, search and CSV export return unowned devices with `owner: null` / empty owner cells instead of dropping them. | `devices.db.test.ts` › "list/get include an unowned device with owner null, mine false, canEdit/canDelete true only for Admin, canPlace false; filter unowned returns only unowned"; `search.db.test.ts` › "an unowned device is found by name with owner null"; `export.db.test.ts` › "an unowned device is exported with empty owner name and code, Location inventory". |
| 4b | Seat detail and room layout never contain an unowned device; their code handles a null owner type-safely. | Review: `seats.ts` device subquery uses `left join` and emits `owner: null` when no member; `SeatDto` device `owner` is nullable and `SeatDetailPanel` renders it null-safely (`pnpm typecheck`). `layout.ts:94-133` selects only `seat_id`, `type` (no change). Backed by the AC 3 CHECK test. |
| 5 | Deleting an owned device (409 `device_owned`), or one with a pending handoff (409 `handoff_pending`), is refused; a non-Admin delete is 422 `not_allowed`; deleting an unowned unplaced device works and cascades its non-pending handoffs. | `rules.test.ts` › "decideDelete order: not_allowed, device_owned, device_placed, handoff_pending, ok"; `devices.db.test.ts` › "delete matrix: Admin deletes an unowned device (audit, 204 path); owned -> 409 device_owned; pending handoff -> 409 handoff_pending; User/Manager -> 422"; `schema:check` › "10 device delete cascades its non-pending handoffs". |
| 6 | UI: "New device" shows only for Admins and the create dialog has no owner picker; an empty owner shows as "Org inventory"; the Devices filter has "Org inventory". | `DevicesView.test.tsx` › "New device only when onNew is given" + `DevicesPage` passes `onNew` only for Admins (review); `DeviceFormDialog.test.tsx` › "create has no owner fields; edit of an unowned device shows Owner: Org inventory"; `devices-state.test.ts` › "filters include unowned with label Org inventory"; `DeviceTable` owner label test in `DevicesView.test.tsx` › "unowned row shows Org inventory and no Place/Delete for non-Admin". Manual local run: as Admin create a device, it appears under "Org inventory". |

## Ming verification after merge
None (all criteria are checked locally and in CI). Optional: create one device as Admin on the deployed app once SIM-037.x
ships.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261125120000_device_lifecycle.sql` | New expand-only migration (see Data model) | AC 1, 3, 5; R2 | **Yes** |
| `db/migrations/README.md` | Schema section (`:18-47`): nullable owner, invariant 5 CHECK, new columns, `device_handoffs` and its cascade, immediate CHECK vs deferred trigger order note | R2 docs | **Yes** (`db/migrations/**`) |
| `scripts/schema-check.mjs` | Stage 1 (`:72-81`) also inserts an owned device in `oldMemberOrg`; new section "10 device lifecycle (SIM-037.1)" after section 9 (`:479`) | AC 1, 3, 5 | No |
| `db/seeder.js` | Add one unowned device (`:132-136`, e.g. `["8", 4, "Bộ sạc D", "INV-4", null, null, "secondary"]`) | Manual check, seed shows org inventory; diacritics | No |
| `src/lib/devices/types.ts` | `DeviceCreateValue` drops `ownerId`; `PlacementFilter` adds `"unowned"`; `DeviceDto.owner` nullable; add `canDelete: boolean` | AC 2, 4, 6 | No |
| `src/lib/devices/rules.ts` | Remove `canCreateFor`; add `canCreate(tier)`, `decideDelete(...)`; `PlacementInput.ownerId: string \| null`; `device_unowned` refusal; doc comments | AC 2, 3, 5 (pure logic) | No |
| `src/lib/validate/device.ts` | `FILTERS` (`:18`) adds `unowned`; `validateDeviceCreate` (`:94-111`) treats `ownerId` as unknown key | AC 2, 4 | No |
| `src/lib/search/types.ts` | `:19` owner nullable | AC 4 | No |
| `src/lib/seats/types.ts` | `:17` owner nullable | AC 4b | No |
| `src/lib/api/error.ts` | Add `device_unowned`, `device_owned`, `handoff_pending` | Closed code list | No |
| `src/server/devices/devices.ts` | Left join + `coalesce` mine (`:118-121`); nullable row type and `toDto` (`:68-103`); `unowned` filter (`:131-135`); placement owner read under lock (`:194-260`); `createDevice` Admin-only, no owner (`:304-345`); `updateDevice` null-safe owner compare (`:380`); `deleteDevice` via `decideDelete` + pending handoff check (`:408-444`); `inTx` 422 for `device_unowned` (`:51-61`); `Refusal` codes (`:29-39`) | AC 2-5 | No |
| `src/server/devices/pg-error.ts` | Map `23514 devices_unowned_not_placed_check` → `device_unowned` | AC 3 backstop | No |
| `src/server/search/search.ts` | Left join (`:119`), nullable row (`:34-35`), `owner: null` (`:140`) | AC 4 | No |
| `src/server/export/export.ts` | Left join (`:70`); owner cells empty for null | AC 4 | No |
| `src/server/seats/seats.ts` | Left join (`:124`), `owner` json null when no member (`:122`) | AC 4b (defensive) | No |
| `src/ui/copy/devices.ts` | `filters.unowned: "Org inventory"`, `orgInventory: "Org inventory"`, `empty.unowned`; remove `ownerMe/ownerOther/ownerSelected`, `fieldErrors.ownerId`, `errors.memberNotAssignable` | AC 6; D36 | No |
| `src/ui/copy/api.ts` | Messages for the three new codes | Copy coverage test | No |
| `src/ui/devices/devices-state.ts` | `FILTERS` (`:7`) adds `unowned` | AC 6 | No |
| `src/ui/devices/device-form.ts` | Drop `DeviceOwner`/`owner` from the form; `DeviceCreateBody = DeviceCreateValue`; `toCreateBody(form)`; `deviceErrorMessage` drops the member case | AC 6 | No |
| `src/ui/devices/DeviceFormDialog.tsx` | Remove create owner fieldset and `OwnerPicker` (`:182-260`), `isAdmin`/`loadPage` props and member-picker imports; edit shows owner or "Org inventory" (`:101`, `:175-180`) | AC 6 | No |
| `src/ui/devices/DevicesPage.tsx` | `onNew` only when `isAdmin` (`:54`); stop passing `isAdmin`/`loadPage` to the dialog (`:74-76`) | AC 6 | No |
| `src/ui/devices/DeviceTable.tsx` | `OwnerLabel` (`:32-35`) shows "Org inventory" for null | AC 6 | No |
| `src/ui/devices/device-actions.ts` | Delete gated by `d.canDelete` (`:48`) instead of `canEdit` | AC 5/6 | No |
| `src/ui/devices/place-device.ts` | `ownerId: d.owner?.id ?? null` (`:36`, `:82`); `placeVerb` null-safe (`:50`) | Type change | No |
| `src/ui/search/SearchView.tsx` | `:53` owner null-safe (shows "Org inventory" from devices copy or search copy) | AC 4 | No |
| `src/ui/seats/SeatDetailPanel.tsx` | `:31` render owner line only when present | AC 4b | No |
| `src/test/db/fixtures.ts` | `addDevice` (`:67-80`) accepts `ownerId: string \| null`; new `addHandoff(db, orgId, deviceId, fromId, status)` | Tests | No |
| Tests (listed under Tests to write) | `rules.test.ts`, `device.test.ts`, `pg-error.test.ts`, `devices.test.ts`, `devices.db.test.ts`, `devices-routes.test.ts`, `search.db.test.ts`, `export.db.test.ts`, `seats.db.test.ts` (only if fixtures break), UI tests | R5 | No |

`src/server/rooms/layout.ts`, `src/server/members/manage.ts` and the device routes need no change (verified: layout reads only
`seat_id, type`; `manage.ts` filters `d.owner_id = m.id`, safe with null; routes keep `{ tier: "user" }` so refusals stay
domain-level 422, R7).

## Data model / migration
One file `db/migrations/20261125120000_device_lifecycle.sql`, expand-only, forward-only, every object named explicitly.
Header comment: SIM-037.1 / D63, expand-only, previous image keeps working.

`devices`:
1. `alter table devices alter column owner_id drop not null;` (FK `devices_owner_fkey` and `devices_org_owner_idx` unchanged).
2. New nullable columns, no default (no rewrite):
   - `serial text null`, constraint `devices_serial_check check (serial = btrim(serial) and serial <> '' and char_length(serial) <= 100)`
   - `manufacturer text null`, `devices_manufacturer_check` same shape
   - `brand text null`, `devices_brand_check` same shape
   - `holding_note text null`, `devices_holding_note_check check (holding_note = btrim(holding_note) and holding_note <> '' and char_length(holding_note) <= 500)`
   - `holding_expires_on date null`
3. `create unique index devices_org_serial_key on devices (org_id, serial) where serial is not null;` (exact match, A7).
4. `alter table devices add constraint devices_unowned_not_placed_check check (owner_id is not null or seat_id is null) not valid;`
   then `alter table devices validate constraint devices_unowned_not_placed_check;` (all rows have owners, OQ-45).
5. `alter table devices add constraint devices_unowned_no_holding_check check (owner_id is not null or (holding_note is null and holding_expires_on is null)) not valid;` + validate (A8).
6. `create index devices_org_unowned_idx on devices (org_id, lower(name), id) where owner_id is null;` (matches the list order for the org inventory filter).

`device_handoffs` (modelled on `seat_requests`, init.sql `:143-166`):
| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` (PK) |
| org_id | uuid | no | |
| device_id | uuid | no | |
| kind | text | no | |
| from_member_id | uuid | no | |
| to_member_id | uuid | yes | |
| requested_by_id | uuid | no | |
| note | text | yes | |
| new_expires_on | date | yes | |
| status | text | no | `'pending'` |
| decided_by_id | uuid | yes | |
| decided_at | timestamptz | yes | |
| created_at, updated_at | timestamptz | no | `now()` |

Constraints: `device_handoffs_org_id_key unique (org_id, id)`; `device_handoffs_kind_check kind in ('transfer','return','extension')`;
`device_handoffs_status_check status in ('pending','confirmed','declined','cancelled')`; `device_handoffs_decided_check ((status = 'pending') = (decided_at is null))`;
`device_handoffs_note_check (note = btrim(note) and note <> '' and char_length(note) <= 500)`;
`device_handoffs_shape_check`: `(kind = 'transfer' and to_member_id is not null and to_member_id <> from_member_id and new_expires_on is null) or (kind = 'return' and to_member_id is null and new_expires_on is null) or (kind = 'extension' and to_member_id is null and new_expires_on is not null)`.
FKs: `device_handoffs_device_fkey (org_id, device_id) → devices (org_id, id) on delete cascade` (A5);
`device_handoffs_from_fkey`, `_to_fkey`, `_requested_by_fkey`, `_decided_by_fkey` `(org_id, …) → members (org_id, id)` (no action; members are never hard-deleted while referenced).
Indexes: `device_handoffs_one_pending_idx unique (org_id, device_id) where status = 'pending'`;
`device_handoffs_inbox_idx (org_id, to_member_id, created_at desc) where status = 'pending'`;
`device_handoffs_device_idx (org_id, device_id, created_at desc)` (history and the cascade lookup).
Outbox, Admin/Manager queue and overdue indexes are left to the slices that query them (SIM-037.3 to 037.5).

Invariant-3 trigger functions are not touched (database-optimizer: a null-owner primary already raises
`devices_primary_owner_is_occupant`; the new CHECK refuses it earlier).

Downgrade: none (forward-only, `db/migrations/README.md`). Rollback = previous image, which still works: it always writes
an owner, ignores new columns; its inner joins hide unowned devices (lists incomplete, a hidden row may cause a 409 on a
duplicate inventory number/MAC; acceptable, not live, OQ-45). Fix forward otherwise.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/devices?placement=` | `all \| placed \| inventory \| unowned` (new `unowned` = `owner_id is null`; `inventory` keeps meaning `seat_id is null`) | `DeviceListResponse`; `DeviceDto.owner` is `{id, displayName} \| null`; new `canDelete` | 400 `invalid_request` (unknown/repeated) | any member |
| GET | `/api/devices/:id` | — | `DeviceDto` (as above) | 404 | any member |
| POST | `/api/devices` | `{name, type, inventoryNumber, mac?}`; `ownerId` (or any other key) → 400 | 201 `DeviceDto` with `owner: null`, `placement: null` | 400 `invalid_request`; 422 `not_allowed` (non-Admin, before any read/write); 409 `inventory_number_taken`, `mac_taken` | Admin (checked in the service, R7) |
| PATCH | `/api/devices/:id` | unchanged | unchanged | unchanged; an unowned device is editable only by an Admin (422 `not_allowed`) | owner or Admin |
| PUT | `/api/devices/:id/placement` | unchanged | unchanged | new 422 `device_unowned` when the target is a seat and the device has no owner; return-to-inventory of an unplaced unowned device stays a noop | owner or Manager+ |
| DELETE | `/api/devices/:id` | — | 204 | 404; 422 `not_allowed` (non-Admin); 409 `device_owned`, `device_placed`, `handoff_pending` (in this order) | Admin |

`DeviceDto` flags: `mine = coalesce(m.sub = $2, false)`; `canEdit = canEdit(tier, mine)` (unowned → Admin only);
`canPlace = owner !== null && canPlace(tier, mine)`; `canDelete = tier === "admin" && owner === null` (pending handoffs are
checked only by the server; none can exist before SIM-037.3). New schema fields (`serial`, `manufacturer`, `brand`,
`holdingNote`, `holdingExpiresOn`) are not in the DTO or POST yet (A9).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/devices/rules.test.ts` › "canCreate: only admin" (replaces the `canCreateFor` test) | AC 2 |
| `src/lib/devices/rules.test.ts` › "unowned device: any seat target (primary or secondary, empty or occupied) -> 422 device_unowned; manager passes permission first; user without ownership -> not_allowed; target null on an unplaced device -> noop" | AC 3, R7 order |
| `src/lib/devices/rules.test.ts` › "decideDelete: user/manager -> 422 not_allowed; admin + owned -> 409 device_owned; admin + unowned placed -> 409 device_placed; pending handoff -> 409 handoff_pending; admin + unowned + unplaced + none -> ok" | AC 5 |
| `src/lib/validate/device.test.ts` › "create rejects ownerId as an unknown key"; "parseDeviceQuery accepts unowned" | AC 2, 4 |
| `src/server/devices/pg-error.test.ts` › add `23514 devices_unowned_not_placed_check` -> `device_unowned`; `23514 devices_serial_check` -> null | AC 3 |
| `src/server/devices/devices.test.ts` › "createDevice as user/manager -> 422 not_allowed with no query after the check"; "updateDevice with no linked member and an unowned device -> 422 not_allowed (null === null hole closed)" | AC 2, privilege bug from API consult finding 5 |
| `src/server/devices/devices.db.test.ts` › replace "create permission matrix" (`:314`) and "create without a member row" (`:357`) with "create: Admin (with or without a member row) creates an unowned device, owner null, audit device.create meta ownerId null; Manager and User -> 422, no row, no audit" | AC 2 |
| `devices.db.test.ts` › "placing an unowned device -> 422 device_unowned, row unchanged; Admin and Manager alike" | AC 3 |
| `devices.db.test.ts` › "list/get include an unowned device with owner null, mine false, canPlace false; canEdit/canDelete true only for Admin; filter unowned returns only unowned devices; inventory still returns owned unplaced ones too" | AC 4 |
| `devices.db.test.ts` › replace "delete permission matrix" (`:411`) with "delete: Admin deletes an unowned unplaced device with audit; owned -> 409 device_owned; with a pending handoff -> 409 handoff_pending and row kept; with only a cancelled handoff -> deleted, handoff gone; User/Manager -> 422"; adapt `:437` (placed delete) and `:509` (delete/place race) to an Admin and unowned or owned device as needed | AC 5 |
| `devices.db.test.ts` › "uniqueness" (`:463`): create as Admin | regression |
| `src/app/api/devices/devices-routes.test.ts` › `createValue` without `ownerId`; "POST with ownerId -> 400 invalid_request"; route passes 422 `device_unowned` and 409 `device_owned` / `handoff_pending` through | AC 2, 3, 5 |
| `src/server/search/search.db.test.ts` › "an unowned device is found by name and inventory number, owner null" | AC 4 |
| `src/server/export/export.db.test.ts` › "an unowned device row has empty Owner name and Owner employee code, Location inventory" | AC 4 |
| `scripts/schema-check.mjs` › section 10: existing device keeps owner and has null new columns; `owner_id` is nullable; unowned at a seat refused (23514 `devices_unowned_not_placed_check`); one UPDATE setting owner null on a placed device refused; unowned with holding note refused (23514 `devices_unowned_no_holding_check`); duplicate serial in an org refused (23505 `devices_org_serial_key`), same serial in another org accepted; blank, untrimmed and 101-char serial/manufacturer/brand refused (23514); second pending handoff refused (23505 `device_handoffs_one_pending_idx`), a new pending after cancel accepted; cross-org handoff member refused (23503); bad kind/status and transfer without `to_member_id` refused (23514); decided check; device delete cascades its non-pending handoffs | AC 1, 3, 5 |
| `src/ui/devices/devices-state.test.ts` › "filters: all, placed, inventory, unowned (label Org inventory)"; empty text for unowned | AC 6 |
| `src/ui/devices/device-form.test.ts` › "toCreateBody sends name, type, inventoryNumber, mac only" (replace owner cases) | AC 6 |
| `src/ui/devices/DeviceFormDialog.test.tsx` › "create has no owner fields"; "edit of an unowned device shows Org inventory" | AC 6 |
| `src/ui/devices/DevicesView.test.tsx` › "unowned row shows Org inventory"; "New device only when onNew is given" | AC 6 |
| `src/ui/devices/device-actions.test.ts` › "delete offered only with canDelete" | AC 5/6 |
| `src/ui/devices/place-device.test.ts`, `src/ui/search/SearchView.test.tsx`, `src/ui/seats/SeatDetailPanel.test.tsx` › fixtures compile with nullable owner; SearchView "unowned hit shows Org inventory" | AC 4 |

## Approach
1. Migration and README (High). Run `pnpm migrate` on the dev DB, then extend `scripts/schema-check.mjs` (stage 1 owned
   device in `oldMemberOrg`: change the member insert at `:75-78` to `returning id`, insert a device with that owner;
   section 10 checks). Run `pnpm schema:check`. Add the unowned seed device; `pnpm seed:dev` twice (idempotent).
2. Pure lib: types, `rules.ts` (`canCreate`, `decideDelete`, `device_unowned` in `decidePlacement` placed after the
   permission and stale-view checks and only when `target !== null`; `isOwner` is computed by callers as
   `ownerId !== null && me === ownerId`), validators, error codes. Unit tests first.
3. Server `devices.ts`:
   - `deviceRows`: `left join members`, `coalesce(m.sub = $2::uuid, false) as mine`, nullable row, `toDto` builds
     `owner: null` and the flags above. `FILTER_SQL.unowned = "d.owner_id is null"`.
   - `placeDevice`: first read selects only `seat_id`; `cur` (the `for update` read at `:233-238`) types and uses
     `owner_id`; `isOwner`/`ownerId`/audit `ownerId` come from `cur[0]`; replace the comment at `:194-195` with "owner_id is
     read under the device lock (SIM-037.1) so a later transfer cannot race placement".
   - `createDevice`: `if (!canCreate(tier)) throw refuse(422, "not_allowed")` as the first statement, before any query
     (R7); no member lookup; insert `owner_id` null (drop the column from the insert); audit meta `{ inventoryNumber,
     ownerId: null }`.
   - `updateDevice`/`deleteDevice`: owner compare `cur.owner_id !== null && me === cur.owner_id`. `deleteDevice` locks the
     device row, reads the pending handoff (`select 1 from device_handoffs where org_id = $1 and device_id = $2 and status
     = 'pending'`) under that lock, calls `decideDelete`, then deletes; audit meta keeps `ownerId: cur.owner_id` (null).
   - `inTx`: answer `device_unowned` as 422, other conflict codes as 409.
   - Remove `member_not_assignable` and `no_linked_member` from `Refusal` if no longer used in the file; add
     `device_owned`, `handoff_pending`.
4. Search, export, seats left joins (`export.ts` map: null owner → empty cells via the existing null handling).
5. UI changes listed in Files; copy in `src/ui/copy/*` only (D36). Run `pnpm format`, all Checks.
6. Order of side effects (R7): every 401/403 stays in `withAuth`; Admin-only create/delete are domain 422 before any write;
   owned/placed/pending are 409 after locking, before the delete.

Rules: R1 (types/rules in `src/lib`, SQL only in `src/server`, UI imports only lib/ui), R2 (one forward-only expand
migration, previous image works), R6 (every new query and join keeps `org_id`; new table has `org_id` and composite FKs;
schema:check rule 2 covers it), R7 (above), R3 (no config), R5 (tests above). Domain focus: Vietnamese diacritics in the seed
device name; null owner everywhere; `holding_expires_on` is a `date` (no time zone; the app will treat it as a Vietnam
calendar date in SIM-037.2/037.5).

Expected size: about 350 to 400 changed non-test lines (migration ~90, server ~110, lib ~50, UI net ~60 after removing the
owner picker, scripts ~60), plus tests.

## Specialist input used
- software-architect: adopted nullable owner, plain CHECK as the DB guard (no trigger), NOT VALID + VALIDATE, `device_handoffs`
  with partial unique pending and recipient inbox index, the four left joins, owner read under the device lock. Adopted the
  spec's names over the consult's where they differ: `holding_note`/`holding_expires_on date` (consult:
  `assignment_*` timestamptz) and status `declined` (consult: `rejected`), because the spec and ticket name them. History
  from audit_log and deactivation behaviour are later slices.
- database-optimizer: adopted named checks enforcing trimmed text, partial unique serial, `devices_unowned_no_holding_check`
  (OQ 3 default), `on delete cascade` for `device_id` (rec. 2), per-kind shape check, no trigger changes, schema:check stage
  and section 10 cases, CHECK-name mapping. Not adopted: Admin queue and sender outbox indexes, overdue index (deferred to
  the slices that query them); seeding a handoff (counts list at `schema-check.mjs:114-131` is explicit, so not needed).
- api-platform-engineer: adopted nullable `owner` across the three DTOs, `coalesce` for `mine`, `ownerId` rejected as an
  unknown key, Admin check first in create, code names `device_unowned`/`device_owned`/`handoff_pending`, rule order in
  `decidePlacement`, null-equals-null fix in `canEdit`/`isOwner`, separate `unowned` filter, empty CSV owner cells, and the
  AC 4 room layout correction (finding 9). Not adopted: `on delete restrict` + 23503 mapping for handoffs (chose the
  optimizer's cascade, A5); new fields in the DTO now (A9). Added `canDelete` flag (the consult left it to the UI need:
  without it an Admin would see Delete on every owned device and always get 409).

## Assumptions
For Ming to approve with the plan (all reversible except the migration content itself):
- A1 AC 4 corrected: seat detail and room layout cannot return unowned devices (invariant 5); they get null-safe code only
  (AC 4b). List, detail, search and CSV export carry the "return unowned devices" criterion.
- A2 Non-Admin create → 422 `not_allowed` (domain refusal, R7/D19 style), not 403. Routes keep `{ tier: "user" }`.
- A3 Delete becomes Admin-only; owners no longer delete their own devices (spec DEV-01; supersedes D19/D31 owner delete).
  Codes and order: 422 `not_allowed`, 409 `device_owned`, 409 `device_placed`, 409 `handoff_pending`.
- A4 Org inventory filter is a new value `unowned` labelled "Org inventory"; `inventory` ("Inventory") keeps meaning "not at
  a seat". Renaming it to "Not placed" (DEV-02 wording) is left to SIM-037.2 UI work.
- A5 `device_handoffs.device_id` is `on delete cascade`: deleting a device drops its non-pending handoffs; the delete audit
  row keeps the identity. Pending handoffs block delete in the service under the device lock; SIM-037.3+ must insert
  handoffs under the same device lock.
- A6 Handoff statuses follow the spec (`declined`, not `rejected`); `from_member_id` is required for every kind; return has
  `to_member_id` null (to org inventory); per-kind shape check as in Data model. Later slices relax it by a new migration
  if needed.
- A7 Serial is unique per org by exact value after trim (case-sensitive), like inventory number.
- A8 Holding note and handoff note: trimmed, non-blank, at most 500 characters; the DB refuses holding data on an unowned
  device. Later slices that return a device to the org inventory must clear holding data, seat and owner in one UPDATE
  (immediate CHECK vs deferred trigger; "null the owner, then unplace" as two statements fails).
- A9 New columns (`serial`, `manufacturer`, `brand`, `holding_*`) are schema-only in this slice; DTO, POST/PATCH and dialogs
  get them in SIM-037.2.
- A10 CSV owner cells are empty for unowned devices; the UI shows "Org inventory".
- A11 `canDelete` is `admin && owner === null`; pending handoffs are not reflected in the flag (none can exist until
  SIM-037.3, which adds it if needed).
- A12 Create no longer needs the Admin to have a linked member row (no owner to resolve).
- Hotspots: no other ticket is IN_PROGRESS, REVIEW or DONE on the board. SIM-037.2 to 037.6 will edit the same files
  (`devices.ts`, `types.ts`, `rules.ts`, `DeviceFormDialog.tsx`); they start after this merges. SIM-035 map drawing (if
  reopened) must handle nullable owner types.
- OQ-44 (deactivation) is untouched: `members/manage.ts` unplaces by `owner_id = m.id`, unaffected by null owners.

## Blocking questions
None.

## Split proposal
None. The ticket is already slice 1 of the D63 split (SIM-037.1 to 037.6). If the implementation exceeds ~400 non-test
lines, the UI items (DeviceFormDialog, DevicesPage, filter, labels) are the fallback to move to SIM-037.2, keeping the
schema, API and null-safe reads here.
