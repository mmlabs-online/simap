# SIM-014: Seat requests and approvals

| Field | Value |
|---|---|
| State | BLOCKED |
| Priority | P1 |
| Size | M |
| Areas | api, ui, ux |
| Gate | plan-approval |
| Depends on | SIM-012 |
| Needs Ming | M-32 |
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
Waiting for Ming: plan approval (P1 policy)

## Handoff

### 2026-11-24 — claude — BLOCKED (plan approval)
- Agent calls: 3, tokens ~183k total (api-platform-engineer×1 inherit 38k, frontend-developer×1 inherit 64k, planner×1 inherit 81k; in/out split not reported)
- Done: Gate set to plan-approval (P1 policy); consults saved (ux skipped: max 2 consultants); plan.md READY as slice 1 of 4 (state machine and write API; no migration, no High path).
- In progress / next: Ming approves (M-32). Then the orchestrator re-scopes this ticket to slice 1 and files SIM-014.1 (read API), SIM-014.2 (Approvals UI), SIM-014.3 (request button, My requests, badge).
- Gotchas: slice 1 changes `src/server/seats/seats.ts` (exports, `writeOccupant`); SIM-013 (PR #57) does not touch seats.ts but both append to `src/lib/api/error.ts` and `src/ui/copy/api.ts` (trivial rebase).
