Status: READY

# Plan — SIM-019: Audit-log screen for org admins

> **Split proposed (default).** This plan implements **Slice A (API + pure logic)** as SIM-019. **Slice B (audit page UI)**
> becomes SIM-019.2, depends on SIM-006.2, and is specified below so it needs no re-plan (same pattern as SIM-010 ->
> SIM-010.2). Reason: the page needs the browser token from SIM-006.2 (not merged), and API + UI + nav + copy is likely
> above ~400 changed lines. If Ming prefers one ticket, see Assumption A1.

## Scope summary
Ticket: "`GET /api/audit` (Admin): newest first, filter by actor, entity type, date range, bounded pages. Audit page
with actor display names." Out of scope: "Export of the audit log."

Spec SYS-03 (`docs/spec-v1.md` lines 422-427): "Admins of the org see an audit-log screen: newest first, filter by
actor, entity type and date range, paginated (D28)." and "The row holds no secrets and no tokens." "Audit rows are kept
indefinitely in v1 (D38)."

Decisions: D28 "Audit-log screen for org Admins (filter by actor, entity type, date)"; D35 (spec line 485) "stored in
UTC, shown in Asia/Ho_Chi_Minh (UTC+7) for every org in v1"; D52 "Management screens (members, devices, approvals,
groups/projects, audit log, ...) use the clean UI kit without pixel art. Body text, tables and forms never use a pixel
font." R6: every query scoped by the verified org (`ctx.scope`).

This plan (Slice A): `GET /api/audit` and `GET /api/audit/facets` (Admin only), pure filter/cursor parsing in `src/lib`,
and the read service. Slice B (below): the Audit page.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | "Only Admins can open the page and the route (403 otherwise)." | Slice A (route): `src/app/api/audit/route.test.ts` › "user and manager get 403 forbidden; admin passes the gate" (both GET handlers, no DB call happens for 403) and "no Authorization -> 401". Page half: Slice B, `AuditView.test.tsx` › "non-admin sees the no-access state and no request is made" and `nav.test.ts` › "audit is admin only". |
| 2 | "Filters combine and paginate correctly." | `src/server/audit/audit.test.ts` › "actor + entity + from + to combine with AND and bind each value", "limit+1 fetch yields nextCursor and trims the page", "last page has nextCursor null", "cursor adds the (created_at, id) < keyset predicate", "order is created_at desc, id desc". `src/lib/audit/cursor.test.ts` › round trip incl. microsecond timestamp. Route test › "filters and cursor reach the service". |
| 3 | "Rows show only the caller's org." | `audit.test.ts` › "query is bound to scope.orgId as $1 (a.org_id = $1) and the members join also matches org_id", "org from query string is ignored" (route test passes `?org=other`, asserts `$1` is the token org). Real-DB proof of cross-org isolation: SIM-026 integration tests (see Assumptions A6). |
| 4 | "Unit tests cover filter parsing." | `src/lib/validate/audit-query.test.ts` (cases listed under Tests). |
| 5 | (SYS-03, no secrets) The response never exposes `org_id` and does not add fields beyond the DTO. | `audit.test.ts` › "DTO maps only id, actor, action, entity, entityId, meta, at". |

## Ming verification after merge
- After SIM-019.2 and SIM-006.2 are merged: sign in as Admin, change a room, open Audit, confirm the new row, the actor
  display name, filters and "Load more". Sign in as Manager and User: no nav entry, direct URL shows no-access.
- Nothing for Slice A alone (no real token path in the browser yet).

## Files to create / modify
Slice A (this ticket). No High path is touched (`src/server/audit/*` does not match `src/server/**/auth*`).
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/audit/types.ts` (new) | `AuditEntryDto`, `AuditFilter`, `AuditPage`, `AuditFacets`, `AUDIT_LIMITS` (`defaultLimit 50`, `maxLimit 100`, `facetActorsMax 200`) | Shared by route, service and Slice B | No |
| `src/lib/audit/cursor.ts` (new) | `encodeCursor({at, id})` / `decodeCursor(s)`: base64url JSON; `at` must match `^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$`, `id` canonical uuid; returns `null` when malformed | Keyset pagination; opaque, validated cursor; keeps microseconds so no row is skipped or repeated | No |
| `src/lib/validate/audit-query.ts` (new) | `parseAuditQuery(params: URLSearchParams)` → `{ok:true,value:AuditFilter}` / `{ok:false, field}` | Boundary validation (SYS-02), pure and unit tested | No |
| `src/server/audit/audit.ts` (new, starts with `import "server-only"`) | `listAudit(db, scope, filter)` and `listAuditFacets(db, scope)`; all SQL via `orgQuery` | Read service (route -> server layer, R1) | No |
| `src/app/api/audit/route.ts` (new) | `GET` via `withAuth(..., {tier:"admin"})` | The endpoint | No |
| `src/app/api/audit/facets/route.ts` (new) | `GET` via `withAuth(..., {tier:"admin"})` | Filter pickers for the UI (actor, entity type lists) | No |
| `src/lib/audit/cursor.test.ts`, `src/lib/validate/audit-query.test.ts`, `src/server/audit/audit.test.ts`, `src/app/api/audit/route.test.ts` (new) | Tests | R5 | No |

Slice B (SIM-019.2, for reference):
| File | Change | Required because |
|---|---|---|
| `src/lib/nav.ts`, `src/lib/nav.test.ts` | add `NavId` `"audit"`, `{href:"/audit", icon:"history", minTier:"admin", placement:"rail"}`, last in the rail; update expected lists (admin rail gets `audit`; admin total 7) | Admin-only nav entry |
| `src/lib/icons.ts` (+ `icons.test.ts` if it pins the list) | add `"history"` in alphabetical place (after `group`) | `Icon` only accepts listed names |
| `src/ui/copy/shell.ts` | `nav.audit: "Audit log"`, `pages.audit` | `nav` is `satisfies Record<NavId,string>` |
| `src/ui/copy/audit.ts` (new) | all page strings, filter labels, error/empty/forbidden text, action labels map (`room.create` -> "Created a room", ...), fallback for unknown action | D36 copy rule, `no-literals.test.ts` |
| `src/lib/audit/day-range.ts` (+ test) | `dayRangeToInstants(fromDay?, toDay?)`: a calendar day in UTC+7 -> `from` = `YYYY-MM-DDT00:00:00+07:00` as UTC `Z`, `to` = start of the day after the "to" day (exclusive) | D35 UTC+7 |
| `src/ui/audit/audit-api.ts` (+ test) | `createAuditApi(fetcher)` → `list(filter, cursor)`, `facets()`; parses `{error:{code}}` | Injected fetcher, isolates the SIM-006.2 `apiFetch` |
| `src/ui/audit/useAudit.ts`, `src/ui/audit/AuditView.tsx` (+ `AuditView.test.tsx`) | filters (actor select, entity select, from/to date inputs), table (When, Who, Action, Entity, Details), "Load more", loading/empty/error/no-access states; clean UI kit, no pixel art (D52); times via `Intl.DateTimeFormat("en-GB", {timeZone:"Asia/Ho_Chi_Minh"})` | Screen |
| `src/app/(app)/audit/page.tsx` (new) | thin wrapper: `<AuditView fetcher={apiFetch} />` from SIM-006.2 | Page |
| `src/ui/index.ts` | export `AuditView` if the other views are exported there | Convention |

## Data model / migration
None. `audit_log` already exists with the needed indexes: `audit_log_org_created_idx (org_id, created_at desc, id desc)`
(serves the unfiltered list and keyset paging), `audit_log_org_actor_idx`, `audit_log_org_entity_idx`
(`db/migrations/20261120150000_init.sql` lines 209-221). Table is append-only (lines 273-282). Actor display name comes
from `members (org_id, sub, display_name)` via a left join (lines 35-52).

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/audit` | Query (all optional): `actor` canonical lowercase uuid (Identity `sub`); `entity` `^[a-z][a-z0-9_]{0,63}$`; `from` / `to` ISO-8601 UTC instant `YYYY-MM-DDTHH:mm:ss(.sss)?Z`, `from` inclusive, `to` exclusive, `from < to`; `limit` integer 1-100 (default 50); `cursor` opaque string from a previous response. Empty value = absent. A repeated param or unknown format is 400. Unknown params are ignored. | `200 {items:[{id, actor:{sub, displayName: string\|null}, action, entity, entityId: string\|null, meta: object\|null, at: "YYYY-MM-DDTHH:mm:ss.ssssssZ"}], nextCursor: string\|null}`, `Cache-Control: no-store`. Sorted `created_at desc, id desc`. | 400 `invalid_request`, 401 `unauthenticated`, 403 `forbidden` / `org_required` / `member_deactivated`, 503 `unavailable` (no pool), 500 `internal` | Admin (`withAuth` tier `admin`) |
| GET | `/api/audit/facets` | none | `200 {actors:[{sub, displayName: string\|null}], entities:[string]}`; actors = distinct `actor_sub` of the org (max 200, ordered by display name then sub), entities = distinct `entity` of the org (max 100, alphabetical). `no-store`. | 401, 403, 503, 500 | Admin |

No new error codes (`src/lib/api/error.ts` unchanged). No side effects, so the "no 401/403 after a side effect" rule
holds trivially; 401/403 come from `withAuth` before the handler runs.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/validate/audit-query.test.ts` › "empty params -> defaults (limit 50, nothing else)" | Defaults |
| › "limit: 1 and 100 ok; 0, 101, -1, 1.5, '10abc', ' 5', '1e2' -> field limit" | Pagination bounds |
| › "actor: canonical uuid ok; uppercase, nil uuid, 'x', padded -> field actor" | Uses `isCanonicalUuid` (`src/lib/validate/uuid.ts`) |
| › "entity: 'room' ok; '', 'Room', 'room;drop', 65 chars, 'phòng' -> field entity" | Entity charset, diacritics rejected |
| › "from/to: valid Z instant ok; date-only, '+07:00' offset, 'not a date', '2026-02-30T00:00:00Z' -> field from/to" | Round-trip validity, UTC only |
| › "from >= to -> field to; from == to rejected; from < to ok" | Range |
| › "repeated param (`actor=a&actor=b`) -> invalid" | Param pollution |
| › "empty string value treated as absent" | UI sends blanks |
| › "all filters together parse into one AuditFilter" | Combination |
| `src/lib/audit/cursor.test.ts` › "round trip keeps microseconds", "garbage / wrong shape / non-uuid id / bad base64 -> null", "never accepts extra keys" | Cursor safety |
| `src/server/audit/audit.test.ts` › "unfiltered: org_id = $1 bound to scope.orgId, order by a.created_at desc, a.id desc, limit = limit+1" | R6, order, bounds |
| › "actor + entity + from + to combine with AND, values bound not interpolated" | Combined filters |
| › "cursor adds (a.created_at, a.id) < keyset predicate" | Paging |
| › "limit+1 rows -> nextCursor from the last kept row, page trimmed; <= limit rows -> nextCursor null" | Paging |
| › "members join matches org_id and sub; missing member -> displayName null" | Display names, deleted/unknown actor |
| › "DTO exposes no org_id; meta null stays null" | SYS-03 |
| › "facets: queries scoped by org_id = $1, bounded by limit" | Facets |
| `src/app/api/audit/route.test.ts` › "no Authorization -> 401 on both handlers" | AuthN |
| › "user and manager -> 403 forbidden, service not called; admin -> 200" | Criterion 1 |
| › "invalid query -> 400 invalid_request, service not called" | Validation |
| › "org in the query string is ignored; token org is $1" | Criterion 3 |
| › "no pool -> 503" | Existing handler pattern |
| › "response has Cache-Control: no-store" | No caching of admin data |
| Existing `with-auth` mark test (if it scans routes) passes for both new routes | Every route uses `withAuth` |

Slice B tests (SIM-019.2): `day-range.test.ts` (UTC+7 boundaries, `to` exclusive next day, year/month rollover),
`audit-api.test.ts` (injected fetcher, error codes), `AuditView.test.tsx` (non-admin no-access and no fetch; filters build
the query; Load more appends; empty/error states; unknown action falls back to the raw action; Vietnamese display name
renders intact), `nav.test.ts` updates, `no-literals.test.ts` and `copy.test.ts` pass.

## Approach
1. `src/lib/audit/types.ts`, `cursor.ts` and `src/lib/validate/audit-query.ts` (pure, `lib` layer, no server imports) and
   their tests first. Follow `src/lib/validate/room.ts` result shape.
2. `src/server/audit/audit.ts`: build the WHERE clause dynamically (only add predicates for present filters, so the
   `audit_log_org_*` indexes stay usable), with positional params after `$1`. Always start with `a.org_id = $1` so
   `orgQuery` accepts it. Select `to_char(a.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at` to
   keep microseconds for the cursor. Left join `members m on m.org_id = a.org_id and m.sub = a.actor_sub`. Fetch
   `limit + 1`. Cursor predicate: `(a.created_at, a.id) < ($n::timestamptz, $m::uuid)`.
3. Facets: `select distinct a.actor_sub, m.display_name ... where a.org_id = $1 ... limit 200`, and
   `select distinct a.entity ... where a.org_id = $1 order by 1 limit 100`.
4. Routes mirror `src/app/api/rooms/route.ts` (lines 12-20): `getPool()` -> 503 if null, `parseAuditQuery(new URL(req.url).searchParams)`
   -> 400, call service, `Response.json(..., {headers: NO_STORE})`, `{tier: "admin"}`. `export const dynamic = "force-dynamic"`.
5. Rules: R1 (route -> server/lib only; `lib` pure), R3 (no config added), R5 (tests above), R6 (every SQL goes through
   `orgQuery` with `ctx.scope`, role from `withAuth` tier), D36 (codes only, no user text in API), Domain focus
   (diacritics in names pass through untouched; UTC instants; empty/null `meta`/`entityId`/`displayName`; limit bounds).
6. Run checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Specialist input used
None (fast lane: Size S, Gate none, no consult).

## Assumptions
Each has a default; Ming can overrule in the batch review round.
- **A1 Split API / UI (default: split).** SIM-019 = Slice A, new ticket SIM-019.2 = Slice B (depends on SIM-019,
  SIM-006.2, SIM-022). Alternative: one ticket with the UI built against an injected fetcher; its page could not be run
  end to end before SIM-006.2 merges, and the diff likely exceeds ~400 lines. If Ming picks one ticket, the implementer
  does Slice A first, then B per the Slice B table, with `AuditView` taking `fetcher` as a prop.
- **A2 Keyset (cursor) pagination, not offset.** Stable while new rows arrive, uses the existing
  `(org_id, created_at desc, id desc)` index. Page size default 50, max 100. No total count (no `count(*)` on a table
  kept forever, D38).
- **A3 Date range is two UTC instants (`from` inclusive, `to` exclusive).** The API has no time zone logic; the UI turns
  calendar days into instants using fixed UTC+7 (D35). Default if Ming wants a different rule: accept `YYYY-MM-DD` days
  interpreted in UTC+7 in the API itself.
- **A4 Actor and entity pickers come from `GET /api/audit/facets`** (distinct values that actually appear in the org's
  log, so a former member can still be filtered). The members directory API does not exist yet (SIM-011). Added one
  endpoint beyond the ticket's `GET /api/audit`; it is read-only, Admin-only and org-scoped. Default alternative: drop
  facets and let the UI take a free-text entity and no actor picker (weaker; not recommended).
- **A5 Display name fallback.** `displayName` is `members.display_name` or `null` when no member row exists
  (not yet seeded, or members are created by SIM-007/SIM-011). The UI shows "Unknown member" plus the first 8 chars of
  `sub`; email is not stored in audit rows and is not looked up.
- **A6 Cross-org isolation is proven by SQL-text/binding unit tests only** (the repo has no DB in CI yet). SIM-026
  (same batch) adds DB integration tests; once merged, add one audit case there (follow-up, not this ticket).
- **A7 `meta` is returned as stored** (codes, field names, counts only per `writeAudit` doc). No redaction layer; if a
  future writer breaks that contract it is a writer bug. Slice B shows `meta` as a compact key/value list, never as HTML.
- **A8 Action labels** map the known `room.create|update|delete` (the only actions written today, `src/server/rooms/rooms.ts`
  lines 100-237); unknown actions render as the raw string, so later tickets need no change here.
- **A9 Hotspots.** Slice A creates only new files, no overlap with open tickets (SIM-025 edits rooms routes/body cap;
  SIM-026 adds tests; SIM-006.2 edits auth UI). Slice B touches `src/lib/nav.ts`, `nav.test.ts`, `src/ui/copy/shell.ts`,
  `src/lib/icons.ts`, `src/ui/index.ts`, which SIM-006.2 or SIM-010.2 may also edit: expect a small rebase.
- **A10 Security review trigger:** the diff is under `src/server/`, so the `security-ai-generated-code-auditor` runs in
  review (per `loop.config.md`). Not a High path; no plan-approval gate.

## Blocking questions
None.

## Split proposal
Slice A = this ticket (SIM-019): API, facets, pure parsing, service, tests (est. 300-380 changed lines incl. tests).
Slice B = SIM-019.2 (to be created by the orchestrator): audit page UI, nav entry, copy, day-range helper (est. 350+ lines),
Priority P2, Size S/M, Areas ui, Depends on SIM-019, SIM-006.2, SIM-022. SIM-021's dependency on SIM-019 should become
SIM-019.2 if the split is accepted.
