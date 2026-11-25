# Impl log: SIM-034

## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `.github/workflows/ci.yml` | runs-on macbook-runner, timeouts, fork guard, no `services:` (ci-postgres.sh), isolated Docker config, per-run image tag, sudo-free compose config on a temp copy with `-p simap-ci` |
| `.github/workflows/risk-tier.yml` | runs-on, fork guard, `sed '$d'`, host-tools step (kit-managed file, A1/Q7) |
| `.github/workflows/release.yml` (High path) | runs-on, header (D60), docker config + buildx + login before the tag, `sort -V` self-check, clone in RUNNER_TEMP with token-free remote, explicit push URL, always-cleanup |
| `scripts/check-image.sh` | no GNU `timeout` (detached run + poll), `CHECK_IMAGE_NETWORK` (default host) |
| `scripts/ci-postgres.sh` (new) | sweep/start host/start network/stop for throwaway Postgres |
| `scripts/ci-docker-config.sh` (new) | isolated DOCKER_CONFIG and DOCKER_HOST |
| `scripts/ci-workflows.test.ts` (new) | static checks (13 tests) |
| `scripts/release-files.test.ts` | runs-on assertion, 2 new tests |
| `README.md` | where workflows run (D60), queueing, no production resources touched |

### Tests added / changed
- `scripts/ci-workflows.test.ts`: all 13 plan tests (runs-on, no services, no sudo, no production names, start/stop pairing, ci-postgres only simap-ci, no GNU-only, persist-credentials, timeouts, fork guards, no `${{` in run, plus risk-tier and image-job checks).
- `scripts/release-files.test.ts`: renamed deploy test (macbook-runner), new "deployment clone lives in RUNNER_TEMP and keeps no token", new "login happens before the version tag is reserved".

### Checks (actual output summary)
- typecheck: exit 0 (tsc clean)
- format:check: "All matched files use the correct format."
- check:layers: "785 files, no violations"
- test: "Tests 3004 passed | 9 skipped (3013)", 298 files passed
- build: exit 0
- `bash -n` on ci-postgres.sh, ci-docker-config.sh, check-image.sh: ok
- Not runnable here (Windows, no macOS/Docker): the scripts' docker logic, the workflows themselves. Only the first real PR run on MacBookPro verifies: Postgres start and port, `--internal` network reachability from check-image containers, the detached-run timeout logic, buildx install path under `$DOCKER_CONFIG` (A3), the `type=gha` cache v2 with `version: latest`, host `gh`/`python3`, the release login/push path (first release run).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Project-kit: configurable `runs-on`, portable `sed '$d'`, fork guard in risk-tier.yml (A1).
- Scratch `workflow_dispatch` dry run of the release login/push path; maybe run `image` only on non-draft PRs (Q5); narrow the sweep if a second runner is added (A2).
- PR run URL and runner name (`MacBookPro`) to be pasted by the orchestrator after the push.

### Scope self-check
- Could the diff be smaller? No: each change is in the plan's file list.
- Diff size: about +300 / -66 lines excluding the two new scripts and the new test file.

## Attempt 2 (REWORK) — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `.github/workflows/ci.yml` | Issue 1: `cleanup` no longer removes `$RUNNER_TEMP/docker` (comment explains why) |
| `.github/workflows/release.yml` | Issue 1 (same); S2: tag push, clone and push send the token as an `http.<url>.extraheader` through `GIT_CONFIG_*` env with `credential.helper` empty, URLs are token-free (the `remote set-url` line became unnecessary and is removed); S3: `docker logout` only when `DOCKER_CONFIG` equals `$RUNNER_TEMP/docker` |
| `scripts/ci-docker-config.sh` | S1: config has `"auths":{"ci.invalid":{}}` so the CLI does not auto-detect `osxkeychain`; `umask 077` before `mkdir` |
| `scripts/check-image.sh` | security 🟡 5 (optional, applied): `--label simap-ci=1` on the three `docker run -d` calls so the sweep can find leftovers |
| `scripts/ci-workflows.test.ts` | 3 new tests: no main-step `rm -rf` of the docker config dir; auths placeholder + umask order; check-image `run -d` labelled |
| `scripts/release-files.test.ts` | cleanup test now asserts `rm -rf "$RUNNER_TEMP/deployment"` and no docker dir removal; push assertion uses the token-free URL; new tests for credential helper/extraheader and the guarded logout |

### Deviations from plan
- Plan 4.9/6 listed removing `$RUNNER_TEMP/docker` in cleanup; dropped (it breaks setup-buildx-action's post step, which removes the builder). The runner empties `RUNNER_TEMP` after the post steps.
- Plan said the clone/push URL carries `x-access-token`; now the token goes in an http extraheader (env), URLs carry no token.
- README wording ("a cleanup step that logs out and removes the clone") is still correct; unchanged.

### Checks
- format:check: "All matched files use the correct format."
- typecheck: exit 0; check:layers: no violations (785 files)
- test: "Test Files 298 passed | 1 skipped (299)", "Tests 3009 passed | 9 skipped (3018)"
- build: exit 0 ("Compiled successfully")
- `bash -n` ok on ci-postgres.sh, ci-docker-config.sh, check-image.sh

### Additions to Ming's checks (first run / after merge)
- `docker ps -a --filter name=buildx_buildkit` and `docker volume ls --filter name=buildx_buildkit` are empty after a run.
- Buildx version (review Issue 2): the setup-buildx log "Buildx version" and `docker buildx version` in the build step show the pinned latest, not the host's. If the host's older buildx wins, drop the `docker-buildx` dir from `cliPluginsExtraDirs` or order it after the config dir.
- Before the first release: `which docker-credential-osxkeychain`; after a login with the isolated config, `config.json` has no `credsStore`. After the release: `security find-internet-password -s github.com -a x-access-token` finds nothing; `~/.docker/config.json` unchanged.
- Security 🟡 6: repo Settings > Actions "Run workflows from fork pull requests" off; runner group Default "Allow public repositories" off (add to ming-todo).

### Out-of-plan files
None.

### Follow-ups
- Review nits (docker info in process substitution, sweep of simap-smoke/exit names now partly covered by the label, `wait_healthy` message) left as is.

### Scope self-check
Only the listed review issues and the optional 🟡 5 were changed.

## Attempt 3 (REWORK, extra rework allowed by Ming: first runner CI failed)

Root cause: macOS `lsof -nP -iTCP:<port> -sTCP:LISTEN -Fp` prints a file-descriptor line after each `p<pid>` line
(`p33091\nf12\n`; measured on the runner with a temporary diagnostic step). `parsePosixListeners` in
`scripts/dev-process.mjs` treated the `f12` line as malformed and returned null, so `owner()` answered "unknown". It was
not a PATH problem: lsof is at `/usr/sbin/lsof` and the job PATH already has `/usr/sbin`. `ps` and lsof both ran fine
(status 0, 35-56 ms).

Files touched
- `scripts/dev-process.mjs` (OUT-OF-PLAN, SIM-032 code): `parsePosixListeners` now collects `p<pid>` lines and skips other
  one-letter field lines; digits-only or otherwise odd lines are still malformed (null). Required because the code was wrong
  on macOS; a workflow change cannot fix it.
- `scripts/dev-process.test.ts` (OUT-OF-PLAN, same reason): the parser test now covers `p12\nf12\np40\nf9\n` -> [12, 40] and
  keeps `12\n` -> null (the old `f3\n` -> null case is no longer malformed). The two real-tree owner tests are unchanged.
- `.github/workflows/ci.yml`: a temporary diagnostic step was added and removed again; net diff vs attempt 2 is empty.
- `work/ming-todo.md`: merge conflict with main (PR was CONFLICTING, so no pull_request CI ran); our items renumbered M-75
  and M-76 (main took M-74). Earlier handoff text in ticket.md still says M-74/M-75; read those as M-75/M-76.

Runs (self-hosted macOS runner)
- 45664740286: `pnpm test` failed, 2 owner tests (the original failure).
- 45667637399: diagnostic step output above; same 2 failures.
- 45668454103 (after the fix): typecheck, check:layers, `pnpm test`, migrate CLI, migrate smoke, schema check all green.
  `pnpm test:db` fails with exactly the 3 known failures (devices.db "return flags", manage.db "deactivate with release",
  map-items.db ordering; 3 failed | 287 passed), which also fail on main (run 45664750414). Because that step fails the job,
  format:check, build, the standalone check and the `image` job (check-image, compose config) did not run on the runner yet.
  A temporary `continue-on-error` on the db step to reach them was blocked by the permission classifier, so I did not do it.

Local checks (Windows): format:check clean, typecheck ok, check:layers 796 files no violations, `pnpm test` green on two
runs (one earlier run showed 1 failed test I could not identify; the next two were green).

Follow-ups
- Ming decides: fix the 3 test:db failures (separate ticket) or allow a temporary non-blocking db step so the rest of the
  CI job and the image job can be seen on the runner. Until then AC for build/image is unverified on the runner.
