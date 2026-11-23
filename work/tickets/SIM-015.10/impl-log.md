## Attempt 1 — 2026-11-23

### Files touched
| File | Required because |
|---|---|
| `src/lib/layout-editor/pointer-gesture.ts` (new) | Pure gesture machine, drag ghost, marquee (AC1, AC2, AC4). |
| `src/lib/layout-editor/shortcuts.ts` (new) | `keyAction`, `isTextField`, `SHORTCUTS` (AC3). |
| `src/lib/layout-editor/editor-state.ts` | `selectMany`, `nudge` with coalescing; reducer wrapper resets the run on other actions. |
| `src/lib/layout-editor/history.ts` | `replacePresent`. |
| `src/lib/layout-editor/canvas-point.ts` | `canvasCell`, `clampTile`; `canvasTile` built on `canvasCell`. |
| `src/lib/layout-editor/tiles.ts` | `footprintBox`. |
| `src/lib/layout-editor/place-tool.ts` | Removed `escDisarms` (replaced by `keyAction`, A8). |
| `src/ui/roomlayout/EditorCanvas.tsx` | Pointer handlers drive the machine, capture, rAF, Esc cancel, region focus, `frozen`/`onAction` props. |
| `src/ui/roomlayout/GestureOverlay.tsx` (new) | Drag ghost and marquee rendering. |
| `src/ui/roomlayout/ShortcutList.tsx` (new) | Visible shortcut list. |
| `src/ui/roomlayout/LayoutEditor.tsx` | Root `onKeyDown` via `keyAction`, canvas props, `ShortcutList`, save ref guard (A17). |
| `src/ui/roomlayout/EditorToolbar.tsx` | `aria-keyshortcuts` on Undo and Save. |
| `src/ui/roomlayout/EditorInspector.tsx` | `aria-keyshortcuts` on Rotate and Delete. |
| `src/ui/copy/roomlayout.ts` | `editor.shortcuts` copy (D36), typed `satisfies Record<ShortcutId, ...>`. |
| Test files: `pointer-gesture.test.ts` (new), `shortcuts.test.ts` (new), `editor-state.test.ts`, `history.test.ts`, `canvas-point.test.ts`, `tiles.test.ts`, `place-tool.test.ts`, `LayoutEditorViews.test.tsx` | R5, as listed in the plan. |

### Tests added / changed
- pointer-gesture.test.ts: all 14 planned tests (down filters, press/release, armed tool, touch, frozen, threshold, drag keys, drag release, release-first, same-object dedupe, marquee, marqueeBox/Keys, cancel, dragPreview).
- shortcuts.test.ts: mapping, text field, ignore-contexts (incl. IME), unmapped, repeat, no selection, isTextField, SHORTCUTS.
- editor-state.test.ts: selectMany, nudge coalescing (same run, after other action, after undo, refused nudge, ignored cases). The "after another action" test uses inspector move, select and selectMany (not rotate: a rotate of the test desk is refused in this fixture, which also ends the run).
- history, canvas-point, tiles: one test each. place-tool.test.ts: `escDisarms` test removed.
- LayoutEditorViews.test.tsx: ShortcutList, aria-keyshortcuts, GestureOverlay.

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0 (next typegen + tsc, no errors); `pnpm check:layers`: "411 files, no violations".
- format:check: "All matched files use the correct format." (ran `pnpm format` first on the changed files).
- test: `pnpm test`: 165 files passed, 1752 passed | 3 skipped.
- build: `pnpm build` exit 0.
- `pnpm test:db` not run (CI-only, no schema change).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Edge autoscroll while dragging, live announcements, sprite in the ghost (plan A12).
- The drag and keyboard paths have no DOM test (SIM-015.7 A3); they rely on Ming verification 1 to 6.

### Scope self-check
- Could the diff be smaller? No; the machine, key mapper and overlay are each needed by an AC.
- Diff size (git diff HEAD): 16 tracked files, +421 / -80, plus 6 new files (4 source, 2 test). Source lines (non-test): about 280 added in tracked files plus 319 in 4 new files, about 600 raw added and about 70 removed, so about 530 net. That is at the A15 threshold (about 550) but not over it by net count, so the keyboard part stays in this slice (A15 not triggered). The reviewer may judge otherwise.
