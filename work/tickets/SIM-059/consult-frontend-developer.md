# Consult — frontend-developer — SIM-059

## Findings

Ticket and spec: SIM-059 matches PRE-02, with PRE-01's floating button and PRE-03. Walk-in (SIM-061) and provider skip (SIM-063) are out of scope.

What exists today:
- `src/ui/checkin/CheckinPage.tsx` is the one client container. It holds `useMySeats`, `useRooms`, `useRoomSeats` and `useRoomLayout`, plus the `selected` state and the room switcher.
- Its call to `firstRoom()` still passes `activeCheckinRoom: null` and `recentCheckins: []`, with a comment saying SIM-058 and SIM-060 will supply them. So the presence data is not wired in yet. Whoever wires it first changes the "first room" logic, and both tickets need it.
- `src/ui/checkin/CheckinView.tsx` is a pure view with an empty `CheckinButtonSlot`, a "Who's here" placeholder card, and `state` and `switcher` props. The slot is fixed bottom-right with `pointer-events-none`, so its children need `pointer-events-auto`.
- `src/ui/copy/checkin.ts` already has `noSeatTitle` and `requestSeat`.
- `src/lib/presence/types.ts` defines:
  - `MyPresenceResponse`: `{workDate, presence|null, recent[{roomId, roomCode, lastCheckedInAt}]}`.
  - `RoomPresenceResponse`: `{members[...]}`.
- Routes exist for `/api/me/presence` (GET/PUT/PATCH/DELETE) and `/api/rooms/[id]/presence`. There is no UI client yet; nothing under `src/ui` calls them.

What the popup needs:
- Seat code and rooms: `mySeats.seats` (`roomCode`, seat code). It has no room id, so use `useRooms` to map room code to id and name.
- Member's last check-in per room: `MyPresenceResponse.recent`.
- Whether they are checked in today: `presence != null`. A provider check-in (SIM-063) will arrive through the same field.
- Checked-in count per room: only available through `/api/rooms/[id]/presence`, one call per seat room, taking `members.length`. This is N small requests (a member usually has 1-3 rooms). No bulk read exists.
- Thumbnail: no thumbnail component exists. Layout data comes from `useRoomLayout` (one room at a time), and there is no pixel frame or pixel button component either. `globals.css` has `--px-wall` / `--color-px-wall` tokens (light and dark). The room's "wall colour" for the title bar is probably that token, but I could not confirm per-room colours.
- Vitest is node-only, so "component tests" must be pure-logic tests plus `renderToStaticMarkup` of the pure view, matching `CheckinView.test.tsx`. Focus trap and Escape cannot be tested at DOM level.

## Recommendations

1. **Split the logic out of the component (AC: show/hide rules, locked rooms, empty state).** Add `src/lib/checkin-popup.ts` as pure code with tests. It should provide:
   - `popupRooms({seats, rooms, presence, counts})`: unlocked rooms (those with a seat) and locked rooms. Order each group by room code. Each entry carries seat code (lowest code if several, D77), count, and last check-in or "never".
   - `showPopup({mySeatsReady, presenceReady, presence, dismissed})`: true only when data is ready, there is no active check-in for today, and it has not been dismissed.
   - `formatUtc7(iso)`, using the existing `src/lib/presence/work-date.ts` UTC+7 helpers if suitable.
   - Show no popup until presence has loaded. This avoids a flash for users who are already checked in.
2. **Pure view plus container.**
   - Add `src/ui/checkin/CheckinPopup.tsx` as a pure view taking props and callbacks.
   - Add `src/ui/checkin/presence-api.ts` as a client wrapper (`getMine`, `checkIn(roomCode or roomId)`, `checkOut`, `getRoom`) and a `useMyPresence` hook.
   - Check `src/app/api/me/presence/route.ts` and its validator for the exact PUT body. I did not read the body shape.
   - After a PUT, update state from the returned record, then close the popup.
3. **Handle errors.** 409 `already_checked_in` and 422 `no_seat_in_room` should show an inline `role="alert"` message from the copy file and keep the popup open. Do not retry blindly; PUT is idempotent, so a repeat after 401/403 is safe.
4. **"Just look" and Escape.** Both set `dismissed=true` in component state only, not storage, which gives "once per page load". The floating button stays.
5. **Popup room switching.** The popup's selected room should set the room behind it. Reuse the existing `selected` state and `checkinRoomHref`/`router.push` mechanism, so the `?room=` URL stays the single source of truth. Do not add a parallel state.
6. **Accessibility.**
   - Use `role="dialog"`, `aria-modal`, and `aria-labelledby` pointing at the title.
   - Trap focus and focus the first control on open.
   - Restore focus on close, and put the rest of the page behind `inert`.
   - Make the room list a radio group or listbox, so "Changing the selected room" works by keyboard.
   - The body must scroll inside at 390 px (`max-h-[90dvh] overflow-auto`).
   - Locked rooms get `aria-disabled` plus a link. "Request a seat" is `Link` to `/rooms/<code>` (check `roomDetailHref`).
7. **Pixel style.** Add small shared presentational pieces, such as `PixelFrame` and `PixelButton` in `src/ui/pixel/`, using the `--px-*` tokens. These will also suit SIM-060 and SIM-061. Body text keeps the normal font.
8. **Thumbnail.** Keep it cheap. Either draw a tiny SVG from the layout dimensions and items, or a plain tile-grid placeholder. Do not fetch N full layouts if `listRooms` already returns width and height; the plan should say which. This is the biggest scope risk.
9. **Floating button.** Fill `CheckinButtonSlot` with a Check in / Check out button (with `pointer-events-auto`).
   - Check in uses the shown room.
   - If the member has no seat in the shown room, hide or disable it.
   - Check out calls DELETE.
   - If the member is checked in elsewhere, offer Check out only; PUT would return 409.
10. **Read addition.** Prefer no new endpoint. If N counts calls prove too chatty, add `GET /api/me/presence` rooms summary or a counts field as a small, separately reviewed read, scoped by the token's `org` (R6). It would not be a High-path concern beyond what the ticket already gates.

### Avoiding conflict with SIM-060

Both tickets edit the same `CheckinPage.tsx` and `CheckinView.tsx`. To avoid conflicts:
- **Land the shared presence data layer first, in one place.** Put `presence-api.ts` and the `useMyPresence` / `useRoomPresence` hooks in new files, and wire `firstRoom({activeCheckinRoom, recentCheckins})` once. Whichever ticket merges first owns it; the other rebases. Better: split a tiny enabling commit (data layer plus the `firstRoom` wiring) into whichever ticket goes first, and state that in both plans.
- **Make each ticket's edits to the shared files tiny and additive.**
  - SIM-059 passes `<CheckinPopup .../>` and the button via a new `popup` and `button` prop on `CheckinView`, or renders them as siblings in `CheckinPage`, which only needs a few lines.
  - SIM-060 owns the "Who's here" card, the map overlays, and the polling. It replaces `whosHerePlaceholder`.
  - Neither ticket should reformat the other's regions; oxfmt churn will cause conflicts.
- **Split `CheckinPage` hooks into a `useCheckinData` file only if necessary.** Don't do a refactor in both.
- **Copy:** use separate keys. Put popup strings in a new `src/ui/copy/checkin-popup.ts`, so the two tickets do not edit the same object in `checkin.ts`.
- **State coupling:** the popup sets "checked in" through the shared `useMyPresence` state, so the SIM-060 map picks it up without polling. SIM-060's polling must not reset `dismissed`, and must not make the popup reappear after a "Just look" if presence returns null.
- Make the board state the dependency explicit: either add SIM-059 to SIM-060's "Depends on", or sequence them. Parallel planning is fine; parallel implementation of `CheckinPage` is the risk.

## Risks

- Conflicts in `CheckinPage.tsx` and `CheckinView.tsx` if both tickets are built concurrently.
- A flash of the popup for already checked-in members if it renders before presence loads.
- N room-presence calls for the counts (low impact; keep failures per room non-fatal and show "-" for a failed count).
- The thumbnail and the "room wall colour" are undefined sources. Per-room colour may not exist in the data (only the `--px-wall` token), so a theme token may be the practical choice.
- Focus trap and Escape cannot be asserted in node Vitest. The AC says "component tests cover show/hide rules, locked rooms and the empty state", which is achievable; focus handling needs the manual test.
- Edge case: a member who has seats but whose `/api/me/presence` GET fails. Pick a rule (suggest: no popup, show an error toast, and the button disabled) so we never offer a check-in against unknown state.
- A user who checks out can re-check in the same day (D81); the "once per page load" popup must not reappear on check-out. Suggest keeping it dismissed once shown.

## Open questions

1. Does "the room's wall colour" have a per-room source, or does it mean the `--px-wall` theme token?
2. Thumbnail form: a real mini-render of the layout, or a simplified SVG? What size?
3. Should the floating button be hidden or disabled when the shown room has no seat of the member's, or when they are checked in elsewhere?
4. Is the "Request a seat" target for a locked room `/rooms/<code>` (the REG-01 flow on the room page), and has SIM-057 already fixed that route? The spec says "opens that room's map".
5. Which ticket owns the shared presence data layer and the `firstRoom` wiring: SIM-059 or SIM-060?
6. Is the popup to be shown to Managers and Admins as well (spec PRE-01 says the same view and behaviour), and does an Admin with no linked member record see the button at all? PRE-03 requires a linked, active member record, so the plan should specify the unlinked state.
