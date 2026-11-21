# Security review — SIM-028.1

## Attempt 1

Verdict: REWORK

SIM-028.1 security review, attempt 1. Dev mode cannot activate in a normal production build, and no token reaches the browser. The rework is for the production-data badge (Ming's Decision 1 = C): it is missing on one screen that writes to production, and `.env*` files can suppress or fake it.

### Findings

🔴 **F1. First-visit profile form writes to production with no red badge**
- Where: `d:\project\simap-game-ui\src\ui\auth\DevGate.tsx:173-182`, `:148`; `d:\project\simap-game-ui\src\ui\AppShellView.tsx:95,100`
- Scenario: under `pnpm dev:prod`, an account with no display name gets `view.kind === "profile"`. `DevGate` renders `ProfileView` without `AppShell`, and `session` is null there, so no badge can render. Submitting sends a real `PATCH /api/me` to the production database.
- Impact: limited to that user's own display name. This is not an access bypass. It is a blocker because the badge exists to warn before real writes, and this is the one write path outside the shell.
- Fix: when `prodData` is true, render a persistent red notice using `devTokenCopy.prodBadge` above `ProfileView`, inside `DevGate` so the strings stay out of production. Preferably cover every non-ready `DevGate` view. Add a render test.

🟡 **F2. `.env*` values can suppress or fake the badge**
- Where: `d:\project\simap-game-ui\scripts\dev.mjs:49-53`, `d:\project\simap-game-ui\scripts\dev-prod.mjs:82-92,180-186`; loader in `node_modules/.pnpm/@next+env@16.4.6/node_modules/@next/env/dist/index.js`
- False red: `devEnv` cleans only the inherited environment. Next then loads `.env*`, so `NEXT_PUBLIC_SIMAP_DEV_PROD=1` in `.env.local` shows "Production data" under plain `pnpm dev`. This contradicts `README.md:43` ("plain `pnpm dev` never shows it").
- Missing red on Windows: `@next/env` checks for existing keys case-sensitively on a plain-object copy, then does `Object.assign(process.env, u)`. A `.env.local` line `next_public_simap_dev_prod=0` passes that check and, because Windows env names are case-insensitive, should overwrite the launcher's `1`. `dev:prod` then shows the amber badge against production. This is from reading the loader; I did not run it.
- Fix: both launchers refuse to start (exit 2, value not printed) if `.env.development.local`, `.env.local`, `.env.development` or `.env` sets this key in any letter case. `envFileSetsKey` (`dev-prod.mjs:60-65`) is case-sensitive, so it needs a case-insensitive mode. Add tests for both directions.

🟢 **F3. `README.md:64` is wrong:** it says `dev:prod` "does not load `.env.local`", but the launcher only skips it; the `next dev` child loads it. Correct this with F2.

🟢 **F4. `next build --debug-prerender` is the one build route to dev mode.** It sets `NODE_ENV=development` and `allowDevelopmentBuild` (`next/dist/bin/next:118-120`, `next/dist/server/config.js:1491-1495`, `define-env.js:76`). Combined with `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1`, the guard stays true. The Dockerfile (`:15`) and CI (`ci.yml:58`) use plain `pnpm build` and set neither, so this needs a deliberate change. `check:dev-bundle` would catch it, but CI does not run it yet (see Follow-ups).

🟢 **F5. `FORBIDDEN` has no `SIMAP_DEV_TOKEN` marker** (`d:\project\simap-game-ui\scripts\check-dev-bundle.mjs:8-19`). The `DevGate` chunk would still be caught by its copy strings, but a surviving guard without that chunk would not. Add the marker.

🟢 **F6. Swapping the token file does not remount open screens** (`DevGate.tsx:101-105`). Under plain `pnpm dev`, re-running `pnpm dev:token --org <other>` leaves the old org's data on screen while new requests use the new org. The server still scopes by the verified token, and `dev:prod` is protected by its org pin for a different org. Local confusion only.

### Answers

1. **Production activation: no, for normal builds.** The guard is an inline literal at `AuthGate.tsx:58-61`, and `define-env.js:76` makes `NODE_ENV` `production` in `next build`, including when the shell sets `NODE_ENV=development`. A runtime `NEXT_PUBLIC_SIMAP_DEV_TOKEN` has no effect on the built client, and the server guard (`with-auth.ts:111-112`) folds the same way. The only exception is F4. `check:dev-bundle` scans all of `.next/static` including maps, and fails on a missing or empty directory or a read error. It cannot tell whether the build is stale.
2. **`dev-fetch`: yes to all.** It enforces the `/api/` prefix, deletes `Authorization` in any case, forces `no-store` and `redirect: "error"`, and sends once, so it cannot repeat a write (R7). Production `apiFetch` as it stands keeps its re-send logic and matches the plan's "export only" change, but see Limits.
3. **Token, claim or secret exposure: none found.** The token is added server-side only, dev-token warnings are fixed strings, `DevGate` does not log or store anything, and error views use fixed copy. `DATABASE_URL` has no `NEXT_PUBLIC_` prefix. The terminal banner prints the org UUID by design.
4. **Badge: yes, it can fail both ways** (F1, F2). Inherited case variants are handled correctly; `.env*` values are not. The flag grants no access.
5. **R1 and authorization: no violation found.** `DevGate` imports only ui and lib, and no `src/ui` file imports server code. `session.devToken` is read only in `AppShellView` for the badge and for hiding sign-out. Authorization stays in `withAuth`.

### Follow-ups (out of scope)
- 🟡 The same Windows case-variant override likely affects other `dev:prod` values: `simap_dev_expected_org` in `.env.local` could replace the org pin, and `database_url` evades the case-sensitive check at `dev-prod.mjs:174`. Harden this in SIM-029 code, ideally with the F2 helper.
- Add `pnpm check:dev-bundle` to CI and the release path (already planned).

### Checked and limits
- Read all listed changed code except the `package.json` and `README.md` parts unrelated to this feature, plus `with-auth.ts`, `dev-token.ts`, `token.ts`, the Dockerfile, `.dockerignore`, `next.config.ts`, and the relevant Next 16.4.6 sources.
- A tab left open across a switch from `pnpm dev` to `dev:prod` reloads when HMR reconnects (`web-socket.js:81-84`). Until then it still shows the old badge.
- This session had read and search tools only, so **I ran no checks, build, tests or `git diff`**. The bundle result, the Windows override in F2 and "only `export` changed" in `fetch.ts` are not confirmed by execution.
- As instructed, I did not read `.env*` files, the real dev-token file or `.next` output, so I do not know whether any local `.env*` file currently sets these flags.

## Attempt 2

Verdict: REWORK

SIM-028.1 security review, attempt 2. F1 and F5 are fixed. F2 is only partly fixed: the `.env*` refusal misses forms that Next's loader accepts, and it fails open on read errors. Either gap can bring back the case F2 was meant to stop, an amber badge while connected to production. There are no 🔴 findings: the badge grants no access, and both gaps need an unusual file or a transient error.

### Findings

🟡 **S1. The refusal parses `.env` differently from Next, so three forms get through**
- Where: `d:\project\simap-game-ui\scripts\dev.mjs:58-66`. Next's parser is in `d:\project\simap-game-ui\node_modules\.pnpm\@next+env@16.4.6\node_modules\@next\env\dist\index.js`.
- Cause: the launcher splits on `\r?\n` and tests each line. Next first converts `\r\n?` to `\n`, then runs one multiline regex whose `\s*=` can cross newlines and whose `^` also matches after U+2028/2029.
- Forms Next accepts and the launcher misses:
  - Lone CR: `A=1\rnext_public_simap_dev_prod=0`
  - Key and `=` on separate lines: `next_public_simap_dev_prod\n=0`
  - Line separator after a comment: `# note\u2028next_public_simap_dev_prod=0`
- Scenario: on Windows, `dev:prod` passes the check, Next loads the lowercase key, and per the override path from attempt 1 it replaces the launcher's `1`. The browser shows amber against production. With the uppercase key under plain `pnpm dev`, the same forms fake the red badge on any OS.
- Fix: replace the body of `envFileSetsKey`. `\s` already covers the BOM. A multiline quoted value containing the key now refuses, which is the safe direction.
```js
const re = new RegExp(
  String.raw`^\s*(?:export\s+)?${key}(?:\s*=|:(?:\s|$))`,
  ignoreCase ? "im" : "m",
);
return re.test(String(text).replace(/\r\n?/g, "\n"));
```
- Tests: add the three forms above to `scripts/dev.test.ts`.

🟡 **S2. A read error other than a missing file counts as "file absent" (fails open)**
- Where: `d:\project\simap-game-ui\scripts\dev.mjs:95-101` and `d:\project\simap-game-ui\scripts\dev-prod.mjs:265-271`. Both use a bare `catch { return null; }`.
- Scenario: an editor or antivirus briefly holds `.env.local` on Windows (`EBUSY`/`EPERM`). The launcher treats it as absent and continues. Next reads the file when it starts, which under `dev:prod` can be much later because the password prompt sits in between. The flag line then applies unchecked. In `dev-prod.mjs` the same reader also backs the `DATABASE_URL` and `SIMAP_DEV_ORG` refusals, so they fail open too.
- Fix: share one reader that returns `null` only for `ENOENT` and throws otherwise. `dev.mjs` `main` catches it and exits 2 with a fixed message naming the file. In `dev-prod.mjs`, return 2 the same way rather than relying on the outer `unexpected error` path. Never print the error object or file content. Add a test with a reader that throws `EBUSY`.

🟢 **S3. The check runs after the token and tunnel steps: not a data risk, but it has a cost**
- Where: `d:\project\simap-game-ui\scripts\dev-prod.mjs:130-193`.
- The ordering does not weaken the badge guarantee: the check still runs before the DB password prompt and before the app starts.
- A run that will be refused can still ask for the Identity password, rewrite the token file and start the tunnel container. The refusal leaves that tunnel running, so the production DB port stays open on loopback. This also contradicts "stops at the first failure with nothing started" (`README.md:52`).
- Fix: move the three `.env*` checks above step 1. They need only `readEnvFile`.

🟢 **S4. The check runs only at startup**
- Where: `setup-dev-bundler.js:308-314,649-664` in Next. It watches the same four files, reloads them and updates `defineEnv`.
- Scenario: adding the flag to `.env.local` during the password prompt or while the app runs bypasses the refusal. This needs a local edit during the session.
- Fix: a follow-up is enough, for example re-check right after the prompt and have `dev:prod` watch the four files and stop the app on a violation.

### Answers

1. **F1: fixed.**
   - All five non-ready views are wrapped (`DevGate.tsx:196-213`), including the profile form, the only write outside the shell.
   - Every `ready` session gets `devBadge(prodData)` (`:129-133`), and the shell renders it whenever a session exists (`AppShellView.tsx:95-111`). It does not depend on `orgName`.
   - Two moments show no notice, and neither can write: the `Suspense` fallback (`AuthGate.tsx:67`) and the `CheckingView` child on `/sign-in` while it redirects (`SignInRoute.tsx:11-13`).
   - The notice strings live only in `DevGate.tsx` and `copy/dev-token.ts`, and only `DevGate` imports that copy outside tests, so they stay in the lazy chunk.
2. **F2: partly fixed.**
   - Covered: all four files (same list as Next), any letter case, `export`, leading spaces, BOM and CRLF.
   - The value is never printed, and the check runs before the DB password prompt.
   - Not covered: the forms in S1 and read errors in S2. Ordering is in S3.
3. **F5: fixed.** `SIMAP_DEV_TOKEN` is in `FORBIDDEN` (`check-dev-bundle.mjs:16`). The substring match also catches `NEXT_PUBLIC_SIMAP_DEV_TOKEN`, and the existing test loops over every marker.
4. **Regressions:** none found in the changed lines beyond S1 and S2. Importing `dev.mjs` from `dev-prod.mjs` is safe because `main` is guarded.

### What I checked and my limits

- Read: the ticket, attempt 1 review, impl-log, both launchers, `check-dev-bundle.mjs`, `DevGate.tsx`, the relevant parts of `AuthGate.tsx` and `AppShellView.tsx`, `SignInRoute.tsx`, the copy file, the related tests, the README section, and the Next 16.4.6 env loader and dev watcher.
- This session had read and search tools only, so **I ran no checks, build, tests or `git diff`**. S1 comes from tracing both regexes by hand, and the proposed regex is not executed. The Windows override is still from reading the loader. The impl-log's green check results are its own claim.
- No live browser check, so I did not confirm how the fixed notice looks or whether it overlaps the form.
- The public pages outside `AuthGate` (`/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`) were not reviewed. They do not render `DevGate` or the shell.
- As instructed, I did not read `.env*` files, the real dev-token file or `.next` output, so I do not know whether any local `.env*` file currently sets this flag.
- Not re-reported, as agreed: `.env.example`, F4, F6 and case-variant hardening of other keys.

## Attempt 3

Verdict: REWORK

SIM-028.1 security review, attempt 3. The S1 parser fix and the S2 fail-closed fix are both correct. The rework is for one remaining bypass of the same guarantee: with `NODE_ENV=test` inherited, Next loads two `.env` files the launchers never check. There are no 🔴 findings: the badge grants no access, and the bypass needs both that shell variable and such a file.

### Findings

🟡 **S5. With `NODE_ENV=test`, Next loads `.env.test.local` and `.env.test`, and the launchers do not check them**
- Where: `d:\project\simap-game-ui\scripts\dev.mjs:50-55` (`devEnv` passes `NODE_ENV` through) and `:96` (`ENV_FILE_NAMES`). `childEnv` at `d:\project\simap-game-ui\scripts\dev-prod.mjs:81-98` inherits this through `devEnv`.
- Cause, in Next 16.4.6:
  - `next/dist/bin/next:80` and `next/dist/server/lib/router-server.js:126-129` set `NODE_ENV` only when it is unset, so `test` survives under `next dev`.
  - `@next/env/dist/index.js` then picks its file list from `NODE_ENV`. For `test` it is `.env.test.local`, `.env.test`, `.env`.
  - `next/dist/build/define-env.js:76` still inlines `NODE_ENV` as `development` because `dev` is true, so the `DevGate` and `with-auth.ts:111` guards should stay active.
- Scenario 1 (Windows): the shell has `NODE_ENV=test` and `.env.test.local` contains `next_public_simap_dev_prod=0`. `pnpm dev:prod` passes every check, Next applies the lowercase key over the launcher's `1`, and the browser shows amber against production.
- Scenario 2 (any OS): the same setup with `NEXT_PUBLIC_SIMAP_DEV_PROD=1` in `.env.test` fakes the red badge under plain `pnpm dev`.
- Correction: my attempt 2 said the launcher covers the "same list as Next". That holds only when `NODE_ENV` is not `test`.
- Fix: force the mode in `devEnv`, which covers both launchers and keeps the four-file list correct:
```js
for (const k of Object.keys(copy)) {
  const u = k.toUpperCase();
  if (u === "NEXT_PUBLIC_SIMAP_DEV_PROD" || u === "NODE_ENV") delete copy[k];
}
return { ...copy, NODE_ENV: "development", NEXT_PUBLIC_SIMAP_DEV_TOKEN: "1" };
```
- Tests: update the `devEnv` expectations at `d:\project\simap-game-ui\scripts\dev.test.ts:200,209`, and add a case that `NODE_ENV: "test"` and `node_env: "test"` both come out as a single `NODE_ENV: "development"`. Add a `childEnv`/`run` assertion in `dev-prod.test.ts`.

🟢 **S6. The new read-failure message says "nothing started", which can be false under `dev:prod`**
- Where: `d:\project\simap-game-ui\scripts\dev.mjs:78`, used at `d:\project\simap-game-ui\scripts\dev-prod.mjs:220`, and pinned by `d:\project\simap-game-ui\scripts\dev-prod.test.ts:198`.
- Scenario: the tunnel container is stopped, so `dev-prod.mjs:163` starts it. `.env.local` then returns `EBUSY`. The user is told nothing started while the production DB port is open on loopback.
- Fix: say `app not started` in this message. Moving the checks above step 1 (S3, known) would also make the current text true.

🟢 **S7. The exit path in `dev.mjs` `main` has no test**
- Where: `d:\project\simap-game-ui\scripts\dev.mjs:123-130`.
- The reader is tested, and `dev-prod` `run` is tested with `EBUSY`, but nothing tests that plain `pnpm dev` exits 2 without spawning Next. The code is correct by reading. This can be a follow-up.

### Answers

1. **S1: fixed for the parser, with the file-list gap in S5.**
   - The launcher prefix matches Next's (`^\s*(?:export\s+)?`), with the same `\r\n?` normalisation and the `m` flag. Its suffix accepts everything Next's `\s*=` or `:\s+?` accepts, so any assignment Next parses for this key is refused, in any ASCII letter case.
   - Next's key pattern `[\w.-]+` is ASCII-only, so Unicode case-folding tricks do not apply.
   - Comments and look-alikes pass: `# KEY=`, `KEY_X=1`, and `OTHER=KEY=1`.
   - It over-refuses in three harmless cases: a line inside a multiline quoted value, `EXPORT KEY=`, and `KEY:` at end of file.
   - `DATABASE_URL` and `SIMAP_DEV_ORG` are not weakened. They stay case-sensitive and the new matcher accepts strictly more forms than the old one.
2. **S2: fixed.**
   - `makeEnvReader` (`dev.mjs:85-94`) returns null only for `ENOENT`. Every other error, including a thrown non-Error, becomes `EnvReadFailure`.
   - That error carries only the fixed file name, with no cause, path or content.
   - Both launchers exit 2 with a fixed message. In `dev:prod`, all three checks run before the prompt at `dev-prod.mjs:205`.
   - Two bare catches remain nearby, and neither fails open on `.env`. `dev-prod.mjs:182` converts to `EnvReadFailure`. `dev-prod.mjs:265` reads the token file, where null only leads to a refresh or refusal.
3. **Regressions:** the only issue in the changed lines is the message in S6. S5 predates this attempt.

### What I checked and my limits

- Read: the ticket, earlier security reviews, impl-log Attempt 3, both launchers, the relevant test sections, and the `@next/env` parser and file loader. Also the Next CLI, `router-server.js`, `config.js`, `define-env.js`, and the `NODE_ENV` guards under `src/server` and `src/ui/auth`.
- **I ran nothing**: no tests, build, checks, `git diff` or live launcher. S5 and the regex comparison are traced by hand, and the Windows override is still from reading the loader. The impl-log's green results are its own claim.
- I did not confirm in a running Turbopack server that the guards stay active under `NODE_ENV=test`.
- I assumed the launchers run from the repo root, as `pnpm dev` does. Running the script directly from another directory would make Next read a different set of `.env` files.
- As instructed, I did not read `.env*` files, the real dev-token file or `.next` output, so I do not know whether a `.env.test*` file exists or whether any local file sets this flag.
- Not re-reported, as agreed: S3, S4, F4, F6, `.env.example`, and case-variant hardening of other keys.
