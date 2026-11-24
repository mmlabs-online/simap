Status: READY

# Plan — SIM-012.2: Room detail page, seat table and seat panel (slice 1 of 3: read path)

> **Read first.** The full ticket is about 1,400 production lines (estimate), well over the ~400-line guide and not a
> size M. This plan covers **slice 1 only**: the read-only room page, table and panel at `?seat=<code>`. Slices 2 and 3
> are in `## Split proposal`, with every open question and verified API behaviour already settled for them.
> **Gate:** no High path is touched, so `Gate` stays `none`. PR risk tier: medium (default, `src/ui/**`).
> No server, API, schema or migration change is needed for any of the three slices.

## Scope summary
Ticket (`work/tickets/SIM-012.2/ticket.md`), parts this slice implements:
> "Room detail page at `/rooms/[roomCode]`, resolving the code to an id from `GET /api/rooms`, with a not-found state."
> "Seat table (code, status, occupant, devices) with loading, empty, error and `truncated` states."
> "Seat panel at `?seat=<code>` with occupant, devices, read-only tags and the cannot-seat reason."
> "a link from the room card to the detail page" · "UI copy in `src/ui/copy/seats.ts`."

Spec (`docs/spec-v1.md`):
> SEA-02 (l.236): "Every view shows a seat as empty or occupied, computed from its occupant."
> SEA-05 (l.252-254): "Any user opens a seat's detail: code, room, status, occupant, primary device, secondary devices
> with their owners, group/project tags." "The detail is addressable by URL (seatMGT `?seat=<code>` drawer) and always
> shows current data."
> SEA-01 (l.232-233): a cannot-seat seat "shows grey with the reason; its status is still derived (D26)."

Decisions:
> D47: "the room detail page lists seats in the clean UI kit, with the seat panel opened from the list (`?seat=<code>`)".
> D52: "room/seat tables ... use the clean UI kit without pixel art."
> D36: UI copy is English, in copy files; names and data keep Vietnamese diacritics.

SIM-012 `## Split proposal` settled defaults used here: 1 (style), 2 (route), 3 (re-key only), 4 (`?seat`), 5 (table),
6 (panel), 12 (read-only tags). They are not decided again.

**Spec versus ticket (spec wins):** the ticket's panel list omits the room and device owners, and does not separate
primary from secondary. SEA-05 requires all three, so the panel shows them.

## Acceptance criteria → verification
Ticket criteria 1 and 2 are met in full here. Criteria 3, 5, 7 and 8 are met for the read path. Criteria 4 and 6 and the
remaining halves move to slices 2 and 3.

| # | Criterion (this slice) | How the reviewer verifies it |
|---|---|---|
| 1 | The room page lists every seat (code, status, occupant, devices) | `SeatsView.test.tsx` › "renders a row per seat", "shows deviceCount, not devices.length" |
| 2 | Choosing a row targets `?seat=<code>`; Back closes; refresh restores | Unit: `seat-view.test.ts` › `seatHref` and `parseSeatParam`. Code read: `router.push` on open, `router.replace` on close, both `{ scroll: false }`, and `open` derived only from the URL. Real behaviour: browser list B1 |
| 3 | Unknown room code shows not-found, with no flash and no seat fetch before it resolves | `seat-view.test.ts` › `resolveRoom` (loading, error, found, missing); `SeatsView.test.tsx` › "not-found state" |
| 4 | Seat code not in this room shows not-found in the panel | `seat-view.test.ts` › `panelView` "code not in list", "truncated list wording", "detail 404"; `SeatDetailPanel.test.tsx` › "not-found" |
| 5 | Loading, empty, error and `truncated` states | `SeatsView.test.tsx` › one test per state |
| 6 | Panel shows code, room, status, occupant, primary and secondary devices with owners, read-only tags | `SeatDetailPanel.test.tsx` › "shows all SEA-05 fields", "no edit control for tags", keeps Vietnamese diacritics |
| 7 | Cannot-seat shows its reason, in a clipped container; status stays derived | `SeatDetailPanel.test.tsx` › "shows reason inside the clip container"; `seat-view.test.ts` › `statusView` "occupied + cannot seat" |
| 8 | Status is not colour alone | `SeatsView.test.tsx` › "status has text for each state" |
| 9 | The page works at 390 px and by keyboard | Code read: native `<button>` in each row, focusable scroll region, full-width sheet classes. Real behaviour: browser list B2, B3 |
| 10 | Unit tests cover the `?seat` parser, API client (reads) and view states | `pnpm test` green with the tests below |
| 11 | Project checks and rules | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `no-literals.test.ts` stays green |

### What each tool can prove
- **Vitest** runs in the `node` environment (`vitest.config.ts:16`) with `renderToStaticMarkup`. The repo has **no jsdom
  and no Testing Library**, and none may be added. So effects, clicks, focus and `showModal` never run in tests. It
  proves pure logic, the API client, and the markup for a given set of props.
- **`pnpm build`** proves types, the bundle and the layer split. It does **not** prove the `<Suspense>` placement: the
  root layout calls `headers()` (`src/app/layout.tsx:19`), so every page renders per request and the static-bailout error
  cannot fire. The reviewer checks that placement by reading `SeatsPage.tsx`.
- **A real browser** is the only proof of list B below.

## Ming verification after merge
Browser list (an agent may run it first if the local setup below works; otherwise it is Ming's manual list):
- **B1 URL:** open a row, Back closes it, Forward reopens it, refresh restores it, close button clears `?seat`, row
  scroll position is kept.
- **B2 Keyboard:** Tab to a row, Enter opens the panel, focus is trapped, Esc closes it and focus returns to that row.
  After a refresh with `?seat=`, closing focuses that row. For a not-found seat, closing focuses `main`.
- **B3 390 px and desktop:** table scrolls sideways (also by keyboard), panel is a full-width sheet, a long reason and
  stacked combining marks stay clipped inside the panel, light and dark themes.
- **B4 Not-found:** `/rooms/NOPE`, `?seat=NOPE-01`, and a seat code from another room.

**Is a local browser run practical? Yes by code reading, but not yet tried.** `pnpm dev:token` is off limits and
Identity cannot be reached, but the server accepts a local issuer outside production
(`src/server/identity/config.ts:25-31`) and reads the bearer from a file named by `SIMAP_DEV_TOKEN_FILE`
(`src/server/http/dev-token.ts:22`). No repo change is needed:
1. Create a throwaway database on the local compose Postgres (`127.0.0.1:5432`), run `pnpm migrate` and `pnpm seed:dev`
   with `DATABASE_URL` pointing at it and `SIMAP_DB_TARGET=local`. Drop it afterwards.
2. From the session scratchpad, serve `/.well-known/jwks.json` on `http://localhost:<free port>` with a throwaway P-256
   key, and sign a token into a scratchpad file: header `ES256`, `typ: at+jwt`; claims `iss`, `aud: "simap"`, `sub`,
   `org`, `org_roles`, `email`, `email_verified: true`, `jti`, `iat`, `exp`. Use seed org
   `00000000-0000-4000-8000-0000000000a1` and seed member 1 `00000000-0000-4000-8200-00a100000001` (occupies `C302-01`).
   Role names come from `src/lib/auth/tier.ts`. The file is re-read per request, so a role swap needs no restart.
3. Start `pnpm dev` with `DATABASE_URL`, `SIMAP_DB_TARGET=local`, `MM_IDENTITY_ISSUER`, `SIMAP_DEV_TOKEN_FILE` and
   `SIMAP_DEV_EXPECTED_ORG` **all set in the process environment**.

**Hard stop:** if `SIMAP_DEV_TOKEN_FILE` is unset, the server falls back to Ming's real token at
`~/.config/simap/dev-token`. Never start the server without it. Never read `.env*`, use port 15432, or run
`scripts/start-dev.*`, `pnpm dev:prod` or `pnpm dev:token`. If any step fails, or the session has no browser tool, stop
and leave B1-B4 to Ming. The harness stays in the scratchpad and is never committed.

Not covered by that run: a real Identity token and real sign-in. Those stay with Ming.

## Files to create / modify
No file matches a High path.

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/app/(app)/rooms/[roomCode]/page.tsx` | Replace stub (l.1-12): `await params`, render `<SeatsPage key={roomCode} roomCode={roomCode} />` | Route; default 3 re-key | No |
| `src/ui/seats/seat-view.ts` | Create. Pure: `parseSeatParam`, `seatHref`, `resolveRoom`, `statusView`, `deviceSummary`, `splitDevices`, `panelView` | Pure logic first | No |
| `src/ui/seats/seat-view.test.ts` | Create | Rule 6, ticket AC8 | No |
| `src/ui/seats/seats-api.ts` | Create. `list(roomId)`, `get(seatId)`; same `call`/`errorCode` shape as `rooms-api.ts:9-40` | API client | No |
| `src/ui/seats/seats-api.test.ts` | Create, modelled on `rooms-api.test.ts:5-18` | Ticket AC8 | No |
| `src/ui/seats/useRoomSeats.ts` | Create. Loads list and open-seat detail; drops stale responses (pattern `useRooms.ts:10-31`) | Data loading | No |
| `src/ui/seats/SeatsView.tsx` | Create. Pure page body: header, table, all states | Table | No |
| `src/ui/seats/SeatsView.test.tsx` | Create | Ticket AC8 | No |
| `src/ui/seats/SeatDetailPanel.tsx` | Create. Props-driven native `<dialog>`, with an `actions?: ReactNode` slot for slices 2-3 and no map assumptions | D52, default 6 | No |
| `src/ui/seats/SeatDetailPanel.test.tsx` | Create | SEA-05 fields | No |
| `src/ui/seats/SeatsPage.tsx` | Create. Container: `<Suspense>` around the inner component that calls `useSearchParams`; URL handling | Default 4 | No |
| `src/ui/copy/seats.ts` | Create. All strings of this slice | D36 | No |
| `src/ui/index.ts` | Add `SeatsPage` export after l.22 | Pages import from `@/ui` (R1) | No |
| `src/ui/rooms/RoomCard.tsx` | Link the code in the `<h2>` (l.13) to the detail page; update the "Links nowhere (D47)" comment (l.7) | Ticket scope | No |
| `src/ui/rooms/RoomsView.test.tsx` | Add: card links to `/rooms/C302` | Covers the link | No |
| `src/lib/nav.ts` | Add `roomDetailHref(code): string \| null` beside `roomEditorHref` (l.54) | Shared, handles dot codes | No |
| `src/lib/nav.test.ts` | Add `roomDetailHref` cases | New logic (R5) | No |
| `src/lib/icons.ts` | Add `block` and `event_seat`, keeping alphabetical order (`icons.test.ts:7`) | Status needs text plus icon (default 5); `Icon` accepts listed names only | No |

Estimated size: about 520 production lines and 300 test lines. That is above the 400-line guide, but this is the
smallest slice that gives a working page. Most of it is simple markup.

## Data model / migration
None. No schema change in any slice.

## API contract
No endpoint change. Consumed by this slice, verified against the merged routes:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/rooms` | none | `{ rooms: RoomDto[] }`, capped at 500 (`rooms.ts:69`) | auth codes, 503 | user |
| GET | `/api/rooms/[id]/seats` | none | `RoomSeatsResponse`: `{ room, items, truncated }`; max 500 seats, 20 devices each | 404 `not_found`, 503, auth codes | user |
| GET | `/api/seats/[id]` | none | `SeatDto`, up to 200 devices | 404 `not_found`, 503, auth codes | user |

The write contract for slices 2 and 3 is in `## Split proposal`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `seat-view.test.ts` › `parseSeatParam`: absent and blank are none; valid code; lowercase, over-long, bad charset, repeated param are invalid; 3-digit sequence is valid; room code containing `-` is valid | `?seat` validation and bounds |
| `seat-view.test.ts` › `seatHref`: encodes the code, keeps the path | URL |
| `seat-view.test.ts` › `resolveRoom`: loading, error (not reported as not-found), found, missing, exact match only | Not-found without a flash |
| `seat-view.test.ts` › `statusView`: empty, occupied, each with and without cannot-seat | SEA-02, D26 |
| `seat-view.test.ts` › `deviceSummary`: 0, n, `deviceCount` above `devices.length` gives "+N more" | List cap |
| `seat-view.test.ts` › `splitDevices`: primary and secondary, none | SEA-05 |
| `seat-view.test.ts` › `panelView`: closed, list loading, invalid, not in list, not in truncated list, detail loading, detail for another seat is never shown, detail 404, detail error, ready | Panel states and race |
| `seats-api.test.ts` › paths encode ids; `list` and `get` parse; error code read from body; `ApiAccessError` maps (`signed_out` to `unauthenticated`); network error is `unavailable`; bad JSON is `internal` | API client |
| `SeatsView.test.tsx` › loading, empty, error with retry, not-found, truncated notice, row per seat, deviceCount, status text, Vietnamese name intact, row button carries `data-seat-code` | View states |
| `SeatDetailPanel.test.tsx` › all SEA-05 fields, reason in clip container, no tag edit control, not-found, loading, error, renders `actions` slot | Panel |
| `nav.test.ts` › `roomDetailHref`: normal code; `.` and `..` return null; `A..B` is valid | Dot-segment edge case |
| `RoomsView.test.tsx` › card links to the detail page | Link |

## Approach
1. **Pure first.** Add `roomDetailHref`, the two icons, `copy/seats.ts`, `seat-view.ts`, `seats-api.ts`, and their tests.
2. **`parseSeatParam(values: string[])`** takes `searchParams.getAll("seat")`. Rule: `^[A-Z0-9._-]{1,32}-\d{2,10}$`,
   using `ROOM_LIMITS.code`. Never echo an invalid value into the page.
3. **Route.** Compare the raw `roomCode` param exactly with `room.code`. Do not call `decodeURIComponent`: valid codes
   need no decoding, and a stray `%` would throw.
4. **`useRoomSeats`.** Reuse `useRooms` with `createRoomsApi` to resolve code to id. Do not call the seats endpoint until
   the room resolves. A 404 on the list means the room was deleted, so show the not-found state. Fetch the detail each
   time a seat opens, so the panel shows current data (SEA-05). Use separate request counters for list and detail. Keep
   previous rows during a retry, keyed by `seat.id`.
5. **`SeatsView`.** Real `<table>` with an sr-only caption, a native `<button data-seat-code aria-haspopup="dialog">` in
   the code cell, status as icon plus text, and a focusable labelled scroll region (`tabIndex={0}`).
6. **`SeatDetailPanel`.** Native `<dialog>` following `EntityFormDialog.tsx:42-70`: `showModal` in an effect, `onCancel`
   with `preventDefault` calling `onClose`, scrim click closes. Full-width sheet at 390 px, `overflow-y-auto`, height in
   `dvh`. On close, focus the saved element if it is still connected and not `body`; otherwise the row with that
   `data-seat-code`; otherwise `#main` (`AppShellView.tsx:158-159` already has `tabIndex={-1}`).
7. **Clip user text.** The reason goes in a container with `overflow-hidden`, a `max-h`, `[contain:paint]` and
   `[overflow-wrap:anywhere]`, because the validator allows combining marks. Occupant and device names use the same
   overflow clip.
8. **`SeatsPage`.** The exported component renders `<Suspense fallback={table skeleton}>` around the inner one.

Rules: **R1** `src/ui/seats` imports only `@/lib` and `src/ui`; no `@/server`. **R2** no migration. **R3** no config.
**R4** stay inside this list. **R5** tests above, all checks green. **R6** org scoping stays on the server; org switch
remounts page state (`DevGate.tsx:192`, `AuthGate.tsx:620-622`). **R7** no route handler changes. Copy lives only in
`src/ui/copy/seats.ts`, with no new library.

## Specialist input used
`consult-frontend-developer.md`, checked against the code.

**Confirmed and adopted:** tiers per route; bad bodies are 400; `POST` seats returns `201 {items}`; `DELETE` returns 204;
`expectedOccupantId` is mandatory; list and detail device caps; `deviceCount` for the table; `useRooms` stale-drop
pattern; a `RoomSwitcher` passed to a pure shell by prop; rows stay mounted during reload; `{ scroll: false }`; focus
fallback; sibling (not nested) dialogs; a resend on 401/403 is safe because `withAuth` refuses before the handler
(`with-auth.ts:69-70`).

**Corrected:**

| Consultant claim | What the code does | Effect |
|---|---|---|
| `seat_not_empty` can come from any write (l.23, l.85) | `seatConflict` matches only FK `devices_seat_fkey` (`pg-error.ts:6`), which only deleting a seat can hit here | **Delete-only.** The existing message is correct; no per-action wording needed |
| Remove cannot get `occupant_changed` (l.16) | It can, if someone else now sits there (`rules.ts:26`) | Slice 3 handles it |
| Release refusal means "the seat changed" (l.17) | Already-empty seat is a **200 no-op** (`rules.ts:37`). `not_allowed` only means someone else sits there | Slice 2 handles both |
| Remove always changes the seat | Already-empty seat is a **200 no-op** (`rules.ts:25`) | Treat as success and reload |
| "jsdom has no real showModal" (l.95) | The repo has no jsdom at all; tests run in `node` | Test plan limited accordingly |
| `pnpm build` proves Suspense (l.40, l.82) | Every page is per-request (`layout.tsx:19`), so the build passes either way | Reviewer checks by reading |
| Switcher fits the header slot (l.36, rec. 5) | At 390 px the header has about 45 px left: four 44 px icon buttons, a 40 px avatar, padding and brand | Slice 2 uses a thin bar under the header |
| Keeping action buttons mounted preserves focus (l.52) | Release and Remove **disappear** after success, and a `disabled` button cannot take focus; `EntityFormDialog.tsx:49` then focuses nothing | Slices 2-3 need a focus fallback to the panel heading, and no `disabled` as a busy marker |

**Rejected:** patching the list row from a write response (default 9 already reloads; saves little). Showing the reason in
the table (the panel is enough, and it keeps untrusted text out of dense rows).

**Native dialog stacking, verified by reading:** `showModal` on a sibling `<dialog>` stacks correctly, and Esc reaches
only the top one. `EntityFormDialog` handles `cancel` but has no native `close` listener. That is safe because `onCancel`
always calls `onClose`, even when the browser makes `cancel` non-preventable. Needs the real-browser check in slice 2.

## Assumptions
Non-blocking, each with the default taken:
1. **Split accepted.** The orchestrator or Ming creates SIM-012.3 and SIM-012.4 from `## Split proposal`. If Ming prefers
   a different cut, this slice still stands.
2. **Manager who is also the occupant (slice 3):** sees **Release** and not Remove. The ticket requires Release on a
   `mine` seat, both clear the seat, and the audit row correctly says `seat.release`. Replace stays available.
3. **Switcher on the edit route (slice 2):** shown, with the current room selected. Choosing another room goes to
   `/rooms/<code>` (default 3).
4. **Switcher scope (slice 2):** on every signed-in page, listing all rooms, because SHL-01 places it in the shell.
5. **Room code match is exact.** `/rooms/c302` is not-found; the app only generates canonical uppercase links.
6. **Room codes `.` and `..`** pass the validator (`validate/room.ts:13`), but a browser collapses them out of a URL, so
   their detail page is unreachable. The card shows them as plain text. **Follow-up:** reject them in the validator
   (out of scope here).
7. **History:** default 4 (push on open, replace on close) leaves one extra history entry after closing by button, so
   Back then stays on the room page once. Accepted as settled.
8. **Limits:** a seat beyond the 500-seat list shows a not-found panel with the truncation wording. A room beyond the
   500-room cap reads as not-found. Both are far above expected use.
9. **`DevGate`:** no separate render test of `SeatsPage` under it; the page only uses `useApiFetch`.
10. **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board, so no rebase is expected. SIM-013,
    SIM-014 and SIM-016 will later extend the panel through its `actions` slot.

## Blocking questions
None.

## Split proposal
| Slice | Scope | Est. production lines |
|---|---|---|
| **SIM-012.2 (this plan)** | Read path: page, table, panel, `?seat`, not-found, card link | ~520 |
| **SIM-012.3** (depends on .2) | Room switcher; Admin add and delete; occupant Release; role gating; first stacked dialog | ~430 |
| **SIM-012.4** (depends on .3) | Manager: member picker, assign, replace with re-ask, remove, set and clear cannot-seat | ~470 |

If Ming wants less, cut the room switcher first: nothing else depends on it.

### Settled for SIM-012.3 and SIM-012.4
Branch on `error.code`, never on status. Reload after every success and after any 404, 409 or 422 (default 9).

| Action | Request | Success | Refusals → UI |
|---|---|---|---|
| Add (Admin) | `POST /api/rooms/[id]/seats {count}`, 1..50 | 201 `{items}`; reload | `not_found` → room not-found |
| Delete (Admin) | `DELETE /api/seats/[id]` | 204, no body; close panel, focus the next row or the Add button | `seat_not_empty` → message, seat stays; `not_found` → close and reload |
| Assign (Manager+) | `PUT .../occupant {memberId, expectedOccupantId: null}` | 200 `SeatDto` | see re-ask below; `member_not_assignable` (422) → reload picker, keep dialog; `seat_cannot_seat` → close, panel shows reason |
| Replace (Manager+) | same, `expectedOccupantId` = shown occupant | 200 | same |
| Remove (Manager+) | `{memberId: null, expectedOccupantId: shown}` | 200 (also when already empty) | `occupant_changed` → reload, show message, **never retry on its own** |
| Release (`mine`) | `POST .../release` | 200 (also when already empty) | `not_allowed` → reload, say the seat changed |
| Cannot-seat (Manager+) | `PATCH .../cannot-seat {cannotSeat: true, reason}` or `{cannotSeat: false}` | 200 | `not_found` → close and reload |

- **Gating:** Admin: add, delete. Manager+: assign, replace, remove, cannot-seat. `seat.mine`: Release. UX only.
- **Delete on a non-empty seat:** if the shown seat has an occupant or device, show the message in the panel and send
  nothing. The server refusal covers the race.
- **Confirmation:** Delete, Remove and Release go through one small confirm dialog, because a released seat cannot be
  taken back without a new request.
- **Replace re-ask** (pure function, unit tested). Keep the shown occupant's id and name in one snapshot, so the text and
  `expectedOccupantId` cannot disagree. On `occupant_changed`, refetch the seat, then: a new occupant → ask again with
  that name; now empty → ask a plain assign confirm; already the chosen person → close, done; now cannot-seat → close and
  show the reason; refetch failed → show the error and send nothing. **Never resend without a new confirmation.**
- **Spec note:** SEA-03 says "any member", but the server and the SIM-012 ticket allow only active members. The picker
  uses `status=active`.
- **Reason field:** single-line input, validated with `validateCannotSeat` from `@/lib/validate/seat`, because the API
  returns only a generic 400. A textarea would fail: newlines are refused (`validate/seat.ts:12`).
- **Picker:** lives in the action dialog, list with its own `max-h` in `dvh` and `overflow-y-auto`, because
  `EntityFormDialog` has `overflow-hidden` and no scrolling body (l.71). **Enter in the search box must not submit the
  form** (form at l.86). "Load more" is `type="button"`. `q` max 80 characters. Show name plus employee code.
- **Switcher:** a thin bar under the header with a native `<select>` and a **Go** button. Do not navigate on `change`:
  on Windows, arrow keys on a closed select fire `change`, which would jump rooms on each key press. Keep it mounted and
  refetch rooms when `pathname` changes, so new rooms appear. Takes a `roomSwitcher?: ReactNode` prop, so
  `AppShellView.test.tsx` still renders without it. Remove the empty slot at `AppShellView.tsx:124-125`.
- **Back with an action dialog open:** derive the dialog from the URL's seat, so it closes with the panel. A write in
  flight still reloads when it finishes.
- **Focus after an action:** if the opener is gone, focus the panel heading (`tabIndex={-1}`).
- **Until SIM-013,** the UI cannot clear a seat's devices, so the delete message for a seat with devices has no in-app
  fix yet.
