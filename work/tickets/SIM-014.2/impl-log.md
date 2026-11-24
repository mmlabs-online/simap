# Implementation log — SIM-014.2

## Attempt 1 — 2026-11-24 (slice 1 only: read-only list, status filter, paging; dialogs are SIM-014.4)

### Files touched
| File | Required because |
|---|---|
| `src/ui/copy/requests.ts` | new copy file (D36) |
| `src/ui/requests/requests-api.ts` | read API client `list(status, cursor?)` |
| `src/ui/requests/requests-api.test.ts` | R5 |
| `src/ui/requests/requests-state.ts` | pure filter/gate/paging/time logic |
| `src/ui/requests/requests-state.test.ts` | R5 |
| `src/ui/requests/useRequests.ts` | data hook (mirrors useAudit, no facets) |
| `src/ui/requests/ApprovalsView.tsx` | pure props view, `actions` slot unused |
| `src/ui/requests/ApprovalsView.test.tsx` | static render tests, no jsdom |
| `src/ui/requests/ApprovalsPage.tsx` | tier gate, URL-backed `?status=`, Suspense |
| `src/ui/index.ts` | export `ApprovalsPage` |
| `src/app/(app)/approvals/page.tsx` | replace stub |

### Tests added / changed
- requests-state.test.ts: parseStatusParam, statusHref, canViewApprovals, statusOptions, appendPage, formatRequestTime
- requests-api.test.ts: URL building, shape check, error mapping
- ApprovalsView.test.tsx: loading, error, empty per status, forbidden, ready, pending row, decided row, Load more, Vietnamese name, overflow-x-auto

### Checks (actual output summary)
- format:check: exit=0
- typecheck: exit=0
- check:layers: exit=0 (481 files, no violations)
- test: exit=0 (189 files passed; 1977 passed | 3 skipped)
- build: exit=0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- As listed in plan Assumptions (rivalCount, remove `shellCopy.pages.approvals.empty`, relative age, seat link).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: 11 files, about +750 lines including tests, no deletions beyond the stub page.
