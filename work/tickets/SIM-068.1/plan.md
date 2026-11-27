Status: READY

# Plan — SIM-068.1: Four pixel rooms, paths and notes around the sign-in card

## Scope summary
Ticket (`work/tickets/SIM-068.1/ticket.md`):
- Goal: "Finish the 'small world' landing from Ming's mockup (`work/tickets/SIM-068/mockup-sign-in.webp`): four
  decorative pixel rooms joined by dotted paths around the sign-in card, with idle avatars, two note cards and the card
  avatar."
- Scope: "New `src/lib/sprites/small-world-scenes.ts`: `FOCUS`, `MEETING`, `LOUNGE`, `CAFE` as 12×7 `RoomLayout`s from
  existing atlas keys only (the café has no counter or coffee-machine sprite — SIM-068 Q6), plus avatars for the paths
  and the card ('Player, ready?')." / "New `src/ui/auth/SmallWorld.tsx`: `aria-hidden`, `pointer-events-none`, one
  canvas per room painted with `paintRoom(…, 1)`, mounted only at ≥ 1280 px (SIM-068 Q5; atlas never fetched on
  phones), CSS placeholder per room, CSS dashed paths, two note cards ('Your next great day starts with a little
  hello', 'Big ideas. Small pixels.'), room labels as decorative text." / "`AuthLayout` `landing` renders `SmallWorld`
  in a grid around the centre column; other screens keep their current look (SIM-068 Q4). Decide whether
  `SignInScene` stays for those screens."
- Out of scope: "New art or fonts; any change to the sign-in form, its controls or authentication."

Ming's answers for SIM-068 (`work/tickets/SIM-068/ticket.md` → Notes, 2026-11-26), which apply here:
- "Q4 other screens get header/background/frame/footer/green button, no hero, keep today's office scene from md"
- "Q5 390 px order header, hero, card, footer, rooms from 1280 px" — per the orchestrator: on the landing, 768–1279 px
  shows only hero and card (the slice-1 single vignette is removed from the landing); other screens keep `SignInScene`.
- "Q6 café from existing sprites"
- "chỉ lấy idea như hình, còn các button tính năng giữ như hiện tại" — no new buttons or features.

Decisions:
- D85: "Sign-in surfaces (every `AuthLayout` screen) use the mockup's warm cream/green palette as separate `--aw-*`
  tokens; this amends D46 for those screens only (rooms, map and app shell keep D46)."
- D52 (via SIM-068 plan): "The pixel/game style is used only on end-user surfaces: sign-in and org picker, … Body text,
  tables and forms never use a pixel font."
- D45: only licence-checked assets; no new art or fonts here (ticket Out of scope).
- D36 / CLAUDE.md: "UI copy: English, in `src/ui/copy/<feature>.ts`".

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1a | At ≥ 1280 px the landing shows the four labelled rooms, paths, idle avatars and two notes around the card | `SmallWorld.test.tsx › server markup has four labelled rooms, two notes and the path inside aria-hidden sides`; `views.test.tsx › landing › renders the small world around the card, not the single vignette`; CSS review of the `/* SIM-068.1 small world (aw-world) */` block (grid at `@media (min-width: 1280px)`); visual check → Ming after merge |
| 1b | Below 1280 px the world is not rendered and the atlas is not fetched | `SmallWorld.test.tsx › the CSS hides the world below the same media query the JS gate uses` (sides, path and card avatar are `display:none` outside `@media (min-width: 1280px)`, and `WORLD_MEDIA` equals that query); code read: `useAtlas()` is called only in `AtlasFeed`, which renders only when the `WORLD_MEDIA` gate matches (server snapshot `false`); `SmallWorld.test.tsx › server markup has no canvas`; network check → Ming after merge |
| 2a | Every sprite key resolves in the registry | `small-world-scenes.test.ts › every room is 12x7 and every sprite resolves to a registry key`, `› draws with no unknown sprite and bounds exactly 384x224`, `› avatarDrawList uses only manifest avatar frames, 32x32` |
| 2b | Rooms paint at a whole-number scale | `SmallWorld.test.tsx › paints each room 384x224 at zoom 1 with smoothing off first` (asserts `["scale", 1, 1]`), `› paints a path avatar 32x32 at zoom 1`; `small-world-scenes.test.ts › uses integer rects` |
| 2c | All decoration `aria-hidden`, no focusable or interactive control (control count unchanged, still one `h1`) | `views.test.tsx › landing › has exactly the controls of the plain sign-in view` (existing, still green) and `› exactly one h1, the headline` (existing); `SmallWorld.test.tsx › decoration has no control, tabindex, heading or img`; `› the card slot is not inside an aria-hidden element` |
| 3 | An atlas failure leaves calm placeholders and sign-in still works | `SmallWorld.test.tsx › returns false without a 2D context so the placeholder stays`; server markup (= the state before and without an atlas) has four `.aw-room` placeholder boxes and the card (`› server markup …`); code read: a failed `loadAtlas` leaves `atlas` null so no canvas mounts; the form is outside the world (no shared state) |
| 4 | Copy (room names, notes) in `src/ui/copy/auth.ts`; all Checks pass | `authCopy.world.rooms` / `authCopy.world.notes` exist and `SmallWorld.tsx` has no literal English strings (code read); `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` green |

## Ming verification after merge
The real sign-in page is only visible on a deployed build (DevGate replaces it under `pnpm dev`):
- Look at 1440, 1366, 1280 (with the Windows scrollbar) and 1920 px, light and dark: four labelled rooms, dashed paths
  meeting behind the card, 2 path walkers, seated/standing idle avatars, two notes, card avatar beside "Player, ready?";
  nothing overlaps the card or hero; rooms read quieter than the card.
- At 1024 and 390 px: only header, hero, card and footer; in DevTools → Network no `office.png` / `office.json` request.
- Resize across 1280 px: the world appears/disappears; typed email stays in the field.
- Block `/sprites/office.png` in DevTools → reload at 1440: calm room placeholders, sign-in still works.
- Café look (no counter/machine sprite, Q6): "in the spirit of" the mockup; say if it reads wrong.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/small-world-scenes.ts` (new) | `WorldRoomId` (`"focus" \| "meeting" \| "lounge" \| "cafe"`), the four 12×7 `RoomLayout`s, fixed seat views/devices and standing-avatar spots per room, `WORLD_ROOMS` (order + `drawList(manifest)`), `standingAvatarOps(look, tx, ty, manifest)`, `avatarDrawList(look, manifest)`, `WALKER_LOOKS` (2), `CARD_LOOK` | Ticket scope (scenes + avatars); pure logic in lib (planner rule 6) | No |
| `src/lib/sprites/small-world-scenes.test.ts` (new) | Pure tests (see Tests) | R5 | No |
| `src/ui/auth/SmallWorld.tsx` (new, `"use client"`) | `WORLD_MEDIA`, `paintVignette`, atlas context + `AtlasFeed`, `SmallWorld({children})` grid, `CardAvatar` | Ticket scope | No |
| `src/ui/auth/SmallWorld.test.tsx` (new) | Fake-canvas paint and server-markup tests | R5 | No |
| `src/ui/auth/AuthLayout.tsx` | Landing renders `<SmallWorld>{frame}</SmallWorld>` instead of the row with `SignInScene`; `CardAvatar` beside the intro; doc comment | Ticket scope; Q4/Q5 | No |
| `src/ui/copy/auth.ts` | `world.rooms` (4 labels) and `world.notes` (2) | AC4, D36 | No |
| `src/app/globals.css` | New block `/* SIM-068.1 small world (aw-world) */` appended at the end of the file, after the aw block | Grid, rooms, placeholders, veil, paths, notes, labels | No |
| `src/ui/auth/views.test.tsx` | Add one landing test (world present, no `px-scene` on landing); existing tests unchanged | AC1, Q5 | No |
| `src/ui/auth/world-palette.test.ts` | Add one `it`: the aw-world marker exists once and comes after the aw marker | Keeps the append-only rule explicit for the new block | No |

Not touched: `SignInScene.tsx` (+ its tests), `useAtlas.ts`, `paint.ts`, `placement.ts`, `views.tsx`, `keys.json`, the
atlas and `public/sprites/*`.

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `small-world-scenes.test.ts › every room is 12x7 and every sprite resolves to a registry key` | AC2a: floors, seats, fixtures of all four via `resolveFrameKey` + `REGISTRY` (shape of `signin-scene.test.ts:14-22`) |
| `small-world-scenes.test.ts › draws with no unknown sprite and bounds exactly 384x224` | AC2a; `WORLD_ROOMS[i].drawList(manifest).unknown` is `[]`, bounds `{x:0,y:0,w:384,h:224}` (standing avatars must not widen bounds) |
| `small-world-scenes.test.ts › uses integer rects and only frames from the manifest` | AC2b, every op of every room and of `avatarDrawList` |
| `small-world-scenes.test.ts › floor zones cover all 84 tiles` | each room fully floored (no holes in the canvas) |
| `small-world-scenes.test.ts › blocking furniture, chairs and standing avatars never share a tile` | generalises `signin-scene.test.ts:58-82` to all rooms: blocking seats/fixtures (with their real rotation), implied chairs (`chairFor` with the resolved dir), and each standing-avatar tile (must be y ≥ 2, inside 12×7) |
| `small-world-scenes.test.ts › idle avatars: fixed looks, expected count, no overlay` | every seat view `occupied` with `isPixelLook(look)`; avatar-layer op count per room = 3 × (seats + standing); no `overlay` op |
| `small-world-scenes.test.ts › avatarDrawList uses only manifest avatar frames, 32x32` | path/card avatar: 3 `frame` ops on layer `avatar`, keys `avatar.body.front`, `avatar.shirt.front`, `avatar.hair.<style>.front`, tints `#rrggbb`, bounds `{0,0,32,32}`, `unknown` `[]`; with a manifest missing `avatar.shirt.front` it reports it in `unknown` and does not throw |
| `SmallWorld.test.tsx › paints each room 384x224 at zoom 1 with smoothing off first` | AC2b (fake canvas Proxy + `document` stub copied from `SignInScene.test.ts:12-44`) |
| `SmallWorld.test.tsx › paints a path avatar 32x32 at zoom 1` | AC2b |
| `SmallWorld.test.tsx › returns false without a 2D context so the placeholder stays` | AC3 |
| `SmallWorld.test.tsx › server markup has four labelled rooms, two notes and the path inside aria-hidden sides` | AC1a: `renderToStaticMarkup(<SmallWorld><p id="card-slot" /></SmallWorld>)`; each room label and note is inside an element with `aria-hidden="true"`; four `aw-room` boxes; the path element is `aria-hidden`. Note: "Coffee & connection" is escaped as `&amp;` in markup — compare against the escaped string |
| `SmallWorld.test.tsx › server markup has no canvas` | AC1b (server snapshot `false`) |
| `SmallWorld.test.tsx › decoration has no control, tabindex, heading or img` | AC2c: no `<button`, `<a `, `<input`, `tabindex=`, `<h1`–`<h6`, `<img` in the markup apart from the slot |
| `SmallWorld.test.tsx › the card slot is not inside an aria-hidden element` | AC2c: the slot sits in `.aw-world-center`, which has no `aria-hidden` ancestor (check the substring before `card-slot` has as many `</div>` closings as opened `aria-hidden` divs, or simply assert the centre div has no `aria-hidden` and is a direct child of `.aw-world`) |
| `SmallWorld.test.tsx › the CSS hides the world below the same media query the JS gate uses` | AC1b: read `src/app/globals.css`; the aw-world block contains `@media ${WORLD_MEDIA}`; outside it `.aw-world-side`, `.aw-world-path`, `.aw-card-avatar` are `display: none` |
| `SmallWorld.test.tsx › CardAvatar renders an aria-hidden box with no canvas on the server` | AC2c/AC3 |
| `views.test.tsx › landing › renders the small world around the card, not the single vignette` | Q5: `landing()` contains `aw-world` and every room label, and does not contain `px-scene`; `plain()` and `html(<AuthLayout title="T">x</AuthLayout>)` do not contain `aw-world` (other screens unchanged, Q4) |
| `world-palette.test.ts › the aw-world block comes once, after the aw block` | append-only CSS rule |

Existing tests that must stay green unchanged: `views.test.tsx` (frame, landing controls/h1/order/no-demo strings,
pixel surface), `SignInScene.test.ts`, `signin-scene.test.ts`, `org-views.test.tsx`, `account-views.test.tsx`,
`accept-views.test.tsx`, `world-palette.test.ts` (note: its `block` runs from the aw marker to the end of the file, so
the new CSS is checked by "no animation or transition", see Approach step 4).

## Approach
1. **Copy** (`src/ui/copy/auth.ts:39-53`, inside `world`): add
   `rooms: { focus: "The focus studio", meeting: "Good ideas live here", lounge: "The slow corner", cafe: "Coffee & connection" }`
   (labels as in the mockup) and `notes: ["Your next great day starts with a little hello", "Big ideas. Small pixels."]`
   (ticket text, verbatim; the mockup's extra subline "A whole lot of possibility." is not in the ticket and is not added).
   Type `rooms` with `satisfies Record<WorldRoomId, string>` (type-only import from `@/lib/sprites/small-world-scenes`;
   ui → lib is allowed by R1), so a missing label fails typecheck.
2. **Scenes** (`src/lib/sprites/small-world-scenes.ts`, pattern of `src/lib/sprites/signin-scene.ts:1-50`). Rows 0–1
   are `wall.top` / `wall.face` in every room, floor from y = 2. Starting compositions (the implementer may move items
   by a tile when the overlap test says so; record moves in impl-log):
   - `FOCUS` — floor `floor.carpet` (0,2,12,5). Seats (rotation 0, `desk.single` → `.s`, chair south, back view):
     `focus-1` (2,3), `focus-2` (6,3), both occupied, devices `[{type:"monitor"}]` and `[{type:"laptop"}]`. Fixtures:
     `desk.single` (9,3) + `chair.office.n` (9,4) as an empty desk, `window.double` (4,1), `clock.wall.s` (8,1),
     `plant.large` (0,2) and (11,6), `cabinet.filing.s` (11,2), `prop.mug` (3,3).
   - `MEETING` — floor `floor.lavender` (0,2,12,5). Seat `meet-1`: `table.meeting` rotation 180 at (4,3) (→ `.n`, 3×2;
     chair at (5,2) `chair.office.s`, front view). Fixtures: `chair.office.n` at (4,5) and (6,5), `whiteboard` (1,1),
     `screen.projector.s` (8,1), `chart.flip.s` (10,3), `plant.large` (11,6), `plant.small` (0,6). Standing avatar at (9,5).
   - `LOUNGE` — floors `floor.lavender` (0,2,6,5) + `floor.carpet.alt` (6,2,6,5). No seats. Fixtures: `window.single`
     (2,1) and (9,1), `sofa` (1,3), `table.coffee` (1,5), `prop.mug` (2,5), `shelf.books` (8,2), `lamp.floor` (4,2) and
     (11,4), `plant.large` (0,2), `plant.small` (11,6). Standing avatar at (5,4).
   - `CAFE` (Q6) — floor `floor.wood` (0,2,12,5). Counter line: `cabinet.filing.s` at (7,2), (8,2), (9,2),
     `cooler.water.s` (10,2) standing in for the machine, `prop.mug` (8,2). Seats: `cafe-1` `table.coffee` rotation 180
     at (2,4) (dir from `ROTATION_TO_DIR` = `n`, chair (2,3) `chair.office.s`, front view) and `cafe-2` at (6,5)
     (chair (6,4)). Fixtures: `window.double` (1,1), `clock.wall.s` (4,1), `plant.large` (0,6), `plant.small` (11,6).
     Standing avatar at (9,4).
   - Every seat has an `occupied` `SeatView` with a fixed `PixelLook` and `avatarSeed` (like `SIGNIN_SEAT_VIEWS`,
     `signin-scene.ts:34-41`), so no seat-state overlay is drawn. No visitor data is used.
   - `standingAvatarOps(look: PixelLook, tx, ty, manifest): DrawOp[]` — for each of `avatarFrames(lookFromChoice(look), "front")`
     (`src/lib/sprites/avatar.ts:57`, `pixel-look.ts:31`) emit `{type:"frame", layer:"avatar", key, tint, x: tx*TILE + anchor[0], y: ty*TILE + anchor[1], w, h}`
     from `manifest.frames[key]`; a missing frame is skipped and returned in a `missing` list (so callers can put it in
     `unknown`). Same op shape as `emitFrame` in `placement.ts:168-188`.
   - Room draw list: `buildDrawList(layout, views, manifest, devices)` (`placement.ts:142`) then append the room's
     standing ops (avatar layer, drawn last; they sit on a free floor tile so nothing should cover them) and merge their
     missing keys into `unknown`. Bounds stay 384×224 (asserted).
   - `avatarDrawList(look, manifest): DrawList` = `{ ops: standingAvatarOps(look, 0, 0, manifest), bounds: {x:0,y:0,w:32,h:32}, seats: [], unknown: missing }`
     (avatar frames are 32×32 with anchor [0,0] in `public/sprites/office.json:19-33`).
   - `WALKER_LOOKS: [PixelLook, PixelLook]`, `CARD_LOOK: PixelLook`; all values within the ramps (`isPixelLook`).
3. **SmallWorld** (`src/ui/auth/SmallWorld.tsx`, `"use client"`; imports `@/lib/sprites/small-world-scenes`,
   `../roomlayout/paint`, `../roomlayout/useAtlas`, `../roomlayout/loadAtlas` type, `../copy/auth` — all ui/lib, R1):
   - `export const WORLD_MEDIA = "(min-width: 1280px)"`; module-level `subscribe` like `SignInScene.tsx:9-15` and
     `useSyncExternalStore(subscribe, () => matchMedia(WORLD_MEDIA).matches, () => false)`.
   - `export function paintVignette(canvas, atlas, list): boolean { return paintRoom(canvas, atlas, list, 1); }`.
   - Atlas loaded **once**: `SmallWorld` keeps `const [atlas, setAtlas] = useState<Atlas | null>(null)` and renders
     `{wide && !atlas && <AtlasFeed onAtlas={setAtlas} />}`; `AtlasFeed` calls `useAtlas()` (the only call) and in an
     effect passes a loaded atlas up; on failure it does nothing, so the placeholders stay. Provide
     `wide ? atlas : null` through a React context (`WorldAtlas`). This keeps the children (the card with the form) at
     a stable tree position, so crossing 1280 px never remounts the form; and `useAtlas` / the fetch never run below
     1280 px. `useAtlas.ts` is not changed.
   - `Vignette({ build, className })`: reads the context; returns `null` without an atlas; otherwise a canvas that is
     `invisible` until `paintVignette(ref.current, atlas, build(atlas.manifest))` returns true (the `painted` pattern of
     `SignInScene.tsx:22-37`).
   - Markup (DOM order: card first, then the decoration, so nothing decorative precedes the form):
     ```
     <div class="aw-world">
       <div class="aw-world-center">{children}</div>
       <div class="aw-world-side" data-side="left"  aria-hidden="true">  FOCUS room · gap (vertical path + walker 1) · LOUNGE room · note 1 (anchored to FOCUS) </div>
       <div class="aw-world-side" data-side="right" aria-hidden="true">  MEETING room · gap (vertical path + walker 2) · CAFE room · note 2 (anchored to MEETING) </div>
       <div class="aw-world-path" aria-hidden="true"></div>
     </div>
     ```
     Room = `<div class="aw-room">` (placeholder box) containing `<span class="aw-room-label">` + `Vignette`. Labels and
     notes are `span`/`p`, never headings. No `tabindex`, no links/buttons, `pointer-events: none` on the sides and path.
   - `export function CardAvatar()`: `<span class="aw-card-avatar" aria-hidden="true">` + `Vignette` of
     `avatarDrawList(CARD_LOOK, …)`; outside `SmallWorld` the context is null so only the box renders.
4. **CSS** (`src/app/globals.css`, append after line 610, the end of the file; marker
   `/* SIM-068.1 small world (aw-world) */`). Constraints from `world-palette.test.ts`: the test's `block` is the aw
   marker **to the end of the file**, so the new block must not contain the words `animation`, `transition` or
   `@keyframes` (not even in comments), must not contain `.px-scene-canvas` (`:46`), and must add no `:root` /
   `[data-theme="dark"] {` token blocks (no new tokens; reuse `--aw-*`). Rules:
   - Default (below 1280): `.aw-world { display:flex; flex-direction:column; align-items:center; width:100% }`,
     `.aw-world-center { width:100%; max-width:400px; display:flex; justify-content:center }`,
     `.aw-world-side, .aw-world-path, .aw-card-avatar { display:none }`.
   - `@media (min-width: 1280px)`: `.aw-world { display:grid; grid-template-columns: 384px minmax(0, 400px) 384px; column-gap:24px; justify-content:space-between; align-items:center; max-width:1360px; position:relative }`;
     `.aw-world-center { grid-column:2; grid-row:1; position:relative; z-index:1 }`;
     `.aw-world-side { display:flex; flex-direction:column; grid-row:1; position:relative; pointer-events:none }` with
     `[data-side="left"] { grid-column:1 }`, `[data-side="right"] { grid-column:3 }`;
     `.aw-world-path { display:block; position:absolute; left:192px; right:192px; top:50%; height:20px; margin-top:-10px; pointer-events:none }`
     (runs from the left column centre to the right column centre, behind the card);
     `.aw-card-avatar { display:block }`.
   - Room box `.aw-room { position:relative; width:384px; height:224px; background: linear-gradient(to bottom, var(--aw-line) 0 64px, var(--aw-strip) 64px); box-shadow: 0 0 0 1px var(--aw-line) }`
     (calm placeholder, no layout-affecting border); `.aw-room-canvas { position:absolute; inset:0; display:block; width:384px; height:224px; image-rendering:pixelated }`;
     veil `.aw-room::after { content:""; position:absolute; inset:0; background:var(--aw-bg); opacity:.2; pointer-events:none }`,
     `[data-theme="dark"] .aw-room::after { opacity:.35 }`.
   - Label `.aw-room-label { position:absolute; top:8px; left:50%; transform:translateX(-50%); z-index:1; white-space:nowrap; padding:2px 8px; font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; background:var(--aw-strip); color:var(--aw-ink); border:1px solid var(--aw-line) }`
     (ink on strip is an AA pair already asserted by `world-palette.test.ts:38`; existing sans, no pixel font, D52/D45).
   - Paths: band 20 px of `var(--aw-line)` with a 2 px centre dash in `var(--aw-bg)`
     (`repeating-linear-gradient`, 8 px dash / 8 px gap): `.aw-world-path` horizontal, and `.aw-world-gap { position:relative; height:96px }`
     with a `::before` vertical band centred on the column (`left:182px; width:20px; top:0; bottom:0`).
   - Walker canvas `.aw-walker { position:absolute; top:26px; width:32px; height:32px; image-rendering:pixelated }`,
     left side `left:288px`, right side `left:64px` (on the horizontal band, inner side of the junction).
   - Notes `.aw-note { position:absolute; z-index:2; max-width:200px; padding:8px 12px; font-size:14px; background:var(--aw-strip); color:var(--aw-ink); border:1px solid var(--aw-line); box-shadow:0 3px 0 var(--aw-line) }`,
     anchored to the first room's bottom inner corner: left note `bottom:-16px; right:8px; transform:rotate(-2deg)`,
     right note `bottom:-16px; left:8px; transform:rotate(2deg)` (static transforms only).
   - Card avatar box `.aw-card-avatar { position:relative; width:40px; height:40px; flex:none; background:var(--aw-strip); border:1px solid var(--aw-line) }`
     with its canvas 32×32 at `left:3px; top:3px` (whole-number, zoom 1).
5. **AuthLayout** (`src/ui/auth/AuthLayout.tsx:43-62`): pull the `aw-frame` div into a `frame` const. Render
   `{landing ? <SmallWorld>{frame}</SmallWorld> : <div className="flex w-full max-w-[816px] … md:flex-row">{scene && <SignInScene />}{frame}</div>}`.
   In the landing intro (`:51-55`) wrap as `<div className="flex items-center gap-3"><CardAvatar /><div className="flex flex-col gap-1">…eyebrow + h2…</div></div>`.
   `scene` is ignored on the landing; update the doc comment (`:7-10`). Non-landing markup is byte-for-byte the same
   as today.
6. **Tests** as listed; run all Checks.

Rules: R1 — new code lives in `src/lib/sprites` (pure) and `src/ui/auth` (imports ui/lib only); `pnpm check:layers`.
R3 — no config. R4 — only the files listed. R5 — new pure logic (`standingAvatarOps`, `avatarDrawList`, four layouts)
has unit tests. R2/R6/R7 — not touched (no schema, no API, no auth).

## Specialist input used
frontend-developer (`consult-frontend-developer.md`):
- Adopted: finding 3 room compositions (adjusted to give the café and meeting room front-facing seated figures via
  rotation 180 and implied chairs); 4 zoom exactly 1, 384×224, no 2× anywhere; 5 avatars are not free-standing in
  `buildDrawList`, so a small helper builds avatar frame ops; 6 load the atlas once and share it (done through a
  context fed by one `AtlasFeed`, not one `useAtlas` per canvas); 8 grid `384px | minmax(0,400px) | 384px`, card in the
  centre column, hero above the grid, paths attached to grid geometry not fixed card offsets; 9 keep `SignInScene` for
  non-landing screens, landing ignores `scene`; 10 per-room placeholder, canvas invisible until painted; 11 the test set.
- Adjusted: finding 5's claim that path avatars cannot be drawn inside room canvases — standing avatars on free floor
  tiles inside LOUNGE/CAFE/MEETING are just extra avatar-layer ops after `buildDrawList`; they cover only their own
  floor tile (the overlap test guards it). Path walkers and the card avatar still get their own 32×32 canvases.
- Not adopted: finding 7 / rec 3 extracting a shared `useMediaQuery` hook and refactoring `SignInScene` — not needed for
  the ticket; the 7-line `subscribe` is repeated in `SmallWorld.tsx` to keep `SignInScene` and its tests untouched.
  Open question 1 (keep the vignette at 768–1279 on the landing): answered by Ming's Q5 via the orchestrator — no.
- Grid gap: adopted the fixed template but with `column-gap: 24px` + `justify-content: space-between` instead of
  `clamp(24px, 3vw, 48px)`, so spare width becomes path length rather than leaving it outside the grid.

ux-architect (`consult-ux-architect.md`):
- Adopted: rec 2 right-angle CSS paths, no SVG, no motion; rec 3 notes anchored to the lower inner corner of the top
  rooms, rotated ±2°, strip/ink/line styling, never over card or hero; rec 4 labels as small chips in the existing sans,
  12 px uppercase, `aria-hidden` (ink instead of muted for a tested AA pair); rec 5 rooms quieter than the card (veil,
  1 px frame, no drop shadow, card keeps its shadow; static avatars; path avatars same size as the card avatar);
  rec 6 dark mode via a stronger veil; rec 7 JS media gate with server snapshot false + CSS hiding; nothing between 768
  and 1279 on the landing; rec 8 decoration after the card in DOM.
- Not adopted: rec 1 `1fr` outer columns and vertically offsetting top rooms to the hero row — at 1280 px the hero
  (max 640 px) cannot sit between two 384 px rooms (384 + 640 + 384 = 1408 > 1223 px usable); hero stays above the grid.
  rec 6 new tokens (`--aw-room-tint`, `--aw-path`, `--aw-note-*`) — reusing `--aw-bg` / `--aw-line` / `--aw-strip` keeps
  `world-palette.test.ts` (which reads only the first token block after its marker) meaningful and avoids a second
  untested token set.

## Assumptions
- **Idle = static poses** (consult FD OQ2, UX rec 5). The ticket says "idle avatars", which does not require motion;
  `world-palette.test.ts:53-55` forbids `animation`/`transition`/`@keyframes` from the aw marker to the end of the file,
  and SIM-068 required `prefers-reduced-motion` to be respected. No animation anywhere.
- **Standing avatars via a small helper** (FD OQ3): `standingAvatarOps` / `avatarDrawList` reuse the existing
  `avatar.*.front` frames (32×32) — same art as seated figures, no new art. Used for 2 path walkers, the card avatar and
  one standing figure each in MEETING, LOUNGE and CAFE (LOUNGE has no seat). FOCUS/MEETING/CAFE also get seated figures
  through ordinary seats.
- **Note placement** (FD OQ4, UX OQ3): as in the mockup, overlapping the bottom inner corner of the two top rooms
  (FOCUS left, MEETING right), by 16 px into the 96 px path gap so the walker on the band (gap y 26–58) is never covered;
  each note stays inside its 384 px column at every width ≥ 1280, so it never reaches the card. Plain sans, no italic
  serif (the ticket gives the text only; Fraunces stays reserved for the headline).
- **Quiet rooms with a subtle veil** (UX OQ2): rooms paint in full atlas colour, then a `--aw-bg` overlay at 20 % (light)
  / 35 % (dark) via `::after`. This pulls the cool D46 office art toward the cream/green page (D85) without editing art
  and keeps the card the strongest element. No `filter` on canvases. Ming judges the result after merge.
- **1280 px fit (verified against the merged AuthLayout)**: `<main>` has `px-5` (`AuthLayout.tsx:33`) = 20 px each side.
  At a 1280 px window with a classic 17 px Windows scrollbar the layout viewport is 1263 px (the media query still
  matches at 1280 because it includes the scrollbar), so the world container is 1263 − 40 = 1223 px. Fixed tracks
  384 + 400 + 384 = 1168 px plus two 24 px minimum gaps = 1216 px ≤ 1223 px (7 px slack, gaps ≈ 27.5 px). Without a
  scrollbar: 1240 px → gaps 36 px. At 1440: container min(1400, 1360) = 1360 → gaps 96 px. The centre track is
  `minmax(0, 400px)`, so a wider scrollbar or an odd zoom shrinks the card a few px rather than overflowing; rooms never
  scale. `.aw-stage` already has `overflow-x-clip` for the rotated notes. Vertically each side is 224 + 96 + 224 =
  544 px, centred against the card (≈ 500–600 px); the horizontal path at 50 % of the grid therefore lands in the middle
  of each side's 96 px gap, meeting the vertical bands at the column centres. At 1280×720 the bottom rooms may sit
  below the fold (decoration only, acceptable).
- **Card avatar only at ≥ 1280 px**: it needs the atlas, which is never fetched below 1280 (AC1), so its box is hidden
  below 1280 and the intro looks exactly like slice 1 there.
- **Room labels** come from the mockup ("The focus studio", "Good ideas live here", "The slow corner", "Coffee &
  connection"); the ticket asks for labelled rooms without giving the strings, and the mockup is its scope reference.
  All four labels sit top-centre for consistency (the mockup puts the meeting label at the bottom).
- **Hidden = not rendered**: below 1280 the sides, path and card avatar are in the server markup but `display:none`
  (removed from layout and the accessibility tree); canvases and the atlas fetch are gated in JS, as `SignInScene` does
  with `hidden md:block`. This keeps SSR deterministic and the render tests meaningful.
- The 1280 px media query is written in px in both CSS and JS (`WORLD_MEDIA`) and the test asserts they match; Tailwind
  `xl:` is not used.
- **Hotspots**: `src/app/globals.css` is also edited by SIM-066 (IN_PROGRESS; tokens near lines 46/116/170) — this
  ticket only appends at the end of the file, so a rebase should be clean. SIM-067 and SIM-069 are PLANNING and may
  also touch `globals.css`. No other open ticket touches `AuthLayout.tsx`, `copy/auth.ts` or the auth view tests.

## Blocking questions
None.

## Split proposal
None. Estimated ~600–650 changed lines (scenes ~160, scene tests ~120, SmallWorld ~150, its tests ~100, CSS ~120,
AuthLayout/copy/test edits ~40), above the ~400-line guide, but about half is tests and static layout data and this is
already slice 2 of SIM-068's accepted split. A further cut would ship a half-finished landing. If the orchestrator
still wants one, the clean line is: SIM-068.1 = rooms (seated avatars only), labels, paths, notes, grid; follow-up =
`standingAvatarOps`/`avatarDrawList`, the path walkers, the standing figures and the card avatar.
