## Attempt 1 — 2026-11-26
Verdict: PASS

Reviewed the combined diff `origin/main...HEAD` (commit A 9e2e217d + commit B 50e04e3a), 37 files, +2263/-31.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (1013 files)
- `pnpm typecheck` — exit 0, next typegen + `tsc --noEmit`, no errors
- `pnpm check:layers` — exit 0, `check-layers: 958 files, no violations`
- `pnpm test` — exit 0, `Test Files 364 passed | 1 skipped (365)`, `Tests 3549 passed | 9 skipped (3558)` (includes `src/ui/no-photo-on-map.test.ts`)
- `pnpm build` — exit 0, `Compiled successfully`
- `pnpm test:db` (local docker Postgres, throwaway DB) — exit 0, `Test Files 23 passed (23)`, `Tests 365 passed (365)`

All match the impl-log numbers.

### Acceptance criteria
- [x] Every member sees presence in every room (who, time, source; no hidden presence) — server side is SIM-058 (merged). Client: `CheckinPage.tsx:123` takes `roomPresence.data.members` unfiltered (only the room-id guard) into `seatPresenceMap` and `whosHereRows` (`:229`); `whos-here.test.ts › keeps every member the API returns, in API order, including members whose seat is not on the map`, `checkinTime › shows HH:mm in UTC+7`, `› source is passed through…` pass.
- [x] Present: seated character + monitor on; away: empty chair + grey tag; unassigned as today; never colour alone — `placement.ts` avatar loop skips frames for `away`, emits `screen` ops for `present` monitors only; `placement.test.ts › presence view (PRE-06)` (4 tests, incl. "presence undefined gives the ops of a call without the option"); `paint.test.ts › screen op fills its rect`; `SeatOverlay.test.tsx › always mode: away tag has data-presence=away, the ring marker and the grey style; present has the filled dot; labels end here/away`. State is carried by shape (filled dot vs hollow ring), the drawn/empty chair and the aria-label word, not colour alone. Typing idle is a static pose by the approved plan (Q4, moved to SIM-061).
- [x] "Who's here" lists checked-in members (head, name, seat code, time, source); selecting focuses the seat — `WhosHere.test.tsx` (4 tests); `RoomMap.tsx:108-121` focus effect keyed on `focusSeat.n`, queries `[data-map-seat]` with `CSS.escape`, `focus()` + `scrollIntoView`. Rendered fields are only display name, seat code, `<time>`, source label and the pixel head (no photo, no Avatar import).
- [x] Open tags on my other seats in the room; click/keyboard moves presence (PRE-03) — `open-tags.test.ts` (3), `SeatOverlay.test.tsx › open tags: one real button per open seat, a sibling of the seat buttons, disabled while busy`; move goes only through `presenceApi.move` = `PATCH /api/me/presence {seatId}` (`presence-api.ts:69`, idempotent, so `apiFetch`'s one re-send is safe); double-click guard `usePresenceMove.ts:26` (`running` ref) plus `disabled={openTagsBusy}` (`SeatOverlay.tsx:200`); `move.test.ts` (4) shows no retry on 409/422/other.
- [x] Polls every 30-60 s, no websockets, pauses while hidden — `poll.ts`: 45 s base, 60 s after a failure, stale after 2; `setTimeout` chain, one load in flight (`poll.ts:46`), hidden → no timer, visible → load when due else remainder, dispose drops late results; `poll.test.ts` (9) pass. `usePresencePoll.ts` listens to `visibilitychange` only, disposes on room change/unmount; stale answers from the old room are dropped by `useRoomPresence`'s request counter and by the `data.roomId === roomId` guard (`CheckinPage.tsx:123-124`).
- [x] Tags always visible here, no overlap on adjacent seats, full name on hover/focus; other views keep D50 — `tag-layout.test.ts` (7); `SeatOverlay.test.tsx › always mode…`, `› the hover and focus tag holds the code and the full name without truncate`; `› default mode (no tags prop): no always-visible tag, no open tag (D50)`. Default `tags = "hover"` (`SeatOverlay.tsx:82`) keeps the old class string, `truncate` and aria-label; `SeatsPage.tsx:211` and `RoomMapDemo.tsx` pass no `presenceView`, so they render as before. Existing SeatOverlay tests are unchanged (no deleted lines) and green.
- [x] Unit tests cover the overlay choice, tag layout for adjacent seats and polling pause/resume — `seat-presence.test.ts`, `tag-layout.test.ts`, `poll.test.ts`, all green in `pnpm test`.

Ming verification after merge (not reviewer-verifiable in node Vitest; carry into the PR):
- Two browsers in one org: A checks in, moves via an open tag, checks out; B sees each change within 60 s. In B's devtools Network tab no `/presence` request while B's tab is hidden, and one right after it becomes visible again (when the last one is over 45 s old).
- PixelHead crop in "Who's here" (head visible in the 32 px circle, not feet/torso).
- Screen glow position on a desk with a monitor (back view: upper half of the screen; front view: strip on the desk edge).
- Name tags at zoom 1-4 and at 390 px width: dense row readable, no overlap, away tag grey with ring, present tag with filled dot.
- Keyboard: Tab to an open tag, Enter moves; selecting a "Who's here" entry scrolls the map and focuses that seat (visible focus ring).

### Issues
None blocking. Two should-fix items, acceptable to land now or in SIM-061 (which edits the same files):

#### Issue 1 — 🟡 should-fix — present marker shown without presence data
- **Where**: `src/ui/roomlayout/SeatOverlay.tsx:34` (`const state = presence ?? "present";`)
- **Expected**: before the first room presence answer, or after an initial error with no data, tags show without a present/away claim (plan Assumption 4: "nobody is wrongly shown away"; the same holds for "wrongly shown present").
- **Actual**: `data-presence` is omitted, but the tag still renders the green filled "present" dot, so every occupied seat looks present until data arrives, and indefinitely if the first read fails. The test `› before the first presence answer…` checks only `data-presence`.
- **Fix instruction**: when `presence` is undefined render the tag with no marker (or a neutral one, e.g. the status dot of the seat state) and extend that test to assert no `data-marker="dot"`.

#### Issue 2 — 🟡 should-fix — a later tag can cover an earlier dot
- **Where**: `src/lib/sprites/tag-layout.ts:98-107`
- **Expected**: no overlap between always-visible tags (AC 6).
- **Actual**: a dot fallback is not pushed into `taken`, so a tag placed later (e.g. "below" for the seat in the row above) can be laid over it. Dots never hit each other, but tag-over-dot is not checked.
- **Fix instruction**: push the dot rect `{x,y,w:DOT,h:DOT}` into `taken`, and add a case to `› impossible density…` with a second row whose tags must not intersect the dots.

### Rules (CLAUDE.md)
No violations found. R1: new `src/lib/**` files import only `@/lib/**` (`placement.ts` → `@/lib/presence/seat-presence` is type-only), `check:layers` clean. R2/R6/R7: no server, schema or route change. R3: no config. R4: every changed file is in the plan's file list; the `open-tags.ts` split and the hook `refresh(): Promise<boolean>` change are justified in impl-log (plan Assumption 1 allows the latter). R5: checks green, new logic tested. D36: all strings in `src/ui/copy/roomlayout.ts` / `src/ui/copy/presence.ts`. No "photo"/Avatar in `src/ui/roomlayout/**`, `src/lib/sprites/**`, `src/lib/presence/**`, `WhosHere.tsx`, `PixelHead.tsx` (grep empty; guard test green).

### Blockers from review agents
None (no review-trigger path changed).

### Nits (do not block)
- `poll.ts:82` `refreshNow` joins a load already in flight; after a move that lands during a poll, the room answer may predate the move, so the map can show the old seat (with an open tag on it) until the next poll (up to 45 s). Planned behaviour, low odds; a "rerun after the in-flight load" flag would close it.
- `CheckinPage.tsx:112-122`: the `mySeatId` effect also fires when the first `useMyPresence` answer arrives (`"none"` → seat id), adding one extra pair of GETs on page load for a checked-in member.
- `usePresenceMove`: `errorCode` is cleared only by the next move, so a move error stays under the map after switching rooms.
- `RoomMap.tsx:121`: a focus request made while the map is still loading is dropped (effect keyed on `focusN` only); the Who's here button can be pressed again.

### Follow-ups (out of scope)
- Typing idle animation and dedicated monitor-on art (SIM-061 / art follow-up, per plan Q4).
- ETag/304 on the presence reads if poll cost grows (two GETs per visible tab every 45 s).
