# SIM-037.3: Transfer a device with recipient confirmation

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P1 |
| Size | M |
| Areas | api, ui, security |
| Gate | plan-approval |
| Depends on | SIM-037.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T04:44:53Z |
| PR | — |

## Goal
Any owner hands their device to another member, and the device moves only when the recipient confirms receipt, landing unplaced in the recipient's inventory.

## Scope reference
docs/spec-v1.md §6 DEV-08; D63; OQ-43 (expiry carries over).

## Scope
- API: start (owner, or Manager+ for any owned device; recipient an active member, not the owner; optional note), cancel (sender or Manager+), decline and confirm (recipient only).
- Confirm in one transaction (lock order seat → device → handoff): re-check pending and owner unchanged, unplace (demote primary), set owner to the recipient, keep expiry; stale → 409.
- At most one pending handoff per device; a device with a pending handoff cannot be assigned or deleted.
- UI: Transfer dialog; incoming transfers list on the Devices page with Confirm/Decline; nav badge with the count; pending state shown on the device row.
- Audit rows for start, cancel, decline, confirm.

## Out of scope
- Return to org inventory (SIM-037.4).
- Email notifications.

## Acceptance criteria
- [ ] A User can start a transfer of their own device but not of someone else's; a Manager+ can for any owned device.
- [ ] Until confirm, the device keeps owner and seat; only the recipient can confirm or decline; only the sender or a Manager+ can cancel.
- [ ] On confirm the device belongs to the recipient, is not at any seat, and the seat's primary rule still holds.
- [ ] A second pending handoff on the same device is refused; confirming a cancelled or stale handoff returns 409.
- [ ] The recipient's nav shows the number of pending incoming transfers.

## Technical notes
- Files: see plan.
- Risks / open questions: R7: "not the recipient" is a domain refusal (409/422), not 403.

## Test plan
- DB integration: confirm vs concurrent placement/cancel. Unit: state machine and permissions. Manual: transfer between two accounts.

## Notes / answers from Ming
Ming 2026-11-25: "lên ticket và làm luôn".

Plan approved (2026-11-25, Ming: "ok") with assumptions A1-A14 (migration kept) and the split: the UI slice is SIM-037.8.

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 3 (api-platform-engineer×1 ~53k, frontend-developer×1 ~58k, planner×1; default models).
- Done: consult files; plan.md READY for slice 1 (API + migration + device-row fields), High tier (decided_by_id CHECK migration), assumptions A1-A14; UI slice proposed as SIM-037.8.
- In progress / next: Ming approves plan + split (M-57); then create SIM-037.8 and IMPLEMENT slice 1.
- Gotchas: BUG-001 (another session) edits devices.ts / rules.ts / devices.db.test.ts — expect a merge. Member-deactivation cancel of handoffs left to SIM-037.4 (A5).
