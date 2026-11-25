# Consult — ux-architect (2026-11-25)

SIM-037.8 UI consult (read-only; nothing edited)

## Findings
- **Row actions:** `rowActions` in `src/ui/devices/device-actions.ts` is a flat list of tonal `sm` buttons with a per-device aria-label; `DeviceRowActions` renders them in the md+ table and the mobile card; only `delete` is `danger`.
- **Owner cell:** `OwnerLabel` in `DeviceTable.tsx` is shared by table and card — the single place for the pending state.
- **Picker label:** `MemberPickerFields` disables the option equal to `occupantId` and appends the hard-coded `({copy.pickerSitsHere})` ("sits here", `src/ui/copy/seats.ts:112`) — wrong for a transfer.
- **Assign dialog:** `AssignDeviceFields` bundles the picker/holder line, the note (textarea, hint, counter) and the expiry fieldset; `AssignInner` passes `occupantId={null}`.
- **Focus:** `DevicesPage` keeps `headingRef` and focuses it after an assign or delete, once the refresh resolves.
- **Stale handling:** dialogs use `onStale` (`refresh`, no skeleton).
- **DTO fields:** grep capped at 60 lines found no `canTransfer`/`pendingHandoff` in `src/lib` — confirm the real shape in `src/lib/devices/types.ts`. `handoff-rules.ts` has `canCancelHandoff(tier, isFrom)` and a `{canCancel, canConfirm, canDecline}` helper, so the server can send per-handoff flags.

## Recommendations

**1. Transfer dialog** (new `TransferDeviceDialog`, `EntityFormDialog` shell like `AssignInner`, keyed by device id)
- Title "Transfer device"; subtitle `typeLine(name, inv)`.
- Top to bottom: (1) read-only "Current owner" line (assign dialog's holder-line markup); (2) "Transfer to" picker (search + radio list) — "Transfer to" as the group label instead of the seat-oriented `copy.pickerList`; (3) note: "Note for the recipient (optional)", existing hint and counter, 500 chars; (4) static "what happens next" paragraph.
- No expiry fieldset; one hint: "The current expiry date, if any, stays with the device."
- **Picker label fix:** optional `occupantLabel?: string` prop on `MemberPickerFields`, default `copy.pickerSitsHere`; transfers pass `devicesCopy.transfer.currentOwner` = "current owner" → "Name (current owner)".
- Disabled option: the parenthetical inside the label already gives the reason to screen readers.
- What the sender is told (static `<p>` linked via `aria-describedby`, no `aria-live`):
  - Before selection: "The recipient must confirm before the device moves. Until then it stays with you, marked as 'Transfer pending'. You can cancel at any time."
  - After selection: "<Name> will see this in Devices and must confirm. Until they do, the device stays yours. After they confirm it goes into their inventory, not placed on a seat."
- Submit "Send transfer"; surface "pick a member" through the body helper's invalid result, as assign does.
- **Shared note field:** extract `NoteField` (`value`, `onChange`, copy for the label) from `AssignDeviceFields`; keep assign markup byte-for-byte so `AssignDeviceDialog.test.tsx` passes untouched.
- **Pure `transfer-device.ts`:** `toTransferBody(form, memberId)` → `{kind:"transfer", toMemberId, note|null}` via `cleanNote`, invalid when memberId is null; `settleTransfer(result)` → done / error with `stale` and `reloadMembers`.

**2. Pending state on row and card**
- In `OwnerLabel`, below the owner name and above the holding line: `Chip` "Transfer pending" (text) + "To <recipient name>" (`text-xs text-on-surface-variant`).
- Pure `pendingText(d)` in `devices-state.ts`, unit tested; recipient's own view (if visible) "From <owner> to you".
- Owner label still shows the current owner; transfer note not on the row (recipient sees it in the incoming item). Note visibility org-wide is Ming's call.
- **Cancel:** row action `cancelTransfer` ("Cancel transfer", aria "Cancel transfer of device <inv>"), gated by the server flag on the pending handoff (whatever 037.3 shipped), not derived client-side; first among the row actions while pending; tonal (reversible); one click, no confirm dialog; busy via `busyId`; inline error in a `role="alert"` area near the actions.
- **Transfer button:** gated by `canTransfer`; after Place/Move/Return, before Edit; aria "Transfer device <inv>".
- While pending, Assign, Place, Delete, Edit-holding follow the server flags; no client re-check.

**3. Incoming transfers section**
- Above the filter chips and the table (inside `DevicesView` or a sibling in `DevicesPage`), only when there are items.
- `<section aria-labelledby>`, h2 "Incoming transfers (N)" with `tabIndex={-1}`; items in a `<ul>`.
- Item (`Card`, stacked on mobile, row at md+): bold device name; `type · inv number` via `typeLine`; "From <sender name>"; optional note quote-style, `whitespace-pre-line`, clamped; Confirm (primary) and Decline (tonal) right (md+) or below (mobile).
- Decline tonal, not danger; no confirm dialog for either.
- Wording: button "Confirm receipt"; aria "Confirm receipt of device <inv> from <sender>"; Decline aria "Decline transfer of device <inv> from <sender>"; hint under the heading "Confirming moves the device into your inventory. It is not placed on a seat."
- Empty: hide the section. Load failure: inline error with Retry inside the section.
- Hook `useIncomingTransfers(api)` with a sequence counter, `refresh`; `GET /api/handoffs?box=incoming`.

**4. Nav badge**
- `devices: incomingCount` in `badges`; new provider, separate from requests.
- Same lifecycle (mount, pathname, focus, visibilitychange, `seq` guard, no polling D24, failed fetch keeps the old count); `GET /api/handoffs/count` reading `.incoming`.
- Screen-reader text: `AppShellView` hard-wires `shellCopy.badge.newDecisions(count)` → per-nav-id lookup `shellCopy.badge.byNav[item.id]`; `devices` "1 incoming transfer" / "N incoming transfers"; `myRequests` keeps `newDecisions`. Numeral `aria-hidden`; sr-only uses the true count, not the capped "9+".
- Devices page pushes the new count through the setter after each action, as `MyRequestsPage`.
- Plan states the badge is stale until navigation, focus or visibility change.

**5. Feedback after Confirm**
- Stable `role="status"` / `aria-live="polite"` region at the top of the section area: "Device <name> (<inv>) is now in your inventory. It is not placed on a seat." Persists until the next action (or ~10 s); no vanishing toast.
- Then refresh devices (no skeleton), incoming list and badge.
- No "Place it" shortcut by default.
- If the current filter hides the device (e.g. "placed"): "Switch the filter to All or In inventory to see it."
- After Decline: "Transfer of <name> declined" in the same region.

**6. Errors and stale states**
- Domain refusals 409/422 (R7); 401/403 only via `apiFetch`.
- Stale (`handoff_not_pending`, already cancelled/confirmed/declined): inline "This transfer is no longer available. The list has been refreshed." + refresh list, devices, badge; for row Cancel put the message in an alert near the table.
- `not_found`: done, refresh, brief message. `not_allowed` (422): generic text + refresh.
- Start-transfer dialog: `handoff_pending`, `not_owner`, `not_allowed` stale → message, `onStale`, dialog stays open; `member_not_assignable` reloads the picker and clears the selection; network error keeps the dialog and form.
- `busyId` disables only that item's buttons; a second 409 after a double click reads as "already handled".
- All messages in `src/ui/copy/*` (D36); reuse existing handoff codes in `src/ui/copy/api.ts`.

**7. Focus and a11y after an item disappears**
- Confirm/Decline: focus the next item's Confirm; last item → section heading (`tabIndex -1`); section gone → page `headingRef`. Set focus after the refresh resolves (`void refresh().then(() => headingRef.current?.focus())`).
- Row Cancel: focus the page heading after refresh (safe default).
- Transfer dialog success: `headingRef.focus()` after refresh (the trigger re-renders into Cancel).
- One stable, always-mounted `aria-live="polite"` element (empty when idle).
- Chips carry text; nav numeral `aria-hidden` with sr-only text; aria-labels include the inventory number.

## Risks
- Verify the exact 037.3 DTO field names and codes in `src/lib/devices/types.ts` and `copy/api.ts` (earlier `pendingTransfer`, `/api/transfers` superseded).
- `MemberPickerFields` change affects `MemberPickerDialog` and `AssignDeviceDialog`: keep the prop optional with the old default.
- `NoteField` extraction touches `AssignDeviceFields`: keep markup identical.
- `AppShellView` sr-only change must keep `myRequests` text and the 0/undefined cases (tests ~144-170).
- Focus race: focusing before the refresh resolves lands on a node about to be replaced.
- Badge staleness without polling (D24): document.
- Every `DeviceDto` literal in tests needs the new fields.
- Hiding by flag is UX only: stale clicks need a visible message (AC 4).
- A recipient on the "placed" filter sees nothing after Confirm without the message in section 5.

## Open questions (defaults)
1. Transfer note on the row? Default: only in the incoming item and the sender's pending line.
2. Confirm dialog for Cancel? Default: none, busy state.
3. "Place it" shortcut after Confirm? Default: no.
4. Incoming list in `DevicesView` or `DevicesPage`? Default: sibling above `DevicesView` in `DevicesPage`.
5. Success message persists or times out? Default: persists until the next action.
6. Manager+ cancelling someone else's transfer sees "To <name>"? Default: yes.

Files read: `work/tickets/SIM-037.8/ticket.md`, `consult-frontend-developer.md`, `src/ui/devices/{AssignDeviceDialog.tsx,DeviceRowActions.tsx,device-actions.ts,DeviceTable.tsx,DevicesPage.tsx}`, `src/ui/seats/MemberPickerDialog.tsx`, `src/lib/devices/handoff-rules.ts`.
