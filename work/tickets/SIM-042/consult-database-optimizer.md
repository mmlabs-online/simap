# Consult — database-optimizer — SIM-042

**Findings**

1. `20261125200000_map_items.sql` is applied and its checksum is recorded, so it cannot be edited (README rule, D3). The ticket says "(`map_items_seed`, `20261125200000_map_items.sql`)". That should read: a NEW migration redefines `map_items_seed` with `create or replace`.
2. `map_items_seed(p_org)` inserts the 53 rows only when the `map_item_catalogs` insert reports `found`. For an org that is already seeded it does nothing. Two things are therefore needed:
   - A backfill `insert ... select` for existing orgs, driven by `map_item_catalogs`.
   - A redefined function for orgs created later. The `members` insert trigger and the `save.ts:84` safety-net call both invoke the function by name, so they pick up the new body with no further change.
3. Old-image safety looks fine:
   - `toDto` (`src/server/map-items/map-items.ts:41`) returns null for a key that is not in the image's `LIBRARY_ITEMS`, so the previous image skips the new rows.
   - The layout read already drops unknown keys.
   - The old image's trigger calls the new DB function, which is harmless.
   - The FKs only constrain placed keys, so a layout saved by the old image still loads.
4. Name collision risk, which is the main correctness trap. `map_items_org_name_key` is unique on `(org_id, device_type_key(name))`. The seed uses `on conflict do nothing` with no conflict target, and that also swallows a name-index violation. An existing org may have renamed an item (edit.ts supports rename, D67) to, for example, "trash bin" or "wall clock". The new row would then be silently skipped, and "every org has one row per new key" would fail. Plan for it:
   - Backfill with `on conflict (org_id, builtin_key) do nothing`. Do not use bare `on conflict do nothing`, so a name clash raises 23505 instead of hiding.
   - Before inserting, resolve clashes explicitly. Insert with a fallback name (for example the default name plus a suffix) when `device_type_key(name)` already exists for the org. Or have the migration abort with a clear error.
   - Check that every new default name is at most 60 characters and every group is at most 40.
5. `src/server/map-items/sql-sync.test.ts` reads ONLY the first migration and asserts that its seed regex matches equal the full `LIBRARY_ITEMS`. Once keys are added to the registry, this test fails. Update it to parse the latest `map_items_seed` definition (the new migration) and the union of backfill rows, for example by checking that the last redefinition of the function contains the full list. The regex `\(p_org, '...', ...\)` also works if the new function body keeps that tuple format.
6. `scripts/schema-check.mjs` has hard-coded 53 at lines 853 to 866 and 883 (52 after one deletion). These need updating to the new total, with extra checks:
   - An org seeded before the new migration gets the new rows.
   - A new org gets all of them.
   - A deleted pre-existing item stays deleted.
   - A renamed-name collision case is handled.
   - A re-run of the seed is idempotent.
   - Footprints match, for example a projector screen at 2x1.
   - Existing rows are unchanged.
   Line 133 expects "later runs apply map_items", which is fine. Check how schema:check stages the migrations (old-org fixtures are created before `map_items`). The new migration needs the same treatment if it is to be checked against pre-existing orgs.
7. Code-side coupling to the new keys:
   - `LIBRARY_ITEMS` is built from `REGISTRY` and `FIXTURE_GROUPS` (`src/lib/validate/layout.ts:46`). A new group such as "clock" or "appliance" must be added to `FIXTURE_GROUPS` (and to the footprint and placement tables), or the item is not a library item.
   - `ALLOWED_GROUPS` in `src/lib/map-items/art.ts` derives from `LIBRARY_ITEMS`.
   - The seed tuple (name, group, w, h) must equal what `make()` produces: name is the key with `.` and `_` turned into spaces, group is `spriteInfo().group`, and size comes from `footprintOf(key, 0)`.
   - Items have the same keys and size in all four directions, because the catalog row is per base key.

**Recommendations**

- Add one new migration, for example `20261126xxxxxx_map_items_new_builtin.sql`, containing:
  1. `create or replace function map_items_seed` with the 53 old rows plus the new rows, using the same tuple format. Keep the `found` guard.
  2. A backfill: `insert into map_items (org_id, builtin_key, name, group_name, w, h) select c.org_id, v.* from map_item_catalogs c cross join (values ...) v on conflict (org_id, builtin_key) do nothing`. This adds a name-collision guard per finding 4.
  3. No change to existing rows, no `update`, and no FK or column changes.
- Keep the new values list in one place in the SQL. Use a small `values` CTE shared by the backfill, and keep the function body in the tuple format that the sync test parses.
- Update `sql-sync.test.ts` to compare against the new migration. Update the schema-check counts and add the checks above. Add a DB test in `map-items.db.test.ts` for the seed for existing and new orgs, and for idempotency.
- Pin the footprint per item in the plan (the ticket asks for a PM default): wall clock 1x1, desk lamp 1x1, trash bin 1x1, water cooler 1x1, projector screen 2x1, flip chart 1x1 or 2x1. Footprint is stored in `map_items.w/h`, so it is cheap to get wrong only until release. After release, changing it means editing rows, which is an admin-editable field (edit.ts).
- Stay expand-only, with no contract step. Add a README entry for the migration under "Map items".

**Risks**

- Silent skip of a new row on a name collision (finding 4). This is the only data-correctness risk.
- A later key rename or removal in the registry is not safe. After this migration, new keys are permanent: the FK is on delete restrict and rows are never deleted. Lock the key names in the plan.
- Name or group length or format violations abort the whole migration, because the checks are enforced inside the single transaction. Test it against a copy of the data.
- The migration is on a High path (db/migrations), so the plan gate is required. A seed of about 20 rows times the number of orgs is small, with no lock concern (the migrator runs in a transaction, `insert` into the new catalog only).
- Hand-maintained TS and SQL lists can drift. The sync test is the guard, so it must be updated in the same PR.
- The old image's `listMapItems` drops unknown rows. During the rollout window the new image shows new items and a rolled-back image does not. That is expected.

**Open questions**

1. Should a name clash on backfill use a fallback name, or abort the migration? I recommend a suffixed fallback name and a logged notice. Check the production data for existing custom names first, since there are very likely none that match.
2. Footprints and group names for the new items: a new "decor" group, or reuse existing ones such as "label" and "prop"? A new group needs a `FIXTURE_GROUPS` change.
3. Does `schema:check` stage old-org fixtures before the new migration, so "existing org before this migration" is really tested?
4. Are the other-direction art columns (`art_*_sprite`) left null for the new rows, as for the old rows? I assume yes, since the old seed leaves them null.

Files:
- db/migrations/20261125200000_map_items.sql
- db/migrations/README.md
- src/server/map-items/sql-sync.test.ts
- src/lib/map-items/library.ts
- src/lib/validate/layout.ts
- src/server/layout/save.ts
- scripts/schema-check.mjs
