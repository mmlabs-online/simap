# Security review — SIM-004

## Attempt 1 — security-ai-generated-code-auditor

**Scope:** `git diff origin/main...HEAD` on `ticket/SIM-004` (17 files). I read these security-relevant files in full: `.dockerignore`, `Dockerfile`, `.github/workflows/ci.yml` (job `image`), `.github/workflows/release.yml`, `deploy/deployment-repo/.github/workflows/deploy-simap.yml`, `deploy/deployment-repo/apps/simap/compose.yml`, `deploy/deployment-repo/README.md`, `scripts/check-image.sh`, `next.config.ts`, plus the README and `work/ming-todo.md` diffs. I diffed each one against the tudocuatui reference. The release workflow, deploy workflow and compose file are near-verbatim copies of the reference. The only changes are the app name and image name, removal of the Google Drive / AI_KEK / owner-sub handling (simap needs none of it), and an unconditional `migrate` path. Nothing in those changes adds a new attack surface. I read no `.env*` file. The audit is static only: I did not build the image or run any workflow.

**Verdict: no 🔴, no 🟡. PASS from the security side.** The notes below are optional hardening or follow-ups.

### Findings

**What I checked and found correct:**
- **Non-root image.** `USER node` (Dockerfile:28). App files stay root-owned, and only `.next/cache` is chowned to `node` (Dockerfile:27). `check-image.sh:24-25` fails if the image user is empty, 0 or root.
- **No secrets in image layers, env or build args.**
  - The image has no `ARG` at all.
  - `NEXT_TELEMETRY_DISABLED` is inline and never `ENV` (Dockerfile:15).
  - Runtime `ENV` is only `NODE_ENV`, `HOSTNAME` and `PORT`.
  - `check-image.sh` asserts the image env is exactly that set (`:36-41`), that no env name matches KEY/SECRET/TOKEN/PASSWORD (`:20-23`), that `DATABASE_URL` and a telemetry `ENV` are absent from `docker history` (`:42-45`), that there are no `.env*` files anywhere on the image filesystem (`:26-27`), and that there are no source maps (`:28-29`).
  - The release build gets no build-args and no secrets. `provenance` and `sbom` are off, so no build metadata leaks.
  - `next.config.ts` exposes no `NEXT_PUBLIC_*`.
- **`.dockerignore` coverage.** It excludes `.env*` and `**/.env*` (including `.env.example`, which is harmless), `.git`, `.github`, `.claude`, `work`, `docs`, `deploy`, `scripts`, tests, `node_modules`, `.next` and tsbuildinfo. The `.env*` file check in the image confirms the result.
- **GitHub Actions.**
  - **Permissions:** `ci.yml` is `contents: read`. `release.yml` has only `contents: write`, used for the tag push. The deploy workflow has `contents: write` and `pull-requests: write`, both used.
  - **No `pull_request_target`.**
  - **No script injection:** every `${{ }}` value reaches `run:` blocks through `env:`. `GITHUB_REF_NAME` must match a strict `^release/vX.Y.Z$` regex before it becomes `TAG`. The image ref read from `release.env` must match an anchored pattern with `@sha256:<64 hex>`.
  - **Tokens:** `persist-credentials: false` on the release checkout. Secrets go through `env` or `docker/login-action` only and are never echoed.
  - **Deploy job safety:** the self-hosted deploy job runs only on push to `main` or on dispatch, gated by `if: github.ref == 'refs/heads/main'`. No PR ever reaches the home-server runner.
- **Compose hardening.**
  - Both services have `cap_drop: [ALL]`, `no-new-privileges:true` and log rotation, and publish no ports.
  - `migrate` is only on the internal `db` network (no egress). The app is on `tunnel` and `db`.
  - `env_file` sits outside the checkout at an absolute host path.
  - The image is pinned by digest through the required `SIMAP_IMAGE`.
- **Deploy workflow writing the env file.**
  - `umask 077`, directory mode 700, and a check that the file is under `$HOME`.
  - The password format is validated, and `read -r` reads exactly one line, so a newline cannot inject a second env line.
  - The file is written with `printf` builtin, so the value is never in argv or echoed.
  - The file is written to a temp file and then moved into place, with `chmod 600` and a trap that cleans up on failure.
- **`check-image.sh` db smoke.** It never prints `CHECK_IMAGE_DATABASE_URL`, and container logs are filtered with `grep -v DATABASE_URL` (`:142`). The CI value is a throwaway service-container credential.

**💭 notes (optional; the tudocuatui reference behaves the same):**
1. 💭 **`deploy/deployment-repo/.github/workflows/deploy-simap.yml:87-91`: the password check and the password read can disagree.** `grep -Eq '^[A-Za-z0-9_-]{16,}$' "$pwfile"` passes if *any* line matches, but `read -r pw` takes the *first* line. In a hand-edited file whose first line is malformed, characters like `@`, `/` or `#` could reach `DATABASE_URL` unvalidated. Newline injection is still impossible. Fix: `read -r pw < "$pwfile"; [[ "$pw" =~ ^[A-Za-z0-9_-]{16,}$ ]] || { echo "::error::..."; exit 1; }`. Upstream the same fix to deploy-tudocuatui so the two files stay copies.
2. 💭 **`deploy/deployment-repo/apps/simap/compose.yml:239-279`: no read-only root filesystem or resource limits.** Possible hardening: `read_only: true` with `tmpfs: [/tmp, /app/.next/cache]`, plus `pids_limit` and `mem_limit`. This is defence in depth only; the files are already root-owned and the process is non-root.
3. 💭 **Actions are pinned by tag, not by commit SHA.** This covers `docker/setup-buildx-action@v3`, `docker/login-action@v3`, `docker/build-push-action@v6` and `pnpm/action-setup@v4` in `release.yml` and `ci.yml`. The release job holds `DOCKERHUB_TOKEN` (written to the runner's docker config) and `DEPLOY_REPO_TOKEN`, so a moved third-party tag could exfiltrate them. This applies to the whole workspace, not just this diff.
4. 💭 **Dockerfile:6,17: base image `node:22-bookworm-slim` is not pinned by digest.** Builds are therefore not reproducible. A tag-based base image is acceptable, given that each release is checked and then pinned by its own digest.
5. 💭 **Release trigger relies on policy only.** Anyone with write access can push `release/v*` (`release.yml:16-17`). The guards (commit must be on `main`, version must be new and higher) and the need for Ming to merge the deployment PR keep this low. A repository ruleset limiting creation of `release/*` to Ming would turn "agents never push `release/*`" from policy into an enforced rule.
6. 💭 **Context (existing design, not in this diff):** the deployment repo commits the Postgres app password in `postgres/secrets/apps/simap.password`, which the deploy draft reads. This is the established mmlabs pattern and is not a SIM-004 regression. Confidentiality depends entirely on access to the deployment repo.

### Follow-ups (out of scope for SIM-004)
- Workspace-wide: pin third-party actions by SHA in project-kit / tudocuatui / simap workflows (note 3). Candidate `debt` issue.
- Deployment repo: tighten the password check in both deploy-tudocuatui and deploy-simap (note 1), and consider `read_only` + `tmpfs` + limits for Node app compose files (note 2).
- simap repo settings: a ruleset restricting `release/*` branch creation to Ming (note 5). This is Ming's step; it could go into `work/ming-todo.md` alongside M-6.

No secret values were seen, printed or needed during this audit.
