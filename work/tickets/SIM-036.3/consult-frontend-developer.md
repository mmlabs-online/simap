## Findings

**Backend (done, SIM-036.2/036.5), what the UI can call**
- `GET /api/device-types` (user tier) returns `{ items: DeviceTypeDto[] }`. `DeviceTypeDto` is `{id, name, slot, hasImage, imageVersion}` (`src/lib/device-types/types.ts`).
- `POST /api/device-types` (admin) takes `{name, slot}` and returns 201 with the DTO. Any validation failure is 400 `invalid_request`.
- `PATCH` and `DELETE /api/device-types/[id]` (admin) also exist. I did not read that route file, so check how DELETE responds.
- `PUT /api/device-types/[id]/image` takes raw `image/png` bytes and returns the DTO. `DELETE` on the same path returns 204. `GET` (user tier) returns the PNG with an ETag and `private, no-cache`.
- Image error codes are 422: `image_too_large`, `image_not_png`, `image_bad_size`, `invalid_png`. The image route can also give `images_unavailable`, `drive_error`, `drive_config`, `image_changed` and 404 `not_found`. I did not check the HTTP status of those last four.
- Domain errors: 409 `name_taken` (duplicate name), 409 `type_limit` (100 per org), 404 `not_found`.
- Limits are shared in `IMAGE_LIMITS` (24 px, 20480 bytes) in `src/lib/validate/png.ts`. `DEVICE_TYPE_LIMITS.name` is 60, and `DEVICE_KINDS` is `monitor, laptop, pc, phone, other`. `src/lib/**` is pure, so the UI can import these. `validatePng` is also pure and works on a `Uint8Array`.
- **The ticket says duplicate name is 409 and bad image is 422, which matches.** But a bad name or slot gives 400 `invalid_request`, which the ticket does not mention. Client validation should prevent it, with a generic fallback message.

**Patterns to copy**
- `src/ui/groups/*` is the closest model for a management page.
  - `GroupsPage` gates on `useSession().tier` before mounting the data hook.
  - `GroupsView` is pure and takes props. It has a forbidden state with a title and a `role="alert"` no-access card.
  - `groups-api.ts` has `createGroupsApi(apiFetch)`. Every method returns `{ok:true,value}` or `{ok:false,code}` and never throws. It maps `ApiAccessError` to a code.
  - `useList(api.x.list)` provides `{status, items, errorCode}`, and `ListSection` renders the list.
  - `TagFormDialog` and `DeleteDialog` are the dialog models.
- `EntityFormDialog` (`src/ui/EntityFormDialog.tsx`) is the form dialog shell. It takes `title`, `submitLabel`, `error`, `submitting` and `onSubmit`, and it renders `DialogField` inputs. `DeviceFormDialog` splits a stateful inner component from a props-only `DeviceFormFields` so the markup can be tested without effects.
- Page wiring has three parts: `src/app/(app)/<x>/page.tsx` renders `<XPage/>` exported from `src/ui/index.ts`. A nav entry goes in `src/lib/nav.ts` (`NAV_ITEMS`, with `NavId` and `minTier: "admin"`, like `audit`). Copy goes in `src/ui/copy/shell.ts` (nav label near line 17, page title near line 51), which also needs the matching icon name from `src/lib/icons`. `AppShellView.test.tsx` lists the hrefs per tier and must be updated.
- `apiFetch` (`src/lib/api/fetch.ts`) re-sends once on 401/403. It throws if the body is a `ReadableStream`, so use a `Blob` or `Uint8Array` body for the PUT, not a stream. It forces `cache: "no-store"`. It sets only the Authorization header, so you must pass `content-type: image/png` yourself.
- Blob URLs already exist only in the dashboard export (`src/ui/dashboard/export-api.ts`, `save-blob.ts`). There is no image-loading hook yet.
- `src/lib/security/headers.ts` and its test mention `blob:`. I did not read it. **Verify the CSP `img-src` allows `blob:`** before relying on it.

**Device dialog suggestions**
- `DeviceFormDialog.tsx` (line 151) renders a `<datalist>` from the hardcoded `devicesCopy.typeSuggestions` (`src/ui/copy/devices.ts` line 38). The existing test asserts the option count against that constant.
- `DeviceFormDialog` receives `api: DevicesApi`, `loadPage` and `isAdmin`. Types are free text with `maxLength` `DEVICE_LIMITS.type`.

## Recommendations

1. **Page.** Add `src/ui/deviceTypes/` with `DeviceTypesPage` (tier gate then loaded component), a pure `DeviceTypesView`, `device-types-api.ts` (same result style as groups, plus `putImage(id, bytes)`, `removeImage(id)` and `fetchImageBlob(id)`), a form dialog, and a delete dialog. Add `/device-types` to `page.tsx`, `ui/index.ts`, `nav.ts` (admin, rail) and the shell copy. Non-Admins get the no-access card from the page itself, since nav hiding is UX only. This covers AC1.
2. **Copy.** Put all strings in `src/ui/copy/deviceTypes.ts` (D36), including the error map, slot labels, diagram labels, image errors and the delete-confirm text ("devices of this type will show the placeholder"). The ticket explicitly requires this file.
3. **Pure validation module**, for example `device-type-form.ts`, with unit tests:
   - The name check should mirror the server (trim, collapse whitespace, 1..60). It could reuse `validateDeviceTypeCreate` from `@/lib/validate/device-type`, which is pure and allowed for UI via lib.
   - Slot must be in `DEVICE_KINDS`.
   - `checkImageFile(file/bytes)` runs before sending. Check size first (more than 20480 gives "too large"), then call `validatePng(new Uint8Array(await file.arrayBuffer()))`, which maps to `image_not_png` or `image_bad_size`. Reusing `validatePng` and `IMAGE_LIMITS` keeps client and server rules identical, and it also checks the CRC and IEND chunks. Do not trust `file.type`.
   - Map server codes to inline messages: `name_taken`, `type_limit`, `image_*`, `invalid_request`, `not_found`, and a fallback.
4. **Dialog flow.**
   - Create does POST, then PUT the image if one was chosen. If the image step fails, the type already exists. Switch the dialog to edit mode for the new type (or close and reload) and show the image error inline. Otherwise a retry would hit `name_taken`.
   - Edit sends PATCH only for changed fields (copy the `toPatchBody` "unchanged" pattern), then PUT or DELETE the image if it changed.
   - Offer "Remove image" (DELETE) when `hasImage` is true or a new file is staged.
   - The slot picker should be radio buttons over `DEVICE_KINDS`, each with a small desk diagram (SVG or CSS grid). Check `src/lib/sprites/device-slots` for slot positions so the diagram matches the map.
5. **Image display.**
   - Make a small `useDeviceTypeImage(api, id, imageVersion)` hook or component. It fetches via apiFetch, makes `URL.createObjectURL`, and revokes it on cleanup or when `imageVersion` changes. It renders `<img>` with `image-rendering: pixelated`, 24 px source shown at about 48 px, and a placeholder when `hasImage` is false. Use `alt=""` or the type name.
   - The create dialog's local preview should use a staged blob URL, also revoked on cleanup.
   - Use `imageVersion` as the effect key so the list refreshes after save.
   - Cache blobs across list rows in the page to avoid N fetches on every reload.
6. **Device dialog suggestions (AC4).** Load the catalog with `GET /api/device-types` and feed the datalist. Fall back to `devicesCopy.typeSuggestions` while loading or on error, so typing is never blocked and D37 free text stays. Non-admin users also need this list, and the endpoint is user tier. Decide where to fetch it (`DevicesPage`, passed as a prop, which keeps `DeviceFormFields` pure). Update the `DeviceFormDialog.test.tsx` option-count assertion.
7. **Tests.** Dialog form-field markup tests (render to string, as in the devices tests), validation unit tests, list states (loading, empty, error, ready), the forbidden view, the api layer with a fake fetcher (including the PUT headers and body), and the nav test updates. The AC says "component tests cover the dialog validation".

## Risks
- Partial failure on create (the type is created, then the image PUT fails) is the main correctness trap. See recommendation 4.
- `apiFetch` replays a 401/403 once, so an image PUT may be sent twice. It is idempotent, so this is fine. Do not stream the body.
- A missing `blob:` in the CSP `img-src` would silently break previews in production but not in jsdom. Check `headers.ts`.
- Blob URL leaks from missing revokes. Test the cleanup.
- The image route's server limit is enforced on bytes read. The client check is advisory only, so the UI must still show the server 422 codes.
- A stale image after replacement. The server GET uses `no-cache` with an ETag, and `apiFetch` forces `no-store`, so refetching on `imageVersion` change is enough.
- 100-type limit: show `type_limit` inline.
- Deleting a type used by devices: devices keep their text type and show the placeholder (per the ticket). Check whether DELETE returns anything like an impact count. The groups pattern has a `delete-impact` endpoint, but device types do not appear to have one, so the confirm text must be static.

## Open questions
- Which route for the page: `/device-types` or `/settings/device-types`? Which nav icon, and does `src/lib/icons` need a new name?
- Should the Devices page fetch the catalog for the Type datalist for all tiers (the endpoint allows user), and should a missing or failed catalog silently use the seed list?
- Create flow: close after a partial failure, or keep the dialog open in edit mode? I recommend keeping it open in edit mode.
- Does `DELETE /api/device-types/[id]` return 204, and what are the HTTP statuses of `images_unavailable`, `drive_error` and `drive_config`? Is the image feature optional (Drive not configured), so the UI should hide the upload control on `images_unavailable`?
- Desk diagram: is there a reference for the slot positions in `src/lib/sprites/device-slots` and the SIM-035 docs?
