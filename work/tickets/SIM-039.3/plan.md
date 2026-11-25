Status: READY

# Plan — SIM-039.3: Catalog footprints in the layout validator, resolver and save

## Scope summary
- `docs/spec-v1.md` LAY-01 (l.409-413): "An item's footprint is its catalog size (width × height at rotation 0; 90° and
  270° swap width and height); no per-placement resize." / "Items cannot overlap where the library says they block
  [...], and no fixture is placed on a desk tile (D61, D62). The validator, layout read and editor take footprints from
  the org's catalog, not from the sprite registry alone."
- LAY-03 (l.427-428): "Existing layouts keep drawing exactly as before."
- LAY-07 (l.461-463): "Hiding only removes an item from the palette: placed fixtures of a hidden item keep drawing and
  can still be moved, rotated and deleted, and a save that keeps them is accepted; a save that places a hidden item
  anew is refused (422)."
- LAY-07 Size (l.465-468): "Size is stored for rotation 0 [...]; at 90° and 270° width and height swap. A size change is
  refused with 409 `item_in_use` while any room has the item placed [...], so a saved layout never starts to overlap."
- D66 (7): "the validator, `resolveLayout`, placement and editor take footprints from the catalog" (editor and placement
  UI = SIM-039.5). D67 (2): "hidden items are not returned to non-Admin members"; D67 (3): placed items reference their
  catalog row by FK.
- Ticket Scope: validator, `resolveLayout`, `save.ts` and the layout read take a footprint lookup from the catalog
  (w/h swapped at 90°/270°); hidden item already placed: kept; newly placed: 422.
- Sibling notes this plan follows: SIM-039.1 plan l.139-146 and l.331-335 (the layout read joins `map_items` and
  returns the referenced items, hidden ones included, built with `toDto`); SIM-039.2 plan l.213-217 (`for key share`,
  lock order room → seats → marker → items, hide/save race accepted).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Existing saved layouts still validate and draw unchanged. | `footprints.test.ts › catalog lookup built from LIBRARY_ITEMS gives footprintOf for every seat/fixture key × rotation with a frame`; `layout.test.ts` and `resolve-layout.test.ts` existing cases pass unchanged (default lookup); `layout.db.test.ts` existing `getRoomLayout`/`saveRoomLayout` tests pass with the catalog join; `layout.db.test.ts › a library-size catalog resolves a stored room exactly as the registry does` |
| 2 | A layout using a resized item is validated at the new size; overlaps are refused. | `layout.test.ts › sized rules` cases; `resolve-layout.test.ts › catalog lookup` cases; `layout.db.test.ts › catalog sizes` cases (overlap / out of bounds / on desk at the new size, a shrunk item accepted where the registry size would be refused, the read drops a stored fixture that no longer fits, the resize race) |
| 2b | Hidden item already placed: kept; newly placed: 422 (ticket Scope, LAY-07). | `layout.db.test.ts › hidden items` cases; `save.test.ts › hidden` cases; route test maps `layout_item_hidden` to 422 |
| 3 | Every query scoped by the token's org (R6); Admin-only writes audited; checks green including `pnpm test:db` run locally. | Every new statement goes through `orgQuery` with `org_id = $1` (`save.test.ts` asserts the catalog statement values start with `scope.orgId`); `layout.db.test.ts › org A's resize and hide do not change org B's save or read`; existing audit test (`room.layout_save`, unchanged meta) passes and refusals write no audit; impl-log records all Checks plus the local `pnpm migrate && pnpm test:db` pass/fail lines (Approach step 10) |

## Ming verification after merge
- **Before deploying** (read-only, Ming's step on the shared DB; agents never touch it): placements made between the
  039.2 deploy and this one at a resized size. 0 rows = nothing will look different after deploy. Otherwise the listed
  fixtures may be dropped from the drawing (overlap/out of bounds at the catalog size) and the next save of that room
  removes them.
  ```sql
  with d(k, w, h) as (values ('desk.single',2,1),('elevator',2,2),('stairs',2,2),('door',1,2),('shelf.books',2,1),
    ('sofa',2,1),('table.coffee',2,1),('table.meeting',3,2),('whiteboard',2,1),('window.double',2,1))
  select m.org_id, m.builtin_key, m.w, m.h
    from map_items m left join d on d.k = m.builtin_key
   where (m.w, m.h) <> (coalesce(d.w, 1), coalesce(d.h, 1))
     and (exists (select 1 from layout_fixtures f where f.org_id = m.org_id and f.sprite_key = m.builtin_key)
       or exists (select 1 from seats s where s.org_id = m.org_id and s.sprite_key = m.builtin_key));
  ```
  (The implementer confirms the VALUES list = every `LIBRARY_ITEMS` entry that is not 1×1 and records it in impl-log.)
- After deploy: open a saved room's map and editor; it looks as before.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/validate/layout.ts` | Add `FootprintLookup`, `registryFootprints`, `footprintAt`; `checkLayoutRules`/`fixturesOnDesks`/`validateLayoutSave` take `lookup = registryFootprints`; extract the size-independent checks into `checkLayoutBasics`; add `parseLayoutSave` (shape + basics + floor cap) | validator core (AC1, AC2) | no |
| `src/lib/validate/layout.test.ts` | New cases (Tests table) | R5 | no |
| `src/lib/map-items/footprints.ts` (new) | `catalogFootprints(items, fallback?)` → `FootprintLookup` | lookup builder outside the validator (no import cycle) | no |
| `src/lib/map-items/footprints.test.ts` (new) | AC1 proof + builder cases | R5 | no |
| `src/lib/sprites/resolve-layout.ts` | `resolveLayout(room, seats, fixtures, lookup = registryFootprints)`; `take()` uses `footprintAt` and passes the lookup to `checkLayoutRules` | resolver (AC1, AC2) | no |
| `src/lib/sprites/resolve-layout.test.ts` | New `catalog lookup` describe | R5 | no |
| `src/lib/sprites/layout.ts` | `LayoutItem = Omit<MapItemDto, "hidden">`; `LayoutResponse.items: LayoutItem[]` (additive) | read contract (039.1 sibling note; 039.5 draws from it) | no |
| `src/server/layout/save.ts` | Catalog sizes `for key share`, sized rules, hidden rule, wider `SaveRefusal` | save (AC2, 2b, R6, R7) | no |
| `src/server/layout/save.test.ts` | Fake answers the catalog/hidden statements; new cases | R5 | no |
| `src/server/layout/layout.ts` | `readLayoutRows`: one catalog select, lookup into `resolveLayout`, fill `items` | read (AC1, AC2) | no |
| `src/server/layout/layout.db.test.ts` | New describes (Tests table) | R5, AC3 `test:db` | no |
| `src/app/api/rooms/[id]/layout/route.ts` | PUT calls `parseLayoutSave` instead of `validateLayoutSave` | size rules must run under the item locks | no |
| `src/app/api/rooms/[id]/layout/route.test.ts` | Update the on-desk test; add refusal mappings | R5 | no |
| `src/lib/api/error.ts` | Append `"layout_item_hidden"` at the end of `API_ERROR_CODES` | new 422 code | no |
| `src/ui/copy/api.ts` | Copy for `layout_item_hidden` (D36; `satisfies Record<ApiErrorCode, string>` forces it) | new code | no |
| `src/lib/layout-editor/save-errors.ts` | Add `layout_item_hidden` to `INVALID` (one line) | otherwise the editor offers "Try again" for a save that can never pass | no |
| `src/lib/layout-editor/save-errors.test.ts` | One assertion | R5 | no |
| `src/server/README.md` | Lock-order line (l.11): layout save = room `for update` → seats `for update` → catalog marker → `map_items` rows `for key share` in key order | documents the new lock | no |

No High path is touched (`src/server/http/**`, migrations, config are unchanged).

## Data model / migration
None. Uses the existing `map_items (org_id, builtin_key, w, h, hidden, ...)` and the FKs from SIM-039.1.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/rooms/{id}/layout` | unchanged | `LayoutResponse` + additive `items: LayoutItem[]`; `no-store` unchanged | unchanged (401/403 wrapper; 404; 503) | `tier: "user"` unchanged |
| PUT | `/api/rooms/{id}/layout` | unchanged (`fixtures[].sprite` stays the base key) | same `LayoutResponse` (with `items`) | 400 `invalid_request`; 422 `layout_out_of_bounds` / `layout_bad_rotation` / `layout_unknown_sprite` (pre-tx basics); 404; 409 `layout_stale` / `layout_seats_changed`; 422 `layout_too_many_seats`; **now from the save, after the item lock:** 422 `layout_out_of_bounds` / `layout_overlap` / `layout_fixture_on_desk` / `layout_unknown_sprite` at catalog size; **new** 422 `layout_item_hidden` | `tier: "admin"` unchanged |

```ts
// src/lib/sprites/layout.ts (additive)
import type { MapItemDto } from "@/lib/map-items/types";
/** A catalog item the layout uses, hidden ones included; the hidden flag is never sent here (D67 2). */
export type LayoutItem = Omit<MapItemDto, "hidden">;
export type LayoutResponse = { /* existing fields unchanged */ items: LayoutItem[] };
```
- `items` = catalog rows of every key used by the resolved layout's seats, fixtures and floors, plus `chair.office` when
  the layout has a seat; sorted by `builtinKey`; built with `toDto` (rows whose key is not a library item are left out).
  No other catalog row is returned (no hidden unplaced item leaks to non-Admins; the palette keeps using
  `GET /api/map-items`).
- `layout_item_hidden` body: `{ error: { code } }`, no extra fields. Copy: "This layout adds an item that is hidden
  from the palette. Remove the new copies, or show the item again."

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `footprints.test.ts` › `catalog lookup built from LIBRARY_ITEMS gives footprintOf for every seat/fixture key × rotation with a frame` (iterate `LIBRARY_ITEMS` kinds seat+fixture × 0/90/180/270 where `resolveFrameKey` is non-null; compare `footprintAt(key, rot, catalogFootprints(LIBRARY_ITEMS))` with `footprintOf`) | AC1 proof (swap rule = registry) |
| `footprints.test.ts` › `registryFootprints gives the same as footprintOf for the same keys` | default unchanged |
| `footprints.test.ts` › `catalogFootprints: listed key gives its w/h; unlisted key gives the fallback, or null without one` | builder |
| `layout.test.ts` › `footprintAt swaps a 3×1 lookup at 90 and 270, not at 0 and 180; null when the rotation has no frame or the lookup has no entry` | swap rule |
| `layout.test.ts` › `sized rules: plant.large at 2×2 turns two diagonal plants into layout_overlap` | AC2 overlap |
| `layout.test.ts` › `sized rules: table.meeting at 4×1 rotated 90 near the bottom edge gives layout_out_of_bounds; at the registry size it passes` | AC2 bounds + swap |
| `layout.test.ts` › `sized rules: prop.mug at 2×1 left of a desk gives layout_fixture_on_desk; fixturesOnDesks with the lookup returns its index` | AC2 desk tile (D61) |
| `layout.test.ts` › `sized rules: a shrunk table.meeting (1×1) in the last column passes with the lookup and fails with the registry` | shrink |
| `layout.test.ts` › `a lookup returning null for a placed key gives layout_unknown_sprite` | save without fallback |
| `layout.test.ts` › `parseLayoutSave: accepts an overlap, an item out of bounds and a fixture on a desk; still refuses shape (400), unknown sprite, bad rotation, missing frame, zone out of bounds, grid 65 (422) and the floor cap (400 floors)` | route pre-check split |
| `layout.test.ts` › `validateLayoutSave without a lookup returns exactly what it returned before` (re-run a few existing failing bodies) | editor callers unchanged |
| `resolve-layout.test.ts` › `catalog lookup: a stored fixture overlapping at the catalog size is dropped; at library size both stay` | AC2 read |
| `resolve-layout.test.ts` › `catalog lookup: a seat whose neighbour fixture grew keeps its place (seats first) and the fixture is dropped` | seat-first order kept |
| `resolve-layout.test.ts` › `catalog lookup: output always passes checkLayoutRules with the same lookup` | invariant l.46-48 |
| `save.test.ts` › order test becomes `begin, room lock, seat lock, catalog seed, catalog sizes, seat update, fixture delete, fixture insert, room update, audit, re-read, commit` | lock order |
| `save.test.ts` › `catalog sizes statement: org_id = $1, distinct sorted seat+fixture+floor keys, order by builtin_key for key share` (values `[orgId, ["desk.single","floor.wood","plant.large"]]`) | R6, lock form |
| `save.test.ts` › `a rule failure at catalog size (plant.large 2×2) gives 422 layout_overlap with no write and no audit` (sequence ends `catalog sizes, rollback`) | R7 before writes |
| `save.test.ts` › `a key missing from the catalog gives 422 layout_unknown_sprite with no write` | no 23503/500 |
| `save.test.ts` › `hidden fixture: stored count 1, submitted 1 proceeds; submitted 2 gives 422 layout_item_hidden after "hidden counts", no write, no audit` | 2b |
| `save.test.ts` › `no hidden key: no hidden counts or hidden floors statement` | cost |
| `save.test.ts` › `hidden desk.single: seats save, no hidden check` | desks exempt (A4) |
| `save.test.ts` › existing stale / 404 / seats-changed / too-many-seats sequences unchanged (no catalog sizes) | order |
| `layout.db.test.ts` › `catalog sizes: plant.large resized to 2×2 by SQL; plants at (0,0) and (1,1) give 422 layout_overlap and change nothing (snapshotOf); at (0,0) and (2,2) save` | AC2 |
| `layout.db.test.ts` › `catalog sizes: table.meeting 4×1 at 90° with y = h-3 gives layout_out_of_bounds` | AC2 + swap |
| `layout.db.test.ts` › `catalog sizes: table.meeting shrunk to 1×1 saves in the last column (the registry size would be out of bounds)` | pre-tx registry check gone |
| `layout.db.test.ts` › `catalog sizes: the read drops a stored fixture that overlaps at the catalog size` (two stored plants at (0,0),(1,1) via `addFixture`, then resize by SQL) | AC2 read |
| `layout.db.test.ts` › `a library-size catalog resolves a stored room exactly as the registry does` (room with door at 90, table.meeting, desk seats; compare `getRoomLayout().layout` with `resolveLayout(...)` without a lookup on the same rows) | AC1 golden |
| `layout.db.test.ts` › `read items: placed fixture keys, desk.single, chair.office and floor keys only, sorted, no hidden field; a hidden placed item is included` | contract, D67 2 |
| `layout.db.test.ts` › `hidden items: a hidden plant kept and moved saves; one more copy gives 422 layout_item_hidden and changes nothing; deleting it saves; placing it in another room gives 422` | 2b, per-room count |
| `layout.db.test.ts` › `hidden floors: a hidden floor already in the room re-saves; adding it to another saved room gives 422; an unsaved room with hidden floor.wood saves floor.wood` | A4 floors |
| `layout.db.test.ts` › `hidden desk.single: a room with seats saves` | A4 desks |
| `layout.db.test.ts` › `org A's resize and hide do not change org B's save or read` | R6 |
| `layout.db.test.ts` › `a save waits for an uncommitted resize of an item it places, then validates at the new size (422 layout_overlap)` (holder: `select ... from map_items where org_id = $1 and builtin_key = 'plant.large' for update` + `update ... w = 2, h = 2`; `waitForLockWait(pool, 5000)`; commit) | race (039.2 note) |
| `route.test.ts` › replace `a fixture on a desk gives 422 ...; service not called` with `a fixture on a desk passes the pre-check and reaches the service` | split |
| `route.test.ts` › `maps each refusal` gains `[422, "layout_overlap"]`, `[422, "layout_item_hidden"]` | mapping |
| `save-errors.test.ts` › `layout_item_hidden is invalid` | editor reaction |

## Approach
1. **`src/lib/validate/layout.ts`** (pure lib, R1). Do **not** import `@/lib/map-items/*` here: `library.ts:2` imports
   this module and builds at load time, so a back-import would be a TDZ cycle; add a comment at `FootprintLookup`.
   - `export type FootprintLookup = (baseKey: string) => readonly [number, number] | null;` (size at rotation 0).
   - `export const registryFootprints: FootprintLookup = (k) => (spriteInfo(k) ? (footprintOf(k, 0) ?? [1, 1]) : null);`
     (rotation-0-less partial walls seed as 1×1, same as `library.ts:31`).
   - `export function footprintAt(sprite, rotation, lookup): [number, number] | null` — null when
     `resolveFrameKey(sprite, rotation)` is null or `lookup(sprite)` is null; otherwise `[w, h]`, swapped at 90/270.
   - Keep `footprintOf` unchanged (library, editor `tiles.ts`, `place-tool.ts`).
   - Factor the grid/sprite/rotation blocks of `checkLayoutRules` (l.128-150) into a private helper. Add
     `export function checkLayoutBasics(layout)`: helper, then every seat/fixture has a frame for its rotation
     (`layout_unknown_sprite`), then floor zones in bounds. `checkLayoutRules(layout, lookup = registryFootprints)`:
     helper, then the existing loop (l.155-197) with `footprintAt(item.sprite, item.rotation, lookup)` in place of
     `footprintOf`, and `fixturesOnDesks(layout, lookup)`; its order stays exactly as today. `blocks`, `dir`, chair
     position, allowed rotations and kinds stay on the registry; only the size comes from the lookup.
   - `fixturesOnDesks(layout, lookup = registryFootprints)` uses `footprintAt`.
   - Extract the shape part of `validateLayoutSave` (l.220-281) into a private `parseShape(body)`.
     `validateLayoutSave(body, lookup = registryFootprints)` = `parseShape` → `checkLayoutRules(value, lookup)` → floor
     cap (unchanged behaviour). New `parseLayoutSave(body)` = `parseShape` → `checkLayoutBasics` → floor cap
     (`floorCellsWithinCap` needs zones in bounds; basics ensures it).
2. **`src/lib/map-items/footprints.ts`** (new, pure):
   `catalogFootprints(items: readonly { builtinKey: string; w: number; h: number }[], fallback?: FootprintLookup): FootprintLookup`
   — a `Map` lookup; unlisted key → `fallback?.(key) ?? null`. Imports only the type from `validate/layout`.
3. **`src/lib/sprites/resolve-layout.ts`**: add `lookup: FootprintLookup = registryFootprints` as 4th parameter; in
   `take()` (l.79-85) pass it to `checkLayoutRules` and replace `footprintOf` with `footprintAt(..., lookup)`.
   `parseStoredFloors` and the grid check need no lookup.
4. **`src/lib/sprites/layout.ts`**: `LayoutItem` and `items` per the API contract (type-only import of `MapItemDto`).
5. **`src/server/layout/layout.ts` `readLayoutRows`** (after the fixtures query, l.92):
   - `keys` = distinct non-null seat `sprite_key`s, fixture `sprite_key`s, the `sprite` strings of `room.floor_zones`
     when it is an array (at most `LAYOUT_LIMITS.floors` entries, strings only), plus `desk.single`, `floor.wood`,
     `chair.office` (the default layout and the chair art).
   - `orgQuery<Row>(c, scope, \`select ${COLS} from map_items where org_id = $1 and builtin_key = any($2::text[]) order by builtin_key\`, [keys])`
     (`COLS`, `Row`, `toDto` from `@/server/map-items/map-items`; server → server, R1). No lock: the read is inside the
     repeatable-read snapshot of `getRoomLayout`, and inside the save's transaction after its own `for key share`.
     No hidden filter.
   - `resolveLayout(..., catalogFootprints(rows mapped to {builtinKey, w, h}, registryFootprints))`: the registry
     fallback means a missing row (an org never seeded; the read does not seed, 039.1 A7) never changes the drawing.
   - `used` = sprites of `resolved.layout.seats/fixtures/floors` + `chair.office` when there is a seat;
     `items = rows.filter(r => used.has(r.builtin_key)).map(toDto).filter(nonNull).map(({ hidden: _h, ...i }) => i)`.
   - Keep the `left(sprite_key, 129)` truncation (039.1 review note; dropping it is optional and changes nothing).
6. **`src/server/layout/save.ts`** — after the `map_items_seed` call (l.74-78), before the seat update:
   - Widen `SaveRefusal`'s 422 to `LayoutRuleCode | "layout_too_many_seats" | "layout_item_hidden"`.
   - `keys` = sorted distinct `value.seats/fixtures/floors` sprites. One statement reads and locks:
     `select builtin_key, w, h, hidden from map_items where org_id = $1 and builtin_key = any($2::text[]) order by builtin_key for key share`.
     Sorted keys and `order by` keep a fixed lock order between concurrent saves. Lock order becomes room → seats →
     marker → items (039.2 note); 039.2's resize locks only the item row, so there is no inversion.
   - `const r = checkLayoutRules(value, catalogFootprints(rows))` — **no fallback**: a missing row is
     `layout_unknown_sprite` (422), never an FK 23503/500. `if (!r.ok) throw refuse(422, r.code)` (`invalid_request`
     cannot occur here: the route already ran `parseLayoutSave`; narrow with a type guard and treat it as unknown sprite
     if the type needs it).
   - Hidden rule (A3/A4), only when a submitted key is hidden:
     - fixtures: hidden fixture keys present → `select sprite_key, count(*)::int as n from layout_fixtures where org_id = $1 and room_id = $2 and sprite_key = any($3::text[]) group by sprite_key`
       (before the delete). Submitted count of a hidden key > stored count → `refuse(422, "layout_item_hidden")`.
     - floors: hidden floor keys present → `select grid_w, grid_h, <the same guarded floor_zones case expression as
       layout.ts:61-64> as floor_zones from rooms where org_id = $1 and id = $2` (room is already locked); kept floors =
       sprites of `resolveLayout({ gridW, gridH, floorZones }, [], []).layout.floors` (exactly what the editor was
       shown, including the unsaved-room `floor.wood` default). A hidden floor key not kept → refuse.
     - seats: exempt (A4).
   - All refusals throw `Abort` before the first write (R7: domain 422, no 401/403; the audit is not written). Writes,
     audit (`room.layout_save`, meta unchanged) and the final `readLayoutRows` stay as they are.
7. **Route** `src/app/api/rooms/[id]/layout/route.ts`: PUT imports and calls `parseLayoutSave(body.body)` (l.35); the
   400/422 mapping stays. Behaviour change (A6): size-dependent 422s now come after 404 / 409.
8. **Codes and copy**: append `"layout_item_hidden"` at the end of `API_ERROR_CODES`; add its copy (API contract) in
   `src/ui/copy/api.ts`; add it to `INVALID` in `save-errors.ts`.
9. **Tests** per the table. `save.test.ts`: extend `fake()` to answer `from map_items` with rows built from
   `LIBRARY_ITEMS` (overrides per test for size/hidden/missing), `select sprite_key, count` with given stored counts,
   and `select grid_w` with a stored room; add `kinds()` entries `catalog sizes`, `hidden counts`, `hidden floors`.
   DB tests reuse `room()`, `addFixture`, `place`, `snapshotOf`, `recording`, and the holder pattern of
   `src/server/map-items/map-items-edit.db.test.ts:280-298`; set sizes/hidden by SQL (`update map_items set w = $3, h = $4 ... where org_id = $1 and builtin_key = $2`).
10. **Local DB checks** exactly as SIM-039.1 plan step 11 (`work/tickets/SIM-039.1/plan.md:294-310`): throwaway
    PostgreSQL 16 cluster from `/usr/lib/postgresql/16/bin` in a fresh dir under `/var/tmp` (run as `postgres` when
    root), `listen_addresses=127.0.0.1`, port 55432, trust auth; `DATABASE_URL` passed inline only, never read or
    written to `.env*`; `pnpm migrate && pnpm test:db`; stop the cluster and delete the dir. Record pass/fail lines (not
    the URL) in impl-log. The 5 failures in `src/server/devices/handoffs.db.test.ts` are pre-existing on `main` and not
    this ticket's: record them as such; every other file, `layout.db.test.ts` and `map-items*.db.test.ts` included, must
    pass.
11. `src/server/README.md` l.11: add the layout-save lock order sentence. Run all Checks of `loop.config.md`.

Rules: R1 (lookup type and builder in `src/lib`, no lib → server import; server reads via the route only;
`check:layers`), R2 (no schema change), R3 (no config), R4 (files above only; editor files except the one-line
`save-errors.ts` stay for 039.5), R5 (tests above), R6 (every new statement via `orgQuery` with `org_id = $1`; org from
`ctx.scope`, Admin tier from `withAuth`), R7 (only domain 422s, all before the first write).

## Specialist input used
- architect 1-2 (`FootprintLookup`, `registryFootprints`, `footprintAt`, default parameters, size-only from the
  catalog): adopted. Lookup applies to seats too (desk is fixed size, so the catalog equals the registry; one code path).
- architect 3 / risk (import cycle; builder in `src/lib/map-items/footprints.ts`): adopted.
- architect 4 (split the route pre-check; size rules in the save): adopted as `checkLayoutBasics` + `parseLayoutSave`,
  keeping `checkLayoutRules`'s failure order unchanged.
- api C ("run the full check twice, registry pre-tx and catalog in-tx"): **rejected** — the registry pass wrongly
  refuses a layout that is valid at a smaller catalog size (architect 4); the DB test with a shrunk `table.meeting`
  pins it.
- api 5 / architect 5 (one `for key share` statement, sorted keys, lock order room → seats → marker → items): adopted.
- api D / architect 6 (hidden rule by count per key per room; moves/rotations kept; 422 before writes): adopted.
  Floors per architect 6 (A4). Code name: api's `layout_item_hidden` over architect's `item_hidden` (matches the other
  layout save codes and the editor's `INVALID` list).
- api A (`items: Record<key, {w,h}>` only): **rejected** in favour of architect 7 and the 039.1 sibling note
  (`toDto` rows without `hidden`): non-Admins do not get hidden rows from `GET /api/map-items` (D67 2), so the layout
  read is the only place 039.5 can get name and art for a placed hidden item.
- api E / architect 7 (read join, registry fallback, no lock): adopted; key set includes the defaults and
  `chair.office`, output filtered to used keys (api 7: no hidden unplaced items).
- api F (no new auth codes, audit unchanged): adopted. Optional `hiddenKept` audit meta: not adopted (not needed).
- api risk (`lock_timeout`): none set; the pool's `statement_timeout: 5000` (`src/server/db/pool.ts:18`) bounds a lock
  wait as for every other lock today; no new mapping.
- api risk (`items` optional until 039.5): not needed — only `readLayoutRows` builds a `LayoutResponse`; `items` is
  required.
- architect 8 (race DB test) and 9 (tests): adopted.
- architect 8 (`save-errors.ts` `INVALID`): adopted (one line).
- architect risk (data placed in the gap): turned into the pre-deploy query under Ming verification.

## Assumptions
For Ming at the plan-approval gate (each reversible; resolves the consultants' open questions):
- **A1 `for key share`, not `for share` (departs from the ticket's 039.2 note text).** Already chosen in the 039.2 plan
  (l.213-217): `FOR KEY SHARE` conflicts only with the resize's `FOR UPDATE`, so a save and a resize serialise, while
  rename/hide/art (`FOR NO KEY UPDATE`) never wait on saves. A hide racing a save can let that one save place the
  just-hidden item; accepted (hide is palette-only).
- **A2 Where the size rules run (departs from the ticket's "validator takes a footprint lookup").** The route's
  pre-check (`parseLayoutSave`) keeps only size-independent rules; bounds, overlap, chair and desk-tile rules run in the
  save with the catalog sizes read under the item lock. `validateLayoutSave` keeps the full rules for the editor
  (registry sizes until 039.5).
- **A3 "Already placed" = count per key in this room** (api Q3, architect Q2). Moving, rotating and deleting hidden
  copies are allowed (LAY-07); only more copies than the room stores is "anew". Alternative: exact (key, x, y,
  rotation) match — contradicts LAY-07's "can still be moved, rotated".
- **A4 Hidden desks and floors** (architect Q1). `desk.single` is exempt (seats are never created by the save and the
  read auto-places waiting seats as `desk.single`, so a hidden desk would otherwise block every room with a new seat).
  A hidden floor is allowed when the room already shows it (stored floors, or the unsaved-room default `floor.wood`),
  otherwise 422. Alternative: apply the hidden rule to fixtures only.
- **A5 New code `layout_item_hidden`** (api Q2, architect Q3), body without extra fields; not `not_allowed`.
- **A6 Error order change.** A size-dependent 422 (overlap, out of bounds at item size, on desk) now comes after 404 /
  409 stale / 409 seats changed, because it needs the locked catalog. A body with both a size fault and a stale version
  now gets 409.
- **A7 `items` on the layout response, here** (api Q1/Q4, architect Q4): the `MapItemDto` without `hidden`, only for
  keys the layout uses (plus `chair.office` with seats), hidden ones included for every member. Name and art travel
  now so 039.5 needs no second request and can draw placed hidden items for non-Admins.
- **A8 Editor and server can disagree until 039.5.** The editor still checks with registry sizes and still offers
  hidden items, so a resized or hidden item may get a 422 only on save. Only reachable through the 039.2 API (no Admin
  UI before 039.6); noted in impl-log.
- **A9 Read keeps a registry fallback, the save does not.** A missing catalog row never changes a drawing, and never
  lets a save through at an unchecked size.
- **A10 Size of change** ≈ 600 lines, about 60 % tests; product code ≈ 220. Kept as one ticket (Size M); see Split.
- Hotspots: no ticket is IN_PROGRESS / REVIEW / DONE. SIM-037.4 (PLANNING) may append codes to `src/lib/api/error.ts`
  and `src/ui/copy/api.ts` (append-only lists, trivial rebase). SIM-039.5 (BACKLOG) will build on
  `footprintAt`/`catalogFootprints` and `LayoutResponse.items`.

## Blocking questions
None.

## Split proposal
None. Possible cut if the reviewer wants smaller PRs: (a) lookup + validator/resolver/read with registry-equal results,
(b) save lock + sized rules + hidden rule. Not proposed: (a) alone does not meet AC2 for saves, and both share the same
tests.
