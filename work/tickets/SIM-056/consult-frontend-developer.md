# Consult — frontend-developer — SIM-056

## Findings
- The size/shape gate lives in `checkPhotoFile` (`src/ui/portal/profile-photo.ts`). It is called only from `own-photo-store.ts` `upload(file)`, which takes a structural `{size, arrayBuffer()}`. The store is unit-tested with fake files (`own-photo-store.test.ts`, `profile-photo.test.ts`), so the existing tests assume the current gate.
- `checkPhotoFile` first rejects `file.size > 256 KB` (`image_too_large`). It then runs `validatePhoto` and `stripPhotoMetadata`. `validatePhoto` uses a strict `parseJpeg` that rejects trailing bytes, which is the phone-JPEG failure the ticket mentions. A canvas re-encode produces clean output, so `validatePhoto` is a good final safety net and still applies.
- `ProfilePhoto.tsx` `run()` sets `busy="upload"`. `ProfilePhotoSection` already shows `copy.uploading` ("Uploading...") for that state and disables the input. The input has `accept="image/png,image/jpeg"`, which must be widened to `image/*` or WebP/HEIC will be blocked in the picker.
- Copy in `src/ui/copy/portal.ts` (lines 53-71): `hint`, `image_too_large`, `image_bad_size` and `image_not_supported` all mention the old limits and must be rewritten. `read_failed` already exists.
- The `PhotoCode`/`photoErrors` mapping is a `Record<string,string>` lookup with an `apiErrorMessage` fallback. New codes only need new copy keys.
- The server codes (`image_too_large`, `image_bad_size`, `image_not_supported`) can still come back from `PUT /api/me/photo`. Keep the old copy for these, reworded without the limits. Only the pre-upload client check goes away.

## Recommendations
1. **New pure module `src/ui/portal/photo-crop.ts`** (AC1, AC3):
   - `centerSquare(w, h)` returns `{sx, sy, side}`, using floor and a centered offset.
   - `targetSize(side)` returns `clamp(side, 64, 512)`.
   - `halvingSteps(side, target)` returns the intermediate sizes for step-down resizing, never going below the target.
   - `pickFormat(hasAlpha)` and `nextQuality(prev)` as pure decision logic.
   - A `fitToLimit` loop that takes an injected `encode(type, q) => Promise<Uint8Array|null>`. Try PNG first only if alpha is present and it fits. Otherwise step JPEG quality 0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4, 0.3. If the result still exceeds the limit at the lowest quality, return `image_too_large`. A 512x512 JPEG at q 0.3 is far under 256 KB, so this effectively cannot fail. Use a finite floor and an explicit give-up code anyway.
   - All of this is testable in node with a fake `encode`.
2. **Thin canvas adapter `src/ui/portal/photo-canvas.ts`** (hand-checked; exclude it from unit tests):
   - `createImageBitmap(file, {imageOrientation:"from-image"})`. Fall back to `<img>` + `URL.createObjectURL`, which honors EXIF in modern browsers via `image-orientation: from-image` by default. Map a decode failure to `read_failed`.
   - Alpha detection must be real. Draw to a canvas, `getImageData` on the small final canvas, and scan the alpha channel for any value below 255. Do not infer alpha from the MIME type, since a PNG without alpha should go to JPEG.
   - Before a JPEG encode, fill the canvas white, because transparent pixels become black in JPEG.
   - Use `imageSmoothingQuality="high"`. Close the `ImageBitmap` in a `finally`.
   - Use `OffscreenCanvas` if available, else a `<canvas>`. Both `convertToBlob` and `toBlob` return a nullable blob, so handle null.
3. **Input guard** (AC5), before any decode:
   - Check `file.size` against a cap (20 MB suggested). Add a pixel cap after decode, e.g. width*height > 100 MP or a side > 16384, and refuse with a new `image_too_big_to_process` code.
   - Do not try to read pixel dimensions from the file header first. The decode itself is the memory risk, so check the bitmap dimensions right after `createImageBitmap` and close it if too large.
   - Note that for very large images `createImageBitmap` itself may fail. Treat that as `read_failed`.
4. **`checkPhotoFile` becomes `preparePhoto(file)`**. It reads size, runs the adapter, then runs the result through the existing `validatePhoto` as a belt-and-braces check. Return the same `PhotoCheck` shape so `own-photo-store.ts` changes minimally. To keep the store testable in node, inject the converter: `createOwnPhotoStore({..., prepare})` with a default of the real one. Then `own-photo-store.test.ts` can pass a fake `prepare`.
5. **Processing state** (AC "Processing..."): add a `busy="processing"` value, or keep `busy="upload"` and split the label. The store's `upload` does convert and PUT in one call, so the UI can't see the boundary. Options: (a) one label "Processing..." for the whole upload (simplest; update `copy.uploading` text), or (b) split the store into `prepare` then `upload`. (a) is enough for the ticket.
6. **Copy** (D36): new hint "Any photo works. It is cropped to a square and resized automatically." Add `image_too_big_to_process` and reword `read_failed` as "Could not read this image. Try a JPEG or PNG." Reword the server-side codes without numbers. Update `accept` to `image/*` and add a hint that some formats (HEIC) may not work.
7. **Tests**:
   - `photo-crop.test.ts` for the maths and loop (landscape, portrait, square, 40x30 -> 64, 4032x3024 -> 512, exactly 64 and 512, odd dimensions, giving up, alpha -> PNG when it fits and -> JPEG when it doesn't).
   - Update `profile-photo.test.ts`: the old tests for `image_bad_size`, `image_too_large` at the 256 KB threshold and the trailing-data-accepted case change meaning.
   - Add an own-photo-store test with a fake `prepare`.
   - Keep the existing no-literals-in-JSX test passing.
   - `pnpm check:layers`: the new files stay in `src/ui/**` and import only `@/lib`.

## Risks
- Metadata and trailing data are dropped only because the canvas re-encode generates fresh bytes. Do not return the original file bytes on any fallback path. Always return the re-encoded output.
- EXIF orientation: `createImageBitmap` `imageOrientation:"from-image"` is the default in current browsers. The `<img>` fallback also respects EXIF in modern browsers, but verify in Safari manually. Applying the rotation twice (manual swap plus browser) is a classic bug, so rely on one mechanism only.
- Canvas memory on mobile Safari: a canvas over about 16 MP can silently fail. Drawing the source to a 512 canvas via halving steps (never allocating a full-size canvas) avoids this. `drawImage(bitmap, sx, sy, side, side, 0, 0, target, target)` directly from the bitmap is fine for the first step, since the bitmap itself holds the pixels.
- Colour profile: wide-gamut (Display P3) phone photos shift slightly on re-encode. The ticket accepts this.
- Race: `run()` in `ProfilePhoto.tsx` already guards `busy` and `mounted`. A slow conversion plus the user navigating away just drops the result; fine.
- A stale PUT is guarded by the existing `seq` logic. No change needed.
- `toBlob` yields null in some failure cases (memory). Handle null as `image_too_big_to_process` or `read_failed`, never throw.
- HEIC outside Safari will fail to decode. Surface `read_failed` with a hint to try JPEG/PNG.
- Animated GIF or WebP: the first frame is taken, which is acceptable. Mention it in the hint or accept it silently.
- A transparent PNG at 512x512 often exceeds 256 KB, so the JPEG fallback (white background) will be used for it. The AC says "stays PNG when it fits", so this is consistent. Do not downscale further to force PNG.

## Open questions
- Input cap value: 20 MB and a pixel cap of 100 MP are suggestions. Please confirm.
- Should "Processing..." be a distinct label from "Uploading..." (needs the store split from rec. 5b), or is a single label acceptable?
- Is JPEG quality floor 0.3 acceptable, or is a visible-quality floor wanted (e.g. 0.5, then fall back to a smaller dimension)?
- Is the white fill for transparent pixels in the JPEG fallback acceptable, or should the background match the avatar background?

Files relevant: `src/ui/portal/profile-photo.ts`, `src/ui/portal/own-photo-store.ts`, `src/ui/portal/ProfilePhoto.tsx`, `src/ui/portal/ProfilePhotoSection.tsx`, `src/ui/copy/portal.ts`, `src/lib/validate/photo.ts`, `src/ui/portal/profile-photo.test.ts`, `src/ui/portal/own-photo-store.test.ts`.
