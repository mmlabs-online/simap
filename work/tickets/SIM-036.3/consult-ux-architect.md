Consult report for SIM-036.3 (Device types admin page). I only read code. The API, validators, error copy and the PNG validator already exist, so this ticket is UI only, plus one nav entry.

## Findings

**Backend is ready (SIM-036.2 and SIM-036.5).**
- Routes:
  - `GET /api/device-types` (tier user) returns `{items: DeviceTypeDto[]}`.
  - `POST /api/device-types` and `PATCH` / `DELETE /api/device-types/[id]` are admin only. Their bodies are `{name, slot}`, and PATCH takes a partial of the same.
  - `PUT` / `DELETE /api/device-types/[id]/image` are admin only. PUT takes raw PNG bytes with `Content-Type: image/png`. DELETE returns 204.
  - `GET /api/device-types/[id]/image` (tier user) sends an ETag and returns 304 on `If-None-Match`.
- Types are in `src/lib/device-types/types.ts`:
  - `DeviceTypeDto = {id, name, slot, hasImage, imageVersion}`
  - `DEVICE_KINDS = monitor | laptop | pc | phone | other`
  - `DEVICE_TYPE_LIMITS.name = 60`
  - `perOrg = 100`
- Validation:
  - `src/lib/validate/device-type.ts` has `validateDeviceTypeCreate` and `validateDeviceTypePatch`. They NFC-normalise, collapse whitespace and reject control characters. The UI should reuse them, as `group-form.ts` and `device-form.ts` do.
  - `src/lib/validate/png.ts` has `IMAGE_LIMITS = {px: 24, maxBytes: 20480}`.
  - `validatePng(Uint8Array)` is pure. It does a structural check and returns `image_not_png` or `image_bad_size`.
  - The 24 × 24 check needs no image decoding: `validatePng` reads the IHDR dimensions. The client can call `validatePng` on `new Uint8Array(await file.arrayBuffer())` and also check `file.size <= IMAGE_LIMITS.maxBytes` first. This matches the server exactly, so the client and server codes stay aligned. Importing from `@/lib` is allowed for ui (R1).
- Error copy: `src/ui/copy/api.ts` already maps `name_taken` (409), `image_not_png`, `image_bad_size`, `image_too_large` and `image_changed` through `apiErrorMessage`. Reuse it. Do not add duplicates.

**Existing page patterns to copy.**
- Groups page (closest model):
  - `src/app/(app)/groups/page.tsx` is a 5-line wrapper that renders `<GroupsPage/>` from `@/ui` (`src/ui/index.ts` exports pages).
  - `GroupsPage` checks `useSession().tier`. Below the required tier it renders the pure View with `access="forbidden"` and mounts no data hook, so there is no request. Otherwise it renders `GroupsLoaded`, which has `useList` and dialog state.
  - `GroupsView` is pure. The forbidden branch shows the h1 plus a `Card` with `role="alert"` text (`groupsCopy.noAccess`). The ok branch uses `ListSection` and `RowActions` (tonal "Edit" `Button`, danger "Delete" `Button`).
  - `AuditPage` (admin only) uses the same pattern, with `canViewAudit` in `audit-state.ts`.
  - `GroupsPage` gates with `canManageGroups` from `groups-state.ts`. A matching `canManageDeviceTypes` (tier admin, via `atLeastTier` from `@/lib/tier`) fits there.
- Dialogs:
  - `EntityFormDialog` (props: `open`, `title`, `submitLabel`, `submitting`, `error`, `onClose`, `onSubmit`, `children`) plus `DialogField` and `DialogSelect`, all from `src/ui/EntityFormDialog.tsx`. The error is shown inline.
  - `TagFormDialog` is keyed by id and uses a `toXCreate` / `toXPatch` pure-helper pair that returns `ok | unchanged | invalid`. On `not_found` it calls `onDone`. `DeviceFormDialog` and `device-form.ts` follow the same shape.
  - `DeleteDialog` loads an impact count first. Device types have no impact endpoint, so use a plain confirm with the "devices of this type will show the placeholder" text.
- API client: `groups-api.ts` has `call()` returning `{ok, value} | {ok:false, code}` and never throwing. It maps `ApiAccessError` and parses `error.code`. Make `src/ui/deviceTypes/device-types-api.ts` the same way. `useList` in `src/ui/groups/useList.ts` is generic but typed on `GroupsResult`. Either import it (types are structurally compatible) or copy the small hook. Note `useList` needs a stable `load`.
- The Devices page's Type field is a free-text `DialogField` with a `<datalist>` fed from the static `devicesCopy.typeSuggestions` (`["PC","Laptop","Monitor","IP phone","Other"]`), in `src/ui/devices/DeviceFormDialog.tsx` lines 141-155. `DevicesPage` passes `api`, `loadPage`, `isAdmin` to it.

**Nav and shell.**
- `src/lib/nav.ts` has `NAV_ITEMS`, the `NavId` union and `minTier`. Add `deviceTypes` with `href: "/device-types"`, `minTier: "admin"`, `placement: "rail"`, and an icon from `src/lib/icons.ts` (`ICON_NAMES`). Existing icons include `sell` (Groups), `grid_view`, `lan`, `palette`. Check the list. A new icon likely means adding it to `ICON_NAMES` and possibly the font subset.
- `shellCopy.nav` is `satisfies Record<NavId,string>`, so adding a `NavId` forces adding `shellCopy.nav.deviceTypes` and `shellCopy.pages.deviceTypes.{title,empty}`.
- Tests to update:
  - `src/lib/nav.test.ts` has an explicit id list for admin, around lines 6-60.
  - `src/ui/AppShellView.test.tsx` line 81: "admin ... 9 links" with an href array. It becomes 10 and needs the new `/device-types` entry in rail order.
  - The audit entry sits after groups in the rail, so decide the order.
- Route: add `src/app/(app)/device-types/page.tsx`.

**Images as `blob:` URLs.**
- CSP `img-src 'self' data: blob:` already allows blob images (`src/lib/security/headers.ts`).
- No shared blob-image hook exists. `useAtlas.ts` and `export-api.ts` use blob or fetch for other things. `apiFetch` must be used for the image GET to send the bearer, then `URL.createObjectURL`.
- Revoke the URL on cleanup and when `imageVersion` changes.
- Cache by `{id, imageVersion}` to avoid refetching on every reload. Image GET also supports the ETag.
- Render with `image-rendering: pixelated`. In the list use 24 px enlarged (for example 48 px), per the ticket.
- Local preview of a picked file: `URL.createObjectURL(file)` after validation, revoked on replace or close.

**Copy.** D36: all text in `src/ui/copy/deviceTypes.ts` (new file, `deviceTypesCopy`). `src/ui/copy/no-literals.test.ts` and `copy.test.ts` police this, so check whether new files must be registered there. Use `kitCopy.save` / `cancel` as other dialogs do.

**D61 and D52.**
- D61: the catalog has name, slot and an optional image. `devices.type` stays free text (D37) and matches a catalog name (trimmed, case-insensitive). A device whose type is not in the catalog draws the placeholder. Seed types exist (PC, Laptop, Monitor, IP phone, Other), and names are at most 60 characters (the same as `devices.type`).
- D52: management screens use the clean UI kit (`Button`, `Card`, `EntityFormDialog` and so on, from `@/ui`), with no pixel art. I could not read the full D52 text because the grep omitted that long row (line 59). The planner should skim it.

## Recommendations
1. **Files**, mirroring Groups:
   - `src/ui/deviceTypes/DeviceTypesPage.tsx`: the tier gate, then a Loaded component with the list hook and a dialog state of none, form or delete.
   - `DeviceTypesView.tsx`: pure, with `access`, loading, error, empty and ready states. Rows show the image preview, name and slot label, with Edit and Delete buttons.
   - `DeviceTypeFormDialog.tsx`.
   - `DeleteDeviceTypeDialog.tsx`: a plain confirm, with the `name_taken`-style refusals shown inline.
   - `device-types-api.ts`: list, create, update, remove, `putImage`, `removeImage`, `imageBlob(id)`.
   - `device-type-form.ts`: pure `toCreateBody` / `toPatchBody`, with `fileCheck(file)` for the client image check.
   - `DeskSlotDiagram.tsx`.
   - `src/ui/copy/deviceTypes.ts`.
   - Export the page from `src/ui/index.ts`.
2. **Non-admin gating (AC1):** the nav entry is hidden via `minTier: "admin"`, and the page shows the no-access `Card` with `role="alert"` and mounts no hooks (copy the Audit/Groups gate).
3. **Save sequence in the dialog (AC2, AC3):**
   - Create or PATCH the name and slot first, then PUT the image if a new file was picked. Remove the image with DELETE if "Remove image" was chosen on an existing image.
   - If the first step succeeds but the image step fails (422), keep the dialog open, show the message inline, and switch the dialog to edit mode for the created type. Otherwise a retry would hit `name_taken`. The same applies on edit if the PATCH succeeds and the image step fails. The list must reload so the saved name and slot show.
   - Per R7, `apiFetch` re-sends once on 401/403. Only the auth wrapper can produce those, so this is fine.
4. **Client image check (AC3):**
   - Check `file.size` first, then `validatePng`. Message mapping: `image_not_png`, `image_bad_size` and `image_too_large` all come from `apiErrorMessage`, reused for client-side failures too.
   - Reject before sending. On failure keep the previous preview.
   - Add a hidden `<input type="file" accept="image/png">` with a labelled button. Add `aria-live` or `role="alert"` on errors.
5. **Slot picker:** `DialogSelect` over `DEVICE_KINDS` with copy labels (for example monitor "Monitor, beside the seat" etc.), plus a small desk diagram. Build the diagram from simple CSS or SVG blocks. It has no pixel-sprite dependency, and `SLOTS` in `src/lib/sprites/device-slots.ts` gives positions (u, du, dv, under). Do not import the sprite atlas. Keep it simple, and mark the selected slot position with `aria-hidden` plus a text label.
6. **Device dialog suggestions (AC4):**
   - `DevicesPage` fetches the catalog (`GET /api/device-types`, user tier) when the form opens, and passes `typeNames: string[]` to `DeviceFormDialog`. Add a `typeNames` or `suggestions` prop to `DeviceFormFields`.
   - Fall back to the static `devicesCopy.typeSuggestions` while loading or on error. The datalist then stays usable and free text still works (D37). Keep `DeviceFormDialog.test.tsx` and `DevicesView.test.tsx` passing.
   - Put `listDeviceTypes` in `device-types-api.ts` so both pages share it.
7. **Tests (AC5):**
   - Pure tests for `device-type-form.ts`: name validation, slot, unchanged patch, file check with a fabricated PNG, and a wrong-size PNG.
   - View tests via `renderToStaticMarkup` for forbidden, loading, error, empty and ready states (like `GroupsView.test.tsx`).
   - A dialog-fields markup test like `DeviceFormDialog.test.tsx`.
   - Update `nav.test.ts` and `AppShellView.test.tsx` as above.
   - Run `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check` and `pnpm test`.
8. **Page header/title:** reuse `shellCopy.pages.deviceTypes.title` ("Device types") as `GroupsView` does with its title.

## Risks
- **Icon list:** `ICON_NAMES` is a closed set. A new icon (for example `devices` or `category`) may need font or subset work. Reusing an existing name is the lowest risk; verify which names exist.
- **Blob lifecycle:** leaking object URLs, and showing a stale image after a replace. Key on `imageVersion` and revoke on cleanup. The list may have up to 100 rows, so use a small concurrency or lazy load, and fetch only when `hasImage`.
- **Partial-save race** (see recommendation 3): a PATCH succeeded and the PUT failed, so a naive retry gives a confusing `name_taken`.
- **Image changed concurrently** (`image_changed`): the message is already in the copy. After it, reload the list and the preview.
- **`useList` reuse:** it sits in `src/ui/groups/` and is typed on `GroupsResult`. A cross-feature import is allowed, but moving or duplicating it is a scope question (R4). The simplest option is a small local hook.
- **Copy guard tests:** `no-literals.test.ts` may flag raw strings in new TSX. All user text must come from `deviceTypes.ts` (and any aria labels, too).
- **Case-insensitive matching:** the catalog matching of `devices.type` is by name, case-insensitive, so the datalist should show catalog names verbatim. Deleting a catalog type does not change devices; the confirm copy must say devices keep their type text and show the placeholder.
- D52 full text not read (omitted row). The planner should check it for any specific kit requirements.

## Open questions
1. Nav order and icon: after Groups or after Audit? Which icon (an existing name is preferred)?
2. Route name: `/device-types` (assumed) vs another.
3. Should the delete confirm also mention seeded types (PC, Laptop, and so on)? Can they be deleted? The server allows delete for any type unless a route test says otherwise. Check `device-types-routes.test.ts`.
4. Should the image GET go through `apiFetch` with an ETag conditional request, or a simple fetch per `{id, imageVersion}` with an in-memory cache? The second is simpler.
5. Is the slot diagram meant to be generic (five labelled positions) or built from the `SLOTS` data per kind? I recommend the simple labelled diagram, since pixel-art art is D41/SIM-033 territory.
6. Any desired "Remove image" semantic when creating (there is no image yet): hide the button until the type has an image or a picked file.
