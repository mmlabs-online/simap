# Consult — ux-architect — SIM-059

## Findings

Sources read: SIM-059 ticket, spec PRE-01..PRE-03, CheckinView.tsx, CheckinPage.tsx, globals.css (px-* block and reduced-motion), `/api/me/presence`, `/api/rooms/[id]/presence`. I did not read the D52 text (the decisions.md match was too long to display) or the full D76–D83 text, so the D52 points below come from the spec and the ticket.

**Existing seams**
- `CheckinButtonSlot` is an empty fixed container (`pointer-events-none`, bottom-right, above the mobile nav). SIM-059 fills it with the floating Check in / Check out button.
- `CheckinPage.tsx` has the placeholders `activeCheckinRoom: null` and `recentCheckins: []`, with the comment "until SIM-058".
- `getMyPresence` already returns `{workDate, presence, recent[{roomId, roomCode, lastCheckedInAt}]}`, newest first, one entry per room. This covers "member has no check-in today" and "last check-in per room".
- `GET /api/rooms/[id]/presence` returns the members checked in now, so the count per room is `members.length`.
- `PUT /api/me/presence` takes `{roomId}`.
  - It returns 409 `already_checked_in` with `room`, 422 `no_seat_in_room`, and is idempotent.
  - `DELETE` is the check-out.
- `useMySeats` already gives the member's seats with `roomCode`. It does not yet give the seat code per room, the room name, or a thumbnail.

**Gaps**
- The "checked in now" count needs one presence GET per room. That is fine for a handful of rooms, but it is N+1 requests. A small read addition would fix it, for example a `memberCount` on the rooms list or a batch endpoint. Decide this in the plan.
- The thumbnail needs the layout per room (`useRoomLayout` is per room). Loading the full layout for every room is heavy.
  - Option A: render a cheap static thumbnail from the layout data, loaded lazily per entry.
  - Option B: use a generic placeholder in the first version.
- There is no per-room wall colour in the repo. Only the global `--px-wall` / `--px-accent` tokens and `signin-scene` exist. The ticket says "title bar in the room's wall colour" (PRE-02).
  - Use `--px-wall`, or the wall tile colour from the sprite palette (docs/art/style-guide.md lists wall face `#eef1f5`).
  - Do not invent a per-room colour field.
- The sign-in style classes `.px-frame`, `.px-strip`, `.px-title`, `.px-heading` exist. The 3D button style is `.px-card [data-variant="filled"]`, so it only applies inside a `.px-card` wrapper. The popup needs that wrapper or a small shared class.
- `.px-card` buttons turn on `text-transform: uppercase`. A button like "Check in to Studio A" would shout and may wrap. Keep it short, and do not uppercase the room name or code.
- Reduced motion is already global in `globals.css` (a `prefers-reduced-motion` block that zeroes durations). The popup needs no animation of its own. Use no entrance animation, or only an opacity/transform transition, which the global rule neutralises.

## Recommendations

1. **When it shows (PRE-02)**
   - Pure rule in `src/lib/checkin-popup.ts` (testable): show only when `mySeats` and `my presence` are both loaded, `presence === null`, there is no `dismissed` flag, and the state is not loading or error.
   - Use `useState`, not storage, so it shows once per page load.
   - "Just look" and Escape set `dismissed`. A successful check-in closes it.
   - After a successful check-in, update shared presence state so the floating button turns into "Check out". Do not refetch in a way that re-opens the popup.
   - Never show it while loading or on error, or the member would see a wrong prompt.
   - Provider check-ins are already covered, because `presence` is "from any source". SIM-063 adds nothing more here.

2. **Room list and actions**
   - Order the member's rooms in `firstRoom` order: active room, then most recent check-in where they still have a seat, then by room code.
   - Pre-select that first room, and change the room behind the popup on selection.
   - Selection state should drive the same `requested` / selected state as the switcher. Use `router.replace` and keep `scroll: false`. Do not push history entries on each click.
   - Entries are radio-style, as `role="radiogroup"` with native radio inputs styled as pixel rows. This gives arrow-key navigation for free and is better than a list of clickable divs.
   - The primary action is "Check in to <selected room>". The secondary action is "Just look".
   - Locked rooms sit below a heading "No seat in these rooms". They are not radios, are not focusable as a selection, and each has a "Request a seat" link that opens that room's map for REG-01. Check which route the REG-01 flow uses (likely `/rooms/<code>`).
   - Seat code: if the member has several seats in one room, show the lowest code (D77), as the server does.
   - Last check-in text: "never" or an UTC+7 date and time, via the existing D35 formatter. Do not re-implement time zone maths.
   - Checked-in count: show "3 here now" or "Nobody here yet".

3. **Errors**
   - 409 `already_checked_in`: refresh presence and close the popup. Their state was stale, for example a provider check-in just arrived. The error body names the room, so you can switch to that room.
   - 422 `no_seat_in_room`: show an inline error, reload seats, and keep the popup open. Their seat was removed.
   - Other errors: show `apiErrorMessage` inside the dialog with `role="alert"`, keep the button enabled for retry, and disable it while the request is in flight.
   - Do not close the popup before the request succeeds.

4. **No seat state**
   - Same popup shell, or keep the existing `noSeat` card. The spec says a modal-style empty state "You don't have a seat yet" with "Request a seat" (link to `/rooms`).
   - The popup should only appear for a member who could check in. In the no-seat state the floating button should be hidden or disabled with a reason.
   - The no-seat case needs a dismissal too (Escape or a close control), or the member stays trapped.

5. **Pixel styling within D52**
   - Frame: `.px-frame` plus a `.px-strip` title bar using `--px-wall` as its background (or `--px-accent`). Title text colour must keep AA contrast against the wall colour. `--px-title` on `--px-wall` is dark on light and passes. In dark mode `--px-wall` is `#2a2f37`, so check that `--px-title` is overridden for dark.
   - Body on a plain surface in the normal font, with no pixel font, no uppercase and no text-shadow on body text.
   - Buttons: 3D pixel buttons (the filled variant). Make the primary one clearly primary, and the secondary a flatter tonal pixel button.
   - Selected radio row: show a 3 px outline plus a check mark glyph, not colour alone (style-guide: state is never shown by colour alone).
   - Thumbnail: `image-rendering: pixelated`, fixed size (for example 64×40), `alt=""` with the room name in the row text.

6. **Dialog accessibility**
   - Use a native `<dialog>` with `showModal()` if the repo already does so (check an existing modal such as `MapItemArtDialog` or `SeatDetailPanel` and copy that pattern). That gives the focus trap, Escape and an inert background.
   - Otherwise build `role="dialog"` `aria-modal="true"` `aria-labelledby` (title) `aria-describedby` (the intro line), with a hand-rolled focus trap.
   - Escape equals "Just look", handled via the dialog's `cancel` event with `preventDefault` and our own dismissal, so the state stays consistent.
   - On open, focus the selected radio or the primary button. On close, return focus to the floating button or the page heading. Never drop focus to the body.
   - Use `inert` on the page behind if not using `<dialog>`.
   - Announce errors with `role="alert"`. Mark busy state with `aria-busy` on the button.
   - Switching rooms behind the popup should not steal focus. Updating a polite live region ("Showing Studio A") is optional.
   - Do not lock body scroll in a way that breaks iOS. Use `overscroll-behavior: contain` inside the dialog.

7. **Mobile (390 px)**
   - Dialog width `min(32rem, 100vw - 1.5rem)`, `max-height: 90dvh`, with the room list scrolling inside and the action buttons sticky at the bottom.
   - The `.px-frame` drop shadow extends 8 px right and down. Keep a margin of at least 12 px so it is not clipped.
   - Stack the two buttons full width. Touch targets at least 44 px.
   - Rows: thumbnail on the left, text wrapping to 3 lines. Use `overflow-wrap: anywhere` on long room names.
   - The floating button must not overlap the mobile nav (the slot already offsets it).

8. **Floating button (PRE-01 scope)**
   - Label "Check in" when `presence === null`, "Check out" when checked in.
   - Check in from the button reopens the same popup choice if more than one room is possible, or checks in directly if there is one room. Say which in the plan.
   - Check-out calls DELETE and is idempotent.
   - Walk-in (SIM-061) is out of scope. Only expose an `onCheckedIn` callback or state change.
   - The slot has `pointer-events-none`, so the child button needs `pointer-events-auto`.

9. **Copy and tests**
   - All copy in `src/ui/copy/checkin.ts` (D36). Time formatting from `src/lib`.
   - Component tests: show/hide rule (no check-in, checked in, after "Just look", loading, error), room ordering and lock state, Escape, empty state, error mapping (409 and 422), and that "Check in to X" is called with the roomId of the selected room.
   - Put the visibility rule and the room list builder in `src/lib` as pure functions so they can be unit tested without rendering.

## Risks
- N+1 presence calls for the count and layout calls for the thumbnails. Both are cheap for a few rooms but grow with room count. Decide on a read addition or lazy loading in the plan.
- The popup flashing and then closing when a provider check-in lands late. Mitigation: wait until presence has loaded, and handle the 409 above.
- Uppercase `.px-card` buttons with long room names will wrap badly at 390 px.
- The "room's wall colour" has no data source. Using one global colour is a spec wording difference, so flag it to Ming.
- R7: the 401/403 re-send is safe only because PUT check-in is idempotent. Do not add any non-idempotent call to the popup flow.
- Focus trap bugs: if the dialog is hand-rolled, nested portals (for example the SeatDetailPanel opened from the map behind) can compete for focus. Only one overlay should be active. Seat clicks on the map must be blocked while the popup is open.

## Open questions
1. Wall colour: use the global `--px-wall` token, or is there a per-room colour (from the room's layout wall tiles) that should be used? Recommendation: global token.
2. Checked-in count: accept N presence GETs, or add a small read (`memberCount` per room on the my-seats or rooms list)? Recommendation: add the read only if the room count can be large (more than about 8).
3. Thumbnail: a real layout thumbnail, or a placeholder in this ticket with the real one as a follow-up?
4. Should the floating "Check in" button always reopen the popup when more than one room is possible, or check in to the first room directly? Recommendation: reopen the popup, and check in directly when there is one seat room.
5. Where does the REG-01 "Request a seat" link for a locked room go? The room's map in the check-in view (`?room=CODE`), or the Rooms page for that room?
6. Does the no-seat state show as a modal popup or stay as the existing inline card? The ticket's criteria say a message with "Request a seat" and no mention of a modal. Recommendation: keep the inline card and skip the popup, because there is nothing to choose.

Relevant files: `src/ui/checkin/CheckinView.tsx`, `src/ui/checkin/CheckinPage.tsx`, `src/app/globals.css`, `src/app/api/me/presence/route.ts`, `src/app/api/rooms/[id]/presence/route.ts`, `src/server/presence/presence.ts`, `src/server/presence/read.ts`.
