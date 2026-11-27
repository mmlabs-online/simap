# Consult — frontend-developer — SIM-061

## SIM-061 consult (frontend, read-only)

### Findings
1. **Draw pipeline today.** `RoomMap.tsx` memoises `buildDrawList(...)` and `paintRoom` runs once per list change in a `useEffect`. `paintRoom` (paint.ts) resizes the canvas, which clears it, and replays every op. There is no clock and no per-frame path. The seated avatar is emitted inside `buildDrawList` (placement.ts ~L492-500). It is three frames (`avatar.body|shirt|hair.N` with `.front` or `.back`, tinted) at `s.chairX, s.chairY`. `away` skips them.
2. **Avatar frames (keys.json).** The only keys are `avatar.{body,shirt,hair.1-3}.{front,back}`. `dir` is null and `blocks` is false. There are no walk-cycle frames and no left/right frames. Phase 1 therefore moves a static front or back sprite along the path, with at most a 1 px bob (a y offset on odd steps). SIM-062 adds directional frames later.
3. **Block rules (LAY-01).** Each frame has `tiles [w,d]` and `blocks`. Desks, doors and most fixtures block. Chairs, floors and avatars do not. The `Item` list in `buildDrawList` already carries x, y, w, d, blocks and the rotated footprint, including catalog rows via `itemBox` and `addRowItem`.
   - Door frames (`door.n|s` is 1x2, `door.e|w` is 2x1) have `blocks:true`. The door's own tiles are therefore never walkable. The walker has to start on the tile in front of the door, and the door has to be treated as "start tiles", not as an obstacle.
   - A desk implies its chair through `chairFor(desk, footprint, dir)`, so the goal tile is `chairX/chairY` (tile units).
4. **Poll diff source.** `seatPresenceMap(seatViews, members)` gives present/away per seat. `CheckinPage` builds `presence` with `useMemo` and passes it down in `presenceView`. A "diff" is therefore the change of `presence[seatId]` between two answers: away to present is a walk-in, present to away is a walk-out. A move is a member whose present seat id changes (same member, a different seat). Keying by `avatarSeed` (the member id) lets a move be told apart from a check-out plus a check-in.
5. **Unknown state.** `presence` is undefined until the first room answer. This is the first-load case and must never animate. Treat the first defined map as the baseline and also reset the baseline on a room change.
6. **The guard test.** `no-photo-on-map.test.ts` text-scans `src/ui/roomlayout/**` and `src/lib/sprites/**` for `/photo/i` and an Avatar import. New files there must avoid the word "photo", for example in comments such as "photograph". `import ... from "@/lib/sprites/avatar"` is fine. Put the path module and walk state in `src/lib/sprites/` (for example `walk-path.ts`, `walk.ts`) and name nothing with "photo".
7. **The SIM-060 carry-over items** are small and independent of the animation. Items 2 and 3 fix review issues. Item 1 is the typing animation (see D below).

### Recommendations

**A. Pure modules (src/lib/sprites, node-testable, each with unit tests).**
- `walk-path.ts`: `findPath(grid, starts, goal) -> Tile[] | null`.
  - Build `blocked: boolean[][]` from the same `Item` list (blocks && non-door, plus tiles outside the room). The cleanest way is to export a small `blockedTiles(layout, manifest, items)` helper from placement.ts or from a new file that `buildDrawList` also uses, so the walk grid and the draw list cannot drift. A second footprint calculation would risk disagreement with the LAY-01 rules.
  - Use 4-neighbour BFS, which is deterministic with a fixed neighbour order and is plenty for rooms of at most a few thousand tiles. Do not allow diagonals, because phase 1 has no diagonal frames.
  - Door start tiles: for each door, the tile or tiles directly in front of its footprint on the room side. Pick the nearest door with a path. Return null for "no door" and for "no path". The goal chair tile is walkable even though a desk beside it blocks. Start from the door, use a multi-source BFS, and stop at the first door that reaches the goal.
  - Return the entry tile (inside the room), so the character appears at the door tile and then walks.
- `walk.ts`: a pure state step. `Walk = {kind:"in"|"out"|"move"|"fade", seatId, path (pixel points), t0, duration}`.
  - `walkPosition(path, elapsedMs, speedTilesPerSec) -> {x, y, done, facing}`. Use a constant speed (about 4 tiles/s), clamped to a total of roughly 1.5 to 3 s. A fixed per-tile time is easier to reason about.
  - `planWalks(prevPresence, nextPresence, seatViews, ...) -> WalkIntent[]`. It does the diffing from finding 4. It returns nothing when `prev` is undefined (baseline).
  - Skip and reduced-motion transitions: `advance(state, event)`, where `skip` and `reducedMotion` both go to `done` or `fade`.
- All functions take explicit times, so tests need no fake timers.

**B. Rendering without an engine.**
- Do not rebuild the draw list per frame. Keep the static list as it is, and make the presence list omit the characters currently being animated (add a `hide: Set<seatId>` or an `animating` input to `buildDrawList`'s `art`. It must not change the cache key every frame, so pass the set only when a walk starts and ends).
- Paint the static layer once per list change as today. For the animation, either:
  1. draw the walker on a second absolutely positioned `<canvas>` over the first, same size, `pointer-events:none`, `aria-hidden`, cleared and redrawn per frame (recommended), or
  2. repaint the whole room each frame.
  Option 1 keeps the redraw cheap (3 `drawImage` calls per walker, tint cache already in `tintedFrame`) and avoids a full replay of every op.
- Layering: a walker is drawn after the floor and furniture of the static canvas, so it would stand in front of tall items such as a desk it walks behind. Phase 1 can ignore depth (the path avoids blocking tiles, and chairs are on the open side of the desk). Document this as a known limit. If it looks wrong, split the static layer in two at the avatar layer, which is a follow-up.
- Clock: one `requestAnimationFrame` loop, started in a `useEffect` only while at least one walk is active, and cancelled on completion or unmount. Idle frames cost nothing. Use the rAF timestamp for `elapsed`. When the tab is hidden, rAF pauses by itself, and on return `elapsed` jumps, so the state step should just finish the walk (clamp, do not catch up frame by frame). The polling already pauses while hidden, so there is no walk burst on return beyond one diff.
- Pixel-space coordinates: tile x TILE plus `f.anchor`, as `emitFrame` does, so the walker lines up with the seated pose at the end. Round to integer pixels to keep `imageSmoothingEnabled=false` crisp. Scale by `effective` zoom with ctx.scale like `paintRoom`.
- Extract the avatar draw out of `paintRoom` if needed, or export a `paintFrame(ctx, atlas, key, tint, x, y)` helper, so the walk canvas reuses `tintedFrame`.

**C. Triggers and skip.**
- In `RoomMap` (or a `useWalks` hook in `src/ui/roomlayout/`), keep `prevPresence` in a ref. On each new `presence` object, call `planWalks`. First defined map, and any `roomId` change, sets the baseline without walking. Per D77 a move walks from the old chair to the new chair, so for a move walk the path from the old chair tile to the new one, or, if that fails, walk-out then walk-in (decide in the plan). Check the PRE-04 rule (no walk-in when checked in by the provider) is a later data field, and keep a `skip` hook on the intent.
- A member's own check-in is local and quick, but the poll can lag up to 45 s. For a snappy own-walk, derive the diff from `myPresence`/`refresh` too. At minimum, `refreshNow` after a check-in or move already updates the map, so the same diff path applies.
- Skip: one `pointerdown` and `keydown` listener on `window`, attached only while a walk is active. They cancel all walks and snap to the end state, and are removed afterwards. Do not call `preventDefault` or swallow the event (a key like Tab must still work). Ignore pure modifier keys.
- Seat buttons (`SeatOverlay`) stay in place during a walk, and the tag shows the final state, so the screen-reader view is unaffected. Add a polite `aria-live` text only if the plan wants one. Not needed by the AC.

**D. Reduced motion.** Read `matchMedia("(prefers-reduced-motion: reduce)")` in a small hook with a change listener (SSR-safe: false on the server). When true, `planWalks` returns no walks, and the end state is drawn (seated or gone) directly. The fade fallback (no door, unreachable chair) is a separate short alpha ramp of about 250 ms, drawn on the overlay canvas with `globalAlpha`. Under reduced motion, skip the fade too, since the AC says "shown seated (or gone) with no walk".

**E. Typing idle (carried from SIM-060).** Keep it small: a seated, present character with a monitor alternates the hand or arm pixel row, or a 1 px head bob, every about 500 ms. Without new frames it can only be a y offset of the avatar layer, so it would need the same overlay canvas. Recommend the plan either defers it to SIM-062 (art) or does the 1 px bob on the overlay, gated by reduced motion and by a cap (no loop when no seat is present). Ask Ming (Q1). A continuous loop for every seated avatar keeps the rAF clock permanently running, which is the main cost, so run it at about 2 fps with a `setInterval`-style throttle if it is done at all.

**F. SIM-060 should-fix items.**
- `SeatOverlay.tsx:34`: replace `presence ?? "present"` by no marker when undefined (`data-marker` absent, or a neutral status dot). Extend the test to assert no `data-marker="dot"`.
- `tag-layout.ts:98-107`: push the dot fallback rect `{x,y,w:DOT,h:DOT}` into `taken`. Add a test with a second row of tags that must not intersect the dots.

**G. Tests to include.** Path found, blocked tiles avoided (desk row between door and chair), door tiles not walkable but the entry tile is, no door, unreachable chair (walled in), two doors choosing the reachable one, deterministic tie-break, chair tile enclosed by desks on three sides. `walkPosition` at t=0, mid, end, and clamped. `planWalks` cases: first map (baseline) gives none, away to present gives walk-in, present to away gives walk-out, move gives one move, reduced motion gives none, room change resets. Skip transition. A `RoomMap` render test for the second canvas is optional (jsdom has no 2D context, as the existing tests work around).

### Risks
- **Drift between the draw list and the walk grid** (footprints for catalog rows, rotation, custom images that block by their whole footprint). Mitigate by sharing one helper (see A).
- **Overlap order**: the walker can draw in front of furniture it passes behind. Acceptable in phase 1, documented.
- **Full-room repaint per frame** would be heavy at zoom 4 on a large map (canvas budget `fitsCanvas`). The overlay-canvas approach avoids that. A second canvas at the same size doubles canvas memory, so size it to the same bounds only while a walk runs and drop it after.
- **Poll jitter**: a walk can start up to 45-60 s after the real event, and two changes in one poll will walk simultaneously. Cap concurrent walkers (for example 8) and fade the rest.
- **A stale diff after failed polls** (`presence` undefined after an error): treat it as "no change", not as everybody leaving. Never feed `undefined` as `next`.
- **Skip listener** on `window` could interfere with typing in other inputs. It only snaps the animation and does not block the event, and a click on the page header is fine.
- **Guard test**: avoid the word "photo" in all new files under roomlayout and sprites.
- The `tags`/focus effects use `list` identity. If the hidden-walker set changes the `list` memo, `paintRoom` re-runs and the SeatOverlay re-renders (focus loss is unlikely since the buttons are keyed by seat). Keep the hide set out of the memo deps, or apply it as a paint filter instead of a draw-list change.

### Open questions
1. Typing idle animation: do it now as a 1 px bob on the overlay, or defer to SIM-062 with art? (Recommend defer or a throttled bob.)
2. Move walks (D77): direct chair-to-chair path, falling back to out-and-in, or always via the door?
3. Should the member's own check-in or move walk start immediately (from the local response) rather than on the next poll?
4. Walk speed and total cap (suggested 4 tiles/s, 3 s cap, 250 ms fade)?
5. Door ownership: a room can have several doors. Pick the nearest with a path, and if the layout stores no door, fade? Confirm "door" means any `door.*` fixture.
6. A walker in front of tall furniture is acceptable in phase 1?
7. A standing start (entry tile in front of the door) versus drawing the character on the door tiles themselves: the door blocks, so the plan should say the character appears on the first free tile at the door (recommended).

Files read: `work/tickets/SIM-061/ticket.md`, `work/tickets/SIM-060/review.md`, `src/ui/roomlayout/RoomMap.tsx`, `src/ui/roomlayout/paint.ts`, `src/lib/sprites/placement.ts`, `src/lib/sprites/avatar.ts`, `src/lib/sprites/keys.json`, `src/lib/presence/seat-presence.ts`, `src/ui/no-photo-on-map.test.ts`. I did not read usePresencePoll.ts, SeatOverlay.tsx or tag-layout.ts in full, so the line numbers for the two should-fix items come from review.md.
