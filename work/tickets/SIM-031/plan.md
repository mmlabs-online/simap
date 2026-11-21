Status: READY

# Plan — SIM-031: Pin the Identity issuer for `pnpm dev:prod`

## Scope summary
From `ticket.md` (D56, R6, SIM-028.1 `security-review.md` Attempt 4, N1):
- "`childEnv` in `scripts/dev-prod.mjs` drops every letter-case variant of `MM_IDENTITY_ISSUER` from the inherited environment and sets `MM_IDENTITY_ISSUER=https://api.mmlabs.online`."
- "`dev:prod` refuses (exit 2, value never printed, before the password prompt) when `.env.local`, `.env.development.local`, `.env.development` or `.env` sets a non-canonical letter-case variant of `MM_IDENTITY_ISSUER`, because on Windows such a line can overwrite the pinned value."
- Out of scope: plain `pnpm dev`, `src/server/identity/**`, S3/S4/S6/S7/F4/F6, case hardening of `SIMAP_DEV_EXPECTED_ORG` and `DATABASE_URL`.
- N1 fix text: "in `childEnv`, drop every letter-case variant of `MM_IDENTITY_ISSUER`, then set `MM_IDENTITY_ISSUER: "https://api.mmlabs.online"`. Next does not override a key already in the environment."
- Ticket note: "Do not refuse the exact-case key" (a `.env.local` may set it for plain `pnpm dev`).

## Answers to the planner's questions

**1. Does `pnpm dev:token` always use `https://api.mmlabs.online`?** Yes. `scripts/dev-token.mjs:10` hardcodes `const BASE = "https://api.mmlabs.online/api/v1"`, used by `call()` (`:143`) for `/auth/login`, `/auth/token` and `/auth/logout`. No env var, argument or `.env*` value changes it (`parseArgs` `:21-36` accepts only `--org`; `run` reads `SIMAP_DEV_EMAIL`, `SIMAP_DEV_ORG`, `SIMAP_DEV_TOKEN_FILE` only). `dev:prod` spawns it via `runDevToken` (`dev-prod.mjs:269-273`) with the same hardcoded base. So a token written by this repo's script always comes from production Identity, and the pin never rejects it. The only way to hit a mismatch is a token file that was written some other way (hand-copied, or from a local Identity). `tokenIsFresh` (`dev-prod.mjs:62-68`) checks only `exp` and `org`, not `iss`, so `dev:prod` still starts; the verifier then rejects every API call with 401. That is the right place for it to surface (R6: the verified token decides), so no new launcher check is added. An `iss` check in `tokenIsFresh` would be a possible follow-up (not planned, out of scope).

**2. Does an exact-case `.env*` value lose to the process value in `@next/env` 16.4.6, including hot reload?** Yes, by reading `node_modules/.pnpm/@next+env@16.4.6/node_modules/@next/env/dist/index.js` (not executed yet; the scripted test below proves it):
- `loadEnvConfig` stores `initialEnv = Object.assign({}, process.env)` on first call. `processEnv` then copies it to `p`, and a file value is kept only when `typeof p[key] === "undefined"`, so a key already in the launcher's environment never takes the file value.
- Dotenv `expand` also reads `hasOwnProperty(process.env, key) ? process.env[key] : parsed[key]` before writing back, so the written value is the process value (the pin has no `$`, so interpolation leaves it unchanged).
- Hot reload / forced reload: `loadEnvConfig(..., forceReload)` first calls `replaceProcessEnv(initialEnv)`, which restores the startup snapshot (including the pin), then reruns the same logic. Same outcome. `updateInitialEnv` is Next-internal.
- Residual: a case-variant key. `p[key]` is a plain-object lookup, so it is case-sensitive; on Windows `process.env` is case-insensitive. Whether the variant ends up overwriting is subtle (the `expand` path may already substitute the process value), so I do not rely on it: the ticket's exit-2 refusal stays, and the scripted test records the real behaviour on the platform it runs on without asserting a specific outcome for variants.
- One catch: `replaceProcessEnv` deletes keys whose value is `""`; the pin is never empty.

**3. File list and High paths.** Three files, none a High path (checked against `loop.config.md` lines 43-47: `**/config.*` does not match `scripts/dev-prod.mjs`; only `scripts/check-layers.mjs` is listed under scripts). No `Gate: plan-approval` needed. The security review trigger path list does not include `scripts/`, so no security-review agent is triggered by paths; the ticket's `security` area is still flagged for the orchestrator.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Child has exactly one issuer key `MM_IDENTITY_ISSUER=https://api.mmlabs.online`, whatever the shell passes | `pnpm test scripts/dev-prod.test.ts` › `run: child process` › "child issuer is pinned, replacing inherited case variants" (env with `MM_IDENTITY_ISSUER`, `mm_identity_issuer`, `Mm_Identity_Issuer`; only one key, value is the prod issuer) |
| 2 | Exact-case `MM_IDENTITY_ISSUER` in any of the four `.env*` files cannot replace the pin, and `dev:prod` still starts | `dev-prod.test.ts` › "exact-case issuer line in each .env file does not stop dev:prod" (code 0, spawned, pin kept, per file); `dev-prod.test.ts` › "@next/env keeps the pinned issuer over every .env file, also after a forced reload" (real `@next/env` on a throwaway dir) |
| 3 | Non-canonical variant in any of the four files: exit 2 before prompt, names file, never prints value | `dev-prod.test.ts` › "a case-variant issuer line in <file> exits 2 before the prompt" (each of four files; `trace` has no `prompt`/`spawn`; stderr contains the file name and not the secret value) |
| 4 | Plain `pnpm dev` passes issuer settings unchanged | `scripts/dev.test.ts` untouched and green; new `dev-prod.test.ts` assertion that `devEnv({MM_IDENTITY_ISSUER: "x", mm_identity_issuer: "y"})` keeps both; `git diff` shows `scripts/dev.mjs` unchanged |
| 5 | All Checks green, new logic has tests | `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `pnpm test` (Checks in `.claude/loop.config.md`) |

## Ming verification after merge
Manual (ticket Test plan): under `pnpm dev:prod` with M-3 and the real tunnel, a valid production token still reaches `/api/me`, and a `.env.local` line `mm_identity_issuer=...` makes `dev:prod` exit 2 before the password prompt. Needs the real tunnel and production password, so agents do not run it.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `scripts/dev-prod.mjs` | Add `ISSUER_PROD` constant and `ISSUER_KEY = "MM_IDENTITY_ISSUER"`; in `childEnv` (`:81-98`) delete every key with `k.toUpperCase() === "MM_IDENTITY_ISSUER"` (extend the loop at `:85-86`) and add `MM_IDENTITY_ISSUER: ISSUER_PROD` to the object passed to `devEnv`; add exported `envFileSetsKeyVariant(text, key)` and, in the step 3 loop (`:193-199`) or next to it, refuse with exit 2 and a message naming only the file | The pin and the refusal | No |
| `scripts/dev-prod.test.ts` | New tests (below) | R5; ticket Test plan | No |
| `README.md` | "Production database (dev)" (`:49-68`): step 3 add the refusal (`MM_IDENTITY_ISSUER` in a non-exact letter case in the four files, exit 2, value not printed); step 4 add that `dev:prod` pins `MM_IDENTITY_ISSUER=https://api.mmlabs.online` in the child, so a `.env*` value or a shell value is ignored | Docs for the new behaviour | No |

`scripts/dev.mjs` is not modified (plain dev unchanged; `ENV_FILE_NAMES`, `makeEnvReader`, `EnvReadFailure`, `envReadMessage` are reused as imported already).

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `dev-prod.test.ts` › run: child process › "child issuer is pinned, replacing inherited case variants" | AC1; shell passes `MM_IDENTITY_ISSUER: "http://localhost:4000"`, `mm_identity_issuer`, `Mm_Identity_Issuer`; exactly one key, prod value; also with only a lowercase variant (the N1 case) and with `NODE_ENV: "production"` in the shell |
| `dev-prod.test.ts` › "no issuer in the shell still gets the pin" | AC1 edge: no inherited key |
| `dev-prod.test.ts` › "exact-case issuer line in each .env file does not stop dev:prod" | AC2, loop over the four names via `envFiles`; includes a line with a hostile value; code 0, `spawn` in trace, `env.MM_IDENTITY_ISSUER` is the pin |
| `dev-prod.test.ts` › "a case-variant issuer line in <file> exits 2 before the prompt" | AC3, `it.each` of the four files; variants: `mm_identity_issuer=`, `Mm_Identity_Issuer:`, `export MM_identity_ISSUER =`, CRLF, BOM, key and `=` on separate lines (as `envFileSetsKey` handles); trace lacks `prompt` and `spawn`; stderr includes the file name, excludes the value (use a marker value such as `SECRET-ISSUER`) |
| `dev-prod.test.ts` › "issuer refusal is not hit by exact case or by other keys" | no false positive: exact `MM_IDENTITY_ISSUER=`, `# mm_identity_issuer=`, `MM_IDENTITY_ISSUER_X=`, `XMM_IDENTITY_ISSUER=` do not refuse; a file with both exact and variant lines refuses |
| `dev-prod.test.ts` › "issuer refusal comes after the read-failure handling" | an unreadable file still exits 2 with the read message (existing behaviour preserved), no value in output |
| `dev-prod.test.ts` › envFileSetsKeyVariant unit cases | the helper directly |
| `dev-prod.test.ts` › "@next/env keeps the pinned issuer over every .env file, also after a forced reload" | Scripted check: resolve `@next/env` through `createRequire(require.resolve("next/package.json")).resolve("@next/env")` (not a direct dependency under pnpm), write throwaway `.env*` files in `mkdtempSync(tmpdir())` with exact-case `MM_IDENTITY_ISSUER=http://localhost:1`, set `process.env` to the pinned value, call `loadEnvConfig(dir, true, console, false)` and again with `forceReload = true`; assert the pin; restore `process.env` in `finally` (and `resetEnv`). The variant case is run and recorded only if it is deterministic on both Windows and Linux CI; otherwise skip that sub-case with a comment |
| `dev-prod.test.ts` › "plain dev keeps issuer variants" | AC4 via `devEnv` |

All `.env*` content in tests is synthetic; no real `.env*` file or `~/.config/simap/dev-token` is read.

## Approach
1. In `dev-prod.mjs` add `const ISSUER_PROD = "https://api.mmlabs.online"` (same value as `src/server/identity/config.ts:3`; a plain `.mjs` script cannot import that `server-only` TS module, same pattern as `CANONICAL_UUID` at `:49-50`; add a one-line comment pointing to it).
2. `childEnv`: widen the existing case-insensitive delete loop to a small set (`SIMAP_DEV_EXPECTED_ORG`, `MM_IDENTITY_ISSUER`); set `MM_IDENTITY_ISSUER: ISSUER_PROD` in the object given to `devEnv` so it survives `devEnv`'s copy. Because `devEnv` is generic and only strips `NODE_ENV` and the badge flag, the pin passes through.
3. `envFileSetsKeyVariant(text, key)`: same normalisation and regex shape as `envFileSetsKey` in `dev.mjs:65-71` (CR/CRLF to LF, `^\s*(?:export\s+)?(KEY)(?:\s*=|:(?:\s|$))`), flags `gim`, loop `exec` and return true when any captured key differs from `key`. This reuses the Next-compatible matching but must live in `dev-prod.mjs` to leave `dev.mjs` untouched.
4. In `run` step 3, after the `SIMAP_DEV_ORG` loop and before the `envFileSettingDevProd` call or the password prompt, loop `ENV_FILE_NAMES` through the existing wrapped `readEnvFile` (so read failures stay fail-closed, exit 2) and on a variant `err("[dev:prod] <name> sets MM_IDENTITY_ISSUER in a different letter case: remove that line (dev:prod pins the issuer)")` and `return 2`. The message carries the file name only. Do not refuse the exact case.
5. README update, then the tests, then run all Checks.
Rules: R3 (no secrets or values printed), R4 (only the three files), R5 (tests with checks). R1/R2/R6/R7 are not touched (no `src/**` change).

## Specialist input used
None (fast lane: size S, Gate none, no consults).

## Assumptions
- No hotspot clash seen on the board for `scripts/dev-prod.mjs` or `scripts/dev-prod.test.ts` beyond SIM-028.1 (already MERGED as PR #34); the branch `ticket/SIM-031` contains it (`git log` shows `a306e4d`).
- An exact-case `.env*` `MM_IDENTITY_ISSUER` is safe only because the launcher sets the key in the process environment; this holds for `dev` and hot reload by the `@next/env` reading above, confirmed again by the scripted test.
- The existing wrapped reader in `run` is reused so a locked file still fails closed with exit 2.
- Over-matching (the case-insensitive regex also matches a differently cased `export`, which Next itself would not parse) can only cause an extra refusal, consistent with the existing `NEXT_PUBLIC_SIMAP_DEV_PROD` check.
- Verification at IMPLEMENT time may change my reading of the Windows case-variant behaviour; the refusal stays regardless.

## Blocking questions
None

## Split proposal
None (estimated under 200 changed lines).
