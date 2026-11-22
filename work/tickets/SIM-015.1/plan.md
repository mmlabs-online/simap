Status: READY

# Plan — SIM-015.1: Room layout tile-grid schema and API

> **For Ming:** the whole ticket is about 1,400 changed lines, so this plan proposes three slices (see `## Split proposal`).
> **Only Slice 1 is planned for implementation here:** the migration and the pure validator. The API contract for Slices 2
> and 3 is fixed below so that the one migration you approve serves all three. Your choices are A1–A14 under
> `## Assumptions`, each with a recommended default. Nothing is blocking.

## Scope summary

Ticket (`ticket.md:26-32`):
> A forward-only migration adding the room size in tiles and tile placement (tile x/y, rotation 0/90/180/270, sprite key)
> for seats and layout fixtures. SIM-008's free-form columns stay until a later contract migration (R2).
> A validated layout payload in `src/lib`: bounds, whole tiles, the four rotations, known sprite keys, and the manifest's
> blocking rule.
> `GET /api/rooms/{code}/layout` for any org member, with seat status derived and never read from storage.
> `PUT /api/rooms/{code}/layout` for Admin: one save of the room size, the existing seats' placement and the fixtures.
> Every query scoped by the verified token's org (R6), and domain refusals as 409/422 (R7).

Spec (`docs/spec-v1.md`):
> LAY-01 (:339-343) "A room has a size in tiles (width × height)... Items: seat desks (a desk sprite may cover several
> tiles), fixtures, and walls/floor. Rotation in 4 directions only; size is fixed by the sprite; no free resize... Items
> cannot overlap where the manifest says they block (e.g. two desks on one tile)."
> LAY-02 (:346) "Each desk on the grid is one seat record."
> LAY-03 (:350-351) "door, window, wall, stairs, elevator, server rack, cabinet, pillar, plant, blocked area, label. They
> are saved with the room."
> SEA-02 (:236) "Every view shows a seat as empty or occupied, computed from its occupant. No status column exists."

Decisions (`work/decisions.md`):
> D43 "The editor places items on whole 16 px tiles, 4 rotations, fixed sprite sizes; a room has a size in tiles...
> Needs a forward-only migration on top of SIM-008's free-form geometry columns."
> D48 "Tile size 32 px". D49 "One map per room in v1".
> D58 "SIM-015.1 is re-scoped to the tile-grid schema and layout API."

Style guide (`docs/art/style-guide.md`):
> :42-43 "A sprite that needs different art per direction ships one frame per direction (`.n`, `.e`, `.s`, `.w`);
> symmetric sprites ship one frame."
> :174 "`blocks` = whether another blocking item may share the tile."

### Settled rules (all slices)

| Topic | Rule | Evidence |
|---|---|---|
| Route | `/api/rooms/[id]/layout`, canonical room uuid, otherwise 404. Not `{code}`. | `src/app/api/rooms/[id]/` already exists, and Next.js does not allow two slug names at one level. The UI already resolves code to id (`useRoomSeats.ts:54`, `seats-api.ts:57`). The spec names no API path, so this does not conflict with it. A2. |
| Stored sprite | The **base key**: `desk.single`, `door`, `sofa`. A full directional key (`desk.single.e`) is refused as unknown. | `resolveFrameKey` would otherwise accept `desk.single.e` at any rotation through its plain-key fallback (`placement.ts:30-31`), so the rotation and the art could disagree. |
| Directional sprite | Any of the 4 rotations. Rotation picks the frame: 0=s, 90=e, 180=n, 270=w. | `placement.ts:9,27-32` |
| Non-directional sprite | **Rotation must be 0**, otherwise 422 `layout_bad_rotation`. | The renderer draws the same frame at every rotation, with an unswapped footprint (`placement.ts:31,146-147`). A3. |
| Footprint | `REGISTRY[resolveFrameKey(sprite, rotation)].tiles ?? [1,1]`. **Never swap w/h in code**: the `.e/.w` entries already carry the swapped size. | `keys.json:178-209`, `sprite-manifest.ts:76` |
| Blocking | Two items may not share a tile when both have `blocks: true`, across all layers, seats and fixtures together. | LAY-01, style guide :174 |
| Chair | Implied, never stored. Its tile comes from `chairFor`. It must be in bounds, not on a blocking tile, and not shared with another seat's chair. | `placement.ts:35-53`. A5. |
| Floors | Ordered zones in `rooms.floor_zones` (jsonb). Zones may overlap; later zones paint on top. | `layout.ts:9,15`, `placement.ts:153-161`, LAY-01. A6. |
| Avatar seed | The occupant's **member id**. Raw `sub` is never returned. | Member id is already in `SeatDto` (`seats.ts:88`). A7. |
| Stale save | `rooms.layout_version`. GET returns `version`, PUT sends `baseVersion`, mismatch gives 409 `layout_stale`. | A8 |
| Unsaved room | `grid_w` null means unsaved. GET computes a deterministic default and **never writes it**. | A9 |
| Unplaced seat | GET auto-places it on a free slot. If none is free, it is listed in `unplaced`. It is never hidden. | AC3, A9 |

## Acceptance criteria → verification

Slice 1 (this plan):

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | "The migration is forward-only, and the previous image keeps working after it is applied." | Diff adds one new migration file and edits no applied one. `pnpm schema:check` passes, including the `8 old-shape insert` checks. Existing `pnpm test:db` passes unchanged: these are the current services' real queries running on the new schema. |
| 5a | "An out-of-bounds, overlapping, wrongly rotated or unknown-sprite payload ... is refused" (validator part) | `src/lib/validate/layout.test.ts` groups `shape`, `sprites`, `rotation`, `footprint`, `bounds`, `overlap`, `chair`. |
| 6a | "Unit tests cover the payload validation" | `pnpm test` |
| S1 | The validator agrees with the renderer | `fixture.test.ts › "DEMO_LAYOUT passes the layout rules"` and `committed-atlas.test.ts › "committed manifest blocks equal the registry"`. |

Delivered by later slices (not reviewed here):

| # | Criterion | Slice |
|---|---|---|
| 2 | GET returns the room size, each seat's placement and derived status, and the fixtures, for the caller's org only | 2 |
| 3 | A room with no saved layout returns a usable default, and its seats stay reachable | 2 |
| 4 | PUT is Admin-only, and a valid layout survives a reload | 3 |
| 5b | A refused payload, or a seat from another room or org, saves nothing | 3 |
| 6b | DB integration tests cover org scoping and the save | 2 and 3 |

## Ming verification after merge

None for Slice 1: no endpoint or UI changes. The migration reaches production only through Ming's normal release step.

## Files to create / modify

Slice 1 only. The implementer must not touch anything else without recording why.

| File | Change | Required because | High path? |
|---|---|---|---|
| `db/migrations/20261122120000_room_tile_layout.sql` | Create: the expand migration below | Ticket scope, R2 | **High** |
| `db/migrations/README.md` | Add a bullet after line 38 describing the tile columns, `kind` null rule and legacy rows | Schema doc stays true | **High** |
| `scripts/schema-check.mjs` | Add section `// 8 tile layout` after line 301, before `// extras` | Required check for migration tickets | No |
| `src/lib/sprites/layout.ts` | Replace the "Provisional" comment at line 11; add `LayoutSaveValue` | SIM-015.1 owns this shape | No |
| `src/lib/validate/layout.ts` | Create: `LAYOUT_LIMITS`, `footprintOf`, `validateLayoutSave`, `checkLayoutRules` | Pure logic first | No |
| `src/lib/validate/layout.test.ts` | Create: unit tests | AC 5a, 6a | No |
| `src/lib/api/error.ts` | Add the 4 validator codes after line 20 | Closed code union | No |
| `src/ui/copy/api.ts` | Add English text for the 4 codes after line 25 | `satisfies Record<ApiErrorCode, string>` fails typecheck otherwise. Copy only, no UI. | No |
| `src/app/dev/roommap/fixture.test.ts` | Add one test | Pins validator to renderer data | No |
| `scripts/sprites/committed-atlas.test.ts` | Add one test | The server reads `blocks` from the registry, the client from the manifest (`placement.ts:149`) | No |

Not changed: `db/seeder.js` (old-shape inserts remain valid), `placement.ts`, `RoomMap`, `DEMO_LAYOUT`.

## Data model / migration

`db/migrations/20261122120000_room_tile_layout.sql` (no `begin`/`commit`, per `db/migrations/README.md:8`):

```sql
-- SIM-015.1 (D43, D48): tile-grid layout. Expand only; the free-form x/y/rotation/w/h columns stay until a later
-- contract migration. Null placement = not placed yet. Footprints, bounds and overlap are checked in src/lib.

alter table rooms
  add column grid_w integer null,
  add column grid_h integer null,
  add column floor_zones jsonb not null default '[]'::jsonb,
  add column layout_version integer not null default 0,
  add constraint rooms_grid_pair_check check (num_nonnulls(grid_w, grid_h) <> 1),
  add constraint rooms_grid_size_check check (grid_w > 0 and grid_h > 0),
  add constraint rooms_floor_zones_check check (jsonb_typeof(floor_zones) = 'array'),
  add constraint rooms_layout_version_check check (layout_version >= 0);

alter table seats
  add column tile_x integer null,
  add column tile_y integer null,
  add column tile_rotation smallint null,
  add column sprite_key text null,
  add constraint seats_tile_placement_check check (num_nonnulls(tile_x, tile_y, tile_rotation, sprite_key) in (0, 4)),
  add constraint seats_tile_xy_check check (tile_x >= 0 and tile_y >= 0),
  add constraint seats_tile_rotation_check check (tile_rotation in (0, 90, 180, 270)),
  add constraint seats_sprite_key_check check (btrim(sprite_key) <> '');

-- kind stays for legacy rows; a tile-placed fixture is identified by sprite_key and stores kind = null.
alter table layout_fixtures
  alter column kind drop not null,
  add column tile_x integer null,
  add column tile_y integer null,
  add column tile_rotation smallint null,
  add column sprite_key text null,
  add constraint layout_fixtures_kind_or_sprite_check check (kind is not null or sprite_key is not null),
  add constraint layout_fixtures_tile_placement_check check (num_nonnulls(tile_x, tile_y, tile_rotation, sprite_key) in (0, 4)),
  add constraint layout_fixtures_tile_xy_check check (tile_x >= 0 and tile_y >= 0),
  add constraint layout_fixtures_tile_rotation_check check (tile_rotation in (0, 90, 180, 270)),
  add constraint layout_fixtures_sprite_key_check check (btrim(sprite_key) <> '');
```

- **Previous image:** every new column is nullable or has a constant default, so its inserts (`seats.ts:278`,
  `seeder.js:99-129`) still work. No non-test server code uses `select *`. `layout_fixtures` is referenced only by the
  seeder and `schema-check`, so a `kind = null` row cannot reach old code.
- **`kind`:** the existing check stays untouched, because a SQL `CHECK` passes on null. This avoids both widening the
  list and mapping about 16 sprite groups onto it.
- **No backfill:** old x/y are free-form pixels with no reliable tile conversion.
- **No new index:** `layout_fixtures_org_room_idx` and `seats_org_room_seq_key` already serve room-scoped reads.
- **No DB overlap constraint:** a footprint depends on manifest data, and an exclusion constraint would need
  `create extension`, which is Ming's step. The DB enforces row-local rules; `src/lib` enforces bounds and overlap, and
  Slice 3 runs it before the locked write.
- **Downgrade:** forward-only. Rollback is the previous image, which ignores the new columns.
- **Later contract migration (not this ticket):** drop free-form columns and legacy fixture rows.

## API contract

**No endpoint ships in Slice 1.** This contract is fixed now so the migration and validator fit it.

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET (Slice 2) | `/api/rooms/{id}/layout` | none | `LayoutResponse` | 200, 401/403 (wrapper only), 404, 503 | `tier: "user"` |
| PUT (Slice 3) | `/api/rooms/{id}/layout` | `LayoutSave`, max 256 KiB | `LayoutResponse` with the new `version` | 200, 400, 401/403 (wrapper only), 404, 409, 422, 503 | `tier: "admin"` |

```ts
type LayoutResponse = {
  room: { id: string; code: string; name: string };
  version: number;                     // 0 until the first save
  saved: boolean;                      // false = computed default
  layout: RoomLayout;                  // existing type: w, h, floors, seats (with code), fixtures
  seatViews: Record<string, SeatView>; // every seat, including unplaced; avatarSeed = member id
  unplaced: { id: string; code: string }[];
  truncated: boolean;                  // room has more than 500 seats
};

type LayoutSave = {
  baseVersion: number;
  w: number;
  h: number;
  floors: { sprite: string; x: number; y: number; w: number; h: number }[];
  seats: { id: string; sprite: string; x: number; y: number; rotation: number }[]; // exactly the room's seats
  fixtures: { sprite: string; x: number; y: number; rotation: number }[];          // no id: replaced on save
};
```

`SeatView.state` precedence: `cannot`, then `mine`, then `occupied`, then `empty`. A cannot-seat seat that still has an
occupant keeps its `avatarSeed` and `name` (clearing is the only occupant change allowed there, `rules.ts:17,27`).
`pending` is not emitted until SIM-014.

| Status | Code | When | Slice |
|---|---|---|---|
| 400 | `invalid_request` | Bad JSON, oversize body, wrong type, non-integer, unknown key, duplicate seat id, over a count cap | 1 |
| 422 | `layout_out_of_bounds` | Grid outside 1–64, or an item, floor zone or chair outside the grid | 1 |
| 422 | `layout_overlap` | Two blocking items share a tile, a chair is on a blocking tile, or two chairs share a tile | 1 |
| 422 | `layout_bad_rotation` | Rotation is not 0/90/180/270, or is non-zero on a non-directional sprite | 1 |
| 422 | `layout_unknown_sprite` | Not a known base key, or wrong role (for example a floor sprite as a fixture) | 1 |
| 409 | `layout_stale` | `baseVersion` differs from the stored version | 3 |
| 409 | `layout_seats_changed` | Submitted seat ids differ from the room's seats. The same answer for a foreign id, so it reveals nothing. | 3 |
| 422 | `layout_too_many_seats` | The room has more than 500 seats | 3 |
| 404 | `not_found` | Bad uuid, or the room is not in the caller's org | 2, 3 |

Rule of thumb: **wrong type = 400; right type, wrong value = 422; state moved on = 409.** Services never emit 401/403 (R7).

**PUT transaction (Slice 3), in lock order (`rooms.ts:213-224`):**
1. Route: `readJson(req, LAYOUT_LIMITS.bodyBytes)`, then `validateLayoutSave`, before any transaction.
2. `select ... from rooms ... for update`; 404 if absent; compare `layout_version`.
3. `select id from seats where org_id = $1 and room_id = $2 order by id for update`; compare the id set.
4. Update seat placement only (never occupant, status, `seat_counter` or devices).
5. `delete from layout_fixtures where org_id = $1 and room_id = $2 and sprite_key is not null`, then insert the payload
   with `kind = null`. Legacy rows are not deleted.
6. Update `grid_w`, `grid_h`, `floor_zones`, bump `layout_version`.
7. One audit row `room.layout_save`, counts only.
8. Re-read and return in the same transaction.

**GET (Slice 2)** reads in one `repeatable read, read only` transaction, so a concurrent save cannot produce a new
version with old seats.

**Default layout (Slice 2)**, pure `src/lib/sprites/default-layout.ts`:
- `cols = clamp(ceil(sqrt(n)), 4, 21)`, `rows = max(ceil(n / cols), 1)`, `w = max(12, cols × 3)`, `h = max(8, rows × 2)`.
- Seats in `seq` order, `desk.single` rotation 0, at a 3 × 2 tile pitch (desk row, chair row). A 64 × 64 room holds 672
  this way, above the 500-seat limit. For 500 seats: 63 × 48.
- One `floor.wood` zone over the room, no fixtures.
- In a **saved** room, a seat with null placement or a stored sprite that no longer exists takes the first free pitch
  slot that passes the same rules; otherwise it goes to `unplaced`.
- Required test: the default output passes `checkLayoutRules`, so an Admin can save it unchanged.

## Tests to write

| Test (file › name) | Covers |
|---|---|
| `src/lib/validate/layout.test.ts › shape › accepts a minimal valid save` | Happy path |
| `› shape › refuses non-object, missing field, unknown key at each level` | 400, as `room.ts:14` |
| `› shape › refuses floats, strings and NaN-like values for x, y, w, h, rotation, baseVersion` | Whole tiles |
| `› shape › refuses non-canonical seat id and duplicate seat id` | Seat identity |
| `› shape › refuses more than the seat, fixture and floor caps` | Pagination/size bounds |
| `› sprites › refuses unknown key and prototype names (constructor, __proto__)` | Unknown sprite |
| `› sprites › refuses a full directional key (desk.single.e, door.e)` | Base-key rule |
| `› sprites › seats accept only desk.single; desk.pair is refused` | A4 |
| `› sprites › fixtures refuse desk, chair, floor, device, avatar and state keys` | Role check |
| `› sprites › accepts wall.side.e at rotation 0 and refuses the non-key wall.side` | Keys ending in `.e` with `dir: null` |
| `› rotation › refuses 45 and 360` | Four rotations |
| `› rotation › accepts all four on directional sprites` | Directional |
| `› rotation › refuses 90 on sofa and plant.large, accepts 0` | A3 |
| `› footprint › desk.single 0→[2,1], 90→[1,2]; door 0→[1,2], 90→[2,1]; table.meeting 0→[3,2], 90→[2,3]; prop.mug→[1,1]` | Footprint rule, no double swap |
| `› bounds › refuses negative, right-edge and bottom-edge overflow using the rotated footprint` | Bounds |
| `› bounds › refuses grid 0 and 65, accepts 1 and 64` | Grid limits |
| `› bounds › refuses a floor zone outside the grid; accepts overlapping zones` | Floors |
| `› overlap › refuses desk on desk, desk on wall, door on wall, rotated-footprint overlap` | Blocking |
| `› overlap › accepts prop on desk and label.sign on a free tile` | Non-blocking |
| `› chair › refuses a chair outside the room for each of the 4 directions` | A5 |
| `› chair › refuses a chair on a wall and two seats sharing a chair tile` | A5 |
| `› chair › accepts a prop on a chair tile` | A5, non-blocking |
| `src/app/dev/roommap/fixture.test.ts › DEMO_LAYOUT passes the layout rules` | Validator matches renderer data |
| `scripts/sprites/committed-atlas.test.ts › committed manifest blocks equal the registry` | Drift guard |
| `scripts/schema-check.mjs › 8 old-shape room, seat and fixture inserts still work` | AC1 |
| `› 8 partial seat or fixture placement refused (23514)` | All-or-none |
| `› 8 bad rotation and negative tile refused (23514)` | Row rules |
| `› 8 partial or non-positive grid refused; non-array floor_zones refused (23514)` | Room rules |
| `› 8 fixture with neither kind nor sprite refused; placed fixture with null kind allowed; unknown kind still refused` | `kind` rule |

Schema-check positive cases use `tx(fn, false)` so they roll back and leave the seed untouched.

## Approach

1. Add the migration. Run `pnpm migrate`, then extend `schema-check.mjs` and the README.
2. Add the four codes to `error.ts` and `api.ts`.
3. Write `src/lib/validate/layout.ts`:
   - `LAYOUT_LIMITS = { grid: 64, seats: SEAT_LIMITS.list, fixtures: 2000, floors: 64, bodyBytes: 262_144 }`.
   - Build base-key sets from `REGISTRY`: strip the 2-character suffix **only when `entry.dir` is non-null**, so
     `wall.side.e` (`dir: null`) stays a plain key.
   - Seat sprites: `desk.single`. Fixture groups: `cabinet, circulation, door, label, lamp, marker, partition, plant,
     prop, rack, shelf, sofa, table, wall, whiteboard, window`.
   - `validateLayoutSave(body)` checks shape, then calls `checkLayoutRules`.
   - `checkLayoutRules` takes a structural layout (no uuid requirement, so `DEMO_LAYOUT` can be checked) and returns the
     first failure in a fixed order: grid, sprite, rotation, bounds (items, zones, chairs), overlap.
   - Overlap uses a `Map` of occupied cells. Work is bounded: at most 2,500 items of at most 3 × 3 tiles.
   - Reuse `resolveFrameKey` and `chairFor`. Do not copy them.
4. Add the renderer and drift guard tests.
5. Run the checks, with fnm activated first:
   ```bash
   eval "$(fnm env --shell bash)" && fnm use --silent-if-unchanged
   docker compose -f compose.dev.yml up -d
   pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build
   pnpm schema:check && pnpm test:db
   ```

Rules: **R1** validator is pure `src/lib`, importing only lib. **R2** one forward-only expand migration. **R3** no config
or secrets. **R4** file list above. **R5** new logic has tests. **R6** no new table; `org_id` scoping and composite FKs
stay, and later queries go through `orgQuery`. **R7** the validator returns only 400/422 codes. UI copy stays in
`src/ui/copy` (D36).

## Specialist input used

Adopted:
- Both: separate nullable `tile_x`, `tile_y`, `tile_rotation`, `sprite_key`, all-or-none, no backfill, no DB overlap constraint, room-then-seat locks. Verified at `init.sql:88-92,169-187` and `rooms.ts:213-224`.
- API: `[id]` route, reuse `RoomLayout`, 256 KiB body for PUT only (`read-json.ts:6`), distinct 422 codes because error bodies have no details (`respond.ts`), member id as seed, registry/manifest drift test, audit with counts only.
- DB: no new index, row-local rules only in DB checks, exact seat-set comparison.

Disagreements resolved:
| Topic | Database | API | Chosen, and why |
|---|---|---|---|
| Size columns | `grid_w/h` | `tiles_w/h` | `grid_w/h`: `tiles` already means a sprite footprint in the registry. |
| Size cap in DB | check 1–64 | check 1–64 | Neither: DB enforces `> 0`, the app enforces 64, so raising the cap needs no migration. |
| Fixture `kind` | Keep, maybe widen or derive | Drop not null **and** drop the check | Drop not null only. The check already passes on null, legacy rows stay protected, no mapping is needed. |
| Version field | `version` in PUT | `baseVersion` | GET `version`, PUT `baseVersion`: the name says what the client based its edit on. |
| Stale code | `layout_conflict` | `layout_stale` | `layout_stale`: it tells the editor to reload. |
| Seat-set mismatch | 422 | 422 `layout_seats_mismatch` | **409** `layout_seats_changed`: the usual cause is a seat added or deleted since load, and the fix is to reload. |
| Rotation errors | 422 | 400 | 422 for a wrong integer value, 400 only for a wrong type, per the rule of thumb. |

Rejected after checking the code:
- DB finding 5, "swapped for 90/270 where the key has no direction": **the renderer does not do this** (`placement.ts:31,146-147`). Swapping would validate a footprint different from the one drawn.
- API open question 4, "accept all four, resolve with `resolveFrameKey`" for non-directional keys: the rotation would be stored but invisible, and adding `.e` art later would silently change saved footprints.
- DB `not valid` plus `validate constraint`: no benefit here, since the new columns are all null and the file runs in one transaction.
- API "base key check with `isFrameKey`": `isFrameKey("desk.single")` is false and `isFrameKey("desk.single.e")` is true, the reverse of what is needed. Base-key sets are used instead.
- Wholesale fixture delete as written by both: scoped to `sprite_key is not null`, so legacy rows are not destroyed.

## Assumptions

**Ming's choices (each safe to accept as is):**

| # | Question | Recommended default | Consequence / alternative |
|---|---|---|---|
| A1 | Split into 3 slices? | **Yes** (see below) | One PR would be about 1,400 lines, with a High-path migration in it. |
| A2 | API by room id, not code? | **`/api/rooms/{id}/layout`** | The page URL stays `/rooms/<code>`. Using code would mean renaming all existing `[id]` room routes. |
| A3 | Rotating sprites with only one frame? | **Refuse: rotation 0 only** | `sofa`, `shelf.books`, `whiteboard`, `table.coffee`, `window.double` can only be horizontal until they get `.e/.w` art. A vertical double window is not possible yet. No migration is needed to add them later. |
| A4 | Is `desk.pair` a seat? | **Not yet: seats use `desk.single`** | It is drawn back to back for two people, but LAY-02 says one desk = one seat and the renderer gives it one chair. Allowing it later is a one-line change. |
| A5 | Must the chair tile be valid? | **Yes**: in bounds, not on a blocking item, not shared | Slightly stricter than LAY-01's wording, but otherwise an avatar can be drawn inside a wall or outside the room. |
| A6 | Store floors? | **Yes, as jsonb on `rooms`** | The ticket omits floors, but LAY-01 lists them and the renderer needs them. Always read and written whole, so a separate table adds nothing. Alternative: one fixed floor per room. |
| A7 | Avatar seed? | **Member id** | D44/D51 say "from `sub`", but sending `sub` to every member exposes Identity ids. The same person may look different in two orgs. |
| A8 | Two Admins saving? | **Second save refused (409), must reload** | Alternative is last-write-wins, which silently loses work. |
| A9 | Rooms with no saved layout? | **Computed on read, saved only on the first PUT** | Seats are arranged in a plain grid until an Admin arranges them. |
| A10 | Limits? | **Grid 1–64 per side, 2,000 fixtures, 64 floor zones** | At 4× zoom, 64 tiles is 8,192 px per side. |
| A11 | Must each save list every seat? | **Yes, exact set** | If someone adds a seat during an edit, the save gets 409 and the editor reloads. Prevents silently unplaced seats. |
| A12 | Old free-form fixtures? | **Kept in the DB, not shown** | Only dev seed data has them today: no API creates fixtures. The contract migration removes them. |
| A13 | LAY-03 gaps? | **Follow-up, not this ticket** | (a) The registry has **no `pillar` sprite**, though LAY-03 lists one. (b) `label.sign` carries **no text** in this contract. Both are additive. |
| A14 | Rooms over 500 seats? | **GET shows the first 500 with `truncated: true`; PUT refuses** | Same 500 cap as the seat list (`SEAT_LIMITS.list`). `addSeats` has no room cap, so such a room is possible but unlikely. |

**Other assumptions:**
- Hotspots: no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board, so no rebase is expected.
- `src/ui/copy/api.ts` is the only `src/ui` change. It is text required by typecheck, not map UI.
- SIM-015.2's ticket text still describes the old free-form editor (`ticket.md:24`: "resize", "8 px snap"), which D43 superseded. It should be re-scoped before that ticket is planned.
- The Next.js slug-name rule is taken from framework behaviour and was not run here. Slice 2 confirms it through `pnpm build`.

## Blocking questions

None.

## Split proposal

Estimated at about 1,400 changed lines against the ~400-line guide. Each slice is one PR:

| Slice | Contents | Est. lines | ACs | High path |
|---|---|---|---|---|
| **1. SIM-015.1 (this plan)** | Migration, schema-check, README, shared type, validator, unit tests, 4 error codes | ~500 (about 200 are tests) | 1, 5a, 6a | **Yes, Ming approves** |
| 2. Proposed SIM-015.4 | `default-layout.ts`, `src/server/layout/layout.ts` (read), GET route, DB and route tests | ~400 | 2, 3, 6b | No |
| 3. Proposed SIM-015.5 | Save transaction, PUT route, 3 more error codes, DB tests (rollback, cross-org, stale, concurrent) and route tests | ~500 | 4, 5b, 6b | No |

- Slice 1 stays slightly above the guide because the migration and the rules it relies on should be reviewed together.
- Dependencies: SIM-015.4 depends on SIM-015.1; SIM-015.5 on SIM-015.4. **SIM-015.3 should then depend on SIM-015.4, and
  SIM-015.2 on SIM-015.5.**
- Slices 2 and 3 need **no further migration**, so this is the only High-path approval for the layout API.
- When Slice 1 merges, ACs 2, 3, 4, 5b and 6b must be carried by the new tickets. The orchestrator creates them and
  updates the board on `main`; this plan does not edit them.
