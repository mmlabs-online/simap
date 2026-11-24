# SIM-015.3: Read-only pixel room map on the room page

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-015.6 |
| Needs Ming | M-25 |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/50 |

## Goal
Everyone opens a room and sees who sits where on its pixel map, then opens a seat's details from the map.

## Scope reference
- Spec LAY "Visual style", LAY-06, "Room view (all roles)", SEA-05.
- D41, D44, D46, D48, D49, D50, D51, D52, D54, D58.

## Scope
- Show the saved layout on `/rooms/<code>` with the existing `RoomMap` renderer and the SIM-015.1 API.
- Seat overlays for empty, occupied (generated avatar), mine and cannot-seat. Name tags on hover or keyboard focus only.
- Zoom 2×/3×/4× and pan, working at 390 px and in dark mode.
- Click or keyboard focus opens the existing seat panel through `?seat=<code>`.
- Keep the seat table reachable on the room page, so no seat action is lost and seats without a placement stay usable.
- UI copy in `src/ui/copy/`.

## Out of scope
- Any server, API, schema or migration change.
- Editing (SIM-015.2).
- Real art, the Credits page and M-10 (SIM-033). Placeholder art is enough here.
- Device and pending-request overlays (after SIM-013 and SIM-014).
- A whole-floor map (v2, D49).

## Acceptance criteria
- [ ] The room page renders every placed seat and fixture at its saved tile.
- [ ] Seat state is shown by a sprite overlay, not colour alone, and comes from the derived status.
- [ ] Name tags appear only on hover or keyboard focus, at every zoom.
- [ ] A click, or the keyboard, opens the seat panel, and a seat code in the URL opens it on load.
- [ ] Zoom and pan work at 390 px and on desktop, and the map is usable in dark mode.
- [ ] All existing seat actions stay reachable, including for seats without a placement.
- [ ] Unit tests cover the mapping from the API payload to the map's view data.

## Technical notes
- Files: `src/ui/roomlayout/*`, `src/ui/seats/*`, `src/ui/copy/*`.
- Security (SIM-015.1 review, finding 4): a 64 x 64 room at 4x zoom is an 8,192 px canvas (about 268 MB). Cap zoom by canvas area or render only the viewport, and show the error state on failure.
- Vitest here runs static markup in node, so canvas, pan, focus and pointer behaviour need a browser.

## Test plan
- Unit: payload-to-view mapping and overlay state.
- Manual: a seeded room on mobile and desktop, by mouse and keyboard, in light and dark mode.

## Notes / answers from Ming
- 2026-11-22 (D58): split from SIM-015.1 after Ming lifted D47.

- 2026-11-23: Plan approved by Ming with all defaults: (1) rooms too large for the canvas budget show a "too large" view, seats stay usable through the table, viewport-only rendering becomes a `debt` issue; (2) pan is native scrolling only, mouse drag is a follow-up; (3) focus shows the name tag, Enter or Space opens the panel; (4) keep workspace CLAUDE.md section 8, simap gate policy is now `high-paths+P1`.

## Handoff

### 2026-11-23 — claude — BLOCKED
- Agent calls: 3 + 1 resume (frontend-developer×1 55.7k, ux-architect×1 51.2k, planner×2 92.6k reported on the resume; the first planner run stopped on a rate limit and its usage was not reported). In/out split not reported.
- Done: consults saved; plan.md is `Status: READY` (no server, API, schema or High-path changes). No product code written.
- In progress / next: Ming approves the plan (M-25) by adding a dated "Plan approved" line under *Notes / answers from Ming*; then `/run SIM-015.3` continues at IMPLEMENT without re-planning.
- Gotchas: rooms near 64 x 64 tiles exceed the canvas budget even at 2x and show a "too large" view (plan assumption 3), a partial miss on AC1 for those rooms. Gate conflict between workspace CLAUDE.md section 8 (P1 needs plan approval) and loop.config.md (`high-paths`) is open. `work/ming-todo.md` has two items numbered M-24.

### 2026-11-23 — claude — DONE
- Agent calls: 7 (frontend-developer×1 55.7k, ux-architect×1 51.2k, planner×2 92.6k, implementer×1 94.8k, reviewer×2 91.6k; figures as reported, the first planner run's usage is unknown, in/out split not reported).
- Done: read-only map on the room page, zoom cap, map reload after seat actions. Review attempt 1 PASS: format, typecheck, layers and build green; 8 complete unit-test runs green (1593 passed, 8 skipped). The load test for the flake was skipped on Ming's instruction.
- In progress / next: `gh` is not installed, so the PR is not open yet. Ming opens it from the prefilled compare link, then runs the 6 browser checks in review.md.
- Gotchas: `debt` issues are NOT created (no `gh`): viewport-only rendering, mouse drag-to-pan, unidentified one-off test failure, Safari focus return (`SeatDetailPanel.tsx:157,164`), direct test for `useRoomLayout`. Branch was merged with main instead of rebased, to avoid a force-push.
