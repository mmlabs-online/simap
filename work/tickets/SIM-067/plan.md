Status: READY

# Plan — SIM-067: Redesign My Portal → My seat layout (seat cards and My requests list)

**Builds on SIM-066.** This plan reuses the shared blocks that SIM-066 introduces (`PageHeader`, `SectionCard`, `Pill`,
the `TabBar`-styled portal tabs, and the `check` icon). Implement it on top of merged SIM-066, or rebase onto it before
review. See Assumption 1.

## Scope summary
- `docs/spec-v1.md` POR-02 (lines 565-574):
  - "Lists every seat the member occupies (one person may have several, invariant 2): seat code, room, group/project
    tags, and 'View on map', which opens `/rooms/<code>` with that seat selected (SEA-05 URL)."
  - "Lists the member's seat requests with status (REG-02): pending ones can be cancelled (D24). This is the only
    place a member sees their own requests (D74)."
  - "Opening the My seat tab (including landing on My Portal, whose default tab is My seat) marks the member's request
    decisions as seen, using the existing mark-seen API…"
  - "'Release seat' releases an occupied seat without approval after a confirmation (REG-03; DEV-06 runs)."
  - "With no seat and no request, an empty state links to Rooms to request a seat (REG-01)."
- REG-02 (line 541): "The user's own requests and their status are listed in My Portal → My seat (POR-02); there is
  no separate 'My requests' nav entry or page (D74)."
- REG-03 (line 546): "A user releases a seat they occupy without approval; the occupant is cleared and DEV-06 runs."
- D24: "Requesters can cancel pending requests; decisions show in-app… no email."
- D35: "Times stored in UTC and shown in UTC+7 (Asia/Ho_Chi_Minh)…"
- D36: "all user-facing text lives in copy files". D52: clean UI kit for the portal. D74: "own requests live only in My
  Portal → My seat… opening My seat marks decisions seen… no new API."
- Ticket: an "Your assigned seats" section with a count chip and seat cards, two columns on desktop and one at 390 px.
  A "My requests" card with a count chip, the subtitle, a segmented status filter, and rows with a status icon, the
  seat line, a status chip, the requested time, the decision line and "Cancel request" on pending rows. Out of scope:
  any API or schema change, the Approvals page, and the My devices and Profile tabs.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Assigned seats show as cards with the seat code, room, an "Assigned" chip, Group and Project (or "None"), "View on map" to the SEA-05 URL and "Release seat" with confirmation; the section header shows the count. | `SeatCard.test.tsx` (all cases). `MySeatView.test.tsx › assigned header shows the count pill; one SeatCard per seat`. `ConfirmSeatDialog` wiring in `MySeatTab.tsx` is unchanged in the diff: `onRelease={setReleasing}` and `confirmRelease` stay as they are. |
| 2 | My requests shows every request of the caller with a status chip, the requested time and, when decided, who decided and when; pending rows offer "Cancel request". | `MyRequestRow.test.tsx` (the pending, approved, rejected and cancelled variants). `MyRequestsPanel.test.tsx › All renders one row per item in server order`. |
| 3 | The status filter narrows the list client-side; "All" is the default; the count chip shows the total. | `my-requests.test.ts › filterRequests`. `MyRequestsPanel.test.tsx › default filter is All (aria-pressed)`, `› pending filter narrows`, `› count pill shows the total, not the filtered number`, `› filtered empty line`, `› MyRequestsPanel starts on All`. |
| 4 | Two-column seat cards on desktop, one column at 390 px; the filter and buttons are keyboard-operable. | `MySeatView.test.tsx › seat list is grid-cols-1 lg:grid-cols-2`. `SegmentedFilter.test.tsx` (native `<button type="button">` elements with `aria-pressed` in a labelled `role="group"`, so each is reachable with Tab and activated with Enter or Space). Cancel and Release are native buttons. The visual check is in `## Ming verification after merge`. |
| 5 | Opening the tab still marks decisions seen; the empty state with no seat and no request still links to Rooms. | The `MySeatTab.tsx` diff touches only the import (line 9) and the `requests` prop (lines 106-122): `onPage`, `useMyRequests(…, markSeen ? … : undefined)` and `seatTabEmpty` are unchanged. `MySeatTab.test.tsx › no seat and no request renders one empty state` (updated to the new panel) and `MySeatView.test.tsx › empty state has a link to /rooms` both stay green. |
| 6 | Render/unit tests cover the cards, the filter and the row variants (pending, approved, rejected, cancelled). | The tests under `## Tests to write`. `pnpm test` is green. |
| — | Checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test` and `pnpm build` all pass. |

## Ming verification after merge
- The look at 1280 px and 390 px in the light and dark themes:
  - the two-column cards and the one-column stack
  - the filter wrapping under the title at 390 px without overflow
  - the contrast of the new success and warning chip tokens, especially in dark mode
  - the status icon circles
- Keyboard-only pass: Tab to each filter segment and press Enter or Space; reach Cancel request, View on map and
  Release seat.
- A real round trip with `pnpm dev`:
  - Cancel a pending request: the row turns Cancelled and the filter stays on its current choice.
  - Release a seat after the confirmation.
  - Open the tab after a Manager decides a request: the My Portal badge clears.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/portal/my-requests.ts` (new) | Pure helpers: `MyRequestFilter`, `REQUEST_FILTERS`, `filterRequests`, `requestStatusLook`, `countLabel` (below). | Pure logic first (planner rule 6). | No |
| `src/ui/portal/my-requests.test.ts` (new) | Unit tests. | R5. | No |
| `src/ui/SegmentedFilter.tsx` (new) | Generic, copy-free segmented filter: `role="group"` with `aria-pressed` buttons, styled like the mockup. | The mockup filter, keyboard-operable. `FilterChips` stays as it is for other screens. | No |
| `src/ui/SegmentedFilter.test.tsx` (new) | Render tests. | R5. | No |
| `src/ui/PageHeader.tsx` (from SIM-066) | Add an optional `titleAdornment?: ReactNode`, rendered inline after the title (same idea as `SectionCard.titleAdornment`). | The count pill next to "Your assigned seats". | No |
| `src/ui/Chip.tsx` (`Pill` from SIM-066) | Add the tones `warning` and `danger` and an optional `dot?: boolean` (a decorative `size-1.5 rounded-full bg-current` span before the label). `success` now uses the new success tokens. `Chip` and `FilterChips` are unchanged. | The status chips with a dot (Approved green, Pending amber, Rejected red, Cancelled neutral) and the "Assigned" chip. | No |
| `src/ui/layout-blocks.test.tsx` (from SIM-066) | Add cases for the new `Pill` tones and `dot`, and for `PageHeader.titleAdornment`. | R5. | No |
| `src/ui/index.ts` | Export `SegmentedFilter`. | Kit barrel. | No |
| `src/app/globals.css` | Add `--success-container`, `--on-success-container`, `--warning-container` and `--on-warning-container` in `:root` (after line 46) and in `[data-theme="dark"]` (after line 116). Add the matching `--color-*` entries in `@theme inline` (after line 170). | No green or amber container token exists today (only `--status-online` and `--status-warn`, which is blue). Tokens only, no inline hex. | No |
| `src/lib/icons.ts` | Add `arrow_forward`, in alphabetical order. (`check` comes from SIM-066; `history`, `close`, `block`, `chair`, `meeting_room` and `grid_view` already exist.) | The "View on map →" arrow. `icons.test.ts` enforces sorting. | No |
| `src/ui/portal/SeatCard.tsx` (new) | One seat card (layout below). | AC1. | No |
| `src/ui/portal/SeatCard.test.tsx` (new) | Render tests. | R5. | No |
| `src/ui/portal/MyRequestRow.tsx` (new) | One request row (the variants below). | AC2. | No |
| `src/ui/portal/MyRequestRow.test.tsx` (new) | Render tests for the four variants. | R5, AC6. | No |
| `src/ui/portal/MyRequestsPanel.tsx` (new) | `MyRequestsPanel` (holds `useState<MyRequestFilter>("all")`) and the pure `MyRequestsPanelView` (a `SectionCard` with a header, the filter, rows, states and Load more). | AC2 and AC3. Replaces `MyRequestsView`. | No |
| `src/ui/portal/MyRequestsPanel.test.tsx` (new) | Render tests. | R5. | No |
| `src/ui/portal/MySeatView.tsx` | Lines 38 and 70-117: the h2 becomes `sr-only`; add the "Your assigned seats" `PageHeader` (level 3) with the count pill; the seat `<ul>` becomes a grid of `SeatCard`s. The notice, loading, error, `noSeat`, empty state and `requests` slot are unchanged. | AC1, AC4, AC5. | No |
| `src/ui/portal/MySeatView.test.tsx` | Update the first test for the card markup; add the header, count and grid cases. | R5. | No |
| `src/ui/portal/MySeatTab.tsx` | Line 9: import `MyRequestsPanel` instead of `MyRequestsView`. Lines 106-122: render `<MyRequestsPanel hideEmpty={empty} …>` with the same data props, without `embedded` and `notice`. Nothing else changes. | Swap in the new panel; keep mark-seen, release and cancel as they are. | No |
| `src/ui/portal/MySeatTab.test.tsx` | Use `MyRequestsPanel` (lines 5 and 26-40); the assertions are unchanged. | R5, AC5. | No |
| `src/ui/requests/MyRequestsView.tsx` | **Delete.** Its only consumers are `MySeatTab.tsx` and `MySeatTab.test.tsx` (grep). The non-embedded `/requests` page mode is dead since D74. | Avoid two request-list components. | No |
| `src/ui/requests/MyRequestsView.test.tsx` | **Delete.** Its cases move to `MyRequestRow.test.tsx` and `MyRequestsPanel.test.tsx` (mapping below). | As above. | No |
| `src/ui/copy/portal.ts` | Add the `seat.*` keys below; remove `seat.room` (it is unused after the change, and typecheck confirms that). | D36. | No |

No file matches a High path.

## Data model / migration
None.

## API contract
None. The existing calls are reused unchanged:
- `GET /api/me/seats` (through `useMySeats`)
- `GET /api/requests/mine` paged (through `useMyRequests`)
- the mark-seen call, the request cancel and the seat release (through `requestsApi` and `seatsApi` in `MySeatTab`)

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/portal/my-requests.test.ts › REQUEST_FILTERS is all, pending, approved, rejected, cancelled and covers every REQUEST_STATUSES entry` | Q1 default, and a new status cannot be missed. |
| `src/ui/portal/my-requests.test.ts › filterRequests: "all" returns every item in the original order; each status keeps only that status; [] → []; no match → []` | AC3. |
| `src/ui/portal/my-requests.test.ts › requestStatusLook maps approved → check/success, pending → history/warning, rejected → close/danger, cancelled → block/neutral` | Row variants. |
| `src/ui/portal/my-requests.test.ts › countLabel(5,false) = "5"; countLabel(50,true) = "50+"; countLabel(0,false) = "0"` | Count with pagination (Assumption 4). |
| `src/ui/SegmentedFilter.test.tsx › role=group with aria-label; one type=button per option; aria-pressed true only on the selected value; selected segment has the selected classes` | AC4 keyboard semantics. |
| `src/ui/layout-blocks.test.tsx › Pill warning/danger tones map to their token classes; dot renders an aria-hidden span; success uses success-container` | Shared block extension. |
| `src/ui/layout-blocks.test.tsx › PageHeader renders titleAdornment after the title only when given` | Shared block extension. |
| `src/ui/portal/SeatCard.test.tsx › shows the seat code (h4), roomLine, the Assigned pill, Group and Project names` | AC1. |
| `src/ui/portal/SeatCard.test.tsx › group and project null → "None" twice; Vietnamese names ("Nhóm Đổi Mới") are kept verbatim` | AC1, domain focus (diacritics, null fields). |
| `src/ui/portal/SeatCard.test.tsx › View on map links to /rooms/R1?seat=A1, with the grid_view and arrow_forward icons aria-hidden and the link text exactly portalCopy.seat.viewOnMap; no link when seatResultHref returns null` | AC1 (SEA-05). |
| `src/ui/portal/SeatCard.test.tsx › Release is an outlined button with min-h-11; disabled when busy` | AC1, AC4. |
| `src/ui/portal/MyRequestRow.test.tsx › pending: history icon, Pending warning pill with a dot, Requested 06 Mar 2026, 00:30 (UTC+7) in <time dateTime>, no decision line, Cancel request button` | AC2, D35. |
| `src/ui/portal/MyRequestRow.test.tsx › pending with cancellingId set: every Cancel disabled; the busy row shows "Cancelling..."` | Moved from `MyRequestsView.test.tsx`. |
| `src/ui/portal/MyRequestRow.test.tsx › approved: check icon, success pill, decidedLine("approved","Nguyễn Thị Hương",…) in <time>, no button` | AC2. |
| `src/ui/portal/MyRequestRow.test.tsx › rejected: close icon, danger pill, "Rejected by … on …", no button` | AC2. |
| `src/ui/portal/MyRequestRow.test.tsx › cancelled: block icon, neutral pill, "Cancelled by Ann on …" (the server stores the canceller); decidedBy null → "Cancelled on …"; decidedAt null → no decision line` | AC2, Assumption 5. |
| `src/ui/portal/MyRequestRow.test.tsx › seat line shows "Seat A1" bold and "in room R1"; the New pill only when isNewMark` | Mockup, D74 "New". |
| `src/ui/portal/MyRequestsPanel.test.tsx › header: h3 My requests, count pill, subtitle, SegmentedFilter labelled portalCopy.seat.filterLabel` | AC2, AC3. |
| `src/ui/portal/MyRequestsPanel.test.tsx › default filter is All (aria-pressed); All renders one row per item in server order` | AC3. |
| `src/ui/portal/MyRequestsPanel.test.tsx › filter="pending" narrows to the pending rows; the count pill still shows the total; live region "Showing 2 of 5 requests"` | AC3. |
| `src/ui/portal/MyRequestsPanel.test.tsx › filtered empty shows requestsCopy.emptyFor[filter]; Load more still shows when hasMore under any filter` | AC3, Assumption 3. |
| `src/ui/portal/MyRequestsPanel.test.tsx › count pill shows "50+" when hasMore` | Assumption 4. |
| `src/ui/portal/MyRequestsPanel.test.tsx › loading aria-busy; error role=alert + Try again; ready-empty shows requestsCopy.mine.empty; hideEmpty and ready-empty → ""` | Moved from `MyRequestsView.test.tsx`. |
| `src/ui/portal/MyRequestsPanel.test.tsx › Load more only when hasMore; loadingMore disables it with "Loading..."` | Moved from `MyRequestsView.test.tsx`. |
| `src/ui/portal/MyRequestsPanel.test.tsx › MyRequestsPanel (stateful) renders with All pressed` | AC3 default. |
| `src/ui/portal/MySeatView.test.tsx › h2 My seat is sr-only; assigned header h3 shows the count pill; one SeatCard per seat; list is grid-cols-1 lg:grid-cols-2` | AC1, AC4. |
| `src/ui/portal/MySeatView.test.tsx` (existing cases, adjusted only where the markup changed) | Link, hidden link, empty state, no-seat line, error and loading are unchanged. |
| `src/ui/portal/MySeatTab.test.tsx › no seat and no request renders one empty state` (now with `MyRequestsPanel`) | AC5. |

Static rendering (`renderToStaticMarkup`, node environment, no DOM library in the repo) cannot click. Filter
interaction is therefore covered by the pure `filterRequests` function and by rendering `MyRequestsPanelView` with
each `filter` value. The `onChange` and `onRelease` wiring is plain prop passing and is checked by typecheck and
review.

## Approach
1. **Tokens and icons.**
   - `globals.css`: add the four tokens in light and dark mode, using these starting values (Ming checks the look):
     - light: `--success-container #e7f5ec`, `--on-success-container #166534`, `--warning-container #fdf4dc`,
       `--on-warning-container #854d0e`
     - dark: `#12301d` / `#a7e3b9` and `#3a2c0c` / `#f5d58a`
   - Map them in `@theme inline` as `--color-success-container` and so on.
   - Add `arrow_forward` to `ICON_NAMES`.
2. **Kit extensions** (additive; SIM-066 call sites unchanged).
   - `Pill` tones:
     - `success` → `bg-success-container text-on-success-container`
     - `warning` → `bg-warning-container text-on-warning-container`
     - `danger` → `bg-error-container text-on-error-container`
   - `dot` renders a decorative dot.
   - `PageHeader.titleAdornment` renders inline after the heading (inside a `flex items-center gap-2` wrapper).
   - `SegmentedFilter<T extends string>`:
     ```ts
     { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel: string }
     ```
     - Markup: `div role="group" aria-label` with `inline-flex flex-wrap gap-0.5 rounded-xl bg-surface-high p-1`.
     - Each option is a `button type="button" aria-pressed` with `min-h-11 rounded-lg px-3 text-sm font-semibold`.
     - Selected: `bg-surface text-primary shadow-sm`. Others: `text-on-surface-variant hover:text-on-surface`.
     - Use the `focus-visible` ring the existing `Button` uses.
3. **Pure helpers (`my-requests.ts`).**
   - `export type MyRequestFilter = "all" | RequestStatus;`
   - `REQUEST_FILTERS = ["all", "pending", "approved", "rejected", "cancelled"] as const satisfies readonly MyRequestFilter[]`
   - `filterRequests(items, f)` filters by status, keeping the original order.
   - `requestStatusLook(status): { icon: IconName; tone: "success" | "warning" | "danger" | "neutral" }`
   - `countLabel(n, hasMore)`
   - Imports only types from `@/lib`.
4. **`SeatCard({ seat, busy, onRelease })`.**
   - `<Card as="article" className="flex min-w-0 flex-col break-words">`.
   - Top block `p-4 sm:p-5`:
     - a row with a 44 px icon tile (`rounded-xl bg-accent-orange-soft text-accent-orange`, `chair`, aria-hidden)
     - a `min-w-0 flex-1` column: `h4` with the seat code, and a `p` with the `meeting_room` icon and
       `t.roomLine(seat.roomCode)`
     - `<Pill tone="success" label={t.assigned} />` at the right
   - Then `<dl className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-surface-container p-4">` with Group and Project
     (`dt` text-on-surface-variant, `dd` font-semibold, `?? t.noTag`).
   - Footer `border-t border-outline-variant px-4 py-3 sm:px-5 flex flex-wrap items-center justify-between gap-3`:
     - the `Link` (only when `seatResultHref(seat) !== null`, as today) with `grid_view`, `t.viewOnMap` and
       `arrow_forward`, both icons aria-hidden, `font-semibold text-primary hover:underline`
     - `<Button variant="outlined" size="sm" className="min-h-11" disabled={busy}>{t.release}</Button>`
5. **`MyRequestRow({ item, isNew, cancellingId, onCancel })`.**
   - `<li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:px-5">`.
   - A 36 px round icon (`requestStatusLook`, tone background, aria-hidden).
   - A `min-w-0 flex-1 break-words` block containing:
     - a line with `<strong>{t.requestSeat(code)}</strong> {t.requestRoom(roomCode)}`,
       `<Pill dot tone label={requestsCopy.statusLabel[status]} />` and the New pill (`tone="accent"`, when `isNew`)
     - `<time dateTime={createdAt}>{requestsCopy.requestedAt(formatRequestTime(createdAt))}</time>`
     - the decision line, kept exactly as today: `status !== "pending" && decidedAt !== null` →
       `requestsCopy.decidedLine(status, decidedBy?.displayName ?? null, formatRequestTime(decidedAt))` in `<time>`
   - On pending rows, the Cancel button (`variant="outlined" size="sm" className="min-h-11 self-start"`,
     `disabled={cancellingId !== null}`, label `cancelling`/`cancel` as today) sits at the right on `sm` and up, and
     under the text at 390 px.
6. **`MyRequestsPanel`.**
   - `MyRequestsPanelView` props: today's `MyRequestsViewProps` minus `notice` and `embedded`, plus
     `filter: MyRequestFilter` and `onFilter`.
   - It returns `null` when `hideEmpty && state === "ready" && items.length === 0`.
   - Otherwise it renders a `SectionCard` with:
     - `headingId="my-requests-heading"`, `title={t.requestsHeading}`, `subtitle={t.requestsSubtitle}`
     - `titleAdornment={<Pill tone="neutral" label={countLabel(items.length, hasMore)} />}`
     - `aside={<SegmentedFilter …>}`, with options from `REQUEST_FILTERS` (labels `t.filterAll` and
       `requestsCopy.statusLabel[s]`)
     - `footer` = Load more (only when `state === "ready" && hasMore`)
   - Body: zero padding for the list. It shows:
     - loading: skeleton
     - error: alert and retry
     - ready with no items: `requestsCopy.mine.empty`
     - ready with items: `<ul aria-label={requestsCopy.mine.listLabel} className="divide-y divide-outline-variant">`
       of the filtered rows, or the `emptyFor[filter]` line when the filter leaves no row
     - an `sr-only aria-live="polite"` `p` with `t.filterResult(shown, items.length)`
   - If SIM-066's `SectionCard` body padding cannot be zeroed, put the list in a `-mx-*` wrapper and record it in the
     impl-log.
   - `MyRequestsPanel` = `useState<MyRequestFilter>("all")` around the view. The filter is not reset by `reload()`,
     because the panel stays mounted.
7. **`MySeatView`.**
   - The h2 gets `sr-only`.
   - When `status === "ready" && !empty`, render a `<section aria-labelledby="assigned-seats-heading">` containing:
     - `PageHeader level={3} id="assigned-seats-heading" title={t.assignedHeading}` with
       `titleAdornment={<Pill tone="neutral" label={String(seats.length)} />}`
     - the `<ul aria-labelledby="assigned-seats-heading" className="grid grid-cols-1 gap-4 lg:grid-cols-2">` of
       `<li className="min-w-0"><SeatCard …/></li>`, or the existing `noSeat` line when there are no seats
   - The vertical gap between sections becomes `gap-6`.
   - Everything else stays as it is.
8. **`MySeatTab`.** Swap the component only (step listed in the files table). `onPage`, `markSeen`, `cancel`,
   `confirmRelease`, `busy` and `ConfirmSeatDialog` are untouched (AC5, D74).
9. **Copy (`portalCopy.seat`).**
   - Add:
     - `assignedHeading: "Your assigned seats"`
     - `assigned: "Assigned"`
     - `roomLine: (code) => \`Room ${code}\``
     - `requestsSubtitle: "Keep track of your seat requests, all in one place."`
     - `filterLabel: "Filter requests by status"`
     - `filterAll: "All"`
     - `filterResult: (shown, total) => \`Showing ${shown} of ${total} requests\``
     - `requestSeat: (code) => \`Seat ${code}\``
     - `requestRoom: (room) => \`in room ${room}\``
   - Remove `seat.room`.
   - `shellCopy.pages.myRequests` is left in place (out of scope; see follow-ups).
10. **Delete** `MyRequestsView.tsx` and its test. Run `rg -n "MyRequestsView" src` to confirm nothing is left.
11. **Rules.**
    - R1: everything is in `src/ui/**`, `src/lib/icons.ts` and `globals.css`, with no server imports.
      `pnpm check:layers` confirms this.
    - D36: no literals in TSX (`no-literals.test.ts`); the `+` in `countLabel` is in a `.ts` helper, not JSX text.
    - R6 and R7 are untouched (no route change).
    - R4: My devices, Profile and Approvals are not touched.
    - R5: the tests above.
    - Run `pnpm format`, then the four checks.

Size estimate: about 380 product lines and 380 test lines (including the moved tests), offset by about 300 deleted
lines. One cycle.

## Specialist input used
- ux-architect:
  - Adopted:
    - The component split (`SeatCard`, `MyRequestsPanel`, `MyRequestRow`, `MySeatView` as the layout), with
      `MySeatTab` keeping all behaviour.
    - Deleting the dead `MyRequestsView` after a grep.
    - An `aria-pressed` group instead of a radiogroup without arrow keys.
    - A local segmented look (`FilterChips` unchanged).
    - A `aria-live` "Showing X of Y" line and a filtered-empty line.
    - Tokens only, added once in `globals.css`; status shown by text and icon, never colour alone.
    - The count shows "+" while `hasMore`; Load more is visible under every filter.
    - "New" pills kept.
    - The arrow as a decorative icon, so `viewOnMap` copy and tests still match.
    - An `sr-only` h2.
    - Both open-question defaults.
  - Changed: the segmented filter lives in the kit (`src/ui/SegmentedFilter.tsx`) rather than in the portal folder,
    because SIM-069's device filters are likely to want the same look. It is copy-free and small.
- frontend-developer:
  - Adopted:
    - Filters driven from `REQUEST_STATUSES` with Rejected before Cancelled.
    - Reusing `requestsCopy` (`statusLabel`, `requestedAt`, `decidedLine`, `emptyFor`, `mine.*`).
    - `formatRequestTime` (already UTC+7, tested as "06 Mar 2026, 00:30").
    - `min-w-0 break-words`; the count = total of loaded items.
    - `onPage` still fed the full item list.
    - The decision line kept for cancelled rows.
  - Changed: the grid breakpoint is `lg:` (not `md:`) to match SIM-066's Profile grid.
  - Rejected: auto-running Load more when a filter is empty. It is an extra request flow; Load more stays visible
    instead.

## Assumptions
These are the defaults for Ming's approval round; each can be overturned at PLAN or PR.
1. **Builds on SIM-066's shared blocks.** `PageHeader`, `SectionCard`, `Pill` (with the `accent`, `neutral` and
   `success` tones), the `check` icon and the restyled tabs come from SIM-066 and are reused as its plan specifies.
   This ticket extends them only additively:
   - `Pill` gets the `warning` and `danger` tones and `dot`.
   - `PageHeader` gets `titleAdornment`.

   `SeatCard` uses the base `Card` rather than `SectionCard`, because the card has an icon tile, a room sub-line with
   an icon and a body panel that `SectionCard`'s header contract does not model. Its footer copies `SectionCard`'s
   footer classes so the two look the same. If SIM-066 merges with different block names or props, the implementer
   follows what merged and records it in the impl-log.
2. **(Ticket Q1) Rejected gets its own filter.** The segments are All / Pending / Approved / Rejected / Cancelled,
   driven from `REQUEST_STATUSES`. Folding Rejected into Cancelled would misreport history.
3. **(Ticket Q2) No collapse and no extra pagination.** The panel shows all loaded rows and keeps today's "Load more"
   (cursor, 50 per page). The filter works on loaded rows only; Load more stays visible under every filter while more
   pages exist. Server-side status filtering for "my requests" would need an API change and is a follow-up if wanted.
4. **The count chip is the number of loaded requests**, shown as "50+" while more pages exist. It is not the filtered
   count, as AC3 says.
5. **Cancelled rows keep their decision line** (today's behaviour): the server stores the canceller as `decidedBy`
   (`src/server/requests/requests.ts:298`), so a self-cancel reads "Cancelled by <own name> on <time>". A cancel done
   by member deactivation reads "Cancelled by <admin> on <time>".
6. **The "My seat" h2 stays as `sr-only`.** It is not in the mockup, but it keeps the heading outline under the page
   h1. The section headings are h3 and the seat codes are h4.
7. **The "View on map" link keeps `text-primary`** (near-black in light mode, light in dark mode), as links do across
   the app. The mockup's orange text would fail AA contrast on white at 14 px. The orange appears only in the
   decorative seat icon tile (`accent-orange-soft` / `accent-orange`).
8. **New colour tokens** (`success-container`, `warning-container` and their `on-` pairs) are added to `globals.css`.
   `Pill`'s `success` tone switches to them. This also turns SIM-066's "Live preview" pill green, which matches the
   mockup's intent.
9. **The status icon mapping:** Approved shows `check`, Pending shows `history`, Rejected shows `close` and Cancelled
   shows `block`.
10. **Hotspots:** SIM-066 and SIM-069 (same batch, both PLANNING) also edit `src/ui/copy/portal.ts`,
    `src/lib/icons.ts`, `src/ui/index.ts` and `src/ui/Chip.tsx`, and this ticket edits SIM-066's new
    `src/ui/PageHeader.tsx` and `src/ui/layout-blocks.test.tsx`. Expect a rebase after SIM-066 merges, and SIM-069
    should reuse the `Pill` tones and `SegmentedFilter` added here.
11. **Follow-ups (not in this ticket):**
    - Remove the unused `shellCopy.pages.myRequests` key.
    - An optional API `status` filter for my requests.
    - Auto-loading more rows when a filter is empty and `hasMore` is true.

## Blocking questions
None.

## Split proposal
None.
