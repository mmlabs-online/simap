# Review — SIM-002

## Attempt 1 — 2026-11-20
Verdict: PASS

PASS depends on the PR's CI run being green. AC 1–3 are **pending CI** (Ming accepted this on 2026-11-20 because this
device has no Docker or Postgres). If the CI steps "migrate CLI" or "migrate smoke" fail, this verdict does not stand.

### Checks (run by reviewer)
Run in a fresh clone of `ticket/SIM-002` @ 5753de7 (scratchpad `clone-sim002`), `pnpm install --frozen-lockfile
--config.engine-strict=false`, local Node v24.20.0 (engines wants 22; the only effect is an engine warning).
- `pnpm format:check`: exit 0, "All matched files use the correct format." (26 files)
- `pnpm typecheck && pnpm check:layers`: exit 0. `next typegen && tsc --noEmit` clean; "check-layers: 13 files, no violations"
- `pnpm test`: exit 0, "Test Files 6 passed (6)", "Tests 42 passed (42)"
- `pnpm build`: exit 0; routes `ƒ /api/healthz` and `ƒ /api/readyz`; `.next/standalone/node_modules/pg/package.json`
  exists (pg is traced, so no `next.config.ts` change is needed. This confirms plan Approach 7)
- These results match impl-log.md "Checks" exactly.

### Acceptance criteria
- [x] **AC 1** (`pnpm migrate` on an empty DB applies all files in order and records them; a second run applies
  nothing): **pending CI**. Pure logic: `db/migrator.js:45` sorts by version, and `db/migrator.js:72` filters out
  applied versions. Unit tests `db/migrator.test.ts:50` (pending in lexical order) and `:55` (nothing pending when all
  applied) pass. One transaction per file and a recorded row per file: `db/migrator.js:260-287`.
  Real-DB proof in CI: `scripts/migrate-smoke.mjs:66-76` applies 2 fixtures, asserts the log order `_a` then `_b`,
  counts 2 rows in `schema_migrations`, and expects exactly `["up to date"]` on the rerun. `.github/workflows/ci.yml:38-44`
  runs the real entry `node db/migrate.js` twice against the `postgres:17` service (`ci.yml:19-26`); `grep -q "up to date"`
  runs under the Actions `bash -eo pipefail` shell, so a failing node exit fails the step.
  Judgement: together these prove the AC. The CLI step only exercises the empty-directory case (no committed `.sql`
  yet). Applying files in order is proven through `runMigrations`, the same function the entry calls
  (`db/migrate.js:36`).
- [x] **AC 2** (editing an applied migration fails with a checksum error and changes nothing): **pending CI**.
  `db/migrator.js:66-68`; the error is thrown in planning, before any `begin` (`db/migrator.js:249` before line 260).
  Unit test `db/migrator.test.ts:62` passes; the CRLF/LF checksum basis is tested at `:42`. CI smoke
  `scripts/migrate-smoke.mjs:78-89` appends to an applied file and adds a pending 3rd file, then asserts a
  `MigrationError` matching `checksum mismatch for applied migration`, a row count still at 2, and that `smoke_c` does
  not exist. The entry maps `MigrationError` to exit 1 (`db/migrate.js:11-13`).
- [x] **AC 3** (a bad file name or a file containing `begin`/`commit` is refused): proven by unit tests; the real-DB
  confirmation is **pending CI**. `db/migrator.js:177-187` refuses with exit code 2 before connecting
  (`runMigrations` reads files at `:206`, connects at `:218`). Unit tests pass: `db/migrator.test.ts:26` (rejected
  names, including 13 digits and diacritics), `:100-121` (all 17 control forms), `:123-139` (comments, nested
  comments, strings, E-strings, quoted identifiers, `do $$ … end $$`, plpgsql bodies, Vietnamese text), `:177` (bad
  name, exit 2) and `:182` (control file, exit 2, message names the file and keyword only, no SQL text). Smoke
  `scripts/migrate-smoke.mjs:91-103`. The runtime guard is kept as a second layer (`db/migrator.js:268-274`).
- [x] **AC 4** (`GET /api/readyz` returns 200 when the DB answers and 503 with no details when it does not or
  `DATABASE_URL` is unset): `src/app/api/readyz/route.ts:9-26`. Unit tests pass: `route.test.ts:15` (unset, 503, ping
  not called), `:23` (200 ok), `:31` (body is exactly `{"status":"unavailable"}` for a 28P01 error carrying a message),
  `:44` (log has the code only), `:61` (`no-store` on both). `ping` timeout: `src/server/db/pool.ts:40-53`, tested at
  `pool.test.ts:63`. Lazy pool and null without a URL: `pool.ts:33-38`, tested at `pool.test.ts:13`. No live curl
  against a real DB was run (no Docker), and CI does not exercise the route against a DB. This is listed under Ming
  verification below. It is not a blocker: the contract is fully unit-tested and `ping` is a plain `pool.query("select 1")`.
- [x] **AC 5** (unit tests cover file-name parsing, ordering, checksum comparison and statement rejection; pure, no
  DB): `db/migrator.test.ts` covers all four. No test opens a DB connection (`readMigrationFiles` uses `mkdtemp`
  directories only). The `migrate.cli.test.ts` "unreachable host" case targets port 1 and gets refused.
- [x] **Plan row 6** (never print `DATABASE_URL`; migrate entry independent of Next.js): `db/migrate.cli.test.ts:23-30`
  passes (exit 1; no password, host or URL in the output), and `:17` passes (exit 2, `DATABASE_URL is not set`). The
  imports in `db/migrate.js`, `db/migrator.js` and `scripts/migrate-smoke.mjs` are only `node:*`, `pg` and
  `./migrator.js` (no `next`, `@/` or `server-only`).
- [x] **Plan row 7** (all checks green): see Checks.
- [ ] **`.env.example` contains `PORT=` and `DATABASE_URL=` with no values**: **to be confirmed by Ming**. The agent
  deny rule `Read(**/.env.*)` hides this file, so the reviewer did not read it or try to work around the rule. The diff
  stat shows only `+3` lines added to `.env.example` (no deletions), which is consistent with an append. Ming checks
  it in the PR (High path).

Port fidelity (against tudocuatui `origin/main` reference): `db/migrator.js` matches reference `server/migrator.js`
line for line, except for the planned changes. Removed: RLS/owner code. Changed: `LOCK_KEY` `7410512013`,
`simap-migrate`, `simap.migrating`. Added: duplicate-version check (`:46-52`), `findTransactionControl` (`:81-166`)
and the pre-scan (`:181-187`). Timeouts are unchanged (Decision 8). `db/migrate.js` matches reference
`server/migrate.js` apart from the dir (`./migrations`) and the dropped `TUDO_OWNER_SUB`. `pool.ts` `createPool`
matches reference `db.js` settings and the date parser (Decision 6).

### Issues
None blocking. No 🔴 or 🟡 issues.

### Rules (CLAUDE.md)
No violations found.
- R1: `src/server/db/pool.ts:1` is `import "server-only"`. Only `src/app/api/readyz/route.ts:1` imports it.
  `check:layers` is clean.
- R2/D3: forward-only, checksummed, no down files (D3 supersedes the "working down" wording, as the plan states).
  `db/migrations/README.md:7`. No `.sql` files are committed.
- R3: the URL is never logged (CLI test). Logs carry only fixed event names and codes (`pool.ts:28`,
  `route.ts:23`). The `.env.example` content is for Ming to confirm (see above).
- R4: every changed file is in the plan's list, except `work/**` bookkeeping (see Nits).
- R5: checks are green and the new logic has tests.
- R6: documented at `db/migrations/README.md:15`.

### Blockers from review agents
None — `security-review.md` Attempt 1 has no 🔴 (2 🟡: smoke script can print `DATABASE_URL` on setup errors; unpinned `postgres:17` image). (orchestrator)

### Nits (do not block)
- `work/ming-todo.md` (M-5 entry) is changed but is in neither the plan file list nor impl-log "Out-of-plan files".
  It is orchestrator bookkeeping for the plan gate, like `ticket.md`, so this is acceptable. Future impl-logs could
  name it.
- `src/server/db/pool.test.ts:40`: the plan asked for the date-parser case to run under `TZ=Asia/Ho_Chi_Minh`; the
  test does not set TZ. It makes no difference, because the parser is the identity function.
- `scripts/migrate-smoke.mjs:37-39`: `admin.connect()` / `create database` are outside the `try`. A connection failure
  prints Node's default stack, which can include the host:port, but never the password. This only affects CI with
  its throwaway credentials.
- `db/migrator.js:147-149`: splitting on `;` refuses SQL-standard function bodies
  (`create function … begin atomic select 1; end;` returns `end`; verified with a probe). This is a false refusal, so
  it fails safe. Use a plpgsql `$$` body instead, or extend the scanner when a migration needs `begin atomic`.

### Ming verification after merge
- Local run on a device with Docker: `docker compose -f compose.dev.yml up -d`, then `pnpm migrate` (expect `up to
  date`), then `pnpm dev` and `curl -i localhost:3000/api/readyz` (expect 200 `{"status":"ok"}`). Stop the DB and
  expect 503 `{"status":"unavailable"}`. This is plan Approach 13 and AC 4's live path, not run on this device.
- Confirm `.env.example` holds `PORT=` and `DATABASE_URL=` (names only).
- Confirm the PR's CI steps "migrate CLI" and "migrate smoke" are green (AC 1–3).

### Follow-ups (out of scope)
- impl-log notes that `gh` was unavailable, so the `debt` issue for "verify migrate / smoke / readyz locally with
  Docker" was not created. The orchestrator must open it in the workspace repo (labels `debt`, `project:simap`), as
  CLAUDE.md §8 requires.
- `findTransactionControl`: support `begin atomic` bodies if a future migration needs them.
