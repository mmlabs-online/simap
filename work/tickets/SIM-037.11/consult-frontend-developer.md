## Findings

Slice 1 already prepared much of the UI side:
- Types: `DeviceDto.overdue`, `PlacementFilter` includes "overdue", `PendingHandoffDto.newExpiresOn`, `HandoffBox` includes "extensions", `HandoffStartValue` has the extension kind, and `HandoffDto.newExpiresOn` exists (`src/lib/devices/types.ts`).
- `devices-api.ts` `handoffCount` already parses `extensions` and `overdue`. `useHandoffBadge.tsx` `ZERO` already has all four fields.
- `devicesCopy.filters.overdue` ("Overdue") and `devicesCopy.empty.overdue` already exist, but `FILTERS` in `devices-state.ts` lacks "overdue", so the chip does not show yet.
- Tests that pin the old behaviour and will need updating: `device-actions.test.ts` l.165 and l.226 (extension gives no row action), and `devices-state.test.ts` l.151-153 (pendingText for an extension is null).

Gaps that this ticket must fill:
- `devices-api.ts`
  - `startReturn` is the only "start" helper besides `startTransfer`, which takes a `HandoffStartValue`. `startTransfer` can already send `{kind:"extension",...}`. A thin `startExtension(id, newExpiresOn, note)` is cleaner and testable.
  - `listHandoffs("extensions")` is missing. Add `pendingExtensions: () => listHandoffs("extensions")`.
- `useIncomingHandoffs.ts` `useHandoffList` picks the fetcher with `box === "returns" ? pendingReturns : incomingHandoffs`. This must become a three-way map, or "extensions" will silently fetch incoming.
- `incoming-transfer.ts`
  - `badgeTotal` = incoming + returns, so it must add extensions and overdue.
  - `badgeCountAfter` fallback hard-codes `extensions: 0, overdue: 0`.
  - `handoffBoxes(isAdmin)`: returns is Admin only, but extensions are Manager+. It needs a tier-aware version, for example `handoffBoxes(isAdmin, isManager)`.
  - `focusAfter` and `FocusTarget.list` use `HandoffBox`, so "extensions" works with a third heading ref.
- `AppShell.tsx` l.24-26 calls `badgeTotal(handoffs)` and `shellCopy.badge.devicesBreakdown(incoming, returns)`. `copy/shell.ts` l.9 `devicesBreakdown(incoming, returns)` needs extra parts: "N overdue", "N pending extensions". Follow the existing zero-parts-left-out logic, and use a joined list for 3 or more parts.
- `devices-state.ts` `pendingText` returns null for an extension. It needs a chip such as `pending.extensionChip` ("Extension pending") and optionally the requested date. `to` stays null.
- `DeviceTable.tsx` `OwnerLabel` renders the `pending` chip, the `mine` chip and the expiry line. Add an Overdue chip there when `device.overdue`, and in the card/mobile layout if there is a separate one (check `DeviceTable.tsx`).
- `device-actions.ts` `rowActions`
  - The cancel action is gated to transfer or return.
  - Allow `pending.kind === "extension"` with `canCancel`, with keys and copy `cancelExtension` / `cancelExtensionAria`.
  - Add an `onExtend` handler and an "Extend" action for `d.mine && d.overdue && !d.pendingHandoff`. The DTO has no `canExtend` flag, so derive it as mine + overdue + no pending handoff. Optionally show Extend for any owned device with an expiry, but the spec only needs overdue.
- `DevicesPage.tsx` is the integration point. Add `const extensions = useHandoffList(api, "extensions", isManager)`, `extensionsHeadingRef`, `extending` state, `<PendingExtensions>`, `<ExtendDeviceDialog>` and `<OverdueBanner>`. Include `extensions.refresh()` in `refreshAll` and pass it to `badgeCountAfter`. `onCancelHandoff` currently maps kind to "return" or "transfer" for `cancelOutcome`. Add "extension" there (check `transfer-device.ts` `cancelOutcome`'s kind union and the copy for it).
- `seeder.js` l.132-144: the devices insert has no `holding_expires_on` column. The seed has no holding rows, so add a device (e.g. n=5 "Tablet E") owned by `members[0]` with `holding_expires_on = current date - 1 day`, UTC+7 aware. Check `db/seeder.test.ts` for count expectations. The `devices` insert may need a holding column or a separate update. Check the schema in `db/migrations` for the holding columns' names and check constraints.

## Recommendations

1. Pending extensions list: copy `PendingReturns.tsx` into `PendingExtensions.tsx` (same props: `items, truncated, errorCode, busyId, onConfirm, onCancel, onRetry, headingRef`). Show device, `From <owner>`, "Current expiry X -> requested Y" (from `item.device.expiresOn` and `item.newExpiresOn`) and the note. Buttons are Approve (`canConfirm`) and Reject (`canDecline`). Note that `PendingReturns` uses `onCancel` for its decline path, but for extensions Reject = `declineHandoff`, so use `onDecline`. Wire it through the existing `act("extensions", item, call, outcomeOf)`. Add `copy.extensions` in `devices.ts` (heading, hint, approve, reject, aria labels, approved/rejected notices, gone, truncated) and `approveExtensionOutcome` / `rejectExtensionOutcome` in a new `extension-device.ts`, reusing `handoffActionFailed`. Use the "extension" wording for the stale text instead of the transfer text, as `confirmReturnOutcome` does.
2. Extend dialog: `ExtendDeviceDialog.tsx` modelled on `ReturnDeviceDialog.tsx` (`EntityFormDialog`, keyed by device, `onStale`/`onDone`). Reuse `NoteField` and `DialogField type="date"` with `min = tomorrow` (UTC+7). Write a helper `nextDay(todayUtc7)` in `extend-device.ts`, with no `Date` math on local time. Build the body with `validateHandoffStart({kind:"extension", newExpiresOn, note}, today)`, which keeps the server and client rules the same (as `toReturnBody` does). Map `field === "newExpiresOn"` to a new copy error, and write `settleExtension(result)` like `settleReturn`. Stale codes: `handoff_pending`, `not_allowed`, `device_unowned`.
3. Banner: `OverdueBanner.tsx`, pure with props. Input is the owner's overdue devices (`items.filter(d => d.mine && d.overdue)`) from the device list. The banner must not depend on the current filter, which would hide it. Options:
   - Preferred: a separate light `api.list("overdue")` fetch, since the API scopes overdue to the caller's own devices. Check this in `src/server/devices`. The count's `overdue` is documented as "own owned devices", so the list may be org-wide for a Manager.
   - Cheaper: use the nav count (`useHandoffBadge` context) for the heading, and list devices only under the Overdue filter.
   - Decision needed (see Open questions).
   Each banner row has Extend and Give back (reuse `onReturn`/`ReturnDeviceDialog`). Use `role="region"` with `aria-labelledby`. Put the banner above `incoming` in the `DevicesView` slot, or add an `overdueBanner` prop.
4. Nav badge: change `badgeTotal` to `incoming + returns + extensions + overdue` and extend `devicesBreakdown(counts)` to take the whole count object. Update `AppShell.tsx` and `incoming-transfer.test.ts`. Update the `badgeCountAfter` fallback to carry `extensions.length` and `overdue` from the last known count where possible, or return `null` to keep the previous badge.
5. Filter: add `"overdue"` to `FILTERS`. In `filterAfterCreate` and the `confirmOutcome` hint logic, check whether the overdue filter needs anything (a newly created device is never overdue, so probably nothing).
6. Copy in `src/ui/copy/devices.ts` (and `shell.ts`), all under D36: `pending.extensionChip`, `overdueChip`, `actions.extend/extendAria/cancelExtension/cancelExtensionAria`, `extend.{title,submit,newDate,note,noteHint,next,sent,cancelled,gone,errors}`, `overdueBanner.{heading(n),hint,extend,giveBack,aria}`, `extensions.{...}`.
7. Tests (R5): `devices-api.test.ts` (startExtension path/body, `pendingExtensions` path), `devices-state.test.ts` (pendingText extension, FILTERS), `device-actions.test.ts` (Extend / cancelExtension gating), `incoming-transfer.test.ts` (badgeTotal, badgeCountAfter, handoffBoxes), `extend-device.test.ts` (body, min date, settle), markup tests `PendingExtensions.test.tsx`, `ExtendDeviceDialog.test.tsx`, `OverdueBanner.test.tsx`, plus `DevicesView.test.tsx` for the Overdue chip and `AppShell` badge copy tests. Use `PendingReturns.test.tsx` and `ReturnDeviceDialog.test.tsx` as templates. Update `seeder.test.ts` if it counts rows.
8. Seed: add one overdue device owned by `members[0]` with expiry yesterday (relative, not a fixed date) and, if the schema requires `holding_note`, set it too.

## Risks

- R7/layers: all new UI code stays under `src/ui/**` and imports only `@/lib/*` (`validateHandoffStart` and `todayUtc7` are already used from UI in `return-device.ts`, so that is fine).
- `useHandoffList` hard-wired to the returns/incoming fetchers is a silent bug if not updated: a Manager would see incoming transfers under "Pending extensions".
- A non-Manager must never call `box=extensions` (it answers 422), so gate the hook with `enabled`, as is done for returns.
- Banner data source: the Overdue filter returns the DTO's overdue flag for the caller's devices only if the server scopes it, so verify. If a Manager sees org-wide overdue devices there, the banner must filter with `d.mine`.
- Existing tests assert that extension means no action and no chip, so they must be updated, not just extended.
- Date logic: use only `todayUtc7` and string compare. Do not use `new Date(string)` (see `expiryText`: "never through Date").
- Focus management: the extra `HandoffBox` list needs its own heading ref so `focusAfter` works. After Extend or Cancel, move focus to the page heading, as the other flows do.
- One pending handoff per device: while an extension is pending, Transfer, Give back and Extend actions are already hidden by the server flags (`canTransfer`, `canReturn`), but the client-derived Extend must also check `!pendingHandoff`.
- Seed: `holding_expires_on` may have a check constraint (see `schema-check.mjs` l.620 and l.670), so check the migration.

## Open questions

1. Banner source: separate `api.list("overdue")` fetch (always visible regardless of the page filter), or derive from the loaded list and nav count? I recommend the separate fetch, kept in the `refreshAll` flow.
2. Should Extend also be offered to the owner for a not-yet-overdue device with an expiry (DEV-10 only mentions overdue)? I recommend overdue only.
3. May a Manager+ edit the expiry directly (OQ-42)? It is already covered by "Note / expiry" (`canEditHolding`), so there is nothing to build here. Please confirm.
4. Does Reject need a reason or note field? The API's decline takes none, so I recommend no.
5. Does the Manager's nav badge sum overdue (own) and extensions (org), or show them separately in the aria label? I recommend a sum with a breakdown label.

Relevant files:
- d:\project\simap-game-ui\src\ui\devices\DevicesPage.tsx
- d:\project\simap-game-ui\src\ui\devices\PendingReturns.tsx
- d:\project\simap-game-ui\src\ui\devices\ReturnDeviceDialog.tsx
- d:\project\simap-game-ui\src\ui\devices\return-device.ts
- d:\project\simap-game-ui\src\ui\devices\incoming-transfer.ts
- d:\project\simap-game-ui\src\ui\devices\useIncomingHandoffs.ts
- d:\project\simap-game-ui\src\ui\devices\useHandoffBadge.tsx
- d:\project\simap-game-ui\src\ui\devices\device-actions.ts
- d:\project\simap-game-ui\src\ui\devices\devices-state.ts
- d:\project\simap-game-ui\src\ui\devices\devices-api.ts
- d:\project\simap-game-ui\src\ui\devices\DeviceTable.tsx
- d:\project\simap-game-ui\src\ui\AppShell.tsx
- d:\project\simap-game-ui\src\ui\copy\devices.ts
- d:\project\simap-game-ui\src\ui\copy\shell.ts
- d:\project\simap-game-ui\db\seeder.js
