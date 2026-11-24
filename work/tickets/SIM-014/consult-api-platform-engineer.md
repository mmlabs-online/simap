## Findings

- **Schema is ready, so there is probably no new migration.** `seat_requests` is in `db/migrations/20261120150000_init.sql` (lines 143-166).
  - Columns: id, org_id, seat_id, subject_id, created_by_id, status, note, decided_by_id, decided_at, created_at, updated_at.
  - Status is one of pending, approved, rejected, cancelled.
  - The check `(status='pending') = (decided_at is null)` means every transition out of pending must set `decided_at`. Cancel included.
  - The partial unique index `seat_requests_one_pending_idx (org_id, seat_id, subject_id) where status='pending'` is the dedupe backstop.
  - The seat FK is `on delete cascade`. The member FKs have no cascade.
  - Indexes exist for (org_id, status, created_at desc) and (org_id, subject_id, created_at desc).
- **`members.requests_seen_at timestamptz null` already exists** (init.sql:46). That is the intended badge mechanism.
- **Seats service (`src/server/seats/seats.ts`).**
  - Lock order is member, room, seat, devices.
  - `setOccupant` does an unlocked read of room_id, locks the member `for share` and checks `status='active'` (else 422 `member_not_assignable`), then calls `lockSeatIn(room 'share', seat 'for update')`.
  - It refuses `seat_cannot_seat` (409) and `occupant_changed` (409). It runs `demotePrimary`, updates `occupant_id` and an inherited `group_id`, then calls `writeAudit` with actions `seat.assign`, `seat.replace` or `seat.unassign`.
  - Private helpers (`Abort`, `inTx`, `lockSeat`, `lockSeatIn`, `demotePrimary`, `loadSeat`) are not exported. `Db`, `Result` and `Refusal` are exported. `Refusal.code` is a closed union.
  - `decideOccupantChange` lives in `src/lib/seats/rules`.
- **Auth wrapper (`src/server/http/with-auth.ts`).**
  - `withAuth(handler, {tier})` does verify, then org, then tier, then the member deactivation gate, and only then the handler. This satisfies R7.
  - `ctx` carries `sub`, `tier` and `scope`.
  - Routes use `apiError(status, code)`. `ApiErrorCode` is a closed list in `src/lib/api/error.ts`.
  - The member row is looked up by `sub`, as `releaseSeat` does. A user with no linked member gets no row.
- **SIM-013 (open PR)** adds `src/server/devices/*` and new codes in `src/lib/api/error.ts`. Both branches will append to the same `API_ERROR_CODES` array, so expect a trivial merge conflict. The `Refusal` union in seats.ts is not touched by SIM-013 as far as I can tell. I did not read the branch.
- **Cannot-seat and occupancy checks.** Both exist only inside `setOccupant`. Request creation needs its own check of occupied and cannot-seat. The error codes `seat_not_empty` and `seat_cannot_seat` already exist and can be reused.

## Recommendations

**Layout.** Add `src/server/requests/requests.ts` (service), `src/lib/requests/rules.ts` (pure state machine), `src/lib/validate/request.ts`, `src/lib/requests/types.ts` and copy in `src/ui/copy/requests.ts`.
- To avoid duplicating lock code, export a small `src/server/seats/locks.ts` from seats.ts. It would hold `lockSeatIn`, `demotePrimary` and `Abort`/`inTx` equivalents.
- Better still, extract an exported `assignOccupantTx(c, scope, actorSub, seatId, memberId)` out of `setOccupant`. Approve then reuses exactly the DEV-06 and group-inheritance logic and cannot drift from SEA-03.
- Refactoring seats.ts is within the ticket because it is needed for AC2.

**Endpoint contract** (all JSON, `Cache-Control: no-store`, ids checked with `isCanonicalUuid`, else 404):

| Method and path | Tier | Notes |
|---|---|---|
| `POST /api/requests` body `{seatId, note?}` | user | Subject is always the caller's own member (D23). A body `subjectId` is rejected with 400, or ignored. |
| `GET /api/requests/mine` | user | Own requests, newest first, bounded page. Returns `{items, unseen}`. |
| `POST /api/requests/mine/seen` | user | Sets `requests_seen_at = now()`. Idempotent. |
| `GET /api/requests?status=&cursor=` | manager | Approvals list. Filter is pending, approved, rejected or cancelled (default pending). Bounded page. Joins seat code, room code, subject name and the current occupant. |
| `POST /api/requests/[id]/approve` | manager | Empty body. |
| `POST /api/requests/[id]/reject` | manager | Optional `note`. |
| `POST /api/requests/[id]/cancel` | user | Own pending only. |

- Use POST action sub-resources rather than PUT, to match the existing style (`release`).
- `GET /api/requests/mine/summary` or the `unseen` field in the layout payload serves the nav badge.
- **POST create:** 201 with the DTO when new. For a duplicate, return 200 with the existing pending request, not an error, so a retry is safe. AC1 says "creates nothing".
- **Approve and reject responses:** return the DTO. A non-pending request returns 200 with the unchanged DTO and no write, no audit row and no side effects. This is the literal reading of REG-02: "changes nothing".
- **DTO:** `{id, status, seat{id, code, roomCode}, subject{id, displayName}, note, createdAt, decidedAt, decidedBy}`.

**Error codes.** Reuse `not_found`, `seat_not_empty` (409), `seat_cannot_seat` (409), `member_not_assignable` (422) and `not_allowed` (409).
- Add `member_required` (403, but it must come before any side effect) for a user with no linked member. The alternative is 422 `member_not_assignable`.
- Because R7 reserves 401/403 for the auth wrapper, use a 409 or 422 domain code such as `no_linked_member` (422) instead. I recommend 422 `no_linked_member`.
- A cancel by someone else's request should return 404, so existence is not leaked. Alternatively return 409 `not_allowed`. Pick one and test it. The ticket AC says "cancel only their own", and 404 for another user's request is safest.
- Cancelling a non-pending request gives 200 with no change, or 409 `request_not_pending`. Prefer the idempotent no-op to match REG-02.
- Add the new codes to `API_ERROR_CODES` in a separate, alphabetically stable, append-only block, to ease the SIM-013 merge. Rebase after SIM-013 merges.

**State machine** (pure, in lib, unit-tested):
- pending → approved, rejected or cancelled.
- The three terminal states never change.
- Rules: `decideCreate({seatOccupied, cannotSeat, existingPending})` returns create, dedupe or refuse_*.
- `decideDecision({status})` returns apply or noop.
- `decideCancel({status, actorMemberId, subjectId})` returns cancel, noop or refuse.
- Include a table-driven test of all 4 statuses × actions.

**Create transaction.**
1. Resolve the caller's member by `sub` and check it is active (`for share`). Subject = caller.
2. Lock room `share` and seat `for update` (the existing `lockSeatIn`). This serialises with approve and assign.
3. Refuse `seat_not_empty` if `occupant_id` is not null (also when the occupant is the caller).
4. Refuse `seat_cannot_seat` if the seat is flagged.
5. `insert ... on conflict (org_id, seat_id, subject_id) where status='pending' do nothing returning`. If no row came back, select the existing pending request and return it.
6. Audit action `request.create`.
- Every query goes through `orgQuery` (R6).

**Approve transaction and lock order.** This must fit the existing order member, room, seat, devices.
1. Unlocked read of the request for its `seat_id`, `subject_id` and room_id. Return 404 if it is missing.
2. Lock the subject member `for share`. If it is not active, refuse 422 `member_not_assignable`. The request stays pending, and the Manager can reject it.
3. Lock room `share`, then seat `for update` (`lockSeatIn`).
4. Only then lock the request row `for update` and re-read its status. A concurrent cancel or reject sees the lock, and when it unblocks it finds a non-pending row. If the status is not pending, return a noop DTO with no write.
   - Cancel and reject lock only the request row, then check the status. They never wait on a seat or member lock, so there is no cycle. If reject also touches the seat, it must use the same order.
5. Refuse 409 `seat_cannot_seat` or `seat_not_empty` (or `occupant_changed`). The seat is occupied if a Manager assigned someone directly after the request was made.
   - **Decision for the plan:** on refusal, do not auto-reject. The refusal rolls back the transaction, so a stale request stays pending until a Manager rejects it. An alternative is to reject it in the same transaction, but a thrown `Abort` rolls back that write. That would require returning a result instead of throwing.
6. Run the shared assign step: `demotePrimary`, set `occupant_id` and the inherited group, and write `seat.assign` audit.
7. `update seat_requests set status='approved', decided_by_id, decided_at=now(), updated_at=now() where id`.
8. `update ... set status='rejected', decided_by_id, decided_at=now() where org_id and seat_id and status='pending' and id <> $id returning id`. This covers rivals in one statement.
9. Audit `request.approve`, with `meta {seat, rejectedRivals: n}`. Optionally write one `request.reject` row per rival (`auto:true`).
10. Return the DTO.
- Row-lock order for rivals: the seat lock already serialises every approve for a seat, so the bulk update of rivals cannot deadlock with another approve. A rival's cancel only takes its own row lock. The bulk update waits for it and then re-evaluates the `where status='pending'` condition. Postgres re-checks the predicate after the lock is released, so this is safe.

**Dedupe.** The partial unique index is authoritative, and `on conflict do nothing` is the mechanism. Seat-lock serialisation means the race is rare anyway. Add a DB test with two concurrent creates.

**"Newly decided" badge.**
- Use `members.requests_seen_at`. `unseen = count(*) from seat_requests where org_id=$1 and subject_id=$me and status in ('approved','rejected') and decided_at > coalesce(requests_seen_at, '-infinity')`.
- **Decision:** whether auto-rejected rivals count as decided. They do, because they are rejected.
- **Decision:** whether Manager cancellations count. Cancelled requests are decided by the user, so no.
- "Mark seen" fires when the My requests page opens, after the list has rendered, so the list can still highlight the new rows from the `unseen` snapshot. The API returns each item's `isNew = decided_at > requests_seen_at` and the page keeps it in state until it is left.
- Use `update members set requests_seen_at = now()`. To avoid losing a decision that landed between the list load and the mark, the client can send `seenUpTo` (the max `decided_at` it received) and the server sets `requests_seen_at = greatest(coalesce(requests_seen_at,'-infinity'), seenUpTo)`. This is the correct approach, but note that the `now()` variant is simpler. Recommend `seenUpTo`.
- The nav badge polls or refetches on focus. Do not add push or email (D24).

**Tests (R5).**
- Pure unit tests for the state machine and the badge predicate.
- Route tests that every export is wrapped by `withAuth` and that the tiers are right (pattern in `seats-routes.test.ts`).
- DB tests (`*.db.test.ts`): duplicate create, occupied and cannot-seat refusals, approve with two rivals (primary demoted, rivals rejected, one transaction), approve of a non-pending request is a noop, cancel by a non-owner, a deactivated subject, and a concurrent approve and cancel.
- UI: copy in `src/ui/copy/requests.ts` (D36). The Approvals page is at `src/app/(app)/approvals/`, with Manager+ gating in the UI as well as the API. R1 import rules apply.

## Risks
- Approve after a direct assign (SEA-03) leaves stale pending requests. Handle it as above, or additionally reject pending requests for the seat in `setOccupant` and `releaseSeat` when someone is seated. The latter is out of scope per R4, so list it as a follow-up and decide with Ming.
- The `Refusal` union is closed. Extending it is cheap, but a shared type change in seats.ts will conflict if SIM-013 also edits it.
- `apiFetch` re-sends once on 401/403 (R7). Our routes never emit these after a write, so approve is safe.
- The bulk reject of rivals is the only multi-row write. Keep it a single statement so it stays atomic under concurrency.
- The pending-request marker on the map (LAY-06) needs a "pending request on this seat" flag in the seat DTOs. That is out of scope for this ticket, so add it as a follow-up.
- Deactivated members: pending requests remain, and `seat_requests` has no cascade from members, so member delete or deactivate paths are unaffected. Approve refuses.

## Open questions
1. A request for a seat that is later directly assigned: leave it pending (my default), or auto-reject? And does `setOccupant` clean up?
2. A user without a linked member: 422 `no_linked_member` (my pick) or 403?
3. Non-pending approve, reject or cancel: 200 noop (my pick, matches REG-02) or 409 `request_not_pending`?
4. Does requesting a seat the user already occupies get `seat_not_empty`? I assume yes.
5. Does the Manager approvals list include Admin+? Assume yes (`tier: "manager"` means at least manager).
6. `note`: required, optional, or dropped? The column exists and the spec does not mention it. I suggest optional and length-capped.
7. Does the badge also appear on the nav for Managers (pending count)? Not in the spec, so skip it.
