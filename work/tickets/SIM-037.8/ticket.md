# SIM-037.8: Devices UI: transfer dialog, incoming transfers and nav badge

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-037.3 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/90 |

## Goal
An owner (or Manager+) transfers a device to another member from the Devices page, the recipient sees incoming transfers with a nav badge and confirms or declines them, and a pending transfer shows on the device row with a Cancel action.

## Scope reference
docs/spec-v1.md §6 DEV-08; D63. UI slice split from SIM-037.3 (its plan.md, approved 2026-11-25, fixes the API contract: `pendingHandoff`, `canTransfer`, `POST /api/devices/:id/handoffs`, `POST /api/handoffs/:id/{cancel,decline,confirm}`, `GET /api/handoffs?box=incoming`, `GET /api/handoffs/count`). UI design in work/tickets/SIM-037.3/consult-frontend-developer.md.

## Scope
- Transfer dialog (member picker with the owner disabled, note; no expiry) and a Transfer row action gated by `canTransfer`.
- Pending state on the device row and card ("Transfer pending", "To <name>") and a Cancel transfer action for the sender or Manager+.
- Incoming transfers section on the Devices page with Confirm and Decline; refresh devices, the list and the badge after each action.
- Nav badge on Devices with the incoming count (same refresh lifecycle as the requests badge, no polling, D24) and its own screen-reader text.

## Out of scope
- API changes (SIM-037.3). Return, overdue, history (SIM-037.4 to SIM-037.6).

## Acceptance criteria
- [ ] An owner sees Transfer on their own owned devices without a pending handoff; a Manager+ on any owned device; nobody on org-inventory devices.
- [ ] Starting a transfer shows the device as "Transfer pending" to the named recipient; the sender or a Manager+ can cancel it.
- [ ] The recipient sees the transfer in an incoming list and in the nav badge count; Confirm moves the device into their inventory (not placed), Decline removes it from the list.
- [ ] A stale action (already cancelled, confirmed or declined) shows a message and refreshes instead of failing silently.
- [ ] All new strings live in `src/ui/copy/*` (D36).

## Technical notes
- Files: see plan.
- Risks / open questions: the picker's disabled-option label "sits here" must be overridden for transfers; `AssignDeviceFields` bundles the expiry fieldset (extract a shared note field).

## Test plan
- Unit: transfer-device helpers, row action gating, pending text. Markup: TransferDeviceFields, IncomingTransfers, badge sr-only text. Manual: transfer between two accounts.

## Notes / answers from Ming
Split from SIM-037.3 with Ming's approval (2026-11-25, "ok").

Plan approved (2026-11-25, Ming: "ok") with assumptions A1-A12 and the split: the recipient side is SIM-037.9.

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 2 (ux-architect×1 ~47k, planner×1; default models). frontend-developer consult reused from SIM-037.3.
- Done: consult files; plan.md READY for slice 1 (sender side: Transfer dialog, pending chip, Cancel), assumptions A1-A12; recipient side (incoming list, Confirm/Decline, nav badge) proposed as SIM-037.9.
- In progress / next: Ming approves plan + split (M-59); then create SIM-037.9 and IMPLEMENT slice 1.
- Gotchas: UI only, no High path. Until SIM-037.9 merges, a started transfer can only be cancelled (A1: no release in between).

### 2026-11-25 — claude — DONE
- Agent calls: 2 since plan approval (implementer×1 ~109k, reviewer×1 ~67k; default models). No review-trigger agent (UI only).
- Done: slice 1 (sender side) implemented, attempt 1; review PASS, no issues (nits only). Merged origin/main; checks green (2631 passed).
- In progress / next: Ming opens the PR (M-60, prefilled link in chat), runs its manual checks, merges; then SIM-037.9 (recipient side; starts after this merges, both touch DevicesPage/DevicesView).
- Gotchas: no release between SIM-037.8 and SIM-037.9 (A1).
