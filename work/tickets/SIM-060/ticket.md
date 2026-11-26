# SIM-060: Multi-direction walking avatar frames

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-059 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

## Goal
Characters walk with proper frames for each direction, for every pixel-character layer, instead of the phase 1
frames.

## Scope reference
`docs/spec-v1.md` PRE-07 (art item), POR-06 (character layers); decision D45 (asset rules).

## Scope
- Multi-direction walking frames for each POR-06 layer in the sprite atlas with manifest entries; the walk uses them
  by direction.

## Out of scope
- Path-finding and walk logic (SIM-059).

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
