# BUG-006: CI `image` job always fails at `compose config` on the self-hosted runner (false positive on /Users/mingming)

| Field | Value |
|---|---|
| Type | bug |
| State | PLANNING |
| Severity | S2 |
| Priority | P1 |
| Size | XS |
| Areas | security |
| Gate | none |
| Found in | main after SIM-034 (#108); seen on PR #110, run 45671859789 (job `image`) |
| Introduced in | SIM-034 (#108) |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-25T18:26:06Z |
| PR | — |

## Report
Found by the orchestrator on the first full `image` job run on MacBookPro (PR #110, 2026-11-26). Ming: "làm tiếp" after the finding was reported.

## Environment
- Self-hosted runner `MacBookPro` (macOS x64, OrbStack). `RUNNER_TEMP=/Users/mingming/actions-runner/_work/_temp`.

## Steps to reproduce
1. Open any PR; let the `ci` workflow run on the runner.
2. Job `image`, step `compose config`.

## Expected
- The step passes: the temp copy of the compose file no longer names the production env file path.

## Actual
- `##[error]compose copy still names the production host path`, exit 1. The `image` job fails on every branch and on `main`.

## Root cause
**Confirmed** (CI log of run 45671859789). `.github/workflows/ci.yml:101` runs `grep -q /Users/mingming "$d/compose.yml"` as a safety check. `$d` is `$RUNNER_TEMP/compose-ci`, and on this runner `RUNNER_TEMP` lives under `/Users/mingming/actions-runner/...`. So after the `sed` replacement the copy legitimately contains `/Users/mingming/actions-runner/_work/_temp/compose-ci/simap.env`, and the check fires. It should look for the production path (`/Users/mingming/.config/simap`), not the home directory.

## Scope
- Make the check match the production env path (e.g. `grep -qF /Users/mingming/.config/simap`) so it still fails if the replacement did not happen; update/add a static test in `scripts/ci-workflows.test.ts`.

## Out of scope
- Any other workflow change.

## Acceptance criteria
- [ ] A regression test reproduces the bug: it fails on `main` before the fix and passes after (a static workflow test that the check does not match a `$RUNNER_TEMP` under the runner's home; name it).
- [ ] The check still fails if the production env path is left in the copy.
- [ ] The `image` job's `compose config` step passes on the runner (PR CI run).
- [ ] All checks pass.

## Technical notes
- Files: `.github/workflows/ci.yml` (not a High path), `scripts/ci-workflows.test.ts`.
- Test level: Vitest static test (text of the workflow); the real evidence is the PR's CI run on MacBookPro.

## Notes / answers from Ming

## Handoff
