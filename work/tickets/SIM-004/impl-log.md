## Attempt 1 — 2026-11-20

### Files touched
| File | Required because |
|---|---|
| `Dockerfile` | Multi-stage standalone image, migrate entry, non-root, healthcheck (AC1, AC2) |
| `.dockerignore` | Small context, no `.env*`/tests/docs in the image (R3) |
| `public/.gitkeep` | `COPY --from=build /app/public` must always work |
| `scripts/check-image.sh` | Image smoke for CI and release (AC1, AC2) |
| `.github/workflows/ci.yml` | New job `image` (build, check-image with DB smoke, compose config) (AC1-3) |
| `.github/workflows/release.yml` | Build, push, verify digest, open deployment PR (AC4) |
| `deploy/deployment-repo/apps/simap/compose.yml` | `simap` + one-shot `migrate` (AC3) |
| `deploy/deployment-repo/.github/workflows/deploy-simap.yml` | Deploy job draft for the deployment repo |
| `deploy/deployment-repo/README.md` | What goes where in the deployment repo |
| `scripts/deploy-envfile.test.ts` | Real `envfile` run block + static checks of `deploy-simap.yml` |
| `scripts/release-files.test.ts` | Static checks of `compose.yml` and `release.yml` |
| `README.md` | "Production image" and "Release and deploy" sections |
| `work/ming-todo.md` | AC5: new items M-6, M-7, M-8; M-2 extended with `http://simap:3000` |

### Tests added / changed
- `scripts/deploy-envfile.test.ts › envfile step (real run block)`: writes only DATABASE_URL (mode 600, changed flips); malformed/missing password file; ENV_FILE outside $HOME
- `scripts/deploy-envfile.test.ts › deploy-simap.yml static checks`: main-only job, no `secrets.*`, no `${{` in run blocks, image pattern and service names, migrate before deploy, force-recreate rule
- `scripts/release-files.test.ts › compose.yml`: name/image/env_file, hardening, networks, healthcheck, only `migrate` has a command, no ports, no `postgres://`
- `scripts/release-files.test.ts › release.yml`: trigger, platform/attestations, check-image on digest before the PR step, `release.env` content, no `${{` in run blocks, no self-hosted/compose/ssh

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0; `pnpm check:layers`: "13 files, no violations"
- format:check: `pnpm format:check` exit 0
- test: "Test Files 8 passed (8) / Tests 58 passed | 3 skipped (61)". The 3 skipped are the `envfile (real run block)` tests: they skip on win32 (as in tudocuatui) and run in CI on ubuntu. I tried them under Git Bash on Windows; `install -d -m 700` fails there with a permission error, so this device cannot confirm them. The block is tudocuatui's tested one with the Drive/AI_KEK parts removed.
- build: `pnpm build` exit 0; `.next/standalone/server.js` present
- Local pre-checks (plan step 8): in `.next/standalone`, `await import('pg')` resolves ("pg ok"). With `.next/static` and `public` copied in, `node .next/standalone/server.js` answered `/api/healthz` 200, `/api/readyz` 503 (no DATABASE_URL), `/` 200. So `server.js` runs with `"type": "module"` and option A (traced `pg`) works on Windows linking.
- Docker: no Docker on this device. NOT RUN locally: `docker build`, `scripts/check-image.sh` (all sections incl. non-root, layout, smoke, db smoke, `node db/migrate.js`), `docker compose config`. Verified only in CI job `image` on the PR; the reviewer reads that log. `bash -n scripts/check-image.sh` passes.
- `pg` for migrate: shipped option A (traced standalone `pg`); no fallback to option B was needed locally. CI confirms (check-image imports `pg` from `/app/db`); if it fails there, switch to option B per the plan.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Debt issues listed in the plan (orchestrator files them): security headers/CSP, self-host the font, public `/api/readyz` rate limit, Docker action SHA pinning.
- `work/ming-todo.md` numbers M-6..M-8 were picked on the current branch; renumber if the batch adds items on `main` before merge.
- `scripts/deploy-envfile.test.ts` needs `NODE_ENV` in the spawn env only to satisfy Next's `ProcessEnv` typing; harmless.

### Scope self-check
- Could the diff be smaller? No: about 600 lines are ports of reviewed tudocuatui files, as the plan expected.
- Diff size: see `git diff --stat main...HEAD` (new files mostly).
