## Attempt 1 — 2026-11-20
Verdict: PASS

### Checks (run by reviewer)
Run locally on Windows, Node 24 with `--config.engine-strict=false` (CI uses Node 22).
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — typecheck exit 0 ("Types generated successfully", tsc clean); "check-layers: 76 files, no violations"
- `pnpm test` — exit 0, "Test Files 28 passed (28); Tests 192 passed | 3 skipped (195)". This matches impl-log.
- `pnpm build` — exit 0, "Compiled successfully"
- `pnpm schema:check` happy path — not run (no Postgres locally); CI-only, as the plan states.

### Acceptance criteria
- [x] Handlers receive the org scope from `withAuth`, and no exported function turns `{ org }` into an `OrgScope`. Evidence:
  - `orgScopeOf` was removed (`src/server/http/org-scope.ts`). `grep orgScopeOf src db scripts` finds it only in the test's `@ts-expect-error` line.
  - `with-auth.ts` builds `ctx = Object.freeze({ …, scope: scopeFor(org) })` and passes `ctx.scope` to `memberGate`.
  - Tests pass: `org-scope.test.ts › exports no OrgScope constructor` (its two `@ts-expect-error` lines hold under a clean typecheck) and `› OrgScope is cast only in with-auth.ts and tests`.
  - Test passes: `with-auth.test.ts › ctx.scope comes from the verified org, is frozen, and is the scope given to the member gate`.
- [x] The guarded-routes test flags unwrapped GET, `export { h as POST }` and HEAD/OPTIONS, and passes for real routes. Evidence: `routes-guarded.test.ts` › "flags fixture: unwrapped GET", "flags fixture: export { h as POST }", "flags fixture: HEAD and OPTIONS", "accepts fixture: wrapped GET + non-method exports" and "every real route.ts except healthz/readyz is guarded" all pass. The marker is set non-enumerable through `Object.defineProperty` (`with-auth.ts`); `with-auth.test.ts › returned function carries a non-enumerable withAuth marker` passes.
- [x] `assertDevSeedTarget` refuses `?host=` and `?hostaddr=` without echoing the password, and the existing local cases still pass. Evidence: `db/seeder.test.ts` › "refuses ?host= / ?hostaddr= overrides without echoing the URL" and "refuses an empty host and a unix socket path" pass. The 4 existing cases pass unchanged.
- [x] `schema:check` exits 2 without connecting when `DATABASE_URL` is not local. Evidence: `scripts/schema-check.test.ts` › "exits 2 before connecting for a non-local DATABASE_URL" (both URLs) and "exits 2 with NODE_ENV=production" pass. The guard runs right after the `!base` check and before any `pg` client is created (`scripts/schema-check.mjs`).
- [x] All loop checks are green (above). The second half of this criterion, the security auditor rescan that marks SIM005-orgscope-forgeable, SIM005-guard-test-regex and SIM-008 findings 1–2 resolved, belongs to the `security-ai-generated-code-auditor` run that the orchestrator triggers (paths `src/server/`, `db/`). The code evidence it needs is in place: the `?host=`/`?hostaddr=` seeder cases pass and schema-check exits 2 on a non-local URL.

Scope: every changed file is in the plan's file list. `src/server/http/**` (High) is named in the plan, and the plan was approved in batch 2026-11-20-2. The lockfile diff only adds the importer entry (+3 lines). No out-of-plan files.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the new test import `@/server/http/with-auth` in `src/app/api/` is api → server. The fixtures are in `src/test/`, which has no layer, and check:layers is clean.
- R3: refusal messages are fixed strings. Tests assert that `secret-pw` never appears in the output, and the spawned test env is minimal.
- R5: every change has tests.
- R6: the scope now comes only from the verified `org` claim.

### Blockers from review agents
- None. `security-review.md` Attempt 1: 0 🔴, 0 🟡, 5 💭; SIM-005 findings 1–2 and SIM-008 findings 1–2 RESOLVED.

### Nits (do not block)
- `WITH_AUTH_MARK` uses the global `Symbol.for`, so code that sets the marker on purpose can forge it. That is fine: the test guards against forgetting the wrap, not against deliberate bypass, and that bypass would be visible in review.
- `with-auth.test.ts`: `expect(Object.keys(fn)).not.toContain(String(WITH_AUTH_MARK))` is redundant next to `expect(Object.keys(fn)).toEqual([])`.
- `src/test/fixtures/routes/aliased-post.ts` also exports a wrapped `GET`. That makes it a stronger fixture than the plan described, since it shows a module can mix wrapped and unwrapped exports.
- The `scripts/schema-check.mjs` header comment line 2 is now longer than the other lines. oxfmt accepts it.

### Follow-ups (out of scope)
- None.
