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
