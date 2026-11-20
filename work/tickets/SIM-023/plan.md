Status: READY

# Plan — SIM-023: Harden org scope, guarded-routes test and dev-seed guard

## Scope summary
Sources:
- Ticket goal: "an org scope can only come from a verified token, an unguarded `/api` route fails CI, and dev tooling
  can never seed or create databases on a non-local server. Must land before SIM-007 / SIM-010 add org queries."
- `docs/spec-v1.md` §8 Security: "Role checks run on the server for every route handler, server action and protected
  page (SYS-01)." §7: "Dev and test seeds may exist but contain no production data."
- `CLAUDE.md` R6: "every query of org data is scoped by the verified token's `org` claim and roles come only from
  `org_roles` (D5)." R1: "route handlers under `src/app/api/**` are the only entry into `src/server/**` (D4)."
- `work/decisions.md` D4 (bearer token to route handlers) and D5 (multi-org on Identity organizations).
- `work/tickets/SIM-005/security-review.md` finding 1 (SIM005-orgscope-forgeable: "Have `withAuth` build the scope
  once. Add it to the context as `ctx.scope: OrgScope` … Stop exporting `orgScopeOf`") and finding 2
  (SIM005-guard-test-regex: "Import each `route.ts` module … assert that the function carries a marker set by
  `withAuth` … non-enumerable `Symbol.for("simap.withAuth")`").
- `work/tickets/SIM-008/security-review.md` finding 1 ("parse with the same parser pg uses (`pg-connection-string`) …
  refuse if `hostaddr` is set (or … any URL whose `searchParams` has `host` or `hostaddr`)") and finding 2 ("call
  `assertDevSeedTarget(...)` … before `admin.connect()`, and exit 2 on refusal"). Rescan condition (line 77): "findings
  1 and 2 count as resolved only when the new `seeder.test.ts` cases with `?host=` / `?hostaddr=` pass, and
  `schema-check.mjs` refuses a non-local `DATABASE_URL` with exit code 2."

### Handler contract after this ticket (SIM-006, SIM-010 and later build on this)
```ts
// src/server/http/with-auth.ts
export type AuthContext = Readonly<{
  sub: string;
  email: string | null;
  org: string;        // verified `org` claim, for display / responses only
  tier: Tier;
  scope: OrgScope;    // the ONLY way to reach org data; built once by withAuth from the verified token
}>;

withAuth<P = Record<string, string | string[]>>(
  handler: (req: Request, ctx: AuthContext, route: { params: Promise<P> }) => Promise<Response>,
  opts: { tier: Tier },
): (req: Request, route: { params: Promise<P> }) => Promise<Response>   // carries Symbol.for("simap.withAuth")
```
- Handlers read the org scope as `ctx.scope` (third parameter unchanged: `route.params`).
- Org queries: `orgQuery(db, ctx.scope, "select … where org_id = $1 and …", [...])`.
- Server services take `scope: OrgScope` as a parameter, never `org: string` or `orgId: string`.
- No exported function creates an `OrgScope`. `orgScopeOf` is removed.
- Tests that need a scope without going through `withAuth` write `{ orgId: ORG } as OrgScope`. That cast is allowed only
  in `*.test.ts` files; a guard test enforces this (see Tests).
- `MemberGate` keeps its signature `(scope: OrgScope, sub: string) => Promise<"active" | "deactivated">` and receives the
  same `ctx.scope` object.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Handlers receive the org scope from `withAuth`; no exported function turns an arbitrary `{ org }` into an `OrgScope` (a type test or `@ts-expect-error` proves `orgScopeOf({ org: "…" })` no longer compiles or throws). | Run `pnpm typecheck`. `org-scope.test.ts` › "exports no OrgScope constructor" has `// @ts-expect-error` on `mod.orgScopeOf` and on `const forged: OrgScope = { orgId: ORG }`. If either line compiled, typecheck would fail with "unused @ts-expect-error". The runtime part asserts `Object.keys(mod)` is `["orgQuery"]`. `with-auth.test.ts` › "ctx.scope comes from the verified org" passes. `grep -rn "orgScopeOf" src` returns nothing. |
| 2 | The guarded-routes test fails for a fixture route that exports an unwrapped `GET`, an `export { h as POST }`, or a `HEAD`/`OPTIONS` handler, and passes for the real routes. | `pnpm test src/app/api/routes-guarded.test.ts`. The cases "flags fixture: unwrapped GET", "flags fixture: export { h as POST }", "flags fixture: HEAD and OPTIONS" and "accepts fixture: wrapped GET + non-method exports" pass, and so does "every real route.ts except healthz/readyz is guarded". |
| 3 | `assertDevSeedTarget` refuses `postgres://u:pw@localhost/simap?host=10.0.0.5` and `…?hostaddr=10.0.0.5`, and the error message does not contain the password; existing local cases still pass. | `pnpm test db/seeder.test.ts`. The new case "refuses ?host= / ?hostaddr= overrides without echoing the URL" passes, and the existing cases are unchanged and green. |
| 4 | `schema:check` exits 2 without connecting when `DATABASE_URL` is not local. | `pnpm test scripts/schema-check.test.ts`. "exits 2 before connecting for a non-local DATABASE_URL" spawns the script with `DATABASE_URL=postgres://u:secret-pw@10.0.0.5:5432/simap`, and with a `localhost …?host=10.0.0.5` URL. It asserts exit code 2, stderr matching `/not local/`, no `secret-pw` in the output, and no `pass:` line. A connection attempt would hang or exit 1, never 2. |
| 5 | All loop checks green; the two security reviews' findings 1–2 are marked resolved by the review agent rescan. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test` and `pnpm build` are all green. The `security-ai-generated-code-auditor` runs on this ticket (paths `src/server/`, `db/`). Its `security-review.md` must state that SIM005-orgscope-forgeable, SIM005-guard-test-regex and SIM-008 findings 1–2 are resolved. |

## Ming verification after merge
None. Optionally, Ming runs `pnpm schema:check` once locally against `compose.dev.yml` Postgres to confirm the happy path still works. CI's `schema:check` step covers that path too.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/http/org-scope.ts` | Remove `orgScopeOf` and the `AuthContext` import (lines 2, 9-11). Keep the `OrgScope` branded type and `orgQuery`. Rewrite the line-6 comment to describe what is actually enforced: "Created only by `withAuth` from the verified token (`ctx.scope`); no exported constructor. Tests may cast." | AC1, finding SIM005-orgscope-forgeable | Yes (`src/server/http/**`) |
| `src/server/http/with-auth.ts` | Add `scope` to `AuthContext` (readonly). Add a module-private `scopeFor(org)` that returns `Object.freeze({ orgId: org }) as OrgScope`. Build `ctx` once and freeze it. Pass `ctx.scope` to `memberGate` (line 54). Add `export const WITH_AUTH_MARK = Symbol.for("simap.withAuth")` and set it on the returned function with `Object.defineProperty(fn, WITH_AUTH_MARK, { value: true })`, which makes it non-enumerable, non-writable and non-configurable. | AC1, AC2 | Yes |
| `src/server/http/with-auth.test.ts` | Update the line-52 expectation to include `scope: { orgId: ORG }`. Add new cases (see Tests). | AC1, AC2 | Yes |
| `src/server/http/org-scope.test.ts` | Replace the `orgScopeOf` import and use with `const scope = { orgId: ORG } as OrgScope`. Add the type test and the cast-guard test. | AC1 | Yes |
| `src/app/api/me/route.ts` | The handler returns the explicit fields `{ sub, email, org, tier }` instead of `ctx`, so the `/api/me` response does not change and `scope` is not echoed. | Keep the API contract stable after `ctx.scope` is added | No |
| `src/app/api/me/route.test.ts` | Add a 200-path case asserting the body is exactly `{sub,email,org,tier}`. | Locks the contract that SIM-006 consumes | No |
| `src/app/api/routes-guarded.test.ts` | Rewrite: import each real `route.ts` dynamically, run `unguardedMethods(mod)` on it, and run the fixture cases. | AC2, finding SIM005-guard-test-regex | No |
| `src/test/fixtures/routes/unwrapped-get.ts` (new) | `export async function GET() { … }` with no wrap. | AC2 fixture | No |
| `src/test/fixtures/routes/aliased-post.ts` (new) | Imports `withAuth`, uses it for nothing that is exported, and has `const h = async () => new Response(null); export { h as POST };`. | AC2 fixture (alias form plus the "imports withAuth but exports unwrapped" case) | No |
| `src/test/fixtures/routes/head-options.ts` (new) | Unwrapped `HEAD` and `OPTIONS`. | AC2 fixture | No |
| `src/test/fixtures/routes/wrapped.ts` (new) | `export const dynamic = "force-dynamic"; export const GET =\n  withAuth(…)` (multi-line). | AC2 negative control | No |
| `src/server/README.md` | Line 10 becomes: "Org queries use `orgQuery(db, ctx.scope, sql, values)` (`org_id = $1` required). `ctx.scope` is built by `withAuth` only; services take `scope: OrgScope`, never an org id string. Never take an org id from a request." Line 9 also says that `routes-guarded.test.ts` enforces the `withAuth` wrap through a runtime marker. | Finding 1 ("README promise a guarantee the code does not enforce") | No (README is not under `http/`) |
| `db/seeder.js` | Update `assertDevSeedTarget` (lines 11-21); see Approach step 4. Update the header comment (lines 2-3). | AC3, SIM-008 finding 1 | No (it is under `db/` but not `db/migrations/**`; it does trigger the security review) |
| `db/seeder.test.ts` | Add the `?host=`, `?hostaddr=` and empty-host cases. | AC3 | No |
| `scripts/schema-check.mjs` | Between line 15 and line 17, call `assertDevSeedTarget({ databaseUrl: base, nodeEnv: process.env.NODE_ENV })`. On a throw, print `schema check refused: <err.message>` to stderr and `process.exit(2)`. Update the header (lines 1-3) to say the script refuses a non-local target. | AC4, SIM-008 finding 2 | No |
| `scripts/schema-check.test.ts` (new) | Spawned-process refusal test. | AC4 | No |
| `package.json` | Add `"pg-connection-string": "2.14.1"` to `devDependencies`, the exact version `pg` already resolves (lockfile line 869). | pnpm strict resolution: `db/seeder.js` cannot import a transitive dependency | No |
| `pnpm-lock.yaml` | Regenerated by `pnpm add -D pg-connection-string@2.14.1`. No other entries may change. | Follows `package.json` | No |

## Data model / migration
None.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/me` | Bearer token | Unchanged: `{ sub, email, org, tier }` (explicitly built; `scope` is not exposed) | 200, 401, 403, 503, 500 (unchanged) | tier `user` (unchanged) |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/server/http/org-scope.test.ts` › "exports no OrgScope constructor" | AC1. `import * as mod from "./org-scope"`. Asserts `Object.keys(mod).sort()` equals `["orgQuery"]`. Has `// @ts-expect-error orgScopeOf was removed` on `mod.orgScopeOf`, and `// @ts-expect-error a plain object is not an OrgScope` on `const forged: OrgScope = { orgId: ORG }`. |
| `src/server/http/org-scope.test.ts` › "OrgScope is cast only in with-auth.ts and tests" | AC1 defence in depth. Walks `src/**/*.{ts,tsx}`, skipping `*.test.*`, and fails on `/\bas\s+(unknown\s+as\s+)?OrgScope\b/` or `<OrgScope>` in any file other than `src/server/http/with-auth.ts`. This is a text heuristic, labelled as such in the test. |
| `src/server/http/org-scope.test.ts` › existing `orgQuery` cases | Unchanged behaviour, now built with a cast scope. |
| `src/server/http/with-auth.test.ts` › "ctx.scope comes from the verified org, is frozen, and is the scope given to the member gate" | AC1. `handler.mock.calls[0][1].scope.orgId === ORG`, `Object.isFrozen(scope)` and `Object.isFrozen(ctx)` are true, and `memberGate.mock.calls[0][0]` is the same object as `ctx.scope`. |
| `src/server/http/with-auth.test.ts` › "returned function carries a non-enumerable withAuth marker" | AC2. `fn[Symbol.for("simap.withAuth")] === true`, the marker is not in `Object.keys(fn)`, and `WITH_AUTH_MARK === Symbol.for("simap.withAuth")`. |
| `src/server/http/with-auth.test.ts` › existing "manager token reaches a manager route…" | Expectation updated to `{ sub, email, org, tier, scope: { orgId: ORG } }`. |
| `src/app/api/routes-guarded.test.ts` › "flags fixture: unwrapped GET" | AC2: `unguardedMethods(await import(fixture))` returns `["GET"]`. |
| `src/app/api/routes-guarded.test.ts` › "flags fixture: export { h as POST }" | AC2: returns `["POST"]`. |
| `src/app/api/routes-guarded.test.ts` › "flags fixture: HEAD and OPTIONS" | AC2: returns `["HEAD", "OPTIONS"]`. |
| `src/app/api/routes-guarded.test.ts` › "accepts fixture: wrapped GET + non-method exports" | AC2 negative control: returns `[]`. |
| `src/app/api/routes-guarded.test.ts` › "every real route.ts except healthz/readyz is guarded" | AC2. At least one route is found. Every real non-probe route returns `[]` and exports at least one HTTP method. The existing "no `authorization` in source" check is kept. |
| `src/app/api/me/route.test.ts` › "valid token -> 200 with exactly {sub,email,org,tier}" | Contract unchanged. Stub `MM_IDENTITY_ISSUER` to `https://api.mmlabs.online` and preset `globalThis.__simapAuth = { issuer: <same>, deps: { verifier: fake ok, memberGate: active, log: noop } }`. `getAuthDeps` reuses it because the issuer matches (`with-auth.ts:83`). |
| `db/seeder.test.ts` › "refuses ?host= / ?hostaddr= overrides without echoing the URL" | AC3. Uses `postgres://u:secret-pw@localhost:5432/simap?host=10.0.0.5`, `…?hostaddr=10.0.0.5` and `…?host=localhost` (any `host` param is refused). Each throws `/not local/` and the message does not contain `secret-pw`. |
| `db/seeder.test.ts` › "refuses an empty host and a unix socket path" | AC3 edge cases: `postgres:///simap` and `postgres://u:secret-pw@%2Fvar%2Frun%2Fpostgresql/simap` both throw `/not local/`. |
| `db/seeder.test.ts` › existing 4 cases | Unchanged and green ("not a url secret-pw" must still give `/missing or invalid/`). |
| `scripts/schema-check.test.ts` › "exits 2 before connecting for a non-local DATABASE_URL" | AC4. Runs `spawnSync(process.execPath, ["scripts/schema-check.mjs"], { env: { PATH: process.env.PATH, DATABASE_URL: … }, timeout: 15000, encoding: "utf8" })`. The env is minimal and never dumped. Covers both URLs (`10.0.0.5` and `localhost…?host=10.0.0.5`). Asserts `status === 2`, stderr matches `/not local/`, combined output has no `secret-pw` and no `pass:` line. |
| `scripts/schema-check.test.ts` › "exits 2 with NODE_ENV=production" | AC4. Uses a localhost URL with `NODE_ENV=production`, expects `status === 2` and `/production/`. |

## Approach
1. **Org scope (High path, `src/server/http/**`).**
   - In `org-scope.ts`, delete `orgScopeOf` and the `import type { AuthContext }`. Keep the `OrgScope` type and `orgQuery` unchanged.
   - In `with-auth.ts`, add the private `scopeFor`. After the tier check (line 51), build `const ctx: AuthContext = Object.freeze({ sub, email, org, tier, scope: scopeFor(org) })`.
   - Call `d.memberGate(ctx.scope, sub)`.
   - The handler call is unchanged: `handler(req, ctx, route)`.
   - Meets R6: the scope comes only from the verified `org` claim. R1 is untouched.
2. **Marker.** Inside `withAuth`, assign the async arrow to `const guarded`, then call `Object.defineProperty(guarded, WITH_AUTH_MARK, { value: true })` and return `guarded`. The return type stays the same function type, so Next's route type check (`next typegen`) is unaffected.
3. **Guarded-routes test.**
   - A local helper `unguardedMethods(mod: Record<string, unknown>): string[]` checks `["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"]`.
   - It flags any key that is present but is not a function carrying `WITH_AUTH_MARK === true`.
   - Real routes are found by the existing directory walk and loaded with `await import(pathToFileURL(abs).href)`. Vitest resolves `@/` and stubs `server-only`. Importing `me/route.ts` reads no env (lazy deps, `with-auth.ts:80`).
   - Probes are skipped before import.
   - Fixtures live in `src/test/fixtures/routes/`, outside `src/app`, so Next never serves them. `check-layers` classifies `src/test/` as no layer, so their `@/server` import is not flagged. They are named `*.ts`, not `route.ts`, and are not `*.test.ts`. They must still typecheck.
4. **Seed guard** (`db/seeder.js`).
   - Order of checks: (a) `NODE_ENV === "production"` is refused (unchanged). (b) A missing value is refused (unchanged). (c) `new URL(databaseUrl)` is kept only as a validity check; a throw gives "missing or invalid". This keeps the existing "not a url secret-pw" case. (d) If `u.searchParams.has("host") || u.searchParams.has("hostaddr")`, refuse with "database host is not local". (e) `const cfg = parse(databaseUrl)` from `pg-connection-string`. If `cfg.hostaddr` is set, or `cfg.host` is not in `LOCAL_HOSTS`, refuse with "database host is not local".
   - Every message is a fixed string; none contains the URL.
   - `seed-dev.js` already calls the guard and needs no change.
   - Import form: `import { parse } from "pg-connection-string"`. 2.14.1 ships an ESM entry and `index.d.ts`. If the named import fails under Node ESM, fall back to `import pgcs from "pg-connection-string"; pgcs.parse(...)` and record it in impl-log.
5. **schema:check.** Call the guard right after the `!base` check (line 15), before `new URL` (line 19) and before `admin.connect()` (line 32). Exit 2 on refusal. The refusal message is the guard's fixed text, never the URL. CI uses `localhost` (ci.yml:47-51), so it is unaffected.
6. **`/api/me`.** Return `Response.json({ sub: ctx.sub, email: ctx.email, org: ctx.org, tier: ctx.tier }, { headers: { "Cache-Control": "no-store" } })`.
7. **README and comments**, as listed in Files.
8. **Dependency.** Run `pnpm add -D pg-connection-string@2.14.1`. Check that the lockfile diff only adds the importer entry.
9. **Checks.** Run `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, and `pnpm build`.

Rules:
- R1: no new cross-layer import; the test in `src/app/api` importing `@/server/http/with-auth` is allowed (api → server).
- R3: no env values are written; the test env holds only fake URLs.
- R4: Out of scope items stay out, in particular the JWKS log rate limit, the `kid` cooldown and `search_path`.
- R5: every change has a test.
- R6: met by step 1.

Estimated diff: about 250 changed lines, which fits one cycle.

## Specialist input used
None. The `security` area has no consult agent. The two security reviews quoted above are the specialist input:
- SIM005-orgscope-forgeable: the `ctx.scope` option is adopted. The `WeakSet` runtime check is rejected; see Assumption 2.
- SIM005-guard-test-regex: the marker option is adopted. The regex-extension alternative is rejected because it stays bypassable.
- SIM-008 findings 1 and 2: adopted as written.

## Assumptions
Each assumption is a decision with a stated default. Ming can override any of them in the batch approval round.
1. **Handler signature (SIM-006 and SIM-010 depend on it).** Default: the scope is a field on the context, `ctx.scope`, and the handler signature `(req, ctx, route)` is unchanged. The alternative was a 4th argument or a separate `scope` argument. It was rejected because it changes the positional signature that existing tests and route params already use.
2. **Forgery protection is compile-time plus a cast guard, not a runtime `WeakSet`.** Default: no exported constructor, a branded type, a frozen scope, and a test that bans `as OrgScope` outside `with-auth.ts` and tests. A `WeakSet` check inside `orgQuery` was considered and rejected. It would force every service unit test (SIM-010 onward) to obtain a scope through `withAuth` with fake deps, which is heavy for little gain. A deliberate `as` cast is visible in review and caught by the guard test.
3. **`AuthContext` keeps `org: string`.** It is useful for responses such as `/api/me` and for logs that never print it. Only `scope` is accepted by `orgQuery`.
4. **`/api/me` response stays `{sub, email, org, tier}`.** `scope` is not exposed. SIM-006 can rely on this shape.
5. **`pg-connection-string` is added as an exact-pinned devDependency**, `2.14.1`, the version `pg` already resolves, so nothing new is downloaded. It is a devDependency because only dev tooling (`seeder.js`, `schema-check.mjs`) uses it, and the image does not ship either file (Dockerfile:24 copies only `migrate.js` and `migrator.js`). When `pg` bumps its own copy, the two may differ. The guard then parses with an older parser, which is still conservative because of the explicit `host`/`hostaddr` query-parameter refusal.
6. **Unix-socket and empty-host URLs are refused by the seed guard.** `compose.dev.yml` uses TCP `localhost`, so local dev is unaffected. This is stricter than before; before, an empty host was already refused by `LOCAL_HOSTS`.
7. **Any `host` query parameter is refused**, even `?host=localhost`. This is simpler and safer than checking its value.
8. **Hotspots.** SIM-006 and SIM-010 are in PLANNING in the same batch:
   - SIM-010 will add `src/app/api/**/route.ts` files and use `ctx.scope`. It must land after this ticket, or rebase on it.
   - If SIM-006 edits `src/app/api/me/route.ts`, `with-auth.ts` or `routes-guarded.test.ts`, expect a rebase.
   - New routes from either ticket are automatically covered by the new guarded-routes test. A route that is not wrapped fails CI.
9. **The guarded-routes test requires each non-probe route to export at least one HTTP method.** A `route.ts` with no handler is a mistake, not a security risk. The test still flags it so the walk cannot silently test nothing.

## Blocking questions
None.

## Split proposal
None.
