# Impl log — SIM-014.1

## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/lib/requests/types.ts` | `REQUEST_LIMITS` and the list / mine / seen shapes (plan step 1) |
| `src/lib/requests/rules.ts`, `rules.test.ts` | pure `isUnseen` and its table |
| `src/lib/validate/request-query.ts` (+ test) | `parseRequestListQuery`, `parseMyRequestsQuery` |
| `src/lib/validate/request.ts`, `request.test.ts` | `validateSeenBody` (microsecond instant) |
| `src/server/requests/requests.ts` | extracted `REQUEST_SELECT`, `REQUEST_FROM`, `toRequestDto`, exported `RequestRow`, `ISO`; `loadRequest` behaviour-preserving |
| `src/server/requests/read.ts` | `listRequests`, `listMyRequests` (repeatable read, read only), `markRequestsSeen` |
| `src/server/requests/read.db.test.ts` | DB tests for AC1-AC3 |
| `src/app/api/requests/route.ts` | `GET` list, tier manager |
| `src/app/api/requests/mine/route.ts`, `mine/seen/route.ts` | mine and mark-seen routes |
| `src/app/api/requests/requests-read-routes.test.ts` | route tests |

### Tests added / changed
- `rules.test.ts` › isUnseen (3 cases); `request-query.test.ts` (status, limit, cursor, mine ignores status); `request.test.ts` › validateSeenBody (4 cases)
- `requests-read-routes.test.ts` › 401, tiers, query passthrough, 400s, sub from token, no-store, `mine` as `[id]` -> 404
- `read.db.test.ts` › list per status + org isolation, cursor with equal created_at (pages 2,2,1), occupant join, mine order/isolation, isNew/unseen incl. auto-rejected rival via `approveRequest`, unseen beyond page, no member row, seen (null, forward only, future cap, µs equality, no member). Not run locally (no DATABASE_URL); CI `test:db` must be green. Fixtures follow the plan's rules (non-null `decided_at` for decided rows, distinct seats, no devices).

### Checks (actual output summary)
- typecheck: `pnpm typecheck && pnpm check:layers` exit 0, "446 files, no violations"
- format:check: exit 0
- test: 176 files passed, 1868 passed | 3 skipped
- build: exit 0, routes `/api/requests`, `/api/requests/mine`, `/api/requests/mine/seen` listed

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- As in plan: oldest-first pending queue, rename the cursor module, share the query `get()` helper.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see git diff --stat of the commit.
