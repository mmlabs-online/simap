Status: READY

# Plan — SIM-026: Run service SQL against Postgres in CI (DB integration tests)

## Scope summary
From `work/tickets/SIM-026/ticket.md`:

> Service SQL (starting with the rooms service) runs against a real Postgres in CI on every PR, so SQL mistakes are
> caught before merge instead of only by fake-client tests and hand review.

> - A DB integration test setup: a throwaway database per run (like `scripts/schema-check.mjs`), migrated with the real
>   migrator, guarded by `assertDevSeedTarget` (never a non-local host, never `NODE_ENV=production`).
> - Integration tests for the rooms service (`src/server/rooms/rooms.ts`) through its real functions:
>   1. the same room code in org A and org B succeeds; a duplicate in one org (also differing only by case) → 409;
>   2. rename with a seat whose seq ≥ 100 rewrites every seat code in one transaction;
>   3. the seat counter keeps growing after a seat is deleted (D30);
>   4. plain delete of a room with an occupant → 409 `room_not_empty`; forced delete with an occupant and a primary
>      device succeeds and passes the deferred trigger at COMMIT;
>   5. a room id from another org → 404 for update and delete.
> - A separate command (e.g. `pnpm test:db`) and a CI step on the existing Postgres service; `pnpm test` stays
>   database-free (tests skip cleanly when no DB is configured).
> - Docs: the command in CLAUDE.md Commands and `.claude/loop.config.md` Checks (as a CI-only check), README.

Out of scope (ticket): "Changes to the rooms service itself (SIM-025), unless a test exposes a real bug — then record
it and stop for Ming." Origin: `work/tickets/SIM-010/review.md` Attempt 1 condition (rooms SQL never ran against
Postgres) and `work/tickets/SIM-010/plan.md:186-189` (step 7, the one-off DB check this replaces). Rules: CLAUDE.md R5,
R6, R2/D3 (no migration here).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | `pnpm test:db` creates a throwaway DB, migrates, runs the integration tests, and drops the DB; it refuses a non-local `DATABASE_URL` (exit 2) without connecting. | Refusal: `scripts/test-db.test.ts` (runs in `pnpm test`, no DB) — exit 2 for `10.0.0.5` and `?host=` override, for `NODE_ENV=production`, and for unset `DATABASE_URL`; output has no password and no Vitest run banner. Lifecycle: read `src/test/db/global-setup.ts` (guard → `create database simap_test_<hex>` → `runMigrations` → `provide` → teardown `drop database … with (force)`); the PR's CI log for step `db integration tests` shows the run passing. |
| 2 | Cases 1–5 pass against Postgres 17 in CI. | PR CI job `ci`, step `db integration tests` green (`gh pr checks <PR>` / job log); test names in `src/server/rooms/rooms.db.test.ts` map to cases 1–5 (table below). |
| 3 | `pnpm test` without a database still passes and does not try to connect. | Locally with `DATABASE_URL` unset: `pnpm test` green; `pnpm vitest list --filesOnly` lists no `*.db.test.ts` file (excluded in `vitest.config.ts`). |
| 4 | CI runs `pnpm test:db` on every PR; the step prints no connection string. | `.github/workflows/ci.yml` diff: step in job `ci` (runs on `pull_request` and `push` to main), `env: DATABASE_URL` only, no `echo`, no `set -x`; CI log of the step contains no `postgres://`. |
| 5 | Commands documented in CLAUDE.md, loop.config Checks and README. | Diff of `CLAUDE.md` Commands line, `.claude/loop.config.md` Checks (row marked CI-only) and Prepare note, `README.md` Local database section. |

## Ming verification after merge
None. (CI is the first real run; the reviewer reads the PR's CI log. There is no Postgres on the dev device.)

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `scripts/test-db.mjs` | New. Thin wrapper: if `DATABASE_URL` unset → `test:db refused: DATABASE_URL is not set`, exit 2; `assertDevSeedTarget({ databaseUrl, nodeEnv })` (from `db/seeder.js:13`) in try/catch → `test:db refused: <message>`, exit 2 (message never has the URL); else `spawnSync(process.execPath, [<vitest bin>, "run", "-c", "vitest.db.config.ts"], { stdio: "inherit" })` and exit with its status. Resolve the bin via `createRequire(import.meta.url).resolve("vitest/vitest.mjs")` (or `vitest/package.json` + `bin`). Never prints the URL. | AC1 (exit 2 before connecting, no Vitest start) | No |
| `scripts/test-db.test.ts` | New. Spawns `scripts/test-db.mjs` the same way `scripts/schema-check.test.ts:4-15` does. | AC1 unit test of the refusal path (ticket Test plan "Unit") | No (Low: `**/*.test.ts`) |
| `vitest.db.config.ts` | New. Same `resolve.alias` as `vitest.config.ts:9-14` (`@`, `server-only` stub), `process.env.TZ = "Asia/Ho_Chi_Minh"`, `test: { environment: "node", include: ["src/**/*.db.test.ts"], globalSetup: ["src/test/db/global-setup.ts"], fileParallelism: false, testTimeout: 15000, hookTimeout: 60000 }`. | AC1/AC2: separate DB-only run | No (basename is not `config.*`, so `**/config.*` does not match) |
| `vitest.config.ts` | Add `exclude: [...configDefaults.exclude, "**/*.db.test.ts"]` (import `configDefaults` from `vitest/config`). | AC3: `src/**/*.test.ts` would otherwise pick up `*.db.test.ts` (`vitest.config.ts:19`) | No |
| `src/test/db/global-setup.ts` | New. Vitest `globalSetup` (default export `setup(project)`): re-runs the guard on `process.env.DATABASE_URL` (throws a URL-free error); admin `pg.Client` on the base URL; `create database simap_test_<12 hex>`; `runMigrations({ connectionString: url, dir: <repo>/db/migrations, log: () => {} })` (`db/migrator.js`); `project.provide("simapTestDbUrl", url)`; returns teardown that runs `drop database if exists <name> with (force)` and ends the admin client (same lifecycle as `scripts/schema-check.mjs:23-46,343-346`). Declares `ProvidedContext { simapTestDbUrl: string }` via `declare module "vitest"`. | AC1 lifecycle | No |
| `src/test/db/fixtures.ts` | New. Test helpers: `testPool()` = `createPool(inject("simapTestDbUrl"))` (`src/server/db/pool.ts:12`, gives `statement_timeout` 5 s and the date parser); `assertTestDb(pool)` (throws unless `current_database()` starts with `simap_test_`); `newOrg()` → `{ orgId: randomUUID(), scope: { orgId } as OrgScope }`; raw-SQL inserts `addMember`, `addRoom(code, { seatCounter })`, `addSeat(roomId, seq, { occupantId })`, `addDevice(ownerId, seatId, role)`, `addPendingRequest(seatId, subjectId)`; `waitForLockWait(pool, ms)` (polls `pg_stat_activity`). Raw SQL here is test-only and every statement filters/sets `org_id`. | Shared fixtures for cases 1–5 | No |
| `src/server/rooms/rooms.db.test.ts` | New. Cases 1–5 plus the lock test and the trigger negative control (see Tests). Calls the real exports of `src/server/rooms/rooms.ts` with the test pool. | AC2 | No (Low: `**/*.test.ts`) |
| `package.json` | Add script `"test:db": "node --env-file-if-exists=.env.local scripts/test-db.mjs"`. | AC1 | No |
| `.github/workflows/ci.yml` | Add after `schema check` (line 52): step `name: db integration tests`, `env: DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres` (same literal as lines 40/47/51), `run: pnpm test:db`. | AC4 | No (only `release*`/`deploy*` workflows are High) |
| `CLAUDE.md` (project) | Commands line 26-27: add `pnpm test:db` (DB integration tests in a throwaway database, needs a local `DATABASE_URL`; CI runs it). | AC5 | No |
| `.claude/loop.config.md` | Checks: add row `db integration (CI-only) | pnpm test:db` with a note that it needs Postgres and runs in CI; Prepare (line 22-23): mention `pnpm test:db` next to `pnpm schema:check`. | AC5 | No |
| `README.md` | Local database section (lines 5-11): add step for `pnpm test:db`, and the manual cleanup of an orphaned `simap_test_*` DB after a killed local run (`drop database <name> with (force)`). | AC5; consult item 7 | No |

Not touched: `src/server/**` non-test code, `db/**`, `scripts/schema-check.mjs`, `scripts/check-layers.mjs`.
**Gate: none** — no file in the list matches a High path in `.claude/loop.config.md` / `.github/risk-tiers.yml`.

## Data model / migration
None. The tests use the existing `db/migrations` applied by the real migrator.

## API contract
None.

## Tests to write
All in `src/server/rooms/rooms.db.test.ts` unless noted. Each test makes fresh orgs with `newOrg()` (random UUIDs), so no
cleanup and no ordering dependence; assertions are scoped by org and entity id. `actorSub` is a random UUID
(`audit_log.actor_sub` is uuid). `beforeAll`: `testPool()` + `assertTestDb`; `afterAll`: `pool.end()`.

| Test (file › name) | Covers |
|---|---|
| `scripts/test-db.test.ts` › exits 2 before connecting for a non-local DATABASE_URL | AC1: `postgres://u:secret-pw@10.0.0.5:5432/simap` and `…@localhost:5432/simap?host=10.0.0.5` → status 2, stderr `/not local/`, output has no `secret-pw`, no `RUN`/vitest banner; completes well under the 15 s spawn timeout |
| `scripts/test-db.test.ts` › exits 2 with NODE_ENV=production | AC1: status 2, `/production/`, no `secret-pw` |
| `scripts/test-db.test.ts` › exits 2 when DATABASE_URL is unset | AC1: status 2, `/not set/` |
| rooms (db) › case 1 › same code in two orgs succeeds | `createRoom` with `validateRoomCreate({ code: "C302", name: "Phòng C302" })` in org A and org B → both `ok`; `listRooms` of each org returns only its own room (R6) |
| rooms (db) › case 1 › duplicate code in one org → 409 room_code_taken | second `createRoom` "C302" in org A → `{ ok: false, status: 409, code: "room_code_taken" }`; only one room and one `room.create` audit row for that org |
| rooms (db) › case 1 › duplicate differing only by case → 409 | `validateRoomCreate({ code: " c302", … })` yields `C302` (`src/lib/validate/room.ts:19-23`) → 409; also `updateRoom` of another org-A room to `c302` (validated) → 409 and that room keeps its code |
| rooms (db) › case 2 › rename rewrites every seat code including seq ≥ 100 | room `C302` with `seat_counter` 120 and seats seq 1, 7, 100, 120 (raw insert, codes `C302-01`, `C302-07`, `C302-100`, `C302-120`); `updateRoom(…, { code: "C303" })` → ok, codes `C303-01`, `C303-07`, `C303-100`, `C303-120` (format `src/lib/rooms/seat-code.ts:5-9`); `room.update` audit meta `{ from: "C302", to: "C303", seats: 4 }`; seats of another room unchanged |
| rooms (db) › case 2 › rename is one transaction (seat code conflict rolls back the room code) | in the same org insert a stray seat with code `C309-01` in another room; rename `C302` → `C309` → 409 `room_code_taken` (`seats_org_code_key`, `src/server/rooms/pg-error.ts:3`); room code is still `C302`, every seat code unchanged, no `room.update` audit row |
| rooms (db) › case 3 › seat counter keeps growing after a seat is deleted (D30) | `createRoom`; twice inside `withTx`: `allocateSeatSeq` + insert seat with the returned seq/code → seq 1, 2; delete seat seq 2 (raw SQL); `allocateSeatSeq` again → seq 3 (not 2); `rooms.seat_counter` = 3; `allocateSeatSeq` with another org's scope → `null` and the counter is unchanged |
| rooms (db) › case 4 › plain delete with an occupant → 409 room_not_empty | room with seat (occupant) + primary device; `deleteRoom(…, false)` → `{ ok: false, status: 409, code: "room_not_empty" }`; room, seats and device unchanged; no `room.delete` audit row |
| rooms (db) › case 4 › forced delete with occupant and primary device passes the deferred trigger at COMMIT | same seed plus a free seat with a pending request; `deleteRoom(…, true)` → `{ ok: true, value: null }`; room and its seats gone; the pending request gone (FK cascade); the device still exists with `seat_id` null and `role` `secondary`; one `room.delete` audit row with `entity_id` = room id and meta `{ code, seats: 2, devices: 1, pending: 1, forced: true }` (SIM-025 meta shape) |
| rooms (db) › case 4 › negative control: an occupant change without demote fails at COMMIT | on its own client: `begin`, change the occupant of a seat holding a primary device, `commit` → rejects with code `23514`, constraint `devices_primary_owner_is_occupant` (proves the trigger is live in this DB, so the forced-delete pass is meaningful) |
| rooms (db) › case 4 › plain delete waits for a concurrent occupant change and then refuses | room with one free seat and no devices. Client A (`pool.connect()`): `begin; update seats set occupant_id = <member>` on that seat, held open. Start `deleteRoom(…, false)` without awaiting. `waitForLockWait` polls `select count(*) from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and pid <> pg_backend_pid()` every 25 ms, bounded at 3 s (fail if never seen — no sleeps). A `commit`s. The delete resolves `409 room_not_empty`; the room and the seat (with occupant) still exist. `finally`: A `rollback` (ignore errors) and `release`. Relies on SIM-025's seat `for update` |
| rooms (db) › case 5 › another org's room id → 404 for update and delete | room in org B; with org A's scope: `updateRoom` (name and code patch) → `404 not_found`; `deleteRoom` with force false and true → `404 not_found`; `getDeleteImpact` → `404`; org B's room unchanged and still present; no audit rows in org A |

Domain focus (`loop.config.md`): Vietnamese diacritics in room names (`Phòng C302`) round-trip unchanged through
`createRoom`/`listRooms`; nullable `description`/`floor` stay `null` in the returned DTO (asserted in case 1).

## Approach
1. Rebase `ticket/SIM-026` on `main` after SIM-025 merges (or on `ticket/SIM-025` if the orchestrator says so), so
   `deleteRoom` already has the seat lock and the new audit meta.
2. Write `scripts/test-db.mjs` and `scripts/test-db.test.ts`; add `test:db` to `package.json`. Run `pnpm test` (the new
   unit test runs without a DB).
3. Add `vitest.db.config.ts` and the `exclude` in `vitest.config.ts`. Check `pnpm vitest list --filesOnly` shows no
   `*.db.test.ts`.
4. Write `src/test/db/global-setup.ts` and `src/test/db/fixtures.ts`. Guard twice (wrapper and global setup); assert the
   `simap_test_` prefix with `current_database()` before any test statement. Error messages and logs never include
   the URL (R3).
5. Write `src/server/rooms/rooms.db.test.ts` (cases above). It imports only `@/server/**`, `@/lib/**`, `@/test/db/*`;
   it is a `*.test.ts` file, so `check-layers` does not require `import "server-only"` (`scripts/check-layers.mjs:18,51`)
   and `src/test/**` is not a layer.
6. Add the CI step; update CLAUDE.md, `.claude/loop.config.md`, README.
7. Run Checks locally: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`
   (`vitest.db.config.ts` is in tsconfig via `*.config.ts`). `pnpm test:db` cannot run on the dev device (no Postgres);
   push the branch and read the CI step.
8. **If a DB test exposes a real bug in the rooms service** (a failure not caused by the test or fixtures): do not
   change `src/server/rooms/**` or any other service code, do not skip or weaken the test. Record it in `impl-log.md`
   under `## Service bug found` (test name, Postgres error code/constraint, `rooms.ts` file:line, proposed fix), then
   stop and report to the orchestrator so Ming decides (likely a BUG ticket). The same applies if the lock-wait poll
   in the concurrency test never sees the delete blocked (that would mean the SIM-025 seat lock is missing).

Rules: R1 (test files only import server/lib/test helpers; no new production entry), R2 (no schema change), R3 (no new
env names: `DATABASE_URL` exists, `simapTestDbUrl` is a Vitest `provide` key, not env; nothing printed), R4 (no
service edits), R5 (checks green; the wrapper's refusal has a unit test), R6 (every fixture insert sets `org_id`; case
5 and the `listRooms` assertions check scoping through the real service).

## Specialist input used
From `consult-database-optimizer.md`:
- Adopted: pass a pool built with `createPool(url)` into the service functions, no `src/server` change (Findings 1-2).
- Adopted: one throwaway DB per run via `globalSetup` in a separate `vitest.db.config.ts`, URL handed to workers with
  `provide`/`inject`; fresh random org ids per test, no truncation (Rec. 1, Open question 1 default).
- Adopted: `fileParallelism: false` (Rec. 2); `exclude` `**/*.db.test.ts` in `vitest.config.ts` and a wrapper that
  refuses with exit 2 before spawning Vitest (Rec. 3); guard twice, `simap_test_` prefix, `current_database()`
  assertion (Rec. 4).
- Adopted: case 4 assertions plus the trigger negative control (Rec. 5).
- Adopted: the first lock test (delete vs concurrent occupant change, `pg_stat_activity` polling, no sleeps) (Rec. 6,
  Open question 4 default) — it is case 4 under concurrency and checks SIM-025's lock.
- Rejected: the second lock test (`allocateSeatSeq` vs `deleteRoom` behind a held room lock). Its outcome order is
  nondeterministic and its assertions (no orphaned seats) are already enforced by the FK; not in the ticket's cases.
  Can be a follow-up if Ming wants it.
- Adopted (changed): unit-test the refusal path, but by spawning the wrapper like `schema-check.test.ts` instead of
  exporting a `checkTarget()` — it also proves "exit 2 without starting Vitest".
- Rejected for this ticket: extracting `scripts/lib/throwaway-db.mjs` and refactoring `schema-check.mjs` (Open
  question 2). It changes a working CI gate for no gain to this ticket and grows the diff; the ~20 lines of lifecycle
  are duplicated in `global-setup.ts` instead. Follow-up debt issue (see Assumptions).
- Adopted: crash cleanup = teardown drop + documented manual drop, no automatic sweep (Rec. 7); CI step literal and no
  echo (Rec. 8); TZ copied into the DB config (Risks).

## Assumptions
1. **Builds on SIM-025.** SIM-025 (same batch, builds first) changes `deleteRoom` to: begin → `lockRoom`
   (`select id, code from rooms … for update`) → `select id from seats where org_id = $1 and room_id = $2 order by id
   for update` via `orgQuery` (also on the non-forced path; skipped on 404) → impact count → forced path: update
   devices, delete seats, delete room → audit insert with meta `{ code, seats, devices, pending, forced }` → commit.
   Lock order: room row first (`for update`, or `for share` for occupant/device changes), then seats `for update` in
   id order, then devices/seat_requests. This ticket rebases on it; the case-4 audit-meta assertion and the
   concurrency test assume that behaviour. Default: rebase after SIM-025 merges; if SIM-025 is not merged when this
   builds, mark only the concurrency test `it.skip` with a note pointing to SIM-025 and assert the current meta keys.
2. **Hotspots.** SIM-025 edits `src/server/rooms/rooms.ts` (not edited here) and possibly `src/server/rooms/rooms.test.ts`.
   SIM-006.2 and SIM-019 (same batch) may also touch `CLAUDE.md`, `README.md`, `package.json` or `.github/workflows/ci.yml`;
   expect small text rebases there. Default: rebase, keep both edits.
3. **Schema-check refactor is a follow-up.** Default: open a `debt` issue (`project:simap`) "share throwaway-DB
   lifecycle between schema-check.mjs and the DB test global setup".
4. **Local `pnpm test:db`** works against `compose.dev.yml` Postgres only if the role can `create database` (the
   same requirement `pnpm schema:check` already has). Default: document it in README; no compose change.
5. **Vitest 5 `globalSetup` signature** is `setup(project: TestProject)` with `project.provide`, read in tests with
   `inject` from `vitest`. Default: use it; if the API differs, pass the URL as `process.env.SIMAP_TEST_DATABASE_URL`
   set in global setup before workers start (never `DATABASE_URL`), and note it in impl-log.
6. **Size.** About 450-550 changed lines, most of them test code (`rooms.db.test.ts` ~250). No split: the setup is
   unusable without the tests, and the tests are the ticket's goal.

## Blocking questions
None.

## Split proposal
None.
