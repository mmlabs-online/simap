# SIM-042: New built-in map items from the unused Imersa props

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P2 |
| Size | M |
| Areas | db, ui |
| Gate | plan-approval |
| Depends on | SIM-041 |
| Needs Ming | M-82, M-86 |
| Attempts | 1 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T03:48:33Z |
| PR | — |

## Goal
Offer more objects in the room editor by turning the Imersa "Office Pixel Art" props that are downloaded but unused
into new built-in library items with real art.

## Scope reference
- D54 (cut objects from original sheets via `sprite-map.json`), D66 points 1 and 5 (built-in catalog rows seeded per
  org; bundled atlas committed), D67. Imersa row in `assets/art/CREDITS.md`.
- D73 (Ming 2026-11-26, M-82): new built-in keys are in scope; amends D66 (1).
- Ming 2026-11-26: "2 và 3".

## Scope
- New registry keys in `src/lib/sprites/keys.json` for the uncut Imersa props, each with n/e/s/w where the pack has
  them: wall clock, desk lamp, water cooler, trash bin, projector screen, flip chart (sheets `props_decor`,
  `props_desk_items`, `props_kitchen`, `props_meeting`). Plus the remaining plant directions if the keys allow it.
- Optional, if SIM-041 shows a fit: 2dPig-only objects (vending machine, flags, coloured chairs) as new keys.
- Forward-only migration that seeds the new catalog rows for **existing** orgs and for new orgs
  (`map_items_seed`, `20261125200000_map_items.sql`), expand-only so the previous image keeps working (R2).
- `sprite-map.json` entries, repacked atlas, `CREDITS.md` "Sprites derived" updated.

## Out of scope
- Admin-created item kinds (later phase, D66). Recolouring. comshadow.

## Acceptance criteria
- [ ] Each new key is in the registry, the sprite map (rect, anchor, tiles) and the committed atlas as a `map` source.
- [ ] After the migration, every existing org and every newly created org has one catalog row per new key (name,
      group, footprint), and no existing row changes; `pnpm migrate:smoke`, `schema:check`, `test:db` pass.
- [ ] The new items appear in the editor palette and the "Map items" page and can be placed, rotated and saved.
- [ ] A layout saved by the previous image still loads (expand-only).
- [ ] All Checks pass.

## Technical notes
- Files: `src/lib/sprites/keys.json`, `assets/art/sprite-map.json`, `db/migrations/<new>.sql` (High path), seed tests in
  `src/server/map-items/*`, palette tests, `public/sprites/office.*`, `assets/art/CREDITS.md`.
- Risks: the seed function runs once per org (`map_item_catalogs`), so the migration must insert the new rows for
  already-seeded orgs and redefine the function for new ones; footprint per item (e.g. projector screen 2×1?) is a PM
  default to confirm in the plan.

## Test plan
- Unit: registry/palette tests for the new keys. DB: seed for existing and new orgs, idempotent.
- Manual: place each new item in `/dev/roommap` in all four directions.

## Notes / answers from Ming
- Plan approved (2026-11-26, Ming: "duyệt SIM-042"; assumptions A1-A14 accepted as written).
- 2026-11-26 Ming (M-82): "M-82 đồng ý" — adding new built-in library items is in scope; recorded as D73 (amends D66 (1)).

## Handoff

### 2026-11-26 — claude — BLOCKED
- Agent calls: 3, tokens ~206k total (database-optimizer×1 35k, frontend-developer×1 82k, planner×1 90k; default models).
- Done: consult (db, ui), plan.md READY with assumptions A1-A14.
- In progress / next: Ming approves the plan (M-86); then /run SIM-042 implements.
- Gotchas: new groups must be added to FIXTURE_GROUPS (layout.ts) or items are invisible; seed runs once per org, so the migration backfills existing orgs; name collisions with admin-renamed rows are handled explicitly (A5); many hard-coded 53/52 counts in tests and schema-check.
