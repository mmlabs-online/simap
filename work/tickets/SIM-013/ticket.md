# SIM-013: Devices

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-012 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
People track their devices and where they are; Managers place and move any device; the primary/secondary rules always hold.

## Scope reference
spec DEV-01..06, REG-03 (device); D19, D22, D31.

## Scope
- CRUD (owner or Admin edits/deletes; any member creates their own); MAC format and uniqueness per org.
- Placement: primary (owner = occupant, one per seat) / secondary; lend; move; return to inventory (owner, Manager+).
- Delete blocked while placed, with "Đưa về kho" (D31).
- Devices page with all / placed / inventory filter; seatMGT `DeviceTable`, `DeviceFormDialog`.

## Out of scope
- Bulk import.

## Acceptance criteria
- [ ] Placing as primary is refused unless the seat's occupant owns the device and the seat has no primary.
- [ ] A Manager can move another member's device; a User cannot.
- [ ] Deleting a placed device is refused until it is in inventory.
- [ ] Devices list shows placement for every device.
- [ ] Unit tests cover placement rules and permission matrix.

## Technical notes
- Files: `src/server/devices/*`, `src/app/api/devices/**`, `src/app/(app)/devices/*`, `src/ui/devices/*`; reference seatMGT `src/lib/actions/devices.ts` + tests.
- Risks / open questions: —

## Test plan
- Unit: placement rules, permissions.
- Manual: lend and move devices between seats.

## Notes / answers from Ming
—

## Handoff
