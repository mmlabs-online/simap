# SIM-015.7: Layout editor UI and save of placement

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-015.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-23 |
| Claimed by | — |
| PR | — |

## Goal
Slice 2 of 3 of the tile layout editor: an Admin opens `/rooms/[roomCode]/edit`, moves, rotates and deletes fixtures,
places tray seats, moves/rotates existing seats, resizes the room, undoes, zooms and pans, and saves the layout in
one PUT, using the pure core from SIM-015.2.

## Scope reference
spec LAY-01, LAY-03, LAY-05; D43, D48, D58, D59; SIM-015.2 `plan.md` → Split proposal (slice 2) and assumptions A5,
A6, A8–A13 (approved 2026-11-23).

## Scope
- Page `src/app/(app)/rooms/[roomCode]/edit/page.tsx` (today a stub); `src/ui/roomlayout/LayoutEditor*`, `Palette`,
  `Inspector`, pointer overlay over the existing canvas painter; copy in `src/ui/copy/roomlayout.ts` (D36).
- `seatsApi.saveLayout`; add `version` to `MapView` (`toMapView` drops it today) for `baseVersion`.
- Admin-only "Edit layout" link in `RoomMapSection`; non-admins get a "not allowed" state (A10).
- Leave guard (A9): tab close/reload, in-app links, the editor's Back/Cancel; browser Back not intercepted.
- Conflicts (A13): 409 `layout_stale` / `layout_seats_changed` → Reload, never merge. Truncated rooms read-only (A6).

## Out of scope
- Placing new desks and deleting desks (SIM-015.8). Floor painting. Floor-plan background image (D20).

## Acceptance criteria
- [ ] Positions and rotations survive a reload after save.
- [ ] Leaving with unsaved changes asks for confirmation.
- [ ] Non-admins cannot use the editor; 409 conflicts offer Reload.
- [ ] Component tests cover the leave guard and the error mapping.

## Technical notes
- From the SIM-015.2 review: check fixture / seat / floor-cell count limits before the PUT (the rules don't); after
  save, new desk keys change from `n:<k>` to `s:<id>`, so remap or clear the selection.

## Test plan
- Component: leave guard, error mapping. Manual: edit and save a room with 20+ seats, and a 64×64 room.

## Notes / answers from Ming

## Handoff
