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
   password with hidden input; it needs an interactive terminal (PowerShell, Windows Terminal, macOS Terminal; not Git
   Bash). Example: `$env:SIMAP_DEV_EMAIL = "you@example.com"; pnpm dev:token --org <org-uuid>`. Without an org the
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
7. Until the browser dev mode lands (SIM-028.1) the UI still shows the Identity sign-in: test with
   `curl -i http://localhost:3000/api/me`.
8. After `pnpm build`, check that no dev-token code is in the client bundle: `rg -l "dev-token|dev:token|\.config/simap" .next/static`
   must print nothing.

## Production database (dev)

`pnpm dev:prod` runs the local app against the production database through the Cloudflare pg-tunnel (D56). It needs
an interactive terminal and, in order, stops at the first failure with nothing started:

1. A fresh dev token with an `org` claim (runs `pnpm dev:token` when the token is missing, expires within 2
   minutes, has no org, or is for another org than `SIMAP_DEV_ORG`; a token still wrong after that stops the run).
   The banner prints the org id.
2. The tunnel container (`pg-tunnel-pg-tunnel-1`, override `SIMAP_PG_TUNNEL`): started if stopped, then `127.0.0.1:15432` (override
   `SIMAP_PROD_TUNNEL_PORT`) must answer.
3. `.env.local` must not set `DATABASE_URL`: comment that line out while using `dev:prod` and restore it for local
   work. Then it asks for the password of the database role `simap` with hidden input, on every run.
4. It starts `next dev -H 127.0.0.1` (same port option as `pnpm dev`) with a banner. The URL and password live only
   in the app's child environment: never printed, never written to disk. `dev:prod` does not load `.env.local`, so set
   any `SIMAP_*` override in the shell.

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

1. Ming pushes a branch `release/vX.Y.Z` from a commit on `main` (agents never push `release/*`).
2. The `release` workflow tags the commit, builds and pushes `mingming21400/simap:vX.Y.Z`, runs `check-image.sh` on
   the pushed digest and opens `release/simap-vX.Y.Z` on `mmlabs-online/deployment`, changing only
   `apps/simap/release.env` (image pinned by digest). It deploys nothing itself.
3. Ming reviews and merges that PR; `deploy-simap` on the home server backs up the databases, runs the one-shot
   `migrate` service, then replaces the app and waits for `/api/readyz`.
4. Rollback restores the previous image; migrations are forward-only (expand, then contract).

The deployment-repo files are drafts under `deploy/deployment-repo/` (see its README). The one-time steps for Ming
are M-2, M-3 and M-6 to M-8 in `work/ming-todo.md`.

Agent workflow: see `CLAUDE.md`.
