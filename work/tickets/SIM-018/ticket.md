# SIM-018: CSV export

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | S |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-017 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Managers export the org's lists for Excel.

## Scope reference
spec DSH-02 export; D27.

## Scope
- CSV (UTF-8 with BOM) for seats with occupants, devices, members (Manager+).

## Out of scope
- `.xlsx`.
- Room layout PNG export (D27 "if feasible"): follow-up, do not build (D47); comes with the map tickets.

## Acceptance criteria
- [ ] CSV opens in Excel with correct Vietnamese characters in names.
- [ ] Exports contain only the caller's org.
- [ ] Users get 403 on CSV routes.
- [ ] Unit tests cover CSV escaping.

## Technical notes
- Files: `src/server/export/*`, `src/app/api/export/*`.
- Risks / open questions: —

## Test plan
- Unit: CSV escaping.
- Manual: open the CSV in Excel.

## Notes / answers from Ming
- 2026-11-20 (D47): CSV only; layout PNG export stays a follow-up.

## Handoff

### 2026-11-20 — claude — BACKLOG (board update, D47)
- Done: scope cut to CSV export; PNG export moved to Out of scope as a follow-up; dependency on SIM-015.2 removed.
- Next: runs after SIM-017.
