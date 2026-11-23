# SIM-013: Devices

| Field | Value |
|---|---|
| State | BLOCKED |
| Priority | P1 |
| Size | M |
| Areas | api, ui |
| Gate | plan-approval |
| Depends on | SIM-012 |
| Needs Ming | M-31 |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
People track their devices and where they are; Managers place and move any device; the primary/secondary rules always hold.

## Scope reference
spec DEV-01..06, REG-03 (device); D19, D22, D31.

## Scope
- CRUD (owner or Admin edits/deletes; any member creates their own); MAC format and uniqueness per org.
- Placement: primary (owner = occupant, one per seat) / secondary; lend; move; return to inventory (owner, Manager+).
- Delete blocked while placed, with "Move to inventory" (D31).
- Devices page with all / placed / inventory filter; seatMGT `DeviceTable`, `DeviceFormDialog`.

## Out of scope
- Bulk import.

## Acceptance criteria
- [ ] Placing as primary is refused unless the seat's occupant owns the device and the seat has no primary.
- [ ] A Manager can move another member's device; a User cannot.
- [ ] Deleting a placed device is refused until it is in inventory.
- [ ] Devices list shows placement for every device.
- [ ] Unit tests cover placement rules and permission matrix.

## Technical notes
- Files: `src/server/devices/*`, `src/app/api/devices/**`, `src/app/(app)/devices/*`, `src/ui/devices/*`; reference seatMGT `src/lib/actions/devices.ts` + tests.
- Risks / open questions: —

## Test plan
- Unit: placement rules, permissions.
- Manual: lend and move devices between seats.

## Notes / answers from Ming
Waiting for Ming: plan approval (P1 policy)

## Handoff

### 2026-11-23 — claude — BLOCKED (plan approval)
- Agent calls: 3, tokens ~170k total (api-platform-engineer×1 inherit 37k, frontend-developer×1 inherit 48k, planner×1 inherit 85k; in/out split not reported)
- Done: Gate set to plan-approval (P1 policy); consults saved; plan.md READY as slice 1 of 4 (API only: rules, list/detail, placement endpoint; no migration, no High path).
- In progress / next: Ming approves (M-31). Then the orchestrator re-scopes this ticket to slice 1 and files SIM-013.1 (create/edit/delete API), SIM-013.2 (Devices page UI), SIM-013.3 (place/move dialog) on the board.
- Gotchas: slice 1 is ~480 source lines; `src/lib/api/error.ts` and `src/ui/copy/api.ts` are shared with SIM-014 (rebase likely). Node in bash: `eval "$(fnm env --shell bash)"`.
