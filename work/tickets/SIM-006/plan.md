Status: READY

# Plan — SIM-006: Browser sign-in with mmlabs Identity

## Scope summary
From `docs/spec-v1.md`:

- §3 Auth (D4): "The browser signs in through `/api/v1/auth/login`, lists accounts (`/auth/accounts`), joins
  (`/auth/apps/simap/join`), lists its orgs (`/auth/orgs`), and gets an access token from `/auth/token` with
  `audience: "simap"` and the chosen `org_id`. The token lives in memory only (never in a cookie or `localStorage`;
  it can be ~5 KB) and is renewed before `exp`." (Org listing and `org_id` are SIM-007; see Assumptions A3.)
- AUT-01: "The sign-in page signs in against Identity (email + password at Identity). simap never sees or stores a
  password." / "An Identity account that has not joined app `simap` gets the join step (`/auth/apps/simap/join`) when
  the app's join policy allows it. The join runs only after the user clicks" / "Wrong credentials show a clear message.
  No message reveals whether the email exists." / "Sign-out calls Identity `/auth/logout` and drops the access token.
  The next request to a protected page or API is refused." / "simap has no sign-up form of its own. The sign-in page
  links to Identity's sign-up and forgot-password flows and lists accounts already signed in on this browser as
  "Continue as <email>" (`/auth/accounts`) (D33)."
- AUT-02: "A signed-in user stays signed in across page loads and tabs until the Identity session ends. The access
  token is renewed before it expires." / "If the JWKS is unavailable the answer is 503, so the client keeps the session
  instead of signing out." / "The token is kept in browser memory and sent as a bearer header (D4). It is never put in
  a cookie, in `localStorage` or in a URL, and never logged. Several tabs stay in step (tudocuatui refresh lock +
  channel)." / "After a 403 from simap the client re-mints the token once and retries; a second 403 shows "no
  permission" (D7)."
- SHL-01: shell has "refresh permissions", sign-out.

From `work/decisions.md`: D4 (token in browser memory, bearer to route handlers; reuse tudocuatui token store), D7
("client re-mints after a 403 and on org switch"), D33 (sign-in links + "continue as"), D36/D40 (English copy in copy
files).

Identity contract (`org-admin-api/docs/consumers.md`): `credentials: "include"` + `X-MM-App` for login, token,
accounts, join, logout (lines 39-48); token errors table (lines 144-153); join sequence and codes (lines 340-389);
local dev "same host name on both sides" (lines 56-61).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A signed-out visit to any app page shows the sign-in page; after sign-in the user lands back on the page. | Structural: `src/app/(app)/layout.tsx` wraps every app page in `AuthGate`, which renders the sign-in view **in place** (no redirect, URL unchanged) and renders `children` once `ready`. Tests: `flow.test.ts › restore without an account id → signIn`, `flow.test.ts › /api/me 200 → ready with session`, `views.test.tsx › SignInView renders form, Continue as list and links`. `/sign-in?returnTo=` deep link: `return-to.test.ts` (only same-origin paths; `//x`, `/\x`, schemes, `/sign-in` → `/`). Local run without Identity: `pnpm dev`, open `/rooms` → sign-in view shows at `/rooms`. |
| 2 | Token only in memory (not cookie, `localStorage`, URL); renewed before `exp`; two tabs share one renewal. | `tokenStore.test.ts › never writes anything but mm_account_id; no history or console use`, `› caches until receivedAt + (expires_in - 60) s`, `› caches a 12-hour token until expires_in - 60 s`; `tabs.test.ts › two tabs renewing at once -> one /token, both return the same token`, `› tab B waiting on the lock adopts A's broadcast…`, `› hidden tab skips the timer and renews on visibilitychange`; `fetch.test.ts › refuses a path outside /api/ and never puts the token in the URL`. Grep: no `sessionStorage`, `document.cookie` or `console.*` in `src/ui/auth/**` / `src/lib/api/fetch.ts`. |
| 3 | A 403 from simap triggers one re-mint and one retry; a second 403 shows "You don't have permission". | `fetch.test.ts › 403 forbidden → getToken(rejected) once, one retry, 200 returned`, `› 403 then 403 → one retry only, throws ApiAccessError forbidden`, `› 403 org_required is not retried`; `views.test.tsx › NoAccessView shows "You don't have permission"`; `copy.test.ts › apiErrorMessage("forbidden") is "You don't have permission"`. |
| 4 | Sign-out ends the session in this tab and in other tabs. | `tokenStore.test.ts › signOut broadcasts signedOut before /logout…`, `› clears the id, then calls logout with it; getToken is null at once`; `tabs.test.ts › sign-out in A signs out B (memory, storage, listener), no /logout from B`, BUG-007 cases; `identityClient.test.ts › logout posts {account_id} with credentials include and X-MM-App simap`. Gate wiring (`onRemoteSignOut` → signed-out view) by code review of `AuthGate.tsx`. |
| 5 | Unit tests cover token renewal timing, error-code → screen mapping and the retry rule. | `pnpm test` green with `tokenStore.test.ts` + `tabs.test.ts` (timing), `flow.test.ts` + `errors.test.ts` + `copy.test.ts` (mapping), `fetch.test.ts` (retry rule). |
| — | Loop checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` all green. |

## Ming verification after merge
Needs M-1 (Identity app `simap` registered with the local dev origin) and the Ming steps below:
- Sign in with email + password on `http://localhost:3000/rooms` against a local Identity on `http://localhost:8000`
  (same host name on both sides, consumers.md 56-61); the URL stays `/rooms`. Before SIM-007 the token carries no
  `org`, so a successful sign-in ends on "No organization selected yet" (Assumption A3); landing on the page content is
  re-checked after SIM-007.
- "Continue as <email>" appears for an account already signed in on this browser; the join step appears for an account
  that has not joined `simap` and joins only on click.
- Two tabs: reload one, both stay signed in; sign out in one, the other shows the sign-in view.
- Turnstile appears after Identity answers `turnstile_required` (needs the site key hostnames step below).
- DevTools → Application: `localStorage` holds only `mm_account_id`; no token in cookies, storage or the URL.

Ming steps (agents cannot do them):
1. Add to `.env.example` (agents are denied that file) the public names, no values:
   `NEXT_PUBLIC_MM_IDENTITY_BASE=` (dev only, e.g. local Identity `http://localhost:8000/api/v1`; ignored in production
   builds) and `NEXT_PUBLIC_TURNSTILE_SITE_KEY=` (dev only override; ignored in production builds).
2. Turnstile: add `simap.mmlabs.online` and `localhost` to the allowed hostnames of the Turnstile widget whose public
   site key simap uses (default: the same widget as tudocuatui, Q2), or give a new public site key.
3. Decide Q1 (where the sign-up / forgot-password links point).

## Files to create / modify
New code is a port of tudocuatui `src/features/auth/*` unless marked "new". Paths are relative to the repo root.

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/types.ts` | new: `AuthErrorCode`, `AuthError`, `AccountChoice`, `Credentials` (port of tudocuatui `types.ts` lines 4-41, codes trimmed, see Approach 2) | shared types for lib + ui | no |
| `src/lib/identity/errors.ts` | port `errors.ts` (`SERVER_AUTH_ERROR_CODES`, `toAuthError`, `networkError`); add `join_rejected`, `join_queue_full`; drop codes simap never calls | normalise Identity error bodies | no |
| `src/lib/identity/config.ts` | new: `APP_KEY = "simap"`, `AUTH_LOCK_NAME = "simap-auth-refresh"`, `AUTH_CHANNEL_NAME = "simap-auth"`, `IDENTITY_BASE_PROD = "https://api.mmlabs.online/api/v1"`, `TURNSTILE_SITE_KEY_PROD`, `SIGN_UP_URL` / `FORGOT_PASSWORD_URL` (Q1), and pure `identityBaseFrom(raw, production)` / `turnstileSiteKeyFrom(raw, production)` | public client config; dev override, prod fixed (R3) | **yes** (`**/config.*`) |
| `src/lib/identity/flow.ts` | new: pure `viewForTokenError(err, hasAccount)` and `viewForMe(result)` (decision logic of tudocuatui `AuthGate.tsx` `failTo`/`canJoin`, lines 128-174, plus the `/api/me` outcomes) | AC5 error → screen mapping, testable without a DOM | no |
| `src/lib/identity/return-to.ts` | new: `safeReturnTo(raw): string` | `/sign-in?returnTo=` without open redirect | no |
| `src/lib/validate/credentials.ts` | port the sign-in part of tudocuatui `validation.ts` (email trimmed + format, password required, max 128) | client-side form validation (validators live in `src/lib/validate/`) | no |
| `src/lib/api/fetch.ts` | new: `createApiFetch({ getToken, fetchFn, onAuthLost })`, `ApiAccessError` | AC3 retry rule; one bearer path for all UI data calls | no |
| `src/lib/format.ts` | add `waitText(seconds)` (English "30 seconds" / "2 minutes" / "1 hour") | `rate_limited` copy | no |
| `src/lib/session.ts` | `orgName` becomes optional (`orgName?: string`) | `/api/me` has no org name until SIM-007 | no |
| `src/ui/auth/accountId.ts` | port verbatim (`mm_account_id`) | device session continuity | no |
| `src/ui/auth/refreshLock.ts` | port verbatim, imports `AUTH_LOCK_NAME` from `@/lib/identity/config` | cross-tab renewal lock | no |
| `src/ui/auth/authChannel.ts` | port verbatim, imports `AUTH_CHANNEL_NAME` | cross-tab token + signedOut | no |
| `src/ui/auth/identityClient.ts` | port `login`, `token`, `logout`, `join`, `accounts` only (drop signup, verifyEmail, forgot, reset, resend); `join` returns `"member" \| "pending"` | Identity cookie-class calls | no |
| `src/ui/auth/tokenStore.ts` | port; add `renewNow()` (forces a re-mint, for "refresh permissions"); `join()` returns `"joined" \| "pending" \| "stale"` | AC2, AC4 | no |
| `src/ui/auth/fakeTabs.ts` | port verbatim (test-only helper) | tests for AC2/AC4 | no |
| `src/ui/auth/turnstile.ts`, `src/ui/auth/TurnstileWidget.tsx` | port; widget takes `siteKey` prop | "Turnstile when asked" | no |
| `src/ui/auth/runtime.ts` | new, `"use client"`: lazy singleton `getAuthRuntime()` → `{ client, store, apiFetch }`, reads `process.env.NEXT_PUBLIC_MM_IDENTITY_BASE` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `NODE_ENV` through the lib config functions | one store per page load, shared by `(app)` and `/sign-in` | no |
| `src/ui/auth/AuthLayout.tsx` | new (simap kit `Card`): centred card with title, used by every auth view | consistent auth screens | no |
| `src/ui/auth/views.tsx` | new presentational views: `SignInView`, `JoinView`, `UnverifiedView`, `NoOrgView`, `NoAccessView`, `RetryView`, `CheckingView` (props only, no effects; built from `Card`, `Button`, `FilledInput`, `Icon`) | AC1, AC3; render-testable | no |
| `src/ui/auth/AuthGate.tsx` | new `"use client"` container (state machine adapted from tudocuatui `AuthGate.tsx`; sign-up/forgot/verify/reset screens removed); provides `SessionProvider` + `ApiFetchProvider`; renders `children` only when ready | AC1, AC4, shell wiring | no |
| `src/ui/auth/api-fetch-context.tsx` | new: `ApiFetchProvider`, `useApiFetch()` | "an `apiFetch` used by all UI data calls" | no |
| `src/ui/auth/SignInRoute.tsx` | new `"use client"`: `AuthGate` that `router.replace(returnTo)` once ready | `/sign-in` deep link | no |
| `src/ui/copy/auth.ts` | new: `authCopy` (English), `authErrorMessage(err)`, `apiErrorMessage(code)` | D36; SIM-022 convention | no |
| `src/ui/index.ts` | export `AuthGate`, `SignInRoute`, `useApiFetch` | pages import `@/ui` | no |
| `src/app/(app)/layout.tsx` | replace `SessionProvider value={null}` with `<AuthGate><AppShell>{children}</AppShell></AuthGate>` | wire SIM-003 session context to the real store | no |
| `src/app/sign-in/page.tsx` | new: reads `searchParams.returnTo` (async in Next 16), `safeReturnTo`, renders `<SignInRoute returnTo=… />` | ticket "`src/app/sign-in/*`" | no |
| Tests (listed under Tests to write) | new / extended | R5 | no |

Not touched: `src/server/**`, `src/app/api/**` (no new route), `.env.example` (Ming step), `next.config.*`, `Dockerfile`.

## Data model / migration
None.

## API contract
None (no endpoint change). Consumed: `GET /api/me` → `200 {sub, email, org, tier}` (shape locked by SIM-023),
`401 unauthenticated`, `403 org_required | forbidden | member_deactivated`, `503 unavailable`, body
`{error:{code}}` (`src/lib/api/error.ts`). Identity endpoints as in consumers.md (Scope summary).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/api/fetch.test.ts` › attaches `Authorization: Bearer <t>` and `cache: "no-store"`; caller headers kept | bearer path |
| › refuses a path outside `/api/` (absolute URL, `//host`, `api/x`) and never puts the token in the URL | AC2, token never leaves the origin |
| › signed out (`getToken` → null) throws `ApiAccessError("signed_out")` and sends nothing | AC1 |
| › 401 → `getToken(rejected)` once, one retry, 200 returned | D7 / AC3 |
| › 403 `forbidden` → one re-mint, one retry, 200 returned | AC3 |
| › 403 then 403 → exactly one retry, throws `ApiAccessError("forbidden")` | AC3 |
| › 403 `member_deactivated` twice → `ApiAccessError("member_deactivated")` | AC3 |
| › 403 `org_required` is not retried → `ApiAccessError("org_required")` | A3 |
| › 401 after the retry → `onAuthLost()` once, throws `ApiAccessError("unauthenticated")` | auth lost |
| › 403 with unknown or unreadable body → treated as `forbidden` | fail closed |
| › 503, 500 and network `TypeError` are returned / rethrown unchanged, no re-mint, no `onAuthLost` | AUT-02 JWKS rule |
| › `getToken` rejecting (`session_invalid`) propagates; no request retried | sign-out on `session_invalid` |
| › a `ReadableStream` body is never retried (throws the access error); string/FormData bodies are resent | safe retry |
| `src/lib/identity/flow.test.ts` › `viewForTokenError` table: `not_member`+`joinAvailable`+account → join; `not_member` without → signIn with error; `email_unverified`+account → unverified; `session_invalid` → signIn (relist accounts); `network`/`rate_limited`/`unknown` → retry; `join_closed`/`join_rejected`/`join_queue_full`/`join_unavailable` → join view with error | AC5 mapping |
| › `viewForMe`: 200 → ready with `{tier, email}`; `org_required` → noOrg; `forbidden`/`member_deactivated` → noAccess(code); `unauthenticated` → signedOut(`no_access`); 503/network → retry | AC1, AC3, AC5 |
| › restore without an account id → signIn; with an id → checking | AC1 |
| `src/lib/identity/errors.test.ts` › port tudocuatui `errors.test.ts` (known codes, unknown → `unknown`, `Retry-After` header then `details.retry_after`, capped, `join_available` only when `true`, never throws, never copies server text) + `join_rejected`, `join_queue_full` accepted, `no_access` never accepted from a body | AC5 |
| `src/lib/identity/config.test.ts` › production ignores both overrides; dev accepts `http://localhost:<port>/api/v1` and `https://<host>/api/v1`; rejects `127.0.0.1`, userinfo, trailing junk, other paths → prod default; empty → prod default; turnstile override only outside production | R3, AUT-02 |
| `src/lib/identity/return-to.test.ts` › `/rooms`, `/rooms/A1?tab=x` kept; `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:x`, `""`, `undefined`, string arrays, > 2048 chars, `/sign-in…` → `/` | open redirect |
| `src/lib/validate/credentials.test.ts` › email trimmed, required, format; password kept as typed, required, ≤ 128 | form validation |
| `src/lib/format.test.ts` › `waitText` seconds/minutes/hours, rounding up, NaN → generic | rate_limited copy |
| `src/ui/auth/tokenStore.test.ts` › port all tudocuatui `tokenStore.test.ts` cases (getToken, signIn/restore, signOut/forget, continueAs, join/accountEmail, BUG-007) adapted to `join()` returning a status; new: `renewNow` re-mints even with a fresh token and broadcasts it; `join` 202 pending → `"pending"` and no `/token` call | AC2, AC4, AC5 timing |
| `src/ui/auth/tabs.test.ts` › port all tudocuatui `tabs.test.ts` cases (two tabs, proactive renewal, BUG-007) | AC2, AC4 |
| `src/ui/auth/refreshLock.test.ts`, `authChannel.test.ts`, `accountId.test.ts` › port verbatim (`accountId` stubs `localStorage` with `vi.stubGlobal`; env is `node`) | fallbacks without Web Locks / BroadcastChannel |
| `src/ui/auth/identityClient.test.ts` › port the login, token, logout, join, accounts cases; every call `credentials: "include"` + `X-MM-App: simap`; token body `{audience:"simap", account_id}`; token response rejected unless `token_type` Bearer, `audience` simap, 1 ≤ `expires_in` ≤ 86400; join 200 → `member`, 202 → `pending`; network error → `{code:"network"}` | Identity contract |
| `src/ui/auth/views.test.tsx` (`renderToStaticMarkup`) › SignInView: email/password fields, one "Continue as <email>" per account, sign-up / forgot links only when URLs configured, Turnstile slot only when required; `invalid_credentials` message does not mention whether the email exists; JoinView button text; NoOrgView has sign-out; NoAccessView shows "You don't have permission" | AC1, AC3, AUT-01 |
| `src/ui/copy/copy.test.ts` › include `authCopy` in the string checks; `authErrorMessage` returns a non-empty string for every `AuthErrorCode`; `apiErrorMessage` covers every `ApiErrorCode` and `forbidden` is exactly "You don't have permission" | D36, AC3 |

## Approach
Order: library first (commit 1), then UI wiring (commit 2). Read tudocuatui sources with
`git -C D:\Projects\SAF\spaceM\projects\tudocuatui show origin/main:src/features/auth/<file>` (the planner could only
read the working tree; see A7) and keep the port diff-able: same names, same comments, only the changes listed here.

1. **Config (`src/lib/identity/config.ts`).** Constants as in the file table. `identityBaseFrom(raw, production)`:
   production → `IDENTITY_BASE_PROD` always; otherwise `raw` if it is exactly `https://<host>/api/v1` or
   `http://localhost:<port>/api/v1`, else `IDENTITY_BASE_PROD`. Same pattern for the Turnstile key (non-empty,
   `[0-9A-Za-z_-]{1,64}`). `runtime.ts` reads `process.env.NEXT_PUBLIC_…` as literal member accesses so Next inlines
   them at build time. The production image (SIM-004 Dockerfile) passes no build args, so production always uses the
   constants (no Dockerfile change). R3: only public values; no secret.
2. **Types and errors.** Port `types.ts` / `errors.ts`. Codes kept: `invalid_credentials`, `email_unverified`,
   `not_member`, `join_closed`, `join_rejected`, `join_queue_full`, `join_unavailable`, `session_invalid`,
   `turnstile_required`, `turnstile_failed`, `rate_limited`, `validation_error`, `network`, `no_access` (client only),
   `unknown`. Dropped: `join_approval_unavailable` (gone, consumers.md line 342) and the sign-up/reset/verify codes
   (simap never calls those endpoints).
3. **Browser adapters (`src/ui/auth/`).** Port `accountId`, `refreshLock`, `authChannel`, `fakeTabs` verbatim (names
   from lib config). Port `identityClient` with the five calls; `join` returns the status instead of throwing on 202.
   Port `tokenStore` unchanged except: `join()` → `"joined" | "pending" | "stale"` (pending: no `/token`); new
   `renewNow()` = `getToken(currentToken)` so the store re-mints and broadcasts. These live in `ui` (not `lib`) because
   their defaults touch `localStorage`, `navigator.locks`, `BroadcastChannel` and `document`; all are injectable, so
   tests run in Vitest's `node` env.
4. **`apiFetch` (`src/lib/api/fetch.ts`).** Pure factory, deps injected. Rule:
   - `input` must start with `/api/` (single slash), else throw (the bearer never goes to another origin).
   - `getToken()`; `null` → `ApiAccessError("signed_out")`.
   - Send with `Authorization: Bearer`, `cache: "no-store"`.
   - On 401, or 403 whose code is not `org_required`: `getToken(rejected)` once and resend once (body must not be a
     stream). The server rejects 401/403 before the handler runs (SIM-005 `withAuth`), so resending a write is safe.
   - Final 401 → `onAuthLost()` + `ApiAccessError("unauthenticated")`. Final 403 → `ApiAccessError(code)` with code
     from `API_ERROR_CODES`, unknown → `forbidden`.
   - Any other status is returned untouched; network errors propagate. No sign-out on 503 (AUT-02).
   - `getToken` rejecting with `session_invalid` propagates; `tokenStore` already cleared the account and notified its
     subscribers, and the gate's subscriber shows the sign-in view: that is "sign-out on `session_invalid`".
   - Never logs; never reads `Authorization` back.
5. **Pure flow (`src/lib/identity/flow.ts`).** Move the decisions of tudocuatui `AuthGate` (`failTo`, `canJoin`) into
   `viewForTokenError`; add `viewForMe` for the `/api/me` result. The gate only calls these, so AC5 is covered without
   a DOM test runner.
6. **Copy (`src/ui/copy/auth.ts`).** `export const authCopy = {...} as const` (SIM-022 convention), English, value
   strings as small functions (`continueAs(email)`, `rateLimited(wait)`, `signedInAs(email)`). Key strings:
   `forbidden` → "You don't have permission"; `invalid_credentials` → "Email or password is incorrect."; `org_required`
   → "No organization selected yet"; join → "Join simap" / "Continue as <email>"; `pending` → "Your request to join
   simap is waiting for approval."; logout unconfirmed warning (port of tudocuatui's text). No string contains "?"
   (current `copy.test.ts` rule), e.g. "Forgot password" without a question mark. Components import
   `../copy/auth` relatively; no JSX text literals (SIM-022 `no-literals.test.ts`).
7. **Views and gate.** `views.tsx` are props-only. `AuthGate.tsx` adapts tudocuatui `AuthGate.tsx`:
   - States `checking | signedOut | join | unverified | retry | noOrg | noAccess | ready`.
   - `store.start()` in an effect.
   - Restore on mount when an account id is stored; otherwise list accounts (max 5) for "Continue as".
   - After a token: `apiFetch("/api/me")` → `viewForMe` → `ready` builds `Session {tier, email}` and renders
     `<SessionProvider value={session} actions={{ signOut, refreshPermissions }}>` + `ApiFetchProvider` around
     `children`.
   - `signOut`: unmount the app first (tudocuatui `flushSync` pattern), then `store.signOut()`; `confirmed:false` shows
     the logout-unconfirmed notice.
   - `refreshPermissions`: `store.renewNow()` then re-run `/api/me`.
   - `store.subscribe` (background failures, incl. `session_invalid`) and `store.onRemoteSignOut` move to the sign-in
     view (AC4).
   - `onAuthLost` → `store.forget()` + sign-in view with `no_access`.
   - `unverified` view: "Check again" and "Use another account" only. No resend: a resend email links to
     `{origin}/verify-email`, which simap does not serve (A6).
   - Join only from the button click (D8).
   - `switchOrg` stays unset (SIM-007).
8. **Wiring.** `(app)/layout.tsx` uses `AuthGate` around `AppShell`. Because the gate renders auth views in place, the
   URL never changes, so "lands back on the page" needs no storage (consult Q5). `/sign-in` renders `SignInRoute` with
   a validated `returnTo` and replaces to it once ready.
9. **Rules.**
   - R1: lib files import only lib; `src/ui/auth/**` imports lib and ui; pages import ui/lib; nothing imports server
     (`pnpm check:layers`).
   - R3: only public config, names to `.env.example` via Ming.
   - R4: no org picker, no `org_id`, no invitations.
   - R5: tests above; checks green.
   - R6: the client never sends an org id; the scope comes only from the token (SIM-023).

## Specialist input used
`consult-frontend-developer.md`:
- Findings 1-6: adopted as the basis of the design (no OAuth redirect; restore before showing sign-in; tudocuatui
  port; simap codes; `/api/me` for the session; existing seams).
- R-a: adopted. One change: the Turnstile key is a constant with a dev-only `NEXT_PUBLIC_*` override, not env-only,
  because the production image has no build args (Approach 1).
- R-b: adopted, except `org_required` is **not** retried (re-minting without `org_id` cannot fix it; the consult's own
  Risks section says the same).
- R-c: adopted (in-place gate, thin `/sign-in` with validated `returnTo`). The restoring state uses an auth-layout
  "Checking your session" card instead of `PageSkeleton`, as tudocuatui does, so no shell renders before the session
  is known.
- R-d, R-e: adopted (R-e's codes minus `join_approval_unavailable`, which is gone).
- R-f: partly adopted. `apiFetch` is org-agnostic. The optional `orgId` on `client.token` is **not** added here: SIM-007
  adds it with its test (R4: no unused code).
- R-g: adopted. Credentials modes per consumers.md; no tokens in storage, URL or logs; base URL from config. CSP: SIM-004
  set none (`next.config.*` has no headers), so there is nothing to adjust.
- Q1 → A3, Q2 → Q2, Q3 → `orgName` optional, Q4 → split described in Approach 3 (pure parts in lib, browser adapters in
  ui), Q5 → in place, no storage.

## Assumptions
- **A1 (SIM-023, builds on it).** `/api/me` keeps `{sub, email, org, tier}` (200 path locked by SIM-023's test).
  `withAuth` handlers get `ctx.scope`; `orgScopeOf` is removed. The guarded-routes test requires the
  `Symbol.for("simap.withAuth")` marker on every exported method of `src/app/api/**/route.ts`. SIM-006 adds **no** API
  route, so that test is unaffected. The client sends only the bearer, never an org id.
- **A2 (SIM-022, builds on it).** Copy files are `src/ui/copy/<feature>.ts` exporting `<feature>Copy` `as const`,
  English. Value-taking strings are small pure functions. Components import copy relatively, pages via
  `@/ui/copy/<feature>`. `src/ui/copy/no-literals.test.ts` fails on JSX text and user-facing string props outside copy
  files, with the escape hatch `// copy-ok: <reason>`. All SIM-006 text lives in `src/ui/copy/auth.ts`. If SIM-022
  renames `copy.test.ts` checks, add `authCopy` wherever SIM-022 lists the copy objects.
- **A3 (consult Q1, default).** Before SIM-007 the token has no `org`, so `/api/me` answers 403 `org_required`. The gate
  then shows `NoOrgView`: "Signed in as <email>. No organization selected yet." with sign-out. It does not retry. It
  does not pick an org. SIM-007 replaces this view with the picker. Alternative: mint with `org_id` when the user has
  exactly one org. That pulls AUT-06 in, so it is not the default.
- **A4.** Retry rule: retry on 401 and on any 403 except `org_required`, including `member_deactivated` (spec: "after a
  403 … re-mints once and retries"). A final `member_deactivated` shows its own message ("Your access to this
  organization is turned off. Ask an organization admin."), not the generic one.
- **A5 (join policy unknown until M-1).** Join 202 `pending` is handled: the gate shows "waiting for approval" and does
  not poll. The user retries on the next visit, as consumers.md 366-367 allows.
- **A6 (contract note).** consumers.md 231-232: "Every registered origin of an app must serve `/verify-email` and
  `/reset-password`". simap never calls sign-up, forgot or resend, so Identity never sends a link to simap's origin.
  The plan therefore offers no resend button. If Ming wants simap-hosted verify/reset pages anyway, that is a follow-up
  ticket, not SIM-006.
- **A7.** The planner had no shell and read tudocuatui's **working tree**, which may differ from `origin/main`. The
  implementer ports from `git show origin/main:…` and records any difference in `impl-log.md`. tudocuatui's
  `src/data/authFetch.ts` was not read (outside the allowed folder). simap's `apiFetch` is specified here
  independently.
- **A8 (tests).** No `jsdom` / `@testing-library/react` is added (stack stays as is, D2). The tudocuatui DOM tests
  (`AuthGate.test.tsx`, screen tests) are not ported. Their decision logic is covered by `flow.test.ts`, and the views by
  `renderToStaticMarkup`. Effects in `AuthGate.tsx` are covered by code review and Ming's manual check. Alternative
  (Q3): add the two dev dependencies and port `AuthGate.test.tsx`.
- **A9 (hotspots).**
  - `src/ui/copy/copy.test.ts` and `src/ui/copy/*`: SIM-022 (PLANNING, same batch, lands first).
  - `src/ui/index.ts`, `src/app/(app)/layout.tsx`, `src/lib/session.ts`: also likely touched by SIM-010 (PLANNING) and
    SIM-007 (next).
  - `src/app/api/me/route.ts`: SIM-023 and SIM-007 (read only here).
  - Expect a rebase onto SIM-022 and SIM-023.
- **A10 (tier).** `src/lib/identity/config.ts` matches the High path `**/config.*`, so the PR is High tier: Ming reviews
  it, which fits a sign-in change. Security review triggers on `**/auth*` (`src/ui/auth/**`).
- **A11.** The ported tudocuatui logout-unconfirmed and "Continue as" behaviour (list hidden right after sign-out) is
  kept as is.

## Questions with defaults (non-blocking, for the plan-approval round)
1. **Sign-up / forgot-password link targets (D33 vs the contract).** Identity has no hosted sign-up or forgot-password
   page. Per consumers.md, each app hosts those screens and serves `/verify-email` and `/reset-password`, and the
   admin portal cannot host them. So D33's "links to Identity's sign-up and forgot-password flows" has no target yet.
   Default: `SIGN_UP_URL` and `FORGOT_PASSWORD_URL` in `src/lib/identity/config.ts` are `null`, and the links are hidden
   until Ming names the URLs (for example another mmlabs app's pages). Alternative: a follow-up ticket for
   simap-hosted sign-up/forgot/verify/reset pages (larger, needs Turnstile). This affects one AUT-01 checkbox only.
2. **Turnstile site key.** Default: reuse tudocuatui's public widget key (`0x4AAAAAAF_LLtCloZlzY0MY`) as
   `TURNSTILE_SITE_KEY_PROD`. Ming adds `simap.mmlabs.online` and `localhost` to that widget's hostnames. Alternative:
   a dedicated simap widget, with Ming giving the public key.
3. **DOM tests.** Default: no new dev dependencies (A8). Alternative: add `jsdom` + `@testing-library/react` and port
   tudocuatui's `AuthGate.test.tsx` (about +80 tests, more lines).

## Blocking questions
None.

## Split proposal
Estimated size: about 1,900 changed lines. About 1,000 of them are ported tests and about 600 are near-verbatim ports
of tudocuatui modules, so this is above the ~400-line guide.

Default: **one PR, two commits.**
- Commit 1 (library): `src/lib/identity/*`, `src/lib/api/fetch.ts`, `src/lib/validate/credentials.ts`, `waitText`, and
  `src/ui/auth/{accountId,refreshLock,authChannel,identityClient,tokenStore,fakeTabs}.ts` with tests. This covers AC2,
  AC3 and AC5.
- Commit 2 (UI): copy, views, gate, runtime, Turnstile, layout wiring and `/sign-in`. This covers AC1 and AC4.

The reviewer can compare commit 1 with tudocuatui file by file.

Alternative, if Ming prefers smaller PRs: SIM-006 = commit 1 only, and a new ticket SIM-006.2 "Sign-in UI and shell
wiring" = commit 2 (depends on SIM-006). The board, AC1 and AC4 then move to SIM-006.2.
