# Consult — api-platform-engineer (SIM-010, 2026-11-20)

## Findings
- Schema is ready: `rooms` has unique (org_id, code), `seat_counter >= 0`, and `seats` has unique (org_id, code) and unique (org_id, room_id, seq). `seats_room_fkey` is `on delete restrict`. `devices.seat_id` is `restrict`. `seat_requests` and `layout_fixtures` cascade. So a forced delete must explicitly (1) demote and release primary devices, (2) delete seats, (3) delete the room, in that order. A trigger exists on devices (primary needs seat; lines ~234-258), so the order matters.
- Seats are unique on (org_id, code), so a bulk rename `C302-01 -> C303-01` in one UPDATE can fail on transient collisions only if codes overlap. Swapping room codes (A to B while B exists) is blocked by room uniqueness, so no real collision. If a seat code from room X ever collides with another room's seat code, it would raise 23505 and must map to 409.
- `withAuth` (src/server/http/with-auth.ts) passes `ctx: {sub,email,org,tier}`. It gates on `opts.tier` only, with no per-method tier. SIM-023 will change this to hand handlers an OrgScope. The route shapes below don't depend on it, but handlers should take scope from ctx and not import `orgScopeOf`.
- `apiError(status, code)` returns `{error:{code}}` with no message, and `ApiErrorCode` (src/lib/api/error.ts) is a closed list: unauthenticated, org_required, forbidden, member_deactivated, unavailable, internal. It has no codes for 400, 404, 409 or 422. SIM-010 must extend it.
- No JSON body helper and no `src/lib/validate` content yet. Audit has no writer helper yet. `audit_log` is (org_id, actor_sub, action, entity, entity_id, meta).

## Recommendations
**Routes** (each file is its own withAuth export, one tier per handler):
- `GET /api/rooms` — tier User (every member). Returns an array of `{id, code, name, description, floor, seatCount, occupiedCount}`, with occupancy computed in SQL (`left join seats ... count(*) filter (where occupant_id is not null)`), `order by code`. SYS-02 and the occupancy ring need it.
- `POST /api/rooms` — Admin. Returns 201 with the room.
- `PATCH /api/rooms/[id]` — Admin. Partial body of code/name/description/floor. Include the code-change path here.
- `GET /api/rooms/[id]/delete-impact` — Admin. Returns `{occupiedSeats, placedDevices, seats}`.
- `DELETE /api/rooms/[id]` — Admin. `?force=true`, or a body `{force:true}`. Prefer the query param, since DELETE bodies are unreliable. With force unset and a non-empty room, return 409 `room_not_empty` with the impact counts re-checked inside the transaction (not trusting an earlier GET).
- 404 for a room id not in the caller's org, via `WHERE org_id=$1 AND id=$2`. Never 403.

**Pagination:** the room list is bounded (tens of rooms per org). Return the full list with no cursor, and document the cap. Put a hard `limit 500` in SQL as a safety net. This avoids freezing a paging contract that the dashboard doesn't need (the dashboard needs all rooms for capacity anyway).

**Transactions** (`src/server/rooms/*`, one `withTx(pool, fn)` helper using a PoolClient and `orgQuery`):
- Create: `insert into rooms`; 23505 on `rooms_org_code_key` maps to 409 `room_code_taken`. The audit row is in the same transaction (`room.create`, meta `{code}`).
- Seat codegen (pure function in `src/lib/rooms/seat-code.ts`): `formatSeatCode(roomCode, seq)` pads to 2 digits (3+ digits are allowed once seq > 99, without truncation). `nextSeq` is `seat_counter + 1`. Allocation is `update rooms set seat_counter = seat_counter + 1 where org_id=$1 and id=$2 returning seat_counter, code`. That is atomic, row-locks the room and prevents races. D30 holds by construction because nothing ever decrements. Note the spec text says "highest existing seq + 1" but the D30 counter wins. Never use max(seq)+1.
- The seat-creation function belongs in `src/server/rooms/` for SIM-015.x to reuse, but SIM-010 only needs the generator tested, so export it without a route.
- Rename: `select ... for update` the room; if the code changed, `update rooms`, then `update seats set code = $new || '-' || lpad(seq::text, 2, '0') where org_id=$1 and room_id=$2`, then the audit row `room.update` with meta `{from,to}`. A pure `renameMap(oldCode,newCode,seats)` supports the unit test. Seat codes derive from `seq`, not by string replace, so a corrupted earlier code is repaired too.
- Forced delete: lock the room; `update devices set role='secondary', seat_id=null where seat_id in (room seats)` (check the trigger order and the `devices_primary_needs_seat_check` — set role and seat_id in one UPDATE); `delete from seats` (requests cascade); `delete from rooms` (fixtures cascade); audit `room.delete` with meta `{code, seats, devices, forced}`. Pure `deleteImpact()` rules are unit-tested.
- Audit writer: add `src/server/audit/write.ts` (`writeAudit(client, scope, actorSub, action, entity, entityId, meta)`), reused later. The meta carries only codes and counts, no tokens.

**Validation** (`src/lib/validate/room.ts`, pure, returns `{ok, value}|{ok:false, field}`): code trimmed, 1-32 chars, restricted to `[A-Za-z0-9._-]` (no whitespace, and no characters that would make the seat code ambiguous; the `-` choice also matters since the code is joined with `-NN`); name trimmed, 1-120; description at most 500 and floor at most 40 (nullable, empty becomes null); unknown keys rejected, so `seat_counter` and `org_id` cannot be sent; PATCH needs at least one field. Also require a UUID id param (otherwise pg raises 22P02 and gives a 500).

**Error codes to add** to `API_ERROR_CODES`: `invalid_request` (400, with an optional `field`, which means widening `ApiErrorBody`: `{error:{code, field?}}`), `not_found` (404), `room_code_taken` (409), `room_not_empty` (409; impact counts in body). Keep the message-free shape (UI copy lives in copy files, D36).

**JSON body helper**: add `readJson(req, maxBytes=16k)` in src/server/http, returning a 400 `invalid_request` for non-JSON, wrong content type or oversize. Coordinate with SIM-005/SIM-023 (below).

**Tests**: formatSeatCode, nextSeq, renameMap, deleteImpact, validators, and the error mapping of 23505. Add a DB-level smoke only if CI has Postgres; otherwise state that the transactions are covered by SQL review.

## Risks
- Parallel edits in the same batch: SIM-023 rewrites withAuth/org-scope, and error.ts is shared. Expect merge conflicts. Keep SIM-010's edits to error.ts a minimal append.
- The unsupported "UI hides actions" criterion needs the tier on the client (`@/lib/auth/tier`); check it is available from the token on the client side.
- A forced delete with the device trigger could raise a constraint error if the order is wrong; it must be tested against real Postgres at least manually.
- Concurrent rename vs. seat creation: the `for update` lock on the room row serializes them. Seat creation must take the same lock (the counter update does).
- A mismatch between the spec ROO-02 wording ("highest existing + 1") and D30 (counter) may confuse the reviewer; mention D30 in the code comment.

## Open questions (with proposed defaults)
1. Is the room list open to all members (including Users)? Default: yes, tier User, since everyone sees occupancy.
2. Code charset and length? Default: `[A-Za-z0-9._-]`, 1-32, case-sensitive and unique as typed. Alternative: uppercase normalization (not recommended without Ming's decision, since seatMGT may allow lowercase).
3. Forced delete confirmation: DELETE `?force=true` after a prior GET impact view. Default: yes, with the server re-checking.
4. Should `ApiErrorBody` gain a `field`? Default: yes, optional, only for 400.
5. Audit action names: `room.create`, `room.update`, `room.delete`, plus seat-code regeneration recorded in the `room.update` meta as `{from,to,seats}` (one row, per the spec "with an audit row"). Default: one row.
6. Who owns `readJson` and `writeAudit`: SIM-010 creates both if they are not merged by the time it starts; otherwise reuse. Default: create them minimal in SIM-010 and note it in the handoff.
