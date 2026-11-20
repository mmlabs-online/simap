## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `src/server/http/org-scope.ts` | Remove `orgScopeOf`; comment now states what is enforced (AC1) |
| `src/server/http/with-auth.ts` | `ctx.scope` built once and frozen, `WITH_AUTH_MARK` non-enumerable marker (AC1, AC2) |
| `src/server/http/with-auth.test.ts`, `org-scope.test.ts` | New/updated cases for scope, marker, no constructor, cast guard |
| `src/app/api/me/route.ts`, `route.test.ts` | Explicit `{sub,email,org,tier}` body; 200-path contract test |
| `src/app/api/routes-guarded.test.ts` | Runtime marker check on imported route modules plus fixtures (AC2) |
| `src/test/fixtures/routes/{unwrapped-get,aliased-post,head-options,wrapped}.ts` | Guard test fixtures |
| `src/server/README.md` | Document `ctx.scope` and the marker |
| `db/seeder.js`, `db/seeder.test.ts` | `host`/`hostaddr` refusal via `pg-connection-string` (AC3) |
| `scripts/schema-check.mjs`, `scripts/schema-check.test.ts` | Refuse non-local target with exit 2 before connecting (AC4) |
| `package.json`, `pnpm-lock.yaml` | Exact-pinned devDependency `pg-connection-string@2.14.1` (lockfile: +3 lines, importer entry only) |

### Tests added / changed
- org-scope.test.ts › "exports no OrgScope constructor", "OrgScope is cast only in with-auth.ts and tests" (manually confirmed it fails when a non-test file casts)
- with-auth.test.ts › ctx.scope / frozen / member gate; non-enumerable marker; existing expectation updated
- routes-guarded.test.ts › 4 fixture cases + "every real route.ts except healthz/readyz is guarded"
- me/route.test.ts › valid token -> 200 with exactly {sub,email,org,tier}
- seeder.test.ts › `?host=`/`?hostaddr=` refusal; empty host and unix socket
- schema-check.test.ts › non-local exits 2 (two URLs); NODE_ENV=production exits 2

### Checks (actual output summary)
- typecheck: exit 0 (`pnpm typecheck`), `check:layers`: "76 files, no violations"
- format:check: "All matched files use the correct format."
- test: Test Files 28 passed; Tests 192 passed | 3 skipped
- build: exit 0, "Compiled successfully"

### Out-of-plan files
None. (Named import `import { parse } from "pg-connection-string"` worked under Node ESM; no fallback needed.)

### Follow-ups (noticed, not done)
- None.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +211 / -42 lines tracked, plus new test and fixture files.
