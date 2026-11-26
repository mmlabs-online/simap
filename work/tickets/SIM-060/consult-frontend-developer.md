# Consult — frontend-developer — SIM-060

## Findings

**Current code**
- `CheckinView.tsx` is a pure view. It takes `state: {kind:"room", roomHeading, map: ReactNode}` and `switcher`. It has a `CheckinButtonSlot` (empty, for SIM-058/059) and a "Who's here" card that only holds `whosHerePlaceholder`. `CheckinPage.tsx` wires hooks to it. It passes `activeCheckinRoom: null` and `recentCheckins: []` into `firstRoom` with a "SIM-058/060 supply them" comment.
- `RoomMapSection` -> `RoomMap` -> `buildDrawList(layout, seatViews, ...)` -> `paintRoom`, plus `SeatOverlay` (one `<button>` per seat). Tags are `hidden group-hover:flex group-focus-visible:flex`. Placement comes from `tagPlacement` in `src/lib/sprites/overlay.ts`: above or below, with an edge align. There is no collision logic.
- `SeatView = {state, avatarSeed, name, look}`. `avatarSeed` is the occupant's member id. `buildDrawList` draws the avatar on the chair whenever `avatarSeed !== null`, so today "occupied" means a character is always seated. `overlayFor(state, footprint)` is pure and unit-tested in `overlay.test.ts`.
- `keys.json` has `state.cannot`, `state.mine.tint`, `state.pending` and `device.monitor.{n,e,s,w,dual}`. There is no monitor-on/off, no typing frames and no "away" or "open tag" sprite. Sprites come from `pnpm sprites:pack`. Devices are drawn only when a seat has devices (`seatDevices`).
- `GET /api/rooms/[id]/presence` returns `{roomId, workDate, members:[{memberId, displayName, seatId, seatCode, checkedInAt, source}]}`, with `Cache-Control: no-store`, tier `user`, and org-scoped. It does not return the pixel look or any "assigned but away" list.
- `/api/me/presence` has GET, PUT, PATCH (move seat, `{seatId}`) and DELETE. 422 `seat_not_yours` and 409 `not_checked_in` are domain errors.
- **Polling precedent.** The only existing refresh pattern is `useRequestBadge`: refresh on focus and visibilitychange, with a sequence guard against stale results, and "No polling (D24)". There is no interval hook, so SIM-060 adds the first one. There is no jsdom. The repo uses `renderToStaticMarkup` for `*.test.tsx`, so hooks with effects cannot be tested directly.
- `no-photo-on-map.test.ts` scans every file under `src/ui/roomlayout` and `src/lib/sprites` for the regex `/photo/i` (also any import of `Avatar`). Any new file or comment there must not contain "photo", "photograph" and so on, and must not import `ui/Avatar`. `src/ui/checkin/**` is not scanned (`CheckinPage` already uses `useMemberPhotos`), so keep photo code there.

**Data gaps**
- "Away" and "present" are derivable on the client: the seat occupant (`seatViews[seat].avatarSeed`) is present iff its member id is in the presence `members` (or its seat id matches). The room layout already says who is assigned. No API change is needed for this.
- "Who's here" needs the pixel head. Join presence `seatId` to `seatViews[seatId].look` and `avatarSeed` from the layout. Fallback to a seed-derived look when the seat is unplaced or truncated in the layout (`unplaced`, `truncated`).
- Open tags need "my other seats in this room". Use `useMySeats` (`seat.roomCode` and so on). Check whether its items carry the seat id. If they do not, map by `seat.code` from the draw list or `seatViews`. This is the one thing that might need a small API or DTO field (to be confirmed in plan).
- The layout is a separate fetch, so the presence poll and the layout can disagree for one tick. For example, a member is in presence but has no seat in the layout. The code must tolerate this.

## Recommendations

**1. Pure logic in `src/lib/` (carries the unit tests, AC7)**
- `src/lib/presence/seat-presence.ts`, with these functions:
  - `presenceMap(members)` -> Set of memberIds (or Map by seatId).
  - `seatPresence(view, presentIds)` -> `"present" | "away" | "none"`. This is the "overlay choice" function.
  - `openTagSeats(mySeatIds, activeSeatId, checkedIn)` -> list of seat ids that show an open tag. It returns nothing when not checked in, and excludes the active seat.
- Extend `overlayFor` in `src/lib/sprites/overlay.ts`. Add a third arg or a new `presenceOverlayFor(presence, footprint)`. Keep the existing `overlayFor` signature unchanged, because the editor and other views use it and D50 views must not change.
- The presence view is opt-in. Add an optional `presence?: Record<seatId, "present"|"away">` to `buildDrawList` (default undefined = today's behaviour for all other views). When set:
  - present: avatar plus typing frame plus monitor-on overlay;
  - away: skip the avatar (empty chair), and draw an "away" marker on the chair, so it is not colour alone. For example a small "zzz" or empty-chair sprite, in addition to the grey tag;
  - unassigned: unchanged.
  This is a draw-list unit test in node, in the same style as `placement.test.ts`.
- Sprites: the plan must say whether new frames are needed (`state.away`, `state.open`, `state.present.monitor`, typing alternates) and extend `keys.json` plus `sprites:pack` (the `--no-map` placeholders mode exists). Typing idle without animation (walk animations are SIM-061): either two alternate typing frames toggled by a slow render-tick, or a single static "typing pose" frame. I recommend a static pose now. Animation can wait for SIM-061 and avoids a repaint timer on canvas.
- Name-tag layout: `layoutTags(seats, zoom, widthPx, measure)` in `src/lib/sprites/tag-layout.ts` -> `{seatId, x, y, w, truncated}`.
  - Estimate the tag width by character count (there is no canvas, so use `chars*k+pad`; never `measureText`).
  - Greedy: sort by (y, x), try above, then below, then step sideways or stack vertically in 1-tag-height rows until there is no rect intersection.
  - Fall back to truncation with a max width (the tag has `max-w-40` now). Full name is in `aria-label` and a `title` or the focus tag.
  - Pure function, tested with adjacent seats (same row, 1 tile apart at zoom 1 and 4) and edges.
- Tag rendering: tags are HTML in `SeatOverlay`, not canvas. Add a prop `tags?: "hover" | "always"` (default "hover"). In "always" mode, render positioned `<span aria-hidden>` from `layoutTags` output. Away tags are grey (`STATUS_DOT.empty`) plus a text marker like "away", and present has a check or dot shape. The tag never carries state by colour alone. The `aria-label` already contains the state text (add present/away wording to `roomlayoutCopy.seatStates`). Keep the seat buttons as the single focus target. Open-tag buttons are separate buttons (see below).
- Open tag: a real `<button>` placed over the desk (`data-open-tag={seatCode}`), `aria-label` "Move here, seat X". It is a sibling of the seat button, not nested inside it (nested interactive content is invalid). Activation calls `onMove(seatId)`. While the call is in flight, disable it to dedupe double clicks. Then apply the returned presence locally (optimistic or from the PATCH response), then refetch. Show the 409/422 message through `apiErrorMessage`; add copy for `seat_not_yours` and `not_checked_in` if missing.

**2. Polling (new `src/ui/checkin/usePresencePoll.ts` plus pure `src/lib/presence/poll.ts`)**
- Pure `nextPollDelay({visible, failures, baseMs})` returns `null` when hidden. The rule is: base 45 s (inside the 30-60 s window) plus jitter of about +/-10% (5 s max, keeps it inside 30-60). After a failure, back off: 45 s x 2^n capped at 60 s... which breaks the window, so cap the backoff at 60 s and accept that on failure the window is `min(60 s, ...)`. Alternatively, the plan states "failures keep the base interval, never faster; retries are not counted against the 30-60 s rule". Plan must pick one; I recommend base 45 s, on failure 60 s, and show a stale-data notice after 2 consecutive failures.
- Hidden: do not schedule while `document.visibilityState === "hidden"`. On `visibilitychange` to visible, fetch immediately if the last success is older than the interval, then restart the timer (the tab may have been hidden for minutes). Use `setTimeout` chains (not `setInterval`) so there is never an overlap.
- Dedupe: one in-flight request per room (an in-flight ref). Use a sequence guard like `useRequestBadge`, so a response that arrives after a room switch or an unmount is dropped. Use an `AbortController` on room change and unmount. Reset all state on room change (a different `roomId` is a new poll).
- Also refresh right after a successful own check-in, check-out or move (SIM-058/059 call sites), so the user sees their own change immediately and not up to 45 s later. Expose `refresh()` from the hook.
- Auth: `apiFetch` re-sends once on 401/403. A GET is safe to re-send, so no problem. Do not poll while the user is not signed in. A 401 after refresh failure must not loop; treat it as a failure and back off.
- Cost: org-wide polling by every open tab, N users every 45 s, one indexed query. Fine at current scale; say so in the plan.
- Testability: keep the hook a thin shell (`useEffect` plus timer plus listener) around pure functions. Test `nextPollDelay`, plus a small injectable `createPoller({fetch, now, setTimer, clearTimer, isVisible})` state machine under Vitest fake timers (`vi.useFakeTimers`) in node: pause when hidden, resume with a fetch, no overlap, backoff, abort on dispose. The hook only wires it to `document`.

**3. Avoiding conflicts with SIM-059 (popup)**
Both tickets edit `CheckinView.tsx` and `CheckinPage.tsx`. Recommend:
- SIM-060 owns: the map and "Who's here" column (`src/ui/checkin/WhosHere.tsx`, new), `usePresencePoll.ts`, `useRoomPresence` (new), `src/lib/presence/*` additions, `roomlayout/**` and `sprites/**`.
- SIM-059 owns: `CheckinButtonSlot` content, the popup component (new files `CheckinPopup.tsx`, its own hook), and `checkin-room` first-room inputs (`activeCheckinRoom`, `recentCheckins` from `/api/me/presence`).
- Make the touch points explicit and tiny. In `CheckinView`, add two new optional props or slots with distinct names, for example `whosHere: ReactNode` (060) and `overlay`/`popup: ReactNode` (059), instead of both editing the `state.kind==="room"` branch. In `CheckinPage`, each ticket adds one hook call plus one JSX line; do not refactor the existing body. Ask whichever merges first to land the slot props (a 10-line prep) and let the other rebase. Sequence them if the board allows (059 first, since the popup also produces the check-in call that 060's "me" state depends on).
- Shared state: both need "my presence" (`GET /api/me/presence`: checked in, room, seat). Define one `useMyPresence` hook in a single ticket and import it from the other. I suggest SIM-059 creates it (it needs it first for the popup decision), and 060 consumes it. If they build in parallel, 060 should accept `myPresence` as props to the view and depend only on a type from `src/lib/presence/types.ts` (`MyPresenceDto`, already merged).
- Do not both change `roomlayoutCopy`/`checkinCopy` in the same lines; add the new keys in a separate block per ticket to avoid textual conflicts.

**4. Spec/D-rule points to pin in the plan**
- D50 stays for every other map view: `tags="hover"` default; the check-in view passes `"always"` and `presence`. Add a test that default `RoomMap` output has no always-visible tags.
- "Who's here" focus: selecting an entry focuses the seat. Use `document.querySelector([data-map-seat=...])` or a ref map, call `.focus()` and `scrollIntoView({block:"center", inline:"center"})`, inside the map's scroll region. Use an instance-scoped `focusSeat(code)` callback exposed from `RoomMap` (`seatFocus` prop or ref), not a global query. List entries are `<button>`. If the seat is not drawn (unplaced), disable the focus action and say why.
- The list head uses the existing `avatar.ts` drawing, not a photo. A static canvas needs `useEffect`. Alternatively render an SVG or CSS box of the frame from the atlas. Keep it in `src/ui/checkin/` (not scanned by the photo guard, but do not import `ui/Avatar`; follow the intent of the guard).
- Check-in time: format in UTC+7 (D35); reuse the existing date helper (`work-date.ts` is only for work dates; check `src/lib` for a time formatter). Source labels: "self" -> "Self", "provider" -> "Third-party" (PRE-06 wording).
- Copy goes in `src/ui/copy/checkin.ts` (D36), including `whosHereEmpty`, `away`, `present`, `moveHere`, stale-data notice.
- Also wire `firstRoom({activeCheckinRoom, recentCheckins})` if SIM-059 has not (small; coordinate).

## Risks
- Name-tag de-overlap is the main size risk (M top end). Estimated text width is approximate; test with long names and dense rows, and always provide truncation plus full name on hover/focus/aria.
- Tags rendered as HTML over a zoomable canvas: z-order against seat buttons and open-tag buttons, hit targets at 390 px, and pointer events (`pointer-events-none` on tags, as today).
- Missing sprites (away, open tag, typing pose, monitor-on) force an atlas rebuild and change `public/sprites/office.png/json`. Check that `sprites:pack` works on this machine (CLAUDE.md notes no Python locally, memory file `simap-local-env.md`). If packing is not possible, the fallback is to draw simple placeholders through existing frames (`state.pending` etc.) and open a follow-up for art.
- "Monitor on" depends on the seat having a monitor device; a seat with no monitor cannot show a monitor on. Decide: draw an "on" screen overlay only when the desk has a monitor, or add a fixed screen glow on the desk regardless.
- Layout and presence are fetched separately and can be briefly inconsistent (see Findings). Also the layout `seatViews` only refresh on layout reload, so if a member is reassigned during the day, away/present is wrong until reload. Accept and note it.
- Polling every tab of every member multiplies requests; hidden-tab pause covers it. Also the double-fire risk on `visibilitychange`+`focus` events; use only `visibilitychange`.
- R7/apiFetch re-send: the move PATCH is idempotent (same seat -> 200). Make sure a double click does not issue two moves to different seats. Disable all open tags while one move is pending.
- Guard test: do not use the word "photo" anywhere in `roomlayout` and `sprites`, including comments.
- A parallel SIM-059 merge conflict in `CheckinPage.tsx` is likely unless the slot split above is agreed.

## Open questions
1. Typing idle: static pose now, or two-frame alternate with a slow timer (conflicts with the "walk animations = SIM-061" boundary)? I recommend static.
2. May SIM-060 add and pack new sprite frames (away marker, open tag, typing pose, monitor-on)? Who draws the art?
3. Polling interval and failure rule: 45 s base, 60 s after a failure, or strictly the 30-60 s window including backoff? Stale-notice after how many failures?
4. Does `useMySeats` expose seat ids (needed for open tags and move), or should the presence response / me endpoint add `mySeatIds` for the room? That would be the only API change.
5. Should "Who's here" also show members assigned but away, or only checked-in members (ACs say checked-in only)? Spec: only checked in. Confirm that away members are visible only as grey tags on the map.
6. Who creates `useMyPresence` and the `CheckinView` slot props, SIM-059 or SIM-060? Suggest 059 and a short prep commit, with 060 rebasing.
7. Third-party (`provider`) source label wording: "Third-party" vs the provider's name. Spec says "self / third-party"; I assume "Third-party".
8. Monitor-on for seats without a monitor device: draw a glow anyway, or skip?

Key files: `src/ui/checkin/CheckinView.tsx`, `src/ui/checkin/CheckinPage.tsx`, `src/ui/roomlayout/SeatOverlay.tsx`, `src/ui/roomlayout/RoomMap.tsx`, `src/lib/sprites/overlay.ts`, `src/lib/sprites/placement.ts` (lines 445-459), `src/lib/presence/types.ts`, `src/app/api/rooms/[id]/presence/route.ts`, `src/ui/requests/useRequestBadge.tsx` (refresh and sequence-guard precedent), `src/ui/no-photo-on-map.test.ts`.
