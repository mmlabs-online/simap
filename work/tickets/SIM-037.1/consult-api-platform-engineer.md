# Consult — api-platform-engineer (2026-11-25)

API contract consult for SIM-037.1 (read-only; the agent read the code, did not run it).

## Findings

1. **DeviceDto.** `src/lib/devices/types.ts:36` has `owner: {id; displayName}` (non-null), mirrored in `devices.ts:68-103` (DeviceRow/toDto). The same non-null shape is duplicated in `lib/search/types.ts:19` and `lib/seats/types.ts:17`. All three must go nullable together.
2. **Left join.** `devices.ts:121` is the only join in deviceRows that needs to change. With `left join members`, `m.sub = $2::uuid as mine` becomes NULL for an unowned device; `mine` is boolean, so use `coalesce(..., false)`.
3. **Create path.** `createDevice` (`devices.ts:305`) resolves the owner from `v.ownerId ?? me`, runs `canCreateFor`, then locks the member `for share`. `validateDeviceCreate` accepts `ownerId`; the route test fixture `createValue = {…, mac: null, ownerId: null}` bakes it in. `DeviceCreateValue.ownerId` and `canCreateFor` become dead code once create is Admin-only with no owner.
4. **Existing 422 codes.** The route has no tier gate (`{tier:"user"}`); refusals use `not_allowed` 422 from the service. R7 and D19 keep this domain-level, so do not use 403 for "Manager cannot create".
5. **Edit and delete with a null owner.** `canEdit(tier, me === cur.owner_id)` (`devices.ts:380`, `:432`): a null owner never equals `me`, so only an Admin can edit/delete — correct, but make it explicit. `me` can also be null (no linked member): if both are null, `null === null` is true and everyone passes `canEdit` — a privilege bug. Compare with `cur.owner_id !== null && …`. Same hazard in `decidePlacement` (`isOwner: me[0]?.id === dev[0].owner_id`, `devices.ts:258`); harmless only if placement refuses an unowned device first.
6. **Placement.** `placeDevice` reads `owner_id` unlocked at `devices.ts:194-199` and again in `cur` at `:233-238`, but `cur` does not map `owner_id` in its row type. In 037.1 owner stays immutable, but the ticket wants the owner read under the device lock: use `cur[0].owner_id` and update the comment at `:194`. The DB CHECK is the backstop: a violation is SQLSTATE 23514 with the new constraint name; `deviceConflict` in `pg-error.ts` must map it, or it surfaces as a 500.
7. **`ownerId: string` in `PlacementInput` and `decidePlacement`** needs `string | null`.
8. **Other readers of owner_id.** `members/manage.ts:116,123,298,330,396` (`d.owner_id = m.id`) are safe with null. `search.ts:34-35,116-119,140` need the left join, nullable `owner_id`/`owner_name`, `owner: null`. `export.ts:70` needs the left join; owner columns empty. `seats.ts:122-124` left join (defensive: unowned devices have no seat).
9. **Layout `seatDevices` needs no change.** `layout.ts:94-133` selects only `seat_id` and `type` and never joins owner. By invariant 5 an unowned device never appears in `seatDevices`. The AC "room layout returns unowned devices" cannot hold — reword it.
10. **Error codes.** `lib/api/error.ts` `API_ERROR_CODES` is a closed list; any new code must be added there and to the UI copy map (`ui/copy/api.ts`), and to the `Refusal.code` union in `devices.ts:29-39`.

## Recommendations

- **DTO.** `owner: { id: string; displayName: string } | null`; keep `mine` strictly boolean (coalesce). Add `serial`, `manufacturer`, `brand`, `holdingNote`, `holdingExpiresOn` (all `string | null`, `holdingExpiresOn` ISO `YYYY-MM-DD`), camelCase. Additive except nullable `owner`; fix in-repo clients in the same PR (`DeviceTable`/`DeviceFormDialog.tsx:101`, `SeatDetailPanel`, `SearchView`). Use `owner: null`, not an empty object. `canAssign`/`canDelete` flags only if the UI needs them, else 037.2.
- **POST.** `validateDeviceCreate` rejects `ownerId` as an unknown key (400 `invalid_request`), like PATCH. New optional fields are SIM-037.2; if accepted now use the same `text(…, 100)` helper. `createDevice` first does `if (tier !== "admin") throw refuse(422, "not_allowed")` before any lookup (R7). Remove the member lock and `member_not_assignable`/`no_linked_member` from create; insert `owner_id` NULL; audit meta `{inventoryNumber, ownerId: null}`; 201 with `owner: null`. Delete `canCreateFor` and its tests.
- **DELETE.** Gate on `tier === "admin"` first (422 `not_allowed`). Then lock the device row and check: `owner_id` non-null → 409 `device_owned`; `seat_id` non-null → keep 409 `device_placed`; pending handoff → 409 `handoff_pending`. Do not reuse `in_use`. Check the pending handoff under the device lock; FK `on delete restrict` from `device_handoffs.device_id` as backup, mapping 23503 to `handoff_pending` in `deviceConflict`. Audit meta `ownerId: null`.
- **422 for placing an unowned device.** Add `device_unowned` (422) to `PlacementRefusalCode`, `decidePlacement` and `API_ERROR_CODES`. Rule order: (1) permission (Manager+ passes `canPlace`, so `isOwner` must be false when `ownerId` is null), (2) stale-view guard, (3) unowned check only when `target !== null` (return-to-inventory noop stays allowed). 422 not 409: stable domain refusal. Map 23514 on the new constraint name to `device_unowned` in `pg-error.ts` (extend `DeviceConflictCode`).
- **Backward compatibility.** Existing rows keep owner (OQ-45). Expand-only migration (nullable column, new columns, NOT VALID CHECK then VALIDATE); old-image writes still set an owner. No `ownerId` in PATCH (stays unknown key, 400).
- **Reads.** Left joins at `devices.ts:121`, `search.ts:119`, `export.ts:70`, `seats.ts:124`. CSV: empty owner name/code, Location stays "inventory" (`export.ts:84`). Org-inventory filter: today `inventory` = `seat_id is null`; add a separate value (e.g. `unowned`, `owner_id is null`) to `FILTERS` in `validate/device.ts` and `PlacementFilter`; unknown values still 400; do not redefine `inventory`.
- **Members route** (deactivate, delete): no change. OQ-44 later.

## Tests that change

- `src/app/api/devices/devices-routes.test.ts`: `createValue` drops `ownerId`; use admin in the success test; add POST with `ownerId` → 400; refusal cases `device_unowned` (422), `device_owned`, `handoff_pending` (409).
- `src/lib/validate/device.test.ts`: remove ownerId acceptance, add rejection.
- `src/lib/devices/rules.test.ts`: remove `canCreateFor`, add unowned placement and `isOwner` null-safety.
- `src/server/devices/devices.test.ts`, `devices.db.test.ts`: non-Admin create refused, create returns `owner: null`, delete rules, placement refusal plus the DB CHECK.
- `src/server/search/search.db.test.ts`, `export/export.db.test.ts`, `seats/seats.db.test.ts`: unowned fixtures.
- `src/test/db/fixtures.ts`: unowned device helper.
- `src/lib/api/error.ts`, `ui/copy/api.ts` (copy coverage): add `device_unowned`, `device_owned`, `handoff_pending`.
- UI: `DeviceFormDialog.test.tsx`, `device-form.test.ts`, `DevicesView.test.tsx`, `SeatDetailPanel.test.tsx`, `SearchView.test.tsx`.

## Risks

- Null-equals-null `canEdit`/`canPlace` hole is a privilege escalation if `me` is null — fix in `rules.ts`, not just SQL.
- Miss the CHECK name mapping in `pg-error.ts` and the backstop returns a 500; constraint name fixed in the migration, referenced in `pg-error.ts`, test must hit it.
- `inTx` catches deferred-trigger errors at COMMIT; a plain CHECK fires at statement time but the same catch path maps it.
- NOT VALID then VALIDATE: fine on dev-sized data.
- `unique (org_id, serial)` partial index: map to `serial_taken` (409) when serial becomes writable (037.2).
- `device_handoffs` insert (037.3+) must lock the device row `for update`, like delete.
- UI uses `device.owner.displayName` at `DeviceFormDialog.tsx:101`; TypeScript catches it.
- Ticket AC bullet 4 claims layout returns unowned devices (impossible, finding 9).

## Open questions (with defaults)

1. "Org inventory" filter: new `unowned` value (default) vs existing `inventory`. Default: add `unowned`, keep `inventory`.
2. Code names: default `device_unowned` (422), `device_owned` (409), `handoff_pending` (409).
3. POST accepts `serial`/`manufacturer`/`brand` now? Default: not yet (SIM-037.2).
4. Non-Admin owner deleting an unplaced owned device (old D19/D31 path): default 422 `not_allowed` for non-Admins, 409 `device_owned` for Admins — removes owner self-delete.
5. CSV Owner columns for unowned: default empty.
