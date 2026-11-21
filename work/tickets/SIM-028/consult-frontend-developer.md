## SIM-028 consult (frontend): AuthGate / org entry / apiFetch in dev-token mode

### Findings
- `AuthGate` (`src/ui/auth/AuthGate.tsx`, ~700 lines) is a single `Gate` that gets everything from `getAuthRuntime()`: Identity client, `store`, bearer `apiFetch`, and the Turnstile key.
- Identity calls on the client come from:
  - `store.start()`: the renewal timer, the visibility listener and the cross-tab channel (mount effect, line ~316).
  - `loadAccounts()` (`client.accounts()`), run when there is no stored account.
  - `enterOrg` / `fetchOrgs` (`client.orgs`), `store.selectOrg`, and the `needOrg` / `pickOrg` views.
  - `openSwitcher` / `switchTo`, `refreshPermissions` (`store.renewNow`), `signOut`, `join`, `resend`.
  - `store.subscribe` and `store.onRemoteSignOut` effects.
- `createApiFetch` (`src/lib/api/fetch.ts`) always sets `Authorization: Bearer <getToken()>`. On 401 it re-mints once, resends once, then calls `onAuthLost`. Reusing it with a fake `getToken` would send a client bearer (the proxy drops it, so harmless) and double every 401. That is wasteful and confusing.
- `viewForMe` / `readMeResult` (`src/lib/identity/flow.ts`) are already pure. 401 maps to `signedOut`/`no_access`, and 403 `org_required` maps to `needOrg`. Both lead to Identity flows (sign-in, org picker) that must never run in dev mode.
- The shell already handles missing actions. `switchOrg` is hidden when undefined, and the sign-out button is `disabled={!actions.signOut}` (`AppShellView.tsx` ~100–129). So passing no `signOut` and no `switchOrg` greys them out without touching the shell.
- `getAuthRuntime` already uses compile-time `process.env.NODE_ENV === "production"` guards (`runtime.ts`). Next inlines `NODE_ENV`, so the same pattern gives dead-code elimination of the dev branch in production.
- The tudocuatui port source is fine to copy. `readDevToken`, `rewriteAuth`, `warningFor`, `tokenFilePath`, `assertLocalServer` and `LOOPBACK` are pure or fs-only. Only the Vite plugin wrapper needs replacing with `src/proxy.ts`. Adapt `rewriteAuth` to the Web `Headers` API (`NextRequest`) instead of `IncomingHttpHeaders`, and add the `/api/*` path check, which tudocuatui does with the proxy key.

### Recommendations

1. **Separate `DevGate`, not branches inside `Gate`.**
   - In `AuthGate`, `useEffect(() => setRt(...))` becomes `setMode(detectMode())`. If the mode is `dev`, render `<DevGate>`. Otherwise render the existing `Gate` unchanged.
   - This leaves the 700-line gate diff near zero, so the production path stays safe. Branching inside `Gate` would mean guarding about 12 call sites.
   - `DevGate` (`src/ui/auth/DevGate.tsx`):
     - never calls `getAuthRuntime()`, so no token store and no Identity client exist at all;
     - runs `devApiFetch("/api/me")` → `readMeResult` → `viewForMe` → a pure `devViewForMe`;
     - provides `SessionProvider` with `actions={{ refreshPermissions: recheck }}`, and no `signOut` or `switchOrg`;
     - reuses `CheckingView`, `RetryView`, `NoAccessView` and `ProfileView`. `ProfileView.onSignOut` is required, so either make it optional or pass a no-op and hide the button. This is the only edit to an existing org component, so please check it.
   - Keep `generation` and `Fragment key` for remount on recheck.

2. **`createDevApiFetch` (pure, in `src/lib/api/fetch.ts` or `dev-fetch.ts`).**
   - Rules: same `/api/` guard; no Authorization header; `cache: "no-store"`; one send, no retry.
   - On 401 it throws `ApiAccessError("unauthenticated")`. A 403 `org_required` throws `org_required` and other 403s map via `accessCodeOf`. Pass 5xx through.
   - Reuse `accessCodeOf`; export it or factor it out.
   - Provide it through `ApiFetchProvider`, so the feature screens are unchanged.

3. **Mode detection: a probe answered by the proxy, not a public env flag.** This is my recommendation.
   - `src/proxy.ts` handles `GET /api/dev-session` itself, only when `NODE_ENV==="development"` and the loopback and same-origin checks pass. It returns `{devToken:true,status:"ok"|"missing"|"malformed"|"expired"}` and never the token. In production the first line is `if (process.env.NODE_ENV !== "development") return NextResponse.next()`, and no route file exists, so the path is a 404.
   - The client probe lives in one function, `detectMode()`, guarded by `if (process.env.NODE_ENV === "production") return "identity"` first. Next folds this at build time, so the probe and `DevGate` are dead code in prod. Dynamic-import `DevGate` (`next/dynamic` / `import()`) inside that guard so it is also excluded from the production chunk. Verify by grepping `.next/static` for `dev-session` and `DevGate` strings (this is acceptance criterion 2).
   - The probe answer is `{devToken:true}` (any status) → dev mode. A 404, a network failure or `devToken:false` → normal Identity mode. The probe means the mode reflects what the server actually does (it also respects `assertLocalServer`), and the `status` field lets the UI tell "run `pnpm dev:token`" from a working session without an extra 401 round trip.
   - Alternative: `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1`. This is simpler, but it needs `.env.development` (conflicts with SIM-029's `pnpm dev:prod`, which must use the real flow) and it can disagree with the server (flag on, proxy refusing a non-loopback host). Not preferred.
   - Avoid a response-header hint such as `x-simap-dev-token`: it arrives only after `/api/me`, which is too late to skip the Identity setup.
   - Allow the probe to set the `Authorization` header: it has none, so the proxy has nothing to drop.

4. **401 in dev mode.**
   - `devViewForMe`: the result 401 or `status:"missing"|"malformed"|"expired"` → new `{kind:"devTokenInvalid", reason}`. `needOrg` (403 `org_required`, unscoped token) → `{kind:"devNeedOrg"}`. The remaining kinds are mapped as `viewForMe`, except `signedOut` is never shown. `noAccess` and `retry` are kept.
   - `DevTokenView`: a single screen. It says the token is missing/expired, shows the command `pnpm dev:token` (and `pnpm dev:token --org <uuid>` for the unscoped case), and offers a "Check again" button, which re-runs `/api/me`. No sign-in form, no Turnstile, no org picker. The dev server needs no restart because the file is read per request.
   - For a 401 on a later data call while the app is `ready` (the token expired mid-session): the dev equivalent of `authLost` flips the gate to `devTokenInvalid`. Make `createDevApiFetch` take `onAuthLost` too and register it like `setAuthLostHandler`, or share the handler. No retry is needed.

5. **Dev indicator and copy.**
   - Add `devToken?: boolean` to `Session` (`src/lib/session.ts`) and render a small amber badge "Dev token" in `AppShellView` next to the org name. It should carry the tooltip "Signed in through the local dev token; sign-in and org switching are off."
   - Copy goes in `src/ui/copy/shell.ts` (the `devToken` badge and tooltip) and `src/ui/copy/auth.ts` (the `DevTokenView` title, body, command strings, and button). Per D36, no strings inline.
   - Org name: `orgName` is undefined in dev mode, because `/api/orgs` is Identity-side. Either show nothing (the shell must tolerate it), or have `/api/me` return org info if it already does. Check `src/app/api/me/route.ts`.

6. **Pure functions to extract (Vitest, no jsdom, D2 / SIM-006 A8).**
   - `src/lib/identity/dev-mode.ts` (lib, pure):
     - `modeFromProbe(res: {ok,status,body}|"error"): "dev"|"identity"` (and `shouldProbe(nodeEnv)`);
     - `devViewForMe(result: MeResult, probeStatus?)` → `DevView`;
     - `devApiFetch` via `createDevApiFetch({fetchFn})`. Tests: no Authorization sent, a caller-sent Authorization is kept or stripped (decide), a single send on 401, the right `ApiAccessError` on 401/403, and `onAuthLost` called once.
   - Server side (`src/server/dev-token.ts` or similar; each non-test file starts with `import "server-only"`; R1):
     - `readDevToken(file, nowMs)`, `tokenFilePath(env, homedir)`, `isLoopbackHost`/`assertLocalServer`, `rewriteAuth(headers: Headers, result, pathname)`, `warningFor` (one message per state change).
   - R1 issue: `src/proxy.ts` is not under `src/app/api/**`. Check that `pnpm check:layers` allows `src/proxy.ts` → `src/server/**`, or extend the guard (the proxy is a High path).
   - The probe body builder (`devSessionBody(result)`) is also pure.
   - A static check that the production bundle has no dev code: a script step or test that greps `.next/static` after `pnpm build` (the test can be manual or a CI step).

### Risks
- **Next 16 `proxy.ts` runtime.** It runs on the Node runtime, so `fs` works. Confirm that overriding request headers works on a non-matched `NextResponse.next({request:{headers}})`. Reading `fs` per request in a proxy also runs for every asset, so use `config.matcher: ["/api/:path*"]` strictly.
- **Dev-only code in the proxy running in production.** The `NODE_ENV` guard is the only barrier. Tests must cover `NODE_ENV=production` → no header rewrite and no `/api/dev-session` answer, and a build check that no token path is readable.
- **Loopback check.** In Next `dev`, the host comes from `-H` / `HOSTNAME` and not from config, so `assertLocalServer` must inspect `process.argv`/`HOSTNAME` or refuse on a non-loopback `Host` header per request. Define it concretely, because the AC says "refuses to run unless the dev server listens on loopback". A `Host` header check alone is weak: a DNS-rebinding page can send `Host: localhost`. Also require `Sec-Fetch-Site` absent or `same-origin` (as tudocuatui) and check `Origin`.
- **`Sec-Fetch-Site` absent is allowed** (non-browser clients, curl). That is as in tudocuatui. It is acceptable because the server is loopback-only.
- **Unscoped token.** `/api/me` returns 403 `org_required`. Without a dev org view the user is stuck; `devNeedOrg` is needed.
- **Token lifetime.** Identity tokens may be 15 minutes (tudocuatui M-29). With no renewal, expect frequent `devTokenInvalid`; the README should say so.
- **`ProfileView` first-visit screen** (SIM-007.3) has a required `onSignOut`. Dev mode must still allow saving the profile (PATCH `/api/me` through `devApiFetch`).
- **React StrictMode** double-runs the mount effect: the probe should be idempotent and cached per page load.

### Open questions
1. Is dev-mode detection by the proxy-answered `/api/dev-session` probe acceptable (my pick), or does Ming prefer the `NEXT_PUBLIC_` flag? Note it affects the SIM-029 `pnpm dev:prod` design.
2. May `ProfileView.onSignOut` become optional, and `Session` gain `devToken?`? (Both touch SIM-007.2/007.3 files.)
3. Does `check:layers` need an allowance for `src/proxy.ts` → `src/server/**`?
4. Should the shell show an org name in dev mode (needs `/api/me` to return it), or just "Dev token"?
5. If the caller-sent `Authorization` reaches the proxy in dev mode (e.g. a debug script), is silently dropping it right? The AC says always drop; I assume yes.

Files read: `d:\project\simap-game-ui\src\ui\auth\AuthGate.tsx`, `runtime.ts`, `d:\project\simap-game-ui\src\lib\api\fetch.ts`, `d:\project\simap-game-ui\src\lib\identity\flow.ts`, `config.ts`, `d:\project\simap-game-ui\src\ui\session.tsx`, `D:\project\spaceM\projects\tudocuatui\dev\devTokenProxy.ts`. I did not read `tokenStore.ts`, `identityClient.ts`, the README "Development" section, or the full D56 text. I did not check `AppShellView.tsx` beyond a grep.
