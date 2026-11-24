## Findings

**Route and auth**
- The ticket path `src/app/api/rooms/[code]/layout/*` (ticket.md:51) and `{code}` collide with the code on main. The room routes live under `src/app/api/rooms/[id]/...`: `[id]/route.ts`, `[id]/seats/route.ts` (params `{ id }` at line 13) and `[id]/delete-impact`. They take a canonical uuid and answer 404 via `isCanonicalUuid` (seats/route.ts:15). Next.js refuses two different dynamic slug names at one level, so `[code]` next to `[id]` fails the build. Room codes are unique per org and uppercased (`validate/room.ts:19-23`, init.sql:73), but all current services key on the room id.
- Handler pattern to copy (seats/route.ts:13-41):
  - `withAuth<{id}>(..., { tier: "user" })` for GET and `{ tier: "admin" }` for PUT.
  - `getPool()` returning 503 when absent.
  - `readJson`, then a lib validator, then a service call, then `apiError(r.status, r.code)`.
  - `NO_STORE` headers and `dynamic = "force-dynamic"`.
- The wrapper (with-auth.ts:56-79) emits 401/403 before the handler runs. That satisfies R7 for 401/403 as long as PUT never emits one after the write.
- The error shape is only `{ error: { code } }` with no message or details (respond.ts:4-10). Codes are a closed union in `src/lib/api/error.ts:1-21`. Any new layout code must be added there.
- Services return `Result<T>` with a `Refusal {status, code}` and abort the transaction by throwing `Abort` inside `withTx` (seats.ts:21-53). Rooms are locked with `select ... for update` or `for share` through `lockRoom` (seats.ts:183-197). The lock order is member, room, seat, devices.

**Body limit**
- `readJson` defaults to 16 KiB (read-json.ts:6). It caps while streaming, requires content-type JSON, and returns `{ok:false}` for oversize, bad JSON and bad UTF-8 alike. The route maps that to 400 `invalid_request` (seats/route.ts:33).
- `SEAT_LIMITS.list` is 500 (`lib/seats/types.ts:1-3`). 500 seats plus fixtures will exceed 16 KiB.

**Existing provisional layout shape**
- `src/lib/sprites/layout.ts:5-22` already defines `Rotation` (0/90/180/270), `Placement {id, sprite, x, y, rotation}`, `FloorZone`, and `RoomLayout {w, h, floors, seats(+code), fixtures}`. Its comment says "Provisional: SIM-015.1 owns the persisted shape".
- Also in that file, `SeatView {state, avatarSeed, name}`: "Derived seat status lives in `SeatView`, never here".
- The renderer consumes exactly `buildDrawList(layout, seatViews, manifest)` (placement.ts:91-95). `RoomMap.tsx:4,24` and `DEMO_LAYOUT` (`app/dev/roommap/fixture.ts:16`) already use it.
- `sprite` is a base key such as `desk.single`. `resolveFrameKey` appends `.n/.e/.s/.w` from the rotation (placement.ts:9,27-32). The footprint comes from the directional registry entry (for example `desk.pair.e` is 2x2, keys.json:146-152).
- A chair is implied and never stored. `chairFor` puts it outside the desk footprint (placement.ts:35-53).
- Floors are zones (`FloorZone`) in the provisional type. The ticket scope (ticket.md:29-31) lists only seats and fixtures. Spec LAY-01 says "walls/floor" (spec:341).

**Sprite validation and R1**
- `REGISTRY`, `FRAME_KEYS`, `isFrameKey` live in pure lib code (`lib/sprites/registry.ts:4-24`, backed by `keys.json`). Each entry carries `group`, `dir`, `layer`, `tiles` (null means sub-tile prop) and `blocks` (types.ts:9-16).
- The server may import it (server → lib is allowed by R1). It does not need to read `public/sprites/office.json` at runtime.
- `validateSpriteManifest` (sprite-manifest.ts:46-83) forces the manifest key set and `tiles` to equal the registry. It only checks that `blocks` is a boolean (line 82), not that it equals `REGISTRY[key].blocks`. The client's `buildDrawList` reads `frame.blocks` from the manifest (placement.ts:149), while a server using the registry would read the registry value. This is a possible client/server drift.
- Registry groups include `desk` (4 directions x single/pair), `chair`, `avatar`, `device`, `state`, `floor`, `wall`, `door`, `window`, `plant`, `rack`, `cabinet`, `label`, `circulation` (stairs, elevator), and others (keys.json). Seats, fixtures and render-only keys (avatar, state, chair, device) must be separated.

**Schema facts that constrain the migration**
- `seats.x/y/rotation/w/h` are free-form `double precision not null` (init.sql:88-92). The new tile columns must be separate; `rotation` is already taken by the free-form column.
- `layout_fixtures.kind` is `not null` with a closed `check` of 10 kinds (init.sql:176-184). It lacks `plant`, which spec LAY-03 requires, and it has no sprite key. Only `db/seeder.js:126` and `scripts/schema-check.mjs:96` reference the table, so the old image does not read it.
- A new seat insert by the previous image (`addSeats`, seats.ts:278) omits any new column. New columns must therefore be nullable or defaulted, and an all-or-none check on the placement columns is needed.
- `seats` has no uniqueness that can express footprint overlap. Overlap can only be enforced in the application, inside the locked transaction.

## Recommendations

1. **Route.** Use `src/app/api/rooms/[id]/layout/route.ts`, with a canonical uuid and 404 otherwise. The ticket's `{code}` is not buildable next to `[id]`, and renaming the existing `[id]` dir is outside R4. Record this in the plan. The map page `/rooms/<code>` already has to resolve code to id for `/seats`.

2. **GET payload (one shape for 015.3 and 015.2).** Reuse and finalise the existing types, so `RoomMap`, `DEMO_LAYOUT` and `buildDrawList` need no rework:
   ```
   { room:{id,code,name}, version:int, saved:boolean,
     layout: RoomLayout,                      // w,h,floors,seats[{id,code,sprite,x,y,rotation}],fixtures[...]
     seatViews: Record<seatId, SeatView>,     // status derived via seatStatus()+cannot_seat, never stored
     unplaced: seatId[] }                     // seats that did not fit
   ```
   - Add `cannotSeatReason` and `occupant.displayName`, as `SeatDto` does (seats.ts:79-94), if the seat popover needs them. The overlay state `pending` stays unused until SIM-014.
   - Derive status from the join on `occupant_id` using `seatStatus` from `@/lib/seats/rules`, reusing the join style of `seatRows` (seats.ts:97-132), where every join repeats `org_id`.
   - Put the `RoomLayout`, `LayoutWrite` and limits types in `src/lib/layout/` or alongside `lib/sprites/layout.ts`, so UI and server share them. Remove the "Provisional" comment.

3. **PUT payload.**
   ```
   { baseVersion:int, size:{w,h} (or w,h), floors:[...],
     seats:[{id,sprite,x,y,rotation}], fixtures:[{id?,sprite,x,y,rotation}] }
   ```
   - Reject unknown keys, as `room.ts:14` does. The editor strips GET-only fields (`code` and the like).
   - Integers only (`Number.isInteger`, no floats). Rotation must be exactly one of 0, 90, 180, 270.
   - The response is the same body as GET, with the new `version`. The editor then gets fresh fixture ids.

4. **Identification on save.**
   - Seats are identified by the existing seat uuid. The PUT must list exactly the room's current seats (set equality, no duplicates) and updates `tile_x/tile_y/sprite_key/tile_rotation` only.
   - Seats are never created or deleted. A seat id from another room or org is not in the set, so it is refused 422 without revealing which it was.
   - Fixtures are replaced wholesale in the same transaction (delete the room's rows, insert the payload). Nothing references fixtures by FK. Do not trust client ids across rooms. Either server-generate ids and return them, or accept optional ids and treat a primary-key conflict as a 422. Server-generated ids are simpler, and the GET shape keeps `id` because the draw sort uses it (placement.ts:214).

5. **Validation (pure, in `src/lib/validate/layout.ts`, with unit tests).**
   - Size limits: for example w,h from 1 to 64 tiles, a fixture cap (about 2000), seats at most `SEAT_LIMITS.list`, and a floor-zone cap.
   - Each footprint must be inside the bounds. The footprint comes from `REGISTRY[resolveFrameKey(sprite, rotation)].tiles`, with null treated as 1x1.
   - Unknown sprite: `isFrameKey` on the base key, plus a role check. Seats must use `group === "desk"` keys. Fixtures must exclude `desk`, `chair`, `avatar`, `device` and `state`.
   - Overlap is refused only when both items block (`REGISTRY[...].blocks`) and the footprints intersect. This matches LAY-01 (spec:343) and the sub-tile host rule (placement.ts:198).
   - Share one function between the editor's pre-save check and the server.

6. **Default for a room with no saved layout, and unplaced seats.**
   - `GET` never writes. A pure, deterministic `defaultLayout(seats)` runs in lib: it takes seats in `seq` order and packs the desk sprite in a grid, leaving a gap for the implied chair tile. It picks a default room size large enough, capped at the max.
   - Return `saved:false` and `version:0`.
   - The same packer places any seat whose placement columns are null (for example one added by SIM-012 after a save), so the seat stays reachable. If no free tile is left, list the id in `unplaced` and let the map show it in a list.
   - Fixtures are empty and floors have one default zone, or the existing default.

7. **Stale-save and concurrency.**
   - Add `rooms.layout_version integer not null default 0`. GET returns it and PUT requires `baseVersion`.
   - In one transaction: `lockRoom(..., "update")` (seats.ts:183), compare the version, mismatch → 409 `layout_stale`. Then lock the room's seats `for update` (room-then-seat order, as in the comment at seats.ts:208), run the set-equality and overlap checks, write, and bump the version.
   - This serialises two Admins. A seat added or deleted by someone else between load and save also surfaces as a 409 or a set mismatch, and the editor reloads.
   - Write one audit row such as `room.layout_save` through `writeAudit` (seats.ts:285-291), with counts only and no payload.

8. **Refusal codes (R7).** Add to `API_ERROR_CODES` (error.ts:1-21) and keep the refusal union typed separately from `seats.ts:24-30`:
   - 400 `invalid_request`: malformed JSON, oversize body, wrong types or unknown keys. This matches the seats route (seats/route.ts:33-35).
   - 422 `layout_out_of_bounds`, `layout_overlap`, `layout_unknown_sprite`, `layout_seats_mismatch`.
   - 409 `layout_stale`.
   - 404 `not_found`: bad uuid or room not in the caller's org.
   - Rotation errors fall under `invalid_request`, since shape validation is not domain. Distinct 422 codes are worth having because the body has no details, so the editor cannot otherwise tell which rule failed.
   - Never return 401/403 from the service. Only `withAuth` does.

9. **Body size.** Call `readJson(req, 262_144)` (256 KiB) for PUT only, with a stated count cap that makes the worst valid payload fit (500 seats x about 80 B plus 2000 fixtures x about 70 B is about 180 KB). Consider a 413 code if you want it distinct from 400; the closed code union would need a new entry.

10. **Migration (forward-only, expand, then contract later).**
    - `rooms`: `tiles_w`, `tiles_h` (smallint null, check 1 to 64), `layout_version`, and floor zones either as a jsonb column or a small table.
    - `seats`: `tile_x`, `tile_y` (int null, >= 0), `sprite_key text null`, `tile_rotation smallint null check in (0,90,180,270)`, plus a check that the four are all-null or all-set.
    - `layout_fixtures`: add `sprite_key`, `tile_x`, `tile_y`, `tile_rotation`, `alter column kind drop not null`, and drop the `kind` check (init.sql:182-184). The old image never reads it. Leave a contract migration for the free-form columns, as the scope says.
    - Update `scripts/schema-check.mjs` and `db/seeder.js`, and add a migration note in `db/migrations/README.md`.

11. **Registry/manifest drift guard.** Add a test, or tighten `validateSpriteManifest`, asserting `manifest.frames[k].blocks === REGISTRY[k].blocks` for every key. This lives with `scripts/sprites/committed-atlas.test.ts`. Otherwise the server (registry) and the client renderer (manifest, placement.ts:149) can disagree on overlap.

12. **Tests.** Unit: validator cases for bounds, rotation, overlap, unknown sprite, role mismatch, limits, unknown keys, and a packer determinism and footprint check. DB (`*.db.test.ts` style, for example `seats.db.test.ts`): org scoping (another org's room gives 404 and another org's seat id gives 422), a refused save writes nothing, a valid save survives a reload, a stale `baseVersion` gives 409, two sequential saves, and an unsaved room's default.

## Risks

- **Route naming:** following the ticket literally breaks the Next build or forces a rename of existing routes.
- **Floor zones:** the ticket omits floors, but `RoomLayout.floors` already exists in the provisional type and in the renderer. Dropping it makes the map lose its floors. Persisting it needs a column or table that the plan must show to Ming (High path).
- **Registry and manifest drift** on `blocks` (item 11) can let a payload the server accepts render overlapped, or the reverse.
- **Chair tile:** the implied chair lies outside the footprint (placement.ts:35-53). If chairs are not bounds-checked, a desk at the edge draws a chair outside the room. The renderer tolerates it by widening `bounds` (placement.ts:101,105).
- **Identity leak:** `SeatView.avatarSeed` is "derived from `sub`" (spec:362). Putting raw `sub` in a GET readable by every member exposes Identity account ids. Prefer the member id as the seed.
- **Fixture `kind`:** it is `not null` with a closed check. If the migration misses it, the first fixture insert fails with a 23514. This kind of error can surface as a 500 unless caught.
- **Seat limit:** `SEAT_LIMITS.list` truncates at 500, and a layout PUT with set equality must fail clearly (or must not run) for a room with more than 500 seats.
- **Large payloads and locks:** the PUT holds a room `for update` lock while it checks and writes. This blocks seat edits for that room, which is acceptable at this scale.
- **No details in the error body:** the editor cannot say which item broke a rule. This is mitigated by sharing the validator client-side.

## Open questions

1. `{code}` versus `[id]` in the route: accept `[id]/layout`, as the existing code has it? (Recommended: yes.)
2. Floors: store zones in a jsonb column on `rooms`, in a new table, or drop floors from this ticket and keep a fixed default floor? (Recommended: jsonb column, validated in lib, in the same transaction as the version bump.)
3. Must the implied chair tile be in bounds and free of blocking items, or only the desk footprint (as LAY-01 states, spec:343)?
4. Should rotations be restricted for keys with no directional variants (for example `plant.large`), or accepted and ignored? (Recommended: accept all four, resolve with `resolveFrameKey`.)
5. Fixture ids: server-generated on every save (recommended), or client-supplied uuids?
6. Avatar seed in GET: member id (recommended) or `sub` as the spec wording says?
7. Is exact seat-set equality on PUT acceptable for SIM-015.2 (the editor must reload after any seat add or delete elsewhere), or should unlisted seats be left untouched?
8. Limits: max room size (suggested 64x64) and the fixture count cap. Should an oversize body get its own 413 code?
9. Should the layout save be audited (recommended: yes, counts only)?

Files cited: `d:\project\simap-game-ui\work\tickets\SIM-015.1\ticket.md`, `d:\project\simap-game-ui\src\app\api\rooms\[id]\seats\route.ts`, `d:\project\simap-game-ui\src\server\http\with-auth.ts`, `d:\project\simap-game-ui\src\server\http\respond.ts`, `d:\project\simap-game-ui\src\server\request\read-json.ts`, `d:\project\simap-game-ui\src\server\seats\seats.ts`, `d:\project\simap-game-ui\src\lib\api\error.ts`, `d:\project\simap-game-ui\src\lib\sprites\layout.ts`, `d:\project\simap-game-ui\src\lib\sprites\placement.ts`, `d:\project\simap-game-ui\src\lib\sprites\registry.ts`, `d:\project\simap-game-ui\src\lib\sprites\keys.json`, `d:\project\simap-game-ui\src\lib\validate\sprite-manifest.ts`, `d:\project\simap-game-ui\db\migrations\20261120150000_init.sql`, `d:\project\simap-game-ui\docs\spec-v1.md`.
