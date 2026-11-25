# SIM-039.3: Catalog footprints in the layout validator, resolver and save

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | api, architecture |
| Gate | plan-approval |
| Depends on | SIM-039.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T08:04:50Z |
| PR | — |

## Goal
Overlap, desk-tile and bounds checks use each org's catalog sizes, so a resized item behaves at its new size; placing a hidden item anew is refused.

## Scope reference
`docs/spec-v1.md` LAY-01, LAY-03, LAY-06, LAY-07 (map item catalog, phase 1), DEV-01; `work/decisions.md` D61, D64, D66 (OQ-46 to OQ-53).

## Scope
- `src/lib/validate/layout.ts`, `resolveLayout`, `src/server/layout/save.ts` and the layout read take a footprint lookup from the catalog (w/h swapped at 90°/270°).
- Hidden item already placed: kept; newly placed: 422.

## Out of scope
- Admin-created item kinds and per-desk art (later phase, D66). Changing how placed fixtures are stored (`sprite_key` stays).
- Editor UI (039.5).
- The layout GET's `seatDevices` part (SIM-037 territory).

## Acceptance criteria
- [ ] Existing saved layouts still validate and draw unchanged.
- [ ] A layout using a resized item is validated at the new size; overlaps are refused.
- [ ] Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally.

## Technical notes
- Main complexity of D66 point 8. Plan approval recommended (validator core) even though no High path.
- Runs in parallel with SIM-037.x except where noted (migrations, nav, device types).

## Test plan
- Unit and DB tests as the plan lists. Manual: as the plan lists.

## Notes / answers from Ming
- 2026-11-25: scope from Ming's answers on the map item catalog (D66); OQ-52/OQ-53 take their defaults.

## Handoff
