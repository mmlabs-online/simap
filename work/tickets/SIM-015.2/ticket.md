# SIM-015.2: Tile-based layout editor

| Field | Value |
|---|---|
| State | BLOCKED |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-015.3, SIM-015.5 |
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
- 2026-11-22 (D58, D59): Ming lifted D47 for the room map tickets. This ticket runs after SIM-015.3 and SIM-015.5. Re-scope its free-form text against D43 at planning.

- Waiting for Ming: plan approval (P1 gate)

## Change from Ming (2026-11-20, D43)
Supersedes the free-form editor above: the editor places sprites on whole tiles, rotates in 4 directions, no resize,
no free snap; palette of sprites from the manifest; multi-select moves by whole tiles; undo before save. Porting
seatMGT's `LayoutEditor` is now reference only.

## Handoff

### 2026-11-20 — claude — BLOCKED (board update, D47)
- Done: set BLOCKED on Ming's instruction (2026-11-20): the room map becomes pixel art; art style and tile size are not decided (D41–D46 on branch `claude/confident-cerf-67q5le`).
- Next: wait for Ming; re-scope against D41–D46 before planning. Seat add/delete without the map moved to SIM-012.

### 2026-11-23 — claude — BLOCKED (plan approval)
- Agent calls: 3, tokens ~192k total (frontend-developer×1 inherit 35k, ux-architect×1 inherit 46k, planner×1 inherit 112k; in/out split not reported)
- Done: consults saved; plan.md READY: slice 1 of 3 (pure editor core in `src/lib/layout-editor/`, no UI/API/High path), assumptions A1–A14 with defaults.
- In progress / next: Ming approves the plan. Then the orchestrator rewrites this ticket's scope to slice 1 and files the two follow-up slices.
- Gotchas: the plan names the follow-up slices SIM-015.6 and SIM-015.7, but SIM-015.6 already exists (Room layout read API, MERGED); use SIM-015.7 (editor UI, save, leave guard) and SIM-015.8 (desk add/delete) instead. Node in bash: `eval "$(fnm env --shell bash)"`.
