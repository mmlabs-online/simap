## Attempt 1 — 2026-11-23
Verdict: PASS

Reviewed commit `a433cc5` on `ticket/SIM-015.3`. No browser was used: canvas, pan, focus, 390 px and dark mode are not verified here and stay on Ming's list below.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "370 files, no violations".
- `pnpm build` — exit 0.
- Unit tests (`vitest run`, the command behind `pnpm test`, with an added JSON reporter) — 8 complete consecutive runs, all exit 0, each "Tests 1593 passed | 8 skipped (1601)", 68-76 s. No failure observed in any of them.
- Same suite under full CPU load (12 busy processes on 12 cores), planned 4 runs — **skipped on Ming's instruction on 2026-11-23**. The first loaded run was stopped before it finished and produced no result, so it counts as neither pass nor fail. Only that run was stopped; the `pnpm dev` process from 12:18 was left running.
- `pnpm test:db` — not run (CI-only, needs Postgres; this ticket has no server or schema change).

**Flake status: unresolved.** The implementer's log reports one unidentified failure that passed on re-run; that is the implementer's claim and I did not see it. It did not reproduce in my 8 unloaded runs, which does not rule it out, and the load test that could have provoked it was not completed. The failing test is not identified. Timing data from the completed runs points at candidates only, not a finding: `scripts/dev-process.test.ts` spawns real process trees (up to about 20 s per test) and asserts process death after a fixed `sleep(300)`. This ticket does not change `scripts/`.

### Acceptance criteria
- [x] The room page renders every placed seat and fixture at its saved tile — evidence: `map-view.test.ts` "keeps every placed seat and fixture with its tile"; `RoomMapSection.tsx` passes `view.layout` to `RoomMap` unchanged. Rooms over the canvas budget show the "too large" view, as Ming approved on 2026-11-23. Actual drawing: Ming check 1.
- [x] Seat state is shown by a sprite overlay, not colour alone, and comes from the derived status — evidence: `placement.test.ts` "cannot and mine seats emit their state sprites from the real atlas"; `map-view.test.ts` "seat state comes from seatViews, missing entry defaults to empty"; `public/sprites/office.json` holds the `avatar.*`, `state.cannot` and `state.mine.tint` frames; the server derives state in `src/lib/sprites/seat-view.ts`.
- [x] Name tags appear only on hover or keyboard focus, at every zoom — evidence: `SeatOverlay.test.tsx` "tag classes are the same at zoom 2, 3 and 4" and the existing hidden-at-rest test. Real hover and focus: Ming check 2.
- [x] A click, or the keyboard, opens the seat panel, and a seat code in the URL opens it on load — evidence: native `<button>` with `onClick` at `SeatOverlay.tsx:43`; the map and table share `openSeat` (`SeatsPage.tsx:63,178,180`); `SeatDetailPanel.test.tsx:109`. Browser flow: Ming checks 2 and 3.
- [x] Zoom and pan work at 390 px and on desktop, and the map is usable in dark mode — code and unit evidence only: `zoom.test.ts`, `paint.test.ts` guards, `RoomMap.test.tsx` zoom control test, focusable scroll region at `RoomMap.tsx:91-93`. Real behaviour is in the plan's Ming verification (checks 1, 5, 6).
- [x] All existing seat actions stay reachable, including for seats without a placement — evidence: `SeatsView.test.tsx:152` "renders the map slot above the table and keeps every table row"; `RoomMapSection.test.tsx` unplaced note; the table and `SeatActions` are unchanged; map and seat list share the 500-seat limit (`LAYOUT_LIMITS.seats = SEAT_LIMITS.list`).
- [x] Unit tests cover the mapping from the API payload to the map's view data — evidence: `map-view.test.ts` (9 cases); `seats-api.test.ts:52,59`.

**Ming verification after merge** (not verified by the reviewer; full steps in `plan.md`):
1. Desktop and 390 px phone: pan on both axes, switch 2x/3x/4x.
2. Keyboard: Tab through seats, tag on focus, Enter opens, Esc returns focus to the same map seat; same from a table row.
3. Click a seat: `?seat=<code>` in the URL; reload keeps the panel open.
4. Assign, release, set and clear cannot-seat from the map panel: the overlay updates without a reload.
5. Light and dark mode: border, zoom buttons, name tag and focus ring are visible.
6. A 40 x 40 room has limited zoom and is not blank on iPhone Safari; a 64 x 64 room shows "too large" and the table works.

### Issues
No blockers.

#### Issue 1 — 🟡 should-fix — focus return on Safari (from code reading, not reproduced)
- **Where**: `src/ui/seats/SeatDetailPanel.tsx:157,164`
- **Expected**: closing a panel opened by tapping a map seat keeps the user at that map seat.
- **Actual**: the opener is read from `document.activeElement`, but Safari does not focus a button on click or tap. `previous` is then `body`, so focus goes to the table row and the page can jump away from the map.
- **Fix instruction**: confirm during Ming check 2 on iPhone Safari. If it reproduces, focus the map button in its click handler before calling `onSelect`, or pass the opener code to the panel.

#### Issue 2 — 🟡 should-fix — `useRoomLayout` has no direct test (R5)
- **Where**: `src/ui/seats/useRoomLayout.ts:26-40`
- **Expected**: new logic has tests.
- **Actual**: the stale-response guard and keep-map-on-error branch are covered by code review only. The plan listed no test for the hook, and the repo has no hook test setup (`useRoomSeats` has none either); `keepRowsOnError` is an existing helper. Not treated as a blocker for that reason.
- **Fix instruction**: extract the state transition into a pure function with unit tests, in a follow-up.

### Rules (CLAUDE.md)
No violations found. R1 confirmed by `check:layers`. R2, R3, R6 and R7 are not touched (no server, API, schema or env change). R4: every product file is in the plan; `work/ming-todo.md` is the M-25 approval item from the workflow commits `b905fd0` and `578cceb`, not implementation scope. R5: see Issue 2.

### Blockers from review agents
None. No review trigger path changed, so no review agent applies.

### Nits (do not block)
- `src/ui/roomlayout/RoomMap.tsx:25`: `border-error/40` has no effect, because `border-outline-variant` comes later in the built CSS with equal specificity. The error view has the neutral border.
- `src/ui/roomlayout/RoomMap.tsx:71`: one failed paint sets a permanent error until page reload, including at a higher zoom where 2x might still work.
- `RoomMapSection` retry shows no progress while the request runs.

### Follow-ups (out of scope)
- **Unresolved test flake**: identify the one-off failure reported in `impl-log.md`. Investigation was stopped on Ming's instruction on 2026-11-23. Start with repeated runs under CPU load and with `scripts/dev-process.test.ts`.
- Viewport-only rendering for rooms over the canvas budget (Ming's approved default: `debt` issue).
- Mouse drag-to-pan (Ming's approved default).
