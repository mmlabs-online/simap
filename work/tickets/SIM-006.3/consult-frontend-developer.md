# Consult — frontend-developer — SIM-006.3 (2026-11-20, batch 2026-11-20-4)

Consult for SIM-006.3 (S3). Read-only; I read ticket, plan S3 (AC8-12, files table, design points 10-14) and the merged S2 code. I did not open work/batches/2026-11-20-2.md, so Q16/Q34/Q35 come from the ticket and plan only.

## Findings

**Already on main from S1/S2 (reuse, do not rebuild)**
- `src/ui/auth/identityClient.ts` already has `signup`, `verifyEmail`, `forgotPassword`, `resetPassword`, `resendVerification(accountId)`. Credential modes are already set: signup and forgot send X-MM-App with credentials omitted; verify and reset are public with no app header; resend uses cookie credentials.
- `src/ui/auth/runtime.ts`: `getAuthRuntime()` returns `{client, store, apiFetch, turnstileSiteKey}`. It is lazy, so it is safe to call in an effect or in an event handler, never at module scope or SSR render.
- `src/ui/auth/TurnstileWidget.tsx` already has the `siteKey` and `resetKey` props, plus `onToken`, `onExpire` and `onError`. It renders nothing without a site key and calls `onError` in that case.
- `src/lib/identity/errors.ts`: `SERVER_AUTH_ERROR_CODES` already includes `email_taken`, `weak_password`, `token_invalid`, `email_already_verified`, `validation_error` and `rate_limited`. `toAuthError` already parses `weak_password` reasons (`too_short` / `too_common`) and `retryAfterSeconds`. No lib/errors change is needed.
- `src/lib/validate/credentials.ts` already has `validateSignUp`, `validateNewPassword`, `emailError`, `hasErrors` and the `PASSWORD_*` constants.
- `src/ui/auth/views.tsx` (all `"use client"`, props-only views). Reuse these:
  - the `AuthLayout` frame (D52 pixel frame, `scene` prop);
  - the private `Notice` (`role=alert` or `status`) and the `linkClass`;
  - the private `Field`, which is typed `icon: "mail" | "login"` and has no password-confirm or show-password toggle.

  `Notice`, `Field` and `linkClass` are not exported. `SignInView` already accepts `signUpHref` and `forgotHref` and renders them only when set.
- `src/app/sign-in/page.tsx` is the page pattern: thin server page, `metadata.title: authCopy.pageTitle`, renders a container from `@/ui`.
- `src/ui/index.ts` exports `AuthGate`, `SignInRoute`, `useApiFetch`, so the four containers get added there.
- Tests: `views.test.tsx` uses `renderToStaticMarkup` with `describe/it`; `copy/auth.test.ts` exists.
- There is no `src/app/**` metadata `referrer` anywhere yet. Root layout has `metadata.title` only.

**What the plan says that has changed since**
- Q34 drops the `next.config.ts` `headers()` change. The `next-config.test.ts › ... Referrer-Policy` verification row in AC9 is therefore void. Replace it with a test that the page modules export `metadata.referrer === "no-referrer"`. Page modules import only `@/ui` and copy, so a Vitest `import` of `src/app/<x>/page` should work, but check that it does.
- `metadata.referrer` emits `<meta name="referrer">`, not a response header. The plan's "Ming verification" step (DevTools response header `Referrer-Policy`) must change to inspecting the `<meta name="referrer" content="no-referrer">` in the document head. The ticket and plan wording ("send Referrer-Policy") should be corrected in the PR description and decision entry.
- The unverified view already exists on main. The S3 delta is only: add Resend (props `onResend`, `resend` state: idle/sending/sent/rate-limited) and wire it in `AuthGate`.

**High-path hygiene**
- High path hits that matter: `**/config.*`, which matches `src/lib/identity/config.ts` and any `config.ts` you might add, plus `next.config.*`, `src/proxy.*` and `src/server/identity/**`.
- S3 needs none of them: `email-link.ts` and `email-flows.ts` are new files in `src/lib/identity/`. Do not name anything `config.*` or `*auth*` in `src/lib`, `src/server` or `src/app`. Do not touch `.env.example` or `scripts/check-layers.mjs`.
- `src/ui/auth/**` matches the security-review trigger `**/auth*` (a review trigger, not a High path). It is expected.
- Confirm `/verify-email` and `/reset-password` are not intercepted by `src/proxy.*` (read it, do not edit). It probably has no matcher for them.

## Recommendations

1. **Link token (AC9).**
   - `takeLinkToken({location, history}, path)` is pure with injected deps. Read `location.hash`, call `history.replaceState(null, "", path)` before returning, and return `null` when the hash is invalid.
   - Keep the original path without the query. Do not call `router.replace`: it triggers a navigation and an RSC fetch.
   - Container: `useRef` holds the token; render a "checking link" state with the same markup on SSR and first client render. Run the effect once and guard against React StrictMode double-invoke with a ref flag.
   - Under StrictMode the second effect run would find the hash already removed and wrongly show "invalid". Store the taken token in a ref and skip the second take.
   - Verify and reset must never call the network on mount. Verify posts from the button only, with a single-use guard that is set before the await and never cleared on success.
   - Never put the token in React state that renders, in a log, in an error message or in a copy string.
2. **Query-string links.** Accept only `#token=` (plan, `^#token=([A-Za-z0-9_-]{32,128})$`). If the mail contains `?token=`, ignore it (it would already have hit the server and logs), show "invalid link", and strip the query as well. Never read the token from `searchParams` in the server page: the pages must stay static and take no `searchParams`.
3. **Open redirects.** The four new pages take no `returnTo`. Fixed hrefs only: `/sign-in`, `/forgot-password`, `/`. If sign-up should preserve `returnTo`, route it through the existing `safeReturnTo` (`src/lib/identity/return-to.ts`); I would not (R4). Never render the email or the token as a link target. Show the sign-up email as text only; the existing `break-words` / `break-all` classes handle long addresses.
4. **Referrer.** Export `metadata = { title, referrer: "no-referrer" }` on all four pages. Note that Turnstile on `/sign-up` and `/forgot-password` loads a cross-origin script and iframe: it is verified for hostname via the widget, not the Referer, but confirm manually. If it breaks, drop `referrer` on those two only and flag it in the PR. The ticket's AC says four pages, so tell Ming if that changes.
5. **Pure flow modules (AC10, AC11).** In `email-flows.ts`, one function per flow returning a discriminated outcome, for example `{kind: "sent"} | {kind: "error", error, resetTurnstile: boolean, ...}`.
   - `signUpOutcome`: ok → sent; `email_taken` → own message; `turnstile_failed` / `turnstile_required` → reset the widget; `rate_limited` → wait text; others → generic.
   - `forgotOutcome(202)` → sent. Consider also mapping 4xx other than `turnstile_failed`, `validation_error` and `rate_limited` to sent, so no account-existence signal leaks. Do not show `email_unverified` or `not_member`.
   - `verifyOutcome`: ok → verified; `token_invalid` → invalid with a sign-in link; network → retry with the token kept and the guard released only for network errors.
   - `resetOutcome`: ok → done; `token_invalid` → get-a-new-link; `weak_password` → reasons, form stays and the token stays usable; `rate_limited` → wait text.
   - Table-test every outcome.
   - Tests for `email-link.ts` use fake `{location: {hash}, history: {replaceState: vi.fn()}}`. Assert that the `replaceState` call order precedes the return, and that a bad hash still strips the fragment.
6. **Views and tests without jsdom.**
   - Put each view in `account-views.tsx` as props-only components, with state passed in (`status`, `error`, `sent`, `values`) so `renderToStaticMarkup` covers each state. Assertions are on strings: neutral text, the "Verify" button present, no `<form>` auto-post, link hrefs, `role="alert"` for errors, `aria-describedby` wiring.
   - Form views hold local `useState` for inputs, as `SignInView` does, and the initial render is static-testable. Interaction logic (submit validation) lives in a pure helper (`validateSignUp` etc.) that is already tested.
   - Container effects (Turnstile token handling, guard) cannot be exercised without jsdom. Keep them thin, review them by code, and move any decision (for example `shouldPost(guard)`, `nextTurnstileKey`) into pure helpers.
   - Extract `Notice`, `Field` and `linkClass` from `views.tsx` into a shared file (`fields.tsx`) rather than duplicating. Extend `Field` with an icon union and the `type` prop. Add a password field with a show-password toggle, reusing `authCopy.fields.showPassword`.
   - Add `SignInView links to /sign-up and /forgot-password` as AC8 requires.
7. **Gate (AC12).**
   - `AuthGate`: pass `signUpHref="/sign-up"` and `forgotHref="/forgot-password"` to `SignInView`. The resend handler (accountId from the gate's stored account) maps 409 `email_already_verified` to a token re-check, 429 to a wait text, 401 `session_invalid` to sign-in, and ok to the sent state.
   - `UnverifiedView` stays presentational and gets new optional props.
   - Check how `AuthGate` knows the account id in the unverified state (`accountId.ts` / `mm_account_id`); if it is not available there, flag it.
8. **Copy (D36).** Add all strings to `src/ui/copy/auth.ts`, including `authErrorMessage` entries for the new codes. Extend `copy/auth.test.ts › covers every AuthErrorCode`. English only.
9. **Docs deliverables.** Add a `work/decisions.md` entry superseding D33's link targets (Q16: own pages; Q34: meta referrer instead of config header; Q35: no resend on `/verify-email`). Update spec AUT-01 (~line 164) and §Out of scope (~line 489). Check the spec for any Referrer-Policy header wording.
10. **Routes.** Place the four pages as `src/app/{sign-up,forgot-password,verify-email,reset-password}/page.tsx`, outside `(app)`. Confirm via the `pnpm build` route list that they are static and the gate does not wrap them. Run `pnpm check:layers` (pages import only `@/ui`, `@/lib` and copy).

## Risks
- **Plan and ticket drift on referrer.** The plan's AC9 / S3 text still says `next.config.ts` and a response header, and the ticket's AC says "set via metadata.referrer". A reviewer following the plan literally would fail it. State the Q34 override in the plan handoff and the PR.
- **`<meta name="referrer">` is weaker than a header.** It applies after the head is parsed. The fragment never goes in Referer anyway, and the initial request's Referer is the mail client's. It is acceptable per Q34 and is not a fragment leak, but say so.
- **StrictMode double-effect** consumes the fragment on the first run and shows a false "invalid link" on the second. Needs the ref guard (rec 1).
- **Mail scanners / prefetch.** Verifying only on click (AC12) is correct. Do not auto-post from a `useEffect`, even a "silent" one.
- **Account enumeration.** `forgotOutcome` must not vary by error code. Sign-up `email_taken` is a deliberate disclosure (plan AC11), so keep it.
- **`weak_password` retry.** After a failed reset the token is still valid, so keep it in the ref and do not clear it. Do clear it after `token_invalid` and after success.
- **Turnstile single-use tokens.** After every attempt, whether it succeeds or fails, bump `resetKey` and clear the stored token, otherwise the second submit sends a used token (`turnstile_failed`).
- **Logging.** Make sure no `console.*` or error boundary prints the token or password. Keep the token out of `error.message`.
- The size estimate in the plan (about 800 lines, 8-12 files) is about right. Shared field extraction adds one file.

## Open questions
1. Confirm that "four pages" for `metadata.referrer` includes sign-up and forgot, where Turnstile runs. This is fine in principle but needs a manual check.
2. Does `AuthGate`'s unverified state have the `accountId` for `resendVerification`? If not, where does it come from?
3. Is the Q35 "no resend on /verify-email" also to be mirrored in the `token_invalid` view (only a sign-in link, as the plan says)? I assume yes.
4. Which path does the Verify success "Continue" link use: `/` (plan) or `/sign-in`? `/` relies on the gate restoring the session, so it will show sign-in if there is no session. Plan keeps `/`.

Files referenced: work/tickets/SIM-006/plan.md, src/ui/auth/views.tsx, src/ui/auth/identityClient.ts, src/ui/auth/runtime.ts, src/ui/auth/TurnstileWidget.tsx, src/ui/auth/AuthLayout.tsx, src/lib/identity/errors.ts, src/lib/validate/credentials.ts, src/app/sign-in/page.tsx, src/ui/index.ts, .claude/loop.config.md.
