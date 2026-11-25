## Consult: SIM-039.1 map item catalog (schema, per-org seed, read API) — database view

### Findings

1. **Pattern to copy** is `db/migrations/20261124160000_device_types.sql`. It has:
   - a catalog table with `unique (org_id, id)`;
   - a one-row-per-org marker table (`device_type_catalogs`) that serves as both the "seeded once" flag and the per-org lock;
   - `device_types_seed(p_org)`, which inserts the marker and seeds only `if found`;
   - an `after insert on members` trigger that calls the seed;
   - a backfill `select` over the union of org_ids from `members`, `rooms`, `seats`, `devices` and `groups`.

   Two things to add for the new migration:
   - Today's backfill list has no layout tables, so the new one should also union `layout_fixtures` (and `device_type_catalogs`, to be safe).
   - The `device_types` trigger is `after insert on members`, so a second trigger on the same table is fine. Triggers on one table fire in name order, and the two seeds are independent.

2. **`schema-check.mjs` already enforces R6 structure.**
   - Lines ~101-120: every table needs `org_id not null`, every FK must be composite starting with `org_id` on both sides, and every unique index except the id PK must start with `org_id`.
   - `map_items` will pass if the PK is `(org_id, builtin_key)` (the PK is exempt from the unique check, but it is a natural fit) and any unique name index leads with `org_id`.
   - The marker table needs `org_id` as its PK.
   - The `counts()` table list (~line 123) must add `map_items` and `map_item_catalogs`, so the seed idempotence check covers them.
   - The "1 later run applies …" check (~line 94) is hard-coded to a migration name. It needs a matching line for the new migration, or the existing assertion must still hold.
   - Add new assertions in the style of lines 490-570: seeded row count for an existing org and for a new org, a second seed is a no-op, an Admin-deleted row stays deleted, and each CHECK is refused with its constraint name.

3. **Seed content (97 keys in `src/lib/sprites/keys.json`).** The catalog is one row per base key. A directional key (`dir != null`, e.g. `door.n/e/s/w`) collapses to one base row via `key.slice(0,-2)`, as in `src/lib/layout-editor/palette.ts`. The set is:
   - the fixture groups in `FIXTURE_GROUPS` (`src/lib/validate/layout.ts`);
   - `desk.single` (in `SEAT_SPRITES`);
   - every `floor.*`;
   - `chair.office`.

   The footprint (`tiles`) comes from the `n` frame, or from the only frame for a non-directional item. Note `door.n` is 1×2 and `door.e` is 2×1; D66 says size is stored for rotation 0 (`n`). Items with `tiles: null` (sub-tile props) need a 1×1 default.
   - The SQL seed needs a literal VALUES list (~60-70 rows) generated from `keys.json`. Hand-typing it will drift.
   - Follow `src/server/device-types/sql-sync.test.ts` and add a test that parses the migration's seed list and asserts it equals a TS derivation (`REGISTRY` plus `FIXTURE_GROUPS`) for key, group, w and h. Otherwise a future `keys.json` change silently diverges from the seed.
   - Walls and windows are in `FIXTURE_GROUPS` (LAY-03 lists them), so they come in via the same rule.
   - Name from key: the spec examples are "wall t s" and "window double", which means replacing `.` and `_` with spaces. `floor.carpet.alt` becomes "floor carpet alt". Check that all derived names are unique under `device_type_key`-style normalization. Collisions are possible, for example `a.b_c` and `a b.c`.

4. **Reuse `device_type_key(name)`.** Name uniqueness should be `unique (org_id, device_type_key(name))` (D66 and LAY-07: case- and space-insensitive, at most 60 characters). Reusing the function avoids a second normalizer. The alternative is a new `map_item_key()`, which is not worth it.

5. **Columns (phase 1)** to cover SIM-039.1 and leave room for 039.2 to 039.4 without a further migration, as 036.2 did with its image columns:
   - `org_id uuid not null`, `builtin_key text not null`, `name text not null` (check `btrim(name) <> '' and char_length <= 60`).
   - `grp text not null` (`group` is a reserved word; check `char_length <= 40` and non-blank), `sort_order integer not null`.
   - `w smallint`, `h smallint` with `check (w between 1 and 4 and h between 1 and 4)`. Add a library default w/h, or a way to derive it, so "reset to defaults" in 039.2 is possible. Either store `default_w/h` in the row or let the app derive it from the registry. Deriving it from the registry avoids duplicated data.
   - `hidden boolean not null default false`.
   - Art per direction: either a package sprite key (`art_pkg_n/e/s/w text null`) plus custom image columns (`image_drive_file_id_n/e/s/w`, with `image_version` per direction or one shared version), reusing the Drive-id regex check from `device_types_image_check`.
   - Alternative with less column sprawl: a child table `map_item_art (org_id, builtin_key, dir, package_sprite, drive_file_id, version)` with a composite FK to `map_items` and a PK of `(org_id, builtin_key, dir)`. D66 says "composite FKs", which this form satisfies naturally. Compare the two before choosing:
     - columns are simpler for the read API (a single row);
     - the child table is cleaner for "non-directional uses one image".
   - Plan for 039.4 to need nothing more than writes.
   - `created_at`, `updated_at`.
   - Constraint `unique (org_id, builtin_key)` doubles as the PK.
   - `placeable boolean` (or derive it) so `chair.office` is a non-placeable row; the palette must hide it. This is a D66 (2) requirement the ticket text does not mention, so confirm it in the plan.
   - Also consider storing `directional boolean` and `layer` (floor/wall/furniture). 039.3 needs the layer, and the editor needs to know whether to show four art slots. It is cheaper to derive these from the registry in the DTO. Decide where the source of truth lives. Recommend the registry, with the DB holding only Admin-editable data.

6. **Marker and trigger.** Mirror `device_type_catalogs`, naming it `map_item_catalogs`, with `map_items_seed(p_org)`. Trigger `members_seed_map_items` on `members`. Also call the seed as a safety net from the 039.2 write path, as `createDeviceType` does, and consider the same inside the GET.
   - Important gap: a read-only GET for an org that has only a layout, with no member row, cannot happen, because auth creates a member on first visit. But the first-visit `members` insert and the GET could race, and an org with no marker would return an empty list. Two options:
     - the GET calls `map_items_seed` first (a write on a GET);
     - rely on the trigger, since the member row exists before any authenticated read.
     Recommend relying on the trigger and testing that a fresh org's first GET returns the full catalog. Check how first-visit member creation is sequenced in withAuth.
   - Also seed must fire for the dev seeder (`db/seed-dev.js` inserts members, so the trigger covers it). Note `db/seeder.js` has no device_type reference, so no change is expected there.

7. **API.** Mirror `src/app/api/device-types/route.ts`:
   - `GET` with `withAuth(..., { tier: "user" })`, `getPool()`, a 503 `unavailable`, `Cache-Control: no-store`, and `export const dynamic = "force-dynamic"`.
   - Server module `src/server/map-items/map-items.ts` (starts with `import "server-only"`), using `orgQuery(db, scope, sql)` with `where org_id = $1`.
   - A DTO type in `src/lib/map-items/types.ts` (lib is pure, so the UI can import it).
   - Order by group order, then `sort_order`, then `builtin_key`.
   - "Groups are ordered too" (LAY-07): the schema needs a group order. Options: a per-row `group_order` or a separate `map_item_groups (org_id, name, sort_order)` table. A separate table lets 039.2 reorder groups cheaply, but it adds a table and a FK. This is not decided in D66. Raise it in Open questions.
   - The response is 97-ish rows at most, which is small. No pagination needed, but cap the query with a limit as the device types route does.
   - Do not expose `image_drive_file_id`. Return `hasImage` and `imageVersion` per direction, as the device types DTO does.

8. **"Admin-only writes are audited" (AC 3).** There are no writes in 039.1 beyond the seed. The seed runs inside a trigger with no actor, so no audit row; `device_types` does the same. State that explicitly in the plan so the reviewer does not read it as a miss. Audit lands in 039.2.

9. **Expand-only (R2).** All objects are new, and `layout_fixtures` and saved layouts are untouched. The previous image keeps working: the old image inserts members, the trigger seeds, and nothing reads the table. Forward-only, so no DOWN, per R2 and tudocuatui rules; the global "reversible migrations" rule yields to CLAUDE.md here. Timestamp must be later than `20261125180000_handoff_decided_by.sql`, for example `20261125200000_map_items.sql`. The ticket note on SIM-037.x applies: check no open ticket has a migration with an earlier or equal timestamp.

10. **Indexing.** The PK `(org_id, builtin_key)` covers the list by org. A name uniqueness index leads with org_id. If art uses a child table, its composite FK is covered by its PK prefix. No extra indexes are needed at this size. Order by uses ~100 rows per org and needs no index.

11. **Tests.**
    - The sql-sync test described above (seed list equals the registry derivation).
    - A `*.db.test.ts` (run via `pnpm test:db`), covering:
      - a new org via a member insert gets the full catalog;
      - an existing org gets it from the migration backfill (`schema-check.mjs` covers this, since it creates old orgs before the later run, as lines ~80-92 do);
      - a second seed call is a no-op;
      - an Admin-deleted row stays deleted;
      - two orgs are isolated: `listMapItems` for org A returns only A's rows;
      - CHECK refusals (size 0 and 5, blank name, a 61-character name, a duplicate name differing only in case and spaces, a bad Drive id).
    - A route test like `device-types-routes.test.ts`: 401 without a token, 200 for a user-tier member, and no cross-org rows.

### Recommendations
- Use the 036.2 shape: `map_items` + `map_item_catalogs` + `map_items_seed(p_org)` + `members` trigger + backfill union that includes `layout_fixtures`.
- Generate the seed VALUES from `keys.json` with a one-off script, and lock it with an sql-sync test. Do not hand-type it.
- Put all D66 columns in now (size, hidden, `placeable`, per-direction package sprite and image columns or a child table) so 039.2 to 039.4 need no further migration. This matches how 036.2 pre-added its image columns.
- Keep derivable facts (directional, layer, library default size) in the registry and compute them in the DTO. Store only Admin-editable state.
- Update `schema-check.mjs`: add the tables to `counts()`, add the checks for seed count, idempotence, deleted-stays-deleted and each constraint, and update the "later run applies" line for the new migration name.
- Update `db/migrations/README.md` if it lists per-org seeded catalogs (it mentions `device_types`).

### Risks
- Seed drift between SQL and `keys.json` if the sync test is missing. This is the largest risk, because it silently desyncs the palette.
- `chair.office` and `desk.single` are not in the existing palette-derived list the same way (`chair.office` has no `FIXTURE_GROUPS` group). The seed rule must special-case them. The `placeable` flag must stop the palette and the validator from placing a chair.
- `door.n` (1×2) and `door.e` (2×1) are rotations of one item. The seed must take `n` (rotation 0) as the stored size, or the existing door footprint will be wrong.
- Name collisions after deriving names from keys would break the unique index and abort the whole migration. Verify with a dry run over `keys.json`.
- A migration conflict with parallel SIM-037.x tickets (High path; merge order matters).
- If GET depends on the trigger, an org with data but no members would see an empty catalog. This cannot occur through the API.

### Open questions
1. Group order storage: per-row column or a `map_item_groups` table? D66 and LAY-07 say groups are ordered but do not give a storage model.
2. Art per direction: four sets of columns on `map_items`, or a child table? Recommendation is to decide it once here, since 039.4 depends on it.
3. Is `placeable` stored or derived (`chair.office` is the only non-placeable row)?
4. Should the DTO carry the library defaults (default name, group, size) for the "reset to defaults" button in 039.2, or does 039.2 derive them from the registry? Recommendation: derive from the registry.
5. Does the sort order seed follow `palette.ts` (group then key, desk group first), so the seeded palette looks exactly as today? LAY-03 says existing layouts keep drawing as before, and the palette order should match too.
6. The ticket's scope line says "name from key": confirm the rule (`.` and `_` become spaces) and that "floor carpet alt" style names are acceptable.

Files read: /home/user/simap/work/tickets/SIM-039.1/ticket.md, /home/user/simap/db/migrations/20261124160000_device_types.sql, /home/user/simap/src/app/api/device-types/route.ts, /home/user/simap/src/server/device-types/device-types.ts, /home/user/simap/src/server/device-types/sql-sync.test.ts, /home/user/simap/src/lib/layout-editor/palette.ts, /home/user/simap/src/lib/sprites/keys.json, /home/user/simap/scripts/schema-check.mjs, /home/user/simap/docs/spec-v1.md (LAY-01/03/06/07), /home/user/simap/work/decisions.md (D61, D64, D66).
