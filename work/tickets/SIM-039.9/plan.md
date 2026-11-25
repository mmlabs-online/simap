Status: READY

# Plan — SIM-039.9: Map items page: art per direction

This plan covers **slice 2a**: everything in the ticket except the atlas (canvas) previews of package and library
frames (see `## Split proposal`). Custom images get their 1× and 2× previews in this slice. Package and library art
shows as text only for now. The sprite browser lists frames as text, which is the ticket's required atlas fallback.
The atlas previews move to a proposed follow-up, **SIM-039.10**.

## Scope summary
- Ticket Goal: "Slice 2 of SIM-039.6: on the Map items page, Admins set each item's art per direction: pick a bundled
  package sprite, upload or remove a custom image, or go back to the library sprite."
- Ticket Scope (all four bullets). This slice covers them except "with previews at 1× and 2× (pixelated)" for package
  and library art, which moves to SIM-039.10.
- Spec LAY-07 (`docs/spec-v1.md` l.456-459): "… and its art per direction (n/e/s/w for directional items, one image
  otherwise), previewed at 1× and 2×."
- Spec LAY-07 l.471-473: "**Art per direction.** For each direction the Admin picks a sprite from the bundled package
  browser (its frame must fit the item's size for that direction), or uploads a custom image, or leaves the library
  sprite. A missing direction falls back as in "Art per item"; one image is never rotated to fill another direction."
- Spec LAY-07 l.474-479: "PNG only (no APNG …), width = 32 × the item's width in tiles for that direction, height = 32 ×
  its height, or up to 32 px taller for an upward overhang (floors: exactly 32 × 32, no overhang); … at most 64 KB. …
  Removing an image falls back to the next art source."
- Spec "Art per item" l.400-401: "Fallback order for each direction of an item: custom image → chosen package sprite →
  the library's built-in frame → the square placeholder."
- D66 (3): "Custom images are uploaded per direction (n/e/s/w) for directional items; a missing direction falls back to
  the chosen package sprite, then the built-in frame, then the placeholder; one image is never rotated." D66 (7):
  "PNG (no APNG), 32 px per tile of the item's size for that direction, up to 32 px upward overhang (floors exactly
  32 × 32), at most 64 KB".
- D67 changes nothing here. The list order (name) and hidden rows are already handled in slice 1.
- D68: "Device types only; map item images (SIM-039.4) decide later." So the map-item limits stay at D66 (64 KB, exact
  32 px grid), and the device-type copy (24-100 px square, 100 KB) must not be shown for map items.
- SIM-039.4 plan A8 (l.266-269): "039.6 must show map-item-specific messages from `src/ui/copy/<feature>.ts` (the
  expected `W × H` and 64 KB) instead of `apiErrorMessage` for these codes." `src/ui/copy/api.ts` is not changed.
- SIM-039.8 plan A10 (l.211-220): reuse `mapItemsApi.getArtImage`; reuse `createImageUrlCache` with
  `itemImageId`/`parseItemImageId` in a small page hook; do not reuse `useCatalogImages`; after an upload, `sync` with
  the new `imageVersion`; "039.9 adds its own pure helper: `MapItemDto` → entries (all four directions for directional
  items, `s` for others)". This plan uses the `mapItemImageFits` lib twin instead of `imageFits`: same rule, and it
  takes `dir` (see A12).
- SIM-039.6 plan § Split proposal (l.319-330) defines this ticket, and its A5 (l.285-288) says: separate "Art" dialog,
  direction labels North / East / South / West, "No confirm on 'Remove custom image'".

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Every art action from 039.2/039.4 is reachable and shows its errors inline. | API client: `map-items-api.test.ts` › `putArt…`, `putImage…`, `deleteImage…`. Each action is reachable from markup: `MapItemArtDialog.test.tsx` › "a panel offers Choose package sprite, Upload image, Use library sprite, and Remove custom image only with an image". Errors are mapped: `map-item-image.test.ts` › "artOutcome …" and "artErrorMessage …". Errors show inline: `MapItemArtDialog.test.tsx` › "an error shows as role=alert inside its own direction panel only". In a local run (`pnpm dev`, Admin), open Map items → Art on `desk.single`: pick a sprite in North (the panel text changes to "Package sprite: …"), choose "Use library sprite" (back to "Library sprite"), and upload a wrong-size PNG to North (the inline message names its actual size and North's expected size from `expectedImageSize`, not the device-type "24-100 px square" text). |
| 2 | Images never rotate to fill another direction; a non-directional item only offers `s`. | `map-item-art.test.ts` › "artDirs: directional items get n,e,s,w; non-directional and floors get s only" and "artImageEntries never makes an entry for a direction the item does not allow". `MapItemArtDialog.test.tsx` › "a non-directional item renders one panel and no direction legends" and "no copy-to-other-directions control is rendered". Each panel's upload targets only its own `{key, dir}` (`putImage` URL test). |
| 3 | Checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. `pnpm test:db` runs in CI (no server change, so it is expected to be unchanged; see A14). |

## Ming verification after merge
- On the deployed app (with real Google Drive), for one directional item (e.g. `desk.single`), do this in North, East,
  South and West: upload a PNG of the exact size, see the 1× and 2× previews and the "Customised" badge plus the row
  thumbnail, remove it, and see "Package sprite …" or "Library sprite" again. A local run without Drive credentials
  only shows `images_unavailable` inline, which is also expected.
- In a room that uses the item, the chosen art draws at the next layout load (SIM-039.8 behaviour; it is only
  re-checked here).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/mapItems/map-items-api.ts` | Add `putArt(key, dir, sprite \| null)` (PUT `/art/{dir}`, JSON, returns DTO via `json`), `putImage(key, dir, bytes)` (PUT `/art/{dir}/image`, `content-type: image/png`, `Blob` body, signature copied from `device-types-api.ts` l.70-79), `deleteImage(key, dir)` (DELETE, 204, its own reader returning `{ok:true, value:null}` as in `device-types-api.ts` l.80-84). | AC1: the client has only `list/patch/getArtImage/reset` today (l.54-81). | No |
| `src/ui/mapItems/map-items-api.test.ts` | Tests for the three methods. | R5 | No |
| `src/ui/mapItems/map-item-art.ts` (new) | Pure helpers: `artDirs`, `artPanelView`, `expectedImageSize`, `spriteChoices`, `artImageEntries`, `isCustomised`, `thumbDir`. | AC1, AC2; A10 helper from 039.8. Pure logic first (planner rule 6). | No |
| `src/ui/mapItems/map-item-art.test.ts` (new) | Unit tests. | R5 | No |
| `src/ui/mapItems/map-item-image.ts` (new) | `checkMapItemImage(file, item, dir)` (precheck), `artErrorMessage(code, item, dir, px?)`, `artOutcome(result)`. | Ticket bullet 3 and 4; 039.4 A8. | No |
| `src/ui/mapItems/map-item-image.test.ts` (new) | Unit tests (PNG builder copied from `device-type-image.test.ts` l.22-60). | R5 | No |
| `src/ui/mapItems/useMapItemImages.ts` (new) | Page hook over `createImageUrlCache` (template: `useDeviceTypeImages.ts`). Returns `(item, dir) => string \| null`. | Ticket bullet 4 (blob URLs keyed `key\|dir\|imageVersion`, revoked on unmount); 039.8 A10. | No |
| `src/ui/mapItems/MapItemArtDialog.tsx` (new) | Native `<dialog>` with a Close button. The pure exported `MapItemArtBody` renders the per-direction panels; the stateful `MapItemArtDialog` holds busy, per-panel error, open browser and staged sprite, and runs the actions. | AC1, AC2 | No |
| `src/ui/mapItems/MapItemArtDialog.test.tsx` (new) | `renderToStaticMarkup` tests of `MapItemArtBody`. | R5 | No |
| `src/ui/mapItems/SpriteBrowser.tsx` (new) | Pure, inline (not a modal) text-only sprite chooser. A grouped radio group with an empty state, then a confirm step. | Ticket bullet 2 | No |
| `src/ui/mapItems/SpriteBrowser.test.tsx` (new) | Static markup tests. | R5 | No |
| `src/ui/mapItems/MapItemsView.tsx` | Row: "Art" button (`icon="palette"`, already in `src/lib/icons.ts` l.28), "Customised" badge, 32 px thumbnail from a `thumbUrl` prop. New props `onArt`, `thumbUrl?`. | Ticket bullet 1 and 4 | No |
| `src/ui/mapItems/MapItemsView.test.tsx` | Tests for the row additions. | R5 | No |
| `src/ui/mapItems/MapItemsPage.tsx` | `Dialog` union gains `{ kind: "art"; key: string }`. Mounts `useMapItemImages` once at page level, passes `thumbUrl` and `onArt`, and renders `MapItemArtDialog` with the item derived from `items.items` by key. The forbidden view passes `onArt={noop}`. | Wiring | No |
| `src/ui/copy/mapItems.ts` | Add `art` (labels, source texts, size line, buttons, hints, browser strings, error texts) and `list.customised`, `artLabel(name)`, `art.thumbAlt(name)`. | D36 (UI copy in `src/ui/copy/<feature>.ts`); 039.4 A8 | No |

Not touched: `src/ui/copy/api.ts` (039.4 A8), `src/lib/**`, `src/ui/deviceTypes/image-url-cache.ts`,
`src/ui/EntityFormDialog.tsx` (shared shell, see A3), `src/ui/mapItems/useMapItems.ts` (dead code, follow-up),
`src/lib/icons.ts`. No server files, so R1 is not at risk and no High path is touched.

## Data model / migration
None.

## API contract
None changed. The client uses the existing routes:
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | `/api/map-items/{key}/art/{dir}` | `{ "sprite": string \| null }` | 200 `MapItemDto` | 400 `invalid_request`, 404 `not_found`, 422 `not_allowed` / `sprite_not_allowed`, 503 `unavailable`, auth codes | admin |
| PUT | `/api/map-items/{key}/art/{dir}/image` | `image/png` bytes ≤ 64 KB | 200 `MapItemDto` | 422 `image_too_large` / `image_not_png` / `image_bad_size` / `not_allowed`, 404 `not_found`, 409 `image_changed`, 502 `drive_error`, 503 `images_unavailable` / `unavailable`, auth codes | admin |
| DELETE | `/api/map-items/{key}/art/{dir}/image` | — | 204 | as PUT image (minus size codes); removing a missing image succeeds | admin |
| GET | `/api/map-items/{key}/art/{dir}/image` | — | 200 PNG / 304 | 404, 502, 503 | user (already wrapped as `getArtImage`) |

Sources: `src/app/api/map-items/[key]/art/[dir]/route.ts` l.13-29, `…/image/route.ts` l.27-59,
`src/server/map-items/image.ts` l.27-36, `src/server/drive/image-flow.ts` l.9-26, `src/server/map-items/edit.ts` l.18-23.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `map-items-api.test.ts` › "putArt sends PUT /art/{dir} with JSON {sprite} and returns the DTO; key is URL-encoded" | AC1 |
| `map-items-api.test.ts` › "putArt(null) sends {sprite:null}" | Use library sprite |
| `map-items-api.test.ts` › "putImage sends PUT /art/{dir}/image with content-type image/png and a Blob body; returns the DTO" | AC1, AC2 (URL holds only that dir) |
| `map-items-api.test.ts` › "deleteImage: 204 gives {ok:true, value:null}; an error body code is returned (images_unavailable, image_changed)" | 204 reader |
| `map-items-api.test.ts` › "ApiAccessError on an art write maps like list (signed_out → unauthenticated)" | auth mapping |
| `map-item-art.test.ts` › "artDirs: directional items get n,e,s,w; non-directional and floors get s only" | AC2 (uses `desk.single`, `plant.large`, `floor.wood`; plus `chair.office` with whatever its library `directional` flag is) |
| `map-item-art.test.ts` › "artPanelView: image wins over sprite over library; spriteHidden when both set; canRemove only with image; canUseLibrary only with a sprite" | fallback order (spec l.400-401) |
| `map-item-art.test.ts` › "expectedImageSize: table.meeting 3×2 n → 96 × 64..96, e → 64 × 96..128; floor → exactly 32 × 32" | exact size per direction |
| `map-item-art.test.ts` › "expectedImageSize agrees with mapItemImageFits for every item, allowed dir and px in 0..160" | no drift from the server rule |
| `map-item-art.test.ts` › "spriteChoices: every key passes spriteAllowedFor and spriteFits; floor items get only floor frames; others never floor; grouped by registry group in name order, keys sorted; e/w use swapped size" | browser filter |
| `map-item-art.test.ts` › "spriteChoices for a 1×1 item excludes frames larger than 1×1" | spriteFits edge |
| `map-item-art.test.ts` › "artImageEntries: ids are itemImageId(key, dir); hasImage/imageVersion copied; never makes an entry for a direction the item does not allow" | A10, AC2 |
| `map-item-art.test.ts` › "isCustomised: true with any image or sprite in an allowed dir" | badge |
| `map-item-art.test.ts` › "thumbDir: s first, then n, e, w; null with no image" | row thumbnail |
| `map-item-image.test.ts` › "checkMapItemImage: over 64 KB is image_too_large without reading the file" | precheck order |
| `map-item-image.test.ts` › "checkMapItemImage: a read failure is read_failed; non-PNG and APNG are image_not_png" | precheck |
| `map-item-image.test.ts` › "checkMapItemImage: wrong size is image_bad_size with the actual px; exact size and +32 overhang pass; floor 32×33 fails" | precheck, D66 7 |
| `map-item-image.test.ts` › "artErrorMessage: image_too_large names 64 KB, image_bad_size names the direction's expected size (and the actual px when known); both differ from apiErrorMessage" | 039.4 A8 |
| `map-item-image.test.ts` › "artErrorMessage: other codes fall back to mapItemErrorMessage (sprite_not_allowed, images_unavailable, drive_error, unauthenticated)" | inline errors |
| `map-item-image.test.ts` › "artOutcome: ok → saved; image_changed → reload with message; not_found → gone; anything else → error" | `image_changed` reloads the item |
| `MapItemArtDialog.test.tsx` › "a directional item renders four panels with legends North, East, South, West" | AC2 |
| `MapItemArtDialog.test.tsx` › "a non-directional item renders one panel and no direction legends" | AC2 |
| `MapItemArtDialog.test.tsx` › "source text: Custom image / Package sprite: <key> / Library sprite; the 'set but hidden by the custom image' line" | active source as text |
| `MapItemArtDialog.test.tsx` › "a panel offers Choose package sprite, Upload image, Use library sprite (disabled without a sprite), and Remove custom image only with an image" | AC1 |
| `MapItemArtDialog.test.tsx` › "previews: an image URL renders two pixelated imgs at 1× and 2× width; an image without a URL yet shows 'Preview not available'" | previews |
| `MapItemArtDialog.test.tsx` › "an error shows as role=alert inside its own direction panel only" | AC1 inline, images_unavailable/drive_error panel-only |
| `MapItemArtDialog.test.tsx` › "busy disables every action button in every panel" | one request at a time |
| `MapItemArtDialog.test.tsx` › "no copy-to-other-directions control is rendered" | AC2 |
| `SpriteBrowser.test.tsx` › "lists choices as a radiogroup by group; current sprite is checked; empty state text when none fit" | browser |
| `SpriteBrowser.test.tsx` › "confirm step shows the key, frame tiles vs item tiles, the bottom-left note when smaller, Use this sprite and Cancel" | confirm step, OQ-53 |
| `MapItemsView.test.tsx` › "each row has an Art button labelled with the item name" | AC1 reachability |
| `MapItemsView.test.tsx` › "Customised badge only when isCustomised; thumbnail img only when thumbUrl returns a URL" | row badge, thumbnail |

The hook (`useMapItemImages`) and the stateful dialog wiring are not unit-tested: the repo runs Vitest in the node env
with no DOM, and jsdom is not added (stack rule). The cache logic is already covered by `image-url-cache.test.ts`. The
hook is about 35 lines that mirror `useDeviceTypeImages.ts`. All decisions in the dialog go through the tested pure
helpers (`artPanelView`, `checkMapItemImage`, `artErrorMessage`, `artOutcome`). The reviewer checks the dialog in a
local run (AC1 row).

## Approach
1. **API** (`map-items-api.ts`). Add the three methods inside the returned object. `putImage(key: string, dir: Direction,
   bytes: Uint8Array<ArrayBuffer>)` sends `body: new Blob([bytes], { type: "image/png" })`. `deleteImage` uses
   `call<null>(…, { method: "DELETE" }, async () => ({ ok: true, value: null }))`. Keys go through `encodeURIComponent`.
   `dir` is a typed `Direction`.
2. **Pure art helpers** (`map-item-art.ts`; imports `@/lib/map-items/art`, `@/lib/map-items/types`,
   `@/lib/sprites/registry`, `@/lib/sprites/item-art` only):
   - `artDirs(item) = item.directional ? MAP_ITEM_DIRS : ["s"]`.
   - `artPanelView(item, dir)` returns `{ source: "image" | "sprite" | "library", spriteKey, spriteHidden, canRemove,
     canUseLibrary }`, with the precedence of `resolveItemArt` (`src/lib/sprites/item-art.ts` l.75-94).
   - `expectedImageSize(item, dir)` returns `{ w, hMin, hMax }` from `sizeFor` and `MAP_ITEM_LIMITS` (floors
     32/32/32).
   - `spriteChoices(item, dir)` returns `{ group, keys[] }[]` over `FRAME_KEYS` with `spriteAllowedFor(item, k) &&
     spriteFits(k, dir, item.w, item.h)`, grouped by `REGISTRY[k].group`. `keys.json` has 97 frames, so there is no
     paging and no text filter (A7).
   - `artImageEntries(items)` returns an `ImageEntry[]` over `artDirs`.
   - `isCustomised(item)`.
   - `thumbDir(item)`.
3. **Image precheck and messages** (`map-item-image.ts`). `checkMapItemImage` follows the order in
   `checkImageFile` (`device-type-image.ts` l.11-25), with `MAP_ITEM_LIMITS.imageBytes`, then `parsePng`, then
   `mapItemImageFits(item, dir, item.w, item.h, {width, height})`. It returns `{ok:true, bytes}` or
   `{ok:false, code, px?}`. `artErrorMessage(code, item, dir, px?)` uses `mapItemsCopy.art.errors` for
   `image_too_large`, `image_not_png`, `image_bad_size`, `read_failed` and `image_changed`, and otherwise
   `mapItemErrorMessage(code)` (`map-items-state.ts` l.44-48). `artOutcome(result)` returns
   `saved | reload(message) | gone | error(message)`.
4. **Hook** (`useMapItemImages(api, items)`). Copy the `useDeviceTypeImages.ts` structure:
   - `load` calls `parseItemImageId(id)` and then `api.getArtImage(key, dir)`.
   - The `sync` effect runs on `artImageEntries(items)` (memoised on `items`).
   - It returns `(item, dir) => cache?.url({ id: itemImageId(item.builtinKey, dir), ...item.art[dir] })`.
   - It lives once in `MapItemsLoaded`, so rows and dialog share one cache. URLs are revoked only on page unmount
     (`dispose`) or when a version is superseded.
5. **Dialog** (`MapItemArtDialog.tsx`).
   - The shell is a native `<dialog>` with the same open/close/Esc/scrim/focus-return effect as `EntityFormDialog.tsx`
     l.42-73, but wider (`max-w-[760px]`, scrollable body) and with one "Close" button (A3).
   - The title is "Art for <name>", with the size hint "Each direction needs its own art; images are never rotated."
   - `MapItemArtBody` (pure, exported) renders one `<fieldset>` per `artDirs(item)` dir. Its legend is
     North/East/South/West, or "Art" plus "Same for every rotation" for non-directional items. Each panel shows:
     - the source text and the hidden-sprite line;
     - the expected size line;
     - the image previews: when `hasImage`, two `<img>` from the shared cache with
       `style={{ imageRendering: "pixelated", width: expected.w * scale }}` (the width is exact by rule) and the
       captions "1×" and "2×", inside an `overflow-x-auto` box; "Preview not available" when the URL is null;
     - the buttons and the `role="alert"` error line;
     - the inline `SpriteBrowser` when that dir's browser is open.
   - Props: `item`, `imageUrl(dir)`, `busy`, `busyDir`, `errors: Partial<Record<Direction,string>>`, `browser`
     (`{dir, staged}` or null), and the callbacks.
   - `MapItemArtDialog` (stateful) owns the state.
     - The run steps for each action:
       1. clear that dir's error and set busy;
       2. call the API;
       3. `artOutcome`:
          - `saved`: `await reload()`, then announce "Saved for North" in one polite `role="status"` line;
          - `reload`: show the message and `await reload()`;
          - `gone`: call `onGone` (close and reload);
          - `error`: set the panel error;
       4. clear busy.
     - Upload: a hidden `<input type="file" accept="image/png">` per panel, triggered by the "Upload image" button
       through a ref. `input.value = ""` is reset after each pick. A precheck failure shows inline and sends nothing.
     - Remove: `deleteImage` runs directly with no confirm (A1).
     - Use library sprite: `putArt(key, dir, null)`.
6. **Sprite browser** (`SpriteBrowser.tsx`, pure). It renders inline inside the panel that opened it, and only one
   browser is open at a time (A2).
   - It is a `role="group"` region labelled "Package sprites for North" with a `role="status"` count line.
   - Choices are a `role="radiogroup"` of native radios grouped under group headings, showing the key text and the
     frame tiles. The current sprite is checked.
   - Selecting a radio stages the key. The confirm area then shows the staged key, "Frame w × h tiles, item w × h
     tiles for North", and the note "Smaller frames draw at the bottom-left" when it is smaller (OQ-53), with "Use
     this sprite" (calls `putArt`) and "Cancel".
   - If no choice fits, it shows "No package sprite fits this size."
   - On Cancel or a successful save, the browser closes and focus returns to that panel's "Choose package sprite"
     button (a ref per dir).
7. **Row and page.**
   - `MapItemsView` row: a thumbnail (`<img>` 32 px box, `object-contain`, pixelated) when
     `thumbUrl?.(item)` is non-null, a "Customised" badge when `isCustomised`, and an "Art" tonal button beside Edit
     with `aria-label={artLabel(name)}`.
   - `MapItemsPage` adds `{kind:"art"; key}`. The dialog renders only while `items.items.find(...)` exists; it closes
     otherwise. `onDone` is not used for art: actions keep the dialog open and call `items.reload()`, which does not
     set status to "loading" (`src/ui/groups/useList.ts` l.21-30), so the dialog stays mounted (A5).
8. **Copy** in `mapItemsCopy.art` (English, D36). Error texts:
   - `image_too_large`: "The image is larger than 64 KB."
   - `image_not_png`: "This file is not a valid PNG image. Animated PNGs are not allowed."
   - `image_bad_size`: "This image is 40 × 40 px. North needs 64 × 64 px, up to 64 × 96 px with an overhang." The
     floor version is "… needs exactly 32 × 32 px."
   - `read_failed`: "The file could not be read. Try again."
   - `image_changed`: "This image was changed by someone else. The latest art is shown now."
9. **Rules.**
   - R1: ui and lib imports only; `pnpm check:layers`.
   - R3: no config.
   - R4: no server, lib or shared-shell edits.
   - R5: the tests above.
   - R7: client only. `apiFetch`'s single resend on 401/403 is safe, because those come before any side effect.
   - R2/R6: not affected.

## Specialist input used
- Frontend:
  - Adopted:
    - the three API methods, including the 204 reader;
    - `checkMapItemImage` order and the separate map copy, with `apiErrorMessage` kept for other codes;
    - `expectedImageSize` tested against `mapItemImageFits`;
    - one page-level hook modelled on `useDeviceTypeImages`;
    - holding the key, not the DTO, in dialog state;
    - `reload()` after each action, which I checked against `useList` (it keeps `ready`);
    - no "copy to other directions";
    - no changes to `src/lib/**` or `image-url-cache.ts`;
    - "Image not available" for both loading and failed, with no cache change;
    - the suggested cut of the atlas previews (Split proposal).
  - Rejected:
    - grouping plus a text filter (97 frames total, A7);
    - showing the frame `dir` as a separate label (the key already ends in `.n/.e/.s/.w` where it has one, A8).
- UX:
  - Adopted:
    - a separate Art dialog with Close only;
    - `fieldset` per direction with North/East/South/West;
    - the "set but hidden by the custom image" line;
    - the expected size line;
    - "Use library sprite" offered while an image exists, with a hint that the image still wins;
    - the radiogroup browser with a count, an empty state and a confirm step showing tile sizes and the bottom-left
      note;
    - hidden file input with value reset;
    - one busy state for the dialog;
    - a per-panel `role="alert"` error, cleared on the next action;
    - `image_changed` shows a message and reloads, with no auto-retry;
    - `not_found` closes the dialog and reloads;
    - a polite success announcement;
    - captions for 1× and 2× and a scroll box.
  - Rejected:
    - the two-step remove confirm (A1);
    - focus by `data-key` (rows are keyed by `builtinKey`, so the Art button's DOM node survives a reload; the
      browser's own focus return is enough);
    - the "art is set from the Art button" line in the edit dialog (not needed, R4).
- Disagreements resolved:
  - Remove confirm: none (A1).
  - Nested vs inline browser: inline (A2).

## Assumptions
For Ming at the plan gate. Each is reversible with a small change.
- **A1 No confirm on "Remove custom image"** (039.6 A5, Device types has none). A plain "Removed for North" status
  follows, and the panel falls back to the sprite or library text. UX preferred a two-step confirm because the Drive
  file can't be restored. To switch, the button becomes "Confirm remove / Cancel" (about 10 lines).
- **A2 The sprite browser is inline in the panel, not a nested modal.** It avoids a dialog over a dialog, which has
  focus-restore problems with the native `<dialog>` used here. Only one browser is open at a time.
- **A3 The art dialog has its own native `<dialog>` shell** (Close button only). `EntityFormDialog` has a fixed
  Cancel/Submit form footer and is shared by about ten dialogs, so it is not changed.
- **A4 Direction labels are North / East / South / West** (039.6 A5). A non-directional item shows one panel titled
  "Art" with "Same for every rotation" (D66 3: the `s` art is used for all rotations; that is not rotating an image).
- **A5 Reload after each action**, not a local list patch. One code path, as 039.6 A2. The dialog stays open, and busy
  lasts until the reload returns, so the panel never shows stale art next to an enabled button. If the reload itself
  fails, the list shows its error and the dialog closes, because the item is no longer in the list.
- **A6 Row thumbnail is a custom image only**: the `s` image first, then `n`, `e`, `w`. Rows with only a sprite show
  no thumbnail until SIM-039.10 adds atlas crops. "Customised" means any allowed direction with an image or a sprite.
- **A7 No text filter or paging in the browser.** `keys.json` has 97 frames, and the filter by group, layer and size
  leaves fewer per item. Choices are grouped by registry group.
- **A8 The browser does not filter by a frame's own facing** (`RegistryEntry.dir`). The server accepts any allowed
  frame that fits, and the ticket names only `spriteAllowedFor` and `spriteFits`. The key text shows its suffix.
- **A9 "Use library sprite" clears only the sprite.** It is enabled when `sprite !== null`, even while an image exists,
  with the hint "The custom image still shows until you remove it." It is disabled when there is no sprite.
- **A10 `images_unavailable`, `drive_error` and `image_changed` stay in the art panel.** The page-level list error is
  only for `list()` failures. A failed image GET shows "Preview not available" in that panel. The cache keeps no
  error code, so there is no message per code.
- **A11 Library art per direction is text only ("Library sprite") in this slice.** SIM-039.10 adds its preview, using
  `resolveFrameKey` (`src/lib/sprites/placement.ts` l.41-46) to name the library frame per direction.
- **A12 The precheck uses `mapItemImageFits`** (`src/lib/map-items/art.ts` l.39-52), the same rule the server uses,
  rather than 039.8's `imageFits` (`src/lib/sprites/item-art.ts` l.51-63). Both are equal by rule. The lib function
  takes `dir`, so no box is computed in ui.
- **A13 `useMapItems.ts` is dead code** (the page uses `useList`). It is left alone here (R4) and goes to follow-ups.
- **A14 No server or DB change**, so `pnpm test:db` should give the same result as on `main`. The 039.4 A11 note on
  `handoffs.db.test.ts` still applies if it fails there.
- **Hotspots:** no other open ticket (`IN_PROGRESS` / `REVIEW` / `DONE` in `work/backlog.md`) edits these files.
  SIM-034 (PLANNING) touches CI only.

## Blocking questions
None.

## Split proposal
The whole ticket is about 600 product lines:
- this slice ≈ 480:
  - API ≈ 25
  - `map-item-art.ts` ≈ 70
  - `map-item-image.ts` ≈ 50
  - hook ≈ 35
  - dialog ≈ 160
  - text browser ≈ 70
  - view and page ≈ 35
  - copy ≈ 45
- atlas previews ≈ 120 to 140:
  - atlas load on open with an AbortController
  - a canvas frame component at 1× and 2×
  - library frame per direction
  - tile previews in the browser and on the confirm step
  - "Preview unavailable" when the atlas fails
  - a sprite-only row thumbnail

The atlas parts also can't be unit-tested in the node env. The split:
- **Slice 2a = SIM-039.9 (this plan):** everything in the ticket except the atlas previews. Custom images get 1×/2×
  previews. Package and library art show as text. The browser is text-only, which is the ticket's required atlas
  fallback. All three ACs are met.
- **Slice 2b = new ticket SIM-039.10 "Map items art: atlas previews"** (P2, S, ui, depends on SIM-039.9, gate none).
  It covers package and library frame previews at 1× and 2× (pixelated canvas from `loadAtlas`, loaded when the
  dialog opens), frame thumbnails in the sprite browser and on the confirm step, a text-only note when the atlas
  fails, and a sprite-based row thumbnail (A6). LAY-07's "previewed at 1× and 2×" is fully met only after 2b.

Slice 2a is still about 20% above the ~400-line guide, mostly JSX and copy. If Ming or the reviewer wants it smaller,
the next cut moves the sprite browser ("Choose package sprite", `SpriteBrowser.tsx`, `spriteChoices`, ≈ 90 lines) into
SIM-039.10 as well. This slice would then keep upload, remove and "Use library sprite".
