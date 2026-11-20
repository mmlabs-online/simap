# SIM-004: Production image and tudocuatui-style deploy

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | architecture, security |
| Gate | plan-approval |
| Depends on | SIM-002 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Package simap as one Docker image that runs the Next.js server and the one-shot `migrate` command, with the
deployment-repo compose file and release workflow modelled on tudocuatui, so Ming can deploy to `simap.mmlabs.online`.

## Scope reference
- `docs/spec-v1.md` §3 Platform (Deploy), §8 Non-functional (Config, Availability: egress to `api.mmlabs.online`).
- `work/decisions.md` D3 (migrate one-shot before replace), D8 (`simap.mmlabs.online`).
- tudocuatui `Dockerfile`, `.dockerignore`, `.github/workflows/release.yml`, `deploy/deployment-repo/**`.

## Scope
- Multi-stage `Dockerfile`: Next.js standalone output + static/public, the migrate entry with `pg` and
  `db/migrations/`, non-root user, `HOSTNAME=0.0.0.0`, `PORT` 3000, healthcheck on readiness.
- `.dockerignore`; `scripts/check-image.sh` style smoke check (image starts, healthz 200, migrate entry present).
- `deploy/deployment-repo/apps/simap/compose.yml` (service `simap` on the tunnel + db networks, `migrate` service on
  the db network only, profile `migrate`, `cap_drop: [ALL]`, `no-new-privileges`, log limits, env file outside the
  checkout) and its deploy workflow + README, as tudocuatui.
- Release workflow that builds and pushes the image and opens the `release/simap-vX.Y.Z` PR in the deployment repo
  (tudocuatui pattern). Pushing `release/*` stays Ming's step (loop.config Guardrails).
- Ming-only steps referenced: M-1, M-2, M-3 in `work/ming-todo.md`.

## Out of scope
- Running the deploy, creating the database, tunnel or Identity app (Ming: M-1..M-3).
- Backups/restore tooling beyond what tudocuatui's compose already documents.

## Acceptance criteria
- [ ] `docker build` produces an image that starts as non-root, answers `/api/healthz` 200 and `/api/readyz` 503
  without a database.
- [ ] `docker run <image> <migrate command>` applies migrations against a local Postgres and exits 0; the app
  container never migrates.
- [ ] The compose file passes `docker compose config` with a dummy env file; no secret value is in the repo.
- [ ] The release workflow builds and tags the image by version and digest, mirroring tudocuatui, and does not deploy
  by itself.
- [ ] `work/ming-todo.md` lists the steps Ming runs for the first deploy.

## Technical notes
- Files: `Dockerfile`, `.dockerignore`, `scripts/check-image.sh`, `.github/workflows/release.yml`,
  `deploy/deployment-repo/**`, `README.md`, `work/ming-todo.md`.
- Risks: Next standalone tracing may miss the migrate entry (ship it separately); JWKS egress needs the tunnel/web
  network.

## Test plan
- Unit: none (infra); any helper script logic gets a small test as tudocuatui `deploy-envfile.test.ts`.
- Manual: build image, run check script, run migrate against local Postgres, `docker compose config`.

## Notes / answers from Ming
—

## Handoff
