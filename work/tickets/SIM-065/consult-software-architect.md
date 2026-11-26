## SIM-065 consult (software architect): choosing the runner with SIMAP_RUNNER and a dispatch input

### Findings

**1. Nothing in the current steps breaks on `ubuntu-latest`.**
- **Scripts.** `scripts/ci-postgres.sh`, `scripts/ci-docker-config.sh` and `scripts/check-image.sh` use bash 3.2-compatible, non-GNU-only commands, so they also run on Linux bash 5.
- **Postgres.** Docker and the `runner` user's docker group are available on the hosted VM, so no `sudo` is needed. `-p 127.0.0.1::5432` plus `docker port | head -n 1 | sed` works the same. The `start_host` env guard (PG*, NODE_ENV and the others) has nothing set on ubuntu-latest.
- **Docker config.** On Linux, `docker context inspect` gives `unix:///var/run/docker.sock`. The plugin paths (`/usr/libexec/docker/cli-plugins/...`) contain no quotes. The placeholder `auths` entry also stops the Linux credential-store auto-detect (pass/secretservice) for the same reason it stops osxkeychain: detection only runs when `auths` is empty. Keep it.
- **Image check.** `CHECK_IMAGE_NETWORK` defaults to `host`, but only the db smoke uses it, and release never sets `CHECK_IMAGE_DATABASE_URL`. CI passes the private network. Linux is fine.
- **Compose config step.** The docker compose v2 plugin is present on ubuntu-latest. There `RUNNER_TEMP=/home/runner/work/_temp`, so the BUG-006 trap (runner home under `/Users/mingming`) does not apply. `prod=/Users/mingming/.config/simap` stays as the text to be removed, as the AC asks.
- **Release guards.** GNU `sort -V` passes the numeric self-check. GNU `base64` wraps lines, but the existing `| tr -d '\n'` already handles that. `[[ =~ ]]`/`BASH_REMATCH` work. `fetch-depth: 0` brings `origin/main` and the tags on both runners.
- **Risk-tier and CI.** `gh` and `python3` are preinstalled for risk-tier. In CI, `tee /dev/stderr` works on Linux.
- **macOS-only text.** All of it is comments and docs, none is a command: the header of `ci.yml`, release.yml lines 5-7, the "macOS keychain helper" comments at release.yml lines 98 and 137, the headers of `ci-postgres.sh` and `ci-docker-config.sh`, check-image.sh line 8, the risk-tier comment at line 27, and README lines 160-163 and 170.
- **Only compose path.** The one `/Users/` occurrence outside comments and tests is ci.yml line 96. The compose draft at `deploy/deployment-repo/apps/simap/compose.yml` line 28 is the text the check removes.

**2. These existing tests will break. They assert D60 literally and must be rewritten, not deleted.**
- **`scripts/ci-workflows.test.ts`**:
  - Line 36: the regex `runs-on: [self-hosted, macbook-runner]` and `not.toContain("ubuntu-latest")`.
  - Lines 111-119: the fork-guard regex requires the exact `if:` string in ci.yml twice.
- **`scripts/release-files.test.ts`**:
  - Line 65: `not.toMatch(/workflow_dispatch/)`.
  - Lines 115-119: `toContain("runs-on: [self-hosted, macbook-runner]")` and `not.toContain("ubuntu-latest")`.
- **What can stay.** `jobCount`, the `${{`-in-run-block checks and the push-trigger regex at line 64 still pass, as long as `workflow_dispatch:` comes after `push:` under `on:`.

**3. Dispatch runs are skipped by the existing job guards.** In ci.yml both jobs have `if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`. On a `workflow_dispatch` run both sides are false, so the jobs are skipped and the run looks green. You need `|| github.event_name == 'workflow_dispatch'`. This is safe: only users with write access can dispatch, and forks cannot. The release job has no `if:`, so it runs.

**4. Release on dispatch is safe to keep as is.** The guards check `GITHUB_REF_NAME` against `release/X.Y.Z`, then "on main", "not already tagged" and "higher than the last tag". A dispatch from `main` or any other ref fails at `guards`. A dispatch from a `release/X.Y.Z` branch works like a re-run, with the same checks. No change to the guards is needed.

**5. Concurrency and dispatch.** Even with `cancel-in-progress: false`, GitHub keeps only one *pending* run per concurrency group: a new pending run cancels the older one.
- **ci.yml.** The group is `ci-${{ github.ref }}`. A manual dispatch on `main` can cancel a queued push CI run on main, or be cancelled by one.
- **release.yml.** The group `release` already has this behaviour today.
- **Trade-off.** This is minor and it is the current behaviour, so the ticket can leave the groups alone (R4). If it should change, add the event name to the ci group (`ci-${{ github.event_name }}-${{ github.ref }}`). That costs a dispatch and a push on the same ref running in parallel.

**6. The `runs-on` expression from the ticket's technical notes is valid.**
- **Null input.** On push and pull_request, `inputs.runner` is null, so `||` falls through to `vars.SIMAP_RUNNER`. An unset variable is `''`, which gives `'ubuntu-latest'`.
- **Array result.** `fromJSON('["self-hosted","macbook-runner"]')` returning an array is accepted by `runs-on`.
- **No injection.** The value is never put into a shell, and anything other than the exact string `macbook` selects ubuntu.
- **Risk-tier.** It has no dispatch, so it should use `vars.SIMAP_RUNNER == 'macbook' && fromJSON(...) || 'ubuntu-latest'`. Using `inputs.runner` there would also work, but it is misleading.

**7. Security of running release on GitHub-hosted.** Overall this lowers risk.
- **Less exposure.** The VM is ephemeral, and the D60 exposure (branch code and `pnpm install` scripts running on the production host, which keeps `~/.docker` and `~/.config/simap`) disappears for runs on `github`.
- **Secrets.** `DOCKERHUB_*` and `DEPLOY_REPO_TOKEN` go to a GitHub-managed VM, which is the standard trust model.
- **Dispatch adds no new privilege.** A dispatch runs the workflow file from the chosen ref. A write-access user could already run any workflow content by pushing a `release/*` branch or opening a same-repo PR.
- **Isolation steps.** The isolated `DOCKER_CONFIG`, the header-based token with `credential.helper` cleared, and the cleanup do nothing harmful on ubuntu. Keeping them unconditional satisfies AC4 and keeps one code path.
- **Build cache.** It cannot be poisoned across refs: GHA cache reads are limited to the run's own ref and the default branch, so PR caches are not visible to `release/*` runs.

**8. Architecture and cache.**
- **Architecture.** `release` builds `platforms: linux/amd64`. On ubuntu (x64) this is native and faster; on the Mac it is emulated if the Mac is Apple Silicon. The CI `image` job builds the runner's native platform, so on ubuntu it now tests amd64, the architecture that is released. That is an improvement.
- **Cache.** Both workflows share `cache-to: type=gha,mode=max,scope=image`. Native arm64 CI builds on the Mac and amd64 builds on ubuntu or in release overwrite each other's cache index, so cache hits are poor. That is a performance problem, not a correctness one.

### Recommendations
- **R1 (AC1): one expression, the same text in every job.**
  - For ci and image: `runs-on: ${{ (inputs.runner || vars.SIMAP_RUNNER) == 'macbook' && fromJSON('["self-hosted","macbook-runner"]') || 'ubuntu-latest' }}`
  - For release: the same, with the existing `# D60` comment updated to D84.
  - For risk-tier: the `vars`-only form from Finding 6.
- **R2 (AC1 test).** There is no YAML library in `package.json`, and none should be added.
  - Extract each job's `runs-on:` line and assert it equals one of the two constants above.
  - Assert the count of these lines equals `jobCount`.
  - Add a small JS evaluator of the expression covering GitHub's `&&`/`||` operand-returning semantics, null and `''` as falsy. Use it to show: unset or `''` or `foo` gives `ubuntu-latest`; `macbook` gives the array; input `github` with var `macbook` gives `ubuntu-latest`; input `macbook` with var unset gives the array.
  - Also assert that no bare `runs-on: [self-hosted` line remains.
- **R3 (AC2): input shape.**
  - The input is `workflow_dispatch.inputs.runner` with `type: choice`.
  - My recommendation: options `default`, `github`, `macbook`, with default `default`. The expression becomes `((inputs.runner != 'default' && inputs.runner) || vars.SIMAP_RUNNER) == 'macbook' && ...`. On push, a null input still falls through to the variable.
  - The alternative is options `github`/`macbook` with default `github`. It is simpler, but then every manual run ignores the variable unless someone changes the default.
  - The ticket says "input wins", and either shape satisfies that. Ming picks (see Open questions).
  - Add the input to both `ci.yml` and `release.yml`.
  - In ci.yml, extend both job `if:`s with `|| github.event_name == 'workflow_dispatch'`.
  - Update the fork-guard test to the new exact string, still counted twice, and keep `risk-tier.yml` unchanged.
- **R4 (AC2 test, release).** Replace `not.toMatch(/workflow_dispatch/)` with three checks:
  - The triggers are exactly `push: branches ["release/[0-9]*"]` plus `workflow_dispatch` with only the `runner` input.
  - There are still no `pull_request` or `schedule` triggers.
  - The `guards` step still contains the `GITHUB_REF_NAME` regex and the `merge-base --is-ancestor` check. That covers AC4: a dispatch from a non-release ref fails before any side effect.
- **R5 (AC3): add a "runner-neutral" test next to "no GNU-only commands".**
  - In all three workflows and the three scripts, forbid `/Users/` except the single `prod=` line (the existing `toHaveLength(1)` already covers that).
  - Also forbid `brew`, `/opt/homebrew`, `osascript`, `launchctl`, `security `, `stat -f`, `date -j`, `sed -i ''`, `colima` and `.docker/run`.
  - Keep the GNU-only ban. Together the two bans define the portable subset.
- **R6 (AC4).** Keep `ci-docker-config.sh`, `docker logout` only for the isolated config, and the cleanup, all unconditional on both runners, with no `if: runner.os` branching. Change the comments from "macOS keychain" to "any host credential helper".
- **R7 (AC5).**
  - Rewrite README lines 160-163 and the release paragraph to cover: the variable, its default (GitHub-hosted), the manual run, that minutes count against the private repo, and that `macbook` jobs queue behind deploys. State that unset means GitHub-hosted.
  - Add `SIMAP_RUNNER (repository variable, optional)` where `work/ming-todo.md` M-2/M-6 lists the repo secrets, and to the release.yml header "Secrets in this repo" block as a "Variables" line.
  - Leave `.env.example` alone: this is not app config (R3).
- **R8 (scope).** Do not change the cache scopes or concurrency groups in this ticket. Record them as follow-ups: `scope=image-${{ runner.arch }}` or a separate scope for the release cache, and the dispatch concurrency group.

### Risks
- **High tier.** `release.yml` is a High path, so Ming must approve the plan.
- **Minutes quota (Medium).** With the default `github`, every same-repo PR uses about 2 jobs × 10-15 min plus risk-tier. When the private-repo quota runs out, jobs fail to start. The fix is to set `SIMAP_RUNNER=macbook`. Document this.
- **Mac offline (Low).** With `macbook` and the Mac offline, jobs queue for up to 24 h. There is no automatic fallback, by design: re-dispatch with `runner=github`. Pushes and PRs have no fallback.
- **Docker Hub pull limits (Low).** Anonymous pulls of `postgres:17` and the base images happen from shared GitHub IPs. Usually fine, but a limit hit would show as a flaky `start postgres` or `build`.
- **Disk space (Low).** ubuntu-latest has limited free disk; Next build plus image build plus Postgres should fit. Watch the first run.
- **D60 still applies on `macbook`.** Branch code still runs on the production host there. The fork settings Ming confirmed in M-76 still matter.
- **Silent green CI (Medium).** If the `if:` guard change is missed, a dispatched CI run is all-skipped and shows green. The R3 and R4 tests must catch this.

### Open questions (for Ming)
1. Input default: should a manual run with no choice follow `SIMAP_RUNNER` (my recommendation, option `default`) or always use `github`?
2. Should `release` be allowed to run on `github` at all, or should it require an explicit choice? D84 says it is included, and I see no security reason against it; this is just to confirm.
3. Should the ci concurrency group separate dispatch runs from push runs now, or later as a follow-up?
4. Is the Mac Apple Silicon? If yes, the cache-scope thrash in Finding 8 is real and the follow-up is worth doing.

Files reviewed (all under /home/user/simap):
- .github/workflows/ci.yml, release.yml, risk-tier.yml
- scripts/ci-postgres.sh, scripts/ci-docker-config.sh, scripts/check-image.sh
- scripts/ci-workflows.test.ts, scripts/release-files.test.ts
- work/decisions.md (D60 line 67, D84 line 91)
- README.md lines 148-181
- deploy/deployment-repo/apps/simap/compose.yml
