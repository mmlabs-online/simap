## Attempt 1

## Security review: SIM-065 (runner choice for ci, image, risk-tier and release)

**Verdict: no blockers. I recommend one should-fix before PASS (finding 1).**

I had no Bash in this session, so I did not run `git diff origin/main...HEAD`. I read the final state of the changed files and compared it to plan.md:
- /home/user/simap/.github/workflows/ci.yml
- /home/user/simap/.github/workflows/release.yml
- /home/user/simap/.github/workflows/risk-tier.yml
- /home/user/simap/scripts/ci-docker-config.sh
- the README, docs/go-live.md and work/ming-todo.md lines that mention SIMAP_RUNNER

I did not run the checks or read the tests.

### Findings

**🟡 1. A release dispatch from a tag named `release/X.Y.Z` gets past the ref guard (release.yml:67; README.md:178-179)**
- **Evidence:** the guard tests `GITHUB_REF_NAME` against `^release/X.Y.Z$`. `GITHUB_REF_NAME` is the short ref name for tags too, so a dispatch on the tag ref `refs/tags/release/1.2.3` also matches. Before this change, the `push: branches:` filter only allowed branches. `workflow_dispatch` now accepts any ref.
- **Risk (low):** the ancestry check on main (line 61) still holds, so only reviewed code gets released, and only people with write access can dispatch. But README.md:179 says "a dispatch from any other branch fails at the guards", and the plan's AC4 guard test assumes the same. A non-branch ref is a way to cut a release that nobody intended.
- **Fix (one line, before line 67, inside the existing guards step, so still before any side effect):**
  ```bash
  if [ "$GITHUB_REF_TYPE" != branch ]; then echo "::error::release must run on a release/X.Y.Z branch, not $GITHUB_REF"; exit 1; fi
  ```
  Or match `"$GITHUB_REF"` against `^refs/heads/release/...$`. Add the assertion to the "guards still run first" test in scripts/release-files.test.ts.

**🟢 2. The runs-on expression cannot be injected (ci.yml:30, 72; release.yml:46; risk-tier.yml:21)**
- `inputs.runner` and `vars.SIMAP_RUNNER` are only compared with `== 'macbook'`. The result is always one of two fixed values: the `["self-hosted","macbook-runner"]` array or `'ubuntu-latest'`. A user value never becomes a runner label.
- On push and pull_request, `inputs.runner` is null, so the expression falls through to the variable, as intended.
- `inputs.*` does not appear in any `run:` body. In run blocks, untrusted values reach the shell only through `env:`, as before. Nothing to fix.

**🟢 3. Fork and PR guards are kept**
- ci.yml:32 and 74 add `|| github.event_name == 'workflow_dispatch'`. Only users with write access can dispatch, so this does not let fork code in.
- The same-repo check for pull_request is unchanged, and risk-tier.yml:22 is unchanged.
- No `pull_request_target` was added, and permissions stay `contents: read` (ci) and `pull-requests: write` (risk-tier). The M-76 org and repo settings (fork PR workflows off, runner group not public) are still what keeps fork code off the production runner.

**🟢 4. Running the workflow file from the dispatched branch is not new exposure, but release secrets are repo-wide**
- A dispatch runs the release.yml from the selected ref. A branch with an edited release.yml could skip the guards and read DOCKERHUB_TOKEN and DEPLOY_REPO_TOKEN. Anyone with write access could already do that by pushing a `release/*` branch, so this is not a new privilege.
- Suggested follow-up (out of scope): move the three release secrets into a GitHub Environment `release` with a deployment-branch rule `release/*` (optionally a required reviewer), and add `environment: release` to the job. That makes the guard a real control rather than one the workflow enforces on itself. It matters more now that the PAT also goes to GitHub-managed VMs (A2, accepted by Ming).

**🟢 5. Credential handling and cleanup stay the same on both runners**
- ci-docker-config.sh still writes an isolated `$RUNNER_TEMP/docker` with umask 077 and a placeholder `auths` entry so no host credential helper is picked up. It exports DOCKER_CONFIG and DOCKER_HOST, and the docker context works on ubuntu-latest too.
- Both git pushes still pass the token as an http header with `credential.helper` cleared (release.yml:110, 149). `persist-credentials: false` is set on every checkout.
- Cleanup keeps `if: always()`, logs out only from the isolated config (line 182), and removes the deployment clone (line 184).
- There is no `runner.os` branching, so the isolation runs unconditionally on both runners. The comment edits at lines 109, 148 and 173 are accurate.

**🟢 6. SIMAP_RUNNER is a preference, not a security control (README.md:160-166)**
- Leaving the variable unset does not keep jobs off the production Mac. Anyone with write access can still dispatch ci or release with `runner=macbook`, or change `runs-on` in a same-repo PR.
- Suggested addition to the README note (docs only): "to keep jobs off the Mac, remove the repo from the macbook-runner runner group".

**🟢 7. Build cache across PR, CI and release (ci.yml:95-96; release.yml:128-129)**
- `scope=image` is shared, but GitHub isolates caches by ref. A release on `release/X.Y.Z` reads only its own branch's cache and main's, never a PR's, so a PR cannot poison the release build. The arm64/amd64 thrash is already a follow-up in the plan (performance only).

### Follow-ups (out of scope)
- Put the release secrets in an Environment `release` with a `release/*` branch rule (finding 4).
- Add a README sentence that the runner group, not SIMAP_RUNNER, is what keeps jobs off the Mac (finding 6).
- Already in the plan: per-arch cache scope, a separate ci concurrency group for dispatch runs, and sending the risk-tier.yml runner change upstream to the kit.

## Attempt 2

## Security review: SIM-065, Attempt 2 (re-check of finding 1)

**Verdict: finding 1 is fixed and covered by a test. Nothing new found. No blockers.**

I read the files only. I did not run git diff or the checks.

### Findings

**🟢 1. Finding 1 from Attempt 1 is fixed: a release dispatched on a tag `release/X.Y.Z` now fails (/home/user/simap/.github/workflows/release.yml:61-63)**
- `if [ "$GITHUB_REF_TYPE" != branch ]; then echo "::error::..."; exit 1; fi` is the first statement in the `guards` step.
- It runs before the main-ancestry check (line 64) and the `GITHUB_REF_NAME` regex (line 70).
- `guards` is the first step after checkout. Docker config, login, tag creation, build and the deployment PR all come after it, so the check happens before any side effect.
- A dispatch on `refs/tags/release/1.2.3` has `GITHUB_REF_TYPE=tag`, so it now fails here.
- The error line only puts `$GITHUB_REF` in a quoted shell string, not a `${{ }}` expression. Git ref names cannot contain newlines, so a ref name cannot inject a workflow command.

**🟢 2. The test covers the fix (/home/user/simap/scripts/release-files.test.ts:89-91)**
- The test "guards still run first ... (dispatch-safe)" checks that `[ "$GITHUB_REF_TYPE" != branch ]` is in the guards step and comes before `git merge-base`.
- Lines 74-78 already check that guards is the first named step after checkout.
- Small gap, no action needed: the test matches the text of the condition but does not check that it is followed by `exit 1`. Like the other tests in this file, it only checks the YAML's structure.

**🟢 3. The docs now match the behaviour (/home/user/simap/README.md:179)**
- The README now says "a dispatch from a tag or from any branch that is not `release/X.Y.Z` fails at the guards". This fixes the wording problem I raised in Attempt 1.

**🟢 4. The change adds no new issue**
- The rest of the guards step is unchanged: ancestry, already-released, the version regex, tag existence, monotonic order, the `sort -V` sanity check and the secret-presence checks (release.yml:64-91).
- Permissions, triggers, the `runs-on` expression, credential handling and cleanup are the same as in Attempt 1. Findings 2, 3, 5, 6 and 7 from Attempt 1 still hold.

### Follow-ups (out of scope, carried over from Attempt 1)
- Move DOCKERHUB_USERNAME, DOCKERHUB_TOKEN and DEPLOY_REPO_TOKEN into a GitHub Environment `release` that only `release/*` branches can deploy to, and set `environment: release` on the job. Then a branch with an edited release.yml cannot skip the guards to read the secrets.
- Add a README note that removing the repo from the macbook-runner runner group is what keeps jobs off the Mac. Leaving SIMAP_RUNNER unset does not.

Files reviewed:
- /home/user/simap/.github/workflows/release.yml
- /home/user/simap/scripts/release-files.test.ts
- /home/user/simap/README.md
- /home/user/simap/work/tickets/SIM-065/security-review.md
