Status: READY

# Plan — SIM-004: Production image and tudocuatui-style deploy

## Scope summary
- `docs/spec-v1.md` §3 Platform: "**Deploy (D8):** as tudocuatui. A Docker image runs on the home server behind a
  Cloudflare Tunnel at `simap.mmlabs.online`. A one-shot `migrate` container runs before the app container is replaced;
  the app never migrates."
- `docs/spec-v1.md` §8: "**Config:** from environment variables only. Names go in `.env.example` with no values (R3). The
  `DATABASE_URL` secret comes from the deployment repo's env file, never from the image." and "**Availability:** … The
  app needs outbound network access to `api.mmlabs.online` (JWKS)."
- `work/decisions.md` D3: "Migrations run like tudocuatui: plain SQL, forward-only, checksummed, expand/contract,
  one-shot `migrate` container; no down files." D8: "Production host `simap.mmlabs.online`".
- Ticket scope: multi-stage `Dockerfile` (standalone + static/public, migrate entry with `pg` and `db/migrations/`,
  non-root, `HOSTNAME=0.0.0.0`, `PORT` 3000, healthcheck), `.dockerignore`, `scripts/check-image.sh`,
  `deploy/deployment-repo/apps/simap/compose.yml` + deploy workflow + README, release workflow that opens the
  `release/simap-vX.Y.Z` PR; "Pushing `release/*` stays Ming's step".
- `.claude/loop.config.md` Guardrails: "never touch … the deployment repo by hand", "never push `release/*`".

Out of scope (ticket): running the deploy, creating DB/tunnel/Identity app (M-1..M-3), backup tooling beyond
tudocuatui's. Also out: `next.config.ts` headers/CSP, `.env.example` edits, any app code.

## Acceptance criteria → verification
No Docker on the dev device: AC1–AC3 are verified by the new CI `image` job on the PR (the reviewer reads the job
log and confirms it is green); the implementer can only run the local pre-checks listed under Approach step 8.

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | `docker build` produces an image that starts as non-root, answers `/api/healthz` 200 and `/api/readyz` 503 without a database. | CI job `image` → step `check-image` (`bash scripts/check-image.sh simap:ci-local`) green. Its sections "no secrets in image" (User not root/0), "image config", "layout" and "smoke" (`--network none`, `--cap-drop ALL`, `no-new-privileges`, no `DATABASE_URL`): `/api/healthz` 200, `/api/readyz` 503, `/` 200 plus one hashed `/_next/static/…` asset 200, image `HEALTHCHECK` reaches `healthy`. Reviewer also reads `Dockerfile` for `USER node` and no `ENV` other than `NODE_ENV`/`HOSTNAME`/`PORT`. |
| 2 | `docker run <image> node db/migrate.js` applies migrations against a local Postgres and exits 0; the app container never migrates. | Same CI step with `CHECK_IMAGE_DATABASE_URL` (service Postgres), section "db smoke": app container started first on the fresh DB reaches `/api/readyz` 200 and `schema_migrations` still does not exist (app never migrates); then `node db/migrate.js` exits 0, the row count of `schema_migrations` equals the number of `db/migrations/*.sql` in the checkout, a second run prints `up to date`. "start checks": `node db/migrate.js` without `DATABASE_URL` exits 2. "image config": `Cmd` is exactly `["node","server.js"]`. Compose: only the `migrate` service has `command: ["node","db/migrate.js"]` (Vitest `scripts/release-files.test.ts`). |
| 3 | The compose file passes `docker compose config` with a dummy env file; no secret value is in the repo. | CI job `image` → step `compose config` green (dummy `release.env` + dummy host env file, `--profile migrate config --quiet`; also asserts the run fails without `--env-file`). Vitest `scripts/release-files.test.ts › compose.yml` (no `postgres://`, no `ports:`, env file outside the checkout). gitleaks pre-commit hook passes. |
| 4 | The release workflow builds and tags the image by version and digest, mirroring tudocuatui, and does not deploy by itself. | Vitest `scripts/release-files.test.ts › release.yml` (trigger only `release/v*`; version guard; push `mingming21400/simap:vX.Y.Z`; `check-image.sh` on `@$DIGEST` before the PR step; `release.env` pins `SIMAP_IMAGE=…:vX.Y.Z@sha256:…`; no self-hosted runner, no `docker compose`, no `ssh`). Reviewer diffs `.github/workflows/release.yml` against tudocuatui `release.yml` (differences only: names, no `VITE_APP_VERSION` build arg, PR body). The real run is Ming's (see below). |
| 5 | `work/ming-todo.md` lists the steps Ming runs for the first deploy. | Reviewer reads `work/ming-todo.md`: new items (Docker Hub repo + 3 repository secrets; deployment-repo setup PR with workflow, compose, CODEOWNERS; Cloudflare target `http://simap:3000`; first `release/vX.Y.Z` push and deployment PR merge), each naming secrets by name only; README "Release and deploy" links them. |

## Ming verification after merge
- First `release/v0.1.0` push (after the new Docker Hub/secret items are done): the `release` run is green, pushes
  `mingming21400/simap:v0.1.0`, passes `check-image.sh` on the pushed digest and opens `release/simap-v0.1.0` on
  `mmlabs-online/deployment` changing only `apps/simap/release.env`.
- Merging that PR runs `deploy-simap` on `macbook-runner`: backup, `migrate`, app healthy on `/api/readyz`.
- With M-2 done: `https://simap.mmlabs.online/api/healthz` 200 and `/api/readyz` 200 through the tunnel; JWKS egress is
  checked only once SIM-005/SIM-006 exist (any `/api` call with a real token).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `Dockerfile` | create | Multi-stage image (build → runtime), migrate entry, non-root, healthcheck | **High** |
| `.dockerignore` | create | Small context; no `.env*`, tests, work/docs in the image (R3) | **High** |
| `public/.gitkeep` | create (empty) | `public/` does not exist; the Dockerfile `COPY public` must always work (consult §1) | no |
| `scripts/check-image.sh` | create | Image smoke used by CI and release (AC1–2) | no |
| `.github/workflows/ci.yml` | modify: add job `image` after `ci` | Builds and checks the image on every PR; compose config (AC1–3) | no (Medium) |
| `.github/workflows/release.yml` | create | Build, push, verify digest, open deployment PR (AC4) | **High** |
| `deploy/deployment-repo/apps/simap/compose.yml` | create | Service `simap` + one-shot `migrate` (AC3) | **High** |
| `deploy/deployment-repo/.github/workflows/deploy-simap.yml` | create | Deploy job for the deployment repo (copied by Ming) | **High** |
| `deploy/deployment-repo/README.md` | create | What goes where in the deployment repo, when | **High** |
| `scripts/deploy-envfile.test.ts` | create | Runs the real `envfile` run block + static checks of `deploy-simap.yml` | no (Low) |
| `scripts/release-files.test.ts` | create | Static checks of `compose.yml` and `release.yml` (AC2–4) | no (Low) |
| `README.md` | modify: add "Production image" and "Release and deploy" sections | How to build/check locally and the release runbook | no |
| `work/ming-todo.md` | modify: add new items; extend M-2 with the service URL | AC5 | no (Low) |

Not touched: `.env.example` (already holds `PORT=` and `DATABASE_URL=`, orchestrator note; `HOSTNAME` is a fixed image
value, not config; `MM_IDENTITY_ISSUER` is SIM-005's), `next.config.ts`, `src/**`, `db/**`, `.github/risk-tiers.yml`.

## Data model / migration
None. (The image copies `db/migrate.js`, `db/migrator.js`, `db/migrations/` unchanged; `db/seed-dev.*` from SIM-008, if
any, is not copied.)

## API contract
None (uses the existing `/api/healthz` and `/api/readyz` from SIM-001/SIM-002).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `scripts/deploy-envfile.test.ts › envfile step (real run block) › writes only DATABASE_URL=postgres://simap:<pw>@postgres:5432/simap, mode 600, changed=true then false` | AC3 (env file outside checkout, secret only in host file) |
| `… › malformed or missing password file: exit 1, old file unchanged, no temp file left, password not printed` | same, fail-closed |
| `… › ENV_FILE outside $HOME: exit 1, nothing written` | same |
| `scripts/deploy-envfile.test.ts › deploy-simap.yml static › job runs only on main, no environment key, no secrets.* reference, no ${{ inside any run block` | injection / secret hygiene |
| `… › image pattern is ^mingming21400/simap:vX.Y.Z@sha256:<64 hex>$; deploy and rollback target service simap; migrate runs before deploy` | AC2 ordering, AC4 pinning |
| `scripts/release-files.test.ts › compose.yml › name simap; image from ${SIMAP_IMAGE:?…}; env_file /Users/mingming/.config/simap/simap.env` | AC3 |
| `… › compose.yml › both services cap_drop [ALL] + no-new-privileges + json-file limits; simap on [tunnel, db] with healthcheck /api/readyz; migrate on [db] only, profiles [migrate], command ["node","db/migrate.js"]; simap has no command; no ports:, no postgres:// ` | AC2, AC3 |
| `scripts/release-files.test.ts › release.yml › on push branches ["release/v*"] only; platforms linux/amd64; provenance/sbom false; check-image.sh on $NAMESPACE/simap@$DIGEST precedes the deployment PR step; release.env writes SIMAP_IMAGE and SIMAP_VERSION only; no ${{ inside run blocks; no self-hosted runner / docker compose / ssh` | AC4 |

The `envfile` tests need bash and skip on win32 (as tudocuatui); they run in CI (`pnpm test` on ubuntu). Parsing is
line/regex based like tudocuatui's test (no YAML dependency added, D2).

Scripted checks (CI only): `scripts/check-image.sh` sections, see Approach step 3.

## Approach
1. **`public/.gitkeep`** (empty).
2. **`Dockerfile`** — model: tudocuatui `Dockerfile` lines 7–45, adapted to Next standalone:
   - Stage `build` (`node:22-bookworm-slim`, **no** `--platform=$BUILDPLATFORM`: the standalone trace copies native
     optional deps such as `sharp`/`@img/*` of the build platform, so build on the target platform; CI and release
     build `linux/amd64` on amd64 runners, so it costs nothing): `corepack enable`; `COPY package.json
     pnpm-lock.yaml ./`; `pnpm install --frozen-lockfile` with the pnpm store cache mount (tudocuatui line 11);
     `COPY . .`; `RUN NEXT_TELEMETRY_DISABLED=1 pnpm build` (inline, never `ENV`). No build args.
     `next/font/google` (SIM-003) fetches fonts during this step: the build needs network (default, Q5).
   - Runtime stage `node:22-bookworm-slim`, `WORKDIR /app`, `ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000`;
     files root-owned: `COPY --from=build /app/.next/standalone ./`, `COPY --from=build /app/.next/static
     ./.next/static`, `COPY --from=build /app/public ./public`, `COPY db/migrate.js db/migrator.js ./db/`,
     `COPY db/migrations ./db/migrations`; `RUN mkdir -p .next/cache && chown node:node .next/cache` (only writable
     path, for Next's runtime cache; Q6); `USER node`; `EXPOSE 3000`; liveness `HEALTHCHECK` = tudocuatui line 43–44
     with `/api/healthz`; `CMD ["node","server.js"]`. Header comment: config only from outside (`DATABASE_URL` from the
     host env file, `MM_IDENTITY_ISSUER` from compose once SIM-005 uses it); the app never migrates.
   - `pg` for migrate: option A (traced standalone `pg` at `/app/node_modules/pg`), proven by check-image. If the CI
     check fails with a resolution error, switch to option B without asking: extra stage `migrate-deps` running
     `pnpm install --prod --frozen-lockfile --ignore-scripts --config.node-linker=hoisted`, copied to
     `/app/db/node_modules` (Node resolves it from `db/migrate.js` first). Record which option shipped in impl-log.
3. **`scripts/check-image.sh`** — port tudocuatui `scripts/check-image.sh`, keeping its structure
   (`set -uo pipefail`, trap cleanup, `expect_exit`, `probe`/`status`), and:
   - Keep: secret-like env names (lines 26–30), non-root user (37–38), no `.env*` anywhere (39–40), no `*.map` under
     `/app/.next/static`, exposed `3000/tcp`.
   - Image config: `Cmd` exactly `["node","server.js"]`; among env names matching
     `^(NODE_ENV|HOSTNAME|PORT|DATABASE_URL|MM_IDENTITY_|SIMAP_|NEXT_)` exactly `NODE_ENV=production`,
     `HOSTNAME=0.0.0.0`, `PORT=3000`; `docker history --no-trunc` contains no `NEXT_TELEMETRY` `ENV` and no
     `DATABASE_URL`.
   - Layout: `/app/server.js`, `/app/package.json` with `"type": "module"`, `/app/.next/static` non-empty,
     `/app/public` dir, `/app/db/migrate.js` + `/app/db/migrator.js`; the set of `*.sql` names in `/app/db/migrations`
     equals the checkout's `db/migrations/*.sql` (zero is allowed until SIM-008 merges); `cd /app/db && node
     --input-type=module -e "await import('pg')"` succeeds (resolution as migrate sees it, consult risk 1); no
     `/app/src`, no `*.test.*` under `/app` outside `node_modules`.
   - Start checks (`--network none`, 30 s cap): `node db/migrate.js` without `DATABASE_URL` exits 2.
   - Smoke: `docker run -d --cap-drop ALL --security-opt no-new-privileges --network none -e
     MM_IDENTITY_ISSUER=https://api.mmlabs.online` (not secret; harmless now, keeps the smoke valid once SIM-005 reads
     it); wait up to 30 s for `/api/healthz` 200; `/api/readyz` 503; `/` 200 and extract the first
     `/_next/static/…\.(js|css)` URL from its body, which must be 200; `/_next/static/does-not-exist.js` 404;
     `HEALTHCHECK` reaches `healthy`.
   - DB smoke when `CHECK_IMAGE_DATABASE_URL` is set (never printed; `docker logs` filtered as tudocuatui line 178):
     start the app (`--network host`) first; `/api/readyz` 200; with a small `node -e` from `/app` (image's `pg`) assert
     `to_regclass('schema_migrations')` is null when it was null before the app started (otherwise print a notice and
     skip that assertion); then `node db/migrate.js` exits 0; `count(*)` of `schema_migrations` = number of checkout
     `*.sql`; second run output contains `up to date`.
   - Drop tudocuatui-specific checks (version.txt, SPA fallback, Supabase, Google, `TUDO_*`, `/api/items`).
4. **`.dockerignore`** — tudocuatui list plus Next items: `node_modules`, `.next`, `coverage`, `.git`, `.github`,
   `.claude`, `work`, `docs`, `deploy`, `scripts`, `src/test`, `**/*.test.ts`, `**/*.test.tsx`, `.env*`, `**/.env*`,
   `*.log`, `*.tsbuildinfo`, `next-env.d.ts`, `compose.dev.yml`. Must not exclude `public`, `db`, `src`.
5. **`.github/workflows/ci.yml`** — add job `image` (`needs: ci`, ubuntu-latest, postgres:17 service as the `ci` job),
   modelled on tudocuatui `ci.yml` lines 53–89 with one build: `docker/setup-buildx-action@v3`,
   `docker/build-push-action@v6` (`load: true`, `push: false`, `tags: simap:ci-local`, gha cache scope `image`);
   step `check-image`: `bash scripts/check-image.sh simap:ci-local` with
   `CHECK_IMAGE_DATABASE_URL: postgres://postgres:postgres@127.0.0.1:5432/postgres`; step `compose config`: write a
   dummy `$RUNNER_TEMP/release.env` (`SIMAP_IMAGE=mingming21400/simap:v0.0.0@sha256:` + 64 zeros), `sudo install -d`
   `/Users/mingming/.config/simap` with a dummy `simap.env` (`DATABASE_URL=postgres://ci:ci@postgres:5432/simap`), run
   `docker compose -p simap -f deploy/deployment-repo/apps/simap/compose.yml --env-file … --profile migrate config
   --quiet`, and assert the same command without `--env-file` fails. No registry login, never pushes.
6. **Deployment-repo drafts** (`deploy/deployment-repo/**`):
   - `apps/simap/compose.yml` — tudocuatui `compose.yml` with: `name: simap`; `x-app` image
     `${SIMAP_IMAGE:?SIMAP_IMAGE is unset - pass --env-file apps/simap/release.env}`, `env_file:
     /Users/mingming/.config/simap/simap.env`; service `simap` (`restart: unless-stopped`, `environment: NODE_ENV:
     production, MM_IDENTITY_ISSUER: https://api.mmlabs.online`, cap_drop/no-new-privileges/json-file 10m×3,
     healthcheck on `http://127.0.0.1:3000/api/readyz` with `start_period: 20s`, `networks: [tunnel, db]`); service
     `migrate` (`restart: "no"`, `profiles: [migrate]`, same hardening, `command: ["node","db/migrate.js"]`,
     `networks: [db]`); external networks `web` (as `tunnel`) and `db`. No `x-owner-sub`, no `TUDO_*`, no volumes, no
     ports. Header comment adapted (Cloudflare target `http://simap:3000`, JWKS egress via `web`, env file written by
     `deploy-simap`).
   - `.github/workflows/deploy-simap.yml` — tudocuatui `deploy-tudocuatui.yml` with names/paths changed (`APP_DIR:
     apps/simap`, `PROJECT: simap`, `DB_APP: simap`, `ENV_FILE: /Users/mingming/.config/simap/simap.env`, image var
     `SIMAP_IMAGE`, pattern `^mingming21400/simap:v…@sha256:[0-9a-f]{64}$`, service `simap`); `envfile` step writes
     only `DATABASE_URL` (drop the Drive and AI_KEK blocks, lines 94–99, 109–137, 143–147; no `secrets.*`); drop the
     "no migrate service" guard (simap always has `migrate`: backup and migrate always run); keep release, pull,
     backup, migrate, deploy (`--force-recreate` rule), rollback, notify.
   - `README.md` — tudocuatui deployment README lines 1–38 and 59–64 adapted: one setup PR (non-`release/` branch) with
     `add-app-db.sh simap` outputs (M-3), `deploy-simap.yml`, `apps/simap/compose.yml` and the CODEOWNERS line
     `/apps/simap/  @didi-code0980` (same owner as tudocuatui, assumption); deploy skips until a release PR writes
     `apps/simap/release.env`; tunnel target `http://simap:3000` (HTTP); expand-then-contract and rollback notes.
7. **`.github/workflows/release.yml`** — tudocuatui `release.yml` near line for line: `APP: simap`, `NAMESPACE:
   mingming21400`, tag `mingming21400/simap:$TAG`, no `build-args` (Q3), verify step `bash scripts/check-image.sh
   "$ref"` (no `CHECK_IMAGE_DATABASE_URL`, no `EXPECTED_VERSION`), `release.env` lines `SIMAP_IMAGE=$image_ref` and
   `SIMAP_VERSION=$TAG`, PR body names migrate + replace. Header comment lists secret names only. `persist-credentials:
   false`, `provenance: false`, `sbom: false`, `platforms: linux/amd64`.
8. **Local pre-checks (no Docker)**: `pnpm build`; `cd .next/standalone && node --input-type=module -e "await
   import('pg')"` (informative only: Windows linking may differ from Linux); copy `.next/static` into
   `.next/standalone/.next/static`, `pnpm start` and check `/api/healthz` 200, `/api/readyz` 503 without
   `DATABASE_URL`, `/` 200 (proves `server.js` runs with `"type": "module"`). Record results in impl-log. Then all
   loop Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` (run `pnpm
   format` first: oxfmt may format the new YAML/TS).
9. **Tests** listed above.
10. **`README.md`**: "Production image" (what the image contains, `docker build -t simap:local .`, `bash
    scripts/check-image.sh simap:local`, optional `CHECK_IMAGE_DATABASE_URL`, migrate command) and "Release and
    deploy" (push `release/vX.Y.Z` from a commit on main = Ming's step; what the workflow does; deployment repo flow;
    rollback = previous image, migrations forward-only). Replace line 13 with a link to that section.
11. **`work/ming-todo.md`**: leave existing items as they are (SIM-020 references the open `M-4`, so no renumbering;
    see Assumptions). Append at the next free numbers after rebasing on main (the batch adds approval items there):
    (a) Docker Hub repo `mingming21400/simap` + access token; repository secrets on `mmlabs-online/simap`:
    `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `DEPLOY_REPO_TOKEN` (fine-grained PAT on `mmlabs-online/deployment` only:
    Contents RW, Pull requests RW); (b) deployment-repo setup PR per `deploy/deployment-repo/README.md` (includes M-3's
    `add-app-db.sh simap`, the workflow, compose, CODEOWNERS), Ming merges; (c) first release: push `release/v0.1.0`
    from main, check the `release` run, review and merge `release/simap-v0.1.0` on the deployment repo, check the
    `deploy-simap` run. Extend M-2's text with "→ service `http://simap:3000` (HTTP)". Secrets by name only.

CLAUDE.md rules: R3 (no values: env names only; image env limited and checked; `.dockerignore` drops `.env*`; dummy
CI values are non-secret local service credentials, as SIM-002's CI), R4 (files listed above only), R5 (CI `image`
job + Vitest), R1/R2/R6 not affected (no app code, no migration). spaceM §3: no secret values in workflows, files or
logs; §5: no `--no-verify`. Guardrails: agents never push `release/*` or touch the deployment repo; the drafts are
copied by Ming.

## Specialist input used
`consult-software-architect.md`:
- Adopted: finding 1 (standalone layout; `public/.gitkeep`), finding 2 + Q1 (option A traced `pg`, proven in-image by
  importing from `/app/db`, B as fallback), finding 4 (`/api/` health paths), finding 5 (CI `image` job with DB smoke),
  finding 6 (High tier), recommendations for `.dockerignore`, check-image sections, compose, deploy workflow
  (DATABASE_URL only), release workflow, Q2/Q3/Q4/Q5/Q6 defaults, risks (JWKS egress via `web`, CSP not here).
- Changed: `--platform=$BUILDPLATFORM` on the build stage is dropped (native optional deps in the standalone trace must
  match the target platform; tudocuatui's reason "pure JS" does not hold for Next). Migration check compares the image
  set with the checkout instead of requiring `*.sql` (there are none until SIM-008).
- Changed: finding 7 "renumber the duplicate M-4" not done: the open `M-4` is referenced by SIM-020 and the other one is
  ticked; renumbering would break references for no gain.
- Rejected: finding 3 (`.env.example` missing) — orchestrator note: it exists with `PORT=` and `DATABASE_URL=`.
- Added: "app never migrates" proved by starting the app on a fresh DB before migrate (consult did not cover it).

## Assumptions
Decisions with a stated default (Ming can approve the plan as-is; answer only to change one):
1. **Q1 `pg` for migrate**: default option A (traced standalone `pg`); implementer falls back to B (hoisted prod
   install into `/app/db/node_modules`) if the in-image import fails, and records it.
2. **Q2 Security headers / CSP**: not in this ticket (`next.config.ts` is High and out of scope); debt issue for basic
   headers now and a nonce CSP later.
3. **Q3 Version in the image**: no build arg; tag + digest pin the version. Add a version to `/api/healthz` later if
   wanted.
4. **Q4 Registry / platform**: `mingming21400/simap`, `linux/amd64`, Docker Hub, as tudocuatui.
5. **Q5 Google Fonts at build** (SIM-003 adds `next/font/google`): allow network during `pnpm build` (buildx on
   GitHub has egress); debt issue to self-host Manrope with `next/font/local`. A Google outage would block a release
   until then.
6. **Q6 Writable `.next/cache`** owned by `node` (Next's image/runtime cache); everything else root-owned. Alternative:
   no writable dir (image optimisation errors logged at runtime).
7. **Q7 One setup PR in the deployment repo** carries workflow + compose + CODEOWNERS (simap has no earlier release, so
   unlike tudocuatui the compose need not wait for the first release PR); deploy skips until `release.env` exists.
   CODEOWNERS owner `@didi-code0980` as for tudocuatui.
8. **Q8 Size / split**: see Split proposal; default one PR.
9. **Q9 First release timing**: Ming may push `release/v0.1.0` right after merge as a pipeline dry run (only health
   endpoints and placeholder pages exist); otherwise it waits for SIM-021. Default: dry run allowed, not required.

Other assumptions:
- SIM-005 (same batch) adds `MM_IDENTITY_ISSUER` to `.env.example` and reads it; this plan does not depend on it. The
  compose already sets `MM_IDENTITY_ISSUER: https://api.mmlabs.online` and check-image passes it, so both stay valid
  whichever ticket merges first. If SIM-005 makes the server exit without it, the smoke is already covered; a 401 check
  for a guarded route is a follow-up for SIM-005, not here.
- SIM-003 (DONE, PR open) adds `next/font/google` and an inline theme script; the image build handles it (network at
  build), and the `/` + hashed asset smoke covers its static output. No file overlap.
- SIM-008 (same batch) adds `db/migrations/*.sql` and maybe `db/seed-dev.*`: the image copies migrations only; the
  check compares image vs checkout, so it holds before and after SIM-008.
- Hotspots: `work/ming-todo.md` (the batch orchestrator adds plan-approval items on main → pick numbers after
  rebase); `.github/workflows/ci.yml` and `README.md` may be touched by SIM-005/SIM-008 → expect a rebase.
- The self-hosted runner, `web`/`db` networks, `pg-backup` sidecar and `postgres/scripts/add-app-db.sh` exist in the
  deployment repo as for tudocuatui.
- `scripts/check-image.sh` is LF (`.gitattributes` `* text=auto eol=lf`) and run with `bash`, so no exec bit needed.
- Debt issues to file (orchestrator, label `debt` + `project:simap`): Q2 headers/CSP, Q5 self-host font,
  `/api/readyz` public through the tunnel (rate-limit at Cloudflare or cache ~2 s), Docker action SHA pinning if wanted.

## Blocking questions
None.

## Split proposal
Estimated ~950 changed lines (Dockerfile ~45, `.dockerignore` ~20, check-image ~150, ci.yml +40, release.yml ~140,
compose ~70, deploy workflow ~170, deploy README ~45, tests ~220, README ~40, ming-todo ~15), above the ~400 guide.
About 600 of them are near-verbatim ports of reviewed tudocuatui files, which the reviewer diffs against the reference,
and the parts only make sense together (the release opens a PR for a compose that must exist). **Default: one PR.**
If Ming prefers smaller reviews (Q8 = split), the implementer does slice A only and the orchestrator creates SIM-004.1
with slice B, reusing this plan:
- Slice A (AC1, AC2): `Dockerfile`, `.dockerignore`, `public/.gitkeep`, `scripts/check-image.sh`, ci.yml `image` job
  without the `compose config` step, README "Production image".
- Slice B (AC3–AC5): `release.yml`, `deploy/deployment-repo/**`, both test files, ci.yml `compose config` step, README
  "Release and deploy", `work/ming-todo.md`.
