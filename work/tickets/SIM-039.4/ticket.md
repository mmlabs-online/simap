# SIM-039.4: Custom map item images per direction: upload, remove, serve

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | api, security |
| Gate | plan-approval |
| Depends on | SIM-039.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T11:32:38Z |
| PR | — |

## Goal
Admins upload a PNG per direction for any catalog item (walls and windows included), stored in Google Drive like device type images.

## Scope reference
`docs/spec-v1.md` LAY-01, LAY-03, LAY-06, LAY-07 (map item catalog, phase 1), DEV-01; `work/decisions.md` D61, D64, D66 (OQ-46 to OQ-53).

## Scope
- PUT/DELETE/GET per item and direction; size = 32 px per tile of the item's current size for that direction, up to 32 px upward overhang (floors exactly 32 × 32), max 64 KB, PNG only, no APNG.
- Reuse `readBytes`, a size-aware `validatePng`, `OrgDrive`, compare-and-set, ETag `private, no-cache`, `driveFailure` (no 401/403, R7).

## Out of scope
- Admin-created item kinds and per-desk art (later phase, D66). Changing how placed fixtures are stored (`sprite_key` stays).
- Rendering (039.5).

## Acceptance criteria
- [ ] Wrong size / not PNG / too large → 422 before any DB or Drive call.
- [ ] Replace and remove delete the old Drive file; cross-org → 404.
- [ ] Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally.

## Technical notes
- Extract the shared Drive image flow from `src/server/device-types/image.ts`; keep device-type behaviour unchanged.
- Runs in parallel with SIM-037.x except where noted (migrations, nav, device types).

## Test plan
- Unit and DB tests as the plan lists. Manual: as the plan lists.

## Notes / answers from Ming
- 2026-11-25: scope from Ming's answers on the map item catalog (D66); OQ-52/OQ-53 take their defaults.

## Handoff
