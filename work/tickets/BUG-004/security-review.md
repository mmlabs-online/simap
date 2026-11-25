# Security review — BUG-004

## Attempt 1

Batch security review of BUG-003, BUG-004 and BUG-005 (one auditor, read-only, no shell). No security problems in any of the three bugs.

- **BUG-004: 🟢** (`d:\project\simap-game-ui\src\server\members\manage.db.test.ts:150` and `:388`)
  - The tests now expect `cancelledHandoffs` in the `member.deactivate` audit meta: 0 at :150 and 3 at :388. This makes the tests check more, not less.
  - The assertions on cancelled status, `decided_by_id` and `decided_at` (lines 129-133 and 375-379) are still in place.

**Follow-ups:** none.
