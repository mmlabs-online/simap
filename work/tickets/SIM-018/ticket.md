# SIM-018: CSV export and layout image export

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | S |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-017, SIM-015.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Managers export the org's lists for Excel, and anyone can save a room layout as an image.

## Scope reference
spec DSH-02 export; D27.

## Scope
- CSV (UTF-8 with BOM) for seats with occupants, devices, members (Manager+).
- Room layout PNG export from the room view (client-side), if feasible (Should).

## Out of scope
- `.xlsx`.

## Acceptance criteria
- [ ] CSV opens in Excel with correct Vietnamese characters in names.
- [ ] Exports contain only the caller's org.
- [ ] Users get 403 on CSV routes.
- [ ] Unit tests cover CSV escaping.

## Technical notes
- Files: `src/server/export/*`, `src/app/api/export/*`, `src/ui/roomlayout/exportPng*`.
- Risks / open questions: PNG export of the canvas may need a small library; keep it optional.

## Test plan
- Unit: CSV escaping.
- Manual: open the CSV in Excel; save a PNG.

## Notes / answers from Ming
—

## Handoff
