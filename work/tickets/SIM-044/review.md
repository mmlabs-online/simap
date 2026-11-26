## Attempt 1 — 2026-11-26
Verdict: REWORK

Reviewed commit 9e4a3f0 ("SIM-044: implement"), slice A only (AC1-4, AC7). AC5 is SIM-044.1, AC6 is SIM-045.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 824 files, no violations"
- `pnpm test` — exit 0, "Test Files 315 passed | 1 skipped (316); Tests 3170 passed | 7 skipped (3177)" (matches impl-log)
- `pnpm build` — exit 0, `ƒ /api/devices/mine` listed
- `pnpm test:db` — **exit 1**. The reviewer ran it against a throwaway local Postgres 16 (scratchpad cluster, 127.0.0.1).
  "Test Files 2 failed | 18 passed (20); Tests 2 failed | 305 passed (307)". The implementer did not run it (impl-log:
  "NOT RUN"). Both failures are in test code this commit added; see Issues 1 and 2. Every other new DB test passes
  (devices visibility, my devices, history visibility).

### Acceptance criteria
- [x] AC1 User list only held; Manager/Admin full list — evidence: `devices.ts` `heldWhere` (appended to the `where`
  in `listDevices`/`getDevice`, filter in SQL before the limit); `devices.test.ts › device visibility per tier (DEV-12)`
  green; `devices.db.test.ts › devices (db): visibility › list per tier` green in the reviewer's DB run. The edited
  existing test `reads › list: every item has placement…` fails, see Issue 1.
- [x] AC2 detail/history 404 for not held, same as cross-org; no 403 — evidence: `devices.db.test.ts › visibility ›
  detail…` (equals the cross-org result), `› pending recipient…`, `› former holder…`; `history.test.ts` (audit query
  never runs on refusal); `history.db.test.ts › visibility` green; route test asserts `[sub, tier]`. No `forbidden`/403
  added in the diff (grep); read paths only; `reload` (devices.ts:665) is unchanged, so writes do not 404 after commit.
- [ ] AC3 search returns only held devices for a User — product code at `search.ts:141-144` looks right and
  `search.test.ts` per-tier cases are green, but the DB test meant to prove it (`search.db.test.ts › device group per
  tier`) **fails before any assertion**, see Issue 2. No passing DB evidence yet.
- [x] AC4 `/api/devices/mine` for every tier, paged, org-scoped, DEV-12 fields — evidence: `devices.db.test.ts › my
  devices` (3 tests) green; `devices.test.ts › listMyDevices` green; `devices-routes.test.ts › GET /api/devices/mine`
  green; `cursor.test.ts`, `my-devices-query.test.ts` green.
- [ ] AC7 tests cover the rule per tier — tests are written for list, detail, history, search, mine, but two of them are
  red in `pnpm test:db` (Issues 1, 2). Met once they pass.

Ming verification after merge (carry into the PR): sign in as a User and as a Manager on production — Devices page
(User sees only own devices), search for another member's device name, open `/devices/<id>` of another member's device
(shows "not found").

### Issues
#### Issue 1 — 🔴 blocker — failing test (wrong assertion)
- **Where**: `src/server/devices/devices.db.test.ts:108`
- **Expected**: the assertion matches the existing rule. `canPlace(tier, mine)` gives `true` for a Manager on a
  device they do not own (`src/lib/devices/rules.test.ts:36`: "non-owner: user no, manager yes, admin yes"), and
  `toDto` sets `canPlace: r.owner_id !== null && canPlace(tier, r.mine)` (`devices.ts:110`). Both devices here are owned by x.
- **Actual**: `expect(asManager…every((d) => !d.mine && !d.canPlace)).toBe(true)` → "expected false to be true".
- **Fix instruction**: change the predicate to `(d) => !d.mine && d.canPlace` (or assert only `!d.mine`). Then run
  `pnpm test:db` on a local Postgres (see Note below) and record the result in impl-log.

#### Issue 2 — 🔴 blocker — failing test (fixture violates schema)
- **Where**: `src/server/search/search.db.test.ts:278` and `:281`
- **Expected**: test data satisfies `devices_mac_check` (`db/migrations/20261120150000_init.sql:128`:
  `mac ~ '^([0-9a-f]{2}:){5}[0-9a-f]{2}$'`, lowercase only).
- **Actual**: `update devices set … mac = 'AA:BB:CC:00:00:01'` → `error: new row for relation "devices" violates check
  constraint "devices_mac_check"`; the test aborts, so AC3 has no DB evidence.
- **Fix instruction**: store lowercase MACs (`'aa:bb:cc:00:00:01'`, `'aa:bb:cc:00:00:02'`). Keep the query
  `q("AA:BB:CC:00:00:02")` uppercase if you want to keep proving case-insensitive MAC search. Re-run `pnpm test:db`;
  all assertions in this test must pass.

Note for the implementer: `pnpm test:db` can run in this environment without Docker. As root:
`su postgres -c "/usr/lib/postgresql/16/bin/initdb -D <scratch>/pg/data -U postgres --auth=trust -E UTF8 --locale=C.UTF-8"`,
then `pg_ctl … -o '-p 54329 -k <scratch>/pg -c listen_addresses=127.0.0.1' start`, then
`DATABASE_URL=postgres://postgres@127.0.0.1:54329/postgres pnpm test:db` (the scratch dirs must be readable by `postgres`).
The rule that a mismatch between impl-log and the reviewer's run is a blocker does not apply here: impl-log honestly says "NOT RUN".

### Rules (CLAUDE.md)
- R5: no PASS with a red check (`pnpm test:db`, Issues 1-2).
- R1, R6, R7, R2, R3, R4: no violations found. Lib files stay pure (`visibility.ts`, `cursor.ts`, validator); the new route is the
  only entry into server; every query keeps `org_id = $1` and identifies the caller only by the verified `sub`; held
  refusals are 404 `not_found` from the service on read paths; no migration; no config. All changed files are in the
  plan's file table or its "needed" note; option-B nav files were not touched.

### Blockers from review agents
None. The orchestrator copies any 🔴 from `security-review.md` here if that review runs.

### Nits (do not block)
- `devices.db.test.ts` "pages by lower(name), id" compares `new Set(all)` with the names, so it does not check order,
  and it does not check `all.length === 3` (no duplicate across pages). Consider asserting
  `first.items[1].name` sorts before `second.items[0].name` per the DB (e.g. compare with
  `select name from devices … order by lower(name), id`) and asserting the length.
- `history.db.test.ts › visibility` ignores the result of `confirmHandoff`; assert `.ok` so a failed setup cannot make the
  "former holder 404" assertion pass for the wrong reason.
- `pnpm test:db` printed `Error: Connection terminated unexpectedly` after the summary (an unhandled pool `error` event
  at teardown). Probably not caused by this ticket; check whether it shows up on `main`.

### Follow-ups (out of scope)
- Already listed by the plan: SIM-044.1 (seat/member/layout data for Users), write-action existence oracle (Q10),
  other members' email visible to Users (Q6).

## Attempt 2 — 2026-11-26
Verdict: PASS

Reviewed rework commit ec0bb73 (on top of 9e4a3f0), slice A only (AC1-4, AC7). AC5 is SIM-044.1, AC6 is SIM-045.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 824 files, no violations"
- `pnpm test` — exit 0, "Test Files 315 passed | 1 skipped (316); Tests 3170 passed | 7 skipped (3177)"
- `pnpm build` — exit 0, `ƒ /api/devices/mine` listed
- `pnpm test:db` — exit 0, "Test Files 20 passed (20); Tests 307 passed (307)" against a throwaway local Postgres 16
  (127.0.0.1:54329, stopped and data dir deleted afterwards). Matches impl-log attempt 2. 307 = attempt 1's
  305 passed + the 2 that failed before.
  Note: my first run exited 1 with `Error: Connection terminated unexpectedly` after an all-green summary. The Postgres
  log showed `PANIC: could not open file ".../pg_control": Permission denied`: the scratchpad parent dir had been reset to
  mode 700 during the run, so the `postgres` user lost access and the server died at the teardown checkpoint. That is an
  environment problem, not a code problem. The re-run with a data dir outside that tree exited 0 with no teardown error. This
  probably also explains the attempt-1 nit about the same error, so that nit is withdrawn.

### Blockers from attempt 1
- Issue 1 — fixed. `src/server/devices/devices.db.test.ts:108` now asserts `!d.mine && d.canPlace`, which matches
  `canPlace(tier, mine)` (Manager may place a device they do not own). Green in `pnpm test:db`.
- Issue 2 — fixed. `src/server/search/search.db.test.ts:278,281` store lowercase MACs (`aa:bb:cc:00:00:01/02`) that
  satisfy `devices_mac_check`. The query stays uppercase, so case-insensitive MAC search is still proved. Green in `pnpm test:db`.

### Acceptance criteria
- [x] AC1 User list only held; Manager/Admin full list — evidence as in attempt 1. `devices.db.test.ts › reads › list:
  every item has placement…` is now green.
- [x] AC2 detail/history 404 for not held, same as cross-org; no 403 — evidence unchanged from attempt 1 (still green).
- [x] AC3 search returns only held devices for a User — `search.db.test.ts › search (db): device group per tier` is green
  (`pnpm test:db` exit 0). `search.test.ts` per-tier cases are green.
- [x] AC4 `/api/devices/mine` for every tier, paged, org-scoped, DEV-12 fields — evidence unchanged (still green).
- [x] AC7 tests cover the rule per tier for list, detail, history, search and mine. All green in `pnpm test` and `pnpm test:db`.

Ming verification after merge (carry into the PR): sign in as a User and as a Manager on production. Check the Devices page
(a User sees only their own devices), search for another member's device name, and open `/devices/<id>` of another
member's device (it shows "not found").

### Scope
The rework changes only the two test lines named in attempt 1 and impl-log. No out-of-plan files.

### Rules (CLAUDE.md)
R1-R7: no violations. R5 is now satisfied: all checks are green and the new logic has tests.

### Blockers from review agents
None. The orchestrator copies any 🔴 from `security-review.md` here if that review runs.

### Nits (do not block)
- Still open from attempt 1: `devices.db.test.ts` "pages by lower(name), id" does not check order or `length === 3`.
  `history.db.test.ts › visibility` does not assert `confirmHandoff(...).ok`.

### Follow-ups (out of scope)
- Unchanged from attempt 1: SIM-044.1, write-action existence oracle (Q10), other members' email visible to Users (Q6).
