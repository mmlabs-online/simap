## Attempt 1 — 2026-11-27

### Files touched
| File | Required because |
|---|---|
| src/lib/layout-editor/reachability.ts | New pure `draftWarnings` over the SIM-061 walk grid (AC 1, 2) |
| src/lib/layout-editor/reachability.test.ts | AC 3, 4 unit tests |
| src/ui/roomlayout/EditorWarnings.tsx | Non-blocking warning list (`role="status"`) |
| src/ui/roomlayout/EditorWarnings.test.tsx | Component tests |
| src/ui/roomlayout/LayoutEditor.tsx | `useMemo` warnings and render after the status line; save path untouched |
| src/ui/copy/roomlayout.ts | `editor.warnings` copy (D36) |

### Tests added / changed
- reachability.test.ts › reachable chair gives no warnings; chair walled off is unreachable; seats but no door sets noDoor; no seats and no door gives no warning; door fully blocked in counts as no door; unplaced new desk uses key and null code; chair outside the room is unreachable; warned draft still saves
- EditorWarnings.test.tsx › renders nothing without warnings; shows no-door and unreachable seat codes

### Checks (actual output summary)
- typecheck: pass; check:layers: "1026 files, no violations"
- format:check: "All matched files use the correct format."
- test: Test Files 395 passed | 1 skipped; Tests 3838 passed | 9 skipped
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- None.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +200 / -0 lines
