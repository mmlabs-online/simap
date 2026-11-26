# Consult — api-platform-engineer — SIM-058

## SIM-058 consult: API platform review (read-only)

Limits of what I read: ticket.md, spec PRE-03/05/06, with-auth.ts, respond.ts, api/error.ts, and sample routes (requests/mine, seats/[id]/occupant, me/photo ETag). The D69, D70 and D71 rows in decisions.md are single very long lines that the tools omitted. I did not read D69's text, SIM-050 and SIM-052 code, or the members/seat read DTOs. The privacy recommendations below rest on the SIM-050/052 titles ("Hide other members' email from Users", "Send only the catalog device type to Users on the room map"). The planner must verify them against D69 and the existing member and seat read code.

### Findings
- Error shape is `{ error: { code } }` only, with no message. `ApiErrorCode` is a closed union in `src/lib/api/error.ts`. `ApiErrorBody` already carries one optional extra field (`rooms?: number`). Existing codes to reuse: `seat_not_yours`, `no_linked_member`, `member_not_assignable`, `not_found`, `invalid_request`. New codes needed: `no_seat_in_room`, `already_checked_in`, `not_checked_in`.
- `withAuth(handler, { tier })` already runs verify, org, tier and the member gate (a deactivated member gets 403 `member_deactivated`) before the handler. That satisfies R7 as long as the handlers return only domain 409/422 and 400/404/503 afterwards. `ctx.scope` and `ctx.sub` are the pattern. `requests.ts` `createRequest` shows the house style: `inTx`, `lockMembers` by sub, 422 `no_linked_member` when there is no member row, 422 `member_not_assignable` when the member is not active, `orgQuery` for scoping, and `writeAudit(c, scope, {actorSub, action, entity, entityId, meta})`.
- Routes use `export const dynamic = "force-dynamic"` and `Cache-Control: no-store`. An ETag/304 pattern exists only for images (`me/photo`, `device-types/image`). There is none for JSON reads.
- Routes that act on an id check `isCanonicalUuid` and return 404 otherwise. Request bodies go through `readJson` plus a validator in `src/lib/validate/`.

### Recommendations

**Resource paths.** One presence resource per member, keyed to the caller, plus a room-scoped read. This matches the existing `/api/me/*` and `/api/rooms/[id]/*` style. All routes use `tier: "user"` (any member, per PRE-03).

| Method and path | Purpose | Body |
|---|---|---|
| `PUT /api/me/presence` | Check in to a room (D77 lowest seat code, source `self`) | `{ room_id }` |
| `DELETE /api/me/presence` | Check out | none |
| `PATCH /api/me/presence` | Move seat | `{ seat_id }` |
| `GET /api/rooms/[id]/presence` | Room presence read for polling | none |

The `PATCH` method name is for a plan choice. Alternative: `POST /api/me/check-in`, `/check-out` and `/move-seat`, which is more discoverable but less RESTful. Either is fine; pick one and apply it to both the route tests and SIM-059/060. PUT and DELETE are naturally idempotent by method, which matches the AC and the R7 re-send. `PATCH` also fits the move being idempotent by target state.

**Status codes, exactly per the ACs.**
- Check-in:
  - 200 with the existing record when already checked in to that same room, with no write.
  - 200 with the record on a fresh or reopened check-in (the AC and spec name only 200 for the repeat case; use 200 for both so the client has one success path). Do not return 201 for "created" versus "existing", because the client cannot tell and need not.
  - 409 `already_checked_in` naming the current room when the active check-in is in another room.
  - 422 `no_seat_in_room` when the member has no seat in the room.
  - 404 `not_found` when the room is unknown or belongs to another org (R6 scope).
  - 400 `invalid_request` for a bad uuid or body.
  - 422 `no_linked_member` / `member_not_assignable` following the `createRequest` precedent. Mention these in the plan because the ACs do not list them. Likely `member_not_assignable` is unreachable, since the gate already returns 403 for deactivated members.
- Check-out: 200 always. With no active check-in it is a 200 no-op. Return the current state (see DTO) so the client can reconcile.
- Move: 200 on success, and also 200 with no write when the target is the seat already in use. 409 `not_checked_in` when there is no active check-in. 422 `seat_not_yours` when the seat is not the member's or is not in the room of the active check-in. 404 for an unknown or other-org seat. The spec lets `seat_not_yours` cover both the not-mine and the wrong-room cases; keep that to one code.
- Check order for move: first "no active check-in" (409), then seat validity (422). Pin this order in a test, because the ACs list the 422 first and the two can both apply. Note: an unknown seat id gives 404 before either, per the occupant route pattern.

**Naming the current room in 409 `already_checked_in`.** `ApiErrorBody` has no field for that. Extend it with an optional `room_id?: string` (a uuid). Do not extend it with a code or name for a room, because the client resolves the name from its own room list. This is a backward-compatible additive field, consistent with `rooms?: number`. Update `ApiErrorBody` and `API_ERROR_CODES`, and update the `apiError` signature to accept the extra (it currently takes only `status` and `code`), or add a small `apiErrorWith` helper in `respond.ts`. Check whether a test pins the code list.

**Idempotency and R7.** Because `apiFetch` re-sends once on 401/403, all four writes must be safe to repeat.
- Do the whole decision in one `inTx` transaction.
- Take a row lock on the member's presence row for today (`select ... for update` on `(org_id, member_id, work_date)`), or lock the member row via `lockMembers` first. Locking the member row serialises a double-click and an `apiFetch` re-send, and also orders against the D82 system check-out paths.
- For check-in, use `insert ... on conflict (org_id, member_id, work_date) do update ... where checked_out_at is not null` for the reopen case, or select-for-update then branch. Branch order in code: no row, then insert; row open and same room, then return it unchanged (no audit, no write); row open and other room, then 409; row closed, then reopen. "Open" must account for ended-on-read: `work_date < today` counts as ended, but since check-in always writes today's date, a stale prior-day row is simply a different row, with no conflict.
- A double submit of check-in must not write a second audit row. Move to the same seat writes no audit. Check-out of nothing writes no audit.
- Server time and the work date must come from one clock read in the server (a `now()` injected into the server function for the boundary tests), never from the client body. Add `src/lib/` helper `workDateUtc7(now: Date): string` (`YYYY-MM-DD`). Unit-test 16:59:59.999Z, 17:00:00Z, and the month and year rollovers. UTC+7 has no DST, so a fixed +7h offset is correct. An end-of-day check for the DB tests can use `(now() at time zone 'Asia/Ho_Chi_Minh')::date`, but pick one source of truth. A mismatch between the SQL and the TS calculation is a known drift risk, so compute the date once in TS and pass it as a parameter.

**DTO for the polling client (SIM-059/060).** Keep it flat and snake_case to match existing API shapes (check `listMyRequests` output for the casing before fixing it). Dates ISO 8601 UTC strings.

My presence (`PUT`, `DELETE`, `PATCH` responses, `200`):
```
{ presence: null | { room_id, seat_id, seat_code, checked_in_at, source: "self" | "provider" } }
```
`null` is returned by check-out and by no-ops; an active record has no `checked_out_at`, so the client does not need to interpret ended rows. Do not return ended rows through the write endpoints.

Room presence read (`GET /api/rooms/[id]/presence`):
```
{ room_id, work_date, members: [
  { member_id, display_name, seat_id, seat_code, checked_in_at, source } ] }
```
- Only active (not checked out, work date today) rows. Computed on read, as AC-5 says: `work_date = today(UTC+7) and checked_out_at is null`. Ended rows are not returned, because the client treats absence as "away". The client then plays the walk-out when a member disappears from successive polls, and walk-in when a new one appears.
- Sort by `checked_in_at`, then `seat_code`, so the order is stable between polls.
- Optional `my_last_checkin` and counts for the PRE-02 popup (checked-in count per room, last check-in per room, in UTC+7): that is a separate read and belongs to SIM-059, not here. Flag it. I recommend a second endpoint later (`GET /api/me/presence/rooms`) rather than bloating this one, but the plan should say whether SIM-058 provides it. The ticket scope says only "room presence read endpoint".
- The `GET /api/me/presence` read of the caller's own record, plus `last_room`, is also needed by SIM-057/059 for the room shown first (PRE-01 rule) and the popup's "no check-in today" test (from any source). If not in SIM-058, the plan must say which ticket owns it; otherwise the client cannot know its own state on page load. Cheap to add here: return the same `{ presence }` object as the writes.

**Polling-friendly read.** The payload is small (members in one room, a handful of fields), so the cost is mostly DB and request count at 30-60 s per tab. Recommended: a single indexed query on `(org_id, room_id, work_date)` for open rows, so make sure the migration has an index covering `(org_id, work_date, seat_id)` or stores `room_id` on the presence row (denormalised copy of the seat's room). Storing `room_id` is risky when a seat moves room (check how seats work; if seats can change room, a join to `seats` is safer and D82 covers losing the seat anyway). Optional extra: a weak ETag over the sorted result (hash of the body), honouring `If-None-Match` with 304 and `Cache-Control: no-store` kept off (use `private, no-cache`) so the client revalidates. This saves bandwidth only; the DB query still runs, so it is not essential. I would put it in as a nice-to-have, in the plan only if the cost is small; there is no JSON ETag precedent in this repo, so it adds a new pattern and tests. Keep `no-store` and `force-dynamic` as the default to follow the house style unless Ming wants the ETag. Either way, the client must not poll when the tab is hidden (PRE-06).

**What the room presence read exposes to Users (privacy).**
- Spec PRE-06: every member of the org sees presence in every room ("There is no hidden presence"), so the endpoint is `tier: "user"` with no filtering by who the caller is.
- Per SIM-050 (hide other members' email from Users), return `display_name` only, never email, employee code, group, project, photo URL or `sub`. Per SIM-052 (only catalog device type to Users), expose no device data. Include only what "Who's here" needs: display name, seat code, check-in time, source, plus `member_id`/`seat_id` so the client can focus a seat and link to the map layer. Verify whether `member_id` is already exposed to Users in the room map's occupant data; if not, drop `member_id` and key on `seat_id` instead (one occupant per seat). That also matches how the map renders character heads (the pixel look is stored on the member, D71: the pixel look may be needed for the head; check how the room map gets other members' pixel look today and reuse that exact path rather than adding fields here).
- Do not return `checked_out_by` (including `system`), the audit meta, or prior-day or checked-out rows. Do not offer a "history" or "last seen" read in this ticket (D78, display-only; retention OQ-70 open).
- Keep presence out of `export`, `dashboard` and `search` (D78), and add a test or a grep assertion for it.

**Server structure.**
- `src/server/presence/` with `presence.ts` (checkIn, checkOut, moveSeat, `endPresenceForSeat(c, scope, seatId, ...)`, `endPresenceForMember(c, scope, memberId, ...)`) and `read.ts`. The D82 helpers take a `Query` client so `seats.ts` (release/reassign) and `members/manage.ts` (deactivate) call them inside their existing `inTx`, not a new transaction. Each non-test file starts with `import "server-only"` (R1). Validators `validateCheckIn` / `validateMove` in `src/lib/validate/`, and the work-date helper in `src/lib/`.
- D82 hooks: end the row only if its `seat_id` equals the seat being lost. Seat release and reassign touch the seat; also check the seat-delete / room-delete / layout paths (a layout save that removes seats, "layout_seats_changed") and the occupant change in `setOccupant`, and swap-type flows (PUT occupant replaces an occupant). The AC names "released, reassigned"; any other path that clears `occupant_id` or deletes a seat leaves a presence row pointing at a seat the member no longer holds. List all writers of `seats.occupant_id` in the plan (grep) and either hook them all or have the read join `seats.occupant_id = presence.member_id` as a belt-and-braces filter so a stale row never shows. Note the join-on-read adds correctness without needing every write path to be perfect; I recommend it in addition to the hooks.
- Audit actions (suggest, matching `request.create` style): `presence.check_in`, `presence.check_out`, `presence.move`, `presence.system_check_out`, with meta `{room, seat}` codes (not ids only), and for system check-out `{reason: "seat_released" | "seat_reassigned" | "member_deactivated"}`. Check that SYS-03 / the audit facets (`api/audit/facets`) need the new actions registered, and that audit viewing (who sees it) is unaffected. Also confirm the audit `actor` for system rows (`system` is not a user `sub`; see how existing system actors are written).
- Migration (High path, R2): `presence(org_id, id, member_id, seat_id, work_date date, checked_in_at timestamptz, source text check in ('self','provider'), checked_out_at, checked_out_by text check ('self','system', maybe 'provider'))`, unique `(org_id, member_id, work_date)`, FKs composite with org like the other tables (follow the existing pattern), `on delete` behaviour for seats and members must not block seat or member deletion (D82; check whether seats and members can be hard-deleted; `cascade` or `set null` with a check). Index for the room read. Include a check that `checked_out_at is not null` iff `checked_out_by is not null`.

### Risks
- Double-send and double-click races: without the row or member lock, two concurrent check-ins can pass the "no row" branch; the unique constraint will make one fail with a 23505 that would surface as 500. Handle with `on conflict` or catch 23505 and re-read.
- Check-in reopen versus the unique key: a plain insert on the second check-in the same day violates uniqueness; the reopen path needs update, not insert.
- D82 coverage gaps (other writers of `occupant_id`, seat or room deletion, layout saves, member merge or code change) leave a ghost presence. A read-side join guard mitigates it.
- Stale-seat reads: a presence row whose seat's room changed (if seats can move rooms) gives a wrong room in "Who's here"; read the room via the seat.
- `ApiErrorBody` growth: adding `room_id` is additive, but the client `apiFetch` typing and any exhaustive switch over error codes in `src/lib` or `src/ui` may need updating (adding codes to a closed union can break a typed copy map; check `src/ui/copy`).
- Privacy drift: the presence read is the first org-wide per-person "where is X now" feed. Keep to the minimal fields above, and do not let SIM-059/060 add email or employee codes to it.
- Size: at the top of M; D82 hooks into two sensitive transactions. Consider the plan gate noting the migration is a High path (Ming approves the plan).

### Open questions
1. Path style: `/api/me/presence` (PUT/DELETE/PATCH) versus `/api/rooms/[id]/check-in`, `/api/me/check-out`, `/api/me/move-seat` (verb routes)? Ming should confirm, since SIM-059/060 hard-code it. My recommendation is the first.
2. Does SIM-058 own `GET /api/me/presence` (own state on load) and the per-room counts and last check-in for the popup (PRE-02), or does SIM-059 add them? Without them, SIM-057/059 cannot render the popup or the room-first rule.
3. 200 for both new and existing check-in (recommended) or 201 for newly created? The AC mentions only 200 for the repeat.
4. May the room presence read include `member_id` and the pixel look of members, or must the client map seat to occupant from the existing room map data? Needs a check of D69 and the SIM-050/052 outcome (I could not read D69's text).
5. Move to a seat in the same room that is the member's own but belongs to a different member's presence today (cannot happen, one occupant per seat), and what if the member has two seats but is deactivated mid-call (gate returns 403 first): confirm no extra handling is wanted.
6. ETag/304 for the room read: include now (new pattern for JSON) or leave to a later ticket? I recommend leaving it out unless polling load is a concern, with `no-store`.
7. Should `provider` be allowed in `checked_out_by` (SIM-063), or only `self` and `system` now? A check constraint on the migration should be loose enough that SIM-063 does not need a contract migration (R2 expand-then-contract).

Relevant files: `work/tickets/SIM-058/ticket.md`, `docs/spec-v1.md` (lines 720-772), `src/server/http/with-auth.ts`, `src/server/http/respond.ts`, `src/lib/api/error.ts`, `src/server/requests/requests.ts` (createRequest pattern), `src/app/api/seats/[id]/occupant/route.ts` (route pattern), `src/app/api/requests/mine/route.ts` (GET pattern).
