Status: READY

# Plan — SIM-002: Database client, tudocuatui migrator and readiness

Gate: **plan-approval** (P0; touches High paths `.env.example` and `db/migrations/README.md`). Ming approves this plan,
including the defaults under `## Decisions for Ming`, before IMPLEMENT. Nothing here needs Ming's shared Postgres
(M-3, D3): everything runs against a local Postgres 17 (compose) or the CI service container.

## Scope summary
- Ticket goal: "Connect simap to Postgres the tudocuatui way: one `pg` pool, the tudocuatui SQL migrator run as a
  one-shot command, and a readiness route, so the schema ticket can add migrations."
- `docs/spec-v1.md` §3: "Data access: `pg` (node-postgres) with hand-written SQL. No ORM, no query builder." /
  "Migrations: tudocuatui's migrator and rules, copied: plain SQL files `db/migrations/YYYYMMDDHHMMSS_name.sql`,
  forward-only, checksums recorded, one transaction per file, advisory lock, expand-then-contract so the previous image
  still works (D3). No down files." / "A one-shot `migrate` container runs before the app container is replaced; the
  app never migrates."
- `docs/spec-v1.md` §8 Config: "from environment variables only. Names go in `.env.example` with no values (R3). The
  `DATABASE_URL` secret comes from the deployment repo's env file, never from the image."
- `docs/spec-v1.md` §8 Database: "Every org table has `org_id NOT NULL` and every unique key and foreign key includes
  it." / "Rollback = previous image, or fix forward, or restore the pre-release backup."
- `docs/spec-v1.md` §8 Security: "No secrets, tokens, raw claims or personal data in logs or client bundles. Logs carry
  only fixed error codes."
- `docs/spec-v1.md` SYS-04: "A liveness endpoint (no DB) and a readiness endpoint (DB `select 1`) exist, as in
  tudocuatui. The compose healthcheck uses readiness." Liveness `/api/healthz` exists since SIM-001
  (`src/app/api/healthz/route.ts`); this ticket adds readiness. The compose healthcheck is SIM-004's.
- `work/decisions.md` D2: "`pg` with SQL (no ORM/query builder), tudocuatui migrator … First phase has light unit tests
  only (no e2e, no DB integration suite)."
- `work/decisions.md` D3: "plain SQL, forward-only, checksummed, expand/contract, one-shot `migrate` container; no down
  files. … DB = shared self-hosted mmlabs Postgres, database and role `simap`."
- CLAUDE.md R2 (forward-only migrations, never edit an applied one), R3 (env only, names in `.env.example`), R6
  (`org_id` on every org table), R1 (`src/server/**` starts with `import "server-only"`; only `src/app/api/**` imports it).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | `pnpm migrate` against an empty local database applies all files in order and records them; a second run applies nothing. | Unit: `db/migrator.test.ts › planMigrations › pending in lexical order`. Scripted: `pnpm migrate:smoke` step 1–2 (CI job `ci`, step "migrate smoke", against the `postgres:17` service): two fixture files applied in order, 2 rows in `schema_migrations`, second run logs `up to date`. CI step "migrate CLI" runs `node db/migrate.js` twice; second output contains `up to date`. Implementer also records a local compose run in `impl-log.md`. |
| 2 | Editing an applied migration makes `pnpm migrate` fail with a checksum error and change nothing. | Unit: `db/migrator.test.ts › planMigrations › checksum differs -> error`. Scripted: `pnpm migrate:smoke` step 3: after appending to an applied fixture the run throws `checksum mismatch for applied migration …`, a pending third fixture is not applied, `schema_migrations` still has 2 rows. |
| 3 | A file name that does not match the pattern, or a file containing `begin`/`commit`, is refused. | Unit: `db/migrator.test.ts › parseMigrationFilename …`, `› findTransactionControl …`, `› readMigrationFiles › refuses a bad name / a transaction-control file with exit code 2` (temp dir, no DB). Scripted: `pnpm migrate:smoke` step 4: refusal happens before connecting, nothing recorded. |
| 4 | `GET /api/readyz` answers 200 when the database answers and 503 (no error details) when it does not or `DATABASE_URL` is unset. | Unit: `src/app/api/readyz/route.test.ts` (all cases listed under Tests). Local run (impl-log): compose up → `curl -i localhost:3000/api/readyz` 200 `{"status":"ok"}`; compose stop → 503 `{"status":"unavailable"}`; dev server without `DATABASE_URL` → 503. |
| 5 | Unit tests cover file-name parsing, ordering, checksum comparison and statement rejection (pure functions; no DB). | `pnpm test` green; `db/migrator.test.ts` contains the cases listed under Tests; none opens a DB connection. |
| 6 | (Ticket risk) never print `DATABASE_URL`; migrate entry does not depend on the Next.js runtime. | `db/migrate.cli.test.ts › exit 1 on unreachable host; output has no URL/password/host`; `exit 2 when DATABASE_URL is unset`. Reviewer greps `db/` for `next`, `@/`, `server-only` imports: none. |
| 7 | All checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` (and `test -f .next/standalone/node_modules/pg/package.json`, see Approach 7). |

## Ming verification after merge
- None for this ticket. Running `db/migrate.js` against the shared mmlabs Postgres (direct vs pooled connection,
  role `simap`) is verified in SIM-004 / M-3, not here.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrator.js` | Create. `@ts-check` port of tudocuatui `server/migrator.js` (pure functions + `runMigrations`), minus RLS/owner code, plus `findTransactionControl` pre-scan and duplicate-version check. | Ticket scope "Port tudocuatui `server/migrator.js`". | No |
| `db/migrate.js` | Create. `@ts-check` port of tudocuatui `server/migrate.js` (standalone ESM entry, exit codes 0/1/2), dir `./migrations` relative to itself, no `TUDO_OWNER_SUB`. | Ticket "standalone entry the SIM-004 `migrate` container can run outside the Next.js trace". | No |
| `db/migrator.test.ts` | Create. Unit tests for the pure functions and `readMigrationFiles` (temp dir), plus the "real files" lint over `db/migrations/*.sql`. | AC 3, 5. | No (Low) |
| `db/migrate.cli.test.ts` | Create. Spawns `node db/migrate.js` without a DB (unset URL; unreachable host). | AC 6. | No (Low) |
| `db/migrations/README.md` | Create. Rules adapted from tudocuatui README (RLS/owner sections dropped) + R6 + direct-connection note. Keeps the directory in git. | Ticket "`db/migrations/README.md` with the rules … plus simap's R6". | **Yes** (`db/migrations/**`) |
| `src/server/db/pool.ts` | Create. `import "server-only"`; `createPool`, `getPool` (lazy, `globalThis` cache, `null` without `DATABASE_URL`), `ping` with timeout. | Ticket "Server-only DB module: one `pg` pool from `DATABASE_URL`". | No |
| `src/server/db/pool.test.ts` | Create. Pool options, null without URL, singleton, error listener logs code only, ping timeout. | R5 new logic has tests. | No (Low) |
| `src/app/api/readyz/route.ts` | Create. `GET` → `ping` → 200 / 503, `force-dynamic`, `no-store`. | Ticket "Readiness route"; SYS-04. | No |
| `src/app/api/readyz/route.test.ts` | Create. Mocks `@/server/db/pool`. | AC 4. | No (Low) |
| `scripts/migrate-smoke.mjs` | Create (Decision 3). Creates a throwaway database from `DATABASE_URL`, runs `runMigrations` on temp fixture dirs, asserts AC 1–3, drops the database. | Automated evidence for AC 1–3 without a Vitest DB suite (D2). | No |
| `compose.dev.yml` | Create. `postgres:17`, db/user `simap`, `127.0.0.1:5432`, healthcheck, named volume, no committed password (Decision 4). | Ticket "Local Postgres for development". | No |
| `.env.example` | Create (file does not exist yet). `DATABASE_URL=` with a comment; no value. | Ticket; R3. | **Yes** |
| `package.json` | Modify. Add `pg` (dependency) and `@types/pg` (devDependency) at tudocuatui versions (`^8.23.1`); scripts `migrate`, `migrate:smoke`. | Ticket. | No |
| `pnpm-lock.yaml` | Regenerated by `pnpm install`. | New deps. | No |
| `tsconfig.json` | Modify `include` (line 25–32): add `"db"` so `tsc` checks the `@ts-check` JS and the tests. | Typecheck covers the migrator. | No |
| `vitest.config.ts` | Modify `test.include` (line 19): add `"db/**/*.test.ts"`. | Run the migrator tests. | No |
| `.github/workflows/ci.yml` | Modify. Add `postgres:17` service (as tudocuatui ci.yml lines 20–27), steps "migrate CLI" and "migrate smoke" after `pnpm test`. | Decision 3; AC 1–3 evidence. | No (security review trigger `.github/workflows/`) |
| `README.md` | Modify. Replace the "Planned shape" paragraph with a short "Local database" section: compose up, `.env.local` line, `pnpm migrate`, readyz. | Ticket "documented in README". | No |
| `CLAUDE.md` | Modify "Commands" (line 24–26): add `pnpm migrate`, `pnpm migrate:smoke`, `docker compose -f compose.dev.yml up -d`. | Keep commands in sync. | No |
| `.claude/loop.config.md` | Modify "Prepare" line 22: replace the SIM-002 TODO with the compose command (and that tests need no DB). | loop.config TODO assigned to SIM-002. | No |

Not touched: `next.config.ts` (High) — Next.js 16 already treats `pg` as a server external package (built-in
`serverExternalPackages` list); see Approach 7. `.gitattributes` already has `* text=auto eol=lf` (covers `*.sql`),
so the consultant's `.gitattributes` item is already met.

## Data model / migration
- No domain tables and no committed `.sql` file (ticket Out of scope).
- The migrator creates its own bookkeeping table on first run, exactly as tudocuatui (`migrator.js` lines 186–193):
  `schema_migrations (version text primary key, name text not null, checksum text not null, applied_at timestamptz not
  null default now())`, `create table if not exists`. No down/rollback (D3 supersedes the old R2 "working down" wording).

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/readyz` | none | `{"status":"ok"}` or `{"status":"unavailable"}`; header `Cache-Control: no-store` | 200 DB answered `select 1` within 2 s; 503 otherwise (unset `DATABASE_URL`, timeout, any error). Body never carries error text, codes or which check failed. | Public (infrastructure probe, like `/api/healthz`) |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `db/migrator.test.ts › parseMigrationFilename › parses YYYYMMDDHHMMSS_snake.sql` | `20261120120000_init.sql` → `{version, name}` |
| `db/migrator.test.ts › parseMigrationFilename › rejects other names` | `0001_init.sql`, `20261120120000_Init.sql`, `20261120120000_init.txt`, `init.sql`, `20261120120000_.sql`, `2026112012000_short.sql` (13 digits), `20261120120000_tên.sql` (diacritics) → `null` |
| `db/migrator.test.ts › checksum › sha256 hex, CRLF equals LF, content change differs` | checksum comparison basis |
| `db/migrator.test.ts › planMigrations › pending in lexical order` | ordering (AC 1) |
| `db/migrator.test.ts › planMigrations › nothing pending when all applied` | second run applies nothing (AC 1) |
| `db/migrator.test.ts › planMigrations › checksum differs -> error` | AC 2; message `checksum mismatch for applied migration <version>` |
| `db/migrator.test.ts › planMigrations › applied but missing locally -> error` | drift |
| `db/migrator.test.ts › planMigrations › pending older than newest applied -> error` | out-of-order |
| `db/migrator.test.ts › planMigrations › database ahead -> ahead list, nothing pending` | old image vs newer DB |
| `db/migrator.test.ts › planMigrations › duplicate local version -> error (exit code 2)` | two files with the same timestamp |
| `db/migrator.test.ts › planMigrations › empty local and empty applied -> nothing pending` | empty migrations dir (current state) |
| `db/migrator.test.ts › findTransactionControl › flags transaction control` | each returns the keyword: `begin;`, `BEGIN;`, `begin transaction;`, `begin work;`, `start transaction;`, `commit;`, `commit and chain;`, `end;`, `abort;`, `rollback;`, `savepoint a;`, `release savepoint a;`, `rollback to savepoint a;`, `prepare transaction 'x';`, `commit prepared 'x';`, a last statement without `;` (`select 1; commit`), leading whitespace/newlines |
| `db/migrator.test.ts › findTransactionControl › ignores non-statements` | returns `null` for: `-- commit;` line comment, `/* begin; */` and nested `/* a /* commit; */ b */`, `'commit;'` string, `'it''s; commit'` (doubled quote), `E'a\'; commit'` escape string, `"begin"` quoted identifier, `create table t (end_date date, begin_at timestamptz);`, `do $$ begin perform 1; end $$;`, `do $body$ begin if true then null; end if; end $body$;`, `create function f() returns int as $$ begin return 1; end; $$ language plpgsql;`, Vietnamese text `insert into t values ('Bắt đầu; kết thúc commit');` |
| `db/migrator.test.ts › readMigrationFiles › reads sorted .sql files, ignores README.md and .gitkeep` | temp dir via `mkdtemp`; order and checksums |
| `db/migrator.test.ts › readMigrationFiles › refuses a bad name with exit code 2` | AC 3 |
| `db/migrator.test.ts › readMigrationFiles › refuses a transaction-control file with exit code 2, message names file and keyword only` | AC 3; message has no SQL text |
| `db/migrator.test.ts › readMigrationFiles › missing directory -> exit code 2` | config error |
| `db/migrator.test.ts › real db/migrations files › well-formed, no forbidden statements` | every `db/migrations/*.sql` (zero today, so it passes trivially — do **not** copy tudocuatui's `files.length > 0`): valid name, `findTransactionControl` null, and none of `concurrently`, `create extension`, `grant`, `create role` (tudocuatui `migrator.test.ts` lines 98–117) |
| `db/migrate.cli.test.ts › exit 2 when DATABASE_URL is unset` | entry config error, message `DATABASE_URL is not set` |
| `db/migrate.cli.test.ts › exit 1 on unreachable host; output has no URL/password/host` | URL `postgres://simap:s3cretpw@127.0.0.1:1/simap` → code 1; output lacks `s3cretpw`, `127.0.0.1`, the URL (tudocuatui `migrate.cli.test.ts` lines 22–35) |
| `src/server/db/pool.test.ts › getPool returns null when DATABASE_URL is unset` | app starts without DB |
| `src/server/db/pool.test.ts › getPool returns the same pool on repeated calls` | `globalThis` singleton (clean up `globalThis.__simapPool` and `pool.end()` after) |
| `src/server/db/pool.test.ts › createPool sets max 5, connection 3 s, idle 30 s, statement 5 s, application_name simap-api` | tudocuatui `db.js` lines 12–18 (no connection is opened) |
| `src/server/db/pool.test.ts › date (oid 1082) stays a YYYY-MM-DD string` | Decision 6; `pool.options.types.getTypeParser(1082)("2026-11-20") === "2026-11-20"` under `TZ=Asia/Ho_Chi_Minh` |
| `src/server/db/pool.test.ts › pool error event logs only the code` | emit `error` with message containing a fake password → log gets `{event:"pool_error", code}` only |
| `src/server/db/pool.test.ts › ping resolves on select 1, rejects after the timeout` | fake pool; `vi.useFakeTimers()`; timer cleared on success |
| `src/app/api/readyz/route.test.ts › 503 {status:"unavailable"} when DATABASE_URL is unset (getPool null), ping not called` | AC 4 |
| `src/app/api/readyz/route.test.ts › 200 {status:"ok"} when ping resolves` | AC 4 |
| `src/app/api/readyz/route.test.ts › 503 body exactly {status:"unavailable"} when ping rejects; no message or code in body` | AC 4; error with message `password authentication failed for user "simap"` and code `28P01` |
| `src/app/api/readyz/route.test.ts › logs only the error code` | `console.error` spy: one entry `{event:"readyz_unavailable", code:"28P01"}`, no message |
| `src/app/api/readyz/route.test.ts › responses are not cached` | `Cache-Control: no-store` on 200 and 503 |
| `scripts/migrate-smoke.mjs` (not Vitest; CI step + `pnpm migrate:smoke`) | AC 1–3 against a real Postgres, throwaway database |

## Approach
1. **Deps and config.** `pnpm add pg@^8.23.1` and `pnpm add -D @types/pg@^8.23.1` (exact tudocuatui ranges, D2; `pg`
   must be a runtime dependency because the SIM-004 `migrate` container runs it). Scripts:
   `"migrate": "node --env-file-if-exists=.env.local db/migrate.js"`, `"migrate:smoke": "node
   --env-file-if-exists=.env.local scripts/migrate-smoke.mjs"` (Decision 7; Node ≥ 22.9; a variable already in the
   shell wins over the file). Add `"db"` to `tsconfig.json` `include`, `"db/**/*.test.ts"` to `vitest.config.ts`.
2. **`db/migrator.js`** (plain Node ESM, `// @ts-check`, imports only `node:*` and `pg`; no `@/`, no `server-only`,
   no Next.js). Copy from the reference `server/migrator.js` and change:
   - Drop `import { toUserId }`, `parseOwnerSub`, `ownerSub` option, `RLS_VERSION`, `RLS_TABLES`, `assertRlsForced`,
     the `tudo.owner_sub` line (reference lines 7, 92–103, 111–136, 151, 215, 223).
   - New `LOCK_KEY` constant (any fixed bigint other than tudocuatui's), `application_name: "simap-migrate"`, guard
     setting `simap.migrating` instead of `tudo.migrating` (keep the runtime guard as the second layer, lines 214–222).
   - Add pure `findTransactionControl(sql) → string | null`: walk the text once, skipping `--` line comments, nested
     `/* */` comments, `'…'` strings (with `''`), `E'…'` strings (with `\'`), `"…"` identifiers and dollar-quoted
     bodies (`$$…$$`, `$tag$…$tag$`); split the remaining text on `;`; for each statement compare its leading words
     (lower-cased) with `begin`, `start transaction`, `commit`, `end`, `abort`, `rollback`, `savepoint`, `release`,
     `prepare transaction`; return the matched keyword. `do $$ begin … end $$;` is therefore allowed (the plpgsql body is
     dollar-quoted), as tudocuatui README line 28 requires.
   - `readMigrationFiles`: after the name check, call `findTransactionControl`; on a match throw
     `MigrationError("migration <file> contains a transaction-control statement (<keyword>)", 2)`. All file checks run
     before `runMigrations` connects, so a refused file changes nothing.
   - `planMigrations`: throw `MigrationError("duplicate migration version <v>", 2)` when two local files share a version
     (first check, before the applied loop). Everything else unchanged (missing-locally, checksum mismatch, older
     pending, ahead).
   - Timeouts stay tudocuatui's: `lock_timeout 10s`, `statement_timeout 5min`, lock wait 30 s (Decision 8).
   - Never log the connection string, SQL text or PG `detail` (keep reference lines 166–170, 230–233).
3. **`db/migrate.js`**: copy reference `server/migrate.js`; dir = `path.resolve(dirname, "migrations")`; drop
   `TUDO_OWNER_SUB`; header comment states env `DATABASE_URL` (required) and exit codes 0/1/2. Run as
   `node db/migrate.js` (what SIM-004 will put in the `migrate` container: copy `db/` + `node_modules/pg`).
4. **`db/migrations/README.md`**: from the reference README keep lines 3–10 and 28–29 (adapted: runner is
   `node db/migrate.js` / `pnpm migrate`; the runner *refuses* files with transaction-control statements before it
   connects); drop lines 11–27 and 30 (tudocuatui RLS/owner/derived-value rules). Add: R6 "every org table has
   `org_id NOT NULL`; every unique key and foreign key includes `org_id`" (spec §8); rollback = previous image, fix
   forward or pre-release backup (spec §8); "the migrator holds a session advisory lock: run it over a direct
   connection, never through a transaction-mode pooler" (Decision 5); `create extension` / `grant` / `create role` are
   Ming's steps on the shared server, not migrations.
5. **`src/server/db/pool.ts`** (R1: first line `import "server-only";`): `createPool(connectionString, log)` from the
   reference `db.js` lines 11–33 (`max 5`, `connectionTimeoutMillis 3000`, `idleTimeoutMillis 30000`,
   `statement_timeout 5000`, `application_name "simap-api"`, `date` parser kept — Decision 6, error listener logging
   `{event:"pool_error", code}`). `getPool(): pg.Pool | null` reads `process.env.DATABASE_URL` on first call, returns
   `null` if unset (nothing cached), else `globalThis.__simapPool ??= createPool(url, logCode)` (survives dev hot
   reload; declare the global type). `ping(pool, timeoutMs = 2000)`: race `pool.query("select 1")` against a timer,
   clear the timer in `finally`. Log sink: `console.error(JSON.stringify(entry))` with fixed event names and the code
   only (spec §8). Drop `withUser`/`withMaintenance`/`AsyncLocalStorage` (RLS-specific; the transaction helper comes
   with the first ticket that needs one).
6. **`src/app/api/readyz/route.ts`**: `export const dynamic = "force-dynamic"`; `GET`: `const pool = getPool()`; if
   null → 503; `await ping(pool)` → 200 `{status:"ok"}`; catch → log `{event:"readyz_unavailable", code}` (pg `code`
   if a string, else `"timeout"`/`"error"`) and 503 `{status:"unavailable"}`; both with `Cache-Control: no-store`
   (same shape as `src/app/api/healthz/route.ts`). The module creates no pool at import time, so `next build` never
   connects. Import via `@/server/db/pool` (api → server is allowed; `pnpm check:layers` passes).
7. **Build check.** `pnpm build`, then confirm `.next/standalone/node_modules/pg/package.json` exists (Next's built-in
   external list includes `pg`, so it is traced, not bundled). If the build fails on `pg` or it is missing from the
   standalone output, stop and record it: the fix is `serverExternalPackages` in `next.config.ts`, a High path that is
   not in this plan.
8. **`compose.dev.yml`** (Decision 4): service `db`, `image: postgres:17`, `POSTGRES_DB: simap`, `POSTGRES_USER:
   simap`, `POSTGRES_HOST_AUTH_METHOD: trust`, `ports: ["127.0.0.1:5432:5432"]`, healthcheck `pg_isready -U simap -d
   simap`, named volume `simap-dev-db`. Local URL `postgres://simap@127.0.0.1:5432/simap` — no password anywhere.
9. **`.env.example`**: comment + `DATABASE_URL=` (name only, R3). README shows the local URL for `.env.local`.
10. **`scripts/migrate-smoke.mjs`** (Decision 3): connect with `DATABASE_URL`, `create database simap_smoke_<random
    hex>`, run against that database with fixture files written to `mkdtemp(os.tmpdir())`:
    (1) two files (`create table smoke_a (id int primary key);`, `insert into smoke_a values (1);`) → both applied in
    order, `select count(*) from schema_migrations` = 2; (2) rerun → log `up to date`; (3) append a comment line to the
    first file and add a third file → `checksum mismatch`, count still 2, `smoke_c` table absent; (4) a dir with a file
    containing `commit;` and a dir with `bad-name.sql` → `MigrationError` exit code 2. `finally`: drop the database
    (`with (force)`), remove temp dirs. Prints only step names and pass/fail; never the URL. Exit 1 on any failed
    assertion. Uses `runMigrations` directly so no dir override is added to the production entry.
11. **CI** (`.github/workflows/ci.yml`): add the `services.postgres` block from the tudocuatui reference ci.yml lines
    20–27 (`postgres:17`, `POSTGRES_PASSWORD: postgres` — a throwaway CI-service value, not a secret, as in tudocuatui).
    After `pnpm test`: step "migrate CLI" with `env: DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres`,
    `shell: bash`, `node db/migrate.js` then `node db/migrate.js | tee /dev/stderr | grep -q "up to date"`; step
    "migrate smoke" `node scripts/migrate-smoke.mjs` with the same env. Vitest steps get no `DATABASE_URL`.
12. **Docs**: README "Local database" section (compose up/down, `.env.local` line, `pnpm migrate`, `curl
    /api/readyz`); CLAUDE.md Commands; loop.config Prepare.
13. **Manual run** (record commands and outputs, never env values, in `impl-log.md`): compose up → `pnpm migrate` with a
    throwaway uncommitted `db/migrations/20000101000000_sample.sql` → rerun (`up to date`) → edit it (checksum error)
    → delete the file, `docker compose -f compose.dev.yml down -v` to reset → `pnpm dev` readyz 200 → stop db → 503.
    Never commit the sample file.

Rules: R1 (server-only header, api-only entry — `pnpm check:layers`), R2/D3 (forward-only, checksums, no down files),
R3 (`.env.example` name only, URL never printed — CLI test), R4 (only the files above), R5 (tests listed, checks green),
R6 (documented in the migrations README; enforced by the schema ticket's review).

## Specialist input used
`consult-database-optimizer.md`:
- Findings (reference structure, drops for simap, `db.js` settings, exit codes, CI service): adopted.
- Rec 1 (`globalThis` lazy pool, null without URL, `server-only`, error listener, `simap-api`): adopted.
- Rec 2 (`serverExternalPackages`): rejected for now — `pg` is on Next's built-in external list; Approach 7 checks it
  and stops if not, to keep `next.config.ts` (High) out of the diff.
- Rec 3 (migrator outside `src/`, no `server-only`/`@/`, JS `@ts-check`): adopted (Decision 1).
- Rec 4 (pre-scan + keep runtime guard): adopted; scan also skips dollar quotes so `do $$ begin … end $$;` passes.
- Rec 5 (pure planning + edge-case tests incl. duplicate version): adopted.
- Rec 6 (`/api/readyz`, `force-dynamic`, 2 s race, `{status}` bodies, code-only log, no auth): adopted.
- Rec 7 (CI postgres service + migrate twice): adopted, extended with `scripts/migrate-smoke.mjs` (Decision 3).
- Rec 8 (compose `postgres:17`, 127.0.0.1, healthcheck, volume): adopted, but with `trust` auth instead of a committed
  dev password (Decision 4).
- Rec 9 (README rules + R6, keeps the dir): adopted; no `.gitkeep` needed (README keeps the dir).
- Drop of the `date` type parser: rejected — it prevents `date` columns becoming local-midnight `Date` objects
  (UTC vs UTC+7, Domain focus); it is not RLS-specific (Decision 6).
- Risk "per-run env override for timeouts": not adopted (D2 "no extras"; Decision 8).
- Risk "pooler breaks the advisory lock": documented in the migrations README (Decision 5).
- Risk "CRLF": already handled by checksum normalisation and `.gitattributes` `* text=auto eol=lf`.

## Decisions for Ming
Approving the plan accepts every default below. All are reversible.
1. **Migrator language.** JS with `// @ts-check` (`db/migrator.js`, `db/migrate.js`), copied as in tudocuatui and run by
   plain `node` — vs TypeScript run with Node 22 type stripping. Why: JS needs no build step for the SIM-004 container
   and stays diff-able against tudocuatui. **Default: JS with `@ts-check`.**
2. **Readiness contract.** `GET /api/readyz` → 200 `{status:"ok"}` / 503 `{status:"unavailable"}`, public, 2 s timeout;
   liveness stays the existing `/api/healthz` (SIM-001), so no new liveness route. **Default: yes.**
3. **DB checks in CI.** Add a `postgres:17` service to `ci.yml`, run `node db/migrate.js` twice, and run
   `scripts/migrate-smoke.mjs` (throwaway database; checks apply-in-order, re-run, checksum error, refusals). This is a
   scripted smoke, not the Vitest DB integration suite D2 defers. Why: gives the reviewer automated evidence for AC 1–3
   instead of only a manual run. Cost ~80 lines + ~20 s CI. **Default: yes** (alternative: CLI-twice only, AC 1–3
   rest on unit tests + recorded manual run).
4. **Local dev DB auth.** `compose.dev.yml` uses `POSTGRES_HOST_AUTH_METHOD: trust` with the port bound to `127.0.0.1`,
   so no password is committed at all (gitleaks-clean). **Default: trust on localhost** (alternative: a committed
   dev-only password such as `simap-dev`).
5. **Shared Postgres connection for `migrate`.** The migrator uses a session-level advisory lock, so on the shared
   mmlabs Postgres it must use a direct (or session-mode pooler) connection; the app pool may use either. Only
   documented here; settled at M-3/SIM-004. **Default: direct connection for `migrate`.**
6. **Keep tudocuatui's `date` parser** (Postgres `date` returned as `'YYYY-MM-DD'` string, not a JS `Date`).
   Why: avoids off-by-one-day bugs between UTC and UTC+7. **Default: keep.**
7. **`pnpm migrate` reads `.env.local`** via `node --env-file-if-exists=.env.local` (a shell variable still wins; the
   container runs `node db/migrate.js` with its own env). **Default: yes** (alternative: Ming always exports
   `DATABASE_URL` in the shell).
8. **Migration timeouts** stay tudocuatui's fixed values (`lock_timeout 10s`, `statement_timeout 5min`, lock wait 30 s)
   with no env override; a backfill that needs more gets its own follow-up. **Default: fixed.**

## Assumptions
- Node ≥ 22.9 locally and in CI (`--env-file-if-exists`); `engines` already says `>=22 <23` and CI uses the latest 22.
- Next.js 16 still lists `pg` in its built-in server external packages (checked by Approach 7, not assumed blindly).
- Docker (Desktop or WSL) is available on Ming's machine for `compose.dev.yml`; tests do not need it.
- `pnpm build` does not need `DATABASE_URL` (lazy pool, `force-dynamic`).
- Hotspots: no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (SIM-003, SIM-004 are `BACKLOG`). SIM-004 will later
  edit `.github/workflows/ci.yml`, `package.json` and `README.md` and will consume `db/migrate.js`; it runs after this
  ticket merges, so no rebase expected.
- The PR is **High** (`.env.example`, `db/migrations/README.md`): Ming reviews and merges it.
- The security auditor review trigger fires (`src/server/`, `db/`, `.env.example`, `.github/workflows/`).

## Blocking questions
None.

## Split proposal
None. Estimated ~500 changed lines of non-lockfile code and docs plus ~250 lines of tests; much of it is a near-verbatim
port of reviewed tudocuatui code. If Ming declines Decision 3, the diff drops by ~100 lines.
