Status: READY

# Plan: SIM-034, run simap's GitHub Actions on the Mac self-hosted runner

Gate: plan-approval. Ming approves before implementation. Ming should answer the questions in "Questions for Ming at approval" at the end; every one has a default below that works whichever answer comes back.

**High paths touched** (`.claude/loop.config.md` → High paths):
- `.github/workflows/release.yml` (pattern `.github/workflows/release*`).

Not High paths, but they matter for a release:
- `scripts/check-image.sh` runs inside `release`.
- `.github/workflows/risk-tier.yml` is a kit-managed file (CLAUDE.md, Workflow).

Untouched: `deploy/**`, `Dockerfile`, `.github/risk-tiers.yml`. The production compose draft is only read and copied to `$RUNNER_TEMP`.

## Scope summary
- D60 (`work/decisions.md` line 67): "simap's GitHub Actions run on the home server's self-hosted runner `[self-hosted, macbook-runner]` instead of GitHub-hosted runners: ci (ci + image jobs), risk-tier and release. Supersedes, for simap only, the rule "GitHub's runner: app code never runs on the home server" in release.yml. Ming accepts that branch code and `pnpm install` scripts then run on the production host with the runner's access."
- Ticket scope: "`runs-on: [self-hosted, macbook-runner]`"; "`services:` containers are not supported on macOS runners, so start Postgres per job with `docker run` (unique container name, a free host port, never the production Postgres or its port/network) and remove it in an `if: always()` step; replace GNU-only commands …; no `sudo` prompts …; check that Node 22/pnpm setup, buildx and the `type=gha` cache work there."
- Ticket scope: "Jobs must not touch the production compose projects, containers, volumes, networks or env files on the host (the deploy job uses project `simap` and `/Users/mingming/.config/simap/simap.env`)."
- Ticket scope: "Update the release.yml header comment and README "Release and deploy" to say where it runs (D60)."
- Facts from Ming (2026-11-25, M-24 done):
  - The runner is an org-level runner named "MacBookPro".
  - Labels: `self-hosted, X64, macOS, macbook-runner`.
  - Runner group: Default. It is shared with simap, status Idle.
  - So `[self-hosted, macbook-runner]` resolves for this repo, and X64 means `linux/amd64` builds natively.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Every job in ci.yml, risk-tier.yml and release.yml uses `[self-hosted, macbook-runner]` | `scripts/ci-workflows.test.ts › every job runs on [self-hosted, macbook-runner]` and `scripts/release-files.test.ts › deploys nothing itself: macbook-runner (D60), no docker compose, no ssh`; `pnpm test` green. Also read the diff: there are 4 jobs (`ci`, `image`, `tier`, `release`) and 4 `runs-on:` lines. |
| 2 | CI on a PR is green on the Mac runner (typecheck, layers, test, migrate CLI/smoke, schema check, `pnpm test:db`, format, build, image build + check-image, compose config) | On the SIM-034 PR's Checks tab, `ci / ci` and `ci / image` are green, and each job log's "Set up job" shows runner `MacBookPro`. The orchestrator pastes the run URL into impl-log. Locally: `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build` green. |
| 3 | No step writes to or stops anything of the production stack; test Postgres containers are always removed | Tests in `scripts/ci-workflows.test.ts`: `ci.yml never names production resources`, `Postgres start/stop pairs with if: always()`, `ci-postgres.sh only touches simap-ci resources`. In the PR run log, the `stop postgres` step ran and printed the removed `simap-ci-pg-*` name. Ming confirms on the host afterwards (see Ming verification). |
| 4 | No step needs `sudo` or interactive input | `scripts/ci-workflows.test.ts › no sudo in workflows or CI scripts`. The PR run finishes without hanging, and every job has `timeout-minutes`. |
| 5 | risk-tier labels a PR on the Mac runner | The SIM-034 PR gets a `risk:high` label, from release.yml. The `risk-tier / tier` log shows runner `MacBookPro` and a step summary whose explain lines are printed (`sed '$d'`). |

## Ming verification after merge
- After merge, `ci` runs on push to `main` on MacBookPro and is green.
- The next `release/X.Y.Z` push (Ming's step) runs `release` on MacBookPro: the tag, image push and verify digest succeed, and the deployment PR opens. Ming then checks on the host:
  - `ls "$RUNNER_TEMP"/..` has no `deployment` clone left.
  - `~/.docker/config.json` is unchanged (no new `auths` entry from the run).
- After any CI run, on the host:
  - `docker ps -a --filter label=simap-ci=1` is empty.
  - `docker network ls --filter label=simap-ci=1` is empty.
  - `docker volume ls -f dangling=true` did not grow.
  - The `simap` compose project and `~/.config/simap/simap.env` are unchanged (mtime).
- While a simap CI run is active, production simap stays healthy (`/api/readyz`), which shows Docker VM memory headroom (Q5).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `.github/workflows/ci.yml` | Both jobs: `runs-on: [self-hosted, macbook-runner]`, `timeout-minutes`, a fork guard `if:`, `persist-credentials: false`, no `cache: pnpm`. `services:` replaced by `scripts/ci-postgres.sh` start/stop steps. The 4 hardcoded `DATABASE_URL` env blocks (lines 39-40, 46-47, 50-51, 54-55) removed. The `image` job gets the isolated Docker config, buildx `version: latest`, a per-run image tag and image cleanup. The compose config step (lines 91-102) is rewritten with no sudo, a temp copy of the compose file and `-p simap-ci`. | AC1-AC4, F1, F2, F9-F12 | No |
| `.github/workflows/risk-tier.yml` | `runs-on`. Replace `head -n -1 tier.txt` (line 36) with `sed '$d' tier.txt`. Add a fork guard and a host-tool check step (`python3`, `gh`). | AC1, AC5, F4, F6 | No (kit-managed, see Assumptions) |
| `.github/workflows/release.yml` | `runs-on` (line 33). Header lines 5 and 33 updated for D60. Isolated Docker config, buildx `version: latest` and login move before `create version tag`. A `sort -V` self-check in `guards`. The deployment clone goes to `$RUNNER_TEMP`, the remote is reset to a token-free URL, and the push uses an explicit URL. An `if: always()` cleanup step. | AC1, F3 (via check-image), F7, F8, R-e | **Yes** |
| `scripts/check-image.sh` | Replace GNU `timeout` (line 77) with a portable detached run, poll and exit-code read, and add the extra container to the trap. Add an optional `CHECK_IMAGE_NETWORK` (default `host`, so release is unchanged) used at lines 128, 137, 153 and 161. Update the header comment. | AC2: `timeout` is missing on macOS, so both `image` and `release` would fail (F3). `--network host` is the Docker VM, not the Mac (F3). | No (release depends on it) |
| `scripts/ci-postgres.sh` (new) | bash 3.2-compatible `sweep`, `start host`, `start network` and `stop` for throwaway Postgres containers. | AC2, AC3 (R1, R2) | No |
| `scripts/ci-docker-config.sh` (new) | Writes `$RUNNER_TEMP/docker/config.json` (no `credsStore`, plugin dirs found from the host CLI) and exports `DOCKER_CONFIG` and `DOCKER_HOST` to `$GITHUB_ENV`. | F7 and R8: credentials never reach the host's `~/.docker` and the keychain is never used. The pinned buildx goes into the temp dir, not the host's plugins. | No |
| `scripts/ci-workflows.test.ts` (new) | Static checks on the three workflows and two new scripts. | R5 (new logic has tests), AC1, AC3, AC4 | No |
| `scripts/release-files.test.ts` | Lines 115-118: assert `runs-on: [self-hosted, macbook-runner]`, still no `docker compose`/`ssh`. Adjust the stepRun-based test if the PR step text moves. | F5: otherwise `pnpm test` fails | No |
| `README.md` | "Production image" line 160 and "Release and deploy" (lines 162-176): where each workflow runs (D60), queueing behind one runner, that CI never touches project `simap` or `~/.config/simap`, and that Ming can cancel a CI run to deploy sooner. | Ticket scope, R11 | No |

## Data model / migration
None.

## API contract
None.

## Tests to write
These are static checks: the workflows cannot run locally. Each reads the files with `fs`, like `release-files.test.ts`. The PR's own CI run is the end-to-end check (AC2).

| Test (file › name) | Covers |
|---|---|
| `scripts/ci-workflows.test.ts › every job runs on [self-hosted, macbook-runner]` | AC1. For each of the 3 workflows: the number of `runs-on: [self-hosted, macbook-runner]` lines equals the number of jobs under `jobs:`, and there is no `ubuntu-latest`. |
| `… › no services: containers` | F2 |
| `… › no sudo in workflows or CI scripts` | AC4: the 3 workflows, `ci-postgres.sh`, `ci-docker-config.sh` and `check-image.sh` contain no `\bsudo\b`. |
| `… › ci.yml never names production resources` | AC3. `/Users/mingming/.config/simap` appears exactly once, in the `sed` source. No `-p simap` followed by space or end of line (`-p simap-ci` is allowed). No `5432:5432`. No `--network host`. No `docker system prune`, `image prune` or `rmi postgres`. |
| `… › Postgres start/stop pairs with if: always()` | AC3. `ci` and `image` each call `ci-postgres.sh sweep` and `ci-postgres.sh start …`. The step calling `ci-postgres.sh stop` has `if: always()`. |
| `… › ci-postgres.sh only touches simap-ci resources` | AC3. The script contains `--label simap-ci=1`, `--tmpfs /var/lib/postgresql/data` and `rm -f -v`. It has no `--network host`, `-p 5432` or `prune`, and names only `simap-ci-`. It refuses port 15432. |
| `… › no GNU-only commands` | F3, F4. No `head -n -`, `timeout `, `sed -i`, `readlink -f`, `date -d`, `grep -P`, `xargs -r`, `mapfile` or `declare -A` in the 3 workflows or the 3 scripts. |
| `… › every checkout sets persist-credentials: false` | F9. All `actions/checkout` uses in the 3 workflows. |
| `… › every job has timeout-minutes` | F11, AC4 |
| `… › PR-triggered jobs skip fork PRs` | R10: `ci`, `image` and `tier` have the head-repo guard. |
| `… › no ${{ inside run blocks (ci.yml, risk-tier.yml)` | Extends the existing rule (release-files.test.ts line 110) to the new steps. Use the same regex. |
| `scripts/release-files.test.ts › deploys nothing itself: macbook-runner (D60), no docker compose, no ssh` (rename of the existing test) | AC1 for release, F5 |
| `scripts/release-files.test.ts › deployment clone lives in RUNNER_TEMP and keeps no token` (new) | F8. The PR step clones into `"$RUNNER_TEMP/deployment"`, runs `git remote set-url origin https://github.com/mmlabs-online/deployment.git`, and pushes with an explicit token URL. An `if: always()` step removes `$RUNNER_TEMP/deployment` and `$RUNNER_TEMP/docker`. |
| `scripts/release-files.test.ts › login happens before the version tag is reserved` (new) | R-e: the indexes of `docker/login-action` and `setup-buildx-action` are lower than the index of `- name: create version tag`. |

No Domain-focus edge cases apply: there is no app data, dates or pagination.

## Approach
1. **`scripts/ci-postgres.sh`** (bash 3.2, `set -euo pipefail`; needs `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `GITHUB_JOB` and `GITHUB_ENV`, and fails if any is unset).
   - Names:
     - container `simap-ci-pg-$RUN_ID-$ATTEMPT-$JOB`
     - network `simap-ci-net-$RUN_ID-$ATTEMPT-$JOB`
   - `sweep`:
     - removes `docker ps -aq --filter label=simap-ci=1` with `rm -f -v`;
     - removes `docker network ls -q --filter label=simap-ci=1`;
     - removes `docker image ls -q --filter reference='simap-ci'` with `docker image rm` and no `-f`, ignoring failures.
     - Empty lists are handled with `while read` loops, not `xargs -r`.
   - `start host` (`ci` job):
     1. Env guard: fail, printing names only, if any of these is non-empty: `DATABASE_URL PGHOST PGHOSTADDR PGPORT PGDATABASE PGUSER PGPASSWORD PGSERVICE SIMAP_DB_TARGET SIMAP_PROD_TUNNEL_PORT NODE_ENV`. This covers R-g/Q4 by failing closed.
     2. Start the container: `docker run -d --name … --label simap-ci=1 --label simap-ci.run=$RUN_ID --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=postgres -p 127.0.0.1::5432 --health-cmd "pg_isready -h 127.0.0.1 -U postgres" --health-interval 2s --health-retries 30 postgres:17`. The `-h 127.0.0.1` avoids passing on the socket-only init server.
     3. Read the port with `docker port … 5432/tcp`. Fail if it is 15432 or 5432.
     4. Poll `State.Health.Status` for at most 60 s.
     5. Append `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:$port/postgres` to `$GITHUB_ENV`. This is a non-secret throwaway.
   - `start network` (`image` job):
     1. `docker network create --internal --label simap-ci=1 <net>`.
     2. Start the same Postgres with `--network <net> --network-alias pg` and no `-p`.
     3. Wait for healthy.
     4. Append `CHECK_IMAGE_NETWORK=<net>` and `CHECK_IMAGE_DATABASE_URL=postgres://postgres:postgres@pg:5432/postgres` to `$GITHUB_ENV`.
   - `stop`: `docker rm -f -v <name>` and `docker network rm <net>`, both tolerant of "not found". Echo what was removed.
   - Never `prune`, never `rmi postgres:17`, never touch the `db`/`web` networks or the `postgres`/`simap` names.
2. **`scripts/ci-docker-config.sh`** (bash 3.2):
   1. `dir=$RUNNER_TEMP/docker`.
   2. Host: `host=${DOCKER_HOST:-$(docker context inspect --format '{{.Endpoints.docker.Host}}')}`.
   3. Plugin dirs: the `dirname` of each path in `docker info --format '{{range .ClientInfo.Plugins}}{{.Path}}{{"\n"}}{{end}}'`, de-duplicated with `sort -u`. Refuse paths containing `"` or `\`.
   4. Write `{"cliPluginsExtraDirs":[…]}`, with no `credsStore`, `credHelpers` or `auths`.
   5. Check with `DOCKER_CONFIG=$dir DOCKER_HOST=$host docker version`.
   6. Append `DOCKER_CONFIG` and `DOCKER_HOST` to `$GITHUB_ENV`.

   This works whether the runtime is Docker Desktop, OrbStack or colima, and whether or not `credsStore` is set (Q1, Q2).
3. **`check-image.sh`**:
   - `NET="${CHECK_IMAGE_NETWORK:-host}"`. Replace the four `--network host` with `--network "$NET"`.
   - New `expect_exit`:
     1. `docker run -d --name "$EXITNAME" --network none "$@"`, where `EXITNAME=simap-exit-$$` is added to the trap.
     2. Poll `docker inspect -f '{{.State.Running}}'` for up to 30 s with `sleep 1`.
     3. If it is still running, use `got=124` (same as GNU timeout). Otherwise `got=$(docker inspect -f '{{.State.ExitCode}}')`.
     4. `docker rm -f "$EXITNAME"`, then compare.
   - Header comment: document `CHECK_IMAGE_NETWORK`, and say the URL must be reachable from that network.
   - Release keeps the defaults, so the behaviour there changes only in how the timeout works.
4. **`ci.yml`**:
   - Both jobs:
     - `runs-on: [self-hosted, macbook-runner]`
     - `if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`
     - `timeout-minutes`: `ci` 20, `image` 25
   - `ci` steps:
     1. checkout (`persist-credentials: false`)
     2. `bash scripts/ci-postgres.sh sweep`
     3. `bash scripts/ci-postgres.sh start host`
     4. pnpm/action-setup, then setup-node 22 without `cache`
     5. the existing steps, minus the per-step `DATABASE_URL` env (they read it from `$GITHUB_ENV`)
     6. a `stop postgres` step with `if: always()`
   - `image` steps:
     1. checkout (`persist-credentials: false`)
     2. sweep
     3. `bash scripts/ci-docker-config.sh`
     4. `start network`
     5. `setup-buildx-action@v3` with `version: latest` (installs into `$DOCKER_CONFIG`, needed for `type=gha` cache v2, F12)
     6. build with `tags: simap-ci:${{ github.run_id }}`, cache `type=gha,scope=image` unchanged
     7. `bash scripts/check-image.sh "simap-ci:$GITHUB_RUN_ID"`. `CHECK_IMAGE_*` comes from `$GITHUB_ENV`.
     8. compose config
     9. a cleanup step with `if: always()`: `ci-postgres.sh stop`, `docker image rm "simap-ci:$GITHUB_RUN_ID" || true`, `rm -rf "$RUNNER_TEMP/docker"`
   - Compose config step (`shell: bash`):
     1. `d="$RUNNER_TEMP/compose-ci"`.
     2. Write the dummy `release.env` and `simap.env` into `$d`.
     3. `sed "s|/Users/mingming/.config/simap/simap.env|$d/simap.env|g" deploy/deployment-repo/apps/simap/compose.yml > "$d/compose.yml"`
     4. `grep -qF "env_file: $d/simap.env"` must succeed, and `grep -q /Users/mingming` must find nothing.
     5. `compose=(docker compose -p simap-ci -f "$d/compose.yml")`.
     6. Run the same positive and negative `config --quiet` checks as today. `config` never creates or stops anything.
   - Keep the `concurrency` block as is.
5. **`risk-tier.yml`**:
   - `runs-on: [self-hosted, macbook-runner]`.
   - `if: github.event.pull_request.head.repo.full_name == github.repository`.
   - A first step `host tools` runs `command -v gh` and `python3 -I -c 'import sys; print(sys.version)'`, failing with `::error::` naming the missing tool. It runs non-interactively; the CLT stub errors instead of prompting under launchd.
   - Replace `head -n -1 tier.txt` with `sed '$d' tier.txt`.
6. **`release.yml`**:
   - `runs-on: [self-hosted, macbook-runner] # D60: simap's workflows run on the home server's runner`. Header line 5 also says the workflow itself runs on macbook-runner (D60).
   - In `guards`, add a `sort -V` self-check: `[ "$(printf 'v0.9.0\nv0.10.0\n' | sort -V | tail -n 1)" = v0.10.0 ]`, or fail.
   - Step order: guards → `docker config` (`bash scripts/ci-docker-config.sh`) → `setup-buildx-action@v3` with `version: latest` → `docker/login-action@v3` → `create version tag` → build and push → verify pushed digest → PR on deployment repo → `cleanup` with `if: always()`. With this order, a login or buildx failure no longer burns a version (R-e).
   - Update the comment "Reserve the version before pushing the image" so it still holds.
   - PR step:
     - `git clone --depth 1 "https://x-access-token:$GH_TOKEN@…" "$RUNNER_TEMP/deployment"`, then `cd` there.
     - Immediately run `git remote set-url origin https://github.com/mmlabs-online/deployment.git`.
     - Push with `git push "https://x-access-token:$GH_TOKEN@github.com/mmlabs-online/deployment.git" "$branch"`, the same pattern as line 80.
   - Cleanup step: `docker logout || true`, `docker image rm "$NAMESPACE/simap@$DIGEST" || true` (no `-f`, so an image a container uses is never removed), and `rm -rf "$RUNNER_TEMP/deployment" "$RUNNER_TEMP/docker"`.
   - Keep `${{` out of `run:` blocks: pass the digest through `env:`.
7. **Tests**: write `scripts/ci-workflows.test.ts` and update `release-files.test.ts` as listed.
8. **README**: update as listed.
9. Run the checks: `pnpm format`, `pnpm format:check`, `pnpm typecheck`, `pnpm check:layers`, `pnpm test`, `pnpm build`. Push the branch, then the orchestrator watches the PR run on MacBookPro (AC2, AC5).

CLAUDE.md rules:
- R3: no secrets in code. The Postgres password is a throwaway `postgres`, the same as today. The token never stays on disk.
- R4: only the files listed above.
- R5: new static tests.
- R1, R2, R6 and R7: not affected.
- Guardrails: never push `release/*`, never touch the shared Postgres or the deployment repo by hand. CI only reads `deploy/deployment-repo/**`.

## Specialist input used
From `consult-software-architect.md`:

- **Adopted**:
  - F1/R4: compose config without sudo, using a temp copy and `-p simap-ci`.
  - R1: `ci-postgres.sh` with labels, tmpfs, `rm -f -v`, a start sweep and the 15432 refusal.
  - R2: a private `--internal` network plus `CHECK_IMAGE_NETWORK` defaulting to `host`. This puts `check-image.sh` in scope (Q6).
  - R3, option (b): a detached run with a poll. Unlike `perl alarm`, it also removes the timed-out container.
  - R5: `sed '$d'`.
  - R6: drop `cache: pnpm`, add `persist-credentials: false`.
  - R7: pin buildx and per-run image tags.
  - R8: clone into `$RUNNER_TEMP`, a token-free remote and an always `docker logout`.
  - R9: timeouts and the README queueing note.
  - R10: fork guards.
  - R11: docs and tests.
  - R12: the High-path call-out.
- **Adopted, made stricter**:
  - R8/Q2: the isolated `DOCKER_CONFIG` is always used, in both `image` and `release`, instead of "only if the keychain fails". It works regardless of the answer to Q1/Q2, and it keeps the pinned buildx out of the host's `~/.docker/cli-plugins`, which production deploys use.
  - R-g: an env guard that fails closed, instead of waiting for Q4.
- **Adapted**: release step order moves buildx and login before the tag reservation, which mitigates R-e. The consultant's dry-run idea becomes a follow-up.
- **Rejected**:
  - R5's `actions/setup-python`: on macOS its python-versions packages can install with `sudo installer -pkg`, which risks AC4. The plan uses the host `python3` with a non-interactive check step, and Ming confirms CLT/python3 in Q3.
  - R7's separate cache scope `image-ci`: keeping `scope=image` lets release runs reuse main's warm cache. PR-ref caches are already unreadable from main and release (F12).
  - R9's "skip draft PRs": not in the ticket. Raised as Q5 instead.

## Assumptions
- **A1 (kit-managed file).** `.github/workflows/risk-tier.yml` is kit-managed: CLAUDE.md says to change it in spaceM project-kit, not here. D60 and the ticket scope explicitly move risk-tier, so the plan edits it locally.
  - Follow-up for the kit: a configurable `runs-on`, the portable `sed '$d'`, and a fork guard.
  - A kit upgrade would revert the local edit until the kit has the change.
  - Ming confirms at approval (Q7).
- **A2 (one job at a time).** The sweep assumes MacBookPro runs one job at a time, which is true for one runner process. If Ming ever adds a second runner process on this host, the sweep must be narrowed, for example to `simap-ci.run` labels older than the current run.
- **A3 (setup-buildx install path).** `setup-buildx-action` with `version:` installs the plugin under `$DOCKER_CONFIG/cli-plugins`, which is the isolated dir. The reviewer checks the step log line that shows the install path in the PR run. If it points at `~/.docker`, the plan is rework.
- **A4 (Postgres image).** `postgres:17` is pulled into the production daemon, which probably already has it. It is never removed.
- **A5 (actions on darwin-x64).** `pnpm/action-setup@v4` and `actions/setup-node@v4` install darwin-x64 binaries into the runner tool cache without sudo, which is standard for self-hosted macOS.
- **A6 (Docker Hub credentials).** During a release they sit base64-encoded in `$RUNNER_TEMP/docker/config.json` until the always-cleanup step runs. The runner also empties `_temp` between jobs. Accepted under D60.
- **A7 (hotspots).** The only other open ticket is SIM-039.8 (DONE, ui). No overlap with these files is expected. If it touched `README.md`, expect a trivial rebase.
- **A8 (merge order).** The `timeout` fix in `check-image.sh` must merge together with the `release.yml` move. Both are in this PR.
- **A9 (follow-ups, not in this ticket).**
  - A scratch `workflow_dispatch` dry run of the release login/push path.
  - Possibly running `image` only on non-draft PRs or main (Q5).
  - Narrowing the sweep if more runners are added.

## Questions for Ming at approval
None of these block the plan. The default shown is what the plan does.

| # | Question (from the consultant plus the kit note) | Default in this plan (works regardless) |
|---|---|---|
| Q1 | Which Docker runtime runs on the Mac (Docker Desktop, OrbStack or colima), and which version? | The isolated `DOCKER_CONFIG` takes `DOCKER_HOST` from the current context and plugin paths from the CLI. The private network (R2) avoids depending on `--network host`. Any runtime works. |
| Q2 | Is `credsStore` (desktop or osxkeychain) set in the runner user's `~/.docker/config.json`? Has `docker login` ever worked from a runner job? | The isolated config has no `credsStore`, so the keychain is never used. Login happens before the tag reservation, so a login failure does not burn a version. |
| Q3 | Are `gh` and the Xcode Command Line Tools (a real `python3`) installed for the runner user? Is passwordless sudo configured? | No step uses sudo (AC4, tested). A `host tools` step fails fast with a clear error if `gh` or `python3` is missing. If passwordless sudo exists, today's ci.yml must never run on the Mac before this PR merges (F1); this PR removes the risk. |
| Q4 | Does the runner's `.env`/`.path` set `PGPORT`, `SIMAP_DB_TARGET`, `DATABASE_URL`, `NODE_ENV` or other `PG*` variables? | `ci-postgres.sh start host` fails closed, printing names only, if any is set. Ming would then remove it from the runner env. |
| Q5 | How much memory does the Docker VM have? Is the image build acceptable there during working hours, or should `image` run only on push to main or non-draft PRs? | `image` stays as today (every PR, after `ci`) with `timeout-minutes: 25`. Narrowing it is a follow-up if Ming wants. |
| Q6 | Can `scripts/check-image.sh` be in scope? | Yes, it is in the file list. Without it `image` and `release` fail on macOS (`timeout`). |
| Q7 | Edit the kit-managed `risk-tier.yml` locally (D60) and file a project-kit follow-up? | Yes: edit it locally and add the follow-up (A1). |

## Blocking questions
None.

## Split proposal
None. The estimate is about 300-350 changed lines: workflows about 120, the two new scripts about 110, `check-image.sh` about 25, tests about 80, README about 15. That is one cycle.
