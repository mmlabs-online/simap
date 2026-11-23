## Consult report SIM-015.3 (frontend)

### Findings

**Renderer (`src/ui/roomlayout/`)**
- `RoomMap({ layout, seatViews, zoom })` (client component, exported via `index.ts`) loads the atlas, builds `buildDrawList`, and paints a canvas at an integer zoom via `paintRoom`. It renders `SeatOverlay` over it. The outer div is `role="region"`, `overflow-auto overscroll-contain`, so native scroll already gives a basic pan.
- Its props are only `layout`, `seatViews` and `zoom`. There is NO selection callback. `SeatOverlay` renders one `<button>` per seat, in reading order, with an aria-label of code, state and name. The buttons have no `onClick`, so a click does nothing today. Name tags already show only on hover or focus-visible (`group-hover` / `group-focus-visible`).
- The loading and error states are exported as `RoomMapStatus`. Atlas failure and a missing 2D context both lead to the error view.
- Overlay sprites (mine tint, cannot, pending) and the avatar come from `buildDrawList` and `overlayFor`. State is therefore drawn as a sprite and not by colour alone. This is partly met already; a test should assert it.
- Gaps to close:
  - The region is not focusable. The tag is clipped by overflow, but `tagPlacement` handles edges.
  - There is no `aria-pressed` or current marker on the seat button.
  - Touch pan relies on native scrolling.
  - There is no zoom control. The zoom buttons exist only in `src/app/dev/roommap/RoomMapDemo.tsx` and can be lifted from there. They use `ZOOM_LEVELS` and `roomlayoutCopy.zoomLabel` / `zoomOption`.
- **Canvas cap (SIM-015.1 finding 4) is NOT handled.**
  - `paintRoom` sets `canvas.width = bounds.w * zoom` with no cap.
  - `bounds` is the union of the room grid (up to 64 tiles, 32 px each, so 2048 px) and all sprite rects. It can exceed the grid and its origin can be negative.
  - 2048 px × 4 = 8192 px per side, about 268 MB.
  - Browsers cap canvas area. Safari and iOS cap at about 16.7 M px, and Chrome's limit is around 268 M px. A failed size means `getContext` returns null or a blank canvas, and `paintRoom` only reports false when there is no context.
  - The cap logic belongs in a pure `lib` function, for example `maxZoomFor(bounds)`, using something like 16 M px of area as the budget. It must clamp the chosen zoom (also if the room grows between loads) and disable the unavailable zoom buttons.
  - Alternative: viewport-only rendering. That is larger and not required.

**Layout API and types (`src/lib/sprites/layout.ts`)**
- `GET /api/rooms/{id}/layout` (`withAuth`, `tier: "user"`, `no-store`) returns `LayoutResponse`: `{ room: {id, code, name}, version, saved, layout: RoomLayout, seatViews: Record<seatId, SeatView>, unplaced: {id, code}[], truncated }`.
- `seatViews` is keyed by seat id. The URL uses the seat code, so the code-to-id lookup goes through `layout.seats[].code` or `list.seats`.
- Seats without a placement come back in `unplaced`. For an unsaved room the server computes a default layout (`resolveLayout`), so `saved: false` still yields a drawable layout.
- `SeatView` uses `mine` and `cannot` already. `pending` is not emitted until SIM-014.
- **There is no UI client for this endpoint.** `seats-api.ts` and `rooms-api.ts` use the pattern `createXApi(apiFetch)` with a `call()` that returns `{ok, value} | {ok:false, code}` and never throws. Add `createLayoutApi` or a `layout` method, in `src/ui/roomlayout/layout-api.ts` or `src/ui/seats/`, with a response-shape validator like `json(isObject...)`. Check at least `layout`, `seatViews` and `Array.isArray(unplaced)`. A bad shape returns `internal`.
- `GET` takes the room UUID. `useRoomSeats` already resolves `roomId` from the room code. Fetch the layout after `roomId` is known.

**Room page (`src/ui/seats/SeatsPage.tsx`, `SeatsView.tsx`)**
- `SeatsPageInner` owns the URL (`?seat=`, via `parseSeatParam` and `seatHref`), `useRoomSeats` (room, seat list, detail), `SeatDetailPanel` (native `<dialog>`, modal), `SeatActions`, and the dialogs.
- `SeatsView` is a pure props-driven component. It shows the header, notices, the loading, error and empty states, and a seat table. Each row is a `<button data-seat-code aria-haspopup="dialog">` that calls `onOpen(code)`, which does `router.push(seatHref(pathname, code))`.
- Opening by `?seat=<code>` on load already works. The panel resolves the seat from the seat list and fetches its detail.
- All actions (assign, release, delete, cannot-seat, add) hang off the panel or the Add button, never off the table. Keeping the table and the panel therefore keeps every action reachable. Seats without a placement stay usable through the table (and optionally an "unplaced" list).
- The post-delete focus code looks up `[data-seat-code=...]` with `document.querySelector`. If the map buttons also carry `data-seat-code`, the selector can hit a map button first. Use a different attribute on the map (for example `data-map-seat`).
- Seat detail comes from `/api/seats/{id}` (SEA-05). The map's `seatViews` is a derived summary that can go stale. After an action (`refresh()` runs `reloadSeats` and `refreshDetail`), the map must refetch the layout too. Wire the layout reload into `refresh`, or into an effect keyed on `list.seats`. Otherwise the map shows stale state after assign, release or cannot-seat. This is a likely regression point.
- Add and delete seat change the unplaced and seat sets, so those paths need the layout reload as well.

### Recommendations
1. **Wire the click handler.** Add `onSelect(code: string)` or `onSelect(seatId)` to `RoomMap` and `SeatOverlay`, and set `onClick` on the seat buttons. In the page, call the same `router.push(seatHref(...))` as the table (AC4). Add an optional `selectedCode` prop and `aria-pressed` or `aria-current` for the open seat. Pass `list.seats` through for the code-to-id mapping if needed.
2. **Add a pure mapping module** in `src/lib/sprites/` (for example `map-view.ts`, or `src/ui/roomlayout/`). It validates and maps `LayoutResponse` to the map's view data: `{layout, seatViews, unplaced, truncated, saved}`, with an `unknown` guard. Cover it with unit tests (AC7): placed seats, unplaced seats, missing `seatViews` entry (defaults to empty), `truncated`, `saved: false`, and mine/cannot/occupied/empty.
3. **Add `useRoomLayout(roomId)`**. It uses a stale counter (same pattern as `useRoomSeats.listCounter`) and has `reload()`. `SeatsPageInner` calls it from `refresh`, `onAdd` and `onDeleted`. Drop stale responses, keep the old map on a transient error, show the error with a retry on a first-load failure (reuse `RoomMapStatus` / `apiErrorMessage` and `seatsCopy.retry`).
4. **Place the map above the table** inside `SeatsView` in its own `Card`. Add props `map?: ReactNode` or `mapSlot` to keep `SeatsView` pure. Keep the table unchanged. List `unplaced` seats in the table, and show a short note with copy like "N seats have no spot on the map". Keep the table's open buttons.
5. **Zoom and pan.**
   - Make the scroll region `tabIndex={0}`, with focus ring and aria-label `regionLabel`.
   - Zoom buttons: a `role="group"` with `aria-pressed`, copied from `RoomMapDemo`. Default to 2×, and restore the fit state at 390 px by taking min(zoom, cap).
   - Pointer pan: drag with `setPointerCapture` and `touch-action: pan-x pan-y` (so the browser scrolls natively). Keep click vs drag distinct (suppress the click after a drag of more than a few px). Do not break the seat buttons' keyboard and focus scrolling. Add `scroll-padding` so a focused seat is revealed.
   - Persist zoom? Optional (keep it local state).
6. **Canvas cap** as in the Findings (area budget in `lib`, with tests). On failure show `RoomMapStatus error`. `paintRoom` should also guard `canvas.width` over the cap before painting.
7. **Dark mode.** The map's atlas floor and shadows are fixed art. Check the frame, the container border and the tag. The tag (`bg-[rgba(22,27,37,.92)] text-white`) works on both. Use theme tokens for the region border (`border-outline-variant`) and the error text (`text-error`) as `SeatsView` does. `RoomMapStatus` uses raw `border-red-500/40`, so consider tokens. The seat focus outline is `outline-white` plus teal ring. White on a light floor is weak, so consider using `outline-primary` plus a dark inset. Verify visually.
8. **Copy.** Add to `src/ui/copy/roomlayout.ts`: the zoom group label (exists), the unplaced note, a hint for keyboard and pan, and the retry label. `no-literals.test.ts` guards literals in UI files.
9. **Tests (node, static markup).**
   - Mapping and cap functions as pure unit tests.
   - `SeatOverlay` markup: `onSelect` wiring is not testable in static markup, so test that buttons render with the expected `aria-label`, `aria-pressed` and `data-map-seat` attributes.
   - `SeatsView` with a map slot and the unplaced note.
   - Extend `no-literals`.
   - Manual: mobile 390 px, desktop, keyboard Tab through seats, light and dark.
10. **Dev demo.** Update `/dev/roommap` to use the shared zoom control so there is one zoom component.

### Risks
- Stale map after a seat action (see above). The most likely functional bug.
- A large room at 4× exceeds canvas limits (mobile Safari) and fails silently. Needs the cap before shipping.
- Pan drag vs click on seat buttons, and drag vs native scroll on touch. Needs browser testing; Vitest cannot cover it.
- Opening the panel from a map button: focus return after the modal `<dialog>` closes goes to the opener. Check `SeatDetailPanel` restores focus to the button that opened it (the table's button had this; the map button must behave the same).
- Two sets of buttons per seat (map and table) means duplicated tab stops and duplicated `data-seat-code` hits. Use distinct attributes, and consider `tabIndex` handling so keyboard users do not Tab through 2× seats (acceptable if the map is an optional shortcut, but note it).
- `layout.truncated: true` means seats beyond the cap (`SEAT_LIMITS.list`) are missing from the map. Show the existing truncation copy (`seatsCopy.truncated`).
- `bounds` can have a negative origin. Overlay positions use `seat.x - bounds.x`, which is already handled.
- Atlas art is a placeholder. Ming has said the real art comes in SIM-033, so the sprites are not final.

### Open questions (with proposed defaults)
1. Should the map sit above or beside the table at desktop widths? Proposed: above, full width, the table below.
2. Initial zoom? Proposed: 2×, clamped by the cap. Persist in local state only.
3. Should `unplaced` seats appear in a separate "no position" strip? Proposed: only the table plus a note, no separate strip.
4. Canvas cap budget? Proposed: 16.7 M px (the Safari limit), implemented in `lib` as `maxZoomFor(bounds)`.
5. Layout reload on action: refetch after each successful action (proposed), or patch `seatViews` locally? Proposed: refetch (simpler, authoritative).

Files looked at: `src/ui/roomlayout/RoomMap.tsx`, `src/ui/roomlayout/SeatOverlay.tsx`, `src/ui/roomlayout/paint.ts`, `src/ui/copy/roomlayout.ts`, `src/lib/sprites/layout.ts`, `src/lib/sprites/placement.ts`, `src/lib/sprites/overlay.ts`, `src/server/layout/layout.ts`, `src/app/api/rooms/[id]/layout/route.ts`, `src/ui/seats/SeatsPage.tsx`, `src/ui/seats/SeatsView.tsx`, `src/ui/seats/useRoomSeats.ts`, `src/ui/seats/seats-api.ts`, `src/ui/seats/seat-view.ts`, `src/app/dev/roommap/RoomMapDemo.tsx`.
