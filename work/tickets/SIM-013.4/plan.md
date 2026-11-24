Status: READY

# Plan — SIM-013.4: Device create and edit dialog

## Scope summary
From `docs/spec-v1.md` §DEV (lines 259-271):
- DEV-01: "A device type is picked from a suggested list (PC, Laptop, Monitor, IP phone, Other) or typed freely (D37)."
- DEV-01: "A device has type, inventory number (unique), MAC (unique if set; format checked), name and owner (exactly one
  member)."
- DEV-01: "A User or Manager creates devices only for their own member and edits or deletes only their own devices. An
  Admin can do this for any member. Editing or deleting a device: its owner or an Admin only (D19)."
- DEV-01: "New devices start in inventory. Editing a device cannot change its owner (seatMGT)."
- DEV-02: "Every device list and device detail shows 'at seat X' or 'in inventory'." This is already done by SIM-013.2.
  This ticket only keeps a new device visible after create (see Approach step 6).

From `work/decisions.md`:
- D19 (line 26): "editing/deleting a device is owner or Admin only."
- D36 (line 43): "all user-facing text lives in copy files … Names/data keep Vietnamese diacritics."
- D37 (line 44): "Device type: suggested list (PC, Laptop, Monitor, IP phone, Other) plus free text."

From the approved SIM-013.2 plan (`work/tickets/SIM-013.2/plan.md` lines 234 and 241-262), this ticket is the slice
"Create and edit: `device-form.ts`, `DeviceFormDialog.tsx`, `devices-api.create/update`, 'New device' button (every
member), and an Edit row action gated by `canEdit`". The choices recorded there for this slice are binding: the form
logic sits on the lib validators, `normalizeMac` is used for the MAC comparison, `ownerId` is sent only by an Admin, the
inline owner picker has no nested modal, the type field uses a datalist, `deviceErrorMessage` handles the device codes,
and `not_found` means something different on create and on edit.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A member creates a device for themselves; an Admin can also create one for another member. | `device-form.test.ts` › "create for self sends no ownerId", "Admin for a member sends ownerId", "non-Admin never sends ownerId", "member kind without a pick is invalid". `devices-api.test.ts` › "create sends POST /api/devices with JSON". `DeviceFormDialog.test.tsx` › "non-Admin create has no owner UI", "Admin create shows Me / Another member", "picker only for Another member". `DevicesView.test.tsx` › "New device button when onNew is given". Manual run: `pnpm dev`, create as User, then as Admin for another member. |
| 2 | Edit changes only the changed fields; the owner cannot be changed; Edit shows only where the server says `canEdit`. | `device-form.test.ts` › "patch sends only changed fields", "MAC retyped in another form is unchanged", "blank MAC clears to null", "nothing changed is unchanged", "patch never has ownerId". `DeviceFormDialog.test.tsx` › "edit shows the owner as text, no radios, no picker". `device-actions.test.ts` › "Edit only when canEdit and onEdit", "place and edit actions are independent". `devices-api.test.ts` › "update sends PATCH /api/devices/<id>". |
| 3 | Duplicate inventory number or MAC and an inactive owner show clear messages. | `device-form.test.ts` › "deviceErrorMessage": `member_not_assignable` gives the device text; `inventory_number_taken`, `mac_taken` and `no_linked_member` give the shared `apiErrorMessage` text; unknown codes give the generic text. `DeviceFormDialog.test.tsx` › "error prop renders as an alert". |
| 4 | Static-render and pure-logic tests (no jsdom) cover the form logic and the Admin-only owner picker. | All the tests above use `renderToStaticMarkup` or plain functions. `pnpm test` passes, including `copy.test.ts` and `no-literals.test.ts`. |

Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Ming verification after merge
None. The manual create and edit runs (as User, and as Admin for another member) can be done in a local `pnpm dev` with
`docker compose -f compose.dev.yml up -d` and `pnpm seed:dev`. The reviewer or Ming can do them; they are listed in
the ticket's test plan.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/devices/device-form.ts` | New pure module: `DeviceForm`, `emptyForm`, `formFromDevice`, `fieldMessage`, `toCreateBody`, `toPatchBody`, `deviceErrorMessage`, `filterAfterCreate` | Form logic on top of `@/lib/validate/device` (approved decision) | No |
| `src/ui/devices/device-form.test.ts` | New unit tests | R5, AC1-3 | No |
| `src/ui/devices/DeviceFormDialog.tsx` | New: `DeviceFormDialog` (outer/inner), exported props-only `DeviceFormFields`, internal `OwnerPicker` | The dialog | No |
| `src/ui/devices/DeviceFormDialog.test.tsx` | New static-render tests | AC2, AC4 | No |
| `src/ui/devices/devices-api.ts` | Add `create(body)` and `update(id, body)` | No client methods for POST and PATCH yet | No |
| `src/ui/devices/devices-api.test.ts` | Add `describe("devices-api create and update")` | R5 | No |
| `src/ui/devices/device-actions.ts` | `onEdit` in `DeviceRowHandlers`; `rowActions` builds a list from independent handlers (remove the early return) | Edit row action; keeps the extension point for SIM-013.5 `onDelete` | No |
| `src/ui/devices/device-actions.test.ts` | Edit cases | R5 | No |
| `src/ui/devices/DevicesView.tsx` | Optional `onNew` prop; heading row with a "New device" button | Create entry for every member | No |
| `src/ui/devices/DevicesView.test.tsx` | New-button cases, plus Edit row buttons | R5 | No |
| `src/ui/devices/DevicesPage.tsx` | `form` state, `isAdmin` from the session, `onNew`/`onEdit`, render `DeviceFormDialog` | Wiring | No |
| `src/ui/copy/devices.ts` | Add `newDevice`, `actions.edit`/`editAria`, `typeSuggestions`, `form.*` | D36 | No |

No other file. `src/ui/copy/api.ts` and `src/ui/index.ts` stay unchanged. Nothing changes on the server or under
`src/lib`.

## Data model / migration
None.

## API contract
None changed. The UI uses these existing endpoints:
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `/api/devices` | `{name, type, inventoryNumber, mac?, ownerId?}` | 201 `DeviceDto` | 400 invalid, 404 `not_found` (owner gone), 409 `inventory_number_taken`/`mac_taken`, 422 `no_linked_member`/`not_allowed`/`member_not_assignable` (`src/server/devices/devices.ts:304-345`) | any member for self; Admin for anyone |
| PATCH | `/api/devices/:id` | non-empty partial `{name?, type?, inventoryNumber?, mac?}` | 200 `DeviceDto` | 404 `not_found`, 409 uniqueness, 422 `not_allowed` (`devices.ts:355-404`) | owner or Admin (D19) |
| GET | `/api/members?…` through `seatsApi.activeMembers` (`src/ui/seats/seats-api.ts:141`) | existing | existing | existing | existing (only an Admin's dialog calls it) |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `device-form.test.ts` › `emptyForm`/`formFromDevice`: mac null → `""`, owner `{kind:"me"}` | form setup |
| › toCreateBody: "create for self sends no ownerId" (non-Admin and Admin with `kind:"me"`; `"ownerId" in body` is false) | AC1, ticket "Non-Admins never send `ownerId`" |
| › toCreateBody: "Admin for a member sends ownerId" | AC1 |
| › toCreateBody: "non-Admin never sends ownerId" even with `owner:{kind:"member", member}` | AC1, `devices.ts:317` |
| › toCreateBody: "member kind without a pick is invalid" (Admin, `member:null` → `invalid` with `fieldErrors.ownerId`, never a body for "me") | consult risk: no silent create for self |
| › toCreateBody: MAC `AA-BB-CC-DD-EE-FF` → `aa:bb:cc:dd:ee:ff`; Cisco and bare forms accepted; blank MAC → `mac: null`; `zz:…` → invalid with `fieldErrors.mac` | MAC normaliser |
| › toCreateBody: blank name / type / inventory number → the matching field message; name of 121 code points → name message; `"  Máy trạm  "` → `"Máy trạm"` (NFC, trimmed); an NFD-typed `"Máy"` is sent as NFC | validation, Vietnamese diacritics (Domain focus) |
| › toPatchBody: "patch sends only changed fields" (only `type` edited → `{type}`) | AC2 |
| › toPatchBody: "nothing changed is unchanged"; whitespace-only and NFD-vs-NFC differences → unchanged | AC2 |
| › toPatchBody: "MAC retyped in another form is unchanged" (`AA-BB-…` vs stored `aa:bb:…`); stored `null` plus blank → unchanged | AC2, consult risk |
| › toPatchBody: "blank MAC clears to null" (stored MAC, field blanked → `{mac:null}`); invalid MAC → invalid with `fieldErrors.mac`; blank name → name message | AC2 |
| › toPatchBody: "patch never has ownerId" (keys ⊆ name/type/inventoryNumber/mac) | AC2, `validate/device.ts:113` |
| › deviceErrorMessage: `member_not_assignable` → `devicesCopy.form.errors.memberNotAssignable`; `inventory_number_taken`, `mac_taken`, `no_linked_member` and `not_allowed` equal `apiErrorMessage(code)`; `"zzz"` → the generic message | AC3 |
| › filterAfterCreate: `placed` → `all`; `all` and `inventory` unchanged | new device visible (DEV-02) |
| `DeviceFormDialog.test.tsx` › "fields and datalist": name/type/inventory/MAC labels; one `<datalist>` whose `id` equals the type input's `list`; 5 options from `typeSuggestions`; `maxlength` 120/60/60 | D37 |
| › "non-Admin create has no owner UI": no `name="owner-kind"`, no picker search label | AC1, AC4 |
| › "Admin create shows Me / Another member": two `name="owner-kind"` radios, "Me" checked, no picker | AC1, AC4 |
| › "picker only for Another member": with `owner.kind:"member"`, the picker search label (`seatsCopy.actions.pickerSearch`) renders; `loadPage` (a `vi.fn`) is not called during render; with a picked member, `ownerSelected(name)` shows | AC4 |
| › "edit shows the owner as text, no radios, no picker" (also for an Admin) | AC2 |
| › "error prop renders as an alert" (inside `EntityFormDialog` as in `PlaceDeviceDialog.test.tsx`) | AC3 |
| `devices-api.test.ts` › "create sends POST /api/devices with JSON"; 201 body → ok; 409 `mac_taken` passes through; a body without id → internal | AC1 |
| › "update sends PATCH /api/devices/<id>" (id encoded, JSON body); 404 → `not_found` | AC2 |
| `device-actions.test.ts` › "Edit only when canEdit and onEdit" (no `onEdit` → no edit; `canEdit:false` → no edit); `run` calls `onEdit(d)`; `ariaLabel` "Edit device INV-7" | AC2 |
| › "place and edit actions are independent": `{onEdit}` alone on a `canPlace:true, canEdit:true` row gives only `edit`; `{onPlace, onEdit}` gives place keys then `edit`; `{}` gives `[]`; existing tests unchanged | extension point, SIM-013.3 regression |
| › hasAnyAction: true for a `canEdit`-only row with `onEdit` | actions column |
| `DevicesView.test.tsx` › "New device button when onNew is given": the label shows with `onNew`; without it, the existing `<button` count of 3 still holds | create entry |
| › "Edit buttons on canEdit rows" (`actions={{onEdit}}`, table plus card list → 2 per row) | AC2 |

## Approach
1. **Copy** (`src/ui/copy/devices.ts`). Add:
   - `newDevice: "New device"`
   - `actions.edit: "Edit"` and `actions.editAria: (inv) => \`Edit device ${inv}\``
   - `typeSuggestions: ["PC", "Laptop", "Monitor", "IP phone", "Other"] as const` (D37 wording exactly)
   - `form`:
     - `createTitle` ("New device") and `editTitle` ("Edit device")
     - `create` ("Create"); edit submits with `kitCopy.save`
     - `fields` {name, type, inventoryNumber, mac, owner}
     - `macPlaceholder` ("AA:BB:CC:DD:EE:FF")
     - `ownerMe` ("Me") and `ownerOther` ("Another member")
     - `ownerSelected: (name) => \`Owner: ${name}\``
     - `ownerReadOnly` ("The owner can't be changed.")
     - `fieldErrors` {name, type, inventoryNumber, mac, ownerId, body}. Build the length limits into the texts from
       `DEVICE_LIMITS` (`@/lib/devices/types`). `ownerId` is "Choose a member."
     - `errors.memberNotAssignable`: "This member is inactive, so they can't own a device."

   The copy stays ASCII (`copy.test.ts`). The placeholder must come from copy, because `no-literals.test.ts`:8 flags
   literal `placeholder=`.
2. **`device-form.ts`** (pure, imports only `@/lib/*` and `../copy/*`). Mirror `src/ui/rooms/room-form.ts:24-59`.
   - `DeviceForm = { name; type; inventoryNumber; mac: string; owner: { kind: "me" } | { kind: "member"; member:
     PickerMember | null } }`. `PickerMember` comes from `../seats/member-picker`. This widens the approved shape by
     allowing `null` for "Another member, none picked yet".
   - `fieldMessage(field)` reads `devicesCopy.form.fieldErrors`, falling back to `body`.
   - `toCreateBody(form, { isAdmin })`:
     - If `isAdmin` and the owner kind is `member` but no member is picked, return `invalid` with the ownerId message.
     - Otherwise call `validateDeviceCreate({ name, type, inventoryNumber, mac: form.mac, ownerId })`, where `ownerId`
       is `member.id` only when `isAdmin` and the kind is `member`, and is omitted otherwise (`validate/device.ts:94-111`).
     - On ok, return `body = { name, type, inventoryNumber, mac }` from `v.value`, adding `ownerId` only when it is
       non-null. The key is absent, not `null`, for non-Admins.
     - The return type is `{kind:"ok"; body: DeviceCreateBody} | {kind:"invalid"; message}`, where `DeviceCreateBody =
       Omit<DeviceCreateValue,"ownerId"> & { ownerId?: string }`.
   - `toPatchBody(form, device)`:
     - For name, type and inventory number, add `form[f]` to `changed` when `form[f].normalize("NFC").trim() !==
       device[f]`.
     - For the MAC, let `n = normalizeMac(form.mac)` (`validate/device.ts:66-76`). If `n === undefined`, set
       `changed.mac = form.mac` so the validator reports `mac`. Otherwise, if `n !== device.mac`, set
       `changed.mac = n`, which is `null` for a blank field.
     - Return `unchanged` when `changed` is empty. Otherwise call `validateDevicePatch(changed)` (`:114-133`) and
       return `ok`, `unchanged` or `invalid`.
   - `deviceErrorMessage(code)`: `member_not_assignable` maps to `devicesCopy.form.errors.memberNotAssignable`, and
     every other code goes through `apiErrorMessage(code)`. `src/ui/copy/api.ts` stays unchanged (see Assumption 1 for
     `no_linked_member`).
   - `filterAfterCreate(f)` returns `f === "placed" ? "all" : f`.
3. **`devices-api.ts`**. Inside the returned object, next to `place` (lines 52-61):
   - `create: (body: DeviceCreateBody) => call<DeviceDto>("/api/devices", { method: "POST", headers: json, body:
     JSON.stringify(body) }, oneDevice)`
   - `update: (id: string, body: DevicePatchValue) => call<DeviceDto>(devicePath(id), { method: "PATCH", … },
     oneDevice)`

   `res.ok` already covers 201. Import the `DeviceCreateBody` type from `./device-form`. The import direction is UI
   to UI, with no cycle, because `device-form` does not import `devices-api`.
4. **`device-actions.ts`**.
   - Add `onEdit?: (device: DeviceDto) => void` to `DeviceRowHandlers` (lines 5-8). Update the comment to say that
     SIM-013.5 adds `onDelete` the same way.
   - Rewrite `rowActions` (lines 19-28):
     - Start from `const out: RowAction[] = []`.
     - If `h.onPlace`, push the `placeModes(d)` actions as they are today.
     - If `h.onEdit && d.canEdit`, push `{ key: "edit", label, ariaLabel: editAria(d.inventoryNumber), run }`.
     - Return `out`.
   - The order is place modes, then Edit. SIM-013.5 appends Delete after Edit. `hasAnyAction` is unchanged.
5. **`DeviceFormDialog.tsx`** (`"use client"`), using the pattern from `RoomFormDialog.tsx:21-131`.
   - **Outer component.** Props are `{ open, device: DeviceDto | null, isAdmin, api: DevicesApi, loadPage: LoadPage,
     onClose, onDone }`. It returns `null` when closed. Otherwise it renders `<DeviceFormInner key={device?.id ??
     "new"} …/>`.
   - **Inner component.**
     - It holds `form`, `error` and `submitting` state.
     - On submit, edit uses `toPatchBody`. `unchanged` calls `onClose()`, and `invalid` calls `setError`. Otherwise it
       calls `api.update`.
     - Create uses `toCreateBody(form, { isAdmin })` and then `api.create`.
     - On the result, `ok` calls `onDone()`. `not_found` calls `onDone()` on edit, where the device is gone. On create,
       `not_found` keeps the dialog open with `deviceErrorMessage("not_found")`, because the owner is gone. Any other
       code calls `setError(deviceErrorMessage(code))`.
     - `EntityFormDialog` gets the title `createTitle` or `editTitle`, the subtitle `device?.inventoryNumber` on edit,
       and the submit label `form.create` or `kitCopy.save`.
   - **`DeviceFormFields`** (exported, props only, no effects). Props are `{ mode: "create" | "edit", isAdmin, form,
     ownerName: string | null, loadPage, onField(key, value), onOwner(owner) }`.
     - Four `DialogField`s (`EntityFormDialog.tsx:123-140` spreads `...rest`):
       - name: `maxLength={DEVICE_LIMITS.name}`, `required`, `autoComplete="off"`
       - type: `list={listId}` (`useId`), `maxLength={DEVICE_LIMITS.type}`, `required`
       - inventory number: `maxLength={DEVICE_LIMITS.inventoryNumber}`, `required`, `spellCheck={false}`
       - MAC: `spellCheck={false}`, `autoComplete="off"`, the placeholder from copy, and no `maxLength` (a pasted value
         with spaces would be cut silently; the validator is the gate)
     - The `<datalist id={listId}>` is a sibling after the type field, not inside its label. It holds one
       `<option value>` per `typeSuggestions` entry.
     - The owner section depends on the mode:
       - Edit: a read-only block with the `fields.owner` caption, `ownerName` and `ownerReadOnly`. It has no input,
         for everyone.
       - Create as Admin: a `<fieldset>` whose `<legend>` is `fields.owner`, holding two radios with `name="owner-kind"`
         (distinct from the picker's `name="member"`, `MemberPickerDialog.tsx:68`). "Me" calls `onOwner({kind:"me"})`,
         which clears the member. "Another member" calls `onOwner({kind:"member", member:null})`. When the kind is
         `member`, render `<OwnerPicker loadPage onPick={(m) => onOwner({kind:"member", member:m})} />` and, when a
         member is picked, `ownerSelected(member.displayName)`.
       - Create as non-Admin: nothing.
   - **`OwnerPicker`** (internal).
     - It calls `useMemberPicker(loadPage, 0)` (`useMemberPicker.ts:16`) and renders `MemberPickerFields`
       (`MemberPickerDialog.tsx:21-116`) with `occupantId={null}`.
     - Its `onSelect(id)` calls `picker.select(id)` and then `onPick` with the member from `state.items`.
     - It is mounted only while the kind is "Another member", so the list loads lazily and unmounting it drops the
       picker state.
     - The picked member lives in the form state, because a new search resets `selectedId` (`member-picker.ts:48-49`).
       That is why the `ownerSelected` line exists.
6. **`DevicesView.tsx`**. Add an optional `onNew?: () => void` prop. Wrap the h1 (line 36) in `<div className="flex
   items-center justify-between gap-3">`, the same as `RoomsView.tsx:35-42`, followed by `{onNew && <Button
   icon="add" onClick={onNew}>{devicesCopy.newDevice}</Button>}`. There is no role gate, because any member may create
   (`src/lib/devices/rules.ts:12`).
7. **`DevicesPage.tsx`**.
   - `const session = useSession(); const isAdmin = session ? atLeastTier(session.tier, "admin") : false;`. This is
     the `RoomsPage.tsx:23-24` pattern. An undefined session or tier counts as non-Admin.
   - `const [form, setForm] = useState<{ device: DeviceDto | null } | null>(null)`.
   - Add `onEdit: (device) => setForm({ device })` to the memoised `actions`.
   - Pass `onNew={() => setForm({ device: null })}` to the view.
   - Render `<DeviceFormDialog open={form !== null} device={form?.device ?? null} isAdmin api loadPage=
     {seatsApi.activeMembers} onClose={() => setForm(null)} onDone={…} />`.
   - On done, close the dialog. After a create, let `next = filterAfterCreate(filter)`. If `next !== filter`, call
     `setFilter(next)` (`useDevices` reloads on a filter change). Otherwise, and always after an edit, call
     `void refresh()`.
8. Run all Checks.

Rules:
- R1: the new files are in `src/ui/devices`. They import `@/lib/*` and `../*` UI only. `pnpm check:layers` enforces
  this.
- D36: every visible string comes from `devicesCopy`, `kitCopy` or `seatsCopy`. `no-literals.test.ts` checks this.
- R4: the Delete action and dialog are SIM-013.5. There are no server changes.
- R5: the tests above.
- R7: does not apply to the UI. Both calls are single writes through `apiFetch`, and the client adds no retry.
- R2, R3 and R6 are not touched.

## Specialist input used
frontend-developer (`consult-frontend-developer.md`):
- **Adopted:**
  - Findings on `rowActions` (the early return has to go; gate Edit on `canEdit`).
  - The outer/inner dialog pattern.
  - `create`/`update` reusing `call`/`oneDevice`.
  - Validator field names.
  - Error codes and the device-specific mapper.
  - The lazy picker mounted under "Another member", with distinct radio names.
  - `useSession` + `atLeastTier`.
  - The `onNew` prop.
  - Recommendations 1-6 and all risks.
- **Changed:**
  - `owner.member` may be `null`, so "Another member" chosen with nobody picked is representable and refused (risk 4).
  - No `maxLength` on the MAC field. The consult left it optional, and silent truncation of a pasted value is worse
    than a validator message.
  - The owner UI lives inside one exported `DeviceFormFields` instead of a separate `DeviceOwnerFields`. It is the
    same testability with one component fewer, because the hook-using `OwnerPicker` renders statically without
    running effects.
  - The `ownerSelected` line was added because a new search clears the picker's `selectedId`.
- **Open questions answered:**
  - Q1: "New device" goes in the heading row, right-aligned, the same as Rooms (`RoomsView.tsx:35-42`).
  - Q2: `no_linked_member` keeps the shared text (Assumption 1).
  - Q3: after a create with the `placed` filter, the filter switches to `all`. Otherwise it is a plain refresh.
  - Q4: the Admin stays in the picker list. Picking themself is the same as "Me"; the server accepts it
    (`devices.ts:314-317`).

## Assumptions
1. **`no_linked_member`.** The ticket asks for a device message "for `member_not_assignable` (and `no_linked_member`)".
   The shared text, "Your member profile in this organization isn't set up yet. Open simap's home page to finish it."
   (`api.ts:34-35`), is accurate for devices too. `AuthGate` calls `/api/me` on every way into an org
   (`AuthGate.tsx:226,319`), and that call creates the member row (`members.ts:50-64`). So `deviceErrorMessage` passes
   `no_linked_member` through, and a test pins that. Default: keep it. Ming can ask for a device-worded override,
   which is a one-line copy addition.
2. The approved `DeviceForm` shape is widened to `member: PickerMember | null` (see Specialist input).
3. `maxLength` counts UTF-16 units. NFC Vietnamese letters are one unit each, so the limit never blocks a valid NFC
   value. A pasted NFD string could be cut a little early. This is accepted; the validator still gives the field
   message.
4. The order of row actions is place modes, then Edit, and SIM-013.5 appends Delete. The `DeviceRowHandlers` and
   `rowActions` push-list is the extension point SIM-013.5 builds on.
5. A successful edit refreshes the list without changing the filter. An edit cannot change placement.
6. Hotspots: no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (`work/backlog.md`). SIM-013.5 (BACKLOG) will touch
   `device-actions.ts`, `DevicesPage.tsx`, `devices-api.ts` and `copy/devices.ts` after this ticket merges.
7. Estimated size is about 380 source lines plus tests, which is one cycle. No split.

## Blocking questions
None.

## Split proposal
None. This plan is itself the SIM-013.4 slice of the approved SIM-013.2 split.
