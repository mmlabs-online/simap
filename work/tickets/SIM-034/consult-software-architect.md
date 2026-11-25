I read SIM-034 and checked the three workflows, the helper scripts and the deploy drafts. Moving to `[self-hosted, macbook-runner]` takes more than changing `runs-on`. One step would overwrite production's env file if run unchanged. Two things break on macOS: `timeout` and the `--network host` DB smoke. An existing test says release must stay on `ubuntu-latest`. Nothing was edited, and nothing below has been run on the Mac yet.

## Findings

**F1 (critical). The `compose config` step in `ci.yml` (lines 96-97) would overwrite production's env file.** It runs `sudo install -d /Users/mingming/.config/simap` and `sudo tee /Users/mingming/.config/simap/simap.env`. On GitHub's Ubuntu runners that file is throwaway. On the Mac it is the real production file (`DATABASE_URL`, Google Drive secrets). With passwordless sudo the step replaces it with `postgres://ci:ci@...`, and the next recreate of the simap container breaks production. Without passwordless sudo the step fails or waits for a password. It also runs with `-p simap`, the production project name. `config` is read-only, but the name should still not be reused.

**F2. `services:` has to go in both `ci` and `image`.** `ci` gets DB access through `localhost:5432`, hardcoded in four steps. `image` passes `CHECK_IMAGE_DATABASE_URL=...127.0.0.1:5432`. Port 5432 is a bad fixed choice on a host that already runs a shared Postgres.

**F3. `scripts/check-image.sh` has two macOS problems.** This script is shared by `ci` and `release`.
- Line 77 calls GNU `timeout`, which macOS does not have (no coreutils by default). `expect_exit` gets 127 instead of 2, so both `image` and `release` fail.
- The "db smoke" section (lines 128-161) uses `docker run --network host` to reach `127.0.0.1:5432`. On a Mac, Docker runs inside a Linux VM, so "host" means the VM, not the Mac. Whether a port published on the Mac's 127.0.0.1 can be reached that way depends on the runtime (Docker Desktop, OrbStack or colima) and its version. I can't rely on it.
- Release never sets `CHECK_IMAGE_DATABASE_URL`, so only the `timeout` problem affects release.

**F4. GNU-only commands.**
- `risk-tier.yml` line 36 uses `head -n -1`, which BSD `head` rejects.
- Everything else I checked is portable on macOS with bash 3.2: `tee /dev/stderr`, `seq`, `grep -E`/`-Eo`, `cut`, `mktemp`, `cmp -s`, `install -d`, `[[ =~ ]]` with `BASH_REMATCH`, `${!name}`, and the `${arr[@]+...}` guard.
- `sort -V` in release guards (lines 61-62) should work with Apple's `sort`, but verify it once on the host (R7).
- A grep for `sed -i`, `readlink -f`, `date -d`, `grep -P`, `xargs -r`, `stat -c`, `mapfile` and `declare -A` across scripts and workflows found nothing.
- The default `run:` shell on macOS is `/bin/bash` 3.2 with `-e` only, so steps that rely on `pipefail` need `shell: bash`. That matches today's behaviour.

**F5. `scripts/release-files.test.ts` lines 115-118 contradict D60.** They assert `runs-on: ubuntu-latest` and `not.toMatch(/self-hosted|docker compose|\bssh\b/)`. Once release moves, `pnpm test` fails until the test is updated. The rule "no `${{` inside run blocks" (line 110) still applies to every new step.

**F6. Host tools are not guaranteed.**
- risk-tier needs `python3` and `gh`; release needs `gh`. The script only imports standard-library modules.
- On macOS, `/usr/bin/python3` is a stub for the Xcode Command Line Tools. If those are missing, it asks for an install, which a launchd service cannot answer.
- `gh` and `git` are probably present, because deploy-simap uses them.

**F7. Docker credentials on a shared, long-lived host.** On GitHub runners the machine is thrown away; here it is not.
- `docker/login-action` writes to the runner user's `~/.docker/config.json`. Logout happens only in its post step, so a crash leaves the Docker Hub token on disk.
- If Docker Desktop is the runtime, `credsStore: desktop` uses the macOS keychain. Under launchd this often fails with "User interaction is not allowed".

**F8. Release leaves `DEPLOY_REPO_TOKEN` on disk.** The release step clones the deployment repo into the workspace with the token in the remote URL (`git clone https://x-access-token:$GH_TOKEN@...`). On a self-hosted runner that `deployment/.git/config` stays on disk until the next checkout cleans it.

**F9. `ci.yml` checkout keeps the token.** It uses the default `persist-credentials: true`, so the GITHUB_TOKEN sits in `.git/config` while PR code runs.

**F10. Leftover resources.**
- `docker rm -f` without `-v` leaves postgres:17's anonymous data volume behind every run.
- `simap:ci-local` and the image pulled in release stay in the production Docker daemon.
- `setup-buildx-action` creates a `buildx_buildkit_builder-*` container that its post step removes, but it leaks if the runner is killed.

**F11. One runner for everything.**
- Jobs for simap ci, image, risk-tier and release, deploy-simap, and other repos' deploys all queue one at a time. `ci` and `image` have no `timeout-minutes`, so a hung build blocks production deploys of every app.
- `concurrency` groups are per repo, so nothing can give deploys priority.
- The image build runs BuildKit inside the same Docker VM as production Postgres and the app containers, so they compete for its memory and CPU. Host-side `pnpm build` uses Mac memory instead.

**F12. Caching.**
- `type=gha` keeps working from self-hosted runners. It needs a buildx/BuildKit recent enough for GitHub's cache service v2 (buildx 0.21 or later). `setup-buildx-action` uses the host's buildx unless a `version:` is given.
- PR-ref caches cannot be read by main or release refs, so PR code cannot poison the release cache that way.
- `setup-node` `cache: pnpm` would upload the host's ever-growing pnpm store to GitHub's cache, which is pointless on a persistent host.

**F13. What PR code can reach.** D60 accepts this risk, but the scope is worth stating. PR code and `pnpm install` scripts run as the runner user with access to:
- the production env file;
- the deployment checkout's `postgres/secrets/apps/*.password` (every app's DB password);
- the Docker socket, which equals root over every container and volume, including `pgdata`;
- other repos' workspaces;
- the shared tool cache (Node, pnpm, buildx binaries). A PR could tamper with these, and later main or release runs would use them.

GitHub's Ubuntu runners kept all of this separate.

**F14. Tests that behave differently on macOS.**
- `scripts/deploy-envfile.test.ts` will now run under bash 3.2. It safely points `HOME` and `ENV_FILE` at a temp directory.
- `dev-process` tests use `lsof` and skip when it is missing; macOS has it, so they will run.
- APFS is case-insensitive by default.
- The DB target classifier (`db/target.js`) treats port 15432, any `PGPORT` set to it, and `SIMAP_DB_TARGET` as production. Docker never assigns random ports that low, but `PGPORT` or `SIMAP_DB_TARGET` set in the runner's environment would make `test:db` refuse to run.

## Recommendations

**R1. Postgres per job via `docker run`, in a small `scripts/ci-postgres.sh start|stop` written for bash 3.2.** Covers AC2 and AC3.
- Name: `simap-ci-pg-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}-${GITHUB_JOB}`.
- Labels: `--label simap-ci=1 --label simap-ci.run=$GITHUB_RUN_ID`.
- `--tmpfs /var/lib/postgresql/data` (valid for postgres:17; no volume left, faster).
- `-e POSTGRES_PASSWORD=postgres`, plus the same health-cmd as today.
- `ci` job: publish `-p 127.0.0.1::5432`, so only loopback and a random port. Read the port with `docker port`, fail if it is 15432, poll until healthy (at most about 60 s), then write `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:$port/postgres` to `$GITHUB_ENV`. Remove the four hardcoded per-step `DATABASE_URL` values.
- Never use the `db` or `web` networks, the `postgres` or `simap` names, or host port 5432.
- `stop`: `docker rm -f -v <name>`, plus `docker network rm` for R2, in an `if: always()` final step.
- Also sweep at job start, before creating anything: `docker ps -aq --filter label=simap-ci=1 | xargs docker rm -f -v`, the same for networks, and allow an empty list without `-r`. This is safe because the runner runs one job at a time and only simap CI uses the label.
- Never `docker system prune`, `docker image prune -a` or `docker rmi postgres:17`: production shares that daemon and probably that image.

**R2. `image` job: a private network instead of `--network host`.**
- `docker network create --internal --label simap-ci=1 simap-ci-net-<id>`, with Postgres on it under `--network-alias pg` and no published port.
- `check-image.sh` gets an optional `CHECK_IMAGE_NETWORK` that defaults to `host`, so release behaviour is unchanged. Its three `--network host` uses become `--network "$NET"`.
- CI sets `CHECK_IMAGE_DATABASE_URL=postgres://postgres:postgres@pg:5432/postgres`.
- `--internal` also gives the PR image no internet access during the DB smoke.
- Trade-off: `check-image.sh` is not in the ticket's file list. It must be added to the plan (rule R4), since the `timeout` fix in R3 touches it anyway.
- Fallback: keep host networking and confirm on the Mac that it works. That depends on the Docker runtime and is fragile.

**R3. Replace `timeout` without new host dependencies.** Covers AC2. Two options:
- (a) `perl -e 'alarm shift; exec @ARGV' 30 docker run ...`. Perl ships with macOS, and an exit status of 142 counts as "not 2", so the check still fails correctly.
- (b) A portable bash helper that runs the container detached with `--name`, then waits with a loop of `docker wait` plus `sleep`, then `docker rm -f`.

(b) also removes the container when the time runs out; (a) is one line. Either way, give the container a name and add it to the existing `trap`.

**R4. Rewrite the `compose config` step without sudo and without the real path.** Covers AC3 and AC4.
- Write the dummy `simap.env` to `$RUNNER_TEMP/compose-ci/`.
- Generate a copy with `sed "s|/Users/mingming/.config/simap/simap.env|$RUNNER_TEMP/compose-ci/simap.env|" deploy/deployment-repo/apps/simap/compose.yml > "$RUNNER_TEMP/compose-ci/compose.yml"`. No `sed -i`.
- Check with `grep` that the copy contains the temp path and no `/Users/mingming` left.
- Run both `config --quiet` checks (positive, and negative without `--env-file`) with `-p simap-ci`.
- Do not change the production compose draft (for example to `env_file: required: false`). Failing when the file is missing is a deliberate safety. This also avoids reading production secrets during CI.

**R5. `risk-tier.yml`.** Covers AC5.
- Replace `head -n -1 tier.txt` with `sed '$d' tier.txt`.
- Add `actions/setup-python@v5` (python 3.12, which has darwin-x64 builds) before the compute step, so there is no dependence on the Command Line Tools stub.
- Keep `persist-credentials: false` and `timeout-minutes: 5`.

**R6. Node and pnpm.**
- Keep `pnpm/action-setup@v4` and `actions/setup-node@v4` with Node 22; both install darwin-x64 into the runner's tool cache.
- Drop `cache: pnpm`: the store already persists locally and stays integrity-checked against the lockfile.
- Set `persist-credentials: false` on every checkout (fixes F9).
- Keep checkout's default `clean: true`, which removes untracked and ignored files (`node_modules`, `.next`) between runs.

**R7. buildx.**
- Keep `setup-buildx-action@v3` with the docker-container driver, and pin `version:` to a recent buildx (for example `latest` or a fixed v0.2x) so `type=gha` works whatever the host has. Keep `cleanup: true`, the default.
- Give `ci` and `image` separate cache scopes, for example `scope=image-ci` (`release` keeps `scope=image`, which avoids cache churn).
- The X64 label means `linux/amd64` builds natively. If the host ever changes to Apple Silicon, release silently needs emulation (QEMU), so write that down.
- In the `image` cleanup, tag the image uniquely (`simap-ci:${GITHUB_RUN_ID}`) and `docker image rm` it. In release, `docker image rm "$ref"` after the check (both in `if: always()`).
- Add a step that checks `sort -V` (one `printf | sort -V` assertion), or rely on the first release run and watch it.

**R8. Secrets in the release job.**
- Clone the deployment repo into `$RUNNER_TEMP/deployment` rather than the workspace, and `rm -rf` it in an `if: always()` step. Better still, pass the token as a one-off header (`git -c http.extraheader=...`) or set the remote URL back after the push, so it is never stored. This fixes F8.
- Docker Hub credentials: keep `logout: true` and add an `if: always()` `docker logout`.
- On keychain failures, open question Q2 decides between two options. One is a job-level `DOCKER_CONFIG=$RUNNER_TEMP/docker` with a `config.json` that sets no `credsStore`, keeps the current context and lists `cliPluginsExtraDirs: ["$HOME/.docker/cli-plugins"]`; otherwise buildx and compose plugins and the Docker Desktop context are lost. The other is to leave the host config alone. Test the choice once with a dry run (a release branch for a throwaway version is not possible because versions are reserved, so test with `workflow_dispatch` on a scratch workflow, which is a follow-up).

**R9. Concurrency.**
- Add `timeout-minutes` to `ci` (about 20) and `image` (about 25); `risk-tier` (5) and `release` (30) already have one.
- Keep `cancel-in-progress` for PR runs. Cancelled jobs still run `if: always()` and post steps; the start-of-job sweep in R1 catches force-kills.
- State in README that deploys of every app queue behind simap CI on this single runner, and that Ming can cancel a CI run to deploy sooner.
- Decide with Ming whether `image` should run only when `ci` passes (it already `needs: ci`) and perhaps skip draft PRs. This reduces load on the production VM.

**R10. Limit who triggers runs.** Add `if: github.event.pull_request.head.repo.full_name == github.repository` (or the push event) to the PR-triggered jobs, so fork PRs never run on the production host even if repo settings change later. No job other than `release` receives secrets, and `permissions:` stays minimal as it is today.

**R11. Docs and tests.**
- Update `release.yml`'s header (lines 5 and 33): it now runs on macbook-runner (D60), and app code does run on the home server.
- Update README "Release and deploy" (line 165 onward) with where each workflow runs, the queueing note, and that CI never touches the `simap` project or `~/.config/simap`.
- Update `release-files.test.ts` lines 115-118 to assert `runs-on: [self-hosted, macbook-runner]` and still no `docker compose` or `ssh`.
- Add a small test, in the same file or a new one, that `ci.yml` never mentions `/Users/mingming/.config/simap/simap.env` outside the `sed` source, never uses `sudo`, never uses `-p simap ` and has no `services:`. Covers rule R5 and AC3 and AC4.

**R12. Gate.** `release.yml` is a High path, so this needs Ming's approval of the plan. If `scripts/check-image.sh` is added, call it out because release depends on it.

## Risks

- **R-a.** PR code runs on the production host with access to Docker, every DB password, the production env file and the shared tool cache. D60 accepts this. Remaining blast radius: a malicious or compromised dependency can persist on the host and affect later main and release runs (F13). Mitigations: R10, `--frozen-lockfile`, and Ming reviews dependency changes.
- **R-b.** Building in the same Docker VM as production can starve or OOM production containers. Ming should check the Docker VM's memory headroom.
- **R-c.** Long simap CI runs delay deploys of other apps (one runner, no priority).
- **R-d.** The DB smoke behaves differently if R2 is skipped. The `timeout` problem breaks release on the first run if not fixed before merge.
- **R-e.** Keychain or credential-helper failures in `docker/login-action` under launchd would show up only on the first real release, after the version tag is already reserved (release.yml line 73). That burns a version number.
- **R-f.** Leftover containers or images after hard kills. The label sweep covers containers and networks; images only partly.
- **R-g.** Until Ming confirms (Q1 and Q4), the runner user's environment (`PGPORT`, `SIMAP_DB_TARGET`, `DATABASE_URL`, `NODE_ENV`) could leak into jobs and change guard behaviour.

## Open questions for Ming

- **Q1.** Which Docker runtime runs on the Mac (Docker Desktop, OrbStack or colima), and which version? This decides R2's fallback and the keychain issue.
- **Q2.** Does `~/.docker/config.json` on the runner user have `credsStore` set (desktop or osxkeychain)? Has `docker login` ever worked from a runner job?
- **Q3.** Are `gh` and the Xcode Command Line Tools installed for the runner user? Also, is passwordless sudo configured? If so, F1 is an immediate risk if anyone runs today's ci.yml on the runner.
- **Q4.** What does the runner's `.env`/`.path` contain? Specifically `PGPORT`, `SIMAP_DB_TARGET`, `DATABASE_URL` or `NODE_ENV`.
- **Q5.** How much memory does the Docker VM have? Is it acceptable to run the image build there during working hours, or should `image` run only on push to main or on non-draft PRs?
- **Q6.** Can `scripts/check-image.sh` be in scope for SIM-034? It is needed for the `timeout` fix and R2.

Files referenced:
- d:\project\simap-game-ui\.github\workflows\ci.yml
- d:\project\simap-game-ui\.github\workflows\risk-tier.yml
- d:\project\simap-game-ui\.github\workflows\release.yml
- d:\project\simap-game-ui\scripts\check-image.sh
- d:\project\simap-game-ui\scripts\release-files.test.ts
- d:\project\simap-game-ui\scripts\deploy-envfile.test.ts
- d:\project\simap-game-ui\db\target.js
- d:\project\simap-game-ui\deploy\deployment-repo\apps\simap\compose.yml
- d:\project\simap-game-ui\deploy\deployment-repo\.github\workflows\deploy-simap.yml
- d:\project\simap-game-ui\README.md
