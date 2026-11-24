
## Attempt 1 — 2026-11-23 (slice 1 only)

### Files touched
| File | Required because |
|---|---|
| src/lib/devices/types.ts | DTO, filter, limits (plan) |
| src/lib/devices/rules.ts, rules.test.ts | pure permission matrix and `decidePlacement` (AC1, AC2, AC5) |
| src/lib/validate/device.ts, device.test.ts | `parseDeviceQuery`, `validatePlacementPut` |
| src/server/devices/pg-error.ts, pg-error.test.ts | 23505 / 23514 backstops become 409 |
| src/server/devices/devices.ts, devices.test.ts, devices.db.test.ts | list, get, `placeDevice` (lock order rooms, seats, device); fake-db and real-DB tests |
| src/app/api/devices/route.ts, [id]/route.ts, [id]/placement/route.ts | GET list, GET detail, PUT placement |
| src/app/api/devices/devices-routes.test.ts | route contract tests |
| src/lib/api/error.ts, src/ui/copy/api.ts | four new error codes and English copy |

### Tests added / changed
- rules.test.ts: permission matrix (canPlace, canEdit, canCreateFor) and every decidePlacement case in the plan
- device.test.ts: parseDeviceQuery, validatePlacementPut
- pg-error.test.ts: mapping and null cases
- devices.test.ts: lock order, no write on refusal, stale locked seat -> placement_changed, org_id as $1
- devices-routes.test.ts: 401, service args (scope/sub/tier), 404/400 without service call, refusal mapping, no-store
- devices.db.test.ts (written, NOT run locally; no DATABASE_URL, runs in CI via `pnpm test:db`): list/filters/truncation, org scoping, place primary, primary refusals, lend, manager vs user move, return, primary slot freed, stale expectedSeatId, 404 seats, lock wait with owner_not_occupant

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: `next typegen && tsc --noEmit` clean; check:layers: 427 files, no violations
- test: Test Files 171 passed; Tests 1799 passed | 3 skipped
- build: exit 0; routes /api/devices, /api/devices/[id], /api/devices/[id]/placement listed
- test:db: not run locally (CI only)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- devices.db.test.ts was not executed here; if CI shows a failure, check the fixture assumptions first (name updates, 1001-row insert).

### Scope self-check
- Could the diff be smaller? No; every file is in the plan.
- Diff size: new files only plus +8 lines in error.ts / copy/api.ts.
