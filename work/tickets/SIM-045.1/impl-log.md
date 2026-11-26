## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| src/ui/portal/portal-state.ts | `seat` first in `PORTAL_TABS` (default tab) |
| src/ui/portal/portal-state.test.ts | new default and hrefs |
| src/ui/portal/PortalPage.tsx | three-way panel |
| src/ui/portal/PortalTabs.test.tsx | three tabs in order |
| src/ui/portal/my-seats.ts (new) | pure logic: readOwnMemberId, composeSeats, loadMySeats, seatTabEmpty, releaseView, releaseOutcome |
| src/ui/portal/my-seats.test.ts (new) | AC 2, 4, 5, 6 |
| src/ui/portal/useMySeats.ts (new) | seats hook (stale counter, refresh keeps rows) |
| src/ui/portal/MySeatView.tsx (new) | pure view |
| src/ui/portal/MySeatView.test.tsx (new) | view tests |
| src/ui/portal/MySeatTab.tsx (new) | container: release dialog, cancel, no markSeen |
| src/ui/requests/MyRequestsView.tsx | `embedded` prop |
| src/ui/requests/MyRequestsView.test.tsx | embedded case |
| src/ui/copy/portal.ts | `tabs.seat` and `seat` copy block |

### Tests added / changed
- portal-state.test.ts › parsePortalTab, portalTabHref (updated)
- PortalTabs.test.tsx (updated, three tabs)
- my-seats.test.ts › readOwnMemberId, composeSeats, loadMySeats, seatTabEmpty, releaseView
- MySeatView.test.tsx (row/link, hidden link, empty, error, loading)
- MyRequestsView.test.tsx › embedded

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck + check:layers: exit 0; "check-layers: 846 files, no violations"
- test: Test Files 322 passed | 1 skipped (323); Tests 3234 passed | 7 skipped
- build: exit 0
- test:db: not run (no DB code)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- The embedded requests list shows its own "no requests" text under the seat empty state; fine for now.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +650 / -15 lines including tests.
