# SIM-011: Members page, profile fields and deactivation

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | api, ui, security |
| Gate | none |
| Depends on | SIM-007 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Managers see the org's members and their footprint, edit simap fields, and deactivate or reactivate members without touching Identity accounts.

## Scope reference
spec MEM-01, MEM-02; D12, D16 (a), D17, D34.

## Scope
- Members list (search, bounded pages) with seats and devices per member; pending invitations section (from SIM-009 data if present).
- Manager+ edits display name, employee code (unique per org), group.
- Deactivate / reactivate (Manager+): feeds the SIM-005 deny list; warns with counts and offers to release seats and return devices in the same step.
- No delete action; text says accounts are managed in mmlabs.

## Out of scope
- Removing from the org and syncing from Identity (SIM-020).

## Acceptance criteria
- [ ] A deactivated member's next API call to org data is refused; reactivation restores access.
- [ ] Deactivating a member with seats/devices shows the counts and, on confirm, releases them in one transaction with DEV-06 demotion.
- [ ] Employee code is unique within the org.
- [ ] Users see the list read-only; Managers see edit actions.
- [ ] Unit tests cover the deactivation impact and validation.

## Technical notes
- Files: `src/server/members/*`, `src/app/api/members/**`, `src/app/(app)/members/*`, `src/ui/members/*`; reference seatMGT `src/lib/actions/members.ts`, `MemberCard.tsx`.
- Risks / open questions: Deny list must be checked per request (no caching beyond the request).

## Test plan
- Unit: impact calculation, validation.
- Manual: deactivate a member who holds a seat.

## Notes / answers from Ming
—

## Handoff
