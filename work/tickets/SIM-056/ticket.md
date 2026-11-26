# SIM-056: Crop and resize the profile photo in the browser before upload

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-046.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T12:10Z |
| PR | — |

## Goal
A member can pick any photo (any size, any shape, straight from a phone) as their profile photo: the browser crops it
to a square and resizes it automatically, then saves it, so the upload no longer fails with "not square", "too large"
or "re-save the image" (Ming, 2026-11-26: "Phần upload avatar, không ràng buộc size và square. Sau khi upload tự động
crop và resize rồi lưu").

## Scope reference
- POR-05 Profile photo, OQ-56 (stored photo: PNG or JPEG, square, 64–512 px, ≤ 256 KB; **no server-side resizing**,
  stack unchanged). This ticket keeps the stored limits and the server unchanged; only the browser converts the input.
- SIM-046 plan A10 ("a canvas-based center-crop to 512 px in the browser … is a follow-up UX ticket") and the SIM-046
  security review finding 4 (phone JPEGs with trailing data are refused today).
- D36 (UI copy in `src/ui/copy/`).

## Scope
- In the Profile tab photo section (SIM-046.1), the picked file is no longer checked against the square / pixel / byte
  limits. Instead the browser:
  1. decodes it (any image the browser can decode: JPEG, PNG, WebP, …), applying the EXIF orientation;
  2. takes the largest **centered square**;
  3. resizes it to 512 × 512 (or keeps the square's size if it is between 64 and 512; a square smaller than 64 is
     scaled up to 64);
  4. encodes it as JPEG (stepping the quality down until it fits 256 KB), or PNG when the image has transparency and
     still fits;
  5. checks the result with the existing `validatePhoto` and uploads it with the existing `PUT /api/me/photo`.
- The re-encode drops all metadata (EXIF/GPS) and any trailing data, so phone photos are accepted.
- A short "Processing…" state while converting; the preview and the shell avatar update as today after the save.
- A guard against huge inputs (e.g. refuse files over a generous cap such as 20 MB or images over a pixel-count cap
  with a clear message), so the tab does not run out of memory.
- Updated limits hint and error copy in `src/ui/copy/portal.ts` (no more "must be square / 64–512 px / 256 KB" for the
  user; only "could not read this image" / "image too big to process").

## Out of scope
- A manual crop tool (drag/zoom to choose the square); the crop is automatic and centered.
- Any server, API, schema or limit change (OQ-56 stays: the server still refuses non-square or oversize bytes).
- Manager-side upload for other members (does not exist), member lists and seat panel (unchanged).
- New libraries (canvas / `createImageBitmap` only, stack unchanged).

## Acceptance criteria
- [ ] Picking a non-square photo of any common size (e.g. a 4032 × 3024 phone JPEG of several MB) saves a centered
      square photo of at most 512 × 512 px and at most 256 KB; the server accepts it with no error.
- [ ] A rotated phone photo (EXIF orientation) is saved upright.
- [ ] A small image (e.g. 40 × 30) is saved as a 64 × 64 square; a PNG with transparency stays PNG when it fits.
- [ ] The saved bytes carry no EXIF/GPS metadata; phone JPEGs with trailing data are accepted.
- [ ] A file the browser cannot decode, or one above the input cap, shows a clear message and sends no request.
- [ ] All Checks pass.

## Technical notes
- Files (likely): `src/ui/portal/profile-photo.ts` (replace `checkPhotoFile`'s size/shape gate with the conversion),
  a new pure helper for the crop/resize maths (`src/ui/portal/photo-crop.ts`: source size → square rect → target
  size), `src/ui/portal/ProfilePhoto.tsx` / `ProfilePhotoSection.tsx` (processing state), `src/ui/copy/portal.ts`, tests.
- Use `createImageBitmap(file, { imageOrientation: "from-image" })` (falls back to an `<img>` decode), an
  `OffscreenCanvas` or `<canvas>` with `imageSmoothingQuality = "high"`, and `toBlob`/`convertToBlob` with a quality
  loop. Stepping down in halves for big inputs gives better quality than one big resize.
- Vitest runs in node without canvas: keep the maths, the quality loop's decision logic and the error mapping pure and
  unit-tested; the canvas calls stay a thin adapter checked by hand.
- Risks: HEIC from iPhones decodes only in Safari (other browsers will show "could not read"); memory on very large
  images (hence the cap); colour shifts from JPEG re-encode are acceptable.

## Test plan
- Unit: centered-square rect for landscape, portrait and square inputs; target size for big, mid and tiny squares;
  quality loop stops at ≤ 256 KB and gives up with a clear code; transparency → PNG choice; error copy mapping; no
  literals in JSX.
- Manual: `pnpm dev`, Profile tab — upload a large landscape phone JPEG, a portrait one with EXIF rotation, a tiny
  PNG, a transparent PNG, a WebP, and a non-image file; check the header avatar and that DevTools shows one PUT under
  256 KB.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-4): "duyệt hết theo mặc định"; Q3 defaults: 20 MB / 50 MP input caps, JPEG quality floor 0.4, white fill for transparency, no preview step.

## Handoff
