## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (919 files)
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "864 files, no violations"
- `pnpm test` — exit 0, Test Files 328 passed | 1 skipped; Tests 3285 passed | 9 skipped
- `pnpm build` — exit 0, compiled successfully, 23/23 static pages
- `pnpm test:db` (local docker Postgres, throwaway DB) — exit 0, Test Files 22 passed; Tests 339 passed

All match the impl-log claims.

### Acceptance criteria
- [x] For a User, seat devices they do not hold have no free-text `type`; their own devices keep it. Evidence: `src/server/layout/layout.ts:146` (`mine` = `owner_id` equals the caller's member id, scoped by `org_id = $1`; `members_org_sub_key unique (org_id, sub)` means the scalar subquery returns at most one row) and `:161` (`tier === "user" && !d.mine ? null : d.type`). `layout.db.test.ts` › "free-text type by tier (SIM-052)" › "User: non-held device type null, held device keeps type, free text absent from JSON" and "User: non-held device with a catalog match keeps deviceType" pass.
- [x] The map still draws a sprite for every device. Evidence: `map-view.ts:90` keeps `type: null` (test "keeps a device with type null (SIM-052)…"); `device-slots.ts:85-90` gives kind `other` with no throw (test "null type (SIM-052)…"); `placement.test.ts` › "placeDevices draws a device with type null (SIM-052)" (2 `device.other` frames for 2 devices). All pass.
- [x] Manager and Admin layout responses are unchanged. Evidence: `layout.db.test.ts` › "manager and admin: every device keeps type" passes; `save.ts:193` passes `"admin"` (PUT is admin-tier); route passes `ctx.tier` (`route.ts:20`, asserted in `route.test.ts`); existing seatDevices tests stay green with helper default `"admin"`.
- [x] DB test locks the User shape; unit tests for the fallback. Evidence: tests above.

Dropped planned test (unowned device, `owner_id` null): the reasoning holds. `db/migrations/20261125120000_device_lifecycle.sql:26-27` defines `devices_unowned_not_placed_check check (owner_id is not null or seat_id is null)`, validated. The layout device query only selects rows with `seat_id = any($2)`, so an unowned device can never reach this code; the state cannot be built in a fixture. Even if it could, `coalesce(owner_id = …, false)` yields `mine = false`, so it fails closed. The related "User without a member row" case is covered and passes.

### Issues
None.

### Scope
Every changed source file is in the plan's file list; `save.test.ts` was listed as conditional and needed no change. No High path touched. No out-of-plan files.

### Rules (CLAUDE.md)
No violations found. R1: `layout.ts` imports only the `Tier` type from `@/lib/auth/tier` (lib); check:layers clean. R6: the new member subquery is scoped by `org_id = $1`; tier comes from the verified token. R7: read-only path, no new auth codes. R5: new logic has tests, checks green.

### Blockers from review agents
None

### Nits (do not block)
- `src/lib/sprites/layout.ts:54` doc comment on `SeatDevice` could mention that `type` is null for a User on devices they do not hold.

### Follow-ups (out of scope)
- None
