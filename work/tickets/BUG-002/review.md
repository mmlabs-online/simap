## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (821 files)
- `pnpm typecheck` — exit 0, types generated, tsc no errors
- `pnpm check:layers` — exit 0, "check-layers: 767 files, no violations"
- `pnpm test` — exit 0, "Test Files 290 passed | 1 skipped (291)", "Tests 2943 passed | 9 skipped (2952)"
- `pnpm build` — exit 0, build completes (route table printed)
- `pnpm test:db` (local Postgres) — exit 1, "Test Files 3 failed | 17 passed (20)", "Tests 3 failed | 287 passed (290)"; `orgQuery: SQL must filter` hits: 0. The 3 failures are pre-existing on `origin/main` and outside this ticket (see below). Matches impl-log.
- Same `pnpm test:db` on an `origin/main` (a4548e9) worktree: "Tests 19 failed | 271 passed (290)", 32 hits of the orgQuery error; the 16 `handoffs.db.test.ts` failures are the bug, the other 3 are identical to the branch.

### Acceptance criteria
- [x] A regression test reproduces the bug: fails on main before the fix, passes after — evidence: `src/server/devices/handoffs.test.ts` (3 tests). Reviewer copied it onto `origin/main` code: "Tests 3 failed (3)", `Error: orgQuery: SQL must filter org_id = $1` at `org-scope.ts:22`. On the branch it passes (part of the green `pnpm test`). impl-log records the same fail-before. Real-DB evidence: all 16 `handoffs.db.test.ts` start/return/extension tests fail on main and pass on the branch.
- [x] Transfer, return and extension each create the handoff row and `_start` audit row, scoped to the caller's org — evidence: `handoffs.db.test.ts` › "handoffs (db): start › owner (user) starts: pending row, device unchanged, one audit row", "handoffs (db): return › owner starts; nothing else changes; …", "handoffs (db): extension › owner starts: pending, device unchanged, audit, DTO …" all pass; `$1` is bound by `orgQuery` to `scope.orgId` (unit test asserts `values[0] === scope.orgId`). Casts match the schema (`note text`, `new_expires_on date`, `kind text` with check; `db/migrations/20261125120000_device_lifecycle.sql:41-61`); extension reuses `$3` with the same `::uuid` cast both times.
- [x] All checks pass; the orgQuery error no longer appears in `pnpm test:db` — evidence: 0 hits on the branch. Remaining `test:db` reds are pre-existing and out of scope by the ticket's own `## Out of scope` (see analysis); format/typecheck/layers/test/build green.

### Remaining test:db failures (verified on origin/main, unrelated to this fix)
1. `devices.db.test.ts` › "return flags › canReturn … canTakeBack …" — fails on both main and the branch with `violates check constraint "device_handoffs_decided_check"` at `devices.db.test.ts:888`. The test's own raw `update device_handoffs set status = 'cancelled', decided_by_id = $2` omits `decided_at`, which the constraint `(status = 'pending') = (decided_at is null)` (`device_lifecycle.sql:55`) requires. It never threw the orgQuery error: it uses the raw `addTransfer` fixture (`src/test/db/fixtures.ts:100`, plain `db.query`, not `orgQuery`), so it does not touch `handoffs.ts`. The impl-log's attribution of this test to the orgQuery hits is inaccurate (the 32 hits are the 16 handoffs tests, 2 lines each). Test-data bug, explicitly out of scope in ticket.md.
2. `manage.db.test.ts` › "deactivate with release …" — same on main: the audit meta now carries `cancelledHandoffs: 0`, the test's expected object does not. Stale expectation (or contract question), unrelated to the insert SQL.
3. `map-items.db.test.ts` › "list is ordered by lower(name), then builtin_key" — same on main: "wall top" vs "wall t s" order; DB collation vs JS `sort()` difference. Unrelated.

### Issues
None.

### Scope
Changed files: `src/server/devices/handoffs.ts` (+7/-3, the three inserts), `src/server/devices/handoffs.test.ts` (new), plus work files and the BUG-002 board row in `work/backlog.md` (expected by the batch-branch rule). All in plan. No High path touched (`src/server/http/org-scope.ts` unchanged).

### Rules (CLAUDE.md)
No violations found. R6: inserts still bind `org_id` from the verified `scope.orgId` via `orgQuery`. R7: no auth codes added. R1: test imports a type from `@/server/http/org-scope` within the server layer. R5: new regression tests present, checks green except pre-existing out-of-scope `test:db` reds.

### Blockers from review agents
<Filled by the orchestrator from security-review.md.>

### Nits (do not block)
- `handoffs.ts`: the explanatory comment is only on the transfer insert; fine, but the return/extension inserts carry the same pattern uncommented.
- impl-log "BEFORE fix" line wrongly lists devices.db "return flags", map-items and manage among the orgQuery hits; those three fail for other reasons on main.

### Follow-ups (out of scope)
- New bug: `devices.db.test.ts:888` cancels a handoff without setting `decided_at` (violates `device_handoffs_decided_check`); fix the test data.
- New bug: `manage.db.test.ts:145` expected `member.deactivate` meta lacks `cancelledHandoffs`; decide whether the meta or the test is right.
- New bug: `map-items.db.test.ts:82` compares DB `lower(name)` ordering to JS `sort()`; collation mismatch ("wall top" vs "wall t s").
