# SIM-062: Multi-direction walking avatar frames

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P2 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-061 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/151 |

## Goal
Characters walk with proper frames for each direction, for every pixel-character layer, instead of the phase 1
frames.

## Scope reference
`docs/spec-v1.md` PRE-07 (art item), POR-06 (character layers); decision D45 (asset rules).

## Scope
- Multi-direction walking frames for each POR-06 layer in the sprite atlas with manifest entries; the walk uses them
  by direction.

## Out of scope
- Path-finding and walk logic (SIM-061).

## Acceptance criteria
- [ ] Each POR-06 layer has walking frames for every direction the walk uses, packed into the atlas with manifest
  entries (D45 asset rules).
- [ ] The walk picks the frame set by direction of travel; swapping the art needs no code change (atlas + manifest
  only).
- [ ] Unit tests check the manifest has every direction for every layer.

## Technical notes
- Files: `public/sprites/office.png/json` via `pnpm sprites:pack`, `src/lib/sprites/avatar.ts`, `keys.json`, credits
  if the art comes from a package.
- Art source may need Ming (as M-63 did for the atlas); record it in `Needs Ming` at PLAN if so.

## Test plan
- Unit: manifest coverage per layer and direction.
- Manual: walk in each direction in a room.

## Notes / answers from Ming

## Handoff

### 2026-11-27 — claude — DONE
- Agent calls: 5, ~237k tokens total (frontend-developer×1 default 43k; planner×1 default 83k; implementer×2 default 52k + 20k (merge of main); reviewer×1 default 40k).
- Done: consult, plan (READY, Gate none, D45 = placeholders now, Ming's art later), attempt 1 implemented, review PASS, merged main after SIM-061.1 (one-line `WalkLayer.tsx` conflict, checks re-run green), PR #151, Ming item M-94 (real walk art, not blocking).
- In progress / next: Ming reviews and merges PR #151; visual check of walking in each direction.
- Gotchas: branch merges main instead of rebasing (no force push). Step rate is hard-coded at 2 per tile, separately from `WALK_STEPS`.
