## Attempt 1 — 2026-11-22
Verdict: PASS

Reviewed at `7906be8` on `ticket/SIM-012.6`. `origin/main` is 2 commits ahead, and both only change `work/backlog.md`.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, all 404 files correct.
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, 350 files, no violations.
- `pnpm test` — exit 0, 142 files passed; 1477 tests passed, 3 skipped. Matches impl-log.
- `pnpm build` — exit 0, production build completed. impl-log had no result for this check.
- `pnpm test:db` — not run, as instructed (CI-only). The diff changes no server, API, schema or migration file.

### Acceptance criteria
- [x] Remove and the set and clear cannot-seat actions appear only for Manager and Admin — evidence: `seat-actions.ts:59-61`; `seat-actions.test.ts` "gating by tier and seat state"; `SeatActions.test.tsx` "user sees none of them" and "manager sees Remove and Block; Unblock on a cannot-seat seat". The routes also require tier `manager` (`cannot-seat/route.ts:25`, `occupant/route.ts:25`).
- [x] A Manager or Admin who is the occupant sees Release, not Remove — evidence: `seat-actions.ts:58-59`; `seat-actions.test.ts` "mine seat: Release, not Remove"; `SeatActions.test.tsx` "own seat shows Release, not Remove".
- [x] Remove asks for confirmation and sends the shown occupant id. If the occupant changed, the page reloads, shows a message and sends nothing more — evidence: the snapshot in `seat-actions.ts:76-84`; the single call inside `run` at `useSeatActions.ts:236-240`; `seats-api.test.ts` "setOccupant clears with null and the shown occupant id"; `seat-actions.test.ts` "remove occupant_changed reloads with its own message and no keepDialog". Limit: when the occupant was changed to nobody, the server answers success and no message shows (Follow-up 1).
- [x] Setting cannot-seat requires a valid reason. An invalid reason shows a field error and sends nothing — evidence: `CannotSeatDialog.tsx:52-54` calls `onSubmit` only on a valid parse; `seat-actions.ts:87-91` returns the validator's value; `seat-actions.test.ts` "returns the validator's value" and "refuses bad input". The error wording is misleading for some inputs (Issue 1).
- [x] Clearing cannot-seat asks for confirmation and sends exactly `{cannotSeat: false}` — evidence: `SeatsPage.tsx:148-153`, `useSeatActions.ts:243-245`; `seats-api.test.ts` "clearCannotSeat: body is exactly cannotSeat false".
- [x] Unit tests cover the role gating, the reason check, the Remove and cannot-seat request bodies and their refusal outcomes — evidence: the new cases in `seat-actions.test.ts`, `seats-api.test.ts`, `SeatActions.test.tsx`, `SeatActionDialogs.test.tsx`; `actionOutcome new actions` covers success, auth, `invalid_request`, `not_found`, `occupant_changed` and transient codes.

Plan reviewer check: each new `seatsApi.*` call is inside a `run(...)` callback, and the new hook code does not call `refresh()` or `setFocusSignal` itself (`useSeatActions.ts:190-196`, `236-245`).

Scope: every changed `src/` file is in the plan's file list. No High path changed.

### Not verified in a browser
Nobody has run these. They were judged from the code only, and they stay open for the ticket's manual test:
- Remove, set and clear cannot-seat on a local room with seeded data.
- An invalid reason showing the field error with no request in the network tab.
- No request before Confirm on Remove and Unblock.
- A concurrent change from a second tab. To see the `removeChanged` message, the second tab must **replace** the occupant; removing them gives the silent success in Follow-up 1.
- Dialog focus, Esc, Cancel during a write, and focus after the Block and Unblock buttons swap.
- Layout at 390 px and desktop, with up to five action buttons in the panel.

### Issues
#### Issue 1 — 🟡 should-fix — misleading validation message
- **Where**: `src/ui/copy/seats.ts:76`, shown by `src/ui/seats/CannotSeatDialog.tsx:48`
- **Expected**: the field error tells the user why a reason within the length limit was refused.
- **Actual**: the validator refuses hidden code points, including the variation selector and joiner used by many emoji, and tabs. Evaluating the validator's regexes: `⚠️ Ghế hỏng` (11 characters), `Ghế hỏng ❤️` (11) and a reason with a tab are refused, yet the message says "Enter a reason of 1 to 200 characters."
- **Fix instruction**: change only the `blockInvalid` string to `"Enter 1 to 200 characters. Some emoji and hidden characters are not allowed."`. Do not change the validator. This does not block the ticket.

### Rules (CLAUDE.md)
No violations found. R1: `pnpm check:layers` is green and only `src/ui/**` changed. R2, R6, R7: no server, schema or route change. R3: no config or secrets. R4: changes stay in the plan. R5: checks are green and the new logic has tests. D36: the copy is in `src/ui/copy/seats.ts`.

### Blockers from review agents
None. No review trigger path changed.

### Nits (do not block)
- `src/ui/copy/seats.ts:66`: the Remove body mentions "Their primary device" even when the seat has none. "Any primary device here becomes secondary." is accurate in both cases.
- `src/ui/copy/seats.ts:76`: the limit 200 is hard-coded; `SEAT_LIMITS.reason` is the source.
- `src/ui/seats/useSeatActions.ts:184-189`: the new request callbacks leave an old notice on screen, while `requestAssign` and `openAdd` clear it.
- `src/ui/seats/SeatActions.test.tsx`, "busy disables the buttons": does not assert the Unblock button.
- `src/ui/seats/ConfirmSeatDialog.tsx:4`: the comment still says "Delete and Release" only.
- impl-log lists two plan deviations (`CannotSeatDialog` props, fixed `blockInvalid`) under Follow-ups. Both are harmless.

### Follow-ups (out of scope)
1. **Remove on a seat that is already empty reports success silently.** `decideOccupantChange` returns `noop` when `current === target` before it compares `expected` (`src/lib/seats/rules.ts:25-26`), so `{memberId: null, expectedOccupantId: X}` on an empty seat returns 200, not `occupant_changed`. No data is wrong and the page reloads to show the empty seat, but the user is not told someone else had already removed the occupant. A message needs a server change, which this ticket excludes. Ming can decide whether it is worth a ticket.
2. A transient or auth failure on Block closes the dialog and loses the typed reason (plan Assumptions 5 and 6, accepted for this ticket).

### Ming verification after merge
The plan names no hosted check. The local manual checks under "Not verified in a browser" are still outstanding.
