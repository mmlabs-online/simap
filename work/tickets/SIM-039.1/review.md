## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
Branch `claude/modest-allen-yru4g8` at `bca99cc`, compared with `origin/main` (`28cf7a6`; main moved only in UI/board files since the merge base `c19f622`, no migration, layout or schema-check overlap).
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "check-layers: 691 files, no violations"
- `pnpm test` — exit 0, "Test Files 260 passed | 1 skipped (261); Tests 2607 passed | 7 skipped (2614)"
- `pnpm build` — exit 0, route `ƒ /api/map-items` listed
- DB checks against a throwaway local Postgres 16 cluster (under /var/tmp, `DATABASE_URL` inline, no `.env*` read or written; stopped and deleted afterwards):
  - `pnpm migrate` — exit 0, "applied 20261125200000_map_items"
  - `pnpm migrate:smoke` — exit 0, "migrate smoke ok"
  - `pnpm schema:check` — exit 0, "schema check ok", 99 pass lines, 0 FAIL; all 20 section-11 steps pass plus "1 later run applies map_items"
  - `pnpm test:db` — exit 1, "Tests 5 failed | 217 passed (222)". All 5 failures are in `src/server/devices/handoffs.db.test.ts` (start tests, `Error: orgQuery: SQL must filter org_id = $1` at `src/server/devices/handoffs.ts:169`).
  - Pre-existing check: ran `pnpm test:db` in a separate detached worktree of unmodified `origin/main` (`28cf7a6`; `src/server/devices` unchanged since the merge base) against the same cluster. Result: exit 1, "Tests 5 failed | 208 passed (213)", the same 5 handoffs start tests with the same `orgQuery` error. The implementer's claim holds. This ticket adds 9 DB tests, and every one passes. The failures are not caused by this ticket and do not count against it (see Follow-ups).
  - Ran only the map-items and layout DB files (verbose): "Tests 40 passed (40)". That includes every new map-items test, `sprite keys outside the org catalog are refused by the FK`, `a save in an org with no member seeds the catalog and stores the fixtures` and the unchanged `saved room round trip`.
- The impl-log check summary matches my run.

### Acceptance criteria
- [x] 1 A new and an existing org each get the full seeded catalog with library defaults. Evidence: schema:check "11 orgs existing before the migration get 53 map items", "11 org created after the migration gets 53 map items on first member", "11 second member adds none", "11 spot sizes door 1x2, table.meeting 3x2, desk.single 2x1, prop.mug 1x1", "11 deleted map item stays deleted"; `map-items.db.test.ts › a new member's first visit seeds the library catalog once; a second member adds none` and `› list: 53 items with library defaults, hidden false, empty art` pass; `sql-sync.test.ts` (seed VALUES equal `LIBRARY_ITEMS`) and `library.test.ts` (8 tests) pass in `pnpm test`.
- [x] 2 `GET /api/map-items` returns only the caller's org rows. Evidence: `map-items.db.test.ts › list returns only the caller's org rows` passes; `map-items-routes.test.ts › 200 with no-store; service gets ctx.scope` passes; the SQL is `where org_id = $1` via `orgQuery` (`src/server/map-items/map-items.ts:71-77`).
- [x] 2a Items listed alphabetically by name (D67 1). Evidence: `map-items.db.test.ts › list is ordered by lower(name), then builtin_key` passes; `order by lower(name), builtin_key` at `map-items.ts:76`; there is no `sort_order` column in the migration.
- [x] 2b Hidden items only for Admins (D67 2). Evidence: `map-items.db.test.ts › hidden rows: …` passes; `map-items-routes.test.ts › admin tier passes includeHidden true; manager and user pass false` passes; `includeHidden: ctx.tier === "admin"` at `src/app/api/map-items/route.ts:14`.
- [x] 2c Placed items reference their catalog row by FK, and existing layouts draw unchanged (A13 cleanup default). Evidence: schema:check "11 backfill keeps valid placed fixtures and seats", "11 backfill drops undrawable fixtures and unplaces undrawable seats", "11 fixture/seat with a key not in the org catalog refused (23503 …)", "11 map item referenced by a placement cannot be deleted (23503)", "11 cross-org key refused"; the whole `layout.db.test.ts` file is green. The migration's cleanup step (`db/migrations/20261125200000_map_items.sql`, Step 2) only touches rows that `resolveLayout` already drops. The seat unplace sets all 4 placement columns to null, which satisfies `seats_tile_placement_check` (num_nonnulls in (0, 4)).
- [x] 3 R6 scoping, audit, green checks incl. local `test:db`. Evidence: the read and the save seed call both go through `orgQuery`. The admin flag comes only from `ctx.tier`; the org never comes from the request. Audit is N/A as the plan states: this ticket has no Admin writes, and the seed runs in a trigger or as a safety net with no actor. Checks are green except the 5 handoffs failures that also fail on main (shown above).

Ming verification after merge (not verified here, carry to the PR):
- After the release migration runs on the shared DB: `GET /api/map-items` returns 53 items in name order for an Admin and also for a Manager/User (nothing is hidden yet).
- Open two rooms with saved layouts on the map and in the editor: they look exactly as before, and saving a layout still works.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/lib/map-items/*` is pure lib. `src/server/map-items/map-items.ts:1` starts with `import "server-only"`. The route is the only entry into the server code. check:layers is clean.
- R2: new forward-only migration with the newest timestamp. Expand-only: new tables, function, trigger, two FKs on existing columns, and an index. The previous image stays compatible: its saves write only validator-accepted keys, which are all seeded (`library.test.ts › every key the layout validator accepts … is a LIBRARY_ITEMS key`), and every org it saves in has a member and so a catalog. No applied migration was edited.
- R6: `org_id` leads the PK and both FKs (schema:check "2 every FK includes org_id on both sides" still passes). The queries use `orgQuery` with `org_id = $1`.
- R7: the route has no auth codes outside `withAuth`, and the GET has no side effect. In `save.ts:73-78` the seed call runs after every 409 refusal check and inside the transaction. The refusal tests (`save.test.ts:105,112,132`) assert exact sequences without "catalog seed".
- R3: no config. R4: every changed code file is in the plan's file list. The plan does not list `work/ming-todo.md`, but it is board bookkeeping: M-62 approval and the M-60 line from an earlier board commit. R5: new logic has unit, route, DB and schema-check tests.

### Blockers from review agents
None. `security-review.md` attempt 1: 🔴 none, 🟡 none; follow-ups only (`SET search_path` on seed functions; A10 migration for future library keys).

### Nits (do not block)
- `src/lib/map-items/library.test.ts:52-54` checks only `w >= sizeMin` and `h <= sizeMax`. Assert all four bounds. The DB CHECK and the sync test already cover this, so the gap is small.
- The replaced read test leaves no test for the `left(sprite_key, 129)` truncation in `src/server/layout/layout.ts:77,87`. The FK and the 100-char `builtin_key` check make that path unreachable for new rows. Drop the truncation in 039.3 if it touches the read.
- `work/ming-todo.md`: this branch has `M-60` = SIM-033 atlas (from board commit 39c03f2), and `origin/main` has a different `M-60` (SIM-037.8 PR). Merging will conflict on that line, and the IDs need to be made unique. This is an orchestrator/board fix, not code.

### Follow-ups (out of scope)
- Pre-existing, also red on `origin/main`: `src/server/devices/handoffs.ts:169` (start insert into `device_handoffs`) fails the `orgQuery` `org_id = $1` guard, so 5 tests in `handoffs.db.test.ts` fail and CI `pnpm test:db` stays red until a separate ticket or bug fixes it.
- Spec text update: LAY-07 and D66 (1) amended by D67 (A15).
- A library key added to `keys.json` must ship with a migration that inserts it for every catalog (A10). Without it, a save that uses the new key fails with 23503.
