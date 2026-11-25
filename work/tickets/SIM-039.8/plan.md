Status: READY

# Plan — SIM-039.8: Map rendering from the catalog: per-direction art and custom images

Slice 2 of SIM-039.5. One implement/review cycle (estimate ~330 product lines, ~420 test lines); no split.

## Scope summary
- Ticket Goal: "the editor and the read-only room map draw each placed item with the org's catalog art per
  direction, including Admins' custom images."
- `docs/spec-v1.md:400-401` (Art per item): "Fallback order for each direction of an item: custom image → chosen
  package sprite → the library's built-in frame → the square placeholder. The overlay sprites (seat state, avatars,
  device placeholder) stay built-in and are not chosen per item."
- LAY-06 (`docs/spec-v1.md:440-444`): "Every placed fixture, desk, chair and floor tile is drawn with its map item's
  current art for the placed direction … a custom image is drawn 1:1 in room pixels with nearest-neighbour zoom and
  is never rotated; a package or built-in sprite smaller than the item's size is drawn at its own size, bottom-left
  aligned in the footprint. A custom image that cannot be loaded falls back the same way. Art changes show at the next
  layout load."
- LAY-03 (`docs/spec-v1.md:427-428`): "Existing layouts keep drawing exactly as before."
- LAY-01: footprint = catalog size, 90°/270° swap.
- D66 (3): "a missing direction falls back to the chosen package sprite, then the built-in frame, then the
  placeholder; one image is never rotated"; (4) floors accept custom uploads; (7) "Custom images: PNG … 32 px per tile
  of the item's size for that direction, up to 32 px upward overhang (floors exactly 32 × 32)". OQ-53 default (spec
  line 723): "the sprite draws at its own size, bottom-left aligned in the footprint".
- D67 (3): placed items reference their catalog row, "changing its image changes how saved layouts show it".
- D68: device images 24–100 px scaled to the slot (the existing device op; must keep working after the op is
  generalised).
- SIM-039.5 plan § Split proposal (Q2-Q4 defaults, direction rules, image loading rules) — applied below, Q4 changed
  (A1).
- Ticket Scope: renderer chain for fixtures, desk, chair and floors; images via `apiFetch` from
  `GET /api/map-items/<key>/art/<dir>/image` as `blob:` URLs cached per `{key, dir, imageVersion}`, only for placed
  directions; draw inputs from the layout's `items`; generalise the device image op.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Custom art shows on the editor and the read-only map; a failing image falls back to the package sprite, then the built-in frame, then the placeholder. | `item-art.test.ts` chain cases (ready image; not ready / failed / wrong size → package sprite → library frame → placeholder); `placement.test.ts` › "custom image op …", "fallback when the image is not ready"; `paint.test.ts` › item image and placeholder cases; wiring: `RoomMap.tsx`, `RoomMapSection.tsx`, `EditorCanvas.tsx`, `LayoutEditor.tsx` pass `items` (code read). Local run (optional, needs Drive config): `PUT /api/map-items/plant.large/art/s/image` with a 32×64 PNG, reload `/seats?room=<code>` and `/rooms/<code>/edit`: the plant shows the image, 32 px taller than its tile. |
| 1b | Nothing customised → existing rooms draw byte-identically (LAY-03). | `placement.test.ts` › "seed catalog rows change nothing": for every `LIBRARY_ITEMS` entry at every rotation (plus seats with chairs and floors), `buildDrawList(..., {items: seedRows})` `toEqual` the list without items; all existing `placement.test.ts` / `paint.test.ts` cases pass with only the `typeId` → `src` rename (2 lines). |
| 2 | A resized item's package sprite is drawn at its own size, bottom-left aligned in the catalog box. | `placement.test.ts` › "package sprite smaller than the box is bottom-left aligned" (1×1 sprite in a 2×2 box at 0/90/180/270; frame op x = box left + anchor, y shifted by (boxH − spriteH)·32; shadow and sort row follow the sprite's own tiles); › "resized item with the library frame is bottom-left aligned". |
| 3 | Images are fetched with the bearer as `blob:` URLs, once per key, direction and version per page; checks green. | `map-items-api.test.ts` › `getArtImage` cases (path `/api/map-items/<encoded key>/art/<dir>/image` through the fake `fetcher` = `apiFetch`); `catalog-images.test.ts` › item cases (one load per `{key, dir, version}`, version bump reloads and revokes, failed stays failed, removed entry revoked, devices and items share one cache); `item-art.test.ts` › `placedArtEntries` (only placed directions with `hasImage`). Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
- On the deployed app (Drive configured), as Admin: upload a custom image for one direction of a placed fixture, of
  `desk.single` and of a floor (API `PUT …/art/<dir>/image` until SIM-039.9 adds the UI). Reload the room map (Seats
  page) and the room editor: the images show 1:1, the overhang above the item is visible and not clipped, seat buttons
  still sit on the desks. Pick a smaller package sprite for a resized fixture (`PUT …/art/<dir>`): it sits at the
  bottom-left of the item's box. A room with no customised items looks exactly as before.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/item-art.ts` (new) | Pure resolver and helpers (see Approach 1): `itemImageId`, `parseItemImageId`, `itemArtDir`, `itemBox`, `imageFits`, `resolveItemArt`, `placedArtEntries`, type `ItemArtEntry`, `ItemImageSize`. Imports only `./registry`, `./types`, `./layout` (types) and `@/lib/map-items/types` — **never** `@/lib/map-items/art` or `library` (cycle: `library` → `validate/layout` → `placement`). | AC 1, 2, 3 | no |
| `src/lib/sprites/item-art.test.ts` (new) | Resolver, direction, box, fits, entries tests. | R5 | no |
| `src/lib/sprites/placement.ts` | Image op generalised: `typeId` → `src` (line 17, 84, 223, 275); new op `{type:"placeholder"; layer} & Rect`; `buildDrawList` gains trailing `art: { items?: readonly LayoutItem[]; image?: (key, dir, version) => ItemImageSize \| null } = {}`; floors (179-187), fixtures (189-192), seats (194-201) and implied chairs go through `resolveItemArt`; `Item` gains `art` (frame / custom image / placeholder) and the bottom-left `y` shift; the emit loop (259-284) emits the item image / placeholder ops. Seat footprint (198) = catalog box. | AC 1, 1b, 2 | no |
| `src/lib/sprites/placement.test.ts` | `typeId` → `src` at line 369; new cases (Tests). | R5 | no |
| `src/ui/roomlayout/paint.ts` | `images` param renamed `(src, version)` (60, 81); new `placeholder` branch: neutral fill, 1 px outline, one diagonal hatch, painted in room coordinates (no atlas). | AC 1 | no |
| `src/ui/roomlayout/paint.test.ts` | `typeId` → `src` at line 107; item image 1:1 (no smoothing), placeholder, error isolation. | R5 | no |
| `src/ui/deviceTypes/image-url-cache.ts` | `Typed` becomes exported `ImageEntry = { id: string; hasImage: boolean; imageVersion: number }` (drop the `DeviceTypeDto` import, line 1-3); doc line says "per id" not "device type". Behaviour unchanged. | Reuse for items (F4) and SIM-039.9 | no |
| `src/ui/roomlayout/catalog-images.ts` | `sync(devices, items: readonly ItemArtEntry[] = [])` feeds one cache with device entries (id = type id, as today) and item entries (id = `itemImageId`); adds `itemSize(key, dir, version): ItemImageSize \| null` from the decoded source's `naturalWidth/naturalHeight` (else `width/height`); `CatalogImages` type gains `itemSize`; `source` param renamed `src`. | AC 1, 3 | no |
| `src/ui/roomlayout/catalog-images.test.ts` | Item cases. | R5 | no |
| `src/ui/roomlayout/useCatalogImages.ts` | Second param `items?: readonly ItemArtEntry[]`; `load(id)` dispatches: `parseItemImageId(id)` → `mapItemsApi.getArtImage(key, dir)`, else `deviceTypesApi.getImage(id)`; sync effect runs when either input is present (`images.sync(seatDevices ?? {}, items ?? [])`, deps both); return value adds `itemSize`. | AC 1, 3 | no |
| `src/ui/mapItems/map-items-api.ts` | `getArtImage(key, dir)` = `call<Blob>(\`${base}/${encodeURIComponent(key)}/art/${dir}/image\`, GET)`, Blob only for `image/png` (as `device-types-api.ts:65-69`). | AC 3 | no |
| `src/ui/mapItems/map-items-api.test.ts` | `getArtImage` cases. | R5 | no |
| `src/ui/roomlayout/RoomMap.tsx` | Prop `items?: readonly LayoutItem[]`; `buildDrawList(..., catalogImages?.ready, { items, image: catalogImages?.itemSize })`; memo deps + `items`; paint effect deps + `catalogImages` (F3). | AC 1 | no |
| `src/ui/roomlayout/RoomMapSection.tsx` | Pass `items={view.items}` (line 47-55). | AC 1 | no |
| `src/ui/seats/SeatsPage.tsx` | `const art = useMemo(() => view ? placedArtEntries(view.layout, view.items) : undefined, [view])`; `useCatalogImages(view?.seatDevices, art)` (line 65). | AC 1, 3 | no |
| `src/lib/layout-editor/editor-state.ts` | Export pure `editorItems(layoutItems, palette): LayoutItem[]` (palette rows, then layout rows win per key, same precedence as `editorFootprints`, line 78-83). | AC 1 (editor, A4) | no |
| `src/lib/layout-editor/editor-state.test.ts` | `editorItems` precedence case. | R5 | no |
| `src/ui/roomlayout/EditorCanvas.tsx` | Prop `items?: readonly LayoutItem[]`; pass `{ items, image: catalogImages?.itemSize }` to `buildDrawList` (84-90); memo deps + `items`; paint effect deps + `catalogImages` (135). | AC 1 | no |
| `src/ui/roomlayout/LayoutEditor.tsx` | `artItems = useMemo(editorItems(state.layoutItems, state.palette))`; `items={artItems}` to `EditorCanvas`; `entries = useMemo(placedArtEntries(draftToRoomLayout(draft), artItems))`; new prop `onArtEntries?: (e: readonly ItemArtEntry[]) => void` called in an effect keyed on the entries' signature string (`id@version` joined), so the page re-renders only when the set changes. | AC 1, 3 (A5) | no |
| `src/ui/roomlayout/LayoutEditorPage.tsx` | `const [editorArt, setEditorArt] = useState<readonly ItemArtEntry[]>([])`; `useCatalogImages(map.state.view?.seatDevices, editorArt)` (line 58); `onArtEntries={setEditorArt}` on `LayoutEditor`. | AC 1, 3 | no |

No file matches a High path. No server, `src/app/api`, `db/` or copy change (the placeholder has no text).

## Data model / migration
None.

## API contract
None changed. Consumed (SIM-039.4, unchanged): `GET /api/map-items/{key}/art/{dir}/image` → `200 image/png`
(`ETag`, `Cache-Control: private, no-cache`, `Vary: Authorization`), `404 not_found` without an image, any member
(`tier:"user"`, `src/app/api/map-items/[key]/art/[dir]/image/route.ts:61-93`). Layout read
`LayoutResponse.items` (039.3) already includes every used key plus `chair.office` when the room has seats
(`src/server/layout/layout.ts:185-196`).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `item-art.test.ts` › itemArtDir: directional uses ROTATION_TO_DIR (0→s, 90→e, 180→n, 270→w); non-directional and floor use s | direction rules |
| `item-art.test.ts` › itemBox swaps w and h at 90/270 and matches `footprintAt(…, catalogFootprints(...))` for a 3×1 item | LAY-01 |
| `item-art.test.ts` › resolveItemArt: hasImage + ready size that fits → image (src = itemImageId, natural w/h) | AC 1 |
| `item-art.test.ts` › resolveItemArt: image not ready (null size) → package sprite; package sprite missing from manifest → library frame and key in unknown; no library frame in manifest → placeholder | AC 1 chain |
| `item-art.test.ts` › resolveItemArt: decoded size that does not fit (wrong width, height above box+32, floor not 32×32) → treated as failed, falls back | AC 1, D66 7 |
| `item-art.test.ts` › resolveItemArt: no row for the key → `null` (caller keeps today's path) | A3 |
| `item-art.test.ts` › placedArtEntries: one entry per placed `{key, dir}` with `hasImage`, deduped; floors use s; implied chair uses chair.office at the chair's direction (equals the suffix of `chairFor(...).key` for all four desk rotations); directions without an image and keys without a row are skipped; empty layout → [] | AC 3 |
| `item-art.test.ts` › itemImageId / parseItemImageId round-trip; a uuid parses to null | AC 3 |
| `placement.test.ts` › seed catalog rows change nothing: a room with every LIBRARY_ITEMS fixture at every allowed rotation, seats (with chairs) and floors gives a `toEqual` list with and without `{items: seed}` | AC 1b |
| `placement.test.ts` › custom image op: x = box left, y = box bottom − natural h (overhang 32 → y one tile above), w/h natural, layer of the library frame, no shadow; `bounds.y` goes negative for an item on row 0 | AC 1, A1 |
| `placement.test.ts` › fallback when the image is not ready: same list as with no image | AC 1 |
| `placement.test.ts` › package sprite smaller than the box is bottom-left aligned at 0/90/180/270; shadow under the sprite's own tiles; sort row = sprite's bottom row | AC 2, Q3 |
| `placement.test.ts` › resized item with the library frame is bottom-left aligned; unresized item is not moved | AC 2, 1b |
| `placement.test.ts` › placeholder op covers the catalog box with the library layer and sorts like a frame | AC 1, Q2 |
| `placement.test.ts` › desk custom image: seat box, chair and device slots unchanged; chair custom image at the chair tile; floor custom image per tile 32×32 | AC 1 |
| `placement.test.ts` › device image op still centred 24×24 with `src` = type id (renamed field) | D68 regression |
| `paint.test.ts` › item image op draws once at its box with smoothing off (1:1); device image downscale still smooths | AC 1, D68 |
| `paint.test.ts` › placeholder op paints fillRect + strokeRect + hatch and no drawImage; a missing image source draws nothing and later ops still paint | AC 1 |
| `catalog-images.test.ts` › items: one load per `{key, dir, version}`; same key with two dirs loads twice; version bump revokes and reloads; failed stays failed until the version changes; a removed entry is revoked; devices and items in one sync both load; `itemSize` returns natural size only for the matching version | AC 3 |
| `map-items-api.test.ts` › getArtImage: GET path encodes the key; non-png body → not ok; 404 code returned; ApiAccessError signed_out → unauthenticated; fetch throw → unavailable; never throws | AC 3 |
| `editor-state.test.ts` › editorItems: layout row wins over the palette row for the same key; palette-only keys included | A4 |

## Approach
1. **`src/lib/sprites/item-art.ts`** (pure, lib):
   - `ItemImageSize = { w: number; h: number }`; `ItemArtEntry = { id: string; key: string; dir: Direction; hasImage: true; imageVersion: number }` (fits `ImageEntry`).
   - `itemImageId(key, dir) = \`item:${key}|${dir}\``; `parseItemImageId(id) → { key, dir } | null` (device type ids are uuids, never `item:`).
   - `itemArtDir(item, rotation)`: `item.kind === "floor" || !item.directional ? "s" : ROTATION_TO_DIR[rotation]`
     (`ROTATION_TO_DIR` passed in or duplicated as a 4-entry const to avoid importing `placement`; a test asserts
     equality).
   - `itemBox(item, rotation)`: `[w,h]`, swapped at 90/270 (same rule as `footprintAt`; inline, no `map-items/art`
     import).
   - `imageFits(item, box, size)`: floor → 32×32; else `w === 32·boxW && 32·boxH ≤ h ≤ 32·boxH + 32`
     (`MAP_ITEM_LIMITS`), mirroring `mapItemImageFits` (`src/lib/map-items/art.ts:39-52`).
   - `resolveItemArt({ item, dir, box, libraryKey, frames, image, unknown })` →
     `{type:"image", src, version, w, h}` | `{type:"frame", key}` | `{type:"placeholder"}`:
     (1) `art[dir].hasImage` and `image(key, dir, version)` fits → image; (2) `art[dir].sprite` with
     `frames[sprite]` → frame (missing frame → push to `unknown`, continue); (3) `libraryKey` with `frames[libraryKey]`
     → frame; (4) placeholder (push the sprite to `unknown`).
   - `placedArtEntries(layout, items)`: fixtures and seats at `itemArtDir`, floors `s`, one chair entry per seat at the
     opposite of the desk's direction (`s↔n`, `e↔w`, as `chairFor`), filtered by `art[dir].hasImage`, deduped by id.
2. **`placement.ts`**:
   - Image op `src` replaces `typeId`. Add the placeholder op.
   - `const byKey = new Map(art.items.map(i => [i.builtinKey, i]))`.
   - A key with no row keeps today's code path exactly (A3).
   - With a row, `box = itemBox(row, rotation)` and `resolveItemArt(...)`:
     - frame: `addItem` with the chosen frame; `y += box[1] - frameTiles[1]` (frame tiles = `REGISTRY[key].tiles ?? [1,1]`).
       For the library frame, the shift applies only when the row's size differs from the library default
       (`REGISTRY[resolveFrameKey(key,0)]?.tiles ?? [1,1]`, the seed rule of `library.ts:31`). This guarantees AC 1b by
       construction. `layer` is the library frame's layer; `shadow`, `blocks`, `sub` and tiles come from the drawn frame (Q3).
     - image: an item with `w/d = box`, `layer` and `blocks` of the library frame, no shadow (A6), sort row
       `y + box[1] - 1`; emitted as `{type:"image", src, version, x: tx·32, y: (ty+box[1])·32 − h, w, h}`.
     - placeholder: same item geometry, emitted as `{type:"placeholder", layer, x: tx·32, y: ty·32, w: box[0]·32, h: box[1]·32}`.
   - Seats: `footprint` = `box` when a row exists (equal to the frame tiles for the fixed desk), so `chairFor`, device
     slots and `SeatBox` are unchanged. Chairs: row `chair.office`, dir = suffix of `chairFor(...).key`, box 1×1.
     `chairKey` stays the library key (avatars pose by it).
   - Floors: per tile, the same chain with box 1×1. Image op 32×32.
   - `emit` already unions every op into `bounds`, so an overhang extends `bounds` upward exactly (A1).
3. **`paint.ts`**: placeholder branch. Item images go through the same `image` branch; `smoothFor` returns false at
   1:1, so they draw nearest-neighbour (LAY-06).
4. **Images**: `ImageEntry` in `image-url-cache.ts`; `createCatalogImages.sync(devices, items)` builds one entry list
   (`[...deviceTypes, ...items]`), so a single cache with the existing limit of 4, revoke-on-drop and
   "failed until version changes" serves both; `itemSize` reads the decoded source. `getArtImage` in the map-items
   client; `useCatalogImages(seatDevices, items)` dispatches `load` by id.
5. **Wiring**: SeatsPage → `placedArtEntries(view.layout, view.items)`; RoomMapSection → RoomMap `items`.
   LayoutEditorPage ← LayoutEditor `onArtEntries` (draft-driven, A5); EditorCanvas `items = editorItems(...)`.
   Paint effects depend on `catalogImages` (F3).
6. Rules:
   - **R1:** new code lives in `src/lib/**` (pure) and `src/ui/**`, with no `src/server` import. Check with `pnpm check:layers`.
     Avoid the `placement` ↔ `item-art` ↔ `map-items/library` import cycle (step 1).
   - **R6/R7:** no server change; the image GET is org-scoped by SIM-039.4.
   - **R3:** no config. CSP already allows `blob:` in `img-src` (consult risk 6).
   - **R4:** device art, overlays, avatars, the Admin page and per-desk art stay untouched.
   - **R5:** the tests above.
   - **D36:** no new copy.

## Specialist input used
consult-frontend-developer.md:
- F1/F2 (device path exists; no `getArtImage`, `buildDrawList` ignores items): adopted as the starting point.
- F3 (stale paint deps): adopted, `catalogImages` added to both paint effects.
- F4 (cache key per `{key|dir}`): adopted through ids `item:<key>|<dir>`. `createImageUrlCache` is reused with only
  its entry type loosened: it already keys by an opaque `id` string with the version as stamp, so it does not need a
  rewrite.
- R1 (resolver chain, unknown-sprite check against the manifest, no row → library frame): adopted. Changed: a key
  with no row keeps today's exact path (no placeholder), so old cached views and tests are unaffected.
- R2: `src` id adopted. Device ops keep the bare type id rather than a `d:` prefix (fewer changes; items carry the
  `item:` prefix). The placeholder op is adopted.
- R3: bottom-left alignment adopted, using the tile-delta shift `(boxH − frameTilesH)·32` added to the existing
  anchor rule, not `(ty+th)·32 − f.h + anchor`, which would move frames with a built-in overhang. The library frame
  shifts only for resized rows (byte-identity).
- R4/Q1: decoded sizes adopted (A1).
- R5 (`placedArtEntries` pure, draft-driven sync, `getArtImage` failure → null): adopted. One cache for devices and
  items, not a second hook.
- R6, R7: adopted. R8: see A10.
- Open questions 2-4: answered in A2, A7 and A5.

## Assumptions
Questions for Ming, answered with defaults (none blocks):
- **A1 (Q4) Overhang: decoded sizes, not a fixed +32 px reserve.** `buildDrawList` receives each ready image's
  decoded size, so the op is exact (1:1 per LAY-06) and `bounds` grows only by the real overhang. The canvas never
  clips and has no transparent strip.
  - Cost: when an image finishes loading, the canvas can grow by up to 32 px at the top. This is a one-time shift
    of the map. Seat buttons, ghosts and outlines follow because they already subtract `bounds.x/y` (`SeatOverlay.tsx:33-34`,
    `EditorCanvas.tsx:264,280`, `canvasCell`).
  - An image whose decoded size breaks the D66 7 rule counts as failed and falls back.
  - Alternative if Ming prefers: a fixed +32 px reserve for items with an image.
- **A2 Chair art.** `layout.items` contains `chair.office` whenever the room has seats (`layout.ts:189`). Chair
  custom images and package sprites are therefore in scope. Avatars keep posing by the library chair direction.
- **A3 Keys without a catalog row** (older cached view, a test without `items`) draw exactly as today. That includes
  "skip and list in `unknown`" when the frame is missing. The placeholder is used only for keys that have a row.
- **A4 Editor art source.** The editor draws with the layout's rows merged with the Admin's palette rows (layout rows
  win), the same precedence as its footprints (039.5 K1). A just-placed item therefore shows its custom art and its
  catalog size before Save. The read-only map uses only `view.items`, never the palette list (039.5 default).
- **A5 (consult Q4) Draft-driven loading in the editor.** Placing or rotating an item loads any newly visible
  direction right away. Images that are already loaded are never fetched again. Art the Admin changes elsewhere still
  shows only at the next layout load (LAY-06).
- **A6 Custom images draw no painted shadow.** The Admin's image is the whole art. Package and library frames keep
  their registry shadow flag.
- **A7 (consult Q3) Placeholder look.** The placeholder is a neutral grey square across the item's catalog box, with a
  1 px darker outline and one diagonal hatch. It is painted on the canvas, so the atlas does not change.
- **A8 Shrunk items.** If a resized item is smaller than its library frame, the library frame still draws bottom-left
  aligned. It can stick out above or to the right of the box until the Admin picks a fitting package sprite or uploads
  an image.
- **A9 Layer.** A package sprite or image draws on the layer of the item's library frame. The layer belongs to the
  item, not to the chosen art.
- **A10 For SIM-039.9 (Map items page art per direction), reuse:**
  - `mapItemsApi.getArtImage`.
  - `createImageUrlCache` with `ImageEntry` and `itemImageId`/`parseItemImageId`, wrapped in a small page hook. Do not
    reuse `useCatalogImages`, which is tied to a layout's placed set.
  - The placeholder paint (or the same look in CSS) for directions without art.
  - `imageFits` for upload pre-checks.
  - After an upload or reset, call `sync` with the patched DTO's `imageVersion`; the version stamp makes the old blob
    invalid.
  - 039.9 adds its own pure helper: `MapItemDto` → entries (all four directions for directional items, `s` for
    others).
- **Hotspots:** no other ticket is IN_PROGRESS, REVIEW or DONE (`work/backlog.md`). SIM-039.9 will touch
  `map-items-api.ts` and `image-url-cache.ts` after this ticket.

## Blocking questions
None.

## Split proposal
None. The estimate is ~330 product lines:
- `item-art.ts` ~110
- `placement.ts` ~80
- `paint.ts` ~20
- image cache and hook ~45
- API ~10
- wiring ~65
