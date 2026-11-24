Status: READY

# Plan — SIM-014.2: Approvals page UI (slice 1: read-only list, status filter, paging)

The full ticket (list + filter + Approve/Reject dialogs + per-row busy + tests) is estimated at ~780 source lines plus
~550 test lines, well over one implement/review cycle. This plan covers **slice 1 only**: the Approvals list with the
`?status=` filter, Load more, the no-access state and the read API client. The Approve/Reject dialogs, outcome logic
and per-row busy state move to a new slice **SIM-014.4** (see `## Split proposal`). This slice meets ticket AC1 and
the view/filter part of AC3; AC2 and the action-outcome part of AC3 move to SIM-014.4.

## Scope summary
`docs/spec-v1.md` REG-02 (lines 377-381):
> - [ ] The Approvals page lists requests and filters them by status.
> - [ ] Approving seats the subject (demoting any primary, DEV-06), marks the request approved, and rejects every other
>   pending request for that seat, all in one transaction.
> - [ ] Rejecting marks the request rejected. Approving or rejecting a request that is not pending changes nothing.

(The second and third bullets are already enforced server-side by SIM-014; their UI belongs to SIM-014.4.)

REG-01 (line 374): "A request for an occupied seat is refused." / D23: "Users request seats only for themselves" —
so a request's `subject` is always the requester, and the list labels it as the requester.

`work/decisions.md`:
- D21 "Users may request a seat in any room of the org." — no room filter is needed on the Approvals page.
- D24 "decisions show in-app ... no email." — no notification work here (ticket Out of scope).
- D26 "per-seat 'không xếp chỗ' flag ... blocks assignment and requests" — surfaces only as the `seat_cannot_seat`
  refusal in SIM-014.4.
- D35 (as used by `formatAuditTime`, `src/ui/audit/audit-state.ts:30-44`): times shown in Asia/Ho_Chi_Minh.
- D36 "all user-facing text lives in copy files" — `src/ui/copy/requests.ts`.

Ticket (ticket.md lines 31-33), slice-1 part:
> - [ ] The Approvals page lists requests with a status filter (default pending).
> - [ ] Static-render and pure-logic tests (no jsdom) cover the view, the filter and the action outcomes.

Backend contract used (SIM-014 / SIM-014.1, merged, unchanged): `GET /api/requests?status&limit&cursor`, tier
`manager` (`src/app/api/requests/route.ts:30-41`), returns `RequestPage` (`src/lib/requests/types.ts:23-26`), default
status pending, `REQUEST_LIMITS` 50/100 (`types.ts:18`), 400 `invalid_request` on a bad query.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The Approvals page lists requests with a status filter (default pending). | `requests-state.test.ts` › "parseStatusParam: missing, unknown, duplicate -> pending; each valid status kept" and › "statusHref: pending drops the param, others set ?status="; `requests-api.test.ts` › "list builds /api/requests?status=…&limit=50 and adds cursor"; `useRequests` logic via `requests-state.test.ts` › "appendPage / stale id"; `ApprovalsView.test.tsx` › "ready: one card per item, pending chip checked", › "decided row shows decider and time", › "pending row shows occupant warning / empty seat". Local run (`pnpm dev`, manager): `/approvals` shows the pending list; clicking Approved changes the URL to `?status=approved` and the list; reload keeps the filter. |
| 2 | Static-render and pure-logic tests (no jsdom) cover the view and the filter (action outcomes: SIM-014.4). | The test files below exist, use `renderToStaticMarkup` / plain functions only (no `jsdom` environment comment), and pass in `pnpm test`. |
| 3 | A `user`-tier visit to `/approvals` makes no request and shows a no-access message. | `requests-state.test.ts` › "canViewApprovals: manager/admin true, user/null false"; `ApprovalsView.test.tsx` › "forbidden: no-access message, no chips, no list". |

All checks green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` (the build
proves the `useSearchParams` Suspense boundary is in place).

## Ming verification after merge
- Look at `/approvals` at 390 px width and on desktop with real requests (chips do not overflow the screen, cards
  stack, long Vietnamese names wrap). Requests can only be created in the UI after SIM-014.3; until then use
  `POST /api/requests` with a user token, since `pnpm seed:dev` seeds no requests.
- The ticket's manual test "request → approve with two rival requests" moves to SIM-014.4.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/copy/requests.ts` | new: `requestsCopy` — `statusLabel` per `RequestStatus`, `filterLabel` ("Status"), `emptyFor` per status (pending: "No pending requests."), `summary(count, hasMore)`, `seatLine(seatCode, roomCode)`, `requestedAt(time)`, `occupiedBy(name)`, `seatEmpty`, `decidedLine(status, by \| null, time)`, `loadMore`, `loadingMore`, `retry`, `noAccess` | D36; `no-literals.test.ts` forbids inline strings | no |
| `src/ui/requests/requests-api.ts` | new: `createRequestsApi(fetcher)` with `list(status, cursor?)` only; copy the `call`/`errorCode`/`fail` shape of `src/ui/audit/audit-api.ts:1-37`; `RequestsResult<T>`, `RequestsApi` types | ticket scope; R1 (uses `@/lib/api/fetch` only) | no |
| `src/ui/requests/requests-api.test.ts` | new | R5 | no (test) |
| `src/ui/requests/requests-state.ts` | new, pure: `parseStatusParam(values: string[]): RequestStatus`, `statusHref(pathname, status)`, `canViewApprovals(tier)`, `statusOptions()` (from `REQUEST_STATUSES` + copy), `appendPage(state, page)` / the hook's state type, `formatRequestTime` (re-export of `formatAuditTime`) | rule 6 (pure logic first) | no |
| `src/ui/requests/requests-state.test.ts` | new | R5 | no (test) |
| `src/ui/requests/useRequests.ts` | new: `useRequests(api, status)` → `{status, items, hasMore, loadingMore, errorCode, reload, loadMore}`; mirror `src/ui/audit/useAudit.ts:7-104` without facets | ticket scope | no |
| `src/ui/requests/ApprovalsView.tsx` | new, pure props view: h1, `FilterChips` in an `overflow-x-auto` wrapper, `aria-live` summary, loading / error+Retry / empty-per-status / forbidden / ready card list / Load more (mirror `src/ui/audit/AuditView.tsx:44-60, 110-135, 185-195`) | AC1, AC3 | no |
| `src/ui/requests/ApprovalsView.test.tsx` | new: static render | AC2 | no (test) |
| `src/ui/requests/ApprovalsPage.tsx` | new client page: tier gate like `src/ui/audit/AuditPage.tsx:15-37`; inner component reads `useSearchParams().getAll("status")`, calls `router.replace(statusHref(...), {scroll:false})`; wrapped in `<Suspense>` like `src/ui/seats/SeatsPage.tsx:250-265` | URL-backed filter; Next 16 build needs Suspense for `useSearchParams` | no |
| `src/ui/index.ts` | add `export { ApprovalsPage } from "./requests/ApprovalsPage";` after line 26 | page entry through the barrel, like Devices | no |
| `src/app/(app)/approvals/page.tsx` | replace the stub with `return <ApprovalsPage />` from `@/ui` | ticket scope | no |

Not touched: `src/ui/copy/shell.ts` (`pages.approvals` stays; `copy.test.ts:28-30` and the title still use it),
`src/ui/copy/api.ts` (all codes already have text), `src/ui/EntityFormDialog.tsx`, anything under `src/server/**`,
`src/app/api/**`, `src/lib/**`.

## Data model / migration
None.

## API contract
None (no endpoint or DTO change; consumes `GET /api/requests` as is).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `requests-state.test.ts` › "parseStatusParam: [] -> pending; ['approved'] -> approved; each of REQUEST_STATUSES kept; ['bogus'] -> pending; ['approved','rejected'] -> pending; [''] -> pending" | filter default and bad/duplicate URL values (pagination/null edge cases, Domain focus) |
| `requests-state.test.ts` › "statusHref: pending -> '/approvals'; rejected -> '/approvals?status=rejected'" | URL kept clean for the default |
| `requests-state.test.ts` › "canViewApprovals: admin, manager true; user, null, undefined false" | AC3 |
| `requests-state.test.ts` › "statusOptions: four options in REQUEST_STATUSES order with copy labels" | chips |
| `requests-state.test.ts` › "appendPage: appends items, takes the new cursor; null cursor -> hasMore false" | Load more |
| `requests-state.test.ts` › "formatRequestTime: UTC 2026-03-05T17:30:00Z -> '06 Mar 2026, 00:30'; invalid string returned as is" | UTC vs UTC+7 (Domain focus) |
| `requests-api.test.ts` › "list: GET /api/requests?status=pending&limit=50; cursor appended and encoded" | URL building |
| `requests-api.test.ts` › "list: valid body -> ok; items not array or nextCursor wrong type -> internal" | shape check |
| `requests-api.test.ts` › "list: 403 {error:{code:'forbidden'}} -> forbidden; non-JSON error -> internal; fetch throws -> unavailable; ApiAccessError signed_out -> unauthenticated" | error mapping |
| `ApprovalsView.test.tsx` › "loading: aria-busy card, no list" | view |
| `ApprovalsView.test.tsx` › "error: role=alert with apiErrorMessage(code) and Retry button" | view |
| `ApprovalsView.test.tsx` › "empty per status: pending -> 'No pending requests.', approved/rejected/cancelled -> their emptyFor text" | view + filter |
| `ApprovalsView.test.tsx` › "forbidden: no-access text; no radiogroup, no list" | AC3 |
| `ApprovalsView.test.tsx` › "ready: one card per item with requester name, seat line, requested time in `<time dateTime>`; active chip aria-checked=true" | AC1 |
| `ApprovalsView.test.tsx` › "pending row: occupant -> occupiedBy(name) warning; null -> seatEmpty" | row content |
| `ApprovalsView.test.tsx` › "decided row: status chip and decidedLine with decider; decidedBy null -> line without name" | null fields (Domain focus) |
| `ApprovalsView.test.tsx` › "hasMore -> Load more button; loadingMore -> disabled with loadingMore label; no button when hasMore false" | paging |
| `ApprovalsView.test.tsx` › "Vietnamese name 'Nguyễn Thị Ánh' rendered unchanged" | diacritics (Domain focus) |
| `ApprovalsView.test.tsx` › "chip bar wrapper has overflow-x-auto" | 390 px layout |

## Approach
1. `src/ui/copy/requests.ts` first, so every component imports strings (D36, `no-literals.test.ts`).
2. `requests-state.ts` (pure) + tests. `parseStatusParam` accepts exactly one value that is in `REQUEST_STATUSES`,
   otherwise `pending` (mirrors the API, which 400s on duplicates, so the page never sends a bad query).
   `canViewApprovals` uses `atLeastTier(tier, "manager")` from `@/lib/tier` (like `canViewAudit`,
   `src/ui/audit/audit-state.ts:14-16`). `formatRequestTime` reuses `formatAuditTime` (fixed Asia/Ho_Chi_Minh zone,
   deterministic in tests and on the server) instead of a relative "2 days ago" helper.
3. `requests-api.ts` + tests: `list(status, cursor?)` sends `status`, `limit=REQUEST_LIMITS.defaultLimit`, optional
   `cursor` via `URLSearchParams`. Never throws.
4. `useRequests.ts`: copy `useAudit` (counter + `mounted` ref drop stale answers; a status change restarts the list
   and invalidates an in-flight Load more). Keep `reload` exported for Retry and for SIM-014.4's refresh.
5. `ApprovalsView.tsx`: pure. Layout `p-4 lg:p-6 flex flex-col gap-4`; h1 `shellCopy.pages.approvals.title`; status
   chips; `aria-live="polite"` summary; one `Card` per request (stacked, `grid gap-3`, `min-w-0 break-words`):
   line 1 requester `displayName` + status `Chip` for non-pending; line 2 `seatLine(seat.code, seat.roomCode)`;
   line 3 for pending rows the occupant warning or "Seat is empty"; line 4 `requestedAt` in `<time dateTime>`, and
   for decided rows `decidedLine`. Keep the API order (newest first). Leave a slot (`actions?: (item) => ReactNode`
   prop, unused here) so SIM-014.4 can add row buttons without restructuring.
6. `ApprovalsPage.tsx`: outer `ApprovalsPage` = `<Suspense fallback=pulse card>`; inside, `useSession()`; if
   `!canViewApprovals(tier)` render the view with `status="forbidden"` and never mount `useRequests` (no request);
   else read `?status=`, `useRequests(api, status)`, and on chip change `router.replace(statusHref(pathname, s),
   {scroll:false})`.
7. Wire `src/ui/index.ts` and `page.tsx`; run all checks.

Rules: R1 — `src/ui/requests/*` imports only `@/lib/requests/types`, `@/lib/api/fetch`, `@/lib/tier` and `src/ui/*`
siblings; the page file imports only `@/ui`; `pnpm check:layers` verifies. R3 — no config. R5 — tests above. R7 —
read-only slice; only GETs, so the `apiFetch` 401/403 re-send is harmless. R2/R6 — no schema or server change.

## Specialist input used
- frontend-developer rec 1 (files) — adopted for slice 1; `requests-flow.ts`, `DecisionDialog.tsx`,
  `RequestRowActions` moved to SIM-014.4.
- frontend-developer rec 2 / ux "Status filter" (URL `?status=`, pure parser, `router.replace`, Suspense) — adopted.
- frontend-developer rec 6 / ux open Q (pagination) — adopted "Load more" with `nextCursor`, like Audit; the API pages
  at 50 and the spec gives no upper bound on requests ("pagination bounds", Domain focus).
- frontend-developer Q3 / ux "Forbidden" — adopted the AuditPage gate: no-access view, no fetch.
- frontend-developer Q4 — pending empty text lives in `requestsCopy.emptyFor`; `shellCopy.pages.approvals.empty` is
  left in place (removing it is a follow-up, not needed).
- frontend-developer Q5 / ux "no reason field" — answered by the spec: REG-02 "Rejecting marks the request rejected",
  no reason; the reject endpoint takes no body. No reason field in SIM-014.4.
- frontend-developer rec 5 (table on large screens) — rejected in favour of the ux stacked cards: fewer lines, works
  at 390 px, one layout to test.
- ux "Row line 4: relative age" — rejected for this slice: absolute time via `formatAuditTime` is deterministic (no
  hydration or test-clock issues); relative age can be a follow-up.
- ux Q6 (decider and time on decided rows) — adopted (`decidedBy`, `decidedAt` are in the DTO; `decidedBy` may be
  null, handled).
- ux Q4 (link to room) — not adopted; not required by the ACs (rule 1). Follow-up candidate.
- ux "rivals hint", "disable Approve when occupied", "outcome mapping", "busyId", ux Q1-Q3, Q5 and frontend recs 3, 4
  — deferred to SIM-014.4, with defaults recorded under `## Split proposal`.

## Assumptions
- Slice split as below; Ming approves it at the plan gate. If Ming prefers one ticket, the SIM-014.4 contents append
  to this plan unchanged (the PR would be ~1300 lines including tests).
- Times show as absolute Asia/Ho_Chi_Minh time (same as Audit), not relative age.
- No room/seat link on the cards in this slice.
- `user`-tier visits get the no-access card (the API returns 403 anyway); the nav already hides the link.
- Hotspot: no open ticket (IN_PROGRESS/REVIEW/DONE) edits these files. SIM-014.3 (BACKLOG) will also extend
  `src/ui/requests/requests-api.ts`, `src/ui/copy/requests.ts` and `src/ui/index.ts`; whichever runs second rebases.
- Follow-ups (not in scope, R4): optional `rivalCount` on `RequestListItemDto` so the rival hint is complete beyond one
  page; remove `shellCopy.pages.approvals.empty` once unused; relative-age display; link from a card to
  `/rooms/<roomCode>?seat=<code>`.

## Blocking questions
None.

## Split proposal
| Slice | Title | Contents | Areas | Depends on |
|---|---|---|---|---|
| **SIM-014.2 (this plan)** | Approvals page: list and status filter | copy, `requests-api.list`, `requests-state`, `useRequests`, `ApprovalsView`, `ApprovalsPage`, page wiring, tests. ~450 source lines + ~350 test lines. | ui, ux | SIM-014.1 |
| SIM-014.4 (new) | Approvals: Approve and Reject dialogs | `requests-api.approve(id)` / `reject(id)` (no body); pure `requests-flow.ts` `settleDecision(action, result)`; `DecisionDialog.tsx` (one `EntityFormDialog` keyed by request id + action, standard primary submit — no shared-component change); row buttons through the `actions` slot, only on pending rows; per-row `busyId` in the page; `aria-live` notice; focus to h1 after a decision; `reload()` after every decision. Ticket AC2, AC3 (action outcomes), manual test "request → approve with two rival requests". ~330 source lines. | ui, ux | SIM-014.2 |

Defaults recorded for SIM-014.4 (from the consults, answered from the scope sources where possible):
- Outcomes: 200 with the intended status → close + reload; 200 with another status → close + reload + notice "This
  request was already {status}." (REG-02 "Approving or rejecting a request that is not pending changes nothing");
  404 `not_found` → close + reload; 409 `seat_taken` / `seat_cannot_seat`, 422 `member_not_assignable` → keep the
  dialog open with `apiErrorMessage(code)` and reload the list in the background; anything else → message, dialog open.
- Approve on a row whose `currentOccupant` is set: **disabled with the occupant hint**, Reject stays enabled. Basis:
  REG-01 "A request for an occupied seat is refused" and the server's `decideApprove` refuses with `seat_taken`
  (`src/server/requests/requests.ts:192-198`); D18 (replace with confirmation) applies to direct assignment, not to
  approval. Ming may prefer "enabled, server explains"; default is disabled.
- Approve dialog copy names the requester, seat and room and, when other loaded pending requests share the seat,
  says "Approving rejects the other pending requests for this seat (names)." — best effort from the loaded list (REG-02
  "rejects every other pending request for that seat"). No device sentence: DEV-06 demotes the primary device of a seat
  whose occupant is removed or replaced (spec lines 286-288), and approval only seats onto an empty seat, so the
  consult's "their current primary becomes secondary" wording would be wrong.
- Reject: no reason field (REG-02; API takes no body). Success note without a rival count (the API does not return it).
