# SIM-070 consult (frontend): Item editor, Map items redesign

I read the ticket, `MapItemsView/Page`, the three dialogs, `SpriteBrowser`, `map-items-api`, the pure helpers, `useMapItemImages`, the copy file and the test file headers. I did not open the mockup .webp images, so card and editor layout details are taken from the ticket text only.

## Findings

1. **Today's structure.**
   - `MapItemsPage` holds `Dialog = none | edit | reset | art`. Edit and Reset use `EntityFormDialog`. Art is a hand-rolled native `<dialog>` with its own busy, error, browser and status state.
   - The Art dialog saves **immediately per action** and calls `onReload` after each one. The Form dialog does one PATCH.
   - The new editor needs a **staged model**. Nothing is sent until Save, and Reset stays an immediate action behind its confirm step.

2. **Reusable pure code (keep as is).**
   - `map-item-form.ts`: `formFromItem`, `patchFrom` (returns unchanged, invalid, needsConfirm or patch), `resizeEffects`.
   - `map-item-art.ts`: `artDirs`, `artPanelView`, `expectedImageSize`, `spriteChoices`, `isCustomised`, `thumbSprite`, `thumbDir`, `panelFrameKey`.
   - `map-item-image.ts`: `checkMapItemImage`, `artErrorMessage`, `artOutcome`.
   - `map-items-state.ts`: `catalogGroups`, `isLibraryDefault`, `settleMapItem`, `mapItemErrorMessage`.
   - `ResetMapItemBody` can be reused inline or in a small confirm sub-view.
   - `MapItemFormFields` markup is replaced by the Details tab, but the field logic stays.

3. **"Customized" in the stats differs from today's `isCustomised`.** The ticket says "package sprite or custom image instead of the library sprite". That is exactly what `isCustomised` computes (any allowed direction with `hasImage` or a sprite), so the stats should reuse it. The same function drives the card's art-source label. The card label is "Library sprite", "Package sprite" or "Custom image". For a mixed item, define it per item as the `artPanelView` precedence over the allowed directions, or use the `thumbDir`/`thumbSprite` direction (south first). The plan must pick one rule. I suggest image beats sprite beats library, as in `artPanelView`.

4. **Ticket mentions features the sprite browser does not have today.** The ticket says "today's sprite browser (search, 'All types')". Today's `SpriteBrowser` is a radiogroup grouped by registry group, with no search box and no type filter. A sprite search and an "All types" group filter are therefore **new**, though small and client-side over the `spriteChoices` groups. Keep them small. The browser also currently stages and has a "Use this sprite" button. In the editor, picking a sprite should stage it into pending state, with no extra confirm API call.

5. **Existing tests are all `renderToStaticMarkup`** (no DOM, no effects, no event simulation). Today's tests depend on exported pure-prop components: `MapItemArtBody`, `MapItemFormFields`, `ResetMapItemBody`. The ticket's "render tests for the editor's save, refusal and unsaved-changes paths" cannot be done with static markup alone. The save logic must live in a pure async function and a pure reducer or state module so Vitest can drive it with a fake `MapItemsApi`. Static markup then covers only the views.

6. **The old art dialog's `run()` is per-direction and reloads each time.** The new editor must not reload the list after each staged change, or it would lose the pending state. Reload once, after Save, partial failure, or reset.

## Recommendations

**Component split** (all in `src/ui/mapItems/`, R1: ui imports lib only):
- `MapItemEditor.tsx`: the native `<dialog>` shell, tabs, footer and the unsaved-changes confirm. Keep the dialog mechanics from `MapItemArtDialog` (showModal, `onCancel` calling a guarded close, scrim press handling, focus restore). Do not use `EntityFormDialog`, since it has no tabs or custom footer. Key it by `item.builtinKey`, as `MapItemFormDialog` does.
- `MapItemEditorAppearance.tsx`: direction tabs, 2× preview with source label, Sprite library / Upload switch, the browser, "Restore default". Props only.
- `MapItemEditorDetails.tsx`: the fields, plus "Reset item to library defaults" with an inline confirm step. Props only.
- `map-item-editor.ts` (pure): the `EditorState` type, the reducer, `isDirty`, `buildSavePlan`, and `saveEditor(api, item, state)`.
- `MapItemsView.tsx` is split into `MapItemsHeader` (eyebrow, title, subtitle, stats), `MapItemCard` and the filter bar. `MapItemsView` takes `onEdit` only (drop `onArt`). Add pure helpers `mapItemStats(items)` and `filterItems(items, group, query)` to `map-items-state.ts` (name and key match case-insensitive; keep `catalogGroups` order for tabs and a flat name-sorted list for the grid, since groups become chips and tabs). The tab and search state is local `useState` in the view, or lifted to the page if the pencil must keep the filter. Local is fine because the dialog is a sibling. If the selected group disappears after a reload, fall back to "All".
- Delete `MapItemFormDialog.tsx`, `MapItemArtDialog.tsx` and `ResetMapItemDialog.tsx` so no other dialog is left (acceptance criterion 4). Move what is still needed (`MapItemArtBody` panel markup, `ResetMapItemBody`) into the new files.
- `MapItemsPage.tsx`: `Dialog` becomes `{ kind: none } | { kind: editor; key }`. Resolve the item from `items.items` by key, as `findArtItem` does today, so a reload refreshes it. Close the editor if the item vanished.

**Pending state model:**
```ts
EditorState = {
  tab: "appearance" | "details",
  form: MapItemForm,                       // formFromItem
  art: Partial<Record<Direction, ArtEdit>>, // absent = unchanged
  dir: Direction,
  error: string | null, saving: boolean,
  confirmDiscard: boolean, confirmReset: boolean }
ArtEdit = { kind:"sprite"; key:string|null }   // null = library
        | { kind:"image"; bytes:Uint8Array<ArrayBuffer>; url:string }
        | { kind:"removeImage" }
```
- `isDirty = patchFrom(...).kind !== "unchanged"` or `Object.keys(art).length > 0`. `patchFrom` already ignores unchanged fields. Whitespace or invalid-name edits count as dirty and show a field error on Save.
- A staged "Restore default" sets `{sprite:null}` and, when the saved state has a custom image, also needs a remove. The existing dialog has two separate buttons: "Use library sprite" (PUT art null) and "Remove custom image" (DELETE image). The mockup has one "Restore default" meaning "that direction back to the library sprite". Define it as **both**: `putArt(null)` if a sprite is set, plus `deleteImage` if `hasImage`. Model this as `{kind:"library"}` and expand it at save time from the saved `item.art[dir]`.
- Upload is validated immediately with `checkMapItemImage` (against the **pending** w/h, see Risks) and the error is shown in that direction's panel. Bytes are kept in state and previewed with an object URL, which must be revoked on replace and on unmount.
- Choosing a sprite after a staged upload replaces the staged item for that direction, and the reverse.
- The 2× preview uses `FramePreview` with `scale=2` for sprite or library, or the img for an image (staged object URL, saved URL from `imageUrl`). The ticket asks whether a 1× preview is needed (LAY-07). Recommendation: the card's preview is only a small thumbnail, and LAY-07 says "previewed at 1× and 2×". The safest option is a small 1× next to the 2× in the editor (the old art body already renders both, so this is cheap). That also avoids changing `panelFrameKey` and `FramePreview` use. Ask Ming only if he objects.

**Combined Save order (`saveEditor`)**:
1. Run `patchFrom`. If invalid, show the field error and send nothing. If `needsConfirm`, show the existing confirm-resize checkbox and block Save. Reuse `copy.form.confirmFirst`.
2. **Details PATCH first**, only if the patch is not "unchanged". A size change removes all custom images server-side and clears non-fitting sprites. Art edits are applied afterwards against the new size, so the art plan must be computed from the post-PATCH item.
3. Then art, one direction at a time in `artDirs` order, with per-direction ordering: `deleteImage` before `putArt(null)`; for a sprite choice use `putArt(key)`; for an upload use `putImage`. Do them sequentially (not parallel), so a failure stops the sequence at a known point.
4. **After a resize, drop staged art that the resize invalidated.** Staged `removeImage` for an image that the PATCH already deleted would 404 or no-op (check what `deleteImage` returns for a missing image, and treat 404 or not_found as done). A staged `{image}` upload was checked against the new size already, so it is safe. A staged sprite was filtered by `spriteChoices` using the new w/h, so it fits. A saved sprite that no longer fits is cleared by the server, so show that in the status.
5. Use `artOutcome` for each result. `gone` or `not_found` means close and reload (as today). `reload` (`image_changed`) means reload and show the message. Other errors are shown in the popup.
6. **Partial failure:** keep a `saved` ledger of steps that succeeded. After a failure, reload the list once and rebuild the editor state from the fresh item. Keep the failed step and every later step as still-pending, and drop the saved ones. That satisfies "nothing already saved is shown as unsaved". If the PATCH succeeded and an art step failed, rebuild `form` from the new item (it is no longer dirty) and keep the failed art edits. The error line names the direction (use the same direction labels as `artErrorMessage`). If the PATCH itself fails (409 `item_in_use` with `rooms`), nothing was written, so keep everything pending and show `mapItemErrorMessage(code, rooms)`. This needs `saveEditor` to return `{ saved: step[], failed?: {step, message}, gone? }`, which is what the unit tests assert.
7. On full success, close or stay open? The ticket says the status reads "No unsaved changes" after a full save, which implies the editor stays open. So after success: reload, rebuild state from the fresh item, tab and direction kept, and status "No unsaved changes" (add a "Saved" flash if wanted). Confirm this with Ming (see questions).
8. Double submit: set `saving` and disable Save, Cancel, tabs and the browser while saving. Also guard re-entry in the handler, since `apiFetch` re-sends once on 401/403 (R7).

**Reset to library defaults:** keep it an immediate action with its own confirm (`ResetMapItemBody`), not a pending change. Dirty pending edits should be discarded by a reset, so show "unsaved changes will be lost" in the confirm when dirty, or disable Reset while dirty. After reset, reload and rebuild state. Reuse `settleMapItem(await api.reset(key))`. The reset can be refused with `item_in_use`, shown in the popup.

**Unsaved-changes confirm:** a guarded `requestClose()` used by Cancel, the Esc `onCancel`, scrim click, and any close button. If `!isDirty` close at once, otherwise set `confirmDiscard` and render an inline confirm in the footer (Discard / Keep editing). Prefer an inline panel to a nested `<dialog>` (simpler focus handling). Esc must be `preventDefault`ed as today. Add `beforeunload`? Not needed.

**Stats, tabs and search:** all pure and client-side.
- Stats: total, `!hidden` count for "in palette", `isCustomised` count. Chairs are never in the palette (copy `chairNote`). Decide whether a chair counts as "in palette". I suggest counting `!hidden` as the ticket says, and flag it.
- Tabs: "All N" plus groups from `catalogGroups`. "Showing N of M" counts the filtered list vs all. The empty message for no results is new copy. Keep the existing `list.empty` for the not-ready catalog.
- Make tabs a real `role="tablist"` with `aria-selected`, and add a labelled search input (`type="search"`).
- Layout: grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`; make the tab strip `overflow-x-auto` inside its own container (not the page) so there is no horizontal page scroll at 390 px. The editor dialog must also be `w-[calc(100%-2.5rem)] max-w-[...]` and use `max-h-[85vh]` with a scrolling body, as the art dialog does now.
- Card: a pencil `button` with `aria-label={mapItemsCopy.editLabel(item.name)}` (keep this label so tests and screen readers keep working). The whole card need not be clickable. Preview on a tile-grid background (CSS gradient, no asset). Reuse `thumbUrl`/`atlas`/`thumbSprite`/`FramePreview` as the row did; at preview box 48 or 64 use `box` prop. Fall back to the library frame via `panelFrameKey(item, "s")` when there is no image or sprite, so every card shows a sprite (today's rows show nothing for library-only items).

**Copy (`src/ui/copy/mapItems.ts`, D36):** add `page` (eyebrow, title, subtitle), `stats`, `tabs.all`, `search`, `grid.empty/footer/showing`, `editor` (title, "Edit <name>", tab names, status texts, Cancel, Save changes, discard confirm, "Never auto-rotated", "Only updates the <direction> view", "Restore default", "Sprite library / Upload image", palette label, fixed footprint text, reset). Remove entries that become unused (`edit`, `artLabel`, `art.title/hint/close/button/useLibrary/remove...`, `form.title`, `form.reset`). Note `shellCopy.pages.mapItems.title` is the current h1 text. The new h1 "Map items" should still come from there or from the new copy, not both. The mockup subtitle replaces `intro` ("These items fill the Add items palette…"). Keep the "Items are never deleted" statement via the footer.

**Which existing tests change:**
- `MapItemsView.test.tsx`: rewrite. The group headings, per-row badges, the "Art" button and the `onArt` prop go. Keep forbidden, loading, error, empty and thumbnail (img vs canvas) cases, adapted to cards. `MapItemsViewProps` changes (`onArt` removed, filter state added).
- `MapItemFormDialog.test.tsx`: becomes the Details tab test. The cases for fixed size, chair note, resize warning and confirm, and Reset disabled for library default carry over with new markup and copy ("This item uses a fixed footprint." replaces `fixedReason`, which is per kind today. Decide whether to keep the per-kind reason; ticket text says a single sentence).
- `MapItemArtDialog.test.tsx`: becomes the Appearance tab test. Cases: panel count by direction (now tabs, one panel visible), non-directional single, source text, previews, error alert, busy disabled, atlas cases. "Four panels with legends" changes to four direction tabs. The "Choose / Upload / Use library / Remove" button set changes to the Sprite library / Upload switch plus "Restore default".
- `ResetMapItemDialog.test.tsx`: `ResetMapItemBody` is kept, so only the import path changes if it moves.
- `SpriteBrowser.test.tsx`: changes only if the staged confirm block ("Use this sprite" / Cancel) is removed or search and "All types" are added.
- `map-item-form.test.ts`, `map-item-art.test.ts`, `map-item-image.test.ts`, `map-items-state.test.ts`, `map-items-api.test.ts`, `frame-preview.test.ts`: unchanged (pure code stays). `map-items-state.test.ts` gains `mapItemStats` and `filterItems` cases. `test-items.ts` may need fixture builders for hidden, customised and fixed-size items.
- New tests: `map-item-editor.test.ts` (reducer, `isDirty`, `saveEditor` order using a fake api that records calls: details before art, resize then art, partial failure ledger, 409 `item_in_use` with rooms, 422 image rules, name clash, not_found), editor view markup tests (tabs, footer status strings, discard confirm shown), and card variants.

## Risks

1. **Order and the size change.** A resize deletes every custom image, which also invalidates staged `removeImage` steps and the saved previews. Art checks (`checkMapItemImage`, `spriteChoices`, `expectedImageSize`) all take `item.w/h`. In the editor they must be given the **pending** w/h (pass `{...item, w: form.w, h: form.h}`), or a user who enlarges an item and uploads a new image in one go gets a wrong "bad size" error or a stale sprite list. The server PATCH-then-art order is then consistent. Also `resizeEffects` says what a resize removes, so use it to hide staged `removeImage` and old sprites in the preview when a resize is pending.
2. **Partial failure after a successful PATCH** leaves the item resized but art unsaved. The state must be rebuilt from the reloaded item, or Save would re-send an already-applied patch. `patchFrom` against the fresh item gives "unchanged", so the rebuild is enough. Do not retry the patch blindly.
3. **R7 / re-send.** `apiFetch` re-sends once on 401/403, so each step must be idempotent. PATCH and PUT are. `deleteImage` is idempotent only if the server returns 2xx or `not_found` for a missing image. Verify in the route handler. `settleMapItem` already treats `not_found` as done.
4. **Staged upload memory and object URLs.** Revoke the staged URLs on replace, discard and unmount. Keep the 64 KB bytes in state, not the `File`.
5. **Stale `item` prop.** The editor reads the item from the list. After the post-save reload the item changes under the editor. Reducer reset must key on a version of the item (e.g. serialized art versions), not only on `builtinKey`, or it may keep dirty state against a new base. Do the rebuild explicitly in the save flow instead of in an effect.
6. **Accessibility.** Tabs (two levels: Appearance/Details and N/E/S/W) need `role=tablist/tab/tabpanel`, arrow-key navigation, a visible focus ring. The dirty status should be `role="status"` (`aria-live=polite`). The sticky footer must stay reachable at 390 px. The editor must trap focus (native `showModal` does) and return it to the pencil on close (the old dialog did this with `previous.focus()`).
7. **Atlas still loading or failed.** Keep the `atlasFailed` note and the name-only list fallback from the old art body. Cards need a no-atlas fallback (just the badge and text).
8. **Chair and floor items.** Chairs have no palette checkbox (`item.kind === "chair"`; keep `chairNote` and hide "Show in item palette"). Floor sizes are fixed 1×1. `item.fixedSize` covers the disabled footprint text, but its reason copy differs by kind today.
9. **Scope.** The sprite search and "All types" filter, the 1× preview and the stats tooltip are the only places where scope could creep. Keep to the ticket (R4).

## Open questions

1. Search and "All types" in the sprite browser: the ticket calls them "today's", but they do not exist (finding 4). Confirm they are new (small, client-side) or drop them.
2. After a fully successful Save, does the editor stay open (status "No unsaved changes", per the criterion wording) or close? I suggest staying open, and Cancel/close then becomes a plain Close with no prompt.
3. Is "Restore default" meant to remove both the package sprite and the custom image for that direction (my recommendation), or only the sprite as the old "Use library sprite" did?
4. Keep the small 1× preview in the editor (LAY-07 says 1× and 2×), or accept the card as the 1× preview?
5. Per-item art-source label on the card for mixed directions: use the `artPanelView` precedence (image beats sprite beats library) over all allowed directions, or the first direction (`thumbDir`/`thumbSprite` order)?
6. "In palette" stat: should chairs (never in the palette) count? The ticket says "not hidden"; I suggest following that literally.
7. Reset while there are unsaved edits: block it, or confirm and discard the edits?
8. Keep per-kind fixed-size reasons (`copy.form.fixedReason`) or use the single sentence "This item uses a fixed footprint."? The ticket text says the latter.

Relevant files: `/home/user/simap/work/tickets/SIM-070/ticket.md`, `/home/user/simap/src/ui/mapItems/MapItemsView.tsx`, `/home/user/simap/src/ui/mapItems/MapItemsPage.tsx`, `/home/user/simap/src/ui/mapItems/MapItemFormDialog.tsx`, `/home/user/simap/src/ui/mapItems/MapItemArtDialog.tsx`, `/home/user/simap/src/ui/mapItems/ResetMapItemDialog.tsx`, `/home/user/simap/src/ui/mapItems/SpriteBrowser.tsx`, `/home/user/simap/src/ui/mapItems/map-item-form.ts`, `/home/user/simap/src/ui/mapItems/map-item-art.ts`, `/home/user/simap/src/ui/mapItems/map-item-image.ts`, `/home/user/simap/src/ui/mapItems/map-items-state.ts`, `/home/user/simap/src/ui/mapItems/map-items-api.ts`, `/home/user/simap/src/ui/copy/mapItems.ts`.
