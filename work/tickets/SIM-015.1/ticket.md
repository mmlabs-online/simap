# SIM-015.1: Room layout API and read-only room view

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-010 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Everyone opens a room and sees its saved layout with seat status, and the layout has one clean data shape for the editor.

## Scope reference
spec LAY (Room view), LAY-03, SEA-02; D20.

## Scope
- One geometry model for seats (x, y, rotation, w, h) and fixtures; `GET /api/rooms/{code}/layout`, `PUT` for SIM-015.2 (Admin).
- `/rooms/<code>` read-only view: seat tiles with derived status, cannot-seat grey, fixtures, opens seat detail via `?seat=<code>`.
- Port seatMGT `RoomView` without the legacy coordinate systems.

## Out of scope
- Editing (SIM-015.2). Seat actions (SIM-012).

## Acceptance criteria
- [ ] The room view renders every seat and fixture of the room at its saved position.
- [ ] Seat status is derived from the occupant; no status is read from storage.
- [ ] A seat code in the URL opens its detail panel.
- [ ] Works at 390 px (pan/zoom) and in dark mode.
- [ ] Unit tests cover the layout payload validation.

## Technical notes
- Files: `src/server/layout/*`, `src/app/api/rooms/[code]/layout/*`, `src/ui/roomlayout/RoomView*`; reference seatMGT `src/components/roomlayout/RoomView.tsx`, `src/lib/roomLayout.ts`.
- Risks / open questions: seatMGT has three overlapping coordinate sets; keep only one.

## Test plan
- Unit: layout validation.
- Manual: view a seeded room on mobile and desktop.

## Notes / answers from Ming
—

## Handoff
