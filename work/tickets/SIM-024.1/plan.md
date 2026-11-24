Status: READY

# Plan — SIM-024.1: Room map renderer, avatars, name tags and dev demo

> **Gate stays `none`.** This plan touches no High path. `next.config.ts` is **not** edited. If the bundle proof fails
> (Approach step 7), the only known fix needs `next.config.ts`, which is High: the implementer stops and the ticket goes
> to Ming for plan approval.

**Environment note for the implementer.** Node is not on the Bash PATH. Prefix commands with
`eval "$(fnm env --shell bash)" && fnm use 22 >/dev/null && ` and use `corepack pnpm ...`.

**Agent limits.** Work only in `d:\project\simap-wt\SIM-024.1`. Never read `.env*`, connect to a database, use port
15432, or run `scripts/start-dev.*`, `pnpm dev:prod` or `pnpm dev:token`. Do not run `pnpm dev` either: its launcher
inspects the `.env` files (`scripts/dev.mjs:89-103`). Agents therefore do not open the demo in a browser, and visual
checks are listed under Ming verification.

## Scope summary
- Ticket: "Renderer in `src/ui/roomlayout/`: plain canvas for art plus an unscaled HTML overlay for seats and name tags,
  with layers floor, wall, shadow, furniture, avatar, overlay".
- Ticket: "Pure placement and draw order in `src/lib/sprites/` (`buildDrawList`, rotation to direction, overlay mapping)."
- Ticket: "Layered avatar compositor (body, hair, shirt) with colours from a stable hash of `sub`; front and back views."
- Ticket: "State overlays, and name tags on hover or keyboard focus only (D50)."
- Ticket: "Dev-only demo page `src/app/dev/roommap/page.tsx`, using fixture data and no API. Production returns `notFound()`."
- Spec LAY "Visual style" (`docs/spec-v1.md:329-330`): "Sprites scale by whole numbers only (2×, 3×, 4×,
  `image-rendering: pixelated`). No game engine or new library: DOM or plain canvas (stack unchanged)."
- Spec LAY-06 (`docs/spec-v1.md:358-363`): "Each seat shows its state with a sprite overlay, not colour alone: empty,
  occupied (a pixel avatar sits there), mine (highlight), cannot-seat (blocked sign), pending request (marker)." and
  "Name tags appear only on hover or keyboard focus, at every zoom (D50)."
- D55: "D47 is lifted for SIM-024 only (sprite atlas, manifest, placeholder art, packing script, renderer and dev demo
  page)". The board (`work/backlog.md:55`) records SIM-024.1 as unblocked by D55.
- Settled defaults: `work/tickets/SIM-024/plan.md:303-331`. They apply except for the two verified corrections below.

### Corrections to settled defaults (both verified against the files)
| ID | Defect | Evidence | Fix |
|---|---|---|---|
| F1 | A canvas of exactly `W·32 × H·32` clips art that overhangs the room. | `plant.large` map anchor `[-4, 32]` (`assets/art/sprite-map.json:469`) becomes manifest anchor `[4, -32]` (`scripts/sprites/pack.mjs:29-30`), so it starts 32 px above its tile. `desk.single.s` is 68 px wide with anchor x 2 (`sprite-map.json:241-242`), so it spans x -2 to 66 on a 64 px footprint. The placeholder overhangs only 16 px (`public/sprites/office.json:776`), so the demo alone would understate this. | `buildDrawList` returns `bounds`, the union of the room rect and every op rect. Canvas size is `bounds.w·zoom × bounds.h·zoom`. Painter and HTML overlay both shift by `-bounds.x, -bounds.y`. |
| F2 | Sorting by each item's own bottom row paints a sub-tile prop on the upper tile of a multi-row host **before** the host, which then covers it. | `desk.single.e` is `[1, 2]` and blocking (`src/lib/sprites/keys.json:178-184`); `prop.mug` has `tiles: null` (`keys.json:442-448`). A mug on the desk's top tile has row `y`, the desk has row `y+1`. `table.meeting.*` has the same shape (`keys.json:522-553`). | A sub-tile item takes the sort row of the blocking full-tile furniture covering its tile. The rest of the order is unchanged: `(sortRow, full before sub, x, id)`. |

### Divergence for Ming: zoom
- Ticket AC 1 and style guide §2 say **1×/2×/3×**. Spec LAY "Visual style" and LAY-05 say **2×/3×/4×**, and SIM-015.1
  also says 2×/3×/4× (`work/tickets/SIM-015.1/ticket.md:56`). `CLAUDE.md`: "If a ticket and the spec disagree, the spec
  wins; flag the conflict."
- **Applied:** one constant `ZOOM_LEVELS = [2, 3, 4]` in `src/lib/sprites/layout.ts`. The renderer's maths is generic over
  an integer zoom, and the demo offers exactly these three levels. AC 1 below is verified at 2×/3×/4×.
- **Rejected:** the architect's "demo shows 1/2/3", because it would ship a level the spec does not list.
- If Ming prefers 1/2/3, the change is that one constant plus its test. The ticket and style guide wording are not edited
  here (planner writes only this file): see follow-ups in Assumptions A10.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The demo page renders the sample room at **2×/3×/4×** (spec; ticket said 1/2/3) with crisp pixels (no smoothing) and every seat state. | `paint.test.ts` › "sets smoothing off after every resize", "uses integer canvas size and offsets at every zoom". `fixture.test.ts` › "covers every seat state". `placement.test.ts` › "ZOOM_LEVELS is 2, 3, 4". Visual result: Ming verification. |
| 2 | Replacing `office.png` + `office.json` with another valid pair changes the art without code changes. | `placement.test.ts` › "a different valid manifest changes ops without code changes". `loadAtlas.test.ts` › "adds ?v only for a string version". Grep: no frame coordinates in `src/ui/roomlayout/`. |
| 3 | An invalid or missing manifest or atlas shows an error state and does not crash the page. | `loadAtlas.test.ts` › 404, bad JSON, failing validator, image error, network rejection each return `{ok:false}` and never throw. `RoomMap.test.tsx` › "error view shows the copy with role=alert". |
| 4 | Avatar colours are stable for the same `sub` and differ across the sample subs. | `avatar.test.ts` › "is stable", "known FNV-1a vectors", "ramps are salted". `fixture.test.ts` › "sample subs have pairwise different looks". |
| 5 | Name tags appear only on hover or focus, and every seat is reachable by keyboard. | `SeatOverlay.test.tsx` › "one button per seat in row, column order", "tag is hidden at rest and shown only by group-hover or group-focus-visible", "tag is aria-hidden and not focusable", "aria-label carries code, state and name". Real keyboard use: Ming verification. |
| 6 | The demo page is not available in a production build, and the committed atlas stays placeholder-only. | (a) `page.test.tsx` › "production calls notFound and never loads the demo". (b) After `pnpm build`, `pnpm check:dev-bundle` passes with the fixture marker in `FORBIDDEN`. (c) `impl-log.md` records the negative control from Approach step 7 (marker **is** detected when the demo is force-included). (d) Existing `committed-atlas.test.ts` › "committed atlas is placeholder-only (M-10 default)" passes, and `git diff --stat main -- public/sprites assets/art` is empty. |
| 7 | Unit tests cover the avatar colour hash, tile-to-pixel placement, draw order, rotation mapping and overlay mapping. | `pnpm test`: the tests listed below. |

All checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`, then
`pnpm check:dev-bundle`. `pnpm test:db` is CI-only and this ticket does not affect it.

## Ming verification after merge
Open `/dev/roommap` in Ming's local dev app:
1. At 2×, 3× and 4×, pixels are crisp. All seat states are recognisable by shape, not colour alone.
2. Check the room at 390 px and on desktop, in light and dark app theme. The map scrolls and tags are not clipped.
3. Tab through the seats: order is row then column, the focus ring is visible, and the tag shows only on hover or focus.
4. At 125% and 150% Windows display scaling, note whether pixels look uneven or soft. **Record the result in the PR**
   (ticket risk). Only if it is unacceptable, open a follow-up for a DPR-aware backing store (A3).
5. Confirm the chair side looks right: a default (rotation 0) desk shows the person from behind, facing the screen (A1).
6. With the local Imersa atlas (`pnpm sprites:pack`, **do not commit**), confirm tall plants are not clipped and desks show
   no seam from the tint (F1, F7). Restore the placeholder atlas afterwards with `git restore public/sprites`.
7. In a production build or deployment, `/dev/roommap` returns 404.

## Files to create / modify
No file below matches a High path.

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/layout.ts` | Create | Provisional `RoomLayout`, `SeatView`, `Rotation`, `ZOOM_LEVELS` | No |
| `src/lib/sprites/placement.ts` | Create | `ROTATION_TO_DIR`, `resolveFrameKey`, `chairFor`, `seatOrder`, `buildDrawList` (with F1, F2) | No |
| `src/lib/sprites/avatar.ts` | Create | FNV-1a, salted ramps, `avatarFor`, view choice | No |
| `src/lib/sprites/overlay.ts` | Create | `overlayFor`, status dot table, `tagPlacement` | No |
| `src/lib/sprites/placement.test.ts` | Create | Placement, order, bounds, rotation | No |
| `src/lib/sprites/avatar.test.ts` | Create | Hash and colours | No |
| `src/lib/sprites/overlay.test.ts` | Create | Overlay and tag rules | No |
| `src/lib/validate/sprite-manifest.ts` | Modify, after line 74 | Reject `frame.tiles` differing from the registry (F4) | No |
| `src/lib/validate/sprite-manifest.test.ts` | Modify | Test for that rule | No |
| `src/ui/roomlayout/loadAtlas.ts` | Create | JSON → image → validate, injectable, never throws | No |
| `src/ui/roomlayout/paint.ts` | Create | Canvas painter and per-atlas tint cache | No |
| `src/ui/roomlayout/SeatOverlay.tsx` | Create | Seat buttons and name tags | No |
| `src/ui/roomlayout/RoomMap.tsx` | Create | `"use client"`: loading, error and ready states, canvas, overlay | No |
| `src/ui/roomlayout/index.ts` | Create | Public entry `@/ui/roomlayout`; **not** added to `src/ui/index.ts` | No |
| `src/ui/roomlayout/loadAtlas.test.ts` | Create | AC 2, AC 3 | No |
| `src/ui/roomlayout/paint.test.ts` | Create | AC 1, with a fake 2D context | No |
| `src/ui/roomlayout/SeatOverlay.test.tsx` | Create | AC 5 | No |
| `src/ui/roomlayout/RoomMap.test.tsx` | Create | AC 3 error and loading views | No |
| `src/ui/copy/roomlayout.ts` | Create | UI copy, English, no diacritics (`no-literals.test.ts:52-60`) | No |
| `src/app/dev/roommap/page.tsx` | Create | Server page with the foldable dev branch | No |
| `src/app/dev/roommap/RoomMapDemo.tsx` | Create | `"use client"`: zoom state, renders `RoomMap` | No |
| `src/app/dev/roommap/fixture.ts` | Create | Demo data and marker. In the route folder, **not** `src/lib` (F9) | No |
| `src/app/dev/roommap/page.test.tsx` | Create | AC 6 guard | No |
| `src/app/dev/roommap/fixture.test.ts` | Create | Fixture keys, states, subs | No |
| `scripts/check-dev-bundle.mjs` | Modify, `FORBIDDEN` (lines 8-20) | Reuse the existing bundle scan for the demo marker | No |
| `scripts/check-dev-bundle.test.ts` | Modify | Marker is in `fixture.ts` and in `FORBIDDEN` | No |
| `README.md` | Modify, lines 46-47 | Say the check also covers the room map demo fixture | No |

Not touched: `next.config.ts`, `.github/**`, `package.json`, `pnpm-lock.yaml`, `db/**`, `src/app/api/**`, `src/server/**`,
`src/ui/index.ts`, `public/sprites/**`, `assets/art/**`.

## Data model / migration
None. `RoomLayout` is a provisional TypeScript type only.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `placement.test.ts` › "ROTATION_TO_DIR maps 0/90/180/270 to s/e/n/w" | Rotation |
| › "ZOOM_LEVELS is 2, 3, 4" | Spec zoom |
| › "resolveFrameKey uses a real directional key" | Rotation |
| › "resolveFrameKey does not treat wall.t.e as direction e" | F5 (`keys.json:714-716`) |
| › "resolveFrameKey returns null for an unknown sprite" | No crash |
| › "places a sprite at tile·32 + anchor, including negative anchors" | Placement |
| › "footprint follows the rotated frame (desk.single 2×1 → 1×2)" | Placement |
| › "bounds include a frame anchored at y = -32 and a 2 px side overhang" | **F1** |
| › "bounds equal the room rect when nothing overhangs" | F1 |
| › "layers are emitted in manifest order" | Draw order |
| › "furniture sorts by bottom row, full before sub, x, id" | Draw order |
| › "a prop on the top tile of a 1×2 desk paints after the desk" | **F2** |
| › "a prop on a 3×2 meeting table paints after the table" | **F2** |
| › "a chair never acts as a prop's host" | F2 |
| › "chairFor returns the table's tile and facing for s, n, e, w" | F3 |
| › "shadow op is 4 px tall, inset 2 px, 1 px above the bottom edge, only for shadow keys" | Shadow |
| › "avatar is drawn when avatarSeed is set, including a mine seat" | LAY-06 |
| › "avatar uses back view on a .n chair, otherwise front" | Avatar |
| › "unknown sprite is reported and skipped, not thrown" | AC 3 |
| › "a different valid manifest changes ops without code changes" | AC 2 |
| › "seatOrder is row, column, id" | AC 5 |
| `avatar.test.ts` › "known FNV-1a vectors" (`""` = `0x811c9dc5`, `"a"` = `0xe40c292c`, `"foobar"` = `0xbf9cf968`) | Hash |
| › "is stable" | AC 4 |
| › "ramps are salted" (the skin, hair and shirt hashes of one sub differ) | AC 4 |
| › "hashes UTF-8: Vietnamese diacritics work, NFC and NFD differ only as raw input" | Domain focus |
| › "empty sub returns valid ramp colours" | Domain focus |
| `overlay.test.ts` › "overlayFor maps each of the five states" | Overlay |
| › "mine emits one tint per desk tile" | F7 |
| › "tag flips below when tileY < 2" | Settled default |
| › "tag aligns start or end near the left and right edges" | A4 |
| `sprite-manifest.test.ts` › "rejects frame tiles that differ from the registry" | F4 |
| `loadAtlas.test.ts` › "404", "bad JSON", "failing validator", "image error", "fetch rejects": each `{ok:false}` | AC 3 |
| › "loads JSON first, then the image, then validates with natural size" | Loader |
| › "adds ?v only for a string version, URL-encoded" | F8 |
| › "abort resolves without a state change and clears image handlers" | Lifecycle |
| `paint.test.ts` › "sets smoothing off after every resize" | AC 1 |
| › "uses integer canvas size and offsets at every zoom" | AC 1, F1 |
| › "translates by the negative bounds origin" | F1 |
| › "tint resets the composite to source-over and is cached per atlas" | Avatar |
| `SeatOverlay.test.tsx` › "one button per seat in row, column order" | AC 5 |
| › "tag is hidden at rest and shown only by group-hover or group-focus-visible" | AC 5, D50 |
| › "tag is aria-hidden and not focusable" | AC 5 |
| › "aria-label carries code, state and name, with Vietnamese diacritics intact" | AC 5 |
| › "overlay position includes the bounds offset" | F1 |
| `RoomMap.test.tsx` › "first render shows loading", "error view shows the copy with role=alert" | AC 3 |
| `page.test.tsx` › "production calls notFound and never loads the demo" | AC 6 |
| `fixture.test.ts` › "every sprite resolves in the committed manifest" | Key drift |
| › "covers every seat state" | AC 1 |
| › "sample subs have pairwise different looks" | AC 4 |
| › "contains no desk.pair seat" | A2 |
| `check-dev-bundle.test.ts` › "the demo marker is in fixture.ts and FORBIDDEN" | AC 6 |

Do not test canvas pixels. `paint.test.ts` asserts calls and state on a fake context.

## Approach
Rules: R1 (lib is pure, UI imports only lib, page imports ui and lib), R3 (no config), R4 (this file list), R5 (tests).
R2, R6, R7 do not apply: no schema, no org data, no route handler. `@/ui/roomlayout` from `src/app/dev/roommap` is allowed
by `scripts/check-layers.mjs:12,32-33` (pages → ui).

1. **Types (`layout.ts`).** Keep persisted layout apart from derived status, because SIM-015.1 must not store status.
   ```ts
   export const ZOOM_LEVELS = [2, 3, 4] as const;
   export type Zoom = (typeof ZOOM_LEVELS)[number];
   export type Rotation = 0 | 90 | 180 | 270;
   export type Placement = { id: string; sprite: string; x: number; y: number; rotation: Rotation };
   export type FloorZone = { sprite: string; x: number; y: number; w: number; h: number };
   /** Provisional: SIM-015.1 owns the persisted shape. */
   export type RoomLayout = {
     w: number; h: number; floors: FloorZone[];
     seats: (Placement & { code: string })[]; fixtures: Placement[];
   };
   export type SeatState = "empty" | "occupied" | "mine" | "pending" | "cannot";
   export type SeatView = { state: SeatState; avatarSeed: string | null; name: string | null };
   ```
2. **Placement (`placement.ts`), no DOM types.**
   - `ROTATION_TO_DIR = {0:"s", 90:"e", 180:"n", 270:"w"}` (settled).
   - `resolveFrameKey(sprite, rotation)`: use `${sprite}.${dir}` if it exists **and** its registry `dir` equals `dir`;
     otherwise `sprite` if it is an exact key; otherwise `null` (F5).
   - `chairFor(desk, footprint)` (F3, assumption A1), stores nothing:

     | Desk dir | Chair tile | Chair frame |
     |---|---|---|
     | `s` | `(x + ⌊(w-1)/2⌋, y + d)` | `chair.office.n` |
     | `n` | `(x + ⌊(w-1)/2⌋, y - 1)` | `chair.office.s` |
     | `e` | `(x + w, y + ⌊(d-1)/2⌋)` | `chair.office.w` |
     | `w` | `(x - 1, y + ⌊(d-1)/2⌋)` | `chair.office.e` |

   - `buildDrawList(layout, seatViews, manifest)` returns `{ ops, bounds, unknown }`. Op position is
     `tile·32 + frame.anchor (+ overlay offset)`. Footprint comes from the selected frame's `tiles` (settled; F4 keeps it
     equal to the registry). Sub-tile status reads `REGISTRY[key].tiles === null` (F6).
   - **Order:** layers in `manifest.layers` order. In `furniture`, sort by `(sortRow, full 0 / sub 1, x, id)`.
     `sortRow` of a full-tile item is `y + d - 1`. `sortRow` of a sub-tile item is that of the **blocking full-tile**
     furniture covering its tile (the highest such row), else its own `y` (F2). Chairs do not block, so they never host.
   - **Shadow:** settled band for registry `shadow: true` keys, on the `shadow` layer.
   - **Bounds (F1):** union of `[0, 0, W·32, H·32]` and all op rects.
3. **Avatar and overlay (`avatar.ts`, `overlay.ts`).**
   - FNV-1a 32-bit over **UTF-8 bytes** (`TextEncoder`), with `Math.imul` and `>>> 0`. Salts: `sub + ":skin"`, `":hair"`,
     `":shirt"`, `":style"`. Ramps exactly as style guide §5. Hair style 1–3.
   - Paint order: body, shirt, hair. View: `back` if the chair frame is `.n`, otherwise `front` (settled).
   - `overlayFor(state)` returns `{ key, target, offset }[]`: `pending` = `state.pending` on the chair tile, offset
     `[0, -24]`; `cannot` = `state.cannot` on the desk's centre tile, offset `[0, -8]`; `mine` = `state.mine.tint` with
     `target: "desk"`, expanded to **one op per desk tile** (F7); `empty` and `occupied` = none.
   - `tagPlacement`: below when `tileY < 2` (settled); `align` is `start` or `end` if the seat centre is within 80 CSS px
     of the bounds edge, otherwise `center` (A4). Tag width is capped at 160 px (`max-w-40`, truncate).
4. **Validator (F4).** Inside the frame loop, when `tiles` is a valid positive pair, compare with
   `REGISTRY[key].tiles ?? [1, 1]` and report `${p}.tiles`. The packer already writes this value (`pack.mjs:175`).
5. **Loader (`loadAtlas.ts`).** `loadAtlas({ fetch, createImage, signal })`:
   `fetch("/sprites/office.json", { cache: "no-cache", signal })` → check `ok` → parse → image
   `/sprites/office.png`, with `?v=<encodeURIComponent(meta.version)>` only when `meta` is an object and `version` a string
   (F8) → set `onload`/`onerror` before `src` → `validateSpriteManifest(json, { w: naturalWidth, h: naturalHeight })`.
   Catch everything and return `{ok:false}`. No `data:`, `blob:`, `createImageBitmap` or object URLs (SIM-027 CSP,
   `src/lib/security/headers.ts:37-38`). No module-level promise cache.
6. **Renderer.**
   - `paint.ts`: set `canvas.width/height = bounds·zoom`, **then** `imageSmoothingEnabled = false`, `scale(zoom, zoom)`,
     `translate(-bounds.x, -bounds.y)`, and draw ops synchronously. Tint on an offscreen canvas of the frame size: grey
     frame, `multiply` fill, `destination-in` frame, back to `source-over`. Cache in
     `WeakMap<HTMLImageElement, Map<"frameKey|#hex", HTMLCanvasElement>>`. A missing frame is skipped.
   - `RoomMap.tsx`: load in `useEffect` with `AbortController`; draw in a second effect keyed on `[atlas, drawList, zoom]`;
     `drawList` from `useMemo`. A null `getContext("2d")` shows the error state. Markup: an `overflow-auto
     overscroll-contain` `role="region"` wrapper with a copy label, holding one `relative` box of the exact CSS pixel size,
     with the `aria-hidden` canvas (`image-rendering: pixelated`, explicit CSS width and height) and the overlay.
   - `SeatOverlay.tsx`: `<button type="button" className="group ...">` per seat in `seatOrder`, positioned over the desk
     footprint with `(px - bounds origin)·zoom`. The tag is a child `aria-hidden` pill per §6 (dot, seat code, name when
     present), `hidden group-hover:flex group-focus-visible:flex` (settled, D50). Selection, hover and focus use an HTML
     outline (§6). No tab stop on the region or tags.
7. **Demo and production proof (AC 6, F9).**
   - `page.tsx` must use this exact shape, so the import sits inside a branch the compiler can remove:
     ```tsx
     import { notFound } from "next/navigation";

     // Dev-only room map demo (SIM-024.1). The import stays inside this branch so production has no demo chunk.
     export default async function DevRoomMapPage() {
       if (process.env.NODE_ENV === "development") {
         const { RoomMapDemo } = await import("./RoomMapDemo");
         return <RoomMapDemo />;
       }
       notFound();
     }
     ```
     Do **not** copy the static import of `src/app/dev/shell/page.tsx:4`.
   - `fixture.ts` exports `DEMO_FIXTURE_MARKER = "simap-roommap-fixture-9c41"`, and `RoomMapDemo` renders it as
     `data-demo-fixture={DEMO_FIXTURE_MARKER}`, so it cannot be tree-shaken while the demo is in a bundle. Do not use the
     route path as the marker: Next manifests may legitimately list routes. Add the marker to `FORBIDDEN`.
   - **Proof, in this order, recorded in `impl-log.md`:**
     1. **Negative control:** temporarily make `page.tsx` statically import and always render `RoomMapDemo`. Run
        `pnpm build`, then `pnpm check:dev-bundle`. It **must fail and name the marker**. If it does not, the scan proves
        nothing: stop.
     2. Restore the exact page above and confirm with `git diff` that the temporary edit is gone.
     3. Run `pnpm build`, then `pnpm check:dev-bundle`. It **must pass**.
   - **If step 3 fails:** do not edit `next.config.ts`. Stop and record it. The fallback is a dev-only `pageExtensions`
     entry with the page renamed `page.dev.tsx`. That is a **High path**, so the ticket's Gate changes to plan approval and
     Ming decides.
   - Fixture: one room of about 12×8 tiles, `desk.single` seats in several rotations, six seats covering all five states,
     at least 3 subs, one Vietnamese name (for example `Nguyễn Thị Ánh`), a `plant.large`, and a prop on the top tile of a
     1×2 desk (F2).
8. **Commit order** (keeps review readable): (a) lib + validator + tests; (b) loader, painter, overlay, `RoomMap` + tests;
   (c) demo + bundle check. Run all checks before handing off.

## Specialist input used
**software-architect**
- Adopted: F1, F2 (verified, see above), F3 chair table, F4 validator check, F5 `resolveFrameKey`, F6 registry for sub-tile
  status, F7 tint per tile, F8 version guard, F9 foldable import with fixture in the route folder, type shape (with `name`
  replacing `label`, so the tag and aria text can be composed), no barrel export, the listed cuts.
- Rejected: fixed one-tile padding (breaks when art grows). Demo at 1/2/3 (spec says 2/3/4).
- Changed: the bundle check extends the existing `scripts/check-dev-bundle.mjs` instead of a one-off search.

**frontend-developer**
- Adopted: injected loader deps, load and draw lifecycle, no promise singleton, smoothing after resize, null context guard,
  per-atlas tint cache, scroll wrapper, `aria-label` with state, loader tests, fixture key test, left and right tag alignment.
- Rejected: Retry button (not in the ticket; a page reload retries because nothing is cached). `tabIndex={0}` on the
  scroll region (seats are already focusable, and the consult also asks for one tab stop per seat). `group-focus` for tap
  (contradicts the settled `group-focus-visible` and D50 "keyboard focus"; see A5). DPR-aware backing store (A3).
- The consult's "settled defaults hold" is superseded for F1 and F2 by the evidence above.

## Assumptions
All are non-blocking. Each has a default applied and can be changed later without rework outside the named file.
- **A1 Chair side.** Default: the table in Approach step 2. A rotation-0 desk has its chair below and shows the person from
  behind, looking at the screen. Basis: `desk.single.s` "drawers face the viewer" (`sprite-map.json:245`), and the monitor's
  `.s` front view faces the viewer (`sprite-map.json:5,305-312`). Change: one table in `placement.ts`. Ming checks it visually.
- **A2 `desk.pair`.** Default: not used as a seat in this ticket, because it is back to back (style guide §7) while LAY-02
  says one desk is one seat. SIM-015.1 decides.
- **A3 Fractional DPR.** Default: CSS-pixel backing store as settled, no DPR code. Ming records the 125%/150% result in the PR.
- **A4 Tag flip.** Default: the settled vertical flip when `tileY < 2`, plus left/right alignment. A tag past the left edge
  cannot be scrolled to, so without this it would be clipped.
- **A5 Touch has no tag.** The settled `group-hover`/`group-focus-visible` means a tap may not show a tag at 390 px. This
  matches D50 ("hover or keyboard focus") and the seat stays usable. SIM-015.1 should decide, since its tap opens the seat
  panel, which can show the same information.
- **A6 Placement limits.** A chair may fall outside the room or on another item. Bounds keep it visible. Overlap rules
  belong to the editor (SIM-015.2).
- **A7 Accepted visual limits.** The avatar layer always paints above furniture (manifest layer contract). The 30 px tint may
  show a 2 px seam between desk tiles (`public/sprites/office.json:934-941`).
- **A8 Canvas size for SIM-015.1.** At the spec's 4×, a 40×30 room is 5120×3840 = 19.7M px, above the roughly 16.7M px Safari
  canvas limit the frontend consult cites. The demo is far below it. SIM-015.1 must cap zoom or room size.
- **A9 Hotspots.** No other ticket is `IN_PROGRESS` or `REVIEW`. The one `DONE` ticket (SIM-009.2) does not mention the shared
  files edited here. No rebase expected beyond normal `main` movement.
- **A10 Follow-ups (not in this ticket).**
  - Align ticket AC 1 and style guide §2 with the spec's 2×/3×/4× once Ming confirms.
  - Add `pnpm check:dev-bundle` to `.github/workflows/ci.yml`. It runs by hand today, so CI would not catch a later leak.
  - `src/app/dev/shell/page.tsx` still has the static import pattern (F9), so its gallery chunk likely ships. Out of scope.
  - SIM-015.1 needs device-by-type drawing and a `layout_fixtures.kind` change (architect risk, `db/migrations/20261120150000_init.sql:182-184`).
  - SIM-015.1 and SIM-015.2 remain blocked by D47 until Ming lifts it (D55).

## Blocking questions
None. For Ming's attention in the PR (defaults are applied): zoom 2/3/4 (spec) over the ticket's 1/2/3, and chair side (A1).

## Split proposal
No further split. The ticket is already slice 2 of SIM-024 and stays **size M** in scope, but the line count is above the
~400-line guide: about **800 lines of product code and 450 of tests**. It stays whole because AC 1 needs the loader, placement,
painter, avatars, overlay and demo together to show anything. The three commits in Approach step 8 keep review manageable. If
the diff passes about 1,500 lines, stop and report instead of growing it.

**Cut to hold size M:**
- Devices drawn by type and primary/secondary placement (LAY-06 bullet 2): SIM-015.1.
- Pan, `?seat=`, seat panel, real data, layout API: SIM-015.1.
- Auto zoom, `z` field, walking or animated avatars, avatar accessories.
- DPR-aware backing store, Retry button, tap-to-show tags.
- `desk.pair` seats. Demo limited to one room with `desk.single` seats.
- CI wiring for the bundle check, and any `next.config.ts` change.
