# SIM-009.2: Accept-invitation page

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | security, ui |
| Gate | none |
| Depends on | SIM-009 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | — |

## Goal
Invitees accept an org invitation on simap's `/accept-invitation` page and land in the org as a new member. Slice 2 of SIM-009 (split proposed in `work/tickets/SIM-009/plan.md` → *Split proposal*).

## Scope reference
spec AUT-03; D11, D14, D16 (a), D53 (referrer meta tag). Identity contract: org-admin-api `docs/consumers.md` "Invitations (USR-06b, ADR-0014)".

## Scope
- `src/app/accept-invitation/page.tsx` (thin, `metadata.referrer: "no-referrer"`), `AcceptInvitationPage` UI, `client.acceptInvitation`, pure `acceptOutcome` flow; outline in SIM-009 plan *Split proposal*.

## Out of scope
- Invite form and recording (SIM-009); revoking invitations; marking invitations accepted on first visit (follow-up A4).

## Acceptance criteria
- [ ] The invitation token never stays in the URL, history, logs or a referrer.
- [ ] Accepting with a different email shows the mismatch message and does not consume the token.
- [ ] After accepting, the user lands in the org as a new member.
- [ ] Unit tests cover fragment handling and the accept outcome mapping.

## Technical notes
- Files: `src/app/accept-invitation/*`, `src/ui/auth/AcceptInvitationPage.tsx`, `src/ui/auth/identityClient.ts`, `src/lib/invitations/accept-flow.ts`.
- Risks / open questions: until this merges, invitation email links 404; do not send real invitations before then. Manual test needs M-1.

## Test plan
- Unit: fragment handling, accept outcome, client body/parse.
- Manual: invite a second account end to end.

## Notes / answers from Ming
—

## Handoff
