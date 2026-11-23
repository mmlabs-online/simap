Status: READY

# Plan — SIM-015.5: Save a room layout through the API

> **High paths touched: NONE.** Every file below was checked against `.github/risk-tiers.yml` and `.claude/loop.config.md`.
> Expected PR tier: **Medium**. No migration, no `*.sql`, nothing under `src/server/http/**` or `src/server/identity/**`.
> If the implementation seems to need a High path (for example a change to `orgQuery`), **stop and escalate**.
>
> **Plan gate:** this is a P1 ticket, so policy would stop here. `ticket.md:58` records Ming's waiver for this ticket
> ("chạy luôn SIM-015.5 k cần duyệt plan"). Ming still reviews and merges the PR.
>
> **DB verification is CI-only.** This machine has no docker, so `pnpm test:db` **cannot run locally**. Every DB test in
> this plan is verified only by the `ci` job's `db integration tests` step on the PR. See `## Acceptance criteria`.

## Scope summary

Ticket (`ticket.md:27-30`):
> `PUT /api/rooms/{id}/layout` for Admin, with a 256 KiB body limit, validated before any transaction.
> One transaction in the plan's lock order: room, seats, seat placement, placed fixtures, room grid and floors, version,
> one counts-only audit row.
> Refusals `layout_stale`, `layout_seats_changed` and `layout_too_many_seats`.

Out of scope (`ticket.md:33-34`):
> Creating or deleting seats through the save (LAY-02, decided in SIM-015.2's plan). Any migration or editor UI.

Spec (`docs/spec-v1.md`):
> LAY-01 (:339-343) "A room has a size in tiles (width × height). An Admin opens the room's editor, places items on whole
> tiles and saves. Positions survive reloads and sessions... Items cannot overlap where the manifest says they block."
> LAY-03 (:350-351) "An Admin adds, moves, rotates and deletes fixtures from the sprite palette... They are saved with the room."
> SEA-02 (:236) "Every view shows a seat as empty or occupied, computed from its occupant. No status column exists."

Decisions (`work/decisions.md`):
> D43 (:50) "The editor places items on whole 16 px tiles, 4 rotations, fixed sprite sizes; a room has a size in tiles."
> D48 (:55) "Tile size 32 px... editor logic unchanged (whole tiles, 4 rotations)."
> D58 (:65) "D47 is lifted for the room map tickets."
> D59 (:66) "Plan for SIM-015.1 approved with defaults A1-A14... API by room id... a stale save gets 409."

Approved contract (`work/tickets/SIM-015.1/plan.md`, not decided again):
> :164 "PUT (Slice 3) | `/api/rooms/{id}/layout` | `LayoutSave`, max 256 KiB | `LayoutResponse` with the new `version` |
> 200, 400, 401/403 (wrapper only), 404, 409, 422, 503 | `tier: "admin"`"
> :198-200 `layout_stale`, `layout_seats_changed` ("The same answer for a foreign id, so it reveals nothing."), `layout_too_many_seats`.
> :205-214 PUT transaction, in lock order. A8 (:331), A11 (:334), A12 (:335), A14 (:337).

Security notes (`ticket.md:48-49`): call `floorCellsWithinCap` only after `checkLayoutRules` returns ok; test 64 full-grid
zones; refuse `baseVersion` above int4; keep `org_id` and `room_id` on the seat UPDATE; one `unnest` UPDATE and one INSERT;
check the room seat count before the seat-set comparison; DB test that a foreign-org seat id changes neither org.

## Acceptance criteria → verification

**Verification levels.** "Local" = `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.
"**CI-only**" = `pnpm test:db`, which cannot run on this machine (no docker). The implementer and reviewer must not report
a CI-only test as run locally. `ci.yml:3-7` triggers only on a PR to `main` or a push to `main`, so a push to
`ticket/SIM-015.5` alone runs nothing: **the PR must exist before the DB tests run**. This ticket is not ready to merge until the
PR's `ci` job, including `db integration tests`, is green. A failure there returns the ticket to REWORK.

| # | Criterion (`ticket.md:37-43`) | How the reviewer verifies it | Level |
|---|---|---|---|
| 1a | "PUT is Admin-only" | `route.test.ts › PUT › user and manager get 403, service not called`; `› no Authorization gives 401`; `routes-guarded.test.ts` covers the new export | Local |
| 1b | "a valid layout survives a reload" | `layout.db.test.ts › save › valid save survives a fresh GET`; `› saved default layout from GET passes unchanged` | CI-only |
| 2 | "A refused payload, or a seat from another room or org, saves nothing" | Payload: `route.test.ts › PUT › bad body / validator refusal never calls the service`. Seats: `layout.db.test.ts › save › seat from another room…`, `› foreign-org seat id changes neither org`, using `snapshotOf` | Local + CI-only |
| 3 | "A stale `baseVersion` returns 409 `layout_stale`, and of two concurrent saves only one succeeds" | `layout.db.test.ts › save › stale baseVersion…`; `› two concurrent saves: one 200, one layout_stale` | CI-only |
| 4 | "A changed seat set returns 409 `layout_seats_changed`, with the same answer for a foreign seat id" | `layout.db.test.ts › save › missing, extra and foreign id all give the identical refusal`; `save.test.ts › set comparison` | Local + CI-only |
| 5 | "A save never changes occupants, status, `seat_counter`, devices or legacy fixture rows" | `layout.db.test.ts › save › leaves occupants, cannot_seat, seat_counter, devices and legacy fixtures unchanged` | CI-only |
| 6 | "Auth codes come only from the wrapper, and domain refusals are 409 or 422 (R7)" | `SaveRefusal.status` is typed `404 \| 409 \| 422`; `route.test.ts › PUT › maps each refusal`; diff shows no 401/403 in `save.ts` or the PUT body | Local |
| 7 | "DB integration tests cover rollback, org scoping, stale and concurrent saves" | The named `layout.db.test.ts › save` tests exist (reviewer reads them) and pass in the PR's CI step | CI-only |

## Ming verification after merge

None. The ticket has no UI (`ticket.md:54`). Ming reviews and merges the PR as usual, after the CI DB step is green.

## Files to create / modify

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/layout/save.ts` | **Create**: `saveRoomLayout`, `SaveRefusal`, local `Abort` and `inTx` | The PUT transaction | No |
| `src/server/layout/save.test.ts` | **Create**: statement order and refusals with a fake client | Pure unit coverage that runs locally | No (Low) |
| `src/server/layout/layout.ts` | Extract lines 61-131 into exported `readLayoutRows(c, scope, sub, roomId)`; `getRoomLayout` calls it after `set transaction` | PUT step 8 re-reads on the same transaction | No |
| `src/server/layout/layout.db.test.ts` | Append `describe("saveRoomLayout (db)")`, reusing local helpers at lines 16-89 | AC 1b, 2-5, 7 | No (Low) |
| `src/app/api/rooms/[id]/layout/route.ts` | Add `export const PUT` | Ticket scope | No |
| `src/app/api/rooms/[id]/layout/route.test.ts` | Add PUT cases; mock `@/server/layout/save`; let `fakeAuth` take a role | AC 1a, 2, 6 | No (Low) |
| `src/lib/validate/layout.ts` | Int4 cap at line 195; floor-cell cap at lines 245-246 | Security notes | No |
| `src/lib/validate/layout.test.ts` | Add validator cases | Pure logic tests | No (Low) |
| `src/lib/api/error.ts` | Add the 3 codes after line 24 | Closed code union | No |
| `src/ui/copy/api.ts` | Add 3 messages after line 29 | `satisfies Record<ApiErrorCode, string>` | No |

Read only, do not edit: `src/server/http/org-scope.ts`, `src/server/http/with-auth.ts`, `src/server/http/respond.ts` (all
**High**), `src/server/audit/write.ts`, `src/server/request/read-json.ts`, `src/test/db/fixtures.ts`.

## Data model / migration

None. The columns exist (`db/migrations/20261122120000_room_tile_layout.sql`). Types the SQL must match: `tile_x`, `tile_y`
`integer`; `tile_rotation` `smallint`; `sprite_key` `text`; `rooms.grid_w`, `grid_h`, `layout_version` `integer`;
`rooms.floor_zones` `jsonb`. `seats`, `rooms` have `updated_at` (`init.sql:69,96`).

## API contract

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | `/api/rooms/{id}/layout` | `LayoutSave` JSON, max 262,144 bytes | `LayoutResponse` with the new `version`, `Cache-Control: no-store` | 200, 400, 401/403 (wrapper only), 404, 409, 422, 503 | `tier: "admin"` |

| Status | Code | When |
|---|---|---|
| 400 | `invalid_request` | Bad JSON, wrong content type, oversize, wrong shape, over a count cap, floor cells above 2× grid area, `baseVersion` above 2,147,483,647 |
| 404 | `not_found` | Non-canonical id, or the room is not in the caller's org |
| 409 | `layout_stale` | `baseVersion` differs from the stored version |
| 409 | `layout_seats_changed` | Submitted seat ids differ from the room's seats, including any foreign id |
| 422 | `layout_too_many_seats` | The room has more than 500 seats |
| 422 | the 4 existing rule codes | `checkLayoutRules` refusal |
| 503 | `unavailable` | No database pool |

Check order: `layout_stale`, then `layout_too_many_seats`, then `layout_seats_changed`.

## Tests to write

**Local (`pnpm test`):**

| Test (file › name) | Covers |
|---|---|
| `src/lib/validate/layout.test.ts › shape › accepts baseVersion 2147483647, refuses 2147483648` | Security note 2 |
| `› floors › refuses 64 full-grid zones on a 64 x 64 grid with invalid_request, field floors` | Security note 1 |
| `› floors › accepts exactly twice the grid area, refuses one cell more` | Cap boundary through `validateLayoutSave` |
| `› floors › an out-of-bounds zone over the cap still returns layout_out_of_bounds` | Cap runs only after the rules |
| `src/server/layout/save.test.ts › runs begin, room lock, seat lock, seat update, fixture delete, insert, room update, audit, re-read, commit` | Lock order |
| `› seat lock is capped at 501 rows and 501 rows gives layout_too_many_seats with no write` | Note 5, A14 |
| `› stale version rolls back before the seat lock` | Order |
| `› set comparison: missing, extra and unknown id give the same refusal and no write` | AC 4 |
| `› zero seats skips the seat update; zero fixtures still deletes and skips the insert` | Empty fields |
| `› seat UPDATE text keeps s.org_id = $1 and s.room_id = $2; uses one unnest statement` | Notes 3, 4 |
| `› floor_zones is bound as a JSON string` | node-pg array trap |
| `› audit meta holds counts and versions only` | No PII in logs |
| `src/app/api/rooms/[id]/layout/route.test.ts › PUT › non-canonical id is 404, no pool is 503, service not called` | Route guards |
| `› PUT › user and manager get 403, service not called` / `› no Authorization gives 401` | AC 1a, R7 |
| `› PUT › bad JSON, wrong content type and a body over 262,144 bytes give 400` | Body limit |
| `› PUT › validator invalid_request gives 400 and a rule code gives 422; service not called` | Validate before tx |
| `› PUT › maps each refusal: 404, 409 stale, 409 seats changed, 422 too many seats` | AC 6 |
| `› PUT › success is 200, no-store, and passes ctx.scope, ctx.sub, id and the validated value` | Happy path |

**CI-only (`pnpm test:db`, cannot run on this machine). `src/server/layout/layout.db.test.ts › saveRoomLayout (db)`:**

| Test | Covers |
|---|---|
| `valid save survives a fresh GET (grid, floors, seats, fixtures; fixtures compared ignoring id and order)` | AC 1b |
| `version increments by exactly 1 and writes one room.layout_save audit row with counts only` | Contract |
| `saved default layout from GET passes unchanged` (strip seat `code`) | A9 |
| `a second save replaces placed fixtures` | Replace semantics |
| `rollback: a failure at the audit insert leaves rooms, seats, fixtures and audit unchanged` (`recording` hook, `snapshotOf`) | AC 7 |
| `stale baseVersion gives 409 and changes nothing` | AC 3 |
| `two concurrent saves: one 200, one layout_stale` (hold A after its room lock, start B, poll `pg_stat_activity` until B waits on a lock, release A) | AC 3, blocked-then-fresh read |
| `missing, extra and foreign id all give the identical refusal and change nothing` | AC 4 |
| `seat from another room in the same org gives layout_seats_changed` | AC 2 |
| `foreign-org seat id changes neither org` (`snapshotOf` both orgs) | Note 6 |
| `another org's room id is 404 and changes neither org` | R6 |
| `501-seat room gives 422 layout_too_many_seats`; `500-seat room saves` | A14, bound |
| `leaves occupants, cannot_seat, seat_counter, devices and legacy fixtures unchanged` | AC 5 |

## Approach

1. **Codes and copy.** Add to `error.ts` and `api.ts`:
   - `layout_stale`: "This room changed while you were editing. Reload to see the latest layout."
   - `layout_seats_changed`: "The room's seats changed while you were editing. Reload and try again."
   - `layout_too_many_seats`: "This room has too many seats to save a layout."
2. **Validator** (`src/lib/validate/layout.ts`).
   - Add `maxVersion: 2_147_483_647` to `LAYOUT_LIMITS`; refuse above it as `bad("baseVersion")`.
   - Replace lines 245-246: return the `checkLayoutRules` failure first, then `bad("floors")` if `!floorCellsWithinCap(...)`,
     then ok. `floorCellsWithinCap` needs in-bounds zones, so this order matters.
3. **Read helper** (`layout.ts`). Move the body after `set transaction` into `readLayoutRows`, unchanged. Keep the statement
   sequence: `layout.db.test.ts:271-280` asserts exactly 6 statements.
4. **Service** (`save.ts`, starts with `import "server-only"`). `saveRoomLayout(pool: TxPool, scope, sub, roomId, value)`:
   ```ts
   export type SaveRefusal =
     | { ok: false; status: 404; code: "not_found" }
     | { ok: false; status: 409; code: "layout_stale" | "layout_seats_changed" }
     | { ok: false; status: 422; code: "layout_too_many_seats" };
   ```
   Inside `withTx`, via `orgQuery`, with `Abort` for refusals (pattern: `rooms.ts:23-38`):
   1. `select layout_version from rooms where org_id = $1 and id = $2 for update`. None: 404. Differs: `layout_stale`.
      (`lockRoom` is private and does not return the version.) Under `read committed`, a save that waited here reads the
      winner's committed version, which is what makes the second save stale.
   2. `select id from seats where org_id = $1 and room_id = $2 order by id limit ${LAYOUT_LIMITS.seats + 1} for update`.
      More than 500 rows: `layout_too_many_seats`. The limit bounds the locks. Then equal count and every row id in the
      submitted set, else `layout_seats_changed`.
   3. If there are seats:
      ```sql
      update seats s set tile_x = v.x, tile_y = v.y, tile_rotation = v.r, sprite_key = v.k, updated_at = now()
      from unnest($3::uuid[], $4::int[], $5::int[], $6::smallint[], $7::text[]) as v(id, x, y, r, k)
      where s.org_id = $1 and s.room_id = $2 and s.id = v.id
      ```
   4. `delete from layout_fixtures where org_id = $1 and room_id = $2 and sprite_key is not null`. If there are fixtures,
      use this form. **The consult's plain `insert ... select $1, $2` would throw**, because `orgQuery` requires the text
      `org_id = $1` (`org-scope.ts:21`). This is the form `audit/write.ts:22-24` uses:
      ```sql
      insert into layout_fixtures (org_id, room_id, kind, tile_x, tile_y, tile_rotation, sprite_key)
      select o.org_id, $2::uuid, null::text, v.x, v.y, v.r, v.k
      from (select $1::uuid as org_id) o
        cross join unnest($3::int[], $4::int[], $5::smallint[], $6::text[]) as v(x, y, r, k)
      where o.org_id = $1::uuid
      ```
   5. `update rooms set grid_w = $3, grid_h = $4, floor_zones = $5::jsonb, layout_version = layout_version + 1,
      updated_at = now() where org_id = $1 and id = $2 returning layout_version`. Bind `$5` as
      **`JSON.stringify(value.floors)`**: node-pg would otherwise send a JS array as a Postgres array and the cast fails.
   6. `writeAudit`: action `room.layout_save`, entity `room`, `entityId` = room id, `meta` =
      `{ seats, fixtures, floors, baseVersion, version }` (numbers only).
   7. `readLayoutRows` on the same client. A null result is `Abort(not_found)`.
5. **Route.** `export const PUT = withAuth<{ id: string }>(..., { tier: "admin" })`, in this order: uuid (404), pool (503),
   `readJson(req, LAYOUT_LIMITS.bodyBytes)` (400), `validateLayoutSave` (`invalid_request` 400, otherwise 422), service,
   `apiError(r.status, r.code)` or `Response.json(r.value, { headers: NO_STORE })`. Never send the validator's `field`:
   `apiError` has one error shape (`respond.ts:4-5`).
6. **Tests** as listed. In `route.test.ts`, keep the `@/server/layout/layout` mock and add a mock for
   `@/server/layout/save`. `fakeAuth` needs a role argument (`simap:admin`).
7. **Verify.** Run the four local checks. Do not run or claim `pnpm test:db`. Record in `impl-log.md` that the DB tests are
   unexecuted until the PR's CI runs.

**Rules.** R1: the route is the only entry into `src/server/**`; `src/lib` stays pure. R2: no schema change. R3: no new
config. R4: file list above. R5: new logic has tests, and CI DB green is required. R6: every statement uses `org_id = $1`.
R7: no 401/403 outside `withAuth`, and all domain refusals are 404/409/422 before commit.

**Lock order** (`rooms.ts:213-224`): room `for update`, then seats ascending. No member lock is taken. Member deactivation
(`manage.ts:353-361`) and occupant changes (`seats.ts:232-237`) take the room `for share` first, so they serialize with a
save and cannot deadlock against it.

## Specialist input used

From `consult-api-platform-engineer.md`:

- **Adopted:** validator gaps (rec 1), codes and copy (rec 2), `save.ts` plus an extracted reader (Q4), route order (rec 4),
  test list (rec 5), 400 for both new validator refusals (Q1, Q2), `updated_at` on seats (Q3: the column exists,
  `init.sql:96`).
- **Corrected:** the fixture `insert ... select $1, $2` (rec 3.4) fails the `orgQuery` guard; replaced by the subselect form.
- **Added:** `JSON.stringify` for `floor_zones`; `limit 501` on the seat lock so an oversized room locks a bounded set;
  `rooms.updated_at`, as other room writes do (`rooms.ts:143`).

## Assumptions

1. **Fixture ids change on every save** (contract: "no id: replaced on save"). Two non-blocking fixtures on the same tile
   tie-break by id (`placement.ts:214`), so their paint order may flip after a save. No position column exists and a
   migration is out of scope. Non-blocking for this ticket; the orchestrator should record it as a `debt` follow-up for SIM-015.2.
2. **Audit label:** `room.layout_save` shows as the raw code on the audit screen, through the existing fallback
   (`audit.ts:34-36`), the same as `seat.assign` today. `src/ui/copy/audit.ts` is not in the ticket's file list, so a label is a follow-up.
3. **`layout_version` at int4 max** cannot be incremented: the UPDATE errors, the transaction rolls back and the caller gets
   a 500. It takes 2.1 billion saves, so no handling is added.
4. **A save blocked longer than the pool's 5 s `statement_timeout`** (`pool.ts:18`) fails with a 500 and saves nothing.
5. **Unplaced seats:** PUT needs the exact set, so the editor must place them first (`ticket.md:47`, A11). SIM-015.2 owns this.
6. **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board. No rebase expected.
7. **Size:** about 300 production lines (part of it the dedent from extracting the reader) and about 450 test lines, above the
   rough 400-line guide. See `## Split proposal`.

## Blocking questions

None.

## Split proposal

None. The ticket is already a slice of SIM-015.1 (D59), and the PUT is one transaction that cannot ship in part. The
production diff is under the guide; the excess is tests that the acceptance criteria require.
