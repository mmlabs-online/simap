# SIM-037.7: Devices UI: assign dialog, note/expiry edit and new device fields

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-037.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T03:57:42Z |
| PR | — |

## Goal
Admins and Managers assign org-inventory devices and edit a holding's note and expiry from the Devices page, and the device form and list show serial number, manufacturer and brand.

## Scope reference
docs/spec-v1.md §6 DEV-01 (fields), DEV-02, DEV-07; D63. UI slice split from SIM-037.2 (its plan.md, approved 2026-11-25); UI design in work/tickets/SIM-037.2/consult-frontend-developer.md.

## Scope
- Create/edit dialog: serial, manufacturer, brand (optional), field errors and `serial_taken` message.
- Devices list: a Details column (manufacturer, brand, serial) and a holding line (note, "Until <date>" / "No expiry") in the owner cell and the mobile card.
- Assign dialog (member picker reuse, note, expiry with a "No expiry" checkbox, min = today UTC+7) for `canAssign` devices; the same dialog in edit mode for `canEditHolding` devices.
- Row actions Assign and "Note / expiry", gated by the DTO flags; refetch after success; focus to the heading when the row leaves the filter.

## Out of scope
- API changes (SIM-037.2). Transfer, return, overdue, history (SIM-037.3 to SIM-037.6).

## Acceptance criteria
- [ ] An Admin or Manager sees Assign on org-inventory devices and "Note / expiry" on owned devices; a User sees neither.
- [ ] Assigning with or without expiry updates the row to the member, with the note and "Until <date>" or "No expiry".
- [ ] The expiry input cannot pick a day before today (UTC+7); the server refusal message shows if it does.
- [ ] Serial, manufacturer and brand can be entered on create and edit and show in the Details column; a duplicate serial shows the `serial_taken` message.
- [ ] All new strings live in `src/ui/copy/*` (D36).

## Technical notes
- Files: see plan.
- Risks / open questions: member picker currently imports `CLIP` from `SeatsView` (move to a shared constant).

## Test plan
- Unit: assign-device helpers, device-form diff cases, row action gating. Markup: AssignDeviceFields. Manual: assign with and without expiry, edit note.

## Notes / answers from Ming
Split from SIM-037.2 with Ming's approval (2026-11-25, "ok").

## Handoff
