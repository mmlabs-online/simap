Status: READY

# Plan — SIM-014.1: Requests read API and decided badge

One slice (slice 2 of 4 from `work/tickets/SIM-014/plan.md` → Split proposal). API only: no UI, no schema change,
no new error codes.

## Scope summary
`docs/spec-v1.md` REG-02 (lines 377-385, the read parts):
> - [ ] The Approvals page lists requests and filters them by status.
> - [ ] "My requests" lists the user's requests with their status; a badge counts requests decided since the user
>   last opened it. No email (D24).

`docs/spec-v1.md` line 63 (Manager role): "Approves or rejects seat requests. ... Sees the Approvals page."

`work/decisions.md`:
- D24 "Requesters can cancel pending requests; decisions show in-app ("Yêu cầu của tôi" with a badge), no email."
- D21, D23, D26 are unchanged by this slice (write rules already in SIM-014).

Ticket scope (ticket.md lines 24-26):
> - `GET /api/requests?status=&cursor=` (Manager+, default `pending`, keyset cursor like `src/server/audit/audit.ts`; joins seat, room, subject and current occupant).
> - `GET /api/requests/mine` (own, newest first, `isNew` per item, `unseen` count of approved/rejected decided after `members.requests_seen_at`).
> - `POST /api/requests/mine/seen` with `{seenUpTo}` (`requests_seen_at` only moves forward, capped at now).

Out of scope (ticket lines 28-29): email notifications, polling or push. UI pages (SIM-014.2, SIM-014.3), so
`src/ui/copy/requests.ts` is **not** created here (no UI copy in this slice; ticket technical note applies to the UI slices).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The Approvals list filters by status and pages with a cursor; Users get 403 from the auth wrapper. | `requests-read-routes.test.ts` › "GET /api/requests: tier user -> 403 forbidden, service not called" and › "tier manager reaches listRequests with the parsed filter"; `request-query.test.ts` › status/limit/cursor cases; `read.db.test.ts` › "list filters by each status and never shows another org's rows", › "cursor pages across rows with the same created_at: no duplicates, no gaps, last page nextCursor null", › "current occupant is joined, null for an empty seat". |
| 2 | My requests shows only the caller's requests, with `isNew` and an `unseen` count of newly approved or rejected requests. | `read.db.test.ts` › "mine returns only the caller's requests, newest first", › "isNew and unseen: approved, rejected and auto-rejected count; pending and cancelled never", › "unseen counts all of the caller's rows, not just the page", › "caller without a member row -> empty page, unseen 0"; `rules.test.ts` › `isUnseen` table. |
| 3 | Mark seen never moves `requests_seen_at` backwards and never past now. | `read.db.test.ts` › "seen moves forward only", › "future seenUpTo is capped at now", › "seenUpTo equal to a decidedAt (µs) clears that row but not a later one", › "seen with null requests_seen_at; seen without seenUpTo uses now"; `request.test.ts` › `validateSeenBody` cases. |
| 4 | Unit, route and DB tests cover the filter, the cursor and the unseen count. | The tests above exist and pass: `pnpm test` (unit + route); `pnpm test:db` in CI (DB). |

All checks green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`;
`pnpm test:db` in CI (or locally with `docker compose -f compose.dev.yml up -d`). The CI `test:db` run must be green
before merge (as for SIM-014).

## Ming verification after merge
None (no UI yet; the badge becomes visible in SIM-014.3).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/requests/types.ts` | append `REQUEST_LIMITS = { defaultLimit: 50, maxLimit: 100 }`, `RequestListFilter`, `MyRequestsFilter`, `RequestListItemDto`, `RequestPage`, `MyRequestDto`, `MyRequestsPage`, `RequestsSeenResult` | shared shapes for service, routes and UI slices | no |
| `src/lib/requests/rules.ts` | add pure `isUnseen(status, decidedAt, seenAt)` | unseen predicate, unit-testable (ticket test plan) | no |
| `src/lib/requests/rules.test.ts` | add `isUnseen` table | AC2, AC4 | no |
| `src/lib/validate/request-query.ts` | new: `parseRequestListQuery(params)`, `parseMyRequestsQuery(params)` | query validation at the boundary | no |
| `src/lib/validate/request-query.test.ts` | new | AC1, AC4 | no |
| `src/lib/validate/request.ts` | add `validateSeenBody(body)` -> `{ seenUpTo: string \| null }` and the µs instant check | seen body at the boundary | no |
| `src/lib/validate/request.test.ts` | add `validateSeenBody` cases | AC3 | no |
| `src/server/requests/requests.ts` | extract the select list + joins of `loadRequest` (lines 39-84) into exported `REQUEST_SELECT`, `REQUEST_FROM`, `RequestRow`, `toRequestDto(row)`, `ISO`; `loadRequest` uses them (behaviour-preserving) | detail, list and mine share one projection (no drift) | no |
| `src/server/requests/read.ts` | new (`import "server-only"`): `listRequests`, `listMyRequests`, `markRequestsSeen` | the read service | no |
| `src/server/requests/read.db.test.ts` | new DB integration tests | AC1-AC3 against real SQL | no |
| `src/app/api/requests/route.ts` | add `GET` (tier `manager`); `POST` unchanged | list endpoint | no |
| `src/app/api/requests/mine/route.ts` | new: `GET` (tier `user`), `dynamic = "force-dynamic"` | mine endpoint | no |
| `src/app/api/requests/mine/seen/route.ts` | new: `POST` (tier `user`), `dynamic = "force-dynamic"` | mark seen | no |
| `src/app/api/requests/requests-read-routes.test.ts` | new route tests (style of `requests-routes.test.ts` lines 1-56) | tiers, 400 mapping, no-store, `mine` as `[id]` -> 404 | no |

No High path is touched (`src/server/http/**` is used, not edited). `src/app/api/routes-guarded.test.ts` scans every
`route.ts` automatically, so the two new routes are covered without editing it. `src/lib/api/error.ts` and
`src/ui/copy/api.ts` are **not** edited (no new codes).

## Data model / migration
None. `members.requests_seen_at timestamptz null` already exists (`db/migrations/20261120150000_init.sql:46`).
Indexes that serve the queries already exist: `seat_requests_org_status_idx (org_id, status, created_at desc)` (:164)
for the list, `seat_requests_org_subject_idx (org_id, subject_id, created_at desc)` (:166) for mine and the unseen count.

**Null `requests_seen_at`** is treated as `-infinity`: every decided request counts as unseen until the first mark.
No backfill: seat requests only exist since SIM-014, so there is no historical decided row to hide. R2 does not apply.

## API contract
All responses `Cache-Control: no-store`. 503 `unavailable` when there is no pool. Invalid query or body -> 400
`invalid_request`. Auth codes (401/403) only from `withAuth` (R7). Timestamps are UTC `YYYY-MM-DDTHH:MM:SS.ffffffZ`
(the existing `ISO` format in `requests.ts:54`).

Types (in `src/lib/requests/types.ts`):
- `RequestListItemDto = RequestDto & { currentOccupant: { id: string; displayName: string } | null }`
- `RequestPage = { items: RequestListItemDto[]; nextCursor: string | null }`
- `MyRequestDto = RequestDto & { isNew: boolean }`
- `MyRequestsPage = { items: MyRequestDto[]; unseen: number; nextCursor: string | null }`
- `RequestsSeenResult = { unseen: number; requestsSeenAt: string | null }`
- `RequestDto` itself is **not** changed (POST responses stay byte-identical).

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/requests` | query `status` (pending\|approved\|rejected\|cancelled, default `pending`), `cursor` (opaque), `limit` (1-100, default 50) | 200 `RequestPage`, newest first (`created_at desc, id desc`) | 400 `invalid_request` | tier `manager` (manager or admin) |
| GET | `/api/requests/mine` | query `cursor`, `limit` (as above); other params ignored (audit-parser style) | 200 `MyRequestsPage`, newest first; `unseen` counts all of the caller's rows | 400 `invalid_request` | tier `user` |
| POST | `/api/requests/mine/seen` | JSON object `{}` or `{ "seenUpTo": "<µs ISO>" }`; any other key, a non-µs or invalid instant, non-JSON -> 400 | 200 `RequestsSeenResult` | 400 `invalid_request` | tier `user` |

Caller without a linked member row: GET mine -> 200 `{ items: [], unseen: 0, nextCursor: null }`; POST seen -> 200
`{ unseen: 0, requestsSeenAt: null }` (no-op). Mark seen writes no audit row.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/requests/rules.test.ts` › `isUnseen`: 4 statuses x seenAt {null, before decidedAt, equal to decidedAt, after}; pending/cancelled always false; approved/rejected true iff seenAt null or decidedAt > seenAt; decidedAt null -> false | AC2 predicate |
| `src/lib/validate/request-query.test.ts` › list: no params -> `{status:"pending", limit:50}`; each of the 4 statuses accepted; unknown status, `status` repeated -> `field:"status"`; blank `status=` -> default pending | AC1 filter |
| › list/mine: `limit` 1 and 100 ok; 0, 101, `01`, `1.5`, `-1`, repeated -> `field:"limit"`; blank -> default | pagination bounds |
| › list/mine: cursor from `encodeCursor` round-trips; garbage, wrong keys, ms-form `at`, repeated -> `field:"cursor"` | AC1 cursor |
| › mine: `status=approved` is ignored (no error, not in the value) | contract |
| `src/lib/validate/request.test.ts` › `validateSeenBody`: `{}` -> `seenUpTo: null`; µs form `2026-11-24T05:00:00.123456Z` accepted unchanged; ms form `...00.123Z`, no fraction, offset `+07:00`, `2026-02-30T...`, number, null, extra key, non-object -> refused | AC3 boundary, µs round-trip |
| `src/app/api/requests/requests-read-routes.test.ts` › no Authorization -> 401 on GET list, GET mine, POST seen; service not called | R7 |
| › tier user: GET list -> 403 `{error:{code:"forbidden"}}`, `listRequests` not called; GET mine and POST seen reach the service | AC1 |
| › tier manager: GET list passes `{status, limit, cursor}` from the URL to `listRequests` | AC1 |
| › bad query (`status=nope`, `limit=500`, bad cursor) -> 400 `invalid_request`, service not called; bad seen body -> 400 | boundary |
| › mine and seen pass `ctx.sub` to the service (never a body or query value); every response has `Cache-Control: no-store` | D23, no-store |
| › `POST /api/requests/[id]/approve` with `id = "mine"` -> 404 `not_found` (consult: route segment check) | routing |
| `src/server/requests/read.db.test.ts` › list filters by each status (one pending, approved, rejected, cancelled row) and never shows another org's rows | AC1, R6 |
| › list default (no status) returns only pending | AC1 |
| › cursor: 5 requests with the same `created_at`, limit 2 -> pages of 2, 2, 1 with ids in `id desc` order, no duplicates or gaps, last `nextCursor` null | AC1 cursor |
| › current occupant is joined (seat occupied by another member) and null for an empty seat | ticket scope |
| › mine returns only the caller's requests, newest first; another member's and another org's rows never appear | AC2 |
| › isNew and unseen: approved, rejected, auto-rejected rival (via `approveRequest`) count; pending and cancelled never; unseen equals the number of `isNew` rows when all fit on one page | AC2 |
| › unseen counts all of the caller's rows, not just the page (limit 1 with 3 unseen -> 1 item, unseen 3) | AC2 |
| › caller without a member row -> mine `{items:[], unseen:0, nextCursor:null}`; seen `{unseen:0, requestsSeenAt:null}` | edge |
| › seen with null `requests_seen_at` and a past seenUpTo sets it; seen without seenUpTo sets it to about now (<= `now()` of a later statement) and unseen becomes 0 | AC3 |
| › seen moves forward only: mark T2, then mark T1 < T2 -> stays T2, response `requestsSeenAt` = T2 | AC3 |
| › future seenUpTo (`2999-01-01T00:00:00.000000Z`) is capped: stored value <= `now()`, no error | AC3 |
| › seenUpTo equal to a row's `decidedAt` string (taken from the mine response) clears that row's `isNew` but not a row decided 1 µs later | µs round-trip (consult risk) |
| existing `requests.db.test.ts` and `requests-routes.test.ts` stay green unchanged | `loadRequest` extraction is behaviour-preserving |

**DB fixture rules (must hold or the tests fail at insert or COMMIT):**
- Every `orgQuery` SQL in `read.ts` contains the literal `org_id = $1` (guard regex in `src/server/http/org-scope.ts:21`). Test-only raw `pool.query` SQL is not guarded but stays scoped by id.
- Decided rows: use `addPendingRequest` (`src/test/db/fixtures.ts:82`), then
  `update seat_requests set status = $2, decided_at = $3::timestamptz where id = $1` with a non-null `decided_at`
  for every non-pending status (`seat_requests_decided_check`, init.sql:156). Never set a pending row's `decided_at`.
- Two pending requests for the same seat need different subjects (`seat_requests_one_pending_idx`, init.sql:163);
  for many rows use different seats (`addSeat` with distinct `seq`).
- Same `created_at`: `update seat_requests set created_at = $2::timestamptz where id = any($1)` (no check on it).
- Occupied seat: `addSeat(..., { occupantId })`. Do **not** add devices; if a device is ever needed, a `primary`
  one must be owned by the seat's occupant (deferred triggers `devices_primary_owner_trg` / `seats_primary_owner_trg`,
  init.sql:225-271, checked at COMMIT), and `seat_id` null requires `role = 'secondary'` (init.sql:130).
- The auto-rejected-rival case goes through `approveRequest` on an empty seat (as `requests.db.test.ts` does), so it
  meets the triggers.

## Approach
1. **lib types and predicate.**
   - Append the types from `## API contract` and `REQUEST_LIMITS` to `src/lib/requests/types.ts`.
     `RequestListFilter = { status: RequestStatus; limit: number; cursor?: AuditCursor }`,
     `MyRequestsFilter = { limit: number; cursor?: AuditCursor }` (`AuditCursor` from `@/lib/audit/cursor`).
   - `isUnseen(status, decidedAt: string | null, seenAt: string | null): boolean` in `rules.ts`:
     `(status === "approved" || status === "rejected") && decidedAt !== null && (seenAt === null || decidedAt > seenAt)`.
     String comparison is exact because both are in the fixed µs ISO format. The SQL below is the authority; the DB
     test pins that both agree.
2. **Validators.**
   - `src/lib/validate/request-query.ts`: a local `get()` dup/blank helper copied from `audit-query.ts:22-26` (do not
     edit `audit-query.ts`; R4). `LIMIT_RE = /^[1-9]\d{0,2}$/` and `REQUEST_LIMITS.maxLimit` as in audit-query
     lines 53-61. Cursor via `decodeCursor` from `@/lib/audit/cursor` unchanged. Result type
     `{ ok: true; value } | { ok: false; field }`. `parseMyRequestsQuery` is the same without `status`.
   - `validateSeenBody` in `src/lib/validate/request.ts`: plain object, only key `seenUpTo` allowed; absent ->
     `null`; present -> must match `/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/` and be a real instant
     (`new Date(s)` valid and `toISOString().slice(0, 19) === s.slice(0, 19)`, the check in `audit-query.ts:12-18`,
     which rejects `2026-02-30`). Return the string unchanged (keeps the µs; it is bound as `::timestamptz`).
3. **Shared projection in `requests.ts`.** Move the select list and joins of `loadRequest` (lines 61-70) into
   exported constants `REQUEST_SELECT` (columns) and `REQUEST_FROM` (from + 4 joins, every join on `org_id`), and
   lines 75-83 into exported `toRequestDto(r: RequestRow)`. Export `RequestRow` and `ISO`. `loadRequest` becomes
   `select ${REQUEST_SELECT} from ${REQUEST_FROM} where q.org_id = $1 and q.id = $2`. No other change.
4. **Service `src/server/requests/read.ts`** (`import "server-only"`, every query via `orgQuery`, R6):
   - `listRequests(db, scope, f: RequestListFilter): Promise<RequestPage>` — one statement:
     `select ${REQUEST_SELECT}, o.id as occupant_id, o.display_name as occupant_name from ${REQUEST_FROM}
      left join members o on o.org_id = s.org_id and o.id = s.occupant_id
      where q.org_id = $1 and q.status = $2 [and (q.created_at, q.id) < ($3::timestamptz, $4::uuid)]
      order by q.created_at desc, q.id desc limit $n::int` with `f.limit + 1`. Use the `bind()` pattern of
     `audit.ts:38-42`. Slice to `f.limit`; `nextCursor = encodeCursor({ at: last.created_at, id: last.id })` only when
     more rows came back (exactly `audit.ts:65-68`). `created_at` is already the µs ISO string, so it round-trips
     through `decodeCursor`.
   - `listMyRequests(db, scope, sub, f: MyRequestsFilter): Promise<MyRequestsPage>` — in
     `withTx(db, ...)` (`@/server/db/tx`), first statement `set transaction isolation level repeatable read, read only`
     (no org data, plain `c.query`), so the page and the count read one snapshot and agree:
     a) `select id, to_char(requests_seen_at at time zone 'UTC', ${ISO}) as seen_at from members where org_id = $1 and sub = $2::uuid`; none -> return `{ items: [], unseen: 0, nextCursor: null }`.
     b) page: `select ${REQUEST_SELECT}, (q.status in ('approved','rejected') and q.decided_at > coalesce($3::timestamptz, '-infinity'::timestamptz)) as is_new from ${REQUEST_FROM} where q.org_id = $1 and q.subject_id = $2 [cursor] order by q.created_at desc, q.id desc limit $n::int` ($2 = member id, $3 = `seen_at` string or null).
     c) count: `select count(*)::int as n from seat_requests where org_id = $1 and subject_id = $2 and status in ('approved','rejected') and decided_at > coalesce($3::timestamptz, '-infinity'::timestamptz)`.
     Map items with `toRequestDto` plus `isNew`.
   - `markRequestsSeen(db, scope, sub, seenUpTo: string | null): Promise<RequestsSeenResult>` — in `withTx`:
     a) `update members set requests_seen_at = greatest(coalesce(requests_seen_at, '-infinity'::timestamptz), least(coalesce($3::timestamptz, now()), now())) where org_id = $1 and sub = $2::uuid returning id, to_char(requests_seen_at at time zone 'UTC', ${ISO}) as seen_at`.
        One atomic statement: never backwards (`greatest`), never past now (`least`), idempotent; concurrent marks
        serialize on the member row. `updated_at` is not touched (profile timestamp). No audit row.
     b) no row -> `{ unseen: 0, requestsSeenAt: null }`; else the count from 4c with the new `seen_at`.
     No other locks; it touches neither seats nor requests, so the SIM-014 lock order is unaffected.
5. **Routes** (copy `src/app/api/audit/route.ts` for GET, `src/app/api/requests/route.ts` POST for the body read):
   - `src/app/api/requests/route.ts`: add `GET = withAuth(..., { tier: "manager" })`: parse query -> 400, pool ->
     503, `Response.json(await listRequests(...), { headers: NO_STORE })`.
   - `mine/route.ts`: `GET`, tier `user`, `parseMyRequestsQuery`, `listMyRequests(pool, ctx.scope, ctx.sub, q.value)`.
   - `mine/seen/route.ts`: `POST`, tier `user`, `readJson` -> 400, `validateSeenBody` -> 400,
     `markRequestsSeen(pool, ctx.scope, ctx.sub, v.value.seenUpTo)`.
   - Static `mine` folder is a sibling of `[id]`; `[id]` has no `route.ts`, so there is no segment conflict.
6. Tests as listed; run all Checks.

Rules: R1 (routes -> server, lib; `read.ts` -> server, lib; validators and `isUnseen` in lib; `pnpm check:layers`),
R2 (no migration), R6 (every query via `orgQuery` with `org_id = $1`, every join repeats `org_id`, mine/seen scoped by
the token `sub`, list tier from the token), R7 (handlers return 400/503/200 only; 401/403 only from `withAuth`; seen is
an idempotent forward-only update, safe if `apiFetch` re-sends), R3 (no config), R5 (tests above).

## Specialist input used
- api-platform-engineer: no new error codes, 400 `invalid_request`, `Cache-Control: no-store` — **adopted** (also avoids a merge conflict in `error.ts` with SIM-013.1).
- api: `limit` default 50 / max 100, strict regex, `REQUEST_LIMITS` in `types.ts` — **adopted**.
- api: reuse `encodeCursor` / `decodeCursor` unchanged; `created_at desc, id desc` for every status — **adopted**; renaming the cursor module is a follow-up.
- api: shared select/join fragment so detail, list and mine cannot drift — **adopted** (`REQUEST_SELECT`, `REQUEST_FROM`, `toRequestDto`).
- api: `currentOccupant` via left join on `seats.occupant_id` (column verified, init.sql:85) — **adopted**.
- api: separate `RequestListItemDto` / `MyRequestDto`, do not widen `RequestDto` — **adopted**.
- api: skip `note` — **adopted** (not in spec or ticket; rule 1).
- api: `isNew` and `unseen` in SQL with one predicate, pure `isUnseen` helper for unit tests — **adopted**.
- api: page and count in one read transaction — **adopted** as a `repeatable read, read only` transaction (a single CTE statement loses the count on an empty page).
- api: `seenUpTo` µs form only, one atomic `greatest/least` UPDATE, future capped silently, no audit, no new locking — **adopted**.
- api: null `requests_seen_at` = `-infinity`, no backfill — **adopted**.
- api: `mine` takes a cursor (open question 4) — **adopted** (rows past the limit would otherwise be unreachable; same code).
- api: share the `get()` helper from a lib file — **rejected for now**: it means editing `audit-query.ts` (R4); copied locally, dedupe is a follow-up.
- api: test `/api/requests/mine/approve` -> 404 — **adopted** as a route unit test with `id = "mine"`.

## Assumptions
1. **Approvals order is newest first for every status** (consult Q1). An oldest-first pending queue needs its own cursor direction; follow-up if Ming wants it.
2. **No linked member on `mine/seen` is a 200 no-op** (consult Q2), consistent with GET mine returning an empty page. The member gate in `withAuth` already stops deactivated members.
3. **A future `seenUpTo` is capped silently**, not 400 (consult Q3; ticket "capped at now").
4. **`mine` accepts `cursor` and `limit`** (consult Q4), same rules as the list.
5. **`note` stays out of every DTO** (consult Q5).
6. **`seenUpTo` absent means now().** The UI slice should send the newest `decidedAt` it displayed, so a decision that lands after the list load stays unseen.
7. **Unknown query params are ignored** (as `parseAuditQuery` does); `status` on `mine` is ignored.
8. **Hotspots:** SIM-013.1 (state DONE, PR #59) edits `src/lib/api/error.ts` and `src/ui/copy/api.ts`; this plan edits neither. If SIM-013.1 also changes `src/test/db/fixtures.ts`, there is no conflict because this plan does not edit it. Within this slice, `src/server/requests/requests.ts` is the only existing service file edited (behaviour-preserving extraction).
9. **Size:** about 250-300 source lines plus tests; one slice.

## Blocking questions
None.

## Split proposal
None (this is already slice 2 of 4 from the SIM-014 split).

Follow-ups (not in this ticket): oldest-first pending queue for Approvals (if wanted); move the cursor codec out of
`src/lib/audit/` to a neutral name; share the query `get()` helper between audit and requests validators.
