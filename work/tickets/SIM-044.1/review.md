# Review — SIM-044.1

## Attempt 1 — 2026-11-26
Verdict: PASS

Reviewed: commit 9c31498 ("SIM-044.1: implement"), branch `claude/modest-allen-yru4g8`.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 840 files, no violations".
- `pnpm test` — exit 0, "Test Files 320 passed | 1 skipped (321); Tests 3221 passed | 7 skipped (3228)".
- `pnpm build` — exit 0.
- `pnpm test:db` (local Postgres 16, port 54329, data dir under /var/tmp, stopped and removed afterwards) — exit 0,
  "Test Files 20 passed (20); Tests 319 passed (319)".
- Results match impl-log.md attempt 1.

### Acceptance criteria
- [x] For a User, seat detail, room seat list and the release response list only devices they hold; `deviceCount` is
  the total — evidence: `src/server/seats/seats.ts:132-134` (held clause only in the devices subquery, `device_count`
  at l.124 unchanged; release uses `deviceVisibility(tier)` at l.492, l.507); `seats.db.test.ts:500` (detail, list,
  release as X: only X's primary, deviceCount 3), `:516` (Y only own; Z and no-member sub get `[]`, count 3), `:529`
  (own device on another seat shown), `:547` (cap after filter: 20 shown, count 25); `seats.test.ts:249`, `:274`;
  `seats-routes.test.ts:110-112`. All green.
- [x] Manager and Admin seat responses are unchanged — evidence: `seats.db.test.ts:537` (manager and admin see all 3
  with owners); `seats.test.ts:249` (no `m.sub = $2` for manager/admin) and `seats.test.ts:281` (setOccupant,
  setCannotSeat, setSeatTags, addSeats never add the clause); `seats-routes.test.ts:115`.
- [x] For a User, `GET /api/members` and `/api/members/[id]` give other members `devices: []` and `deviceCount: null`;
  own row unchanged — evidence: `src/server/members/manage.ts:121,126-130,158,191`; `manage.db.test.ts:443` (own row
  full, B null/[] with seats, names, employee code intact, diacritics), `:459` (detail; filters/paging same ids as
  manager), `:481` (no member row: all hidden; manager/admin full); `manage.test.ts:216` (manager/admin values and SQL
  unchanged, no `case when`), `:232`; `members/route.test.ts:95-96`; `MembersView.test.tsx:69`.
- [x] Layout responses for a User carry only `type` and `deviceType` per seat device (DB test) — evidence:
  `layout.db.test.ts:884` (exact key sets; JSON lacks device ids, owner id, MACs, inventory number). Green in my
  `pnpm test:db` run.
- [x] Per-tier unit and DB tests for seats, members and layout — evidence: tests listed above; `pnpm test` and
  `pnpm test:db` green.
- [x] UX gap ("None shown" when devices are hidden) — evidence: `SeatDetailPanel.tsx` (`hidden > 0` branches),
  `SeatDetailPanel.test.tsx:55`.

Ming verification after merge (carry to the PR): sign in on production as a User, open a seat holding another
member's device (only own devices, "N more devices are not shown.", primary "None shown"); open Members (others show
"-" under Devices, own row shows own devices). As a Manager: the same seat and Members page show everything.

### Issues
None.

### Scope
Every changed file is in plan.md's file list (product files, copy files, and the test files the plan names). No
out-of-plan file; no High path touched (`src/server/http/**`, migrations, config unchanged). Documented test-world
deviation (unowned devices cannot be placed at a seat, DB check `devices_unowned_not_placed_check`) is reasonable and
does not weaken AC1: hidden devices are another member's.

### Rules (CLAUDE.md)
No violations found. R1: server files keep `import "server-only"`, lib import only (`@/lib/devices/visibility`,
`@/lib/auth/tier`), check-layers green. R6: the filter uses only the verified `ctx.sub` and `ctx.tier`; every query
still goes through `orgQuery` with `org_id = $1`; the SQL fragment is chosen in TS, the sub is a bound parameter. R7:
no new 401/403; reads only filter. R2/R3: no migration, no config. R5: new logic tested.

### Blockers from review agents
None (the security trigger applies because `src/server/` changed; the orchestrator adds any 🔴 from
security-review.md here).

### Nits (do not block)
- `layout.db.test.ts:884` checks absence of device ids, owner id, MACs and the primary's inventory number, but not the
  device names or the secondary's inventory number in the JSON string; the exact-key assertions already cover them
  structurally.
- `seats.ts` new imports sit between `@/lib/seats/rules` and `@/lib/seats/types` rather than grouped alphabetically
  (oxfmt does not sort; cosmetic).

### Follow-ups (out of scope)
- None new (other members' email for Users and the write-action existence oracle are already recorded).
