## Attempt 1 — 2026-11-26
Verdict: REWORK

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (871 files)
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 816 files, no violations"
- `pnpm test` — exit 0; Test Files 311 passed | 1 skipped (312); Tests 3155 passed | 9 skipped (3164)
- `pnpm build` — exit 0
- `pnpm test:db` (local Postgres) — **exit 1** on the first full run: Test Files 1 failed | 19 passed; Tests 1 failed | 299 passed.
  Failing: `src/server/layout/layout.db.test.ts > saveRoomLayout (db) > a SIM-042 item saves rotated and reads back`.
  Re-running `layout.db.test.ts` three more times: fail, fail, pass. The test is order-dependent (flaky), see Issue 1.
  impl-log reports "Tests 300 passed"; that was a lucky run, not a stable green.
- `pnpm migrate:smoke` — exit 0, "migrate smoke ok"
- `pnpm schema:check` — exit 0, "schema check ok"; includes "1 stage 2 org was seeded with 53 map items",
  "11 orgs seeded before SIM-042 get 59 map items", "11 org created after the migration gets 59 map items on first member",
  "11 SIM-042 backfill: a renamed 'Clock Wall' row makes the new row 'clock wall (built-in)'",
  "11 SIM-042 backfill leaves existing rows unchanged", "11 SIM-042 backfill does not restore a row deleted before it".

### Acceptance criteria
- [x] Each new key is in the registry, the sprite map (rect, anchor, tiles) and the committed atlas as a `map` source —
  evidence: `src/lib/sprites/keys.json` diff is additions only (24 keys, no `-` lines); `library.test.ts › SIM-042 library
  keys` passes; registry / committed-atlas tests green in `pnpm test`; a reviewer script compared all 24 `sprite-map.json`
  rects and anchors with `assets/art/sources/imersa-office/props_*.json`: all match, and pack footprints equal the `tiles`
  (screen n/s 2x1, e/w 1x2). Viewed `public/sprites/office.png`: real Imersa art for cooler, flip chart, screen, clock,
  bin and lamp is in the atlas.
- [x] Every existing and every new org has one row per new key (name, group, footprint), no existing row changes;
  `migrate:smoke`, `schema:check` pass — evidence: schema-check section 11 lines above; `sql-sync.test.ts` (latest seed =
  `LIBRARY_ITEMS`, backfill = `LIBRARY_ITEMS` minus first seed) green; `map-items.db.test.ts › a new org gets the SIM-042
  rows ...` passes. The `test:db` part of this criterion is not met while Issue 1 is open.
- [ ] New items appear in the palette / "Map items" page and can be placed, rotated and saved — unit side met
  (`layout.test.ts › SIM-042 built-in items`, 4 tests green; `FIXTURE_GROUPS` += bin, chart, clock, cooler, screen at
  `src/lib/validate/layout.ts:46-61`). The DB evidence `layout.db.test.ts › a SIM-042 item saves rotated and reads back`
  fails about half the time — FAILED, see Issue 1. The visual check in the editor is a Ming verification item (below).
- [x] A layout saved by the previous image still loads (expand-only) — evidence:
  `db/migrations/20261126120000_map_items_new_builtin.sql` has no `update`/`delete`/`alter`; the seed function keeps the
  same signature and the first 53 tuples unchanged (compared with `20261125200000_map_items.sql:57-117`); backfill
  conflict target is `(org_id, builtin_key)` only, so a second name clash aborts (A5); old image's `toDto`
  (`src/server/map-items/map-items.ts:40-42`) drops unknown keys; list limit 200 >= 59. Existing `layout.db.test.ts`
  tests and schema-check "backfill keeps valid placed fixtures and seats" pass.
- [ ] All Checks pass — FAILED: `pnpm test:db` is not stably green (Issue 1).

Ming verification after merge (not verified by the reviewer; carry into the PR):
- Place each of the six items in all four directions in a room on the deployed build and confirm the thin side views
  (wall clock 8x44, projector screen 10x90 / 9x90) and the short flip-chart front look right. The implementer did not
  open `/dev/roommap` or the editor (impl-log), only the packed atlas.
- After release: the "Map items" page of the production org lists the six new items (backfill ran).

### Issues
#### Issue 1 — 🔴 blocker — flaky test / checks not green
- **Where**: `src/server/layout/layout.db.test.ts:368-379` (assertion at line 378).
- **Expected**: the test passes on every run.
- **Actual**: it compares `got.layout.fixtures` to `v.fixtures` in input order, but the layout read orders fixtures by
  `id` (`src/server/layout/layout.ts:92`, `order by id`), and `layout_fixtures.id` is `gen_random_uuid()`
  (`db/migrations/20261120150000_init.sql:170`). With two fixtures the order is random: 3 failures in 4 reviewer runs
  ("expected [clock.wall, screen.projector] to deeply equal [screen.projector, clock.wall]"). In CI `test:db` would fail
  about 50% of the time.
- **Fix instruction**: make the comparison order-independent, e.g. sort both sides by `sprite` (or by `x`) before
  `toEqual`:
  `const strip = (fs) => fs.map(({ id: _i, ...f }) => f).sort((a, b) => a.sprite.localeCompare(b.sprite));`
  `expect(strip(got.layout.fixtures)).toEqual(strip(v.fixtures));` (the existing test at line 365 uses one fixture, so
  leave it). Then run `pnpm test:db -- src/server/layout/layout.db.test.ts` at least 3 times and the full `pnpm test:db`
  once, and record the real results in impl-log. Do not change the read query's ordering (out of plan).

### Scope
- All changed files are in the plan's file list, except two recorded under `Out-of-plan files`, both accepted:
  - `scripts/sprites/placeholders.mjs` — needed: `pack.test.ts` packs placeholders without the git-ignored sheets (CI)
    and the packer threw "No placeholder drawer for bin.trash.e" for the new groups. The change only adds SUB sizes,
    TALL groups and five drawers; existing drawers untouched. Justified.
  - `scripts/sprites/pack.test.ts:135` — warning count 10 -> 11 because the kitchen sheet is now referenced. Covered by
    the plan's "fix in the test only when it is a hard-coded count" allowance. Justified.
- `work/ming-todo.md` (M-86 line) is board/workflow bookkeeping, fine.
- High path changed: `db/migrations/20261126120000_map_items_new_builtin.sql`, named by the plan and approved (M-86).
  The security review trigger (`db/`, `**/*.sql`) applies; the orchestrator runs it.

### Rules (CLAUDE.md)
- R5: no PASS without green checks — `pnpm test:db` is flaky (Issue 1).
- R1, R2, R3, R4, R6, R7: no violations found. R2: new forward-only, expand-only migration, applied migration untouched.
  R6: backfill is scoped per `org_id` from `map_item_catalogs`, the name-collision subquery is filtered by the same
  `org_id`.

### Blockers from review agents
None (to be filled by the orchestrator from `security-review.md`).

### Nits (do not block)
- `src/server/map-items/sql-sync.test.ts`: the backfill file name is hard-coded; fine for now, but a later built-in
  migration will need its own backfill test rather than editing this one.
- During the rollback window an admin on the previous image who renames an item to e.g. "clock wall" gets a name
  clash with a row the old image hides. Accepted under A12-style rollback trade-offs; no action.

### Follow-ups (out of scope)
- None.
