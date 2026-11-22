## Attempt 1 — 2026-11-22
Verdict: REWORK

Reviewed at `5e375ed`, Slice 1 only (ACs 1, 5a, 6a, S1; D59). ACs 2, 3, 4, 5b and 6b belong to SIM-015.4 and SIM-015.5 and
were not judged. The migration and validator are sound. The one blocker is a false count in `impl-log.md`.

### Checks (run by reviewer)
Local Docker Postgres only (`simap-game-ui-db-1`, `127.0.0.1:5432`), `DATABASE_URL=postgres://simap@127.0.0.1:5432/simap` in the command environment.
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "352 files, no violations"
- `pnpm test` — exit 0, 143 files passed; Tests 1501 passed, 3 skipped (1504)
- `pnpm build` — exit 0
- schema check — exit 0, 42 pass, 0 FAIL, "schema check ok"; **16** section 8 checks (impl-log says 17, Issue 1)
- DB integration — exit 0, Test Files 5 passed (5); Tests 52 passed (52); no throwaway database left behind
- The two DB checks ran as `node scripts/schema-check.mjs` and `node scripts/test-db.mjs`: the same scripts as the `pnpm` commands, without their `--env-file-if-exists=.env.local` flag, so that file was not loaded.

Extra reviewer checks:
- Trial of the migration on the seeded local `simap` database inside `begin ... rollback`: row counts unchanged (4 rooms, 12 seats, 12 fixtures), all seats unplaced, 12 legacy fixtures kept, 4 rooms unsaved, no unvalidated constraint, an old-shape seat update and fixture insert worked. After rollback the new columns are absent.
- Scratch comparison of validator and renderer over every registry sprite and all 4 rotations (outside the repo): 0 footprint mismatches, 0 registry/manifest `tiles` drift, 0 partial direction sets, 0 base keys that are also plain keys; desk footprint and chair tile agree with `buildDrawList` at all 4 rotations.

### Acceptance criteria
- [x] AC1 The migration is forward-only, and the previous image keeps working — evidence: one added file `db/migrations/20261122120000_room_tile_layout.sql`, no applied migration edited; new columns nullable or constant-default; no positional insert on the three tables and no non-test `select *`; no diff in `src/server`, `src/app/api`, `db/seeder.js` or `db/migrator.js`, so the 52 DB tests run the current services on the new schema; schema check `8 old-shape room, seat and fixture inserts still work` passes; rolled-back trial on seeded data passes.
- [x] AC5a Out-of-bounds, overlapping, wrongly rotated or unknown-sprite payload refused (validator part) — evidence: `src/lib/validate/layout.test.ts` groups `shape`, `sprites`, `rotation`, `footprint`, `bounds`, `overlap`, `chair`, all plan rows present and passing.
- [x] AC6a Unit tests cover the payload validation — evidence: `pnpm test` green; the 3 targeted files pass 33 tests.
- [x] S1 The validator agrees with the renderer — evidence: `fixture.test.ts › DEMO_LAYOUT passes the layout rules`, `committed-atlas.test.ts › committed manifest blocks equal the registry`, `validateSpriteManifest` pins `tiles` to the registry (`src/lib/validate/sprite-manifest.ts:76-80`), and the scratch comparison above.
- Ming verification after merge: none (plan:79-81).

### Issues
#### Issue 1 — 🔴 blocker — impl-log does not match the real run
- **Where**: `work/tickets/SIM-015.1/impl-log.md:23`
- **Expected**: the recorded number of section 8 schema checks equals the real output.
- **Actual**: impl-log says "section 8 (17 checks)". `scripts/schema-check.mjs` defines 16 and the run prints 16 `pass: 8 ` lines. The reviewer rules make a mismatch between impl-log and the reviewer's run a blocker.
- **Fix instruction**: do Issue 2, re-run the schema check, count with `grep -c '^pass: 8 '` on its output, and record that real number in a new `## Attempt 2` section of `impl-log.md`. Do not edit the Attempt 1 section.

#### Issue 2 — 🟡 should-fix — one new constraint has no check
- **Where**: `scripts/schema-check.mjs`, after the `8 fixture negative tile refused` check that starts at line 371, before line 379; the constraint is at `db/migrations/20261122120000_room_tile_layout.sql:35`.
- **Expected**: `layout_fixtures_sprite_key_check` is exercised, as its seat counterpart is (`8 seat blank sprite key refused`).
- **Actual**: no check names `layout_fixtures_sprite_key_check`.
- **Fix instruction**: add this check, then run the formatter on the file:
  ```js
  check(
    "8 fixture blank sprite key refused (23514)",
    refused(
      await tx(insFixture("null", seatTile, ", 1, 2, 0, '  '")),
      "23514",
      "layout_fixtures_sprite_key_check",
    ),
  );
  ```
  Section 8 should then print 17 checks. Do not change the migration.

### Rules (CLAUDE.md)
No violations found in code. R1 (`check:layers` green, validator is pure `src/lib`), R2 (one forward-only expand migration), R3 (no config or secrets), R4 (all changed code files are in the plan's list; the other changes are ticket work files), R6 (no new table, `org_id` and composite FKs unchanged), R7 (validator returns only 400/422 codes, no route ships). R5 waits on Issue 1.

### Blockers from review agents
Left for the orchestrator to copy from `security-review.md`. That file appeared untracked during this review and was not assessed here.

### Nits (do not block)
- `validateLayoutSave` accepts `-0` for `x`, `y` and `rotation` (`JSON.parse("-0")`). It behaves as 0 in every rule and serializes as `0`, so it is harmless.

### Follow-ups (out of scope)
- Plan A13: the registry has no `pillar` sprite, and `label.sign` carries no text.
- SIM-015.2's ticket text still describes the old free-form editor and should be re-scoped before planning.
- The local dev `simap` database does not have this migration applied; run `pnpm migrate` locally before working on SIM-015.4.
