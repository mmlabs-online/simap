# Impl log — SIM-012.5

## Attempt 1 — 2026-11-22

### Files touched
| File | Required because |
|---|---|
| src/lib/room-switcher.ts | New pure helpers (plan) |
| src/lib/room-switcher.test.ts | AC6 |
| src/ui/RoomSwitcher.tsx | Stateful switcher plus presentational view |
| src/ui/RoomSwitcher.test.tsx | AC1, AC3, AC5 |
| src/ui/AppShell.tsx | Wires the switcher when signed in |
| src/ui/AppShellView.tsx | `roomSwitcher` prop, bar, old slot removed |
| src/ui/AppShellView.test.tsx | Shell with/without switcher |
| src/ui/copy/shell.ts | D36 copy |

### Tests added / changed
- room-switcher.test.ts › roomCodeFromPath, goTarget, keepGoodRooms
- RoomSwitcher.test.tsx › view (options, selected, escaping, label, Go not disabled)
- AppShellView.test.tsx › roomSwitcher

### Checks (actual output summary)
- typecheck: pass; check:layers: 344 files, no violations
- format:check: pass
- test: Test Files 140 passed; Tests 1413 passed | 3 skipped
- build: Compiled successfully

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Manual checks (arrow keys, 390 px, blocked /api/rooms) not run here.

### Scope self-check
- Could the diff be smaller? no
- Diff size: about +270 / -3 lines including tests

## Attempt 2 — 2026-11-22
Fixes review attempt 1, Issue 1 only.

### Files touched
| File | Required because |
|---|---|
| src/lib/room-switcher.ts | Added `visibleSelection` (Issue 1) |
| src/lib/room-switcher.test.ts | Tests for `visibleSelection` and Go with an unlisted code |
| src/ui/RoomSwitcher.tsx | Uses `shown = visibleSelection(good, selected)` for the view and `goTarget`; `selected` state unchanged |

### Tests added / changed
- room-switcher.test.ts › visibleSelection (listed, unlisted, empty list, goTarget returns null)

### Checks (actual output summary)
- format:check, typecheck, check:layers (344 files, no violations): pass
- test: Test Files 140 passed; Tests 1416 passed | 3 skipped
- build: Compiled successfully

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Browser checks (arrow keys, 390 px, blocked /api/rooms) still not run.

### Scope self-check
- Could the diff be smaller? no
- Diff size: about +24 / -4 lines including tests
