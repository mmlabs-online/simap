# Consult — frontend-developer (SIM-013.5)

## Findings

- Row actions: `device-actions.ts` `DeviceRowHandlers` has `onPlace` and `onEdit`. `rowActions` appends an action only when the handler exists and `d.canEdit` is true (for edit). `DeviceRowActions` and `hasAnyAction` need no change. The actions column and `DevicesPage` wiring already exist (`DevicesPage.tsx` builds `actions` with `useMemo`, `refresh()` for reload). Delete is a third entry in the same pattern.
- `devices-api.ts` has `get`, `create`, `update`, `place`, `list`. It has no `remove`. The shared `call`/`oneDevice` reader expects a JSON body, but DELETE returns `204` with no body (`src/app/api/devices/[id]/route.ts:43-54`). `remove` needs its own reader that returns `{ ok: true, value: undefined }`; do not use `oneDevice`. Do not add `moveToInventory`: `place(id, { seatId: null, expectedSeatId })` already does it, and `toPlacementBody(d, null)` in `place-device.ts` builds the body.
- `place-device.ts` `settle()` already maps ok / `not_found` to done, `placement_changed` to refetch, and other codes to an error message. It can be reused for the move step. For the delete call, `device_placed` is not covered by `settle` (the delete flow needs its own mapping).
- Copy: `apiErrorMessage` already has `device_placed` ("This device is at a seat. Move it to inventory before deleting it.") and `placement_changed`. `devicesCopy.actions` has no delete entries and there is no `delete` block. All new strings go in `src/ui/copy/devices.ts` (D36). The no-literals and copy tests must stay green.
- `DeleteRoomDialog` is the template: a wrapper that mounts the inner component only when open and keys it by id, `EntityFormDialog` with `submitLabel`, `submitting`, `error`, and `not_found` calling `onDone`. `EntityFormDialog` always renders a form with one submit button, plus a Cancel. It has no second action. So the "placed" step's primary submit can be "Move to inventory", and the "confirm" step's submit can be "Delete device". The step is derived from state, and the submit handler switches on it.
- Server: `DELETE` returns 204, or 409 `device_placed` (no seat in the body), 404 `not_found`, and 401/403 from the auth wrapper. The ticket scope needs no server change.

## Recommendations

1. `delete-device-flow.ts` (pure, no React):
   - `type DeleteStep = "placed" | "confirm"`.
   - `openingStep(d)` returns `"placed"` when `d.placement` is set, else `"confirm"` (ticket scope, AC2).
   - `settleDelete(result)` returns one of `{ kind: "done" }` (ok or `not_found`), `{ kind: "placed" }` (`device_placed`, which triggers `get`), or `{ kind: "error", message }`.
   - `settleMove(result)` is `{ kind: "confirm" }` (ok), `{ kind: "done" }` (`not_found`), `{ kind: "refetch", message }` (`placement_changed`), or `{ kind: "error" }`. Reuse the `settle` pattern, but note that ok must not mean done here.
   - `stepAfterRefetch(fresh)` returns the step from the fresh device: `"placed"` if it has a placement, else `"confirm"`. A `get` that returns `not_found` means done and closes the dialog. Any other `get` failure shows the error and stays in the current step.
   - `moveBody(current)` calls `toPlacementBody(current, null)`, so `expectedSeatId` always comes from the latest fetched device.
2. `DeleteDeviceDialog.tsx`:
   - Wrapper like `PlaceDeviceDialog`: `open` and `device`, mounted only while open, `key={device.id}`.
   - State: `current` (the DeviceDto), `step` (initialized from `openingStep`), `error`, `submitting`.
   - Submit by step:
     - `confirm`: `api.remove(current.id)`, then `settleDelete`. On `placed`, call `get`, set `current` and `step` from `stepAfterRefetch`, and show the `device_placed` message.
     - `placed`: `api.place(current.id, moveBody)`, then `settleMove`. On success, set `current` to the returned device, set `step = "confirm"`, clear the error, and stop. Never call `remove` in the same submit (AC2: no automatic delete). On `placement_changed`, call `get`, update `current` and `step`, show the message, and call `onStale()` (same as `PlaceDeviceDialog`).
   - `done` calls `onDone()`, and the page refreshes. This covers `not_found` for AC3.
   - Body text per step: placed says "{name} ({inv}) is at seat {code}. Move it to inventory before deleting it."; confirm says "Delete {name} ({inv})? This can't be undone."
   - Keep the "Delete device" submit disabled while `submitting`.
   - Export a props-only `DeleteDeviceBody({ device, step })` so static-render tests (renderToStaticMarkup, no jsdom) can cover both steps, the way `PlaceDeviceFields` does.
3. `device-actions.ts`: add `onDelete?: (d: DeviceDto) => void` to `DeviceRowHandlers` (update the comment), and push a `delete` action under the same `d.canEdit` gate, placed after `edit`. Add `devicesCopy.actions.delete` / `deleteAria(inv)` ("Delete device 123"). Consider a danger variant for the button only if `Button` has one. Otherwise stay tonal, because `DeviceRowActions` uses tonal for all.
4. `devices-api.ts`: add `remove(id)` using `call<void>(devicePath(id), { method: "DELETE" }, async () => ({ ok: true, value: undefined }))`. Tests in `devices-api.test.ts`: DELETE method and path, 204 gives ok, 409 gives code `device_placed`.
5. `DevicesPage.tsx`: add `deleting` state and `onDelete: (device) => setDeleting(device)` in `actions`. Mount `DeleteDeviceDialog` with `api`, `onClose={() => setDeleting(null)}`, `onStale={() => void refresh()}`, `onDone={() => { setDeleting(null); void refresh(); }}`.
6. After delete, move focus to the h1 (`tabIndex={-1}`), as the SIM-013.2 plan records (needs a small change in `DevicesView`, and the dialog's own focus restore goes to the removed row's button, so set focus after `onDone`). If the planner wants to keep scope smaller, flag this as optional.
7. Tests (AC4, no jsdom):
   - `delete-device-flow.test.ts`: `openingStep` for placed and inventory; `settleDelete` and `settleMove` for each code; `stepAfterRefetch`; `moveBody` uses the fresh placement.
   - `DeleteDeviceDialog.test.tsx` (static render): both step bodies, labels, and the placed message includes the seat code.
   - `device-actions.test.ts`: delete shown only when `canEdit` and the handler is set, and the order of the actions.
   - Optional: a DevicesView test that the Delete button appears.
   - Verify for each AC: AC1 `openingStep` inventory gives confirm; AC2 move success gives confirm with no remove call; AC3 `placement_changed` refetches and `not_found` gives done.

## Risks

- A late 401/403 on the DELETE or PUT repeats the write via `apiFetch` re-send (R7). The auth wrapper rejects before side effects, so this is safe; confirm no route change is needed.
- Race: the move step succeeds, then another user places the device again before "Delete device" is confirmed. The remove then returns 409 `device_placed`. The flow handles it by refetching and returning to the placed step; do not auto-retry the move.
- The row from the list may be stale when the dialog opens. If it shows inventory but the device is now placed, `device_placed` handles that. If it shows placed but the device is now in inventory, the move PUT returns `placement_changed`, and the refetch then switches to confirm.
- `place()` returning the updated DeviceDto relies on the placement route returning a device body. Check this against `oneDevice` before relying on `current` being the PUT result. If it does not return a device, call `get` instead.
- Focus restoration: `EntityFormDialog` restores focus to the element that opened it, which is gone after a delete. Needs the h1 focus mentioned above.
- Stacked-branch note: SIM-013.5 sits on SIM-013.4 (PR #63 not merged), so `DevicesPage.tsx` and `device-actions.ts` conflicts are possible if SIM-013.3/.4 change them again.

## Open questions

- Should the delete confirm text name the device (name and inventory no.) only, or also its owner? The plan only requires an explicit confirm.
- Is a danger-styled delete button wanted? That would be a change to `Button`/`DeviceRowActions`, which the ticket does not mention.
- Do you want the h1 focus change here or deferred to follow-ups (R4)? The SIM-013.2 plan records it under SIM-013.5 decisions, so I would include it.

Relevant files: src/ui/devices/device-actions.ts, src/ui/devices/devices-api.ts, src/ui/devices/place-device.ts, src/ui/devices/PlaceDeviceDialog.tsx, src/ui/devices/DevicesPage.tsx, src/ui/copy/devices.ts, src/ui/rooms/DeleteRoomDialog.tsx, src/app/api/devices/[id]/route.ts, work/tickets/SIM-013.2/plan.md.
