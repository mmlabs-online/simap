# Implementation log — SIM-039.2

## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| `src/lib/map-items/types.ts` | `bodyBytes`, `MAP_ITEM_DIRS`, patch/art value types (plan step 1) |
| `src/lib/map-items/art.ts` | pure art rules: sizeFor, frameTiles, artDirAllowed, spriteAllowedFor, spriteFits |
| `src/lib/validate/map-item.ts` | boundary validators (key, dir, patch, art) |
| `src/lib/api/error.ts` | codes `item_in_use`, `item_fixed_size`, `item_name_taken`, `sprite_not_allowed`; optional `rooms` |
| `src/ui/copy/api.ts` | English copy for the 4 new codes (typecheck forces it) |
| `src/server/map-items/pg-error.ts` | `item_name_taken` backstop on the unique name index |
| `src/server/map-items/edit.ts` | write service: `updateMapItem`, `setMapItemArt`, `resetMapItem` |
| `src/server/map-items/drive-cleanup.ts` | after-commit best-effort Drive delete (OQ-52) |
| `src/app/api/map-items/[key]/route.ts` | PATCH |
| `src/app/api/map-items/[key]/art/[dir]/route.ts` | PUT |
| `src/app/api/map-items/[key]/reset/route.ts` | POST |

### Tests added / changed
- `src/lib/map-items/art.test.ts` (4 tests per plan)
- `src/lib/validate/map-item.test.ts` (5 tests per plan)
- `src/server/map-items/pg-error.test.ts`, `drive-cleanup.test.ts`
- `src/server/map-items/edit.test.ts` (lock modes, statement order, no write before a refusal)
- `src/app/api/map-items/map-items-admin-routes.test.ts` (6 tests per plan)
- `src/server/map-items/map-items-edit.db.test.ts` (15 DB tests per plan, incl. the two lock-race tests)

### Checks (actual output summary)
- format:check: exit 0, "All matched files use the correct format."
- typecheck: `next typegen && tsc --noEmit` exit 0
- check:layers: "check-layers: 711 files, no violations"
- test: Test Files 268 passed | 1 skipped (269); Tests 2672 passed | 7 skipped (2679)
- build: exit 0
- pnpm migrate (throwaway PostgreSQL 16 cluster under /var/tmp, port 55432, DATABASE_URL inline only): all migrations
  applied incl. `20261125200000_map_items`.
- pnpm test:db: Test Files 1 failed | 17 passed (18); Tests 5 failed | 232 passed (237). All 15 tests of
  `map-items-edit.db.test.ts` pass. The 5 failures are the pre-existing ones in
  `src/server/devices/handoffs.db.test.ts` (start > owner starts / manager starts / second start 409 / two concurrent
  starts / start leaves owner...), present on main (handoffs.ts org filter); recorded, not fixed.
- Cluster stopped and its directory deleted; no `.env*` file read or written.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- `src/server/devices/handoffs.ts` org filter: 5 failing DB tests on main (see above).
- Art pick leaves a custom image in place (image presumably takes precedence at draw time); 039.4/039.6 decide.

### Scope self-check
- Could the diff be smaller? No; product code is the plan's file list, about 60% tests.
- Diff size: 11 product files (3 modified, 8 new) and 7 new test files.
