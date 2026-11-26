# SIM-044.1 — security review (security-ai-generated-code-auditor)

## Attempt 1

Verdict: PASS — no 🔴, no 🟡 (code read only; checks not run by the auditor). Commit 9c31498.

- 🟢 Seat device filter in SQL before the cap: `src/server/seats/seats.ts:132-135` (held clause before `order by rn limit`); `device_count` (l.124) stays the total (OQ-55).
- 🟢 Every User-tier seat path filtered: `getSeat` l.179, `listRoomSeats` l.206, `releaseSeat` noop l.492 and after-write l.507; routes pass `ctx.tier` (`seats/[id]/route.ts:17`, `rooms/[id]/seats/route.ts:19`, `seats/[id]/release/route.ts:15`).
- 🟢 Hard-coded `"org"` reloads reachable only by Manager/Admin: `addSeats` l.374 (admin), `setOccupant` l.455/471, `setCannotSeat` l.522/538, `setSeatTags` l.557/593 (manager).
- 🟢 Members filtered in SQL: `src/server/members/manage.ts:122`, `:126-130` (`case when`); binds consistent (`listMembers` l.157-158, `loadMember` l.191-196, `getMember` l.208, `mustLoad` l.255 null for Manager-gated writes); routes pass `ctx.sub`/`ctx.tier`.
- 🟢 Fail-closed without a member row (`coalesce(..., false)`); DB tests `seats.db.test.ts:516`, `manage.db.test.ts:481`.
- 🟢 Bound parameters only; R6 joins repeat `org_id`; R7 unchanged (release 409 before write).
- 🟢 Layout returns only `type` + `deviceType` (`layout.ts:137-165`), locked by the AC4 DB test.
- 🟢 UI handles null `deviceCount` (`MembersView.tsx:138`, `:173`); `SeatDetailPanel.tsx:46` uses filtered data.
- 💭 `layout.ts:137`: free-text device `type` (≤61 chars) reaches Users for devices they don't hold (approved OQ-55 shape); identifying text typed there would leak — consider data-entry guidance or sending only the catalog type to Users.
- 💭 Seat total `deviceCount` and other members' seat refs stay visible to Users (approved OQ-55/58).

Follow-ups: other members' email (Q6); write-action existence oracle (Q10); possibly limit layout `type` for Users.
