## SIM-009 frontend consult (read-only)

### Findings

**The Identity contract is not in this repo, so the endpoint details are unknown.** The Identity contract (`consumers.md`) is only referenced, never included. The only local docs are `docs/spec-v1.md` and `docs/requests/org-admin-api-org-members.md`. Nothing in the repo shows these for the invitation endpoints:
- the request and response bodies of `POST /auth/orgs/{org_id}/invitations` and `POST /auth/invitations/accept`;
- the error code strings for invitations;
- whether the accept call needs `account_id` and the cookie class, or a bearer;
- whether accept returns `org_id`;
- whether the invited email is visible to the page before sign-in.

The only hints are the `invitations.identity_invitation_id` column and the sibling "cookie class" example in the org-admin-api request doc. The planner must get the contract text from Ming (as was done for Q18 `/auth/orgs`). Until then every code and field below is a placeholder. Do not guess codes: `toAuthError` maps any unlisted code to `unknown`.

**Already in place**
- DB: `invitations` table (`db/migrations/20261120150000_init.sql:190`). It has `org_id`, `email`, `role` (`simap:admin`, `simap:manager` or `simap:user`), `invited_by_sub`, `status`, `identity_invitation_id`, `expires_at`, and no token.
  - It has a unique index on `(org_id, lower(email)) where status='pending'`, so re-inviting a pending email conflicts. That is a design point (upsert).
- Read side: `GET /api/members/invitations` (manager tier) already exists, plus `listPendingInvitations` in `src/server/members/manage.ts:193`. It filters to pending and unexpired. `PendingInvitationDto` is in `src/lib/members/types.ts`.
- No write side exists: no `src/server/invitations`, no POST route.
- Tier model: `src/lib/auth/tier.ts` has `Tier = user|manager|admin`, `TIER_RANK` and `atLeast`. There is no role-options helper yet.
- Link-token handling for the other email pages: `src/lib/identity/email-link.ts` has `takeLinkToken(window, path)`. It reads only `#token=<32-128 url-safe chars>`, calls `replaceState` to clear the hash and query, and ignores `?token=`.
  - `VerifyEmailPage`/`ResetPasswordPage` keep the token in a `useRef`, never in state, and send it only from a button.
  - Pages are thin server components with `metadata.referrer: "no-referrer"` and no props. `src/app/account-pages.test.ts` asserts this.
- Identity client: `src/ui/auth/identityClient.ts` has modes `cookie` (credentials include plus X-MM-App), `app` and `public`. Rejections are plain `AuthError`.
- Error type: `src/lib/identity/types.ts` has the `AuthErrorCode` union.
- Error allow-list: `src/lib/identity/errors.ts` has `SERVER_AUTH_ERROR_CODES`. The union and the allow-list are separate, so every new code goes in both.
- Error copy: `src/ui/copy/auth.ts` has `authCopy.errors` with `satisfies Record<AuthErrorCode, …>` (compile-time exhaustive) and `authErrorMessage`. `src/ui/copy/auth.test.ts` exists. UI copy must also pass `no-literals.test.ts` (D36).
- Token store: `src/ui/auth/tokenStore.ts` has `signIn`, `continueAs` (account only, no org), `selectOrg(orgId)` (mints with `org_id`, then remembers the org per account) and `accountId()`. The shared `AuthRuntime` (`getAuthRuntime()`) has `{client, store, apiFetch}`.
- Gate: `AuthGate` auto-enters the remembered org via `decideOrg`, then `/api/me`, which creates the member row on first visit (D16a) and may show the profile screen.
- Error mapping for `/api` calls: `createApiFetch` re-sends once on 401/403 (R7). `src/lib/api/error.ts` `API_ERROR_CODES` has no `not_allowed` yet.
- Members page is still `PageSkeleton` (`src/app/(app)/members/page.tsx`). SIM-011.2 (BACKLOG) will replace it with `MembersPage`, including the read-only pending-invitations section. SIM-009 owns writing and recording; the list UI is SIM-011.2.

**High paths check.** Per `.github/risk-tiers.yml` and the ticket's file list, this ticket needs none of `src/proxy.ts`, `next.config.ts`, `src/server/http/**`, `src/server/identity/**`, `db/migrations`, `**/config.*`, `.env.example`. The table already exists, so there is no migration. `src/server/invitations/*` and `src/app/api/invitations/*` are Medium, tests are Low.
- The one place a High path could be forced is the "`Referrer-Policy: no-referrer` header" in the ticket (see Recommendation 3).
- CSP needs no change: `connect-src` already includes the Identity origin, which is what the browser calls for invite and accept.
- Do not add `src/lib/identity/config.ts`-style files named `config.*` (High glob).

### Recommendations

1. **Role options per tier (AC1, unit test).**
   - Add a pure `invitableRoles(tier)` in `src/lib/invitations/` (lib layer): user returns `[]`, manager returns `["simap:user"]`, admin returns `["simap:manager","simap:user"]`. Never include `simap:admin`, even though the DB check allows it.
   - Add a `canInviteRole(tier, role)` that the server and UI both use, with exact-key matching and tests for `simap:admin`, `simap:member`, `simap:org:invite` and junk strings (as `tier.test.ts` does).
   - The form hides the roles above the inviter's. The server also enforces it: do not trust the UI.
   - Default to a single option when only one exists (Manager).
   - Whether the Identity role value is `simap:manager` or the bare `manager` is unknown (contract). Keep a single mapping function.
   - Add an email validator in `src/lib/validate/` (trim, a length cap, one `@`). `credentials.ts` may already have an email rule to reuse.

2. **Server side (R6, R7).**
   - Add `POST` under `src/app/api/invitations/route.ts` (the ticket's file list), or put it in the existing `src/app/api/members/invitations/route.ts` next to the GET. The second keeps one route family and is cheaper. Flag this to the planner and pick one.
   - Wrap it with `withAuth(..., {tier:"manager"})`. Role-above-tier is a domain refusal: 409 `not_allowed` (or 422), never 403 from inside the handler (R7). Bad body gives 422/`invalid_request`. Add the new code to `API_ERROR_CODES` and `src/lib/api/error.ts` tests. Check any copy map for API codes in `src/ui/copy/api.ts`.
   - Every write is scoped with `ctx.scope` (`orgQuery`), and `invited_by_sub` comes from `ctx.sub`.
   - The write is an upsert on `(org_id, lower(email)) where status='pending'`, because a re-invite hits the unique index. Refresh `role`, `expires_at`, `created_at` and `identity_invitation_id`.
   - Never store or log the token. Do not echo it in responses.
   - Place the logic in `src/server/invitations/` (first line `import "server-only"`).

3. **Who calls Identity, and ordering.**
   - Inviting is a cookie-class call from the browser: `client.invite(orgId, accountId, {email, role})`, added to `IdentityClient` with a parser that returns only `{invitationId, expiresAt}`.
   - After Identity succeeds, the browser calls simap's POST to record it. If the record fails, the invitation was already sent: show a warning "invitation sent, but it may not appear in the list" rather than an error, and allow a retry that does not re-invite. Do not record first.
   - Consequence: the simap record is client-reported. The Manager/Admin could forge a list row. That row is display-only (D16a), so treat it as acceptable and say so in the plan.
   - Accepted invitations stay `pending` in simap because Identity does not tell simap. SIM-011's list hides rows past `expires_at`, but rows with `expires_at null` stay forever. Options: (a) mark the row `accepted` lazily when the member row is created for that email, in the first-visit code (`src/server/members/*`, small), or (b) leave it as a follow-up. Default to the follow-up and write it down (R4); do not add a migration.

4. **`/accept-invitation` page.**
   - Add `src/app/accept-invitation/page.tsx`: static, no props, `metadata = { title, referrer: "no-referrer" }`, rendering `AcceptInvitationPage` from `@/ui`. Add it to `account-pages.test.ts`.
   - **Referrer:** use the meta tag as the four account pages do (D9, Q34). A real `Referrer-Policy` response header would need `next.config.ts` (High) or the proxy (High). The token is in the fragment, which is never sent in `Referer`. Say in the plan that AC2 "referrer" is met by the meta tag plus the fragment, and that the site-wide header stays `strict-origin-when-cross-origin`. If Ming insists on the header, that makes this High and needs plan approval.
   - **Token handling:** reuse `takeLinkToken(window, "/accept-invitation")` in a mount effect, store the token in a `useRef` only (never state, URL, log, error text). This satisfies "cleared at once".
     - Check the token regex against the real invitation token shape (contract). If it differs, add a sibling reader in `email-link.ts` with its own tests rather than loosening the existing one.
     - A `?token=` query is ignored and stripped.
     - A missing or invalid hash shows an "invalid link" view. No network call on load.
   - **Flow (state machine in `src/lib/identity/` so it is unit-testable without jsdom, like `email-flows.ts`):** `checking`, then `needSignIn`, then `ready` (signed in, email known), then `accepting`, then `done` or `invalid`.
     - If a session exists (`store.accountId()`), show "Accept as <email>" plus "Use another account". Otherwise show sign-in with a link to sign-up.
     - Do not wrap the page in `AuthGate`: `AuthGate` renders the app. Build on `SignInView` and `SignUpView` from `account-views.tsx`.
     - After sign-in (`store.signIn`), call accept from the button click only.
   - **Invited-email constraint:** the page cannot know the invited address unless Identity returns it. If it does not, the mismatch is detected only by the accept call. Do not guess or trust a client-side address. If the contract exposes the email, prefill and lock it (`SignInView` supports `initialEmail`).
   - **Accept call:** `client.acceptInvitation({token, accountId})` in cookie mode, posting the token in the body only.
     - On mismatch the token is **not** consumed: keep the ref, show the mismatch message, and offer "Use another account" (`store.forget()` then the sign-in form). A test must pin that the token stays in the ref after the mismatch outcome and is cleared on success and on invalid.
     - On success, call `store.selectOrg(orgId)`. `selectOrg` mints with `org_id` and remembers the org, so the gate then auto-enters it. If the accept response does not return `org_id`, fall back to `client.orgs()`. Then navigate to `/` with `location.assign`, not `router.push`, to drop in-memory state. The new member row and the profile screen come from the gate (D16a). This is AC4.
   - **Sign-up detour:** the verify-email link lands on `/verify-email`, and the invitation token is already cleared. Add copy telling a new user to verify their email and then open the invitation link again. Do not persist the token anywhere to avoid this (AC2). This must be an explicit decision in the plan.
   - Add a Turnstile `data` pass-through only if sign-in demands it (the gate handles `turnstile_required`); reuse `TurnstileWidget` as in `SignUpPage`.

5. **Error-code copy.**
   - Once the contract is known, extend `AuthErrorCode` and `SERVER_AUTH_ERROR_CODES` together with `authCopy.errors` (the `satisfies` forces completeness), and update `auth.test.ts` and `errors.test.ts`.
   - Reuse existing codes where they already apply (`token_invalid` gives the "not valid or has expired" message, `session_invalid`, `rate_limited`, `validation_error`, `org_access_denied`).
   - Expect new ones for invitation-not-found/expired/used, email mismatch, already a member, inviter lacking `simap:org:invite`, and role above the inviter. All stay English copy from the copy file (D36). Create `src/ui/copy/invitations.ts` for form labels and role labels; keep the error strings in `auth.ts`.
   - Never echo server text or the typed email in messages (existing rule of `authErrorMessage`).
   - Route the accept outcome through a pure function like `resetOutcome`. Mismatch returns `{kind:"ready", clearToken:false}`. `token_invalid` and `validation_error` return `invalid` and clear the token. Reuse of the verify/reset pattern keeps it consistent.

6. **Invite form.**
   - Put an `InviteDialog` (built on `EntityFormDialog`) in `src/ui/invitations/`, exported from `src/ui/index.ts`. It has an email field, a role select from `invitableRoles(session.tier)`, a submit button, inline `aria-live` error and a success note ("Invitation sent to …", or the warning from 3).
   - Show the "Invite" action only when `invitableRoles(tier).length > 0` (user tier gets nothing).
   - Mount: `members/page.tsx` is `PageSkeleton` today and SIM-011.2 will replace it. Keep the SIM-009 change to a small `InvitePeople` block (button plus dialog) in the page, and tell SIM-011.2 to include it. Do not build the pending list here (SIM-011.2 scope).
   - Use `useApiFetch()` from `api-fetch-context` for the record call, and the runtime `client` for the Identity call.
   - Add a `session.orgId` to the invite call: the org id comes from `store.orgId()`; check that the form can obtain it without widening the `Session` shape. Do not read the org from the token in the UI.
   - Handle Identity 403s without sign-out: a mapped message, not an `ApiAccessError`.

7. **Testability (R5: no PASS without green checks).**
   - Pure and unit-tested (no jsdom): `invitableRoles`/`canInviteRole`, email validator, `acceptOutcome`/error-to-copy mapping, the link-token reader, the accept flow reducer, and the record-after-invite outcome mapping.
   - Client tests with a fake `fetchFn` (existing `identityClient.test.ts` pattern): invite and accept bodies, token only in the body, `credentials`, parsing and rejection of odd bodies.
   - Server tests: route guarded (`routes-guarded.test.ts` should auto-cover the new route); role-above-tier gives 409/`not_allowed`; Manager inviting manager is refused; User gets 403 from the wrapper; the upsert and org scoping in a `.db.test.ts` (runs under `pnpm test:db`, CI only).
   - Page test: extend `account-pages.test.ts` (`metadata.referrer`, non-empty title, zero props). Static-markup view tests as in `account-views.test.tsx`. A token-never-in-DOM/URL assertion on the view output.
   - Manual: a second account end to end, only possible once M-1 is done (`join_policy = open`, org owner role set, dev origin registered).

### Risks
- **The contract is missing.** Everything marked "unknown" above can break the plan. Block planning on getting it, or plan with a clearly isolated adapter in `identityClient.ts` and flag the parser as unverified, as was done for `/auth/orgs`.
- **Mail and sign-up detour:** a brand new invitee loses the token during email verification. Without clear copy this looks like a bug. Accepted trade-off of AC2.
- **Referrer:** if "header" in the ticket is read literally, this ticket becomes High (config/proxy), and the plan gate applies. The meta tag is the repo's accepted precedent.
- **Referrer and Turnstile:** `no-referrer` on a page that uses Turnstile (sign-up on `/accept-invitation`) may affect hostname checks. A manual check was already assumed for the other pages in SIM-006.3 A3.
- **Stale pending rows** and forged client-reported rows (see 3). Both are display-only.
- **Mismatch must not consume the token:** that is Identity's behavior, not simap's. The UI must not call accept speculatively (only on click), or a wrong-account click could still be treated as consumed if Identity differs from the ticket. Confirm with Identity docs.
- **Role drift:** the DB allows `simap:admin` in `invitations.role`, so the server validator is the only guard against it.
- **Overlap with SIM-011.2** on `members/page.tsx`: merge conflict risk. Keep the SIM-009 edit to a minimal block.
- A late 401/403 after the Identity call but before the record call can repeat the record via `apiFetch` re-send; the upsert keeps that idempotent.

### Open questions
1. Exact request and response shapes, auth class (cookie plus `account_id`?), and error code list for `POST /auth/orgs/{org_id}/invitations` and `POST /auth/invitations/accept` (paste from `consumers.md`).
2. Does the accept response return `org_id`? Does Identity reveal the invited email before sign-in (for prefill)?
3. Token format and length for the fragment regex (`#token=` per the contract?).
4. Is the Identity role value `simap:manager` or `manager`? Can an Admin invite an Admin (ticket says no)?
5. Referrer: is the meta tag (D9/Q34 precedent) acceptable for AC2, or does Ming want a real header (High path, plan approval)?
6. Sign-up detour: accept "open the link again after verifying" as the behavior?
7. Pending rows after acceptance: lazy `accepted` marking now (touching first-visit code) or follow-up?
8. Route location: `/api/invitations` (ticket) or the existing `/api/members/invitations` POST?
9. Should User tier see the invite entry point at all (default: no)? And does the invite form need Turnstile? (Not for a signed-in call, per the contract unknown.)

Key files: /home/user/simap/work/tickets/SIM-009/ticket.md, /home/user/simap/src/lib/identity/email-link.ts, /home/user/simap/src/ui/auth/identityClient.ts, /home/user/simap/src/ui/auth/tokenStore.ts, /home/user/simap/src/ui/auth/VerifyEmailPage.tsx, /home/user/simap/src/ui/auth/runtime.ts, /home/user/simap/src/lib/identity/errors.ts, /home/user/simap/src/lib/identity/types.ts, /home/user/simap/src/ui/copy/auth.ts, /home/user/simap/src/app/account-pages.test.ts, /home/user/simap/src/app/api/members/invitations/route.ts, /home/user/simap/src/server/members/manage.ts, /home/user/simap/src/lib/api/error.ts, /home/user/simap/src/lib/auth/tier.ts, /home/user/simap/db/migrations/20261120150000_init.sql, /home/user/simap/.github/risk-tiers.yml.
