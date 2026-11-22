Status: READY

# Plan — SIM-009.2: Accept-invitation page

**High paths: none.** No file in this plan matches a High glob in `.claude/loop.config.md` (no `src/proxy.*`,
`next.config.*`, `src/server/**`, `**/config.*`, migrations or `.env.example`). The plan approval gate does not apply.
Areas include `security`, so the `security-ai-generated-code-auditor` review trigger runs anyway (and `src/ui/auth/**`
may also match its `**/auth*` path).

## Scope summary
- Ticket goal: "Invitees accept an org invitation on simap's `/accept-invitation` page and land in the org as a new
  member. Slice 2 of SIM-009."
- Spec AUT-03 (`docs/spec-v1.md:187-189`): "simap implements the invitation form and the `/accept-invitation` page from
  the contract (fragment token cleared, `Referrer-Policy: no-referrer`, sign-in with exactly the invited address)."
- D11: "People join an org by invitation: org admins/managers invite by email from simap (Identity invitations)".
- D14: "`simap:member` (app-scope default) ...": accepting joins the app with the default role (contract below).
- D16 (a): "a member appears on the account's first visit". `/api/me` creates the member when the user first lands
  on `/` inside the org. This ticket does not change the server.
- D53: "The four pages set referrer policy no-referrer through page metadata (a meta tag, not a response header)."
  `/accept-invitation` follows the same rule. That D53 decision is how simap meets the contract's
  `Referrer-Policy: no-referrer`.
- Contract, org-admin-api `docs/consumers.md:186-191`: "read the token from the fragment, clear it with
  `history.replaceState`, serve it with `Referrer-Policy: no-referrer`, make the user sign in (or sign up and verify)
  with **exactly the invited address** ... then `POST /api/v1/auth/invitations/accept` `{account_id, token}`. Success
  is `200 {org_id, roles}`; accepting also joins the app (default role) if the account is not a member, then
  `/auth/token` with `org_id` works."
- Contract `consumers.md:201-205`: `403 org_invite_unavailable`, `403 email_unverified`,
  `403 invitation_email_mismatch` ("the token is for another address; not consumed"), `422 token_invalid`.
- Outline: `work/tickets/SIM-009/plan.md:299-330` (Split proposal, slice 2).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The invitation token never stays in the URL, history, logs or a referrer. | `email-link.test.ts` › "takes a 43-char token and replaces state with /accept-invitation" (replaceState called before any network call). `acceptController.test.ts` › "start takes the token before any store or client call" and "no token → invalid, no request". `account-pages.test.ts` row `accept-invitation` (`metadata.referrer === "no-referrer"`). `accept-views.test.tsx` › "no view renders the token" and "create-account and forgot links open a new tab with rel noopener noreferrer". Code read: the token exists only in the controller closure. It is never in React state or props, an `href`, an error or a `console.*` call (`grep -n "console\." src/ui/auth/accept* src/ui/auth/AcceptInvitationPage.tsx` returns nothing). |
| 2 | Accepting with a different email shows the mismatch message and does not consume the token. | `accept-flow.test.ts` › row `invitation_email_mismatch` → `{kind:"ready", clearToken:false, offerOtherAccount:true}`. `acceptController.test.ts` › "mismatch keeps the token: use another account, sign in, accept sends the same token". `accept-views.test.tsx` › "mismatch shows the mismatch message and Use another account". Identity does not consume the token on this answer (contract `consumers.md:203`). |
| 3 | After accepting, the user lands in the org as a new member. | `acceptController.test.ts` › "ok → selectOrg(org_id) then navigate('/')", "selectOrg rejects → still navigates", "ok with unreadable body (orgId null) → no selectOrg, navigates". End to end: see Ming verification. |
| 4 | Unit tests cover fragment handling and the accept outcome mapping. | `pnpm test` is green with the tests listed in *Tests to write* (email-link, accept-flow, acceptController, identityClient accept). |

All Checks in `loop.config.md` must be green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`,
`pnpm build`.

## Ming verification after merge
Needs M-1 (a working Identity app setup for invitations) and a second account:
- Invite address B from simap (SIM-009). Open the email link while signed in as account A. The page shows "Accept as
  A". Click Accept: the mismatch message appears. Click "Use another account", sign in as B, click Accept. B lands on
  `/` inside the org and sees the profile screen (the member was created on first visit, D16 a).
- DevTools: the address bar and history hold no `#token`. The page `<head>` has
  `<meta name="referrer" content="no-referrer">`. The Network tab shows `POST …/auth/invitations/accept` with only the
  cookie (no bearer) and body `{account_id, token}` (open question 4 in the consult).
- Reload `/accept-invitation`: the invalid view appears ("open the link from your email again") with a "Go to simap"
  link.
- Optional: invite a fresh address, use "Create an account" (new tab), verify it, return to the first tab, sign in and
  accept.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/app/accept-invitation/page.tsx` | create | Thin page (about 9 lines, copy of `src/app/verify-email/page.tsx`). `metadata = { title: invitationsCopy.accept.pageTitle, referrer: "no-referrer" }` (D53). Renders `<AcceptInvitationPage />`. No `AuthGate`. | no |
| `src/app/account-pages.test.ts` | modify | Add `["accept-invitation", accept]` to the `it.each` table (lines 8-13). | no |
| `src/lib/invitations/accept-flow.ts` | create | Pure `acceptOutcome` and `signInOutcome` (decision tables, see Approach 1). | no |
| `src/lib/invitations/accept-flow.test.ts` | create | Outcome tables. | no |
| `src/lib/identity/email-link.test.ts` | modify | Two cases for `/accept-invitation`. `email-link.ts` does not change. | no |
| `src/ui/auth/identityClient.ts` | modify | Interface member plus implementation of `acceptInvitation`, `ACCEPT_TIMEOUT_MS = 15000` next to `INVITE_TIMEOUT_MS` (line 48). Implementation goes after `invite` (lines 253-276). | no |
| `src/ui/auth/identityClient.test.ts` | modify | New `describe("acceptInvitation")` after `describe("invite")` (line 437). Add the call to the per-call credentials table (`describe("credentials and X-MM-App per call")`, line 316). | no |
| `src/ui/auth/acceptController.ts` | create | Framework-free controller: holds the token in a closure and drives the views. Its dependencies are injected (`takeToken`, `client`, `store`, `navigate`, `onChange`), so it can be tested in node. | no |
| `src/ui/auth/acceptController.test.ts` | create | Controller tests with fakes. | no |
| `src/ui/auth/accept-views.tsx` | create | Presentational views: checking, invalid, ready/accepting (with error and "Use another account"), done. Plus the `intro`/`footer` content for the sign-in view. | no |
| `src/ui/auth/accept-views.test.tsx` | create | `renderToStaticMarkup` tests (same style as `account-views.test.tsx`). | no |
| `src/ui/auth/AcceptInvitationPage.tsx` | create | `"use client"` page body. Creates the controller once (behind a `taken` ref), owns the Turnstile widget state (SignUpPage pattern) and renders the views. Never calls `store.start()` or mounts AuthGate. | no |
| `src/ui/auth/views.tsx` | modify | `SignInView` gains two optional props, `intro?: ReactNode` (rendered after the error notice, before the accounts list and form) and `footer?: ReactNode` (rendered after the forgot/sign-up links). Existing callers are unchanged. | no |
| `src/ui/auth/views.test.tsx` | modify | One test: `intro` and `footer` render when given. Existing markup is unchanged when they are omitted. | no |
| `src/ui/copy/invitations.ts` | modify | Add an `accept` block (see Approach 6). | no |
| `src/ui/index.ts` | modify | `export { AcceptInvitationPage } from "./auth/AcceptInvitationPage";` after line 20. | no |

The ticket's Technical notes list `src/app/accept-invitation/*`, `AcceptInvitationPage.tsx`, `identityClient.ts` and
`accept-flow.ts`. The views file, the controller, the copy block, the `views.tsx` props and the `index.ts` export are
the minimum supporting files for those (the consult names copy, views and the index export). Record this in impl-log.

## Data model / migration
None.

## API contract
No simap endpoint changes. One new outbound Identity call from the browser:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `{IDENTITY_BASE}/auth/invitations/accept` | `cookie` mode (`credentials: "include"`, `X-MM-App`), body `{account_id, token}`, no bearer | `200 {org_id, roles}` → `{ orgId: string \| null }` (see Approach 2) | 403 `invitation_email_mismatch`, `email_unverified`, `org_invite_unavailable`, `session_invalid`; 422 `token_invalid`, `validation_error`; 429 `rate_limited`; `network`; `unknown` | Identity session cookie of `account_id` |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/identity/email-link.test.ts` › "takes a 43-char token and replaces state with /accept-invitation" | AC1, AC4: fragment handling for this page (fake deps; `replaceState(null, "", "/accept-invitation")`). |
| `src/lib/identity/email-link.test.ts` › "/accept-invitation?token=… is never read, still cleaned" | AC1: query token ignored and cleared. |
| `src/lib/invitations/accept-flow.test.ts` › `acceptOutcome` table | AC2, AC4. Rows: ok with orgId → `done, clearToken:true, orgId`; ok with `orgId: null` → `done, clearToken:true, orgId:null`; `token_invalid` and `validation_error` → `invalid, clearToken:true`; `invitation_email_mismatch` → `ready, clearToken:false, offerOtherAccount:true, error`; `session_invalid` → `signIn, clearToken:false, error`; `email_unverified`, `org_invite_unavailable`, `rate_limited` (with `retryAfter`), `network`, `unknown`, and an unlisted code (e.g. `not_member`) → `ready, clearToken:false, error` passed through unchanged, no `offerOtherAccount`. |
| `src/lib/invitations/accept-flow.test.ts` › `signInOutcome` table | ok, `not_member`, `email_unverified` → `continue`; `turnstile_required` → `signIn` with `needTurnstile:true`; `invalid_credentials`, `turnstile_failed`, `rate_limited`, `session_invalid`, `network`, `unknown` → `signIn` with the error. |
| `src/ui/auth/identityClient.test.ts` › "acceptInvitation posts /auth/invitations/accept with {account_id, token}" | Path, `POST`, `credentials: "include"`, `X-MM-App`, exact JSON body, a `signal` is set. |
| `src/ui/auth/identityClient.test.ts` › "acceptInvitation returns lowercase orgId; ignores roles" | Parse of the 200. |
| `src/ui/auth/identityClient.test.ts` › "acceptInvitation 2xx with unreadable body or non-UUID org_id → orgId null" | Lenient success (Risk 1 decision). |
| `src/ui/auth/identityClient.test.ts` › "acceptInvitation rejects unknown for a non-UUID accountId without a request" | Input guard (`fetchFn` not called). |
| `src/ui/auth/identityClient.test.ts` › "acceptInvitation maps 403/422/429 codes via toAuthError" | `invitation_email_mismatch`, `token_invalid`, `rate_limited`, plus network failure → `network`. |
| `src/ui/auth/identityClient.test.ts` › credentials table row for `acceptInvitation` | cookie mode. |
| `src/ui/auth/acceptController.test.ts` › "no token → invalid, no store or client call" | AC1. |
| … › "start takes the token before any store or client call" | AC1 (call order recorded by the fakes). |
| … › "known account with email → ready(email); accountEmail null or throws → signIn" | Consult finding 6. |
| … › "signIn not_member / email_unverified → ready with the account email" | Consult finding 4. |
| … › "signIn invalid_credentials stays on signIn with the error; turnstile_required sets needTurnstile and asks to spend" | Turnstile handling. |
| … › "mismatch keeps the token: use another account (forget called), sign in, accept sends the same token" | AC2 (the core check that the token survives). |
| … › "session_invalid on accept → forget, signIn view, token kept; next accept sends it" | Stale stored account id. |
| … › "ok → selectOrg(orgId) then navigate('/'); token cleared (second accept() sends nothing)" | AC3. |
| … › "selectOrg rejects → still navigates to '/'" | Best-effort org entry (consult finding 7). |
| … › "ok with orgId null → no selectOrg, navigates" | Lenient success. |
| … › "token_invalid → invalid view, token cleared" | Used/expired link. |
| … › "double accept() while in flight sends one request; useOtherAccount ignored while accepting" | `busy` guard (consult R-D). |
| `src/ui/auth/accept-views.test.tsx` › "no view renders the token" | AC1: render every view (and the sign-in intro and footer) with a sentinel token value present in the test scope; markup does not contain it. Also no `#token` and no `token=`. |
| … › "create-account and forgot links open a new tab with rel noopener noreferrer" | AC1, R-F: `href="/sign-up"` and `href="/forgot-password"` each with `target="_blank"` and `rel="noopener noreferrer"`. |
| … › "mismatch shows the mismatch message and Use another account" | AC2. |
| … › "ready shows Accept as <email> (Vietnamese diacritics kept), accepting disables both buttons" | Domain focus: diacritics. Busy state. |
| … › "invalid view has a link to / and the open-the-email-again text" | R-G, Risk 2. |
| `src/ui/auth/views.test.tsx` › "SignInView renders intro and footer when given" | New optional props. |
| `src/app/account-pages.test.ts` › row `accept-invitation` | AC1 (meta referrer), title, no props. |

## Approach
1. **Pure flow (`src/lib/invitations/accept-flow.ts`)**, imports `CallResult`-style types from `@/lib/identity/*` only
   (R1 lib → lib). Mirror `verifyOutcome` (`src/lib/identity/email-flows.ts:43-54`):
   ```ts
   export type AcceptResult = { ok: true; orgId: string | null } | { ok: false; error: AuthError };
   export type AcceptOutcome =
     | { kind: "done"; orgId: string | null; clearToken: true }
     | { kind: "invalid"; clearToken: true }
     | { kind: "signIn"; error: AuthError; clearToken: false }
     | { kind: "ready"; error: AuthError; clearToken: false; offerOtherAccount?: true };
   export function acceptOutcome(r: AcceptResult): AcceptOutcome;
   export type SignInStep = { kind: "continue" } | { kind: "signIn"; error: AuthError; needTurnstile?: true };
   export function signInOutcome(r: CallResult): SignInStep;
   ```
   Mapping as in *Tests to write*. Anything unlisted keeps the token, so a retry never burns a still-valid link.
2. **Client (`identityClient.ts`).** Add to `IdentityClient`:
   `acceptInvitation(v: { accountId: string; token: string }): Promise<{ orgId: string | null }>` with a doc comment
   (cookie mode, no bearer, call only from the Accept click). Implementation:
   - `if (!UUID_RE.test(accountId)) throw unknownError();`
   - `post("/auth/invitations/accept", { account_id: accountId, token }, "cookie", AbortSignal.timeout(ACCEPT_TIMEOUT_MS))`.
   - Errors go through the existing `post` → `toAuthError` and `networkError`.
   - **Lenient success:** `org_id` that is a string passing `UUID_RE` → `orgId: org_id.toLowerCase()`, otherwise
     `orgId: null`. `roles` are ignored: simap authorizes from `org_roles` in its own token (R6). The reason: the token
     is already consumed on a 2xx, so throwing `unknown` would show a retry that can only fail. A 204 or non-JSON body
     gives `json = null` in `post`, which must yield `orgId: null`.
   - The token is never placed in an error, a URL or a log.
3. **Controller (`src/ui/auth/acceptController.ts`)**, a plain TS module with no React. The `"server-only"` rule does
   not apply (ui layer). Imports are type-only from `./identityClient`, `./tokenStore` and `@/lib/...`.
   ```ts
   export type AcceptView =
     | { kind: "checking" } | { kind: "invalid" } | { kind: "done" }
     | { kind: "signIn"; status: "idle" | "submitting"; error: AuthError | null; needTurnstile: boolean }
     | { kind: "ready"; email: string; status: "idle" | "accepting"; error: AuthError | null; offerOtherAccount: boolean };
   export function createAcceptController(deps: {
     takeToken: () => string | null;
     client: Pick<IdentityClient, "acceptInvitation">;
     store: Pick<TokenStore, "accountId" | "accountEmail" | "signIn" | "forget" | "selectOrg">;
     navigate: (path: string) => void;
     onChange: (v: AcceptView) => void;
   }): {
     start(): Promise<void>;
     signIn(v: { email: string; password: string; turnstileToken?: string }): Promise<{ spendTurnstile: boolean }>;
     accept(): Promise<void>;
     useOtherAccount(): void;
   };
   ```
   - `start`: `token = takeToken()` first. If null, emit `invalid` and return. If `store.accountId()` is set, try
     `accountEmail()`: an email emits `ready`. A null or a throw emits `signIn`.
   - `signIn`: map with `signInOutcome`. `continue` → `accountEmail()` → `ready` (if the email is still null, fall back
     to the email the user typed). `spendTurnstile` is true when `needTurnstile` was set or the code is
     `turnstile_required`, as in `AuthGate.tsx:483-484`.
   - `accept`: guard `busy || !token`. If `store.accountId()` is null, go to `signIn`. Call the client, map with
     `acceptOutcome`, then `if (out.clearToken) token = null`. `done` emits `done`, then
     `if (orgId) try { await store.selectOrg(orgId) } catch {}`, then `navigate("/")`. `signIn` (session_invalid)
     calls `store.forget()` and emits `signIn` with the error. `ready` re-emits `ready` with the error and
     `offerOtherAccount`. `invalid` emits `invalid`.
   - `useOtherAccount`: ignored while accepting. Otherwise `store.forget()` (no `/logout`, other mmlabs apps stay
     signed in) and emit `signIn`. The token is kept.
4. **Views (`src/ui/auth/accept-views.tsx`).** Reuse `AuthLayout`, `Notice`, `linkClass` from `./fields`, `Button`,
   `LinkCheckingView` (checking) and `authErrorMessage`.
   - `AcceptReadyView({ email, status, error, offerOtherAccount, onAccept, onOtherAccount })`. "Accept as <email>"
     uses `break-all` like `views.tsx:91`. Both buttons are disabled while accepting. The "Use another account" button
     is always shown in ready (the consult's "offer" flag only adds emphasis). Keep it simple: always show it.
   - `AcceptInvalidView()`: the invalid text and `<a href="/">` "Go to simap".
   - `AcceptDoneView()`: busy notice "Joining…".
   - `AcceptSignInIntro()`: hint "Sign in with the email address the invitation was sent to."
   - `AcceptSignInFooter()`: the new-account hint, plus `<a href="/sign-up" target="_blank" rel="noopener noreferrer">`
     and `<a href="/forgot-password" target="_blank" rel="noopener noreferrer">`.
   - No literals in JSX (`no-literals.test.ts`).
5. **Page (`AcceptInvitationPage.tsx`).** Follows the `VerifyEmailPage.tsx:16-32` pattern.
   - State: `view` (AcceptView) plus Turnstile state (`tsKey`, `tsToken` ref; `SignUpPage.tsx:17-27,59-73`).
   - A `taken` ref guards the StrictMode double effect. Inside it, create the controller once with
     `takeToken: () => takeLinkToken(window, "/accept-invitation")`, `getAuthRuntime()`'s client and store,
     `navigate: (p) => window.location.assign(p)` (a full load, so AuthGate restore and `/api/me` run; not
     `router.push`) and `onChange: setView`. Then call `start()`.
   - `takeLinkToken` runs inside `start()` before any network call. `getAuthRuntime()` builds no network traffic
     itself.
   - Sign-in handler: if `view.needTurnstile` and there is no `tsToken`, show `turnstile_required` locally (as
     `AuthGate.tsx:464-466`). Otherwise call `controller.signIn({...v, turnstileToken})`, then spend if asked.
   - Render: `checking` → `LinkCheckingView`. `signIn` → `SignInView` with `intro`, `footer`, `turnstileSlot`,
     `turnstileRequired`, no `signUpHref` and no `forgotHref` (same-tab links would lose the token). `ready`, `invalid`
     and `done` → their views.
   - The token is never in React state.
6. **Copy (`src/ui/copy/invitations.ts`)**: add `accept: { pageTitle: "Accept invitation", title: "Join an
   organization", signInHint, newAccountHint ("Don't have an account? Create one with the invited address in a new
   tab, verify it, then come back to this tab and sign in."), createAccount, forgotPassword, acceptAs: (email) =>
   ..., accept, accepting, otherAccount: "Use another account", joining: "Joining…", invalidTitle, invalid ("This
   invitation link is not valid, has expired or was already used. If you opened it before, open the link from your
   email again; if you already accepted, go to simap."), goHome: "Go to simap" }`. English only, no diacritics. Error
   messages stay in `authCopy.errors` (no new codes).
7. **Wire-up**: page file, `index.ts` export, `account-pages.test.ts` row.
8. Run every Check. Confirm `git diff --name-only main` has no High glob.

Rules:
- R1: page → ui; ui → lib; lib → lib. No `src/server` import. `pnpm check:layers` must pass.
- R3: no new env (the Identity base and Turnstile key come from the existing runtime).
- R4: only the files above.
- R5: tests listed.
- R7, R6, R2: not touched (no route handler, no query, no schema).
- D53: meta tag, not a header.
- D36: copy in `src/ui/copy/invitations.ts`.

## Specialist input used
From `consult-frontend-developer.md`:
- Adopted findings 1-9 and R-A (token in a closure/ref, `takeLinkToken` first, no token means no request, fixed
  new-tab `/sign-up` link with `noopener noreferrer`).
- Adopted R-B (pure `acceptOutcome` with `clearToken`). Also adopted the optional controller extraction (open
  question 5): it is the only way to test the AC2 claim "same token after a mismatch" in the `node` test environment
  (finding 9). The controller lives in `src/ui/auth/`, not `lib`, because it uses `TokenStore` and `IdentityClient`
  types from ui.
- Adopted R-C, with lenient success instead of a strict parse (open question 1, Risk 1).
- Adopted R-D, R-E, R-F and R-G.
- Partially adopted R-A/R-F on `forgotHref`: not passed to `SignInView`, because that link opens in the same tab and
  would drop the token. A new-tab forgot link goes in the footer instead.
- Rejected the outline's "show SignInView without signUpHref" as the whole answer: the page needs its own sign-in and
  Turnstile handler (consult finding 3). That handler lives in the controller and the page, and AuthGate is not
  refactored (consult finding 3).
- Adopted the consult's tests list (views tests in a new `accept-views.test.tsx`).

## Assumptions
- **Open question 1, accept 200 parsing: lenient.** A 2xx is success whatever the body. `orgId` is null when
  `org_id` is not a UUID, and then the page skips `selectOrg` and goes to `/` (the gate lists orgs). The reason: the
  token is already consumed, so a strict failure could only lead to a dead retry.
- **Open question 2, "Continue as" list on this sign-in view: not in this ticket.** It is optional (consult). Without
  it the user types their credentials. Candidate follow-up: reuse `client.accounts()` + `store.continueAs`.
- **Open question 3, resend verification on `email_unverified`: no.** The page shows the existing
  `authCopy.errors.email_unverified` message and keeps the token, so Accept works again after verifying. This matches
  D53 ("No resend on /verify-email"; resend lives in the gate).
- **Open question 4, cookie only, no bearer:** as the contract shows (`consumers.md:189`, and the invite call in
  cookie mode). No `/token` call happens before accepting. Ming confirms in the Network tab during the M-1 check.
- **Open question 5, controller: in budget** (see Specialist input).
- Accept is sent only from the Accept button, never on load (same rule as `/verify-email`, and the outline's
  "called only from the Accept button").
- After `store.forget()` the page shows the sign-in form. A stale stored account id (Identity session ended) shows up
  as `session_invalid` on accept. The controller then forgets it and shows sign-in with the token kept.
- `selectOrg` updates the remembered org for an account that is already in another org. This is intended (consult
  Risk 6).
- No proxy or CSP change: the `src/proxy.ts:25` matcher already covers `/accept-invitation`, and the CSP
  `connect-src` already allows the Identity origin (consult High-path impact). The global header
  `Referrer-Policy: strict-origin-when-cross-origin` (`src/lib/security/headers.ts:9`) stays. The page's meta tag
  overrides it in the document, per D53.
- Hotspots: no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (`work/backlog.md`). SIM-009 is MERGED, so no
  rebase is expected.
- Size estimate: about 400 product lines plus about 350 test lines. This is at the upper bound of one cycle but is
  not split: the controller keeps the page thin.
- Until this merges, invitation email links 404. Do not send real invitations before then (ticket).

## Blocking questions
None.

## Split proposal
None.
