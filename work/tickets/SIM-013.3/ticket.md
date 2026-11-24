# SIM-013.3: Device place, move and return dialog

| Field | Value |
|---|---|
| State | BLOCKED |
| Priority | P1 |
| Size | S |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-013.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-23 |
| Claimed by | — |
| PR | — |

## Goal
Slice 4 of 4 of SIM-013 (Devices): from the Devices page, people place, lend, move and return devices.

## Scope reference
spec DEV-03, DEV-04, DEV-05, REG-03; D19, D22. Split out of SIM-013 by its approved plan (`work/tickets/SIM-013/plan.md` → Split proposal).

## Scope
- `PlaceDeviceDialog`: seat picker, role select (primary offered only when the rules allow it, secondary by default); covers place, lend, move and return to inventory via `PUT /api/devices/[id]/placement` (SIM-013).
- Row actions gated by the server's `canPlace` flag; refusal codes shown with their messages.

## Out of scope
- Placing devices from the room map.

## Acceptance criteria
- [ ] A member places, lends, moves and returns their own device; a Manager+ does this for any device; a User sees no place action on another member's device.
- [ ] Primary placement refusals show their message, and the list refreshes after a change.
- [ ] Pure-logic and static-render tests cover which actions and roles the dialog offers.

## Technical notes
- Uses `src/lib/devices/rules.ts` (SIM-013) for which roles to offer; the server stays the guard.

## Test plan
- Unit: dialog logic, static render.
- Manual (Ming): lend and move devices between seats.

## Notes / answers from Ming
—

## Handoff
