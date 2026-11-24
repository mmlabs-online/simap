## Attempt 1

## Security review: SIM-015.4, attempt 1

**Verdict: no 🔴, one 🟡, three 🟢.** The floor parser, floor-cell cap, repair-path bounds and `sub` handling hold. The 🟡 is that `resolveLayout` does not type-check stored placements, so it falls short of its "never throws" contract. Current DB column types and constraints stop this data arriving, so it is not exploitable today.

This was a static review. I had no Bash tool, so I ran no checks, tests, payloads or `git diff`, and every behaviour below comes from reading the code. I read no `.env*` file and changed nothing.

### Findings

**🟡 1. `take()` accepts non-integer placements, and one shape throws**
- **Where:** `d:\project\simap-game-ui\src\lib\sprites\resolve-layout.ts:68-71`, relying on `inGrid` at `d:\project\simap-game-ui\src\lib\validate\layout.ts:93-94`. The `!== null` check at `resolve-layout.ts:94` lets `undefined` through.
- **Risk (CWE-20, CWE-248):** `checkLayoutRules` does not check integers, as SIM-015.1 finding 3 noted. `parseStoredFloors` guards against this, but seat and fixture placements do not:

| Stored value | Result |
|---|---|
| `x: 0.5` | Accepted and returned; its fractional cell numbers miss overlap with neighbouring items |
| `x: null` | Accepted (`null >= 0`, `null + 2 = 2`) and returned as `null` |
| `x: "1"` | Accepted (`"1" + 2 = "12"`, and `"12" <= 12`); cell keys become strings, so the overlap check is bypassed |
| `x: 1n` | `TypeError` from `1n + 2`, which escapes |
| `placement: undefined` | `TypeError` at `p.sprite`, which escapes |

- **Reachability:** not reachable from the DB as it stands. `tile_x`, `tile_y` and `tile_rotation` are int columns, and a check allows all four placement fields or none (`20261122120000_room_tile_layout.sql:15-21,27-34`). It takes a SIM-015.6 mapper bug or a later column change. It is 🟡 because this function is the stated trust boundary and the fix is small.
- **Fix:** add this as the first statement of `take`, and add these five shapes to `resolve-layout.test.ts`:

```ts
if (
  typeof p !== "object" || p === null || typeof p.sprite !== "string" ||
  !isInt(p.x) || !isInt(p.y) || !isInt(p.rotation)
) return false;
```

Also change line 94 to `s.placement != null && take(...)`, or let the guard handle it.

**🟢 2. SIM-015.6: the size caps run only after the driver has parsed the row**
- **Where:** `resolve-layout.ts:24` caps the zone count, but the planned query at `d:\project\simap-game-ui\work\tickets\SIM-015.4\plan.md:274` selects `floor_zones` uncapped. The migration only requires a JSON array (line 11).
- **Risk (CWE-770):** node-pg's default parser runs `JSON.parse` on the whole value, synchronously, before this code sees it. A very large row written by direct SQL would block the event loop on every view of that room. An oversized `sprite_key` has the same pre-parse memory cost.
- **Fix, in the SIM-015.6 queries:**

```sql
case when jsonb_array_length(floor_zones) <= 64
      and octet_length(floor_zones::text) <= 262144
     then floor_zones end as floor_zones
-- and, for seats and fixtures:
left(sprite_key, 129) as sprite_key
```

A `NULL` floor falls back to the default floor. A truncated key stays non-null and fails the registry lookup, provided 129 is longer than every registry key.

**🟢 3. SIM-015.5: call the cap only after the bounds check**
- **Where:** `d:\project\simap-game-ui\src\lib\validate\layout.ts:171-175`. `validateLayoutSave` (line 245) does not call it yet, which matches the plan.
- **Risk:** a negative `w` lowers the running total, so calling the cap before bounds can be bypassed. If the save omits the cap, an over-cap save succeeds and the next read silently replaces the floors with the default.
- **Fix:** in `validateLayoutSave`, call `floorCellsWithinCap` only after `checkLayoutRules` returns ok.

**🟢 4. Duplicate seat ids would break the "always valid output" claim**
- **Where:** `resolve-layout.ts:91,96,149`.
- **Risk:** two rows with one id overwrite one `placed` entry, and `flatMap` then emits that seat twice on the same tile. The `seats.id` primary key prevents this, so no change is needed unless the query later gains a join that can multiply rows.

### Checked, no issue
- **Floor shape:** the array length is checked before iteration. Sparse entries, arrays, missing or extra keys, and non-safe integers all fall back. Output zones are rebuilt from the five named fields.
- **Prototype keys:** sprite lookups use a `Map` and `Object.hasOwn`, and `keys.json` has no `__proto__`, `constructor` or `prototype` entry. An own `__proto__` key in a zone fails the exact-key check.
- **Floor-cell cap:** each zone is in bounds before summing, so the maximum is 64 x 4,096 = 262,144, with no overflow. `w >= 1` and `h >= 1` rule out negative offsets on the read path. The fallback floor uses 1x the grid area.
- **Grid:** null, string, float, oversized and non-positive values all reach `defaultLayout`. Its largest output is 63 x 48 for 500 seats.
- **Repair path:** input is sliced to 500 seats and 2,000 fixtures. The slot cursor only moves forward, with at most 672 slots on a 64 x 64 grid. Each `take` does constant work, and `occupied` holds at most 4,096 cells.
- **Overlap parity:** for integer placements, `take` matches the blocking and chair rules in `checkLayoutRules`.
- **Raw `sub`:** `SeatView`, `LayoutResponse` and the resolver outputs are built from named fields, so an extra `sub` on a row cannot pass through. The planned SQL uses `sub` only to compute the `mine` boolean. `avatarSeed` is safe as long as SIM-015.6 passes `s.occupant_id`; both are strings, so the type system cannot enforce this. The default `display_name` comes from the email (`d:\project\simap-game-ui\src\server\members\members.ts:63`), not from `sub`.
- **Secrets (R3):** none in the reviewed files.

### Follow-ups
- Copy finding 2 and the `s.occupant_id` requirement into SIM-015.6 when it is created.
- Copy finding 3 into `d:\project\simap-game-ui\work\tickets\SIM-015.5\ticket.md`.
