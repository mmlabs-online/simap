## Attempt 1 — 2026-11-22
Verdict: PASS

Reviewed at `ea6cfa4` on `ticket/SIM-015.4`. Scope is Slice 1 only (plan.md `## Split proposal`). The GET route, DB tests and the remaining parts of AC1, AC2, AC4, AC5, AC6 and AC7 belong to SIM-015.6 and were not assessed.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format", 412 files.
- `pnpm typecheck` — exit 0, "Types generated successfully", no tsc errors.
- `pnpm check:layers` — exit 0, "check-layers: 358 files, no violations".
- `pnpm test` — exit 0, "Test Files 146 passed (146)", "Tests 1556 passed | 3 skipped (1559)".
- The four touched test files alone — exit 0, "Test Files 4 passed (4)", "Tests 77 passed (77)".
- `pnpm build` — exit 0.
- `pnpm schema:check`, `pnpm test:db` — not run and not needed: this slice has no SQL or server code.
- GitHub CI — unavailable (billing failure), not used as evidence.
- These results match `impl-log.md`.

Extra reviewer check: a throwaway Vitest harness outside the repo, importing the real modules.
- `defaultLayout` for every n from 0 to 501: all pass `checkLayoutRules` and `validateLayoutSave`; at most 500 seats.
- `resolveLayout` on 6,000 seeded random rooms (grids up to 64 x 64, mixed valid and corrupt sprites, rotations, bounds and overlaps): every output passes `checkLayoutRules` and `validateLayoutSave`; every input seat is either placed or in `unplaced`, exactly once.
- In the same run, any stored layout that already passes the rules came back with all seats in place and all fixtures kept, so the greedy `occupied` set did not refuse a layout the validator accepts.
- Hostile `sprite`, `x`, `y`, `rotation` and grid values (null, undefined, NaN, Infinity, -1, 0.5, strings, objects, arrays, booleans): no throw. See Nit 1 for what passes through.
- Bounded work: 100,000 seats, 100,000 fixtures and a 1,000,000-element floor array finished in under 200 ms, with 500 seats handled.

### Acceptance criteria
- [x] AC3, default layout passes the SIM-015.1 rules and can be saved unchanged — evidence: `default-layout.test.ts › passes checkLayoutRules for every size`, `› maps to a payload validateLayoutSave accepts`; harness over every n from 0 to 501.
- [x] AC7a, unit tests cover `defaultLayout` — evidence: `src/lib/sprites/default-layout.test.ts`, passing.
- [x] AC1a, placement, derived status and fixtures (pure part) — evidence: `resolve-layout.test.ts › saved room`, `seat-view.test.ts › precedence`.
- [x] AC1b, untrusted floors and sprites do not crash the read — evidence: `resolve-layout.test.ts › corrupt floors`, `› corrupt sprites`, `› corrupt placement`; harness.
- [x] AC2a, every seat is placed or in `unplaced` — evidence: `› unsaved`, `› free slots`; harness seat-set assertion.
- [x] AC4a, at most 500 seats laid out — evidence: `default-layout.test.ts › lays out at most 500 seats`, `resolve-layout.test.ts › caps seats and fixtures`.
- [x] AC6a, seed is the member id and the view has no `sub` — evidence: `seat-view.test.ts › seed is the occupant member id`; `src/lib/sprites/seat-view.ts:17` returns only `state`, `avatarSeed`, `name`.

Rule agreement:
- Overlap: `resolve-layout.ts:77-87` holds blocking cells and chair cells in one set, which gives the same result as `validate/layout.ts:150-166` (a chair may not be on a blocking tile or another chair; non-blocking items conflict with nothing).
- Chair: `resolve-layout.ts:83` uses `chairFor` with the same direction expression as `validate/layout.ts:138-139` and `placement.ts:173-174`.

Ming verification after merge: none (plan.md).

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: all new code is in `src/lib` and `check:layers` is clean. R2, R3: no schema, config or secret change. R4: every changed `src/` file is on the plan's list, and no High path changed. R5: checks are green and new logic has tests. R6, R7: not reached in this slice.

### Blockers from review agents
Not assessed here. `work/tickets/SIM-015.4/security-review.md` appeared during this review; the orchestrator must apply any blocker from it.

### Nits (do not block)
- Nit 1: `resolveLayout` does not re-check that stored `x` and `y` are integers (`resolve-layout.ts:68-71`), because `checkLayoutRules` does not either. Values such as `0.5` or `null` pass through. Not reachable from the database: `tile_x` and `tile_y` are `integer`, and the placement check requires all four columns or none (`db/migrations/20261122120000_room_tile_layout.sql:15-19`, `:27-32`).
- Nit 2: `placement: undefined` throws at `resolve-layout.ts:94` because the guard is `!== null`. The type excludes it and a SQL NULL arrives as `null`, so stored data cannot trigger it unless the SIM-015.6 row mapper produces `undefined`.
- Nit 3: the plan's `› output always passes the rules` test runs only over the corrupt-floor cases (`resolve-layout.test.ts:114-119`). The sprite, placement and most free-slot tests assert it individually, but two overlap tests do not. The reviewer harness covered the invariant.

### Follow-ups (out of scope)
- SIM-015.6: map a seat row with null tile columns to `placement: null`, never `undefined` (Nit 2).
- SIM-015.5: call `floorCellsWithinCap` in the save path.
- Orchestrator: create SIM-015.6 and repoint SIM-015.3 and SIM-015.5 to it, as plan.md requires before this ticket closes.
- `docs/spec-v1.md:362` still says avatar colours come from `sub`; D59 supersedes it.
