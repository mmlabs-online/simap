# SIM-014: Seat requests and approvals

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | api, ui, ux |
| Gate | none |
| Depends on | SIM-012 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Users ask for an empty seat for themselves, Managers approve or reject, and users follow their requests in the app.

## Scope reference
spec REG-01, REG-02; D21, D23, D24, D26.

## Scope
- Request from an empty, seatable seat in any room, for self only; dedupe pending.
- Approvals page (Manager+): filter by status, approve (assign + reject rivals in one transaction), reject.
- "My requests" with status and a badge of newly decided requests; cancel own pending request.

## Out of scope
- Email notifications (D24: none).

## Acceptance criteria
- [ ] A second pending request for the same seat by the same member creates nothing.
- [ ] Approving seats the requester, demotes any primary and rejects all other pending requests for that seat.
- [ ] Requests for occupied or cannot-seat seats are refused.
- [ ] The requester can cancel only their own pending request.
- [ ] Unit tests cover the request state machine.

## Technical notes
- Files: `src/server/requests/*`, `src/app/api/requests/**`, `src/app/(app)/approvals/*`, `src/ui/requests/*`; reference seatMGT `src/lib/actions/requests.ts` + tests.
- Risks / open questions: —

## Test plan
- Unit: state machine.
- Manual: request → approve with two rival requests.

## Notes / answers from Ming
—

## Handoff
