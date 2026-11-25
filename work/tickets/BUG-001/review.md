## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — ok.
- `pnpm typecheck && pnpm check:layers` — ok.
- `pnpm test` — 252 files passed | 1 skipped; 2477 tests passed | 7 skipped.
- `pnpm build` — exit 0.
- `pnpm test:db` (DATABASE_URL=postgres://simap:simap@127.0.0.1:5432/simap, local) — Test Files 15 passed (15), Tests 190 passed (190).

### Before-fix evidence (independent)
impl-log.md records the before run (3 failed, 187 passed). I reproduced it: I took a copy of the branch HEAD in the scratchpad, put the two origin/main test files back, and ran `pnpm test:db`. Result: 2 files failed, 3 tests failed, 187 passed. The failures are the 3 named tests: the devices.db uniqueness test, the export.db "two orgs: each export lists only its own rows" test, and the export.db "an unowned device row has empty Owner name ..." test. After the fix all 190 pass.

### Product code verification (independent)
- `src/server/export/export.ts:54-68, 69-93`: the columns are Name(0) ... Brand(6), Role(7), Owner name(8), Owner employee code(9), Location(10), Room code(11), Seat code(12). `map` matches `columns`. The SQL joins the owner via `d.owner_id`, so the export is correct and only the tests read old indices.
- `src/lib/devices/rules.ts:9`: `canEdit = isOwner || tier === "admin"` (D19).
- `src/server/devices/devices.ts:398-399`: the permission check runs right after the row lock and before the uniqueness work. A "user" on an unowned, Admin-created device (D63) gets 422 `not_allowed`, as specified. The test needed an Admin tier. The code is correct.

### Acceptance criteria
- [x] Regression: the 3 named tests fail before the fix and pass after — evidence: my run against the old test files (3 failed) and the current run (190 passed); impl-log "Before the fix".
- [x] Export DB test asserts owner name, owner code, location, room code by column name — evidence: `colIndex(columns, name)` helper (throws if missing) in `export.db.test.ts`. No numeric index remains for devices rows. Seat code is also asserted.
- [x] Uniqueness test reaches the check with an allowed tier and still proves 409 `inventory_number_taken` / `mac_taken` — evidence: `devices.db.test.ts:522,525` use "admin", and the test still asserts both 409 codes plus `kept.inventory_number === "INV-2"`.
- [x] All checks pass including `pnpm test:db` locally — evidence: the Checks section above.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R4: the diff touches only the two planned test files plus the BUG-001 work files and the backlog row. No product code and no High path. R5: the checks are green and `test:db` was run.

### Blockers from review agents
None. `security-review.md` Attempt 1 has no 🔴 and no 🟡 (two 💭 follow-ups: an unowned-device edit refusal test; a symmetric devices-export isolation check).

### Ming verification after merge
Confirm the `ci` job (step `db integration tests`) is green on the PR/main. Then release 0.1.8 handling (the held deployment PR `release/simap-v0.1.8`) is Ming's step.

### Nits (do not block)
- The plan said Room code `R-a-01`. impl-log correctly notes that the room code is `R-a` and `R-a-01` is the seat code.

### Follow-ups (out of scope)
- SIM-037.2 was merged with a red `ci` check and without `test:db`. Consider a branch-protection or merge-gate follow-up so `ci` must be green to merge.
