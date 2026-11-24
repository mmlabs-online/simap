## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (479 files)
- `pnpm typecheck && pnpm check:layers`: exit 0, "check-layers: 425 files, no violations"
- `pnpm test`: exit 0, "Test Files 169 passed (169); Tests 1801 passed | 3 skipped (1804)". This matches impl-log.
- `pnpm build`: exit 0, "Compiled successfully"; `/api/requests` and `/api/requests/[id]/approve|cancel|reject` are listed.
- `pnpm test:db`: not run (no local DATABASE_URL; CI-only per loop.config.md). I read `requests.db.test.ts` line by line
  against `db/migrations/20261120150000_init.sql` and `src/test/db/fixtures.ts`. I found no defect (details below).
  **The CI `pnpm test:db` run on the PR must be green before merge.**

### Acceptance criteria
- [x] AC1: a second pending request for the same seat and member creates nothing. Evidence:
  `requests.ts:125-150` (`on conflict (org_id, seat_id, subject_id) where status = 'pending' do nothing`) matches
  the partial index `seat_requests_one_pending_idx` (init.sql:163). DB tests "duplicate create returns the existing
  pending request, one row, one audit row" and "two concurrent creates ... leave one pending row". Route test
  "create: created -> 201, duplicate -> 200 with the same body" passed.
- [x] AC2: approving seats the requester, demotes any primary and rejects the other pending requests. Evidence:
  `requests.ts:196-235` (`writeOccupant`, then approve, then a one-statement rival reject, then audits). DB tests
  "two rivals: occupant set, primary demoted, ..." (it also checks that the other seat's request stays pending),
  "inherits the subject's group (D32)", "concurrent approve of two rivals".
- [x] AC3: requests for occupied or cannot-seat seats are refused. Evidence: `rules.ts` `decideCreate` /
  `decideApprove` with the `rules.test.ts` tables (passed). DB tests "occupied (also by the caller) -> 409 seat_taken;
  cannot-seat -> 409 seat_cannot_seat; nothing inserted" and "seat taken directly or flagged cannot-seat after the
  request: 409, request and rivals stay pending, no audit".
- [x] AC4: the requester can cancel only their own pending request. Evidence: `lockRequest(..., me.id)` filters by
  `subject_id` (`requests.ts:285`). DB tests "another member, a caller without a member row, or another org -> 404,
  row unchanged", "owner cancels pending", "cancel of a non-pending request -> ok, unchanged, no audit". The route
  test shows tier `user` reaches the cancel service.
- [x] AC5: unit tests cover the state machine. Evidence: `src/lib/requests/rules.test.ts` (nextStatus, decideCreate,
  decideApprove, decideCancel) passed in `pnpm test`.
- Ming verification after merge: none for this slice (per plan).

### DB test read-through (not run locally)
- Fixtures: `addMember` inserts `sub` as a uuid, and `subOf` reads it back. `members.sub` and `audit_log.actor_sub`
  are uuid, so `sub = $2::uuid` in `lockMembers` is valid. `addPendingRequest` sets `created_by_id = subject_id`,
  which satisfies the FKs.
- Manual status flips (`set status = ..., decided_at = now()`) satisfy `seat_requests_decided_check`. The service
  sets `decided_at = now()` on every non-pending transition, including auto-rejected rivals and cancel.
- Every `orgQuery` SQL contains `org_id = $1`, and the parameters shift correctly (`org-scope.ts:24`).
  `id = any($3::uuid[])` with `[]` and `$2::uuid` with null are both valid.
- Concurrency: create serializes on the seat `for update` row lock, so the second create waits, hits the conflict
  and selects the existing row. In approve vs approve, the second call waits on the seat lock; in READ COMMITTED,
  `for update` returns the committed row, so `lockRequest` sees `rejected` and `decideApprove` returns noop first.
  The result is ok and there is one `seat.assign`. Approve vs cancel: cancel takes only the member share lock and the
  request row lock, so there is no lock cycle with approve (members -> room -> seat -> request). Both outcomes match
  the test's branches. Rival auto-reject vs a concurrent reject or cancel of a rival: there is no cycle either.
- "two rivals" test: a device owned by `b` sits on the empty seat1 as primary. No schema constraint ties the device
  owner to the occupant, and `demotePrimary` turns it secondary. The audit counts (1 `seat.assign`,
  1 `request.approve`, 2 `request.reject`) match `requests.ts:196-235`.
- "decided request" test: approve returns before taking any lock, and reject returns noop via `nextStatus`. Both
  return `loadRequest` with the unchanged status, and no audit row is written. `toEqual(before)` compares the Date
  objects correctly.

### setOccupant -> writeOccupant extraction
I compared it to `origin/main`. The behaviour is the same:
- The statements run in the same order (demote, `update seats`, `writeAudit`) inside the same transaction, after the
  same locks.
- `seatId` became `seat.id`. These are equal because `lockSeatIn` selects the seat by `id = seatId`.
- `groupId` is still computed before the write. It is pure (`inheritedGroup`), so moving it before `demotePrimary`
  has no effect.
- The action mapping is unchanged. The meta keys and values are the same (`code`, `memberId`, `previousOccupantId`,
  `demoted`, `groupInherited`). The default `extraMeta = {}` adds no keys.
- The only other changes are `export` additions (`inTx`, `refuse`, `SeatLock`, `lockSeatIn`) and two more
  `Refusal.code` values. `seats.test.ts` and `seats.db.test.ts` are unchanged; the unit tests pass, and the DB suite
  will confirm in CI.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: check:layers is clean; `requests.ts` starts with `import "server-only"`.
- R2: no migration.
- R6: every query goes through `orgQuery`, and every join repeats `org_id`.
- R7: handlers return 401/403 only via `withAuth`; domain refusals are 404/409/422 and roll back via `inTx`.
- R3: no config.
- R4: scope matches the plan file list; the `work/` files are workflow; the `notFound` export was dropped and this
  is logged.
- R5: checks are green and the new logic has tests.
- No High path is changed.

### Blockers from review agents
None. The orchestrator should run the `security-ai-generated-code-auditor` trigger (`src/server/` changed) if it has
not already.

### Nits (do not block)
- `requests.ts:258-263` and `:297-302`: reject and cancel run an extra `select code from seats` for the audit meta.
  `loadRequest` already joins the seat, so this could be folded in. Harmless.
- The audit meta shape differs between actions: `request.create` has `{seat, room}`, while `request.approve`,
  `request.reject` and `request.cancel` have no `room`. Consider aligning it when the read API (SIM-014.1) shows
  history.
- `src/lib/validate/request.ts` duplicates `isPlainObject` from `validate/seat.ts`. A shared helper would be a small
  cleanup later.

### Follow-ups (out of scope)
- As planned: auto-reject pending requests when a seat is assigned directly, released, or flagged cannot-seat; add a
  pending-request marker on seat DTOs (LAY-06).
- Confirm the first CI `pnpm test:db` run on this branch before merge.

## Attempt 2
Verdict: PASS

### Checks (run by reviewer)
- format:check ok, typecheck ok, check:layers 425 files no violations, test ok (169 files).
- CI run 45324683430 on PR #58: ci and image jobs green; `pnpm test:db` 7 files / 95 tests passed, `requests.db.test.ts` 18/18.

### Fix review
- `requests.ts:125-131`: the insert now uses the repo's `select ... from (select $1::uuid as org_id) o where o.org_id = $1::uuid` shape, so the `orgQuery` guard (`org_id = $1`) is satisfied. Values and the `on conflict ... do nothing returning id` clause are unchanged, so create behaviour is the same. Correct.
- Approve test: the old fixture (primary device on an empty seat) could not exist, because the constraint trigger forbids it. Approve only works on empty seats, so approve never has a primary to demote. The fix is a test-setup correction and does not weaken approve.

### AC2 ("approve seats requester, demotes any primary, rejects rivals")
- Seats requester and rejects both rivals, plus audit rows: still asserted in the approve test (CI green).
- "Demotes any primary": approve calls the shared `writeOccupant` -> `demotePrimary` (`seats.ts:261-271`). The demotion itself is covered by `seats.db.test.ts:251` (`demoted: 1`) and `:284`. On an empty seat there is no primary to demote, so the approve test cannot show it. The coverage is honest, but it is indirect.

### Nits (do not block)
- The PR body still says "renamed ... demotes any primary" for approve. Reword it to say the demote step is shared with `setOccupant` and only no-ops on an empty seat.
- The test retitle and the new seat_id assertion are fine.

### Ming verification after merge
None beyond the plan (manual request -> approve with two rivals comes after SIM-014.2).
