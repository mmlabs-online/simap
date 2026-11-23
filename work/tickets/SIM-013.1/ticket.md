# SIM-013.1: Device create, edit and delete API

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | S |
| Areas | api |
| Gate | plan-approval |
| Depends on | SIM-013 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-23 |
| Claimed by | — |
| PR | — |

## Goal
Slice 2 of 4 of SIM-013 (Devices): members create, edit and delete devices through the API, with MAC normalisation and the D31 delete rule.

## Scope reference
spec DEV-01, DEV-02; D19, D31, D37. Split out of SIM-013 by its approved plan (`work/tickets/SIM-013/plan.md` → Split proposal).

## Scope
- `POST /api/devices`: any member creates for their own member; Admin for any member (`canCreateFor` from SIM-013); `member_not_assignable` for an inactive owner. Created in inventory.
- `PATCH /api/devices/[id]`: owner or Admin; `ownerId` in the body is 400 (owner cannot change).
- `DELETE /api/devices/[id]`: owner or Admin; 409 `device_placed` while the device is at a seat (D31).
- MAC normalisation in `src/lib/validate/device.ts` (accepts `-`, `:`, `.` forms and mixed case; stores lowercase colon form; blank → null); length caps on name, type and inventory number.
- 23505 → 409 `inventory_number_taken` / `mac_taken`.

## Out of scope
- Any UI (SIM-013.2, SIM-013.3). Bulk import.

## Acceptance criteria
- [ ] Deleting a placed device is refused (409 `device_placed`) until it is in inventory.
- [ ] A User or Manager creates, edits and deletes only their own devices; an Admin can do this for any member.
- [ ] Different spellings of one MAC are stored the same way, and a duplicate MAC or inventory number is a 409, not a 500.
- [ ] Unit and DB tests cover the permission matrix, the MAC normaliser and the D31 refusal.

## Technical notes
- Builds on `src/lib/devices/*`, `src/server/devices/*` and `src/app/api/devices/**` from SIM-013.
- Refusals are 409/422 from the service, never 401/403 (R7).

## Test plan
- Unit: validator and MAC normaliser, permission rules.
- DB (CI): create/edit/delete, uniqueness, D31.

## Notes / answers from Ming
—

## Handoff
