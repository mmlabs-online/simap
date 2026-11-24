# Consult — frontend-developer (SIM-013.4)

### Findings
- **Row actions are not wired for edit yet.** `device-actions.ts`: `DeviceRowHandlers` has only `onPlace`. `rowActions` returns `[]` when `onPlace` is missing, and the place actions come from `placeModes(d)`, which is gated by `canPlace`. Both `DeviceTable` (table and stacked list) and `hasAnyAction` already consume it, so an Edit action only has to be added to `rowActions`. Edit must be gated by `d.canEdit`, not `canPlace`. The `onPlace` early return has to go, because it hides every action.
- **Dialog pattern.** `RoomFormDialog` has an outer component (`open` plus a `key` of `room?.id ?? "new"`) and an inner one with `useState`. Submit calls `toPatchBody` and returns `onClose` on `unchanged`. `not_found` on edit calls `onDone`. Other errors go through `setError(apiErrorMessage)`. `PlaceDeviceDialog` uses the same shape and `EntityFormDialog`. `DialogField` passes `...rest` to the `<input>`, so `list`, `maxLength`, `required` and `autoComplete` work. It does not forward a ref or an id.
- **`DevicesApi` has no `create` or `update`.** `devices-api.ts` has `get`, `place` and `list`. `call` and `oneDevice` can be reused. POST `/api/devices` returns 201 with a `DeviceDto`. PATCH `/api/devices/:id` has no client method yet.
- **Validators.** `validateDeviceCreate(body)` returns `{ok:false, field}`. Fields are `name`, `type`, `inventoryNumber`, `mac`, `ownerId` and `body`, and the check order is the same. `validateDevicePatch` rejects an empty body with `field: "body"` and rejects `ownerId` as an unknown key. `normalizeMac` is exported and returns `null` for blank, `undefined` for invalid and the lowercase colon form otherwise. `text()` trims and NFC-normalises. It is limited to 1..max code points, and `DEVICE_LIMITS` holds the maxima: 120 for name, 60 for type and 60 for inventory number. No MAC maxLength is needed beyond 17 or so, because the MAC forms are fixed. A longer limit would reject valid bare forms, so use 17 only if the dotted and bare forms still fit (they do).
- **Server error codes for create.** `no_linked_member` (422), `not_allowed` (422, a non-Admin sending a foreign `ownerId`), `not_found` (404, owner gone), `member_not_assignable` (422, owner inactive) and the 409s `inventory_number_taken` and `mac_taken`. All of these exist in `apiCopy` already. The shared copy says `member_not_assignable` is "can't be assigned to a seat" and `no_linked_member` is "Open simap's home page", which is wrong for a device owner. So a device-specific mapper is needed, as the plan says.
- **Member picker.** `MemberPickerFields` takes `state`, `query`, `occupantId`, `canMore` and the callbacks. `useMemberPicker(loadPage, reloadToken)` loads on mount, so mounting it only inside an inner component (shown for "Another member") loads the list lazily. The radio inputs are named `name="member"`. Use different names for the owner-kind radios, such as `owner-kind`. `selectedMember(state, occupantId)` returns the selected member or `null`. `seatsApi.activeMembers` is the `LoadPage`.
- **Admin check.** `RoomsPage` uses `useSession()` and `atLeastTier(session.tier, "admin")`.
- **Page.** `DevicesPage` holds `placing` state plus `refresh` and `reload` from `useDevices`. `DevicesView` has no header action slot, so "New device" needs a prop such as `onNew` placed beside the H1 or the filter row. `DevicesView` and `DevicesPage` have no `canCreate` flag, because every member can create.
- **Copy.** `devicesCopy` has no `form` section, no `typeSuggestions`, no `actions.edit` and no field errors. Copy tests (`copy.test.ts`, `no-literals.test.ts`) must stay green.

### Recommendations
1. **`src/ui/devices/device-form.ts` (pure).**
   - Define `DeviceForm = {name, type, inventoryNumber, mac: string, owner: {kind:"me"} | {kind:"member"; member: PickerMember}}`, plus `emptyForm()` and `formFromDevice(d)` (mac `d.mac ?? ""`).
   - `toCreateBody(form, {isAdmin})` builds `{name, type, inventoryNumber, mac}` and adds `ownerId` only when `isAdmin && owner.kind==="member"`. Omit `mac` when blank (the validator treats `undefined` as null). If "Another member" is chosen but none is picked, return `invalid` with a "Choose a member" message. Call `validateDeviceCreate`.
   - `toPatchBody(form, device)` compares a trimmed, NFC-normalised string for name, type and inventory number. For MAC it compares `normalizeMac(form.mac)` with `device.mac`. If the MAC is invalid (`undefined`), include the raw string so the validator flags `field: "mac"`. A blank MAC sends `null`. It returns `unchanged` when nothing differs and calls `validateDevicePatch`. Field message mapping lives in `devicesCopy.form.fieldErrors`, keyed by `name`, `type`, `inventoryNumber`, `mac`, `ownerId` and `body`.
   - `deviceErrorMessage(code)`: `member_not_assignable` becomes "This member is inactive, so they can't own a device." and `no_linked_member` becomes a device or profile-neutral text. Everything else goes through `apiErrorMessage`. Do not touch `src/ui/copy/api.ts`.
2. **`devices-api.ts`.** Add `create(body)` (POST, JSON, `oneDevice`) and `update(id, body)` (PATCH, `devicePath`, `oneDevice`). Extend `devices-api.test.ts` with method, header and body assertions.
3. **`DeviceFormDialog.tsx`.** Use the outer/inner pattern and key `device?.id ?? "new"`. Props: `open, device, isAdmin, api, membersLoadPage, onClose, onDone`. Fields:
   - A name input.
   - A type input with `list={useId()}` and a `<datalist>` from `devicesCopy.typeSuggestions` (D37), plus `maxLength` from `DEVICE_LIMITS`.
   - An inventory number input.
   - A MAC input with `spellCheck=false` and a placeholder.
   - Owner section. On create and `isAdmin`: a radiogroup "Me" / "Another member". Choosing "Another member" mounts a separate `OwnerPicker` inner component that calls `useMemberPicker` and renders `MemberPickerFields` (with `occupantId={null}`). Keep the picked member in the form state. Selecting "Me" should unmount it and clear the member. On create and non-Admin: no owner UI. On edit: read-only text of `device.owner.displayName`, no input.
   - On the submit result: `ok` calls `onDone`. On create, `not_found` shows the error and keeps the dialog open. On edit, `not_found` calls `onDone`. Any other code goes to `deviceErrorMessage`. Keep submitting state as in `RoomFormDialog`.
   - Put the owner selection UI in an exported props-only component, such as `DeviceOwnerFields`, so static render tests can cover the Admin-only picker without effects.
4. **Row action and page wiring.**
   - Add `onEdit?: (d) => void` to `DeviceRowHandlers`. In `rowActions`, push the Edit action (`label`, `ariaLabel` with the inventory number) only when `d.canEdit && h.onEdit`, plus the place actions only when `h.onPlace`. Remove the early return, so no handlers means no actions. Add `devicesCopy.actions.edit` and `editAria`. Update `device-actions.test.ts`.
   - `DevicesPage`: a `form` state of `{device: DeviceDto|null}` or `null` (create vs edit), `isAdmin` from `useSession` and `atLeastTier`, `onNew` and the `onEdit` handler. After `onDone`, close the dialog and call `refresh()`. `DevicesView` gets an optional `onNew` prop and renders a `Button` "New device" beside the heading, for every member. Add the empty-state hint if useful, since `seed:dev` makes no devices.
5. **Tests (no jsdom).**
   - `device-form.test.ts`: `toCreateBody` self vs Admin-for-member, and a non-Admin never sends `ownerId` even when a member is set. MAC `AA-BB-…` is normalised, a bad MAC is `invalid` with the MAC message, and a blank MAC is accepted. `toPatchBody`: only changed fields, `unchanged` for MAC re-typed in another form, a blank MAC sends `null`, and an invalid field maps to its message. Code mapping for `deviceErrorMessage`.
   - `DeviceFormDialog.test.tsx` (static render): create shows no owner UI for non-Admin and the "Me / Another member" radios for Admin. The picker only shows for "Another member". Edit shows the owner as text with no radios. The datalist holds the suggestions.
   - `DevicesView.test.tsx`: "New device" shows when `onNew` is given. `device-actions.test.ts`: Edit only when `canEdit`.
6. **Copy.** Add `devicesCopy.form` (titles, field labels, owner labels, `chooseMember`, `fieldErrors`, `ownerReadOnly`, error text for the two codes) and `typeSuggestions: ["PC","Laptop","Monitor","IP phone","Other"]`. Keep all of it out of components (no-literals test).

### Risks
- Removing the `onPlace` early return in `rowActions` could change the `hasAnyAction` column behaviour. SIM-013.3 tests must still pass (for example, no handlers gives no actions).
- The picker radios and the owner-kind radios must have different `name` values, or they share one radio group.
- `DialogField` takes no ref or id. The datalist is linked through the `list` attribute, so no label problem, but the `<label>` wraps the input. Do not nest a datalist inside the label's text.
- On create with "Another member" and the picker still loading or empty, the form must refuse with a message, not silently create for "Me".
- Edit sends the unchanged value for MAC when the stored value is null and the field is blank. Compare after normalisation, or you will send `mac:null` needlessly.
- A late 401/403 is not an issue here, since both calls are single writes through `apiFetch` (R7 server side, already done).
- The session's `tier` may be undefined briefly. Treat that as non-Admin (as `RoomsPage` does).
- Inventory number and MAC uniqueness errors (409) show as page-level dialog errors and do not name the field. The shared copy already says which one, so this is acceptable.

### Open questions
1. Where should "New device" go (heading row, right-aligned, vs. the filter row)? I'd suggest next to the H1.
2. Should the `no_linked_member` device message say something like "Your member profile isn't set up yet, so you can't create devices"? I suggest a text without the "home page" pointer unless the shared one is correct for devices too.
3. Should a successful create switch the filter to "inventory" or "all", so the new device (it starts in inventory) is visible? With the "placed" filter active it would be invisible after saving. I suggest leaving the filter alone and relying on the refresh, or switching to "all" if the current filter is "placed".
4. Does the picker for "Another member" have to exclude the Admin themself? The `activeMembers` list includes them, which is harmless.

Relevant files: src/ui/devices/device-actions.ts, src/ui/devices/DevicesPage.tsx, src/ui/devices/DevicesView.tsx, src/ui/devices/devices-api.ts, src/ui/copy/devices.ts, src/ui/rooms/RoomFormDialog.tsx, src/ui/seats/MemberPickerDialog.tsx, src/lib/validate/device.ts, src/server/devices/devices.ts.
