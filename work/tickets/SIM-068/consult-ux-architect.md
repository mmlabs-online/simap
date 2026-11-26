# Consult — ux-architect — SIM-068

## Findings

**Mockup (read)**: warm cream page, no checker floor. A 3-column composition. Top band holds logo + tagline (left) and "Need a hand?" (right, out of scope). A centred hero (mono eyebrow, sans + italic serif headline, subline) sits over a ~400 px card in the middle column. Four rooms (~400x280 px at 2000 px art width) flank the card: focus studio top-left, good-ideas top-right, slow corner bottom-left, coffee bottom-right. Tan dotted paths run from the rooms down and in to the card's sides, with 4 idle avatars on the paths and 2 tilted note cards overlapping the lower edges of the top rooms. The card has a title bar ("Your workspace portal [01]"), an avatar plus "Player, ready?" / "Come on in.", then the form and a green button. Below it is the vibe switcher (out of scope). The footer is a hairline row with 3 texts. Only mono (pixel-ish) text is used for labels and room names, not for form text.

**Current code**:
- `AuthLayout` is a single flex row, max 816 px: the 384 px `SignInScene` (canvas at 1x, `hidden md:block`) beside a 400 px `px-frame` card.
- The checker `px-stage` background and teal strip/shadow styling come from `globals.css` (L373-465). Heading is Manrope uppercase with text-shadow.
- `AuthLayout` is used by about 30 screens: sign-in, forgot/reset, sign-up, verify, accept-invitation, DevGate, org picker (`scene={false}`), profile and noAccess/retry. So the shared frame change has a large blast radius.
- `views.test.tsx:164-175` asserts pixel classes and the scene slot. This will need a markup update.
- Fonts: Manrope via `next/font/google`. That is self-hosted at build, so there is no runtime Google host, but `layout.tsx` L29-30 still preconnects to fonts.googleapis.com / gstatic (for the icon font). Dark tokens exist for `--px-*` only, no cream palette.

## Recommendations

**1. Structure.** Split into two layers.
- (a) `AuthLayout` keeps the shared chrome: header (logo + tagline), `<main>`, footer, new background and card frame. All screens inherit it. The `scene` prop becomes `world` and is true only for sign-in; the other screens get the world-less variant, i.e. header, background, card and footer.
- (b) New `SmallWorld.tsx`, one `aria-hidden` wrapper holding the rooms, paths, avatars and notes.
- Sign-in is the only screen with the world. Forgot/reset, sign-up, verify and accept use the same header, background, framed card and footer with a single small decorative element (e.g. one room or plant strip, or nothing) so they stay quick and don't repeat the full scene. This also fits `scene={false}` for the org picker.
- Remove the Manrope uppercase `px-heading`/strip look from non-sign-in cards only if Ming wants consistency. Otherwise keep the pixel frame (D52) and just recolour tokens.

**2. Layout (use CSS grid, not absolute pixels).**
- **At 1440 px**: container ~1200 px max. Grid `[room | centre 400-420 | room]`, with the two top rooms at row 1 and the two bottom rooms at row 2. The hero and card span the centre column over both rows. At 1440 px rooms are ~380 px wide, so everything fits without scale tricks.
- **At 1280 px**: same grid; rooms shrink to ~330 px, which breaks a whole-number scale. Pick the paint scale by breakpoint (1x below `xl`, 1x or 2x above, depending on the room's tile size) and size the room box in whole multiples of 32 px. Do not CSS-scale the canvas (D46/D48, whole-number only).
- **At 390 px**: single column, order header, hero (eyebrow shortened or kept, headline 32-36 px), card, footer. Rooms and paths are `hidden`. Optional: one small decorative strip under the card. Keep the `md` (768 px) cut that exists today; between 768 and 1024 px show only the two top rooms or none, because three columns do not fit before about 1100 px. Suggest world visible from `lg` (1024), and 2-room simplified at `md`, or hide below `lg`.
- **DOM/focus order**: write the card before the rooms in the DOM and place the rooms with grid areas, so tab order is card-first. Rooms are non-focusable anyway.

**3. Hierarchy.** The card is the primary element (solid surface, frame, shadow). The headline is secondary. Rooms are tertiary: slightly reduced contrast (they must not outshine the card), no animation. Hero text is above the card in the centre column, so the h1 question matters: today `AuthLayout` renders `h1` = card title. The mockup's headline is decorative-marketing. Keep exactly one `h1`: the card title ("Sign in"/"Come on in") or the hero headline. Recommend the hero headline as `h1` only on sign-in and the card title as `h2`, or keep the card title `h1` and make the headline a `p`. Pick one and test.

**4. Rooms and paths.**
- Draw each room from a `DrawList` through `paintRoom` at 1x/2x. This needs new `scene.signin.*` compositions per room in `src/lib/sprites/signin-scene.ts`, from existing atlas frames only (desk, table, sofa, counter). Check the atlas for sprites for lounge and café; placeholders are acceptable.
- Paths are CSS (`repeating-linear-gradient` or a dashed border on `::before` elements), not canvas, so they scale with the grid. Avatars on paths are canvas sprites or small CSS elements (aria-hidden).
- Room names ("The focus studio" etc.) are labels on the art; keep them as `aria-hidden` text in copy/auth.ts. Pixel/mono font is allowed there only because they are art labels (style guide §1), never on forms or body.
- Notes: two CSS cards (`rotate(-2deg)`, static; no transform animation).
- Paint on `useAtlas` as today; keep the CSS placeholder so the page never shows blank rooms. Paint lazily only when wide.

**5. Headline typeface (D45).** D45/D66 allow only licence-checked, locally bundled fonts, and the credits row in `assets/art/CREDITS.md`/in-app Credits applies to art. For fonts, use `next/font/google` (self-hosted at build, no runtime host; CSP unchanged) with an OFL serif that has italic, e.g. Fraunces or Newsreader (check which is closest to the mockup). Record the OFL licence in CREDITS or the font note. Load only the italic subset and the weights used (`display: "swap"`) to keep the bundle small, and only apply `font-heading-serif` to the headline's italic phrase. Fallback: if Ming doesn't approve a new font, use Manrope italic (not a true italic) or `font-style: italic` on Georgia fallback; note it. Do not change `--font-heading` globally.

**6. Palette, light/dark.** The mockup is a warm cream/green palette that does not exist in tokens. Add `--world-*` tokens (bg, room floor tones, path, card) in `:root` and `[data-theme="dark"]`; do not reuse `--px-*` floors for the page background. Contrast: light needs body/hero text on cream at 4.5:1 or better (subline and tagline in the mockup look about 4:1 grey; darken). Button green on white at 3:1 or better with white text 4.5:1. Dark: provide a dark world (dark rooms, muted paths), or render rooms with the existing `--px-*` dark tokens, and keep frame at 3:1 on dark as `--px-outline` does. Verify the room art and note cards in dark; note cards should be dark surfaces with 4.5:1 text.

**7. Mono text.** Eyebrow, "[01]" and footer mid text in a mono/pixel style are fine as decorative labels but the eyebrow and footer are real text read by screen readers; keep them in a legible face, uppercase with letter spacing, 12 px min, 4.5:1. The title bar text "Your workspace portal" should be a visible label for the card (can serve as `aria-label` for the card region); the "[01]" is decorative and `aria-hidden`. Drop "Player, ready?" if it reads as game gimmick; it is in scope, so keep it, as non-heading text. The small avatar next to it: use the atlas avatar, `aria-hidden`.

**8. Reduced motion.** There should be no motion in the first version, so reduced motion is satisfied by default; the existing global `prefers-reduced-motion` rule (globals.css ~L365) already zeroes durations. If idle avatar bob is added later, put it under `@media (prefers-reduced-motion: no-preference)`. Button press `translateY` is existing behaviour.

**9. Accessibility checklist.** Whole `SmallWorld` wrapper `aria-hidden="true"` and `pointer-events-none`; no focusable children; no text-only-in-art. Header logo: link to nothing (no new controls) or plain text; do not add links. Footer is plain text. Landmarks: `header`, `main`, `footer` (today only `main`). Keep visible focus outlines (existing 3 px). Card keeps field labels. Label "Password" not "Demo password".

**10. Copy.** All new strings in `src/ui/copy/auth.ts` (D36), including room names, notes, eyebrow, footer. Year "2026": compute from a constant or `new Date().getFullYear()` carefully (hydration mismatch risk in a client component; use server component or a constant).

**11. Tests.** Update `views.test.tsx` L164-175. Add render tests: header tagline, hero headline pieces, four room labels present and inside an `aria-hidden` wrapper, footer texts, no demo strings ("Demo", "Explore", "Remember", "Need a hand", "vibe"), a count of buttons/links equal to today's, `scene`-less screens still render header/footer.

## Risks
- Shared `AuthLayout` change touches ~30 screens, DevGate and org picker; regress their width (400 px card, long content) and `overflow-x-clip` at 390 px.
- Layout at 1280 px with whole-number scale (D46/D48): wrong scale gives blurry art; a bad breakpoint gives overlap between rooms and the card. Check at 1100-1280 px, not only the three target widths.
- Canvas cost: four paints plus the atlas load on a page that blocks sign-in; paint after atlas, never block the form; keep CSS placeholders to avoid layout shift (CLS).
- New font adds a request and bytes on the sign-in page; mitigate with a subset, one style.
- h1/heading structure change may break existing tests or a11y expectations.
- Mockup tokens (cream/green) differ from the established D46 style 2 palette (cool grey/teal); mixing both on sign-in and the other screens risks a clash. Needs Ming's choice.
- The orange "-ish" logo in the mockup vs. the actual app logo: use the real simap logo asset only.
- Year in footer causing hydration mismatch.
- Security: confirm no new image host or font host in the CSP; `next/font` is fine, no inline `<style>` additions that need nonces.

## Open questions
1. Palette: switch sign-in (and AuthLayout screens) to the mockup's cream/green, or keep D46 cool grey/teal and only borrow composition? This conflicts with D46 and D52 if cream; it needs a D-note if cream.
2. Font: OK to add an OFL serif italic (Fraunces/Newsreader) via `next/font/google`, with a licence row? Otherwise Manrope italic.
3. Which element is the page `h1`: the hero headline or the card title?
4. Other AuthLayout screens: header/background/footer only, or also a mini scene? Should the org picker (`scene={false}`) and Profile get the new frame?
5. Between 768 and 1024 px: hide the world entirely, or show two rooms?
6. Do atlas frames for a lounge sofa, café counter, meeting table and plants exist, or should placeholders be accepted until art arrives (D58/SIM-033)?
7. Does the logo come from an existing asset, and does the tagline/footer need a link-free logo only?

Files: `src/ui/auth/AuthLayout.tsx`, `src/ui/auth/SignInScene.tsx`, `src/ui/auth/views.test.tsx` (L164-175), `src/app/globals.css` (L76-96, L365-465), `src/lib/sprites/signin-scene.ts`, `src/app/layout.tsx` (fonts, preconnect L29-30).
