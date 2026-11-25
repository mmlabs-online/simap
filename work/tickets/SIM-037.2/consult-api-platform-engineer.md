# Consult — api-platform-engineer (2026-11-25)

## SIM-037.2 consult: assign endpoint, holding edit, new device fields

Files read: `src/server/devices/devices.ts`, `src/lib/validate/device.ts`, `src/lib/devices/{types,rules}.ts`, `pg-error.ts`, the device routes, `src/lib/audit/day-range.ts`, the SIM-037.1 migration, the search and export SQL. Nothing run.

### Findings
- **Auth pattern.** All device routes use `withAuth({tier:"user"})`. Permission is checked inside the domain function and refused as 422 `not_allowed`, before any query, so R7 holds. `createDevice` and `deleteDevice` check the tier before opening the transaction. `placeDevice` and `updateDevice` check it after the device lock and before any write — still before any side effect.
- **Schema already enforces most of this** (migration `20261125120000_device_lifecycle.sql`):
  - `serial`: nullable, trimmed, non-empty, ≤ 100 chars; unique index `devices_org_serial_key` on (org_id, serial) where serial is not null.
  - `holding_note`: trimmed, non-empty, ≤ 500 chars.
  - `holding_expires_on`: a `date`.
  - `devices_unowned_no_holding_check`: an unowned device cannot carry a note or an expiry.
- **Missing pieces:**
  - `DeviceRow`, `toDto`, `deviceRows`, `DeviceCreateValue`, `DevicePatchValue` and `COLUMNS` have none of the new fields (A9).
  - `pg-error.ts` has no `serial_taken` mapping; a serial collision today throws a raw 23505 → 500.
  - Search (`src/server/search/search.ts`) selects/matches `name`, `inventory_number`, `mac`, owner name only.
  - Export (`src/server/export/export.ts`) selects `name`, `type`, `inventory_number`, `mac`, `role`, owner, seat only.
- **Timezone helper.** `src/lib/audit/day-range.ts` has the UTC+7 offset (`7*3_600_000`, D35) and a strict `YYYY-MM-DD` real-date check in `dayStart` (private). No "today in UTC+7" helper.
- **Lock order.** `deactivateMember` locks member → rooms → seats → devices. `placeDevice` and `deleteDevice` lock the device row. `placeDevice` does not lock the member row.

### Recommendations

**1. Assign endpoint**
- `POST /api/devices/[id]/assignment` in new `src/app/api/devices/[id]/assignment/route.ts`.
- Body `{ memberId: uuid, note?: string|null, expiresOn?: "YYYY-MM-DD"|null }`. Sub-resource style like `/placement`; 037.3 can add `/handoffs` alongside.
- Return 200 with the `DeviceDto` (as PUT placement).
- Wrapper tier `user`; domain refuses 422 `not_allowed` unless tier ≥ manager. Add `canAssign = atLeast(tier,"manager")` to `rules.ts`; check before opening the transaction, like `createDevice`.
- Order inside the transaction:
  1. Lock target member (`select id,status from members where org_id=$1 and id=$2 for share`); missing → 404 `not_found`.
  2. Lock device (`for update`); missing → 404.
  3. 409 `device_owned` if `owner_id` not null (reuse `decideDelete`'s code).
  4. Target not active → do not reuse `member_deactivated` (R7 reserves it for the auth wrapper as 403); use `member_inactive` as a 409/422 domain code; add to `src/lib/api/error.ts` and `src/ui/copy/api.ts`.
  5. Pending handoff → 409 `handoff_pending` (cheap, matches delete).
- Single UPDATE: `owner_id`, `holding_note`, `holding_expires_on`; leave `seat_id` null, `role` as is. Deferred owner trigger needs nothing (not placed).
- Target resolved by `(org_id, id)` (R6). Unowned-but-placed is impossible (invariant 5).

**2. Holding edit endpoint**
- `PATCH /api/devices/[id]/holding`, new route file.
- Body `{ note?: string|null, expiresOn?: string|null }`; non-empty; present keys applied.
- Admin/Manager only: 422 `not_allowed`. (`updateDevice` uses `canEdit` = owner or Admin — different; the owner must not extend their own loan.) Add `canManageHolding = atLeast(tier,"manager")`.
- Unowned device → distinct 409 `not_assigned` (not `device_unowned`, which is a 422 for placement).
- Under the device lock, update changed columns only; no change → no-op without an audit row.
- "Not in the past" on edit: apply only when the expiry value changes, else an overdue holding's note can never be edited (open question 1).

**3. DTO**
- Add to `DeviceRow`/`toDto`: `serial`, `manufacturer`, `brand`, `holdingNote` (`string|null`), `holdingExpiresOn` (`string|null`, `YYYY-MM-DD`).
- pg parses `date` to a JS Date in the server's local TZ (day shift risk): select `to_char(d.holding_expires_on,'YYYY-MM-DD') as holding_expires_on`.
- Add `canAssign` (manager+ and unowned) and `canEditHolding` (manager+ and owned) flags, like `canDelete`.
- Keep flat field names.

**4. POST and PATCH validators** (`src/lib/validate/device.ts`)
- Add `serial`, `manufacturer`, `brand` to the allowed keys (duplicated in create and patch — extract one constant).
- `text()` rejects blank; for these optional fields treat blank/null as null (like `normalizeMac`): add `optText(v, max)` → `null | undefined(invalid) | string`.
- Limits in `DEVICE_LIMITS`: serial 100 (matches DB), manufacturer and brand 100 each (no DB length check on those — validator is the only guard; a second migration probably not worth it).
- Same NFC, trim, no-control-characters rule for create and PATCH.
- No holding fields on create or general PATCH (assign and holding routes only).
- `updateDevice`: extend `COLUMNS` with serial/manufacturer/brand, add to the current-row SELECT; `changed` comparison handles null. Audit meta `from`/`to` only for inventory number as today; no serial values beyond field names unless Ming wants it.

**5. `serial_taken` mapping**
- Add `"serial_taken"` to `DeviceConflictCode`, map 23505 on `devices_org_serial_key` in `pg-error.ts` (unique index; pg still reports it as `constraint`).
- 409 (`inTx` default). Add to `src/ui/copy/api.ts` and `src/lib/api/error.ts` like `mac_taken`.
- Fires at INSERT/UPDATE time; surfaces through `inTx`'s catch.

**6. Expiry validation in UTC+7 (D35)**
- Pure helper in `src/lib/devices/holding.ts` (or export the offset from `day-range.ts`): `todayUtc7(now: Date): string`, `parseExpiryDay(s): string|null` (strict `YYYY-MM-DD`, rejects `2026-02-30`).
- Valid if `expiresOn >= todayUtc7(now)` (string compare; today allowed).
- Validator checks format only (no clock); "not in the past" in the server function with injected `now`; refuse 400 `invalid_request` with `field: "expiresOn"` (input validation, not 409/422).
- Never `new Date().toISOString().slice(0,10)` (UTC; wrong 00:00–07:00 UTC+7). The client date input `min` uses the same rule.
- Reject years outside ~2000–2100.

**7. Audit rows**
- `device.assign`: entity `device`, entityId device id; meta `{ memberId, note, expiresOn, inventoryNumber }` (no `fromOwnerId`, always null).
- `device.holding_update`: meta `{ ownerId, fields: [...], from: {note, expiresOn}, to: {note, expiresOn} }`.
- One row per call in the same transaction (`writeAudit`). Check `src/server/audit/*` for an action allowlist / UI label map for `device.*` (grep `"device.update"`) and add both. Note text is free text: check the audit meta size cap and that the audit view escapes it.

**8. Search and export**
- Search: select `serial`, `manufacturer`, `brand`, add to the `like` alternatives; add to `DeviceHit` (`src/lib/search/types.ts`) and the row mapper; case-insensitive and folded like other fields; do not search the holding note.
- Export: add Serial, Manufacturer, Brand; also holding note and expiry? (open question 2). Keep header array and row mapper aligned. Check CSV formula-injection escaping (`=`, `+`, `-`, `@`) for the new free-text cells and the note.
- `seats.ts` / `lib/seats/types.ts` summaries: not needed, skip.

**9. Concurrency**
- Assign vs assign: both lock the device row; second sees owner set → 409 `device_owned` (the "two assigns" DB test).
- Assign vs delete: serialised by the device lock; after delete assign → 404; after assign delete → 409 `device_owned`.
- Assign vs placement: a place that started before the assign sees `owner_id` null under lock → 422 `device_unowned` (correct); after assign it is a normal placement.
- Assign vs member deactivate: lock the member row in assign (`for share`; deactivate takes `for update` via `lockMember`) and re-check `status = 'active'` after the lock, else a device could be assigned to a member deactivated a moment earlier, bypassing `member_not_empty`. Lock order member → device, consistent with `deactivateMember`, no deadlock.
- Check whether `impactOf`/`decideDeactivation` in `manage.ts` counts unplaced owned devices; if only seated ones, deactivating a member who holds inventory devices leaves an owned device with a deactivated owner — a pre-existing gap from 037.1 (open question 3).
- Holding edit vs assign/return: device lock + `owner_id` read under it is enough.

**10. Tests that change or are added**
- Change: `src/lib/validate/device.test.ts` (allowed keys, new fields in create/PATCH: blank→null, length, control chars, unknown `holdingNote` rejected); `src/app/api/devices/devices-routes.test.ts` (DTO shape, new fields); `src/server/devices/devices.test.ts` (new columns, audit rows); `src/server/devices/devices.db.test.ts` (`serial_taken`, assign race, assign vs delete, assign vs deactivate); search and export tests (new fields, CSV header); UI `device-form.test.ts`, `devices-api.test.ts`, `device-actions.test.ts`, `devices-state.test.ts`; `src/test/db/fixtures.ts` and schema:check only if helpers need the new columns.
- Add: `src/lib/devices/rules.test.ts` permission matrix for `canAssign`, `canManageHolding`; `src/lib/devices/holding.test.ts` (UTC+7 today around 16:59/17:00 UTC, impossible dates); route tests for `assignment` and `holding` (401/403 only from the wrapper, 400 invalid body, 422 `not_allowed` for a User before any query, 404, 409).

### Risks
- pg `date` read as JS Date can shift a day — use `to_char`.
- "Past date" rule on holding edit may block editing overdue holdings (Q1).
- Assigning to a deactivated member if `impactOf` ignores inventory devices.
- Raw 23505 on the serial index → 500 unless mapped.
- CSV formula-injection surface grows with free-text columns.
- High path only if audit or deploy files are touched; no new migration needed. Gate is `plan-approval`.
- The `inventory` filter rename ("Not placed", A4) and the unreachable `DeleteDeviceDialog` branch were assigned to this ticket by 037.1 — include them in the plan or they are lost.

### Open questions (proposed defaults)
1. Edit of an expiry already past: default validate "not in the past" only when the expiry changes; always allow clearing it.
2. CSV includes holding note and expiry? Default: yes, two extra columns after Brand.
3. Does `impactOf` count unplaced owned devices on deactivation? Default: verify in the plan; if not, block deactivation with `member_not_empty` here or file a `debt` issue, and assign refuses inactive members regardless.
4. Code names `member_inactive`, `not_assigned`, `serial_taken`: default as above.
5. Assign by `memberId` only: default yes.
