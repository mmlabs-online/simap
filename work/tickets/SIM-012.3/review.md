## Attempt 1 — 2026-11-22
Verdict: REWORK

Two blockers, both in writes that finish or dialogs that survive after the user navigates. All project checks are green
and the core logic is sound. **Ticket AC1 (room switcher) is not delivered**: the plan defers it to a proposed
SIM-012.5, which Ming has not decided yet. As instructed, this review does not fail the ticket for that deferral. The PR
must state it.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 340 files, no violations"
- `pnpm test` — exit 0, "Test Files 138 passed (138); Tests 1395 passed | 3 skipped (1398)". Matches impl-log.
- `pnpm build` — exit 0
- `pnpm test:db` — not run, as instructed. `git diff --name-only origin/main...HEAD` shows no file under `src/server`,
  `src/app/api`, `src/lib` or `db/`, and no `.sql` file.
- Scratch harness (not committed, not a browser): drives the real `SeatsPageInner`, `useSeatActions`, `useRoomSeats` and
  `seats-api` on a fake hook runtime with batched updates and stubbed router, fetch and DOM. 11 scenarios, T1 to T11.
  It proves state order and the calls made. It does not prove native dialog, focus or Next.js router behaviour.
  Files: `C:\Users\ttngo\AppData\Local\Temp\claude\a3e515fd31dc05c9\370082c2-0d8c-4461-9583-1eabecf44bf5\scratchpad\r123\page.test.tsx`
- Not run: any dev server, database, real browser. B1 to B6 stay on Ming's list.

### Acceptance criteria
- [ ] AC1 Room switcher — **NOT DELIVERED**, deferred by the plan to proposed SIM-012.5 (Ming undecided). Spec SHL-01 still
      requires it before v1. Not counted against this attempt.
- [x] AC2 Add and Delete only for Admin, Release only on `mine` — evidence: `seat-actions.test.ts` › "canManageSeats is admin
      only", "canRelease follows seat.mine"; `SeatActions.test.tsx` › "role matrix"; harness T8 (Manager occupant can release);
      `SeatsPage.tsx:23,128`.
- [x] AC3 Add 1 to 50, invalid count sends nothing — evidence: `parseAddCount` tests; harness T11 (19 inputs, including `1e1`,
      `0x5`, Arabic and full-width digits, 400 digits); `AddSeatsDialog.tsx:46-48`. Real table update: B2.
- [x] AC4 Delete confirms, removes, closes and moves focus — evidence: harness T6 (panel goes `ready` to `closed`, never
      `notFound`; focus goes to the next row, or to Add when no row is left), T7 (failed reload keeps the deleted row, focus
      still moves to a live row). Real focus: B3. The in-flight path fails, see Issue 1.
- [x] AC5 Occupied seat or device seat is refused with a message — evidence: `deleteBlock` tests; `actionOutcome` delete test;
      `useSeatActions.ts:80-82`. Message placement when another seat is open: Issue 3.
- [x] AC6 Release confirms; a changed seat reloads and says so — evidence: harness T8 (`not_allowed` shows the message, panel
      refreshes, Release gone; failed refresh shows the error and not the old seat, busy clears).
- [x] AC7 Unit tests cover gating, count, error mapping and API client — evidence: `seat-actions.test.ts`, `seats-api.test.ts`,
      `SeatActions.test.tsx`, all passing.
- [x] Plan row 8, project checks and rules — evidence: Checks above.

Verified with no finding:
- Double submit: two synchronous confirms plus a third during flight send one write (T5). A second Add during flight sends
  nothing (T4).
- `refresh`: `openIdRef` prevents a stale seat from cancelling the new seat's load; the new seat reaches `ready` (T1, T9).
  No panel stuck on Loading in any scenario.
- Error mapping branches on `result.code` only. `unavailable` and `internal` on Add warn about D30 (T10).
- Esc and scrim while busy: `onClose` always closes and the write still reports (T4, T9). Stacking by reading:
  `EntityFormDialog.tsx:42-51,60-70`.

### Issues
#### Issue 1 — 🔴 blocker — in-flight write navigates the user
- **Where**: `src/ui/seats/SeatsPage.tsx:54-63`, called from `src/ui/seats/useSeatActions.ts:58`
- **Expected**: plan Approach 6: `router.replace` runs "only if the URL still shows that seat". A delete that finishes after
  Back or after leaving the page must not change the current page or close another seat.
- **Actual**: `run` keeps the `onDeleted` from the render where Confirm was pressed, so `urlParam` and `pathname` are stale.
  - Harness T1: delete C302-01 in flight, Back, open C302-02, delete finishes: `replace /rooms/C302` runs and **C302-02's
    panel closes**.
  - Harness T2: delete in flight, page unmounted and URL now `/devices`, delete finishes: `replace /rooms/C302` is still
    called, which **pulls the user back to the room page**.
- **Fix instruction**: in `SeatsPageInner`, keep the latest URL seat code and pathname in a ref updated by an effect, plus a
  mounted ref set to `true` in the effect body and `false` in its cleanup (StrictMode safe). In `onDeleted`, call
  `router.replace` only when mounted and the ref's seat code equals `code`, and build the href from the ref's pathname.
  Re-run scenarios T1 and T2: T1 must leave C302-02 open with no `replace`; T2 must make no router call.

#### Issue 2 — 🔴 blocker — a closed confirm comes back by itself
- **Where**: `src/ui/seats/useSeatActions.ts:67-68`
- **Expected**: plan Approach 5: "Back closes it with the panel."
- **Actual**: `shown` only hides the dialog; `dialog` state keeps the old seat. Harness T3, for both Delete and Release: open
  confirm, Back (hidden), open the same seat again: **the destructive confirm reopens with no click**, built from the old seat
  snapshot.
- **Fix instruction**: add an effect on `[openCode]` that clears a seat-bound dialog when it no longer matches:
  `setDialog((d) => (d && d.kind !== "add" && d.seat.code !== openCode ? null : d))`. Keep the `shown` derivation so the
  commit that changes the seat never renders the old confirm. Re-run T3: `afterReopenNoClick` must be `false`.

#### Issue 3 — 🟡 should-fix — a late result reads as if it were about the open seat
- **Where**: `src/ui/seats/SeatsPage.tsx:102-104`, `src/ui/seats/useSeatActions.ts:39-43,53-57`
- **Expected**: no result lands on the wrong seat, and a refusal is visible where the user is.
- **Actual**: harness T9: a refused delete of C302-01 lands while C302-02 is open. The panel shows nothing, and the page
  behind the modal shows "This seat gained an occupant or a device…" with no seat code. A blocked-delete notice also stays
  on the page after its panel closes, again with no code (noted in impl-log follow-ups).
- **Fix instruction**: always keep the seat code on a seat notice, including `closePanel` outcomes (l.55). When a panel is
  open, render the notice in that panel; otherwise on the page. When `notice.seatCode` is not the open seat, prefix the code
  through a new `seatsCopy.actions.noticeForSeat(code, text)`. Re-run T9: C302-02's panel must show the text naming C302-01.

#### Issue 4 — 🟡 should-fix — a finishing write closes a newer dialog
- **Where**: `src/ui/seats/useSeatActions.ts:52`
- **Expected**: a write closes only the dialog that started it.
- **Actual**: harness T4: Add in flight, Esc, reopen Add and type; the first write finishes and the new dialog closes, losing
  the input.
- **Fix instruction**: capture the dialog object when the write starts and use
  `setDialog((d) => (d === started ? null : d))`. Pass it into `run` from `add` and `confirm`. Re-run T4:
  `addOpenAfterFirstWrite` must be `true`, with still only one write sent.

### Rules (CLAUDE.md)
No violations found.
- R1: `pnpm check:layers` clean; `src/ui/seats` imports only `@/lib` and `src/ui`.
- R2, R6, R7: no migration, server or route handler change.
- R3: no config or secret.
- R4: every changed source file is in the plan's file list. No High path changed. No SIM-012.4 feature (picker, assign,
  replace, remove, cannot-seat), device action, request or map code.
- R5: checks green; new pure logic has tests. D36: new text is in `src/ui/copy/seats.ts`, `no-literals.test.ts` passes.

### Blockers from review agents
None. No review trigger path changed.

### Nits (do not block)
- `useSeatActions.ts:52,60-61`: the confirm closes while Delete is still disabled by `busy`, so focus cannot return to it and
  lands on the heading after the reload. Plan step 7 expected a surviving Delete to keep focus. Focus stays on a real control
  (by reading; confirm in B4).
- `useSeatActions.ts:76`: reopening Add clears the D30 warning (T10), even if the reload also failed and the list could not be
  checked. This follows the plan's "clear on the next action". Consider keeping it visible until a list reload succeeds.
- `copy/seats.ts` `releaseChanged` says "The page was reloaded" even when that reload failed.
- `useRoomSeats.ts:115`: after a delete, `refreshDetail` still reads the deleted seat from `openIdRef` and sends one extra GET;
  its 404 is dropped (by reading).
- If history navigation opens a seat while the Add dialog is open, the panel stacks above Add (by reading).

### Follow-ups (out of scope)
- Ming to decide proposed SIM-012.5 (room switcher, ticket AC1, spec SHL-01). If accepted, narrow this ticket's title, scope
  and AC1.
- Writes have no client timeout, so a hung request keeps the actions disabled until the page reloads.

### Ming verification after merge (carry to the PR)
B1 Roles, B2 Add, B3 Delete, B4 Delete refused, B5 Release, B6 In flight, as listed in `plan.md`, at 390 px and desktop, in
light and dark. These need a real browser: native dialog stacking, Esc and scrim, focus, Next.js navigation and layout.
