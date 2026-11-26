## Attempt 1 — 2026-11-26

Slice A only (AC1-4, AC7); Q1 option A (no nav change); AC5 -> SIM-044.1, AC6 -> SIM-045.

### Files touched
| File | Required because |
|---|---|
| `src/lib/devices/visibility.ts` (+ `.test.ts`) | Pure per-tier visibility rule (AC7) |
| `src/lib/devices/cursor.ts` (+ `.test.ts`) | Keyset cursor for "my devices" |
| `src/lib/validate/my-devices-query.ts` (+ `.test.ts`) | Boundary validation of limit/cursor |
| `src/lib/devices/types.ts` | `MY_DEVICES_LIMITS`, `MyDevicesPage`, `pendingHandoff` comment |
| `src/server/devices/devices.ts` | `queryDeviceRows` split, held predicate in list/detail, `listMyDevices` |
| `src/server/devices/history.ts` | Probe joins owner, 404 for a User not holding, before the audit query |
| `src/server/search/search.ts` | `viewer` param; held predicate in the device group |
| `src/app/api/devices/mine/route.ts` | New endpoint |
| `src/app/api/devices/[id]/history/route.ts`, `src/app/api/search/route.ts` | Pass `ctx.sub`/`ctx.tier` |
| `src/server/devices/devices.test.ts`, `history.test.ts` (new), `src/server/search/search.test.ts`, `src/app/api/devices/devices-routes.test.ts`, `src/app/api/search/route.test.ts` | Unit tests per tier and wiring |
| `src/server/devices/devices.db.test.ts`, `history.db.test.ts`, `src/server/search/search.db.test.ts` | New visibility / my-devices DB tests; existing reads of others' devices as "user" switched to manager or now assert 404 |

### Tests added / changed
- visibility.test, cursor.test, my-devices-query.test (new).
- devices.test: per-tier SQL for list/get, listMyDevices (predicate, keyset binds, nextCursor), R6 test extended.
- history.test (new): user not holding -> notFound, no audit query; others proceed; unknown id 404.
- search.test: user binds sub + held predicate; manager/admin do not.
- devices-routes.test: history args; GET /api/devices/mine. search/route.test: viewer arg.
- DB tests (written, NOT run, see below): devices.db visibility + my devices; history.db visibility; search.db device group per tier.

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0; `pnpm check:layers`: "824 files, no violations"
- format:check: "All matched files use the correct format."
- test: Test Files 315 passed | 1 skipped (316); Tests 3170 passed | 7 skipped (3177)
- build: exit 0, route `/api/devices/mine` listed
- test:db: NOT RUN. No DATABASE_URL, no Postgres server, Docker daemon unavailable. DB tests typecheck and are formatted; CI must run them.

### Out-of-plan files
None (`my-devices-query`, search route and test files are listed in the plan's "needed" note). Option B nav files untouched.

### Follow-ups (noticed, not done)
- Slice B (SIM-044.1): seats, members, layout responses for Users.
- Write actions on a device not held still reveal existence (422/409), Q10.
- Other members' email still visible to Users, Q6.
- `devices.db.test.ts` was edited without a DB run: a few existing assertions changed (user now sees only own); verify in CI.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see `git show --stat HEAD`.

## Attempt 2 (REWORK) - 2026-11-26

### Fixed (review attempt 1 issues)
- Issue 1: `src/server/devices/devices.db.test.ts:108` now asserts `!d.mine && d.canPlace` (Manager can place a device they do not own).
- Issue 2: `src/server/search/search.db.test.ts:278,281` store lowercase MACs (`aa:bb:cc:00:00:01/02`); the query stays uppercase, so case-insensitive MAC search is still proved.

### Checks
- test:db (local Postgres 16 on 127.0.0.1:54329, no Docker): exit 0, Test Files 20 passed (20); Tests 307 passed (307). Postgres stopped afterwards.
- format:check: exit 0, all files correctly formatted.
- typecheck: exit 0.
- test: exit 0 (see Vitest summary, all passing).

### Out-of-plan files
None. Follow-ups: none new.
