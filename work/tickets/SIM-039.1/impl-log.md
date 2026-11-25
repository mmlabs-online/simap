## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| db/migrations/20261125200000_map_items.sql | tables, seed function, members trigger, backfill, undrawable-placement cleanup (A13), FKs + index (D67 3) |
| src/lib/map-items/types.ts | shared DTO and limits |
| src/lib/map-items/library.ts | TS source of the seed and derived facts |
| src/lib/map-items/library.test.ts | derivation tests |
| src/server/map-items/map-items.ts | read service |
| src/server/map-items/sql-sync.test.ts | seed/limits equal the migration |
| src/server/map-items/map-items.db.test.ts | DB integration |
| src/app/api/map-items/route.ts | GET (hidden rows for tier admin only) |
| src/app/api/map-items/map-items-routes.test.ts | route tests |
| src/server/layout/save.ts | one `map_items_seed` call after the seat-lock check (A14) |
| src/server/layout/save.test.ts | "catalog seed" in the statement order |
| src/server/layout/layout.db.test.ts | `room()` seeds the catalog; unknown-key read test replaced by FK refusal test; no-member save test |
| scripts/schema-check.mjs | stage-1 placements, later-run line, counts(), section 11 |
| db/migrations/README.md | map items bullet |

### Tests added / changed
- library.test.ts: 8 tests (53 rows, palette equality, names, uniqueness/limits, sizes, kinds, null for excluded keys, validator keys are library keys)
- sql-sync.test.ts › map_items seed equals LIBRARY_ITEMS; limits and Drive id regex equal the TS constants
- map-items.db.test.ts: 8 tests (seed once, defaults, name order, hidden, seed-once semantics, org scope, art/no Drive id, unknown key not listed)
- map-items-routes.test.ts: 4 tests (401, 200 + scope, includeHidden by tier, 503)
- save.test.ts: order test now includes "catalog seed"; refusal tests unchanged (assert no seed)
- layout.db.test.ts: `sprite keys outside the org catalog are refused by the FK` (replaces the long/unknown keys test); `a save in an org with no member seeds the catalog and stores the fixtures`
- schema-check.mjs: `1 later run applies map_items`, section 11 (21 steps incl. backfill keep/drop, FK refusals, delete restrict, cross-org, every CHECK/unique)

### Checks (actual output summary)
Local throwaway Postgres 16 cluster (DATABASE_URL passed inline, no .env* touched; cluster stopped and deleted).
- pnpm migrate: exit 0, `applied 20261125200000_map_items`
- pnpm migrate:smoke: exit 0, `migrate smoke ok`
- pnpm schema:check: exit 0, `schema check ok` (99 pass lines, 0 FAIL; all section 11 steps pass)
- pnpm test:db: 217 passed, 5 failed (Test Files 1 failed | 16 passed). All 5 failures are in `src/server/devices/handoffs.db.test.ts` (start tests: `orgQuery: SQL must filter org_id = $1` at `src/server/devices/handoffs.ts:169`). They fail identically on the untouched base (checked with `git stash -u`), so not caused by this ticket. Every map-items and layout db test passes.
- pnpm format:check: exit 0, `All matched files use the correct format.`
- pnpm typecheck: exit 0
- pnpm check:layers: exit 0, `691 files, no violations`
- pnpm test: exit 0, `Tests 2607 passed | 7 skipped`
- pnpm build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Pre-existing: `src/server/devices/handoffs.ts` ~line 169 insert into `device_handoffs` fails the `orgQuery` guard (`org_id = $1` not in SQL text); 5 `handoffs.db.test.ts` tests fail on `main` too. CI `pnpm test:db` will be red until fixed (separate ticket).
- Spec text update for LAY-07/D66 amendments by D67 (as in the plan).
- Library key additions need a migration inserting them for every catalog (A10).

### Scope self-check
- Could the diff be smaller? No; every file is in the plan list.
- Diff size: see `git show --stat HEAD`.
