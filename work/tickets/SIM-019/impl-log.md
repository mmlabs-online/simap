## Attempt 1 — 2026-11-20 (Slice A: API only; Slice B is SIM-019.2)

### Files touched
| File | Required because |
|---|---|
| `src/lib/audit/types.ts` | Shared DTO/filter/limits types |
| `src/lib/audit/cursor.ts` | Opaque validated keyset cursor, keeps microseconds |
| `src/lib/validate/audit-query.ts` | Boundary validation of the query string |
| `src/server/audit/audit.ts` | Read service; all SQL via `orgQuery` with `ctx.scope` |
| `src/app/api/audit/route.ts`, `src/app/api/audit/facets/route.ts` | Admin-only endpoints via `withAuth` |
| `src/lib/audit/cursor.test.ts`, `src/lib/validate/audit-query.test.ts`, `src/server/audit/audit.test.ts`, `src/app/api/audit/route.test.ts` | Tests listed in plan |

### Tests added / changed
- All tests in plan "Tests to write" for Slice A (cursor, audit-query, audit service, route incl. 401/403/400/503/no-store, org query param ignored).

### Checks (actual output summary)
- typecheck: exit 0
- check:layers: 131+ files, no violations
- format:check: exit 0
- test: 52 files passed, 489 passed | 3 skipped
- build: exit 0, compiled successfully

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Add an audit case to SIM-026 DB integration tests once merged (plan A6).
- Handler validates the query before the pool check (400 before 503); harmless, no side effects.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: new files only (~700 lines incl. tests).
