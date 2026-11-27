# Consult — frontend-developer — SIM-068.1

## Consult (frontend-developer), SIM-068.1. Only what is new after slice 1 merged.

### Findings

1. **Slice 1 layout today.** `AuthLayout.tsx` has, inside `<main>`, a hero and then a row `div` (`max-w-[816px]`, `md:flex-row`) holding `<SignInScene/>` (384 px wide) and the card (`max-w-[400px]`). The hero is above the row, not part of it.
   - `SignInScene` is used only through `AuthLayout`'s `scene` prop. `scene` defaults to true, so every non-landing screen renders it (`views.tsx` other views, `account-views`, `accept-views`, `DevGate`, `ProfileView`).
   - Only `OrgPickerView` passes `scene={false}`.
   - Tests pin it: `views.test.tsx:181/188` (`px-scene` present and absent), `org-views.test.tsx:27`, `SignInScene.test.ts` (384x224, `scale(1,1)`), `world-palette.test.ts:46` (the aw block must come after `.px-scene-canvas`).

2. **Hard constraint from `world-palette.test.ts`.** It slices the aw block at `MARKER` (there must be exactly one `MARKER`) and asserts four things about that block:
   - no `animation`, `transition` or `@keyframes` inside the block;
   - the light and dark token sets are identical;
   - every token value is `#rrggbb`;
   - the block only appends.

   Appended `.aw-world*` rules placed inside that block therefore cannot bob avatars with CSS animation, and any new `--aw-*` token must be hex and defined in both themes. Safest is a second block with its own marker (for example `/* SIM-068.1 aw-world */`) after the aw block, and a small test change that extends the "no animation" rule there only if needed. Simplest: no animation at all (idle = static pose). Ask the planner to decide; the ticket says "idle avatars", which does not require motion.

3. **Atlas keys and rotation.** Layouts use base keys plus a `rotation` (0=s, 90=e, 180=n, 270=w). `resolveFrameKey` picks `<key>.<dir>` if it exists, else the plain key. All keys below exist in `keys.json`. Plain keys have no direction suffix: `sofa`, `table.coffee`, `shelf.books`, `whiteboard`, `plant.*`, `lamp.floor`, `window.*`, `floor.*`, `wall.top`, `wall.face`. Directional: `desk.single`, `desk.pair`, `table.meeting`, `screen.projector`, `chair.office`, `cooler.water`, `cabinet.filing`, `clock.wall`, `chart.flip`, `bin.trash`. Footprints (tiles): `sofa` 2x1, `table.coffee` 2x1, `shelf.books` 2x1, `whiteboard` 2x1, `window.double` 2x1, `desk.pair` 2x2, `desk.single.s|n` 2x1 (`e|w` 1x2), `table.meeting.s|n` 3x2 (`e|w` 2x3), `screen.projector.s|n` 2x1.

   Proposed 12x7 rooms (rows 0-1 are wall top/face like `SIGNIN_SCENE`; floor starts at y=2):
   - **FOCUS:**
     - floors: `wall.top`, `wall.face`, `floor.carpet` (y2-6), `floor.carpet.alt` as a 3-tile strip.
     - seats: `desk.single` at (2,3), (6,3), (9,3), with monitor devices. Seats are the only way to get avatars in a room, because `buildDrawList` attaches avatars to chairs (see 5).
     - fixtures: `window.double` (4,1), `clock.wall.s` (8,1), `plant.large` (0,2) and (11,5), `lamp.desk.s`, `prop.keyboard`/`prop.mouse`.
   - **MEETING:**
     - floors: wall rows plus `floor.lavender` (y2-6).
     - seats: `table.meeting` at (4,3), rotation 0, 3x2. Its chairs are implied (`chairFor`), so check for no overlap.
     - fixtures: `whiteboard` (2,1), `screen.projector.s` (7,1), `chart.flip.s`, `plant.small`.
   - **LOUNGE:**
     - floors: wall rows plus `floor.lavender` on the left, `floor.carpet.alt` on the right.
     - fixtures: `sofa` (2,3), `table.coffee` (2,4), `shelf.books` (8,2), `lamp.floor` (6,2) and (11,3), `plant.large` (0,2), `window.single` x2, `prop.mug`.
     - It is mostly furniture without a seat, so use the card/path avatar helper (see 5) if a person is wanted.
   - **CAFE:** `floor.wood` y2-6.
     - Counter: `cabinet.filing.s` at (8,2), (9,2) and (10,2) as a counter line, `cooler.water.s` (11,2) standing in for "machine", and `prop.mug` on top.
     - Tables: `table.coffee` at (2,4) and (5,5), and `desk.single` or `table.coffee` plus `chair.office.*` for an extra table.
     - Extras: `plant.small`, `clock.wall.s`.

     This is as close to the mockup as existing art gets (Q6, no new art).

4. **Size and scale.** Every room is 12x7 tiles = 384x224 CSS px at zoom 1 (`TILE`=32). 2x (768x448) cannot fit beside a 400 px card at any common width and the ≥1280 gate rules it out. Use exactly zoom 1 and `width:384px;height:224px` with `image-rendering:pixelated`, as `.px-scene-canvas` does. The `aspect-ratio` on `.px-scene` is a good CLS guard. Draw lists are fixed per room, so `bounds` is 384x224 for all four (assert it).

5. **Avatars are not free-standing.** `buildDrawList` emits avatar frames only for seats (it attaches them to the chair via `chairFor`/`avatarView`; there is no standing avatar op). So:
   - Seated avatars in FOCUS and MEETING come free through `seats` + `SeatView` (looks as in `SIGNIN_SEAT_VIEWS`).
   - Path avatars and the card avatar need `avatarDrawList(look, manifest)`. It must build a `DrawList` by hand, with `DrawOp` frames of `{type:"frame", layer:"avatar", key:"avatar.body.front"|"avatar.shirt.front"|"avatar.hair.<style>.front", tint}`, using `avatarFrames(look,"front")` and the frame tile size (32x32 presumably; check `paint.ts` and atlas frame rects). The `bounds` must be set to 32x32, or 64x64 at 2x, for its own tiny canvas.
   - The plan said "avatarDrawList", so this new helper is the main extra work: check `paintRoom`'s tint handling for ops without a seat and add a test that `unknown` is empty.
   - Fewer canvases alternative: draw the path avatars inside the nearest room canvas as extra fixtures-less ops. This is not possible without covering room tiles. Prefer 1 small canvas per avatar (3-4 canvases of 32x32 plus 1 card avatar), or reuse `paintRoom` per avatar. Each is trivial in budget terms.

6. **Canvas budget.** 4 rooms x 384x224 = 344,064 px (~1.4 MB RGBA), plus ~5 avatar canvases of 32x32 (~20 KB). The limit is 16.7 M px per canvas (`fitsCanvas` is per canvas, not total), so this is nowhere near it. A real cost is a single atlas (`office.png`) fetched once: `useAtlas()` is per-component and has no module cache. Four `RoomVignette`s that each call `useAtlas()` would fetch the atlas four times (a browser cache may dedupe, but not guaranteed) and decode it four times. Call `useAtlas()` once in `SmallWorld` and pass `atlas` down as a prop (or via context). Do not call it per canvas.

7. **Sharing the media gate.** `SignInScene.tsx` has a private `subscribe` with `WIDE = "(min-width: 768px)"`. Add a shared `useMediaGate(query)` hook, e.g. `src/ui/auth/useMediaQuery.ts` (client hook, `useSyncExternalStore` with server snapshot `false`), and make `SignInScene` use `(min-width: 768px)` and `SmallWorld` use `(min-width: 1280px)`. Keep its server snapshot `false` so SSR output has no canvas. This is a small refactor; `SignInScene.test.ts` imports only `paintSignInScene`, so it stays valid.

8. **Grid around the merged layout.**
   - Minimum width at 1280 px is 384 + 400 + 384 = 1168 px of content, plus `px-5` page padding (40 px) = 1208 px, leaving ~72 px for the two column gaps (~36 px each). It fits, but only barely, and only with a fixed template: `grid-template-columns: 384px minmax(0,400px) 384px; column-gap: clamp(24px, 3vw, 48px)`. The current `max-w-[816px]` wrapper must be widened for the landing (about `max-w-[1360px]` on the landing path).
   - Rows: left column FOCUS then LOUNGE, right column MEETING then CAFE (mockup corners), card in the centre column spanning both rows (`grid-row: 1 / span 2`, `align-self: center`). The card's height (strip + form + notices, roughly 520-600 px) is close to two rooms stacked (448 px + row gap), so use `row-gap: 32px; align-items: center`. Do not make the layer `absolute`: grid cells keep the card and rooms from overlapping at any width ≥1280 because the card cell is its own column.
   - Hero stays above the grid in `<main>`'s flex column. Do not put hero text in the grid.
   - Below 1280 px the grid collapses to the card only. So it is `hidden` (or not rendered) at <1280 and the existing 768-1279 layout does what? The slice-1 layout (`SignInScene` beside the card, `md:flex-row`) is for ≥768. The ticket wants the landing at ≥1280 to show four rooms, and below 1280 "not rendered". Keep `SignInScene` for 768-1279 on the landing, or show nothing there? That needs a decision (Open question 1). Doing both at once means `SignInScene` and `SmallWorld` render the same page, and the media gate in `SignInScene` must be turned off on landing at ≥1280 (or `SignInScene` must be hidden via `xl:hidden`/`hidden` at ≥1280 in addition to unmounting the canvas, otherwise two atlas fetches never happen, since `SignInScene` would not mount its canvas only if gated by a `max-width: 1279px` query).
   - Dotted paths: CSS only. Easiest is a `<svg>`/pseudo-elements in the grid gap between each pair of neighbours (room to card at the sides, room to room vertically): `border-style: dashed` or `border: 2px dotted var(--aw-line)` on 3 or 4 absolutely positioned absolute pieces inside the grid container (which is `relative`). `pointer-events-none`, `aria-hidden`.
   - Notes: two `div`s in the grid. NOTE 1 in the gap between FOCUS and LOUNGE column (row gap) or as an extra grid row below the hero (`grid-row`), NOTE 2 beside CAFE. Both with `tabindex` absent; slight rotation with `transform: rotate(±1deg)` is fine (not animation).

9. **Keeping `SignInScene` for other screens.** Recommend: keep it (and its tests) unchanged for non-landing screens (`scene` default true), and for landing replace it with `SmallWorld`. Deleting it would break 4 test files and change screens outside the mockup (the ticket's "other screens keep their current look", Q4). A cheap improvement is to make `scene` mean "single vignette" and for `landing` ignore it: `{landing ? <SmallWorld/> : scene && <SignInScene/>}`. Update the `AuthLayout` doc comment. The row wrapper (`flex-row`) is then used for non-landing only; for landing render the grid instead.

10. **Placeholder and failure behaviour.** Each room has an always-present placeholder box (reuse `.px-scene` visuals, with a distinct per-room tint through a CSS variable or modifier class so the four boxes look calm and different), sized 384x224 (no CLS). Canvas invisible until `paintRoom` returns true (copy the `painted` pattern from `SignInScene`). On `failed` or a false paint, the placeholder stays; nothing else changes and the form is unaffected.

11. **Tests (node, no jsdom).**
    - `small-world-scenes.test.ts` (pure, copy `signin-scene.test.ts`'s shape): every sprite key in each `RoomLayout` resolves via `resolveFrameKey` and `REGISTRY`; `buildDrawList(...).unknown` is `[]`; bounds are exactly 384x224; no blocking overlap between blocking items; fixtures inside 12x7; avatar helper emits `avatar.*` keys that exist and tints valid.
    - `SmallWorld.test.ts(x)`: fake-canvas paint via the same Proxy as `SignInScene.test.ts`, asserting `scale(1,1)` for each of the four rooms and a `false` return when there is no 2D context (export a pure `paintRoomVignette(canvas, atlas, list)` for this).
    - `renderToStaticMarkup(<SignInView landing …/>)`: server markup contains the four room labels and the two notes inside an `aria-hidden="true"` wrapper, contains no `<canvas`, control count (`button|a|input`) equals slice 1's fixture and exactly one `<h1>`; negative case: `landing={false}` has no `aw-world`.
    - Because `useSyncExternalStore` server snapshot is `false`, SSR is deterministic. Existing `views.test.tsx` "landing" tests that count `px-scene` may need `px-scene` absent on landing now. Update only that assertion.
    - Run `world-palette.test.ts`, `org-views.test.tsx`, `account-views`, `accept-views`, `DevGate` tests.

### Recommendations

1. (Criterion 1, 2) Add `src/lib/sprites/small-world-scenes.ts` with the four 12x7 layouts above and `avatarDrawList`; every layout built from the keys listed. Seats only for FOCUS and MEETING; LOUNGE and CAFE are furniture only, avatars appear on paths and in the card.
2. (Criterion 1) Zoom is exactly 1 for rooms; CSS size `384x224`, `image-rendering:pixelated`, no CSS scaling. No 2x anywhere.
3. (Criterion 1) Call `useAtlas()` once in `SmallWorld` and pass the atlas to children; mount canvases only when `(min-width: 1280px)` matches, using a shared `useMediaQuery` hook extracted from `SignInScene`.
4. (Criterion 1) `AuthLayout` landing grid: `384px | minmax(0,400px) | 384px`, card spanning two rows, hero above, wrapper widened for landing; below 1280 px render per the Open question 1 decision.
5. (Criterion 2) Whole layer `aria-hidden="true"`, `pointer-events-none`, no `tabindex`, no buttons/links; labels and notes as `div`/`span`/`p` (not headings: keep one `h1`).
6. (Criterion 3) Per-room CSS placeholders at the same size; keep calm tint; no error UI.
7. (Criterion 4) Copy to `authCopy.world.rooms[4]` and `authCopy.world.notes[2]` in `src/ui/copy/auth.ts` (`authCopy.world` already exists from slice 1).
8. Keep `SignInScene` and its tests for non-landing screens; `landing` ignores `scene`.
9. Put new CSS after the aw block under its own marker, with no animation/transition (matches `world-palette.test.ts`); add only hex tokens if tokens are needed, in both themes.

### Risks

- Tight fit at exactly 1280 px: 1208 px of content plus ~72 px for two gaps. Gaps below ~24 px make the paths illegible. Verify at 1280, 1366, 1440 and 1920, and with a vertical scrollbar (1265 px usable on Windows).
- Card height vs two stacked rooms: if the sign-in form shows a notice or Turnstile, the card grows past 448 px and the side rooms drift; `align-items:center` handles it, but the paths must attach to grid cells, not to fixed pixel offsets.
- Avatars: standing/path avatars have no existing draw path. `avatarDrawList` adds new logic in `src/lib/sprites` and is the most likely place for a rework.
- Atlas fetched per component if `useAtlas` is called more than once; also decodes four times.
- `world-palette.test.ts` rejects animation inside the aw block, which limits the "idle" look to static poses unless a second block is added.
- Mockup is top-down flat tiles; the atlas is 3/4 office art with wall rows; expect "in the spirit of" and say so to Ming. Café has no counter/machine sprite.
- Two rendered scenes between 768 and 1279 px if `SignInScene` and `SmallWorld` are both mounted without gating; make the two gates mutually exclusive.

### Open questions

1. Between 768 and 1279 px on the landing: keep the slice-1 single vignette beside the card (my recommendation: yes, less churn) or show no scene until 1280?
2. Are static idle poses acceptable, or does Ming want animated idle (needs its own CSS block outside the aw block and a `prefers-reduced-motion` guard)?
3. Do the path avatars need to be standing (new `avatarDrawList`) or may they be seated figures inside the room canvases only?
4. Row placement of the two notes: in the gaps between the rooms (as in the mockup) or under the hero?

Key files: `src/ui/auth/AuthLayout.tsx`, `src/ui/auth/SignInScene.tsx`, `src/lib/sprites/signin-scene.ts`, `src/lib/sprites/placement.ts`, `src/lib/sprites/zoom.ts`, `src/ui/roomlayout/useAtlas.ts`, `src/ui/auth/world-palette.test.ts`, `src/app/globals.css`.
