# Security review — SIM-034

## Attempt 1

**Security review: SIM-034, attempt 1. Verdict: REWORK (3 blockers)**

I read the three workflows, `scripts/ci-postgres.sh`, `scripts/ci-docker-config.sh`, `scripts/check-image.sh`, plan.md and impl-log.md. I ran nothing and could not run the workflows. The repo is private (ticket.md:18).

### Findings

**🔴 1. The isolated DOCKER_CONFIG still uses the macOS keychain, so Docker Hub credentials end up on the host and `docker logout` can wipe the host's login**
- **Where:** `scripts/ci-docker-config.sh:23`, `.github/workflows/release.yml:86-89`, `release.yml:161`
- **Risk:**
  - The script writes `{"cliPluginsExtraDirs":[...]}` with no `credsStore`, `credHelpers` or `auths`. When a config has none of these, the Docker CLI calls `credentials.DetectDefaultStore` (in docker/cli `LoadDefaultConfigFile`). On darwin that picks `osxkeychain` whenever `docker-credential-osxkeychain` is on PATH, and Docker Desktop installs it in `/usr/local/bin`.
  - So `docker/login-action` saves DOCKERHUB_TOKEN to the runner user's login keychain under `https://index.docker.io/v1/`. That is the same entry the host's own Docker login uses, so it overwrites it.
  - The cleanup's `docker logout` then deletes that shared entry. The persistent host keeps the token or loses its own login, which is the opposite of what plan.md:56 and :235 promise ("the keychain is never used").
- **Fix:**
  - Make the config contain auth so the CLI does not auto-detect a store, e.g. `printf '{"auths":{"ci.invalid":{}},"cliPluginsExtraDirs":[%s]}\n'`.
  - Add `umask 077` before `mkdir -p "$dir"`.
  - Add a test in `scripts/ci-workflows.test.ts` that asserts the `auths` placeholder is there.
  - Before the first release, Ming checks on the host: `which docker-credential-osxkeychain`. Then, after a manual `DOCKER_CONFIG=<tmp> docker login` with the current script, look at whether `<tmp>/config.json` gained `"credsStore"`.
- **Confidence:** high on the CLI behaviour; the binary being on PATH depends on the Docker runtime (Q1 took the default).

**🔴 2. git's osxkeychain helper can permanently save DEPLOY_REPO_TOKEN (a long-lived PAT) on the production host**
- **Where:** `release.yml:133` (clone), `release.yml:150` (push), and `release.yml:99` (tag push with GITHUB_TOKEN)
- **Risk:**
  - Apple's Command Line Tools git and Homebrew git both set `credential.helper=osxkeychain` in their system gitconfig.
  - When the URL carries `user:token` and auth succeeds, git calls `credential approve`, which stores the pair in the helper.
  - Clone and push both use `x-access-token@github.com`, so the deploy PAT is what's left in the login keychain.
  - After that, any later job on this org-level runner (a collaborator's PR, the `pnpm install` scripts D60 accepts, or another org repo using the Default group) can read it with `printf 'protocol=https\nhost=github.com\n' | git credential fill`.
  - `remote set-url` (line 135) and the `rm -rf` cleanup do not touch the keychain. This contradicts plan.md:181 ("The token never stays on disk").
- **Fix:**
  - Run every token-bearing git command with helpers turned off: `git -c credential.helper= clone ...` and `git -c credential.helper= push ...` on lines 99, 133 and 150.
  - Better still, keep the token out of the URL and argv by sending it as a header: `GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0= GIT_CONFIG_KEY_1=http.https://github.com/.extraheader GIT_CONFIG_VALUE_1="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64)"`.
  - Add a test in `release-files.test.ts` that every `x-access-token` or git network line disables `credential.helper`.
  - After the first release, Ming checks: `security find-internet-password -s github.com -a x-access-token` should find nothing.

**🔴 3. When an early step fails, the release cleanup runs `docker logout` against the host's real `~/.docker`**
- **Where:** `release.yml:156-163`, together with `release.yml:43-80`
- **Risk:**
  - `DOCKER_CONFIG` reaches later steps only through `$GITHUB_ENV`, which the `docker config` step writes.
  - If `guards` fails (not on main, tag already exists, bad branch name, empty secret, all realistic) or `ci-docker-config.sh` fails, the `if: always()` cleanup still runs.
  - `docker logout` then hits the host's default config or credential store and removes production's Docker Hub login, breaking AC3 and the plan's check that `~/.docker/config.json` is unchanged.
- **Fix:** only log out from the isolated config:
  ```bash
  if [ "${DOCKER_CONFIG:-}" = "$RUNNER_TEMP/docker" ]; then docker logout || true; fi
  ```
  Add a test asserting the guard is there.

**🟡 4. The cleanup deletes the buildx state before setup-buildx-action's post step can remove its builder, so a BuildKit container leaks on the production daemon every run**
- **Where:** `ci.yml:114` and `release.yml:163` (`rm -rf "$RUNNER_TEMP/docker"`), with `ci.yml:76` and `release.yml:82`
- **Risk:**
  - setup-buildx-action creates a `docker-container` builder. It records the instance under `$DOCKER_CONFIG/buildx` and installs the pinned buildx under `$DOCKER_CONFIG/cli-plugins`. Its post step, which runs after all main steps including the cleanup, calls `docker buildx rm`.
  - With that directory already gone, the removal fails. A `buildx_buildkit_builder-*` container and its `_state` volume (holding build cache) stay running on the production daemon each run.
  - The sweep cannot catch them because they have no `simap-ci` label. Over time this eats Docker VM memory and disk (Q5).
- **Fix:**
  - Give the step `id: buildx` and pass `BUILDER: ${{ steps.buildx.outputs.name }}` through `env:`.
  - In the cleanup, run `[ -n "$BUILDER" ] && docker buildx rm "$BUILDER" || true` before the `rm -rf`.
  - Also verify on the host after the PR run: `docker ps -a --filter name=buildx_buildkit`.

**🟡 5. check-image containers are not labelled, so the sweep cannot remove leftovers**
- **Where:** `scripts/check-image.sh:20, 83, 105, 151`
- **Risk:**
  - `simap-smoke-$$`, `simap-dbsmoke-$$` and `simap-exit-$$` rely only on the `EXIT` trap. If the runner hard-kills the step (job timeout, host restart), the trap may not run.
  - Then `simap-dbsmoke-*` stays attached to `simap-ci-net-*`. The sweep cannot remove that network while the container is attached, and it never removes the unlabelled container.
- **Fix:**
  - Add `--label simap-ci=1` to the three `docker run` calls. Release does not run the sweep, so the label is harmless there.
  - Optionally also add `trap ... INT TERM`.

**🟡 6. Fork guards are good practice but are not the control that stops fork PRs**
- **Where:** `ci.yml:23, 65`, `risk-tier.yml:22`
- **Risk:** `pull_request` workflows run the YAML from the PR's merge commit, so a fork PR can simply delete the `if:`. What actually stops fork code on this host is that the repo is private and fork PR workflows are off.
- **Fix:** Ming confirms these settings (add to ming-todo):
  - Repo Settings > Actions, "Run workflows from fork pull requests" is unchecked.
  - Org runner group Default has "Allow public repositories" off.
  - Ideally, the runner group is limited to the repos that need it.

**🟢 Passes**
- **Script injection:** no `${{ }}` inside any `run:` block. Untrusted or ref values go through `env:`: `BASE_REF`, `PR`, `TIER`, `TAG`, `DIGEST`. `GITHUB_REF_NAME` is checked against a regex before use (`release.yml:56`). `${{ github.run_id }}` appears only in `with:` (`ci.yml:85`).
- **persist-credentials:** set to false on all checkouts (`ci.yml:27, 69`, `risk-tier.yml:33`, `release.yml:41`).
- **Permissions:** minimal (`ci.yml:12-13` read; `risk-tier.yml:11-13`; `release.yml:22-23` contents: write for the tag only). Secrets are referenced only in release.yml.
- **No sudo:** no `sudo` anywhere.
- **Production isolation:**
  - No prune.
  - The compose check uses `-p simap-ci` on a temp copy with dummy env files, and asserts that `/Users/mingming` is gone (`ci.yml:95-108`).
  - Postgres runs on `127.0.0.1::5432` with an ephemeral port that refuses 5432/15432, a tmpfs data dir, `rm -f -v`, and `--internal` networks.
  - The `PG*`/`DATABASE_URL`/`SIMAP_*` env guard fails closed (`ci-postgres.sh:55-65`).
  - The sweep only removes resources labelled `simap-ci=1` (`ci-postgres.sh:19-32`).
- **Cleanup on failure or cancel:** `if: always()` cleanup on all three jobs (`ci.yml:54-56, 109-114`, `release.yml:156-163`).
- **Release clone:** lives in `$RUNNER_TEMP`, and the remote is reset to a token-free URL (`release.yml:133-135`).
- **Timeouts:** every job has `timeout-minutes`.
- **Release order:** login comes before the tag reservation.

### Notes (accepted under D60, no change needed in this ticket)
- 💭 Code from a collaborator's PR runs as the runner user on the production host. It can read `~/.config/simap/simap.env`, plant files in `~/.docker/cli-plugins` (the isolated config still lists host plugin directories through `cliPluginsExtraDirs`), poison the shared pnpm store, or leave processes behind that are not tracked by the runner. Fixes 1 and 2 matter because they remove what such code could steal later.
- 💭 Tokens embedded in URLs are briefly visible to same-user processes through `ps`. The extraheader-via-env option in fix 2 also removes this.
- 💭 check-image's root and layout `docker run`s (lines 31-74) use the default bridge network rather than `--network none`. The same PR code already runs directly on the host, so this adds little exposure.

### Follow-ups (out of scope)
- Move DOCKERHUB_* and DEPLOY_REPO_TOKEN into a GitHub Environment (e.g. `release`, deployment branches `release/*`). Add a ruleset so only Ming can create `release/*` branches. Today any same-repo PR workflow can reference the repository secrets.
- Run the runner as its own macOS user, with no read access to `~/.config/simap` or Ming's keychain or `~/.docker`. That is the real isolation boundary on this host.
- Add the credential-helper and keychain checks above to the plan's "Ming verification after merge".
