Status: READY

# Plan — SIM-014: Seat requests and approvals (slice 1: request state machine and write API)

This plan covers **slice 1 only**: the pure request state machine plus the four write endpoints (create, approve,
reject, cancel). All five acceptance criteria of the ticket are write-side, so this slice meets all of them. The
Approvals list, My requests and the UI are moved to SIM-014.1 to SIM-014.3 (see `## Split proposal`).

## Scope summary
`docs/spec-v1.md` REG-01 (lines 371-375):
> - [ ] From the detail of an empty seat, a user requests it, and a pending request is created.
> - [ ] A second identical pending request (same seat and member) creates nothing new.
> - [ ] A request for an occupied seat is refused.
> - [ ] A User may request a seat in any room of the org (D21), for themselves only (D23).

REG-02 (lines 377-383, the write parts):
> - [ ] Approving seats the subject (demoting any primary, DEV-06), marks the request approved, and rejects every other
>   pending request for that seat, all in one transaction.
> - [ ] Rejecting marks the request rejected. Approving or rejecting a request that is not pending changes nothing.
> - [ ] Manager+ assign directly without a request (SEA-03). Only Users go through the approval flow.
> - [ ] The requester can cancel their own pending request (D24).

SEA-01 (line 232-233): "Such a seat [cannot seat] cannot be assigned or requested".

`work/decisions.md`:
- D21 "Users may request a seat in any room of the org."
- D23 "Users request seats only for themselves; Managers assign others directly."
- D24 "Requesters can cancel pending requests; decisions show in-app ... no email." (in-app list is slice SIM-014.3)
- D26 "Keep the per-seat 'không xếp chỗ' flag with a reason; it blocks assignment and requests".

Ticket ACs (ticket.md lines 32-36) are the table below.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A second pending request for the same seat by the same member creates nothing. | `requests.db.test.ts` › "duplicate create returns the existing pending request, one row, one audit row" and › "two concurrent creates leave one pending row"; `requests-routes.test.ts` › "create: created -> 201, duplicate -> 200 with the same body". |
| 2 | Approving seats the requester, demotes any primary and rejects all other pending requests for that seat. | `requests.db.test.ts` › "approve with two rivals: occupant set, primary demoted, request approved, both rivals rejected, audit rows" and › "approve that fails at the seat step rolls back everything" (atomicity); › "concurrent approve of two rivals: one approved, the other ends rejected, second call is a no-op". |
| 3 | Requests for occupied or cannot-seat seats are refused. | `rules.test.ts` › `decideCreate` / `decideApprove` tables; `requests.db.test.ts` › "create on occupied seat -> 409 seat_taken", › "create on cannot-seat seat -> 409 seat_cannot_seat", › "approve after the seat was taken / flagged -> 409, request stays pending". |
| 4 | The requester can cancel only their own pending request. | `requests.db.test.ts` › "owner cancels pending -> cancelled, decided_at set", › "another member cancels -> 404, row unchanged", › "cancel of a non-pending request -> 200, unchanged, no audit"; `requests-routes.test.ts` › cancel tier `user`. |
| 5 | Unit tests cover the request state machine. | `src/lib/requests/rules.test.ts` (table of 4 statuses x approve/reject/cancel, plus create/approve refusals) runs in `pnpm test`. |

All checks green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`;
`pnpm test:db` in CI (or locally with `docker compose -f compose.dev.yml up -d`).

## Ming verification after merge
- None for this slice (no UI yet). The ticket's manual test "request -> approve with two rival requests" becomes
  possible in the UI after SIM-014.2 and SIM-014.3; until then it is covered by the DB test of AC2.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/requests/types.ts` | new: `REQUEST_STATUSES`, `RequestStatus`, `RequestDto`, `RequestCreateResult` | shared shape for service, routes and the later UI slices | no |
| `src/lib/requests/rules.ts` | new: pure state machine (`nextStatus`, `decideCreate`, `decideApprove`, `decideCancel`) | AC5, rule 6 (pure logic first) | no |
| `src/lib/requests/rules.test.ts` | new: table-driven unit tests | AC5 | no |
| `src/lib/validate/request.ts` | new: `validateRequestCreate(body)` -> `{seatId}`; unknown keys (including `subjectId`) refused | D23 at the boundary | no |
| `src/lib/validate/request.test.ts` | new | validator tests | no |
| `src/server/seats/seats.ts` | export `inTx`, `refuse`, `notFound`, `lockSeatIn`; widen `Refusal.code` (lines 21-31) with `"seat_taken" \| "no_linked_member"`; extract lines 378-404 of `setOccupant` into exported `writeOccupant(...)` and call it from `setOccupant` | approve must reuse the exact SEA-03 assign step (DEV-06 demote, D32 group inheritance, `seat.assign` audit) and the lock helpers | no |
| `src/server/requests/requests.ts` | new (`import "server-only"`): `createRequest`, `approveRequest`, `rejectRequest`, `cancelRequest`, private `loadRequest`, `lockMembers` | the service | no |
| `src/server/requests/requests.db.test.ts` | new: DB integration tests | AC1-AC4 against real SQL | no |
| `src/app/api/requests/route.ts` | new: `POST` (tier `user`) | create | no |
| `src/app/api/requests/[id]/approve/route.ts` | new: `POST` (tier `manager`) | approve | no |
| `src/app/api/requests/[id]/reject/route.ts` | new: `POST` (tier `manager`) | reject | no |
| `src/app/api/requests/[id]/cancel/route.ts` | new: `POST` (tier `user`) | cancel | no |
| `src/app/api/requests/requests-routes.test.ts` | new: route tests in the style of `src/app/api/seats/seats-routes.test.ts` | tiers, status mapping, R7 | no |
| `src/lib/api/error.ts` | append `"seat_taken"`, `"no_linked_member"` after line 27 | new domain codes | no |
| `src/ui/copy/api.ts` | append the two messages after line 32 (typecheck forces it via `satisfies Record<ApiErrorCode, string>`) | D36 | no |

No High path is touched (`src/server/http/**` is used, not edited). `routes-guarded.test.ts` needs no change: it
scans every `route.ts` automatically.

## Data model / migration
None. `seat_requests` (`db/migrations/20261120150000_init.sql` lines 141-166) already has the status check,
`seat_requests_decided_check ((status = 'pending') = (decided_at is null))`, the partial unique index
`seat_requests_one_pending_idx (org_id, seat_id, subject_id) where status = 'pending'`, and nullable
`decided_by_id`. `note` stays unused (not in the spec). `members.requests_seen_at` (line 46) is for SIM-014.1.

## API contract
All responses `Cache-Control: no-store`. Path ids not matching `isCanonicalUuid` -> 404 `not_found` before any DB
call. 503 `unavailable` when there is no pool. Auth codes (401/403) only from `withAuth` (R7).

`RequestDto`:
`{ id, status: "pending"|"approved"|"rejected"|"cancelled", seat: { id, code, roomId, roomCode }, subject: { id, displayName }, createdAt, decidedAt: string|null, decidedBy: { id, displayName } | null }`
(timestamps as UTC ISO `YYYY-MM-DDTHH:MM:SS.ffffffZ`, same `to_char` as `src/server/audit/audit.ts` line 57).

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `/api/requests` | `{ "seatId": uuid }` (any other key -> 400) | 201 `RequestDto` when created; 200 `RequestDto` (the existing pending one) on duplicate | 400 `invalid_request`; 404 `not_found` (seat); 409 `seat_taken`, 409 `seat_cannot_seat`; 422 `no_linked_member`, 422 `member_not_assignable` | tier `user` (any signed-in tier) |
| POST | `/api/requests/[id]/approve` | no body (not read) | 200 `RequestDto` (approved; or unchanged if it was not pending) | 404 `not_found`; 409 `seat_taken`, 409 `seat_cannot_seat`; 422 `member_not_assignable` (subject deactivated) | tier `manager` |
| POST | `/api/requests/[id]/reject` | no body | 200 `RequestDto` (rejected; or unchanged if not pending) | 404 `not_found` | tier `manager` |
| POST | `/api/requests/[id]/cancel` | no body | 200 `RequestDto` (cancelled; or unchanged if not pending) | 404 `not_found` (missing, or not the caller's own request, or caller has no member row) | tier `user` |

Refusals roll back and write nothing. Non-pending approve/reject/cancel: no write, no audit row (REG-02 "changes nothing").

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/requests/rules.test.ts` › `nextStatus` table: pending x {approve, reject, cancel} -> {approved, rejected, cancelled}; approved/rejected/cancelled x every action -> null (noop) | AC5, terminal states |
| `rules.test.ts` › `decideCreate`: empty+seatable -> create; occupied -> refuse_taken; cannot-seat -> refuse_cannot_seat; occupied+cannot-seat -> refuse_taken (occupied checked first) | AC3, AC5 |
| `rules.test.ts` › `decideApprove`: non-pending wins over everything -> noop; pending+empty -> approve; pending+occupied (also by the subject) -> refuse_taken; pending+cannot-seat -> refuse_cannot_seat | AC2, AC3, AC5 |
| `rules.test.ts` › `decideCancel`: not owner -> refuse (even if non-pending); owner+pending -> cancel; owner+non-pending -> noop | AC4, AC5 |
| `src/lib/validate/request.test.ts` › accepts `{seatId}`; refuses non-object, missing/non-canonical seatId, `subjectId` key, `note` key, other keys | D23 boundary |
| `src/app/api/requests/requests-routes.test.ts` › no Authorization -> 401 on all four handlers, service not called | R7 |
| › tier `user` on approve/reject -> 403 `forbidden`, service not called; tier `user` on create/cancel reaches the service | tiers |
| › non-uuid id -> 404 without calling the service; bad JSON / `subjectId` in body -> 400 | boundary |
| › create: `{created:true}` -> 201, `{created:false}` -> 200, same DTO body; refusals map to `{error:{code}}` with 409/422 | AC1, mapping |
| › `subject` passed to the service is always `ctx.sub` (never from the body) | D23 |
| `src/server/requests/requests.db.test.ts` › create on empty seat -> pending row, `created_by_id = subject_id = caller`, one `request.create` audit row | REG-01 |
| › duplicate create returns the existing pending request, one row, one audit row | AC1 |
| › two concurrent creates (same seat, same member) leave one pending row, both calls ok | AC1 race |
| › a second member can request the same seat (rival) | rivals allowed |
| › create on occupied seat -> 409 `seat_taken`; on a seat the caller already occupies -> 409 `seat_taken`; on cannot-seat -> 409 `seat_cannot_seat`; nothing inserted | AC3 |
| › caller with no member row -> 422 `no_linked_member`; unknown / other-org seat -> 404 | edge |
| › approve with two rivals: seat occupant = subject, the old primary device is secondary, request approved with `decided_by_id` = manager member and `decided_at` set, both rivals `rejected` with `decided_at`, rival for another seat untouched, audit rows `seat.assign`, `request.approve`, 2x `request.reject` | AC2 |
| › approve inherits the subject's group on a seat without a group (D32, via `writeOccupant`) | reuse of SEA-03 step |
| › approve after the seat was taken directly -> 409 `seat_taken`; after cannot-seat set -> 409 `seat_cannot_seat`; request and rivals still pending, no audit | AC3, rollback |
| › approve with a deactivated subject -> 422 `member_not_assignable`, nothing changed | edge |
| › approve / reject of an approved, rejected or cancelled request -> ok, row and audit count unchanged | REG-02 noop |
| › concurrent approve of two rival requests: one approved, the other ends `rejected`, the second call returns it unchanged (no error) | lock order |
| › concurrent approve and owner cancel: final state is either approved (seat assigned) or cancelled (seat empty), never both; no error | lock order |
| › reject pending -> rejected, seat untouched, one `request.reject` audit row | REG-02 |
| › owner cancels pending -> `cancelled`, `decided_at` set (satisfies `seat_requests_decided_check`), `request.cancel` audit row | AC4 |
| › another member cancels -> 404, row unchanged; request of another org -> 404 | AC4, R6 |
| › cancel of a non-pending request -> ok, unchanged, no audit | AC4 noop |
| existing `src/server/seats/seats.db.test.ts` and `seats.test.ts` stay green unchanged | `writeOccupant` extraction is behaviour-preserving |

## Approach
1. **Types and rules (lib).** `src/lib/requests/types.ts` and `rules.ts`, pure, no imports outside `@/lib`:
   - `nextStatus(status, action: "approve"|"reject"|"cancel"): RequestStatus | null` (null = noop, terminal states never change).
   - `decideCreate({ occupantId, cannotSeat }): "create" | "refuse_taken" | "refuse_cannot_seat"`.
   - `decideApprove({ status, occupantId, cannotSeat }): "noop" | "approve" | "refuse_taken" | "refuse_cannot_seat"` (noop first, then occupied, then cannot-seat).
   - `decideCancel({ status, isOwner }): "refuse" | "noop" | "cancel"`.
   Dedupe is not a rule: the partial unique index plus `on conflict do nothing` is authoritative.
2. **Validator.** `src/lib/validate/request.ts` with `validateRequestCreate`, reusing `isPlainObject` / unknown-key
   style of `src/lib/validate/seat.ts` lines 9-16 and `isCanonicalUuid`, returning `Validated<{seatId}>` from `./room`.
3. **seats.ts refactor (behaviour-preserving).**
   - Add `export` to `inTx` (line 43), `refuse` (line 53), `notFound` (line 34), `lockSeatIn` (line 225). Keep `Abort`
     private; `refuse` returns it, and `inTx` catches it.
   - Widen `Refusal.code` (lines 24-30) with `"seat_taken" | "no_linked_member"`.
   - Extract lines 378-404 into
     `export async function writeOccupant(c, scope, actorSub, seat: SeatLock & {roomCode}, memberId: string|null, groupId: string|null, action: "seat.assign"|"seat.replace"|"seat.unassign", extraMeta?: Record<string, unknown>): Promise<number>`
     (demote, update seats, `writeAudit` with the same meta plus `extraMeta`). `setOccupant` computes `groupId` with
     `inheritedGroup` as today and calls it. Export the `SeatLock` type if needed by the signature.
4. **Service `src/server/requests/requests.ts`.** Every query through `orgQuery` (R6), every write in `inTx`.
   Lock order everywhere: **members -> room -> seat -> seat_requests rows** (extends the existing
   member, room, seat, devices order in seats.ts line 181).
   - `lockMembers(c, scope, { sub?, ids? })`: one statement
     `select id, sub, status, group_id from members where org_id = $1 and (sub = $2 or id = any($3)) order by id for share`.
     One statement with `order by id` avoids a deadlock between two member locks (manager approving their own request is fine).
   - `createRequest(db, scope, actorSub, seatId)`:
     a) `lockMembers({sub})`: none -> 422 `no_linked_member`; not active -> 422 `member_not_assignable`.
     b) unlocked `select room_id from seats` (404 if missing), then `lockSeatIn(..., "share")`.
     c) `decideCreate` -> 409 `seat_taken` / 409 `seat_cannot_seat`.
     d) `insert into seat_requests (org_id, seat_id, subject_id, created_by_id) values ($1,$2,$3,$3) on conflict (org_id, seat_id, subject_id) where status = 'pending' do nothing returning id`;
        no row -> select the existing pending id, `created: false`, no audit.
     e) created: `writeAudit` action `request.create`, entity `seat_request`, meta `{ seat: code, room: roomCode }`.
     f) return `{ created, request: await loadRequest(...) }`.
   - `approveRequest(db, scope, actorSub, id)`:
     a) unlocked read `select r.status, r.seat_id, r.subject_id, s.room_id from seat_requests r join seats s on s.org_id = r.org_id and s.id = r.seat_id where r.org_id = $1 and r.id = $2`; missing -> 404; status not pending -> return `loadRequest` (noop, no locks).
     b) `lockMembers({sub: actorSub, ids: [subject_id]})`; subject missing or not active -> 422 `member_not_assignable` (request stays pending).
     c) `lockSeatIn(room_id, seat_id, "share")`.
     d) `select status from seat_requests where org_id = $1 and id = $2 for update`; missing (seat deleted meanwhile) -> 404.
     e) `decideApprove`: noop -> `loadRequest`; refusals -> `refuse(409, ...)` (rolls back, nothing written).
     f) `writeOccupant(c, scope, actorSub, seat, subjectId, inheritedGroup(seat.group_id, subject.group_id), "seat.assign", { requestId: id })`.
     g) `update seat_requests set status = 'approved', decided_by_id = $3, decided_at = now(), updated_at = now() where org_id = $1 and id = $2`
        (`$3` = actor member id or null when the manager has no member row; the column is nullable).
     h) one statement for rivals: `update seat_requests set status = 'rejected', decided_by_id = $4, decided_at = now(), updated_at = now() where org_id = $1 and seat_id = $2 and status = 'pending' and id <> $3 returning id`.
     i) audit `request.approve` (meta `{ seat, subjectId, rejectedRivals: n }`) and one `request.reject` per rival (meta `{ seat, auto: true, approvedRequestId: id }`).
   - `rejectRequest`: `lockMembers({sub})` (actor id for `decided_by_id`, may be absent), then the request row `for update`
     (404 if missing); `nextStatus` null -> `loadRequest`; else update to rejected + audit `request.reject`.
   - `cancelRequest`: `lockMembers({sub})`; no member -> 404. Then
     `select status from seat_requests where org_id = $1 and id = $2 and subject_id = $3 for update`; no row -> 404 (other
     member's or missing; no existence leak). `decideCancel` (`isOwner` true here) -> noop or update to `cancelled` with
     `decided_by_id` = own member id and `decided_at = now()` (required by `seat_requests_decided_check`) + audit `request.cancel`.
   - `loadRequest(db, scope, id)`: join seats, rooms, subject member, left join decided-by member, all joins repeat `org_id`.
5. **Routes.** Copy `src/app/api/seats/[id]/release/route.ts` (and `occupant/route.ts` for the body read with
   `readJson`). Create maps `created` to 201/200. Approve/reject/cancel never read the body. Pass `ctx.sub`, never a body id.
6. **Codes.** Append `seat_taken` ("Someone already sits in this seat.") and `no_linked_member` ("Your member profile
   in this organization isn't set up yet. Open simap's home page to finish it.") to `error.ts` and `ui/copy/api.ts`,
   as a separate trailing block so the SIM-013 merge is a simple union.
7. Tests as listed; run all Checks.

Rules: R1 (routes -> server, lib; server -> server, lib; lib pure; `pnpm check:layers`), R2 (no migration), R6 (every
query via `orgQuery`, all joins on `org_id`, roles only from the token tier), R7 (no 401/403 from handlers; domain
refusals 404/409/422 before or instead of writes; `inTx` rolls back on every refusal), R3 (no config), R5 (tests above).

## Specialist input used
- api-platform-engineer: schema is ready, no migration — **adopted**.
- api: extract the assign step from `setOccupant` so approve cannot drift from SEA-03 — **adopted** as `writeOccupant`.
- api: lock order member -> room -> seat -> request row, request re-read after the seat lock, one-statement rival reject — **adopted**.
- api: duplicate create returns 200 with the existing request; non-pending approve/reject/cancel 200 noop — **adopted** (matches REG-02 "changes nothing", safe on retry).
- api: 422 `no_linked_member` instead of 403 (R7) — **adopted**.
- api: cancel of another member's request -> 404 — **adopted**.
- api: refuse (not auto-reject) an approve on a seat that is now occupied / cannot-seat — **adopted** (also frontend consult risk: an approval must not silently replace an occupant, D18).
- api: reuse `seat_not_empty` for occupied — **rejected**: its copy ("still has an occupant or devices. Clear them first.") is wrong for a requester; new `seat_taken`.
- api/frontend: optional `note` — **rejected** (not in spec or ticket; rule 1).
- api/frontend: GET list, `mine`, `seen` and badge semantics (`seenUpTo`, `isNew`) — **deferred** to SIM-014.1 with the recommendations carried over.
- frontend: `requests-api`, Approvals page, My requests page, nav entry + badge, seat panel button — **deferred** to SIM-014.2 / SIM-014.3.
- frontend: `hasPendingRequest` on `SeatDto` — **deferred** (slice SIM-014.3 decides; create already answers 200 for a duplicate).
- api/frontend: auto-reject pending requests on a direct assign / release, and the LAY-06 pending marker — **out of scope**, follow-ups.

## Assumptions
1. **Tier for create is `user` (all tiers).** REG-01 says "any signed-in user with a linked member"; REG-02's "Only Users go through the approval flow" is read as a UI rule (Managers get Assign instead). The UI slice shows "Request" to Users only.
2. **Approve on an occupied or cannot-seat seat is refused** (409), the request stays pending, and the Manager rejects it. Also when the occupant is the subject themself.
3. **Requesting a seat the caller already occupies** -> 409 `seat_taken`.
4. **Occupied is checked before cannot-seat** when both apply (single deterministic code).
5. **Manager+ means manager or admin** (`tier: "manager"` is a minimum).
6. **A Manager may approve or reject their own request** (harmless; they could assign directly).
7. **`decided_by_id` is null** when the deciding Manager has no member row (column is nullable); audit still records `actorSub`.
8. **Auto-rejected rivals get one `request.reject` audit row each** with `auto: true` (requests cascade on seat delete, so audit is the lasting history).
9. **No cap on how many seats a member may have pending** (spec has none); partial index limits one per seat.
10. **Hotspots with the open SIM-013 PR (state DONE, branch `ticket/SIM-013`)**: `src/lib/api/error.ts` and `src/ui/copy/api.ts` (both append codes; trivial rebase). This plan does not depend on `src/server/devices/*` or `src/lib/devices/*`. If SIM-013 also edits `src/server/seats/seats.ts` (consult believes not; unverified), the `export` additions and the `writeOccupant` extraction may need a manual rebase; behaviour is pinned by `seats.db.test.ts`.
11. **Size:** this slice is about 450-500 source lines plus tests; slightly over the guide but it is the smallest slice that keeps all five ACs together.

## Blocking questions
None.

## Split proposal
| Slice | Title | Contents | Areas | Depends on |
|---|---|---|---|---|
| **SIM-014 (this plan)** | Request state machine and write API | lib rules + types + validator, `writeOccupant` extraction, `POST /api/requests`, `POST /api/requests/[id]/approve\|reject\|cancel`, two error codes, unit + route + DB tests. Meets all ticket ACs. | api | SIM-012 |
| SIM-014.1 | Requests read API and decided badge | `GET /api/requests?status=&cursor=` (Manager+, default `pending`, keyset cursor like `src/server/audit/audit.ts`, validator like `src/lib/validate/audit-query.ts`, joins seat/room/subject/current occupant); `GET /api/requests/mine` (own, newest first, `isNew` per item, `unseen` count of approved/rejected with `decided_at > coalesce(requests_seen_at, '-infinity')`); `POST /api/requests/mine/seen` with `{seenUpTo}` -> `requests_seen_at = greatest(coalesce(requests_seen_at, '-infinity'), least(seenUpTo, now()))`. Adds `GET` to `src/app/api/requests/route.ts`. | api | SIM-014 |
| SIM-014.2 | Approvals page UI | `src/app/(app)/approvals/page.tsx` (replace stub), `src/ui/requests/requests-api.ts`, `requests-state.ts`, `useRequests.ts`, `ApprovalsView.tsx` (status filter in `?status=`, Approve/Reject confirm dialogs, per-row busy), copy `src/ui/copy/requests.ts`. | ui, ux | SIM-014.1 |
| SIM-014.3 | Request a seat, My requests and nav badge | "Request this seat" in the seat panel (`seatButtons`, `actionOutcome`, Users only), `/requests` page with Cancel, nav entry `myRequests` in `src/lib/nav.ts`, `badges` prop on `AppShellView` + `useRequestBadge` (fetch on mount, route change, focus; no polling, D24). | ui, ux | SIM-014.1 |

Follow-ups to file (not slices): reject pending requests for a seat when it is assigned directly (`setOccupant`) or flagged cannot-seat; "pending request" flag on seat DTOs for the LAY-06 map marker.

No collision: `work/backlog.md` and `work/tickets/` have no SIM-014.x yet.
