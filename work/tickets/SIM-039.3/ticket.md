# SIM-039.3: Catalog footprints in the layout validator, resolver and save

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | api, architecture |
| Gate | plan-approval |
| Depends on | SIM-039.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/94 |

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
- 2026-11-25: Plan approved (Ming: "duyệt"), assumptions A1-A9 as written. Ming runs the pre-deploy SQL from the plan before 039.3 ships.

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 3 (api-platform-engineer×1 50k, software-architect×1 112k, planner×1 130k; default models)
- Done: plan READY (`plan.md`): FootprintLookup in the pure validator (registry default), catalogFootprints builder, route pre-check split (parseLayoutSave), size rules and hidden rule inside the save after a `for key share` catalog read, new 422 `layout_item_hidden`, additive `items` on the layout response. No High path.
- In progress / next: Ming approves A1-A9 (M-66) and runs the pre-deploy SQL in the plan before 039.3 ships; then implement and review.
- Gotchas: departs from the ticket text with `for key share` (A1); size-dependent 422s now come after 404/409 (A6); editor and server can disagree until 039.5 (A8).

### 2026-11-25 — claude — DONE
- Agent calls: 6 (api-platform-engineer×1 50k, software-architect×1 112k, planner×1 130k, implementer×1 117k, reviewer×1 72k, security-ai-generated-code-auditor×1 69k; default models; ~550k total)
- Done: catalog footprints in validator, resolver, save and read; route pre-check split; hidden-item rule with 422 `layout_item_hidden`; additive `items` on the layout response. Review PASS on attempt 1, security no 🔴/🟡; PR https://github.com/mmlabs-online/simap/pull/94.
- In progress / next: Ming runs the pre-deploy SQL before deploy; SIM-039.4 next, then 039.5 (editor switches to catalog sizes).
- Gotchas: editor and server can disagree until 039.5 (A8); pre-existing handoffs test:db failures on main.
