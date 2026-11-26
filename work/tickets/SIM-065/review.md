## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (963 files)
- `pnpm typecheck && pnpm check:layers` — exit 0
- `pnpm test` — exit 0, Test Files 347 passed | 1 skipped (348); Tests 3440 passed | 7 skipped (3447). Matches impl-log.
- `pnpm build` — exit 0 (not run by the implementer; run here, green)
- `pnpm test:db` — CI-only, not applicable (no DB code changed)

### Acceptance criteria
- [x] Unset `SIMAP_RUNNER` → `ubuntu-latest`, `macbook` → `[self-hosted, macbook-runner]` for all four jobs — evidence:
  `.github/workflows/ci.yml:30,72`, `release.yml:46`, `risk-tier.yml:21`; `scripts/ci-workflows.test.ts` › "every job's
  runs-on is the D84 runner expression" and › "runs-on resolves per SIMAP_RUNNER and the dispatch input" (evaluator
  over the real expression text: null / '' / github / foo → ubuntu; macbook / MacBook → array) — pass.
- [x] Manual dispatch of ci.yml and release.yml picks the runner; input wins over the variable — evidence: dispatch
  blocks in `ci.yml:13-19`, `release.yml:25-31`; tests › "ci.yml and release.yml take a workflow_dispatch runner
  input", evaluator scenarios (github+macbook → ubuntu, macbook+unset → array, default follows var), › "PR-triggered
  jobs skip fork PRs; dispatch runs are not skipped" (both ci.yml `if:` allow `workflow_dispatch`, so a manual run is
  not silently green); `scripts/release-files.test.ts` › "triggers only on push to release/[0-9]* and
  workflow_dispatch with the runner input (D57, D84)" — pass. Real dispatch: Ming after merge.
- [x] No macOS-only command or path; `/Users/...` only on the compose-check `prod=` line — evidence: › "runner-neutral:
  no macOS-only commands or paths" (3 workflows + 3 CI scripts; exactly one `/Users/` line, in ci.yml). Reviewer read
  the steps: `ci-postgres.sh` (docker run/port/sed), `ci-docker-config.sh` (`docker context inspect`, `docker info`
  plugin paths), `sort -V`, `base64 | tr`, `gh`/`python3 -I` checks all work on ubuntu-latest — pass.
- [x] Release keeps guards, isolated Docker config and cleanup on both runners — evidence: release.yml diff touches no
  `run:` body (comments, trigger, runs-on only); existing release-files tests green plus › "guards still run first and
  check the ref and main ancestry (dispatch-safe)" and › "release steps are unconditional on runner (no runner.os
  branching)" — pass.
- [x] README explains `SIMAP_RUNNER`, its default and the manual run; existing workflow tests pass — evidence:
  `README.md` CI paragraph (lines ~160-169) and "Release and deploy" step 2; `docs/go-live.md:63`,
  `work/ming-todo.md` M-6 list the variable — pass.

Ming verification after merge (carry into the PR):
- Actions → ci → Run workflow with `runner=github` and with `runner=macbook`; both `ci` and `image` green on the
  expected runner (job log header).
- Same-repo PR with `SIMAP_RUNNER` unset → ci, image, risk-tier on GitHub-hosted; set `SIMAP_RUNNER=macbook`, push
  again → macbook-runner.
- Next real release (`release/X.Y.Z`) succeeds on the chosen runner; watch disk space and Docker Hub pull limits on
  the first hosted run.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. Scope (R4): every changed file is in the plan's file table; `work/decisions.md` (D84) and
`work/ming-todo.md` M-89 come from the ticket/plan-gate commits. High path `.github/workflows/release.yml` is named in
the plan and was approved by Ming (2026-11-26, M-89). R3: `SIMAP_RUNNER` is a GitHub repository variable, not app
config; no secret values anywhere. R5: new logic (runner expression) has tests; checks green.

### Blockers from review agents
<To be filled by the orchestrator from security-review.md (trigger: `.github/workflows/`).>

### Nits (do not block)
- `release.yml:109,148`: "any host credential helper never stores it" reads awkwardly; "no host credential helper
  stores it" is clearer.
- `scripts/ci-workflows.test.ts` `num`: both ternary branches call `Number(v)`; the `typeof v === "string"` branch is
  redundant.
- README release note: re-dispatch is safe only if the stuck run never started; a run that already pushed the tag
  would fail the "not higher than the latest release" guard. Worth one clause if it ever bites.

### Follow-ups (out of scope)
- Per-arch build cache scope (arm64 Mac vs amd64 hosted builds share gha scope `image`).
- Separate ci concurrency group for dispatch runs.
- Upstream runner selection in `risk-tier.yml` to spaceM project-kit.

## Attempt 2 — 2026-11-26
Verdict: PASS

Scope of this attempt: rework of security-review.md finding 🟡 1 (Ming, ticket Notes 2026-11-26 "sửa luôn trong PR này"),
commit 7f32594.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (979 files)
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 924 files, no violations"
- `pnpm test` — exit 0, Test Files 352 passed | 1 skipped (353); Tests 3472 passed | 7 skipped (3479). Matches impl-log attempt 2.
- `pnpm build` — exit 0
- `pnpm test:db` — CI-only, not applicable (no DB code changed)

### Acceptance criteria
- [x] Security finding 1: a dispatch on a tag `refs/tags/release/X.Y.Z` no longer passes the guards — evidence:
  `.github/workflows/release.yml:61-63` (`[ "$GITHUB_REF_TYPE" != branch ]` → `::error::` + exit 1) is the first command
  of the `guards` step, which is the first step after checkout, so it runs before any side effect and before the
  secrets are used. `GITHUB_REF_TYPE` is a default runner env var, `branch` on both `push` to `release/*` and a branch
  dispatch, so the normal path is unchanged. Test `scripts/release-files.test.ts` › "guards still run first and check
  the ref and main ancestry (dispatch-safe)" asserts the guard exists and precedes `git merge-base` — pass. Reviewer
  scripted check of the guard body: `GITHUB_REF_TYPE=branch` → exit 0, `GITHUB_REF_TYPE=tag` → "refused", exit 1.
- [x] README matches behaviour — `README.md:179` now says a dispatch from a tag or any non-`release/X.Y.Z` branch fails
  at the guards.
- [x] Attempt 1 criteria unchanged (only the lines above changed); all attempt 1 tests still green.

Ming verification after merge (carry into the PR): same list as attempt 1, plus optionally: Actions → release → Run
workflow on a tag ref fails at `guards` with "is not a branch" (only if a test tag exists; not required).

### Issues
None.

### Rules (CLAUDE.md)
No violations. R4: the rework touches only `release.yml` (High path, already approved in the plan), its test and the
README sentence, all plan files, limited to finding 1. R3: no secret values; error message prints only `$GITHUB_REF`.
R5: checks green, new guard has a test.

### Blockers from review agents
<To be filled by the orchestrator; security finding 1 is the item fixed here.>

### Nits (do not block)
- Attempt 1 nits still open (release.yml "any host credential helper never stores it" wording; redundant `num`
  branch in ci-workflows.test.ts); not part of this rework.

### Follow-ups (out of scope)
- From security review: release secrets in a GitHub Environment `release` with a `release/*` branch rule; README
  sentence that the runner group, not `SIMAP_RUNNER`, keeps jobs off the Mac.
- Attempt 1 follow-ups unchanged.

### Blockers from review agents
- None: security-review.md Attempt 2 has no 🔴 (finding 1 fixed).
