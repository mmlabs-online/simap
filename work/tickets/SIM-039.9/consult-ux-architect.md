## Findings (current Map items page, src/ui/mapItems)

- Structure today: `MapItemsPage` holds a `Dialog` union (`none | edit | reset`). `MapItemsView` is a pure component. Each row has name, key, `w × h` badge and Hidden/Fixed badges, plus one Edit button. `MapItemFormDialog` and `ResetMapItemDialog` both wrap `EntityFormDialog`. Its props are `open/title/submitLabel/submitting/error/onClose/onSubmit`, and it is a form with one submit.
- `map-items-api.ts` has only `list`, `patch`, `getArtImage` and `reset`. It still needs `putArtSprite(key, dir, sprite|null)` (PUT `/art/{dir}`, JSON `{sprite}`, returns the DTO), `putArtImage(key, dir, bytes)` (PUT `/art/{dir}/image`, `image/png`, returns the DTO) and `deleteArtImage` (DELETE, 204 with no body). The existing `json` reader fits the first two. DELETE needs its own reader, because `res.json()` on a 204 would throw and become `internal`.
- `useMapItems.ts` is not used by the page. The page uses `useList(api.list)` instead, so the hook is dead code. Don't build on it.
- Server behaviour the UI must match:
  - `setMapItemArt` returns 422 `not_allowed` for a direction the item doesn't allow, and 422 `sprite_not_allowed` for a sprite that is not allowed or doesn't fit. It is idempotent when the sprite is unchanged.
  - The image PUT returns 422 `image_too_large`, `image_not_png` or `image_bad_size`, or 409 `image_changed`. Drive failures arrive as `images_unavailable` or `drive_error`.
  - The image GET is `tier: "user"` with ETag and `private, no-cache`.
- Server fallback order is custom image, then package sprite, then library. A sprite choice is stored even while an image exists. The "active source" text must follow that order, not just the last action. If `hasImage` is true and `sprite` is non-null, the active source is the image, and the sprite is "set but hidden by the custom image". Show that line, otherwise "Choose package sprite" looks like it did nothing.
- Copy gap in `src/ui/copy/api.ts` (lines 63-65): `image_bad_size` and `image_too_large` say "square, 24 to 100 px" and "N KB" for device types. They are wrong for map items. Add map-item copy in `src/ui/copy/mapItems.ts` and have the art panel use it instead of `apiErrorMessage`. `image_bad_size` should name the exact expected size for that direction. `sprite_not_allowed`, `image_changed`, `images_unavailable` and `drive_error` already exist in `api.ts`.
- Reusable pieces:
  - `src/ui/deviceTypes/image-url-cache.ts` is generic (`ImageEntry` already mentions `itemImageId`). `checkImageFile` in `device-type-image.ts` is device-specific (it uses `validatePng`/`IMAGE_LIMITS`), so write a map-item version with `parsePng`, `MAP_ITEM_LIMITS.imageBytes` and `mapItemImageFits`, and keep the `read_failed` code.
  - `useAtlas()` and `loadAtlas` in `src/ui/roomlayout` give the atlas image and manifest, with `failed`.
  - The pure helpers `spriteAllowedFor`, `spriteFits`, `artDirAllowed`, `sizeFor`, `frameTiles` and `mapItemImageFits` are in `src/lib/map-items/art.ts`.
  - `FRAME_KEYS` and `REGISTRY` are in `src/lib/sprites/registry.ts`.
  - `src/ui/roomlayout/useCatalogImages.ts` and `catalog-images.ts` already cache map-item blobs for the map. Check whether `useCatalogImages` can be reused instead of a second cache, and keep one cache per page.

## Recommendations

1. **Dialog placement.** Make "Art" a separate dialog, not part of the edit form. Add `{ kind: "art"; key: string }` to the page's `Dialog` union.
   - `EntityFormDialog` is a single-submit form. The art panel has many independent actions that each save at once, so it doesn't fit that shape.
   - The "Art" button sits beside Edit in the row (secondary, `icon="image"`, `aria-label={artLabel(name)}`).
   - The art dialog needs a Close button instead of Save/Cancel. If `EntityFormDialog` can't hide the submit, use the underlying dialog primitive.
   - Store the key, not the item, in the dialog state, and derive the item from the reloaded list. Otherwise the dialog shows stale `art` after every action. This is a bug in the current `edit` state, which stores the item object, and it must not be copied.
   - After each successful action, replace that item in the list from the returned DTO (add a `replaceItem` helper in `map-items-state.ts`, or reload). Keep the dialog open.
   - Don't offer art actions from inside the edit dialog. Instead, add one line there ("Art is set from the Art button") only if a user would look for it. Resizing wipes images, and the existing resize warning already covers that.
2. **Per-direction panels.** Use a `<fieldset>` per direction with a legend such as "North (n)". Use all four for directional items and only `s`, titled "Image", otherwise.
   - Each panel holds:
     - the source text, one of "Custom image", "Package sprite: <key>" or "Library sprite", with a second line when a sprite is set but overridden by an image;
     - the expected size line, e.g. "Image size: 64 × 64 to 64 × 96 px" (`sizeFor` plus overhang), or "exactly 32 × 32 px" for floors;
     - the previews;
     - three buttons: Choose package sprite, Upload image, and Remove custom image (rendered only when `hasImage`) or Use library sprite (disabled when `sprite` is null and there is no image).
   - Use "Use library sprite" rather than a second control for clearing the sprite. Clear the sprite only. A custom image stays until it is removed, so label the buttons exactly and say so in a hint.
   - The ticket scope says images never rotate to fill another direction. Show no "copy to other directions" shortcut, and say in the panel hint that each direction needs its own art.
3. **Previews at 1× and 2×.** Draw both in a CSS box with `image-rendering: pixelated`, at the natural size and at double it, each with a visible caption ("1×", "2×"). Give each one an `alt` that names the source, for example "North, custom image, 1×". Put the 2× next to the 1× inside a scroll container, because the largest image is 128 px wide times 2.
   - For a package sprite, draw from the atlas with a `<canvas>` or a background-position crop. If the atlas is not loaded or failed, show a text-only line ("Preview unavailable"). Don't leave an empty box.
   - For a custom image, use a blob URL from the cache. If the blob fetch fails, show "Preview unavailable" inline in that panel only.
   - For a library sprite, preview from the atlas if the library frame is known. The "Customised" badge in the row is a presentation of `art` with any `hasImage` or non-null `sprite`.
4. **Sprite browser.**
   - A nested dialog or an inline expand? Prefer an inline expand inside the panel (a `role="group"` region labelled "Package sprites for North"). A second modal over a modal causes focus-restore problems with the existing dialog primitive.
   - If the dialog primitive supports nesting, a separate modal is acceptable. Either way, return focus to the "Choose package sprite" button on close.
   - Filter the list with `FRAME_KEYS.filter(k => spriteAllowedFor(item, k) && spriteFits(k, dir, item.w, item.h))` and a text search on the key, which is a client-side filter only. Show a count ("37 sprites") in a `role="status"` region, and an explicit empty state ("No package sprite fits this size").
   - Implement it as a single-select radio group, `role="radiogroup"` with native `<input type="radio">` per frame, or a listbox. Arrow keys move the selection and Enter or Space picks. Don't use 100+ tab stops.
   - Every tile has a visible text label (the key), so it works without the atlas. If the atlas fails, show only the text list, as the scope requires.
   - Selecting a sprite doesn't save. Show the confirm step: a larger preview, the sprite key, its tile size against the item's tile size for that direction, and "Use this sprite" / "Cancel". Only then call `putArtSprite`.
   - A frame smaller than the item draws bottom-left aligned (OQ-53), so say that on the confirm step when `frameTiles` is smaller.
   - The sprites in the list are paged or virtualised only if the count passes about 200. Check `FRAME_KEYS.length` first, and otherwise render all.
5. **Upload.**
   - Use a hidden `<input type="file" accept="image/png">` behind a real button (`ref.click()`), not a drop zone. Reset `input.value` after each pick so the same file can be chosen again after a fix.
   - Precheck order: size over 64 KB (without reading), then read, then `parsePng` (not a PNG or APNG), then `mapItemImageFits`. Give a separate message for each:
     - `image_too_large`: "Image is larger than 64 KB."
     - `image_not_png`: "This file is not a valid PNG image (animated PNGs are not allowed)."
     - `image_bad_size`: "This image is 40 × 40 px. North needs 64 px wide and 64 to 96 px tall."
     - `read_failed`.
   - Show the actual size in the bad-size message. The precheck is a convenience only. The server re-checks, and its 422 maps to the same messages.
   - Disable all four panels' buttons while any request is in flight (one `busy` state for the dialog). Show "Uploading…" in the panel that started it.
   - "Remove custom image": use a direct action with an inline "Undo not available" hint, or a two-step confirm (button turns into "Confirm remove / Cancel"). Prefer the two-step confirm, since the file goes to Drive and can't be restored.
6. **Inline errors.** Keep one error slot per panel (`role="alert"`, in the panel the action started from), not one for the dialog.
   - `images_unavailable` and `drive_error` appear only in the panel, per the ticket. Don't show them as page errors. An error clears when the panel starts a new action.
   - On `image_changed` (409), show "changed by someone else" and reload the list so the panel shows the newer state. Don't retry the upload automatically.
   - On `not_found`, close the dialog and reload (the existing `settleMapItem` treats it as done).
   - Access errors such as `unauthenticated` map through the existing `mapItemErrorMessage` path. Reuse `settleMapItem` for the sprite call. The image calls need an image-specific mapper, because `apiErrorMessage` has the device-type wording (see the copy gap above).
7. **Blob URLs.** Use one `createImageUrlCache` at page level (not per dialog), with entries keyed `key|dir|imageVersion`. It revokes URLs for versions that go away and on `dispose()` at unmount. The row thumbnail uses the `s` image (or the first direction with an image, for directional items), so the cache has to be on the page for the rows to show it. Rows with only a sprite use an atlas crop, or show no thumbnail if the atlas is missing.
   - `apiFetch` bearer GET is needed for the image because a plain `<img src>` can't send the bearer token. This is why blobs are required.
8. **Accessibility.**
   - The dialog needs a title naming the item ("Art for Desk single"), a focus trap and Escape to close. On close, return focus to the row's Art button. The row button is re-rendered after reload, so focus it by `data-key` rather than by a stale ref.
   - Do not rely on colour for the active source, and keep the source as text. Selected sprite: `aria-checked` plus a visible ring.
   - Previews are decorative duplicates of the source text, so give them empty `alt` text only if the text beside them already states the source. Otherwise give them a descriptive `alt`.
   - Announce success ("Image saved for North") in a polite live region, since the panel re-renders.
9. **Tests (R5).** Add pure helpers with unit tests:
   - `artSourceView(item, dir)`, returning `custom | sprite | library | spriteHidden`;
   - `spriteChoices(item, dir, query)`;
   - `expectedImageSize(item, dir)` and `checkMapItemImage(file, item, dir)`, with each message;
   - API methods, including the 204 reader;
   - view tests rendering the panel markup by props (the pattern used for `ResetMapItemBody` and `MapItemFormFields`).
   Cover a directional item with four panels and a non-directional one with only `s`.

## Risks

- Stale dialog data if the item is stored by value (see rec. 1). A second action could then work from an old `imageVersion`.
- Rows with many images may flood the blob cache at page load. The cache already limits to 4 concurrent loads, which is fine.
- `image_bad_size` copy leaking the device-type wording (24 to 100 px square) is a visible bug if the shared `apiErrorMessage` is used.
- A custom image can hide a chosen sprite with no visible change. The "set but hidden" line is necessary.
- A resize (in the edit dialog) wipes images while the art dialog is open in the same session. Keep the two dialogs mutually exclusive, which the single `Dialog` union already does.
- R7: nothing to do client-side, but note `apiFetch` re-sends once on 401/403, so a retried upload can run twice. The server compare-and-set makes this safe (409 `image_changed` on the second attempt), so treat a 409 right after a successful-looking upload by reloading, not by showing an error.

## Open questions

1. Should "Use library sprite" also be offered while a custom image exists, with the text saying the image still wins? Recommended: yes, as above.
2. Does `EntityFormDialog` support a close-only footer? If not, is a small dialog-shell change in scope, or should the art dialog use the lower-level primitive? Check before planning.
3. Is the row thumbnail required for items with only a package sprite (needs atlas crop code), or only for custom images? The ticket text says "a row thumbnail" without saying which.
4. Should the art dialog open the sprite browser inline or as a nested dialog? (Recommended: inline.)
5. `useMapItems.ts` is unused. Remove it in this ticket or leave it? (R4 suggests leaving it and noting a follow-up.)
