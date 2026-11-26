# SIM-042 consult (frontend / registry / palette). Read-only, nothing edited.

## Findings

**1. FIXTURE_GROUPS is the hidden gate (not in the ticket's file list).**
- `src/lib/validate/layout.ts:46` hard-codes `FIXTURE_GROUPS` (cabinet, circulation, door, label, lamp, marker, partition, plant, prop, rack, shelf, sofa, table, wall, whiteboard, window).
- Palette, `LIBRARY_ITEMS` (`src/lib/map-items/library.ts`) and layout validation (`spriteOk`) all filter on it. A key in a group that is not listed there is not in the palette, not in the Map items page, and is refused with `layout_unknown_sprite`.
- Each new group, or each new key in an existing group, must be checked against this list. `lamp` is already in it.
- `ALLOWED_GROUPS` in `src/lib/map-items/art.ts` is derived from `LIBRARY_ITEMS`, so custom-art frames follow automatically.

**2. How a key reaches each surface.**
- The registry (`keys.json`) feeds `FRAME_KEYS`, `SPRITES` (base key = key without the `.n/.e/.s/.w` suffix), `paletteEntries()` and `LIBRARY_ITEMS`.
- Name is `mapItemName(key)` (dots and underscores become spaces). Size is `footprintOf(base, 0) ?? [1,1]`. Group is the registry `group`.
- `catalogPalette` and the Map items page read DB rows, so the new items show up only after the migration backfill (finding 4).
- The sprite browser uses `bundledKeys(meta.sources)`, which counts only `map` or `export`. The new keys appear there once `sprite-map.json` and the repacked atlas contain them. `bundled.ts` needs no change, and `bundled.test.ts` is already count-agnostic since SIM-041.
- Directional families need all of n/e/s/w, and e/w tiles must equal the s tiles swapped (`scripts/sprites/registry.test.ts`).
- `sprite-map.json` tiles must equal `REGISTRY[key].tiles ?? [1,1]`.
- `committed-atlas.test.ts` requires the manifest keys to equal `FRAME_KEYS`, manifest blocks to equal the registry, and every sprite-map key to be a `map` source. Run `pnpm sprites:pack` and commit both `public/sprites/office.png` and `office.json`.
- Direction mapping (from the `sprite-map.json` `_doc`): pack front = `.s`, back = `.n`, left = `.w`, right = `.e`.
- Atlas width is 1024 and the shelf packer grows in height. 24 new frames take it from 97 to 121 frames. The pack tests use their own fixtures, so I expect no test change.

**3. Tests that hard-code counts.** Library goes from 53 to 59 if six keys are added (fixtures 47 to 53).
- `src/lib/map-items/library.test.ts`: lines 12-14 (53), 23 (47), 42 (53).
- `src/server/map-items/map-items.db.test.ts`: 47, 53, 58, 108, 110, 120, 131, 132, 155, 157. This is the 53/52/54 family, +6 each.
- `src/server/layout/layout.db.test.ts:374` (53).
- `scripts/schema-check.mjs`: lines 853, 863, 866, 883. Change 53 to 59 and 52 to 58. Add the new keys to the spot-size check at line 870.
- `palette.test.ts` and `pack.test.ts` are derived or count-agnostic: no change. `registry.test.ts` and `committed-atlas.test.ts` have no counts and pick the new keys up automatically.
- `src/lib/map-items/footprints.test.ts` and the `library.test.ts` "validator accepts" test iterate the registry. They will fail loudly if a group is missing from `FIXTURE_GROUPS`.

**4. The migration must backfill existing orgs.**
- `map_items_seed` inserts only when `map_item_catalogs` has no row for the org (`if found`). Orgs seeded on 2026-11-25 will never get new rows from a redefined function.
- The migration therefore needs two parts:
  - `create or replace function map_items_seed` with the full list including the 6 new rows.
  - An `insert ... select` of the new rows for every org in `map_item_catalogs`, with `on conflict do nothing`. No existing row changes.
- Name collision: the unique index `(org_id, device_type_key(name))` could clash if an admin renamed an item to, say, "lamp desk". `on conflict do nothing` (no target) would skip that row silently, leaving that org without it. Decide whether that is acceptable.
- The seed names must equal `mapItemName(key)`, because `map-items.db.test.ts` compares them to `LIBRARY_ITEMS`.
- A new file after `20261125230000_device_type_sprite.sql` is needed.
- It is expand-only and safe for the previous image. The list route drops rows whose key is not in the library, and the existing test "a row with a builtin_key not in the library is not listed" covers that.
- The FK on `sprite_key` needs the row to exist before any new-key placement.
- Old image reading a layout with a new key: `resolveLayout` already drops unknown keys. Not a regression.

**5. Wall-mounted vs floor, from the code.**
- Draw order is by layer first (floor, wall, shadow, furniture, avatar, overlay), then by row, tier, x and id (`placement.ts` ~396-405).
- Overlap: only `blocks:true` items occupy cells (`layout.ts:233-243`). Wall pieces and windows are `blocks:true`, so a `blocks:true` item cannot overlap them.
- Fixtures may not touch a desk tile (D61, `layout_fixture_on_desk`). The existing `prop.mug` and `prop.papers` have this limit too, so a desk lamp is a prop beside the desk, not on it.
- Rotation is allowed only for directional keys. Non-directional keys with rotation not 0 fail with `layout_bad_rotation`.
- If a wall-mounted item were on layer `wall` with `blocks:false`, it would tie with `wall.face` on row, tier and x, and the order would fall to id. It could be hidden. Use layer `furniture`, which always paints above `wall`. The existing `whiteboard` (furniture layer, 2x1) is the precedent for a wall-mounted item.

**6. Source art (`props_*.json`).**

| Item | Views | Source px / anchor | Footprint |
|---|---|---|---|
| desk lamp | 4 | 16x37, 26x33, 26x33, 16x32 | 1x1 |
| water cooler | 4 | 24-26 x 55 | 1x1 |
| trash bin | 4 | 20x31, same anchor | 1x1 |
| wall clock | 4 | front/back 32x23; left/right slivers 8x44 | 1x1 |
| projector screen | 4 | front/back 70x31; left/right 10x90 | front/back 2x1, left/right 1x2 |
| flip chart | 4 | front 28x37 (shorter than the others); back/left/right ~28-30 x 57 | 1x1 |

- Projector screen: the s/n versus e/w tiles match the registry rule (2x1 and 1x2).
- Flip chart: the front view is a different, shorter pose, so check it by crop.
- Anchors are in the source JSON, ready to copy into `sprite-map.json`.

## Recommendations

**A. Keys and groups.** The existing convention is group = first key segment (`lamp.floor`, `plant.large`, `table.coffee`) and name = key with spaces ("lamp floor").
- `lamp.desk.{n,e,s,w}`: group `lamp` (already allowed), layer furniture, `tiles:null`, `blocks:false`, `shadow:false`. This mirrors `prop.mug` and sorts as a sub-tile prop on top of its host. Footprint is 1x1.
- `clock.wall.{n,e,s,w}`: new group `clock`, layer `furniture`, `tiles:null`, `blocks:false`, `shadow:false`. `tiles:null` gives it tier 2, so it paints after the wall pieces. It can overlap `wall.face`. Place on the face row.
- `screen.projector.{n,e,s,w}`: new group `screen`, layer furniture, `tiles:[2,1]` for n/s and `[1,2]` for e/w, `blocks:false` (so it can hang on the wall face), `shadow:false`. If Ming prefers it to behave like the whiteboard, use `blocks:true`.
- `cooler.water.{n,e,s,w}`: new group `cooler`, furniture, `[1,1]`, `blocks:true`, `shadow:true`.
- `bin.trash.{n,e,s,w}`: new group `bin`, furniture, `[1,1]`, `blocks:true`, `shadow:true`. `blocks:false` is arguable for a small bin; the plants block, so `true` is consistent.
- `chart.flip.{n,e,s,w}`: new group `chart`, furniture, `[1,1]`, `blocks:true`, `shadow:true`.
- Add `clock`, `screen`, `cooler`, `bin` and `chart` to `FIXTURE_GROUPS`. That is a `src/lib/validate/layout.ts` change, which must be listed in the plan (R4).
- Alternative: natural-name keys such as `water.cooler` (name "water cooler") instead of "cooler water". Admins can rename later, but the seed must equal `mapItemName(key)`. Ming's call (see Open questions).

**B. Plants: do not make `plant.small` and `plant.large` directional.**
- It would remove the frames `plant.small` and `plant.large`. It also lets new-image layouts store rotation not 0 for a key the previous image treats as non-rotatable, so a rollback would hit `layout_bad_rotation`. That breaks the "layout saved by the previous image still loads" criterion in the reverse direction.
- Several tests use plant as the non-rotatable example (`editor-state.test.ts` ~113, `schema-check.mjs` keeps `plant.large`).
- If more plant art is wanted, add new directional keys (for example `plant.office.*` from `office_plant_*`). The existing `plant.small` already uses `office_plant_front` and `plant.large` uses `tall_plant_front`, so the gain is small. Default: drop plants from the ticket.

**C. Optional 2dPig-only objects.** They fit as `map` entries with `scale:2`, but SIM-041 found nothing clearly mappable (`impl-log.md`). Defer to a follow-up. Per SIM-041 only door.n/s, sofa, table.coffee and window.double came from 2dPig.

**D. Plan and checks.**
- Same-task changes: `keys.json`, `FIXTURE_GROUPS`, `sprite-map.json` (24 entries with `note`), repacked atlas, `CREDITS.md`, the migration, and the counts in finding 3.
- Run `pnpm check:layers` and `pnpm typecheck`. `pnpm migrate:smoke`, `schema:check` and `test:db` need a local DB.
- Acceptance "placed, rotated and saved": add a small test, in `library.test.ts` or a new test, that each new key resolves for 0/90/180/270 and that `checkLayoutRules` accepts it with a `lamp.desk` beside a desk. Also check that a `clock.wall` on a `wall.face` cell gives no `layout_overlap`.

## Risks
- Missing `FIXTURE_GROUPS` entry: the item is silently invisible and the save is refused (finding 1).
- Wrong layer or `blocks` for wall items: hidden behind wall pieces, or `layout_overlap` with `wall.face` (finding 5).
- Seed or backfill name mismatch with `mapItemName(key)`, or a name collision with an admin-renamed row, would fail or skip rows. Run `test:db`.
- Making plants directional breaks rollback and non-rotatable tests (B).
- Visual fit is unverified. The 8x44 clock slivers (e/w), the 10x90 screen slivers and the short flip-chart front need a crop check and a look in `/dev/roommap`. No browser was available in the SIM-041 run either.
- Many hard-coded counts (finding 3). Missing one gives a red `test:db` or `schema:check`.
- The migration is a High path, so it needs the plan gate and a security review per `loop.config.md`.

## Open questions
1. Key naming: `clock.wall` (convention, name "clock wall") or `wall.clock` (natural name, but group would be `wall` or a separate group)? The recommendation above keeps the convention.
2. Projector screen: `blocks:false` (hangs on the wall face) or `blocks:true` like the whiteboard? Footprint 2x1 for n/s is the pack default.
3. Is a new group per object acceptable (clock, screen, cooler, bin, chart), or should they share one group such as `decor`? One group means one `FIXTURE_GROUPS` addition and a shorter palette.
4. On a name collision for an existing org, skip silently or suffix the name?
5. Drop the plant directions and the 2dPig extras from SIM-042? I recommend yes.

Files reviewed: `src/lib/sprites/keys.json`, `registry.ts`, `placement.ts`, `src/lib/validate/layout.ts`, `src/lib/map-items/library.ts` and `art.ts`, `src/lib/layout-editor/palette.ts`, `db/migrations/20261125200000_map_items.sql`, `scripts/schema-check.mjs`, and `assets/art/sources/imersa-office/props_decor.json`, `props_desk_items.json`, `props_kitchen.json`, `props_meeting.json`.
