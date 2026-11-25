# SIM-034: Run simap's GitHub Actions on the Mac self-hosted runner

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | S |
| Areas | security, architecture |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | M-24 |
| Attempts | 1 |
| Created | 2026-11-23 |
| Claimed by | claude@2026-11-25T17:02:52Z |
| PR | — |

## Goal
simap's CI, risk-tier and release workflows run on the home server's self-hosted runner instead of GitHub-hosted runners, because the repo is private (D60).

## Scope reference
D60 (supersedes, for simap, "app code never runs on the home server"); D8 (deploy model); SIM-004 (image job, release).

## Scope
- `.github/workflows/ci.yml` (jobs `ci` and `image`), `.github/workflows/risk-tier.yml`, `.github/workflows/release.yml`: `runs-on: [self-hosted, macbook-runner]`.
- Make each job work on macOS: `services:` containers are not supported on macOS runners, so start Postgres per job with `docker run` (unique container name, a free host port, never the production Postgres or its port/network) and remove it in an `if: always()` step; replace GNU-only commands (e.g. `head -n -1` in risk-tier.yml); no `sudo` prompts (the `compose config` step writes under `/Users/mingming/.config/simap` today); check that Node 22/pnpm setup, buildx and the `type=gha` cache work there.
- Jobs must not touch the production compose projects, containers, volumes, networks or env files on the host (the deploy job uses project `simap` and `/Users/mingming/.config/simap/simap.env`).
- Update the release.yml header comment and README "Release and deploy" to say where it runs (D60).

## Out of scope
- Registering or configuring the runner (Ming, M-24). Other repos' workflows. Moving deploy-simap (already on macbook-runner).

## Acceptance criteria
- [ ] Every job in ci.yml, risk-tier.yml and release.yml uses `[self-hosted, macbook-runner]`.
- [ ] CI on a PR is green on the Mac runner: typecheck, layers, test, migrate CLI/smoke, schema check, `pnpm test:db`, format, build, image build + check-image, compose config.
- [ ] No step writes to or stops anything of the production stack (compose project `simap`, the shared Postgres, `/Users/mingming/.config/simap/simap.env`); test Postgres containers are always removed.
- [ ] No step needs `sudo` or interactive input.
- [ ] risk-tier labels a PR on the Mac runner.

## Technical notes
- Files: `.github/workflows/ci.yml`, `.github/workflows/risk-tier.yml`, `.github/workflows/release.yml` (High path), `README.md`, maybe a small `scripts/ci-postgres.sh`.
- Risks / open questions: the runner is the production host (D60 accepts this). Concurrent jobs on one runner run one at a time. If macbook-runner is registered only on mmlabs-online/deployment, simap cannot use it until M-24.

## Test plan
- Unit: none (workflow change).
- Manual: open the PR, watch every job run on macbook-runner and pass; after merge to main, ci runs on main; a later release/X.Y.Z push runs release on the Mac (Ming).

## Notes / answers from Ming
Waiting for Ming: plan approval (High tier) — M-74 (first filed as M-73; renumbered, that number went to SIM-039.8).
Plan approved (2026-11-26, Ming: "Duyệt, dùng mặc định" — Q1–Q7 take the plan's defaults).
- 2026-11-25: M-24 done (Ming: the runner is allowed for simap).
- 2026-11-23: run on the existing macbook-runner (not a separate runner instance), and move all workflows including release (D60).

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 2, tokens ~132k total (in/out split not reported): software-architect×1 61k (security area has no consultant), planner×1 71k; both on their default models.
- Done: M-24 confirmed by Ming (org runner MacBookPro shared with simap, labels self-hosted, X64, macOS, macbook-runner). Consult and plan (`Status: READY`, about 300-350 lines, no split). The plan touches High path `.github/workflows/release.yml`.
- In progress / next: Ming approves the plan (M-74) and answers Q1–Q7, or accepts their defaults; then `/run SIM-034` resumes at IMPLEMENT.
- Gotchas: today's `ci.yml` compose-config step uses `sudo tee /Users/mingming/.config/simap/simap.env` with project `-p simap`. On the Mac it would overwrite production's env file, so never point the current ci.yml at the self-hosted runner before this ticket lands. `check-image.sh` uses GNU `timeout` (missing on macOS) and `--network host` (means the Docker VM on Mac). `release-files.test.ts` asserts release stays on ubuntu-latest and must change.
