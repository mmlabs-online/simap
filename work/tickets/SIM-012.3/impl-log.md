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
