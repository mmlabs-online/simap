# Security review — SIM-031

## Attempt 1

Verdict: PASS

No 🔴 or 🟡 findings. By code reading, a running `pnpm dev:prod` uses only `https://api.mmlabs.online`, and a token from another Identity fails verification. I ran nothing: this session has no shell, so the Windows point in N1 is unproven at runtime.

### Findings

🟢 N1: the refusal runs only at startup, so a mid-run edit relies on Node's Windows behaviour.
- Where: `d:\project\simap-game-ui\scripts\dev-prod.mjs:215-223`; `expand` in `d:\project\simap-game-ui\node_modules\.pnpm\@next+env@16.4.6\node_modules\@next\env\dist\index.js:1` (minified).
- Scenario: while `dev:prod` waits at the password prompt or is running, someone adds `mm_identity_issuer=http://localhost:1` to `.env.local`. Next watches that file and force-reloads it, and the launcher does not check it again.
- Why it is safe today: `expand` tests `hasOwnProperty.call(process.env, key)`. On Windows that lookup should be case-insensitive, so the parsed value is replaced by the pin before it is written back. On Linux the variant is a separate key that `config.ts` never reads.
- Residual risk: the case-insensitive lookup is my knowledge of Node, not something I executed. The variant case on real `@next/env` was also skipped (impl-log Attempt 1). If the lookup were case-sensitive, this edit would overwrite the pin on Windows.
- Fix (follow-up, optional): add a `process.platform === "win32"` test that loads a variant line through real `@next/env`, with a forced reload, and asserts the pin. It would need a Windows run, since CI may only cover Linux.

🟢 N2: with a stale token, the Identity password prompt comes before the refusal.
- Where: `scripts/dev-prod.mjs:153-155` (runs `dev:token`, which prompts at `scripts/dev-token.mjs:177`) and `:178` (may start the tunnel), both before the refusal at `:215-223`.
- Scenario: token expired and `.env.local` has a variant line. The user types the Identity password, the tunnel may start, and only then does `dev:prod` exit 2.
- Impact: no exposure. `dev-token.mjs:10` hardcodes the production base, and the database password prompt at `:229` is still after the refusal. The acceptance criterion holds if "the password prompt" means the database password, as the plan reads it. The existing `.env*` refusals have the same ordering.
- Fix (follow-up, optional): move the read-only `.env*` checks ahead of step 1.

### What I checked

1. Issuer pin: holds.
   - `childEnv` (`dev-prod.mjs:96-113`) deletes every case variant, then sets one key. `devEnv` keeps it.
   - `NODE_ENV` is forced to `development`, so Next loads exactly the four files in `ENV_FILE_NAMES`.
   - An exact-case file line loses at first load and on forced reload. `replaceProcessEnv` restores the startup snapshot, and `expand` keeps the process value.
   - The `next dev` fork inherits the pin through `initialEnv || process.env` (`next/dist/cli/next-dev.js:362,402`).
   - `src/server/identity/config.ts:15` is the only issuer read in `src/server`. I found no issuer override in `next.config.*`, `src/proxy.ts` or an instrumentation file.
2. JWKS: derives only from the issuer.
   - `config.ts:35` builds the URL from the issuer, and `with-auth.ts:103-108` passes both to the verifier. There is no separate JWKS variable.
   - `verify.ts:123-131` enforces exact `iss`, ES256 and the audience, and `:93` rejects tokens carrying their own key location. The JWKS fetch refuses redirects (`jwks.ts:59`).
   - The dev-token path goes through the same verifier (`with-auth.ts:57-58`).
3. Refusal: correct.
   - Read errors become `EnvReadFailure` and exit 2 (`dev-prod.mjs:194-200,243-245`).
   - It runs before the database password prompt, and its message carries only the file name and key name.
   - The matcher covers what the Next parser accepts: `export`, `=`, `: `, CRLF, BOM and a key split from `=` across lines. Where they differ, it only over-refuses.
   - An exact-case line does no harm: its value is discarded in favour of the pin.
4. Plain `pnpm dev`: no change found. `scripts/dev.mjs` has no issuer handling, and `devEnv` passes issuer variants through. The changed lines show no regression in the existing token, tunnel, `DATABASE_URL`, `SIMAP_DEV_ORG` or badge checks.

### Limits

- I did not run tests, checks, `git diff` or the app. The green Checks are the implementer's report in impl-log Attempt 1, so the orchestrator should confirm them. "`dev.mjs` unchanged" also comes from that log plus reading the current file.
- The manual check of a valid production token reaching `/api/me` through the real tunnel is still open for Ming.
- I did not assess a hostile local shell or `NODE_OPTIONS` beyond the existing guards, or TLS-weakening variables such as `NODE_TLS_REJECT_UNAUTHORIZED` set through `.env*`. Those do not change the issuer, but the TLS case could affect trust in the JWKS fetch and may merit its own review.
- I did not read any `.env*` file, the real dev-token file or `.next` output. Listed out-of-scope items were not reviewed.

## Attempt 2

Verdict: PASS

No 🔴 or 🟡 findings. By code reading, all four requested properties hold. I ran nothing: this session has no shell, so the tests were not executed.

### Findings

🟢 N1: the read-failure test's file-name assertion is weak for two of its four cases.
- Where: `d:\project\simap-game-ui\scripts\dev-prod.test.ts:569`
- Scenario: `toContain(FILES[n - 6])` is a substring check. `.env` (read 9) matches every file name, and `.env.development` (read 8) also matches `.env.development.local`. If a regression made read 9 report `.env.local`, the test would still pass.
- Impact: test precision only. The refusal still exits 2, with no prompt, no spawn and no value printed, and those assertions are not affected. The product code names the right file (`scripts/dev-prod.mjs:198,244`).
- Fix (optional, follow-up or next touch of this file): replace lines 568-570 with an exact match, keeping the secret check:
```ts
expect(r.err).toEqual([
  `[dev:prod] cannot read ${FILES[n - 6]}: close whatever holds it and retry (nothing started)`,
]);
expect([...r.out, ...r.err].join("\n")).not.toContain("SECRET-CONTENT");
```

### What I checked

1. Throwaway directory, never the repo root: holds.
   - `loadEnvConfig` receives only the `mkdtempSync` directory (`dev-prod.test.ts:598,606`), and `@next/env` builds each path by joining that directory with the file name. It does not search parent directories.
   - All four files are written by the test with a fake value (`:601`).
   - The `loadedEnvFiles` assertion (`:607`) also fails if `@next/env` returns a cached result from an earlier load.

2. Real `.env*` files cannot be read: holds.
   - `drive` injects `readEnvFile` and `readTokenFile` (`:60,73`) and passes `env: o.env ?? {}`, not `process.env`.
   - The real reader is wired only in `main()` (`dev-prod.mjs:304`).
   - `dev-prod.mjs:313`, `dev.mjs:147` and `dev-token.mjs:271` all guard `main()`, so importing them in a test starts nothing. `db/target.js` has no file or env-loading call.

3. `process.env` restored on failure: holds.
   - The snapshot is taken before `try` (`:599`). All mutation is inside `try`, and `finally` deletes every key and restores the snapshot (`:610-612`). This also removes keys `@next/env` added, including `__NEXT_PROCESSED_ENV`.
   - Restore runs before `rmSync`, so a Windows cleanup error cannot skip it.
   - The test is fully synchronous, so no other test can run while the pin or forced `NODE_ENV` is set.
   - `@next/env` keeps its own in-memory snapshot containing the pin after the test, but nothing writes it back unless `@next/env` is called again. This test is the only caller in `src`, `scripts`, `db` or `tests`.

4. The `@next/env` test is no longer vacuous: holds.
   - With `NODE_ENV=development`, the loader picks exactly the four names in `FILES`.
   - The forced pass bypasses the `__NEXT_PROCESSED_ENV` early return, so the file values really are processed against the pin.
   - A failed assertion would print only file paths or the issuer value, and the logger is silenced (`:603`).

5. Read failures fail closed: holds.
   - Read numbering is correct: read 1 is `.env.local` (`dev-prod.mjs:201`), reads 2-5 are the org loop (`:208-209`), and reads 6-9 are the issuer loop (`:215-216`), in `FILES` order.
   - A throw becomes `EnvReadFailure`, then exit 2 (`:194-200,243-245`), before the prompt at `:229`. The original error is discarded, and the message carries only the file name.
   - The test asserts code 2, no prompt, no spawn and no `SECRET-CONTENT` across stdout and stderr (`dev-prod.test.ts:564-570`).

### Limits

- I did not run the tests, the Checks or `git diff`. The green Checks (988 tests passed) are the implementer's report in `impl-log.md`, so the orchestrator should confirm them.
- "Test-only" is not proven from git. The current `dev-prod.mjs` line numbers match those cited in Attempt 1, which is consistent with no product change but is not proof. The orchestrator should confirm with `git diff 2612bbe..HEAD --stat`, or the equivalent range, that only `scripts/dev-prod.test.ts` and ticket files changed.
- Attempt 1's 🟢 N1 remains open: the Windows case-variant path through real `@next/env` is still not executed. It was outside this review's scope.
- I did not read any `.env*` file, the real dev-token file or `.next` output. For `@next/env`, I read only targeted excerpts of its minified `dist/index.js`.
