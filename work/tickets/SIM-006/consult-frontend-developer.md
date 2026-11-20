# Consult — frontend-developer (SIM-006, 2026-11-20)

## Findings

1. **No PKCE or redirect.** Identity sign-in is a cookie-class JSON API, not OAuth (consumers.md). Flow: `POST /auth/login` (credentials include, `X-MM-App: simap`) → `account_id` → `POST /auth/token {audience:"simap", account_id, org_id?}` → in-memory bearer. Nothing in the URL. "Lands back on the page" is therefore an app-side `returnTo` (sessionStorage or query param), not an OAuth redirect.
2. **Session continuity is the device cookie `__Host-mm_device` plus `localStorage.mm_account_id`.** Not the token. A reload loses the token and `restore()` re-mints it from the cookie. Wait for `restore()` before showing sign-in, to avoid a flash.
3. **tudocuatui `src/features/auth/` is a complete model.** Pieces: `tokenStore.ts` (read in full), `identityClient`, `refreshLock` (Web Lock), `authChannel` (BroadcastChannel), `accountId`, `errors`, `config.ts`, `TurnstileWidget`/`turnstile.ts`. `tokenStore` already covers 4 of the 5 acceptance criteria:
   - Renewal: `validUntil = exp - 60 s`, timer re-arm with a 15 s floor, renew on tab visible.
   - Epoch `generation` guard against late answers.
   - Two tabs share one renewal via the lock plus channel.
   - Cross-tab sign-out via `signedOut` messages.
   - `getToken(rejected)` is the hook for the 401/403 retry rule.
   - All of it is injectable (`now`, `timers`, `lock`, `channel`, `doc`, `storage`), so it is unit-testable with fakes (`fakeTabs.ts`).
4. **Server contract (SIM-005).**
   - Codes (`src/lib/api/error.ts`): `unauthenticated` (401), `org_required` / `forbidden` / `member_deactivated` (403), `unavailable` (503), `internal` (500). Body is `{error:{code}}`.
   - There is no `session_invalid` from simap. That code comes only from Identity `/token` (401).
   - The ticket's "sign-out on `session_invalid`" therefore means: when the re-mint fails with `session_invalid`, sign out.
   - `GET /api/me` returns `{sub, email, org, tier}`. Use it to build the `Session`. `src/lib/session.ts` currently holds `{tier, email, orgName}`, so there is no `orgName` yet.
   - A 403 `org_required` is expected until SIM-007 adds the org picker, and SIM-006 cannot mint an org token. See Q1.
5. **Existing seams.**
   - `src/ui/session.tsx` has `SessionProvider(value, actions {switchOrg, refreshPermissions, signOut})`, and `AppShell` reads it. `session === null` means signed out.
   - `src/ui/**` may import only `lib`, so the auth store must live in `src/ui/auth/` or `src/lib/identity/`, with no server imports.
   - Pure logic (retry rule, error mapping, timing) belongs in `lib`. DOM, Web Locks and BroadcastChannel adapters belong in `ui`.
6. **Test infrastructure.** Vitest and component tests exist (`AppShellView.test.tsx`), so a pure `SessionGate`/view split follows the current pattern.

## Recommendations

- **R-a (AC2, AC5): port `tokenStore`, `refreshLock`, `authChannel`, `accountId`, `identityClient` nearly verbatim.** Change `APP_KEY="simap"`, the lock and channel names to `simap-auth-refresh` and `simap-auth`, and the Turnstile key to a `NEXT_PUBLIC_*` config name in `.env.example` (R3, public by design). Put them in `src/ui/auth/`. Port their tests too: they are the timing tests for AC5.
- **R-b (AC3): `apiFetch` as a pure factory in `src/lib/api/` or `src/ui/auth/`.** Deps: `getToken`, `fetch`, `onSignedOut`. Rule:
  - Attach the bearer; on 401 or 403, call `getToken(rejectedToken)` once and retry once.
  - Retry only for 401 and for 403 with code `forbidden` / `org_required` / `member_deactivated`. 403 `forbidden` is the role-change case (D7).
  - On a second 403, return a typed `AuthzError` that the UI maps to "You don't have permission".
  - A failed re-mint with `session_invalid` signs out. A re-mint failure with `not_member` or `email_unverified` routes to the join or unverified screen.
  - A 503 or network error does not sign out (the AUT-02 JWKS rule).
  - Never retry a non-idempotent request after a 5xx. Retry a 401/403 only once.
  - Do not buffer the body if it is a stream; clone the init so the retry can resend.
- **R-c (AC1): gate in `AppShell`.** Do not rely on a redirect.
  - Session states: `restoring | signedOut | signedIn`.
  - While restoring, show the existing `PageSkeleton`.
  - When signed out, render the sign-in screen in place, so the URL stays and "back on the page" is free.
  - `/sign-in` (the ticket's `src/app/sign-in/*`) is then a thin route for deep links. It takes an optional validated `returnTo` (same-origin path only, to avoid an open redirect).
  - Keep it a pure view plus a container, as `AppShellView` does.
- **R-d: `SessionProvider` wiring.** Build `Session` from `/api/me` via `apiFetch`, plus `store.accountEmail()` as a fallback.
  - `signOut` action → `store.signOut()`. `confirmed:false` shows a warning.
  - `refreshPermissions` action → `getToken(currentToken)` to force a re-mint, then refetch `/api/me`.
  - `onRemoteSignOut` and `subscribe` → clear the session in this tab (AC4).
- **R-e: error-code → screen mapping as a pure, tested function.**
  - Inputs: Identity codes `session_invalid`, `not_member` (+ `details.join_available`), `email_unverified`, `rate_limited` (+ `Retry-After`), `turnstile_failed`, `join_closed`, `join_rejected`, `join_queue_full`, `join_unavailable`, and unknown 403.
  - Also the simap codes above.
  - Login failure shows one generic message (AUT-01: no email-exists leak).
  - Copy goes through `src/ui/copy/auth.ts` (D36). SIM-022 will convert the existing copy files, so follow the shape of `shell.ts` now to avoid a rebase fight. Keep codes separate from copy strings.
- **R-f: SIM-023 coupling.** The client sends only the bearer; it never sends an org id. Keep `apiFetch` org-agnostic. Pass `org_id` only at mint time via an optional `orgId` argument in `client.token`, left unused here and used by SIM-007.
- **R-g: security checks.**
  - Do not log `Authorization`, and keep tokens out of URLs, `localStorage` and `sessionStorage`. Keep only `mm_account_id` in `localStorage`.
  - `credentials: "include"` for login, token, accounts, join and logout; `"omit"` for signup, forgot and reset (this app links out, so none are called).
  - Add a CSP or `Referrer-Policy` check only if SIM-004 left it open.
  - Confirm the Identity base URL comes from public config, not a hard-coded constant, so dev can point at `http://localhost:8000` (same host on both sides).

## Risks

- **The org token gap.** Without SIM-007, a minted token has no `org`, so all org routes return 403 `org_required` and the retry rule loops once and then shows "no permission". Mitigation: a dedicated message and no retry for `org_required` (see Q1).
- **Manual check is blocked on M-1.** Identity needs `simap` registered with the dev origin, and local Identity needs same-host cookies. Unit tests therefore carry the acceptance evidence; the ticket must say so.
- **Web Locks and BroadcastChannel are absent in some tests and old Safari.** tudocuatui's fallbacks must be ported along with its fakes.
- **SIM-022 and SIM-003 files overlap** (`session.tsx`, copy files). Land the copy structure first or keep the diff small.
- **`localStorage.mm_account_id` is shared across mmlabs apps on one origin only.** It is per-origin, so there is no cross-app leak, but the stale-id case (BUG-007 in tudocuatui) is handled by `forgetStored` and must be ported.
- **Retry on non-idempotent writes.** The server rejects before the handler runs on 401 and 403, so a retry is safe. Never retry after the handler has run.

## Open questions (each with a default)

1. How should the shell behave in a signed-in state with no org (`org_required`) before SIM-007? Default: sign-in works, `/api/me` is skipped, and the shell shows "No organization selected yet" with sign-out. Alternatively, mint with `org_id` from a single-org user's list. I recommend the first, since it keeps SIM-006 in scope (R4).
2. Where does the Turnstile site key come from? Default: a `NEXT_PUBLIC_TURNSTILE_SITE_KEY` name in `.env.example`. Confirm the simap origin is covered by the key's allowed hostnames (an M-1 task for Ming).
3. Should `Session.orgName` stay in the type? Default: make it optional until SIM-007 supplies it.
4. Where does the auth code live: `src/ui/auth/` or `src/lib/identity/`? Default: pure logic (retry rule, error mapping, `tokenStore` with injected deps) in `src/lib/identity/`; React and DOM adapters in `src/ui/auth/`.
5. `returnTo` storage? Default: the URL is preserved by rendering sign-in in place, so no storage is needed. `/sign-in?returnTo=` accepts only paths starting with a single `/`.

Files read: ticket.md, consumers.md, `src/ui/session.tsx`, `src/lib/session.ts`, `src/ui/AppShell.tsx`, `src/server/http/with-auth.ts`, `src/lib/api/error.ts`, `src/app/api/me/route.ts`, spec AUT-01/02, tudocuatui `src/features/auth/tokenStore.ts` and `config.ts`. Not read in full: `identityClient`, `refreshLock`, `authChannel`, `errors`, `TurnstileWidget` (the plan should port them).
