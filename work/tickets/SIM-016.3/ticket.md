# SIM-016.3: Tag and untag a seat from the seat detail

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P2 |
| Size | S |
| Areas | ui, api |
| Gate | none |
| Depends on | SIM-016 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | claude@2026-11-24T11:25:17Z |
| PR | — |

## Goal
Managers set or clear a seat's group and project from the seat panel.

## Scope reference
spec SEA-04; D36. Split out of SIM-016 by its plan (`work/tickets/SIM-016/plan.md` → Split proposal).

## Scope
- A "Tags" button in the seat panel (`seat-actions.ts` / `SeatActions.tsx`), hidden for the User tier (UX only; the API enforces).
- A small tags dialog with group and project selects in `src/ui/seats/`; `seats-api.ts` method for `PATCH /api/seats/[id]/tags`; copy in `src/ui/copy/seats.ts`.

- Server fix carried over from SIM-016 (review Issue 1, security 🟢1; Ming kept the default "fix in SIM-016.3", 2026-11-24): `setSeatTags` (`src/server/seats/seats.ts`) locks the group/project only when it changes to a non-null id, and the "cannot deadlock" comment in `src/server/groups/groups.ts` is corrected. Add a DB test for tag write vs forced delete if cheap.

## Out of scope
- Groups/Projects management (SIM-016.2). Any other server or API change.

## Acceptance criteria
- [ ] A Manager sets and clears a seat's group and project; the seat shows the new tags.
- [ ] A tag write on a seat whose group is unchanged no longer locks that group (no deadlock with a forced delete).
- [ ] Users see no Tags button.
- [ ] Static-render and pure-logic tests (no jsdom) cover the button rule and the dialog.

## Test plan
- Unit: seat-actions rule, api method; static render of the dialog.
- Manual: tag and untag a seat.

## Notes / answers from Ming
—

## Handoff
