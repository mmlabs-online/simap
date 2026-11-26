Status: READY

# Plan — SIM-055: Give the sign-in screens a game-style look

## Scope summary
- Ticket goal: "The sign-in screens should feel like the start screen of a small office game, not a plain form next to
  an empty grey box" (Ming, 2026-11-26).
- D52 (`work/decisions.md:59`): "The pixel/game style is used only on end-user surfaces: sign-in and org picker, …
  Body text, tables and forms never use a pixel font."
- Style guide §1 (`docs/art/style-guide.md:33-36`): "Body text, numbers, tables and forms are never in a pixel font, on
  any screen. Pixel styling goes into art, frames, headings and decoration only … The clean UI kit (SIM-003) stays the
  base for both columns. Pixel surfaces add art and pixel accents; they do not replace the kit's controls."
- Style guide §7 (`docs/art/style-guide.md:140`): "Sign-in scene | `scene.signin` (a small office vignette) | about
  12×7 tiles | 1 | composed from the above". So the scene is composed at runtime from existing atlas frames. No new
  art and no atlas rebuild are needed. `scene.signin` stays out of the registry (`scripts/sprites/registry.test.ts:86-90`).
- Style guide §2 (`:40-44`) / D46 / D48: 32 px tiles, "Scaling: whole numbers only (1×, 2×, 3×), `image-rendering:
  pixelated`, no smoothing, no sub-pixel positions." D41: "No game engine or new library."
- D45 (`work/decisions.md:52`): assets only "CC0, CC-BY, or free packs whose page explicitly allows commercial use and
  modification". No font licence is recorded, and OFL is not on that list (see Assumptions A1).
- D36: UI copy in `src/ui/copy/<feature>.ts`.
- Ticket Scope: replace the `SignInScene` placeholder with a pixel office vignette drawn from the committed atlas at a
  whole-number scale (`aria-hidden`, hidden below `md`). Give the card a game-style frame, a pixel brand title, a
  pixel heading and a game-like primary button. Add a tiled floor background. Apply this to every `AuthLayout` screen
  and the org picker.
- Out of scope (ticket): changes to the flow, fields, Turnstile or Identity; pixel fonts in inputs, labels, notices,
  links or body text; new art, fonts or libraries; management screens.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Desktop: pixel office vignette next to the card instead of the grey box, drawn from the bundled atlas at a whole-number scale with no smoothing, hidden from assistive tech | `signin-scene.test.ts` (keys exist, bounds exactly 384×224, integer coordinates, 2 avatars, no unknown keys). `SignInScene.test.ts` › paint at zoom 1 sets `imageSmoothingEnabled=false` and a 384×224 canvas. `views.test.tsx` › scene is `aria-hidden` with no text, img or canvas on first render. CSS: `.px-scene-canvas` has `image-rendering: pixelated` and width/height 384/224 px. Local run: `pnpm dev`, signed out, at 1280 px the scene shows desks, chairs, monitors, plants, a window and two seated avatars, and is crisp. |
| 2 | Card, brand/heading and primary button have the pixel look; inputs, labels, notices and links keep the kit font and controls; focus clearly visible | `views.test.tsx` › "pixel classes only on brand, heading and the stage" (regex over `SignInView` / `ForgotPasswordView` markup: no `<input`, `<label`, `<a` or `role="status"` element carries `px-title`, `px-heading` or `font-pixel`; `px-title` sits on the brand `<p>` and `px-heading` on the `<h1>`). The submit `<button>` has `data-variant="filled"` inside `.px-card`. Local run: Tab through sign in. Every input, link and button shows a visible ring (3 px on the game button). Fields look like the kit. |
| 3 | Every `AuthLayout` screen and the org picker share the look; below `md` the card fills the width with no horizontal scroll at 320 px | `views.test.tsx` › AuthLayout has `px-stage`, `px-frame`, `px-strip`, `px-card`. `org-views.test.tsx` › OrgPickerView has `px-stage`/`px-frame`/`px-title` and no `px-scene`. Local run: DevTools at 320 px on `/`, forgot password, create account and an invitation link. No horizontal scrollbar, `document.documentElement.scrollWidth === 320`, scene hidden. |
| 4 | Text and focus-ring contrast meets WCAG AA; `prefers-reduced-motion` disables any animation | No animation is added (A2), so the global reduced-motion block (`globals.css:347-355`) is unchanged. Reviewer checks the token pairs in Approach step 5: brand `#1a2230` on `#14b8a6` ≈ 6.4:1; button text `#ffffff` on `#c2410c` ≈ 5.2:1; focus ring `--primary` on surface ≥ 15:1 in both themes; h1 and body colours are unchanged kit tokens. Local run: Rendering → emulate `prefers-reduced-motion: reduce` changes nothing visible. |
| 5 | If the atlas fails to load, the scene falls back to the current placeholder and sign-in still works | `SignInScene.test.ts` › paint returns false with no 2D context, so the canvas stays invisible. `signin-scene.test.ts` › a manifest missing a frame does not throw and lists the key in `unknown`. Local run: DevTools → block `/sprites/office.json` (then `/sprites/office.png`) and reload. The CSS placeholder box shows and sign-in works. |
| 6 | All Checks pass | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test` (including `no-photo-on-map.test.ts` and `copy/no-literals.test.ts`), `pnpm build` |

## Ming verification after merge
- Look and feel (subjective): does the sign-in screen read as a "game start screen"? Check light and dark themes on a
  real desktop browser and a real phone. Production CSP (SIM-027) is unchanged, so the atlas and canvas must load on
  the hosted site with no CSP console errors.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/signin-scene.ts` (new) | Pure data plus one function: `SIGNIN_SCENE: RoomLayout` (12×7), `SIGNIN_SEAT_VIEWS`, `SIGNIN_SEAT_DEVICES`, `signinDrawList(manifest): DrawList` (calls `buildDrawList`) | AC1. Pure logic first. Single source of which sprite goes on which tile | No |
| `src/lib/sprites/signin-scene.test.ts` (new) | Unit tests for the scene data | R5, AC1, AC5 | No |
| `src/ui/auth/SignInScene.tsx` | Becomes a `"use client"` component: placeholder box always, plus an inner `SceneCanvas` (mounted only at ≥768 px) that loads the atlas and paints. Exports `paintSignInScene(canvas, atlas)` | AC1, AC5, atlas off the critical path | No |
| `src/ui/auth/SignInScene.test.ts` (new) | `paintSignInScene` with a fake canvas (success and no-context fallback) | AC1, AC5 | No |
| `src/ui/auth/AuthLayout.tsx` | `px-stage` floor background on `<main>`, `min-h-dvh overflow-x-clip`. The brand moves into the `px-strip` title bar as `<p className="px-title">`. `px-heading` on the `<h1>`. `px-card` on the kit `Card`. `min-w-0` on the card column | AC2, AC3 | No |
| `src/ui/org/OrgPickerView.tsx` | `<AuthLayout … scene={false}>` (line 24) | AC3, A4: frame, floor and title, but no scene and no atlas load | No |
| `src/ui/Button.tsx` | Add `data-variant={variant}` to the `<button>` in `Button` (after `className`, line 58). No other change | Lets globals.css style the primary button on pixel surfaces only (`.px-card [data-variant="filled"]`) without forking the kit or editing every auth view. Not in the ticket's "likely" list, so recorded here | No |
| `src/app/globals.css` | New `--px-*` tokens in `:root` and `[data-theme="dark"]`. Upgrade `.px-frame` and `.px-strip`. New `.px-stage`, `.px-title`, `.px-heading`, `.px-card [data-variant="filled"]` (+ `:active`, `:disabled`, `:focus-visible`) and `.px-scene-canvas`. Dark placeholder colours. Lines 76-80, 134-135, 357-387 | AC1-AC4 | No |
| `src/ui/auth/views.test.tsx` | Extend `describe("pixel surface (D52)")` (lines 163-193) | AC1-AC3 | No |
| `src/ui/org/org-views.test.tsx` | One test: picker has the frame classes and no scene | AC3 | No |

`src/ui/copy/auth.ts` is **not** changed: the brand string (`authCopy.brand`, line 7) already exists and this plan adds no
new user-facing text. The decorative title-bar squares are `aria-hidden` spans with no text. If the implementer adds
any visible string, it goes in `authCopy` (D36). No file matches a High path.

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/sprites/signin-scene.test.ts` › layout is 12×7 and every floor, fixture and seat sprite resolves (`resolveFrameKey(sprite, rotation)` non-null and the key is in `REGISTRY` / `keys.json`) | AC1, ticket test plan "uses only keys that exist in `keys.json`" |
| `signin-scene.test.ts` › with the committed `public/sprites/office.json` (read like `placement.test.ts:23-25`): `signinDrawList(manifest).unknown` is `[]` and `bounds` equals `{x:0,y:0,w:384,h:224}` exactly (nothing overhangs the 12×7 box) | AC1 "fits the scene size" |
| `signin-scene.test.ts` › every op has integer x, y, w, h, and every frame op key is in `manifest.frames` | AC1 (no sub-pixel positions, style guide §2) |
| `signin-scene.test.ts` › the floor zones cover all 84 tiles (no transparent hole in the canvas) | AC1 |
| `signin-scene.test.ts` › exactly 2 seats have a non-null `avatarSeed` and a valid fixed `look` (`isPixelLook`). There are 6 ops on the `avatar` layer (body, shirt and hair × 2), and `SIGNIN_SEAT_VIEWS` states are `"occupied"` (no overlay ops) | AC1 "one or two avatars", fixed demo avatars (A3) |
| `signin-scene.test.ts` › blocking full-tile footprints (desks, cabinet, plants, cooler) do not overlap each other or a derived chair tile (`chairFor`) | Ticket test plan (UX consult: no tile overlapped by two furniture items) |
| `signin-scene.test.ts` › `signinDrawList` on a manifest clone without `window.double` does not throw and lists it in `unknown` | AC5 (stale or partial atlas) |
| `src/ui/auth/SignInScene.test.ts` › `paintSignInScene` with a fake canvas (pattern of `paint.test.ts:15-32`) and a fake `Atlas` built from `office.json` returns `true`, sets the canvas to 384×224, and logs `imageSmoothingEnabled=false` first | AC1 (zoom 1, no smoothing) |
| `SignInScene.test.ts` › `paintSignInScene` returns `false` when `getContext` returns null | AC5 fallback signal |
| `src/ui/auth/views.test.tsx` › (existing test updated) AuthLayout has `px-stage`, `px-frame`, `px-strip`, `px-card`, `px-title`, `px-heading` and the `px-scene` slot; `scene={false}` drops `px-scene`. The brand text `authCopy.brand` is inside the `px-strip` element | AC2, AC3 |
| `views.test.tsx` › (existing, kept) SignInScene is `aria-hidden` with no text and no img; **new**: first render (server) contains `px-scene` and no `<canvas` | AC1, atlas off the first paint |
| `views.test.tsx` › pixel classes stay off form text: in `SignInView` (with accounts) markup, no `<input`, `<label`, `<a` or `role="status"` tag has `px-title`, `px-heading` or `font-pixel` in its class; `px-title` only on a `<p`, `px-heading` only on the `<h1`; the markup contains no `font-pixel` at all (mirrors `AuditView.test.tsx:73`) | AC2, style guide §1 |
| `views.test.tsx` › the SignInView submit button renders `data-variant="filled"` and sits inside the `px-card` element | AC2 (game button hook) |
| `src/ui/org/org-views.test.tsx` › OrgPickerView markup contains `px-stage`, `px-frame`, `px-title` and does not contain `px-scene` | AC3, A4 |
| Existing, unchanged: `src/ui/no-photo-on-map.test.ts` (scans `src/lib/sprites`, so the new file must not contain "photo" or an Avatar import), `src/ui/copy/no-literals.test.ts`, `src/ui/roomlayout/paint.test.ts`, `src/lib/sprites/placement.test.ts` | Guards |

## Approach
1. **Scene data (`src/lib/sprites/signin-scene.ts`, lib layer, imports only `./placement`, `./layout`, `./types`).**
   Reuse `buildDrawList` (`placement.ts:116`). It already handles anchors, layer order, contact shadows, chairs
   (`chairFor`), devices on desks (`placeDevices`) and avatar layering (`avatarFrames` via `resolveLook`). That is
   less code than hand-built ops and has the same z-order as the room map. (This differs from the frontend consult,
   see Specialist input.) Proposed composition (tile coordinates; the implementer may nudge items while the tests
   stay green):
   - `floors` (painted first, layer `floor`, in order): `wall.top` {0,0,12,1}, `wall.face` {0,1,12,1}, `floor.carpet`
     {0,2,12,5}, `floor.wood` {0,5,3,2} (entrance strip). The walls go in as floor zones on purpose: as fixtures,
     `wall.face` tiles to the right of a window sort after it (`placement.ts:399-405`, tie-break on x) and would cover
     its right half.
   - `fixtures` (rotation 0): `window.double` at (5,1), `clock.wall.s` at (9,1), `plant.large` at (0,2),
     `cabinet.filing.s` at (10,2), `plant.small` at (11,2), `cooler.water.s` at (11,5), `prop.mug` at (4,3),
     `prop.papers` at (8,3).
   - `seats`: `desk.single`, rotation 0 (→ `desk.single.s`, 2×1), at (3,3) and (7,3), ids `signin-1` / `signin-2`,
     codes `A1` / `A2` (never shown). Chairs are derived at (3,4) / (7,4) as `chair.office.n`, so the avatars are
     back views.
   - `SIGNIN_SEAT_DEVICES`: `signin-1` → `[{ type: "monitor" }]`, `signin-2` → `[{ type: "laptop" }]` (name-based
     kind, `deviceType` undefined; `device-slots.ts:80-90`).
   - `SIGNIN_SEAT_VIEWS`: both `{ state: "occupied", avatarSeed: "signin-demo-1|2", name: null, look: <fixed PixelLook> }`.
     Use two different looks, e.g. `{skin:0,hair:1,style:2,shirt:1}` and `{skin:2,hair:4,style:1,shirt:5}`. No user
     data is involved.
   - Prefer keys whose `meta.sources` entry in `public/sprites/office.json` is `"map"` (real art). Every key above is
     `"map"`, except the avatar layers, which are placeholders in the atlas today, the same as on the room map. Avoid
     `desk.pair.*`, `shelf.books`, `whiteboard`, `prop.keyboard` and `wall.base` (all placeholders).
   - `signinDrawList(manifest) = buildDrawList(SIGNIN_SCENE, SIGNIN_SEAT_VIEWS, manifest, SIGNIN_SEAT_DEVICES)`.
     Export `SIGNIN_SCENE_PX = { w: 384, h: 224 }`.
2. **`SignInScene.tsx` (ui layer, `"use client"`).** R1: import `useAtlas` from `"../roomlayout/useAtlas"`, `paintRoom`
   from `"../roomlayout/paint"` and the `Atlas` type from `"../roomlayout/loadAtlas"`. These are leaf files. **Never**
   import `"../roomlayout"` (the index pulls the editor into the sign-in chunk). `@/lib/sprites/signin-scene` is lib.
   - Outer: `<div aria-hidden="true" className="px-scene relative hidden md:block">`. The existing CSS placeholder is
     the background and reserves the 384×224 box (no layout shift).
   - Gate: `useSyncExternalStore(subscribe, () => matchMedia("(min-width: 768px)").matches, () => false)` (pattern of
     `LayoutEditorPage.tsx:22-37`). Render `<SceneCanvas />` only when true, so phones never fetch the atlas and the
     server render has no canvas.
   - `SceneCanvas`: `const { atlas } = useAtlas()` (loads in an effect, after first paint). A ref canvas and
     `painted` state. In an effect on `atlas`, run `setPainted(paintSignInScene(ref.current, atlas))`. Render
     `<canvas ref className={"px-scene-canvas absolute inset-0" + (painted ? "" : " invisible")} />`. On failure
     (`failed`, or a false paint), the canvas stays invisible and the placeholder shows (AC5). No animation loop.
   - `export function paintSignInScene(canvas, atlas): boolean { return paintRoom(canvas, atlas,
     signinDrawList(atlas.manifest), 1); }`. Zoom is the integer 1 (A6).
   - Update the doc comment. It now says "SIM-024 replaces …"; change it to say it paints the composed `scene.signin`
     and stays decorative.
3. **`AuthLayout.tsx`.**
   `<main className="px-stage flex min-h-dvh items-center justify-center overflow-x-clip px-5 py-8 text-on-background">`
   (drop `bg-background`; `.px-stage` paints the floor). The row stays `max-w-[816px] … md:flex-row` (384 + 40 + 400
   fits). Card column: `px-frame w-full min-w-0 max-w-[400px] flex-none`. Strip:
   `<div className="px-strip">` (no longer `aria-hidden`) containing `<p className="px-title">{authCopy.brand}</p>`
   and 3 decorative `<span aria-hidden="true" />` squares. `Card` gets `px-card` added to its existing className. The
   `<h1>` becomes `font-heading px-heading text-xl font-bold`. The brand `<p>` that sits inside the Card today is
   removed (it moves into the strip). `children` are untouched, so every view keeps its kit fields, notices and links.
4. **`Button.tsx`.** Add `data-variant={variant}` to the button attributes after `className` (keep attribute order
   otherwise; `MemberPickerDialog.test.tsx:39-41` and similar regexes rely on `type` being first). This is the only
   kit change.
5. **`globals.css`.** All CSS-only. No font and no `@keyframes`. Rules are unlayered, so they beat the Tailwind
   utilities on the same element. Keep them after the focus rule (line 340).
   - Tokens in `:root`, next to line 80: `--px-bg: #eceff3; --px-bg-alt: #e4e8ee; --px-shadow: #b3bcc9;
     --px-title: #1a2230; --px-title-shadow: #5eead4; --px-heading-shadow: #99f6e4; --px-btn: #c2410c;
     --px-btn-ledge: #7c2d12; --px-btn-text: #ffffff;`. Dark overrides, next to line 135: `--px-bg: #121417;
     --px-bg-alt: #171a1e; --px-shadow: #050608; --px-heading-shadow: #115e59; --px-floor: #1e2228;
     --px-wall: #2a2f37;` (`--px-floor` and `--px-wall` are used only by `.px-scene`, so the dark placeholder stops
     glaring). Add `--color-px-*` entries to `@theme inline` (lines 176-179) only if a Tailwind utility uses them.
   - `.px-stage`: `background: repeating-conic-gradient(var(--px-bg) 0 25%, var(--px-bg-alt) 0 50%) 0 0 / 64px 64px;`
     (a 32 px checker, low contrast, no image).
   - `.px-frame`: 4 px stepped bands (`0 -4px`, `0 4px`, `-4px 0`, `4px 0` in `--px-outline`), then a hard pixel drop
     shadow (`8px 8px 0 0 var(--px-shadow)` plus `4px 8px` / `8px 4px` steps). The outward extent must stay ≤ 12 px
     so the `px-5` (20 px) padding prevents scroll at 320 px. No `overflow: hidden` on the frame or card, so focus
     rings are not clipped.
   - `.px-strip`: becomes a title bar. `display:flex; align-items:center; justify-content:space-between;
     min-height: 28px; padding: 4px 10px; background: var(--px-accent); border-bottom: 4px solid var(--px-outline)`.
     The decorative squares are 6×6 px in `--px-title`.
   - `.px-title`: `margin:0; color: var(--px-title); font-weight: 800; font-size: 14px; text-transform: uppercase;
     letter-spacing: .12em; text-shadow: 1px 1px 0 var(--px-title-shadow);`, plus `overflow-wrap:anywhere`.
     Contrast: `#1a2230` on `#14b8a6` ≈ 6.4:1, the same in both themes, because the strip colour is not
     theme-dependent. (The dark `--px-outline` `#8b95a7` would fail on teal, which is why the separate token exists.)
   - `.px-heading`: `text-transform: uppercase; letter-spacing: .06em; text-shadow: 2px 2px 0 var(--px-heading-shadow);`
     The glyph colour stays `on-surface` (unchanged contrast) and the size stays `text-xl` (20 px). Kit font only.
   - `.px-card [data-variant="filled"]`: `border-radius:0; background: var(--px-btn); color: var(--px-btn-text);
     border: 3px solid var(--px-outline); box-shadow: 0 4px 0 0 var(--px-btn-ledge); transform:none; transition:none;
     text-transform: uppercase; letter-spacing: .06em`. `:active` → `transform: translateY(2px); box-shadow: 0 2px 0 0
     var(--px-btn-ledge)`. `:disabled` → `box-shadow:none` (the kit `opacity-40` stays). `:focus-visible` →
     `outline: 3px solid var(--primary); outline-offset: 3px` (this rule's box-shadow replaces the global 3 px halo;
     the outline is the ring). No hover colour change, because a lighter orange drops white text toward 4.5:1.
     White on `#c2410c` ≈ 5.2:1. `.state-layer::after` inherits radius 0. Add `margin-bottom: 4px` so the ledge never
     covers the next element's focus ring.
   - `.px-scene-canvas`: `display:block; width:384px; height:224px; image-rendering: pixelated;`.
   - Do not change the global focus rule or the reduced-motion block.
6. **`OrgPickerView.tsx`.** Change line 24 to `<AuthLayout title={orgCopy.picker.title} scene={false}>`. The org
   buttons stay kit `tonal` buttons and are not restyled.
7. **Tests** as listed. Then run every Check. Then the manual pass: `pnpm dev`, signed out, 1280 px and 320 px, light
   and dark, Tab order, atlas blocked, forgot password / create account / accept invitation / org picker.

Rules: R1 holds (ui → ui leaf files and lib; lib → lib; `pnpm check:layers`). R3: no config or secret. CSP
(`src/lib/security/headers.ts:32-44`) already allows same-origin `img-src`/`connect-src`, so `headers.ts` is untouched.
R4: only the files above. R5: new logic has tests. Copy rule D36: no new strings; any added string goes into `authCopy`.

## Specialist input used
- frontend-developer: adopted the leaf imports (`useAtlas`, `paint`, never the `roomlayout` barrel), the placeholder
  first and canvas after atlas, `paintRoom` false or `failed` as the fallback, 1× at 384 px, the `md` gate on the atlas
  load, no CSP change, CSS lettering instead of a font, the pure data file in `src/lib/sprites/` and the jsdom
  limitation (tests use SSR markup plus a fake canvas). Rejected "do not use `buildDrawList`, hand-build ops": the
  scene can be expressed as a `RoomLayout`, and `buildDrawList` then gives correct anchors, z-order, shadows, chairs,
  devices and avatar layers for free, with no new ordering code. Button question answered: `Button` accepts
  `className`, but a `data-variant` hook plus a scoped CSS rule covers every auth view's primary button without
  editing each view.
- ux-architect: adopted the floor tiles and dark tokens, the stepped 4 px frame with a hard pixel drop shadow, the
  brand on the strip as a title bar, the CSS pixel lettering (uppercase, letter-spacing, hard text-shadow), the
  darker `--px-btn` orange token (`#c2410c`, ≈ 5.2:1) instead of `#fb5729` (≈ 3.1:1), the ledge and pressed state,
  the 3 px focus outline, `overflow-x-clip` / `min-w-0`, the two fixed-look back-view avatars, and the org picker
  with frame, floor and title only. Adopted the `--px-title` text token on the strip, because the dark `--px-outline`
  would fail on teal. Not adopted: a separate title bar above both scene and card (the brand goes in the card's strip,
  which needs less layout change), 2× at `xl` (A6), the idle animation (A2), and the `px-frame` borders on org option
  buttons (kit buttons stay as they are, style guide §1).

## Assumptions
- A1 **No pixel font: CSS pixel lettering on the brand and h1, Manrope kept.** The repo has no pixel font, and D45
  lists CC0, CC-BY and explicitly-commercial packs only. An OFL font (Silkscreen, Pixelify Sans) would need a new
  decision plus a `CREDITS.md` and licence entry. The look works without one (uppercase, tracking, hard text-shadow,
  pixel frame and button). Alternative if Ming wants it: a follow-up ticket that records the OFL licence, loads it
  with `next/font/google` in `src/app/layout.tsx` scoped to a CSS variable, and applies it to `.px-title` and
  `.px-heading` only.
- A2 **No idle animation.** It is optional in the ticket, and the global reduced-motion clamp would then need checking.
  Alternative: a later CSS-only `steps()` monitor blink on an overlay element.
- A3 **Fixed demo avatars** (two hard-coded `PixelLook`s). No visitor data exists signed out.
- A4 **Org picker:** frame, floor and title, but no scene (`scene={false}`). This also means it never loads the
  atlas. Today it shows the grey placeholder box; that box goes away.
- A5 **Dark-mode `--px-*` tokens are added** (floor, wall, shadow and heading-shadow overrides). The scene art itself
  keeps the single fixed palette in both themes (style guide §3).
- A6 **Scene at 1× (384×224)** at every width from `md`. At 2× (768 px) it does not fit beside the 400 px card in the
  816 px row. Alternative: widen the row at `xl` and use zoom 2 there (one more media gate). Left out to keep this
  ticket small.
- A7 `ProfileView` (first-visit profile) and `DevGate` also use `AuthLayout`, so they get the new look and the scene.
  This is intended ("one set").
- A8 The vignette uses the committed atlas (`meta.version` `7793b817d5b7`). If Ming repacks with `--no-map`, the
  scene shows placeholder frames. The key set is the same, so the tests stay green.
- Hotspots: the only other open tickets are SIM-056 (portal photo crop: `src/lib/photo-crop.ts`, `src/ui/portal/**`,
  `src/ui/copy/portal.ts`) and SIM-020 / SIM-043 (BACKLOG, server). **No file overlap.** Both tickets rely on the
  read-only guards `src/ui/copy/no-literals.test.ts` and `src/ui/no-photo-on-map.test.ts`, and neither edits them.
  `src/ui/Button.tsx` is not in SIM-056's plan.

## Blocking questions
None.

## Split proposal
None. Estimate: about 450 changed lines. About 200 of those are tests, and about 110 are CSS. The logic is small
(one data file, one client component), so it fits one implement/review cycle.
