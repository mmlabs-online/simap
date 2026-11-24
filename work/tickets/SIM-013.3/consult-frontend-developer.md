# Consult — frontend-developer (SIM-013.3)

## Findings

- **Devices UI today is read-only.** `DevicesView` props are `status/devices/truncated/errorCode/filter/onFilter/onRetry`. `DeviceTable` has 6 columns (the `COLUMNS` const) plus a stacked-card list below `md`. It has no actions column. `DevicesPage` owns `useDevices(api, filter)`, which already exposes `reload()`. `devices-api.ts` has only `list`. Its `call` helper and `errorCode` are copied per feature (rooms-api and seats-api do the same), so copying them again is the convention.
- **`DeviceDto` carries what we need.** It has `canPlace` (server-computed, owner or Manager+), `mine`, `placement {seatId, seatCode, roomId, roomCode, role}|null` and `owner.id`. Returned from PUT: the full updated `DeviceDto`.
- **Placement endpoint**: `PUT /api/devices/[id]/placement`, tier `user`.
  - Body: `{seatId: uuid|null, expectedSeatId: uuid|null, role}`. The validator rejects unknown keys.
  - Return to inventory is `seatId:null`, and `role` must be omitted or `"secondary"`. A non-null `seatId` requires `role`.
  - `expectedSeatId` must be the device's current `placement?.seatId ?? null`. A mismatch gives 409 `placement_changed`.
  - Refusals:
    - 422 `not_allowed`.
    - 409 `placement_changed`, `seat_has_no_occupant`, `owner_not_occupant`, `seat_has_primary`.
    - 404 `not_found` (device or seat gone).
  - A no-op (same seat and role, or already in inventory) returns 200 with the unchanged device.
  - Messages for all five refusal codes already exist in `src/ui/copy/api.ts` (lines ~36-39 and `not_allowed`), so `apiErrorMessage(code)` is enough.
- **`src/lib/devices/rules.ts` is pure and shared.** `decidePlacement` needs the seat's `occupantId` and `primaryId`.
  - **`primaryId` is not available from `SeatDto`.** `SeatDto.devices` is a `SeatDeviceDto[]` with a `role`, but it is capped at `SEAT_LIMITS.listDevices` (20) in the list. A primary can be derived from it (`devices.find(d => d.role==="primary")`), but only reliably when `deviceCount <= 20`.
- **There is no seat picker.** `src/ui/seats` has only a member picker (`MemberPickerDialog`, `useMemberPicker`, `member-picker.ts`), and its patterns are reusable: a radiogroup, `blocksSearchEnter`, load-more.
  - Seats are listed per room only: `GET /api/rooms/[id]/seats` (user tier, up to 500 items, returns `SeatDto` with occupant, status, `cannotSeat`, `devices`, `roomCode`). The rooms list is `GET /api/rooms` via `createRoomsApi().list()`.
  - The picker therefore needs two steps: choose a room, then a seat. It would use `createRoomsApi(apiFetch)` and `createSeatsApi(apiFetch).list(roomId)`.
- **Dialog template.** `EntityFormDialog` takes `open/title/submitLabel/submitting/error/onClose/onSubmit`, plus `DialogField`. `RoomFormDialog` is the template. It is mounted only while open (`if (!open) return null`), keyed per entity, holds `error` and `submitting` state, calls the api, maps failure to `apiErrorMessage(code)`, and calls `onDone` on success. `MemberPickerDialog` splits an inner component and a props-only Fields component, which keeps static-render tests easy (`MemberPickerDialog.test.tsx`, `SeatActionDialogs.test.tsx`).
- **No existing `Select` form control was checked.** Use a native radiogroup or `<select>` for the role. Static-render tests only need markup.

## Recommendations

1. **Pure logic in `src/ui/devices/place-device.ts` (+ test).** Covers AC 3.
   - `placeActions(device)` returns `[]` when `!device.canPlace`. Otherwise it returns `place` (no placement), or `move` and `return` (placed). "Lend" is place or move onto a seat whose occupant is not the owner. It is one dialog, and the title or help text changes with the target (`lend` when the occupant is not the owner).
   - `offeredRoles(device, seat)` returns `["secondary"]` plus `"primary"` only when `seat.occupant?.id === device.owner.id` and the seat has no other primary. Other primary means a `seat.devices` entry with `role==="primary"` and `id !== device.id`. If `seat.deviceCount > seat.devices.length` (the cap truncated the list), keep primary offered but rely on the server refusal, or disable it with a hint. Prefer reusing `decidePlacement` from rules.ts for a preview (build `target` from the seat) so the rule lives in one place. Default role is secondary.
   - `toPlacementBody(device, seatId|null, role)` sets `expectedSeatId = device.placement?.seatId ?? null`. For return it sends `{seatId:null, expectedSeatId}` with no role.
   - Disable the seat options that are `cannotSeat` for primary only. Do not assume the rule: check the spec for whether a cannot-seat seat can hold secondary devices (see open questions).
2. **API.** Add `place(deviceId, body)` to `devices-api.ts`: PUT with a JSON body, validate the result as `DeviceDto` (object with a string `id`), and fail with `internal` otherwise. Extend `devices-api.test.ts`.
3. **Component `PlaceDeviceDialog.tsx`**, following the `RoomFormDialog` pattern.
   - Props: `open, device, roomsApi, seatsApi, placeApi (DevicesApi), onClose, onDone`. It is mounted only while open and keyed by `device.id`.
   - UI: room select, then a seat radiogroup (loaded per room, each row showing seat code, occupant and a "has primary" hint), and a role radiogroup from `offeredRoles`.
   - Return to inventory is a separate secondary button in the same dialog, shown only when placed. Alternatively it is a "In inventory" option at the top of the picker, which gives one submit path. Pick one; a single PUT in both cases.
   - Show a refusal with `apiErrorMessage(code)` inside the dialog (`error` prop). On `placement_changed` or `not_found`, also call `onDone`/reload so the stale row refreshes, as `RoomFormDialog` does for `not_found`.
   - Keep a Fields-only component with props (state, handlers) for static-render tests, as in `MemberPickerFields`.
   - Preselect the room of the current placement (`placement.roomId`) when moving.
4. **Wire-up.**
   - Add a state `placing: DeviceDto | null` in `DevicesPage` (or `DevicesView`, which stays pure and takes `onPlace(device)`).
   - Table: add an "Actions" column header (`sr-only` text is fine) and render a button per row from `placeActions`. The mobile card gets the same button.
   - After success, call `reload()`. Note `useDevices.reload` flips the status to loading and shows skeletons. Prefer a silent refresh, or patch the returned `DeviceDto` into state with a new reducer action. That avoids losing scroll and focus, and it also handles the filter case where the device leaves the filtered list.
   - Return focus to the row's action button, or to the heading, when the dialog closes.
5. **Copy**: add `place` to `src/ui/copy/devices.ts`: dialog titles for place, lend, move and return, field labels, role labels, button texts, and loading, empty and error strings (D36).
6. **Sibling tickets (013.4 / 013.5) may also add the row-actions column.** Reduce conflicts by creating the actions column in this ticket as one `DeviceRowActions` component (`device, onPlace`) rendered from a single `<td>` and one card slot. Siblings then append buttons to that component rather than reshape the table. Pass handlers through one `actions` prop object (`{ onPlace }`) on `DevicesView` and `DeviceTable`. Check `work/tickets/SIM-013.4` and `SIM-013.5` before building, and merge or rebase on whichever lands first.
7. **Tests** (R5):
   - Pure: `placeActions` for User on another member's device (none), for owner, and for Manager.
   - Pure: `offeredRoles` for a seat with no occupant, with the owner, with another occupant, and with another primary.
   - Pure: the body builder (`expectedSeatId` and the return shape).
   - Static render: the table shows an action only when `canPlace`, and the dialog shows or hides the primary option.
   - `devices-api` place: success, error code, bad shape.

## Risks

- **Seat list cap.** `GET /rooms/[id]/seats` caps at 500 seats and 20 devices per seat, so the primary check can be stale or incomplete in the UI. The server stays the guard, so keep the refusal messages reachable.
- **A reload that blanks the list** after every placement hurts the UX unless it is silent (see 4).
- **Stale `expectedSeatId`.** If the dialog is open for a long time, the PUT returns 409 `placement_changed`. Refresh the row after that error.
- **R7.** The client re-sends once on 401/403 (`apiFetch`). The PUT is idempotent (a no-op returns 200), so a retry is safe.
- **R1.** The dialog must only import from `@/lib/**` and `ui` (`rules.ts` is in lib, so that is fine). Do not import `src/server/**`.
- **Row-action conflicts with 013.4 and 013.5** (see 6).
- **Many rooms and seats** (500 seats per room) in a radiogroup. A scroll container and a `max-h` like the member picker are needed.

## Open questions

1. Does the spec allow placing a device on a `cannotSeat` seat (secondary or primary)? Check `docs/spec-v1.md` (DEV-03, REG-03). The server rule (`decidePlacement`) has no cannot-seat check, so the UI should not invent one.
2. Is "lend" a distinct action or only a label for placing at a seat whose occupant is not the owner? The server treats it as place or move. I recommend the label only.
3. Should return-to-inventory ask for confirmation? The action is reversible, so I recommend none.
4. Silent in-place update versus full `reload` after a change. This needs a decision, and it affects the reducer in `devices-state.ts`.
5. Are 013.4 and 013.5 going to add Edit and Delete in the same column (`canEdit` exists on the DTO)? That decides the shape of the shared actions component.
