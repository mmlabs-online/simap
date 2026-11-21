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
