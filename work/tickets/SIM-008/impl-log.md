## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `db/migrations/20261120150000_init.sql` | All v1 tables, constraints, indexes, 3 trigger functions (AC1-4, 6, 7) |
| `db/migrations/README.md` | "Schema (v1)" section (AC5) |
| `db/seeder.js`, `db/seed-dev.js` | Dev seed and its local-only guard (AC5) |
| `db/seeder.test.ts` | Unit tests for the guard and seed data |
| `scripts/schema-check.mjs` | Scripted DB check for AC1-7 (runs in CI) |
| `package.json` | `schema:check`, `seed:dev` scripts |
| `.github/workflows/ci.yml` | "schema check" step |
| `CLAUDE.md`, `.claude/loop.config.md` | Commands / Prepare kept in sync |
| `work/ming-todo.md` | M-6: confirm production Postgres >= 13 and role ownership |

### Tests added / changed
- `db/seeder.test.ts` › assertDevSeedTarget (accepts local hosts, refuses other hosts, refuses production, refuses missing/unparsable URL without echoing it); seed data (fake emails and fixed ids)
- `scripts/schema-check.mjs`: DB cases per the plan (steps 1-7 plus extras). **NOT RUN here**: no Docker/Postgres on this device. The migration and `schema:check` run first in CI; `node --check` passes.

### Checks (actual output summary)
- typecheck + check:layers: exit 0 (tsc clean)
- format:check: exit 0 (30 files)
- test: 7 files, 47 passed
- build: exit 0
- Migrator pre-scan (`findTransactionControl`) on the new SQL: returns null (dollar-quoted bodies skipped, no begin/commit). SQL reviewed by hand (PG13-only syntax, composite FKs, trigger functions re-read rows, `end` then `$$` without stray `end;`). Not executed against Postgres.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- If CI shows a schema-check or SQL failure, fix in rework (SQL could not be executed locally).
- `seeder.js` ships in the image if SIM-004 copies all of `db/`; it refuses non-local hosts.

### Scope self-check
- Could the diff be smaller? No (SQL, check script, seed are all in the plan).
- Diff size: see `git diff --stat main`.
