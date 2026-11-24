Status: READY

# Plan — SIM-017.3: Search page UI

## Scope summary
`docs/spec-v1.md` §DSH (lines 399-403):
> **DSH-02 Search and filter** (all roles)
> - [ ] Search runs on the server across seats (code, occupant), devices (name, inventory no., MAC, owner) and members
>   (name, employee code). Results are always current.
> - [ ] Search ignores case and Vietnamese diacritics: "nguyen" finds "Nguyễn".
> - [ ] Result lists have bounded page sizes.

(The CSV/PNG export bullets, lines 404-406, are not part of this ticket or of the SIM-017 split.)

`work/decisions.md` D36 (line 43): "UI copy is English by default; all user-facing text lives in copy files ...
Names/data keep Vietnamese diacritics (display, sort, search)."

Ticket scope (ticket.md lines 24-25):
> - `/search?q=` page with grouped results (Seats, Devices, Members), per-group Load more, 300 ms debounce and a
>   stale-drop reducer (model: `src/ui/seats/member-picker.ts`).
> - A "Search" nav entry (icon `search`). No live dropdown in the shell header.

Out of scope (ticket line 28): any server or API change. Also out of scope (orchestrator): new deep-link params on
other pages.

API contract consumed as is (SIM-017.2, merged): `GET /api/search?q=&kind=all|seat|device|member&limit=&cursor=`
(`src/app/api/search/route.ts:9-19`), DTOs in `src/lib/search/types.ts:4-34`, validator
`src/lib/validate/search-query.ts:19-61`. `kind=all` returns the first page of every group, each with its own
`nextCursor`; the next page is `?q=<same q>&kind=<seat|device|member>&cursor=<nextCursor>`. A cursor with `kind=all` or of
another kind is a 400 (`search-query.ts:55`). Blank `q`, more than 80 code points, or `q` that folds to "" is a 400
(`search-query.ts:28-32`).

Link targets that exist today (checked):
- Seat → room page `/rooms/<code>` (`roomDetailHref`, `src/lib/nav.ts:63-66`), which already accepts `?seat=<seatCode>`
  and opens that seat (`src/ui/seats/seat-view.ts:11-22`, read in `src/ui/seats/SeatsPage.tsx:44-45`). This is an
  existing param, so the search uses it; no new param is added.
- Device → `/devices` (`src/app/(app)/devices/page.tsx`); `DevicesPage` reads no search params, so a plain link.
- Member → `/members` (`src/app/(app)/members/page.tsx`, still a `PageSkeleton` + invite button, SIM-011.2 is
  ESCALATED); a plain link.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Typing a query shows grouped results that link to the seat's room, the Devices page and the Members page. | `src/ui/search/SearchView.test.tsx › "ready: three groups in order Seats, Devices, Members"`, `"seat row links to /rooms/<room>?seat=<code>"`, `"device row links to /devices"`, `"member row links to /members"`; `search-state.test.ts › "search then loaded: ready with all three groups"`, `"seatResultHref …"`; `search-api.test.ts › "searchAll sends q and kind=all only"`. Local run: `pnpm dev`, open `/search`, type, results appear after the pause and the URL becomes `/search?q=…`. |
| 2 | Each group pages with Load more; empty and error states per group. | `search-state.test.ts › "more + moreLoaded appends to that group only, dedups by id, takes the new cursor"`, `"moreLoaded failure keeps items and sets that group's error"`, `"canLoadMore …"`; `search-api.test.ts › "searchMore sends kind=<x> and cursor, reads one group"`; view tests `"Load more only when the group has nextCursor"`, `"loading more: button disabled with loading text"`, `"more error: alert with message and retry inside that group only"`, `"empty group shows its own empty text"`; page-level `"error: role=alert with apiErrorMessage and retry"` (see A2). |
| 3 | Static-render and pure-logic tests (no jsdom) cover the reducer and the view. | `pnpm test`: `src/ui/search/search-state.test.ts`, `src/ui/search/SearchView.test.tsx` (`renderToStaticMarkup`, as `src/ui/dashboard/DashboardView.test.tsx:1-37`), `src/ui/search/search-api.test.ts`. No `jsdom` / `@vitest-environment` in the new files. |
| 4 | "Search" nav entry (icon `search`), for all roles; no dropdown in the header. | `src/lib/nav.test.ts` (updated lists include `search` for user/manager/admin), `src/ui/AppShellView.test.tsx › "admin on /rooms/A1: nav landmark, 9 links, one aria-current"` includes `/search`; `nav.test.ts › isActive "/search"`. Code review: `src/ui/AppShellView.tsx` unchanged. |
| 5 | Diacritics shown as stored; query cleaned like the server. | `search-state.test.ts › "normalizeSearchQuery: NFC, collapses whitespace, trims, caps at 80 code points"`, `"isSearchable: blank and marks-only are not searchable"`; view test renders "Nguyễn Văn An" verbatim. |
| 6 | Copy in copy files (D36). | `src/ui/copy/no-literals.test.ts`, `src/ui/copy/copy.test.ts` stay green (copy.test line 29 checks `shellCopy.nav.search`). |
| 7 | All checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
None required. The ticket's manual test ("search Vietnamese names with and without diacritics") can be done in a
local run with `pnpm seed:dev` data (reviewer/implementer); Ming may repeat it on production data after the next
release.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/search/search-state.ts` | create | pure reducer, events, `INITIAL_SEARCH`, `canLoadMore`, `normalizeSearchQuery`, `isSearchable`, `parseSearchParam`, `searchHref`, `seatResultHref`, `GROUP_KIND`, `DEVICES_HREF`, `MEMBERS_HREF` | no |
| `src/ui/search/search-state.test.ts` | create | AC 1, 2, 5 | no |
| `src/ui/search/search-api.ts` | create | `createSearchApi(fetcher)`: `searchAll(q)`, `searchMore(group, q, cursor)`; result wrapper as `src/ui/dashboard/dashboard-api.ts:1-43` | no |
| `src/ui/search/search-api.test.ts` | create | URL building, shape checks, error mapping | no |
| `src/ui/search/useSearch.ts` | create | hook: input state, 300 ms debounce, request ids, URL sync callback (model `src/ui/seats/useMemberPicker.ts:16-74`) | no |
| `src/ui/search/SearchView.tsx` | create | pure view: input, idle / loading / error / ready, three groups | no |
| `src/ui/search/SearchView.test.tsx` | create | static-render tests | no |
| `src/ui/search/SearchPage.tsx` | create | client page: `Suspense` around `useSearchParams`, `router.replace` of `?q=` (model `src/ui/requests/ApprovalsPage.tsx:119-155`) | no |
| `src/ui/copy/search.ts` | create | all search copy (D36) | no |
| `src/app/(app)/search/page.tsx` | create | route `/search` rendering `<SearchPage />` (as `src/app/(app)/devices/page.tsx`) | no |
| `src/ui/index.ts` | modify | export `SearchPage` (after line 30) | no |
| `src/lib/nav.ts` | modify | `NavId` (lines 4-13) gains `"search"`; `NAV_ITEMS` gets `{ id: "search", href: "/search", icon: "search", minTier: "user", placement: "rail" }` right after `dashboard` (line 25) | no |
| `src/lib/nav.test.ts` | modify | lines 7-8, 11-19, 27 (`9` → `10`), 36-46 include `search` after `dashboard`; add `isActive` case for `/search` | no |
| `src/ui/copy/shell.ts` | modify | `nav.search: "Search"` (lines 9-19; required by `satisfies Record<NavId, string>`) | no |
| `src/ui/AppShellView.test.tsx` | modify | lines 81-93: title "9 links", `"/search"` after `"/"` | no |

Not touched: `src/ui/AppShellView.tsx` (renders whatever `navItemsFor` returns, lines 36-38, 66; bottom bar already
`overflow-x-auto`, line 65), `src/ui/seats/**` (only `seatHref` is imported from `seat-view.ts`), `src/ui/devices/**`,
the members page, everything under `src/app/api/**`, `src/server/**`, `src/lib/search/**`, `src/lib/validate/**`.
No file matches a High path in `.claude/loop.config.md` → Gate stays `none`.

## Data model / migration
None.

## API contract
None (no endpoint change). The UI calls the existing `GET /api/search` as quoted in the Scope summary, never passing
`limit` (server default 20 per group, `SEARCH_LIMITS.defaultLimit`).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/search/search-state.test.ts › normalizeSearchQuery: NFC, collapses whitespace, trims, caps at 80 code points` (NFD "Nguyễn" → NFC; 81 Vietnamese chars → 80, counted by code point; trailing space after the cut trimmed) | AC 5, diacritics, bounds |
| `… › isSearchable: "", "   ", "́" false; "nguyen", "Đ" true` (uses `foldText`, same rule as the validator) | no 400 on marks-only input |
| `… › parseSearchParam: none or duplicate → ""; one value → normalized` | URL state |
| `… › searchHref: "" → "/search"; "Nguyễn Văn" → encoded, no raw "ễ"; "a&b" encoded` | URL state |
| `… › seatResultHref: C302 / C302-01 → "/rooms/C302?seat=C302-01"; room ".." → null; room "A 1" encoded` | AC 1 |
| `… › search "" → idle, groups empty, no loading` | empty query |
| `… › search then loaded: ready with all three groups` | AC 1 |
| `… › stale loaded (older id) is dropped` | stale-drop |
| `… › loaded failure → error with code; a later search clears it` | error state |
| `… › more + moreLoaded appends to that group only, dedups by id, takes the new cursor` | AC 2 |
| `… › moreLoaded failure keeps items and sets that group's error; a new more clears it` | AC 2 per-group error |
| `… › moreLoaded after a new search is dropped` (id no longer the group's `moreId`) | stale-drop for paging |
| `… › two groups page at once; each answer lands in its own group` | per-group paging |
| `… › canLoadMore: false when not ready, when the group has no nextCursor, or its more is in flight` | AC 2 |
| `src/ui/search/search-api.test.ts › searchAll sends q and kind=all only` (path `/api/search?q=…&kind=all`, q "Nguyễn Văn" round-trips via `URLSearchParams`) | AC 1 |
| `… › searchAll: ok body with three groups → value; a null or malformed group → internal` | shape check |
| `… › searchMore sends kind=<x> and cursor, reads one group` (seats → `kind=seat`, devices → `device`, members → `member`) | AC 2 |
| `… › non-ok → error code; no code → internal; signed_out → unauthenticated; fetch throws → unavailable` (pattern `src/ui/audit/audit-api.test.ts:1-15`) | errors |
| `src/ui/search/SearchView.test.tsx › idle: input with copy label, prompt text, no groups` | empty query |
| `… › input value reflects the query` | |
| `… › loading: aria-busy skeleton` | states |
| `… › error: role=alert with apiErrorMessage and retry` | page-level error (A2) |
| `… › ready: three groups in order Seats, Devices, Members` (h2 order in markup) | AC 1 |
| `… › seat row links to /rooms/<room>?seat=<code>; occupant "Nguyễn Văn An" verbatim; no occupant → empty-seat copy; room ".." → no link` | AC 1, diacritics, empty fields |
| `… › device row links to /devices; shows inventory no., MAC when present, owner, placement room/seat or in-inventory copy` | AC 1, empty fields |
| `… › member row links to /members; employee code when present; deactivated chip only for status deactivated` | AC 1 |
| `… › empty group shows its own empty text while other groups list rows` | AC 2 |
| `… › Load more only when the group has nextCursor` | AC 2 |
| `… › loading more: button disabled with loading text` | AC 2 |
| `… › more error: alert with message and retry inside that group only` | AC 2 |
| `src/lib/nav.test.ts` (updated expectations; new `isActive: /search and /search/x active, /searchx not`) | AC 4 |
| `src/ui/AppShellView.test.tsx › admin on /rooms/A1: nav landmark, 9 links, one aria-current` (updated) | AC 4 |

Existing guards that must stay green: `src/ui/copy/no-literals.test.ts`, `src/ui/copy/copy.test.ts`,
`pnpm check:layers`.

## Approach
1. **Copy** — `src/ui/copy/search.ts`, `export const searchCopy = { title: "Search", inputLabel, placeholder
   ("Search seats, devices and members"), prompt, groups: { seats: { title, empty }, devices: {…}, members: {…} },
   count: (n: number, more: boolean) => …, loadMore, loadingMore, retry, emptySeat, inInventory,
   placement: (room: string, seat: string) => …, deactivated, mac: (m: string) => … } as const`. English only, no
   Vietnamese characters (`no-literals.test.ts:52-60`). `shellCopy.nav.search = "Search"`.
2. **Pure state** — `src/ui/search/search-state.ts` (imports only `@/lib/search/types`, `@/lib/search/fold`,
   `@/lib/nav`, `../seats/seat-view`):
   - `type GroupKey = "seats" | "devices" | "members"`; `GROUP_KIND: Record<GroupKey, SearchKind>`
     = `{ seats: "seat", devices: "device", members: "member" }`; `GROUP_ORDER = ["seats", "devices", "members"]`.
   - `type GroupState<T> = { items: T[]; nextCursor: string | null; moreId: number | null; moreError: string | null }`.
   - `type SearchState = { query: string; status: "idle" | "loading" | "ready" | "error"; errorCode: string | null;
     latest: number; seats: GroupState<SeatHit>; devices: GroupState<DeviceHit>; members: GroupState<MemberHit> }`;
     `INITIAL_SEARCH` = idle, empty groups, `latest: 0`.
   - Events: `{ type: "search"; id; q }` → `{ ...INITIAL_SEARCH, query: q, latest: id, status: q === "" ? "idle" :
     "loading" }`; `{ type: "loaded"; id; result: SearchResult<AllGroups> }` → dropped unless `id === state.latest`
     and status `loading`; ok → each group `{ items, nextCursor, moreId: null, moreError: null }`, status `ready`;
     fail → status `error`, `errorCode`; `{ type: "more"; group; id }` → that group `moreId = id, moreError = null`;
     `{ type: "moreLoaded"; group; id; result }` → dropped unless `id === state[group].moreId`; ok → append items not
     already listed (by `id`, as `member-picker.ts:58-59`), take `nextCursor`, `moreId: null`; fail → `moreId: null,
     moreError: code`, items kept. A `search` resets every `moreId`, so paging answers of an old query are dropped.
   - `canLoadMore(state, group)` = `status === "ready" && nextCursor !== null && moreId === null`.
   - `normalizeSearchQuery(raw)`: same cleaning as `search-query.ts:29` (NFC, `\s+` → " ", trim), then at most
     `SEARCH_LIMITS.q` code points and trim again (copy of `member-picker.ts:41-44`).
     `isSearchable(q) = q !== "" && foldText(q) !== ""` — the hook never sends a query the validator would refuse.
   - `parseSearchParam(values: string[])`: exactly one value → `normalizeSearchQuery`, else `""` (as
     `parseStatusParam`, `src/ui/requests/requests-state.ts:28-33`).
   - `searchHref(q)`: `""` → `/search`, else `/search?q=${encodeURIComponent(q)}`.
   - `seatResultHref(hit)`: `const room = roomDetailHref(hit.roomCode); return room === null ? null : seatHref(room,
     hit.code)`. `DEVICES_HREF = "/devices"`, `MEMBERS_HREF = "/members"`.
3. **API** — `src/ui/search/search-api.ts`, `call`/`errorCode`/`fail` copied from `src/ui/audit/audit-api.ts:5-37`.
   - `searchAll(q)`: `URLSearchParams({ q, kind: "all" })` → `/api/search?…`; read checks each of `seats`, `devices`,
     `members` is an object with `items` array and `nextCursor` string or null, else `internal`; value type
     `AllGroups = { seats: SearchGroup<SeatHit>; devices: …; members: … }` (non-null).
   - `searchMore(group, q, cursor)`: params `q`, `kind: GROUP_KIND[group]`, `cursor`; reads `body[group]` with the
     same check.
   Never throws; never passes `limit`.
4. **Hook** — `src/ui/search/useSearch.ts` (`"use client"`), `useSearch(api, urlQ: string, onCommit: (q) => void)`:
   - `useReducer(searchReducer, INITIAL_SEARCH)`, `query` input state initialised from `urlQ`, `counter`/`mounted`
     refs (as `useMemberPicker.ts:17-30`), `committed` ref (last q searched), `written` ref (`Set<string>` of q values
     passed to `onCommit`).
   - `run(q)`: `committed.current = q`; `id = ++counter`; dispatch `search`; if `!isSearchable(q)` stop (idle; for a
     marks-only q the reducer gets `""`); else `await api.searchAll(q)`, dispatch `loaded` if mounted.
   - Mount / URL effect on `[urlQ]`: if `committed.current === null` (mount) → `run(urlQ)`; else if `urlQ !==
     committed.current && !written.current.has(urlQ)` (an outside change, e.g. a link to `/search?q=x`) →
     `written.current.clear(); setQuery(urlQ); run(urlQ)`. Echoes of our own `router.replace` are in `written` and
     ignored, so a late echo cannot overwrite newer typing.
   - Debounce effect on `[normalized]`: `setTimeout(300)`; if `normalized !== committed.current` →
     `written.current.add(normalized); onCommit(normalized); run(normalized)`.
   - `loadMore(group)`: if `!canLoadMore(state, group)` return; `id = ++counter`; dispatch `more`;
     `await api.searchMore(group, state.query, state[group].nextCursor)`; dispatch `moreLoaded` if mounted. Uses
     `state.query` (the query the results belong to), not the input text.
   - Returns `{ state, query, setQuery, loadMore, retry: () => void run(committed.current ?? "") }`.
5. **View** — `src/ui/search/SearchView.tsx`, pure, props `{ query, onQueryChange, state, onRetry, onLoadMore(group)
   }`. Layout as `src/ui/dashboard/DashboardView.tsx` / `RoomsView.tsx` (`p-4 lg:p-6`, `h1` `searchCopy.title`).
   - `FilledInput` (`src/ui/FilledInput.tsx`, default icon `search`) with `type="search"`, `aria-label` and
     `placeholder` from copy, `value`, `onChange`, `autoFocus` not used. No `<form>` (Enter does nothing).
   - idle: prompt text. loading: `Card animate-pulse` with `aria-busy="true"`. error: `Card role="alert"` with
     `apiErrorMessage(errorCode)` and a retry `Button`.
   - ready: for each `GROUP_ORDER` a `<section aria-labelledby>` with `h2` title + `searchCopy.count(items.length,
     nextCursor !== null)`, then the list or `groups.<g>.empty`, then the group's `role="alert"` line with
     `apiErrorMessage(moreError)` + retry `Button` (calls `onLoadMore(group)`) when `moreError`, then a Load more
     `Button` when `nextCursor !== null` (disabled with `loadingMore` text while `moreId !== null`).
   - Seat row: `Link` to `seatResultHref(hit)` (plain text when null) showing `code`, room code, occupant
     `displayName` or `searchCopy.emptySeat`. Device row: `Link` to `DEVICES_HREF` on the name; inventory number,
     `searchCopy.mac(mac)` when not null, owner name, `searchCopy.placement(roomCode, seatCode)` or
     `searchCopy.inInventory`. Member row: `Link` to `MEMBERS_HREF` on the name; employee code when not null;
     `searchCopy.deactivated` chip when `status === "deactivated"`. Names render as stored (D36). A polite
     `aria-live` region is not added (results update on a 300 ms pause; the group headings carry the counts).
6. **Page** — `src/ui/search/SearchPage.tsx` (`"use client"`), structure of `ApprovalsPage.tsx:119-155`:
   `SearchPageInner` reads `useSearchParams().getAll("q")` → `parseSearchParam`, builds the api with `useApiFetch` +
   `useMemo(createSearchApi)`, calls `useSearch(api, urlQ, (q) => router.replace(searchHref(q), { scroll: false }))`,
   renders `SearchView`. `SearchPage` wraps it in `<Suspense>` with the same skeleton fallback. Export from
   `src/ui/index.ts`; `src/app/(app)/search/page.tsx` renders it (pages → ui, R1).
7. **Nav** — `src/lib/nav.ts` and its tests, `shell.ts`, `AppShellView.test.tsx` as in the files table.
8. Run all Checks. Manual: `pnpm dev` with `pnpm seed:dev`, search "nguyen" and "Nguyễn", page a group, open a seat
   link (the room page opens that seat).

Rules: R1 (only ui/lib/pages imports; `search-state.ts` imports `@/lib/*` and `../seats/seat-view`; no `@/server`),
R3 (no env), R4 (only the listed files), R5 (tests above), R7 n/a (no route change), D36 (copy file; names verbatim).

## Specialist input used
- frontend-developer (`work/tickets/SIM-017/consult-frontend-developer.md`):
  - Adopted rec. 2: `/search` page with `?q=` and an input on top; a nav entry; no live header dropdown; reducer and
    debounce logic as pure functions in `search-state.ts` modelled on `member-picker.ts`; static-render tests only.
  - Adopted rec. 3: three sections (Seats, Devices, Members) with heading, count, per-group Load more and empty
    state; per-type cursors; rows link via `src/lib/nav.ts` helpers (`roomDetailHref`) — seat → room with seat (the
    existing `?seat=` param), device → `/devices`, member → `/members`; members show name and employee code, no email
    (the API sends none).
  - Adapted rec. 3 page size: no new UI constant; the server default (`SEARCH_LIMITS.defaultLimit` = 20) is used.
  - Rec. 1, 4 (normalisation, validator, DB tests) and 5 (routes) were done in SIM-017 / SIM-017.2.
  - Open question "header search box vs `/search` page": answered by the ticket (page + nav entry, no dropdown).
- `work/tickets/SIM-017/plan.md` Split proposal item 3 (lines 259-262): followed as written.

## Assumptions
- **A1 Query in the URL with `replace`.** Typing updates `?q=` with `router.replace` after the 300 ms pause, so the
  URL is shareable without adding a history entry per keystroke burst. Opening `/search?q=x` searches at once.
- **A2 Error states.** The first page of all groups is one `kind=all` request, so its failure is one page-level
  alert with Retry (three identical alerts would repeat the same message). Each group has its own empty state and its
  own Load more error with Retry. If Ming wants three independent first-page requests (one per kind), that is a small
  follow-up in `useSearch`.
- **A3 Links are page-level for devices and members.** `/devices` and `/members` accept no filter or highlight param
  today and adding one is out of scope; the links open the page. `/members` is still a skeleton (SIM-011.2
  ESCALATED), so the member link lands there until that ticket ships. Seats use the existing `?seat=` param of the
  room page. Deep links for devices/members are follow-ups.
- **A4 Nav position.** "Search" goes right after Dashboard (both DSH). The spec page list (SHL-01, line 439) does not
  mention search; the ticket adds the entry. User tier now has 6 rail items; the mobile bottom bar already scrolls
  (`AppShellView.tsx:65`).
- **A5 Marks-only or blank query** shows the idle prompt and sends no request (it would be a 400).
- **A6 Seat codes** returned by the API match `parseSeatParam`'s pattern (`seat-view.ts:8`, room code + `-NN`); a
  code that does not would open the room page with "seat not found" handling already in `SeatsPage`.
- **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (`work/backlog.md`: only SIM-017.3 is open).
  `src/lib/nav.ts`, `src/ui/copy/shell.ts`, `src/ui/index.ts` are shared by many UI tickets; one-line additions,
  trivial rebase.

## Blocking questions
None.

## Split proposal
None. About 450-500 source lines (state ~150, view ~170, hook ~80, api ~60, page ~40, copy ~30, nav ~5) plus tests.
Slightly above the rough guide, but the page, its state and its nav entry only make sense together (a page without
the entry is unreachable, the entry without the page is a dead link); the ticket is sized M. Keep as one cycle.
