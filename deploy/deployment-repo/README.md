# Drafts for mmlabs-online/deployment

These files mirror their target paths in the deployment repo. Copy them verbatim into **one** setup PR on
`mmlabs-online/deployment` (a branch that does not start with `release/`, so `pr-scope` does not restrict it).

| Here | Goes to |
|---|---|
| `.github/workflows/deploy-simap.yml` | `.github/workflows/deploy-simap.yml` |
| `apps/simap/compose.yml` | `apps/simap/compose.yml` |

Postgres first: on the same branch, run `bash postgres/scripts/add-app-db.sh simap` and commit its two outputs
(M-3 in simap `work/ming-todo.md`).

Also add this line to the deployment repo's `.github/CODEOWNERS`:

```
/apps/simap/  @didi-code0980
```

`apps/simap/release.env` is not drafted: the simap release workflow writes it
(`SIMAP_IMAGE=mingming21400/simap:vX.Y.Z@sha256:<digest>` and `SIMAP_VERSION=vX.Y.Z`) in a
`release/simap-vX.Y.Z` pull request that changes only that file, which is what `pr-scope` allows. Until it
exists, deploy-simap skips, so merging the setup PR deploys nothing.

No hostname or ingress rule belongs in either repo: cloudflared is remotely managed (Cloudflare dashboard). The
published application `simap.mmlabs.online` must point to the service **`http://simap:3000`** (HTTP, not
HTTPS). `DATABASE_URL` exists only in the host env file (`/Users/mingming/.config/simap/simap.env`), written by
the deploy from the deployment repo's `postgres/secrets/apps/simap.password`; it is never in the simap repo or
the image. After a password rotation, run `deploy-simap` with `workflow_dispatch` from `main` to rewrite it.

Google Drive (device-type images, D61): deploy-simap also writes `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REFRESH_TOKEN` and `DRIVE_FOLDER_ID` to the same host env file, from the deployment repository secrets
`SIMAP_GOOGLE_CLIENT_ID`, `SIMAP_GOOGLE_CLIENT_SECRET`, `SIMAP_GOOGLE_REFRESH_TOKEN` and `SIMAP_DRIVE_FOLDER_ID`.
They are all-or-none: none set means images off; all four set means images on; one to three set (or a malformed
value) fails the run and the old env file stays. Values are never printed. After adding, changing or removing any of
them, run `deploy-simap` with `workflow_dispatch` from `main`: a manual run rewrites the env file and recreates the
container.

Migrations must be expand-then-contract: a rollback restores the previous image but never un-migrates. Never run
`docker compose down -v` or remove volumes: all data is in the shared `pgdata`.

Rollback: if the new container fails its health check, deploy-simap restores the previous release. If deployment
`main` is protected and `github-actions` cannot bypass it, the revert cannot be pushed (`restore-unpushed`): the
server is back on the old release, so revert the release PR by hand. A deliberate rollback later is a
non-`release/` PR that reverts `apps/simap/release.env`; migrations stay.
