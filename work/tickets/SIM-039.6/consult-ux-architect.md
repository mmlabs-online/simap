## Findings

Sources: the SIM-039.6 ticket, spec LAY-07, D66/D67/D68, the Device types UI, `src/lib/nav.ts`, and the SIM-039.2 and SIM-039.4 plans. I did not read the 039.1 catalog read API or `src/ui/copy/shell.ts` in full.

1. **Spec and ticket conflict on reorder (flag it).**
   - The ticket scope says "reorder", and LAY-07 says "order (within its group; groups are ordered too)" and "reorder items and groups".
   - D67(1) says items are listed alphabetically by name, so there is no reorder. SIM-039.2 has no reorder endpoint (PATCH rename, regroup, hide, resize; PUT art; POST reset).
   - D67 is newer and "amends where they conflict", so the page should have no reorder UI.
   - It is not stated how groups are ordered. Check 039.1's DTO and sort before designing the grouped list. Alphabetical by group name is likely. The same applies to the editor's "Add items" palette.

2. **Closest pattern: Device types.**
   - The structure is `DeviceTypesPage` (client component with tier gate, `useApiFetch`, `createXApi`, `useList`, dialog state) → pure `DeviceTypesView` (props only) → `ListSection` rows → `DeviceTypeFormDialog` and a delete dialog.
   - The page gates on `canManageDeviceTypes(session?.tier)`. Below Admin it renders a `role="alert"` no-access card and mounts no data hook.
   - The image field is a pure component with a `view` model, an `error` prop and `role="alert"` errors linked by `aria-describedby`. It has a thumb, a choose/replace label with a visually hidden `<input type=file accept=image/png>`, remove and undo buttons, a hint, and a pending-remove note.
   - Map items are not created or deleted (D66, D67), so the list has no "New" button and no delete.

3. **Nav.**
   - Add `mapItems` to the `NavId` union and `NAV_ITEMS`. Use `href: "/map-items"`, `minTier: "admin"`, `placement: "rail"`, placed directly after `deviceTypes`.
   - Add the label in `shellCopy` nav (`satisfies Record<NavId,string>` forces it) and a `pages.mapItems` entry.
   - Pick an icon that exists in `./icons` (for example `widgets` or `layers`, whichever the icon set has). `category` is already used by Device types.
   - SIM-037.8 also edits `nav.ts`, so expect a small conflict. Put the entry in its own block to keep it small. Update `nav.test.ts` and `AppShellView.test.tsx`.
   - `isActive` uses a `startsWith(href + "/")` match, so `/map-items` does not clash with other routes.
   - Page title: "Map items" (spec wording). Keep "Device types" and "Map items" adjacent as the two catalog pages. A short page subtitle can say that "Add items" in the room editor follows this page.

4. **Information architecture for the page.**
   - Use master-detail rather than a dialog. A dialog would be overloaded by the per-item editor: size, 4 directions, the sprite browser, previews and reset.
   - **List (master).** Group sections with an `h2` per group, ordered per Finding 1. Each row has a thumb (the current art, `s` direction, decorative alt=""), the name, the library key in muted text, a `w × h` chip, a "Hidden" badge, and an "Edit" button with an `aria-label` that includes the name, as `editLabel` does.
   - **Editor (detail).** At desktop widths it is a side panel. At 390 px it is a full-screen dialog or sheet. A route like `/map-items?item=<key>` gives back-button support and a deep link, but it needs `Suspense` for search params in Next 16. A modal state is simpler and matches the existing pattern. Planner decision.
   - Editor sections in order:
     1. Identity: key (read only), name (max 60), group (max 40, with a datalist of existing groups so groups are not mistyped).
     2. Visibility: a "Show in palette" switch. `chair.office` shows no switch, since it is non-placeable and 039.2 returns 422 for `hidden: true`.
     3. Size: `w` and `h` number inputs (1–4), always shown as `w × h`.
     4. Art: one panel per direction.
     5. Reset to library defaults.
   - Save model: an explicit Save for name, group, hide and size (one PATCH), as in the form dialog. Art and reset are immediate actions, each its own call, because each has its own server effect and errors.
   - After an immediate action, apply the returned `MapItemDto` to the list row and the editor. Do not reload the whole list, which would lose the editor's unsaved fields. Be careful with a stale form after a reset: re-seed the form from the DTO.

5. **Size editor.**
   - Fixed-size items (`desk.single`, `chair.office`, `floor.*`) show `w × h` as read-only text plus a short reason ("Fixed by the seat footprint and device slots", "Floor tiles are always 1 × 1"). Do not use a disabled input with no explanation.
   - **In-use warning (OQ-52).** The client cannot know whether an item is placed unless the DTO exposes it. The server refuses with 409 `item_in_use` and `rooms`. So there are two layers:
     - Before Save, when `w` or `h` differs and the item has any custom image, show a non-blocking warning: "Changing the size removes this item's custom images (N)." Require an explicit confirm, either a confirm step or a checkbox. Both are acceptable, but state which in the plan.
     - After a 409, show the inline error with the room count and the "remove from every room first" text from `api.ts` copy. Keep the form values.
   - It is not stated whether sprite picks also reset on a resize. In 039.2 a resize nulls the images. Check whether it also nulls the sprites, so the warning is accurate.
   - Only enable Save when something changed. Validate 1–4 integers on the client with the same rule as the server (a shared `src/lib/validate` function).

6. **Art per direction.**
   - Directional items get four panels: n, e, s, w. Label them "North/East/South/West" or "Back/Right/Front/Left". Pick one and make the label match what the map shows. Non-directional items get a single panel, `s` only, labelled "Image". The UI must never send n/e/w for these (422 `not_allowed`).
   - Each panel shows a preview at 1× and 2× (LAY-07), `image-rendering: pixelated`, on a tile-grid background so the overhang and footprint are visible. Show the active source ("Custom image", "Package sprite: <name>", "Library default"), following the fallback order custom → package sprite → library frame → placeholder. Show it as text, not colour alone.
   - Actions per panel: "Choose sprite…" (opens the browser), "Upload image…", "Remove custom image" (DELETE, enabled only if `hasImage`), and "Use library sprite" (PUT `{sprite:null}`, enabled if a sprite is set).
   - The effective preview is the highest-priority source that exists. Show a hint that one image is never rotated to fill another direction.
   - **Custom image fetching.** Images are fetched with the bearer from `GET /api/map-items/<key>/art/<dir>/image` and displayed as blob object URLs. Reuse the `useDeviceTypeImages` and `image-url-cache` approach, keyed on `imageVersion` so an upload refreshes the preview. Revoke URLs on unmount.
   - **Upload hints, before the upload.** State the exact required size per direction: "PNG, 32·w × 32·h px (or up to 32 px taller), max 64 KB". Floors must be exactly 32×32. Show the numbers computed from the current size and direction (swap w/h rules do not apply, since n is stored at rotation 0; check how e/w dimensions are defined in `mapItemImageFits`).
   - Do a light client precheck (type, size ≤ 64 KB, PNG dimensions) for fast feedback, but treat the server as the authority. A shared pure validator in `src/lib/` keeps the precheck in sync, like `device-type-image.ts`.
   - Server errors (`image_not_png`, `image_too_large`, `image_bad_size`, `image_changed` 409, 502/503 Drive) go inline in that panel via `role="alert"`, with `api.ts` texts. On 409 `image_changed`, reload the item (it was resized or reset elsewhere).
   - Disable the whole panel while a call for it is in flight, so two uploads cannot race.
   - There is no undo for upload or remove, because they are immediate. A confirm is optional for "Remove custom image". Skip it (the fallback is visible straight away), but make the result obvious.

7. **Package sprite browser.**
   - A dialog or popover per direction. The grid contains only candidates the server would accept, to avoid 422 `sprite_not_allowed`: the same group/layer, and the frame must fit the item's size for that direction. Put the filter rule in a pure `lib` function shared with the server where possible. The server remains authoritative.
   - Show a search box, tiles with the sprite name, an "in use" mark, and a larger preview of the selected sprite with its size. The atlas is `public/sprites/office.png/json`, and the browser needs it at runtime. Reuse the editor's existing atlas loader (`src/ui/roomlayout`) rather than a new fetcher.
   - Render with a CSS background-position on the atlas, or a canvas, with pixelated scaling.
   - Selecting a sprite does not apply it until "Use this sprite" is pressed, so the preview step is real.
   - A grid of buttons with an accessible name, a `radiogroup` or `listbox` pattern, arrow-key navigation and a roving tabindex works well. At minimum each tile is a `<button>` with `aria-pressed`. If the atlas is large, virtualize or paginate.
   - Package credits (D45) live on the Credits page. A small "Art: <pack>" link is optional.

8. **Reset to defaults.**
   - A confirm dialog is required, because reset is destructive: it removes custom images and drops sprites, name, group, size and hide state.
   - Its text should list what changes. Predict an `item_in_use` refusal in the text: "If the library size differs from the current size and the item is placed, reset is refused."
   - Handle 409 `item_in_use` (with `rooms`) and 409 `item_name_taken` (another item holds the default name) inline in the dialog.
   - Disable the button when the item already equals its defaults. Needs a DTO flag or a client comparison against the library definition; check the DTO.

9. **Error states.**
   - List: loading skeleton or status text, load error with Retry (as `ListSection` does), forbidden card for non-Admins (as Device types), and an empty state, which should not occur because the catalog is seeded. Show a "catalog not ready" message if empty.
   - Editor: field-level errors (`item_name_taken` on name, 422 validation on name/group length and size), top-level save error with `role="alert"`, and a 503 `unavailable` message (Drive off). Drive off blocks uploads only, so keep sprite picks, rename and the rest working and show the 503 text only in the art panel.
   - Map each error code to `src/ui/copy/api.ts` text via the existing error mapper; do not hard-code strings in components (D36: copy in `src/ui/copy/mapItems.ts`).
   - R7: the 401/403 re-send in `apiFetch` is fine here because the handlers refuse before side effects.

10. **Accessibility.**
    - Landmarks and headings: `h1` page title, `h2` per group, `h2` or `h3` for editor sections. Use a `fieldset`/`legend` per direction.
    - Every `aria-label` includes the item name and direction ("Upload image for door, east").
    - The hide switch is `role="switch"` with `aria-checked`. Previews have meaningful alt text or are marked decorative next to a text label.
    - Dialogs trap focus, restore focus to the opener, and close on Escape. Unsaved changes get a discard confirmation.
    - Errors are announced (`role="alert"`) and tied to inputs with `aria-describedby` and `aria-invalid`. Do not put errors on disabled controls only.
    - The hidden file input is `sr-only`, and its label needs `focus-within` styling, as in `DeviceTypeImageField`.
    - Use real text for state, not just colour (Hidden, Fixed size, Custom image). Touch targets should be at least 44 px at 390 px width.
    - Respect `prefers-reduced-motion`, and keep previews usable with the keyboard.
    - Use a live region for "Saved" and "Image removed".

11. **Layering (R1).**
    - Page code in `src/ui/mapItems/**` imports only `@/ui`, `@/lib`, and the shared `@/lib/map-items` library definitions and DTO types. It never imports `src/server/**`.
    - The route `src/app/(…)/map-items/page.tsx` follows how `device-types/page.tsx` is mounted. Check for any route list or middleware (`src/proxy.ts`) that needs the new path.
    - Export from `src/ui/index.ts`, as Device types is.

## Recommendations

- R-A: No reorder UI. Follow D67 and flag the spec/ticket mismatch in the plan, and ask Ming to confirm the LAY-07 and ticket wording is stale (AC: scope).
- R-B: Master-detail with an editor panel or sheet, with Save for text/size/hide and immediate actions for art and reset (AC 1).
- R-C: Per-direction art panels with source label, 1×/2× previews, and exact size hints computed from the current size (AC 1, LAY-07 custom image rules).
- R-D: A sprite browser with a pre-filter on the same rules as the server, plus a confirm step (AC 1).
- R-E: A two-layer in-use warning: a client warning before a resize that will remove custom images, and server 409 `item_in_use` with the room count inline (AC 1, OQ-52).
- R-F: A read-only `w × h` with a reason for fixed-size items. No hide switch for `chair.office`. Non-directional items show only `s` (AC 1).
- R-G: A confirmed reset dialog with specific inline refusals.
- R-H: Nav: `mapItems` after `deviceTypes`, admin tier, rail, with copy and tests. Hiding is UX only; the page also gates on `session.tier` and the API enforces it (AC 2).
- R-I: Copy in `src/ui/copy/mapItems.ts`; reuse `ListSection` where it fits (it assumes a "New" action, so check that it can hide it, or write a small grouped list).
- R-J: Tests: pure view tests (`MapItemsView.test.tsx`), a form-state reducer test, a sprite-filter test, an image-field view test, `nav.test.ts`, and an API client test. Manual: the 390 px and desktop paths for the keyboard flow, upload errors, resize with images, reset, and a non-Admin visit.

## Risks

- The DTO may not expose what the UI needs: an "in use" flag or room count before saving, "is default" for reset, and the effective source per direction. If it does not, the UI has to rely on the 409 for in-use and recompute the rest from `libraryItem(key)` in `lib`. Check the 039.1 DTO (`MapItemDto`, `art[dir].hasImage/imageVersion`, `sprite`).
- A stale editor after a 409 `image_changed` or a concurrent admin edit. Reload the item and keep the unsaved text.
- Blob URL leaks and flicker on art updates, if the cache is not keyed on `imageVersion`.
- The sprite browser could be heavy if the atlas has hundreds of frames. Filter first, and paginate or lazy-render.
- Nav conflict with SIM-037.8. The ticket's parallel run with SIM-037.x may also touch `src/ui/index.ts`.
- The spec says a sprite must "fit the item's size for that direction". If the client filter diverges from the server, users see a 422 `sprite_not_allowed`. Keep one shared function in `lib`.
- Custom image previews depend on Drive being configured. Drive off gives 503 on upload only.
- A mid-flight resize while an upload is in progress is refused by the server's compare-and-set. This is only an edge case for the UI, but it must show a clear message.

## Open questions

1. D67 (alphabetical, no reorder) vs the ticket/LAY-07 "reorder items and groups": confirm that reorder is dropped, and how groups are ordered. The spec text should be fixed. Spec wins per CLAUDE.md, but D67 is newer.
2. Editor surface: modal dialog (matches Device types), side panel, or `?item=` route?
3. Does a resize also clear package sprite picks, or only custom images? Which direction labels should show: N/E/S/W or friendly names?
4. Does the DTO give the page "placed in N rooms" in advance (to disable or warn on size before Save), or is the 409 the only signal?
5. Is confirm on "Remove custom image" wanted? I recommend not, and a confirm for reset.
6. Which nav icon, and should `groups` hidden status (D65) affect nav placement? It does not.
