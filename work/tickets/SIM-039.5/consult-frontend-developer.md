SIM-039.5 consult (frontend). Read-only. I read the 039.1, 039.3 and 039.4 plan notes, D66/D67/D68, the spec art-fallback paragraph, and the code listed below. I ran no checks.

## Findings

**F1. The palette is still the registry.**
- `src/lib/layout-editor/palette.ts` builds `paletteEntries()` and `editorPalette()` from `REGISTRY` and `spriteInfo`.
- Groups and fixtures sort by key (`cmp`). Seat sprites come first.
- `LayoutEditor.tsx:27` freezes it as a module constant, `const GROUPS = editorPalette()`.
- `Palette.tsx` shows `c.groups[g.group] ?? g.group` for the group title and `copy.itemName(...)` for the entry. `itemName` is `sprite.replaceAll(".", " ")`, or "Desk <code>" or "New desk" for seats (`src/ui/copy/roomlayout.ts:187`).
- Nothing under `src/ui` calls `/api/map-items` yet. No `map-items` client file exists.

**F2. Catalog data and its sort order.**
- `MapItemDto` has `builtinKey`, `name`, `group`, `w`, `h`, `hidden`, `kind` (seat | fixture | floor | chair), `directional`, `fixedSize` and `art: Record<n|e|s|w, {sprite, hasImage, imageVersion}>`.
- `GET /api/map-items` returns items sorted by `lower(name), builtin_key`, in `{items}`. Hidden rows are sent only to Admins (D67.2).
- Groups have no stored order. The ticket text "Admin names/groups/order" is superseded by D67.1. The palette should sort groups alphabetically by group name and items by name within a group. The sort should be explicit and not rely on the server order, so it tolerates Admin rows and a locale compare.
- The editor is Admin-only, so the palette list contains hidden rows and must filter them out.
- Palette rule is in the type comment: kind is seat or fixture, and not hidden. `desk.single` is a seat row. Today it sits in a "desk" group at the top.
- The palette entry `kind` ("seat" | "fixture") and `directional` are now on the DTO. `spriteInfo` is no longer needed for the palette.

**F3. The editor still sizes everything from the registry (A8 of 039.3).**
- Registry sizes (`footprintOf` / `registryFootprints`) are used in `tiles.ts` (`footprintCells`, `footprintBox`, so hit testing, marquee and drag ghost), `place-tool.ts:57` (`placementPreview`), `draft.ts` (`rulesInput` → `checkLayoutRules(...)` and `fixturesOnDesks(...)` with the default lookup), `editor-state.ts:99` and `save-run.ts:100` (`validateLayoutSave`).
- `draft.ts:158` uses `spriteInfo(...).directional` for turnable.
- The lookup parameter already exists on `checkLayoutRules`, `fixturesOnDesks`, `validateLayoutSave` (`validate/layout.ts` lines 132, 200, 339) and `footprintAt`.
- `catalogFootprints(items, fallback)` already builds the `FootprintLookup`. It keys on `builtinKey` and returns the rotation-0 `[w,h]`. `footprintAt` swaps for 90/270.
- Hit areas and the ghost have no lookup parameter yet. `footprintCells`, `footprintBox`, `itemAt`, `itemsInRect`, `dragPreview` (pointer-gesture.ts:126) and `placementPreview` all call `footprintOf` directly.

**F4. The draw list sizes items from the atlas frame, not the catalog.**
- `buildDrawList` uses `frame.tiles` for `Item.w/d`, sort rows, shadows and chair/device placement.
- `resolveLayout`/`readLayoutRows` (server) already use the catalog for bounds and overlap via the lookup.
- A resized item therefore draws at its frame size, while saves and overlap checks use the catalog size. This is the OQ-53 case: "package sprite on a resized item drawn at its own size, bottom-left aligned".
- Seat footprint feeds `chairFor` and the device slots. Desk and chair sizes are fixed (`fixedSize`), so only fixtures can differ.
- `emitFrame` anchors at `tile*TILE + f.anchor` (the anchor is the frame's own offset), which is already top-left of the item's tile box.
- For bottom-left alignment inside a bigger catalog box (iw×ih tiles, frame fw×fh), the y offset must add `(ih - fh) * TILE`. The registry anchor for the overhang is unaffected.
- The sort row (`i.y + i.d - 1`) and shadow should keep using the frame's own size, or the catalog size. This is an open decision (Q3).

**F5. The image draw op is device-specific.**
- `DrawOp.image` is `{typeId, version}`. The paint for it draws `images(typeId, version)`, and does nothing when the source is missing.
- Device fallback is decided earlier, in `resolveDeviceArt`, through `imageReady(t)`. A not-ready image becomes a placeholder frame.
- The device image op is a fixed 24×24 box centred on the frame, and `smoothFor` smooths when downscaling.
- Item images need a different geometry: w = 32·tw and h = 32·th to +32 px of upward overhang. The box is bottom-left anchored at the tile box, drawn at natural size, with no smoothing (it is exactly 1:1).
- Generalise as the ticket says. Either add a `source: "device" | "item"` discriminator and an `id` string to the image op, or add `itemKey`/`dir`/`version`.
- Cache ids must not collide. Device type ids are uuids, and item ids are `<builtinKey>/<dir>`. Prefix them or use two keyed maps.
- `paintRoom`'s `images(typeId, version)` signature changes, or a second resolver is added.
- Floors currently emit `frame` ops per tile. A custom floor image is exactly 32×32 and replaces each tile's frame. That is the same image repeated per tile, so decode once and draw N times.

**F6. Fallback chain, per direction.** custom image (`hasImage` and the blob decoded OK) → `art[dir].sprite` (a REGISTRY frame key, validated server-side by `spriteAllowedFor`) → built-in frame from `resolveFrameKey` → placeholder.
- Draw-list-level decisions mirror `resolveDeviceArt`: pure, with `imageReady(item, dir, version)` injected, so it is testable in the node env.
- A package sprite is a registry frame key. It uses the same atlas, and `spriteFits` guarantees fw ≤ iw and fh ≤ ih. Draw it bottom-left aligned. Its tiles differ from the built-in frame's, so `addItem` must take the frame key from the art, while shadow and blocking use that frame's registry entry.
- Today `unknown` is pushed and the item is skipped when there is no frame. A "square placeholder" for an item with no frame at all is new. Is there an existing placeholder frame key?
  - The device placeholder exists but is device-sized. Check the manifest for a reusable key (grep `placeholder` in registry/keys.json).
  - Otherwise this ticket adds a `shadow`-like `placeholder` op, a box drawn by `paint.ts`.
- `seat` direction: the chair row `chair.office` has art too. Chair art per direction applies to chairs that desks imply (`chairFor` gives `chair.office.{n,e,s,w}` keys). The chair row is on the layout `items` whenever there are seats.
- `desk.single` art is per direction `ROTATION_TO_DIR` (rotation 0 → `s`, 90 → `e`, 180 → `n`, 270 → `w`). The 039.1 note says rotation 0 is `n` in the spec, but the code draws `s`. Draw by the code mapping.
- A non-directional item always uses `s` art, whatever the rotation. Floors use `s`.

**F7. Image loading and caching.**
- `createImageUrlCache` is keyed by a single `id`, with a version. It calls `load(id)` and holds at most 4 in flight. It is typed on `DeviceTypeDto` pick (`id, hasImage, imageVersion`).
- `createCatalogImages` wraps it with a decode step keyed on `SeatDeviceType`. `useCatalogImages` is the hook, hard-wired to `createDeviceTypesApi(apiFetch).getImage(id)`.
- `useCatalogImages` is called once per page: `LayoutEditorPage` and the RoomMap section. Both views take `catalogImages`.
- Reuse: a second `createImageUrlCache` instance per item art keyed `${builtinKey}/${dir}` (one entry per slot, version = imageVersion). Slot ids contain `/`, so the load function must split them. Do not run the new key through the device-type API.
- The cache holds one version per id. A version bump revokes and reloads, as for devices.
- The image route is `GET /api/map-items/<key>/art/<dir>/image`. It answers `Cache-Control: private, no-cache` with an org-specific ETag, `Vary`, and 304.
  - Because of `no-cache` plus the ETag, the browser revalidates every fetch. That is acceptable: the fetch happens once per `{key,dir,imageVersion}` per page mount.
  - The cache should not add `?v=`. It keys on `imageVersion` in memory.
  - Do not fetch with raw `fetch`. Use `apiFetch` (the bearer token is in memory), as the ticket says. A 404 or 502 gives `null`, which means "failed" and falls through to the sprite or frame.
- When to fetch: `hasImage` true for a direction that is displayed. Optimisation: only fetch the directions actually used (a placed fixture's rotation → dir) and only for keys placed in the layout. The palette thumbnails (Q4) would otherwise cause up to 4×N fetches for the whole catalog.
- Two views on a page (map, editor) share one hook instance, per the existing "call it once per page" rule. Extend `useCatalogImages` to take items as well as seat devices, or add `useMapItemImages(items)` and feed both. Prefer one decode map (`decoded`) with a composite key. Check that the `decodeReady` logic in `createCatalogImages` generalises. It reads `types` and `SeatDeviceType.imageVersion`.
- Blob revocation on unmount and on version changes already works in `image-url-cache`.
- Failing image: `load` returns `null` → state `failed` → the draw list falls back. A decode failure (`decode(url)` null) also counts as not ready.
- Retry: a `failed` entry is final until `imageVersion` changes. Say so in the plan. A reload re-attempts.

**F8. Which items feed which view.**
- Read-only map and editor draw placed items from `layoutResponse.items` (039.3, hidden ones included for every member). They must not use `GET /api/map-items`. Non-Admins would not get hidden rows from it.
- The palette alone uses `GET /api/map-items`, and only the editor (Admin) loads it.
- Check that `MapView` (`src/lib/sprites/map-view.ts`) carries `items`. My grep found no `items` in `map-view.ts`, so `LayoutResponse.items` is probably dropped when the view is built. The planner must verify and add it.
- The editor draft is built from the same view, so it needs items for placed hidden things.
- The palette list is a separate fetch. A new `createMapItemsApi(apiFetch)` in `src/ui/mapItems/` (or `roomlayout/`) mirrors `device-types-api.ts` (`call` + `ApiAccessError` mapping, returning `{ok,value}`).
- The editor must also know about items placed but absent from the palette response (hidden, or a stale list). The editor's lookup is `catalogFootprints(palette ∪ layout.items, registryFootprints)`, with the fallback keeping older behaviour when a key is missing.

**F9. Editor-side effects of the swap (A8).**
- Rotation rules, `turnable` (`directional` from the DTO, not `spriteInfo`), place preview, hit tests and save pre-validation all take the lookup. This is a cross-cutting parameter on about 8 functions, plus the reducer state (`initEditor`, `Draft`). Where it lives is a design choice (Q1).
- Placing into a gap: the editor's `placeItem` runs `checkLayoutRules(rulesInput(next))`. With catalog sizes, a larger item may no longer fit or overlap. The code is the same, and results change only when the lookup differs.
- The server's `layout_item_hidden` 422 (A5 of 039.3): the editor must map this code in `save-errors.ts` with a user message. Check that it is already mapped ("one line", 039.3 plan). Palette filtering stops most hits, but a stale tab can still hit it.
- `size changed while editing`: if an Admin resizes an item in another tab, the lookup in this tab is stale until reload. The server re-checks at save time and returns the layout 422 codes already mapped. State this as accepted.

**F10. Tests (Vitest node env, no DOM).**
- Pure units work well: palette builder (filter hidden, kind filter, alphabetical groups, name sort within group, tolerant of an unknown group).
- Draw list with items: custom ready / not ready, sprite pick, no art, resized item bottom-left offset, 90/270 swap, non-directional uses `s`, floor tile repeated, chair art, missing catalog row falls back to the registry.
- `tiles.ts`/`place-tool.ts`/`pointer-gesture.ts` with a lookup: ghost size, hit cell, itemAt for a 3×1 catalog size on a 2×1 registry key.
- Image cache keyed by `{key,dir}`: loading, version bump revokes, failure falls through, dispose. Reuse the style of `image-url-cache.test.ts` and `catalog-images.test.ts`.
- API client with a fake fetcher.
- `RoomMap.test.tsx` and `LayoutEditorViews.test.tsx` exist (they are `.tsx`). The tests must pass in the repo's current setup. Check `vitest.config` for a DOM environment. If it is node-only, those tests are `renderToStaticMarkup` style. Keep new UI logic out of components so it stays unit-testable.
- `paint.ts` is canvas code. Test with a fake `ctx` (spy on `drawImage` args), as for the existing image op.

## Recommendations

R1 (AC1). Add `src/lib/layout-editor/palette.ts` `catalogPalette(items: MapItemDto[])` as a pure function. Keep only kind seat or fixture and not hidden. Group by `group`, sorted by name with a stable compare (`localeCompare` plus the key). Sort entries by name then key. `PaletteEntry` gains `name`.
- The `Palette.tsx` heading and `onArm` still use `sprite` (= `builtinKey`). `copy.itemName` should take the catalog name, so tool names (`LayoutEditor.tsx:52`) and the inspector show Admin names. Fall back to `sprite.replaceAll(".", " ")` for an unknown key.
- The Palette's group heading becomes the Admin's `group` string. `copy.palette.groups` is no longer used, so remove or keep it only as a fallback.
- Where `desk.single` goes: the seat row belongs to the palette too (its group is whatever the Admin set). Today the desk tool is armed by `desk.single` with `kind: "seat"`. Preserve `onArm` behaviour for seats.

R2 (AC1, A8). Add a `FootprintLookup` to editor geometry. Smallest change: a module-free parameter. `footprintCells(item, lookup)`, `footprintBox`, `itemAt`, `itemsInRect`, `dragPreview` and `placementPreview` take a `lookup` argument defaulting to `registryFootprints`. Alternatively, store the lookup in `Draft` or editor state.
- Do not mutate a module global. A global is hidden state shared between tests.
- I recommend a `lookup` field on the editor state, built once from `catalogFootprints(items, registryFootprints)`. The reducer passes it to `draft.ts` operations (`placeItem`, `moveItems`, `rotate`) and `rulesInput`/`checkLayoutRules`/`fixturesOnDesks`, `validateLayoutSave` (`editor-state.ts:99`, `save-run.ts:100`). Pure and testable.
- Build the lookup from `layout.items` merged with the palette list. When it gets a list update, it re-derives.
- Use `footprintAt` rather than `footprintOf` for rotation swapping. Registry `footprintOf(sprite, rot)` already picks the frame for each rotation, but `footprintAt` swaps the catalog's rotation-0 size.

R3 (AC2). Generalise the image op once and use it for both devices and items. Suggested shape: `{type:"image", layer, source:"device"|"item", id:string, version:number, ...Rect}` and a `fit` field (`"scale"` for the device box, `"natural"` for item art), or just let `paintRoom` know by `source`. Keep `DEVICE_IMAGE` for devices. Item image rect = bottom-left of the item box: `x = item.x*TILE`, `y = (item.y+ih)*TILE - imgH`, `w = imgW`, `h = imgH`. The box height ih comes from the catalog, and imgH is the image's declared height (32·th .. 32·th+32), known from the decoded image's natural size, or from the DTO (the server validated it). Use the decoded size in `paintRoom`, since the draw list is pure and cannot know it. Draw-list code emits a rect with `h = 32*ih` and `paint` extends upward by `(natural height - rect.h)`, with a test for the overhang. Choose one and put it in the plan, because bounds (`union`) must also include the overhang (image taller than its box above the room edge: bounds.y becomes negative, which `paintRoom` already handles through `translate(-bounds.x, -bounds.y)`). Requires knowing the image height at list-build time, so put `imgH` in the ready callback or have `images.size(...)` return `{w,h}`.
- Keep the fallback decision pure: `resolveItemArt(item, dir, imageReady) → {type:"image"|"sprite"|"frame"|"placeholder", ...}`. Put it in `src/lib/sprites/item-art.ts` beside `device-slots.ts`, with tests.

R4 (AC2). Placeholder: reuse an atlas frame if one exists, else a `placeholder` op painted as a hatched square. Make that choice explicit (Q2). A failing or missing image on a custom-image item must draw the sprite/frame first (per spec), and the placeholder only at the end. Only a missing frame (no built-in frame at all) reaches the placeholder in practice, which means the placeholder is nearly dead code for library items. The spec's "failing image draws the placeholder" in AC2 conflicts with the chain: an item with a built-in frame falls back to the frame, not the placeholder. Flag it. The ticket AC reads as if the placeholder shows on a failed image. The chain says frame first. Spec wins (spec lines 400-402). Confirm with Ming/planner.

R5 (loading). Add a generic `createImageUrlCache` key type. The simplest change that avoids touching device types: a small adapter file `src/ui/roomlayout/item-images.ts` that wraps `createImageUrlCache` with `id = "<key>/<dir>"`, `hasImage`, `imageVersion`, and `load(id)` that splits the id and calls `mapItemsApi.getImage(key, dir)` (a `Blob | null`, with the same PNG check as `getImage` of device types). Then reuse the decode step. Prefer a single `createCatalogImages` generalisation: parametrise by a `Typed`-like `{id, version, hasImage}` list and a `load`, and instantiate it twice (devices, items) inside `useCatalogImages`, returning one object with both `ready`/`source` pairs and a combined `version` counter. Keep the "call once per page" rule.
- Sync inputs: the layout's `items` (not the palette list), narrowed to the directions used by placed things.
- The palette in the editor needs no images in this ticket (thumbnails are not in scope or AC). Do not add them.

R6 (draw list). `buildDrawList` gets a new optional parameter, `items: ReadonlyMap<string, LayoutItem>`, plus an `itemImage` resolver (ready + natural size). With no items passed (older tests and callers), the output must stay byte-identical. Keep the default parameters and add a test that pins `buildDrawList(...)` output with `items` omitted equal to current fixtures in `placement.test.ts`.
- Per item: `dir = ROTATION_TO_DIR[rotation]` for directional items, `s` otherwise. Footprint from `footprintAt(sprite, rotation, lookup)`. Sort rows, shadow and `blocks` from the registry frame as today unless Q3 says otherwise.
- Chair: the chair keys (`chair.office.{dir}`) use `items.get("chair.office")` art for the chair's own direction `dirOf(chair.key)`.

R7 (R1/R6). Keep layers: pure code in `src/lib/**`, the API client and hooks in `src/ui/**`. No `src/server` import. Org scoping is entirely server-side (`GET` is org-scoped by token). The client adds nothing. Copy goes in `src/ui/copy/roomlayout.ts` (D36). A load failure of the palette needs a message ("Could not load the item list") and a retry, and must not block the editor. Palette fetch errors: disable the placement tools, still allow move, rotate and delete. Offer a reload.

R8 (R4/R5). Not in this ticket: Admin page (039.6), thumbnails, per-desk art, changing `sprite_key`. Update `docs/spec-v1.md` only if the AC placeholder conflict (R4) is decided.

## Risks

- **K1. Four things must stay in sync for a size**: server check (catalog), editor check (lookup), draw box (frame vs catalog) and hit area. If the editor lookup is built from a stale palette list while `layout.items` is newer, the editor shows a valid place the server refuses (mapped 422 codes cover it). Build the lookup from `layout.items` first, then the palette list.
- **K2. Image overhang bounds.** `bounds` is the union of all ops. Overhang pushes bounds above row 0, so `fitsCanvas`/`allowedZooms` change slightly and the canvas gets taller. The overlay positions (`SeatOverlay`, `GestureOverlay`) assume the room origin at bounds origin? Check how `EditorCanvas`/`RoomMap` offset overlays by `list.bounds.x/y` (device images and tall frames already extend bounds, so likely handled; verify).
- **K3. Decode and `Vary`.** The image route is per org and `no-cache`. The in-memory per-page cache is safe. Do not use a service worker or HTTP cache expectations. Do not put image URLs in shared module state across org switches: the cache is created per hook mount with `apiFetch`, and is disposed on unmount (existing pattern).
- **K4. Canvas repaint churn.** Each decoded image bumps `version` and repaints the whole canvas (`useMemo` on `catalogImages.version`). 12 directions × 30 keys is bounded, but with `limit = 4` loads and N decodes, a page with many items repaints N times. Batch via the existing `onChange` or a microtask debounce if needed. Mention it, no action unless measured.
- **K5. Hidden placed item for a non-Admin.** It draws (from `layout.items`) but is absent from the palette. The inspector or hover name must come from `layout.items`, not the palette list.
- **K6. Seat/devices overlay** positions come from the frame's `tiles`. `desk` is `fixedSize`, so unchanged. Fixture-only change is right.
- **K7. Test environment.** Anything that needs `Image`/`canvas`/`URL.createObjectURL` must be injected (`decode`, `create`, `revoke`), as the existing code does. Keep to that.
- **K8. Spec text** says "in the Admin's order" (LAY-03). D67.1 changed this to name order. The spec text is a known follow-up, not this ticket.

## Open questions

Q1. Where does the lookup live in editor state: a field on the reducer state, or a parameter on every geometry function? Recommend state, plus defaulted parameters on the pure geometry functions.
Q2. Placeholder: does the atlas have a placeholder frame key? If not, is a painted hatched square acceptable (new op type)? Also confirm the AC2 wording. A failing image on a library item falls back to its package sprite or built-in frame, and shows the placeholder only when no frame exists.
Q3. For a resized item with only the built-in or package sprite (smaller than the box): do the shadow, the sort row and `blocks` use the frame's own size (recommend, matches "drawn at its own size") or the catalog box? And are the cells of the catalog box all blocked even if the sprite is smaller (the server already blocks them, per 039.3 overlap rules)?
Q4. Should the image op for items know the natural height before the draw list is built (needs an `images.size` callback), or does `paintRoom` extend upward at draw time and the bounds accept a fixed +32 px overhang allowance for items with a custom image? The second is simpler and over-allocates by at most 32 px.
Q5. Does `MapView` already carry `LayoutResponse.items`? If not, adding it is a small contract change inside `src/lib/sprites/map-view.ts` and its tests.
Q6. Palette fetch failure for an Admin: block the tools, or fall back to the registry palette (the current `editorPalette()`)? Registry fallback would let an Admin place a hidden or renamed item, which the server then refuses with `layout_item_hidden`. Recommend blocking with a retry rather than falling back.
Q7. Should the "Add items" palette show items whose kind is `chair`? The type comment says seat or fixture only, so no.

Relevant files:
- /home/user/simap/src/lib/layout-editor/palette.ts
- /home/user/simap/src/lib/layout-editor/tiles.ts
- /home/user/simap/src/lib/layout-editor/place-tool.ts
- /home/user/simap/src/lib/layout-editor/draft.ts
- /home/user/simap/src/lib/layout-editor/pointer-gesture.ts
- /home/user/simap/src/lib/layout-editor/editor-state.ts
- /home/user/simap/src/lib/layout-editor/save-run.ts
- /home/user/simap/src/lib/sprites/placement.ts
- /home/user/simap/src/lib/sprites/layout.ts
- /home/user/simap/src/lib/sprites/map-view.ts
- /home/user/simap/src/lib/validate/layout.ts
- /home/user/simap/src/lib/map-items/footprints.ts
- /home/user/simap/src/lib/map-items/art.ts
- /home/user/simap/src/lib/map-items/types.ts
- /home/user/simap/src/ui/roomlayout/paint.ts
- /home/user/simap/src/ui/roomlayout/catalog-images.ts
- /home/user/simap/src/ui/roomlayout/useCatalogImages.ts
- /home/user/simap/src/ui/roomlayout/LayoutEditor.tsx
- /home/user/simap/src/ui/roomlayout/Palette.tsx
- /home/user/simap/src/ui/roomlayout/EditorCanvas.tsx
- /home/user/simap/src/ui/roomlayout/RoomMap.tsx
- /home/user/simap/src/ui/deviceTypes/image-url-cache.ts
- /home/user/simap/src/ui/deviceTypes/device-types-api.ts
- /home/user/simap/src/ui/copy/roomlayout.ts
