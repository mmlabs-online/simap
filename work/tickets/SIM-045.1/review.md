## Attempt 1 — 2026-11-26
Verdict: PASS

Reviewed commit b7d3125 ("SIM-045.1: implement"); checks run at HEAD 734a837 (its only change after b7d3125 is
`ticket.md`, so `src/` is identical).

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "check-layers: 846 files, no violations"
- `pnpm test` — exit 0, "Test Files 322 passed | 1 skipped (323); Tests 3234 passed | 7 skipped (3241)"
- `pnpm build` — exit 0
- `pnpm test:db` — not run (no DB, migration or `src/server/**` change)

These match the impl-log summary.

### Acceptance criteria
- [x] Default tab is My seat; tabs are My seat, My devices, Profile (`?tab=`) — evidence: `portal-state.ts:8`
  `PORTAL_TABS = ["seat","devices","profile"]`; `portal-state.test.ts › parsePortalTab` (`[]`, unknown and repeats give
  `seat`), `› portalTabHref` (`seat` is bare `/portal`, `devices`/`profile` carry `?tab=`); `PortalTabs.test.tsx` (3
  tabs, in order); `PortalPage.tsx:27-29` three-way panel. `devicesPageRedirect` still targets `?tab=devices`.
- [x] Lists every seat with room and tags; "View on map" opens `/rooms/<code>?seat=<seat>` — evidence:
  `my-seats.test.ts › composeSeats` (0/1/2 seats, sorted room then code, tags carried); `MySeatView.test.tsx › row
  shows room, seat code, group and project, link from seatResultHref` (`href="/rooms/R1?seat=A1"`), `› hides the link
  when the room code has no href`.
- [x] Pending requests can be cancelled; release asks for confirmation and refreshes seats and requests — evidence:
  `MyRequestsView.test.tsx › embedded` (Cancel only on the pending row); `MySeatTab.tsx` `confirmRelease` goes through
  `ConfirmSeatDialog`, maps with `actionOutcome("release", …)` and runs `Promise.all([seats.refresh(),
  requests.reload()])` on `reload`; `my-seats.test.ts › releaseView` (dialog copy, ok reloads, `not_allowed` shows
  `releaseChanged`). Cancel uses `cancelOutcome` then reloads requests; one write at a time (`acting` ref).
  `useMyRequests` is called without `onPage`, so no mark-seen (SIM-045 Question 6).
- [x] With no seat and no request, an empty state links to Rooms — evidence: `my-seats.ts:68` `seatTabEmpty`
  (true only for no seat + ready + 0 requests), `my-seats.test.ts › seatTabEmpty`; `MySeatView.tsx:115-122` card with
  `<Link href="/rooms">`, `MySeatView.test.tsx › empty state has a link to /rooms`. See the judgement below on the
  second "no requests" text.
- [x] A seat that disappears drops on reload; an error on `/api/members/<id>` shows an error state — evidence:
  `my-seats.test.ts › composeSeats › drops a not_found seat; any other failure is an error`, `› loadMySeats` (404 on
  members gives error, no id gives error, seat 404 dropped, id taken from `/api/me` and URL-encoded);
  `MySeatView.test.tsx › error state shows message and Retry`.
- [x] Unit tests for seat-list composition, empty-state decision and tab defaults — evidence: the tests above exist and
  `pnpm test` is green.

Ming verification after merge: none (plan says none).

#### AC4 judgement (implementer's follow-up)
With no seat and no request the tab shows the seat empty card ("You do not have a seat yet." + "Browse rooms" link to
`/rooms`) and, below it under the "My requests" h2, the embedded list's own empty card
(`MyRequestsView.tsx:83-87`, "You have no seat requests yet. Open a room and choose an empty seat to request it.").
This does **not** violate AC4 / POR-02: the criterion asks for an empty state that links to Rooms, and that state is
shown exactly in the right condition (`seatTabEmpty`) with the link. The second card is redundant copy, not a wrong or
missing state; it does not contradict the first and both send the user to Rooms. Recorded as a nit and follow-up, not a
blocker.

### Issues
None.

### Scope
All 13 changed source files are in the plan's file list; `impl-log.md` is the work file. No High path touched (no
migrations, `src/server/**`, `src/proxy.*`, config). `flow.ts` / `readMeResult` untouched as planned (`/api/me` parsed
locally in `my-seats.ts:13`).

### Rules (CLAUDE.md)
No violations found. R1: all new files under `src/ui/**`, import only ui/lib (`check:layers` clean). R6: member id only
from `/api/me` (`my-seats.ts:50`), `/api/members/[id]` GET is `tier: "user"` and server-scoped. R7: no route handler
changes. D36: new copy in `src/ui/copy/portal.ts`. R5: new logic has tests.

### Blockers from review agents
None.

### Nits (do not block)
- 💭 Double empty text when no seat and no request (see AC4 judgement). Simple fix if wanted: let `MyRequestsView`
  take an `emptyText?: string | null` (or `hideEmpty`) and have `MySeatTab` pass it when the tab empty state shows.
- 💭 With requests but no seat, the seat section shows only the "My seat" heading and nothing under it; a one-line
  "You do not have a seat yet." (without the card) would read better.
- 💭 The button reads "Release"; POR-02 names the action "Release seat" (the dialog title already says
  "Release seat A1?").
- 💭 `loadMySeats` maps every non-ok `/api/me` or `/api/members/<id>` to `internal`, so the error text loses the real
  code (e.g. `unavailable`); AuthGate already covers auth codes, so impact is only the message.

### Follow-ups (out of scope)
- Merge the two empty texts on My seat into one (nit 1), if Ming wants it.
