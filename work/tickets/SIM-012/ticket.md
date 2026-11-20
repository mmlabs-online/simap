# SIM-012: Seat detail and occupancy

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-010, SIM-011 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Anyone sees a seat's full detail; Managers assign, replace and remove occupants safely; users release their own seat.

## Scope reference
spec SEA-02..05, DEV-06, REG-03 (seat); D18, D22, D26, D32.

## Scope
- Seat detail panel (code, room, status, occupant, devices, tags) ported from seatMGT `SeatDetailPanel`.
- Assign / remove (Manager+); replace with confirmation (D18); primary demotion (DEV-06) in the same transaction.
- Cannot-seat flag with reason (Manager+), blocking assign/request (D26).
- Group inheritance on assign when the seat has none (D32); self-release by the occupant (D22).
- Picker shows only active members known to simap.

## Out of scope
- Device actions (SIM-013), requests (SIM-014), tag editing (SIM-016).

## Acceptance criteria
- [ ] Assigning to an occupied seat asks "Ghế đang có X ngồi. Thay bằng Y?" and on confirm demotes X's primary device.
- [ ] A cannot-seat seat cannot be assigned (server refuses, UI disables).
- [ ] The occupant can release their own seat; others cannot.
- [ ] A seat with no group takes the occupant's group on assign.
- [ ] Unit tests cover assign/replace/release rules and demotion.

## Technical notes
- Files: `src/server/seats/*`, `src/app/api/seats/**`, `src/ui/seatmap/SeatDetailPanel*`; reference seatMGT `src/lib/actions/seats.ts` + tests.
- Risks / open questions: —

## Test plan
- Unit: occupancy rules.
- Manual: assign, replace, release on a seeded room.

## Notes / answers from Ming
—

## Handoff
