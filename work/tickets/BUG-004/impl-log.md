## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `src/server/members/manage.db.test.ts` (expected meta, ~line 150) | `deactivateMember` writes `cancelledHandoffs` (SIM-037.4); the expectation lacked it. Added `cancelledHandoffs: 0` (no handoffs in this scenario) |

### Tests added / changed
- `src/server/members/manage.db.test.ts` › `members manage (db) › deactivate with release: ... one audit row` (expectation updated)

### Fail before / pass after (local compose Postgres, `pnpm test:db`)
- Before: `FAIL src/server/members/manage.db.test.ts > members manage (db) > deactivate with release: ...` with `AssertionError: expected { seats: 1, demoted: 1, …(4) } to deeply equal { released: true, seats: 1, …(3) }`; diff shows `+ "cancelledHandoffs": 0` (Tests 3 failed | 287 passed, run on the base before any fix).
- After: that test passes; remaining failure is only BUG-005 (map-items.db) (Tests 1 failed | 289 passed).

### Checks (actual output summary)
- format:check / typecheck / test / build: run once at the end of the batch (see BUG-005 impl-log).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- None.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: +1 / -0 lines
