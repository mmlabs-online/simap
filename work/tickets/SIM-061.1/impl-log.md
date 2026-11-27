# Implementation log — SIM-061.1

## Attempt 1
### Files touched
- `src/lib/sprites/idle.ts` (new): pure timing and gating (plan).
- `src/lib/sprites/idle.test.ts` (new): unit tests (plan).
- `src/lib/sprites/placement.ts`: `art.idle`, `frameOp` helper, `IdleSeat`, `DrawList.idle` (plan).
- `src/lib/sprites/placement.test.ts`: 3 idle cases in the presence-view block (plan).
- `src/ui/roomlayout/WalkLayer.tsx`: idle painters, idle interval, visibility pause (plan).
- `src/ui/roomlayout/RoomMap.tsx`: `idleFailed`, `idle` option, mount condition (plan).

### Tests added
idle.test.ts (6 cases), placement.test.ts (3 cases) as listed in the plan.

### Checks
- format:check: All matched files use the correct format.
- typecheck + check:layers: types generated; "check-layers: 996 files, no violations".
- test: Test Files 379 passed | 1 skipped; Tests 3691 passed | 9 skipped.
- build: succeeded.

### Out-of-plan files
None.

### Follow-ups
None. Visual check (bob, no ghost pixels, z-order) is Ming's after merge; not run in a browser here.

### Scope self-check
Only plan files changed.
