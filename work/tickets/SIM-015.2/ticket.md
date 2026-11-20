# SIM-015.2: Free-form layout editor

| Field | Value |
|---|---|
| State | BLOCKED |
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
- 2026-11-20 (D47): BLOCKED — waiting for pixel-art decisions (D41–D46). Do not start until Ming lifts it; the map tickets bring the tile-grid model and are re-scoped then.

## Handoff

### 2026-11-20 — claude — BLOCKED (board update, D47)
- Done: set BLOCKED on Ming's instruction (2026-11-20): the room map becomes pixel art; art style and tile size are not decided (D41–D46 on branch `claude/confident-cerf-67q5le`).
- Next: wait for Ming; re-scope against D41–D46 before planning. Seat add/delete without the map moved to SIM-012.
