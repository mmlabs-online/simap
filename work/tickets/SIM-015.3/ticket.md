# SIM-015.3: Read-only pixel room map on the room page

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-015.6 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | — |

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

## Handoff
