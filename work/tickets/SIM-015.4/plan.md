Status: READY

# Plan — SIM-015.4: Default room layout and layout read API

> **For the orchestrator:** the whole ticket is about 840 changed lines, about twice the ~400-line guide. This plan
> implements **Slice 1 only: the pure read logic, with no endpoint**. The GET route moves to a proposed **SIM-015.6**,
> whose design is fixed under `## Split proposal`. Before this ticket is closed, create SIM-015.6, move the remaining
> acceptance criteria to it, and repoint SIM-015.3 and SIM-015.5 to depend on it. No High path is touched by either slice.

## Scope summary

Ticket (`work/tickets/SIM-015.4/ticket.md:27-31`):
> A pure `defaultLayout` in `src/lib/sprites/default-layout.ts`, using the plan's grid rule.
> `GET /api/rooms/{id}/layout` for any org member, returning `LayoutResponse`.
> Read in one `repeatable read, read only` transaction, scoped by the verified token's org (R6).
> Seat status derived, never read from storage. The avatar seed is the member id, and raw `sub` is never returned.
> In a saved room, a seat with no valid placement takes the first free slot, or is listed in `unplaced`.

Ticket security notes (`ticket.md:49-50`):
> treat stored `floor_zones` as untrusted on read. Re-validate shape, bounds, known sprite and a total-cell cap, and fall
> back to the default floor.
> treat stored `sprite_key` as untrusted on read. Look it up in the registry and handle an unknown key without crashing
> the room view.

Approved contract (`work/tickets/SIM-015.1/plan.md:220-226`, D59):
> `cols = clamp(ceil(sqrt(n)), 4, 21)`, `rows = max(ceil(n / cols), 1)`, `w = max(12, cols × 3)`, `h = max(8, rows × 2)`.
> Seats in `seq` order, `desk.single` rotation 0, at a 3 × 2 tile pitch (desk row, chair row).
> One `floor.wood` zone over the room, no fixtures.
> In a **saved** room, a seat with null placement or a stored sprite that no longer exists takes the first free pitch
> slot that passes the same rules; otherwise it goes to `unplaced`.
> Required test: the default output passes `checkLayoutRules`, so an Admin can save it unchanged.

`SeatView.state` precedence (`SIM-015.1/plan.md:187-189`):
> `cannot`, then `mine`, then `occupied`, then `empty`. A cannot-seat seat that still has an occupant keeps its
> `avatarSeed` and `name` ... `pending` is not emitted until SIM-014.

Floor cap (`work/tickets/SIM-015.5/ticket.md:47`):
> cap total floor cells at twice the grid area, with a test for 64 full-grid zones

Spec: LAY-01 (`docs/spec-v1.md:338-343`), LAY-06 (`:357-363`), Room view (`:365-367`), SEA-02 (`:235-236`).

## Acceptance criteria → verification

Slice 1 (this plan):

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 3 | "The default layout passes the SIM-015.1 layout rules, so an Admin can save it unchanged." | `default-layout.test.ts › passes checkLayoutRules for every size` and `› maps to a payload validateLayoutSave accepts` |
| 7a | "Unit tests cover `defaultLayout`" | `pnpm test` runs `src/lib/sprites/default-layout.test.ts` |
| 1a | Pure part of AC1: each seat's placement and derived status, and the fixtures | `resolve-layout.test.ts › saved room`, `seat-view.test.ts` |
| 1b | Pure part of AC1 and the ticket's security notes: untrusted stored floors and sprites never crash the read | `resolve-layout.test.ts › corrupt floors`, `› corrupt sprites`, `› output always passes the rules` |
| 2a | Pure part of AC2, "its seats stay reachable": every seat is placed or listed in `unplaced` | `resolve-layout.test.ts › unsaved`, `› free slots` |
| 4a | Pure part of AC4: at most 500 seats are laid out | `default-layout.test.ts › lays out at most 500 seats`, `resolve-layout.test.ts › caps seats and fixtures` |
| 6a | Pure part of AC6: the seed is the member id, and the view has no `sub` | `seat-view.test.ts › seed is the occupant member id` |

Delivered by SIM-015.6 (not reviewed here): AC1 (GET for the caller's org only), AC2 (no write on read), AC4 (`truncated`),
AC5 (404), AC6 (response has no `sub`), AC7 (DB integration tests).

Evidence must come from local runs. GitHub CI is not running (billing failure), so a missing or red CI status is neither
a pass nor a failure for this ticket.

## Ming verification after merge

None. Slice 1 adds no endpoint or UI.

## Files to create / modify

Slice 1 only. The implementer must not touch anything else without recording why.

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/layout.ts` | Add `LayoutResponse` after line 32, exactly as in `SIM-015.1/plan.md:167-175` | Shared contract for the route and SIM-015.3 (R1) | No |
| `src/lib/validate/layout.ts` | Add `floorCells: 2` to `LAYOUT_LIMITS` (line 8) and export `floorCellsWithinCap` | One cap definition for this read and SIM-015.5's save | No |
| `src/lib/validate/layout.test.ts` | Add a `floorCellsWithinCap` group | New logic has tests (R5) | No |
| `src/lib/sprites/default-layout.ts` | Create: `defaultLayout` | Ticket scope | No |
| `src/lib/sprites/default-layout.test.ts` | Create | AC3, AC7 | No |
| `src/lib/sprites/seat-view.ts` | Create: `seatViewOf` | Pure logic first; status is derived (SEA-02) | No |
| `src/lib/sprites/seat-view.test.ts` | Create | AC1, AC6 | No |
| `src/lib/sprites/resolve-layout.ts` | Create: `parseStoredFloors`, `resolveLayout` | Untrusted-read rules as pure, testable code | No |
| `src/lib/sprites/resolve-layout.test.ts` | Create | AC1, AC2, ticket security notes | No |

Not changed: `src/server/**` (including `src/server/http/**` and `src/server/db/tx.ts`), `db/migrations/**`, config,
`src/lib/sprites/placement.ts`, `src/ui/**`, and `checkLayoutRules` itself (SIM-015.5 wires the cap into the save).

## Data model / migration

None. `db/migrations/20261122120000_room_tile_layout.sql` already provides every column.

## API contract

None in Slice 1. `LayoutResponse` is added as a type only. The GET contract is unchanged from `SIM-015.1/plan.md:163,167-175`.

Pure interfaces this slice fixes:

```ts
// src/lib/validate/layout.ts. Precondition: every zone is already bounds-checked.
export function floorCellsWithinCap(floors: readonly FloorZone[], w: number, h: number): boolean;
// true when the sum of z.w * z.h <= w * h * LAYOUT_LIMITS.floorCells

// src/lib/sprites/default-layout.ts
export function defaultLayout(seats: readonly { id: string; code: string }[]): RoomLayout;

// src/lib/sprites/seat-view.ts
export function seatViewOf(s: {
  cannotSeat: boolean; mine: boolean; occupantId: string | null; occupantName: string | null;
}): SeatView;

// src/lib/sprites/resolve-layout.ts
export type StoredPlacement = { sprite: string; x: number; y: number; rotation: number };
export type StoredSeat = { id: string; code: string; placement: StoredPlacement | null };
export type StoredFixture = StoredPlacement & { id: string };
export type StoredRoom = { gridW: number | null; gridH: number | null; floorZones: unknown };

export function parseStoredFloors(raw: unknown, w: number, h: number): FloorZone[];
export function resolveLayout(
  room: StoredRoom,
  seats: readonly StoredSeat[],     // in (seq, id) order
  fixtures: readonly StoredFixture[],
): Pick<LayoutResponse, "saved" | "layout" | "unplaced">;
```

## Tests to write

| Test (file › name) | Covers |
|---|---|
| `default-layout.test.ts › sizes` for n → w×h: 0→12×8, 1→12×8, 16→12×8, 17→15×8, 21→15×10, 100→30×20, 441→63×42, 442→63×44, 500→63×48 | Grid formula, clamp edges |
| `› places seats in input order on the 3×2 pitch` | Seat order, pitch |
| `› uses desk.single at rotation 0, one floor.wood zone over the room, no fixtures` | Contract |
| `› keeps id and code, including Vietnamese diacritics in a code` | Domain focus |
| `› passes checkLayoutRules for every size` (n in 0, 1, 4, 16, 17, 100, 441, 442, 500) | AC3 |
| `› maps to a payload validateLayoutSave accepts` (drop `code` from seats, `baseVersion: 0`, canonical uuids) | AC3, "save it unchanged" |
| `› is deterministic` | Stable default |
| `› lays out at most 500 seats` (n = 501) | Pagination bound |
| `seat-view.test.ts › precedence` (cannot over mine, cannot over occupied, mine over occupied, empty) | SIM-015.1 rule |
| `› cannot-seat with an occupant keeps seed and name` | SIM-015.1 rule |
| `› seed is the occupant member id` and `› empty has null seed and name` | AC6, null fields |
| `› never emits pending` | Out of scope (SIM-014) |
| `layout.test.ts › floorCellsWithinCap › accepts exactly twice the grid area` | Cap boundary |
| `› refuses one cell above twice the grid area` | Cap boundary |
| `› refuses 64 full-grid zones` | SIM-015.5 / security finding 1 |
| `› accepts one full-grid zone` | The default floor stays valid |
| `resolve-layout.test.ts › unsaved › null grid gives the default with saved false and ignores stray placements and fixtures` | A9, consult risk |
| `› unsaved › grid above 64 gives the default with saved false` | Untrusted grid |
| `› saved room › returns valid floors, seats and fixtures as stored, in input order` | AC1 |
| `› saved room › an empty floors array stays empty` | `[]` is a legal save |
| `› corrupt floors › each gives the single default floor`: non-array, over 64 zones, non-object element, missing key, extra key, string or float coordinate, `1e400`-style non-safe value, unknown sprite, directional or non-floor sprite, out of bounds, over the cell cap | Ticket security note |
| `› corrupt floors › output zones contain only the five known keys` | No passthrough of stored data |
| `› corrupt sprites › seat with constructor, __proto__, desk.pair, desk.single.e or a retired key moves to a free slot` | Ticket security note |
| `› corrupt sprites › fixture with constructor, __proto__, door.e, floor.wood or a retired key is dropped` | Ticket security note |
| `› corrupt placement › out-of-bounds seat, chair outside the room, and non-zero rotation on a single-frame fixture are handled` | Bounds and A3 |
| `› overlap › of two seats on one tile, the first in seq order stays and the second moves` | Determinism |
| `› overlap › a blocking fixture on a seat or its chair is dropped, the seat stays` | Seats stay reachable |
| `› overlap › a non-blocking fixture may share a seat or chair tile` | Must match the rules, A5 |
| `› free slots › a seat with null placement takes the first free slot and avoids kept fixtures and chairs` | Plan rule |
| `› free slots › uses the last column when only 2 tiles remain (w = 5 gives x = 0 and x = 3)` | Slot bound |
| `› free slots › no free slot lists the seat in unplaced with id and code` | AC "reachable" |
| `› caps seats and fixtures at 500 and 2,000` | Pagination bound |
| `› output always passes the rules` (run `checkLayoutRules` on the output of every corrupt case above) | Core invariant |

## Approach

1. **`LayoutResponse`** in `src/lib/sprites/layout.ts`, copied from the approved contract.
2. **Floor cap** in `src/lib/validate/layout.ts`: add `floorCells: 2` and `floorCellsWithinCap`. Callers check bounds first,
   so the sum cannot be inflated by out-of-range values.
3. **`defaultLayout`**: slice the input to `LAYOUT_LIMITS.seats`, compute the grid from the sliced length, then place seat
   `i` at `x = 3 * (i % cols)`, `y = 2 * floor(i / cols)`. Use the array index, never `seq`, because `seq` can have gaps.
4. **`seatViewOf`**: state by the approved precedence. `avatarSeed = occupantId`, `name = occupantName`.
5. **`parseStoredFloors`**, all-or-nothing:
   - Not an array, or more than `LAYOUT_LIMITS.floors` entries: default floor. Check the length **before** iterating.
   - Each element must be a plain object with exactly `sprite, x, y, w, h`, a string sprite and safe integers.
     `checkLayoutRules` does not check integers, so this step is required.
   - Each zone must pass `checkLayoutRules({ w, h, floors: [zone], seats: [], fixtures: [] })`.
   - The total must pass `floorCellsWithinCap`.
   - Build each output zone from the five named fields. Any failure returns `[{ sprite: "floor.wood", x: 0, y: 0, w, h }]`.
6. **`resolveLayout`**:
   1. Slice seats to 500 and fixtures to 2,000.
   2. If the grid is null or fails `checkLayoutRules({ w, h, floors: [], seats: [], fixtures: [] })`, return
      `defaultLayout(seats)` with `saved: false` and `unplaced: []`.
   3. Keep one `occupied` set of cells (`y * w + x`), holding blocking footprints and chair tiles. A desk or blocking
      fixture is accepted only if all its cells are free. This matches `checkLayoutRules:149-165` exactly: a chair may
      not be on a blocking tile or another chair, and a non-blocking item conflicts with nothing.
   4. **Stored seats first**, in input order. Each must pass a one-item `checkLayoutRules` (sprite, rotation, bounds,
      chair bounds) and be free in `occupied`. Otherwise it waits for a slot.
   5. **Stored fixtures next**, in input order. Each must pass a one-item check. A blocking one must also be free.
      Otherwise it is dropped. Fixtures go before slot-filling so a relocated seat never displaces a valid fixture.
   6. **Waiting seats last**, in input order, on pitch slots in row-major order (`y = 0, 2, ...` while `y + 2 <= h`;
      `x = 0, 3, ...` while `x + 2 <= w`). Keep one cursor, because a rejected slot stays rejected as `occupied` only
      grows. No slot left: add `{ id, code }` to `unplaced`.
   7. Output seats in input order, built from named fields. Never throw on stored data.
   - Reuse `footprintOf`, `resolveFrameKey`, `chairFor`, `ROTATION_TO_DIR` and `REGISTRY`. Do not copy them.
7. Run the checks locally and paste the results into `impl-log.md`:
   ```bash
   eval "$(fnm env --shell bash)" && fnm use --silent-if-unchanged
   pnpm format:check && pnpm typecheck && pnpm check:layers && pnpm test && pnpm build
   ```
   Slice 1 has no SQL or server code, so `node scripts/schema-check.mjs` and `node scripts/test-db.mjs` are not needed here.

Rules: **R1** all new code is pure `src/lib`, importing only lib. **R2** no schema change. **R3** no config or secrets.
**R4** the file list above. **R5** every new function has unit tests. **R6, R7** not reached in this slice; SIM-015.6 meets
them with the design below.

## Specialist input used

Checked against the code. Confirmed: the route, service and `orgQuery` patterns, `withTx` having no isolation option, the
500-seat limit, the migration facts, `desk.single` footprint and chair position, and the prototype-safe lookups.

Adopted: per-item reuse of `checkLayoutRules` instead of widening the validator's private helpers; replace-whole on bad
floors; no grid growth; default layout for an invalid stored grid while keeping the stored `version`; dropping invalid
fixtures; excluding legacy fixture rows; explicit response fields.

Corrected or rejected:

| Consult item | Decision | Why |
|---|---|---|
| Test sizes: "12×8 for the small cases" including n = 17 | **Corrected** | The formula gives `cols = 5`, so 17 seats is **15×8**. 100 seats is 30×20. |
| Floor cap of `64*64*64` or 4,096 cells | **Rejected** | SIM-015.5 caps at twice the grid area. A looser read cap would let through the browser-hang payload from security finding 1. |
| Whole-layout `checkLayoutRules`, then greedy repair | **Replaced** | One `occupied` set gives the same answer in linear work. |
| Fixture query `limit 2001` | **Corrected** (SIM-015.6) | Fixtures have no `truncated` flag, so `limit 2000` is enough. |
| Snapshot test by statement-order spy only | **Strengthened** (SIM-015.6) | A wrapped pool can commit a real concurrent update between two reads, which proves the snapshot. |
| Test that a write fails in a read-only transaction on a direct client | **Rejected** | It tests PostgreSQL, not this code. |
| `set transaction ... repeatable read read only` | **Adjusted** (SIM-015.6) | Use the documented comma form: `repeatable read, read only`. |

## Assumptions

Consult open questions, resolved:

1. **Floor-cell cap:** total cells, counting overlaps, at most `2 × w × h`, the same as SIM-015.5.
2. **Invalid stored grid:** return the default with `saved: false` and the stored `version`, so the view works and a later
   save still passes the stale check.
3. **One bad floor zone:** replace the whole array with the default floor. Partial data is not trustworthy, and one rule
   is simpler to test.
4. **Free slots:** the existing grid only. The grid never grows on read.
5. **Name on a cannot-seat seat:** shown to every member, as the approved contract says. The seat list already exposes
   `display_name` to members.
6. **Extra files:** `seat-view.ts` and `resolve-layout.ts` follow "pure logic first" and are within this ticket's scope.

Other assumptions:

- **Priority on conflict:** seats beat fixtures, because seats must stay reachable.
- **Dropped fixtures:** an invalid fixture is hidden on read, and the next Admin save removes it, since PUT replaces all
  sprite-keyed fixtures. This affects only corrupt or retired-key rows.
- **For SIM-015.2:** PUT requires the exact seat set (A11), and `unplaced` seats are not in `layout.seats`. The editor must
  place them before saving, or the save gets `layout_seats_changed`.
- **Spec wording conflict, flagged:** LAY-06 (`docs/spec-v1.md:362`) still says avatar colours come from `sub`. D59 is
  Ming's later decision and explicitly supersedes that wording in D44 and D51, so this plan uses the member id. The spec
  line should be updated outside this ticket.
- **Hotspots:** no ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board. SIM-015.5 will later edit
  `src/lib/validate/layout.ts` and should call `floorCellsWithinCap` rather than define its own cap.

## Blocking questions

None.

## Split proposal

Estimated at about 840 changed lines (about 335 production, 505 tests). Each slice is one PR:

| Slice | Contents | Est. lines | ACs | High path |
|---|---|---|---|---|
| **1. SIM-015.4 (this plan)** | Shared type, floor cap, `defaultLayout`, `seatViewOf`, `resolveLayout`, unit tests | ~450 (about 235 are tests) | 3, 7a, pure parts of 1, 2, 4, 6 | No |
| 2. Proposed SIM-015.6 | `src/server/layout/layout.ts`, GET route, DB and route tests | ~390 (about 270 are tests) | 1, 2, 4, 5, 6, rest of 7 | No |

Dependencies after the split: SIM-015.6 depends on SIM-015.4; **SIM-015.3 and SIM-015.5 depend on SIM-015.6**. The
orchestrator makes these board and ticket changes on `main`; this plan does not edit them.

**Fixed design for SIM-015.6** (its planner confirms it against the code):

- **Route** `src/app/api/rooms/[id]/layout/route.ts`: copy `GET` from `src/app/api/rooms/[id]/seats/route.ts:9-24`
  (`withAuth`, `tier: "user"`, canonical uuid or 404, pool or 503, `no-store`, `force-dynamic`).
- **Service** `getRoomLayout(pool, scope, sub, roomId): Promise<Result<LayoutResponse>>` in `src/server/layout/layout.ts`,
  starting with `import "server-only"`. Uses `withTx` unchanged. The **first** statement inside it is
  `set transaction isolation level repeatable read, read only`. All reads use `orgQuery` on that client.
- **Queries:**
  - Room: `select id, code, name, grid_w, grid_h, floor_zones, layout_version from rooms where org_id = $1 and id = $2`.
    No row gives 404, the same answer for a foreign org.
  - Seats: `select s.id, s.code, s.cannot_seat, s.occupant_id, o.display_name, coalesce(o.sub = $3::uuid, false) as mine,
    s.tile_x, s.tile_y, s.tile_rotation, s.sprite_key from seats s left join members o on o.org_id = s.org_id and
    o.id = s.occupant_id where s.org_id = $1 and s.room_id = $2 order by s.seq, s.id limit 501`.
    Slice to 500 and set `truncated`.
  - Fixtures: `select id, sprite_key, tile_x, tile_y, tile_rotation from layout_fixtures where org_id = $1 and
    room_id = $2 and sprite_key is not null order by id limit 2000`.
- **Response:** explicit fields only, with `seatViews` for every returned seat, including unplaced ones.
- **DB tests** (`src/server/layout/layout.db.test.ts`): unsaved room writes nothing; saved round trip; foreign room 404;
  status with real rows; serialized response has no `sub`; corrupt stored data; legacy fixture hidden; 500 and 501 seats;
  a real concurrent commit between two reads does not change the result.
- **Route tests:** bad uuid gives 404 without touching the pool; no pool gives 503; `no-store` is set.
- **Local evidence:** with fnm activated, the Slice 1 checks plus `node scripts/test-db.mjs` against the local Docker
  Postgres. `pnpm build` confirms the `[id]/layout` route path. CI is not the only evidence.
