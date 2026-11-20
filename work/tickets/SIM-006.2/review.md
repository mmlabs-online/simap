## Attempt 1 — 2026-11-20
Verdict: PASS

### Checks (run by reviewer)
Worktree `ticket/SIM-006.2` at `82155b5`, diff base `origin/main`. Windows, Node 24.20.0 (CI uses Node 22).
- `pnpm format:check` — exit 0, "All matched files use the correct format." (161 files)
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 138 files, no violations"
- `pnpm test` — exit 0; "Test Files 52 passed (52); Tests 494 passed | 3 skipped (497)" (same as impl-log)
- `pnpm build` — exit 0 on the second run. The first run failed with "Connection timed out when requesting
  https://fonts.gstatic.com/…manrope…" (network fetch of the Google font in `src/app/layout.tsx`, which is not in this
  diff). The route list shows `ƒ /sign-in`.
- Extra: standalone server (`.next/static` copied next to `server.js`, port 3917, stopped afterwards):
  - `/sign-in?returnTo=//evil.com`, `/` and `/rooms` all return 200 with `<html lang="en">`.
  - Each SSR body is the gate's `CheckingView` inside `px-frame` / `px-strip` / `px-scene hidden md:block` (no app
    shell, no children). This matches the client's first render (`AuthGate.tsx:48-50`, `rt === null` → `CheckingView`),
    so the output is hydration-safe.
  - `/sign-in` has `<title>Sign in</title>`. Its flight payload passes `returnTo:"/"` for `//evil.com`.
  - The compiled CSS has `.px-frame`, `.rounded-none\!{border-radius:0!important}`, `.border-0\!` and
    `@media (min-width:48rem){.md\:block…}`.
- Extra: build-output env check (the impl-log note). The only hit in `.next/static` is one chunk:
  `let e=(g.default.env.NEXT_PUBLIC_MM_IDENTITY_BASE,"https://api.mmlabs.online/api/v1"),t=(g.default.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,"0x4AAAAAAF_LLtCloZlzY0MY")`.
  - A comma expression evaluates to its last operand, so `baseUrl` and `turnstileSiteKey` are the production constants
    from `src/lib/identity/config.ts:3,5`.
  - The env read stays in the bundle only because the variable was unset at build time. If it had been set, it would be
    inlined as a string literal and still discarded.
  - The minifier folded `identityBaseFrom(raw, true)` because `NODE_ENV === "production"` was inlined to `true`.
  - Conclusion: dev overrides cannot reach a production bundle. Plan Δ2's literal "finds nothing" is not met, but the
    intent is (see Nits).

### Acceptance criteria
- [x] AC1: a signed-out visit to any app page shows sign-in, and after sign-in the user lands back on that page.
  Evidence:
  - `src/app/(app)/layout.tsx:7-9` wraps every app page in `AuthGate`.
  - The gate renders auth views in place and renders `children` only in `ready` (`AuthGate.tsx:383-391`).
  - Without an account id, the initial path goes to `loadAccounts` and then `signedOut` (`AuthGate.tsx:214-217`).
  - Standalone `/rooms` SSR shows the gate, not the shell.
  - `/sign-in` → `SignInRoute` does `router.replace(returnTo)` on ready (`SignInRoute.tsx:11`). Return-to tests:
    `return-to.test.ts` (4 tests, all in the green run).
  - Δ3 rows pass: `flow.test.ts › viewForMe 5xx`, `› meErrorView` (TypeError/string/null → retry,
    session_invalid → signIn relist), and `views.test.tsx › RetryView has a Try again button and no sign-out`.
- [x] AC3b: a second 403 shows "You don't have permission". Evidence:
  - `views.test.tsx › NoAccessView shows 'You don't have permission'`
  - `auth.test.ts › apiErrorMessage … forbidden is exactly the permission text`
  - `flow.test.ts › meErrorView › ApiAccessError maps like the matching /api/me answer` (forbidden → noAccess)
  - The gate uses it on throw at `AuthGate.tsx:197-201`.
- [x] AC4b: sign-out ends the session in this tab and other tabs (UI). Evidence from code review:
  - `store.onRemoteSignOut` is at `AuthGate.tsx:226-239` (unmounts the app via `flushSync`, then shows the sign-in view
    with a notice).
  - `store.subscribe` is at `:242-251`.
  - Shell `signOut` calls `store.signOut()` at `:269-283` and is passed to `SessionProvider` at `:386`.
  - The store side is covered by S1 `tabs.test.ts` (green).
- [x] AC7: Turnstile only when asked, "Continue as", join only on click, and no account enumeration. Evidence:
  - `views.test.tsx › shows the Turnstile slot only when required` and `› renders the form and one Continue as button
    per account`.
  - `› JoinView button text names the account…`.
  - `join()` is wired only to `JoinView.onJoin` (`AuthGate.tsx:358,401`).
  - Δ4: `views.test.tsx › invalid_credentials: the alert is the generic message and does not contain the typed email`
    and `auth.test.ts › invalid_credentials does not reveal whether the account exists`.
- [x] Δ1: D52 pixel style with no pixel body text, and the art is decorative.
  - `views.test.tsx › AuthLayout has the px-frame, px-strip and the scene slot…` and `› SignInScene is aria-hidden with
    no text and no img`.
  - `globals.css` adds no `@font-face` and no font (grep).
  - The controls are kit `FilledInput` / `Button` / `Card` (`views.tsx:6-9`).
  - Style guide §1 ("frames, headings and decoration only", "do not replace the kit's controls") is met. §3 colours are
    used: outline `#2a3140`, wall top `#8b95a7`, state "mine" `#14b8a6`, carpet `#d9dee5`, wall face `#eef1f5`.
- [x] Δ2: dev overrides never apply in a production bundle. `runtime.test.ts` (source guard) is green, and the bundle
  check above confirms the constants.
- [x] Δ5: copy convention. `no-literals.test.ts` and `copy.test.ts` pass unchanged. There are no `copy-ok` escapes in the
  diff (grep). `apiCopy.errors` uses `satisfies Record<ApiErrorCode, string>` (`src/ui/copy/api.ts:17`).
- [x] Loop checks are green (above).

Contrast of the `--px-*` tokens (WCAG relative luminance, computed):
- Frame outline: light `#2a3140` on background `#f6f6f5` is 12.05:1. Dark `#8b95a7` on `#0f0f0f` is 6.35:1, and on
  surface `#161616` it is 5.99:1. Both are ≥ 3:1. The old value `#2a3140` on `#161616` would have been 1.39:1, so the
  dark override is needed and correct.
- Strip `#14b8a6`: on the light background it is 2.30:1, against the outline line 5.23:1 (light) and 1.21:1 (dark).
  - The strip is `aria-hidden` decoration with no text, so WCAG 1.4.3 and 1.4.11 do not apply. See Nits.
- Scene: the placeholder has no text. In dark theme, wall/floor are 16.9:1 and 14.2:1 on `#0f0f0f`, a bright block.
  See Nits.

Ming verification after merge (not verified here; carry into the PR):
- Sign in on `http://localhost:3000/rooms` against a local Identity with `pnpm dev`. The URL stays `/rooms`. Before
  SIM-007, sign-in ends on "No organization selected yet".
- "Continue as <email>" appears. Join runs only on click.
- Two tabs: reload one, both stay signed in. Sign out in one, the other shows sign-in.
- Turnstile appears after `turnstile_required`.
- DevTools storage holds only `mm_account_id`.
- Δ1: check the look in light and dark (frame visible, focus rings visible, scene hidden on a narrow window).
- Δ2: the overrides work only under `pnpm dev`.
- Δ3: with the DB or JWKS down, a signed-in reload shows "Try again".
- Ming steps:
  1. Add `NEXT_PUBLIC_MM_IDENTITY_BASE=` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY=` to `.env.example`.
  2. Add `simap.mmlabs.online` and `localhost` to the Turnstile widget hostnames.
  3. M-1: the Identity app `simap` registers `http://localhost:3000`.

### Issues
#### Issue 1 — 🟡 should-fix — layout vs plan Δ1 / style guide §2 (does not block)
- **Where**: `src/ui/auth/AuthLayout.tsx:18` (`max-w-[816px] … gap-10`), `src/app/globals.css` `.px-scene` (width
  `384px`, no `flex: none`).
- **Expected**: plan Δ1 Approach 1 says the scene is rendered "at an integer scale of 32 px tiles" (12 × 7 = 384 × 224).
  Style guide §2 says "Scaling: whole numbers only".
- **Actual**:
  - The row needs 384 (scene) + 40 (`gap-10`) + 400 (`flex-none` frame) = 824 px, but the container is capped at 816 px.
  - The scene is a shrinkable flex item, so it is laid out at about 376 × 219.3 px at every desktop width.
  - Between `md` (768 px) and about 864 px viewport width it shrinks further.
  - This is invisible with today's flat CSS gradient. It would blur the `scene.signin` sprite when SIM-024 swaps it in.
- **Fix instruction**: give `.px-scene` `flex: none` (or add `shrink-0` in `SignInScene.tsx`), and make the row fit:
  `gap-8` (384 + 32 + 400 = 816) or `max-w-[824px]`. Either do this in a follow-up before SIM-024 or let SIM-024 do it
  under its swap rule. `.px-scene` is already the file that rule names.

### Rules (CLAUDE.md)
No violations found.
- R1: `check:layers` is clean. `flow.ts` imports only `@/lib/api/fetch` and `@/lib/tier` (lib → lib). The page imports
  `@/ui` and `@/lib`.
- R2: no schema change.
- R3: only the public constants and `NEXT_PUBLIC_*` names. No values were added, and `.env.example` is left to Ming.
- R4: every changed file is in the plan's file list. `readMeResult` is added to `flow.ts`, a planned file; it is the
  plan's `toMeResult` in Approach 3. No High path is touched (`config.ts`, `next.config.ts` and `.env.example` are
  unchanged).
- R5: the new logic has tests.
- R6: the client sends only the bearer and never an org id.

### Blockers from review agents
- None. `security-review.md` Attempt 1: 0 🔴, 0 🟡, 6 💭.

### Nits (do not block)
- Plan Δ2 says the build check should find nothing for `grep -r NEXT_PUBLIC_MM_IDENTITY_BASE .next/static`. The name
  stays as a discarded comma operand (proven harmless above). A future check should grep the value instead: it must find
  only `https://api.mmlabs.online/api/v1` next to the name.
- Dark theme:
  - The scene placeholder keeps the light wall/floor colours, so it shows as a bright 376 × 219 block on `#0f0f0f`.
  - The strip's bottom outline line (`#8b95a7` under `#14b8a6`, 1.21:1) almost disappears.
  - Both are decorative. Consider dark values for `--px-wall` / `--px-floor` when SIM-024 lands, or ask Ming at the
    Δ1 visual check.
- `apply` case `signIn` from `ApiAccessError("signed_out")` (`AuthGate.tsx:158-161`) does not relist accounts. A restore
  that finds no token therefore shows the form without "Continue as". This is harmless.
- `signIn` sets `setNeedTurnstile(false)` (`AuthGate.tsx:320`) before the epoch check. This is harmless.
- `RetryView` has no way out while the 5xx persists (by design, AUT-02). Ming may want "Use another account" there later.

### Follow-ups (out of scope)
- Issue 1, if it is not fixed in a later attempt: hand it to SIM-024 or a small solo change.
- Runtime CSP (Δ7, SIM-027) and the A19 notes (`redirect: "error"` in `apiFetch`, 401/403 after a side effect) need
  `debt` issues if they do not exist yet (orchestrator).
- The production build depends on reaching `fonts.gstatic.com` (`next/font/google`), and one local run timed out. CI
  and the image build have the same dependency. Consider self-hosting Manrope (not this ticket).
