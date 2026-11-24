## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/ui/devices/delete-device-flow.ts` (new) | Pure step/settle logic (AC1-3). |
| `src/ui/devices/delete-device-flow.test.ts` (new) | AC4 unit tests. |
| `src/ui/devices/DeleteDeviceDialog.tsx` (new) | Dialog and props-only `DeleteDeviceBody`. |
| `src/ui/devices/DeleteDeviceDialog.test.tsx` (new) | Static-render tests. |
| `src/ui/devices/devices-api.ts` | `remove(id)` (DELETE, 204 no body). |
| `src/ui/devices/devices-api.test.ts` | `remove` tests. |
| `src/ui/devices/device-actions.ts` | `onDelete`, `danger`, delete action gated by `canEdit`. |
| `src/ui/devices/device-actions.test.ts` | Delete action tests. |
| `src/ui/devices/DeviceRowActions.tsx` | Danger variant for delete button. |
| `src/ui/devices/DevicesView.tsx` | `headingRef` prop, h1 `tabIndex={-1}`. |
| `src/ui/devices/DevicesView.test.tsx` | Delete buttons and h1 tabindex tests. |
| `src/ui/devices/DevicesPage.tsx` | `deleting` state, `onDelete`, dialog mount, heading focus after delete. |
| `src/ui/copy/devices.ts` | Delete copy (D36). |

### Tests added / changed
- delete-device-flow.test.ts › deleteStep, deleteSubmitLabel, moveBody, settleDelete (3), settleMove (2), afterRefetch
- DeleteDeviceDialog.test.tsx › placed step, confirm step, confirm after a move
- devices-api.test.ts › remove (DELETE, 204, 409, 404, network)
- device-actions.test.ts › delete action (2)
- DevicesView.test.tsx › Delete buttons on canEdit rows; h1 is focusable

### Checks (actual output summary)
- typecheck: `next typegen && tsc --noEmit` clean; `check:layers`: 472 files, no violations
- format:check: All matched files use the correct format.
- test: 186 files passed; 1958 passed, 3 skipped
- build: completed (route table printed)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Danger-styled submit in `EntityFormDialog` for destructive dialogs (plan assumption 2).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +117 / -6 on modified files, plus 4 new files.
