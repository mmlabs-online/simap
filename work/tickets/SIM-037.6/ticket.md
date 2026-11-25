# SIM-037.6: Device detail page with history

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | M |
| Areas | ui, api, ux |
| Gate | none |
| Depends on | SIM-037.4, SIM-037.5 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T13:47:11Z |
| PR | — |

## Goal
Every member can open one device and see all its details, where it is, who holds it, and its full assignment and transfer history.

## Scope reference
docs/spec-v1.md §6 DEV-11, DEV-02; D63.

## Scope
- API: device detail by id (fields, location, holder, note, expiry, overdue, pending handoff) and its history, newest first, keyset-paged.
- History from handoff rows and device audit rows: create, assign, holding edit, transfer/return/extension events, Admin take-back; actor, from, to, time, note, expiry, confirmed by.
- UI: `/devices/<id>` page in the clean UI kit; links from the Devices list, search and seat panel; actions available to the viewer (transfer, return, assign) reuse the existing dialogs.

## Out of scope
- Editing history.
- Export of history.

## Acceptance criteria
- [ ] Any member of the org opens a device's page; another org's device id returns not found.
- [ ] The page shows all fields, current location and holder, and any pending handoff.
- [ ] History lists every lifecycle event newest first with actor, from/to, note, expiry and who confirmed, and survives member deactivation.
- [ ] Device names in the list, search and seat panel link to the detail page.

## Technical notes
- Files: see plan.
- Risks / open questions: Architect default: history read from audit_log plus device_handoffs, no new table.

## Test plan
- Unit: history mapping. Component: page states (loading, empty history, pending). Manual: walk a device through assign, transfer, return.

## Notes / answers from Ming
Ming 2026-11-25: "lên ticket và làm luôn".

## Handoff
