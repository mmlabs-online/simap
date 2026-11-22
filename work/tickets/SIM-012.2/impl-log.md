## Attempt 1 — 2026-11-22

Slice 1 only (read path). No High path, server, API, schema or migration change was needed.

### Files touched
| File | Required because |
|---|---|
| `src/app/(app)/rooms/[roomCode]/page.tsx` | Route: awaits `params`, renders `SeatsPage` keyed by code |
| `src/ui/seats/seat-view.ts` | Pure logic (parser, href, room resolve, status, devices, panel state) |
| `src/ui/seats/seats-api.ts` | Seat read client (`list`, `get`) |
| `src/ui/seats/useRoomSeats.ts` | Loads room, seats and open-seat detail, drops stale responses |
| `src/ui/seats/SeatsView.tsx` | Page body, table and all states |
| `src/ui/seats/SeatDetailPanel.tsx` | Native-dialog panel, `actions` slot, focus return |
| `src/ui/seats/SeatsPage.tsx` | Container: `<Suspense>`, URL handling |
| `src/ui/copy/seats.ts` | All strings of this slice (D36) |
| `src/ui/index.ts` | Export `SeatsPage` for the page (R1) |
| `src/ui/rooms/RoomCard.tsx` | Link the code to the detail page; update comment |
| `src/lib/nav.ts` | `roomDetailHref` |
| `src/lib/icons.ts` | `block`, `event_seat` |
| Tests: `seat-view.test.ts`, `seats-api.test.ts`, `SeatsView.test.tsx`, `SeatDetailPanel.test.tsx`, `RoomsView.test.tsx`, `nav.test.ts` | Plan test list |

### Tests added / changed
- `seat-view.test.ts` › parseSeatParam, seatHref, resolveRoom, statusView, deviceSummary, splitDevices, panelView (all states)
- `seats-api.test.ts` › paths, parse, body-shape check, error code, bad JSON, ApiAccessError, network error
- `SeatsView.test.tsx` › loading, empty, error, failed room load, not-found, truncated, row per seat + `data-seat-code`, deviceCount, status text, Vietnamese
- `SeatDetailPanel.test.tsx` › closed, SEA-05 fields, reason clip container, no tag edit control, not-found, loading/error, actions slot
- `RoomsView.test.tsx` › card links to `/rooms/C302`
- `nav.test.ts` › `roomDetailHref`

### Checks (actual output summary)
- format:check: `All matched files use the correct format.` (exit 0)
- typecheck: `next typegen && tsc --noEmit` exit 0
- check:layers: `332 files, no violations`
- test: `Test Files 135 passed (135)`, `Tests 1359 passed | 3 skipped` (one earlier run failed on a regex escape bug in `seat-view.ts`, fixed)
- build: exit 0, `/rooms/[roomCode]` listed
- `pnpm test:db`: not run (no server or SQL change, as instructed)

### Not verified (left to Ming)
- Browser list B1-B4 (URL history, keyboard and focus return, 390 px layout, themes, not-found pages) was NOT run:
  no dev server was started, by instruction. Effects, `showModal`, clicks and focus are not covered by Vitest
  (node env, static markup). The `<Suspense>` placement is for the reviewer to read in `SeatsPage.tsx`.
- No real Identity sign-in.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Reject room codes `.` and `..` in `src/lib/validate/room.ts` (plan assumption 6).
- `CLIP` is exported from `SeatsView.tsx` and imported by the panel; move to a shared file if SIM-012.3 needs it elsewhere.

### Scope self-check
- Could the diff be smaller? No; this is the plan's smallest working slice.
- Diff size: about +1,000 lines including tests (see `git diff --stat` after commit).

## Attempt 2 (rework) — 2026-11-22

Fixed the 3 blockers and 4 should-fix items of review attempt 1. Nits untouched.

### Files touched
- `src/ui/seats/seat-view.ts` — Issue 1: `panelView(param, resolution, list, detail)` returns notFound/error/loading from the room resolution before the list is consulted. Issue 2: new pure `retryTarget`. Issue 6: new pure `isOutsideRect`.
- `src/ui/seats/SeatsPage.tsx` — passes `resolution` to `panelView`; panel Try again dispatches through `retryTarget` to `reloadRooms`, `reloadSeats` or `retryDetail`.
- `src/ui/seats/SeatsView.tsx` — Issue 3: list error is read only when the room is found.
- `src/ui/seats/useRoomSeats.ts` — Issue 4: when no seat is open, bump `detailCounter` and reset detail to `EMPTY_DETAIL`.
- `src/ui/seats/SeatDetailPanel.tsx` — Issue 5: close prefers the row for `codeRef.current`, then a connected non-body `previous`, then `#main`. Issue 6: scrim close only when both pointer positions are outside the dialog rect.
- Tests: `seat-view.test.ts` (existing `panelView` calls take a resolution; new cases for missing, error and loading resolution, `retryTarget`, `isOutsideRect`), `SeatsView.test.tsx` (deleted room: not-found only, no alert, no retry).

### Checks (run by me, not `test:db`)
- `pnpm format:check` — exit 0, `All matched files use the correct format.`
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, `332 files, no violations`
- `pnpm test` — exit 0, `Test Files 135 passed (135)`, `Tests 1368 passed | 3 skipped (1371)`
- `pnpm build` — exit 0

### Corrected diff size (Issue 7)
- Attempt 2 alone: +148 / -27 in `src` (about +57 production, +91 test).
- Whole ticket, `git diff --numstat main -- src`: **+1,453 in `src`: 841 production and 612 test**. Including work files the branch is about +2,006 lines. The earlier "about +1,000" was wrong.

### Not verified
- Effects (focus return under StrictMode, `showModal`, pointer handling on the dialog, scrim vs scrollbar) are not covered by Vitest, and no browser or dev server was run. Browser list B1-B4 from the review remains for Ming.
- `pnpm test:db` not run, as instructed. No file under `src/server`, API, SQL or migrations changed.

### Out-of-plan files
None.

### Scope self-check
- Only the listed issues were changed; no SIM-012.3 or SIM-012.4 scope.
