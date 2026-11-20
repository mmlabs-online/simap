# Implementation log — SIM-002

## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `db/migrator.js` | Port of tudocuatui migrator (no RLS/owner), + `findTransactionControl`, duplicate-version check |
| `db/migrate.js` | Standalone entry for the SIM-004 `migrate` container |
| `db/migrator.test.ts`, `db/migrate.cli.test.ts` | AC 3, 5, 6 |
| `db/migrations/README.md` | Migration rules + R6 (High path) |
| `src/server/db/pool.ts`, `pool.test.ts` | Lazy server-only `pg` pool, `ping` |
| `src/app/api/readyz/route.ts`, `route.test.ts` | Readiness route, AC 4 |
| `scripts/migrate-smoke.mjs` | Decision 3: scripted AC 1-3 against real Postgres |
| `compose.dev.yml` | Local Postgres 17, trust auth on 127.0.0.1 |
| `.env.example` | Appended `DATABASE_URL=` (name only; file already existed with `PORT=`; High path) |
| `package.json`, `pnpm-lock.yaml` | `pg`, `@types/pg` `^8.23.1`; scripts `migrate`, `migrate:smoke` |
| `tsconfig.json`, `vitest.config.ts` | include `db` / `db/**/*.test.ts` |
| `.github/workflows/ci.yml` | postgres:17 service; steps "migrate CLI", "migrate smoke" |
| `README.md`, `CLAUDE.md`, `.claude/loop.config.md` | Local database docs, Commands, Prepare TODO |

### Tests added / changed
- `db/migrator.test.ts`: parseMigrationFilename, checksum, planMigrations (8 cases), findTransactionControl (flags / ignores), readMigrationFiles (4 cases), real db/migrations lint
- `db/migrate.cli.test.ts`: exit 2 without URL; exit 1 on unreachable host with no URL/password/host in output
- `src/server/db/pool.test.ts`: getPool null / singleton, createPool options, date parser, error log code only, ping timeout
- `src/app/api/readyz/route.test.ts`: 503 unset, 200, 503 no details, code-only log, no-store

### Checks (actual output summary)
- format:check: `All matched files use the correct format.` (exit 0)
- typecheck + check:layers: `tsc --noEmit` exit 0; `check-layers: 13 files, no violations`
- test: `Test Files 6 passed (6)`, `Tests 42 passed (42)`
- build: exit 0; routes `/api/healthz`, `/api/readyz` dynamic; `.next/standalone/node_modules/pg/package.json` exists (pg traced, no `next.config.ts` change needed)
- Local node is v24 (engines wants 22): ran with `engine-strict=false`.
- NOT run locally (no Docker on this device): `pnpm migrate`, `pnpm migrate:smoke`, local readyz 200/503 curl run, manual sample-migration run (Approach 13). AC 1-3 and the 200 path of AC 4 against a real DB are verified only by the CI run (steps "migrate CLI" and "migrate smoke"). The 503 path and DB-free behavior are covered by unit tests.

### Out-of-plan files
None. (A first heredoc attempt failed in the shell and wrote nothing; files were created with the Write tool.) `.env.example` content was not read back (deny rule); only the append was performed. Reviewer: confirm it contains `PORT=` and `DATABASE_URL=` with no values.

### Follow-ups (noticed, not done)
- `gh` unavailable, so no `debt` issue created: verify `pnpm migrate`, `pnpm migrate:smoke` and readyz against local Postgres on a device with Docker (CI covers migrate + smoke).
- `engines` is `>=22 <23`; local dev on Node 24 needs `engine-strict=false`.

### Scope self-check
- Could the diff be smaller? No; the files map to the plan list.
- Diff size: ~+1000 lines including tests and lockfile; see `git diff --stat`.
