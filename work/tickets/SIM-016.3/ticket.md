# SIM-016.3: Tag and untag a seat from the seat detail

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-016 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | — |

## Goal
Managers set or clear a seat's group and project from the seat panel.

## Scope reference
spec SEA-04; D36. Split out of SIM-016 by its plan (`work/tickets/SIM-016/plan.md` → Split proposal).

## Scope
- A "Tags" button in the seat panel (`seat-actions.ts` / `SeatActions.tsx`), hidden for the User tier (UX only; the API enforces).
- A small tags dialog with group and project selects in `src/ui/seats/`; `seats-api.ts` method for `PATCH /api/seats/[id]/tags`; copy in `src/ui/copy/seats.ts`.

## Out of scope
- Groups/Projects management (SIM-016.2). Any server or API change.

## Acceptance criteria
- [ ] A Manager sets and clears a seat's group and project; the seat shows the new tags.
- [ ] Users see no Tags button.
- [ ] Static-render and pure-logic tests (no jsdom) cover the button rule and the dialog.

## Test plan
- Unit: seat-actions rule, api method; static render of the dialog.
- Manual: tag and untag a seat.

## Notes / answers from Ming
—

## Handoff
