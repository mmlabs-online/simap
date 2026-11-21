## Attempt 1 — 2026-11-21

### Files touched
| File | Required because |
|---|---|
| `db/target.js` (new) | Shared zero-import production classifier |
| `db/target.test.ts` (new) | Classifier unit tests |
| `db/seeder.js` | `assertDevSeedTarget` takes `env`, calls the classifier (covers seed-dev, test-db, schema-check, global-setup) |
| `db/seeder.test.ts` | `env: {}` in existing calls; production and local-compose cases |
| `db/migrate.cli.test.ts` | Image-entry tests (AC 2) |
| `scripts/migrate-dev.mjs` (new) | Guarded wrapper for `pnpm migrate`; image entry untouched |
| `scripts/migrate-smoke.mjs` | Guard before `create database`, exit 2 |
| `scripts/dev-prod.mjs` (new) | `pnpm dev:prod` |
| `scripts/dev-prod.test.ts` (new) | Step order, secrecy, URL, `.env.local` tests |
| `scripts/prod-guard.cli.test.ts` (new) | CLI table over the five entries (AC 1) |
| `scripts/dev-token.mjs` | Export `JWT_SHAPE`, `promptPassword(label)` |
| `package.json` | `migrate` uses wrapper; `dev:prod` script |
| `README.md` | "Production database (dev)" section |
| `.env.example` | Names only: `SIMAP_DB_TARGET`, `SIMAP_PROD_TUNNEL_PORT`, `SIMAP_PG_TUNNEL` (blind append, grep count was 0, diff is 4 added lines) |

### Tests added / changed
- `db/target.test.ts` (ports, SIMAP_DB_TARGET values, URL port forms, query and PGPORT, malformed/multi-host)
- `db/seeder.test.ts` › refuses a production target on loopback; keeps the local compose URL working
- `db/migrate.cli.test.ts` › image entry ignores the dev guard; imports stay inside the image
- `scripts/prod-guard.cli.test.ts` › 5 entries x 5 targets exit 2; `pnpm migrate` wiring; NODE_ENV=production does not bypass
- `scripts/dev-prod.test.ts` › tokenIsFresh, envFileSetsDatabaseUrl, buildProdUrl round-trip, step order, child env/argv, secrecy, no file-write API

### Checks (actual output summary)
- typecheck: exit 0
- format:check: exit 0 (all files correct format)
- check:layers: 223 files, no violations
- test: 89 files passed, 861 passed | 3 skipped
- build: exit 0
- test:db: not run (no local DB attempted; CI runs it)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Add `pnpm dev:prod` to the Commands list in `CLAUDE.md` (outside the file list).

### Scope self-check
- Could the diff be smaller? No; test tables account for most of it.
- Diff size: see `git show --stat`. `Dockerfile`, `db/migrate.js`, `db/migrator.js`, `deploy/`, `db/migrations/` unchanged.
