# Security review — SIM-008

## Attempt 1 — security-ai-generated-code-auditor (SIM-008, branch ticket/SIM-008)

Scope: `git diff origin/main...HEAD`. Files: `db/migrations/20261120150000_init.sql`, `db/seeder.js`, `db/seed-dev.js`, `db/seeder.test.ts`, `scripts/schema-check.mjs`, `.github/workflows/ci.yml`, `package.json`, `CLAUDE.md`, `work/ming-todo.md`. This was a static read only. I did not run any checks or a database. I did not read any `.env*` file.

**Verdict: no 🔴 blockers. 2 🟡 should-fix (both in the dev tooling, not the schema) and 6 💭 notes / follow-ups.**

### What I verified (confirmed safe)
- **Cross-org isolation (R6):** every table has `org_id uuid not null`.
  - Every FK target has `unique (org_id, id)`.
  - All 12 FKs are composite `(org_id, x) → (org_id, id)`: members→groups, seats→rooms/members/groups/projects, devices→members/seats, seat_requests→seats/members×3, layout_fixtures→rooms.
  - With `MATCH SIMPLE`, a NULL in a nullable reference column (`group_id`, `occupant_id`, `decided_by_id` and so on) skips the check. That is safe because `org_id` is never NULL, so a non-NULL reference is always checked inside the same org.
  - Every unique key and partial unique index leads with `org_id`. The invitations email index is `(org_id, lower(email))`.
  - `schema-check.mjs:57-76` checks all of this in the catalogue, and `:161-186` tests cross-org refusals.
- **Triggers:** none are `SECURITY DEFINER`; all run as the invoker. No dynamic SQL.
  - Invariant 3 is covered on both sides: `devices` on insert/update of role, owner_id or seat_id; `seats` on update of occupant_id.
  - Both are deferred to COMMIT and re-read the row, which is correct for deferred triggers.
  - `is distinct from` makes "occupant set to NULL while a primary device stays" fail, as it should.
  - A seat delete is blocked by `devices_seat_fkey on delete restrict`.
  - An `org_id` change is covered by the composite FKs.
  - The audit trigger covers UPDATE, DELETE and TRUNCATE.
- **Secrets:** no secret values in the diff.
  - Guard errors never include the URL (`seeder.js:41-49`, tested at `seeder.test.ts:29-46`).
  - `seed-dev.js` prints only "seed ok (seats: n)" or "seed failed".
  - `schema-check.mjs` prints step names and pass/FAIL.
  - The throwaway DB name is random hex, and table names come from constants. No injection.
- **CI:** `DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres` (`ci.yml:49-52`) is the login for the throwaway service container. It is the same literal the existing migrate-smoke step uses, so it is not a secret.
- **Seed data:** fixed fake UUIDs, `@simap.example` emails, invented names, no real data.

### Findings

1. 🟡 **The seed's "local host only" check can be bypassed with a `?host=` query parameter.** `db/seeder.js:44-49`
   - **Risk:** `assertDevSeedTarget` checks `new URL(databaseUrl).hostname`. But `pg` parses the URL with `pg-connection-string`, and a `host` query parameter overrides the hostname. I confirmed this in `node_modules/.pnpm/pg-connection-string@2.14.1/.../index.js:40-42,54-56` (`if (!config.host)` — "Only set the host if there is no equivalent query param").
   - So `postgres://simap:…@localhost/simap?host=<shared-db-host>` passes the guard, and `seedDev` then inserts fake orgs, members and so on into the shared or production database. `hostaddr` works the same way. Someone would have to write that URL, but this guard exists to stop mistakes, and the ticket's AC5 says "never production".
   - **Fix:** in `assertDevSeedTarget`, parse with the same parser pg uses (`import { parse } from "pg-connection-string"`, already a dependency of `pg`). Check that `parse(databaseUrl).host` is in `LOCAL_HOSTS`, and refuse if `hostaddr` is set (or simply refuse any URL whose `searchParams` has `host` or `hostaddr`).
   - Add test cases to `db/seeder.test.ts` › "refuses any other host": `postgres://u:secret-pw@localhost:5432/simap?host=10.0.0.5` and `...?hostaddr=10.0.0.5`. Both must throw `/not local/` and the message must not contain `secret-pw`.

2. 🟡 **`schema:check` has no target guard: it creates a database, migrates it, seeds it and drops it on whatever server `DATABASE_URL` points to.** `scripts/schema-check.mjs:11-33, 338` and `package.json` (`schema:check` loads `.env.local`)
   - **Risk:** only the randomly named `simap_schema_<hex>` database is dropped, so existing data is not at risk. But if `.env.local` points at the shared mmlabs Postgres and the role has CREATEDB, the script:
     - creates and seeds databases on the shared production cluster;
     - leaves an orphaned database holding fake org data there if the process is killed before `finally` runs.
   - It also skips the seed guard by calling `seedDev` directly.
   - **Fix:** call `assertDevSeedTarget({ databaseUrl: base, nodeEnv: process.env.NODE_ENV })` (with the finding 1 fix) before `admin.connect()`, and exit 2 on refusal. CI already uses `localhost`, so it is unaffected.

3. 💭 **Trigger functions do not pin `search_path`.** `init.sql:225, 248, 273`
   - **Risk:** this is low because the functions run as the invoker. But the unqualified `devices` and `seats` names resolve through the caller's `search_path`. A role with a different `search_path`, or an object planted earlier in it (see note 5 on PG < 15), changes what the trigger reads.
   - **Fix (cheap hardening):** add `set search_path = public, pg_catalog` to each `create function … language plpgsql`, or schema-qualify as `public.devices` and `public.seats`. Keep them `SECURITY INVOKER`. Do not make them `SECURITY DEFINER`.

4. 💭 **"Append-only" `audit_log` is not a security boundary against the app role.** `init.sql:273-282`
   - **Risk:** the migration runs as role `simap`, which owns the table (M-6). If the runtime uses the same role, any SQL path it runs can `ALTER TABLE audit_log DISABLE TRIGGER …` or `DROP TRIGGER` and then rewrite the audit history. The trigger protects against bugs, not against a compromised app.
   - **Follow-up:** have one role that owns the migrations and a separate runtime role with only `INSERT, SELECT` on `audit_log` (and DML on the other tables). This fits with SIM-021 / deploy.

5. 💭 **Shared cluster defaults on PG 13/14.** `work/ming-todo.md` M-6
   - **Risk:** M-6 accepts PG ≥ 13. Before PG 15, `PUBLIC` has `CONNECT` on new databases and `CREATE` on schema `public`. Other mmlabs app roles on the shared cluster can therefore connect to the `simap` database and create objects in `public`. They cannot read simap tables, since nothing is granted to them, but this weakens the separation between organizations' data on a shared cluster and makes note 3 reachable.
   - **Follow-up (extend M-6, Ming runs it as owner):** `revoke connect on database simap from public; revoke create on schema public from public;`

6. 💭 **The `schema-check.mjs` header promises more than it does.** `scripts/schema-check.mjs:3`
   - The header says the script never prints "Postgres detail". But any exception inside `try` (migration or seed failure) or from `admin.connect()` propagates after `finally`, and Node prints the full `pg` error.
   - Such errors can contain host, port and user name, and row values (here only fake ones). They never contain the password, so the CI risk is negligible.
   - **Fix (optional):** wrap the top level in a catch that prints `err.code` / `err.constraint` only and exits 1, or soften the header comment.

7. 💭 **No RLS, by design.** The plan's R4 excludes RLS and D5 puts the org scoping in the app.
   - The schema blocks cross-org *references* but not cross-org *reads*. Every query added from SIM-009 onward must filter on the verified token's `org` claim.
   - This is noted so later reviewers check it per route. It is not a defect here.

8. 💭 **The seed may ship in the runtime image** (plan open question 13).
   - In a container, `localhost` can be a sidecar or proxy to the real database. If so, only the `NODE_ENV=production` check stops the seed.
   - **Follow-up for SIM-004:** exclude `db/seeder.js`, `db/seed-dev.js` and `db/seeder.test.ts` from the image, and make sure the image sets `NODE_ENV=production`.

### Follow-ups (out of scope for SIM-008)
- Separate migration-owner and runtime roles; runtime gets only `INSERT, SELECT` on `audit_log` (note 4). This is for SIM-021 / deploy.
- Add the `revoke connect … from public` and `revoke create on schema public from public` statements to M-6 (note 5).
- SIM-004: keep the seed files out of the image and set `NODE_ENV=production` (note 8).
- Every API ticket: check that all queries filter on the token's `org` claim (note 7).

Rescan after the fixes: findings 1 and 2 count as resolved only when the new `seeder.test.ts` cases with `?host=` / `?hostaddr=` pass, and `schema-check.mjs` refuses a non-local `DATABASE_URL` with exit code 2.
