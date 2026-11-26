# Implementation log — SIM-065

## Attempt 1
Files touched (all in plan):
- `.github/workflows/ci.yml`: dispatch input `runner`, D84 `runs-on` on both jobs, `if:` allows workflow_dispatch, neutral header. Required: AC1-3.
- `.github/workflows/release.yml` (High path): dispatch input, D84 `runs-on`, Variables block, neutral comments. Guards, docker config, cleanup unchanged. Required: AC1, AC2, AC4.
- `.github/workflows/risk-tier.yml`: vars-only D84 `runs-on`, neutral comments. Required: AC1, AC3.
- `scripts/ci-postgres.sh`, `scripts/ci-docker-config.sh`, `scripts/check-image.sh`: comment wording only.
- `scripts/ci-workflows.test.ts`, `scripts/release-files.test.ts`: tests per plan (expression evaluator, scenarios, dispatch input, fork-guard, runner-neutral, guard order, no runner.os).
- `README.md`, `docs/go-live.md`, `work/ming-todo.md` (M-6): `SIMAP_RUNNER` docs.

Tests added: see plan table (all listed tests written; old runs-on and trigger tests replaced).

Checks: `pnpm format:check`, `pnpm typecheck`, `pnpm check:layers`, `pnpm test` all exit 0. Test Files 347 passed | 1 skipped; Tests 3440 passed | 7 skipped. `pnpm build` not run (no app code changed).

Out-of-plan files: none.

Follow-ups:
- Per-arch build cache scope (arm64 Mac vs amd64 hosted/release overwrite gha cache index).
- Separate ci concurrency group for dispatch runs.
- Upstream runner selection in `risk-tier.yml` to spaceM project-kit.

Scope self-check: only plan files; steps and run bodies unchanged.
