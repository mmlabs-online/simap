# Consult — frontend-developer (SIM-028.1)

## SIM-028.1 consult (frontend): browser dev-token mode

### Findings (what changed since the SIM-028 consult)
- **The mode switch is now a build-time public flag, not a probe.** The ticket and `scripts/dev.mjs:48` use `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1`. `dev:prod` sets the same flag (`dev-prod.test.ts:370`). The server side (`src/server/http/with-auth.ts:111`) enables the dev `authorization` hook on `NODE_ENV==="development" && NEXT_PUBLIC_SIMAP_DEV_TOKEN==="1"`. The old consult's `/api/dev-session` probe and its open question 1 are moot. The client condition must mirror the server's so the two cannot disagree.
- **Reasons are invisible to the browser.** `devAuthorization` returns `null` for missing, malformed, expired, wrong_org and refusals. `withAuth` then answers a plain 401 `unauthenticated`. Reasons only reach the server console via `warningFor`. The browser therefore cannot tell missing from expired from wrong_org. Only two server answers are distinguishable: 401 `unauthenticated` and 403 `org_required`.
- **SIM-027 hardening is in `fetch.ts`.** `createApiFetch` now sets `cache:"no-store"` and `redirect:"error"`, refuses non-`/api/` input, and does not retry streams. `accessCodeOf` is still module-private (line 21) and needs `export`, as the ticket plans. `dev-fetch` should copy the `/api/` guard, `cache:"no-store"` and `redirect:"error"`, send once, and set no Authorization.
- **The shell is already tolerant.**
  - `AppShellView.tsx`: the switch button renders only if `actions.switchOrg` is set (lines 100-106).
  - Sign-out is an `IconButton` with `disabled={!actions.signOut}` (125-130). That is a disabled button, not hidden. The ticket says "hidden", so it needs a `devToken` conditional.
  - `session.orgName` renders in a plain span.
  - `Session` is `{tier,email,orgName?}`. `Session.devToken` is a new optional field.
- **Required `onSignOut`:** `ProfileView.tsx:22-29,88` and `NoAccessView` (`views.tsx:232-261`) are required and unconditional. Making them optional, with the button gated on the prop, is the planned edit. `NoOrgView` and `OrgPickerView` are never reached in dev mode.
- **`/api/me` returns `org: ctx.org` (the org UUID).** Check whether `readMeResult` / `MeView.ready` carries it. If it does, the badge or `orgName` can show a short org id for free.
- **Other users of `getAuthRuntime`:** `SignUpPage`, `ForgotPasswordPage`, `ResetPasswordPage` and `VerifyEmailPage` call `getAuthRuntime()` directly. They are Identity pages that sit outside `AuthGate` and are unaffected. In dev mode they still reach Identity if opened by URL. That is acceptable, but AC1 ("no request to api.mmlabs.online") holds only for the gated app routes.

### 1. Keeping DevGate out of the production bundle
- Write the guard as the literal expression `process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SIMAP_DEV_TOKEN === "1"`, inline, at the point of use. Do not hide it behind a helper, a destructure, or `process.env[name]`. Next only inlines literal `process.env.X` member access. For the production build, `NODE_ENV` is "production" and the flag is unset, so the condition folds to `false`.
- Put the `import("./DevGate")` (or `next/dynamic`) inside the true branch. Use `const DevGate = DEV ? lazy(() => import("./DevGate")) : null`, with `DEV` a module-level const holding that exact literal expression. Then `DevGate`, `dev-fetch`, `dev-flow` and the dev copy are reachable only from the dead branch.
- Static imports of any dev module from `AuthGate`, `session.ts` or `shell.ts` would pull it into the client bundle. `DevGate.tsx` is the only importer of `dev-fetch`, `dev-flow` and `copy/dev-token.ts`. Shared files may only gain small generic bits: the `devToken?` flag and the badge string.
- Never import `src/lib/dev-token/token.ts` from client code. It holds `[dev-token]` / `pnpm dev:token` strings and `warningFor`. `dev-flow` must be its own pure mapper.
- **The check script needs care.** Production minification renames `DevGate`, so a grep for `DevGate` proves nothing. The reliable markers are the user-visible or literal strings: `pnpm dev:token`, `[dev-token]`, `.config/simap`, and a unique sentinel string in `copy/dev-token.ts` (for example the `DevTokenView` title). Add that sentinel to the forbidden list. The badge label and tooltip ("Dev token") should live in `copy/shell.ts`, so it is in the production bundle by design. It must not be a forbidden string, and none of the forbidden strings may appear in `copy/shell.ts`.
- `scripts/check-dev-bundle.mjs` must exit non-zero if `.next/static` is absent, and must be tested against a synthetic dir. Also run it positively once, in dev mode (`NEXT_PUBLIC_SIMAP_DEV_TOKEN=1 next build` is not valid since `NODE_ENV` is production). So prove the negative only, and record that Next's dead-branch elimination was verified for the lazy chunk (chunk file absent, not only unreferenced).
- Make sure `NEXT_PUBLIC_SIMAP_DEV_TOKEN` is not set in the CI/Docker build env.

### 2. CSP
- `buildCsp` in dev adds `'unsafe-eval'` and keeps `strict-dynamic` with a nonce. `connect-src 'self' <identityOrigin>` already covers same-origin `/api/me`, so nothing needs to change. The lazy chunk loads under Next's nonce and `strict-dynamic`, so no policy change is needed. Do not touch `headers.ts` (a High path; `check-headers` has tests).
- The Identity origin stays in `connect-src` in dev. That is harmless and out of scope. Do not drop it, because the Identity pages still need it.

### 3. StrictMode, one `/api/me` send
- `reactStrictMode: true` (`next.config.ts:7`). In dev, mount effects run, clean up and run again, so a naive `useEffect(() => void check(), [])` sends twice. A cancel flag does not cancel the first send. It only discards its answer.
- Recommended: a module-level in-flight promise, `let inflight: Promise<MeResult> | null`. The effect starts or joins it and clears it when it settles, so StrictMode's second run joins the first request. "Check again" clears it first. Test the helper purely: two calls before settle gives one `fetchFn` call; a call after settle gives a second.
- The `seq` epoch from `Gate` is still useful: the late answer of an older run is dropped.
- A `useRef` guard does not survive the StrictMode remount (the ref persists through the simulated unmount, but relying on that is fragile). The module-level promise is stronger. Also keep `Fragment key={generation}` for remount on recheck.
- No `store.start()`, no timers, no BroadcastChannel in `DevGate`.

### 4. Mapping 401 and 403 to DevTokenView
`dev-flow.ts` (pure, no `signedOut`):

| Browser sees | Meaning | View |
|---|---|---|
| 401 `unauthenticated` | missing, malformed, expired, wrong_org, or the server refused (host/origin/cross-site) | `DevTokenView`, kind "invalid" |
| 403 `org_required` | unscoped token | `DevTokenView`, kind "needOrg" |
| 403 `forbidden` / `member_deactivated` | existing `NoAccessView` | `noAccess` |
| 5xx, network, unreadable | existing `RetryView` | `retry` |
| ready, profile | existing | ready, profile |

- Because the 401 case merges five reasons, the invalid copy should not claim "expired". Suggested wording: "No usable dev token. Run `pnpm dev:token` (add `--org <uuid>` if you started with `dev:prod`), then Check again. The server console says which."
- The wrong_org case is a 401 here. The copy should mention that under `dev:prod` the token must be for the org in the banner. Do not assert it from the browser.
- A client-side decode of the token is impossible (the browser never has it). Do not add an endpoint that exposes the reason. That is SIM-028 server scope and would widen the surface. Put a note in follow-ups if the UX proves poor.
- Mid-session 401: `createDevApiFetch` should take `onAuthLost` and call it once on 401, with no retry (one send, as the ticket says). DevGate registers it and flips the view to invalid only while `ready`, with a guard against a double call. Do not use `setAuthLostHandler` from `runtime.ts`. It is a global that `Gate` also uses, and importing `runtime.ts` would pull the Identity runtime into DevGate's graph. Use a local callback.
- A 403 `org_required` thrown from `dev-fetch` mid-session (token replaced by an unscoped one) should also flip to needOrg. Handle `ApiAccessError` codes `unauthenticated` and `org_required` in one place.
- The profile PATCH goes through `dev-fetch` and reuses `mapPatchResult`. The answer flows through `viewForMe`, as today.

### 5. Production-data risk visibility under `dev:prod`
- `dev:prod` and plain `dev` both set the same public flag, so the browser cannot tell them apart. The ticket's badge says only "Dev token". Under `dev:prod` every write is real, and a user who is looking at the browser would not see the terminal banner.
- Within the ticket's scope, with no new server code: the shell can show the org identity. The org id is in the `/api/me` body, so carry it as `session.orgName` (a short UUID such as the first 8 characters) or in the badge tooltip: "Dev token · org 1a2b3c4d". That makes the org visible in the browser, which is the one piece of information that identifies production data. If `MeView.ready` does not carry `org`, extending `readMeResult` is a small lib change; confirm before planning.
- Distinguishing dev:prod from local-DB dev would need a new public flag from `dev-prod.mjs` (SIM-029 scope). Do not add it. Record it as a follow-up: `NEXT_PUBLIC_SIMAP_DEV_PROD=1` set by `dev:prod`, which would turn the badge red with "Production data".
- Keep the badge amber and permanent (not dismissible). Give it `role="status"` text rather than colour alone (a11y), and make sure it stays visible below `lg` (the RoleBadge is `hidden lg:inline-flex`; do not copy that class).

### Recommendations (tied to ACs)
1. AC1/AC4: use a module-level `DEV` const with the literal two-part env expression, and a lazy `import("./DevGate")` only in the true branch. Keep every dev-only import behind `DevGate`.
2. AC4: forbidden-string list = `pnpm dev:token`, `[dev-token]`, `.config/simap`, plus a unique sentinel from `copy/dev-token.ts`. Drop `DevGate` as the sole witness (it is minified away). Keep it in the list anyway, harmless.
3. AC1: `createDevApiFetch` = `/api/` guard, no Authorization, `cache:"no-store"`, `redirect:"error"`, one send, 401 throws `ApiAccessError("unauthenticated")` and calls `onAuthLost`, 403 maps through the exported `accessCodeOf`. 5xx passes through.
4. AC2: `dev-flow.ts` maps as in the table. It never returns a sign-in or org-picker view. Test every `MeResult` kind.
5. AC3: `Session.devToken?: boolean`. In `AppShellView`: with `devToken`, omit the sign-out `IconButton` entirely (not disabled), omit the switch button, show the amber badge. Make `ProfileView` and `NoAccessView` `onSignOut` optional, with the button gated on the prop. Add render tests for both the absent and present cases, and a shell test (badge present, sign-out absent).
6. StrictMode: the in-flight promise dedupe described above, with a unit test of the helper.
7. Keep `check:dev-bundle` out of CI, as scoped, but add it to `.claude/loop.config.md` → Checks and to the CLAUDE.md commands list ("Keep `.claude/loop.config.md` → Checks in sync").

### Risks
- Next may emit the lazy chunk even when the branch is dead, depending on the bundler. The check script is the proof, so run it for real before PASS and confirm it fails when a forbidden string is injected.
- The flag is `NEXT_PUBLIC_`, so it is inlined into any build made with it set. `dev.mjs` and `dev:prod` only set it for the spawned dev server, which is fine. If someone sets it in `.env.local`, `next build` would still have `NODE_ENV=production`, so the condition stays false. The `&&` on `NODE_ENV` is the barrier and must not be dropped.
- Identity pages (`/sign-up` and others) still build the Identity runtime in dev mode. Not a bug, but a note for the manual AC1 check: test only the gated routes.
- A wrong_org token and a missing token look identical in the browser. Users under `dev:prod` may rerun `pnpm dev:token` without `--org` and loop. The copy must carry the `--org` hint on every invalid state.
- The "Check again" path must clear the in-flight promise and bump the generation. Otherwise it joins a stale request.
- The AC says "a 401 mid-session flips to token-invalid". Feature screens that call `apiFetch` from effects may fire several requests that all get 401. `onAuthLost` must be idempotent.
- Manual e2e needs Ming's M-1 (a real token), so the PR can only show unit and bundle-check evidence until then.

### Open questions
1. Does `MeView.ready` / `readMeResult` carry `org`? If not, is a tiny lib extension in scope to show the org id in the badge (my pick for the production-data risk), or should the badge stay text-only?
2. Should the badge copy differ for `dev:prod` (needs a new public flag from `dev-prod.mjs`)? I recommend a follow-up, not this ticket.
3. Hidden versus disabled sign-out: the ticket says "hidden". Confirm that the sign-out `IconButton` should be removed entirely in dev mode (my reading) and not left disabled as the current shell does.
4. Is the unique sentinel in the forbidden-string list acceptable, or should the check read the list from `copy/dev-token.ts` at run time (more robust against copy edits)?

Files read: `d:\project\simap-game-ui\work\tickets\SIM-028.1\ticket.md`, `d:\project\simap-game-ui\work\tickets\SIM-028\consult-frontend-developer.md`, `d:\project\simap-game-ui\src\ui\auth\AuthGate.tsx`, `d:\project\simap-game-ui\src\lib\api\fetch.ts`, `d:\project\simap-game-ui\src\lib\session.ts`, `d:\project\simap-game-ui\src\server\http\with-auth.ts`, `d:\project\simap-game-ui\src\server\http\dev-token.ts`, `d:\project\simap-game-ui\src\lib\dev-token\token.ts`, `d:\project\simap-game-ui\src\lib\security\headers.ts`, parts of `d:\project\simap-game-ui\src\ui\AppShellView.tsx`, and greps over `views.tsx`, `ProfileView.tsx`, `flow.ts`, `scripts/dev.mjs`, `scripts/dev-prod.mjs`, `README.md`. I did not read the SIM-028 plan's split proposal (I relied on the ticket's summary of it), `views.tsx` in full, `ProfileView.tsx` in full, `src/proxy.ts`, or any `.env*` file.
