## SIM-009.2 consult (frontend): /accept-invitation page

### Findings
1. **Reusable as is.**
   - `takeLinkToken(window, path)` in `src/lib/identity/email-link.ts` reads `#token=` and calls `replaceState(null,"",path)` before returning. It also clears `?query` and never reads a `?token=`. The regex `{32,128}` fits the 43-char token. `email-link.test.ts` already tests it with a fake window.
   - The `VerifyEmailPage`/`ResetPasswordPage` pattern is the template: `taken` ref guards the StrictMode double effect, the token sits in a `useRef`, `busy` ref guards double submit, and the outcome carries `clearToken`.
   - `src/app/verify-email/page.tsx` is a 9-line page with `metadata.referrer: "no-referrer"`. Next emits `<meta name="referrer">`.
   - `src/app/account-pages.test.ts` is an `it.each` table. Adding `["accept-invitation", accept]` is one line and checks referrer, a non-empty title and `default.length === 0`.
   - Export the page from `src/ui/index.ts` (lines 17-20 show the pattern).
2. **Auth pages are outside AuthGate.** `/verify-email` and `/reset-password` do not mount `AuthGate`; they use `getAuthRuntime()`. `/accept-invitation` must do the same. Do not wrap it in AuthGate: the gate runs `/api/me` and org entry, which would be wrong before accepting.
3. **`SignInView` is presentational only.** Its Turnstile and sign-in logic lives inside AuthGate (`signIn`, lines 462-490: `needTurnstile`, `tsToken`, `spendTurnstile`). The outline's "show SignInView without signUpHref" hides that the page needs its own sign-in handler:
   - `store.signIn`, and on `turnstile_required` set `needTurnstile` and render `TurnstileWidget` as `turnstileSlot`, spending the token on every attempt.
   - Pass `forgotHref="/forgot-password"`. Consider `accounts` and `onContinueAs` (via `client.accounts()` and `store.continueAs`) so an invitee with several signed-in accounts can pick one. That is optional.
   - Do not refactor AuthGate (large, riskier). A small local handler of about 30 lines is enough. Copy the Turnstile pattern from `SignUpPage.tsx`.
4. **`store.signIn` side effects.** `signIn` = `client.login`, then `adopt`, then `renew()`.
   - A fresh invitee gets `not_member` (not yet in the app) from `/token`. The account id and cookie stay set, so treat `not_member` and `email_unverified` as "signed in, continue to Accept".
   - `session_invalid` and other codes (`invalid_credentials`, `turnstile_required`) stay on the sign-in view. Only `not_member` and `email_unverified` continue.
   - `adopt` reads the account's remembered org from `orgStorage`. That is harmless here.
   - The page never calls `store.start()`, so there is no timer or cross-tab channel. That is fine because the page ends in `location.assign("/")`.
5. **"Use another account".** `store.forget()` drops the token and id and clears the org storage. It does not call `/logout`, so other mmlabs apps stay signed in. Correct for this use.
6. **`store.accountEmail()`** may throw (network) or return null (id not in the list). Treat both as "unknown account": show the sign-in view, not a broken Accept.
7. **`selectOrg(orgId)`.** It resets, mints an org token, and writes `orgStorage` only after a successful mint. After `location.assign("/")`, AuthGate's restore uses the remembered org, then `/api/me` creates the member (D16 a). If `selectOrg` throws (`org_access_denied`), the gate lists orgs and picks one, so best effort is right. Catch and ignore, but still navigate.
8. **No new error codes needed.** `invitation_email_mismatch`, `org_invite_unavailable`, `email_unverified`, `session_invalid` and `rate_limited` are already in `types.ts`/`errors.ts` with their own copy (SIM-009). `token_invalid` and `validation_error` are existing codes.
9. **Test environment is `node`** (`vitest.config.ts` line 16). There are no jsdom or component mount tests; existing view tests use `renderToString`. Page-level ref behavior (token survives a mismatch) cannot be tested by mounting.

### Recommendations
- **R-A (AC1, token handling).**
  - First effect step is `takeLinkToken(window, "/accept-invitation")` into a ref, behind a `taken` guard, before any network call or `getAuthRuntime()` call.
  - No token → invalid view and no request.
  - The token must never go into state, props, an `<a href>`, or an error or log. The create-account link must be a fixed `/sign-up` with `target="_blank" rel="noopener noreferrer"`.
  - Add `noreferrer` explicitly, even though the referrer meta tag already exists.
  - A reload loses the token (the fragment is gone). The invalid-view copy should say "open the link from your email again"; the link still works because nothing was consumed.
- **R-B (AC1 and AC3, testable).** Put the decision logic in `src/lib/invitations/accept-flow.ts` as a pure function that returns `clearToken`, mirroring `verifyOutcome`:
  - `acceptOutcome(CallResult & {orgId?})` returns `{kind:"done", clearToken:true}`, `{kind:"invalid", clearToken:true}`, `{kind:"signIn", clearToken:false, error}` or `{kind:"ready", error, clearToken:false, offerOtherAccount?:true}`.
  - The mismatch row asserts `clearToken:false` and `offerOtherAccount`. That is how the test "pins" token survival, since the page is not mountable.
  - Add one table row per code: ok, `token_invalid`, `validation_error`, `invitation_email_mismatch`, `session_invalid`, `email_unverified`, `org_invite_unavailable`, `rate_limited`, `network`, `unknown`, and an unlisted code.
  - Keep the ref-clearing line trivial in the page: `if (out.clearToken) token.current = null`.
  - Optionally extract a small controller (`createAcceptController({takeToken, client, store, navigate})`) in lib or ui with injected fakes, to test "mismatch then correct account still sends the same token" in node. This is stronger than the table alone if the planner has budget.
- **R-C (client).**
  - `client.acceptInvitation({accountId, token})` posts `/auth/invitations/accept` in `cookie` mode with body `{account_id, token}`.
  - Validate `accountId` with `UUID_RE`, as `invite()` does.
  - Parse the 200 as `{orgId, roles}`: `org_id` a UUID (lowercased), `roles` an array of strings. A non-matching 200 → see Risk 1.
  - Use an `AbortSignal.timeout`, like `INVITE_TIMEOUT_MS`.
  - Tests in `identityClient.test.ts` (the `invite` tests are the model): request path, method, credentials include, `X-MM-App`, exact body, strict parse, error codes via `toAuthError`.
- **R-D (UI state).** Views: checking, invalid, signIn, ready ("Accept as <email>", Accept button, "Use another account"), accepting, done (brief "Joining…" before navigation). Keep a `busy` ref against double clicks.
  - Disable "Use another account" while an accept is in flight.
  - Show the mismatch message plus "Use another account". After `forget()` switch to the sign-in view and keep the token ref. The same token then works with the right account (the Ming check).
  - Copy goes in `src/ui/copy/invitations.ts` under `accept.*`. Reuse `authErrorMessage` for errors; `no-literals.test.ts` stays green.
- **R-E (landing, AC4).** On `done`: `try { await store.selectOrg(orgId) } catch {}`, then `location.assign("/")`. Inject `navigate` for tests. Do not `router.push`; a full load is needed so the AuthGate restore and `/api/me` run.
- **R-F (new-account path).** Same-tab navigation to sign-up loses the in-memory token. The new-tab link is right. Add copy to the sign-in view: "Create the account with the invited address, verify it, then come back to this tab and sign in." After verifying in another tab, this tab's Accept works (the cookie session persists). `email_unverified` on accept keeps the token, so a retry after verifying works.
- **R-G (invalid view).** Offer a link to `/` ("Go to simap") so someone whose accept already succeeded is not stranded.
- **Tests list.**
  - `accept-flow.test.ts`: the outcome table.
  - `identityClient.test.ts`: the accept additions.
  - `account-pages.test.ts`: one more row.
  - `views.test.tsx`, or a new `accept-views.test.tsx`: renderToString of the views, checking no token appears in the HTML, the create-account link has `rel="noopener noreferrer"` and `target="_blank"`, the mismatch view has "Use another account", and the sign-in view has no sign-up href to the same tab.
  - `email-link.test.ts` already covers fragment handling. Add one case for the 43-char token, and the check `takeLinkToken(deps, "/accept-invitation")` calls `replaceState(null,"","/accept-invitation")`.

### High-path impact
None expected. No change is needed to `src/proxy.ts` (matcher already covers `/accept-invitation`; CSP `connect-src` already allows the Identity origin), `next.config.*`, `src/server/http/**` or `src/server/identity/**`. R1 holds: the page uses `ui` → `lib` only. The risk-tier CI should report Low/Medium; confirm `git diff --name-only main` has no High globs.

### Risks
1. **A 200 with an unparseable body.** Strict parsing in the outline would throw `unknown` and show a retryable error after Identity already consumed the token. A retry then returns `token_invalid` and "invalid". Suggest a lenient success: if status is 2xx but the body cannot be read, still treat it as `done`, skip `selectOrg` and navigate to `/` (the gate picks the org). Alternatively keep strict, but make the `invalid` copy mention "may already be used". Planner to decide.
2. **Ambiguous network/timeout on accept.** The request may have succeeded server-side. A retry then answers `token_invalid`. The `invalid` view should not claim "never worked" (see R-G).
3. **Per-address mismatch is exact** (Gmail dots and plus tags not folded). The page does not know the invited address, so the copy cannot show it. The mismatch message is generic ("sign in with the invited address").
4. **Referrer.** The meta tag covers fonts and icon requests. The fragment never reaches the server or a Referer header anyway; the meta tag is defense in depth.
5. **bfcache and back navigation** restore the cleaned URL, so no token. A restored page may keep the in-memory token; that is acceptable.
6. **`selectOrg` changes the remembered org** for an account already in another org. This is intended (the user wants the new org) but worth noting for the Ming check.
7. **The Turnstile handler duplicates AuthGate logic.** Keep it small and covered by the same patterns; do not drift from `SignUpPage`.
8. **Until this ships, invitation links 404**, as the ticket notes.

### Open questions
1. Strict versus lenient parsing of the accept 200 (Risk 1)?
2. Show the `accounts` "Continue as" list on the sign-in view? It is optional. If not, the sign-in view is simpler but a device with two signed-in accounts loses the shortcut.
3. Resend-verification button for `email_unverified` on this page, or just the message plus "open the email link, then Accept again"? Recommend the message only (out of scope for a resend flow).
4. Does the accept request need the account's cookie only (as `consumers.md` implies) or also a bearer? The contract shows cookie mode with `{account_id, token}` and no bearer, so no `/token` call is needed before accepting. Please confirm with a real call during the M-1 manual test.
5. Is a controller extraction (R-B optional part) in budget for the M-size ticket?

Files read: `/home/user/simap/work/tickets/SIM-009.2/ticket.md`, `/home/user/simap/work/tickets/SIM-009/plan.md` (Split proposal), `/home/user/mmlabs-online/org-admin-api/docs/consumers.md` (Invitations), `/home/user/simap/src/lib/identity/email-link.ts`, `/home/user/simap/src/lib/identity/email-flows.ts`, `/home/user/simap/src/ui/auth/{VerifyEmailPage,ResetPasswordPage,identityClient,tokenStore,views,AuthGate,runtime}.ts(x)`, `/home/user/simap/src/app/account-pages.test.ts`, `/home/user/simap/src/app/verify-email/page.tsx`, `/home/user/simap/src/proxy.ts`, `/home/user/simap/src/lib/invitations/invite-flow.ts`.
