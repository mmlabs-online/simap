Status: READY

# Plan — SIM-037.10: Devices UI: return dialog, pending returns and Admin take-back

## Scope summary
UI only. It binds to the SIM-037.4 API that is already on `main` (#95). No server, schema or High-path change.

`docs/spec-v1.md` §6 DEV-09 (lines 327-333):
> - The owner (or a Manager+) starts a return of an owned device to the org inventory, with an optional note.
> - Until an Admin confirms the device was received, nothing changes; the owner (or a Manager+) can cancel.
> - When an Admin confirms, in one transaction the device leaves its seat (if placed), loses its owner and is in the
>   org inventory. Admins see pending returns (badge in the nav, list on the Devices page).
> - An Admin can also take a device back directly, without a request (e.g. the owner was deactivated or removed,
>   OQ-44); the history records it as an Admin return.

DEV-02 (line 287): "Every device list and device detail shows where the device is ... and any pending transfer or return."

D63 (spec line 262-265): "'Return to inventory' from a seat (DEV-05, REG-03) moves a device into its owner's inventory; only DEV-09 gives it back to the org inventory."

OQ-44 default (spec line 704-706): "... an Admin can take the device back directly (DEV-09)."

D36 (spec line 604): all user-facing text lives in copy files.

D24: no polling. The badge refreshes on mount, on a route change, on focus and on visibility (`useHandoffBadge.tsx:43-46`).

**Merged contract used here** (checked on `main`):
- `POST /api/devices/:id/handoffs` `{kind:"return", note}`. Returns a `HandoffDto`. Refusals come from `decideReturnStart` (`src/lib/devices/handoff-rules.ts:60-73`): `not_allowed` 422, `device_unowned` 422, `handoff_pending` 409.
- `POST /api/devices/:id/take-back`. No body. Admin tier in the wrapper (`src/app/api/devices/[id]/take-back/route.ts:19`). Returns a `DeviceDto`. Refusals (`src/server/devices/handoffs.ts:524-601`): `device_unowned` 422, `handoff_pending` 409 (a pending return exists), `placement_changed` 409 (after one retry), `not_allowed` 422, `not_found` 404. A pending transfer is cancelled.
- `GET /api/handoffs?box=returns` is `user` tier. A non-Admin gets **422 `not_allowed`** (`handoffs.ts:613`).
- `GET /api/handoffs/count` returns `HandoffCountDto {incoming, returns}` (`src/lib/devices/types.ts:133`).
- Confirm and cancel use the existing `/api/handoffs/:id/{confirm,cancel}`. Return rules (`handoff-rules.ts:95-99`):
  - Confirm is Admin only. An Admin may confirm their own return.
  - A return is never declined.
  - Cancel is allowed for the `from` member or a Manager+.
  - Errors: `not_allowed` 422, `handoff_not_pending` 409, plus `placement_changed` on confirm (`handoffs.ts:433,474`).
- `DeviceDto.canReturn` and `canTakeBack` (`types.ts:78-81`) gate the actions. `canTakeBack` stays true while a transfer is pending, so "Cancel transfer" and "Take back" can appear on the same row. `PendingHandoffDto` (`types.ts:123-130`) has no note.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Owner or Manager+ can start and cancel a return from the Devices page; only Admins see Confirm | `device-actions.test.ts` › "giveBack only when canReturn", "cancelReturn vs cancelTransfer by kind". `return-device.test.ts` › `toReturnBody`, `settleReturn`, `cancelOutcome` per kind. `ReturnDeviceDialog.test.tsx` markup. `PendingReturns.test.tsx` › "Confirm only when canConfirm". `incoming-transfer.test.ts` › "handoffBoxes: non-Admin never lists returns". Local run as a User, then as an Admin. |
| 2 | Admins see each pending return (device, from, note) and confirm it; the device then shows as unowned | `PendingReturns.test.tsx` (device name, typeLine, "From X", note, Confirm, Cancel only when `canCancel`, empty renders nothing, error and Retry). `return-device.test.ts` › `confirmReturnOutcome` (notice, hint only under `placed`, stale codes). Local run: Admin confirms, and the row shows "Org inventory" with no seat. |
| 3 | Admin Take back works after a confirm dialog, including on a deactivated member's device | `device-actions.test.ts` › "takeBack when canTakeBack, also with a pending transfer, danger style". `TakeBackDeviceDialog.test.tsx` (owner name, seat or "not placed", transfer-cancel sentence only when a transfer is pending). `return-device.test.ts` › `settleTakeBack` codes. Local run: deactivate a member who owns a device, then Admin takes it back. |
| 4 | Admins see the number of pending returns in the Devices nav badge (summed with incoming transfers, aria breakdown) | `incoming-transfer.test.ts` › `badgeCountAfter` with two lists, `badgeTotal`. `shell.test` cases in `AppShellView.test.tsx` › "devices badge with returns: numeral is the sum, sr-only gives the breakdown". The existing devices-badge tests stay green. `devices-api.test.ts` › "handoffCount parses returns; a missing returns is 0". |
| 5 | All new strings live in `src/ui/copy/*` (D36) | The reviewer greps the new `.tsx` / `.ts` files under `src/ui/devices/` for string literals in JSX or notices. Every literal must be from `devicesCopy` or `shellCopy`. |

All checks green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Ming verification after merge
None. Everything can be checked in a local run with seeded data (`pnpm seed:dev`). Ming still does the manual run in the ticket's test plan as part of the PR review: return, then Admin confirm, then Admin take-back.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/devices/devices-api.ts` | Add `startReturn(id, note)`, which posts `{kind:"return", note}` to `/handoffs`. Add `takeBack(id)`, which posts to `/take-back` and reads `oneDevice`. Add `listHandoffs(box: HandoffBox)` (lines 143-153 generalised). Keep `incomingHandoffs = () => listHandoffs("incoming")` and add `pendingReturns = () => listHandoffs("returns")`. `handoffCount` (154-160) returns `HandoffCountDto`. A non-number `returns` becomes 0, and a missing `incoming` is still `internal`. | API client | No |
| `src/ui/devices/devices-api.test.ts` | Path, method and body tests for the new calls, plus count parsing | Test | No |
| `src/ui/devices/return-device.ts` (new) | Pure functions, listed in Approach step 2: `toReturnBody`, `settleReturn`, `confirmReturnOutcome`, `settleTakeBack`, `takeBackDone`, and the take-back body text helper | Pure logic first | No |
| `src/ui/devices/return-device.test.ts` (new) | Unit tests | Test | No |
| `src/ui/devices/transfer-device.ts` | `cancelOutcome(result, device, kind: "transfer" \| "return")` (57-76). Notices are per kind. | Kind-aware cancel | No |
| `src/ui/devices/transfer-device.test.ts` | Update the existing `cancelOutcome` calls to pass `"transfer"`, and add `"return"` cases | Test | No |
| `src/ui/devices/incoming-transfer.ts` | Export the existing `failed()` (19-27) as `handoffActionFailed`. `FocusTarget` section becomes `{kind:"section"; list: HandoffBox}`, and `focusAfter(before, id, after, list)`. `badgeCountAfter(count, incoming, returns)` returns `HandoffCountDto \| null`. Add `badgeTotal(c)` and `handoffBoxes(isAdmin)`. | Shared badge, focus and gating | No |
| `src/ui/devices/incoming-transfer.test.ts` | Update the `focusAfter` and `badgeCountAfter` tests, and add the new cases | Test | No |
| `src/ui/devices/useIncomingHandoffs.ts` | Add `useHandoffList(api, box, enabled)`. `enabled=false` means no fetch: state `ready` with no items, and `refresh` resolves to `[]`. Keep `useIncomingHandoffs(api)` as a wrapper. | Own hook on `box=returns` | No |
| `src/ui/devices/device-actions.ts` | Rename `onCancelTransfer` to `onCancelHandoff` (kind-aware key, label and aria). Add `onReturn` (`canReturn`) and `onTakeBack` (`canTakeBack`, danger). New order: cancel, assign, editHolding, place modes, transfer, giveBack, edit, takeBack, delete. | Row actions | No |
| `src/ui/devices/device-actions.test.ts` | Rename the handler in fixtures and add the gating and order cases | Test | No |
| `src/ui/devices/devices-state.ts` | `pendingText` (33-41) gets a return branch: `{chip: pending.returnChip, to: null}`. Update the doc comment. Extension still returns null. | "Return pending" chip | No |
| `src/ui/devices/devices-state.test.ts` | Add the return chip case and the extension-is-null case | Test | No |
| `src/ui/devices/ReturnDeviceDialog.tsx` (new) | Modelled on `TransferDeviceDialog` without the picker: current owner, `NoteField`, and a "what happens next" hint. Exports the props-only `ReturnDeviceFields`. | Start return | No |
| `src/ui/devices/ReturnDeviceDialog.test.tsx` (new) | Markup test | Test | No |
| `src/ui/devices/TakeBackDeviceDialog.tsx` (new) | Modelled on `DeleteDeviceDialog` (`EntityFormDialog`). The body shows the owner, the seat or "not placed", "It becomes unowned and leaves its seat", and the transfer-cancel sentence. Exports the props-only `TakeBackDeviceBody`. | Take back confirm | No |
| `src/ui/devices/TakeBackDeviceDialog.test.tsx` (new) | Markup test | Test | No |
| `src/ui/devices/PendingReturns.tsx` (new) | A sibling of `IncomingTransfers.tsx`. The section heading is `id="returns-heading"` with `headingRef`. Confirm carries `data-handoff-confirm`. Cancel is shown only when `canCancel`. There is no Decline. Retry and truncated work as in `IncomingTransfers`. | Admin list | No |
| `src/ui/devices/PendingReturns.test.tsx` (new) | Markup test | Test | No |
| `src/ui/devices/DevicesPage.tsx` | Wire everything (Approach step 5) | Page wiring | No |
| `src/ui/devices/DevicesView.test.tsx` | Rename `onCancelTransfer` to `onCancelHandoff` in fixtures, if it is used there | Compile | No |
| `src/ui/devices/useHandoffBadge.tsx` | The context holds `HandoffCountDto`. `set(c: HandoffCountDto)`, the seq guard is unchanged, and `useHandoffBadge` returns `HandoffCountDto`. | Badge sum | No |
| `src/ui/AppShell.tsx` | `badges.devices = badgeTotal(c)` and `badgeLabels={{ devices: shellCopy.badge.devicesBreakdown(c.incoming, c.returns) }}` | Badge sum and aria | No |
| `src/ui/AppShellView.tsx` | New optional prop `badgeLabels?: Partial<Record<NavId, string>>`. When it is set, it overrides the sr-only text at line 101. | Aria breakdown | No |
| `src/ui/AppShellView.test.tsx` | Breakdown cases. The existing ones stay unchanged. | Test | No |
| `src/ui/copy/shell.ts` | `pendingReturns(n)` and `devicesBreakdown(incoming, returns)`, added under `badge` | D36 | No |
| `src/ui/copy/devices.ts` | `actions.giveBack/giveBackAria/takeBack/takeBackAria/cancelReturn/cancelReturnAria`, `giveBack.*`, `takeBack.*`, `returns.*`, `pending.returnChip`. The existing `actions.return*` and `place.*` stay unchanged. | D36 | No |

No file matches a High path in `.claude/loop.config.md`. The PR tier is expected to be Medium (UI logic). The plan-approval gate applies because the ticket is P1.

## Data model / migration
None.

## API contract
None. There is no endpoint change. The UI binds to the merged SIM-037.4 contract quoted above.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `devices-api.test.ts` › "startReturn posts {kind:'return', note} to /api/devices/:id/handoffs" | Client path and body |
| `devices-api.test.ts` › "takeBack posts to /api/devices/:id/take-back with no body and reads a DeviceDto" | Client path |
| `devices-api.test.ts` › "pendingReturns GETs /api/handoffs?box=returns" | Client path |
| `devices-api.test.ts` › "handoffCount returns {incoming, returns}; missing or non-number returns -> 0; missing incoming -> internal" | Count parsing, old server |
| `return-device.test.ts` › "toReturnBody: NFC/trim, blank note -> null, >500 -> noteInvalid" | Uses `validateHandoffStart({kind:"return"})`. Vietnamese diacritics in the note survive NFC. |
| `return-device.test.ts` › "settleReturn: ok and not_found -> done; handoff_pending, not_allowed -> stale error; device_unowned -> stale error with the giveBack.errors.alreadyUnowned text (not the placement text); invalid_request -> giveBack.errors.invalid; unavailable -> not stale" | Start outcomes |
| `return-device.test.ts` › "confirmReturnOutcome: ok -> 'is back in the org inventory', hint only under placed; handoff_not_pending, not_found -> gone + refresh; auth/unavailable -> no refresh; placement_changed -> error + refresh" | Confirm outcomes, via `handoffActionFailed` |
| `return-device.test.ts` › "settleTakeBack: ok -> done(device); not_found -> done; handoff_pending, placement_changed, device_unowned, not_allowed -> stale error; device_unowned uses takeBack.errors.alreadyUnowned; unavailable -> not stale" | Take-back outcomes |
| `return-device.test.ts` › "takeBackDone notice: name and inventory number; hint only under placed" | Success notice |
| `transfer-device.test.ts` › "cancelOutcome per kind: transfer vs return notice and gone text" | Kind-aware cancel |
| `device-actions.test.ts` › "giveBack only when canReturn and onReturn is given; placed after transfer" | Gating and order |
| `device-actions.test.ts` › "cancelReturn for a pending return with canCancel; cancelTransfer for a transfer; none without canCancel; extension -> none" | Kind-aware cancel |
| `device-actions.test.ts` › "takeBack when canTakeBack (danger), also with a pending transfer alongside cancelTransfer; absent when canTakeBack is false" | Take-back gating |
| `device-actions.test.ts` › "takeBack aria names the owner; giveBack label differs from the place-mode Return label" | Distinct copy |
| `device-actions.test.ts` › "busyId disables the new actions too" | Busy |
| `devices-state.test.ts` › "pendingText: return -> returnChip with no 'to'; extension -> null" | Chip |
| `incoming-transfer.test.ts` › "badgeCountAfter: ok count wins; failed count with both lists -> their lengths; one list null -> null" | Badge after action |
| `incoming-transfer.test.ts` › "badgeTotal sums incoming and returns" | Badge sum |
| `incoming-transfer.test.ts` › "handoffBoxes: non-Admin -> ['incoming'] only; Admin -> both" | Regression guard: a non-Admin never calls `box=returns` (422) |
| `incoming-transfer.test.ts` › "focusAfter returns section with the acting list" (updated cases) | Focus |
| `ReturnDeviceDialog.test.tsx` › "ReturnDeviceFields: owner name, note label and hint, 'An Admin must confirm...' text; no recipient picker" | Markup |
| `TakeBackDeviceDialog.test.tsx` › "owner and seat code; 'not placed' without placement; transfer-cancel sentence only for a pending transfer" | Markup |
| `PendingReturns.test.tsx` › "renders device, typeLine, From, note; Confirm only with canConfirm (data-handoff-confirm); Cancel only with canCancel; no Decline" | Markup |
| `PendingReturns.test.tsx` › "empty and no error -> renders nothing; error -> alert + Retry; truncated text; busy disables buttons" | Markup |
| `AppShellView.test.tsx` › "devices badge with badgeLabels: numeral is the given count, sr-only is the label; without badgeLabels the old text" | Aria breakdown |
| `shell` copy cases (in `AppShellView.test.tsx`) › "devicesBreakdown(2,0) equals incomingTransfers(2); (0,1) '1 pending return'; (2,1) '3 pending items: 2 incoming transfers, 1 pending return'" | Copy |

## Approach
1. **API client** (`devices-api.ts`).
   - Add `listHandoffs(box)`, `pendingReturns`, `startReturn`, `takeBack`, and the two-field `handoffCount` with the `returns ?? 0` default.
   - Write the tests first.
2. **Pure modules.**
   - `return-device.ts`:
     - `ReturnForm = {note}`.
     - `toReturnBody(form)` calls `validateHandoffStart({kind:"return", note})`, which is the server's own validator.
     - `settleReturn(result): {kind:"done"} | {kind:"error"; message; stale}`. It uses the STALE list `handoff_pending`, `not_allowed`, `device_unowned`. `device_unowned` gets its own copy, because `apiErrorMessage` says it "can't be placed at a seat".
     - `confirmReturnOutcome(result, item, filter)` reuses `handoffActionFailed`.
     - `settleTakeBack(result)` mirrors the `settleDelete` shape.
     - `takeBackDone(device, filter)` gives the notice.
     - `takeBackBody(device)` returns `{owner, seat | null, cancelsTransfer: pendingHandoff?.kind === "transfer"}`.
   - The filter hint appears only when `filter === "placed"`. `inventory` is `seat_id is null` (`src/server/devices/devices.ts:156-160`), so an unowned device stays visible under all, inventory and unowned.
   - `transfer-device.ts` `cancelOutcome` takes `kind`.
   - `incoming-transfer.ts`: the badge, focus and `handoffBoxes` changes.
   - `devices-state.ts`: the chip.
3. **Row actions** (`device-actions.ts`). The server flags are the only gate. While a return is pending, the place modes still follow `placeModes(d)` and the server decides (FE consult). No client-side hiding.
4. **Components.**
   - `ReturnDeviceDialog`, `TakeBackDeviceDialog` and `PendingReturns` are pure markup plus thin state, like their siblings.
   - The take-back submit uses `EntityFormDialog` as `DeleteDeviceDialog` does. The danger meaning is carried by the title "Take back this device?" and the body text. `EntityFormDialog` has no danger submit variant, and adding one is out of scope (R4).
5. **DevicesPage wiring.**
   - Hooks: `returns = useHandoffList(api, "returns", handoffBoxes(isAdmin).includes("returns"))`. `isAdmin` is false while `session` is null, so nothing is fetched until the tier is known.
   - One `refreshAll()` runs `Promise.all([incoming.refresh(), returns.refresh(), refresh()])`, then `setBadge(badgeCountAfter(await api.handoffCount(), inc, ret))` when the result is not null. It returns the lists.
   - `act(list, item, call, outcomeOf)` generalises lines 79-99:
     - `before` comes from that list.
     - It refreshes everything with `refreshAll()`.
     - `focusAfter(..., list)` sets the focus.
     - The shared `acting` ref stays, and one `handoffBusyId` is passed to both sections.
   - The focus effect (64-76) picks `incomingHeadingRef` or `returnsHeadingRef` by `focusTarget.list`.
   - Row handlers:
     - `onReturn` opens `ReturnDeviceDialog`. `onDone` shows the `giveBack.sent` notice, runs `refreshAll()`, then focuses the page heading.
     - `onTakeBack` opens `TakeBackDeviceDialog`. `onDone` shows the `takeBackDone` notice, runs `refreshAll()`, then focuses the page heading.
     - `onCancelHandoff` keeps the current ad-hoc flow (126-138) with `cancelOutcome(..., pending.kind === "return" ? "return" : "transfer")`, then `refreshAll()` instead of `refresh()`.
     - All three use the same `acting` ref guard for the async parts. `onStale` in both dialogs runs `refreshAll()`.
   - Render `PendingReturns` after `IncomingTransfers` inside the existing `incoming` slot (a fragment). There is no `DevicesView` change.
6. **Badge.**
   - `useHandoffBadge.tsx`: the context value is `HandoffCountDto`. The initial value is `{incoming:0, returns:0}`.
   - `AppShell.tsx` passes the total and the breakdown label.
   - `AppShellView` gets the `badgeLabels` override.
   - For a non-Admin, `returns` is 0. The total equals `incoming` and the label falls back to `incomingTransfers(n)`, so behaviour is unchanged.
7. **Copy.** Every string is in `src/ui/copy/devices.ts` / `shell.ts`. Proposed texts:
   - Row actions:
     - "Give back to org" (aria `Give device {inv} back to the org`).
     - "Take back" (aria `Take device {inv} back from {owner}`).
     - "Cancel return" (aria `Cancel return of device {inv}`).
     - "Return pending" (the chip).
   - Give back dialog:
     - Title "Give device back to org", submit "Give back", note label "Note for the Admin".
     - Next hint: "An Admin must confirm. Until then the device stays with you and keeps its seat. You can cancel at any time."
     - Sent notice: "Return of {name} ({inv}) sent. It waits for an Admin to confirm."
   - Take back dialog:
     - Title "Take back this device?", submit "Take back".
     - Body: "Currently with {owner}, on seat {code}" or "not placed". Then "It becomes unowned and leaves its seat."
     - When a transfer is pending, it adds "The pending transfer will be cancelled."
   - Pending returns section:
     - Heading "1 pending return" / "{n} pending returns".
     - Hint: "Confirming makes the device unowned and removes it from its seat."
     - Buttons "Confirm return" and "Cancel".
   - Success notice for both confirm and take-back: "{name} ({inv}) is back in the org inventory."
8. Run every check. Record any file outside this list in `impl-log.md`.

Rules:
- **R1**: only `src/ui/**` and `src/ui/copy/**` change. They import `@/lib/devices/*` and `@/lib/validate/device`, both lib. `pnpm check:layers` covers it.
- **R3, R2, R6**: not touched.
- **R7**: the UI never retries domain codes. `apiFetch` alone handles 401/403.
- **D36**: copy files only.
- **R5**: the tests are listed above.
- **R4**: no `EntityFormDialog` or `DevicesView` refactor, and the two badge providers are not merged.

## Specialist input used
- **frontend-developer**
  - Adopted:
    - Bind to the merged contract: take-back has no note, and `box=returns` returns 422 for a non-Admin, so it is never called.
    - `listHandoffs(box)` and a `returns` count that defaults to 0.
    - `badgeCountAfter` takes both lists and returns null if either list failed.
    - The context holds `{incoming, returns}`.
    - Badge option (a), the `badgeLabels` override.
    - `act(list, ...)` with a section focus per list and one shared `acting` ref.
    - `useHandoffList(api, box, enabled)`.
    - `confirmReturnOutcome` with the hint only under `placed`.
    - Kind-aware `cancelOutcome`.
    - Take-back is modelled on `DeleteDeviceDialog`, with the transfer-cancel sentence.
    - Place and move are not hidden during a pending return.
    - The regression guard so a non-Admin never calls `box=returns`.
  - Adopted, from FE open question 1: keep the place-mode "Return" copy unchanged. See the assumption below.
- **ux-architect**
  - Adopted:
    - Distinct keys: `giveBack*`, `takeBack*`, `cancelReturn*`.
    - The dialog explanation text.
    - "Pending returns (N)" with the hint.
    - Cancel without a confirm dialog.
    - Empty means render nothing.
    - Zero parts are omitted from the aria breakdown, and the visible badge is capped at 9+ (existing `badgeText`).
    - Server flags are the only gate.
    - `DevicesViewProps` is unchanged.
  - Rejected:
    - Renaming the place-mode "Return" to "Remove from seat": see the assumption below.
    - The "(deactivated)" owner tag: `DeviceDto.owner` has no active flag (`types.ts:61`), and adding one would be an API change.
    - The stale list "handoff_stale" for returns: the merged return path never emits it. It stays harmless in the shared `failed()`.

## Assumptions
- **Place-mode "Return" label (consults disagree; Ming may flip).**
  - Default: **keep "Return" unchanged** (FE).
  - Reasons:
    - The ticket asks only for "copy keys distinct from the existing place mode 'Return'".
    - The spec itself names that action "Return to inventory" (DEV-05, D63, line 264).
    - The new labels ("Give back to org", "Take back", "Cancel return") and their aria texts already differ.
  - If Ming prefers UX's "Remove from seat", it is a one-line copy change to `devicesCopy.actions.return` and `returnAria` (`src/ui/copy/devices.ts:25,28`), with no key or behaviour change. The implementer applies it only if Ming says so at plan approval.
- Take-back has no reason or note, because the merged API has no body. If Ming wants a reason, that is an API follow-up, not part of this ticket.
- An Admin can confirm their own return. The UI follows `canConfirm` and adds no rule of its own.
- "Cancel return" in `PendingReturns` follows `canCancel`. Every Admin is Manager+, so Admins always see it.
- `PendingReturns` shows "From {from.displayName}" only. `requestedBy` (a Manager who started it for the owner) is not shown, so no requirement is added.
- The take-back submit button is not danger-styled (`EntityFormDialog` has no variant). The row button is danger-styled. If a danger submit is wanted, it is a follow-up `debt` issue.
- A take-back that cancels a pending transfer reaches the recipient's badge only on their next focus or route change (D24). This is accepted, and the confirm text says so.
- Hotspots: no other ticket in IN_PROGRESS, REVIEW or DONE touches `src/ui/devices/**` or the shell. SIM-039.3 (DONE) is the layout validator.

## Blocking questions
None.

## Split proposal
None, with a caveat.
- Size estimate: about 450-550 changed lines of production code and about 400 lines of tests. That is above the ~400-line guide, but most of it mirrors existing siblings (`IncomingTransfers`, `TransferDeviceDialog`, `DeleteDeviceDialog`).
- This is already the UI slice Ming approved out of SIM-037.4. Splitting again would make both halves refactor `DevicesPage.act()` and the badge twice.
- Fallback if REVIEW shows the diff is too large: slice A covers the client calls, give back, cancel return, the chip and take back. Slice B covers `PendingReturns`, the badge sum and the aria breakdown.
