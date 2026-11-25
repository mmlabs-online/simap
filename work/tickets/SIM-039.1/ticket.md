# SIM-039.1: Map item catalog: schema, per-org seed and read API

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | db, api, security |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T07:30:49Z |
| PR | — |

## Goal
Each org has one catalog row per library item (fixtures, floors, `desk.single`, `chair.office`) that the editor, map and admin page can read.

## Scope reference
`docs/spec-v1.md` LAY-01, LAY-03, LAY-06, LAY-07 (map item catalog, phase 1), DEV-01; `work/decisions.md` D61, D64, D66 (OQ-46 to OQ-53).

## Scope
- Migration: `map_items` keyed by (`org_id`, `builtin_key`) with name, group, order, size `w × h`, hidden, and per-direction art (package sprite key or custom image columns), composite FKs, seed for existing orgs and a trigger/marker for new ones (SIM-036.2 pattern); `schema-check.mjs`.
- `GET /api/map-items` for any member.
- `layout_fixtures` and saved layouts unchanged.

## Out of scope
- Admin-created item kinds and per-desk art (later phase, D66). Changing how placed fixtures are stored (`sprite_key` stays).
- Admin writes (039.2), images (039.4), footprint use (039.3).

## Acceptance criteria
- [ ] A new and an existing org each get the full seeded catalog with library defaults (name from key, group, footprint size).
- [ ] `GET /api/map-items` returns only the caller's org rows.
- [ ] Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally.

## Technical notes
- High path (`db/migrations/**`): plan approval. Do not plan it at the same time as a SIM-037.x ticket that adds a migration; merge one before the other.
- Runs in parallel with SIM-037.x except where noted (migrations, nav, device types).

## Test plan
- Unit and DB tests as the plan lists. Manual: as the plan lists.

## Notes / answers from Ming
- 2026-11-25: scope from Ming's answers on the map item catalog (D66); OQ-52/OQ-53 take their defaults.
- 2026-11-25 (Ming, answers on plan A1-A11): A1 "name Alphabet" — items are ordered alphabetically by name, not by a seeded palette order. A2, A3, A5-A8, A10, A11 ok. A4 changed: hidden items are not returned to members (non-Admin); Admins still get them for the admin page. A9 changed: placed items on a saved room layout get a foreign key to `map_items`; when an item's name or image changes, the saved room layouts show the change. Re-plan with these answers; the plan needs approval again (D67).
- 2026-11-25: Plan approved (Ming: "duyệt SIM-039.1") for the re-plan after D67, assumptions as written; A13 takes the plan's default (one-off cleanup of undrawable placements, not `not valid` FKs).

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 3 (database-optimizer×1 40k, api-platform-engineer×1 37k, planner×1 122k; default models; ~199k total)
- Done: plan READY (`plan.md`): migration `20261125200000_map_items.sql` (map_items + map_item_catalogs + seed function + members trigger + backfill, 53 seeded rows), `GET /api/map-items`, DTO for SIM-039.2 to 039.6, sync test against the library, DB tests and schema-check.
- In progress / next: Ming approves the plan with A1-A11 (M-62), then implement (local Postgres 16 throwaway cluster, plan step 9) and review.
- Gotchas: A2 spec says rotation 0 = `n` but the code draws `s` at rotation 0 (sizes equal today); A10 future keys.json additions need a follow-up to reach existing orgs.

### 2026-11-25 — claude — BLOCKED (re-plan)
- Agent calls: 1 (planner×1 default; re-plan with Ming's answers and D67)
- Done: plan rewritten: alphabetical order (no sort_order), hidden items only for Admins, FKs from `layout_fixtures.sprite_key` and desk `seats.sprite_key` to `map_items` with a one-off cleanup of undrawable placements (A13), catalog seed call in the layout save (A14).
- In progress / next: Ming approves the re-plan (M-62), then implement and review.
- Gotchas: sibling impacts written in the plan (039.2 no reorder, 039.3 layout read joins the catalog and returns placed hidden items, 039.6 no reorder UI); spec LAY-07 and D66 (1) need a text update (A15).
