Status: READY

# Plan — BUG-006: CI `image` job always fails at `compose config` on the self-hosted runner (false positive on /Users/mingming)

## Scope summary
Scope reference is the bug report in ticket.md (no spec change):
- "Make the check match the production env path (e.g. `grep -qF /Users/mingming/.config/simap`) so it still fails if the replacement did not happen; update/add a static test in `scripts/ci-workflows.test.ts`."
- Out of scope: "Any other workflow change."

Root cause confirmed: `.github/workflows/ci.yml:101` runs `if grep -q /Users/mingming "$d/compose.yml"`. `$d` is `$RUNNER_TEMP/compose-ci` (ci.yml:95), and on the runner `RUNNER_TEMP=/Users/mingming/actions-runner/_work/_temp`. After the `sed` at ci.yml:99 the copy legitimately contains `/Users/mingming/actions-runner/_work/_temp/compose-ci/simap.env`, so the check fires. The check must match the production path `/Users/mingming/.config/simap`, not the home directory.

Constraint found while planning: the existing test `scripts/ci-workflows.test.ts:48-49` ("ci.yml never names production resources") requires exactly ONE occurrence of `/Users/mingming/.config/simap` in ci.yml (currently the sed on line 99). The ticket's suggested literal `grep -qF /Users/mingming/.config/simap` would make it two and break that test. So define the path once in a shell variable and use it in both `sed` and `grep`; the count stays 1. The line-49 assertion is kept unchanged.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Regression test reproduces the bug: fails on the current ci.yml, passes after the fix | `pnpm test scripts/ci-workflows.test.ts`: the new test `compose copy safety check matches the production env path, not the runner home` fails on `main` (run it with the ci.yml change stashed) and passes with the fix |
| 2 | The check still fails if the production env path is left in the copy | Same new test, second assertion block: the simulated copy that still contains the production path is matched by the check's pattern |
| 3 | `image` job's `compose config` step passes on the runner | The PR's CI run on MacBookPro (job `image`, step `compose config` green); not reproducible locally |
| 4 | All checks pass | `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm check:layers` (as listed in `.claude/loop.config.md` Checks) |

## Ming verification after merge
None (the PR's own CI run is the evidence for criterion 3).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `scripts/ci-workflows.test.ts` | Add the regression test (below) after the "ci.yml never names production resources" test (line 54) | Regression test first | No |
| `.github/workflows/ci.yml` | In step `compose config` (lines 90-108): add `prod=/Users/mingming/.config/simap` after line 95; line 99 `sed "s|$prod/simap.env|$d/simap.env|g" ...`; line 101 `if grep -qF "$prod" "$d/compose.yml"; then` | The fix | No |

High path check: `.claude/loop.config.md` High paths are `migrations/**`, `db/migrations/**`, `**/*.sql`, auth/config globs (`**/config.*`, `next.config.*`, `src/server/**/auth*`, `src/server/identity/**`, `src/server/http/**`, `src/middleware.*`, `src/proxy.*`, `scripts/check-layers.mjs`, `.env.example`), and `Dockerfile`, `.dockerignore`, `docker/**`, `deploy/**`, `.github/workflows/release*`, `.github/workflows/deploy*`, `.github/risk-tiers.yml`. Neither `.github/workflows/ci.yml` nor `scripts/ci-workflows.test.ts` matches. No High path is touched. Note: the `sed`/`grep` read `deploy/deployment-repo/apps/simap/compose.yml` but it is not modified. Risk: Low (diff well under 100 lines, so small-diff review applies).

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `scripts/ci-workflows.test.ts` › `compose copy safety check matches the production env path, not the runner home` (FIRST; must fail on current ci.yml) | Take `step(ci, "compose config")`. (a) Find the safety-check line: `const check = step.match(/^\s*if grep (\S+) (\S+) "\$d\/compose\.yml"; then$/m)`. (b) Resolve the pattern: read `prod=` from the step and substitute `$prod` into the pattern (if the pattern is a literal, use it as is). (c) Assert the pattern is NOT a prefix of the runner temp path: with `runnerCopy = "/Users/mingming/actions-runner/_work/_temp/compose-ci/simap.env"`, `expect(runnerCopy.includes(pattern)).toBe(false)` (fails today: pattern is `/Users/mingming`). (d) Assert the check still catches the production path: `expect("env_file: /Users/mingming/.config/simap/simap.env".includes(pattern)).toBe(true)`. (e) Assert the pattern equals `/Users/mingming/.config/simap`, so the sed target and the grep pattern cannot drift. |
| Existing `ci.yml never names production resources` (unchanged) | The literal production path still appears exactly once in ci.yml (guards against re-inlining it) |

Implementation note for the test: keep it a pure string check (no process spawn), consistent with the file's header ("static checks ... cannot run locally"). Keep line widths within oxfmt defaults.

## Approach
1. Write the new test; run `pnpm test scripts/ci-workflows.test.ts` and confirm it fails on the unmodified ci.yml for the right reason (step c). Record this in impl-log.md.
2. Edit ci.yml as specified (three lines in one step). Keep `-F` (fixed string, since `.` in the path is otherwise a regex wildcard) and quote `"$prod"`. Do not touch any other step (ticket: out of scope).
3. Re-run the test (passes), then `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm check:layers`.
4. Open the PR; the `image` job's `compose config` step must go green on MacBookPro. Rules: R4 (only the two files), R5 (checks green, new test added). R1-R3, R6, R7 are not affected (no app code, config values, or routes).

## Specialist input used
None (no consult files).

## Assumptions
- The step stays under `shell: bash` (ci.yml:91), so `prod=...` and `"$prod"` expand as expected and no `${{ }}` is introduced (test at line 107 stays green).
- Hotspots: `scripts/ci-workflows.test.ts` and `.github/workflows/ci.yml` are also edited by SIM-034's follow-ups; I did not find another open ticket (IN_PROGRESS/REVIEW/DONE) planned against them, but PR #110 is open on the same runner. If it touches these files, expect a trivial rebase.
- The root cause is confirmed from the ticket's CI log citation and the file lines above; I did not re-run CI.

## Blocking questions
None

## Split proposal
None
