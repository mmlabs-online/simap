# Impl log — SIM-039.5 (slice 1: palette and editor sizes)

## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| src/lib/layout-editor/palette.ts | `catalogPalette`, `PaletteEntry.name`, `editorPalette` removed (AC 1) |
| src/lib/sprites/map-view.ts | `MapView.items` with a per-entry shape check (Q5) |
| src/lib/layout-editor/tiles.ts, place-tool.ts, pointer-gesture.ts, draft.ts, save-run.ts | defaulted `lookup` parameter; sizes through `footprintAt` (AC 1a) |
| src/lib/layout-editor/editor-state.ts | `layoutItems`, `palette`, `footprints`, `editorFootprints`, `catalog` action, lookup in every op and the save pre-check |
| src/ui/mapItems/map-items-api.ts, useMapItems.ts (new) | `GET /api/map-items` client and hook |
| src/ui/roomlayout/LayoutEditorPage.tsx, LayoutEditor.tsx, Palette.tsx, EditorCanvas.tsx, EditorInspector.tsx | wire palette, sizes, names, loading/error+retry |
| src/ui/copy/roomlayout.ts | `itemName(item, catalogName?)`, palette loading/failed/retry, `palette.groups` removed (D36) |
| *.test.ts(x) beside each of the above, RoomMapSection.test.tsx | tests; `items: []` fixture (type only) |

### Tests added / changed
- palette.test.ts › catalogPalette (filter, sort, grouping, entry fields); map-view.test.ts › items
- tiles / place-tool / pointer-gesture / draft / save-run tests › catalog lookup cases
- editor-state.test.ts › catalog sizes (2 cases)
- map-items-api.test.ts (new, 4 cases)
- LayoutEditorViews.test.tsx › palette catalog, loading/error+retry, inspector catalog name

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: clean (no errors)
- check:layers: 741 files, no violations
- test: Test Files 280 passed | 1 skipped (281); Tests 2881 passed | 7 skipped (2888)
- build: exit 0
- test:db (throwaway Postgres 16 under /var/tmp, stopped and deleted): Test Files 3 failed | 16 passed; Tests 18 failed | 265 passed. The failures are in devices.db / handoffs.db / members manage.db (check constraint `device_handoffs_decided_check`). The same 18 fail on the unchanged base (verified with `git stash -u`), so they are pre-existing; the brief said 9, the actual count is 18. No diff under src/server, src/app/api, db.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- test:db: 18 pre-existing failures (handoffs/devices/members), not 9.
- Slice 2 (art rendering) stays with SIM-039.8; spec LAY-03 order text update (A7) still pending.

### Scope self-check
- Could the diff be smaller? No; every change is on the plan's file list.
- Diff size: see `git diff --stat` on the commit.
