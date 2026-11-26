## Attempt 1 — 2026-11-26
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (950 files)
- `pnpm typecheck && pnpm check:layers`: exit 0. typegen + tsc clean. "check-layers: 895 files, no violations"
- `pnpm test`: exit 0. "Test Files 342 passed | 1 skipped (343)", "Tests 3394 passed | 9 skipped (3403)". These match impl-log.
- `pnpm build`: exit 0, "Compiled successfully"
- `pnpm test:db` (local docker Postgres): exit 0. "Test Files 22 passed (22)", "Tests 344 passed (344)"

### Acceptance criteria
- [x] AC1: a non-square big photo saves a centered square of at most 512 px and at most 256 KB. Evidence: `photo-crop.test.ts` covers centerSquare 4032x3024 → `{504,0,3024}`, targetSide, and halvingSteps `[1512,756,512]` plus the invariants loop. `fitToLimit` "returns the first JPEG within the limit and stops". `profile-photo.test.ts` › "4032x3024: renders the centered square in halving steps and returns valid JPEG bytes" checks render args, validatePhoto ok, close once. The server acceptance part is a manual check (listed below).
- [x] AC2: EXIF photos are saved upright. Code review shows one rotation mechanism: `photo-canvas.ts:94` `createImageBitmap(file, { imageOrientation: "from-image" })`, with the `<img>` fallback relying on the default `image-orientation`. There is no manual rotation anywhere. The visual result is a manual check.
- [x] AC3: 40x30 saves as 64x64, and transparent images stay PNG when they fit. `profile-photo.test.ts` › "40x30 with alpha …" checks render args `{5,0,30}`, steps `[64]`, type png. `photo-crop.test.ts` › "alpha and PNG fits" (one encode) and "alpha and PNG too big" (JPEG ladder) pass. With no alpha, PNG is never tried.
- [x] AC4: no metadata, and trailing data is accepted. On every path the bytes come from the encoder only. `preparePhoto` returns only `stripPhotoMetadata(fit.bytes)`, where `fit.bytes` comes from `rendered.encode`. `photo-canvas.ts:39-45` `toBytes` reads only `convertToBlob`/`toBlob` output. The file is passed only to `createImageBitmap` / an object URL and is never read as bytes. Test "encoder output that fails validatePhoto … the input bytes are never read" asserts `arrayBuffer` is not called. The real phone JPEG case is manual.
- [ ] AC5: an undecodable or oversized file shows a clear message and sends no request. The logic and tests pass: >20 MB with no decode, null/throwing decode → read_failed, 60 MP → too big with close and no render, and in `own-photo-store.test.ts` a refused prepare sends no PUT and does not call onUploading. But the UI keeps showing "Processing your photo..." next to the error. See Issue 1.
- [x] AC6: all Checks pass (above).

Bitmap lifetime: `profile-photo.ts:50-52` closes the source in a `finally` around every path after a successful decode: 0x0, the pixel cap, a null render, a render throw, and a `fitToLimit` throw. Tests cover 0x0, 60 MP, render throws, and success (exactly once). `viaBitmap` cannot throw after the bitmap is created. The `<img>` path's close is a no-op. OK.

Hint copy ("centered square"): the plan contradicts itself. Approach step 7 sets the hint text to "… cropped to a centered square …", while the Tests row says the hint must not contain "square". The ticket's intent is "no more 'must be square / 64–512 px / 256 KB' for the user", meaning no constraints shown to the user. A sentence explaining the automatic crop meets that intent and is the hint Ming approved. The implementer's choice is accepted: errors are checked for square/px/256 KB, the hint for px/256 KB, and the choice is logged in impl-log. Not an issue.

### Issues
#### Issue 1 — 🔴 blocker — correctness / UX (AC5)
- **Where**: `src/ui/portal/ProfilePhoto.tsx:36-40`
- **Expected**: when `preparePhoto` refuses the file (`read_failed`, `image_too_big_to_process`, `image_could_not_shrink`), only the error alert shows and the "Processing" notice is gone.
- **Actual**: `run` sets `setNotice(start)` (`processingNotice`) at line 36. Only the `onUploading` callback clears it, at line 59, and that callback never fires when prepare refuses. The failure branch at line 40 only calls `setError(...)`. The section therefore renders `role="alert"` "Could not read this image…" and `role="status"` "Processing your photo..." together after a refusal, which is a contradictory message on the AC5 path.
- **Fix instruction**: in `run`, clear the notice on failure, e.g. replace lines 39-40 with `setNotice(r.ok ? done : null); if (!r.ok) setError(photoErrorMessage(r.code));`. Do not change anything else.

### Rules (CLAUDE.md)
No violations found. R1: `src/lib/photo-crop.ts` is pure and imports only `@/lib/validate/photo`. `photo-canvas.ts` imports only `@/lib` types. check:layers is clean. R2/R3/R6/R7 do not apply. R4: the changed files match the plan's file list exactly, with no out-of-plan files. R5: the pure logic is tested. The canvas adapter is hand-checked by the approved plan (A9).

### Blockers from review agents
None.

### Nits (do not block)
- 💭 `profile-photo.test.ts`: the hint check could also assert `not.toMatch(/must be square/)` to keep the ticket's intent guarded.
- 💭 `photo-canvas.ts` `hasTransparency`: `getContext("2d", { willReadFrequently: true })` is not needed for one read. Ignore unless the console warns.
- 💭 `photo-canvas.ts:73`: `context(final)` re-requests the context and re-sets smoothing. This is harmless.

### Manual checks for Ming (photo-canvas.ts is hand-checked only; carry into the PR)
Run `pnpm dev`, open the Profile tab, and keep the DevTools Network tab open:
1. A large landscape phone JPEG (for example 4032x3024, several MB). Expect one `PUT /api/me/photo` that returns 2xx with a body under 256 KB, `image/jpeg`, 512x512. The header avatar updates. The crop is centered.
2. A portrait phone JPEG with EXIF orientation 6 (a photo taken with the phone held upright). The saved avatar is upright, not sideways.
3. A phone JPEG with GPS/EXIF or trailing data (the file the old version refused). It is accepted. Optionally download the stored photo and check that it has no EXIF/GPS (for example in an online EXIF viewer).
4. A tiny image (for example 40x30 PNG). It saves as 64x64.
5. A small transparent PNG. The PUT is `image/png` and the transparency is kept. A large transparent PNG falls back to JPEG with a white background, not black.
6. A WebP image. It is accepted and saved as JPEG.
7. A `.txt` file renamed to `.jpg`. Expect "Could not read this image. Try a JPEG or PNG photo." with no PUT, and (after Issue 1) no lingering "Processing" text.
8. A file over 20 MB. Expect "This image is too big to process…" immediately, with no PUT.
9. Labels: "Processing..." shows and then "Uploading..." during the save. The button and the input are disabled meanwhile.
10. Repeat 1 and 2 in Firefox. If `imageOrientation: "from-image"` is unsupported there, the `<img>` fallback must still give an upright result.
11. After merge, on real phones: iPhone Safari (HEIC and JPEG) and Android Chrome camera photos (plan "Ming verification after merge"). HEIC outside Safari is expected to show "could not read".

### Follow-ups (out of scope)
- The memory guard runs only after a full decode. A heavily compressed file under 20 MB with a huge pixel count (for example a 30000x30000 PNG) is fully decoded by `createImageBitmap` before the 50 MP check, which can still run the tab out of memory. A follow-up could read the dimensions from the PNG/JPEG header first, or pass `resizeWidth`/`resizeHeight` to `createImageBitmap`. The approved plan chose decode-then-check, so this is not a REWORK item.

## Attempt 2 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (950 files)
- `pnpm typecheck`: exit 0 (typegen + tsc clean). `pnpm check:layers`: exit 0, "check-layers: 895 files, no violations"
- `pnpm test`: exit 0, "Test Files 342 passed | 1 skipped (343)", "Tests 3394 passed | 9 skipped (3403)"
- `pnpm build`: exit 0
- `pnpm test:db` (local Postgres): exit 0

### Attempt-1 blocker
Issue 1 fixed. `git diff d6f03ae..HEAD -- src` is a single hunk in `src/ui/portal/ProfilePhoto.tsx`: the failure branch of `run` now calls `setNotice(null)` before `setError(...)`. The "Processing your photo..." status can no longer sit next to the refusal alert. No other source change. No DOM test (no jsdom); verified by code reading and covered by manual check 7.

### Acceptance criteria
AC1-AC4 and AC6 unchanged from attempt 1 (still met; checks green). AC5 now met: logic and tests as before, and the UI clears the notice on refusal.

### Issues
None.

### Rules (CLAUDE.md)
No violations. R4: attempt 2 touches only ProfilePhoto.tsx (in the plan's file list) plus work files.

### Nits and follow-ups
Unchanged from attempt 1. Manual checks for Ming (list in attempt 1, items 1-11) carry into the PR; item 7 should now show no lingering "Processing" text.
