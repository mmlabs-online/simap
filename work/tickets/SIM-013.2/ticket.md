# SIM-013.2: Devices page (read-only list and filter)

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-013.1 |
| Needs Ming | M-35 |
| Attempts | 0 |
| Created | 2026-11-23 |
| Claimed by | claude@2026-11-24T06:01:09Z |
| PR | — |

## Goal
A read-only Devices page that lists every device with its placement and filters it by all, placed or inventory.
Re-scoped 2026-11-24 by the approved plan (`plan.md`, Split proposal): create/edit is SIM-013.4, delete with "Move to
inventory" is SIM-013.5, place/move/return is SIM-013.3.

## Scope reference
spec DEV-02; D36. Split out of SIM-013 by its approved plan (`work/tickets/SIM-013/plan.md` → Split proposal).

## Scope
- `DevicesPage` / `DevicesView` / `DeviceTable` with the all / placed / inventory filter (applied on the server);
  placement shown as "At seat X" (with Primary/Secondary tag and room link) or "In inventory"; truncated notice; table
  on wide screens, stacked list on narrow ones.
- `devices-api.ts` (list), `devices-state.ts`, `src/ui/copy/devices.ts`, `src/app/(app)/devices/page.tsx`.

## Out of scope
- Create/edit dialog (SIM-013.4), delete dialog (SIM-013.5), place/move/return dialog (SIM-013.3). Any server or API change.

## Acceptance criteria
- [ ] The Devices list shows placement for every device, and the filter shows all, placed or inventory devices.
- [ ] View and pure-logic tests (static render, no jsdom) cover the table, the filter and the states (loading, error, empty per filter, truncated).
- Moved to SIM-013.4: create and edit through the dialog; edit button only where `canEdit`.
- Moved to SIM-013.5: deleting a placed device offers "Move to inventory" and then the delete; delete button only where `canEdit`.

## Technical notes
- Template: `src/ui/rooms/` (RoomsPage, RoomsView, RoomFormDialog, DeleteRoomDialog, rooms-api, useRooms). Member picker in `src/ui/seats/` may be reused.
- UI copy in `src/ui/copy/devices.ts` (D36).

## Test plan
- Unit: devices-state, devices-api; static render of DevicesView.
- Manual: open Devices, switch the filter (create/edit and delete checks move to SIM-013.4 and SIM-013.5).

## Notes / answers from Ming
- 2026-11-24: Plan approved (all defaults; Ming: "duyệt plan SIM-013.2, chạy luôn"). Ticket re-scoped to slice 1 (read-only page); SIM-013.4 (create/edit dialog) and SIM-013.5 (delete dialog) filed on the board.

## Handoff

### 2026-11-24 — claude — BLOCKED (plan approval)
- Agent calls: 3, tokens ~170k total (frontend-developer×1 inherit 43k, ux-architect×1 inherit 45k, planner×1 inherit ~80k; in/out split not reported)
- Done: consults saved; plan.md READY as slice 1 of 3 (read-only Devices page; no server/API change, no High path).
- In progress / next: Ming approves (M-35). Then the orchestrator re-scopes this ticket to slice 1 and files SIM-013.4 (create/edit dialog) and SIM-013.5 (delete dialog, D31) on the board.
- Gotchas: stale `expectedSeatId` → 409 `placement_changed`; 409 `device_placed` carries no seat (SIM-013.5 re-reads the device). Only shared file is a one-line export in `src/ui/index.ts`.
