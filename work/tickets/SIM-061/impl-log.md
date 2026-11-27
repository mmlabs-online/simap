## Attempt 1 — 2026-11-27

### Files touched
| File | Required because |
|---|---|
| `src/lib/sprites/walk-path.ts` (new) | `walkGrid`, `findPath`, `pathFromDoor` (AC1, AC4, AC6) |
| `src/lib/sprites/walk-path.test.ts` (new) | Path cases (AC6) |
| `src/lib/sprites/walk.ts` (new) | Pure walk state: `presenceStep`, `diffPresence`, `startWalks`, `walkFrame`, `walkerOps`, `hiddenSeats`, `drawPresence`, `skipAll`, `isSkipEvent` (AC1-AC5) |
| `src/lib/sprites/walk.test.ts` (new) | State, diff, timing, skip, reduced-motion cases |
| `src/ui/roomlayout/paint.ts` | `drawFrameOp` extracted from `paintRoom` (no behaviour change); new `paintWalkers` |
| `src/ui/roomlayout/paint.test.ts` | `paintWalkers` cases |
| `src/ui/roomlayout/WalkLayer.tsx` (new) | Second canvas, one rAF loop while mounted, `onDone` at the end |
| `src/ui/roomlayout/useWalks.ts` (new) | Baseline ref + `presenceStep` in `useLayoutEffect`, window skip listeners while active, skip on reduced motion |
| `src/ui/roomlayout/useReducedMotion.ts` (new) | `useSyncExternalStore` over `prefers-reduced-motion` (AC3) |
| `src/ui/roomlayout/RoomMap.tsx` | `roomId` prop, walk grid memo, `useWalks`, `drawPresence` into `buildDrawList`, paint effect is `useLayoutEffect`, renders `WalkLayer` |
| `src/ui/checkin/CheckinPage.tsx` | Passes `roomId` in `presenceView` |
| `src/ui/roomlayout/SeatOverlay.tsx` | Carried 2: unknown presence shows no marker and a neutral look |
| `src/ui/roomlayout/SeatOverlay.test.tsx` | Carried 2: extended the "before the first presence answer" case |
| `src/lib/sprites/tag-layout.ts` | Carried 3: the dot fallback rect is pushed into `taken` |
| `src/lib/sprites/tag-layout.test.ts` | Carried 3: "a dot is never covered by a later tag" (verified it fails without the fix) |

### Tests added / changed
- walk-path.test.ts: path found; blocked avoided; door tiles never on path / start next to door; no door (none, plugged); no chair; unreachable; two doors (one reaches, nearer wins); deterministic + N,W,E,S order; chair enclosed on three sides; non-blocking items and outside tiles; catalog footprint and rotation 90 swap; door at every rotation with/without catalog row; chair to chair (and walled)
- walk.test.ts: `presenceStep` (baseline, undefined keeps, room change, PRE-04); `diffPresence` (in, out, release with previous look, move, occupant change, new view objects); `startWalks` (in, out reversed, move, fade without door, two fades for a move, reduced, replace, cap 8, no chair dropped); `walkFrame` (start/end/clamp, 250 ms per step capped at 3 s, facing and bob, fade alpha); `walkerOps` equals `buildDrawList` avatar ops at all 4 rotations, only avatar keys; `hiddenSeats`/`drawPresence`/`skipAll`/`isSkipEvent`
- paint.test.ts › paintWalkers (draw, scale/translate/alpha reset, no resize when unchanged, over budget)
- SeatOverlay.test.tsx › before the first presence answer: no dot, no ring, no `bg-emerald-400`
- tag-layout.test.ts › a dot is never covered by a later tag

### Checks (actual output summary)
- typecheck: exit 0 (`next typegen && tsc --noEmit`)
- check:layers: exit 0, "994 files, no violations"
- format:check: exit 0, "All matched files use the correct format."
- test: exit 0, Test Files 378 passed | 1 skipped; Tests 3679 passed | 9 skipped (includes `no-photo-on-map.test.ts`)
- build: exit 0
- test:db: exit 0, Test Files 23 passed; Tests 365 passed

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Typing idle animation: SIM-061.1 (agreed split).
- The walker canvas always draws above the static canvas (tall furniture does not cover a walker); depth sorting if it looks wrong (plan assumption 6).
- The visual walk (timing, no jump at the seat, skip on click/key, reduced motion) cannot be checked in Vitest; see "Ming verification after merge" in plan.md.
- `walkerOps` takes `who` (seed + look) instead of separate look/seed arguments as the plan sketched; same behaviour.

### Scope self-check
- Could the diff be smaller? No (the pure modules, the hook/layer and the two carried fixes are all in the plan; most lines are tests).
- Diff size: modified files +178 / -28; new files about 1080 lines (of which about 540 are tests). No server, API or schema change; no `keys.json` / `public/sprites` change.
