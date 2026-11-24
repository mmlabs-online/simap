# SIM-020: Sync members from Identity and remove from org

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P3 |
| Size | M |
| Areas | api, security |
| Gate | plan-approval |
| Depends on | SIM-011 |
| Needs Ming | M-42, M-43 |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Managers can assign seats to org members who have not opened simap yet, and Admins remove people from the org from simap.

## Scope reference
spec MEM-01; D16 (b), D34.

## Scope
- Server-to-server sync from the app-facing members endpoint (app credential, secret in env only).
- Remove from org via the new Identity endpoint (Admin), with the D34 seat/device release.
- Mark members who left the org.

## Out of scope
- Changing roles from simap.

## Acceptance criteria
- [ ] Members appear in simap before their first visit after a sync.
- [ ] Removing a member releases their seats/devices and they lose org access at token expiry.
- [ ] The app credential never reaches the browser or logs.

## Technical notes
- Files: `src/server/identity/sync*`, `.env.example`.
- Contract: org-admin-api `docs/consumers.md` (USR-29 members read, USR-30 remove from org; both merged 2026-11-24).
  Read the contract there before planning; `docs/requests/org-admin-api-org-members.md` lists how it differs from the
  request: `org-members:read` runtime key (ADR-0025), permission `simap:org:remove-member`, remove answers
  `403 org_access_denied` for an unknown or suspended org (an upstream error, not a simap route code; map it to a
  simap domain refusal, R7), `member_outranks_caller`, and remove also revokes the member's pending invitations.
- Risks / open questions: Blocked until Ming does M-42 (key) and M-43 (permission). Display names from Identity and
  invitations in the members read are not shipped (org-admin-api follow-ups USR-31, USR-32).

## Test plan
- Unit: sync diff.
- Manual: sync against Identity.

## Notes / answers from Ming
—

## Handoff
