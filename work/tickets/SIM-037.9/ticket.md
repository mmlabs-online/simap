# SIM-037.9: Devices UI: incoming transfers and nav badge

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-037.8 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T07:24Z |
| PR | — |

## Goal
The recipient of a transfer sees it on the Devices page and as a count on the Devices nav item, and confirms receipt (the device lands in their inventory, not placed) or declines it.

## Scope reference
docs/spec-v1.md §6 DEV-08; D63; D24 (no polling). Recipient-side slice split from SIM-037.8 (its plan.md `## Split proposal`, approved 2026-11-25). API from SIM-037.3: `GET /api/handoffs?box=incoming`, `GET /api/handoffs/count`, `POST /api/handoffs/:id/{confirm,decline}`. UI design in work/tickets/SIM-037.8/consult-ux-architect.md §3-§7 and consult-frontend-developer.md §4, §6.

## Scope
- API client: `incomingHandoffs()`, `handoffCount()`, `confirmHandoff(id)`, `declineHandoff(id)`.
- Incoming transfers section in `DevicesView` (slot between the heading and the filter chips, only when there are items): device name, type and inventory number, "From <sender>", note, "Confirm receipt" (primary) and "Decline" (tonal); inline error with Retry.
- Outcomes: confirm notice ("now in your inventory, not placed", plus a filter hint when the current filter hides it), decline notice, stale (`handoff_not_pending` / `handoff_stale` / `not_found`) notice; every outcome refreshes the incoming list, the devices list and the badge.
- Focus after an item disappears: next item's Confirm, else the section heading, else the page heading.
- Nav badge: separate `HandoffBadgeProvider` / `useHandoffBadge` (same lifecycle as the requests badge, no polling), `badges.devices`, per-nav screen-reader text in `AppShellView` ("N incoming transfer(s)"; `myRequests` text unchanged).

## Out of scope
- Sender side (SIM-037.8). Return, overdue, history (SIM-037.4 to SIM-037.6).

## Acceptance criteria
- [ ] A recipient sees each pending incoming transfer with the sender, the device and the note.
- [ ] Confirm receipt moves the device into the recipient's inventory (not placed) and shows a notice; Decline removes the item and shows a notice.
- [ ] A stale Confirm or Decline shows a message and refreshes instead of failing silently.
- [ ] The Devices nav item shows the incoming count with screen-reader text "N incoming transfer(s)"; the requests badge text is unchanged.
- [ ] All new strings live in `src/ui/copy/*` (D36).

## Technical notes
- Files: see plan.
- Risks / open questions: badge is stale until navigation, focus or visibility change (D24).

## Test plan
- Unit: outcomes, badge count source, API client paths. Markup: IncomingTransfers, AppShellView badge text. Manual: transfer between two accounts (start, confirm; start, decline).

## Notes / answers from Ming
Split from SIM-037.8 with Ming's approval (2026-11-25, "ok"). No release between SIM-037.8 and SIM-037.9 (SIM-037.8 A1).

## Handoff
