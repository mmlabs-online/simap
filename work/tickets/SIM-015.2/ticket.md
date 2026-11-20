# SIM-015.2: Free-form layout editor

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-015.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Admins arrange seats and fixtures of a room on a free-form canvas and save it in one step, as in seatMGT's current editor.

## Scope reference
spec LAY-01, LAY-02, LAY-03, LAY-05, SEA-01; D20.

## Scope
- Port seatMGT `LayoutEditor` + `Inspector` (dnd-kit): move, resize, rotate, marquee/multi-select, zoom/pan, optional 8 px snap.
- Add a seat tile (creates a seat with the next code) and delete one (SEA-01 guard); add/move/rotate/delete fixtures.
- One save sends the whole layout; unsaved-changes warning.

## Out of scope
- Floor-plan background image (D20, later).

## Acceptance criteria
- [ ] Positions, sizes and rotations survive a reload after save.
- [ ] Adding a tile creates seat `<room>-NN` with the next number.
- [ ] Deleting a tile whose seat has an occupant or device is refused with a message.
- [ ] Leaving with unsaved changes asks for confirmation.
- [ ] Unit tests cover snap math and the layout diff/save payload.

## Technical notes
- Files: `src/ui/roomlayout/LayoutEditor*`, `Inspector*`, `src/app/(app)/rooms/[code]/edit/*`; reference seatMGT `src/components/roomlayout/*`, `src/lib/actions/roomLayout.ts`.
- Risks / open questions: Most likely ticket to need rework; desktop only.

## Test plan
- Unit: snap, payload.
- Manual: edit and save a room with 20+ seats.

## Notes / answers from Ming
—

## Change from Ming (2026-11-20, D43)
Supersedes the free-form editor above: the editor places sprites on whole tiles, rotates in 4 directions, no resize,
no free snap; palette of sprites from the manifest; multi-select moves by whole tiles; undo before save. Porting
seatMGT's `LayoutEditor` is now reference only.

## Handoff
