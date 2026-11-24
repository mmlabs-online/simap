# Review — SIM-014.4: Approvals: Approve and Reject dialogs

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit=0 (549 files checked).
- `pnpm typecheck` — exit=0; `pnpm check:layers` — exit=0 ("check-layers: 495 files, no violations").
- `pnpm test` — exit=0 ("Test Files 194 passed (194)", "Tests 2038 passed | 3 skipped (2041)"). The reviewer's full run was green the first time; it matches impl-log.
- `pnpm build` — exit=0 ("Compiled successfully", `ƒ /approvals` present).
- `pnpm test:db` — not run (CI-only, needs Postgres). This diff changes no server code, SQL or migration.

### Acceptance criteria
- [x] 1a Approve and Reject open a confirm dialog first. Evidence: `RequestRowActions.tsx:31,39` only call `onApprove(item)` / `onReject(item)`. `ApprovalsPage.tsx` calls `api[action]` only from `onConfirm`, which is wired to `DecisionDialog` `onConfirm`. `DecisionDialog.test.tsx` checks the "approve: title ..." and "reject: title ..." cases, and `RequestRowActions.test.tsx` checks the buttons.
- [x] 1b The list refreshes after a decision. Evidence: `settleDecision` gives `reload: true` for ok, `not_found` and the 3 refusals (`requests-flow.test.ts` cases 1-4). `ApprovalsPage.tsx` `onConfirm` calls `requests.reload()` on `close` and on `reload`.
- [x] 1c Refusals show their message in the dialog. Evidence: `requests-flow.test.ts` › "seat_taken, seat_cannot_seat, member_not_assignable keep dialog open ... dialogError = apiErrorMessage(code)". `DecisionDialog.test.tsx` › "error renders inside role=alert ...".
- [x] 2a A no-op 200 shows the "already decided" notice. Evidence: `requests-flow.test.ts` › "ok with another status closes, reloads, notice 'This request was already <status>.'" (approve→rejected, approve→cancelled, reject→approved). `ApprovalsView.test.tsx` › "notice: status tone -> role=status ...".
- [x] 2b `not_found` closes the dialog and reloads. Evidence: `requests-flow.test.ts` › "not_found closes, reloads, error notice apiErrorMessage('not_found')".
- [x] 3 Pure-logic and static-render tests, with no jsdom. Evidence: every test listed in the plan exists (api ×2, flow ×7, dialog ×6, row actions ×4, view ×4). None of the added test code imports `jsdom` or `@testing-library` (grep of the diff). The suite is green.
- [x] 4 Buttons show only on pending rows. Approve is disabled on an occupied seat while Reject stays enabled. A busy call locks every button and labels only the busy row. Evidence: the 4 `RequestRowActions.test.tsx` cases.
- [x] 5 Focus moves to the h1 after a closing decision. Evidence: `ApprovalsView.test.tsx` › "h1 has tabindex=-1". `ApprovalsPage.tsx` focuses `headingRef` inside `requests.reload().then(...)`, and only on `outcome.close`. The browser `document.activeElement` check was not run, because a dev token is needed (the plan marks it optional).
- [x] 6 Checks are green (see above).

Ming verification after merge (not verified here; the PR must carry these):
- Manual test with 3 users (A, B, C) and a Manager: approve A's request. The dialog names B and C; after the decision, A leaves Pending and B and C show under Rejected.
- On a 390 px phone, Approve and Reject wrap cleanly, and long Vietnamese names wrap in the dialog.

### Implementer-reported items
- **Flaky `src/server/identity/verify.test.ts`**: accepted as unrelated. The diff touches nothing under `src/server/**` (`git diff --quiet origin/main...HEAD -- src/server` is clean). The test "expired beyond 30 s leeway; within leeway ok ..." (`verify.test.ts:165-174`) reads the real clock with a 1 s margin (`exp: now() - 29` against a 30 s leeway, `iat: now() - 43140`). A run under load that takes more than about 1 s between signing and checking can therefore fail. This flakiness was already in main. The reviewer's full run passed. Listed under Follow-ups.
- **`AUTH_CODES` not exported (plan deviation)**: accepted, not a scope or behaviour change. In the plan's outcome table, auth codes and "anything else" map to the same result (`close:false, reload:false, dialogError`). `settleDecision` only needs the refusal list, so leaving `requests-state.ts:60` unexported adds no duplicate list. The flow test "each auth code and invalid_request ..." covers the auth path. This makes the plan's file change smaller and is recorded in impl-log.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the new files are in `src/ui/requests/` and import only `@/lib/requests/types` plus ui siblings and copy files; `check:layers` passes.
- R2/R6: no schema or server change.
- R3: no config.
- R4: every changed source file is in the plan's file list. `work/ming-todo.md` (M-41) and the ticket files are workflow records, not code.
- R5: the new logic has tests.
- R7: the client treats 401/403 as "nothing changed" (no reload).
- D36: all new copy is in `src/ui/copy/requests.ts`.

### Blockers from review agents
None (no review-trigger path changed).

### Nits (do not block)
- `requests-flow.ts:16`: `REFUSALS` could be typed `readonly string[]` / `as const` to match how other code lists codes. This is cosmetic.
- `DecisionDialog.tsx:40`: the `key` sits on `EntityFormDialog` inside the component. It only remounts when the target changes while the dialog stays open, which the page never does today. It is harmless.

### Follow-ups (out of scope)
- Make `verify.test.ts` "leeway" test deterministic (fake `Date` like the test at line 354) to remove the load-dependent flake.
- From the plan: `rivalCount` on `RequestListItemDto`; `submittingLabel` on `EntityFormDialog` (replace "Saving..."); destructive style for the Reject submit; move `mine.alreadyDecided` to a shared copy key.
