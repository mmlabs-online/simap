## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| src/ui/copy/devices.ts | D36 copy: newDevice, actions.edit/editAria, typeSuggestions, form.* |
| src/ui/devices/device-form.ts (new) | Pure form logic on lib validators |
| src/ui/devices/device-form.test.ts (new) | R5, AC1-3 |
| src/ui/devices/DeviceFormDialog.tsx (new) | Dialog, DeviceFormFields, OwnerPicker |
| src/ui/devices/DeviceFormDialog.test.tsx (new) | AC2, AC4 |
| src/ui/devices/devices-api.ts | create (POST) and update (PATCH) |
| src/ui/devices/devices-api.test.ts | R5 |
| src/ui/devices/device-actions.ts | onEdit handler; independent push-list in rowActions |
| src/ui/devices/device-actions.test.ts | Edit cases |
| src/ui/devices/DevicesView.tsx | onNew prop and New device button |
| src/ui/devices/DevicesView.test.tsx | New button and Edit button cases |
| src/ui/devices/DevicesPage.tsx | form state, isAdmin, wiring, filterAfterCreate |

### Tests added / changed
- device-form.test.ts: setup, toCreateBody (self, Admin member, non-Admin, no pick, MAC, fields/NFC), toPatchBody (changed only, unchanged, MAC forms, clear, never ownerId), deviceErrorMessage, filterAfterCreate
- DeviceFormDialog.test.tsx: fields and datalist, non-Admin no owner UI, Admin Me/Another, picker only for Another member, edit read-only owner, error alert
- devices-api.test.ts: create and update
- device-actions.test.ts: edit action, independence, hasAnyAction
- DevicesView.test.tsx: New device button, Edit buttons

### Checks (actual output summary)
- typecheck: next typegen + tsc --noEmit clean; check:layers "468 files, no violations"
- format:check: "All matched files use the correct format."
- test: Test Files 184 passed (184); Tests 1941 passed | 3 skipped (1944)
- build: pnpm build succeeded (route list printed, no errors)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- None.

### Scope self-check
- Could the diff be smaller? No; each file is in the plan.
- Diff size: 12 files (4 new), see git diff --stat.
