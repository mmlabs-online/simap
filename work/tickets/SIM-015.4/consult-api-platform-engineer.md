## Findings

**Existing patterns to copy**
- The route is a copy of `src/app/api/rooms/[id]/seats/route.ts:13-24`. It uses `withAuth<{id:string}>(..., {tier:"user"})`, then `isCanonicalUuid(id)` else `apiError(404,"not_found")`, then `getPool()` else `apiError(503,"unavailable")`. It returns `Response.json(r.value,{headers:{"Cache-Control":"no-store"}})` and has `export const dynamic="force-dynamic"`. The new file is `src/app/api/rooms/[id]/layout/route.ts`.
- The service pattern is `listRoomSeats` (`src/server/seats/seats.ts:149-179`). It returns `Result<T>` (`seats.ts:32`). `notFound` is at `seats.ts:34`. Every query goes through `orgQuery` (`src/server/http/org-scope.ts:15`), which requires the literal `org_id = $1` in the text.
- `seatRows` (`seats.ts:97-132`) is not reusable. It does not select the new columns and it runs a devices subquery. Write a new lean query in `src/server/layout/layout.ts`.
- `mine` is computed in SQL as `coalesce(o.sub = $2::uuid,false)` (`seats.ts:110`). Copy that. Never select `o.sub` into a result row that is returned.
- `withTx` (`src/server/db/tx.ts:10-27`) issues a plain `begin`. It has no isolation option, and no code in `src/` sets one.
- `SEAT_LIMITS.list = 500` (`src/lib/seats/types.ts:3`) is also `LAYOUT_LIMITS.seats` (`src/lib/validate/layout.ts:10`). `listRoomSeats` reads `list+1` rows and slices (`seats.ts:169-176`). Use the same approach for `truncated`.

**Migration facts (`db/migrations/20261122120000_room_tile_layout.sql`)**
- `grid_w` and `grid_h` are both null or both set (`:9`), and positive (`:10`). There is no upper bound in the DB, so a stored grid of 100 is possible and is untrusted.
- `floor_zones` is only checked to be a jsonb array (`:11`). Element shape, sprite, bounds and size are all unchecked.
- `seats` placement (tile_x, tile_y, tile_rotation, sprite_key) is all-or-none (`:19`), with x/y at least 0 and rotation in 0/90/180/270. `sprite_key` is only non-blank (`:22`), so it may be any string, including `constructor` or a retired key.
- `layout_fixtures.kind` is now nullable. A legacy row has `kind` set and `sprite_key`/`tile_*` null. Its old `x`/`y` are free-form pixel doubles.
- The migration has no tile-grid `layout_version` per seat. The version is on `rooms.layout_version` (default 0).

**Validator facts (`src/lib/validate/layout.ts`)**
- `checkLayoutRules` (`:96`) is pure and takes `{w,h,floors,seats,fixtures}`. It returns only the first failure and does not say which item failed.
- `spriteOk` (`:84`) is private, and the registry `SPRITES` map is private. It uses a Map, so `constructor`/`__proto__` are safe.
- `resolveFrameKey` (`placement.ts:27`) uses `Object.hasOwn`, so it is prototype-safe.
- Seat sprites are only `desk.single` (`:38`). Floors must be `group floor`, non-directional (`:88`). `floor.wood` exists (`keys.json:370`).
- `desk.single` at rotation 0 has footprint [2,1] and its chair is at `(x, y+1)` (`placement.ts:44-45`). Chair cell is `x + floor((w-1)/2)`. A 3×2 pitch slot (desk at `(3i,2j)`, chair at `(3i,2j+1)`) therefore stays in bounds and never overlaps. That is the design reason the default rule passes `checkLayoutRules`.

## Recommendations

1. **`repeatable read, read only` with the existing helper.** Do not change `withTx`'s signature, to keep its tests (`tx.test.ts`) untouched. Make the first statement inside `fn` `client.query("set transaction isolation level repeatable read read only")`. PostgreSQL allows this right after `begin` and before any other query. Run the room, seats and fixtures selects on the same `client` through `orgQuery`.
   - Alternative: an optional `mode` argument on `withTx` (`tx.ts:10`). That touches a shared file, so I would not choose it for an M ticket.
   - If the team wants the 404 and the read in the same snapshot (they should), do the room lookup inside the transaction too. Return `Result<LayoutResponse>` and use `Abort`-free early returns, because a read-only transaction needs no rollback beyond `withTx`'s own.
2. **Queries (all inside the tx, all with `org_id = $1`).**
   - Room: `select id, code, name, grid_w, grid_h, floor_zones, layout_version from rooms where org_id=$1 and id=$2`. No row means 404 (same for a foreign org).
   - Seats: `select s.id, s.code, s.seq, s.cannot_seat, s.occupant_id, o.display_name, coalesce(o.sub=$3::uuid,false) as mine, s.tile_x, s.tile_y, s.tile_rotation, s.sprite_key from seats s left join members o on o.org_id=s.org_id and o.id=s.occupant_id where s.org_id=$1 and s.room_id=$2 order by s.seq, s.id limit 501`. Slice to 500 and set `truncated`. A caller `sub` goes in as a parameter only, and is never returned.
   - Fixtures: `select id, sprite_key, tile_x, tile_y, tile_rotation from layout_fixtures where org_id=$1 and room_id=$2 and sprite_key is not null order by id limit 2001`. Rows with null `sprite_key` (legacy) are excluded, because they have no tile placement. Cap at `LAYOUT_LIMITS.fixtures` (2000).
3. **`SeatView` derivation (pure, put in `src/lib/sprites/` or the server module).** Precedence is `cannot_seat` gives `cannot`, then `mine` gives `mine`, then `occupant_id` not null gives `occupied`, else `empty`.
   - `avatarSeed = occupant_id` (the member uuid) and `name = display_name`, for every state that has an occupant, including `cannot` (the plan says it keeps them, line 187-188). Empty gives `null`/`null`.
   - Do not emit `pending` (the `SeatState` type has it, `layout.ts:30`, but SIM-014 owns it).
   - `seatViews` has an entry for every returned seat, including unplaced ones.
4. **`defaultLayout(seats)` in `src/lib/sprites/default-layout.ts`.** Use the plan formula (`plan.md:220-223`). Input is the seats in `seq` order, with `{id, code}`. Place `desk.single` rotation 0 at `(3*(i%cols), 2*floor(i/cols))`. Output is one `floor.wood` zone `{x:0,y:0,w,h}` and no fixtures. For 0 seats it gives 12×8 with no seats. For 500 seats it gives 63×48.
5. **Saved-room reconciliation (`saved = grid_w !== null`).** All untrusted data is handled by degrading, never by throwing, so a bad row can never give a 500 for the room view.
   - **Grid:** if `grid_w`/`grid_h` fail `checkLayoutRules`' grid test (above 64 is the only DB-possible failure), treat the room as unsaved: use the default layout and `saved:false`. Keep the stored `layout_version` in the response, because PUT compares `baseVersion`.
   - **Floors:** parse `floor_zones` defensively. It must be an array of plain objects with safe-integer `x,y,w,h` and a string `sprite`. Apply the count cap `LAYOUT_LIMITS.floors` (64), then check each zone against `checkLayoutRules({w,h,floors:[z],seats:[],fixtures:[]})`, which covers known floor sprite and bounds. Apply a total-cell cap, for example the sum of `w*h` must not exceed `64*64*LAYOUT_LIMITS.floors` or a smaller number you pick. On any failure of the array as a whole, fall back to the single default `floor.wood` zone. Dropping only the bad zones is optional. One rule is simpler to test.
   - **Seats:** a stored placement is valid only if `sprite_key` is `desk.single`, rotation is allowed, and it is in bounds. Seats with null placement, or a placement that fails, are candidates for a free slot.
   - **Fixtures:** `sprite_key` must pass the fixture role check and in-bounds. Per-item check against an empty layout first. Fixtures that fail are dropped silently.
   - **Overlap:** after the per-item filter run `checkLayoutRules` once on the whole candidate. If it fails (overlap, or a chair out of bounds), drop failing seats into the unplaced set, using an incremental greedy accept in `seq` order (seats first, then fixtures). The cost is bounded: about 2,500 items.
   - **Free slot for unplaced seats:** scan the pitch slots in row-major order. Pre-filter using a set of occupied cells (blocking footprints plus chair cells), then confirm each candidate with one `checkLayoutRules` call. This avoids the quadratic worst case (up to 500 seats × 672 slots × a full check). If no slot is free, the seat goes to `unplaced` (id and code) and it still has a `seatViews` entry.
   - To reuse validation without copying, export a small helper from `src/lib/validate/layout.ts` (for example `isKnownSprite(kind, key)`), or run `checkLayoutRules` on one-item layouts. I would prefer the second option so SIM-015.4 does not widen SIM-015.1's file. Either is a small change.
6. **Placement output.** Convert `tile_rotation` smallint to `Rotation`, and base `sprite_key` stays as stored (base-key rule, A3). The fixture `id` for `Placement` is `layout_fixtures.id`.
7. **Truncated rooms.** The default layout and reconciliation work on the first 500 seats by `(seq, id)`. Seats beyond the cap are neither in `seatViews` nor `unplaced`. Set `truncated: true`. A saved room with more than 500 seats is read-only-truncated, which matches the PUT rule `layout_too_many_seats`.
8. **Legacy fixture rows.** Seats with null `sprite_key` use the free-slot rule in saved rooms, or the default in unsaved rooms. Legacy fixture rows are excluded from the response (finding 2 above). Do not delete them (Slice 3 rule, `plan.md:210`).
9. **Response hygiene.** Build the response from an explicit field list. Never spread DB rows. The response must contain no `sub`, no `org_id`, no email. `room` has `{id, code, name}`. A test should `JSON.stringify` the response and search for the member `sub`.

**Tests**
- Unit `src/lib/sprites/default-layout.test.ts`:
  - Sizes for n = 0, 1, 16, 17, 100, 500 (12×8 for the small cases, 63×48 for 500).
  - Seats follow `seq` order. Slots are on the 3×2 pitch. Every seat is unique.
  - Required: `checkLayoutRules(defaultLayout(n))` returns `ok` for n in {0,1,4,17,100,500}. Optionally also `validateLayoutSave` on the wrapped output with `baseVersion`.
  - Deterministic output.
- Unit for the pure derivation and reconciliation:
  - `SeatView` precedence: `cannot`+occupied gives `cannot` and keeps seed and name. `cannot` and `mine` gives `cannot`. `mine` beats `occupied`. Empty gives null seed. The seed equals the member id, not a `sub`.
  - Bad floors (non-array, bad shape, unknown sprite, out-of-bounds, over the cap) give the default floor.
  - Unknown or prototype sprite key (`constructor`) on a seat gives a slot or unplaced. An unknown fixture key is dropped.
  - Overlapping stored seats: one is relocated.
  - No free slot gives `unplaced`.
  - Grid above 64 gives the default with `saved:false`.
- DB `src/server/layout/layout.db.test.ts` (uses `testPool`, `newOrg`, `addRoom`, `addSeat`, `addMember` from `src/test/db/fixtures.ts`; no fixture helpers exist for the new columns, so use direct `pool.query` updates):
  1. Unsaved room (grid null) with 3 seats: `saved:false`, version 0, all seats placed, and `select` shows `rooms.grid_w` is still null and no seat tile columns written (nothing written).
  2. Saved room: grid, floor, tile-placed seats and sprite-key fixtures are returned as stored. `saved:true`, version equals `layout_version`.
  3. Org scoping: another org's room id gives 404. Seats and fixtures from another org (same `room_id` cannot occur, so use a second org with its own room) never appear. A bad-uuid case belongs to the route.
  4. Status derivation with real rows: empty, occupied, `mine` (caller sub = occupant member's `sub`), `cannot`.
  5. No raw `sub`: stringify the response and assert it contains neither the occupant's nor the caller's `sub`; `avatarSeed` equals the member id.
  6. Corrupt stored data: `floor_zones` set to `[{"sprite":"nope"}]` and `'[1]'`, grid 100×100, seat `sprite_key='constructor'`, a seat with null placement in a saved room. The call resolves OK with the fallbacks and the seat is in a free slot or `unplaced`.
  7. Legacy fixture (kind='door', `sprite_key` null, via `insert into layout_fixtures (org_id, room_id, kind)`) is not returned and does not crash.
  8. Truncation: insert 501 seats via one `generate_series` insert (the `addSeat` helper is slow), expect 500 seats, `truncated:true`, and an exactly-500 room gives `truncated:false`.
  9. Snapshot: it is hard to race deterministically. An acceptable test is to run the read on a client that already set `repeatable read`, then commit a layout update from another connection between two selects, but that needs the service to take a client. A simpler assertion is to spy on `client.query` and assert the first statement after `begin` is the `set transaction ... repeatable read read only`. Do that as a unit test with a fake `TxPool`, like `tx.test.ts`. Also confirm a write attempted inside it is refused (`25006`) in the DB test, by running `set transaction ... read only` then an insert on a direct client.
- Route test (pattern `src/app/api/rooms/route.test.ts`): bad uuid gives 404 without touching the pool. No pool gives 503. `withAuth` marker is present (as with other routes). Response has `no-store`. 401 for no token comes from the wrapper only.
- Gate: `pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build`, and `pnpm test:db`. `pnpm build` confirms the `[id]/layout` route path (ticket note).

## Risks

- `checkLayoutRules` returns only the first failure and no item index. Reconciliation must call it per item or incrementally. A naive per-seat check against a growing layout is O(n²) (about 500 × 3,000 cells at worst), which is fine, but fixtures (2,000) need the pre-filter described above to stay cheap.
- `set transaction` must run before any other statement in the transaction. If a future change in `withTx` or the helper runs a query first, it fails at runtime with a Postgres error. The unit test that asserts statement order guards this.
- An unsaved room's stray placement columns (a seat with tile placement but grid null) are ignored. A later PUT in Slice 3 overwrites them, so this is harmless, but the test should cover it.
- If the default layout is returned for a saved room whose grid is corrupt, `saved:false` and `version` stay mismatched in meaning (version could be above 0). Document it so SIM-015.5 and the UI still send `baseVersion` = returned `version`.
- A room with a large `floor_zones` array (jsonb has no size limit in the DB) is read before validation. Cap by count before iterating (`LAYOUT_LIMITS.floors`), and do not run per-zone work over an unbounded array.
- A removed registry key or a corrupt `kind=null, sprite_key=null` fixture cannot occur because of the DB check, but a retired `sprite_key` can. That case is covered by dropping the fixture silently, which means a later save by an Admin will remove it. Acceptable, but worth a line in the plan.
- `display_name` is returned to all org members. That is already the case for the seat list (SEA-02), so it is not a new exposure, but the plan should state it.

## Open questions

1. Total floor-cell cap value: the ticket says "a total-cell cap" but gives no number. I suggest sum of `w*h` at most 64×64 per zone times 64 zones (a hard ceiling), or a tighter single room area bound of 4,096 cells counted with overlap. Which one?
2. For a saved room whose stored grid is invalid (above 64), do we return the default with `saved:false`, or return an error? I recommend the default so the room view never breaks.
3. Should a floor array with one bad zone be replaced as a whole (simplest) or filtered (keeps the good zones)? I recommend replace-whole.
4. Should unplaced seats in a saved room first try the slot scan on the existing grid only (my assumption), or may the grid grow? Plan A-choices say first free slot or `unplaced`, so I assumed no growth.
5. Is the `SeatView.name` for a `cannot` seat with an occupant meant to be shown to every role? The plan says it keeps the name, so I followed it.
6. Where should the pure `SeatView` derivation live? I suggest `src/lib/sprites/seat-view.ts` (pure, lib-only, per R1), but the ticket lists only three files, so adding this and the test file is a small R4 extension to confirm.

Files read: `d:\project\simap-game-ui\work\tickets\SIM-015.4\ticket.md`, `d:\project\simap-game-ui\work\tickets\SIM-015.1\plan.md`, `d:\project\simap-game-ui\db\migrations\20261122120000_room_tile_layout.sql`, `d:\project\simap-game-ui\src\lib\validate\layout.ts`, `d:\project\simap-game-ui\src\lib\sprites\layout.ts`, `d:\project\simap-game-ui\src\lib\sprites\placement.ts`, `d:\project\simap-game-ui\src\server\db\tx.ts`, `d:\project\simap-game-ui\src\server\seats\seats.ts`, `d:\project\simap-game-ui\src\app\api\rooms\[id]\seats\route.ts`, `d:\project\simap-game-ui\src\server\http\org-scope.ts`, `d:\project\simap-game-ui\src\server\http\with-auth.ts`, `d:\project\simap-game-ui\src\test\db\fixtures.ts`, `d:\project\simap-game-ui\src\server\seats\seats.db.test.ts`.
