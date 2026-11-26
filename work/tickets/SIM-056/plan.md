Status: READY

# Plan — SIM-056: Crop and resize the profile photo in the browser before upload

## Scope summary
- Ming, 2026-11-26 (ticket Goal): "Phần upload avatar, không ràng buộc size và square. Sau khi upload tự động crop và
  resize rồi lưu".
- `docs/spec-v1.md` OQ-56 (line 838): "PNG or JPEG (no APNG or other animation), square, 64 × 64 to 512 × 512 px, at
  most 256 KB, stored and served like device type images (SIM-036.5); no server-side resizing (no image library, stack
  unchanged)." This ticket keeps those **stored** limits and the server as they are. Only the browser converts the
  picked file into bytes that already meet OQ-56.
- `docs/spec-v1.md` POR-05 (lines 589-596): the member uploads, replaces or removes their photo. That flow does not
  change.
- Ticket Scope, steps 1-5: decode with EXIF orientation, take the largest centered square, resize to 512 (keep sizes
  64-512, scale anything under 64 up to 64), encode as JPEG with a quality step-down to fit 256 KB (or PNG when the
  image has transparency and fits), check with `validatePhoto`, upload with the existing `PUT /api/me/photo`. The
  re-encode drops metadata and trailing data. Add a "Processing…" state and an input cap. Update the copy in
  `src/ui/copy/portal.ts`.
- Out of scope (ticket): a manual crop tool, any server/API/schema/limit change, new libraries.
- D36: UI copy lives in `src/ui/copy/`.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A non-square photo of any common size saves a centered square ≤ 512 × 512 and ≤ 256 KB, and the server accepts it | Unit: `photo-crop.test.ts` › centerSquare / targetSide / halvingSteps cases for 4032×3024 → rect `{sx:504, sy:0, side:3024}`, target 512, steps `[1512, 756, 512]`. Unit: `fitToLimit` stops at the first quality ≤ 256 KB. Unit: `profile-photo.test.ts` › `preparePhoto` with a fake converter returns the encoded bytes after `validatePhoto`. Local run: `pnpm dev`, Profile tab, upload a large landscape JPEG. DevTools shows one `PUT /api/me/photo` under 256 KB with a 2xx response, and the header avatar updates. |
| 2 | A rotated phone photo (EXIF orientation) is saved upright | Local run: upload a portrait phone JPEG with an EXIF orientation of 6. The saved avatar is upright. The code review confirms there is only one rotation mechanism (`createImageBitmap(…, { imageOrientation: "from-image" })`, or the `<img>` fallback). There is no manual swap. |
| 3 | A 40 × 30 image saves as 64 × 64. A transparent PNG stays PNG when it fits | Unit: `photo-crop.test.ts` › 40×30 → side 30 → target 64, steps `[64]`. `fitToLimit` with `hasAlpha` returns PNG when it fits, otherwise JPEG. With no alpha it never tries PNG. Local run: upload a tiny PNG and a small transparent PNG. In DevTools the PUT body is `image/png` for the transparent one. |
| 4 | The saved bytes carry no EXIF/GPS. Phone JPEGs with trailing data are accepted | Unit: `profile-photo.test.ts` › `preparePhoto` never returns the input file's bytes (the fake converter output is returned and the input `arrayBuffer` is never called). Code review: `photo-canvas.ts` only emits canvas-encoded bytes. Local run: upload a phone JPEG that has trailing data (or any phone JPEG with GPS). It is accepted. |
| 5 | An undecodable file, or one above the input cap, shows a clear message and sends no request | Unit: `profile-photo.test.ts` › size over 20 MB → `image_too_big_to_process` with `decode` not called. Decode returns null → `read_failed`. Pixel count over the cap → `image_too_big_to_process` and `close` is called. Unit: `own-photo-store.test.ts` › a refusing `prepare` means `api.put` is not called. Unit: `photoErrorMessage` maps the new codes. Local run: pick a `.txt` file renamed `.jpg`. The alert shows the "could not read" text and DevTools shows no PUT. |
| 6 | All Checks pass | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` |

## Ming verification after merge
- Upload from a real phone (iPhone Safari with a HEIC or JPEG photo, and an Android Chrome camera JPEG). Check that the
  photo is upright, is center-cropped and saves without error. HEIC outside Safari is expected to show "could not
  read".

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/photo-crop.ts` (new) | Pure maths and decision logic: `PHOTO_INPUT_LIMITS`, `centerSquare`, `targetSide`, `halvingSteps`, `JPEG_QUALITIES`, `fitToLimit` | AC1, AC3. Pure logic first. It sits in `lib` (not `src/ui/portal/` as the ticket suggests) so that `src/ui/copy/portal.ts` can import the 20 MB cap. Copy files only import `@/lib/**` today. | No |
| `src/lib/photo-crop.test.ts` (new) | Unit tests for the above | R5 | No |
| `src/ui/portal/photo-canvas.ts` (new) | Thin browser adapter (`canvasConverter`): decode via `createImageBitmap`, with an `<img>` fallback. It also handles step-down drawing, alpha detection, a white fill before JPEG, and `convertToBlob`/`toBlob`. Checked by hand and not unit-tested, because node has no canvas. | Ticket Technical notes | No |
| `src/ui/portal/profile-photo.ts` | Replace `checkPhotoFile` with `preparePhoto(file, converter = canvasConverter)`. Keep `PhotoCheck` and widen its code union. `photoErrorMessage` is unchanged. | Ticket Scope 1-5, AC1-5 | No |
| `src/ui/portal/profile-photo.test.ts` | Rewrite the `checkPhotoFile` block as a `preparePhoto` block with a fake converter. Update the `photoErrorMessage` test for the new copy and codes. | Old tests assert the removed gate | No |
| `src/ui/portal/own-photo-store.ts` | Add an injectable `prepare` (default `preparePhoto`). `upload(file: Blob, onUploading?: () => void)` calls `onUploading` after prepare succeeds and before `api.put`. | Testability in node. Two busy labels. | No |
| `src/ui/portal/own-photo-store.test.ts` | Pass a fake `prepare`. Add tests for the `onUploading` order and for a refused prepare sending no PUT. | Store signature change | No |
| `src/ui/portal/useOwnPhoto.tsx` | `OwnPhoto.upload(file: File, onUploading?: () => void)` passes the callback through (line 15 and line 55) | Store signature change | No |
| `src/ui/portal/ProfilePhoto.tsx` | `busy` gains `"processing"`. Start the upload with `"processing"` and switch to `"upload"` in the `onUploading` callback (guarded by `mounted`). Show the processing notice. | Ticket: "Processing…" state | No |
| `src/ui/portal/ProfilePhotoSection.tsx` | Add `busy: "processing" \| "upload" \| "remove" \| null`. Add the label `copy.processing`. Change `accept="image/*"`. | Processing state. WebP/HEIC must be pickable. | No |
| `src/ui/portal/ProfilePhotoSection.test.tsx` | Update the accept assertion (line 51-55) to `image/*`. Add a check that the processing label shows and the input is disabled. | Markup change | No |
| `src/ui/copy/portal.ts` | Lines 53-71: new `hint`, `processing`, `processingNotice`. Errors: `image_too_big_to_process`, `image_could_not_shrink`, reworded `read_failed`, and limit-free rewordings of `image_too_large` / `image_bad_size` / `image_not_supported`. Swap the import from `PHOTO_LIMITS` to `PHOTO_INPUT_LIMITS`. | D36. Ticket: no more "square / 64–512 px / 256 KB" text for the user | No |

No other file is touched. `src/lib/validate/photo.ts`, `src/test/photo-fixtures.ts`, the API route and the server stay
unchanged.

## Data model / migration
None.

## API contract
None. The existing `PUT /api/me/photo` is used unchanged, and the server still enforces OQ-56.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/photo-crop.test.ts` › centerSquare: landscape 4032×3024 → `{sx:504, sy:0, side:3024}`; portrait 3024×4032 → `{sx:0, sy:504, side:3024}`; square 600×600 → `{0,0,600}`; odd 101×50 → `{sx:25, sy:0, side:50}` (floor) | AC1 |
| `src/lib/photo-crop.test.ts` › targetSide: 3024→512, 512→512, 300→300, 64→64, 30→64, 1→64 | AC1, AC3 |
| `src/lib/photo-crop.test.ts` › halvingSteps: (3024,512) → `[1512, 756, 512]`; (1024,512) → `[512]`; (1100,512) → `[550, 512]`; (300,300) → `[300]`; (30,64) → `[64]`; last step always equals the target, every step ≥ target, and no step is smaller than half the previous one | AC1, quality |
| `src/lib/photo-crop.test.ts` › fitToLimit, no alpha: never calls `encode("png")`; returns the first JPEG quality whose bytes ≤ maxBytes and stops calling encode | AC1 |
| `src/lib/photo-crop.test.ts` › fitToLimit, alpha + PNG fits → `{type:"png"}` with one encode call; alpha + PNG too big → JPEG ladder | AC3 |
| `src/lib/photo-crop.test.ts` › fitToLimit: every quality too big → `{ok:false, code:"image_could_not_shrink"}` after exactly `JPEG_QUALITIES.length` JPEG calls; encode returns null → `{ok:false, code:"read_failed"}` | Give-up code |
| `src/lib/photo-crop.test.ts` › `JPEG_QUALITIES` is strictly descending, ends at 0.4; `PHOTO_INPUT_LIMITS` = 20 MB / 50 MP | Constants |
| `src/ui/portal/profile-photo.test.ts` › preparePhoto: `size` over 20 MB → `image_too_big_to_process`; `decode` not called | AC5 |
| `src/ui/portal/profile-photo.test.ts` › preparePhoto: decode returns null → `read_failed`; decoded 0×0 → `read_failed` and `close` called | AC5 |
| `src/ui/portal/profile-photo.test.ts` › preparePhoto: decoded 10000×6000 (60 MP) → `image_too_big_to_process`; `close` called; `render` not called | AC5 (memory guard) |
| `src/ui/portal/profile-photo.test.ts` › preparePhoto: 4032×3024 fake source → `render` called with rect `{504,0,3024}` and steps `[1512,756,512]`; fake encoder returns `jpegOf(512,512)` → ok, type jpeg, bytes pass `validatePhoto`; `close` always called (also when render throws) | AC1, cleanup |
| `src/ui/portal/profile-photo.test.ts` › preparePhoto: 40×30 source with alpha, fake encoder returns `pngOf(64,64)` → ok, type png | AC3 |
| `src/ui/portal/profile-photo.test.ts` › preparePhoto: encoder output that fails `validatePhoto` (e.g. `pngOf(100,80)`) → that `validatePhoto` code, never the input bytes; the input file's `arrayBuffer` is never called | AC4, safety net |
| `src/ui/portal/profile-photo.test.ts` › photoErrorMessage: `image_too_big_to_process`, `image_could_not_shrink`, `read_failed`, `image_changed`, `image_too_large`, `image_bad_size`, `image_not_supported` use the photo copy; none of the photo error strings or the hint contain "square", "px" or "256 KB"; `image_too_big_to_process` contains "20 MB"; unknown codes fall back to `apiCopy` | AC5, copy |
| `src/ui/portal/own-photo-store.test.ts` › upload success with fake `prepare`: order is prepare → onUploading → put; put receives the prepared bytes and type | Processing phase |
| `src/ui/portal/own-photo-store.test.ts` › prepare refuses (`read_failed`): put not called, onUploading not called, code returned, URL unchanged (replaces the existing pre-check test at line 65) | AC5 |
| `src/ui/portal/own-photo-store.test.ts` › existing tests keep passing with a fake `prepare` (server 422, stale get, dispose) | Regression |
| `src/ui/portal/ProfilePhotoSection.test.tsx` › `busy: "processing"` shows `copy.processing` and disables the input and the remove button; file input `accept="image/*"` inside its label; hint shown | Processing state, picker |
| `src/ui/copy/no-literals.test.ts` (existing, unchanged) | No literals in JSX |

## Approach
1. **`src/lib/photo-crop.ts`** (pure, no DOM, no `server-only`; layer lib → lib only):
   - `export const PHOTO_INPUT_LIMITS = { maxBytes: 20 * 1024 * 1024, maxPixels: 50_000_000 } as const;`
   - `centerSquare(w, h)`: `side = min(w, h)`, `sx = floor((w - side) / 2)`, `sy = floor((h - side) / 2)`.
   - `targetSide(side)`: `min(PHOTO_LIMITS.maxPx, max(PHOTO_LIMITS.minPx, side))`. Import `PHOTO_LIMITS` from
     `@/lib/validate/photo` so the numbers cannot drift.
   - `halvingSteps(side, target)`: `steps = []; s = side; while (s / 2 >= target) { s = floor(s / 2); steps.push(s) }`.
     Then, if the last step is not `target`, push `target`. Results: 3024→512 gives `[1512, 756, 512]`. 1024→512 gives
     `[512]`. 1100→512 gives `[550, 512]`. An upscale gives `[target]`.
   - `JPEG_QUALITIES = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4] as const`.
   - `fitToLimit(encode: (type: PhotoType, quality?: number) => Promise<Uint8Array<ArrayBuffer> | null>, { hasAlpha,
     maxBytes = PHOTO_LIMITS.maxBytes })` returns
     `{ ok: true; bytes; type } | { ok: false; code: "image_could_not_shrink" | "read_failed" }`. If `hasAlpha`, try
     PNG once and return it if it is ≤ maxBytes. Then walk the JPEG ladder and return the first result ≤ maxBytes. A
     null from `encode` gives `read_failed`. An exhausted ladder gives `image_could_not_shrink`.
2. **`src/ui/portal/photo-canvas.ts`** exports `type PhotoConverter` and `canvasConverter`. No `"use client"` is
   needed: it is a plain module and is only called from client code.
   - `PhotoConverter = { decode(file: Blob): Promise<PhotoSource | null> }`, where
     `PhotoSource = { width; height; close(); render(rect, steps): Promise<RenderedPhoto | null> }` and
     `RenderedPhoto = { hasAlpha: boolean; encode(type, quality?) }` (the signature `fitToLimit` expects). Put the
     types in this file. `profile-photo.ts` imports them as types.
   - `decode`: `await new Promise((r) => setTimeout(r, 0))` first, so the "Processing…" label paints before heavy work
     (UX risk). Then `createImageBitmap(file, { imageOrientation: "from-image" })`. If it throws, fall back to
     `new Image()` + `URL.createObjectURL` + `img.decode()`, revoking the URL in a `finally`. The `<img>` path relies
     on the default `image-orientation: from-image`, so never rotate by hand. If both fail, return null.
   - `render`: create a canvas via `OffscreenCanvas` when defined, else `document.createElement("canvas")`. The first
     step draws `drawImage(src, sx, sy, side, side, 0, 0, s0, s0)` straight from the bitmap. A full-size canvas is
     never allocated. Each next step draws the previous canvas into a new smaller one. Set
     `imageSmoothingEnabled = true` and `imageSmoothingQuality = "high"`. If `getContext("2d")` is null, return null.
     `hasAlpha` scans `getImageData` of the final canvas for any alpha below 255. The MIME type is not used.
   - `encode("png")` uses the final canvas. `encode("jpeg", q)` draws onto a copy canvas filled `#ffffff` first when
     `hasAlpha`, otherwise it uses the final canvas. Use `convertToBlob({ type, quality })` or the `toBlob` promise
     wrapper. A null blob returns null. Otherwise return `new Uint8Array(await blob.arrayBuffer())`. The original file
     bytes are never returned on any path.
3. **`src/ui/portal/profile-photo.ts`**: remove `checkPhotoFile`. Add
   `preparePhoto(file: Blob, converter: PhotoConverter = canvasConverter): Promise<PhotoCheck>`:
   - Widen the code union to `PhotoCode | "read_failed" | "image_too_big_to_process" | "image_could_not_shrink"`.
   - If `file.size > PHOTO_INPUT_LIMITS.maxBytes`, return `image_too_big_to_process` before decoding.
   - `decode`. A null result gives `read_failed`. In `try … finally source.close()`: zero dimensions give
     `read_failed`, and `width * height > maxPixels` gives `image_too_big_to_process`. Otherwise run `centerSquare`,
     `targetSide`, `halvingSteps` and `render`. A null render gives `read_failed`. Then call `fitToLimit` and pass on
     its refusal.
   - On success, `validatePhoto(bytes)`. A failure returns its code. Then require `check.type === result.type`,
     otherwise return `image_not_supported`. Return `{ ok: true, bytes: new Uint8Array(stripPhotoMetadata(bytes,
     type)), type }`. Stripping is a no-op on canvas output, but it keeps the server's behaviour.
   - Wrap any thrown error from the converter as `read_failed`. The function never throws.
4. **`own-photo-store.ts`**: add `prepare?: (file: Blob) => Promise<PhotoCheck>` to the options (default
   `preparePhoto`). The signature becomes `upload(file: Blob, onUploading?: () => void)`:
   prepare → refuse early (no PUT) → `onUploading?.()` → `api.put` → the existing swap logic (lines 45-58).
   `useOwnPhoto.tsx` passes the callback through and does not pass `prepare`, so the real one is used.
5. **`ProfilePhoto.tsx`**: `busy` becomes `"processing" | "upload" | "remove" | null`. `run` takes the initial kind
   and an optional `onStart` notice. For a pick: `setBusy("processing")` and `setNotice(copy.processingNotice)`
   (announced through the existing `role="status"`). Then
   `photo.upload(file, () => { if (mounted.current) { setBusy("upload"); setNotice(null); } })`. The rest is
   unchanged: the guard on `busy`, the `mounted` check and the error mapping.
6. **`ProfilePhotoSection.tsx`**: the label is `processing → copy.processing`, `upload → copy.uploading`, otherwise
   replace/upload. Change `accept="image/*"`. The input stays disabled whenever `busy !== null`.
7. **Copy** (`src/ui/copy/portal.ts` lines 53-71, D36). Import `PHOTO_INPUT_LIMITS` from `@/lib/photo-crop`. Drop
   `PHOTO_LIMITS`. Define `const inputMb = PHOTO_INPUT_LIMITS.maxBytes / 1024 / 1024`.
   - `hint`: "Choose any photo up to ${inputMb} MB. It is cropped to a centered square and resized for you. For the
     best result, keep your face near the middle."
   - `processing`: "Processing..."
   - `processingNotice`: "Processing your photo..."
   - `uploading` stays "Uploading...".
   - errors:
     - `image_too_big_to_process`: "This image is too big to process. Try a photo under ${inputMb} MB."
     - `image_could_not_shrink`: "Could not make this photo small enough. Try a different photo."
     - `read_failed`: "Could not read this image. Try a JPEG or PNG photo."
     - `image_too_large`, `image_bad_size` and `image_not_supported` (server-side only now): "Could not save this
       photo. Try a different photo."
     - `image_changed` is unchanged.
   - No Vietnamese diacritics (the no-literals test).
8. Rules: R1 holds, because the new lib module is pure and the ui files import `@/lib/**` and relative ui only.
   `pnpm check:layers` confirms it. R3, R2, R6 and R7 do not apply (no server, no env). R4 holds: only the files
   listed. R5 holds: the pure logic is fully unit-tested, and the canvas adapter is the only part checked by hand.
   Run `pnpm format` before the checks.

Size estimate: about 300 lines of product code and about 250 lines of tests. That is one cycle, so no split.

## Specialist input used
- frontend-developer, rec. 1 (pure module, injected `encode`, quality ladder): **adopted**. The module moves to
  `src/lib/` for the copy import, and the floor is 0.4 instead of 0.3 (see Assumptions).
- frontend-developer, rec. 2 (thin canvas adapter, real alpha scan, white fill, `OffscreenCanvas` fallback, close the
  bitmap, null blobs): **adopted**.
- frontend-developer, rec. 3 (byte cap before decode, pixel cap right after decode, decode failure → `read_failed`):
  **adopted**, with a 50 MP pixel cap (the UX value) instead of 100 MP.
- frontend-developer, rec. 4 (`preparePhoto` returning `PhotoCheck`, injected into the store): **adopted**.
- frontend-developer, rec. 5 (one label vs a store split): **variant adopted**. The store is not split. An
  `onUploading` callback gives two labels with minimal change.
- frontend-developer, rec. 6 and 7 (copy, `accept="image/*"`, tests): **adopted**.
- frontend-developer, Risks (never return the original bytes, single orientation mechanism, no full-size canvas, null
  `toBlob`, first frame of animations): **adopted** in Approach step 2.
- ux-architect, rec. 1 (no preview or confirm step; the crop tip goes in the hint): **adopted**.
- ux-architect, rec. 2 (Processing then Uploading, announced via `role="status"`, yield one frame): **adopted**.
- ux-architect, rec. 3 (`image/*`), rec. 5 and rec. 6 (actionable copy, a distinct give-up code, no limit numbers):
  **adopted**. Only the 20 MB input cap is named to the user (in the hint and in the too-big error).
- ux-architect, rec. 7 (white fill): **adopted**. Rec. 8 (races, clearing the input value): already met by the existing
  code and kept.
- ux-architect, "generic fallback for other server codes": **adopted** for the three image codes. Codes unrelated to
  photos keep the `apiErrorMessage` fallback, as today.

## Assumptions
Ming confirms these in the approval round:
- A1 Input caps: 20 MB file size (checked before decode) and 50 megapixels after decode (covers 8000 × 6000 and
  50 MP phone sensors at 8160 × 6120). Only the 20 MB figure appears in the copy.
- A2 Two busy labels: "Processing..." while converting, then "Uploading..." during the PUT. These come from an
  `onUploading` callback, not a store split.
- A3 JPEG quality ladder 0.92 → 0.4. If it still exceeds 256 KB, the photo is refused with `image_could_not_shrink`
  and there is no extra downscale. In practice a 512 × 512 JPEG at 0.4 is far below 256 KB.
- A4 Transparent areas become **white** when a transparent image falls back to JPEG (the PNG was too big).
- A5 No preview or confirm step. The pick converts and saves straight away, as today. Replace or Remove remain
  available.
- A6 The pure crop maths lives in `src/lib/photo-crop.ts`, not `src/ui/portal/photo-crop.ts` as the ticket suggests.
  `src/ui/copy/*` only imports `@/lib/**`, and the copy needs the cap constant.
- A7 Animated GIF/WebP: the first frame is used, silently. HEIC works only where the browser decodes it (Safari).
  Elsewhere the user sees "Could not read this image. Try a JPEG or PNG photo."
- A8 The server keeps its codes and limits (OQ-56). `image_too_large` / `image_bad_size` / `image_not_supported` can
  now only come from the server and show one generic "Could not save this photo" message.
- A9 The canvas adapter (`photo-canvas.ts`) is verified by the manual run in the ticket's Test plan and has no unit
  tests (Vitest runs in node without canvas, per the ticket's Technical notes).
- Hotspots: the sibling SIM-055 (planned in parallel) touches `src/ui/auth/**`, `src/ui/copy/auth.ts` and
  `src/app/globals.css`. That does **not overlap** any file in this plan. `src/ui/copy/no-literals.test.ts` is shared
  by both but is not edited. No other ticket is `IN_PROGRESS` / `REVIEW` / `DONE` on the board.

## Blocking questions
None.

## Split proposal
None.
