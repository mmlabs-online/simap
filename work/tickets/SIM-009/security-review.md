# Security review — SIM-009

## Attempt 1

## Security review: SIM-009 slice 1, attempt 1

**Verdict: no blockers (🔴 none). Two should-fix items, both small (🟡), and four notes (🟢).** I only read code. I had no Bash, so I did not run `git diff` or the checks. I read every file in the change list, plus the helpers it relies on: `orgQuery`, `withAuth` logging, `emailError`, the `invitations` migration and `toAuthError`. I also checked the code against the Identity contract in `/home/user/mmlabs-online/org-admin-api/docs/consumers.md` lines 174-213.

### Findings

🟡 **1. No server-side limit on records, so a Manager can fill their org's pending list without bound.**
- **Where:** `/home/user/simap/src/app/api/invitations/route.ts:12-25` and `/home/user/simap/src/server/invitations/record.ts:31-39`.
- **Risk:** Identity limits each inviter to 5 invites a day (consumers.md:200). simap's record route does not check that the invitation exists at Identity, which plan A3 accepts. So a Manager or a stolen Manager token can post any number of made-up `{email, identityInvitationId}` rows, each one a new pending row. That bloats the table and hides real entries in the MEM-01 list.
- **Scope of harm:** it stays inside the caller's own org (R6 holds, and `org_id` comes from `ctx.scope`). Each row is audited, and nothing uses these rows for access. Severity is low, but it is the one abuse path the "client-reported record" design opens.
- **Fix (one commit, or a follow-up if Ming prefers):** before the upsert, count the inviter's records in the last 24 h:
  ```sql
  select count(*) from invitations
  where org_id = $1 and invited_by_sub = $2::uuid and created_at > now() - interval '1 day'
  ```
  Refuse with 422 `not_allowed` above a cap of about 50. Use 422, never 429/403, because R7 reserves 401/403 for the auth wrapper.

🟡 **2. The record can overwrite a pending row created by someone with a higher role.**
- **Where:** `/home/user/simap/src/server/invitations/record.ts:34-37`.
- **Risk:** the `on conflict … do update` sets `role` and `invited_by_sub` no matter who wrote the existing row. A Manager can post `simap:user` for an address an Admin invited as `simap:manager`. The list then shows the Manager as inviter and `user` as the role, while Identity may still hold the Admin's invitation (if the Manager never really re-invited, since A3 allows client-only records).
- **Scope of harm:** this matches Identity's own rule that any member holding `org:invite` can supersede (consumers.md:210-211), so it is not privilege escalation. But the read-only list can then misreport what Identity holds, and the audit meta does not record what was replaced.
- **Fix:** add the previous values to the audit row so the change can be traced. Use a CTE that reads the old `role`/`invited_by_sub` before the upsert and put them in `meta: {role, previousRole}`, with no email. Or accept the behaviour and say so in the PR text.

🟢 **3. Rows that differ only by Unicode normalization (NFC vs NFD) are not merged.**
- **Where:** `/home/user/simap/src/lib/validate/invitation.ts:15-18`.
- **Detail:** `normalizeInviteEmail` trims and lowercases but does not apply `.normalize("NFC")`. Two spellings of the same Vietnamese local part (NFC vs NFD) bypass `invitations_org_pending_email_key` and give duplicate pending rows. This is only a list-hygiene problem, not a security one.
- **Fix:** `v.trim().normalize("NFC").toLowerCase()`, plus one test row.

🟢 **4. The org used for the Identity invite and the org used for the record come from two places.**
- **Where:** `/home/user/simap/src/ui/invitations/InvitePeople.tsx:66-69` and `:75`.
- **Detail:** the Identity invite uses `rt.store.orgId()`. The simap record is scoped by the bearer token's `org` claim. Both come from the same in-memory store in the tab, so they agree in practice. If they ever differed, the record would land only in the caller's own verified org, never in another org (R6 holds).
- **Fix:** none needed.

🟢 **5. Points I verified that need no change:**
- **R7:** every refusal happens before the write: 503 `route.ts:15`, 400 `:17,:19`, 422 `role_not_allowed` `:20`. The only 401/403 come from `withAuth({tier:"manager"})`. The upsert makes `apiFetch`'s single re-send on 401/403 harmless.
- **R6:** the insert binds `scope.orgId` as `$1` through `orgQuery` (`record.ts:22-40`). The inviter is `ctx.sub` and the role check uses `ctx.tier`, which comes from `org_roles`. Body fields never decide org, inviter or tier.
- **Role ceiling:** `canInviteRole` is an exact-string check (`roles.ts:19-21`). The validator also rejects `simap:admin` (`invitation.ts:37`), which matters because the DB check constraint would accept it.
- **R1:** the UI imports only `@/lib` and `../*`. The route is the only importer of `src/server/invitations`, and `record.ts:1` has `import "server-only"`.
- **R3 and PII:**
  - No env vars, secrets or logs added. The audit meta is `{role}` only (`record.ts:47`).
  - `withAuth` logs only `{event, code}` (`with-auth.ts:84`), so pg error text never reaches the logs.
  - The invite token never reaches simap. The Identity 201 response has no token, and the parser reads only `id`/`org_id`/`role`/`expires_at` (`identityClient.ts:263-275`).
- **Identity call:**
  - It uses cookie mode with `credentials: "include"`, `X-MM-App`, no Authorization header and `no-store`.
  - `orgId`/`accountId` must be UUIDs and are URL-encoded.
  - The response is parsed strictly, and the parser checks that the returned `org_id`/`role` match what was requested.
  - Identity 403s go around `apiFetch`, so they cannot sign the user out.
- **Error display:** error codes are whitelisted by `SERVER_AUTH_ERROR_CODES` (`errors.ts:25-30`), and server error text is never shown. The notices render as React text (`InviteDialog.tsx:46-51`), with no `dangerouslySetInnerHTML`.
- **`expiresAt`:** it must carry a timezone, is bounded to [now − 60 s, now + 31 d] and is stored as UTC (`invitation.ts:41-49`).

🟢 **6. Out of scope for this slice (slice 2):** the accept page must clear the fragment, set `no-referrer` and keep the token only in a ref, as the plan's split proposal says.

### Follow-ups (out of scope, R4)
- Finding 1: a per-inviter daily cap on `POST /api/invitations`, if not fixed in this PR.
- Plan A4/Q7: mark rows `accepted` or expired so stale pending rows drop out of the list.
- SIM-009.2: the security checklist for the accept page (fragment cleared with `history.replaceState`, `metadata.referrer: "no-referrer"`, token never in state, URL or log).

### Files reviewed
- /home/user/simap/src/app/api/invitations/route.ts
- /home/user/simap/src/server/invitations/record.ts
- /home/user/simap/src/lib/validate/invitation.ts
- /home/user/simap/src/lib/invitations/roles.ts
- /home/user/simap/src/ui/auth/identityClient.ts
- /home/user/simap/src/ui/invitations/InvitePeople.tsx
- /home/user/simap/src/ui/invitations/invitations-api.ts
- /home/user/simap/src/ui/invitations/InviteDialog.tsx
- /home/user/simap/src/lib/identity/errors.ts
- /home/user/simap/src/app/(app)/members/page.tsx
- /home/user/simap/db/migrations/20261120150000_init.sql (lines 190-206)
- /home/user/simap/src/server/http/org-scope.ts
- /home/user/simap/src/server/http/with-auth.ts
