# Impl log — SIM-012.6

## Attempt 1

### Files touched
- `src/ui/seats/seat-actions.ts` — new actions, `seatButtons` fields (`remove` renamed `deleteSeat`), dialog types, `removeDialog`, `parseCannotSeatReason`, `actionOutcome` branch. Required because: pure logic per plan.
- `src/ui/seats/seats-api.ts` — `setCannotSeat`, `clearCannotSeat`. Required because: exact PATCH bodies.
- `src/ui/seats/useSeatActions.ts` — three dialog kinds, request callbacks, `setCannotSeat`, `confirm()` branches; all writes via `run`. Required because: one flow honouring `reload`/`closePanel`.
- `src/ui/seats/SeatActions.tsx`, `src/ui/seats/SeatsPage.tsx` — buttons, confirm mapping, dialog wiring.
- `src/ui/seats/CannotSeatDialog.tsx` (new) — reason dialog.
- `src/ui/copy/seats.ts` — copy (D36).
- Tests: `seat-actions.test.ts`, `seats-api.test.ts`, `SeatActions.test.tsx`, `SeatActionDialogs.test.tsx`.

### Tests added
All listed in plan. Gating, mine seat, removeDialog, parseCannotSeatReason, actionOutcome new actions, setOccupant null body, setCannotSeat, clearCannotSeat, button markup, reason field.

### Checks
- pnpm typecheck: exit 0
- pnpm check:layers: 350 files, no violations
- pnpm format:check: all files correct format
- pnpm test: Test Files 142 passed; Tests 1477 passed | 3 skipped

### Out-of-plan files
None.

### Follow-ups
- `CannotSeatDialog` takes `seat: SeatDto | null` (null = closed) instead of `open` + `seat`; the dialog's `subtitle` carries the occupant-stays note.
- The `blockInvalid` copy is a fixed string (no `max` argument).

### Scope self-check
Only plan files changed; no server, API, schema or migration change. No `refresh()` or focus-signal calls in new hook code. Manual browser checks (two tabs, 390 px) not run.
