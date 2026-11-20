## Attempt 1 — 2026-11-20
Verdict: PASS

Condition: no Docker on the review device. AC1–AC3 are proved by the CI job `image` that the plan names as their
verification. This PASS holds only if that job (`build`, `check-image`, `compose config`) and the `ci` job (which runs the
3 envfile tests that skip on win32) are green on the PR. If either is red, the ticket goes back to REWORK and does not
merge. Risk tier computed by `.github/scripts/risk_tier.py`: **high**, so Ming reviews the PR.

### Checks (run by reviewer)
Worktree `ticket/SIM-004` at `3e6441c`, Windows, Node 24 (engine warning only; CI uses Node 22).
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 13 files, no violations"
- `pnpm test` — exit 0, "Test Files 8 passed (8) / Tests 58 passed | 3 skipped (61)". The 3 skipped tests are
  `deploy-envfile.test.ts › envfile step (real run block)` (skip on win32, as in tudocuatui). They run in CI on ubuntu.
- `pnpm build` — exit 0. `.next/standalone/server.js` is an ESM entry (`import ... createRequire`), standalone
  `package.json` has `"type": "module"`, and `node_modules/pg` plus `.pnpm/pg*` deps are traced into the standalone output.
- `bash -n scripts/check-image.sh` — ok. `Dockerfile` and `check-image.sh` are LF in the index.
- These match impl-log attempt 1.
- Not run here (pending CI): `docker build`, `scripts/check-image.sh`, `docker compose config`.

### Acceptance criteria
- [x] AC1 — image starts as non-root, `/api/healthz` 200 and `/api/readyz` 503 without a DB. **Pending CI `image` › check-image.**
  Static evidence: `Dockerfile:28` `USER node`; `Dockerfile:19` sets only `NODE_ENV`, `HOSTNAME=0.0.0.0` and `PORT=3000`; files are
  root-owned and only `.next/cache` is writable (`:27`). `check-image.sh:24-25` rejects a root user. `:31-48` checks Cmd, the
  exact env set, history and 3000/tcp. `:91-119` runs the smoke under `--network none --cap-drop ALL no-new-privileges`
  and checks healthz 200, readyz 503, `/` 200, one hashed asset 200, a missing asset 404 and HEALTHCHECK healthy.
  Local substitute (impl-log): the standalone server answered 200/503/200.
- [x] AC2 — `node db/migrate.js` in the image migrates and exits 0; the app never migrates. **Pending CI `image` › check-image (db smoke).**
  Static evidence: `Dockerfile:24-25` copies migrate.js, migrator.js and migrations. `check-image.sh:69` imports `pg` from `/app/db`
  (option A). `:81` expects exit 2 without DATABASE_URL. `:133-147` starts the app first on a fresh DB, checks readyz 200 and
  that `schema_migrations` is still absent. `:151-162` runs migrate (exit 0), checks the row count against the checkout's `*.sql`
  (0 is valid: `migrator.js:241` creates the table even with no files), then a second run must print `up to date`
  (`migrator.js:256`). Vitest `release-files.test.ts › only migrate runs db/migrate.js` passes (only one `command:` in compose).
- [x] AC3 — compose passes `docker compose config` with a dummy env file; no secret in the repo. **Pending CI `image` › compose config.**
  `ci.yml` step `compose config` runs with dummy `release.env` + host env file and asserts that the command fails
  without `--env-file`. Vitest `release-files.test.ts › compose.yml` (5 tests) passes: no `ports:`, no `postgres://`,
  env file outside the checkout. Repo values are dummy CI credentials only, the same as SIM-002's `ci.yml:40,47`.
- [x] AC4 — the release workflow builds and tags by version and digest, mirrors tudocuatui and does not deploy.
  `diff -u` against tudocuatui `release.yml` shows only these changes: names/paths, the dropped `VITE_APP_VERSION`
  build arg and `EXPECTED_VERSION`, the README anchor and the PR body (as the plan says). Vitest
  `release-files.test.ts › release.yml` (6 tests) passes.
- [x] AC5 — `work/ming-todo.md` lists the first-deploy steps: M-2 is extended (`http://simap:3000`), and M-6
  (Docker Hub + 3 secrets named only), M-7 (deployment setup PR) and M-8 (first release) are new. The README section
  "Release and deploy" links them. Numbers do not clash with `origin/main` (latest number there is M-5).

Deployment drafts: `deploy-simap.yml` diffed against tudocuatui `deploy-tudocuatui.yml`. Removed: Drive/AI_KEK secrets,
the TODO-operator guard and the "no migrate service" guard. The `backup → migrate → deploy` conditions now chain
on `outcome == 'success'` (implicit `success()` kept). The `notify` case drops the `skipped:success:` arm, which is
correct now that migrate always runs. Rollback and notify are otherwise unchanged. `compose.yml` matches the
tudocuatui compose minus `TUDO_*`/`x-owner-sub`, with `/api/readyz` and `start_period: 20s`.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1/R2/R6: no app code or migrations changed.
- R3: no env values in the image (checked by `check-image.sh:19-45`); `.dockerignore` drops `.env*`; secrets are
  named only.
- R4: all 13 changed files are in the plan's file list, and there are no out-of-plan files.
- R5: checks are green locally; the Docker part is pending CI as noted above.

### Blockers from review agents
None at the time of writing. `security-ai-generated-code-auditor` is triggered (`Dockerfile`, `.github/workflows/`), and the orchestrator copies its 🔴 findings here.

### Nits (do not block)
- `Dockerfile:31` HEALTHCHECK probes liveness (`/api/healthz`), while ticket scope says "healthcheck on readiness".
  This follows the approved plan and tudocuatui: the deployed compose healthcheck is `/api/readyz`, and the image
  healthcheck must turn healthy in the no-DB smoke.
- `check-image.sh:107` asset regex `[^"]+` could span text that has no quotes. It is fine for Next's HTML today.
- `db/migrations/README.md` is copied into the image (harmless; migrator reads `*.sql` only).
- The deployment-repo README `CODEOWNERS` owner `@didi-code0980` is an assumption carried over from tudocuatui (plan Q7).

### Follow-ups (out of scope)
- Debt issues from the plan (orchestrator): security headers / nonce CSP; self-host the Manrope font (build needs
  Google Fonts egress); rate-limit or cache the public `/api/readyz`; SHA-pin the Docker actions.
- Once SIM-005 reads `MM_IDENTITY_ISSUER`: add a 401 check for a guarded route to `check-image.sh`.
- When SIM-003 merges (`next/font/google`), the CI `image` build needs network (buildx default). Watch the first run.
