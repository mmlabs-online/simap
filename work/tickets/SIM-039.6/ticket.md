# SIM-039.6: "Map items" admin page

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-039.2, SIM-039.4 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | — |

## Goal
Admins manage the catalog on one page next to Device types.

## Scope reference
`docs/spec-v1.md` LAY-01, LAY-03, LAY-06, LAY-07 (map item catalog, phase 1), DEV-01; `work/decisions.md` D61, D64, D66 (OQ-46 to OQ-53).

## Scope
- Grouped list like the palette, reorder, hide toggle, rename, visible `w × h` size editor with the in-use warning, package sprite browser with preview, per-direction upload and remove, reset to library defaults.
- Nav entry for Admins.

## Out of scope
- Admin-created item kinds and per-desk art (later phase, D66). Changing how placed fixtures are stored (`sprite_key` stays).

## Acceptance criteria
- [ ] Every action from 039.2/039.4 is reachable and shows its errors inline.
- [ ] Non-Admins see no page entry.
- [ ] Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally.

## Technical notes
- SIM-037.8 also edits the nav: expect a small conflict.
- Runs in parallel with SIM-037.x except where noted (migrations, nav, device types).

## Test plan
- Unit and DB tests as the plan lists. Manual: as the plan lists.

## Notes / answers from Ming
- 2026-11-25: scope from Ming's answers on the map item catalog (D66); OQ-52/OQ-53 take their defaults.

## Handoff
