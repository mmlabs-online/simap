# Security review — SIM-030

## Attempt 1

Verdict: PASS

No 🔴 or 🟡 findings. Two 🟢 notes follow. One Windows assumption was confirmed from memory of Node's source rather than executed, because this agent has no shell. Please run the one-line check in 🟢 1 before merge. If it prints `false`, 🟢 1 becomes a 🔴 and the verdict changes to REWORK.

### Findings

#### 🟢 1. The `.env*` case-variant defence depends on an unexecuted Windows behaviour
- **Where:** `scripts/dev-prod.mjs:80-81` handles inherited variants only. File-based variants are handled by `expand` in `node_modules/.pnpm/@next+env@16.4.6/node_modules/@next/env/dist/index.js`.
- **Scenario:** `.env.local` contains `simap_dev_expected_org=<org B>` or an empty value. The `processEnv` check uses a plain-object snapshot, which is case-sensitive, so it does not stop this key.
- **Why it should still be safe:** `expand` runs first. It uses `hasOwnProperty.call(process.env, key) ? process.env[key] : parsed[key]`. On Windows that lookup should be case-insensitive, so the parsed value is replaced by the pin before anything is written back.
- **Check (PowerShell):**
  `$env:SIMAP_X='a'; node -e "console.log(Object.prototype.hasOwnProperty.call(process.env,'simap_x'))"; Remove-Item Env:SIMAP_X`
  Expected: `true`.
- **If `false`:** a lowercase `.env*` line replaces or blanks the pin, and AC3 fails. The fix is to make the `.env*` refusal loop also reject any case variant of `SIMAP_DEV_EXPECTED_ORG`.
- **Follow-up:** no test covers this path. Refusing case variants of that key in the four files would remove the dependency on Next internals.

#### 🟢 2. AC7's literal check does not pass, but the code is dead
- **Where:** `.next/server/chunks/[root-of-the-server]__027k0ohra5rgo._.js`, and plan AC7 at `work/tickets/SIM-030/plan.md:43`.
- **Risk:** the plan expects `rg -l` to print nothing, but this chunk contains the name. The route traces (`.nft.json`) list the chunk, so it is probably copied into the standalone image as inert code.
- **Why it is unreachable:**
  - The production `withAuth` chunks fold the guard to `...!1`, so `authorization` is never set.
  - `authorization:async` appears nowhere in `.next/server`.
  - Module 54690 (dev-token) is referenced only by loader module 12929, and no `.js` file under `.next/server` calls 12929.
  - `.next/static` has no match.
- **Fix:** record AC7 as "no reachable path" in the review, and reword the criterion. The implementer already logged the hit at `work/tickets/SIM-030/impl-log.md:26`. No code change is needed.

### Checked, no issue

**(a) Org pin**
- The pin comes from the in-memory token that passed the check (`dev-prod.mjs:127-132,190`), so a swap during the password prompt cannot move it.
- It cannot be missing or empty after startup, because `tokenIsFresh` requires a canonical org.
- A later token for another org is withheld (`token.ts:95`). A missing or non-string claim is also withheld.
- An uppercase `.env*` value loses to the process value, and a hot reload restores the snapshot synchronously.
- Inherited case variants are removed. Node on Windows also prefers the sorted-first uppercase key for the token-file and flag variables.
- A shell `NODE_ENV=production` should not disable the guard, because `define-env.js:76` inlines `development` for `next dev`. This was read, not run.

**(b) Authentication**
- The unverified claim can only turn a header into `null`.
- The compared and forwarded token are the same string from one read.
- `with-auth.ts:57-71` still verifies it, and org scope comes only from the verified identity.
- An uppercase claim passes the pin and is then refused by the verifier (`verify.ts:147`), as Ming approved.

**(c) Production build:** unreachable, see 🟢 2.

**(d) Secrets**
- `wrong_org` is a fixed string.
- `.env*` text only reaches a boolean matcher, and error messages name the file only.
- The password and DB URL travel in the child environment, not argv, and the outer catch prints a fixed message.

**(e) Plain `pnpm dev`**
- `scripts/dev.mjs` does not set the pin, and an unset or empty pin skips the comparison (`token.ts:95`, tests at `token.test.ts:136-138` and `dev-token.test.ts:96-100`).
- A hand-set value would pin plain dev too. It fails closed and is an accepted plan assumption (`plan.md:175`).

### Limits
- This was a static review. I did not run the checks, tests, build or the live M-3 tunnel scenario.
- I did not read any `.env*` file or the real token file.
- I had no `git diff`, so the `with-auth.ts` "unchanged" status comes from the brief and was not verified. AC7's `git diff main -- src/server/http/with-auth.ts` still needs to be run.

### Follow-ups
- Add the `.env*` case-variant refusal and a test for it (🟢 1).
- Reword AC7 (🟢 2).

### Orchestrator check (2026-11-21)
- 🟢 1 one-line check run in PowerShell on Node 22: printed `true`, so the verdict stays PASS.
- `git diff origin/main...HEAD -- src/server/http/with-auth.ts`: empty.
