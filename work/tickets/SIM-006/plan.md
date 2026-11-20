Status: READY

# Plan — SIM-006: Browser sign-in with mmlabs Identity

Revision 2 (2026-11-20). This revision applies Ming's Q16 answer (ticket.md Notes): "simap hosts its own sign-up and
forgot-password pages, as ricotdin does, calling the same org-admin-api auth endpoints". It also plans the work in
three slices (Split proposal, Q0): **S1 = SIM-006** (auth library), **S2 = SIM-006.2** (sign-in gate UI), **S3 =
SIM-006.3** (sign-up, verify-email, forgot-password, reset-password pages). Each slice has its own files, tests and
ACs below. The design decisions of revision 1 still hold unless a section says otherwise.

## Scope summary
From `docs/spec-v1.md`:

- §3 Auth (D4): "The browser signs in through `/api/v1/auth/login`, lists accounts (`/auth/accounts`), joins
  (`/auth/apps/simap/join`), lists its orgs (`/auth/orgs`), and gets an access token from `/auth/token` with
  `audience: "simap"` and the chosen `org_id`. The token lives in memory only (never in a cookie or `localStorage`;
  it can be ~5 KB) and is renewed before `exp`." (Org listing and `org_id` belong to SIM-007; see A3.)
- AUT-01: "The sign-in page signs in against Identity (email + password at Identity). simap never sees or stores a
  password." / "An Identity account that has not joined app `simap` gets the join step (`/auth/apps/simap/join`) when
  the app's join policy allows it. The join runs only after the user clicks" / "Wrong credentials show a clear message.
  No message reveals whether the email exists." / "Sign-out calls Identity `/auth/logout` and drops the access token.
  The next request to a protected page or API is refused." / line 164: "simap has no sign-up form of its own. The
  sign-in page links to Identity's sign-up and forgot-password flows and lists accounts already signed in on this
  browser as "Continue as <email>" (`/auth/accounts`) (D33)." **Superseded by Ming's Q16 answer** (see A12).
- AUT-02: "A signed-in user stays signed in across page loads and tabs until the Identity session ends. The access
  token is renewed before it expires." / "If the JWKS is unavailable the answer is 503, so the client keeps the session
  instead of signing out." / "The token is kept in browser memory and sent as a bearer header (D4). It is never put in
  a cookie, in `localStorage` or in a URL, and never logged. Several tabs stay in step (tudocuatui refresh lock +
  channel)." / "After a 403 from simap the client re-mints the token once and retries; a second 403 shows "no
  permission" (D7)."
- SHL-01: shell has "refresh permissions" and sign-out.

From `work/decisions.md`: D4 (token in browser memory, bearer to route handlers; reuse the tudocuatui token store), D7
("client re-mints after a 403 and on org switch"), D33 (sign-in links + "continue as"; its link targets are replaced by
Q16), D36/D40 (English copy in copy files).

From ticket.md Notes (Q16, 2026-11-20): "simap hosts its own sign-up and forgot-password pages, as ricotdin does,
calling the same org-admin-api auth endpoints (replaces the D33 'link to Identity flows' reading)."

Identity contract (`org-admin-api/docs/consumers.md`):
- Credentials modes, lines 39-45: `credentials: "include"` for login, `/token`, `/accounts`, `/apps/{key}/join`,
  `/logout`, `/verify-email/resend`. `credentials: "omit"` for "signup, forgot, verify-email and reset".
- Local dev: "same host name on both sides", lines 56-61.
- Token errors table, lines 144-153. Join sequence and codes, lines 340-389.
- Sign-up, lines 220-225: "**requires** `X-MM-App` and a browser `Origin` registered for that app … Call it from the
  browser with `credentials: "omit"` … The link points at the page origin that made the request".
- Lines 231-236: "Link format (fixed for every app): `{origin}/verify-email#token=<43 chars>`. **Every registered origin
  of an app must serve `/verify-email` and `/reset-password`** … The page: 1. reads `location.hash`, then removes it at
  once (`history.replaceState(null, "", "/verify-email")`); 2. is served with `Referrer-Policy: no-referrer`;"
  verify-email is a "public endpoint: no cookie or `X-MM-App` needed". Codes: 204, 422 `token_invalid`, 422
  `validation_error`, 429 `rate_limited` (lines 251-256).
- Resend, lines 258-267: cookie class, `{account_id}`. Codes: 202, 401 `session_invalid`, 409
  `email_already_verified`, 429.
- Forgot, lines 271-284: `{email, turnstile_token}`, "**requires** `X-MM-App`", `credentials: "omit"`, Turnstile always
  required. "The answer is **202 for every email** … the page must always say "if an account exists for this address,
  we sent a link"". Codes: 403 `turnstile_failed`, 422 `validation_error`, 429.
- Reset, lines 286-319: `{origin}/reset-password#token=…`, "works once and expires after **30 minutes**", same
  hash/referrer rules, body `{token, new_password}`, `credentials: "omit"`, no `X-MM-App`. Codes: 204, 422
  `weak_password` (`details.reasons`: `too_short`, `too_common`), 422 `token_invalid`, 422 `validation_error`, 429. "A
  reset ends every signed-in session of the account … the next `/token` for it answers 401 `session_invalid`".
- Sign-up codes, from org-admin-api `app/modules/auth/errors.py` lines 7 and 12 and `router.py` line 74: 409
  `email_taken`, 422 `weak_password`, 403, 422, 429.

Reference implementations (read-only):
- tudocuatui `src/features/auth/*` (same React and tooling family). This is the port source for the library, the
  views, `SignUpScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`/`Page` and `VerifyEmailScreen`/`Page`.
- ricotdin `app/web/src/routes/auth/{RegisterPage,ForgotPasswordPage,ResendForm,VerifyEmailPage,ResetPasswordPage}.tsx`,
  `src/auth/emailLink.ts` (`readHashToken`, `forgetHashToken`) and `src/auth/authErrors.ts` (`publicAuthErrorKey`).
  These are the behaviour reference Ming named: separate routes; verify only after a click; strip the hash before any
  call; neutral forgot answer; on an invalid link, offer sign-in or a new link.

## Acceptance criteria → verification

The ticket's ACs 1-5 are split across the slices. AC6-AC11 are new; they come from Q16 and consumers.md (quoted
above).

### S1 — SIM-006: auth library

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 2 | Token only in memory (not cookie, `localStorage`, URL); renewed before `exp`; two tabs share one renewal. | `tokenStore.test.ts › never writes anything but mm_account_id; no history or console use`, `› caches until receivedAt + (expires_in - 60) s`, `› caches a 12-hour token until expires_in - 60 s`; `tabs.test.ts › two tabs renewing at once -> one /token, both return the same token`, `› tab B waiting on the lock adopts A's broadcast…`, `› hidden tab skips the timer and renews on visibilitychange`; `fetch.test.ts › refuses a path outside /api/ and never puts the token in the URL`. Grep: no `sessionStorage`, `document.cookie` or `console.*` in `src/ui/auth/**` / `src/lib/api/fetch.ts`. |
| 3a | Retry rule: a 403 from simap triggers one re-mint and one retry; a second 403 ends in a `forbidden` access error. | `fetch.test.ts › 403 forbidden → getToken(rejected) once, one retry, 200 returned`, `› 403 then 403 → one retry only, throws ApiAccessError forbidden`, `› 403 org_required is not retried`. |
| 4a | Sign-out in the store ends the session in this tab and tells other tabs. | `tokenStore.test.ts › signOut broadcasts signedOut before /logout…`, `› clears the id, then calls logout with it; getToken is null at once`; `tabs.test.ts › sign-out in A signs out B (memory, storage, listener), no /logout from B` and the BUG-007 cases. |
| 5 | Unit tests cover token renewal timing, error-code → screen mapping and the retry rule. | `pnpm test` green with `tokenStore.test.ts` + `tabs.test.ts` (timing), `flow.test.ts` + `errors.test.ts` (mapping), `fetch.test.ts` (retry rule). |
| 6 | The Identity client uses the contract's credentials mode and app header for all ten calls. | `identityClient.test.ts › credentials and X-MM-App per call` table: login, token, accounts, join, logout, resend → `include` + `X-MM-App: simap`; signup, forgot → `omit` + `X-MM-App: simap`; verify-email, reset → `omit`, no `X-MM-App`. |
| — | S1 builds alone | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` green with no UI or page change. |

### S2 — SIM-006.2: sign-in gate UI

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A signed-out visit to any app page shows the sign-in page; after sign-in the user lands back on the page. | Structural check: `src/app/(app)/layout.tsx` wraps every app page in `AuthGate`. The gate renders the sign-in view **in place** (no redirect, URL unchanged) and renders `children` once `ready`. Tests: `flow.test.ts › restore without an account id → signIn` (S1), `flow.test.ts › /api/me 200 → ready with session` (S1), `views.test.tsx › SignInView renders form and Continue as list`. `/sign-in?returnTo=`: `return-to.test.ts`. Local run without Identity: `pnpm dev`, open `/rooms`; the sign-in view shows at `/rooms`. |
| 3b | A second 403 shows "You don't have permission". | `views.test.tsx › NoAccessView shows "You don't have permission"`; `copy.test.ts › apiErrorMessage("forbidden") is "You don't have permission"`. The gate maps `ApiAccessError("forbidden")` to `NoAccessView` (code review of `AuthGate.tsx`). |
| 4b | Sign-out ends the session in this tab and in other tabs (UI). | Code review of `AuthGate.tsx`: `onRemoteSignOut` and the store subscriber move to the sign-in view; shell sign-out calls `store.signOut()`. S1 tests cover the store side. |
| 7 | Sign-in page features: Turnstile when asked; "Continue as <email>"; join only on click; the invalid-credentials message does not reveal whether the email exists. | `views.test.tsx › SignInView: Turnstile slot only when required`, `› invalid_credentials message does not mention the email`, `› JoinView button text`; `flow.test.ts` join rows (S1). |
| — | Loop checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` green. |

### S3 — SIM-006.3: account pages

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 8 | simap serves `/sign-up`, `/forgot-password`, `/verify-email` and `/reset-password`. They are outside the gate, and the sign-in view links to sign-up and forgot-password. | `pnpm build` route list shows the four routes. `views.test.tsx › SignInView links to /sign-up and /forgot-password`. Local run: open each route signed out; none shows the sign-in gate. |
| 9 | Email-link tokens never reach a server, log or history. The fragment is read once and removed (`replaceState`) before any network call. The pages send `Referrer-Policy: no-referrer`. | `email-link.test.ts › readLinkToken accepts #token=<32-128 url-safe>, rejects others`; `email-link.test.ts › takeLinkToken strips the hash before returning, keeps no state` (fake `history`/`location`); `next-config.test.ts › /verify-email and /reset-password send Referrer-Policy: no-referrer`. Code review: `verifyEmail`/`resetPassword` post the token only in the JSON body (S1 `identityClient.test.ts`). |
| 10 | Forgot password always answers "If an account exists for this address, we sent a link". Sign-up ends on "check your inbox". | `email-flows.test.ts › forgotOutcome(202) → sent`; `views.test.tsx › ForgotPasswordView sent state shows the neutral text`, `› SignUpView sent state shows the address and a sign-in link`. |
| 11 | Error mapping for the public flows follows consumers.md: `token_invalid` → invalid link with sign-in (verify) or a "new link" action (reset); `weak_password` reasons shown and the link still usable; `turnstile_failed` → Turnstile reset; `email_taken` → own message; 429 → wait text. | `email-flows.test.ts` tables for `signUpOutcome`, `forgotOutcome`, `verifyOutcome`, `resetOutcome`; `copy.test.ts › authErrorMessage covers every AuthErrorCode`. |
| 12 | Verification runs only after a click (mail scanners do not verify). The unverified view of the gate offers "Resend email". | `views.test.tsx › VerifyEmailView ready state has a Verify button and makes no call` (props-only view); code review of `VerifyEmailPage.tsx` (no effect posts the token); `views.test.tsx › UnverifiedView shows Resend, Check again, Use another account`. |
| — | Loop checks | Same four checks green. |

## Ming verification after merge
Needs M-1 (the Identity app `simap` registered with the local dev origin) and the Ming steps below.

After S2:
- Sign in with email + password on `http://localhost:3000/rooms` against a local Identity on `http://localhost:8000`
  (same host name on both sides, consumers.md 56-61). The URL stays `/rooms`. Before SIM-007 the token carries no
  `org`, so a successful sign-in ends on "No organization selected yet" (A3). Landing on the page content is
  re-checked after SIM-007.
- "Continue as <email>" appears for an account already signed in on this browser. The join step appears for an
  account that has not joined `simap`, and the join runs only on click.
- Two tabs: reload one, both stay signed in. Sign out in one, the other shows the sign-in view.
- Turnstile appears after Identity answers `turnstile_required` (needs Ming step 2).
- DevTools → Application: `localStorage` holds only `mm_account_id`. No token in cookies, storage or the URL.

After S3 (local Identity must send mail to a dev inbox or log the link):
- Sign up a new address. The verification email links to `http://localhost:3000/verify-email#token=…`. Opening it
  removes the fragment from the address bar at once. "Verify" confirms. Signing in then reaches the join step.
- Before verifying, sign in: the unverified view offers "Resend email", and a second link arrives.
- Forgot password with a registered and an unregistered address: both show the same neutral text. The reset link
  opens `/reset-password`, the fragment disappears, a weak password shows its reason, and a good one ends on "Password
  changed". The old session in another tab is signed out on its next renewal.
- DevTools → Network on `/verify-email` and `/reset-password`: response header `Referrer-Policy: no-referrer`.

Ming steps (agents cannot do them):
1. Add the public names (no values) to `.env.example`; agents are denied that file. The names are
   `NEXT_PUBLIC_MM_IDENTITY_BASE=` (dev only, for example a local Identity at `http://localhost:8000/api/v1`; ignored in
   production builds) and `NEXT_PUBLIC_TURNSTILE_SITE_KEY=` (dev-only override; ignored in production builds). Due
   with S2.
2. Turnstile: add `simap.mmlabs.online` and `localhost` to the allowed hostnames of the Turnstile widget whose public
   site key simap uses (default: the same widget as tudocuatui, Q2), or give a new public site key. Due with S2.
   Sign-up and forgot always need it.
3. Make sure the Identity app `simap` registers both the production origin and the dev origin (M-1). Email links
   point at the calling page's origin (consumers.md 225).
4. Record Q16 as a decision in `work/decisions.md` and update spec AUT-01 line 164 and §Out of scope line 489 (A12).

## Files to create / modify
New code is a port of tudocuatui `src/features/auth/*` unless marked "new". Paths are relative to the repo root.

### S1 — SIM-006 (library; builds and tests alone, nothing imports it yet)

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/types.ts` | new: `AuthErrorCode`, `AuthError`, `AccountChoice`, `Credentials` (port of tudocuatui `types.ts` lines 4-41; codes in Approach 2; view prop types stay in the views) | shared types for lib + ui | no |
| `src/lib/identity/errors.ts` | port `errors.ts` (`SERVER_AUTH_ERROR_CODES`, `toAuthError`, `networkError`); add `join_rejected`, `join_queue_full`; drop `join_approval_unavailable` | normalise Identity error bodies | no |
| `src/lib/identity/config.ts` | new: `APP_KEY = "simap"`, `AUTH_LOCK_NAME = "simap-auth-refresh"`, `AUTH_CHANNEL_NAME = "simap-auth"`, `IDENTITY_BASE_PROD = "https://api.mmlabs.online/api/v1"`, `TURNSTILE_SITE_KEY_PROD` (Q2), pure `identityBaseFrom(raw, production)` / `turnstileSiteKeyFrom(raw, production)`. `SIGN_UP_URL` / `FORGOT_PASSWORD_URL` from rev 1 are **dropped** (Q16: in-app routes). | public client config: dev override, prod fixed (R3) | **yes** (`**/config.*`) |
| `src/lib/identity/flow.ts` | new: pure `viewForTokenError(err, hasAccount)`, `viewForMe(result)`, `initialView(hasAccountId)` (decision logic of tudocuatui `AuthGate.tsx` `failTo`/`canJoin`, lines 128-174, plus the `/api/me` outcomes) | AC5 mapping, testable without a DOM | no |
| `src/lib/validate/credentials.ts` | port all of tudocuatui `validation.ts` (`emailError`, `passwordError`, `signInPasswordError`, `confirmError`, `validateSignIn`, `validateSignUp`, `validateNewPassword`, `PASSWORD_MIN = 6`, `PASSWORD_MAX = 128`, `EMAIL_MAX = 254`). `parseVerifyToken` moves to S3 `email-link.ts`. | form validation for S2 and S3 (validators live in `src/lib/validate/`) | no |
| `src/lib/api/fetch.ts` | new: `createApiFetch({ getToken, fetchFn, onAuthLost })`, `ApiAccessError` | AC3 retry rule; one bearer path for all UI data calls | no |
| `src/ui/auth/accountId.ts` | port verbatim (`mm_account_id`) | device session continuity | no |
| `src/ui/auth/refreshLock.ts` | port verbatim; imports `AUTH_LOCK_NAME` from `@/lib/identity/config` | cross-tab renewal lock | no |
| `src/ui/auth/authChannel.ts` | port verbatim; imports `AUTH_CHANNEL_NAME` | cross-tab token + signedOut | no |
| `src/ui/auth/identityClient.ts` | port all ten calls (`login`, `token`, `logout`, `accounts`, `join`, `signup`, `verifyEmail`, `forgotPassword`, `resetPassword`, `resendVerification`). Change 1: `post(path, body, mode)` with `mode: "cookie" \| "app" \| "public"` replaces tudocuatui's boolean (A13). Change 2: `join` returns `"member" \| "pending"`. | Identity calls with the contract's credentials modes (AC6) | no |
| `src/ui/auth/tokenStore.ts` | port; add `renewNow()` (forces a re-mint, for "refresh permissions"); `join()` returns `"joined" \| "pending" \| "stale"` | AC2, AC4a | no |
| `src/ui/auth/fakeTabs.ts` | port verbatim (test-only helper) | tests for AC2/AC4a | no |
| Tests (S1 rows of Tests to write) | new | R5 | no |

### S2 — SIM-006.2 (sign-in gate UI; depends on S1)

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/return-to.ts` | new: `safeReturnTo(raw): string` | `/sign-in?returnTo=` without open redirect | no |
| `src/lib/format.ts` | add `waitText(seconds)` (English "30 seconds" / "2 minutes" / "1 hour") | `rate_limited` copy | no |
| `src/lib/session.ts` | `orgName` becomes optional (`orgName?: string`) | `/api/me` has no org name until SIM-007 | no |
| `src/ui/auth/turnstile.ts`, `src/ui/auth/TurnstileWidget.tsx` | port; the widget takes a `siteKey` prop and a `resetKey` (re-render after a used token, as ricotdin `RegisterPage` line 60) | "Turnstile when asked"; S3 reuses it | no |
| `src/ui/auth/runtime.ts` | new `"use client"`: lazy singleton `getAuthRuntime()` → `{ client, store, apiFetch, turnstileSiteKey }`. Reads `process.env.NEXT_PUBLIC_MM_IDENTITY_BASE` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `NODE_ENV` through the lib config functions. | one store per page load, shared by `(app)`, `/sign-in` and the S3 pages | no |
| `src/ui/auth/AuthLayout.tsx` | new (simap kit `Card`): centred card with a title, used by every auth view | consistent auth screens | no |
| `src/ui/auth/views.tsx` | new presentational views: `SignInView`, `JoinView`, `UnverifiedView`, `NoOrgView`, `NoAccessView`, `RetryView`, `CheckingView` (props only, no effects; built from `Card`, `Button`, `FilledInput`, `Icon`). `SignInView` takes optional `signUpHref` / `forgotHref` and renders those links only when set; S2 passes none. | AC1, AC3b, AC7 | no |
| `src/ui/auth/AuthGate.tsx` | new `"use client"` container. The state machine is adapted from tudocuatui `AuthGate.tsx`, with the sign-up/forgot/verify/reset screens moved to S3 routes. It provides `SessionProvider` + `ApiFetchProvider` and renders `children` only when ready. | AC1, AC4b, shell wiring | no |
| `src/ui/auth/api-fetch-context.tsx` | new: `ApiFetchProvider`, `useApiFetch()` | "an `apiFetch` used by all UI data calls" | no |
| `src/ui/auth/SignInRoute.tsx` | new `"use client"`: `AuthGate` that calls `router.replace(returnTo)` once ready | `/sign-in` deep link | no |
| `src/ui/copy/auth.ts` | new: `authCopy` (English), `authErrorMessage(err)`, `apiErrorMessage(code)` | D36; SIM-022 convention | no |
| `src/ui/copy/copy.test.ts` | add `authCopy` to the string checks; new mapping cases | D36, AC3b | no |
| `src/ui/index.ts` | export `AuthGate`, `SignInRoute`, `useApiFetch` | pages import `@/ui` | no |
| `src/app/(app)/layout.tsx` | replace `SessionProvider value={null}` with `<AuthGate><AppShell>{children}</AppShell></AuthGate>` | wire the SIM-003 session context to the real store | no |
| `src/app/sign-in/page.tsx` | new: reads `searchParams.returnTo` (async in Next 16), applies `safeReturnTo`, renders `<SignInRoute returnTo=… />` | ticket "`src/app/sign-in/*`" | no |
| Tests (S2 rows) | new / extended | R5 | no |

### S3 — SIM-006.3 (account pages; depends on S2)

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/email-link.ts` | new: `readLinkToken(hash)` (= tudocuatui `parseVerifyToken`, `^#token=([A-Za-z0-9_-]{32,128})$`) and `takeLinkToken({ location, history }, path)`, which reads the hash, then `history.replaceState(null, "", path)` **before** returning (ricotdin `emailLink.ts`; consumers.md 235, 290). The deps are injected, so the module is pure. | AC9 | no |
| `src/lib/identity/email-flows.ts` | new, pure: `signUpOutcome`, `forgotOutcome`, `verifyOutcome`, `resetOutcome` map an `AuthError` (or success) to the next view state + error (logic of ricotdin `publicAuthErrorKey` and tudocuatui `ResetPasswordPage`/`VerifyEmailPage`, with consumers.md codes) | AC10, AC11 | no |
| `src/ui/auth/account-views.tsx` | new presentational views ported from tudocuatui `SignUpScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`, `VerifyEmailScreen`: `SignUpView`, `ForgotPasswordView`, `ResetPasswordView`, `VerifyEmailView` (props only) | AC8, AC10-12 | no |
| `src/ui/auth/SignUpPage.tsx` | new `"use client"` container: validate (`validateSignUp`), Turnstile always, `client.signup`, sent state, Turnstile reset after each attempt | AC8, AC10 | no |
| `src/ui/auth/ForgotPasswordPage.tsx` | new `"use client"`: validate email, Turnstile always, `client.forgotPassword`, neutral sent state | AC8, AC10 | no |
| `src/ui/auth/VerifyEmailPage.tsx` | new `"use client"`: on mount `takeLinkToken(window, "/verify-email")`. The token is held in a ref, and `client.verifyEmail` is called only from the button. A single-use guard prevents a double post (ricotdin line 30). "Continue" links to `/`. | AC9, AC12 | no |
| `src/ui/auth/ResetPasswordPage.tsx` | new `"use client"`: on mount `takeLinkToken(window, "/reset-password")`. Form with `validateNewPassword`, then `client.resetPassword`. Done → link to `/sign-in`. Invalid → link to `/forgot-password`. | AC9, AC11 | no |
| `src/ui/auth/views.tsx` | `UnverifiedView` gains "Resend email" + sent/rate-limited state | AC12 | no |
| `src/ui/auth/AuthGate.tsx` | pass `signUpHref="/sign-up"`, `forgotHref="/forgot-password"` to `SignInView`; the unverified state calls `client.resendVerification(accountId)` (409 `email_already_verified` → re-check, consumers.md 266) | AC8, AC12 | no |
| `src/ui/copy/auth.ts` | add the sign-up / forgot / verify / reset / resend strings and messages for `email_taken`, `weak_password` (+ reasons), `token_invalid`, `email_already_verified` | D36 | no |
| `src/ui/index.ts` | export the four page containers | pages import `@/ui` | no |
| `src/app/sign-up/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/verify-email/page.tsx`, `src/app/reset-password/page.tsx` | new thin pages (`metadata.title`, render the container) **outside** `(app)` so they are not gated | AC8; consumers.md 231-232 | no |
| `next.config.ts` | add `headers()` → `Referrer-Policy: no-referrer` for `/verify-email` and `/reset-password` | consumers.md 236, 291 | **yes** (`next.config.*`) |
| Tests (S3 rows) | new / extended | R5 | no |

Not touched by any slice: `src/server/**`, `src/app/api/**` (no new route), `.env.example` (Ming step 1), `Dockerfile`.

## Data model / migration
None.

## API contract
None (no simap endpoint change). Consumed:
- `GET /api/me` → `200 {sub, email, org, tier}` (shape locked by SIM-023), `401 unauthenticated`, `403 org_required |
  forbidden | member_deactivated`, `503 unavailable`, body `{error:{code}}` (`src/lib/api/error.ts`).
- Identity endpoints as in consumers.md (Scope summary). Credentials modes by call:

| Identity call | Path | `credentials` | `X-MM-App` | Slice using it |
|---|---|---|---|---|
| login | `POST /auth/login` | include | simap | S2 |
| token | `POST /auth/token` | include | simap | S1/S2 |
| accounts | `GET /auth/accounts` | include | simap | S2 |
| join | `POST /auth/apps/simap/join` | include | simap | S2 |
| logout | `POST /auth/logout` | include | simap | S2 |
| resend | `POST /auth/verify-email/resend` | include | simap | S3 |
| signup | `POST /auth/signup` | omit | simap | S3 |
| forgot | `POST /auth/password/forgot` | omit | simap | S3 |
| verify | `POST /auth/verify-email` | omit | — | S3 |
| reset | `POST /auth/password/reset` | omit | — | S3 |

## Tests to write

### S1
| Test (file › name) | Covers |
|---|---|
| `src/lib/api/fetch.test.ts` › attaches `Authorization: Bearer <t>` and `cache: "no-store"`; caller headers kept | bearer path |
| › refuses a path outside `/api/` (absolute URL, `//host`, `api/x`) and never puts the token in the URL | AC2 |
| › signed out (`getToken` → null) throws `ApiAccessError("signed_out")` and sends nothing | AC1 support |
| › 401 → `getToken(rejected)` once, one retry, 200 returned | D7 |
| › 403 `forbidden` → one re-mint, one retry, 200 returned | AC3a |
| › 403 then 403 → exactly one retry, throws `ApiAccessError("forbidden")` | AC3a |
| › 403 `member_deactivated` twice → `ApiAccessError("member_deactivated")` | AC3a |
| › 403 `org_required` is not retried → `ApiAccessError("org_required")` | A3 |
| › 401 after the retry → `onAuthLost()` once, throws `ApiAccessError("unauthenticated")` | auth lost |
| › 403 with unknown or unreadable body → treated as `forbidden` | fail closed |
| › 503, 500 and network `TypeError` are returned / rethrown unchanged, no re-mint, no `onAuthLost` | AUT-02 JWKS rule |
| › `getToken` rejecting (`session_invalid`) propagates; no request retried | sign-out on `session_invalid` |
| › a `ReadableStream` body is never retried (throws the access error); string/FormData bodies are resent | safe retry |
| `src/lib/identity/flow.test.ts` › `viewForTokenError` table: `not_member`+`joinAvailable`+account → join; `not_member` without → signIn with error; `email_unverified`+account → unverified; `session_invalid` → signIn (relist accounts); `network`/`rate_limited`/`unknown` → retry; `join_closed`/`join_rejected`/`join_queue_full`/`join_unavailable` → join view with error | AC5 |
| › `viewForMe`: 200 → ready with `{tier, email}`; `org_required` → noOrg; `forbidden`/`member_deactivated` → noAccess(code); `unauthenticated` → signedOut(`no_access`); 503/network → retry | AC5 |
| › `initialView`: without an account id → signIn; with an id → checking | AC1 support |
| `src/lib/identity/errors.test.ts` › port tudocuatui `errors.test.ts` (known codes, unknown → `unknown`, `Retry-After` header then `details.retry_after`, capped, `join_available` only when `true`, `reasons` only `too_short`/`too_common`, never throws, never copies server text) + `join_rejected`, `join_queue_full` accepted, `no_access` never accepted from a body | AC5 |
| `src/lib/identity/config.test.ts` › production ignores both overrides; dev accepts `http://localhost:<port>/api/v1` and `https://<host>/api/v1`; rejects `127.0.0.1`, userinfo, trailing junk, other paths → prod default; empty → prod default; Turnstile override only outside production | R3, AUT-02 |
| `src/lib/validate/credentials.test.ts` › port tudocuatui `validation.test.ts` minus the token cases (email trimmed/required/format/length; sign-in password required ≤ 128; new password 6..128 code points after NFKC; confirm mismatch) | form validation |
| `src/ui/auth/tokenStore.test.ts` › port all tudocuatui `tokenStore.test.ts` cases (getToken, signIn/restore, signOut/forget, continueAs, join/accountEmail, BUG-007), adapted to `join()` returning a status; new: `renewNow` re-mints even with a fresh token and broadcasts it; `join` 202 pending → `"pending"` and no `/token` call | AC2, AC4a, AC5 |
| `src/ui/auth/tabs.test.ts` › port all tudocuatui `tabs.test.ts` cases (two tabs, proactive renewal, BUG-007) | AC2, AC4a |
| `src/ui/auth/refreshLock.test.ts`, `authChannel.test.ts`, `accountId.test.ts` › port verbatim (`accountId` stubs `localStorage` with `vi.stubGlobal`; env is `node`) | fallbacks without Web Locks / BroadcastChannel |
| `src/ui/auth/identityClient.test.ts` › port all tudocuatui cases; new table `credentials and X-MM-App per call` (API contract table); token body `{audience:"simap", account_id}`; token response rejected unless `token_type` Bearer, `audience` simap, 1 ≤ `expires_in` ≤ 86400; join 200 → `member`, 202 → `pending`; verify/reset send the token only in the JSON body; network error → `{code:"network"}` | AC6, Identity contract |

### S2
| Test (file › name) | Covers |
|---|---|
| `src/lib/identity/return-to.test.ts` › `/rooms`, `/rooms/A1?tab=x` kept; `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:x`, `""`, `undefined`, string arrays, > 2048 chars, `/sign-in…` → `/` | open redirect |
| `src/lib/format.test.ts` › `waitText` seconds/minutes/hours, rounding up, NaN → generic | rate_limited copy |
| `src/ui/auth/views.test.tsx` (`renderToStaticMarkup`) › SignInView: email/password fields, one "Continue as <email>" per account, no sign-up/forgot links without hrefs, Turnstile slot only when required; `invalid_credentials` message does not mention whether the email exists; JoinView button text; NoOrgView has sign-out; NoAccessView shows "You don't have permission"; UnverifiedView shows Check again + Use another account | AC1, AC3b, AC7 |
| `src/ui/copy/copy.test.ts` › include `authCopy` in the string checks; `authErrorMessage` returns a non-empty string for every `AuthErrorCode`; `apiErrorMessage` covers every `ApiErrorCode`, and `forbidden` is exactly "You don't have permission" | D36, AC3b |
| `src/ui/copy/no-literals.test.ts` (SIM-022) › passes over the new `src/ui/auth/*.tsx` with no new `copy-ok` escapes | D36 |

### S3
| Test (file › name) | Covers |
|---|---|
| `src/lib/identity/email-link.test.ts` › `readLinkToken`: 43-char token accepted; 31 / 129 chars, `+`, `/`, `=`, extra params, missing `#`, `#token=` empty → null | AC9 |
| › `takeLinkToken` calls `replaceState(null, "", path)` exactly once, before returning, also when the token is invalid; no hash → no `replaceState` | AC9 |
| `src/lib/identity/email-flows.test.ts` › `signUpOutcome`: ok → sent; `email_taken` → form error; `weak_password` → password error with reasons; `turnstile_failed`/`turnstile_required` → reset Turnstile; `rate_limited` → wait; `network`/`unknown` → generic | AC10, AC11 |
| › `forgotOutcome`: ok → sent (neutral); `turnstile_failed` → reset Turnstile; `validation_error` → email error; `rate_limited` → wait | AC10 |
| › `verifyOutcome`: ok → verified; `token_invalid`/`validation_error` → invalid (no retry); `rate_limited` → rate_limited with seconds; `network`/`unknown` → ready with error (retry allowed) | AC11 |
| › `resetOutcome`: ok → done; `weak_password` → ready with reasons (link still usable); `token_invalid`/`validation_error` → invalid; `rate_limited` → ready with wait | AC11 |
| `src/ui/auth/account-views.test.tsx` (`renderToStaticMarkup`) › SignUpView: email, password, confirm, Turnstile slot always, sent state shows the address + sign-in link; ForgotPasswordView sent state shows exactly the neutral text; ResetPasswordView ready/done/invalid (invalid links to `/forgot-password`), weak reasons listed; VerifyEmailView ready shows a Verify button, verified links to `/`, invalid links to `/sign-in`; no view renders a token prop | AC8, AC10-12 |
| `src/ui/auth/views.test.tsx` › SignInView links to `/sign-up` and `/forgot-password` when hrefs are given; UnverifiedView shows Resend + sent / wait states | AC8, AC12 |
| `src/next-config.test.ts` (or `next.config.test.ts` at the root if Vitest's include allows it) › `await nextConfig.headers()` has `Referrer-Policy: no-referrer` for `/verify-email` and `/reset-password` and nothing else changed (`output`, `poweredByHeader`) | AC9 |
| `src/ui/copy/copy.test.ts` › new strings pass the NFC / no-"?" rules; `authErrorMessage` still covers every code incl. `email_taken`, `weak_password`, `token_invalid`, `email_already_verified` | D36 |

## Approach
Read the tudocuatui sources with `git -C D:\Projects\SAF\spaceM\projects\tudocuatui show origin/main:src/features/auth/<file>`
(see A7). Keep the port diff-able: same names, same comments, only the changes listed here. Each slice is one PR on
its own branch (`ticket/SIM-006`, `ticket/SIM-006.2`, `ticket/SIM-006.3`).

### S1 — library
1. **Config (`src/lib/identity/config.ts`).** Constants as in the file table. `identityBaseFrom(raw, production)`:
   - production → `IDENTITY_BASE_PROD`, always;
   - otherwise `raw` if it is exactly `https://<host>/api/v1` or `http://localhost:<port>/api/v1`;
   - else `IDENTITY_BASE_PROD`.

   The Turnstile key follows the same pattern (non-empty, `[0-9A-Za-z_-]{1,64}`). The production image passes no build
   args, so production always uses the constants (no Dockerfile change). R3: only public values; no secret.
2. **Types and errors.** Port `types.ts` / `errors.ts`.
   - Codes kept: `invalid_credentials`, `email_unverified`, `not_member`, `join_closed`, `join_rejected`,
     `join_queue_full`, `join_unavailable`, `session_invalid`, `turnstile_required`, `turnstile_failed`,
     `rate_limited`, `validation_error`, `email_taken`, `weak_password`, `token_invalid`, `email_already_verified`,
     `network`, `no_access` (client only), `unknown`. Rev 1 dropped the sign-up/reset/verify codes; Q16 brings them
     back.
   - Dropped: `join_approval_unavailable` (gone, consumers.md line 342).
3. **Browser adapters (`src/ui/auth/`).**
   - Port `accountId`, `refreshLock`, `authChannel` and `fakeTabs` verbatim (names from the lib config).
   - Port `identityClient` with all ten calls. Use the three-mode `post` (A13). `join` returns the status instead of
     throwing on 202.
   - Port `tokenStore` unchanged, except `join()` → `"joined" | "pending" | "stale"` (pending: no `/token`) and a new
     `renewNow()` = `getToken(currentToken)`.
   - These modules live in `ui`, not `lib`, because their defaults touch `localStorage`, `navigator.locks`,
     `BroadcastChannel` and `document`. All of these are injectable, so the tests run in Vitest's `node` env. Nothing
     imports them until S2, so S1 builds alone.
4. **`apiFetch` (`src/lib/api/fetch.ts`).** Pure factory; deps injected. Rule:
   - `input` must start with `/api/` (single slash), else throw (the bearer never goes to another origin).
   - `getToken()`; `null` → `ApiAccessError("signed_out")`.
   - Send with `Authorization: Bearer` and `cache: "no-store"`.
   - On 401, or a 403 whose code is not `org_required`: `getToken(rejected)` once and resend once (the body must not be
     a stream). SIM-005 `withAuth` rejects 401/403 before the handler runs, so resending a write is safe.
   - Final 401 → `onAuthLost()` + `ApiAccessError("unauthenticated")`. Final 403 → `ApiAccessError(code)` with the
     code from `API_ERROR_CODES`; an unknown code → `forbidden`.
   - Any other status is returned untouched; network errors propagate. No sign-out on 503 (AUT-02).
   - `getToken` rejecting with `session_invalid` propagates. `tokenStore` has already cleared the account and notified
     its subscribers.
   - Never logs; never reads `Authorization` back.
5. **Pure flow (`src/lib/identity/flow.ts`).** Move the decisions of tudocuatui `AuthGate` (`failTo`, `canJoin`) into
   `viewForTokenError`. Add `viewForMe` for the `/api/me` result.
6. **Validation.** Port `validation.ts` into `src/lib/validate/credentials.ts`. The two token parsers move to S3's
   `email-link.ts`, because they belong to the link pages.

### S2 — sign-in gate UI
7. **Copy (`src/ui/copy/auth.ts`).** `export const authCopy = {...} as const` (SIM-022 convention), English. Strings
   that take values are small functions (`continueAs(email)`, `rateLimited(wait)`, `signedInAs(email)`). Key strings:
   - `forbidden` → "You don't have permission"
   - `invalid_credentials` → "Email or password is incorrect."
   - `org_required` → "No organization selected yet"
   - join → "Join simap" / "Continue as <email>"
   - pending → "Your request to join simap is waiting for approval."
   - logout unconfirmed → a port of tudocuatui's text

   No string contains "?" (the `copy.test.ts` rule), so write "Forgot password" without a question mark. Components
   import `../copy/auth` relatively, with no JSX text literals (SIM-022 `no-literals.test.ts`).
8. **Views and gate.** `views.tsx` are props-only. `AuthGate.tsx` adapts tudocuatui `AuthGate.tsx`:
   - States: `checking | signedOut | join | unverified | retry | noOrg | noAccess | ready`.
   - Call `store.start()` in an effect.
   - On mount, restore when an account id is stored; otherwise list accounts (max 5) for "Continue as".
   - After a token: `apiFetch("/api/me")` → `viewForMe`. `ready` builds `Session {tier, email}` and renders
     `<SessionProvider value={session} actions={{ signOut, refreshPermissions }}>` + `ApiFetchProvider` around
     `children`.
   - `signOut`: unmount the app first (tudocuatui `flushSync` pattern), then `store.signOut()`. `confirmed:false` shows
     the logout-unconfirmed notice.
   - `refreshPermissions`: `store.renewNow()`, then re-run `/api/me`.
   - `store.subscribe` (background failures, including `session_invalid`) and `store.onRemoteSignOut` move to the
     sign-in view (AC4b). `onAuthLost` → `store.forget()` + the sign-in view with `no_access`.
   - The `unverified` view offers "Check again" and "Use another account" (S3 adds "Resend email").
   - Join runs only from the button click (AUT-01; consumers.md 340-389).
   - `switchOrg` stays unset (SIM-007).
9. **Wiring.** `(app)/layout.tsx` wraps `AppShell` in `AuthGate`. The gate renders the auth views in place, so the URL
   never changes and "lands back on the page" needs no storage. `/sign-in` renders `SignInRoute` with a validated
   `returnTo` and replaces to it once ready.

### S3 — account pages (ricotdin behaviour, tudocuatui views)
10. **Link token handling (`email-link.ts`).** The containers call `takeLinkToken(window, "/verify-email")` (or
    `"/reset-password"`) once, in a mount effect. The hash is read and `replaceState` is called before any state
    update or network call. The token is kept in a `useRef`: it never goes into React state that renders, never into a
    log, never into a URL. Before the effect has run, SSR and the first client render show the "checking link" state,
    so there is no hydration mismatch.
11. **Pages.**
    - `/sign-up`: validate, then Turnstile (always). `client.signup` sends `omit` + `X-MM-App`. Show "Check your inbox
      at <email>" with a link to `/sign-in`. Reset the Turnstile widget after every attempt. No resend on this screen:
      resend needs the account id, which only exists after sign-in. The gate's unverified view offers it (as ricotdin).
    - `/forgot-password`: validate the email, then Turnstile, then `client.forgotPassword`. Every 202 shows "If an
      account exists for this address, we sent a link." Link to `/sign-in`.
    - `/verify-email`: the "Verify my email" button posts once (single-use guard). On success, show "Email verified"
      and "Continue" → `/`; the gate restores the session and mints a fresh token, which covers consumers.md step 4.
      On `token_invalid`, show "This link no longer works. Sign in to get a new one." → `/sign-in`.
    - `/reset-password`: new password + confirm (`validateNewPassword`), then `client.resetPassword`. Done → "Password
      changed. Sign in with your new password." → `/sign-in`. On `token_invalid` → "Get a new link" →
      `/forgot-password`. On `weak_password` → list the reasons; the form stays.
12. **Gate changes.** Pass `/sign-up` and `/forgot-password` hrefs to `SignInView`. The unverified view's Resend calls
    `client.resendVerification(accountId)` and shows the sent state. 429 shows the wait text. 409
    `email_already_verified` re-runs the token check. 401 `session_invalid` goes to sign-in.
13. **Referrer-Policy.** Add `async headers()` to `next.config.ts` with `{ source: "/verify-email", headers: [{ key:
    "Referrer-Policy", value: "no-referrer" }] }`, and the same for `/reset-password`. Keep the other keys unchanged.
    `next.config.ts` is a High path, and S3 is High tier anyway because of auth.
14. **Pages are outside `(app)`.** `src/app/{sign-up,forgot-password,verify-email,reset-password}/page.tsx` sit next to
    `src/app/sign-in/`, so the `(app)` layout's gate never wraps them.

### Rules (all slices)
- R1: lib files import only lib; `src/ui/auth/**` imports lib and ui; pages import ui/lib; nothing imports server
  (`pnpm check:layers`).
- R3: only public config; names go to `.env.example` via Ming.
- R4: no org picker, no `org_id`, no invitations, no profile/password-change screen.
- R5: tests above; checks green per slice.
- R6: the client never sends an org id; the scope comes only from the token (SIM-023).

## Specialist input used
`consult-frontend-developer.md` (written before Q16; still valid for S1/S2):
- Findings 1-6: adopted as the basis of the design (no OAuth redirect; restore before showing sign-in; tudocuatui
  port; simap codes; `/api/me` for the session; existing seams).
- R-a: adopted. One change: the Turnstile key is a constant with a dev-only `NEXT_PUBLIC_*` override, not env-only,
  because the production image has no build args.
- R-b: adopted, except `org_required` is **not** retried (re-minting without `org_id` cannot fix it).
- R-c: adopted (in-place gate, thin `/sign-in` with a validated `returnTo`). The restoring state uses an auth-layout
  "Checking your session" card, not `PageSkeleton`.
- R-d, R-e: adopted (R-e's codes minus `join_approval_unavailable`; plus the S3 codes after Q16).
- R-f: partly adopted. `apiFetch` is org-agnostic. The optional `orgId` on `client.token` comes with SIM-007.
- R-g: adopted. Credentials modes per consumers.md (now all ten calls, A13). No tokens in storage, URL or logs.
  Before S3 there was no CSP or headers config; S3 adds only `Referrer-Policy` for the two link pages.
- The consult did not cover the S3 pages. ricotdin and consumers.md are the references there; a second consult is not
  needed, because security review triggers on `**/auth*` anyway.

## Assumptions
- **A1 (SIM-023).** `/api/me` keeps `{sub, email, org, tier}`. `withAuth` handlers get `ctx.scope`. No slice adds an
  API route, so the guarded-routes test (`Symbol.for("simap.withAuth")` marker) is unaffected. The client sends only
  the bearer.
- **A2 (SIM-022).** Copy files are `src/ui/copy/<feature>.ts` exporting `<feature>Copy` `as const`, English. Strings
  that take values are small pure functions. Components import copy relatively, pages via `@/ui/copy/<feature>`.
  `no-literals.test.ts` fails on JSX text and user-facing string props outside copy files (escape hatch
  `// copy-ok: <reason>`). All auth text lives in `src/ui/copy/auth.ts`. Page `metadata.title` strings come from
  `authCopy` too.
- **A3 (consult Q1, default).** Before SIM-007 the token has no `org`, so `/api/me` answers 403 `org_required`. The gate
  shows `NoOrgView`: "Signed in as <email>. No organization selected yet.", with sign-out. SIM-007 replaces it with the
  picker.
- **A4.** Retry on 401 and on any 403 except `org_required`, including `member_deactivated`. A final
  `member_deactivated` shows its own message ("Your access to this organization is turned off. Ask an organization
  admin.").
- **A5.** Join 202 `pending`: the gate shows "waiting for approval" and does not poll (consumers.md 366-367).
- **A6 (replaced).** Rev 1 said simap serves no `/verify-email` / `/reset-password` and offers no resend. With Q16, S3
  serves both and adds resend, which meets consumers.md 231-232.
- **A7.** The planner read tudocuatui's **working tree**, which may differ from `origin/main`. The implementer ports from
  `git show origin/main:…` and records any difference in `impl-log.md`.
- **A8 (tests).** No `jsdom` / `@testing-library/react` (D2). The tudocuatui DOM tests (`AuthGate.test.tsx`, screen
  tests, `ResetPasswordPage.test.tsx`, `VerifyEmailPage.test.tsx`) are not ported. Their decisions are covered by
  `flow.test.ts`, `email-flows.test.ts` and `email-link.test.ts`, and the views by `renderToStaticMarkup`. Container
  effects are covered by code review and Ming's manual check (Q3).
- **A9 (hotspots).**
  - `src/ui/copy/*` and `copy.test.ts`: SIM-022 (same batch, lands first).
  - `src/ui/index.ts`, `src/app/(app)/layout.tsx`, `src/lib/session.ts`: SIM-010 (PLANNING) and SIM-007.
  - `next.config.ts` (S3): any ticket adding headers or CSP.
  - Expect S2 and S3 to rebase onto SIM-022, SIM-023 and each other.
- **A10 (tier).** S1 contains `src/lib/identity/config.ts` (High `**/config.*`) → High; Ming reviews. S2 has no High
  path, so it is Medium by paths; it is still auth, so security review triggers on `**/auth*`. S3 touches
  `next.config.ts` → High. Plan approval stays a gate for all three (P0 + auth).
- **A11.** tudocuatui's logout-unconfirmed and "Continue as" behaviour (list hidden right after sign-out) is kept.
- **A12 (spec conflict, flagged).** spec AUT-01 line 164 ("simap has no sign-up form of its own … links to Identity's
  sign-up and forgot-password flows") and §Out of scope line 489 ("Local accounts, passwords, sign-up, password reset
  … inside simap. Identity owns all of these.") conflict with Ming's Q16 answer. The spec normally wins (project
  CLAUDE.md), but Q16 is a later, explicit Ming decision, so this plan follows Q16. Accounts and passwords stay owned by
  Identity; simap only hosts the screens. The orchestrator should record a D-entry ("simap hosts sign-up,
  forgot-password, verify-email and reset-password pages calling org-admin-api, as ricotdin; supersedes D33's link
  targets"). After that, the spec lines need an update (Ming step 4). The planner edits neither file.
- **A13 (deliberate deviation from tudocuatui).** tudocuatui's `identityClient` sends signup and forgot with
  `cookie=true`, i.e. `credentials: "include"` (`identityClient.ts` lines 157, 165). consumers.md 44 and 223/273 say
  `omit` + `X-MM-App`. simap follows consumers.md through the three-mode `post`. Suggested follow-up: a `debt` issue
  for tudocuatui (`project:tudocuatui`); the orchestrator opens it.
- **A14.** After a password reset, Identity ends the account's sessions. An open simap tab gets 401 `session_invalid`
  on its next renewal, and the existing store path signs it out. No extra code.
- **A15.** The email-link pages load the root layout (Google Fonts). The token is in the fragment, which browsers never
  send in `Referer`, and it is stripped before any call. `no-referrer` covers the rest.

## Questions with defaults (non-blocking, for the plan-approval round)
0. **Split.** Default: **yes, split as above**. SIM-006 = S1 (auth library). New tickets: SIM-006.2 = S2 (sign-in gate
   UI, depends on SIM-006) and SIM-006.3 = S3 (sign-up, verify-email, forgot-password, reset-password pages, depends on
   SIM-006.2). On approval, the orchestrator creates the two tickets on the board with the ACs above. Alternative: one
   PR in three commits (about 2,700 lines).
1. **(Answered, Q16.)** Sign-up / forgot-password are simap pages (S3). The rev 1 question about link targets is
   closed.
2. **Turnstile site key.** Default: reuse tudocuatui's public widget key (`0x4AAAAAAF_LLtCloZlzY0MY`) as
   `TURNSTILE_SITE_KEY_PROD`; Ming adds `simap.mmlabs.online` and `localhost` to that widget's hostnames. Alternative:
   a dedicated simap widget, with Ming giving the public key.
3. **DOM tests.** Default: no new dev dependencies (A8). Alternative: add `jsdom` + `@testing-library/react` and port
   tudocuatui's `AuthGate`, screen and page tests (much larger slices).
4. **Referrer-Policy mechanism.** Default: an HTTP header from `next.config.ts` `headers()` (consumers.md says
   "served with"). Alternative: page `metadata.referrer` (a `<meta>` tag; no High-path change, but not a header).
5. **Resend on the verify page.** Default: none (ricotdin). An invalid link sends the user to sign-in, where the
   unverified view offers Resend. Alternative: tudocuatui-style Resend on `/verify-email` when an account id is stored
   on this browser.

## Blocking questions
None.

## Split proposal
Estimated size, mostly ports with their ported tests:

| Slice | Ticket | Content | ACs | Est. lines | Tier |
|---|---|---|---|---|---|
| S1 | SIM-006 | `src/lib/identity/{types,errors,config,flow}.ts`, `src/lib/validate/credentials.ts`, `src/lib/api/fetch.ts`, `src/ui/auth/{accountId,refreshLock,authChannel,identityClient,tokenStore,fakeTabs}.ts` + tests | 2, 3a, 4a, 5, 6 | ~1,300 (≈ 800 ported tests) | High |
| S2 | SIM-006.2 | return-to, `waitText`, session type, Turnstile, runtime, AuthLayout, views, AuthGate, api-fetch context, SignInRoute, `authCopy`, `(app)` layout, `/sign-in` + tests | 1, 3b, 4b, 7 | ~700 | Medium (auth review) |
| S3 | SIM-006.3 | email-link, email-flows, account views, four page containers, four routes, gate/views/copy additions, `next.config.ts` headers + tests | 8-12 | ~800 | High |

All three are above the ~400-line guide, because each is a port shipped with its ported tests. Smaller cuts would
separate code from its tests. S1 builds and passes the checks alone: nothing imports the new modules yet, and
`pnpm build` / `check:layers` are unaffected. This plan covers all three slices; if Ming approves the split (Q0), the
implementer of SIM-006 implements **S1 only**.

This ticket's own ACs: AC2, AC3 (retry rule), AC4 (store side) and AC5 stay on SIM-006. AC1, the "You don't have
permission" view and the sign-out UI move to SIM-006.2.
