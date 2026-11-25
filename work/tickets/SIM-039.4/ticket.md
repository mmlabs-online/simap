# SIM-039.4: Custom map item images per direction: upload, remove, serve

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | api, security |
| Gate | plan-approval |
| Depends on | SIM-039.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/98 |

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
- 2026-11-25: Plan approved (Ming: "duyệt SIM-039.4"), assumptions A1-A12 as written.

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 2 (api-platform-engineer×1 50k, planner×1; default models)
- Done: plan READY (`plan.md`): sibling route `/api/map-items/[key]/art/[dir]/image` (PUT/DELETE Admin, GET member), parsePng + mapItemImageFits (32 px per tile, up to 32 px taller, floors 32×32, 64 KB), per-direction compare-and-set on file id, version, w, h; shared Drive helpers in `src/server/drive/image-flow.ts` with device-type behaviour unchanged. No High path, no migration.
- In progress / next: Ming approves A1-A12 (M-70), then implement and review.
- Gotchas: wrong-size 422 needs one read-only select first (departs from AC 1 text); handoffs.db.test.ts failures on main still need a bug ticket.

### 2026-11-25 — claude — DONE
- Agent calls: 5 (api-platform-engineer×1 50k, planner×1 96k, implementer×1 101k, reviewer×1 71k, security-ai-generated-code-auditor×1 48k; default models; ~366k total)
- Done: map item image route (PUT/DELETE Admin, GET member), size rule per item and direction, per-direction compare-and-set, shared Drive helpers with device-type behaviour unchanged. Review PASS on attempt 1, security no 🔴 (two 🟡); PR https://github.com/mmlabs-online/simap/pull/98.
- In progress / next: Ming decides where to fix the cross-org ETag 🟡 (here or 039.5/039.6); bug ticket for the 9 pre-existing test:db failures.
- Gotchas: test:db on main has 9 failures (handoffs ×7, devices ×1, members ×1); 039.6 needs map-item image error copy.
