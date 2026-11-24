# SIM-014.2: Approvals page UI

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-014.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/65 |

## Goal
Slice 3 of 4 of seat requests: Managers review requests on the Approvals page and approve or reject them.

## Scope reference
spec REG-01, REG-02; D21, D23, D24, D26. Split out of SIM-014 by its approved plan (`work/tickets/SIM-014/plan.md` → Split proposal).

## Scope
- `src/app/(app)/approvals/page.tsx` (replace the stub), `src/ui/requests/requests-api.ts`, `requests-state.ts`, `useRequests.ts`, `ApprovalsView.tsx`.
- Status filter in `?status=`; Load more with `nextCursor`; no-access view for the User tier. (Re-scoped by the approved plan: read-only list, slice 1.)

## Out of scope
- Email notifications (D24). Polling or push.
- Approve and Reject confirm dialogs, per-row busy state, reload after a decision: moved to SIM-014.4 (approved split, 2026-11-24).

## Acceptance criteria
- [ ] The Approvals page lists requests with a status filter (default pending).
- [ ] Static-render and pure-logic tests (no jsdom) cover the view and the filter.
- (moved to SIM-014.4: Approve and Reject go through a confirm dialog and refresh the list; refusals show their message; tests cover the action outcomes.)

## Technical notes
- Builds on `src/lib/requests/*`, `src/server/requests/*` and `src/app/api/requests/**` from SIM-014. UI copy in `src/ui/copy/requests.ts` (D36).

## Test plan
- Unit: requests-state, requests-api; static render of ApprovalsView.
- Manual: request → approve with two rival requests.

## Notes / answers from Ming
- 2026-11-24: Plan approved (all defaults, split into SIM-014.2 + SIM-014.4; Ming: "duyệt plan SIM-014.2"). Ticket re-scoped to slice 1 (read-only list); SIM-014.4 filed on the board.

## Handoff

### 2026-11-24 — claude — BLOCKED
- Agent calls: 3, tokens ~155k total (frontend-developer×1 default 40k, ux-architect×1 default 45k, planner×1 default 70k)
- Done: consults (frontend-developer, ux-architect), plan.md Status READY with a split proposal: SIM-014.2 = read-only Approvals list (~450 src + ~350 test lines); SIM-014.4 = approve/reject dialogs and outcomes.
- In progress / next: Ming approves the plan and the split (M-39). On approval: file SIM-014.4 on the board (after SIM-014.2), narrow this ticket's AC2/AC3, then IMPLEMENT.
- Gotchas: SIM-014.3 also extends `requests-api.ts`, `copy/requests.ts` and `ui/index.ts`; whichever runs second rebases.

### 2026-11-24 — claude — DONE
- Agent calls: 2, tokens ~103k total (implementer×1 default 55k, reviewer×1 default 49k)
- Done: slice 1 implemented (18 files, +1157/−16), review PASS with no issues, all checks green, PR #65 opened. SIM-014.4 filed for the dialogs.
- In progress / next: Ming merges PR #65. Then SIM-014.4 (dialogs, uses the `actions` slot) or SIM-014.3 (both extend `requests-api.ts` and `copy/requests.ts`).
- Gotchas: none new.
