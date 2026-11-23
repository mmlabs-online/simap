## Findings

Ticket state: `src/app/(app)/rooms/[roomCode]/edit/page.tsx` is only a `PageSkeleton` stub. Note the route param is `[roomCode]`, but the ticket text says `[code]`. The D43 section supersedes the free-form scope. D20 is superseded and D48 sets the tile at 32 px.

Reusable pieces (no new core work needed):
- `src/lib/sprites/layout.ts` has the types `RoomLayout`, `Placement`, `FloorZone`, `LayoutSaveValue` and `LayoutResponse`.
- `src/lib/validate/layout.ts` has `checkLayoutRules`, which the editor can run client-side to preview 422s. It is pure, and `lib` is importable from `ui`. It also exports `footprintOf` and `LAYOUT_LIMITS`. Limits: grid 64 tiles, floors 64, fixtures 2000, body 256 KB.
- `src/lib/sprites/placement.ts` has `resolveFrameKey`, `chairFor`, `ROTATION_TO_DIR` and `buildDrawList(layout, seatViews, manifest)`. A draft layout can render live with `RoomMap`/`paint` unchanged.
- `src/lib/sprites/registry.ts` holds the sprite registry (group, dir, tiles, blocks), and `loadAtlas` loads the manifest. The palette can come from the registry/manifest. Groups allowed as fixtures are listed in `FIXTURE_GROUPS`; the only seat sprite is `desk.single` (`SEAT_SPRITES`).
- `src/ui/roomlayout/RoomMap.tsx` (canvas plus `SeatOverlay`, zoom 2/3/4, clamp) is read-only, with props `layout`, `seatViews`, `zoom`, `onZoom` and `onSelect(seatCode)`. It has no pointer or tile hit-testing. The editor needs its own interaction layer (an overlay div over the canvas, or a shared canvas wrapper) that maps pixel to tile as `floor(px / (32*zoom))`.

API contract (SIM-015.5, in `src/app/api/rooms/[id]/layout/route.ts`):
- GET is tier user and returns `{room, version, saved, layout, seatViews, unplaced[], truncated}`. PUT is tier admin with body `{baseVersion, w, h, floors, seats[{id, sprite, x, y, rotation}], fixtures[{sprite, x, y, rotation}]}`; exact keys are enforced and the 422 codes are listed below.
- The save's `seats` must be exactly the room's seat set. Otherwise the server returns 409 `layout_seats_changed`. A stale `baseVersion` returns 409 `layout_stale`.
- 422 codes: `layout_out_of_bounds`, `layout_overlap`, `layout_bad_rotation`, `layout_unknown_sprite`. 400 `invalid_request` carries a `field`.
- Seats are NOT created or deleted by the layout save. They go through separate calls: `POST /api/rooms/{id}/seats` with `{count}` returns 201 `{items}`, and `DELETE /api/seats/{id}` returns 204 and applies the SEA-01 guard (the refusal code is in `src/server/seats/seats.ts`, not checked). Both are admin and take effect immediately.
- Seat codes (`<room>-NN`) are assigned server-side. The editor must not invent them.
- `unplaced[]` lists seats that exist but have no placement. The editor must show them (a tray) and let the admin place them, since the save requires all seats.
- `truncated` is a risk signal. I did not check what it means for saving, so verify it.
- Floors (`FloorZone` rectangles) exist in the save but are not named in the D43 editor text. LAY-01 lists "walls/floor" as items.

Spec: LAY-01 (tile grid, 4 rotations, a blocking-overlap rule, room size in tiles), LAY-02 (desk = seat, with the SEA-01 guard), LAY-03 (fixture palette), LAY-05 (palette, place by click/drag, R to rotate, delete, multi-select and group move by whole tiles, zoom 2×/3×/4× and pan, undo before save, one save, desktop only). SEA-01 AC: deleting a seat with an occupant or device is refused with a clear message.

## Recommendations

1. Re-scope the ticket text before planning. Replace the "dnd-kit / resize / marquee / 8 px snap" bullets with D43/LAY-05. Replace the "snap math" unit-test AC with tile-quantisation, bounds and overlap math. Replace `[code]` with `[roomCode]`. Fix the Technical notes to say seatMGT is reference only.
2. Architecture, with R1 layers:
   - The pure editor state and reducer go in `src/lib/` (or `src/lib/sprites/editor/`). Tile hit and drag-to-tile math, place/move/rotate/delete, multi-select group move with bounds clamping, undo/redo stacks, dirty check, diff against the loaded layout and building the PUT payload all go there, so they are unit-testable. This is the main deliverable for the "unit tests" AC.
   - The UI goes in `src/ui/roomlayout/LayoutEditor*`, `Palette`, `Inspector` (small: sprite, position, rotation, delete). The page is `src/app/(app)/rooms/[roomCode]/edit/page.tsx`, using the existing `apiFetch`/`rooms-api.ts` style. Add `src/ui/copy/` strings (D36) and extend `src/ui/roomlayout/index.ts`.
   - No dnd-kit. Use pointer events on an overlay and quantise to tiles. It is simpler and avoids a new dependency (the stack is frozen without Ming's decision).
3. Placement validity: run `checkLayoutRules` on every draft change. Refuse or flag an invalid drop (red ghost) before it commits, and show the server error code via copy on 422/409.
4. Seat add flow (AC "Adding a tile creates seat `<room>-NN`"): when the admin places a desk, call `POST /seats {count:1}` at placement time. Server ids and codes then flow into the draft as an unsaved placement. Alternatively create it on Save, but then the seat-id set must be known first. The first option is simpler and matches the save contract, but it leaves an orphan seat in `unplaced` if the user abandons the draft. Pick one explicitly and test the abandon path. The simplest option is "palette desk takes an unplaced seat if one exists, otherwise creates one".
5. Seat delete flow: `DELETE /api/seats/{id}` on delete of a desk, or deferred to Save. Deferring keeps "undo before save" honest but needs the delete refusal surfaced at save time. Recommend deferring: undo works on the draft, and the Save sequence is deletes first, then creates, then PUT with the final seat set. The seat delete/create calls are NOT atomic with the PUT, so handle partial failure with a clear message and a reload. Consider asking for a Delete refusal (code `not_allowed`, 409/422 per R7) to be mapped to a clear copy message and the tile kept.
6. Save: send the full layout with `baseVersion` from GET. On 409 `layout_stale`, offer "reload layout" (don't silently overwrite). On `layout_seats_changed`, reload and re-merge. After success, reset the undo/dirty baseline to the new version.
7. Unsaved-changes guard: `beforeunload` plus an in-app link guard (the App Router has no route-change blocker, so intercept the shell's links or use a confirm in the editor's Back/Cancel). The AC covers "leaving"; a `beforeunload` handler alone doesn't cover in-app navigation. Spell this out in the plan.
8. Keyboard and a11y: R rotate, Delete removes, Ctrl+Z/Ctrl+Shift+Z, arrow keys move the selection by one tile, Esc deselects. Desktop only per LAY-05; show a "use a desktop" notice on narrow screens.
9. Tests: unit for the reducer/diff/payload/undo/clamping, covering overlap-blocked drops, rotated multi-tile footprints (the registry decides `tiles` per direction, do not swap here, as in `footprintOf`) and chair bounds (a chair out of the grid is `layout_out_of_bounds`). Component test for the guard and error mapping. Manual: 20+ seats.
10. Suggested split if M is too big: (a) pure editor state + payload + tests, (b) canvas interaction and palette, (c) seat add/delete wiring + save/guard. The ticket notes it is "most likely to need rework".

## Risks

- Seat create/delete and the layout PUT are separate calls, so a failure in the middle leaves seats and layout inconsistent (orphan or unplaced seats). Mitigate with the unplaced tray and a reload.
- Server-side chair rule: each desk implies a chair tile outside the desk (`chairFor`) that must be in bounds and must not overlap a blocker or another chair. The user cannot see that a drop near an edge will fail unless the ghost previews the chair. Show it.
- Room size (w×h in tiles): the API takes `w`,`h`, and shrinking can orphan items (out of bounds). The editor needs a resize-room control, or the ticket says it is fixed. Unclear in D43 (see below).
- Performance: up to 2000 fixtures and 64×64 tiles. Rebuilding the draw list on each pointer move can be slow, so throttle, or build the list only on commit and use a lightweight ghost during drag.
- `allowedZooms` can return few or no zoom levels for big rooms (`tooLarge`). The editor must still allow editing, or at least pan.
- The placeholder-only atlas (D58): the palette shows placeholder art until SIM-033, and "unknown" sprites are skipped by the draw list. The editor must handle `list.unknown`.
- The save needs the admin tier. A Manager or user opening `/edit` should be redirected or refused (R7 applies to routes, but the page should check roles too).

## Open questions (for Ming)

1. Can the admin change the room's size (w×h) in the editor? LAY-01 says a room has a size in tiles. If yes, what happens to items outside after a shrink: refuse, or clamp and delete?
2. Floors: are floor zones painted in the editor (rectangles or per-tile brush), or kept as the default layout? The save includes `floors`, and LAY-01 mentions "walls/floor".
3. Seat creation timing: create the seat immediately on placing a desk (an orphan seat is possible if the draft is abandoned), or only at Save? The immediate option is my default, but it breaks "undo before save".
4. Is "undo" meant as simple undo (the last N steps) only, or undo plus redo? The spec says "undo of the last steps". How many steps?
5. Should the SEA-01 delete refusal be pre-checked (e.g. a delete-impact call as `rooms/[id]/delete-impact` does for rooms) or only reported when the server refuses?
6. Should `layout_stale` (another admin saved meanwhile) block with a reload, or offer a manual merge? I recommend block and reload.
7. Is the unsaved-changes guard required for in-app navigation, or `beforeunload` only?

Relevant files:
- d:\project\simap-game-ui\work\tickets\SIM-015.2\ticket.md
- d:\project\simap-game-ui\src\app\(app)\rooms\[roomCode]\edit\page.tsx (stub)
- d:\project\simap-game-ui\src\app\api\rooms\[id]\layout\route.ts
- d:\project\simap-game-ui\src\app\api\rooms\[id]\seats\route.ts
- d:\project\simap-game-ui\src\app\api\seats\[id]\route.ts
- d:\project\simap-game-ui\src\lib\validate\layout.ts
- d:\project\simap-game-ui\src\lib\sprites\layout.ts
- d:\project\simap-game-ui\src\lib\sprites\placement.ts
- d:\project\simap-game-ui\src\ui\roomlayout\RoomMap.tsx

Not read: the SIM-015.3 plan body, `src/server/layout/save.ts` and `src/server/seats/seats.ts`. Details of the `truncated` flag and the seat-delete refusal code are therefore unverified.
