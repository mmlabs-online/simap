## Attempt 1 — 2026-11-26
Verdict: PASS

Scope: slice 1 only (frame, palette, font, header, hero, card intro, footer). The four rooms, paths, avatars, note
cards and card avatar are slice 2 (SIM-068.1), as the plan says.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (1014 files)
- `pnpm typecheck`: exit 0
- `pnpm check:layers`: exit 0, "check-layers: 959 files, no violations"
- `pnpm test`: exit 0, "Test Files 365 passed | 1 skipped (366)", "Tests 3565 passed | 9 skipped (3574)". These match impl-log.
- `pnpm build`: exit 0, "Compiled successfully". The built CSS `.next/static/chunks/261t_u2y975nh.css` has
  `@font-face{font-family:Fraunces;font-style:italic;…src:url(../media/…woff2)}` and contains no `https://` host.
- `pnpm test:db`: not re-run (CI-only; this diff touches no DB, server or API code). impl-log reports 23 files / 365 tests passed.

### Acceptance criteria (plan table)
- [x] 1 Header, hero, card title bar plus intro, and footer. Evidence: `views.test.tsx` › landing › "renders header, hero,
  card intro and footer"; `AuthLayout.tsx:25-68`. Rooms are slice 2.
- [x] 2 390 px order and no horizontal scroll. Evidence: "DOM order is header, hero, card, footer". CSS reasoning:
  `.aw-stage` keeps `overflow-x-clip`. The header is fixed-size items of about 126 px plus 40 px padding; the tagline
  has `min-width:0` and `overflow-wrap:anywhere`, so it wraps. The headline is `clamp(30px,6vw,48px)` (30 px at
  390 px) with `text-wrap:balance`. The hero has only a `max-width`. The frame is `w-full max-w-[400px]` inside
  `px-5`. The frame shadow is `0 8px 0 0`, with no sideways spread. The footer stacks under 640 px. The vignette is
  still hidden below `md` (unchanged `SignInScene`).
- [x] 3 Sign-in behaviour unchanged. Evidence: in `views.tsx` the diff touches only the props type, the default and the
  `<AuthLayout … landing={landing}>` tag (+4/-1). `git diff origin/main...HEAD -- src/lib src/proxy.ts next.config.ts
  src/ui/auth/fields.tsx src/ui/auth/TurnstileWidget.tsx` is empty. All existing SignInView tests pass. Only the
  "pixel surface" class names changed.
- [x] 4 No demo wording. Evidence: landing › "ships no demo or out-of-scope strings" (tag-stripped text has no `/demo/i`,
  Explore, "no real authentication", Need a hand, Remember my email, Find your vibe, "[ 01 ]", Work email). The password
  label equals `authCopy.fields.password`. `copy/auth.ts` `world` block contains no demo text.
- [x] 5 Same controls, nothing new. Evidence: landing › "has exactly the controls of the plain sign-in view" (button / a /
  input / select / textarea / tabindex counts equal in 3 variants). frame › "header logo is decorative and the header
  has no control". Before/after reasoning: the `SignInView` children passed to `AuthLayout` are byte-identical to
  `origin/main`. The new `AuthLayout` markup adds only `div`/`span`/`p`/`h1`/`h2`/`em`/`header`/`footer`. It adds no
  `a`, `button`, `input` or `tabindex`. The old strip held three decorative spans and the brand `p`, so no control was
  removed either.
- [x] 6 One h1 per screen. Evidence: "exactly one h1, the headline" (landing) and "plain screens keep the card title as
  the only h1" (AuthLayout, plain SignInView, CheckingView). Grep shows no `h1`/`h2` inside `account-views.tsx`,
  `accept-views.tsx`, `DevGate.tsx`, `OrgPickerView.tsx` or `ProfileView.tsx`, so each keeps exactly the layout's card
  `h1`. Only `AuthGate.tsx:693` passes `landing`.
- [x] 7 Other AuthLayout screens get the frame without the hero. Evidence: frame › "AuthLayout has header, stage, frame,
  strip, card and footer". `org-views.test.tsx` was updated for class names only. `account-views`, `accept-views`,
  `DevGate` and `profile-views` tests pass unchanged. "the accept-invitation style sign-in stays plain" keeps
  `intro`/`footer`.
- [x] 8 No pixel font on form text. Evidence: the updated "pixel classes stay off form text" (no `font-pixel` on the
  page, no `aw-strip-title`/`aw-heading` on input/label/a/status).
- [x] 9 AA contrast. Evidence: `world-palette.test.ts` › "light and dark aw tokens meet AA". I also checked what this
  test does not cover: the inherited `--on-surface-variant` #6b6b6b on `--aw-bg` #f3efe4 is about 4.6:1 (passes,
  narrowly).
- [x] 10 Font bundled, CSP and headers unchanged. Evidence: build CSS above. No diff in `headers.ts`/`proxy.ts`.
  `layout.tsx` diff is the `Fraunces` import, the `serif` const and the `<html>` className only. The preconnect, icon
  and theme-script lines are unchanged.
- [x] 11 Copy in `src/ui/copy/auth.ts`. Evidence: `auth.ts:39-53`. `AuthLayout.tsx` has no string literals besides class
  names and the icon name.
- [x] 12 Reduced motion. Evidence: `world-palette.test.ts` › "the aw block has no animation or transition". The appended
  block has none.
- [x] 13 Checks green (above).

`globals.css` is append-only: the diff hunk starts after line 465 (`.px-scene-canvas`) and has 145 additions and 0
deletions. The test asserts that the marker comes after the last `.px-scene-canvas`. All `--px-*` tokens and `.px-*`
rules are untouched.

### Out-of-plan files
- `assets/art/CREDITS.md` (+3 lines, Fraunces OFL 1.1 note): **accepted**. Plan assumption A6 says not to add it, but
  D85 (`work/decisions.md:92`) says "licence recorded here and in the credits (D45)". D85 is the later, Ming-approved
  decision and wins over a planner assumption. The note is factual and has no runtime effect.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: only ui → ui imports (`../Icon`), and layers are clean. R2/R6/R7 are not touched. R3: no
env, secret or host change. R4: every file is in the plan or justified above. R5: checks green and new logic tested.

### Blockers from review agents
None.

### Nits (do not block)
- 💭 `--font-serif` is also Tailwind v4's default theme variable. The next/font class on `<html>` now makes any future
  `font-serif` utility resolve to Fraunces. No `font-serif` utility is used today (grep). A distinct name such as
  `--font-aw-serif` would avoid the surprise.
- 💭 `.aw-card [data-variant="filled"]` makes every filled button inside an AuthLayout card green. This includes the
  org picker, DevGate and old ProfileView, which is intended per Q4. The Button's `hover:shadow` and
  `disabled:opacity-40` still apply because the rule sets no `box-shadow`/`opacity`.
- 💭 The landing card has no visible "Sign in" heading, by design (Q3); the submit button still reads "Sign in".

### Follow-ups (out of scope)
- Slice 2: SIM-068.1 (four rooms, paths, idle avatars, note cards, card avatar).

### Ming verification after merge (deployed build; DevGate hides the real page under `pnpm dev`)
- Open `/` signed out at 1440, 1280, 1024 and 390 px, in light and dark (toggle the system theme with no stored
  preference). Check the header (orange logo tile, "simap", tagline), the hero (eyebrow, headline with the second
  sentence in green italic serif, subline), the "Your workspace portal" bar, "Player, ready?" / "Come on in." and the
  three footer texts. At 390 px: header → hero → card → footer, no horizontal scroll, the tagline wraps cleanly, and no
  vignette is shown.
- The italic "A better workday." renders in Fraunces, not Georgia. In DevTools › Network, a `/_next/static/media/*.woff2`
  file loads from the same origin. The console shows no CSP violation. Other app routes do not fetch the Fraunces file.
- Sign in with a real Identity account (and a Turnstile challenge if shown). Check that wrong-password and validation
  errors show as before, that you are redirected to `/`, then sign out and sign in again. Also try "continue as" with a
  remembered account.
- The forgot-password and create-account links open their pages. Those pages show the new header, background, frame
  and footer, no hero, the office vignette from `md` up, a green primary button, and the page title as the only
  heading. Also check reset-password, verify-email, accept-invitation (its sign-in has no hero), the org picker
  (multi-org account) and the old profile view.
- Keyboard: Tab order on the landing goes email → password → submit → links, with nothing focusable in the header or
  footer. The focus ring is visible on the green button.
