# SIM-043 consult: software architect (read-only)

The design can be done with a small set of changes. The server already copes with callers who have no member row. The real decisions are about audit coverage, how the role key is configured, how the claims are parsed, and two paths that would quietly create a member row. D86 overrides the ticket text: the key is `simap:super-admin`, not `simap:superadmin` or `admin:super-admin`, and the grant needs the `org_access` check. The plan should restate the Scope bullets from D86.

## Findings

1. **`verify.ts` never reads `roles`, by design** (`src/server/identity/verify.ts:140`).
   - It also ignores `org_access`.
   - `VerifiedIdentity` is `{sub, email, org, orgRoles}`.
   - Its header comment says "No tier or HTTP logic lives here", and that boundary is worth keeping.
2. **`withAuth`** (`src/server/http/with-auth.ts:67-79`):
   - Today it computes the tier only via `tierFromOrgRoles(orgRoles)`.
   - The order is: `org_required`, then `forbidden`, then the member gate, then the handler.
   - `AuthContext` has no field saying how access was granted.
   - On a D86 token, `org_roles` is `[]`, so it returns 403 `forbidden` today. That is correct fail-closed behaviour until the change lands.
3. **`tierFromOrgRoles`** (`src/lib/auth/tier.ts`) is pure, matches exact keys only and uses `Object.hasOwn`. It is a good model for the new check.
4. **Member gate** (`src/server/members/gate.ts`): a missing row counts as `active`, and a `deactivated` row gives 403. That already matches the AC for "no row" and "deactivated row".
5. **The server already handles callers with no member row** ("A6", portal Admin):
   - `actorMemberId` returns null.
   - `manage.ts:439` uses the target as a fallback.
   - Self routes answer `no_linked_member` (422), 404 or an empty result. Tests cover this in devices, requests, presence, layout and members.
   - So the "virtual member, no row" option costs almost nothing on the server.
6. **Two paths create member rows:**
   - `GET /api/me` calls `getOrCreateMember`, then `ensure`, which inserts a row and audits `member.create` (`src/server/members/members.ts:51-87`).
   - `PATCH /api/me` calls `setOwnDisplayName`, which also calls `ensure` (`members.ts:96`).
   - Both would turn a super admin into a listed, seat-assignable member who counts in the dashboard, unless they are guarded.
7. **Audit:**
   - `writeAudit` (`src/server/audit/write.ts`) has 62 call sites in 20 files, each inside its write's transaction.
   - `audit_log` is append-only (trigger `55000`) and `actor_sub` has no foreign key.
   - The audit list left-joins `members` for the display name (`src/server/audit/audit.ts:56-80`). A super admin with no row therefore shows `displayName: null`.
8. **Org picker:**
   - `parseOrgs` (`src/ui/auth/identityClient.ts:69-97`) ignores roles and any `access` field.
   - `OrgChoice` is `{id, name}` (`src/lib/identity/types.ts:50`).
9. **Token client:**
   - `apiFetch` re-mints and resends at most once on 401 or on a 403 other than `org_required` (`src/lib/api/fetch.ts`). It cannot loop.
   - `tokenStore` handles `org_access_denied`, `not_member` and `session_invalid`, but has no special case for `rate_limited`.
   - `background()` retries every `RETRY_MS` while the token lives (`tokenStore.ts:226-233`), whatever the error.
10. **Token age:** `MAX_TOKEN_AGE_S = 43200` applies to every token. Nothing enforces D86's limit of 3600 s for super-admin tokens.

## Recommendations

1. **Claims stay in `verify`, policy goes in `lib`** (AC1-AC3, R1, and the verify.ts boundary).
   - `verify` also returns two normalized raw claims:
     - `orgAccess: string | null`
     - `appRoles: readonly string[]`
   - Bad shapes fail closed: a non-array `roles`, non-string items, or a non-string `org_access` mean "no grant". They should not cause a 401, so a stray shape never locks out normal members.
   - Add a pure `accessFromToken({orgRoles, orgAccess, appRoles}, superAdminKey): {tier, via: "org_roles" | "super_admin"} | null` in `src/lib/auth/tier.ts`.
   - It grants the super-admin path only when:
     - `org` is present (already checked before this point),
     - `orgAccess === "super_admin"` exactly,
     - `appRoles.includes(superAdminKey)` by exact string, with no case folding, trimming or prefix match,
     - and `superAdminKey` is configured.
   - It never falls back from one path to the other with mixed inputs.
   - When `org_access` is `"member"` or absent, the result is today's `tierFromOrgRoles` behaviour, and `roles` is ignored.
   - Tests: `simap:member`, app-scope `simap:admin`, `simap:super-admin ` with trailing space, `SIMAP:super-admin`, and `simap:super-admin-x` all give 403. The role with `org_access: "member"` gives 403. `org_access: "super_admin"` without the role gives 403. No `org` gives 403 `org_required`.
2. **Configuring the role key** (R3, D86 "keep the key configurable"):
   - Read it in `src/server/identity/config.ts` from a new env `SIMAP_SUPER_ADMIN_ROLE` and list the name in `.env.example`.
   - Validate it strictly, e.g. `^simap:[a-z][a-z0-9-]{0,62}$`.
   - Reject any key that `ROLE_TIER` uses or that means plain membership (`simap:admin`, `simap:manager`, `simap:user`, `simap:member`). A config mistake must never turn every member into a super admin.
   - An invalid value is a config error and gives 503, like the issuer check.
   - Prefer opt-in: unset or empty means the feature is off. That gives a kill switch, and M-90 sets the value in deploy.
   - The alternative is "unset means the `simap:super-admin` default". I list this under Open questions.
3. **AuthContext** gains `access: "member" | "super_admin"`, frozen with the rest of the context. `ctx.scope` still comes only from `scopeFor(org)` (AC3). No handler may branch on `access` to widen what it queries; add a test that the super-admin context's `scope.orgId === org`.
4. **TTL** (D86, at most 3600 s):
   - For a super-admin grant, also require `exp - iat <= 3600` (+30 s tolerance).
   - Outside that window, deny the grant (403 `forbidden`) rather than 401. A 401 leads to a re-mint and then `onAuthLost`.
   - D86 says these tokens carry no `sid`. Write down that revocation is by expiry only (up to 1 h) and that the member gate cannot stop a super admin who has no row.
5. **Audit** (AC4). Two options:
   - **Option A (recommended): one row per write in `withAuth`.**
     - For `access === "super_admin"` and a method other than GET/HEAD/OPTIONS, `withAuth` writes `action: "access.super_admin"` before calling the handler.
     - Fields: `entity: "org"`, `entityId: org`, meta `{method, route}`, where `route` is the path template, never the query string, body or token. Optionally add `jti`.
     - If the audit write fails, return 503 and do not call the handler (fail closed).
     - It sits in one place, so new routes cannot forget it. It complies with R7 because it is not a 401/403 and runs before any domain write.
     - Cost: the row is not in the handler's transaction, so it records an attempt even when the handler refuses. Label it "access" in copy so that is not misread.
   - **Option B: add `via: "super_admin"` to the meta of the existing action rows.**
     - Change `writeAudit`'s signature to take an `actor: {sub, access}` object, so the compiler finds all 62 call sites.
     - It is more precise but touches 20 files, beyond size M, and could be a follow-up.
     - An AsyncLocalStorage set by `withAuth` and merged by `writeAudit` gives the same result with a small diff, but it is ambient magic. Only use it if Ming wants per-action marking now.
   - **Reads:** do not audit each read. `audit_log` is append-only and cannot be pruned, and Identity already audits every mint (`token.super_admin_org_issued`), which records "entered org X for up to 1 h".
   - **Audit list:** show the actor as a fixed copy label (e.g. "mmlabs support") when `displayName` is null and the actor has `access.super_admin` rows. Add copy for the new action in `src/ui/copy/`.
6. **Member row** (AC5; the planner's default for D75): no row, not listed.
   - `GET /api/me` for `access === "super_admin"` skips `getOrCreateMember`. It returns the existing row if there is one; otherwise it returns `member: null` and `access: "super_admin"`.
   - `PATCH /api/me` returns 422 `not_allowed` (domain refusal, R7) when there is no row.
   - The shell, first-visit profile screen and My Portal must handle `member === null`. The plan must inventory the UI readers of `me.member`, because that is the main implementation risk.
   - A deactivated row still gives 403 `member_deactivated`. That follows from the gate and needs a test.
7. **Picker** (Scope bullet 5; D86):
   - Add `access: "member" | "super_admin"` to `OrgChoice`.
   - `parseOrgs` reads `access` from the item (and from the nested org as a fallback). An unknown or missing value marks the org not openable: shown disabled, or dropped. If missing means "member", that only holds for old Identity responses and the plan should state it.
   - Show a "support access" marker on super-admin orgs.
   - The UI decides from `access`. It never decodes the token client-side (R1).
8. **429 on `/auth/token`** (D86):
   - Handle `rate_limited` in `tokenStore`: keep the current token while it lives, and arm the next retry at `Retry-After` instead of `RETRY_MS`.
   - Surface the existing `rate_limited` copy in the picker.
   - Make sure "refresh permissions" (forced re-mint) and the apiFetch resend do not spend mints needlessly. The budget is 30 per hour per account.
9. **Docs** (AC6, R4): in the same PR, update spec §2, AUT-02 and AUT-04, `CLAUDE.md` R6 ("roles come from `org_roles`, or from the D86 super-admin grant"), and the stale comment at `verify.ts:140`. Fix the ticket Scope key to `simap:super-admin`.

## Risks

- **Trust in Identity:** simap fully trusts Identity to give the role and `org_access: "super_admin"` only to staff. If a staff token is stolen, the attacker has full Admin CRUD in any org for up to 1 h, and simap cannot revoke it. The opt-in env kill switch and the 1 h TTL check are the only levers on the simap side.
- **Unknown cases:**
  - Admin actions that call Identity with the browser cookie, such as inviting a member (`/api/invitations` → `POST /auth/orgs/{id}/invitations`), may get refused by Identity for super admins. "Full CRUD" may then be partial.
  - Any server code that reads `ctx.tier` but not `ctx.access` to compute "own" data is fine, because no-row behaviour is already tested.
- **Audit gaps with Option A:** action rows still show only `actor_sub`. Someone reading one row alone cannot see that it was cross-org access without correlating it with the `access.super_admin` row.
- **Rate limit:** switching between many orgs in a support session can hit 30 mints per hour, and today's background retry ignores `Retry-After`.
- **High paths:** `src/server/identity/**` and `src/server/http/**` require plan approval. `src/lib/auth/tier.ts` is not listed, but it is now part of the authorization decision, so the reviewer should treat it as High.
- **Org admins can lock out support:** a deactivated row blocks a super admin who was once a member. Org admins could use this to lock out mmlabs support. It matches the AC, but it may surprise people.

## Open questions (for Ming at the plan gate)

1. **Role-key env when unset:** feature off (recommended, fail-closed kill switch) or default `simap:super-admin`?
2. **Audit:** is Option A (one `access.super_admin` row per write, in `withAuth`) enough, or should every action row also be marked (Option B, larger)? Is skipping read audits acceptable, given Identity audits each mint?
3. **Member row:** confirm "no row, not listed, not seat-assignable". Should `PATCH /api/me` be refused for super admins with no row?
4. **Deactivated row:** should it really block a super admin (AC5 says yes), or should the super-admin path bypass the gate?
5. **Picker:** does `/auth/orgs` paginate for super admins with "all orgs"? The picker may need search. Is a missing `access` treated as `member` (old responses) or as not openable?
6. **Identity-side admin actions:** for a super admin, should invitations and other Identity-backed actions work? This is for org-admin-api to confirm.
7. **Read-only default:** D75 says full CRUD, so this is closed unless Ming reopens it (ticket risk 3).

The files the plan will touch most are in `/home/user/simap/src/`: `server/identity/verify.ts`, `server/identity/config.ts`, `server/http/with-auth.ts`, `lib/auth/tier.ts`, `server/members/members.ts`, `app/api/me/route.ts`, `server/audit/write.ts`, `server/audit/audit.ts`, `ui/auth/identityClient.ts`, `ui/auth/tokenStore.ts`, `lib/identity/types.ts` and `lib/api/fetch.ts`. The decisions are D75 and D86 in `/home/user/simap/work/decisions.md`.
