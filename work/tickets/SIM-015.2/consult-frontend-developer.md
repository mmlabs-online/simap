**Consult report, SIM-015.2 (tile editor, D43/D48 scope). Read-only; I did not read the seatMGT reference and did not check the POST /seats body or the DELETE /seats/[id] guard internals.**

## Findings
1. **Ticket text is stale and must be rewritten at planning.** Goal, Scope and Technical notes still describe the free-form dnd-kit port (resize, 8 px snap, free rotate). The D43 section supersedes them. Spec LAY-01/02/03/05 matches D43. The tile size is 32 px (D48, `TILE` in `src/lib/sprites/placement.ts`), not the 16 px that D43 says. The spec wins on any conflict.
2. **The save API never creates or deletes seats.** `PUT /api/rooms/[id]/layout` (`src/server/layout/save.ts`) returns 409 `layout_seats_changed` unless the submitted seat ids equal the room's current seats exactly. It rewrites tile_x, tile_y, rotation and sprite_key on those seats. It replaces all fixtures that have a sprite_key.
   - Fixtures carry no id; they are replaced wholesale.
   - It checks `baseVersion` and returns 409 `layout_stale` on mismatch. It is admin-tier. The body is capped at 256 KB.
   - Seat add and delete already have endpoints: `POST /api/rooms/[id]/seats` and `DELETE /api/seats/[id]`, both admin-tier.
   - So "Add a tile creates seat `<room>-NN`" and the delete guard (SEA-01) need an orchestration decision. See Recommendation 2.
3. **Shared pure rules exist and should be reused client-side.**
   - `src/lib/validate/layout.ts` exports `checkLayoutRules`, `footprintOf` and `LAYOUT_LIMITS`. It checks grid max 64, seat sprite `desk.single` only, fixture groups, rotation only for directional sprites, bounds, chair cell in bounds, overlap of blocking items, and the floor cell cap.
   - `src/lib/sprites/placement.ts` exports `resolveFrameKey`, `chairFor`, `buildDrawList` and `seatOrder`.
   - `src/lib/sprites/layout.ts` defines `RoomLayout`, `LayoutSaveValue`, `LayoutResponse` (including `unplaced` and `truncated`), `Placement` and `Rotation`.
   - Rotation is a base sprite key plus 0/90/180/270. Non-directional sprites must stay at 0.
4. **The read-only map is in `src/ui/roomlayout/`.**
   - `RoomMap` takes `{layout, seatViews, zoom, onZoom, onSelect}`. `RoomMapSection` and `useRoomLayout` (`src/ui/seats/useRoomLayout.ts`) load the data. `paint.ts` and `loadAtlas.ts` draw, `SeatOverlay` overlays seats, and `ZoomControl` handles zoom.
   - Zoom levels are 2, 3 and 4 (`ZOOM_LEVELS` in `src/lib/sprites/layout.ts`; `src/lib/sprites/zoom.ts` exists).
   - Copy goes in `src/ui/copy/roomlayout.ts` (D36).
   - `src/lib/sprites/default-layout.ts` and `resolve-layout.ts` compute a default layout for unsaved rooms and report `unplaced` seats. The editor must handle both: an unsaved room (`saved: false`) and unplaced seats.
5. **Layering (R1).** Editor state and logic (apply move/rotate/delete, tile-step moves, undo stack, layout-to-payload diff) go in `src/lib/**` as pure code. React and canvas code go in `src/ui/roomlayout/` (`LayoutEditor*`, `Palette*`, `Inspector*`). The route `src/app/(app)/rooms/[code]/edit/page.tsx` imports only ui and lib. Check the existing `rooms/[code]` page for how a room code is resolved to an id.
6. **The AC "snap math" no longer applies as written.** Replace it with tile math: pixel to tile conversion at the zoom level, clamping, and group-move bounds.

## Recommendations
1. **Rewrite the ticket scope against D43 (AC1–AC5):**
   - Remove "resize", "8 px snap", "marquee free-form" and "port dnd-kit LayoutEditor".
   - Keep the Out-of-scope item (floor-plan background image, D20).
   - Reword the Goal to "place sprites on tiles".
   - Reword the unit-test AC to "tile math, group move, undo, rule checks and save payload".
   - Add the rest of the D43 editor: palette from the registry, R rotates, delete, shift-click and marquee multi-select moving by whole tiles, zoom 2/3/4 with pan, undo before save.
2. **Resolve the seat add/delete flow (see OQ1). My default:**
   - On "add desk", call `POST /rooms/{id}/seats` immediately. The server assigns the next code, so AC2 holds. Place the returned seat in local state at the chosen tile.
   - Deleting a desk is local until save. At save, call `DELETE /api/seats/{id}` for each removed seat (refusal means the occupant/device guard blocked it), then `PUT` the layout.
   - Alternative: create seats at save time. That avoids orphans but needs the code assigned only after save.
   - Either way, the diff has to be ordered and explicit, which the diff unit test should cover.
3. **Handle partial failure.**
   - If a delete is refused (AC3), keep the tile and show a message naming the seat code. Do not send the PUT; reload the room state.
   - If the PUT returns `layout_stale` or `layout_seats_changed`, show "someone else changed this room" with a reload action. Do not retry silently.
   - After a successful PUT, adopt the returned `LayoutResponse` (new version).
4. **Run the shared validator before save.** Call `checkLayoutRules` on every edit to give live "cannot place here" feedback, and again on the final payload. Map the 422 `layout_*` codes to copy on the server response too.
5. **Undo:** snapshot-based or command-based stack in `src/lib`, capped at about 50 steps, cleared on a successful save. One undo step per drag or group move.
6. **Unsaved-changes guard:** a `beforeunload` handler for tab close and reload, plus a confirm for in-app navigation. Check how Next 16 App Router handles route-leave interception, since there is no `router.events`. Intercept link clicks in the editor and the back button, or limit the guard to `beforeunload` plus the editor's own Cancel and Back controls. Dirty state is "payload differs from the loaded layout".
7. **Access:** the page must be admin only, matching the PUT's admin tier. Non-admins get a redirect or a forbidden state, not a broken editor. Also decide whether the edit link is hidden in `RoomMapSection` for non-admins.
8. **Tests (R5):**
   - Tile conversion and clamping.
   - Group move, including a group blocked at a bound or by an overlap.
   - The undo stack.
   - Rotate restricted to directional sprites.
   - The diff and save payload shape, which must pass `validateLayoutSave`. A test can feed the payload straight into it.
   - Seat add/delete ordering.
   - Light component tests for the dirty guard.
9. **Do the 20+ seat manual test** from the ticket, but also a room at the 64×64 cap for paint performance.
10. **Accessibility.** Desktop only per spec, but provide keyboard control: arrow keys move the selection by one tile, R rotates, Delete deletes, Ctrl+Z undoes. Put the editing state in an `aria-live` status. Sprite palette items should be real buttons.

## Risks
- **Orphan seats:** creating the seat through POST before save means abandoning the editor leaves a created but unplaced seat (it shows under `unplaced`). That is acceptable, but warn the admin or clean up on Cancel.
- **`layout_seats_changed`:** a seat added in another tab breaks the save. A concurrent seat add via the plain seat list (SEA-01) is the usual trigger.
- **Truncated layouts:** `truncated: true` and the seat cap (`SEAT_LIMITS.list`) can make a full-layout PUT lose data. The editor should refuse to edit a truncated layout.
- **Seat sprites:** only `desk.single` is valid for seats right now (`SEAT_SPRITES`). Multi-tile desks per LAY-01 depend on registry expansion. The palette must be built from `REGISTRY` and the validator's group lists, not hard-coded.
- **Placeholder art:** the atlas is placeholder-only until SIM-033 (D58). The palette will show placeholders, which is acceptable but should be noted in the PR.
- **Rework risk:** the ticket itself flags this as the ticket most likely to need rework. Keep pointer and keyboard handling in small pure helpers so a UX change does not break the tests.
- **High-path gate:** the ticket's gate is plan-approval. Check `.github/risk-tiers.yml` for whether `src/ui/**` or the new route counts as High.

## Open questions
1. **Seat creation timing.** Create at "add" time through the existing POST, or at save time? The PR-level choice affects the partial-failure semantics above.
2. **Seat sprite scope.** Is `desk.single` the only seat sprite for this ticket, or should multi-tile desks be added to the registry here or in SIM-033?
3. **Rooms with no saved layout.** Does the editor start from the computed default (`saved: false`) or from an empty grid? Both are possible. Is room size (w × h) editable in this ticket? The spec says a room has a size in tiles, and the save payload carries `w` and `h`.
4. **Floors.** `floors` (zones) are in the payload. Does LAY-01's "walls/floor" mean the editor paints floor zones in this ticket, or only passes the existing ones through unchanged?
5. **Fixture palette.** LAY-03 lists door, window, wall, stairs, elevator, server rack, cabinet, pillar, plant, blocked area and label. The validator allows 16 groups. Is the palette the full registry minus floors, or the LAY-03 list only? The registry keys are placeholders for some.
6. **Leave guard.** Is a `beforeunload` plus in-editor controls enough, or must every in-app navigation be intercepted?
7. **Where the edit entry point lives.** Is it a button on the room page only, or also in the seat list?

Files looked at:
- d:\project\simap-game-ui\work\tickets\SIM-015.2\ticket.md
- d:\project\simap-game-ui\work\decisions.md (D20, D43, D48, D58)
- d:\project\simap-game-ui\docs\spec-v1.md (SEA-01, LAY-01 to LAY-06)
- d:\project\simap-game-ui\src\lib\sprites\layout.ts
- d:\project\simap-game-ui\src\lib\validate\layout.ts
- d:\project\simap-game-ui\src\app\api\rooms\[id]\layout\route.ts
- d:\project\simap-game-ui\src\server\layout\save.ts
- d:\project\simap-game-ui\src\app\api\rooms\[id]\seats\route.ts
- d:\project\simap-game-ui\src\app\api\seats\[id]\route.ts
