## Attempt 1 — 2026-11-25
Verdict: PASS

Scope: slice 1 only (API, data, DTO, SIM-037.1 security follow-ups), as approved with A1-A14 (migration kept, High
tier); UI is SIM-037.8. DB-only evidence (`pnpm test:db`, migrate, `migrate:smoke`, `schema:check`) could not run here
(no Docker/Postgres); the test code was reviewed and those items are marked "pending CI". Ming merges only after CI is green.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format" (737 files).
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "check-layers: 683 files, no violations".
- `pnpm test` — full suite: 256 files passed, 1 failed, 1 skipped; 2586 tests passed, 1 failed, 14 skipped. The one failure
  is the known flaky `scripts/dev-process.test.ts > real tree > root exits first; the orphan grandchild is still
  stopped`. Run alone: 1 file / 21 tests passed, exit 0. Not caused by this diff (the diff does not touch scripts/dev-*).
- `pnpm build` — exit 0; the build lists the routes `/api/devices/[id]/handoffs`, `/api/handoffs`,
  `/api/handoffs/[id]/{cancel,confirm,decline}` and `/api/handoffs/count`.
- `pnpm test:db`, `pnpm migrate`, `migrate:smoke`, `schema:check` — NOT run (no DB). Pending CI (`.github/workflows/ci.yml`
  runs migrate CLI, migrate smoke and `pnpm test:db`).
- These results match the impl-log apart from the flaky test, which passes when run alone.

### Acceptance criteria
- [x] 1. A User can start a transfer of their own device but not of someone else's; a Manager+ can for any owned device. Evidence:
  `src/lib/devices/handoff-rules.test.ts › decideTransferStart` (own ok, other's/unowned refused for a User,
  manager/admin ok, order permission → owner → recipient → pending) passes in the run above. DB: `handoffs.db.test.ts`
  lines 73-127 (owner starts; user on another's 422 with no row and no audit; manager → requested_by = manager, from =
  owner; unowned / owner-as-recipient / foreign / inactive recipient refused) — pending CI.
- [x] 2. Until confirm the device keeps its owner and seat; only the recipient confirms or declines; only the sender or a
  Manager+ cancels. Evidence: `handoff-rules.test.ts › decideHandoffAction` matrix and `viewer flags` (pass).
  `handoffs-routes.test.ts › … refusals map to their status; the handler emits no 401 or 403` (pass, R7). DB: lines
  148-164 (device unchanged, placement still allowed), 167-212 (cancel by sender/manager, the recipient cannot cancel,
  stranger/sender cannot decline, decline leaves the device as it was), 267-276 (a non-recipient admin cannot confirm) —
  pending CI.
- [x] 3. On confirm the device belongs to the recipient, is not at any seat, and the seat's primary rule still holds. Evidence: code
  `src/server/devices/handoffs.ts` confirmOnce (one `update devices set owner_id, seat_id = null, role = 'secondary'`,
  holding untouched); DB lines 224-265 (primary at A-01 → owner y, seat null, secondary, no primary left at A-01,
  holding/expiry unchanged, audit meta fromSeatId/fromCode/demoted/expiresOn; the unplaced case) and 327-342
  (concurrent placement) — pending CI.
- [x] 4. A second pending handoff is refused; confirming a cancelled or stale handoff returns 409. Evidence: `pg-error.test.ts`
  mapping 23505 `device_handoffs_one_pending_idx` → `handoff_pending` (pass). DB lines 129-146 (second start 409, raw
  insert hits the index, two concurrent starts give one ok and one 409), 278-303 (after cancel / on repeat →
  `handoff_not_pending`; owner changed → `handoff_stale`, handoff stays pending), 315-325 (confirm vs cancel: exactly
  one wins) — pending CI.
- [x] 5. The recipient's nav shows the number of pending incoming transfers. Slice 1 delivers the count source only:
  `handoffs-routes.test.ts › GET /api/handoffs/count returns { incoming }` (pass). DB lines 345-377 (list order,
  decided rows excluded, other org excluded, count 2/0/0) are pending CI. The badge itself is SIM-037.8.
- [x] 6. `decided_by_id` is null exactly while pending. Evidence: `db/migrations/20261125180000_handoff_decided_by.sql` (`not valid`
  then `validate`, forward-only); `scripts/schema-check.mjs` adds checks in both directions and gives existing decided
  inserts a decider; fixtures `addHandoff` updated; DB lines 380-389 — pending CI (migrate, migrate:smoke, schema:check,
  test:db).
- [x] 7. Each start, cancel, decline and confirm writes one audit row, and a refusal writes none. Evidence: DB tests assert
  `device.transfer_start` (l.90-92, 102, 126), `_cancel` (l.179-180, 197), `_decline` (l.211), `_confirm`
  (l.245-252, 275) — pending CI.
- [x] 8. Checks green. Format, typecheck, check:layers, test and build pass (the flaky test passes alone). DB checks are pending CI.

### Issues
None blocking.

### Rules (CLAUDE.md)
No violations found.
- R1: the routes import only `@/server/**` and `@/lib/**`. `handoff-rules.ts` and the validators are pure `src/lib`. `tx.ts`
  and `handoffs.ts` start with `import "server-only"`. check:layers is clean.
- R2: one new forward-only migration that only adds a constraint (`not valid` + `validate`). No applied migration is edited.
- R6: every query goes through `orgQuery` with `org_id = $1`, and every join repeats `org_id`: `handoffRows`,
  `deviceRows`, the insert carries `org_id`. Tier comes from `ctx.tier`.
- R7: handlers emit only 400/404/503 plus service refusals (404/409/422). Permission is decided before any lock or write
  (`decideTransferStart`, `decideHandoffAction`) and re-checked under the lock before the update. "Not the recipient"
  returns 422 `not_allowed`.
- R3: no config or secrets. R4: every changed file is in the plan. `work/ming-todo.md` and `ticket.md` are loop
  bookkeeping. R5: the new logic has unit and DB tests.
- Scope: the only High path is the planned migration, so the PR is High tier as approved (A8).

Concurrency review (code reading): start locks the member (share) and then the device (for update), with the pending
read under the device lock, the same as assign/delete. Confirm locks member → room (share) → seat → device → handoff,
consistent with placeDevice (rooms → seats → device) and deactivateMember. Cancel/decline lock only the handoff row. I
found no lock-order cycle. The placement race retries once and then returns 409 `placement_changed` (A12).

### Blockers from review agents
None. security-review.md (Attempt 1): no 🔴 and no 🟡; 💭 notes only (cancel audit `byManager` when a Manager recipient cancels; Manager+ can transfer any owned device to themselves and confirm — allowed by the spec, audited).

### Nits (do not block)
- `src/server/devices/devices.db.test.ts` "delete refuses a device with a pending transfer": the device is owned by x,
  so delete refuses with `device_owned` before the pending check, and the test only asserts `r.ok === false`. It does
  not prove the pending refusal. That refusal is already covered by the existing return-handoff test (l.446-474). Either
  rename the test or assert `{ status: 409, code: "device_owned" }`. This is the same untestable case the impl-log noted
  for assign.
- `src/server/devices/devices.ts` deviceRows: trailing space after `as h_created_at,` inside the SQL template. Harmless.
- `confirmOnce` / `closeHandoff` do not check `kind`. That is correct while only transfers exist, but SIM-037.4/037.5
  must branch on `kind` (`to_member_id` is null for returns; `toId!` in confirmOnce would be wrong).

### Follow-ups (out of scope)
- Deactivating or removing a member should cancel pending handoffs to or from that member (A5). This is SIM-037.4 scope.
- A Manager+ org-wide handoff list (SIM-037.4).
- UI slice: dialog, incoming list, nav badge, pending chip, and Ming's manual two-account transfer check (SIM-037.8).
