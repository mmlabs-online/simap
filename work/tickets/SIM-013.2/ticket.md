# SIM-013.2: Devices page UI

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-013.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-23 |
| Claimed by | claude@2026-11-24T05:44:46Z |
| PR | — |

## Goal
Slice 3 of 4 of SIM-013 (Devices): a Devices page that lists every device with its placement, filters it, and lets members create, edit and delete devices.

## Scope reference
spec DEV-01, DEV-02; D31, D36, D37. Split out of SIM-013 by its approved plan (`work/tickets/SIM-013/plan.md` → Split proposal).

## Scope
- `DevicesPage` / `DevicesView` / `DeviceTable` with the all / placed / inventory filter; placement shown as "at seat X" or "in inventory".
- `DeviceFormDialog` (type field with a datalist of suggestions, D37; owner picker for Admin only; owner read-only on edit).
- `DeleteDeviceDialog` with "Move to inventory" when the device is placed (D31, driven by the 409 `device_placed`).
- `devices-api.ts`, `useDevices.ts`, `src/ui/copy/devices.ts`, `src/app/(app)/devices/page.tsx`. Row actions gated by the server's `canEdit` flag.

## Out of scope
- The place / move / return dialog (SIM-013.3).

## Acceptance criteria
- [ ] The Devices list shows placement for every device, and the filter shows all, placed or inventory devices.
- [ ] Create and edit work through the dialog; edit and delete buttons appear only where the server says the viewer may use them.
- [ ] Deleting a placed device offers "Move to inventory" and then the delete.
- [ ] View and pure-logic tests (static render, no jsdom) cover the table, the filter and the dialog logic.

## Technical notes
- Template: `src/ui/rooms/` (RoomsPage, RoomsView, RoomFormDialog, DeleteRoomDialog, rooms-api, useRooms). Member picker in `src/ui/seats/` may be reused.
- UI copy in `src/ui/copy/devices.ts` (D36).

## Test plan
- Unit: devices-state, device-form, devices-api; static render of DevicesView.
- Manual: create, edit and delete a device; delete a placed device.

## Notes / answers from Ming
—

## Handoff
