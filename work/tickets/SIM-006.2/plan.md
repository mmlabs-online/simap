Status: READY

# Plan — SIM-006.2: Sign-in gate UI (AuthGate, sign-in screen, /sign-in)

This is slice **S2** of the approved `work/tickets/SIM-006/plan.md` (revision 2, approved 2026-11-20, batch
2026-11-20-2). Everything in that plan's S2 rows (ACs, files, tests, Approach steps 7-9, assumptions A1-A5, A8, A11)
**still holds unless it is marked Δ below**. Ming only needs to review the Δ items:

| Δ | Change vs the approved S2 plan | Source |
|---|---|---|
| Δ1 | Pixel style on the sign-in surface: a thin, CSS-only pixel frame and header strip in `AuthLayout`, plus a swappable `SignInScene` art slot with a CSS placeholder. No sprite assets, no pixel font, no dependency on SIM-024. | D52, `docs/art/style-guide.md` §1, §3; consult rec. 1-3 |
| Δ2 | `runtime.ts` passes `production = process.env.NODE_ENV === "production"` and reads both `NEXT_PUBLIC_*` names as literal `process.env.X`. A source-text guard test and a build-output check back this up. | security-review.md "Follow-ups" (S2 `runtime.ts`); consult finding 7 |
| Δ3 | A 5xx (any `>= 500`) or network error from `/api/me` maps to `RetryView`, not to "no permission". This needs a small change to the S1 file `src/lib/identity/flow.ts` (`viewForMe` line 66-67) and a new pure `meErrorView` that maps what `apiFetch` throws. | review.md Nits (`flow.ts:168`, "SIM-006.2 may want 5xx → retry"); consult rec. 6 |
| Δ4 | `invalid_credentials`: copy and view tests assert the message names neither the email nor whether the account exists. | security-review.md "Follow-ups" |
| Δ5 | Copy follows the merged SIM-022 convention. The rule on `main` bans `"??"`, not every `"?"`. `copy.test.ts` picks up new copy files by glob, so it needs no edit. Mapping tests go in a new `src/ui/copy/auth.test.ts`. `apiErrorMessage` moves to its own `src/ui/copy/api.ts`, because `ApiErrorCode` now also holds SIM-010's room codes. | `src/ui/copy/copy.test.ts:6-27`, `no-literals.test.ts:7-23`, `src/lib/api/error.ts:1-12` |
| Δ6 | SIM-023 is on main: `/api/me` returns `{sub, email, org, tier}` from `ctx` (`src/app/api/me/route.ts:5-12`). A1 is unchanged. The client sends only the bearer. | main |
| Δ7 | Runtime CSP is **not** in S2. It needs `next.config.ts` or `src/proxy.*` (both High paths) plus nonce work for Next's inline scripts. Default: a `debt` issue and a security ticket before go-live (Q2). | security-review.md last paragraph; consult Q4 |

## Scope summary
From `work/tickets/SIM-006/plan.md` slice S2 (the scope reference of `ticket.md`): "return-to, `waitText`, session
type, Turnstile, runtime, AuthLayout, views, AuthGate, api-fetch context, SignInRoute, `authCopy`, `(app)` layout,
`/sign-in` + tests", ACs 1, 3b, 4b, 7.

Spec, as quoted in the source plan:
- AUT-01: "Wrong credentials show a clear message. No message reveals whether the email exists." / "The join runs only
  after the user clicks".
- AUT-02: "If the JWKS is unavailable the answer is 503, so the client keeps the session instead of signing out." /
  "After a 403 from simap the client re-mints the token once and retries; a second 403 shows "no permission" (D7)."

`work/decisions.md`:
- D52: "The pixel/game style is used only on end-user surfaces: sign-in and org picker, … Body text, tables and forms
  never use a pixel font."
- D36: "all user-facing text lives in copy files".
- D4, D7: as in the source plan.

`docs/art/style-guide.md`:
- §1: "Pixel styling goes into art, frames, headings and decoration only … The clean UI kit (SIM-003) stays the base
  for both columns. Pixel surfaces add art and pixel accents; they do not replace the kit's controls."
- §2: "Scaling: whole numbers only … `image-rendering: pixelated`".
- §3: Outline `#2a3140`; State "mine" teal `#14b8a6`.
- §7: `scene.signin` "about 12×7 tiles".

security-review.md (SIM-006) "Follow-ups":
- "S2 `runtime.ts`: pass `production` from `process.env.NODE_ENV === "production"` evaluated at build time … Also
  check that the `invalid_credentials` copy names neither the email nor whether it exists".

## Acceptance criteria → verification

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A signed-out visit to any app page shows the sign-in page; after sign-in the user lands back on the page. | Unchanged from the source plan: `src/app/(app)/layout.tsx` wraps every app page in `AuthGate`. The gate renders the sign-in view **in place** (URL unchanged) and renders `children` only when `ready`. Tests: `flow.test.ts › initialView` and `› viewForMe 200 → ready` (S1); `views.test.tsx › SignInView renders form and Continue as list`; `return-to.test.ts`. Local run: `pnpm dev`, open `/rooms`, and the sign-in view shows at `/rooms`. **Δ3 adds:** `flow.test.ts › viewForMe 500/502/504 → retry`, `› meErrorView: TypeError → retry`, `› meErrorView: AuthError session_invalid → signIn`; `views.test.tsx › RetryView has a Retry button and no sign-out`. |
| 3b | A second 403 shows "You don't have permission". | `views.test.tsx › NoAccessView shows "You don't have permission"`; `auth.test.ts › apiErrorMessage("forbidden") is "You don't have permission"`. **Δ3:** the gate mapping is now unit-tested instead of code-reviewed: `flow.test.ts › meErrorView(new ApiAccessError("forbidden")) → noAccess forbidden`. |
| 4b | Sign-out ends the session in this tab and in other tabs (UI). | Unchanged: code review of `AuthGate.tsx`. `store.onRemoteSignOut` and `store.subscribe` move to the sign-in view, and the shell `signOut` action calls `store.signOut()`. The store side is covered by S1 `tabs.test.ts`. |
| 7 | Sign-in page features: Turnstile when asked; "Continue as <email>"; join only on click; the invalid-credentials message does not reveal whether the email exists. | Unchanged rows (`views.test.tsx › SignInView: Turnstile slot only when required`, `› JoinView button text`; S1 `flow.test.ts` join rows). **Δ4:** `views.test.tsx › invalid_credentials: alert text equals authErrorMessage, does not contain the typed email`; `auth.test.ts › invalid_credentials message has no "exist", "found", "registered", "account"`. |
| Δ1 | The sign-in surface carries the D52 pixel style without pixel body text, and the art is decorative only. | `views.test.tsx › AuthLayout has the px-frame class and the scene slot`, `› SignInScene is aria-hidden, has no text and no <img> without alt`. Grep: `src/app/globals.css` has no `@font-face` or pixel font added. Code review: inputs, buttons and copy are kit components (`FilledInput`, `Button`). |
| Δ2 | Dev overrides can never apply in a production bundle. | `runtime.test.ts › source reads process.env.NEXT_PUBLIC_MM_IDENTITY_BASE, process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY and NODE_ENV === "production" literally; no process.env[ or destructuring`. S1 `config.test.ts › production ignores both overrides` (cited, already on main). After `pnpm build`: `grep -r "NEXT_PUBLIC_MM_IDENTITY_BASE" .next/static` finds nothing (inlined). |
| — | Loop checks; SIM-022 copy convention | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test` (including `no-literals.test.ts` with no new `copy-ok` escapes except the one named in Approach 4), `pnpm build` green. The route list shows `/sign-in`. |

## Ming verification after merge
Unchanged from the source plan's "After S2" list (sign-in on `http://localhost:3000/rooms` against a local Identity,
"Continue as", join on click, two tabs, Turnstile after `turnstile_required`, DevTools storage). Δ notes:
- **Δ2:** the overrides work only under `pnpm dev`. `pnpm build && pnpm start` always uses the production Identity base
  and Turnstile key, by design. Run the local-Identity check with `pnpm dev`.
- **Δ1:** check the look in light and dark theme (frame visible, focus rings visible, scene hidden on a narrow window).
- **Δ3:** with Identity up but the simap DB or JWKS down, a signed-in reload shows "Try again", not sign-in and not "no
  permission".

Ming steps (agents cannot do them), due with this ticket:
1. Add the names, with no values, to `.env.example` (High path, denied to agents): `NEXT_PUBLIC_MM_IDENTITY_BASE=`
   (dev only, e.g. `http://localhost:8000/api/v1`; ignored in production builds) and `NEXT_PUBLIC_TURNSTILE_SITE_KEY=`
   (dev only; ignored in production builds). Use exactly these names; S1's impl-log wrote `NEXT_PUBLIC_IDENTITY_BASE` by
   mistake (review.md Nits).
2. Turnstile: add `simap.mmlabs.online` and `localhost` to the allowed hostnames of the widget behind
   `TURNSTILE_SITE_KEY_PROD` (`src/lib/identity/config.ts:5`, shared with tudocuatui until SIM-021).
3. M-1: the Identity app `simap` registers the dev origin `http://localhost:3000`.

## Files to create / modify
No file matches a High path (`.claude/loop.config.md` High paths; `.github/risk-tiers.yml:11-15`). The tier is
**Medium** by paths. Security review still triggers on `**/auth*` (`src/ui/auth/**`). Gate stays `none` (ticket).
`src/lib/identity/config.ts` (High, `**/config.*`) is **read, not modified**.

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/return-to.ts` | new: `safeReturnTo(raw): string` (as source plan) | `/sign-in?returnTo=` without an open redirect | no |
| `src/lib/format.ts` | add `waitText(seconds)` (as source plan; file today has only `initials`, lines 1-12) | `rate_limited` copy | no |
| `src/lib/session.ts` | `orgName?: string` (line 4) | `/api/me` has no org name until SIM-007. `AppShellView.tsx:98` renders `undefined` as nothing, so no shell change. | no |
| **Δ3** `src/lib/identity/flow.ts` | `viewForMe`: `status >= 500` → `retry` (replaces the `=== 503` check at line 66; any other status stays fail-closed `noAccess`). New pure `meErrorView(err, hasAccount)` maps what `apiFetch("/api/me")` throws (Approach 3). | 5xx/network → RetryView; AC3b mapping testable | no |
| **Δ3** `src/lib/identity/flow.test.ts` | extend `viewForMe` block (lines 60-96) + new `meErrorView` block | R5 | no |
| `src/ui/auth/turnstile.ts`, `src/ui/auth/TurnstileWidget.tsx` | port (as source plan): `siteKey`, `resetKey`, lazy script, nothing rendered without a key, cleanup on unmount. **Δ:** container gets `role="group"` + `aria-label={authCopy.turnstileLabel}`. | "Turnstile when asked" | no |
| `src/ui/auth/runtime.ts` | new `"use client"` lazy singleton `getAuthRuntime()` → `{ client, store, apiFetch, turnstileSiteKey }`. **Δ2:** literal env reads (Approach 2). | one store per page load | no |
| **Δ2** `src/ui/auth/runtime.test.ts` | new: source-text guard (reads `runtime.ts` as text; does not import it) | review risk "a test cannot catch this" → cheap guard | no |
| `src/ui/auth/AuthLayout.tsx` | new: centred kit `Card` with title. **Δ1:** wrapped in a `px-frame` (stepped corners) with a `px-strip` header band, and `SignInScene` beside the card from `md` up (Approach 1). Prop `scene?: boolean` (default `true`). | consistent auth screens; D52 | no |
| **Δ1** `src/ui/auth/SignInScene.tsx` | new: the one swappable art slot. In S2 it is a CSS placeholder `<div aria-hidden="true" className="px-scene">`: no `<img>`, no text. SIM-024 later swaps its body for `scene.signin` from the atlas. | D52 art without blocking on SIM-024 | no |
| **Δ1** `src/app/globals.css` | add `--px-outline` (`#2a3140`; dark theme `#8b95a7`, palette "wall top", so the frame keeps ≥ 3:1 on `#161616`), `--px-accent` (`#14b8a6`), `--px-floor` (`#d9dee5`), `--px-wall` (`#eef1f5`), each mapped in `@theme inline` (lines 133-179). Add classes `.px-frame`, `.px-strip` and `.px-scene` (`image-rendering: pixelated`, integer-step sizes, no animation). No font. | style-guide §2-§3 | no |
| `src/ui/auth/views.tsx` | new props-only views (as source plan): `SignInView`, `JoinView`, `UnverifiedView`, `NoOrgView`, `NoAccessView`, `RetryView`, `CheckingView`. **Δ4:** errors in `role="alert"`. **Δ3:** `RetryView` = message + "Try again" button, no sign-out. | AC1, AC3b, AC7 | no |
| `src/ui/auth/views.test.tsx` | new (`renderToStaticMarkup`), source-plan rows + Δ rows | R5 | no |
| `src/ui/auth/AuthGate.tsx` | new `"use client"` container (as source plan, Approach step 8). **Δ3:** the `/api/me` call goes through `meErrorView` on throw and `viewForMe` on a response. | AC1, AC4b | no |
| `src/ui/auth/api-fetch-context.tsx` | new: `ApiFetchProvider`, `useApiFetch()` | one bearer path for UI data calls | no |
| `src/ui/auth/SignInRoute.tsx` | new `"use client"`: own `AuthGate`; `router.replace(returnTo)` once ready | `/sign-in` deep link | no |
| `src/ui/copy/auth.ts` | new `authCopy` `as const` + `authErrorMessage(err)` (as source plan, Approach step 7) | D36, SIM-022 | no |
| **Δ5** `src/ui/copy/api.ts` | new `apiCopy` with `errors: { … } satisfies Record<ApiErrorCode, string>` + `apiErrorMessage(code)`. This replaces `apiErrorMessage` in `auth.ts`. | `ApiErrorCode` now includes room codes (`error.ts:1-12`); typecheck forces coverage when a code is added | no |
| **Δ5** `src/ui/copy/auth.test.ts` | new: mapping tests (replaces the source plan's `copy.test.ts` edits; `copy.test.ts:6-9` already globs every copy file) | R5, D36 | no |
| `src/ui/index.ts` | export `AuthGate`, `SignInRoute`, `useApiFetch` (append after line 13) | pages import `@/ui` | no |
| `src/app/(app)/layout.tsx` | replace `SessionProvider value={null}` (lines 1-11) with `<AuthGate><AppShell>{children}</AppShell></AuthGate>` | wire the session context | no |
| `src/app/sign-in/page.tsx` | new: `await searchParams` (Next 16), `safeReturnTo`, `metadata.title` from `authCopy`, `<SignInRoute returnTo=… />` | `/sign-in` route | no |
| Tests (S2 rows) | new / extended | R5 | no |

Not touched: `src/lib/identity/config.ts`, `src/lib/api/fetch.ts`, `src/ui/auth/{tokenStore,identityClient,…}.ts` (S1,
used as is), `src/ui/copy/copy.test.ts`, `src/ui/AppShell*.tsx`, `src/server/**`, `src/app/api/**`, `next.config.ts`,
`.env.example` (Ming step 1), `public/**`, `assets/**`.

## Data model / migration
None.

## API contract
None (no endpoint change). Consumed: `GET /api/me` → `200 {sub, email, org, tier}` (`src/app/api/me/route.ts:5-12`),
`401`, `403 org_required | forbidden | member_deactivated`, `503 unavailable`, `500 internal`, body `{error:{code}}`.
`apiFetch` (`src/lib/api/fetch.ts:47-76`) returns 5xx untouched. It throws `ApiAccessError` on a final 401/403, a
`TypeError` on network failure, and the `AuthError` from `getToken`. Identity calls as in the source plan's table
(S2 uses login, token, accounts, join, logout).

## Tests to write
Source-plan S2 rows stay: `return-to.test.ts`, `format.test.ts › waitText`, `views.test.tsx` rows,
`no-literals.test.ts` passing. Changed or new rows:

| Test (file › name) | Covers |
|---|---|
| `src/lib/identity/return-to.test.ts` › as source plan (`/rooms`, `/rooms/A1?tab=x` kept; `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:x`, `""`, `undefined`, arrays, > 2048 chars, `/sign-in…` → `/`) | open redirect |
| `src/lib/format.test.ts` › `waitText` seconds/minutes/hours, rounds up, NaN/negative → generic | rate_limited copy |
| **Δ3** `src/lib/identity/flow.test.ts` › `viewForMe`: 500, 502, 504 → `retry`; 404, 429 → `noAccess forbidden` (unchanged fail-closed); existing 503 row kept | 5xx → retry |
| **Δ3** › `meErrorView`: `ApiAccessError("forbidden")` → noAccess forbidden; `("member_deactivated")` → noAccess member_deactivated; `("org_required")` → noOrg; `("unauthenticated")` → signedOut `no_access`; `("signed_out")` → signIn; `{code:"session_invalid"}` → signIn relist; `{code:"network"}` → retry; `new TypeError()` → retry; `"x"` / `null` → retry | AC1, AC3b |
| `src/ui/auth/views.test.tsx` › source-plan rows: SignInView fields, one "Continue as <email>" per account, no sign-up/forgot links without hrefs, Turnstile slot only when required; JoinView button text; NoOrgView has sign-out; NoAccessView "You don't have permission"; UnverifiedView Check again + Use another account | AC1, AC3b, AC7 |
| **Δ4** › SignInView with `email="an@example.invalid"` and error `invalid_credentials`: the `role="alert"` text equals `authErrorMessage({code:"invalid_credentials"})` and does not contain the address | AC7 |
| **Δ3** › RetryView: one "Try again" button, no sign-out text | AC1 |
| **Δ1** › AuthLayout markup has `px-frame`, `px-strip` and the scene slot; SignInScene is `aria-hidden="true"`, has no text content and no `<img`; any `<img` in any view has an `alt` attribute | D52, a11y |
| **Δ2** `src/ui/auth/runtime.test.ts` › `readFileSync("src/ui/auth/runtime.ts")` contains `process.env.NEXT_PUBLIC_MM_IDENTITY_BASE`, `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `process.env.NODE_ENV === "production"`; does not match `/process\.env\[/` or `/\{[^}]*\}\s*=\s*process\.env/` | build-time inlining |
| **Δ5** `src/ui/copy/auth.test.ts` › `authErrorMessage` returns a non-empty string for every `AuthErrorCode` (list from `types.ts:2-22`); `invalid_credentials` text does not match `/exist\|found\|registered\|account/i`; `rateLimited(wait)` contains the wait text | D36, AC7 |
| **Δ5** › `apiErrorMessage` covers every `API_ERROR_CODES` entry; `forbidden` is exactly "You don't have permission" | AC3b |
| `src/ui/copy/no-literals.test.ts` (SIM-022, unchanged) › passes over the new `src/ui/auth/*.tsx` and `src/app/sign-in/page.tsx` | D36 |
| `src/ui/copy/copy.test.ts` (unchanged) › the glob now also checks `authCopy` / `apiCopy` strings (NFC, no `"??"`), and the no-diacritics rule covers the new files | D36 |

## Approach
Steps 7-9 of the source plan (copy, views and gate, wiring) apply as written, with these additions:

1. **Δ1 Pixel frame (CSS only).**
   - `.px-frame` draws a 2 px stepped border in `var(--px-outline)` from a multi-step `box-shadow` (no `border-radius`)
     around the kit `Card`. The Card's own radius is overridden to `rounded-none` inside the frame.
   - `.px-strip` is a 12 px band at the top of the frame in `--px-accent`, with a 2 px `--px-outline` bottom line. It is
     decoration only: no text on it, so no text-contrast rule applies.
   - `AuthLayout` uses a two-column grid from `md` up: `SignInScene` on the left, the framed card on the right. Below
     `md` the scene is `hidden`, so the form comes first.
   - The title stays in the kit heading font (Q1). Inputs, buttons, links and messages are unchanged kit components.
     Focus rings come from `globals.css:327-331` and stay visible, because the frame sits outside the card's padding.
   - `.px-scene` is a fixed aspect box (12 × 7 tiles, rendered at an integer scale of 32 px tiles) filled with a
     palette floor and wall band from CSS gradients with hard stops (style guide: flat tones, no smoothing). No
     animation, so `prefers-reduced-motion` needs nothing (the global rule at `globals.css:334-342` also covers it).
   - **Swap rule for SIM-024:** only `SignInScene.tsx` (and `.px-scene`) change when `scene.signin` exists. The future
     `<img>` must use `alt` from copy or be `alt=""` with a `// copy-ok: decorative` comment, because
     `no-literals.test.ts:8,10` flags `alt=""`. S2 avoids this by rendering no `<img>`.
2. **Δ2 `runtime.ts`.**
   ```ts
   const production = process.env.NODE_ENV === "production";
   const baseUrl = identityBaseFrom(process.env.NEXT_PUBLIC_MM_IDENTITY_BASE, production);
   const turnstileSiteKey = turnstileSiteKeyFrom(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, production);
   ```
   The three reads sit inside `getAuthRuntime()` (lazy, so SSR never builds a store). The functions are from
   `@/lib/identity/config` (`config.ts:14-22`). There is no helper, no `process.env[...]` and no destructuring. `next
   build` sets `NODE_ENV=production`, so built bundles always use the constants. `apiFetch` = `createApiFetch({ getToken:
   store.getToken, onAuthLost })`. `onAuthLost` is set by the mounted gate through a small `setAuthLostHandler`.
3. **Δ3 `/api/me` mapping (pure, in `flow.ts`).**
   - `viewForMe`: replace `if (result.status === 503)` with `if (result.status >= 500)`, keeping the `retry` error
     `{ code: "unknown" }`.
   - `meErrorView(err: unknown, hasAccount: boolean): GateView | MeView`:
     - `err instanceof ApiAccessError` (import from `@/lib/api/fetch`, lib → lib): `signed_out` → `{kind:"signIn"}`;
       `unauthenticated` → `viewForMe({status:401})`; else `viewForMe({status:403, code: err.code})`.
     - An `AuthError`-shaped object (string `code`, from `getToken`) → `viewForTokenError(err, hasAccount)`.
     - Anything else (TypeError, AbortError) → `viewForMe({ network: true })`.
   - `AuthGate` uses `try { res = await apiFetch("/api/me"); view = viewForMe(await toMeResult(res)) } catch (e) { view
     = meErrorView(e, hasAccount) }`. `RetryView`'s button re-runs the same check without signing out (AUT-02).
4. **Δ4/Δ5 Copy.**
   - `authCopy.errors.invalid_credentials = "Email or password is incorrect."`. It is the same text for every account, and
     the view never interpolates the email into it.
   - `apiCopy.errors` gives every `ApiErrorCode` a message. Room codes get short generic texts ("This room code is
     already used.", "This room still has seats or people."); SIM-010.2 may refine them.
   - No string contains `"??"`; write "Forgot password" without "?" anyway.
   - Views import `../copy/auth` relatively; the page imports `@/ui/copy/auth`.
   - Expected `copy-ok` escapes: none.
5. **Rules.**
   - R1: lib files import lib only (`flow.ts` → `@/lib/api/fetch`). `src/ui/auth/**` → lib, ui. The page → ui, lib.
     `pnpm check:layers`.
   - R3: only public values; env names via Ming step 1.
   - R4: no org picker, no account pages, no `next.config.ts`/CSP, no `apiFetch` change.
   - R5: tests above.
   - R6: the client never sends an org id.

## Specialist input used
`consult-frontend-developer.md` (2026-11-20, SIM-006.2):
- Rec. 1 (thin CSS pixel frame, `--px-*` variables, kit forms): adopted (Δ1). One addition: a dark-theme value for
  `--px-outline`, because `#2a3140` on the dark surface `#161616` is far below 3:1.
- Rec. 2 (swappable `SignInScene`): adopted, with one change. S2 renders **no `<img>`** (the asset does not exist, so
  a 404 would follow, and `alt=""` trips `no-literals.test.ts`). SIM-024 swaps the body.
- Rec. 3 (a11y): adopted: art `aria-hidden`, `role="alert"`, labelled Turnstile, focus rings, no motion. The pixel font
  is not added (Q1).
- Rec. 4 (props-only views, pure mapping): adopted. `meErrorView` is the extracted mapping.
- Rec. 5 (literal env reads): adopted, plus a source-text guard test (Δ2).
- Rec. 6 (5xx → RetryView): adopted (Δ3), as a row of AC1 (consult Q5 default).
- Rec. 7 (Turnstile): adopted as in the source plan.
- Rec. 8 (Ming-owned env names): adopted (Ming step 1).
- Rec. 9 (no High path, no `next.config.ts`): adopted.
- Risk "runtime CSP": not in S2 (Δ7, Q2).

## Assumptions
- **A1-A5, A8, A11 of the source plan hold.** In particular, before SIM-007 a successful sign-in ends on
  `NoOrgView` (403 `org_required`).
- **A16 (Δ1).** All gate views share `AuthLayout` (frame + scene), since they are all the sign-in surface (D52). S3
  account pages will reuse `AuthLayout`. They are not listed in D52, but they belong to the same flow. S3 can pass
  `scene={false}` if Ming prefers the clean kit there.
- **A17 (Δ3).** Statuses other than 200/401/403/5xx (e.g. 404, 429 from a proxy) stay fail-closed as "no permission",
  as S1 decided. Only server faults become "Try again".
- **A18.** The Turnstile script (`challenges.cloudflare.com`) runs on the simap origin, where the in-memory token
  lives. This is the same trust as tudocuatui. It is noted for the CSP ticket (Q2).
- **A19 (not in S2).** security-review 💭1 (`redirect: "error"` in `apiFetch`) and 💭2 (the 401/403-after-side-effect
  rule) are S1 notes and are not fixed on main (`fetch.ts:52`). They stay out of S2 (R4). The orchestrator should make
  sure a `debt` issue exists for each.
- **A20 (hotspots).**
  - `src/ui/index.ts`, `src/ui/copy/*` and `src/app/globals.css` may also be edited by SIM-019 (PLANNING, same batch,
    audit-log screen).
  - `src/app/(app)/layout.tsx`, `src/lib/session.ts` and `src/ui/index.ts` will be edited by SIM-007 and SIM-010.2
    (BACKLOG, depend on this ticket).
  - `src/lib/identity/flow.ts` is also edited by SIM-006.3 (BACKLOG).
  - Expect a small rebase if SIM-019 merges first. The edits are appends.
- **A21.** Size: about 800 changed lines (the source plan's ~700 plus ~100 for Δ1-Δ5). It stays one slice, as the
  approved split did.

## Questions with defaults (non-blocking, for the batch approval round)
1. **Pixel font for headings.** Default: **none in S2** (kit heading font inside the pixel frame). Revisit when SIM-024
   art lands; a font then needs a licence row in `assets/art/CREDITS.md`. Alternative: one local woff2 pixel font for the
   card title only.
2. **Runtime CSP.** Default: **not in S2**. The orchestrator opens a `debt` issue (`project:simap`) for a CSP ticket
   (nonce via `src/proxy.ts`, allow `challenges.cloudflare.com` and the Identity origin), due before SIM-021 go-live.
   Alternative: add it to SIM-006.3, which is High anyway because of `next.config.ts`.
3. **Pixel frame on every gate view.** Default: **yes** (A16). Alternative: frame and scene only on `SignInView` and
   `JoinView`, with the clean kit on the status views (no org, no access, retry).

## Blocking questions
None.

## Split proposal
None. This ticket is already slice S2 of the approved SIM-006 split.
