## Attempt 1 — 2026-11-27

### Files touched
| File | Required because |
|---|---|
| src/lib/sprites/avatar.ts | WALK_DIRS/WALK_STEPS/HAIR_STYLES, WalkPose, walkDir, avatarWalkFrames, walkFrameKeys (key scheme) |
| src/lib/sprites/walk.ts | WalkFrame.walk pose; walkerOps draws walk keys with per-layer seated fallback |
| src/ui/roomlayout/WalkLayer.tsx | pass f.walk to walkerOps |
| src/lib/sprites/keys.json | 40 walk keys (re-serialised in sorted order, then oxfmt) |
| scripts/sprites/placeholders.mjs | grey placeholder walk art (n/e/s, w = mirrored e rects, 2 steps) |
| public/sprites/office.png, office.json | re-packed with `pnpm sprites:pack` (no --force) |
| src/lib/sprites/avatar-walk.test.ts (new), avatar.test.ts, walk.test.ts, scripts/sprites/pack.test.ts | tests listed in plan |
| docs/art/style-guide.md | section 5 and 7 walk frame list |

### Tests added / changed
- avatar-walk.test.ts: 3 tests (manifest+registry coverage, 40 keys = registry, layer/group avatar)
- avatar.test.ts: walkDir, avatarWalkFrames
- walk.test.ts: walk pose test, walkerOps walk keys + fallback test
- pack.test.ts: export PNG for a walk key replaces placeholder

### Checks (actual output summary)
- pack: `sprites:pack: 161 frames (0 export, 84 map, 77 placeholder)` (map count unchanged at 84; plan's "55" was stale; +40 placeholders)
- typecheck: tsc exit 0; check-layers: 999 files, no violations
- format:check: all matched files use the correct format
- test: Test Files 381 passed | 1 skipped; Tests 3716 passed | 9 skipped
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Ming-todo: draw real walk frames into assets/art/export/<key>.png, run `pnpm sprites:pack` (non-blocking, D45).
- Placeholder walk art not visually inspected (no canvas); Ming visual check after merge.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: ~+560 / -70 excluding atlas json/png

## Merge main (after SIM-061.1)

- Merged origin/main (SIM-061.1 typing idle, PR #150). One conflict, `src/ui/roomlayout/WalkLayer.tsx`: kept main's version (`idlePainters` spread, `!ok` / `walksDone` handling) and added SIM-062's trailing `f.walk` argument to the `walkerOps(...)` call. Nothing else from SIM-062 in that file was lost (diff against origin/main is that one line).
- Idle avatars (`idlePainters`) still compile: `walkerOps`' new `walk` parameter is optional (default `null`), so seated callers are unchanged.
- Checks: `pnpm format:check` clean; `pnpm typecheck` and `pnpm check:layers` (1001 files, no violations) pass; `pnpm test` 382 files passed, 1 skipped (3725 tests passed, 9 skipped); `pnpm build` succeeds.
