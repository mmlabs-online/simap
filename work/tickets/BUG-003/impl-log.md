## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `src/server/devices/devices.db.test.ts` (one line, ~889) | The raw update left `decided_at` null on a cancelled row, violating `device_handoffs_decided_check`; added `decided_at = now()` |

### Tests added / changed
- `src/server/devices/devices.db.test.ts` › `devices (db): return flags › canReturn for the owner and a Manager, ...` (existing, fixed)

### Fail before / pass after (local compose Postgres, `pnpm test:db`; the script takes no test filter, so the full suite ran)
- Before: `FAIL src/server/devices/devices.db.test.ts > devices (db): return flags > canReturn for the owner and a Manager, ...` with `error: new row for relation "device_handoffs" violates check constraint "device_handoffs_decided_check"` (Tests 3 failed | 287 passed).
- After: that test passes; remaining failures are only BUG-004 (manage.db) and BUG-005 (map-items.db) (Tests 2 failed | 288 passed).

### Checks (actual output summary)
- format:check / typecheck / test / build: run once at the end of the batch (see BUG-005 impl-log).

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- `scripts/test-db.mjs` does not forward a test filter, so the plan's `pnpm test:db -- <file> -t ...` runs the full suite.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: +1 / -1 lines
