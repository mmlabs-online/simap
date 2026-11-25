# SIM-037.5: Overdue badge, reminder and extension request

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P2 |
| Size | S |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-037.2, SIM-037.3 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T11:30Z |
| PR | — |

## Goal
Devices past their expiry show Overdue, and their owner is reminded in the app to ask for an extension or return the device.

## Scope reference
docs/spec-v1.md §6 DEV-10, DEV-02 (overdue filter); D63; OQ-42 (owner requests, Admin/Manager decides).

## Scope
- Overdue computed on read (expiry before today in UTC+7) in device DTOs; Devices page filter "overdue".
- Owner reminder: nav badge count and a banner on the Devices page with Extend and Return actions.
- Extension request: owner proposes a new date and note (handoff kind extension); Admin/Manager approves (sets expiry) or rejects; owner can cancel.
- Pending extensions listed for Admin/Manager with a nav badge.

## Out of scope
- Email or push reminders.
- Due-soon warnings.

## Acceptance criteria
- [ ] A device whose expiry date is before today (UTC+7) shows Overdue; no expiry never shows Overdue.
- [ ] The owner sees the overdue count in the nav and a banner with Extend and Return.
- [ ] An extension request with a date not after today is refused; approve sets the new expiry; reject leaves it.
- [ ] Only Admin/Manager can approve or reject; the request counts as the device's one pending handoff.

## Technical notes
- Files: see plan.
- Risks / open questions: No scheduler: everything computed at read time.

## Test plan
- Unit: overdue date logic across the UTC+7 day boundary. Manual: set expiry to yesterday in the dev seed.

## Notes / answers from Ming
Ming 2026-11-25: "lên ticket và làm luôn".

## Handoff
