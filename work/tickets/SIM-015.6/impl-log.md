## Attempt 1 — 2026-11-22

### Files touched
| File | Required because |
|---|---|
| `src/server/layout/layout.ts` | `getRoomLayout` service (one repeatable read, read only tx; org-scoped via `orgQuery`) |
| `src/server/layout/layout.db.test.ts` | DB integration tests AC1-AC7 |
| `src/app/api/rooms/[id]/layout/route.ts` | `GET` only, `tier: "user"` |
| `src/app/api/rooms/[id]/layout/route.test.ts` | 404, 503, no-store, refusal mapping, 401 |
| `src/lib/sprites/resolve-layout.ts` | `take` type guard (security review 🟡 1); `!= null` on placement |
| `src/lib/sprites/resolve-layout.test.ts` | `take guard` (five shapes) and registry key length check |

### Tests added / changed
- `resolve-layout.test.ts › take guard › x 0.5 / x null / x string / x bigint / placement undefined never throws and never keeps its place`
- `resolve-layout.test.ts › registry keys › every registry key is shorter than 129 characters`
- `route.test.ts`: non-canonical id 404 without getPool/service; no pool 503; success 200 no-store with scope, sub, id; service not_found 404; no Authorization 401
- `layout.db.test.ts` (12): unsaved default writes nothing; saved round trip; null placement takes a free slot; seat status from real rows (no sub in JSON); foreign org / random uuid 404; legacy fixtures hidden; corrupt grid 65x65; oversized/bad floor_zones; long/unknown sprite keys; 500 vs 501 seats; statement order (begin, set transaction ..., 3 reads, commit); concurrent commit between reads not seen

### Checks (actual output summary)
- format:check: "All matched files use the correct format."
- typecheck: exit 0 (next typegen + tsc); check:layers: "362 files, no violations"
- test: 147 files passed, 1567 passed | 3 skipped
- build: exit 0; route list shows `ƒ /api/rooms/[id]/layout`
- test:db (`node scripts/test-db.mjs`, DATABASE_URL = documented local trust URL from compose.dev.yml, passed inline): 6 files, 64 tests passed; layout.db.test.ts alone 12/12

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- `pnpm format`/`format:check` print "No config found, using defaults" (pre-existing, harmless).

### Scope self-check
- Could the diff be smaller? No; production code is about 150 lines, rest is tests.
- Diff size: about +820 / -2 lines (mostly tests)
