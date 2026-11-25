## Findings (what changed since my SIM-037.8 consult)
- `DevicesView` already has one `aria-live="polite"` wrapper with a `notice` ({tone: status|error, text}). `DevicesPage` already holds `notice` state, `headingRef`, `refresh`, and the cancel flow (`cancelOutcome`, `cancelling` ref, `cancellingId` -> `busyId`). So the section-5 "stable status region" already exists. Reuse it for confirm/decline/stale outcomes; do not add a second live region.
- `HandoffDto` (src/lib/devices/types.ts:90) carries `device{id,name,type,inventoryNumber,expiresOn}`, `from`, `note`, and per-caller `canConfirm`/`canDecline`. `HandoffCountDto = {incoming}`. `HandoffListResponse` has `truncated`.
- `copy/api.ts` already maps `handoff_not_pending` and `handoff_stale`. Check that `not_found` has copy.
- `AppShellView` (lines 66-101) hard-wires `shellCopy.badge.newDecisions(count)` for every nav item. `AppShell` passes `badges={{ myRequests: count }}` from `RequestBadgeProvider` / `useRequestBadge`. The latter's lifecycle (seq guard, mounted ref, focus and visibilitychange, failed fetch keeps count) is the template to copy.
- `NoteField`, `TransferDeviceDialog` and `transfer-device.ts` (`cancelOutcome`) exist. Model `confirmOutcome` and `declineOutcome` on `cancelOutcome`, as pure and unit-tested.

## Recommendations
1. **Placement.** Render `IncomingTransfers` as a sibling inside `DevicesView`'s column, after the notice div and before the filter chips. This matches the ticket slot and keeps the notice above it. Pass `incoming` props through `DevicesViewProps`, optional so existing `DevicesView.test.tsx` cases still pass. Keep `DevicesView` pure: `DevicesPage` owns `useIncomingHandoffs(api)` (seq counter, `refresh`).
2. **Section markup.**
   - `<section aria-labelledby>` with h2 "Incoming transfers (N)" and `tabIndex={-1}`, plus the hint "Confirming moves the device into your inventory. It is not placed on a seat."
   - A `<ul>` of `Card`s: name bold; `typeLine`; "From <name>"; the note in `whitespace-pre-line`, clamped (e.g. `line-clamp-3`).
   - Confirm (primary) and Decline (tonal), stacked on mobile, row at md+. Neither has a confirm dialog.
   - Aria labels include the inventory number and sender, as in section 3 of my earlier consult.
   - Render each button only if `canConfirm` / `canDecline`, else disable it. The server flag decides, not the client.
   - If `truncated`, show a short line "Showing the first N".
3. **Busy and double clicks.** Use a `useRef` guard plus `busyId` in state, as the cancel flow does. Disable only that item's two buttons. Share one in-flight guard across confirm, decline and cancel so two actions cannot interleave their refresh and focus.
4. **Outcomes.** Take the confirm notice text from the response device (or the item). Add the filter hint only when `filter` is `placed` or `assigned`; the "unplaced/inventory" filters show it, and `all` shows it. Use `status` tone for confirm, decline and stale ("no longer available, list refreshed", the same text as the cancel stale path). Use `error` tone for network errors, with the item staying so the user can retry. Every outcome except a network error then does `Promise.all([refreshIncoming, refreshDevices])` and sets the badge from the incoming list length or from `handoffCount()`. The count call is authoritative; the length is only an optimistic fallback.
5. **Focus.** Compute the target before the refresh: the next item's id, else the previous item's, else the section heading, else the page heading. After the refresh, focus by `data-` or ref lookup of that item's Confirm (the DOM node is replaced, so look it up after the await). Do not focus the next item's Confirm if it was the only one left: the section is gone, so use `headingRef`. Put the pure "which item next" function in a testable helper.
6. **Badge.** Add `HandoffBadgeProvider`, `useHandoffBadge(pathname)` and `useSetHandoffBadge()` as a near-copy of the requests badge with `api.count()` reading `.incoming`. Do not merge them into one generic provider in this ticket (R4). Wire `badges={{ myRequests, devices }}` in `AppShell`.
   - `AppShellView`: replace the hard-wired text with `shellCopy.badge.byNav[item.id]?.(count) ?? shellCopy.badge.newDecisions(count)`. Keep the sr-only text on the true count, not the capped "9+". Add the `devices` strings "1 incoming transfer" / "N incoming transfers". The `myRequests` tests (~144-170) must stay green, and add a `devices` case.
   - The badge only renders when the nav item is visible to the tier, so no extra gating is needed. The count API is for members; check it returns 0 rather than 403 for a read-only role, or the nav fetch will fail silently (fine, but confirm).
7. **Cross-tab or action badge updates.** `DevicesPage` calls the setter after each action. Seq ordering already protects against stale fetches.
8. **a11y details.**
   - h2 inside `<main>` after the h1, with no skipped levels.
   - Chip and button text must not rely on colour.
   - Cards need no `role`. The `<ul>` is `list-none`, so confirm Tailwind does not drop the list semantics (add `role="list"` if the reset removes it in Safari).
   - Section text must be at least 4.5:1 contrast.
   - The mobile bottom nav badge must not clip in `overflow-x-auto`; the existing badge position works because of the `relative` icon wrapper.

## Risks
- Notice region reuse: a confirm notice and an unrelated cancel notice share one slot, so clear it at the start of each action (`setNotice(null)`), as the code does today.
- Focus race: focusing before refresh lands on a replaced node.
- Incoming list and devices list refresh independently, so a brief inconsistency is possible. Fire both together and focus after both resolve.
- Badge staleness until navigation, focus or visibility change (D24). Document it in the plan.
- Test fixtures: every new prop on `DevicesViewProps` should be optional so `DevicesView.test.tsx` fixtures stay valid.
- R7: only 409/422 for domain refusals. Confirm `/confirm` returns `not_found` (404) and handle it as stale. 401/403 stay in `apiFetch`.
- `AppShellView` change touches the shared shell; keep `badges` type and 0/undefined behaviour.

## Open questions (defaults)
1. Should Decline ask for a reason or note? Default: no (API takes none).
2. After Confirm, offer a "Place it" shortcut? Default: no.
3. Does the notice persist or time out? Default: persists until the next action.
4. Does the section show a loading skeleton? Default: no; show nothing until the first load, and a Retry error inside the section on failure (the section appears only when it has items or an error).
5. Show the sender's own pending transfers (outgoing) in this section? Default: no (out of scope; they appear on the row).

Files read: work/tickets/SIM-037.9/ticket.md, work/tickets/SIM-037.8/consult-ux-architect.md, src/ui/devices/{DevicesPage,DevicesView}.tsx, src/ui/requests/useRequestBadge.tsx, src/ui/AppShellView.tsx (62-106), src/ui/AppShell.tsx (grep), src/lib/devices/types.ts (84-125), src/ui/copy (grep).
