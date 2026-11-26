# SIM-059: Simple walk-in and walk-out

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-058 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

## Goal
On check-in the member's character walks from the room's door to their chair along the tile grid, and walks back out
on check-out, with the existing avatar frames.

## Scope reference
`docs/spec-v1.md` PRE-07 (phase 1), PRE-06 (walks on polled changes and moves), PRE-04 (no walk-in when already
checked in by the provider); decision D77 (walk to the new chair on move).

## Scope
- Path-finding on the tile grid as a pure `src/lib` module with unit tests, using the LAY-01 block rules.
- Walk-in, walk-out and move walks on the check-in room view, using the existing avatar frames.
- Skip on click or key; reduced-motion; fade fallback.

## Out of scope
- Multi-direction walking frames (SIM-060); editor warning (SIM-062).

## Acceptance criteria
- [ ] On check-in the character appears at the room's door and walks along a tile-grid path that avoids blocking
  items (LAY-01 block rules) to the chair and sits; check-out plays the reverse; a move walks to the new chair.
- [ ] A click or any key skips to the end state.
- [ ] With `prefers-reduced-motion` the character is shown seated (or gone) with no walk.
- [ ] A room with no door, or a chair with no path from a door, falls back to a short fade-in (fade-out) at the
  chair.
- [ ] Phase 1 uses the existing avatar frames.
- [ ] Unit tests cover the path function (path found, blocked tiles avoided, no door, unreachable chair).

## Technical notes
- Files: new `src/lib/` path module (e.g. `src/lib/sprites/walk-path.ts`), `src/ui/roomlayout/RoomMap.tsx` /
  `paint.ts`, `src/ui/checkin/**`.
- Gate `plan-approval` because of the `high-paths+P1` policy (P1).

## Test plan
- Unit: path-finding cases above; skip and reduced-motion state transitions.
- Manual: check in/out in a room with and without a door; OS reduced motion on.

## Notes / answers from Ming

## Handoff
