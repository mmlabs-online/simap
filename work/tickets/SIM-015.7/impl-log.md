## Attempt 1 — 2026-11-23

Slice 2a only (plan A1). Placement, resize, drag, marquee and keyboard shortcuts are SIM-015.9 and SIM-015.10.

### Files touched
| File | Required because |
|---|---|
| `src/lib/sprites/map-view.ts` | `version` on `MapView` (baseVersion for the PUT) |
| `src/lib/sprites/map-view.test.ts` | version test |
| `src/ui/seats/seats-api.ts` | `saveLayout` PUT |
| `src/ui/seats/seats-api.test.ts` | saveLayout tests |
| `src/ui/roomlayout/RoomMapSection.tsx` | `editHref` prop and "Edit layout" link (A10) |
| `src/ui/roomlayout/RoomMapSection.test.tsx` | `version` fixture, Edit link test |
| `src/ui/seats/SeatsPage.tsx` | passes `editHref` for admins |
| `src/lib/layout-editor/editor-state.ts` (new) | reducer, `initEditor`, `editorFlags`, `savePayload` |
| `src/lib/layout-editor/save-errors.ts` (new) | `saveErrorKind` |
| `src/lib/layout-editor/canvas-point.ts` (new) | `canvasTile` |
| `src/ui/roomlayout/editor-page.ts` (new) | `editorGate` |
| `src/ui/roomlayout/leave-guard.ts` (new) | pure guard handlers and attach/detach |
| `src/ui/roomlayout/useLeaveGuard.ts` (new) | hook around the guard |
| `src/ui/roomlayout/useAtlas.ts` (new) | atlas loading shared by `RoomMap` and the editor |
| `src/ui/roomlayout/RoomMap.tsx` | uses `useAtlas`, no behaviour change |
| `src/ui/roomlayout/EditorCanvas.tsx` (new) | paint, click select, outlines |
| `src/ui/roomlayout/EditorInspector.tsx` (new) | selection actions, size, tray, items list |
| `src/ui/roomlayout/EditorToolbar.tsx` (new) | Back, Undo, zoom, Save, block reason |
| `src/ui/roomlayout/EditorViews.tsx` (new) | gate views, save error banner, leave dialog, status line |
| `src/ui/roomlayout/LayoutEditor.tsx` (new) | container and save flow |
| `src/ui/roomlayout/LayoutEditorPage.tsx` (new) | page, gate, data hooks, keyed remount |
| `src/ui/roomlayout/index.ts`, `src/ui/index.ts` | export `LayoutEditorPage` |
| `src/app/(app)/rooms/[roomCode]/edit/page.tsx` | replaces the stub |
| `src/ui/copy/roomlayout.ts` | `editLayout` and `editor` copy (D36) |

### Tests added / changed
- `src/lib/layout-editor/editor-state.test.ts` (13 tests, all plan cases plus "edits are ignored while saving")
- `src/lib/layout-editor/save-errors.test.ts`, `canvas-point.test.ts` (as planned)
- `src/ui/roomlayout/editor-page.test.ts` (3), `leave-guard.test.ts` (6), `LayoutEditorViews.test.tsx` (7)
- `map-view.test.ts` › version; `seats-api.test.ts` › saveLayout x2; `RoomMapSection.test.tsx` › Edit link
- `RoomMap.test.tsx` unchanged and green after the `useAtlas` extraction.

### Checks (actual output summary)
- typecheck: `pnpm typecheck && pnpm check:layers` exit 0; "check-layers: 402 files, no violations"
- format:check: "All matched files use the correct format."
- test: "Test Files 162 passed (162); Tests 1690 passed | 3 skipped (1693)"
- build: exit 0, `/rooms/[roomCode]/edit` listed
- `pnpm test:db`: not run (CI-only, no DB or docker here; no server or SQL change)

### Out-of-plan files
None.

### Deviations from the plan text (small)
- `useAtlas` also returns `setFailed` because `RoomMap` and the canvas set `failed` when painting fails (the plan said `{atlas, failed}`).
- `useLeaveGuard` returns `{pending, request, leave, stay}` without `disarm`: after a save `dirty` turns false and the effect detaches the guard, so nothing needs it.
- `leaveDecision(dirty)` takes one argument (the href was unused).
- A non-fatal gate nuance: `editorGate` returns `checking` while the session tier is still unknown, so a signed-in non-admin never sees the editor shell flash.
- The Back button has no arrow icon (`arrow_back` is not in `ICON_NAMES`; adding it would touch the icon font subset).
- The toolbar zoom buttons are all enabled; the canvas clamps to the allowed zoom and shows the "zoom limited" note.
- Not run in a browser (no dev token, DB or Identity here); the Ming verification list in the plan applies.

### Follow-ups (noticed, not done)
- `aria-pressed` on the zoom buttons shows the requested zoom, not the clamped one, in a room that only fits zoom 2.
- `useRoomLayout` keeps the old view on some failed reloads, so a failed conflict Reload does not remount the editor; the error banner stays.

### Scope self-check
- Could the diff be smaller? No; each file maps to an acceptance criterion in the plan.
- Diff size: about +1,450 lines including tests (source about 900).
