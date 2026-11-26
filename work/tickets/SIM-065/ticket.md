# SIM-065: Choose GitHub-hosted or macbook runner for simap workflows

| Field | Value |
|---|---|
| State | BLOCKED |
| Priority | P2 |
| Size | S |
| Areas | architecture, security |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

## Goal
simap's CI, image, risk-tier and release jobs can run either on GitHub-hosted runners (`ubuntu-latest`) or on the
home server's `[self-hosted, macbook-runner]`, so work is not blocked when the Mac is offline or busy (D84, amends D60).

## Scope reference
`work/decisions.md` D84 (amends D60); `.github/workflows/ci.yml`, `release.yml`, `risk-tier.yml` (SIM-034, SIM-004).

## Scope
- A repository variable `SIMAP_RUNNER` (`github` or `macbook`) picks the runner for every job of `ci.yml`
  (`ci`, `image`), `risk-tier.yml` (`tier`) and `release.yml` (`release`). Unset or any other value = GitHub-hosted
  `ubuntu-latest`.
- `ci.yml` and `release.yml` get a `workflow_dispatch` input `runner` (`github` / `macbook`) that overrides the
  variable for that manual run.
- Every step works on both runners (Docker Postgres scripts, docker config, compose config check, `sort -V` guard,
  gh/python3 checks); macOS-only wording or assumptions are made runner-neutral.
- Document the variable and the manual run in README (CI / Release sections) and add the variable name to the
  places that list repo settings.

## Out of scope
- Changing what the jobs check or build; the deploy workflow in the deployment repo; fork PR policy (the
  same-repo guards stay).

## Acceptance criteria
- [ ] With `SIMAP_RUNNER` unset, all four jobs resolve `runs-on` to `ubuntu-latest`; with `macbook`, to
  `[self-hosted, macbook-runner]` (checked by a test that parses the workflow files).
- [ ] A manual `workflow_dispatch` run of `ci.yml` and `release.yml` can pick the runner with an input, which wins
  over the variable.
- [ ] Every step of the four jobs has no macOS-only command or path that would fail on `ubuntu-latest` (scripted
  check or test; the `/Users/...` production path stays only as the text the compose check must remove).
- [ ] The release job keeps its guards, isolated Docker config and cleanup on both runners.
- [ ] README explains `SIMAP_RUNNER`, its default and the manual run; existing workflow tests pass.

## Technical notes
- `runs-on` can take an expression returning a string or an array, e.g.
  `${{ (inputs.runner || vars.SIMAP_RUNNER) == 'macbook' && fromJSON('["self-hosted","macbook-runner"]') || 'ubuntu-latest' }}`.
- High path: `.github/workflows/release*`. GitHub-hosted minutes count against the private repo's quota.
- Existing tests: `scripts/ci-workflows.test.ts`, `scripts/release-files.test.ts`.

## Test plan
- Unit: workflow parsing tests for `runs-on` and dispatch inputs.
- Manual: Ming runs CI once with each runner value after merge.

## Notes / answers from Ming
- 2026-11-26: choose by repo variable plus manual run input; default (unset) is GitHub-hosted `ubuntu-latest`;
  release is included.

Waiting for Ming: plan approval (High tier)

## Handoff

### 2026-11-26 — claude — BLOCKED
- Agent calls: 2 (software-architect×1 53k, planner×1 57k; default models)
- Done: consult and plan (READY); plan gate (High path `.github/workflows/release.yml`); M-89 added.
- In progress / next: Ming approves the plan (A1–A4) → implement.
- Gotchas: ci.yml job `if:` guards must allow workflow_dispatch or a manual run shows green with all jobs skipped.
