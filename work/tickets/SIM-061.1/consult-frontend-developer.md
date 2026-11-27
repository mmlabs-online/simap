**SIM-061.1 consult (frontend, read-only)**

**Findings**
- The seated avatar and the monitor "screen" glow are drawn on the static canvas by `buildDrawList` (`src/lib/sprites/placement.ts:490-503`). The avatar is drawn when `avatarSeed !== null && presence !== "away"`. The screen glow is drawn only when `presence === "present"`, over `s.monitors` (`placement.ts:109`, `screenRect` at `:124`). Seats without a monitor get no glow, so "present with a monitor" is `present && s.monitors.length > 0`.
- `SeatItem` (`placement.ts:101-111`) is internal. Nothing exposes chair tile, `chairKey`, look or monitor presence to the UI, so the UI cannot yet tell which seats should bob.
- `WalkLayer` (`src/ui/roomlayout/WalkLayer.tsx`) takes only `walks`.
  - Its rAF loop (`:53-61`) stops when `draw()` returns false, and `draw` ends the loop when all walks are done (`:40-43`).
  - `RoomMap.tsx:178` mounts it only when `walks.length > 0`.
  - The idle bob therefore needs a new input, a changed mount condition, and a loop that never "finishes".
- `drawPresence` (`walk.ts:255-263`) hides a walking-in seat by setting it to `"away"`. That also drops the screen glow, which is correct for a walk but wrong for idle.
- Walk plumbing is reusable:
  - `walkerOps(manifest, who, view, x, y, bob)` already lifts the avatar by `bob` px (`walk.ts:223-247`, y at `:241`).
  - `paintWalkers` takes `{ops, alpha}[]` and clears and repaints the whole canvas (`paint.ts:143-172`).
  - `useReducedMotion` is a `useSyncExternalStore` that returns false on the server (`useReducedMotion.ts`).
  - `RoomMap.tsx:95` already has `reduced`.
- The SIM-061 plan (`work/tickets/SIM-061/plan.md:187-191, 225-227`) says: throttled ~2 fps 1 px bob on the `WalkLayer` canvas, present seats only, off under reduced motion and when no seat is present, **paused while the tab is hidden**. The ticket's acceptance criteria omit the hidden-tab pause. Add it.
- Spec PRE-06 (`docs/spec-v1.md:761`) says "typing idle animation and the monitor on". LAY-06 (`:480`) says the same for present. D41/D46/D48 mean 32 px tiles, pixel look, no new art, and a 1 px bob is fine.

**Recommendations**
1. **Pure module in `src/lib/sprites/`** (e.g. `idle.ts`), with tests:
   - `IDLE_MS = 500`.
   - `idleBob(now): 0 | 1 = Math.floor(now / IDLE_MS) % 2`.
   - `idleSeats(...)` returns the seats that bob: present, `avatarSeed` set, has a monitor, chair known, and not currently in `hideSeat`/an active walk (their walk's end state takes over, so no double draw).
   - `idleOps` can wrap `walkerOps(manifest, who, avatarView(chairKey), chairX, chairY, bob)`. Bob 0 equals the static pose, so the handoff after a walk has no jump.
2. **No double avatar.** Drawing a lifted avatar over the static one leaves the static one's bottom pixel row visible. The static layer must skip the avatar for idle seats but keep the screen glow.
   - Add a `placement.ts` option (e.g. `art.idleSeats: ReadonlySet<string>`) that skips the avatar emit at `:493-497` but keeps the screen at `:498-502`.
   - Do not reuse `drawPresence` "away".
   - The same option can expose the idle list from `buildDrawList` (seat, chair x/y, key, seed, look) so the UI does not recompute chair data.
   - Keep the static canvas stable: the idle set only changes with presence, not per tick. Per-tick work stays on the overlay canvas only.
3. **`WalkLayer`:**
   - Add an `idle` prop.
   - Mount when `walks.length > 0 || idle.length > 0 && !reduced`.
   - Use a gated loop: while walks are running, keep the rAF loop. When only idle remains, tick on a `setInterval(IDLE_MS)` or on an rAF that repaints only when `idleBob(now)` changes.
   - Both must stop on unmount, when `idle` is empty, when `reduced` is true, and while `document.hidden` (use `visibilitychange`).
   - `onDone` must fire only for walk completion, not when idle is the only content.
   - Merge idle ops into the same `paintWalkers` call (alpha 1).
4. **Reduced motion:** `reduced` → pass an empty idle list. The avatar then stays on the static layer, because the idle seats set is also empty. Do not keep the "hide from static" set non-empty without the overlay painting it, or the character vanishes.
5. **Tests:**
   - Unit: bob phases, gating (away, unassigned, no monitor, walking seat, reduced, hidden).
   - A `placement` test that the idle seat has no avatar op but keeps its screen op.
   - A `paint.test.ts` case if a new paint path is added.
   - Run `pnpm check:layers`, `pnpm typecheck`, `pnpm test` and `pnpm format:check`.
6. **Naming and copy:** no "photo" in `src/ui/roomlayout/**` or `src/lib/sprites/**` (check comments too). No new UI copy is needed. The overlay canvas is `aria-hidden`.

**Risks**
- Hand-off flicker: if the static layer starts hiding the avatar before the overlay paints it, there is one frame with no avatar. Paint in the `useLayoutEffect` like `WalkLayer:48-51`, and make the overlay mount at the same commit.
- Zoom and bounds changes reset the overlay canvas size, which clears it. Repaint on those changes (the existing `[walks, bounds, zoom]` layout effect needs `idle` too).
- A seat with several monitors or devices still bobs the avatar only. The monitors are static, so the glow stays put (acceptable).
- A chair rotated so the avatar faces away ("front" view): the lift is still 1 px up, which is fine.
- The 30-60 s presence poll replaces the `presence` object. Make sure the idle list is memoised on content, not identity, or the timer and canvas restart each poll.
- Many present seats on a big room: a full-canvas `clearRect` plus N avatar draws at 2 fps is cheap, but the canvas is bounds × zoom (budget in `fitsCanvas`). Over budget, `paintWalkers` returns false and `WalkLayer` calls `onDone`. For idle, fail soft: stop the idle, and make sure the static layer then draws the avatar again.

**Open questions**
- Should "with a monitor" really gate the bob (as the ticket says), or should every present avatar bob? The ticket says monitor, and `monitors` is available, so follow the ticket.
- Should the hidden-tab pause be added to the acceptance criteria? The SIM-061 plan requires it.
- Prefer exposing idle data from `buildDrawList` (touches `placement.ts`, a High-path candidate? check `.github/risk-tiers.yml`) or computing it in a new lib function from layout and views? The first avoids duplicating chair logic. Confirm the tier if `placement.ts` is touched.

Files: `src/ui/roomlayout/WalkLayer.tsx`, `src/ui/roomlayout/paint.ts`, `src/ui/roomlayout/RoomMap.tsx`, `src/lib/sprites/walk.ts`, `src/lib/sprites/placement.ts`.
