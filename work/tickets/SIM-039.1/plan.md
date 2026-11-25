Status: READY

# Plan — SIM-039.1: Map item catalog: schema, per-org seed and read API

Re-plan 2026-11-25 after Ming's answers on A1-A11 (ticket *Notes / answers from Ming*) and **D67**. Changed against the
first plan: A1 (alphabetical order, no stored order), A4 (hidden items only for Admins), A9 (catalog FKs from placed
layout items). The other assumptions are kept as approved. The plan needs approval again (D67, High path).

## Scope summary
- D67: "(1) catalog items are listed alphabetically by name; (2) hidden items are not returned to non-Admin members,
  Admins still get them; (3) items placed on a saved room layout reference their catalog row by a foreign key, so
  renaming an item or changing its image changes how saved layouts show it. Amends the SIM-039.1 ticket line
  "`layout_fixtures` and saved layouts unchanged" and D66 where they conflict."
- D66 (1): "Admins manage the existing library items only (base keys of `src/lib/sprites/keys.json` in today's palette
  groups, `desk.single`, `chair.office`, every `floor.*`) ... Catalog rows are keyed by (`org_id`, `builtin_key`) and
  seeded per org". (Its "placed fixtures keep storing `sprite_key` (expand-only, saved layouts unchanged)" is amended by
  D67 (3): the column stays, it gains an FK.)
- D66 (2): "`chair.office` is a non-placeable row so chair art can be chosen." D66 (3): "Custom images are uploaded per
  direction (n/e/s/w) for directional items". D66 (7): "Every item has an explicit, visible size `w × h` in tiles,
  default the library footprint, Admin-settable to 1–4 × 1–4 (desk, chair and floors fixed); size is for rotation 0".
- LAY-03: "Each org starts with a catalog seeded with one row per base key of today's palette (...), every `floor.*` key
  and `chair.office`; each row has the library's group, a readable name from the key (e.g. "wall t s", "window
  double"), the library footprint as its size and no custom art. Existing layouts keep drawing exactly as before."
- LAY-07: "Any member can read the catalog (the map needs it); only an Admin changes it." "name (unique in the org,
  case- and space-insensitive, at most 60 characters), group (at most 40 characters ...)". "Items are never deleted."
  (Its "order (within its group; groups are ordered too)" is superseded by D67 (1), see A1.)
- Ticket scope: migration `map_items` + per-org seed + trigger/marker (SIM-036.2 pattern) + composite FKs +
  `schema-check.mjs`; `GET /api/map-items` for any member (hidden rows for Admins only, D67 (2)).

This plan also fixes the DB shape and the DTO that SIM-039.2 to 039.6 build on, and moves the FK work of D67 (3) into
this ticket (see "Sibling tickets").

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A new and an existing org each get the full seeded catalog with library defaults (name from key, group, footprint size) | `pnpm schema:check` steps `11 orgs existing before the migration get 53 map items` (orgs created in stage 1), `11 org created after the migration gets 53 map items on first member`, `11 spot sizes door 1x2, table.meeting 3x2, desk.single 2x1, prop.mug 1x1`; `map-items.db.test.ts › a new member's first visit seeds the library catalog once`; `library.test.ts` + `sql-sync.test.ts` prove the seed equals the library derivation |
| 2 | `GET /api/map-items` returns only the caller's org rows | `map-items.db.test.ts › list returns only the caller's org rows`; `map-items-routes.test.ts › 200 passes ctx.scope to the service` |
| 2a | (D67 1) items are listed alphabetically by name | `map-items.db.test.ts › list is ordered by lower(name), then builtin_key` (renames reorder the list) |
| 2b | (D67 2) hidden items are not returned to non-Admins; Admins get them | `map-items.db.test.ts › hidden rows: left out with includeHidden false, listed with hidden true when includeHidden true`; `map-items-routes.test.ts › admin tier passes includeHidden true; manager and user pass false` |
| 2c | (D67 3) placed items on saved layouts reference their catalog row by FK; existing saved layouts draw unchanged | `schema-check.mjs` steps `11 backfill keeps valid placed fixtures and seats`, `11 backfill drops undrawable fixtures and unplaces undrawable seats`, `11 fixture/seat with a key not in the org catalog refused (23503 ...)`, `11 map item referenced by a placement cannot be deleted (23503)`, `11 cross-org key refused`; `layout.db.test.ts` (whole file green after the fixture change, incl. `saved room round trip`); `layout.db.test.ts › a save in an org with no member seeds the catalog and stores the fixtures` |
| 3 | Every query scoped by token org (R6); Admin-only writes audited; checks green incl. `pnpm test:db` locally | Code review: the read uses `orgQuery(..., "where org_id = $1 ...")`; the Admin flag comes only from `ctx.tier` (from `org_roles`); no org from the request. **Audit: N/A in 039.1** — no Admin writes (the seed runs in a trigger/safety net with no actor, as `device_types`; the layout save audit row is unchanged). Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`, plus `pnpm migrate`, `pnpm migrate:smoke`, `pnpm schema:check`, `pnpm test:db` against the local throwaway cluster (Approach step 11); outputs recorded in impl-log |

## Ming verification after merge
- After the release migration runs on the shared DB: `GET /api/map-items` as an Admin returns 53 items, as a
  Manager/User also 53 (nothing is hidden yet), in name order.
- Open two rooms with saved layouts on the map and in the editor: they look exactly as before; saving a layout still
  works (nothing reads the catalog for drawing yet; 039.3/039.5 do).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261125200000_map_items.sql` | create: `map_items`, `map_item_catalogs`, `map_items_seed(p_org)`, members trigger, backfill, orphan cleanup, FKs `layout_fixtures_map_item_fkey` + `seats_map_item_fkey`, index `layout_fixtures_org_sprite_idx` | ticket scope + D67 (3) | **Yes** (`db/migrations/**`, `**/*.sql`) |
| `src/lib/map-items/types.ts` | create: `MAP_ITEM_LIMITS`, `MapItemKind`, `MapItemArtDto`, `MapItemDto`, `MapItemListResponse` | shared DTO for 039.1-039.6 (lib, UI may import, R1) | no |
| `src/lib/map-items/library.ts` | create: `mapItemName(key)`, `LIBRARY_ITEMS`, `libraryItem(key)` | single TS source of the seed and of derived facts (kind, directional, fixedSize, defaults for 039.2 reset) | no |
| `src/lib/map-items/library.test.ts` | create | unit tests of the derivation | no |
| `src/server/map-items/map-items.ts` | create: `listMapItems(db, scope, { includeHidden })`, `Row`, `COLS`, `toDto` | read service (`import "server-only"`) | no |
| `src/server/map-items/sql-sync.test.ts` | create | migration seed and checks equal the TS constants | no |
| `src/server/map-items/map-items.db.test.ts` | create | DB integration (`pnpm test:db`) | no |
| `src/app/api/map-items/route.ts` | create: `GET` | the read API | no |
| `src/app/api/map-items/map-items-routes.test.ts` | create | route tests (mocked service) | no |
| `src/server/layout/save.ts` | modify: one `orgQuery` calling `map_items_seed` after the seat-lock check (line 71), before the seat update (line 73) | FK safety net: a save in an org whose catalog was never seeded must not fail with 23503 (A14) | no |
| `src/server/layout/save.test.ts` | modify: `kinds()` (lines 55-67) maps `select map_items_seed` to `"catalog seed"`; the order test (lines 79-95) and any other full-sequence expectation get `"catalog seed"` after `"seat lock"` | statement order changed | no |
| `src/server/layout/layout.db.test.ts` | modify: `room()` (lines 27-39) calls `select map_items_seed($1)` for its org; replace `long or unknown sprite keys never break the read` (lines 251-263) with `sprite keys outside the org catalog are refused by the FK`; add `a save in an org with no member seeds the catalog and stores the fixtures` | direct SQL inserts of placements now need catalog rows; unknown keys can no longer be stored | no |
| `scripts/schema-check.mjs` | modify: stage 1 (after line 90) adds placed seats/fixtures in `oldRoomOrg` (valid and undrawable keys); after line 96 add "later run applies map_items"; lines 126-139 add `map_items`, `map_item_catalogs` to `counts()`; new section `// 11 map items (SIM-039.1)` after section 10, before `// extras` (line 783) | ticket scope (`schema-check.mjs`), backfill and FK checks | no |
| `db/migrations/README.md` | modify: one "Map items (SIM-039.1, ...)" bullet after the Device lifecycle bullet (~line 58) | schema doc kept current | no (`.md`) |

No other file. `src/server/layout/layout.ts` (read path), `src/lib/validate/layout.ts`, `src/lib/sprites/resolve-layout.ts`,
`src/lib/layout-editor/palette.ts`, `src/lib/api/error.ts`, `db/seeder.js` are read/imported only, not changed.

## Data model / migration
File `db/migrations/20261125200000_map_items.sql` (later than the newest, `20261125180000_handoff_decided_by.sql`; no
other open ticket adds a migration). Header comment: SIM-039.1 / D66 / D67, expand-only, art columns exist now so
039.2/039.4 need no migration; FK on the existing `sprite_key` columns.

**`map_items`** (one row per org and library item)
| Column | Type | Null | Default | Check (named) |
|---|---|---|---|---|
| `org_id` | uuid | not null | — | — |
| `builtin_key` | text | not null | — | `map_items_builtin_key_check`: `builtin_key ~ '^[a-z0-9]+(\.[a-z0-9]+)*$' and char_length(builtin_key) <= 100` |
| `name` | text | not null | — | `map_items_name_check`: `btrim(name) <> '' and char_length(name) <= 60` |
| `group_name` | text | not null | — | `map_items_group_name_check`: `btrim(group_name) <> '' and char_length(group_name) <= 40` |
| `w`, `h` | smallint | not null | — | `map_items_size_check`: `w between 1 and 4 and h between 1 and 4` |
| `hidden` | boolean | not null | `false` | — |
| `art_n_sprite`, `art_e_sprite`, `art_s_sprite`, `art_w_sprite` | text | null | — | `map_items_art_sprite_check`: each `~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$'` (ANDed; null passes) |
| `art_n_drive_file_id`, `art_e_…`, `art_s_…`, `art_w_…` | text | null | — | `map_items_art_image_check`: each `~ '^[A-Za-z0-9_-]{10,200}$'` (= `DRIVE_ID_RE`, ANDed; null passes) |
| `art_n_image_version`, `art_e_…`, `art_s_…`, `art_w_…` | integer | not null | `0` | `map_items_art_image_version_check`: all four `>= 0` |
| `created_at`, `updated_at` | timestamptz | not null | `now()` | — |

- No `sort_order` column (D67 (1), A1): the list is ordered by name.
- `constraint map_items_pkey primary key (org_id, builtin_key)` — the composite key 039.2/039.3/039.4 look up and lock,
  and the target of the layout FKs.
- `create unique index map_items_org_name_key on map_items (org_id, device_type_key(name))` — reuses the existing
  normalizer (case- and whitespace-insensitive, Vietnamese capitals mapped; LAY-07).
- No other index on `map_items` (≤ ~60 rows per org; the PK covers `where org_id = $1`; the name sort runs in memory).

**`map_item_catalogs`**: `org_id uuid primary key`, `seeded_at timestamptz not null default now()` — "seeded once" flag
and the per-org row 039.2 can lock (mirrors `device_type_catalogs`, `20261124160000_device_types.sql:32-35`).

**`map_items_seed(p_org uuid) returns void language plpgsql`**: insert marker `on conflict (org_id) do nothing`; `if found`
insert the 53 library rows `(p_org, '<key>', '<name>', '<group>', <w>, <h>)` `on conflict do nothing` (exact literal
form, one row per line, so `sql-sync.test.ts` can parse it). All art columns null / 0, `hidden` false.

**Trigger**: function `members_seed_map_items()` (`perform map_items_seed(new.org_id); return null;`) and
`create trigger members_seed_map_items_trg after insert on members for each row execute function members_seed_map_items();`
(fires alongside `members_seed_device_types_trg`; independent).

**Backfill (step 1, catalogs)**: `select map_items_seed(o.org_id) from (select org_id from members union select org_id
from rooms union select org_id from seats union select org_id from devices union select org_id from groups union select
org_id from device_type_catalogs) o;`. Every org that has a room has a catalog afterwards; `layout_fixtures` and
`seats` reference rooms by composite FK, so every org with a placed item is covered. Every key the current validator
accepts for a placement (`desk.single` for seats, the `FIXTURE_GROUPS` base keys for fixtures,
`src/lib/validate/layout.ts:45-63,96-102`) is a seeded key, so every drawable saved placement now resolves to its
org's catalog row with no data change.

**Backfill (step 2, undrawable placements, A13)**: a stored placement whose key has no row in its org's catalog is
exactly one that `resolveLayout` already drops today (`checkLayoutRules` → `spriteOk` fails,
`src/lib/sprites/resolve-layout.ts:81`), so:
- `delete from layout_fixtures f where f.sprite_key is not null and not exists (select 1 from map_items m where
  m.org_id = f.org_id and m.builtin_key = f.sprite_key);` — such a fixture is never drawn and the room's next save
  deletes it anyway (`save.ts:91-96` deletes every placed fixture).
- `update seats s set tile_x = null, tile_y = null, tile_rotation = null, sprite_key = null where s.sprite_key is not
  null and not exists (...same...);` — the seat row and its occupant/devices stay; with a null placement
  `resolveLayout` puts it in the same waiting list (`resolve-layout.ts:103-110`), so it lands on the same free slot as
  today. `updated_at` is left unchanged (not a user edit).
- Legacy fixtures (`kind` set, `sprite_key` null) are untouched; the FK does not apply to null keys (MATCH SIMPLE).

**FKs (step 3)**:
- `alter table layout_fixtures add constraint layout_fixtures_map_item_fkey foreign key (org_id, sprite_key)
  references map_items (org_id, builtin_key) on delete restrict;`
- `alter table seats add constraint seats_map_item_fkey foreign key (org_id, sprite_key) references map_items (org_id,
  builtin_key) on delete restrict;`
- `create index layout_fixtures_org_sprite_idx on layout_fixtures (org_id, sprite_key) where sprite_key is not null;`
  (serves 039.2's "in use" room count and the FK's parent-side check; non-unique, so the R6 unique-index rule does not
  apply). No such index on `seats` (only `desk.single`, which is fixed size and never deleted).
- Both FKs lead with `org_id` on both sides, so `schema-check` "2 every FK includes org_id on both sides" holds and a
  cross-org reference is impossible (R6).
- Floors stay keys inside `rooms.floor_zones` (jsonb, no FK possible; A12).

**How the layout read/save path resolves the item.** The FK column is the existing `sprite_key`, whose value already is
the base key = `map_items.builtin_key` (`validate/layout.ts:67`). So in 039.1:
- Save (`save.ts`): unchanged SQL for seats/fixtures; it gains one `map_items_seed` call (safety net, A14). The validator
  still refuses unknown keys with 422 before the transaction, so the FK never fires for API input.
- Read (`layout.ts`): unchanged; it returns `sprite` = builtin key per placement. Name and art are not copied into
  the layout; they are looked up by `(org_id, builtin_key)` at draw time, so a rename or image change shows on every
  saved layout. 039.3 adds the catalog join on that FK to the layout read (footprints, and the referenced items
  including hidden ones, see Sibling tickets); 039.5 draws from it.

**Expand / rollback (R2)**: new tables, function, trigger, two FKs and an index on existing columns; no column is
added, dropped, renamed or retyped. The previous image keeps working: it inserts members (trigger seeds), its saves
write only validator-accepted keys (all seeded, and every org it saves in has a member, hence a catalog), it never
reads or deletes `map_items`. The step 2 cleanup only touches rows the previous image already does not draw. Locks:
`add constraint ... foreign key` scans `layout_fixtures` and `seats` under SHARE ROW EXCLUSIVE inside the migration
transaction; both tables are small (hundreds of rows per org), so the write pause is milliseconds. Forward-only; no
down file (README rule; the "migrations reversible" line in loop.config Domain focus yields to R2/README). Rollback =
previous image; the new tables and FKs stay and are compatible with it. Dropping the FKs later is a plain forward
migration.

**Seed rows** (= `LIBRARY_ITEMS`; generate the VALUES from it with a throwaway node one-liner, do not hand-type; the sync
test locks it). Name = key with `.` and `_` replaced by spaces. Size = library footprint at rotation 0 (`tiles ?? [1,1]`).
| key | group | w×h |
|---|---|---|
| desk.single | desk | 2×1 |
| cabinet.filing | cabinet | 1×1 |
| elevator, stairs | circulation | 2×2 |
| door | door | 1×2 |
| label.sign | label | 1×1 |
| lamp.floor | lamp | 1×1 |
| marker.blocked | marker | 1×1 |
| partition.glass | partition | 1×1 |
| plant.large, plant.small | plant | 1×1 |
| prop.keyboard, prop.mouse, prop.mug, prop.papers (`tiles: null`) | prop | 1×1 |
| rack.server | rack | 1×1 |
| shelf.books | shelf | 2×1 |
| sofa | sofa | 2×1 |
| table.coffee (2×1), table.meeting (3×2) | table | |
| the 24 `wall.*` keys (`wall.base` … `wall.top`) | wall | 1×1 |
| whiteboard | whiteboard | 2×1 |
| window.double (2×1), window.single, window.single.top | window | |
| floor.carpet, floor.carpet.alt, floor.lavender, floor.wood | floor | 1×1 |
| chair.office | chair | 1×1 |

All 53 derived names are distinct (keys contain no spaces or `_`), so the unique index cannot abort the migration;
`library.test.ts` asserts it under `deviceTypeKey`.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/map-items` | none | `200 MapItemListResponse`, `Cache-Control: no-store` | 401/403 from `withAuth` only; 503 `unavailable` (no pool) | `withAuth(..., { tier: "user" })` — any active member; hidden rows only when `ctx.tier === "admin"` |

DTO (`src/lib/map-items/types.ts`; additive-only from here, 039.2-039.6 depend on it):
```ts
export const MAP_ITEM_LIMITS = { name: 60, group: 40, sizeMin: 1, sizeMax: 4, list: 200 } as const;
/** Derived from the library, never stored. "Add items" palette = kind seat|fixture and !hidden. */
export type MapItemKind = "seat" | "fixture" | "floor" | "chair";
export type MapItemArtDto = { sprite: string | null; hasImage: boolean; imageVersion: number };
export type MapItemDto = {
  builtinKey: string;      // stable id (path param in 039.2/039.4; = layout placement `sprite`); no uuid
  name: string;
  group: string;
  w: number; h: number;    // tiles at rotation 0; 90/270 swap (D66.7)
  hidden: boolean;         // true only ever reaches Admins (D67 2)
  kind: MapItemKind;       // derived
  directional: boolean;    // derived (registry dir)
  fixedSize: boolean;      // derived: kind seat | floor | chair (D66.7)
  art: Record<Direction, MapItemArtDto>; // always n/e/s/w; non-directional items use `s` only (A3)
};
/** Sorted by name (case-insensitive), then builtinKey (D67 1). */
export type MapItemListResponse = { items: MapItemDto[] };
```
- Response never contains a Drive file id (only `hasImage`, `imageVersion`), as `DeviceTypeDto`.
- SQL: `... from map_items where org_id = $1 and ($2::boolean or not hidden) order by lower(name), builtin_key limit
  ${MAP_ITEM_LIMITS.list}` (same order rule as `listDeviceTypes`, `device-types.ts:71-72`). A row whose `builtin_key`
  is not in the current library (`libraryItem(key) === null`) is left out (cannot be drawn).
- No new error codes. No `order` field (removed with A1).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `library.test.ts` › `LIBRARY_ITEMS is desk.single, the palette fixtures, the floors, then chair.office (53 rows)` | seed set (D66.1, LAY-03) |
| `library.test.ts` › `the seat and fixture keys equal the keys of paletteEntries()` | same set as today's palette |
| `library.test.ts` › `name is the key with . and _ as spaces ("wall t s", "window double", "floor carpet alt")` | name rule (A5) |
| `library.test.ts` › `names are unique under deviceTypeKey and at most 60 chars; groups at most 40` | migration cannot abort |
| `library.test.ts` › `size = footprintOf(key, 0) ?? 1x1; n and s frames have the same tiles for every directional item; all sizes 1..4` | D66.7, A2, null-tiles props |
| `library.test.ts` › `kind/directional/fixedSize: desk.single seat+fixed, door fixture+directional, floor.wood floor+fixed, chair.office chair+fixed+directional, prop.mug fixture` | derived facts |
| `library.test.ts` › `libraryItem returns null for avatar.body.front, device.pc, desk.pair and unknown keys` | excluded groups |
| `library.test.ts` › `every key the layout validator accepts for a seat or fixture is a LIBRARY_ITEMS key` (iterate `REGISTRY` base keys through `checkLayoutRules` on a 64×64 grid) | FK can never refuse a validated save (A9/A14) |
| `sql-sync.test.ts` › `map_items seed equals LIBRARY_ITEMS; name/group/size limits and Drive id regex equal the TS constants` (regex `\(p_org, '([^']+)', '([^']+)', '([^']+)', (\d+), (\d+)\)`) | seed drift (biggest risk) |
| `map-items.db.test.ts` › `a new member's first visit seeds the library catalog once; a second member adds none` (via `getOrCreateMember`) | AC1 new org, marker |
| `map-items.db.test.ts` › `list: 53 items with library defaults, hidden false, empty art` | AC1 defaults, DTO |
| `map-items.db.test.ts` › `list is ordered by lower(name), then builtin_key` (rename `wall.base` to "Aaa wall" by SQL → first; two names differing only in case order by key is impossible (unique), so assert full order equals `[...].sort` by lower name) | AC2a |
| `map-items.db.test.ts` › `hidden rows: left out with includeHidden false, listed with hidden true when includeHidden true` | AC2b |
| `map-items.db.test.ts` › `a second map_items_seed call keeps an edited row and does not restore a deleted one` (delete a row not referenced by any placement) | seed-once semantics |
| `map-items.db.test.ts` › `list returns only the caller's org rows` (edit a name in org A; org B list unchanged; counts 53 each) | AC2, R6 |
| `map-items.db.test.ts` › `art: a Drive id set by SQL shows as hasImage/imageVersion for that direction; the id is not in the JSON` | no Drive id leak |
| `map-items.db.test.ts` › `a row with a builtin_key not in the library is not listed` | toDto guard |
| `map-items-routes.test.ts` › `401 without token; service not called` | wrapper |
| `map-items-routes.test.ts` › `200 with no-store; service gets ctx.scope` | tier user, R6 |
| `map-items-routes.test.ts` › `admin tier passes includeHidden true; manager and user pass false` | AC2b, tier from org_roles |
| `map-items-routes.test.ts` › `503 unavailable when no pool` | parity |
| `save.test.ts` › existing order test now `begin, room lock, seat lock, catalog seed, seat update, ...`; `stale / 404 / seats changed refusals run no catalog seed` (assert on the existing refusal tests' sequences) | A14 placement, no write before refusal |
| `layout.db.test.ts` › `sprite keys outside the org catalog are refused by the FK` (seat `x`*100 → 23503 `seats_map_item_fkey`; fixture `__proto__` → 23503 `layout_fixtures_map_item_fkey`; fixture `plant.large` in org B whose catalog is seeded but row deleted by SQL → 23503) | replaces the "long or unknown keys" read test |
| `layout.db.test.ts` › `a save in an org with no member seeds the catalog and stores the fixtures` (org via `newOrg` + `addRoom` without `room()`'s seed; `saveRoomLayout` with `plant.large`; then 53 `map_items` rows and the fixture read back) | A14 |
| `schema-check.mjs` › `1 later run applies map_items` | migration applies |
| `schema-check.mjs` › `11 orgs existing before the migration get 53 map items` (+ marker) | AC1 existing org (backfill) |
| `schema-check.mjs` › `11 org created after the migration gets 53 map items on first member`; `11 second member adds none`; `11 deleted map item stays deleted` | AC1 new org |
| `schema-check.mjs` › `11 spot sizes door 1x2, table.meeting 3x2, desk.single 2x1, prop.mug 1x1` | footprints |
| `schema-check.mjs` › `11 backfill keeps valid placed fixtures and seats` (stage-1 `plant.large` fixture and `desk.single` seat in `oldRoomOrg` unchanged; stage-1 legacy `kind = 'door'` fixture kept) | AC2c, drawing unchanged |
| `schema-check.mjs` › `11 backfill drops undrawable fixtures and unplaces undrawable seats` (stage-1 fixture `gone.item` gone; stage-1 seat with `gone.item` keeps its row and occupant-free state, all four tile columns null) | A13 |
| `schema-check.mjs` › `11 fixture with a key not in the org catalog refused (23503 layout_fixtures_map_item_fkey)`; `11 seat with a key not in the org catalog refused (23503 seats_map_item_fkey)`; `11 map item referenced by a placement cannot be deleted (23503)`; `11 cross-org key refused` (fixture in an org without a catalog using `door`) | FK, R6 |
| `schema-check.mjs` › refusals with constraint names: size 0 and 5 (`map_items_size_check`), blank/61-char name (`map_items_name_check`), blank/41-char group (`map_items_group_name_check`), `'  DOOR '` duplicate (23505 `map_items_org_name_key`), duplicate key (23505 `map_items_pkey`), bad key `'Door x'` (`map_items_builtin_key_check`), bad Drive id in `art_w_drive_file_id`, negative `art_e_image_version`, bad sprite `' x'` (`map_items_art_sprite_check`) | every CHECK |
| `schema-check.mjs` `counts()` | seed:dev idempotence covers the new tables |

`routes-guarded.test.ts` picks up the new route automatically (no edit). Section 8 of `schema-check.mjs` stays as is: its
`A.org` gets a catalog from `seedDev`'s members insert, and its CHECK refusals fire before the FK (FK checks run after
the row checks); confirm the section still passes.

## Approach
1. `src/lib/map-items/types.ts`: the DTO and limits above; import `Direction` from `@/lib/sprites/types`. Pure lib (R1).
2. `src/lib/map-items/library.ts`: import `REGISTRY`, `FIXTURE_GROUPS`, `SEAT_SPRITES`, `spriteInfo`, `footprintOf`
   (`src/lib/validate/layout.ts:45-89`). Build bases as `palette.ts:20-23` does; kinds: `SEAT_SPRITES` → seat; group in
   `FIXTURE_GROUPS` → fixture; group `floor` and non-directional → floor; `CHAIR_ITEMS = ["chair.office"]` → chair;
   everything else excluded. Deterministic derivation order (seats, fixtures by (group, key), floors, chair) only for the
   seed file and tests; the API orders by name. Each entry `{ builtinKey, name, group, w, h, kind, directional,
   fixedSize }` with `[w, h] = footprintOf(key, 0) ?? [1, 1]`. Export `LIBRARY_ITEMS` (frozen) and `libraryItem(key)`.
3. Write the migration in this order: function-free DDL (tables, index), `map_items_seed`, trigger function + trigger,
   backfill step 1, step 2 (delete + update), step 3 (two FKs, index). Generate the 53 VALUES lines from `LIBRARY_ITEMS`
   with a one-off node/tsx command (not committed). Use `end $$;` closings; no `begin`/`commit`.
4. `src/server/map-items/map-items.ts`: `import "server-only"` first; `COLS` selects key, name, group_name, w, h,
   hidden, per direction `art_<d>_sprite`, `(art_<d>_drive_file_id is not null) as art_<d>_has_image`,
   `art_<d>_image_version` — never the id. `listMapItems(db, scope, { includeHidden })` via `orgQuery(db, scope, "...
   where org_id = $1 and ($2::boolean or not hidden) order by lower(name), builtin_key limit ...", [includeHidden])`;
   `toDto` merges the library facts and drops unknown keys. Return `Result<MapItemListResponse>` shaped like
   `device-types.ts:18-23`. Mirror `listDeviceTypes` (`device-types.ts:63-75`).
5. `src/app/api/map-items/route.ts`: copy the GET of `src/app/api/device-types/route.ts:1-22`; call
   `listMapItems(pool, ctx.scope, { includeHidden: ctx.tier === "admin" })`. R7: no 401/403 outside the wrapper; GET has
   no side effect.
6. `src/server/layout/save.ts`: after the `layout_seats_changed` check (line 71), add
   `await orgQuery(c, scope, "select map_items_seed(o.org_id) from (select $1::uuid as org_id) o where o.org_id = $1::uuid");`
   with a one-line comment (FK safety net, same form as `device-types.ts:86-90`). It runs only when the save proceeds,
   inside the same transaction (rolled back with it). Lock order becomes room, seats, catalog marker; no other path
   locks in the reverse order (039.2 must not take a room or seat lock after the marker; note for its plan).
7. `src/server/layout/save.test.ts`: add the `"catalog seed"` mapping in `kinds()` and insert it in every full-sequence
   expectation; refusal tests assert it is absent.
8. `src/server/layout/layout.db.test.ts`: in `room()` after `addRoom`, `await run("select map_items_seed($1)",
   [o.orgId])`; replace the test at lines 251-263; add the no-member save test. Run the whole file.
9. Other tests per the table. Route test modelled on `device-types-routes.test.ts:1-80` (set `tier` on the mocked ctx);
   DB test on `device-types.db.test.ts:1-80` (`testPool`, `assertTestDb`, `newOrg`, `addMember`, `getOrCreateMember`);
   sync test on `src/server/device-types/sql-sync.test.ts`.
10. `scripts/schema-check.mjs`: in stage 1 (after line 90) insert into `oldRoomOrg`'s room: seat seq 1 placed
    `desk.single` at (0,0), seat seq 2 placed `gone.item`, a fixture `plant.large`, a fixture `gone.item`, a legacy
    fixture `kind = 'door'`; keep their ids. After line 96 add `check("1 later run applies map_items", ...)`; add the two
    tables to `counts()`; add section 11 using fresh orgs, `oldMemberOrg`/`oldRoomOrg` and the `q`, `tx`, `refused`,
    `addMemberTo` helpers. Keep the "pass/FAIL only" output.
11. **Local DB checks (no Docker; PostgreSQL 16 binaries).** Throwaway cluster on a spare port, trust auth, localhost
    only; never write `DATABASE_URL` into `.env*`, pass it inline:
    ```sh
    PGBIN=/usr/lib/postgresql/16/bin
    PGDIR=$(mktemp -d)            # e.g. under the session scratchpad
    # initdb refuses uid 0: when running as root, run the server as the `postgres` user
    chown postgres:postgres "$PGDIR"
    runuser -u postgres -- $PGBIN/initdb -D "$PGDIR/data" -U simap --auth=trust -E UTF8 --locale=C.UTF-8
    runuser -u postgres -- $PGBIN/pg_ctl -D "$PGDIR/data" -l "$PGDIR/data/server.log" -w \
      -o "-c listen_addresses=127.0.0.1 -p 55432 -k $PGDIR" start
    psql -h 127.0.0.1 -p 55432 -U simap -d postgres -c 'create database simap'
    export DATABASE_URL=postgres://simap@127.0.0.1:55432/simap
    pnpm migrate && pnpm migrate:smoke && pnpm schema:check && pnpm test:db
    runuser -u postgres -- $PGBIN/pg_ctl -D "$PGDIR/data" -m fast stop && rm -rf "$PGDIR"
    ```
    (Not root: drop `chown`/`runuser -u postgres --`. If `--locale=C.UTF-8` is rejected use `--no-locale`.) Record
    pass/fail lines (not the URL) in impl-log. CI also runs `pnpm test:db`.
12. `db/migrations/README.md`: bullet describing `map_items` (PK `(org_id, builtin_key)`, name unique via
    `device_type_key()`, per-direction art columns, seed-once marker + members trigger, `layout_fixtures.sprite_key` and
    `seats.sprite_key` reference it with `on delete restrict`, floors stay jsonb keys, the one-off backfill cleanup).
13. Run all Checks of `loop.config.md`.

Rules: R1 (lib DTO/library; server only via the route), R2 (forward-only expand migration, new timestamp, previous image
compatible), R6 (`org_id` leads every key and FK; `orgQuery` only; Admin flag from `ctx.tier`), R7 (wrapper-only auth
codes; the save's seed call is not an auth refusal), R3 (no config), R5 (tests above).

## Sibling tickets (overlap with the FK work; what moves here)
Moved into 039.1:
- The FKs from `layout_fixtures` and `seats` to `map_items`, the backfill/cleanup of existing placements, and the
  `layout_fixtures_org_sprite_idx` index that 039.2's `item_in_use` room count needs (039.2 needs no migration).
- The catalog-seed safety net in the layout save (039.3 no longer needs to handle a missing catalog row).

Impact on the siblings (for their plans; no edit to their ticket files here):
- **039.2**: no reorder action (D67 1: alphabetical; "reorder" in its Goal is gone; regroup stays). The FK's implicit
  `FOR KEY SHARE` lock on `map_items` (taken by every save that inserts a placement) already serialises a resize that
  locks the item row `for update` against a concurrent save of that item; renames/hide/art should lock with
  `for no key update` so they never wait on saves. Items are never deleted (FK `on delete restrict` enforces it).
- **039.3**: the layout read joins `map_items` on `(org_id, sprite_key)` (the FK) for footprints. Because non-Admins no
  longer get hidden rows from `GET /api/map-items` (D67 2) but a hidden item already placed stays on the layout (039.3
  scope), the layout response must carry the catalog rows its placements and floors reference, hidden ones included
  (suggested: additive `items: MapItemDto[]` on `LayoutResponse`, built with this ticket's `toDto`). The "`sprite_key`
  stays" out-of-scope line still holds: the column is unchanged, it now has an FK.
- **039.4**: no overlap (images live on `map_items`; saved layouts pick them up through the key).
- **039.5**: palette from `GET /api/map-items` (already without hidden rows for non-Admins; Admins get hidden rows, so
  the palette still filters `hidden`), items in name order, groups in name order; placed items drawn from the layout
  response's referenced items (039.3), not from the palette list.
- **039.6**: no reorder UI; list in name order; shows hidden rows (Admin GET).
- **039.7**: no overlap; its migration comes after this one.

## Specialist input used
- database-optimizer 1, 6 (copy the 036.2 marker/seed/trigger/backfill): adopted; union adds `device_type_catalogs`;
  `layout_fixtures` left out as redundant (its FK to `rooms` puts its orgs in `rooms`).
- db 2 (schema-check counts, later-run line, constraint cases): adopted.
- db 3 + api 2 (seed generated from `keys.json`, locked by a sync test; `door` takes the rotation-0 size): adopted, with
  the TS derivation in `src/lib/map-items/library.ts`.
- db 4 (reuse `device_type_key` for name uniqueness): adopted.
- db 5 / api 2 (art as columns vs child table): **columns** (single row read, one row lock covers resize + image delete
  in 039.2, compare-and-set per direction in 039.4). Child table rejected.
- db 5 `placeable` stored: rejected; derived `kind` instead. Directional/layer/defaults derived from the registry:
  adopted (store only Admin-editable data).
- db 7 group ordering (`map_item_groups` or `group_order`): superseded by D67 (1) — no stored order at all; name order.
- db 6 / api Risk 1 (lazy seed on GET): rejected for the GET (A7); adopted for the layout **save** (db 6 "call the seed
  as a safety net from the write path"), because the new FK would otherwise turn a missing catalog into a 500 (A14).
- api 1 DTO: adopted with `kind` instead of `placeable` and without `order`; non-directional art key is `s`.
- api 3 / api open question (hidden for every caller): **overridden by Ming** (D67 2): hidden rows only for Admins.
- api 2 / api schema note ("do not add an FK that would break old images or saved layouts"): **overridden by Ming**
  (D67 3); the FK is added in a form the previous image and saved layouts stay compatible with (existing column,
  validator-accepted keys all seeded, undrawable rows cleaned first).
- db 8 / api 4 (audit N/A in 039.1): adopted, stated in AC 3.
- db 11 tests: adopted, except the "existing org via backfill" case lives in `schema-check.mjs` (test:db applies all
  migrations to an empty DB, so it cannot see a backfill).

## Assumptions
Approved by Ming 2026-11-25 (kept): A2, A3, A5, A6, A7, A8, A10, A11. Changed by Ming: A1, A4, A9. New: A12-A15.
- **A1 Ordering (changed, D67 1).** No stored order. `GET /api/map-items` sorts by `lower(name), builtin_key` (same rule
  as device types; diacritics sort by the DB collation, as for device types). Groups have no stored order; 039.5/039.6
  show groups in name order. Spec LAY-07 "order (within its group; groups are ordered too)" and D66 (1) "reorder" are
  superseded; follow-up for the spec text (not this ticket).
- **A2 "Rotation 0".** D66/LAY-07 say rotation 0 is direction `n`; in code rotation 0 draws the `s` frame
  (`src/lib/sprites/placement.ts:10`). For every current item the `n` and `s` frames have the same tiles, so the seeded
  size is identical either way; the plan uses `footprintOf(key, 0)` and a test asserts `n` = `s`.
- **A3 Art storage.** 12 columns on `map_items` (`art_<d>_sprite`, `art_<d>_drive_file_id`, `art_<d>_image_version`
  for d in n/e/s/w). A non-directional item uses direction `s`; 039.2/039.4 refuse n/e/w for it with 422.
- **A4 Hidden items (changed, D67 2).** `GET /api/map-items` leaves hidden rows out unless `ctx.tier === "admin"`
  (tier from `org_roles`, R6); Managers count as non-Admin. Hidden rows already placed on a layout still draw for
  everyone through the layout read (039.3, see Sibling tickets).
- **A5 Names and groups.** Name = key with `.`/`_` → space, lowercase ("door", "desk single", "floor carpet alt").
  Group = the library group string, not today's palette headings.
- **A6 Package sprite** stored as the full frame key of the bundled atlas; format check only; existence checked by the
  app in 039.2.
- **A7 No lazy seed on GET.** An org gets its catalog from the backfill, its first `members` insert, or (new, A14) its
  first layout save; a GET before any of those returns `items: []` (cannot happen through the UI).
- **A8 Library defaults** are not stored and not in the DTO; `libraryItem()` provides them for 039.2 reset and 039.6.
- **A9 Composite FKs (changed, D67 3).** `layout_fixtures (org_id, sprite_key)` and `seats (org_id, sprite_key)`
  reference `map_items (org_id, builtin_key)`, `on delete restrict`. The FK uses the existing `sprite_key` column (its
  value already is the builtin key), so no new column, no dual write and no read change are needed, and the previous
  image keeps working. Name and art are resolved by key at read time, so renames and image changes show on saved
  layouts. Desks are included as "placed items" (D66 (2) gives `desk.single` its own name and art).
- **A10 Future library keys** added to `keys.json` get no row in existing orgs until a later migration adds them. With
  the FK this is now required, not optional: a new placeable key without its catalog rows would make a save with it
  fail (23503 → 500). The `library.test.ts` validator-vs-library test catches the TS side; the follow-up ("a library
  key addition ships with a migration inserting it for every catalog") stays a follow-up.
- **A11 Size of change** ≈ 900 lines (was ≈ 750), about 60 % tests and seed data; kept as one ticket (see Split proposal).
- **A12 Floors** stay keys in `rooms.floor_zones` (jsonb; an FK is impossible). They still follow renames and image
  changes because they are resolved by key; the validator only accepts library `floor.*` keys, all seeded. Moving
  floors into a table is out of scope (it would change the save/read shape).
- **A13 One-off cleanup of undrawable placements.** Before the FKs are added, placed fixtures whose key has no catalog
  row are deleted and such seat placements are reset to unplaced. Both are exactly what `resolveLayout` already drops
  or re-places today, so no room looks different. Alternative if Ming prefers no data change: add the FKs `not valid`
  (enforced for new writes only) and validate them in a later contract migration once rooms have been re-saved.
- **A14 Catalog seed in the layout save.** The save calls `map_items_seed` for the org (no-op when the marker exists)
  so a save in an org that never had a member row (scripted client) cannot hit the FK. One extra statement per save.
- **A15 Spec/decision conflicts flagged:** LAY-07 ("order", "Any member can read the catalog" incl. hidden) and D66 (1)
  ("saved layouts unchanged") are amended by D67, which is newer and Ming's; the plan follows D67. The spec text
  update is a follow-up.
- Hotspots: no open ticket (IN_PROGRESS/REVIEW/DONE) edits `src/server/layout/save.ts`, `save.test.ts`,
  `layout.db.test.ts`, `scripts/schema-check.mjs`, `db/migrations/README.md` or adds a migration (SIM-037.8, the only
  IN_PROGRESS ticket, is UI). SIM-039.3 will later edit `save.ts`/`layout.ts` on top of this. Per the ticket note, do not
  plan a SIM-037.x migration in parallel; merge this one first.

## Blocking questions
None. (A13's cleanup vs `not valid` choice and A12's floors-stay-jsonb are proposed defaults for the plan-approval gate.)

## Split proposal
None. Possible cut if the reviewer wants smaller PRs: (a) catalog migration + `library.ts` + read API + their tests,
(b) a second migration with the FKs, cleanup, save safety net and layout test changes (~250 lines). Not proposed: it
adds a second High-path migration and approval round for the same decision, and (b) alone is small.
