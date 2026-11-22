## Attempt 1 — 2026-11-22
Verdict: REWORK

Scope judged: slice 1 only (picker, Assign, Replace, re-ask), as `plan.md` `## Split proposal` defines it. Branch
`ticket/SIM-012.4` confirmed checked out at `0f917da`. `origin/main` is 2 commits ahead, both board-only.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "349 files, no violations".
- `pnpm test` — exit 0, Test Files 142 passed (142); Tests 1457 passed | 3 skipped (1460).
- `pnpm build` — exit 0.
- `pnpm test:db` — not run, CI-only by instruction; this diff touches no server or DB code.

The results match `impl-log.md`.

### Acceptance criteria
Evidence is from the reviewer's run of `src/ui/seats` (9 files, 130 tests passed) and from reading the code. Nothing was
exercised in a browser.

- [x] AC1 (slice 1: Assign and Replace only) — evidence: `seat-actions.test.ts › seatButtons › matrix over tier and seat state`; `SeatActions.test.tsx › assign role matrix; Replace when occupied`.
- [x] AC2 Picker lists, searches, loads more, Enter does not submit — evidence: `seats-api.test.ts › activeMembers` (2 tests); `member-picker.test.ts` (reducer, `blocksSearchEnter`); `MemberPickerDialog.test.tsx`; handler at `MemberPickerDialog.tsx:49-51`. The real key press is B2.
- [x] AC3 Assign to an empty seat updates table and panel — evidence: `pickStep › empty seat sends expected null`; `actionOutcome assign › ok reloads and keeps the panel`; `useSeatActions.ts:146`. Real update is B1.
- [x] AC4 Replace text — evidence: `pickStep › occupied builds one snapshot with the shown id and name`; `confirmText › exact replace text with diacritics`.
- [x] AC5 Re-ask, nothing sent until confirmed — evidence: `decideReask` (6 tests); `reaskDialog` test; `useSeatActions.ts:121-133` has no path from a refusal to a PUT. Real concurrency is B3. The refetch-failure branch has Issues 1 and 2.
- [x] AC6 (slice 1: reason shown, Assign/Replace disabled) — evidence: `SeatActions.test.tsx › cannot-seat disables assign and replace`; `SeatDetailPanel.test.tsx › shows the reason inside the clip container`.
- [x] AC7 Unassignable member refused, picker reloads, dialog stays — evidence: `actionOutcome assign › member_not_assignable keeps the dialog`; `refusedDialog` test; `useSeatActions.ts:138-140`. Real flow is B4.
- [x] AC8 (slice 1: all except the reason check) — evidence: the tests above, plus `member-picker.test.ts › a stale search response is dropped` and `seats-api.test.ts › setOccupant`. The wiring in `writeOccupant` has no test, which is how Issue 1 got through.

**Parts of the ticket's AC left for the proposed SIM-012.6 (not failed here):**
- AC1: gating of **Remove** and **set/clear cannot-seat** for Manager and Admin, including "a Manager who is the occupant sees Release, not Remove".
- AC6: **setting the flag requires a valid reason** (`validateCannotSeat`), plus the set and clear actions themselves.
- AC8: unit tests for **the reason check**.

**Existing Release and Delete behaviour:** no regression found. `seatButtons` keeps the same conditions (`canRelease`, `canManageSeats`), `run()` is unchanged, `actionOutcome` returns the same results for `delete` and `release`, the confirm keeps `closeDialog` for them (`SeatsPage.tsx:197`), and the existing tests pass. Not exercised in a browser.

**Browser checks B1-B6: none has been run, so all six remain unverified in a browser.** From the code:
- B1 Assign: the path looks correct.
- B2 Picker: the Enter guard looks correct. IME behaviour, list scrolling and the 390 px layout cannot be judged from code.
- B3 Re-ask: the keyed remount should put focus on Cancel, because Cancel is never disabled (`EntityFormDialog.tsx:96-102`). Real focus and two-tab behaviour are unverified.
- B4 Unassignable: the path looks correct.
- B5 Stacked dialogs: Esc and scrim handling are per dialog and `closeConfirm` clears only the confirm. Native top-layer order and focus return are unverified.
- B6 Cannot-seat: covered by markup tests only.

These stay under `Ming verification after merge` and must be carried into the PR.

### Issues
#### Issue 1 — 🔴 blocker — auth failure reloads the page and clears the seat list
- **Where**: `src/ui/seats/useSeatActions.ts:146` (also `:150`, and the refetch-failure branch at `:131-133`)
- **Expected**: Plan step R7 and the `actionOutcome` contract (`seat-actions.ts:167-170`): auth codes and `invalid_request` mean nothing changed, so **no reload**. `run()` honours this at `useSeatActions.ts:73` and `:76`.
- **Actual**: `writeOccupant` ignores `outcome.reload` and always calls `await refresh()`. If the PUT returns `unauthenticated` or `member_deactivated`, the follow-up list request is likely to fail too, and `useRoomSeats.ts:71-76` then replaces the rows with `[]` because `keepRowsOnError` is false for those codes. The user loses the table instead of seeing only the auth message. The focus signal at `:150` also fires with no reload. The test `actionOutcome assign › auth and invalid_request do not reload` passes because it checks only the pure function, which the hook does not obey. A refetch that fails with an auth code takes the same path and also bumps the picker's `reloadToken`.
- **Fix instruction**: In `writeOccupant`, add `let reload = true`. In the final `else`, set `reload = outcome.reload`. In the refetch-failure branch, use the same decision:
  ```ts
  const failed = actionOutcome("assign", { ok: false, code: step.code });
  reload = failed.reload;
  closePanel = failed.closePanel;
  if (failed.reload && !failed.closePanel) {
    finish(refusedDialog(started, failed.message ?? ""), failed.message);
    closed = !still();
  } else {
    finish(null, failed.message);
  }
  ```
  Then replace line 146 with `if (reload) await refresh();` and line 150 with `if (reload && closed && !closePanel) setFocusSignal((n) => n + 1);`.

#### Issue 2 — 🟡 should-fix — seat deleted during the re-ask leaves the picker open on a missing seat
- **Where**: `src/ui/seats/useSeatActions.ts:131-133`
- **Expected**: `not_found` closes the dialog and the panel, as the PUT path does (`seat-actions.ts:206-208`, `actionOutcome assign › not_found closes the panel`).
- **Actual**: If the PUT returns `occupant_changed` and the refetch returns `not_found`, `refusedDialog` keeps the picker open for a deleted seat, over a panel that now says the seat is not found. Nothing wrong is written: another submit gets `not_found` and closes.
- **Fix instruction**: The code in Issue 1 fixes this, because `failed.closePanel` is true for `not_found`. No separate change is needed.

### Rules (CLAUDE.md)
- R1: no violations (`pnpm check:layers`).
- R2, R3, R6: not touched; the diff has no server, schema or env change.
- R4: every changed `src/` file is in the plan's file list. No High path changed.
- R5: checks are green, but `writeOccupant` has no test (see Issue 1).
- R7: no route handler changed. The client-side auth rule from the plan is broken by Issue 1.
- D36: new strings are in `src/ui/copy/seats.ts`.

### Blockers from review agents
None. No review trigger matches this diff.

### Nits (do not block)
- `MemberPickerDialog.tsx:154`: after a refusal, submitting with nothing selected still shows `memberGone`, because `error` takes priority over `pickerNone`.
- `ConfirmSeatDialog.tsx:34`: `max-h-32` with hidden overflow could cut the end of the replace text for two 80-character names in wide glyphs at 390 px. This is an estimate and unlikely with real names. Worth a look during B5.
- `MemberPickerDialog.tsx:53-58`: the `radiogroup` also contains status text and the Load more button. Moving them outside the group would be cleaner for screen readers, if the footer stays visible at 390 px.

### Follow-ups (out of scope)
- Create SIM-012.6 for the AC parts listed above.
- Accent-insensitive member search (DSH-02) needs a server and DB change (plan assumption 5).
- A small hook test harness would let `writeOccupant` and `useMemberPicker` be tested directly.
