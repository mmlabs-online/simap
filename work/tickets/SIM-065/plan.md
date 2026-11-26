Status: READY

# Plan — SIM-065: Choose GitHub-hosted or macbook runner for simap workflows

## Scope summary
- `work/decisions.md` D84 (line 91): "simap's workflows (ci: ci + image, risk-tier, release) can run on GitHub-hosted
  `ubuntu-latest` or on `[self-hosted, macbook-runner]`. A repository variable `SIMAP_RUNNER` (`github` / `macbook`)
  picks the runner; unset = GitHub-hosted. `ci.yml` and `release.yml` also take a manual-run input that overrides it.
  Amends D60 (macbook only)."
- Ticket scope: "A repository variable `SIMAP_RUNNER` (`github` or `macbook`) picks the runner for every job of
  `ci.yml` (`ci`, `image`), `risk-tier.yml` (`tier`) and `release.yml` (`release`). Unset or any other value =
  GitHub-hosted `ubuntu-latest`." / "`ci.yml` and `release.yml` get a `workflow_dispatch` input `runner` (`github` /
  `macbook`) that overrides the variable for that manual run." / "Every step works on both runners [...]; macOS-only
  wording or assumptions are made runner-neutral." / "Document the variable and the manual run in README (CI / Release
  sections) and add the variable name to the places that list repo settings."
- Ming 2026-11-26: "choose by repo variable plus manual run input; default (unset) is GitHub-hosted `ubuntu-latest`;
  release is included."
- Out of scope (ticket): what the jobs check or build; the deploy workflow in the deployment repo
  (`deploy/deployment-repo/.github/workflows/deploy-simap.yml` stays on macbook-runner); fork PR policy (same-repo
  guards stay).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | `SIMAP_RUNNER` unset → all four jobs `ubuntu-latest`; `macbook` → `[self-hosted, macbook-runner]` (test parses the workflow files) | `pnpm test` → `scripts/ci-workflows.test.ts` › "every job's runs-on is the D84 runner expression" and › "runs-on resolves per SIMAP_RUNNER and the dispatch input" (scenario table below). Reviewer also reads the four `runs-on:` lines. |
| 2 | Manual `workflow_dispatch` of `ci.yml` and `release.yml` can pick the runner with an input that wins over the variable | `scripts/ci-workflows.test.ts` › "ci.yml and release.yml take a workflow_dispatch runner input" and the evaluator scenarios (input `github` + var `macbook` → ubuntu; input `macbook` + var unset → macbook; input `default` → follows var); › "PR-triggered jobs skip fork PRs; dispatch runs are not skipped" (both ci.yml job `if:`s include `github.event_name == 'workflow_dispatch'`). `scripts/release-files.test.ts` › "triggers only on push to release/[0-9]* and workflow_dispatch with the runner input (D57, D84)". Real dispatch: Ming after merge. |
| 3 | No macOS-only command or path in any step of the four jobs (the `/Users/...` prod path stays only as the text the compose check removes) | `scripts/ci-workflows.test.ts` › "runner-neutral: no macOS-only commands or paths" (+ existing "no GNU-only commands" and "ci.yml never names production resources" with `toHaveLength(1)`). Reviewer greps the six files for `macOS` and finds only neutral wording. |
| 4 | Release keeps its guards, isolated Docker config and cleanup on both runners | Existing `scripts/release-files.test.ts` tests stay green unchanged (guards regex, token header, `docker logout` only for isolated config, cleanup `if: always()`), plus new › "guards still run first and check the ref and main ancestry (dispatch-safe)" and › "release steps are unconditional on runner (no runner.os branching)". |
| 5 | README explains `SIMAP_RUNNER`, its default and the manual run; existing workflow tests pass | Reviewer reads README "Production image" CI paragraph and "Release and deploy"; `pnpm test` green; `pnpm format:check` green. |

## Ming verification after merge
- Run `ci` once via Actions → ci → Run workflow with `runner=github` and once with `runner=macbook` (and once with
  `default` after setting the variable, if desired); both jobs (`ci`, `image`) run green and the job log header shows
  the expected runner.
- Open a same-repo PR with `SIMAP_RUNNER` unset: `ci`, `image` and `risk-tier` run on GitHub-hosted; then set
  `SIMAP_RUNNER=macbook` and push again: they run on macbook-runner.
- The next real release (push `release/X.Y.Z`) succeeds on the chosen runner (unset = GitHub-hosted). Watch disk space
  and Docker Hub pull limits on the first hosted run.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `.github/workflows/ci.yml` | Add `workflow_dispatch.inputs.runner` (choice `default`/`github`/`macbook`, default `default`) after `push:`; lines 21 and 63 `runs-on:` → D84 expression (dispatch form); lines 23 and 65 `if:` add `\|\| github.event_name == 'workflow_dispatch'`; header comment lines 3-5 runner-neutral (D84). Steps unchanged. | AC1, AC2, AC3 | No (security review triggers on `.github/workflows/`) |
| `.github/workflows/release.yml` | Add `workflow_dispatch` with the same `runner` input after `push:` (lines 18-20); line 35 `runs-on:` → D84 expression with `# D84` comment; header lines 5-7 runner-neutral, add a "Variables in this repo: SIMAP_RUNNER (optional; unset = GitHub-hosted)" block after the secrets block (lines 11-14); comments at lines 98, 137 ("macOS keychain helper" → "any host credential helper"), 162 ("The runner is the production host" → "On macbook-runner this is the production host; on GitHub-hosted it is ephemeral"). Guards, docker config, login, cleanup unchanged. | AC1, AC2, AC4, AC5 | **Yes** (`.github/workflows/release*`) |
| `.github/workflows/risk-tier.yml` | Line 21 `runs-on:` → vars-only D84 expression; header line 4 and comment line 27 runner-neutral. No dispatch input. | AC1, AC3 | No (kit-managed, see Assumptions A6) |
| `scripts/ci-postgres.sh` | Header line 2: "self-hosted macOS runner" → "either runner (D84); the self-hosted one has no `services:`". Comment only. | AC3 wording | No |
| `scripts/ci-docker-config.sh` | Header lines 2-4: "macOS keychain" → "any host credential helper (osxkeychain, pass, secretservice)". Comment only. | AC3 wording, AC4 | No |
| `scripts/check-image.sh` | Comment lines 8 and 82: neutral wording ("Docker Desktop on macOS: `host` is the VM"; "portable 30 s cap, BSD and GNU"). Comment only. | AC3 wording | No |
| `scripts/ci-workflows.test.ts` | Replace test at lines 34-40; update fork-guard test lines 111-119; add expression evaluator, scenario test, dispatch-input test, runner-neutral test; rename keychain test title (line 142); header comment lines 2-3 (D84). | AC1-AC3 | No |
| `scripts/release-files.test.ts` | Replace trigger test lines 63-66 and runs-on assertions lines 115-119; add guard-order and no-runner.os tests. | AC2, AC4 | No |
| `README.md` | Rewrite lines 160-163 (CI runner paragraph) and line 170-171 of "Release and deploy" step 2; add a short "Manual run / runner choice" note under Release. | AC5 | No |
| `docs/go-live.md` | Line 63: add "optional repository variable `SIMAP_RUNNER` (`github`/`macbook`, unset = GitHub-hosted)". | Scope: places that list repo settings | No |
| `work/ming-todo.md` | M-6 line 30: append the optional `SIMAP_RUNNER` variable after the secret list (text only, no new M-item). | Scope: places that list repo settings | No |

## Data model / migration
None.

## API contract
None.

## Tests to write
Expression constants (exact text, used in the workflows and asserted by the tests):
- `RUNS_ON_DISPATCH` (ci, image, release):
  `${{ ((inputs.runner != 'default' && inputs.runner) || vars.SIMAP_RUNNER) == 'macbook' && fromJSON('["self-hosted","macbook-runner"]') || 'ubuntu-latest' }}`
- `RUNS_ON_VARS` (tier):
  `${{ vars.SIMAP_RUNNER == 'macbook' && fromJSON('["self-hosted","macbook-runner"]') || 'ubuntu-latest' }}`

| Test (file › name) | Covers |
|---|---|
| `scripts/ci-workflows.test.ts` › "every job's runs-on is the D84 runner expression" | For each workflow, `^ {4}runs-on: (.+)$` lines count equals `jobCount(s)`; ci.yml and release.yml lines equal `RUNS_ON_DISPATCH`, risk-tier.yml equals `RUNS_ON_VARS`; no line matches `^ {4}runs-on: \[self-hosted` (AC1) |
| `scripts/ci-workflows.test.ts` › "runs-on resolves per SIMAP_RUNNER and the dispatch input" | A small evaluator (in the test file, ~60-80 lines) for the subset `( ) && \|\| == !=`, single-quoted strings, `inputs.runner`, `vars.SIMAP_RUNNER`, `fromJSON('<json>')`, with GitHub semantics: `&&`/`\|\|` return operands; falsy = `null`, `''`, `false`, `0`, `NaN`; `==`/`!=` case-insensitive for two strings, otherwise both coerced to number (`null`→0, `''`→0, other strings `Number()` or NaN; NaN never equal). Applied to the expression text extracted from each job. Scenarios (no event input = `inputs.runner` null): var unset/`''`/`github`/`foo` → `'ubuntu-latest'`; var `macbook` → `["self-hosted","macbook-runner"]`; dispatch jobs only: input `github` + var `macbook` → ubuntu; input `macbook` + var unset → array; input `default` + var `macbook` → array; input `default` + var unset → ubuntu (AC1, AC2) |
| `scripts/ci-workflows.test.ts` › "ci.yml and release.yml take a workflow_dispatch runner input" | Both contain under `on:` a `workflow_dispatch:` block with `inputs:` → `runner:` → `type: choice`, `options:` exactly `default`, `github`, `macbook`, `default: default`; risk-tier.yml has no `workflow_dispatch` (AC2) |
| `scripts/ci-workflows.test.ts` › "PR-triggered jobs skip fork PRs; dispatch runs are not skipped" (rewrite of lines 111-119) | ci.yml has exactly 2 `if: github.event_name == 'push' \|\| github.event_name == 'workflow_dispatch' \|\| github.event.pull_request.head.repo.full_name == github.repository`; risk-tier unchanged guard (AC2; catches the silent-green risk) |
| `scripts/ci-workflows.test.ts` › "runner-neutral: no macOS-only commands or paths" | In the 3 workflows + 3 CI scripts: no match for `/\bbrew\b\|\/opt\/homebrew\|osascript\|launchctl\|\bsecurity (find\|add\|delete\|unlock)-\|stat -f\|date -j\|sed -i ''\|colima\|\.docker\/run/`; `/Users/` occurs only in ci.yml and only on the single `prod=` line (check every `/Users/` occurrence across `all` is that one line) (AC3). Note: plain `\bsecurity ` is not usable: check-image.sh line 128 says "security headers". |
| `scripts/ci-workflows.test.ts` › existing "no GNU-only commands", "ci.yml never names production resources", "compose copy safety check…" | Kept as-is: together with the macOS ban they define the portable subset (AC3) |
| `scripts/release-files.test.ts` › "triggers only on push to release/[0-9]* and workflow_dispatch with the runner input (D57, D84)" (replaces lines 63-66) | Keep the push regex of line 64; `on:` block (text between `^on:` and the next top-level key) has exactly two event keys `push` and `workflow_dispatch`; the only input is `runner`; still no `pull_request` / `schedule` (AC2) |
| `scripts/release-files.test.ts` › "guards still run first and check the ref and main ancestry (dispatch-safe)" | `- name: guards` is the first step after checkout; it contains `git merge-base --is-ancestor "$GITHUB_SHA" origin/main` and the `GITHUB_REF_NAME` regex, both before `echo "tag=` (a dispatch from a non-release ref fails before any side effect) (AC4) |
| `scripts/release-files.test.ts` › "deploys nothing itself: runner from D84, no docker compose, no ssh" (replaces lines 115-119) | `runs-on:` equals `RUNS_ON_DISPATCH`; still no `docker compose` / `ssh` (AC1, AC4) |
| `scripts/release-files.test.ts` › "release steps are unconditional on runner (no runner.os branching)" | release.yml and ci.yml contain no `runner.os` / `RUNNER_OS`; the `docker config`, `cleanup` steps exist; cleanup keeps `if: always()` (AC4) |

Domain focus (`loop.config.md`): empty/null fields are the relevant edge here, covered by the `null` input and `''`
variable scenarios. Diacritics, dates and pagination do not apply.

## Approach
1. ci.yml: insert after `push:` (keep `pull_request` and `push` text and order unchanged so other regexes still pass):
   ```yaml
     workflow_dispatch:
       inputs:
         runner:
           description: "Runner for this run: default follows the SIMAP_RUNNER variable (D84)"
           type: choice
           options: [default, github, macbook]
           default: default
   ```
   Write `options:` as a block list or flow list consistently in both files; the test accepts the chosen form (pick
   flow `[default, github, macbook]`). Replace both `runs-on:` with `RUNS_ON_DISPATCH`; extend both `if:` as in the
   test. Leave `concurrency` unchanged (A4). Header comment: jobs run on GitHub-hosted `ubuntu-latest` by default or
   on macbook-runner when `SIMAP_RUNNER=macbook` / dispatch input (D84, amends D60); keep the "never touches the
   production compose project" sentence; "Jobs queue behind one runner" becomes "On macbook-runner jobs queue behind
   deploys".
2. release.yml: add the same `workflow_dispatch` block after the `push` branches line; `runs-on: RUNS_ON_DISPATCH # D84
   (amends D60): SIMAP_RUNNER or the dispatch input; default GitHub-hosted`. Comments per the files table. Do not
   touch any `run:` body, guard, env, cache or concurrency setting. No `${{` enters a run block (the existing test
   keeps guarding this; the input is only used in `runs-on`).
3. risk-tier.yml: `runs-on: RUNS_ON_VARS # D84`; header line 4 → "SIM-034 (D60), SIM-065 (D84): local edit of a
   kit-managed file: runner from SIMAP_RUNNER, portable sed, fork guard."; line 27 → "Non-interactive check: some
   hosts ship a python3 stub that prompts or fails late (macOS Command Line Tools)." (wording is fine as long as it is
   a comment; the AC is about commands).
4. Script header comments (comment-only edits).
5. Tests per the table. Put `RUNS_ON_DISPATCH`/`RUNS_ON_VARS` and the evaluator in `scripts/ci-workflows.test.ts`;
   `release-files.test.ts` asserts the literal string (duplicate the constant; do not create a shared module, keeps
   the file list small). The evaluator throws on any token it does not know, so a later change to the expression
   fails loudly instead of being mis-evaluated.
6. README lines 160-163: CI runs on every same-repo PR; runner choice: repository variable `SIMAP_RUNNER`
   (`macbook` → `[self-hosted, macbook-runner]`, unset or anything else → GitHub-hosted `ubuntu-latest`, D84);
   GitHub-hosted minutes count against the private repo's quota (if it runs out, jobs fail to start: set
   `SIMAP_RUNNER=macbook`); on macbook-runner jobs queue behind deploys and wait if the Mac is offline (no automatic
   fallback: cancel and re-run manually with `runner=github`); manual run: Actions → ci → Run workflow, `runner`
   = `default` / `github` / `macbook`. CI's throwaway Postgres sentence stays. Release step 2: replace "It runs on the
   home server's runner (D60)" with "It runs on the runner chosen by `SIMAP_RUNNER` (D84)", keep the isolated Docker
   config/cleanup sentence; add: if the run is stuck in the queue (Mac offline), cancel it and use Actions → release →
   Run workflow on the `release/X.Y.Z` branch with `runner=github`; a dispatch from any other branch fails at the
   guards.
7. docs/go-live.md line 63 and work/ming-todo.md line 30: add the optional variable.
8. Run Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

CLAUDE.md rules: R3 (config from env only) is not touched: `SIMAP_RUNNER` is a GitHub repository variable, not app
config, so `.env.example` stays unchanged. R4: no cache/concurrency/deploy changes (follow-ups below). R5: tests
above. R1/R2/R6/R7 not affected. Stack unchanged.

Follow-ups (record in impl-log, do not implement):
- Per-arch build cache scope (`scope=image-${{ runner.arch }}` or a separate release scope): arm64 Mac CI builds and
  amd64 hosted/release builds overwrite each other's gha cache index (consult Finding 8).
- Separate ci concurrency group for dispatch runs (`ci-${{ github.event_name }}-${{ github.ref }}`) (consult Finding 5).
- Upstream to spaceM project-kit: runner selection in `risk-tier.yml` (kit-managed file).

## Specialist input used
`consult-software-architect.md`:
- Finding 1 (nothing breaks on ubuntu-latest; only comments/docs are macOS-specific): adopted; steps stay unchanged,
  only wording edits.
- Finding 2 (tests that must be rewritten): adopted, exact lines listed above.
- Finding 3 (ci.yml job `if:` skips dispatch runs → silent green): adopted, `if:` extended and tested.
- Finding 4 (release dispatch is safe with existing guards): adopted; guards unchanged, new guard-order test.
- Finding 5 / R8 (concurrency): adopted as "leave unchanged", follow-up.
- Finding 6 / R1 (expression; vars-only for risk-tier): adopted.
- Finding 7 (security, keep isolation unconditional) / R6: adopted.
- Finding 8 / R8 (cache scope): follow-up only.
- R2 (no YAML library; line extraction plus evaluator): adopted.
- R3 (input options `default`/`github`/`macbook`, default `default`): adopted as the default answer to open question 1 (A1).
- R4, R5, R7: adopted; R5 `security ` pattern narrowed to `security (find|add|delete|unlock)-` because check-image.sh
  line 128 contains "security headers".

## Assumptions
For Ming to confirm at the plan gate (consult open questions, recommended defaults chosen):
- A1 (open question 1): the dispatch input has options `default`, `github`, `macbook`, default `default`; `default`
  follows `SIMAP_RUNNER`. The ticket text lists the input as `github` / `macbook`; `default` is an extra third option
  so a manual run without a choice does not silently ignore the variable. Alternative: options `github`/`macbook`
  with default `github`.
- A2 (open question 2): `release` may run on GitHub-hosted, and that is its default when `SIMAP_RUNNER` is unset (D84,
  Ming 2026-11-26 "release is included"). Release secrets then go to a GitHub-managed VM.
- A3 (open question 4): cache-scope thrash between arm64 and amd64 builds is left as a follow-up regardless of the
  Mac's architecture (performance only).
- A4 (open question 3): concurrency groups unchanged; a dispatch on `main` can replace a pending push CI run in group
  `ci-refs/heads/main` (current GitHub behaviour). Follow-up only.

Other non-blocking assumptions:
- A5: GitHub expression `==` is case-insensitive, so `SIMAP_RUNNER=MacBook` also selects macbook-runner. Acceptable
  ("any other value = ubuntu" is read as "any value other than macbook, case-insensitive"); the evaluator test
  documents it.
- A6: `.github/workflows/risk-tier.yml` is kit-managed, but simap already carries a local edit of it (SIM-034, header
  line 4); this ticket extends that local edit and records an upstream follow-up.
- A7: GitHub-hosted minutes on the private repo: each same-repo PR costs roughly two 10-25 min jobs plus risk-tier.
  Documented in README; no code guard.
- A8: Hotspots: the only other open ticket is SIM-058 (PLANNING, db/api); it does not touch workflows, CI scripts,
  their tests, README CI/Release sections or `docs/go-live.md`. No rebase expected.
- A9: `deploy/deployment-repo/**` (deploy-simap stays on macbook-runner) is not changed (ticket out of scope; High
  path).
- A10: Estimated diff about 250-350 lines (mostly tests); fits one cycle.

## Blocking questions
None.

## Split proposal
None.
