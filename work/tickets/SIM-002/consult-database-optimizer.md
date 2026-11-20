# Consult — database-optimizer — SIM-002

> Orchestrator note: the agent read the tudocuatui working tree (branch `bug/BUG-010`), not `origin/main`. Checked after: `server/migrator.js`, `server/db.js`, `server/migrate.js` are identical on both. An `origin/main` (41ee069) export of the reference files is at the session scratchpad `ref-tudocuatui-main/`.

Note: no shell — read tudocuatui working tree (migrator.js, db.js, migrate.js, ci.yml), not origin/main; may differ. Did not read db/migrations/README.md or tudocuatui tests.

**Findings**
- tudocuatui migrator is small and portable: pure `parseMigrationFilename`, `checksum` (sha256, CRLF→LF), `planMigrations`, `readMigrationFiles`; `runMigrations` uses a dedicated `pg.Client`, `pg_try_advisory_lock` retry loop (30s), `schema_migrations(version,name,checksum,applied_at)`, one transaction per file with `lock_timeout` 10s / `statement_timeout` 5min, rollback on error, unlock in `finally`.
- Transaction-control rejection is a runtime guard (`set local tudo.migrating` checked after the file; if the file committed, the setting is gone). It does not prevent earlier statements of the file from committing, and the ticket AC wants `begin`/`commit` files "refused" — a pre-scan is needed to refuse before execution.
- `planMigrations` also covers "database ahead of image" (warn, apply nothing), "applied but missing locally" (error), "pending older than newest applied" (error) — all fit forward-only/expand-contract (D3).
- Drop for simap: `assertRlsForced`, `RLS_VERSION`, `RLS_TABLES`, `ownerSub`/`parseOwnerSub`, `tudo.*` settings, `./user.js` import.
- tudocuatui `db.js`: `max: 5`, `connectionTimeoutMillis` 3000, `statement_timeout` 5000, pool `error` listener logging only code, `ping` = `select 1`. Drop date parser override and `withUser`/`withMaintenance` (RLS-specific).
- tudocuatui `migrate.js`: standalone ESM entry, exit codes 0/1/2, no URL in output, unhandled-error handler. CI Postgres service `postgres:17` with `pg_isready` healthcheck + migrate CLI smoke (run twice, grep "up to date").
- Risk tiers: `db/migrations/**`, `**/*.sql`, `.env.example`, `**/config.*` are High. This ticket touches `.env.example` and `db/migrations/README.md` → PR is High, plan gate required. `src/server/db/*` names are Medium; avoid naming anything `config.*` or `auth*`.

**Recommendations**
1. Pool singleton for Next.js: cache on `globalThis` (`globalThis.__simapPool ??= createPool()`) to survive dev hot reload; lazy-create on first use; null when `DATABASE_URL` unset; `import "server-only"` (R1). Pool `error` listener, `max` ~5–10, `application_name: "simap-api"`, same timeouts as tudocuatui.
2. Add `pg` to `serverExternalPackages` in `next.config` (High path — flag for the plan gate) or confirm not needed; in standalone output `pg` is traced normally.
3. Keep the migrator in a module without `server-only` and without `@/` alias — the standalone entry runs it with plain Node, outside the Next trace. Pure logic + runner in e.g. `db/migrator.ts`, entry `db/migrate.ts`; check Node 22 can run TS directly (`--experimental-strip-types`; no enums, `.ts` import extensions), otherwise `.js` with `@ts-check` like tudocuatui. SIM-004 can COPY these files into the migrate container (no outDir/bundle needed for JS).
4. Add a transaction-control pre-scan (strip comments and string literals; refuse `begin|commit|rollback|end|abort|start transaction|savepoint` at statement level); keep the `set local` guard as a second layer. Unit-test both.
5. Keep file-name parsing / ordering pure; tests for bad name, duplicate version, checksum mismatch, missing-local, older-pending, ahead.
6. Readiness: `/api/readyz`, `export const dynamic = "force-dynamic"`, race `select 1` against ~2s; `{status:"ok"}` or 503 `{status:"unavailable"}` — no error text/codes in the body; log only the error code server-side; no auth; nothing in the body about which check failed.
7. CI: `postgres:17` service + healthcheck as tudocuatui; `DATABASE_URL` as job env with the throwaway password (CI service value, not a secret); smoke: `migrate` twice, assert "up to date"; empty migrations dir must exit 0. Ticket puts the DB test suite out of scope → only the smoke test in CI.
8. Local dev: `compose.dev.yml` with `postgres:17`, db/user `simap`, healthcheck, named volume, port bound to `127.0.0.1`. Dev password only in compose and as a placeholder name/URL template in `.env.example`, no real value.
9. `db/migrations/README.md`: copy tudocuatui rules, drop the RLS section, add R6 (`org_id NOT NULL` on every org table, part of every unique key and FK, per spec §8). `.gitkeep`/README so the dir exists. README R6 text is a High path.

**Risks**
- A malformed sample migration with `commit` could partly apply if only the runtime guard exists → recommendation 4.
- Advisory lock is session-level: pooled/transaction-mode pgbouncer breaks it; migrator must use a direct connection — document for D3's shared Postgres.
- `statement_timeout` 5min / `lock_timeout` 10s may be wrong for big backfills; allow a per-run env override.
- Next.js build may evaluate the route at build time; lazy pool + `force-dynamic` avoids it.
- Windows CRLF handled by checksum normalisation; also `.gitattributes` `*.sql text eol=lf`.

**Open questions**
1. Migrator in TS (Node 22 strip-types / build step) or JS with `@ts-check`? Default: JS with `@ts-check`, copied as-is.
2. Readiness path `/api/readyz` and body `{status}` — confirm; separate liveness route? Default: no, SIM-004 may add.
3. CI smoke test in this ticket (default yes; DB suite deferred per D2)?
4. `DATABASE_URL` in `compose.dev.yml` with a committed dev-only password? Default: yes, local-only dev value, never reused.
5. Shared mmlabs Postgres: direct connection or pooler? Affects the advisory lock.
