# Implementation log — SIM-039.8

## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| src/lib/sprites/item-art.ts (new) | Pure resolver/helpers; imports only `@/lib/map-items/types` (no `map-items/art`, `library`, `placement`: no cycle) |
| src/lib/sprites/placement.ts | `typeId`->`src`, placeholder op, `art` param, row-based chain for floors/fixtures/seats/chairs, bottom-left shift (library frame only when resized), custom image/placeholder emit |
| src/ui/roomlayout/paint.ts | `(src, version)` rename, placeholder branch |
| src/ui/deviceTypes/image-url-cache.ts | exported `ImageEntry` (no device-type import) |
| src/ui/roomlayout/catalog-images.ts | `sync(devices, items)`, `itemSize` |
| src/ui/roomlayout/useCatalogImages.ts | items param, load dispatch by id, `itemSize` |
| src/ui/mapItems/map-items-api.ts | `getArtImage` |
| src/ui/roomlayout/RoomMap.tsx, RoomMapSection.tsx, src/ui/seats/SeatsPage.tsx | pass `items`, placed entries |
| src/lib/layout-editor/editor-state.ts | `editorItems` |
| src/ui/roomlayout/EditorCanvas.tsx, LayoutEditor.tsx, LayoutEditorPage.tsx | editor art wiring (`items`, `onArtEntries`) |
| tests: item-art.test.ts (new), placement.test.ts, paint.test.ts, catalog-images.test.ts, map-items-api.test.ts, editor-state.test.ts | R5 |

### Tests added / changed
- placement.test.ts: "seed catalog rows change nothing" (every LIBRARY_ITEMS entry, all allowed rotations, seats with devices, floors; `toEqual` with/without items), custom image op + negative bounds, not-ready fallback, bottom-left alignment 0/90/180/270, resized library frame, placeholder, desk/chair/floor images; existing device test renamed `typeId`->`src`.
- item-art.test.ts: direction, box, fits, resolver chain, placedArtEntries (incl. chair direction), id round-trip.
- paint.test.ts: item image 1:1, placeholder, missing source isolation.
- catalog-images.test.ts: item cases; map-items-api.test.ts: getArtImage; editor-state.test.ts: editorItems.

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: next typegen + tsc, no errors.
- check:layers: 782 files, no violations.
- test: Test Files 295 passed | 1 skipped; Tests 3002 passed | 7 skipped.
- build: exit 0.
- test:db: not run (no server change).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- A chair/desk whose registry `dir` differs from the rotation direction on a non-directional plain key is not distinguished in `placedArtEntries` (uses rotation direction); not reachable with the current library.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see `git diff --shortstat` of the commit.
