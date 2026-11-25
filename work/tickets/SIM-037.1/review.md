## Attempt 1 — 2026-11-25
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (686 files).
- `pnpm typecheck` — exit 0 (next typegen + tsc --noEmit clean).
- `pnpm check:layers` — exit 0, "check-layers: 632 files, no violations".
- `pnpm test` — exit 1: "Test Files 1 failed | 240 passed | 1 skipped (242); Tests 1 failed | 2374 passed | 9 skipped (2384)".
  The only failure is `scripts/dev-process.test.ts > real tree > root exits first; the orphan grandchild is still stopped`
  (`expected [ +0 ] to deeply equal []` at `:245`). Re-run alone: `pnpm vitest run scripts/dev-process.test.ts` exit 0,
  21/21 passed. The diff does not touch `scripts/dev-process*`. It matches impl-log and is a pre-existing timing flake in
  a real-process-tree test, so it does not block this ticket (see Follow-ups).
- `pnpm build` — exit 0.
- `pnpm test:db`, `pnpm migrate`, `node scripts/migrate-smoke.mjs`, `pnpm schema:check` — NOT RUN. This machine has no
  Docker, WSL or Postgres. CI (`.github/workflows/ci.yml`) runs these only on `pull_request`/push to `main`, so no CI run
  exists for this branch yet.

### Acceptance criteria
- [ ] 1 `pnpm migrate` on a DB with existing devices succeeds; every existing device keeps its owner; `pnpm schema:check`
  passes — NOT MET (no evidence), see Issue 1. Static review: the migration
  (`db/migrations/20261125120000_device_lifecycle.sql`) is expand-only. The new CHECKs on null columns pass and both
  invariant checks are NOT VALID then VALIDATE. The composite owner FK is MATCH SIMPLE, so it accepts a null owner. Stage 1
  of `scripts/schema-check.mjs:75-87` seeds an owned device before the device types migration, and the section 10 cases
  (`:575-753`) look correct as written. I checked constraint name order for the double-failing `swap` kind, parameter type
  inference in `case when $6 = 'pending'`, and that the seeded ids `8/2` (placed) and `8/3` (unplaced) exist. None of this
  has been executed.
- [x] 2 POST as Admin creates `owner: null`; Manager/User refused 422 `not_allowed`; body with `ownerId` is 400 — evidence:
  `src/server/devices/devices.test.ts` › "Admin: insert has no owner, seat or role column and no member lookup; audit has
  ownerId null" and "User and Manager -> 422 not_allowed with no query at all" (pass). `devices-routes.test.ts` ›
  `ownerId` → 400 (`:153-155`, pass). `device.test.ts` › "rejects … ownerId as an unknown key" (pass). Code:
  `src/server/devices/devices.ts:313-314` checks before any query (R7). The DB-level variant in `devices.db.test.ts` is
  unexecuted (Issue 1).
- [ ] 3 Placing an unowned device is refused by the API (422 `device_unowned`) and by the DB check — PARTIAL. API rule:
  `rules.test.ts` › "any seat target … -> 422 device_unowned" (pass), `pg-error.test.ts` mapping (pass), `inTx` 422 mapping
  at `devices.ts:54`. The DB check half (`devices.db.test.ts` › "placing an unowned device …" and schema:check › "10
  unowned device at a seat refused") has not run. See Issue 1.
- [ ] 4 List (all + `unowned` filter), detail, search and CSV export return unowned devices with null/empty owner — NOT MET
  (no evidence). The code is correct by review: left joins at `devices.ts:118`, `search.ts:119`, `export.ts:70`, null-safe
  `toDto`/search map. Its only tests are `devices.db.test.ts:100`, `search.db.test.ts:123` and `export.db.test.ts:65`,
  all unexecuted. See Issue 1.
- [x] 4b Seat detail and room layout handle a null owner type-safely — evidence: `seats.ts:122-125` (left join, `case when
  m.id is null then null`), `SeatDetailPanel.tsx:30` guard, `pnpm typecheck` green. Backed by the AC 3 CHECK (unexecuted).
- [ ] 5 Delete: owned → 409 `device_owned`, pending handoff → 409 `handoff_pending`, non-Admin 422, unowned unplaced works and
  cascades non-pending handoffs — PARTIAL. `rules.test.ts` › decideDelete order (pass) and `devices.test.ts` › "not_allowed is
  decided first; then device_owned, device_placed, handoff_pending; refusals write nothing" / "Admin deletes an unowned
  unplaced device: locked read, pending check, delete, audit" (pass). The DB matrix (`devices.db.test.ts:443`) and the
  schema:check cascade (`schema-check.mjs:745`) have not run. See Issue 1.
- [x] 6 UI: "New device" only for Admins, no owner picker, "Org inventory" label and filter — evidence: `DevicesView.test.tsx`
  › "New device button when onNew is given", "unowned row shows Org inventory and no Place/Delete for a non-Admin";
  `DeviceFormDialog.test.tsx` › "create has no owner fields", "edit of an unowned device shows Org inventory";
  `devices-state.test.ts` › "filterOptions: order all, placed, inventory, unowned (Org inventory)"; `device-actions.test.ts` ›
  "Delete only when canDelete and onDelete" (all pass). `DevicesPage.tsx:54` passes `onNew` only when `isAdmin`. The manual
  local run (create as Admin, see it under Org inventory) was not done because there is no DB.

Ming verification after merge: none listed in the plan.

### Issues
#### Issue 1 — 🔴 blocker — evidence missing for every DB-level criterion
- **Where**: `db/migrations/20261125120000_device_lifecycle.sql`, `scripts/schema-check.mjs:75-87, :575-753`,
  `src/server/devices/devices.db.test.ts`, `src/server/search/search.db.test.ts:123`, `src/server/export/export.db.test.ts:65`,
  `db/seeder.js:136`; impl-log "Checks" says these were NOT RUN.
- **Expected**: AC 1, the DB half of AC 3, AC 4 and the DB half of AC 5 have executed evidence. That means the migration
  applies on a DB with existing devices, `migrate-smoke`, `schema:check` (section 10 all `pass`, "5 seed is idempotent"
  with the new unowned seed device) and `pnpm test:db` are green. R5 says no PASS without green checks, and `test:db` is a
  listed check.
- **Actual**: none of them has run anywhere. No CI run exists for `ticket/SIM-037.1` because `ci.yml` triggers only on a PR
  to `main` or a push to `main`. Plan verification for AC 1 explicitly requires `pnpm schema:check` and `pnpm migrate` +
  `pnpm seed:dev`.
- **Fix instruction**: no code change is known to be needed. Get a real Postgres 17 run in one of two ways. (a) The
  orchestrator opens a **draft** PR `ticket/SIM-037.1` → `main` so `ci.yml` runs `migrate-smoke`, `schema-check.mjs` and
  `pnpm test:db` against its postgres:17 service. (b) Run on a machine with Docker:
  `docker compose -f compose.dev.yml up -d`, `pnpm migrate`, `pnpm seed:dev` twice, `pnpm schema:check`, `pnpm test:db`. Add
  to impl-log (new attempt): the CI run URL or the command, plus the summary lines (the schema-check `FAIL:`/`pass:` count
  for section 10 and the "5 seed is idempotent" line, and the test:db "Test Files / Tests" lines). Fix any failure inside
  the plan's files. Then re-submit for review.

#### Issue 2 — 🟡 should-fix — planned UI test not written
- **Where**: `src/ui/search/SearchView.test.tsx` (unchanged in the diff). Plan, "Tests to write" last row: `SearchView
  "unowned hit shows Org inventory"`.
- **Expected**: a test that renders a device hit with `owner: null` and asserts the "Org inventory" text
  (`devicesCopy.orgInventory`) from `SearchView.tsx:54`.
- **Actual**: the null-owner branch in `SearchView.tsx:54` has no test. `DeviceTable` has one, SearchView does not.
- **Fix instruction**: add `it("device row with no owner shows Org inventory", …)` next to the existing device-row test at
  `SearchView.test.tsx:104`, using the same fixture with `owner: null`.

### Rules (CLAUDE.md)
No violations found.
- R1: `check:layers` clean. Lib holds the pure rules/types and `src/server` holds the SQL.
- R2: one new forward-only expand migration and no applied migration is edited. The previous image keeps working: it
  always writes an owner and ignores the new columns.
- R6: every new query/join keeps `org_id`. `device_handoffs` has `org_id not null` and composite org FKs. Its unique
  indexes lead with `org_id`.
- R7: non-Admin create is a 422 before any query. Delete refusals happen after a locked read, before the delete. No
  401/403 comes from a service.
- R3: no config.
- R4: every changed file is in the plan's file/test list. `work/ming-todo.md` holds the M-51 approval entry.
- R5: blocked only by Issue 1.

### Blockers from review agents
None 🔴 (security-review.md, Attempt 1). Should-fix 🟡 carried into the rework: add to the plan's Downgrade note and to the `db/migrations/README.md` schema section that rolling back the image after unowned devices exist re-opens the previous image's null-owner edit/delete hole (origin/main `devices.ts` ~:380, ~:432) for callers without a member row; fix forward instead of rolling back. Optional 💭: early `tier !== "admin"` 422 in `deleteDevice` before `inTx` (avoid a row lock for refused callers).

### Nits (do not block)
- `src/lib/devices/rules.test.ts:53` and `:81`: `here` is unused input. `expect(here.current.seatId).toBe(A)` asserts a
  constant, not behaviour. Drop both lines.
- `scripts/schema-check.mjs` section 10 has no accept-cases for valid data: an owned device with valid
  serial/manufacturer/brand/holding note and expiry, and a valid transfer and extension handoff. Right now only rejections
  and "same serial in another org" are positive cases. With a typo in a CHECK, everything would be refused and the
  section would still pass.
- `src/server/devices/devices.ts:89`: the `owner_name!` non-null assertion relies on the FK. That is fine, but a short
  comment would help.

### Follow-ups (out of scope)
- `scripts/dev-process.test.ts:245` is flaky under full-suite load (passes alone 21/21, untouched by this diff). Open a
  `debt` issue (`project:simap`) to make it load-tolerant or move it out of the default `pnpm test` run.
- From impl-log: the unreachable "move to inventory first" branch in `DeleteDeviceDialog.tsx` / `delete-device-flow.ts`,
  the "Inventory" vs "Org inventory" label overlap (A4), and the new columns not yet in the DTO (A9). All belong to
  SIM-037.2.
