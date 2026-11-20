# SIM-020: Sync members from Identity and remove from org

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P3 |
| Size | M |
| Areas | api, security |
| Gate | plan-approval |
| Depends on | SIM-011 |
| Needs Ming | M-4 |
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
- Risks / open questions: Blocked until org-admin-api ships the endpoints (M-4).

## Test plan
- Unit: sync diff.
- Manual: sync against Identity.

## Notes / answers from Ming
—

## Handoff
