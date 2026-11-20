# Security review — SIM-005

## Attempt 1

## Security audit: SIM-005, attempt 1 (security-ai-generated-code-auditor)

**Scope:** `git diff origin/main...HEAD` on `ticket/SIM-005`, 7 commits (dc17b40, 42865bc and others). I read the full non-test source: `src/server/identity/{verify,jwks,config}.ts`, `src/server/http/{with-auth,org-scope,respond}.ts`, `src/lib/auth/tier.ts`, `src/lib/api/error.ts`, `src/lib/validate/uuid.ts`, `src/app/api/me/route.ts` and `src/app/api/routes-guarded.test.ts`. I checked it against `plan.md` and the "Verifying (backend) checklist" in org-admin-api `docs/consumers.md`.
**Not checked:**
- `.env.example`: blocked by the deny rule, as intended.
- Test bodies beyond the guard test.
- `pnpm-lock.yaml`.
- I ran no checks; this audit is read-only.

**Verdict: 0 🔴, 2 🟡, 5 💭.** I found no blocker. The verification core is correct and fails closed.

### Verified as correct (no finding)
- **Algorithm pinning:** `algorithms: ["ES256"]` (verify.ts:123). The JWKS filter keeps only EC P-256 keys with `use` sig/absent and `alg` ES256/absent (jwks.ts:15-21).
- **Claims:**
  - `typ: "at+jwt"`, exact `issuer`, `audience: "simap"`.
  - `aud` must be a string; a list is rejected (verify.ts:132).
  - `requiredClaims` exp/iat/sub/jti/iss/aud.
  - `clockTolerance` 30 s (consumers.md item 5).
  - `maxTokenAge` 12 h, equal to the TTL (item 14).
  - `email_verified === true` strictly; `jti` must be a non-empty string.
- **Key in the token header:** `jku`/`x5u`/`jwk`/`x5c` are rejected before any key lookup (verify.ts:93). Keys come only from the configured JWKS URL.
- **SSRF:** the JWKS URL comes only from `MM_IDENTITY_ISSUER`. In production it must equal `https://api.mmlabs.online` exactly (config.ts:50); nothing comes from the token or the request. Other fetch protections:
  - `redirect: "error"`
  - a 5 s timeout
  - a 64 KB cap, checked on both the declared length and the streamed bytes
  - strict UTF-8 decoding
  - a `User-Agent` header (item 10)
- **Cache:**
  - Refetch on an unknown `kid` is limited to once per 60 s (item 3).
  - Concurrent refreshes share one fetch.
  - A bad response keeps the last good set.
  - A rotated key during an outage gives 503, not 401.
- **Fail-closed paths:**
  - Bad config gives 503.
  - JWKS unavailable gives 503.
  - Every other verify failure gives the same 401 body.
  - `org` absent gives 403 `org_required`.
  - Tier mapping uses exact keys via `Object.hasOwn`, so `__proto__` or `constructor` grant nothing.
  - No simap role gives 403.
  - A member-gate throw gives 503.
  - A handler throw gives 500.
  - An outer catch around everything gives 500.
- **Org access (R6):**
  - Access comes only from `org` plus `org_roles`; the token's `roles` claim is never read.
  - `org` without `org_roles` is rejected, and so is `org_roles` without `org`.
  - `org` and `sub` must be canonical UUIDs.
- **What leaves the server:**
  - Error bodies are `{error:{code}}` only, with `Cache-Control: no-store`.
  - Logs carry fixed fields only. They never include the token, claims, URL or `err.message`.
  - No secrets appear in the code, and there are no `NEXT_PUBLIC_` variables.

### Findings

1. 🟡 **`orgScopeOf` accepts any `{org}`, so the "branded" scope can be forged.** Fingerprint: SIM005-orgscope-forgeable.
   - **Where:** `src/server/http/org-scope.ts:9-11`, and the comment at line 6.
   - **Risk:**
     - The signature is `orgScopeOf(ctx: Pick<AuthContext, "org">)`. Any future handler can write `orgScopeOf({ org: body.orgId })` and it type-checks.
     - That would be cross-tenant data access (CWE-639/863).
     - The comment ("Only `orgScopeOf` creates one, so an org id cannot come from a request body or URL") and `src/server/README.md` promise a guarantee the code does not enforce, so reviewers will rely on it.
     - The approved plan specified `orgScopeOf(ctx: AuthContext)` (plan.md:209); the implementation narrowed it to `Pick`.
   - **Fix (one commit):**
     - Have `withAuth` build the scope once.
     - Add it to the context as `ctx.scope: OrgScope`, or pass it as a handler argument.
     - Stop exporting `orgScopeOf`, or keep it module-private.
     - If an exported constructor must stay, accept only an `AuthContext` that `withAuth` created. A module-private `WeakSet<AuthContext>` checked at runtime enforces this.
     - Update the comment and the README to match.

2. 🟡 **The test that every route is guarded is a regex and is easy to bypass.** Fingerprint: SIM005-guard-test-regex.
   - **Where:** `src/app/api/routes-guarded.test.ts:29-33`.
   - **Risk:** The test is the only automated proof that every new `/api/*` route is authenticated. It misses:
     - `export { handler as GET }`
     - `export const GET =` with `withAuth(` on the next line
     - an exported `HEAD` or `OPTIONS`
     - a file that imports `withAuth` but exports an unwrapped helper under another method name

     Any of these would ship an unauthenticated route with green CI (CWE-306).
   - **Fix:**
     - Import each `route.ts` module in the test.
     - For every exported HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS), assert that the function carries a marker set by `withAuth`. For example, `withAuth` can return a function with a non-enumerable `Symbol.for("simap.withAuth")` property.
     - Alternatively, extend the regex to match across lines and to catch `export {` forms and `HEAD`/`OPTIONS`, and fail on any of them.

3. 💭 **The stale JWKS window (24 h) is longer than consumers.md item 3 allows ("at most 1 h").**
   - **Where:** `src/server/identity/jwks.ts:10`, 141.
   - **Risk:**
     - If Identity removes a compromised key and an attacker can also block simap's refreshes (DNS, network), simap trusts the removed key for up to 24 h.
     - This is unlikely, and it is a recorded decision (plan Decision 5, to go into `work/decisions.md` at merge).
   - **Fix:** None needed now. Make sure the decision entry is actually written at merge and states this trade-off.

4. 💭 **Spamming unknown `kid`s uses up the refetch cooldown.**
   - **Where:** `src/server/identity/jwks.ts:146`.
   - **Risk:**
     - An attacker sends tokens with random `kid`s. Each one triggers a successful refetch, so `failed` stays false and the 60 s cooldown restarts.
     - If Identity starts signing with a new `kid` in that window, legitimate users get 401 for up to 60 s and the client signs out. This is minor and depends on Identity starting to sign with a key before publishing it.
   - **Fix:** None required. Optionally answer 503 instead of 401 when an unknown `kid` arrives within the cooldown after a successful refresh, or confirm that Identity publishes keys before signing with them.

5. 💭 **A JWKS outage writes one log line per request.**
   - **Where:** `src/server/http/with-auth.ts:43`.
   - **Risk:** During an outage every request logs `{event:"jwks_unavailable"}`, which can flood the logs. No data leaks.
   - **Fix:** Optional. Rate-limit the log, for example once per 60 s, the same way `identity_config_invalid` is logged only once.

6. 💭 **The `org_id = $1` check in `orgQuery` is text-only.**
   - **Where:** `src/server/http/org-scope.ts:22`.
   - **Risk:** It accepts SQL where the condition sits only in a comment, inside an `OR`, or in only one branch of a join. The code says this is a heuristic.
   - **Fix:** None for this ticket. Reviewers for SIM-008/011 should check the joins on every org query.

7. 💭 **The member gate allows everyone until SIM-011.**
   - **Where:** `src/server/http/with-auth.ts:19`, 88.
   - **Risk:** A member deactivated in simap keeps access until their token expires (up to 12 h, consumers.md item 11). This is planned: the hook exists and fails closed.
   - **Fix:** Track it in SIM-011. If a debt issue does not already cover it, link one.

### Follow-ups (out of scope)
- When SIM-011 adds the real member gate, check that it reads by `orgScopeOf(ctx)` and `sub`, and that a DB error still gives 503 (closed), never "active".
- When SIM-008 adds the org tables, confirm `org_id uuid not null` and that indexes lead with `org_id`, which `orgQuery` assumes.

I report no compliance percentage. This audit covers only the code-level checks listed above.
