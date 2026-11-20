# Implementation log — SIM-026

## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `scripts/test-db.mjs` | Wrapper: guard (exit 2, no URL printed) then spawn Vitest with the DB config (AC1) |
| `scripts/test-db.test.ts` | Unit test of the refusal paths (non-local, `?host=`, production, unset) |
| `vitest.db.config.ts` | Separate DB-only run with globalSetup, serial files |
| `vitest.config.ts` | Exclude `**/*.db.test.ts` so `pnpm test` stays DB-free (AC3) |
| `src/test/db/global-setup.ts` | Throwaway `simap_test_<hex>` DB: guard, create, real migrator, provide URL, drop at teardown |
| `src/test/db/fixtures.ts` | Pool, `current_database()` assertion, raw-SQL fixtures (all set `org_id`), lock-wait poll |
| `src/server/rooms/rooms.db.test.ts` | Cases 1-5, trigger negative control, lock test (real, not skipped) |
| `package.json` | `test:db` script |
| `.github/workflows/ci.yml` | `db integration tests` step on the existing Postgres service |
| `CLAUDE.md`, `.claude/loop.config.md`, `README.md` | Docs (AC5) |

### Tests added / changed
- `scripts/test-db.test.ts` › exits 2 before connecting for a non-local DATABASE_URL / with NODE_ENV=production / when DATABASE_URL is unset
- `src/server/rooms/rooms.db.test.ts` › cases 1 (3 tests), 2 (2), 3 (1), 4 (4 incl. negative control and concurrency), 5 (1) — 11 DB tests, not runnable locally (no Postgres); first run is CI.

### Checks (actual output summary)
- format:check: exit 0, "All matched files use the correct format."
- typecheck: exit 0; check:layers: "124 files, no violations"
- test: exit 0, Test Files 49 passed, Tests 470 passed | 3 skipped; `vitest list --filesOnly` shows no `*.db.test.ts`
- build: exit 0
- `pnpm test:db`: not run (no Postgres on this device); CI step is the first run.

### Out-of-plan files
None. Note: `src/server/http/org-scope.test.ts` bans an `as OrgScope` cast in non-test files, so `fixtures.ts` builds the scope with `as never` (comment in code).

### Follow-ups (noticed, not done)
- Debt issue (per plan Assumption 3): share the throwaway-DB lifecycle between `schema-check.mjs` and `global-setup.ts`.

### Scope self-check
- Could the diff be smaller? No; service code untouched, lifecycle duplicated by design.
- Service bug found: none known (DB tests unrun locally).
