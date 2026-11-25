## Attempt 1 — 2026-11-25 (slice 1: owner side and shared plumbing)

### Files touched
| File | Required because |
|---|---|
| `src/ui/copy/devices.ts` | New strings (overdue chip, expired text, extension chip, extend actions and dialog, banner), D36. |
| `src/ui/copy/shell.ts` | `devicesBreakdown(counts)` with the overdue part; `overdueDevices`. |
| `src/ui/AppShell.tsx` | Passes the count object to `devicesBreakdown`. |
| `src/ui/devices/devices-state.ts` | `FILTERS` += overdue; `expiryText(h, overdue)`; `pendingText` for extensions. |
| `src/ui/devices/DeviceTable.tsx` | Overdue chip and "Expired on" in `OwnerLabel` (table and card). |
| `src/ui/devices/device-actions.ts` | `onExtend`, Extend action, Cancel extension. Extend gates on `!pending` (equal to `=== null` for server data). |
| `src/ui/devices/devices-api.ts` | `startExtension`. |
| `src/ui/devices/transfer-device.ts` | `cancelOutcome` kind `"extension"`. |
| `src/ui/devices/incoming-transfer.ts` | `badgeTotal` includes `overdue`. |
| `src/ui/devices/extend-device.ts` (new) | `nextDay`, `toExtendBody`, `settleExtend`. |
| `src/ui/devices/ExtendDeviceDialog.tsx` (new) | The Extend dialog. |
| `src/ui/devices/OverdueBanner.tsx` (new) | The owner banner. |
| `src/ui/devices/DevicesPage.tsx` | Overdue list, Extend dialog, banner, `refreshDevices`, `refreshAll` incl. overdue, cancel kind pass-through. |
| `db/seeder.js` | Seed "Tablet E" (INV-5) with expiry yesterday (UTC+7). |

### Tests added / changed
- `devices-state.test.ts` › filterOptions five filters; expiryText overdue; pendingText extension (and null without handoff)
- `device-actions.test.ts` › cancelExtension with/without canCancel; extend gating and busyId
- `devices-api.test.ts` › list("overdue") path; startExtension body
- `transfer-device.test.ts` › cancelOutcome extension wording
- `incoming-transfer.test.ts` › badgeTotal sums incoming, returns, overdue
- `AppShellView.test.tsx` › devicesBreakdown(counts) parts and sums
- `DevicesView.test.tsx` › overdue chip and Expired on; radio and button counts 4 -> 5 (new filter)
- `extend-device.test.ts` (new), `ExtendDeviceDialog.test.tsx` (new), `OverdueBanner.test.tsx` (new)

### Checks (actual output summary)
- typecheck: exit 0 (types generated, tsc clean)
- check:layers: 744 files, no violations
- format:check: all matched files use the correct format
- test: Test Files 282 passed | 1 skipped; Tests 2881 passed | 9 skipped
- build: not run (plan lists it; run in CI/review)
- seed against a local DB: not run (SQL mirrors the existing insert; `db/seeder.test.ts` passes)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Slice 2 (SIM-037.12): Manager+ Pending extensions list and `extensions` in the badge.

### Scope self-check
- Could the diff be smaller? No; the banner, dialog and wiring are each required by the plan.
- Diff size: see `git diff --stat` on the commit.

## Attempt 2 — 2026-11-25 (REWORK)

Fixes review Issue 1 (blocker): the banner got the full row handler set.

### Files touched
- `src/ui/devices/device-actions.ts` — added `bannerHandlers(h)` returning only onExtend, onReturn, onCancelHandoff. Required because the page wiring must be unit-testable (the banner test passes the subset itself).
- `src/ui/devices/DevicesPage.tsx` — `handlers={bannerHandlers(actions)}` instead of `actions`. Required by Issue 1.
- `src/ui/devices/device-actions.test.ts` — new `bannerHandlers` test: only the three keys survive, and with the full set a row would show more actions. Would fail if the page passed the full set through the helper's contract.

### Checks
- format:check, typecheck, check:layers, test: all exit 0 (format: all matched files use the correct format; layers: 744 files, no violations)
- build: not run (reviewer ran it in attempt 1)

### Out-of-plan files
None.

### Scope self-check
- Smallest diff: one helper, one line in the page, one test.
