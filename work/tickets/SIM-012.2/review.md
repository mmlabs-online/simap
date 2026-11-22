## Attempt 1 — 2026-11-22
Verdict: REWORK

Scope judged: slice 1, the read path. Write actions, role gating, the member picker and the room switcher are deferred to
the proposed SIM-012.3 and SIM-012.4 and are not counted as missing.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, `All matched files use the correct format.`
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, `332 files, no violations`
- `pnpm test` — exit 0, `Test Files 135 passed (135)`, `Tests 1359 passed | 3 skipped (1362)`. Matches impl-log.
- `pnpm build` — exit 0, `/rooms/[roomCode]` listed as dynamic
- `pnpm test:db` — not run, as instructed. The diff has no `src/server`, API route, SQL or migration file.

Scratch harness (outside the repo, nothing added to it): the real `useRoomSeats`, `panelView` and `SeatDetailPanel` effects
were driven by a minimal fake React hook runtime, and the real `SeatsView` by `renderToStaticMarkup`. This is evidence for
state logic only. It is not a browser. No dev server, database, token or browser was used.

| Run | Scenario | Result |
|---|---|---|
| S1 | Unknown room with `?seat=` | `resolution: missing`, `panel: loading`, 0 list calls: **stuck** |
| S2 | `GET /api/rooms` fails with `?seat=` | `resolution: error`, `panel: loading`: **stuck** |
| S3 | Seat list 503 with `?seat=`, press panel Try again | 0 list calls, 0 detail calls, still error: **dead button** |
| S4 | Two list responses out of order | newest kept: OK |
| S5 | Detail A then B, A resolves last | B shown: OK |
| S6 | Response after unmount | no render: OK |
| S7 | Close and reopen the same seat | first commit shows **old** data, then loading, then new |
| F1 | URL-opened panel, close | production path focuses the row; **StrictMode dev focuses `main`** |
| V1 | Room deleted (list 404) | not-found card **and** error alert **and** Try again |

### Acceptance criteria
- [x] 1. Room page lists every seat (code, status, occupant, devices) — `SeatsView.test.tsx` "renders a row per seat", "shows deviceCount, not devices.length"
- [x] 2. Row targets `?seat=<code>`; open state comes only from the URL — `seat-view.test.ts` `seatHref`, `parseSeatParam`; `SeatsPage.tsx:22,40,45` (push on open, replace on close, `scroll: false`). Real history behaviour is B1.
- [ ] 3. Unknown room code shows not-found — FAILED with `?seat=` (Issue 1) and for a room deleted after load (Issue 3). Passes for a plain `/rooms/NOPE`.
- [x] 4. Seat code not in this room shows not-found in the panel — `panelView` tests; the id comes only from this room's list (`useRoomSeats.ts:77-78`), so a seat from another room is never fetched
- [ ] 5. Loading, empty, error and `truncated` states — FAILED on the panel error path (Issue 2). The table states pass.
- [x] 6. SEA-05 panel fields — `SeatDetailPanel.test.tsx` "shows all SEA-05 fields", "has no edit control for tags"; `SeatDetailPanel.tsx:43-97`
- [x] 7. Cannot-seat reason clipped, status still derived — `SeatDetailPanel.tsx:56-61`, `statusView` tests
- [x] 8. Status not colour alone — icon plus text, `SeatsView.tsx:133-142`, `SeatDetailPanel.tsx:45-54`, test "status has text for each state"
- [ ] 9. 390 px and keyboard — code read is fine for the native button, scroll region and sheet, except Issues 5 and 6. Real behaviour is B2 and B3.
- [x] 10. Unit tests for the `?seat` parser, API client reads and view states — 62 tests in the touched files pass. The fixes below need new `panelView` cases.
- [x] 11. Project checks and rules — all green; `no-literals.test.ts` included

Checked and correct:
- `<Suspense>` wraps the only component that calls `useSearchParams` (`SeatsPage.tsx:20,55-65`).
- `key={roomCode}` remounts all state on a room change (`page.tsx:9`).
- Esc and native `cancel` both route through `onClose`, so the URL stays the source of truth (`SeatDetailPanel.tsx:157-160`).
- List and detail counters drop stale responses (S4, S5, S6).
- A capped device list cannot hide the primary device, because the server sorts primary first (`seats.ts:118`). `deviceCount` drives "+N more" in the table and panel.
- `seats-api.ts` is GET only. No write action shipped. No `@/server` import, pixel style, canvas or sprite in `src/ui/seats`. Copy is in `src/ui/copy/seats.ts`.

### Issues
#### Issue 1 — 🔴 blocker — Not-found / error path
- **Where**: `src/ui/seats/seat-view.ts:105-111`, `src/ui/seats/SeatsPage.tsx:43`
- **Expected**: `/rooms/NOPE?seat=NOPE-01` shows not-found. If the room list fails, the panel shows that error.
- **Actual**: the seat list is never requested, so it stays `loading`, and `panelView` returns `loading` forever. A modal "Loading seat" covers the page and makes its not-found message or Try again unreachable until closed (S1, S2).
- **Fix instruction**: change to `panelView(param, resolution, list, detail)`. After the `none` and `invalid` checks: `missing` returns `{ kind: "notFound", truncated: false }`, `error` returns `{ kind: "error", code }`, `loading` returns `{ kind: "loading" }`. Pass `resolution` from `SeatsPage`. Add a `seat-view.test.ts` case for each.

#### Issue 2 — 🔴 blocker — Dead retry button
- **Where**: `src/ui/seats/SeatsPage.tsx:46`, `src/ui/seats/useRoomSeats.ts:69,77-81`
- **Expected**: Try again in the panel retries what failed.
- **Actual**: a list failure sets `seats: []`, so `openId` is null and `retryDetail` returns at once. No request is sent (S3). The page's own retry is inert behind the modal, so the user must close the panel first.
- **Fix instruction**: give the panel a retry that dispatches on the failure: `resolution.kind === "error"` calls `reloadRooms`; `list.status === "error"` calls `reloadSeats`; otherwise `retryDetail`. Put the choice in a small pure function and unit test it.

#### Issue 3 — 🔴 blocker — Deleted room shows contradictory states
- **Where**: `src/ui/seats/SeatsView.tsx:38-39,65-74`
- **Expected**: a list 404 shows only the room not-found state (plan Approach 4).
- **Actual**: the card "Room not found" renders together with the alert "This item was not found." and a Try again that can only get another 404 (V1).
- **Fix instruction**: read the list error only when the room is found: `resolution.kind === "error" ? resolution.code : resolution.kind === "found" && list.status === "error" ? list.errorCode : null`. Add a `SeatsView.test.tsx` case with `resolution: missing` and a `not_found` list error that asserts no alert and no retry.

#### Issue 4 — 🟡 should-fix — Stale detail on reopen
- **Where**: `src/ui/seats/useRoomSeats.ts:80-96`
- **Expected**: the panel never shows earlier data as current (SEA-05: "always shows current data").
- **Actual**: closing keeps the old detail. Reopening the same seat commits it as `ready` before the effect sets `loading` (S7).
- **Fix instruction**: when `openId` becomes null, increment `detailCounter` and reset to `EMPTY_DETAIL`. This also invalidates a request still in flight.

#### Issue 5 — 🟡 should-fix — Focus return for a URL-opened panel in dev
- **Where**: `src/ui/seats/SeatDetailPanel.tsx:133-144`, with `reactStrictMode: true` at `next.config.ts:7`
- **Expected**: after a refresh with `?seat=`, closing focuses that row (plan B2).
- **Actual**: StrictMode's mount replay runs the cleanup while no row exists, focusing `main`. The second run saves `main` as `previous`, so closing focuses `main` (F1). Production takes the correct path, but B2 would fail under `pnpm dev`.
- **Fix instruction**: on cleanup, prefer the row matching `codeRef.current`, then a connected non-body `previous`, then `#main`.

#### Issue 6 — 🟡 should-fix — Pressing empty panel space closes it
- **Where**: `src/ui/seats/SeatDetailPanel.tsx:161-168`
- **Expected**: only a press on the scrim closes the panel.
- **Actual**: the dialog is `h-dvh` but its content is only as tall as its fields, so a press below the content has `target === dialog` and is treated as a scrim press. At 390 px the sheet is full width, so this is the empty lower part of the screen. The dialog's scrollbar may hit the same path (needs a browser to confirm).
- **Fix instruction**: close only when both pointer positions fall outside `currentTarget.getBoundingClientRect()`.

#### Issue 7 — 🟡 should-fix — impl-log size is wrong
- **Where**: `work/tickets/SIM-012.2/impl-log.md:53`
- **Expected**: the real size.
- **Actual**: it says about +1,000 lines. `git diff --numstat` shows **+1,332 in `src`: 799 production and 533 test**. The +1,385 figure is `src` plus the 53-line impl-log. The whole branch is +1,765 with work files.
- **Fix instruction**: record the real numbers in the new attempt section.

**Diff size verdict: note it in the PR; it is not a blocker.** Production is 799 lines against about 520 planned (+54%), and tests are 533 against about 300. Every file is in the plan, no write action or extra feature is included, and much of the excess is table and panel markup. Splitting further would leave a page without its panel. The PR should state the real numbers.

### Rules (CLAUDE.md)
No violations found. R1 by `pnpm check:layers` and imports; R2, R3, R6 and R7 not touched; R4 no out-of-plan file. R5 is not met until the blockers above are fixed.

### Blockers from review agents
None. No configured review trigger path changed.

### Nits (do not block)
- `src/ui/copy/seats.ts:34`: `1 more devices are not shown.` needs a singular form.
- `src/ui/seats/SeatsView.tsx:45`: a long unknown room code from the URL has no wrap or clip in the `h1`, which can overflow at 390 px.
- `src/ui/seats/SeatsView.tsx:19`: move `CLIP` to a shared file if SIM-012.3 needs it (already in impl-log).

### Ming verification after merge (carry into the PR)
Not run by the reviewer; these need a real browser.
- **B1 URL:** open a row, Back closes it, Forward reopens it, refresh restores it, close button clears `?seat`, row scroll position is kept.
- **B2 Keyboard:** Tab to a row, Enter opens the panel, focus is trapped, Esc closes it and focus returns to that row. After a refresh with `?seat=`, closing focuses that row. For a not-found seat, closing focuses `main`.
- **B3 390 px and desktop:** table scrolls sideways (also by keyboard), panel is a full-width sheet, a long reason and stacked combining marks stay clipped inside the panel, light and dark themes.
- **B4 Not-found:** `/rooms/NOPE`, `?seat=NOPE-01`, and a seat code from another room.

### Follow-ups (out of scope)
- Create SIM-012.3 and SIM-012.4. This PR must not close the full ticket scope: add and delete, assign and replace, release, cannot-seat, role gating, picker and room switcher remain.
- SIM-012.3: a failed reload currently clears the rows (`useRoomSeats.ts:69`). Keep them once reloads follow writes (plan Approach 4).
- Reject room codes `.` and `..` in `src/lib/validate/room.ts` (plan assumption 6).
