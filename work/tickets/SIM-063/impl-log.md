# Impl log — SIM-063

## Attempt 1 — 2026-11-27

### Files touched
| File | Required because |
|---|---|
| `src/lib/presence/rules.ts` | `decideProviderCheckIn` (insert-only, first source wins; AC2, G1) |
| `src/lib/presence/rules.test.ts` | matrix tests for it |
| `src/lib/presence/provider-time.ts` (+ `.test.ts`) | `providerCheckInAt` clamp, UTC+7 work date (G2) |
| `src/lib/validate/provider-checkin.ts` (+ `.test.ts`) | `parseProviderPull`, member ref and room code validation at the boundary |
| `src/server/presence/provider/types.ts` | `CheckInProvider`, `ProviderPullError` (AC1) |
| `src/server/presence/provider/mock.ts` (+ `.test.ts`) | the only provider that ships |
| `src/server/presence/provider/config.ts` (+ `.test.ts`) | env config, refuses mock in production, no values echoed (High path) |
| `src/server/presence/provider/pull.ts` (+ `.test.ts`) | throttle, single-flight, timeout, redacted failure log |
| `src/server/presence/provider/index.ts` (+ `index.test.ts`) | lazy per-process wiring, `syncProviderCheckIns`; `index.test.ts` covers the plan's "provider off -> no-op" and invalid-config cases |
| `src/server/presence/presence.ts` | shared `lowestSeat`/`todayRow`/`writeCheckIn` helpers extracted from `checkIn` (source now a bound parameter), `applyProviderCheckIn` |
| `src/server/presence/presence.db.test.ts` | provider DB cases |
| `src/app/api/me/presence/route.ts` (+ test) | GET syncs before reading (AC3) |
| `src/app/api/rooms/[id]/presence/route.ts` (+ test) | GET syncs before reading (AC3) |
| `.env.example` | NOT DONE, see Out-of-plan files |

### Tests added / changed
- rules.test.ts › decideProviderCheckIn (5 cases); provider-time.test.ts (4); provider-checkin.test.ts (5)
- mock.test.ts (3); config.test.ts (5); pull.test.ts (8); index.test.ts (3)
- presence.db.test.ts › "presence (db): provider check-in" (8 cases from the plan)
- me/presence and rooms/[id]/presence route tests: GET syncs before reading with ctx.scope; PUT/PATCH/DELETE do not; bad id -> no sync
- Existing `checkin-popup.test.ts` and `walk.test.ts` unchanged and green (AC3 client side).

### Checks (actual output summary)
- typecheck: exit 0 (after fixing a mock type in pull.test.ts)
- check:layers: "check-layers: 1014 files, no violations"
- format:check: "All matched files use the correct format."
- test: exit 0; first full run "Test Files 388 passed | 1 skipped (389), Tests 3770 passed | 9 skipped" (before index.test.ts/typing fix; final run exit 0)
- build: exit 0
- test:db (local Postgres via compose.dev.yml): first run 372 passed, 1 failed in `src/server/devices/history.db.test.ts › holderSince ...` (timing, unrelated file, not touched); immediate rerun of the full suite: "Test Files 23 passed, Tests 373 passed (373)", including the new provider cases.

### Out-of-plan files
- `.env.example` was NOT edited. Reading and appending to `.env*` is denied by the permission system in this session (Bash `printf >> .env.example` was denied), and I did not work around it. The plan expects these lines appended (names only):
  ```
  # Third-party check-in provider (PRE-04). Off when unset; "mock" is for dev and tests and is refused in production.
  # Mock entries: comma-separated <member email or sub>=<ROOM_CODE>.
  SIMAP_PRESENCE_PROVIDER=
  SIMAP_PRESENCE_PROVIDER_MOCK=
  ```
  Ming (or the orchestrator with permission) must add them. Nothing else outside the plan.

### Follow-ups (noticed, not done)
- `history.db.test.ts › holderSince` looks timing-flaky under a full parallel DB run (passed on rerun).
- Declared `globalThis.__simapPresenceProvider` in `provider/index.ts` (same lazy-singleton pattern as `__simapAuth`).

### Scope self-check
- Could the diff be smaller? No; the only addition beyond the plan list is `index.test.ts` (plan test "provider off -> no-op" needs it) and shared validators exported from `provider-checkin.ts` (reused by config.ts).
- Diff size: see `git diff --stat` on the commit.

## Attempt 2 (REWORK: review attempt 1 + security-review finding 1)

### Files touched
- `src/server/presence/provider/config.ts` - mock is now also refused when `SIMAP_DB_TARGET === "production"` (message unchanged, no value echoed); doc comment updated. Required because: security-review finding 1 (dev server pointed at production data).
- `src/server/presence/provider/config.test.ts` - new case: mock + `NODE_ENV=development` + `SIMAP_DB_TARGET=production` throws `ProviderConfigError`.

### Checks (actual output summary)
- format:check: exit 0
- typecheck: exit 0
- check:layers: "check-layers: 1014 files, no violations"
- test: exit 0; "Test Files 388 passed | 1 skipped (389), Tests 3771 passed | 9 skipped (3780)"
- build: exit 0
- test:db (local compose Postgres): "Test Files 23 passed (23), Tests 373 passed (373)"

### Out-of-plan files
None.

### Follow-ups
None new.

### Scope self-check
Two source lines plus one test and a comment; nothing else changed.
