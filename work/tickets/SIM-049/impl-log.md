
## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `src/lib/sprites/rotations.ts` (new) | Shared n/s-only rule (allowedRotations, allowedDirs, rotationAllowed, nextRotation) |
| `src/lib/sprites/rotations.test.ts` (new) | R5 tests of the rule |
| `src/lib/validate/layout.ts` | `rotationAllowed` check in `checkGridSpritesRotations` -> `layout_bad_rotation` |
| `src/lib/validate/layout.test.ts` | Split SIM-042 rotation test: four-way keys, n/s-only refusal |
| `src/lib/layout-editor/draft.ts` | `rotateItems` uses `nextRotation`; `NEXT_ROTATION` removed (no other use) |
| `src/lib/layout-editor/draft.test.ts` | Toggle test for the two keys, four-step test for bin.trash |
| `src/lib/map-items/art.ts` | `artDirAllowed` uses `allowedDirs(builtinKey)` |
| `src/lib/map-items/art.test.ts` | artDirAllowed e/w refusal |
| `src/ui/mapItems/map-item-art.ts` | `artDirs` uses `allowedDirs`; dropped unused `MAP_ITEM_DIRS` import |
| `src/ui/mapItems/map-item-art.test.ts` | artDirs n,s test; fixture passes `builtinKey` |
| `src/ui/mapItems/MapItemArtDialog.test.tsx` | Two panels North/South for clock.wall |
| `src/server/layout/layout.db.test.ts` | 90 refused with nothing written; 180 saves and reads back (old 90 projector case changed to 180) |

### Tests added / changed
- rotations.test.ts (3), layout.test.ts (n/s-only refusal; four-way keys test narrowed), draft.test.ts (2), art.test.ts, map-item-art.test.ts, MapItemArtDialog.test.tsx, layout.db.test.ts (2, one replaced).

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: next typegen + tsc ok, no errors
- check:layers: 826 files, no violations
- test: 316 files passed | 1 skipped; 3184 passed | 9 skipped
- build: succeeded
- test:db (local Postgres): 20 files passed, 310 tests passed

### Out-of-plan files
None. place-tool finding: placement is always rotation 0, so no change needed there.

### Follow-ups (noticed, not done)
- If SIM-042 is released before this merges, read 90/270 of these keys as 0/180 (plan Assumptions).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +190 / -25 lines (mostly tests).
