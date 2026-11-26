# SIM-058 consult: presence API (read-only)

## Findings

**Conventions to match**
- A route is `export const <METHOD> = withAuth<{id:string}>(async (req, ctx, route) => …, { tier })`, plus `export const dynamic = "force-dynamic"`.
  - The handler checks `isCanonicalUuid(id)` and answers 404 `not_found` otherwise.
  - It then calls `getPool()` (503 `unavailable` if null), `readJson` and a `validate*` function (400 `invalid_request`), then a server function `fn(pool, ctx.scope, ctx.sub, …)`.
  - It returns `apiError(r.status, r.code)` on refusal, or `Response.json(r.value, {headers:{"Cache-Control":"no-store"}})`.
  - Examples: `/home/user/simap/src/app/api/seats/[id]/release/route.ts`, `/home/user/simap/src/app/api/rooms/[id]/seats/route.ts`.
- `withAuth` (`/home/user/simap/src/server/http/with-auth.ts`) is the only source of 401/403 (`unauthenticated`, `org_required`, `forbidden`, `member_deactivated`). It runs before the handler, so R7 holds for free as long as the new handlers emit no 401/403 themselves.
  - `tier: "user"` is the lowest tier, so use it for all four routes.
  - A deactivated member is already refused by the member gate.
- Error body is `{error:{code}}`, with no message. The only extra field today is the optional `rooms?: number` in `ApiErrorBody` (`/home/user/simap/src/lib/api/error.ts`).
  - Codes must be added to `API_ERROR_CODES`.
  - The new codes are `no_seat_in_room`, `already_checked_in` and `not_checked_in`.
  - `seat_not_yours` already exists, and `no_linked_member` exists.
- Server pattern in `/home/user/simap/src/server/seats/seats.ts`: `inTx(db, async c => …)`, `orgQuery(c, scope, sql, params)` (`$1` is always org), `throw refuse(status, code)` to roll back, and `writeAudit(c, scope, {actorSub, action, entity, entityId, meta})`.
  - Lock order is documented in `rooms.ts` and in the `deactivateMember` comment: member row, then rooms `for share`, then seats `for update` in id order.
  - Presence code must follow this order.
- Seat-loss paths that need the D82 hook (every place `seats.occupant_id` changes away from a member):
  - `releaseSeat` (`seats.ts` ~486–520).
  - `writeOccupant` (`seats.ts` ~312), reached via `setOccupant` for the `replace`/`remove` decisions.
  - `deactivateMember` with `release` (`manage.ts` ~409–414). When `release` is false it refuses unless the member has no seats, so the member is deactivated while still occupying nothing.
  - Deactivation with no seats can still leave an active check-in only if the check-in is stale. Make the hook unconditional: end any open row for the member.
  - Check whether request approve (`src/app/api/requests/[id]/approve`) calls `writeOccupant`. It most likely does, so the hook placed in `writeOccupant` covers it.
- Deleting seats or rooms (`seats.ts:416`, `rooms.ts:251–252`) is guarded by `seat_not_empty` / `room_not_empty`. A presence FK to `seats` or `rooms` would still block deletion because of old-day rows, so the FK delete rule needs a decision (see Risks).
- Only the session's member id is derived from `ctx.sub` (`select id from members where org_id=$1 and sub=$2`). There is `no_linked_member` for a sub with no member row; reuse it (409 or 422, matching how existing routes use it).
- Audit has no action enum. Actions are free strings such as `seat.release` and `member.deactivate`.

## Recommendations

**Routes** (all `tier: "user"`, `no-store`, UUID-checked, no client time anywhere):

| Method and path | Purpose |
|---|---|
| `POST /api/rooms/[id]/check-in` | Check in to room `id`. No body (an empty body or `{}` is tolerated). |
| `POST /api/presence/check-out` | Check out the caller. No body, because the caller has at most one open row. |
| `PUT /api/presence/seat` | Move seat. Body `{ "seatId": "<uuid>" }`. PUT fits because it sets the current seat and is idempotent. |
| `GET /api/rooms/[id]/presence` | Room presence read for the polling client. |

- Check-out has an alternative: put it under `/api/rooms/[id]/check-out`. I prefer the room-less path, since a member has one active check-in.
- Validators go in `src/lib/validate/presence.ts` (a `validatePresenceMove` that requires a canonical `seatId`).
- Server code goes in `src/server/presence/presence.ts` (with `import "server-only"`). The route handlers are the only entry into it (R1).
- A pure rules file in `src/lib/presence/` holds `workDateUtc7(now: Date): string` (UTC+7, `YYYY-MM-DD`) and a pure `decideCheckIn` / `decideMove`, so unit tests cover the work-day boundary.

**Check-in** (single tx):
1. Resolve the member from `ctx.sub`, `for share`.
2. Lock the room `for share`, 404 if it is not in the org.
3. Select the member's seats in the room `order by code`. If none, 422 `no_seat_in_room`.
4. Use `now()` on the DB side, not an app clock. Compute the work date as `(now() at time zone 'Asia/Ho_Chi_Minh')::date`, or from the same instant in app code, so both agree.
5. Upsert on `(org_id, member_id, work_date)` with a row lock (`select … for update`):
   - No row: insert (source `self`) and audit `presence.check_in`. Return 201.
   - Row open and same room: return the existing record with 200 and write nothing.
   - Row open and a different room: 409 `already_checked_in`, naming the current room.
   - Row closed (D81): update the seat, source and `checked_in_at`, clear `checked_out_at` and `checked_out_by`, and audit `presence.check_in` with `meta.reopened: true`. Return 200 or 201 (pick one; I suggest 201 for any write, 200 for no-op).
   - A prior-day row is irrelevant, since the unique key includes the work date. A prior-day open row counts as ended on read and never blocks.
- Response (`PresenceDto`): `{ roomId, seatId, seatCode, memberId, checkedInAt, source, checkedOutAt: null }`, ISO 8601 UTC strings, camelCase to match the existing DTOs.

**Move seat** (`PUT`):
- Resolve today's open row for the member. If there is none, or it is from a prior day, 409 `not_checked_in`.
- The target seat must have `occupant_id = member`, and its room must equal the active row's room. Otherwise 422 `seat_not_yours`. A seat that does not exist gives the same 422, which avoids leaking existence.
- If the target is the current seat, return 200 and write nothing.
- Otherwise update the row's `seat_id` and audit `presence.move` with `{fromSeatId, toSeatId, roomId}`. Keep `checked_in_at` unchanged, because it is the check-in time.
- Lock order: member, room share, seats for update (the two seats in id order).

**Check-out:**
- If there is no open row today, return 200 `{ presence: null }` (or the closed record) and write nothing.
- Otherwise set `checked_out_at = now()`, `checked_out_by = 'self'`, and audit `presence.check_out`. A repeat call is then a no-op, which makes it idempotent.

**Idempotency**
- Idempotency comes from state and the `(org, member, work_date)` unique row. No `Idempotency-Key` header is needed.
- `apiFetch` re-sends once on 401/403, and every operation is a no-op on replay.
- The one non-replayable case is check-in after a check-out, which reopens the row. A late replay of an earlier check-in would reopen after an intended check-out. Because auth refusals come before any write (R7), `apiFetch` never retries after a write, so this stays safe. State it in the plan.

**D82 system check-out**
- Add one helper `endPresenceForMember(c, scope, memberId, {onlySeatId?})` in `src/server/presence/` (or `seats/`).
  - It runs `update presence set checked_out_at = now(), checked_out_by = 'system' where org_id = $1 and member_id = $2 and checked_out_at is null [and seat_id = $3]`, then writes one audit entry per row (`presence.system_check_out`, with `reason: "seat_released" | "seat_reassigned" | "member_deactivated"`).
  - It must run before the seat update (or after, in the same transaction), and only when the checked-in seat itself is lost.
- `releaseSeat` and `writeOccupant`: end the row only if `presence.seat_id` equals the lost seat. If the member keeps another seat in that room, the row stays and keeps pointing at the lost seat, so repoint it instead:
  - Either move the row to the member's lowest remaining seat in that room, or end it. The spec says "losing the checked-in seat ends the check-in" (D82), so end it. This is simpler, and the member can check in again.
- `deactivateMember`: end all open rows for the member, in the same transaction, after the member row lock.
- Add `checked_out_by` as text with a check constraint (`'self'`, `'system'`, plus later `'provider'`). Store only the actor kind. No sub is needed.
- Source column: `source in ('self','provider')`.

**Presence read** (`GET /api/rooms/[id]/presence`)
- Response: `{ items: [{ memberId, displayName, seatId, seatCode, checkedInAt, source }] }`, with `Cache-Control: no-store`. The room must belong to the org (404).
  - Filter to `work_date = today (UTC+7) and checked_out_at is null`. Prior-day rows count as ended.
  - Order by `checked_in_at, seat code` for stable polling output.
- Include the caller's own record. For the client's convenience, add `me: PresenceDto | null` (the caller's active check-in in any room), so the popup (PRE-02) can decide without a second call. Optionally split this into `GET /api/me/presence`.
- Include the pixel-look/photo keys that the "Who's here" list needs for the character head only if the existing seats DTO already exposes them to Users (`occupantHasPhoto`, `photoVersion`). Reuse that exact shape to stay consistent.

**Privacy for plain Users** (consistent with SIM-050 and SIM-052)
- The spec says every member sees everyone's presence with no hidden presence (PRE-06), so rows are not filtered by tier.
- Expose only: member id, display name, seat id and code, check-in time and source, and the avatar and photo fields that the seats API already shows Users.
- Never return email (SIM-050 hides it from Users), employee code or group or project. Never expose device data (SIM-052).
- Never return `checked_out_by`, audit data or a prior-day history.
- The caller's tier does not change the shape, so there are no tier branches and no tier argument is needed. That also keeps it easy to test: one shape, with a DB test that an email-bearing member row returns no email.
- Keep presence out of exports, reports, the dashboard and search (D78). A grep guard or test over those modules is cheap.

**Migration** `db/migrations/<ts>_presence.sql` (High path, forward-only):
- Table `presence(id uuid pk, org_id, member_id, seat_id, room_id, work_date date, checked_in_at timestamptz, source text, checked_out_at timestamptz null, checked_out_by text null)`.
- Unique `(org_id, member_id, work_date)`. Composite FKs `(org_id, member_id)` and `(org_id, seat_id)`, following how other org tables are declared.
- Index `(org_id, room_id, work_date) where checked_out_at is null` for the read.
- Check: `(checked_out_at is null) = (checked_out_by is null)`.
- Denormalise `room_id` from the seat on write, so the read needs no join. A DB test should assert it matches the seat's room.

## Risks
- **Error naming the current room:** `already_checked_in` must "name the current room", but the error body has only `code` and an optional `rooms` number. Extend `ApiErrorBody` with `roomId?: string` (a small, additive type change, and `apiError` needs an optional extras argument). This touches `respond.ts` and `error.ts`, and the `respond.test.ts` shape tests. Alternative: return it in the 409 body under `error.roomId`.
- **D82 lock order:** the hooks sit inside `releaseSeat`, `writeOccupant` and `deactivateMember`, which have careful lock ordering. The presence row update must come after the member and seat locks and must not take a new lock that precedes them. Add a DB test that runs two concurrent paths (release while moving).
- **Seat or room delete FK:** an FK on `presence.seat_id` or `room_id` blocks `deleteSeat` and the room delete after the first check-in. Use `on delete cascade` on `seat_id` (the row is display-only, D78 allows dropping it) and say so in the plan, or the delete paths would fail with 500.
- **Missing hook coverage:** `requests/approve` and any other path that changes `occupant_id` without `writeOccupant`. I found only the four `occupant_id` writes (`writeOccupant`, `releaseSeat`, deactivation, room and seat delete), but confirm approve goes through `writeOccupant`.
- **Clock:** if the work date comes from the app clock and `checked_in_at` from the DB, they can disagree near midnight. Use one instant for both.
- **Reopen audit:** the audit log must still show the earlier check-in (D81), so never rewrite earlier audit rows, only add new ones. The row itself loses the earlier time, by design.
- **Size:** it is at the top of M, as the ticket says. Presence rules and the DTO read are cleanly separable from the D82 hooks if it must be split.

## Open questions
1. Status for a check-in that reopens or inserts: 201 for any write and 200 for a no-op, or 200 for everything? The ticket only fixes 200 for no-ops.
2. Check-out path: room-less (`POST /api/presence/check-out`, my pick) or room-scoped? And should check-out echo the closed record or `null` when there was nothing to close?
3. Should the read include `me` (the caller's own active check-in in any room), or should the popup call a separate `GET /api/me/presence`? PRE-02 needs "checked in today from any source" before the room view loads.
4. Is it acceptable to extend the error body with `roomId` for `already_checked_in` (a small shared-type change), or does Ming prefer the room name or code instead of the id?
5. When the checked-in seat is lost but the member keeps another seat in the same room, end the check-in (per D82 wording, my pick) or repoint it to the lowest remaining seat?
6. Display name: which field is the existing "who is here" label (members have a display name column)? Confirm it is already visible to Users via the seats occupant DTO, so presence adds no new exposure.
7. Cascade or restrict on seat and room deletion for presence rows (see Risks)?
