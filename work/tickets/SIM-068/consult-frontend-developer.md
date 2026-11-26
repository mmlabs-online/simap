# Consult — frontend-developer — SIM-068

## Findings

Read-only pass over the ticket, the mockup, `AuthLayout.tsx`, `SignInScene.tsx`, `signin-scene.ts`, `headers.ts`, `globals.css` (px-* block, lines 372-465), `keys.json` and `paint.ts`.

**Current structure**
- `AuthLayout` (title, children, scene=true) is used by every auth view: `views.tsx` (Checking, SignIn, Join, Unverified, NoOrg, NoAccess, Retry), `account-views.tsx`, `accept-views.tsx` and `DevGate.tsx`. All use the `title` prop, so the signature must stay stable. Changing `AuthLayout` changes every one of these screens, which the ticket wants anyway for header, background and card frame.
- `SignInScene` is a client component. It uses `useSyncExternalStore` on `(min-width: 768px)` with server snapshot `false`, so the canvas is only mounted at `md` and up and never on phones. A CSS gradient placeholder (`.px-scene`) is always present, and `useAtlas()` loads the atlas after mount (off the critical path). It calls `paintRoom(canvas, atlas, signinDrawList(manifest), 1)`.
- `paintRoom(canvas, atlas, list, zoom)` takes any `DrawList` and an integer zoom. It returns false if the canvas is over budget or has no 2D context. `buildDrawList(layout, seatViews, manifest, seatDevices)` takes a `RoomLayout` made of `floors`, `seats`, `fixtures`, so it can compose any number of rooms.
- Existing tests are node-only: `renderToStaticMarkup` for views, and `SignInScene.test.ts` with a Proxy fake canvas for painting. It asserts a 384x224 canvas and `scale(1,1)`. There is no jsdom.
- The sign-in form lives in `SignInView` (`views.tsx` lines 26-151), wrapped in `AuthLayout title={copy.title}`. The card chrome is `px-frame` / `px-strip` / `px-card`.
- Fonts: Manrope comes from `next/font/google` in `src/app/layout.tsx`. That is build-time self-hosted, so no runtime font host. The CSP allows `fonts.googleapis.com` and `fonts.gstatic.com` for the icon font. There is no serif in the repo yet.
- Atlas keys that exist in `keys.json`:
  - Floors: `floor.carpet`, `floor.carpet.alt`, `floor.lavender`, `floor.wood`.
  - Walls: `wall.top`, `wall.face`, the `wall.corner.*` family.
  - Desks and chairs: `desk.single.{n,e,s,w}`, `desk.pair.*`, `chair.office.*`.
  - Meeting: `table.meeting.*`, `screen.projector.*`, `whiteboard`.
  - Lounge: `sofa`, `table.coffee`, `shelf.books`.
  - Other: `plant.large`, `plant.small`, `lamp.floor`, `lamp.desk.*`, `cooler.water.*`, `cabinet.filing.*`, `clock.wall.*`, `window.*`, `prop.{keyboard,mouse,mug,papers}`, `avatar.*`.
  - There is no coffee counter, coffee machine, rug, stool or bench. The café vignette has to be improvised (see Recommendations).
- Mockup versus ticket, regions: header (logo, tagline, "Need a hand?" which is out of scope), hero, card, four rooms at the corners, dotted paths, two note cards, vibe switcher (out of scope), footer. The mockup rooms are top-down, flat, tinted tiles. The atlas is the existing 3/4 office look, so the result will be "in the spirit of", not pixel-identical.

## Recommendations

1. **Component split** (all under `src/ui/auth/`, each pure and server-renderable except the canvas):
   - `AuthLayout.tsx` keeps its API. It renders `AuthHeader` (logo, wordmark, tagline), the hero and the card slot, and `AuthFooter`.
   - The hero (eyebrow, headline with `<em>` on "A better workday.", subline) and the card avatar intro ("Player, ready?" / "Come on in.") should appear only on the sign-in screen. Other auth screens keep their own `title` `h1`.
     - Add an optional `variant?: "landing" | "plain"` or `hero?: ReactNode` prop, defaulted so other views do not change.
     - `SignInView` passes the hero and intro. Its fields, links and buttons stay byte-for-byte; only the wrapping and the `px-card` styling change.
     - Keep exactly one `h1`: the headline for the landing, or the title for the others. Do not make the card title a second `h1`; use the "Your workspace portal" strip as a `p`.
   - `SmallWorld.tsx` (client): `aria-hidden`, `hidden md:block`, absolutely positioned layer behind the card. It contains four `RoomVignette` components, the SVG or CSS dotted paths, the idle avatars and the two note cards.
   - `RoomVignette` takes `{ layout, label, zoom }`. It is one canvas per room, using the same `useAtlas` + `paintRoom` + matchMedia-gate pattern as `SignInScene`. Share the media gate instead of copying it: extract a `useWide()` hook, or just export one from `SignInScene.tsx`.
   - The room labels ("THE FOCUS STUDIO") are decorative DOM text inside the `aria-hidden` layer. Pixel or mono styling is allowed here (style guide §1 only bans it for forms and body text). Never use a pixel font for the card or hero subline.
   - Room layouts go in a new `src/lib/sprites/small-world-scenes.ts` (pure lib, like `signin-scene.ts`): `FOCUS`, `MEETING`, `LOUNGE`, `CAFE` as `RoomLayout`, with fixed seat views and looks for the idle avatars. Leave `signin-scene.ts` and `SignInScene.tsx` untouched. If the old single scene is no longer used, delete it in the same ticket along with `.px-scene*`, or keep it for `scene={true}` on other screens (decide in the plan).
2. **Atlas and scale**
   - Use only existing keys.
   - Focus studio: `desk.single` or `desk.pair` + `chair.office` + monitor devices + `plant.large`.
   - Good ideas: `table.meeting` + `chair.office` + `whiteboard` or `screen.projector`.
   - Slow corner: `sofa` + `table.coffee` + `shelf.books` + `lamp.floor` + `plant`, on `floor.lavender`.
   - Café: `table.coffee` or `desk.single` as tables + `cooler.water` + `cabinet.filing` (as the counter) + `prop.mug` on `floor.wood`. Say in the plan that there is no coffee-machine sprite; do not add art (D45).
   - Pick one whole-number zoom (1x; 2x only if the canvas budget allows) via `paintRoom(..., zoom)`. Never CSS-scale the canvas to a fractional size: set CSS width and height to exactly `bounds * zoom` and keep `image-rendering: pixelated`. The mockup rooms are about 400x280 CSS px at a 1440 width, so tiles of 32 px at 1x give about 12x8 tiles. That means about 4 canvases of roughly 384x256 at 1x, which is cheap.
   - Paint in `useEffect` after the atlas loads, as `SignInScene` does. Never block the form. Keep the CSS-gradient placeholder per room, so a failed atlas leaves a calm tinted box. Give the layer fixed dimensions so there is no layout shift (CLS).
   - Do not mount canvases below `md` (reuse the `useSyncExternalStore` gate), so phones never fetch the atlas.
3. **Paths and notes:** use plain CSS (dashed borders, or one absolutely positioned inline SVG with `stroke-dasharray`). They are decorative and hidden on mobile. Position the four rooms with CSS grid or `absolute` + `clamp()` relative to a centred container (max about 1400 px), and below roughly 1280 px either scale the zoom down to 1x or hide the two outer rooms (the layer must not overlap the card). Note cards are `div`s, not buttons, with no `tabindex`, so they add no interactive control.
4. **Serif headline font:** add one `next/font/google` import in `layout.tsx` (for example Newsreader or Fraunces, italic, subset `latin`, `display: "swap"`, `variable: "--font-serif"`). It is OFL-licensed and build-time self-hosted, so it needs no CSP change (`font-src` already has `'self'`). Expose `--font-serif` in the Tailwind theme and use it only on the `<em>` span. Fallback `Georgia, serif`. Alternative if Ming prefers no new Google import: `font-style: italic` on Manrope (Manrope has no italic, so it would be a synthesised oblique; ticket says use closest and note it). Verify the font files really are emitted under `/_next/static/media` in the build. Layout.tsx is shared, but this is a one-line change.
5. **Keeping the form unchanged:** do not touch field order, ids, labels, `Field`, `ShowPasswordToggle`, Turnstile or Notice in `views.tsx`. Only the wrapper markup and the `px-*` CSS change. The `.px-card [data-variant="filled"]` rule already restyles the primary button; reuse it and add the mockup's green via existing tokens. Do not add a "Remember my email" checkbox, a Show toggle beyond the existing one, or the demo strings; add a test that scans the rendered HTML for forbidden strings.
6. **Copy:** all new strings go in `src/ui/copy/auth.ts` as `authCopy.landing.{tagline, eyebrow, headlineA, headlineB, subline, portalTitle, intro..., rooms[], notes[], footer[]}`.
7. **390 px:** below `md`, order is header, hero, card, footer. No rooms, no paths, no notes (optionally one compact CSS strip of tiles). Keep the `px-stage` background. The `px-frame` box-shadow extends 12 px, so keep `px-5` page padding plus `overflow-x-clip`. At 390 px the headline needs `text-3xl` or similar with `text-balance`, and the footer should stack. The eyebrow and "Your workspace portal" mono strings need `overflow-wrap: anywhere`.
8. **Motion and a11y:** idle avatar bobbing, if added, is CSS only inside `@media (prefers-reduced-motion: no-preference)`; the existing global reduce rule already near-zeroes animations. The whole decorative layer is `aria-hidden`, and canvases have no text. Check contrast of the muted subline and footer text on the cream background (WCAG AA) in light and dark; `--px-*` tokens may need a dark variant for the new panel colours.
9. **Tests (node, no jsdom):**
   - `renderToStaticMarkup(<SignInView .../>)`: assert header text, eyebrow, headline with an `<em>`, subline, "Your workspace portal", footer strings, four room labels present and inside an `aria-hidden="true"` ancestor, and exactly one `h1`.
   - Negative assertions: no "Demo", "Explore the demo", "no real authentication", "Need a hand", "Remember my email", "Find your vibe". Count `button, a, input` in the output against a fixture of today's markup. Only the markup assertions in existing `views.test.tsx` may change.
   - Pure tests for the new `small-world-scenes.ts`: every sprite key exists in `keys.json` or the manifest, all fixtures are in bounds, and `buildDrawList` returns bounds divisible by 32.
   - A painting test in the style of `SignInScene.test.ts` using the Proxy canvas, asserting integer `scale(z,z)` for each room.
   - Other `AuthLayout` users (`account-views.test.tsx`, `accept-views.test.tsx`, `DevGate.test.tsx`) must still pass; run them.
10. **Shared-file hygiene:** SIM-066/067/069 are redesigning My Portal. Touch only `AuthLayout.tsx`, the new `SmallWorld*.tsx`, `copy/auth.ts`, `views.tsx` (wrapper only), `layout.tsx` (one font import) and an appended `px-*`/`landing` block in `globals.css`. Do not edit existing tokens or rules in `globals.css`; add new class names (for example `.sw-*`) at the end of the file so rebases stay trivial. Do not touch `src/ui/roomlayout/*`. Check `git diff main` for `globals.css`, `layout.tsx` and `copy/auth.ts` before opening the PR.

## Risks

- `globals.css` and `layout.tsx` are shared with the other session, so a merge conflict is likely. Append-only edits and small hunks keep it cheap.
- `AuthLayout` changes affect about 20 call sites. A wrong prop default would change screens that are not in the mockup. Keep the `title` API and run all auth tests.
- Four canvases plus atlas load on the sign-in page could hurt LCP. The painting is deferred after mount, the LCP element should be the headline text, and the placeholders reserve size.
- A canvas that overlaps the card at widths between 768 and about 1200 px. Needs an explicit breakpoint decision, and a manual check at 1024 px as well as the planned 1440, 1280 and 390.
- The headline font could fail to load or fall back, shifting the layout. `display: swap` with a metric-similar fallback keeps the shift small.
- The mockup's café (counter, coffee machine) cannot be reproduced from the atlas. The result will differ from the mockup unless Ming accepts that or new art is approved later.
- Existing `SignInScene.test.ts` pins 384x224 at 1x. Keeping that module untouched avoids breaking it; if it is removed, remove its test with it.

## Open questions

1. Is the headline font choice (a Google italic serif via `next/font`, build-time self-hosted) acceptable, or should it fall back to oblique Manrope? Which family does Ming prefer?
2. Should the other `AuthLayout` screens keep the single old `SignInScene` or switch to the small-world layer? The ticket says "at least header, background and card frame". Recommendation: header, footer, background and card only; no rooms on non-sign-in screens.
3. Is it acceptable that the café is approximated without a counter or coffee machine sprite?
4. Is 1x tile scale (about 384 px wide rooms) acceptable at 1440, or should 2x be used on very wide screens? 2x would give 768 px rooms, which does not fit the mockup layout.
5. The mockup's "[ 01 ]" label in the card strip and the "Show" toggle: ship "[ 01 ]" as decoration, or drop it? The existing show-password toggle stays as it is today.

Key files: `src/ui/auth/AuthLayout.tsx`, `src/ui/auth/SignInScene.tsx`, `src/ui/auth/views.tsx`, `src/lib/sprites/signin-scene.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/security/headers.ts`.
