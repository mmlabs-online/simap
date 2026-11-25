## Attempt 1 — 2026-11-25
Verdict: PASS

Scope reviewed: slice 1 of plan.md (history API, read-only detail page, links). Slice 2 (viewer actions) is the proposed SIM-037.13 and is not judged here.

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers`: exit 0 / exit 0, "check-layers: 763 files, no violations"
- `pnpm test`: exit 0, "Test Files 288 passed | 1 skipped (289); Tests 2921 passed | 9 skipped (2930)"
- `pnpm build`: exit 0, routes `/api/devices/[id]/history` and `/devices/[id]` listed
- `pnpm test:db` (local compose Postgres, throwaway DB): exit 1, "Test Files 4 failed | 16 passed (20); Tests 19 failed | 271 passed (290)". `history.db.test.ts` passes (7 tests).
  - **Baseline verified by the reviewer.** I ran `pnpm test:db` on a detached worktree of `origin/main` (bd1e812): "Test Files 4 failed | 15 passed (19); Tests 19 failed | 264 passed (283)". The sorted FAIL lists of main and branch are identical (`diff` exit 0). The extra 7 passing tests on the branch are the new history tests. The failures are in `handoffs.db.test.ts`, `devices.db.test.ts`, `manage.db.test.ts` and `map-items.db.test.ts`, none of which this diff touches. Main has not changed `src/server/devices|members|http`, `src/test` or `db` since the merge base.
  - **Root cause of the main bug confirmed.** On origin/main, `src/server/devices/handoffs.ts:175-181` runs `insert into device_handoffs ... values ($1, ...)` through `orgQuery`. The guard in `src/server/http/org-scope.ts:21` requires `org_id = $1` in the SQL text, so the call throws. The log has 32 matches for "orgQuery: SQL must filter org_id = $1". The impl-log matches my runs.

### Acceptance criteria
- [x] Any member of the org opens a device's page; another org's device id returns not found. Evidence:
  - `route.ts:12-25`: `withAuth({ tier: "user" })`, and a non-UUID id returns 404.
  - `history.ts:37-47`: one `notFound` for both an unknown id and another org's id.
  - `history.db.test.ts › a user (lowest tier) reads the history; another org's device id and an unknown id are 404 not_found` passes.
  - `devices-routes.test.ts › GET /api/devices/:id/history` passes.
  - `DeviceDetailView.test.tsx › loading … notFound has back link and no Retry` passes.
- [x] The page shows all fields, current location and holder, and any pending handoff. Evidence: the `DeviceDetailView.test.tsx` cases for fields, placement, holder (since, note, expiry, overdue) and pending all pass.
- [x] History lists every lifecycle event newest first with actor, from/to, note, expiry and who confirmed, and survives member deactivation. Evidence:
  - `history.test.ts`: one case per kind, plus the allowlist, tolerant-meta, cause and missing-member cases.
  - `history.db.test.ts`: full lifecycle, decline/cancel/extension, deactivation keeps names, keyset paging with equal `created_at`, and holderSince. All pass.
  - `DeviceHistory.test.tsx`: UTC+7 rendering (`06 Mar 2026, 00:30`).
  - I checked the mapper (`src/lib/devices/history.ts`) against the audit meta actually written in `handoffs.ts` (185-194, 296-305, 358-369, 501-509, 536-539, 590-599, 681-704) and `members/manage.ts:432-441`. The keys match.
- [x] Device names in the list, search and seat panel link to the detail page. Evidence:
  - `DevicesView.test.tsx › device name links to /devices/<id> (table and mobile card)` (2 anchors).
  - `SearchView.test.tsx` (updated).
  - `SeatDetailPanel.test.tsx › device name links to /devices/<id>`.
  - `nav.test.ts › deviceDetailHref …`.

Ming verification after merge (from plan.md, not verified here):
- Walk one device on the deployed app through assign, transfer, confirm, return and confirm. After each step, open `/devices/<id>` as a plain user. The history should grow newest first, and the pending section should show the open handoff.
  - Note: transfer, return and extension **start** currently fail on main because of the orgQuery bug above, so this walk cannot be completed until that bug is fixed.
- Deactivate a member who appears in the history and check that their name still shows.

### Issues
None blocking.

### Rules (CLAUDE.md)
No violations found.
- R1: the page imports only `@/ui`, and only the api route imports `@/server/devices/history`. `check:layers` is clean.
- R6: every query goes through `orgQuery` with `org_id = $1`. Every join carries `org_id` (`am.org_id = a.org_id`, `h.org_id = a.org_id`, and the subquery's `a.org_id = d.org_id`). The batched member lookup is org-scoped.
- R7: the route is read-only, and 401/403 come only from `withAuth`.
- R2/R3: no migration and no env.
- R4: every changed file is in the plan's file list. The `DeviceTable.tsx` labels were moved to `device-labels.tsx` unchanged; the only edit is the `export` keyword (checked line by line).
- R5: new logic has tests.

### Blockers from review agents
None. `security-review.md`, attempt 1: no blockers.

### Nits (do not block)
- `history.db.test.ts` uses the `beginHandoff` helper instead of the real `startTransfer`/`startReturn`/`startExtension`. This is justified by the baseline bug, and its meta mirrors `handoffs.ts`. Switch it to the real services once the bug is fixed.

### Follow-ups (out of scope)
- **BUG (pre-existing on main):** `startTransfer`/`startReturn`/`startExtension` in `src/server/devices/handoffs.ts` (~175, ~232, ~286) throw the orgQuery guard error. Use the `insert … select … from (select $1::uuid as org_id) o where o.org_id = $1::uuid` form used elsewhere. This causes about 13 of the 19 baseline `test:db` failures and blocks real use of handoff starts.
- Other baseline `test:db` failures on main: `devices.db.test.ts` (`device_handoffs_decided_check`), `manage.db.test.ts` (deactivate audit meta shape), and `map-items.db.test.ts` (ordering by `lower(name)`, probably collation).
- The impl-log saw one non-repeating ordering flake (a `create` row listed newest) in the lifecycle DB test. If it recurs in CI, consider a monotonic tiebreak for the audit order.
- `shellCopy.pages.deviceDetail` is unused, like `roomDetail`.
