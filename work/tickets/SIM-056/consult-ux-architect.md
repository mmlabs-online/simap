# Consult — ux-architect — SIM-056

## Findings
- Current flow (ProfilePhotoSection.tsx): one label-button wrapping a hidden file input (`accept="image/png,image/jpeg"`), pick = immediate upload (`onPick(file)`), button label switches to `copy.uploading` while `busy==="upload"`, input disabled while busy, error in `role="alert"`, success in `role="status"` and the 80px Avatar preview updates after save. A static `copy.hint` paragraph shows below. There is no confirm step today.
- Blocking issues for the ticket's goal: (1) `accept` limits the picker to PNG/JPEG, so WebP (named in the manual test plan) and HEIC on Safari are filtered out or greyed on many pickers. (2) portal.ts lines 65-68 hold the old gate copy (image_too_large with 256 KB, image_bad_size "must be square 64-512 px", the re-save advice). The `hint` copy is likely the same style. These would contradict the new behaviour. They are built from PHOTO_LIMITS, so the new copy should drop that import where it becomes unused.
- The server error codes can still surface (image_changed, and in theory image_too_large/bad_size if the conversion is buggy). Keep a generic fallback for those, since the user can no longer act on size/shape advice.
- The "Processing..." state and the "Uploading..." state are two consecutive phases; `busy` has only "upload" | "remove" | null.

## Recommendations
1. No confirm/preview step. Reasons: the crop is automatic and centered with no user choice (nothing to confirm), the ticket says "converts then saves", Ming asked for automatic upload, and the user can see the result in the existing 80px Avatar and the header avatar immediately, and can Replace or Remove. A pre-save preview would add a step with no decision attached. Put the "if the crop cuts off your face, use a more square photo" tip into the hint instead (AC: automatic centered crop, out-of-scope manual tool).
2. Processing feedback: extend `busy` to `"processing" | "upload" | "remove" | null`, or reuse "upload" with a label change. Label copy: `processing: "Processing..."` then `uploading: "Uploading..."` (or a single "Saving..." if the conversion is fast, but keep Processing since large phone JPEGs take a second or more). Keep the input disabled during both phases. Add `aria-live` via the existing `role="status"` region (set the notice text to "Processing your photo..." so screen readers hear it, because a label change inside a label element is not announced). Avoid a spinner dependency; text is enough.
3. Picker: change `accept` to `image/*` (and let decoding failures produce the "could not read" message). Keeps HEIC usable on Safari, WebP etc.
4. Hint copy (replaces the limits text): "Choose any photo. We crop it to a centered square and resize it for you." Optionally add "Photos up to 20 MB." only if the cap is a fixed number; prefer stating the cap only in the error.
5. Error copy (user-actionable, no technical limits):
   - unreadable/undecodable: "We could not read this image. Try a JPEG or PNG photo."
   - input too big (bytes or pixel count): "This image is too big to process. Try a smaller photo (under 20 MB)." Use a constant for the 20 MB cap shared with the helper so the text cannot drift.
   - quality loop gives up (still above 256 KB): "We could not make this photo small enough. Try a different photo." (rare; distinct code so tests can assert it)
   - animated images: the canvas takes the first frame, so no error needed; note it only if the old "not animated" copy is dropped.
   - keep `image_changed` as is; map any other server code to a generic "Could not save your photo. Try again."
   - the pre-check errors must send no request (AC 5); errors shown in the existing alert region and cleared at the start of the next pick.
6. Remove the old per-limit keys (or leave unused keys out) so no copy still mentions "square", "64-512 px" or "256 KB" to the user. Add a unit test for the code-to-copy mapping and a no-literals-in-JSX check, as in the test plan.
7. Transparency: PNG when alpha is present and fits, else JPEG. Fill with a white background before JPEG encoding, otherwise transparent areas turn black. Add this to the plan; it is not in the ticket.
8. Races: ignore a result if the component unmounts, and keep the disabled input as the only guard against double picks. Clear the file input value as today (allows re-picking the same file).

## Risks
- Black background when flattening transparent PNG to JPEG (see 7).
- Safari-only HEIC and other undecodable formats produce the "could not read" error; the hint/error should name JPEG or PNG as safe choices.
- Main-thread stall for large images: show Processing text before starting the work (yield one frame, e.g. await a `requestAnimationFrame` or `setTimeout(0)`) or the label never paints.
- `imageOrientation: "from-image"` is the default in modern browsers, but the `<img>` fallback decode handles EXIF in current engines too. Verify on a rotated sample (AC 2).
- Auto crop of tall or wide images can cut off faces; accepted by the ticket, mitigated only by the hint.
- Copy built from PHOTO_LIMITS imports may leave unused imports after the change (typecheck/format checks).

## Open questions
- Is a single "Saving..." label acceptable instead of Processing then Uploading? (Ticket says "Processing..."; recommend two labels.)
- Should the 20 MB input cap and the pixel cap (suggest about 50 megapixels, i.e. covers 8000x6000) be stated to the user? Recommend naming only the byte cap in copy.
- Ming's call: confirm no preview step (recommended) versus an optional preview, which would be a separate ticket together with a manual crop.

Files consulted: `work/tickets/SIM-056/ticket.md`, `src/ui/portal/ProfilePhotoSection.tsx`, `src/ui/copy/portal.ts` (lines 53-69 only).
