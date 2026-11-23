# SIM-015.8: Layout editor desk add and delete

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | S |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-015.7, SIM-015.9 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-23 |
| Claimed by | claude@2026-11-23T13:05:15Z |
| PR | — |

## Goal
Slice 3 of 3 of the tile layout editor: an Admin places a new `desk.single` from the palette and deletes desks; Save
runs the A3 sequence (DELETE removed seats, POST new seats, then PUT the layout).

## Scope reference
spec LAY-02, SEA-01, ROO-02; SIM-015.2 `plan.md` → Split proposal (slice 3) and assumption A3 (approved 2026-11-23).

## Scope
- Palette desk placement and desk delete in the editor; Save sequence with partial-failure messages (a refused DELETE
  restores the desk and stops before the PUT; seats created before a failed PUT are shown as unplaced).

## Out of scope
- Anything else in the editor (SIM-015.7).

## Acceptance criteria
- [ ] Adding a desk creates seat `<room>-NN` with the next number after Save.
- [ ] Deleting a desk whose seat has an occupant or device is refused with the SEA-01 message and the desk comes back.
- [ ] Component tests for the Save sequence use a fake `seatsApi`.

## Technical notes
- SEA-01 refusal is 409 `seat_not_empty` (`src/server/seats/seats.ts`); copy exists in `src/ui/copy/api.ts`.

## Test plan
- Component: Save sequence (fake `seatsApi`). Manual: add and delete desks, incl. one with an occupant.

## Notes / answers from Ming

## Handoff
