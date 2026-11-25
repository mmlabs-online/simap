# SIM-037.2: Assign from org inventory and new device fields

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | api, ui |
| Gate | plan-approval |
| Depends on | SIM-037.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
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

Plan approved (2026-11-25, Ming: "ok") with assumptions A1-A11 and the split: the UI slice is SIM-037.7.

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 3 (api-platform-engineer×1 ~51k, frontend-developer×1 ~78k, planner×1; default models).
- Done: consult files; plan.md READY for slice 1 (API + data + SIM-037.1 carry-overs), assumptions A1-A11; planner proposes the UI slice as a new ticket SIM-037.7.
- In progress / next: Ming approves plan + split (M-53); then create SIM-037.7 and IMPLEMENT slice 1.
- Gotchas: no High path in slice 1 (no migration). Deactivation counts only placed devices (A8 → debt issue). Spec DEV-01 still mentions the "Move to inventory" delete warning (A9).

### 2026-11-25 — claude — DONE
- Agent calls: 3 since plan approval (implementer×1 ~134k, reviewer×1 ~81k, security auditor via general-purpose×1 ~88k; default models).
- Done: slice 1 implemented (attempt 1); review PASS (DB tests pending CI); security no 🔴, two 🟡 for Ming (note in audit log; note visible org-wide). Merged origin/main into the branch (rebase + force-push not allowed); local checks green after merge.
- In progress / next: Ming opens the PR (M-54, prefilled link in chat) and merges after CI `test:db` is green; then SIM-037.7 (UI) and SIM-037.3.
- Gotchas: A8 debt issue (deactivation ignores unplaced devices) and A9 spec text still to do; no `gh` on this machine.
