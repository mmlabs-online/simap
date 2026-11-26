Status: READY

# Plan — SIM-054: Move "My requests" into My Portal → My seat

## Scope summary
- Spec REG-02: "The user's own requests and their status are listed in My Portal → My seat (POR-02); there is no separate "My requests" nav entry or page (D74). Requests decided since the user last opened the My seat tab count in the My Portal nav badge (SHL-01, OQ-59)."
- Spec POR-01: "The My Portal nav badge counts ... transfers waiting for their confirmation, their overdue devices, and their seat requests decided (approved or rejected) since they last opened the My seat tab" and "The old `/requests` URL redirects client-side to `/portal?tab=seat`".
- Spec POR-02: "Opening the My seat tab (including landing on My Portal, whose default tab is My seat) marks the member's request decisions as seen, using the existing mark-seen API ... The other tabs do not mark decisions seen."
- D74 (decisions table): "My requests" leaves the nav for every tier; `/requests` redirects client-side; badge = incoming transfers + overdue devices + unseen decisions; Approvals unchanged, no new API.
- Ticket out of scope: Approvals (Manager+) and its badge; any API change.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | No "My requests" nav link for User, Manager or Admin, desktop or mobile | `src/lib/nav.test.ts` › navItemsFor tests updated (no `myRequests` id for any tier, rail order list without it; admin length 11). `AppShellView.test.tsx` › new test: for each tier the rendered HTML has no `href="/requests"` (rail and bottom bar are one `navItemsFor` source; the test asserts the string is absent from the whole markup). `pnpm typecheck` proves `NavId`/copy no longer reference it. |
| 2 | `/requests` lands on `/portal?tab=seat` | `portal-state.test.ts` › `requestsPageRedirect` returns `"/portal?tab=seat"`. Local run: open `/requests` signed in, URL becomes `/portal?tab=seat` (client-side `router.replace`, same pattern as `DevicesPage`). |
| 3 | Portal badge = incoming + overdue + unseen decisions | `portal-state.test.ts` › `portalBadgeTotal(c, decisions)`: (2,5ret,4ext,3 overdue, 4 decisions) = 9; all zero = 0; decisions only = n; returns/extensions never counted. `AppShellView.test.tsx` › portal badge test with the new label. `shell.ts` `portalBreakdown(c, decisions)` tests: single part, multi part total, all zero. |
| 4 | Opening My seat clears decisions; My devices and Profile do not | `portal-state.test.ts` › `marksDecisionsSeen("seat")` true, `"devices"` / `"profile"` false; `parsePortalTab([])` (landing on `/portal`) is `"seat"` so landing marks seen (existing test, cite it). `MySeatTab` is the only mounted caller and receives `markSeen={marksDecisionsSeen(tab)}`. Manual: see Test plan below. |
| 5 | Approvals badge unchanged | Diff review: `ApprovalsPage`, its badge code and `AppShellView` badge mapping untouched; `AppShellView.test.tsx` existing approvals/devices badge tests still pass. |
| 6 | Unit tests: badge sum, mark-seen-on-tab, nav | See Tests to write; `pnpm test` green. |

## Ming verification after merge
Manual on the deployed app as a User: get a request decided, see the My Portal badge include it, open My seat (or land on `/portal`), badge drops by the decision count; open My devices / Profile with an unseen decision and confirm the badge keeps it. Open an old `/requests` bookmark and confirm it lands on My seat.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/nav.ts` | Remove `"myRequests"` from `NavId` (line 10) and its `NAV_ITEMS` row (line 34) | REG-02/D74 no nav entry | no |
| `src/lib/nav.test.ts` | Drop `myRequests` from the user/manager/rail-order lists (lines 7-15, 24, 60); admin count 12 -> 11 (line 34); delete the `/requests` isActive test (81-86); keep portal test (line 125 still valid) | tests follow the nav | no |
| `src/ui/copy/shell.ts` | Remove `nav.myRequests` (56), `badge.byNav.myRequests` (92), `pages.myRequests` (106) only if no longer used (MyRequestsView line 51 uses `pages.myRequests.title` for the non-embedded heading; see Approach step 7). Change `portalBreakdown(c, decisions)` to include `newDecisions(decisions)` as a third part; add `portal: portalBreakdown`-compatible label. Keep `byNav.portal` fallback | badge text for the new part | no |
| `src/ui/portal/portal-state.ts` | `portalBadgeTotal(c, decisions)` = incoming + overdue + decisions; add `marksDecisionsSeen(tab)` and `requestsPageRedirect` constant/function | pure, testable rules (rule 6) | no |
| `src/ui/portal/portal-state.test.ts` | Update `portalBadgeTotal` (128-132) and `portalBreakdown` (135-144) tests; add `marksDecisionsSeen` and `requestsPageRedirect` tests | criteria 2-4 | no |
| `src/ui/AppShell.tsx` | Drop `myRequests: count`; `portal: portalBadgeTotal(handoffs, count)`; `badgeLabels.portal: portalBreakdown(handoffs, count)`. `useRequestBadge` and both providers stay (they now feed the portal badge) | D74 badge | no |
| `src/ui/AppShellView.test.tsx` | Replace the myRequests badge tests (206-223, 260-266) with portal-badge equivalents (numeral aria-hidden, 9+ cap with exact count in sr-only, 0 = no markup, portal and devices texts independent); add "no `/requests` link for any tier" | criteria 1, 3 | no |
| `src/ui/portal/MySeatTab.tsx` | Add prop `markSeen: boolean`. When true, pass `onPage` to `useMyRequests` that does what `MyRequestsPage.onPage` did: `mergeNewIds` into a `newIds` state (feeds `MyRequestsView newIds`, replacing `new Set()` at line 92), `newestDecidedAt(items, markedUpTo.current)`, `requestsApi.markSeen(upTo)`, `setBadge(r.value.unseen)` via `useSetRequestBadge`, guarded by `mounted`. Update the doc comment (line 20) | POR-02 mark-seen | no |
| `src/ui/portal/PortalPage.tsx` | `<MySeatTab markSeen={marksDecisionsSeen(tab)} />` (line 27) | one rule for tab to mark-seen | no |
| `src/app/(app)/requests/page.tsx` | Render `<RequestsRedirect />` instead of `<MyRequestsPage />` | redirect | no |
| `src/ui/requests/RequestsRedirect.tsx` (new) | `"use client"`; `useRouter().replace(requestsPageRedirect)` in `useEffect`; return null. Mirrors `DevicesPage` lines 49-58. Renders below `AuthGate` like other pages | redirect, client-side per spec | no |
| `src/ui/index.ts` | Line 32: replace `MyRequestsPage` export with `RequestsRedirect` | page imports only via `@/ui` | no |
| `src/ui/requests/MyRequestsPage.tsx` | Delete (old mark-seen path) | ticket scope | no |
| `src/ui/requests/MyRequestsView.tsx` | Only if step 7 removes the standalone mode; otherwise untouched | cleanup | no |

No file matches a High path.

## Data model / migration
None.

## API contract
None. Uses existing `GET /api/requests/mine` (unseen count) and the existing mark-seen route `POST /api/requests/mine/seen` through `requestsApi.markSeen`, unchanged (R6/R7 unaffected).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/portal/portal-state.test.ts` › portalBadgeTotal sums incoming + overdue + decisions | criterion 3 |
| `src/ui/portal/portal-state.test.ts` › portalBadgeTotal ignores returns and extensions | criterion 3 |
| `src/ui/portal/portal-state.test.ts` › portalBreakdown with decisions (single, multi total, zero) | criterion 3 label |
| `src/ui/portal/portal-state.test.ts` › marksDecisionsSeen only for seat | criterion 4 |
| `src/ui/portal/portal-state.test.ts` › requestsPageRedirect is `/portal?tab=seat` | criterion 2 |
| `src/lib/nav.test.ts` › updated lists, no myRequests for any tier | criterion 1 |
| `src/ui/AppShellView.test.tsx` › portal badge numeral / 9+ / zero; no `/requests` link on any tier | criteria 1, 3 |
| Existing `newestDecidedAt` / `mergeNewIds` tests (request-badge) | reused unchanged |

## Approach
1. Pure logic first in `portal-state.ts` (badge sum, `marksDecisionsSeen`, redirect target) with tests.
2. Update `shell.ts` `portalBreakdown` and the nav removal in `nav.ts`; fix nav and shell tests.
3. `AppShell.tsx`: feed the request count into the portal badge only.
4. `MySeatTab`: add the mark-seen flow, ported from `MyRequestsPage` (never send an empty body; mark only up to the newest shown decision, as the old doc comment requires). `MySeatTab` is mounted only when tab is `seat`, so My devices and Profile cannot mark; the `markSeen` prop makes the rule explicit and testable.
5. Add `RequestsRedirect`, switch `requests/page.tsx` and `ui/index.ts`, delete `MyRequestsPage.tsx`.
6. Rules: R1 (page imports only from `@/ui`; UI imports lib only), R3/R4 (no env, no extras), R5 run `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `pnpm test`.
7. Cleanup of `MyRequestsView` standalone mode (non-`embedded`, `pages.myRequests`, and `newIds` chips) is optional: keep it untouched unless it is dead and trivially removable; if `pages.myRequests` is still used by the view, leave that copy key. Record anything left over in follow-ups (R4).

## Specialist input used
None (fast lane, no consult).

## Assumptions
- Hotspot: overlaps SIM-053 (My Portal polish) on `src/ui/portal/**` (`MySeatTab.tsx`, `PortalPage.tsx`) per the ticket; the orchestrator must not run both at once, otherwise expect a rebase.
- Depends on SIM-045.1 (`portal-state.ts`, `DevicesPage` redirect precedent) being in place; the files above exist.
- "New" chips in the embedded request list now work in My seat (they were `new Set()` before); this follows the old page behaviour and is not new scope beyond keeping the existing `newIds` prop meaningful. If the reviewer sees it as scope creep, pass `new Set()` as before.
- `useRequestBadge` refreshes on route change, focus and visibility; the landing on `/portal` marks seen immediately after the list loads, and the shell badge updates through `setBadge` (sequence guard in `RequestBadgeProvider` prevents a stale overwrite). `router.replace` between tabs changes only the search string, not `pathname`, so tab switches do not refetch the badge; acceptable.
- If a member has no unseen decisions, `newestDecidedAt` returns null and no mark-seen call is made (existing behaviour).

## Blocking questions
None.

## Split proposal
None. Estimated well under 400 changed lines.
