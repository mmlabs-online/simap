# Security review — SIM-049

## Attempt 1

Summary: PASS from a security view. The n/s-only rule is enforced on the server before any write, for both layout saves and custom art (sprite and image). Refusals are domain 422s, not 401/403, and the diff adds no secrets. No blockers or should-fix findings.

**Findings**

🟢 **Layout save refuses 90/270 on the server, before any write.**
- `src/lib/validate/layout.ts:181` adds `if (!rotationAllowed(item.sprite, item.rotation)) return fail("layout_bad_rotation")` inside `checkGridSpritesRotations`.
- `checkLayoutRules` (line 209) and `checkLayoutBasics` (line 188) both call that function, so the check runs in both places.
- `src/server/layout/save.ts:107-113` calls `checkLayoutRules` and throws `refuse(422, rules.code)`.
- Everything before that point only reads or locks rows (room `for update` :58-65, seats `for update` :67-77, catalog `for key share` :94-105). The one possible write is the existing `map_items_seed` safety net (:81-85). It is already in the code, idempotent and inside the same `inTx`, so the throw rolls it back. The new code is not the cause.
- The 401/403 codes stay in `withAuth`. R7 holds.
- The rule is keyed on the base sprite (`src/lib/sprites/rotations.ts:5,18-19`), which matches the base keys the validator works with.

🟢 **Custom art for e/w is refused on the server, not only hidden in the UI.**
- `src/lib/map-items/art.ts:19-22`: `artDirAllowed` now uses `allowedDirs(item.builtinKey)`.
- All three server write paths call it first and return 422 `not_allowed`:
  - `src/server/map-items/edit.ts:237` (`setMapItemArt`, before the tx).
  - `src/server/map-items/image.ts:70` (`setMapItemImage`, before the DB select and before the Drive upload at :79, so nothing is sent to Drive).
  - `src/server/map-items/image.ts:142` (`removeMapItemImage`, before the tx).
- The route `src/app/api/map-items/[key]/art/[dir]/image/route.ts:30-40` only reads and parses the request body before that call. No side effects.
- Enforcement does not depend on the client. `src/ui/mapItems/map-item-art.ts` (`artDirs`) is display only.

🟢 **No other server write path for rotation.**
- Only `src/server/layout/save.ts` and `src/server/layout/layout.ts` mention `rotation` in non-test server code.
- The other `MAP_ITEM_DIRS` loops in edit.ts (:122, :136-159, :197, :280) only clear or reset art across all directions. They cannot be used to set e/w art.

🟢 **No secrets.** `rotations.ts` holds only constants and pure functions, with no env, keys or network calls.

💭 **Note (test strength, optional):** `src/server/layout/layout.db.test.ts:368-379` tests 90° on `clock.wall` and checks that `layout_fixtures` stays empty. A tighter test would also check that `rooms.layout_version` is unchanged, and cover 270 / `screen.projector`. The 270 and projector refusals are already unit-tested in layout.test.ts, and the transaction rollback covers the version.

**Follow-ups (out of scope)**
- From the plan's Assumptions: if SIM-042 ships before this merges, existing 90/270 rows for these keys would need a read-side fallback. Any per-org e/w art already stored would stay in the DB, unreachable through the API but not cleaned up. There is no security risk either way.
