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

## Attempt 2

Verdict: REWORK

Static review only: I had no command runner, so no tests, scripts or live tunnel were executed. I did not read any `.env*` file.

### Attempt 1 findings

| # | Status | Evidence |
|---|---|---|
| 1. Tunnel container default | Fixed | `d:\project\simap-game-ui\scripts\dev-prod.mjs:71` defaults to `pg-tunnel-pg-tunnel-1`. `d:\project\simap-game-ui\scripts\dev-prod.test.ts:164-172` asserts the `docker inspect` argv for the default and the override. I did not re-check the README line. |
| 2. Token file mismatch | Fixed | `dev-prod.mjs:60,148` passes the resolved file to the child, and `d:\project\simap-game-ui\src\server\http\dev-token.ts:22,50` reads that variable. Test at `dev-prod.test.ts:225-230`. |
| 3. `.env.local` colon form | Fixed | `dev-prod.mjs:46` matches `KEY: value` and a bare `KEY:`. Tests at `dev-prod.test.ts:84-86,94`. |
| 5. `NODE_OPTIONS` report options | Fixed as written | `dev-prod.mjs:75-82` refuses `report` in any spelling, before any Docker call or prompt. A sibling route remains, see finding 2 below. |

### New findings

#### 🟡 1. A still-valid token for the wrong org passes the check, so production writes can land in the wrong org
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:30-36,99`.
- **Risk:** `tokenIsFresh` checks only `exp`. `SIMAP_DEV_ORG` is read only by `dev:token` (`d:\project\simap-game-ui\scripts\dev-token.mjs:33`), and that script runs only when the token is stale. `plan.md:135` names `SIMAP_DEV_ORG` as the org source for a refresh, but a token that is still fresh never reaches that step.
- **Failure:** Ming runs `pnpm dev:token --org A`, then later in the token's lifetime (up to 24 h) runs `$env:SIMAP_DEV_ORG = "B"; pnpm dev:prod`. The file holds a fresh org A token, so no refresh happens. The banner names no org, the app serves org A, and edits meant for B change A's real data. Ming must be a member of A, so this is not a tenant bypass, but it is a wrong-tenant production write with no warning.
- **Related case:** a fresh token with no `org` claim also passes. That one fails closed, with API calls answering 403 `org_required`.
- **Fix:**
  1. When `SIMAP_DEV_ORG` is set, treat a token whose `org` claim differs (case-insensitive) as not fresh, so `dev:token` runs.
  2. Re-check the org after the refresh and exit 1 on a mismatch.
  3. Treat a missing `org` claim as not fresh.
  4. Print the active org id in the production banner, which covers the case where `SIMAP_DEV_ORG` is unset.
  5. Add tests for mismatch then refresh, mismatch after refresh, and no org claim.

#### 🟢 2. Heap snapshot options can still write the DB password to disk
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:75-82`.
- **Risk:** this is the same class as Attempt 1 finding 5. The filter blocks `inspect`, `debug` and `report`, but not `--heapsnapshot-near-heap-limit` or `--heapsnapshot-signal`. Next forwards parsed `NODE_OPTIONS` to the server child (`d:\project\simap-game-ui\node_modules\next\dist\cli\next-dev.js:363,391,416`), and that process holds `DATABASE_URL` in memory.
- **Failure:** with `NODE_OPTIONS=--heapsnapshot-near-heap-limit=1` already set, a dev server nearing its heap limit writes a `.heapsnapshot` containing the URL and password. By default Node writes it to the working directory, which is the repo root here, and `.gitignore` has no heap pattern, so `git add .` could commit it. This needs the option to be set beforehand.
- **Fix:** also refuse `heapsnapshot` in the squashed `NODE_OPTIONS`, and add it to the test list at `dev-prod.test.ts:175-182`.

### Checked, no finding
- **Production reach:** `pnpm migrate` and `migrate:smoke` guard before connecting. With `DATABASE_URL` unset, `db/migrate.js:30-32` exits 2 and does not fall back to `PG*`. `SIMAP_DB_TARGET=local` cannot override the port check (`db/target.js:28-46`).
- **Password and URL:** the prompt comes after the token and tunnel steps, and Docker and `dev:token` never receive the password. It is not in argv. The catch at `dev-prod.mjs:150-152` prints a fixed message, the pool logs only `err.code` (`src/server/db/pool.ts:28`), and `next.config.*` does not reference `DATABASE_URL` or `process.env`.
- **Bind:** `nextDevArgs` accepts only a validated port and always emits `-H 127.0.0.1` (`scripts/dev.mjs:19-33`).
- **Container name:** `CONTAINER_RE` blocks option injection through `SIMAP_PG_TUNNEL`.

Not reported, as instructed: `PG*` stripping (finding 4) and hand-run `node db/migrate.js`.

## Attempt 3

Verdict: PASS

The Attempt 2 finding is fixed at the point it was reported: a fresh token for another org no longer gets past the startup check when `SIMAP_DEV_ORG` is in the shell. Two 🟡 gaps can still put the app on the wrong org's production data. Neither crosses a tenant boundary, because the token is always a verified one for an org the user belongs to. I rated them 🟡, the same as the original finding, so no 🔴.

This was a static review. I ran no tests, scripts or tunnel, and I did not read any `.env*` file or the real token file.

### Findings

#### 🟡 1. Replacing the token file after the check switches the running production app to another org
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:114-119` checks the org once and `:170-174` starts the app. `d:\project\simap-game-ui\src\server\http\dev-token.ts:25-26,50` re-reads the file on every request, uncached. `d:\project\simap-game-ui\scripts\dev-token.mjs:201` overwrites the same default file.
- **Failure:** Ming runs `dev:prod` for org A and the banner says org A. In a second terminal, for local work, Ming runs `pnpm dev:token --org B`. The next `/api/*` request from the `dev:prod` app carries the org B token, so edits change B's real production data while the banner still says A. No restart or warning occurs. The same happens if the file is replaced during the password prompt (`dev-prod.mjs:163`).
- **Fix:**
  1. In `childEnv`, pass the checked org as a new variable, for example `SIMAP_DEV_EXPECTED_ORG: tokenOrg(token)`. Next does not override a variable already in the process environment, so `.env*` cannot change it.
  2. In the server's dev-token path, when that variable is set, send no token if the file's `org` differs (case-insensitive), and warn with a new `wrong_org` reason in `d:\project\simap-game-ui\src\lib\dev-token\token.ts`.
  3. Same-org refreshes keep working with no restart.
  4. Add tests for a same-org swap (accepted) and an other-org swap (refused).

#### 🟡 2. `SIMAP_DEV_ORG` set only in a `.env*` file is silently ignored
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:113` reads only the shell environment, and `:156-162` inspects `.env.local` only for `DATABASE_URL`.
- **Failure:** `.env.local` has `SIMAP_DEV_ORG=B` and the token file holds a fresh org A token. `wantOrg` is null, so the check passes and the app runs on A's production data. Nothing in `src/` reads `SIMAP_DEV_ORG`, so the Next child does not catch it either. The banner shows A's UUID, but nothing flags the mismatch. `README.md:59-60` says to set overrides in the shell, which documents the limit but does not enforce it.
- **Fix:** at step 3, before the password prompt, refuse with exit 2 when `.env.local` sets `SIMAP_DEV_ORG`, reusing the `envFileSetsDatabaseUrl` matcher with the key as a parameter. Preferably cover the other files Next loads in dev too (`.env.development.local`, `.env.development`, `.env`). Never print the value.

#### 🟢 3. A malformed `org` claim passes the startup check
- **Where:** `d:\project\simap-game-ui\scripts\dev-prod.mjs:39-42` accepts any non-empty string, including `" "`, when `SIMAP_DEV_ORG` is unset.
- **Failure:** the user is asked for the DB password and the app starts, but every API call fails with `org_invalid` (`d:\project\simap-game-ui\src\server\identity\verify.ts:147`), so no data is reachable. The unverified claim is also printed raw in the banner at `dev-prod.mjs:170`, so a tampered file could inject terminal control characters.
- **Fix:** have `tokenOrg` accept only a UUID, matching the verifier.

### Checked, no finding
- **Differing token files:** the script, the `dev:token` child and the app all resolve to the same file. The resolved path is passed to the child (`dev-prod.mjs:74`), and Next keeps existing process variables over `.env*` values, so `.env.local` cannot redirect it.
- **Non-string, missing or padded `org` claims:** non-string and missing claims are treated as not fresh. A padded claim fails the comparison when `SIMAP_DEV_ORG` is set, and otherwise fails at the verifier.
- **Whitespace in `SIMAP_DEV_ORG`:** `dev-prod` trims it but `dev-token.mjs:33-34` does not. If a refresh is needed, `dev:token` rejects the value and the run stops, so this fails closed.
- **Forged payload:** it can pass the unverified startup check, but the server's ES256 verification rejects it.
- **Token or password exposure:** the banner prints only the org claim. The token is not in argv or the child environment. The password is collected after `dev:token` has finished, so that child never receives it, and the catch at `dev-prod.mjs:175-177` prints a fixed message.
- **Step order:** still token, tunnel, `.env.local` check, password, app. A wrong org after refresh exits before any Docker call or prompt, and `dev-prod.test.ts:167-172` covers it.

### Follow-ups
Findings 1 and 2 can ship as a follow-up ticket if Ming accepts the risk for this PR. Until then, avoid running `dev:token` for another org while `dev:prod` is open.
