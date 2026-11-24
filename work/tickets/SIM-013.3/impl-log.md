
## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| src/ui/devices/place-device.ts (new) | Pure dialog logic (AC 3) |
| src/ui/devices/place-device.test.ts (new) | R5 |
| src/ui/devices/device-actions.ts (new) | Row actions gated by canPlace |
| src/ui/devices/device-actions.test.ts (new) | R5 |
| src/ui/devices/DeviceRowActions.tsx (new) | Shared buttons for table and card |
| src/ui/devices/PlaceDeviceDialog.tsx (new) | The dialog and props-only fields |
| src/ui/devices/PlaceDeviceDialog.test.tsx (new) | R5, AC 2-3 |
| src/ui/devices/usePlaceTargets.ts (new) | Room then seat picker data |
| src/ui/devices/devices-api.ts, devices-api.test.ts | `get`, `place` |
| src/ui/devices/devices-state.ts, devices-state.test.ts | `refresh` event |
| src/ui/devices/useDevices.ts | `refresh()` |
| src/ui/devices/DeviceTable.tsx, DevicesView.tsx, DevicesView.test.tsx | Actions column and card actions, tests |
| src/ui/devices/DevicesPage.tsx | Wire-up |
| src/ui/copy/devices.ts | D36 copy |

### Tests added / changed
- place-device.test.ts: placeModes, offeredRoles/primaryRefusal, seatTarget, placeVerb, toPlacementBody, planSubmit, settle
- device-actions.test.ts: rowActions, hasAnyAction
- devices-api.test.ts: get, place
- devices-state.test.ts: refresh keeps rows; refresh answer / stale answer
- DevicesView.test.tsx: actions column only when a row has an action; buttons per canPlace row
- PlaceDeviceDialog.test.tsx: picker, roles, lend hint, return confirm, states, refusal alert

### Checks (actual output summary)
- typecheck: exit 0
- format:check: exit 0 (all matched files use the correct format)
- check:layers: no violations (464 files)
- test: 182 files passed; 1914 passed, 3 skipped
- build: exit 0 (run before the final test-only edits; no source changed after)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- No component-level test of the stateful PlaceDeviceInner (placement_changed refetch flow); only pure settle and static fields are tested (no jsdom in repo).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +700 lines incl. tests (new files) / -16 on modified files.
