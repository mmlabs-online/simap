Status: READY

# Plan — SIM-006.3: Account pages: sign-up, verify email, forgot and reset password

Slice S3 of the approved `work/tickets/SIM-006/plan.md` (revision 2, approved 2026-11-20, batch 2026-11-20-2). This plan
reuses that slice (ACs 8–12, S3 file table lines 186–203, S3 tests lines 267–279, Approach steps 10–14). It re-plans only
what changed on `main` since: SIM-006 (S1) and SIM-006.2 (S2) are merged, and Ming answered Q16, Q34 and Q35. Where this
plan and the source plan differ, this plan wins and says why. A reviewer should **not** apply the source plan's
`next.config.ts` row (line 202), step 13 or the `next-config.test.ts` row (line 278): Q34 replaced them.

## Scope summary
Ticket (`work/tickets/SIM-006.3/ticket.md`):
- Goal: "simap hosts its own sign-up, verify-email, forgot-password and reset-password pages, as ricotdin does, calling
  the org-admin-api auth endpoints (Ming, Q16); slice S3 of the approved SIM-006 plan."
- Scope: "Everything listed under slice S3 in `work/tickets/SIM-006/plan.md`, with Q34: `Referrer-Policy: no-referrer`
  via `metadata.referrer` on these pages (no `next.config.ts` change)." / "Record a decision in `work/decisions.md`
  superseding D33's link targets, and update spec AUT-01 (line ~164) and §Out of scope (line ~489) accordingly."
- Out of scope: "Resend button on `/verify-email` (Q35: none, as ricotdin)."

Ming's answers (`work/batches/2026-11-20-2.md` line 63–64): "Q16 own sign-up/forgot-password pages like ricotdin (same
org-admin-api auth API)"; "câu 34 dùng metadata.referrer"; "Q35 no Resend on /verify-email".

Source plan S3 ACs (SIM-006 plan lines 98–107), quoted:
- AC8 "simap serves `/sign-up`, `/forgot-password`, `/verify-email` and `/reset-password`. They are outside the gate, and
  the sign-in view links to sign-up and forgot-password."
- AC9 "Email-link tokens never reach a server, log or history. The fragment is read once and removed (`replaceState`)
  before any network call. The pages send `Referrer-Policy: no-referrer`." (The last sentence is now: the four pages
  set `metadata.referrer: "no-referrer"`, i.e. `<meta name="referrer" content="no-referrer">`, per Q34.)
- AC10 "Forgot password always answers "If an account exists for this address, we sent a link". Sign-up ends on
  "check your inbox"."
- AC11 "Error mapping for the public flows follows consumers.md: `token_invalid` → invalid link with sign-in (verify) or
  a "new link" action (reset); `weak_password` reasons shown and the link still usable; `turnstile_failed` → Turnstile
  reset; `email_taken` → own message; 429 → wait text."
- AC12 "Verification runs only after a click (mail scanners do not verify). The unverified view of the gate offers
  "Resend email"."

Identity contract (consumers.md, as quoted in the source plan lines 40–62): link format `{origin}/verify-email#token=…`
and `{origin}/reset-password#token=…`; "Every registered origin of an app must serve `/verify-email` and
`/reset-password`"; the page "reads `location.hash`, then removes it at once (`history.replaceState(null, "",
"/verify-email")`)"; forgot "is **202 for every email** … the page must always say "if an account exists for this
address, we sent a link""; verify codes 204 / 422 `token_invalid` / 422 `validation_error` / 429; resend codes 202 / 401
`session_invalid` / 409 `email_already_verified` / 429; reset codes 204 / 422 `weak_password` (`too_short`,
`too_common`) / 422 `token_invalid` / 422 `validation_error` / 429.

Spec lines in conflict (to be updated by this ticket): `docs/spec-v1.md` line 164–165 (AUT-01 "simap has no sign-up form
of its own …"), line 182–183 (AUT-03 "no self-signup in simap itself") and line 512 (§9 Non-goals: "Local accounts,
passwords, sign-up, password reset … inside simap"). `work/decisions.md` line 40 (D33). Q16 is a later explicit Ming
decision, so it wins (source plan A12).

### What changed on `main` since the source plan (verified in code)
| Source plan item | State on main | Effect on this plan |
|---|---|---|
| Error codes and copy for `email_taken`, `weak_password` (+reasons), `token_invalid`, `email_already_verified` | Already in `src/lib/identity/types.ts:2-22`, `src/lib/identity/errors.ts`, `src/ui/copy/auth.ts:64-89`; `authErrorMessage` handles reasons and wait text (`auth.ts:93-107`) | No error-code or `authErrorMessage` change; copy adds only screen strings |
| `identityClient` signup / verifyEmail / forgotPassword / resetPassword / resendVerification with the right credentials modes | Already in `src/ui/auth/identityClient.ts:14-24, 163-180` and tested (S1) | Reuse; no change |
| `validateSignUp`, `validateNewPassword`, `emailError`, `hasErrors` | `src/lib/validate/credentials.ts:17-80` | Reuse; no change |
| Turnstile widget with `siteKey` / `resetKey` | `src/ui/auth/TurnstileWidget.tsx:11-62` | Reuse; no change |
| `getAuthRuntime()` lazy runtime | `src/ui/auth/runtime.ts:27` | Containers call it in an effect / handler only |
| `SignInView` sign-up / forgot links | Props exist and are tested (`views.tsx:56-57,164-173`, `views.test.tsx:34-41`) | Only the gate must pass the hrefs |
| `UnverifiedView` | Exists without Resend (`views.tsx:258-284`) | Add optional Resend props |
| `Notice`, `Field`, `linkClass` | Private in `views.tsx:12-36,178-216` | Move to a shared `fields.tsx` (no duplication) |
| Account id in the unverified state | `flow.ts:27` reaches `unverified` only when `hasAccount`; `store.accountId()` (`tokenStore.ts:26`) | Resend uses `store.accountId()`; no new state |
| Referrer-Policy via `next.config.ts` headers (source step 13, High path) | **Replaced by Q34** | `export const metadata = { title, referrer: "no-referrer" }` on the four pages; `next.config.ts` untouched |
| Resend on `/verify-email` (source Q5 default "none") | **Confirmed by Q35** | None; invalid link → sign-in only |
| `src/proxy.*` / `src/middleware.*` | Neither file exists (glob) | Nothing intercepts the new routes |

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 8 | simap serves `/sign-up`, `/forgot-password`, `/verify-email`, `/reset-password`, outside the gate; the sign-in view links to sign-up and forgot-password. | `pnpm build` route list shows the four routes as static (`○`). The four page files sit in `src/app/<route>/page.tsx`, not under `src/app/(app)/` (structural check). Code review: `AuthGate.tsx` passes `signUpHref="/sign-up"` and `forgotHref="/forgot-password"` to `SignInView`; the link rendering is covered by the existing `views.test.tsx › shows sign-up and forgot links only when hrefs are given`. Local run: `pnpm dev`, open each route signed out; none shows the sign-in gate. |
| 9 | Link tokens never reach a server, log or history; the fragment (and any query) is read once and removed before any network call; the four pages set referrer policy `no-referrer`. | `email-link.test.ts` (all rows below). `account-pages.test.ts › each account page exports metadata.referrer "no-referrer" and a title; the default export takes no props`. Code review of `VerifyEmailPage.tsx` / `ResetPasswordPage.tsx`: `takeLinkToken` is the first thing the mount effect does; the token lives only in a `useRef`; no `console.*`; the token is never in rendered state, a URL or an error. Grep: no `console.` in the new files; no `searchParams` in the four pages. S1 `identityClient.test.ts` already proves verify/reset send the token only in the JSON body. |
| 10 | Forgot always answers the neutral text; sign-up ends on "check your inbox". | `email-flows.test.ts › forgotOutcome: ok → sent`; `account-views.test.tsx › ForgotPasswordView sent state shows exactly the neutral text and no email`, `› SignUpView sent state shows the address and a sign-in link`. |
| 11 | Error mapping per consumers.md: `token_invalid` → invalid link + sign-in (verify) / "Get a new link" (reset); `weak_password` reasons shown, link still usable; `turnstile_failed` → Turnstile reset; `email_taken` → own message; 429 → wait text. | `email-flows.test.ts` tables for `signUpOutcome`, `forgotOutcome`, `verifyOutcome`, `resetOutcome`, `resendOutcome`; `account-views.test.tsx › ResetPasswordView invalid links to /forgot-password`, `› VerifyEmailView invalid links to /sign-in only (no resend)`, `› ResetPasswordView ready with weak_password lists the reasons and keeps the form`; existing `auth.test.ts › authErrorMessage returns a non-empty string for every AuthErrorCode`. |
| 12 | Verification runs only after a click; the gate's unverified view offers "Resend email". | `account-views.test.tsx › VerifyEmailView ready state has a Verify button and no form auto-post` (props-only, no fetch dep); code review of `VerifyEmailPage.tsx` (no effect calls `client.verifyEmail`; the button handler is the only caller; single-use guard set before the await). `views.test.tsx › UnverifiedView shows Resend, Check again, Use another account`, `› UnverifiedView sent / rate-limited states`, `› UnverifiedView without onResend shows no Resend`. Code review of `AuthGate.tsx` resend handler (uses `resendOutcome`). |
| T1 | Referrer policy set via `metadata.referrer` on the four pages; no High path touched. | `account-pages.test.ts` (above). `git diff --name-only main` contains none of: `next.config.*`, `**/config.*`, `src/proxy.*`, `src/middleware.*`, `src/server/**`, `.env.example`, `scripts/check-layers.mjs`, `Dockerfile`, `**/*.sql` (the CI risk-tier job reports Medium or Low by paths). |
| T2 | Decision entry and spec lines updated. | `work/decisions.md` has a new row D53 superseding D33's link targets (text in Approach step 9). `docs/spec-v1.md` lines ~164, ~182 and ~512 no longer say simap has no sign-up / password reset screens, and say accounts and passwords stay in Identity. |
| — | Loop checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` green. `no-literals.test.ts` passes over the new `.tsx` files with no new `copy-ok` escapes. |

## Ming verification after merge
Needs M-1 (Identity app `simap` registers both the production and the dev origin; email links go to the calling origin)
and a local Identity that sends mail to a dev inbox or logs the link.
- Sign up a new address on `http://localhost:3000/sign-up`: the page ends on "Check your inbox at <email>". The email
  links to `http://localhost:3000/verify-email#token=…`. Opening it removes the fragment from the address bar at once;
  nothing is verified until "Verify my email" is pressed; then "Email verified".
- Before verifying, sign in: the unverified view offers "Resend email", and a second link arrives. Pressing it again
  quickly shows the wait text.
- Forgot password with a registered and with an unregistered address: both show the same neutral text. The reset link
  opens `/reset-password`, the fragment disappears, a weak password shows its reason and the form stays, a good one ends
  on "Password changed"; the old session in another tab is signed out on its next renewal.
- An already used link on `/verify-email` shows "This link no longer works" with a sign-in link only; on
  `/reset-password` it offers "Get a new link".
- DevTools → Elements on each of the four pages: `<head>` contains `<meta name="referrer" content="no-referrer">` (Q34:
  a meta tag, **not** a `Referrer-Policy` response header; the source plan's "Network → response header" step is void).
- Turnstile renders and passes on `/sign-up` and `/forgot-password` with that meta tag in place (see A3).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/email-link.ts` | new, pure: `readLinkToken(hash)` (`^#token=([A-Za-z0-9_-]{32,128})$`, else `null`) and `takeLinkToken(deps, path)` with `deps = { location: { hash, search }, history: { replaceState(data, unused, url) } }`: reads the hash, and when hash or search is non-empty calls `history.replaceState(null, "", path)` **before** returning; returns the token or `null`. No DOM globals referenced. | AC9 | no |
| `src/lib/identity/email-flows.ts` | new, pure: `signUpOutcome`, `forgotOutcome`, `verifyOutcome`, `resetOutcome`, `resendOutcome` — each takes `{ ok: true } \| { ok: false; error: AuthError }` and returns a discriminated outcome (shapes in Approach step 3) | AC10, AC11, AC12 | no |
| `src/ui/auth/fields.tsx` | new: `Notice`, `Field` (icon typed `IconName`), `linkClass`, `ShowPasswordToggle` moved out of `views.tsx` unchanged in markup (Field gains nothing but the wider icon type) | shared by `views.tsx` and `account-views.tsx`, no duplication | no |
| `src/ui/auth/views.tsx` | import `Notice` / `Field` / `linkClass` / `ShowPasswordToggle` from `./fields` (lines 12–36, 151–158, 178–216 removed); `UnverifiedView` gains optional `onResend`, `resend?: "idle" \| "sending" \| "sent"`, `resendError?: AuthError \| null` and renders "Resend email" only when `onResend` is set | AC12 | no |
| `src/ui/auth/account-views.tsx` | new `"use client"` props-only views: `SignUpView`, `ForgotPasswordView`, `ResetPasswordView`, `VerifyEmailView`, plus `LinkCheckingView` (busy "Checking your link"). Form views keep input `useState` like `SignInView`; every other state comes from props. No view takes a token prop. | AC8, AC10–12 | no |
| `src/ui/auth/SignUpPage.tsx` | new `"use client"` container: runtime in an effect; `validateSignUp`; Turnstile always (no token → `turnstile_required` notice, no call); `client.signup`; `signUpOutcome`; spend Turnstile (clear token, bump `resetKey`) after every attempt; busy-ref guard | AC8, AC10, AC11 | no |
| `src/ui/auth/ForgotPasswordPage.tsx` | new `"use client"`: `emailError`; Turnstile always; `client.forgotPassword`; `forgotOutcome`; neutral sent state; spend Turnstile after every attempt | AC8, AC10, AC11 | no |
| `src/ui/auth/VerifyEmailPage.tsx` | new `"use client"`: mount effect takes the token once (`takeLinkToken(window, "/verify-email")`, ref-guarded for StrictMode); token in a ref; `client.verifyEmail` only from the button; single-use guard; `verifyOutcome`; "Continue" → `/` | AC9, AC12 | no |
| `src/ui/auth/ResetPasswordPage.tsx` | new `"use client"`: same token handling with `"/reset-password"`; `validateNewPassword`; `client.resetPassword`; `resetOutcome`; done → `/sign-in`; invalid → `/forgot-password` | AC9, AC11 | no |
| `src/ui/auth/AuthGate.tsx` | `SignInView` gets `signUpHref="/sign-up"` and `forgotHref="/forgot-password"` (line 425); `unverified` view state gains `resend` / `resendError`; new `resend()` handler calls `client.resendVerification(store.accountId())` and applies `resendOutcome` (Approach step 6) | AC8, AC12 | no |
| `src/ui/copy/auth.ts` | add `fields.confirmPassword`, `fields.newPassword`, and blocks `signUp`, `forgot`, `verify`, `reset`, `linkChecking`, `unverified.resend*` (Approach step 7). No new error codes. | D36 | no |
| `src/ui/index.ts` | export `SignUpPage`, `ForgotPasswordPage`, `VerifyEmailPage`, `ResetPasswordPage` | pages import `@/ui` (R1) | no |
| `src/app/sign-up/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/verify-email/page.tsx`, `src/app/reset-password/page.tsx` | new thin server pages: `export const metadata: Metadata = { title: authCopy.<x>.pageTitle, referrer: "no-referrer" }`; default export renders the container; **no `searchParams`** (static) | AC8, AC9, Q34 | no |
| `src/lib/identity/email-link.test.ts` | new | AC9 | no |
| `src/lib/identity/email-flows.test.ts` | new | AC10–12 | no |
| `src/ui/auth/account-views.test.tsx` | new (`renderToStaticMarkup`) | AC8, AC10–12 | no |
| `src/ui/auth/views.test.tsx` | extend `UnverifiedView` cases | AC12 | no |
| `src/app/account-pages.test.ts` | new: imports the four page modules, asserts `metadata` | AC9, T1 | no |
| `work/decisions.md` | append D53 | ticket scope, T2 | no |
| `docs/spec-v1.md` | update AUT-01 line 164–165, AUT-03 line 182–183, §9 Non-goals line 512 | ticket scope, T2 | no |

Not touched: `next.config.ts`, `src/lib/identity/config.ts`, `src/server/**`, `src/app/api/**`, `.env.example`,
`scripts/check-layers.mjs`, `src/ui/auth/identityClient.ts`, `src/lib/identity/{errors,types,flow}.ts`,
`src/lib/validate/credentials.ts`, `TurnstileWidget.tsx`. No file named `config.*` or `*auth*` is created under `src`
outside `src/ui/auth/` (High path `**/config.*`; review trigger `**/auth*`).

## Data model / migration
None.

## API contract
None (no simap endpoint). Consumed Identity calls, all already implemented and tested in S1 (`identityClient.ts`):

| Identity call | Path | `credentials` | `X-MM-App` | Used by |
|---|---|---|---|---|
| signup | `POST /auth/signup` | omit | simap | `SignUpPage` |
| forgot | `POST /auth/password/forgot` | omit | simap | `ForgotPasswordPage` |
| verify | `POST /auth/verify-email` | omit | — | `VerifyEmailPage` |
| reset | `POST /auth/password/reset` | omit | — | `ResetPasswordPage` |
| resend | `POST /auth/verify-email/resend` | include | simap | `AuthGate` unverified view |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/identity/email-link.test.ts` › `readLinkToken`: 32-, 43- and 128-char url-safe tokens accepted; 31 / 129 chars, `+`, `/`, `=`, `%`, extra params (`#token=…&x=1`), missing `#`, `#token=` empty, `#Token=`, `""` → `null` | AC9 |
| › `takeLinkToken` with a valid hash returns the token and calls `replaceState(null, "", path)` exactly once, **before** returning (record call order in the fake) | AC9 |
| › an invalid hash still calls `replaceState` once and returns `null` | AC9 |
| › a `?token=…` query with no hash: `replaceState` once, returns `null` (the query token is never read) | AC9 |
| › empty hash and empty search: no `replaceState`, returns `null` | AC9 |
| › keeps no state: two calls on the same fake after stripping (hash now `""`) → second returns `null`, no second `replaceState` | AC9 |
| `src/lib/identity/email-flows.test.ts` › `signUpOutcome`: ok → `sent`; `email_taken` → error on `email`; `weak_password` → error on `password` with reasons kept; `validation_error` → form error; `turnstile_failed` / `turnstile_required` → error + `resetTurnstile: true`; `rate_limited` → error with `retryAfterSeconds`; `network` / `unknown` → generic error; every error outcome has `resetTurnstile: true` (single-use token) | AC10, AC11 |
| › `forgotOutcome`: ok → `sent`; `turnstile_failed` / `turnstile_required` → error + reset; `validation_error` → error on `email`; `rate_limited` → wait; `network` / `unknown` / any other code → generic error; no outcome carries an account-dependent code (`email_unverified`, `not_member`, `email_taken` all map to the generic error) | AC10 |
| › `verifyOutcome`: ok → `verified` (`clearToken: true`); `token_invalid` / `validation_error` → `invalid` (`clearToken: true`); `rate_limited` → `ready` + wait error, `clearToken: false`, retry allowed; `network` / `unknown` → `ready` + error, `clearToken: false` | AC11, AC12 |
| › `resetOutcome`: ok → `done` (`clearToken: true`); `weak_password` → `ready` + error with reasons, `clearToken: false`; `token_invalid` / `validation_error` → `invalid` (`clearToken: true`); `rate_limited` → `ready` + wait; `network` / `unknown` → `ready` + error, `clearToken: false` | AC11 |
| › `resendOutcome`: ok → `sent`; `email_already_verified` → `recheck`; `session_invalid` → `signIn`; `rate_limited` → `error` with wait; `network` / `unknown` → `error` | AC12 |
| `src/ui/auth/account-views.test.tsx` › `SignUpView` form: email, password, confirm fields, Turnstile slot always rendered, link to `/sign-in` | AC8 |
| › `SignUpView` sent state shows `authCopy.signUp.sent(email)` and a sign-in link; no form | AC10 |
| › `SignUpView` with an `email_taken` error shows the own message in `role="alert"` | AC11 |
| › `ForgotPasswordView` form: email field, Turnstile slot always, link to `/sign-in` | AC8 |
| › `ForgotPasswordView` sent state shows exactly `authCopy.forgot.sent` and does not contain the typed email | AC10 |
| › `ResetPasswordView` ready: new password + confirm, show-password toggle, no email field; with a `weak_password` error lists both reasons and keeps the form | AC11 |
| › `ResetPasswordView` done links to `/sign-in`; invalid links to `/forgot-password` | AC11 |
| › `VerifyEmailView` ready has one Verify button and no `<form` (no auto-post); verified links to `/`; invalid links to `/sign-in` and contains no Resend | AC11, AC12, Q35 |
| › `LinkCheckingView` is a busy status | AC9 (hydration-safe first render) |
| › field errors wire `aria-invalid` and `aria-describedby` to the error id | a11y |
| `src/ui/auth/views.test.tsx` › `UnverifiedView shows Resend, Check again, Use another account` (with `onResend`) | AC12 |
| › `UnverifiedView` `resend="sent"` shows the sent notice; `resendError` rate_limited shows the wait text; `resend="sending"` disables the Resend button | AC12 |
| › `UnverifiedView without onResend shows no Resend` | AC12 |
| `src/app/account-pages.test.ts` › each of the four page modules exports `metadata.referrer === "no-referrer"` and a non-empty `metadata.title`; the default export has `length === 0` (takes no `searchParams`) | AC9, T1 |
| `src/ui/copy/copy.test.ts`, `src/ui/copy/no-literals.test.ts` (existing) › pass over the new strings and new `.tsx` files unchanged | D36 |

## Approach
1. **Shared fields (`fields.tsx`).** Move `Notice`, `Field`, `linkClass` from `views.tsx` and extract the show-password
   checkbox (`views.tsx:151-158`) as `ShowPasswordToggle`. Type `Field.icon` as `IconName` (`@/lib/icons`). Existing
   `views.test.tsx` must stay green unchanged (pure move).
2. **`email-link.ts`** as in the file table. `path` is the bare route (no query, no hash); `replaceState` is called
   before the function returns, on every non-empty hash or search, so an invalid or query-string link is also cleaned
   (consult rec 2).
3. **`email-flows.ts`** outcomes (names are binding for the tests):
   - `SignUpOutcome = { kind: "sent" } | { kind: "error"; error: AuthError; field?: "email" | "password"; resetTurnstile: true }`.
   - `ForgotOutcome = { kind: "sent" } | { kind: "error"; error: AuthError; field?: "email"; resetTurnstile: true }`. Any
     code outside `turnstile_*`, `validation_error`, `rate_limited` → `{ code: "unknown" }` (never shows an
     account-dependent message).
   - `VerifyOutcome = { kind: "verified" | "invalid"; clearToken: true } | { kind: "ready"; error: AuthError; clearToken: false }`.
   - `ResetOutcome = { kind: "done" | "invalid"; clearToken: true } | { kind: "ready"; error: AuthError; clearToken: false }`.
   - `ResendOutcome = { kind: "sent" } | { kind: "recheck" } | { kind: "signIn"; error: AuthError } | { kind: "error"; error: AuthError }`.
   Messages come from the existing `authErrorMessage` (wait text, weak reasons).
4. **Views (`account-views.tsx`).** Port the layout of tudocuatui `SignUpScreen`, `ForgotPasswordScreen`,
   `ResetPasswordScreen`, `VerifyEmailScreen` (read with `git show origin/main:…`, source plan A7) into `AuthLayout`
   with `Notice` / `Field`. Submit handlers validate with `validateSignUp` / `emailError` / `validateNewPassword` and
   call `onSubmit(values)` only when valid (as `SignInView.submit`). The email is rendered as text only (React-escaped,
   `break-words`), never as a link target. Fixed hrefs only: `/sign-in`, `/forgot-password`, `/`. No `returnTo`.
5. **Containers.** All four: `const [rt, setRt] = useState<AuthRuntime | null>(null); useEffect(() => setRt(getAuthRuntime()), [])`
   as `AuthGate.tsx:48-49`; a `busy` ref guards double submits.
   - Sign-up / forgot: Turnstile token in a ref; `TurnstileWidget` with `siteKey={rt.turnstileSiteKey}` and
     `resetKey`; on submit without a token show the `turnstile_required` notice and send nothing; after every attempt
     clear the token and bump `resetKey` (consult risk "single-use tokens").
   - Verify / reset: `const token = useRef<string | null>(null); const taken = useRef(false);` In the mount effect:
     `if (!taken.current) { taken.current = true; token.current = takeLinkToken(window, "<path>"); }` then set view
     `ready` or `invalid`. First render (SSR and client) is `LinkCheckingView`, so no hydration mismatch. StrictMode's
     second effect run sees `taken.current` and does nothing else (consult risk). The effect never calls the network.
   - Verify: the button handler sets the guard **before** the await; on an outcome with `clearToken` set
     `token.current = null` and keep the guard; on `ready` release the guard so the user can retry.
   - Reset: same; `weak_password` keeps the token (link still usable).
   - No `console.*`, no error boundary text with values; the token never enters `useState`, a URL, a log or an error.
6. **Gate (`AuthGate.tsx`).** Pass the two hrefs to `SignInView`. Add `resend?` / `resendError?` to the `unverified`
   view state. `resend` handler: guard with `busy`; read `id = store.accountId()`; if `null` → `useOtherAccount()`
   path (signed out); else `client.resendVerification(id)` → `resendOutcome`: `sent` → set `resend: "sent"`;
   `recheck` → `rechecking.current = true; check()`; `signIn` → `apply(viewForTokenError(err, false), s)` (as `join`,
   line 375); `error` → `resendError`. Respect the `seq` epoch like the other handlers.
7. **Copy (`src/ui/copy/auth.ts`, English, no "?" characters).** Proposed strings (implementer may polish wording, not
   meaning):
   - `fields.confirmPassword: "Confirm password"`, `fields.newPassword: "New password"`.
   - `signUp: { pageTitle: "Create an account", title, submit: "Create account", submitting, sent: (email) => "Check your
     inbox at ${email}. Open the link in the email to verify your address.", toSignIn: "Back to sign in" }`.
   - `forgot: { pageTitle: "Forgot password", title, body, submit: "Send link", submitting, sent: "If an account exists
     for this address, we sent a link.", toSignIn }`.
   - `verify: { pageTitle: "Verify email", title, body, submit: "Verify my email", submitting, verified: "Email
     verified.", continue: "Continue", invalid: "This link no longer works. Sign in to get a new one.", toSignIn:
     "Sign in" }`.
   - `reset: { pageTitle: "Reset password", title, submit: "Change password", submitting, done: "Password changed. Sign in
     with your new password.", invalid: "This link is not valid or has expired.", newLink: "Get a new link", toSignIn }`.
   - `linkChecking: "Checking your link..."`; `unverified.resend: "Resend email"`, `unverified.resending:
     "Sending..."`, `unverified.resent: "We sent a new link. Check your inbox."`.
8. **Pages.** `src/app/<route>/page.tsx`, beside `src/app/sign-in/` and outside `(app)`, following
   `src/app/sign-in/page.tsx` but without `searchParams`. Metadata: `{ title: authCopy.<x>.pageTitle, referrer:
   "no-referrer" }` (Next `Metadata.referrer` emits `<meta name="referrer">`).
9. **Docs.**
   - `work/decisions.md`, new row: `| D53 | 2026-11-20 | simap hosts its own /sign-up, /forgot-password, /verify-email
     and /reset-password pages calling the org-admin-api auth endpoints, as ricotdin; accounts and passwords stay in
     Identity. The sign-in view links to /sign-up and /forgot-password; "Continue as" (D33) stays. The four pages set
     referrer policy no-referrer through page metadata (a meta tag, not a response header). No resend on
     /verify-email; resend lives in the gate's unverified view. Supersedes D33's link targets. Answers Q16, Q34, Q35. |
     (Ming) |`.
   - `docs/spec-v1.md` line 164–165: replace with "simap hosts sign-up, forgot-password, verify-email and
     reset-password pages that call Identity (D53); the sign-in page links to them and lists accounts already signed in
     on this browser as "Continue as <email>" (D33)." Line 182–183: keep "Accounts are created, edited and removed in
     mmlabs Identity", add "(simap only hosts the sign-up and password screens, D53)". Line 512: "Local accounts,
     passwords or SSO/AD inside simap. Identity owns accounts and passwords; simap only hosts the Identity sign-up and
     password-reset screens (D53)."
10. **Checks.** `pnpm format`, then the four loop checks. In `pnpm build` output confirm the four routes are `○`
    (static).

Rules: R1 — lib files import only lib; `src/ui/auth/*` imports lib/ui; pages import `@/ui`, `@/ui/copy/auth` and
`next` types only (`pnpm check:layers`). R3 — no new config or env. R4 — no `returnTo` on the new pages, no resend on
`/verify-email`, no headers config. R5 — tests above. R6 — no org data touched.

## Specialist input used
`consult-frontend-developer.md`:
- Findings "already on main": adopted; they drive the "What changed" table (verified in code).
- Q34 test replacement (`metadata.referrer` assertion instead of `next-config.test.ts`): adopted as
  `account-pages.test.ts`.
- Meta tag vs header wording: adopted (AC9 wording, Ming verification, D53 text).
- Rec 1 (pure `takeLinkToken`, ref-held token, StrictMode guard, click-only verify): adopted.
- Rec 2 (ignore and strip `?token=`): adopted; `takeLinkToken` reads `location.search` too.
- Rec 3 (no `returnTo`, fixed hrefs, email as text): adopted.
- Rec 4 (referrer on all four pages; manual Turnstile check): adopted, see A3.
- Rec 5 (outcome modules): adopted. Its suggestion to map other forgot 4xx to "sent": **rejected** — showing "sent"
  after a failed request misleads the user; instead every non-listed code maps to the same generic error, which is
  equally account-independent (Identity answers 202 for every email).
- Rec 6 (props-only views, `fields.tsx` extraction, show-password toggle): adopted.
- Rec 7 (gate resend handler, `accountId`): adopted; answered its open question 2 — `store.accountId()` is non-null in
  the unverified state (`flow.ts:27`).
- Rec 8 (copy): adopted; no new error codes needed (already present).
- Rec 9, 10 (docs, routes outside `(app)`): adopted. Spec §Out of scope is §9 Non-goals line 512; AUT-03 line 182–183
  also conflicts and is updated.
- Open question 3 (no resend on the `token_invalid` view): yes (Q35). Open question 4 (Continue → `/`): kept `/`.

## Assumptions
- **A1 (Q35 scope).** No Resend on `/verify-email` in any state, including `invalid`; the invalid view links to
  `/sign-in` only, where the gate's unverified view offers Resend. Default as stated.
- **A2 (Continue target).** "Continue" after a successful verify links to `/`. With a stored session the gate restores
  it and mints a fresh token (consumers.md step 4); without one the user sees sign-in. Default: `/` (source plan).
- **A3 (referrer on Turnstile pages).** The ticket's AC says four pages, so `/sign-up` and `/forgot-password` also get
  `no-referrer`. Turnstile checks the hostname through its own widget, not the Referer, so it is expected to work.
  Default: all four. If Ming's manual check shows Turnstile failing there, drop `referrer` on those two pages in a
  follow-up (the link pages `/verify-email` and `/reset-password` keep it).
- **A4 (meta vs header).** `<meta name="referrer">` applies once the head is parsed; the fragment never goes into a
  Referer anyway and is stripped before any request. Accepted by Q34; stated in D53 and the PR description.
- **A5 (SIM-027 interplay).** SIM-027 (BACKLOG) will add a site-wide `Referrer-Policy` header. A document-level meta
  policy overrides the header for that document, so these pages stay `no-referrer`. SIM-027 should keep (or tighten to)
  `no-referrer` for these routes; noted for its planner.
- **A6 (fields refactor).** Moving `Notice` / `Field` / `linkClass` out of `views.tsx` is a pure move needed to avoid
  duplicate components in `account-views.tsx`; the existing view tests stay unchanged.
- **A7 (tudocuatui source).** Port views from `git show origin/main:src/features/auth/<file>`; record differences in
  `impl-log.md` (source plan A7).
- **A8 (no DOM tests).** No `jsdom` / Testing Library (D2, source plan A8). Container effects (token take, guards,
  Turnstile spend) are covered by code review and Ming's manual check; their decisions live in the tested pure modules.
- **A9 (hotspots).** `src/ui/auth/AuthGate.tsx`, `src/ui/auth/views.tsx`, `src/ui/copy/auth.ts` are also planned edits
  of SIM-007 (PLANNING: org picker views, gate states). `src/ui/index.ts` is also edited by SIM-010.2 (PLANNING) and
  SIM-007. Expect a rebase on whichever merges second; conflicts are additive (exports, view states, copy blocks).
- **A10 (tier).** No High path in the file list, so the risk tier is Medium by paths; `src/ui/auth/**` triggers the
  security review (`**/auth*`). The batch plan-approval gate does not apply (Gate `none`).
- **A11 (size).** About 1,100–1,300 changed lines including ~450 lines of tests and ~60 lines of docs, above the ~400
  guide; this is the slice Ming already approved, so no further split (see Split proposal).

## Blocking questions
None.

## Split proposal
None required: this ticket is slice S3 of a split Ming approved. If the reviewer or orchestrator wants smaller PRs, the
natural cut is S3a = `email-link`, `email-flows`, `fields.tsx`, `/verify-email`, `/reset-password`, gate Resend (AC9,
AC11, AC12) and S3b = `/sign-up`, `/forgot-password`, gate hrefs, docs (AC8, AC10, T2); this plan covers both.
