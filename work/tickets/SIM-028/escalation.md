# Escalation — SIM-028: Signed-in local dev with a server-side dev token

| Field | Value |
|---|---|
| Attempts | 3 (2 reworks) |
| Date | 2026-11-21 |

## What was asked
Slice 1 of signed-in local dev (D56, plan decisions A-G): `pnpm dev:token` writes an Identity token outside the repo;
`pnpm dev` runs `next dev` on loopback only and the server adds that token as bearer to same-origin `/api/*` through
`withAuth`. Key AC3: the injection refuses to run unless the dev server listens on loopback.

## What failed, per attempt
| Attempt | Main issues from review | Fixed in next attempt? |
|---|---|---|
| 1 | Reviewer 🔴 / security 🟡: attached `-H0.0.0.0` passes the launcher, Next binds all interfaces. | Yes |
| 2 | Reviewer PASS. Security 🟡 ×2: a host flag swallowed as another option's value drops the default `-H 127.0.0.1`; `--inspect 0.0.0.0:9229` opens the inspector to the LAN. PR #28 opened; Ming asked to fix both before merge. | Yes (both as reported) |
| 3 | Reviewer REWORK: `NODE_OPTIONS="--inspect --debug-port=0.0.0.0:9229"` not caught. Security 🟡: appending `-H 127.0.0.1` last is defeated by a trailing `--` (`pnpm dev . --`) or a value-taking option as the last arg (`pnpm dev . --experimental-https-key`); 🟢 quoted `NODE_OPTIONS` spellings. | — |

Everything else is green in every attempt: format, typecheck, check:layers, 810 tests, build, no dev-token strings in
`.next/static`, production guard folds to false, token always goes through the normal verifier.

## Likely root cause
Wrong approach for the launcher: it tries to **filter** arbitrary user arguments for an external CLI parser
(Next's bundled commander) by blocklist. Each fix closes the reported spelling and the next review finds another
(attached values, value-taking options, `--` operands, inspector aliases, quoting). The server-side part is sound;
only `scripts/dev.mjs`'s argument handling keeps failing.

## Options for Ming
1. **Allowlist instead of blocklist (one more focused attempt).** `pnpm dev` accepts only `--port <n>` / `-p <n>`
   (maybe `--turbopack`), refuses every other argument and any `--`; builds `["dev", "-H", "127.0.0.1", "--port", n]`
   itself; refuses to start when `NODE_OPTIONS` contains `inspect` or `debug` in any spelling. Closes the whole class;
   cost: no extra `next dev` flags in dev-token mode (use `pnpm exec next dev` without the token for those).
2. **Merge PR #28 as is and fix in a follow-up ticket.** The remaining bypasses need a deliberately odd command
   line typed by Ming; the token is still a real production credential, so exposure is real while it happens.
3. **Close PR #28 and drop the launcher approach** (e.g. revisit option (a): a local Identity proxy keeping the
   browser sign-in). Most rework; loses the approved plan.

## Recommendation
Option 1. It replaces the blocklist with a short allowlist, which is easy to review and test exhaustively, and keeps
everything else in PR #28 that already passed review. It needs Ming's approval because it changes plan Decision C
(`pnpm dev` passes user arguments through to `next dev`).
