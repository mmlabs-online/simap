Status: READY

# Plan: SIM-036.3, Device types admin page (slice 1 of 2: catalog page and Type suggestions, no images)

> Size note: the whole ticket is about 900 lines of code plus about 450 lines of tests, which is more than one
> implement/review cycle. This plan covers **slice 1** only. Slice 2 (images) is described under `## Split proposal`
> and needs a follow-up ticket (proposed ID `SIM-036.6`, depends on this one).

## Scope summary
- Ticket goal: "An Admin adds and edits the org's device types (name, where it sits on the desk, its square image) from one management page."
- Ticket scope, the parts covered here:
  - "A "Device types" management page (Admin): list with ... name, slot."
  - "Create / edit dialog: name; slot (fixed list with a small desk diagram); ... delete with a confirm that says devices of this type will show the placeholder."
  - "The device create/edit dialog's Type suggestions come from the catalog (free text still allowed, D37)."
- D61 (2): "Admins manage a per-org device type catalog: name, desk slot and an optional image. ... `devices.type` stays free text (D37) and matches a catalog type by name (trimmed, case-insensitive); a device whose type is not in the catalog draws as one built-in square placeholder sprite."
- D61 (1), used for the diagram: "at its type's preferred slot (e.g. first monitor right, second left, PC under the desk, small items on the desk top)".
- D52: "Management screens (... devices, ... groups/projects, audit log ...) use the clean UI kit without pixel art. Body text, tables and forms never use a pixel font."
- D37: "Device type: suggested list (PC, Laptop, Monitor, IP phone, Other) plus free text."
- D36 / CLAUDE.md: "UI copy: English, in `src/ui/copy/<feature>.ts`". The ticket names `src/ui/copy/deviceTypes.ts`.
- Backend already exists (SIM-036.2/036.5). This ticket changes no route.

Slice 2 covers the image parts: image preview in the list, upload with the client check, preview, remove image, and the 422 image refusals.

## Acceptance criteria → verification
| # | Criterion (slice 1 wording) | How the reviewer verifies it |
|---|---|---|
| 1 | Only Admins see the nav entry and the page; others get the no-access card. | `nav.test.ts` › "deviceTypes is admin only" (admin has it; manager and user do not); `device-types-state.test.ts` › `canManageDeviceTypes` (admin true; manager, user and undefined false); `DeviceTypesView.test.tsx` › "forbidden shows the title and a role=alert no-access card, no New button"; code read: `DeviceTypesPage` returns the forbidden view before `DeviceTypesLoaded` mounts, so no request is sent. |
| 2 | Create, rename, change slot and delete work and show server refusals (duplicate name 409 `name_taken`, `type_limit`, `invalid_request` fallback) inline. | `device-type-form.test.ts` (create/patch bodies, unchanged, invalid name); `device-types-state.test.ts` › `settleSave` / `settleDelete` (`name_taken` and `type_limit` give the `apiCopy` text, `not_found` gives done, unknown code gives the generic text); `device-types-api.test.ts` (method, path, JSON body, 204 delete, error code parsing, never throws); local run with `pnpm dev`: create "Scanner"/other, rename it, change its slot, create a second "scanner" and see the inline duplicate message, delete it. |
| 3 | Delete confirm says devices of this type keep their type text and show the placeholder. | `DeleteDeviceTypeDialog.test.tsx` › "body names the type and shows the placeholder warning" (contains `deviceTypesCopy.delete.body(name)`). |
| 4 | The device dialog's Type field suggests catalog names (free text still allowed). | `DeviceFormDialog.test.tsx` › "datalist lists the given suggestions" (option count equals the `suggestions` prop) and "type input stays free text" (no `pattern`, still `maxLength`); `device-types-state.test.ts` › `typeSuggestions` (ok: catalog names in API order; loading or error: `devicesCopy.typeSuggestions`; ok and empty: `[]`). Local run: rename "IP phone" to "Desk phone" on the new page, open New device, and see "Desk phone" in the Type suggestions. |
| 5 | UI copy lives in `src/ui/copy/deviceTypes.ts`; component tests cover the dialog validation. | `no-literals.test.ts` stays green (it scans every new `.tsx`); `DeviceTypeFormDialog.test.tsx` (fields markup: name `maxLength` 60 and `required`, five slot radios with the selected one checked, diagram present); `device-type-form.test.ts` (validation). |
| 6 | Checks green. | `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `pnpm test`. |

## Ming verification after merge
None for slice 1. The image upload check ("upload a 24 px PNG and see it in the list") moves to slice 2.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/copy/deviceTypes.ts` | create `deviceTypesCopy`: page texts, list title, New/Edit/Delete labels and per-row aria labels, form titles, field labels, `slots: Record<DeviceKind, {label, hint}>`, `fieldErrors` (name, slot, body), `noAccess`, `delete.{title, body(name), confirm}`, diagram aria text. | D36 and AC5 | no |
| `src/ui/deviceTypes/device-types-api.ts` | create `createDeviceTypesApi(fetcher)` with `list()`, `create(body)`, `update(id, patch)`, `remove(id)`. It returns a `DeviceTypesResult<T>` (`{ok:true,value}` or `{ok:false,code}`) and never throws. Copy the `call`/`errorCode` shape from `src/ui/groups/groups-api.ts:10-53`. List reads `items`. | AC2, AC4 | no |
| `src/ui/deviceTypes/device-types-api.test.ts` | create with a fake fetcher, in the style of `groups-api.test.ts`. | AC2 | no |
| `src/ui/deviceTypes/device-type-form.ts` | create `DeviceTypeForm = {name, slot}`, `emptyForm()` (slot `other`), `formFromType(dto)`, `toCreateBody(form)` (via `validateDeviceTypeCreate`), `toPatchBody(form, dto)` (changed fields only; `unchanged`; via `validateDeviceTypePatch`), `fieldMessage(field)`. Same shape as `src/ui/groups/group-form.ts:40-72`. | AC2, AC5 | no |
| `src/ui/deviceTypes/device-type-form.test.ts` | create | R5, AC5 | no |
| `src/ui/deviceTypes/device-types-state.ts` | create `canManageDeviceTypes(tier?)` (`atLeastTier(tier, "admin")`), `settleSave(result)`, `settleDelete(result)`, `typeSuggestions(state)`, `slotMarker(kind)` (diagram position from `SLOTS[kind][0]` in `src/lib/sprites/device-slots.ts:27-48`). | AC1, AC2, AC4 | no |
| `src/ui/deviceTypes/device-types-state.test.ts` | create | R5 | no |
| `src/ui/deviceTypes/DeviceTypesPage.tsx` | create: tier gate, then `DeviceTypesLoaded` with `useList(api.list)` (import from `../groups/useList`) and dialog state `none`, `form` or `delete`. Model: `src/ui/groups/GroupsPage.tsx`. | AC1, AC2 | no |
| `src/ui/deviceTypes/DeviceTypesView.tsx` | create: pure view. Forbidden branch (title and a `Card` with `role="alert"`). Ok branch: `ListSection` (import `../groups/ListSection`) with rows showing the name, the slot label and Edit/Delete buttons. Model: `src/ui/groups/GroupsView.tsx:20-80`. | AC1, AC2 | no |
| `src/ui/deviceTypes/DeviceTypesView.test.tsx` | create: forbidden, loading, error (retry), empty, ready (names, slot labels, per-row aria labels). | AC1, R5 | no |
| `src/ui/deviceTypes/DeviceTypeFormDialog.tsx` | create: `DeviceTypeFormDialog` (keyed on `id ?? "new"`) with a stateful inner component plus an exported, props-only `DeviceTypeFormFields` (name `DialogField`; slot `fieldset` of radio buttons over `DEVICE_KINDS`; `DeskSlotDiagram`). | AC2, AC5 | no |
| `src/ui/deviceTypes/DeviceTypeFormDialog.test.tsx` | create: `renderToStaticMarkup` of `DeviceTypeFormFields`. | AC5 | no |
| `src/ui/deviceTypes/DeskSlotDiagram.tsx` | create: a small inline SVG with a 2-tile desk, the chair side marked, and the selected slot's marker (`slotMarker`). It uses `aria-hidden="true"`, theme colours, and no sprites. | ticket "small desk diagram" | no |
| `src/ui/deviceTypes/DeleteDeviceTypeDialog.tsx` | create: plain confirm (`EntityFormDialog` with an exported, props-only `DeleteDeviceTypeBody`). DELETE sends 204, then done; errors are shown inline. | AC2, AC3 | no |
| `src/ui/deviceTypes/DeleteDeviceTypeDialog.test.tsx` | create | AC3 | no |
| `src/ui/deviceTypes/useTypeSuggestions.ts` | create: hook (`useApiFetch`, `createDeviceTypesApi(...).list()` once on mount, stale-drop on unmount) that returns `typeSuggestions(state)`. | AC4 | no |
| `src/app/(app)/device-types/page.tsx` | create a 5-line wrapper that renders `<DeviceTypesPage/>`, same as `src/app/(app)/groups/page.tsx`. | route | no |
| `src/ui/index.ts` | export `DeviceTypesPage` (next to line 27). | page wiring | no |
| `src/lib/nav.ts` | add `"deviceTypes"` to `NavId` and `{ id: "deviceTypes", href: "/device-types", icon: "category", minTier: "admin", placement: "rail" }` after `audit` (line 40). | AC1 | no |
| `src/lib/icons.ts` | add `"category"` in sorted order (between `"block"` and `"close"`). The font subset URL is built from this list, so nothing else changes. | nav icon | no |
| `src/ui/copy/shell.ts` | add `nav.deviceTypes: "Device types"` (line 18 area) and `pages.deviceTypes: { title: "Device types", empty: "No device types yet." }` (line 52 area). | `satisfies Record<NavId,string>` | no |
| `src/lib/nav.test.ts` | add the admin-only case; add `"deviceTypes"` after `"audit"` in the rail order (lines 45-55). | AC1 | no |
| `src/ui/AppShellView.test.tsx` | admin test (line 81): "10 links", with `"/device-types"` after `"/audit"`. | nav change | no |
| `src/ui/devices/DeviceFormDialog.tsx` | `DeviceFormInner` calls `useTypeSuggestions()` and passes the result. `DeviceFormFields` gets a `suggestions: readonly string[]` prop that feeds the datalist (lines 151-155) in place of `devicesCopy.typeSuggestions`. | AC4 | no |
| `src/ui/devices/DeviceFormDialog.test.tsx` | the default props pass `suggestions`; the line 42 assertion uses the prop. Add the free-text case. | AC4 | no |

No file matches a High path in `.claude/loop.config.md` (no migrations, nothing under `src/server/**`, no `config.*`, `src/proxy.*`, `next.config.*`, `.env.example` or deploy files). Gate stays `none`.

## Data model / migration
None.

## API contract
None changed. The UI uses the existing routes (`src/app/api/device-types/route.ts`, `[id]/route.ts`):
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/device-types` | none | `{items: DeviceTypeDto[]}` | 200 | user |
| POST | `/api/device-types` | `{name, slot}` | 201 `DeviceTypeDto` | 400 `invalid_request`, 409 `name_taken`, 409 `type_limit` | admin |
| PATCH | `/api/device-types/[id]` | `{name?, slot?}` | 200 `DeviceTypeDto` | 400, 404 `not_found`, 409 `name_taken` | admin |
| DELETE | `/api/device-types/[id]` | none | 204 | 404 `not_found` | admin |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `device-type-form.test.ts` › toCreateBody: trims and collapses spaces, keeps Vietnamese diacritics (`"Máy  in "` gives `"Máy in"`) | validation, Domain focus (diacritics) |
| `device-type-form.test.ts` › toCreateBody: empty or whitespace-only name, 61-char name, and a control char are invalid with the name message | validation edges |
| `device-type-form.test.ts` › toCreateBody: a slot outside `DEVICE_KINDS` is invalid with the slot message | validation |
| `device-type-form.test.ts` › toPatchBody: same name (spaces or NFC only) and same slot give `unchanged`; name only or slot only sends just that field; a case-only rename is sent | patch |
| `device-types-state.test.ts` › canManageDeviceTypes: admin true; manager, user and undefined false | AC1 |
| `device-types-state.test.ts` › settleSave: ok and `not_found` give done; `name_taken`, `type_limit` and `invalid_request` give the matching `apiCopy.errors` text; an unknown code gives `apiCopy.errors.internal` | AC2 |
| `device-types-state.test.ts` › settleDelete: ok and `not_found` give done; other codes give an inline message | AC2 |
| `device-types-state.test.ts` › typeSuggestions: loading and error give the D37 seed list; ready gives the catalog names in order; ready and empty gives `[]` | AC4 |
| `device-types-state.test.ts` › slotMarker: pc is `under`; monitor sits at the back; every kind gives a point inside the diagram box | diagram |
| `device-types-api.test.ts` › list reads `items`; a missing `items` gives `internal` | api |
| `device-types-api.test.ts` › create/update send POST/PATCH with a JSON body and `content-type: application/json` to the right path (id URL-encoded) | api |
| `device-types-api.test.ts` › remove: 204 gives `{ok:true}`; a 409 body gives its code; a thrown `ApiAccessError` maps to its code; a network throw gives `unavailable` | api |
| `DeviceTypesView.test.tsx` › forbidden / loading / error with retry / empty / ready rows with slot labels and aria labels | AC1, list states |
| `DeviceTypeFormDialog.test.tsx` › fields: name input `maxLength=60` and `required`; five radios labelled from `deviceTypesCopy.slots`, the form's slot checked; diagram svg `aria-hidden` | AC5 |
| `DeleteDeviceTypeDialog.test.tsx` › body names the type and shows the placeholder warning | AC3 |
| `DeviceFormDialog.test.tsx` › datalist lists the given suggestions; type input stays free text | AC4 |
| `nav.test.ts` › deviceTypes is admin only; rail order includes deviceTypes after audit | AC1 |
| `AppShellView.test.tsx` › admin: 10 links | nav |

The Vitest environment is `node` (`vitest.config.ts:16`), so component tests render pure parts with `renderToStaticMarkup`. Hooks and dialog flows are tested through the pure `settle*` helpers.

## Approach
1. Copy file `src/ui/copy/deviceTypes.ts`. Slot copy is based on D61 and `SLOTS`:
   - monitor: "Monitor, back of the desk (first right, second left)"
   - laptop: "Laptop, desk top in front of the seat"
   - pc: "PC, under the desk"
   - phone: "Phone, desk top at the side"
   - other: "Other, desk top"

   The delete body: "Delete the type "{name}"? Devices with this type keep their type text and show the placeholder image on the map." Reuse `apiErrorMessage` from `src/ui/copy/api.ts` for server codes; do not duplicate them. Use `kitCopy.save` / `kitCopy.cancel`.
2. Write `device-types-api.ts`, then `device-type-form.ts` and `device-types-state.ts` with their tests. All are pure and import only `@/lib/**` and `../copy/*` (R1).
3. `DeviceTypesView`, `DeviceTypeFormDialog` (radio fieldset plus `DeskSlotDiagram`), `DeleteDeviceTypeDialog`, then `DeviceTypesPage`. After save or delete: close and `reload()` the list. Edit or delete on `not_found`: close and reload.
4. Wiring: `page.tsx`, `ui/index.ts`, `nav.ts`, `icons.ts`, `shell.ts`, then update the nav and shell tests.
5. AC4: `useTypeSuggestions` is mounted only while the device dialog is open (inside `DeviceFormInner`), so the Devices list itself makes no extra request. Free text stays (no `pattern`, D37).
6. Rules:
   - R1: no `src/server` import; the new files import only `@/lib` and `../`.
   - R7: no handler change.
   - R6/R2/R3: not touched.
   - D52: kit components only, no pixel font. The diagram is a plain SVG, not a sprite.
   - D36: no literals in `.tsx` (`no-literals.test.ts`).
   - R4: nothing outside this list.
7. Run `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `pnpm test`.

## Specialist input used
- Both consults: mirror the Groups page (gate before the data hook, pure View, never-throw api, `toCreate`/`toPatch` pair). Adopted.
- frontend-developer 3 and ux-architect 4, client image check with `validatePng` and size first: deferred to slice 2.
- Both consults, keep the dialog open in edit mode after a partial create (type saved, image failed): deferred to slice 2. Slice 1 has a single request per save, so it has no partial state.
- ux-architect 5, `DialogSelect` for the slot: rejected in favour of radio buttons (frontend-developer 4). With radios, each label can carry the position hint next to the diagram.
- Both consults, catalog for the Type datalist with a fallback to the D37 seed list on loading or error: adopted. Added rule: a loaded empty catalog gives no suggestions, so deleted types are not offered again.
- Reuse `apiErrorMessage` (ux-architect): adopted.
- Reuse `useList` and `ListSection` from `src/ui/groups`: adopted by import (same ui layer, structurally typed), so no move (R4).
- CSP `blob:` and image cache: moved to slice 2. ux-architect confirmed `img-src` already allows `blob:`.
- Open questions answered here:
  - Route `/device-types`.
  - Nav after `audit` with the new icon `category`. `ICON_NAMES` builds the Google Fonts subset URL, so adding a name is enough.
  - DELETE returns 204 (`src/app/api/device-types/[id]/route.ts:42`).
  - Seed types are deletable like any other.
  - The diagram uses `SLOTS[kind][0]`.

## Assumptions
- Admin-only nav, after Audit, icon `category`. These are cosmetic, and Ming can change them later.
- Seed types (PC, Laptop, ...) can be renamed or deleted. The server allows it, and the confirm text is the same for every type.
- `useList`/`ListSection` imported across `src/ui/groups` and `src/ui/deviceTypes` is accepted (same layer). Moving them to a shared place is a possible follow-up.
- The Type datalist shows catalog names verbatim. Matching is case-insensitive server side (D61), so there is no client normalising.
- Hotspot: SIM-037.1 (IN_PROGRESS, unowned devices) may edit `src/ui/devices/DeviceFormDialog.tsx` / `.test.tsx`, `src/ui/copy/devices.ts` or `src/ui/copy/api.ts` (the ownership UI). This plan edits only `DeviceFormDialog.tsx` lines 97-155 and its test, so a small rebase is possible.

## Blocking questions
None.

## Split proposal
- **Slice 1 (this plan, SIM-036.3):**
  - the admin page, list (name, slot), create/rename/change slot/delete with inline refusals
  - the slot radio picker with the desk diagram
  - the delete confirm, nav, copy file
  - catalog Type suggestions in the device dialog
- **Slice 2 (proposed follow-up `SIM-036.6`, "Device type images in the admin page", depends on SIM-036.3):**
  - **List preview:**
    - Show the image in each list row: 24 px PNG shown at 48 px with `image-rendering: pixelated`, and a placeholder when `hasImage` is false.
    - Load it with `apiFetch` (bearer) from `GET /api/device-types/[id]/image` as a `blob:` URL.
    - Cache the URLs per page by `{id, imageVersion}` with a small concurrency limit, and revoke them on replace or unmount.
  - **Upload in the dialog:**
    - `<input type="file" accept="image/png">` with a client check: `file.size <= IMAGE_LIMITS.maxBytes` first, then `validatePng(new Uint8Array(await file.arrayBuffer()))`.
    - Local preview from a staged `blob:` URL.
    - `PUT` sends raw bytes with `content-type: image/png` (a `Blob`/`Uint8Array` body, not a stream).
  - **Remove image:** `DELETE /image`.
  - **Save sequence:** POST/PATCH first, then PUT or DELETE the image. If the type was saved but the image step failed, stay open in edit mode for the saved type and show the 422 or `images_unavailable` / `drive_error` / `image_changed` message inline.
  - **ACs:** AC3 and the "bad image 422" half of AC2, with component tests for the image check (fabricated PNG bytes; wrong size; over 20 KB; non-PNG).
  - **Ming verification:** upload a 24 px PNG and see it in the list.
