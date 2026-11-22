## Attempt 1 — 2026-11-22

Slice 1 only (picker, Assign, Replace, re-ask). Remove, Release-not-Remove for a Manager occupant, and set/clear cannot-seat are out (slice 2).

### Files touched
| File | Required because |
|---|---|
| src/ui/seats/member-picker.ts (new) | Pure picker state, stale handling, query normalizer |
| src/ui/seats/useMemberPicker.ts (new) | Debounce, request ids, reload token |
| src/ui/seats/MemberPickerDialog.tsx (new) | Picker dialog and props-driven fields |
| src/ui/seats/seats-api.ts | `setOccupant`, `activeMembers` |
| src/ui/seats/seat-actions.ts | `assign` action, `seatButtons`, `pickStep`, `confirmText`, `decideReask`, `reaskDialog`, `refusedDialog`, outcome branch |
| src/ui/seats/useSeatActions.ts | `assign` dialog, `requestAssign`, `pick`, `closeConfirm`, `writeOccupant` |
| src/ui/seats/SeatActions.tsx | Render from `seatButtons` |
| src/ui/seats/SeatsPage.tsx | Confirm text for assign, picker, keyed confirm |
| src/ui/seats/ConfirmSeatDialog.tsx | Clip long names in the body |
| src/ui/copy/seats.ts | New strings (D36) |
| tests: member-picker.test.ts, MemberPickerDialog.test.tsx, seat-actions.test.ts, seats-api.test.ts, SeatActions.test.tsx, SeatActionDialogs.test.tsx | Plan's test list |

### Tests added / changed
- member-picker.test.ts: normalizePickerQuery, reducer (reset, stale search, stale load-more, append/dedupe, failed more, failed search), canLoadMore, selectedMember, blocksSearchEnter
- MemberPickerDialog.test.tsx: name/code/null, button types, list classes and states, disabled occupant radio
- seats-api.test.ts: activeMembers (query, shape), setOccupant (body, validator, error code)
- seat-actions.test.ts: seatButtons, pickStep, confirmText, decideReask, reaskDialog, refusedDialog, actionOutcome assign
- SeatActions.test.tsx: assign role matrix, cannot-seat disables; SeatActionDialogs.test.tsx: confirm clip

### Checks (actual output summary)
- typecheck: exit 0 (next typegen + tsc); check:layers: 349 files, no violations
- format:check: All matched files use the correct format.
- test: Test Files 142 passed (142); Tests 1457 passed | 3 skipped
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Browser checks B1-B6 need Ming (static markup tests cannot cover focus, stacking, IME).
- Accent-insensitive member search is a server/DB change (plan assumption 5).
- `useMemberPicker` and `writeOccupant` have no unit tests (effects/async); covered by pure-function tests and browser checks.

### Scope self-check
- Could the diff be smaller? No; each piece is listed in the plan.
- Diff size: about +690 / -26 lines including tests (production roughly 450).
