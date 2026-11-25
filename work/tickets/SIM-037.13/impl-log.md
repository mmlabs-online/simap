# Impl log — SIM-037.13

## Attempt 1

### Files touched
| File | Required because |
|---|---|
| `src/ui/devices/device-detail-state.ts` | `refresh`/`refreshed` events so a silent refresh keeps the shown device and focus. |
| `src/ui/devices/device-detail-state.test.ts` | Reducer tests for the new events. |
| `src/ui/devices/useDeviceDetail.ts` | `refresh()` plus `RefreshResult`/`RefreshFn` types. |
| `src/ui/devices/device-detail-actions.ts` (new) | Pure `detailHandlers`, `doneNotice`, `finishAction`. |
| `src/ui/devices/device-detail-actions.test.ts` (new) | Tests for the pure module (flag table, dialogs, notices, order, failure, not_found, null notice). |
| `src/ui/devices/useDeviceDetailActions.tsx` (new) | Dialog host for the detail page (duplicate of list wiring, plan A1). |
| `src/ui/devices/DeviceDetailView.tsx` | Always-mounted notice region and `actions` slot under the h1. |
| `src/ui/devices/DeviceDetailView.test.tsx` | Notice region, tones, actions placement. |
| `src/ui/devices/DeviceDetailPage.tsx` | Wiring, `rooms`/`seats` APIs, post-action focus effect, dialogs. |
| `src/ui/copy/devices.ts` | `detail.done.*` and `detail.refreshFailed` (D36). |

### Tests added
Reducer refresh tests, `device-detail-actions.test.ts`, two view tests (as listed in the plan).

### Checks
- format:check: All matched files use the correct format.
- typecheck: next typegen + tsc, no errors.
- check:layers: 802 files, no violations.
- test: Tests 3102 passed | 9 skipped.
- build: succeeded.

### Out-of-plan files
None.

### Follow-ups
- Extract a shared device dialogs host used by `DevicesPage` and `DeviceDetailPage` (plan A1).
- `*.gone` copy is list-worded on the detail page (plan A5).
- `finishAction` skipped when another action is in flight (re-entry guard drops a second dialog `onDone` notice); rare.

### Scope self-check
Only plan files changed; Edit/Delete not offered; no server, schema or env change.
