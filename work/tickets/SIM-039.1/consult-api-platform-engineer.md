## Findings

**Pattern to copy (device types)**
- Route `src/app/api/device-types/route.ts` GET: `withAuth(handler, { tier: "user" })`; `export const dynamic = "force-dynamic"`; `getPool()` null -> `apiError(503,"unavailable")`; service call returns `Result<T>` (`{ok:true,value}` or `{ok:false,status,code}`); success is `Response.json(value, {headers:{"Cache-Control":"no-store"}})`.
- The service (`src/server/device-types/device-types.ts`) starts with `import "server-only"`. It reads with `orgQuery(db, scope, sql)`, where `$1` is always `org_id` and the SQL has `where org_id = $1`. Rows map to a DTO in a `toDto` function. The list is wrapped as `{ items: Dto[] }`.
- Types and limits live in `src/lib/device-types/types.ts` (pure, no server import, per R1). Mirror this as `src/lib/map-items/types.ts`.
- Error shape is only `{ error: { code } }` from `apiError` (`src/server/http/respond.ts`). Codes are a closed list in `src/lib/api/error.ts` (`API_ERROR_CODES`). 039.1 needs no new code for GET. 039.2 will add `item_in_use`, and `not_found`/`invalid_request` already exist. Don't add unused codes in 039.1.
- Auth: `tier:"user"` means any active member. The wrapper issues 401/403 before the handler, so a read-only GET has no R7 risk.
- Seed pattern (SIM-036.2, `db/migrations/20261124160000_device_types.sql`):
  - a catalog marker table, `device_type_catalogs(org_id pk, seeded_at)`;
  - a `*_seed(p_org)` plpgsql function that inserts the marker with `on conflict do nothing` and, `if found`, inserts the rows;
  - an `after insert on members` trigger calling it;
  - a backfill `select` over the union of org_ids from members, rooms, seats, devices and groups.

  It seeds once per org, so a deleted seed row stays deleted. For map items this matters less (no Admin delete in phase 1, and hide is not delete). Still copy the marker so later re-seeds are not clobbered, and so 039.2's resize/lock logic has a per-org row to lock.
- Today's library comes from `src/lib/sprites/keys.json` via `REGISTRY` (`src/lib/sprites/registry.ts`). `src/lib/layout-editor/palette.ts` builds the palette: seat sprites (`SEAT_SPRITES`), then base fixture keys (a directional `_n/_e/_s/_w` collapsed to its base) in `FIXTURE_GROUPS`, sorted by group then key. `RegistryEntry` has `group`, `dir`, `tiles:[w,d]|null` and `blocks`. A null `tiles` is a sub-tile prop, so the catalog default size for it is 1x1.
- Direction: only `n|e|s|w` (`Direction` in `src/lib/sprites/types.ts`).

## Recommendations

1. **DTO** (new `src/lib/map-items/types.ts`, camelCase like `DeviceTypeDto`):
```
MapItemDto = {
  builtinKey: string;      // stable id for clients; no separate uuid
  name: string;
  group: string;
  order: number;           // integer sort position within the org
  w: number; h: number;    // tiles, rotation 0 (D66.7)
  hidden: boolean;
  placeable: boolean;      // false for chair.office (D66.2)
  directional: boolean;    // derived from the library (REGISTRY dir), not stored
  fixedSize: boolean;      // derived: desk, chair, floor.* (D66.7); lets 039.6 disable inputs
  art: { n|e|s|w: { sprite: string|null; imageVersion: number; hasImage: boolean } }
}
MapItemListResponse = { items: MapItemDto[] }
```
   Reasons: 039.2 (writes, `builtinKey` in the path), 039.4 (image per item+direction, `imageVersion` for blob cache keys and ETag, as device types do), 039.5 (palette, ghost size, renderer fallback chain image -> package sprite -> frame -> placeholder) and 039.6 (admin page) all read this one shape. Keep it additive-only from here (Critical Rule 1). Never expose Drive file ids; return only `hasImage` plus `imageVersion`. Non-directional items could use a single `art` key, so decide one representation. I suggest always emitting n/e/s/w keys and having non-directional items use `s` only, or document otherwise.
2. **Schema**
   - Table `map_items`, pk `(org_id, builtin_key)`.
   - Columns: `name` (<=60, btrim check), `group_name`, `sort_order int`, `w`/`h` smallint with checks 1..4, `hidden`, `placeable`, and per-direction `art_<dir>_sprite text null`, `art_<dir>_drive_file_id text null` (same regex check as device_types), `art_<dir>_version int not null default 0`.
   - Add `created_at`/`updated_at`.
   - Expose only `order` in the DTO (rename the column to avoid the reserved word `order`).
   - Marker table `map_item_catalogs(org_id pk)`, seed function plus members trigger, and backfill. Drive/Drive-file columns can be nullable now so 039.4 needs no migration (as 036.2 did). "Composite FKs" in the ticket: the only FK-able thing is layouts. `layout_fixtures` stays unchanged, so no FK from fixtures to the catalog (`sprite_key` stays text). Use the composite `(org_id, builtin_key)` unique/pk and make 039.2/039.3 look up by it. Do not add an FK that would break old images or saved layouts.
   - Seed data must come from the library. Option: generate the SQL VALUES list from `keys.json` and add a test that the migration seed equals the lib (as `SEED_DEVICE_TYPES` is checked against the migration), so the two cannot drift. Expected rows: every base fixture key in `FIXTURE_GROUPS`, `desk.single`, `chair.office` (`placeable=false`), and every `floor.*`. Walls and windows are included as fixtures (D66.4). "Name from key" needs a deterministic rule (for example `wall.brick` -> "Wall brick"), defined once in lib and tested. Default order should equal today's palette order (group, key) so the first release shows no visible change. Group names should equal the existing group strings.
3. **GET `/api/map-items`**: `withAuth(..., {tier:"user"})`; service `listMapItems(db, scope)` using `orgQuery`, `where org_id = $1 order by sort_order, builtin_key`, no `limit` needed (bounded by the library; add a cap constant anyway for parity). The response includes hidden items, because the admin page (039.6) needs them. The palette (039.5) filters client-side. State this in the plan and DTO comment, otherwise 039.5 and 039.6 will need two endpoints. `Cache-Control: no-store`.
4. **R6/R7**: only `orgQuery`; no org taken from the request. Read-only, so no audit rows are needed in 039.1 (the ticket's "Admin-only writes are audited" criterion belongs to 039.2/039.4; mark it N/A or satisfied-vacuously for this ticket in the plan). The safety-net call to the seed function before listing can be skipped for GET (the seed function writes, and a GET with a write side effect is poor form). The members trigger plus backfill cover orgs; but see Risk 1.
5. **Tests**: unit test (lib) that seed list equals library and default sizes equal `tiles`; route test modelled on `device-types-routes.test.ts` (401/403 handled by the wrapper, 503 with no pool, a 200 body shape); a `.db.test.ts` for new-org seeding via a member insert, existing-org backfill, and cross-org isolation; update `schema-check.mjs`, `db/migrations/README.md` and `.env`-free as there is no config. Run `pnpm test:db` locally.
6. Sequence: the migration is a High path, so plan approval is required, and the ticket forbids planning it alongside a SIM-037.x migration (check the timestamp ordering too).

## Risks
1. An org that has no `members` row yet when the migration runs, or one that exists only through Identity, gets no catalog until its first member insert. A GET then returns an empty `items`. Mitigation: the same as device types (the trigger fires on first member creation, which precedes any request by a member), but confirm that first-visit member creation happens before `GET /api/map-items`. If not, the route needs a lazy seed.
2. Drift between `keys.json` and the DB seed. A new library key added later has no row in existing orgs. Plan how future library additions reach orgs (a forward-only migration per addition, or a lazy "ensure missing keys" step). That should be a follow-up note, since R4 keeps it out of scope.
3. Locking the DTO early: renaming `builtinKey`, the `art` shape or `order` later breaks 039.2 to 039.6 in flight. Settle the shape in the plan and have the planner paste the DTO into the plan for the siblings.
4. Name and group derivation: group strings come from the registry and are displayed. Admin regroup (039.2) needs group to be free text with a length limit, so don't reuse an enum.
5. `chair.office` as a non-placeable row must not appear in the editor palette; 039.5 must filter on `placeable`. The DTO field covers it.

## Open questions
- Should GET include hidden items for all members, or should non-admins get them filtered server-side? (Recommended: include all and flag `hidden`; hidden is a presentation setting, not a secret. Confirm.)
- Is `art` per direction for all items, or only directional ones? And are package-sprite choices stored as the full key (for example `wall.brick_n`) or the base key plus direction? I recommend the full key per direction, because the validator, `resolveLayout` and the registry already use full keys.
- Whether `order` is dense 0..n, or gapped (10, 20...) to ease 039.2 reorder. Dense with a rewrite on reorder is simplest.

Files read: /home/user/simap/work/tickets/SIM-039.1/ticket.md, /home/user/simap/work/tickets/SIM-039.{2,4,5}/ticket.md, /home/user/simap/work/decisions.md (D61, D64, D66), /home/user/simap/src/app/api/device-types/route.ts, /home/user/simap/src/lib/device-types/types.ts, /home/user/simap/src/server/device-types/device-types.ts, /home/user/simap/db/migrations/20261124160000_device_types.sql, /home/user/simap/src/lib/api/error.ts, /home/user/simap/src/server/http/respond.ts, /home/user/simap/src/lib/layout-editor/palette.ts, /home/user/simap/src/lib/sprites/types.ts.
