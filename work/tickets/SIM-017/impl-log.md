
## Attempt 1 — 2026-11-24

Slice 1 only (dashboard, DSH-01 + D34 warning). Search is SIM-017.2/.3.

### Files touched
| File | Required because |
|---|---|
| `src/lib/dashboard/types.ts` | DTOs and `DASHBOARD_LIMITS` (plan) |
| `src/server/dashboard/dashboard.ts` | `getDashboard`: one repeatable-read read-only tx, live counts, per-room via `listRooms`, capped holders |
| `src/server/dashboard/dashboard.db.test.ts` | DB tests AC 1, 3-6 |
| `src/app/api/dashboard/route.ts` | `GET /api/dashboard`, tier `user`, holders for Manager+ |
| `src/ui/dashboard/dashboard-api.ts`, `dashboard-api.test.ts` | API wrapper and its tests |
| `src/ui/dashboard/useDashboard.ts` | load on mount, stale-drop, reload |
| `src/ui/dashboard/StatTile.tsx`, `DashboardView.tsx`, `DashboardView.test.tsx`, `DashboardPage.tsx` | tiles, warning, room grid, page wiring, view tests |
| `src/ui/copy/dashboard.ts` | dashboard copy (D36) |
| `src/ui/index.ts` | export `DashboardPage` |
| `src/app/(app)/page.tsx` | render `DashboardPage` instead of `PageSkeleton` |

### Tests added / changed
- `src/server/dashboard/dashboard.db.test.ts`: all 9 planned tests (empty org, counts, per-room, mutate-and-reread, holders capped, 51-holder cap, includeHolders false, org isolation, tx statements).
- `src/ui/dashboard/dashboard-api.test.ts`: 5 tests (ok, non-ok, signed_out, throw, bad body).
- `src/ui/dashboard/DashboardView.test.tsx`: 9 tests (loading, error, tiles, 0%, room cards, empty, truncated, warning, no warning).
- Fixture note: unplaced devices are `secondary` in tests (schema: primary needs a seat and an occupant owner).

### Checks (actual output summary)
- format:check: exit=0, "All matched files use the correct format."
- typecheck: exit=0
- check:layers: exit=0, "547 files, no violations"
- test: exit=0, "Test Files 209 passed; Tests 2138 passed | 3 skipped"
- build: exit=0
- test:db (local compose Postgres, stopped afterwards): "Test Files 11 passed (11); Tests 145 passed (145)"

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- None.

### Scope self-check
- Could the diff be smaller? No; every file is in the plan.
