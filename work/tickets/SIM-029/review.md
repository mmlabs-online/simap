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
