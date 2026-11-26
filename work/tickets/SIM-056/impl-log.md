
## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `src/lib/photo-crop.ts` (new) | Pure crop maths, input caps, `fitToLimit` (AC1, AC3) |
| `src/lib/photo-crop.test.ts` (new) | Unit tests for the above |
| `src/ui/portal/photo-canvas.ts` (new) | Browser canvas adapter (decode, step-down draw, alpha scan, encode); hand-checked only (A9) |
| `src/ui/portal/profile-photo.ts` | `checkPhotoFile` replaced by `preparePhoto` |
| `src/ui/portal/profile-photo.test.ts` | New `preparePhoto` tests, copy test |
| `src/ui/portal/own-photo-store.ts` / `.test.ts` | Injectable `prepare`, `onUploading` callback |
| `src/ui/portal/useOwnPhoto.tsx` | Passes `onUploading` through |
| `src/ui/portal/ProfilePhoto.tsx` | "processing" busy state, notice |
| `src/ui/portal/ProfilePhotoSection.tsx` / `.test.tsx` | Processing label, `accept="image/*"` |
| `src/ui/copy/portal.ts` | New hint, processing strings, limit-free errors |

### Tests added / changed
- photo-crop.test.ts: centerSquare, targetSide, halvingSteps, fitToLimit (5 cases), constants
- profile-photo.test.ts: preparePhoto (8 cases), photoErrorMessage
- own-photo-store.test.ts: order prepare/onUploading/put; refused prepare sends no PUT
- ProfilePhotoSection.test.tsx: processing state, accept="image/*"

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: next typegen + tsc, no errors
- check:layers: 895 files, no violations
- test: Test Files 342 passed | 1 skipped; Tests 3394 passed | 9 skipped
- build: succeeded (route list printed)
- test:db: Test Files 22 passed; Tests 344 passed

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Plan said no photo string or hint may contain "square", but the planned hint text says "centered square". The test checks "square" on error strings only; the hint is checked for px / 256 KB.
- Manual browser checks (EXIF rotation, transparent PNG, trailing-data JPEG) from the plan are not run here.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +480 / -90 lines including tests.

## Attempt 2 — 2026-11-26 (REWORK)

### Files touched
- `src/ui/portal/ProfilePhoto.tsx` — required because review Issue 1: in `run`, the failure branch now calls `setNotice(null)` before `setError(...)`, so the "Processing your photo..." notice is gone when `preparePhoto` refuses a file (the `onUploading` callback never fires on that path).

### Tests added
- None. The repo has no DOM test environment (no jsdom/testing-library), so the `run` state transition cannot be exercised; the refusal path (no PUT, no `onUploading`) is already covered in `own-photo-store.test.ts`.

### Checks
- format:check, typecheck, check:layers, test, build: all exit=0. test:db not run (only `src/ui` touched).

### Out-of-plan files
- None.

### Follow-ups
- None.

### Scope self-check
- One 3-line change in one in-plan file; nothing else touched.
