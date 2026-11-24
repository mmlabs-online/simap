# Review — SIM-017

## Attempt 1 — 2026-11-24
Verdict: PASS

Scope reviewed: slice 1 only (dashboard, DSH-01 + D34 warning) as re-scoped by the plan's `## Split proposal`; search
is SIM-017.2 / SIM-017.3.

### Checks (run by reviewer)
- `pnpm format:check`: exit=0, "All matched files use the correct format." (601 files)
- `pnpm typecheck`: exit=0 (next typegen + tsc)
- `pnpm check:layers`: exit=0, "check-layers: 547 files, no violations"
- `pnpm test`: exit=0, "Test Files 209 passed (209); Tests 2138 passed | 3 skipped (2141)"
- `pnpm build`: exit=0, route list includes `ƒ /api/dashboard`
- `pnpm test:db` (local compose Postgres, `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap`, stopped afterwards):
  exit=0, "Test Files 11 passed (11); Tests 145 passed (145)" (11 = every tracked `*.db.test.ts`, including
  `src/server/dashboard/dashboard.db.test.ts`)

These match the impl-log numbers.

### Acceptance criteria
- [x] 1 Numbers match the database after any change (no cached counters). Evidence: DB test "numbers follow the
  database after assign, release, device place/return and deactivate" passes. Every total is a `count(*)` in
  `TOTALS_SQL` (`src/server/dashboard/dashboard.ts:30-35`), per-room counts come from `listRooms` (`count(s.id)`,
  `count(s.occupant_id)`, `src/server/rooms/rooms.ts:60-72`), and no stored counter is read. The route sets
  `dynamic = "force-dynamic"` and `Cache-Control: no-store` (`src/app/api/dashboard/route.ts:7,17`). One snapshot:
  `set transaction isolation level repeatable read, read only` (`dashboard.ts:72`, plus DB test "runs begin, set
  transaction ...").
- [x] 2 Shows rooms, seats, occupied, occupancy rate, devices placed and in inventory. Evidence: view test "ready:
  renders the six stat tiles with values" (2/8 seats → 25%), DB test "counts rooms, seats, occupied, devices placed
  and inventory" (secondary device counted as placed, cannot-seat seat counted in seats per A1).
- [x] 3 Per-room breakdown with room cards and occupancy ring. Evidence: view test "ready: renders one RoomCard per
  room, without edit/delete actions" (reuses `RoomCard`, which carries the ring), DB test "per-room counts include
  empty rooms; roomsTruncated false".
- [x] 4 Warning for deactivated members still holding seats, Manager+. Evidence: DB tests "lists deactivated members
  who still hold seats, capped, with true total" (Vietnamese NFC names, 12 seats → seatCount 12 / 10 refs, active
  holder and seatless deactivated member excluded), "holders cap: 51 ... → 50 items, total 51", "holders are null when
  includeHolders is false"; route gates with `atLeast(ctx.tier, "manager")` (`route.ts:14`); view tests "warning shown
  when holders total > 0" and "no warning when holders null or total 0".
- [x] 5 Org isolation (R6). Evidence: DB test "never counts another org's rows". Every subquery and the
  `seats`/`rooms` join repeat `org_id = $1` (`dashboard.ts:30-49`); all queries go through `orgQuery`.
- [x] 6 Empty org reads zero, rate 0. Evidence: DB test "empty org: all zeros, no rooms, holders total 0"; view test
  "ready with zero seats shows 0%" (`occupancyPercent` guards total 0).
- [x] 7 All checks green. Evidence: section above.

Ming verification after merge: none (plan). Optional per plan: look at the dashboard on production data after SIM-021.

### Issues
None.

### Scope
All 14 source files are in the plan's file list; no out-of-plan files; no High path touched (no `db/migrations`,
nothing under `src/server/http/**`). `ticket.md` changes are the state/claim fields and the re-scope that the plan's
split describes (search criteria moved to SIM-017.2).

### Rules (CLAUDE.md)
No violations found.
- R1: `src/server/dashboard/dashboard.ts` starts with `import "server-only"`; only `src/app/api/dashboard/route.ts`
  imports it; page imports `@/ui` only; `check:layers` clean.
- R3: no env or secrets. R6: see AC 5. R7: read-only handler, auth codes only from `withAuth`.
- D36: all copy in `src/ui/copy/dashboard.ts` (copy guards green).

### Blockers from review agents
None.

### Nits (do not block)
- `src/ui/dashboard/useDashboard.ts:26-35`: `reload` does not switch back to `loading`, so "Try again" leaves the old
  error visible until the response arrives. Same as the `useRooms` pattern it copies; fine for now.
- `src/ui/copy/shell.ts:42`: `pages.dashboard.empty` ("No data yet.") is now unused by the dashboard page.
- `src/server/dashboard/dashboard.db.test.ts:18`: `get` helper types `scope`/`p` as `any`; a cast to `OrgScope` /
  `Db` would be tighter.

### Follow-ups (out of scope)
- Create SIM-017.2 (search API, diacritics-insensitive) and SIM-017.3 (search page UI) on the board, per the plan's
  `## Split proposal`.
- Optional separate "cannot seat" count on the dashboard (plan A1).
- Link holder names to the member page once the Members UI (SIM-011.2) lands (plan A3).
