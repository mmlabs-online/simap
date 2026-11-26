Status: READY

# Plan — SIM-068: Redesign the sign-in page as a "small world" landing (Ming's mockup)

> Ming accepted every default of the 9 product questions on 2026-11-26 ("theo mặc định", see ticket Notes). The
> palette and font decision is D85 in `work/decisions.md`. The ticket is too big for one implement/review cycle, so
> this plan covers **slice 1** (the frame and the landing without the four rooms). Slice 2 (the four-room world) is
> ticket `work/tickets/SIM-068.1/ticket.md`, see `## Split proposal`.

## Scope summary
Ticket (`work/tickets/SIM-068/ticket.md`):
- Goal: "The signed-out sign-in page follows Ming's mockup (`mockup-sign-in.webp` in this folder): a calm 'small world'
  landing with four pixel rooms joined by paths around a central sign-in card".
- Scope: "**Header:** simap logo and wordmark and the tagline 'A little world of better work' (no new header
  controls)." / "**Hero:** eyebrow 'Not just a workplace. Your place.', headline 'A small world. *A better workday.*',
  subline 'Find your people. Pick your spot. Feel at home.'" / "**Central card** ('Your workspace portal' title bar):
  small avatar with 'Player, ready?' and 'Come on in.', then **today's sign-in form with exactly today's fields, links
  and buttons**, only restyled" / "**Footer:** '© 2026 simap. Make room for you.', 'Small pixels. Real connections.',
  'Made for a better workday.'" / "Same look carried to the other `AuthLayout` screens … at least for header,
  background and card frame." / "`prefers-reduced-motion` respected; works at 390 px (rooms collapse, card first)."
- Out of scope: "Any change to authentication" / "**No new buttons or features**" / demo-only texts not shipped /
  "New third-party art or fonts that are not licence-checked (D45); new libraries."
- Ming 2026-11-26: "chỉ lấy idea như hình, còn các button tính năng giữ như hiện tại".

Scope sources:
- `docs/spec-v1.md` AUT-01: "The sign-in page signs in against Identity (email + password at Identity). simap never
  sees or stores a password."
- D52: "The pixel/game style is used only on end-user surfaces: sign-in and org picker, … Body text, tables and forms
  never use a pixel font."
- `docs/art/style-guide.md` §1: "Body text, numbers, tables and forms are never in a pixel font, on any screen. Pixel
  styling goes into art, frames, headings and decoration only".
- D46: "Art style: Style 2 'modern office' (light, cool greys, teal/blue accents, dark slate outline). UI shell: A
  (clean UI; pixel art only inside the map)." (the mockup's cream/green amends this for AuthLayout screens only, per D85)
- D85: AuthLayout screens use the warm cream/green `--aw-*` palette and the Fraunces italic headline font (Ming
  accepted Q1 and Q2 defaults).
- D45: only licence-checked assets ("only CC0, CC-BY, or free packs whose page explicitly allows commercial use and
  modification"); it covers pixel-art packs, not fonts; the font choice (OFL Fraunces) is covered by D85.
- D36 / CLAUDE.md: "UI copy: English, in `src/ui/copy/<feature>.ts`".

## Acceptance criteria → verification
Slice 1 covers the ticket criteria below except the four rooms, paths, idle avatars, note cards and the card avatar
(slice 2). Criteria 1 and 4 of the ticket are therefore only partly met by this slice, as stated.

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The signed-out page shows the header (logo tile, wordmark, tagline), hero (eyebrow, headline with italic serif second sentence, subline), the card with the "Your workspace portal" title bar and the "Player, ready?" / "Come on in." intro, and the footer (three texts). Rooms are slice 2. | `views.test.tsx` › "landing › renders header, hero, card intro and footer"; local `pnpm build && pnpm start` and open `/` signed out (best effort, see Ming verification) |
| 2 | At 390 px: one column, order header → hero → card → footer, no horizontal scroll; the existing vignette stays hidden below `md`. | `views.test.tsx` › "landing › DOM order is header, hero, card, footer"; CSS review of the `aw-*` block (no fixed widths over 390 px, `overflow-x-clip` kept); DevTools 390 px in the local run |
| 3 | Sign-in still works exactly as before: same `onSignIn` values, validation, Turnstile slot, error notices, links. | All existing `SignInView` tests in `views.test.tsx` pass unchanged (only the "pixel surface" block changes, markup only); `git diff` shows no change in `views.tsx` lines 61-150 except the `AuthLayout` opening tag, and no change in `identityClient*`, `fields.tsx`, `TurnstileWidget.tsx`, `src/lib/**` |
| 4 | No demo wording: the password field label is "Password"; no "Explore the demo", "Demo password", "no real authentication", "Need a hand", "Remember my email", "Find your vibe", "[ 01 ]". | `views.test.tsx` › "landing › ships no demo or out-of-scope strings" |
| 5 | Same fields, links and buttons as before; no new interactive control anywhere on the page. | `views.test.tsx` › "landing › has exactly the controls of the plain sign-in view" (counts of `<button`, `<a `, `<input`, `<select`, `<textarea`, `tabindex=` equal between `landing` and plain render, with and without accounts) |
| 6 | Exactly one `h1` on every AuthLayout screen: the hero headline on the landing, the card title elsewhere. | `views.test.tsx` › "landing › exactly one h1, the headline" and "frame › plain screens keep the card title as the only h1" |
| 7 | Other AuthLayout screens get the new header, background, card frame and footer, but no hero. | `views.test.tsx` › "frame › AuthLayout has header, stage, frame, strip, card and footer" + `org-views.test.tsx` updated class assertion; `account-views.test.tsx`, `accept-views.test.tsx`, `DevGate.test.tsx`, `profile-views.test.tsx` pass unchanged |
| 8 | Form text never uses a pixel font; hero and labels use the normal faces (style guide §1). | Existing test "pixel classes stay off form text" (class names updated) + new assertion that no element carries `font-pixel` |
| 9 | Light and dark text on the new background meet WCAG AA (4.5:1 text, 3:1 button on page). | `world-palette.test.ts` › "light and dark aw tokens meet AA" (parses the appended block of `globals.css`) |
| 10 | Headline font is bundled at build (no runtime font host) and CSP/headers are unchanged. | `git diff` shows no change in `src/lib/security/headers.ts` / `src/proxy.ts`; after `pnpm build`, `.next/static/css/*.css` contains an `@font-face` for the serif with `src:url(/_next/static/media/…)` and no new `https://` host; `layout.tsx` preconnect lines unchanged |
| 11 | Copy lives in `src/ui/copy/auth.ts`. | Review: no new string literals in `AuthLayout.tsx`/`views.tsx` other than class names; tests read strings from `authCopy.world` |
| 12 | Reduced motion respected: no new animation or transition. | Review of the appended CSS block: no `animation`, `transition` or `@keyframes` |
| 13 | Checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` |

## Ming verification after merge
- Signed-out page on the deployed site at 1440, 1280, 1024 and 390 px, light and dark: matches the mockup's header,
  hero, card and footer (rooms come in slice 2); no overlap or horizontal scroll.
- Sign in with a real Identity account (including a Turnstile challenge if one appears), sign out, sign in again; the
  forgot-password and create-account links open their pages, which show the new frame without the hero.
- The italic serif renders (not a fallback) and the browser console shows no CSP violation.
(Under `pnpm dev` the DevGate replaces the signed-out page, D56, so the real signed-out flow is only fully checkable
on a deployed build.)

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/auth/AuthLayout.tsx` | Rewrite the frame (all 35 lines): outer `div.aw-stage` with `<header>` (logo tile + wordmark + tagline), `<main>`, `<footer>`; new optional prop `landing?: boolean` renders the hero (`h1`) above the card and the card intro (`h2`) instead of the title `h1`; card frame classes `aw-frame`/`aw-strip`/`aw-card`/`aw-heading` replace the `px-*` ones; `title` and `scene` props keep their meaning | Header, hero, card, footer and the shared frame (ticket Scope) | No |
| `src/ui/auth/views.tsx` | `SignInView` gets `landing?: boolean` (default `false`) and passes it to `AuthLayout` (lines 26-80 only: props type + the `<AuthLayout>` tag). Form, fields, links, buttons, Turnstile and notices untouched | Landing only on the gate's sign-in, not on accept-invitation's sign-in | No |
| `src/ui/auth/AuthGate.tsx` | Add `landing` to the `<SignInView>` at line 692 (one line) | The gate's signed-out view is "the sign-in page" | No |
| `src/ui/copy/auth.ts` | Add `authCopy.world` (tagline, eyebrow, headlineLead, headlineEm, subline, portalTitle, introEyebrow, introHeading, footer[3]) after line 38 | D36 | No |
| `src/app/layout.tsx` | One `next/font/google` import of the serif (Fraunces per D85, italic, `latin`, `display: "swap"`, `preload: false`, `variable: "--font-serif"`) and add its `.variable` to the `<html>` className (lines 3, 9-13, 21) | Headline font, bundled at build | No (shared hotspot) |
| `src/app/globals.css` | **Append only** after line 465: one block starting with the marker comment `/* SIM-068 auth world (aw-*) */` holding `:root { --aw-* }`, `[data-theme="dark"] { --aw-* }` and the `.aw-*` classes. No edit to existing lines | Palette, frame, hero, header/footer, button colour | No (shared hotspot) |
| `src/ui/auth/views.test.tsx` | Update the "pixel surface (D52)" block (lines 163-204) to the `aw-*` class names and the new strip text; add the "landing" and "frame" tests below | R5; markup-only changes to existing tests | No |
| `src/ui/org/org-views.test.tsx` | Line 26: assert `aw-stage`, `aw-frame`, `aw-strip` instead of `px-stage`, `px-frame`, `px-title`; line 27 unchanged | Org picker uses `AuthLayout` (markup-only update) | No |
| `src/ui/auth/world-palette.test.ts` (new) | Node test: reads `src/app/globals.css`, extracts the `--aw-*` values from the marked block for light and dark, checks WCAG contrast pairs | Contrast (criterion 9) | No |

Not touched: `src/ui/auth/SignInScene.tsx`, `SignInScene.test.ts`, `src/lib/sprites/signin-scene.ts` (+ test),
`fields.tsx`, `TurnstileWidget.tsx`, `identityClient*`, `src/lib/security/headers.ts`, `src/proxy.ts`, every
`src/ui/roomlayout/*`, every `--px-*` token and `.px-*` rule (still used by `src/ui/checkin/*`).

## Data model / migration
None.

## API contract
None.

## Tests to write
All node-only (`renderToStaticMarkup`, no jsdom), in the style of the existing `views.test.tsx`.

| Test (file › name) | Covers |
|---|---|
| `views.test.tsx` › frame › "AuthLayout has header, stage, frame, strip, card and footer" | `<header`, `<main`, `<footer` present; classes `aw-stage`, `aw-frame`, `aw-strip`, `aw-card`; strip contains `authCopy.world.portalTitle`; header contains `authCopy.brand` and `world.tagline`; footer contains all three `world.footer` strings; `px-scene` present with default `scene`, absent with `scene={false}` (replaces lines 164-178) |
| `views.test.tsx` › frame › "plain screens keep the card title as the only h1" | `AuthLayout title="T"` → exactly one `<h1`, containing "T"; no `world.eyebrow`/`headlineLead`; same for `<SignInView {...base} />` (no `landing`) and `CheckingView` |
| `views.test.tsx` › frame › "header logo is decorative and the header has no control" | the logo tile is `aria-hidden="true"`; the `<header>…</header>` slice has no `<a`, `<button`, `<input`, `tabindex` |
| `views.test.tsx` › landing › "renders header, hero, card intro and footer" | `<SignInView {...base} landing />`: eyebrow, `<h1` containing `headlineLead` and `<em class="…aw-serif…">headlineEm</em>`, subline, portalTitle, `introEyebrow`, `<h2` with `introHeading`, footer strings |
| `views.test.tsx` › landing › "exactly one h1, the headline" | one `<h1` in the landing markup and it holds `headlineLead`; `authCopy.signIn.title` is not inside any `<h1` |
| `views.test.tsx` › landing › "DOM order is header, hero, card, footer" | `indexOf("<header") < indexOf(eyebrow) < indexOf('id="signin-email"') < indexOf("<footer")` |
| `views.test.tsx` › landing › "has exactly the controls of the plain sign-in view" | counts of `<button`, `<a `, `<input`, `<select`, `<textarea`, `tabindex=` equal for `landing` vs plain, for (a) `forgotHref`+`signUpHref`, (b) plus `accounts`+`onContinueAs`, (c) with `turnstileRequired` and a slot |
| `views.test.tsx` › landing › "ships no demo or out-of-scope strings" | text content (tags stripped) of the landing render has no `/demo/i`, "Explore", "no real authentication", "Need a hand", "Remember my email", "Find your vibe", "[ 01 ]", "Work email"; the password label equals `authCopy.fields.password` ("Password") |
| `views.test.tsx` › landing › "the accept-invitation style sign-in stays plain" | `<SignInView {...base} intro={…} footer={…} />` (no `landing`) has no `world.eyebrow` and keeps `intro`/`footer` (guards `AcceptInvitationPage`) |
| `views.test.tsx` › pixel surface › "pixel classes stay off form text" (updated) | lines 188-198 with `px-title`/`px-heading` → `aw-strip-title`/`aw-heading`; plus no element in the page has `font-pixel` |
| `views.test.tsx` › pixel surface › "the submit button carries data-variant=filled inside the aw-card" (updated) | lines 200-204 with `px-card` → `aw-card` |
| `views.test.tsx` › "SignInScene is aria-hidden with no text and no img" | unchanged |
| `world-palette.test.ts` › "light and dark aw tokens meet AA" | for both blocks: `--aw-ink`/`--aw-bg` ≥ 4.5, `--aw-muted`/`--aw-bg` ≥ 4.5, `--aw-serif-ink`/`--aw-bg` ≥ 4.5, `--aw-ink`/`--aw-strip` ≥ 4.5, `--aw-on-accent`/`--aw-accent` ≥ 4.5, `--aw-accent`/`--aw-bg` ≥ 3 |
| `world-palette.test.ts` › "the aw block defines every token in both themes and only appends" | the marker comment exists once and is after the last `.px-scene-canvas` rule; light and dark define the same `--aw-*` names, all `#rrggbb` |
| `org-views.test.tsx` › "has the pixel frame, floor and title but no scene" (updated) | class names only |

## Approach
1. **Copy** (`src/ui/copy/auth.ts`): add `world: { tagline: "A little world of better work", eyebrow: "Not just a
   workplace. Your place.", headlineLead: "A small world.", headlineEm: "A better workday.", subline: "Find your
   people. Pick your spot. Feel at home.", portalTitle: "Your workspace portal", introEyebrow: "Player, ready?",
   introHeading: "Come on in.", footer: ["© 2026 simap. Make room for you.", "Small pixels. Real connections.",
   "Made for a better workday."] }`. The year is a literal (ticket text), so no `Date` call and no hydration risk.
   No change to `fields.password` ("Password") or `signIn.submit` ("Sign in", Q8).
2. **Font** (`src/app/layout.tsx`): `const serif = Fraunces({ subsets: ["latin"], style: ["italic"], display: "swap",
   preload: false, variable: "--font-serif" });` and `className={`${manrope.variable} ${serif.variable}`}`.
   `preload: false` keeps the file off every app route; it downloads only where `.aw-serif` is used. Do not touch
   `@theme`, `--font-heading` or the preconnect/icon lines. Fraunces is decided (D85); no fallback to a synthesised oblique.
3. **CSS** (`src/app/globals.css`, appended after line 465 under the marker comment):
   - Tokens, light `:root` / dark `[data-theme="dark"]` (proposed values; the contrast test is the gate, adjust if it
     fails): `--aw-bg #f3efe4 / #15170f`, `--aw-ink #26291f / #ecebe2`, `--aw-muted #585c4e / #b9bcac`,
     `--aw-line #d9d3c3 / #3a3d33`, `--aw-strip #e6ecdd / #263022`, `--aw-accent #3d5a35 / #a7c99b`,
     `--aw-on-accent #ffffff / #14200f`, `--aw-serif-ink #4f6b45 / #b7d3aa`.
   - `.aw-stage` (flat `--aw-bg`, ink colour, no checker), `.aw-header` / `.aw-footer` (hairline `--aw-line`, muted
     text, footer stacks under `sm`), `.aw-logo` (40 px tile, `--accent-orange` bg, like `AppShellView.tsx:68-73`),
     `.aw-eyebrow` and `.aw-strip-title` (Manrope, 12 px, uppercase, letter-spacing; not a pixel font; `overflow-wrap:
     anywhere`), `.aw-headline` (clamp size, `text-wrap: balance`), `.aw-serif` (`font-family: var(--font-serif),
     Georgia, serif; font-style: italic; font-weight: 400; color: var(--aw-serif-ink)`), `.aw-frame` (1px
     `--aw-line` border, radius 10px, overflow hidden, soft 0 8px 0 offset shadow ≤ 12 px out so 390 px padding
     holds), `.aw-strip` (`--aw-strip` bar, small square marker), `.aw-card` / `.aw-heading`,
     `.aw-card [data-variant="filled"]` (`--aw-accent` bg, `--aw-on-accent` text, radius 6px; keep the global
     focus-visible outline). No `animation`, `transition` or `@keyframes` (reduced motion trivially met).
4. **AuthLayout** (`src/ui/auth/AuthLayout.tsx`), signature `({ title, children, scene = true, landing = false })`:
   ```
   div.aw-stage.min-h-dvh.flex.flex-col.overflow-x-clip
     header.aw-header   → div.aw-logo[aria-hidden] (<Icon name="grid_view" filled />), span wordmark (authCopy.brand),
                          span divider[aria-hidden], p tagline. No link, no button.
     main.flex-1 …px-5 py-8
       {landing && <div hero>: p.aw-eyebrow, h1.aw-headline (headlineLead + " " + em.aw-serif headlineEm), p subline}
       div row (today's max-w-[816px] md:flex-row): {scene && <SignInScene />}, div.aw-frame max-w-[400px]
         div.aw-strip → span[aria-hidden] marker, p.aw-strip-title portalTitle   (no "[01]", Q7)
         Card.aw-card → landing ? div intro (p introEyebrow, h2.aw-heading introHeading) : h1.aw-heading title
                        {children}
     footer.aw-footer → three p
   ```
   Import `Icon` from `../Icon` (ui → ui, R1 fine). The card avatar slot is slice 2. Keep `SignInScene` usage as
   today, so every screen keeps its vignette until slice 2 replaces it on the landing.
5. **SignInView / AuthGate**: add the `landing` prop and pass it; `AuthGate.tsx:692` gets `landing`.
   `AcceptInvitationPage` and `CheckingView` stay plain (Assumption A3).
6. **Tests**: update and add as listed; run the whole suite (`account-views`, `accept-views`, `DevGate`,
   `profile-views`, `org-views` all render `AuthLayout`).
7. **Checks**: `pnpm format`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; then inspect
   `.next/static/css` for the serif `@font-face` with a `/_next/static/media/` source (criterion 10).
8. Before the PR: `git diff origin/main -- src/app/globals.css src/app/layout.tsx src/ui/copy/auth.ts` must show only
   the appended block, the font lines and the `world` block.

Rules: R1 (only `ui` → `ui`/`lib` imports, no server import; `pnpm check:layers`), R3 (no env/secrets; no client
config change), R4 (file list above; anything else to follow-ups), R5 (tests above, all checks green). R2/R6/R7 not
touched (no schema, no API). **Security:** no new script, no inline `<style>`/`style` needing a nonce beyond React
style props already used, no new image/font/connect host, no change to `headers.ts`, CSP or the preconnects;
`next/font/google` downloads at build time and serves from `'self'` (`font-src 'self' …` already allows it). The
password stays in `SignInView` state and goes only to `onSignIn` as today; the decorative markup holds no form data.

## Specialist input used
- frontend-developer 1 (keep `AuthLayout` API, optional variant prop, one `h1`): adopted as `landing?: boolean`.
- frontend-developer 1 (`SmallWorld.tsx`, `RoomVignette`, `useWide`), 2 (atlas keys, 1x zoom), 3 (CSS paths): moved
  to slice 2.
- frontend-developer 4 / ux-architect 5 (OFL serif via `next/font/google`, no CSP change, `--font-serif` only on the
  `<em>`): adopted as decided in D85; `preload: false` added so other routes do not fetch it; not exposed in `@theme` (keeps
  the shared `@theme` block untouched).
- frontend-developer 5 (form byte-for-byte, forbidden-string scan, control count): adopted; count compares landing vs
  plain render instead of a stored fixture (no fixture to rot).
- frontend-developer 7 / ux-architect 2 (390 px order, `overflow-x-clip`, wrap long mono strings): adopted.
- frontend-developer 10 (append-only `globals.css`, new class prefix): adopted with prefix `aw-` and a marker comment
  that a test checks.
- ux-architect 1 (shared frame for all screens, world only on sign-in): adopted (Q4 answered).
- ux-architect 3 (hero `h1`, card title `h2` on landing): adopted (Q3 answered).
- ux-architect 6 (separate `--aw-*` tokens with dark variants, AA contrast): adopted, plus an automated contrast test.
- ux-architect 7 ("[01]" decorative, eyebrow legible face ≥ 12 px): "[01]" dropped (Q7 answered); eyebrow in
  Manrope.
- ux-architect 9 (header/main/footer landmarks, logo not a link): adopted.
- ux-architect 10 (year literal to avoid hydration mismatch): adopted (literal from the ticket).
- ux-architect 4 (new `scene.signin.*` compositions in `signin-scene.ts`): rejected for slice 2 in favour of a new
  `small-world-scenes.ts` so the existing scene and its tests stay untouched.

## Assumptions
- A1 Hotspots: SIM-066, SIM-067 and SIM-069 (PLANNING, other session, My Portal) may also touch `src/app/globals.css`
  and `src/app/layout.tsx`. This plan only appends to `globals.css` and adds font lines to `layout.tsx`; expect a
  trivial rebase. `src/ui/org/ProfileView.tsx` (old profile, uses `AuthLayout`) is not edited; SIM-066 works in
  `src/ui/portal/*`.
- A2 `AuthLayout` users that inherit the new frame (header, background, card, footer, green button): forgot/reset,
  sign-up, verify, accept-invitation, unverified/join/no-org/no-access/retry, checking, DevGate token view, org picker,
  old profile view. None gets the hero.
- A3 `CheckingView` stays plain (no hero), so a signed-in user never flashes the marketing hero while the session is
  checked; going from checking to the landing adds the hero above the card (accepted jump).
- A4 The mockup's card subline "Your own little corner of the workday awaits.", "Work email" label, the field icons'
  placeholder text and "Enter your workspace →" are not in the ticket scope and are not shipped; labels stay
  "Email" / "Password", button "Sign in".
- A5 The logo is the app's existing mark (orange tile with the `grid_view` icon from `AppShellView.tsx:67-73`); no new
  image asset. The icon font is already loaded globally from Google (unchanged).
- A6 The OFL licence of the serif needs no in-app credit (OFL does not require one); it is recorded in D85, not in
  `assets/art/CREDITS.md` (that file is for art, D45).
- A7 The dark theme follows `data-theme` like the rest of the app; signed-out users get the system setting.

### Decisions answered by Ming (2026-11-26, all defaults accepted; formerly "Blocking questions")
1. **Palette:** cream/green `--aw-*` tokens (light and dark), scoped to the AuthLayout screens only; map art,
   `--px-*` tokens and the app shell stay D46. Recorded as D85.
2. **Headline font:** Fraunces italic (OFL 1.1) via `next/font/google`, `latin` subset, `preload: false`, fallback
   Georgia. Recorded in D85.
3. **Page `h1`:** on the landing the hero headline is the only `h1`; the card shows "Player, ready?" and "Come on
   in." (`h2`) instead of the "Sign in" heading; "Sign in" stays as the button label and tab title. Other screens
   keep their card title as `h1`.
4. **Other AuthLayout screens:** new header, background, card frame, footer and green primary button on all of them
   (including org picker, DevGate and the old profile view); no hero; they keep today's single office vignette beside
   the card from `md` up; the four-room world is sign-in only.
5. **Breakpoints:** 390 px order header, hero, card, footer. Slice 2's world shows from 1280 px (`xl`) up; between
   768 and 1279 px the landing shows hero and card only.
6. **Café art (slice 2):** approximate "Coffee & connection" from existing sprites; no new art (D45/D64).
7. **"[ 01 ]" in the card title bar:** dropped.
8. **Primary button label:** keep "Sign in".
9. **Split:** accepted; this PR = slice 1, slice 2 = SIM-068.1.

## Blocking questions
None. All 9 were answered by Ming on 2026-11-26 (defaults accepted); see "Decisions answered by Ming" under
`## Assumptions`.

## Split proposal
The full ticket is about 900 changed lines (frame and landing ~350 incl. tests; the canvas world ~550 incl. tests),
over one implement/review cycle.

- **Slice 1 — SIM-068 (this plan):** palette, font, header, hero, restyled card, footer, frame on every AuthLayout
  screen, 390 px, no-demo and no-new-control tests. The landing keeps today's single vignette beside the card until
  slice 2.
- **Slice 2 — SIM-068.1 (ticket `work/tickets/SIM-068.1/ticket.md`, depends on SIM-068):** the four-room world on
  the landing only. Outline kept here for reference; the ticket is the scope source for that slice.
  - Files: new `src/lib/sprites/small-world-scenes.ts` (+ `.test.ts`): `FOCUS` (desks, two seated avatars; reuse
    `SIGNIN_SCENE` or a top-down 12×7), `MEETING` (`table.meeting.*`, `chair.office`, `whiteboard`, `floor.lavender`),
    `LOUNGE` (`sofa`, `table.coffee`, `shelf.books`, `lamp.floor`, plants), `CAFE` (Q6: existing sprites only) as 12×7 `RoomLayout`s, plus
    `avatarDrawList(look, manifest)` for 3-4 path avatars and the card avatar. New `src/ui/auth/SmallWorld.tsx`
    (+ `.test.ts`): `aria-hidden`, `pointer-events-none`, `paintVignette(canvas, atlas, list)` via `paintRoom(…, 1)`,
    canvases mounted only when `(min-width: 1280px)` matches (atlas never fetched on phones), CSS placeholder per
    room, CSS dashed paths, two note-card `div`s (no tabindex), room labels as decorative text. `AuthLayout.tsx`:
    `landing` renders `SmallWorld` in a grid around the centre column instead of `SignInScene`. `globals.css`:
    append `.aw-world*` grid/path/note rules. `copy/auth.ts`: `world.rooms[4]`, `world.notes[2]`.
  - Tests: every sprite key resolves in the registry, no `unknown`, integer ops, bounds exactly 384×224, no blocking
    overlap (as `signin-scene.test.ts`); fake-canvas paint at `scale(1,1)` and `false` without context (as
    `SignInScene.test.ts`); render: four room labels and two notes inside an `aria-hidden="true"` wrapper, no
    `<canvas` in server markup, control count unchanged, still one `h1`.
  - Decides whether `SignInScene.tsx` (+ test) is deleted or kept for the other screens (follows Q4).
