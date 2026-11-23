# SIM-013: Devices — placement rules, read and placement API

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P1 |
| Size | M |
| Areas | api |
| Gate | plan-approval |
| Depends on | SIM-012 |
| Needs Ming | M-31 |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-23T14:44:34Z |
| PR | — |

## Goal
Slice 1 of 4 of Devices: the pure placement and permission rules, the device list/detail read API with placement, and one
placement API for place, lend, move and return. The primary/secondary rules always hold. Slices 2–4 are SIM-013.1
(create/edit/delete API), SIM-013.2 (Devices page UI) and SIM-013.3 (place/move dialog).

## Scope reference
spec DEV-01..05, REG-03 (device); D19, D22. Re-scoped 2026-11-23 by the approved plan (`plan.md`, Split proposal).

## Scope
- `src/lib/devices/*` (types, rules), `src/lib/validate/device.ts` (query and placement body), `src/server/devices/*`,
  `GET /api/devices`, `GET /api/devices/[id]`, `PUT /api/devices/[id]/placement`, four new error codes.

## Out of scope
- Device create/edit/delete and MAC (SIM-013.1), any UI (SIM-013.2, SIM-013.3), bulk import, any migration.

## Acceptance criteria
- [ ] Placing as primary is refused unless the seat's occupant owns the device and the seat has no primary.
- [ ] A Manager can move another member's device; a User cannot.
- [ ] The device list API shows placement for every device (UI in SIM-013.2).
- [ ] Unit tests cover placement rules and permission matrix.
- Moved to SIM-013.1: deleting a placed device is refused until it is in inventory.

## Technical notes
- Files: `src/server/devices/*`, `src/app/api/devices/**`, `src/app/(app)/devices/*`, `src/ui/devices/*`; reference seatMGT `src/lib/actions/devices.ts` + tests.
- Risks / open questions: —

## Test plan
- Unit: placement rules, permissions.
- Manual: none for this slice (lend and move between seats is checked after SIM-013.3).

## Notes / answers from Ming
- 2026-11-23: Plan approved (all defaults, assumptions 1-9; Ming: "duyệt plan SIM-013, chạy luôn"). Ticket re-scoped to slice 1 (API only); SIM-013.1 (create/edit/delete API), SIM-013.2 (Devices page UI), SIM-013.3 (place/move dialog) filed on the board.

## Handoff

### 2026-11-23 — claude — BLOCKED (plan approval)
- Agent calls: 3, tokens ~170k total (api-platform-engineer×1 inherit 37k, frontend-developer×1 inherit 48k, planner×1 inherit 85k; in/out split not reported)
- Done: Gate set to plan-approval (P1 policy); consults saved; plan.md READY as slice 1 of 4 (API only: rules, list/detail, placement endpoint; no migration, no High path).
- In progress / next: Ming approves (M-31). Then the orchestrator re-scopes this ticket to slice 1 and files SIM-013.1 (create/edit/delete API), SIM-013.2 (Devices page UI), SIM-013.3 (place/move dialog) on the board.
- Gotchas: slice 1 is ~480 source lines; `src/lib/api/error.ts` and `src/ui/copy/api.ts` are shared with SIM-014 (rebase likely). Node in bash: `eval "$(fnm env --shell bash)"`.
