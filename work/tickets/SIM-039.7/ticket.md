# SIM-039.7: Device types: pick a bundled package sprite

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P2 |
| Size | S |
| Areas | db, api, ui |
| Gate | plan-approval |
| Depends on | SIM-039.9 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T17:49Z |
| PR | — |

## Goal
A device type's art can be an uploaded image, a sprite picked from the bundled package, or the slot's built-in sprite (DEV-01, D66 point 7).

## Scope reference
`docs/spec-v1.md` LAY-01, LAY-03, LAY-06, LAY-07 (map item catalog, phase 1), DEV-01; `work/decisions.md` D61, D64, D66 (OQ-46 to OQ-53).

## Scope
- Column for the chosen sprite key, API and the device types page picker (reuses the 039.6 sprite browser); renderer fallback image → sprite → slot sprite.

## Out of scope
- Admin-created item kinds and per-desk art (later phase, D66). Changing how placed fixtures are stored (`sprite_key` stays).

## Acceptance criteria
- [ ] A device type with a picked sprite draws it on desks; upload still wins.
- [ ] Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally.

## Technical notes
- Likely a migration (High path). Run after SIM-037.8 (device types page).
- Runs in parallel with SIM-037.x except where noted (migrations, nav, device types).

## Test plan
- Unit and DB tests as the plan lists. Manual: as the plan lists.

## Notes / answers from Ming
- 2026-11-25: scope from Ming's answers on the map item catalog (D66); OQ-52/OQ-53 take their defaults.

## Handoff
