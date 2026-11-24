# Implementation log: SIM-015.9

## Attempt 1 — 2026-11-23

### Files touched
| File | Required because |
|---|---|
| `src/lib/layout-editor/place-tool.ts` (new) | Pure helpers `tryPlace`, `placementPreview`, `nextTool`, `reconcileTool`, `escDisarms`, `parseWhole`, `parseRoomSize`, `sameTool`, `Tool` (plan step 1; fixture limit) |
| `src/lib/layout-editor/place-tool.test.ts` (new) | R5, tests listed in plan |
| `src/lib/layout-editor/editor-state.ts` | `tool` state, actions `arm`/`disarm`/`place`/`resize`, notice codes, undo reconciles tool |
| `src/lib/layout-editor/editor-state.test.ts` | New reducer tests |
| `src/lib/layout-editor/palette.ts` | `fixturePalette()` |
| `src/lib/layout-editor/palette.test.ts` | `fixturePalette` test |
| `src/ui/roomlayout/Palette.tsx` (new) | `Palette` and `PlacePanel` |
| `src/ui/roomlayout/EditorInspector.tsx` | Tray rows as Place buttons, `RoomSizeForm` |
| `src/ui/roomlayout/EditorCanvas.tsx` | `tool`/`onPlace`, hover, ghost, crosshair |
| `src/ui/roomlayout/LayoutEditor.tsx` | Wiring, Esc handler, right column |
| `src/ui/copy/roomlayout.ts` | New copy (D36) |
| `src/ui/roomlayout/LayoutEditorViews.test.tsx` | Static-render tests; existing inspector call gets the new props |

`EditorViews.tsx` needed no change (the notice codes index the copy and compile).

### Tests added / changed
- place-tool.test.ts: tryPlace fixture / fixture_limit / tray, placementPreview, nextTool, reconcileTool, escDisarms, parseWhole, parseRoomSize
- editor-state.test.ts: arm/disarm, place (ok, refused, limit), payload round trip, tray advance, last tray seat unblocks Save, resize (3), frozen, undo, saveDone clears tool
- palette.test.ts: fixturePalette
- LayoutEditorViews.test.tsx: palette, group headings copy, place panel, tray buttons, size form, status line

### Checks (actual output summary)
- typecheck: `pnpm typecheck && pnpm check:layers` exit 0; "check-layers: 405 files, no violations"
- format:check: exit 0, "All matched files use the correct format."
- test: Test Files 163 passed (163); Tests 1719 passed | 3 skipped (1722)
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Hover ghost, click, Esc and keyboard wiring are not covered by automated tests (no DOM env, A3); see Ming verification 2 and 4.
- Overlap is only enforced for sprites with `blocks`; non-blocking fixtures (label, marker) can stack by design, so "taken" does not apply to them.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +600 / -25 including tests; about 485 source lines (non-test), under the A13 limit of 550, so room resize stays in this slice.
