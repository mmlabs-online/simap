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
