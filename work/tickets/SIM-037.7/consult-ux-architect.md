# Consult — ux-architect (2026-11-25)

## SIM-037.7 UX consult (Devices UI: assign, note/expiry, new fields)

Read the ticket, the frontend consult, spec DEV-02, DEV-07 and the Device entity row, and `DeviceDto` in `src/lib/devices/types.ts`; not the existing components, so class names and widths are proposals. The consult's component plan (one `AssignDeviceDialog` with two modes, pure `assign-device.ts`, props-only `AssignDeviceFields`, shared `CLIP` constant) is sound.

### Findings
1. The spec already answers note visibility: spec line 340 "Every member can open a device detail page: all fields, … the current holder (since, note, expiry …)"; the Device entity row lists note and expiry as device fields; the User role "Views all … devices of the org". Org-wide visibility is specified; security's flag is a decision about narrowing the spec, not something this ticket introduces.
2. `DeviceDto` already carries `holding`, `canAssign`, `canEditHolding`, `serial`, `manufacturer`, `brand` (SIM-037.2, merged). The UI only renders them; R7 is server-side.
3. The note limit is 500 characters — too long to show whole in a table cell.

### Recommendations

**Row and card actions**
- Desktop Actions column: Assign (primary text button) first on unowned rows, "Note / expiry" first on owned rows, then Place/Move/Return, Edit, Delete. Never both (`canAssign` = unowned, `canEditHolding` = owned), so at most one more action than today.
- Delete stays last and visually separated.
- Mobile card: same buttons in the footer as a wrapping flex row, touch target ≥ 44px, Assign / "Note / expiry" first; no overflow menu.
- Labels "Assign" and "Note / expiry"; aria-labels `Assign device ${inv}` and `Edit note and expiry of device ${inv}`.
- A User gets neither; gate on DTO flags only, no client role check.

**Assign dialog**
- Title "Assign device" (assign) / "Note and expiry" (edit); device name and inventory number as read-only subtitle.
- Assign mode order: 1) Member (required, picker); 2) Note (optional textarea, 3 rows, `maxLength` 500, live counter "123/500"); 3) Expiry.
- Edit mode drops the picker and shows the current holder read-only above the note (owner change is reserved for transfer/return).
- Expiry `fieldset` with `legend` "Expiry": date input (label "Expiry date") + checkbox "No expiry".
  - Checked by default in assign mode; in edit mode follows `expiresOn === null`.
  - Checking disables and clears the date, keeps its label; unchecking focuses the date input.
  - `min` from shared `todayInVietnam()`; hint "Dates are in UTC+7".
  - Unchecked with empty date → inline error "Pick a date or choose No expiry"; never silently send "no expiry".
- Submit "Assign" / "Save"; disabled until a member is chosen (assign); busy state while running.
- Edit mode sends only changed fields.

**Desktop table: holder, holding and Details**
- One "Details" column: "Manufacturer Brand" over muted "SN: <serial>"; "SN: …" alone if both missing; dash if everything missing; wraps; `title` or `break-all` for long serials.
- Hide Details below `lg` only if the table overflows at `md`, and then show it elsewhere; the always-shown default is fine inside `overflow-x-auto`.
- Owner cell: holder name or "Org inventory" on line 1; holding sub-line only when `holding` is non-null: expiry first ("Until 2026-12-31" or "No expiry"), then the note clipped to one line (`line-clamp-1`, full text in `title`).
- No "No expiry" on unowned rows.
- Show `YYYY-MM-DD` as given by the server; never through `new Date()`.

**Phone card**
- Heading name + inventory number; lines for type, owner, holding (note clamped to 2 lines, expiry on its own line), Details (serial, manufacturer, brand); then actions.
- Same text helpers as the table (`holdingLine`, `detailsText`, tested once).

**Create/edit form**
- Serial, manufacturer, brand after MAC; optional, no `required`; serial `spellCheck={false}`, `autoCapitalize="off"`; field errors under each field.
- `serial_taken` (409) on the serial field, not a banner: "This serial number is already used by another device".
- Edit sends only changed fields; clearing sends null; the form never edits holding data.

**Empty and error states**
- Empty list: filter-specific text ("No devices in the org inventory"), pointing Admin/Manager at Create device; "No devices match" for search.
- Dialog errors as `role="alert"` inside the dialog:
  - `device_owned`: "This device was just assigned to someone else" → refresh the list and close.
  - `invalid_request` on expiry: server message under the expiry field.
  - Member refusals: message, reload the picker, keep the dialog open.
  - Network/5xx: generic retry message, dialog and typed note preserved.
- Picker finds no active members: "No active members to assign to", Assign stays disabled.

**Accessibility**
- Visible label on every input; counter and hint linked via `aria-describedby`; polite live region only near the limit.
- Expiry `fieldset`/`legend`; disabled date keeps its label; no placeholder-as-label.
- Focus: on open → first field (picker search / note); on close without change → the opening button; on success when the row leaves the filter → page heading via `headingRef`; if the row stays → its "Note / expiry" button after refresh, falling back to the heading. Polite announcement "Device assigned to <name>".
- Visible focus ring; error state not by colour alone.

**Note visibility (decision for Ming)**
- Default: follow the spec — all org members see the note (clipped in the table, full in `title`/detail).
- Add helper text under the note field: "Visible to everyone in your organization" (ship either way).
- Restricting notes to Admin, Manager and the holder needs a spec change (line 340, DEV-02) and a server DTO change — a separate ticket; the UI here just hides the line when `holding.note` is absent.

### Risks
- Table width at `md` (8 columns incl. Actions): verify at 768px and 1024px with long serials and notes.
- Browser `min` vs server UTC+7 near midnight abroad: shared helper, hint, server message.
- Focus loss after refresh: heading fallback.
- Stale flags with two admins: `device_owned` handling + refresh.
- Note exposure org-wide: matches the spec; helper text reduces surprise.
- "No expiry" default may make people skip end dates: product choice the spec allows.

### Open questions (defaults)
1. Note visibility org-wide with a dialog warning? Default yes; Ming may narrow (spec + server change).
2. Details: one column (default) or three.
3. Hide Details below `lg`? Default no; horizontal scroll if needed.
4. Edit mode shows the holder read-only? Default yes.
5. Date hint says "UTC+7"? Default yes.
6. Note clipped to one line in the table, two on the card, full text in `title`? Default yes.
