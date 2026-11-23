# Review: SIM-013

## Attempt 1 — 2026-11-23
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (481 files)
- `pnpm typecheck`: exit 0
- `pnpm check:layers`: exit 0, "check-layers: 427 files, no violations"
- `pnpm test`: exit 0, "Test Files 171 passed (171); Tests 1799 passed | 3 skipped (1802)"
- `pnpm build`: exit 0; `/api/devices`, `/api/devices/[id]`, `/api/devices/[id]/placement` are listed
- `pnpm test:db`: not run (no local DATABASE_URL); CI runs it. `src/server/devices/devices.db.test.ts` was checked by reading it against `db/migrations/20261120150000_init.sql` and `src/test/db/fixtures.ts` (see below).

These results match impl-log.md attempt 1.

### Acceptance criteria
- [x] Placing as primary is refused unless the seat's occupant owns the device and the seat has no primary. Evidence: `src/lib/devices/rules.ts:47-55`; `rules.test.ts` "primary: no occupant -> seat_has_no_occupant; ..." (passes). DB: `devices.db.test.ts:134-147` covers all three refusals with no row change and no audit, plus `:271-294` for the lock-wait race. Backstop: `pg-error.test.ts` maps `devices_one_primary_per_seat` (23505) and `devices_primary_owner_is_occupant` (23514). Both names match `init.sql` (the unique index and the trigger `raise ... constraint =`). `inTx` wraps `withTx`, so the COMMIT-time trigger error is mapped too (`devices.ts:42-52`).
- [x] A Manager can move another member's device; a User cannot. Evidence: `rules.test.ts` "canPlace: ..." and "not_allowed is checked first"; `devices.test.ts` "refusal writes nothing" (no update or insert, rollback). DB: `devices.db.test.ts:167-193` (user gets 422 and the row is unchanged; manager moves A-01 to B-01 across rooms; audit `device.move`).
- [x] The device list API shows placement for every device. Evidence: `devices.ts:75-94, 109-116` (left joins on seats and rooms, every join keeps org_id). DB: `devices.db.test.ts:62-101` covers placement and null, the all/placed/inventory filters, name order, mine/canEdit/canPlace, and truncation at 1001 rows. Routes test: no-store and service args. The UI part belongs to SIM-013.2.
- [x] Unit tests cover placement rules and permission matrix. Evidence: `src/lib/devices/rules.test.ts` covers every cell of the plan matrix (canPlace, canEdit, canCreateFor x 3 tiers x owner or not) and every `decidePlacement` branch. All pass.
- Moved to SIM-013.1 (delete refused while placed). This slice only provides the return path: `devices.db.test.ts:195-209`.

Ming verification after merge: none for this slice (plan). The manual check "lend and move between seats" comes after SIM-013.3.

DB test read-through (correctness against schema and fixtures):
- `world()` uses room codes A/B and seat codes A-01/A-02/B-01. These are unique per org (`seats_org_code_key (org_id, code)`), so calling `world()` twice in one test is fine.
- Nothing stops x from having a primary on A-01 (x occupies it), so the trigger passes at COMMIT. The test that adds a second primary sees `seat_has_primary` from the app check, before the partial unique index is reached.
- The truncation insert relies on: `role` defaulting to `'secondary'`, a unique `'inv' || g` per org, and `$1` resolving to uuid from the INSERT target column (an INSERT ... SELECT does not resolve unknown params to text).
- In the lock-wait test, the holder locks the A-01 row only. `placeDevice` takes the room share lock and then blocks on `seats ... for update`. The holder sets the occupant to y; `seats` has no unique on occupant and no primary sits on A-01, so its COMMIT succeeds. The re-read seat row then yields `owner_not_occupant`, and the device row is unchanged.
- The 404 cases are a random seat, another org's seat (the unlocked seat read is org-scoped), and another org's scope for the device.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: only the route handlers import `@/server/devices/*`; `check:layers` is clean. The server files start with `import "server-only"`.
- R6: every query runs through `orgQuery` with `org_id = $1`, joins repeat org_id, and the fake-db test asserts this for each statement.
- R7: refusals are 404/409/422 and are thrown before the update or the audit insert. All three routes use `withAuth` tier `user`.
- R3: no env. R4: every changed file is in the plan. `work/*` files are loop bookkeeping (ticket, plan, consults, impl-log, M-31). No High path is touched.
- R5: checks are green and the new logic has tests.

### Blockers from review agents
To be filled by the orchestrator (`src/server/` changed, so `security-ai-generated-code-auditor` is triggered).

### Nits (do not block)
- `src/server/devices/devices.ts:222-227`: the locked device select returns `id, owner_id` but the row type only declares `seat_id, role`. The decision then uses the unlocked `dev[0].owner_id` (`:246-248`). This is safe today because nothing changes `owner_id` (SIM-013.1 PATCH rejects `ownerId`). Using `cur[0].owner_id` would keep it correct if that ever changes.
- `devices.ts:201`: an unknown target seat answers 404 before the `not_allowed` check. This only matters for a User acting on another member's device, and seats are visible to all members anyway.

### Follow-ups (out of scope)
- Watch the first CI `pnpm test:db` run for `devices.db.test.ts`. It has never been executed.
