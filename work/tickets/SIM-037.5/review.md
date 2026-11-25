## Attempt 1 — 2026-11-25
Verdict: REWORK

Scope judged: slice 1 only (API, rules, validators, DTO/count fields). UI is SIM-037.11.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0 (next typegen + tsc, no errors).
- `pnpm check:layers` — exit 0, "728 files, no violations".
- `pnpm test` — full suite: 274 files passed, 1 failed, 1 skipped; 2799 tests passed, 1 failed, 14 skipped. The failure is the known flaky timing test `scripts/dev-process.test.ts › real tree › root exits first; the orphan grandchild is still stopped`; re-run alone: 21 passed, exit 0.
- `pnpm build` — exit 0, "Compiled successfully". (The implementer did not run it.)
- `pnpm test:db` — not run (no local Postgres; CI runs it). The SQL was read by hand; Issue 1 says that CI's `test:db` will fail as the code stands.

### Acceptance criteria
- [ ] 1. Expiry before today (UTC+7) shows Overdue; no expiry never shows Overdue. FAILED, see Issue 1. The date logic is correct: `todayUtc7` boundary in `src/lib/devices/holding.test.ts:6-8`, `<` against the pinned day, the `placement=overdue` filter in `device.test.ts` and `devices-routes.test.ts`. But for an owned device with no expiry the DTO `overdue` field is SQL NULL, not `false`.
- [x] 2. (API half) `GET /api/handoffs/count` returns `overdue` = the caller's own owned devices past expiry. Evidence: `src/server/devices/handoffs.ts` `countHandoffs` (subquery `owner_id = $2 and holding_expires_on < $5::date`; NULL expiry is excluded, which is correct here); `handoffs-routes.test.ts › returns the four counts and passes the tier and today` (passes); `handoffs.db.test.ts › count: overdue counts only my owned devices…` (CI only, read by hand). The banner is slice 2.
- [x] 3. Date not after today refused; approve sets the expiry; reject leaves it. Evidence: `device.test.ts › validateHandoffStart extension › requires a date after today` (yesterday and today refused, tomorrow accepted; passes); `devices-routes.test.ts › 400 for a date not after today or a missing date, no service call` (passes); `confirmExtensionOnce` re-checks `new_expires_on <= today` and returns 409 `handoff_stale`; DB tests `approve (Manager) sets holding_expires_on…` and `reject leaves the expiry…` (CI only, read by hand).
- [x] 4. Only Admin/Manager approve or reject; the request is the device's one pending handoff. Evidence: `handoff-rules.ts:113-118` (`atLeast(tier,"manager")` for extension confirm/decline, cancel by the owner or Manager+); `handoff-rules.test.ts › decideHandoffAction extension` (passes); `startExtension` checks pending under the device row lock, and the DB unique index backs it; DB tests `refusals: … second pending 409, transfer pending 409` and `approve or reject by the owner or another user: 422, nothing written` (CI only).

Ming verification after merge: none for slice 1 (per plan).

### Issues
#### Issue 1 — 🔴 blocker — correctness / DTO contract (CI `test:db` will fail)
- **Where**: `src/server/devices/devices.ts:144` (select expression), also `:170` (`FILTER_SQL.overdue`, which is harmless in a WHERE clause but should match).
- **Expected**: `DeviceDto.overdue` is always a boolean. An owned device with `holding_expires_on IS NULL` returns `overdue: false` (AC1 says "no expiry never shows Overdue", `types.ts` says `overdue: boolean`). The DB test `handoffs.db.test.ts:811` expects `[true, false, false, false]`.
- **Actual**: `(d.owner_id is not null and d.holding_expires_on < $3::date)` gives `true AND NULL` = **NULL** in Postgres when the device is owned but has no expiry. `pg` maps that to JS `null`, so every owned device without an expiry is sent with `overdue: null`. The test at line 811 then gets `[true, false, null, false]` and fails in CI. Only an unowned device gives `false` (`false AND NULL` = false).
- **Fix instruction**: In the select, use `coalesce(d.owner_id is not null and d.holding_expires_on < $3::date, false) as overdue`, or add `d.holding_expires_on is not null and` before the comparison. Use the same predicate text in `FILTER_SQL.overdue` so the two cannot drift (e.g. one shared `const OVERDUE_SQL`). No test change is needed: the existing `device DTO overdue` DB case covers it. Optionally add `toBe(false)` (not falsy) assertions for an owned device with no expiry in another DB read test that already exists.

### Rules (CLAUDE.md)
No violations found.
- R1: only route handlers import `src/server/**`. `src/ui/devices/return-device.ts` and `transfer-device.ts` import `@/lib/devices/holding` (lib), which is allowed. `check:layers` is clean.
- R6: every new query goes through `orgQuery` with `org_id = $1`. The overdue subquery in `countHandoffs` repeats `org_id = $1`.
- R7: `startExtension` checks the permission (`decideExtensionStart`) before any insert. Confirm runs `decideHandoffAction` before any lock. Refusals are 409/422. No 401/403 outside `withAuth`.
- R2/R3: no migration, no config or env change.
- R4: the out-of-plan files are justified in impl-log (type-forced UI fixtures and parsers, copy entries indexed by `PlacementFilter`, and `validateHandoffStart`'s new `today` arg).
- R5: blocked by Issue 1 until CI `test:db` is green.

### Blockers from review agents
None. `security-review.md` Attempt 1 has no 🔴 (one 🟡: the SIM-037.4 deactivation lock cycle, which stays a follow-up).

### Nits (do not block)
- 💭 `reload(..., today = todayUtc7(new Date()))` reads the clock inside `src/server`. That differs from the plan's clock injection in handlers only. It is documented in impl-log and harmless, but write responses cannot be pinned in tests. Consider threading `today` through when SIM-037.11 touches these functions.
- 💭 `listHandoffs` builds `h.kind = '${...}'` by interpolation. Both values are constants, so it is safe, but a bound `$n` would match the rest of the file.
- 💭 The `validateHandoffBox` test name still says "accepts only one box, incoming or returns".
- 💭 The planned `placement=overdue` case went into `handoffs.db.test.ts`, not `devices.db.test.ts` (documented in impl-log).

### Follow-ups (out of scope)
- A DB test for member deactivation (OQ-44) cancelling a pending extension. The code path has no kind filter, so it works today (noted in impl-log).
- SIM-037.11: `badgeTotal` must include `extensions` / `overdue`. The Overdue chip goes into `FILTERS`, and `pendingText` needs the extension kind. The owner's banner should explain that Return is blocked while an extension is pending (one-pending rule).

## Attempt 2 — 2026-11-25
Verdict: PASS

Scope judged: slice 1 only. This attempt checks the rework of Attempt 1 Issue 1 and re-runs every check.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck`: exit 0.
- `pnpm check:layers`: exit 0, "728 files, no violations".
- `pnpm test`: 1 failed, 2799 passed, 14 skipped (2814). The one failure is the known flaky `scripts/dev-process.test.ts › real tree › root exits first; the orphan grandchild is still stopped`. Re-run alone: 21 passed, exit 0.
- `pnpm build`: exit 0, "Compiled successfully".
- `pnpm test:db`: not run (no local Postgres; CI runs it). I read the SQL by hand (see below).
- These results match impl-log Attempt 2.

### Issue 1 (Attempt 1): resolved
- `src/server/devices/devices.ts:144` is now `coalesce(d.owner_id is not null and d.holding_expires_on < $3::date, false) as overdue`. An owned device with a NULL expiry now gives `false`, not NULL, so `handoffs.db.test.ts:811` (`[true, false, false, false]`) should pass in CI.
- `src/server/devices/devices.ts:170` `FILTER_SQL.overdue` uses the same predicate text, so the select and the filter match. The implementer did not add the optional shared constant. That is fine.
- No other overdue expression can return NULL. `src/server/devices/handoffs.ts:786-787` is a `count(*)::int` subquery, which always returns an integer.

### Acceptance criteria
- [x] 1. Overdue when the expiry is before today (UTC+7). No expiry never shows Overdue. The Attempt 1 evidence still stands, and the NULL case is now fixed (above). The DB assertion runs in CI only.
- [x] 2. (API half) Unchanged since Attempt 1. Evidence as listed there.
- [x] 3. Unchanged since Attempt 1. Evidence as listed there.
- [x] 4. Unchanged since Attempt 1. Evidence as listed there.

Ming verification after merge: none for slice 1 (per plan).

### Scope
Attempt 2 changes only `src/server/devices/devices.ts` (2 lines) and the impl-log. Both are in the plan. There are no out-of-plan files.

### Rules (CLAUDE.md)
No new violations. The Attempt 1 rule review still applies. R5 is satisfied locally. CI `test:db` must be green before merge.

### Blockers from review agents
None new.

### Nits (do not block)
- The Attempt 1 nits still apply (clock read inside `reload`, interpolated `h.kind`, stale `validateHandoffBox` test name).

### Follow-ups (out of scope)
- Same as Attempt 1.
