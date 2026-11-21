# simap

mmlabs app (replaces the inactive SeatMGT). Purpose and scope: to be written in `docs/spec-v1.md` (start with `/idea`).

## Local database

1. `docker compose -f compose.dev.yml up -d` (Postgres 17 on `127.0.0.1:5432`, trust auth, no password).
2. Put `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap` in `.env.local` (never commit it).
3. `pnpm migrate` applies `db/migrations/*.sql` (rules: `db/migrations/README.md`); `pnpm migrate:smoke` runs a
   scripted check in a throwaway database.
4. `pnpm test:db` runs the DB integration tests in a throwaway `simap_test_<hex>` database (the role needs
   `create database`; refuses a non-local `DATABASE_URL`). After a killed run, drop an orphan with
   `drop database simap_test_<hex> with (force)`.
5. `pnpm dev`, then `curl -i http://127.0.0.1:3000/api/readyz`: 200 when the database answers, 503 otherwise.

## Local development

Identity cannot register a localhost origin, so the browser never calls it in dev. Instead `pnpm dev:token` signs in
from Node and writes a token outside the repo; under `pnpm dev` the server adds it as the bearer to same-origin
`/api/*` requests (D56).

1. Prerequisites: `.env.local` with `DATABASE_URL` and the Identity issuer/JWKS names the server already reads, and
   the app `simap` registered in org-admin-api (M-1 in `work/ming-todo.md`).
2. `pnpm dev:token --org <org-uuid>` (or `SIMAP_DEV_ORG`). It asks for the email (or `SIMAP_DEV_EMAIL`) and the
   password with hidden input; it needs an interactive terminal (PowerShell, Windows Terminal, macOS Terminal; for a direct
   `pnpm dev:token` not Git Bash, use `scripts/start-dev.sh` there). Example: `$env:SIMAP_DEV_EMAIL = "you@example.com"; pnpm dev:token --org <org-uuid>`. Without an org the
   token is unscoped and every `/api/*` call answers 403 `org_required`.
3. The token goes to `~/.config/simap/dev-token` (override `SIMAP_DEV_TOKEN_FILE`). On Windows the file mode is
   advisory; your profile directory ACL protects it. The script never prints the password or token.
4. `pnpm dev` always runs `next dev -H 127.0.0.1` and accepts only a port (`pnpm dev --port 3001`, `-p 3001` or
   `--port=3001`); any other argument, including `--`, is refused. It also refuses to start when `NODE_OPTIONS`
   mentions `inspect` or `debug` (any spelling, so an unrelated value such as a `debug-hook.js` path is refused too).
   This check is best-effort: `pnpm` and the launcher's own Node process start before it runs and already honour
   `NODE_OPTIONS`, so never put an inspector address in `NODE_OPTIONS` while using a dev token. The file is read on every request: when `/api/*` answers
   401 (one `[dev-token]` warning names the cause), re-run `pnpm dev:token`; no restart. Token lifetime is whatever
   Identity returns (printed by the script).
5. After 3 failed sign-ins Identity asks for Turnstile: sign in once at `https://simap.mmlabs.online`, then retry.
6. `pnpm exec next dev` runs a plain server without a dev token. Use it also for any other `next dev` option (`--inspect`, `--webpack`, HTTPS, another directory). Never put `NEXT_PUBLIC_SIMAP_DEV_TOKEN` in a
   `.env*` file. Requests without `Sec-Fetch-Site` (curl, local processes) count as same-origin, so any local process
   can use the dev identity.
7. With a valid token, `pnpm dev` opens the app signed in at `http://localhost:3000` with an amber "Dev token" badge
   and no sign-out or org switch; app routes never call Identity from the browser. `pnpm dev:prod` shows a red
   "Production data" badge instead (it only labels the session and grants nothing); plain `pnpm dev` never shows it. If
   the token is missing, expired or has no org, the app names the command to run, and "Check again" picks up the new
   token without a restart. The sign-up, password and email-link pages still call Identity and fail under CORS in dev.
8. After `pnpm build`, run `pnpm check:dev-bundle`: it fails if dev-token code, the dev:prod flag or a badge label is in
   the client bundle.

## Production database (dev)

**One command:** `scripts/start-dev.sh` (Git Bash, macOS or Linux; PowerShell users run `pnpm dev:prod`) runs
`pnpm dev:prod` below without any `.env.local`. It asks for the Identity email and password and the database password
(hidden input; under Git Bash it uses `winpty`), and for the org UUID once when no token on disk names an org. Then it
waits up to 30 s for `/api/readyz`, checks that the app we started owns the port, and prints the local URL and
`PRODUCTION DATA: every change is real.` Ctrl-C stops the app and its child processes and leaves the tunnel running.
A hard kill of the launcher (Task Manager, `SIGKILL`) cannot clean up; the next run then refuses the busy port.
A hidden child that holds no port and was never seen by a snapshot can survive a stop; `stop` reports clean only if nothing still listens on the app port.
Before the first run take a `pg_dump` of the `simap` database and keep it outside the repo.

`pnpm dev:prod` runs the local app against the production database through the Cloudflare pg-tunnel (D56). It needs
an interactive terminal. All read-only checks run first, before any sign-in, tunnel start or prompt: the `.env*`
refusals (exit 2: none of the four files may set `DATABASE_URL`, any letter case, so comment that line out while using
`dev:prod` and restore it for local work; none may set `SIMAP_DEV_ORG`, set it in the shell; `pnpm dev` and `dev:prod`
both refuse `NEXT_PUBLIC_SIMAP_DEV_PROD` in any letter case, and `dev:prod` refuses `MM_IDENTITY_ISSUER` in a letter
case other than exactly that; values are never printed), the tools (docker CLI and daemon, `next`, `powershell` on Windows, `lsof` and `ps` elsewhere) and
that the app port is free (the port is always passed explicitly: `--port`, else `PORT`, else 3000). Then, in order, it
stops at the first failure with nothing started:

1. A fresh dev token with an `org` claim (runs `pnpm dev:token` when the token is missing, expires within 2
   minutes, has no org, or is for another org than `SIMAP_DEV_ORG`; a token still wrong after that stops the run).
   The org must be a lowercase UUID. The banner prints it, and the app keeps to that org: `dev:prod` passes it to the
   app as `SIMAP_DEV_EXPECTED_ORG` (set by `dev:prod` only, never by hand).
2. The tunnel container (`pg-tunnel-pg-tunnel-1`, override `SIMAP_PG_TUNNEL`): started if stopped, then `127.0.0.1:15432` (override
   `SIMAP_PROD_TUNNEL_PORT`) must answer.
3. The password of the database role `simap`, asked with hidden input on every run. One login check follows before
   the app starts: a wrong password (`28P01`) or an unreachable database stops the run with a fixed message, no retry.
4. It starts `next dev -H 127.0.0.1` with a banner, waits for `/api/readyz` (a 200 proves the app reached Postgres
   through the tunnel, not the schema version or write access), and stops the whole process tree on a failed check. The URL and password live only
   in the app's child environment: never printed, never written to disk. `dev:prod` pins `MM_IDENTITY_ISSUER=https://api.mmlabs.online` in the child, so a `.env*` or shell value is ignored. `dev:prod` itself skips `.env.local`, but the `next dev` child loads it, so set
   any `SIMAP_*` override in the shell. If you run `pnpm dev:token --org <other org>` while it runs, the next API call
   gets 401 with a `[dev-token]` warning (`another org`): run `pnpm dev:token --org <the org in the banner>` again, no
   restart needed.

Guardrails: `pnpm migrate`, `seed:dev`, `test:db`, `schema:check` and `migrate:smoke` exit 2 on a production target
(port 15432 or `SIMAP_PROD_TUNNEL_PORT`, `?port=`, `PGPORT`, or `SIMAP_DB_TARGET` other than empty/`local`/`dev`);
`pnpm migrate` and `migrate:smoke` also refuse any non-local host. `node db/migrate.js` is the production image
entry and is deliberately unguarded: never run it from a laptop.

Deployed to the mmlabs home server through `mmlabs-online/deployment` like the other mmlabs apps: see
[Release and deploy](#release-and-deploy).

## Production image

`Dockerfile` builds the Next.js standalone server (non-root, port 3000, healthcheck on `/api/healthz`) and also
carries the migrate entry: `docker run --rm -e DATABASE_URL=... <image> node db/migrate.js`. The app container never
migrates. The build needs network access (`next/font/google`). Config is read only from the environment at run time
(`DATABASE_URL`, `PORT`); nothing is baked into the image.

```
docker build -t simap:local .
bash scripts/check-image.sh simap:local     # add CHECK_IMAGE_DATABASE_URL=postgres://... for the db smoke
```

CI runs the same check (job `image`) on every pull request.

## Release and deploy

1. Ming pushes a branch `release/X.Y.Z` (no `v`, e.g. `release/0.1.0`) from a commit on `main` (agents never push `release/*`).
2. The `release` workflow tags the commit, builds and pushes `mingming21400/simap:vX.Y.Z`, runs `check-image.sh` on
   the pushed digest and opens `release/simap-vX.Y.Z` on `mmlabs-online/deployment`, changing only
   `apps/simap/release.env` (image pinned by digest). It deploys nothing itself.
3. Ming reviews and merges that PR; `deploy-simap` on the home server backs up the databases, runs the one-shot
   `migrate` service, then replaces the app and waits for `/api/readyz`.
4. Rollback restores the previous image; migrations are forward-only (expand, then contract).

The deployment-repo files are drafts under `deploy/deployment-repo/` (see its README). The one-time steps for Ming
are M-2, M-3 and M-6 to M-8 in `work/ming-todo.md`.

Agent workflow: see `CLAUDE.md`.
