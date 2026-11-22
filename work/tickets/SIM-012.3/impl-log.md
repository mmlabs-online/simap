## Attempt 1 — 2026-11-22

Scope: seat actions only (Add, Delete, Release, role gating, shared confirm, reload and focus). The room switcher
(SIM-012.5) and SIM-012.4 are not built. No server, API, schema, migration or High-path change was needed.

### Files touched
| File | Required because |
|---|---|
| `src/ui/seats/seat-actions.ts` (new) | Pure logic: gating, count check, delete guard, outcome mapping, focus target |
| `src/ui/seats/seats-api.ts` | `get` generalised to `call`; added `add`, `remove`, `release` |
| `src/ui/seats/useRoomSeats.ts` | Keep rows on transient list failure; silent `refreshDetail` via `openIdRef`; export `refresh` |
| `src/ui/seats/useSeatActions.ts` (new) | One flow for dialog, busy, notice and writes |
| `src/ui/seats/SeatActions.tsx` (new) | Role-gated Release and Delete buttons and notice for the panel slot |
| `src/ui/seats/ConfirmSeatDialog.tsx` (new) | Shared confirm on `EntityFormDialog` |
| `src/ui/seats/AddSeatsDialog.tsx` (new) | Count field and field error |
| `src/ui/seats/SeatsPage.tsx` | Wires tier, actions, dialogs, delete close (`dismissedCode`) and focus |
| `src/ui/seats/SeatsView.tsx` | Optional `onAdd` and `notice`; Add button with `data-add-seats` |
| `src/ui/seats/SeatDetailPanel.tsx` | Focusable heading, `focusSignal`, corrected comment |
| `src/ui/copy/seats.ts` | `actions` copy group (D36) |
| Tests: `seat-actions.test.ts`, `seats-api.test.ts`, `SeatActions.test.tsx`, `SeatActionDialogs.test.tsx`, `SeatsView.test.tsx`, `SeatDetailPanel.test.tsx` | Plan test list |

### Tests added / changed
- `seat-actions.test.ts` › role gating, `parseAddCount`, `deleteBlock`, `actionOutcome` (add, delete, release, auth, unknown code), `keepRowsOnError`, `focusAfterDelete`
- `seats-api.test.ts` › `add`, `remove`, `release`, error code, `ApiAccessError` and network mapping
- `SeatActions.test.tsx` › role matrix, no buttons without a ready seat, notice always renders
- `SeatActionDialogs.test.tsx` › closed renders nothing, Cancel before submit, text field with numeric mode
- `SeatsView.test.tsx` › Add only with `onAdd`, empty state, no room; notice alert
- `SeatDetailPanel.test.tsx` › heading `tabindex="-1"`

### Checks (actual output summary)
- format:check: "All matched files use the correct format." (exit 0)
- typecheck + check:layers: exit 0; "check-layers: 340 files, no violations"
- test: exit 0; "Test Files 138 passed (138); Tests 1395 passed | 3 skipped (1398)" (includes `no-literals.test.ts`)
- build: exit 0
- test:db: not run (no server or SQL change)
- Browser checks B1 to B6: not run (Ming's list)

### Out-of-plan files
None. (`SeatsPage.tsx` needed one change after `no-literals.test.ts` flagged a generic `querySelector<...>` line as a
literal; reworded inside the same file.)

### Follow-ups (noticed, not done)
- The seat notice is cleared only when another seat opens; a seat-bound notice whose panel is closed shows on the page until the next action.
- `onDeleted` reads `list.seats` from the render closure; fine because it runs synchronously from a click, but SIM-012.4 should keep that in mind.
- The delete focus effect and the `focusSignal` heading focus are unverified in a browser (no jsdom).

### Scope self-check
- Could the diff be smaller? No further cut without dropping a plan item.
- Diff size (`git diff --numstat HEAD~1 HEAD` of the code commit): production +605 / -29 (`copy/seats.ts` 27, `AddSeatsDialog` 63, `ConfirmSeatDialog` 36, `SeatActions` 48, `SeatDetailPanel` 15/2, `SeatsPage` 114/5, `SeatsView` 30/5, `seat-actions` 99, `seats-api` 42/14, `useRoomSeats` 35/3, `useSeatActions` 96); tests +304 / -0 (`seat-actions.test` 152, `SeatActions.test` 53, `SeatActionDialogs.test` 43, `seats-api.test` 41, `SeatsView.test` 12, `SeatDetailPanel.test` 3). Total +909 / -29. Plan estimate was ~565 production / ~330 test; production ran about 7% over.

## Attempt 2 (rework) — 2026-11-22

Fixed only the 2 blockers and 2 should-fix items of review attempt 1. Nits untouched.

### Files touched
- `src/ui/seats/SeatsPage.tsx` — Issue 1: latest-URL ref and mounted ref; `onDeleted` replaces only via `shouldReplaceAfterDelete`, with the ref's pathname. Issue 3: notice routed through `routeNotice`.
- `src/ui/seats/useSeatActions.ts` — Issue 2: effect on `[openCode]` drops a seat-bound dialog that no longer matches (`shown` derivation kept). Issue 3: notice always keeps the seat code (also on `closePanel`). Issue 4: `run` takes the starting dialog and closes only it.
- `src/ui/seats/seat-actions.ts` — new pure `shouldReplaceAfterDelete` and `routeNotice`.
- `src/ui/copy/seats.ts` — `actions.noticeForSeat(code, text)`.
- `src/ui/seats/seat-actions.test.ts` — tests for both new functions.

### Checks
- `pnpm format:check` exit 0, "All matched files use the correct format."
- `pnpm typecheck` exit 0; `pnpm check:layers` exit 0, "check-layers: 340 files, no violations"
- `pnpm test` exit 0
- `pnpm build` exit 0
- `pnpm test:db` not run (instructed).
- Reviewer's scratch harness (run from the scratchpad, not copied): 11 passed. T1 no nav call, C302-02 stays open; T2 no nav call; T3 `afterReopenNoClick` false for delete and release; T4 `addOpenAfterFirstWrite` true with 1 write; T9 panel of C302-02 shows "Seat C302-01: This seat gained ...". Fake hook runtime, not a browser.

### Out-of-plan files
None.

### Follow-ups
None new.

### Scope self-check
- Diff size (`git diff --numstat`, before this log and commit): copy/seats 1/0, SeatsPage 24/8, seat-actions.test 42/0, seat-actions 25/0, useSeatActions 18/11. Total +110 / -19.

## Attempt 3 (rework) — 2026-11-22

Fixed only Issue 5 and Issue 6 of review attempt 2. Nits untouched. No room switcher (AC1 stays deferred).

### Files touched
- `src/ui/copy/seats.ts` — Issue 5: `actions.noticeForAdd(text)` = "Add seats: <text>".
- `src/ui/seats/seat-actions.ts` — Issue 5: `routeNotice` labels a `seatCode: null` notice with `noticeForAdd` when a panel is open; bare on the page.
- `src/ui/seats/useSeatActions.ts` — Issue 6: the `[openCode]` effect clears every seat-bound notice when a seat opens (as specified).
- `src/ui/seats/seat-actions.test.ts` — `routeNotice` test now covers Add notice on page (bare) and in panel (labelled).

### Checks
- `pnpm format:check` exit 0; `pnpm typecheck` exit 0; `pnpm check:layers` exit 0 ("check-layers: 340 files, no violations"); `pnpm build` exit 0.
- `pnpm test` exit 0, "Test Files 138 passed (138); Tests 1401 passed | 3 skipped (1404)". One earlier run in the same session failed 1 test (log not kept); two re-runs passed. Cause not identified, likely load-related flake.
- `pnpm test:db` not run (instructed).
- Reviewer's scratch harness (read from scratchpad r123, not copied): 31 passed. S3 `reopenSameSeatPanel: null`; S5 and S6 show "Add seats: ..." in panels, bare text on the page; T9 and S8 unchanged ("Seat C302-01: ..."); S8 reopen still calls `replace` and closes. Issues 1-4 scenarios (T1-T4, S1, S2, S4) still pass.

### Out-of-plan files
None.

### Follow-ups
None new.

### Scope self-check
- Diff size (`git diff --numstat`, before this log and commit): copy/seats 1/0, seat-actions.test 2/2, seat-actions 6/4, useSeatActions 2/4.
