## Findings
- `rowActions` (src/ui/devices/device-actions.ts) builds actions in order cancelTransfer, assign, editHolding, place modes, transfer, edit, delete. Cancel is gated on `pendingHandoff.kind === "transfer" && canCancel`. The place-mode "Return" is `devicesCopy.actions.return` ("Return"), aria "Return device X to inventory". It removes a device from its seat back to the holder's inventory, with the dialog title "Return device", the submit "Return to inventory" and `returnConfirm`. The new flow's labels must not read like this one.
- `pendingText` (devices-state.ts:34) returns null unless `kind === "transfer"`. The comment says it is waiting for SIM-037.4/037.5, so the "Return pending" chip goes here, with no "To ..." line. `devicesCopy.pending.chip` is "Transfer pending".
- `DevicesPage` has one `act()` / `acting` ref / `incomingBusyId` flow for incoming transfers. Its `onCancelTransfer` handler is a separate ad-hoc flow that uses `cancellingId`, and it focuses `headingRef` afterwards.
- `useHandoffBadge` reads `.incoming` only, and `useSetHandoffBadge` takes one number. `DevicesPage` calls the setter after each action.
- The SIM-037.9 consult (one live region, a seq guard, a shared in-flight guard, compute focus before the refresh, then focus after the refresh) all still apply.

## Recommendations
1. **Labels.** Keep the place-mode "Return" as is, or better, rename it to "Remove from seat" (aria "Remove device X from its seat to inventory"). The place-mode `return` copy and key stay, because only the label text changes. That is a small copy change, and Ming should decide on it (see open question 1). The new actions are:
   - "Give back to org" (aria "Give device X back to the organization"). The dialog title is "Give device back to org", the submit is "Give back", and the dialog explains "An Admin must confirm. Until then the device stays with you." with an optional note.
   - "Take back" (danger, aria "Take device X back into org inventory"). The confirm dialog title is "Take back this device?". The body names the owner and the seat ("Currently with <owner>, on seat <code>" or "not placed") and says "It will become unowned and leave its seat." For a deactivated owner, add a "(deactivated)" tag. The submit is "Take back" in danger style.
   - "Cancel return" (aria with the inventory number).
   - Use distinct copy keys: `giveBack*`, `takeBack*`, `cancelReturn*`. Do not reuse `return*`.
2. **rowActions.** Add `onReturn`, `onTakeBack` and `onCancelReturn` handlers. Order: cancelReturn beside cancelTransfer, `giveBack` after `transfer`, and `takeBack` last before or after delete (danger). Make `onCancelTransfer` kind-aware. Define `cancelTransfer` as a kind-aware `cancelHandoff` that picks the label and notice text from `pendingHandoff.kind`. The server flags (`canReturn`, `canTakeBack`, `canCancel`) are the only gate. While a return is pending, the row has no Give back, Transfer, Assign or Place, because the server clears those flags. Verify that in the rowActions tests.
3. **Chip.** `pendingText` returns {chip: "Return pending", to: null} for `kind: "return"`. Add a test. The chip's text carries the meaning, not its colour, and it uses the same style as the Transfer chip.
4. **PendingReturns.** Make it a near-copy of IncomingTransfers, rendered after it inside the same `incoming` slot or a sibling slot. It is for Admins only, because the server decides who gets items. The h2 is "Pending returns (N)" and the hint is "Confirming makes the device unowned and removes it from its seat." Each card shows the device (name, inventory number), "From <name>" and the note (`whitespace-pre-line`, clamped). Confirm (primary) is shown when `canConfirm`. Cancel (tonal) is shown when `canCancel`, with no confirm dialog. Use its own hook (`usePendingReturns`, `box=returns`), but share the same `act()` / `acting` ref, `busyId`, notice region and `Promise.all` refresh of both lists, devices and badge. Focus follows the same helper as incoming (next item, else previous, else section heading, else page heading). Rows that start a return from the page use the same ref guard.
5. **Outcomes.** Put `returnOutcome` (start), `confirmReturnOutcome`, `cancelReturnOutcome` and `takeBackOutcome` in pure `return-device.ts`, generalising `settleTransfer` and `cancelOutcome`.
   - Stale: `handoff_not_pending`, `handoff_stale` and `not_found` all give a status-tone notice "no longer available, list refreshed", then a refresh.
   - Network error: error tone, and the item stays so the user can retry.
   - Success for confirm: "<device> is now unowned."
6. **Badge.**
   - `handoffCount` returns `{incoming, returns}`, with `returns` defaulting to 0 when absent (an older server or a non-Admin). Parse defensively.
   - `useHandoffBadge` sets `incoming + returns`.
   - Pass the breakdown to the shell as a total plus parts, or add a second `returns` slot to the provider. `badgeCountAfter` takes both lists' lengths. Keep one number in the context, and have the setter accept a number.
   - The aria text in `shell.ts` is built from the parts: "N incoming transfers, M pending returns", with zero parts omitted. The visible badge stays one number, capped at 9+, while the sr-only text uses the true counts. The existing `myRequests` and `devices` badge tests must stay green.
   - To pass parts through, `badges.devices` could carry {incoming, returns}. Keep that type change minimal, or keep the number and put the breakdown text in a separate `badgeLabels` map. Pick one in the plan.
7. **Dialog.** `ReturnDeviceDialog` reuses `NoteField` and the `TransferDeviceDialog` structure (no recipient picker, the title and explanation differ). Error codes: `handoff_pending` (409) and `not_allowed` (409/422) are domain refusals, shown inline in the dialog. If the device is already unowned or gone, treat it as stale.
8. **Take back confirm.** Use `DeleteDeviceDialog` as the template (danger confirm, inline error, focus on Cancel first). The destructive default is not focused.

## Risks
- Two "Return" labels on one row is the main confusion risk. Mitigation: rename the place-mode label (recommendation 1). If Ming declines, the new labels already differ and the aria text carries the difference.
- A shared `act()` guard across three flows (incoming, returns, row actions) can interleave refreshes. Use one guard.
- Badge count cannot go stale only if `badgeCountAfter` is updated for returns. A missed update leaves the badge at the old sum until focus or navigation.
- `pendingText` currently returns null for returns, so a missing chip would hide the pending state and users could retry confusingly (the server refuses with `handoff_pending`).
- Take back on a deactivated owner: the owner's display name may be missing. Fall back to "a deactivated member" copy.
- R4: do not merge the two badge providers or add unrelated refactors. R7: only 409/422 for domain refusals, and 401/403 stay in `apiFetch`.
- The `DevicesViewProps` additions must be optional so existing fixtures stay valid.

## Open questions (defaults)
1. Rename the place-mode "Return" to "Remove from seat"? Default: yes, copy only, same key and behaviour.
2. Should Managers see "Give back to org" for devices they do not own? Default: follow `canReturn` from the server, with no client logic.
3. Does "Cancel return" need a confirm dialog? Default: no (same as cancel transfer).
4. Should PendingReturns show when an Admin has none, or the empty state? Default: show nothing when empty (as incoming).
5. Does the Admin see their own return in PendingReturns? Default: yes, with Confirm shown only if the server sets `canConfirm`.
