# SIM-037.4: Return a device to the org inventory with Admin confirmation

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | api, ui, security |
| Gate | plan-approval |
| Depends on | SIM-037.3 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T08:19Z |
| PR | — |

## Goal
An owner gives a device back to the org, and it becomes unowned only when an Admin confirms receipt; Admins can also take a device back directly.

## Scope reference
docs/spec-v1.md §6 DEV-09; D63; OQ-44 (deactivated or removed owner).

## Scope
- API: start a return (owner or Manager+), cancel (owner or Manager+), confirm (Admin only): unplace, clear owner, note and expiry, in one transaction.
- API: Admin direct take-back of an owned device without a request.
- Member deactivate/remove cancels pending handoffs to or from that member; their devices stay assigned.
- UI: Return dialog; pending returns list for Admins with Confirm; nav badge for Admins; Admin "Take back" action.
- Audit rows for start, cancel, confirm and Admin take-back.

## Out of scope
- Overdue reminder (SIM-037.5).

## Acceptance criteria
- [ ] Owner or Manager+ can start and cancel a return; only an Admin can confirm.
- [ ] Until confirm nothing changes; on confirm the device has no owner, no seat, no note or expiry.
- [ ] Admin take-back works with no pending request and on a deactivated member's device.
- [ ] Deactivating or removing a member cancels their pending transfers and returns.
- [ ] Admins see the number of pending returns in the nav.

## Technical notes
- Files: see plan.
- Risks / open questions: Shares the handoff state machine with SIM-037.3.

## Test plan
- DB integration: confirm return of a placed primary device; deactivation cancels handoffs. Manual: return then Admin confirm.

## Notes / answers from Ming
Ming 2026-11-25: "lên ticket và làm luôn".
Plan approved 2026-11-25 (Ming: "duyệt"), A1-A12 as written; split approved (UI to SIM-037.10).

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 3, tokens ~173k total (api-platform-engineer×1 consult 37k, frontend-developer×1 consult 38k, planner×1 opus 98k; in/out split not reported)
- Done: consults saved; plan.md READY for slice 1 (API, DTO flags, deactivation cancels handoffs; no migration, no High path, Medium tier). Split proposal: UI to a new ticket SIM-037.10.
- In progress / next: Ming approves the plan (A1–A12) and the split (M-65). Then create SIM-037.10 on the board and resume /run SIM-037.4 at IMPLEMENT.
- Gotchas: security review trigger fires (src/server/). Member "remove" has no code path (A3, deactivation only). A10 race to record as a `debt` issue at PR time.
