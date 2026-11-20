# SIM-010.2: Rooms page UI: cards, occupancy ring, create/edit/delete dialogs

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P1 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-010, SIM-006.2, SIM-022 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T09:46Z |
| PR | — |

## Goal
Members see the room list with occupancy; Admins create, edit and delete rooms from the Rooms page; slice B of the approved SIM-010 plan.

## Scope reference
`work/tickets/SIM-010/plan.md` Slice B (approved 2026-11-20, batch 2026-11-20-2), incl. the UI half of AC4 ("UI hides the actions"). Ming Q22: the code input uppercases as the user types.

## Scope
- Everything listed under Slice B in `work/tickets/SIM-010/plan.md` (`createRoomsApi(fetcher)`, `RoomsView`/`RoomsPage`, `RoomCard`, `OccupancyRing`, `RoomFormDialog`, delete confirm, `src/ui/copy/rooms.ts`).

## Out of scope
- Room switcher in the shell and re-keying `/rooms/[roomCode]` (SIM-012; SIM-015.1 is BLOCKED, D47).
- Room detail page, seat list and seat add/delete (SIM-012, D47). No map, canvas or pixel-art UI (D47).

## Acceptance criteria
- [ ] Slice B acceptance criteria as written in `work/tickets/SIM-010/plan.md`.
- [ ] Code input uppercases as the user types (Q22).
- [ ] All loop checks green; copy follows the SIM-022 convention.

## Technical notes
- Calls the API only through SIM-006 apiFetch (via SIM-006.2 context).
- Split from an approved plan: the planner reuses that plan's slice; re-plan only what changed on `main` since.

## Test plan
- As in the source plan's slice.

## Notes / answers from Ming
- 2026-11-20 (batch 2026-11-20-2): created from the split Ming approved ("duyệt hết; câu 20 tách 3 phần; … còn lại theo đề xuất").
- Plan approved (2026-11-20, batch 2026-11-20-4): "duyệt hết theo đề xuất" — every proposal in the batch round taken.
- Merge approved (2026-11-20, batch 2026-11-20-4): "bật --auto-merge".

## Handoff

### 2026-11-20 — claude — BACKLOG (board update, D47)
- Done: Out of scope now points at SIM-012 instead of the blocked SIM-015.1 (D47); clean UI kit only.
- Next: unchanged; runs after SIM-010 and SIM-006.2.
