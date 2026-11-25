# SIM-039.5: Editor palette and map rendering from the catalog

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-039.3, SIM-039.4 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T13:19:54Z |
| PR | — |

## Goal
The editor's "Add items" palette and both maps show the org's catalog: names, groups, order, hidden flags, sizes and art.

## Scope reference
`docs/spec-v1.md` LAY-01, LAY-03, LAY-06, LAY-07 (map item catalog, phase 1), DEV-01; `work/decisions.md` D61, D64, D66 (OQ-46 to OQ-53).

## Scope
- Palette from `GET /api/map-items`; editor ghost and hit areas use catalog sizes.
- Renderer per direction: custom image → package sprite → library frame → placeholder, for fixtures, desk, chair and floors; package sprite on a resized item drawn at its own size, bottom-left aligned (OQ-53 default).
- Images loaded via `apiFetch` and `blob:` URLs cached per version.

## Out of scope
- Admin-created item kinds and per-desk art (later phase, D66). Changing how placed fixtures are stored (`sprite_key` stays).
- Admin page (039.6).

## Acceptance criteria
- [ ] Palette shows Admin names/groups/order and hides hidden items.
- [ ] Custom art shows on the editor and read-only map; a failing image draws the placeholder.
- [ ] Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally.

## Technical notes
- Generalise the image draw op used for device types.
- Runs in parallel with SIM-037.x except where noted (migrations, nav, device types).

## Test plan
- Unit and DB tests as the plan lists. Manual: as the plan lists.

## Notes / answers from Ming
- 2026-11-25: scope from Ming's answers on the map item catalog (D66); OQ-52/OQ-53 take their defaults.

## Handoff
