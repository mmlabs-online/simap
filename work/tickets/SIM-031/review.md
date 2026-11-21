## Attempt 1 — 2026-11-21
Verdict: REWORK

The product code behaves correctly in every scenario run. REWORK is for the committed tests: the `@next/env` test named
as AC2's evidence loads only one of the four files.

### Checks (run by reviewer)
Node v22.23.5, Windows.
- `pnpm format:check` — exit 0
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0
- `pnpm test` — exit 0; Test Files 96 passed (96); Tests 984 passed | 3 skipped (987). Matches impl-log.
- `pnpm build` — exit 0
- `pnpm check:dev-bundle` — exit 0; "no dev-token strings in .next/static"
- `pnpm test:db` — not run (left to CI by the orchestrator)

### Acceptance criteria
- [x] Child has exactly one issuer key with the production value, whatever the shell passes — evidence:
      `scripts/dev-prod.mjs:100,108`; test "child issuer is pinned, replacing inherited case variants"; reviewer script
      through `run()` with `mm_identity_issuer` and `Mm_Identity_Issuer` in the shell: 4/4 one key, pinned value.
- [ ] An exact-case key in any of the four files cannot replace the pin, and `dev:prod` still starts — behaviour
      confirmed, committed evidence FAILED, see Issue 1. Reviewer script on real `@next/env` 16.4.6, throwaway directory,
      `NODE_ENV=development`, one process per scenario: 40 scenarios (8 line shapes x each file and all four together),
      initial load and forced reload, 0 failures. `run()` with exact-case lines: 4/4 start with the pin.
- [x] A case variant in any of the four files exits 2 before the prompt, names the file, never prints the value —
      evidence: `scripts/dev-prod.mjs:217` runs before the prompt at `:229`; test "a case-variant issuer line in %s exits
      2 before the prompt" (24 cases); reviewer script with the real reader: 32/32 refused with no prompt, no spawn, file
      named, marker value absent. Differential against the real `@next/env` parser: 4000 generated inputs, 50 parsed as a
      variant, 0 missed by `envFileSetsKeyVariant`. Fail-closed: real `EISDIR` on each file 4/4 exit 2; a read error
      injected inside the issuer loop for each file 4/4 exit 2 (repo test gap, see Issue 2).
- [x] Plain `pnpm dev` passes issuer settings through unchanged — evidence: `scripts/dev.mjs` and `src/**` have no diff
      against `origin/main`; test "plain dev keeps issuer variants".
- [ ] All Checks are green and the new logic has tests — Checks green; test coverage incomplete, see Issues 1 and 2.

### Issues
#### Issue 1 — 🔴 blocker — test does not cover what it claims (AC2, R5)
- **Where**: `scripts/dev-prod.test.ts:570-589`
- **Expected**: the test named "@next/env keeps the pinned issuer over every .env file, also after a forced reload"
  makes `@next/env` load `.env.development.local`, `.env.local`, `.env.development` and `.env`.
- **Actual**: Vitest runs it with `NODE_ENV=test`, so `@next/env` looks for `.env.test.local`, `.env.test` and `.env`.
  A `statSync` trace of this test recorded exactly those three candidates on both loads. Three of the four files written
  by the test are never loaded, so the plan's AC2 evidence does not exist for them.
- **Fix instruction**: before the first `loadEnvConfig` call, replace line 579 with
  `Object.assign(process.env, { NODE_ENV: "development", MM_IDENTITY_ISSUER: ISSUER });` (this form avoids the read-only
  `NODE_ENV` type). Type the return of `loadEnvConfig` as `{ loadedEnvFiles: { path: string }[] }` and assert, after both
  the initial and the forced load, that the sorted `loadedEnvFiles` paths equal the sorted `FILES`. Keep the existing
  `finally` restore.

#### Issue 2 — 🟡 should-fix — read-failure test never reaches the issuer loop
- **Where**: `scripts/dev-prod.test.ts:550-554`, harness at `:73`
- **Expected**: a test shows that a read error during the issuer check exits 2, with no prompt or spawn.
- **Actual**: `envThrows` throws on the first read (`.env.local`, the `DATABASE_URL` check), so the issuer loop is not
  exercised. The code is correct (reviewer injection, 4/4), but nothing in the repo protects it.
- **Fix instruction**: add a `drive` option that throws only from a given read number. Reads 1-5 are the `DATABASE_URL`
  check and the `SIMAP_DEV_ORG` loop, so reads 6-9 are the issuer loop. Use `it.each` over those four reads and assert
  code 2, the matching file name in stderr, no `prompt`/`spawn`, and no `SECRET-CONTENT`.

### Rules (CLAUDE.md)
- R5: see Issues 1 and 2.
- R1, R2, R6, R7: not touched (no `src/**` or migration change). R3: no value printed. R4: changed files match the plan;
  no High path changed.

### Blockers from review agents
Left to the orchestrator. `security-review.md` appeared during this review and was not read or used here.

### Nits (do not block)
- `envFileSetsKeyVariant` repeats the `envFileSetsKey` regex shape. The plan accepted this to leave `scripts/dev.mjs`
  untouched.

### Follow-ups (out of scope)
- Optional `iss` check in `tokenIsFresh` (from impl-log), so a token from another Identity fails at launch instead of
  as a 401 on each API call.

### Not verified
- Windows only; the Linux behaviour of `@next/env` was not run.
- Reload was exercised through `loadEnvConfig(..., forceReload = true)`, not a running `next dev` server. On Windows a
  variant line present at load or added before a forced reload also kept the pin (4/4 each).
- `pnpm test:db` (CI).

### Ming verification after merge
- Under `pnpm dev:prod` with M-3 and the real tunnel, a valid production token still reaches `/api/me`.
- A `.env.local` line `mm_identity_issuer=...` makes `dev:prod` exit 2 before the password prompt.

## Attempt 2 — 2026-11-21
Verdict: PASS

Both Attempt 1 issues are fixed. The rework changes only `scripts/dev-prod.test.ts` and `impl-log.md`.

### Checks (run by reviewer)
Node v22.23.5, Windows.
- `pnpm format:check` — exit 0
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0; 234 files, no violations
- `pnpm test` — exit 0; Test Files 96 passed (96); Tests 988 passed | 3 skipped (991). Matches impl-log.
- `pnpm build` — exit 0
- `pnpm check:dev-bundle` — exit 0; "no dev-token strings in .next/static"
- `pnpm test:db` — not run (left to CI by the orchestrator)

### Acceptance criteria
- [x] Child has exactly one issuer key with the production value, whatever the shell passes — evidence:
      `scripts/dev-prod.mjs` has no diff since Attempt 1 (verified there); test "child issuer is pinned, replacing
      inherited case variants" green.
- [x] An exact-case key in any of the four files cannot replace the pin, and `dev:prod` still starts — evidence: test
      "@next/env keeps the pinned issuer over every .env file, also after a forced reload" (`scripts/dev-prod.test.ts:588`)
      asserts all four `loadedEnvFiles` and the pin on both loads. A reviewer `readFileSync` trace of this test recorded
      `.env.development.local`, `.env.local`, `.env.development`, `.env` from the temp directory, twice. A before/after
      comparison of `process.env` around the test showed it restored. Test "exact-case issuer line in each .env file does
      not stop dev:prod" green.
- [x] A case variant in any of the four files exits 2 before the prompt, names the file, never prints the value —
      evidence: test "a case-variant issuer line in %s exits 2 before the prompt" green. Read failures in the issuer loop:
      `it.each([6, 7, 8, 9])` (`scripts/dev-prod.test.ts:561`). Reviewer in-memory mutation that swallows read errors only
      in the issuer loop: exactly these 4 tests failed (4 failed | 66 passed), so each one reaches that loop.
- [x] Plain `pnpm dev` passes issuer settings through unchanged — evidence: `scripts/dev.mjs` and `src/**` have no diff
      against `origin/main`; test "plain dev keeps issuer variants" green.
- [x] All Checks are green and the new logic has tests — evidence: Checks above.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R4: rework commit `13c1381` changes only `scripts/dev-prod.test.ts` and
`work/tickets/SIM-031/impl-log.md`; the branch's non-work files are the three planned files; no High path changed.
R5: see Checks. R3: no value printed. R1, R2, R6, R7: not touched.

### Blockers from review agents
None. `security-review.md` Attempt 1 is PASS with two low-severity follow-ups. An uncommitted Attempt 2 section appeared
in that file during this review, also PASS with no blocker; it was not written by this reviewer.

### Nits (do not block)
- `scripts/dev-prod.test.ts:569` uses a substring match for the file name, so `.env` (read 9) matches any file name.
  Security review Attempt 2 N1 gives an exact-match replacement.

### Follow-ups (out of scope)
- Optional `iss` check in `tokenIsFresh` (from impl-log).
- Security Attempt 1 N1: optional committed `win32` test of a variant line through real `@next/env` with forced reload.
- Security Attempt 1 N2: with a stale token, the Identity password prompt and possibly the tunnel start come before the
  refusal. The database password prompt is still after it. Moving the read-only `.env*` checks ahead of step 1 would
  close this.

### Not verified
- Linux behaviour of `@next/env` was not run locally.
- Reload was exercised through `loadEnvConfig(..., forceReload = true)`, not a running `next dev` server.
- `pnpm test:db` (CI).
- `pnpm dev:prod` was not run for real.

### Ming verification after merge
- Under `pnpm dev:prod` with M-3 and the real tunnel, a valid production token still reaches `/api/me`.
- A `.env.local` line `mm_identity_issuer=...` makes `dev:prod` exit 2 before the password prompt.
