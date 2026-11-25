# Consult — frontend-developer (reused)

Reused from SIM-037.2 (same author, 2026-11-25, written for the whole ticket before the UI was split into SIM-037.7). Server names are now fixed by SIM-037.2 (merged, PR #83): `POST /api/devices/{id}/assignment`, `PATCH /api/devices/{id}/holding`, DTO `holding: {note, expiresOn} | null`, `canAssign`, `canEditHolding`, `serial`, `manufacturer`, `brand`; the delete cleanup (section F) and the "Not placed" filter label are already done in SIM-037.2.


SIM-037.2 UI consult (read-only). Read the Devices UI files, the seats member picker, the audit date inputs and the SIM-037.1 plan; not the server code, so API names below are proposals.

## Findings

1. **Today's UI.**
   - `DevicesPage.tsx` holds the dialog state (`placing`, `form`, `deleting`) and mounts three keyed dialogs, each shown only while open.
   - Row buttons come from `rowActions(d, handlers)` in `device-actions.ts`: Place/Move/Return gated by `placeModes`, Edit by `d.canEdit`, Delete by `d.canDelete`.
   - After a mutation the page calls `useDevices.refresh()` (keeps rows until the answer). `onStale` = refresh while a dialog stays open. `filterAfterCreate` is the only "change filter instead of refresh" case.
   - `DeviceDto` has no serial, manufacturer, brand, note or expiry yet (A9), and no `canAssign`/`canEditHolding` flag.
   - `DeviceFormFields` has four text fields (name, type, inventoryNumber, mac). `device-form.ts` has `toCreateBody`/`toPatchBody`; patch sends only changed text fields; mac via `normalizeMac`.
2. **Member picker reuse.**
   - `MemberPickerFields` (props only, `src/ui/seats/MemberPickerDialog.tsx`), `useMemberPicker`, `member-picker.ts` (`PickerState`, `selectedMember`, `blocksSearchEnter`) and `seatsApi.activeMembers` (`/api/members?status=active`) are reusable (R1-legal inside `ui`).
   - Blockers to a clean reuse: copy from `seatsCopy.actions` (neutral enough); imports `CLIP` from `./SeatsView`; `MemberPickerDialog` is hard-wired to a `SeatDto` and wraps its own `EntityFormDialog`, so it cannot carry note and expiry.
   - `DevicesPage` already builds `createSeatsApi(apiFetch)`, so it can pass `seatsApi.activeMembers` as `loadPage`.
3. **Date input.** Only date inputs today are in `AuditView` (`DialogField type="date"`, `YYYY-MM-DD`). `src/lib/audit/day-range.ts` has a UTC+7 day helper (D35) but nothing computes "today in UTC+7". A native `min` uses the browser's local TZ and can disagree with the server's UTC+7 check.
4. **Carry-overs from SIM-037.1** (A4, impl follow-up): rename `filters.inventory` "Inventory" → "Not placed" (`copy/devices.ts:7`); remove the `delete.submit.placed`/`placedBody`/`moved` branch (Delete gated by `canDelete = admin && owner === null`, unowned never placed) — the `DeleteDeviceDialog` "placed" step and `moveBody`/`settleMove`/`afterRefetch` in `delete-device-flow.ts` are unreachable. Related copy: `copy.empty.inventory` ("No devices in inventory.") and `inInventory` ("In inventory") also mean "not placed"; `orgInventory` and `filters.unowned` ("Org inventory") stay.

## Recommendations

**A. Types and DTO** (`src/lib/devices/types.ts`)
- Add to `DeviceDto`: `serial`, `manufacturer`, `brand` (`string | null`); `holding: { note: string | null; expiresOn: string | null } | null` (null when unowned; `YYYY-MM-DD`); `canAssign` (unowned and Admin/Manager), `canEditHolding` (owned and Admin/Manager) — server-computed, like `canPlace`/`canDelete`.
- `DEVICE_LIMITS`: `serial: 100`, `manufacturer: 100`, `brand: 100`, `note: 500`.
- `DeviceCreateValue`/`DevicePatchValue` gain the three optional fields, `string | null`; empty → null.

**B. Form**
- `device-form.ts`: add the three fields to `DeviceForm`, `emptyForm`, `formFromDevice`; in `toCreateBody`/`toPatchBody` treat like `mac` (trim, empty → null, diff against the device).
- `DeviceFormFields`: widen `onField` key union; three `DialogField`s after MAC; `maxLength` from `DEVICE_LIMITS`; no `required`; `spellCheck={false}` for serial; icons e.g. `qr_code`, `factory`, `sell` (check the Icon set).
- `fieldMessage` has no generic fallback: add `fieldErrors.serial/manufacturer/brand`.
- `serial_taken` (409) message in `src/ui/copy/api.ts`; the copy coverage test needs every closed error code, so add all new API codes (and the past-expiry refusal).
- The form never touches holding note or expiry (holding dialog only).

**C. Assign dialog and holding edit** (one dialog, two modes)
- New `AssignDeviceDialog.tsx`, mounted like `PlaceDeviceDialog` (nothing unless `open && device`, keyed by `device.id` + mode); `mode: "assign" | "edit"`.
- Fields: member picker (`MemberPickerFields` + `useMemberPicker(seatsApi.activeMembers)`, assign mode only, `occupantId={null}`; move `CLIP` to a shared constant instead of importing `SeatsView`); note `<textarea>` (no `DialogTextarea` yet: add one to `EntityFormDialog.tsx` or inline), `maxLength` 500, hint "Optional"; expiry `DialogField type="date"` with a "No expiry" checkbox checked by default (disables and clears the date).
- Pure logic in new `assign-device.ts` (mirrors `place-device.ts`): `toAssignBody(form, memberId)` → `{ memberId, note, expiresOn }`; `toHoldingBody(form)` → `{ note, expiresOn }`; both validated by a shared `validateDeviceAssign` in `src/lib/validate/device.ts` (trim, NFC, note ≤ 500, real `YYYY-MM-DD`, ≥ today UTC+7).
- "Today in UTC+7" in `src/lib/` (e.g. `todayInVietnam(now = new Date())` next to `day-range.ts`), injected clock, used for the input's `min`; the API check is authoritative.
- On success: `onDone` → page `setX(null); void refresh()`.
- Errors like `settle` in `place-device.ts`: `device_owned`, `not_found`, stale → refetch via `api.get`; gone/ineligible → close via `onDone`; else message, update `current`, `onStale`. `invalid_request` → field message. Member errors (inactive, deactivated between pick and submit) → message + reload picker via `reloadToken`, as seats.
- API client (`devices-api.ts`): `assign(id, body)` and `updateHolding(id, body)` returning `DeviceDto` via `oneDevice`; route names decided by the server plan.
- Row actions: `DeviceRowHandlers` gains `onAssign`, `onEditHolding`; `rowActions` offers Assign when `d.canAssign`, "Note / expiry" when `d.canEditHolding`; aria labels like `Assign device ${inv}`. A User sees neither.

**D. Where holder, note and expiry show** (DEV-02)
- Owner column keeps the holder or "Org inventory" (`OwnerLabel`).
- "Holding" sub-line inside the owner cell and in the mobile card when `holding` is not null: clipped note as secondary text; `Until 2026-12-31` or "No expiry".
- Serial/manufacturer/brand: recommend one "Details" column (`Manufacturer Brand` over `Serial`) plus one extra line in the mobile card; `COLUMNS` 6 → 7; dash for missing, like `noMac`. (Alternative: three columns.)
- Search/CSV are server side; `SearchView.tsx` showing serial is optional and out of this ticket's UI scope; flag if the search DTO changes.

**E. Copy** (`src/ui/copy/devices.ts`, D36)
- `filters.inventory`: "Not placed"; `empty.inventory`: e.g. "No devices are unplaced."; `inInventory`: "Not placed".
- `columns.details`, `form.fields.serial/manufacturer/brand`, `form.fieldErrors` for the three.
- New `assign` block: `titles {assign, edit}`, `submit {assign, save}`, `member`, `note`, `notePlaceholder`, `expiry`, `noExpiry`, `expiryPast`, `noteTooLong`, `pickMember`, `holdingLine(note, expiry)`, `until(date)`, `actions.assign`, `actions.assignAria(inv)`, `actions.editHolding`, `actions.editHoldingAria(inv)`.
- Remove `delete.submit.placed`, `placedBody`, `moved` with the dead flow (F).
- `copy/api.ts`: messages for the new codes.

**F. Delete cleanup** (SIM-037.1 follow-up)
- `DeleteDeviceDialog.tsx` → plain confirm: no `step`, `moved`, `refetch`, `moveBody`. Keep `settleDelete` (done on success or not_found, else message). `device_owned`/`handoff_pending` (race with assign) → message + `onStale`.
- Delete from `delete-device-flow.ts`: `deleteStep`, `DeleteStep`, `moveBody`, `settleMove`, `MoveSettled`, `afterRefetch`, `RefetchSettled`, and the `device_placed` branch of `settleDelete` (map to a generic error). Check `toPlacementBody` has other users first.
- `delete-device-flow.test.ts`, `DeleteDeviceDialog.test.tsx` shrink accordingly.

**G. State and refetch**
- No new global state; page-level `useState<{ device; mode } | null>` like `placing`.
- `onDone` closes + `refresh()`; no filter change after assign. An assigned device leaves the "Org inventory" filter after refresh: move focus to the heading (`headingRef`), like delete.
- `onStale` = refresh while the dialog stays open.

**H. Testability**
- Pure and unit-tested: `assign-device.ts`, `todayInVietnam`, validators, `device-form.ts` diff cases.
- Markup tests with `renderToStaticMarkup`: export props-only `AssignDeviceFields`; test "No expiry" disabling the date, the char counter, owner/holding display. Dialog shell untested, like the others.
- No `Date.now()` in components: pass `today` as a prop or derive in the pure helper with injected `now`.

## Existing UI tests that change
- `DevicesView.test.tsx`: `base`/`stored` fixtures need the new fields; `th scope="col"` count 6 → 7 (7 → 8 with actions) with a Details column; empty-text test follows copy; add cases for Assign on `canAssign`, the holding line, "No expiry".
- `devices-state.test.ts`: filter label "Inventory" → "Not placed".
- `device-form.test.ts`: `emptyForm`, `formFromDevice`, `toCreateBody`, `toPatchBody` (new keys, null-for-empty, unchanged when only formatting differs).
- `DeviceFormDialog.test.tsx`: field count and labels; "create has no owner fields" stays.
- `device-actions.test.ts`: Assign/edit-holding gating by flag.
- `delete-device-flow.test.ts`, `DeleteDeviceDialog.test.tsx`: shrink or delete (F).
- `devices-api.test.ts`: `assign`, `updateHolding` paths, bodies, error mapping.
- `DeviceDto` fixtures: `place-device.test.ts`, `PlaceDeviceDialog.test.tsx`, `SearchView.test.tsx`, `SeatDetailPanel.test.tsx` and others (`pnpm typecheck` lists them); search/seat DTOs only if they gain fields.
- `src/ui/copy` coverage test: new API codes need messages.

## Risks
- **Time zone:** browser local midnight vs server UTC+7; users abroad may be refused around midnight. UI uses only the shared helper and always shows the server's message.
- **Picker coupling:** importing `SeatsView`/`seatsCopy` couples devices UI to seats UI; move `CLIP` to a shared `ui` constant; parametrize labels if not neutral.
- **Stale flags:** `canAssign`/`canEditHolding` can go stale with two admins; dialog refetch covers it; server must answer 409 with a code the UI refetches on (`device_owned`).
- **R7:** assign and holding edit refusals are domain-level (409/422) after the wrapper.
- **Wide table:** seven columns + Actions on `md` is tight; one Details column keeps it close to today.
- **a11y:** checkbox + date input in one `fieldset`/`legend` ("Expiry"); disabled date keeps its label.
- **Focus after a removed row:** reuse `headingRef.focus()`.

## Open questions (defaults)
1. Expiry default in the dialog: "No expiry" checked, date empty.
2. Holding edit from a separate "Note / expiry" button (Edit dialog is owner/Admin; holding edit Admin/Manager) — keeps `PATCH /api/devices/:id` free of holding fields.
3. A Manager can assign to themselves: yes.
4. Serial/manufacturer/brand in one "Details" column (default) or three columns.
5. "No expiry" shown only when there is a holding.
6. Remove the Delete dialog's dead "placed" flow in this ticket: yes.
7. SearchView shows serial now: no unless the search DTO carries it; else a debt follow-up.
