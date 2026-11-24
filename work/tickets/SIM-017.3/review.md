# Review — SIM-017.3: Search page UI

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (624 files)
- `pnpm typecheck` — exit 0, "Types generated successfully", tsc clean
- `pnpm check:layers` — exit 0, "check-layers: 570 files, no violations"
- `pnpm test` — exit 0, "Test Files 218 passed (218)", "Tests 2194 passed | 3 skipped (2197)"
- `pnpm build` — exit 0, route list includes `ƒ /search` and `ƒ /api/search`
- `pnpm test:db` — CI-only; no server or SQL change in this diff
- All match impl-log.md Attempt 1.

### Acceptance criteria
- [x] Typing a query shows grouped results that link to the seat's room, the Devices page and the Members page.
  Evidence: `SearchView.test.tsx` › "ready: three groups in order Seats, Devices, Members", "seat row links to
  /rooms/<room>?seat=<code>…", "device row links to /devices…", "member row links to /members…";
  `search-state.test.ts` › "search then loaded: ready with all three groups", "seatResultHref…";
  `search-api.test.ts` › "searchAll sends q and kind=all only". Hook: `src/ui/search/useSearch.ts:59-67` (300 ms
  debounce, then `onCommit` + `run`). The request matches the contract (`src/lib/validate/search-query.ts:19-61`:
  q cleaned the same way, `kind=all`, no `limit`).
- [x] Each group pages with Load more; empty and error states per group.
  Evidence: `search-state.test.ts` › "more + moreLoaded appends to that group only, dedups by id…", "moreLoaded
  failure keeps items and sets that group's error…", "two groups page at once…", "canLoadMore…";
  `search-api.test.ts` › "searchMore sends kind=<x> and cursor, reads one group"; `SearchView.test.tsx` › "empty
  group shows its own empty text…", "Load more only when the group has nextCursor", "loading more: button disabled
  with loading text", "more error: alert with message and retry inside that group only".
  A2 accepted: the first page of all groups is one `kind=all` request (fixed by SIM-017.2, and API changes are out
  of scope), so it can only fail as a whole; one page-level alert (`SearchView.tsx` error branch, test "error:
  role=alert with apiErrorMessage and retry") is the honest rendering of that failure. Each group still has its own
  empty state and its own paging error with Retry. **The PR must name A2** so Ming can ask for three per-kind first
  requests if he wants them (small change in `useSearch.run`).
- [x] Static-render and pure-logic tests (no jsdom) cover the reducer and the view.
  Evidence: `search-state.test.ts` (reducer, helpers), `SearchView.test.tsx` (`renderToStaticMarkup`),
  `search-api.test.ts`; `grep "jsdom|vitest-environment" src/ui/search/*` → no match.
- [x] Plan AC 4, nav entry: `src/lib/nav.ts` adds `search` (icon `search`, `minTier: "user"`, rail) after dashboard;
  `nav.test.ts` and `AppShellView.test.tsx` updated; `AppShellView.tsx` unchanged (no header dropdown).
- [x] Plan AC 5, diacritics: `normalizeSearchQuery` (`search-state.ts`) matches the validator's cleaning plus the
  80 code-point cap; `isSearchable` uses `foldText`, so marks-only input sends no request; names render as stored
  (view test with "Nguyễn Văn An").
- [x] Plan AC 6, copy: `src/ui/copy/search.ts`, `shellCopy.nav.search`; `no-literals.test.ts` / `copy.test.ts` green.
- [x] Plan AC 7, checks green (above).

Stale-answer handling, checked by reading `useSearch.ts`:
- Debounce (`:59-67`): the timer restarts on each `normalized` change; a settled value equal to `committed` is a
  no-op, so the mount run from the URL is not repeated. `onCommit` is a `useCallback` on `[router]`
  (`SearchPage.tsx:18-21`), so the timer is not reset by re-renders.
- Request ids: `search` resets `latest` and every `moreId`; `loaded` is dropped unless `id === latest` and status is
  `loading`; `moreLoaded` is dropped unless `id === state[group].moreId`. Covered by "stale loaded (older id) is
  dropped" and "moreLoaded after a new search is dropped".
- Written-URL set (`:49-57`): echoes of our own `router.replace` are ignored, so a late echo of "ab" cannot reset
  the input after the user has typed "abc"; an outside URL change clears the set, sets the input and runs at once.
  `parseSearchParam(searchHref(q))` round-trips to the same normalized q, so an echo always matches its set entry.
- Load more (`:69-79`) sends `state.query` (the query the shown results belong to), never the input text, and
  needs `canLoadMore` (status `ready`, cursor present, none in flight). The cursor kind always matches
  `GROUP_KIND[group]`, so no 400 from `search-query.ts:55`.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: `src/ui/search/**` imports only `@/lib/*`, `../seats/seat-view` and ui modules; the page
imports `@/ui` (`check:layers` green). R3: no env. R4: changed files equal the plan's file table plus the ticket's
work files. R5: checks green; reducer, helpers, API client and view are tested. R2, R6, R7: n/a (no schema, query or
route change). D36: all copy in `src/ui/copy/search.ts`.

### Blockers from review agents
None.

### Nits (do not block)
- `useSearch.ts:51`: the `written` set is cleared only on an outside URL change, so a value written earlier in the
  same mount is ignored when it comes back from outside. Example: on `/search?q=abc` after the user once cleared the
  input (`""` in the set), clicking the "Search" nav entry (`/search`) changes the URL but keeps "abc" in the input
  and results. Rare and harmless; a fix is to remove an entry once its echo is seen.
- `SearchView.tsx` Group: on a paging error the group shows both "Try again" and "Load more", which do the same thing.
- The URL-sync / debounce decisions in `useSearch.ts` have no test (the ticket allows no jsdom). They could be pulled
  into a pure helper in `search-state.ts` and unit-tested, as the reducer is.

### Follow-ups (out of scope)
- A2: per-group first-page error states would need three `kind=<x>` first requests instead of one `kind=all`; Ming to decide.
- Deep links for devices/members (A3); `/members` is still a skeleton (SIM-011.2).
- Manual check for the PR (not run by the reviewer, needs a signed-in session with seed data): search "nguyen" and
  "Nguyễn", page a group, open a seat link and confirm the room page opens that seat.
