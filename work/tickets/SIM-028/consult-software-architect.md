## SIM-028 consult: software-architect (read-only)

### Findings

1. **Every org route already passes through a single choke point.** That point is `withAuth` (`d:\project\simap-game-ui\src\server\http\with-auth.ts`, line 51: `d.verifier.verify(req.headers.get("authorization"))`).
   - `d:\project\simap-game-ui\src\app\api\routes-guarded.test.ts` already enforces that every `route.ts` except healthz/readyz is wrapped.
   - The same test also requires that no route file mentions `authorization`.
   - So a dev-token hook at that one line covers every `/api/*` route that needs a bearer. Nothing new has to sit in front of the request pipeline.

2. **`src/proxy.ts` does not exist yet, and `pnpm check:layers` ignores it.** `layerOf()` in `d:\project\simap-game-ui\scripts\check-layers.mjs` only knows `src/app/**`, `src/ui/**`, `src/server/**` and `src/lib/**`. A `src/proxy.ts` that imports `@/server/...` would break R1 ("route handlers under `src/app/api/**` are the only entry into `src/server/**`"), and no check would catch it.
   - Next 16 `proxy.ts` runs on the Node.js runtime, so `node:fs` reads work there. (Edge is not offered for proxy; please confirm against the Next 16.4 docs.)
   - It is compiled into the production build and runs on every matched request in production. The `matcher` is static and cannot depend on `NODE_ENV`.
   - It changes headers through `NextResponse.next({ request: { headers } })`, which uses Next's internal `x-middleware-override-headers` mechanism. That mechanism has had security bugs before (CVE-2025-29927 class).

3. **`next dev` listens on all interfaces by default, not loopback.** tudocuatui's guard relied on Vite's `server.host` and `allowedHosts`. Next has no Host allowlist for route handlers (`allowedDevOrigins` only covers dev assets and HMR). Two consequences:
   - Without a loopback bind, anyone on the LAN who can reach `<your-ip>:3000` gets requests signed as Ming.
   - DNS rebinding: a page on `evil.example` that resolves to 127.0.0.1 sends `Sec-Fetch-Site: same-origin` and `Host: evil.example:3000`. Checking `Sec-Fetch-Site` alone does not stop it, so a Host-header allowlist is needed.

4. **The browser runtime is built around Identity.** `getAuthRuntime()` (`d:\project\simap-game-ui\src\ui\auth\runtime.ts`) always creates the Identity client and the token store. The store's `start()` opens a channel, timers and a visibility listener, and its restore, renew and `orgs` calls reach Identity.
   - `createApiFetch` (`d:\project\simap-game-ui\src\lib\api\fetch.ts`) throws `signed_out` when `getToken()` returns null.
   - `AuthGate` calls Identity for `client.orgs`, `selectOrg`, `renewNow`, `accounts` and `signOut`.
   - So dev-token mode needs its own runtime or gate branch. Swapping a flag inside the token store is not enough.

5. **D5 and org scoping.** `withAuth` returns 403 `org_required` when the token has no `org` claim. An unscoped token from `pnpm dev:token` with no `--org` therefore makes every `/api/*` call answer 403. Tier comes from `org_roles` in the token (R6), so a role change needs a re-run of `pnpm dev:token`. The dev path must go through the same `createIdentityVerifier` (ES256, aud `simap`, `typ at+jwt`, `maxTokenAge` 12 h, `email_verified`), so nothing bypasses verification.

6. **No org-admin-api change appears to be needed.** The script makes the same calls `identityClient` already makes (`/auth/login`, then `/auth/token` with `{audience, account_id, org_id?}`) from Node, with `Origin: https://simap.mmlabs.online` and `X-MM-App: simap`. This is the tudocuatui pattern, which works against the same Identity. It depends on M-1 (app `simap` registered with that origin).
   - Node `fetch` has no cookie jar. The script must carry the login `Set-Cookie` into the `/auth/token` and `/auth/logout` requests itself. It should forward the raw cookie pairs and not parse attributes; `__Host-` / Secure cookies are fine over https.

### Recommendations

**R-a: Put the injection in the server layer, used by `withAuth` (preferred over `src/proxy.ts`).**
- New `src/server/http/dev-token.ts` (starts with `import "server-only"`, High path).
- In `withAuth`, replace the header read with `authorizationFor(req)`. In production that returns `req.headers.get("authorization")` unchanged. In dev-token mode it **always drops the client header** and returns `Bearer <file token>` only if every condition below holds; otherwise it returns null, so the answer is the normal 401.
  - `Sec-Fetch-Site` is absent or `same-origin`.
  - The `Host` header is in the loopback set (`localhost`, `127.0.0.1`, `[::1]` with the dev port).
  - The path starts with `/api/`.
  - The file token reads ok.
- Pure parts go in `src/lib/dev-token/*` (pure, unit-tested): JWT shape, `exp` parse, `decide({headers, tokenResult})`, `warningFor`. The `fs.readFileSync` call stays in the server file, read per request with the sync read from tudocuatui.
- Warn once per state change, as tudocuatui does with its `lastWarning` (state changes only, never the token).

Trade-off: compared with `src/proxy.ts`, you lose a hook in front of the whole request pipeline. Healthz/readyz get no token, which they don't need, and a future route that skips `withAuth` gets no token, which is fail-closed. You gain:
- R1 compliance with `check:layers` coverage.
- No new code that runs on every request in production.
- No internal header-override mechanism.
- Reuse of the existing `createWithAuth(deps)` test seam.
- `routes-guarded.test` stays valid.

If Ming prefers to follow the ticket text literally and use `src/proxy.ts`:
- Keep it thin, with an early `if (process.env.NODE_ENV !== "development") return NextResponse.next()`.
- Do the file read inside `proxy.ts`.
- Import only `@/lib/dev-token`, never `@/server`.
- Extend `check-layers.mjs` so `src/proxy.ts` may import only `lib`.

Both versions need the Host allowlist from Finding 3.

**R-b: Make sure the code is dead in production (AC2), using two gates.**
1. Build-time: Next inlines `process.env.NODE_ENV` into server and client bundles, so `process.env.NODE_ENV === "development"` is constant-false in `next build`.
2. Runtime: an env marker that only the dev launcher sets. Suggested name `SIMAP_DEV_TOKEN_MODE=1`, listed in `.env.example` as a name only.

Load the server module only inside the guard (`await import("./dev-token")`) so production never runs it. Add a check, as a Vitest test over a fixture or a post-build script step, that `.next/static/**` contains neither the marker string `[dev-token]` nor the token-file path. Don't assert anything about server chunks beyond "guarded"; Turbopack may still emit the chunk.

**R-c: Guard loopback for `next dev`.**
- `pnpm dev` should run `scripts/dev.mjs`, which spawns `next dev -H 127.0.0.1` and sets the runtime marker.
- The script refuses `-H` / `--hostname` values that are not loopback (`127.0.0.1`, `localhost`, `::1`), and refuses `0.0.0.0`.
- The Host-header allowlist in R-a is the second layer and also blocks DNS rebinding.
- The listen address cannot be read reliably from a route handler, so the bind lives in the launcher. Document this in the README.

**R-d: How the browser learns about dev-token mode.**
- Use a public boolean `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1`, set by `scripts/dev.mjs`, and AND it with `process.env.NODE_ENV === "development"` in a pure `lib` function (for example `devTokenMode(env)`). This leaks nothing: it is a boolean, it is constant-false in production, and the client code is removed by dead-code elimination.
- I recommend this over a `/api/dev-session` probe. A probe route would exist in production, would need an exemption in `routes-guarded.test`, and would add a network round-trip.
- In that mode `getAuthRuntime()` builds no Identity client and no token store, and `AuthGate` renders a small dev branch:
  - `/api/me` through an `apiFetch` variant that sends no `Authorization` and does no re-mint retry.
  - 200 → ready (the profile view if needed).
  - 401 → a "dev token missing or expired: run `pnpm dev:token`" view with a retry button.
  - 403 `org_required` → "re-run `pnpm dev:token --org <uuid>`".
  - Other 403s → the existing no-access view.
  - Hide `switchOrg` and sign-out; `refreshPermissions` re-runs `/api/me`.
  - Show a "Dev token" badge with copy in `src/ui/copy/`.
  - The shell shows the org id or "dev org", because the org list comes from Identity.
- Put the dev/normal decision in a pure function so it can be unit-tested (test plan).

**R-e: `scripts/dev-token.mjs`.**
- Use Node `fetch` with `redirect: "manual"`, a 20 s timeout, and a hidden password prompt (raw-mode stdin; fall back to refusing when stdin is not a TTY).
- Write the token atomically (tmp file, then rename) to `~/.config/simap/dev-token` (override `SIMAP_DEV_TOKEN_FILE`), with mode 0o600 where the OS supports it. On Windows the mode is advisory; document that.
- Refuse an override path inside the repo (resolve it and compare against `process.cwd()` and the git root).
- Validate the token answer like the bash version: `token_type`, `audience === "simap"`, JWT shape, finite `expires_in`.
- Map 401, `turnstile_*` and 429 / `rate_limited` to clear messages.
- Validate `--org` as a canonical UUID (`src/lib/validate/uuid.ts` is pure and can be reused).
- Never print the token, the password or the full Identity body.
- Keep its pure parts (answer parsing, error mapping, path resolution) importable for Vitest. `scripts/` is outside the layers.

### Risks

- **High-path changes.** `with-auth.ts`, the new `src/server/http/dev-token.ts` (or `src/proxy.ts`), `.env.example`, and `check-layers.mjs` if the proxy route is taken. The security reviewer will be triggered.
- **Unscoped default.** If the script defaults to an unscoped token, the first-run experience is an `org_required` screen. Without the dev view from R-d it would look like a broken app.
- **15-minute Identity tokens.** If tokens are still 15 minutes (tudocuatui M-29), dev sessions die quickly. The per-request file read means a re-run needs no restart, but the UI must offer a retry, not a dead end.
- **Missing `Sec-Fetch-Site`.** Requests without the header (curl, old browsers) are treated as same-origin, as in tudocuatui. Combined with the Host allowlist and the loopback bind, the remaining exposure is local processes on Ming's own machine. That is acceptable for dev; document it.
- **Running dev against production data.** A dev token holds Ming's real org roles. Pointing dev at the production DB (SIM-029) means real writes as Ming. Keep SIM-029's guardrails first in line.
- **Next 16 behaviour to confirm during implementation.**
  - That `NODE_ENV` is inlined in route-handler bundles under Turbopack.
  - That `next dev -H 127.0.0.1` also binds HMR to loopback.
  - That `proxy.ts` runs on Node with `fs` (only if R-a is rejected).

### Open questions (for Ming)

1. Should `withAuth` host the injection (R-a), or does Ming want the literal `src/proxy.ts` from the ticket? (R-a is recommended.)
2. Should `pnpm dev` always run in dev-token mode, or should there be a separate `pnpm dev:identity` (normal browser sign-in against a local or other Identity via `NEXT_PUBLIC_MM_IDENTITY_BASE`) without the marker?
3. When there is no `--org` / `SIMAP_DEV_ORG`, should the script list the account's orgs and pick the only one, or prompt? This would widen scope a little. The alternative is keeping "unscoped" as the ticket says and accepting the `org_required` screen.
4. Should the Host allowlist accept only `localhost` and `127.0.0.1` on the dev port, or also `[::1]`?

Relevant files:
- `d:\project\simap-game-ui\work\tickets\SIM-028\ticket.md`
- `d:\project\simap-game-ui\src\server\http\with-auth.ts`
- `d:\project\simap-game-ui\src\server\identity\verify.ts`
- `d:\project\simap-game-ui\src\ui\auth\runtime.ts`
- `d:\project\simap-game-ui\src\ui\auth\AuthGate.tsx`
- `d:\project\simap-game-ui\src\lib\api\fetch.ts`
- `d:\project\simap-game-ui\scripts\check-layers.mjs`
- `d:\project\simap-game-ui\src\app\api\routes-guarded.test.ts`
- `d:\project\simap-game-ui\src\lib\identity\config.ts`
- `D:\project\spaceM\projects\tudocuatui\dev\devTokenProxy.ts`
- `D:\project\spaceM\projects\tudocuatui\scripts\dev-token.sh`
