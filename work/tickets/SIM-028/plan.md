Status: READY

# Plan — SIM-028: Signed-in local dev with a server-side dev token (slice 1 of 2: token script, dev launcher, server injection)

> Gate: plan-approval (High paths: `src/server/http/**`, `.env.example`). The decisions Ming approves or overrides at
> the gate are listed under **Decisions for Ming (defaults chosen)** in `## Assumptions`. None of them blocks the plan.
> **Split:** the ticket is about 800 non-test lines, about twice the size of one cycle. This plan covers slice 1
> (server and scripts). Slice 2 (browser dev-token mode, proposed as SIM-028.1) is outlined under `## Split proposal`.

## Scope summary
- `work/decisions.md` D56 (Ming, 2026-11-21): "Local dev signs in like tudocuatui (its D44/D45/D46): `pnpm dev:token`
  gets an Identity token for Ming's own account with the production Origin and writes it outside the repo; under
  `pnpm dev` the server adds it as bearer to same-origin `/api/*` and the browser never calls Identity. The production
  DB is reachable from dev only through the pg-tunnel with the URL given at runtime, and dev scripts refuse it."
  The production DB part belongs to SIM-029 and is out of scope here.
- Ticket Scope (slice 1 covers bullets 1, 2 and 4):
  - "`pnpm dev:token`: cross-platform Node script (Windows and macOS …). Asks for email (or `SIMAP_DEV_EMAIL`) and the
    password with hidden input; `POST /auth/login` then `/auth/token` `{audience:"simap", account_id, org_id?}` with
    `Origin: https://simap.mmlabs.online` and `X-MM-App: simap`; validates the token answer like
    `identityClient.token`; best-effort `/auth/logout`; writes the token (mode 600 where supported) to
    `~/.config/simap/dev-token` (override `SIMAP_DEV_TOKEN_FILE`). Org: `--org <uuid>` or `SIMAP_DEV_ORG`; without one,
    the token is unscoped. Maps 401 / Turnstile / rate-limit answers to clear messages."
  - "Dev-only server injection (Next.js `src/proxy.ts` or the equivalent Next 16 hook): for same-origin `/api/*`
    requests in `NODE_ENV=development`, drop the client `Authorization` and set `Bearer <file token>`, read per request.
    Missing, malformed or expired token → one console warning naming `pnpm dev:token`, request forwarded without a
    bearer." This plan uses the "equivalent hook" clause and puts the injection in `withAuth` (Decision A).
  - "README: 'Local development' section (setup, `pnpm dev:token`, token lifetime, Turnstile note)."
- Bullet 3 (browser dev-token mode: `AuthGate` skips Identity, dev indicator) moves to slice 2 / SIM-028.1.
- Rules: D4 (bearer to route handlers), D5/R6 (org-scoped token, roles only from `org_roles`), R1, R3, R5.
- Port source (read-only): `D:\project\spaceM\projects\tudocuatui\dev\devTokenProxy.ts` (`readDevToken` l.69-81,
  `rewriteAuth` l.87-98, `warningFor` l.100-103, `lastWarning` l.107/124-127, `LOOPBACK` l.22),
  `D:\project\spaceM\projects\tudocuatui\scripts\dev-token.sh` (error mapping l.60-68, token validation l.78, logout l.84,
  atomic write l.86-89), tudocuatui `README.md` l.5-42.

### Next 16.4.6 behaviour, checked in `node_modules/.pnpm/next@16.4.6_…/node_modules/next`
- `next dev` listens on all interfaces unless `-H` is given: `dist/bin/next` l.203 says "`-H, --hostname <hostname>` …
  (default: 0.0.0.0)". `dist/cli/next-dev.js` l.303-305 deliberately sets no default host, and
  `dist/server/lib/start-server.js` l.251/430 calls `server.listen(port, hostname)`. `-H` has no env fallback (no
  `.env('HOSTNAME')`).
- HMR is covered by the same bind: the websocket upgrade is handled by the same server
  (`start-server.js` l.229-236 `server.on('upgrade')`). Opening `http://localhost:3000` while bound to `127.0.0.1`
  works: `router-utils/block-cross-site-dev.js` l.76-83 always allows `localhost` and the bound hostname.
- `process.env.NODE_ENV` is inlined into every bundle (client, Node server, edge): `dist/build/define-env.js` l.76 sets
  `'process.env.NODE_ENV': dev || config.experimental.allowDevelopmentBuild ? 'development' : 'production'`.
  `next.config.ts` does not set `allowDevelopmentBuild`. `NEXT_PUBLIC_*` values are inlined the same way (l.60
  `...nextPublicEnv`).
- If `src/proxy.ts` were chosen instead: "Proxy always runs on Node.js runtime" (`dist/build/analysis/get-page-static-info.js`
  l.601-606).
- Next writes `process.env.__NEXT_PRIVATE_ORIGIN` (`start-server.js` l.281). It is private and shows `localhost` both
  when unbound and when bound to localhost, so it cannot prove a loopback bind. The bind is therefore enforced by the
  launcher (Decision B).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | (slice-1 form of ticket AC1) With a valid token file, `pnpm dev` signs `/api/*` requests with the file token: a request without `Authorization` gets the dev identity. The browser half of AC1 (signed-in UI, no request to `api.mmlabs.online`) is slice 2. | Unit tests: `dev-token.test.ts › devAuthorization returns Bearer <file token> for a same-origin localhost /api request` and `with-auth.test.ts › authorization dep: verifier gets the dep result`. Manual check, only possible with a real token (Ming, after M-1): `curl -i http://localhost:3000/api/me` → 200. |
| 2 | The token never reaches the browser: not in any response body or header, not in `.next/static` or any client bundle, and the dev-token path is disabled in `pnpm build` output (`NODE_ENV=production`). | Code reading: the dev result only goes into `d.verifier.verify(...)`; `/api/me` returns `{sub,email,org,tier,member}` (`src/app/api/me/route.ts` l.12-16). The `getAuthDeps` guard is the literal `process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SIMAP_DEV_TOKEN === "1"`, inlined to false by `define-env.js` l.76, and `./dev-token` is loaded only through `await import()` inside that guard. After `pnpm build`, `rg -l "dev-token\|dev:token\|\.config/simap" .next/static` finds nothing (the command is in the README). Test `with-auth.test.ts › logs never contain the token…` (existing) still passes. |
| 3 | Injection only for same-origin requests (`Sec-Fetch-Site` absent or `same-origin`), only `/api/*`, always drops a client `Authorization`, and refuses to run unless the dev server listens on loopback. | `token.test.ts › devAuthorizationFor …` cases (cross-site, same-site, none → null; non-`/api/` path → null; client Authorization never returned; Host not loopback → null; foreign Origin → null). `dev.test.ts › nextDevArgs …` (always `-H 127.0.0.1` by default; refuses `0.0.0.0`, `::`, LAN IPs, a missing value and the `--hostname=` form). The server never injects unless `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1`, which only `scripts/dev.mjs` sets (grep). |
| 4 | `pnpm dev:token` never prints the password or token, never writes the password anywhere, and writes the token file outside the repo. The file default path and override are tested. | `dev-token.test.ts › run: captured stdout/stderr contain neither password nor token`, `› tokenFilePath default ~/.config/simap/dev-token and SIMAP_DEV_TOKEN_FILE override`, `› refuses a token path inside the repo (case-insensitive on win32)`, `› writeTokenFile writes token + newline atomically, mode 0600 on POSIX`. Code reading: the password exists only in the in-memory `/auth/login` body, never in argv, env or a file. |
| 5 | Missing / malformed / expired token → a single warning naming `pnpm dev:token`, and `/api/*` answers 401 as without a token. Refreshing the file needs no dev-server restart. | `token.test.ts › parseDevToken missing/malformed/expired/ok`, `› warningFor names pnpm dev:token and never the token`, `› createWarnOnce logs only on change`. `dev-token.test.ts › two requests with a missing file warn once`, `› a rewritten file is picked up on the next call`. `with-auth.test.ts › authorization dep returning null → 401 unauthenticated even with a client Authorization header`. |
| 6 | All Checks green; new logic has Vitest tests (token-file reader, header rewrite, script answer parsing). | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. The tests are listed in `## Tests to write`. |

## Ming verification after merge
These checks need M-1 (app `simap` registered in org-admin-api with origin `https://simap.mmlabs.online`, see
`work/ming-todo.md` l.11) and a real account:
1. In **PowerShell**: `pnpm dev:token --org <your-org-uuid>`. The email prompt is visible, the password input is
   hidden, and Ctrl-C during the password prompt leaves the terminal usable. The script prints
   `dev-token: wrote C:\Users\<you>\.config\simap\dev-token (valid for …s, org …)`.
2. `pnpm dev`. The banner shows `http://127.0.0.1:3000`. `curl -i http://localhost:3000/api/me` → 200 with your email
   and tier. Delete the token file → the next call answers 401 and one `[dev-token] token missing - run pnpm dev:token`
   warning appears. Re-run `pnpm dev:token` → 200 again without restarting the dev server.
3. From another device on the LAN, `http://<pc-ip>:3000` does not connect.
4. Report the token lifetime printed by the script (12 h expected; 15 min means tudocuatui M-29 also applies to simap).
5. Slice 2 (SIM-028.1): open `http://localhost:3000` in Chrome. The app is signed in and the network log has no
   request to `api.mmlabs.online`.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `scripts/dev-token.mjs` | New. Cross-platform `pnpm dev:token`. Exports pure helpers (`parseArgs`, `cookieHeader`, `parseLoginAnswer`, `parseTokenAnswer`, `tokenOrg`, `loginErrorMessage`, `tokenErrorMessage`, `tokenFilePath`, `assertOutsideRepo`, `writeTokenFile`, `run(deps)`). `main()` runs only when invoked directly (same guard as `scripts/check-layers.mjs` l.82). | Ticket scope bullet 1, AC4 | no |
| `scripts/dev.mjs` | New. `pnpm dev` launcher: exports `nextDevArgs(argv)` and `devEnv(env)`. `main()` spawns `process.execPath <next/dist/bin/next> dev -H 127.0.0.1 …` with `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1`, `stdio: "inherit"`, and exits with the child's code. | AC3 loopback, Decisions B/C | no |
| `src/lib/dev-token/token.ts` | New, pure (no `node:*` imports, so it is browser-safe): `TokenResult` type, `parseDevToken(raw: string \| null, nowMs)`, `isLoopbackHost(host)`, `devAuthorizationFor(req, result)` → `{ header: string \| null; reason }`, `warningFor(reason)`, `createWarnOnce(log)`. Base64url decode via `atob`. | AC3, AC5; pure logic first (planner rule 6) | no |
| `src/server/http/dev-token.ts` | New, starts with `import "server-only"`: `tokenFilePath(env, homedir)`, `readDevTokenFile(file, nowMs)` (sync `fs.readFileSync`, per request, no cache), `devAuthorization(req: Request): string \| null` (reads the file, calls `devAuthorizationFor`, warns once per reason change via a `globalThis` holder so HMR reloads do not re-warn). | Ticket scope bullet 2 | **yes** (`src/server/http/**`) |
| `src/server/http/with-auth.ts` | Add optional `authorization?: (req: Request) => Promise<string \| null>` to `AuthDeps` (l.25). l.51 becomes `d.verifier.verify(d.authorization ? await d.authorization(req) : req.headers.get("authorization"))`. In `getAuthDeps` (l.94-107), set `authorization` only under the inline literal guard `process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SIMAP_DEV_TOKEN === "1"`, to `async (req) => (await import("./dev-token")).devAuthorization(req)`; otherwise leave it undefined. Verification itself is unchanged (`createIdentityVerifier`: ES256, aud `simap`, typ, max age, `email_verified`). | Injection point (Decision A), AC2/AC5 | **yes** |
| `src/lib/dev-token/token.test.ts` | New tests (see below) | R5 | no |
| `src/server/http/dev-token.test.ts` | New tests | R5 | **yes** (`src/server/http/**`) |
| `src/server/http/with-auth.test.ts` | Add tests for the `authorization` dep | R5 | **yes** |
| `scripts/dev-token.test.ts` | New tests | R5, AC4 | no |
| `scripts/dev.test.ts` | New tests | R5, AC3 | no |
| `package.json` | `"dev": "node scripts/dev.mjs"`, add `"dev:token": "node scripts/dev-token.mjs"`. No new dependencies. | Ticket scope | no |
| `.env.example` | Append names only, no values, each with a one-line comment: `SIMAP_DEV_TOKEN_FILE`, `SIMAP_DEV_EMAIL`, `SIMAP_DEV_ORG`, `NEXT_PUBLIC_SIMAP_DEV_TOKEN` ("set by scripts/dev.mjs only; never set it in a .env file"). Append only; do not reorder existing lines. | R3, ticket technical notes | **yes** |
| `README.md` | New "Local development" section after "Local database" (content in Approach step 7). Step 5 of "Local database" (l.14): use `http://127.0.0.1:3000`. | Ticket scope bullet 4 | no |
| `CLAUDE.md` | Commands line: `pnpm dev` runs the dev-token launcher (loopback); add `pnpm dev:token`. | CLAUDE.md asks to keep commands in sync | no |

No other file. `src/proxy.ts`, `scripts/check-layers.mjs` and `src/app/api/routes-guarded.test.ts` stay unchanged:
the routes-guarded test keeps passing because no route file mentions `authorization`.

## Data model / migration
None.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
None. No new endpoint. In dev-token mode, existing `/api/*` routes take their bearer from the token file instead of the
request, and their behaviour is otherwise unchanged (401/403/503 as today).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/dev-token/token.test.ts › parseDevToken: null → missing; "" and non-JWT → malformed; payload without numeric exp → malformed; exp ≤ now → expired; valid JWT with trailing "\r\n" → ok (trimmed)` | AC5, token-file reader |
| `… › isLoopbackHost accepts localhost:3000, LOCALHOST, 127.0.0.1:3001, [::1]:3000, localhost (no port); refuses null, "", evil.example:3000, 192.168.1.5:3000, localhost.evil.example, 127.0.0.1.nip.io, [::]:3000` | AC3, DNS rebinding |
| `… › devAuthorizationFor: ok + Sec-Fetch-Site same-origin → "Bearer <t>"; ok + header absent → "Bearer <t>"; cross-site / same-site / none → null (reason cross_site)` | AC3 |
| `… › devAuthorizationFor: path /healthz or /apix → null (reason path); Host not loopback → null (reason host); Origin present and not a loopback http origin → null (reason origin)` | AC3 |
| `… › devAuthorizationFor never returns the client Authorization (input carries "Bearer client"; output is the file token or null)` | AC3 drop |
| `… › devAuthorizationFor: missing/malformed/expired → null with that reason` | AC5 |
| `… › warningFor: ok → null; each failure reason names "pnpm dev:token" or the refusal, and never contains the token` | AC5 |
| `… › createWarnOnce logs on first failure, not again for the same reason, again after a change, nothing for ok` | AC5 single warning |
| `src/server/http/dev-token.test.ts › tokenFilePath default join(home,".config","simap","dev-token"); SIMAP_DEV_TOKEN_FILE overrides` | AC4 (server side) |
| `… › readDevTokenFile: missing file → missing; a rewritten file is picked up on the next call (no restart, no cache)` | AC5 refresh |
| `… › devAuthorization returns Bearer <file token> for a same-origin localhost /api request (temp file via SIMAP_DEV_TOKEN_FILE)` | AC1 |
| `… › two requests with a missing file warn once (console.warn spy); the warning never contains the token` | AC5 |
| `src/server/http/with-auth.test.ts › authorization dep: verifier gets the dep result, not the client header` | AC1/AC3 |
| `… › authorization dep returning null → 401 unauthenticated even with a client Authorization header` | AC5 |
| `… › no authorization dep → verifier gets req.headers.get("authorization") unchanged` | production path unchanged |
| `scripts/dev-token.test.ts › parseArgs: --org <uuid>, --org=<uuid>, SIMAP_DEV_ORG; flag beats env; non-canonical uuid → error; unknown argument → usage error` | script args |
| `… › parseLoginAnswer: account_id UUID required, else "unexpected sign-in answer"` | answer parsing |
| `… › parseTokenAnswer: valid → {token, expiresIn}; wrong token_type, audience ≠ simap, non-JWT, expires_in NaN/0/>86400 or missing → error "unexpected token answer"` | answer parsing (mirrors `identityClient.ts` l.182-194) |
| `… › tokenOrg: --org given but the JWT org claim differs (case-insensitive compare) → error` | D5 sanity |
| `… › loginErrorMessage: 401 → wrong email or password; turnstile_required / turnstile_failed / 429 / rate_limited → Turnstile message with https://simap.mmlabs.online; other → "sign-in failed (HTTP n, code)"; a code outside ^[a-z_]{1,40}$ → "unknown"` | error mapping |
| `… › tokenErrorMessage: not_member, org_access_denied, email_unverified, other` | error mapping |
| `… › cookieHeader(getSetCookie list) keeps name=value pairs only, joined by "; "` | cookie carry |
| `… › tokenFilePath default ~/.config/simap/dev-token and SIMAP_DEV_TOKEN_FILE override` | AC4 |
| `… › assertOutsideRepo refuses a path inside the repo root (case-insensitive when platform is win32), accepts the home default` | AC4 |
| `… › writeTokenFile writes token + "\n", leaves no .tmp file, mode 0600 on POSIX (assertion skipped on win32)` | AC4 |
| `… › run (fake fetch, fake prompt): login body has the email/password, headers Origin https://simap.mmlabs.online and X-MM-App simap, redirect manual; token body {audience:"simap",account_id,org_id}; Cookie forwarded; logout attempted; logout failure ignored; captured stdout/stderr contain neither password nor token` | AC4, scope bullet 1 |
| `… › run without org: writes the token and prints the "no org: re-run with --org <uuid>" hint` | Decision D |
| `scripts/dev.test.ts › nextDevArgs: [] → ["dev","-H","127.0.0.1"]; --port 3001 passed through; -H localhost / --hostname=::1 / -H 127.0.0.1 kept; -H 0.0.0.0, --hostname :: , -H 192.168.1.5, --hostname=0.0.0.0, a trailing -H with no value → throws` | AC3 loopback |
| `… › devEnv sets NEXT_PUBLIC_SIMAP_DEV_TOKEN=1 and keeps the rest of env` | Decision B |

## Approach
1. **Pure core** `src/lib/dev-token/token.ts`. Port `readDevToken`/`expOf`/`rewriteAuth`/`warningFor` from
   `devTokenProxy.ts` as pure functions over plain values: `parseDevToken(raw, nowMs)` takes the file content or
   `null`. `devAuthorizationFor({ pathname, host, origin, secFetchSite }, result)` returns `{ header, reason }`. The
   checks run in this order: path starts with `/api/` → Host hostname in {`localhost`, `127.0.0.1`, `[::1]`}, any port
   (Decision E) → Origin absent, or an `http:` origin whose hostname is in the same set → `Sec-Fetch-Site` absent or
   `same-origin` → token ok. The client `Authorization` is not an input, so it can never be returned. Warning strings
   start with `[dev-token]`. For example, `token missing - run pnpm dev:token` and
   `request refused (Host is not loopback)`. They never include the token or headers. R1: lib imports nothing outside
   lib.
2. **Server reader** `src/server/http/dev-token.ts` (`import "server-only"` first line). `tokenFilePath` returns
   `env.SIMAP_DEV_TOKEN_FILE || join(homedir, ".config", "simap", "dev-token")`. `readDevTokenFile` reads with sync
   `readFileSync`; on any error → `parseDevToken(null)`. `devAuthorization(req)` takes the pathname from
   `new URL(req.url).pathname` and the other inputs from `req.headers.get(...)`. It reads the file only when the
   request checks pass, so a refused request does not touch the disk. It warns once per reason change through
   `createWarnOnce(console.warn)`, held on `globalThis.__simapDevTokenWarn`.
3. **Hook** `with-auth.ts`: the change is limited to the lines named in the files table. The production path is
   byte-for-byte the current `req.headers.get("authorization")`. Keep the guard as an inline literal (not a helper) so
   the minifier folds it.
4. **`scripts/dev-token.mjs`**. Node 22 built-ins only (`node:readline`, `node:fs`, `node:os`, `node:path`, `node:url`),
   no dependencies.
   - **Prompts.** Email: `SIMAP_DEV_EMAIL`, or a visible `readline` prompt. Password: hidden raw-mode prompt on
     `process.stdin`. It echoes nothing, handles Backspace and Enter (`\r` or `\n`), and on Ctrl-C (`\u0003`) restores
     the TTY and exits 130. If `!process.stdin.isTTY`, it refuses with "needs an interactive terminal (PowerShell,
     Windows Terminal or macOS Terminal)". That covers Git Bash/mintty, where `isTTY` is false. The password is never
     taken from argv or env.
   - **Identity calls.** Base `https://api.mmlabs.online/api/v1` (= `IDENTITY_BASE_PROD`, `src/lib/identity/config.ts`
     l.3; duplicated because Node cannot import the TS module), app `simap`, origin `https://simap.mmlabs.online`.
     Every call uses `fetch` with `redirect: "manual"`, `AbortSignal.timeout(20_000)` (logout 5 s), the headers
     `Content-Type`, `X-MM-App` and `Origin`, and a `Cookie` header built from `res.headers.getSetCookie()` of the
     login answer (name=value pairs only).
   - **Sequence.** Login → `parseLoginAnswer` → `/auth/token` → `parseTokenAnswer` → (`--org`) `tokenOrg` check →
     best-effort logout → `assertOutsideRepo` → `writeTokenFile`.
   - **Writing the file.** `mkdirSync(dir, { recursive: true, mode: 0o700 })`, then `writeFileSync(tmp, token + "\n",
     { mode: 0o600 })`, then `renameSync`. On Windows the mode is advisory: the profile directory ACL protects it, and
     the README says so. The repo root is `fileURLToPath(new URL("..", import.meta.url))`.
   - **Output.** It prints only `dev-token: wrote <path> (valid for <n>s, org <uuid> | no org)`, plus the hint without
     an org. Error messages come from the mappers. The Identity body and the token are never printed.
   - **Testing seam.** `run({ fetchFn, promptEmail, promptPassword, env, out, err, now })` carries all I/O, so
     Vitest can drive it.
5. **`scripts/dev.mjs`**. `nextDevArgs(argv)`:
   - It parses `-H`/`--hostname` in the forms `-H x`, `--hostname x` and `--hostname=x`.
   - The value must be in {`127.0.0.1`, `localhost`, `::1`}. Otherwise it throws `[dev] the dev server must listen on
     127.0.0.1, localhost or ::1 (it adds Ming's bearer token)`. With no `-H` it adds `-H 127.0.0.1`.
   - Every other argument passes through. `pnpm dev --port 3001` reaches the script as `--port 3001`; tolerate a
     leading `--` from pnpm.
   - `main()` resolves `createRequire(import.meta.url).resolve("next/dist/bin/next")` and spawns it with
     `process.execPath`. That avoids `.cmd` shims, so it works on Windows without `shell: true`.
   - The child gets `devEnv(process.env)` and `stdio: "inherit"`. The parent exits with the child's code; Ctrl-C
     reaches both through the shared console.
6. **package.json, `.env.example`, CLAUDE.md** as in the files table.
7. **README "Local development"** (English):
   - Prerequisites: `.env.local` with the Identity issuer/JWKS names already used by `loadIdentityConfig`, plus
     `DATABASE_URL`, and M-1.
   - `pnpm dev:token [--org <uuid>]`, with a PowerShell example
     (`$env:SIMAP_DEV_EMAIL = "you@example.com"; pnpm dev:token --org <uuid>`).
   - The default path, the `SIMAP_DEV_TOKEN_FILE` override and the Windows file-mode note.
   - Token lifetime: it lasts as long as Identity says (printed). Re-run it when `/api` calls answer 401; no restart.
   - Turnstile: after 3 failed sign-ins, sign in once at `https://simap.mmlabs.online`, then retry.
   - `pnpm dev` binds `127.0.0.1` and refuses other `-H` values. `pnpm exec next dev` has no dev token.
   - Residual exposure: requests without `Sec-Fetch-Site` (curl, local processes) are treated as same-origin, as in
     tudocuatui. Never put `NEXT_PUBLIC_SIMAP_DEV_TOKEN` in a `.env*` file.
   - The bundle check command from AC2.
   - Until SIM-028.1, the browser still shows the Identity sign-in: test with curl.
8. Run all Checks, then the AC2 `rg` over `.next/static` after `pnpm build`, and record the output in `impl-log.md`.

How the CLAUDE.md rules are met:
- R1: the new server file is under `src/server`, with `server-only`, and is reached only from `withAuth`. Lib stays
  pure. `check:layers` covers both.
- R3: only env names; `.env.example` gets names only; the token stays out of logs and bundles.
- R6/D5: the token still goes through the full verifier, and the org comes from the token claim.
- R2: none.
- R4: the browser part is deferred explicitly to SIM-028.1.
- R5: tests as listed.

## Specialist input used
- **Architect R-a (injection in `withAuth`)**: adopted. See Decision A.
- **Architect R-b (two gates, dynamic import, `.next/static` grep)**: adopted, with one simplification: the runtime
  marker and the client flag are the same variable, `NEXT_PUBLIC_SIMAP_DEV_TOKEN` (inlined at dev compile time, set
  only by the launcher), so they cannot disagree. `SIMAP_DEV_TOKEN_MODE` is dropped.
- **Architect R-c (launcher binds loopback, Host allowlist)**: adopted.
- **Architect R-d (public boolean flag instead of a probe)**: adopted for mode detection (Decision B). The UI half goes
  to slice 2.
- **Architect R-e (script details)**: adopted: redirect manual, 20 s timeout, raw-mode prompt, refusing a non-TTY,
  atomic write with mode 600, refusing an in-repo path, the `identityClient.token` validation, UUID check on `--org`.
  `src/lib/validate/uuid.ts` is not imported, because a `.mjs` script cannot import the TS module; the regex is
  duplicated.
- **Architect finding 6 / no org-admin-api change**: confirmed. The script makes the same calls `identityClient.ts`
  makes (l.156-204), from Node, as tudocuatui does.
- **Frontend rec. 3 (proxy-answered `/api/dev-session` probe)**: rejected. With the injection in `withAuth` there is no
  proxy to answer it. A route would exist in production, and it would need an exemption in `routes-guarded.test.ts`
  l.9. The concern that the flag could disagree with the server does not apply, because both read the same
  launcher-set variable. Its SIM-029 concern assumes `pnpm dev:prod` uses browser sign-in, but D56 says dev (prod DB
  included) uses the dev token, so the launcher fits SIM-029.
- **Frontend rec. 1, 2, 4, 5, 6 (separate `DevGate`, `createDevApiFetch`, `devViewForMe`, dev views, badge)**: carried
  into the slice 2 outline as written.
- **Frontend "port `rewriteAuth` to the Web `Headers` API and add the `/api/*` check"**: adopted in
  `devAuthorizationFor`, which takes plain values.
- **Frontend Origin check**: adopted (Origin present must be loopback).

## Assumptions
### Decisions for Ming (defaults chosen; approve or override at the plan gate)
- **A. Injection point → `withAuth` (`src/server/http/with-auth.ts` + new `src/server/http/dev-token.ts`), not
  `src/proxy.ts`.** Reasons:
  - Every bearer route already goes through `withAuth` l.51, enforced by `routes-guarded.test.ts`.
  - `check:layers` does not know `src/proxy.ts` (`check-layers.mjs` l.28-33), so a proxy importing `@/server` would
    break R1 unchecked.
  - A proxy is compiled into production and runs on every matched request there, and it relies on Next's
    request-header override mechanism.
  - SIM-027 (IN_PROGRESS) may create `src/proxy.*` for CSP, so a second ticket writing it invites a conflict.
  - The ticket allows "the equivalent Next 16 hook".
  - Cost: a future route that skips `withAuth` gets no dev token, which is fail-closed.
  - Override path if Ming wants `src/proxy.ts`: a thin proxy with an early `NODE_ENV !== "development"` return,
    `matcher: ["/api/:path*"]`, importing only `@/lib/dev-token`, plus a `check-layers.mjs` rule so `src/proxy.ts` may
    import only lib.
- **B. Client mode detection → `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1` set only by `scripts/dev.mjs`, ANDed with the literal
  `process.env.NODE_ENV === "development"`.** No `/api/dev-session` probe. It is a boolean, carries no secret, folds to
  false in `pnpm build` (`define-env.js` l.76), and needs no production route and no extra round trip. The same
  variable gates the server, so client and server always agree.
- **C. `pnpm dev` always runs dev-token mode (loopback bind + flag).** D56 says "under `pnpm dev` the server adds it".
  There is no `pnpm dev:identity`: browser sign-in from localhost is blocked by CORS anyway. `pnpm exec next dev`
  remains for a plain run (README). SIM-029's `pnpm dev:prod` is expected to reuse `scripts/dev.mjs`.
- **D. No `--org` → unscoped token, as the ticket says.** The script then prints
  `dev-token: no org in the token; simap needs one: re-run with --org <uuid>`. Every `/api/*` call answers 403
  `org_required` until then (`with-auth.ts` l.60). The alternative is to auto-pick the only org through
  `GET /auth/orgs` (about +40 lines and one more Identity call). It is left as a follow-up if Ming wants it.
- **E. Host allowlist → hostname `localhost`, `127.0.0.1` or `[::1]`, any port.** The port is ignored because Next may
  move to 3001 when 3000 is busy (`start-server.js` l.248-251), and DNS rebinding needs a foreign hostname anyway.
  `*.localhost` is not allowed.
- **F. (slice 2) `ProfileView.onSignOut` and `NoAccessView.onSignOut` become optional (button hidden when absent);
  `Session` gains `devToken?: true`.** `NoAccessView` (`src/ui/auth/views.tsx` l.250-265) has the same required prop as
  `ProfileView` (`src/ui/org/ProfileView.tsx` l.29), and dev mode reuses both. The existing gate keeps passing
  `signOut`, so production behaviour is unchanged.
- **G. Split** SIM-028 (this plan) and SIM-028.1 (browser dev mode), see `## Split proposal`.

### Other assumptions
- **No org-admin-api change is needed** (architect finding 6): tudocuatui uses the same calls against the same
  Identity. The only Identity prerequisite is M-1, already in `work/ming-todo.md` l.11. If Ming's step 1 shows that
  Identity rejects the server-side Origin or cookie flow, paste this prompt to the org-admin-api session:
  > "simap local dev (D56) signs in from a Node script like tudocuatui's `scripts/dev-token.sh`: `POST /api/v1/auth/login`
  > then `/auth/token {audience:'simap', account_id, org_id}` with `Origin: https://simap.mmlabs.online` and
  > `X-MM-App: simap`, carrying the login Set-Cookie manually. It fails with <status/code>. Please confirm app `simap`
  > is registered with origin `https://simap.mmlabs.online` (M-1) and that server-side calls with that Origin are
  > accepted the same way as for tudocuatui; report any difference in cookie names or required headers."
- `.env.example` could not be read by the planner (permission deny on `.env*`, per the guardrail). The implementer
  appends the names at the end.
- Identity token lifetime for `simap` is unknown. The verifier caps the token age at 12 h. The script prints
  `expires_in`, and the README tells the user to re-run.
- The launcher is the only thing that sets the flag. Someone who puts `NEXT_PUBLIC_SIMAP_DEV_TOKEN=1` in `.env.local`
  and runs `pnpm exec next dev` (bound to 0.0.0.0) would get injection on a LAN-reachable server, though the Host
  allowlist still applies. This residual risk is documented, not coded around: reading `.env*` from the launcher is
  out of scope.
- The sign-up, forgot-password, verify-email and reset pages still call Identity from the browser and fail under CORS
  in dev. That is unchanged and out of scope.
- **Hotspots:**
  - SIM-027 (IN_PROGRESS, "Security headers, CSP and apiFetch hardening") may edit `src/lib/api/fetch.ts`,
    `next.config.ts` and create `src/proxy.*`. This slice touches none of them; slice 2 touches `fetch.ts` (exporting
    `accessCodeOf`), so expect a rebase there.
  - `README.md`, `package.json` and `CLAUDE.md` are common hotspots; expect trivial rebases.
  - SIM-019.2 (IN_PROGRESS) touches `src/ui/copy/audit.ts` only, so there is no overlap.

## Blocking questions
None.

## Split proposal
Size estimate: about 450 non-test lines for slice 1 and about 350 for slice 2, plus tests. That is about double one
implement/review cycle.

**Slice 1: SIM-028 (this plan).** `pnpm dev:token`, the `pnpm dev` launcher (loopback bind and flag), the server
injection in `withAuth`, README and `.env.example`. ACs 2-6 in full; AC1 for the API half.

**Slice 2: SIM-028.1 "Browser dev-token mode" (new ticket, Depends on SIM-028, Gate plan-approval, Areas ui/security).**
It covers ticket scope bullet 3 and ticket AC1 (browser signed in, no request to `api.mmlabs.online`), plus the
client-bundle half of AC2. Planned shape, from the frontend consult and Decisions B/F:
- `src/ui/auth/AuthGate.tsx`: rename the current body to `IdentityGate`. `AuthGate` renders `<DevGate>` when the inline
  literal `process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SIMAP_DEV_TOKEN === "1"` holds, through a
  module-level `const DevGate = process.env.NODE_ENV === "development" ? lazy(() => import("./DevGate")) : null`, so
  the import folds away in production. The identity path otherwise has a zero-line diff.
- `src/ui/auth/DevGate.tsx` (new):
  - It never calls `getAuthRuntime()`. It runs `/api/me` through `createDevApiFetch` → `readMeResult` →
    `devViewForMe`, and the profile save uses `profilePatchInit` + `mapPatchResult`.
  - Views: `CheckingView`, `RetryView`, `NoAccessView` and `ProfileView` without sign-out, plus a new `DevTokenView`
    for token-invalid (`pnpm dev:token`) and need-org (`pnpm dev:token --org <uuid>`), each with "Check again".
  - It renders `SessionProvider` with `actions={{ refreshPermissions }}` (no signOut or switchOrg) and
    `session.devToken = true`. A 401 mid-session flips to token-invalid through `onAuthLost`.
- `src/lib/api/dev-fetch.ts` (new, pure): one send, strips any `Authorization`, `cache: "no-store"`, 401 →
  `onAuthLost()` + `ApiAccessError("unauthenticated")`, 403 → `ApiAccessError(accessCodeOf(res))`. Also export
  `accessCodeOf` from `src/lib/api/fetch.ts` l.21 (SIM-027 hotspot).
- `src/lib/identity/dev-flow.ts` (new, pure): `devViewForMe(MeResult)` and `devMeErrorView(err)`. signedOut →
  devTokenInvalid, needOrg → devNeedOrg; the rest as `viewForMe`.
- `src/lib/session.ts`: `devToken?: true`. `src/ui/AppShellView.tsx`: an amber "Dev token" badge with a tooltip next
  to the org name when `session.devToken` is set.
- `src/ui/org/ProfileView.tsx`, `src/ui/auth/views.tsx`: optional `onSignOut`.
- Copy: `src/ui/copy/dev-token.ts` (DevTokenView strings, imported only by `DevGate`/`DevTokenView`) and the badge
  label and tooltip in `src/ui/copy/shell.ts`.
- `scripts/check-dev-bundle.mjs` + `pnpm check:dev-bundle`: after `pnpm build`, fails if `.next/static/**` contains
  `pnpm dev:token`, `[dev-token]`, `.config/simap` or `DevGate`. It is not chained into `pnpm build`, because
  `.dockerignore` l.11 excludes `scripts/` from the image build. Adding it to CI is a follow-up for the workflow owner.
- Tests: `dev-fetch.test.ts`, `dev-flow.test.ts`, view render tests for `DevTokenView` and the optional sign-out
  buttons, and a shell badge test.
