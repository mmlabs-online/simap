# Impl log — SIM-015.4

## Attempt 1 — 2026-11-22

Slice 1 only (pure `src/lib` code and unit tests), per `plan.md`. Branch `ticket/SIM-015.4` confirmed.

### Files touched
| File | Required because |
|---|---|
| `src/lib/sprites/layout.ts` | Adds `LayoutResponse` (shared contract, R1) |
| `src/lib/validate/layout.ts` | `floorCells: 2` in `LAYOUT_LIMITS` and `floorCellsWithinCap` (one cap definition) |
| `src/lib/validate/layout.test.ts` | `floorCellsWithinCap` test group |
| `src/lib/sprites/default-layout.ts` (new) | `defaultLayout` |
| `src/lib/sprites/default-layout.test.ts` (new) | AC3, AC7a |
| `src/lib/sprites/seat-view.ts` (new) | `seatViewOf` |
| `src/lib/sprites/seat-view.test.ts` (new) | AC1, AC6 |
| `src/lib/sprites/resolve-layout.ts` (new) | `parseStoredFloors`, `resolveLayout` |
| `src/lib/sprites/resolve-layout.test.ts` (new) | AC1, AC2, security notes |

### Tests added / changed
- `default-layout.test.ts`: sizes (9 cases), pitch and order, desk.single/floor.wood/no fixtures, diacritics, passes `checkLayoutRules` for every size, maps to a payload `validateLayoutSave` accepts, deterministic, at most 500 seats.
- `seat-view.test.ts`: precedence, cannot-seat keeps seed and name, seed is member id, empty nulls, never pending.
- `layout.test.ts › floorCellsWithinCap`: exactly 2x, one above, 64 full-grid zones, one full-grid zone.
- `resolve-layout.test.ts`: unsaved (2), saved room (2), corrupt floors (14 cases plus known-keys and rules-invariant), corrupt sprites (2), corrupt placement, overlap (3), free slots (3), caps.

### Checks (actual output summary)
- typecheck: exit 0 (`next typegen && tsc --noEmit`, "Types generated successfully")
- format:check: exit 0 ("All matched files use the correct format. Finished in 14ms on 412 files")
- check:layers: exit 0 ("check-layers: 358 files, no violations")
- test: exit 0 ("Test Files  146 passed (146)", "Tests  1556 passed | 3 skipped (1559)")
- build: exit 0 (no new route, as expected for Slice 1)
- The four touched test files alone: "Test Files  4 passed (4)", "Tests  77 passed (77)".
- GitHub CI not run (unavailable); `schema:check` and `test:db` not needed (no SQL or server code).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Orchestrator: create SIM-015.6 (GET route) and repoint SIM-015.3 and SIM-015.5 as the plan says.
- SIM-015.5 should call `floorCellsWithinCap` in the save path.
- `docs/spec-v1.md:362` still says avatar colours come from `sub` (D59 supersedes).

### Scope self-check
- Could the diff be smaller? No; every file is on the plan's list.
- Diff size: 3 modified files +46 / -0 (tracked), plus 6 new files (about 505 lines including tests, before formatting).
