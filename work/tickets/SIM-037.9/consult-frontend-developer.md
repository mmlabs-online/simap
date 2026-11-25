SIM-037.9 frontend consult (read-only). Builds on SIM-037.8 consult §4 and §6 and the code now on main. Only the deltas are listed.

## Findings
- API client: `createDevicesApi` in `src/ui/devices/devices-api.ts` already has a private `call` helper (never throws, returns `{ok, code}`) and `oneHandoff`. Add `incomingHandoffs()` (GET `/api/handoffs?box=incoming`, returns `HandoffListResponse`), `handoffCount()` (GET `/api/handoffs/count`, returns `HandoffCountDto` `{incoming}`), `confirmHandoff(id)` and `declineHandoff(id)` (POST, `oneHandoff`). `HandoffDto` (sender, device name, type, inventory number, note, `canConfirm`, `canDecline`) and the list and count types already exist in `src/lib/devices/types.ts`. I did not read the `HandoffDto` field names between lines 90 and 112, so check them before you build the item view.
- Page state: `DevicesPage` owns a single `notice` (status or error) shown in an `aria-live` region in `DevicesView`. It also has the `cancelling` ref plus `cancellingId` busy pattern, and `cancelOutcome(result, device)` in `transfer-device.ts`. Mirror these for confirm and decline instead of inventing a new pattern. `refresh()` is the no-skeleton refetch. Focus goes to `headingRef`.
- `DevicesView` is already crowded. The incoming section can be a new prop group: `incoming?: {status, items, errorCode, busyId, onConfirm, onDecline, onRetry, headingRef}`, or a sibling component rendered inside `DevicesView` between the notice and the filters.
- Badge:
  - `useRequestBadge` and `RequestBadgeProvider` are in `src/ui/requests/useRequestBadge.tsx`. The provider holds `{count, set, seq}`, with a `seq` guard against stale fetches.
  - The hook is hard-wired to `createRequestsApi(...).mine`.
  - `AppShell.tsx` passes `badges={{myRequests: count}}`.
  - `AppShellView.tsx` line 100 hard-wires `shellCopy.badge.newDecisions(count)`. `badgeText` is imported from `requests/request-badge`.

## Recommendations
1. **Badge: copy the pattern, do not parametrize it.**
   - Add `src/ui/devices/useHandoffBadge.tsx` with `HandoffBadgeProvider`, `useHandoffBadge(pathname)` and `useSetHandoffBadge()`.
   - It has the same body as the request version. Use `createDevicesApi(apiFetch).handoffCount()` and read `.incoming`.
   - Keep the same triggers: mount, pathname, focus, visibilitychange, and a `seq` guard that is also bumped by `set`. No polling (D24). A failed fetch keeps the old count.
   - Nest the provider in `AppShell`: `<RequestBadgeProvider><HandoffBadgeProvider>...`.
   - Pass `badges={{myRequests, devices}}`.
   - If you want less duplication, extract a small `makeBadge(fetchCount)` factory in `src/ui/badges/`. The default is to duplicate, because that is less risky and the duplicate is about 60 lines.
2. **`AppShellView` sr-only text.**
   - Use a per-nav lookup in `shellCopy.badge`, e.g. `byNav: { myRequests: newDecisions, devices: incomingTransfers }`.
   - `incomingTransfers(n)` returns "1 incoming transfer" or "N incoming transfers". Keep `newDecisions` and its text unchanged.
   - Always use the real count in the sr-only text, not the capped "9+".
   - The visible numeral stays `aria-hidden`.
   - Test it in `AppShellView.test.tsx`: `devices: 3` gives the incoming text, `devices: 0` renders nothing, and the `myRequests` text is unchanged.
3. **`IncomingTransfers.tsx` (new, pure, props only).**
   - Markup: a `<section aria-labelledby>` with an h2 that has `tabIndex={-1}`, and a `ul`. Each `li` shows the device name, type and `(inv)`, "From <sender>" and the note.
   - Render nothing when the list is empty and there is no error.
   - Confirm is a primary Button and Decline is `variant="tonal"`. The aria-labels are "Confirm receipt of <name> (<inv>)" and "Decline transfer of ...".
   - While one item is busy, disable the other items' buttons too. This matches the single `cancelling` ref guard, which is cheap and avoids concurrent outcomes.
   - Error state: an inline `role="alert"` message plus a Retry button. If the first load fails, keep the section visible only for the error, so a recipient does not silently miss a transfer.
   - Hook `useIncomingHandoffs(api)` with a request counter that drops stale answers, plus `refresh`. It lives next to `useDevices`.
4. **Outcomes as a pure function in `transfer-device.ts` (or `incoming-outcome.ts`).**
   - `confirmOutcome(result, handoff, filter)` and `declineOutcome(result, handoff)` return `{notice, refreshAll}`.
   - Success on confirm: "<name> (<inv>) is now in your inventory, not placed". Add the filter hint ("Show All or Unplaced to see it") only when `filter` hides an owned, unplaced device. Check which filter values hide it in `PlacementFilter`.
   - Stale codes `handoff_not_pending`, `handoff_stale` and `not_found` give a status notice ("no longer available") and refresh everything.
   - Auth codes, `unavailable` and `internal` give an error notice with no refresh, as `NOTHING_CHANGED` does now. Keep that list shared rather than copied: export it or reuse `cancelOutcome`'s approach.
   - Every outcome that refreshes calls, together: incoming list `refresh`, devices `refresh`, and `handoffCount()` then `useSetHandoffBadge()(n)`. `Promise.all` is fine.
   - If the count fetch fails, fall back to `items.length` after the incoming refresh. Do not leave the badge stale.
5. **Focus.**
   - After the incoming list refreshes, if the removed item had a next sibling, focus its Confirm button. Otherwise focus the section h2 if items remain. Otherwise focus the page h1.
   - Do this by computing the target id from the pre-refresh list (the next item's id) and focusing after the refresh resolves, via a ref map or `data-handoff-id` and `querySelector`. A plain `headingRef` focus will not satisfy the AC.
   - The notice region (`aria-live="polite"`) already announces the outcome.
6. **Copy (D36).**
   - Add an `incoming` block to `src/ui/copy/devices.ts`: heading, from, confirm, decline, aria functions, confirmed (with the filter hint), declined, gone.
   - Add `badge.incomingTransfers` to `src/ui/copy/shell.ts`.
   - Add `handoff_not_pending` and `handoff_stale` messages to `src/ui/copy/api.ts` if they are missing (check).

## Tests
- `devices-api.test.ts`: the four new paths, methods and encoding.
- Outcomes unit tests, including the filter hint and the list of stale codes.
- A badge count source test, with no hook rendering. Extract a pure `fetchIncomingCount(api)` or test the `api.handoffCount` mapping.
- `IncomingTransfers.test.tsx` (static markup): items, sender, note, aria-labels, busy disables, empty renders nothing, error with Retry.
- `AppShellView.test.tsx` badge cases (see rec 2).
- A `DevicesView.test.tsx` case for the section placement.

## Risks
- Double activation of Confirm or Decline: guard with a ref plus `busyId`, as cancel does. A second 409 means "already handled" and refreshes.
- Race: the badge `seq` must be bumped by `set`, otherwise an older count fetch can overwrite the post-action count. The copied provider already does this.
- The badge is stale until navigation, focus or visibility change (D24). This is acceptable; state it in the plan.
- Focus loss if the list refresh resolves after the dialog or notice update. Compute the focus target before the mutation.
- The confirm notice must not promise the device is visible under the current filter. This is the reason for the filter hint.
- Confirm moves the device into the recipient's inventory, so the devices list must `refresh` and not `reload`, to avoid a skeleton flash.
- 401/403 on confirm or decline: `apiFetch` re-sends once (R7). The server is responsible for ordering. The UI only maps codes.

## Open questions (defaults)
1. Should the incoming section show for Manager+ who can decline another person's incoming transfer? Default: no. `box=incoming` is the caller's only, so show exactly what the API returns.
2. Should the badge count come from `/api/handoffs/count` or from the list `items.length`? Default: `/count`, which is cheaper and independent of the page.
3. Should a failed count fetch on the Devices page fall back to the list length? Default: yes (rec 4).
4. Should the `useHandoffBadge` code be duplicated or generalized? Default: duplicate (rec 1), and open a debt issue only if a third badge appears.

Files read: `work/tickets/SIM-037.9/ticket.md`, `work/tickets/SIM-037.8/consult-frontend-developer.md`, `src/ui/devices/{DevicesView,DevicesPage,devices-api,transfer-device}.ts(x)`, `src/ui/AppShell.tsx`, `src/ui/AppShellView.tsx` (badge lines only), `src/ui/requests/useRequestBadge.tsx`, `src/lib/devices/types.ts` (handoff types).
