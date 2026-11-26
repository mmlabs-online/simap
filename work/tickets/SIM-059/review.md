## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
Diff reviewed: `git diff origin/main...HEAD` (commits 6e731f82 slice A, 210fce41 slice B), 19 source files, no High path.
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0 (route types generated, tsc clean)
- `pnpm check:layers` — exit 0, "check-layers: 940 files, no violations"
- `pnpm test` — exit 0, "Test Files 357 passed | 1 skipped (358); Tests 3501 passed | 9 skipped (3510)"
- `pnpm build` — exit 0
- `pnpm test:db` (local docker Postgres, throwaway DB) — exit 0, "Test Files 23 passed (23); Tests 365 passed (365)"

These match the numbers in impl-log.md.

### Acceptance criteria
- [x] AC1: a member with no check-in today (any source) sees a modal popup on arrival, in pixel style. Evidence: `checkin-popup.test.ts › autoOpen` (4 cases: loading, self/provider presence, error/zero seats/seat panel, true case); `CheckinPopup.test.tsx › renders a <dialog> … px-frame; title bar bg-px-wall text-on-surface; body has no px-title/px-heading`; `› primary … data-variant=filled inside .px-card`. Code: `CheckinPopup.tsx:41-53` calls `showModal()`. The wall colour is the global `--px-wall` token (Assumption 1, Ming Q3).
- [x] AC2: rows show the seat rooms with thumbnail, name and code, seat code, count and last check-in (UTC+7 or never); locked rooms come below with "Request a seat" linking to `/rooms/<code>`. Evidence: `checkin-popup.test.ts › popupRooms` (5 cases, including lowest-seq seat and Vietnamese names); `room-thumb.test.ts` (2 cases); `CheckinPopup.test.tsx › seat row shows …`, `› last check-in in UTC+7 ("06 Mar 2026, 15:30" …) and "never"`, `› locked rooms come after … /rooms/Z%2F9`. Counts are loaded only for seat rooms and only while the popup is open (`usePopupExtras.ts:221-244`, `openCount === 0` guard).
- [x] AC3: changing the selected room switches the room behind. Evidence: `CheckinPopup.tsx:105` radio `onChange` calls `onSelect`, which is `navigate` (`useCheckinFlow.ts:302`). `navigate` is `router.replace(checkinRoomHref(pathname, code, null), { scroll: false })` (`CheckinPage.tsx`). The selection follows `shownCode` through `initialSelection` (tested). `CheckinPopup.test.tsx › … the radio of selectedCode is checked`.
- [x] AC4: "Check in to <room>" checks in and closes the popup; "Just look" closes it without checking in and keeps the button; the popup shows once per page load. Evidence: `checkin-popup.test.ts › popupReducer` (2 cases: `auto`/`skip` act only on `pending`, so a closed popup never reopens itself), `› checkInOutcome`, `› buttonAction`; `presence-api.test.ts › checkIn sends PUT … exactly {roomId}`; `CheckinButton.test.tsx`. Code: `useCheckinFlow.ts:216` `wantsSkip` moves the popup to `closed` once both reads are ready and the member is checked in or has no seat. A later check-out or SIM-060 `refresh` therefore cannot reopen it. The popup closes only after a successful answer or a 409 (`useCheckinFlow.ts:253-264`). The phase lives in `useReducer` with no storage, so a reload gets a fresh "pending" phase.
- [x] AC5: a member with no seat sees "You don't have a seat yet" with "Request a seat", and nothing can be checked in. Evidence: existing `CheckinView.test.tsx › noSeat …` is still green; `autoOpen false with zero seats`; `buttonAction … zero seats -> hidden`; `CheckinButton.test.tsx › hidden renders nothing`.
- [x] AC6: keyboard and screen-reader support, plus component tests for show/hide, locked rooms and the empty state. Evidence: `aria-labelledby`/`aria-describedby`, fieldset + legend, native radios and the 390 px classes are tested in `CheckinPopup.test.tsx`. Code: native `<dialog>` + `showModal()` (focus trap, inert page). `onCancel` calls `preventDefault()` and then `onJustLook()` (`CheckinPopup.tsx:63-66`). The checked radio is focused after `showModal()` (`:45`). On close, focus returns to the floating button, or to `#main` if there is no button (`:46-52`). Real focus, Escape and 390 px behaviour cannot be tested in node; see the manual checks below.

Focus areas requested by the orchestrator:
- **SIM-060 interfaces match plan.md.**
  - `createPresenceApi(apiFetch)` exposes `mine`, `checkIn(roomId)`, `checkOut`, `move(seatId)` and `room(roomId)`. It never throws. Its result has the `rooms-api` shape `{ok,value}|{ok:false,code}` plus `room?` on a failure (`presence-api.ts:4-80`).
  - `useMyPresence(api)` returns `{status, data, errorCode, reload, refresh, apply}`. `refresh` keeps the data when it fails, and `apply` bumps the counter so in-flight reads are dropped.
  - `useRoomPresence(api, roomId)` returns `{status, data, errorCode, refresh}` and drops stale answers by counter.
  - All three match the plan.
- **409/422 handling.**
  - 409 `already_checked_in`: the popup closes and `myPresence.refresh()` runs. The wrapper reads `error.room`, which matches the server body `{error:{code,room}}` (`src/app/api/me/presence/route.test.ts:102-106`).
  - 422 `no_seat_in_room`: the popup stays open, `mySeats.refresh()` runs and an inline `role="alert"` shows the message.
  - Other codes: the popup stays open with the inline error.
  - On the floating button, the error shows only while the popup is closed.
- **Only idempotent calls (R7 resend).**
  - The flow sends only GET, PUT `{roomId}`, DELETE and PATCH `{seatId}`.
  - A repeated PUT to the same room returns the existing row (`src/server/presence/presence.ts:143`, `decision === "same"`), and DELETE is idempotent.
  - No time or member id is sent from the client.
- **"Who's here" placeholder untouched.** `src/ui/copy/checkin.ts` is not in the diff. The `CheckinView.tsx` changes only add the `button` prop and slot child, and the `CheckinPage.tsx` changes are additive wiring only.
- **Deviations in impl-log.** All three are acceptable:
  - Focus moves to the checked radio in an effect after `showModal()`, because React `autoFocus` does not work before the dialog is shown.
  - `buttonAction` checks zero seats before a presence error, so a member with no seat never sees "Try again".
  - `skip` fires only when the member is checked in or has no seat. A seat panel open on arrival keeps the popup pending, which is plan Assumption 6.

### Issues
None blocking.

### Rules (CLAUDE.md)
No violations found.
- R1: `check:layers` is clean. The new `src/lib/**` files import only lib, and the ui files import ui and `@/lib/**` only.
- R2/R3/R6: no server, schema or config change.
- R7: idempotent writes only.
- R4: every changed file is in the plan's file list.
- R5: checks are green and the new logic has tests.
- D36: the new strings are in `src/ui/copy/checkin-popup.ts`.

### Blockers from review agents
None. No review-trigger path changed.

### Nits (do not block)
- `useRoomPresence.ts:30-33`: with `roomId === null` the hook stays at `status: "loading"` indefinitely. SIM-060 should treat a null room as "no room", or the hook could expose an idle state then.
- `CheckinPopup.tsx:48-51`: if "Just look" or Escape is pressed while a check-in is in flight, the floating button is disabled (`busy`). `focus()` on it then fails, and focus falls to `<body>` rather than `#main`.
- The `wantsAuto`/`wantsSkip` composition in `useCheckinFlow.ts:207-226` has no direct test. The node setup cannot render hooks, and the reducer and `autoOpen` underneath it are tested.

### Manual checks for Ming (after merge, real browser; node Vitest cannot drive focus or `<dialog>`)
1. In Chrome, as a member with two seat rooms and no check-in today, open the check-in view. The popup appears once the page loads, and there is no flash for a member who is already checked in.
2. Keyboard only:
   - Tab and Shift+Tab stay inside the popup.
   - Focus starts on the checked room radio.
   - The arrow keys move between rooms, and the room behind the popup changes each time.
   - Escape closes the popup like "Just look", and focus lands on the floating "Check in" button.
3. Screen reader (NVDA or VoiceOver): it reads the dialog title "Check in" and the intro line, the group legend "Your rooms", and each row's name, seat, count and last check-in. The selected row is announced.
4. At 390 px wide (device emulation or a phone): the popup fits without horizontal scroll, the list scrolls inside it, the buttons stack full width, and long Vietnamese room names wrap.
5. Click "Check in to <code>". The popup closes, and the button shows "Check out". After a reload there is no popup.
6. Click "Just look". The popup closes and the floating "Check in" stays. Clicking it checks in directly when you have a seat in the shown room; otherwise it reopens the popup. After a check-out on the same page, the popup does not come back by itself.
7. Click "Request a seat" on a locked room. It opens `/rooms/<code>`.
8. As a member with no seat: the "You don't have a seat yet" card is shown, with no popup and no floating button.

### Follow-ups (out of scope)
- A per-room title-bar wall colour needs per-room data that does not exist yet (Assumption 1, Ming Q3).
- `useRoomPresence` should get an explicit idle state for `roomId === null` if SIM-060 needs one.
