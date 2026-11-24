**Findings**
- `readLayoutRows` (src/server/layout/layout.ts) is shared by GET and by save.ts (line 140 re-reads after a save), so a devices query added there also runs on every PUT response. save.test.ts mocks it, so the mock must grow the new field.
- Seat rows are capped at LAYOUT_LIMITS.seats (+1 probe → `truncated`). Fixtures are capped by LIMIT. Devices have no cap in this path. DEVICE_LIMITS.list (1000) is only the Devices-page list cap and is unrelated to seat count. The `devices` table has `seat_id` (nullable), `role` ('primary'|'secondary'), `type` (text, ≤60), `created_at`, and `org_id`. One primary per seat is enforced by a unique index. `devices_org_seat_idx (org_id, seat_id)` exists, so a seat-keyed query is indexed.
- `checkLayoutRules` already knows `blocks` per sprite from REGISTRY. `placed[]` holds the footprints of blocking items, and desks are the blocking `group: "desk"` seats. Fixtures are `FIXTURE_GROUPS` and include non-blocking props. So a prop on a desk currently passes (non-blocking items conflict with nothing).
- `resolveLayout` runs the same `checkLayoutRules` per stored item, one item at a time. It never sees a fixture and a desk together. Overlap there is tracked in its own `occupied` set, which only holds blocking cells. Props on desks are therefore never dropped on load.

**Recommendations**
1. API contract. Add to `LayoutResponse` a top-level `seatDevices: Record<seatId, SeatDevice[]>`, parallel to `seatViews`. Don't nest it inside `SeatView`, because that type is derived status and the file says so. Define `SeatDevice = { type: string }` as an object, not a bare string. SIM-036.2 can then add `catalogTypeId`, `sprite` or `label` additively, and clients that ignore unknown fields keep working. Order is the array order: primary first, then `created_at`, then `id`. Say so in the type doc, so the client does not re-sort.
2. Query. Run one extra query in `readLayoutRows`: `select seat_id, type, role from devices where org_id=$1 and seat_id = any($2) order by seat_id, (role='primary') desc, created_at, id`. The seat ids come from the already-scoped, capped `seats` list, and the query is org-scoped through `orgQuery` (R6). It runs in the same repeatable-read snapshot. Use `left(type, 61)`, as the code already does for `sprite_key`, and trim only on the client.
3. Privacy. Return only what drawing needs, which is `type`. Don't return `name`, `id`, `inventory_number`, `mac` or `owner_id`. The map is readable by every org member, and the Devices page has its own authorization. Don't send `role` either, since order already encodes it. If the planner wants role for SIM-036, add it then.
4. Caps. Cap devices per seat, for example 8 (a new `LAYOUT_LIMITS.devicesPerSeat`), with `limit`/`row_number()` in SQL or a slice in code. That also resolves the "3 monitors" fallback question, because the slot table's stacking fallback only has to handle up to that cap. If a seat is cut, set `truncated = true` (reuse the existing flag, which covers "list incomplete"). Don't add `DEVICE_LIMITS.list`. The seat cap already bounds the total to seats × devicesPerSeat.
5. Validator. Add a new code `layout_fixture_on_desk`, not `layout_overlap`. The reason is that the editor needs different copy: "That tile is taken" would mislead, since props are allowed next to other props. It also lets API clients tell the two failures apart. A new code needs these changes:
   - `LayoutRuleCode` in src/lib/validate/layout.ts:20
   - the list in src/lib/api/error.ts:22
   - the list in src/lib/layout-editor/save-errors.ts:6
   - the copy in src/ui/copy/api.ts and src/ui/copy/roomlayout.ts (around line 88)
   - tests
   Implement it after the overlap loop, or inside the loop. For desk seats (group "desk"), build a footprint cell set. For each fixture, compute its footprint, and if any cell is in a desk set, return `fail("layout_fixture_on_desk")`. This needs `kind` kept in `Placed`. The fixed-order doc comment must be updated.
6. Compatibility. Do NOT add the new rule to `resolveLayout`'s per-item `take()`, or reuse the validator unchanged there. `take` calls the same function with a single item, so the desk rule can't fire, and nothing changes. A saved layout with a prop on a desk therefore still loads and draws. The next PUT of that layout fails with the new 422 until the user removes the prop. The editor should show that error, and a nicer way is to flag the offending fixtures. Having `resolveLayout` silently drop such fixtures on load looks tempting, but it would change what GET returns and what the editor shows without any user action. If you do it, apply it only to the editor draft (a `rulesInput` filter) and tell the user. Recommended default: surface, don't drop. Ming confirms.
7. Fixture dev data: `src/app/dev/roommap/fixture.ts` has `prop.mug` on a desk. Move it.

**Risks**
- save.ts re-read adds one extra query per PUT. That is acceptable, and the mock in save.test.ts needs updating.
- Order stability: `created_at` ties are broken by `id`. Without it, order would flicker between loads.
- Seat moved or device placed between GET calls: version-based caching keyed on `layout_version` would show stale devices, because device changes do not bump the layout version. Check whether any client caches by version only. If so, device moves need a refetch or a cache key change.
- Free-text `type` has 60 characters of user content. The client maps it by normalization (trim + case-insensitive) and never uses it as a sprite key, otherwise a user could request an arbitrary sprite.

**Open questions**
- Is `devicesPerSeat` = 8 acceptable, and should the overflow marker be "+n" or silent?
- Do you accept surface-not-drop for already-saved desk props (item 6)?
- Which role should be exposed to the client, if any?
- Does a decommissioned or archived device state exist? I saw none in the migration, but I did not scan later migrations. Check before the query, so retired devices aren't drawn.
