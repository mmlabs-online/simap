# SIM-037.11: Devices UI: overdue chip and filter, owner banner, extension requests

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-037.5 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T13:21:00Z |
| PR | — |

## Goal
Owners see their overdue devices (chip, filter, nav badge, banner) and ask for an extension or give the device back; Admin/Manager see pending extensions and approve or reject them.

## Scope reference
docs/spec-v1.md §6 DEV-10, DEV-02; D63; OQ-42. UI slice split from SIM-037.5 (its plan.md `## Split proposal`). API from SIM-037.5: `DeviceDto.overdue`, `?placement=overdue`, `POST /api/devices/:id/handoffs` `{kind:"extension", newExpiresOn, note}`, confirm/decline/cancel on extensions, `GET /api/handoffs?box=extensions` (Manager+), count `{incoming, returns, extensions, overdue}`.

## Scope
- Devices filter chip "Overdue" and an Overdue chip on rows.
- Nav badge and shell breakdown include overdue (owner) and pending extensions (Manager+).
- Owner banner on the Devices page with Extend and Return (give back) actions.
- Extend dialog (date + note); owner Cancel on the row; "Extension pending" chip.
- Pending extensions section for Manager+ with Approve / Reject (like `PendingReturns`).
- Copy in `src/ui/copy/*` (D36); a dev-seed device with expiry yesterday for the manual check.

## Out of scope
- API (SIM-037.5). Email/push reminders, due-soon warnings.

## Acceptance criteria
- [ ] Overdue devices show an Overdue chip and appear under the Overdue filter; devices with no expiry never do.
- [ ] The owner sees the overdue count in the nav and a banner with Extend and Return.
- [ ] The owner can request an extension (date after today) and cancel it; Manager+ approve or reject from the pending list.
- [ ] All new strings live in `src/ui/copy/*` (D36).

## Technical notes
- Files: see plan.

## Test plan
- Unit: outcomes, badge sum, API client paths. Markup: banner, Extend dialog, pending extensions. Manual: seed device with expiry yesterday.

## Notes / answers from Ming
Split from SIM-037.5 by the planner (2026-11-25); added by the orchestrator, Ming to confirm.

## Handoff
