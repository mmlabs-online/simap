Status: READY

> **Plan approval required (High path).** This plan modifies one High path: `.env.example` (names only). The ticket
> says `Gate: none`, but `loop.config.md` → "Plan approval gate: `high-paths`" applies, so Ming approves before
> IMPLEMENT. `Dockerfile`, `.dockerignore`, `deploy/**` and `db/migrations/**` are **not** touched. `db/` also triggers
> `security-ai-generated-code-auditor` at review. Three decisions for Ming are under `## Assumptions`; each has a default.

# Plan — SIM-029: Guard dev scripts against the production DB and add `pnpm dev:prod`

## Scope summary
- Ticket goal: "Let Ming run the local app against the production database through the Cloudflare pg-tunnel without any
  dev script being able to migrate, seed or create throwaway databases there."
- D56 (`work/decisions.md:63`): "The production DB is reachable from dev only through the pg-tunnel with the URL given
  at runtime, and dev scripts refuse it."
- `loop.config.md` Guardrails: "Never apply migrations to a production database".
- Ticket scope: "`pnpm migrate`, `seed:dev`, `test:db`, `schema:check`, `migrate:smoke` refuse a production target (exit
  2, value never printed), even though the host is `127.0.0.1`. The production image's migrate entry (`node db/migrate.js`
  in the container) keeps working."
- Ticket scope: "`pnpm dev:prod` (`scripts/dev-prod.mjs`, cross-platform Node; the simap counterpart of tudocuatui
  `scripts/start-dev.sh`), in order, stopping at the first failure with nothing started": token → tunnel → `.env.local`
  check and hidden password → SIM-028 launcher with banner.
- Ming's note in the ticket: "`pnpm dev:prod` is simap's one-command equivalent of tudocuatui `scripts/start-dev.sh`
  (token → tunnel → password → app), written in Node for Windows; one Next.js process replaces tudocuatui's API + UI pair."

Out of scope (ticket): starting the tunnel project itself (`d:\project\pg-tunnel`), creating the `simap` role (M-3).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | "Each of the five scripts exits 2 before connecting when `DATABASE_URL` points at port 15432 or `SIMAP_DB_TARGET=production`; tests cover each entry." | `scripts/prod-guard.cli.test.ts` runs the entry of all five scripts through a table of production targets: exit 2, refusal on stderr, no secret in the output. `package.json` wiring test proves `pnpm migrate` runs the guarded wrapper. |
| 2 | "The container migrate path (`NODE_ENV=production`, image entry) is unaffected; a test proves it." | `db/migrate.cli.test.ts` › "image entry ignores the dev guard" (exit 1 from a closed port, not 2) and › "imports stay inside the image". `git diff main -- Dockerfile db/migrate.js db/migrator.js deploy` is empty. |
| 3 | "`pnpm dev:prod` never writes the password or URL to disk or stdout and refuses when `.env.local` has `DATABASE_URL`." | `scripts/dev-prod.test.ts` › secrecy, `.env.local` and "no file-write API" cases. |
| 4 | "`pnpm dev:prod` stops before asking for the password when the token step or the tunnel step fails, and with a valid token and tunnel starts the app bound to `127.0.0.1` (`/api/readyz` 200); tests cover the step order with the token, Docker and child-process calls injected." | `scripts/dev-prod.test.ts` › step-order cases assert the exact call trace and the `next dev -H 127.0.0.1` argv. The live `/api/readyz` 200 needs the production DB: see Ming verification. |
| 5 | "All Checks green." | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `pnpm test:db` against the local compose Postgres or in CI. |

## Ming verification after merge
Needs M-3 (database and role `simap`) and the real tunnel. Agents must not run these.
1. Tunnel up, `pnpm dev:prod` in PowerShell: enter the role password, banner shows, `curl -i http://127.0.0.1:3000/api/readyz` answers 200.
2. Ctrl-C stops the app; the terminal still echoes typed input.
3. `$env:DATABASE_URL = "postgres://u@127.0.0.1:15432/simap"; pnpm seed:dev` exits 2 and writes nothing. Clear it afterwards with `Remove-Item Env:DATABASE_URL`.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/target.js` | **Create.** Zero-import classifier: `tunnelPorts(env)`, `classifyTarget({ databaseUrl, env })` | Shared pure check (ticket scope) | No |
| `db/target.test.ts` | **Create.** Classifier unit tests | R5, ticket test plan | No |
| `db/seeder.js` (lines 9-31) | `assertDevSeedTarget` takes `env` (default `process.env`) and calls the classifier | One change covers `seed-dev.js`, `test-db.mjs`, `schema-check.mjs` and `src/test/db/global-setup.ts`, whose call sites stay unchanged | No |
| `db/seeder.test.ts` | Pass `env: {}` in existing calls; add production cases | Tests must not depend on the developer's shell | No |
| `db/migrate.cli.test.ts` | Add the two image-entry tests | AC 2 | No |
| `scripts/migrate-dev.mjs` | **Create.** Guard, then `await import("../db/migrate.js")` | `pnpm migrate` is guarded, image entry untouched (consult option 3) | No |
| `scripts/migrate-smoke.mjs` (after line 14) | Add the guard, exit 2 | It runs `create database` with no guard today | No |
| `scripts/dev-prod.mjs` | **Create.** `run(deps)` plus pure helpers and `main` | Ticket scope | No |
| `scripts/dev-prod.test.ts` | **Create.** Injected step, secrecy and URL tests | AC 3, AC 4 | No |
| `scripts/prod-guard.cli.test.ts` | **Create.** CLI table over the five entries | AC 1 | No |
| `scripts/dev-token.mjs` (lines 14, 218-221) | Export `JWT_SHAPE`; export `promptPassword(label = "Password: ")` | Reuse the hidden prompt and token shape | No |
| `package.json` (line 16, scripts) | `migrate` → `node --env-file-if-exists=.env.local scripts/migrate-dev.mjs`; add `"dev:prod": "node scripts/dev-prod.mjs"` | Ticket scope | No |
| `README.md` (after line 44; touch lines 8 and 22 only if needed) | "Production database (dev)" section with the guardrails | Ticket scope | No |
| `.env.example` | Append names only: `SIMAP_DB_TARGET=`, `SIMAP_PROD_TUNNEL_PORT=`, `SIMAP_PG_TUNNEL=` | R3 | **Yes (High)** |

Not modified on purpose: `db/migrate.js`, `db/migrator.js`, `Dockerfile`, `db/seed-dev.js`, `scripts/test-db.mjs`,
`scripts/schema-check.mjs`, `src/test/db/global-setup.ts`, `scripts/dev.mjs`. The ticket's "Files" note lists some of
these; the shared guard and the wrapper make their edits unnecessary.

`.env.example` handling: this planning run did not open it. Confirm the three names are absent with a Grep **count**,
append the lines without printing the file, and check that the diff adds only those name lines.

## Data model / migration
None.

## API contract
None. `/api/readyz` is used unchanged.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `db/target.test.ts` › default and override tunnel ports | 15432 always refused; override **adds** a port; invalid override (`abc`, `0`, `65536`, `1.5`) fails closed; empty means unset |
| `db/target.test.ts` › `SIMAP_DB_TARGET` values | Unset, empty, `local`, `dev` (trimmed, any case) are non-production; `production`, `PROD`, typos are production |
| `db/target.test.ts` › URL port forms | `127.0.0.1:15432`, `[::1]:15432`, `localhost:015432`, `postgresql://` are production; `:5432` and no port are not |
| `db/target.test.ts` › query and PGPORT | `?port=` always production; `PGPORT` of `15432` or `015432` production; non-digit `PGPORT` (`15432abc`) production |
| `db/target.test.ts` › malformed and multi-host | Unparsable and `postgres://a:1,b:2/db` fail closed; the result carries no URL text |
| `db/seeder.test.ts` › "refuses a production target on loopback" | Guard message matches `/target is production/`, no secret |
| `db/seeder.test.ts` › "keeps the local compose URL working" | `postgres://simap@127.0.0.1:5432/simap` with `env: {}` passes |
| `scripts/prod-guard.cli.test.ts` › "`<entry>` exits 2 on `<target>`" | Five entries (`scripts/migrate-dev.mjs`, `db/seed-dev.js`, `scripts/test-db.mjs`, `scripts/schema-check.mjs`, `scripts/migrate-smoke.mjs`) × targets: port 15432, `SIMAP_DB_TARGET=production` on 5432, override port, `PGPORT=15432`, `?port=15432`. Exit 2, empty stdout, no `secret-pw` |
| `scripts/prod-guard.cli.test.ts` › "`pnpm migrate` runs the guarded wrapper" | `package.json` `scripts.migrate` contains `scripts/migrate-dev.mjs`, not `db/migrate.js` |
| `scripts/prod-guard.cli.test.ts` › "`NODE_ENV=production` does not bypass the wrapper" | `scripts/migrate-dev.mjs` exits 2 |
| `db/migrate.cli.test.ts` › "image entry ignores the dev guard" | `node db/migrate.js`, `NODE_ENV=production`, `SIMAP_DB_TARGET=production`, `SIMAP_PROD_TUNNEL_PORT=1`, URL on closed port 1: exit **1**, no "refus" text |
| `db/migrate.cli.test.ts` › "imports stay inside the image" | `db/migrate.js` and `db/migrator.js` import only `node:*`, `pg` and `./migrator.js`; Dockerfile line 24 copies each relative import |
| `scripts/dev-prod.test.ts` › `tokenIsFresh` | Missing, malformed, bad payload, no `exp`, expiring in ≤120 s are stale; 121 s is fresh |
| `scripts/dev-prod.test.ts` › `envFileSetsDatabaseUrl` | Plain, indented, `export`, BOM, CRLF match; comments and `DATABASE_URL_X` do not |
| `scripts/dev-prod.test.ts` › `buildProdUrl` round-trip | Parsed with `pg-connection-string`: exact password for `@ : / ? # % & + space ' " \ [ ]`, Vietnamese diacritics, lone `%`; user/db `simap`, host `127.0.0.1`, no `sslmode`; classified production |
| `scripts/dev-prod.test.ts` › order: happy path | Trace is exactly token check → docker inspect → probe → env check → prompt → spawn |
| `scripts/dev-prod.test.ts` › token stale, refreshed / still stale / dev-token fails | Runs dev-token once; failure means no docker, prompt or spawn |
| `scripts/dev-prod.test.ts` › docker stopped / start fails / inspect fails / probe fails | `docker start` only when stopped; every failure means no prompt or spawn |
| `scripts/dev-prod.test.ts` › invalid `SIMAP_PG_TUNNEL`, invalid tunnel port, unsafe `NODE_OPTIONS`, bad argv | Exit before any docker call |
| `scripts/dev-prod.test.ts` › `.env.local` sets `DATABASE_URL` | Exit 2, no prompt or spawn; the line's value is not in the output |
| `scripts/dev-prod.test.ts` › empty password | Exit 1, no spawn |
| `scripts/dev-prod.test.ts` › child env and argv | `DATABASE_URL` encoded, `SIMAP_DB_TARGET=production`, `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1`, `PG*` removed; argv starts `dev -H 127.0.0.1` and never contains the password |
| `scripts/dev-prod.test.ts` › secrecy | Across success and spawn failure, captured out/err contain neither raw nor encoded password nor the URL; banner printed |
| `scripts/dev-prod.test.ts` › no file-write API | Source imports no `writeFile`, `appendFile`, `createWriteStream` |

Test safety: CLI tests pass a minimal env (`PATH`, plus `SystemRoot` on Windows) so the developer's `PG*`, `SIMAP_*` and
`.env.local` cannot affect them. Tests that are expected to reach a connection use closed port 1, **never 15432**,
because Ming's real tunnel may be listening there.

## Approach
1. **`db/target.js`** (`// @ts-check`, no imports, messages never include the URL).
   - `tunnelPorts(env)`: always contains 15432, adds a valid `SIMAP_PROD_TUNNEL_PORT` (`/^[1-9]\d{0,4}$/`, ≤ 65535). Returns `{ ports, primary, valid }`; `primary` is the override when set.
   - `classifyTarget({ databaseUrl, env })` returns `{ production: boolean }`. Production when: `SIMAP_DB_TARGET` (trimmed, lower-cased) is not empty/`local`/`dev`; the override is invalid; the URL does not parse; the query has `port`; the URL port is a tunnel port; or `PGPORT` is set and is not all digits or equals a tunnel port **numerically** (`pg@8.23.1` `connection-parameters.js:70` uses `parseInt`, so `15432abc` and `015432` both reach the tunnel).
2. **`assertDevSeedTarget`**: signature `{ databaseUrl, nodeEnv, env = process.env }`. Keep every existing check and message first (existing tests match `/not local/`), then throw `refusing: database target is production` when classified production.
3. **`scripts/migrate-dev.mjs`**: if `DATABASE_URL` is unset, let `db/migrate.js` report it (same exit 2). Otherwise call the guard; on failure print `migrate refused: <message>` and exit 2 **before** the dynamic import. **`migrate-smoke.mjs`**: same guard after line 14, `migrate:smoke refused: <message>`.
4. **`scripts/dev-prod.mjs`**: `export async function run(deps)` returning the exit code, in the style of `dev-token.mjs`. Deps: `env, argv, now, readTokenFile, runDevToken, docker, probe, sleep, readEnvLocal, promptPassword, spawnApp, out, err`. Before step 1, validate with no side effects: `assertNodeOptionsSafe`, `nextDevArgs(argv)`, container name `/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/`, tunnel port valid. `main` refuses a non-TTY stdin.
   1. Token: read `tokenFilePath(env)`; if not fresh (`exp - now > 120`), run `process.execPath scripts/dev-token.mjs` with `stdio: "inherit"`, then re-read and re-check. Stop with exit 1 if still stale.
   2. Tunnel: `docker inspect -f {{.State.Running}} <name>` via `spawnSync` with an args array and no shell; `docker start <name>` if not running; then TCP probe of `127.0.0.1:<primary>` (2 s timeout, retry up to about 10 s). Exit 1 on failure.
   3. `.env.local`: line check only (exit 2 on match; the message names the file and variable). Then `promptPassword("Password for database role simap: ")`; empty means exit 1.
   4. Build `postgres://simap:${encodeURIComponent(pw)}@127.0.0.1:${primary}/simap`, matching tudocuatui `start-dev.sh` (user and db = app name, no `sslmode`). Child env: copy `env`, delete `PGHOST PGHOSTADDR PGPORT PGUSER PGPASSWORD PGDATABASE PGSSLMODE PGSERVICE PGSERVICEFILE PGPASSFILE`, set `DATABASE_URL` and `SIMAP_DB_TARGET=production`, apply `devEnv()`. Print `[dev:prod] production data: every change is real`. Spawn `process.execPath <next bin> ...nextDevArgs(argv)` with `stdio: "inherit"`.
   - Ctrl-C: the parent handles SIGINT/SIGTERM by calling `child.kill()` once and waiting; it exits with the child's code (`code ?? (signal ? 1 : 0)`, as `dev.mjs`). Raw mode is already off after the prompt. Unexpected errors print a fixed message, never `err.message` from a path holding the URL.
5. **README**: how to run, what is refused, the `.env.local` step (decision 1), that the password is asked each run and kept only in the child env, that SIMAP_* overrides for `dev:prod` come from the shell (it does not load `.env.local`), and that `node db/migrate.js` is the image entry and must not be run from a laptop.

Rules: **R1** not affected (`db/` and `scripts/` are outside the app layers; no `src/` change). **R2** no schema change. **R3** names only in `.env.example`; no value logged. **R4** file list above. **R5** tests listed. **R6** no query change.

## Specialist input used
From `consult-database-optimizer.md`:
- **Adopted:** zero-import classifier; allowlist for `SIMAP_DB_TARGET` (fail closed); override adds to 15432; `?port=` and PGPORT handling; guard inside `assertDevSeedTarget`; **option 3** wrapper; closed-port and import-closure container tests; `run(deps)` structure; `encodeURIComponent` with a parser round-trip; PG* removal; `SIMAP_DB_TARGET=production` in the child.
- **Adapted:** the consult's "refuse any PGHOST/PGHOSTADDR" is not needed: a URL without a host is already refused and a URL host takes precedence over `PGHOST`, so only `PGPORT` can redirect an accepted URL.
- **Rejected:** moving the `.env.local` check first. The ticket fixes the order (token, tunnel, then `.env.local` and password).
- **Open questions resolved:** Q1 the Dockerfile line 19 sets `NODE_ENV=production`, but option 3 does not rely on it. Q2/Q3 as adopted. Q4 from the orchestrator's reading of `start-dev.sh`. Q5 yes. Q6 `db/migrate.js`, `Dockerfile` unchanged; only `.env.example` is High. Q7 only `.env.local` is checked (ticket wording); the child env wins over Next's env files.

## Assumptions
### Decisions for Ming (the default applies unless Ming changes it at plan approval)
1. **`.env.local` conflict with the documented local setup.** README lines 8 and 22 tell developers to keep the *local* `DATABASE_URL` in `.env.local`, and the ticket requires `dev:prod` to refuse any such line, even a harmless local one. **Default: follow the ticket.** Ming comments that line out while using `dev:prod` and restores it for local work; the refusal message and README say so. Alternative: allow a loopback non-tunnel URL there, since the child env overrides it (weaker, and changes the acceptance criterion).
2. **`node db/migrate.js` typed by hand on a laptop stays unguarded.** It is the image entry, and leaving it untouched is what keeps the container safe. **Default: accept**, documented in README. `dev:prod` keeps the URL only in the child env, so a normal shell does not hold it. Alternative: an image-only marker in the Dockerfile plus a check in `migrate.js` (a second High-path change, and a marker can still be set by hand).
3. **`pnpm migrate` and `migrate:smoke` become local-only**, not just "not the tunnel". This also refuses any non-local host and `NODE_ENV=production`, which closes the remote-URL and `NODE_ENV=production pnpm migrate` bypasses. **Default: yes.** CI is unaffected: it uses `localhost` and calls `node db/migrate.js` directly (`ci.yml:38-48`). Alternative: refuse only production-classified targets.

### Other assumptions
- `dev:prod` accepts the same port options as `pnpm dev`. The org for a token refresh comes from `SIMAP_DEV_ORG`; with no org `dev-token` already warns and API calls answer 403 `org_required`.
- A TCP answer proves only that the tunnel port is open; a wrong password surfaces later as `/api/readyz` 503.
- The port rule cannot detect a production forward on some *other* local port unless `SIMAP_PROD_TUNNEL_PORT` or `SIMAP_DB_TARGET` is set. This is the ticket's chosen rule.
- `CLAUDE.md` Commands does not list `dev:prod` after this ticket; it is outside the file list. Follow-up: add it.
- Hotspots: the only other open ticket on the board is SIM-027 (`IN_PROGRESS`). It has no `plan.md` yet and its `ticket.md` names none of `README.md`, `package.json`, `scripts/`, `db/` or `.env.example`, so no rebase is expected; recheck if its plan lands first.

## Blocking questions
None. The three decisions above have safe defaults and do not block planning; they are confirmed at the plan-approval gate.

## Split proposal
None. Estimate: about 300 lines of product code and 350-400 of tests, so above the rough 400-line guide only because of the test tables. If review cost becomes a concern, the clean boundary is **slice A** (classifier, guards, wrapper) and **slice B** (`dev:prod`, README).
