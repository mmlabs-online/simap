## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/ui/search/search-state.ts` | pure reducer, helpers, hrefs |
| `src/ui/search/search-state.test.ts` | AC 1, 2, 5 |
| `src/ui/search/search-api.ts` | `createSearchApi` (`searchAll`, `searchMore`) |
| `src/ui/search/search-api.test.ts` | URL building, shape checks, errors |
| `src/ui/search/useSearch.ts` | debounce, request ids, URL sync |
| `src/ui/search/SearchView.tsx` | pure view |
| `src/ui/search/SearchView.test.tsx` | static-render tests |
| `src/ui/search/SearchPage.tsx` | client page with Suspense and `router.replace` |
| `src/ui/copy/search.ts` | search copy (D36) |
| `src/app/(app)/search/page.tsx` | route `/search` |
| `src/ui/index.ts` | export `SearchPage` |
| `src/lib/nav.ts` | `search` nav item after dashboard |
| `src/lib/nav.test.ts` | updated lists, 10 items, isActive `/search` |
| `src/ui/copy/shell.ts` | `nav.search` |
| `src/ui/AppShellView.test.tsx` | 9 links incl. `/search` |

### Tests added / changed
- `search-state.test.ts`, `search-api.test.ts`, `SearchView.test.tsx` (names as in plan); `nav.test.ts` and `AppShellView.test.tsx` updated.

### Checks (actual output summary)
- typecheck: exit 0 (`next typegen && tsc --noEmit`)
- check:layers: exit 0, "570 files, no violations"
- format:check: exit 0, "All matched files use the correct format."
- test: exit 0, 218 files passed, 2194 passed | 3 skipped
- build: exit 0, `/search` route listed

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Deep links for devices/members (A3); `/members` is still a skeleton.
- `onCommit` must stay memoized in the page (it is a `useCallback`), otherwise the 300 ms timer restarts on each render.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +1000 lines including tests, no deletions beyond nav test edits.
