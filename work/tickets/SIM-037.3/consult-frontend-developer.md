# Consult — frontend-developer (2026-11-25)

SIM-037.3 UI consult (read-only; nothing edited)

## Findings (current code)
- Devices UI:
  - `DevicesPage.tsx` owns dialog state (`placing`, `holding`, `form`, `deleting`) and passes memoized `actions: DeviceRowHandlers` to the pure `DevicesView`.
  - `device-actions.ts` `rowActions(d, handlers)` builds the row buttons; a button shows only if its handler exists and the server flag is true (`canAssign`, `canEditHolding`, `canPlace`/`placeModes`, `canEdit`, `canDelete`).
  - `DeviceRowActions` renders the buttons with `aria-label` `<Verb> device <inv>`.
  - `DeviceTable` renders the table at md+ and a card list below; both use `OwnerLabel` and `PlacementLabel`, so one change covers both layouts.
- `DeviceDto` (`src/lib/devices/types.ts`) has no handoff fields yet; `canDelete` carries the comment "A pending handoff is checked by the server only".
- `STALE` in `assign-device.ts` already lists `handoff_pending`. `src/ui/copy/api.ts` and `src/lib/api/error.ts` also mention handoff/transfer, so some error codes may exist (not verified).
- Member picker reuse:
  - `AssignDeviceDialog` composes `EntityFormDialog`, `MemberPickerFields`, `useMemberPicker(seatsApi.activeMembers, reloadToken)` and `selectedMember`.
  - The picker list is `/api/members?status=active` with a built-in `occupantId` disable; for transfer pass the owner's id as `occupantId`.
  - The disabled option's copy `copy.pickerSitsHere` ("sits here") is wrong for a transfer: add an optional label prop to `MemberPickerFields` or a transfer-specific suffix.
- The note field lives in `AssignDeviceFields` (textarea, counter, hint, `DEVICE_LIMITS.note` = 500), bundled with the expiry fieldset, which Transfer must not show (expiry carries over, OQ-43).
- Nav badge:
  - `AppShell.tsx` wraps `ShellWithBadge` in `RequestBadgeProvider`, calls `useRequestBadge(pathname)`, passes `badges={{ myRequests: count }}` to `AppShellView`.
  - Generic `Partial<Record<NavId, number>>`; `badgeText(n)` null at 0, number up to 9, then "9+".
  - Visible numeral `aria-hidden`; `sr-only` text `shellCopy.badge.newDecisions(count)` ("N new decision(s)"), hard-wired to requests.
  - `useRequestBadge` fetches `api.mine(undefined, 1)` and takes `.unseen`; refreshes on mount, pathname change, window focus, visibilitychange; no polling (D24); failed fetch keeps the old count; a `seq` ref drops older responses.
  - Pages push a value with `useSetRequestBadge()`.
- Refetch: `useDevices` exposes `reload` (skeleton) and `refresh` (no skeleton). Dialogs call `onStale` (refresh) or `onDone` (close, refresh, sometimes `headingRef.focus()`).

## Recommendations
1. **DTO and API shape.**
   - Add to `DeviceDto`: `canTransfer: boolean` (owned, no pending handoff, caller is owner or Manager+) and `pendingTransfer: { id, to: {id, displayName}, from..., note, createdAt } | null`.
   - A server flag `canCancelTransfer` is safer than deriving it (keeps "sender or Manager+" in one place).
   - Make `canAssign`, `canDelete`, `canPlace`, `canEditHolding` false while a handoff is pending (cheaper than a 409); same for `placeModes` if it does not read `canPlace` alone.
   - Separate `GET /api/transfers/incoming` returning `{items, count}` (id, device name, inventory number, type, sender display name, note, `createdAt`). Do not filter the device list for this: the recipient is not the owner.
2. **Transfer dialog (`TransferDeviceDialog.tsx`, new).**
   - Same structure as `AssignInner`: `EntityFormDialog`, `MemberPickerFields` with `occupantId = device.owner.id`, `useMemberPicker(seatsApi.activeMembers)`.
   - Keep the note textarea and counter: split `AssignDeviceFields` into a shared `NoteField` instead of duplicating; no expiry fieldset.
   - Key `${device.id}` like `AssignDeviceDialog`.
   - Pure `transfer-device.ts` mirroring `assign-device.ts`: `toTransferBody(form, memberId)` → `{memberId, note|null}` via `cleanNote`; `settleTransfer(result)` → done / error with `stale` and `reloadMembers`.
   - Codes: stale (refresh) `handoff_pending`, `not_owner`/`not_allowed`, `not_found` (done, as assign); `member_not_assignable` reloads the picker; `invalid_request` generic text.
   - Row action `Transfer` in `device-actions.ts` (`onTransfer`, key "transfer", aria `Transfer device <inv>`) gated by `canTransfer`, after Place/Move/Return and before Edit.
3. **Pending state on the row.**
   - In or next to `OwnerLabel`: `Chip` "Transfer pending" plus "To <name>" (recipient normally uses the incoming list).
   - Pending text as a pure function in `devices-state.ts` (unit tested).
   - `Cancel transfer` row action (aria `Cancel transfer of device <inv>`) when `canCancelTransfer`; direct one-click with busy state and inline error, or a small confirm like `DeleteDeviceDialog` only if the plan wants one.
   - Chip is text, not colour only.
4. **Incoming list on the Devices page.**
   - New pure `IncomingTransfers.tsx` (props only) above the filters in `DevicesView`, or as a sibling in `DevicesPage` so `DevicesView` props do not balloon.
   - Props: `incoming: {status, items, errorCode}`, `onConfirm(id)`, `onDecline(id)`, `busyId`.
   - `section` with `aria-labelledby` → h2; each `li` "<Device name> (<inv>) from <sender>" + note + Confirm and Decline; aria-labels with the inventory number (`Confirm receipt of device <inv>`).
   - Nothing (or a short hint) when empty; no "no transfers" card on every load.
   - Decline `variant="tonal"`, Confirm primary.
   - Hook `useIncomingTransfers(api)` (like `useDevices`, with a counter to drop stale answers) with `refresh`.
   - Errors: 409 (stale/cancelled) inline "This transfer is no longer available" + refresh; `not_found` = done; network error keeps the item and shows the error.
5. **Permissions and 401/403.** Server returns domain 409/422 for "not the recipient" (R7); the UI handles 401/403 only through `apiFetch`.
6. **Nav badge.**
   - `badges={{ myRequests, devices: incomingCount }}` (the `devices` nav id exists and is visible to `user`).
   - Separate counter: `useIncomingTransferBadge(pathname)` + `useSetIncomingTransferBadge()` in `src/ui/devices/` (or generalize `requests/useRequestBadge.tsx` into `ui/badges`); `TransferBadgeProvider` nested in `AppShell`.
   - Same lifecycle (mount, pathname, focus, visibility, `seq` guard, no polling); fetch `GET /api/transfers/incoming?limit=1` (or `/count`) reading `.count`.
   - Fix sr-only text: per-id lookup `shellCopy.badge.byNav[item.id]?.(count)` with `incomingTransfers: (n) => n === 1 ? "1 incoming transfer" : "N incoming transfers"`; keep `newDecisions` for `myRequests`.
   - After Confirm/Decline, call the badge setter with the new count (as `MyRequestsPage`) and refresh; Confirm also refreshes the device list.
   - Cap with `badgeText` as is.
7. **Refetch after mutations.** Start: close, `refresh()`, focus the row's Cancel/Transfer button or the heading. Cancel: `refresh()`, focus heading or next action. Confirm/Decline: refresh incoming, devices and badge. `onStale` → `refresh()`.
8. **Copy files.**
   - `src/ui/copy/devices.ts`: `actions.transfer`, `actions.transferAria`, `actions.cancelTransfer`, `actions.cancelTransferAria`; a `transfer` block (titles, submit, recipient/note labels, hint, errors); pending chip text; an `incoming` block (heading, empty, Confirm, Decline, aria functions, stale message, "from X" line).
   - `src/ui/copy/shell.ts`: badge sr-only text.
   - `src/ui/copy/api.ts`: messages for new codes (e.g. `transfer_not_pending`, `recipient_invalid`); reuse existing ones.
   - `src/ui/copy/seats.ts`: maybe a generic "(you)"/"(owner)" label if `pickerSitsHere` handling changes.
   - All UI copy in `src/ui/copy/**` (D36).
9. **Focus and a11y.** `EntityFormDialog` handles focus/Escape. Confirm/Decline removes the item: focus the next item's first button, or the section heading (`tabIndex -1`) when empty. Announce count changes via a stable `aria-live="polite"` element (like `listSummary`). Chip has a text label. Per-device aria-labels on Cancel. Nav numeral `aria-hidden` with `sr-only` text.

## Tests
- **Changes.**
  - `AppShellView.test.tsx`: badge cases (~144-170) assume `newDecisions`; add `devices: n` → "N incoming transfer(s)", `devices: 0`/undefined → nothing.
  - `device-actions.test.ts`: Transfer and Cancel actions, ordering, flag gating incl. "no actions while pending".
  - `DevicesView.test.tsx`: factory gets the new fields; cases for the pending chip, Transfer and Cancel buttons; incoming list happy path if `DevicesView` gains props.
  - Every test building a `DeviceDto` literal must get the new fields (`PlaceDeviceDialog.test.tsx`, `AssignDeviceDialog.test.tsx`, `DeleteDeviceDialog.test.tsx`, `delete-device-flow.test.ts`, `devices-state.test.ts`, `assign-device.test.ts`, route tests; check with `pnpm typecheck`).
  - `devices-api.test.ts`: transfer start, cancel, confirm, decline, incoming (path, method, body).
  - If `MemberPickerFields` signature changes: `MemberPickerDialog` and `AssignDeviceDialog` tests.
- **New.** `transfer-device.test.ts` (body: trim/NFC note, null when empty, no memberId; `settleTransfer` mapping); `TransferDeviceDialog.test.tsx` (static markup); `IncomingTransfers.test.tsx` (items, labels, busy, empty, error); a hook-free test for the badge count source.
- Keep views pure (props only, `renderToStaticMarkup`) and logic in `.ts` files.

## Risks
- DTO/API drift between this ticket's server and UI work: fix field names and error codes in the plan before coding.
- After Confirm the recipient's list must `refresh` (not `reload`, to avoid a flash).
- Badge staleness without polling (D24): count updates on navigation, focus or visibility — acceptable, state it in the plan.
- Do not reuse the request badge context: separate provider.
- `canTransfer: false` hiding is UX only; server authoritative (R7); stale clicks give 409 + refresh.
- "sits here" picker label bug if not overridden.
- `AssignDeviceFields` always renders the expiry fieldset: splitting it touches an existing component and its tests.
- Double-click on Confirm: disable while busy (`busyId`); treat a second 409 as "already handled" and refresh.

## Open questions (defaults)
1. Cancel needs a confirm dialog? Default no: direct button with busy state.
2. Incoming list location? Default: section above the filter chips, only when there are items.
3. Count endpoint vs list with `limit=1`? Default: list endpoint returns `{items, count}`; badge calls it with `limit=1`.
4. Manager+ cancelling someone else's transfer sees "To <name>"? Default yes, for everyone who can see the device.
5. Pending info visibility: default org-wide (owner already visible to all; note follows the holding note's org-wide visibility — Ming's call).
6. `canTransfer` and `pendingTransfer` on `DeviceDto` rather than a second fetch per row? Default yes.

Files read: `src\ui\devices\{DevicesPage,DevicesView,DeviceTable,DeviceRowActions,device-actions,AssignDeviceDialog,assign-device,devices-api,useDevices}.ts(x)`, `src\ui\copy\devices.ts`, `src\ui\AppShell.tsx`, `src\ui\AppShellView.tsx`, `src\ui\requests\useRequestBadge.tsx`, `src\ui\requests\request-badge.ts`, `src\ui\seats\MemberPickerDialog.tsx`, `src\lib\devices\types.ts`, `src\lib\nav.ts`.
