
## Attempt 1

### Files touched
- `scripts/dev-prod.mjs`: `ISSUER_PROD`/`ISSUER_KEY` constants, `childEnv` drops every case variant of `MM_IDENTITY_ISSUER` and sets the pin, new exported `envFileSetsKeyVariant`, step 3 refusal (exit 2, file name only). Required because: the pin and the refusal.
- `scripts/dev-prod.test.ts`: new `issuer pin` describe. Required because: R5, plan test list.
- `README.md`: "Production database (dev)" steps 3 and 4. Required because: docs for new behaviour.

### Tests added
All in `scripts/dev-prod.test.ts` › `issuer pin`: pin replaces variants, no-issuer case, exact-case line in each of four files keeps running, variant refusal x4 files x6 shapes (before prompt, no value printed), no false positives, read failure still exit 2, helper unit cases, plain `devEnv` keeps variants, real `@next/env` on a `mkdtemp` dir (initial and forced reload, pin kept). The variant case on `@next/env` was not run (not deterministic across platforms; the refusal covers it).

### Checks
- typecheck exit 0; check:layers exit 0; format:check exit 0
- test: Test Files 96 passed; Tests 984 passed | 3 skipped
- build exit 0; check:dev-bundle exit 0

### Out-of-plan files
None. `scripts/dev.mjs` unchanged.

### Follow-ups
- Optional: `tokenIsFresh` could check `iss` (token from a non-prod Identity gets 401 at the verifier today).

### Scope self-check
Only the three planned files changed.

## Attempt 2 (rework)

### Files touched
- `scripts/dev-prod.test.ts` (test only). Required because review Issues 1 and 2.
  - Issue 1: the `@next/env` test now sets `NODE_ENV=development` with the pin, asserts `loadedEnvFiles` equals the four
    files after the initial load and the forced reload, and restores `process.env` in `finally` (temp dir only).
    `loadedEnvFiles` holds file names relative to the dir, so the test compares against `FILES`.
  - Issue 2: new `envThrowsAt` drive option (throws on a chosen read number); `it.each([6, 7, 8, 9])` covers the four
    issuer-loop reads: code 2, matching file name in output, no prompt/spawn, no `SECRET-CONTENT`.

### Checks
- typecheck, check:layers, format:check, build, check:dev-bundle: exit 0
- test: Test Files 96 passed; Tests 988 passed | 3 skipped

### Out-of-plan files
None. No product code changed.

### Follow-ups
- Same as attempt 1 (optional `iss` check in `tokenIsFresh`).

### Scope self-check
Only `scripts/dev-prod.test.ts` and this log changed.
