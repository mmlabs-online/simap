## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| src/ui/mapItems/map-items-api.ts | putArt, putImage, deleteImage (AC1) |
| src/ui/mapItems/map-items-api.test.ts | tests for the three methods |
| src/ui/mapItems/map-item-art.ts (new) | pure helpers (AC1, AC2) |
| src/ui/mapItems/map-item-art.test.ts (new) | unit tests |
| src/ui/mapItems/map-item-image.ts (new) | precheck, messages, outcome |
| src/ui/mapItems/map-item-image.test.ts (new) | unit tests |
| src/ui/mapItems/useMapItemImages.ts (new) | page hook over createImageUrlCache |
| src/ui/mapItems/MapItemArtDialog.tsx (new) | Art dialog and pure body |
| src/ui/mapItems/MapItemArtDialog.test.tsx (new) | static markup tests |
| src/ui/mapItems/SpriteBrowser.tsx (new) | inline text-only sprite chooser |
| src/ui/mapItems/SpriteBrowser.test.tsx (new) | static markup tests |
| src/ui/mapItems/MapItemsView.tsx | Art button, Customised badge, thumbnail |
| src/ui/mapItems/MapItemsView.test.tsx | row tests; existing renders pass `onArt` |
| src/ui/mapItems/MapItemsPage.tsx | art dialog kind, hook, wiring |
| src/ui/copy/mapItems.ts | art copy, list.customised, artLabel (D36) |

### Tests added / changed
- map-items-api.test.ts: putArt (x2), putImage, deleteImage, ApiAccessError mapping
- map-item-art.test.ts: artDirs, artPanelView, expectedImageSize (x2), spriteChoices (x2), artImageEntries, isCustomised, thumbDir
- map-item-image.test.ts: checkMapItemImage (x3), artErrorMessage (x2), artOutcome
- MapItemArtDialog.test.tsx: 8 tests as planned
- SpriteBrowser.test.tsx: radiogroup/empty state, confirm step
- MapItemsView.test.tsx: Art button, badge and thumbnail

### Checks (actual output summary)
- typecheck: clean (`next typegen && tsc --noEmit`)
- check:layers: 796 files, no violations
- format:check: pass after `pnpm format`
- test: 302 files passed, 1 skipped; 3051 tests passed, 7 skipped
- build: not run

### Deviations from the plan
- `artOutcome(result, item, dir)` takes the item and direction (plan: `artOutcome(result)`), because a server `image_bad_size` message needs the expected size.
- `MapItemArtBody` also takes `status` and `chooseRefs` props; no `busyDir` prop (not needed).
- `onReload(): Promise<void>` and an `ArtCall` type are written in method/object form because `no-literals.test.ts` flags `=> Promise<` in .tsx files.
- Non-directional item: status line says "Saved for Art"; the server-side `image_bad_size` text still says "South needs ...".
- The "empty state" browser test uses an item with w=0,h=0 (no real item has no fitting frame).
- Product size is above the ~480-line estimate (the dialog is about 300 lines after oxfmt).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- useMapItems.ts is dead code (A13).
- Direction name for non-directional items in `image_bad_size` ("South") could say "Art".
- SIM-039.10: atlas previews for package and library art.

### Scope self-check
- Could the diff be smaller? Only by cutting the sprite browser (plan's named cut).
- Diff size: +151 / -13 in modified product files, 602 lines in new product files; tests extra.
