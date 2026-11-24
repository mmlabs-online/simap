Status: READY

# Plan — SIM-017: Dashboard and search (slice 1: dashboard, DSH-01 + D34 warning)

This plan covers **slice 1 only** (the dashboard). Search (DSH-02) is proposed as SIM-017.2 (API) and SIM-017.3 (UI);
see `## Split proposal`.

## Scope summary
`docs/spec-v1.md` §DSH (lines 393-397):
> **DSH-01 Overview numbers**
> - [ ] The dashboard shows rooms, seats, occupied seats, occupancy rate, and devices placed vs. in inventory.
>   Everything is computed from the database when the page loads, with no cached counters (seatMGT's
>   `layoutMeta.seatCount` is not carried over).
> - [ ] It breaks occupancy down per room, with room cards and an occupancy ring as in seatMGT.

Ticket scope (ticket.md line 24):
> Dashboard numbers from live aggregates: rooms, seats, occupied, rate, devices placed vs inventory; per-room
> breakdown; warning for deactivated members still holding seats.

`work/decisions.md` D34 (line 41): "Members are never deleted in simap: Manager+ deactivate (simap-local) ...". Spec
MEM-01 (lines 301-302): "Deactivating or removing a member who still occupies seats or owns placed devices warns with the
counts and offers to release the seats ... (D34)". A Manager may decline the release, so deactivated members can still
hold seats; the dashboard warning lists them.

Spec SHL-01 (line 439): "Pages: Dashboard, Rooms, ... Approvals (Manager+)" and `src/lib/nav.ts:25` (dashboard
`minTier: "user"`): the dashboard is for all roles.

Spec §7 (line 468): "Seat status | ... Not stored; derived". Schema: occupied = `seats.occupant_id is not null`
(`db/migrations/20261120150000_init.sql:85`); placed device = `devices.seat_id is not null`, inventory = `seat_id is
null` (`init.sql:112`).

Out of scope (ticket): history/trends; spec §9 line 522 "Analytics beyond DSH-01".

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Numbers match the database after any change (no cached counters). | `src/server/dashboard/dashboard.db.test.ts › "numbers follow the database after assign, release, device place/return and deactivate"` (CI `pnpm test:db`); code review: every number is a `count(...)` in `getDashboard`, nothing read from a stored counter (`rooms.seat_counter` is never used); route sends `Cache-Control: no-store` and `dynamic = "force-dynamic"`. |
| 2 | Dashboard shows rooms, seats, occupied, occupancy rate, devices placed and in inventory (DSH-01 bullet 1). | `src/ui/dashboard/DashboardView.test.tsx › "ready: renders the six stat tiles with values"`; local run: `pnpm dev`, open `/`. |
| 3 | Per-room breakdown with room cards and occupancy ring (DSH-01 bullet 2). | `DashboardView.test.tsx › "ready: renders one RoomCard per room, without edit/delete actions"`; DB test `"per-room counts include empty rooms"`. |
| 4 | Warning for deactivated members still holding seats (ticket scope, D34), shown to Manager+. | DB tests `"lists deactivated members who still hold seats, capped, with true total"` and `"holders are null below manager"`; view tests `"warning shown when holders total > 0"` and `"no warning when holders null or total 0"`. |
| 5 | Org isolation (R6). | DB test `"never counts another org's rows"`. |
| 6 | Empty org reads zero, rate 0 (no divide by zero). | DB test `"empty org: all zeros"`; view test `"ready with zero seats shows 0%"` (rate uses `occupancyPercent`, `src/lib/rooms/occupancy.ts:2-5`). |
| 7 | All checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; CI `pnpm test:db`. |

Ticket criteria "nguyen finds Nguyễn", "Search results are limited and paginated" and "Unit tests cover the diacritics
normalisation" move to SIM-017.2 (see `## Split proposal`).

## Ming verification after merge
None (everything is visible in a local run and in CI). Optional: open the dashboard on production data once SIM-021
deploys.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/dashboard/types.ts` | create | `DashboardDto`, `DashboardTotals`, `DeactivatedHolderDto`, `DASHBOARD_LIMITS` (camelCase DTOs in lib, consult pattern) | no |
| `src/server/dashboard/dashboard.ts` | create | `getDashboard(pool, scope, { includeHolders })`: one repeatable-read, read-only tx; totals, per-room (reuses `listRooms`), holders | no |
| `src/server/dashboard/dashboard.db.test.ts` | create | AC 1, 3-6 against Postgres | no |
| `src/app/api/dashboard/route.ts` | create | `GET /api/dashboard`, tier `user`; `includeHolders = atLeast(ctx.tier, "manager")` | no (not under `src/server/http/**`) |
| `src/ui/dashboard/dashboard-api.ts` | create | `createDashboardApi(fetcher).get()` result wrapper, copy of `src/ui/rooms/rooms-api.ts:9-40` call/error pattern | no |
| `src/ui/dashboard/dashboard-api.test.ts` | create | unit tests of the wrapper | no |
| `src/ui/dashboard/useDashboard.ts` | create | load on mount, stale-drop, `reload` (copy of `src/ui/rooms/useRooms.ts`) | no |
| `src/ui/dashboard/StatTile.tsx` | create | one tile: icon, label, value | no |
| `src/ui/dashboard/DashboardView.tsx` | create | pure view: loading / error / ready (tiles, warning, room grid) | no |
| `src/ui/dashboard/DashboardView.test.tsx` | create | static-render tests | no |
| `src/ui/dashboard/DashboardPage.tsx` | create | client page wiring api + hook + view (pattern `src/ui/rooms/RoomsPage.tsx:20-25`) | no |
| `src/ui/copy/dashboard.ts` | create | all dashboard copy (D36; guarded by `src/ui/copy/no-literals.test.ts` and `copy.test.ts`) | no |
| `src/ui/index.ts` | modify | export `DashboardPage` (after line 29) | no |
| `src/app/(app)/page.tsx` | modify | render `<DashboardPage />` instead of `PageSkeleton` (whole file, 12 lines) | no |

Not touched: `src/server/rooms/rooms.ts` (only `listRooms` is imported), `src/lib/icons.ts` (existing icons suffice),
`src/app/api/routes-guarded.test.ts` (it discovers new routes by itself, lines 55-69), `db/migrations/**`.
No file matches a High path in `.claude/loop.config.md` → Gate stays `none`.

## Data model / migration
None. All numbers are aggregates over existing tables (`rooms`, `seats`, `devices`, `members`). Existing indexes
`seats_org_occupant_idx` and `devices_org_seat_idx` (`init.sql:108,139`) cover the filtered counts.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/dashboard` | no params (any query param is ignored) | 200 `DashboardDto` (below), `Cache-Control: no-store` | 200; 401/403 only from `withAuth`; 503 `unavailable` (no pool) | tier `user`; `deactivatedHolders` is `null` below `manager` |

```ts
// src/lib/dashboard/types.ts
export const DASHBOARD_LIMITS = { holders: 50, holderSeats: 10 } as const;

export type DashboardTotals = {
  rooms: number;
  seats: number;            // every seat, including cannot-seat (same as RoomCard, see Assumptions A1)
  occupied: number;         // seats with occupant_id
  devicesPlaced: number;    // devices with seat_id (primary and secondary)
  devicesInventory: number; // devices without seat_id
};

export type HolderSeatRef = { id: string; code: string; roomId: string; roomCode: string };

export type DeactivatedHolderDto = {
  member: { id: string; displayName: string };
  seatCount: number;        // true count
  seats: HolderSeatRef[];   // first DASHBOARD_LIMITS.holderSeats, ordered by code, id
};

export type DashboardDto = {
  totals: DashboardTotals;
  rooms: RoomDto[];         // from listRooms (ordered by code, max 500)
  roomsTruncated: boolean;  // totals.rooms > rooms.length
  /** Manager+ only; null below. total = true number of deactivated members holding >= 1 seat. */
  deactivatedHolders: { total: number; items: DeactivatedHolderDto[] } | null;
};
```
The occupancy rate is not sent; the UI computes it with `occupancyPercent(totals.occupied, totals.seats)` (the same
helper the room rings use, so tile and rings agree).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/server/dashboard/dashboard.db.test.ts › empty org: all zeros, no rooms, holders total 0` | AC 6, empty fields |
| `… › counts rooms, seats, occupied, devices placed and inventory` (2 rooms, 5 seats, 2 occupied, 1 cannot-seat seat, 3 devices of which 1 secondary placed, 1 in inventory) | AC 1-2, secondary counted as placed, cannot-seat counted in seats |
| `… › per-room counts include empty rooms; roomsTruncated false` | AC 3 |
| `… › numbers follow the database after assign, release, device place/return and deactivate` (read, mutate with plain SQL `update`s, read again; no reload of any cache) | AC 1 |
| `… › lists deactivated members who still hold seats, capped, with true total` (Vietnamese NFC name "Nguyễn Văn An"; a member holding 12 seats → `seatCount` 12, 10 seat refs with `roomCode`; active holders and deactivated non-holders excluded; ordered by lower(display_name), id) | AC 4, cap bounds, diacritics in names |
| `… › holders cap: 51 deactivated holders → 50 items, total 51` | pagination/cap bounds |
| `… › holders are null when includeHolders is false` | AC 4 tier gate |
| `… › never counts another org's rows` (two orgs, same shapes) | AC 5 (R6) |
| `… › runs begin, set transaction repeatable read read only, reads, commit` (recording pool, as in `src/server/layout/layout.db.test.ts:282-291`) | one snapshot for all numbers |
| `src/ui/dashboard/dashboard-api.test.ts › get: ok body → value; non-ok → error code; signed_out → unauthenticated; fetch throws → unavailable; body without totals/rooms → internal` | API wrapper |
| `src/ui/dashboard/DashboardView.test.tsx › loading: aria-busy skeleton` | states |
| `… › error: role=alert with apiErrorMessage and retry button` | states |
| `… › ready: renders the six stat tiles with values` (rate tile shows `occupancyPercent` + `%` via copy) | AC 2 |
| `… › ready with zero seats shows 0%` | AC 6 |
| `… › ready: renders one RoomCard per room, without edit/delete actions` | AC 3 |
| `… › ready: no rooms → empty-state copy` | empty fields |
| `… › roomsTruncated shows the truncated note` | bounds |
| `… › warning shown when holders total > 0` (member name "Nguyễn Văn An" rendered as given, seat codes link to `roomDetailHref(roomCode)`, "+N more" when `total > items.length` or `seatCount > seats.length`) | AC 4, diacritics |
| `… › no warning when holders null or total 0` | AC 4 |

Existing guards that must stay green: `src/ui/copy/no-literals.test.ts`, `src/ui/copy/copy.test.ts`,
`src/app/api/routes-guarded.test.ts`, `pnpm check:layers`.

## Approach
1. **Types** — `src/lib/dashboard/types.ts` as in the API contract (imports `RoomDto` from `@/lib/rooms/types`).
2. **Server** — `src/server/dashboard/dashboard.ts`, first line `import "server-only"` (R1).
   - `export async function getDashboard(pool: Db, scope: OrgScope, opts: { includeHolders: boolean }): Promise<DashboardDto>`
     with `Db` from `@/server/rooms/rooms` (`rooms.ts:11-12`).
   - `withTx(pool, async (c) => { await c.query("set transaction isolation level repeatable read, read only"); ... })`
     (pattern `src/server/requests/read.ts:91-92`, `src/server/layout/layout.ts:139-141`).
   - Totals: one `orgQuery` with scalar subqueries, each `where org_id = $1`:
     `(select count(*)::int from rooms where org_id = $1) as rooms`, `seats`, `occupied`
     (`... and occupant_id is not null`), `devices_placed` (`seat_id is not null`), `devices_inventory`
     (`seat_id is null`).
   - Rooms: `await listRooms(c, scope)` (`rooms.ts:65-72`, already `count(s.id)` / `count(s.occupant_id)` live, limit 500).
     `roomsTruncated = totals.rooms > rooms.length`.
   - Holders (only when `includeHolders`): one `orgQuery` on `members m where m.org_id = $1 and m.status =
     'deactivated' and exists (select 1 from seats s where s.org_id = $1 and s.occupant_id = m.id)`, selecting
     `m.id, m.display_name`, a correlated `count(*)::int` of seats, a capped `json_agg` of
     `(s.id, s.code, r.id as room_id, r.code as room_code)` from `seats s join rooms r on r.org_id = s.org_id and r.id =
     s.room_id where s.org_id = $1 and s.occupant_id = m.id order by s.code, s.id limit ${DASHBOARD_LIMITS.holderSeats}`,
     and `count(*) over ()::int as total`; `order by lower(m.display_name), m.id limit ${DASHBOARD_LIMITS.holders}`.
     Correlated subqueries, never a join fan-out (as `src/server/members/manage.ts:109-125`). `total` = first row's
     `total` or 0. Limits are constants interpolated into SQL, never user input. Map snake_case to the DTO.
   - Every join repeats `org_id` (R6). No writes, no audit rows.
3. **Route** — `src/app/api/dashboard/route.ts` copied from `src/app/api/members/route.ts`: `dynamic =
   "force-dynamic"`, `withAuth(handler, { tier: "user" })`, `getPool()` else `apiError(503, "unavailable")`,
   `getDashboard(pool, ctx.scope, { includeHolders: atLeast(ctx.tier, "manager") })` (`atLeast` from
   `@/lib/auth/tier`, as `src/server/http/with-auth.ts:2`), `Response.json(dto, { headers: { "Cache-Control":
   "no-store" } })`. Read-only, so R7 holds trivially (no 401/403 outside the wrapper).
4. **UI api + hook** — `dashboard-api.ts` copies the `call`/`errorCode`/`fail` shape of `rooms-api.ts:5-40`;
   `get()` checks `typeof body.totals === "object" && Array.isArray(body.rooms)` else `internal`. `useDashboard(api)`
   copies `useRooms.ts` (counter + mounted ref, `reload`). Load on mount only (spec: "computed ... when the page loads").
5. **View** — `DashboardView` (pure, props `{ status, data: DashboardDto | null, errorCode, onRetry }`), layout of
   `RoomsView.tsx:33-106`: `h1` `shellCopy.pages.dashboard.title`; loading skeleton (`aria-busy`, `Card animate-pulse`);
   error `Card` with `role="alert"`, `apiErrorMessage`, retry `Button`; ready:
   - tile grid `grid gap-4 grid-cols-2 lg:grid-cols-3`: Rooms (`meeting_room`), Seats (`event_seat`), Occupied
     (`person`), Occupancy rate (`space_dashboard`, value `dashboardCopy.percent(occupancyPercent(...))`), Devices
     placed (`lan`), Devices in inventory (`inbox`). Only icons already in `src/lib/icons.ts`.
   - Warning `Card` when `deactivatedHolders && deactivatedHolders.total > 0`: icon `block`, heading
     `dashboardCopy.holders.title(total)`, list of members (`displayName` as stored), each with seat codes as `Link` to
     `roomDetailHref(roomCode)` (skip link when it returns null), `dashboardCopy.holders.moreSeats(n)` and
     `dashboardCopy.holders.moreMembers(n)`. Hint copy: release from the seat detail.
   - `h2` "Rooms" then `RoomCard` grid (no `actions`), empty state `dashboardCopy.noRooms`, truncated note when
     `roomsTruncated`.
   `StatTile` = `Card` + `Icon` + label + value (`aria-label` from copy, not literals).
6. **Page** — `DashboardPage.tsx` (`"use client"`, `useApiFetch`, `useMemo(createDashboardApi)`, `useDashboard`);
   export from `src/ui/index.ts`; `src/app/(app)/page.tsx` renders it (layer: pages → ui, R1).
7. **Copy** — `src/ui/copy/dashboard.ts`: tile labels, percent formatter, holders strings, noRooms, roomsTruncated,
   retry. English only, no Vietnamese characters (copy test line 52-60).
8. Run all Checks; `pnpm test:db` locally if a DB is available (CI runs it).

Rules: R1 (server-only header, route is the only server entry), R3 (no env), R4 (only the listed files), R5 (tests
above), R6 (`orgQuery` + `org_id` on every join), R7 (read-only route), D36 (copy file).

## Specialist input used
- api-platform-engineer:
  - Adopted: one repeatable-read read-only tx; totals by `count(...)` filters; per-room left join including empty
    rooms (via the existing `listRooms`, which already does exactly this); capped holders list with true counts in the
    `manage.ts` style; `Cache-Control: no-store`; DB tests including a mutate-then-reread test and two-org isolation; no
    audit rows.
  - Rejected: server-side `occupancyRate` in the DTO and a new `src/lib/dashboard` rate helper — `occupancyPercent`
    (`src/lib/rooms/occupancy.ts`, already tested) is the single rate rule shared with the room rings.
  - Q2 (cannot-seat in capacity) → Assumption A1. Q3 (visibility) → answered from spec SHL-01 + `nav.ts:25` (dashboard
    for all roles), warning Manager+ (A2). Q1, Q4-Q7 concern search → recorded for SIM-017.2 in `## Split proposal`.
- frontend-developer:
  - Adopted: split dashboard and search; reuse `RoomCard` without actions and `OccupancyRing`; page/view/hook/api split
    of the Rooms page; `Card` + `Icon` tiles; copy in `src/ui/copy/dashboard.ts`; static-render view tests.
  - Note: seatMGT reference files are not in this repo; the dashboard is built from simap's own rooms patterns.
  - Open questions: warning visibility → A2; cap → `DASHBOARD_LIMITS`; link to release action → not built (A3); tile
    links to filtered pages → not built (not in DSH-01, rule 1); placed vs inventory by `seat_id`, secondary counts as
    placed → A4; header search box vs `/search` page → SIM-017.3.

## Assumptions
- **A1 Capacity counts every seat.** `totals.seats` and the rate denominator include cannot-seat seats, the same as
  `RoomCard`/`listRooms` (`rooms.ts:60-63`), so the tile and the room rings agree. Default for Ming: keep; a separate
  "cannot seat" count can be a follow-up.
- **A2 Warning is Manager+.** It is a Manager action item (D34: "Manager+ deactivate"); the API returns
  `deactivatedHolders: null` below manager so the UI does not hide data the server sends. The rest of the dashboard is
  for all roles (SHL-01, `nav.ts:25`).
- **A3 No inline release action.** The warning links each seat to its room page, where a Manager releases it from the
  seat detail (SIM-012.6). Member names are plain text: the Members page UI (SIM-011.2) is ESCALATED, so no member
  deep link yet.
- **A4 Devices.** Placed = `seat_id is not null` (primary and secondary); inventory = `seat_id is null` (schema comment
  `init.sql:112`).
- **A5 Room list cap.** Per-room breakdown reuses `listRooms` (max 500 rooms); totals stay exact and
  `roomsTruncated` flags the cut.
- **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE`. `src/ui/index.ts` is touched by most UI tickets
  (one added export line; trivial rebase). SIM-011.2 (ESCALATED) does not touch these files.

## Blocking questions
None.

## Split proposal
The whole ticket is roughly 1,200 source lines plus tests (dashboard ~475, search API ~400, search UI ~350), well over
one implement/review cycle. Proposed slices:

1. **SIM-017 (this plan): Dashboard** — DSH-01 + D34 warning. AC: ticket criterion 1.
2. **SIM-017.2: Search API, diacritics-insensitive** — `GET /api/search?q=&kind=all|seat|device|member&limit=&cursor=`,
   tier `user`. AC: ticket criteria 2-4 ("nguyen" finds "Nguyễn"; results limited and paginated; unit tests cover the
   normalisation). Gate `none` (no High path). Planned approach, from the API consult and the scope sources:
   - **Diacritics: SQL `translate(lower(col), FOLD_FROM, FOLD_TO)` with a shared TS fold map, no migration, no
     extension.** The scope sources do not rule it out: spec §8 line 484-485 only requires that names "search correctly"
     and "Text is stored as Unicode NFC" (write paths normalise NFC: `src/lib/validate/member.ts:9`, `device.ts:83`,
     `room.ts:28`). `unaccent` is ruled out for v1 by `db/migrations/README.md:9-10` and `db/migrator.test.ts:212`
     (`create extension` is Ming's step on the shared server, a High path and a cross-env dependency). A normalised
     column would be a stored derived value that every write path (incl. occupant/owner renames) must keep in sync.
   - `src/lib/search/fold.ts`: `foldText(s)` (NFC → NFD, strip `\p{M}`, `đ/Đ` → `d`, lowercase) and `FOLD_FROM`/`FOLD_TO`
     generated from one table; unit test asserts `foldText(FOLD_FROM[i]) === FOLD_TO[i]` for every char and a
     table-driven test over all Vietnamese vowels × 5 tones + `ă â ê ô ơ ư đ`, both cases, NFC and NFD input.
   - Fields (spec DSH-02 line 400): seats (code, occupant name), devices (name, inventory no., MAC, owner name), members
     (name, employee code). **Email not included** (spec lists name and code only; Q4 default). MAC: the query with
     `:`/`-`/`.` removed is matched against `replace(d.mac, ':', '')` when it is all hex (Q6 default: separators
     ignored; stored form is lowercase colon, `src/lib/validate/device.ts:62-76`).
   - Min query length 1 non-blank char after trim, max as `MEMBER_LIMITS.q` (Q7 default); default limit 20, max 50;
     `kind=all` returns the first `limit` of each group with its own `nextCursor`; keyset per kind on
     `(sort key, id)` like `src/lib/members/cursor.ts`. Deactivated members included, flagged by `status`.
   - Also switch `listMembers` `?q=` (`src/server/members/manage.ts:148-153`) to the same fold so the two searches agree
     (Q5 default: yes; SIM-011 plan A7 deferred accent-insensitive member search to this ticket; spec §8 "search
     correctly").
   - Seq scan per org per query accepted for v1; a trigram/functional index (needs `pg_trgm`, Ming's step) is a
     follow-up only if it gets slow.
3. **SIM-017.3: Search page UI** — `/search?q=` page with grouped results (Seats, Devices, Members), per-group
   "Load more", 300 ms debounce and stale-drop reducer modelled on `src/ui/seats/member-picker.ts`; a "Search" nav
   entry (icon `search` already in `src/lib/icons.ts`). No live dropdown in the shell header (frontend consult).
   Depends on SIM-017.2.

Ming may override any default above (Q1 `unaccent` instead of `translate()`, Q4 email, Q5 `listMembers`, Q6 MAC,
Q7 min length) when SIM-017.2 is planned; none of them affects this slice.
