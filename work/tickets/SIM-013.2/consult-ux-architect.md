## SIM-013.2 UI consult (read-only)

### Findings
- **Template.** Rooms is a card grid with Button actions. Audit (`src/ui/audit/AuditView.tsx`) is the only table. Devices should copy the Audit table styles: `Card overflow-x-auto`, a `<table>` with `HEAD`/`CELL` classes, and `border-b border-outline-variant`.
- **Page shell.** Both pages use `p-4 lg:p-6 flex flex-col gap-4`, an `h1.text-h2.font-extrabold`, and the "New" Button top-right, shown only if the user may.
- **Shared states.** The loading skeleton, the error Card (`role=alert` plus a retry Button using `apiErrorMessage`) and the empty Card are the same in both views. Copy sits in `src/ui/copy/*`. `shellCopy.pages.devices` already has `title` and `empty` ("No devices yet.").
- **Existing placeholder.** `src/app/(app)/devices/page.tsx` is a `PageSkeleton` and should be replaced by `DevicesPage`.
- **Filter control.** `FilterChips` in `src/ui/Chip.tsx` is an existing radiogroup control, and `PlacementFilter` ("all" | "placed" | "inventory") is in `src/lib/devices/types.ts`.
- **Dialogs.**
  - `EntityFormDialog` provides `DialogField` and `DialogSelect`. It wraps a native `<dialog>` that traps focus, handles Esc and returns focus.
  - `EntityFormDialog` has `error`, `submitting` and `subtitle` props.
  - `DialogField` spreads its props onto `<input>`, so `list={id}` works for a datalist.
- **Server contract (SIM-013.1, already merged).**
  - `GET /api/devices?placement=` returns `{items, truncated}`, with a limit of 1000.
  - Each `DeviceDto` has `owner{id,displayName}`, `placement|null{seatCode,roomCode,roomId,seatId,role}`, `mine`, `canEdit` and `canPlace`.
  - POST takes `{name, type, inventoryNumber, mac?, ownerId?}`.
  - PATCH takes `name`, `type`, `inventoryNumber` and `mac` only. The owner never changes.
  - DELETE returns 409 `device_placed`, and `api.ts` already has copy for it ("This device is at a seat. Move it to inventory before deleting it.").
  - PATCH and DELETE are available through `/api/devices/[id]`.
  - `/api/devices/[id]/placement` is a PUT with `{seatId: null, expectedSeatId}` for returning a device to inventory.
- **Limits and MAC.** Limits are name 120, type 60, inventoryNumber 60. The server accepts MAC in several forms and normalizes to lowercase colon form. A blank MAC means null.
- **Unseen.** I did not read `useRooms.ts`, `rooms-api.ts`, `room-form.ts`, `delete-flow.ts` or `RoomCard.tsx`, so the plan should mirror them directly.

### Recommendations

**Layout (AC1)**
- `DevicesView` is pure and takes props, as `RoomsView` does.
- Header row: h1, plus a "New device" Button shown to any member. Check that against what `canEdit` means for create.
- Toolbar row under it: `FilterChips` ("All / Placed / Inventory") with `ariaLabel` from copy. Add a small count text, plus a "list truncated at 1000" note if `truncated` is true.
- Filter on the server via `?placement=` (the param exists) so truncation applies per filter. Alternatively fetch all and filter client-side, which is simpler and avoids a refetch flicker. Pick one in the plan. I lean towards server-side, because the API supports it and `useDevices(filter)` can then be tested as pure state.

**Table columns (AC1)**
- Order: Name (with an owner line beneath it on mobile), Type, Inventory no., MAC, Owner, Placement, Actions.
- Mark the owner's own devices with a "You" tag when `mine` is true.
- MAC is shown in monospace, or "—" when null.
- Placement cell:
  - Placed: "at seat {roomCode}-{seatCode}", or "at seat X" if the seat code is already unique. Check how `SeatDetailPanel` and `copy/seats.ts` render seat labels and reuse them, so the wording stays consistent. Add the role: show a "Primary" or "Secondary" chip, using the existing `Chip`. The cell can link to the room.
  - Inventory: "in inventory", muted.
- Copy: `devicesCopy.placement.atSeat(roomCode, seatCode)` and `devicesCopy.placement.inInventory`, all in `src/ui/copy/devices.ts`.

**Mobile**
- Audit uses `min-w-[40rem]` with horizontal scroll, which is poor for 7 columns.
- Recommended: render the table at `md:` and up (`hidden md:block`), and below `md` render a stacked list. Each item is a `Card` with the name (bold), the type and inventory number on one muted line, the owner, a placement chip, and the actions underneath.
- Both layouts are produced from the same `DeviceTable` component so the static-render tests cover both.
- Keep the stacked layout out of `<table>` semantics.
- Use `<ul>/<li>` in the stacked layout.
- Avoid duplicating `aria-label`s in both layouts. CSS-hidden content is still in the DOM for `renderToStaticMarkup`, which is fine, but note it for the test queries.
- A simpler alternative is a single responsive grid-based row with `display:block` cells below `md`. I prefer the dual render for clarity.

**Filter empty states (AC1)**
- all: the existing `shellCopy.pages.devices.empty` ("No devices yet.") plus the New button.
- placed: "No devices are placed at a seat."
- inventory: "No devices in inventory."
- Use the `px-6 py-12 text-center` Card. Add a copy key per filter. The empty state under a filter should offer "Show all", not "New".

**Create/edit dialog (AC2)**
- `DeviceFormDialog` has the same open/key pattern as `RoomFormDialog` (remount per device id). Pure helpers go in `device-form.ts`: `emptyForm`, `formFromDevice`, `toCreateBody`, `toPatchBody` (returning unchanged, invalid or ok, like room-form), and a mac input helper.
- Fields in order:
  - Name (required, max 120).
  - Type with `list="device-types"`. The datalist suggestions are PC, Laptop, Monitor, IP phone and Other (D37). Free text is allowed and required (max 60). Put the suggestions in `devicesCopy.typeSuggestions`.
  - Inventory number (required, max 60).
  - MAC (optional). Autocomplete off, spellcheck off. Placeholder "aa:bb:cc:dd:ee:ff", with a hint that other forms are accepted.
  - Owner. On create, for Admin only, a picker defaulting to "Me" (omit `ownerId`, which the server treats as the caller). On edit, a read-only display of `owner.displayName` (disabled `DialogField`, or plain text) for everyone.
- Set `maxLength` on the inputs to the `DEVICE_LIMITS` values. Trim in the form helper, and let the server's NFC normalization stand. Validate client-side with code points (`[...s].length`), as the server does.
- Map `invalid_request` to a generic message through `apiErrorMessage`. Fields in the form are validated client-side first, with the same rules, so users see field messages (for example "Name is required") before the call.
- Owner picker: `MemberPickerDialog` is its own modal. The nested-dialog option should be avoided. Prefer an inline `DialogSelect` or a combobox fed by `useMemberPicker`, or open the picker as a second step (a "Choose owner" button that closes the form dialog and re-opens it). Resolve this in the plan (see open questions).
- The edit subtitle can show the owner. Disable submit while submitting.

**Delete flow (AC3, D31)**
- `DeleteDeviceDialog` has two steps, driven by the 409 `device_placed` response from `DELETE`, not by a pre-check. That avoids a race with the list's `placement` being stale.
  - Step 1 (any device): "Delete {name}? This can't be undone." Submit "Delete".
  - On 409 `device_placed`: switch the same dialog to the placed step. Body: "{name} is at seat X. Move it to inventory before deleting it." Submit "Move to inventory" (calls PUT placement `{seatId: null, expectedSeatId: placement.seatId}`), then automatically retry the DELETE, or switch to a "Delete" confirm. AC3 says "offers 'Move to inventory' and then the delete", so show "Move to inventory", and after it succeeds go back to the plain delete confirm (a visible second step). Do not chain destructive actions silently.
  - Skip step 1's wording if the row's `placement` is not null: open the dialog directly in the placed step. The 409 remains the fallback if the list was stale.
  - Errors: `not_found` on delete or move means someone else removed it, so close and reload (as `DeleteRoomDialog` does). A placement conflict (the seat changed, probably 409 `placement_changed` or similar) should reload the device and update the dialog.
- The pure state machine goes in `delete-device-flow.ts`, with tests (like `delete-flow.ts`).
- Check the actual error code for a stale `expectedSeatId`. I did not read the placement route.
- Admin and owner both reach `canEdit`. `canPlace` also covers Managers. A Manager who isn't the owner can see Move to inventory in the dialog, but cannot reach it, since the dialog is gated by `canEdit`. The server's rule decides the result: if `canEdit` is true but `canPlace` is false (possible only if owner/Admin lacks place rights, which D19 says doesn't happen), show a "ask a manager" message. Probably unreachable.

**Action visibility (AC2)**
- Show Edit and Delete only when `device.canEdit`. Hide them entirely, not disabled, matching `RoomsView`.
- If the whole Actions column has no actions, hide the column header in the table. Alternative: always keep the column header and use an empty cell. Prefer hiding the column when `items.every(d => !d.canEdit)`.
- Do not use any client-side role checks for edit and delete. The server flag is the source. The "New" button is for every member (any signed-in member can create a device).
- Place/move/return (`canPlace`) belongs to SIM-013.3. Do not render those buttons in this slice. Leave a slot for them.
- Owner picker shows only when `session` says Admin. Use whatever the Rooms page uses for `canManage`.

**Accessibility**
- Filter: `FilterChips` is a radiogroup with `aria-checked` buttons. It lacks arrow-key navigation (buttons are individually tabbable); acceptable, but note it.
- Announce results: put an `aria-live="polite"` region with the count and filter ("12 devices, inventory").
- The table has a real `<thead>` with `<th scope="col">`. Add a visually hidden `<caption>`.
- Row action labels include the device name: `editLabel(name)`, `deleteLabel(name)`, like `roomsCopy.editLabel(room.code)`. Device names are not unique, so include the inventory number: "Edit LAP-001 (Laptop 3)".
- Placement chip: a text label, not colour only.
- `<input list>` with a `<datalist>` is natively accessible. Give the datalist a stable id through `useId`.
- Dialogs use native `<dialog>` with title and error, via `EntityFormDialog`: `role="alert"` for errors, focus return to the trigger.
- After a delete, the trigger row no longer exists, so focus falls back to the body. Move focus to the h1 (`tabIndex={-1}`) or the "New device" button after a successful delete.
- Stacked mobile layout: a `<ul>` with headings per item is a fine reading order. Hit areas on mobile: Button `size="sm"` is small, so use a default size for tap targets.
- Contrast: use token classes (`text-on-surface-variant`, `text-error`), not raw colors.

**Files / structure**
- `src/ui/devices/`: `DevicesPage.tsx`, `DevicesView.tsx`, `DeviceTable.tsx`, `DeviceFormDialog.tsx`, `DeleteDeviceDialog.tsx`, `devices-api.ts`, `useDevices.ts`, `devices-state.ts`, `device-form.ts`, `delete-device-flow.ts`.
- Also `src/ui/copy/devices.ts`, plus an export check in `no-literals.test.ts`/`copy.test.ts`, which enforce D36.
- Keep UI code out of `src/server/**` (R1). Import DTOs and limits from `@/lib/devices/types`.
- Tests:
  - Static render of `DevicesView` for loading, error, empty (per filter), table and stacked layouts, `canEdit` true and false, `truncated`.
  - Pure tests for `devices-state` (filter state), `device-form` (create body, patch diff, owner omission, MAC, trimming), `delete-device-flow` and `devices-api` (status to code mapping). No jsdom.

### Risks
- A device owned by someone else may be editable only by Admin. The row's `canEdit` already captures this, but the create flow's owner picker must not appear for non-Admins, or the server will reject `ownerId` (check the server's error code).
- A stale list after a placement or delete done elsewhere. Use the 409 as the source of truth, and reload after every write.
- The truncated flag (1000 items). A large org silently loses devices unless the note is shown.
- Seat labels: "at seat X" ambiguity across rooms (the same seat code in two rooms). Include the room code to avoid confusion.
- Dual render of table and stacked list doubles the DOM and the test surface, so keep both fed from one row model.
- The owner picker inside a modal could produce a nested-dialog accessibility trap.
- The datalist is not rendered consistently across browsers, notably on Android and Safari. It is a suggestion only, and free text still works.
- `apiFetch` re-sends once on 401/403 (R7). `DELETE` and `PATCH` are idempotent enough, and POST create could duplicate. Nothing to change in the UI, but do not add retry logic.

### Open questions
1. Filter: server-side `?placement=` or client-side over one fetch? (I recommend server-side.)
2. Who may create devices? Any member, and is the owner always the caller unless Admin chooses? Confirm against D19 and `createDevice` in `src/server/devices/devices.ts`.
3. The Admin owner picker: inline `DialogSelect` of all members, or the existing `MemberPickerDialog` (searchable, paginated, but modal)? A large org makes a plain select unwieldy.
4. After "Move to inventory" in the delete flow, does the dialog return to a delete confirm, or delete straight away? I recommend a visible second confirm.
5. What error code does the placement PUT return on a stale `expectedSeatId`? I did not read `[id]/placement/route.ts`.
6. Should the seat in the Placement cell link to the room/seat page (`/rooms/[id]`)? It is useful, but it depends on whether room detail routes exist yet.
7. Does SIM-013.3 expect a `canPlace` button slot in each row, so the actions column should be laid out for three actions now?

Key files: `d:\project\simap-game-ui\src\ui\rooms\RoomsView.tsx`, `d:\project\simap-game-ui\src\ui\rooms\DeleteRoomDialog.tsx`, `d:\project\simap-game-ui\src\ui\rooms\RoomFormDialog.tsx`, `d:\project\simap-game-ui\src\ui\audit\AuditView.tsx`, `d:\project\simap-game-ui\src\ui\EntityFormDialog.tsx`, `d:\project\simap-game-ui\src\ui\Chip.tsx`, `d:\project\simap-game-ui\src\lib\devices\types.ts`, `d:\project\simap-game-ui\src\lib\validate\device.ts`, `d:\project\simap-game-ui\src\app\api\devices\route.ts`, `d:\project\simap-game-ui\src\app\api\devices\[id]\route.ts`, `d:\project\simap-game-ui\src\app\(app)\devices\page.tsx`.
