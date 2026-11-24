**Findings**
- All editor ops (placeItem, placeFromTray, moveItems, rotateItems) end in `checked()` in `src/lib/layout-editor/draft.ts`. It runs `checkLayoutRules` (`src/lib/validate/layout.ts`) on the whole candidate draft. So one new rule in the validator covers the API 422, the place-tool ghost (`placementPreview` calls `tryPlace`), drag and group moves, and rotating a desk onto a prop. `place-tool.ts` and `draft.ts` need no logic change, only tests.
- The overlap pass only registers `blocks` items. Props are non-blocking and `placed` is built per item, so the rule is: for each fixture (blocking or not), if any footprint cell is in a desk's footprint, return `fail("layout_overlap")`. Reuse `layout_overlap`, because a new code would need a new `ApiErrorCode`. Moving or rotating a desk onto an existing prop is refused too, which is correct. Moving a prop and its desk together passes, since only the final state is checked.
- Legacy lock-in: `checked()` validates the whole draft. A saved layout with a prop on a desk therefore makes every later op fail with `layout_overlap`, so the editor is bricked until the prop is deleted. `deleteItems` does not call `checked`, so deleting still works. Save fails 422 until then.
- `device.*` frames (`public/sprites/office.json`) are sub-tile (`tiles` 1x1, non-blocking, `tiles: null` in the registry). Anchors: pc is 12x20 at [10,12], phone 8x12 at [12,20], other 14x12 at [9,20], laptop n/s 22x16 at [5,16] and e/w 16x16 at [8,16], monitor n/e/s/w plus `dual`. Desk anchor is [0,-16]. Desk footprints are n/s 2x1 and e/w 1x2.
- `buildDrawList` (`src/lib/sprites/placement.ts`) puts everything in `items`, sorts by `sortRow` (a sub-tile item takes its host desk's last row, then `sub` after non-sub), and emits via `emitFrame(layer, key, tx, ty, offset)`. `emitFrame` already supports a pixel offset, and a final stable sort by layer rank keeps the order. Devices in the same layer as the desk would be sorted by row, but there is no "before host" rule today.

**Recommendations**
1. New pure file `src/lib/sprites/device-slots.ts` (lib, no imports from other layers). Export `deviceKind(type)` (trim, lowercase; pc / laptop / monitor / "ip phone" mapped to a kind, anything else `other`). Export `SLOTS: Record<Kind, Slot[]>`, where `Slot = {dx, dy, offX, offY, under: boolean}`. Define slots once for the desk facing "s" (2x1). Derive the other three rotations by a pure transform of the desk footprint (w, d) and a rotation map for tile and pixel offsets, so the table stays data-shaped for SIM-036. Test all 4 rotations with one of every type, asserting no two slots coincide.
2. Monitor slot 1 is right of centre and slot 2 is left, in the desk's frame of reference. Rotation turns "right" into tile and offset coordinates. Phone and other go on the top surface. The laptop is slot 1 on the centre tile, directional (n/e/s/w frame follows the desk rotation). The monitor is likewise directional, and `.dual` is unused.
3. In `buildDrawList`, give seats an optional `devices: string[]` list (in API order, primary first). For each device, `lookup` the key, take the next slot of its kind, and push an Item or direct op. For `under` (PC), add a flag to `Item` (for example `before: true`) so that in the sort it gets `row`, then `-1` before the host. Do not rely on F2 ordering. Frames are placed with the anchor plus the slot offset. Mark them non-selectable in the editor by emitting them as ops only, with no id in `seatBoxes`.
4. Overflow: when a kind has more devices than slots, reuse the last slot with a +3px, -3px stacking offset per extra device, up to a cap of 4 per kind. Further devices are not drawn, and a "+n" marker is optional (Ming confirms).
5. Add the validator rule and tests (prop on desk refused, prop next to desk allowed, a rotated e/w 1x2 desk, moving a desk onto a prop). Update `src/app/dev/roommap/fixture.ts` (its `prop.mug` is on a desk tile).
6. Legacy layouts: in `draftFromLayout` (and `RoomLayout` for display), keep the fixture visible on the room map. In the editor, make `checked()` ignore a pre-existing violation, or drop fixtures that sit on a desk on load and show a one-line notice ("N items on desks were removed; save to apply"). The planner picks; the drop-and-notice option is simpler and keeps the save valid. Ming confirms.
7. Layout API: add `devices: string[]` per seat to `LayoutResponse`, from a query `WHERE org_id = $org AND seat_id = ANY(...)`. Order by `primary` desc, `created_at`, `id`. Cap per room and set `truncated`. Add a DB test for another org's device. Keep the draft/save body unchanged, because devices are never part of a PUT.
8. Spec: update LAY-06 and add a decision row (D62) before the code.

**Risks**
- The existing placeholder art: PC (12x20) and monitor (12x20) are tall and portrait, so under-desk and offset reads are approximate until SIM-033.
- Legacy lock-in (see Findings) if item 6 is skipped.
- A seat's `chairFor` and avatar layer ranks are unchanged, but a device painted in a `furniture` or `prop` layer may land above the avatar; verify the layer for `device.*` in `keys.json`.
- Desk rotation e/w with a 1x2 footprint: slot `dy` can fall outside the 2 tiles if not derived from the footprint.

**Open questions**
- Legacy fixtures on desks: drop on load with a notice, or leave them and relax the rule for existing ones?
- Overflow policy (stack, cap, or "+n")?
- Is the dual monitor frame ever used for 2 monitors?
- Max devices returned per room (cap and `truncated`)?
