## SIM-067 consult (ArchitectUX): My seat redesign

### Findings
- The mockup shows two sections.
  - "Your assigned seats": a heading with a count chip, then a 2-column grid of cards. Each card has a tinted seat icon tile, the seat code, a room line with a door icon, an "Assigned" green chip at top right, a tinted Group/Project panel in two columns, a divider, then a footer with "View on map →" (primary text, grid icon) on the left and an outlined "Release seat" button on the right.
  - "My requests": one big card. The header has the title, a count chip, the subtitle and a segmented filter at right. Rows are divided by hairlines. Each row has a round status icon (check on green for approved, history on grey for pending), the bold "Seat X" with "in room Y" in regular weight, and a status chip with a dot. Below that come the "Requested …" line and, for decided rows, "Approved by Ming on …". "Cancel request" is an outlined button at the right of pending rows.
- Current code (`src/ui/portal/MySeatView.tsx`, `MySeatTab.tsx`):
  - Seats render as a single-column `<ul>` of plain cards with an inline `dl`. The "My requests" heading is an h2 inside `src/ui/requests/MyRequestsView.tsx`, passed to the seat view via the `requests` ReactNode prop.
  - `MyRequestsView` is also used elsewhere. It has `embedded` and `hideEmpty` props, and its test is `src/ui/requests/MyRequestsView.test.tsx`. `src/ui/shell` copy (`shellCopy.pages.myRequests`) suggests the non-embedded mode is a leftover from the old `/requests` page, which D74 redirects.
  - The data layer already has everything: `MyRequestDto` carries `status`, `createdAt`, `decidedAt` and `decidedBy`. `requestsCopy` already has `statusLabel`, `seatLine`, `requestedAt` and `decidedLine`. `formatRequestTime` is the existing `formatAuditTime` (UTC+7, D35). Seat group/project come from `SeatDto` (`group?.name`, `project?.name`).
  - `src/ui/Chip.tsx` has `FilterChips` (a pill radiogroup with a primary fill) and `Chip` (a rounded-10 label chip). `src/lib/icons.ts` already has `chair`, `meeting_room`, `grid_view`, `history`, `block` and `close`. I did not confirm `check`, `arrow_forward` or the status icons. New glyphs must be added to the `ICON_NAMES` list in `src/lib/icons.ts`, or they will not load.
  - `PortalTabs.tsx` is still the old tab bar. SIM-066 has no plan or implementation yet, so "shared card styles" do not exist to reuse.
  - The `FilterChips` track is a pill with a primary fill. That differs from the mockup, whose track is rectangular with a white selected segment and a primary-coloured label.
- Seats are not paginated, but requests are (cursor, 50 per page, "Load more").

### Recommendations
1. **Build order.** Land SIM-066 first, or at least agree its shared card tokens, and reuse them. If SIM-067 has to go first, keep any new styles local and small. Do not invent a second card style.
2. **Split the components** (all under `src/ui/portal/`, pure view pieces plus tab-level state):
   - `SeatCard` for one card.
   - `MyRequestsPanel` for the card with header, filter and rows. The filter state is local and the filter function is a pure helper in `my-seats.ts` or a new `request-filter.ts`.
   - `MyRequestRow` for the row variants.
   - Keep `MySeatView` as the layout and keep the notice, loading, error and empty handling.
   - Replace the `requests` ReactNode slot, or keep it and render the new panel there. Either way, keep `MySeatTab` as the owner of the cancel, release and mark-seen logic unchanged.
   - Stop using `MyRequestsView` from the tab. Delete it only if nothing else uses it. A grep shows only the tab, so it is dead after this change, along with `hideEmpty` and the h1 branch. Deleting it is in scope for tidy-up, but check whether `shellCopy.pages.myRequests` is still used before removing copy. If in doubt, leave it and list it as a follow-up (R4).
3. **Layout.** Seat grid: `grid gap-4 lg:grid-cols-2` (one column below the lg breakpoint). Use `min-w-0` and `break-words` so long room or seat codes cannot overflow at 390 px. On small screens, stack the request header (title/subtitle above, filter below). Let the filter scroll horizontally or wrap rather than overflow, since 5 segments at 390 px is tight. At 390 px, rows should put "Cancel request" under the text, or keep it at the right if it fits. The button needs a `min-h-11` touch target, as today.
4. **Semantics and a11y** (satisfies the keyboard criterion).
   - Seats: `<ul>` / `<li>` with the heading as the list label.
   - Filter: reuse the `FilterChips` radiogroup semantics, but note that radiogroup needs arrow-key handling, which the existing component does not provide (plain buttons with `role=radio` are all tab stops). Alternatively use `role="group"` with buttons and `aria-pressed`, which is fully keyboard-operable with Tab/Enter/Space and needs no roving logic. I recommend `aria-pressed` buttons in a labelled group; add a `variant` or class prop to `FilterChips` only if SIM-066 or other screens want the same look. Otherwise write a small local `SegmentedFilter`.
   - Status must not rely on colour alone: the chip text plus the icon covers that. Mark the round status icon `aria-hidden`.
   - Announce a filter change with a visually hidden `aria-live="polite"` line ("Showing 2 of 5 requests"). When a filter has no matches, show an in-list empty line ("No pending requests.").
   - Use `<time dateTime>` as today.
5. **Status icon and chip colours.** Use theme tokens only (light and dark). Suggested mapping: approved is check on a success tint, pending is `history` on a neutral tint, rejected is `close` or `block` on an error tint, cancelled is `block` or `close` on a neutral tint. Verify that tokens such as `--success-container` exist before adding any. If none exist, add them to the design tokens in one place, not inline hex values. The "Assigned" chip uses the same success tint. Check contrast in dark mode.
6. **Counts.** The assigned-seats chip is `seats.length`. The requests chip is the total of the loaded `items` with "All" as the default. Because of cursor pagination, the total shown is "loaded so far". Say so in the plan, or display the count with a "+" while `hasMore`. The filter also works only on loaded items. "Load more" stays visible below the list, and it should appear under every filter. Keep `newIds` ("New" chip) rendering on rows, since D74 behaviour depends on it.
7. **Behaviour that must not change.** `markSeen`/`onPage`, `cancelOutcome`, `releaseOutcome`, `seatTabEmpty`, `ConfirmSeatDialog`, and the empty state linking to `/rooms`. When `empty` is true the requests panel is hidden, as it is today. The "View on map" href from `seatResultHref` must remain, and the link is hidden if it returns null. The mockup text is "View on map →", so put the arrow as a decorative icon, not in the label, so the existing copy and tests still match.
8. **Copy** (`src/ui/copy/portal.ts`, D36). Add:
   - `seat.assignedHeading` ("Your assigned seats").
   - `seat.assigned` ("Assigned").
   - `seat.requestsSubtitle` ("Keep track of your seat requests, all in one place.").
   - `seat.filter.{label,all,pending,approved,rejected,cancelled}`.
   - A filtered-empty line and a result-count live-region string.
   - `Room <code>` for the card room line.
   - Reuse `requestsCopy` for `seatLine`, `statusLabel`, `requestedAt`, `decidedLine` and the cancel strings.
   - The current `seat.heading` "My seat" h2 is not in the mockup. The tab already names the page, but keep an `sr-only` h2 so the heading structure is not lost. This is a judgment call, so mention it in the plan.
9. **Tests** (R5, Vitest/render style as in `MySeatView.test.tsx` and `MySeatTab.test.tsx`):
   - Seat card: code, room, chip, group/project and "None", href, Release calls the handler.
   - Request rows: pending (Cancel shown), approved and rejected (decided line with the name; also a null `decidedBy` falls back to no "by"), cancelled (no cancel button and no decision line unless `decidedAt` is set; `decidedLine` renders "Cancelled on …", which is fine). Check what the server stores for `decidedBy` on a user cancel before finalising.
   - Filter: pure-function tests for each status and "All", plus component tests for default "All", narrowing, filtered-empty and count chip.
   - Keep the existing mark-seen and empty-state tests green. Update `MyRequestsView.test.tsx` if the component is deleted.
10. **Manual checks.** 1280 px and 390 px, light and dark, and keyboard-only (Tab to the filter, Enter or Space to pick, Cancel and Release reachable).

### Defaults for the open questions
1. **Rejected filter:** add a fifth "Rejected" segment, in the order All / Pending / Approved / Rejected / Cancelled. This is the honest option and costs one extra segment, because folding Rejected into Cancelled would be misleading. Counts of requests with other filters stay unaffected. If Ming wants exactly the mockup, the fallback is to leave the four segments and let "All" be the only place rejected rows appear. I do not recommend that, because it hides history.
2. **Long lists:** no extra collapse. Show all loaded rows, with the existing "Load more" (cursor, 50 per page) as the paging mechanism. A member's request history is small and the mockup shows a plain list. The filter works on loaded rows only, and I recommend a note in the plan. If client-side filtering over partial data proves confusing, a follow-up could pass `status` to the API, which needs an API change and is out of scope here.

### Risks
- SIM-066 dependency: the card, tab and token styles it introduces may differ from what is assumed here. Plan against its actual PR to avoid a visual mismatch.
- `FilterChips` look versus mockup (pill vs rectangular segmented): decide whether to restyle the shared component, which would affect other screens, or build a local one. I recommend local.
- The count chip and filter only reflect loaded pages (see Recommendation 6).
- New icon names must be added to `ICON_NAMES`, otherwise they render as raw text, because the font is loaded with a name subset.
- Deleting `MyRequestsView` or the old copy keys could break unseen imports, such as the shell copy or the old route redirect. Grep before removal.
- Release flows reload both seats and requests, so ensure the new panel keeps its filter state across `reload()` (the state lives in the panel, which stays mounted).
- The `aria-live` region around `notice` must remain.

### Open questions (not blocking, defaults above)
- Should the h2 "My seat" be dropped visually (default: keep it as `sr-only`)?
- Is the count chip allowed to show a "+" when more pages exist (default: yes, the total of loaded rows with "+" if `hasMore`)?
- Should cancelled rows show a decision line (default: only if the server sets `decidedAt`, using the existing `decidedLine`)?

Files read: /home/user/simap/work/tickets/SIM-067/ticket.md, /home/user/simap/work/tickets/SIM-067/mockup-my-seat.png, /home/user/simap/src/ui/portal/MySeatView.tsx, /home/user/simap/src/ui/portal/MySeatTab.tsx, /home/user/simap/src/ui/portal/PortalTabs.tsx, /home/user/simap/src/ui/requests/MyRequestsView.tsx, /home/user/simap/src/ui/copy/portal.ts, /home/user/simap/src/ui/Chip.tsx, /home/user/simap/src/ui/Icon.tsx, /home/user/simap/src/lib/requests/types.ts, /home/user/simap/src/lib/icons.ts.
