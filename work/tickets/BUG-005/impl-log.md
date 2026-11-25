## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `src/server/map-items/map-items.ts` | List order made locale independent: `order by lower(name) collate "C", builtin_key collate "C"`; doc comment states the rule |
| `src/server/map-items/map-items.db.test.ts` | Existing order test now compares with the explicit code-point comparator; new regression test `list order does not depend on the database locale` |

### Tests added / changed
- `map-items.db.test.ts` › `list order does not depend on the database locale` (new)
- `map-items.db.test.ts` › `list is ordered by lower(name), then builtin_key` (comparator changed)

### Fail before / pass after
- Local DB `datcollate` = `en_US.utf8` (simap, postgres, template1), so the test can fail locally.
- Before (new test, old `map-items.ts`): `FAIL ... map-items (db) > list order does not depend on the database locale`, `AssertionError: expected [ 'cabinet.filing', …(2) ] to deeply equal [ 'cabinet.filing', 'elevator', …(1) ]`; the old order test also failed (`expected [ 'aaa wall', 'cabinet filing', …(51) ] to deeply equal ...`). Tests 2 failed | 289 passed.
- After: both pass.

### Checks (actual output summary, whole batch at final commit)
- test:db: Test Files 20 passed (20); Tests 291 passed (291)
- format:check: All matched files use the correct format.
- typecheck: exit 0
- check:layers: exit 0
- test: Test Files 304 passed | 1 skipped; Tests 3086 passed | 9 skipped
- build: Compiled successfully, exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- The planned tie-break assertion (same lower(name), different case) is impossible: `map_items_org_name_key` rejects it (duplicate key), so it was dropped. The tie on builtin_key cannot occur with unique names.
- The new test uses `LIBRARY_ITEMS` first three keys rather than named keys.
- Other `order by` clauses on map data were not checked for locale dependence.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +20 / -4 lines
