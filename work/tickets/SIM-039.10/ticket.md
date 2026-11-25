# SIM-039.10: Map items art: atlas previews

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P2 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-039.9 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T17:41Z |
| PR | — |

## Goal
Slice 2b of SIM-039.6: on the Map items page, package sprites and library art are previewed from the sprite atlas,
not only named as text.

## Scope reference
`docs/spec-v1.md` LAY-07 ("previewed at 1× and 2×"); split proposal in `work/tickets/SIM-039.9/plan.md`.

## Scope
- Package and library frame previews at 1× and 2× (pixelated canvas from the atlas) in each direction panel.
- Frame thumbnails in the inline sprite browser and on its confirm step.
- A short note when the atlas fails to load (the text-only list stays).
- A row thumbnail for items that only have a package sprite.

## Out of scope
- Custom image previews (done in SIM-039.9). Map rendering (SIM-039.8).

## Acceptance criteria
- [ ] Package and library art show 1× and 2× previews; the browser shows frame thumbnails.
- [ ] If the atlas fails, the page still works with the text list and shows a note.
- [ ] Checks green; frame rect logic has unit tests (canvas drawing is checked manually).

## Test plan
- Unit: frame rect computation. Manual: open the art dialog, browse sprites, see previews; block the atlas and see the note.

## Notes / answers from Ming
- 2026-11-25: split from SIM-039.9 by its planner (ticket too large for one cycle).

## Handoff
