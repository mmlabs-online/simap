Status: READY

# Plan — SIM-027: Security headers, CSP and apiFetch hardening before go-live

Gate: **plan-approval** (High paths `next.config.ts`, `src/proxy.ts`, `scripts/check-layers.mjs`). Expected PR tier:
**High** (never agent-merged; Ming reviews and merges). Decisions for the approval round: `## Assumptions` → D1–D9.

## Scope summary
From `work/tickets/SIM-027/ticket.md`:
- Goal: "Before go-live the app sends security headers and a Content-Security-Policy, and the browser API client never
  follows redirects, so an XSS or a misrouted response cannot expose the in-memory token." (wording: see D5)
- Scope: "Security headers (`nosniff`, `frame-ancestors 'none'`/`X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`) and a CSP that allows the inline theme script (nonce or hash), Turnstile
  (`challenges.cloudflare.com`) and the Identity origin, via `next.config.ts` headers or `src/proxy.*`."
- "`apiFetch` uses `redirect: "error"` (+ test)."
- "Write the rule "route handlers never return 401/403 auth codes after a side effect" into CLAUDE.md Rules."
- Out of scope: "Self-hosting fonts (separate follow-up) unless the CSP requires it." It does not: the CSP allows
  `fonts.googleapis.com` / `fonts.gstatic.com`.
- Test plan: "Unit: apiFetch redirect. Scripted: curl the built server for headers; manual browser check by Ming for CSP
  violations."

Sources it closes:
- `work/tickets/SIM-001/security-review.md:14` (item 6): "No security headers yet (CSP, `X-Content-Type-Options`,
  `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`, HSTS) … follow-up ticket to add `headers()`".
- `work/tickets/SIM-003/plan.md:273` (follow-up 3): "Strict CSP needs a nonce/hash for the inline theme script".
- `work/tickets/SIM-004/consult-software-architect.md:51`: "a nonce-based CSP makes every page dynamic and needs the
  theme script to carry the nonce".
- `work/tickets/SIM-006/security-review.md:29` (💭1): "add `redirect: "error"` to the `fetchFn` init in `send` … and
  add one test"; `:32` (💭2): "record the rule … handlers never return 401/403 … after a side effect. Domain refusals use
  a different status or code, such as 409 or 422 `not_allowed`."
- `work/tickets/SIM-006.2/plan.md:17` (Δ7) and `work/tickets/SIM-006.2/security-review.md:34,43`: "allow `script-src`
  and `frame-src` for `https://challenges.cloudflare.com`", "nonces for Next's inline scripts and `THEME_INIT_SCRIPT`
  (`src/app/layout.tsx:21`)".
- Ming 2026-11-20, batch 2026-11-20-3 Q14: separate security ticket before SIM-021.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1a | Every response carries the static security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`) | `scripts/check-headers.test.ts` (unit) + `scripts/check-headers.mjs` run against the built server: pages, 404, `/api/healthz`, one `/_next/static` asset. In CI it runs inside `scripts/check-image.sh` (`ci.yml:88`, `release.yml:110`); the reviewer checks the `check-image` CI step log shows `check-headers: ok`. |
| 1b | Every page response (incl. 404) carries exactly one enforcing CSP with a per-request nonce, Turnstile in `script-src` and `frame-src`, the Identity origin in `connect-src`, `frame-ancestors 'none'`, no `'unsafe-inline'` in `script-src`; no `-Report-Only` header | `src/lib/security/headers.test.ts`, `src/proxy.test.ts`, `scripts/check-headers.test.ts`; scripted run as in 1a |
| 1c | The theme script and every Next inline/external `<script>` carry the request's nonce (so pages and the theme script still run); nonce differs between two requests | `scripts/check-headers.mjs` `checkScriptNonces` + nonce-differs check against the built server; `pnpm build` route table shows the pages as dynamic (ƒ) |
| 1d | API routes and static assets carry no CSP (CSP set in one place only) | scripted check (`/api/healthz`, static asset: no `content-security-policy`) |
| 1e | Sign-in flow and Turnstile still work under the CSP | **Ming** (see below); not scriptable (no browser test library, D2) |
| 2 | `apiFetch` refuses redirects, caller cannot override | `src/lib/api/fetch.test.ts` › "sends redirect: error on first send and retry, even if the caller asks for follow"; › "a rejected fetch (redirect refused) propagates, no onAuthLost" |
| 3 | The 401/403 rule is in CLAUDE.md Rules | Diff of `CLAUDE.md`: new rule R7 under `## Rules (reviewer enforces these)` |
| 4 | All loop checks green | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; CI `check-image` green |

Local scripted run for the reviewer (optional, CI is authoritative): `pnpm build`, copy `.next/static` to
`.next/standalone/.next/static` and `public` to `.next/standalone/public`, `pnpm start`, then in bash
`CHECK_HEADERS_URL=http://127.0.0.1:3000 node scripts/check-headers.mjs` (Windows PowerShell:
`$env:CHECK_HEADERS_URL="http://127.0.0.1:3000"; node scripts/check-headers.mjs`). Or build the image and run
`bash scripts/check-image.sh <ref>`.

## Ming verification after merge
Added to `work/ming-todo.md` as a new open item (before SIM-021 go-live):
- In Chrome with DevTools Console open, on the built app (local `pnpm start` or the first deploy): `/sign-in` (sign in
  with password, Turnstile widget shows and passes), `/sign-up` and `/forgot-password` (Turnstile renders; these pages
  keep `<meta name="referrer" content="no-referrer">` from SIM-006.3, see D9), `/rooms` after sign-in (data loads,
  icons render), toggle light/dark and reload (no flash, theme script ran). Expect **zero** "Content Security Policy"
  violations in the console. If Turnstile reports a `connect-src` violation for `challenges.cloudflare.com`, report it
  (fix: add that origin to `connect-src`, small follow-up).
- After the first deploy: confirm `Strict-Transport-Security` reaches the browser through the Cloudflare Tunnel (M-2)
  and that Cloudflare does not add a second, conflicting HSTS or CSP header.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/security/headers.ts` | **New.** Pure: `SECURITY_HEADERS` (static header list), `buildCsp({ nonce, identityOrigin, dev })`, `identityOriginFrom(base)` (URL origin). No `server-only` (lib layer). | AC1; one source for header values, unit-testable | no |
| `src/lib/security/headers.test.ts` | **New.** Unit tests (see Tests) | AC1, R5 | no |
| `src/proxy.ts` | **New.** Next 16 proxy: per-request nonce, CSP on request (`content-security-policy`, `x-nonce`) and response; `config.matcher` excludes `api/`, `_next/static/`, `_next/image`, `favicon.ico`, prefetches | AC1 (nonce CSP, option B) | **yes** (`src/proxy.*`) |
| `src/proxy.test.ts` | **New.** Response CSP present, nonce in policy, differs per call | AC1, R5 | **yes** (matches `src/proxy.*`) |
| `next.config.ts` | Add `async headers()` returning `[{ source: "/:path*", headers: SECURITY_HEADERS }]` (import from `./src/lib/security/headers`). No CSP here. | AC1 static headers | **yes** (`next.config.*`) |
| `src/app/layout.tsx` | `RootLayout` becomes `async`; reads `(await headers()).get("x-nonce")` from `next/headers`; theme `<script>` gets `nonce={nonce}` and `suppressHydrationWarning`. Keeps `lang="en"` (asserted by `src/ui/copy/no-literals.test.ts:62-66`). Lines 1-4, 16, 21. | AC1c: theme script under nonce CSP; forces per-request render of every page | no |
| `src/lib/api/fetch.ts` | Line 52: `fetchFn(input, { ...init, headers, cache: "no-store", redirect: "error" })`; update the doc comment (lines 34-37) with one sentence on redirects. | AC2 | no |
| `src/lib/api/fetch.test.ts` | Two new cases | AC2 | no (Low) |
| `scripts/check-layers.mjs` | Add layer `proxy` (`src/proxy.ts` and `src/proxy.*` non-test) allowed `["proxy", "lib"]`; update header comment (line 2). `layerOf` gains one line before the `src/app/` checks. | R1: the new file must not escape the guard (consult R-b) | **yes** |
| `scripts/check-layers.test.ts` | Two new cases | R1, R5 | no (Low) |
| `scripts/check-headers.mjs` | **New.** Node built-ins + global `fetch` only. Exports pure checkers and `runChecks(baseUrl, fetchFn)`; `main()` runs only when `process.env.CHECK_HEADERS_URL` is set (works when piped via stdin into the image, where `import.meta.url` cannot be matched). Exit 1 with one line per failure; prints `check-headers: ok` on success. | AC1 scripted check against the built server | no |
| `scripts/check-headers.test.ts` | **New.** Unit tests of the checkers and `runChecks` with a stub fetch; drift guard against `SECURITY_HEADERS` | AC1, R5 | no (Low) |
| `scripts/check-image.sh` | In `== smoke`, after the static-asset checks (after line 112): `docker exec -i -e CHECK_HEADERS_URL=http://127.0.0.1:3000 "$NAME" node --input-type=module - < scripts/check-headers.mjs \|\| { echo "::error::security headers check failed"; exit 1; }` | AC1 runs on the real image in CI and release | no (`.github/workflows/release*` untouched) |
| `CLAUDE.md` (simap) | Add rule R7 (401/403 rule) and extend R1's layer list with `proxy (src/proxy.ts) → lib` | AC3; keeps R1 text in sync with `check-layers.mjs` | no (Medium) |
| `work/ming-todo.md` | New open item: browser CSP check + HSTS check (text from `## Ming verification after merge`) | Ticket test plan "manual browser check by Ming" | no (Low) |

Not touched (R4 / consult R-f): `src/ui/auth/identityClient.ts`, `tokenStore.ts`, `AuthGate.tsx`, `views.tsx`,
`AppShellView.tsx`, `src/lib/identity/flow.ts` (SIM-007.2), `src/lib/identity/config.ts` (only imported; High via
`**/config.*`), `src/ui/auth/turnstile.ts`, `src/lib/icons.ts`, `src/lib/theme.ts`, `Dockerfile`,
`.github/workflows/**`, `package.json`.

Size estimate: ~170 lines of code (headers.ts ~45, proxy.ts ~35, next.config ~8, layout ~6, fetch ~3, check-layers ~5,
check-headers.mjs ~120 incl. main, check-image.sh ~4, CLAUDE.md ~4) + ~250 lines of tests. Slightly above the guide
because of tests; see Split proposal.

## Data model / migration
None.

## API contract
None (no endpoint change). Behaviour change: all HTML pages render per request and carry `Cache-Control: no-store`-style
dynamic caching (consult Risk 4); `/api/*` and `/_next/static/*` responses are unchanged except the added static headers.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/security/headers.test.ts` › buildCsp (prod) equals the agreed policy exactly for nonce `abc123==` and origin `https://api.mmlabs.online` | AC1b, policy text (see Approach step 1) |
| › connect-src carries the Identity origin only: `identityOriginFrom("https://api.mmlabs.online/api/v1")` → `https://api.mmlabs.online`; dev override `http://localhost:4000/api/v1` → `http://localhost:4000`; no `/api/v1` in the policy | AC1b, Identity origin |
| › Turnstile `https://challenges.cloudflare.com` in both `script-src` and `frame-src` | AC1b, Turnstile |
| › script-src has `'nonce-…'` and `'strict-dynamic'`, never `'unsafe-inline'`; style-src has `'unsafe-inline'` and no nonce | AC1b, consult F4 (nonce out of style-src) |
| › `'unsafe-eval'` in script-src only when `dev: true` | consult F4 dev note |
| › throws on a nonce that is empty or not base64 (`[A-Za-z0-9+/]+={0,2}`), e.g. `a;b`, `a b`, `a\r\nb` | header injection guard |
| › policy contains no `,` and no newline (one header value, so duplicates are detectable) | AC1b "exactly one CSP" check relies on it |
| › SECURITY_HEADERS: exact names/values (D2, D3, D6 defaults); no `Content-Security-Policy` entry | AC1a, consult F3 "never set the CSP in both places" |
| `src/proxy.test.ts` › response has one `content-security-policy` whose nonce matches `'nonce-([A-Za-z0-9+/=]+)'` | AC1b |
| › two calls give different nonces | AC1c |
| › `config.matcher` source excludes `/api/x`, `/_next/static/x.js`, `/_next/image`, `/favicon.ico` and matches `/`, `/sign-in`, `/rooms/abc` (test the source regex as a `RegExp` built from the string) | AC1d |
| `src/lib/api/fetch.test.ts` › sends `redirect: "error"` on first send and retry, even if the caller asks for `redirect: "follow"` (401 then 200 path; both `sent(fetchFn, 0/1).redirect === "error"`) | AC2 |
| › a rejected fetch (TypeError, as a refused redirect) propagates as is; `onAuthLost` not called; one call | AC2 + AUT-02 kept |
| `scripts/check-layers.test.ts` › `src/proxy.ts` may import `@/lib/...` | R1 |
| › `src/proxy.ts` importing `@/server/x`, `@/ui/x` or `@/app/x` is flagged (3 violations) | R1 |
| `scripts/check-headers.test.ts` › `parseCsp` splits directives and sources (case-insensitive names, extra spaces) | scripted check |
| › `checkStaticHeaders`: all present → []; one missing → 1 error; wrong value → 1 error | AC1a |
| › `checkDocumentCsp`: valid → no errors + nonce; two CSP headers (value with `, `) → error; `content-security-policy-report-only` present → error; `'unsafe-inline'` in script-src → error; Turnstile missing from frame-src → error; Identity origin missing → error; `frame-ancestors` not `'none'` → error; no nonce → error | AC1b |
| › `checkScriptNonces`: all `<script>` tags with `nonce="N"` → []; one without nonce → error; wrong nonce → error; no script containing `dataset.theme` → error | AC1c, consult Risk 1 (a static page = white screen) |
| › `runChecks` with a stub fetch serving a valid page set → []; same nonce on two `/sign-in` requests → error; CSP on `/api/healthz` or the static asset → error; a page with non-2xx where 2xx is expected (404 path expects 404) → error | AC1c, AC1d |
| › `EXPECTED_STATIC_HEADERS` in the script equals `SECURITY_HEADERS` from `@/lib/security/headers` | drift guard (script cannot import TS inside the image) |
| Scripted: `scripts/check-image.sh` smoke step runs `check-headers.mjs` inside the built image (CI `check-image`, release) | AC1 "scripted check against the built server" |

## Approach
1. **`src/lib/security/headers.ts`** (lib layer, pure, R1).
   - `SECURITY_HEADERS: { key: string; value: string }[]` (the shape `next.config` `headers()` wants):
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
     - `Strict-Transport-Security: max-age=31536000` (D2)
     - `Cross-Origin-Opener-Policy: same-origin` (D6)
   - `identityOriginFrom(base: string): string` → `new URL(base).origin`.
   - `buildCsp({ nonce, identityOrigin, dev }): string`; validates the nonce, then joins with `; `:
     ```
     default-src 'self';
     script-src 'self' 'nonce-<N>' 'strict-dynamic' https://challenges.cloudflare.com [+ 'unsafe-eval' if dev];
     style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
     font-src 'self' https://fonts.gstatic.com;
     img-src 'self' data: blob:;
     connect-src 'self' <identityOrigin>;
     frame-src https://challenges.cloudflare.com;
     frame-ancestors 'none';
     form-action 'self';
     base-uri 'none';
     object-src 'none'
     ```
     (consult F4, unchanged.)
2. **`src/proxy.ts`** (Next 16 file convention, Node runtime; consult R-a).
   - `export function proxy(request: NextRequest)`: `const nonce = Buffer.from(crypto.randomUUID()).toString("base64")`;
     `dev = process.env.NODE_ENV !== "production"`; `identityOrigin = identityOriginFrom(identityBaseFrom(process.env.NEXT_PUBLIC_MM_IDENTITY_BASE, !dev))`
     (same source as `src/ui/auth/runtime.ts:29-30`; production always uses the constant, `src/lib/identity/config.ts:14-16`).
   - Copy request headers, set `x-nonce` and `content-security-policy`; `NextResponse.next({ request: { headers } })`;
     set `content-security-policy` on the response. Never a `-Report-Only` header (D3).
   - `export const config = { matcher: [{ source: "/((?!api/|_next/static/|_next/image|favicon.ico).*)", missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] }] }`.
     The implementer checks this against the Next 16.4 proxy/CSP docs shipped with the installed `next` and records any
     deviation in impl-log.
   - Imports only `next/server` and `@/lib/...` (new `proxy` layer, step 6).
3. **`next.config.ts`**: add `async headers() { return [{ source: "/:path*", headers: SECURITY_HEADERS }]; }`,
   importing `SECURITY_HEADERS` from `./src/lib/security/headers`. If `next build` cannot load a `src/` import from the
   config, inline the array in `next.config.ts` and keep the drift guard by having `headers.test.ts` import
   `next.config.ts` instead; record in impl-log. Existing keys (`output`, `poweredByHeader`, `reactStrictMode`,
   `agentRules`) unchanged.
4. **`src/app/layout.tsx`**: `import { headers } from "next/headers"`; `export default async function RootLayout(...)`;
   `const nonce = (await headers()).get("x-nonce") ?? undefined;` theme script:
   `<script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />`
   (consult Risk 2: browsers hide `nonce` from the DOM). Reading `headers()` makes every page (and `not-found`)
   render per request, so Next stamps the nonce on its own scripts (consult F2/Risk 1). Check `pnpm build` output: all
   page routes ƒ (dynamic). Do not add `dynamic = "force-static"` anywhere.
5. **`src/lib/api/fetch.ts:52`**: `redirect: "error"` placed after `...init` (consult R-d). A refused redirect rejects
   with a `TypeError`, which already passes through untouched (AUT-02, `fetch.test.ts:109`).
6. **`scripts/check-layers.mjs`**: in `layerOf`, before the `src/app/` checks:
   `if (/^src\/proxy(?:\.test)?\.[cm]?[jt]sx?$/.test(p)) return "proxy";` (only `src/proxy.ts` and its test);
   `ALLOWED.proxy = ["proxy", "lib"]`. Since `ALLOWED[from]` only
   applies when `to` is a layer, `next/server` stays allowed. Update the comment on line 2.
7. **`scripts/check-headers.mjs`** (consult R-c): pure exports `EXPECTED_STATIC_HEADERS`, `IDENTITY_ORIGIN`
   (`https://api.mmlabs.online`, the image is always production), `TURNSTILE_ORIGIN`, `parseCsp`, `checkStaticHeaders`,
   `checkDocumentCsp`, `checkScriptNonces`, `runChecks(baseUrl, fetchFn = fetch)`.
   - Page paths (expect 200): `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`,
     `/rooms`; plus `/sim027-not-found` (expect 404). On each: static headers, one enforcing CSP, no Report-Only, every
     `<script ...>` opening tag has `nonce="<N>"`, a script containing `dataset.theme` exists and has it.
   - `/sign-in` fetched twice: nonces differ.
   - `/api/healthz` (expect 200) and the first `/_next/static/…\.(js|css)` referenced by `/` (expect 200): static
     headers present, **no** `content-security-policy`.
   - "Exactly one CSP": undici joins repeated headers with `, `; the policy never contains a comma (unit test), so a
     comma means two headers.
   - `main()` only when `process.env.CHECK_HEADERS_URL` is set; prints each failure on its own line, exit 1; else
     `check-headers: ok`. No dependencies (runs inside the image without `node_modules` access to the repo).
8. **`scripts/check-image.sh`**: one step after line 112 (see Files). The image has no `scripts/` dir (layout check
   line 58 forbids `src`, tests), so the script is piped via stdin, as consult R-c proposes.
9. **`CLAUDE.md`** Rules (after R6), wording per consult R-e:
   "- R7 Route handlers return 401/403 auth codes (`unauthenticated`, `forbidden`, `member_deactivated`,
   `org_required`) only from the auth wrapper, before any side effect; never after a write or other side effect. Domain
   refusals use 409/422 (e.g. `not_allowed`). (`apiFetch` re-sends once on 401/403, so a late 401/403 can repeat a
   write.)"
   And in R1's layer list add "proxy (`src/proxy.ts`) → lib".
10. **`work/ming-todo.md`**: append the open item (next free M-number, currently M-10) with the text of
    `## Ming verification after merge`.
11. Run all Checks; record the `pnpm build` route table (dynamic pages) and, if Docker is available locally, the
    `check-image.sh` result in impl-log.

Rules: R1 (new `proxy` layer guarded; `headers.ts` pure lib; layout imports only lib/`next/headers`), R3 (no env values;
the proxy reads only the public `NEXT_PUBLIC_MM_IDENTITY_BASE` name already used by the client), R4 (Identity client
untouched, fonts not self-hosted), R5 (tests listed above). R2/R6: not applicable.

## Specialist input used
`consult-software-architect.md`:
- F1 current state: adopted as the file/line map above.
- F2/R-a option (B) nonce + `'strict-dynamic'` in `src/proxy.ts`: adopted (D1). Option (A) rejected: does not block
  injected inline script.
- F3 static headers in `next.config.ts`, CSP only in the proxy: adopted; COOP adopted (D6).
- F4 policy text: adopted verbatim. Optional CSP on API JSON responses: **not adopted** (keeps "CSP in one place" simple
  and the check strict; follow-up F-4 if wanted).
- F5 CSP limit (navigation exfiltration): adopted as D5 (goal rewording).
- R-b proxy layer in check-layers: adopted.
- R-c `scripts/check-headers.mjs` via stdin in `check-image.sh`: adopted; main switched from argv to the
  `CHECK_HEADERS_URL` env var so it works both piped and from a file.
- R-d `redirect: "error"` after the spread + two tests: adopted.
- R-e R7 wording: adopted; the optional cross-reference in `src/lib/api/error.ts` not adopted (R4, minimal diff).
- R-f no `identityClient.ts` change: adopted (D4, follow-up F-1).
- Rendering-cost Risk 4: accepted (D1); reverses SIM-004's "mostly static" assumption for HTML only.

## Assumptions
**Decisions for Ming (batch approval round), each with the default this plan implements.**
"Blocks" = whether a non-default answer changes this plan before implementation.
- **D1 — CSP option (consult Q1).** Default: **(B)** per-request nonce + `'strict-dynamic'` in `src/proxy.ts`; every
  HTML page renders per request (no full-route cache). Alternative (A): static CSP with `'unsafe-inline'` in
  `next.config.ts`. **Blocks: yes** — choosing (A) means a re-plan (drop proxy, layout change and nonce checks).
- **D2 — HSTS (consult Q2).** TLS ends at Cloudflare (Tunnel, M-2, service `http://simap:3000`). Default: the app sends
  `Strict-Transport-Security: max-age=31536000` **without** `includeSubDomains`/`preload` (those affect all of
  `mmlabs.online` and are hard to undo). Blocks: no (one header value).
- **D3 — Report-only first? (consult Q3).** Default: **no**, ship the enforcing CSP; scripted check + Ming's browser
  check before SIM-021 replace a report-only period (no report endpoint exists). Blocks: no.
- **D4 — `redirect: "error"` for the Identity client (consult Q4).** Default: **not in this ticket**; `debt` follow-up
  after SIM-007.2 merges (R4, merge hotspot). Blocks: no.
- **D5 — Reword the ticket goal (consult Q5).** Default: **yes**, "… so an XSS or a misrouted response is restricted
  in how it can exfiltrate the in-memory token" — CSP cannot stop exfiltration by top-level navigation. The orchestrator
  edits `ticket.md` Goal on approval. Blocks: no.
- **D6 — `Cross-Origin-Opener-Policy: same-origin`.** Default: **yes** (no popups: Identity calls are `fetch`,
  Turnstile is an iframe). Blocks: no (drop one entry).
- **D7 — CSP in dev too.** Default: **yes**, same policy plus `'unsafe-eval'`, so drift shows up during development
  (consult Risk 5). Blocks: no.
- **D8 — `Permissions-Policy` list.** Default: `camera=(), microphone=(), geolocation=(), payment=(), usb=()`. Blocks: no.
- **D9 — `Referrer-Policy`.** Default: `strict-origin-when-cross-origin` site-wide (consult Risk 3: `no-referrer` is
  reported to break Turnstile's hostname check). The four account pages keep their SIM-006.3
  `metadata.referrer: "no-referrer"` (they carry link tokens; `src/app/account-pages.test.ts:13-14`); Turnstile on
  `/sign-up` and `/forgot-password` already runs under it, and Ming's browser check confirms. Blocks: no.

**Other assumptions**
- Next 16.4.6 stamps the nonce from the request `content-security-policy` header onto its own scripts on dynamic
  renders (Next CSP guide recipe, consult F2). If not, the scripted nonce check fails in CI and the implementer stops
  and records it (no silent fallback to `'unsafe-inline'`).
- Under `'strict-dynamic'`, the Turnstile `api.js` injected by `src/ui/auth/turnstile.ts:24-39` via `createElement` is
  trusted without its own nonce; the host entry in `script-src` is only a CSP2 fallback.
- `next.config` `headers()` apply to pages, 404, `/api/*` and `/_next/static/*` in the standalone server; the scripted
  check verifies it on the real image.
- **Hotspots:** SIM-007.2 (same batch, IN_PROGRESS) edits `src/ui/auth/identityClient.ts`, `tokenStore.ts`,
  `AuthGate.tsx`, `views.tsx`, `AppShellView.tsx`, `src/lib/identity/flow.ts` — none touched here. Possible overlap:
  `CLAUDE.md` (any ticket adding a rule) and `work/ming-todo.md` (orchestrator adds items; take the next free M-number
  at rebase). SIM-007.3 and SIM-019.2 (IN_PROGRESS) are UI pages; if either edits `src/app/layout.tsx`, expect a small
  rebase. No other open ticket edits `next.config.ts`, `src/proxy.ts`, `scripts/check-layers.mjs`,
  `scripts/check-image.sh` or `src/lib/api/fetch.ts` as far as the board shows.
- New pages added later inherit the nonce via the root layout; a page that sets `dynamic = "force-static"` would show
  a white screen in production — `check-headers.mjs` catches that only for the listed paths. Noted for SIM-021.

**Follow-ups (orchestrator files `debt` issues, `project:simap`)**
- F-1: `redirect: "error"` in `identityClient.ts` `post`/`get` (lines 64, 93) after SIM-007.2 merges (D4).
- F-2: add new page routes to `check-headers.mjs` page list as they ship (or derive the list from the build manifest).
- F-3: self-host Material Symbols (existing SIM-003 follow-up 1); would let `style-src`/`font-src` drop Google origins.
- F-4 (optional): `default-src 'none'; frame-ancestors 'none'` on `/api/*` JSON responses.

## Blocking questions
None (D1 is decided in the plan-approval round; this plan implements its default).

## Split proposal
None. The diff is ~170 code lines plus ~250 test lines; the parts are interdependent (the scripted check verifies the
proxy, layout and config together). If Ming prefers smaller PRs, the natural cut is: slice 1 = `fetch.ts` redirect +
CLAUDE.md R7 (Medium tier, no gate); slice 2 = headers/CSP (High). Default: one PR.
