# Consult — frontend-developer (SIM-017)

SIM-017 UI consult (read-only). Backend/API shapes are not specified in detail here; this covers the UI side.

## Findings
- **Dashboard now:** `src/app/(app)/page.tsx` renders only `PageSkeleton` with `shellCopy.pages.dashboard.title`, `shellCopy.pages.dashboard.empty` and the icon `space_dashboard`. There is no `src/ui/dashboard/`, `src/server/dashboard/` or `src/server/search/`.
- **seatMGT references:** `src/lib/data/search.ts` and `DashboardRooms.tsx` do not exist in this repo. I found no seatMGT code, so DSH-01 "room cards and ring as in seatMGT" has to be built from the simap patterns below.
- **Reusable pieces for the dashboard:**
  - `src/ui/rooms/RoomCard.tsx` already shows code, name, floor, `roomsCopy.seatsSummary`, a link to the room page via `roomDetailHref` (`src/lib/nav.ts`) and `OccupancyRing`. Its `actions` prop is optional, so the dashboard can reuse the card without edit/delete buttons.
  - `OccupancyRing` takes `occupied` and `total`. `src/lib/rooms/occupancy.ts` supplies `occupancyPercent` and `ringDash`.
  - `RoomsView.tsx` is the page template to copy: a pure view with `status: loading | error | ready`, a skeleton of `Card` with `animate-pulse`, an error `Card` with `role="alert"`, `apiErrorMessage` and a retry `Button`, and the grid `grid gap-4 sm:grid-cols-2 xl:grid-cols-3`.
  - Hooks and pages follow a split: `RoomsPage.tsx` (client, owns the data and dialogs), `RoomsView.tsx` (pure), `useRooms.ts`, `rooms-api.ts` (with its test), and the copy file `src/ui/copy/rooms.ts`.
- **Stat tiles:** there is no tile component. Use `Card` plus `Icon`, with the copy in a new `src/ui/copy/dashboard.ts`. `src/ui/copy/no-literals.test.ts` and `copy.test.ts` guard D36, so check what they enforce before writing the copy.
- **Existing patterns to reuse for search:**
  - `src/ui/seats/useMemberPicker.ts` plus `member-picker.ts` is the template: a 300 ms debounce, a request-id counter with a reducer that drops stale answers, a `loadMore` using `nextCursor`, `canLoadMore`, `normalizePickerQuery` and `INITIAL_PICKER`. Search can copy this closely, or generalise it.
  - `src/lib/members/search.ts` has only `escapeLike`.
  - `src/server/members/manage.ts:149` does member search with `ilike ... escape '\\'` and has no diacritics handling.
  - `src/lib/members/cursor.ts` has cursor encoding that can be reused or copied for pagination.
  - `src/lib/validate/member-query.ts` and `request-query.ts` show the query-validator pattern; search needs a `src/lib/validate/search-query.ts`.
- **Diacritics in SQL:** `db/migrations` has no `unaccent`, `pg_trgm` or normalised column. The migration is therefore new work under R2, and is also an extension and role-privilege question for the shared mmlabs Postgres. The simpler option is to `lower(immutable_unaccent(...))` on both sides, or to add a normalised `search_text` column. A pure-JS `normalizeSearch` in `src/lib/` (NFD, strip combining marks, map đ/Đ to d, lowercase) is also needed for the unit test that the acceptance criteria require. Both sides must use the same rule, including đ, which NFD does not decompose.
- **Warning source (D34):** `seats.occupant_id` references `members` through `(org_id, occupant_id)`, and `members.status in ('active','deactivated')`. The query is seats joined to members where status is `deactivated`, grouped by member, scoped by org. Spec lines ~294-302 say removal offers to release seats, so the warning should link to the seat or room, and to the Members page for the member.
- **App shell:** `AppShellView.tsx` has a header with a flex spacer (line 141), `ThemeToggle` and icon buttons, with no search box. Adding a box there means changing the shell, its static test (`AppShellView.test.tsx`) and mobile layout. The header has room only on `lg`.
- **Link targets:**
  - Seats: `/rooms/[roomCode]`, whose page exists. Check whether a seat can be deep-linked (a query param) or selected from `SeatDetailPanel`. This is not confirmed.
  - Devices: `/devices` with `DevicesView`.
  - Members: `/members`.
  - Whether these pages accept a `q` or `highlight` param is unknown, so check before promising precise deep links.

## Recommendations
1. **Split into two slices.** Both depend on the same helpers, but the two features share almost nothing else.
   - **A (DSH-01):** dashboard, with `GET /api/dashboard` (or a server component call via the route), `src/server/dashboard/`, `src/ui/dashboard/{DashboardPage,DashboardView,StatTile,useDashboard,dashboard-api}.tsx` and `copy/dashboard.ts`. Tiles are rooms, seats, occupied, rate, devices placed and devices in inventory, followed by the per-room grid of `RoomCard` and the deactivated-members warning card. It needs no migration and is about size S.
   - **B (DSH-02):** `normalizeSearch` in `src/lib`, migration (unaccent or a normalised column), `src/server/search/`, `GET /api/search?q&type&cursor`, search UI and tests, about size M. The migration and a possible High path (check `risk-tiers.yml`) are in this slice. The ticket is sized M overall; it fits one PR but risks being fat, so the split is optional and cheap.
2. **Search placement.**
   - Use a `/search` page with `?q=` and an input at its top. A shell search box would only submit to `/search`, which could be deferred. A box in the header that does live dropdown results adds focus, keyboard and mobile complexity and shell changes.
   - Add a "Search" nav entry or an icon in the header, and keep the page itself as the owner of results.
   - The URL `?q` makes results shareable and keeps state testable without jsdom.
   - Reducer and debounce logic as pure functions in `search-state.ts`, matching `member-picker.ts`. Test the reducer, the `normalizeSearch` function and the view in static render only.
3. **Result groups.**
   - Three sections (Seats, Devices, Members), each a list with a heading, counts, per-group Load more and an empty state per group.
   - Paginate per type with cursors, with a page size such as 20 (a constant in `src/lib`, shared by the validator and the API).
   - Each row is a `Link` through helpers in `src/lib/nav.ts`: seat → room code with seat, device → `/devices`, member → `/members`.
   - Members group: show name and employee code. Check what role may see (R6, tier) before showing emails.
4. **Tests.**
   - Unit: normalisation ("nguyen" matches "Nguyễn", đ, NFC and NFD input, case), search-query validator, cursor, dashboard totals math (rate with 0 seats must not divide by zero; `occupancyPercent` probably handles it).
   - Static render: `StatTile`, `DashboardView` (loading, error, empty, ready, warning present and absent) and `SearchView`.
   - DB tests (`*.db.test.ts`): aggregates match after a change, and "nguyen" finds "Nguyễn".
5. **Routes.** Both new handlers follow R6 (org from token) and R7 (auth errors only from the wrapper); copy `src/app/api/rooms/route.ts`. They need entries in `routes-guarded.test.ts`.

## Risks
- `unaccent` is an extension. `create extension` may need a privileged role on the shared Postgres and is not forward-compatible with the previous image unless expand-then-contract is followed. A normalised column needs backfill and a keep-in-sync trigger, which is heavier. Also, `unaccent` is not immutable, so an index needs an immutable wrapper. Without an index, a bounded ILIKE scan on a small org is acceptable for v1.
- `unaccent` does not map đ to d on its own (rules-file dependent). Verify in the DB test.
- Search must be scoped by `org_id`, and `escapeLike` must be applied to user text.
- A device or seat search that returns the owner name could leak members the caller should not see. Check the tier rules.
- A late 401/403 after a write is an R7 problem. Not an issue here (read only), but `apiFetch` retries.
- Dashboard "no cached counters" means counting in SQL on every load. Do not reuse `rooms.seat_count`-style counters if any exist. `RoomDto` already has `occupiedCount` and `seatCount`; verify how they are computed in `src/server/rooms` before reusing them for the per-room breakdown (a single aggregate query is preferable to N+1).
- `no-literals.test.ts` will fail the build on hard-coded strings in the new UI.

## Open questions
- Who sees the deactivated-members warning: Managers and Admins only, or everyone (DSH-02 is "all roles", DSH-01 is not stated)?
- Should the warning list all members or be capped, and should it link to a release-seats action?
- Can a plain User see device MAC and owner in search results, or only seats and members?
- Is a header search box wanted, or is the `/search` page enough?
- Are "devices placed vs inventory" counted by `seat_id is not null` (this follows the schema), and do secondary devices count? Confirm.
- Does the dashboard need a link from each tile to a filtered page?
- Does the existing `/members` list filter replace the member group in search, or should both stay?

Files read: work/tickets/SIM-017/ticket.md, src/app/(app)/page.tsx, src/ui/rooms/{RoomsView,RoomCard,OccupancyRing}.tsx, src/ui/seats/useMemberPicker.ts, src/ui/AppShellView.tsx, src/lib/members/search.ts, src/server/members/manage.ts, db/migrations/20261120150000_init.sql, docs/spec-v1.md (DSH-01, DSH-02).
