# Security review — SIM-002

## Attempt 1
Agent: security-ai-generated-code-auditor (run via general-purpose with the agent file; opus). Read-only, `git diff origin/main...HEAD`. `.env.example` not reviewed (deny rule).

Verdict: **no 🔴 blockers.** One 🟡 worth fixing in-ticket (#1); rest are notes.

### Findings
1. 🟡 `scripts/migrate-smoke.mjs:18`, `:37-39` — no catch before the `try`: `new URL(base)` throws on a malformed `DATABASE_URL`, and Node's `ERR_INVALID_URL` carries an `input` property that is printed when uncaught (full URL incl. any password); uncaught `admin.connect()` / `create database` failures also dump pg error + stack. Harmless in CI (throwaway creds); locally the script runs with `--env-file-if-exists=.env.local`, so that URL would be printed — contradicts the header's "Never prints the URL". **Fix:** wrap setup in try/catch and print a generic `migrate smoke failed: cannot connect/parse (DATABASE_URL not printed) [code]`, like `db/migrate.js`.
2. 🟡 `.github/workflows/ci.yml:21` — new `postgres:17` service image on a mutable tag (new unpinned supply-chain input on top of SIM-001 #2). **Fix:** pin `postgres:17@sha256:<digest>`, or fold into the SIM-001 SHA-pin debt item.
3. 💭 `db/migrator.js:100-166` (transaction-control pre-scan) — no realistic bypass found: comments (incl. nested), `''`/`""` doubling, `E''` escapes, dollar-quote tags with identifier boundary all match Postgres lexing; unterminated quote/dollar quote is a server syntax error so it cannot hide a later statement; `set standard_conforming_strings` inside the file does not change parsing of later statements in the same simple query; `DO`/`CALL` with `COMMIT` errors inside a transaction block. Runtime guard `:268-274` is a second layer. Migration authors are trusted committers → safety net, not a security boundary. Optional: add a test for `E'\''; commit; --'`.
4. 💭 `db/migrator.js:269` — a plain (non-`local`) `SET ROLE` / `SET SESSION AUTHORIZATION` in one migration persists for the session and applies to later migrations and the `schema_migrations` insert. **Fix:** `reset role; reset session authorization` after each commit, or add to the README "do not write" list.
5. 💭 `db/migrator.js:283-284` — on failure prints Postgres `err.message` (never `detail`); may echo a literal from the migration SQL, not data/credentials. Acceptable.
6. 💭 `src/app/api/readyz/route.ts:62-79` — unauthenticated, `{status}` only, `no-store`, logs only a code, no detail in 503. Fine. Minor DoS amplification: each hit runs a DB query and `ping` (`pool.ts:40-53`) does not cancel the query on timeout, so a flood can hold all 5 pool slots. **Fix (later ticket):** rate-limit at the proxy or cache the result ~1 s.
7. 💭 `package.json` `migrate:smoke` loads `.env.local`; if it ever points at the shared server, smoke runs `create database` / `drop database … with (force)` there (only its own random `simap_smoke_<hex>`). Low risk. **Fix:** document "local DB only" in the README or refuse a non-localhost host.

### Checked and clean (🟢)
- `src/server/db/pool.ts`: `import "server-only"`, no `NEXT_PUBLIC_`; logs only `{event, code}` (`:28`); URL never logged; invalid URL → only `ERR_INVALID_URL` code reaches the readyz log.
- `db/migrate.js`: URL never printed; connect/parse errors caught in `runMigrations` (`migrator.js:210-225`) with a generic message; `unhandledRejection`/`uncaughtException` handlers print nothing sensitive.
- SQL injection: `schema_migrations` insert parameterized (`migrator.js:276`); `LOCK_KEY` constant; smoke `dbName` random hex (`migrate-smoke.mjs:16`).
- `compose.dev.yml:9-10`: trust auth, port bound to `127.0.0.1` only, no password committed.
- `ci.yml`: `postgres:postgres` creds are an ephemeral service container, not a secret; `permissions: contents: read` unchanged; trigger `pull_request` (not `_target`); no repo secrets.
- `db/migrations/README.md`: consistent with the runner; keeps `grant`, `create role`, `create extension` out of migrations as Ming's manual steps.

### SIM-001 🟡 carry-over
- #1 `persist-credentials` (`ci.yml:28`) and #2 SHA pins (`:28-30`) unchanged, not fixed; slightly more exposed (more steps run repo code with the persisted read-only token; new unpinned image #2). Not worse in kind.

### Follow-ups (out of scope)
- `debt` issue for SIM-001 #1/#2 incl. the postgres image digest pin.
- Readyz rate-limit / caching when the reverse proxy lands (SIM-004?).
