# Review — SIM-027

## Attempt 1 — 2026-11-21
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 227 files, no violations"
- `pnpm test` — exit 0, "Test Files 92 passed (92)", "Tests 893 passed (893)" (matches impl-log)
- `pnpm build` — exit 0; route table: every page route ƒ (dynamic), incl. `/_not-found`; "ƒ Proxy (Middleware)" listed
- `pnpm test:db` — CI-only (no Postgres here); the diff touches no DB code
- Scripted (reviewer): built standalone server (copied `.next/static`, `public`) on 127.0.0.1:3127,
  `CHECK_HEADERS_URL=http://127.0.0.1:3127 node scripts/check-headers.mjs` → "check-headers: ok", exit 0. Spot checks:
  `/sign-in` carries the 6 static headers + one CSP with nonce and `Cache-Control: private, no-cache, no-store`;
  `/api/healthz` has static headers, no CSP; `/rooms/abc` → 200, 0 `<script>` tags without nonce; a request with
  `next-router-prefetch: 1` gets no CSP (matcher `missing`, as planned). Docker `check-image.sh` not run here (CI).

### Acceptance criteria
- [x] 1a static headers on every response — `src/lib/security/headers.test.ts` › "has the agreed names and values and no
  CSP"; `scripts/check-headers.test.ts` › checkStaticHeaders, runChecks; scripted run above (pages, 404, `/api/healthz`,
  static asset). The CI `check-image` log line `check-headers: ok` is for Ming to see on the PR (branch not pushed yet).
- [x] 1b one enforcing nonce CSP, Turnstile in script-src/frame-src, Identity origin in connect-src, frame-ancestors
  'none', no 'unsafe-inline' in script-src, no Report-Only — `headers.test.ts` › "equals the agreed policy exactly
  (prod)" and 6 more cases; `src/proxy.test.ts` › "sets one CSP on the response with a nonce"; `check-headers.test.ts`
  › checkDocumentCsp; scripted run.
- [x] 1c theme script and all Next scripts carry the nonce; nonce differs per request — `checkScriptNonces` + nonce
  check in `runChecks` (scripted run ok); `proxy.test.ts` › "gives a different nonce per call"; build: all pages ƒ.
- [x] 1d API routes and static assets carry no CSP — `proxy.test.ts` › matcher case; scripted run (`/api/healthz`,
  first `/_next/static` asset of `/`); curl spot check.
- [ ] 1e sign-in flow and Turnstile under the CSP — Ming verification after merge (not reviewer's): `work/ming-todo.md`
  M-14 (browser console zero CSP violations on `/sign-in`, `/sign-up`, `/forgot-password`, `/rooms`, theme toggle; HSTS
  through the Cloudflare Tunnel, no duplicate HSTS/CSP from Cloudflare). The PR must carry these.
- [x] 2 `apiFetch` refuses redirects, caller cannot override — `src/lib/api/fetch.ts:52` (`redirect: "error"` after the
  spread); `src/lib/api/fetch.test.ts` › "sends redirect: error on first send and retry, even if the caller asks for
  follow", › "a rejected fetch (redirect refused) propagates, no onAuthLost" (both pass).
- [x] 3 401/403 rule in CLAUDE.md Rules — `CLAUDE.md` R7 (wording per plan step 9); R1 layer list gains proxy.
- [x] 4 all loop checks green — see Checks.

Scope: every changed file is in the plan's file list (`ticket.md` edits are the orchestrator's state/goal rewording
per D5). High paths changed — `next.config.ts`, `src/proxy.ts`, `src/proxy.test.ts`, `scripts/check-layers.mjs` — are
all named in the plan (gate approved 2026-11-20). `src/lib/identity/config.ts` is only imported, not changed.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: `src/proxy.ts` imports only `next/server` and `@/lib/...`, guarded by the new `proxy` layer
(`scripts/check-layers.mjs:10,30`, test `check-layers.test.ts` › "lets src/proxy.ts import lib only");
`src/lib/security/headers.ts` is pure. R3: proxy reads only the public `NEXT_PUBLIC_MM_IDENTITY_BASE` name, and
production always uses the constant (`src/lib/identity/config.ts:14-16`). R4: Identity client, fonts untouched.
R5: new logic has tests.

### Blockers from review agents
None.

### Nits (do not block)
- 💭 `scripts/check-headers.test.ts:30`: `.replace("/_next/static/a.js", "/_next/static/a.js")` is a no-op; drop it.
- 💭 `scripts/check-headers.test.ts` › "runChecks flags …": the plan also listed "CSP on the static asset → error";
  only the `/api/healthz` case is tested (same loop in `runChecks`, so coverage is equivalent in practice).
- 💭 `src/lib/api/fetch.ts:36` and `CLAUDE.md` R1 line run past the ~120-column wrap used around them.
- 💭 Dev CSP: HMR websocket relies on `connect-src 'self'` matching same-origin `ws:` (CSP3 browsers do); not checked
  in `pnpm dev` here.

### Follow-ups (out of scope)
- As in plan: F-1 (`redirect: "error"` in `identityClient.ts` after SIM-007.2), F-2 (new page routes in
  `check-headers.mjs` or derive from the build manifest), F-3 (self-host Material Symbols), F-4 (CSP on `/api/*` JSON).
