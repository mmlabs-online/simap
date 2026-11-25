## SIM-039.3 consult: API contract, errors, R6/R7

I read the ticket, D67, the 039.1/039.2 plans and consults, `src/lib/validate/layout.ts`, `src/lib/sprites/resolve-layout.ts`, `src/lib/sprites/layout.ts`, `src/server/layout/{layout,save}.ts`, `src/app/api/rooms/[id]/layout/route.ts` and `src/server/map-items/edit.ts`. I ran no checks.

### Findings

1. **Footprints are hard-wired to the registry today.**
   - `footprintOf(sprite, rotation)` in `src/lib/validate/layout.ts:85` reads `REGISTRY[key].tiles ?? [1,1]`.
   - The registry frame key is resolved per direction, so the registry already includes the n/e/s/w swap.
   - The same function is used in four places:
     - bounds and overlap in `checkLayoutRules`;
     - `fixturesOnDesks`;
     - `resolveLayout`'s `take`;
     - `parseStoredFloors`, which passes only floors, so no footprint is involved.
   - Catalog `w`/`h` are the size at rotation 0, and 90/270 swap them (D66.7, `src/lib/map-items/types.ts:24`).
   - The registry's directional frames carry their own `tiles` (swapped by art). The catalog lookup must therefore apply its own swap and must not reuse the registry's.

2. **The layout response has no catalog data yet.**
   - `LayoutResponse` has no item or footprint field.
   - The read returns `sprite` = builtin key per placement.
   - The 039.1 plan says 039.3 adds the catalog join on the FK. It must return the referenced items, including hidden ones, so 039.5 can draw and resize correctly.
   - The read runs under `repeatable read, read only` via `getRoomLayout`. The catalog read in the same snapshot is therefore consistent with `version`. Keep it in `readLayoutRows`, because save re-reads through the same function.

3. **The FKs make "hidden placed anew" the only new refusal.**
   - `layout_fixtures_map_item_fkey` and the seats FK both reference `(org_id, builtin_key)` with `on delete restrict`.
   - `save.ts` already calls `map_items_seed` as a safety net, so every referenced key exists after that call.
   - A key that is not in the catalog today surfaces as `layout_unknown_sprite` from the validator. The registry and library hold the same keys (guarded by `sql-sync.test.ts`).

4. **Resize is refused while an item is placed.**
   - `applySize` in `edit.ts:112` returns 409 `item_in_use` if any seat or fixture uses the key.
   - A saved layout therefore cannot hold a stale footprint through an Admin resize.
   - The practical cases for the "resized item" criterion are:
     - an item resized while unplaced, then placed;
     - a drifted stored size on fixed-size items (039.2 security 🟡).
   - The validator tests must still cover a catalog size that differs from the registry size.

5. **Locking, from the 039.2 plan sibling notes.**
   - Use `for key share` on the referenced `map_items` rows, not `for share` as the ticket text says. This was already decided and recorded in the 039.2 plan (lines 213-217).
   - Lock order is room, then seats, then the seed call, then items.
   - A hide racing a save can let one save place a just-hidden item. This was accepted in the 039.2 plan.
   - The size read and the lock should be one statement. Select `builtin_key, w, h, hidden ... where org_id = $1 and builtin_key = any($2) order by builtin_key for key share`. The sorted order avoids lock inversion between concurrent saves.

6. **Save-time catalog access.**
   - The validator `validateLayoutSave` is pure and runs in the route before the transaction.
   - It cannot see the catalog, and a pre-transaction read would race with a resize.
   - The size-dependent rules (bounds, overlap, desk-tile) must therefore run inside the transaction, after the `for key share` read.
   - Shape checks (400) can stay pre-tx in `validateLayoutSave`.

7. **Hidden semantics.**
   - D67 (2): hidden items are not returned to non-Admins.
   - The layout GET is available to any member (`tier: "user"`).
   - A hidden item that is already placed must still draw for everyone. The ticket says "kept". The layout read therefore returns the referenced items including hidden ones to non-Admins, but only those actually placed.
   - Do not return the full catalog on the layout read. `GET /api/map-items` already serves that, and exposing hidden unplaced items there would break D67 (2).
   - The `hidden` flag in the layout DTO should be omitted or kept internal. The palette is the only consumer of it, and it uses `GET /api/map-items`.

### Recommendations

**A. Contract (additive only, `LayoutResponse` in `src/lib/sprites/layout.ts`)**
- Add one optional-to-consumers field: `items: Record<string, { w: number; h: number }>`, keyed by builtin key, covering every key used by a seat or fixture in the layout. A map is easier to look up than an array.
- Do not add name or art to this field in 039.3. 039.5 will join the full DTO from `GET /api/map-items`.
- Do not change existing field names, types or ordering. Existing clients ignore the new field.
- Update `LayoutResponse` and its doc comment. `seatDevices` stays untouched, per ticket scope.
- The PUT request body is unchanged. `fixtures[].sprite` stays a base key and the catalog is looked up by it. `LAYOUT_LIMITS.bodyBytes` is unaffected.
- The PUT response is the same `LayoutResponse` through `readLayoutRows`, so it gets `items` too.

**B. Footprint lookup type (pure lib)**
- Define in `src/lib/validate/layout.ts` (or `src/lib/map-items/`): `type Footprints = (sprite: string) => { w: number; h: number } | null`.
- A shared pure `footprintAt(lookup, sprite, rotation)` swaps w/h at 90 and 270.
- It must fall back to the registry when the lookup has no entry, so existing layouts and the default-layout path stay unchanged. This satisfies the "existing layouts validate and draw unchanged" criterion.
- Make `checkLayoutRules(layout, footprints?)` and `resolveLayout(room, seats, fixtures, footprints?)` take the optional parameter.
- Keep `blocks`, `dir` and chair placement from the registry. Only the size comes from the catalog.
- Seats and floors are fixed-size: `desk.single` must keep using the registry size, and floors are not in the FK.

**C. Save flow**
- Inside the transaction, after the seed call:
  1. Read the sizes and `hidden` for the distinct fixture and seat sprite keys, with `for key share`, scoped `org_id = $1`.
  2. Run the size-dependent rules with the lookup.
  3. Compute newly placed hidden keys.
- Recommended order: rules first, then the hidden check, then writes. All refusals happen before any write, so R7 holds.
- Reuse `checkLayoutRules` after the sizes are known. Move the call out of `validateLayoutSave`, or run it twice: once with the registry (cheap pre-tx check) and once with the catalog. Running both is safer, because a registry-pass layout may still fail at a larger catalog size.
- Map `LayoutRuleCode` failures inside the transaction to `Abort`. The `SaveRefusal` type must be widened with the five rule codes plus the new one (see D).

**D. Error codes**
- Hidden item placed anew: 422 with a new code, e.g. `layout_item_hidden`.
- Add it to `ApiErrorCode` in `src/lib/api/error.ts` (append to the layout codes at lines 21-28). Add copy to `src/ui/copy/api.ts` as an append-only entry.
- The 422 body carries no payload. Optionally include `key`, but 039.2 noted `apiError` cannot carry extra fields. Prefer no extra fields.
- "Newly placed" means the save contains a hidden key that is not already stored for that room.
  - Compare per room (`room_id`), not per org.
  - For fixtures: count the key in the stored `layout_fixtures` of the room against the submitted count. Any increase on a hidden key is a new placement, and a decrease or equal count is "kept".
  - For seats: the seats are exactly the room's, so compare the stored `sprite_key` with the submitted sprite. A hidden key on a seat is not possible while `desk.single` is the only seat sprite, but the code should be generic.
  - A moved or rotated hidden fixture with the same count stays allowed.
- Do not refuse non-placeable items (`chair.office`) with a separate code. They are already refused as `layout_unknown_sprite` by `spriteOk`.
- Reuse `layout_overlap`, `layout_out_of_bounds` and `layout_fixture_on_desk` for size-driven failures. Do not invent new codes for them.

**E. Read path (`readLayoutRows`)**
- Join the catalog for the placed keys:
  `select builtin_key, w, h from map_items where org_id = $1 and builtin_key = any($2::text[])`.
- No lock is needed on read, since it runs in a `repeatable read` snapshot.
- Build the footprint lookup from it and pass it to `resolveLayout`. Fill `items` from the same rows.
- One extra query, with a bounded key list (`LAYOUT_LIMITS.fixtures + seats` distinct keys at most, in practice under 60).
- Extend the DB tests so a drifted catalog size (e.g. an item with w/h differing from the registry) changes resolve results.

**F. R6/R7**
- Every statement goes through `orgQuery` with `org_id = $1`. The org and Admin tier come only from the token (`withAuth`, `tier: "admin"` already on PUT; GET is `tier: "user"`).
- No new auth codes. All new refusals are 409/422 domain codes raised before writes, inside the transaction.
- Audit: the existing `room.layout_save` entry covers the write. Optionally add `hiddenKept` counts to `meta`, but this is not required.
- The `items` field has no PII.

**G. Tests**
- `layout.test.ts`: catalog size overrides the registry in bounds, overlap and desk-tile checks; the 90/270 swap; fallback to the registry when no lookup entry exists.
- `resolve-layout` unit tests for the same, including an item that no longer fits being dropped.
- `save.test.ts`: hidden placed anew gives 422 before any write (assert no write queries ran); hidden kept gives 200; the `for key share` statement appears; the sorted key list is used.
- `layout.db.test.ts`: a resized item placed at the new size; an overlap at the new size gives 422; two org isolation cases (a key hidden in org A is placeable in org B).
- Route tests: PUT 422 body shape, GET `items` shape and no-store header.
- Regression: an existing saved layout fixture still resolves identically (golden test).

### Risks

- A `resolveLayout` change that drops a stored fixture which no longer fits the catalog size makes the draw differ from before, and the criterion says "unchanged". Because resize is blocked while placed, this should only happen through drift. Keep the registry fallback so a missing lookup entry is never a drop.
- Running the full rule check both pre-tx and in-tx doubles the CPU for a 2000-fixture layout. This is minor, but the in-tx pass should reuse the pre-tx results where possible.
- The two-phase check (pre-tx registry, in-tx catalog) must not leak a different failure code for the same input depending on timing. Keep one fixed order (grid, sprite, rotation, bounds, overlap, desk, hidden).
- The `for key share` on up to roughly 50 rows will conflict with a concurrent resize `FOR UPDATE`. That is intended, but a long-held room lock plus resize waits could surface as a lock timeout. Check that the pool sets a `lock_timeout`, and map 55P03 as 409 or a retry only if one exists today (not seen in `save.ts`).
- Hidden check races (hide then save) are accepted per the 039.2 plan, so do not over-engineer this.
- `LayoutResponse` is also consumed by the editor, map and tests (mock fixtures). An additive field is safe at runtime, but strictly typed fixtures need `items` added or made optional. If 039.5 is in parallel, mark it optional in the type until 039.5 lands.

### Open questions for the planner / Ming

1. Should `items` in the layout response also carry `name` and art info now (saves a second request on the map), or stay limited to `w`/`h` and leave the rest to `GET /api/map-items`? I recommend `w`/`h` only.
2. Exact error code name: `layout_item_hidden` (recommended) or something like `layout_item_unavailable`. Needs copy in `src/ui/copy/api.ts`.
3. Should a hidden item already placed that is submitted at a changed position or rotation count as "kept"? I recommend yes, because only the count per key matters.
4. Does the ticket's "Hidden item already placed: kept" extend to reading hidden items by non-Admins in the layout read? D67 (2) says hidden items are not returned to non-Admins. I recommend returning only the placed ones' size, and hiding the `hidden` flag.
5. Plan approval is recommended in the ticket (validator core). The plan should also state the `for key share` choice as an assumption, since it departs from the ticket text.

Relevant files (all under `/home/user/simap`):
- `src/lib/validate/layout.ts`
- `src/lib/sprites/resolve-layout.ts`
- `src/lib/sprites/layout.ts`
- `src/server/layout/layout.ts`
- `src/server/layout/save.ts`
- `src/app/api/rooms/[id]/layout/route.ts`
- `src/server/map-items/edit.ts`
- `src/lib/map-items/types.ts`
- `src/lib/api/error.ts`
- `work/tickets/SIM-039.2/plan.md` (lines 212-226)
- `db/migrations/20261125200000_map_items.sql`
