## Attempt 1 — 2026-11-20
Verdict: PASS

PASS is conditional on the PR's CI step `db integration tests` going green. That step is the first real run of
`pnpm test:db`: there is no Postgres on the review device, so the DB tests, global setup and CI step were reviewed by
reading the code against the schema and `rooms.ts`. If CI fails, the ticket goes back to REWORK (or to
`## Service bug found` per plan step 8 if the cause is in `src/server/rooms/**`).

Diff base: `origin/ticket/SIM-025...HEAD` (SIM-025 is reviewed separately).

### Checks (run by reviewer)
Windows, Node 24.20, `--config.engine-strict=false` (CI uses Node 22).
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck`: exit 0.
- `pnpm check:layers`: exit 0, "check-layers: 124 files, no violations".
- `pnpm test`: exit 0, "Test Files 49 passed (49)", "Tests 470 passed | 3 skipped (473)". These match impl-log.
- `pnpm build`: exit 0.
- `pnpm test:db` (CI-only): not run, no Postgres. Pending CI.
- Extra: `vitest list --filesOnly` (default config) lists no `*.db.test.ts` file. `vitest list -c vitest.db.config.ts
  --filesOnly` lists only `src/server/rooms/rooms.db.test.ts`. `node scripts/test-db.mjs` with `DATABASE_URL` unset
  prints "test:db refused: DATABASE_URL is not set" and exits 2. With `postgres://u:pw@10.0.0.5/x` it prints
  "test:db refused: refusing to seed: database host is not local" and exits 2. Neither prints the URL.

### Acceptance criteria
- [x] AC1, refusal part: the script refuses a non-local `DATABASE_URL` with exit 2 and does not connect.
  Evidence: `scripts/test-db.test.ts` (3 tests, green in `pnpm test`) covers `10.0.0.5`, the `?host=` override,
  `NODE_ENV=production` and an unset URL. Each case checks exit 2, that `secret-pw` is absent, and that no
  `RUN`/vitest banner appears. The reviewer's manual run above gives the same result. The guard runs before
  `spawnSync` (`scripts/test-db.mjs:8-18`), so neither Vitest nor pg starts.
- [~] AC1, lifecycle part (creates a throwaway DB, migrates, runs the tests, drops the DB): correct on reading;
  **pending CI**. `src/test/db/global-setup.ts` runs the guard again (l.18), then
  `create database simap_test_<12 hex>` (the name is hex-only, so interpolating it into SQL is safe), then the real
  `runMigrations` (signature matches `db/migrator.js:205`), then `project.provide`. Teardown runs
  `drop … with (force)` (needs PG13+; CI uses 17) in a `finally` that ends the admin client. If create or migrate
  fails, the DB is dropped before the error is rethrown. Vitest 5.1.0 `inject<keyof ProvidedContext>` exists
  (`node_modules/vitest/dist/index.d.ts:92`), the `declare module "vitest"` augmentation typechecks, and
  `vitest/vitest.mjs` resolves through the package `exports`.
- [~] AC2, cases 1-5 pass on Postgres 17: **pending CI**. I checked every test by hand:
  - The fixture column lists match `db/migrations/20261120150000_init.sql` (members, rooms, seats, devices,
    seat_requests, audit_log).
  - Case 1: `listRooms` orders by `r.code` (`rooms.ts:69`), so `["C302","D101"]` is deterministic. Uppercasing via
    `validate/room.ts:22` is why `c302` gives 409.
  - Case 2: rename runs one `unnest` update (`rooms.ts:155-163`) using `formatSeatCode` padStart(2), so `C303-100` is
    correct. In the conflict test, the stray `C309-01` hits `seats_org_code_key`, which `pg-error.ts:3` maps to
    `room_code_taken` and rolls back.
  - Case 3: `allocateSeatSeq` reaches seq 3 after a delete, and a foreign scope returns `null`.
  - Case 4: the forced delete demotes devices, then deletes seats, then the room (`rooms.ts:242-250`). The audit meta
    has the shape `{code, seats, devices, pending, forced}` and the expected counts 2/1/1 match the seed. The pending
    request is removed by `seat_requests_seat_fkey … on delete cascade`.
  - Negative control: `seats_primary_owner_trg` is `after update of occupant_id`, deferred, and raises 23514 with
    constraint `devices_primary_owner_is_occupant`. The test expects exactly that at `commit`, which proves the
    trigger is live.
  - Concurrency: the holder's `update seats` takes the row lock. `deleteRoom`'s `select … for update` on seats
    (`rooms.ts:235`) waits for it, and that shows up in `pg_stat_activity` as `wait_event_type = 'Lock'`. After the
    commit, the next statement's snapshot (`impactOf`) sees the occupant and returns 409. The poll is bounded at
    3 s with 25 ms steps. The pool has `max: 5` (`pool.ts:15`) and the test needs at most 3 connections. The
    `finally` rolls back and releases.
  - Case 5: the 404 paths for update (name and code), delete (both force values) and impact; org A gets no audit rows.
- [x] AC3, `pnpm test` without a DB passes and does not connect. Evidence: the exclude is in `vitest.config.ts:20`,
  `vitest list` shows no `.db.test.ts`, and `pnpm test` is green. `scripts/test-db.test.ts` spawns `node` directly
  (not through pnpm, so `.env.local` is not loaded) with only `PATH` set, and every case is refused before any
  connection.
- [~] AC4, CI runs `pnpm test:db` on every PR and the step prints no connection string. The step is in job `ci`
  (`.github/workflows/ci.yml:53-56`), which runs on `pull_request` and `push` to main. It sets only `env:
  DATABASE_URL` (the same literal as the other steps) and has no echo or `set -x`. pnpm echoes the script command,
  which contains no URL. Confirming that the job log has no `postgres://` is **pending CI**.
- [x] AC5, docs. Evidence: the `CLAUDE.md` Commands line, `.claude/loop.config.md` Prepare (l.24) and Checks row
  "db integration (CI-only, needs Postgres)", and `README.md` step 4 (needs `create database`, guard, manual
  orphan drop).

Scope: every changed file is in the plan's file list. No `src/server/**` non-test code is touched and no High path
changed (`ci.yml`, `vitest*.config.ts` and `scripts/test-db.*` are not High). Gate `none` is correct.

### Issues
None blocking.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/test/**` is not a layer, `check:layers` is clean, and fixtures import only `@/server/db/pool` plus a type.
- R3: no URL is printed anywhere and no new env name is added (`simapTestDbUrl` is a provide key, not an env var).
- R4: inside the plan.
- R5: checks green; the refusal path has unit tests.
- R6: every fixture insert sets `org_id`, and the scoping assertions go through the real service.

### Blockers from review agents
- None. `security-review.md` Attempt 1: 0 🔴, 2 🟡, 4 💭.

### Nits (do not block)
- 💭 The `as never` cast in `src/test/db/fixtures.ts:17` (`const scope: OrgScope = { orgId } as never;`) is
  acceptable for test-support code. It is local, commented, and the file is never imported by production code
  (`check:layers` would flag a page/ui import of `@/test`; `src/server` importing it is not prevented but there is no
  reason to). The problem is that it evades the cast-guard heuristic (`src/server/http/org-scope.test.ts:21-37`) in
  a form the guard cannot see. A future production `as never` would be just as invisible. The cleaner long-term
  option is to add `test/**` to the guard's allowlist next to `server/http/with-auth.ts` and write
  `{ orgId } as OrgScope` in fixtures: the exception is then explicit and greppable, and the guard keeps meaning
  "only these places forge a scope". Changing the guard is out of this plan (it is SIM-025/org-scope territory), so
  this is a follow-up, not rework.
- 💭 `global-setup.ts:22` uses `base!`. This is safe because `assertDevSeedTarget` throws on a missing URL, but a
  narrowing `if (!base) throw …` would read better.
- 💭 In the concurrency test, `expect(waited).toBe(true)` comes after `await pending`. If the lock were missing, the
  failure would show up as a 409/ok mismatch instead of "never waited". Asserting `waited` right after the poll
  (before the commit, with the holder rolled back in `finally`) would make the failure message point at the lock.

### Follow-ups (out of scope)
- Debt issue from plan Assumption 3: share the throwaway-DB lifecycle between `scripts/schema-check.mjs` and
  `src/test/db/global-setup.ts`. impl-log lists it but does not show an issue number; the orchestrator must open the
  `debt` + `project:simap` issue (CLAUDE.md §8) if it is not open yet.
- Cast guard: allow `src/test/**` explicitly and replace the `as never` in fixtures with `as OrgScope` (see nits).
- The second lock test rejected in the plan (`allocateSeatSeq` vs `deleteRoom`), if Ming wants it.
