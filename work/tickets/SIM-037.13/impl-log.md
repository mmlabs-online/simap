## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| `src/ui/devices/device-detail-state.ts` | `refresh`/`refreshed` events for a silent reload (no skeleton) |
| `src/ui/devices/device-detail-state.test.ts` | tests for the refresh events and races |
| `src/ui/devices/useDeviceDetail.ts` | `refresh()` and `refreshDevice()` |
| `src/ui/devices/device-detail-actions.ts` (new) | pure helpers: handlers, dialog slot, notices, refresh rules |
| `src/ui/devices/device-detail-actions.test.ts` (new) | tests of those helpers |
| `src/ui/devices/DeviceDetailDialogs.tsx` (new) | mounts the six existing dialogs from one slot |
| `src/ui/devices/DeviceDetailPage.tsx` | wiring: slot, handlers, cancel, notice, busy, focus |
| `src/ui/devices/DeviceDetailView.tsx` | `actions` slot, always-mounted live region |
| `src/ui/devices/DeviceDetailView.test.tsx` | gating and live-region markup tests |
| `src/ui/copy/devices.ts` | `devicesCopy.detail.done.*` (D36) |
| `work/tickets/SIM-037.13/ticket.md` | `## Test plan` reworded; Handoff line added |

### Tests added / changed
- device-detail-state.test.ts › refresh events (detail refresh, load after refresh, history refresh, moreLoaded after refresh)
- device-detail-actions.test.ts › detailHandlers (x3), dialogFor, doneNotice, detailCancelOutcome, refreshOk/afterRefresh
- DeviceDetailView.test.tsx › actions and notice (x4)

### Checks (actual output summary)
- typecheck: exit 0
- check:layers: 808 files, no violations
- format:check: all matched files use the correct format (after `pnpm format`)
- test: 308 files passed | 1 skipped; 3125 tests passed | 7 skipped
- build: exit 0

### Out-of-plan files
None.

### Deviations
- `DeviceDetailDialogs` ignores the `mode` argument of Assign's `onDone` and the no-arg Place `onDone`; both report the slot's snapshot (as the plan says).
- The container (focus, call order) is not unit-tested (no DOM); manual checks M1-M7 not run here (no browser/dev token).

### Follow-ups (noticed, not done)
- Use `DeviceDetailDialogs` + `DetailDialog` in `DevicesPage` (low priority).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about 400 product lines (incl. new files), tests extra.
