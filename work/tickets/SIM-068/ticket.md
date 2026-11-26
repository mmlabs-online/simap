# SIM-068: Redesign the sign-in page as a "small world" landing (Ming's mockup)

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P2 |
| Size | M |
| Areas | ui, ux, security |
| Gate | none |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T16:48Z |
| PR | — |

## Goal
The signed-out sign-in page follows Ming's mockup (`mockup-sign-in.webp` in this folder): a calm "small world"
landing with four pixel rooms joined by paths around a central sign-in card, so the first screen already feels like
simap's office world.

## Scope reference
`docs/spec-v1.md` AUT-01 (sign in with mmlabs Identity), D52 and `docs/art/style-guide.md` §1 (sign-in is a pixel/game
surface; forms and body text never use a pixel font), §4 (`scene.signin`); D41/D46/D48 (32 px tiles, whole-number
scale, no game engine), D45/D66 (only licence-checked bundled art and fonts), D36 (copy in `src/ui/copy/auth.ts`).
Builds on SIM-055 (game-style sign-in, merged). Request: Ming 2026-11-26 with the mockup image.

## Scope
- **Header:** simap logo and wordmark and the tagline "A little world of better work" (no new header controls).
- **Hero:** eyebrow "Not just a workplace. Your place.", headline "A small world. *A better workday.*", subline
  "Find your people. Pick your spot. Feel at home."
- **Central card** ("Your workspace portal" title bar): small avatar with "Player, ready?" and "Come on in.", then
  **today's sign-in form with exactly today's fields, links and buttons**, only restyled to the mockup's look
  (Identity flow, validation, Turnstile and error messages unchanged).
- **Four decorative pixel rooms** around the card, drawn from the bundled atlas with the existing map paint code at a
  whole-number scale: "The focus studio" (desks), "Good ideas live here" (meeting table), "The slow corner" (lounge),
  "Coffee & connection" (café); dotted paths join them to the card; a few idle avatars; two small note cards
  ("Your next great day starts with a little hello", "Big ideas. Small pixels."). All `aria-hidden`; hidden or
  simplified below `md`.
- **Footer:** "© 2026 simap. Make room for you.", "Small pixels. Real connections.", "Made for a better workday."
- Same look carried to the other `AuthLayout` screens (forgot/reset password, sign-up, verify email, accept
  invitation) at least for header, background and card frame.
- `prefers-reduced-motion` respected; works at 390 px (rooms collapse, card first).

## Out of scope
- Any change to authentication: Identity calls, token handling, Turnstile, password rules (AUT-01, D4).
- **No new buttons or features** (Ming 2026-11-26: take only the visual idea; keep the current buttons and
  features): no "Need a hand?", no "Remember my email", no "Explore the demo", no "Find your vibe" switcher.
- The mockup's **demo-only texts** are not shipped as written: "Demo password", "Any 6+ characters for
  this demo", "Demo only · No real authentication…" and "Explore the demo". simap signs in with real mmlabs Identity
  accounts, so the copy says "Password" and no demo mode is added (see open questions).
- New third-party art or fonts that are not licence-checked (D45); new libraries.

## Acceptance criteria
- [ ] The signed-out page shows the header, hero, central card, four pixel rooms with paths and the footer as in the
  mockup at desktop width; at 390 px the card comes first and the rooms are hidden or simplified.
- [ ] Sign-in still works exactly as before (same Identity requests, Turnstile, errors, redirect to `/`); existing
  sign-in tests pass unchanged or are updated only for markup.
- [ ] No demo wording ships: the password field is "Password", there is no "Explore the demo" control and no
  "no real authentication" note.
- [ ] Rooms and avatars come from the bundled atlas at a whole-number scale, are `aria-hidden`, and form text never
  uses a pixel font (style guide §1).
- [ ] The sign-in card has the same fields, links and buttons as before the change, and no new interactive control is
  added anywhere on the page.
- [ ] Copy lives in `src/ui/copy/auth.ts`; render tests cover the layout regions.

## Technical notes
- Files (expected): `src/ui/auth/AuthLayout.tsx`, `SignInScene.tsx`, `views.tsx`, `src/ui/copy/auth.ts`,
  `src/app/globals.css` (tokens), maybe a new `src/ui/auth/SmallWorld*.tsx`.
- Fonts: the mockup's italic serif headline needs a licence-checked font bundled locally (CSP; D45). If none is
  available, use the closest existing font and note it.
- Security area: the page holds the password form; check no new script, font or image host is added to the CSP and
  nothing about the password leaves the existing flow.
- Open questions: none (answered by Ming 2026-11-26, see Notes).

## Test plan
- Unit: render regions, no demo strings, no new controls, sign-in form unchanged behaviour.
- Manual: 1440 px, 1280 px and 390 px; light/dark; sign in with a real Identity account.

## Notes / answers from Ming
- 2026-11-26: "theo mặc định" — all 9 plan questions answered with the defaults: Q1 cream/green `--aw-*` palette on AuthLayout screens only (recorded as D85, not D73); Q2 Fraunces italic (OFL) via next/font, Georgia fallback (D85); Q3 hero headline is the landing h1, card intro h2, other screens keep their title h1; Q4 other screens get header/background/frame/footer/green button, no hero, keep today's office scene from md; Q5 390 px order header, hero, card, footer, rooms from 1280 px; Q6 café from existing sprites; Q7 drop "[ 01 ]"; Q8 keep "Sign in"; Q9 split accepted — slice 2 is SIM-068.1.
- 2026-11-26: requested with the mockup image `mockup-sign-in.webp`.
- 2026-11-26: "chỉ lấy idea như hình, còn các button tính năng giữ như hiện tại" — take only the visual idea; keep
  today's buttons and features. So: no "Need a hand?", "Remember my email", "Explore the demo" or vibe switcher.

## Handoff

### 2026-11-26 — claude — BLOCKED
- Agent calls: 3, ~185k tokens (frontend-developer×1 default 40k, ux-architect×1 default 36k, planner×1 default 109k).
- Done: consults; plan (slice 1 of a proposed split; slice 2 = SIM-068.1 with the four canvas rooms, paths, avatars, notes).
- In progress / next: Ming answers the 9 product questions in plan.md "Blocking questions" (defaults given); then `/run SIM-068` re-plans and builds.
- Gotchas: the plan's palette note suggests "D73", which is already taken — use the next free D number; the real sign-in page can only be seen on a deployed build (DevGate replaces it under `pnpm dev`).
