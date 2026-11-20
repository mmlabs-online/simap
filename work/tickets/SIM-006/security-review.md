# Security review — SIM-006

## Attempt 1 — security-ai-generated-code-auditor (slice S1, auth library)

**Scope:** `git diff origin/main...HEAD` on `ticket/SIM-006` (commit 63c3496 plus the plan and review commits). I read every non-test source file in the diff: `src/lib/api/fetch.ts`, `src/lib/identity/{config,errors,flow,types}.ts`, `src/lib/validate/credentials.ts`, `src/ui/auth/{identityClient,tokenStore,authChannel,refreshLock,accountId}.ts`. I compared them with `org-admin-api/docs/consumers.md` (credentials and header rules), `src/server/http/with-auth.ts` (where 401 and 403 come from) and plan.md (S1 rows, AUT-01, the config decision R-a). This is a static review only. I did not run checks and did not open any `.env*` file. It covers the code you can see, not runtime behaviour.

**Verdict: no 🔴 blockers and no 🟡 should-fix items.** Three 💭 notes are below.

### Focus checklist (verified)
- **The token is never persisted.** It lives only in the `createTokenStore` closure (`tokenStore.ts:78`). Nothing in the diff writes it to `localStorage`, `sessionStorage`, a URL or a log. The only `localStorage` key is `mm_account_id` (`accountId.ts:1`). It is UUID-checked on read, and a bad value is removed (`accountId.ts:9-10`). consumers.md allows this ("app's own `localStorage.mm_account_id`"). The new code has no `console.*`.
- **Credentials mode and headers match consumers.md for every call** (`identityClient.ts:41-44, 56-111`):
  - login, token, logout, verify-email/resend, `apps/{key}/join` and the `accounts` GET use `include` plus `X-MM-App` (consumers.md:39-41).
  - signup and password/forgot use `omit` plus `X-MM-App` (consumers.md:44, 220-223, 271-273).
  - verify-email and password/reset use `omit` with no app header (consumers.md:119, 240-248, 295-303).
  - Tokens are sent only in POST bodies, never in a query string. The join path key is `encodeURIComponent(app)` and always this app's own key.
  - `/token` checks `token_type === "Bearer"`, `audience === app` and `1 <= expires_in <= 86400` (`identityClient.ts:140-152`).
- **`apiFetch` sends the token only to the same origin.** It refuses any input that does not start with `/api/` (`fetch.ts:48`). That rules out absolute URLs and protocol-relative `//host` URLs. The `Authorization` header is always set, never merged, and `cache: "no-store"` is forced.
- **The retry rule cannot loop.** There is at most one resend (`fetch.ts:67-75`), and no resend at all for `org_required` or for a `ReadableStream` body (`fetch.ts:62, 64-65`). Replaying a non-idempotent request is safe today: every 401/403 in the app comes from `withAuth` before the handler runs (`with-auth.ts:46-56`, handler at `:62`). So the first attempt never ran the handler's side effects. A second 401 calls `onAuthLost`. A second 403 throws without signing out. 5xx and network errors are passed through untouched.
- **Cross-tab messages are validated.** Tab-to-tab messages do carry the access token (`tokenStore.ts:145-152`). `BroadcastChannel` is limited to the origin, and any script that could listen there could already call `getToken`, so the token is not exposed any further. `parseAuthMessage` (`authChannel.ts:36-55`) checks: `v === 1`, a UUID `accountId`, freshness of `at` (−10 s/+5 s), a JWT-charset token of at most 8 KB, and `expiresAt` within 24 h. It returns a new object that keeps only the known fields. The store also ignores messages for a different account or with an older `at` (`tokenStore.ts:215-217`).
- **Config is public and has safe defaults** (`config.ts`):
  - Production always uses the constant Identity base URL and the constant Turnstile site key. The `NEXT_PUBLIC_*` overrides apply only outside production and only when well-formed (https host or `http://localhost:<port>`). Anything else falls back to production.
  - The Turnstile *site* key is public by design. There is no secret key in the code (R3), so no rotation is needed.
- **Error mapping (AUT-01).** `toAuthError` keeps only codes from an allow-list and never repeats server text (`errors.ts:22-53`). Codes that point to a bug (`origin_not_allowed`, `app_header_required`, `audience_mismatch`) become `unknown`. In the login flow, the only errors that depend on the account are `invalid_credentials`, and `email_unverified`/`not_member`, which need correct credentials first. `forgotPassword` treats the 202 the same for every email. So account existence is protected client-side as far as S1 can; the "does not mention the email" wording is tested in S2 (`views.test.tsx`).
- **Credential validation is UX only** (`credentials.ts`). The server remains the authority, sign-in applies no password rules, and passwords are compared in NFKC form. Nothing there affects security.

### Findings
1. 💭 **`apiFetch` follows redirects by default.** `src/lib/api/fetch.ts:52`
   - **Risk:** an `/api/*` handler that ever redirects to another origin would make the browser follow it. Current browsers drop `Authorization` on cross-origin redirects (Fetch spec), so the bearer would not leak today. Still, `/api` should never redirect, and following one is unneeded exposure.
   - **Fix:** add `redirect: "error"` to the `fetchFn` init in `send` (it is already overriding `cache`), and add one test.
2. 💭 **The retry's safety depends on an unwritten rule: only the auth wrapper returns 401/403.** `src/lib/api/fetch.ts:57-69` together with `src/server/http/with-auth.ts:46-55`
   - **Risk:** if a later handler returns `apiError(403, "forbidden")` itself after a write (for example a domain rule like "can't approve your own request"), `apiFetch` would re-mint the token and resend the POST, so the write would run twice. Even a read-only handler 403 costs one extra `/token` call each time, which adds load on the Identity rate limit for UIs that poll.
   - **Fix:** record the rule in `src/lib/api/error.ts` or CLAUDE.md R-rules: handlers never return 401/403 (`unauthenticated`/`forbidden`/`member_deactivated`) after a side effect. Domain refusals use a different status or code, such as 409 or 422 `not_allowed`. Optionally, have `apiFetch` resend only when the 403 code is one of the three auth codes it already parses, and pass any other 403 straight through.
3. 💭 **The production Turnstile site key is shared with tudocuatui.** `src/lib/identity/config.ts:5`
   - **Risk:** this is not a secret leak. A shared widget means the widget's allowed hostnames must include simap's origin, and Identity's siteverify cannot tell the two apps' challenges apart.
   - **Fix:** this is already tracked as SIM-021. Confirm it is done before go-live.

### Follow-ups (out of S1 scope)
- **S2 `runtime.ts`:** pass `production` from `process.env.NODE_ENV === "production"` evaluated at build time, so an override can never apply in a production bundle. Also check that the `invalid_credentials` copy names neither the email nor whether it exists (plan row 7).
- **S3 `/verify-email` and `/reset-password` pages:** read the token from `location.hash`, call `history.replaceState` right away, and send `Referrer-Policy: no-referrer` (consumers.md:116-119, 235-248). S1's client already keeps the token out of URLs.

I did not cover runtime CSP and XSS hardening of the pages: an XSS on the simap origin would get the in-memory token through `getToken`. That belongs to the S2 page and header work.
