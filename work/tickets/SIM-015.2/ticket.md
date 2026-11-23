# SIM-015.2: Tile-based layout editor

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-015.3, SIM-015.5 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-23T10:50:28Z |
| PR | — |

## Goal
Slice 1 of 3 of the tile layout editor (D43, D48): a pure, framework-free editor model in `src/lib/layout-editor/`
(tile math, place/move/rotate/delete, tray, room resize, undo, dirty check, palette, save plan and PUT payload) with
unit tests. Slices 2 and 3 are SIM-015.7 (editor UI and save) and SIM-015.8 (desk add and delete).

## Scope reference
spec LAY-01, LAY-02, LAY-03, LAY-05, SEA-01, ROO-02; D43, D48, D58, D59. Re-scoped 2026-11-23 by the approved plan
(`plan.md`, A1 split).

## Scope
- `src/lib/layout-editor/*` (types, tiles, draft, history, save-plan, palette) plus tests; export `SEAT_SPRITES`,
  `FIXTURE_GROUPS` and a new `spriteInfo()` from `src/lib/validate/layout.ts` (no rule change).

## Out of scope
- Floor-plan background image (D20, later). Any UI, route, network call or schema change (slices 2 and 3).

## Acceptance criteria
- [ ] Unit tests cover tile math, group moves, rotation, undo, the layout diff and the save payload (plan AC1–AC13).
- Moved to SIM-015.7: positions and rotations survive a reload after save; leaving with unsaved changes asks for
  confirmation.
- Moved to SIM-015.8: adding a desk creates seat `<room>-NN` with the next number; deleting a desk whose seat has an
  occupant or device is refused with a message.

## Technical notes
- Files: see `plan.md` → Files to create / modify. No High path.
- seatMGT `LayoutEditor` is reference only (D43).

## Test plan
- Unit: `src/lib/layout-editor/*.test.ts` (plan → Tests to write).

## Notes / answers from Ming
- 2026-11-20 (D47): BLOCKED — waiting for pixel-art decisions (D41–D46). Do not start until Ming lifts it; the map tickets bring the tile-grid model and are re-scoped then.
- 2026-11-22 (D58, D59): Ming lifted D47 for the room map tickets. This ticket runs after SIM-015.3 and SIM-015.5. Re-scope its free-form text against D43 at planning.
- 2026-11-23: Plan approved (all defaults A1–A14; Ming: "duyệt plan SIM-015.2, chạy luôn"). Follow-up slices are SIM-015.7 and SIM-015.8 (SIM-015.6 was taken).

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
