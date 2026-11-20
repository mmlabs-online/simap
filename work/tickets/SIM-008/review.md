## Attempt 1 — 2026-11-20
Verdict: PASS

Conditional on CI: the migration and `scripts/schema-check.mjs` have never run against Postgres (this device has no
Docker or Postgres). The criteria that need a database are marked **pending CI** below, not passed. The PR must not be
merged until the CI steps "migrate CLI" and "schema check" are green. If either fails, the ticket goes back to REWORK.
I reviewed the SQL by hand (Postgres semantics, the migrator pre-scan) and found no defect.

### Checks (run by reviewer)
Node 24 with `--config.engine-strict=false` (CI uses Node 22).
- `pnpm format:check`: exit 0. "All matched files use the correct format", 30 files.
- `pnpm typecheck && pnpm check:layers`: exit 0. tsc clean (tsconfig `include` covers `db` and `scripts` with
  `allowJs`). "check-layers: 13 files, no violations".
- `pnpm test`: exit 0. 7 files, 47 tests passed. Matches impl-log.
- `pnpm build`: exit 0.
- Extra, the migrator pre-scan on the real file (`readMigrationFiles("db/migrations")`): `20261120150000 null`, so it
  is accepted and has no transaction-control statement. `node --check scripts/schema-check.mjs`: OK.

### Acceptance criteria
- [ ] AC1 `pnpm migrate` on an empty DB creates the schema, and a second run changes nothing. **Pending CI.** Evidence
  in place: the "migrate CLI" step (`.github/workflows/ci.yml:38-44`) applies the real init file to the service DB and
  greps "up to date" on the second run. `schema-check.mjs:43-49` repeats this on a throwaway DB. The pre-scan passes
  (above). Hand review found nothing that would fail on PG13+/PG17:
  - `create constraint trigger … after insert or update of … deferrable initially deferred for each row execute function`
    is valid syntax.
  - `raise … using errcode, constraint` is valid.
  - `%rowtype` refers to tables created earlier in the same transaction.
  - Every composite FK target has a matching `unique (org_id, id)`.
  - There is no PG15-only syntax.
- [ ] AC2 Every table has `org_id not null`, and no FK can cross orgs. **Pending CI** for the run
  (`schema-check.mjs:57-76`, `:161-186`). Read check: all 10 tables have `org_id uuid not null`, and all 11 FKs are
  `(org_id, x) references t (org_id, id)` (`20261120150000_init.sql:54,103-106,133-134,158-161,185`). Nullable FK
  columns use MATCH SIMPLE, so a null is skipped, which is correct.
- [ ] AC3 A second primary device on a seat fails at the DB. **Pending CI** (`schema-check.mjs:189-196`). Read check:
  the partial unique index `devices_one_primary_per_seat` (`init.sql:137`) is not deferrable, so it fails at insert
  with 23505, and the index name is reported as the constraint name.
- [ ] AC4 Room and seat codes are unique per org, not globally. **Pending CI** (`schema-check.mjs:199-223`; the seed
  puts `C302`/`C302-01` in both orgs). Read check: `rooms_org_code_key` and `seats_org_code_key` are
  `(org_id, code)` (`init.sql:73,100`).
- [x] AC5 The README documents the tables and the org rule, and the seed has no real data. Evidence:
  `db/migrations/README.md` section "Schema (v1)" (table list, org rule, FK convention, delete rules, deferred trigger,
  append-only audit, seed rules). `db/seeder.js` has only fixed `00000000-0000-4000-8…` UUIDs, `@simap.example`
  emails and invented names. `db/seeder.test.ts` › "seed data › uses only @simap.example emails and fixed fake ids"
  passes. The seed's idempotency check (`schema-check.mjs:106-112`) is **pending CI**.
- [ ] AC6 (plan) The DB enforces "primary owner = occupant". **Pending CI** (`schema-check.mjs:226-259`). Read check:
  - Both trigger functions re-read the row under deferral (`init.sql:229,252`).
  - The seat trigger uses `is distinct from`, so clearing the occupant to NULL is caught.
  - The demote-in-same-transaction case passes because the device row is re-read as `secondary`.
- [ ] AC7 (plan) There is no stored status, the cannot-seat reason needs the flag, and `seq > 0`. **Pending CI**
  (`schema-check.mjs:262-295`). Read check: `init.sql:79-107` has no status column, and the checks sit at `:97,99`.
- [x] AC8 All standard checks are green. Evidence: reviewer run above.

Ming verification after merge (carried to the PR): the production Postgres is 13 or newer, and the `simap` role owns
the `simap` database. Recorded as M-6 in `work/ming-todo.md`.

Scope: every changed file is in the plan's file list (plus the ticket's own work files). No `src/` change. No
unplanned High path. The only High paths are `db/migrations/20261120150000_init.sql` and `db/migrations/README.md`,
both named in the plan.

### Issues
#### Issue 1 — 🟡 should-fix — safety guard bypass
- **Where**: `db/seeder.js:11-21` (`assertDevSeedTarget`)
- **Expected**: The seed refuses every non-local target that `pg` would actually connect to.
- **Actual**: The guard checks only `new URL(databaseUrl).hostname`. `pg-connection-string` (2.14.1,
  `index.js:40-56`) lets a `?host=` query parameter override the URL hostname. So
  `postgres://u:p@localhost/simap?host=prod.example` passes the guard, but `pg` connects to `prod.example`.
- **Fix instruction**: In `assertDevSeedTarget`, refuse a URL whose `searchParams` has `host` or `hostaddr`
  (message: "refusing to seed: database host is not local"). Alternatively, parse with `pg-connection-string` and
  check the resulting `host`. Add a case to `db/seeder.test.ts` › "refuses any other host" with
  `postgres://u:secret-pw@localhost:5432/simap?host=10.0.0.5`. This can be fixed in the PR before merge or in a
  follow-up. It does not block, because it needs a deliberately crafted URL.

### Rules (CLAUDE.md)
No violations found.
- R1: no `src/` change.
- R2: one new forward-only file, no down, expand-only.
- R3: no new env names. The scripts never print `DATABASE_URL` or PG `detail` on the normal path.
- R4: within the plan.
- R5: the guard has unit tests, the SQL has a scripted CI check, and the Checks are green.
- R6: `org_id` is on every table, and every FK and unique key leads with `org_id`.

### Blockers from review agents
None. The orchestrator adds any findings from `security-review.md`.

### Nits (do not block)
- `db/seeder.js:111-113`: every seed device has type `'laptop'`, including "Monitor B" and "Máy in C". This is
  cosmetic.
- `scripts/schema-check.mjs:51`: `c` has no `on("error")` listener. On an unexpected throw, the `drop … with (force)`
  in `finally` kills its connection and can emit an unhandled `error` event. The exit code is non-zero anyway, but the
  output is noisier.
- `scripts/schema-check.mjs`: an unexpected exception (for example, the seed failing) prints the raw pg error, which
  can include `detail`. Only fake seed data is involved, so the risk is low.

### Follow-ups (out of scope)
- Invariant 3 under concurrency: the deferred triggers run their check just before each commit with READ COMMITTED
  snapshots. Two concurrent transactions can both pass if they commit at nearly the same time: one promotes a primary
  for the old occupant while the other changes that occupant. SIM-012/SIM-013 services should `select … for update`
  the seat row before changing the occupant or a device's role or seat. Note this in those tickets.
- Spec §8 says "Every unique key and foreign key includes `org_id`". `layout_fixtures`, `invitations` and `audit_log`
  have no `unique (org_id, id)`, because nothing references them. Add one if a future table points at them.
