Status: READY

# Plan — SIM-039.1: Map item catalog: schema, per-org seed and read API

## Scope summary
- D66 (1): "Admins manage the existing library items only (base keys of `src/lib/sprites/keys.json` in today's palette
  groups, `desk.single`, `chair.office`, every `floor.*`) ... Catalog rows are keyed by (`org_id`, `builtin_key`) and
  seeded per org; placed fixtures keep storing `sprite_key` (expand-only, saved layouts unchanged)."
- D66 (2): "`chair.office` is a non-placeable row so chair art can be chosen." D66 (3): "Custom images are uploaded per
  direction (n/e/s/w) for directional items". D66 (7): "Every item has an explicit, visible size `w × h` in tiles,
  default the library footprint, Admin-settable to 1–4 × 1–4 (desk, chair and floors fixed); size is for rotation 0".
- LAY-03: "Each org starts with a catalog seeded with one row per base key of today's palette (cabinet, circulation,
  door, label, lamp, marker, partition, plant, prop, rack, shelf, sofa, table, wall, whiteboard, window groups, plus
  `desk.single`), every `floor.*` key and `chair.office`; each row has the library's group, a readable name from the key
  (e.g. "wall t s", "window double"), the library footprint as its size and no custom art. Existing layouts keep drawing
  exactly as before."
- LAY-07: "Any member can read the catalog (the map needs it); only an Admin changes it." "Each item shows its library
  key (read only), name (unique in the org, case- and space-insensitive, at most 60 characters), group (at most 40
  characters ...), order (within its group; groups are ordered too), size in tiles ..., shown in palette (yes/no) and its
  art per direction (n/e/s/w for directional items, one image otherwise)". "Items are never deleted."
- Ticket scope: migration `map_items` + per-org seed + trigger/marker (SIM-036.2 pattern) + `schema-check.mjs`;
  `GET /api/map-items` for any member; `layout_fixtures` and saved layouts unchanged.

This plan also fixes the DB shape and the DTO that SIM-039.2 to 039.6 build on (see "Data model" and "API contract").

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A new and an existing org each get the full seeded catalog with library defaults (name from key, group, footprint size) | `pnpm schema:check` steps `11 orgs existing before the migration get 53 map items` (backfill: orgs created in stage 1, before the migration), `11 org created after the migration gets 53 map items on first member`, `11 spot sizes door 1x2, table.meeting 3x2, desk.single 2x1, prop.mug 1x1`; `map-items.db.test.ts › a new member's first visit seeds the library catalog once`; `library.test.ts` + `sql-sync.test.ts` prove the seed equals the library derivation |
| 2 | `GET /api/map-items` returns only the caller's org rows | `map-items.db.test.ts › list returns only the caller's org rows`; `map-items-routes.test.ts › 200 passes ctx.scope to the service` |
| 3 | Every query scoped by token org (R6); Admin-only writes audited; checks green incl. `pnpm test:db` locally | Code review: the only query uses `orgQuery(..., "where org_id = $1")`; no org from the request. **Audit: N/A in 039.1** — there are no Admin writes (the seed runs in a trigger with no actor, as `device_types`); audited writes land in 039.2/039.4. Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`, plus `pnpm migrate`, `pnpm migrate:smoke`, `pnpm schema:check`, `pnpm test:db` against the local throwaway cluster (see Approach step 9); outputs recorded in impl-log |

## Ming verification after merge
- After the release migration runs on the shared DB: `GET /api/map-items` in an existing org (as any member) returns 53
  items; the editor and map look unchanged (nothing reads the catalog yet).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261125200000_map_items.sql` | create: `map_items`, `map_item_catalogs`, `map_items_seed(p_org)`, members trigger, backfill | ticket scope (schema + seed) | **Yes** (`db/migrations/**`, `**/*.sql`) |
| `src/lib/map-items/types.ts` | create: `MAP_ITEM_LIMITS`, `MapItemKind`, `MapItemArtDto`, `MapItemDto`, `MapItemListResponse` | shared DTO for 039.1-039.6 (lib, so UI may import, R1) | no |
| `src/lib/map-items/library.ts` | create: `mapItemName(key)`, `LIBRARY_ITEMS` (derived, ordered), `libraryItem(key)` | single TS source of the seed and of derived facts (kind, directional, fixedSize, defaults for 039.2 reset) | no |
| `src/lib/map-items/library.test.ts` | create | unit tests of the derivation | no |
| `src/server/map-items/map-items.ts` | create: `listMapItems(db, scope)`, `Row`, `COLS`, `toDto` | read service (`import "server-only"`) | no |
| `src/server/map-items/sql-sync.test.ts` | create | migration seed and checks equal the TS constants | no |
| `src/server/map-items/map-items.db.test.ts` | create | DB integration (`pnpm test:db`) | no |
| `src/app/api/map-items/route.ts` | create: `GET` | the read API | no |
| `src/app/api/map-items/map-items-routes.test.ts` | create | route tests (mocked service) | no |
| `scripts/schema-check.mjs` | modify: line 93-96 add "later run applies map_items" check; lines 126-139 add `map_items`, `map_item_catalogs` to `counts()`; new section `// 11 map items (SIM-039.1)` after section 10 (after line 781, before `// extras`) | ticket scope (`schema-check.mjs`) | no |
| `db/migrations/README.md` | modify: one "Map items (SIM-039.1, ...)" bullet after the Device lifecycle bullet (line ~58) | schema doc kept current | no (`.md`) |

No other file. `src/lib/layout-editor/palette.ts`, `src/lib/validate/layout.ts`, `layout_fixtures`, `src/lib/api/error.ts`
are read/imported only, not changed.

## Data model / migration
File `db/migrations/20261125200000_map_items.sql` (later than the newest, `20261125180000_handoff_decided_by.sql`).
Header comment: SIM-039.1 / D66, expand-only, image and sprite columns exist now so 039.2/039.4 need no migration.

**`map_items`** (one row per org and library item)
| Column | Type | Null | Default | Check (named) |
|---|---|---|---|---|
| `org_id` | uuid | not null | — | — |
| `builtin_key` | text | not null | — | `map_items_builtin_key_check`: `builtin_key ~ '^[a-z0-9]+(\.[a-z0-9]+)*$' and char_length(builtin_key) <= 100` |
| `name` | text | not null | — | `map_items_name_check`: `btrim(name) <> '' and char_length(name) <= 60` |
| `group_name` | text | not null | — | `map_items_group_name_check`: `btrim(group_name) <> '' and char_length(group_name) <= 40` |
| `sort_order` | integer | not null | — | `map_items_sort_order_check`: `sort_order >= 0` |
| `w`, `h` | smallint | not null | — | `map_items_size_check`: `w between 1 and 4 and h between 1 and 4` |
| `hidden` | boolean | not null | `false` | — |
| `art_n_sprite`, `art_e_sprite`, `art_s_sprite`, `art_w_sprite` | text | null | — | `map_items_art_sprite_check`: each `~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$'` (ANDed; null passes) |
| `art_n_drive_file_id`, `art_e_…`, `art_s_…`, `art_w_…` | text | null | — | `map_items_art_image_check`: each `~ '^[A-Za-z0-9_-]{10,200}$'` (= `DRIVE_ID_RE`, ANDed; null passes) |
| `art_n_image_version`, `art_e_…`, `art_s_…`, `art_w_…` | integer | not null | `0` | `map_items_art_image_version_check`: all four `>= 0` |
| `created_at`, `updated_at` | timestamptz | not null | `now()` | — |

- `constraint map_items_pkey primary key (org_id, builtin_key)` — the composite key 039.2/039.3/039.4 look up and lock
  (`for update` / `for share`).
- `create unique index map_items_org_name_key on map_items (org_id, device_type_key(name))` — reuses the existing
  normalizer (case- and whitespace-insensitive, Vietnamese capitals mapped; LAY-07 "case- and space-insensitive").
- No other index (≤ ~60 rows per org; the PK covers `where org_id = $1`). No FK: nothing references `map_items` and
  `layout_fixtures.sprite_key` stays free text (A9).

**`map_item_catalogs`**: `org_id uuid primary key`, `seeded_at timestamptz not null default now()` — "seeded once" flag
and the per-org row 039.2 can lock (mirrors `device_type_catalogs`, `20261124160000_device_types.sql:32-35`).

**`map_items_seed(p_org uuid) returns void language plpgsql`**: insert marker `on conflict (org_id) do nothing`; `if found`
insert the 53 library rows `(p_org, '<key>', '<name>', '<group>', <order>, <w>, <h>)` `on conflict do nothing`
(exact literal form, one row per line, so `sql-sync.test.ts` can parse it). All art columns null / 0, `hidden` false.

**Trigger**: function `members_seed_map_items()` (`perform map_items_seed(new.org_id); return null;`) and
`create trigger members_seed_map_items_trg after insert on members for each row execute function members_seed_map_items();`
(fires alongside `members_seed_device_types_trg`; independent).

**Backfill**: `select map_items_seed(o.org_id) from (select org_id from members union select org_id from rooms union
select org_id from seats union select org_id from devices union select org_id from groups union select org_id from
device_type_catalogs) o;` (`layout_fixtures` is not needed: it has a composite FK to `rooms`, so its orgs are in `rooms`.)

**Seed rows** (= `LIBRARY_ITEMS`; generate the VALUES from it with a throwaway node one-liner, do not hand-type; the sync
test locks it). Name = key with `.` and `_` replaced by spaces. Size = library footprint at rotation 0 (`tiles ?? [1,1]`).
| order | key | group | w×h |
|---|---|---|---|
| 0 | desk.single | desk | 2×1 |
| 1 | cabinet.filing | cabinet | 1×1 |
| 2-3 | elevator, stairs | circulation | 2×2 |
| 4 | door | door | 1×2 |
| 5 | label.sign | label | 1×1 |
| 6 | lamp.floor | lamp | 1×1 |
| 7 | marker.blocked | marker | 1×1 |
| 8 | partition.glass | partition | 1×1 |
| 9-10 | plant.large, plant.small | plant | 1×1 |
| 11-14 | prop.keyboard, prop.mouse, prop.mug, prop.papers (`tiles: null`) | prop | 1×1 |
| 15 | rack.server | rack | 1×1 |
| 16 | shelf.books | shelf | 2×1 |
| 17 | sofa | sofa | 2×1 |
| 18-19 | table.coffee (2×1), table.meeting (3×2) | table | |
| 20-43 | the 24 `wall.*` keys in JS string order (`wall.base` … `wall.t.s`, `wall.t.s.face`, `wall.top`) | wall | 1×1 |
| 44 | whiteboard | whiteboard | 2×1 |
| 45-47 | window.double (2×1), window.single, window.single.top | window | |
| 48-51 | floor.carpet, floor.carpet.alt, floor.lavender, floor.wood | floor | 1×1 |
| 52 | chair.office | chair | 1×1 |

Orders 0-47 are exactly today's `paletteEntries()` order (`src/lib/layout-editor/palette.ts:14-33`), so the first 039.5
palette looks as today. All 53 derived names are distinct (keys contain no spaces or `_`), so the unique index cannot
abort the migration; `library.test.ts` asserts it under `deviceTypeKey`.

**Expand / rollback (R2)**: new objects only; no existing table or column changes. The previous image keeps working: it
inserts members (trigger seeds) and never reads the new tables. Forward-only; no down file (README rule; the
"migrations reversible" line in loop.config Domain focus yields to R2/README). Rollback = previous image; the new tables
are inert.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/map-items` | none | `200 MapItemListResponse`, `Cache-Control: no-store` | 401/403 from `withAuth` only; 503 `unavailable` (no pool) | `withAuth(..., { tier: "user" })` — any active member |

DTO (`src/lib/map-items/types.ts`; additive-only from here, 039.2-039.6 depend on it):
```ts
export const MAP_ITEM_LIMITS = { name: 60, group: 40, sizeMin: 1, sizeMax: 4, list: 200 } as const;
/** Derived from the library, never stored. "Add items" palette = kind seat|fixture and !hidden. */
export type MapItemKind = "seat" | "fixture" | "floor" | "chair";
export type MapItemArtDto = { sprite: string | null; hasImage: boolean; imageVersion: number };
export type MapItemDto = {
  builtinKey: string;      // stable id (path param in 039.2/039.4); no uuid
  name: string;
  group: string;
  order: number;           // org-wide position; list is sorted by it (A1)
  w: number; h: number;    // tiles at rotation 0; 90/270 swap (D66.7)
  hidden: boolean;         // included for every caller (A4)
  kind: MapItemKind;       // derived
  directional: boolean;    // derived (registry dir)
  fixedSize: boolean;      // derived: kind seat | floor | chair (D66.7)
  art: Record<Direction, MapItemArtDto>; // always n/e/s/w; non-directional items use `s` only (A3)
};
export type MapItemListResponse = { items: MapItemDto[] };
```
- Response never contains a Drive file id (only `hasImage`, `imageVersion`), as `DeviceTypeDto`.
- Sorted by `sort_order, builtin_key`, `limit MAP_ITEM_LIMITS.list`. A row whose `builtin_key` is not in the current
  library (`libraryItem(key) === null`) is left out of the response (it cannot be drawn).
- No new error codes.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `library.test.ts` › `LIBRARY_ITEMS is desk.single, the palette fixtures, the floors, then chair.office (53 rows)` | seed set (D66.1, LAY-03) |
| `library.test.ts` › `the first 48 keys equal paletteEntries() order` | order matches today's palette |
| `library.test.ts` › `order is dense 0..n-1` | A1 |
| `library.test.ts` › `name is the key with . and _ as spaces ("wall t s", "window double", "floor carpet alt")` | name rule (A5) |
| `library.test.ts` › `names are unique under deviceTypeKey and at most 60 chars; groups at most 40` | migration cannot abort |
| `library.test.ts` › `size = footprintOf(key, 0) ?? 1x1; n and s frames have the same tiles for every directional item; all sizes 1..4` | D66.7, A2, null-tiles props |
| `library.test.ts` › `kind/directional/fixedSize: desk.single seat+fixed, door fixture+directional, floor.wood floor+fixed, chair.office chair+fixed+directional, prop.mug fixture` | derived facts |
| `library.test.ts` › `libraryItem returns null for avatar.body.front, device.pc, desk.pair and unknown keys` | excluded groups |
| `sql-sync.test.ts` › `map_items seed equals LIBRARY_ITEMS; name/group/size limits and Drive id regex equal the TS constants` | seed drift (biggest risk) |
| `map-items.db.test.ts` › `a new member's first visit seeds the library catalog once; a second member adds none` (via `getOrCreateMember`) | AC1 new org, marker |
| `map-items.db.test.ts` › `list: 53 items in LIBRARY order with library defaults, hidden false, empty art` | AC1 defaults, DTO |
| `map-items.db.test.ts` › `a second map_items_seed call keeps an edited row and does not restore a deleted one` | seed-once semantics |
| `map-items.db.test.ts` › `list returns only the caller's org rows` (edit a name in org A; org B list unchanged; counts 53 each) | AC2, R6 |
| `map-items.db.test.ts` › `art: a Drive id set by SQL shows as hasImage/imageVersion for that direction; the id is not in the JSON` | no Drive id leak |
| `map-items.db.test.ts` › `a row with a builtin_key not in the library is not listed` | toDto guard |
| `map-items-routes.test.ts` › `401 without token; service not called` | wrapper |
| `map-items-routes.test.ts` › `200 for simap:user with no-store; service gets ctx.scope` | tier user, R6 |
| `map-items-routes.test.ts` › `503 unavailable when no pool` | parity |
| `schema-check.mjs` › `1 later run applies map_items` | migration applies |
| `schema-check.mjs` › `11 orgs existing before the migration get 53 map items` (+ marker) | AC1 existing org (backfill) |
| `schema-check.mjs` › `11 org created after the migration gets 53 map items on first member`; `11 second member adds none`; `11 deleted map item stays deleted` | AC1 new org |
| `schema-check.mjs` › `11 spot sizes door 1x2, table.meeting 3x2, desk.single 2x1, prop.mug 1x1` | footprints |
| `schema-check.mjs` › refusals with constraint names: size 0 and 5 (`map_items_size_check`), blank/61-char name (`map_items_name_check`), blank/41-char group (`map_items_group_name_check`), `'  DOOR '` duplicate (23505 `map_items_org_name_key`), duplicate key (23505 `map_items_pkey`), bad key `'Door x'` (`map_items_builtin_key_check`), negative `sort_order`, bad Drive id in `art_w_drive_file_id`, negative `art_e_image_version`, bad sprite `' x'` (`map_items_art_sprite_check`) | every CHECK |
| `schema-check.mjs` `counts()` | seed:dev idempotence covers the new tables |

`routes-guarded.test.ts` picks up the new route automatically (no edit).

## Approach
1. `src/lib/map-items/types.ts`: the DTO and limits above; import `Direction` from `@/lib/sprites/types`. Pure lib (R1).
2. `src/lib/map-items/library.ts`: import `REGISTRY`, `FIXTURE_GROUPS`, `SEAT_SPRITES`, `spriteInfo`, `footprintOf`
   (`src/lib/validate/layout.ts:45-89`). Build bases as `palette.ts:20-23` does; kinds: `SEAT_SPRITES` → seat; group in
   `FIXTURE_GROUPS` → fixture; group `floor` and non-directional → floor; `CHAIR_ITEMS = ["chair.office"]` → chair;
   everything else excluded. Order: seats, fixtures by (group, key) with the same `cmp` as `palette.ts:11`, floors by
   key, chair. Each entry `{ builtinKey, name, group, order, w, h, kind, directional, fixedSize }` with
   `[w, h] = footprintOf(key, 0) ?? [1, 1]`. Export `LIBRARY_ITEMS` (frozen) and `libraryItem(key)` (Map lookup).
   039.2 uses `libraryItem` for "reset to library defaults".
3. Write the migration (Data model). Generate the 53 VALUES lines from `LIBRARY_ITEMS` with a one-off node/tsx command
   (not committed). Use `end $$;` closings; no `begin`/`commit`.
4. `src/server/map-items/map-items.ts`: `import "server-only"` first; `COLS` selects key, name, group_name, sort_order,
   w, h, hidden, per direction `art_<d>_sprite`, `(art_<d>_drive_file_id is not null) as art_<d>_has_image`,
   `art_<d>_image_version` — never the id. `listMapItems(db, scope)` via `orgQuery(db, scope, "... from map_items where
   org_id = $1 order by sort_order, builtin_key limit ${MAP_ITEM_LIMITS.list}")`; `toDto` merges the library facts and
   drops unknown keys. Return `Result<MapItemListResponse>` shaped like `device-types.ts:18-23` (only the ok branch used).
   Mirror `listDeviceTypes` (`src/server/device-types/device-types.ts:63-75`).
5. `src/app/api/map-items/route.ts`: copy the GET of `src/app/api/device-types/route.ts:1-22` (`dynamic =
   "force-dynamic"`, 503 when no pool, `NO_STORE`). R7: no 401/403 outside the wrapper; GET has no side effect.
6. Tests per the table. Route test modelled on `device-types-routes.test.ts:1-80`; DB test on
   `device-types.db.test.ts:1-80` (`testPool`, `assertTestDb`, `newOrg`, `addMember`, `getOrCreateMember`); sync test
   on `src/server/device-types/sql-sync.test.ts` (regex `\(p_org, '([^']+)', '([^']+)', '([^']+)', (\d+), (\d+), (\d+)\)`).
7. `scripts/schema-check.mjs`: after line 96 add `check("1 later run applies map_items", later.some((l) =>
   l.includes("map_items")))` (stage 1 already stops before `20261124160000`, so `oldMemberOrg`/`oldRoomOrg` exist before
   this migration too); add the two tables to `counts()`; add section 11 using fresh orgs plus the existing
   `oldMemberOrg`/`oldRoomOrg`, `q`, `tx`, `refused`, `addMemberTo` helpers. Keep the "pass/FAIL only" output.
8. `db/migrations/README.md`: bullet describing `map_items` (PK `(org_id, builtin_key)`, name unique via
   `device_type_key()`, per-direction art columns, seed-once marker + members trigger, nothing references it).
9. **Local DB checks (no Docker; PostgreSQL 16 binaries).** Use a throwaway cluster on a spare port, trust auth,
   localhost only; never write `DATABASE_URL` into `.env*`, pass it inline:
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
   (Not root: drop `chown`/`runuser -u postgres --`. If `--locale=C.UTF-8` is rejected use `--no-locale`.) The scripts'
   `assertDevSeedTarget` accepts `127.0.0.1`. Record pass/fail lines (not the URL) in impl-log. CI also runs `pnpm
   test:db`.
10. Run all Checks of `loop.config.md`.

Rules: R1 (lib DTO/library, server only via the route), R2 (forward-only expand migration, new timestamp), R6 (`org_id`
in every table/key; `orgQuery` only), R7 (wrapper-only auth codes), R3 (no config), R5 (tests above).

## Specialist input used
- database-optimizer 1, 6 (copy the 036.2 marker/seed/trigger/backfill): adopted; union adds `device_type_catalogs`;
  `layout_fixtures` rejected as redundant (its FK to `rooms` puts its orgs in `rooms`).
- db 2 (schema-check counts, later-run line, constraint cases): adopted.
- db 3 + api 2 (seed generated from `keys.json`, locked by a sync test; `door` takes the rotation-0 size): adopted, with
  the TS derivation in `src/lib/map-items/library.ts`.
- db 4 (reuse `device_type_key` for name uniqueness): adopted.
- db 5 / api 2 (art as columns vs child table): **columns** chosen (single row read, one row lock covers resize +
  image delete in 039.2, compare-and-set per direction in 039.4, per-direction version never resets). Child table
  rejected.
- db 5 `placeable` stored: rejected; derived `kind` instead (api 1 had `placeable`; `kind` also tells floors apart, which
  are not palette items). Directional/layer/defaults derived from the registry: adopted (store only Admin-editable data).
- db 7 group ordering via `map_item_groups` table or per-row `group_order`: rejected for one org-wide `sort_order` (A1).
- db 6 / api Risk 1 (lazy seed on GET): rejected; `AuthGate` calls `/api/me` (`src/ui/auth/AuthGate.tsx:319`, creates the
  member, trigger seeds) before any page fetch, same as device types (A7).
- api 1 DTO: adopted with `kind` instead of `placeable`; non-directional art key is `s` (= `ROTATION_TO_DIR[0]`), as api
  suggested.
- api 3 (include hidden items for every caller): adopted (A4). api: full frame key for package sprites: adopted (A6).
- db 8 / api 4 (audit N/A in 039.1): adopted, stated in AC 3.
- db 11 tests: adopted, except the "existing org via backfill" case lives in `schema-check.mjs` (test:db applies all
  migrations to an empty DB, so it cannot see a backfill).

## Assumptions
For Ming to approve with the plan (each reversible before 039.2 ships, unless noted):
- **A1 Ordering.** One org-wide `sort_order` (dense 0..n-1, not unique-constrained; ties break by `builtin_key`). Group
  order = position of the group's first item. 039.2 rewrites `sort_order` for the org in one transaction on any
  reorder/regroup and keeps each group contiguous. No separate groups table.
- **A2 "Rotation 0".** D66/LAY-07 say rotation 0 is direction `n`; in code rotation 0 draws the `s` frame
  (`src/lib/sprites/placement.ts:10`). For every current item the `n` and `s` frames have the same tiles, so the seeded
  size is identical either way; the plan uses `footprintOf(key, 0)` and a test asserts `n` = `s`. (Spec wording only.)
- **A3 Art storage.** 12 nullable columns on `map_items` (`art_<d>_sprite`, `art_<d>_drive_file_id`,
  `art_<d>_image_version` for d in n/e/s/w). A non-directional item ("one image otherwise") uses direction `s`, the
  direction of rotation 0; 039.2/039.4 refuse n/e/w for it with 422. The DTO always has four keys.
- **A4 Hidden items** are returned to every member with `hidden: true`; the palette (039.5) filters, the admin page
  (039.6) shows them. Hidden is presentation, not a secret.
- **A5 Names and groups.** Name = key with `.`/`_` → space, lowercase as in the spec examples ("door", "desk single",
  "floor carpet alt"). Group = the library group string (`desk`, `cabinet`, `circulation`, `floor`, `chair`, …), not
  today's palette headings ("Desks", "Stairs and lifts" in `src/ui/copy/roomlayout.ts:110-126`). 039.5 shows the stored
  group; Admins rename groups in 039.6.
- **A6 Package sprite** is stored as the full frame key of the bundled atlas for that direction; format check only
  (`^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$`), existence checked by the app in 039.2 against the atlas (SIM-033). Loosening
  the check later needs a small migration.
- **A7 No lazy seed on GET.** An org gets its catalog from the backfill or its first `members` insert; a GET before any
  member row exists returns `items: []` (cannot happen through the UI, see `AuthGate`).
- **A8 Library defaults** (name, group, order, size, kind, fixedSize) are not stored and not in the DTO; `libraryItem()` in
  `src/lib/map-items/library.ts` provides them for 039.2 reset and 039.6.
- **A9 "Composite FKs"** (ticket scope): nothing references `map_items` and placed fixtures keep `sprite_key` (D66.1), so
  the only composite key is the PK `(org_id, builtin_key)`; no FK is added (an FK from `layout_fixtures` would change
  saved layouts, out of scope).
- **A10 Future library keys** added to `keys.json` get no row in existing orgs until a later migration (or a lazy "insert
  missing keys" step) adds them; `toDto` drops rows whose key left the library. Follow-up, not in this ticket.
- **A11 Size of change** ≈ 750 lines, about 60 % tests and seed data; kept as one ticket (see Split proposal).
- Hotspots: no open ticket (IN_PROGRESS/REVIEW/DONE) edits `scripts/schema-check.mjs`, `db/migrations/README.md` or adds a
  migration (SIM-037.4/.5/.6/.8 plans add none). SIM-039.7 will later add a migration after this one. Per the ticket
  note, do not plan a SIM-037.x migration in parallel; merge this one first.

## Blocking questions
None.

## Split proposal
None. Possible cut if the reviewer wants smaller PRs: (a) migration + `library.ts` + sync/schema-check tests, (b) service
+ route + DB/route tests. Not proposed: (b) is ~200 lines and (a) alone delivers no reviewable behaviour through the API.
