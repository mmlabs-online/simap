Status: READY

# Plan — SIM-045.1: My Portal: My seat tab

Fast lane (size S, gate none, no consult). Design source: `work/tickets/SIM-045/plan.md` → "Split proposal", slice B,
and `work/tickets/SIM-045/consult-ux-architect.md` / `consult-frontend-developer.md` (adopted below). No file here
matches a High path in `.claude/loop.config.md` (no migrations, no `src/server/**`, no `src/proxy.*`, no
`**/config.*`). The ticket fits in one cycle (about 350 changed lines including tests).

## Scope summary
- D70 (`docs/spec-v1.md` l.546-548): "One page, "My Portal", for every tier, with three horizontal tabs: **My seat**,
  **My devices**, **Profile**. It shows only the caller's own data and reuses the existing APIs and components (seat
  detail, map view, requests, device actions, display name)."
- POR-01 (l.551-555): "the default tab is My seat" and "Every tab reads only the caller's own member (token `sub` +
  `org`, R6)".
- SIM-045 plan Question 6 default: "the "My requests" nav entry stays; the My seat tab lists requests with Cancel but
  does **not** mark decisions as seen (the badge stays owned by `/requests`)."
- SIM-045 plan Question 7 default: compose existing endpoints (`/api/me` → `/api/members/<own id>` →
  `/api/seats/<id>`); no new API.
- Ticket scope: tab list My seat, My devices, Profile (default `seat`); `useMySeats`; "View on map" via
  `seatResultHref`; release through `ConfirmSeatDialog`; my requests with cancel; empty state links to `/rooms`.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The default tab is My seat; tabs are My seat, My devices, Profile (URL `?tab=`). | `portal-state.test.ts › parsePortalTab` (`[]`, unknown and repeats give `seat`; `devices`, `profile` accepted), `› portalTabHref` (`seat` is bare `/portal`, others `?tab=`), `› devicesPageRedirect` still `/portal?tab=devices`; `PortalTabs.test.tsx` renders three tabs in order. Local run: `/portal` opens My seat, `/portal?tab=devices` opens My devices. |
| 2 | My seat lists every seat the member occupies with room and tags, and "View on map" opens `/rooms/<code>?seat=<seat>`. | `my-seats.test.ts › composeSeats` (2 seats sorted by room then code, tags carried); `MySeatView.test.tsx › row shows room, seat code, group and project, link href from seatResultHref`; link hidden when `seatResultHref` is null. |
| 3 | Pending requests can be cancelled; release asks for confirmation and refreshes seats and requests. | `MyRequestsView.test.tsx › embedded` (h2, no page padding, Cancel only on pending; unchanged page mode); `my-seats.test.ts › releaseView` (dialog title/body from `seatsCopy.actions`, outcome from `actionOutcome("release", …)` gives reload true); local run: Release opens the dialog, Cancel dialog does nothing, confirm reloads seats and requests. |
| 4 | With no seat and no request, an empty state links to Rooms. | `my-seats.test.ts › seatTabEmpty` (no seat + ready empty requests = true; any seat, any request, or requests still loading/error = false); `MySeatView.test.tsx › empty state has a link to /rooms`. |
| 5 | A seat that disappears (released elsewhere) drops from the list on reload; an error on `/api/members/<id>` shows an error state. | `my-seats.test.ts › composeSeats` (a `not_found` seat result is dropped; any other seat failure is an error), `› loadMySeats` with a fake fetcher (404 on `/api/members/<id>` gives `error`; `/api/me` without `member.id` gives `error`; id taken only from `/api/me`); `MySeatView.test.tsx › error state shows message and Retry`. |
| 6 | Unit tests for the seat-list composition, empty-state decision and tab defaults. | The tests named in rows 1, 2, 4, 5 exist and `pnpm test` is green. |

## Ming verification after merge
None (all checks run locally; a real Identity sign-in is not needed beyond the existing dev token).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/portal/portal-state.ts` (l.8-10) | `PORTAL_TABS = ["seat","devices","profile"]`; `DEFAULT_PORTAL_TAB` stays `PORTAL_TABS[0]` (now `seat`). Nothing else changes: `devicesPageRedirect` already targets `?tab=devices` explicitly. | POR-01 default tab | no |
| `src/ui/portal/portal-state.test.ts` (l.52-68) | Update `parsePortalTab` / `portalTabHref` expectations to the new default | tab defaults | no |
| `src/ui/portal/PortalPage.tsx` (l.26) | Three-way panel: `seat` → `<MySeatTab />`, `devices` → `<MyDevicesTab />`, `profile` → `<ProfileTab />` | new tab | no |
| `src/ui/portal/PortalTabs.test.tsx` (l.7) | Type `active` as `PortalTab`; assert three tabs incl. `portal-tab-seat` | tabs | no |
| `src/ui/portal/my-seats.ts` (new, pure, no React) | `readOwnMemberId(res)` (parse `/api/me` body `member.id`), `composeSeats(refs, results)` (drop `not_found`, sort by `roomCode` then `code`, error on other failures), `seatTabEmpty(seats, requestsStatus, requestCount)`, `releaseView(seat)` (title/body/submit from `seatsCopy.actions`), `loadMySeats(apiFetch, seatsApi)` | pure logic first (rule 6); keeps `/api/me` parsing local so `readMeResult` / `src/lib/identity/flow.ts` and the gates stay untouched | no |
| `src/ui/portal/my-seats.test.ts` (new) | Tests listed below | AC 2, 4, 5, 6 | no |
| `src/ui/portal/useMySeats.ts` (new) | Hook modelled on `useMyDevices.ts` (stale counter, mounted ref): `status` loading/ready/error, `errorCode`, `seats`, `reload`, `refresh` (no skeleton, keeps rows on failure) | AC 2, 5 | no |
| `src/ui/portal/MySeatView.tsx` (new, pure) | Seat list (code, room, group, project, "View on map" link, Release button min-h-11), empty state with link to `/rooms`, error state with Retry, loading skeleton; slot for the requests section | AC 2, 4, 5 | no |
| `src/ui/portal/MySeatView.test.tsx` (new) | `renderToStaticMarkup` tests (same style as `MyDevicesView.test.tsx`) | AC 2, 4, 5 | no |
| `src/ui/portal/MySeatTab.tsx` (new) | Container: `useApiFetch`, `createSeatsApi`, `createRequestsApi`, `useMySeats`, `useMyRequests` (no `onPage`, so no `markSeen`), release dialog state with `ConfirmSeatDialog`, cancel via `cancelOutcome`, notice; empty-state decision | AC 3, 4 | no |
| `src/ui/requests/MyRequestsView.tsx` (l.10-41) | New optional prop `embedded?: boolean`: renders `<h2>` (copy `portalCopy.seat.requestsHeading`) and drops the `p-4 lg:p-6` wrapper padding and the `<h1>`; default output unchanged | reuse the existing list (D70) | no |
| `src/ui/requests/MyRequestsView.test.tsx` | Add an `embedded` case; existing cases untouched | AC 3 | no |
| `src/ui/copy/portal.ts` | `tabs.seat: "My seat"`; `seat` block: heading, `viewOnMap`, `release`, `room`/`group`/`project`/`noTag` labels, `requestsHeading`, `empty`, `emptyAction` ("Browse rooms"), `loadFailed`, `retry`, `released` status line | D36 copy in `src/ui/copy/<feature>.ts`; reuse `seatsCopy` / `requestsCopy` strings where they exist | no |

Anything outside this list needs a recorded reason in `impl-log.md`. `src/ui/requests/useMyRequests.ts`,
`MyRequestsPage.tsx`, `requests-state.ts`, `seat-actions.ts`, `seats-api.ts` are reused as is.

## Data model / migration
None.

## API contract
None. Existing endpoints only: `GET /api/me` (returns `member.id`, `src/server/members/members.ts` l.28-33),
`GET /api/members/<id>` (`tier: "user"`, `seats: {id, code}[]`, `src/app/api/members/[id]/route.ts` l.13-24),
`GET /api/seats/<id>`, `POST /api/seats/<id>/release`, `GET /api/requests/mine`, request cancel.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `portal-state.test.ts › parsePortalTab` (updated) | default `seat`; `seat`, `devices`, `profile` accepted; unknown, empty, repeated values give `seat` |
| `portal-state.test.ts › portalTabHref` (updated) | `seat` is bare `/portal`; `devices` and `profile` carry `?tab=` |
| `PortalTabs.test.tsx` (updated) | three tabs in order, ids from `tabId`, `aria-selected` on the active one |
| `my-seats.test.ts › readOwnMemberId` | `member.id` read from a 200 body; missing member, non-string id, non-200 or bad JSON give null (R6: the only id source) |
| `my-seats.test.ts › composeSeats` | 0, 1, 2 seats; sorted by room then code; `not_found` result drops the row; any other failure gives an error code; group and project carried |
| `my-seats.test.ts › loadMySeats` | fake fetcher: calls `/api/me` then `/api/members/<id>` then one `/api/seats/<id>` per ref; 404 on members gives error; no id gives error; a released seat (seat 404) is dropped |
| `my-seats.test.ts › seatTabEmpty` | no seat + ready + 0 requests true; one seat false; one request false; requests loading or error false |
| `my-seats.test.ts › releaseView` | title `Release seat <code>?`, body and submit label match `seatsCopy.actions`; `actionOutcome("release", ok)` reloads, `not_allowed` shows `releaseChanged` |
| `MySeatView.test.tsx` | list row content and `/rooms/<code>?seat=<seat>` link; link absent when `seatResultHref` is null; Release button present; empty state with `/rooms` link; error state with Retry; loading `aria-busy` |
| `MyRequestsView.test.tsx › embedded` | `<h2>` not `<h1>`, no page padding, Cancel only on pending rows; default mode unchanged |

## Approach
1. `portal-state.ts`: add `seat` first in `PORTAL_TABS`; update its tests and `PortalTabs.test.tsx`.
2. `my-seats.ts` + tests (pure): `loadMySeats` takes `apiFetch` for `/api/me` and `/api/members/<id>` (parsed locally,
   `encodeURIComponent` on the id) and `seatsApi.get` for each ref in parallel (cap is 500 refs per
   `MEMBER_LIMITS.detailRefs`; run in batches of 20 to avoid a request burst). The id comes only from `/api/me` (R6),
   never from the URL. A non-ok `/api/members/<id>` is an error state; a `not_found` seat is dropped.
3. `useMySeats.ts`: copy the stale-answer counter pattern of `useMyDevices.ts`.
4. `MySeatView.tsx` (pure) and copy in `portal.ts`; the link uses `seatResultHref({ roomCode, code })`
   (`src/ui/search/search-state.ts` l.160-163), hidden when null.
5. `MyRequestsView.tsx`: add `embedded` prop (default off, so `/requests` is unchanged).
6. `MySeatTab.tsx`: Release opens `ConfirmSeatDialog` (title/body/submit from `releaseView`); on confirm call
   `seatsApi.release(seat.id)`, map the result with `actionOutcome("release", …)` (`seat-actions.ts` l.229, l.311-315),
   show its message, then `Promise.all([seats.refresh(), requests.reload()])` when `outcome.reload`. Cancel a request
   with `createRequestsApi(...).cancel` and `cancelOutcome` (`requests-state.ts` l.74), then reload requests. One
   write at a time (ref guard, as in `MyDevicesTab.tsx` l.53). No `markSeen`, no `useSetRequestBadge` (Question 6).
   R7: auth codes come only from the wrapper; the UI never treats a late 401/403 as success.
7. `PortalPage.tsx`: wire the third panel. Run `pnpm format`, `pnpm typecheck && pnpm check:layers`, `pnpm test`,
   `pnpm build`.

Rules: R1 (all new files are under `src/ui/**`, import only `ui`/`lib`, `@/` alias for lib), R3 none needed, R4 stay in
this file list, R5 tests listed above, R6 id only from `/api/me`.

## Specialist input used
- `work/tickets/SIM-045/consult-ux-architect.md` (structure: thin page, container, pure views, tab logic in
  `portal-state.ts`; WAI-ARIA tabs already built in slice A): adopted, reused unchanged.
- `work/tickets/SIM-045/consult-frontend-developer.md` (compose existing endpoints instead of a new
  `/api/me/seats`; `MyRequestsView` embedded prop): adopted. The `/api/me/seats` endpoint stays out of scope per the
  ticket.

## Assumptions
- `/api/me` already returns `member.id` (`MeMemberDto`), but `readMeResult` (`src/lib/identity/flow.ts` l.104-131)
  drops it. Plan: parse it locally in `my-seats.ts` and leave `flow.ts` untouched. If the implementer prefers adding
  `id` to `MeResult`, that touches the gate flow and its tests and must be recorded as a deviation.
- Default tab changes from My devices to My seat, as slice A's plan promised. Users arriving from the `/devices`
  redirect keep landing on My devices because the redirect URL carries `?tab=devices`.
- "My requests" nav entry stays; My seat does not mark decisions seen, so the nav badge keeps clearing only on
  `/requests` (SIM-045 Question 6 default).
- The requests list shows all statuses (history), so "no request" in the empty state means no request at all.
- Seats are loaded in full (no paging; at most 500 refs, in practice a few). A failing seat fetch other than 404 turns
  the tab into the error state rather than showing a partial list.
- After release the released seat disappears from the list because the reload no longer returns it under
  `/api/members/<id>`.
- Hotspots: no other ticket is `IN_PROGRESS` or `REVIEW`. SIM-046 and SIM-047 (PLANNING) will also edit
  `PortalPage.tsx` / `portal-state.ts` later, so expect a rebase there.

## Blocking questions
None.

## Split proposal
None.
