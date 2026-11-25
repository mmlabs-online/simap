## Findings
- DevicesPage wires 6 dialogs through ~10 useState/useRef plus `actions` (useMemo of DeviceRowHandlers). It is entangled with list state: `filter`, `refreshAll` (3 handoff lists, badge, overdue), `notice`, and `headingRef`. `takeBackDone(device, filter)` and the `filterHint` depend on the list filter. Extracting a hook here would touch the list-specific refresh code, so it is risky.
- The dialogs take `device | null` (Assign and Place take `open` plus `device`/`mode`), `devicesApi`, `seatsApi`, and `roomsApi` for Place. They also take `onClose`, `onStale` and `onDone`. Only the `onDone` bodies differ: Transfer, Return and Extend call `devicesCopy.{transfer,giveBack,extend}.sent(name, inv)`. TakeBack calls `takeBackDone`. Place and Assign (mode edit) show no notice.
- `rowActions` gates on the server flags (`canTransfer`, `canReturn`, `canAssign`, `canEditHolding`, `canTakeBack`, `pending.canCancel`, `mine && overdue && !pending`). `placeModes(d)` gates Place. Edit and Delete appear only when `onEdit`/`onDelete` are passed, so leaving them out gives the "Edit/Delete stay on the list" rule for free. The flags already satisfy AC1; do not re-gate by tier.
- `DeviceDetailView` is pure and has no notice, actions, or `aria-live` region. The h1 is rendered only when status is `ready` or `notFound`. `useDeviceDetail` exposes `retryDetail` and `retryHistory`, but both dispatch `load`. `detailReducer` `load` resets to INITIAL (status `loading`, device null), which unmounts the h1, the sections and the actions. Using them for a post-action refresh would flash the skeleton, drop the dialog's host content and lose focus. That is the main trap.
- DevicesPage's `aria-live="polite"` div is always mounted and the notice (`role=status` or `role=alert`) is rendered inside it. This is the pattern to copy.
- The mount-once focus effect in DeviceDetailPage (`focused` ref) must not be reused for post-action focus.

## Recommendations
1. Do not extract `useDeviceDialogs` from DevicesPage in this ticket (R4, and the list tests are at risk). Duplicate the wiring in a new component, then record the extraction as a follow-up. Put the dialog host in its own file (for example `DeviceDetailActions.tsx`) rather than growing DeviceDetailPage. It owns the dialog state (transferring, returning, extending, takingBack, placing, holding, cancellingId, notice) and takes `device`, `api`, `onChanged(): Promise<void>` and `headingRef`. It renders `<DeviceRowActions device handlers busyId>` plus the 6 dialogs. This is about 100 lines and leaves DevicesPage untouched. If the duplication is judged too heavy, a later ticket can share only the pure outcome helpers.
2. Handlers to pass: `onTransfer`, `onReturn`, `onExtend`, `onTakeBack`, `onAssign`, `onEditHolding`, `onPlace` and `onCancelHandoff`. Omit `onEdit` and `onDelete`. Cancel can reuse `cancelOutcome(await api.cancelHandoff(pending.id), device, pending.kind)` with the same `acting` ref and `busyId` pattern. Do not pass `bannerHandlers`; that is the list banner only.
3. Refresh without the skeleton: add a quiet `refresh()` to `useDeviceDetail` that does not dispatch `load`.
   - It bumps `detailCounter` and `historyCounter` and fetches `api.get` and `api.history(deviceId)` in parallel.
   - It dispatches `loaded` and keeps the old device or history visible until the new data arrives.
   - It returns a Promise so focus can follow.
   - `detailReducer`'s `loaded` event already replaces the state in place when the id matches `latest`. The history `loaded` event resets items to page 1, which is the intended first-page reset.
   - On a failed refresh, `loaded` with an error would blank the device. Handle that case. Options: ignore the failure and keep the old data, or show an error notice. Decide this in the plan.
   - A 404 after an action (for example take-back deleted nothing, but a device could be removed) yields `notFound`, which is acceptable.
   - Use `onStale` to call the same refresh; it fires when the dialog finds the data out of date.
4. Notices: add `notice` to the DeviceDetailView props (`{tone, text} | null`) or render it from the actions host. Always mount the `<div aria-live="polite">` and render a `<p role="status">` or `<p role="alert">` inside it, as DevicesView does. Place it above the actions, or under the h1. Clear it when an action opens. The notice text reuses `devicesCopy.transfer.sent`, `devicesCopy.giveBack.sent`, `devicesCopy.extend.sent` and `takeBackDone(device, "all")`. Passing `"all"` avoids the list-only filter hint. Cancel uses `cancelOutcome().notice`. Any new strings go in `copy/devices.ts` under `detail` (D36).
5. Focus: after `await refresh()`, call `headingRef.current?.focus()` (the h1 has `tabIndex=-1`). The h1 stays mounted because refresh does not reset to `loading`. Do the same for Assign mode `assign`, Place and the other dialogs, as the list does. For Assign mode `edit`, follow the list (no focus move). The page-level focus-once effect stays as is.
6. Put the actions block in DeviceDetailView as an optional `actions?: React.ReactNode` prop, rendered after the h1 only when `status` is `ready`. The pure view stays testable.

## Risks
- Using `retryDetail` for the refresh remounts everything: the h1 and the dialog host are lost, and focus is lost.
- A refresh and a `loadMore` race on `historyCounter`. A refresh in flight can discard a loadMore answer. That is acceptable and matches the "first page" requirement.
- Duplicated onDone and notice logic can drift from the list. Mitigate by reusing the outcome helpers and copy; add a follow-up to unify later.
- Dialogs close with `setX(null)` before the refresh resolves, so a double click on a row action during the refresh is possible. Disable via `busyId`, or keep an `acting` ref as the list does.
- Starting transfer, return and extension depends on the handoff start bug fix (PR #102). Verify that it is merged on main before the plan relies on it.
- Tests: mock `api` plus the dialogs where possible. DevicesPage tests are not touched under the duplicate option, which is the main argument for it.

## Open questions
- On a failed post-action refresh: keep the old data and show an error notice, or show the error state?
- Should Assign (mode `edit`) and Place show a notice (no copy exists today), or stay silent as on the list?
- Should the detail page also refresh the nav handoff badge (`useSetHandoffBadge` and `api.handoffCount`) after Transfer, Return or Extend? The list does it via `refreshAll`. If yes, add `api.handoffCount` plus `setBadge` to the detail refresh; the badge goes stale otherwise.

Files: d:\project\simap-game-ui\src\ui\devices\DevicesPage.tsx, DeviceDetailPage.tsx, DeviceDetailView.tsx, useDeviceDetail.ts, device-detail-state.ts, device-actions.ts, DeviceRowActions.tsx, transfer-device.ts, return-device.ts.
