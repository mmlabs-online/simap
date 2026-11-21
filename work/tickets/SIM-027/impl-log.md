## Attempt 1 — 2026-11-21

### Files touched
| File | Required because |
|---|---|
| `src/lib/security/headers.ts` (new) | AC1: `SECURITY_HEADERS`, `buildCsp`, `identityOriginFrom` |
| `src/lib/security/headers.test.ts` (new) | AC1, R5 |
| `src/proxy.ts` (new) | per-request nonce CSP (D1 option B) |
| `src/proxy.test.ts` (new) | AC1b/1c/1d |
| `next.config.ts` | static headers via `headers()` |
| `src/app/layout.tsx` | async layout reads `x-nonce`; theme script nonce; pages render per request |
| `src/lib/api/fetch.ts` | AC2 `redirect: "error"` + doc sentence |
| `src/lib/api/fetch.test.ts` | AC2, two cases |
| `scripts/check-layers.mjs` | new `proxy` layer (`proxy` -> `proxy`, `lib`) |
| `scripts/check-layers.test.ts` | one case covering allowed and 3 flagged imports |
| `scripts/check-headers.mjs` (new) | scripted check against the built server |
| `scripts/check-headers.test.ts` (new) | checkers, `runChecks` with stub fetch, drift guard |
| `scripts/check-image.sh` | runs check-headers inside the image in the smoke step |
| `CLAUDE.md` | rule R7; R1 layer list gains proxy |
| `work/ming-todo.md` | M-14 browser CSP/HSTS check |

### Tests added / changed
- `headers.test.ts` (7 buildCsp/SECURITY_HEADERS cases), `proxy.test.ts` (3), `fetch.test.ts` (2: redirect error on send and retry; rejected fetch propagates), `check-layers.test.ts` (1), `check-headers.test.ts` (7).

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck + check:layers: ok; `check-layers: 227 files, no violations`
- test: `Test Files 92 passed (92)`, `Tests 893 passed (893)`
- build: ok. Route table: every page route is ƒ (dynamic), `ƒ Proxy (Middleware)` listed.
- Scripted: built standalone server (copied `.next/static`, `public`), `CHECK_HEADERS_URL=http://127.0.0.1:3000 node scripts/check-headers.mjs` printed `check-headers: ok`, exit 0. Docker not run (`check-image.sh` not executed locally; CI covers it).

### Out-of-plan files
None. Deviations: none. The matcher matches the Next 16.4.6 CSP guide; `next.config.ts` imports `./src/lib/security/headers` fine in build.

### Follow-ups (noticed, not done)
- As in plan: F-1 (Identity client `redirect: "error"`), F-2 (page list in check-headers), F-3 (self-host icon font), F-4 (CSP on API JSON).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see `git diff --stat`.
