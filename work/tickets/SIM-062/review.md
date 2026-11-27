# Review — SIM-062: Multi-direction walking avatar frames

## Attempt 1 — 2026-11-27
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (1054 files)
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 999 files, no violations"
- `pnpm test` — exit 0, "Test Files 381 passed | 1 skipped (382); Tests 3716 passed | 9 skipped (3725)" (matches impl-log)
- `pnpm build` — exit 0

### Acceptance criteria
- [x] Each POR-06 layer has walking frames for every direction the walk uses, packed into the atlas with manifest
  entries (D45) — evidence: `src/lib/sprites/avatar-walk.test.ts` › "committed manifest and registry have every walk
  frame for every layer, direction and step" (body, shirt, hair.1-3 x n/e/s/w x 2 steps; 32x32, anchor [0,0],
  blocks false) passes; `scripts/sprites/committed-atlas.test.ts` (keys equal registry, sha version, sprite-map keys
  still `map`) passes; 40 entries added in `src/lib/sprites/keys.json`; placeholder art in
  `scripts/sprites/placeholders.mjs` `walkRects` (greys only, seated branch unchanged).
- [x] The walk picks the frame set by direction of travel; swapping art needs no code change — evidence:
  `src/lib/sprites/walk.ts` `walkFrame` sets `walk = { dir: walkDir(a, b), step }` and null at start/end/fades;
  `walkerOps` draws `avatarWalkFrames` with per-layer seated fallback; `WalkLayer.tsx:36` passes `f.walk`. Tests
  `walk.test.ts` › "walk pose: dir from the segment (n/e/s/w), step alternates, seated pose at start/end and in fades"
  and › "walkerOps draws the walk keys for the pose and falls back per layer …"; `pack.test.ts` › "an export PNG for
  an avatar walk key replaces its placeholder" (data-only swap). Key strings live only in `src/lib/sprites/avatar.ts`
  (grep of non-test `src`).
- [x] Unit tests check the manifest has every direction for every layer — evidence: same avatar-walk test, derived
  from exported `WALK_DIRS`, `WALK_STEPS`, `HAIR_STYLES`; plus "walkFrameKeys has 40 keys and equals the registry's
  .walk. avatar keys" (no stray keys).
- [x] All Checks pass — see above.

Ming verification after merge (not verified by the reviewer; carry into the PR):
- Visual: check in/out in a room with a door; the character faces its walking direction on each leg, legs alternate,
  walk ends in the seated pose with no jump, colours match the seated look.
- Real art (non-blocking, D45): draw the 40 frames into `assets/art/export/<key>.png`, run `pnpm sprites:pack`, commit
  `public/sprites/office.png/json`. Add as a Ming-todo item.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: changes are lib/ui/scripts only, layers check green. R4: every changed file is in the plan's
file list (impl-log "Out-of-plan files: None" confirmed against `git diff --stat`). R5: new logic has tests. No High path
touched; no schema, env or server change.

### Blockers from review agents
None.

### Nits (do not block)
- `walk.ts` step is `Math.floor(pos * 2) % WALK_STEPS`: the "2 steps per tile" rate and `WALK_STEPS` are coupled only
  by coincidence; if `WALK_STEPS` ever changes, the cadence stays two changes per tile. Fine for now.
- impl-log notes the plan's "55 map" count was stale (actual 84, unchanged); the committed-atlas test covers it.

### Follow-ups (out of scope)
- Ming-todo: real walk art via `assets/art/export/` (D45).
