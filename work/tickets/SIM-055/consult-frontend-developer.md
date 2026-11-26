# Consult — frontend-developer — SIM-055

## Findings

**Current state**
- `SignInScene.tsx` is a 1-line `<div aria-hidden className="px-scene hidden md:block"/>`. `.px-scene` (globals.css ~372) is a 384 px (12x32) CSS gradient with a 2 px stepped outline. `AuthLayout.tsx` is a `px-frame` + 12 px `px-strip` + kit `Card`. Brand is plain `text-xs`; h1 uses Manrope (`font-heading`).
- `public/sprites/office.png|json` are committed. `src/lib/sprites/keys.json` has `chair.office.{n,e,s,w}`, `desk.pair.e`, `avatar.body/hair/shirt.{front,back}`, plus floors, walls and plants. I only sampled it, so confirm the exact wall/window/monitor/plant keys during planning. `scene.signin` is deliberately NOT in the registry (`scripts/sprites/registry.test.ts:86-90`). It is "composed later", so no new art or atlas rebuild is needed.
- Style guide §4 says the scene is about 12x7 tiles at 32 px, composed from existing frames.

**Reuse (R1)**
- `src/ui/roomlayout/{useAtlas,paint,loadAtlas}.ts` are ui layer. `src/ui/auth` may import ui, so `import { useAtlas } from "../roomlayout/useAtlas"` and `paintRoom` from `../roomlayout/paint` are legal. `check:layers` allows ui → ui and lib.
- Do not import from `../roomlayout` (the index). It pulls `LayoutEditorPage`, the editor and the whole room-map bundle into the sign-in chunk. Import the leaf files only.
- `paintRoom(canvas, atlas, list, zoom)` takes a `DrawList` (`ops`, `bounds`, `seats`, `unknown`). The ops are `{type:"frame", key, x, y}`-style (frame op shape is at placement.ts:23-30; verify). `tintedFrame` is already used inside `paintRoom` for `op.tint`, so tinting needs no extra code.
- `paintRoom` sets `imageSmoothingEnabled=false` after resizing and uses an integer zoom. This satisfies D46/D48 and the acceptance criterion about no smoothing. It returns false if the canvas is too big or has no 2D context, which is the fallback signal.
- Do not use `buildDrawList`. It needs rooms, seats and layout, and applies room logic. Add a pure data file `src/lib/sprites/signin-scene.ts` that exports `SIGNIN_SCENE_OPS` (a `DrawList` built directly: floor tiles, back wall, window, desks, chairs, monitors, plants, 1-2 avatars composed from `avatar.*` frames) and `SIGNIN_SCENE_TILES = {w:12,h:7}`. It lives in lib, so it is unit-testable. Test that every key exists in `keys.json` and that ops fit 384x224. Reuse `src/lib/sprites/avatar.ts` for the avatar layering if it exports a composer.
- Chair/avatar direction: `ROTATION_TO_DIR` and `chairFor` exist in placement.ts. Reuse them rather than hand-picking.

**Keeping the atlas off the critical path**
- `useAtlas` runs in `useEffect` only after hydration, so the card paints first. `SignInScene` must be a client component (`"use client"`), render the existing `.px-scene` placeholder div by default, and swap to `<canvas>` only when `atlas` is non-null.
- `useAtlas` fires on mount even where the scene is `hidden md:block`, so mobile would still download office.png. Gate it: e.g. render an inner `SceneCanvas` component that calls `useAtlas` only when `matchMedia("(min-width:768px)")` matches. Or use `requestIdleCallback`/`setTimeout` to start the load. If the plan keeps it simple, `hidden md:block` plus loading anyway is acceptable but wasteful.
- Failure fallback comes for free: `failed` or `paintRoom() === false` keeps the CSS placeholder (acceptance criterion 5). Keep `loadAtlas` `no-cache` for the manifest. It costs one conditional request, which is fine.
- No layout shift: the placeholder and the canvas share the same 384x224 box (set explicit width/height or aspect-ratio and reserve it).
- Whole-number scale: 1x (384 px) fits in the 816 px row. 2x (768 px) does not fit beside a 400 px card, so choose 1x, and add `image-rendering: pixelated` on the canvas (SIM-006.2 review.md:106 already warns about this for the swap).
- The org picker presumably uses `AuthLayout` with `scene={false}` or its own frame (check `OrgPickerView`). It must not load the atlas.

**CSP (SIM-027, `src/lib/security/headers.ts:32-44`)**
- `img-src 'self' data: blob:` and `connect-src 'self' <identity>` cover `/sprites/office.png` via `new Image()` and the manifest via `fetch`. Canvas drawing needs no CSP directive. `tintedFrame` uses only canvases. No change needed.
- `font-src 'self' https://fonts.gstatic.com` and `style-src ... fonts.googleapis.com` are already allowed. next/font self-hosts anyway, so a pixel font via `next/font/google` also needs no CSP change.
- The existing headers test pins the CSP strings, so leave `headers.ts` alone.

**Pixel font**
- None in the app: `layout.tsx` loads only Manrope via `next/font/google`, and there is no `@font-face` except Material Symbols. Pixelify Sans and Silkscreen appear only in `docs/art/mockups/room-styles.html` (Google Fonts link, a mockup). `assets/art/` has no font files and no font licence. `CREDITS.md` and `licences/` list only art packs (2dpig CC0, imersa, comshadow). Both fonts are OFL on Google Fonts as far as I know, but that is not recorded in the repo, so D45 is not satisfied yet.
- Recommendation: the ticket allows the fallback, so default to CSS pixel lettering (a stepped `text-shadow`, uppercase, letter-spacing) on the brand line and h1, keeping Manrope. If Ming wants a real pixel font, the plan must flag it and add a licence row to `assets/art/CREDITS.md` and the licence text under `assets/art/licences/`. Use `next/font/google` in `layout.tsx` with `display:"swap"` and scope it via a CSS variable used only on the brand and h1.

**CSS**
- Extend globals.css `px-*` utilities (`.px-frame` is a 2 px stepped outline; add a pixel drop shadow, e.g. `box-shadow: 4px 4px 0 var(--px-outline)` steps; `.px-btn` with chunky border and `:active` translate; `.px-floor` background tile pattern via `repeating-conic-gradient` or a small data-URI/CSS gradient, with `image-rendering: pixelated`). The reduced-motion block at ~350 already zeroes animation durations, so an idle effect (e.g. a blinking monitor) is safe if CSS-only.
- Dark theme: `--px-outline` is #8b95a7 for contrast in dark, so the new shadow colours need AA checks in both themes. Focus ring: the kit's focus style must not be clipped by `px-frame` `overflow`.
- The game button: the plan must decide how to style the kit `Button` without forking it, e.g. a `className` prop or a wrapper on `AuthLayout`'s children. Check whether `Button` accepts `className` with `!` overrides, as `Card` does with `rounded-none!`.

## Recommendations
1. (AC1, AC5) New `src/lib/sprites/signin-scene.ts` (pure data) plus a client `SignInScene` that renders the placeholder first, then a `<canvas aria-hidden>` painted by `paintRoom` at zoom 1. Import `../roomlayout/useAtlas` and `../roomlayout/paint` directly, never the barrel.
2. (AC1, risk) Load the atlas only when `md` and up, after first paint (effect, optionally idle). Do not load it for the org picker or when `scene={false}`.
3. (AC2/3) Do the frame, button and floor in globals.css utilities. Apply the same `AuthLayout` frame to `OrgPickerView` (or have it use `AuthLayout scene={false}`) so there is one set.
4. (AC2, D45) Brand and h1 via CSS pixel lettering unless Ming approves a licensed OFL font. Keep inputs, labels, notices and links on the kit font.
5. Tests: scene data keys exist in `keys.json` and fit 12x7 tiles; the `AuthLayout`/`OrgPickerView` frame classes (extend `views.test.tsx` "pixel surface (D52)", ~line 163); no pixel-font class on inputs, labels or body text; component test with a mocked `useAtlas` (placeholder when null/failed, canvas when loaded, `aria-hidden`); copy has no literals (`src/ui/copy/auth.ts`).
6. Keep `src/ui/no-photo-on-map.test.ts` green (this adds no photo code).

## Risks
- Barrel import of `roomlayout` bloats the sign-in bundle and could break the layer or bundle expectations.
- The atlas fetches (2 requests, `no-cache` manifest) on every sign-in view, including mobile where the scene is hidden. Gate them as above.
- jsdom has no canvas 2D context. Component tests need `getContext` mocked, or the paint call isolated. `paintRoom` returning false is the natural fallback path to test.
- Contrast: the pixel text-shadow lettering can hurt readability; check AA on both themes. Focus ring clipped by the frame box-shadow or `overflow:hidden`.
- Layout: the 384 px scene plus a 400 px card fits 816 px. A 320 px viewport must have the scene hidden and the card at full width without horizontal scroll (the drop shadow offset can cause overflow at the right edge, so pad it).
- Reaching ticket scope: the avatar composition could pull in `avatar.ts` logic. Keep it to 1-2 static avatars.
- SIM-006.2 review (line ~106): the scene must be `image-rendering: pixelated` and a whole-number size, or it blurs.

## Open questions
1. Pixel font for brand/heading: CSS lettering only (default), or add an OFL font (Pixelify Sans or Silkscreen) with the licence recorded under D45? Needs Ming's call.
2. Does `OrgPickerView` show the scene, or only the frame/background? (Default: frame and background only, no atlas load.)
3. Is a small idle animation wanted (blinking monitor, plant sway)? Default: none, since it is optional and needs a reduced-motion check.
4. Exact atlas keys for window, monitor and plants (not confirmed here); the planner should list them from `keys.json` before drafting the scene data.
5. Does the kit `Button` accept a className override for the pixel style, or does the game button need a small wrapper component in `src/ui/auth/`?

Files read: `work/tickets/SIM-055/ticket.md`, `src/ui/auth/{SignInScene,AuthLayout}.tsx`, `src/ui/roomlayout/{useAtlas,paint,loadAtlas,index}.ts`, `src/lib/security/headers.ts`, `src/app/globals.css` (350-388), `src/lib/sprites/keys.json` (sampled).
