# SIM-037.6: Device detail page with history

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P2 |
| Size | M |
| Areas | ui, api, ux |
| Gate | none |
| Depends on | SIM-037.4, SIM-037.5 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/102 |

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

### 2026-11-25 — claude — DONE
- Agent calls: 6, tokens ~493k total (in/out split not reported): frontend-developer×1 59k, api-platform-engineer×1 40k (max 2 consultants; ux skipped), planner×1 113k, implementer×1 178k, reviewer×1 71k, security-ai-generated-code-auditor×1 33k; all on their default models.
- Done: slice 1 (history API, read-only detail page, links); the planner split viewer actions into SIM-037.13. Attempt 1 PASS. Security had no 🔴. Checks green except `test:db`, which has 19 pre-existing failures on main, verified identical on origin/main by the reviewer. PR #102.
- In progress / next: Ming confirms the split and assumptions 1–8 and merges #102. File a BUG for the `device_handoffs` start inserts failing the `orgQuery` guard (transfer, return and extension starts all 500), then SIM-037.13.
- Gotchas: `history.db.test.ts` uses a `beginHandoff` helper because of that bug; switch it to the real start functions after the fix. `pnpm test:db` locally needs Docker Desktop started first.
