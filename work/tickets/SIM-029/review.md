## Attempt 1 — 2026-11-21
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format" (270 files).
- `pnpm typecheck && pnpm check:layers` — both exit 0; "check-layers: 223 files, no violations".
- `pnpm test` — exit 0; Test Files 89 passed (89); Tests 861 passed | 3 skipped (864). Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm test:db` — not run (CI-only check, needs Postgres). CI must be green on the PR.

### Acceptance criteria
- [x] Each of the five scripts exits 2 before connecting on port 15432 or `SIMAP_DB_TARGET=production`; tests cover each
      entry — evidence: `scripts/prod-guard.cli.test.ts` (5 entries x 5 targets, plus the `pnpm migrate` wiring and
      `NODE_ENV=production` cases), passing in the reviewer's run.
- [x] The container migrate path is unaffected; a test proves it — evidence: `db/migrate.cli.test.ts` › "image entry
      ignores the dev guard" and "imports stay inside the image"; no diff in `Dockerfile`, `db/migrate.js`,
      `db/migrator.js`, `deploy/`, `db/migrations/`.
- [ ] `pnpm dev:prod` never writes the password or URL to disk or stdout and refuses when `.env.local` has
      `DATABASE_URL` — secrecy part met (`scripts/dev-prod.test.ts` › secrecy, no file-write API); refusal part FAILED,
      see Issue 2.
- [ ] `pnpm dev:prod` stops before the password on a token or tunnel failure, and with a valid token and tunnel starts
      the app — stop order met (`scripts/dev-prod.test.ts` › step order); start with the default container FAILED, see
      Issue 1. The live `/api/readyz` 200 is under Ming verification.
- [x] All Checks green — evidence: above; `pnpm test:db` is left to CI.

### Issues
#### Issue 1 — 🔴 blocker — wrong default tunnel container
- **Where**: `scripts/dev-prod.mjs:66`; `README.md:52`.
- **Expected**: the default container is `pg-tunnel-pg-tunnel-1`, override `SIMAP_PG_TUNNEL` (ticket Scope, step 2).
- **Actual**: the default is `pg-tunnel`. A reviewer run of `run()` with injected calls and an empty env issued
  `docker inspect -f {{.State.Running}} pg-tunnel`. With the real container name, inspect fails and `pnpm dev:prod`
  stops with "not found" unless `SIMAP_PG_TUNNEL` is set. No test asserts the default name.
- **Fix instruction**: change the default at `scripts/dev-prod.mjs:66` to `pg-tunnel-pg-tunnel-1` and update
  `README.md:52`. In `scripts/dev-prod.test.ts`, record the docker args and assert that with an empty env the inspect
  call targets `pg-tunnel-pg-tunnel-1`, and that `SIMAP_PG_TUNNEL` overrides it. Use injected docker calls only.

#### Issue 2 — 🔴 blocker — `.env.local` check misses a form Next.js loads
- **Where**: `scripts/dev-prod.mjs:46`; test at `scripts/dev-prod.test.ts:75-90`.
- **Expected**: `dev:prod` refuses every `.env.local` line that sets `DATABASE_URL` (AC 3).
- **Actual**: `envFileSetsDatabaseUrl("DATABASE_URL: postgres://x")` returns `false`, while `@next/env` `loadEnvConfig`
  loaded `DATABASE_URL` from a throwaway file holding that line with a fake value. The refusal is skipped.
- **Fix instruction**: make the assignment part of the regex accept both forms, for example
  `/^﻿?\s*(?:export\s+)?DATABASE_URL(?:\s*=|:(?:\s|$))/`. Add `DATABASE_URL: x` and `export DATABASE_URL: x` to the
  matching cases, and keep `DATABASE_URL_X: 1` and the comment form as non-matching.

### Rules (CLAUDE.md)
- R4: all changed product files are in the plan's file list. `work/ming-todo.md` is the M-13 plan-approval record.
- R1, R2, R6: not affected (no `src/` or schema change).
- R3: no violation found in the code read. **Not verified:** the content of the `.env.example` diff. Reading it was
  denied by the permission system, so only the diffstat is known (4 added lines). Ming or the security reviewer must
  confirm that those lines hold names only.
- R5: new logic has tests; the two gaps are in Issues 1 and 2.

### Blockers from review agents
None at the time of writing; `security-review.md` does not exist yet. The `db/` and `.env.example` changes trigger
`security-ai-generated-code-auditor`.

### Nits (do not block)
- `scripts/dev-prod.mjs:195-201`: any `.env.local` read error (not only a missing file) counts as "no file". Refusing on
  errors other than `ENOENT` would fail closed.
- `scripts/dev-prod.mjs:157-158`: `process.once` removes the handler after the first Ctrl-C, so a second Ctrl-C can end
  the parent before the child has exited. Check this during Ming's Ctrl-C verification.

### Ming verification after merge
Needs M-3 and the real tunnel; agents must not run these.
1. Tunnel up, `pnpm dev:prod` in PowerShell: enter the role password, banner shows, `curl -i http://127.0.0.1:3000/api/readyz` answers 200.
2. Ctrl-C stops the app; the terminal still echoes typed input.
3. `$env:DATABASE_URL = "postgres://u@127.0.0.1:15432/simap"; pnpm seed:dev` exits 2 and writes nothing. Clear it afterwards with `Remove-Item Env:DATABASE_URL`.

### Follow-ups (out of scope)
- Add `pnpm dev:prod` to the Commands list in `CLAUDE.md`.

### Blockers from review agents
- security-review.md Attempt 1 🔴 1: default tunnel container must be `pg-tunnel-pg-tunnel-1` (same as blocker 1 above).
- Orchestrator also carries into this rework, because they touch production data or AC 3: security 🟡 2 (pass the resolved token file to the child as `SIMAP_DEV_TOKEN_FILE`) and 🟢 5 (`dev:prod` refuses `report` in `NODE_OPTIONS`). Security 🟢 3 is the same as blocker 2 above. Security 🟢 4 (`PG*` stripping) stays a follow-up unless the fix is needed for the items above.

## Attempt 2 — 2026-11-21
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format" (270 files).
- `pnpm typecheck && pnpm check:layers` — both exit 0; "check-layers: 223 files, no violations".
- `pnpm test` — exit 0; Test Files 89 passed (89); Tests 863 passed | 3 skipped (866). Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm test:db` — not run (CI-only check, needs Postgres). CI must be green on the PR.
- Focused re-run of `scripts/dev-prod.test.ts`, `scripts/prod-guard.cli.test.ts`, `db/migrate.cli.test.ts`,
  `db/target.test.ts`, `db/seeder.test.ts` — exit 0; 5 files, 60 tests passed.

### Attempt 1 issues
- Issue 1 / security 🔴 1 (default container) — FIXED: `scripts/dev-prod.mjs:71`, `README.md:52`; test "tunnel container:
  default name, SIMAP_PG_TUNNEL overrides" asserts both inspect argv.
- Issue 2 / security 🟢 3 (colon form) — FIXED: `scripts/dev-prod.mjs:46`. Reviewer probe with `@next/env` and fake
  throwaway files: `DATABASE_URL: x`, `export DATABASE_URL: x` and `DATABASE_URL:` + next line are loaded by Next and
  refused; the comment and `DATABASE_URL_X: 1` are neither.
- Security 🟡 2 (token file) — FIXED: `scripts/dev-prod.mjs:60,148`; test "passes the resolved token file to the child".
- Security 🟢 5 (`report` in `NODE_OPTIONS`) — FIXED: `scripts/dev-prod.mjs:75-82`. Reviewer probe:
  `--report-uncaught-exception`, `--report_on_signal` and `--experimental-report` exit 1 with no token, docker, prompt
  or spawn call.
- Security 🟢 4 (`PG*` stripping) — follow-up, as the orchestrator decided in Attempt 1.

### Acceptance criteria
- [x] Each of the five scripts exits 2 before connecting on port 15432 or `SIMAP_DB_TARGET=production`; tests cover each
      entry — evidence: `scripts/prod-guard.cli.test.ts`, passing.
- [x] The container migrate path is unaffected; a test proves it — evidence: `db/migrate.cli.test.ts` › "image entry
      ignores the dev guard", "imports stay inside the image"; no diff in `Dockerfile`, `db/migrate.js`,
      `db/migrator.js`, `deploy/`, `db/migrations/`.
- [x] `pnpm dev:prod` never writes the password or URL to disk or stdout and refuses when `.env.local` has
      `DATABASE_URL` — evidence: `scripts/dev-prod.test.ts` › secrecy, no file-write API, `.env.local` cases. Two unusual
      forms remain unrefused, see the should-fix below; the ticket specifies a line check and they cannot change the
      database target.
- [x] `pnpm dev:prod` stops before the password on a token or tunnel failure, and with a valid token and tunnel starts
      the app bound to `127.0.0.1` — evidence: `scripts/dev-prod.test.ts` › step order, child process, with injected
      calls. The live `/api/readyz` 200 is under Ming verification.
- [x] All Checks green — evidence: above; `pnpm test:db` is left to CI.

### Issues
#### Issue 1 — 🟡 should-fix (non-blocking) — `.env.local` check misses two multi-line forms
- **Where**: `scripts/dev-prod.mjs:45-46`.
- **Expected**: every form Next loads as `DATABASE_URL` is refused.
- **Actual**: `A=1\rDATABASE_URL=x` (lone CR) and `DATABASE_URL\n=x` are loaded by `@next/env` but not refused. Reviewer
  probe with both forms and `DATABASE_URL` already in the process env: the process value stayed in effect, so the app
  still uses the URL built by `dev:prod`.
- **Fix instruction**: in a follow-up, split on `/\r\n?|\n/` and let the key match `\s*=` across a line break; add both
  forms to the matching cases.

### Rules (CLAUDE.md)
- R1, R2, R6: not affected (no `src/` or schema change).
- R3: no violation found in the code read. **Not verified:** the content of the `.env.example` diff. Reading it was
  denied by the permission system, so only the diffstat is known (4 added lines). **Ming must confirm those lines hold
  names only before merging** (High path).
- R4: all changed product files are in the plan's file list; the rework touched only `scripts/dev-prod.mjs`, its test
  and `README.md`.
- R5: each rework fix has a test.

### Blockers from review agents
No 🔴 open. `security-review.md` Attempt 2 (static) confirms findings 1, 2, 3, 5 fixed. Its own verdict line says REWORK, on 🟡 1 and 🟢 2 only, which under `loop.config.md` (only a 🔴 turns PASS into REWORK) do not block. **The orchestrator or Ming should decide whether to carry 🟡 1 into this ticket**: it concerns production writes. Reviewer read `scripts/dev-prod.mjs:30-36,99` and confirms the freshness check ignores the `org` claim; the ticket step 1 defines freshness only by presence, shape and expiry, so it is outside this ticket's scope.

### Nits (do not block)
- `scripts/dev-prod.mjs:208-214`: any `.env.local` read error counts as "no file"; refusing on errors other than
  `ENOENT` would fail closed.
- `scripts/dev-prod.mjs:170-171`: `process.once` removes the handler after the first Ctrl-C, so a second Ctrl-C can end
  the parent before the child has exited. Check this during Ming's Ctrl-C verification.
- `README.md:52` is longer than the surrounding wrapped lines.

### Ming verification after merge
Needs M-3 and the real tunnel; agents must not run these.
1. Tunnel up, `pnpm dev:prod` in PowerShell: enter the role password, banner shows, `curl -i http://127.0.0.1:3000/api/readyz` answers 200.
2. Ctrl-C stops the app; the terminal still echoes typed input.
3. `$env:DATABASE_URL = "postgres://u@127.0.0.1:15432/simap"; pnpm seed:dev` exits 2 and writes nothing. Clear it afterwards with `Remove-Item Env:DATABASE_URL`.

### Follow-ups (out of scope)
- Add `pnpm dev:prod` to the Commands list in `CLAUDE.md`.
- Security 🟢 4: strip `PG*` keys case-insensitively and refuse `PG*` assignments in `.env.local`.
- Issue 1 above: refuse the lone-CR and split-line `DATABASE_URL` forms.
- Security Attempt 2 🟡 1: when `SIMAP_DEV_ORG` differs from a still-fresh token's `org`, refresh or stop, and show the active org in the production banner.
- Security Attempt 2 🟢 2: refuse `heapsnapshot` in `NODE_OPTIONS` for `dev:prod`.

## Attempt 3 — 2026-11-21
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format" (270 files).
- `pnpm typecheck && pnpm check:layers` — both exit 0; "check-layers: 223 files, no violations".
- `pnpm test` — exit 0; Test Files 89 passed (89); Tests 869 passed | 3 skipped (872). Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm test:db` — not run (CI-only check, needs Postgres). CI must be green on the PR.
- Focused re-run of `scripts/dev-prod.test.ts`, `scripts/prod-guard.cli.test.ts`, `db/migrate.cli.test.ts`,
  `db/target.test.ts`, `db/seeder.test.ts` — exit 0; 5 files, 66 tests passed.
- Reviewer probe: the real `dev-prod.run` calling the real `dev-token.run`, with fake Identity `fetch`, Docker, port
  probe, prompt and app, and a throwaway token file. No network, tunnel, database or real token file was used.

### Security Attempt 2 finding 🟡 1: five fix points
1. Mismatch is not fresh, so `dev:token` runs — FIXED: `scripts/dev-prod.mjs:48-51,113-117`. Test "token of another org
   is refreshed, then runs". Probe: fresh org A token with `SIMAP_DEV_ORG=B` requested `org_id` B from Identity and
   started with B; an uppercase `SIMAP_DEV_ORG` matched with no refresh.
2. Org re-checked after refresh, exit 1 on mismatch — FIXED: `scripts/dev-prod.mjs:118-129`. Test "wrong org after
   refresh exits 1 before docker and prompt". Probe: Identity answering with org A for a B request exits 1 with no
   Docker call, prompt or app.
3. Missing `org` is not fresh — FIXED: `scripts/dev-prod.mjs:39-42,49-50`. Test "token without org is refreshed; still
   without org exits 1 with the --org hint". Probe: same result through the real `dev:token`.
4. Banner prints the active org id — FIXED: `scripts/dev-prod.mjs:170`. Test "banner shows the org id, with or without
   SIMAP_DEV_ORG, never the token". Probe: with `SIMAP_DEV_ORG` unset the banner names the token's org.
5. Tests for mismatch then refresh, mismatch after refresh, no org claim — PRESENT: `scripts/dev-prod.test.ts:146-184`,
   plus the `tokenIsFresh` case at `:80-86`.

An invalid `SIMAP_DEV_ORG`, or a padded one that differs from the token, fails closed: `dev:token` exits 1 and nothing
starts (probe).

### Acceptance criteria
- [x] Each of the five scripts exits 2 before connecting on port 15432 or `SIMAP_DB_TARGET=production`; tests cover each
      entry — evidence: `scripts/prod-guard.cli.test.ts`, passing; not touched by this attempt.
- [x] The container migrate path is unaffected; a test proves it — evidence: `db/migrate.cli.test.ts`, passing; this
      attempt changes no `db/`, `Dockerfile` or `deploy/` file.
- [x] `pnpm dev:prod` never writes the password or URL to disk or stdout and refuses when `.env.local` has
      `DATABASE_URL` — evidence: `scripts/dev-prod.test.ts` secrecy and `.env.local` cases, passing. The new banner adds
      only the org claim.
- [x] `pnpm dev:prod` stops before the password on a token or tunnel failure, and with a valid token and tunnel starts
      the app bound to `127.0.0.1` — evidence: `scripts/dev-prod.test.ts` step order and child process cases, plus the
      probe traces above. The live `/api/readyz` 200 is under Ming verification.
- [x] All Checks green — evidence: above; `pnpm test:db` is left to CI.

### Issues
No blocking issue.

### Scope
The attempt's commit `b226c9b` changes `README.md`, `scripts/dev-prod.mjs`, `scripts/dev-prod.test.ts` and `impl-log.md`,
all within the plan and the rework Ming asked for. No High path changed in this attempt.

### Rules (CLAUDE.md)
- R1, R2, R6: not affected (no `src/` or schema change).
- R3: no violation found in this attempt. **Still not verified:** the `.env.example` lines from the earlier attempts,
  which agents may not read. **Ming must confirm they hold names only before merging** (High path).
- R4: no violation. R5: each fix point has a test.

### Blockers from review agents
No 🔴 open. Security has not re-reviewed this attempt; the five fix points were verified here.

### Nits (do not block)
- `scripts/dev-prod.mjs:39-42,170`: the banner prints the unverified `org` claim as is. A blank claim counts as an org,
  and a claim with control characters reaches the terminal (probe). Requiring a UUID in `tokenOrg` closes both. It needs
  a tampered or malformed local token file, and the server still verifies the token.
- `scripts/dev-prod.mjs:127`: when Identity returns the wrong org, `dev:token` reports it and `dev:prod` then adds the
  generic "no fresh dev token" line. Harmless.

### Ming verification after merge
Needs M-3 and the real tunnel; agents must not run these.
1. Tunnel up, `pnpm dev:prod` in PowerShell: enter the role password, the banner shows the expected org id, and
   `curl -i http://127.0.0.1:3000/api/readyz` answers 200.
2. Ctrl-C stops the app; the terminal still echoes typed input.
3. `$env:DATABASE_URL = "postgres://u@127.0.0.1:15432/simap"; pnpm seed:dev` exits 2 and writes nothing. Clear it afterwards with `Remove-Item Env:DATABASE_URL`.

### Follow-ups (out of scope)
- The org can change after startup: the server reads the token file on every request
  (`src/server/http/dev-token.ts:25-26,50`), so `pnpm dev:token --org B` in another terminal moves a running `dev:prod`
  to org B while the banner still names A. Found by reading the code, not run live. Consider pinning the org for the
  `dev:prod` child and refusing a token for another org.
- `SIMAP_DEV_ORG` set only in `.env.local` is ignored: `dev-prod.mjs` and `dev-token.mjs` read the process env and load
  no env file, so the match check is skipped. The banner still shows the real org. Document this or read the name.
- Still open from Attempt 2: `CLAUDE.md` Commands entry for `pnpm dev:prod`; security 🟢 `PG*` stripping; lone-CR and
  split-line `DATABASE_URL` forms; security 🟢 `heapsnapshot` in `NODE_OPTIONS`.
