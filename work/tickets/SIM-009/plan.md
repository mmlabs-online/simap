Status: READY

# Plan — SIM-009: Invite people to an org (slice 1 of 2: invite and record)

**High paths: none.** No file in this plan matches `.claude/loop.config.md` → High paths: no `next.config.*`, no
`src/proxy.*`, no `src/server/http/**`, no `src/server/identity/**`, no `**/config.*`, no `.env.example`, no `*.sql`.
Ticket Gate stays `none`. The security review trigger still applies (Areas include security; `src/server/` changes).

**Identity contract: found, not guessed.** Both consults said the contract is not in the repo. That is true, but it is
on this machine: `/home/user/mmlabs-online/org-admin-api/docs/consumers.md` §"Invitations (USR-06b, ADR-0014)"
lines 174-213. Earlier tickets cited the same file (SIM-005, SIM-006, SIM-007.2). The request and response schemas are
confirmed in `org-admin-api/app/modules/invitations/schemas.py` and `router.py`. The token format
(`secrets.token_urlsafe(32)`, 43 chars) is in `docs/adr/0014-org-invitations.md:20` and `service.py:213`. Every wire
detail below is quoted from these files. No tolerant parser is needed, unlike Q18 `/auth/orgs`, so the plan is READY,
not BLOCKED.

## Scope summary
Ticket SIM-009 (Goal, Scope, ACs). Scope sources:
- spec AUT-03 (`docs/spec-v1.md:187-189`): "Admins and managers invite people by email with a role (D11): simap
  implements the invitation form and the `/accept-invitation` page from the contract (fragment token cleared,
  `Referrer-Policy: no-referrer`, sign-in with exactly the invited address). An inviter never offers a role above their
  own."
- spec §2 (`docs/spec-v1.md:45-50`): "Admins are appointed in the admin portal, never inside simap" and "an org admin or
  manager invites an email from simap (Identity invitations, `simap:org:invite`; an inviter cannot grant more than they
  hold)". This is why Admin cannot invite `simap:admin`, as the ticket says ("Admin: user or manager").
- spec MEM-01 (`docs/spec-v1.md:306-307`): "The Members page also lists the org's pending invitations sent from simap
  (read-only …) (D16)."
- D11, D14 ("admin and manager hold `simap:org:invite`"), D16 (a) ("pending invitations sent from simap are listed
  read-only"), D36 (copy files), D53 (referrer policy via page metadata; applies to slice 2).
- Contract (`consumers.md:176-184`): "`POST /api/v1/auth/orgs/{org_id}/invitations` `{account_id, email, role}`
  (cookie class, `credentials: "include"`, `X-MM-App`). `role` is a role key of the calling app: no `is_admin`
  permission, and nothing beyond the inviter's own permissions in that org … The answer is always
  `201 {id, org_id, role, expires_at}` … do not promise delivery. The global daily send cap answers 429
  `rate_limited` with `Retry-After` instead."
- Contract error table (`consumers.md:193-205`): 429 `rate_limited`; 403 `org_access_denied`, `org_invite_forbidden`,
  `invite_role_forbidden`, `invitation_limit_reached`, `org_invite_unavailable`, `email_unverified`,
  `invitation_email_mismatch`; 422 `unknown_role`, `token_invalid`. Also `consumers.md:146` 401 `session_invalid`, and
  422 `validation_error` (pydantic, `extra="forbid"`, `EmailStr`, `schemas.py:8-13`).
- Contract (`consumers.md:210-211`): "Any member holding `org:invite` can supersede another member's pending invitation
  to the same address by re-inviting it". simap's record therefore upserts (one pending row per address).

**This slice covers:** the invite form, the Identity invite call, the simap record route, every documented error code
with its English copy (invite and accept codes), and AC1 and AC5 (role options and error mapping). **Slice 2
(SIM-009.2)** covers the `/accept-invitation` page: AC2, AC3, AC4 and the fragment-handling tests (see Split proposal).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A Manager can invite only as user; an Admin as user or manager. | `roles.test.ts` (options per tier, `canInviteRole` table); `InviteDialog.test.tsx` (manager markup has only the User option, admin has User and Manager, user tier renders nothing); `src/app/api/invitations/route.test.ts` (manager + `simap:manager` → 422 `role_not_allowed` and the service is not called; admin + `simap:admin` → 400; user tier → 403 `forbidden` from the wrapper). |
| 5 | Unit tests cover role options per tier and error-code mapping. | `roles.test.ts`; `invite-flow.test.ts` (one row per code); `errors.test.ts` (each new code accepted from a server body, unlisted → `unknown`); `auth.test.ts` (every new code has its own non-generic message); `identityClient.test.ts` (`invite` request and response parsing). |
| S1 | Scope: simap records the invitations it sent (email, role, inviter, time; no token) for the pending list. | `record.test.ts` (SQL is an org-scoped upsert plus audit in one transaction; no token column or value); `record.db.test.ts` (`pnpm test:db`: re-invite keeps one pending row; org B cannot see org A's row; the row appears in `listPendingInvitations`); `route.test.ts` (201 body is `{id,email,role,createdAt,expiresAt}`, `Cache-Control: no-store`). |
| S2 | Scope: English messages (copy files, D36) for every documented error code. | `auth.test.ts` (each code in the contract table maps to its own string); `no-literals.test.ts` stays green. |
| T1 | No High path touched. | `git diff --name-only main` contains none of the High globs (the CI risk-tier job reports Medium). |

AC2, AC3 and AC4 belong to slice 2 (SIM-009.2). This PR does not close them.

## Ming verification after merge
Needs M-1 done with invitations enabled. Per `consumers.md:207-210`: `org_mode = required`, `join_policy = open`, a
default role and an org owner role, and the default role holds no `scope = org` permission.
1. Sign in as an org Admin → Members → "Invite people". The role list shows User and Manager. Invite a second account
   as Manager. DevTools → Network: `POST …/api/v1/auth/orgs/<org>/invitations` with body `{account_id, email, role:
   "simap:manager"}` answers 201. Then `POST /api/invitations` answers 201. `GET /api/members/invitations` lists the
   address.
2. Sign in as a Manager: the role list shows only User.
3. Before M-1 is complete, or with `join_policy` not `open`: the form shows the `org_invite_unavailable` message, not
   "Something went wrong".
4. The invitation email links to `https://<origin>/accept-invitation#token=…`. Until SIM-009.2 merges, that page is a
   404. That is expected: do not send real invitations to other people before slice 2 is merged.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/identity/types.ts` | add to `AuthErrorCode` (lines 2-23): `org_invite_forbidden`, `invite_role_forbidden`, `invitation_limit_reached`, `org_invite_unavailable`, `invitation_email_mismatch`, `unknown_role` | AC5, S2 | no |
| `src/lib/identity/errors.ts` | add the same six codes to `SERVER_AUTH_ERROR_CODES` (lines 7-25) | AC5 | no |
| `src/lib/identity/errors.test.ts` | each new code read from `{error:{code}}`; unlisted code still `unknown` | AC5 | no |
| `src/ui/copy/auth.ts` | six new entries in `authCopy.errors` (lines 102-124; the `satisfies` forces it) | S2, D36 | no |
| `src/ui/copy/auth.test.ts` | each invitation code returns its own message (not `errors.unknown`) | AC5, S2 | no |
| `src/lib/invitations/roles.ts` | new, pure: `INVITABLE_ROLES`, `InvitableRole`, `inviteRoleOptions(tier)`, `canInviteRole(tier, role)` | AC1 | no |
| `src/lib/invitations/roles.test.ts` | new | AC1, AC5 | no |
| `src/lib/invitations/invite-flow.ts` | new, pure: `inviteOutcome(CallResult)` and `recordOutcome` (Identity error → view state and field; record failure → warning) | AC5 | no |
| `src/lib/invitations/invite-flow.test.ts` | new: one row per contract code | AC5 | no |
| `src/lib/validate/invitation.ts` | new: `normalizeInviteEmail`, `validateInvitationRecord(body, nowMs)` | S1, R6 boundary | no |
| `src/lib/validate/invitation.test.ts` | new | S1 | no |
| `src/lib/api/error.ts` | add `"role_not_allowed"` to `API_ERROR_CODES` | AC1, R7 | no |
| `src/ui/copy/api.ts` | `role_not_allowed` message (the `satisfies Record<ApiErrorCode,string>` at line 20 forces it) | D36 | no |
| `src/server/invitations/record.ts` | new: `import "server-only"`; `recordInvitation(db, scope, actorSub, value)`: upsert plus audit in `withTx` | S1, R6 | no |
| `src/server/invitations/record.test.ts` | new: fake-db script test (as `src/server/members/manage.test.ts`) | S1 | no |
| `src/server/invitations/record.db.test.ts` | new: `pnpm test:db` (as `src/server/members/manage.db.test.ts:335-360`) | S1, R6 | no |
| `src/app/api/invitations/route.ts` | new: `POST` via `withAuth({tier:"manager"})` | S1, AC1 | no |
| `src/app/api/invitations/route.test.ts` | new (fakeAuth pattern of `src/app/api/members/route.test.ts:36-58`) | AC1, R7 | no |
| `src/ui/auth/identityClient.ts` | interface (lines 6-31) gets `invite(...)`; implementation uses the existing `post` in `"cookie"` mode, with a strict response parser | Contract | no |
| `src/ui/auth/identityClient.test.ts` | new `invite` cases | AC5, Contract | no |
| `src/ui/invitations/invitations-api.ts` | new: `createInvitationsApi(apiFetch).record(v)` resolves to a result and never throws (pattern of `src/ui/rooms/rooms-api.ts:18-40`) | S1 | no |
| `src/ui/invitations/invitations-api.test.ts` | new | S1 | no |
| `src/ui/invitations/InviteDialog.tsx` | new, pure view: `EntityFormDialog` + `DialogField` (email, icon `mail`) + `DialogSelect` (role, icon `group`); notices for sent / sent-not-recorded / error | AC1 | no |
| `src/ui/invitations/InviteDialog.test.tsx` | new: static-markup tests | AC1 | no |
| `src/ui/invitations/InvitePeople.tsx` | new container: button plus dialog; uses `useSession`, `getAuthRuntime`, `useApiFetch` | AC1 | no |
| `src/ui/copy/invitations.ts` | new: button, dialog, field and role labels, sent / sent-not-recorded / unavailable notices | D36 | no |
| `src/ui/index.ts` | export `InvitePeople` | page import via `@/ui` | no |
| `src/app/(app)/members/page.tsx` | render `<InvitePeople />` above the existing `PageSkeleton` (about 5 lines) | entry point | no |

## Data model / migration
None. `invitations` already exists (`db/migrations/20261120150000_init.sql:189-206`): `email`, `role` (check includes
`simap:admin|manager|user`), `invited_by_sub`, `status`, `identity_invitation_id text`, `expires_at`, `created_at`,
`updated_at`. It has no token column. The partial unique index `invitations_org_pending_email_key on (org_id,
lower(email)) where status = 'pending'` is the upsert's conflict target.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `/api/invitations` (new) | `{email, role, identityInvitationId, expiresAt}`, exact keys | 201 `{id, email, role, createdAt, expiresAt}` (= `PendingInvitationDto`, `src/lib/members/types.ts`), `Cache-Control: no-store` | 401/403 from the wrapper only; 400 `invalid_request` (bad JSON or body, role not `simap:user`/`simap:manager`); 422 `role_not_allowed` (role above the caller's tier); 503 `unavailable` (no pool) | `withAuth({tier:"manager"})` |

Identity call made by the browser (not a simap endpoint), `consumers.md:177-184` and `schemas.py:8-22`:
| Method | URL | Request | Response | Errors |
|---|---|---|---|---|
| POST | `{IDENTITY}/auth/orgs/{orgId}/invitations` | cookie class: `credentials:"include"`, `X-MM-App: simap`, JSON `{account_id, email, role}` (no other keys: `extra="forbid"`), `cache:"no-store"`, 15 s timeout | 201 `{id (uuid), org_id (uuid), role, expires_at (ISO datetime)}`; never echoes the email | via `toAuthError`: codes listed in Scope summary; fetch throw → `network` |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `roles.test.ts` › `inviteRoleOptions`: user → `[]`, manager → `["simap:user"]`, admin → `["simap:user","simap:manager"]`; never contains `simap:admin` | AC1 |
| `roles.test.ts` › `canInviteRole` table: (manager, `simap:manager`) false; (admin, `simap:admin`) false; (admin, `simap:manager`) true; `simap:member`, `simap:org:invite`, `" simap:user"`, `"SIMAP:USER"`, `null`, `42` false | AC1 |
| `invite-flow.test.ts` › `inviteOutcome` ok → `sent`; `validation_error` → field `email`; `unknown_role`, `invite_role_forbidden` → field `role`; `org_access_denied`, `org_invite_forbidden`, `invitation_limit_reached`, `org_invite_unavailable`, `email_unverified`, `session_invalid`, `rate_limited` (keeps `retryAfterSeconds`), `network`, `unknown` → error with no field | AC5 |
| `invite-flow.test.ts` › `recordOutcome` ok → `sent`; any failure code → `sentNotRecorded` (never `error`: the invitation exists at Identity) | S1 |
| `errors.test.ts` › each of the six new codes passes through `toAuthError`; `join_closed`-style unknown text → `unknown` | AC5 |
| `auth.test.ts` › `authErrorMessage({code})` for each invitation code differs from `errors.unknown` and contains no `{`/`undefined` | AC5, S2 |
| `validate/invitation.test.ts` › `normalizeInviteEmail`: trims and lowercases; `""`, `"a@b"`, two `@`, 255 chars → null; Vietnamese local part `"nguyễn@x.vn"` follows `emailError` | S1, Domain focus |
| `validate/invitation.test.ts` › `validateInvitationRecord`: happy path; extra key → `field`; missing key; role `simap:admin` / `simap:member` / `manager` rejected; `identityInvitationId` non-canonical UUID rejected; `expiresAt` not a string, no timezone (`"2026-12-01T00:00:00"`), unparseable, before `now - 60 s`, after `now + 31 d` rejected; returns `expiresAt` as `toISOString()` (UTC); non-object body rejected | S1 |
| `record.test.ts` › one transaction: `begin`, `insert into invitations … on conflict (org_id, lower(email)) where status = 'pending' do update`, `insert into audit_log`, `commit`; parameters start with `scope.orgId`; audit action `invitation.create`, entity `invitation`, meta exactly `{role}` (no email) | S1, R6, PII |
| `record.test.ts` › insert error → `rollback`, rethrown (route answers 500 through the wrapper) | S1 |
| `record.db.test.ts` › first record → pending row with `invited_by_sub`, `identity_invitation_id`, `expires_at`; same email in other case → still one pending row, with role, expiry and id refreshed; an `accepted` row for the same email does not conflict; org B's `listPendingInvitations` does not see org A's row | S1, R6 |
| `route.test.ts` › no Authorization → 401 and the service is not called; user tier → 403 `forbidden` and the service is not called | R7 |
| `route.test.ts` › manager + `simap:manager` → 422 `role_not_allowed`, service not called; manager + `simap:user` → 201; admin + `simap:manager` → 201; admin + `simap:admin` → 400 | AC1, R7 |
| `route.test.ts` › bad JSON → 400; extra key → 400; no pool → 503; 201 body equals the service DTO, `Cache-Control: no-store`; service called with `(pool, ctx.scope, "s1", value)` | S1 |
| `identityClient.test.ts` › invite: POST `{BASE}/auth/orgs/<orgId>/invitations`, `credentials:"include"`, `X-MM-App`, no Authorization header, body exactly `{account_id, email, role}`, `no-store`, has a signal | Contract |
| `identityClient.test.ts` › invite parse: 201 good body → `{id (lowercased), expiresAt}`; `org_id` ≠ requested, `role` ≠ requested, non-UUID `id`, missing or unparseable `expires_at`, `{}`/`null` → rejects `unknown`; non-UUID `orgId` argument → rejects `unknown` without fetching; 403 `invite_role_forbidden` → that code; 429 with `Retry-After: 30` → `rate_limited` with 30; fetch throw → `network` | Contract, AC5 |
| `invitations-api.test.ts` › POSTs `/api/invitations` with the JSON body; 201 → ok + DTO; 422 → `{ok:false, code:"role_not_allowed"}`; `ApiAccessError` → its code; fetch throw → `unavailable`; never throws | S1 |
| `InviteDialog.test.tsx` › tier manager: one `<option>` (User); tier admin: User and Manager; never `simap:admin`; error notice renders `authErrorMessage` text; `sentNotRecorded` renders its warning and a retry button; no literal strings (copy only) | AC1, D36 |

## Approach
1. **Error codes (shared with slice 2).** Add the six codes to `AuthErrorCode` (`types.ts`) and
   `SERVER_AUTH_ERROR_CODES` (`errors.ts`). Add English copy in `authCopy.errors`:
   - `org_invite_forbidden`: "You are not allowed to invite people to this organization."
   - `invite_role_forbidden`: "You can't invite someone with this role."
   - `invitation_limit_reached`: "The invitation limit is reached for now. Try again later."
   - `org_invite_unavailable`: "Invitations are not available for simap right now. Contact the operator."
   - `invitation_email_mismatch`: "This invitation was sent to a different email address. Sign in with the invited
     address."
   - `unknown_role`: "This role is not available. Reload the page and try again."

   Existing codes already cover `rate_limited`, `org_access_denied`, `email_unverified`, `token_invalid`,
   `session_invalid`, `validation_error` and `network`. Never echo server text (rule of `authErrorMessage`).
2. **Roles (`src/lib/invitations/roles.ts`, pure, lib layer).** `INVITABLE_ROLES = ["simap:user", "simap:manager"] as
   const`. Use a `Record<Tier, readonly InvitableRole[]>`: user `[]`, manager `["simap:user"]`, admin
   `["simap:user","simap:manager"]`. `canInviteRole(tier, role: unknown)` does an exact-string `includes`. Type `Tier`
   comes from `@/lib/auth/tier` (structurally equal to `@/lib/tier`'s, which the UI session uses).
3. **Validator (`src/lib/validate/invitation.ts`).**
   - `normalizeInviteEmail(v)` reuses `emailError` from `credentials.ts`, then `trim().toLowerCase()`.
   - `validateInvitationRecord(body, nowMs): Validated<{email, role, identityInvitationId, expiresAt}>` takes exact
     keys (as `validateMePatch`, `member.ts:39-46`). Role must be in `INVITABLE_ROLES`. `identityInvitationId` passes
     `isCanonicalUuid`. `expiresAt` must match an ISO datetime with `Z` or an offset, be parseable, and fall within
     `[now − 60 s, now + 31 d]`. It is returned as `toISOString()`.
4. **Server (`src/server/invitations/record.ts`).** `withTx(pool, c => …)` (`src/server/db/tx.ts`):
   ```sql
   insert into invitations (org_id, email, role, invited_by_sub, identity_invitation_id, expires_at)
   select o.org_id, $2::text, $3::text, $4::uuid, $5::text, $6::timestamptz
   from (select $1::uuid as org_id) o where o.org_id = $1::uuid
   on conflict (org_id, lower(email)) where status = 'pending'
   do update set role = excluded.role, invited_by_sub = excluded.invited_by_sub,
     identity_invitation_id = excluded.identity_invitation_id, expires_at = excluded.expires_at,
     created_at = now(), updated_at = now()
   returning id, email, role, created_at, expires_at
   ```
   - Run it through `orgQuery`. The subselect form passes its `org_id = $1` guard, as in `rooms.ts:91-97` and
     `members.ts:55-62`.
   - Then `writeAudit(c, scope, {actorSub, action: "invitation.create", entity: "invitation", entityId: id, meta:
     {role}})`. Keep the email (PII) out of audit and out of logs.
   - Map to `PendingInvitationDto`.
   - The upsert matches Identity's "re-invite supersedes" rule and makes the route idempotent against `apiFetch`'s
     single re-send on 401/403 (R7 note).
5. **Route (`src/app/api/invitations/route.ts`).** Follow the shape of `members/[id]/deactivate/route.ts`:
   - `getPool` (503), `readJson` (400), then `validateInvitationRecord(body, Date.now())` (400).
   - Then `if (!canInviteRole(ctx.tier, v.role)) return apiError(422, "role_not_allowed")`. **R7:** this is a domain
     refusal, so it is 422 and never 403. The only 401/403 come from `withAuth` before the handler runs. Every refusal
     happens before the write.
   - Then `recordInvitation(...)` → `Response.json(dto, {status: 201, headers: {"Cache-Control": "no-store"}})`.
   - `routes-guarded.test.ts` covers the new file automatically.
6. **Identity client (`identityClient.ts`).** Add to the interface: `invite(v: {accountId: string; orgId: string;
   email: string; role: string}): Promise<{ id: string; expiresAt: string }>`.
   - Reject `unknown` if `orgId` or `accountId` fails `UUID_RE` (no fetch).
   - Otherwise call `post(`/auth/orgs/${encodeURIComponent(orgId)}/invitations`, {account_id, email, role}, "cookie",
     AbortSignal.timeout(INVITE_TIMEOUT_MS = 15000))`.
   - Strict parse: `id` passes UUID_RE; `org_id` lowercased equals `orgId` lowercased; `role === role`;
     `expires_at` is a string with `Number.isFinite(Date.parse(...))`. Otherwise `unknownError()`. Return `{id:
     id.toLowerCase(), expiresAt: new Date(expires_at).toISOString()}`.
   - The response never carries a token. Nothing is logged.
7. **Outcomes (`src/lib/invitations/invite-flow.ts`, pure).**
   - `inviteOutcome`: `{kind:"sent"}`, or `{kind:"error", error, field?: "email"|"role"}`.
   - `recordOutcome`: `{kind:"sent"}`, or `{kind:"sentNotRecorded", code}`.
   - Both reuse `CallResult` from `email-flows.ts`.
8. **UI.**
   - `InvitePeople` (client) reads `useSession()`. It renders nothing when the session is null, when
     `inviteRoleOptions(tier)` is empty (User tier), or when `session.devToken` is set (dev-token mode has no Identity
     session, SIM-028.1).
   - Otherwise it shows a button (`invitationsCopy.open`) that opens `InviteDialog`.
   - On submit: validate the email with `emailError`, and the role with `canInviteRole`. With a single option
     (Manager), it is preselected.
   - Then read `rt.store.accountId()` / `rt.store.orgId()` from `getAuthRuntime()`. If either is null, show the
     `unavailable` notice.
   - Then call `rt.client.invite({accountId, orgId, email: trimmed, role})`. On error, show `inviteOutcome` (inline
     field error or `authErrorMessage` in an `aria-live` notice). Identity 403s do **not** go through `apiFetch`, so
     they never sign the user out.
   - On success, call `invitationsApi.record({email: normalized, role, identityInvitationId: id, expiresAt})`.
     - If it succeeds: show `invitationsCopy.sent(email)`, wording that does not promise delivery
       (`consumers.md:182`): "Invitation created for {email}. If the address can receive mail, an invitation is on
       its way."
     - If it fails: show the `sentNotRecorded` warning ("The invitation was sent, but it may not appear in the
       pending list.") with a "Try saving again" button. That button re-calls only `record` with the same payload and
       never re-invites.
   - A `busy` ref blocks double submit. Never record before Identity succeeds.
   - Members page: `src/app/(app)/members/page.tsx` returns a fragment. It holds a right-aligned `<div
     className="px-4 pt-4 lg:px-6 lg:pt-6 flex justify-end"><InvitePeople /></div>`, then the existing
     `PageSkeleton`. SIM-011.2 replaces the skeleton and must keep `<InvitePeople />`.
9. **Rules.**
   - R1: lib is pure. UI imports only `@/lib` and `@/ui`. The route is the only entry to `src/server/invitations`.
     Run `pnpm check:layers`.
   - R2: no schema change.
   - R3: no env. The Identity base comes from the existing `getAuthRuntime`.
   - R4: no edit to `manage.ts`, `members/invitations/route.ts`, `email-link.ts`, `next.config.ts`, `headers.ts`.
   - R5: the tests listed above.
   - R6: the insert is scoped by `ctx.scope`, the inviter is `ctx.sub`, and roles come from `ctx.tier` (from
     `org_roles`).
   - R7: see step 5.
   - Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` (CI also runs
     `pnpm test:db`).

## Specialist input used
- api-platform-engineer:
  - **Adopted:** the browser calls Identity (cookie class) and simap records afterwards (A1-A2); the record route runs
    at manager tier with exact-key validation (B); 422 rather than 403 for role-above-tier (B, R7); upsert over 409
    (B, Identity supersedes and it stays idempotent); best-effort record with a warning, never record first (C); role
    in audit meta without the email (B); never echo server text (D).
  - **Replaced:** the "likely codes, to verify" table (D) by the real contract table. `join_closed`, `forbidden` and
    `invitation_invalid` do not exist. They are `org_invite_unavailable`, `org_invite_forbidden` /
    `invite_role_forbidden` and `token_invalid`.
  - **Answered:** open questions 1-3 (contract shapes; Identity returns `id` and `expires_at`; Identity sends the mail
    with `{Origin}/accept-invitation#token=`). Q4: upsert. Q5: 422. Q6: meta tag per D53 (slice 2). Q8: hidden for
    User.
  - **Deferred:** Q7 (mark `accepted` on first visit) goes to a follow-up.
- frontend-developer:
  - **Adopted:** `invitableRoles`/`canInviteRole` as one pure helper shared by UI and server (1); upsert (2); browser
    invite then record, warning plus retry-record-only (3); the dialog on `EntityFormDialog`, hidden for User,
    `useApiFetch` for record and the runtime client for Identity (6); a minimal block on `members/page.tsx` that
    SIM-011.2 keeps (6); invitation error copy in `auth.ts` (forced by `satisfies`) and form copy in
    `invitations.ts` (5).
  - **Rejected:** putting POST on `/api/members/invitations`. The ticket names `src/app/api/invitations/*`, and a new
    file leaves SIM-011's route and its test untouched.
  - **Answered:** Q1-Q3 (contract: cookie + `account_id`; accept returns `{org_id, roles}`; 43-char base64url token,
    which fits `email-link.ts`'s `{32,128}` regex). Q4: role keys are the full `simap:*` keys, as in `org_roles`
    (`tier.ts:5-9`); Admin cannot invite Admin (spec §2). Q8: `/api/invitations`. Q9: no Turnstile on invite (not in
    the contract).
  - **Moved to slice 2:** the accept-page items (4).

## Assumptions
- **A1 Contract source.** `org-admin-api/docs/consumers.md:174-213` as it is on this machine (2026-11-22), confirmed by
  `app/modules/invitations/schemas.py` and `router.py`. If Identity changes, the fix stays local to `invite()`'s parser
  and the code lists.
- **A2 No admin invites.** Identity would allow an owner to invite the owner role (`consumers.md:180`). simap does not
  offer it (spec §2, ticket scope). The validator also blocks `simap:admin`, the only server guard, because the DB
  check allows it.
- **A3 Client-reported record.** A Manager could post a record for an invitation never sent. It only adds a read-only
  row to their own org's pending list (D16 a), audited, and nothing reads it for access. Accepted, as both consults
  recommend.
- **A4 Stale pending rows.** simap does not learn when an invitation is accepted. Rows drop off the list at
  `expires_at` (always set now, from Identity, default 7 days). Marking rows `accepted` at first visit is a follow-up.
- **A5 Email case.** The trimmed address goes to Identity as typed. simap stores it lowercased, which matches the
  unique index and the list. Identity does its own normalization and does not fold Gmail dots or plus tags.
- **A6 Dev-token mode.** `pnpm dev` with the dev token has no Identity session, so the invite button is hidden there.
  Test invites with a real sign-in (Ming step).
- **A7 Hotspots.**
  - `src/app/(app)/members/page.tsx` and `src/ui/index.ts` are also edited by SIM-011.2 (BACKLOG, not open). Expect a
    small rebase there: SIM-011.2 must keep `<InvitePeople />`. The orchestrator should add this note to SIM-011.2's ticket; the
    planner edits only this plan.
  - `src/ui/auth/identityClient.ts`, `src/lib/identity/*` and `src/ui/copy/auth.ts` are not in any open ticket's plan.
    SIM-032 (REWORK) touches dev scripts only.
- **A8 Referrer (slice 2).** Per D53 (Q34), `/accept-invitation` uses `metadata.referrer: "no-referrer"` like the four
  account pages, not a response header, so no High path. If Ming wants a real header, slice 2 becomes High
  (`next.config.ts`) and needs plan approval.
- **A9 Size.** This slice is about 480 product lines plus tests. It is slightly above the ~400 guide, but it is one
  coherent change (one route, one dialog).

## Blocking questions
None.

## Split proposal
The whole ticket is about 900 product lines, more than one implement/review cycle. Proposal:
- **Slice 1, SIM-009 (this plan):** invite form, Identity `invite()`, `POST /api/invitations` record, every invitation
  error code with its copy. Covers AC1, AC5 and Scope items 1, 3 and 4.
- **Slice 2, SIM-009.2, "Accept-invitation page"** (new ticket, depends on SIM-009, Areas security and ui, Gate none).
  Covers AC2, AC3, AC4, Scope item 2 and the "fragment handling" unit tests. Outline for its planner (contract
  `consumers.md:186-191`):
  - `src/app/accept-invitation/page.tsx`: thin, no props, `metadata = {title, referrer: "no-referrer"}` (D53), added
    to `src/app/account-pages.test.ts`.
  - `src/ui/auth/AcceptInvitationPage.tsx`:
    - The mount effect calls `takeLinkToken(window, "/accept-invitation")` first. The existing regex fits the 43-char
      token. The token is kept in a `useRef`, never in state, a URL or a log.
    - With no token, show the invalid view with no network call.
    - If `store.accountId()` exists, call `accountEmail()` and show "Accept as <email>" plus "Use another account"
      (`store.forget()`). Otherwise show `SignInView` without `signUpHref`.
    - `store.signIn` may reject `not_member` or `email_unverified` but keeps the account id
      (`tokenStore.ts:194-195`), so continue.
    - Add an own "Create an account" link with `target="_blank" rel="noopener noreferrer"`. The sign-up and
      verification detour then happens in another tab and this tab keeps the token in memory.
  - `client.acceptInvitation({accountId, token})`: cookie mode, body `{account_id, token}`, strict parse of `200
    {org_id, roles}`. It is called only from the Accept button.
  - Pure `acceptOutcome` in `src/lib/invitations/accept-flow.ts`:
    - ok → `done` and clear the token.
    - `token_invalid` / `validation_error` → `invalid` and clear the token.
    - `invitation_email_mismatch` → `ready` with the mismatch message, keeping the token (AC3: not consumed per
      `consumers.md:203`), plus "Use another account".
    - `session_invalid` → sign-in, keeping the token.
    - `email_unverified`, `org_invite_unavailable`, `rate_limited`, `network`, `unknown` → `ready` with the error,
      keeping the token.
    - Tests pin that the ref survives the mismatch.
  - On success: `await store.selectOrg(org_id)` (best effort), then `location.assign("/")`. The gate enters the
    remembered org and `/api/me` creates the member (D16 a), which gives AC4.
  - Copy: `src/ui/copy/invitations.ts` `accept.*`.
  - Ming check: accept with a different account (mismatch, then the right account still works) and with the right
    account (lands in the org, profile screen); DevTools shows no `#token` in history and `<meta name="referrer"
    content="no-referrer">`.
