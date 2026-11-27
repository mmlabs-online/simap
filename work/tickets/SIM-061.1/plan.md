Status: READY

# Plan — SIM-061.1: Typing idle animation for present characters

## Scope summary
- `docs/spec-v1.md:761-762` (PRE-06): "Checked in: the character sits at their chair with a typing idle animation and
  the monitor on. Assigned but away: empty chair and a grey name tag. Unassigned seats look as today (LAY-06)."
- `docs/spec-v1.md:480-481` (LAY-06): "an occupied seat also shows **present** (the occupant's character seated,
  typing idle, monitor on) or **away** (empty chair, grey name tag)."
- `work/tickets/SIM-061/plan.md:225-227` (Split proposal, slice 2): "typing idle animation for present, seated
  characters ... a throttled ~2 fps 1 px bob drawn on the `WalkLayer` canvas, present seats only, off under reduced
  motion and when no seat is present, paused while the tab is hidden."
- Ticket scope: "A slow (about 2 frames per second) 1 px bob of the seated avatar for present characters with a
  monitor, drawn on SIM-061's walk overlay canvas; off under `prefers-reduced-motion`; no timer when nobody is present.
  No new art (SIM-062 may add real typing frames later)."
- D41/D46/D48 (`work/decisions.md:48,53,55`): pixel look, 32 px tiles, no new library. No new art here.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Present characters with a monitor bob slowly; away/unassigned seats do not. | `placement.test.ts › presence view (PRE-06) › idle option: present seat with a monitor moves its avatar ops to list.idle and keeps the screen ops`; `› idle option: away, unassigned and present-without-monitor seats are not idle`; `idle.test.ts › idleBob alternates 0/1 every 500 ms` and `› idlePainters lifts every op of every idle seat by the bob`. Code read: `WalkLayer` paints `idlePainters(idle, now)` before the walkers. |
| 2 | Reduced motion: no idle animation. | `idle.test.ts › idleOn is false under reduced motion` (and `› idleOn is false outside the presence view / after a paint failure`). Code read: `RoomMap` passes `idle: idleOn(...)` to `buildDrawList`, so under reduced motion `list.idle` is absent and the avatar stays on the static layer (`placement.test.ts › idle option off gives exactly today's list`). |
| 3 | The timer runs only while at least one present character is on the map (and the tab is visible); all Checks pass. | `idle.test.ts › idleTicking: false with no idle seats, false while the document is hidden, true otherwise`. Code read: `WalkLayer`'s interval effect depends only on that boolean and clears on cleanup; `RoomMap` mounts `WalkLayer` only when `walks.length > 0 \|\| idle.length > 0`. Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` all green. |
| 4 | (from the SIM-061 plan, carried) Paused while the tab is hidden. | Covered by row 3 (`idleTicking` hidden case) plus code read of the `visibilitychange` subscription in `WalkLayer.tsx`. |
| 5 | Walk completion still ends walks; `onDone` is not called when only idle remains. | `idle.test.ts › walksDone is false for an empty walk list` (the guard `WalkLayer` uses before calling `onDone`); existing `walk.test.ts` stays green. |

## Ming verification after merge
- Open the check-in room map in a browser with at least one checked-in member at a desk with a monitor: the seated
  character moves up and down by 1 px about twice a second; the monitor glow stays on; away seats and seats without a
  monitor stay still; no ghost row of pixels under the lifted character.
- Turn on the OS "reduce motion" setting: the characters stay still and remain visible.
- Switch to another tab and back: the bob resumes; a walk-in still plays and the character then bobs at the chair.
- (Visual tolerance) the lifted character now draws above the static `overlay` layer (screen glow, `state.mine.tint`)
  instead of under it, the same as walkers in SIM-061. If that looks wrong, it is a SIM-062 follow-up.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/idle.ts` (new) | Pure timing and gating: `IDLE_MS = 500`, `idleBob(now)`, `idleOn({ presenceView, reduced, failed })`, `idleTicking({ seats, hidden })`, `walksDone(frames)`, `idlePainters(idle, now)` (ops lifted by the bob, alpha 1). | Ticket: "keep pure timing in `src/lib/sprites/`"; rule 6 (pure logic first). | No |
| `src/lib/sprites/idle.test.ts` (new) | Unit tests listed below. | R5. | No |
| `src/lib/sprites/placement.ts` | New `art.idle?: boolean` option; extract a `frameOp(...)` helper from `emitFrame` (`:168-188`); in the seat loop (`:490-503`) an idle seat (option on, `presence === "present"`, avatar drawn, `s.monitors.length > 0`) puts its avatar frame ops into `idle` instead of `ops` (bounds still unioned), screen ops unchanged; `DrawList` (`:37`) gains optional `idle?: IdleSeat[]`, set only when the option is on. Export `type IdleSeat = { seatId: string; ops: FrameOp[] }`. | Avoids the double avatar (consult rec. 2) and reuses the internal chair/monitor data, so the UI does not recompute it. | No (confirmed by the orchestrator; not in `loop.config.md` High paths) |
| `src/lib/sprites/placement.test.ts` | New cases in `describe("presence view (PRE-06)")` (`:597-643`). | R5. | No |
| `src/ui/roomlayout/WalkLayer.tsx` | New props `idle: readonly IdleSeat[]`, `onIdleFail: () => void`; `draw()` paints `idlePainters` then walkers in one `paintWalkers` call; `onDone` only when there are walks and all are done; rAF loop restarts when walks become non-empty; a `setInterval(IDLE_MS)` effect keyed on `idleTicking(...)`; `visibilitychange` subscription; layout effect deps add `idle`. | Ticket: "Reuse SIM-061's `WalkLayer` / `paintWalkers`". | No |
| `src/ui/roomlayout/RoomMap.tsx` | `idleFailed` state; pass `idle: idleOn(...)` to `buildDrawList` (`:113-123`, add to deps); mount `WalkLayer` when `walks.length > 0 \|\| idle.length > 0` (`:178-186`) with `idle` and `onIdleFail`. | Wiring; reduced motion and fail-soft gate. | No |

No change to `paint.ts` (`paintWalkers` at `paint.ts:143-172` already takes frame ops with alpha), `walk.ts` or
`useReducedMotion.ts`.

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/sprites/idle.test.ts › idleBob alternates 0/1 every 500 ms` | 0 at 0 and 499, 1 at 500 and 999, 0 at 1000; ~2 fps. |
| `idle.test.ts › idlePainters lifts every op of every idle seat by the bob` | bob 0 returns ops equal to the input (no jump at hand-off); bob 1 has every `y` one less, `x` unchanged; alpha 1; empty input gives `[]`; input not mutated. |
| `idle.test.ts › idleOn is false under reduced motion` | gating: `reduced: true` → false. |
| `idle.test.ts › idleOn is false outside the presence view / after a paint failure` | `presenceView: false` → false; `failed: true` → false; all good → true. |
| `idle.test.ts › idleTicking: false with no idle seats, false while the document is hidden, true otherwise` | timer gate. |
| `idle.test.ts › walksDone is false for an empty walk list` | `[]` → false; all done → true; one running → false. |
| `src/lib/sprites/placement.test.ts › presence view (PRE-06) › idle option: present seat with a monitor moves its avatar ops to list.idle and keeps the screen ops` | No avatar frames in `ops`; `list.idle[0].seatId === "s1"`; `list.idle[0].ops` equal the avatar ops of `draw({ s1: "present" }, ["Monitor"])`; screen ops still in `ops`; `bounds` equal the option-off bounds. |
| `placement.test.ts › idle option: away, unassigned and present-without-monitor seats are not idle` | away → `idle: []`, no avatar; unassigned (`view()`) → `idle: []`; present with `["PC"]` → `idle: []` and avatar stays in `ops`. |
| `placement.test.ts › idle option off gives exactly today's list` | `{ presence, idle: false }` and no `idle` key both `toEqual` today's call (no `idle` field), so every existing `toEqual` test and `SeatOverlay`/signin/small-world callers are unaffected. |

## Approach
1. **`src/lib/sprites/idle.ts`** (lib layer, pure, no DOM):
   - `export const IDLE_MS = 500;`
   - `idleBob(now: number): 0 | 1` → `Math.floor(now / IDLE_MS) % 2 === 1 ? 1 : 0`.
   - `idlePainters(idle: readonly IdleSeat[], now: number): { ops: FrameOp[]; alpha: number }[]` → each seat's ops
     with `y - idleBob(now)`, alpha 1 (`FrameOp = Extract<DrawOp, { type: "frame" }>`).
   - `idleOn({ presenceView, reduced, failed }): boolean`, `idleTicking({ seats, hidden }): boolean`,
     `walksDone(frames: readonly { done: boolean }[]): boolean` (`frames.length > 0 && frames.every(...)`).
   - Imports only `./placement` types. No "photo" anywhere (comments included).
2. **`placement.ts`**:
   - Add `idle?: boolean` to `art` (`:148-153`) with a doc line: "Presence view only: present seats with a monitor
     return their avatar ops in `idle` (drawn by the overlay canvas) instead of `ops`."
   - Split `emitFrame` (`:168-188`) into `frameOp(...)`, which returns the op or null, and `emitFrame`, which emits it.
     Today's output must not change.
   - Seat loop (`:490-503`): compute `idleSeat = art.idle === true && presence === "present" && s.monitors.length > 0`
     inside the existing `avatarSeed !== null && presence !== "away"` branch. For an idle seat, collect the
     `frameOp` results, union each into `bounds`, and push `{ seatId: s.id, ops }` to a local `idle` array. Otherwise
     emit as today. Screen ops (`:498-502`) and state overlays (`:504-507`) are unchanged.
   - Return `{ ops: sorted, bounds, seats, unknown, ...(art.idle ? { idle } : {}) }`.
   - Walking-in seats are already `"away"` through `drawPresence` (`walk.ts:255-263`), so they never become idle.
     There is no double draw with a walker.
3. **`WalkLayer.tsx`**:
   - `latest` ref holds `idle` and `onIdleFail` too.
   - `draw()`: `now = performance.now()`; `painters = [...idlePainters(idle, now), ...walkers]`; one `paintWalkers` call.
     On `!ok`: call `onIdleFail()` if `idle.length > 0` and `onDone()` if `walks.length > 0`, then return false.
     Then `if (walksDone(frames)) { onDone(); return false; }` and return `walks.length > 0`. So idle alone never calls
     `onDone`.
   - The layout effect deps become `[walks, idle, bounds, zoom]`. It paints before the browser paints, in the same
     commit where the static list drops the avatar, so there is no blank frame.
   - The rAF effect is keyed on `walking = walks.length > 0`. It starts the loop only when walking and cancels on
     cleanup. The mount-once `[]` dependency goes, because the layer now stays mounted between walks.
   - Visibility: `const hidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false)`, with a
     `visibilitychange` listener (pattern: `src/ui/checkin/usePresencePoll.ts:39-42`).
   - Idle effect keyed on `ticking = idleTicking({ seats: idle.length, hidden })`:
     - When ticking, call `draw()` once (resync after the tab comes back).
     - Then run `setInterval(() => { if (latest.current.walks.length === 0) draw(); }, IDLE_MS)`. While walking, the
       rAF loop already paints the idle seats.
     - `clearInterval` on cleanup.
     - The effect depends only on that boolean, so a presence poll that rebuilds `list.idle` (new identity, same
       content) does not restart the timer. The layout effect repaints it instead.
   - Update the component doc comment to cover the idle bob.
4. **`RoomMap.tsx`**:
   - `const [idleFailed, setIdleFailed] = useState(false)`.
   - `const idleEnabled = idleOn({ presenceView: presenceView !== undefined, reduced, failed: idleFailed })`.
   - Pass `idle: idleEnabled` into the `buildDrawList` art (`:116-120`) and add it to the memo deps (`:122`).
   - `const idle = list?.idle ?? []`.
   - Mount condition `walks.length > 0 || idle.length > 0`, with props `idle` and `onIdleFail={() => setIdleFailed(true)}`.
   - Fail-soft: a failed overlay paint rebuilds the list with the option off, so avatars return to the static layer.
   - Reduced motion: the option is off, `idle` is empty, and the avatars stay static. They never vanish.
5. Rules:
   - R1: `src/ui/**` imports only `@/lib/**`, and `idle.ts` is lib-only. Run `pnpm check:layers`.
   - R4: no other files.
   - R5: the tests above.
   - D36: no new UI copy. The overlay canvas stays `aria-hidden`.
   - Ticket note: no "photo" in `src/ui/roomlayout/**` or `src/lib/sprites/**`.
6. Run all Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Specialist input used
`consult-frontend-developer.md`:
- Adopted: present + avatar + `s.monitors.length > 0` gate (finding 1).
- Adopted: pure `idle.ts` with `IDLE_MS = 500` and `idleBob` (rec. 1).
- Adopted: no double avatar. The static layer skips the avatar but keeps the glow, and `drawPresence` "away" is not
  reused (rec. 2).
- Adopted: `WalkLayer` `idle` prop, the new mount condition, `onDone` only for walks, idle merged into one
  `paintWalkers` call (rec. 3).
- Adopted: reduced motion gives an empty idle list and static avatars (rec. 4).
- Adopted: hidden-tab pause, carried from the SIM-061 plan (finding / open question 2), as AC row 4.
- Adopted: risks on flicker (paint in the layout effect, same commit), zoom/bounds repaint, poll identity (the timer
  is keyed on a boolean) and fail-soft over budget.
- Changed: instead of an input set `art.idleSeats` that the UI would have to compute without the chair and monitor
  data, `buildDrawList` takes a boolean `art.idle` and *returns* the idle seats' ops. One call, no circular dependency
  between the list and the idle set.
- Rejected: a `paint.test.ts` case. `paint.ts` does not change, and `paintWalkers` already takes frame ops plus alpha.
- Rejected: an rAF-only idle tick. A 500 ms interval is cheaper, and the rAF loop is kept for walks only.
- Open question 1 (monitor gate): follow the ticket, monitor required.
- Open question 3 (`placement.ts` tier): not a High path, confirmed by the orchestrator.

## Assumptions
1. "With a monitor" means at least one monitor in the seat's drawn devices (`SeatItem.monitors`, frame or catalog
   image), the same condition as the screen glow. Present seats without a monitor keep a still avatar.
2. Bounds are unchanged by the option. A 1 px lift of an avatar on the very top pixel row of the room may clip by
   1 px. This is accepted and not seen in practice (chairs sit inside walls).
3. Idle avatars draw on the overlay canvas, so they are above the static `overlay` layer (screen glow, `state.mine.tint`)
   and below walkers. This is the same accepted z-order as SIM-061 plan assumption 6.
4. When a walk-in finishes, the idle avatar may start at bob 1, a 1 px step. This is acceptable for a 1 px bob.
5. `idleFailed` stays set for the life of the `RoomMap` mount. It only happens when there is no 2D context or the
   canvas is over budget, and in that case the static paint fails too.
6. Hotspots: no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on `work/backlog.md` (only SIM-061.1 is `PLANNING`).
   No rebase is expected.
7. Size: about 120 production lines and about 130 test lines, within one cycle.

## Blocking questions
None.

## Split proposal
None.
