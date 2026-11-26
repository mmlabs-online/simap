Status: READY

# Plan — SIM-060: Present and away on the map, name tags, open desk tags, "Who's here" and polling

## Scope summary
`docs/spec-v1.md` **PRE-06 Presence on the map and "Who's here"** (lines 758-772):
> - Every member of the org sees presence in every room: who is here, check-in time and source (self /
>   third-party). There is no hidden presence.
> - Checked in: the character sits at their chair with a typing idle animation and the monitor on. Assigned but
>   away: empty chair and a grey name tag. Unassigned seats look as today (LAY-06).
> - "Who's here" lists the members checked in to the shown room: pixel character head, display name, seat code,
>   check-in time, source. Selecting an entry focuses their seat on the map.
> - While checked in, each of the member's other seats in the same room shows an **open tag** on the desk; clicking
>   it (or activating it by keyboard) moves their presence there (PRE-03 move seat) and the character walks to that
>   chair (D77).
> - Other members' check-ins, moves and check-outs appear by **polling** every 30–60 s (no websockets; stack
>   unchanged), with their walk-in or walk-out. This amends D24 for the presence view only (D76). Polling pauses while
>   the tab is hidden.
> - Name tags are **always visible** in the presence view (D80 amends D50 for this view only) and stay readable
>   when seats are adjacent (no overlap: offset, stack or truncate, with the full name on hover/focus).

**LAY-06** presence item (lines 480-482): "In the presence view (PRE-06, D76), an occupied seat also shows **present**
(the occupant's character seated, typing idle, monitor on) or **away** (empty chair, grey name tag). Present/away is
never shown by colour alone. There, name tags are always visible and stay readable when seats are adjacent (D80
amends D50 for that view only)." LAY-06 line 478-479 (D50) stays for every other map view.

**PRE-03 Move seat** (lines 724-727): "The server refuses a seat that is not theirs or not in the room of the active
check-in (422 `seat_not_yours`), or a move with no active check-in (409 `not_checked_in`). Moving to the seat already
used returns 200 and writes nothing (idempotent)." The client only calls the merged SIM-058 PATCH.

Decisions: D80 ("In the presence view, name tags are always visible and must stay readable when seats are adjacent.
Amends D50 ... for the presence view only; other map views keep D50"), D50 ("Name tags on the map appear only on hover
or keyboard focus, at every zoom"), D77 ("each of their other seats in that room shows an open tag on the desk;
clicking it moves their presence to that seat"), D78 ("Presence is display-only"), D35 (UTC+7 display), D36 (copy in
copy files).

Out of scope (ticket): walk animations (SIM-061; until then every change shows as the end state), other map views
(keep D50). No server change (see API contract).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Every member sees presence in every room: who, check-in time, source; no hidden presence | Server side already merged (SIM-058: tier `user`, org-scoped, `src/server/presence/read.ts`). Client: `whos-here.test.ts › keeps every member the API returns, in API order, including members whose seat is not on the map` and `› time in UTC+7 HH:mm, source Self / Third-party`; `seat-presence.test.ts › present for every seat in presence…`; code read: `CheckinPage` passes the full `RoomPresenceResponse.members` (no filter by role or tier) |
| 2 | Checked in: character at the chair, typing idle, monitor on; assigned but away: empty chair + grey name tag; unassigned as today; never colour alone | `seat-presence.test.ts › seatPresence …`; `placement.test.ts › presence: away seat draws no avatar frames; present seat draws them; present seat with a monitor gets a screen op, without a monitor none; unassigned seat unchanged; presence undefined → ops identical to today`; `paint.test.ts › screen op fills its rect`; `SeatOverlay.test.tsx › always mode: away tag has data-presence="away", the ring marker and the grey style; present tag has the filled dot; aria-label says "here"/"away"` (shape + empty chair + text, not colour alone). Visual check of the pose and screen: Ming (below) |
| 3 | "Who's here" lists checked-in members (pixel head, name, seat code, time, source); selecting focuses their seat | `whos-here.test.ts › …`; `WhosHere.test.tsx › one button per member with name, seat code, <time dateTime>, source; head canvas aria-hidden; entry whose seat is not on the map is disabled with the "Not on the map" hint; empty, loading, error + retry, stale notice`; code read: `RoomMap` `focusSeat` effect queries its own container for `[data-map-seat]`, calls `focus()` + `scrollIntoView({block:"center", inline:"center"})` |
| 4 | While checked in, each other own seat in the room shows an open tag; click or keyboard moves presence (PRE-03) | `seat-presence.test.ts › openTagSeats …`; `SeatOverlay.test.tsx › open tags are real buttons, siblings of the seat buttons (never nested), aria-label "Move here, seat X", disabled while a move is pending`; `move.test.ts › moveOutcome: ok → apply + refresh; 409 not_checked_in → refresh my presence + message; 422 seat_not_yours → reload layout + message; other → message; never retries`; code read: `usePresenceMove` ignores a second call while busy |
| 5 | Polls every 30–60 s, no websockets, pauses while hidden | `poll.test.ts › nextPollDelay …`, `› createPoller …` (hidden → no timer, no load; visible again → immediate load when due, else the remainder; never two loads in flight; 45 s base, 60 s after a failure; dispose drops a late result); code read: `usePresencePoll` listens to `visibilitychange` only and uses `setTimeout` chains |
| 6 | Name tags always visible here, no overlap on adjacent seats (offset/stack/truncate, full name on hover/focus); other views keep hover/focus tags (D50) | `tag-layout.test.ts › …` (adjacent seats at zoom 1 and 4, dense rows, edges, long and Vietnamese names, obstacle avoidance, dot fallback, no two rects intersect); `SeatOverlay.test.tsx › always mode renders visible tags (no hidden class) at the layout positions; hover/focus tag holds the full name untruncated`; existing `SeatOverlay.test.tsx › tag is hidden at rest…` stays green and a new `› default mode (no tags prop) renders no always-visible tag and no open tag` |
| 7 | Unit tests cover the overlay choice, tag layout for adjacent seats and the polling pause/resume rule | The test files above: `src/lib/presence/seat-presence.test.ts`, `src/lib/sprites/tag-layout.test.ts`, `src/lib/presence/poll.test.ts`; `pnpm test` green |

## Ming verification after merge
- Two browsers (two members of one org), from the ticket test plan: A checks in, moves via an open tag, checks out; B
  sees each change within 60 s; in B's devtools Network tab, no `/presence` request is sent while B's tab is hidden,
  and one is sent right after B's tab becomes visible again (when the last one is over 45 s old).
- Look of the present seat (seated static pose, the screen glow on a desk with a monitor) and the away seat (empty
  chair, grey tag with the ring) at zoom 1-4 and at 390 px; tags of a dense row stay readable; keyboard: Tab to an open
  tag, Enter moves; selecting a "Who's here" entry scrolls the map and focuses that seat. The node-only Vitest setup
  cannot paint a canvas or drive focus.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/presence/seat-presence.ts` | New, pure: `SeatPresence = "present" \| "away"`, `seatPresenceMap(seatViews, members)`, `myMemberId(seatViews, my)`, `openTagSeats({layout, seatViews, my, roomId})` | Overlay choice and open tags as unit-tested lib code (AC 2, 4, 7) | No |
| `src/lib/presence/seat-presence.test.ts` | New | AC 2, 4, 7 | No |
| `src/lib/presence/poll.ts` | New, pure: `POLL_BASE_MS`, `POLL_FAILURE_MS`, `STALE_AFTER`, `nextPollDelay`, `createPoller(deps)` (injected timers, clock, visibility) | Polling rule testable without jsdom (AC 5, 7) | No |
| `src/lib/presence/poll.test.ts` | New | AC 5, 7 | No |
| `src/lib/presence/whos-here.ts` | New, pure: `whosHereRows({members, seatViews, placedCodes})`, `checkinTime(iso)` (Asia/Ho_Chi_Minh `HH:mm`) | List content (AC 1, 3) | No |
| `src/lib/presence/whos-here.test.ts` | New | AC 1, 3 | No |
| `src/lib/presence/move.ts` | New, pure: `moveOutcome(result)` → `{apply, refreshMine, reloadLayout, errorCode}` | Move result handling, no retry on 4xx (AC 4) | No |
| `src/lib/presence/move.test.ts` | New | AC 4 | No |
| `src/lib/sprites/tag-layout.ts` | New, pure: `layoutTags({seats, area, obstacles})`, `openTagRect(seat, area)`, `tagWidth(text)` | Non-overlapping always-visible tags (AC 6, 7). No "photo" word in this file (guard) | No |
| `src/lib/sprites/tag-layout.test.ts` | New | AC 6, 7 | No |
| `src/lib/sprites/placement.ts` | `DrawOp` (lines 23-27) gains `{type:"screen"; layer:"overlay"} & Rect`; `buildDrawList` `art` option (lines 122-125) gains `presence?: Readonly<Record<string, SeatPresence>>`; device loop (lines 361-374) records monitor rects per seat; avatar loop (lines 445-454) skips the avatar for `away` and emits screen ops for `present` | Present/away drawing, opt-in so other views are unchanged (AC 2) | No |
| `src/lib/sprites/placement.test.ts` | Add the presence cases | AC 2 | No |
| `src/ui/roomlayout/paint.ts` | Paint `screen` ops (fill `SCREEN_FILL`) next to the `shadow` branch (lines 77-81) | Monitor on (AC 2) | No |
| `src/ui/roomlayout/paint.test.ts` | Add `screen op fills its rect` | AC 2 | No |
| `src/ui/roomlayout/SeatOverlay.tsx` | New optional props `tags?: "hover" \| "always"` (default `"hover"`), `presence?`, `openTags?`, `onOpenTag?`, `openTagsBusy?`; "always" renders the tag layer from `layoutTags`, the hover/focus tag with the full name, and open-tag buttons as siblings | AC 2, 4, 6; default keeps D50 | No |
| `src/ui/roomlayout/SeatOverlay.test.tsx` | Add always-mode, open-tag and default-mode cases; existing cases unchanged | AC 2, 4, 6 | No |
| `src/ui/roomlayout/RoomMap.tsx` | Optional `presenceView?: PresenceMapProps` (exported type); passes `presence` to `buildDrawList`, `tags="always"` + open-tag props to `SeatOverlay`; `focusSeat` effect with a container ref (line 110) | Wiring, AC 3 focus | No |
| `src/ui/roomlayout/RoomMapSection.tsx` | Optional `presenceView?` forwarded to `RoomMap` (lines 15-22, 46-57); optional `notice?: ReactNode` rendered after `failure` | Wiring; move error shown with the map | No |
| `src/ui/copy/roomlayout.ts` | Additive block `presence: { here, away, unnamed, moveHere, moveHereLabel(code), seatLabel(code, state, name, presence) }` | D36 map copy (SeatOverlay imports only this copy) | No |
| `src/ui/copy/presence.ts` | New `presenceCopy` (Who's here: `empty`, `loading`, `error`, `retry`, `stale`, `notOnMap`, `source.self`, `source.provider`, `unnamed`, `focusLabel(name, code)`, move error overrides) | D36; a separate file so SIM-059's `checkin-popup.ts` and `checkin.ts` lines are not touched | No |
| `src/ui/checkin/PixelHead.tsx` | New: 32×32 `aria-hidden` canvas of the character's head from `previewOps` + `tintedFrame` | AC 3 pixel head | No |
| `src/ui/checkin/WhosHere.tsx` | New pure view: list of rows, focus buttons, empty/loading/error/stale states | AC 3 | No |
| `src/ui/checkin/WhosHere.test.tsx` | New, `renderToStaticMarkup` | AC 1, 3 | No |
| `src/ui/checkin/usePresencePoll.ts` | New thin hook: wires `createPoller` to `document.visibilityState` / `visibilitychange`, returns `{stale, refreshNow}` | AC 5 | No |
| `src/ui/checkin/usePresenceMove.ts` | New thin hook: `{busy, errorCode, move(seatId)}` around `presenceApi.move` + `moveOutcome` | AC 4 | No |
| `src/ui/checkin/CheckinView.tsx` | Additive: optional `whosHere?: ReactNode` prop; when given it replaces the placeholder `<p>` (lines 67-69); heading and card stay | Fill the "Who's here" card | No |
| `src/ui/checkin/CheckinView.test.tsx` | Add `whosHere prop replaces the placeholder` | Slot wiring | No |
| `src/ui/checkin/CheckinPage.tsx` | Additive wiring: `useRoomPresence(presenceApi, roomId)`, `usePresencePoll`, `usePresenceMove`, `useAtlas`, focus state; build `presenceView` for `RoomMapSection` and `whosHere` for `CheckinView`; refresh room presence when my presence changes | Wiring (hotspot with SIM-059) | No |
| `src/ui/checkin/useRoomPresence.ts`, `src/ui/checkin/useMyPresence.ts` (SIM-059) | Only if needed after SIM-059 merges: `refresh()` resolves to `boolean` (true = ok) and keeps the last data on failure | The poller needs the success flag for its failure rule | No |

No High path is touched (no `src/server/**`, migration, config, `.env.example`, `scripts/check-layers.mjs`). No change
to `src/lib/sprites/keys.json`, `public/sprites/office.*` or `assets/art/**` (no new sprite frames, see Specialist
input).

## Data model / migration
None.

## API contract
None (no endpoint change). The client uses the merged SIM-058 endpoints through SIM-059's `createPresenceApi`:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/rooms/{id}/presence` | — | `RoomPresenceResponse` (`src/lib/presence/types.ts:18-31`) | 200, 404 | user |
| GET | `/api/me/presence` | — | `MyPresenceResponse` (`types.ts:12-16`) | 200, 503 | user |
| PATCH | `/api/me/presence` | `{ "seatId": "<uuid>" }` | `{ presence: MyPresenceDto }` | 200 (idempotent), 409 `not_checked_in`, 422 `seat_not_yours` | user |

Poll cost: each visible check-in tab sends the two GETs every 45 s (60 s after a failure); the room read is two
indexed queries returning one small row per checked-in member (API consult). Hidden tabs send nothing. Fine at the
current scale; ETag/304 is a later additive option.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/presence/seat-presence.test.ts › seatPresence: seat with an occupant and a presence row of that member → present; occupant without a row → away; no occupant → absent from the map (unassigned, LAY-06 as today)` | AC 2, 7 |
| `… › a presence row whose seatId is not in the layout is ignored; a row on a seat whose layout occupant is another member → that seat is away (layout and poll briefly disagree)` | AC 2 |
| `… › pending and cannot seats with an occupant follow the same rule (state overlay kept)` | AC 2 |
| `… › openTagSeats: not checked in → []; checked in to another room → []; checked in here → my other seats in this room (by occupant = my member id), active seat excluded, in seat order` | AC 4 |
| `… › myMemberId: from the occupant of my active seat; falls back to the occupant of a "mine" seat; none → null (no open tags)` | AC 4 |
| `src/lib/presence/poll.test.ts › nextPollDelay: hidden → null; visible, 0 failures → 45000; ≥1 failure → 60000; every value is within 30000..60000` | AC 5, 7 |
| `… › createPoller: start while visible schedules one timer of 45 s; tick calls load once and reschedules` | AC 5 |
| `… › hidden: visibilityChanged clears the timer and no load runs while hidden, however long` | AC 5, 7 |
| `… › visible again: loads at once when the last run is ≥ 45 s old, else schedules the remainder` | AC 5, 7 |
| `… › a tick while a load is in flight does not start a second load; refreshNow during a load waits for it` | AC 5 |
| `… › a failed load → next delay 60 s; stale is false after 1 failure, true after 2, false again after a success` | AC 5 |
| `… › dispose clears the timer and a load that resolves later schedules nothing` | AC 5 |
| `… › refreshNow clears the pending timer, loads, and restarts the 45 s wait` | AC 4, 5 |
| `src/lib/sprites/tag-layout.test.ts › tagWidth: counts code points of the NFC name ("Nguyễn Thị Ánh" = 14), caps at 160 and marks truncated` | AC 6, Domain focus |
| `… › two adjacent desks in one row (1 tile apart) at zoom 1 and at zoom 4: both tags placed, rects do not intersect` | AC 6, 7 |
| `… › a dense row of 6 desks with long names at zoom 1: no two rects intersect; tags shift, stack or shrink before the dot fallback` | AC 6, 7 |
| `… › near the top edge the tag goes below; near the left/right edge it is clamped inside the area` | AC 6 |
| `… › tags never cover an obstacle (open-tag rects)` | AC 4, 6 |
| `… › impossible density → kind "dot" inside the seat rect; dots never intersect` | AC 6 |
| `… › deterministic: same input → same output; order follows the seats' reading order` | AC 6 |
| `… › openTagRect: centred on the desk, clamped inside the area` | AC 4 |
| `src/lib/presence/whos-here.test.ts › keeps every member the API returns, in API order, including members whose seat is not on the map (focusable false)` | AC 1, 3 |
| `… › look from seatViews[seatId] when that seat's occupant is the member, else derivedChoice(memberId)` | AC 3 |
| `… › checkinTime: 2026-03-06T01:30:00Z → "08:30"; 2026-03-06T17:05:00Z → "00:05" (UTC+7); invalid → the input` | AC 1, D35 |
| `… › source self → "self", provider → "provider" keys; empty displayName → unnamed flag; Vietnamese names kept verbatim` | AC 1, Domain focus |
| `src/lib/presence/move.test.ts › ok → apply the returned presence and refresh; 409 not_checked_in → refreshMine + code; 422 seat_not_yours → reloadLayout + code; unavailable/internal → code only; never a retry flag` | AC 4 |
| `src/lib/sprites/placement.test.ts › presence: away seat draws no avatar frames; present seat draws the same avatar frames as today` | AC 2 |
| `… › presence: present seat with a monitor device gets one screen op per monitor, on the overlay layer; present seat without a monitor gets none; away seat gets none` | AC 2 |
| `… › presence undefined → ops identical to a call without the option (every other view unchanged)` | AC 2, 6 (D50 views) |
| `src/ui/roomlayout/paint.test.ts › screen op fills its rect with SCREEN_FILL and draws no atlas frame` | AC 2 |
| `src/ui/roomlayout/SeatOverlay.test.tsx › default mode (no tags prop): no always-visible tag, no open tag (D50)` | AC 6 |
| `… › always mode: one visible tag per occupied seat at the layoutTags position, no "hidden" class, aria-hidden, pointer-events-none; empty seats keep only the hover/focus tag` | AC 6 |
| `… › always mode: away tag has data-presence="away", the ring marker and the grey style; present tag has the filled dot; seat aria-label ends with "here" / "away"` | AC 2 |
| `… › always mode: the hover/focus tag shows the code and the full name without truncate` | AC 6 |
| `… › open tags: one <button data-open-tag> per open seat, aria-label "Move here, seat C302", sibling of the seat buttons (no button inside a button), disabled when openTagsBusy` | AC 4 |
| `src/ui/checkin/WhosHere.test.tsx › one button per row with name, seat code, <time dateTime=iso>08:30</time>, "Self" / "Third-party"; Vietnamese name intact` | AC 1, 3 |
| `… › a row whose seat is not on the map renders a disabled button with the "Not on the map" hint` | AC 3 |
| `… › empty list → empty text; loading → aria-busy; error without data → role=alert + retry button; stale → status notice above the list` | AC 3, 5 |
| `… › head is aria-hidden (no photo, no Avatar import)` | AC 3 |
| `src/ui/checkin/CheckinView.test.tsx › whosHere prop replaces the placeholder inside the Who's here card` | wiring |

## Approach
Order: two commits on one branch (see Split proposal): **A** map (steps 1-4, 7 map part), **B** list, polling, move
(steps 5-8).

1. **Overlay choice** (`src/lib/presence/seat-presence.ts`, imports `@/lib/sprites/layout`, `@/lib/presence/types`):
   - `seatPresenceMap(seatViews, members): Record<seatId, SeatPresence>`: for each seat id in `seatViews` with
     `avatarSeed !== null`: `present` when a member row has `seatId === id && memberId === avatarSeed`, else `away`.
     Seats without an occupant are absent (unassigned, unchanged). Rows for unknown seats are ignored.
   - `myMemberId(seatViews, my)`: `seatViews[my.seatId]?.avatarSeed`, else the `avatarSeed` of any `state === "mine"`
     seat, else `null`. No server field needed: the layout already carries the occupant id per seat
     (`src/server/layout/layout.ts:209-215`), and `mine` is the viewer's own seat.
   - `openTagSeats({layout, seatViews, my, roomId})`: `[]` unless `my` is set and `my.roomId === roomId`; else the
     layout seats whose occupant is `myMemberId`, minus `my.seatId`, in `seatOrder` order (`placement.ts:71`).
2. **Drawing** (`placement.ts`): `presence` is opt-in through the existing `art` options object, so every other
   caller is unchanged. In the device loop keep `monitors: Map<seatId, Rect[]>` with the drawn rect of each device of
   kind `monitor` (frame rect from anchor + offset, or the `DEVICE_IMAGE` box for image art; placeholder art skipped).
   In the avatar loop: `away` → skip `avatarFrames`; `present` → avatar as today, then per monitor rect one
   `{type:"screen", layer:"overlay"}` op: avatar view `back` (screen faces the viewer) → the rect inset 2 px, upper
   half; view `front` (screen faces away) → a 2 px strip on the rect's bottom edge (light on the desk). Constants
   named and documented so the art can be tuned. State overlays (`overlayFor`) are unchanged. `paint.ts` fills screen
   ops with `SCREEN_FILL = "rgba(125,211,252,.7)"`.
3. **Tag layout** (`src/lib/sprites/tag-layout.ts`, pure, no `measureText`): `TAG_H = 22`, `CHAR_W = 7`,
   `TAG_PAD = 34` (padding, marker, gap), `TAG_MAX = 160` (today's `max-w-40`), `TAG_MIN = 48`, `GAP = 2`.
   `tagWidth(text)` = `min(TAG_MAX, [...text.normalize("NFC")].length * CHAR_W + TAG_PAD)` plus `truncated`.
   `layoutTags({seats: {id, left, top, w, h, text}[], area: {w, h}, obstacles: Rect[]})` in the given (reading) order;
   candidates per tag: above-centre, below-centre (below first when the seat's top is within 2 tag heights of the
   area top), above/below aligned to the seat's left edge, then right edge, then one row further up/down; each clamped
   into the area; first candidate that intersects no placed tag and no obstacle wins. If none: retry with width
   `max(TAG_MIN, seat w)` (truncated). If still none: `{kind:"dot"}` (10×10, top-centre inside the seat rect; seat
   rects never overlap, so dots cannot). Output `{id, kind, left, top, width, truncated}` in overlay pixels.
   `openTagRect(seat, area)`: `tagWidth(moveHere)` wide, `TAG_H` high, centred on the desk, clamped.
4. **SeatOverlay / RoomMap** (no "photo" anywhere in `roomlayout/**` or `sprites/**`, guard
   `src/ui/no-photo-on-map.test.ts`):
   - `SeatOverlay` default `tags="hover"` renders exactly today's markup (D50 views). `"always"`: compute open-tag
     rects, then `layoutTags` for seats whose view has an occupant (text = `view.name ?? presence.unnamed`, obstacles =
     open-tag rects). Render a tag layer of `<span aria-hidden class="pointer-events-none absolute z-10 …">` siblings
     after the buttons: present → dark tag + filled dot; away → `bg-surface-container-high text-on-surface-variant`
     grey tag + hollow ring (`border-2`, no fill), `data-presence`; dot kind → the marker only. The button's own
     hover/focus tag gets `z-20`, sits at the layout position (relative offset) and shows code + full name with
     `whitespace-nowrap` and no `truncate`/`max-w-40`. Seat `aria-label` uses `roomlayoutCopy.presence.seatLabel`
     (adds ", here" / ", away"). Open tags: `<button type="button" data-open-tag={code} aria-label={moveHereLabel(code)}
     disabled={openTagsBusy} class="absolute z-30 min-h-6 …">` as siblings of the seat buttons, visible text
     `moveHere`, `onClick={() => onOpenTag(seatId)}`.
   - `RoomMap`: `PresenceMapProps = { presence?, openTags: string[], onOpenTag, busy, focusSeat: {code, n} | null }`;
     `presence` goes into the `buildDrawList` `art` options and the `useMemo` deps; a `ref` on the `div.relative`
     (line 110); effect on `focusSeat?.n` → `querySelector('[data-map-seat="' + CSS.escape(code) + '"]')`, `focus()`,
     `scrollIntoView({block:"center", inline:"center"})`. `RoomMapSection` forwards `presenceView` and renders `notice`.
5. **Who's here** (`whos-here.ts`, `PixelHead.tsx`, `WhosHere.tsx`): rows in API order (server sorts by check-in
   time, seat code), look from the seat view when its occupant is the member, else `derivedChoice(memberId)`
   (`src/lib/sprites/pixel-look.ts:47`); `checkinTime` with `Intl.DateTimeFormat("en-GB", {timeZone:
   "Asia/Ho_Chi_Minh", hour:"2-digit", minute:"2-digit", hourCycle:"h23"})`; `focusable` = seat code is in the
   layout's placed seats. `PixelHead` draws `previewOps(manifest, look, "front")` (`src/ui/portal/pixel-look-preview.ts`)
   at scale 2 into a canvas inside a `size-8 overflow-hidden` box showing the top (head); `aria-hidden`; placeholder
   box while the atlas loads. `WhosHere` props: `status`, `rows`, `stale`, `atlas`, `onFocus(code)`, `onRetry`; each
   row is a `<button>` (`min-h-11`, `aria-label={focusLabel(name, code)}`), disabled with `notOnMap` text when not
   focusable. Away members are not listed (spec: checked-in members only); they show as grey tags on the map.
6. **Polling** (`poll.ts`, `usePresencePoll.ts`): base 45 s (inside 30-60 s with margin), 60 s after any failure (the
   window is kept even when failing, so no exponential backoff), stale notice after 2 consecutive failures, cleared by
   a success. `createPoller({load, isVisible, now, setTimer, clearTimer, onStale})` → `{start, visibilityChanged,
   refreshNow, dispose}`; `setTimeout` chains only, one load in flight. The hook creates it in an effect keyed on
   `roomId` (null → none), `load = async () => { const [room] = await Promise.all([roomPresence.refresh(),
   myPresence.refresh()]); return room; }` (refs so the effect does not restart on each render), registers
   `visibilitychange` only (not `focus`, to avoid double fires), disposes on room change and unmount. Initial loads
   come from the hooks themselves (SIM-059), so `start()` only schedules. A 401 from `apiFetch` (signed out) counts as
   a failure; no loop.
7. **Move** (`move.ts`, `usePresenceMove.ts`): `move(seatId)` returns at once while `busy`; calls
   `presenceApi.move(seatId)`; `moveOutcome`: ok → `myPresence.apply(presence)` + `poll.refreshNow()`; 409
   `not_checked_in` → `myPresence.refresh()`; 422 `seat_not_yours` → `map.reload()`; the error code shows as a
   `role="alert"` notice under the map via `presenceCopy.moveError(code)` (own text for `seat_not_yours`, because
   `apiCopy.errors.seat_not_yours` is the device text, `src/ui/copy/api.ts:44`; else `apiErrorMessage`). Never
   retried on 4xx (R7 note: PATCH is idempotent, so `apiFetch`'s one re-send on 401/403 is safe). While busy all open
   tags are disabled, so a double click cannot send moves to two seats.
8. **Wiring** (`CheckinPage.tsx`, additive, no refactor of the existing body): `roomPresence =
   useRoomPresence(presenceApi, roomId)`; `poll = usePresencePoll(roomId, roomPresence, myPresence)`; `mover =
   usePresenceMove(...)`; `const { atlas } = useAtlas()` for the heads; `[focus, setFocus] = useState<{code, n} | null>`.
   When `mapView` and `roomPresence.data` (with `roomId === data.roomId`) exist: `presenceView = { presence:
   seatPresenceMap(...), openTags: openTagSeats(...), onOpenTag: mover.move, busy: mover.busy, focusSeat: focus }`;
   before the first presence answer (or on an error with no data) `presenceView` is still passed with `presence`
   undefined (map drawn as today, tags always on) so nobody is wrongly shown away. An effect keyed on
   `myPresence.data?.presence?.seatId ?? "none"` calls `poll.refreshNow()` (skipping the first run), so the member's
   own check-in, check-out (SIM-059 button and popup) or move shows at once. Pass `whosHere={<WhosHere …/>}` to
   `CheckinView` and `presenceView` + `notice` to `RoomMapSection`.
9. Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules: R1 — new `src/lib/**` files import only `@/lib/**`; `src/ui/**` imports ui and `@/lib/**` (checked by `pnpm
check:layers`). R6/R7 — no server change; the client sends only `{seatId}`. R3 — no config. R4 — the edits to
SIM-059's hooks are limited to the `refresh` return value. R5 — tests above. D36 — every string in
`src/ui/copy/roomlayout.ts` (map) or `src/ui/copy/presence.ts` (list, move errors). D78 — presence is only displayed;
nothing is stored or exported.

## Specialist input used
Decisions on the consults' open questions:
- **Typing idle: static pose now** (FE Q1). The present character is the seated avatar as drawn today (it already
  faces the desk via `avatarView(chairKey)`), plus the monitor on. A 2-frame loop needs typing art that does not exist
  (`keys.json` has no typing frames) and a repaint clock on the canvas, which SIM-061 introduces for walking. Spec
  PRE-06 says "typing idle animation"; this is flagged under Assumptions with the animation moved to SIM-061.
- **No new sprite frames, no `sprites:pack`** (FE Q2). `pnpm sprites:pack` is `node scripts/sprites-pack.mjs`
  (Node built-ins only, `scripts/sprites/pack.mjs:1-9`), and the source sheets are in `assets/art/sources/**`, so it
  would run on this Windows machine without Python. It is still not needed: away = no avatar + grey ring tag,
  present = avatar + filled-dot tag + screen op, open tag = an HTML button. Adding keys would rebuild
  `public/sprites/office.png` (binary churn, `committed-atlas.test.ts` hash) for placeholder-looking art with nobody
  to draw it. Dedicated art (`device.monitor.*.on`, typing frames) is a follow-up.
- **Poll interval and failure rule** (FE Q3, API Q): 45 s base, 60 s after a failure (stays inside 30-60 s even while
  failing), stale notice after 2 consecutive failures, no jitter (tab start times already spread the load). Adopted
  setTimeout chains, in-flight guard, abort/dispose on room change (FE 2, API 3).
- **Seat ids for open tags** (FE Q4, API Q): no API change. The layout's `seatViews` carries the occupant id per seat;
  my member id is the occupant of my active presence seat (or of a `mine` seat), so open tags are the other seats with
  that occupant. `useMySeats` is not needed.
- **"Who's here" content** (FE Q5): checked-in members only, as the spec says; away members are grey tags on the map.
- **Owner of `useMyPresence` and slots** (FE Q6): SIM-059 (orchestrator batch decision); this plan adds a separate
  `whosHere` prop and leaves SIM-059's `button` prop alone.
- **Provider label** (FE Q7): "Third-party" (PRE-06 wording "self / third-party"); the provider's name is not in the
  data (OQ-69). Self → "Self".
- **Monitor on without a monitor** (FE Q8): skip. A screen is drawn only over a monitor the seat really has; drawing a
  fake monitor would misstate the seat's devices (LAY-06 device rule). Present is still clear from the seated
  character and the filled-dot tag.
- **Member in another room** (API Q3): not shown here; the room read returns only members seated in this room, which
  matches "checked in to the shown room".
Adopted: pure lib functions for overlay choice, tag layout and polling with an injectable poller (FE 1-2, API 2);
opt-in `presence` on `buildDrawList` and `tags` on `SeatOverlay` with D50 defaults and a default-mode test (FE 1, 4);
open tags as sibling buttons, disabled while a move is pending (FE 1, risks); immediate refresh after own changes
(FE 2, API 3); ignore presence rows not in the layout (API risks); no server change and no merged layout+presence
read (API 1); privacy: only displayName, seat code, time, source and the pixel look are rendered (API 4); head drawn
from atlas frames in `src/ui/checkin/` without `ui/Avatar` (FE 4).
Rejected: refetch on `focus` (FE risk: double fires; `visibilitychange` only); jitter (not needed at this scale);
exponential backoff (would leave the 30-60 s window); a `useMySeats`-based open-tag list (the layout already has it).

## Assumptions
1. **Builds on SIM-059's plan** (`work/tickets/SIM-059/plan.md`, not yet implemented). SIM-059 merges first and this
   branch is rebased onto main; the implementer follows what actually merged: `createPresenceApi` (`room`, `move`),
   `useMyPresence` (`refresh`, `apply`), `useRoomPresence` (`refresh`, stale answers dropped), the `button` prop on
   `CheckinView`, the `firstRoom` wiring. If `refresh` does not resolve to a success flag, or drops the last data on
   failure, SIM-060 makes that minimal change in those two hooks (listed in Files) and records it in impl-log.
2. **Hotspots:** `src/ui/checkin/CheckinPage.tsx` and `src/ui/checkin/CheckinView.tsx` (SIM-059, `PLANNING`);
   `src/lib/sprites/placement.ts`, `src/ui/roomlayout/RoomMap.tsx` / `SeatOverlay.tsx` will next be edited by SIM-061
   (`BACKLOG`, depends on SIM-060).
3. **Spec difference to report to Ming:** PRE-06/LAY-06 say "typing idle animation"; this ticket ships a static
   seated pose with the monitor on (the ticket AC says "typing idle"). The animation belongs with SIM-061's render
   clock; the orchestrator should add it to SIM-061's notes. Not blocking.
4. Until the first room presence answer arrives, and after an error with no data, the map draws as today (no
   away/present split) with tags always shown; "Who's here" shows loading or the error. This avoids showing everyone
   as away for a moment.
5. The layout (`seatViews`) is loaded once per room; if a seat is reassigned during the day, present/away can be wrong
   until the layout reloads (also after a 422 move). The server already ends presence on a lost seat (PRE-05, D82).
6. In "always" mode only occupied seats get an always-visible tag (the name tag of D80); empty seats keep the
   hover/focus tag with their code. The always tag shows the name only; the seat code is in the hover/focus tag, the
   aria-label and "Who's here".
7. Tag width is an estimate (no canvas measuring in node); the hover/focus tag and the aria-label always hold the full
   name, so an estimate error never hides information. The dot fallback is a last resort for very dense rooms at
   zoom 1.
8. A move shows as an end state (character on the new chair) until SIM-061 adds the walk.
9. Size: about 850 product lines and 600 test lines, well above the ~400-line guide (see Split proposal).

## Blocking questions
None.

## Split proposal
The diff is about twice the ~400-line guide. The ACs share one wiring point (`CheckinPage`), so the plan covers the
whole ticket on one branch in two ordered commits that the reviewer can read separately. If the orchestrator prefers
two review cycles, split along the same seam into SIM-060 (slice A) and a follow-up ticket (slice B):
- **Slice A — map presence** (AC 2, 6, part of 7): `seat-presence.ts` (`seatPresenceMap`), `tag-layout.ts`,
  `placement.ts`, `paint.ts`, `SeatOverlay.tsx` always mode (no open tags), `RoomMap.tsx`/`RoomMapSection.tsx`
  `presenceView` without focus/open tags, `roomlayout` copy, `CheckinPage` reading room presence once per room load,
  with their tests. About 450 product lines.
- **Slice B — list, polling, move** (AC 1, 3, 4, 5, rest of 7): `whos-here.ts`, `poll.ts`, `move.ts`,
  `openTagSeats`/`myMemberId`, open-tag buttons, `focusSeat`, `PixelHead.tsx`, `WhosHere.tsx`, `usePresencePoll.ts`,
  `usePresenceMove.ts`, `presence` copy, `CheckinView` `whosHere` prop, the rest of the `CheckinPage` wiring, with
  their tests. About 400 product lines.
