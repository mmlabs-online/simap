# Security review — SIM-026

## Attempt 1 — security-ai-generated-code-auditor (DB integration test harness)

Scope: `git diff origin/ticket/SIM-025...HEAD`. I read these files: `scripts/test-db.mjs`, `scripts/test-db.test.ts`, `src/test/db/global-setup.ts`, `src/test/db/fixtures.ts`, `vitest.db.config.ts`, `vitest.config.ts`, `.github/workflows/ci.yml`, `src/server/rooms/rooms.db.test.ts` (grepped for destructive SQL, env and console), `db/seeder.js` (`assertDevSeedTarget`), `db/migrator.js` (error and log strings), `scripts/check-layers.mjs`, `src/server/http/org-scope.test.ts` and `plan.md`. I did not run the checks and did not read any .env* file.

**Verdict: no 🔴 blockers. Two 🟡 should-fix and four 💭 notes.** The production guard and the URL hygiene hold up. The gaps are both about keeping the test-only OrgScope forgery test-only.

### Findings

**🟡 1. The `as never` cast gets past the OrgScope cast guard. The cast is safe in the fixture, but the same trick now works anywhere.** `src/test/db/fixtures.ts:18` (`const scope: OrgScope = { orgId } as never;`)
- Risk: `org-scope.test.ts:21-37` scans every non-`.test.` file under `src/` for `as OrgScope` / `<OrgScope>`. `fixtures.ts` is not a `.test.` file, so it is scanned. The author used `as never` to dodge the scan (the code comment says so). The plan (`plan.md` line 49) said `as OrgScope`. The cast itself is fine in a fixture. The problem is that the R6/D5 guard now has a known bypass: `const s: OrgScope = { orgId: body.org } as never` in a route handler forges a scope from client input and passes every check. CWE-863.
- Fix, one commit:
  - Put `{ orgId } as OrgScope` back in the fixture.
  - Allowlist the test-support tree in the guard: add `.filter((rel) => !rel.startsWith("test/"))` next to the `with-auth.ts` exclusion.
  - Widen the regex to also catch `:\s*OrgScope\s*=\s*[^;]*\bas\s+never\b`, so the bypass fails the guard everywhere else.

**🟡 2. Nothing stops app code from importing `src/test/**`.** `scripts/check-layers.mjs:27-33`
- Risk: `layerOf()` returns `null` for `src/test/...`, so `import { newOrg } from "@/test/db/fixtures"` from `src/app/api/**` or `src/server/**` is never flagged. That would put a scope-forging helper and a second pool constructor into the server bundle. Today it would likely crash at runtime because the fixture imports `inject` from `vitest`, but that is luck, not a rule.
- Fix: add a `test` layer to `check-layers.mjs`:
  - `if (p.startsWith("src/test/")) return "test";`, with `ALLOWED.test = ["test", "server", "lib"]`.
  - Reject any import that targets `test` unless the importing path matches `TEST` (`*.test.*`) or is itself in `src/test/`.
  - Add a case to the check-layers unit test.

**💭 3. The guard only checks the host string, so a local port-forward to the shared server passes.** `db/seeder.js:22-30`, called from `scripts/test-db.mjs:14` and `src/test/db/global-setup.ts:18`
- How the guard holds up:
  - It refuses `?host=` and `?hostaddr=` overrides and any host outside `localhost` / `127.0.0.1` / `::1`.
  - It refuses an empty host, so `PGHOST` from the environment cannot fill one in, and it refuses unix-socket paths.
  - It refuses `NODE_ENV=production` and an unparseable URL.
  - It runs twice: in the wrapper before Vitest starts, and again in `globalSetup` if someone runs `vitest -c vitest.db.config.ts` directly.
  - The parse uses `pg-connection-string`, the same parser pg uses.
  - `--env-file-if-exists` does not override an existing env var, so the CI value wins.
- Residual risk: an SSH tunnel such as `localhost:5433` to the mmlabs Postgres passes the guard. Even then the damage is small. The harness only runs `create database simap_test_<random>`, migrates inside that new database and drops it by its generated name. It never touches the base database's data. The production `simap` role should also lack `CREATEDB`.
- Optional hardening: refuse when the base database name is `simap` and the server reports a non-dev marker, or require `SIMAP_TEST_DB=1`. Otherwise just accept and document the tunnel case in the README.

**💭 4. If `create database` fails, the cleanup can drop a database this run did not create.** `src/test/db/global-setup.ts:28-35`
- Risk: if `create database` fails, the catch runs `drop database if exists ${dbName} with (force)`. The name has 48 random bits, so a collision with an existing `simap_test_*` database (for example one from another dev's concurrent run on the same server) is astronomically unlikely. In that case, though, this run would force-drop the other run's database.
- Fix: set `let created = false` and flip it to true after `create database` succeeds. Drop only when `created`.
- Otherwise, `with (force)` is well scoped:
  - The name is generated locally from `randomBytes` hex, never from input, so there is no SQL injection.
  - It only ends connections to that one database.

**💭 5. `assertTestDb` is a convention each file must remember, not something the pool enforces.** `src/test/db/fixtures.ts:7-13`, called only in `rooms.db.test.ts:48-50`
- Risk is low: `testPool()` always connects to the injected `simap_test_<hex>` URL that `globalSetup` built. A future `*.db.test.ts` that skips `assertTestDb` is still safe today.
- Fix: make it structural with `export async function testPool() { const p = createPool(...); await assertTestDb(p); return p; }`.
- In this diff the only destructive statement in a test is `rooms.db.test.ts:175` (`delete from seats where org_id = $1 and room_id = $2 and seq = 2`). It is scoped and runs after the assertion. There are no `drop` or `truncate` statements in tests.

**💭 6. The URL is never printed, and CI permissions are fine.**
- The wrapper's messages are fixed strings plus guard messages, and the guard messages never include the URL (`seeder.js:10`). `scripts/test-db.test.ts:30-35` checks that a `secret-pw` password never appears in stdout or stderr and that Vitest never starts.
- In `globalSetup`, `new URL(base!)` cannot throw an error carrying the URL, because the guard already parsed the same string and turned any failure into a URL-free message.
- `runMigrations` gets `log: () => {}`, and its `MigrationError` strings contain versions and names only (`migrator.js:49-284`).
- `provide()` passes the URL to workers. Vitest does not print it.
- CI: workflow-level `permissions: contents: read` (`ci.yml:9-10`); trigger is `pull_request`, not `pull_request_target`, so fork PRs get no secrets. `DATABASE_URL` holds the throwaway service-container credentials, like the three existing steps. That value is not a secret, and there is no `echo` or `set -x`.

### Follow-ups (out of scope)
- The OrgScope cast guard is a text heuristic. Beyond `as never`, other escape hatches are not caught, for example a helper typed `(x: unknown) => OrgScope`, or `Object.assign`. Consider a single exported `__testOrgScope()` in `src/test/` plus the layer rule in finding 2, so tests never need ad-hoc casts. This should be a `debt` issue, `project:simap`.
- Orphaned `simap_test_*` databases after a killed local run are cleaned up by hand (README step 4). A `pnpm test:db --clean` that drops stale `simap_test_*` databases, behind the same guard, would remove a manual step. That is a nice-to-have, not a security fix.

Coverage note: this was a static review of the diff and the files listed above. I did not execute the harness, so I could not check a CI log for `postgres://`.
