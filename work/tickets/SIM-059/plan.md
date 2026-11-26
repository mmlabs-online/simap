Status: READY

# Plan — SIM-059: Pixel check-in popup

## Scope summary
`docs/spec-v1.md` **PRE-02 Check-in popup** (lines 703-718):
> - A member with no check-in today (from any source, PRE-04) sees a modal popup over the room view on arrival. It
>   uses the room's pixel style: pixel frame, title bar in the room's wall colour, 3D pixel buttons; body text in the
>   normal (non-pixel) font (D52).
> - It lists every room where the member has an assigned seat. Each entry shows a small layout thumbnail, the room
>   name and code, the member's seat code there, how many members are checked in there now, and the member's last
>   check-in to that room (date and time in UTC+7, D35, or "never").
> - Rooms where the member has no seat are listed below, locked, with "Request a seat", which opens that room's map
>   for the REG-01 flow. No hot-desking: a member never checks in to a seat they do not occupy.
> - Changing the selected room switches the room shown behind the popup.
> - "Check in to <room>" checks in (PRE-03) and closes the popup; the walk-in (PRE-07) plays. "Just look" closes the
>   popup without checking in; the floating "Check in" button stays. The popup shows once per page load; it does not
>   return after "Just look" until the next visit.
> - A member with no assigned seat at all sees an empty state: "You don't have a seat yet" with "Request a seat"
>   (Rooms page). Nothing can be checked in.
> - Keyboard-operable and screen-reader labelled (focus trap, Escape = "Just look"); works at 390 px.

**PRE-01** (line 696-701), the parts this ticket owns: "a floating "Check in" or "Check out" button" and "The room
shown first: the room of today's active check-in; else the room of the member's most recent check-in where they still
have a seat; else their first assigned room by room code" (the presence inputs of `firstRoom`, left empty by SIM-057 at
`src/ui/checkin/CheckinPage.tsx:54-62`).

**PRE-03** (line 720-737): "Check-in names a room ... (422 `no_seat_in_room` otherwise)"; "checking in to another room
while checked in is refused with 409 `already_checked_in` (naming the current room)"; "Check-out ends the active
check-in"; idempotent PUT. The client only calls the SIM-058 endpoints; no server change.

Decisions: D52 ("The pixel/game style is used only on end-user surfaces ..."), D35 ("Times stored in UTC and shown in
UTC+7 (Asia/Ho_Chi_Minh)"), D77 ("checks in to one of them (default: lowest seat code)"), D76 (role homes, PRE-01).

Out of scope (ticket): walk-in animation (SIM-061: this ticket only reaches the end state, i.e. presence updated);
provider skip beyond "no popup when already checked in from any source" (SIM-063). Orchestrator batch decision:
SIM-059 owns the shared client presence data layer (`presence-api.ts`, `useMyPresence`, `useRoomPresence`) and the
`firstRoom` presence wiring; the "Who's here" placeholder, map overlays, polling and open desk tags stay with SIM-060.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | No check-in today (any source) → modal popup on arrival, pixel style (pixel frame, title bar in wall colour, 3D pixel buttons, normal body font) | `checkin-popup.test.ts › autoOpen …` (true only with seats ready, presence ready and null; false while loading, on error, when `presence` is set with source `self` or `provider`, with no seat, while the seat panel is open); `CheckinPopup.test.tsx › renders a <dialog> with px-frame, a bg-px-wall title bar, primary button data-variant=filled inside .px-card, body without px-title/px-heading`. Code read: `CheckinPopup` uses `showModal()` (modal, top layer) |
| 2 | Lists every seat room: thumbnail, name and code, seat code, count checked in now, last check-in (UTC+7 or "never"); rooms without a seat listed below, locked, "Request a seat" opens that room's map | `checkin-popup.test.ts › popupRooms …` (ordering, lowest-seq seat code, count/null, last/null, locked set and order); `room-thumb.test.ts › …`; `CheckinPopup.test.tsx › seat row shows …`, `› last check-in in UTC+7 ("06 Mar 2026, 15:30" for 08:30Z) and "never"`, `› locked rooms after seat rooms, no radio, Request a seat links to /rooms/<code>` |
| 3 | Changing the selected room switches the room behind the popup | `checkin-popup.test.ts › initialSelection …`; code read: `CheckinPopup` radio `onChange` → `onSelect(code)` → `useCheckinFlow` calls `router.replace(checkinRoomHref(pathname, code, null), { scroll: false })`, so `?room=` (and `shownRoom`) change; `CheckinPopup.test.tsx › the radio of selectedCode is checked` |
| 4 | "Check in to <room>" checks in and closes; "Just look" closes without check-in, floating "Check in" stays; once per page load | `checkin-popup.test.ts › popupReducer …` (pending→open once; justLook/checkedIn → closed; closed ignores later auto; skip when already checked in; button can reopen), `› checkInOutcome …`, `› buttonAction …` (presence null after Just look → `checkin`/`openPopup`); `presence-api.test.ts › checkIn sends PUT {roomId} …`; `CheckinButton.test.tsx › …` |
| 5 | No seat at all → "You don't have a seat yet" + "Request a seat" (Rooms page); nothing can be checked in | Existing `CheckinView.test.tsx › noSeat state …` stays green; `checkin-popup.test.ts › autoOpen false with zero seats`, `› buttonAction hidden with zero seats`; `CheckinButton.test.tsx › hidden renders nothing` |
| 6 | Keyboard-operable, screen-reader labelled (focus trap, Escape = Just look), 390 px; component tests cover show/hide, locked rooms, empty state | `CheckinPopup.test.tsx › aria-labelledby/aria-describedby, role=radiogroup via fieldset+legend, native radios, autoFocus on the checked radio, w-[min(32rem,calc(100vw-1.5rem))] max-h-[90dvh], full-width stacked actions below sm, min-h-11 targets`; code read: native `<dialog>` + `showModal()` (focus trap, inert page), `onCancel` → `preventDefault()` + `onJustLook()` (same pattern as `SeatDetailPanel.tsx:194-200`); tests listed under 1, 2, 5 |

## Ming verification after merge
- In a real browser (Chrome and a 390 px wide phone or device emulation): keyboard only — Tab stays inside the popup,
  arrow keys move between room radios and the room behind switches, Escape closes it like "Just look", focus lands on
  the floating button after close; a screen reader reads the title, the intro line and each room row. The node-only
  Vitest setup cannot drive focus or the native dialog.
- Manual flow from the ticket's test plan: a user with two seat rooms sees the popup, checks in, reloads (no popup,
  button shows "Check out"); "Just look" then the floating "Check in" works.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/checkin-popup.ts` | New, pure: `autoOpen`, `popupReducer` + `PopupPhase`, `popupRooms`, `initialSelection`, `buttonAction`, `checkInOutcome`, `firstRoomInputs` | Show/hide, ordering, lock and outcome rules as unit-testable lib code (planner rule 6) | No |
| `src/lib/checkin-popup.test.ts` | New: unit tests for the above | AC 1-5 | No |
| `src/lib/sprites/room-thumb.ts` | New, pure: `roomThumb(layout, mySeatCodes)` → `{w, h, cells[]}` or `null` | Layout thumbnail data (AC 2) | No |
| `src/lib/sprites/room-thumb.test.ts` | New | AC 2 | No |
| `src/ui/checkin/presence-api.ts` | New: `createPresenceApi(apiFetch)` with `mine()`, `checkIn(roomId)`, `checkOut()`, `move(seatId)`, `room(roomId)`; never throws, result shape of `rooms-api.ts` plus `room?` on 409 | Shared client wrapper for the SIM-058 endpoints (batch decision: SIM-059 owns it; `move` is for SIM-060) | No |
| `src/ui/checkin/presence-api.test.ts` | New | Wrapper contract | No |
| `src/ui/checkin/useMyPresence.ts` | New hook: `{status, data, errorCode, reload, refresh, apply}` | Shared "my presence" state; SIM-060 polling calls `refresh` | No |
| `src/ui/checkin/useRoomPresence.ts` | New hook: one room's `RoomPresenceResponse`, `{status, data, errorCode, refresh}`, stale answers dropped | Shared per-room read (batch decision); SIM-060 adds polling around it. Not rendered by SIM-059 | No |
| `src/ui/checkin/usePopupExtras.ts` | New hook: for the seat rooms, while the popup is open, loads `presenceApi.room(id)` (count) and `seatsApi.layout(id)` (thumbnail) in parallel; per-room failure → `null` | Count and thumbnail data (AC 2) | No |
| `src/ui/checkin/useCheckinFlow.ts` | New hook: owns the popup reducer, auto-open effect, check-in/out handlers, error/busy state; returns `popup` and `button` props | Keeps the additions to `CheckinPage.tsx` to a few lines (SIM-060 hotspot) | No |
| `src/ui/checkin/CheckinPopup.tsx` | New pure view on native `<dialog>` | AC 1-4, 6 | No |
| `src/ui/checkin/CheckinPopup.test.tsx` | New, `renderToStaticMarkup` | AC 1, 2, 3, 6 | No |
| `src/ui/checkin/RoomThumb.tsx` | New pure SVG (64×40, `aria-hidden`) from `roomThumb()`; placeholder when `null` | AC 2 | No |
| `src/ui/checkin/CheckinButton.tsx` | New pure view: floating Check in / Check out / Try again button, `pointer-events-auto`, inline error | PRE-01 floating button, AC 4-5 | No |
| `src/ui/checkin/CheckinButton.test.tsx` | New | AC 4, 5 | No |
| `src/ui/copy/checkin-popup.ts` | New copy object `checkinPopupCopy` (D36) | Separate key file so SIM-060 does not edit the same object | No |
| `src/ui/checkin/CheckinView.tsx` | Additive: optional `button?: ReactNode` prop rendered as `<CheckinButtonSlot>{button}</CheckinButtonSlot>` (line 27 signature, line 81); update the slot doc comment (line 14) | Fill the SIM-057 slot | No |
| `src/ui/checkin/CheckinView.test.tsx` | Add one case: `button` renders inside `data-slot="checkin-button"` | Slot wiring | No |
| `src/ui/checkin/CheckinPage.tsx` | Additive: create `presenceApi`, call `useMyPresence`, replace lines 54-62 with `firstRoomInputs` wiring (wait for presence to settle), call `useCheckinFlow`, pass `button` to `CheckinView`, render `<CheckinPopup …/>` as a sibling after it | Wiring (batch decision: SIM-059 owns the `firstRoom` wiring) | No |

No High path is touched (no `src/server/**`, migration, config, `.env.example`). No change to `src/app/globals.css`
(pixel styling comes from the existing `.px-frame` / `.px-card` classes plus Tailwind utilities and `--color-px-*`
tokens), so SIM-060/061 keep that file free.

## Data model / migration
None.

## API contract
None (no endpoint change). The client uses the SIM-058 endpoints as merged:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/me/presence` | — | `MyPresenceResponse` (`src/lib/presence/types.ts:12-16`) | 200, 503 | user |
| PUT | `/api/me/presence` | `{ "roomId": "<uuid>" }` only (`src/lib/validate/presence.ts:17-20`) | `{ presence: MyPresenceDto }` | 200, 400, 409 `already_checked_in` + `room`, 422 `no_seat_in_room`, 503 | user |
| DELETE | `/api/me/presence` | — | `{ presence: null }` | 200 (idempotent) | user |
| PATCH | `/api/me/presence` | `{ "seatId": "<uuid>" }` | `{ presence }` | 200, 409 `not_checked_in`, 422 `seat_not_yours` | user (wrapper only; SIM-060 uses it) |
| GET | `/api/rooms/{id}/presence` | — | `RoomPresenceResponse` | 200, 404 | user |

Count reads: one `GET /api/rooms/{id}/presence` per **seat** room (not locked rooms), only while the popup is open.
No read addition (see Specialist input, decision on counts).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/checkin-popup.test.ts › autoOpen: false while my seats or my presence is loading (no flash for checked-in members)` | AC 1 |
| `… › autoOpen: false when presence is set, for source self and provider (checked in from any source)` | AC 1 |
| `… › autoOpen: false on a presence or seats error; false with zero seats; false while the seat panel is open` | AC 1, 5 |
| `… › autoOpen: true with ≥1 seat, presence loaded and null, no seat panel` | AC 1 |
| `… › popupReducer: pending + auto → open; pending + skip → closed; open + justLook → closed; open + checkedIn → closed` | AC 4 |
| `… › popupReducer: closed + auto stays closed (once per page load, also after a later check-out); closed + openFromButton → open; open + auto is a no-op` | AC 4 |
| `… › popupRooms: seat rooms by most recent check-in desc, then never-visited by room code; first row equals firstRoom() for the same inputs` | AC 2, PRE-01 |
| `… › popupRooms: several seats in one room → lowest seq seat code (D77), one row per room` | AC 2 |
| `… › popupRooms: count from the map, missing/failed → null; lastCheckedInAt from recent or null ("never")` | AC 2 |
| `… › popupRooms: locked = listed rooms without a seat, sorted by code, never contain a seat room; recent entries of locked rooms are ignored` | AC 2 |
| `… › popupRooms: rooms list not loaded → seat rooms still listed (name falls back to ""), locked empty; Vietnamese names (e.g. "Phòng Họp Đà Nẵng") kept verbatim` | AC 2, Domain focus |
| `… › initialSelection: shown room when it is a seat room; else first seat row; no rows → null` | AC 3 |
| `… › buttonAction: presence loading → hidden; presence error → retry; zero seats → hidden; presence set → checkout (also when shown room is another room); presence null + shown is a seat room → checkin {roomId}; presence null + shown not a seat room → openPopup` | AC 4, 5, PRE-01 |
| `… › checkInOutcome: ok → close; 409 already_checked_in → close + refreshPresence; 422 no_seat_in_room → stay + reloadSeats + error code; other code → stay + error code` | AC 4 |
| `… › firstRoomInputs: null data → {activeCheckinRoom:null, recentCheckins:[]}; maps presence.roomCode and recent → {roomCode, at}` | PRE-01 wiring |
| `src/lib/sprites/room-thumb.test.ts › floors become w×h cells, fixtures one cell each, seats one cell, the member's seats (by code) marked mine` | AC 2 |
| `… › cells outside w/h are clipped; w or h < 1 → null (placeholder)` | AC 2 |
| `src/ui/checkin/presence-api.test.ts › mine GETs /api/me/presence and returns the body; a body without workDate/recent array → internal` | wrapper |
| `… › checkIn sends PUT with content-type application/json and exactly {roomId}` | AC 4 |
| `… › checkIn 409 returns {code:"already_checked_in", room}; 422 returns {code:"no_seat_in_room"}` | AC 4 |
| `… › checkOut sends DELETE; move sends PATCH {seatId}; room GETs /api/rooms/<encoded id>/presence and checks members is an array` | wrapper |
| `… › ApiAccessError signed_out → unauthenticated; a thrown fetch → unavailable` | wrapper |
| `src/ui/checkin/CheckinPopup.test.tsx › open=false renders nothing` | AC 4 |
| `… › renders a <dialog> with aria-labelledby the title and aria-describedby the intro; px-frame; title bar bg-px-wall text-on-surface; body has no px-title/px-heading class` | AC 1, 6 |
| `… › one native radio per seat room inside a fieldset with a legend; the radio of selectedCode is checked and has autofocus` | AC 3, 6 |
| `… › seat row shows "<code> - <name>", "Your seat: <seat>", count text ("Nobody here yet" / "1 here now" / "3 here now" / unavailable) and an svg thumbnail` | AC 2 |
| `… › last check-in in UTC+7 ("06 Mar 2026, 15:30" for 2026-03-06T08:30:00Z) and "never"` | AC 2, D35 |
| `… › locked rooms come after the seat rooms in DOM order under their heading, have no radio, and "Request a seat" links to /rooms/<encoded code>` | AC 2 |
| `… › primary "Check in to <code>" has data-variant=filled inside .px-card; "Just look" present; busy → primary disabled + aria-busy; error → role=alert with apiErrorMessage text` | AC 1, 4 |
| `… › 390 px classes: dialog w-[min(32rem,calc(100vw-1.5rem))] max-h-[90dvh], scrolling list, actions full width` | AC 6 |
| `src/ui/checkin/CheckinButton.test.tsx › checkin → "Check in", checkout → "Check out", openPopup → "Check in", retry → "Try again" with role=alert message; all pointer-events-auto, filled inside px-card` | AC 4 |
| `… › hidden renders nothing; busy → disabled + aria-busy; error text role=alert` | AC 5 |
| `src/ui/checkin/CheckinView.test.tsx › button prop renders inside data-slot="checkin-button"` | slot wiring |

## Approach
1. **Pure rules** (`src/lib/checkin-popup.ts`, layer lib, imports only `@/lib/**` such as
   `@/lib/presence/types`, `@/lib/checkin-room`):
   - `type Load = "loading" | "ready" | "error"`.
   - `autoOpen({ seats: Load, seatCount, presence: Load, active: MyPresenceDto | null, seatPanelOpen }): boolean`.
   - `type PopupPhase = "pending" | "open" | "closed"`; `popupReducer(phase, event)` with events `auto`, `skip`,
     `justLook`, `checkedIn`, `openFromButton`. `auto` only acts on `pending`; `skip` only on `pending`.
   - `popupRooms({ rooms: {id, code, name}[], seats: {roomId, roomCode, code, seq}[], recent, counts: Record<string, number | null> })`
     → `{ seatRooms: {roomId, code, name, seatCode, count, lastCheckedInAt}[], locked: {roomId, code, name}[] }`.
     Ordering mirrors `firstRoom` (`src/lib/checkin-room.ts:14-24`): recent desc (invalid dates ignored), then code.
   - `initialSelection(seatRooms, shownCode)`, `buttonAction(...)` returning
     `{kind:"hidden"} | {kind:"retry"} | {kind:"checkout"} | {kind:"checkin", roomId} | {kind:"openPopup"}`,
     `checkInOutcome(result)` returning `{ close, refreshPresence, reloadSeats, errorCode }`,
     `firstRoomInputs(data: MyPresenceResponse | null)`.
2. **Thumbnail data** (`src/lib/sprites/room-thumb.ts`): from `RoomLayout` (`src/lib/sprites/layout.ts:16-22`) build
   cells `{x, y, w, h, kind: "floor" | "fixture" | "seat" | "mine"}`; fixtures and seats are one tile each (footprint
   ignored at thumbnail scale, documented in the doc comment).
3. **Client wrapper** (`src/ui/checkin/presence-api.ts`): copy the `call`/`fail`/`errorCode` pattern of
   `src/ui/rooms/rooms-api.ts:5-49`; the 409 failure also reads `error.room` (`ApiErrorBody`,
   `src/lib/api/error.ts:74`). Only PUT/DELETE/PATCH (all idempotent on the server) are sent, so the one `apiFetch`
   re-send on 401/403 is safe (R7 note in CLAUDE.md).
4. **Hooks**: `useMyPresence` follows `src/ui/portal/useMySeats.ts` (counter, mounted ref, `reload` with loading,
   `refresh` without), plus `apply(presence: MyPresenceDto | null)` to write a PUT/DELETE result into `data.presence`
   without a refetch. `useRoomPresence(api, roomId)` follows `src/ui/seats/useRoomLayout.ts`. `usePopupExtras(presenceApi,
   seatsApi, roomIds, openCount)` loads once per popup opening (key = `openCount`, bumped by the flow on each
   open), with `Promise.all` per room, `null` on a failed room.
5. **Flow hook** (`useCheckinFlow`): inputs `mySeats`, `rooms` (goodRooms), `myPresence`, `presenceApi`, `seatsApi`,
   `shownCode`, `seatPanelOpen` (`openCode !== null`), `navigate(code)`. Holds `useReducer(popupReducer, "pending")`,
   an effect that dispatches `auto` when `autoOpen` is true, or `skip` once seats and presence are both `ready` and
   `autoOpen` is false (already checked in or no seat), so a later check-out never pops it up. Holds `busy` and
   `error` state; `onCheckIn(roomId)` → `presenceApi.checkIn` → `checkInOutcome` → `myPresence.apply` / `refresh`,
   `mySeats.refresh()` on 422, dispatch `checkedIn` on close. Floating button: `checkin` → same handler with the shown
   room; `openPopup` → dispatch `openFromButton`; `checkout` → `presenceApi.checkOut()` then `apply(null)`;
   `retry` → `myPresence.reload()`. Never closes the popup before the request succeeds.
6. **Views**:
   - `CheckinPopup` (pure; props `open`, `seatRooms`, `locked`, `thumbs`, `selectedCode`, `busy`, `errorCode`,
     `onSelect`, `onCheckIn`, `onJustLook`). Native `<dialog>` opened by `showModal()` in an effect keyed on `open`,
     closed in its cleanup, focus returned to `[data-slot="checkin-button"] button` else `#main` (pattern
     `src/ui/seats/SeatDetailPanel.tsx:173-186`). `onCancel` → `preventDefault()` + `onJustLook()`. Class
     `px-frame m-auto w-[min(32rem,calc(100vw-1.5rem))] max-h-[90dvh] overflow-hidden p-0 bg-surface text-on-surface`.
     Title bar: `bg-px-wall text-on-surface border-b-4 border-px-outline`, `h2` with the title in uppercase tracking
     (no `.px-title`, whose colour is not overridden for dark mode, `globals.css:84` vs `:150`). Body wrapper
     `px-card` (so the primary `Button` gets the 3D style, `globals.css:421-443`) with `overflow-auto
     overscroll-contain`, normal font. Room list: `<fieldset>` + `<legend>` + native `<input type="radio">` rows
     (arrow keys for free); selected row shows a 3 px outline and a check glyph with sr text, not colour alone. Row:
     `RoomThumb`, `checkinCopy.roomHeading(code, name)` with `overflow-wrap:anywhere`, seat code, count text, last
     check-in via `formatAuditTime` (`src/ui/audit/audit-state.ts:41`, Asia/Ho_Chi_Minh). Locked section: heading
     "No seat in these rooms", rows with a placeholder thumbnail, a "Locked" text label and a `Link` to
     `roomDetailHref(code)` (`src/lib/nav.ts:100`). Actions (sticky bottom, stacked full width below `sm`,
     `min-h-11`): primary `Button variant="filled"` "Check in to <code>" (code, not name, because `.px-card`
     uppercases and `Button` is `whitespace-nowrap`); secondary "Just look" as a tonal button with a 3 px
     `border-px-outline` and hard `shadow-[0_4px_0_0_var(--px-shadow)]`, `rounded-none`. Error `role="alert"`.
   - `RoomThumb`: `<svg viewBox="0 0 w h" width=64 height=40 shape-rendering="crispEdges" aria-hidden>`, fills from
     `var(--px-floor)`, `var(--px-wall)`, `var(--px-outline)`, `var(--px-accent)` (mine). Placeholder: wall band over
     floor.
   - `CheckinButton`: renders nothing for `hidden`; else a `span.px-card pointer-events-auto` with a filled
     `Button` (`aria-busy` while in flight) and an optional `role="alert"` line above it.
7. **Wiring** (`CheckinPage.tsx`, additive): `presenceApi = useMemo(createPresenceApi)`; `myPresence =
   useMyPresence(presenceApi)`; `first` is computed when `mySeats.status === "ready"` **and**
   `myPresence.status !== "loading"`, from `firstRoom({ ...firstRoomInputs(myPresence.data), seatRoomCodes })` (on a
   presence error the inputs are empty, as today); `flow = useCheckinFlow({...})` with
   `navigate = (code) => router.replace(checkinRoomHref(pathname, code, null), { scroll: false })`; pass
   `button={<CheckinButton {...flow.button} />}` to `CheckinView`; render `<CheckinPopup {...flow.popup} />` after
   `CheckinView`. Leave the "Who's here" card and its copy untouched (SIM-060). Run `pnpm format` only on touched
   files' content as oxfmt formats; do not reflow untouched regions.
8. Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules: R1 — new `src/lib/**` files import only lib; `src/ui/**` files import ui and `@/lib/**` only (types from
`@/lib/presence/types`), checked by `pnpm check:layers`. R6/R7 — no server change; the client sends only `{roomId}` /
`{seatId}`, never a time or member id. R3 — no config. R4 — `move` and `useRoomPresence` are in this plan by the batch
decision. R5 — tests above. D36 — all strings in `src/ui/copy/checkin-popup.ts` (reuse `checkinCopy.roomHeading`,
`requestSeat`, `noSeatTitle`; error text via `apiErrorMessage`, which already maps `no_seat_in_room`,
`already_checked_in`, `src/ui/copy/api.ts:77-78`).

## Specialist input used
Decisions on the consults' open questions:
- **Wall colour** (FE Q1, UX Q1): use the global `--px-wall` token (`bg-px-wall`). No per-room colour exists in the
  data (`RoomDto`, `src/lib/rooms/types.ts:1-9`; layout has floors/seats/fixtures only) and inventing one is a schema
  change outside the ticket. Title text uses `text-on-surface` (≈15:1 light, ≈11:1 dark) because `--px-title` stays
  dark in dark mode. A per-room colour would be a follow-up if Ming wants it (Assumption 1).
- **Count reads** (FE rec 10, UX Q2): accept one `GET /api/rooms/{id}/presence` per seat room while the popup is
  open; no read addition. A member has few seat rooms (1-3 typical), locked rooms need no count, failures show
  "unavailable" per room. Adding a server read would touch `src/server/**` and widen review for no user-visible gain.
- **Thumbnail form** (FE Q2, UX Q3): a real but simplified SVG mini-map from the room's layout (floors, fixtures, seats,
  the member's seat highlighted), 64×40, `aria-hidden`; fetched per seat room only while the popup is open; locked
  rooms and failures show a generic wall/floor placeholder. AC 2 asks for a layout thumbnail, so a pure placeholder
  would not meet it, and a full sprite render would cost N sprite-sheet renders on canvas.
- **Floating button** (FE Q3, UX Q4): label "Check out" whenever checked in (any room, any source); "Check in" checks in
  directly to the shown room when the member has a seat there, otherwise reopens the popup to choose; hidden with no
  seat at all (the inline no-seat card already explains why); "Try again" when the presence read failed (never offer a
  check-in against unknown state). Direct check-in in the shown room is one click for the common case and cannot hit
  422; reopening the popup covers a locked shown room.
- **Request-a-seat target** (FE Q4, UX Q5): `/rooms/<code>` via `roomDetailHref`. REG-01 starts "From the detail of an
  empty seat" (spec line 529), and the room page map is where the seat panel offers the request; the check-in view's
  seat panel only links "Open in room details" (`CheckinPage.tsx:164-172`).
- **No-seat state** (UX Q6): keep the existing inline card (`CheckinView.tsx:47-55`), no modal: there is nothing to
  choose, and a modal would trap a member who cannot act. The button is hidden, so nothing can be checked in.
- **Owner of the data layer** (FE Q5): SIM-059, per the orchestrator.
- **Managers/Admins and unlinked members** (FE Q6): same view and behaviour for every role (PRE-01). An Admin without a
  linked member already gets the error state from `loadMySeats` (`readOwnMemberId` → `internal`,
  `src/ui/portal/my-seats.ts:50-51`); no popup and no button in that state. Unchanged here.

Adopted: pure lib rules + pure views tested with `renderToStaticMarkup` (FE 1-2, UX 1, 9); no popup before presence
loads (FE 1, UX 1); `useState`/reducer, not storage, for once per page load, and no reopen after a check-out (FE risk,
UX 1); route-driven selection via `router.replace` with `scroll:false` (UX 2, chosen over FE's `router.push` to avoid
one history entry per radio change); native radios in a fieldset (UX 2, FE 6); lowest seat code (FE 1, UX 2 — by
`seq`, as the server orders, `src/server/presence/presence.ts:128`); native `<dialog>` + `showModal()` + `onCancel`
(UX 6, matches the repo's dialogs); 409 → refresh presence and close, 422 → inline error, reload seats, stay open,
others → inline error and retry (UX 3; FE 3 suggested staying open on 409, rejected because the member is in fact
checked in); 390 px sizing and stacked actions (UX 7); separate copy file (FE conflict note); `pointer-events-auto` on
the button (FE 9, UX 8); `button` prop on `CheckinView` plus popup as sibling (FE conflict note).
Rejected: shared `PixelFrame`/`PixelButton` components in `src/ui/pixel/` (FE 7) — the existing `.px-frame`/`.px-card`
classes plus utilities are enough, and a new shared module is not needed by the ACs; SIM-060/061 can extract it if they
need it. Using `.px-strip`/`.px-title` (UX 5) — its squares and text colour do not adapt to dark mode. A `useCheckinData`
refactor of existing hooks (FE) — not needed; the new `useCheckinFlow` holds only new logic.

## Assumptions
1. "Title bar in the room's wall colour" is met with the global `--px-wall` token (light `#eef1f5`, dark `#2a2f37`),
   which is the wall colour of every room drawn today; per-room wall colours do not exist. Spec wording difference to
   report to Ming as a possible follow-up, not blocking.
2. **Hotspot:** `src/ui/checkin/CheckinPage.tsx` and `src/ui/checkin/CheckinView.tsx` are also edited by SIM-060
   (`PLANNING`). By the batch decision SIM-060 is implemented after SIM-059 merges and rebases on it; SIM-059's edits
   are additive (new props, new sibling, lines 54-62 replaced), and the "Who's here" card is not touched.
3. SIM-060 consumes `createPresenceApi` (`room`, `move`), `useMyPresence` (`refresh`, `apply`) and `useRoomPresence`;
   its polling calls `refresh`, which cannot reopen the popup (`popupReducer` ignores `auto` once `closed`, and
   `skip` fires only from `pending`).
4. The walk-in (PRE-07, SIM-061) is not played; after check-in the presence state is updated and the button turns to
   "Check out", which is the end state SIM-061 will animate from.
5. If the URL names a locked room (`?room=X`, no seat there), the popup preselects the first seat room without
   navigating; the first radio change navigates.
6. While the seat panel (`?seat=`) is open on arrival the popup waits; it auto-opens after the panel closes if still
   `pending`.
7. Size: about 650 product lines plus about 450 test lines, above the ~400-line rough guide (see Split proposal).

## Blocking questions
None.

## Split proposal
None required by scope, but the diff is above the ~400-line guide. If the orchestrator prefers two review cycles, split
along a clean seam:
- **Slice A** (unblocks SIM-060): `presence-api.ts` (+test), `useMyPresence.ts`, `useRoomPresence.ts`,
  `firstRoomInputs` + `buttonAction` in `src/lib/checkin-popup.ts` (+tests), `CheckinButton.tsx` (+test),
  `CheckinView.tsx` `button` prop, `CheckinPage.tsx` wiring of the `firstRoom` inputs and the button. Covers PRE-01's
  floating button and first-room rule.
- **Slice B**: the rest (popup rules, `room-thumb.ts`, `usePopupExtras.ts`, `useCheckinFlow.ts` popup part,
  `CheckinPopup.tsx`, `RoomThumb.tsx`, copy, tests). Covers AC 1-6.
Without a split, the implementer commits Slice A first, then Slice B, on the same branch, so the reviewer can read them
in order.
