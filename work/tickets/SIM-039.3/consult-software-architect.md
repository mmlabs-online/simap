## Consult: software-architect, SIM-039.3 (catalog footprints in the validator, resolver, save and read)

### Findings
1. **Today every footprint comes from the registry.** `footprintOf(sprite, rotation)` (`/home/user/simap/src/lib/validate/layout.ts:85-89`) resolves the frame for the rotation and reads `REGISTRY[key].tiles`. It is used in four places:
   - `checkLayoutRules` (l.161) for bounds, overlap and the chair tile;
   - `fixturesOnDesks` (l.110);
   - `resolveLayout`'s `take()` (`/home/user/simap/src/lib/sprites/resolve-layout.ts:84`);
   - the editor: `tiles.ts:30,40` and `place-tool.ts:57`. These are 039.5's job.

   `buildDrawList` (`placement.ts:198`) uses `manifest.frames[key].tiles`. Drawing is not in this ticket.
2. **The swap rule matches the registry for every library item.** `table.meeting` s/n 3×2 and e/w 2×3; `door` 1×2 and 2×1; `desk.single` 2×1 and 1×2. Every other item with a frame bigger than 1×1 is non-directional. The partly directional walls (`wall.front.end`, `wall.side` e/w only; `wall.t` e/s; `wall.inner.h.end` w only) are 1×1. Their rotation-0 frame is missing, so the library seeds them as 1×1. A rotation with no frame still fails through `resolveFrameKey`.
   - So "catalog size at rotation 0, swapped at 90°/270°" gives exactly today's footprint for every placement that validates today, as long as the catalog holds the library defaults. This is what proves AC1 ("existing layouts unchanged").
   - Only the **size** should move to the catalog. Frame existence for the rotation, `blocks`, the chair direction, the allowed rotations and the kind/group checks must stay on the registry.
3. **Import-cycle trap.** `src/lib/map-items/library.ts:2` imports `FIXTURE_GROUPS`, `SEAT_SPRITES`, `footprintOf` and `spriteInfo` from `validate/layout.ts` and runs `build()` when the module loads. If `validate/layout.ts` imported `library.ts` (or `art.ts`), whichever module loads first would hit a temporal-dead-zone error. The validator must receive the lookup as a parameter and must not import `map-items/*`. The default lookup has to live in `validate/layout.ts`, built from the registry.
4. **The route validates before the transaction.** `route.ts:35` calls `validateLayoutSave`, which runs every rule with registry sizes before `saveRoomLayout`. Catalog sizes can only be read in the transaction. A full pre-check at library sizes would wrongly refuse layouts that are valid at the catalog size (for example a shrunk sofa or door next to a wall).
5. **The save shape.** Lock order is room → seats → `map_items_seed` (marker) → writes (`save.ts:51-78`). Fixtures are deleted and re-inserted on every save, so they have no identity. "Already placed" can only mean "the room's stored rows before this save", which the room lock and the `baseVersion` check make well defined.
6. **039.2 is merged.** An Admin can already resize an unplaced item through the API, and the server places it at the registry size until 039.3 ships. 039.2's sibling note asks 039.3 to lock referenced item rows `for key share`, which conflicts only with the resize's `for update`.
7. **Spec LAY-07 (`docs/spec-v1.md:461-463`)** says placed fixtures of a hidden item "can still be moved, rotated and deleted, and a save that keeps them is accepted; a save that places a hidden item anew is refused (422)". So the rule is per key and by count, not by exact position.
8. **Editor error handling.** `saveErrorKind` (`/home/user/simap/src/lib/layout-editor/save-errors.ts:16-23`) treats unknown codes as "retry" (a button only, no auto-retry). A new 422 code that is not in `INVALID` would show "Try again".
9. **Who builds a `LayoutResponse`.** Only `server/layout/layout.ts`, `save.ts`, `resolve-layout.ts` and `map-view.test.ts` do.

### Recommendations
1. **Lookup type, pure lib (R1).** In `validate/layout.ts`:
   - `export type FootprintLookup = (baseKey: string) => readonly [number, number] | null`, returning the size at rotation 0.
   - `export const registryFootprints: FootprintLookup = (k) => (spriteInfo(k) ? (footprintOf(k, 0) ?? [1, 1]) : null)`.
   - `export function footprintAt(sprite, rotation, lookup)`: returns null when `resolveFrameKey` is null or the lookup is null; otherwise swaps w/h at 90/270.
   - Use `footprintAt` in `checkLayoutRules`, `fixturesOnDesks` and `resolveLayout.take`, so the rule and the resolver can never disagree (keeps the invariant at `resolve-layout.ts:46-48`).
   - Keep `footprintOf` unchanged for `library.ts` and the editor. (AC1, AC2)
2. **Default parameters, so 039.5 switches the editor later without changing these signatures:**
   - `checkLayoutRules(layout, lookup = registryFootprints)`
   - `fixturesOnDesks(layout, lookup = registryFootprints)`
   - `validateLayoutSave(body, lookup = registryFootprints)`
   - `resolveLayout(room, seats, fixtures, lookup = registryFootprints)`

   No editor file changes in 039.3 (R4). Server code must pass the lookup explicitly; tests in item 9 catch a missed one.
3. **Catalog lookup builder, outside the validator.** New `src/lib/map-items/footprints.ts`: `catalogFootprints(items: readonly { builtinKey; w; h }[], fallback?: FootprintLookup): FootprintLookup`. Its direction (map-items → validate) is the one that already exists, so there is no cycle. The server builds it from rows now; 039.5 builds it in the browser from the layout response.
4. **Split the route's validation.** Add `parseLayoutSave(body)` = shape (400) plus the size-independent rules:
   - grid range, known sprite/kind, rotation, floor-zone bounds, floor-cell cap.

   The route calls it before the transaction, so the cheap 422s (for example `layout_unknown_sprite`) still never reach the service. The size-dependent rules (item bounds, overlap, chair tile, fixture on desk) run in `saveRoomLayout` under the locks. `validateLayoutSave` stays as parse + full rules for the editor callers (`editor-state.ts:99`, `save-run.ts:100`). Behaviour change to accept and test: a size-dependent 422 now comes after 404/409-stale. Route test "a fixture on a desk gives 422; service not called" (`route.test.ts:147`) moves to a service/DB test.
5. **Save sequence in `save.ts`:** room lock → stale → seats lock → seats-changed → `map_items_seed` → then:
   - **New statement:** `select builtin_key, w, h, hidden from map_items where org_id = $1 and builtin_key = any($2::text[]) order by builtin_key for key share`. Keys are the distinct seat, fixture and floor keys. This satisfies R6 through `orgQuery`, and the lock order becomes room → seats → marker → items.
   - **Size rules:** `checkLayoutRules(value, catalogFootprints(rows))` with no fallback. A missing row means `layout_unknown_sprite` 422, never a 23503/500.
   - **Hidden rule:** a separate check (below).
   - **Writes:** unchanged.

   Extend `SaveRefusal` 422 to `LayoutRuleCode | "item_hidden" | "layout_too_many_seats"`. Every refusal throws `Abort` before the first write (R7: domain 422, no 401/403). The audit row is unchanged (`room.layout_save`); no new Admin write.
6. **Hidden rule (count per key).** Only when a hidden key is present, run one statement: `select sprite_key, count(*) from layout_fixtures where org_id = $1 and room_id = $2 and sprite_key = any($3) group by 1`, before the delete. Refuse 422 `item_hidden` when the save has more placements of a hidden key than the room stores. Moving, rotating and deleting stay allowed, as the spec says.
   - **Seats (`desk.single`):** exempt. Seats are never created by the save, and `resolveLayout` auto-places waiting seats with `desk.single` (`resolve-layout.ts:137`).
   - **Floors:** allowed if the key is in the stored `floor_zones`, or the room is unsaved and the key is the default `floor.wood` (`parseStoredFloors` fallback). Otherwise a hidden floor that is already in use or is the default could never be re-saved.
   - Add `item_hidden` to `src/lib/api/error.ts`, `src/ui/copy/api.ts` (D36) and `INVALID` in `save-errors.ts` (one line; flag it as needed so the editor does not show "retry").
7. **Layout read (`layout.ts` `readLayoutRows`).** One more `orgQuery`: `select ${COLS} from map_items where org_id = $1 and builtin_key = any($2)`, with no hidden filter. Keys = placed seat and fixture keys + stored floor keys + `desk.single`, `floor.wood`, `chair.office` (the defaults plus chair art).
   - Pass `catalogFootprints(rows, registryFootprints)` to `resolveLayout`. The registry fallback here means a missing row (an org that was never seeded; the read does not seed, 039.1 A7) can never change the drawing.
   - Add the additive field `items` to `LayoutResponse`, built with `toDto` (039.1 sibling note; 039.5 draws from it).
   - Since `readLayoutRows` has no tier, either strip `hidden` (type `Omit<MapItemDto,"hidden">`) or force it to false, so the layout read does not reveal hidden flags that D67 (2) keeps from non-Admins.
   - The save's final `readLayoutRows` reuses this. One query more per read, inside the existing repeatable-read snapshot.
8. **Resize/save race.** With `for key share` in the save and `for update` + in-use count in 039.2's resize, either the resize waits and then counts the new placement (409), or the save reads the new size. Add a DB test for "save waits for an uncommitted resize, then validates at the new size", mirroring 039.2's holder pattern with `waitForLockWait`.
9. **Tests.**
   - **Unit, `layout.test.ts`:** `footprintAt` gives the same answer as `footprintOf` for every `LIBRARY_ITEMS` key × rotation where a frame exists (the AC1 proof); swap at 90/270 for a 3×1 lookup; a resized lookup turns a registry-valid layout into `layout_overlap`, `layout_out_of_bounds` and `layout_fixture_on_desk`; a lookup returning null gives `layout_unknown_sprite`; `parseLayoutSave` does not refuse an overlap.
   - **Unit, `resolve-layout.test.ts`:** the existing cases pass unchanged with the default lookup; with a resized lookup, an overlapping fixture is dropped and a seat that no longer fits is re-placed.
   - **`save.test.ts`:** statement order `… catalog seed, catalog sizes, [hidden counts], seat update …`; a rule or `item_hidden` refusal runs no write and no audit.
   - **DB, `layout.db.test.ts`:**
     - existing room round trip unchanged;
     - resize `plant.large` to 2×2 by SQL, then two plants at (0,0) and (1,1) → 422 `layout_overlap`;
     - a `table.meeting` resized to 4×1 at 90° near the edge → out of bounds;
     - a hidden fixture kept and moved → 200; one extra copy → 422 `item_hidden`, rows unchanged;
     - a hidden floor already in use → 200;
     - org A's resize does not change org B's validation (R6);
     - the read returns `items` with hidden placed items included;
     - the race test from item 8.
   - **Route test:** `item_hidden` maps to 422.
   - Record the local `pnpm test:db` run (039.1 plan step 11).

### Risks
- **Data placed in the gap.** An item resized through the 039.2 API and then placed before 039.3 deploys is stored at its registry size. After deploy, `resolveLayout` may drop that fixture (overlap/bounds) and the next save deletes it. Suggest a pre-deploy check on the shared DB for Ming: placements whose `map_items` (w,h) differ from `libraryItem` defaults. 0 rows means no risk.
- **Editor and server disagree until 039.5.** The editor still checks with registry sizes and still shows hidden items in the palette, so a resized or hidden item can get a 422 from the server only on save. This needs the API (no admin UI until 039.6), so the impact is low; note it in the impl-log.
- **Forgotten lookup.** The default parameters could let a server path silently use registry sizes. Mitigated by the DB tests for resized items on both save and read.
- **Error-order change.** Size-dependent 422s now come after 404/409.
- **Extra cost.** One locked select per save and one select per read; small (≤ 60 rows per org).
- **Cycle regression** if anyone later imports `map-items/library` into `validate/layout.ts`. Add a comment at the `FootprintLookup` declaration.

### Open questions (for Ming / planner defaults)
1. **Hidden `desk.single` and floors.** Proposed default: desks are exempt from the hidden rule; floors are allowed when already in the room (or are the unsaved-room default), otherwise refused like fixtures. Alternative: apply the hidden rule to fixtures only.
2. **"Already placed" counting.** Proposed default: count per key in this room (moving and rotating allowed, matching LAY-07). Alternative: an exact (key, x, y, rotation) match, which would refuse moving a hidden item and contradicts the spec.
3. **New code `item_hidden` vs reusing `not_allowed`.** Recommend a new code for clear copy.
4. **`items` on `LayoutResponse` in this ticket vs 039.5.** Recommend adding it here (039.1 sibling note; the read already loads the rows), with `hidden` stripped.

Key files: `/home/user/simap/src/lib/validate/layout.ts`, `/home/user/simap/src/lib/sprites/resolve-layout.ts`, `/home/user/simap/src/lib/sprites/layout.ts`, `/home/user/simap/src/lib/map-items/library.ts`, `/home/user/simap/src/server/layout/save.ts`, `/home/user/simap/src/server/layout/layout.ts`, `/home/user/simap/src/server/map-items/map-items.ts`, `/home/user/simap/src/app/api/rooms/[id]/layout/route.ts`, `/home/user/simap/src/lib/layout-editor/save-errors.ts`, `/home/user/simap/docs/spec-v1.md` (l.460-470).
