# SIM-013.5: Device delete dialog with Move to inventory

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | S |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-013.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | claude@2026-11-24T07:58:35Z |
| PR | — |

## Goal
Members delete their devices; a device at a seat is moved to inventory first (D31).

## Scope reference
spec DEV-01, DEV-02; D31, D36. Split out of SIM-013.2 by its approved plan (`work/tickets/SIM-013.2/plan.md` → Split proposal and the choices it records for later slices).

## Scope
- `DeleteDeviceDialog` with pure `delete-device-flow.ts`: opens in the placed step when the row shows a seat; a 409 `device_placed` also moves to it (then `GET /api/devices/:id` to learn the seat).
- "Move to inventory" = `PUT /api/devices/:id/placement` `{seatId: null, expectedSeatId}`; after it, an explicit "Delete device" confirm (never an automatic delete). `placement_changed` reloads; `not_found` closes and reloads.
- Delete button only where `canEdit`.

## Out of scope
- Place, move and return dialog (SIM-013.3). Any server or API change.

## Acceptance criteria
- [ ] Deleting an inventory device works after a confirm.
- [ ] Deleting a placed device offers "Move to inventory" and then an explicit delete confirm.
- [ ] Stale placement (`placement_changed`) and a device removed elsewhere are handled without a silent delete.
- [ ] Pure-logic and static-render tests (no jsdom) cover the delete flow steps.

## Technical notes
- Builds on `src/ui/devices/*` from SIM-013.2 and the merged device API. UI copy in `src/ui/copy/devices.ts` (D36). Whichever of SIM-013.3/.4/.5 lands first adds the row-actions column.

## Test plan
- Unit: delete-device-flow; static render of the dialog steps.
- Manual: delete an inventory device; delete a placed device.

## Notes / answers from Ming
—

## Handoff
