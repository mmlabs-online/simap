# Review: SIM-013.1

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0 ("All matched files use the correct format").
- `pnpm typecheck`: exit 0. `pnpm check:layers`: exit 0, "439 files, no violations".
- `pnpm test`: exit 0, "Test Files 174 passed (174); Tests 1842 passed | 3 skipped (1845)". This matches impl-log.
- `pnpm build`: exit 0.
- `pnpm test:db` (CI, PR #59, run 45328422990, head dd319bb, the same as the local HEAD): job "db integration tests" passed. `src/server/devices/devices.db.test.ts` has 19 tests and all passed, none skipped. Totals: "Test Files 8 passed (8); Tests 114 passed (114)". The `ci`, `image` and `tier` checks all pass.

### Acceptance criteria
- [x] Deleting a placed device is refused (409 `device_placed`) until it is in inventory. Evidence: `devices.db.test.ts` › "delete: placed -> 409 device_placed and row kept; after return to inventory the delete succeeds; …" (green in CI). The order (`not_allowed` before `device_placed`, nothing written) is covered by `devices.test.ts` › "not_allowed is decided before device_placed; refusals write nothing". The code is `src/server/devices/devices.ts` deleteDevice: `canEdit` comes before `seat_id !== null`, and both come before the delete and the audit.
- [x] A User or Manager creates, edits and deletes only their own devices, and an Admin can do this for any member. Evidence: `devices.db.test.ts` › the "create permission matrix", "edit permission matrix" and "delete permission matrix" tests loop over the user and manager tiers and check that another member's device gives 422 and the row is unchanged. The Admin cases pass. `no_linked_member`, the deactivated owner (422) and an unknown or other-org owner (404) are also covered.
- [x] Different spellings of one MAC are stored the same way, and a duplicate MAC or inventory number is a 409, not a 500. Evidence: `src/lib/validate/device.test.ts` › "normalizeMac: all accepted spellings -> lowercase colon form …; output matches the DB check". `pg-error.test.ts` has the two mappings plus an unrelated 23505 → null. `devices.db.test.ts` › "uniqueness: …" covers create and patch, a MAC in another spelling, null MACs, and other orgs. The `inTx` mapping is at `devices.ts:57-58`.
- [x] Unit and DB tests cover the permission matrix, the MAC normaliser and the D31 refusal. Evidence: the tests above, plus the route contract in `devices-routes.test.ts` › "devices write routes" (3 tests) and the delete-vs-place race test in `devices.db.test.ts`.

Ming verification after merge: none (the plan lists none).

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: `check:layers` is clean. Only `src/app/api/devices/**` imports `@/server/devices/*`.
- R6: every new query goes through `orgQuery` with `org_id = $1`, and the unit test "every query passes org_id as $1" checks this. The owner lookup is org-scoped, so a cross-org owner gives 404 (DB test).
- R7: 401/403 come only from `withAuth`. The service returns 404/409/422, and every `Abort` is thrown before the insert, update, delete or audit.
- R2: no schema change. `updated_at` exists on `devices` (init migration).
- R3: no new env. R4: every changed file is in the plan. `work/ming-todo.md` (M-33) and the ticket's work files are workflow files.
- R5: all checks are green, and the new logic has tests.

### Blockers from review agents
None.

### Nits (do not block)
- `src/app/api/devices/route.ts:1`: the import names are not in alphabetical order (`validateDeviceCreate, parseDeviceQuery`). This is cosmetic, and oxfmt accepts it.
- `validateDeviceCreate` accepts an explicit `ownerId: null`, the same as leaving it out. This is harmless but not documented in the plan's API contract.

### Follow-ups (out of scope)
- Case-insensitive inventory-number uniqueness, if Ming wants it (plan Assumption 1; it needs a migration).
- SIM-013.2 needs a device-specific message for `member_not_assignable` on the device form (plan Assumption 6).
