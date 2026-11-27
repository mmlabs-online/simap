Status: READY

# Plan — SIM-061: Simple walk-in and walk-out

## Scope summary
`docs/spec-v1.md`:
- PRE-07 (L774-781): "On check-in the member's character appears at the room's door and walks along a path on the tile
  grid that avoids blocking items (LAY-01 block rules) to their chair and sits. Check-out plays the reverse." / "A click
  or any key skips to the end state. With `prefers-reduced-motion`, the character is shown seated (or gone) with no
  walk." / "A room with no door, or a chair with no path from a door, falls back to a short fade-in (fade-out) at the
  chair." / "Phase 1 walks with the existing avatar frames".
- PRE-06 (L765-770): "...clicking it ... moves their presence there (PRE-03 move seat) and the character walks to that
  chair (D77)." / "Other members' check-ins, moves and check-outs appear by **polling** every 30–60 s ... with their
  walk-in or walk-out."
- PRE-04 (L745-746): "If the member is already checked in by the provider when they open simap, the popup is skipped and
  their character is shown seated, without the walk-in."
- PRE-05 (L751): "Presence ends by "Check out" (the character walks back out the door, PRE-07)".
- LAY-01 (L439-443): "An item's footprint is its catalog size (width × height at rotation 0; 90° and 270° swap width and
  height)" / "Items cannot overlap where the library says they block ... The validator, layout read and editor take
  footprints from the org's catalog, not from the sprite registry alone."
- PRE-06 (L761) / LAY-06 (L480-481): "Checked in: the character sits at their chair with a typing idle animation and the
  monitor on." (carried item 1; see Split proposal).

`work/decisions.md` D77: "clicking it moves their presence to that seat (the character walks there)."

Ticket notes (carried from SIM-060, work/tickets/SIM-060/review.md): (1) typing idle animation; (2)
`SeatOverlay.tsx:34` treats unknown presence as "present"; (3) `tag-layout.ts:98-107` does not reserve the dot
fallback rect in `taken`.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Check-in: character appears at the room's door, walks a tile-grid path avoiding blocking items (LAY-01) to the chair and sits; check-out plays the reverse; a move walks to the new chair | `walk-path.test.ts` (path found, blocked avoided, door tiles excluded, entry tile, chair goal); `walk.test.ts` › `diffPresence` (in / out / move), `startWalks` (in path = door→chair, out = reversed, move = chair→chair), `walkFrame` (start at entry, end at chair with the seated view), `walkerOps` end position equals the seated avatar ops of `buildDrawList`; code read of `useWalks` / `WalkLayer` wiring in `RoomMap.tsx` |
| 2 | A click or any key skips to the end state | `walk.test.ts` › `isSkipEvent` (pointerdown, letter, Tab, Escape → true; Shift/Control/Alt/Meta alone → false), `skipAll` empties the active walks and the hidden set; code read: listeners on `window` only while walks are active, no `preventDefault` |
| 3 | `prefers-reduced-motion`: shown seated (or gone), no walk | `walk.test.ts` › `startWalks` with `reduced: true` returns no active walks and no fades; code read of `useReducedMotion` (SSR false, change listener) and the skip on a change to true |
| 4 | No door, or no path from a door → short fade-in / fade-out at the chair | `walk-path.test.ts` › no door → `{ ok:false, reason:"no_door" }`, walled-in chair → `"unreachable"`; `walk.test.ts` › `startWalks` gives a `fade` walk for both, `walkFrame` alpha 0→1 (in) and 1→0 (out) over `FADE_MS`, move without a chair-to-chair path gives two fades |
| 5 | Phase 1 uses the existing avatar frames | `walk.test.ts` › `walkerOps` keys are only `avatar.{body,shirt,hair.N}.{front,back}` from `avatarFrames`; no change to `keys.json` / `public/sprites/**` in the diff |
| 6 | Unit tests cover the path function (found, blocked avoided, no door, unreachable) | `pnpm test` green; the named cases exist in `src/lib/sprites/walk-path.test.ts` |
| 7 | (carried 2) Unknown presence is not shown as "present" | `SeatOverlay.test.tsx` › extended "before the first presence answer..." case: no `data-marker="dot"`, no `data-marker="ring"`, no `bg-emerald-400` |
| 8 | (carried 3) The dot fallback rect is reserved in `taken` | `tag-layout.test.ts` › new "a dot is never covered by a later tag" case |
| 9 | Checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test` (incl. `src/ui/no-photo-on-map.test.ts`), `pnpm build` all green |

## Ming verification after merge
The animation itself is visual; the reviewer cannot watch a canvas. Ming checks on a local or hosted run:
- Check in to a room with a door: the character appears on the floor tile next to the door, walks around desks to the
  chair, and the seated pose matches the final walk frame (no jump). Check out: it walks back to the door tile and
  disappears. Click an open tag (D77): it walks chair to chair.
- A second browser (another member) sees the same walks on the next poll (30–60 s).
- Click or press a key during a walk: it snaps to the end state; Tab still moves focus.
- OS reduced motion on: no walk and no fade; the character is just seated (or gone).
- A room without a door (or a walled-in chair): a short fade at the chair.
- Reload the page while checked in (or checked in by another source): no walk-in on arrival (PRE-04).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/walk-path.ts` | New. `walkGrid(layout, lookup)` (blocked tiles, door entry tiles, chair tile per seat) and `findPath` / `pathFromDoor` (4-neighbour BFS) | AC1, AC4, AC6; pure logic first | No |
| `src/lib/sprites/walk-path.test.ts` | New. Path cases | AC6 | No |
| `src/lib/sprites/walk.ts` | New. Pure walk state: `presenceStep`, `diffPresence`, `startWalks`, `walkFrame`, `walkerOps`, `skipAll`, `isSkipEvent`, `hiddenSeats`, `drawPresence`, constants | AC1-AC5 | No |
| `src/lib/sprites/walk.test.ts` | New. State, diff, timing, skip, reduced-motion cases | AC1-AC5 | No |
| `src/ui/roomlayout/paint.ts` | Extract the frame-op branch of `paintRoom` (L114-121) into `drawFrameOp`; add `paintWalkers(canvas, atlas, bounds, zoom, walkers)` (size only when it changed, clear, `globalAlpha` per walker) | Draw walkers on a second canvas reusing `tintedFrame` | No |
| `src/ui/roomlayout/paint.test.ts` | Add `paintWalkers` cases using the existing `fakeCanvas` (L15-32) | New logic has tests (R5) | No |
| `src/ui/roomlayout/WalkLayer.tsx` | New. Absolutely positioned `<canvas aria-hidden pointer-events-none>` over the map, one rAF loop while mounted, calls `onDone` when every walk has finished | Animation without repainting the room per frame | No |
| `src/ui/roomlayout/useWalks.ts` | New. Hook: baseline refs + `presenceStep` in `useLayoutEffect`, walk state, window skip listeners while active, skip on reduced-motion change | Triggers (poll diffs, own changes, moves) | No |
| `src/ui/roomlayout/useReducedMotion.ts` | New. `useSyncExternalStore` over `matchMedia("(prefers-reduced-motion: reduce)")`, server snapshot false (pattern of `src/ui/auth/SignInScene.tsx:11-15,45-49`) | AC3 | No |
| `src/ui/roomlayout/RoomMap.tsx` | Add `roomId` to `PresenceMapProps` (L41-50); memo the walk grid; call `useWalks`; pass `drawPresence(presence, hidden)` to `buildDrawList` (L86-96) and the real `presence` to `SeatOverlay`; paint effect (L101-107) becomes `useLayoutEffect`; render `<WalkLayer>` between the canvas (L145-150) and `SeatOverlay` while walks are active | Wiring | No |
| `src/ui/checkin/CheckinPage.tsx` | Add `roomId` to the `presenceView` object (L132-146) | Baseline reset on room change | No |
| `src/ui/roomlayout/SeatOverlay.tsx` | `NameTag` (L25-70): undefined presence → no marker and a neutral look, never `present` | Carried item 2 | No |
| `src/ui/roomlayout/SeatOverlay.test.tsx` | Extend the case at L184 | Carried item 2 | No |
| `src/lib/sprites/tag-layout.ts` | Dot branch (L98-107): push `{ x: left, y: top, w: DOT, h: DOT }` into `taken` before returning | Carried item 3 | No |
| `src/lib/sprites/tag-layout.test.ts` | New case | Carried item 3 | No |

No file matches a High path in `.claude/loop.config.md`. No `src/server/**`, no API, no migration.

## Data model / migration
None.

## API contract
None. Walks are derived from the existing room presence answer (`useRoomPresence` / `usePresencePoll`) and the
existing own-change refresh (`CheckinPage.tsx:112-122`).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `walk-path.test.ts` › finds a path from the door entry tile to the chair | AC1, AC6 path found |
| › avoids blocking tiles (desk row between door and chair; path goes around, no tile of the path is blocked) | AC1, AC6 blocked avoided |
| › door tiles are never on the path; the path starts on a free tile 4-adjacent to the door | Start tile decision |
| › no door fixture → `{ ok:false, reason:"no_door" }`; a door whose neighbours are all blocked or outside the room → `"no_door"` too | AC4, AC6 no door |
| › chair walled in by blocking items → `"unreachable"` | AC4, AC6 unreachable |
| › two doors, only one reaches the chair → path starts at that one; both reach → the nearer one wins | Door choice |
| › deterministic: same input gives the same path; neighbour order N, W, E, S | Tie-break |
| › chair enclosed by desks on three sides is still reached through the open side | Goal tile walkable |
| › non-blocking items (chairs, floors, sub-tile props) do not block; tiles outside `layout.w × layout.h` are not walkable | LAY-01 rules |
| › catalog footprint wins: a catalog row with a larger size than the library blocks its whole rotated catalog box (lookup from `catalogFootprints`); rotation 90 swaps w/h | LAY-01 "footprints from the org's catalog" |
| › door identified by fixture base sprite `door` at every rotation, also with a catalog row | Door decision |
| › `walkGrid` chair tiles equal `chairFor` used by `buildDrawList` for the same seat (desk.single at 0/90/180/270) | Grid/draw-list agreement |
| › `findPath(grid, [chairA], chairB)` gives a chair-to-chair path; returns null when walled | Move walk |
| `walk.test.ts` › `presenceStep`: first defined map is the baseline (no intents); undefined `next` keeps the baseline and gives none; a `roomId` change resets the baseline with no intents | Baseline, PRE-04, failed poll |
| › `presenceStep`: member present in the first map (self or provider) → no walk-in | PRE-04 |
| › `diffPresence`: away→present = `in`; present→away = `out`; present→absent (seat released) = `out` with the look from the previous views; same member out of A and into B = one `move`; occupant change on one seat = `out` + `in`; same pairs with new view objects = none | AC1 diff |
| › `startWalks`: `in` with a door path → `walk` from entry to chair; `out` → reversed path; `move` → chair-to-chair path; no path → `fade` (move: two fades); `reduced:true` → nothing active | AC1, AC3, AC4 |
| › `startWalks`: a new intent for a member already walking replaces that walk; more than `MAX_WALKERS` (8) → the rest are not animated; an intent for a seat with no chair in the grid is dropped | Caps, robustness |
| › `walkFrame`: t=0 at the first tile, mid-path interpolated, end at the last tile with `done`; time past the end is clamped (hidden tab); duration = 250 ms per step capped at 3000 ms; facing `back` when moving north else `front`; final pose of `in`/`move` = `avatarView(chairKey)`; 1 px bob on alternate half-steps, none at rest | Timing, frames |
| › `walkFrame` fade: alpha 0→1 (in) and 1→0 (out) over `FADE_MS` (250) | AC4 |
| › `walkerOps` at the chair tile with the seated view equals the avatar frame ops `buildDrawList` emits for that seat (same keys, tints, x, y) | No jump at the end |
| › `walkerOps` uses only `avatarFrames` keys | AC5 |
| › `hiddenSeats` = destination seats of active `in`/`move` walks; `drawPresence` marks them `away` and returns the same object when nothing is hidden | Static layer hides walkers |
| › `skipAll` empties the walks; `isSkipEvent` true for pointerdown and non-modifier keys, false for `Shift`, `Control`, `Alt`, `Meta` alone | AC2 |
| `paint.test.ts` › `paintWalkers` draws three frames per walker at integer positions with the zoom scale and bounds translate, sets `globalAlpha` per walker and resets it to 1; does not resize when the size is unchanged; returns false over the canvas budget | Overlay paint |
| `SeatOverlay.test.tsx` › before the first presence answer: no `data-marker="dot"`, no `data-marker="ring"`, no `bg-emerald-400` (extends L184) | Carried 2 |
| `tag-layout.test.ts` › a dot fallback is never covered by a later seat's tag (obstacles force seat 1 to a dot; seat 2's first candidate overlaps that dot; result does not intersect it) | Carried 3 |

All tests are node-only (Vitest, no jsdom, no fake timers): pure functions take explicit `now` values; `.tsx` tests use
`renderToStaticMarkup` as today.

## Approach
1. **Carried fixes first (small, independent).**
   - `tag-layout.ts:98-107`: build the dot rect, `taken.push({ x: left, y: top, w: DOT, h: DOT })`, return it.
   - `SeatOverlay.tsx` `NameTag`: drop `presence ?? "present"`. Undefined presence renders no marker span and a
     neutral look (`bg-surface-container-high text-on-surface`, a new `TAG_NEUTRAL` constant); `data-presence` stays
     absent as today. Present/away rendering is unchanged.
2. **`walk-path.ts` (pure, `src/lib/sprites`).** Use the validator's LAY-01 rules, not the draw list's `Item` list:
   for each seat and fixture, `key = resolveFrameKey(sprite, rotation)`, footprint `footprintAt(sprite, rotation,
   lookup)` (`src/lib/validate/layout.ts:108-117`), blocks `REGISTRY[key].blocks` (as `checkLayoutRules` L220-226).
   The caller passes `lookup = catalogFootprints(items ?? [], registryFootprints)`. Chair tile per seat via
   `chairFor(seat, footprint, REGISTRY[key].dir ?? ROTATION_TO_DIR[rotation])` (as L228-229 and
   `placement.ts:365-366`), keeping `chair.key` for the seated view. Doors = fixtures with base sprite `door`; their
   footprint tiles are blocked; entry tiles = free in-room tiles 4-adjacent to any door tile, in row-major order.
   `WalkGrid = { w, h, blocked: Uint8Array, entries: Tile[], chairs: Record<seatId, { x, y, key }> }`.
   `findPath(grid, starts, goal)`: multi-source BFS, neighbour order N, W, E, S, goal always allowed, returns the tile
   list start→goal or null. `pathFromDoor(grid, seatId)` → `{ ok:true, path } | { ok:false, reason:"no_door" |
   "unreachable" | "no_chair" }`. Rooms are at most `LAYOUT_LIMITS.grid` per side, so BFS is cheap.
3. **`walk.ts` (pure).** Types `Intent` (`in` / `out` / `move`, with seat ids, avatar seed and look) and `ActiveWalk`
   (`walk` with tile path, or `fade` in/out; `t0`, `duration`, seed, look, final view).
   - `presenceStep(baseline, { roomId, presence, views })` → `{ baseline, intents }` implements: room change resets,
     undefined presence keeps, first defined map is the baseline, else `diffPresence`.
   - `diffPresence`: sets of `seat|seed` present before and after; outs and ins are the differences (seeds from the
     previous and the current seat views); one out + one in of the same seed become a `move`.
   - `startWalks(state, intents, grid, now, { reduced })`: reduced → return the state with no walks; else plan each
     intent (in: `pathFromDoor`; out: the same reversed; move: `findPath(grid, [from], to)`), falling back to fades;
     replace walks of the same seed; cap at `MAX_WALKERS = 8`.
   - `walkFrame(walk, now)` → `{ x, y, view, alpha, done }` in tile units; `STEP_MS = 250`, `MAX_WALK_MS = 3000`,
     `FADE_MS = 250`; zero-length path → fade.
   - `walkerOps(manifest, look, seed, view, x, y, bob)` → frame ops like `emitFrame` (`placement.ts:168-188`), pixel
     positions rounded.
   - `hiddenSeats`, `drawPresence`, `skipAll`, `isSkipEvent`.
4. **`paint.ts`.** Extract `drawFrameOp(ctx, atlas, op, createCanvas)` from `paintRoom` L114-121 (no behaviour change;
   existing paint tests stay green); add `paintWalkers`.
5. **Hooks and layer (`src/ui/roomlayout`).** `useReducedMotion`. `useWalks({ roomId, presence, seatViews, grid,
   reduced })` keeps the baseline in a ref and runs `presenceStep` in a `useLayoutEffect` (so the hidden set is applied
   before the browser paints the new presence, no flash of the seated avatar); exposes `{ walks, hidden, finish }`;
   while walks are active it adds `pointerdown` and `keydown` listeners on `window` (passive, no `preventDefault`,
   filtered by `isSkipEvent`) and removes them after; a change of `reduced` to true calls `skipAll`. `WalkLayer`
   mounts only while walks exist (so the second canvas costs memory only during a walk), runs one rAF loop with the
   rAF timestamp, calls `paintWalkers`, and calls `finish` when every `walkFrame` is done; cancels on unmount.
6. **`RoomMap.tsx`.** `grid = useMemo(walkGrid(...))` only when `presenceView` is given (room page untouched);
   `buildDrawList` gets `presence: drawPresence(presence, hidden)` memoised on the hidden key, `SeatOverlay` keeps the
   real `presence` (tags show the final state). The paint effect becomes `useLayoutEffect` so the static canvas shows
   the seated avatar in the same frame the walker canvas unmounts. Own check-in / check-out / move already call
   `poll.refreshNow()` (`CheckinPage.tsx:112-122`), so the same diff path animates them without a separate local path.
7. **Checks**: format, typecheck, check:layers, test, build.

Rules: R1 — new lib files import only `@/lib/**` (`validate/layout`, `map-items/footprints`, sprites); ui files import
only lib and ui; no server code. R3 — no config. R4 — only the files above. R5 — tests listed. The guard
`src/ui/no-photo-on-map.test.ts` scans `src/ui/roomlayout/**` and `src/lib/sprites/**` for `/photo/i`: no new name,
comment or string there may contain "photo" (e.g. no "photograph"). Domain focus: no names or dates are touched;
Vietnamese names only appear in existing tags. UI copy: no new visible text (both canvases are `aria-hidden`).

## Specialist input used
`consult-frontend-developer.md`:
- Adopted: overlay canvas for walkers (B.1), one rAF loop only while walking, clamp on a hidden-tab jump (B), 4-neighbour
  deterministic multi-source BFS from door entry tiles with the chair goal walkable (A), node-testable pure state with
  explicit times (A), baseline on the first map and on room change, never feed `undefined` as next (findings 5, risks),
  move detection by member id (finding 4), window skip listeners only while active, no `preventDefault`, ignore
  modifiers (C), `useSyncExternalStore` reduced-motion hook, no fade under reduced motion (D), walker cap 8 (risks),
  carried fixes F, test list G, guard-test naming (finding 6).
- Changed: blocking grid comes from the validator's LAY-01 rules (`footprintAt` + `REGISTRY.blocks` + catalog lookup)
  instead of the draw list's `Item` list, because a catalog row drawn with frame art keeps the frame's tiles, not the
  catalog box (`placement.ts:246-252`), while LAY-01 says footprints come from the catalog. A test pins chair tiles
  equal to the draw list's.
- Changed: instead of a `hide` input to `buildDrawList`, hidden walkers are passed as `away` in the draw presence, so
  `placement.ts` is not touched and the SeatOverlay keeps the real presence.
- Deferred: typing idle (E) — see Split proposal.

## Assumptions
Decisions on the consult's open questions (Ming may override any at plan approval):
1. **Typing idle (Q1): not in this PR; follow-up slice SIM-061.1.** It needs every present seat on an always-running
   animated layer (permanent second canvas and timer), which is a different cost profile from walks, and it pushes this
   PR well past one review cycle. It stays a P1 item (PRE-06), not moved to SIM-062: SIM-061.1 does a throttled ~2 fps
   1 px bob of present, seated avatars on the `WalkLayer` canvas, off under reduced motion; SIM-062 can replace it with
   real frames.
2. **Move walk (Q2): direct chair-to-chair path**, because D77 says "the character walks there"; if there is no path,
   fade out at the old chair and fade in at the new one (not a long walk via the door).
3. **Own walk (Q3): from the existing refresh, not from the local response.** `CheckinPage.tsx:112-122` already calls
   `poll.refreshNow()` on every own check-in, check-out and move, so the walk starts after one room fetch (well under
   a second) and the diff code has one source of truth. No second path to keep consistent.
4. **Speed and caps (Q4):** 250 ms per tile (4 tiles/s), whole walk capped at 3 s (longer paths walk faster), fade
   250 ms, at most 8 walkers at once (the rest snap to the end state).
5. **Doors (Q5):** a door is any fixture with base sprite `door` (all four rotations, with or without a catalog row or
   custom art). Several doors: the walker starts at the door entry tile nearest the chair by path length. No door
   fixture → fade.
6. **Tall furniture (Q6): accepted in phase 1.** The walker canvas is above the static canvas, so a walker always draws
   in front. Seated avatars already draw on the `avatar` layer above furniture and walls (`types.ts:2`), so this
   matches today's look; real depth sorting is a follow-up if it looks wrong.
7. **Start tile (Q7):** the character appears on the free floor tile next to the door (door tiles block under LAY-01
   and are never on the path); walk-out ends there and the character disappears.
8. Walkers pass through other members' chairs (chairs do not block under LAY-01); blocking occupied chairs could make
   seats unreachable in tight rows.
9. A seat reassigned or released while checked in (PRE-05 auto check-out) walks out with the look from the previous
   seat views; a removed desk (no chair in the grid) gets no animation.
10. End-of-day check-out (PRE-05) can walk many members out on one poll; the cap of 8 keeps it cheap.
11. Hotspots: no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board (`work/backlog.md`), so no rebase is
    expected.

## Blocking questions
None.

## Split proposal
The ticket's acceptance criteria plus the three carried items are above one review cycle (estimate: ~550 production
lines + ~450 test lines for the walk alone).
- **Slice 1 — this plan (SIM-061):** walk-in, walk-out, move walk, skip, reduced motion, fade fallback, path module,
  and carried items 2 and 3 (about 20 lines each). The walk pieces are not split further: a PR with only the pure
  modules would merge unused code, and the reviewer needs the wiring to judge the triggers. Most of the size above
  ~400 lines is tests.
- **Slice 2 — SIM-061.1 (new ticket, size S, ui, Gate plan-approval as P1):** typing idle animation for present, seated
  characters (carried item 1, PRE-06 / LAY-06): a throttled ~2 fps 1 px bob drawn on the `WalkLayer` canvas, present
  seats only, off under reduced motion and when no seat is present, paused while the tab is hidden.

If Ming prefers smaller PRs: slice 1a = carried items 2 and 3 + `walk-path.ts` and `walk.ts` with tests (no visible
change), slice 1b = paint, hooks, `WalkLayer` and `RoomMap` wiring.
