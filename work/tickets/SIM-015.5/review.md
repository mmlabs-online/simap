## Attempt 1 — 2026-11-23
Verdict: PASS

Reviewed `ticket/SIM-015.5` at `9b8f054` (implementation commit `9425d46`).

**This PASS is conditional on the PR's CI.** This machine has no docker, so the 13 tests in
`layout.db.test.ts › saveRoomLayout (db)` and every new SQL statement have **never been executed**. The SQL below was
only read against the schema. The ticket is not ready to merge until the `ci` job's `db integration tests` step is green
on the PR (`plan.md:53-54`). A failure there returns the ticket to REWORK. `ci.yml` runs on a PR to `main`, not on a push
to this branch, so the PR must exist first.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "372 files, no violations".
- `pnpm test` — exit 0, Test Files 151 passed (151); Tests 1613 passed | 8 skipped (1621). Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm test:db` — **NOT RUN** (no docker). Pending the PR's CI `db integration tests` step.
- Environment: local checks ran on Node v24.20.0 (the repo wants 22, pnpm warns). CI runs Node 22.

### Acceptance criteria
`[x]` = verified here. `[ ]` PENDING CI = depends on SQL or DB tests that have not run; not verified.

- [x] **AC 1a** PUT is Admin-only — evidence: `route.ts:41` `tier: "admin"`; `route.test.ts › PUT › user and manager get 403, service not called`, `› no Authorization gives 401`; `routes-guarded.test.ts › every real route.ts except healthz/readyz is guarded`: pass.
- [ ] **AC 1b** A valid layout survives a reload — **PENDING CI**: `valid save survives a fresh GET`, `saved default layout from GET passes unchanged`. Partial evidence only: a one-off script ran that test's payload through the real `validateLayoutSave` and `resolveLayout`, and all seats, the fixture and the floor were kept.
- [x] **AC 2 (payload part)** A refused payload saves nothing — evidence: `route.test.ts › PUT › bad JSON, wrong content type and a body over 262,144 bytes give 400`, `› validator invalid_request gives 400 and a rule code gives 422; service not called`: pass.
- [ ] **AC 2 (seat part)** A seat from another room or org saves nothing — **PENDING CI**: `seat from another room in the same org…`, `foreign-org seat id changes neither org`.
- [ ] **AC 3** Stale `baseVersion` gives 409 and only one of two concurrent saves succeeds — **PENDING CI**: `stale baseVersion gives 409 and changes nothing`, `two concurrent saves: one 200, one layout_stale`. The unit test `stale version rolls back before the seat lock` passes with a fake client, but it cannot show real lock behavior.
- [ ] **AC 4** A changed seat set gives 409 `layout_seats_changed`, same answer for a foreign id — **PENDING CI** for the real database: `missing, extra and foreign id all give the identical refusal and change nothing`. The comparison logic is verified locally by `save.test.ts › set comparison: missing, extra and unknown id give the same refusal and no write`.
- [ ] **AC 5** A save never changes occupants, status, `seat_counter`, devices or legacy fixtures — **PENDING CI**: `leaves occupants, cannot_seat, seat_counter, devices and legacy fixtures unchanged`. By reading: the seat UPDATE sets only the tile columns and `updated_at` (`save.ts:77`), and the delete is limited to `sprite_key is not null` (`save.ts:94`).
- [x] **AC 6** Auth codes come only from the wrapper; domain refusals are 409 or 422 (R7) — evidence: `SaveRefusal` is typed `404 | 409 | 422` (`save.ts:9-12`); no 401/403 in `save.ts` or the PUT body; `route.test.ts › PUT › maps each refusal: 404, 409 stale, 409 seats changed, 422 too many seats`: pass.
- [ ] **AC 7** DB integration tests cover rollback, org scoping, stale and concurrent saves — **PENDING CI**. The 13 tests exist and were read, and they target these cases. Whether they pass is unknown.

**Ming verification after merge:** none (`plan.md:69`). Ming reviews and merges the PR after the CI DB step is green.

### SQL read against the schema (not executed)
Read against `20261120150000_init.sql` and `20261122120000_room_tile_layout.sql`. No defect found; this does not replace the CI run.

- **Columns and types:** `tile_x`, `tile_y` int; `tile_rotation` smallint; `sprite_key` text; `grid_w`, `grid_h`, `layout_version` int; `floor_zones` jsonb. The casts at `save.ts:78,105,120` match. Parameter numbering is correct in all statements, with `scope.orgId` bound as `$1`.
- **Fixture INSERT:** the legacy `x`, `y`, `rotation` columns have defaults, `kind = null` is allowed once `sprite_key` is set, and the four tile columns are all set together, so the new check constraints hold. The text satisfies the `orgQuery` guard.
- **Org scoping (R6):** every statement filters `org_id = $1`; the seat UPDATE keeps both `s.org_id` and `s.room_id` (`save.ts:79`).
- **Concurrency:** the pool sets no isolation level, so the save runs at `read committed`. A save blocked on the room's `for update` re-reads the winner's committed `layout_version` and gets `layout_stale`. It does not get a serialization error.
- **Lock order:** room, then seats by ascending id, matching `rooms.ts:213-224`. Seat and member flows take the room first, so I found no deadlock path.
- **Triggers:** `seats_primary_owner_trg` fires only on `update of occupant_id`, which the save does not set. `audit_log` receives an INSERT only.
- **Test harness:** `recording` runs its hook after the statement resolves, so save A really holds the room lock while B starts. The pool's `max: 5` covers A, B and the poller.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1 (`check:layers` clean, `save.ts` starts with `import "server-only"`), R2 (no migration), R3 (no new config), R4 (every changed source file is in the plan's list; no High path changed), R5 (new logic has tests; the DB part is pending CI), R6 and R7 as above.

### Blockers from review agents
Not assessed in this review. `security-review.md` is produced by a separate agent; the orchestrator must copy any blocker here.

### Nits (do not block)
- `layout.db.test.ts › saved default layout from GET passes unchanged` calls `saveRoomLayout` directly, so it never runs `validateLayoutSave`, and its name claims more than it checks. A one-off script confirmed that default layouts for 0 to 500 seats (12 sizes) pass the real validator. A later test could call the validator on the GET output.

### Follow-ups (out of scope)
- Record as `debt` for SIM-015.2: fixture ids change on every save, so the paint order of two non-blocking fixtures on one tile may flip (plan assumption 1).
- `src/ui/copy/audit.ts` has no label for `room.layout_save`, so the audit screen shows the raw code.
