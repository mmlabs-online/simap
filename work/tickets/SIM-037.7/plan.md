Status: READY

# Plan — SIM-037.7: Devices UI: assign dialog, note/expiry edit and new device fields

UI only. The API, DTO, validators and error codes are merged in SIM-037.2 (PR #83). Everything here lives in
`src/ui/**` plus one icon list in `src/lib/icons.ts`.

**High path: none.** No file in this plan matches a High path in `.claude/loop.config.md` (no migration, nothing under
`src/server/**`, `src/proxy.*`, config, Docker or deploy). The ticket still has Gate `plan-approval` (P1), so Ming
approves this plan. The security review trigger does not fire (no `src/server/` change).

## Scope summary
- `docs/spec-v1.md` DEV-01 (lines 273-275): "A device has name, type, inventory number (unique), and optional MAC
  (unique if set; format checked), serial number (unique if set, trimmed, at most 100 characters), manufacturer and
  brand (free text, at most 100 characters each)."
- DEV-02 (lines 284-286): "Every device list and device detail shows where the device is ("at seat X", "in <member>'s
  inventory" or "in org inventory") …"
- DEV-07 (lines 307-312): "An Admin or Manager assigns a device in the org inventory to an active member, with an
  optional note (at most 500 characters) and an optional expiry date (empty = no expiry; a calendar date, not in the
  past). … An owned device cannot be assigned …" / "An Admin or Manager edits the current assignment's note and expiry
  date (this is also how an extension is granted, DEV-10)."
- Spec line 340 (note visibility): "Every member can open a device detail page: all fields, where it is, the current
  holder (since, note, expiry, …)". Notes are org-wide; this ticket keeps that and adds a hint (A1).
- `work/decisions.md` D63 (as quoted in SIM-037.2 plan): "Admin/Manager assigns one to a member with an optional note
  and an optional expiry (no expiry allowed); it lands in the member's inventory, not placed. … New optional fields:
  serial number, manufacturer, brand." D35: "Times stored in UTC and shown in UTC+7 (Asia/Ho_Chi_Minh) for every org in
  v1." D36: UI copy in `src/ui/copy/*`.
- Ticket scope: create/edit fields with `serial_taken`; Details column and holding line (table and card); Assign
  dialog (member picker reuse, note, expiry with "No expiry", min = today UTC+7) and the same dialog in edit mode;
  row actions gated by the DTO flags; refetch after success; focus to the heading when the row leaves the filter.

Server facts this plan relies on (read from the merged code):
- `DeviceDto` (`src/lib/devices/types.ts` lines 49-76): `serial`, `manufacturer`, `brand` (`string | null`),
  `holding: { note; expiresOn } | null` (null exactly when unowned; `expiresOn` is `YYYY-MM-DD`), `canAssign`
  (Manager+ and unowned), `canEditHolding` (Manager+ and owned). `DEVICE_LIMITS` has `serial/manufacturer/brand: 100`,
  `note: 500` (lines 1-10). `AssignValue`, `HoldingPatchValue` types (lines 33-35).
- `POST /api/devices/{id}/assignment` body `{ memberId, note?, expiresOn? }` → 200 `DeviceDto`; 400
  `invalid_request` (no field detail in the body), 404 `not_found`, 409 `device_owned` / `handoff_pending`, 422
  `not_allowed` / `member_not_assignable` (`src/app/api/devices/[id]/assignment/route.ts`).
- `PATCH /api/devices/{id}/holding` non-empty partial `{ note?, expiresOn? }`; null or blank clears → 200 `DeviceDto`;
  400, 404, 409 `not_assigned`, 422 `not_allowed`.
- `validateAssign(body, today)` / `validateHoldingPatch(body, today)` in `src/lib/validate/device.ts` lines 186-218
  (note: CRLF → LF, NFC, trim, ≤ 500 code points, blank → null; expiry: `parseCalendarDay` and `>= today`);
  `todayUtc7(now)` in `src/lib/devices/holding.ts` line 5. The UI reuses both (same rule client and server, R1-legal:
  ui → lib).
- `POST /api/devices` and `PATCH /api/devices/{id}` accept `serial`, `manufacturer`, `brand` (blank → null) and answer
  409 `serial_taken`; message exists in `src/ui/copy/api.ts` line 47.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | An Admin or Manager sees Assign on org-inventory devices and "Note / expiry" on owned devices; a User sees neither. | `src/ui/devices/device-actions.test.ts › assign and holding actions` (Assign only when `canAssign` and `onAssign`; "Note / expiry" only when `canEditHolding` and `onEditHolding`; both listed first; aria labels); `DevicesView.test.tsx › Assign on a canAssign row, Note / expiry on a canEditHolding row, neither when both flags are false`. Gating is by DTO flags only (no client role check). |
| 2 | Assigning with or without expiry updates the row to the member, with the note and "Until <date>" or "No expiry". | `assign-device.test.ts › toAssignBody` (no-expiry → `expiresOn: null`; date → `expiresOn: "2026-12-31"`); `devices-api.test.ts › assign sends POST /api/devices/<id>/assignment`; `DevicesView.test.tsx › owner cell shows the holder, "Until 2026-12-31" or "No expiry", and the note (title has the full text); an unowned row has no holding line`; page refetches on success (`DevicesPage.tsx` `onDone` → `refresh()`). End-to-end in Ming's manual run (below). |
| 3 | The expiry input cannot pick a day before today (UTC+7); the server refusal message shows if it does. | `assign-device.test.ts › expiryMin` (assign → today; edit with an overdue date → that date) and `› toAssignBody / toHoldingBody refuse a date before today` (injected `today`); `AssignDeviceDialog.test.tsx › date input has min=<today> and is disabled while No expiry is checked`; `assign-device.test.ts › settleAssign maps invalid_request to the expiry message`. |
| 4 | Serial, manufacturer and brand can be entered on create and edit and show in the Details column; a duplicate serial shows the `serial_taken` message. | `device-form.test.ts › toCreateBody / toPatchBody with serial, manufacturer, brand` (trim, blank → null, unchanged when only whitespace/NFD differs, clearing → null); `DeviceFormDialog.test.tsx › serial, manufacturer and brand fields with maxLength 100`; `devices-state.test.ts › detailsText`; `DevicesView.test.tsx › Details column`; `device-form.test.ts › deviceErrorMessage("serial_taken")` equals `apiCopy.errors.serial_taken`. |
| 5 | All new strings live in `src/ui/copy/*` (D36). | `src/ui/copy/no-literals.test.ts` and `copy.test.ts` stay green; review of the diff. |
| 6 | Checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
Local run with a real Identity token (`pnpm dev`), as Admin or Manager, then as a User:
1. Assign an org-inventory device with no expiry and a note → the row shows the member, "No expiry" and the note.
2. Assign another with an expiry date → "Until <date>"; the date picker does not offer days before today.
3. "Note / expiry" on an owned device: change the note, set and clear the expiry.
4. Create/edit a device with serial, manufacturer, brand; reuse a serial → "Another device already has this serial
   number."
5. Check the table at 768 px and 1024 px with a long serial and a long note (UX risk: table width).
6. As a User: no Assign and no "Note / expiry" buttons.

## Files to create / modify
Part A = device fields and display; Part B = assign / holding dialog and actions (see `## Split proposal`).

| File | Change | Required because | High path? |
|---|---|---|---|
| **Part A** | | | |
| `src/ui/copy/devices.ts` (lines 8-16, 39-56, new keys) | `columns.details: "Details"`; `form.fields.serial/manufacturer/brand` ("Serial number", "Manufacturer", "Brand"); `form.fieldErrors.serial/manufacturer/brand` ("Enter a serial number of up to 100 characters, or leave it blank." etc., from `DEVICE_LIMITS`); `details: { serial: (s) => \`SN: ${s}\`, none: "—" }`; `holding: { until: (d) => \`Until ${d}\`, noExpiry: "No expiry" }`. Part B keys below. | D36. | No |
| `src/ui/devices/device-form.ts` (lines 11-30, 44-74) | `DeviceForm` + `serial`, `manufacturer`, `brand` (strings); `emptyForm`, `formFromDevice` (`?? ""`); `toCreateBody` passes them to `validateDeviceCreate`; `toPatchBody` adds an `OPT_FIELDS` loop: `next = form[k].normalize("NFC").trim() \|\| null`, sent when `next !== device[k]`. | DEV-01 fields on create/edit. | No |
| `src/ui/devices/DeviceFormDialog.tsx` (lines 101-169) | `onField` key union widened; three `DialogField`s after MAC (no `required`, `maxLength={DEVICE_LIMITS.x}`, `autoComplete="off"`; serial `spellCheck={false}` `autoCapitalize="off"`); icons `qr_code`, `factory`, `sell`. Errors keep the dialog's existing `role="alert"` line (A6). | Ticket scope. | No |
| `src/lib/icons.ts` (lines 5-32) | Add `event`, `factory`, `qr_code` in sorted order (`event` before `event_seat`, `factory` after `fact_check`, `qr_code` after `person`). | `Icon` only accepts listed names; `icons.test.ts` checks the order. | No |
| `src/ui/devices/devices-state.ts` | Pure `detailsText(d): { maker: string \| null; serial: string \| null }` (`[manufacturer, brand]` joined by a space, null if both null; `serial` → `SN: …`) and `expiryText(h): string` ("Until <date>" / "No expiry"; date shown as given, never through `new Date()`). | One tested helper for table and card. | No |
| `src/ui/devices/DeviceTable.tsx` (lines 32-45, 77-114) | `COLUMNS` + `details` after `mac` (7 columns); `Details` cell: maker line over muted serial line (`break-all`), dash when all null; `OwnerLabel` gains the holding sub-line when `holding` is non-null: `expiryText` then the note in `line-clamp-1` with `title={note}`; card: same holding lines (note `line-clamp-2`) and a details line. | DEV-02 display, ticket scope. | No |
| **Part B** | | | |
| `src/ui/copy/devices.ts` (new keys) | `actions.assign: "Assign"`, `assignAria: (inv) => \`Assign device ${inv}\``, `editHolding: "Note / expiry"`, `editHoldingAria: (inv) => \`Edit note and expiry of device ${inv}\``; `assign: { titles: { assign: "Assign device", edit: "Note and expiry" }, submit: { assign: "Assign", edit: "Save" }, holder: "Assigned to", note: "Note", noteHint: "Optional. Visible to everyone in your organization.", noteCount: (n, max) => \`${n}/${max}\`, expiry: "Expiry", expiryDate: "Expiry date", noExpiry: "No expiry", tzHint: "Dates are in UTC+7.", errors: { expiryMissing: "Pick a date or choose No expiry.", expiryPast: "The expiry date can't be before today (UTC+7).", noteInvalid: \`Enter a note of up to ${DEVICE_LIMITS.note} characters.\`, invalid: "The server refused this. Check that the expiry date is today or later (UTC+7)." } }`. | D36. | No |
| `src/ui/devices/assign-device.ts` (new) | Pure: `AssignForm = { note: string; noExpiry: boolean; expiresOn: string }`; `emptyAssignForm()` (No expiry checked); `holdingForm(d)` (from `d.holding`); `expiryMin(mode, holding, today)`; `noteLength(s)` (code points); `toAssignBody(form, memberId, today)` and `toHoldingBody(form, device, today)` (only changed keys, `unchanged` when none) via `validateAssign` / `validateHoldingPatch`, field → message map; `settleAssign(result)` → `done` \| `{ error, message, stale, reloadMembers }`. | Pure logic first (planner rule 6); mirrors `place-device.ts`. | No |
| `src/ui/devices/AssignDeviceDialog.tsx` (new) | `AssignDeviceDialog` (renders nothing unless `open && device`; inner keyed by `${device.id}:${mode}`, like `PlaceDeviceDialog.tsx` lines 180-187) and props-only `AssignDeviceFields` (picker slot, holder line, note textarea, expiry fieldset). Inner uses `useMemberPicker(seatsApi.activeMembers, reloadToken)` in assign mode, `today = useState(() => todayUtc7(new Date()))[0]`, `EntityFormDialog`. | Ticket scope. | No |
| `src/ui/devices/devices-api.ts` (lines 51-99) | `assign(id, body: AssignValue)` → `POST ${devicePath(id)}/assignment`; `updateHolding(id, body: HoldingPatchValue)` → `PATCH ${devicePath(id)}/holding`; both via `oneDevice`. | Client for the merged routes. | No |
| `src/ui/devices/device-actions.ts` (lines 5-58) | `DeviceRowHandlers` + `onAssign`, `onEditHolding`; `rowActions` pushes Assign (`d.canAssign`) or "Note / expiry" (`d.canEditHolding`) first, then place modes, Edit, Delete. | Row gating by DTO flags. | No |
| `src/ui/devices/DevicesPage.tsx` (lines 27-41, 57-93) | `holding` state `{ device; mode: "assign" \| "edit" } \| null`; handlers; mount `AssignDeviceDialog` with `devicesApi={api}`, `seatsApi`, `onClose`, `onStale={() => void refresh()}`, `onDone(mode)`: close, `refresh()`, then after an assign `headingRef.current?.focus()` (A4). | Refetch and focus. | No |
| `src/ui/clip.ts` (new) | `export const CLIP = …` moved from `SeatsView.tsx` line 24. | Ticket risk note: the picker must not import `SeatsView`. | No |
| `src/ui/seats/SeatsView.tsx` (line 24), `src/ui/seats/MemberPickerDialog.tsx` (line 15), `src/ui/seats/ConfirmSeatDialog.tsx` (line 2), `src/ui/seats/SeatDetailPanel.tsx` (line 10) | Import `CLIP` from `../clip`; `SeatsView` no longer exports it. | Follow the move. | No |
| **Tests** | | | |
| `src/ui/devices/assign-device.test.ts` (new), `src/ui/devices/AssignDeviceDialog.test.tsx` (new) | See Tests. | R5. | No |
| `src/ui/devices/device-form.test.ts`, `DeviceFormDialog.test.tsx`, `devices-state.test.ts`, `DevicesView.test.tsx`, `device-actions.test.ts`, `devices-api.test.ts` | New and updated cases (header count 6 → 7, 7 → 8 with actions; fixtures with serial/manufacturer/brand/holding). | R5; follow the code. | No |

Not touched: `src/ui/EntityFormDialog.tsx` (the textarea and checkbox are inlined in `AssignDeviceFields`, A7), any
server, route, validator or `src/lib/devices/*` file, `SearchView.tsx` (A9).

## Data model / migration
None.

## API contract
None changed. The UI calls the SIM-037.2 endpoints as listed in `## Scope summary`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `assign-device.test.ts › emptyAssignForm / holdingForm`: assign starts with No expiry checked and empty date; edit with `expiresOn: null` → checked; with `"2026-12-31"` → unchecked, date set; note `null` → `""` | dialog defaults |
| `assign-device.test.ts › expiryMin`: assign → `today`; edit with expiry `"2026-11-01"` and today `"2026-11-25"` → `"2026-11-01"` (so the browser does not block a note-only save of an overdue holding); edit with a future expiry → today | AC3, overdue edge |
| `assign-device.test.ts › toAssignBody`: no member → `invalid` with `seatsCopy.actions.pickerNone`; No expiry → `expiresOn: null`; unchecked + empty date → `expiryMissing`; `"2026-11-24"` with today `"2026-11-25"` → `expiryPast`; today allowed; blank note → `null`; NFD `"Nguyễn"` → NFC; `"a\r\nb"` → `"a\nb"`; 500 code points ok, 501 → `noteInvalid`; `\u0007` → `noteInvalid` | DEV-07 limits, diacritics, UTC+7, empty/null |
| `assign-device.test.ts › toHoldingBody`: nothing changed → `unchanged`; only whitespace/NFD differs → `unchanged`; note only → `{ note }`; clear note → `{ note: null }`; check No expiry → `{ expiresOn: null }`; overdue holding, note-only edit → `{ note }` (no expiry check); change to another past date → `expiryPast` | A3 of SIM-037.2 (only changed keys) |
| `assign-device.test.ts › settleAssign`: ok, `not_found` → done; `device_owned`, `not_assigned`, `not_allowed`, `handoff_pending` → error + `stale`; `member_not_assignable` → error + `reloadMembers`; `invalid_request` → `assign.errors.invalid`; `unavailable` → `apiErrorMessage("unavailable")`, not stale | refusal handling |
| `assign-device.test.ts › noteLength` counts code points (emoji = 1) | counter |
| `AssignDeviceDialog.test.tsx › AssignDeviceFields assign mode`: picker slot rendered; textarea `maxLength="500"`; counter `0/500` and hint (incl. "Visible to everyone in your organization") linked by `aria-describedby`; `<fieldset>` with `<legend>` Expiry; No expiry checked → date input `disabled`, `min` attribute present | markup, a11y |
| `AssignDeviceDialog.test.tsx › edit mode`: no picker, holder line "Assigned to" + name; unchecked → date enabled with `value` | edit mode |
| `device-actions.test.ts › assign and holding actions`: Assign only with `canAssign` + `onAssign`; "Note / expiry" only with `canEditHolding` + `onEditHolding`; each listed first; aria labels contain the inventory number; `hasAnyAction` true for a `canAssign`-only row | AC1 |
| `devices-api.test.ts › assign / updateHolding`: POST `/api/devices/<id>/assignment` and PATCH `/api/devices/<id>/holding` with JSON body; 409 code passes through; body without `id` → `internal` | client wiring |
| `devices-state.test.ts › detailsText`: both maker fields, one of them, only serial, none → nulls; `› expiryText` date / null | Details and holding text |
| `DevicesView.test.tsx › Details column` (7 `th`, 8 with actions; maker over `SN: …`; dash when empty) and `› holding line` ("Until 2026-12-31", "No expiry", note with `title`; none on unowned rows; Vietnamese note rendered as given) | AC2, AC4 display |
| `DevicesView.test.tsx › Assign / Note / expiry buttons by flag; a User fixture shows neither` | AC1 |
| `DeviceFormDialog.test.tsx › serial, manufacturer and brand fields` (labels, `maxLength="100"` × 3, serial `spellCheck="false"`, not `required`) | AC4 |
| `device-form.test.ts › emptyForm/formFromDevice` new keys; `› toCreateBody` sends trimmed values, blank → null; `› toPatchBody` changed serial only → `{ serial }`, cleared → `{ serial: null }`, NFD/whitespace-only difference → `unchanged`, 101 chars → `fieldErrors.serial`; `› deviceErrorMessage("serial_taken")` | AC4 |

## Approach
1. **Part A — fields and display.** Copy keys; `device-form.ts` and `DeviceFormFields`; icons; `detailsText` /
   `expiryText`; `DeviceTable` Details column, owner-cell holding sub-line and card lines. Update the fixtures and
   header counts in `DevicesView.test.tsx`. Run checks.
2. **CLIP move.** `src/ui/clip.ts`; update the four seat imports. No behaviour change; seat tests stay green.
3. **Pure assign logic** (`assign-device.ts`) with tests first. It reuses `validateAssign` / `validateHoldingPatch`
   and `todayUtc7` so client and server apply one rule; the server stays authoritative.
4. **API client** `assign` / `updateHolding`.
5. **`AssignDeviceFields` + dialog.** Assign mode: picker (`MemberPickerFields` with `occupantId={null}`, rendered as
   a slot), note textarea (`rows={3}`, `maxLength={DEVICE_LIMITS.note}`, counter + hint via `aria-describedby`),
   expiry `fieldset`/`legend` with `DialogField type="date"` (`min={expiryMin(...)}`, `disabled` and cleared when No
   expiry is checked, hint "Dates are in UTC+7.") and a checkbox; unchecking focuses the date input (ref). Edit mode:
   holder line instead of the picker. Submit: build the body (`invalid` → dialog error; `unchanged` → close), call the
   API, `settleAssign`: done → `onDone(mode)`; `stale` → message + `onStale()` (dialog stays, the user cancels);
   `reloadMembers` → message + `reloadToken++` (picker reloads, selection clears). Errors use the dialog's existing
   `role="alert"` line. `today` is computed once at mount, never inside the pure helpers.
6. **Row actions and page.** `rowActions` order; `DevicesPage` state and handlers; after an assign, refresh then focus
   the heading (the Assign button is gone in every filter: the row either leaves "Org inventory" or swaps Assign for
   "Note / expiry"); after a holding edit the row stays in every filter, so `EntityFormDialog`'s own focus return
   (line 49) puts focus back on the "Note / expiry" button.
7. Run all Checks.

Rules: **R1** only `ui → ui/lib` imports (`@/lib/validate/device`, `@/lib/devices/holding`); `pnpm check:layers`.
**R3** nothing in env. **R4** UX items outside the ticket are rejected below. **R5** tests listed. **R6/R7** unchanged
(server-side; the UI gates on server flags only and treats 409/422 as domain refusals). **D36** all strings in
`src/ui/copy/devices.ts`; `no-literals.test.ts` guards components.

## Specialist input used
- ux §Row actions: Assign / "Note / expiry" first, labels and aria labels, DTO flags only — **adopted**. Mobile
  touch target ≥ 44 px — **not adopted** (changes every existing card button; outside the ticket, R4).
- ux §Assign dialog: titles, field order, holder read-only in edit mode, expiry fieldset/legend, No expiry default
  checked (edit follows `expiresOn === null`), unchecking focuses the date, `min` from the shared helper, UTC+7 hint,
  "Pick a date or choose No expiry", edit sends only changed fields — **adopted**. "Submit disabled until a member is
  chosen" — **replaced** by the seat picker's pattern (submit shows "Choose a member first."), so `EntityFormDialog`
  stays untouched (A7).
- ux §Table: one Details column, holding sub-line only when `holding` is non-null, expiry first then note clipped with
  `title`, dates as given — **adopted**. Hide Details below `lg` — **not adopted** (consult default no).
- ux §Form: three fields after MAC, serial `spellCheck`/`autoCapitalize` off — **adopted**; `serial_taken` under the
  field instead of a banner — **not adopted**: the form has one error line today; the message names the serial (A6).
- ux §Errors: `device_owned` → message + refresh — **adopted with the dialog left open** (like delete), so the
  message is readable; member refusal → reload picker — **adopted**; network errors keep the typed note — **adopted**
  (state is not reset on error). Filter-specific empty text pointing at Create device — **not adopted** (outside the
  ticket).
- ux §Accessibility: labels, `aria-describedby`, focus to heading after a removed row — **adopted**. Polite
  announcement "Device assigned to <name>" and the live counter region near the limit — **not adopted** (not in the
  ticket; the counter is a plain linked text).
- ux §Note visibility: org-wide per spec line 340 with hint "Visible to everyone in your organization" — **adopted**
  (A1).
- frontend B (form fields, `fieldMessage` keys), C (one dialog with two modes, pure `assign-device.ts`, picker reuse,
  `CLIP` move, `settle` mapping, api methods, row actions), D, G, H — **adopted**. Its `todayInVietnam` helper —
  **replaced** by the merged `todayUtc7` (`src/lib/devices/holding.ts`). Its `DialogTextarea` in `EntityFormDialog`
  — **not adopted** (A7). Section F and the "Not placed" rename — already done in SIM-037.2. OQ7 SearchView serial —
  **not adopted** (A9).

## Assumptions
For Ming to approve with the plan (each is reversible):
- **A1 Note visibility:** org-wide, as the spec says (line 340, DEV-02); every member sees the note in the list
  (clipped, full text in `title`). The note field shows "Optional. Visible to everyone in your organization."
  Narrowing it needs a spec change and a server DTO change (separate ticket).
- **A2 Expiry default:** "No expiry" checked when assigning; in edit mode it follows the current expiry. The date is
  shown and sent as `YYYY-MM-DD`; the hint says "Dates are in UTC+7."
- **A3 Overdue edit:** in edit mode the date input's `min` is the earlier of today and the current expiry, so a
  note-only edit of an overdue holding is not blocked by the browser; picking a new past date is refused by the
  client check and the server.
- **A4 Focus:** after an assign, focus goes to the page heading (the Assign button disappears in every filter); after
  a holding edit it returns to the "Note / expiry" button (the row stays).
- **A5 Stale refusals** (`device_owned`, `not_assigned`, `not_allowed`, `handoff_pending`): message in the dialog, list
  refreshed, dialog stays open until the user cancels. `not_found` closes the dialog and refreshes.
- **A6 Errors in the dialog's one error line**, as the device form does today, not under each field. The
  `serial_taken` text already names the serial. `invalid_request` from assign/holding (the body has no field detail,
  and the client already checked everything else) shows "The server refused this. Check that the expiry date is today
  or later (UTC+7)."
- **A7 `EntityFormDialog.tsx` unchanged:** textarea and checkbox are inlined in `AssignDeviceFields`; submit is not
  disabled without a member (the seat picker's "Choose a member first." pattern instead).
- **A8 Picker copy:** reuses `seatsCopy.actions.picker*` ("Search by name or employee code", "Active members", "No
  active members found.", …); the texts are neutral. A Manager may pick themselves (SIM-037.2 OQ3).
- **A9 Out of scope:** SearchView does not show serial; the Device detail page (spec line 340) is not built here; no
  mobile touch-target change; no live announcement. None of these are follow-ups the ticket asked for; if Ming wants
  them, they become `debt` issues.
- **A10 Note length:** the textarea `maxLength` counts UTF-16 units (stricter than the server's code points for emoji
  only); the counter shows code points. An NFD-typed note is normalised to NFC before the check, like the server.
- **A11 Icons:** add `event`, `factory`, `qr_code` to `ICON_NAMES` (the Material Symbols subset URL grows by three
  names).
- **Hotspots:** SIM-036.4 (PLANNING, map device images) may touch `src/ui/seats/SeatsView.tsx` or
  `SeatDetailPanel.tsx` (CLIP import lines) or `src/lib/icons.ts`; expect a trivial rebase. SIM-037.3 to SIM-037.6
  will edit `device-actions.ts`, `DevicesPage.tsx`, `DeviceTable.tsx` and `copy/devices.ts` after this one.

## Blocking questions
None.

## Split proposal
Estimate: ~480 production lines (Part A ~170: copy, form, icons, table/card display; Part B ~310: assign logic ~110,
dialog ~150, api/actions/page/copy/CLIP ~50) plus ~450 test lines. That is above the ~400-line guide but mostly
markup and copy, and Size M was agreed for this ticket, so **this plan covers the whole ticket in one cycle** by
default.

If Ming prefers a split, it is mechanical along the Files table:
- **SIM-037.7 (Part A):** serial/manufacturer/brand in the form, Details column, holding sub-line (read-only). AC4,
  AC5 and the display half of AC2.
- **SIM-037.8 (Part B):** CLIP move, `assign-device.ts`, `AssignDeviceDialog`, api methods, row actions, page wiring.
  AC1, AC2 (assign), AC3. Depends on SIM-037.7.
