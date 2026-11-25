# Review — SIM-039.3

## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0.
- `pnpm typecheck` — exit 0. `pnpm check:layers` — "check-layers: 719 files, no violations".
- `pnpm test` — exit 0; "Test Files 271 passed | 1 skipped (272)", "Tests 2727 passed | 7 skipped (2734)". Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm migrate` + `pnpm test:db` (reviewer's own throwaway PostgreSQL 16 cluster under /var/tmp, port 55433, trust auth, `DATABASE_URL` inline only, no `.env*` read or written; cluster stopped and directory deleted afterwards) — migrate exit 0 (all applied, through `20261125200000_map_items`); test:db "Test Files 1 failed | 17 passed (18)", "Tests 5 failed | 244 passed (249)". All 5 failures are in `src/server/devices/handoffs.db.test.ts` (`handoffs (db): start` ×5), the known failures that are already on `main`. This branch changes nothing under `src/server/devices` (`git diff --stat origin/main...HEAD -- src/server/devices` is empty). `layout.db.test.ts` and `map-items*.db.test.ts` pass. Matches impl-log.

### Acceptance criteria
- [x] AC1 Existing saved layouts still validate and draw unchanged. Evidence:
  - `src/lib/map-items/footprints.test.ts` › "catalog lookup built from LIBRARY_ITEMS gives footprintOf for every seat/fixture key x rotation with a frame", and › "registryFootprints gives the same as footprintOf". Both pass. `LIBRARY_ITEMS` holds every registry base in `FIXTURE_GROUPS` plus `desk.single` (`library.ts` `build()`), so every key that `spriteOk` accepts is covered.
  - Implementer's note on non-directional items at 90/270: confirmed. `footprintAt` swaps w/h for these, while `footprintOf` does not. They can never reach a size read. `checkGridSpritesRotations` (`src/lib/validate/layout.ts`, "rotation !== 0 && !directional") returns `layout_bad_rotation` first. This happens in `checkLayoutRules`, `checkLayoutBasics` and in the resolver's `take()`, which runs `checkLayoutRules` before `footprintAt`. The only other caller of the default lookup that does not validate first is `fixturesOnDesks` in `src/lib/layout-editor/draft.ts:83` (`withoutDeskFixtures`). It only sees drafts loaded from the resolved server layout, which already dropped any bad rotation. Excluding these combinations from the AC1 test is therefore sound.
  - The existing `layout.test.ts` and `resolve-layout.test.ts` cases are unchanged. The only removed line is an unused import.
  - `layout.db.test.ts` › "a library-size catalog resolves a stored room exactly as the registry does" passes. It uses a directional desk at 90, a door at 90, `table.meeting` and `plant.large`.
  - The read uses a registry fallback for missing catalog rows (`src/server/layout/layout.ts`, `catalogFootprints(..., registryFootprints)`), as in A9.
- [x] AC2 A layout using a resized item is validated at the new size; overlaps are refused. Evidence:
  - `layout.test.ts` › `footprint lookup` "sized rules" ×4 cases plus the null-lookup case.
  - `resolve-layout.test.ts` › `catalog lookup` ×3.
  - `layout.db.test.ts` › "catalog sizes:" ×5: overlap, out of bounds with the 90° swap, a shrunk `table.meeting` accepted, a fixture growing onto a desk, and the read dropping an overlapping stored fixture.
  - Race test "a save waits for an uncommitted resize ... (422 layout_overlap)".
  - All pass.
- [x] AC2b Hidden item already placed is kept; a newly placed one gets 422. Evidence:
  - `layout.db.test.ts` › "hidden items: ...", "hidden floors: ...", "hidden desk.single: ...".
  - `save.test.ts` › hidden fixture count, no hidden key, hidden desk exempt, hidden floor kept/new.
  - `route.test.ts` maps `layout_item_hidden` → 422.
  - `save-errors.test.ts` covers the editor's handling of the new code.
- [x] AC3 Requires R6 org scoping, the audit and green checks.
  - R6: every new statement goes through `orgQuery` with `org_id = $1`: the catalog read in `layout.ts`, and the catalog `for key share`, hidden counts and hidden floors in `save.ts`. `save.test.ts` › "catalog sizes statement: org_id = $1 ..." and `layout.db.test.ts` › "org A's resize and hide do not change org B's save or read" both pass.
  - Audit: `room.layout_save` is unchanged, and refusals throw `Abort` before any write or audit (`save.test.ts` "no write, no audit").
  - Checks: all green, including my own local `test:db` run. The only failures are the 5 known ones on `main`.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the lookup type and builder live in `src/lib`, with no back-import from `validate/layout`; the TDZ-cycle comment is present. Server imports `@/server/map-items/map-items` (server → server). `check:layers` is clean.
- R6: as above.
- R7: the new refusals are domain 422s (`layout_overlap`/`_out_of_bounds`/`_fixture_on_desk`/`_unknown_sprite`/`layout_item_hidden`). All are thrown inside the transaction before the seat update, the fixture delete or the audit. No new 401/403.
- R2/R3: no schema or config change.
- R4: every changed product file is in the plan's file list. `work/ming-todo.md` (M-65/M-66 entries) is backlog bookkeeping.
- R5: new logic is covered by the tests listed above.

### Blockers from review agents
None.

### Nits (do not block)
- `src/lib/validate/layout.ts` `fixturesOnDesks`: with the default lookup, a non-directional fixture at 90/270 now gets a swapped footprint, while the old `footprintOf` did not swap. This is unreachable today (see AC1). A one-line doc note ("assumes rotations already passed `checkLayoutRules`") would stop a future caller from depending on it.
- `src/server/layout/save.ts` `refuseNewHidden`: `rows[0]!` relies on the room lock taken earlier in the same transaction. That is fine, but a short comment would help.

### Follow-ups (out of scope)
- `src/server/devices/handoffs.db.test.ts`: 5 failures already on `main` (`handoffs (db): start`).
- Ming must run the pre-deploy read-only SQL in plan.md ("Ming verification after merge") before 039.3 deploys. After deploy, open a saved room's map and editor and check it looks as before. Both belong in the PR body.
- A8: the editor keeps using registry sizes and still offers hidden items until SIM-039.5.
