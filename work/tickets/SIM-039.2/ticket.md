# SIM-039.2: Map item catalog admin API

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P1 |
| Size | M |
| Areas | api, security |
| Gate | plan-approval |
| Depends on | SIM-039.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T07:52:38Z |
| PR | — |

## Goal
Admins rename, regroup, reorder, hide/show, reset, pick a package sprite per direction, and resize catalog items.

## Scope reference
`docs/spec-v1.md` LAY-01, LAY-03, LAY-06, LAY-07 (map item catalog, phase 1), DEV-01; `work/decisions.md` D61, D64, D66 (OQ-46 to OQ-53).

## Scope
- Admin-only write routes; names/groups validated; resize 1–4 × 1–4 (desk, chair, floors fixed), refused with 409 `item_in_use` (with room count) while placed; a resize deletes the item's custom images (OQ-52 default); audited.

## Out of scope
- Admin-created item kinds and per-desk art (later phase, D66). Changing how placed fixtures are stored (`sprite_key` stays).
- Image upload (039.4).

## Acceptance criteria
- [ ] Each action works for Admin and is refused for Manager/User by the wrapper.
- [ ] Resize of a placed item → 409 `item_in_use`; of a fixed-size item → 422.
- [ ] Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally.

## Technical notes
- Lock the item row on resize; layout save (039.3) reads sizes with `for share` to avoid races.
- Runs in parallel with SIM-037.x except where noted (migrations, nav, device types).

## Test plan
- Unit and DB tests as the plan lists. Manual: as the plan lists.

## Notes / answers from Ming
- 2026-11-25: scope from Ming's answers on the map item catalog (D66); OQ-52/OQ-53 take their defaults.
- 2026-11-25: Plan approved (Ming: "duyệt SIM-039.2"), assumptions A1-A9 as written.

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 2 (api-platform-engineer×1 47k, planner×1 119k; default models)
- Done: plan READY (`plan.md`): admin routes PATCH /api/map-items/[key], PUT .../art/[dir], POST .../reset; new codes item_in_use (with rooms), item_fixed_size, item_name_taken, sprite_not_allowed; lock rules; audited writes; Drive cleanup after a resize or reset. No migration, no High path.
- In progress / next: Ming approves A1-A9 (M-64), then implement and review.
- Gotchas: audit entity_id is a uuid, so the key goes in meta.key; apiError (High path) left alone, routes build the item_in_use body; sibling notes for 039.3 (for key share), 039.4 (compare w/h), 039.6, 039.7.
