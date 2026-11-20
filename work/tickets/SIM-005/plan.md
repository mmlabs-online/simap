Status: READY

# Plan — SIM-005: Verify Identity tokens on the server and guard /api routes

Gate: plan-approval (High paths: `src/server/identity/**`, `src/server/http/**`, `.env.example`). Every decision Ming
must make is listed under `## Assumptions` → "Decisions for Ming" with a default, so the plan can be approved as-is.

## Scope summary
- Ticket goal: "Every `/api/*` route handler knows who calls it, in which org and with which tier, by verifying the
  mmlabs Identity access token the tudocuatui way, and refuses everything else."
- spec §3 Auth (D4): "Every simap API call is a Next.js **route handler** under `/api/*`, called with
  `Authorization: Bearer <token>`. The handler verifies the token (port of tudocuatui `server/identity.js` + `jwks.js`)
  and reads `sub`, `email`, `org`, `org_roles`."
- spec AUT-02: "Every `/api/*` route handler gets the caller's verified identity: `sub`, email, `org`, simap tier (from
  `org_roles`), linked member. Org data is read and written only with that `org`." (The "linked member" is SIM-007.)
- spec AUT-02: "ES256 only; keys from the JWKS URL, cached; a header carrying `jku`/`x5u`/`jwk`/`x5c` is refused; exact
  `iss`; `aud` = `simap`; `typ` = `at+jwt`; `exp`/`iat`/`sub`/`jti` required; small clock leeway; `email_verified`
  true; `sub` is a UUID. Any failure is 401. `org` present without `org_roles` is 401. A valid token without `org` or
  without a simap org role gets 403 on org routes. If the JWKS is unavailable the answer is 503, so the client keeps
  the session instead of signing out."
- spec §2 Roles: "Roles come from the token's `org_roles` claim … org data is never authorized from `roles`";
  "`simap:member`: app-scope default role on join; grants no org access"; "Several roles in one org: the highest tier
  wins, Admin > Manager > User (D15)."
- spec AUT-04: "Each account maps to exactly one simap tier per org: the highest simap role in `org_roles`."
- spec SYS-01: "Every mutation and every protected read checks the caller's tier on the server. A forbidden call is
  refused with 403 or the app's single error shape"; "Unit tests cover the role mapping and the role gate helper";
  "Every query of org data is filtered by the caller's `org` … A unit test covers the org-scoping helper."
- spec MEM-01 (hook only): "simap refuses their calls to org data (app-local deny list, `consumers.md` item 11)" — the
  data comes in SIM-011; this ticket provides the hook.
- spec §8 Security: "Token verification fails closed (AUT-02)"; "No secrets, tokens, raw claims or personal data in
  logs or client bundles. Logs carry only fixed error codes."
- decisions: D4, D5, D7 ("client re-mints after a 403"), D9 ("simap does not read or enforce `ent`"), D14 (role keys),
  D15 (highest tier wins), D34 (deactivation is simap-local). CLAUDE.md R1, R3, R5, R6.
- org-admin-api `docs/consumers.md` §"Verifying (backend) checklist" lines 391-420 and lines 422-432 ("Authorize
  org-scoped data and actions **only** from `org_roles` … If `org` is present and `org_roles` is absent, reject the
  token."), line 457 ("Token size is up to about 5 KB").

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A valid org token with `simap:manager` in `org_roles` reaches a Manager+ route with `{ sub, email, org, tier: 'manager' }`. | `src/server/http/with-auth.test.ts` › "manager token reaches a manager route with {sub,email,org,tier}" (handler receives exactly that object, `toEqual`). Also `src/app/api/me/route.test.ts` › "returns the caller's context". |
| 2 | Each rejection returns 401 with no details: wrong alg, `typ`, `iss`, `aud`, expired, unknown `kid`, key in header, `email_verified` false, non-UUID `sub`, `org` without `org_roles`. | `src/server/identity/verify.test.ts` (one `it` per cause, internal code asserted) and `src/server/http/with-auth.test.ts` › "every token failure is 401 {error:{code:'unauthenticated'}} with WWW-Authenticate: Bearer" (table-driven over the same causes; body identical for all). `pnpm test` green. |
| 3 | A token without `org`, or with no simap role in `org_roles`, gets 403 on org routes; `roles` (app scope) never grants org access. | `with-auth.test.ts` › "no org → 403 org_required", "org_roles without a simap tier role → 403 forbidden", "simap:admin only in `roles` → 403 forbidden"; `src/lib/auth/tier.test.ts` negative cases. |
| 4 | JWKS unreachable → 503, not 401. | `verify.test.ts` › "JWKS failures → unavailable" and "rotated key during outage → unavailable"; `with-auth.test.ts` › "JWKS unavailable → 503 {error:{code:'unavailable'}} with Retry-After". Ported `src/server/identity/jwks.test.ts` cases. |
| 5 | Tokens and claims are never logged; unit tests cover every rule above with a local ES256 key and JWKS. | `verify.test.ts` › "failures are fixed codes only and never log" (console spies, injected `log` sees only `{event, reason}` / `{event, code}`); `with-auth.test.ts` › "logs never contain the token, sub, email or org" (spy on injected log + console, assert serialized output excludes them). Reviewer greps the diff for `console.` / `log(` in `src/server/identity` and `src/server/http` and checks only fixed fields. All tests use `jose` `generateKeyPair("ES256")` and `createLocalJWKSet` or a fake `fetch` JWKS. |
| 6 | (Ticket scope) Org-scoping helper every org query must use (R6), and a deny-list hook for SIM-011. | `src/server/http/org-scope.test.ts` (scope comes only from the verified `org`; `$1` prepended; SQL without `org_id = $1` throws). `with-auth.test.ts` › "member gate deactivated → 403 member_deactivated", "member gate throws → 503 unavailable", "default gate allows". |
| 7 | (Ticket scope) `MM_IDENTITY_ISSUER` in `.env.example`; production must be `https://api.mmlabs.online`. | `git diff -U0 -- .env.example` shows exactly one added line `MM_IDENTITY_ISSUER=` (plus an optional comment line) and no value. `src/server/identity/config.test.ts` › "production allows only the production issuer". |
| 8 | (Ticket scope / risk) No `/api` route is accidentally unguarded. | `src/app/api/routes-guarded.test.ts` › "every route.ts except healthz/readyz uses withAuth". |
| 9 | Checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` (build must pass with **no** `MM_IDENTITY_ISSUER` set: proves config is lazy). |

## Ming verification after merge
- Once M-1 (Identity app `simap` registered) exists: get a real org token from `/auth/token` with `audience: "simap"`
  and an `org_id`, run `pnpm dev` with `MM_IDENTITY_ISSUER=https://api.mmlabs.online` in `.env.local`, and
  `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/me` → 200 `{sub,email,org,tier}`; without the
  header → 401; with a token minted without `org_id` → 403 `org_required`. (Ming's step: the token is a credential; an
  agent must not handle it.)
- Confirm a real org token with several `org_roles` stays under the 8192-character cap (expected ~5 KB per
  consumers.md:457).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `package.json` | Add dependency `"jose": "6.2.17"` (exact; the version tudocuatui resolves from `^6.2.17`) via `pnpm add jose@6.2.17` | Token verification (D2 allows `jose`) | No (Medium) |
| `pnpm-lock.yaml` | Updated by `pnpm add` only, never by hand | Frozen-lockfile installs | No |
| `src/lib/validate/uuid.ts` | `isCanonicalUuid(v: unknown): v is string`: lowercase `^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` (rejects nil UUID, uppercase, whitespace, non-strings). Replaces tudocuatui `user.js#toUserId` | `sub` and `org` must be canonical UUIDs | No |
| `src/lib/validate/uuid.test.ts` | Unit tests | R5 | No |
| `src/lib/auth/tier.ts` | `type Tier = "user" \| "manager" \| "admin"`, `TIER_RANK`, `atLeast(tier, min)`, `tierFromOrgRoles(roles: readonly string[]): Tier \| null` with exact keys `simap:admin`/`simap:manager`/`simap:user`, highest wins, everything else ignored | AUT-04, D14, D15; pure so the UI can reuse it (SYS-01) | No |
| `src/lib/auth/tier.test.ts` | Unit tests | SYS-01 "role mapping" test | No |
| `src/lib/api/error.ts` | `type ApiErrorCode = "unauthenticated" \| "org_required" \| "forbidden" \| "member_deactivated" \| "unavailable" \| "internal"` and `type ApiErrorBody = { error: { code: ApiErrorCode } }` (types + a `API_ERROR_CODES` const only, no I/O) | One error shape shared with the SIM-006 client | No |
| `src/server/identity/config.ts` | Port of `loadIdentityConfig` + `IdentityConfigError` + `ISSUER_PROD` from tudocuatui `identity.js:17-47`, typed, starts with `import "server-only"` | Exact `iss`; prod issuer rule | **Yes** (`src/server/identity/**`, `**/config.*`) |
| `src/server/identity/config.test.ts` | Port of `identity.test.ts:436-490` (`loadIdentityConfig` block) | R5 | **Yes** |
| `src/server/identity/jwks.ts` | Near line-for-line TS port of tudocuatui `jwks.js` (FRESH 300 s, MAX_STALE 24 h, COOLDOWN 60 s, 64 KB cap, EC P-256 filter, single-flight, `redirect:"error"`, timeout). Only change: `User-Agent: "simap-server"` | consumers.md items 2, 3, 10 | **Yes** |
| `src/server/identity/jwks.test.ts` | Port of tudocuatui `jwks.test.ts` (all cases listed at its lines 33-271) | R5, AC4 | **Yes** |
| `src/server/identity/verify.ts` | Port of `createIdentityVerifier` (`identity.js:49-151`) with the simap changes in Approach step 3 | AUT-02 token rules | **Yes** |
| `src/server/identity/verify.test.ts` | Port of `identity.test.ts:1-435` adapted (aud `simap`, `org`/`org_roles`, Authorization string input) plus new cases | AC2, AC4, AC5 | **Yes** |
| `src/server/http/respond.ts` | `apiError(status, code)` → `Response.json({error:{code}}, {status, headers})` with `Cache-Control: no-store` always, `WWW-Authenticate: Bearer` on 401, `Retry-After: 5` on 503 | One error shape (§8, SYS-01) | **Yes** (`src/server/http/**`) |
| `src/server/http/respond.test.ts` | Unit tests for status/body/headers | R5 | **Yes** |
| `src/server/http/org-scope.ts` | Branded `OrgScope`, `orgScopeOf(ctx)`, `orgQuery(db, scope, text, values)` | R6, SYS-01 org-scoping helper | **Yes** |
| `src/server/http/org-scope.test.ts` | Unit tests | SYS-01 "A unit test covers the org-scoping helper" | **Yes** |
| `src/server/http/with-auth.ts` | `AuthContext`, `MemberGate`, `createWithAuth(deps)`, default `withAuth(handler, { tier })`, lazy `getAuthDeps()` cached on `globalThis.__simapAuth` | Route guard (ticket scope) | **Yes** (`src/server/http/**`) |
| `src/server/http/with-auth.test.ts` | Unit tests (guard flow, codes, gate, logging, 500) | AC1-AC6 | **Yes** |
| `src/app/api/me/route.ts` | `export const dynamic = "force-dynamic"`; `export const GET = withAuth(async (_req, ctx) => Response.json(ctx, {headers:{"Cache-Control":"no-store"}}), { tier: "user" })` | Manual-test target from the ticket's Test plan; contract SIM-006/007 extend (Decision 6) | No (Medium) |
| `src/app/api/me/route.test.ts` | Test via `createWithAuth` seam is not reachable from the route export, so this test only asserts the export shape: `GET` is a function and an unauthenticated request returns 503 `unavailable` when `MM_IDENTITY_ISSUER` is unset (proves fail-closed lazy config) and 401 when set to a valid issuer with no header | Route wiring | No |
| `src/app/api/routes-guarded.test.ts` | Scans `src/app/api/**/route.ts` (fs, relative to repo root); every file except `healthz/route.ts`, `readyz/route.ts` must import `withAuth` from `@/server/http/with-auth` and must not read `authorization` itself | Fail-open risk (both consults) | No |
| `.env.example` | **Append** a comment line `# mmlabs Identity issuer; production must be https://api.mmlabs.online` and `MM_IDENTITY_ISSUER=` without reading the file (deny rule `Read(**/.env.*)`), as SIM-002 did (`work/tickets/SIM-002/impl-log.md:16,37`) | Ticket scope, R3 | **Yes** |
| `src/server/README.md` | Two lines: route handlers use `withAuth`; org queries use `orgQuery` with an `OrgScope` | Conventions for SIM-007+ | No |

Not touched: `scripts/check-layers.mjs` (High; the unguarded-route check is a Vitest instead), `src/app/api/healthz/*`,
`src/app/api/readyz/*` (health probes keep their own `{status}` shape), `src/server/db/pool.ts`.

## Data model / migration
None. (The deny-list table comes from SIM-008/SIM-011; `orgQuery` assumes `org_id uuid not null` per SIM-008 ticket
line 25.)

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/me` | `Authorization: Bearer <Identity access token>` (`aud=simap`, with `org`) | 200 `{ sub: string, email: string \| null, org: string, tier: "user" \| "manager" \| "admin" }`, `Cache-Control: no-store` | 200; 401 `unauthenticated`; 403 `org_required` / `forbidden` / `member_deactivated`; 503 `unavailable`; 500 `internal` | tier `user`+ |
| any | every future `/api/*` route wrapped by `withAuth` | same header | handler's response | Error body always `{ "error": { "code": <ApiErrorCode> } }`, `Cache-Control: no-store`; 401 adds `WWW-Authenticate: Bearer`; 503 adds `Retry-After: 5` | per route `{ tier }` (required option) |

Error-code mapping (chosen; see Decision 2):
| Status | `error.code` | When | Client action (SIM-006, D7) |
|---|---|---|---|
| 401 | `unauthenticated` | any token failure (missing/malformed/too large header, alg, signature, typ, iss, aud, exp/iat/nbf/age, unknown kid, key in header, missing jti, `email_verified` ≠ true, bad `sub`, `org` present and not a canonical UUID, `org` without `org_roles`, `org_roles` not a string array, `org_roles` without `org`) | re-mint / sign in |
| 403 | `org_required` | verified token without `org` | pick an org (AUT-06) |
| 403 | `forbidden` | no simap tier in `org_roles`, or tier below the route's | re-mint once, then "no permission" |
| 403 | `member_deactivated` | member gate says deactivated (SIM-011) | show message, no re-mint |
| 503 | `unavailable` | JWKS unavailable, `MM_IDENTITY_ISSUER` missing/invalid, member gate threw | keep session, retry |
| 500 | `internal` | handler threw | — |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/validate/uuid.test.ts` › "accepts canonical lowercase v4/v7 UUIDs" | uuid |
| `uuid.test.ts` › "rejects uppercase, padded, nil, braces, no dashes, non-strings" | uuid edge cases |
| `src/lib/auth/tier.test.ts` › "maps each exact key to its tier" | AUT-04 |
| `tier.test.ts` › "highest tier wins regardless of order (D15)" (`[user, admin]`, `[manager, user]`, duplicates) | D15 |
| `tier.test.ts` › "ignores simap:member, simap:org:invite, simap:viewer, simap:Admin, ' simap:admin', other:admin, empty string → null" | fail-open risk |
| `tier.test.ts` › "empty list → null"; "atLeast ranks user < manager < admin" | role gate |
| `src/server/identity/config.test.ts` › ported 5 cases (missing; prod issuer accepted; rejects userinfo/port/path/query/fragment/trailing slash without printing the value; production only `https://api.mmlabs.online`; non-prod https hosts and `http://localhost:<port>`) | config |
| `src/server/identity/jwks.test.ts` › all ported cases: lazy; fresh 300 s; single-flight; stale ≤ 24 h; > 24 h → `JwksUnavailable`; 60 s cooldown; no keys ever; recovery; unknown kid ≤ 1 refetch/60 s; unknown kid during outage; bad responses (status, size by header and by stream, bad JSON, non-UTF-8, empty keys) keep last good set; log has only `{event, reason}`; real signed token verifies; key filter (3 cases) | AC4, consumers items 2/3/10 |
| `src/server/identity/verify.test.ts` › "happy path: returns sub, email, org, orgRoles" | AC1 base |
| `verify.test.ts` › "email absent/empty/non-string → null" | email |
| `verify.test.ts` › "alg HS256, RS256, ES384 → alg; unsecured → malformed; key getter never called" | AC2 alg |
| `verify.test.ts` › "typ missing or JWT → claim_typ" | AC2 typ |
| `verify.test.ts` › "iss variants (trailing slash, http, other host, prefix match) → claim_iss" | AC2 iss |
| `verify.test.ts` › "aud tudocuatui, array aud ['simap'] → claim_aud" | AC2 aud |
| `verify.test.ts` › "expired beyond 30 s leeway → expired; within leeway ok; iat in future; nbf; age > 12 h → claim_iat" | AC2 exp, leeway, maxTokenAge |
| `verify.test.ts` › "missing exp/iat/sub/jti/iss/aud and numeric or empty jti" | required claims |
| `verify.test.ts` › "unknown kid → unknown_kid; same kid other key → signature" | AC2 kid |
| `verify.test.ts` › "jku/x5u/jwk/x5c in header → key_in_header, getter not consulted, also with real kid" | AC2 key in header |
| `verify.test.ts` › "email_verified false, 'true', 1, missing → email_unverified" | AC2 |
| `verify.test.ts` › "sub uppercase, padded, nil, non-UUID, number → sub_invalid" | AC2 sub |
| `verify.test.ts` › "org present, org_roles missing → org_roles_missing (401)" | AC2 org without org_roles |
| `verify.test.ts` › "org_roles not an array or with a non-string → org_roles_invalid (401)" | malformed claim |
| `verify.test.ts` › "org_roles without org → org_roles_invalid (401)" | contract violation |
| `verify.test.ts` › "org uppercase / non-UUID / number → org_invalid (401)" | R6 canonical org |
| `verify.test.ts` › "no org → ok with org null, orgRoles null" | feeds 403 |
| `verify.test.ts` › "roles claim is never read (token with roles only, no org → org null)" | AC3 |
| `verify.test.ts` › "Authorization shapes: null, '', 'Basic x', 'Bearer', two tokens, lowercase bearer ok" | header parsing |
| `verify.test.ts` › "a 6,000-char valid token verifies; header > 7 + 8192 → too_large before key getter" | token cap |
| `verify.test.ts` › "JWKS failures (fetch throws, 500, timeout) → {ok:false, code:'jwks_unavailable', unavailable:true}" | AC4 |
| `verify.test.ts` › "rotated key during JWKS outage → unavailable (not unknown_kid)" | AC4 |
| `verify.test.ts` › "failures are fixed codes from the enum and never log (console spies)" | AC5 |
| `src/server/http/respond.test.ts` › "401 has WWW-Authenticate: Bearer and no-store; 503 has Retry-After: 5; body is exactly {error:{code}}" | error shape |
| `src/server/http/with-auth.test.ts` › "manager token reaches a manager route with {sub,email,org,tier:'manager'}" | AC1 |
| `with-auth.test.ts` › "admin token passes manager route with tier admin; user token on manager route → 403 forbidden" | tier gate |
| `with-auth.test.ts` › "every token failure is 401 {error:{code:'unauthenticated'}}" (table over verifier codes) | AC2 |
| `with-auth.test.ts` › "no org → 403 org_required; org_roles without simap tier → 403 forbidden; simap:admin only in roles → 403 forbidden" | AC3 |
| `with-auth.test.ts` › "JWKS unavailable → 503 unavailable; handler not called" | AC4 |
| `with-auth.test.ts` › "missing/invalid MM_IDENTITY_ISSUER → 503 unavailable and one log {event:'identity_config_invalid'}" | lazy config, fail closed |
| `with-auth.test.ts` › "member gate: default allows; deactivated → 403 member_deactivated; throws → 503 unavailable + log {event:'member_gate_failed'}; gate not called when tier check fails" | deny-list hook |
| `with-auth.test.ts` › "handler throws → 500 internal, body has no message, log has only {event:'api_unhandled', code}" | no leak |
| `with-auth.test.ts` › "forwards Next route params promise to the handler" | Next 16 params |
| `with-auth.test.ts` › "logs never contain the token, sub, email or org (spy injected log and console)" | AC5 |
| `src/server/http/org-scope.test.ts` › "orgScopeOf takes orgId only from the verified context" | R6 |
| `org-scope.test.ts` › "orgQuery prepends scope.orgId as $1 and passes the remaining values shifted" | R6 |
| `org-scope.test.ts` › "orgQuery throws before querying when SQL lacks `org_id = $1` (case/whitespace tolerant)" | R6 guard |
| `src/app/api/me/route.test.ts` › "no MM_IDENTITY_ISSUER → 503 unavailable"; "valid issuer, no Authorization → 401 unauthenticated, no network call" | wiring, laziness |
| `src/app/api/routes-guarded.test.ts` › "every route.ts except healthz/readyz uses withAuth" | fail-open guard |

## Approach
1. **Dependency.** `pnpm add jose@6.2.17` (exact pin). Commit `SIM-005: add jose`.
2. **Mechanical port first** (architect rec. 2, keeps the review diff readable). Create `config.ts`, `jwks.ts`,
   `verify.ts` and their tests as TS ports of tudocuatui `server/identity.js` / `jwks.js` / `identity.test.ts` /
   `jwks.test.ts` with only mechanical changes (types, `import "server-only"` first line, `.js` imports dropped, `@/`
   alias for lib imports). Get them green. Commit `SIM-005: port Identity verifier and JWKS resolver from tudocuatui`.
   Read the references at: `ref-tudocuatui-main/server/identity.js:1-151`, `jwks.js:1-157`,
   `identity.test.ts:1-490`, `jwks.test.ts:1-290`.
3. **simap changes to `verify.ts`** (commit `SIM-005: adapt verifier to simap org tokens`):
   - `AUDIENCE = "simap"`; `MAX_TOKEN_CHARS = 8192` (Decision 1); keep `MAX_TOKEN_AGE_S = 43200`, `clockTolerance: 30`,
     `algorithms: ["ES256"]`, `typ: "at+jwt"`, `requiredClaims: ["exp","iat","sub","jti","iss","aud"]`, string-`aud`
     and non-empty-`jti` checks, `KeyInHeader` check before key lookup, lazy resolver, `codeOf` mapping.
   - Input: `verify(authorization: string | null)` (from `req.headers.get("authorization")`), replacing the Node `req`.
   - Remove `ROLE_PREFIX` and the `roles`/`no_role` check entirely; `roles` is never read (consumers.md:427-431).
   - After `email_verified` and `sub` (`isCanonicalUuid`, from `src/lib/validate/uuid.ts`) checks, in this order:
     (a) `org` absent: if `org_roles` is present → `org_roles_invalid`; else return ok with `org: null, orgRoles: null`.
     (b) `org` present: not `isCanonicalUuid` → `org_invalid`; `org_roles` absent → `org_roles_missing`; not an array of
     strings → `org_roles_invalid`. Then return
     `{ ok: true, identity: { sub, email, org, orgRoles } }`.
   - Ignore `ent` with a comment citing D9.
   - Result type: `{ ok: true; identity: VerifiedIdentity } | { ok: false; code: VerifyCode; unavailable?: true }`,
     where `VerifyCode` is the tudocuatui enum minus `no_role` plus `org_invalid`, `org_roles_missing`,
     `org_roles_invalid`. Codes are internal (tests only), never in responses or logs except `jwks_refresh_failed`.
   - No tier logic, no HTTP here.
4. **Pure lib modules**: `uuid.ts`, `tier.ts`, `api/error.ts` with tests (Domain focus: empty/null fields).
5. **HTTP layer** (commit `SIM-005: add withAuth guard, error shape and org scope`):
   - `respond.ts`: `apiError(status, code)` per the API contract table.
   - `with-auth.ts`:
     - `type AuthContext = { sub: string; email: string | null; org: string; tier: Tier }` (exactly the AC1 fields).
     - `type MemberGate = (scope: OrgScope, sub: string) => Promise<"active" | "deactivated">`; `allowAll` default.
     - `createWithAuth(deps: () => AuthDeps)` where `AuthDeps = { verifier, memberGate, log }` or a config error.
       Returns `withAuth<P>(handler: (req: Request, ctx: AuthContext, route: { params: Promise<P> }) => Promise<Response>, opts: { tier: Tier })`
       → `(req: Request, route: { params: Promise<P> }) => Promise<Response>`. `opts.tier` is required (no default).
     - Flow, all inside one try/catch: deps (config error → log `{event:"identity_config_invalid"}` once per process,
       503) → `verify(req.headers.get("authorization"))` (`unavailable` → log `{event:"jwks_unavailable"}`, 503; any
       other failure → 401, not logged) → `org === null` → 403 `org_required` → `tierFromOrgRoles` null or
       `!atLeast(tier, opts.tier)` → 403 `forbidden` → `memberGate(orgScopeOf(ctx), sub)` (throw → log
       `{event:"member_gate_failed"}`, 503; `"deactivated"` → 403 `member_deactivated`) → handler (throw → log
       `{event:"api_unhandled", code}` where `code` is `err.code` if a string else `"error"`, as `readyz/route.ts:16-22`;
       500 `internal`).
     - Default `withAuth = createWithAuth(getAuthDeps)`; `getAuthDeps()` reads `process.env` on first call, builds
       config + verifier with the `pool.ts` log sink pattern (`console.error(JSON.stringify(entry))`, `pool.ts:6`) and
       caches on `globalThis.__simapAuth` keyed by issuer (pattern from `pool.ts:8-38`). Nothing runs at import time,
       so `next build` and SIM-004 image checks need no env or network.
     - SIM-011 plugs the real gate by editing `getAuthDeps()`; no mutable global setter.
   - `org-scope.ts`:
     - `declare const orgScopeBrand: unique symbol; export type OrgScope = { readonly orgId: string; readonly [orgScopeBrand]: true }`.
     - `orgScopeOf(ctx: AuthContext): OrgScope` is the only constructor (type-only brand, no runtime cost).
     - `orgQuery<R>(db: { query(text: string, values: unknown[]): Promise<{ rows: R[] }> }, scope: OrgScope, text: string, values: readonly unknown[] = [])`
       throws `Error("orgQuery: SQL must filter org_id = $1")` unless `/\borg_id\s*=\s*\$1\b/i` matches, then calls
       `db.query(text, [scope.orgId, ...values])`. Works with `pg.Pool` and a `PoolClient` (transactions).
       Doc comment: callers write `WHERE org_id = $1 AND …` and number their own params from `$2`; the guard is a
       heuristic, reviewers still check joins.
6. **Route + guard test**: `src/app/api/me/route.ts`, its test, `src/app/api/routes-guarded.test.ts`.
7. **`.env.example`**: append without reading (Bash `printf '%s\n' '# mmlabs Identity issuer; production must be https://api.mmlabs.online' 'MM_IDENTITY_ISSUER=' >> .env.example`), as SIM-002 did. Verify only with `git diff -U0 -- .env.example`. If the append is refused by permissions, do not work around it: record it in impl-log and Handoff as a Ming step (Decision 9).
8. **README** lines in `src/server/README.md`.
9. Run all Checks; `pnpm build` with no `MM_IDENTITY_ISSUER` in the environment.

Rules: R1 — identity/http files are `src/server/**` with `import "server-only"` first; pure code in `src/lib/**`; only
`src/app/api/**` imports `@/server/http/with-auth`; `pnpm check:layers` verifies. R3 — env read lazily, name-only in
`.env.example`, config errors never carry the value. R6 — `org` only from the verified token, `org_roles` only for
roles, `orgQuery` for every org query from SIM-007/008 on. R4 — no body-parsing helpers, no CSRF work (bearer header is
not sent cross-site automatically), no member lookup. R5 — tests listed above.

## Specialist input used
- api-platform-engineer:
  - Adopted: port almost 1:1; `verify(authorizationHeader)` input; drop `roles`/`no_role`; keep 12 h `maxTokenAge` and
    required `jti`, never require `sid`; `AuthContext {sub,email,org,tier}`; tier logic pure in `src/lib`; required
    `tier` option; forward `params` Promise; try/catch → 500 `internal`; `createWithAuth` seam with lazy default;
    `Cache-Control: no-store`, `WWW-Authenticate: Bearer`, `Retry-After: 5`; 401 body identical for every cause;
    `org` must be a UUID or 401; leave `readyz` shape alone; `/api/me` test route; gate fails closed (503);
    test scanning `route.ts` for `withAuth`; `MAX_TOKEN_CHARS` 8192; `orgQuery` prepending `$1` with an `org_id = $1`
    guard; body-parsing helpers deferred.
  - Rejected / changed: verifier returning `no_org`/`no_role` reasons — the verifier stays token-only and the guard
    maps org/tier (architect's split, easier to test); 403 codes reduced to `org_required`/`forbidden` only — kept a
    distinct `member_deactivated` (Decision 3); gate called before the tier check — called after it, so a failing tier
    check costs no DB read.
- software-architect:
  - Adopted: `jose` not yet present, pin exact version; 4096 cap too small; `roles` must not authorize, missing
    org/role is 403 while `org` without `org_roles` is 401; Web `Request` input; do not port `auth.js` / `http.js`;
    lazy config (build safety) with 503 on config error and one fixed log event; `globalThis.__simapAuth` cache;
    module layout (`src/lib/auth/tier.ts`, `src/lib/api/error.ts`, `src/lib/validate/uuid.ts`,
    `src/server/identity/{config,jwks,verify}.ts`, `src/server/http/{respond,with-auth,org-scope}.ts`); port-first
    commits; verifier has no tier/HTTP logic; branded `OrgScope` created only from the verified context; `MemberGate`
    port with always-active default, no caching, fail closed; distinct `member_deactivated`; `ent` ignored with a
    comment (D9); exact-key tier matching with negative tests; never log `err`; stale-24 h deviation recorded as a
    decision.
  - Rejected / changed: 16384 cap — chose 8192 (Decision 1); error-code names `unauthorized` / `no_org` /
    `auth_unavailable` — chose `unauthenticated` / `org_required` / `unavailable` (Decision 2); "no SQL helper" — the
    ticket and SYS-01 ask for an org-scoping helper every query uses, so `orgQuery` is added on top of the brand
    (Decision 4); `withAuth(opts, handler)` argument order — the ticket's `withAuth(handler, { tier })` order is kept;
    `export const runtime = "nodejs"` — not added (Node is the default for route handlers).

## Assumptions
**Decisions for Ming (approve the plan = accept every default):**
1. **Token size cap** (consults disagree: 8192 vs 16384). *Default: `MAX_TOKEN_CHARS = 8192`.* Why: consumers.md:457 says
   ~5 KB, so 8192 gives ~60 % headroom and a 6 KB token is tested; Node's default total request-header limit is 16 KB,
   so 16384 for the token alone could never be reached and would only hide the real limit. Alternative: 16384.
2. **Error codes** (consults disagree on names). *Default: 401 `unauthenticated`; 403 `org_required` / `forbidden` /
   `member_deactivated`; 503 `unavailable`; 500 `internal`; shape `{error:{code}}`.* Alternative (architect):
   `unauthorized` / `no_org` / `forbidden` / `member_deactivated` / `auth_unavailable`.
3. **Deactivated member answer.** *Default: distinct 403 `member_deactivated`* (UI shows a clear message and skips
   the re-mint). Alternative: generic `forbidden` (reveals less, but the client re-mints in vain).
4. **Org scoping** (consults disagree: SQL helper vs branded type). *Default: both, minimal — a type-only branded
   `OrgScope` built only from the verified context, and `orgQuery(db, scope, sql, values)` that binds the org as `$1`
   and refuses SQL without `org_id = $1`.* Alternatives: (a) brand only, repositories bind `$1` themselves; (b)
   `orgQuery` only, plain string org id.
5. **Stale JWKS window.** *Default: keep tudocuatui's 24 h stale window when refetches fail (tudocuatui D50), and add
   it to `work/decisions.md` as a simap decision at merge.* While Identity is reachable keys are refreshed every 300 s,
   which meets consumers.md item 3 ("at most 1 h"); the 24 h only applies during an Identity outage and means 503
   instead of signing everyone out. Alternative: cap at 1 h (stricter, more 503s in outages).
6. **`/api/me` in this ticket.** *Default: yes, tier `user`, returning `{sub,email,org,tier}`; SIM-007 extends it with
   the member.* Alternative: no route; manual testing waits for SIM-007.
7. **Config error at runtime.** *Default: lazy, 503 `unavailable` per request plus one log line; no crash at
   startup* (keeps `next build` and SIM-004 image checks working without env). Alternative: fail at boot.
8. **`maxTokenAge` 12 h.** *Default: keep 43200 s (equals the production TTL, D7; consumers.md item 14 allows it).*
   Risk: if Identity ever raises the TTL, older-than-12 h tokens get 401 until simap changes.
9. **`.env.example` edit.** Agents cannot read the file (deny `Read(**/.env.*)`). *Default: the implementer appends
   two lines with a shell append without reading it (SIM-002 precedent) and the reviewer checks
   `git diff -U0 -- .env.example` (added lines only).* If the append is refused, it becomes a Ming step in the
   Handoff; no workaround.
10. **Split.** *Default: no split* (see Split proposal). Alternative: SIM-005.1 port + SIM-005.2 guard.
11. **jose version.** *Default: exact `6.2.17`*, the version tudocuatui depends on (`^6.2.17`), so both apps verify the
   same way. Alternative: caret range like `pg`.

**Other non-blocking assumptions:**
- `org_roles` present without `org` is a contract violation → 401 (consumers.md:424 "`org_roles` (only with `org`)").
- An empty `org_roles` array with `org` is well-formed → 403 `forbidden` (not 401).
- `sub` and `org` must be canonical lowercase UUIDs (Identity emits lowercase; tudocuatui `identity.test.ts:215-229`
  already rejects uppercase and the nil UUID for `sub`); a non-canonical `org` is 401.
- 401/403 are not logged (avoids log floods from bad clients); only 503/500 causes log, with fixed fields.
- App-level (no-`org`) routes are not needed yet; the guard has no `{ org: false }` mode (architect Q5 default). Add it
  only when a ticket needs it.
- The deny-list gate's DB read per request lands in SIM-011 (architect finding 8); this ticket needs no DB.
- Revocation/role-change lag up to token expiry is accepted (D7).
- Hotspots: `package.json` / `pnpm-lock.yaml` may also change in SIM-004 (PLANNING, same batch) or SIM-008 — expect a
  lockfile rebase; regenerate with `pnpm install` rather than hand-merging. `.env.example` may be touched by SIM-004
  (deploy env names) and later SIM-006 (ticket line 41) — append-only, rebase by keeping both lines.
  `src/server/README.md` is shared docs; trivial conflict at most. SIM-007 and SIM-011 will edit
  `src/app/api/me/route.ts` and `src/server/http/with-auth.ts` (`getAuthDeps`) later (BACKLOG, not open).
- Follow-ups (become `debt` issues at merge, R4): JSON body helper (`readJson` with 413/415/400) for the first write
  route; optional `check:layers` rule that only `src/server/**` repositories call `orgQuery`/pool.

## Blocking questions
None.

## Split proposal
Estimated diff: ~550 lines of production code (of which ~330 are a near-verbatim port of `identity.js` + `jwks.js`) and
~900 lines of tests (mostly ported from tudocuatui), above the ~400-line guide. Recommended: **no split**. The port
alone (`config`/`jwks`/`verify`) cannot guard any route and the guard cannot be tested without it; the port is
reviewable as its own commit (Approach step 2), so the reviewer can diff it against the tudocuatui originals and spend
attention on the simap-specific commits (steps 3-6, ~250 production lines). If Ming prefers smaller PRs (Decision 10):
SIM-005.1 = steps 1-2 plus `src/lib/validate/uuid.ts` (port, aud `simap`, cap, `org`/`org_roles` claim rules);
SIM-005.2 = steps 4-8 (tier, error shape, `withAuth`, org scope, gate, `/api/me`, `.env.example`). This plan covers the
whole ticket.
