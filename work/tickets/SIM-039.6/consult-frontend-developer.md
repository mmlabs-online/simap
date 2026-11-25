## Findings

**Existing pieces**
- `src/ui/mapItems/map-items-api.ts` has only `list()`. It returns `{ok,value}|{ok:false,code}` and never throws. Its private `errorCode()` reads only `error.code`, so 039.6 must extend it to also return `error.rooms` for `item_in_use`. Both PATCH and **reset** return `409 item_in_use` with `rooms` (`reset/route.ts:15`, `[key]/route.ts:17`). I did not check whether `ApiErrorBody` types `rooms`.
- `useMapItems(api, enabled)` already gives status/items/reload. It has no image support.
- The Device types page pattern is `DeviceTypesPage`, which gates on `canManageDeviceTypes(session.tier)` and mounts `DeviceTypesLoaded` only for Admins. The loaded part holds a `Dialog` union state and reloads the list on `onDone`. Copy this shape.
- Reusable pieces:
  - `EntityFormDialog` and `DialogField` from `src/ui/EntityFormDialog`.
  - `kitCopy.save`.
  - `createImageUrlCache` (`src/ui/deviceTypes/image-url-cache.ts`), but it is keyed by type id and uses `t.imageVersion`. It needs a key of `key|dir|imageVersion` or a small generic variant.
  - `DeviceTypeThumb`, `thumbRendering`, `ImageDraft` and `imageFieldView`.
- Not reusable as is:
  - `checkImageFile` and `validatePng` enforce device-type rules (square, 24–100 px, 100 KB). A map item image needs `parsePng` (already used by the route) for width and height. It also needs the 64 KB limit (`MAP_ITEM_LIMITS.imageBytes`) and `mapItemImageFits(item, dir, w, h, px)`.
  - `imageCheckMessage` and `apiCopy` `image_too_large` and `image_bad_size` hard-code device-type text (100 KB, square 24–100). This is the 039.4 A8 gotcha. The route returns `image_too_large` and `image_bad_size` or `image_not_png`, but the generic copy would be wrong for map items.
- Nav: `src/lib/nav.ts` `NAV_ITEMS` needs a `mapItems` id (href `/map-items`, `minTier: "admin"`, rail placement, an existing icon name, e.g. `category` or `dashboard_customize`). It also needs:
  - labels in `shellCopy.nav` and `shellCopy.pages` (`src/ui/copy/shell.ts` lines 44 and 87);
  - an update to `nav.test.ts` (the id list at about line 57);
  - a page file `src/app/(app)/map-items/page.tsx`, mirroring the device-types one.
  SIM-037.8 also edits the nav, so expect a small conflict.
- Sprite browser:
  - `REGISTRY` and `FRAME_KEYS` (`src/lib/sprites/registry.ts`) list the frames. `spriteAllowedFor(item, key)` and `spriteFits(key, dir, w, h)` in `art.ts` filter them, and the filter is pure and testable.
  - Previews need the atlas: `useAtlas`/`loadAtlas` load `/sprites/office.png|json`, then a canvas draws the frame. `paint.ts` has `tintedFrame` and `smoothFor`.
  - There is no existing `SpriteThumb` component. Writing a small canvas frame drawer is new work. `useAtlas` must run client-side only. Unit tests can cover only the frame-filter and grouping logic. Canvas drawing is not testable in the node env, so keep it thin.

**Decisions to honour**
- D66/D67: the list is alphabetical (the API order), so there is **no reorder UI**, even though the ticket scope says "reorder". Flag this ticket-versus-decision conflict. The ticket should be amended and the page should not include reorder (039.1 plan line 340 agrees).
- Admins receive hidden rows, so show a "Hidden" badge and a toggle.
- Groups have no stored order. Render them as headings (`group` string), sorted alphabetically client-side, with items in API order inside each group. Use a datalist or free text for the group field (max 40).
- Fixed-size items (`fixedSize`: seats, floors, chairs) get a disabled `w × h` editor. Their size comes from the library, but the item can still be renamed, regrouped and hidden.
- Size limits are 1–4 (`sizeMin`/`sizeMax`). Non-directional items edit the `s` direction only (`artDirAllowed`). Directional items edit n/e/s/w, where e and w show `sizeFor` swapped dimensions.
- Expected custom-image pixel size per dir, from `mapItemImageFits`:
  - Width is 32 × tw.
  - Height is 32 × th up to 32 × th + 32.
  - Floors are exactly 32 × 32.
  - The limit is 64 KB.
  - The hint must show these numbers for the selected dir.

## Recommendations

1. **Page structure.**
   - Create `src/ui/mapItems/MapItemsPage.tsx` (gate plus loaded split, like device types) and `MapItemsView.tsx` (props only, so it can be tested with `renderToStaticMarkup`).
   - Add `MapItemRow`, `MapItemEditDialog.tsx` and `map-item-form.ts` (pure form, validation and diff-to-patch).
   - Add `src/ui/copy/mapItems.ts` (D36), including inline-error messages.
   - Add `src/app/(app)/map-items/page.tsx` and the nav entry.
   - Rows show a thumbnail, name, `w × h`, a Hidden badge, a "Customised" badge and a hide toggle.
2. **One edit dialog per item** with sections, so every action is reachable and errors show inline (AC1). The sections are:
   - Details: name, group, hidden, and `w × h` (steppers or selects 1–4).
   - Art, per direction (tabs or a 4-row list): shows the current art (a package sprite or a custom image) and offers "Choose package sprite", "Upload image", "Use library sprite" (PUT art `{sprite:null}`) and "Remove custom image" (DELETE image).
   - A "Reset to defaults" footer action with a confirmation step.
3. **Writes.** Name, group, hidden and size go in one PATCH with only the changed fields. Art and image actions apply immediately (each is its own call). Do not stage them, because the server holds the state and there is no draft. After each call, reload the list and keep the dialog bound to the item by `builtinKey`. Alternatively, have the API methods return the updated DTO and patch the list locally (verify what the PUT/PATCH routes return).
4. **In-use warning.**
   - The 409 `item_in_use` has `rooms`. Show an inline alert in the size section naming the room count and the first few rooms (check the room shape in `error.rooms`), plus a link to each room's editor via `roomEditorHref`.
   - The same warning must be handled for reset.
   - The server enforces the block, so no client pre-check is needed. Do not offer a "force" option unless the API has one.
   - Add `item_in_use` rooms count to copy as a function, e.g. `inUse(count)`.
5. **Image errors.** Add map-item-specific copy for `image_too_large` (64 KB), `image_bad_size` (the expected `W × H`, or `W × H–H+32` for non-floors, derived from `sizeFor`) and `image_not_png`. Do not use `apiErrorMessage` for these three. Run `parsePng` and `mapItemImageFits` client-side first so the user sees the message before any upload. Map server `image_changed`, `images_unavailable` and `drive_error` through `apiErrorMessage`. If `images_unavailable` means Drive is not configured, say so in the page.
6. **Image fetch/preview.** Extend `createMapItemsApi` with these methods, all through the same `call`/`ApiAccessError` mapping and the same never-throws result type:
   - `patch(key, patch)`
   - `putArt(key, dir, sprite)`
   - `reset(key)`
   - `getImage(key, dir)` returning a `Blob`
   - `putImage(key, dir, bytes)`
   - `removeImage(key, dir)`
   The image cache is keyed `${key}:${dir}:${imageVersion}`. Fetch lazily for rows with `hasImage` and revoke on unmount.
7. **Sprite browser.** A grid of frames filtered with `spriteAllowedFor` and `spriteFits`, with a text filter by frame key or group and a selected-state ring. Use `role="listbox"` or radio buttons with an accessible name (the frame key). Draw each frame with the atlas on a small canvas (the 039.5 `useAtlas`). If the atlas fails to load, fall back to a text-only list.
8. **Tests (Vitest, node env).** Same style as device types.
   - `map-items-api.test.ts`: each new method's URL, method and body, plus the 409 `rooms` parse.
   - `map-item-form.test.ts`: validation and patch diff, `fixedSize`, and the e/w dimension swap.
   - `map-item-image.test.ts`: check that map-specific messages pick the right text for each failure.
   - `MapItemsView.test.tsx` with `renderToStaticMarkup`: forbidden, loading, error, groups, Hidden badge, disabled size for `fixedSize`.
   - A dialog-props markup test for the in-use alert.
   - `sprite-browser.test.ts` for the pure filter.
   - Extend `nav.test.ts`.
   - Run `pnpm check:layers`, which should pass because the UI imports only `@/lib` and `../`.
9. **Split proposal.** One cycle is feasible but large (about 20 new files). If the planner wants a safe margin, split it as follows.
   - **039.6a**: the page, nav, list/grouping, rename, regroup, hide toggle, size editor with the in-use warning, reset, and the API client writes.
   - **039.6b**: the art section (package sprite browser with the atlas preview, per-direction upload, remove and the image cache).
   The split costs a second PR and review round. I recommend keeping one ticket only if the sprite thumbnail drawing is kept minimal. Given the 039.1 and 039.5 pattern of slices, the 6a/6b split is the safer call.

## Risks
- R7/R6 are already handled server-side. The UI must not retry writes on 401/403 manually (`apiFetch` already re-sends once).
- A custom image uploaded for a size is invalidated if the size changes. Check what the server does (the 039.2/039.4 plan says which). The UI should warn about it or refresh `art` after a PATCH that changes size.
- Stale `imageVersion` and blob URLs leak if the cache is not revoked. A PUT that does not bump the version would show the old image.
- Canvas sprite preview can't be tested in node. Keep the drawing in a small, untested component and the logic in pure helpers.
- A hidden-but-in-use item is still shown on saved layouts (D67 3). The "hide" UI should say that hiding only removes the item from the palette. This is my reading of D67/039.1 and is not verified.
- Nav conflict with SIM-037.8 (small).

## Open questions
1. The ticket scope says "reorder" but D66/D67 say alphabetical. Confirm the scope is amended to "no reorder".
2. What do the PATCH, PUT art and PUT image routes return (the full `MapItemDto`)? If so, the UI can patch locally instead of reloading.
3. What exactly is `error.rooms` (an array of `{code,name}` or ids)? Needed for the warning text and links.
4. When size changes, are custom images and package sprites that no longer fit cleared by the server, or does the PATCH 422 or 409? The UI copy depends on this.
5. Is "Customised" derivable from the DTO (an `art` entry with `sprite !== null` or `hasImage`)? The DTO has no library defaults. `libraryItem()` is in `src/lib/map-items/library` and can be used to compare name, group and size for a "Reset" enabled state.
6. Single ticket or the 6a/6b split?
