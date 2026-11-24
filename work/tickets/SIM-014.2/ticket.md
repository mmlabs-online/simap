# SIM-014.2: Approvals page UI

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-014.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | claude@2026-11-24T09:15:28Z |
| PR | — |

## Goal
Slice 3 of 4 of seat requests: Managers review requests on the Approvals page and approve or reject them.

## Scope reference
spec REG-01, REG-02; D21, D23, D24, D26. Split out of SIM-014 by its approved plan (`work/tickets/SIM-014/plan.md` → Split proposal).

## Scope
- `src/app/(app)/approvals/page.tsx` (replace the stub), `src/ui/requests/requests-api.ts`, `requests-state.ts`, `useRequests.ts`, `ApprovalsView.tsx`.
- Status filter in `?status=`; Approve and Reject confirm dialogs; per-row busy state; list reloads after a decision.

## Out of scope
- Email notifications (D24). Polling or push.

## Acceptance criteria
- [ ] The Approvals page lists requests with a status filter (default pending).
- [ ] Approve and Reject go through a confirm dialog and refresh the list; refusals show their message.
- [ ] Static-render and pure-logic tests (no jsdom) cover the view, the filter and the action outcomes.

## Technical notes
- Builds on `src/lib/requests/*`, `src/server/requests/*` and `src/app/api/requests/**` from SIM-014. UI copy in `src/ui/copy/requests.ts` (D36).

## Test plan
- Unit: requests-state, requests-api; static render of ApprovalsView.
- Manual: request → approve with two rival requests.

## Notes / answers from Ming
—

## Handoff
