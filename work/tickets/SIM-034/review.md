# Review: SIM-034

## Attempt 1 — 2026-11-26
Verdict: REWORK

Branch `ticket/SIM-034` (HEAD ef8241a) vs `origin/main` (2ea2f27). High path touched: `.github/workflows/release.yml` (plan approved by Ming 2026-11-26, M-73, defaults Q1-Q7). The workflows cannot run on this Windows box. They were reviewed by reading them, and the scripts were checked with `bash -n`.

### Checks (run by reviewer)
- `pnpm format:check`: "All matched files use the correct format." (exit 0)
- `pnpm typecheck`: next typegen + tsc, exit 0
- `pnpm check:layers`: "check-layers: 785 files, no violations"
- `pnpm test`: "Test Files 298 passed | 1 skipped (299)", "Tests 3004 passed | 9 skipped (3013)". This matches impl-log.
- `pnpm build`: "Compiled successfully", exit 0
- Extra run: `pnpm test` and `pnpm build` again with `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:1/postgres`. CI now exports `DATABASE_URL` for the whole `ci` job through `$GITHUB_ENV`. Before, it was set only on the 4 DB steps. Result: same counts, build exit 0, so the unit tests and the build do not depend on it being unset.
- `bash -n` on `scripts/ci-postgres.sh`, `scripts/ci-docker-config.sh` and `scripts/check-image.sh`: all ok. Local bash is 5.3, so I checked bash 3.2 compatibility by reading: `${!v:-}`, `< <(...)`, `[[ =~ ]]`/`BASH_REMATCH`, `local a=1 b` and `case` are all in 3.2. There is no `mapfile`, `declare -A`, `${x,,}` or `;&`.
- `pnpm test:db`: not run here (CI-only per loop.config). It runs in the PR's `ci` job.

### Acceptance criteria
- [x] AC1: every job uses `[self-hosted, macbook-runner]`. Evidence: ci.yml:21 and :67, risk-tier.yml:21, release.yml:35. `ci-workflows.test.ts › every job runs on [self-hosted, macbook-runner]` compares the runs-on count with the job count. `release-files.test.ts › deploys nothing itself: macbook-runner (D60)…` passes.
- [ ] AC2: CI green on the Mac runner. Not verifiable here. It needs the PR run on MacBookPro (run URL and runner name in impl-log). Local equivalents are green (above).
- [ ] AC3: no production writes, and test containers are always removed. The Postgres side is correct: the `simap-ci=1` label, `--tmpfs`, `rm -f -v`, a random `127.0.0.1::5432` port with a 5432/15432 refusal, the per-job names `simap-ci-pg-<run>-<attempt>-<job>`, a private `--internal` network, `-p simap-ci` on a temp compose copy (ci.yml:93-107) and no sudo. The test pairing with `if: always()` passes. FAILED for the buildx builder container, see Issue 1.
- [x] AC4: no `sudo` or interactive input. `ci-workflows.test.ts › no sudo…` passes, every job has `timeout-minutes`, and the risk-tier `host tools` step fails fast. Only the first run shows that nothing prompts (python3 CLT stub, keychain).
- [ ] AC5: risk-tier labels a PR on the Mac. Not verifiable here (PR run). The code is correct: `sed '$d'` at risk-tier.yml:43, and no `${{` in run blocks.

### Issues
#### Issue 1 — 🔴 blocker — correctness / leaves resources on the production host
- **Where**: `.github/workflows/ci.yml:114` (`rm -rf "$RUNNER_TEMP/docker" …` in `cleanup`), `.github/workflows/release.yml:163` (same), `scripts/release-files.test.ts:131` (asserts that line).
- **Expected**: the buildx builder that `docker/setup-buildx-action@v3` creates (driver `docker-container`, so a running `buildx_buildkit_builder-…0` container plus its `…_state` volume on the production Docker daemon) is removed by the action's post step (`cleanup: true` by default).
- **Actual**: Actions runs post steps after all main steps, including `if: always()` ones. The `cleanup` main step deletes `$RUNNER_TEMP/docker`, which is the `DOCKER_CONFIG` dir. That dir holds buildx's builder store (`$DOCKER_CONFIG/buildx`) and the pinned buildx plugin (`$DOCKER_CONFIG/cli-plugins`). When `Post docker/setup-buildx-action` runs, `docker buildx inspect <builder>` finds no builder. It logs "… does not exist" and skips the removal. So every `image` run and every `release` run leaves a running BuildKit container and a volume on the production host. They pile up and use Docker VM memory, which is the Q5 headroom concern.
- **Fix instruction**:
  1. Remove `"$RUNNER_TEMP/docker"` from both `rm -rf` lines:
     - ci.yml:114 keeps `rm -rf "$RUNNER_TEMP/compose-ci"`.
     - release.yml:163 keeps `rm -rf "$RUNNER_TEMP/deployment"`.
  2. Add a one-line comment at both places: the runner empties `RUNNER_TEMP` after the job, after the post steps; `docker logout` plus login-action's post logout already drop the credentials.
  3. Change `release-files.test.ts:131` to assert `rm -rf "$RUNNER_TEMP/deployment"` and `docker logout`.
  4. Add a test in `ci-workflows.test.ts`: no main step in ci.yml or release.yml contains `rm -rf "$RUNNER_TEMP/docker"`, because post steps still need `DOCKER_CONFIG`.
  5. In the README "Release and deploy" text, replace "a cleanup step that logs out and removes the clone" only if the wording becomes wrong.
  6. Record this under impl-log "Deviations from plan": plan step 4.9/6 listed the removal.
  7. Add to the plan's Ming checks, via impl-log: `docker ps -a --filter name=buildx_buildkit` and `docker volume ls --filter name=buildx_buildkit` are empty after a run.

#### Issue 2 — 🟡 should-fix — first-run verification of the pinned buildx (A3/F12)
- **Where**: `scripts/ci-docker-config.sh:14-23` (`cliPluginsExtraDirs` = the host's plugin dirs), ci.yml:76-78, release.yml:82-84.
- **Expected**: `version: latest` buildx (installed into `$DOCKER_CONFIG/cli-plugins`) is the one `docker buildx` resolves. The `type=gha` cache v2 needs a recent buildx.
- **Actual**: depending on the Docker CLI version, `cliPluginsExtraDirs` can be searched before `$DOCKER_CONFIG/cli-plugins`. Then the host's Docker Desktop buildx shadows the pinned one. That is harmless if the host's buildx is recent, and a cache export failure if not. This cannot be decided by reading.
- **Fix instruction**: no code change required now. In impl-log's "Not runnable here" list, add an explicit first-run check: the `docker/setup-buildx-action` log "Buildx version" line and the build step's `docker buildx version` show the pinned latest, not the host version. If the host version shows and it is too old, drop the `docker-buildx` dir from `cliPluginsExtraDirs`, or put it after the config dir.

### Rules (CLAUDE.md)
- R1, R2, R6, R7: not affected (no app code, no schema).
- R3: no secrets in code or logs. The throwaway `postgres:postgres` URL is non-secret. Tokens reach `run:` only through `env:`. The deployment clone's remote is reset to a token-free URL (release.yml:135) and the push uses an explicit URL. `persist-credentials: false` is set on every checkout. Docker Hub credentials go only to the isolated `DOCKER_CONFIG` and are logged out in `if: always()`.
- No `${{ }}` inside `run:` blocks in any of the 3 workflows. Tests cover ci/risk-tier (`ci-workflows.test.ts`) and release (`release-files.test.ts`).
- Production names: ci.yml names `/Users/mingming/.config/simap` once, as the `sed` source, and checks that the copy no longer contains it. There is no `-p simap `, `5432:5432`, `--network host`, prune, or `db`/`web` network.
- R4: every changed file is in the plan's list. `work/ming-todo.md` and `ticket.md` are loop bookkeeping (M-73).
- R5: new static tests exist (13 in `ci-workflows.test.ts`, 2 new in `release-files.test.ts`). They are only static checks: the docker logic itself is unverified until the first run.
- Kit-managed `risk-tier.yml` was edited locally with Ming's Q7 approval. The follow-up for the kit is recorded.

### What only the first real runner run can verify
- `ci` job, on runner MacBookPro:
  - `ci-postgres.sh start host`: random port, health within 60 s, and the env guard does not trip (runner env has no `PG*`/`DATABASE_URL`/`NODE_ENV`, Q4).
  - `pnpm/action-setup` and `setup-node` 22 on darwin-x64 without sudo.
  - migrate CLI/smoke, schema check and `pnpm test:db` against the throwaway DB.
- `image` job:
  - `ci-docker-config.sh` resolves `DOCKER_HOST` from the context, and the plugin dirs from `docker info .ClientInfo.Plugins`.
  - Buildx install path and version (A3, Issue 2), and the `type=gha` cache.
  - The `--internal` network is reachable from the check-image containers (`pg:5432`).
  - The detached-run timeout in `expect_exit` returns 2.
  - Compose `config` on the temp copy.
  - Cleanup leaves no `simap-ci` container, network or image. After the Issue 1 fix, it also leaves no `buildx_buildkit_*` container or volume.
- `risk-tier`: host `gh` and `python3` are usable non-interactively (Q3), and the `risk:high` label appears on the PR.
- `release` (Ming's first `release/X.Y.Z` push):
  - Login with the isolated config (no keychain).
  - BSD/coreutils `sort -V` self-check.
  - Push and verify digest.
  - The deployment PR opens.
  - `~/.docker/config.json` is unchanged and no `deployment` clone is left behind.
- While a CI run is active, production `/api/readyz` stays healthy (Docker VM memory).

### Blockers from review agents
None (the orchestrator adds any security-review findings; `.github/workflows/` triggers the security auditor).

### Nits (do not block)
- `scripts/ci-docker-config.sh:20`: a failing `docker info` inside `< <(...)` is not caught by `set -e`, so the dir list is silently empty. `docker version` still passes. Consider running `docker info` once into a variable first.
- `scripts/ci-postgres.sh` `sweep` does not remove `simap-smoke-*`, `simap-dbsmoke-*` or `simap-exit-*` left behind by a hard-killed `check-image.sh`. The trap covers normal exits. These containers could get `--label simap-ci=1` later.
- `wait_healthy` exits without a message if `docker inspect` itself fails under `set -e`.
- README.md:170-171 has an over-long line after the edit. oxfmt accepts it, but it does not match the wrapping around it.

### Follow-ups (out of scope)
- Project-kit: configurable `runs-on`, portable `sed '$d'` and a fork guard in risk-tier.yml (A1).
- Scratch `workflow_dispatch` dry run of the release login/push path. Possibly run `image` only on non-draft PRs (Q5). Narrow the sweep if a second runner process is added (A2).

### Blockers from review agents
From `security-review.md` → Attempt 1 (🔴, added by the orchestrator; full detail and fixes there):
- 🔴 S1: `scripts/ci-docker-config.sh:23` writes a config with no `credsStore`/`credHelpers`/`auths`, so the Docker CLI auto-detects `osxkeychain` on darwin. The Docker Hub token then lands in the runner user's login keychain, and `docker logout` can wipe the host's own login. Fix: a placeholder `auths` entry (e.g. `{"auths":{"ci.invalid":{}},...}`), `umask 077`, and a test.
- 🔴 S2: `release.yml:99, 133, 150`: token-bearing git commands can store DEPLOY_REPO_TOKEN / GITHUB_TOKEN in git's `osxkeychain` credential helper. Fix: disable `credential.helper` on every token-bearing git command (better: send the token as an http extraheader through `GIT_CONFIG_*` env, not in the URL), plus a test.
- 🔴 S3: `release.yml:156-163`: the `if: always()` cleanup runs `docker logout` even when `DOCKER_CONFIG` was never set (an early guard fails), so it logs out the host's real `~/.docker`. Fix: log out only when `DOCKER_CONFIG` equals `$RUNNER_TEMP/docker`, plus a test.
The security review's 🟡 4 is the same issue as Issue 1 above. Its 🟡 5 (label check-image containers `simap-ci=1`) and 🟡 6 (fork settings are Ming's check) are should-fix / Ming follow-ups.

## Attempt 2 — 2026-11-26
Verdict: PASS

Branch `ticket/SIM-034` (HEAD a5d22af, code in 04b69b3) vs `origin/main`. Rework diff checked: `git diff 3be4094..04b69b3`. The whole diff was re-read briefly. The workflows cannot run on this Windows box. AC2 and AC5 come from the PR run, as plan step 9 says: they are first-run checks, not blockers (see below).

### Checks (run by reviewer)
- `pnpm format:check`: "All matched files use the correct format." (exit 0)
- `pnpm typecheck`: exit 0
- `pnpm check:layers`: "check-layers: 785 files, no violations"
- `pnpm test`: "Test Files 298 passed | 1 skipped (299)", "Tests 3009 passed | 9 skipped (3018)". This matches impl-log attempt 2 (+5 tests since attempt 1).
- `pnpm build`: "Compiled successfully", exit 0
- `bash -n` on `scripts/ci-postgres.sh`, `scripts/ci-docker-config.sh` and `scripts/check-image.sh`: all ok. The new shell code (`umask 077`, `export A=1 B= C=…`, `${DOCKER_CONFIG:-}`, `[ = ]`, `base64 | tr -d '\n'`) works in bash 3.2 and BSD. macOS `base64` does not wrap by default and GNU's does; `tr -d '\n'` covers both.
- `pnpm test:db`: CI only (the PR's `ci` job).

### Fixes from attempt 1
- **Issue 1 (buildx builder leak): fixed.** `rm -rf "$RUNNER_TEMP/docker"` is gone from both cleanups (ci.yml:116 now removes only `compose-ci`, release.yml:173 only `deployment`), and both have the explanatory comment. `DOCKER_CONFIG` stays in place for the `Post docker/setup-buildx-action` builder removal and for login-action's post logout. The runner empties `RUNNER_TEMP` at job end. After the logouts, the leftover `config.json` holds only the `ci.invalid` placeholder. Tests: `ci-workflows.test.ts › never removes the docker config dir in a main step…` and `release-files.test.ts › deployment clone lives in RUNNER_TEMP…` (`not.toMatch(/rm -rf[^\n]*docker/)`). Ming's buildx_buildkit checks are listed in impl-log.
- **S1 (keychain auto-detect): fixed.** ci-docker-config.sh:25 writes `{"auths":{"ci.invalid":{}},…}`. A non-empty `auths` makes docker/cli's `ContainsAuth()` true, so `DetectDefaultStore` (osxkeychain) is skipped, and `docker login` from login-action writes into the file. `umask 077` comes before the `mkdir` (line 23), so the dir and file are 0700/0600. Test: `ci-workflows.test.ts › isolated docker config pins an auths entry… and a private umask`.
- **S2 (git credential helper): fixed, the stronger variant.** release.yml:98-103 (tag push) and :137-157 (clone, push): `GIT_CONFIG_COUNT=2`, `credential.helper` is set to empty (resets the system/global helper list, so osxkeychain is off), and the token goes as an `http.https://github.com/.extraheader` basic header (same form actions/checkout uses), so no 401 happens and git never calls `credential approve`. URLs and argv carry no token. The clone does not keep the header in its config, and `remote set-url` is no longer needed. `gh pr create` uses `GH_TOKEN` from env and does not touch git credentials. Tests: `release-files.test.ts › token-bearing git commands keep the token out of URLs…` (no `x-access-token:$GH_TOKEN@` anywhere, env set before the first `git push|clone` in both steps).
- **S3 (logout against host `~/.docker`): fixed.** release.yml:171 runs `docker logout` only when `DOCKER_CONFIG` equals `$RUNNER_TEMP/docker`. `ci-docker-config.sh` writes `DOCKER_CONFIG` to `$GITHUB_ENV` last, after `docker version` succeeds, so a failed guard or config step means no logout. login-action and its post step run only after the config step succeeded. Test: `release-files.test.ts › docker logout only runs against the isolated DOCKER_CONFIG` (also asserts that no unguarded `docker logout` line exists).
- **Security 🟡 5 (optional): applied.** check-image.sh:83, :105 and :151 add `--label simap-ci=1` to the three `docker run -d` calls. Test: `every check-image docker run -d is labelled simap-ci=1`. Release does not sweep, so the label has no effect there.
- **Issue 2 (buildx version shadowing):** recorded as a first-run check in impl-log, as asked.

### Acceptance criteria
- [x] AC1: unchanged since attempt 1 (ci.yml:21/:63, risk-tier.yml:21, release.yml:35). Tests pass.
- [ ] AC2 (first-run check, not a blocker): the PR run on MacBookPro is green. The orchestrator pastes the run URL into impl-log before Ming merges. Local equivalents are green (above).
- [x] AC3 (static part): the Postgres isolation is as in attempt 1. The buildx builder is now removed by its post step, and the check-image containers are labelled for the sweep. Run-log and host confirmation: Ming verification.
- [x] AC4: `no sudo…` test passes. No new interactive path: the credential helper is off, so git cannot prompt for or store credentials.
- [ ] AC5 (first-run check, not a blocker): the PR gets `risk:high` from the Mac runner. The code is unchanged since attempt 1.

If the PR run fails on AC2 or AC5, that is a new finding for a follow-up rework or escalation. It is not a defect visible in this diff.

### Issues
None blocking.

### Rules (CLAUDE.md)
- R3: no token in URLs, argv, logs or the host keychain any more. Secrets reach `run:` only via `env:`. No `${{ }}` in any `run:` block (re-grepped; the rework added none).
- No `sudo`. No production names or paths beyond attempt 1's `sed` source in ci.yml:99, which is asserted absent from the copy. No prune, `-p simap `, `5432:5432` or `--network host`.
- R4: the rework touches only files in the plan's list. The plan deviations (no `$RUNNER_TEMP/docker` removal, extraheader instead of a token URL) are recorded in impl-log.
- R5: green checks, and each fix has a static test.
- No violations found.

### Blockers from review agents
None open from attempt 1: S1–S3 are fixed as shown above. The orchestrator adds any new security-review attempt 2 findings here.

### First-run / Ming checks the PR must carry (in addition to attempt 1's list and plan "Ming verification after merge")
- `docker ps -a --filter name=buildx_buildkit` and `docker volume ls --filter name=buildx_buildkit` are empty after the `image` run.
- The setup-buildx "Buildx version" log line shows the pinned latest, not the host's buildx (Issue 2).
- Before the first release: `which docker-credential-osxkeychain`. After it: `security find-internet-password -s github.com -a x-access-token` finds nothing, and `~/.docker/config.json` is unchanged.
- The tag push and deployment clone/push succeed with the extraheader auth (needs git >= 2.31 for `GIT_CONFIG_COUNT`; Apple CLT git meets this).
- Security 🟡 6: impl-log says "add to ming-todo", but the branch's ming-todo.md has only M-73. The orchestrator adds the fork-PR / runner-group settings item to `work/ming-todo.md` (on main, per the board rule) or to the PR body.

### Nits (do not block)
- Attempt 1's nits remain as they were (`docker info` inside `< <(...)`, `wait_healthy` message, README line length). impl-log lists them.
- The extraheader block is duplicated in two steps. It is fine at this size, and a shared script would be a follow-up.

### Follow-ups (out of scope)
- Same as attempt 1 and security-review follow-ups (GitHub Environment for release secrets, dedicated runner user, kit changes for risk-tier.yml).
