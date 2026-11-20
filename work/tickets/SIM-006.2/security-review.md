# Security review — SIM-006.2

## Attempt 1 — security-ai-generated-code-auditor (sign-in gate UI)

Scope: `git diff origin/main...HEAD` on `ticket/SIM-006.2` (29 files). I read the code only and did not run anything. The context files were plan.md (Δ1–Δ7), impl-log.md, SIM-006 security-review.md and the parts of tokenStore, fetch, config and identityClient the diff depends on. I read no `.env*` files.

**Verdict: no 🔴 blockers and no 🟡 should-fix findings.** The items below are 💭 notes for hardening or tests.

### What I checked and found sound
- **Open redirect (`src/lib/identity/return-to.ts:202-215`).** The value must be a string of 1–2048 characters that starts with `/`. It is rejected if it starts with `//`, or contains `\` or any control character, which covers tab, CR and LF before the URL parser can strip them. It then needs the same origin as a fixed base after `new URL`, and `/sign-in` or `/sign-in/*` are refused.
  - Encoded variants (`/%2F%2Fevil.com`, `/%5Cevil.com`, `/%09/evil`, full-width `/`) all stay percent-encoded same-origin paths, so they cannot leave the origin.
  - The value is cleaned on the server (`src/app/sign-in/page.tsx:14`) and the client only does `router.replace` (`SignInRoute.tsx:9`).
- **Token handling.** The bearer stays in tokenStore memory. The tab-to-tab channel (BroadcastChannel) is S1 code; this diff does not change it. `SessionProvider` gets only `{tier, email}`. `ApiFetchProvider` passes a function, not a token. The Turnstile token lives in a ref (`AuthGate.tsx:307`). Nothing in the diff writes a token to the URL, localStorage/sessionStorage, the console or DOM attributes. `localStorage` holds only the account id (pre-existing `accountId.ts`).
  - The form uses `method="post"` and its inputs have no `name`. The gate renders `CheckingView` until hydration (`AuthGate.tsx:280-281`). So credentials can never be submitted natively or land in a URL.
- **Turnstile loading (`src/ui/auth/turnstile.ts`).** The script comes from a fixed `https://challenges.cloudflare.com/...?render=explicit` constant and nowhere else. It loads once. A failed load removes the script tag and can be retried. The widget is removed on unmount or `resetKey` change, a late load is guarded by `cancelled` (`TurnstileWidget.tsx:816-820`), and the token is spent after each submit.
- **Production config (`src/ui/auth/runtime.ts:906-911` + `config.ts`).** `production` is the literal `process.env.NODE_ENV === "production"`, which is inlined at build time. With `production` true, `identityBaseFrom` and `turnstileSiteKeyFrom` always return the constants. The source guard test (`runtime.test.ts`) and the impl-log build check confirm this. The leftover `(process.env.NEXT_PUBLIC_MM_IDENTITY_BASE, "<prod const>")` comma expression in the bundle has no effect.
- **AUT-01 (account existence).** `invalid_credentials` reads "Email or password is incorrect." This is tested not to name the account or contain the typed email (`auth.test.ts`, `views.test.tsx:54-61`). `authErrorMessage` maps codes through an allow-list and never shows server text. Unknown codes map to `unknown`, and `weak_password` reasons are filtered to the known ones. Codes that do depend on the account (`email_unverified`, `not_member`) only come after correct credentials, as in S1.
- **5xx and network errors never sign the user out.** In `viewForMe`, status ≥500 and network failures go to `retry`. `meErrorView` sends network errors and aborts to retry. The token-error retry codes are `network`, `rate_limited` and `unknown`. `RetryView` has no sign-out. `store.forget()` runs only on the `signedOut` path, which is reached only by a 401 after the re-mint (`viewForMe` 401 / `onAuthLost`). Background renewal notifies only for fatal codes (tokenStore `NOTIFY_CODES`).
- **XSS.** The diff adds no `dangerouslySetInnerHTML` or `innerHTML`. Strings from the server (`email` from `/api/me` and `accountEmail`) and the typed email are rendered as React text only.
- **Cross-tab sign-out.** `store.start()` opens the channel. In `onRemoteSignOut`, the epoch is bumped, `flushSync` unmounts the app before the sign-in screen renders, the form, accounts and Turnstile are cleared, and the notice is shown (`AuthGate.tsx:457-470`). Local sign-out also unmounts with `flushSync` first. The `Fragment key={generation}` forces a full remount when a different session signs in, so app state from the previous account cannot leak.

### Findings
1. 💭 **`safeReturnTo` tests do not cover the encoded variants** (`src/lib/identity/return-to.test.ts:162-173`).
   - **Risk:** the logic is correct today, but a later refactor (for example, decoding before the check) could reopen the redirect without any test failing.
   - **Fix:** add `"/%2F%2Fevil.com"`, `"/%5Cevil.com"`, `"/\tevil"` and `"/\u000d//evil"` as cases. Assert either `"/"` or that the result stays a same-origin path (`new URL(r, "http://x").origin === "http://x"`).
2. 💭 **`returnTo` accepts `/api/...` paths** (`return-to.ts:213`).
   - **Risk:** this is not an open redirect, but `/sign-in?returnTo=/api/me` sends the user to raw JSON after sign-in.
   - **Fix:** also return `/` when `url.pathname === "/api"` or it starts with `/api/`, and add a test.
3. 💭 **Any other 4xx from `/api/me` shows the "no permission" screen** (`src/lib/identity/flow.ts:69`).
   - **Risk:** a 429 or 404 from a proxy shows "You don't have permission" with only a Sign out button. Nothing signs the user out automatically, but the screen invites the user to sign out over a transient fault.
   - **Fix (optional):** map 408/429 to `retry`.
4. 💭 **The Turnstile script has no `integrity` attribute** (`turnstile.ts:940-963`).
   - **Risk:** this is expected, because Cloudflare does not allow pinning or SRI for `api.js`. The real control is CSP.
   - **Fix:** in SIM-027 (runtime CSP, deferred per Δ7 and Ming's approval), allow `script-src` and `frame-src` for `https://challenges.cloudflare.com`. Until that lands, an XSS on the simap origin can still read the in-memory token through `getToken` (the S1 residual).
5. 💭 **`store.start()` is guarded by a single `started` flag on the shared store** (`tokenStore.ts`, `start()`).
   - **Risk:** if two `AuthGate`s were ever mounted at once, the second `start()` would do nothing, and when the first unmounts it would close the cross-tab channel for both. This cannot happen today: the `/sign-in` route and the `(app)` route each have one gate.
   - **Fix:** a reference count in `start()`/`stop`, or a comment that only one gate may be mounted at a time.
6. 💭 **"Use another account" only forgets the account locally** (`AuthGate.tsx:528-535`).
   - **Risk:** it calls `store.forget()`, not `/logout`. The Identity device session stays, so the account reappears in the "Continue as" list on the next load. This matches consumers.md ("accounts signed in on the same device stay"). On a shared computer, the user still has to use Sign out.
   - **Fix:** none needed. Check that the copy is acceptable to Ming.

### Follow-ups (out of scope)
- **SIM-027 runtime CSP** (already planned). Include the Turnstile origins, and nonces for Next's inline scripts and `THEME_INIT_SCRIPT` (`src/app/layout.tsx:21`).
- **A19 notes from the impl-log:** `redirect: "error"` in `apiFetch` (S1 note 1), and the 401/403-after-side-effect case. These need `debt` issues, which the orchestrator opens.
- **Turnstile site key** shared with tudocuatui. This is a public key, not a secret, so nothing needs rotating. simap gets its own widget before go-live (SIM-021).

I make no claim of full coverage. I did not test browser runtime behaviour (restore, multiple tabs, the Turnstile iframe) or server-side `/api/me` handling, and there are no DOM tests for `AuthGate`; the plan defers that to Ming's manual check.
