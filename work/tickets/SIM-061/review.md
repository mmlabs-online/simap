## Attempt 1 — 2026-11-27
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 994 files, no violations"
- `pnpm test` — exit 0, Test Files 378 passed | 1 skipped (379); Tests 3679 passed | 9 skipped (includes `src/ui/no-photo-on-map.test.ts`)
- `pnpm build` — exit 0
- `pnpm test:db` — not run by reviewer (CI-only, no schema/server change in this diff; impl-log reports exit 0)
- Matches impl-log.md.

### Acceptance criteria
- [ ] AC1 Check-in walks from the door, check-out reverses, a move walks chair to chair — the pure logic has evidence
  (`walk-path.test.ts` cases L44-190, `walk.test.ts` › diffPresence / startWalks / walkFrame / walkerOps; walkerOps at
  the chair equals the `buildDrawList` avatar ops at all 4 rotations, walk.test.ts:283), but the wiring makes every
  present member walk in after a room switch in a realistic load order — FAILED, see Issue 1. A finished walk-out also
  stays visible at the door while other walks run (Issue 2).
- [x] AC2 Click or any key skips — `walk.test.ts` › "a click or any key skips; a modifier alone does not", "skipAll
  empties the walks"; `useWalks.ts:49-60`: `pointerdown`/`keydown` on `window` only while `active`, `passive: true`,
  no `preventDefault`, removed on cleanup.
- [x] AC3 Reduced motion: no walk, no fade — `startWalks` returns `NO_WALKS` (walk.ts `if (opts.reduced)`), test
  "reduced motion starts nothing and clears running walks"; `useWalks.ts:45-47` skips on a change to true;
  `useReducedMotion.ts` uses `useSyncExternalStore`, server snapshot false.
- [x] AC4 No door / unreachable → fade — `walk-path.test.ts:76,92`, `walk.test.ts:168,177,269`.
- [x] AC5 Existing avatar frames — `walk.test.ts:311` (keys match `avatar.(body|shirt|hair.N).(front|back)`); no
  `keys.json` or `public/sprites/**` change in the diff.
- [x] AC6 Path unit tests (found, blocked avoided, no door, unreachable) — `walk-path.test.ts:44,57,76,92`, green.
- [x] Carried 2 Unknown presence shows no marker — `SeatOverlay.tsx:35-42` (`TAG_NEUTRAL`, marker null for undefined);
  test asserts no dot, no ring, no `bg-emerald-400`. NameTag is rendered only with `tags="always"`
  (`SeatOverlay.tsx:182`), so D50 hover-only views are unchanged.
- [x] Carried 3 Dot fallback reserved — `tag-layout.ts:99-102` pushes the dot rect into `taken`; test "a dot is never
  covered by a later tag" (impl-log: fails without the fix).
- [x] Checks green (above).

Other points the orchestrator asked about, all verified by code read:
- Walk grid = validator rules: `walk-path.ts` uses `resolveFrameKey` + `footprintAt(…, lookup)` + `REGISTRY[key].blocks`
  + `chairFor(seat, fp, REGISTRY[key].dir ?? ROTATION_TO_DIR[rot])`, the same as `checkLayoutRules`
  (`src/lib/validate/layout.ts:218-229`); `RoomMap.tsx` passes `catalogFootprints(items ?? [], registryFootprints)`;
  test "the catalog footprint wins and rotation 90 swaps width and height".
- Door entry tiles: door footprint tiles are blocked; entries = free in-room 4-neighbours, row-major; multi-source BFS,
  fixed N/W/E/S order, goal always allowed.
- First presence answer / failed poll: `presenceStep` — first defined map is only a baseline, `undefined` keeps it
  (walk.test.ts:77,95).
- Move detection: one out + one in of the same seed = `move` (walk.test.ts:126); own-seat moves keep the seed on both
  seats, so a layout reload does not split it.
- rAF loop only while walking: `WalkLayer` mounts only when `walks.length > 0`, the loop stops when every frame is done
  and calls `onDone`; cancelled on unmount.
- D50 for other map views: `grid` is null without `presenceView`, `drawPresence(undefined)` returns undefined, no
  WalkLayer; the paint effect moving to `useLayoutEffect` keeps the same output.
- No "photo" in any new or changed line under `src/ui/roomlayout/**` / `src/lib/sprites/**` (grep), guard test green.
- Recorded deviation `walkerOps(manifest, who, view, x, y, bob)` taking a `Who` object: accepted, same behaviour.

### Issues
#### Issue 1 — 🔴 blocker — correctness (spurious walk-ins on room change, PRE-04 / plan "room change resets")
- **Where**: `src/lib/sprites/walk.ts` `presenceStep` (baseline keyed only by `roomId`) with
  `src/ui/checkin/CheckinPage.tsx:126-131` and `src/ui/seats/useRoomLayout.ts:28-38` (the old layout view stays on
  screen until the new room's layout loads).
- **Expected**: switching rooms never starts walks; the new room's first presence answer is only a baseline.
- **Actual**: on a switch A → B, `roomId` becomes B at once but `mapView` is still A's until B's layout arrives. If B's
  presence answer arrives first, `presence = seatPresenceMap(A.seatViews, B.members)` (all A seats away) becomes the
  baseline for room B. When B's layout then arrives, `presence` is recomputed with B's seat views under the same
  `roomId`, `diffPresence` sees every present member of B as new, and up to 8 characters walk in from the door. Both
  fetches start on the same `roomId` change, so this order is realistic.
- **Fix instruction**: reset the baseline when the layout the views come from changes, not only the room id. In-plan
  option: add the layout identity to the baseline (e.g. `presenceStep(baseline, { roomId, layout, presence, views })`,
  `same = baseline.roomId === roomId && baseline.layout === layout`), pass `layout` from `RoomMap` through `useWalks`
  and add it to the layout effect deps. A layout reload after an own move then only resets the baseline (no intents),
  which is safe in either arrival order. Add a `walk.test.ts` case: "same roomId, new layout object → baseline reset,
  no intents" and one reproducing the sequence above (answer with old views, then same answer with new views → no
  intents). (Alternative: make `CheckinPage` pass `presence: undefined` until the loaded layout belongs to `roomId`;
  that touches `useRoomLayout.ts`, which must then be listed under Out-of-plan files.)

#### Issue 2 — 🟡 should-fix — visual correctness (walk-out does not disappear at the door)
- **Where**: `src/lib/sprites/walk.ts` `walkFrame` (walk branch returns `alpha: 1` when `done`) with
  `src/ui/roomlayout/WalkLayer.tsx:27-45` (keeps drawing every walk until all are done).
- **Expected**: plan "Check out: it walks back to the door tile and disappears".
- **Actual**: when a walk-out finishes while another walk (up to 3 s) is still running, the departed character keeps
  standing on the door entry tile until the last walk ends.
- **Fix instruction**: in `walkFrame`, return `alpha: 0` for a `walk` with `mode === "out"` once `done` (fades already
  end at 0), and add a `walk.test.ts` assertion for it.

### Rules (CLAUDE.md)
No violations found. R1: new lib files import only `@/lib/**`/siblings, ui files import lib and ui (check:layers
green). R3: no config. R4: all changed source files are in the plan's file list. R5: new logic has tests. The
`eslint-disable` comments are inert (no ESLint, D2) but follow the existing repo convention.

### Blockers from review agents
None.

### Nits (do not block)
- `startWalks` (walk.ts): when the cap is reached, a new intent for a member who is already walking is skipped and the
  old walk keeps running (e.g. a member walking in to A who then moves to B shows a walker going to A and a seated
  character at B). Only past 8 walkers; dropping the member's old walk even when the new one is not added would avoid it.
- `WalkLayer`: if a new intent lands in the same tick as `onDone`, `finish` (`skipAll`) also clears the new walk (it
  snaps to the end state). Harmless, but `finish` could drop only walks that are done.

### Follow-ups (out of scope)
- An own check-in from the popup that navigates to another room (`useCheckinFlow` `navigate`) is a room change, so no
  walk-in plays for it; decide whether PRE-07 wants that case animated.
- Typing idle: SIM-061.1 (agreed split). Depth sorting of walkers behind tall furniture (plan assumption 6).

### Ming verification after merge (visual; not checkable in node)
- Check in to a room with a door: the character appears on the floor tile next to the door, walks around desks (not
  through them, also for catalog items larger than the library size) to the chair, and the seated pose matches the last
  walk frame (no jump, no flash of a seated avatar before the walk).
- Check out: walks back to the door tile and disappears; with two members checking out on one poll, neither lingers.
- Click an open tag (D77): walks chair to chair; with no free path, a short fade out and fade in.
- A second browser sees the same walks on the next poll (30–60 s); a member already checked in when the page opens is
  shown seated without a walk-in (PRE-04); reload while checked in: no walk-in.
- Switch rooms with the room switcher several times (also on a slow network): no one walks in on arrival.
- Click or press any key during a walk: everything snaps to the end state; Tab still moves focus, clicks still work.
- OS reduced motion on: no walk and no fade; turning it on mid-walk snaps to the end state.
- Room without a door, or a walled-in chair: a short fade at the chair.
- Name tags before the first presence answer: neutral, no green dot; adjacent tags never cover a dot.
- Seat map / room pages (D50 hover tags): unchanged.

## Attempt 2 — 2026-11-27
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "994 files, no violations".
- `pnpm test` — exit 0 (all test files passed, incl. the new walk.test.ts cases).
- `pnpm build` — first two runs died with a Node worker "Fatal process out of memory: Zone" (exit 3221226505) during page-data collection on this Windows host; re-run with `NODE_OPTIONS=--max-old-space-size=6144` — exit 0. Diff touches no route/page-data code, so the crash is host memory, not the change (attempt 1 built clean on the same host).
- `test:db` not run (nothing outside src/lib and src/ui changed; matches impl-log).

### Acceptance criteria
- [x] Attempt-1 blocker: walk baseline resets on layout change — `walk.ts` `presenceStep` (`same` also requires `baseline.layout === input.layout`); `layout` passed via `RoomMap.tsx:104` and `useWalks.ts` (deps `[roomId, layout, presence]`). `layout` is a stable loaded-state prop (already a memo dependency in RoomMap), so no spurious resets. Tests: "presence arriving before the new room's layout does not walk anyone in", "the same-room layout object keeps the baseline".
- [x] Attempt-1 should-fix: finished walk-out invisible — `walk.ts` `alpha: walk.mode === "out" && done ? 0 : 1`; test "finished walk-out is invisible once done" (alpha 1 at start, 0 at end).
- [x] All other criteria unchanged from attempt 1 (diff of attempt 2 is limited to the four listed files plus work files).

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1 (layers green), R4 (only the four planned-for-rework files changed), R5 (new logic has tests).

### Blockers from review agents
None.

### Nits (do not block)
- Attempt-1 nits (`startWalks` cap handling, `finish` clearing a same-tick new walk) remain, as the implementer noted.
- Build on this Windows host needs a larger Node heap; consider noting it in the README if it recurs.

### Follow-ups (out of scope)
- As attempt 1: own check-in navigating to another room plays no walk-in (PRE-07 decision); typing idle SIM-061.1; walker depth sorting.

### Ming verification after merge (visual; not checkable in node)
As listed in attempt 1 (check-in/out walks, click-tag chair-to-chair, second browser, room switching shows no walk-in on arrival, click/key skip, reduced motion, no-door fade, name tags before first presence).
