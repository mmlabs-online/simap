# Consult — database-optimizer (SIM-026, 2026-11-20)

**Findings**
- The rooms service already takes its DB as an argument (`Db = TxPool & Query`, built from a pool). DB tests can therefore pass in their own pool for the throwaway DB. `getPool()` and the app's `DATABASE_URL` stay untouched, and nothing in `src/server` needs to change.
- `createPool` (`src/server/db/pool.ts`) sets `max: 5` and `statement_timeout: 5000`. The timeout turns a broken lock test into a failure after 5 s instead of a hang. It also installs the date type parser, so the tests should build their pool with `createPool(url)`. Importing it works because the vitest config stubs `server-only`.
- `scripts/schema-check.mjs` already has the right lifecycle:
  - It guards with `assertDevSeedTarget`, creates a random `simap_schema_<hex>` database from an admin connection, and runs `runMigrations`.
  - It drops with `with (force)` in a `finally`.
  - `seedDev` gives two orgs, room C302 with an occupant and a primary device, and fixed UUIDs.
- `vitest.config.ts` includes `src/**/*.test.ts`. A `*.db.test.ts` would therefore run under plain `pnpm test`, so it must be excluded there.
- CI's Postgres 17 service uses the `postgres` superuser on localhost:5432, so `create database` works. No new service is needed.
- Rollback-per-test cannot cover this ticket. `withTx` really commits, and the deferred trigger only fires at COMMIT.

**Recommendations**
1. **Isolation: one throwaway DB per run, fresh random org and room ids per test.**
   - Use Vitest `globalSetup` in a separate `vitest.db.config.ts`. It guards, creates the DB, migrates, and exposes the URL to workers via `provide`/`inject` or an env var such as `SIMAP_TEST_DATABASE_URL`. That name is distinct from `DATABASE_URL`, so prod config cannot leak in.
   - Extract `scripts/lib/throwaway-db.mjs` (guard, create, migrate, drop), shared with `schema-check.mjs`.
   - Fresh UUID orgs per test mean no cleanup and no ordering dependence. This also suits `audit_log`, which refuses truncate (55000). Scope assertions by org and entity id.
   - A schema per test is a poor fit. Migrations are not schema-qualified, and constraint and trigger names are harder to reason about.
2. **Run serially.** Set `fileParallelism: false`. The suite is small, and the concurrency tests want determinism.
3. **Keep `pnpm test` DB-free.**
   - Add `exclude: ["**/*.db.test.ts"]` to `vitest.config.ts`.
   - `pnpm test:db` runs a thin `scripts/test-db.mjs` wrapper. The wrapper checks `DATABASE_URL`, calls `assertDevSeedTarget`, and prints "refused" and exits 2 before spawning `vitest run -c vitest.db.config.ts`. That satisfies the "exit 2 without connecting" criterion.
   - Export a pure `checkTarget()` from the wrapper and unit-test the refusal in a plain `*.test.ts`, which needs no DB.
4. **Non-local guard.**
   - Call the guard in the wrapper and again in `globalSetup`.
   - Use a `simap_test_<hex>` DB name.
   - Assert `current_database()` starts with `simap_test_` before any destructive statement.
5. **Case 4 (deferred trigger at COMMIT).**
   - Call the real `deleteRoom(pool, scope, sub, id, true)` on a seeded room with an occupant and a primary device. Assert `ok`. Then assert the room and its seats are gone, the device has `seat_id` null and role `secondary`, and the `room.delete` audit row exists.
   - Add a negative control with a raw two-statement transaction on its own client that violates the trigger. Assert 23514 at COMMIT, to prove the test can fail.
   - Plain delete with an occupant should give 409 `room_not_empty`.
6. **Delete-lock concurrency (two clients, pool `max >= 4`).**
   - **No sleeps.**
     - Client A runs `begin; update seats set occupant_id=... ` and holds the transaction open.
     - Start `deleteRoom(force=false)` without awaiting it.
     - Poll `pg_stat_activity` (`wait_event_type='Lock'`) until the delete is seen blocked. Bound the poll to about 3 s, under the 5 s statement timeout.
     - A commits. Assert the delete resolves `room_not_empty` (409), not success or an FK error.
     - Without SIM-025's `select … for update` on seats, the impact check would read a pre-commit snapshot, so this test fails on the bug.
   - **Second test.** A holds `select … from rooms … for update`. Fire `allocateSeatSeq` and `deleteRoom` concurrently and assert they serialise: the counter is consistent and no seats are orphaned.
   - Release in `finally` (A rolls back, `pool.end()`).
7. **Crash cleanup.**
   - Teardown drops the DB in `globalSetup`'s returned function.
   - A killed local run orphans a DB. In CI the service container is ephemeral, so that is fine. Document a manual `drop database` for local runs.
   - Skip an automatic sweep: there is no creation-time column, so it would be risky.
8. **CI step.**
   - Add a step after `schema check`, with `env: DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres` and `run: pnpm test:db`. That is the same literal the workflow already uses.
   - Never echo the URL, and keep `set -x` off.
   - Make assertion messages free of the URL.
9. **Docs.** Update CLAUDE.md Commands, `.claude/loop.config.md` Checks (CI-only) and README.

**Risks**
- This is the first real Postgres run of the rooms SQL, and the dev device has no Postgres. Expect bugs. Per the ticket, if a test exposes one, record it and stop for Ming.
- SIM-025 changes `deleteRoom` first. Rebase so the lock tests assert post-SIM-025 behaviour. If it is not merged, mark the lock case `it.skip` with a note.
- Case 2 (seq >= 100) needs seats seeded with high `seq` and `seat_counter` directly via SQL. Check the code padding format in `src/lib/rooms/seat-code`.
- `TZ=Asia/Ho_Chi_Minh` and the date parser from the main vitest config must be copied to the DB config, or date output may differ.
- `globalSetup` runs outside the workers, so process state is not shared. Pass the URL via `provide`/`inject` or an env var.
- `pg_stat_activity` visibility is fine because everything runs as the same superuser in CI.

**Open questions (proposed defaults)**
1. Isolation style: truncate and reseed, or random org ids with no truncation? Default: random org and room ids per test, no truncation.
2. Extract the shared `scripts/lib/throwaway-db.mjs` and refactor `schema-check.mjs`? Default: yes, with minimal edits and unchanged behaviour. It is not a High path.
3. Env var name for the test target? Default: the wrapper reads `DATABASE_URL` (CI parity) and hands workers `SIMAP_TEST_DATABASE_URL`.
4. Include the two-client lock tests in this ticket? Default: yes. SIM-025 introduces the lock, so the tests belong with it, and they run after it merges.
