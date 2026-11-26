# Consult — api-platform-engineer — SIM-060

**Findings**
- GET /api/rooms/[id]/presence (src/server/presence/read.ts) returns { roomId, workDate, members[{memberId, displayName, seatId, seatCode, checkedInAt (ISO), source}] }. Sorted by checked_in_at, seat code. Active rule: today's open row, seat still held by the member, member status active. Scoped by org_id in every join (R6). Auth is via withAuth tier "user", so any org member can read it. It sends no-store, 404 for a bad or foreign room, and has no email, sub or devices.
- It covers every PRE-06 "Who's here" field except the pixel head. The layout GET (src/server/layout/layout.ts lines 80-84 and 212-214) already returns, per seat, occupantId, occupantName and occupantLook (pixel_look). So the head comes from the layout, joined to presence by memberId or seatId. No new field is needed on the presence endpoint.
- Present/away: seat is present if its seatId is in presence.members, otherwise "assigned but away" (occupantId set, not in presence). Open tags: the viewer's other seats in the room, i.e. layout seats with occupantId == me and seatId != my active presence seatId. This needs the viewer's memberId. Check whether /api/me or /api/me/presence exposes it, since the viewer's own active seat comes from /api/me/presence.
- Poll cost: 2 indexed queries (room existence, then a presence/seat/room/member join filtered by org, room and today's date). It returns one small row per checked-in member. At 30–60 s per open tab this is cheap. The layout is the heavier read and is not needed on each poll.
- ETag/304: not needed. The payload is tiny and the layout is fetched once. If wanted later, it is a cheap additive change, so skip it.

**Recommendations**
1. No server change. Do not fold presence into the layout GET. Keeping them separate means the layout stays cacheable and loads once, and only the small presence call is polled. A merged response would re-run the heavy layout query every 30–60 s and would mix a mutable per-day state into a structural read. The ticket's "API only if a field is missing" is satisfied.
2. Client-only work, matching the ticket's files. Add a pure lib function for the overlay state per seat (present / away / unassigned / open tag) and tag layout. Add a pure polling rule: interval of 45 s, paused when document.hidden, with an immediate refetch on visibilitychange to visible. Keep the interval out of the pure rule so it is testable with fake timers. Add a poll hook in src/ui/checkin/**.
3. Poll hygiene. On poll error keep the last state (no flicker) and back off. Do not overlap requests (skip if one is in flight). Abort on unmount or room change. After the move-seat call (SIM-058), refetch immediately rather than waiting for the next poll. Use apiFetch, whose 401/403 resend is safe for GET.
4. Privacy. Render only displayName, seatCode, checkedInAt and source from presence, and the pixel look from the layout. Do not add email, sub or devices to any payload (SIM-050/SIM-052 limits hold). Keep the name-tag full text in the title/aria-label only for what the API already returns.
5. R7. A move is a write via the SIM-058 route, and its auth codes come only from withAuth. Domain refusals (seat not theirs, not in the room) are 409/422, which the UI must show as copy in src/ui/copy/, not retry. Do not retry moves on 4xx.
6. Test the overlay choice, adjacent-seat tag layout and the pause/resume rule as required.

**Risks**
- Race between the layout and presence reads: a seat is reassigned (occupant change) while presence is stale. Handle presence entries whose seatId is not in the layout by ignoring them. The server already drops rows whose seat is no longer held by the member.
- Last-write-wins on stale polls after a local move: ignore a poll response that started before the move completed.
- The poll uses UTC+7 workDate. The response includes workDate, so on a day rollover the client should drop old state. This is a minor point.
- Always-visible tags in dense rooms are the main effort risk (the ticket's M-top note).
- Presence is not role-filtered, so any user who can see a room sees who is in it. This is intended by PRE-06 (no hidden presence).

**Open questions**
- Does the viewer's memberId reach the client (from /api/me or /api/me/presence)? That is needed to compute open tags and to highlight "me". If it is absent, a minimal additive field on /api/me/presence is the only server change worth considering.
- Poll interval: 45 s is proposed, within the 30–60 s range. Is that acceptable?
- Should a member checked in to a different room be shown as present here? The room endpoint only returns members seated in this room, which fits PRE-06 "checked in to the shown room".
