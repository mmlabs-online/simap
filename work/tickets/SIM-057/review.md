## Attempt 1 — 2026-11-26
Verdict: PASS

Reviewed commit 4a397c7 ("SIM-057: check-in room view and home page per role") on branch `claude/modest-allen-yru4g8`
(HEAD 6871f1d only changes ticket.md).

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0, "Types generated successfully"; "check-layers: 902 files, no violations".
- `pnpm test` — exit 0, "Test Files 344 passed | 1 skipped (345)"; "Tests 3409 passed | 7 skipped (3416)". Same as impl-log.
- `pnpm build` — exit 0, "Compiled successfully"; route table lists `ƒ /`, `ƒ /checkin`, `ƒ /dashboard`.
- `pnpm test:db` — CI only; no DB, query or route-handler change in this diff.

### Acceptance criteria
- [x] A User lands on the check-in room view after sign-in and org choice — evidence: `src/app/(app)/page.tsx` renders
  `HomePage`; `src/ui/checkin/HomePage.tsx:9-13` picks by `homeFor(tier)`; `HomePage.test.tsx` › "user sees the
  check-in view at /"; `nav.test.ts` › "homeFor: user → checkin, manager/admin → dashboard". `SignInRoute` replaces to
  `returnTo` (default `/`), so `/` decides.
- [x] Manager and Admin keep the Dashboard and have a "Check in" nav entry opening the same view — evidence:
  `nav.ts:33` item `checkin` (`minTier: "user"`, rail; one `<nav>` serves rail and bottom bar); `nav.test.ts` ›
  "user: check in at / first … manager/admin: dashboard at /, check in at /checkin second";
  `AppShellView.test.tsx` › "manager has /checkin with label Check in; user's first link is / …" and admin href list
  with `/checkin`; `HomePage.test.tsx` › "manager/admin see the dashboard at /"; `/checkin/page.tsx` and the User's `/`
  both render `CheckinPage`.
- [x] Room map with LAY-06 overlays, zoom, pan, seat detail on click; "Who's here" beside / below at 390 px; room
  switcher; floating button slot — evidence: `CheckinPage.tsx:124-131` reuses `RoomMapSection` with `onSelect`,
  `CheckinPage.tsx:155-175` `SeatDetailPanel` via `?seat=`; `CheckinView.tsx:60-73` grid
  `lg:grid-cols-[minmax(0,1fr)_300px]` with the labelled section after the map; switcher `RoomSwitcherView` with
  `checkinGoTarget`; `CheckinButtonSlot` (`data-slot="checkin-button"`). Tests: `CheckinView.test.tsx` (4 tests),
  `room-switcher.test.ts` › `roomCodeFromQuery` / `checkinRoomHref` / `checkinGoTarget`. Shell switcher hidden on the
  view: `AppShell.tsx:37-41` + `nav.test.ts` › `isCheckinView`. Browser check at 1280/390 px not run (impl-log says
  so too); listed for Ming below.
- [x] First-room rule and PRE-02 no-seat empty state — evidence: `src/lib/checkin-room.ts:14-24` (active → most
  recent with a seat → lowest seat room code → `noSeat`); `checkin-room.test.ts` (9 `firstRoom` + 3 `shownRoom`
  tests); `CheckinView.test.tsx` › "noSeat state shows the PRE-02 copy and a Request a seat link to /rooms".
  Check-in inputs are empty until SIM-058 (`CheckinPage.tsx:54-62`), as the ticket allows.
- [x] Unit tests cover the first-room rule and nav/home per tier — evidence: `pnpm test` green with the tests above.

Ming verification after merge (from plan.md, carry into the PR):
- At 390 px on a real phone: the floating button slot and the "Who's here" panel do not cover the map's zoom controls
  or the bottom bar; the bottom bar with 6 (User) / 8 (Manager) / 12 (Admin) entries stays usable. (plan.md says 11
  for Admin; the code and `nav.test.ts` give 12 items for Admin.)
- Sign in as User (lands on the view), as Manager/Admin (Dashboard + "Check in" entry); layout at 1280 px and 390 px.

### Scope
Every changed source file is in plan.md's file table; work files are the ticket's own. No High path touched
(checked against `.claude/loop.config.md` → High paths). No out-of-plan files.

### Issues
#### Issue 1 — 🟡 should-fix — stuck loading state
- **Where**: `src/ui/checkin/CheckinPage.tsx:63-67` with `src/lib/checkin-room.ts:33-35`.
- **Expected**: when the URL has `?room=<code>` and the room list request fails, the view shows an error with a retry
  (or falls back to the first room).
- **Actual**: `roomCodes` is `null` whenever `rooms.status !== "ready"`, so `shownRoom` returns `loading` for a
  requested code; on a room-list error the view shows the skeleton forever and nothing calls `rooms.reload()`.
- **Fix instruction** (next touch of this file, e.g. SIM-058/060): when `rooms.status === "error"` and `requested !==
  null`, set the view state to `{ kind: "error", code: rooms.errorCode ?? "internal", onRetry: () => void
  rooms.reload() }`; add a case to `CheckinView`/page tests if a container test exists.

### Rules (CLAUDE.md)
No violations found. R1: `src/lib/checkin-room.ts`, `nav.ts`, `room-switcher.ts` import only `@/lib`/relative lib;
UI imports `@/lib` and `../`; pages import `@/ui`; `check:layers` clean. R2/R6/R7/R3: no schema, query, route-handler
or config change. R4: no presence data, popup, polling or tags. R5: checks green, new logic tested. D36: copy in
`src/ui/copy/checkin.ts` and `shell.ts`.

### Blockers from review agents
None.

### Nits (do not block)
- `shellCopy.pages.checkin` (`src/ui/copy/shell.ts:101`) is not used anywhere; the view uses `checkinCopy.title`.
- `src/ui/checkin/CheckinView.test.tsx` "noSeat" test hard-codes the escaped English strings instead of using
  `checkinCopy.noSeatTitle` / `requestSeat`.
- When `mySeats` fails but `?room=` names a valid room, the error state replaces a map that could be shown.
- `room-switcher.test.ts` › `roomCodeFromQuery` builds `"A.1_b-2".toUpperCase()`; a literal would read clearer.

### Follow-ups (out of scope)
- `/api/me` seats summary to replace the N+1 `loadMySeats` on the home page (from plan/impl-log).
- `CheckinPage` and `useRoomSeats` each fetch the room list; share one `useRooms`.
- Tidy `docs/spec-v1.md` SHL-01 line 665 ("home page stays the Dashboard"), which D76 and line 667 amend.
- Assumption to confirm with Ming: Users keep a Dashboard entry at `/dashboard`.
