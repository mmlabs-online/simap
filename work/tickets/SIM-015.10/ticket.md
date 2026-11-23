# SIM-015.10: Layout editor drag, marquee and keyboard shortcuts

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-015.7 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-23 |
| Claimed by | — |
| PR | — |

## Goal
Slice 2c of the tile layout editor: pointer drag-move with a whole-tile ghost, rectangle multi-select and keyboard
shortcuts.

## Scope reference
spec LAY-05 ("click/drag", "rotate (R)", "multi-select"); SIM-015.7 `plan.md` → Split proposal (slice 2c), approved
2026-11-23.

## Scope
- Pointer drag-move with whole-tile ghost preview (one commit on pointerup, rAF throttle); `setPointerCapture`;
  `touch-action` only while dragging.
- Marquee multi-select (`itemsInRect`).
- Shortcuts R, Delete/Backspace, Ctrl/Cmd+Z, arrows, Esc, Ctrl+S, with a visible shortcut list and arrow-key
  coalescing into one undo step; not active in inputs or dialogs.

## Out of scope
- Palette, tray, resize (SIM-015.9). Desk add/delete (SIM-015.8).

## Acceptance criteria
- [ ] Dragging a selection moves it by whole tiles with one undo step; a refused drop snaps back with a message.
- [ ] A drawn rectangle selects the items inside it.
- [ ] Each listed shortcut works and is listed in the editor.

## Test plan
- Pure tests for the pointer state machine and key handling; manual drag and shortcut run on a 20+ seat room.

## Notes / answers from Ming

## Handoff
