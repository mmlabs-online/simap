# SIM-014.3: Request a seat, My requests and nav badge

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-014.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | — |

## Goal
Slice 4 of 4 of seat requests: Users request an empty seat from the seat panel, follow their requests and see a badge for newly decided ones.

## Scope reference
spec REG-01, REG-02; D21, D23, D24, D26. Split out of SIM-014 by its approved plan (`work/tickets/SIM-014/plan.md` → Split proposal).

## Scope
- "Request this seat" in the seat panel (`seatButtons`, `actionOutcome`; Users only).
- `/requests` page (My requests) with Cancel on pending rows; nav entry `myRequests` in `src/lib/nav.ts`.
- `badges` prop on `AppShellView` and `useRequestBadge` (fetch on mount, route change and focus; no polling, D24); opening My requests marks them seen.

## Out of scope
- Email notifications (D24). Polling or push.

## Acceptance criteria
- [ ] A User sees "Request this seat" on an empty, seatable seat; a duplicate request shows "already requested".
- [ ] My requests lists the caller's requests with status, and Cancel works on pending ones.
- [ ] The nav badge shows the number of newly decided requests and clears after My requests is opened.
- [ ] Static-render and pure-logic tests (no jsdom) cover the button rules, the page and the badge.

## Technical notes
- Builds on `src/lib/requests/*`, `src/server/requests/*` and `src/app/api/requests/**` from SIM-014. UI copy in `src/ui/copy/requests.ts` (D36).

## Test plan
- Unit: seat-actions additions, badge state; static render of the views.
- Manual: request a seat, see it approved, badge appears and clears.

## Notes / answers from Ming
—

## Handoff
