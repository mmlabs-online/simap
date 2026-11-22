# SIM-009: Invite people to an org

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | security, ui, api |
| Gate | none |
| Depends on | SIM-007 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/37 |

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

### 2026-11-22 — claude — DONE
- Agent calls: 6, ~501k tokens (api-platform-engineer×1 opus 50.9k, frontend-developer×1 opus 96.7k, planner×1 opus 158.0k, implementer×1 opus 88.0k, reviewer×1 opus 54.0k, security-ai-generated-code-auditor×1 opus 54.0k; per-call in/out split not reported)
- Done: consult (api, ui), plan READY (no High path; Identity contract found in org-admin-api `docs/consumers.md`), slice 1 implemented in one attempt, review PASS with all checks green, security review no 🔴. PR https://github.com/mmlabs-online/simap/pull/37. Slice 2 is SIM-009.2 (accept page), on the board.
- In progress / next: Ming reviews and merges PR #37. Then SIM-009.2 and SIM-011.2 become runnable (SIM-011.2 is already runnable but shares `members/page.tsx` and `src/ui/index.ts` with this PR, so run it after the merge).
- Gotchas: invitation emails link to a 404 until SIM-009.2 merges. Security 🟡1/🟡2 are follow-ups. Worked on the session branch `claude/confident-cerf-67q5le`.

