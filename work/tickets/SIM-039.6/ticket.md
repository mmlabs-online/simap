# SIM-039.6: "Map items" admin page

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-039.2, SIM-039.4 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/103 |

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
- 2026-11-25 (orchestrator): planner split the ticket. This ticket is slice 1 (page, nav, grouped list, rename/regroup/show-hide, size with in-use warning, reset). Art per direction moves to SIM-039.9. No reorder UI (D67); the ticket and LAY-07 "reorder" wording is stale.
- 2026-11-25: Plan approved (Ming: "duyệt SIM-039.6") for slice 1, assumptions A1-A11 as written.

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 3 (frontend-developer×1 45k, ux-architect×1 43k, planner×1 127k; default models)
- Done: plan READY (slice 1, ~480 product lines): MapItemsPage/View, edit dialog, size editor with confirm before deleting images, in-use 409 with room count, reset dialog, nav entry (icon `chair`), API client patch/reset. Split: art per direction → SIM-039.9 (added to the board).
- In progress / next: Ming approves A1-A11 (M-72), then implement and review.
- Gotchas: reorder dropped (D67); slice 1 slightly over the 400-line guide (A11: reset can move to slice 2 if needed).

### 2026-11-25 — claude — DONE
- Agent calls: 5 (frontend-developer×1 45k, ux-architect×1 43k, planner×1 127k, implementer×1 81k, reviewer×1 66k; default models; ~362k total)
- Done: slice 1 — Map items admin page (grouped list, edit dialog with rename/regroup/hide/size, in-use warning, reset), nav entry, API client patch/reset. Review PASS on attempt 1; PR https://github.com/mmlabs-online/simap/pull/103.
- In progress / next: SIM-039.8 (map art rendering) is runnable; SIM-039.9 (art per direction on this page) after 039.6 and 039.8 merge.
- Gotchas: "reorder" wording in ticket/LAY-07 is stale (D67).
