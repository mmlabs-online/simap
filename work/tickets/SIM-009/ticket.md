# SIM-009: Invite people to an org

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | security, ui, api |
| Gate | none |
| Depends on | SIM-007 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-22T04:55:31Z |
| PR | — |

## Goal
Org admins and managers invite people by email with a role, and invitees accept on simap's `/accept-invitation` page.

## Scope reference
spec AUT-03, MEM-01 (pending invitations); D11, D14, D16 (a).

## Scope
- Invite form (Admin: user or manager; Manager: user) calling `POST /auth/orgs/{org_id}/invitations`; never offer a role above the inviter's.
- `/accept-invitation` page per contract: token from fragment, cleared at once, `Referrer-Policy: no-referrer`, sign in or sign up with exactly the invited address, `POST /auth/invitations/accept`, then token with `org_id`.
- simap records the invitations it sent (email, role, inviter, time; no token) for the "Pending invitations" list.
- English messages (copy files, D36) for every documented error code.

## Out of scope
- Revoking invitations, member removal (later, needs Identity endpoints).

## Acceptance criteria
- [ ] A Manager can invite only as user; an Admin as user or manager.
- [ ] The invitation token never stays in the URL, history, logs or a referrer.
- [ ] Accepting with a different email shows the mismatch message and does not consume the token.
- [ ] After accepting, the user lands in the org as a new member.
- [ ] Unit tests cover role options per tier and error-code mapping.

## Technical notes
- Files: `src/ui/invitations/*`, `src/app/accept-invitation/*`, `src/server/invitations/*`, `src/app/api/invitations/*`.
- Risks / open questions: Needs M-1 with invitations enabled (`join_policy = open`, org owner role set).

## Test plan
- Unit: role options, error mapping, fragment handling.
- Manual: invite a second account end to end.

## Notes / answers from Ming
—

## Handoff
