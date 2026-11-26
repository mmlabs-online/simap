## Attempt 1 — 2026-11-26
Verdict: PASS

Scope: plan.md as approved with defaults (ticket Notes, batch 2026-11-26-7). Built on merged SIM-066; the shared blocks are extended additively (impl-log Attempt 1).

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers`: typecheck exit 0; check:layers "977 files, no violations".
- `pnpm test`: exit 0, "Test Files 371 passed | 1 skipped (372)", "Tests 3594 passed | 7 skipped (3601)". This matches impl-log.
- `pnpm build`: exit 0, "Compiled successfully".
- `pnpm test:db`: not run. It is CI-only, and this ticket has no server, API or schema change.

### Acceptance criteria
- [x] Seat cards show the seat code, room, an "Assigned" chip, Group and Project (or "None"), "View on map" to the SEA-05 URL and "Release seat" with confirmation. The header shows the count.
  - Evidence: `SeatCard.test.tsx` (4 cases: h4 code, roomLine, Assigned pill, "None" twice, Vietnamese name, link `/rooms/R1?seat=A1` with aria-hidden icons, outlined Release button disabled when busy).
  - Evidence: `MySeatView.test.tsx › h2 My seat is sr-only; assigned header h3 shows the count pill…`.
  - Confirmation: `MySeatTab.tsx` still passes `onRelease={setReleasing}`, and `ConfirmSeatDialog`/`confirmRelease` do not change in the diff.
- [x] My requests shows every request with a status chip, the requested time and, for decided requests, who decided and when. Pending rows offer Cancel.
  - Evidence: `MyRequestRow.test.tsx` covers the pending, cancelling, approved, rejected and cancelled variants, including decidedBy null and decidedAt null, with UTC+7 "06 Mar 2026, 00:30" in `<time dateTime>`.
  - Evidence: `MyRequestsPanel.test.tsx › All renders one row per item in server order`.
- [x] The filter works client-side, "All" is the default and the count chip shows the total.
  - Evidence: `my-requests.test.ts › filterRequests`.
  - Evidence: `MyRequestsPanel.test.tsx` covers the default All (aria-pressed), the pending filter narrowing 5 → 2 while the pill still shows ">5<", the filtered-empty `emptyFor`, "5+" with hasMore, and the stateful panel starting on All.
- [x] Seat cards use two columns on desktop and one at 390 px, and the filter and buttons work from the keyboard.
  - Evidence: `MySeatView.test.tsx` asserts "grid grid-cols-1 gap-4 lg:grid-cols-2".
  - Evidence: `SegmentedFilter.test.tsx` asserts native `type="button"`, `aria-pressed` and a labelled `role="group"`. Cancel and Release are native `Button`s.
  - The visual check is listed under Ming verification below.
- [x] Opening the tab still marks decisions seen, and the empty state with no seat and no request still links to Rooms.
  - Evidence: the `MySeatTab.tsx` diff changes only the import and the `requests` prop (it drops `embedded`/`notice`). `useMyRequests(…markSeen…)`, `onPage` and `seatTabEmpty` are untouched.
  - Evidence: `MySeatTab.test.tsx › no seat and no request renders one empty state` and the existing `MySeatView` empty-state link test are green.
- [x] Render and unit tests cover the cards, the filter and the four row variants. Evidence: the files above, all green.

### Ming verification after merge (from plan.md; carry these into the PR)
- Check the look at 1280 px and 390 px in light and dark themes:
  - two-column and one-column cards
  - the filter at 390 px: no overflow, and see Nit 1
  - contrast of the new success and warning chip tokens, especially in dark mode
  - the status icon circles
  - the SIM-066 "Live preview" pill is now green
- Keyboard-only pass: reach each filter segment, Cancel request, View on map and Release seat.
- `pnpm dev` round trip:
  - Cancel a pending request: the row turns Cancelled and the filter stays.
  - Release a seat after the confirmation.
  - The My Portal badge clears after a decision once the tab is opened.

### Issues
None.

### Scope
- Every changed file is in plan.md's file table. `src/ui/requests/MyRequestsView.tsx` and its test are deleted as planned, and `rg MyRequestsView src` finds nothing.
- The `ticket.md` change is the state/claim update only.
- No High path is touched. No out-of-plan files.

### Rules (CLAUDE.md)
No violations found.
- R1: all changes are in `src/ui/**`, `src/lib/icons.ts` and `globals.css`, and check:layers is clean.
- D36: new copy is in `src/ui/copy/portal.ts`, and `+` is in the `.ts` helper.
- R3: no config.
- R6, R7 and R2: no server, route or schema change.
- R4: in plan.
- R5: checks are green and there are new tests.

### Blockers from review agents
None.

### Nits (do not block)
1. In `src/ui/SectionCard.tsx:33-49` the header row is `flex items-start justify-between` without `flex-wrap`. At 390 px the 5-segment `SegmentedFilter` (`src/ui/portal/MyRequestsPanel.tsx:59`) therefore shrinks beside the title and wraps its buttons into a narrow block, instead of dropping under the title as plan.md's Ming-verification line expects. It should not overflow, because each flex item's min-content fits. If Ming dislikes the look, the fix is a `flex-wrap` option on `SectionCard`'s header, which is a shared-block change.
2. The mockup has a divider between the My requests header and the first row. `SectionCard` has a `divided` prop that is not used here (`MyRequestsPanel.tsx:53`).
3. `SeatCard.tsx:58-60` renders an empty `<span />` to keep Release right-aligned when there is no link. `ml-auto` on the button would avoid the extra node.

### Follow-ups (out of scope)
- Remove the unused `shellCopy.pages.myRequests` key.
- Add an optional API `status` filter for my requests.
- Auto-load more rows when a filter is empty and `hasMore` is true.

### Blockers from review agents
- None (no review trigger matched).
