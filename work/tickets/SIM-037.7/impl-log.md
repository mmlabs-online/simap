## Attempt 1 — 2026-11-25

Whole ticket (Part A and Part B) in one cycle, as the approved plan (A1-A11).

### Files touched
| File | Required because |
|---|---|
| src/ui/copy/devices.ts | D36: details column, serial/manufacturer/brand labels and errors, holding text, assign/holding action and dialog copy |
| src/lib/icons.ts | `event`, `factory`, `qr_code` added in sorted order (A11) |
| src/ui/devices/device-form.ts | serial, manufacturer, brand in the form, create body and patch body |
| src/ui/devices/DeviceFormDialog.tsx | three new fields after MAC |
| src/ui/devices/devices-state.ts | `detailsText`, `expiryText` helpers |
| src/ui/devices/DeviceTable.tsx | Details column, holding sub-line in the owner cell (table and card) |
| src/ui/clip.ts (new) | `CLIP` moved out of `SeatsView` so the picker does not import a page view |
| src/ui/seats/SeatsView.tsx, MemberPickerDialog.tsx, ConfirmSeatDialog.tsx, SeatDetailPanel.tsx | follow the CLIP move (import only) |
| src/ui/devices/assign-device.ts (new) | pure assign / holding logic (form, `expiryMin`, bodies, `settleAssign`) |
| src/ui/devices/AssignDeviceDialog.tsx (new) | assign and edit-holding dialog, props-only `AssignDeviceFields` |
| src/ui/devices/devices-api.ts | `assign`, `updateHolding` |
| src/ui/devices/device-actions.ts | Assign and "Note / expiry" row actions gated by DTO flags |
| src/ui/devices/DevicesPage.tsx | holding state, dialog mount, refresh and focus to the heading after an assign |

### Tests added / changed
- assign-device.test.ts (new): emptyAssignForm/holdingForm, expiryMin, toAssignBody, toHoldingBody, settleAssign, noteLength
- AssignDeviceDialog.test.tsx (new): assign mode markup, edit mode markup
- device-form.test.ts: new keys, create/patch with serial/manufacturer/brand, `serial_taken` message
- DeviceFormDialog.test.tsx: serial, manufacturer, brand fields
- devices-state.test.ts: detailsText, expiryText
- DevicesView.test.tsx: header counts 6 → 7 and 7 → 8; Details column, holding line, action buttons by flag
- device-actions.test.ts: assign and holding actions
- devices-api.test.ts: assign, updateHolding

### Checks (actual output summary)
- format:check: exit 0
- typecheck: exit 0; check:layers: "668 files, no violations"
- test: Test Files 254 passed | 1 skipped (255); Tests 2510 passed | 9 skipped (2519). The two known flaky files passed in the full run.
- build: exit 0
- test:db: not run (no DB change, no Docker here)

### Out-of-plan files
None. Deviation inside plan files: the date input is focused through a ref on the `<fieldset>` (`fieldsetRef` + selector) instead of a ref on the input, because `DialogField` does not forward a ref and `EntityFormDialog.tsx` stays untouched (A7).

### Follow-ups (noticed, not done)
- None new. Table width with a long serial/note still needs Ming's visual check (manual step 5).

### Scope self-check
- Could the diff be smaller? No; most lines are markup, copy and the listed tests.
- Diff size: about +1150 / -25 lines including new files and tests.
