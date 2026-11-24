## Findings

- **No migration needed.** `db/migrations/20261120150000_init.sql` already has:
  - Seats (L79-107): `occupant_id`, `group_id`, `cannot_seat`, `cannot_seat_reason`, and default geometry (`x`, `y`, `rotation` default 0; `w`, `h` null). `seats_cannot_seat_reason_check` (L99) means a reason is only allowed when `cannot_seat` is true, so clearing the flag must null the reason in the same UPDATE.
  - Rooms: `rooms.seat_counter` (L67).
  - Devices: unique primary per seat (L137), plus deferred triggers (L243-271) that check "primary owned by occupant" at COMMIT, so changing the occupant and demoting the primary in one tx is safe.
  - Seat requests: `seat_requests` cascade-deletes with the seat (L158). `devices.seat_id` is `on delete restrict` (L134), so the DB backs up the delete guard.
  - Audit: `audit_log` is append-only.
  - A migration would be a High path; avoid it.
- **Route param name conflict.** `src/app/api/rooms/[id]/route.ts` and `delete-impact` already use `[id]` (a UUID). The ticket's `/api/rooms/{code}/seats` would need `rooms/[code]/seats`, and Next.js rejects different slug names at the same level. The page route is `src/app/(app)/rooms/[roomCode]/page.tsx` (currently a PageSkeleton, L1-12), which is a different tree and fine. Room codes are also editable (D29), so ids are the stable key.
- **Existing building blocks:**
  - `allocateSeatSeq` (`src/server/rooms/rooms.ts:270-285`) increments the counter and returns `{seq, roomCode}`. It does not lock the room by itself, but its UPDATE takes the row lock.
  - `lockRoom` (L112-125) and the `Abort` / `inTx` / `Result` pattern (L14-38) are reusable. The refusal type is a closed union and must be widened for seats.
  - `formatSeatCode` is in `src/lib/rooms/seat-code.ts:5`.
  - `writeAudit` (`src/server/audit/write.ts:7`) is called inside the tx. Its comment says meta holds "codes, field names and counts only; no secrets".
  - `withAuth({tier})` (`src/server/http/with-auth.ts:39-91`) does 401/403 only before the handler.
  - `ApiErrorCode` is a closed list in `src/lib/api/error.ts:1-16` and needs new entries. `apiError` sends the code only, no message.
  - `GET /api/members` is tier `user` (`src/app/api/members/route.ts:18`), so the picker can reuse it with `status=active`.
- **Lock-order doc** (`rooms.ts:213-223`): 0 member row, 1 room (`for update` when creating or deleting seats, `for share` when changing an occupant), 2 seats `for update` by id order, 3 devices and requests. `deactivateMember` (`manage.ts:343-360`) follows the same order.
- **Audit labels** live in `src/ui/copy/audit.ts`, with tests in `src/ui/audit/audit-state.test.ts`. New actions need labels or the audit screen shows raw strings.

## Recommendations

**Routes.** All are `withAuth`, with `export const dynamic = "force-dynamic"`, `Cache-Control: no-store`, `readJson` (400 `invalid_request` on a bad body), and a canonical-UUID check giving 404. Use ids in paths. This amends the ticket's `{code}` wording (D47 says "e.g."). The page resolves `roomCode` to an id from the rooms list.

| Method and path | Tier | Notes |
|---|---|---|
| `GET /api/rooms/[id]/seats` | user | Seat DTOs: `id, code, seq, status (derived), cannotSeat, reason, occupant {id, displayName}, group, project, devices [{id, name, role, owner}]`. Capped list, ordered by `seq`. |
| `POST /api/rooms/[id]/seats {count}` | admin | `count` integer 1..N (suggest cap 50). 201 with the new seats. |
| `GET /api/seats/[id]` | user | Seat detail (SEA-05) with the room code. |
| `DELETE /api/seats/[id]` | admin | 204. |
| `PUT /api/seats/[id]/occupant {memberId, expectedOccupantId}` | manager | Assign or replace. |
| `DELETE /api/seats/[id]/occupant` | manager | Remove. |
| `POST /api/seats/[id]/release` | user | Self-release. |
| `PATCH /api/seats/[id]/cannot-seat {cannotSeat, reason?}` | manager | Set or clear. |

- `?seat=<code>` on the page needs the code resolved to the detail. Either look it up in the already-fetched room seat list, or add `GET /api/seats?code=`.
- Seat group and project editing (SEA-04) is not in scope for this ticket; there is only the D32 inheritance.

**Add.**
- One tx: `lockRoom` (`for update`), then loop `allocateSeatSeq` `count` times, or add one bulk UPDATE (`seat_counter + $n`, then `generate_series`).
- Insert the seats with default geometry only, using `formatSeatCode(roomCode, seq)`.
- Audit one `seat.create` per seat, with entity `seat`, `entityId`, and meta `{code, room}`.
- A missing room gives 404 `not_found`.

**Delete.**
- One tx: room `for update`, then the seat `for update`, then count devices and read the occupant.
- If there is an occupant or any device, throw Abort 409 `seat_not_empty`. Do not add a bespoke message; the UI copy maps the code to a clear message.
- Otherwise delete the seat (its seat_requests cascade) and write a `seat.delete` audit with meta `{code, room, droppedRequests}`.
- The counter stays, so the number is not reused (D30). This is the same lock mode as `deleteRoom`, so there is no inversion. Add a delete-vs-assign race test.

**Assign / replace: stale-occupant protection.**
- The body carries `expectedOccupantId: uuid | null`, the occupant the client saw when it showed the confirm dialog (or null if it showed the seat empty).
- Under the seat lock the server compares:
  - `current == target`: no-op, 200, no audit (SEA-03). Check this first.
  - `current == expected`: proceed (assign if `current` is null, replace if it is not).
  - Otherwise 409 `occupant_changed`. The UI refetches and re-asks "X sits here. Replace with Y?".
- This needs no second round trip and no server-side confirm state. The same required field covers both the empty and occupied cases.

**Lock order for assign.**
1. Lock the target member `for share` (this conflicts with the deactivate `for update`, so you cannot assign a member who is being deactivated). Check `status = 'active'`, else 422 `member_inactive`. A member not in this org is 404 or 422 (D16).
2. Room `for share`.
3. Seat `for update`.
4. Devices.
5. Audit.

- Refuse when `cannot_seat` is true: 409 `seat_cannot_seat` (D26). Remove and release are still allowed on such a seat.
- In the same tx, run `update devices set role='secondary' where seat_id=$ and role='primary'` (DEV-06) before or alongside the occupant update. The deferred triggers verify at COMMIT. Devices stay on the seat as secondary.
- D32: `group_id = coalesce(group_id, member.group_id)`, applied only when the seat group is null. A replace keeps the existing seat group.
- Audit action `seat.assign` or `seat.replace`, meta `{code, memberId, previousOccupantId, demoted: n, groupInherited: bool}`.

**Remove.**
- Same lock order, without the member lock.
- It is a no-op if the seat is already empty.
- It demotes the primary, clears the occupant, and writes a `seat.unassign` audit.

**Release (REG-03/D22).**
- Tier `user` at the wrapper. The occupancy check is inside the tx.
- Resolve the actor's member row via `members.sub = ctx.sub`.
- If the actor is not the occupant, throw 409 `not_allowed` (the code R7 names for domain refusals), never a 403 from the handler.
- A deactivated actor is already stopped at the wrapper.
- Same demote and clear steps; audit `seat.release`.

**Cannot-seat.**
- Tier manager at the wrapper. The seat lock is the same.
- Body `{cannotSeat: boolean, reason?: string}`, with the reason trimmed and length-capped (validator in `src/lib/validate/`).
- Setting it keeps the occupant (status stays derived). Clearing it nulls the reason.
- Audit meta `{code, cannotSeat, hasReason}`. Do not put the free-text reason in meta.

**Domain refusal codes (all 409/422, added to `API_ERROR_CODES` and `src/ui/copy/api.ts`):**
- `seat_not_empty` (409)
- `seat_cannot_seat` (409)
- `occupant_changed` (409)
- `not_allowed` (409)
- `member_inactive` (422)

Do not use 401/403 anywhere after the first write (R7). Tier checks are only in `withAuth`.

**R6.** Every query goes through `orgQuery` with `org_id = $1`. Locks, devices, requests, and audit all stay in the scope org.

**Size L split (the ticket allows a proposal).** Suggest two PRs, API first.
- **SIM-012.1 (api + lib + server):**
  - `src/lib/validate/seat.ts`, `src/lib/seats/*` (pure rules: assign decision table, DTO types, `decideAssign`), `src/server/seats/*`, all routes above, new error codes, audit copy labels.
  - Unit tests for assign/replace/release/demotion decisions, and for the seat-add counter and delete guard. `*.db.test.ts` for the race and trigger behaviour: replace with a primary, stale expected occupant, delete vs assign, concurrent add (no duplicate seq), counter non-reuse. Also covered by `pnpm test:db`.
  - Update `routes-guarded.test.ts` fixtures only if needed (it scans all `route.ts` files automatically).
- **SIM-012.2 (ui):** room detail page, SeatsTable, SeatDetailPanel at `?seat=`, assign/replace/release/cannot-seat dialogs, room switcher and route re-key, copy in `src/ui/copy/seats.ts`, member picker over `/api/members?status=active`, UI state tests.
- Keep the ticket's "Files" list R1-clean: UI imports only `@/lib` types and `apiFetch`.

## Risks

- A `[code]` vs `[id]` slug mismatch under `api/rooms` breaks the build. Use `[id]`.
- Not locking the target member lets an assign race with a deactivate and leave an inactive occupant. Take the member lock first (rule 0).
- Taking the room `for update` in assign (instead of `for share`) serialises all occupancy changes in a room and risks deadlocks with `deleteRoom` and `deactivateMember`. Follow the documented order exactly.
- Skipping the demotion, or running it after the occupant update, is saved only by the deferred trigger, which would give a 23514 and a 500. Demote inside the same tx and map any constraint error defensively.
- `expectedOccupantId` must be required. If it is optional, the UI's replace confirmation is not race-safe.
- A late `not_allowed` as 403 would make `apiFetch` re-send once (see R7). Use 409.
- Free-text cannot-seat reasons in audit meta are a privacy and size concern. Keep them out.
- Large `count` values run many counter updates in one tx. Cap the count.
- Seat list size has no pagination. Rooms are small, but cap it (e.g. 500, like `listRooms`).

## Open questions

1. Is `/api/rooms/[id]/seats` (UUID) acceptable instead of `{code}` in the ticket? Recommended yes.
2. Should a direct assign also cancel or approve the subject's pending request for that seat (REG flow, SIM-014)? Suggest leaving it to SIM-014 and noting it.
3. Can a seat be marked cannot-seat while occupied? Spec D26 implies yes (the status stays derived). Confirm.
4. Is the `count` cap of 50 right?
5. Should remove or release on an already empty seat be a 200 no-op (suggested) or a 409?
6. Is the two-PR split (API then UI) approved?
7. Should a replace demote the old occupant's primary device only, or also surface "what happens to X" in the UI? Suggest only the demotion, as D18 says.
