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

## Attempt 2

Verdict: PASS

No 🔴, 🟡 or 🟢 findings. The line 51 change cannot disable the org pin while `dev:prod` runs. This comes from reading the code: I did not run the app or inspect compiled output.

**Scenario checked: shell `NODE_ENV=production` with `pnpm dev:prod`**

1. **The launcher does not change `NODE_ENV`.** `scripts/dev-prod.mjs:76-89` and `scripts/dev.mjs:47-49` pass it through, so the Next process inherits `production`.
2. **Next keeps the shell value at runtime.** `next/dist/bin/next:80` and `next/dist/server/lib/router-server.js:126-129` only set it when unset. `bin/next:63-72` just prints a warning for `dev`.
3. **The compiled value is still `development`.**
   - `next/dist/cli/next-dev.js:354` passes `isDev: true`, which `start-server.js:164` forwards as `dev`.
   - `hot-reloader-turbopack.js:302` hardcodes `dev = true` and passes it to `createDefineEnv` at lines 367-371.
   - `next/dist/build/define-env.js:76` then defines `process.env.NODE_ENV` as `development`, ignoring the shell value.
4. **Nothing in the project overrides that define.**
   - `next.config.ts` sets no `env`, `compiler.define` or `allowDevelopmentBuild`.
   - The `NEXT_PUBLIC_*` and config env spreads (`define-env.js:60-61`) come before line 76, so line 76 wins.
   - `compiler.define` and `defineServer` throw on a built-in key (`define-env.js:214-229`).
5. **Result:** `src/server/http/with-auth.ts:111` folds to true and `src/server/http/dev-token.ts:51` reads the pin from the runtime env.

**Could the dev-token path run with the pin undefined?**

That needs line 111 to see `development` while line 51 sees `production` in the same server.

- **Both inlined (expected):** they agree, as above.
- **Neither inlined:** both read `production`, the guard is false and `authorization` is never installed. A client header then goes through normal verification, so this fails closed.
- **Only one inlined:** I found no route to this. `dev-token.ts` is loaded only from `with-auth.ts:114`, in the same Node server compile, and `src` has no edge runtime declaration.
- **`NODE_ENV` changing at runtime:** `src` has no write to `process.env.NODE_ENV`.

**Other checks**

- **Production build:** line 76 inlines `production`, so the guard is false and line 51 folds to `undefined`. The `Dockerfile:19` runtime value matches.
- **Plain `pnpm dev`:** no pin is set, so behaviour is unchanged (`src/lib/dev-token/token.ts:95`).
- **Pin comparison:** `token.ts:95` is unchanged in logic. A wrong or missing org claim still withholds the token when a pin is set.
- **Related runtime read:** `src/server/identity/config.ts:24` reads the non-inlined `env.NODE_ENV`. With a shell `production`, a localhost or non-production issuer gets a 503. This is stricter and does not weaken the pin.
- **Secrets:** the change adds no logging or new output. I did not read any `.env*` file or the real token file.

**Limits**

- Turbopack's native define application was not read. The conclusion does not depend on it, because the non-inlined case fails closed.
- I did not inspect `.next` output, per the rule against reading build output.
- The webpack path was not traced. `scripts/dev.mjs:19-33` does not allow a `--webpack` flag, and `define-env.js:76` is shared by both bundlers.

**Follow-ups:** none new.
