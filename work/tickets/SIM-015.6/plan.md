Status: READY

# Plan — SIM-015.6: Room layout read API

## Scope summary

Ticket scope: "`GET /api/rooms/{id}/layout` for any org member, returning `LayoutResponse`", and "A `getRoomLayout` service
that reads in one `repeatable read, read only` transaction, scoped by the verified token's org (R6), and builds the
response with the pure SIM-015.4 helpers."

Scope sources quoted:

- Spec LAY-01 (`docs/spec-v1.md:338-343`): "A room has a size in tiles (width × height). ... Positions survive reloads and
  sessions."
- Spec LAY-06 (`docs/spec-v1.md:357-363`): "Each seat shows its state with a sprite overlay ... empty, occupied (a pixel
  avatar sits there), mine (highlight), cannot-seat (blocked sign), pending request (marker)." `pending` is out of scope
  (SIM-014). The "derived from `sub`" wording on line 362 is superseded by D59 (below).
- Spec "Room view (all roles)" (`docs/spec-v1.md:365-367`): "`/rooms/<code>` shows the saved pixel layout read-only with
  LAY-06 overlays". This ticket supplies its data; the UI is SIM-015.3.
- Spec SEA-02 (`docs/spec-v1.md:235-236`): "Every view shows a seat as empty or occupied, computed from its occupant. No
  status column exists."
- D43 (`work/decisions.md:50`): whole tiles, 4 rotations, fixed sprite sizes, a room has a size in tiles.
- D48 (`work/decisions.md:55`): 32 px tiles; editor logic unchanged.
- D58 (`work/decisions.md:65`): SIM-015.1 is the tile-grid schema and layout API; the read-only map is SIM-015.3.
- D59 (`work/decisions.md:66`): "API by room id ... The avatar seed is the member id, not `sub`, which supersedes that
  wording in D44 and D51."
- SIM-015.1 contract (`work/tickets/SIM-015.1/plan.md:163,167-175`): `GET /api/rooms/{id}/layout`, codes "200, 401/403
  (wrapper only), 404, 503", `tier: "user"`; `version: number; // 0 until the first save`, `saved: boolean; // false =
  computed default`, `seatViews` for "every seat, including unplaced; avatarSeed = member id", `truncated` "room has more
  than 500 seats". A9 (line 55): "`grid_w` null means unsaved. GET computes a deterministic default and **never writes
  it**." A12: legacy fixtures "Kept in the DB, not shown". A14: "GET shows the first 500 with `truncated: true`".
  Line 216: "GET reads in one `repeatable read, read only` transaction, so a concurrent save cannot produce a new version
  with old seats."
- SIM-015.4 fixed design (`work/tickets/SIM-015.4/plan.md:266-288`) and its assumption 2 (line 228): "Invalid stored
  grid: return the default with `saved: false` and the stored `version`, so the view works and a later save still passes
  the stale check."
- SIM-015.4 security review (`work/tickets/SIM-015.4/security-review.md:11-48`): 🟡 1 (type guard in `take`, five
  shapes) and finding 2 (SQL caps on `floor_zones` and `sprite_key`).

**Path confirmation.** The ticket's `resolve-layout.ts` is `src/lib/sprites/resolve-layout.ts` (SIM-015.4 put all pure
code in `src/lib/sprites/`). `LayoutResponse` / `SeatView` are in `src/lib/sprites/layout.ts:32-43`, `seatViewOf` in
`src/lib/sprites/seat-view.ts:4-18`, `resolveLayout` / `StoredSeat` / `StoredFixture` / `StoredRoom` in
`src/lib/sprites/resolve-layout.ts:12-15,50-154`. `src/server/layout/` does not exist yet.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | GET returns the room size, each seat's placement and derived status, and the fixtures, for the caller's org only. | `layout.db.test.ts › saved room round trip` and `› seat status from real rows`; `› foreign org room is 404` |
| 2 | A room with no saved layout returns a usable default without writing anything, and its seats stay reachable. | `layout.db.test.ts › unsaved room returns the default and writes nothing` |
| 3 | A room over 500 seats returns the first 500 with `truncated: true`. | `layout.db.test.ts › 500 seats not truncated, 501 truncated to the first 500` |
| 4 | A bad id, or a room in another org, returns 404. | `route.test.ts › non-canonical id is 404 without getPool or the service`; `route.test.ts › service not_found maps to 404`; `layout.db.test.ts › foreign org room is 404` |
| 5 | The response never contains a raw Identity `sub`. | `layout.db.test.ts › seat status from real rows` asserts `JSON.stringify(res)` contains neither member's `sub`; code review: no `o.sub` in any select list |
| 6 | Corrupt stored floors, grid or sprite keys never break the read. | `layout.db.test.ts › corrupt grid`, `› oversized or bad floor_zones`, `› long or unknown sprite keys`; `resolve-layout.test.ts › take guard › five bad shapes` |
| 7 | DB tests cover org scoping, the read, and a concurrent commit between two reads. Route tests cover 404, 503 and `no-store`. | `layout.db.test.ts › concurrent commit between reads is not seen`; `route.test.ts` cases; local run of `node scripts/test-db.mjs` and `pnpm test` recorded in impl-log |
| — | Route path exists | `pnpm build` output lists `ƒ /api/rooms/[id]/layout`; recorded in impl-log |
| — | Route is guarded | existing `src/app/api/routes-guarded.test.ts` picks up the new `route.ts` automatically |

## Ming verification after merge
None. This ticket has no UI; GitHub CI may be unavailable (billing), so local evidence from `node scripts/test-db.mjs`
on the compose Postgres is recorded in impl-log instead.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/layout/layout.ts` | Create: `getRoomLayout` service, row types, row-to-`Stored*` mappers | Ticket scope; fixed design | No |
| `src/server/layout/layout.db.test.ts` | Create: DB integration tests | AC1-AC7 | No |
| `src/app/api/rooms/[id]/layout/route.ts` | Create: `GET` only | Ticket scope; A2 path | No |
| `src/app/api/rooms/[id]/layout/route.test.ts` | Create: route tests (404, 503, no-store, refusal mapping) | AC4, AC7 | No |
| `src/lib/sprites/resolve-layout.ts` | Modify `take` (line 68): type guard as first statement; line 94 `!== null` to `!= null` | Security review 🟡 1, ticket Technical notes | No |
| `src/lib/sprites/resolve-layout.test.ts` | Add `take guard` describe (five shapes) and a registry key length check | Security review 🟡 1 and finding 2 (129 must exceed every key) | No |

No High path is touched (`.claude/loop.config.md` High paths: none of these match).

## Data model / migration
None. `db/migrations/20261122120000_room_tile_layout.sql` already provides `rooms.grid_w/grid_h/floor_zones/layout_version`
and `tile_x/tile_y/tile_rotation/sprite_key` on `seats` and `layout_fixtures`. Relevant constraints: placement fields
are all null or all set (lines 19, 32); `floor_zones` is always a jsonb array (line 11); `grid_w/grid_h > 0` but no upper
bound (line 10), so a grid above 64 is a reachable corrupt state.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/rooms/{id}/layout` | none | `LayoutResponse` (`src/lib/sprites/layout.ts:35-43`), header `Cache-Control: no-store` | 200; 401/403 (wrapper only, R7); 404 `not_found` (non-canonical uuid, missing room, other org); 503 `unavailable` (no pool; the wrapper also emits 503 for config/JWKS/member gate); 500 `internal` (wrapper, thrown error) | `withAuth(..., { tier: "user" })`: any org member |

Field rules (explicit fields only, no row spread):

- `room`: `{ id, code, name }` from the room row.
- `version`: always the stored `rooms.layout_version` (see Assumptions, OQ1).
- `saved`, `layout`, `unplaced`: from `resolveLayout(room, seats, fixtures)`.
- `truncated`: seat rows fetched with `limit 501`; `truncated = rows.length > 500`; rows sliced to 500 before resolving.
- `seatViews`: one entry per returned seat (the 500 at most), keyed by seat id, including seats in `unplaced`, built with
  `seatViewOf({ cannotSeat: s.cannot_seat, mine: s.mine, occupantId: s.occupant_id, occupantName: s.display_name })`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/sprites/resolve-layout.test.ts › take guard › x 0.5, x null, x "1", x 1n and placement undefined never throw and never keep their place` | Security 🟡 1. Each shape on a saved 12×8 room: no throw; the seat lands on a free slot with integer coords (or in `unplaced`); a fixture with the shape is dropped |
| `src/lib/sprites/resolve-layout.test.ts › every registry key is shorter than 129 characters` | The `left(sprite_key, 129)` cut always fails the registry lookup |
| `src/app/api/rooms/[id]/layout/route.test.ts › non-canonical id is 404 without getPool or the service` | AC4, R7 |
| `route.test.ts › no pool gives 503 unavailable and the service is not called` | AC7 (503) |
| `route.test.ts › success is 200 with Cache-Control no-store and passes ctx.scope, ctx.sub and id` | AC7 (no-store) |
| `route.test.ts › service not_found maps to 404 not_found` | AC4 |
| `route.test.ts › no Authorization gives 401 and the service is not called` | R7 |
| `src/server/layout/layout.db.test.ts › unsaved room returns the default and writes nothing` | AC2: `saved: false`, `version: 0`, every seat in `layout.seats` (none in `unplaced`), `seatViews` for all; rooms, seats, layout_fixtures and audit_log rows identical before and after |
| `layout.db.test.ts › saved room round trip` | AC1: grid, floors, seat placements and a sprite-keyed fixture written by SQL come back as stored; `saved: true`; `version` equals the stored value |
| `layout.db.test.ts › saved room: a seat with null placement takes a free slot` | AC2 "seats stay reachable" in a saved room (LAY-06 derived position) |
| `layout.db.test.ts › seat status from real rows` | AC1, AC5: caller's seat `mine`, another member `occupied` with `avatarSeed` = member id and `name` = display name, cannot-seat with occupant `cannot` keeping seed and name, empty seat `empty`; `JSON.stringify(res)` contains no member `sub` |
| `layout.db.test.ts › foreign org room is 404; random uuid is 404` | AC4, R6 |
| `layout.db.test.ts › legacy fixture rows are hidden` | A12: a `kind = 'door'`, `sprite_key` null row is absent from `layout.fixtures` |
| `layout.db.test.ts › corrupt grid (65 × 65) gives the default with saved false and the stored version` | AC6, SIM-015.4 assumption 2 |
| `layout.db.test.ts › oversized or bad floor_zones fall back to the default floor` | AC6, security finding 2: 65 zones; ≤64 zones over 262,144 bytes; a zone with an extra key. Via the recording client, the first two arrive from SQL as `null` |
| `layout.db.test.ts › long or unknown sprite keys never break the read` | AC6, finding 2: a seat with a 10,000-char key moves to a free slot as `desk.single`; a fixture with a long key and one with `__proto__` are dropped; via the recording client the long key arrives as 129 chars |
| `layout.db.test.ts › 500 seats not truncated, 501 truncated to the first 500` | AC3: 501 case has `truncated: true`, 500 `seatViews`, `layout.seats.length + unplaced.length === 500`, seq 501 absent |
| `layout.db.test.ts › runs begin, set transaction repeatable read read only, then reads, then commit` | AC7: the isolation statement is literally the second statement on the client (recording client) |
| `layout.db.test.ts › concurrent commit between reads is not seen` | AC7: after the room select resolves, the test commits on another connection (occupant set on seat 1, a new seat inserted, a fixture inserted); the service result still shows seat 1 empty and neither new row. Fails under read committed, so it proves the snapshot |

## Approach
1. **`resolve-layout.ts`** (`src/lib/sprites/resolve-layout.ts:68`): insert as the first statement of `take`:
   `if (typeof p !== "object" || p === null || typeof p.sprite !== "string" || !isInt(p.x) || !isInt(p.y) || !isInt(p.rotation)) return false;`
   (`isInt` already exists at line 19). Change line 94 to `s.placement != null && take(...)`. Add the tests above in
   `resolve-layout.test.ts` (cast bad shapes `as never`).
2. **Service `src/server/layout/layout.ts`**, first line `import "server-only"` (R1). Imports: `withTx`, `TxPool`,
   `TxClient` from `@/server/db/tx`; `orgQuery`, `OrgScope` from `@/server/http/org-scope`; `resolveLayout` and the
   `Stored*` types from `@/lib/sprites/resolve-layout`; `seatViewOf` from `@/lib/sprites/seat-view`; `LayoutResponse`,
   `SeatView` from `@/lib/sprites/layout`; `LAYOUT_LIMITS` from `@/lib/validate/layout`.
   - Local result type (do not import seats' `Refusal`):
     `export type LayoutRefusal = { ok: false; status: 404; code: "not_found" }`,
     `export type LayoutResult<T> = { ok: true; value: T } | LayoutRefusal`. SIM-015.5 widens it.
   - `export async function getRoomLayout(pool: TxPool, scope: OrgScope, sub: string, roomId: string): Promise<LayoutResult<LayoutResponse>>`.
   - Inside `withTx(pool, async (c) => ...)`: first `await c.query("set transaction isolation level repeatable read, read only")`
     (not via `orgQuery`, it has no org filter), then three `orgQuery` calls on `c`. The callback returns
     `LayoutResponse | null`; `null` (no room row) becomes `{ ok: false, status: 404, code: "not_found" }` after the
     commit. One code path, no `Abort` needed because nothing is written.
   - Room SQL (`$2` = roomId):
     `select id, code, name, grid_w, grid_h, case when jsonb_typeof(floor_zones) = 'array' and jsonb_array_length(floor_zones) <= 64 and octet_length(floor_zones::text) <= 262144 then floor_zones end as floor_zones, layout_version from rooms where org_id = $1 and id = $2`.
     Use `${LAYOUT_LIMITS.floors}` and `${LAYOUT_LIMITS.bodyBytes}` (64 and 262,144) rather than literals.
   - Seats SQL (`$2` = roomId, `$3` = sub):
     `select s.id, s.code, s.cannot_seat, s.occupant_id, o.display_name, coalesce(o.sub = $3::uuid, false) as mine, s.tile_x, s.tile_y, s.tile_rotation, left(s.sprite_key, 129) as sprite_key from seats s left join members o on o.org_id = s.org_id and o.id = s.occupant_id where s.org_id = $1 and s.room_id = $2 order by s.seq, s.id limit ${LAYOUT_LIMITS.seats + 1}`.
     Never select `o.sub` (AC5).
   - Fixtures SQL: `select id, tile_x, tile_y, tile_rotation, left(sprite_key, 129) as sprite_key from layout_fixtures where org_id = $1 and room_id = $2 and sprite_key is not null order by id limit ${LAYOUT_LIMITS.fixtures}`.
   - Mappers (module-private): a seat's `placement` is `{ sprite, x, y, rotation }` only when all four columns are
     non-null, else `null` (unplaced seat to `null`, Technical notes). A fixture row maps the same way and is skipped if
     any field is null (cannot happen given the constraint, cheap defence). `StoredRoom` is
     `{ gridW: grid_w, gridH: grid_h, floorZones: floor_zones }`.
   - Build the response with explicit fields as in `## API contract`. `seatViews` keys come from the sliced rows;
     `avatarSeed` is `s.occupant_id` (D59, A7).
3. **Route `src/app/api/rooms/[id]/layout/route.ts`**: copy `GET` from `src/app/api/rooms/[id]/seats/route.ts:9-24`:
   `export const dynamic = "force-dynamic"`, `NO_STORE`, `withAuth<{ id: string }>(..., { tier: "user" })`,
   `isCanonicalUuid(id)` else `apiError(404, "not_found")`, `getPool()` null gives `apiError(503, "unavailable")`,
   `r.ok` false gives `apiError(r.status, r.code)`, success `Response.json(r.value, { headers: NO_STORE })`. Export GET
   only. No 401/403 from the handler (R7).
4. **Route test** `route.test.ts`: follow `src/app/api/seats/seats-routes.test.ts:1-58` (`fakeAuth`, `vi.hoisted`), but
   mock `@/server/db/pool` with a hoisted `getPool: vi.fn()` so one case returns `null` (503) and the bad-id case
   asserts `getPool` was not called. Mock `@/server/layout/layout` (`getRoomLayout: vi.fn()`).
5. **DB test** `layout.db.test.ts`: follow `src/server/seats/seats.db.test.ts:1-67` (`testPool`, `assertTestDb`,
   `newOrg`, `addRoom`, `addMember`, `addSeat`). Set grid, floors, placements, legacy and tile fixtures, and corrupt
   values with direct SQL on `pool` (fixtures need no new helpers; keep helpers local to the test file). Bulk seats via
   `insert ... select ... from generate_series(1, n)`. A small test-local **recording pool** wraps `pool.connect()`:
   its client records each `query` text and result rows, and can run an `afterQuery(text)` hook. The concurrent test
   uses the hook after the room select to commit writes through `pool.query` (another connection).
6. Run the Checks (`pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`) and
   `node scripts/test-db.mjs` with fnm Node 22 against the compose Postgres; record outputs and the `pnpm build` route
   line in impl-log.

Rules: R1 (service under `src/server/**` with `server-only`; route is the only entry; lib stays pure), R6 (every query
through `orgQuery` with `org_id = $1`, the members join repeats `o.org_id = s.org_id`), R7 (handler emits only
404/503; read-only, so no side effect at all), R3 (no config), R4 (files above only), R5 (tests listed). R2 not
applicable (no migration).

## Specialist input used
From `consult-api-platform-engineer.md`:

- Adopted: findings on paths and building blocks (all confirmed against code: `seats.ts:21-32`, `tx.ts:10-27`,
  `org-scope.ts:15-25`, seats route `:9-24`).
- Adopted: rec 1 (explicit fields, `limit 501` then slice, `seatViews` for every returned seat), rec 3 (service
  signature, isolation as first statement, 404 inside the single tx path), rec 4 with `octet_length(floor_zones::text)`
  per its own risk note and the security review, rec 5 and 6 (`left(..., 129)`, `occupant_id` seed, `mine` in SQL),
  rec 7, rec 8, rec 9 (all tests).
- Rejected: rec 2 "set `version` to 0 when the default is used". It contradicts SIM-015.4 assumption 2 (stored version
  is returned so a later PUT passes the stale check, A8). `version` is always the stored value.
- Risk "prove the snapshot": adopted as two tests (statement order, and a concurrent commit that would be visible under
  read committed).
- Open questions resolved under `## Assumptions`.

## Assumptions
Consult open questions, resolved from the scope sources:

1. **`saved` vs `version`:** `saved` follows `resolveLayout` (valid stored grid), matching A9 ("`grid_w` null means
   unsaved") and the contract comment "false = computed default". `version` is always `rooms.layout_version`
   (SIM-015.4 assumption 2, A8). A grid with version 0 only arises from direct SQL (SIM-015.5's PUT sets both), and the
   pair is still consistent for the stale check. Tested in `saved room round trip` (stored version echoed) and
   `corrupt grid` (saved false, stored version).
2. **Truncated `seatViews` and `unplaced`:** only the 500 returned seats; `resolveLayout` also slices to 500
   (`resolve-layout.ts:55`), so `unplaced` is within them.
3. **`seatViews` for unplaced seats when truncated:** yes, for every returned seat; none for seats past 500.
4. **Refusal type:** a layout-local `LayoutResult` with only 404 `not_found` (above). Avoids coupling to seats' codes;
   SIM-015.5 extends it.
5. **500 mapping:** `withAuth` already returns 500 `internal` for thrown errors and is covered by
   `src/server/http/with-auth.test.ts`; the ticket asks for 404, 503 and `no-store` route tests only. No extra test.

Other assumptions:

- `ctx.sub` is a uuid string, as `listRoomSeats` already casts it with `$2::uuid` (`seats.ts:110`).
- A seat whose stored placement is invalid in a saved room gets a derived position on a free slot (LAY-06 "never
  hidden", A9). The response does not mark which positions are derived; the editor (SIM-015.2) saves them as placed.
- **Size:** about 480 changed lines (about 140 production, 340 tests). Over the ~400 guide only because of tests;
  production code is small and SIM-015.4 already sized this slice at ~390. No split.
- **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (`work/backlog.md`). SIM-015.5 and SIM-015.3 will
  later build on `src/server/layout/layout.ts` and the route file.
- `src/app/api/routes-guarded.test.ts` scans every `route.ts` and will cover the new route's `WITH_AUTH_MARK` with no
  change; `route.test.ts` next to it is not a route (precedent: `src/app/api/rooms/route.test.ts`).
- Spec LAY-06 line 362 still says "derived from `sub`"; D59 supersedes it (already flagged by SIM-015.4). Not edited
  here.

## Blocking questions
None.

## Split proposal
None.
