## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| src/lib/sprites/device-slots.ts | `resolveDeviceArt`, `DeviceArt`, `art` on placements; placeDevices accepts resolved devices |
| src/lib/sprites/placement.ts | `image` DrawOp, optional `imageReady` arg, image centred on the slot frame |
| src/lib/sprites/map-view.ts | keep validated `deviceType` |
| src/ui/roomlayout/paint.ts | draw `image` ops 1:1, smoothing off |
| src/ui/roomlayout/catalog-images.ts (new) | pure factory: one fetch + decode per type/version |
| src/ui/roomlayout/useCatalogImages.ts (new) | React hook over the factory |
| src/ui/deviceTypes/image-url-cache.ts | widen `sync`/`url` param type |
| src/ui/roomlayout/RoomMap.tsx, EditorCanvas.tsx, RoomMapSection.tsx, LayoutEditor.tsx | pass `catalogImages` through |
| src/ui/seats/SeatsPage.tsx, src/ui/roomlayout/LayoutEditorPage.tsx | one hook call per page |
| tests: device-slots, placement, map-view, paint, catalog-images (new) | plan test list |

### Tests added / changed
- device-slots.test.ts › resolveDeviceArt (6 cases)
- placement.test.ts › catalog device images (6 cases)
- map-view.test.ts › deviceType passthrough
- paint.test.ts › paintRoom catalog images (2)
- catalog-images.test.ts (5: single fetch, version bump, fetch/decode failure, no image, dispose)

### Checks (actual output summary)
- typecheck: exit 0
- check:layers: no violations
- format:check: all matched files use the correct format
- test: 252 files passed | 1 skipped; 2474 passed | 7 skipped
- build: exit 0

### Out-of-plan files
LayoutEditor.tsx (plan said "or LayoutEditor.tsx"): prop pass-through to EditorCanvas.

### Follow-ups (noticed, not done)
- Centring on /dev/roommap was not checked by eye (no browser here); adjust offset if it looks off (A3).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see git show --stat
