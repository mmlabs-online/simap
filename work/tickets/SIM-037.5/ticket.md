# SIM-037.5: Overdue badge, reminder and extension request

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P2 |
| Size | S |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-037.2, SIM-037.3 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/99 |

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

### 2026-11-25 — claude — DONE
- Agent calls: 7 total, tokens ~493k (planner×1 sonnet 88k, implementer×2 134k+22k, reviewer×2 74k+24k, security auditor×2 via general-purpose 99k+52k; in/out split not reported)
- Done: fast lane (no consult); slice 1 (API) only, UI split to SIM-037.11; attempt 1 REWORK (overdue null for owned devices without expiry), attempt 2 PASS; security no 🔴; rebased on main (SIM-040), checks green except the known flaky dev-process test.
- In progress / next: Ming opens the PR (M-69, prefilled link in chat), confirms the planner assumptions and the split, waits for CI test:db, merges. Then SIM-037.11.
- Gotchas: no local Postgres, new SQL never executed here. 🟡 deactivation lock cycle still open (SIM-037.4) with three more paths.
