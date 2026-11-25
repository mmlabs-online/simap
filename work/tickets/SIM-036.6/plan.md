Status: READY

# Plan — SIM-036.6: Device type images in the admin page

Slice 2 of SIM-036.3 (slice 1 merged: `src/ui/deviceTypes/**`). UI only. No route, no schema, no High path.

## Scope summary
- Ticket goal: "Slice 2 of SIM-036.3: an Admin uploads, previews and removes a device type's square image on the Device types page."
- Ticket scope:
  - "List preview: 24 px PNG shown enlarged (`image-rendering: pixelated`), placeholder when `hasImage` is false; loaded with `apiFetch` (bearer) as `blob:` URLs, cached per `{id, imageVersion}`, revoked on replace or unmount."
  - "Dialog upload: `<input type="file" accept="image/png">`, client check (`file.size <= IMAGE_LIMITS.maxBytes`, then `validatePng`), local preview, `PUT` raw bytes with `content-type: image/png`; Remove image (`DELETE /image`)."
  - "Save sequence: POST/PATCH first, then PUT/DELETE the image; if the type saved but the image step failed, stay open in edit mode for the saved type and show the message inline."
- SIM-036.3 plan § Split proposal (slice 2): "Show the image in each list row: 24 px PNG shown at 48 px with `image-rendering: pixelated` ... Cache the URLs per page by `{id, imageVersion}` with a small concurrency limit, and revoke them on replace or unmount." and "`PUT` sends raw bytes with `content-type: image/png` (a `Blob`/`Uint8Array` body, not a stream)."
- D61 (2): "Images are stored in Google Drive ... served by an `/api` route behind the bearer, rendered as `blob:` URLs). Image format: square PNG, 24 × 24 px, transparent background allowed, at most 20 KB, drawn 1:1 in room pixels with nearest-neighbour zoom."
- D52: "Management screens ... use the clean UI kit without pixel art. Body text, tables and forms never use a pixel font." (The image itself is pixel art; the chrome around it stays the clean kit.)
- D36 / CLAUDE.md: "UI copy: English, in `src/ui/copy/<feature>.ts`".
- Out of scope (ticket): "Map drawing (SIM-036.4). Image editing or cropping in the browser."
- Added by the orchestrator: SIM-036.3 review should-fix, "slot `<legend>` first child of `<fieldset>` in DeviceTypeFormDialog.tsx" (`DeviceTypeFormDialog.tsx:108-128`, the legend currently sits inside the inner `div` at line 110).

Backend already exists and is unchanged (`src/app/api/device-types/[id]/image/route.ts`):
- `PUT` → 200 `DeviceTypeDto` (new `imageVersion`), 422 `image_too_large` / `image_not_png` / `image_bad_size`, 409 `image_changed`, 404 `not_found`, 503 `images_unavailable`, 502/5xx `drive_error`.
- `DELETE` → 204; idempotent (`src/server/device-types/image.ts:155-192`: no image gives 204 too).
- `GET` → PNG bytes, `Cache-Control: private, no-cache`, ETag (`route.ts:17-20,54-84`). `apiFetch` sends `cache: "no-store"` (`src/lib/api/fetch.ts:52`), so the in-memory `{id, imageVersion}` cache is the only cache. No ETag round trip.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1a | Upload rejects a non-PNG, a non-24 × 24 image or a file over 20 KB before sending. | `device-type-image.test.ts` › `checkImageFile` cases (see Tests); code read: `DeviceTypeFormDialog.tsx` pick handler calls `checkImageFile` and only stages `{kind:"replace"}` on `ok`; `putImage` is only called from `saveDeviceType` with staged bytes. |
| 1b | A valid image shows in the preview and in the list after save. | `device-type-image.test.ts` › `imageFieldView` ("replace shows the staged url"); `DeviceTypeImageField.test.tsx` › "preview img with pixelated rendering"; `DeviceTypesView.test.tsx` › "row shows the image when imageUrl returns a url"; `device-type-save.test.ts` › "create then put ok is done" (dialog closes through `onDone`, which reloads the list, new `imageVersion` → new cache key). Manual: Ming step below. |
| 1c | Images load with the bearer as `blob:` URLs. | `device-types-api.test.ts` › "getImage reads a blob through the fetcher"; `image-url-cache.test.ts` (load → `create(blob)` → url); code read: `useDeviceTypeImages` loads through `api.getImage` (the bearer `apiFetch`) and `URL.createObjectURL`. |
| 2 | Server image refusals (422 `image_*`, `images_unavailable`, `drive_error`, `image_changed`) show inline. | `device-type-save.test.ts` › "image step refusal gives imageFailed with the saved type and the mapped message" (table over the six codes, message = `copy.imageSaveFailed + apiErrorMessage(code)`); code read: `imageFailed` sets the dialog `error` (the one `role="alert"` line of `EntityFormDialog`) and keeps the dialog open. |
| 3 | Component tests cover the image check (fabricated PNG bytes, wrong size, over 20 KB, non-PNG). | `device-type-image.test.ts` › `checkImageFile` describe block. |
| 4 | Should-fix: slot `<legend>` is the first child of its `<fieldset>`. | `DeviceTypeFormDialog.test.tsx` › "every fieldset starts with its legend" (`/<fieldset[^>]*><legend/` for each fieldset in the markup). |
| 5 | Copy in `src/ui/copy/deviceTypes.ts`; checks green. | `no-literals.test.ts` green (scans every non-test `.tsx` under `src/ui`); `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
- On the deployed app (needs Drive configured, which local runs usually lack): as Admin, open Device types, create a type with a 24 × 24 PNG, see the enlarged pixelated thumbnail in the list. Then pick a 32 × 32 PNG, a JPEG renamed `.png` and a PNG over 20 KB, and see the inline message each time with no request sent. Remove the image, Save, and see the placeholder.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/deviceTypes/device-type-image.ts` (new) | Pure: `checkImageFile`, `imageCheckMessage`, the `ImageDraft` type and `imageFieldView`. | Client check and field state, testable in node. | No |
| `src/ui/deviceTypes/image-url-cache.ts` (new) | Pure factory `createImageUrlCache` (injected `load`/`create`/`revoke`, limit 4). | Blob URL cache per `{id, imageVersion}`, revoke rules, concurrency cap. | No |
| `src/ui/deviceTypes/device-type-save.ts` (new) | Pure async `saveDeviceType` (type step, then image step). | Save sequence and partial-failure result. | No |
| `src/ui/deviceTypes/useDeviceTypeImages.ts` (new) | Thin hook owning one cache for the page. | React lifecycle (create in effect, dispose on unmount, sync on list change). | No |
| `src/ui/deviceTypes/DeviceTypeImageField.tsx` (new) | Pure props-only image section (fieldset + legend, preview, file label, Remove / Keep current, hint, pick error). | Dialog upload UI, testable by static markup. | No |
| `src/ui/deviceTypes/DeviceTypeThumb.tsx` (new) | 48 px thumb `<img>` or dashed placeholder; `onError` falls back to placeholder. | List preview and dialog preview share it. | No |
| `src/ui/deviceTypes/device-types-api.ts` | Add `getImage`, `putImage`, `removeImage`. | Image routes through the bearer fetcher. | No |
| `src/ui/deviceTypes/DeviceTypeFormDialog.tsx` | Fieldset/legend fix (lines 108-128); Inner holds `current`, `draft`, `pickError`; submit uses `saveDeviceType`; renders `DeviceTypeImageField`; new prop `imageUrl`. | Upload, save sequence, should-fix. | No |
| `src/ui/deviceTypes/DeviceTypesView.tsx` | New prop `imageUrl: (t) => string \| null`; `DeviceTypeThumb` at the left of each row (`renderRow`, lines 45-52). | List preview. | No |
| `src/ui/deviceTypes/DeviceTypesPage.tsx` | Use `useDeviceTypeImages(api, items)`; pass `imageUrl` to the View and the dialog; forbidden branch passes `() => null`. | Wire cache to list and dialog. | No |
| `src/ui/copy/deviceTypes.ts` | Add `form.image` copy block and `thumb` alt/label. | D36. | No |
| `src/ui/deviceTypes/device-type-image.test.ts` (new) | Tests (see below). | AC1a, AC3. | No |
| `src/ui/deviceTypes/image-url-cache.test.ts` (new) | Tests. | AC1c, ticket test plan "blob URL cache and revoke". | No |
| `src/ui/deviceTypes/device-type-save.test.ts` (new) | Tests. | AC1b, AC2. | No |
| `src/ui/deviceTypes/DeviceTypeImageField.test.tsx` (new) | Markup tests. | AC1b, a11y. | No |
| `src/ui/deviceTypes/device-types-api.test.ts` | Add image call tests. | AC1c. | No |
| `src/ui/deviceTypes/DeviceTypeFormDialog.test.tsx` | Add fieldset/legend test. | AC4. | No |
| `src/ui/deviceTypes/DeviceTypesView.test.tsx` | Pass `imageUrl` in existing renders; add thumb tests. | AC1b. | No |

No file matches a High path in `.claude/loop.config.md` (no migration, no `src/server/**`, no `src/server/http/**`, no `src/proxy.*`, no config). No route file is touched (R4). `src/ui/EntityFormDialog.tsx`, `src/ui/groups/ListSection.tsx`, `src/lib/icons.ts` and `src/ui/copy/api.ts` stay unchanged.

Size estimate: about 350 product lines and 300 test lines. One implement/review cycle; no further split.

## Data model / migration
None.

## API contract
None changed. The client uses the existing endpoints:
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/device-types/{id}/image` | — | `image/png` bytes | 200, 404 `not_found`, 503 `images_unavailable`, `drive_error` | user+ |
| PUT | `/api/device-types/{id}/image` | raw PNG, `content-type: image/png` | `DeviceTypeDto` | 200, 422 `image_*`, 409 `image_changed`, 404, 503, `drive_error` | admin |
| DELETE | `/api/device-types/{id}/image` | — | empty | 204 (idempotent), 404 | admin |

## Tests to write
All tests run in Vitest `environment: "node"` (no DOM). Hooks are not unit tested; logic lives in the pure modules.

| Test (file › name) | Covers |
|---|---|
| `device-type-image.test.ts` › checkImageFile › "valid 24 x 24 PNG is ok and returns the bytes" | AC3 fabricated PNG |
| › "16 x 16 PNG gives image_bad_size" (also 24 x 32) | AC3 wrong size |
| › "size 20481 gives image_too_large and never calls arrayBuffer" (spy) | AC3 over 20 KB, check order |
| › "size 20480 valid PNG is ok" (boundary; pad with an ancillary `tEXt` chunk) | limit boundary |
| › "text bytes, JPEG header (`ff d8 ff e0`) and an empty file give image_not_png" | AC3 non-PNG |
| › "does not look at type or name: PNG bytes with type `application/octet-stream` are ok" | `accept` is advisory |
| › "arrayBuffer that throws gives read_failed" | unreadable file |
| › imageCheckMessage › "server codes map through apiErrorMessage; read_failed maps to copy.readFailed" | client and server wording match |
| › imageFieldView › "keep with current url / keep without image / replace / remove" (preview url, state for alt, showRemove, showUndo) | preview rules, Remove visibility |
| `image-url-cache.test.ts` › "hasImage false gives null and no load" | placeholder |
| › "same id and version loads once (in-flight dedupe), url available after load, onChange called" | cache hit/miss |
| › "a new imageVersion revokes the old url and loads the new one" | revoke on replace |
| › "an id missing from sync is revoked and dropped" | prune after reload |
| › "dispose revokes every url" | revoke on unmount |
| › "a load that resolves after dispose or after its version was superseded is revoked at once and not stored" | late-result race |
| › "never more than 4 loads in flight; the queue drains" (10 types, deferred loads) | concurrency cap |
| › "a failed load (null or reject) gives null, is not retried for the same version, is retried on a new version" | per-row failure |
| `device-type-save.test.ts` › "create + keep: POST only, done" | sequence |
| › "create + replace: POST then PUT with the created id, done" | create then image |
| › "create ok then PUT refused: imageFailed with the created DTO; message = imageSaveFailed + apiErrorMessage(code)" (table: `image_not_png`, `image_bad_size`, `image_too_large`, `images_unavailable`, `drive_error`, `image_changed`) | AC2 |
| › "edit, fields unchanged + keep: closed, no calls" | unchanged branch |
| › "edit, fields unchanged + replace: no PATCH, PUT only" | image-only edit |
| › "edit, fields changed + remove: PATCH then DELETE" | remove path |
| › "type step refused (e.g. name_taken): failed, no image call" | first step fails |
| › "type step not_found: done" and "image step not_found: done" | deleted meanwhile |
| › "invalid form: invalid, no calls" | validation |
| `DeviceTypeImageField.test.tsx` › "starts with legend Image; file input has accept=image/png inside a label" | markup, a11y |
| › "no image: placeholder, no Remove button" | placeholder |
| › "preview img has the url, width/height 48 and pixelated rendering" | AC1b |
| › "remove state shows the pending note and Keep current image" | pending remove |
| › "error shows role=alert with an id the input references in aria-describedby, and aria-invalid" | inline pick error |
| › "disabled disables the input and buttons" | while submitting |
| `device-types-api.test.ts` › "getImage reads a blob through the fetcher; a non-PNG content type is internal" | AC1c |
| › "putImage sends PUT with content-type image/png and a Blob body (not a stream), reads the DTO" | raw bytes |
| › "putImage 422 image_too_large gives {ok:false, code}" | refusal mapping |
| › "removeImage: 204 is ok" | DELETE |
| `DeviceTypeFormDialog.test.tsx` › "every fieldset starts with its legend" | AC4 |
| `DeviceTypesView.test.tsx` › "row shows the image when imageUrl returns a url; placeholder otherwise" | AC1b list |

PNG fixtures: write a small helper in `device-type-image.test.ts` (signature + IHDR + IDAT + IEND with real CRCs, as in `src/lib/validate/png.test.ts:5-62`). IDAT data can be any bytes, because `validatePng` is structural only (`png.ts:26-30`), so `node:zlib` is not needed. Do not export the helper from `png.test.ts`.

## Approach
1. **Copy** (`src/ui/copy/deviceTypes.ts`). Add under `form`: `image: "Image"`, `choose: "Choose PNG"`, `replace: "Choose another PNG"`, `remove: "Remove image"`, `keepCurrent: "Keep current image"`, `hint` built from `IMAGE_LIMITS` (`PNG, 24 x 24 px, up to 20 KB`; import `IMAGE_LIMITS` from `@/lib/validate/png`, ui → lib is allowed), `pendingRemove: "The image will be removed when you save."`, `imageSaveFailed: "The type was saved, but the image was not. "`, `readFailed: "The file could not be read. Pick it again."`, `alt: { current: "Current image", staged: "New image, not saved yet", none: "No image" }`. Add `thumb: { none: "No image" }` for the placeholder's visually hidden text. No new `apiErrorMessage` copy (`src/ui/copy/api.ts:54-59` already covers every image code).
2. **Pure image module** (`device-type-image.ts`).
   - `checkImageFile(file: { size: number; arrayBuffer(): Promise<ArrayBuffer> })` returns `{ ok: true; bytes: Uint8Array<ArrayBuffer> } | { ok: false; code: "image_too_large" | "image_not_png" | "image_bad_size" | "read_failed" }`. Order: `size > IMAGE_LIMITS.maxBytes` returns before reading; then read (a throw gives `read_failed`); then `validatePng`. Never uses `file.type` or the name.
   - `imageCheckMessage(code)`: `read_failed` → `copy.readFailed`, else `apiErrorMessage(code)`.
   - `type ImageDraft = { kind: "keep" } | { kind: "replace"; bytes: Uint8Array<ArrayBuffer>; url: string } | { kind: "remove" }`.
   - `imageFieldView(draft, hasImage, currentUrl)` returns `{ previewUrl, state: "none" | "current" | "staged" | "remove", showRemove, showUndo }`. Rules: keep → current url or none. replace → staged url. remove → none plus pending note. `showRemove` = (hasImage and draft keep) or draft replace. `showUndo` = draft remove. "Remove image" on a staged replace goes back to keep. Remove on the current image stages `remove`.
3. **Blob URL cache** (`image-url-cache.ts`). `createImageUrlCache({ load: (id) => Promise<Blob | null>, create, revoke, limit = 4, onChange })` returns `{ sync(types), url(type), dispose() }`.
   - Key is `${id}:${imageVersion}`, with one entry per id.
   - `sync` queues loads for `hasImage` types. It revokes and drops entries whose id is missing, whose version changed or whose `hasImage` became false.
   - In-flight loads are deduped, and a FIFO queue caps in-flight loads at `limit`.
   - A result that arrives after `dispose` or after its key was superseded is revoked at once and not stored.
   - A failed load is stored as `failed`. `url()` then gives null, and it is not retried until the version changes.
   - `onChange` fires when an entry resolves.
   - No React, no globals: `create`/`revoke` are injected, so tests use fakes.
4. **API** (`device-types-api.ts`). Reuse `call()`.
   - `getImage(id)`: GET `${base}/${id}/image`. The reader calls `res.blob()` and fails with `internal` unless `blob.type` starts with `image/png`.
   - `putImage(id, bytes: Uint8Array<ArrayBuffer>)`: `{ method: "PUT", headers: { "content-type": "image/png" }, body: new Blob([bytes], { type: "image/png" }) }`, then the `json` reader. A Blob is re-sendable by `apiFetch`'s single retry and is not a `ReadableStream` (`fetch.ts:32`). Do not use `withBody`, which is JSON-only.
   - `removeImage(id)`: DELETE with the `remove`-style null reader.
5. **Save sequence** (`device-type-save.ts`). `saveDeviceType({ api, current: DeviceTypeDto | null, form, draft })` returns one of:
   - `{ kind: "invalid"; message }` or `{ kind: "closed" }`: nothing was sent.
   - `{ kind: "done" }`
   - `{ kind: "failed"; message }`: the type step failed and nothing was saved.
   - `{ kind: "imageFailed"; saved: DeviceTypeDto; message }`
   
   Steps:
   - If `current` is null, run `toCreateBody` and then POST.
   - Otherwise run `toPatchBody(form, current)`. `unchanged` + keep gives `closed`. `unchanged` + another draft skips the PATCH and uses `saved = current`.
   - A type-step error: `not_found` gives `done` (the same rule as `settleSave`), anything else gives `failed` with `apiErrorMessage`.
   - Image step: replace → `putImage(saved.id, bytes)`; remove → `removeImage(saved.id)`; keep → none.
   - An image-step error: `not_found` gives `done`, because the type was deleted meanwhile and the list reload shows that. Any other code gives `imageFailed` with `copy.imageSaveFailed + apiErrorMessage(code)`.
6. **Hook** (`useDeviceTypeImages.ts`, `"use client"`). `useDeviceTypeImages(api, items)` returns `(t: DeviceTypeDto) => string | null`.
   - `useEffect([api])` creates the cache into a ref, with `load = (id) => api.getImage(id).then(r => r.ok ? r.value : null)`, `create = URL.createObjectURL`, `revoke = URL.revokeObjectURL`, and `onChange` bumping a counter state. Its cleanup calls `dispose()` and clears the ref.
   - A second effect, declared after the first, calls `sync(items)` when `items` or the cache changes.
   - Creating the cache inside the effect keeps React Strict Mode's mount/cleanup/mount symmetric, so no disposed cache is left behind.
7. **Thumb** (`DeviceTypeThumb.tsx`, `"use client"`). Props are `{ url: string | null; alt: string }`.
   - It renders a 48 × 48 `<img width={48} height={48} alt={alt} className="shrink-0 object-contain [image-rendering:pixelated]" style={{ imageRendering: "pixelated" }}>`.
   - Otherwise it renders a same-size dashed `outline-variant` box with the `category` icon (`aria-hidden`) and a visually hidden `thumb.none`.
   - A `useState` failed flag keyed by url makes `onError` fall back to the placeholder.
   - It is not interactive. No new icon (the `src/lib/icons.ts` list is closed).
8. **Image field** (`DeviceTypeImageField.tsx`). Props are `{ view (from imageFieldView), error: string | null, disabled, onPick(file: File), onRemove(), onUndo() }`.
   - Markup: `<fieldset>` with `<legend className={CAPTION}>` as its first child, then a row: `DeviceTypeThumb` (alt from `copy.alt[state]`) and a column holding the file `<label>` and the Remove or Keep current button.
   - The file `<label>` is styled as a tonal button with `focus-within` ring and wraps an `sr-only` `<input type="file" accept="image/png">`. It must not use `display:none`.
   - Below that column: the hint, the pending-remove note, and the pick error `<p id={errId} role="alert">`. `errId` comes from `useId`. The input gets `aria-describedby={errId}` and `aria-invalid` while an error shows.
   - The input's `onChange` passes `files[0]` up and then sets `e.currentTarget.value = ""`, so picking the same file again fires again.
   - There is only one live region per message: client pick errors show here, and save-time refusals use the dialog's bottom `error` line.
9. **Dialog** (`DeviceTypeFormDialog.tsx`).
   - (a) Should-fix: make `<legend className={CAPTION}>` the direct first child of `<fieldset className="flex flex-col gap-2">`, then wrap the radio column and `<DeskSlotDiagram>` in `<div className="flex items-start justify-between gap-3">`.
   - (b) New prop `imageUrl: (t: DeviceTypeDto) => string | null`. Keep `key={item?.id ?? "new"}`.
   - (c) Inner state: `current` (initially `item`), `draft` (`keep`) and `pickError`. Every create/edit decision, the title and the submit label come from `current`, not `item`, so after a create the dialog shows the edit title and Save without remounting.
   - (d) Pick handler: run `checkImageFile`. If it fails, set `pickError` and keep the previous draft. If it passes, set the draft to replace with `URL.createObjectURL(new Blob([bytes], { type: "image/png" }))` and clear `pickError`.
   - (e) An effect keyed on the draft url revokes the staged url on change and on unmount. It is created in the event handler and revoked in the cleanup. The mount double-run only sees `keep`.
   - (f) Submit: clear `error` and `pickError`, set `submitting` for the whole sequence, call `saveDeviceType`, then act on the result:
     - `invalid` or `failed`: set `error`.
     - `closed`: call `close()`.
     - `done`: call `onDone()`.
     - `imageFailed`: set `current = saved`, set `error`, keep the draft. The next Save goes straight to the image step and never POSTs again.
   - (g) `close()`: if a type was saved during this dialog's life (`current !== item`), call `onDone()` so the list reloads. Otherwise call `onClose()`. Use it for Cancel/Esc and for `closed`.
10. **View and Page.** In `DeviceTypesView`, add `imageUrl` to the props and render `<DeviceTypeThumb url={props.imageUrl(t)} alt="" />` before the name block (wrap it in `flex items-center gap-3 min-w-0`). In `DeviceTypesPage`, call `const imageUrl = useDeviceTypeImages(api, types.status === "ready" ? types.items : [])` (check the `useList` state shape), pass `imageUrl` to the View and the dialog, and pass `() => null` on the forbidden branch. The list reload after `onDone` brings the new `imageVersion`, so the cache loads the new image and revokes the old one.
11. Run the checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules:
- R1: all new code is in `src/ui/**` and imports only `@/lib/validate/png`, `@/lib/device-types/types`, `@/lib/api/fetch` and `../copy/*`. There are no `src/server` imports.
- R7: there are no route changes.
- R3: no env and no secrets.
- R4: only the files listed above change.
- R5: every new pure module has tests.
- D36: all strings are in the copy file, and `no-literals.test.ts` guards the `.tsx` files. Alt `""` on the list thumb is an attribute value, not copy. If the literal scanner flags `alt=""`, use a copy constant or `// copy-ok: decorative`.
- D52: the dialog and list chrome use the clean kit. Only the image itself is pixelated.

## Specialist input used
- frontend-developer:
  - Adopted: pure `checkImageFile` with size before read and no reliance on `file.type`; injected `create`/`revoke` cache with in-flight dedupe, a limit of 4 and the late-result revoke; cache created lazily in the effect for Strict Mode; `getImage`/`putImage`/`removeImage` with a Blob body, the `image/png` header and no `withBody`; pure save function; the dialog adopts the saved type and never re-POSTs; `unchanged` + image op does not close; Cancel after a saved type reloads the list; input value reset; `onError` fallback; the fieldset fix plus the markup test.
  - Changed: the "staged" state is split as UX suggests (`keep` / `replace` / `remove`).
- ux-architect:
  - Adopted: the `ImageDraft` union; a pending Remove applied on Save with a visible note and "Keep current image"; a `sr-only` input in a label styled as a button with `focus-within` ring; the 48 px pixelated box with `object-fit: contain` and width/height attributes; the dashed placeholder with the `category` icon and hidden text; `alt=""` in the list and state alts in the dialog; the pick error under the control with `role="alert"`, `aria-describedby` and `aria-invalid`; save refusals on the dialog's single bottom alert (no double announce); `current` state instead of a remount; the "type was saved, but the image was not" prefix; a read-failure message; no new icon.
  - Rejected: a background `onSaved` list reload while the dialog stays open. A reload on close is simpler and gives the same end state.
  - Rejected: refetching the item after `image_changed`. The server re-reads the current file on every PUT (`image.ts:97-99,145-149`) with no client-sent version, so a plain retry succeeds.
  - Rejected: putting the image section above the slot. It goes after the slot fieldset, so `DeviceTypeFormFields` needs no slot prop.
  - Rejected: `IntersectionObserver`. A fixed queue of 4 is enough for 100 types.
  - Changed: "image step `not_found` is not done". The type was deleted meanwhile, so closing and reloading the list (it is gone) is the honest outcome and matches `settleSave`.

## Assumptions
Consultants' open questions, resolved as non-blocking:
- **A1** Thumbnail and dialog preview are both 48 × 48 px (2×), as the SIM-036.3 plan says ("24 px PNG shown at 48 px").
- **A2** Remove is staged and applied on Save, with a visible pending note and "Keep current image". There is no separate confirm dialog.
- **A3** Cancel or Esc after a type was saved (`imageFailed` path) closes and reloads the list. The saved type keeps its old image. The inline message prefix says the type was saved.
- **A4** `image_changed` keeps the dialog open with the draft. Save retries the PUT, which re-reads the current file server-side, so no refetch is needed. The existing copy ("Reload and try again") stays as is, with no change to `api.ts`.
- **A5** DELETE is idempotent (204 without an image, `image.ts:155-192`), so a stale `hasImage` cannot cause a false failure.
- **A6** `not_found` on either step counts as done (close and reload), matching `settleSave`.
- **A7** Caching is in memory only, per `{id, imageVersion}`, with no ETag (`Cache-Control: private, no-cache` plus `apiFetch` `cache: "no-store"`).
- **A8** Concurrency uses a fixed FIFO of 4 in-flight loads, with no lazy loading.
- **A9** The thumbnail goes through `renderRow` only. `ListSection` is not changed.
- **A10** The PNG test helper is a small copy in the new test. `png.test.ts` is not changed.
- **A11** Dialog height grows by about 90 px. `EntityFormDialog` has no scroll. Acceptable at the current field count. A follow-up covers a scrollable dialog body if a short viewport clips it, and `EntityFormDialog` is not edited here (R4).
- **A12** A failed list thumbnail load shows the placeholder silently, with no per-row alert.

Hotspots: no other open ticket (IN_PROGRESS, REVIEW or DONE) edits `src/ui/deviceTypes/**` or `src/ui/copy/deviceTypes.ts`. SIM-037.2 (PLANNING) lists none of these files. No rebase is expected.

## Blocking questions
None.

## Split proposal
None. This is slice 2 of the SIM-036.3 split. Slice 1 is merged, and this plan covers all of slice 2.
