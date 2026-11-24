# SIM-013.4: Device create and edit dialog

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
| Created | 2026-11-24 |
| Claimed by | — |
| PR | — |

## Goal
Members create and edit devices from the Devices page.

## Scope reference
spec DEV-01, DEV-02; D19, D36, D37. Split out of SIM-013.2 by its approved plan (`work/tickets/SIM-013.2/plan.md` → Split proposal and the choices it records for later slices).

## Scope
- `DeviceFormDialog` (outer/inner pattern as `RoomFormDialog`) with pure `device-form.ts` (`toCreateBody`, `toPatchBody` using `@/lib/validate/device`; MAC via the lib normaliser; patch sends only changed fields).
- Type field with a datalist of suggestions (D37); owner read-only on edit.
- Admin owner picker on create: "Me" / "Another member" radios; "Another member" shows the inline member search (`MemberPickerFields` + `useMemberPicker`), no nested modal. Non-Admins never send `ownerId`.
- "New device" button for every member; Edit button only where `canEdit`.
- Device-specific message for `member_not_assignable` (and `no_linked_member`) without changing `src/ui/copy/api.ts`.

## Out of scope
- Place, move and return dialog (SIM-013.3). Any server or API change.

## Acceptance criteria
- [ ] A member creates a device for themselves; an Admin can also create one for another member.
- [ ] Edit changes only the changed fields; the owner cannot be changed; Edit shows only where the server says `canEdit`.
- [ ] Duplicate inventory number or MAC and an inactive owner show clear messages.
- [ ] Static-render and pure-logic tests (no jsdom) cover the form logic and the Admin-only owner picker.

## Technical notes
- Builds on `src/ui/devices/*` from SIM-013.2 and the merged device API. UI copy in `src/ui/copy/devices.ts` (D36). Whichever of SIM-013.3/.4/.5 lands first adds the row-actions column.

## Test plan
- Unit: device-form, error mapping; static render of the form fields.
- Manual: create and edit a device (as User and as Admin for another member).

## Notes / answers from Ming
Waiting for Ming: plan approval (P1 gate, M-37)

## Handoff

### 2026-11-24 — claude — BLOCKED
- Agent calls: 2, tokens ~132k total (frontend-developer×1 default 51k, planner×1 default 81k)
- Done: consult (consult-frontend-developer.md), plan.md Status READY, no split (~380 src lines + tests), no High path.
- In progress / next: Ming approves the plan (M-37), then IMPLEMENT.
- Gotchas: `rowActions` loses its early return on a missing `onPlace`; Edit is appended after the place actions, and SIM-013.5 appends Delete after Edit. Local shell needs Node via fnm (`fnm use 22`); no Python.
