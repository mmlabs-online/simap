# Consult — api-platform-engineer — SIM-015.6 (2026-11-22)

## Findings

- `src/server/layout/` does not exist yet. All SIM-015.4 code is pure and lives in `src/lib/sprites/`:
  - `resolveLayout(room, seatRows, fixtureRows)` returns `{saved, layout, unplaced}`. It never throws, slices to 500 seats and 2000 fixtures, and falls back to `defaultLayout` when `grid_w` or `grid_h` is null or invalid.
  - `parseStoredFloors` is all-or-nothing and falls back to one `floor.wood` zone.
  - `seatViewOf({cannotSeat, mine, occupantId, occupantName})` gives state precedence cannot > mine > occupied > empty, and sets `avatarSeed = occupantId`.
  - `LayoutResponse` and `SeatView` types are in `src/lib/sprites/layout.ts`.
- The columns exist in `db/migrations/20261122120000_room_tile_layout.sql`:
  - `rooms`: `grid_w`, `grid_h`, `floor_zones`, `layout_version`.
  - `seats` and `layout_fixtures`: `tile_x`, `tile_y`, `tile_rotation`, `sprite_key`.
  - A tile-placed fixture has `kind` null and `sprite_key` set. Legacy fixture rows are excluded by `sprite_key is not null`.
- Route pattern to copy is `src/app/api/rooms/[id]/seats/route.ts` GET:
  - `withAuth<{id:string}>(..., {tier:"user"})`.
  - `isCanonicalUuid(id)` else `apiError(404,"not_found")`.
  - `getPool()` null gives `apiError(503,"unavailable")`.
  - `r.ok` false gives `apiError(r.status, r.code)`.
  - `Response.json(value, {headers:{"Cache-Control":"no-store"}})`.
  - `export const dynamic = "force-dynamic"`.
- `withAuth` (`src/server/http/with-auth.ts`) already does the following. The handler never emits these codes itself (R7).
  - 401/403 before the handler.
  - 503 for config, JWKS or member-gate failures.
  - 500 `internal` for thrown errors.
- Service building blocks:
  - `Result<T>`, `Refusal` and `Db` are in `src/server/seats/seats.ts`.
  - `withTx` in `src/server/db/tx.ts` only runs `begin`, so the isolation level must be set as the first statement inside it.
  - `orgQuery` requires the text to match `org_id = $1`. It binds `scope.orgId` as `$1`.
  - `Refusal` is typed to seats codes, but `not_found` 404 is already in it.
- Seat and room layout in SIM-015.1 and SIM-015.4 is fixed: the seats query joins members on `o.org_id = s.org_id and o.id = s.occupant_id`, orders by `s.seq, s.id`, and uses `limit 501`.

## Recommendations

1. Response shape (AC1, AC2): build `LayoutResponse` with explicit fields only (no row spread).
   - `room` is `{id, code, name}`.
   - `version` is `layout_version`.
   - `saved`, `layout` and `unplaced` come from `resolveLayout`.
   - `truncated` is `rows.length > 500` (query `limit 501`, then slice to 500 before resolving).
   - `seatViews` is keyed by seat id for every returned seat, including unplaced ones, built with `seatViewOf`.
   - An unsaved room performs only reads. The default is computed, not stored.
2. Set `version` to 0 and `saved` to false when the default is used. Check that `saved`/`version` are coherent: `resolveLayout` returns `saved: true` whenever the grid is valid, even if `layout_version` is 0.
3. Service `getRoomLayout(pool, scope, sub, roomId): Promise<Result<LayoutResponse>>` in `src/server/layout/layout.ts` (starts with `import "server-only"`):
   - Use `withTx`, with `set transaction isolation level repeatable read, read only` as the first statement. All reads use `orgQuery` on that client.
   - No room row returns 404 `not_found`, the same answer as for a foreign org (AC4). It should be returned from inside the tx (`Abort` or a result) so there is a single code path.
4. Room query: `select id, code, name, grid_w, grid_h, case when jsonb_typeof(floor_zones)='array' and jsonb_array_length(floor_zones) <= 64 and pg_column_size(floor_zones) <= 262144 then floor_zones else null end as floor_zones, layout_version from rooms where org_id = $1 and id = $2`. Use `octet_length(floor_zones::text)` if exact bytes are wanted. `resolveLayout` falls back to the default floor for a null.
5. Seat query: select `left(s.sprite_key, 129)` so an oversized key is cut to a value the registry will reject. Pass `s.occupant_id` as the avatar seed and `o.display_name` as the name. Compute `mine` as `coalesce(o.sub = $3::uuid, false)` and never select `o.sub`.
6. Fixture query: select `left(sprite_key,129)` too, `sprite_key is not null`, `order by id limit 2000`.
7. `resolve-layout.ts` `take`: add the type guard before `checkLayoutRules` (object, string sprite, integer x, y and rotation). Add tests for the five bad shapes. Map a seat with an unplaced or partial placement to `null` in the service.
8. Route:
   - Copy GET from the seats route.
   - Place the file at `src/app/api/rooms/[id]/layout/route.ts`.
   - Export GET only.
   - Check that `pnpm build` lists `/api/rooms/[id]/layout`.
9. Tests:
   - Route tests: bad uuid gives 404 without touching the pool (assert `getPool` is not called), no pool gives 503, `Cache-Control: no-store` is set. Check the export carries `WITH_AUTH_MARK`.
   - DB tests (`layout.db.test.ts`):
     - Unsaved room writes nothing (compare row counts and `layout_version` before and after).
     - Saved round trip.
     - Foreign-org room gives 404.
     - Status with real rows.
     - `JSON.stringify(response)` does not contain the seeded member `sub`.
     - Corrupt `floor_zones`, grid and `sprite_key` do not throw.
     - Legacy fixture hidden.
     - 500 seats gives `truncated: false`, 501 gives `truncated: true` with 500 seats.
     - A real committed write between two reads on separate connections: the reads in one tx still agree.
   - Run `node scripts/test-db.mjs` for local evidence.

## Risks

- `LayoutResponse` must never leak a raw Identity `sub`. `members.id` is the avatar seed, not `sub`. The `mine` boolean is derived in SQL. Do not join `members.sub` into the row types.
- If `set transaction ...` is not literally the first statement after `begin`, Postgres raises an error once a query has run. Add a test that proves the snapshot, or the concurrent-commit test will pass for the wrong reason.
- `pg_column_size` can be compressed (TOAST), so it understates the real size. Use `octet_length(floor_zones::text)` for the 262,144 bytes bound.
- `limit 501` without a stable order would give an unstable truncation. `order by s.seq, s.id` is needed.
- A seat in a saved room whose placement is invalid takes a free pitch slot, so its position in the response is derived and not stored. This is intended (LAY-06) but should be documented in the plan.
- Doing the 404 refusal after the isolation statement is fine. Do not add side effects (no audit row, since it is a read).

## Open questions

1. Should `saved` follow `resolveLayout` (valid grid) or `layout_version > 0`? A room with a grid but version 0 gives `saved: true` today. Pick one and test it.
2. Should a truncated room list only the first 500 `seatViews` (assumed yes), with `unplaced` limited to those 500?
3. Does the `unplaced` seat's `seatViews` entry need to exist when the room is truncated? Assumed yes for returned seats only.
4. Is the `Refusal` type left as-is (it already has 404 `not_found`), or should a layout-specific `Result` be defined in the layout service?
5. 500 error mapping: `withAuth` returns 500 `internal` for thrown errors. The ticket asks for route tests for 404 and 503 only. Confirm that is enough.
