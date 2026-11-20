# simap

mmlabs app (replaces the inactive SeatMGT). Purpose and scope: to be written in `docs/spec-v1.md` (start with `/idea`).

## Local database

1. `docker compose -f compose.dev.yml up -d` (Postgres 17 on `127.0.0.1:5432`, trust auth, no password).
2. Put `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap` in `.env.local` (never commit it).
3. `pnpm migrate` applies `db/migrations/*.sql` (rules: `db/migrations/README.md`); `pnpm migrate:smoke` runs a
   scripted check in a throwaway database.
4. `pnpm dev`, then `curl -i localhost:3000/api/readyz`: 200 when the database answers, 503 otherwise.

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
