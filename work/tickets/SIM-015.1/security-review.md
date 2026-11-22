## Attempt 1

## Security review: SIM-015.1, attempt 1

**Verdict: no 🔴 blockers, one 🟡 should-fix, five 🟢 notes for later slices.** The 🟡 is a stored client-side denial of service that the validator allows.

This was static review only. I ran no checks, tests or payloads, so the cost figures below come from reading the code. I did not read any `.env*` file and changed nothing.

### Findings

**🟡 1. A 3 KB floor payload makes every member's browser process 262,144 draw ops**
- **Where:** `d:\project\simap-game-ui\src\lib\validate\layout.ts:142-144` (no limit on total floor area), with the sink at `d:\project\simap-game-ui\src\lib\sprites\placement.ts:153-161` and `d:\project\simap-game-ui\src\ui\roomlayout\paint.ts:60-72`.
- **Risk (CWE-770):** zones may overlap, and each is checked only against the grid. 64 identical `{x:0,y:0,w:64,h:64}` zones pass, at about 50 bytes each. `buildDrawList` expands them to 64 x 4,096 = 262,144 ops, then maps, sorts and paints them.
- **Impact:** once SIM-015.5 saves this and SIM-015.3 renders it, the room can hang for every member of that org on each view and each `seatViews` change. It can also hang the editor an Admin would use to repair it. The actor must be an Admin of that org, and it does not cross orgs, hence 🟡.
- **Fix:** cap total painted floor cells, after the zone bounds loop, so the sum cannot be inflated by out-of-range values. `DEMO_LAYOUT` uses 116 of its 192 allowed cells, so it still passes. Add a unit test for 64 full-grid zones.

```ts
let floorCells = 0;
for (const z of layout.floors) {
  if (!inGrid(z.x, z.y, z.w, z.h, layout.w, layout.h)) return fail("layout_out_of_bounds");
  floorCells += z.w * z.h;
}
if (floorCells > layout.w * layout.h * 2) return bad("floors");
```

**🟢 2. `baseVersion` accepts values outside Postgres `integer` range**
- **Where:** `d:\project\simap-game-ui\src\lib\validate\layout.ts:187`; column at `d:\project\simap-game-ui\db\migrations\20261122120000_room_tile_layout.sql:8`.
- **Risk:** values up to 2^53-1 pass. If SIM-015.5 binds one in SQL against the int4 column, Postgres can raise `22003` and the request becomes a server error instead of a 400 or 409.
- **Fix:** add `body.baseVersion > 2_147_483_647` to the check, or require SIM-015.5 to compare in JS after the locked read.

**🟢 3. SIM-015.4: treat stored `floor_zones` as untrusted on read**
- **Where:** `d:\project\simap-game-ui\db\migrations\20261122120000_room_tile_layout.sql:11` checks only that the value is an array; the renderer loops on `zone.h` and `zone.w` at `placement.ts:156-157`.
- **Risk:** a bad row from a manual fix, or a future limit change, reaches every client unchecked.
- **Fix:** re-validate zones on GET (shape, bounds, known sprite, cell cap) and fall back to the computed default floor. `checkLayoutRules` does not check integers itself, so it is not enough alone for jsonb data.

**🟢 4. SIM-015.3: a maximum-size room allocates a very large canvas**
- **Where:** `d:\project\simap-game-ui\src\ui\roomlayout\paint.ts:53-54`.
- **Risk:** a 64 x 64 room at zoom 4 is 8,192 x 8,192 px, about 268 MB of RGBA, and some browsers will refuse or crash. Plan A10 accepted the pixel size but did not mention memory, so I am not asking to change the approved cap.
- **Fix:** in SIM-015.3, cap zoom by canvas area, or render only the viewport, and show the existing error state on failure.

**🟢 5. SIM-015.5: write-path requirements the contract should state**
- Keep `org_id = $1 and room_id = $2` on the seat `UPDATE` itself (plan step 4), even after the seat-set comparison. Step 4 currently does not spell this out, and it is the R6 control for foreign seat ids.
- Use one `unnest`-based `UPDATE` and one `INSERT`. Up to 2,500 individual statements would hold the room `FOR UPDATE` lock for a long time and stall seat operations.
- Add the DB test that a foreign-org seat id gets `layout_seats_changed` and leaves both orgs' rows unchanged.

**🟢 6. SIM-015.5: `layout_too_many_seats` is easy to make unreachable**
- **Where:** `d:\project\simap-game-ui\src\lib\validate\layout.ts:192`.
- **Risk:** 501 submitted seats get a 400 from the validator. A truncated 500-seat payload for a larger room would get 409 `layout_seats_changed`, and a reload never clears it. This fails closed, so it is a correctness issue only.
- **Fix:** check the room's seat count before the seat-set comparison.

### Checked, no issue
- **Org isolation (R6):** no new table. New columns sit on rows that already have `org_id not null`, and seats and fixtures keep composite `(org_id, room_id)` foreign keys (`init.sql:103,185`). No non-test server code uses `select *`, so the new columns cannot leak through existing DTOs.
- **Previous image:** nothing in `src` references `layout_fixtures` or the new columns, so a `kind = null` row cannot reach current server code.
- **Validator CPU and memory:** array caps are checked before iteration and there is no recursion. Work is at most about 2,564 items. Blocking cells stop at 4,096 because the first duplicate returns. Bounds run before cell indexing, so cell numbers cannot collide. The UUID regex is linear.
- **Body handling:** `readJson` caps size while streaming and catches parse errors, including any from deep nesting.
- **Prototype keys:** sprite lookups use a `Map` and `Object.hasOwn`. `__proto__` as a JSON key fails `hasExactKeys`, and output objects are rebuilt field by field. `apiErrorMessage` checks an allowlist before indexing.
- **Type edge cases:** `-0` is harmless in rotation, coordinates and `baseVersion`. Duplicate JSON keys collapse before validation.
- **Contract exposure:** member id and display name are already returned to `tier: "user"` by the seats route (`seats.ts:88`), so `avatarSeed` and `name` add no new exposure, and raw `sub` stays private. The 409 for foreign seat ids is not an existence oracle. No 401/403 is planned after a write (R7).
- **Secrets (R3):** none in the changed files.

### Follow-ups
- Findings 3 and 4 belong in SIM-015.4 and SIM-015.3.
- Findings 5 and 6 should be copied into SIM-015.5 when that ticket is created.
