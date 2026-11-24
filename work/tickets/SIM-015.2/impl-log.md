## Attempt 1 — 2026-11-23

Slice 1 only (pure editor core), per plan.md.

### Files touched
| File | Required because |
|---|---|
| `src/lib/validate/layout.ts` | Export `SEAT_SPRITES`, `FIXTURE_GROUPS`, add `spriteInfo` (palette and rotate use the validator's own lists); no rule change |
| `src/lib/layout-editor/types.ts` | Draft model |
| `src/lib/layout-editor/tiles.ts` | AC1 tile math, hit tests |
| `src/lib/layout-editor/draft.ts` | AC2-AC7, AC12 operations (each checked by `checkLayoutRules`) |
| `src/lib/layout-editor/history.ts` | AC8 undo |
| `src/lib/layout-editor/save-plan.ts` | AC6, AC9, AC10 |
| `src/lib/layout-editor/palette.ts` | AC11 |
| `src/lib/layout-editor/{tiles,draft,history,save-plan,palette}.test.ts` | R5 tests listed in the plan |

### Tests added / changed
- All tests listed in plan.md `## Tests to write` (tiles, draft, history, save-plan, palette), plus a small `forgetDeletedSeat` test in save-plan.test.ts.

### Checks (actual output summary)
- format:check: pass
- typecheck + check:layers: pass
- test: Test Files 156 passed (156); Tests 1651 passed | 3 skipped (1654)
- build: pass
- test:db: not run (CI-only, no DB here; no DB code touched)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- `placeFromTray` and `restoreRemovedSeat` take an optional `rotation` (default 0) so a restored seat keeps its baseline rotation through the rules check.
- Slices 2 and 3 and the `ticket.md` re-scope are for the orchestrator (plan A1).

### Scope self-check
- Could the diff be smaller? No; every export is in the plan and tested.
- Diff size: about +400 source lines (7 files incl. one 6-line change to layout.ts), plus tests.
