Status: READY

# Plan — SIM-015.3: Read-only pixel room map on the room page

## Scope summary
- Spec `docs/spec-v1.md` L365-367 **Room view (all roles)**: "`/rooms/<code>` shows the saved pixel layout read-only with LAY-06 overlays, zoom and pan (works at 390 px), and opens the seat detail (SEA-05) on click or keyboard focus."
- Spec L357-363 **LAY-06**: "Each seat shows its state with a sprite overlay, not colour alone: empty, occupied (a pixel avatar sits there), mine (highlight), cannot-seat (blocked sign), pending request (marker)." ... "Name tags appear only on hover or keyboard focus, at every zoom (D50)." (Devices and pending marker are out of scope per the ticket and D58.)
- Spec L327-336 **Visual style**: "Sprites scale by whole numbers only (2×, 3×, 4×, `image-rendering: pixelated`). No game engine or new library: DOM or plain canvas (stack unchanged)." "One map per room in v1" (D49).
- Spec L251-255 **SEA-05**: "The detail is addressable by URL (seatMGT `?seat=<code>` drawer) and always shows current data." "Actions in the panel show only to roles allowed to use them."
- D50: "Name tags on the map appear only on hover or keyboard focus, at every zoom."
- D52: pixel style on "room browser and room map ... and the seat panel opened from the map"; "room/seat tables ... use the clean UI kit". So the seat table stays clean UI kit, the map is pixel.
- D58: "the committed atlas stays placeholder-only. Device and pending-request overlays follow SIM-013 and SIM-014."
- Ticket technical note (SIM-015.1 review finding 4): "Cap zoom by canvas area or render only the viewport, and show the error state on failure."

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The room page renders every placed seat and fixture at its saved tile. | `map-view.test.ts` "keeps every placed seat and fixture with its tile" (payload to view data is lossless); existing `placement.test.ts` "places a sprite at tile*32 + anchor"; code review: `SeatsPage` passes `useRoomLayout` data straight to `RoomMap` (no re-layout in the UI). |
| 2 | Seat state is shown by a sprite overlay, not colour alone, and comes from the derived status. | `placement.test.ts` "cannot and mine seats emit their state sprites from the real atlas"; `map-view.test.ts` "seat state comes from seatViews, missing entry defaults to empty"; code review: the map reads `seatViews` from `GET /api/rooms/{id}/layout`, never from `SeatDto`. |
| 3 | Name tags appear only on hover or keyboard focus, at every zoom. | Existing `SeatOverlay.test.tsx` "tag is hidden at rest and shown only by group-hover or group-focus-visible" plus new "tag classes are the same at zoom 2, 3 and 4". |
| 4 | A click, or the keyboard, opens the seat panel, and a seat code in the URL opens it on load. | `SeatOverlay.test.tsx` "seat buttons are real buttons with data-map-seat and aria-haspopup=dialog" (native buttons fire `onClick` on Enter/Space); `SeatDetailPanel.test.tsx` "returnFocusTarget prefers the map opener"; code review: `onSelect` calls the same `router.push(seatHref(...))` as the table; `?seat=` on load is unchanged (`panelView`). |
| 5 | Zoom and pan work at 390 px and on desktop, and the map is usable in dark mode. | `zoom.test.ts` (cap and clamp); `RoomMap.test.tsx` "zoom control disables levels over the canvas cap" and "too large room shows the too-large view"; `paint.test.ts` "refuses a canvas over the cap without resizing"; code review: scroll region is `tabIndex=0`, `max-h-[70vh]`, `overflow-auto`, theme tokens for border/text. Browser behaviour: see Ming verification. |
| 6 | All existing seat actions stay reachable, including for seats without a placement. | `SeatsView.test.tsx` "renders the map slot above the table and keeps every table row"; `RoomMapSection.test.tsx` "shows the unplaced note with the count"; existing `SeatActions` / `SeatDetailPanel` tests stay green (panel and actions unchanged). |
| 7 | Unit tests cover the mapping from the API payload to the map's view data. | `src/lib/sprites/map-view.test.ts` (all cases listed below) and `seats-api.test.ts` "layout returns internal for a bad shape". |

All checks green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Ming verification after merge
Vitest renders static markup in node, so these need a real browser (ticket technical note). Local run: `pnpm dev`, a seeded room (`pnpm seed:dev`).
1. Desktop (Chrome) and a phone at 390 px (real iPhone Safari preferred): open `/rooms/<code>`, scroll/pan the map in both axes (wheel, trackpad, touch swipe, arrow keys after focusing the map), switch 2x/3x/4x.
2. Keyboard: Tab into the map, Tab through seats; the name tag shows on focus; Enter opens the panel; Esc closes it and focus returns to the same map seat. Same from a table row (focus returns to the row).
3. Click a seat on the map: the panel opens with `?seat=<code>` in the URL; reload keeps it open.
4. Assign, release, set/clear cannot-seat from the panel opened on the map: the map overlay (avatar, blocked sign, mine tint) updates after each action without a page reload.
5. Light and dark mode: map border, zoom buttons, name tag and seat focus ring are visible on both.
6. A large room (for example 40 x 40 tiles): unavailable zoom levels are disabled with the note; on iPhone Safari the map is not blank. A 64 x 64 room shows the "too large" view and the seat table still works.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/map-view.ts` (new) | Pure `toMapView(body: unknown): MapView \| null` (validates and maps `LayoutResponse`), types `MapView` and `MapLoadState`. | AC1, AC2, AC7; bad payload must not crash the page. | No |
| `src/lib/sprites/map-view.test.ts` (new) | Mapper unit tests. | AC7 | No |
| `src/lib/sprites/zoom.ts` (new) | `MAX_CANVAS_AREA`, `MAX_CANVAS_SIDE`, `fitsCanvas`, `allowedZooms`, `clampZoom`. | Ticket security note (finding 4), AC5. | No |
| `src/lib/sprites/zoom.test.ts` (new) | Cap and clamp unit tests. | AC5 | No |
| `src/lib/sprites/placement.test.ts` | Add one test: `cannot` / `mine` seats emit `state.cannot` / `state.mine.tint` ops with the real `public/sprites/office.json`. | AC2 (a missing frame is skipped silently, so state could vanish). | No |
| `src/ui/roomlayout/paint.ts` (L44-56) | Before resizing, return false when `!fitsCanvas(w, h)`; after resizing, return false when `canvas.width/height` differ from the request. | Finding 4 defence in depth; silent failure becomes the error view. | No |
| `src/ui/roomlayout/paint.test.ts` | Two tests for the guards. | AC5 | No |
| `src/ui/roomlayout/ZoomControl.tsx` (new) | Shared zoom button group (lifted from `RoomMapDemo.tsx` L14-26), `Button`-kit styling, `aria-pressed`, `disabled` for levels over the cap. | AC5; one zoom component for page and demo. | No |
| `src/ui/roomlayout/RoomMap.tsx` | New optional props `onZoom?(z)`, `onSelect?(code)`; compute `allowedZooms(list.bounds)` and the effective zoom with `clampZoom`; render `ZoomControl` (when `onZoom` is given) and the limited-zoom note; `too large` status when no level fits; scroll region `tabIndex={0}`, `max-h-[70vh]`, focus ring, `border-outline-variant`; `RoomMapStatus` gets a `tooLarge` variant and theme tokens instead of `border-red-500/40`. | AC4, AC5, finding 4. | No |
| `src/ui/roomlayout/RoomMap.test.tsx` | Tests for the `tooLarge` status and token classes (static markup only). | AC5 | No |
| `src/ui/roomlayout/SeatOverlay.tsx` (L16-41) | `onSelect` prop; on each button `onClick={() => onSelect?.(seat.code)}`, `data-map-seat={seat.code}`, `aria-haspopup="dialog"`. Do **not** add `data-seat-code`. | AC4; `data-seat-code` is used by the delete focus logic (`SeatsPage.tsx` L91-92) and the panel (`SeatDetailPanel.tsx` L148-150). | No |
| `src/ui/roomlayout/SeatOverlay.test.tsx` | Attribute test, zoom-independence test for tags. | AC3, AC4 | No |
| `src/ui/roomlayout/RoomMapSection.tsx` (new) | Map `Card` for the room page: heading, pan hint, loading / error + retry / empty states, `RoomMap` with local zoom state (default 2), truncated note, unplaced note. Props `{ state: MapLoadState; onRetry; onSelect }`. | AC1, AC5, AC6; layout errors must not hide the table. | No |
| `src/ui/roomlayout/RoomMapSection.test.tsx` (new) | Static markup tests of the states and notes. | AC6 | No |
| `src/ui/roomlayout/index.ts` | Export `RoomMapSection`, `ZoomControl`. | Page imports. | No |
| `src/ui/seats/seats-api.ts` | Add `layout(roomId)` (`GET /api/rooms/{id}/layout`) reading the body through `toMapView`; a bad shape gives `internal`. | No UI client exists for the SIM-015.1 endpoint. | No |
| `src/ui/seats/seats-api.test.ts` | Tests for `layout`. | AC7 | No |
| `src/ui/seats/useRoomLayout.ts` (new) | Hook `useRoomLayout(seatsApi, roomId)`: stale-response counter (same pattern as `useRoomSeats.ts` L42, L57-78), `reload()`, keeps the old map on `keepRowsOnError` codes (`seat-actions.ts` L304). | Map must refresh after seat actions (stale map risk, both consults). | No |
| `src/ui/seats/SeatsPage.tsx` | Call `useRoomLayout`; pass `refreshAll` (seat `refresh` + layout `reload`) to `useSeatActions` (L85); one `openSeat(code)` used by the table (L169) and the map; pass `map={<RoomMapSection .../>}` to `SeatsView`. | AC1, AC2, AC4, AC6. | No |
| `src/ui/seats/SeatsView.tsx` | Optional prop `map?: ReactNode`, rendered when `room` is set, after the truncated notice (L105-109) and before the empty card / table. Table unchanged. | AC6; keeps `SeatsView` pure. | No |
| `src/ui/seats/SeatsView.test.tsx` | Map slot test. | AC6 | No |
| `src/ui/seats/SeatDetailPanel.tsx` (L141-155) | Export pure `returnFocusTarget(row, previous)`: if `previous` is connected and carries `data-map-seat`, return it; otherwise the existing order (row, previous, null). Use it in the close cleanup. | A panel opened from the map must return focus to the map seat, not jump to the table row. | No |
| `src/ui/seats/SeatDetailPanel.test.tsx` | Tests for `returnFocusTarget` with plain stub objects. | AC4 | No |
| `src/ui/copy/roomlayout.ts` | New strings: `heading`, `panHint`, `retry`, `tooLarge`, `zoomLimited`, `emptyMap`, `unplacedNote(n)`, `truncated(n)`. The existing `error` string stays as is (atlas failure). | UI copy rule (D36); `no-literals.test.ts` scans every `.tsx`. | No |
| `src/app/dev/roommap/RoomMapDemo.tsx` | Drop its own zoom buttons (L14-26); pass `onZoom={setZoom}` to `RoomMap`. | One zoom component (both consults); avoids two zoom groups on the demo. | No |

No file matches a High path.

## Data model / migration
None.

## API contract
None (uses the existing SIM-015.1 `GET /api/rooms/{id}/layout`, `withAuth tier: "user"`; no change).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/sprites/map-view.test.ts` › keeps every placed seat and fixture with its tile | AC1 |
| map-view › seat state comes from seatViews, missing entry defaults to empty | AC2 |
| map-view › maps empty, occupied, mine, cannot (and passes pending through) | AC2 |
| map-view › unknown state string becomes empty; null name and null avatarSeed allowed | AC2, domain: null fields |
| map-view › keeps Vietnamese names unchanged (`Nguyễn Thị Ánh`, no normalisation) | domain: diacritics |
| map-view › unplaced seats are listed in server order and are not in layout.seats | AC6 |
| map-view › truncated and saved:false are carried through (default layout is drawable) | AC1 |
| map-view › empty is true only when seats, fixtures and floors are all empty | empty state |
| map-view › returns null for a non-object, missing layout, non-array seats/fixtures/floors/unplaced, non-boolean truncated, seat without string id/code, non-integer x/y, bad rotation | AC7 |
| `src/lib/sprites/zoom.test.ts` › a 20 x 15 tile room allows 2, 3 and 4 | AC5 |
| zoom › 2048 x 2048 px allows only 2 (exactly at the area cap); 2048 x 2049 allows none | finding 4, bounds |
| zoom › a 2048 x 32 px strip is limited by the side cap (4x = 8192 allowed, 2049 wide is not) | finding 4, bounds |
| zoom › clampZoom keeps an allowed level, drops to the largest allowed below it, returns null for none | AC5 |
| `src/lib/sprites/placement.test.ts` › cannot and mine seats emit their state sprites from the real atlas | AC2 |
| `src/ui/roomlayout/paint.test.ts` › refuses a canvas over the cap without resizing | finding 4 |
| paint › returns false when the canvas did not take the requested size | finding 4 |
| `src/ui/roomlayout/SeatOverlay.test.tsx` › seat buttons are real buttons with data-map-seat and aria-haspopup=dialog, and no data-seat-code | AC4 |
| SeatOverlay › tag classes are the same at zoom 2, 3 and 4 | AC3 |
| `src/ui/roomlayout/RoomMap.test.tsx` › tooLarge status shows its copy with role=alert | AC5 |
| RoomMap › status views use theme tokens (no raw red border) | AC5 dark mode |
| `src/ui/roomlayout/ZoomControl.tsx` via `RoomMap.test.tsx` or own test › renders 2x/3x/4x with aria-pressed on the value and disabled on levels not allowed, plus the zoom-limited note | AC5 |
| `src/ui/roomlayout/RoomMapSection.test.tsx` › loading state | states |
| RoomMapSection › error shows the API message and a retry button | states |
| RoomMapSection › empty map shows emptyMap copy | states |
| RoomMapSection › shows the unplaced note with the count (1 and 3) and the truncated note | AC6 |
| `src/ui/seats/seats-api.test.ts` › layout calls GET /api/rooms/{id}/layout with an encoded id | data |
| seats-api › layout returns internal for a bad shape, and the server error code for a non-2xx | AC7 |
| `src/ui/seats/SeatsView.test.tsx` › renders the map slot above the table and keeps every table row | AC6 |
| SeatsView › does not render the map slot when the room is missing | states |
| `src/ui/seats/SeatDetailPanel.test.tsx` › returnFocusTarget prefers a connected map opener; otherwise row, then previous, then null | AC4 |

## Approach
1. **Pure logic first (lib).** Write `zoom.ts`: `MAX_CANVAS_AREA = 16_777_216` (iOS Safari limit, about 67 MB RGBA), `MAX_CANVAS_SIDE = 8_192`. `fitsCanvas(w, h)` checks both; `allowedZooms({w, h})` returns the `ZOOM_LEVELS` (`layout.ts` L2) that fit (always a prefix); `clampZoom(requested, allowed)` returns the largest allowed level <= requested, else the smallest allowed, else null. Then `map-view.ts`: validate the payload shape (not the layout rules, which are the server's job) and build `MapView = { layout, seatViews, unplaced, truncated, saved, empty }`, filling a `seatViews` entry for every placed seat (missing or unknown state becomes `{ state: "empty", avatarSeed: null, name: null }`). `MapLoadState = { status: "loading" | "ready" | "error"; view: MapView | null; errorCode: string | null }`. Tests for both.
2. **Data.** Add `layout(roomId)` to `createSeatsApi` (`seats-api.ts`) using `call()` and `toMapView` (null gives `fail("internal")`). Add `useRoomLayout` in `src/ui/seats/`: idle (loading, no fetch) until `roomId` is known; `reload()` bumps a counter and drops stale responses; after a first success it never flips back to the loading view (keeps the old map during reload); on error it keeps `view` only for `keepRowsOnError` codes.
3. **Renderer.** `paint.ts` guards (step 1 helpers). `SeatOverlay`: `onSelect`, `data-map-seat`, `aria-haspopup="dialog"`. `ZoomControl`: `role="group"`, `aria-label={roomlayoutCopy.zoomLabel}`, one `Button` (variant `tonal`, size `sm`) per level with `aria-pressed` and `disabled` when not allowed. `RoomMap`: after `list` is built, `allowed = allowedZooms(list.bounds)`, `effective = clampZoom(zoom, allowed)`; `effective === null` renders `RoomMapStatus status="tooLarge"`; paint and size with `effective`; show `zoomLimited` when `allowed.length < ZOOM_LEVELS.length`. Scroll region: keep `role="region"`, add `tabIndex={0}`, `max-h-[70vh] overflow-auto overscroll-contain`, `rounded-md border border-outline-variant`, `outline-none focus-visible:ring-2 focus-visible:ring-primary` (same as the table region, `SeatsView.tsx` L119-123). Pan is native scrolling (wheel, trackpad, scrollbars, touch swipe, arrow keys on the focused region); no pointer-drag pan, so click vs drag cannot conflict.
4. **Section.** `RoomMapSection` (Card, `h2` `roomlayoutCopy.heading`, `panHint`): `loading` with no view gives `RoomMapStatus loading`; `error` with no view gives `apiErrorMessage(code)` (`role="alert"`) and a retry `Button`; a view with `empty` gives `emptyMap`; otherwise `RoomMap` with `useState<Zoom>(2)`, `onZoom`, `onSelect`. Below it: `truncated(LAYOUT_LIMITS.seats)` when `view.truncated`, `unplacedNote(n)` when `view.unplaced.length > 0`. An error after a success keeps the map and shows the message with retry above it.
5. **Page.** In `SeatsPageInner`: `const map = useRoomLayout(seatsApi, roomId)`; `refreshAll = () => Promise.all([refresh(), map.reload()])` passed to `useSeatActions` (every write path, including add and delete, already calls `refresh`, `useSeatActions.ts` L80, L162); `openSeat` shared by table and map. `SeatsView` gets `map={<RoomMapSection .../>}`; it renders the slot after the truncated notice and before the empty card and table; the table and the panel stay unchanged, so every action stays reachable and unplaced seats stay usable through the table.
6. **Focus return.** `returnFocusTarget` in `SeatDetailPanel.tsx`; the close cleanup uses it. Post-delete focus in `SeatsPage.tsx` L87-111 is unchanged (it uses `data-seat-code`, which only table rows carry).
7. **Copy and demo.** Add the strings to `roomlayout.ts`; update `RoomMapDemo.tsx`. Run all checks.

Rules: R1 all new code is in `src/ui/**` (imports ui, lib) and `src/lib/**` (imports lib only: `map-view.ts` and `zoom.ts` import `@/lib/sprites/layout`, `@/lib/validate/layout`); `pnpm check:layers`. R3 nothing new from env. R4 no server/API/schema change, no device or pending overlays (pending is only passed through by the mapper; the server does not emit it yet). R5 tests listed above. R6/R7 not touched (no route handler change). UI copy in `src/ui/copy/roomlayout.ts` (D36). D52: map in pixel style, table and zoom buttons in the clean UI kit.

## Specialist input used
- Frontend 1, UX 5 (click handler, `onSelect`, same `router.push` as the table): adopted. `aria-pressed`/`selectedCode` on seat buttons: rejected, the seat buttons are not toggles and the modal panel makes the map inert while open.
- Frontend 2, UX 2 (pure mapper with tests): adopted, in `src/lib/sprites/map-view.ts`.
- Frontend 3, UX 1 (`useRoomLayout` with stale counter, reload on every action): adopted; wired through `refresh` so add and delete are covered too. Separate `createLayoutApi` file: rejected in favour of a `layout` method on `createSeatsApi`, which reuses its error handling.
- Frontend 4, UX 7 (map above the table, table unchanged, unplaced note, no separate strip): adopted.
- Frontend 5, UX 4 (focusable region, shared zoom group, default 2x clamped): adopted. Pointer-drag pan (frontend 5): rejected for now; native scroll covers pan on touch, mouse, trackpad and keyboard, and avoids click vs drag conflicts. `max-h-[70vh]` (UX 3): adopted.
- Frontend 6, UX 3 (area cap in lib, disabled levels, paint guard, size sanity check): adopted. Budget 16,777,216 px and 8,192 px per side. Viewport-only rendering: rejected (larger, not required).
- Frontend 7, UX 9 (dark mode tokens, `RoomMapStatus` red border): adopted. Seat focus outline restyle (`outline-primary`): not adopted; left to Ming's visual check (step 5), the teal ring carries focus on light floors.
- Frontend 8, UX 11 (copy): adopted.
- Frontend 9, UX 10 (static markup tests, atlas frames for states): adopted (`placement.test.ts` test with the real manifest).
- Frontend 10, UX Q6 (one `ZoomControl` used by the demo): adopted.
- Frontend risk and UX 5, 6 (duplicate `data-seat-code`, focus return to the opener): adopted (`data-map-seat`, `returnFocusTarget`).
- UX Q1 (`pending` to neutral): not adopted; the mapper passes `pending` through unchanged because the renderer already supports it and the server does not emit it until SIM-014. No new pending work here.
- UX 8 (empty, error with retry, layout failure keeps the table): adopted.

## Assumptions
1. "Opens the seat detail ... on click or keyboard focus" (spec L366) means keyboard **activation** (Enter/Space on a focused seat), as the ticket's AC4 says ("A click, or the keyboard"). Opening a modal on mere focus would trap Tab traversal through the map. Focus alone shows the name tag (D50).
2. Pan is native scrolling of the map region (wheel, trackpad, scrollbars, touch, arrow keys). If Ming wants mouse drag-to-pan, it becomes a follow-up (`debt` issue).
3. Canvas budget 16,777,216 px area and 8,192 px per side. Consequence: a room near the 64 x 64 tile maximum (2,048 px plus sprite overhang per side) does not fit even at 2x and shows the "too large" view; its seats stay fully usable through the table. Zoom below 2x is not offered (spec: whole numbers 2x, 3x, 4x). Viewport-only rendering for very large rooms is a follow-up (`debt` issue) if real rooms hit this.
4. Zoom choice is local component state (default 2x), not persisted.
5. On mobile there is no hover, so a tag shows only on keyboard focus; a tap opens the panel at once. This follows D50; flagged, not changed.
6. Keyboard users get two tab stops per seat (map button and table row). Accepted: the table is the clean UI kit fallback (D52) and the map is optional. No `tabIndex` games.
7. The atlas is placeholder-only (D58); visual quality is not a criterion here.
8. Hotspots: no other open ticket (`IN_PROGRESS`, `REVIEW`, `DONE`) edits these files. SIM-011.2 is `ESCALATED` and touches the Members UI only. SIM-015.2 (editor, later) will edit `RoomMap.tsx`, `SeatOverlay.tsx` and `roomlayout.ts` and should rebase on this.

## Blocking questions
None.

## Split proposal
None. Estimate: about 400 changed lines of product code plus about 300 of tests; one implement/review cycle.
