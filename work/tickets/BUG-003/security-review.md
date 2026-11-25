# Security review — BUG-003

## Attempt 1

Batch security review of BUG-003, BUG-004 and BUG-005 (one auditor, read-only, no shell). No security problems in any of the three bugs.

- **BUG-003: 🟢** (`d:\project\simap-game-ui\src\server\devices\devices.db.test.ts:888-891`)
  - The direct SQL now also sets `decided_at = now()` on the cancelled handoff, so the setup row is consistent and passes the constraint. It doesn't relax or work around the constraint.
  - The update is parameterized (`$1`/`$2`), only touches test setup, and leaves the assertions on lines 887 and 893 unchanged.

**Follow-ups:** none.
