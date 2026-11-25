## Attempt 1 — 2026-11-25
Verdict: PASS

Scope: slice 1 only (API, data, SIM-037.1 carry-overs), as approved with A1-A11; UI is SIM-037.7.
PASS assumes `pnpm test:db` goes green in CI on the PR. This machine has no Docker/Postgres, so the DB integration
tests below were read, not run. Ming merges only after CI.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (690 files).
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "check-layers: 636 files, no violations".
- `pnpm test` — exit 0, "Test Files 242 passed | 1 skipped (243); Tests 2400 passed | 9 skipped (2409)". The full
  run was clean, including `routes-guarded.test.ts` and `scripts/dev-process.test.ts`, so no separate re-run was needed.
- `pnpm build` — exit 0.
- `pnpm test:db` — NOT run (no Postgres here). **Pending CI.** These results match impl-log Attempt 1.

### Acceptance criteria
- [x] 1. Admin/Manager assign, User refused, owned device refused. Evidence: `src/lib/devices/rules.test.ts › canAssign /
  canManageHolding` (pass); `src/server/devices/devices.test.ts › assignDevice › a User is refused 422 not_allowed
  before any query`, `› lock order …`, `› refusals write nothing and roll back` (pass);
  `devices-routes.test.ts › assignment and holding routes` (pass). DB evidence in `devices.db.test.ts › admin and
  manager assign …`, `› a user is refused 422 … owned device is 409 device_owned`, `› two concurrent assigns: exactly
  one succeeds …` (read; **pending CI**). Code: `src/server/devices/devices.ts:431-485` checks permission before
  `inTx` (R7), locks the member `for share` and then the device `for update` (the same order as `deactivateMember`),
  and re-reads `owner_id` under the lock, so the race test is correct under read committed.
- [x] 2. After assign: owner set, not placed, note/expiry carried, empty expiry = null. Evidence: `devices.db.test.ts ›
  admin and manager assign` (owner, `seat_id null`, role unchanged, `holding`), `› expiry round-trips as YYYY-MM-DD`
  (read; **pending CI**). `to_char(...,'YYYY-MM-DD')` at `devices.ts:137` and `:513` avoids the pg local-TZ
  Date shift. The UI display is slice 2 (SIM-037.7).
- [x] 3. Past expiry and a note over 500 characters are refused. Evidence: `src/lib/devices/holding.test.ts › todayUtc7
  rolls over at 17:00 UTC`, `› parseCalendarDay` (pass); `src/lib/validate/device.test.ts › validateAssign …
  note: 500 ok, 501 refused …`, `› expiry: today allowed, yesterday and impossible dates refused`,
  `validateHoldingPatch › past expiry refused, null clears` (pass). Route: the system time is fixed at
  `2026-11-25T17:30:00Z`, so today in UTC+7 is 11-26, and `2026-11-25` returns 400 on both routes (pass).
- [x] 4. Serial (unique per org), manufacturer and brand in create/edit/list/search/CSV. Evidence:
  `device.test.ts › create: missing and blank become null, values are trimmed and NFC`, `› limit 100, control chars …`,
  `› patch: a lone null is a valid patch` (pass); `pg-error.test.ts` serial_taken (pass);
  `devices.test.ts › updateDevice with serial, manufacturer and brand` (pass); `export.test.ts` columns 3-6 =
  MAC, Serial, Manufacturer, Brand, row aligned, null cell (pass). DB evidence in `devices.db.test.ts › create and
  patch store them …` (duplicate → 409 `serial_taken`, cross-org ok, null serials ok, list DTO) and
  `search.db.test.ts › finds a device by serial, manufacturer and brand (case and diacritics folded)` (read;
  **pending CI**). Showing them in the Devices table and form is slice 2.
- [x] 5. One audit row per assign and per holding edit. Evidence: `devices.test.ts › updateHolding › unchanged -> no
  update and no audit`, `› a note-only change sets holding_note only, with from/to in the audit` (pass). DB evidence in
  `devices.db.test.ts` (2 assigns → 2 `device.assign` rows with meta; a refused assign or a race loser writes no row;
  one `device.holding_update` row with `from`/`to`, and a repeat no-op adds none) (read; **pending CI**).
- [x] 6. The filter reads "Not placed". Evidence: `src/ui/copy/devices.ts:7`, `devices-state.test.ts` (pass).
- [x] 7. The dead "move to inventory first" flow is gone. Evidence: `delete-device-flow.ts` is now only `settleDelete`;
  `DeleteDeviceDialog.test.tsx › renders the confirm body only` (pass);
  `grep -rn "moveBody|settleMove|afterRefetch|placedBody|DeleteStep" src/ui src/app` finds only the unrelated
  `removeBody` in seats.
- [x] 8. Checks green locally (above). `pnpm test:db` is **pending CI**.

Ming verification after merge: none for slice 1 (per plan). "Manual: assign with and without expiry" moves to SIM-037.7.

### Issues
None.

### Scope
Every changed file is in the plan's list or justified under impl-log `Out-of-plan files` (`devices-api.test.ts`
fixture, and the `device-form.test.ts` expectation, which typecheck and the validator force). The
`work/ming-todo.md` M-53 line is the plan-approval record. No High path changed (no migration, nothing under
`src/server/http/**`, config, Docker or deploy).

### Rules (CLAUDE.md)
No violations found.
- R1: the new routes are the only importers of `assignDevice`/`updateHolding`. `holding.ts` and the validators are
  pure lib code. `check:layers` is clean.
- R2: no schema change.
- R6: every new query goes through `orgQuery` with `org_id = $1`, and the target member is resolved by
  `(org_id, id)`. The DB test checks that another org's member is refused.
- R7: permission refusals are 422 before any query, domain refusals are 409/422, and no 401/403 is returned after a
  write.
- R3: no new env.
- R5: new logic has unit tests, and the DB tests are written.

### Blockers from review agents
None from this reviewer. security-review.md (Attempt 1): no 🔴. 🟡 1 audit meta holds the free-text note (scope requires it; `src/server/audit/write.ts:6` docstring to update) and 🟡 2 holding note visible to every org member — both for Ming's decision, listed in the PR.

### Nits (do not block)
- `src/ui/devices/DeleteDeviceDialog.tsx:54`: after a stale refusal (`device_owned`/`handoff_pending`) the dialog
  stays open and Delete stays enabled, so a re-submit repeats the same refusal. Consider disabling submit or closing
  the dialog in SIM-037.7.
- `updateHolding`'s audit `to` holds both fields (the unchanged one too). That is fine, but `fields` is the only exact
  record of what changed.

### Follow-ups (out of scope)
- A8 debt issue is **not filed yet** (the implementer had no `gh`). The orchestrator files it in the workspace repo
  with labels `debt` and `project:simap`: deactivating a member counts only placed devices
  (`src/server/members/manage.ts` line 298), so a deactivated member can keep unplaced devices. SIM-037.4 decides.
- A9: `docs/spec-v1.md` DEV-01 lines 279-281 still describe the "Move to inventory" delete warning. A docs update is
  needed.
- SIM-037.3 (transfer): when the owner changes, decide whether `holding_note`/`holding_expires_on` reset or carry over.
  No current path changes `owner_id` apart from assign.
