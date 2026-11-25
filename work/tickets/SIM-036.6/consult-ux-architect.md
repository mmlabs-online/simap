Consult (UX/architecture) for SIM-036.6, device type images. Read-only. I read the slice-1 code under src/ui/deviceTypes, EntityFormDialog, the image route and src/lib/icons.ts. I did not repeat the SIM-036.3 consult.

## Findings
- The slice-1 dialog (`DeviceTypeFormDialog.tsx`) is keyed on `item?.id ?? "new"`. Its submit does one call (`api.update` or `api.create`), then `settleSave`, then `onDone`, which closes the dialog and reloads the list. That `key` is the main constraint on the partial-save flow. After a create succeeds, the dialog cannot become "edit mode for the saved type" without remounting, and a remount loses the picked file and the form state.
- `DeviceTypesApi` (`device-types-api.ts`) has list, create, update and remove. It has no `putImage`, `removeImage` or `imageBlob`. Its `call()` helper only reads JSON bodies. The image GET needs a `res.blob()` reader, and PUT needs a raw body with `content-type: image/png`.
- `settleSave` treats `not_found` as "done". That is wrong for an image step: a PUT or DELETE that returns `not_found` means the type was deleted meanwhile. Do not reuse it as is for the image step.
- The server PUT (`image/route.ts`) re-validates size and PNG structure and returns 422 `image_too_large` or `image_not_png`/`image_bad_size`. A lost compare-and-set returns 409 `image_changed`. DELETE returns 204. GET sends an `ETag` of `"<id>-<imageVersion>"` and `Content-Security-Policy: sandbox`. All the needed codes (`image_*`, `images_unavailable`, `drive_error`) are already in `src/ui/copy/api.ts` lines 54-59, so no new error copy is needed.
- `ICON_NAMES` has no image-related icon (no `image`, `upload`, `delete`, `hide_image`). It is a closed list and the font URL is built from it. The list placeholder and the file-picker button can use `category` (already used for the Name field). Any new icon means an edit to `src/lib/icons.ts` plus a font subset, which is optional scope.
- `EntityFormDialog` renders one `role="alert"` line, `error`, at the bottom of the form. It has `max-w-[440px]`. The slot fieldset already uses most of the width, so the image section adds height. Check that the dialog still fits on a short viewport; the `<dialog>` has no scroll.
- `useList` is reused from groups. `DeviceTypesView` uses `ListSection.renderRow`, so a thumbnail slots in at the left of the row.
- The image GET has `Cache-Control` via `IMAGE_HEADERS`. Check its value, because it affects whether a `{id, imageVersion}` cache in memory is enough.

## Recommendations

### 1. Placement and states
- Add an "Image" section to the form fields, below Name and above (or inside) the slot fieldset.
- Layout: a 48 px `<img>` or placeholder box on the left, and a button column on the right.
  - Buttons: "Choose image" and "Remove image".
  - Hint text under them: "PNG, 24 x 24 px, up to 20 KB". Use the limits from `IMAGE_LIMITS`, not literals.
- Use the native file input visually hidden (`sr-only`), driven by a `<label>` styled as a button, or a `Button` that calls `inputRef.click()`. Do not use `display:none`, which drops keyboard access.
  - Prefer the label wrapping the input, so Enter and Space work and a screen reader announces it as "Choose image, file upload".
  - Reset `input.value = ""` after each pick, so choosing the same file again after a rejection still fires `onChange`.
- A single state union in a pure helper makes this testable. `ImageDraft = { kind: "keep" } | { kind: "replace"; file bytes + objectUrl } | { kind: "remove" }`.
  - Add the `hasImage`-derived "current" state from the item.
  - Show Remove only if (existing `hasImage` and draft is not `remove`) or draft is `replace`.
  - For a `replace` draft on an existing image, the button reverts to "keep". For a `replace` draft on a type with no image, it clears the file. Name it "Remove image" in both cases, as the ticket says, but its effect differs. A "Undo" or "Restore current" is a cheap addition when the draft is `remove`.
- Preview rules:
  - `keep`: the cached blob URL of the current image, or the placeholder.
  - `replace`: `URL.createObjectURL(file)` of the validated file.
  - `remove`: the placeholder.
- Preview a pending removal clearly, for example with muted text "Image will be removed when you save", so a destructive step is not hidden until Save.

### 2. Image pixel rendering
- Use `image-rendering: pixelated` (a Tailwind arbitrary class `[image-rendering:pixelated]`), a fixed 48 x 48 box (`width`/`height` attributes) to avoid layout shift, `alt=""` for decorative thumbnails in the list because the name sits next to it, and `object-fit: contain`.
- List row: 48 px in the row at the left, `shrink-0`. Placeholder is a same-size box with a dashed outline and the `category` icon at low contrast. It must not use colour alone. The slot label is already shown as text.
- A broken or failed blob load (`onError`, or a failed fetch) falls back to the placeholder. A per-row failure must not break the list.

### 3. Blob cache and lifecycle
- Put the cache in one small hook or module, `useTypeImage(api, type)` or a `ThumbCache` owned by `DeviceTypesLoaded` via `useRef<Map<string, string>>`, keyed `${id}:${imageVersion}`.
  - Fetch only when `hasImage` is true.
  - On a new `imageVersion` for an id, revoke the old entry and drop it. Revoke everything on unmount.
  - Guard against a late response after unmount or a version change (an `AbortController` or a `cancelled` flag). Otherwise a slow older fetch writes a stale URL, or leaks a URL that is created after unmount.
  - Since `useEffect` runs twice in React Strict Mode in dev, make the creation and revocation symmetric inside the effect, or the cache can hold a revoked URL.
- Limit concurrency or load lazily. There can be up to 100 rows. A simple option is a queue of 4 in-flight fetches, or `IntersectionObserver`. A plain per-row effect works but may fire 100 requests at once on the first load.
- The dialog should reuse the list's cached URL for the current image, not fetch again. Pass the URL (or the cache) in as a prop.
- Do not revoke a URL the dialog preview still shows. The dialog's own `createObjectURL(file)` preview URL must be revoked on replace, on remove, on unmount and after a successful save.
- Because the list cache replaces a URL when `imageVersion` changes after a reload, an `<img>` still showing the old URL can briefly point at a revoked blob. Update the list state and the cache together, or only revoke after the new URL has loaded.
- The image GET result is in the memory cache only. I would not add an ETag conditional request on top (a per-page-load fetch is fine, since the cache is lost on reload anyway).

### 4. Client file check (pure, in `device-type-form.ts`)
- `checkImageFile(file: {size:number; type?:string; arrayBuffer()}): Promise<{ok:true; bytes} | {ok:false; code}>`:
  1. `file.size > IMAGE_LIMITS.maxBytes` returns `image_too_large`. Do not read the bytes first.
  2. Read the bytes and call `validatePng`; return its code (`image_not_png` or `image_bad_size`).
  3. Do not trust `file.type` or the extension. Do not require them. A `.png` file with wrong bytes must be rejected, and a PNG with an odd MIME must work.
- Map codes with `apiErrorMessage`, so client and server wording match.
- On failure, show the message inline and keep the previous draft and preview unchanged. Clear the message when a valid file is picked, when Remove is used, or on submit.
- Handle `arrayBuffer()` throwing (file revoked or unreadable) with the `drive_error`-like "could not read" message. Add a copy line if no existing message fits, in `deviceTypes.ts`.
- Add the `accept="image/png"` attribute only as a picker hint. It is not a validation.

### 5. Inline errors: where to show them
- The dialog has one error line at the bottom. Image errors need their own spot next to the control, linked with `aria-describedby`, so a screen-reader user hears them at the control.
  - Use a `<p id=… role="alert">` under the picker for client check failures.
  - For server refusals during save (`image_*`, `images_unavailable`, `drive_error`, `image_changed`), the bottom `error` line from `EntityFormDialog` is acceptable, since the user is at the submit button. Do not announce the same message in two live regions, because that gets read twice.
  - Set `aria-invalid` on the file input, or the group, while the error is shown.
- Map the server refusals to the user's next step:
  - 422 `image_*` returns to the form with the draft kept. The user picks another file or removes it.
  - `images_unavailable` and `drive_error` are transient, so Save stays enabled for a retry of the image step only (see 6).
  - `image_changed` should reload the item (and the list cache) before offering a retry. The draft preview should switch to the new current image, because the user's pick was compared against a stale version.

### 6. Partial-save flow
- Make the sequence a pure async function in `device-types-state.ts` (or a new `saveWithImage`), taking `api`, the item or null, the form, and the image draft. Return a union:
  - `{kind:"done"}`
  - `{kind:"invalid"; message}` (nothing was sent)
  - `{kind:"failed"; message}` (the first step failed, nothing saved)
  - `{kind:"imageFailed"; saved: DeviceTypeDto; message}` (the type saved, the image did not)
- Details:
  - Run POST or PATCH first, only if the fields changed. For a create it always runs. An edit with only an image change skips PATCH, and the old `unchanged` branch must not close the dialog if a draft is pending.
  - Then PUT or DELETE the image. It needs the type id, so a create must use the id from the POST response.
  - `unchanged` plus `keep` closes the dialog as before.
- On `imageFailed`, keep the dialog open, with these rules:
  - The dialog must now be in edit mode for `saved`. Because the dialog is keyed on `item?.id ?? "new"`, do not remount. Hold the saved type in dialog state (`const [current, setCurrent] = useState(item)`) and make every edit/create decision from `current`, not the `item` prop. The title and submit label switch to "Edit" and "Save" after the first step. The `key` stays as it is.
  - The form fields now match `saved`, so the next Save sends PATCH only for later changes and goes straight to the image step.
  - Reload the list in the background (a new `onSaved` callback separate from `onDone`), so the list shows the saved name and slot behind the dialog without closing it. The parent must not close the dialog on that callback.
  - Keep the image draft and preview so a retry does not require picking the file again.
  - Because the page's `item` prop is stale (`imageVersion` before the change), the retry uses the saved DTO.
- Edge cases:
  - A concurrent image change: after `image_changed`, update `current` from a fresh list or item GET. There is no single-item GET for device types, so use `api.list()` and pick the item by id. If the id is gone, treat it as deleted and close.
  - The image step returns `not_found`: the type was deleted meanwhile. Close and reload, with a short message or the plain close (the existing "gone counts as done" rule).
  - Double-click on Save during the sequence: `submitting` already disables the button across both steps, so keep `setSubmitting(false)` out of the middle.
  - Cancel after `imageFailed`: the type stays saved with its old image. This is acceptable, but the inline message should say so: "The type was saved, but the image was not." Put it in the copy, so the user knows Cancel is not a rollback.
  - Success after a retry: `onDone` closes the dialog and reloads the list. The new `imageVersion` swaps the cache entry.

### 7. Remove image
- Only DELETE once the user confirms with Save. No separate confirm dialog is needed, because the pending state is visible and reversible before Save.
- In the DELETE step, 204 is success. A 404 from `/image` for a type with no image: check what `removeDeviceTypeImage` returns when there is no image (idempotent?). If it returns an error, a stale `hasImage` would show a false failure; treat "nothing to remove" as success.

### 8. Accessibility
- The control group: `<fieldset>` with a `<legend>` "Image" (match the slot fieldset). Note the slice-1 slot fieldset puts `<legend>` inside a `div`, which is not a valid first-child legend. Do not copy that pattern. Put the legend as the direct first child of the fieldset in the new section, and consider fixing the existing one.
- Keyboard: the file label and Remove are in tab order. Show a visible focus ring for the visually hidden input on its label (`focus-within` or `peer-focus-visible`). This is the most common failure with a hidden file input.
- Screen reader: the preview `<img>` in the dialog gets an `alt` that states the state ("Current image", "New image, not saved yet", "No image"); the list thumbnail uses `alt=""`. Do not rely on the placeholder alone. Add visible text for the state.
- Announce the success of a pick politely (`role="status"`, e.g. "Image ready: 24 x 24 px"), or leave it silent and rely on the preview. Keep this minimal. Do not stack live regions.
- The `Remove image` button needs the type name in its label only if it appears in the list. In the dialog, the name is clear from context.
- Contrast: placeholder text and borders must meet 3:1 (non-text) and text 4.5:1. Use the existing `on-surface-variant` tokens.
- Respect the reduced-motion preference. There is no new animation here.
- Pointer: the 48 px thumbnail is not interactive. Do not make it a button, to keep the row's Edit action the only target.

### 9. Copy (D36)
- Add to `src/ui/copy/deviceTypes.ts`: `image` legend, `choose`, `replace`, `remove`, `undoRemove`, the size/format hint (built from `IMAGE_LIMITS`), the preview alts, the pending-remove note, the "saved, but the image failed" prefix, and the read-failure message. List placeholder alt or label. Run `no-literals.test.ts` to see whether new TSX files must be registered.

### 10. Tests (AC3 and the test plan)
- Pure tests for `checkImageFile`: a fabricated valid 24 x 24 PNG, a wrong-size PNG (`image_bad_size`), a non-PNG such as text or a JPEG header (`image_not_png`), a file over 20 KB (`image_too_large`, and prove the bytes are not read), and a `File` with a `.png` name but non-PNG bytes. A `File` with an unreadable `arrayBuffer`.
- Pure tests for the save sequence with a fake `api`: create then PUT fails, giving `imageFailed` with the saved DTO; edit with image only skips PATCH; first step fails and no image call is made; `not_found` on the image step; remove path; unchanged and keep.
- Blob cache: key by `{id, imageVersion}`, revoke on version change and on unmount, and ignore a late response (stub `URL.createObjectURL` and `revokeObjectURL`). Test it as a plain class or function, so there is no DOM dependency.
- Markup tests (`renderToStaticMarkup`) for the fields: placeholder when no image, preview when present, Remove button visibility per state, an error with `role="alert"` and the `aria-describedby` link.

## Risks
- The `key`-based remount is the main trap for the partial-save flow (see 6). A naive "setItem to the saved type" would reset the form and the image draft, or `name_taken` on retry if the dialog still thinks it is creating.
- Blob URL leaks and stale previews on replace, close, Strict Mode double effects and slow late responses (see 3).
- 100 simultaneous image fetches on a large catalog; each is an `apiFetch` with a bearer and goes to Drive on the server. Throttle.
- Closing the dialog from `onDone` while a retry or reload is in flight, so a late `setState` hits an unmounted component. Use the same cancelled-flag pattern.
- `image_changed` after a successful first step: the draft is compared against stale data. Without a refresh the retry loops on the same 409.
- The closed icon list: do not pull in a new icon casually. It touches the font subset and `ICON_NAMES` ordering (alphabetical is required).
- The existing `<legend>` inside a `div` in the slot fieldset is an a11y defect. Fix it only if in scope (R4), otherwise follow up.
- A short viewport: the dialog gets taller with a 48 px preview row plus the hint and errors. `EntityFormDialog` has no max-height/scroll.

## Open questions
1. Is a "pending removal" visible state (with Undo) wanted, or should Remove act immediately on the existing image with its own DELETE and a confirm? I recommend deferring to Save (one atomic step from the user's view). A planner decision is needed.
2. Should the dialog fetch the saved item again after `image_changed`, via `api.list()` (no single-item GET exists), or just close and reload the list? Closing is simpler but loses the user's draft.
3. What does `removeDeviceTypeImage` return when the type has no image: 204 or an error? If it errors, the remove step must tolerate it.
4. What cache headers does `IMAGE_HEADERS` set? If the browser already caches by ETag, the in-memory cache only needs to avoid refetching within a page.
5. Concurrency: is a fixed small queue acceptable, or should rows load lazily with `IntersectionObserver`? Pick one so the plan has a single mechanism.
6. Should `ListSection` rows carry the thumbnail through `renderRow` only (no `ListSection` change), as I assumed?

Files referenced: /home/user/simap/src/ui/deviceTypes/DeviceTypeFormDialog.tsx, /home/user/simap/src/ui/deviceTypes/DeviceTypesPage.tsx, /home/user/simap/src/ui/deviceTypes/DeviceTypesView.tsx, /home/user/simap/src/ui/deviceTypes/device-types-api.ts, /home/user/simap/src/ui/deviceTypes/device-types-state.ts, /home/user/simap/src/ui/deviceTypes/device-type-form.ts, /home/user/simap/src/ui/EntityFormDialog.tsx, /home/user/simap/src/ui/copy/api.ts, /home/user/simap/src/lib/icons.ts, /home/user/simap/src/app/api/device-types/[id]/image/route.ts.
