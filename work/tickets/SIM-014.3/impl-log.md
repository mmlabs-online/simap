## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/ui/requests/requests-api.ts` | `call(path, init, read(body, status))`; `create`, `cancel`, `mine`, `markSeen` (plan step 1) |
| `src/ui/requests/requests-api.test.ts` | create, cancel, mine, markSeen cases |
| `src/ui/requests/requests-state.ts` | generic `ListState`/`appendPage`, `cancelOutcome` |
| `src/ui/requests/requests-state.test.ts` | `cancelOutcome` table, `appendPage` with `MyRequestDto` |
| `src/ui/requests/request-badge.ts` (new) | `newestDecidedAt`, `mergeNewIds`, `badgeText` |
| `src/ui/requests/request-badge.test.ts` (new) | tests for the three helpers |
| `src/ui/requests/useRequestBadge.tsx` (new) | `RequestBadgeProvider`, `useRequestBadge`, `useSetRequestBadge` |
| `src/ui/requests/useMyRequests.ts` (new) | list hook with `onPage` for the seen flow |
| `src/ui/requests/MyRequestsView.tsx` (new) | pure page body |
| `src/ui/requests/MyRequestsView.test.tsx` (new) | static render tests |
| `src/ui/requests/MyRequestsPage.tsx` (new) | container: cancel flow and seen flow |
| `src/app/(app)/requests/page.tsx` (new) | route |
| `src/ui/index.ts` | export `MyRequestsPage` |
| `src/ui/copy/requests.ts`, `seats.ts`, `shell.ts` | D36 copy (`mine`, request strings, badge, nav and page titles) |
| `src/ui/seats/seat-actions.ts` (+ test) | `request` action, button rule, `requestResult`, `info` outcome |
| `src/ui/seats/useSeatActions.ts` | `requestsApi`, `info` state, `requestSeat` |
| `src/ui/seats/SeatActions.tsx` (+ test) | Request button, info line (`role="status"`) |
| `src/ui/seats/SeatsPage.tsx` | wire `requestsApi`, `info`, `onRequest` |
| `src/lib/nav.ts` (+ test), `src/lib/icons.ts` | `myRequests` nav entry, `inbox` icon |
| `src/ui/AppShellView.tsx` (+ test) | `badges` prop and markup, bottom-bar overflow |
| `src/ui/AppShell.tsx` | provider and `useRequestBadge` |

### Tests added / changed
- requests-api.test.ts › create (201/200, errors), cancel, mine, markSeen
- requests-state.test.ts › appendPage works for MyRequestDto pages; cancelOutcome (4 cases)
- request-badge.test.ts › newestDecidedAt (3), mergeNewIds (2), badgeText
- MyRequestsView.test.tsx › loading, error, empty, ready rows, New chip, Cancel, notice, Load more
- seat-actions.test.ts › request (button table, requestResult, outcome success and failures, regression)
- SeatActions.test.tsx › request button, button row, info vs alert role, busy
- AppShellView.test.tsx › 7 links for admin; badge tests (4)
- nav.test.ts › id lists, rail order, isActive for /requests
- Note: `disabled:` appears in every Button class, so new tests match `disabled=""` instead of `disabled`.

### Checks (actual output summary)
- typecheck: exit=0 (`next typegen && tsc --noEmit`, no errors)
- format:check: exit=0 ("All matched files use the correct format.")
- check:layers: exit=0 ("489 files, no violations")
- test: exit=0 (Test Files 191 passed; Tests 2015 passed, 3 skipped)
- build: exit=0 (Compiled successfully)

### Out-of-plan files
None. (`next typegen` output is generated and untracked/ignored.)

### Follow-ups (noticed, not done)
- Existing `SeatActions.test.tsx` and `ApprovalsView` style checks `<button[^>]*disabled[^>]*>` always match because of the `disabled:` utility classes; those older assertions are weak. Not changed.
- Items from plan Assumption 11 (`hasPendingRequest` on `SeatDto`, "View my requests" link, mobile bar "More" menu).
- Not run: local manual run with a User token (no dev token/server driven here); wiring of `useRequestBadge`, `useMyRequests`, `MyRequestsPage` is covered by typecheck and build only.

### Scope self-check
- Could the diff be smaller? No; all files are in the plan list.
- Diff size: about +600 / -32 lines tracked, plus new files.
