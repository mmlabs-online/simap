# SIM-015.10: Layout editor drag, marquee and keyboard shortcuts

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-015.7 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-23 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/55 |

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
- 2026-11-23: Plan approved (all defaults A1–A17; Ming: "duyệt plan SIM-015.10, chạy luôn").

## Handoff

### 2026-11-23 — claude — BLOCKED (plan approval)
- Agent calls: 3 (frontend-developer×1 inherit 33k, ux-architect×1 inherit 38k, planner×1 inherit; in/out split not reported)
- Done: consults saved; plan.md READY (pure pointer-gesture and shortcuts modules, selectMany/nudge with clock-free arrow coalescing, pointer-only click layer, drag ghost and marquee overlay, shortcut list); assumptions A1–A17 with defaults.
- In progress / next: Ming approves; then implement.
- Gotchas: ~430 source lines; A15 moves the keyboard part to SIM-015.11 if the diff passes ~550.

### 2026-11-23 — claude — DONE
- Agent calls: 2 this run (implementer×1 inherit 105k, reviewer×1 inherit 76k; in/out split not reported); 5 in total for the ticket (~364k).
- Done: drag-move with ghost, marquee, shortcuts and list, clock-free arrow coalescing; review PASS on attempt 1; PR #55.
- In progress / next: Ming merges PR #55, decides on the Esc-in-input regression, runs the 6 manual checks; then SIM-015.8.
- Gotchas: A15 threshold met by net count only (≈532 net); keyboard part kept in this ticket.
