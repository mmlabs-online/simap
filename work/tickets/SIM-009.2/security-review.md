# Security review — SIM-009.2

## Attempt 1

## Security review: SIM-009.2 (accept-invitation page), attempt 1

**Verdict: no blockers, nothing that must be fixed.** Everything you asked me to check holds up when I read the code. I had no Bash in this run, so I did not run `git diff` or any of the Checks (format, typecheck, check:layers, test, build). R5 still needs them green from the orchestrator. The three 💭 notes below are things to confirm, not defects.

### Findings

🟢 **The token never reaches the URL, history, React state, the DOM or logs.**
- `/home/user/simap/src/ui/auth/acceptController.ts:38,68`: the token is only a closure variable, set by `takeToken()` as the first thing `start()` does, before any `store` or `client` call.
- `/home/user/simap/src/lib/identity/email-link.ts:18-23`: `replaceState(null, "", "/accept-invitation")` removes both the hash and any query. A `?token=` query is never read. Only `#token=` matching `[A-Za-z0-9_-]{32,128}` is accepted.
- `AcceptView` (`acceptController.ts:6-22`) has no token field. The page keeps only the view in state and the controller in a ref (`/home/user/simap/src/ui/auth/AcceptInvitationPage.tsx:26-31`).
- There are no `console.*`, `localStorage` or `sessionStorage` calls in `accept*` or `AcceptInvitationPage.tsx`.
- `toAuthError` (`/home/user/simap/src/lib/identity/errors.ts:49-80`) keeps only allow-listed codes and never echoes server text. Error views therefore cannot show a token or the invited address.

🟢 **Referrer.** `/home/user/simap/src/app/accept-invitation/page.tsx:5-8` sets `referrer: "no-referrer"`, as D53 requires. Browsers never send a URL fragment in `Referer`, so the token could not leak that way even before the meta tag applies. After `replaceState` the address is just `/accept-invitation`.

🟢 **A mismatch does not use up the token.** `/home/user/simap/src/lib/invitations/accept-flow.ts:20-21` maps `invitation_email_mismatch` to `clearToken:false` with `offerOtherAccount`. The token is only cleared on success, `token_invalid` or `validation_error` (`accept-flow.ts:14,17-19`; `acceptController.ts:131`). Every other code, including network errors and timeouts, keeps it. "Use another account" (`acceptController.ts:160-164`) clears only the local store and keeps the token. This matches `consumers.md:203`.

🟢 **The accept call uses cookie mode as the contract says.** `/home/user/simap/src/ui/auth/identityClient.ts:283-297` sends `POST /auth/invitations/accept` with `{account_id, token}` through `post(..., "cookie", AbortSignal.timeout(15000))`. That means `credentials: "include"`, `X-MM-App`, `cache: "no-store"` and no `Authorization` header (`identityClient.ts:123-133`). The account id is checked against `UUID_RE` before any request. On success, `org_id` is UUID-checked and lowercased, and `roles` is ignored, which keeps roles coming from `org_roles` only (R6). The request is sent only from the Accept click, never on load. A busy flag stops a double submit (`acceptController.ts:109,115,155-157`).

🟢 **New-tab links are safe.** `/home/user/simap/src/ui/auth/accept-views.tsx:71,74` give `/sign-up` and `/forgot-password` `target="_blank" rel="noopener noreferrer"`. The page passes neither `signUpHref` nor `forgotHref` to `SignInView` (`AcceptInvitationPage.tsx:88-111`), so there is no same-tab link that would lose the token. `AuthLayout` has no links.

🟢 **No open redirect.** The only navigations go to fixed paths: `navigate("/")` (`acceptController.ts:142`, a full load through `window.location.assign`) and `<a href="/">` (`accept-views.tsx:45`). Nothing taken from input or a response is used as a URL. `selectOrg` only receives an org id that passed `UUID_RE`, and Identity checks that membership when it mints the token.

🟢 **Third-party scripts cannot read the token.** The Turnstile script only mounts on the sign-in view, after `takeLinkToken` has already cleaned the address bar. The root layout (`/home/user/simap/src/app/layout.tsx`) adds no analytics or error reporting that could read `location`. The page never calls `store.start()`, so nothing goes out over the BroadcastChannel.

🟢 **R1 and R3 are respected.** The page imports only `@/ui` and `@/ui/copy` (pages → ui). The controller and views import only `./*` and `@/lib/*` (ui → lib). `accept-flow.ts` imports lib types only. Nothing imports `src/server`. There is no new env variable, secret or hardcoded value. The Identity base URL and the Turnstile site key come from the existing `getAuthRuntime()`.

### Notes (💭, nothing to fix in code)

💭 **Next.js router state may briefly hold the hashed URL.** On hydration the App Router records the starting URL, which includes `#token=…`, in its history state, and its `useInsertionEffect` runs before the page's `useEffect`. Next patches `history.replaceState`, so the app's later `replaceState` should rewrite both the history entry and the router's `canonicalUrl` to `/accept-invitation`. I did not read Next's source to confirm this (vendored code). `/verify-email` and `/reset-password` already rely on the same pattern. When Ming does the DevTools check, also run `history.state` in the console and confirm no `#token` appears in it.

💭 **The meta tag may arrive later than the first requests.** Next 16 can stream metadata, so `<meta name="referrer">` might appear after the font and icon `<link>` requests have started. That cannot expose the token (fragments are never sent in `Referer`). The plan's "page `<head>` has the meta" check covers it. This is accepted D53 behaviour.

💭 **A network failure after a successful accept leads to the "not valid" view on retry.** If Identity used up the token but the answer was lost (timeout or network), the token stays in memory and a retry gets `token_invalid`. The page then shows the invalid view, and its copy (`/home/user/simap/src/ui/copy/invitations.ts:30-31`, "if you already accepted, go to simap") handles this. Correct and safe.

### Follow-ups (out of scope)
- "Use another account" only forgets the account locally. Account A stays signed in to Identity in that browser (by design, so other mmlabs apps stay signed in). On a shared computer the user would need to sign out of A elsewhere. Consider adding a hint or an optional "sign out of A" action later.
- Not a security issue, but worth a functional look: `store.signIn` saves the account id (`adopt`, `/home/user/simap/src/ui/auth/tokenStore.ts:273-279`) before the first token request. If that request fails with a code other than `not_member` or `email_unverified`, `signInOutcome` keeps the sign-in form up with an error even though an account is already set. Check what Identity returns from `/auth/token` without `org_id` for a brand-new invitee of this `org_mode=required` app.
- The "no view renders the token" test (`/home/user/simap/src/ui/auth/accept-views.test.tsx:21-47`) only proves something because the views have no token prop. It is fine today, but it would not catch a future prop that carries the token.
