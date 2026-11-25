## Findings

Read: ticket, SIM-037.6 plan, `DeviceDetailPage/View`, `useDeviceDetail`, `device-detail-state`, `DeviceRowActions`, `device-actions.ts`, `DevicesPage`, `DevicesView`, and the `Pending` and `Section` pieces of the detail view.

- **`DeviceRowActions` already fits.**
  - It is a `flex flex-wrap` row of `sm` tonal buttons.
  - `rowActions(device, handlers, busyId)` gates on the server flags (`canTransfer`, `canReturn`, `canAssign`, `canEditHolding`, `canTakeBack`, `pendingHandoff.canCancel`, `mine && overdue`, `placeModes`). Passing no `onEdit`/`onDelete` gives the "Edit/Delete stay on the list" scope with no extra code.
  - Buttons carry `aria-label` with the inventory number. That is useful on the detail page too, since there is only one device.
  - Order today: cancel-handoff, extend, assign, edit-holding, place/move/return-to-inventory, transfer, give back, (edit), take-back (danger), (delete).
- **The list page owns all the wiring in `DevicesPage`.**
  - Six dialogs: Transfer, Return, Extend, TakeBack, Place and Assign. Each has its own `useState` target.
  - `onDone` follows one pattern: close, `setNotice({tone:"status", text: devicesCopy.X.sent(name, inv)})`, refresh, then focus the `h1`.
  - `takeBackDone(device, filter)` is the TakeBack notice, and it takes the list filter, which the detail page does not have.
  - `onCancelHandoff` is inline: `acting` ref, `cancellingId` as `busyId`, `cancelOutcome(result, device, kind)`, notice, refresh.
  - Place and Assign-edit show no notice on the list. Assign "assign" mode focuses the heading and "edit" mode does not.
  - `onStale` re-fetches after a 409/stale answer.
- **The notice region is the list's pattern.** `<div aria-live="polite">` is always mounted. The notice goes inside it as `<p role="status">` or `<p role="alert">`. The detail view has no notice slot and no live region yet.
- **Refresh problem.** `useDeviceDetail.retryDetail` dispatches `load`, and `detailReducer` resets to `INITIAL_DETAIL` (`loading`, `device: null`). Using it after an action would swap the whole page for a skeleton. That unmounts the h1, the action bar and the live region, so the notice and the focus would be lost. `retryHistory` has the same reset: items vanish and the card shows a skeleton. Only the Retry buttons are meant to use these.
- **Both loaders return no value.** `useDeviceDetail` has no "refresh without a loading state" function, and nothing returns the new device. `DevicesPage` gets this from `refresh()` in `useDevices`. The same shape is missing here.
- **Losing access.** The detail page uses `GET /api/devices/:id`, which any member can read (DEV-11 "Every member"), and it is not scoped to the holder. After a transfer or a return the viewer still reads the device, but the flags change: `canTransfer`, `canReturn` and `mine` go false and a `pendingHandoff` appears. The page should therefore refresh and re-render, not navigate away. A 404 can only come from a delete or a stale id, and `notFound` already handles it. A 401/403 is handled by `apiFetch` and `AuthGate`.
- **Mixed paths in `DeviceDetailPage`.** `focused` is a once-only ref, and a second focus after an action must be explicit. The view focuses the heading only in `ready` and `notFound`.
- **Copy.** `devicesCopy.detail` holds the back link, sections and labels. `*.sent`, `actions.*` and the dialog copy all exist. The cancel and take-back notices come from `cancelOutcome` and `takeBackDone`, which are plain functions.

## Recommendations

1. **Action placement (AC1).**
   - Reuse `DeviceRowActions` in a header row, with no menu.
   - Put it in the same row as the `h1`. `DevicesView` already uses `flex items-center justify-between gap-3` with the `h1` on the left. Use `flex-wrap` and let the bar drop below the heading on narrow screens.
   - Add an optional `actions?: React.ReactNode` slot to `DeviceDetailView`, rendered only in `ready`.
   - A menu would be new UI with no spec support. The set is at most about 6 buttons, and the row already wraps.
   - Pass handlers `onAssign`, `onEditHolding`, `onPlace`, `onTransfer`, `onReturn`, `onExtend`, `onTakeBack` and `onCancelHandoff`. Leave out `onEdit` and `onDelete`.
   - Keep the action bar out of the loading, error and notFound states.
2. **Order and grouping.**
   - Use `rowActions` order as is. Cancel handoff comes first as the resolution of a pending item, and the danger action (Admin return, Take back) comes last. This matches the list, so a user sees the same order in both places.
   - No new grouping and no divider. If you ever add one, separate the danger button only.
   - Do not hide the bar when the viewer has no action. `DeviceRowActions` returns null, and the header collapses on its own.
3. **Shared dialog wiring.**
   - Extract `useDeviceDialogs({ api, seatsApi, roomsApi, onResult })`. It returns `{ handlers, dialogs: ReactNode }`, with the six `useState` targets and the six dialog elements. `onResult(notice | null, refreshKind)` is the host's callback.
   - Reason: duplicating about 150 lines of identical `onDone` wiring would drift, and SIM-037.12 also touches `DevicesPage.tsx`.
   - Expect a rebase there.
   - Fallback if the extraction is too big for this slice: copy the six dialogs into `DeviceDetailPage` and record a follow-up. The hook is the better choice, but R4 allows the fallback if the diff of `DevicesPage.tsx` grows.
   - Keep `onCancelHandoff` (it has the `acting` ref and `busyId`) in the hook too, so both pages share it.
   - `takeBackDone(device, filter)` needs a filter. Pass `"all"` or add a detail-page overload. Check its output text in `return-device.ts` first.
4. **Refresh without flashing.**
   - Add a silent `refresh()` to `useDeviceDetail`. It re-fetches the device and the first history page. It does not dispatch `load`. It dispatches `loaded` with a fresh counter id, and replaces the data only on success.
   - Keep the previous data on failure, and surface it as an error notice. Do not drop to `error` status.
   - History: dispatch `loaded` directly. That resets the pagination to page 1 (`nextCursor` from the new first page), which is the intended behaviour. It also keeps the `holderSince` in sync.
   - Return the new device from `refresh` so the host can decide on focus (see 6).
   - Add reducer tests: a refresh `loaded` while `ready` keeps status `ready`, and a stale refresh is dropped.
5. **Notices and the live region (AC2).**
   - Add a notice state in `DeviceDetailPage`: `{tone, text} | null`. Pass it to the view as `notice`.
   - Render `<div aria-live="polite">` once, above the sections and below the heading row. It is always mounted, so the announcement fires. Use the same `p role="status"`/`role="alert"` markup as `DevicesView`. Extract that markup if a third copy appears.
   - Clear the notice when a new dialog opens (the list calls `setNotice(null)` in each handler). Do not clear it on refresh.
   - Success notices reuse `devicesCopy.transfer.sent`, `giveBack.sent`, `extend.sent`, `takeBackDone` and `cancelOutcome(...).notice`.
   - Place and Assign-edit have no notice on the list. Keep that, or add one new string under `devicesCopy.detail`. Add it only if the page would otherwise show no feedback. Prefer the list parity; the page itself visibly changes.
6. **Focus.**
   - After a successful action, close the dialog, `await refresh()`, then `headingRef.current?.focus()`. The `h1` is `tabIndex={-1}` and stays mounted because of recommendation 4.
   - Do this for every `onDone`, including Place and Assign. A closing dialog returns focus to its opener, but the opener may have disappeared (the Transfer button vanishes once `canTransfer` is false). Focusing the heading is the safe landing spot, and the AC says "focus returns to the heading".
   - On a failed refresh, still focus the heading and show the error notice.
   - Keep the first-load `focused` ref as is. Do not re-focus on every refresh.
   - Use `useEffect` after commit if the heading could be replaced, as `DevicesPage` does with `focusTarget`. With a silent refresh the node stays the same, so a direct call after the await is enough.
7. **Pending handoff state.**
   - After a start (transfer, return, extension), the refreshed device carries `pendingHandoff`. The existing `Pending` section then shows it, and the action bar shows Cancel because `canCancel` is true, while `canTransfer` and `canReturn` go false.
   - No extra "pending" UI is needed. The notice text already says it waits for confirmation.
   - Disable the whole bar while an action runs, using `busyId = device.id`, as the list does. Also guard double submits with an `acting` ref.
8. **Viewer loses access.**
   - Stay on the page and re-render from the refreshed flags. Do not redirect.
   - On a 404 from the refresh (deleted elsewhere), the existing `notFound` state takes over. Let the refresh dispatch it so the user sees the not-found card, and focus its heading.
   - If a dialog gets a stale answer, `onStale` calls `refresh()` and keeps the dialog behaviour as on the list.
9. **Copy (D36).**
   - Reuse the existing strings (`devicesCopy.actions.*`, `*.sent`).
   - Any new string goes in `src/ui/copy/devices.ts` under `detail` (for example a refresh-failed notice). Check that `apiErrorMessage` is not enough first.
10. **Tests.**
   - Pure: `refresh` reducer behaviour, and the notice and focus decisions as a small pure helper if one is extracted.
   - View (`renderToStaticMarkup`): the action bar renders only in `ready`. It renders exactly the actions for the flags (for example a holder gets Transfer and Give back, a user with nothing gets no bar). `aria-live` is present when there is no notice. The `status` and `alert` roles are right.
   - Page-level focus after done is a behavioural test. If the harness cannot do it (the repo uses static markup), cover it through the pure helper and state it in the review notes.

## Risks

- **Whole-page skeleton after an action** if `retryDetail` is reused. It loses the live region, the notice and focus. Mitigation: recommendation 4.
- **`DevicesPage.tsx` conflicts with SIM-037.12** if the dialog wiring is extracted. Mitigation: a small hook with an unchanged `DevicesPage` render, or the copy fallback.
- **Handoff start bug** (SIM-037.6 PR #102) affects start transfer/return/extension. Check that the fix is on `main` before the manual walk.
- **Focus lost after a dialog closes** if the opener button vanished. Mitigation: always focus the heading.
- **History pagination reset**: after an action the user may lose their "Load more" position. Acceptable, and the new event is on top.
- **`takeBackDone(device, filter)`** is list-filter specific, so the text could mention a list filter that does not exist on this page.
- **Race**: an action and an in-flight refresh. The counter pattern drops stale answers. Make sure `refresh` uses the same `latest` counter.
- **Double submit** from a dialog and the cancel button. Use the `acting` ref.

## Open questions

1. Extract `useDeviceDialogs` (recommended) or copy the wiring and file a follow-up? It is the planner's decision under R4.
2. Does `takeBackDone` have a filter-free variant? If not, which text should the detail page show?
3. Should Place and Assign-edit show a notice on the detail page? The list shows none. Recommended: no, for parity.
4. Should a refresh failure show a notice with the old data kept (recommended), or drop to the `error` state?
5. Is the handoff start bug fix (PR #102) merged on `main`?
