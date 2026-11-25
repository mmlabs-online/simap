## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| src/ui/deviceTypes/device-type-image.ts (new) | client check, ImageDraft, field view |
| src/ui/deviceTypes/image-url-cache.ts (new) | blob URL cache per {id, imageVersion}, limit 4 |
| src/ui/deviceTypes/device-type-save.ts (new) | save sequence, partial failure |
| src/ui/deviceTypes/useDeviceTypeImages.ts (new) | hook owning the cache |
| src/ui/deviceTypes/DeviceTypeImageField.tsx (new) | dialog image section |
| src/ui/deviceTypes/DeviceTypeThumb.tsx (new) | 48 px thumb / placeholder |
| src/ui/deviceTypes/device-types-api.ts | getImage, putImage, removeImage |
| src/ui/deviceTypes/DeviceTypeFormDialog.tsx | image field, save sequence, legend first child (should-fix) |
| src/ui/deviceTypes/DeviceTypesView.tsx | thumb in each row, `imageUrl` prop |
| src/ui/deviceTypes/DeviceTypesPage.tsx | wire cache to list and dialog |
| src/ui/copy/deviceTypes.ts | image copy (D36) |
| tests: device-type-image, image-url-cache, device-type-save, DeviceTypeImageField, device-types-api, DeviceTypeFormDialog, DeviceTypesView | per plan |

### Tests added / changed
- All tests listed in plan.md. Deviation: the cache never creates a URL for a late or superseded result, so "revoked at once" is "no URL created" (same effect).

### Checks (actual output summary)
- typecheck: clean; check:layers: 659 files, no violations
- format:check: clean (oxfmt)
- test: 251 files passed, 2454 tests passed, 7 skipped
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Dialog grows about 90 px; a scrollable body may be needed on short viewports (A11).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +900 lines including tests.
