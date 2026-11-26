## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| src/lib/nav.ts | Remove `myRequests` nav id and row (REG-02/D74) |
| src/lib/nav.test.ts | Lists follow nav; admin 11; no `/requests` entry for any tier |
| src/ui/copy/shell.ts | `portalBreakdown(c, decisions)`; removed `nav.myRequests` and `byNav.myRequests` (`pages.myRequests` kept: MyRequestsView still uses it) |
| src/ui/portal/portal-state.ts | `portalBadgeTotal(c, decisions)`, `marksDecisionsSeen`, `requestsPageRedirect` |
| src/ui/portal/portal-state.test.ts | Tests for the three above and the new breakdown |
| src/ui/AppShell.tsx | Request count now feeds the portal badge and label |
| src/ui/AppShellView.test.tsx | Portal badge tests replace myRequests ones; no `/requests` link on any tier; admin link list 10 |
| src/ui/portal/MySeatTab.tsx | `markSeen` prop; mark-seen flow ported from MyRequestsPage; `newIds` now live |
| src/ui/portal/PortalPage.tsx | Pass `markSeen={marksDecisionsSeen(tab)}` |
| src/app/(app)/requests/page.tsx | Render `RequestsRedirect` |
| src/ui/requests/RequestsRedirect.tsx (new) | Client-side redirect to `/portal?tab=seat` |
| src/ui/index.ts | Export `RequestsRedirect` instead of `MyRequestsPage` |
| src/ui/requests/MyRequestsPage.tsx | Deleted (old mark-seen path) |

### Tests added / changed
- portal-state.test.ts › portalBadgeTotal, marksDecisionsSeen, requestsPageRedirect, portalBreakdown with decisions
- nav.test.ts › updated lists, no /requests entry for any tier
- AppShellView.test.tsx › portal badge numeral / 9+ / zero / together with devices; no /requests link on any tier

### Checks (actual output summary)
- typecheck: pass; check:layers: "864 files, no violations"
- format:check: "All matched files use the correct format."
- test: 328 files passed, 3287 tests passed, 7 skipped
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- MyRequestsView standalone (non-embedded) mode and `pages.myRequests` are now only used by nothing but the embedded path; could be removed in a cleanup ticket.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +112 / -137 lines (before impl-log)
