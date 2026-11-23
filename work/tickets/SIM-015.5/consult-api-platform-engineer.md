## SIM-015.5 consult (API contract / current code)

### Findings (current code vs the approved contract; nothing conflicts)
- **GET route** `src/app/api/rooms/[id]/layout/route.ts` is the template: `withAuth<{id}>`, `isCanonicalUuid` -> 404 `not_found`, `getPool()` null -> 503 `unavailable`, service result -> `apiError(r.status, r.code)`, `Cache-Control: no-store`. PATCH in `src/app/api/rooms/[id]/route.ts` shows the write pattern: `readJson`, then validate, then service, with `{ tier: "admin" }`. Missing body, bad JSON and oversize all map to `apiError(400, "invalid_request")`.
- **`readJson(req, maxBytes = 16_384)`** (`src/server/request/read-json.ts`) takes a max, so the PUT passes `LAYOUT_LIMITS.bodyBytes` (262_144). It checks content-type, `content-length` and the streamed size, and returns only `{ok:false}` with no distinction, so everything is a 400.
- **`validateLayoutSave(body)`** in `src/lib/validate/layout.ts` returns `{ok, value: LayoutSaveValue}` or `LayoutFailure`: `invalid_request` carries `field`, the 422 rule codes carry none. Route mapping: `invalid_request` -> 400, a rule code -> 422. Seats are already deduplicated and canonical-uuid checked.
- **Two gaps from the ticket's security notes are still open in `validateLayoutSave`:**
  - `floorCellsWithinCap` is exported (line 171) but never called. `validateLayoutSave` ends with `checkLayoutRules(value)` and returns.
  - `baseVersion` is checked only with `isSafeInteger` and `>= 0`, so there is no int4 cap. A huge value would reach the DB comparison. In SQL, `layout_version <> $n` with an int8-sized parameter is fine for an `int4` column only if the param is typed. Rejecting it in the validator is cleaner.
- **Error codes and copy:** `src/lib/api/error.ts` (the list at lines 21-24) and `src/ui/copy/api.ts` (lines 26-29) have only the four rule codes. `layout_stale`, `layout_seats_changed` and `layout_too_many_seats` are not added yet. The copy map is typed, so adding the codes to `error.ts` forces the copy at typecheck.
- **`getRoomLayout`** (`src/server/layout/layout.ts`) cannot be called from inside the PUT transaction as is. It runs `withTx` and then `set transaction isolation level repeatable read, read only` as its first statement, and that cannot run after other queries, and it would try to open a second transaction. Its row-building and read queries must be extracted into a helper taking a `TxClient` (for example `readLayoutRows(c, scope, sub, roomId)` returning `LayoutResponse | null`). GET then wraps it in the repeatable-read tx, PUT calls it on the same locked tx (step 8). It needs `ctx.sub` for `mine`. The GET `LayoutResult` type has only the 404 refusal, so PUT needs its own result type.
- **Service pattern to copy:** `src/server/rooms/rooms.ts` and `src/server/seats/seats.ts` each define a local `Abort extends Error`, an `inTx` wrapper (`withTx` plus catch `Abort`), and a `Refusal` type. `lockRoom` uses `... where org_id = $1 and id = $2 for update`, and the lock-order comment is at `rooms.ts:213-224`. `layout.ts` currently has none of these. Seat-lock queries use `order by id for update`.
- **`writeAudit(c, scope, {actorSub, action, entity, entityId, meta})`** exists. `meta` is counts only. Use action `room.layout_save`, entity `room`, `meta` with seats, fixtures and floors counts, `baseVersion` and the new version.
- **`layout_fixtures` schema** (`20261120150000_init.sql:169`): legacy `x`, `y`, `rotation` are `not null default 0`, so an insert with only `kind = null, tile_*, sprite_key` works. The existing DB test helper `addFixture` already does this. The `id` has a default, so the insert needs no id. Legacy rows are those with `sprite_key is null`.
- **DB tests** (`src/server/layout/layout.db.test.ts`) have helpers `addMember, addRoom, addSeat, newOrg, testPool`, plus local `room()`, `run()`, `addFixture()` and `bulkSeats()`. Extend there or add a `save.db.test.ts` sharing them.
- **Route test** `src/app/api/rooms/[id]/layout/route.test.ts` exists for GET. Add PUT cases in the same style.

### Recommendations
1. **Validator (AC: R7, security notes 1 and 2).**
   - In `validateLayoutSave`, after `checkLayoutRules` returns ok, call `floorCellsWithinCap(value.floors, value.w, value.h)`. On failure return `bad("floors")` (400 `invalid_request`), per the contract's "over a count cap" row. Add the 64-full-grid-zones test (64 zones at 64x64 = 262,144 cells > 2x4096).
   - Refuse `baseVersion > 2_147_483_647` as `bad("baseVersion")`, and add a test.
2. **Error codes.** Add `layout_stale` (409), `layout_seats_changed` (409) and `layout_too_many_seats` (422) to `error.ts` and copy to `api.ts`, in the same style as the existing layout copy. Suggested copy: "This room changed while you were editing. Reload to see the latest layout." / "The room's seats changed while you were editing. Reload and try again." / "This room has too many seats to save a layout."
3. **Service `src/server/layout/save.ts`** (or extend `layout.ts`; the file must start with `import "server-only"`), `saveRoomLayout(pool, scope, sub, roomId, value)`:
   1. `lockRoom ... for update` (404 if missing), selecting `layout_version`; `baseVersion !== layout_version` -> 409 `layout_stale`.
   2. Seats `select id from seats where org_id=$1 and room_id=$2 order by id for update`. If the row count > `LAYOUT_LIMITS.seats` -> 422 `layout_too_many_seats` **before** the set comparison (note 5). Then compare as sets: equal count and every submitted id present. A foreign or unknown id and a missing or extra id all give the same 409 `layout_seats_changed`.
   3. One `update seats s set tile_x=v.x, tile_y=v.y, tile_rotation=v.r, sprite_key=v.k, updated_at... from unnest($3::uuid[], $4::int[], $5::int[], $6::smallint[], $7::text[]) v(id,x,y,r,k) where s.org_id=$1 and s.room_id=$2 and s.id=v.id`. Set only placement (and `updated_at` if the table has it; check). Never touch occupant, status, `seat_counter` or devices. Skip when there are zero seats.
   4. `delete from layout_fixtures where org_id=$1 and room_id=$2 and sprite_key is not null`, then one `insert ... select $1, $2, null, ... from unnest(...)` with `kind = null` (skip when empty).
   5. `update rooms set grid_w=$3, grid_h=$4, floor_zones=$5::jsonb, layout_version = layout_version + 1 where org_id=$1 and id=$2`.
   6. `writeAudit` counts only.
   7. Re-read through the extracted helper on the same client (all locks held, so it is consistent) and return the `LayoutResponse`.
   - Keep `org_id` in every `where` so `orgQuery`'s guard passes, and keep `s.room_id = $2` on the seat UPDATE (note 3).
4. **Route** (`export const PUT`, `tier: "admin"`): uuid check -> 404, pool -> 503, `readJson(req, LAYOUT_LIMITS.bodyBytes)` -> 400, `validateLayoutSave` -> 400 for `invalid_request` and 422 for rule codes, all before any transaction. Then the service, then `apiError(r.status, r.code)`, and `Response.json(value, {headers: NO_STORE})`. Auth codes only from `withAuth` (R7).
5. **Tests.**
   - Unit: route refusal mapping (body bad, validator 400, validator 422, service 404/409/422, 503); validator additions; service SQL-order test in the style of `rooms.test.ts` (room lock, then seat lock, then update, fixtures, room update, audit).
   - DB: valid save then GET round trip; rollback on failure after the seat update (for example force an error at the audit step or insert, and assert seats, fixtures and room unchanged); stale `baseVersion`; two concurrent saves with the same base, where one gets 200 and the other 409 `layout_stale`; missing seat, extra seat and foreign-org seat id each 409 `layout_seats_changed` and the foreign-org case changes neither org (note 6); 501-seat room gives 422 `layout_too_many_seats`; occupants, `cannot_seat`, `seat_counter`, devices and legacy fixture rows (`sprite_key is null`) unchanged after a save; org scoping (another org's room id gives 404); version increments by exactly 1; a saved default layout from GET passes unchanged.

### Risks
- Extracting the read helper changes `getRoomLayout`. Keep its begin / set transaction / reads / commit order, which the existing test at `layout.db.test.ts:271` asserts.
- Under `read committed` PUT, the re-read is safe only because the room and seat locks are held. Fixture rows are replaced under the room lock, so no other writer touches them.
- A save of a room whose seats include `unplaced` ones fails with `layout_seats_changed` unless the client lists every seat (A11); the message copy should say to reload.
- A concurrent seat add or delete: `addSeats` and `deleteRoom` take the room lock first, so ordering is safe and the PUT result is either stale-seat-set 409 or success on the new set.
- Large body: 256 KiB is enforced twice (`content-length` and streaming), but the 2,000 fixtures + 500 seats caps also bound the work, so there is no extra CPU risk beyond the floor-cell cap in point 1.
- Wrong DB type: `unnest` with `$n::smallint[]` for rotation and `::int[]` for x and y must match the column types, or the update fails at runtime. The DB tests catch this.

### Open questions (defaults proposed, none blocking)
1. Floor-cell cap failure code: 400 `invalid_request` (field `floors`), per the contract's "over a count cap" row. Default: 400.
2. `baseVersion` above int4: 400 `invalid_request`. Default: 400.
3. Does `seats` have an `updated_at` column to bump on the placement UPDATE? Verify in `init.sql:79-100`; if present, set it.
4. File placement: `src/server/layout/save.ts` (new, with its own `Abort` and refusal type) vs adding to `layout.ts`. Default: new `save.ts` plus an extracted shared reader in `layout.ts`.

Key files: `src/app/api/rooms/[id]/layout/route.ts`, `src/server/layout/layout.ts`, `src/server/layout/layout.db.test.ts`, `src/lib/validate/layout.ts`, `src/lib/api/error.ts`, `src/ui/copy/api.ts`, `src/server/rooms/rooms.ts` (lock order, `Abort`/`inTx` pattern), `src/server/audit/write.ts`, `src/server/request/read-json.ts`, `work/tickets/SIM-015.1/plan.md` (lines 157-226).
