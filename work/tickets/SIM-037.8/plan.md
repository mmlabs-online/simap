Status: READY

# Plan — SIM-037.8: Devices UI: transfer dialog, incoming transfers and nav badge (slice 1 of 2: sender side)

This plan covers **slice 1** only (see `## Split proposal`): the Transfer row action and dialog, the pending state on
the row and card, and Cancel transfer, with stale handling for those two writes. The recipient side (incoming list,
Confirm / Decline, nav badge) is slice 2 (new ticket SIM-037.9). The whole ticket is about 750 changed production lines,
well over one implement/review cycle.

**High path: none.** Every file is under `src/ui/**` (plus their tests). No `src/server/**`, `src/app/api/**`, `db/**`,
config or deploy file is touched. Expected PR tier: Medium. The ticket has Gate `plan-approval` (P1), so Ming approves
this plan, including the split and assumptions A1 to A12.

## Scope summary
- `docs/spec-v1.md` §6 DEV-08 (lines 317-325):
  - "Any owner (every role) starts a transfer of their own device to another active member of the org, with an
    optional note. A Manager+ may start one for any owned device." (slice 1)
  - "Until the recipient confirms, nothing changes: the device stays with the sender and keeps its seat. The sender
    (or a Manager+) can cancel; the recipient can decline." (slice 1: cancel; slice 2: decline)
  - "When the recipient confirms receipt … lands in the recipient's inventory, not placed" and "The recipient sees
    pending transfers to them (badge in the nav, list on the Devices page)." (slice 2)
- DEV-02: "Every device list and device detail shows … any pending transfer or return." (pending chip, slice 1)
- `work/decisions.md` D36: "all user-facing text lives in copy files". D63: devices have an owner or are in the org
  inventory (an org-inventory device has no Transfer).
- Ticket scope bullets 1 and 2 (slice 1): "Transfer dialog (member picker with the owner disabled, note; no expiry) and
  a Transfer row action gated by `canTransfer`." / "Pending state on the device row and card ("Transfer pending", "To
  <name>") and a Cancel transfer action for the sender or Manager+." Bullets 3 and 4 go to slice 2.
- Ticket technical notes: "the picker's disabled-option label "sits here" must be overridden for transfers;
  `AssignDeviceFields` bundles the expiry fieldset (extract a shared note field)."
- API contract fixed by SIM-037.3 (merged, `work/tickets/SIM-037.3/plan.md` "API contract" and
  `src/lib/devices/types.ts:76-125`):
  - `DeviceDto.canTransfer` and `DeviceDto.pendingHandoff: PendingHandoffDto | null`, where `PendingHandoffDto` is
    `{ id, kind, to: MemberRef | null, requestedBy, createdAt, canCancel }`. It has no `from` and no note: the sender is
    the device's `owner`.
  - `POST /api/devices/:id/handoffs` with `{ kind: "transfer", toMemberId, note }`. It returns 201 `HandoffDto`, or 404
    `not_found`; 422 `not_allowed`, `device_unowned`, `invalid_recipient`, `member_not_assignable`; 409
    `handoff_pending`.
  - `POST /api/handoffs/:id/cancel` returns 200 `HandoffDto`, or 404 `not_found`, 422 `not_allowed`, 409
    `handoff_not_pending`.
  - While a handoff is pending, `canAssign`, `canDelete` and `canTransfer` are false. `canPlace`, `canEdit` and
    `canEditHolding` stay as they were (037.3 A9).
  - Every one of these codes already has a message in `src/ui/copy/api.ts:24-48`.

## Acceptance criteria → verification
Ticket AC 1, 2, 4 (start and cancel) and 5 are in this slice. AC 3, and AC 4 for Confirm / Decline, go to slice 2.

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | An owner sees Transfer on their own owned devices without a pending handoff; a Manager+ on any owned device; nobody on org-inventory devices. | The UI shows Transfer exactly when the server's `canTransfer` is true; 037.3 tests the flag (`devices.db.test.ts › pending transfer`). `src/ui/devices/device-actions.test.ts › transfer: shown only when canTransfer and onTransfer`, `› transfer: placed after place/move/return and before edit`, `› transfer: aria "Transfer device <inv>"`, `› org-inventory fixture (owner null, canTransfer false): no transfer`. |
| 2 | Starting a transfer shows the device as "Transfer pending" to the named recipient; the sender or a Manager+ can cancel it. | `src/ui/devices/devices-state.test.ts › pendingText` (transfer → chip + "To <name>"; null handoff → null; `to` null → chip only). `src/ui/devices/DevicesView.test.tsx › pending transfer: chip and "To Hương" in table and card`, `› Cancel transfer button with aria "Cancel transfer of device <inv>" when canCancel`, `› no Cancel when canCancel false`. `device-actions.test.ts › cancelTransfer first, gated by pendingHandoff.canCancel and kind transfer`, `› busyId disables every action of that row only`. `src/ui/devices/transfer-device.test.ts › toTransferBody …`, `› cancelOutcome ok → status notice, refresh`. `src/ui/devices/devices-api.test.ts › startTransfer`, `› cancelHandoff`. Manual: see Ming verification. |
| 4 | A stale action shows a message and refreshes instead of failing silently (start and cancel). | `transfer-device.test.ts › settleTransfer: handoff_pending / not_allowed / device_unowned / invalid_recipient → error + stale`, `› member_not_assignable → error + reloadMembers`, `› not_found → done`, `› unavailable → error, no stale`. `› cancelOutcome: handoff_not_pending and not_found → status "no longer available" notice + refresh`, `› not_allowed → error notice + refresh`, `› auth codes and unavailable → error notice, no refresh`. `DevicesView.test.tsx › notice region is always mounted; error tone has role=alert`. |
| 5 | All new strings live in `src/ui/copy/*` (D36). | Reviewer reads the diff: no string literal shown to the user in `.tsx` / `.ts` outside `src/ui/copy/**`. Tests import the copy objects rather than repeating the text. |
| 6 | Checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. `pnpm test:db` is unaffected (no server change). |

## Ming verification after merge
- With two accounts in one org (A owner, B recipient) on a local or staging run:
  1. A opens Devices, clicks Transfer on an owned device, picks B, adds a note with diacritics, and sends. The row then
     shows "Transfer pending · To B" and Cancel transfer, and Transfer, Assign and Delete are gone.
  2. A clicks Cancel transfer. The row goes back to normal and the notice says the transfer was cancelled.
  3. Start the transfer again. A Manager (C) sees Cancel transfer on A's device and can cancel it.
  4. Stale case: open the page in two tabs, cancel in one, then click Cancel in the other. A message appears and the
     list refreshes.
- Confirming as B needs slice 2. Until then, B can confirm through the API, or A cancels.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/copy/devices.ts` (lines 18-33, 68-85, end) | `actions.transfer`, `transferAria`, `cancelTransfer`, `cancelTransferAria`. New `transfer` block: `title`, `submit`, `currentOwner`, `ownerSuffix` ("current owner"), `recipients` ("Transfer to"), `note`, `noteHint`, `expiryHint`, `nextBefore`, `nextAfter(name)`, `errors.invalid`, `sent(name, inv)`, `cancelled(name, inv)`, `gone`. New `pending` block: `chip`, `to(name)`. | D36. | No |
| `src/ui/copy/seats.ts` | Nothing, unless the implementer needs a new key. The picker defaults stay in `seatsCopy.actions` (`pickerSitsHere` line 112, `pickerList`). | Listed so the reviewer expects no change. | No |
| `src/ui/devices/NoteField.tsx` (new) | `NoteField({ value, onChange, label, hint })`: the label, textarea, hint and counter, moved from `AssignDeviceDialog.tsx:66-85` with the same markup. | Shared by assign and transfer (ticket technical notes). | No |
| `src/ui/devices/AssignDeviceDialog.tsx` (lines 53-85) | Render `<NoteField label={copy.note} hint={copy.noteHint} …>` in place of the inline note block. The output stays byte-identical. | Extraction. | No |
| `src/ui/seats/MemberPickerDialog.tsx` (lines 21-39, 55, 79) | Optional `occupantLabel?: string` (default `copy.pickerSitsHere`) and `listLabel?: string` (default `copy.pickerList`) on `MemberPickerFields`. | The "sits here" label is wrong for a transfer. | No |
| `src/ui/devices/transfer-device.ts` (new) | Pure helpers: `TransferForm`, `emptyTransferForm`, `toTransferBody`, `settleTransfer`, `cancelOutcome` (see Approach 3). | Pure logic first. | No |
| `src/ui/devices/transfer-device.test.ts` (new) | Unit tests. | R5. | No |
| `src/ui/devices/TransferDeviceDialog.tsx` (new) | Pure `TransferDeviceFields` plus `TransferDeviceDialog` (keyed by device id; `EntityFormDialog`, `useMemberPicker(seatsApi.activeMembers, reloadToken)`, as `AssignInner` lines 133-223). | Ticket scope bullet 1. | No |
| `src/ui/devices/TransferDeviceDialog.test.tsx` (new) | Static markup of `TransferDeviceFields`. | Ticket test plan "Markup: TransferDeviceFields". | No |
| `src/ui/devices/devices-api.ts` (lines 1-10, 49-56, 57-125) | `startTransfer(id, body: HandoffStartValue)` sends POST `/api/devices/:id/handoffs`; `cancelHandoff(handoffId)` sends POST `/api/handoffs/:id/cancel`. Both return `DevicesResult<HandoffDto>` through a new `oneHandoff` reader (checks that `id` is a string). | Endpoints from 037.3. | No |
| `src/ui/devices/devices-api.test.ts` | Path, method, body, `encodeURIComponent`, error-code passthrough for both. | R5. | No |
| `src/ui/devices/device-actions.ts` (lines 6-21, 30-77) | `DeviceRowHandlers` gains `onTransfer?` and `onCancelTransfer?`. `RowAction` gains `disabled?`. `rowActions(d, h, busyId?)` puts `cancelTransfer` first (when `pendingHandoff?.kind === "transfer" && canCancel`) and `transfer` after the place modes, before `edit` (when `canTransfer`). When `busyId === d.id`, every action of that row is disabled. `hasAnyAction` is unchanged in meaning. | Ticket scope bullets 1 and 2. | No |
| `src/ui/devices/device-actions.test.ts` | Cases in the AC table. | R5. | No |
| `src/ui/devices/DeviceRowActions.tsx` (lines 6-28) | Optional `busyId` prop passed to `rowActions`, and `disabled={a.disabled}` on the Button. | Busy state for Cancel. | No |
| `src/ui/devices/devices-state.ts` (after line 31) | `pendingText(d): { chip: string; to: string \| null } \| null`. It returns null unless `pendingHandoff?.kind === "transfer"`. | Pure pending text (ticket test plan). | No |
| `src/ui/devices/devices-state.test.ts` | `pendingText` cases. | R5. | No |
| `src/ui/devices/DeviceTable.tsx` (lines 33-56, 84-160) | `OwnerLabel` renders `Chip` (pending chip) and a `text-xs text-on-surface-variant` "To <name>" line under the owner name and above the expiry line. `DeviceTable` gets an optional `busyId` prop and passes it to both `DeviceRowActions`. | One place for table and card. | No |
| `src/ui/devices/DevicesView.tsx` (lines 12-23, 37-65, 105-107) | New optional props `busyId` and `notice: { tone: "status" \| "error"; text: string } \| null`. A notice region stays mounted under the heading (Approach 5). `busyId` is passed to `DeviceTable`. | Feedback and stale messages (AC 4). | No |
| `src/ui/devices/DevicesView.test.tsx` | Pending chip, Transfer / Cancel buttons and the notice region (factory already has `canTransfer`, `pendingHandoff`, line 34). | R5. | No |
| `src/ui/devices/DevicesPage.tsx` (lines 22-116) | State `transferring: DeviceDto \| null`, `cancellingId`, `notice`. Handlers `onTransfer` and `onCancelTransfer`. Mount `TransferDeviceDialog`. Clear the notice when another action starts. Focus as in Approach 6. | Wiring. | No |
| `src/ui/seats/MemberPickerDialog.test.tsx` | `› default disabled label still "sits here"`, `› occupantLabel and listLabel override`. | Shared component changed. | No |

`src/ui/devices/AssignDeviceDialog.test.tsx` must pass **unchanged**. That is the proof that the `NoteField` extraction
kept the markup.

## Data model / migration
None.

## API contract
None changed. The UI consumes the SIM-037.3 endpoints exactly as merged (see Scope summary). No route, DTO or error code
is added.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/devices/transfer-device.test.ts › toTransferBody` | memberId null → invalid `seatsCopy.actions.pickerNone`. Body is `{ kind: "transfer", toMemberId, note }`. Blank or whitespace note → `note: null`. CRLF → LF. Decomposed Vietnamese note `"Chuyển máy cho Hương"` (NFD in) → NFC out. 500 code points ok. 501 → invalid `devicesCopy.assign.errors.noteInvalid`. Non-canonical member id → invalid with the generic message. |
| `transfer-device.test.ts › settleTransfer` | ok → done. `not_found` → done. `handoff_pending`, `not_allowed`, `device_unowned`, `invalid_recipient` → error with `apiErrorMessage(code)` and `stale: true`. `member_not_assignable` → error and `reloadMembers: true`, `stale: false`. `invalid_request` → `transfer.errors.invalid`. `unavailable` / `internal` → error, no stale, no reload. |
| `transfer-device.test.ts › cancelOutcome` | ok → `{ refresh: true, notice: status cancelled(name, inv) }`. `handoff_not_pending` and `not_found` → `{ refresh: true, notice: status transfer.gone }`. `not_allowed` → `{ refresh: true, notice: error apiErrorMessage }`. `unauthenticated` / `forbidden` / `member_deactivated` / `org_required` / `unavailable` → error notice, `refresh: false`. |
| `src/ui/devices/devices-state.test.ts › pendingText` | null handoff → null. Transfer with `to` → `{ chip, to: "To Hương" }` (diacritics kept). `to` null → `{ chip, to: null }`. Kind `return` / `extension` → null (037.4 / 037.5 add their texts). |
| `src/ui/devices/device-actions.test.ts › transfer` | Shown only with the handler and `canTransfer`. Order `… return, transfer, edit, delete`. aria `Transfer device INV-1`. `run` calls `onTransfer(d)`. The org-inventory fixture has none. |
| `device-actions.test.ts › cancelTransfer` | Shown only with the handler, `pendingHandoff.kind === "transfer"` and `canCancel`. It comes first. aria `Cancel transfer of device INV-1`. Not danger. `run` calls `onCancelTransfer(d)`. |
| `device-actions.test.ts › busyId` | `busyId === d.id` → every action `disabled: true`. Another id → none disabled. |
| `src/ui/devices/DevicesView.test.tsx › pending transfer` | Chip text and "To <name>" appear twice (table and card). The Cancel button has its aria-label. No Transfer button while pending (fixture `canTransfer: false`). The owner name is still shown. |
| `DevicesView.test.tsx › notice` | No notice → an empty live region is still in the markup. Status notice → `role="status"` with the text. Error notice → `role="alert"`. |
| `src/ui/devices/TransferDeviceDialog.test.tsx › TransferDeviceFields` | Current-owner line with the owner's name. Radiogroup `aria-label` "Transfer to". The owner's option is `disabled` and reads "(current owner)", never "sits here". No `type="date"` input and no expiry legend. Expiry hint present. Note label, hint and `0/500` counter. "What happens next" text before selection, and the named variant after selection, linked via `aria-describedby`. |
| `src/ui/devices/devices-api.test.ts › startTransfer / cancelHandoff` | POST `/api/devices/d%2F1/handoffs` with JSON body and content-type. POST `/api/handoffs/h1/cancel` with no body. Non-ok → `{ ok: false, code }`. Malformed body → `internal`. |
| `src/ui/seats/MemberPickerDialog.test.tsx › labels` | Default "sits here" and `pickerList` unchanged. Overrides render. |

## Approach
1. **Copy first** (`src/ui/copy/devices.ts`). Wording from the ux consult:
   - `transfer.title` "Transfer device"; `submit` "Send transfer"; `currentOwner` "Current owner"; `ownerSuffix`
     "current owner"; `recipients` "Transfer to".
   - `note` "Note for the recipient"; `noteHint` "Optional. The recipient sees it with the transfer." (A6).
   - `expiryHint` "The current expiry date, if any, stays with the device."
   - `nextBefore` "The recipient must confirm before the device moves. Until then it stays with you, marked as
     "Transfer pending". You can cancel at any time."
   - `nextAfter(name)` "<name> will see this in Devices and must confirm. Until they do, the device stays where it is.
     After they confirm it goes into their inventory, not placed on a seat." ("stays where it is", not "stays yours",
     because a Manager+ may be the sender, A3.)
   - `sent(name, inv)` "Transfer of <name> (<inv>) sent. It waits for the recipient to confirm."
   - `cancelled(name, inv)` "Transfer of <name> (<inv>) cancelled."
   - `gone` "This transfer is no longer available. The list has been refreshed."
   - `pending.chip` "Transfer pending"; `pending.to(name)` "To <name>".
2. **`NoteField` extraction.** Move the note block out of `AssignDeviceFields` into `NoteField.tsx`, keeping
   `useId` for the note, hint and count ids and `noteLength` from `assign-device.ts`. `AssignDeviceFields` renders it
   in the same place. Run `AssignDeviceDialog.test.tsx` before going on.
3. **Pure helpers (`transfer-device.ts`).**
   - `toTransferBody(form, memberId)`: if memberId is null, return invalid. Otherwise call
     `validateHandoffStart({ kind: "transfer", toMemberId: memberId, note: form.note })` from
     `src/lib/validate/device.ts:201`, which is the same validator as the server (NFC, trim, blank → null, 500 limit).
     Map `field` to a message: `note` → `noteInvalid`, `toMemberId` → `pickerNone`, anything else →
     `transfer.errors.invalid`.
   - `settleTransfer(result)` mirrors `settleAssign` (`assign-device.ts:96-112`) with
     `STALE = ["handoff_pending", "not_allowed", "device_unowned", "invalid_recipient"]`.
   - `cancelOutcome(result, device)` mirrors `requests-state.ts:60-92`, with a local `AUTH_CODES` list as there.
     Codes that mean nothing changed (auth, `unavailable`, `internal`, `invalid_request`) do not refresh.
4. **Dialog (`TransferDeviceDialog.tsx`).**
   - `TransferDeviceFields` (props only), top to bottom:
     1. The current-owner line, using the holder-line markup of `AssignDeviceDialog.tsx:61-64`.
     2. `MemberPickerFields`, with `occupantId = device.owner?.id ?? null`,
        `occupantLabel = devicesCopy.transfer.ownerSuffix` and `listLabel = devicesCopy.transfer.recipients`.
     3. `NoteField`.
     4. The expiry hint `<p>`.
     5. The "what happens next" `<p id>`, wired through `aria-describedby` on the radiogroup wrapper. It is static
        text, not `aria-live`.
   - `TransferDeviceDialog` is mounted only while open and keyed `${device.id}`. Submit: `selectedMember(picker.state,
     occupantId)` → `toTransferBody` → `devicesApi.startTransfer` → `settleTransfer`. Then:
     - done → `onDone(device)`;
     - stale → keep the dialog open with the message and call `onStale()` (refresh);
     - reloadMembers → bump `reloadToken`, which reloads the picker as the assign dialog does.
   - A network error keeps the dialog and the form.
5. **Rows and cards.**
   - `rowActions` gets the two new actions (step order as in the Files table). Gating uses only the server flags; there
     is no client re-check (R7: the server stays the authority).
   - `OwnerLabel` shows `pendingText(d)`. The chip is text, not colour only.
   - `DevicesView` renders one always-mounted region directly under the header row:
     `<div aria-live="polite">{notice && (error ? <p role="alert"…> : <p role="status"…>)}</div>`, styled as
     `MyRequestsView.tsx:43-52`.
6. **Page wiring (`DevicesPage.tsx`).**
   - `onTransfer: (d) => { setNotice(null); setTransferring(d); }`.
   - `onDone(d)`: close, set the `sent` notice, then `void refresh().then(() => headingRef.current?.focus())`. The
     trigger button re-renders into Cancel, so focus goes to the heading.
   - `onCancelTransfer(d)`:
     1. Return at once if `cancellingId !== null`.
     2. Set `cancellingId = d.id` and clear the notice.
     3. Call `cancelOutcome(await api.cancelHandoff(d.pendingHandoff.id), d)` and set the notice.
     4. If the outcome says refresh, `await refresh()`.
     5. Clear `cancellingId` and focus the heading.
   - A second click while busy is ignored (the buttons are disabled). A 409 after a race shows `gone`.
   - Every existing dialog's `onDone` / `onStale` stays as it is. Opening any other dialog clears the notice.
7. **Checks.** `pnpm format`, then all Checks.

Rules:
- R1: only `src/ui/**` and `@/lib/**` imports. `validateHandoffStart` is in `src/lib/validate`, which is allowed from
  ui. `pnpm check:layers` confirms.
- R3: no config.
- R4: only the files above. Slice 2 items stay out.
- R5: tests above.
- R7: the UI handles 401/403 only through `apiFetch`. Domain codes come from 037.3.
- D36: all text in `src/ui/copy/devices.ts`.

## Specialist input used
- **ux-architect** (`consult-ux-architect.md`):
  - Adopted:
    - §1: dialog structure, the "Transfer to" label, `occupantLabel` "current owner", no expiry plus the one hint, the
      static "what happens next" paragraph, "Send transfer", `NoteField` with identical markup, the pure
      `transfer-device.ts`.
    - §2: chip plus "To <name>" in `OwnerLabel`; the note not on the row; Cancel first, tonal, no confirm dialog, busy
      via `busyId`; Transfer after Place/Move/Return and before Edit; no client re-check.
    - §6: start-dialog code handling.
    - §7: focus the heading after a transfer or cancel, once the refresh resolves; one stable live element.
  - Changed:
    - "From <owner> to you" for the recipient is dropped. `DeviceDto` has no caller member id, so the UI cannot tell
      that `to` is the caller (`mine` only covers ownership). The recipient gets the incoming list in slice 2.
    - The cancel error goes to the page notice region (`role="alert"`), not to a separate alert next to each row, so
      the page has one place for messages.
    - `nextAfter` says "stays where it is" (a Manager+ sender is not the owner).
    - The transfer note hint says who sees it, because the existing "Visible to everyone" hint is wrong for a handoff
      note (037.3 A11).
  - Deferred to slice 2: §3 incoming section, §4 nav badge and per-nav sr-only text, §5 Confirm feedback, the §6 / §7
    parts for Confirm / Decline.
- **frontend-developer** (`consult-frontend-developer.md`, read with the 037.3 names):
  - Adopted: §2 dialog mirroring `AssignInner`, keyed by device id; §3 pending text as a pure function in
    `devices-state.ts`; §8 copy keys; tests list (fixtures already carry the new fields since 037.3).
  - Changed: `toTransferBody` returns the 037.3 body `{ kind, toMemberId, note }`, not `{ memberId, note }`. Stale
    codes follow the merged list (`not_owner` does not exist; `device_unowned` and `invalid_recipient` do).
  - Deferred to slice 2: §4 incoming list, §6 badge.

## Assumptions
For Ming to approve with the plan. These are the consultants' defaults unless a note says otherwise.
- **A1 Split.** This PR is the sender side only. The recipient side is SIM-037.9 (see Split proposal). Between the two
  merges, a started transfer can only be cancelled (or confirmed through the API). Ming does not cut a release in
  between.
- **A2 Cancel has no confirm dialog.** It is a direct tonal button with a busy state. The action is reversible: start
  again.
- **A3 Manager+ sees the same pending line** "Transfer pending · To <name>" and Cancel transfer on any device
  (`canCancel` from the server).
- **A4 The pending line is org-wide**: everyone who sees the device sees the chip and the recipient's name (DEV-02,
  037.3 A11). The transfer note is never on the row.
- **A5 No "to you" variant** on the row, for the recipient, in this slice (no caller member id in `DeviceDto`).
- **A6 Transfer note hint**: "Optional. The recipient sees it with the transfer." It replaces the assign hint
  "Visible to everyone in your organization."
- **A7 The success notice persists** until the next action on the page. It does not time out.
- **A8 Focus after a transfer or cancel** goes to the page heading, after the refresh resolves.
- **A9 Stale start** (`handoff_pending`, `not_allowed`, `device_unowned`, `invalid_recipient`): the dialog stays open
  with the message and the list refreshes behind it. `not_found` closes the dialog and refreshes.
- **A10 Pending kinds.** Only `kind: "transfer"` gets text and Cancel now. Return and extension texts come with
  SIM-037.4 / SIM-037.5.
- **A11 Wording** as in Approach 1 (English, D36). Ming may reword in review.
- **A12 Hotspots.** No other ticket is IN_PROGRESS, REVIEW or DONE (board line 84 shows only this one PLANNING).
  SIM-037.4 / 037.5 will later edit `device-actions.ts`, `devices-state.ts`, `DeviceTable.tsx` and
  `src/ui/copy/devices.ts`. Slice 2 edits `DevicesPage.tsx` and `DevicesView.tsx`, so it should start after this
  slice merges.

## Blocking questions
None.

## Split proposal
Estimate for the whole ticket is about 750 production lines plus about 600 test lines:
- sender side about 340;
- recipient side about 410: the badge provider about 85, the incoming list, hook and state about 160, four API
  methods, outcomes, page wiring and the shell about 165.

That is more than one implement/review cycle, so the ticket splits along the sender / recipient line.

- **Slice 1, SIM-037.8 (this plan): sender side.** Transfer action and dialog, `NoteField`, picker label, pending chip,
  Cancel transfer, notice region. Covers ticket AC 1, 2, 4 (start and cancel) and 5. About 340 production lines and
  about 300 test lines. Medium tier.
- **Slice 2, new ticket SIM-037.9 "Devices UI: incoming transfers and nav badge".** Depends on SIM-037.8; Areas ui, ux;
  P1; Size M; Gate plan-approval; Medium tier. Covers ticket AC 3 and AC 4 for Confirm / Decline, AC 5, and Ming's
  manual "transfer between two accounts". Scope, from ux consult §3-§7 and frontend consult §4 and §6:
  - **API.** `devices-api` gets `incomingHandoffs()` (`GET /api/handoffs?box=incoming` → `{ items, truncated }`),
    `handoffCount()` (`GET /api/handoffs/count` → `{ incoming }`), `confirmHandoff(id)` and `declineHandoff(id)`.
  - **Incoming list.**
    - A pure `IncomingTransfers.tsx` in a slot prop of `DevicesView`, between the heading and the filter chips, shown
      only when there are items. It is a `<section aria-labelledby>` with h2 "Incoming transfers (N)" (`tabIndex -1`)
      and a hint.
    - Each item shows the name, `typeLine`, "From <from.displayName>" and the note, with "Confirm receipt" (primary)
      and "Decline" (tonal) buttons. Neither has a confirm dialog. aria-labels carry the inventory number and the
      sender.
    - Inline error with Retry. The hook `useIncomingTransfers` uses a sequence counter.
  - **Outcomes.** A pure `confirmOutcome` / `declineOutcome`.
    - Confirm success: "Device X (inv) is now in your inventory. It is not placed on a seat." If the current filter
      is `placed` or `unowned`, add "Switch the filter to All or Not placed to see it."
    - Decline: "Transfer of X declined".
    - Stale `handoff_not_pending` / `handoff_stale` / `not_found` → the `gone` notice. Every outcome refreshes the
      incoming list, the devices list and the badge.
  - **Focus.** Move to the next item's Confirm button. If none is left, move to the section heading, and if the
    section is gone, to the page heading. This happens after the refreshes resolve.
  - **Nav badge.**
    - `useHandoffBadge(pathname)`, a `HandoffBadgeProvider` and `useSetHandoffBadge()` in
      `src/ui/devices/useHandoffBadge.tsx`. These are a separate provider with the same lifecycle as
      `useRequestBadge.tsx`: mount, pathname, focus, visibilitychange, `seq` guard, no polling, and a failed fetch
      keeps the old count.
    - `AppShell` nests the provider and passes `badges={{ myRequests, devices }}`.
    - `AppShellView.tsx:100` uses a per-nav lookup `shellCopy.badge.byNav[item.id]`, with `devices` "1 incoming
      transfer" / "N incoming transfers" and `myRequests` keeping `newDecisions`. The sr-only text gives the true
      count, not "9+".
    - The badge stays stale until navigation, focus or visibility change (documented).
    - Optional refactor in slice 2: a generic count-badge factory shared with requests, if the reviewer prefers it to
      a second copy of about 85 lines.
