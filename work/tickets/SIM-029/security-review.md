# Security review — SIM-029

## Attempt 1

Verdict: REWORK

Static review only: I had no way to run commands, so nothing was executed. `impl-log.md` records `test:db` as not run.

### Findings

#### 🔴 1. The default tunnel container name is wrong, so `pnpm dev:prod` cannot start on a default setup
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:66`, repeated in `d:\project\simap-game-ui\README.md:52`.
- **Risk:** the code defaults to `pg-tunnel`, but the ticket (`ticket.md:36`) requires `pg-tunnel-pg-tunnel-1`. `d:\project\pg-tunnel\compose.yml:1,3` sets project `pg-tunnel` and service `pg-tunnel`, with no `container_name`, so Compose names the container `pg-tunnel-pg-tunnel-1`.
- **Failure:** with the tunnel up and no `SIMAP_PG_TUNNEL`, `docker inspect pg-tunnel` fails and `dev:prod` exits 1 with "not found". AC 4 cannot pass. It fails closed, so this is a functional blocker rather than a data exposure. The tests miss it because Docker is injected and no test asserts the default name.
- **Fix:** default to `pg-tunnel-pg-tunnel-1`, update the README, and assert the `docker inspect` argv when `SIMAP_PG_TUNNEL` is unset.

#### 🟡 2. The freshness check and the app can use different token files
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:53-56,85`; `d:\project\simap-game-ui\src\server\http\dev-token.ts:50`.
- **Risk:** `dev:prod` and `dev:token` do not load `.env.local`, but the Next child does.
- **Failure:** `.env.local` sets `SIMAP_DEV_TOKEN_FILE=<old file>`. `dev:prod` checks or refreshes the default file, then the app reads the old one. The app runs on production data with a stale token (401s), or with a still-valid token for another org, so writes land in the wrong org.
- **Fix:** pass the resolved `file` into `childEnv` as `SIMAP_DEV_TOKEN_FILE`. Next does not override a variable already in the environment. Add a test.

#### 🟢 3. The `.env.local` check misses the colon form that Next accepts
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:46`.
- **Failure:** `DATABASE_URL: postgres://...` is not refused, although the `@next/env` parser accepts `KEY: value`. AC 3 is therefore incomplete. The connection is still safe because the child env value wins.
- **Fix:** match `(?:\s*=|:\s)` and add a test case.

#### 🟢 4. PG variable stripping is incomplete
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:16-27,55`.
- **Failure:** `PGOPTIONS` is not removed, and `pg` reads it (`connection-parameters.js:83`), so a leftover `-c search_path=...` applies to production sessions. On Windows, a differently cased key such as `pgoptions` survives in the plain-object copy. Next can also re-add `PG*` values from `.env.local`. Host, port, user, password and database are not affected because the URL sets them.
- **Fix:** delete keys matching `/^PG/i`, and refuse `PG*` assignments in `.env.local` in the same line check.

#### 🟢 5. `NODE_OPTIONS` can still write the password to disk
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:68`, using `d:\project\simap-game-ui\scripts\dev.mjs:36-44`.
- **Failure:** only inspect/debug options are refused. With `NODE_OPTIONS=--report-uncaught-exception`, or another `--report-*` trigger, a Node diagnostic report includes environment variables, so `DATABASE_URL` and its password can reach a JSON file. This requires that option to be set already.
- **Fix:** have `dev:prod` also refuse `report` in the squashed `NODE_OPTIONS`.

### Checked, no finding
- **(a) Guard vs `pg`:** I compared the classifier with `pg-connection-string@2.14.1` and `pg@8.23.1`. Leading-zero ports, `?port=`, `?host=`, `?hostaddr=`, multi-host, `socket:`, default-port schemes, percent-encoded hosts, and `PGPORT` forms parsed by `parseInt` are all refused or cannot reach the tunnel. All five scripts and the Vitest global setup guard before connecting.
- **(b) Secrets and bind:** the password is not in argv, stdout, stderr or error messages, and `dev-prod.mjs` writes no files. Password encoding is sound. The bind is a literal `-H 127.0.0.1` with an allowlisted argv.
- **(c) Image entry:** `db/migrate.js` and `db/migrator.js` do not import the guard, seeder or `target.js`, and the Dockerfile copies what they need. The CI targets are local and compatible with the guard.

**Known limit, already accepted in the plan:** a tunnel on a non-default port is recognized only in a shell where `SIMAP_PROD_TUNNEL_PORT` or `SIMAP_DB_TARGET` is set.

### Follow-ups
- Add `pnpm dev:prod` to the Commands list in `CLAUDE.md`, as already noted in `impl-log.md`.
