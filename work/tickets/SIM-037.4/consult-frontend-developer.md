## SIM-037.4 UI consult

**Findings**
- Pattern to copy: `TransferDeviceDialog` (props-only `...Fields` plus `Inner` keyed by device, `EntityFormDialog`, `NoteField`, pure `transfer-device.ts` with `settleTransfer`/`cancelOutcome`). `IncomingTransfers` is a pure list driven by `HandoffDto.canConfirm/canDecline`. `DevicesPage` has the `act()` helper (one action at a time via `acting` ref, then refresh of both lists, badge and focus). `useHandoffBadge` has a `seq` guard and `useSetHandoffBadge`. `AppShell` passes `badges={{ devices: incoming }}`, and `shell.ts` `badge.byNav` gives the screen-reader text per nav id.
- The data contract is Transfer-only for now. `HandoffStartValue` accepts only `{kind:"transfer"}`. `HandoffCountDto` is `{incoming:number}`. `GET /api/handoffs` takes `box=incoming` only (400 otherwise). `DeviceDto` has `canTransfer` but no return or take-back flag. `PendingHandoffDto.kind` already allows "return".
- `PlaceMode` already contains "return" (`place-device.ts`, label `devicesCopy.actions.return`). I read it as returning a device to storage, which is a different thing. The new handoff Return needs distinct keys and copy, such as `returnToOrg` or `giveBack`, or users will confuse the two.
- `IncomingTransfers` reads `item.from` and `item.device.type`. A return has no recipient, so its card needs a "Returned by X" line, and the heading and hint text need their own copy.
- `cancelTransfer` in `device-actions.ts` is gated on `kind === "transfer"`, so a pending return gets no Cancel action today.

**Recommendations**
1. Types and API (`src/lib/devices/types.ts`, `devices-api.ts`):
   - Widen `HandoffStartValue` with `{kind:"return"; note: string|null}`.
   - Add `canReturn` and `canTakeBack` to `DeviceDto`. Compute `canTakeBack` on the server: Admin, device owned, no pending request. Keep this server-driven like the other flags.
   - Add `box=returns` (Admin pending returns) to the list, and `returns` to the count: `{incoming, returns}`.
   - Add `startReturn(id)` and `takeBack(id)` to the API client.
   - Agree these server contracts with the API consult before building the UI.
2. Return dialog: `ReturnDeviceDialog` plus a pure `return-device.ts`. It has a confirmation sentence ("It leaves your inventory only when an Admin confirms receipt") and an optional note. Do not copy the picker or the expiry hint. Reuse the stale and outcome pattern, for example by generalising `settleTransfer`.
3. Return row actions: in `rowActions` add `onReturn` (gated by `canReturn`), `onTakeBack` (gated by `canTakeBack`, `danger` styling) and `onCancelReturn`. Make `cancelTransfer` handle `kind` "return" with its own label and aria text. Use the Transfer chip pattern for "Return pending".
4. Pending returns list: build a sibling `PendingReturns` component, not a mode of `IncomingTransfers`. Render it on `DevicesPage` only when `isAdmin`, with its own hook (copy `useIncomingHandoffs` or parameterise it by box). Confirm uses `api.confirmHandoff`. Do not offer Decline, since the scope has none. Admin-only Cancel is optional and comes from `canCancel`.
5. Generalise `act()` so both lists share the `acting` ref and `busyId`, and the focus targets cover the second section. Take-back is a destructive action, so use a confirm dialog modelled on `DeleteDeviceDialog`. It must work on a deactivated owner's device, and the owner's name should still show.
6. Nav badge, Admin only:
   - Make the Admin badge count incoming transfers plus pending returns, in the same `devices` slot. Show the sum, and put the breakdown in the aria text. Add an entry like `badge.byNav.devices` that handles the sum, or a separate `returnsBadge` copy.
   - `useHandoffBadge` should set the sum from the new count. `badgeCountAfter` and the `set` calls in `DevicesPage` need updating to match.
   - Non-Admins get `returns: 0`.
7. Tests, in the style of the existing ones:
   - Pure tests for the return outcomes.
   - Component tests for the dialog and `PendingReturns`: Confirm only for Admins, empty state, error and retry.
   - `rowActions` gating tests.
   - Badge sum tests.
   - Update `AppShellView.test`.
8. Copy goes in `src/ui/copy/devices.ts` (D36), in English. Add notices such as "Return sent to Admins" and "{device} is back in the org inventory".

**Risks**
- Calling the new flow "Return" next to the existing `place` mode "Return" gives two buttons with the same label on one row. Rename one of them.
- If `count` changes shape, the old `incoming`-only parsing in `devices-api.ts` and the `badgeCountAfter` tests break. Keep `incoming` and add a field, so older cached clients keep working.
- An Admin who owns the device can start a return and also confirm it. Decide whether self-confirm is allowed. The server rule must be the same one the UI uses for `canConfirm`.
- After Confirm or Take-back the device list, pending-returns list and badge all change at once. Reuse the sequence guard to avoid flicker.
- The `box` and count contract has no Admin check yet. Return handlers must keep the R7 rule (auth codes before any side effect). The UI should treat a 403 on `box=returns` as "hide the section", not as an error.

**Open questions**
1. Does the badge show one summed number or two? Proposed default: one sum.
2. May an Admin confirm their own return? Proposed default: yes, the server decides and the UI follows `canConfirm`.
3. Does the return note appear in the pending list? Proposed default: yes, as with transfers (the DTO has a note).
4. Does take-back need a confirm dialog and an optional reason? Proposed default: a confirm dialog with an optional note, which goes into the audit row.
5. Do the plan and API contract names above, `box=returns` and `count.returns`, match the API consult?
