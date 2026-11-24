## Findings
- SIM-014 already gives `RequestDto`, `loadRequest` (requests.ts:57), `ISO` formatting, `orgQuery` with org_id repeated on every join, and the `[id]/{approve,reject,cancel}` and `route.ts` (POST) routes.
- Gaps:
  - `RequestDto` has no `note` and no current occupant.
  - There are no list or mine queries, and no `requests_seen_at` code.
  - The `members.requests_seen_at` column exists (init.sql:46).
  - `seat_requests` has an index on (org_id, status, created_at desc) and on (org_id, subject_id, created_at desc). Both serve the keyset order.
- The audit cursor is `{at, id}` with `at` in microsecond ISO form, produced by `to_char(... US)`. `decodeCursor` is strict (src/lib/audit/cursor.ts) and not audit-specific. It can be reused as is.
- `parseAuditQuery`'s `instant()` accepts only millisecond instants. It is not suitable for `seenUpTo`, because decided_at has microseconds (see seen below).
- Route segments:
  - `/api/requests/mine` and `/mine/seen` are static segments and take precedence over `[id]`.
  - `[id]` has no `route.ts` of its own, only `approve`, `reject` and `cancel` subfolders.
  - `/api/requests/mine/approve` therefore resolves to `[id]/approve` with id=`mine`. The route must reject it through `isCanonicalUuid`, which gives 404. Add a test for it.
  - There is no real conflict. Keep `mine` and `seen` as sibling static folders: `src/app/api/requests/mine/route.ts` and `src/app/api/requests/mine/seen/route.ts`. Add `export const dynamic = "force-dynamic"`.

## Recommendations
**Contract (no new error codes, so no merge conflict with PR #59 in `src/lib/api/error.ts`).** Invalid query returns 400 `invalid_request`. Every response carries `Cache-Control: no-store`.
- `GET /api/requests?status=&cursor=&limit=` with `withAuth({tier:"manager"})`.
  - Users get 403 from the wrapper, which covers AC1.
  - `status` is one of pending|approved|rejected|cancelled, default `pending`.
  - A repeated or unknown `status` gives 400. Blank means absent, as in the audit parser.
  - `limit` follows the audit style: default 50, max 100, strict regex. Define `REQUEST_LIMITS` in `src/lib/requests/types.ts`.
  - Response: `{items: RequestListItemDto[], nextCursor: string | null}`.
- `GET /api/requests/mine?cursor=&limit=` with tier `user`. Response: `{items: MyRequestDto[], unseen: number, nextCursor}`.
- `POST /api/requests/mine/seen` with tier `user`. Body `{seenUpTo?}`. Response: `{unseen: number, requestsSeenAt: string | null}`.

**Validator.** Add `src/lib/validate/request-query.ts` (parseRequestListQuery, plus a mine variant without `status`). Copy the `get()` dup/blank helper from audit-query. Better, export that helper from a shared lib file rather than copy it a third time, but only if it is a trivial move.

**Cursor.** Reuse `encodeCursor` and `decodeCursor` unchanged. The status filter is applied in SQL, so a cursor reused with a different status stays well-formed. That is harmless.
- Query: `(q.created_at, q.id) < ($at::timestamptz, $id::uuid)`, `order by q.created_at desc, q.id desc`, `limit $n+1`. Cut the page to `limit` and emit `nextCursor` from the last kept row, exactly as `listAudit` does.
- Order: use created_at desc for every status, so one cursor shape matches the existing indexes. An oldest-first pending queue would be a different order and needs its own index and cursor direction. Make it a follow-up. Open question 1.

**Joins and DTO.**
- Extract the select and joins from `loadRequest` into a shared fragment, so detail, list and mine cannot drift.
- Add `left join members o on o.org_id = s.org_id and o.id = s.occupant_id` for `currentOccupant: {id, displayName} | null`. Verify the `seats.occupant_id` column name.
- `RequestListItemDto = RequestDto & {currentOccupant}`.
- `MyRequestDto = RequestDto & {isNew: boolean}`.
- Do not widen `RequestDto` itself, so the existing POST responses stay unchanged and the change is additive.
- Skip `note`. The DTO never had it, and adding it needs a spec decision.

**Mine.**
- Resolve the member by `sub` within the org. A user with no linked member gets `{items: [], unseen: 0, nextCursor: null}` on GET, not an error.
- Filter `q.subject_id = me.id`.
- `isNew` is computed in SQL: `q.status in ('approved','rejected') and q.decided_at > coalesce(m.requests_seen_at, '-infinity')`. Pending and cancelled are never new (cancel is the user's own act). Auto-rejected rivals count as new, per the SIM-014 consult.
- `unseen` is a separate `count(*)` with the same predicate over all of the caller's requests, not just the page.
- Run the page and the count in one read transaction, or a single statement with a CTE, so `isNew` and `unseen` agree. Put the predicate in a pure `isUnseen(status, decidedAt, seenAt)` helper in `src/lib/requests/` for unit testing. Keep the SQL equal to it, and let the DB test pin both.

**Mark seen.**
- Body `{seenUpTo?: string}`. If absent, use now().
- Accept only the microsecond form (the `AT_RE` shape in cursor.ts, or a shared helper) and bind it as a `::timestamptz` string. A ms-truncated value would sit below the µs `decided_at` and leave it unseen.
- One atomic statement: `update members set requests_seen_at = greatest(coalesce(requests_seen_at,'-infinity'), least($1::timestamptz, now())) where org_id=$org and sub=$sub returning requests_seen_at`.
  - It never moves backwards, never goes past now, and is idempotent.
  - A future `seenUpTo` is capped silently, not 400.
  - Malformed gives 400.
- Then return the recomputed `unseen`. Do not audit-log this (noise).
- User with no member row: 200 `{unseen:0, requestsSeenAt:null}` (a no-op), consistent with GET mine. The alternative is 422 `no_linked_member`, which SIM-014 uses for create. Open question 2.
- Do not add new locking. A single UPDATE is enough, and it does not touch seats or requests, so lock order is unaffected.

**Null `requests_seen_at`.** Treat it as `-infinity`, so every decided request counts as unseen until the first mark-seen. This is correct for existing members. The feature is new and there are no decided requests from before SIM-014. No backfill migration is needed, and R2 does not apply because there is no schema change. Document this in the plan. A backfill to now() would only matter if requests had existed, which they have not.

**Tests (R5).**
- Unit:
  - `parseRequestListQuery`: default status, bad or duplicate status, blank values, limit bounds, bad cursor.
  - `isUnseen` for each of the 4 statuses × seen null, before and after.
  - seenUpTo parser: ms form rejected or accepted per the decision, µs accepted, garbage rejected.
- Routes (pattern in `src/app/api/requests/requests-routes.test.ts`):
  - Each new export is wrapped by `withAuth` with the right tier. List is manager, mine and seen are user.
  - `/api/requests/mine/approve` with id=`mine` gives 404.
- DB (`requests.db.test.ts`):
  - List filters by each status and is scoped to the org: a second org's rows never appear.
  - Cursor paging across rows with identical created_at, with no duplicates or gaps, and a stable end (`nextCursor` null).
  - The current occupant is joined, and is null for an empty seat.
  - Mine returns only the caller's rows.
  - isNew and unseen across approve, reject, auto-rejected rival and cancel.
  - seen moves forward only, cannot go backwards, and is capped at now.
  - seen with null `requests_seen_at`.
  - seenUpTo at exactly a decided_at µs value clears isNew for that row but not for a later one.
  - A decision landing after the list load stays unseen after a mark with the earlier seenUpTo.
  - Member with no linked row.

## Risks
- A ms vs µs mismatch in `seenUpTo` silently leaves badges stuck. This is the main correctness risk, so test the exact string round-trip (decidedAt out, seenUpTo in).
- The unseen count and the page can disagree if they run in separate autocommit statements.
- `apiFetch` retries on 401/403 only. All new handlers are reads or an idempotent update, and the wrapper authenticates first, so R7 holds.
- A deep status filter with created_at paging is index-friendly, but `limit` max must stay bounded (100) to avoid heavy joins.
- Reusing audit's `decodeCursor` couples two features. Moving it to a neutral lib name later is a follow-up. Do not rename it in this ticket (R4).

## Open questions
1. Approvals ordering: newest first for all statuses (my pick, cheap), or oldest-first for pending?
2. No linked member on `mine/seen`: no-op 200 (my pick, matches GET mine) or 422 `no_linked_member`?
3. A `seenUpTo` in the future: silently cap (my pick, per the ticket) or 400?
4. Should `mine` take a cursor? The ticket lists none, but without one rows past the limit are unreachable. I recommend adding it, since it reuses the same code.
5. Add `note` to the DTOs now (needs a spec decision) or keep it out (my pick)?
