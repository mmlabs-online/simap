# SIM-037.2: Assign from org inventory and new device fields

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | api, ui |
| Gate | plan-approval |
| Depends on | SIM-037.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T03:22:11Z |
| PR | — |

## Goal
An Admin or Manager hands an org-inventory device to a member with a note and an optional expiry, and devices carry serial number, manufacturer and brand.

## Scope reference
docs/spec-v1.md §6 DEV-01 (fields), DEV-07; D63.

## Scope
- API: assign an unowned device to an active member with optional note (≤ 500) and optional expiry date (not in the past); device lands in the member's inventory, not placed. Refused for an owned device.
- API: Admin/Manager edits the current holding's note and expiry.
- Create/edit device: serial, manufacturer, brand (optional) in API validators and dialogs; shown in the Devices list.
- UI: Assign dialog (member picker, note, expiry with "No expiry") from the Devices page for org-inventory devices; edit note/expiry for owned devices.
- Audit rows `device.assign` and `device.holding_update` with member ids, note and expiry in meta.

## Out of scope
- Transfer, return, overdue, history page.

## Acceptance criteria
- [ ] Admin and Manager can assign an org-inventory device; a User cannot; assigning an owned device is refused (409/422).
- [ ] After assign the device belongs to the member, is not placed, and shows note and expiry; expiry empty means no expiry.
- [ ] An expiry date in the past is refused; note over 500 chars is refused.
- [ ] Serial (unique per org when set), manufacturer and brand can be set and edited and appear in the list, search and CSV export.
- [ ] Each assign and holding edit writes one audit row.

## Technical notes
- Files: see plan.
- Risks / open questions: Expiry is a calendar date in UTC+7 (D35).

## Test plan
- Unit: validators, permission matrix. DB integration: assign races (two assigns on one device). Manual: assign with and without expiry.

## Notes / answers from Ming
Ming 2026-11-25: "lên ticket và làm luôn".

## Handoff
