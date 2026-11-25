Consult report for SIM-039.8 (read-only). Earlier analysis (F4-F7, R3-R6) is not repeated. Everything below is what the merged code needs.

## Findings

F1. **Starting point.** The device image path already exists end to end, so slice 2 is mostly generalising it.
- `DrawOp` has `{type:"image", typeId, version}` (`src/lib/sprites/placement.ts:17`).
- `paintRoom(canvas, atlas, list, zoom, createCanvas, images)` resolves it through `images(typeId, version)`, and `smoothFor` downscales (`paint.ts:80-92`).
- `createCatalogImages` (`catalog-images.ts`) wraps `createImageUrlCache` (`deviceTypes/image-url-cache.ts`) and adds a decode step.
- `useCatalogImages(seatDevices)` is called by `SeatsPage.tsx:65` and `LayoutEditorPage.tsx:58`. RoomMap and EditorCanvas get `catalogImages` as a prop and gate rebuilds on `catalogImages?.version`.

F2. **What is missing.**
- No `getArtImage` in `map-items-api.ts`. It has only list, patch and reset. `api.getImage` in `device-types-api.ts:65` is the model: it returns a Blob only for `image/png`, and a non-ok response goes through `call`.
- `buildDrawList` ignores `layout.items` and `MapItemArtDto` entirely. Fixtures, seats and floors resolve only through `resolveFrameKey(sprite, rotation)`. Chairs are hardcoded as `chair.office.<dir>` in `chairFor`.
- `RoomMap` and `EditorCanvas` pass nothing from `LayoutResponse.items`.
- Only `EditorCanvas` and `RoomMap` call `buildDrawList` (grep). `LayoutEditorPage` has `map.state.view?.items`. Check that `LayoutEditor` forwards it.

F3. **Stale deps in `EditorCanvas`.**
- The `list` memo uses `[atlas, draft, seatDevices, catalogImages?.version]`.
- The paint effect uses `[atlas, list, effective, setFailed]`. It omits `catalogImages?.source`. This works today only because the `source` closure reads a ref and `list` changes with `version`.
- If the new art source is a second object, both memo deps and effect deps must include its version, or the first decode is painted blank.

F4. **Identity of the cache key.**
- The device cache keys by `typeId` alone and drops an entry when the version changes (`image-url-cache.ts:68-70`). That is wrong for items: key must be `${key}|${dir}`, with the version as the validity stamp. Do not reuse `createImageUrlCache` as is, because its `Typed` is `{id, hasImage, imageVersion}`.
- Cheapest reuse: generalise `createImageUrlCache` and `createCatalogImages` over `{id: string, hasImage, imageVersion}`. Items are then synced as `{id: "<key>|<dir>", hasImage, imageVersion}`, and `load` splits the id (or the cache takes a `load(entry)` callback). This also covers the "failed stays failed until version changes" rule (`state: "failed"` with a version match is already there).
- Only `sync` gathers inputs from `SeatDevice.deviceType`. That is the one device-specific part.

## Recommendations

R1. **Art resolver** (new pure `src/lib/sprites/item-art.ts`, or `src/lib/map-items/`; lib layer only). Signature roughly `resolveItemArt(item: LayoutItem | undefined, dir: Direction, ready: (key, dir, version) => boolean): {type:"image", key, dir, version} | {type:"frame", key: string} | {type:"placeholder"}`.
- Direction (Q2-Q4 defaults): directional → `ROTATION_TO_DIR[rotation]`; non-directional or floor → `s`. Implied chair → `chair.office`'s own art for the chair's direction. The chair needs its catalog row in `layout.items`; confirm 039.3 includes chair rows, and if absent use the frame.
- Chain, in order:
  1. `art[dir].hasImage && ready(...)` → custom image.
  2. `art[dir].sprite` is a frame key in `manifest.frames` → package sprite.
  3. Library frame via `resolveFrameKey`, if it exists in the manifest.
  4. Placeholder.
- Treat a package `sprite` as unknown (and skip it) if `manifest.frames[sprite]` is missing. Do not trust the registry alone. Push to `unknown` the same way `lookup` does.
- A custom image that is not yet ready or has failed falls through to steps 2-3. Never skip straight to the placeholder, because the spec wins over the ticket wording (already flagged in the 039.5 plan).
- Items absent from `layout.items` (older cached view, rows not yet loaded) fall back to steps 3-4 with the `REGISTRY` size. Keep this path exercised, since `RoomMap` tests today pass no `items`.

R2. **Generalise the image op.**
- Replace `typeId` with a source id and keep the device fields working: `{type:"image", srcKey: string, version, ...Rect}`. The device id becomes `d:<typeId>`, the item id `i:<key>|<dir>`.
- `paintRoom`'s `images` callback then stays `(srcKey, version) => CanvasImageSource | null` and does not change. A single `catalogImages.source` can serve both.
- Prefer that over two sources. A two-callback API forces `EditorCanvas`/`RoomMap`/`SeatsPage` prop churn.
- Add `placeholder` as a separate op `{type:"placeholder"} & Rect`. Do not draw it as an image with a missing source, because `paint.ts:81-91` silently skips an absent source. The device placeholder is an atlas frame (`DEVICE_SPRITE.other`), but items have none (Q2). Paint a hatched square, painted per zoom, with no atlas dependency and no `tintedFrame`.
- Under the fake ctx in `paint.test.ts`, count `drawImage` calls and `fillRect`/`stroke` calls.

R3. **Bottom-left alignment and box.**
- Item image op: `x = tx*32`, `w = 32*tw`, `h = 32*th`, `y = (ty+th)*32 - h`. Image height `H > 32*th` (overhang) extends upward: `y = (ty+th)*32 - H`, `h = H`.
- Package sprite smaller than the catalog box (Q3): the existing `frame` op, with the anchor from the frame. Bottom-left of the box means `x = tx*32 + f.anchor[0]`, `y = (ty+th)*32 - f.h + f.anchor[1]`.
- This replaces the current top-left rule in `emitFrame` (the A9 interim) only when the item's catalog box differs from the frame's `tiles`. For unchanged items the output must stay byte-identical. Add a regression test for that: existing `buildDrawList` tests must pass untouched.
- Q3 stays as proposed: shadow, sort row and `blocks` use the frame's own tiles. The catalog box blocks placement only on the server (039.3).
- `addItem` reads `w`/`d` from `frame.tiles`; keep that. The box for the image op comes from `LayoutItem` and rotation, swapped via `sizeFor` from `@/lib/map-items/art` (pure, lib to lib is allowed).

R4. **Overhang and bounds (Q4).**
- `bounds` is built in `buildDrawList`, before decode, but the paint happens after. The draft Q4 mixes the two ("paintRoom extends upward ... bounds reserves a fixed +32").
- Cleaner: make the decoded size known to the pure builder. Pass `imageSize: (key, dir, version) => {w,h} | null` (alongside or instead of `imageReady`), so the op carries the exact `y/h` and `bounds` unions exactly. `paintRoom` then needs no knowledge of overhang and the canvas never clips.
- It needs `createCatalogImages` to expose the natural size: `naturalHeight` or `height` from the decoded `CanvasImageSource`, as `smoothFor` already reads. `decoded` already holds the source.
- If Ming wants the fixed reserve instead, keep it only for items with a ready custom image whose `y` goes negative, and still clip-test with `bounds.y`.
- Check `allowedZooms(list.bounds)` and `fitsCanvas`. The canvas size changes when an image becomes ready, which shifts the origin and the seat button overlay. `SeatOverlay`/`GestureOverlay` use `bounds`/`SeatBox` (room coordinates). Verify that they subtract `bounds.x/y` already (device slots overhang today) and cover a negative `bounds.y`.
- A custom image taller than the box needs a larger top margin. The editor's ghost and outline use the catalog box (A9), so they stay correct.

R5. **Item image cache and hook** (`src/ui/roomlayout/useCatalogImages.ts`).
- Add `items?: readonly LayoutItem[]` and `placed` (what the page actually draws) to its inputs. The directions to load come from `{rotation → dir}` of placed fixtures, seats, floors and implied chairs, intersected with `art[dir].hasImage`.
- Compute that set in a pure lib function, `placedArtKeys(layout, items) → {key, dir, version}[]`. It is trivially unit-testable in node and avoids duplicating the dir rules between the hook and `buildDrawList`. Prefer the layout's `items`, never the palette list.
- In the editor, the draft changes on rotate (new directions become visible). Sync from the draft's layout, not the loaded view, so a rotated item loads its new direction. Do not refetch already-ready entries.
- `api.getArtImage(key, dir)` returns `Blob | null` through `fetcher`. Encode the key. Treat a non-`image/png` response, 404 and 401/403 as null (failed), as `getImage` does.
- Keep the concurrency `limit` of 4 and revoke on dispose.
- `useCatalogImages(seatDevices, items)` can stay one hook returning `{version, ready, source}` with `ready(t)` for devices and `itemReady(key, dir, version)`. Hook count per page stays one ("call it once per page").
- SeatsPage and LayoutEditorPage both need the new `items` argument; RoomMapSection passes `catalogImages` through already.

R6. **Wiring.** `RoomMap`/`EditorCanvas` pass `layout.items` (or `view.items`) to `buildDrawList` as a defaulted trailing parameter (existing callers and tests unaffected), plus the item image lookup. Add `catalogImages?.version` to the `RoomMap` memo (it is already there) and to the paint effect deps in `EditorCanvas`.

R7. **Tests (Vitest node env, no DOM).**
- `item-art.test.ts`: the chain in order for each of the four failure paths (not ready, failed, unknown sprite, no row); direction mapping for directional, non-directional, floor and chair; package sprite on a resized item.
- `placement.test.ts`: bottom-left coordinates for 1x2 sprite in a 2x2 box at each rotation; overhang `y` and `bounds`; an unchanged item gives an identical list; placeholder op box; order and layer of the new ops against the `rank` sort.
- `paint.test.ts` with a fake ctx: image op draws once with the source and box; smoothing toggles via `smoothFor`; a missing source draws nothing (device behaviour) but a placeholder op draws the hatch; an error in one op does not stop the loop.
- `catalog-images.test.ts`/new `item-image-cache.test.ts` with fake `load/create/revoke/decode` and injected `onChange`: one load per `{key, dir, version}`; a version bump drops, revokes and refetches; a failed load stays failed until the version changes; sync with a removed direction revokes; dispose revokes; the 4-job limit.
- `item-images-api.test.ts` (as `map-items-api.test.ts`): path encoding, non-png, 404 and thrown `ApiAccessError` all give a failed result, never a throw.
- No component tests are needed for the hook (React testing only if the repo already has jsdom for `RoomMap.test.tsx`; follow that file).

R8. **For SIM-039.9 (Map items page art per direction).**
- Reuse: the pure `getArtImage` client method, the generalised cache (with the `${key}|${dir}` id), and a pure helper that turns a `MapItemDto` into the entries to load (all four directions for directional items, `s` for others). Do not reuse `useCatalogImages` as a hook, since it is tied to a layout's placed set.
- Make the cache factory constructible with a plain `sync(entries)`, so 039.9 can wrap it in a small page hook. Export the `ItemArtEntry` type from the cache module.
- The upload and reset flow must call `sync` with the new `imageVersion` from the patched DTO; the version stamp makes the old blob invalid automatically.

## Risks

1. **Stale canvas margin (bounds):** if the overhang is applied only in `paintRoom`, `bounds` and the seat overlay disagree with the canvas. Highest-risk item. See R4.
2. **Double reserve:** the fixed +32 reserve (Q4) plus a decoded height from the server may leave a transparent strip or clip. It is cosmetic, but visible on the read-only map.
3. **Regression:** changing `emitFrame` alignment for every item could move existing rooms. Only branch when box differs from the frame tiles.
4. **Cache key bug:** reusing `createImageUrlCache` as is would key by `key` only and thrash across directions (F4).
5. **Directional chair art:** it needs the `chair.office` catalog row. If `layout.items` omits chairs, custom chair art silently never shows. Confirm with the 039.3 contract.
6. **CSP:** `img-src ... blob:` already allows blob URLs (`headers.ts:37`). No change.
7. **Large rooms:** many placed items with art means up to 4 fetches per key. The concurrency limit of 4 holds; `ETag`/`Vary: Authorization` is already server-side.

## Open questions

1. Q4 as drafted: reserve a fixed +32 px, or pass decoded sizes into `buildDrawList` for exact bounds (R4)? I recommend decoded sizes.
2. Does `layout.items` include `chair.office`? If not, custom chair art is out of scope until it does.
3. Placeholder look: hatched square with outline, any colour preference? Default: the existing neutral grey tone used for the device placeholder.
4. In the editor, should placing or rotating an item with custom art load it immediately (draft-driven sync, R5), or only on reload? I recommend draft-driven.

Files read: `/home/user/simap/src/lib/sprites/placement.ts`, `/home/user/simap/src/ui/roomlayout/paint.ts`, `/home/user/simap/src/ui/roomlayout/catalog-images.ts`, `/home/user/simap/src/ui/roomlayout/useCatalogImages.ts`, `/home/user/simap/src/ui/roomlayout/EditorCanvas.tsx`, `/home/user/simap/src/ui/deviceTypes/image-url-cache.ts`, `/home/user/simap/src/ui/mapItems/map-items-api.ts`, `/home/user/simap/src/lib/map-items/art.ts`, `/home/user/simap/src/lib/map-items/types.ts`, `/home/user/simap/src/lib/map-items/footprints.ts`.
