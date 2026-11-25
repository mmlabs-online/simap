
## Attempt 1

### Files touched
- `src/ui/mapItems/frame-preview.ts` (new): `atlasFrame`, `frameRect`, `containRect`. Required because frame rect logic must be unit tested.
- `src/ui/mapItems/frame-preview.test.ts` (new): unit tests.
- `src/ui/mapItems/FramePreview.tsx` (new): thin canvas component, one `drawImage`.
- `src/ui/mapItems/map-item-art.ts` (+ test): `panelFrameKey`, `thumbSprite`. Uses `resolveFrameKey` from `@/lib/sprites/placement` (lib only; `check:layers` passes).
- `src/ui/mapItems/MapItemArtDialog.tsx` (+ test): `atlas` / `atlasFailed` props, 1x/2x previews, note, atlas passed to the browser.
- `src/ui/mapItems/SpriteBrowser.tsx` (+ test): row thumbnails (32 px box) and staged preview (1x).
- `src/ui/mapItems/MapItemsView.tsx` (+ test): sprite-only row thumbnail.
- `src/ui/mapItems/MapItemsPage.tsx`: `useAtlas()` once, passed down.
- `src/ui/copy/mapItems.ts`: `art.atlasFailed`, `art.frameAlt`.

### Tests added
frame-preview (frameRect, rejected scales, containRect large/small/1x1/zero, atlasFrame), panelFrameKey, thumbSprite, dialog atlas previews/failed/loading, browser thumbnails/missing frame, view sprite-only thumb.

### Checks
- typecheck exit=0; check:layers: 799 files, no violations; format:check exit=0
- test: Test Files 303 passed | 1 skipped; Tests 3068 passed | 7 skipped
- build exit=0

### Out-of-plan files
None.

### Deviations
- frameRect rejects (null) non-integer or <= 0 scale (plan allowed either).
- Staged block in the browser shows the frame at 1x (not a box thumbnail), so large frames are not shrunk on the confirm step.
- Product lines: about 197 (97 in new files, 100 added in modified files), within the ~220 estimate.

### Follow-ups
None.
