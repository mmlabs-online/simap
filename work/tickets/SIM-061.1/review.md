# Review — SIM-061.1

## Attempt 1
Verdict: PASS

Date: 2026-11-27

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers`: exit 0, "check-layers: 996 files, no violations".
- `pnpm test`: exit 0, "Test Files 379 passed | 1 skipped (380)", "Tests 3691 passed | 9 skipped (3700)". This matches impl-log.
- `pnpm build`: exit 0, build succeeded.

### Acceptance criteria
- [x] 1. Present characters with a monitor bob slowly; away and unassigned seats do not. Evidence:
  - `placement.test.ts › presence view (PRE-06) › idle option: present seat with a monitor moves its avatar ops to list.idle and keeps the screen ops` passes.
  - `› idle option: away, unassigned and present-without-monitor seats are not idle` passes.
  - `idle.test.ts › idleBob alternates 0/1 every 500 ms` and `› idlePainters lifts every op of every idle seat by the bob` pass.
  - Code: the gate is at `src/lib/sprites/placement.ts:519`. `WalkLayer.tsx` paints `idlePainters` before the walkers in a single `paintWalkers` call, and `paintWalkers` clears the canvas on each paint (`paint.ts:162`), so no ghost row is left behind.
- [x] 2. Reduced motion: no idle animation. Evidence:
  - `idle.test.ts › idleOn is false under reduced motion` passes.
  - `RoomMap.tsx:115` feeds `idleOn` into `buildDrawList`. With the option off, avatars stay on the static layer (`placement.test.ts › idle option off gives exactly today's list` passes, and that test also asserts there is no `idle` key).
- [x] 3. The timer runs only while at least one present character is on the map; all Checks pass. Evidence:
  - `idle.test.ts › idleTicking: ...` passes.
  - `WalkLayer.tsx:85-95`: the interval effect depends only on the `ticking` boolean and is cleared on cleanup.
  - `RoomMap.tsx:188` mounts the layer only when there are walks or idle seats.
  - All Checks are green (see above).
- [x] 4. Paused while the tab is hidden. Evidence: the `idleTicking` hidden case passes, and `WalkLayer.tsx` reads `document.hidden` through `useSyncExternalStore` with a `visibilitychange` subscription.
- [x] 5. `onDone` is called only for walk completion. Evidence:
  - `idle.test.ts › walksDone is false for an empty walk list` passes.
  - `WalkLayer.tsx:55` uses `walksDone`.
  - On a failed paint, `onDone` is called only if walks exist, and `onIdleFail` only if idle seats exist (`:51`).
  - The rAF loop is keyed on `walking` (`:70`). `finish` clears all walks (`useWalks.ts:66`, `skipAll`), so the loop restarts cleanly for the next walk.
  - The existing `walk.test.ts` still passes.

Ming verification after merge (carry into the PR):
- In a browser, check the bob on the check-in map: 1 px about twice a second, the monitor glow stays on, away seats and seats without a monitor stay still, and no ghost pixels appear.
- With OS reduce motion on, characters are still and remain visible.
- Switch tabs and come back: the bob resumes, a walk-in still plays, and the character then bobs at the chair.
- Z-order tolerance: the lifted character draws above the screen glow and the "mine" tint.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/lib/sprites/idle.ts` imports only `./placement` types. The UI files import `@/lib/**` only, and `check:layers` is clean.
- R4: the changed source files match the plan's file list exactly. Besides those, only `work/` files changed: the ticket, plan, consult and impl-log, plus the M-93 entry in `work/ming-todo.md` that records the approval.
- R5: the new logic has unit tests.
- The ticket note "no 'photo'" holds: grep of the source diff finds nothing.

### Blockers from review agents
None.

### Nits (do not block)
- `RoomMap.tsx:133`: `list?.idle ?? []` creates a new array on each render when idle is off. While a walk runs, this makes `WalkLayer`'s layout effect (deps `[walks, idle, bounds, zoom]`) repaint on every `RoomMap` re-render. It is harmless, because the rAF loop already repaints each frame. A module-level `const NO_IDLE: IdleSeat[] = []` would avoid it.
- The `// eslint-disable-next-line` comments copied from SIM-061 are inert, because the project has no ESLint (D2).

### Follow-ups (out of scope)
- SIM-062 may replace the 1 px bob with real typing frames and revisit the idle avatar's z-order against the glow and tint.
