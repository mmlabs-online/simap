Status: READY

# Plan — SIM-030: Pin the `dev:prod` org for the running server

**High path: YES.** `src/server/http/dev-token.ts` and its test match `src/server/http/**`. The ticket Gate is
`plan-approval`, so Ming approves this plan before IMPLEMENT. `.env.example` (also High) is deliberately not changed
(Decision 2). Two non-blocking decisions for Ming are under `## Assumptions`.

## Scope summary
Ticket `## Goal`:
> A running `pnpm dev:prod` stays on the org it checked at startup, so a token change in another terminal or a stray
> `.env*` setting can never send production edits to a different org.

Ticket `## Scope`:
> - `dev:prod` passes the org it checked to the child as `SIMAP_DEV_EXPECTED_ORG`.
> - When `SIMAP_DEV_EXPECTED_ORG` is set, the server's dev-token path sends no token if the file's `org` differs
>   (case-insensitive) and warns with a new `wrong_org` reason that contains no token value; the request gets the normal
>   401. A refreshed token for the same org keeps working without a restart.
> - `dev:prod` refuses (exit 2, value never printed, before the password prompt) when `.env.local`,
>   `.env.development.local`, `.env.development` or `.env` sets `SIMAP_DEV_ORG`.
> - `tokenOrg` accepts only a UUID, matching the verifier.

`work/decisions.md` D56:
> The production DB is reachable from dev only through the pg-tunnel with the URL given at runtime, and dev scripts refuse it. [...] keep production data safe (Ming)

`CLAUDE.md` R6:
> every query of org data is scoped by the verified token's `org` claim

Source findings: `work/tickets/SIM-029/security-review.md` Attempt 3, lines 101-118 (findings 1, 2, 3).

Out of scope (ticket): `heapsnapshot` in `NODE_OPTIONS`, `PG*` stripping, lone-CR and split-line `.env` forms, the
`CLAUDE.md` Commands entry, org switching inside a running app.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | With `SIMAP_DEV_EXPECTED_ORG=A`, a token file for org B produces no `Authorization` header, one `wrong_org` warning without the token value, and a 401. | `dev-token.test.ts` › "pin: other-org file gets no header and warns once without the token"; `token.test.ts` › "pin: other, missing and non-string org are wrong_org". The 401 for a null header is already covered by `with-auth.test.ts:75`. |
| 2 | With `SIMAP_DEV_EXPECTED_ORG=A`, replacing the file with a fresh org A token (any letter case) works on the next request without a restart. | `dev-token.test.ts` › "pin: swap B to A recovers on the next request, no restart"; `token.test.ts` › "pin: comparison ignores case". An uppercase **claim** passes the pin and is then refused by the verifier: see Decision 1. |
| 3 | `dev:prod` starts the child with `SIMAP_DEV_EXPECTED_ORG` set to the checked org, and a value for it in a `.env*` file cannot replace that value. | `dev-prod.test.ts` › "child gets the checked org as the pin", "pin replaces an inherited value in any letter case". Next precedence: `@next/env@16.4.6` `dist/index.js`, evidence under Approach step 5. |
| 4 | `dev:prod` exits 2 before the password prompt when any of the four `.env*` files sets `SIMAP_DEV_ORG`, and never prints the value. | `dev-prod.test.ts` › "each of the four .env files setting SIMAP_DEV_ORG: exit 2, no prompt, value not printed". |
| 5 | A non-UUID `org` claim is treated as no org: `dev:prod` does not start on it and never prints it. | `dev-prod.test.ts` › "non-UUID org claims are no org: no start, not printed", "tokenOrg agrees with isCanonicalUuid". |
| 6 | Plain `pnpm dev` (no `SIMAP_DEV_EXPECTED_ORG`) behaves as before, and all Checks are green. | `token.test.ts` › "no pin: any org passes as before"; `dev-token.test.ts` › "no pin: behaves as before"; all existing tests unchanged in intent. Run `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |
| 7 | Risk note: the pin stays dev-only, with no effect in `next build` output. | After `pnpm build`: `rg -l "SIMAP_DEV_EXPECTED_ORG" .next/static .next/server` prints nothing. `git diff main -- src/server/http/with-auth.ts` is empty. |

## Ming verification after merge
Needs M-3 and the real tunnel (ticket `## Test plan`):
1. Run `pnpm dev:prod` for org A.
2. In a second terminal run `pnpm dev:token --org B`. The next `/api/me` is 401 with one `[dev-token]` warning.
3. Run `pnpm dev:token --org A`. The next `/api/me` is 200 without a restart.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `scripts/dev-prod.mjs` | Strict `tokenOrg` (:39-42); `envFileSetsKey` (:56-61); pin in `childEnv` (:67-76); four-file check at step 3 (:155-162); single checked org for banner and pin (:170-173); `readEnvFile` dep (:233-239) | Scope items 1, 3, 4 | No |
| `scripts/dev-prod.test.ts` | Driver takes per-file `.env` content; new tests below | Test plan | No |
| `src/lib/dev-token/token.ts` | `wrong_org` in `Reason` (:7-15) and `warningFor` (:82-99); shared payload decode (:27-35); `expectedOrg` param on `devAuthorizationFor` (:72-80) | Scope item 2, pure logic first | No |
| `src/lib/dev-token/token.test.ts` | Pin tests; `wrong_org` in the `reasons` list (:104-112) | Test plan | No |
| `src/server/http/dev-token.ts` | Pass `process.env.SIMAP_DEV_EXPECTED_ORG` to `devAuthorizationFor` (:48-51) | Scope item 2 | **Yes** (`src/server/http/**`) |
| `src/server/http/dev-token.test.ts` | Pin tests through real temp files; `jwt` helper gains an optional org (:8) | Test plan | **Yes** (`src/server/http/**`) |
| `README.md` | `## Production database (dev)` steps 1, 3, 4 (:51-60): the pin, the four-file refusal, the `wrong_org` recovery | The behaviour changes what Ming sees | No |

Must **not** change: `src/server/http/with-auth.ts` (the guard at :111-115 already wraps the only path to the pin),
`src/server/identity/verify.ts`, `scripts/dev.mjs`, `.env.example`.

## Data model / migration
None.

## API contract
None. No endpoint or response shape changes. A pinned mismatch uses the existing `401 unauthenticated`
(`with-auth.ts:65`).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `token.test.ts` › "pin: same org returns the header" | AC2 |
| `token.test.ts` › "pin: comparison ignores case" (upper pin with lower claim, lower pin with upper claim) | AC2 |
| `token.test.ts` › "pin: other, missing and non-string org are wrong_org" (other UUID, no `org`, `5`, `null`, `""`, padded) | AC1 |
| `token.test.ts` › "pin: request refusal and token status still come first" (`host` and `expired` keep their reason) | AC1 |
| `token.test.ts` › "no pin: any org passes as before" (`undefined`, `null`, `""`) | AC6 |
| `token.test.ts` › `wrong_org` added to the existing "names ... never the token" list | AC1 |
| `dev-token.test.ts` › "pin: other-org file gets no header and warns once without the token" (two requests, one warning) | AC1 |
| `dev-token.test.ts` › "pin: swap B to A recovers on the next request, no restart" | AC2 |
| `dev-token.test.ts` › "no pin: behaves as before" | AC6 |
| `dev-prod.test.ts` › "child gets the checked org as the pin" | AC3 |
| `dev-prod.test.ts` › "pin is the org checked at startup, after a dev:token refresh too" (`tokens: [OTHER_ORG, FRESH]` with `SIMAP_DEV_ORG`) | AC3 |
| `dev-prod.test.ts` › "pin replaces an inherited value in any letter case" (`SIMAP_DEV_EXPECTED_ORG` and `simap_dev_expected_org` in the parent env; exactly one case-variant key remains) | AC3, Windows |
| `dev-prod.test.ts` › "each of the four .env files setting SIMAP_DEV_ORG: exit 2, no prompt, value not printed" (sentinel value, message names the file) | AC4 |
| `dev-prod.test.ts` › "commented or look-alike SIMAP_DEV_ORG lines do not refuse" (`# SIMAP_DEV_ORG=x`, `SIMAP_DEV_ORG_X=1`) | AC4 |
| `dev-prod.test.ts` › "envFileSetsKey matches every assignment form" (the existing `DATABASE_URL` table, run for both keys) | AC4 |
| `dev-prod.test.ts` › "DATABASE_URL is still checked in .env.local only" | AC6 |
| `dev-prod.test.ts` › "non-UUID org claims are no org: no start, not printed" (`" "`, ESC sequence, `not-a-uuid`, uppercase UUID, nil UUID, padded UUID) | AC5 |
| `dev-prod.test.ts` › "tokenOrg agrees with isCanonicalUuid" (shared table; import `../src/lib/validate/uuid`) | AC5, no drift |

All `.env*` inputs are injected strings. No test reads a real `.env*` file or the real token file.

## Approach
1. **`src/lib/dev-token/token.ts` (pure, R1).** Factor the decode in `expOf` into a private `payloadOf(token)`. Add a
   private `orgOf(token)` that returns the claim only when it is a string. Add `"wrong_org"` to `Reason`. Change the
   signature to `devAuthorizationFor(req, result, expectedOrg?: string | null)`. After the existing refusal and status
   checks, when `expectedOrg` is non-empty and `orgOf(result.token)?.toLowerCase() !== expectedOrg.toLowerCase()`, return
   `{ header: null, reason: "wrong_org" }`. Do not trim either side, so a padded value fails closed. The fixed warning:
   `[dev-token] token is for another org than this server was started with - run pnpm dev:token --org <the org in the dev:prod banner>`.
   It contains no token and no org value.

2. **`src/server/http/dev-token.ts` (High).** Pass `process.env.SIMAP_DEV_EXPECTED_ORG` as the third argument at :48-51.
   Keep the read uncached so a same-org refresh needs no restart.

   **How the unverified claim is contained.** The claim is used only for the pin comparison, and the comparison can only
   withhold a token. The compared bytes and the forwarded bytes are the same `result.token` from one file read, so a swap
   between compare and send is impossible. `with-auth.ts:57-59` still verifies that string (ES256), and org scope comes
   only from `v.identity.org` (`with-auth.ts:67,71`), so R6 holds. A forged payload that passes the pin fails verification.

3. **Dev-only guard (SIM-028).** The pin is read only inside `devAuthorization`. That function is reachable only through
   the `await import("./dev-token")` inside `process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SIMAP_DEV_TOKEN === "1"`
   (`with-auth.ts:111-115`). Do not read the variable anywhere else, do not prefix it `NEXT_PUBLIC_`, and do not add it to
   `next.config`. AC7 confirms this on the real build output. If the name appears there, stop and record it: do not
   widen the change.

4. **`scripts/dev-prod.mjs`.**
   - `tokenOrg`: accept only the verifier's pattern, copied from `src/lib/validate/uuid.ts:1` because a plain Node script
     cannot import that TS file. The parity test prevents drift. The check is case-sensitive like the verifier, so the
     banner can only ever print a lowercase canonical UUID, which closes the terminal-injection path of finding 3.
   - Change the "has no org" message (:122) to "has no valid org". Keep the `pnpm dev:token --org <uuid>` hint.
   - `envFileSetsKey(text, key)`: the existing matcher with a fixed key, built with `﻿` rather than a literal BOM.
     Keep `envFileSetsDatabaseUrl` as a one-line wrapper. Keys are constants, never input.
   - Replace the `readEnvLocal` dep with `readEnvFile(name)`, which returns the text or `null`. At step 3, keep the
     `DATABASE_URL` check on `.env.local` unchanged, then loop over
     `[".env.development.local", ".env.local", ".env.development", ".env"]`. On a match:
     `err("[dev:prod] <file> sets SIMAP_DEV_ORG: remove that line and set it in the shell")`, `return 2`.
   - **How values stay unprinted:** file text goes only into the boolean matcher. It is never stored, logged or put in an
     error, and the outer catch (:175-177) prints a fixed message. An unreadable file counts as not set, as Next skips it
     too (it logs the failure and loads nothing from that file).
   - `childEnv(env, url, tokenFile, org)`: drop every key whose uppercase form is `SIMAP_DEV_EXPECTED_ORG` (Windows env
     names are case-insensitive), then set `SIMAP_DEV_EXPECTED_ORG: org`.
   - Compute `const org = tokenOrg(token)` once, from the in-memory token that passed the check, and use it for both the
     banner and the pin. Do **not** re-read the file: a swap during the password prompt must not move the pin.

5. **Next keeps the process value (verified in `@next/env@16.4.6` `dist/index.js`, not assumed).**
   - Files loaded in dev, in order: `.env.development.local`, `.env.local`, `.env.development`, `.env`. These are the
     ticket's four files.
   - `expand` uses the existing `process.env[key]` when the key is present. `processEnv` copies a parsed value only when
     the key is undefined in the startup snapshot.
   - An `.env` hot reload first calls `replaceProcessEnv(snapshot)`, and the snapshot holds the pin, so editing a file
     while the app runs cannot change it.
   - `expand` also interpolates `$` in a kept process value. A canonical UUID contains no `$`, so the pin is unaffected.

6. **README.** Update steps 1, 3 and 4 of `## Production database (dev)`. Say that `SIMAP_DEV_EXPECTED_ORG` is set by
   `dev:prod` and must not be set by hand.

Rules: R1 (pure logic in lib, server imports lib), R3 (no value in code, logs or the client bundle), R4 (file list above),
R5 (tests listed), R6 (step 2). R2 does not apply. Estimated diff: about 200 lines, mostly tests.

## Specialist input used
No consult files: the ticket's only Area, `security`, has no consult agent in `loop.config.md`. The findings in
`work/tickets/SIM-029/security-review.md` Attempt 3 are adopted as follows:
- Finding 1: adopted, including its same-org and other-org swap tests.
- Finding 2: adopted with the preferred four-file coverage, which the ticket requires.
- Finding 3: adopted, with the verifier's exact (lowercase) pattern.

## Assumptions

### Decisions for Ming (non-blocking; the plan applies the default unless Ming says otherwise)
1. **Uppercase `org` claim in a token.** The ticket's AC2 says an org A token in "any letter case" works, but the
   verifier accepts only lowercase UUIDs (`src/lib/validate/uuid.ts:1,3`, `src/server/identity/verify.ts:147`), so a token
   whose claim is uppercase gets 401 `org_invalid` whatever the pin does.
   **Default:** keep the verifier strict. The pin comparison ignores case as the ticket says, and such a token passes the
   pin and is then refused with a 401 (fails closed). Identity-issued lowercase tokens work normally. The alternative,
   loosening the verifier, would change production auth and is outside this ticket.
2. **`.env.example`.** R3 keeps config names there, but `SIMAP_DEV_EXPECTED_ORG` is an internal handoff from `dev:prod` to
   its child, not a setting, and listing it invites someone to set it.
   **Default:** do not add it, and document it in the README instead. This also keeps `.env.example` out of the diff.
   The planner could not read `.env.example` (access denied by permissions), so its current content is unchecked.

### Other assumptions
- A stale `SIMAP_DEV_EXPECTED_ORG` in the shell or a `.env*` file under plain `pnpm dev` pins that server too. It fails
  closed with the `wrong_org` warning, and `scripts/dev.mjs` stays unchanged.
- The `.env*` matcher is exact-case for `SIMAP_DEV_ORG`, like the `DATABASE_URL` check. Nothing in `src/` reads that
  variable, so the check only catches a conflicting intent.
- A multi-line quoted value containing a `SIMAP_DEV_ORG=` line causes a false refusal, which fails closed.
- Hotspots: the only other open ticket is SIM-027 (`IN_PROGRESS`), which names `next.config.ts` / `src/proxy.*`. No
  overlap with this file list, so no rebase is expected.
- The planner has no shell in this run, so the Next and code findings come from reading source. No check or build was
  run; AC7 is the build-time confirmation.

## Blocking questions
None.

## Split proposal
None. About 200 changed lines, one implement/review cycle.
