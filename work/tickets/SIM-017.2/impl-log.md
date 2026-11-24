## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/lib/search/fold.ts` | single fold rule (`foldText`, map, `foldSql`, `macCompact`) |
| `src/lib/search/fold.test.ts` | AC 1, 3 |
| `src/lib/search/types.ts` | `SEARCH_LIMITS`, hit DTOs, `SearchResponse` |
| `src/lib/search/cursor.ts` | per-kind keyset cursor codec |
| `src/lib/search/cursor.test.ts` | cursor round trip and strict rejection |
| `src/lib/validate/search-query.ts` | `parseSearchQuery` |
| `src/lib/validate/search-query.test.ts` | AC 2, 7 |
| `src/server/search/search.ts` | `search()` service, one repeatable-read read-only tx |
| `src/server/search/search.test.ts` | SQL shape with a fake db |
| `src/server/search/search.db.test.ts` | AC 1, 2, 3, 5, 6 on Postgres |
| `src/app/api/search/route.ts` | `GET /api/search`, tier user |
| `src/app/api/search/route.test.ts` | auth, 400, 503, no-store |
| `src/app/api/dashboard/route.test.ts` | AC 4 tier gate |
| `src/server/members/manage.ts` | `listMembers` `?q=` uses the same fold |
| `src/server/members/manage.test.ts` | `like $3 escape`; new `Nguyễn` -> `%nguyen%` case |
| `src/server/members/manage.db.test.ts` | `nguyen` now returns the three Nguyễn ids; added `NGUYEN`, `le binh` |

### Tests added / changed
- All tests in the plan's table (fold, cursor, search-query, search, search.db, search route, dashboard route).
- manage.test.ts: updated list test, added "folds q: Nguyễn binds %nguyen%".
- manage.db.test.ts: list search assertions flipped/added.

### Checks (actual output summary)
- format:check: exit=0, "All matched files use the correct format."
- typecheck: exit=0
- check:layers: exit=0, "560 files, no violations"
- test: exit=0, 215 files passed, 2163 tests passed | 3 skipped
- build: exit=0
- test:db (local compose Postgres, stopped afterwards): exit=0, 12 files, 155 tests passed (first run had one failure in my new db test: an unplaced device needs role `secondary`; fixed)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- None.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: 16 files (13 new); no migration.
