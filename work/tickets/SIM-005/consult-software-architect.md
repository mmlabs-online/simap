# Consult — software-architect (SIM-005, 2026-11-20)

### Findings
1. **`jose` is not in `package.json` yet** (only `next` 16.4.6 and `server-only`). The plan has to add it. D2 already allows it, but it is a new runtime dependency on a High-tier PR, so pin the exact version tudocuatui uses.
2. **The tudocuatui token-size cap is too small.** `MAX_TOKEN_CHARS = 4096` in `ref-tudocuatui-main/server/identity.js:10`. `consumers.md:457` says org tokens can reach about 5 KB. Copied as-is, valid org tokens with many `org_roles` or `ent` would get 401 `too_large`.
3. **tudocuatui checks the wrong roles claim for simap.** `identity.js:132-139` authorizes from app-scope `roles` with a prefix match and returns 401 `no_role`. simap must do the opposite (`consumers.md:427-431`, spec §2): ignore `roles` for org data and use only `org_roles`. A missing org or role is **403, not 401**. Only "`org` present without `org_roles`" is 401.
4. **Its input type doesn't fit Next.js.** `verify(req: IncomingMessage)` reads `req.headers.authorization`. Next route handlers get a Web `Request`. `auth.js` (`TUDO_AUTH_MODE`, `TUDO_OWNER_SUB`) and `http.js` (Node-stream `readJson`, CSP) are tudocuatui-specific and should not be ported.
5. **Config loading at import time would break the build.** `next build` runs with `NODE_ENV=production` and evaluates route modules. If the config loads when the module is imported, the build (and the SIM-004 image start checks) would fail without `MM_IDENTITY_ISSUER`. tudocuatui avoids this by resolving JWKS lazily (`identity.js:86`).
6. **The JWKS cache is per instance.** In Next, module state can be duplicated across route bundles and reset by dev HMR. `src/server/db/pool.ts` already uses the `globalThis.__simapPool` pattern for this.
7. **The stale-key window goes past the checklist.** `jwks.js` keeps a stale key set for up to 24 h when refetches fail. `consumers.md:396` says "cache at most 1 h", but tudocuatui accepted this (its D50) so the app returns 503 rather than signing users out. simap would inherit that deviation without saying so.
8. **The deny list will need the database on every request.** SIM-011 AC "next API call refused" plus the no-cache rule (`consumers.md:413`, SIM-011 risks) mean one DB read per org request. SIM-008 provides the table, SIM-011 the data.

### Recommendations
1. **Module layout (R1, `check:layers`):**
   - `src/lib/auth/tier.ts`: pure `Tier = "user"|"manager"|"admin"`, `TIER_RANK`, `tierFromOrgRoles(roles: unknown): Tier | null` (exact keys `simap:admin|manager|user`; ignore `simap:member` and unknown keys; highest wins, D15). In lib so the UI can hide actions (SYS-01) without importing server code.
   - `src/lib/api/error.ts`: the `{ error: { code } }` shape and the code union, shared with SIM-006 `apiFetch`.
   - `src/lib/validate/uuid.ts`: replaces `user.js#toUserId`.
   - `src/server/identity/{config,jwks,verify}.ts`: a near line-for-line port. `verify(authorization: string | null)` returns `{ ok: true, claims: { sub, email, org: string | null, orgRoles: string[] | null } } | { ok: false, code, unavailable? }`. No tier logic and no HTTP here.
   - `src/server/http/{respond,with-auth,org-scope}.ts`: `withAuth`, error mapping, `OrgScope`.
2. **Port strategy.** First commit: port `jwks.test.ts` and `identity.test.ts` to TS with only mechanical changes, then make them pass. Later commits make the simap changes (aud `simap`, `org_roles`, cap). This keeps the review diff readable. Keep injectable `fetch`, `now`, `log` and `jwks`.
3. **Token cap.** Set `MAX_TOKEN_CHARS = 16384` and add a test with an ~6 KB valid token. Keep `maxTokenAge` at 43200 s: it equals the TTL, which checklist item 14 allows.
4. **Two-stage guard.**
   - **Stage 1 (authenticate):** any verification failure gives 401 `unauthorized`, with no detail and a `WWW-Authenticate: Bearer` header. JWKS failure gives 503 `auth_unavailable`.
   - **Stage 2 (authorize):** `org` is null → 403 `no_org`. No simap role, or tier below the route's → 403 `forbidden`. Deny-list hit → 403 `member_deactivated`.
   - Signature: `withAuth({ tier: "user" | "manager" | "admin" }, handler)` passes `{ sub, email, org: OrgScope, tier }` plus Next's route `ctx` (generic over params). Every response sets `Cache-Control: no-store`. Internal reason codes stay internal and appear in tests only.
5. **Singletons and config.**
   - `getAuthDeps()` builds config and verifier lazily on the first request and caches them on `globalThis.__simapAuth`, keyed by issuer.
   - A config error returns 503 `auth_unavailable` (fail closed) and logs one fixed event (`identity_config_invalid`), never the value.
   - Export `createWithAuth(deps)` for tests and `withAuth` as the default instance.
   - Route files set `export const runtime = "nodejs"` (or document that Node is the default).
6. **Org scope (R6).** Make `OrgScope` a branded type `{ readonly orgId: string }` that only `with-auth.ts` can create (unexported symbol). SIM-007/010 repositories take `scope: OrgScope` as their first parameter and bind `scope.orgId` as `$1` in `where org_id = $1`. Do not build a SQL-rewriting helper: it adds complexity for little gain. Add a unit test showing the scope comes only from the verified `org` claim.
7. **Deny-list hook.** Define a port `MemberGate = (scope: OrgScope, sub: string) => Promise<"active" | "deactivated">` in `src/server/http`. SIM-005 wires an always-`active` default. SIM-011 replaces it with a member lookup.
   - Call it on every org route after tier checks, with no caching.
   - If the gate throws (DB down), fail closed with 503.
   - SIM-007's `/api/me` may want the member row too, so let the gate return the member id later (extend in SIM-007/011, not now).
8. **Downstream tickets.**
   - SIM-006 `apiFetch` re-mints only on 401 and 403 `forbidden`/`no_org`. It does not re-mint on 403 `member_deactivated` (a re-mint can't fix it) or on 503.
   - SIM-007 `/api/me` uses `withAuth({ tier: "user" })`.
   - SIM-010 writes use `tier: "admin"`.
9. **`ent`.** Ignore it in v1 (D9) and leave a code comment saying so.

### Risks
- **High tier, fail-open bugs.** A wrong default in the tier mapping (for example matching a `simap:` prefix and so accepting `simap:member` or `simap:org:invite`) would grant access. Use exact-key matching with a negative test for each non-tier key.
- **Missed guard.** A route handler that skips `withAuth` is unguarded. Add a cheap check (a test or a `check-layers` extension) that every `src/app/api/**/route.ts` except `healthz`/`readyz` imports `withAuth`. Proposed as a follow-up if it is out of scope.
- **Rotated keys during an Identity outage.** These give 503 rather than 401, as intended (`jwks.js:150`). The UI must not sign users out on 503.
- **Logging.** jose errors carry claim values in `err.message`. Never log `err`; log only mapped codes.

### Open questions (each with a proposed default)
1. **Token cap:** 16384 chars? *Default: yes.*
2. **Stale-JWKS window:** keep tudocuatui's 24 h (deviation from "1 h") or cut it to 1 h? *Default: keep 24 h, recorded as a simap decision.*
3. **Deactivated-member answer:** distinct 403 `member_deactivated`, or the generic `forbidden`? *Default: distinct code, so the UI can show a clear message and skip the re-mint.*
4. **Missing or invalid `MM_IDENTITY_ISSUER` at runtime:** 503 per request, or crash at startup? *Default: 503, lazy (keeps build and image checks working).*
5. **App-level routes (token without `org`):** does SIM-005 need `withAuth({ org: false })`? *Default: no. The org list comes from Identity directly (AUT-06); add it only if a ticket needs it.*

Files: `scratchpad\ref-tudocuatui-main\server\identity.js`, `...\ref-tudocuatui-main\server\jwks.js`, `...\wt-SIM-005\src\server\db\pool.ts`, `...\wt-SIM-005\scripts\check-layers.mjs`, `D:\Projects\SAF\spaceM\projects\org-admin-api\docs\consumers.md` (lines 391-457).
