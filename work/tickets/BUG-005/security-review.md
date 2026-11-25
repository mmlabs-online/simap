# Security review — BUG-005

## Attempt 1

Batch security review of BUG-003, BUG-004 and BUG-005 (one auditor, read-only, no shell). No security problems in any of the three bugs.

- **BUG-005: 🟢** (`d:\project\simap-game-ui\src\server\map-items\map-items.ts:71-76`)
  - **Org scoping (R6):** kept. The query still goes through `orgQuery` with `where org_id = $1`, and `includeHidden` is still bound as `$2`.
  - **Injection:** none. `collate "C"` is a fixed literal. The other interpolations are `${COLS}` and `${MAP_ITEM_LIMITS.list}`, which are existing code constants. Nothing from the request ends up in the SQL string.
  - **Hidden rows:** the Admin-only gate (`$2::boolean or not hidden`) is unchanged.
  - The change only affects sort order. One side effect: on a non-C database, the ordering no longer matches what an index on `lower(name)` would give. That is a speed question, not a security one. 💭

**Follow-ups:** none.
