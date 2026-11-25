# Review — SIM-039.2

## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers`: both exit 0, "check-layers: 711 files, no violations"
- `pnpm test`: exit 0, "Test Files 268 passed | 1 skipped (269); Tests 2672 passed | 7 skipped (2679)"
- `pnpm build`: exit 0
- `pnpm migrate` + `pnpm test:db` on a throwaway PostgreSQL 16 cluster under /var/tmp (port 55433, DATABASE_URL given inline, no `.env*` read or written; the cluster was stopped and its directory deleted afterwards): migrate applied every migration including `20261125200000_map_items`. test:db: "Test Files 1 failed | 17 passed (18); Tests 5 failed | 232 passed (237)". All 5 failures are in `src/server/devices/handoffs.db.test.ts` (start > ...); they already fail on main (verified in SIM-039.1's review) and this ticket does not touch them. A verbose run of `map-items-edit.db.test.ts` alone gave "Tests 15 passed (15)".
- My results match impl-log Attempt 1.

### Acceptance criteria
- [x] 1 Each action works for Admin and Manager/User are refused by the wrapper. Evidence: `map-items-admin-routes.test.ts`: "401 without token", "403 forbidden for user and manager ... service not called" and "admin PATCH/PUT/POST -> 200 no-store" all pass. The DB test "rename, regroup, hide/show, resize, art, reset each change the row" passes. All three routes use `withAuth(..., { tier: "admin" })`, and `routes-guarded.test.ts` picks them up and passes.
- [x] 2 Resize of a placed item gives 409 `item_in_use`; a fixed-size item gives 422. Evidence: DB tests "resize of a placed item -> 409 item_in_use with rooms = 2 ... no audit" and "fixed-size items ... -> 422 item_fixed_size" pass. The route test "409 item_in_use body is { error: { code, rooms: 2 } } with no-store" passes.
- [x] 3a Every query is scoped by the token's org (R6). Evidence: every statement in `src/server/map-items/edit.ts` goes through `orgQuery` with `org_id = $1` (lock read, in-use count over layout_fixtures and seats, update, and the audit through `writeAudit(c, scope, …)`). No org comes from the request. The DB test "an edit in org A leaves org B's row unchanged; B's placements do not count" passes.
- [x] 3b Admin-only writes are audited. Evidence: the DB test "every write adds exactly one audit row ... entity_id null, meta.key; refusals add none; meta holds no Drive id" passes, and so does "no-op patch and no-op art add no audit".
- [x] 3c Checks are green, including `pnpm test:db` run locally. See Checks above. The only failures are the 5 known ones on main.
- Ming verification after merge (from the plan, optional): as an Admin, `PATCH /api/map-items/plant.large {"name":"Cây lớn"}` returns 200; `GET /api/map-items` then shows the new name, and the Audit page shows a `map_item.update` row.

### Scope
Every changed product and test file is in the plan's file list. `work/ming-todo.md` (M-64) and the ticket, plan, consult and impl-log files are workflow files. No High path is touched: no migration and nothing under `src/server/http/**`.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the routes are the only importers of `src/server/map-items/*`. `art.ts` and the validator in `src/lib` are pure. The new server files start with `import "server-only"`. check:layers is clean.
- R6: see 3a.
- R7: 401/403 come only from `withAuth`. Domain refusals are 404/409/422 and happen before any write: an `Abort` inside the transaction rolls it back, and the pure checks run before the transaction. The Drive cleanup runs only after a successful commit.
- R3: there is no new config, and the Drive ids are not logged (the orphan log holds the key only).
- R5: new logic has unit, route, mocked-DB and DB tests.

### Blockers from review agents
None.

### Nits (do not block)
- `src/server/map-items/edit.ts:288-294`: the `fields` list of the reset audit has no entry for deleted images. A reset that only deletes a custom image writes `fields: []`. `imagesDeleted` still carries the count.
- `src/server/map-items/edit.ts:118`: the in-use count over `seats` filters on `sprite_key` without an index. This is acceptable at the current seat counts per org.

### Follow-ups (out of scope)
- Picking a package sprite with `PUT art/[dir]` leaves that direction's custom image in place (already noted in impl-log). SIM-039.4 and SIM-039.6 should decide which takes precedence, or clear the image.
- The failing tests in `src/server/devices/handoffs.db.test.ts` on main (handoffs org filter) need their own bug ticket.
