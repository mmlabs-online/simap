Status: READY

# Plan — SIM-039.6: "Map items" admin page (slice 1: page, list, details, size, reset)

The whole ticket is bigger than one implement/review cycle (see `## Split proposal`). This plan covers **slice 1
only**: the page, the nav entry, the grouped list, rename / regroup / show-hide / size (with the in-use warning), and
reset to library defaults, plus the API client writes for these. Art per direction (package sprite browser with
preview, per-direction upload and remove, image cache, previews at 1× and 2×) moves to a new ticket, proposed as
**SIM-039.9**.

## Scope summary
- Ticket Goal: "Admins manage the catalog on one page next to Device types."
- Ticket Scope (slice 1 parts): "Grouped list like the palette, ~~reorder~~, hide toggle, rename, visible `w × h` size
  editor with the in-use warning, … reset to library defaults." and "Nav entry for Admins." The remaining parts
  ("package sprite browser with preview, per-direction upload and remove") are slice 2 (SIM-039.9).
- Spec LAY-07 (`docs/spec-v1.md` l.453-470):
  - "An Admin has a "Map items" management page (clean UI kit, D52), beside Device types, that controls the editor's
    "Add items" palette (LAY-03) …; only an Admin changes it."
  - "Each item shows its library key (read only), name (unique in the org, case- and space-insensitive, at most 60
    characters), group (at most 40 characters; the palette groups by it), …, **size in tiles, always visible as
    `w × h`**, shown in palette (yes/no) and its art per direction …"
  - "The Admin can rename, regroup …, hide or show an item, change its size, set its art, and reset an item to the
    library defaults. Items are never deleted. Hiding only removes an item from the palette: placed fixtures of a
    hidden item keep drawing …"
  - "A size change is refused with 409 `item_in_use` while any room has the item placed (the message says how many
    rooms and that the fixtures must be removed first) … A size change removes the item's custom images, because they
    no longer fit (the page warns first, OQ-52). Fixed sizes: `desk.single` …, `chair.office` and `floor.*` (1 × 1)
    cannot be resized."
  - "`chair.office` is not placeable (never in the palette): it only sets the art of the chair drawn at each seat."
- D66 (7): "Every item has an explicit, visible size `w × h` in tiles, default the library footprint, Admin-settable to
  1–4 × 1–4 (desk, chair and floors fixed); size is for rotation 0 and 90°/270° swap w and h; a resize is refused with
  409 `item_in_use` while any room has the item placed".
- D67 (1): "catalog items are listed alphabetically by name"; (2) "hidden items are not returned to non-Admin members,
  Admins still get them". D67 "Amends … D66 where they conflict".
- D68: device types only; it does not change map item image rules (relevant to slice 2 only).
- Sibling notes this plan follows:
  - SIM-039.1 plan l.340: "**039.6**: no reorder UI; list in name order; shows hidden rows (Admin GET)." l.369-370:
    "Groups have no stored order; 039.5/039.6 show groups in name order." l.386: "Library defaults are not stored and
    not in the DTO; `libraryItem()` provides them for 039.2 reset and 039.6."
  - SIM-039.2 plan l.222-225: "read `error.rooms` for the `item_in_use` message; disable resize for `fixedSize`, hide
    for `kind === "chair"`, …; warn before resize/reset that custom images are deleted (OQ-52) and that sprites that no
    longer fit are cleared (A3). No reorder UI (D67 1)." l.107: "(039.6 adds the room count from `error.rooms`.)"
  - SIM-039.4 plan A8 (l.266-269): map-item image error copy must be map-specific (slice 2 applies it).

**Conflict flagged for Ming (ticket and spec vs decision): reorder.** The ticket Scope says "reorder" and spec LAY-07
says "order (within its group; groups are ordered too)" and "reorder items and groups". D67 (1) (Ming, newer, "amends
… D66 where they conflict") makes the list alphabetical; SIM-039.1/039.2 shipped no order column and no reorder
endpoint (a PATCH `order` key is 400). This plan has **no reorder UI**: groups and items are shown in name order.
CLAUDE.md says the spec wins, but here the spec text is stale against Ming's later decision, and the API cannot
reorder. Proposed follow-up (not done here, R4): amend LAY-07 l.457 and l.460 and the ticket Scope line to "listed
alphabetically (D67 1)". If Ming wants manual order after all, it needs a migration + API ticket first.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | (slice 1 part) Rename, regroup, show/hide, resize and reset (every 039.2 action except the art pick) are reachable from the page and show their errors inline. The art pick (039.2 PUT art) and the 039.4 image actions are slice 2 (SIM-039.9). | `MapItemsView.test.tsx › each row has an Edit button whose aria-label names the item`; `MapItemFormDialog.test.tsx › fields: name, group (datalist of groups), show-in-palette, size selects; Reset button`; `map-items-state.test.ts › mapItemErrorMessage: item_in_use with rooms 1 / 3 / missing; item_name_taken; item_fixed_size; unknown code`; `map-items-api.test.ts › patch / reset URL, method, body; 409 item_in_use returns rooms`. Code read: `MapItemFormDialog` and `ResetMapItemDialog` pass every refusal to `EntityFormDialog error` (a `role="alert"` line inside the dialog) and keep the form values. |
| 1a | In-use warning: before Save the page warns that a resize deletes custom images and clears sprites that no longer fit, and asks for a confirm; a 409 `item_in_use` says how many rooms. | `map-item-form.test.ts › resizeEffects …`, `› patchFrom: resize with effects and no confirm → needsConfirm`; `MapItemFormDialog.test.tsx › resize warning and confirm checkbox appear only when the size differs and something would be removed`; `map-items-state.test.ts › item_in_use message names the room count`. |
| 1b | Fixed-size items show `w × h` read-only with a reason; `chair.office` has no show/hide control; non-placeable/hidden state is text, not colour. | `MapItemFormDialog.test.tsx › fixed-size item: no size selects, read-only "1 × 1" and the reason`, `› chair: no show-in-palette checkbox, the chair note instead`; `MapItemsView.test.tsx › Hidden badge text; w × h shown on every row`. |
| 1c | No reorder (D67 1): groups and items in name order. | `map-items-state.test.ts › catalogGroups: groups by name (en, base sensitivity, Vietnamese diacritics), items by name then key, hidden and every kind included`; `MapItemsView.test.tsx › group headings render in catalogGroups order; no reorder or New controls`. |
| 2 | Non-Admins see no page entry. | `nav.test.ts › mapItems is admin only` and the updated rail-order test; `MapItemsView.test.tsx › forbidden: title and a no-access alert, no list`; `map-items-state.test.ts › canManageMapItems: admin true; manager, user, null false`. Code read: `MapItemsPage` mounts no data hook below Admin (same split as `DeviceTypesPage.tsx:25-41`). |
| 3 | Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally. | No server or route file changes (reviewer checks `git diff --stat`: nothing under `src/server/**` or `src/app/api/**`); R6 and audit are the merged 039.2 server's (`map-items-edit.db.test.ts`, `map-items-admin-routes.test.ts`). Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `pnpm test:db` on a local throwaway Postgres (Approach step 10), pass/fail lines in impl-log. |

## Ming verification after merge
As an Admin on the deployed app (or `pnpm dev` with a real Identity token):
- "Map items" shows in the nav right after "Device types"; the page lists every item grouped, hidden ones with a
  "Hidden" badge, each with `w × h`.
- Rename a plant to a Vietnamese name (e.g. "Cây lớn"), regroup it, hide another item: the room editor's "Add items"
  palette shows the new name/group and no longer offers the hidden item after a reload; the Audit page shows
  `map_item.update` rows.
- Resize an item that is placed in a room: the dialog says how many rooms and keeps the values. Resize an unplaced item
  with a custom image (once SIM-039.9 lets you upload one, or via the API): the warning and confirm appear first.
- Reset an edited item: name, group, size and hidden return to the library defaults.
- As a Manager or User: no "Map items" nav entry; `/map-items` shows the no-access message.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/mapItems/map-items-api.ts` | modify: add a private `call<T>(path, init, read)` copied from `src/ui/deviceTypes/device-types-api.ts:23-51` (+ `json`, `withBody`); `errorCode` (l.8-15) becomes `errorOf(res)` returning `{ code, rooms? }` (rooms only when the body's `error.rooms` is a non-negative integer, key omitted otherwise); `MapItemsResult<T>` failure type gains `rooms?: number`; `list` reuses `call` with unchanged results; new `patch(key, value: MapItemPatchValue)` → `PATCH /api/map-items/${encodeURIComponent(key)}` JSON → `MapItemDto`, `reset(key)` → `POST /api/map-items/${…}/reset` (no body) → `MapItemDto`. | AC 1, the 409 `rooms` (039.2 note) | no |
| `src/ui/mapItems/map-items-api.test.ts` | modify: add cases (existing 4 unchanged) | R5 | no |
| `src/ui/mapItems/map-items-state.ts` | create (pure): `canManageMapItems(tier)`, `catalogGroups(items)`, `isLibraryDefault(item)`, `mapItemErrorMessage(code, rooms?)`, `settleMapItem(result)` | rule 6, AC 1/1c/2 | no |
| `src/ui/mapItems/map-items-state.test.ts` | create | R5 | no |
| `src/ui/mapItems/map-item-form.ts` | create (pure): `MapItemForm` type, `formFromItem(item)`, `resizeEffects(item, w, h)`, `patchFrom(item, form)` | rule 6, AC 1/1a | no |
| `src/ui/mapItems/map-item-form.test.ts` | create | R5, Domain focus | no |
| `src/ui/mapItems/MapItemsPage.tsx` | create: client page, tier gate + `MapItemsLoaded` (api, `useList(api.list)`, dialog state `none / edit / reset`) | the page | no |
| `src/ui/mapItems/MapItemsView.tsx` | create: pure view (forbidden card, loading/error/empty, grouped rows) | AC 1c, 2 | no |
| `src/ui/mapItems/MapItemsView.test.tsx` | create | R5 | no |
| `src/ui/mapItems/MapItemFormDialog.tsx` | create: `MapItemFormDialog` (keyed by `builtinKey`) on `EntityFormDialog` + pure `MapItemFormFields` | AC 1, 1a, 1b | no |
| `src/ui/mapItems/MapItemFormDialog.test.tsx` | create: markup tests of `MapItemFormFields` | R5 | no |
| `src/ui/mapItems/ResetMapItemDialog.tsx` | create: confirm dialog on `EntityFormDialog` + pure `ResetMapItemBody` | reset (AC 1) | no |
| `src/ui/mapItems/ResetMapItemDialog.test.tsx` | create: markup test of `ResetMapItemBody` | R5 | no |
| `src/ui/copy/mapItems.ts` | create: `mapItemsCopy` (D36) | copy | no |
| `src/app/(app)/map-items/page.tsx` | create: `import { MapItemsPage } from "@/ui"` (mirror `src/app/(app)/device-types/page.tsx`) | route `/map-items` | no |
| `src/ui/index.ts` | modify: `export { MapItemsPage } from "./mapItems/MapItemsPage";` after l.28 | page import via `@/ui` | no |
| `src/lib/nav.ts` | modify: `NavId` += `"mapItems"`; `NAV_ITEMS` entry right after `deviceTypes` (l.42-48): `{ id: "mapItems", href: "/map-items", icon: "chair", minTier: "admin", placement: "rail" }` | AC 2 | no |
| `src/lib/nav.test.ts` | modify: admin length 10 → 11 (l.33), new "mapItems is admin only" case, rail order (l.48-58) adds `"mapItems"` after `"deviceTypes"` | AC 2 | no |
| `src/lib/icons.ts` | modify: add `"chair"` between `"category"` and `"close"` (sorted list, `icons.test.ts:7`) | nav icon (`icons.test.ts:11` requires every nav icon listed) | no |
| `src/ui/copy/shell.ts` | modify: `nav.mapItems: "Map items"` after l.44 (`satisfies Record<NavId,string>` forces it); `pages.mapItems: { title: "Map items", empty: "No map items yet." }` after l.87 | nav label, page title | no |

Read/imported only, not changed: `src/lib/map-items/types.ts` (`MapItemDto`, `MapItemPatchValue`, `MAP_ITEM_LIMITS`,
`MAP_ITEM_DIRS`), `src/lib/map-items/library.ts:76` (`libraryItem`), `src/lib/map-items/art.ts:10,29` (`sizeFor`,
`spriteFits`), `src/lib/validate/map-item.ts:41-69` (`validateMapItemPatch`), `src/lib/tier.ts` (`atLeastTier`),
`src/ui/groups/useList.ts`, `src/ui/EntityFormDialog.tsx` (`EntityFormDialog`, `DialogField`, `DialogSelect`),
`src/ui/Button.tsx`, `src/ui/Card.tsx`, `src/ui/Chip.tsx`, `src/ui/copy/api.ts:78` (`apiErrorMessage`),
`src/ui/copy/kit.ts`, `src/ui/copy/groups.ts` (`retry`), `src/ui/auth/api-fetch-context`, `src/ui/session`.
`src/ui/mapItems/useMapItems.ts` stays as is (the editor uses it; the page uses `useList` for `errorCode`).
No server, route, migration or High-path file is touched.

## Data model / migration
None.

## API contract
None changed. The page calls the merged SIM-039.2 routes (all `withAuth` tier `admin`, 200 `MapItemDto`):
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/map-items` | — | `{ items: MapItemDto[] }` (hidden rows included for Admins) | 401/403 wrapper; 503 | any member (page only as Admin) |
| PATCH | `/api/map-items/[key]` | non-empty partial `{ name?, group?, hidden?, w?, h? }` | `MapItemDto` | 400; 404; 409 `item_in_use` + `rooms: number`; 409 `item_name_taken`; 422 `item_fixed_size`, `not_allowed`; 503 | Admin |
| POST | `/api/map-items/[key]/reset` | no body | `MapItemDto` | 404; 409 `item_in_use` + `rooms`; 409 `item_name_taken`; 503 | Admin |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `map-items-api.test.ts › patch sends PATCH /api/map-items/plant.large with content-type application/json and the JSON body; returns the DTO` | AC 1 |
| `map-items-api.test.ts › the key is URL-encoded in patch and reset paths` | path safety |
| `map-items-api.test.ts › reset sends POST /api/map-items/door/reset and returns the DTO` | AC 1 |
| `map-items-api.test.ts › 409 { error: { code: "item_in_use", rooms: 2 } } → { ok:false, code:"item_in_use", rooms: 2 }; rooms "2", -1 or 1.5 is dropped; other errors have no rooms key` | 409 rooms parse |
| `map-items-api.test.ts › patch and reset: ApiAccessError signed_out → unauthenticated; fetch throw → unavailable; non-JSON 200 → internal` | never throws |
| `map-items-state.test.ts › canManageMapItems: admin true; manager, user, null, undefined false` | AC 2 |
| `map-items-state.test.ts › catalogGroups: groups sorted by name (en, base: "bàn" before "Cây", "Đèn" stable), items by name then builtinKey; hidden items and seat/fixture/floor/chair kinds all included` | AC 1c, diacritics |
| `map-items-state.test.ts › catalogGroups of [] is []` | empty |
| `map-items-state.test.ts › isLibraryDefault: a DTO equal to libraryItem (name, group, w, h, hidden false, no sprite, no image) → true; each single difference (name, group, size, hidden, one sprite, one hasImage) → false; unknown key → true` | reset button state |
| `map-items-state.test.ts › mapItemErrorMessage: item_in_use with rooms 1 → singular text, 3 → "3 rooms", missing → apiErrorMessage("item_in_use"); item_name_taken / item_fixed_size / sprite_not_allowed → apiCopy text; unknown → internal` | AC 1/1a |
| `map-items-state.test.ts › settleMapItem: ok → done; not_found → done (list reloads); item_in_use → error with the room-count text` | flow |
| `map-item-form.test.ts › formFromItem copies name, group, shown = !hidden, w, h; confirmResize false` | form |
| `map-item-form.test.ts › patchFrom: no change → unchanged; "  Cây \t lớn " on an item named "Cây lớn" → unchanged (NFC + whitespace rule of validateMapItemPatch)` | Domain focus: diacritics, whitespace |
| `map-item-form.test.ts › patchFrom: rename → { name }; regroup → { group }; hide → { hidden: true }; only changed fields are sent` | diff |
| `map-item-form.test.ts › patchFrom: blank name → invalid name; 61-code-point Vietnamese name → invalid name; blank or 41-char group → invalid group` | Domain focus: empty fields, limits |
| `map-item-form.test.ts › patchFrom: fixedSize item never sends w/h; chair never sends hidden` | AC 1b |
| `map-item-form.test.ts › resizeEffects: counts directions with hasImage; counts sprites that no longer fit after the resize (uses spriteFits, e/w swap); 0/0 when the size is unchanged` | OQ-52, 039.2 A3 |
| `map-item-form.test.ts › patchFrom: resize with effects > 0 and confirmResize false → needsConfirm; with confirm → patch { w, h }; resize with no effects → patch without confirm` | AC 1a |
| `MapItemsView.test.tsx › forbidden: page title and a role=alert no-access text; no rows, no Edit buttons` | AC 2 |
| `MapItemsView.test.tsx › loading: aria-busy skeleton; error: role=alert apiErrorMessage(code) and a Retry button` | states |
| `MapItemsView.test.tsx › ready: h2 per group in catalogGroups order; each row shows name, builtinKey, "w × h", Hidden badge only for hidden rows, Fixed size text for fixedSize rows` | AC 1b/1c |
| `MapItemsView.test.tsx › each Edit button has aria-label editLabel(name); there is no New button and no reorder control` | AC 1, D67 |
| `MapItemsView.test.tsx › empty ready list shows the "catalog not ready" text` | empty |
| `MapItemFormDialog.test.tsx › MapItemFormFields: read-only key, name (maxLength 60), group (maxLength 40) with a datalist of the given groups, show-in-palette checkbox, w and h selects 1-4` | AC 1 |
| `MapItemFormDialog.test.tsx › fixed-size item (desk.single, floor.*): no size selects, read-only "1 × 1"/desk size text with its reason` | AC 1b |
| `MapItemFormDialog.test.tsx › chair.office: no show-in-palette checkbox, the chair note instead` | AC 1b (039.2 A5) |
| `MapItemFormDialog.test.tsx › size changed with effects: warning lists the image and sprite counts, plus a required confirm checkbox; size unchanged: no warning` | AC 1a (OQ-52) |
| `MapItemFormDialog.test.tsx › directional item shows the rotation hint (e/w swap); Reset button disabled when isLibraryDefault, enabled otherwise` | D66 7, reset |
| `ResetMapItemDialog.test.tsx › ResetMapItemBody lists the library name, group and size, that custom images (N) are deleted and sprites cleared, and the in-use note only when the library size differs from the current size` | reset |
| `nav.test.ts › mapItems is admin only`; `› admin sees 11 items`; `› rail items keep seatMGT order` (+ mapItems after deviceTypes) | AC 2 |
| `icons.test.ts` (unchanged) passes: `chair` sorted, every nav icon listed | icons |

## Approach
1. **Nav and route.** `src/lib/icons.ts`: add `"chair"`. `src/lib/nav.ts`: `"mapItems"` in `NavId` and its own
   `NAV_ITEMS` object right after `deviceTypes`. `src/ui/copy/shell.ts`: `nav.mapItems`, `pages.mapItems`.
   `src/app/(app)/map-items/page.tsx` mirrors `device-types/page.tsx`; export `MapItemsPage` from `src/ui/index.ts`.
   Update `nav.test.ts`.
2. **API client** (`map-items-api.ts`): copy the `call` / `json` / `withBody` shape of
   `device-types-api.ts:23-51`. `errorOf(res)` reads `error.code` (string, else `"internal"`) and `error.rooms`
   (include only when `Number.isInteger(rooms) && rooms >= 0`). Failure type `{ ok: false; code: string; rooms?:
   number }`. `list` behaviour and its 4 tests unchanged (LayoutEditor still uses it). Add `patch` and `reset`.
   Slice 2 adds `putArt`, `getImage`, `putImage`, `removeImage` here.
3. **Pure state** (`map-items-state.ts`):
   - `canManageMapItems(tier)` = `atLeastTier(tier, "admin")` (as `device-types-state.ts:8-10`).
   - `catalogGroups(items)` → `{ group, items }[]`: same comparator as `src/lib/layout-editor/palette.ts:38-55`
     (`localeCompare(…, "en", { sensitivity: "base" })` then raw compare; items by name then `builtinKey`), but all
     kinds and hidden rows included. A local copy of the 2-line comparator is fine (do not edit `palette.ts`, R4).
   - `isLibraryDefault(item)`: `libraryItem(item.builtinKey)`; null → true (nothing to reset); else name, group, w, h
     equal, `!hidden`, and every `art[d]` has `sprite === null && !hasImage`.
   - `mapItemErrorMessage(code, rooms?)`: `item_in_use` with a number → `mapItemsCopy.errors.inUse(rooms)`; else
     `apiErrorMessage(code)` (codes `item_name_taken`, `item_fixed_size`, `not_allowed`, `unavailable` already have
     copy, `src/ui/copy/api.ts:69-73`).
   - `settleMapItem(result)`: ok or `not_found` → `{ kind: "done" }`; else `{ kind: "error", message }`.
4. **Pure form** (`map-item-form.ts`):
   - `MapItemForm = { name; group; shown: boolean; w; h; confirmResize: boolean }`.
   - `resizeEffects(item, w, h)` → `{ images, sprites }`: 0/0 if `w === item.w && h === item.h`; else `images` =
     directions with `art[d].hasImage`, `sprites` = directions with a non-null sprite and `!spriteFits(sprite, d, w,
     h)` (039.2 Approach: the server nulls all images and clears non-fitting sprites).
   - `patchFrom(item, form)` → `{ kind: "unchanged" } | { kind: "invalid"; field } | { kind: "needsConfirm" } |
     { kind: "patch"; value: MapItemPatchValue }`: build a candidate `{ name, group }` + `hidden: !shown` (not for
     `kind === "chair"`) + `w, h` (not when `fixedSize`); run `validateMapItemPatch` (so the client uses the server's
     normaliser and limits); diff the normalised value against the item and keep only changed keys; empty →
     unchanged; a size change with `images + sprites > 0` and `!confirmResize` → needsConfirm.
5. **Page** (`MapItemsPage.tsx`, `"use client"`): shape of `DeviceTypesPage.tsx:25-81`. Below Admin render
   `MapItemsView access="forbidden"` with no data hook. `MapItemsLoaded`: `useApiFetch`, `useMemo(createMapItemsApi)`,
   `useList(api.list)`, `Dialog = none | { kind: "edit"; item } | { kind: "reset"; item }`; `done` = close + reload.
   The edit dialog's Reset button switches to `{ kind: "reset", item }` (unsaved form edits are dropped; A6).
6. **View** (`MapItemsView.tsx`, pure): title `shellCopy.pages.mapItems.title` + subtitle `mapItemsCopy.intro`;
   forbidden card as `DeviceTypesView.tsx:27-38`; loading / error-with-Retry / empty markup copied from
   `ListSection.tsx:42-67` (ListSection itself always renders a New button, so it is not reused); ready: one
   `<section>` per group with an `h2` and a `<ul>` of `Card` rows: name (bold), `builtinKey` (muted, `font-mono`),
   a `w × h` chip, "Hidden" chip when hidden, "Fixed size" chip when `fixedSize`, and an Edit button
   (`aria-label={mapItemsCopy.editLabel(name)}`). No art thumbnail in slice 1.
7. **Edit dialog** (`MapItemFormDialog.tsx`): wrapper keyed by `item.builtinKey` (as `DeviceTypeFormDialog.tsx:39-41`);
   `EntityFormDialog` title `mapItemsCopy.form.title`, submit `kitCopy.save`. Submit: `patchFrom` → unchanged: close;
   invalid: `error = mapItemsCopy.fieldErrors[field]`; needsConfirm: `error = mapItemsCopy.form.confirmFirst`; patch:
   `api.patch` → `settleMapItem` → done (`onDone`) or `error` (values kept). `MapItemFormFields` (pure, props
   `{ item, form, groups, onChange, onReset }`):
   - key as read-only text; `DialogField` name (`maxLength` 60) and group (`maxLength` 40, `list` → a `<datalist>`
     of the existing group names);
   - show-in-palette: a checkbox `mapItemsCopy.form.shown` with hint `form.hideHint` ("Hiding only removes it from
     the Add items palette; placed copies stay on the map."); for `kind === "chair"` no checkbox, `form.chairNote`;
   - size `fieldset`/`legend` "Size (tiles)": fixed → read-only `w × h` + `form.fixedReason[kind]` (seat: "Fixed by
     the seat footprint and device slots", floor: "Floor tiles are always 1 × 1", chair: "The chair size is fixed");
     else two `DialogSelect`s (1–4 from `MAP_ITEM_LIMITS`), the current value shown as `w × h`, hint
     `form.inUseHint` ("A size change is refused while the item is placed in any room."), and for directional items
     `form.rotationHint` ("Size at rotation 0; east and west swap width and height."). When `resizeEffects` > 0: a
     warning paragraph `form.resizeWarning(images, sprites)` and a checkbox `form.confirmResize`;
   - a `type="button"` "Reset to library defaults…" (`disabled` when `isLibraryDefault(item)`) calling `onReset`.
8. **Reset dialog** (`ResetMapItemDialog.tsx`): shape of `DeleteDeviceTypeDialog.tsx`; `ResetMapItemBody({ item })`
   lists the library values from `libraryItem` (name, group, `w × h`), "shown in palette", custom images deleted
   (count of `hasImage`), package sprites cleared, and `reset.inUseNote` only when the library size differs from
   the current one. Submit `api.reset(key)` → `settleMapItem` → done or inline error (409 `item_in_use` with the room
   count, 409 `item_name_taken`).
9. **Copy** (`src/ui/copy/mapItems.ts`): `noAccess`, `intro`, `list.{ empty, hidden, fixed }`, `edit`,
   `editLabel(name)`, `form.*` as above, `fieldErrors.{ name, group, w, h, hidden, body }`, `errors.inUse(n)`
   ("This item is placed in 1 room. Remove it from that room before changing its size." / "… in N rooms. Remove it
   from every room …"), `reset.*`. Sizes are written `w × h` (U+00D7) everywhere.
10. **Checks.** The five Checks of `loop.config.md`. `pnpm test:db` locally exactly as SIM-039.1 plan step 11
    (`/home/user/simap/work/tickets/SIM-039.1/plan.md` l.294-310): throwaway PostgreSQL 16 cluster under a
    `mktemp -d` dir, `127.0.0.1`, port 55432, trust auth, `DATABASE_URL` passed inline only (never read or write
    `.env*`), `pnpm migrate && pnpm test:db`, stop and delete the cluster. No DB code changes here, so a failure that
    also fails on the base commit (e.g. the known `handoffs.db.test.ts` ones, 039.4 A11) is recorded, not fixed.

Rules: R1 — UI imports only `@/lib/**` and `../`/`./` within `src/ui`; the page file imports `@/ui`; `pnpm
check:layers`. R3 — no config. R4 — only the files above; spec/ticket wording follow-up recorded, not edited. R5 —
tests above. R6/R7 — no server change; `apiFetch` already re-sends once on 401/403, so no manual retry (the 039.2
handlers refuse auth before any side effect). D36 — all copy in `src/ui/copy/mapItems.ts` (+ shell nav/page labels).

## Specialist input used
`consult-frontend-developer.md`:
- Findings "Existing pieces" (extend `errorCode` for `rooms`, `useList`/Device types page shape, reuse
  `EntityFormDialog`/`DialogField`, `kitCopy.save`): **adopted**. `ApiErrorBody` types `rooms?: number`
  (`src/lib/api/error.ts:68`), so `rooms` is a count, not a room list: room links via `roomEditorHref` **rejected**
  (no data).
- Nav (`mapItems`, `/map-items`, admin, rail, labels, `nav.test.ts`, page file): **adopted**; icon `category` is taken
  by Device types, so `chair` is added to `icons.ts`.
- No reorder, Hidden badge, groups as headings in name order, datalist for group, disabled size for `fixedSize`,
  1–4 limits: **adopted** (fixed size as read-only text with a reason, per UX).
- Rec 1-4 (page/view/form split, pure form module, one PATCH with changed fields, in-use alert, reset 409): **adopted**
  for slice 1; "Customised" badge **deferred** to slice 2 (it is about art).
- Rec 3 "reload vs patch locally": **reload** chosen; the dialog closes on success, so nothing unsaved is lost.
- Rec 5-7 (map-specific image copy, image methods/cache, sprite browser): **deferred to SIM-039.9**.
- Rec 8 tests: **adopted** for slice 1 parts. Rec 9 split: **adopted** (6a/6b).
- Risk "custom image invalidated on resize": answered from SIM-039.2 plan l.95-97 (images nulled, non-fitting sprites
  cleared, no 422) → warning + confirm.
- Risk "hide only removes from the palette": **adopted** as hint copy (LAY-07 confirms it).

`consult-ux-architect.md`:
- 1 (reorder conflict): **adopted**, flagged above. Group order: name order (039.1 A1 l.369-370).
- 2 (Device types pattern, no New/delete): **adopted**.
- 3 (nav after deviceTypes, own block, labels): **adopted**; `AppShellView.test.tsx` needs no edit (it asserts no
  nav count).
- 4 master-detail side panel / `?item=` route: **rejected for slice 1** in favour of a modal `EntityFormDialog`
  (matches Device types; slice 1 fields fit it). Slice 2 may add a separate wide art dialog (A5). Section order,
  read-only key, datalist, chair has no switch: **adopted**. Explicit Save for details, immediate calls for reset:
  **adopted**.
- 5 size: read-only with reason for fixed items, two-layer in-use (pre-Save warning + explicit confirm when images or
  sprites would be removed; 409 count after): **adopted** (confirm = checkbox, A3). Client validation with the shared
  validator: **adopted** (`validateMapItemPatch`).
- 6-7 art panels, sprite browser: **deferred to SIM-039.9** (its open points listed in Split proposal).
- 8 reset: confirm dialog listing changes, in-use note, inline `item_in_use`/`item_name_taken`, disabled when default:
  **adopted** (default computed client-side from `libraryItem`, no DTO flag exists).
- 9 errors: list states, inline dialog errors, copy in `mapItems.ts`: **adopted**; field-level `aria-describedby` on
  each input **simplified** to the dialog's `role="alert"` error line (existing kit pattern), A7.
- 10 a11y: `h1`/`h2`, `fieldset`/`legend` for size, text badges, `aria-label` with the name, native `<dialog>` focus
  handling: **adopted**. `role="switch"` **replaced** by a native checkbox (same semantics, no custom widget);
  discard-unsaved-changes confirm **not added** (Device types has none; A6).
- 11 layering, `src/ui/index.ts` export, no proxy change needed (`src/proxy.ts` has no route list): **adopted**.

## Assumptions
For Ming at the plan-approval gate (each reversible; the consultants' open questions are resolved here):
- **A1 No reorder** (D67 1 over the ticket and LAY-07 wording; see the flagged conflict). Groups and items in name
  order. (FE Q1, UX Q1.)
- **A2 Edit surface = modal dialog** per item, like Device types, closing on Save and reloading the list (FE Q2: the
  routes do return `MapItemDto`, but a reload keeps one code path). Alternative: side panel or `/map-items?item=`
  route. (UX Q2.)
- **A3 Resize confirm = a checkbox** in the size section, required only when the resize would delete custom images or
  clear package sprites (both, per SIM-039.2: images always, sprites only when they no longer fit; no 422). Without
  them, a resize needs no confirm. (FE Q4, UX Q3a.)
- **A4 In-use message shows the room count only** (`rooms` is a number, `ApiErrorBody`); no room names or links.
  There is no "placed in N rooms" in the DTO, so the 409 is the only in-use signal; a static hint says resizes are
  refused while placed. (FE Q3, UX Q4.)
- **A5 Slice 2 (SIM-039.9) adds an "Art" button per row** opening its own wider art dialog (per-direction panels,
  sprite browser, upload/remove), so slice 1's dialog stays small. Direction labels there: North / East / South /
  West (spec uses n/e/s/w), proposed for 039.9 (UX Q3b). No confirm on "Remove custom image", confirm on reset
  (UX Q5, adopted here for reset).
- **A6 Reset from the edit dialog drops unsaved form edits**; no discard-changes confirm (Device types has none).
- **A7 Errors show in the dialog's `role="alert"` line** (EntityFormDialog), not per field; values stay.
- **A8 "Is default" is computed client-side** from `libraryItem()` (039.1 A8), so the Reset button is disabled for an
  untouched item. (FE Q5, UX 8.)
- **A9 Show/hide is offered for every item except `chair.office`**, floors and `desk.single` included (039.2 A4/A5).
  Not verified: the editor's floor tool may not read `hidden` (`catalogPalette` lists seat and fixture only,
  `src/lib/layout-editor/palette.ts:46`); hiding a floor then changes nothing visible. Not fixed here (R4).
- **A10 Nav icon `chair`** (new entry in `icons.ts`), placed right after Device types (UX Q6). `groups` (D65) does
  not affect placement.
- **A11 Size of slice 1:** about 480 product lines (api +40, state ~60, form ~70, page ~60, view ~100, form dialog
  ~140, reset dialog ~60, copy ~60, nav/shell/icons/index/page ~20) and ~400 test lines. Slightly above the 400-line
  guide, mostly JSX and copy; if the reviewer finds it too large, the reset dialog moves to SIM-039.9 with no other
  change.
- Hotspots: no open ticket (IN_PROGRESS / REVIEW / DONE) edits these files. SIM-037.8 (ticket's nav note) is MERGED,
  so the nav conflict no longer applies. SIM-037.6 (PLANNING, device detail page) may add a line to
  `src/ui/index.ts` and a route under `src/app/(app)/`: trivial rebase. SIM-039.8 (BACKLOG) will edit
  `src/ui/mapItems/map-items-api.ts` (`getImage`), which this ticket restructures with `call`: whichever lands second
  rebases.
- SIM-039.7 (BACKLOG, depends on SIM-039.6) wants a package sprite picker for device types; that picker is slice 2.
  Proposed: SIM-039.7 depends on SIM-039.9 instead.

## Blocking questions
None.

## Split proposal
Whole ticket ≈ 950-1,050 product lines (slice 1 ≈ 480; art ≈ 500: per-direction art dialog ~180, sprite browser with
atlas frame canvas ~150, map-item image check + specific copy ~60, image cache/hook ~60, API methods ~40, copy ~40),
so it is split as both consultants propose:
- **Slice 1 = SIM-039.6 (this plan):** page, nav, grouped list, rename / regroup / show-hide / size editor with the
  in-use warning, reset, API client `patch`/`reset`. AC 1 (except art), AC 2, AC 3.
- **Slice 2 = new ticket SIM-039.9 "Map items page: art per direction"** (P1, M, ui + ux, depends on SIM-039.6 and
  SIM-039.8 for the shared item image cache, gate plan-approval). Scope: an "Art" action per row; per-direction
  panels (n/e/s/w for directional items, `s` only otherwise) showing the active source as text (custom image /
  package sprite / library) with previews at 1× and 2× (LAY-07, pixelated); "Choose package sprite" browser filtered
  by `spriteAllowedFor` + `spriteFits` with a confirm step and text-only fallback if the atlas fails; "Use library
  sprite" (PUT art `{ sprite: null }`); "Upload image" with a client precheck (`parsePng`, 64 KB,
  `mapItemImageFits`) and the exact expected `W × H` (or `W × H…H+32`, floors 32 × 32) for that direction; "Remove
  custom image"; map-item-specific copy for `image_too_large` / `image_bad_size` / `image_not_png` (039.4 A8);
  `image_changed` reloads the item; `images_unavailable` / `drive_error` shown only in the art panel; blob URLs keyed
  `key|dir|imageVersion` and revoked on unmount; a "Customised" row badge and a row thumbnail. AC: "Every art action
  from 039.2/039.4 is reachable and shows its errors inline; images never rotate to fill another direction; checks
  green."
