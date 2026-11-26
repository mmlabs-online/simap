# Consult — ux-architect — SIM-055

SIM-055 consult (frontend/UX architecture), read-only.

## Findings
- `AuthLayout` (src/ui/auth/AuthLayout.tsx) is a flat `bg-background` main. It holds a `max-w-[816px]` row with `SignInScene` (hidden below md) beside a 400px `px-frame` card. The card has a teal `px-strip` and the kit `Card` stripped of its border. Brand and `h1` use Manrope.
- globals.css already has `--px-outline`, `--px-accent`, `--px-floor` and `--px-wall` (dark mode overrides only `--px-outline`). It also has `.px-frame` (2px stepped-corner bands via box-shadow), `.px-strip`, and `.px-scene` (384px gradient placeholder, `image-rendering: pixelated`).
- The global `focus-visible` rule is `outline: 2px solid var(--primary)` plus a 3px orange ring at 22% alpha. Reduced motion is already handled globally by clamping animation and transition durations. That clamp does not stop a JS-driven canvas loop, so any idle effect must check `matchMedia` itself.
- The reusable art pieces already exist:
  - `useAtlas()` (ui/roomlayout) loads `/sprites/office.png|json` in an effect. That is already off the first paint, and `failed` is exposed.
  - `paintRoom(canvas, atlas, DrawList, zoom)` does integer zoom with smoothing off. `tintedFrame` handles tinting.
  - `avatarFrames(look, view)` in src/lib/sprites/avatar.ts builds avatar layers.
  - `DrawList` and `placement` live in lib/sprites.
- The atlas has these keys: `floor.carpet`, `floor.carpet.alt`, `floor.wood`, `floor.lavender`, `wall.face`, `wall.top`, `wall.base`, `window.double`, `window.single`, `desk.single.*`, `desk.pair.*`, `chair.office.*`, `monitor.*`, `laptop.*`, `keyboard`, `mug`, `plant.small`, `plant.large`, `lamp.*`, `cabinet.*`, `shelf`, `chart.flip.*`, `avatar.body/hair.N/shirt .front|.back`.
- No pixel font is in the repo (the grep hits are only the word "pixel" in comments).
- CSP is `img-src 'self' data: blob:` and `font-src 'self' https://fonts.gstatic.com`. A canvas drawn from the same-origin atlas needs no CSP change.

## Recommendations

**Layout (AC1, AC3)**
- Keep the `md:flex-row` composition, but make it a "title screen". The page gets a tiled floor background. In the centre there is a stage: the scene on the left and the card on the right, both with the same outer pixel shadow. Above both sits one title bar with the pixel-lettered brand.
- Below `md`, show the title bar and the card only, with the card at `w-full max-w-[400px]` and `px-4`. Drop `min-h-screen` centring in favour of `min-h-dvh`.
- Use `overflow-x-clip` on the main, and `min-w-0` on the card.
- Do not use fixed 816px widths. Make the card's frame shadow offsets fit inside the padding, so 320px never scrolls. A 2px frame and a 6px pixel drop shadow need at least 8px of side padding.

**Scene composition (AC1, AC5)**
- Put the scene data in `src/lib/sprites/signin-scene.ts` as pure data, with no JSX and no atlas. It would export `SIGNIN_SCENE = { cols: 12, rows: 7, floor, items[] }`, where each item is `{key, x, y, tint?}` in tile units.
- A small pure function converts it to a `DrawList` (reusing the existing placement and avatar helpers). `SignInScene` then calls `paintRoom` at zoom 1, 2 or 3 chosen by container width, never fractional. Use 2x as the default. 12 tiles x 32 x 2 = 768px, which is too wide beside a 400px card inside 816px. So either use 1x (384px) at md and 2x only from `xl` with a wider stage (about 1200px), or keep 1x and draw denser art. Recommend 1x at md–lg and 2x at xl and up.
- Content, top to bottom:
  - Row 0–1 is the back wall: `wall.top`, `wall.face`, `wall.base`, with a `window.double` at the centre and a `chart.flip` or `shelf` at the side.
  - Rows 2–6 are `floor.carpet`, with `floor.wood` at the lower left as an entrance strip.
  - Two desk clusters (`desk.pair`) with `monitor`, `keyboard` and `mug`, and `chair.office` seats.
  - Two avatars at the desks, composed with `avatarFrames` using fixed looks (not derived from any user), seen from the back. Use a different `avatar.hair` style and `shirt` tint on each.
  - A `plant.large` in the corner, a `plant.small` and a `lamp`, and a `cabinet` by the wall. Keep at least 4px of free desk surface (style guide §4).
- Render the card first. The scene shows a stable-size box (the existing `.px-scene` placeholder with the same dimensions) until the atlas is ready, then paints the canvas into it. This avoids layout shift. On `failed`, or if `paintRoom` returns false, leave the placeholder (AC5). The canvas is `aria-hidden`, and the wrapper has `hidden md:block`.
- Optional idle effect, only when `matchMedia("(prefers-reduced-motion: no-preference)")` matches: one small CSS keyframe step-animation on an overlay element (a screen "blink" or a blinking plant sway at about 1fps, using `steps()`). Skip it in v1 if it adds risk. The global reduced-motion rule already neutralises CSS animations, so use CSS, not a canvas loop.

**Card frame (AC2)**
- A `.px-frame-lg` class built on the existing `px-frame` idea, stepped corners from 4 stacked box-shadow bands, with a 4px darker outline and a 6px hard-offset pixel drop shadow (`6px 6px 0 var(--px-shadow)`, no blur).
- Keep the `px-strip` as a title bar of 12–16px, but put the pixel brand on it, so it reads as a window title bar. The strip may carry 3 small squares as decoration only, `aria-hidden`.
- The card surface stays `bg-surface` with the kit's text colours, so the form contrast is unchanged. Do not change `Card` itself. Keep passing the override classes as `AuthLayout` does today.

**Brand and heading (AC2)**
- Check licensing before adding any font. If a pixel font such as "Silkscreen" or "Press Start 2P" (OFL) is wanted, it must go through the D45 licence workflow and be loaded with `next/font` (self-hosted), and it must be applied only to the brand line and the screen `h1`. That counts as a font add, so flag it in the plan and ask Ming.
- The font-free default I recommend: pixel lettering by CSS only. Use the heavy Manrope weight, uppercase, letter-spacing about 0.08em, and a stepped `text-shadow: 2px 2px 0 var(--px-outline)` (and a 1px offset stack). That is enough to read as a game title, and it costs nothing in licences or bundle size. Keep `h1` as real text for headings, with a size no smaller than 20px.
- Mobile: the brand title must wrap. Use `text-balance` and `break-words`.

**Primary button (AC2)**
- Do not fork the kit `Button`. Add a variant or class `px-btn` that the auth screens opt into (a `className` on the submit button), and keep `Button`'s semantics, focus and disabled behaviour.
- The look is a chunky 3px outline in `--px-outline`, square corners (`rounded-none`), a stepped-corner shadow, and a fill using `--primary-container` (orange) with `--on-primary-container` text. A 4px bottom "ledge" via `box-shadow: 0 4px 0 var(--px-outline)`. On `:active`, translate 2px down and shrink the ledge to 2px. No transitions are needed. The disabled state drops the ledge and uses a muted fill.
- Contrast check: white on `#fb5729` is about 3.1:1, which is below AA for 16px normal text. Options: use bold 18px+ text (AA large needs 3:1), or darken the button fill with a new `--px-btn` token such as `#c2410c` (about 5.2:1 with white). I recommend the token, and keep the label at the kit size.

**Background (AC1)**
- Use a tiled floor pattern in CSS only, with no new image. Use `background-image` with two `conic-gradient` checks or `linear-gradient` grid lines at 32px (`--px-tile`), colours `--px-floor` and `--px-floor-alt`, plus `image-rendering: pixelated`. Keep the contrast low (a 3–6% difference) so nothing competes with the card. Put a soft vignette or a 4px stepped border at the screen edge, not an animation.
- Dark mode needs its own `--px-floor`, `--px-floor-alt`, `--px-wall` and `--px-shadow`. Today only `--px-outline` is overridden, and the light floor would glare on `#0f0f0f`. The scene art itself stays in the one fixed palette (that is D52 and the style guide).

**Org picker (AC3)**
- Wrap `OrgPickerView` in the same shell (extract a `PixelStage` or reuse `AuthLayout` with `scene={false}`), with each org option as a kit list item that has a `px-frame` border, a hover or focus step offset, and no scene. Keep the options as real buttons or links.

**Accessibility (AC2, AC4)**
- Keep the existing focus rule. Raise it on pixel surfaces: `outline: 3px solid` using a token that has 3:1 against both the card and the floor, with `outline-offset: 2px`. `--px-outline` `#2a3140` is fine on light. In dark mode `--px-outline` is `#8b95a7`, which also works on `#161616`. Do not draw the focus ring only as a box-shadow band, because the pixel shadows would hide it. Check that the 6px drop shadow and the button ledge do not cover a neighbouring field's focus ring (give the card enough gap).
- Do not use the pixel font or text-shadow stack on anything smaller than the heading. Text-shadow on the brand must not drop its contrast. Check the brand colour against the strip (white on `#14b8a6` is about 2.5:1, so use `--px-outline` text on teal, which is about 6:1).
- The scene is `aria-hidden` with no `alt` text. The tiled background is CSS only. Reduced motion: no new JS animations; any CSS `steps()` animation is covered by the global rule, and it must also be correct when the clamped animation ends in its resting state.

## Tokens to add (globals.css `:root`, dark overrides, and `@theme` where Tailwind needs them)
- `--px-floor-alt`, `--px-shadow` (the drop shadow colour), `--px-btn`, `--px-btn-ledge`, `--px-btn-text`, `--px-title` (the brand colour on the strip), `--px-tile: 32px`, `--px-step: 2px` (the stepped unit), `--px-border: 4px`.
- Dark values for `--px-floor`, `--px-floor-alt`, `--px-wall` and `--px-shadow`.
- Utilities: `.px-stage` (floor background), `.px-frame-lg`, `.px-title` (text-shadow lettering), `.px-btn`, `.px-scene-box`. All must be CSS-only with no font.

## Tests
- Scene data: every key exists in `public/sprites/office.json` (`keys.json` as the ticket says), every item fits inside 12x7, and no tile is overlapped by two furniture items. Unit tests for the data-to-DrawList function.
- Render tests: `AuthLayout` and `OrgPickerView` use the new frame classes, and `px-title` or `px-btn` never appear on `input`, `label`, notices or links (mirror the `AuditView` check). `no-photo-on-map.test.ts` must stay green. Copy comes from `authCopy`.
- Manual: 320px and 1280px, light and dark, atlas blocked, keyboard tab order, and contrast of the button and the brand title.

## Risks
- R1 layers: `src/ui/auth` importing from `src/ui/roomlayout` is ui to ui, which is allowed, but `roomlayout/index.ts` pulls in the editor. Import `useAtlas` and `paint` directly, not the barrel, so the sign-in bundle (first paint for everyone) does not include editor code. Consider a dynamic import of the scene component.
- Atlas fetch on every cold sign-in is about the size of `office.png` (check it; it is shared for the map, so the browser cache helps later). Load it after the card renders, and never block the form.
- A fixed 12x7 board at 1x is only 384px, so it can look small next to a 400px card. Test at xl with 2x.
- A pixel font would need a licence check (D45) and a flash-of-fallback risk on the brand; the CSS lettering option avoids both.
- Dark-mode floor and wall tokens: leaving them unset causes glare.
- Orange button contrast (3.1:1) fails AA for normal text unless the `--px-btn` token is used.

## Open questions for Ming
1. Is a real pixel font wanted for the brand and `h1` (needs a D45 licence check, for example Silkscreen under OFL), or is CSS pixel lettering with the kit font acceptable? I recommend the CSS option.
2. Is a small idle effect (a blinking monitor or swaying plant) wanted in this ticket, or out? I recommend out for v1.
3. Should the scene show only the fixed demo avatars, or should it pick up the signed-out visitor's last pixel look (not available when signed out, so I assume fixed)?
4. Should the org picker get the scene as well, or only the frame, floor and title? I recommend frame, floor and title only.
5. OK to add the dark-mode token overrides for the sign-in floor, as a small change beyond the ticket's literal list?

Files consulted: `work/tickets/SIM-055/ticket.md`, `src/ui/auth/AuthLayout.tsx`, `src/ui/auth/SignInScene.tsx`, `src/app/globals.css`, `docs/art/style-guide.md`, `src/ui/roomlayout/useAtlas.ts`, `src/ui/roomlayout/paint.ts`, `public/sprites/office.json`, `src/lib/security/headers.ts`.
