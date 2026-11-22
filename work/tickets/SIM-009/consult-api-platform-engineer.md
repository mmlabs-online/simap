## SIM-009 consult (API platform)

### Findings
1. **No Identity invitation contract is in the repo.** The ticket cites "per contract" and `consumers.md`, which lives in org-admin-api. The only local invitation docs are spec AUT-03 (`docs/spec-v1.md` lines 182-189), MEM-01 (line 306), D11, D14 and D16, and the request note `docs/requests/org-admin-api-org-members.md`. That note says org invitations are a **cookie-class** call ("cookie class like invitations"). Cookie class means a browser call with `credentials: "include"` plus `X-MM-App`, as in `src/ui/auth/identityClient.ts` (`PostMode "cookie"`). An app-credential server call is not available for invitations (`mmak_` is allowed only on the manifest PUT today).
2. **The invite call has to come from the browser.** Identity authenticates it with the refresh cookie, an `account_id` in the body and the org-scoped bearer. A simap server cannot hold that cookie. `connect-src` already allows the Identity origin (`src/lib/security/headers.ts`), so no CSP change is needed. Identity request and response shapes and error codes are unverified. I could not confirm them.
3. **The `invitations` table already exists** in `db/migrations/20261120150000_init.sql` (lines 189-206). Columns: `id`, `org_id`, `email`, `role` (check: `simap:admin`, `simap:manager`, `simap:user`), `invited_by_sub`, `status` (`pending`, `accepted`, `revoked`, `expired`), `identity_invitation_id`, `expires_at`, timestamps. It has no token column. A unique index on `(org_id, lower(email)) where status = 'pending'` allows one pending invitation per email per org. **No migration is needed.**
4. **The read side is done (SIM-011).** `GET /api/members/invitations` (manager tier) calls `listPendingInvitations` in `src/server/members/manage.ts`. It filters `status = 'pending'` and `expires_at` null or in the future, caps at 100, and returns id, email, role, createdAt, expiresAt. SIM-009 only needs the write side.
5. **Existing patterns to copy:**
   - Route shape from `src/app/api/members/[id]/deactivate/route.ts`: `withAuth({tier})`, then `getPool` (503 if absent), then `readJson` (400 `invalid_request`), then a validator in `src/lib/validate/*`, then a `src/server/*` function returning `{ok}` or `{status, code}`.
   - Audit through `writeAudit` inside `withTx`.
   - Tier logic in `src/lib/auth/tier.ts` (`atLeast`, `tierFromOrgRoles`).
   - Fragment handling: `src/lib/identity/email-link.ts` already has `takeLinkToken` and `readLinkToken`. It clears hash and query before any network call. The token pattern is `{32,128}` base64url, which may not match Identity's invitation token format.
   - `metadata.referrer = "no-referrer"` on the account pages, with a test in `src/app/account-pages.test.ts`.
   - Identity client and errors: `createIdentityClient` and `toAuthError` (`SERVER_AUTH_ERROR_CODES`). This list has no invitation-specific codes.
6. **Roles.** Admin and manager hold `simap:org:invite` (D14). Identity enforces that an inviter cannot grant more than they hold (spec line 48). simap should mirror this in the UI and again on the server record route.

### Recommendations
**A. Flow (answers "who calls Identity"):**
1. The browser calls Identity `POST /auth/orgs/{org_id}/invitations` with its org token. Add `inviteToOrg` to `identityClient`, using cookie mode with `account_id`, as for `orgs`, `join` and `logout`.
2. On success, the browser calls simap `POST /api/invitations` with `{email, role, identityInvitationId?, expiresAt?}` to record it. The server never sees a token.
3. The accept flow runs fully in the browser. `/accept-invitation` takes the token with `takeLinkToken` first, signs in or signs up, then calls `POST /auth/invitations/accept` (token in the body only). It then mints a token with `org_id`.
4. Mismatch handling: do not retry and do not clear anything server-side. The token is not consumed (AC3).

**B. Record route `POST /api/invitations` (new, `src/app/api/invitations/route.ts`).** Use `withAuth({tier: "manager"})`.
- Validate in `src/lib/validate/invitation.ts`: email trimmed, lowercased, a length cap, a basic shape check. Role must be exactly `simap:user` or `simap:manager`. Reject `simap:admin` (400). Reject unknown keys.
- Tier rule, shared as a pure function in `src/lib/invitations/roles.ts`: `inviteRoleOptions(tier)` returns admin: `[user, manager]`, manager: `[user]`, user: `[]`. The server must check `role in inviteRoleOptions(ctx.tier)` and refuse with 403 `forbidden`. A manager sending `simap:manager` is a tier refusal of the role. This fails before any write, so R7 holds because the check is in the handler before the insert. If you prefer R7 strictness (auth codes only from the wrapper), use 422 `role_not_allowed` instead. I recommend 422, since 403 outside the wrapper is what R7 warns about.
- Insert into `invitations` with `org_id` from `ctx.scope`, `invited_by_sub = ctx.sub`, `status = 'pending'`. Do it in a `withTx` with an audit row (`invitation.created`, meta carries the role, not the email, to keep PII out of audit). Return 201 `{id, email, role, createdAt, expiresAt}` with `Cache-Control: no-store`.
- Re-invite: on unique violation (`invitations_org_pending_email_key`) return 409 `invitation_exists`. Better: upsert, refreshing `expires_at` and `identity_invitation_id` and keeping one row. Decide this in the plan. Identity may itself resend or return a conflict.
- Add the route to the guarded-routes test (`src/app/api/routes-guarded.test.ts`).
- Expiry: the list already hides expired rows, so no sweeper is needed now. Mark rows `accepted` later once accept is observable. Accept happens at Identity and simap sees it only when the user first visits (D16 a). Consider an opportunistic update on first-visit member creation (`status = 'accepted'` where lower(email) matches). This is optional and can go to follow-ups.

**C. Ordering and failure.** The record call is best-effort after Identity succeeds. If the record fails, show "Invitation sent, but it may not appear in the pending list" and do not re-invite blindly. Do not record before Identity succeeds, or a failed invite leaves a ghost row. Because `apiFetch` re-sends once on 401/403, the record route must be idempotent. The upsert option in B gives this.

**D. Error-code mapping (Identity to copy), in `src/lib/identity/errors.ts` plus `src/ui/copy/invitations.ts` (D36).** The invitation codes must be confirmed against `consumers.md` before coding. Extend `AuthErrorCode` and `SERVER_AUTH_ERROR_CODES`, and add a test per code. Likely codes, to verify:

| Code | Meaning |
|---|---|
| `validation_error` | Bad email or role. |
| `rate_limited` | Show retry-after (already handled). |
| `org_access_denied` | Org refused. |
| `session_invalid` | Re-sign in. |
| `join_closed` | M-1 `join_policy` not `open` or owner role not set. |
| `forbidden` / `insufficient_permission` | Inviter lacks the role or `simap:org:invite`. |
| `invitation_invalid` / `token_invalid` | Accept: expired, used or unknown token. |
| `email_mismatch` | Accept: signed in with a different address. Show the mismatch message; do not consume the token. |
| `email_unverified` | Already covered. |
| `email_taken` | Already covered. |
| `network` | Already covered. |

Never echo server text. Unknown codes map to `unknown` with a generic message.

**E. Accept page.**
- `src/app/accept-invitation/page.tsx` is a server component with `metadata.referrer: "no-referrer"`. Also send a `Referrer-Policy: no-referrer` header for this path (the ticket says header). The global header is `strict-origin-when-cross-origin` in `src/lib/security/headers.ts`, so a per-path override is needed. See the High-path note below.
- Call `takeLinkToken` before any network call. Keep the token in component memory only. Never put it in a log, a URL, localStorage or a link.
- "Exactly the invited address": the page cannot know the invited email without calling Identity. Pre-fill nothing from a query. Let Identity compare (mismatch error) rather than trusting client text.

**F. Unit tests (AC5):** `inviteRoleOptions` per tier; a validator rejecting `simap:admin` and role above tier; error mapping per code; fragment handling (reuse the `email-link` test style); route test for 401/403 before side effects and the 422 role refusal.

### High-path impact
- **Likely none** if the plan stays in `src/ui/invitations/*`, `src/app/accept-invitation/*`, `src/server/invitations/*`, `src/app/api/invitations/*`, `src/lib/validate/*`, `src/lib/identity/{errors,types}.ts`, `src/ui/auth/identityClient.ts`. None of these are in the High list. `withAuth` is reused unchanged.
- **High if** you (a) add a per-path `Referrer-Policy: no-referrer` header via `next.config.*` or `src/proxy.*` (both High) or edit `src/lib/security/headers.ts` (not listed, but it feeds the config; check `scripts/check-headers.mjs`, which is High-adjacent). Alternative that stays Low: use `metadata.referrer` (a meta tag) as the existing account pages do, and flag the header gap. (b) Touch `src/server/identity/**` or `src/server/http/**`. Not needed. (c) Add a `*.sql` migration. Not needed. (d) Add env names to `.env.example`. Not needed, since the Identity base already comes from `src/lib/identity/config.ts`.
- The loop config's "Any High path, schema changes, auth, secrets" review trigger still applies because Areas include security.
- Ticket Gate is `none`. If the header route is chosen, the gate would become High and need Ming's approval.

### Risks
- Identity contract unverified (request and response body, error codes, token format, whether the response gives an invitation id or expiry). Coding against guesses risks silent mismatch.
- `join_policy = open` and owner role set (M-1) is required, or invites fail. Needs a clear `join_closed`-style message.
- Client-side recording can be forged by a Manager (records an invitation that was never sent). Impact is limited to the read-only pending list in their own org, scoped by `org_id`. Mitigate with the role check and audit. Do not rely on the pending list for any access decision.
- Email is PII: do not log it and keep it out of audit meta. The pending list returns it to Managers (accepted, per D16).
- A late 401/403 from Identity on the invite call must not be retried blindly. Only the record call goes through `apiFetch`.
- The fragment token regex `{32,128}` may reject a valid Identity invitation token.
- Hash clearing must happen before any network or analytics call (AC2). History is clean only if `replaceState` runs on first render, not in an effect after a fetch.

### Open questions
1. What are the exact `POST /auth/orgs/{org_id}/invitations` and `POST /auth/invitations/accept` request and response shapes, error codes and token alphabet and length (ask Ming for `consumers.md`)?
2. Does Identity return an invitation id and `expires_at` that simap should store?
3. Does Identity send the email, and with what link target (`/accept-invitation#token=...`)?
4. Does re-inviting a pending email resend, replace or conflict? Pick simap behaviour (upsert vs 409).
5. For a role-above-tier request, use 422 `role_not_allowed` (recommended, R7) or 403?
6. Is a `Referrer-Policy` header required (High path) or is `metadata.referrer` enough?
7. Should first-visit member creation mark the matching pending invitation `accepted`? Follow-up or now?
8. Does a Manager UI need to hide the invite form entirely from `user` tier? Assumed yes (`inviteRoleOptions` returns empty).

Files read: `/home/user/simap/work/tickets/SIM-009/ticket.md`, `/home/user/simap/docs/spec-v1.md`, `/home/user/simap/work/decisions.md`, `/home/user/simap/docs/requests/org-admin-api-org-members.md`, `/home/user/simap/db/migrations/20261120150000_init.sql`, `/home/user/simap/src/server/http/with-auth.ts`, `/home/user/simap/src/server/members/manage.ts`, `/home/user/simap/src/app/api/members/invitations/route.ts`, `/home/user/simap/src/ui/auth/identityClient.ts`, `/home/user/simap/src/lib/identity/errors.ts`, `/home/user/simap/src/lib/identity/email-link.ts`, `/home/user/simap/src/lib/auth/tier.ts`, `/home/user/simap/.claude/loop.config.md`.
