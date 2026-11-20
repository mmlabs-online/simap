# Request to org-admin-api: org members read and remove-from-org (from simap)

Status: to be filed by Ming in an org-admin-api session (`work/ming-todo.md` M-4). Decisions: simap D16 (b), D34.
Paste the block below into that session.

```text
/ticket "App-facing read of an org's members for org-mode apps (requested by simap) P1"

Context (from the simap project, an org_mode = required consumer like calechip):
- simap assigns seats and devices to people in an org. Every person must be an mmlabs Identity account (simap keeps no
  person records of its own). Today an app only learns about an account when that person opens the app, because the
  only org member list is the staff endpoint GET /api/v1/organizations/{org_id}/members (USR-23, Bearer aud=admin).
- simap needs its backend to list the members of one org for its own app, so Managers can assign seats to people who
  have not opened simap yet, and so simap can show display names.

Request:
- A server-to-server read, authenticated with the existing app credential (ADR-0016, `Authorization: Bearer mmak_…`),
  for example GET /api/v1/apps/{key}/orgs/{org_id}/members. The credential's app must equal {key}
  (403 app_credential_mismatch otherwise). This needs an ADR-0016 amendment, because class 4 is allowed today only on
  PUT /apps/{key}/manifest. Add the route to APP_CREDENTIAL in tests/test_route_auth_classes.py.
- Response: Page of { user_id (= token sub), email, email_verified, display_name, status (active/disabled),
  org_roles (role keys of {key} held in that org), joined_at }. Only users holding at least one org-scoped role of {key}
  in that org. Stable sort, the same pagination as other lists, Cache-Control: no-store, never log emails.
- Optional filters: updated_since (for incremental sync), status.
- Optional extra: the pending invitations of that org for {key} (id, role, expires_at; no invitee email or token,
  as USR-23).
- Errors: 404 for an unknown org, an org with no relation to {key}, or a suspended org (one answer, as
  org_access_denied); 422 org_not_supported for org_mode = none apps; per-credential rate limit.
- Audit: one audit row per call (actor_kind app), without the response body.

Second request (same ticket or a follow-up, your call):
- Let an org member holding a new permission `<app>:org:members:remove` (simap gives it to its org owner role
  simap:admin) remove another member's org-scoped roles of that app in that org. Cookie class like invitations
  (POST /api/v1/auth/orgs/{org_id}/members/{user_id}/remove {account_id}), or app credential; your call.
- Never deletes or disables the account (only the admin portal does that). Cannot remove the last holder of the org
  owner role, nor yourself. Audited. Takes effect on tokens at `exp` (documented revocation lag).
- Out of scope: role changes from the app (admin portal only for now).

Acceptance (draft):
- With simap's credential, simap gets the members of an org where people hold simap org roles; another app's
  credential gets 403; an admin JWT is refused on this route.
- A user with no simap org role in that org is not listed; a disabled user is listed with status disabled.
- The contract is documented in docs/consumers.md (section "Organizations").

Alternative to weigh: a `name` claim in access tokens (display_name), as a smaller first step for the name only.
```
