# Consult — api-platform-engineer (SIM-005, 2026-11-20)

## Findings

- tudocuatui `identity.js` and `jwks.js` port almost 1:1. The verifier's `verify(req)` returns `{ok, userId, email} | {ok:false, code, unavailable?}`. `jwks.js` has FRESH 300 s, MAX_STALE 24 h, COOLDOWN 60 s and a 64 KB cap. Its `getKey` rejects `jku`/`x5u`/`jwk`/`x5c` before any lookup and maps non-`JwksUnavailable` fetch failures to `JwksUnavailable`. JWKS fetch uses `redirect:"error"`, an AbortSignal timeout, and a lazy resolver.
- Changes needed for simap:
  - `AUDIENCE` becomes `simap`.
  - Role prefix `simap:` is replaced by org-role mapping.
  - Drop the `roles`/no_role check, since simap authorizes only from `org_roles`.
  - Add `org` and `org_roles` handling.
  - tudocuatui sets `MAX_TOKEN_CHARS` to 4096, but consumers.md says tokens run up to about 5 KB. Use 8192.
  - tudocuatui has `maxTokenAge` 43200 (12 h, D46) and requires `jti`. Keep both. consumers.md says `sid` is never required, so do not require it.
  - `tudocuatui/auth.js` is an `AUTH_MODE` wrapper and `TUDO_OWNER_SUB`. Neither applies; skip them.
- tudocuatui's verifier takes a Node `req` (`req.headers.authorization`). Next.js route handlers receive a Web `Request`. Change the input to the `Authorization` header string, or to a `Request` using `headers.get`.
- tudocuatui's error shape is `{ error: { code, ...extra } }` (`sendError`). The current simap `readyz` returns `{status:"unavailable"}` with 503. That is a health probe and is not part of the API error shape. Leave it alone.
- `src/server/db/pool.ts` has the pattern: `import "server-only"`, an injectable log sink, JSON logs with fixed fields. Follow it.
- The Identity org-denial code is 403 `org_access_denied` (consumers.md:151).
- No `src/server/http/` exists yet, so this ticket creates it.

## Recommendations

**Auth context type** (`src/server/identity/types.ts`, or `src/lib` if pure):
```ts
type Tier = "user" | "manager" | "admin";
interface AuthContext { sub: string; email: string | null; org: string; tier: Tier }
```
The AC example shows `{sub, email, org, tier:'manager'}`. Use `sub`, not `userId`. Keep `org` as the validated lowercase UUID string. Do not put `roles` or the token on the context. Tier ranking (`TIER_RANK`, `atLeast(tier, min)`) is pure, so it can live in `src/lib/tier.ts` for UI reuse.

**Verifier** (`src/server/identity/verifier.ts`):
- `createIdentityVerifier({issuer, jwks?, fetch?, now?, log?})` has `verify(authorizationHeader: string | null)` and returns:
  - `{ok:true, ctx}`
  - `{ok:false, reason: "unauthenticated" | "unavailable" | "no_org" | "no_role"}`, plus a fixed internal `code` for tests only.
- Order of checks after `jwtVerify`:
  1. `email_verified === true`.
  2. `sub` is a UUID and equals its canonical form.
  3. If `org` is present and `org_roles` is absent or not a string array, return 401. The AC lists this under 401.
  4. If `org` is absent, return 403 `org_required`.
  5. `org` must be a UUID; otherwise 401.
  6. Map `org_roles` to a tier from exactly `simap:admin`, `simap:manager` and `simap:user`.
  7. If no simap role is present, return 403.
  - `simap:member` is app-scope and must not grant a tier. Ignore unknown roles. Highest tier wins (D15).
- Missing or malformed Authorization is 401.

**Helper** (`src/server/http/with-auth.ts`):
```ts
withAuth<P>(handler: (req: Request, ctx: AuthContext, route: {params: Promise<P>}) => Promise<Response>, opts: { tier: Tier }): (req, route) => Promise<Response>
```
- Tier is required, not optional, so no route is accidentally open.
- Next 16 passes `params` as a Promise; forward it.
- The helper wraps the handler in try/catch and returns 500 `internal` with the same shape and no detail.
- Flow:
  1. Verify the token.
  2. Run the deny-list hook.
  3. Check the tier.
  4. Call the handler.
- Deny-list hook (for SIM-011): `setMemberGuard(fn: (ctx) => Promise<boolean>)` or an injected option, defaulting to allow. A denied member returns 403. Decide the hook's failure mode now: fail closed with 503 if the hook throws.
- Export a `testAuth` injection seam, such as `createWithAuth({verifier, memberGuard})`. The default `withAuth` is built from env on first use (lazy, like JWKS), so import-time and build have no env or network dependency.

**Error shape** (`src/server/http/errors.ts`): `apiError(status, code)` returns `Response.json({error:{code}}, {status, headers:{"Cache-Control":"no-store"}})`. Use `WWW-Authenticate: Bearer` on 401 and `Retry-After: 5` on 503.

| Status | Body | Cases |
|---|---|---|
| 401 | `{error:{code:"unauthenticated"}}` | All token failures. The same body for every cause, "no details" as the AC says. |
| 403 | `forbidden` (or `org_required` / `insufficient_tier`) | No org, no simap role, tier too low, member deactivated. |
| 503 | `unavailable` | JWKS down. |

Keep the 403 sub-codes few. The same code for "no org" and "no role" is safer. The client needs to tell "no org" (UI: pick an org) apart from "forbidden" (UI: re-mint, D7). Proposed default: 403 `org_required` vs 403 `forbidden`.

**Org scoping (R6)**: `src/server/http/org-scope.ts`.
- `scoped(ctx)` returns `{ orgId }`, and query helpers take it:
  `orgQuery(pool, ctx, sql, params)` forces `org_id = $1` as the first param, and callers write `WHERE org_id = $1 AND ...`.
- Narrowest default: `export function orgId(ctx: AuthContext): string`, plus `orgQuery(db, ctx, text, params)` that prepends `ctx.org` as `$1`. Document that SQL must reference `$1`.
- An unreferenced `$1` is a PG type-inference error at runtime and would fail tests. A cheap guard is to throw if `text` lacks `org_id = $1`. It is a heuristic, not a proof.
- SIM-008 and later tickets use only `orgQuery`; the raw pool stays private. Optionally restrict raw pool access via check:layers or a review rule.

**Later route usage**:
```ts
export const GET = withAuth(async (req, ctx) => Response.json(await listRooms(ctx)), { tier: "user" });
```
- Handlers must not read `Authorization` themselves.
- Add a test `/api/me` route (or a documented SIM-006 route) returning `{sub,email,org,tier}`; it must be `force-dynamic` and `no-store`.
- Body parsing helpers (`readJson` with limit and 415/413/400) can wait for the first write route. Note that as a follow-up, not scope (R4).

**Config**: `loadIdentityConfig` is portable as is. Keep the prod issuer `https://api.mmlabs.online`, the localhost allowance outside production, and messages that never carry values. Add `MM_IDENTITY_ISSUER=` to `.env.example`, name only, plus a comment. Read env lazily in the first request. A config error then becomes 503 `unavailable` plus one log line, not a crash at build time.

**Logging**: only fixed fields (`event`, `code`). Never log the token, claims, or `err.message`. Log denied-reason codes sparingly, since one 401 per bad request could flood.

**Tests** (Vitest, local ES256 key via `jose` `generateKeyPair` plus a local JWKS function): cover each AC rejection:
- wrong alg (HS256 or ES384)
- wrong `typ`
- wrong `iss`
- wrong `aud`
- expired
- unknown `kid`
- `jku`/`jwk` in header
- `email_verified` false
- non-UUID `sub`
- `org` without `org_roles`
Plus:
- no `org` returns 403
- `roles`-only simap role returns 403
- tier mapping, including multiple roles and highest wins
- 503 on JWKS failure, including a rotated key with failed refresh
- tier-too-low returns 403
- handler throw returns 500 with no leak
- port the `jwks.test.ts` cases (stale, cooldown, single-flight)

## Risks
- High path (auth); the plan gate applies.
- Fail-open mistakes: an unknown tier string mapping to `user`, or a handler not wrapped. The required `tier` option and a test that scans `src/app/api/**/route.ts` for `withAuth` (except `healthz` and `readyz`) would catch the latter. Propose that test.
- Casing or format variants of `org`/`sub` can bypass scope checks. Normalize and compare canonical forms.
- `org_roles` as a non-array should be 401 (malformed), not a crash.
- JWKS stale up to 24 h means a key revocation lags. That is accepted in tudocuatui; keep it.
- A role change lags until token expiry (D7); this is accepted.
- `server-only` import must be in every non-test file, and the layer rule applies: `src/lib` must not import `src/server`.
- The deny-list hook performs a DB query per request (SIM-011). Keep it behind the interface so this ticket needs no DB.

## Open questions (default proposed)
1. Where does the `org` validity rule come from: is the UUID format required? Default: yes, UUID or 401.
2. 403 sub-codes: `org_required` and `forbidden` only? Default: yes; a deactivated member also gets `forbidden`.
3. Add a `/api/me` test route in this ticket? Default: yes, tier `user`, as the manual-test target (listed in the test plan), and keep it as the SIM-006 contract.
4. `WWW-Authenticate` and `Retry-After` headers? Default: add `WWW-Authenticate: Bearer` on 401 and `Retry-After: 5` on 503.
5. Should `maxTokenAge` of 12 h be enforced? Default: yes, copy D46 semantics. Confirm Identity's actual lifetime in consumers.md/D7 (12 h).
6. `MAX_TOKEN_CHARS`: 8192, or should it be 6144? Default: 8192.
7. Deny-list hook failure mode: default fail closed (503) if it throws.

Paths: ticket `scratchpad\wt-SIM-005\work\tickets\SIM-005\ticket.md`; reference `scratchpad\ref-tudocuatui-main\server\{identity,jwks,http}.js`; Identity docs `D:\Projects\SAF\spaceM\projects\org-admin-api\docs\consumers.md` (lines 150-152, 422-432).
