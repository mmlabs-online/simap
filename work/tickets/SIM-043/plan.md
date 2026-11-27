Status: READY

# Plan — SIM-043: Let an app-wide simap admin access every org (slice 1: server grant, audit, /api/me, docs)

## Scope summary
The ticket text predates D86. Where they differ, D86 wins: the role key is `simap:super-admin` (not
`simap:superadmin` / `admin:super-admin`), and the grant also needs `org_access`.

- `work/decisions.md` D75 (2026-11-26): "an account holding the Identity app-scope role … gets full Admin access (read
  and CRUD) in every org, without being a member of it. Supersedes, for that role only, spec §2 "org data is never
  authorized from `roles`", AUT-02 (403 without a simap org role) and the "roles come only from `org_roles`" part of
  R6; org scope still comes only from the verified `org` claim. … Member row on first visit and audit shape are planner
  assumptions for Ming at the plan gate (proposed: no member row / not listed; every write audited with a cross-org
  marker)."
- `work/decisions.md` D86 (2026-11-27, amends D75): "the app-scope role in `roles` is `simap:super-admin` …; keep the
  key configurable. simap grants full Admin in an org only when the token verifies, `org` is present,
  `org_access == "super_admin"` exactly and `roles` contains that key; `org_roles` is `[]` on such tokens. `GET
  /auth/orgs` items carry `access: "member" | "super_admin"` (unknown values = not openable); … handle 429
  `rate_limited` (30 super-admin mints per account per hour). Tokens last up to 3600 s (no `sid`). Identity audits every
  such mint (`token.super_admin_org_issued`)."
- Ticket Scope bullets 1–4 and all six acceptance criteria. Scope bullet 5 (org picker) and the D86 429 handling go to
  slice 2 (see `## Split proposal`).
- Text this ticket replaces: spec §2 *Roles* (`docs/spec-v1.md:53-57`), §2 Organizations Super Admin bullet (`:43-44`),
  AUT-02 (`:178-184`), AUT-04 (`:199`), `CLAUDE.md:38` R6.

**The grant rule this plan implements (exact):**
- Super-admin path, taken only when `org_access === "super_admin"`. It gives tier `admin` with `access: "super_admin"`
  only if all of these hold:
  - `org` is present (checked earlier, so `org_required` is unchanged);
  - the role key is configured;
  - `roles` contains the key, compared with `===` (no trimming, no case folding, no prefix match);
  - `org_roles` is empty;
  - `exp - iat <= 3600`.

  If any of them fails, the result is `null` and the caller gets 403 `forbidden`. The super-admin path never falls back
  to the member path.
- Member path, taken for any other `org_access` value (absent, `"member"`, anything else). It works as today:
  `tierFromOrgRoles(orgRoles)` with `access: "member"`, and `roles` is ignored.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A token with `org` = X, the app-wide role in `roles` (and `org_access: "super_admin"`, D86), and no simap role in `org_roles` gets the admin tier in org X | `with-auth.test.ts` › "super admin (D86 claims) reaches an admin route with tier admin, access super_admin"; `tier.test.ts` › "accessFromToken grants admin on the exact D86 condition"; `verify.test.ts` › "org present: roles and org_access are returned normalized". `pnpm test` green. |
| 2 | Any other value in `roles` (`simap:member`, app-scope `simap:admin`, near-miss keys) grants nothing: same token gets 403 `forbidden` | `tier.test.ts` › "near-miss keys and partial D86 claims grant nothing" (the list is under Tests); `with-auth.test.ts` › "near-miss role / org_access member / role unset in config -> 403 forbidden"; the existing test "simap:admin only in roles -> 403 forbidden" (`with-auth.test.ts:178`) stays green. |
| 3 | The app-wide role never widens scope: `ctx.scope` comes from the verified `org`; no `org` gives 403 `org_required` | `with-auth.test.ts` › "super admin: ctx.scope is {orgId: org}, frozen, same object given to gate and audit"; › "super-admin claims without org -> 403 org_required". Code read: no handler branches on `ctx.access` to pick a scope (grep `ctx.access` shows only `src/app/api/me/route.ts`). |
| 4 | A request authorized only by the app-wide role writes an audit row in org X naming the actor `sub` and marking the cross-org access | `with-auth.test.ts` › "super admin write (POST/PUT/PATCH/DELETE) calls accessAudit once before the handler with scope, sub, {method, route}"; › "super admin GET/HEAD: no access audit"; › "member token write: no access audit"; › "accessAudit throws -> 503 unavailable, handler not called, log {event:'access_audit_failed'}". `audit/access.test.ts` › "writes action access.super_admin, entity org, entityId org, meta {method, route}". Row shape: under API contract. |
| 5 | Member gate and `/api/me` for a super admin with no `members` row behave as decided (default: no row, not listed); a deactivated row still gives 403 `member_deactivated` | `me/route.test.ts` › "super admin without row: GET returns member null + access super_admin, never calls getOrCreateMember"; › "super admin with an existing row: GET returns that row, no create"; › "super admin without row: PATCH -> 422 no_linked_member, setOwnDisplayName not called"; › "member token: GET still calls getOrCreateMember (first visit unchanged)". `with-auth.test.ts` › "super admin with a deactivated row -> 403 member_deactivated, no access audit, handler not called". |
| 6 | Spec §2, AUT-02, AUT-04 and `CLAUDE.md` R6 match the new decision | Diff read: `docs/spec-v1.md` §2 Roles + Organizations bullet, AUT-02, AUT-04 and the change-log row; `CLAUDE.md` R6; `.env.example` lists `SIMAP_SUPER_ADMIN_ROLE`. The wording names D75/D86, the key `simap:super-admin`, the `org_access` condition, "no member row", and the audit row. |

## Ming verification after merge
These need the real Identity, which is only possible after M-90 (org-admin-api deployed, staff test account set up):
- With `SIMAP_SUPER_ADMIN_ROLE=simap:super-admin` set in the deploy env, a staff account that is not a member of
  org X picks X and can open rooms and seats and create, edit and delete a room.
- The Audit page of X shows one "Support access" row per write, naming the staff `sub` (Who: "Unknown member").
- The staff account does not appear in X's Members list, the seat-assignment member picker, or the dashboard
  counts.
- With the env unset, the same account gets "no permission" (403 `forbidden`), which proves the kill switch.
- Invitations from simap as a super admin (`/api/invitations`, which uses the Identity cookie): check whether Identity
  accepts them (see Assumption Q9).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/identity/verify.ts` | Change the stale comment at :140. When `org` is present (after :150), also return `appRoles` (`roles`: a string array, else `[]`; absent is `[]`), `orgAccess` (a string, else `null`) and `lifetimeS` (`payload.exp - payload.iat`). A bad `roles` or `org_access` shape never fails the token; it only removes the grant. `VerifiedIdentity` gains the optional fields `appRoles?: readonly string[]`, `orgAccess?: string \| null` and `lifetimeS?: number`. They are optional so the ~25 route tests that build `identity: {sub,email,org,orgRoles}` stay valid, and absent fields mean no grant. The no-`org` branch (:143-146) is unchanged. | AC1, AC2 (claims parsed, fail closed) | **Yes** (`src/server/identity/**`) |
| `src/server/identity/verify.test.ts` | Update the happy-path `toEqual` (:100) and the "roles claim is never read" test (:275). Add the new tests listed under Tests. | AC1, AC2 | **Yes** |
| `src/server/identity/config.ts` | New `loadSuperAdminRole(env): string \| null`. An unset or empty `SIMAP_SUPER_ADMIN_ROLE` gives `null` (feature off). The value must match `^simap:[a-z][a-z0-9-]{0,62}$` and must not be `simap:admin`, `simap:manager`, `simap:user` or `simap:member`; otherwise it throws `IdentityConfigError` (the message never carries the value). It is a separate function so the `loadIdentityConfig` `toEqual` test (`config.test.ts:12`) is unaffected. | D86 "keep the key configurable", R3 | **Yes** (`**/config.*`, `src/server/identity/**`) |
| `src/server/identity/config.test.ts` | Tests for `loadSuperAdminRole`. | R5 | **Yes** |
| `src/lib/auth/tier.ts` | New pure `accessFromToken(input, superAdminKey): {tier, via: "member" \| "super_admin"} \| null`, implementing the grant rule in Scope summary, plus the exported `SUPER_ADMIN_MAX_TTL_S = 3600`. `tierFromOrgRoles` is unchanged. | AC1, AC2, rule 6 (pure logic first) | No (treat as High in review: it is now part of the authorization decision) |
| `src/lib/auth/tier.test.ts` | `accessFromToken` tests. | AC1, AC2 | No |
| `src/lib/audit/route.ts` (new) | Pure `auditRoute(pathname): string`. It keeps segments that match `^[a-z][a-z0-9-]{0,40}$`, replaces every other segment with `:id`, and caps the result at 200 chars. No query string ever. | AC4 (meta holds codes only, SYS-03) | No |
| `src/lib/audit/route.test.ts` (new) | `auditRoute` tests. | AC4 | No |
| `src/server/http/with-auth.ts` | `AuthContext` gains `access: "member" \| "super_admin"`. `AuthDeps` gains the optional `superAdminRole?: string \| null` (absent = off, so existing route-test deps stay valid) and `accessAudit?: AccessAudit`. :67-71 uses `accessFromToken`. After the member gate and before the handler: when `access === "super_admin"` and the method is not GET/HEAD/OPTIONS, call `d.accessAudit` (a missing dep or a throw gives 503 `unavailable` plus log `{event:"access_audit_failed"}`, and the handler is not called). `getAuthDeps` (:102-120) wires `superAdminRole: loadSuperAdminRole(process.env)` and `accessAudit: writeAccessAudit`. The cache key stays `issuer`, because env is fixed per process. | AC1–AC5 | **Yes** (`src/server/http/**`) |
| `src/server/http/with-auth.test.ts` | `okResult` gains an optional `over` for the new claims. `setup` takes `{superAdminRole, accessAudit}`. Update the ctx `toEqual` at :92 (adds `access: "member"`). Add the new tests. Extend "default deps wire the DB member gate" (:245) to also check `accessAudit`. | AC1–AC5 | **Yes** |
| `src/server/audit/access.ts` (new) | `import "server-only"`. `writeAccessAudit(scope, sub, meta)`: `getPool()` (null throws `db_unavailable`), then one `writeAudit(pool, scope, {actorSub: sub, action: "access.super_admin", entity: "org", entityId: scope.orgId, meta})`. Exports the type `AccessAudit`. | AC4 | No |
| `src/server/audit/access.test.ts` (new) | Fake pool: checks the SQL values and the pool-null throw. | AC4 | No |
| `src/server/members/members.ts` | New exported `getMember(db, scope, sub): Promise<MeMemberDto \| null>` (reuses `find`/`toDto`, never inserts). `ensure` and `getOrCreateMember` are unchanged. | AC5 | No |
| `src/app/api/me/route.ts` | `body()` adds `access: ctx.access`. GET: if `ctx.access === "super_admin"`, return `getMember(...)` (row or `null`) and skip `getOrCreateMember`. PATCH: if `ctx.access === "super_admin"` and `getMember` is null, return 422 `no_linked_member`; otherwise the path is unchanged. | AC5 (no row, not listed) | No |
| `src/app/api/me/route.test.ts` | `fakeAuth` accepts the super-admin identity and `superAdminRole`. Add the new tests. | AC5 | No |
| `src/ui/copy/audit.ts` | `actions["access.super_admin"] = "Support access (mmlabs)"`. | AC4 (readable row), D36 | No |
| `.env.example` | Add `SIMAP_SUPER_ADMIN_ROLE=` with the comment "App-scope Identity role for mmlabs super admins (D86); unset = feature off". Name only. | R3 | **Yes** (`.env.example`) |
| `docs/spec-v1.md` | §2 Organizations bullet (:43-44), §2 Roles (:53-57), AUT-02 (:178-184), AUT-04 (:199), change-log row. Wording is under Approach step 7. | AC6 | No |
| `CLAUDE.md` | R6 (:38): "roles come only from `org_roles`, except the D86 super-admin grant (`org_access == "super_admin"` + configured role in `roles`), which gives Admin in the token's `org` only". | AC6 | No |

The implementer must not touch any other file. `src/server/members/gate.ts` needs no change: a missing row already
counts as `active` (`gate.ts:22`), and a `deactivated` row blocks.

## Data model / migration
None. `audit_log` already accepts any `action` and `entity` text and `entity_id` uuid, and `actor_sub` has no foreign
key (consult-software-architect Finding 7). No `members` row is created for super admins.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| any | `/api/*` (all `withAuth` routes) | Bearer token. Super-admin tokens carry `org`, `org_roles: []`, `org_access: "super_admin"`, `roles` ∋ key | Unchanged | 401 `unauthenticated` (verify fails) · 403 `org_required` (no `org`) · 403 `forbidden` (no tier, failed super-admin condition, or tier below the route's tier) · 403 `member_deactivated` (row deactivated) · 503 `unavailable` (config invalid, JWKS down, gate or access audit failed). All are returned before the handler and before any domain write (R7). | Route tier. A super admin is `admin`. |
| GET | `/api/me` | — | `{sub, email, org, tier, access: "member" \| "super_admin", member: MeMemberDto \| null}`. `member` is `null` only for a super admin with no row. | 200, the auth codes above | user |
| PATCH | `/api/me` | `{displayName}` (unchanged) | As GET | 400 `invalid_request` · 422 `no_linked_member` (super admin with no row; domain refusal, R7) · the auth codes | user |

Access audit row, one per non-GET/HEAD/OPTIONS request authorized through the super-admin path, written before the
handler runs:

```
org_id = token org, actor_sub = token sub, action = "access.super_admin", entity = "org", entity_id = token org,
meta = { "method": "POST", "route": "/api/rooms/:id" }
```

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/auth/tier.test.ts` › "accessFromToken grants admin on the exact D86 condition (org_access super_admin, key in roles, org_roles [], lifetime <= 3600)" | AC1 |
| `tier.test.ts` › "near-miss keys and partial D86 claims grant nothing". It returns null for each of: roles `simap:member`, `simap:admin`, `admin:super-admin`, `simap:super-admin ` (trailing space), `SIMAP:super-admin`, `simap:Super-Admin`, `simap:super-admin-x`, `simap:super`. It also returns null for: the right key with `org_access` `"member"` / `"Super_Admin"` / `" super_admin"` / null; `org_access: "super_admin"` without the key; the key is `null` (feature off); `lifetimeS` 3601 or undefined; `org_roles` non-empty under `org_access: "super_admin"`. | AC2 |
| `tier.test.ts` › "member path unchanged: org_access absent/member uses tierFromOrgRoles and ignores roles (key in roles + org_roles [] -> null; simap:user -> user, access member)" | AC2, out-of-scope guard |
| `tier.test.ts` › "roles with __proto__ / constructor entries or a 1,000-entry list never throw" | AC2 robustness |
| `src/server/identity/verify.test.ts` › "org present: roles and org_access are returned normalized (appRoles, orgAccess, lifetimeS = exp - iat)" | AC1 |
| `verify.test.ts` › "roles not an array, or with a non-string item -> token ok, appRoles []; org_access number/object -> orgAccess null" | AC2 (fails closed on the grant only) |
| `verify.test.ts` › "roles and org_access without org -> org null, no appRoles/orgAccess (unchanged no-org branch)" (replaces :275) | AC3 |
| `verify.test.ts` › "org with org_roles [] and super-admin claims verifies; org without org_roles still org_roles_missing" | AC1, unchanged rules |
| `src/server/identity/config.test.ts` › "loadSuperAdminRole: unset/empty -> null; simap:super-admin -> value; simap:admin/manager/user/member, uppercase, spaces, admin:super-admin, 'simap:' -> throws, message without the value" | D86 configurable key, R3 |
| `src/server/http/with-auth.test.ts` › "super admin (D86 claims) reaches an admin route with tier admin, access super_admin" | AC1 |
| `with-auth.test.ts` › "near-miss role / org_access member / role unset in config -> 403 forbidden, handler and gate not called" | AC2 |
| `with-auth.test.ts` › "super-admin claims without org -> 403 org_required" | AC3 |
| `with-auth.test.ts` › "super admin: ctx.scope is {orgId: org}, frozen, same object given to gate and audit" | AC3 |
| `with-auth.test.ts` › "super admin write (POST/PUT/PATCH/DELETE) calls accessAudit once before the handler with scope, sub, {method, route}" | AC4 |
| `with-auth.test.ts` › "super admin GET/HEAD: no access audit; member token write: no access audit" | AC4 (no noise) |
| `with-auth.test.ts` › "accessAudit throws or is missing -> 503 unavailable, handler not called, log {event:'access_audit_failed'} without sub/org" | AC4 fail closed |
| `with-auth.test.ts` › "super admin with a deactivated row -> 403 member_deactivated, no access audit, handler not called" | AC5 |
| `with-auth.test.ts` › extend "logs never contain the token, sub, email or org" (:298) with a super-admin write whose audit fails | R3, SYS-03 |
| `src/lib/audit/route.test.ts` › "uuid and other non-word segments -> :id; query never included; Vietnamese/percent-encoded segment -> :id; capped at 200" | AC4 meta shape |
| `src/server/audit/access.test.ts` › "writes action access.super_admin, entity org, entityId org, meta {method, route}; pool null -> throws" | AC4 |
| `src/app/api/me/route.test.ts` › "super admin without row: GET returns member null + access super_admin, never calls getOrCreateMember" | AC5 |
| `me/route.test.ts` › "super admin with an existing row: GET returns that row, no create" | AC5 |
| `me/route.test.ts` › "super admin without row: PATCH -> 422 no_linked_member, setOwnDisplayName not called" | AC5 |
| `me/route.test.ts` › "member token: GET calls getOrCreateMember and returns access member (first visit unchanged)" | out-of-scope guard |

`pnpm test:db` needs no new DB test. `getMember` is a read through the existing `find`. If the implementer wants one,
it may go in the existing members DB test file, recorded in impl-log.

## Approach
1. **Pure policy** (rule 6): add `accessFromToken` and `SUPER_ADMIN_MAX_TTL_S` to `src/lib/auth/tier.ts`, and
   `auditRoute` to `src/lib/audit/route.ts`, test first. Use `Array.prototype.includes` with a string key for the
   role check. Never use object lookup on role strings (the `__proto__` test guards this).
2. **Claims** in `verify.ts` (High): read `roles` and `org_access` only in the `org`-present branch, after the
   `org_roles` checks. No new `VerifyCode`, because shape errors only remove the grant. Keep the file free of tier
   logic, as its header promises.
3. **Config** in `config.ts` (High): `loadSuperAdminRole`. An invalid value is a config error, so `withAuth` answers
   503 and logs `identity_config_invalid` once, the same as a bad issuer. Unset means off.
4. **withAuth** (High): the order is: verify → `org_required` → `accessFromToken` + tier check (`forbidden`) → freeze
   ctx (adding `access`) → member gate (`member_deactivated`) → access audit for super-admin writes → handler. Every
   401/403 comes before any side effect (R7). The access audit row is the only side effect before the handler, and
   nothing after it returns 401/403 from the wrapper. The scope is still built only by `scopeFor(org)` (R6, AC3).
5. **Audit writer**: `src/server/audit/access.ts`, a single insert through `writeAudit` and `orgQuery`, scoped by
   `ctx.scope` (R6). Meta holds only `method` and `route` (SYS-03). It never holds the role, token, body or query.
6. **/api/me**: add `getMember`, and branch on `ctx.access` in the route. The UI already handles `member: null`.
   `viewForMe` gives `ready` (`src/lib/identity/flow.ts:69-77`), and `my-seats.ts` returns not-ok (covered by
   `my-seats.test.ts:92`). So no UI change is needed for access. `PATCH` refuses with 422 `no_linked_member`, the
   existing self-route code for a missing row.
7. **Docs** (AC6):
   - spec §2 Roles: add a bullet saying that, by D75/D86, a token with `org_access == "super_admin"` and the configured
     app-scope role (`simap:super-admin`) in `roles` gets Admin in the token's `org` only. Such an account has no member
     row, is not listed, every write is audited as `access.super_admin`, and the feature is off when
     `SIMAP_SUPER_ADMIN_ROLE` is unset.
   - spec §2 Roles, existing text: qualify "org data is never authorized from `roles`" with "except the D86 grant".
   - spec §2 Organizations bullet: Super Admin can also open any org in simap (D75).
   - AUT-02: tier from `org_roles` or the D86 grant. Add "403 … unless the D86 super-admin condition holds".
   - AUT-04: "the highest simap role in `org_roles`, or Admin via D86".
   - spec change log: add a row.
   - `CLAUDE.md` R6: the wording in the files table.
   - `.env.example`: the new name.
8. Run all Checks (`pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`). R1 holds:
   the new lib files import nothing from server, `access.ts` starts with `import "server-only"`, and the route uses
   only api → server/lib.

Size estimate: about 230 changed product and doc lines plus about 300 test lines. It is one cohesive High-path review.

## Specialist input used
- consult-api-platform-engineer:
  - **Adopted**: F1/F2/F3, which require all four D86 conditions in one place in `withAuth`, keep the order and leave
    the verifier otherwise unchanged.
  - **Adopted**: a bad `roles` shape denies the grant and does not reject the token.
  - **Adopted**: the configurable key comes from env and is listed in `.env.example`.
  - **Adopted**: the full list of near-miss tests.
  - **Adopted**: F5, the gate already blocks a deactivated row.
  - **Adopted**: F6 and the no-row virtual member, with no insert from `/api/me`.
  - **Adopted**: meta holds codes only.
  - **Adopted**: docs list for AC6.
  - **Rejected**: the default `simap:super-admin` when the env is unset. I chose the architect's opt-in kill switch;
    see Q1.
  - **Rejected**: the per-write `viaSuperAdmin` flag threaded into `writeAudit` (option a). There are 62 call sites in
    20 files, and a missed call site loses the marker silently.
  - **Rejected**: the structured `d.log` line for reads, because withAuth's log test forbids `sub` and `org` in logs,
    and Identity already audits each mint.
  - **Rejected**: "member with the role is raised to admin". D86 has Identity choose `org_access` per mint, so a member
    token never uses `roles` (Q5).
  - **Deferred to slice 2**: picker `access` and the 429 retry handling.
- consult-software-architect:
  - **Adopted**: Rec 1, claims stay in verify and policy goes in a pure lib `accessFromToken` that never falls back
    between paths.
  - **Adopted**: Rec 2, opt-in env with strict validation that rejects membership keys, where an invalid value gives
    503.
  - **Adopted**: Rec 3, `ctx.access` while the scope still comes from `scopeFor(org)`.
  - **Adopted**: Rec 4, a lifetime above 3600 s denies the grant with 403.
  - **Adopted**: Rec 5, Option A: one `access.super_admin` row per write, in `withAuth`, failing closed with 503, and no
    read audit.
  - **Adopted**: Rec 6, no row, `member: null`, and PATCH refused. I use the existing `no_linked_member` code instead of
    `not_allowed`, because it is the established code for "no member row" on self routes.
  - **Adopted**: Rec 9, the docs.
  - **Adopted**: treat `tier.ts` as High in review.
  - **Rejected for now**: Option B, marking every action row, which is larger than M (Q2).
  - **Rejected**: an "mmlabs support" display name in the audit list. The action label carries the marker, and Who
    shows "Unknown member" as for any actor with no row.
  - **Deferred to slice 2**: Rec 7 (picker) and Rec 8 (429 / Retry-After).

## Assumptions
These are the questions for Ming at the plan gate. The plan already applies each default; tell me any you want
changed.
1. **Q1 Role-key env unset**: the feature is off (kill switch). Ming sets `SIMAP_SUPER_ADMIN_ROLE=simap:super-admin` in
   the deploy env as part of M-90. The orchestrator should add this to `work/ming-todo.md`. The alternative is to
   default to `simap:super-admin`.
2. **Q2 Audit shape**: Option A. One `access.super_admin` row (entity `org`, meta `{method, route}`) is written per
   non-GET request, before the handler. If that write fails, the request gets 503. Reads are not audited in simap,
   because Identity audits each mint, which records "entered org X for up to 1 h". The row records an attempt even if
   the handler then refuses. Marking every domain action row (Option B, 62 call sites) would be a follow-up.
3. **Q3 Member row**: none. A super admin is not listed, cannot be assigned seats, and is not counted on the dashboard.
   `GET /api/me` returns `member: null` (or their existing row if they were once a member). `PATCH /api/me` returns
   422 `no_linked_member`.
4. **Q4 Deactivated row**: blocks the super admin (403 `member_deactivated`), as AC5 says. This means an org admin can
   lock mmlabs support out by deactivating a former-member row of the staff account.
5. **Q5 Mixed tokens**: simap follows `org_access`. A `"member"` (or absent) token never gets elevated by `roles`. A
   `"super_admin"` token with non-empty `org_roles` breaks the D86 contract and gets 403 (fail closed). A staff
   account that is also a member gets whatever Identity mints for that org.
6. **Q6 Token lifetime**: a super-admin token with `exp - iat > 3600` gets 403 `forbidden`, not 401, to avoid a
   re-mint and sign-out loop. Revocation is by expiry only (up to 1 h, no `sid`, and no gate row for a non-member).
7. **Q7 Read-only default**: none. D75 grants full CRUD, so this stays closed unless Ming reopens it.
8. **Q8 Slice 2 defaults** (picker and 429, see Split proposal):
   - a missing `access` means `member` (old Identity);
   - unknown values are dropped as not openable, and are excluded from the "non-empty list, zero parsed" check;
   - `super_admin` orgs get a "Support access" badge;
   - a 429 `rate_limited` on background renewal re-arms at `max(RETRY_MS, Retry-After)`.
9. **Q9 Identity-backed admin actions**: invitations and other actions that use the browser cookie against Identity
   may be refused for super admins. That is org-admin-api's call, it is out of scope here, and it is listed under Ming
   verification.
10. **Q10 Personal tabs for a super admin with no row**: My seats is empty, and the Profile tab shows its load-failed
    state (`ProfileTab.tsx:44-51`). A polished message or hiding the tabs is a follow-up.
11. The ticket text (Scope bullet 1 `simap:superadmin`, Notes line 73 `admin:super-admin`, AC1 without `org_access`)
    is stale against D86. This plan follows D86. The orchestrator should fix the ticket wording; I write only
    plan.md.
12. `apiFetch` re-sends at most once on 401/403 (`src/lib/api/fetch.ts`, consult-architect Finding 9), so ticket risk 4
    (re-mint loop) cannot happen. A re-sent write after a late 403 may add a second `access.super_admin` row, but never
    a second domain write from the wrapper.
13. `MM_IDENTITY_ISSUER` is missing from `.env.example` today. That is a separate gap and goes to follow-ups, not
    this ticket.
14. Hotspots: the only other open ticket is SIM-061 (IN_PROGRESS, ui, walk-in/walk-out). It is not expected to touch
    these files. If it edits `src/app/api/me/**` or `src/server/http/with-auth.ts`, expect a rebase.
15. Release waits for M-90. Merging before it is safe, because with the env unset the feature is off.

## Blocking questions
None. Every open question has a default, applied above and listed for the plan gate.

## Split proposal
The full ticket (server grant, audit, `/api/me`, docs, org picker and 429 handling) is above one cycle: about 700 lines
including tests, and it crosses High server paths and client UI. Proposed split:
- **Slice 1 (this plan)**: everything in the files table. It covers all six acceptance criteria. It works without
  slice 2: today's `parseOrgs` (`src/ui/auth/identityClient.ts:69-97`) ignores `access`, so super-admin orgs from
  `/auth/orgs` already show and open. A 429 on `/auth/token` already lands in the gate's retry view
  (`flow.ts:16`, `rate_limited` copy at `src/ui/copy/auth.ts:136`).
- **Slice 2 (new ticket, about S, no High path)**: the D86 client contract.
  - `OrgChoice.access?: "member" | "super_admin"` (`src/lib/identity/types.ts:50`);
  - `parseOrgs` reads `access` from the item, or the nested org, and drops unknown values without hitting the
    zero-parsed `unknownError` (`identityClient.ts:95`);
  - a "Support access" badge in `src/ui/org/OrgPickerView.tsx` and `OrgSwitcherDialog.tsx`, with copy in `src/ui/copy/`;
  - `tokenStore.background()` (`src/ui/auth/tokenStore.ts:226-233`) honours `retryAfterSeconds` for `rate_limited`;
  - tests in `identityClient.test.ts`, `tokenStore.test.ts` and `org-views.test.tsx`.
  - Optional: the Q10 polish for personal tabs, and picker search if `/auth/orgs` returns many orgs.
