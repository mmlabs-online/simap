Status: READY

# Plan — SIM-013.5: Device delete dialog with Move to inventory

Slice 3 of the SIM-013.2 split (`work/tickets/SIM-013.2/plan.md` → `## Split proposal`, "Decisions already made for
SIM-013.5"). Those decisions are taken as given here and are not reopened. The branch is stacked on
`ticket/SIM-013.4` (PR #63, not merged), so the actions column, `onEdit` and `DeviceFormDialog` already exist.

## Scope summary
- `docs/spec-v1.md` DEV-01 (lines 263-267): "Editing or deleting a device: its owner or an Admin only (D19)." and
  "Deleting a device that is placed at a seat is blocked: a warning says it must go back to inventory first and offers
  "Move to inventory"; delete is allowed once it is in inventory (D31)."
- DEV-02 (line 270): "Every device list and device detail shows "at seat X" or "in inventory"." The placed step names
  the seat.
- `work/decisions.md`:
  - D31: "A placed device cannot be deleted: warn, offer "move to inventory", then allow delete."
  - D19: "editing/deleting a device is owner or Admin only." The server computes this as `canEdit` on each row.
  - D36: "all user-facing text lives in copy files … Names/data keep Vietnamese diacritics."
- SIM-013.2 plan, "Decisions already made for SIM-013.5":
  - The dialog opens in `placed` when `device.placement` is set, and in `confirm` otherwise.
  - On a 409 `device_placed` (no seat in the body, `devices.ts:433`), the dialog calls `GET /api/devices/:id` and moves
    to `placed`.
  - "Move to inventory" sends `PUT …/placement` with `{ seatId: null, expectedSeatId }`. On success the dialog goes
    back to `confirm` with an explicit "Delete device" button and never deletes automatically. A `placement_changed`
    triggers a `GET` and shows the new step with the `apiErrorMessage`.
  - `not_found` on any call means done.
  - A row with `canEdit` can always move the device (`canPlace`).
  - After the delete, focus moves to the h1 (`tabIndex={-1}`).
- Ticket ACs 1-4 (quoted in the table below).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Deleting an inventory device works after a confirm. | `delete-device-flow.test.ts` › "deleteStep: inventory device → confirm" and "settleDelete: ok and not_found → done". `DeleteDeviceDialog.test.tsx` › "confirm step: names the device and says it can't be undone". `devices-api.test.ts` › "remove sends DELETE /api/devices/<id>; 204 → ok". `device-actions.test.ts` › "Delete only when canEdit and onDelete". Code read: in `DeleteDeviceDialog.tsx`, the `confirm` submit is the only call site of `api.remove`. |
| 2 | Deleting a placed device offers "Move to inventory" and then an explicit delete confirm. | `delete-device-flow.test.ts` › "deleteStep: placed device → placed", "settleMove: ok → confirm (never done)", "moveBody uses the current placement as expectedSeatId". `DeleteDeviceDialog.test.tsx` › "placed step: names the seat and labels the submit Move to inventory" and "confirm after a move shows the moved note". Code read: the `placed` branch of `submit` calls only `api.place`, never `api.remove`. |
| 3 | Stale placement (`placement_changed`) and a device removed elsewhere are handled without a silent delete. | `delete-device-flow.test.ts` › "settleMove: placement_changed → refetch with message", "settleMove: not_found → done", "settleDelete: device_placed → placed with message", "settleDelete: other codes → error", "afterRefetch: not_found → done, ok → step from fresh device, other → error". Code read: neither refetch path calls `remove`. |
| 4 | Pure-logic and static-render tests (no jsdom) cover the delete flow steps. | `pnpm test` runs `delete-device-flow.test.ts` and `DeleteDeviceDialog.test.tsx` (renderToStaticMarkup). Neither file imports jsdom or sets a jsdom environment. |

Every Check must be green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.
The no-literals and copy tests (`src/ui/copy/no-literals.test.ts`, `copy.test.ts`) must also stay green.

## Ming verification after merge
- Local run (`pnpm dev`, dev token), `/devices`:
  - Delete an inventory device. The dialog asks once, "Delete device" removes it, the list refreshes, and focus lands
    on the "Devices" heading.
  - Delete a placed device. The dialog names the seat and offers "Move to inventory". After the move, the dialog
    shows the delete confirm and the device is not deleted yet. Cancel at this point: the row shows "In inventory".
    Delete again to remove it.
  - Delete buttons appear only on rows you own (as User/Manager), or on every row (as Admin).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/devices/delete-device-flow.ts` | **New**, pure. Exports `DeleteStep`, `deleteStep`, `moveBody`, `settleDelete`, `settleMove`, `afterRefetch` (see Approach). | AC1-3 logic, testable without React. | No |
| `src/ui/devices/delete-device-flow.test.ts` | **New**. Unit tests below. | AC4, R5 | No |
| `src/ui/devices/DeleteDeviceDialog.tsx` | **New**. Exports `DeleteDeviceBody` (props only) and `DeleteDeviceDialog` (wrapper plus inner, modelled on `src/ui/rooms/DeleteRoomDialog.tsx:12-95` and `PlaceDeviceDialog.tsx:180-224`). | AC1-3 UI | No |
| `src/ui/devices/DeleteDeviceDialog.test.tsx` | **New**. Static-render tests of `DeleteDeviceBody` (pattern: `DeviceFormDialog.test.tsx`). | AC4 | No |
| `src/ui/devices/devices-api.ts` | Add `remove(id)` (DELETE, 204 with no body, own reader; lines 51-94). | The API client has no delete. | No |
| `src/ui/devices/devices-api.test.ts` | Add a `describe("devices-api remove")` block. | R5 | No |
| `src/ui/devices/device-actions.ts` | Add `onDelete?` to `DeviceRowHandlers` (lines 5-9, update the comment). Add `danger?: boolean` to `RowAction` (line 11). Push a `delete` action after `edit`, gated by `onDelete && d.canEdit` (after line 40). | Delete button only where `canEdit` (ticket scope). | No |
| `src/ui/devices/device-actions.test.ts` | Add a `describe("delete action")` block. | R5 | No |
| `src/ui/devices/DeviceRowActions.tsx` | `variant={a.danger ? "danger" : "tonal"}` (line 18). | Delete buttons use `danger` elsewhere (`RoomsView.tsx:92`, `SeatActions.tsx:78`). | No |
| `src/ui/devices/DevicesView.tsx` | Add optional prop `headingRef?: React.Ref<HTMLHeadingElement>`. The h1 (line 39) gets `ref={headingRef}`, `tabIndex={-1}` and `outline-none`. | Focus after a delete (SIM-013.2 decision). | No |
| `src/ui/devices/DevicesView.test.tsx` | Add "Delete buttons on canEdit rows" and "h1 has tabindex -1" in the existing `describe("DevicesView create and edit entries")` block (line 149) or a sibling block. | R5 | No |
| `src/ui/devices/DevicesPage.tsx` | Add `deleting` state, `onDelete` in `actions` (lines 31-37), a `headingRef`, and mount `DeleteDeviceDialog` (after line 80). | Wiring | No |
| `src/ui/copy/devices.ts` | Add `actions.delete` / `actions.deleteAria(inv)` (lines 17-26) and a `delete` block (see Approach). | D36 | No |

No other file changes. `src/ui/index.ts` already exports `DevicesPage`.

## Data model / migration
None.

## API contract
None. The UI uses the existing endpoints unchanged:
- `DELETE /api/devices/:id`: 204, 409 `device_placed`, 422 `not_allowed`, 404 `not_found`
  (`src/app/api/devices/[id]/route.ts:43-54`, `devices.ts:432-433`).
- `GET /api/devices/:id`: returns a `DeviceDto`.
- `PUT /api/devices/:id/placement`: returns a `DeviceDto` (`placement/route.ts:23`, `placeDevice` returns
  `Result<DeviceDto>` at `devices.ts:186`). This resolves the consult risk: `current` can be set from the PUT result.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `delete-device-flow.test.ts` › "deleteStep: inventory device → confirm; placed device → placed" | AC1, AC2 |
| `delete-device-flow.test.ts` › "moveBody sends seatId null and the device's current seatId as expectedSeatId" | AC2, stale guard |
| `delete-device-flow.test.ts` › "settleDelete: ok and not_found → done" | AC1, AC3 |
| `delete-device-flow.test.ts` › "settleDelete: device_placed → placed with the device_placed message" | AC3 (stale inventory row) |
| `delete-device-flow.test.ts` › "settleDelete: not_allowed / unavailable → error with apiErrorMessage" | error path |
| `delete-device-flow.test.ts` › "settleMove: ok → confirm carrying the returned device (never done)" | AC2 (no automatic delete) |
| `delete-device-flow.test.ts` › "settleMove: not_found → done; placement_changed → refetch with message; other → error" | AC3 |
| `delete-device-flow.test.ts` › "afterRefetch: ok → device; not_found → done; other code → error" | AC3 |
| `DeleteDeviceDialog.test.tsx` › "placed step: names the device, inventory no. and seat code; Vietnamese diacritics kept" | AC2, DEV-02, Domain focus |
| `DeleteDeviceDialog.test.tsx` › "confirm step: names the device and says it can't be undone; no seat text" | AC1 |
| `DeleteDeviceDialog.test.tsx` › "confirm after a move shows the moved note" | AC2 |
| `DeleteDeviceDialog.test.tsx` › "submitLabel per step: Move to inventory / Delete device" (test `deleteSubmitLabel(step)`, exported from the flow module or the dialog) | AC2 |
| `devices-api.test.ts` › "remove sends DELETE /api/devices/<id>; 204 → ok with no body read; 409 → device_placed; 404 → not_found; network → unavailable" | client |
| `device-actions.test.ts` › "Delete only when canEdit and onDelete; marked danger; after edit" | ticket scope (gating) |
| `device-actions.test.ts` › "hasAnyAction is true for a canEdit-only row with onDelete" | column shown |
| `DevicesView.test.tsx` › "Delete buttons on canEdit rows with aria-label 'Delete device <inv>'" | gating in the view |
| `DevicesView.test.tsx` › "h1 is focusable (tabindex -1)" | focus target |

All tests use static render or pure calls. No jsdom.

## Approach
1. **Copy** (`src/ui/copy/devices.ts`, D36):
   - `actions.delete: "Delete"` and `actions.deleteAria: (inv) => \`Delete device ${inv}\``.
   - `delete` block:
     - `title: "Delete device"`
     - `submit: { placed: "Move to inventory", confirm: "Delete device" }`
     - `placedBody: (name, inv, seatCode) => \`${name} (${inv}) is at seat ${seatCode}. Move it to inventory before
       deleting it.\``
     - `confirmBody: (name, inv) => \`Delete ${name} (${inv})? This can't be undone.\``
     - `moved: "Moved to inventory."`
   - Reuse `apiErrorMessage` for `device_placed`, `placement_changed` and the other codes (`copy/api.ts:36,40`).
2. **`devices-api.ts`**: `remove: (id) => call<void>(devicePath(id), { method: "DELETE" }, async () => ({ ok: true,
   value: undefined }))`. Do not use `oneDevice`, because the 204 has no body. Do not add `moveToInventory`:
   `place(id, moveBody(d))` covers it. This narrows the split table's `get/remove/moveToInventory`, since `get`
   already exists.
3. **`delete-device-flow.ts`** (pure, imports `toPlacementBody` from `./place-device`, `apiErrorMessage` and the
   `DevicesResult` type):
   - `type DeleteStep = "placed" | "confirm"`.
   - `deleteStep(d)` returns `d.placement ? "placed" : "confirm"`. The step is always derived from the current
     device, so no separate step state can drift. The opening step equals `deleteStep(device)`.
   - `moveBody(d)` returns `toPlacementBody(d, null)`, giving `{ seatId: null, expectedSeatId: d.placement?.seatId ??
     null }`.
   - `settleDelete(r: DevicesResult<void>)` returns:
     - `{ kind: "done" }` for ok or `not_found`
     - `{ kind: "placed"; message }` for `device_placed`
     - `{ kind: "error"; message }` otherwise
   - `settleMove(r: DevicesResult<DeviceDto>)` returns:
     - `{ kind: "confirm"; device }` for ok
     - `{ kind: "done" }` for `not_found`
     - `{ kind: "refetch"; message }` for `placement_changed`
     - `{ kind: "error"; message }` otherwise

     This mapping is separate from `place-device.ts` `settle`, because ok there means done.
   - `afterRefetch(r: DevicesResult<DeviceDto>)` returns `{ kind: "device"; device }`, `{ kind: "done" }` for
     `not_found`, or `{ kind: "error"; message }`.
   - `deleteSubmitLabel(step)` maps a step to its copy.
4. **`DeleteDeviceDialog.tsx`**:
   - Props: `device: DeviceDto | null`, `api: DevicesApi`, `onClose`, `onStale`, `onDone`.
   - The wrapper returns null without a device and mounts `DeleteDeviceInner key={device.id}`.
   - Inner state: `current` (starts as `device`), `moved` (false), `error`, `submitting`. `step = deleteStep(current)`.
   - `submit`:
     - `confirm`: `settleDelete(await api.remove(current.id))`.
       - `done` calls `onDone()`.
       - `placed` shows the message, then calls `refetch()`.
       - `error` shows the message.
     - `placed`: `settleMove(await api.place(current.id, moveBody(current)))`.
       - `confirm` sets `current` to the returned device, sets `moved = true`, clears the error and calls `onStale()`,
         because the list row is now out of date. **Stop here, with no `remove` call** (AC2).
       - `done` calls `onDone()`.
       - `refetch` shows the message, then calls `refetch()`.
       - `error` shows the message.
     - `refetch()` runs `afterRefetch(await api.get(current.id))`.
       - `device` sets `current` (the step follows from it), sets `moved = false` and calls `onStale()`.
       - `done` calls `onDone()`.
       - `error` keeps `current` and appends nothing. The earlier message stays, so the user can retry.
     - Always `setSubmitting(false)` unless `onDone` was called. Disable submit while `submitting`.
   - Render `EntityFormDialog` with:
     - `title` = `devicesCopy.delete.title`
     - `subtitle` = `devicesCopy.typeLine(current.name, current.inventoryNumber)` (as `PlaceDeviceDialog.tsx:231`)
     - `submitLabel` = `deleteSubmitLabel(step)`
     - children: `<DeleteDeviceBody device={current} step={step} moved={moved} />`
   - `DeleteDeviceBody` (props only) renders `placedBody(name, inv, placement.seatCode)` or `confirmBody(name, inv)`.
     It renders the `moved` note above the confirm text only when `moved` is true.
5. **`device-actions.ts`**:
   - Add `onDelete?: (device: DeviceDto) => void` and update the header comment.
   - `RowAction` gets `danger?: boolean`.
   - After the edit block, add `if (onDelete && d.canEdit) out.push({ key: "delete", label: devicesCopy.actions.delete,
     ariaLabel: devicesCopy.actions.deleteAria(d.inventoryNumber), danger: true, run: () => onDelete(d) })`.
   - `DeviceRowActions.tsx` picks `variant="danger"` for `danger` actions.
6. **`DevicesView.tsx`**: add the `headingRef` prop. The h1 gets `ref`, `tabIndex={-1}` and `outline-none`.
7. **`DevicesPage.tsx`**:
   - Add `const [deleting, setDeleting] = useState<DeviceDto | null>(null)` and `const headingRef =
     useRef<HTMLHeadingElement>(null)`.
   - Add `onDelete: (device) => setDeleting(device)` to `actions`, and pass `headingRef` to `DevicesView`.
   - Mount `<DeleteDeviceDialog device={deleting} api={api} onClose={() => setDeleting(null)} onStale={() => void
     refresh()} onDone={() => { setDeleting(null); void refresh().then(() => headingRef.current?.focus()); }} />`.
   - Focus moves after the refresh resolves, so it runs after `EntityFormDialog`'s cleanup, which returns focus to
     the deleted row's button (`EntityFormDialog.tsx:47-50`).
   - `onDone` for `not_found` (a device removed elsewhere) also focuses the heading. That is fine, because the row is
     gone in both cases.
8. Run all Checks.

Rules:
- R1: only `src/ui/**` changes. Imports are ui → lib (`@/lib/devices/types`) and ui → ui. `pnpm check:layers`
  enforces this.
- R7 and the server: no route changes. A 401/403 re-send by `apiFetch` happens only from the auth wrapper, before
  any side effect, so repeating the DELETE or PUT is safe.
- R4: nothing outside the file list.
- R5: tests above.
- D36: no literals in TSX. The copy tests stay green.

## Specialist input used
`consult-frontend-developer.md`:
- **Adopted:**
  - The `remove` reader for the 204 (rec 4). No `moveToInventory` (rec 4).
  - Separate `settleDelete` / `settleMove`, because ok must not mean done (rec 1).
  - `moveBody` through `toPlacementBody` (rec 1).
  - The wrapper/inner keyed by id, and `DeleteRoomDialog` as the template (finding 9).
  - The props-only `DeleteDeviceBody` for static tests (rec 2).
  - The Delete action after Edit, gated by `canEdit` (rec 3).
  - The `DevicesPage` wiring (rec 5).
  - The test list (rec 7).
  - The race handling: `device_placed` after a move goes back to `placed`, and the move is never auto-retried
    (risks).
- **Adapted:**
  - `openingStep` / `stepAfterRefetch` become one `deleteStep(current)`. The step is derived from `current`, not
    stored, so it cannot disagree with the device.
  - `afterRefetch` maps the `get` result.
  - After a successful move, the dialog also calls `onStale()`, so the list is right if the user cancels.
  - A `moved` note gives feedback between the two steps.
- **Open questions answered:**
  - Confirm text: name and inventory no. only, no owner. DEV-01 and D31 ask only for a warning and an explicit
    delete. The owner is already visible in the row. This is a non-blocking assumption, see 1 below.
  - Danger button: yes, for the row action only. `Button` already has `variant="danger"` (`Button.tsx:5,15`), and
    other delete buttons use it (`RoomsView.tsx:92`, `SeatActions.tsx:63,78`). This is a one-line change in
    `DeviceRowActions`, with no kit change. The dialog's submit keeps the kit style, because `EntityFormDialog` has
    no danger submit (a follow-up if wanted).
  - h1 focus: included. It is a recorded SIM-013.5 decision in the SIM-013.2 plan.
- **Risk resolved:** the placement PUT returns a `DeviceDto` (`placement/route.ts:23`), so `current` comes from the
  PUT result.

## Assumptions
1. The confirm text names the device and its inventory no. but not its owner. Default for Ming: keep it that way.
   Adding the owner is a one-line copy change.
2. The dialog's "Delete device" submit uses the standard primary style of `EntityFormDialog`. A danger-styled submit
   would change the kit and is a follow-up.
3. The `moved` note ("Moved to inventory.") is short feedback that the first step worked. It is within D31's "then
   allow delete".
4. If the user cancels after "Move to inventory", the device stays in inventory, which is the expected D31 result.
   The list refreshes through `onStale`.
5. Hotspots:
   - SIM-013.4 (IN_PROGRESS, PR #63) edits `DevicesPage.tsx`, `device-actions.ts`, `device-actions.test.ts`,
     `DevicesView.tsx`, `DevicesView.test.tsx`, `devices-api.ts`, `devices-api.test.ts` and `copy/devices.ts`. This
     branch is stacked on it.
   - If PR #63 changes in review, or merges by squash, expect a rebase of `ticket/SIM-013.5` onto `main`. The
     conflicts would be in these same files, and they are additive.
   - No other open ticket touches `src/ui/devices/**`.
6. Estimated size is about 260 source lines plus about 220 test lines, within one cycle.

## Blocking questions
None.

## Split proposal
None.
