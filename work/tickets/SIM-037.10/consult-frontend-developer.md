## SIM-037.10 UI consult (delta on SIM-037.4 advice, checked against main)

### Findings
**Merged API contract (what the UI binds to)**
- `POST /api/devices/:id/handoffs` body `{kind:"return", note: string|null}`. `HandoffStartValue` already has the return variant, and `validateHandoffStart` handles it. It returns a `HandoffDto`.
- `POST /api/devices/:id/take-back` is Admin-only through `withAuth({tier:"admin"})`, so a non-Admin gets a 403 from the wrapper. It has no body, so **there is no reason/note**. My earlier "optional note" idea is dropped. It returns a `DeviceDto`.
  - Errors: `device_unowned` (422), `handoff_pending` (409, a pending return exists), `placement_changed` (409), `not_found`.
  - Take-back also cancels a pending *transfer*. The confirm dialog should say so when `device.pendingHandoff?.kind === "transfer"`.
- `GET /api/handoffs?box=returns` is `user` tier. For a non-Admin it returns **422 `not_allowed`, not 403**. The UI must therefore only call it when `isAdmin`. My earlier "treat 403 as hide" is replaced by "don't call it for non-Admins". `box` must be exactly one of `incoming` or `returns`.
- `GET /api/handoffs/count` returns `{incoming, returns}`. `returns` is 0 for non-Admins, and `incoming` is the caller's own transfers. `HandoffCountDto` and `HandoffBox` already exist in `src/lib/devices/types.ts`.
- `DeviceDto.canReturn` and `canTakeBack` exist.
  - `canTakeBack` is true for an Admin, an owned device, and no pending *return*. It stays true with a pending transfer.
  - `canReturn` is true for an owner or Manager+, an owned device, and no pending handoff.
  - So `cancelTransfer` and "Take back" can appear together on one row.
- A pending return in `PendingHandoffDto` has `to: null`, `canCancel`, and `requestedBy`. The note is **not** in `PendingHandoffDto`. It is only in the `HandoffDto` from the list.

**Code state on main (what must change)**
- `devices-api.ts`:
  - `startTransfer` already posts to `/handoffs` with any `HandoffStartValue`. Add `startReturn(id, note)` and `takeBack(id)` (a `oneDevice` result).
  - Parameterise `incomingHandoffs` as `listHandoffs(box)`, or add `pendingReturns`.
  - `handoffCount` currently reads only `incoming`. Parse `returns` too, and tolerate a missing `returns` as 0 so old servers still work.
- `pendingText()` in `devices-state.ts` returns null unless `kind === "transfer"`. The "Return pending" chip needs a return branch with `to: null`. Add `devicesCopy.pending.returnChip` and reuse the `requestedBy` line if useful.
- `rowActions` gates cancel on `kind === "transfer"`. Make it kind-aware: `cancelReturn` and `cancelTransfer` use separate copy keys, and `DeviceRowHandlers` can keep one `onCancelHandoff`. Put the order as cancel, then the regular actions, with `takeBack` last next to `delete` (both danger).
- `useHandoffBadge` calls `set(r.value.incoming)`. Change it to `incoming + returns`.
- `badgeCountAfter(count, items)` only reads `incoming`. Its fallback to `items.length` is wrong once there are two lists. With two lists, fall back to `incomingItems.length + returnItems.length`, or return null. Change its signature to take both lists (null if either failed), and update its tests.
- `shell.ts` `byNav.devices` is `(n:number)=>string`, so it **cannot give a breakdown**. `AppShellView` only gets `badges: Partial<Record<NavId,number>>`. Options:
  - (a) Add an optional `badgeDetail?: Partial<Record<NavId,string>>` prop that overrides the sr-only text. The text is built in `AppShell` from `{incoming, returns}`.
  - (b) Keep the number-only API and have `useHandoffBadge` return `{total, incoming, returns}`.

  I recommend (a). Add `shellCopy.badge.devicesBreakdown(incoming, returns)`, which gives "3 pending items: 2 incoming transfers, 1 pending return" and falls back to the existing `incomingTransfers(n)` when `returns === 0`. The existing `AppShellView` tests then stay valid.
- Extending `BadgeContext` so it holds `{incoming, returns}` and `set(incoming, returns)` is cleaner than a sum plus a side channel. The `seq` guard stays.
- `DevicesPage.act()` is bound to `incoming.items`, `incoming.refresh`, `incomingBusyId` and `incomingHeadingRef`. Generalise it with a `list: "incoming" | "returns"` parameter:
  - `before` comes from that list.
  - After the action, refresh **both** lists plus the devices, then compute the badge from both.
  - The shared `acting` ref and one `busyId` already serialise actions.
  - `focusTarget` needs a section variant: `{kind:"section", list}`, and a second heading ref. The confirm selector `[data-handoff-confirm=id]` works unchanged, since handoff ids are unique.
- `useIncomingHandoffs(api)` is hard-wired to `incomingHandoffs`. Parameterise it as `useHandoffList(api, box, enabled)`.
  - Reuse `incomingReducer`.
  - `enabled=false` for non-Admins means no fetch, and `status` stays ready/empty.
- `focusAfter` and `confirmOutcome` are reusable. `confirmOutcome`'s `filterHint` text is wrong for a return: the device becomes unowned and unplaced, so it stays in the `unowned` filter and leaves `placed`. Add `confirmReturnOutcome` with copy "{device} is back in the org inventory", plus a hint only when the filter is `placed`.
- `settleTransfer`'s STALE list (`handoff_pending`, `not_allowed`, `device_unowned`, `invalid_recipient`) fits returns. Generalise it as `settleHandoffStart(result, {recipient:boolean})`, or write `settleReturn` that reuses the shared list. Drop the member-picker flags. `NOTHING_CHANGED` is reusable.
- `PendingReturns` is a sibling of `IncomingTransfers`, as I recommended earlier. It renders the item (device, `typeLine`, "Returned by {from.displayName}", note) and Confirm (`canConfirm`). Add Cancel only when `canCancel` (Admin-owned or Admin-requested). It does not show Decline (the server gives `canDecline` false for returns).

### Recommendations
1. **API client and types.**
   - Add `startReturn`, `takeBack`, `listHandoffs(box)` and the two-field count parser with the missing-`returns` default.
   - Add API-path tests in `devices-api.test.ts`.
2. **Pure modules.**
   - `return-device.ts`: `toReturnBody(form)` uses `validateHandoffStart({kind:"return", note})`, `settleReturn(result)` and the shared STALE list.
   - Add `takeBackOutcome(result, device)`. On `handoff_pending`, `placement_changed`, `device_unowned` or `not_found`, show the "gone" or stale notice and refresh. Success shows "{device} is back in the org inventory".
   - Add `cancelOutcome` copy per kind (`copy.cancelled` is currently transfer-specific). Make it take `kind`.
3. **Dialogs.**
   - `ReturnDeviceDialog` follows `TransferDeviceDialog` without the picker. The body sentence says the device leaves the owner's inventory only after an Admin confirms.
   - Take-back confirm: reuse `DeleteDeviceDialog`'s shape (`EntityFormDialog`, danger confirm). It shows the device, **owner** (`device.owner.displayName`) and **seat** (`placement`). It adds the sentence "pending transfer will be cancelled" when relevant.
   - The owner may be deactivated. Show the name as given, with no special lookup, since nothing here depends on the member being active.
4. **Row actions.**
   - "Give back to org" with aria `Give {inv} back to the org`, and "Take back" with `Take {inv} back from {owner}`.
   - Use the existing place-mode "Return" key and its copy unchanged. This keeps the labels distinct.
   - One more case: for a device with a pending return and `canCancel`, show "Cancel return". `canPlace` may still be true during a pending return, and the server decides. Do not hide place or move in the UI.
5. **Nav badge.**
   - For non-Admins the sum equals `incoming`, so existing behaviour is unchanged.
   - In `DevicesPage`, call `setBadge` with both numbers after every action, and initialise from the same two-list state.
6. **Tests.**
   - Pure: `settleReturn`, `takeBackOutcome`, `rowActions` gating (cancelReturn vs cancelTransfer, takeBack with a pending transfer, no takeBack with a pending return), `pendingText` for return, and `badgeCountAfter` with two lists (count ok, count failed with both lists, one list failed).
   - Markup: `ReturnDeviceDialog`, take-back dialog, `PendingReturns` (Confirm only if `canConfirm`, Cancel only if `canCancel`, empty renders null, error and retry), and `AppShellView` with the breakdown text.
   - Seed a regression test that a non-Admin never calls `box=returns`.

### Risks
- A non-Admin calling `box=returns` gets 422 and would show an error banner. This is guarded by `isAdmin`. `session` can be briefly null, so key `enabled` off a resolved tier.
- `badgeCountAfter` fallback to a single list length would under-count in the Admin case. See above.
- `take-back` of a device with a pending transfer cancels it silently for the recipient, whose badge only updates on focus or route change (D24, no polling). This is acceptable. Put it in the confirm text.
- An Admin who owns the device may see Confirm on their own return, since the server computes `canConfirm`. The UI follows the flag. Check the merged `canConfirm` rule for self-confirm and mirror it in a test.
- `cancelOutcome`'s notice says "cancelled transfer" for any kind unless the copy is split.
- Two "Return" labels were the main UX risk. They are avoided by the new "Give back to org" copy. Check that `copy.actions` does not already have `giveBack` or `takeBack` keys before adding.

### Open questions (proposed defaults)
1. Badge a/b: use `badgeDetail` prop (a) with the breakdown text? Default: yes.
2. Self-confirm of an Admin's own return: follow `canConfirm` from the server. Default: yes, with no UI rule.
3. Take-back has no reason field in the merged API. Default: confirm dialog only, with no note. If Ming wants a reason, it needs an API follow-up.
4. Should "Cancel return" be visible to Admins who did not start it (via `canCancel`)? Default: follow `canCancel`.

Files: `D:\Projects\SAF\spaceM\projects\simap\src\ui\devices\` (DevicesPage.tsx, device-actions.ts, devices-api.ts, devices-state.ts, incoming-transfer.ts, transfer-device.ts, useHandoffBadge.tsx, useIncomingHandoffs.ts, IncomingTransfers.tsx), `...\src\ui\AppShell.tsx`, `...\src\ui\AppShellView.tsx`, `...\src\ui\copy\shell.ts`, `...\src\server\devices\handoffs.ts`, `...\src\lib\devices\types.ts`.
