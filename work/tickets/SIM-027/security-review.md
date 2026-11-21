# Security review — SIM-027

## Attempt 1
Agent: security-ai-generated-code-auditor. Verdict: no 🔴 blockers.

- 🟡 1. `scripts/check-headers.mjs:64-65` rejects `'unsafe-inline'` but not `'unsafe-eval'` in the production script-src; `'unsafe-eval'` depends on `NODE_ENV !== "production"` (`src/proxy.ts:8`). Fix: add an `'unsafe-eval'` check plus a test case.
- 💭 2. Matcher `src/proxy.ts:25` skips `api/` and an unescaped `favicon.ico` prefix, so `/api/<missing>` and `/favicon.icoX` 404 pages get no CSP (static headers still apply; no exploit today). Fix: anchor/escape `favicon\\.ico$`; F-4 CSP on `/api/*`.
- 💭 3. Prefetch requests skip the proxy (Next.js recipe); acceptable, known limit.
- 💭 4. `scripts/check-headers.mjs:82` puts the nonce into a RegExp unescaped; fine for the current base64 of a UUID, brittle if the generator changes.
- 💭 5. `style-src 'unsafe-inline'` stays (React inline styles); acceptable since the token never reaches the DOM.
- 💭 6. HSTS without includeSubDomains/preload and COOP same-origin are correct.

What holds: nonce + 'strict-dynamic' script-src, no 'unsafe-inline'; per-request nonce from crypto.randomUUID with base64 validation; client x-nonce/CSP request headers overwritten; object-src/base-uri 'none', frame-ancestors 'none' + XFO DENY; connect-src limited to self + Identity constant in production; only one inline script, nonce-tagged; apiFetch `redirect: "error"` after `...init`; check-layers covers src/proxy.ts.

Follow-ups: F-1 `redirect: "error"` in identityClient; F-4 CSP on /api/*; Ming's browser check (M-14).
