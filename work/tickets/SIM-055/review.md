# Review — SIM-055

## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: "All matched files use the correct format." exit 0
- `pnpm typecheck`: types generated, tsc exit 0
- `pnpm check:layers`: "895 files, no violations" exit 0
- `pnpm test`: "Test Files 343 passed | 1 skipped (344)", "Tests 3392 passed | 9 skipped (3401)" exit 0 (includes `no-photo-on-map.test.ts`, `copy/no-literals.test.ts`)
- `pnpm build`: "Compiled successfully" exit 0
- `pnpm test:db` (local docker Postgres, throwaway DB): "Test Files 22 passed (22)", "Tests 344 passed (344)" exit 0

These match impl-log attempt 1.

### Acceptance criteria
- [x] AC1 Desktop vignette from the bundled atlas, whole-number scale, no smoothing, hidden from AT. Evidence:
  `signin-scene.test.ts` (12x7, every key resolves in REGISTRY, `unknown` is [], bounds exactly `{0,0,384,224}`,
  integer rects, all 84 floor tiles covered, 2 avatars / 6 avatar ops / no overlay, no furniture overlap);
  `SignInScene.test.ts` › "paints 384x224 at zoom 1 with smoothing off first" (`scale 1 1`); `views.test.tsx` › scene
  is `aria-hidden`, no text/img/canvas on the server render; `globals.css` `.px-scene-canvas` 384x224 px with
  `image-rendering: pixelated`. The composition differs from the plan only by the cabinet (x 10 to 9) and small plant
  (x 11 to 10), which the plan allowed ("may nudge items while the tests stay green"), and impl-log explains why.
- [x] AC2 Pixel look on card, brand, heading and primary button only. Evidence: `views.test.tsx` › "pixel classes stay
  off form text" (no `px-title`/`px-heading`/`font-pixel` on `<input>`, `<label>`, `<a>` or `role="status"`; `px-title`
  only on the brand `<p>`, one `px-heading` on the `<h1>`) and › "the submit button carries data-variant=filled inside
  the px-card". The CSS adds no font at all (Q1: CSS lettering). Focus: `.px-card [data-variant="filled"]:focus-visible`
  sets a 3 px `--primary` outline, offset 3 px (globals.css:440-443). Other controls keep the global ring (globals.css:355-359,
  unchanged). The unlayered `.px-card` rule (specificity 0,2,0) beats the `:where(...)` focus rule's box-shadow, so the
  outline is the ring, as planned.
- [x] AC3 Shared look, and no horizontal scroll at 320 px. Evidence: every `AuthLayout` user (views, account-views,
  accept-views, DevGate, ProfileView) and `OrgPickerView` render through `AuthLayout.tsx:17-31`; `views.test.tsx`
  (px-stage/frame/strip/card/title/heading) and `org-views.test.tsx` › "has the pixel frame, floor and title but no
  scene". CSS check for 320 px: `<main>` has `px-5` (20 px each side) and `overflow-x-clip`; the card column is
  `w-full min-w-0 max-w-[400px]`; the frame draws at most 4 px left and 8 px right/bottom (globals.css:378-388), which
  stays inside the 20 px padding; `.px-scene` is `hidden` below `md` (no unlayered `display` on `.px-scene`, so the
  Tailwind `hidden` wins); the strip title has `overflow-wrap: anywhere` and the brand is "simap". Labels on filled
  buttons with an email (`continueAs`, `join`, `acceptAs`) already sit in `whitespace-normal break-all` spans. The
  manual check is still listed for Ming below.
- [x] AC4 Contrast and reduced motion. I recomputed the WCAG values: brand `#1a2230` on `#14b8a6` = 6.4:1 (strip
  colour is not theme-dependent; `--px-title` not overridden in dark); button text `#ffffff` on `#c2410c` = 5.2:1
  (same in both themes); focus ring `--primary` `#1c1c1c` on `#ffffff` / `#ececec` on `#161616` > 15:1. h1 colour
  unchanged (`on-surface`). Dark tokens `--px-bg`, `--px-bg-alt`, `--px-shadow`, `--px-heading-shadow`, `--px-floor`,
  `--px-wall` are added at globals.css:145-150, as planned. `--px-floor`/`--px-wall` are used only by `.px-scene`
  (no `bg-px-*` utility in `src/**/*.tsx`). No `@keyframes` or animation added, and the reduced-motion block is unchanged.
- [x] AC5 Fallback when the atlas fails. Evidence: `SignInScene.tsx:22-36`, where the canvas stays `invisible` until
  `paintSignInScene` returns true; a failed `useAtlas` leaves `atlas` null, so there is no paint and the placeholder
  shows. `SignInScene.test.ts` › "returns false without a 2D context"; `signin-scene.test.ts` › "a manifest without
  window.double does not throw and reports it". The form does not depend on the scene.
- [x] AC6 All Checks pass (see above).

Specific checks requested:
- No barrel import: `SignInScene.tsx` imports only `../roomlayout/loadAtlas` (type), `../roomlayout/paint` and
  `../roomlayout/useAtlas`. Those leaf files import only react, `./loadAtlas`, `@/lib/sprites/*` and
  `@/lib/validate/sprite-manifest`. No `"../roomlayout"` / `@/ui/roomlayout` import in `src/ui/auth/**`.
- Atlas never loaded below md or for the org picker: `useAtlas` runs only inside `SceneCanvas`, which mounts only
  when `matchMedia("(min-width: 768px)")` matches (server snapshot `false`, so the server HTML has no canvas).
  `OrgPickerView.tsx:24` passes `scene={false}`, so `SignInScene` is not rendered and no fetch happens.
- `Button.tsx`: the only change is `data-variant={variant}` at line 59 (after `className`, before `{...rest}`). This was
  approved (Q2).

### Issues
#### Issue 1 — 🟡 should-fix — UX / readability
- **Where**: `src/app/globals.css:429` (`.px-card [data-variant="filled"] { text-transform: uppercase; ... }`)
- **Expected**: The game button is uppercase for short calls to action ("SIGN IN"). Identity text such as the email
  the user confirms stays as typed.
- **Actual**: The rule also hits the filled buttons whose label contains an email: `views.tsx:92-100` ("Continue as
  {email}", first account), `views.tsx:182-186` (join), `accept-views.tsx:29-32` (accept invitation). They render as
  "CONTINUE AS NGUYEN.A@EXAMPLE.COM", with 0.06em tracking and `break-all`, which is harder to read and to check.
- **Fix instruction** (optional, does not block this PASS): either leave the email as it is and let Ming judge it in
  the visual pass, or exclude it, e.g. add `.px-card [data-variant="filled"] .normal-case-email` / reuse a kit
  `normal-case` utility on the email span. Any markup change must keep the existing tests green and add no copy.

### Rules (CLAUDE.md)
No violations found. R1: `check:layers` is clean; the new lib file imports only `./layout`, `./placement`, `./pixel-look`, `./types`.
R3: no config. R4: every changed source file is in the plan's file table (`Button.tsx` is listed and approved). R5:
the new logic has tests. D36: no new strings (`authCopy.brand` is reused).

### Blockers from review agents
None.

### Nits (do not block)
- 💭 `Button.tsx:53` still has `active:scale-95`. In Tailwind v4 this sets the CSS `scale` property, not `transform`,
  so `.px-card ... { transform: none }` does not cancel it. When pressed, the game button shrinks to 95% and also
  drops 2 px, which may give sub-pixel edges. If Ming wants a pure pixel press, add `scale: none` to the
  `.px-card [data-variant="filled"]` rule.
- 💭 The JS gate uses `768px` while Tailwind `md` is `48rem`. With a non-default root font size, the atlas may load in
  a band where the scene is still `hidden` (or the opposite). It is harmless.
- 💭 `SignInScene.test.ts` stubs `document` with `vi.stubGlobal` for the tint canvas. That is fine, and
  `afterEach(vi.unstubAllGlobals)` restores it.

### Ming verification (manual, not possible for the reviewer)
- `pnpm dev`, signed out, 1280 px: the scene shows wall, double window, clock, two desks (monitor and laptop) with
  two seated back-view avatars, plants, filing cabinet and cooler. It is crisp, not blurry, with no layout shift when it
  appears over the placeholder.
- 320 px (DevTools): `/`, forgot password, create account, an invitation link and the org picker show no horizontal
  scrollbar (`document.documentElement.scrollWidth === 320`), the scene is hidden, and the Network tab shows no
  `/sprites/office.*` request.
- Tab through sign in: every input, link and button has a visible ring, and on the orange button the 3 px outline
  is not hidden by the ledge. Pressing the button shows the pressed state (see the scale nit).
- Dark theme: floor checker, frame, drop shadow, heading shadow and placeholder look right; the brand strip is readable.
- Block `/sprites/office.json`, then `/sprites/office.png`, and reload: the placeholder box shows and sign-in works.
- With `prefers-reduced-motion: reduce` emulated, nothing visible changes.
- The org picker shows frame, floor and title but no scene box.
- "Continue as {email}" in uppercase (Issue 1): acceptable or not.
- Hosted site after merge: no CSP console errors for the atlas or canvas.

### Follow-ups (out of scope)
- Optional pixel font (OFL) for brand and heading, which needs a D45 licence decision (plan A1).
- Optional 2x scene at `xl` (plan A6) and the idle monitor blink (plan A2).
