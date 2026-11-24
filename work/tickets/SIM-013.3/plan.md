Status: READY

# Plan — SIM-013.3: Device place, move and return dialog

## Scope summary
Ticket scope (`work/tickets/SIM-013.3/ticket.md`):
> - `PlaceDeviceDialog`: seat picker, role select (primary offered only when the rules allow it, secondary by default); covers place, lend, move and return to inventory via `PUT /api/devices/[id]/placement` (SIM-013).
> - Row actions gated by the server's `canPlace` flag; refusal codes shown with their messages.
> - Out of scope: Placing devices from the room map.
> - Technical notes: Uses `src/lib/devices/rules.ts` (SIM-013) for which roles to offer; the server stays the guard.

Spec `docs/spec-v1.md`:
> **DEV-03 Role at seat** (l.273-276)
> - Placing a device as primary is refused unless the seat has an occupant, that occupant owns the device, and the seat has no primary yet (invariant 3). The check runs in the app and again in the DB.
> - Secondary placement has no ownership check.
>
> **DEV-04 Lend a device to another seat** (l.278-280)
> - The device's owner places it as secondary on any seat. A borrowed device is never primary.
> - A Manager+ may do this for any device of the org (D19).
>
> **DEV-05 Move device** (l.282-284)
> - A device moves seat to seat (it takes the chosen role; the DEV-03 rules apply) or back to inventory.
> - The owner moves their own devices; a Manager+ moves any device of the org (D19).
>
> **REG-03** (l.389) - A user returns their own device from a seat to inventory.

`work/decisions.md`:
> D19 — Managers and Admins place, move and return any device of the org; editing/deleting a device is owner or Admin only.
> D22 — REG-03 in v1: users release their own seat without approval and return their own devices to inventory.
> D36 — UI copy is English by default; all user-facing text lives in copy files.

SIM-013.2 plan, "Adopted for later slices" (ux-architect): action labels that include the inventory number; hiding the actions column when no row has an action. SIM-013.2 split proposal: "The first of SIM-013.3, SIM-013.4 and SIM-013.5 to merge adds the actions column."

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A member places, lends, moves and returns their own device; a Manager+ does this for any device; a User sees no place action on another member's device. | The server computes `canPlace` (`src/lib/devices/rules.ts:5-6`, already tested in SIM-013). UI: `device-actions.test.ts` › "no actions when canPlace is false", "place for an unplaced device", "move and return for a placed device". `DevicesView.test.tsx` › "actions column only when a row has an action", "Place / Move / Return buttons per canPlace row". `PlaceDeviceDialog.test.tsx` › "lend label when the chosen seat's occupant is not the owner". Local run (`pnpm dev`): as the dev account, place one's own device on a seat, move it, and return it; the row updates each time. |
| 2 | Primary placement refusals show their message, and the list refreshes after a change. | `PlaceDeviceDialog.test.tsx` › "shows the refusal message in the alert" (each of `seat_has_no_occupant`, `owner_not_occupant`, `seat_has_primary`, `placement_changed`, `not_allowed` renders `apiErrorMessage(code)`). `place-device.test.ts` › "settle: ok → done; placement_changed → refetch; not_found → done". `devices-state.test.ts` › "refresh keeps rows and status until the answer", "a refresh answer replaces the rows". Local run: after a placement the row shows the new seat without the loading skeleton. |
| 3 | Pure-logic and static-render tests cover which actions and roles the dialog offers. | `place-device.test.ts` › the `offeredRoles` cases; `device-actions.test.ts`; `PlaceDeviceDialog.test.tsx` › "primary radio only when offered". `pnpm test` green. |

## Ming verification after merge
- Ticket Test plan "Manual (Ming)": lend and move devices between seats on real data (a seat whose occupant is another member, and the owner's own seat as primary), and see the Manager view place another member's device.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/devices/place-device.ts` | Create. Pure dialog logic: `PlaceMode`, `placeModes`, `seatTarget`, `offeredRoles`, `primaryRefusal`, `placeVerb`, `toPlacementBody`, `planSubmit`, `settle`. | Pure logic first (AC 3). | No |
| `src/ui/devices/place-device.test.ts` | Create. | R5. | No |
| `src/ui/devices/device-actions.ts` | Create. Pure `rowActions(device, handlers)` → action descriptors; `hasAnyAction(devices, handlers)`. The single extension point for SIM-013.4/.5. | Row actions gated by `canPlace`; shared column. | No |
| `src/ui/devices/device-actions.test.ts` | Create. | R5. | No |
| `src/ui/devices/DeviceRowActions.tsx` | Create. Renders `rowActions` as small buttons; used by the table cell and the mobile card. | One component siblings extend. | No |
| `src/ui/devices/PlaceDeviceDialog.tsx` | Create. Outer (mounted while open, keyed by device id) / inner (state, calls) / `PlaceDeviceFields` (props only). | The dialog. | No |
| `src/ui/devices/PlaceDeviceDialog.test.tsx` | Create. Static render of `PlaceDeviceFields`. | R5, AC 2-3. | No |
| `src/ui/devices/usePlaceTargets.ts` | Create. Hook: room list via `useRooms` (`src/ui/rooms/useRooms.ts`) and seats of the chosen room via `seatsApi.list(roomId)` with a stale-answer guard. | Two-step seat picker. | No |
| `src/ui/devices/devices-api.ts` | Modify. Add `get(id)` and `place(id, body)`. | PUT placement; refetch after `placement_changed`. | No |
| `src/ui/devices/devices-api.test.ts` | Modify. Tests for `get` and `place`. | R5. | No |
| `src/ui/devices/devices-state.ts` | Modify. Add the `{type:"refresh", id}` event (keeps rows). | Silent refresh after a change. | No |
| `src/ui/devices/devices-state.test.ts` | Modify. Refresh tests. | R5. | No |
| `src/ui/devices/useDevices.ts` | Modify. Add `refresh()` next to `reload()`. | Silent refresh. | No |
| `src/ui/devices/DeviceTable.tsx` | Modify. Optional actions column (header `sr-only`) and an actions slot in the mobile card, both rendering `DeviceRowActions`; new prop `actions?: DeviceRowHandlers`. | Row actions. | No |
| `src/ui/devices/DevicesView.tsx` | Modify. New prop `actions?: DeviceRowHandlers`, passed to `DeviceTable`; doc comment drops "Read-only in this slice". | Row actions; View stays pure. | No |
| `src/ui/devices/DevicesView.test.tsx` | Modify. Add action tests; keep the existing "no action controls" test (all fixtures have `canPlace:false`). | R5. | No |
| `src/ui/devices/DevicesPage.tsx` | Modify. `placing` state, rooms/seats apis, mounts `PlaceDeviceDialog`, `refresh()` after a change. | Wire-up. | No |
| `src/ui/copy/devices.ts` | Modify. Add `actions` and `place` groups. | D36. | No |

No file matches a High path in `.claude/loop.config.md`. No change to `src/server/**`, `src/app/api/**`, `src/lib/**` or `src/ui/copy/api.ts`.

## Data model / migration
None.

## API contract
No endpoint change. The UI calls existing endpoints:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | `/api/devices/[id]/placement` (`src/app/api/devices/[id]/placement/route.ts`) | `{seatId: uuid, role, expectedSeatId: uuid\|null}`, or for return `{seatId: null, expectedSeatId}` (no `role`; `src/lib/validate/device.ts:35-49` rejects unknown keys) | 200 `DeviceDto` (no-op also 200) | 400 `invalid_request`, 404 `not_found`, 409 `placement_changed` / `seat_has_no_occupant` / `owner_not_occupant` / `seat_has_primary`, 422 `not_allowed` | user tier; owner or Manager+ (D19) |
| GET | `/api/devices/[id]` (`src/app/api/devices/[id]/route.ts:13-23`) | — | 200 `DeviceDto` | 404 `not_found` | user tier |
| GET | `/api/rooms` (`createRoomsApi().list()`, `src/ui/rooms/rooms-api.ts:52-58`) | — | `RoomDto[]` | — | user tier |
| GET | `/api/rooms/[id]/seats` (`createSeatsApi().list(roomId)`, `src/ui/seats/seats-api.ts:63-68`) | — | `RoomSeatsResponse` (≤ 500 seats, ≤ 20 devices each) | 404 `not_found` | user tier |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `place-device.test.ts` › placeModes: `[]` when `!canPlace`; `["place"]` when unplaced; `["move","return"]` when placed | AC 1, 3 |
| `place-device.test.ts` › offeredRoles: seat with no occupant → `["secondary"]` | DEV-03 |
| `place-device.test.ts` › offeredRoles: occupant is the owner, no primary → `["secondary","primary"]` | DEV-03 |
| `place-device.test.ts` › offeredRoles: occupant is another member → `["secondary"]` (lend never primary) | DEV-04 |
| `place-device.test.ts` › offeredRoles: owner's seat already has another device as primary → `["secondary"]` | invariant 3 |
| `place-device.test.ts` › offeredRoles: the device itself is that seat's primary (role change on the current seat) → primary offered | rules.ts:52 |
| `place-device.test.ts` › primaryRefusal returns the code (`seat_has_no_occupant` / `owner_not_occupant` / `seat_has_primary`) or null | hint text |
| `place-device.test.ts` › seatTarget takes `primaryId` from `devices` role `primary` (null when none) | primary detection |
| `place-device.test.ts` › placeVerb: unplaced → place; placed → move; occupant not the owner → lend; empty seat → place/move | DEV-04 label |
| `place-device.test.ts` › toPlacementBody: place `{seatId, role, expectedSeatId:null}`; move `expectedSeatId = placement.seatId`; return `{seatId:null, expectedSeatId}` with no `role` key | body shape |
| `place-device.test.ts` › planSubmit: no seat chosen → `invalid` with `devicesCopy.place.pickSeat`; same seat and role → `noop`; otherwise `send`; a role not in offeredRoles falls back to secondary | submit |
| `place-device.test.ts` › settle: ok → `done`; `placement_changed` → `refetch`; `not_found` → `done`; other codes → `error` with `apiErrorMessage(code)` | AC 2 |
| `device-actions.test.ts` › no actions when canPlace is false (User on another member's device) | AC 1 |
| `device-actions.test.ts` › place for an unplaced device; move and return for a placed device; aria-labels include the inventory number; no handler → no action | AC 1 |
| `device-actions.test.ts` › hasAnyAction false when no row can place, true otherwise | hidden column |
| `devices-api.test.ts` › place: PUT `/api/devices/<id>/placement` with JSON body and content-type; 200 DeviceDto → ok; body without string `id` → internal; 409 code passed through | API |
| `devices-api.test.ts` › get: GET `/api/devices/<id>`; ok; bad shape internal; 404 `not_found` | API |
| `devices-state.test.ts` › refresh keeps rows and status until the answer | silent refresh |
| `devices-state.test.ts` › a refresh answer replaces the rows; a stale answer is ignored | AC 2 |
| `DevicesView.test.tsx` › actions column only when a row has an action (7 `th` with an action row, 6 without) | column |
| `DevicesView.test.tsx` › Place / Move / Return buttons per canPlace row, none on a canPlace:false row, in both the table and the card list | AC 1 |
| `PlaceDeviceFields` in `PlaceDeviceDialog.test.tsx` › room select lists rooms; seat radiogroup lists seat code, occupant or "Empty", "Has a primary device", "Cannot seat" and "Current" hints | picker |
| `PlaceDeviceDialog.test.tsx` › primary radio only when offered; secondary checked by default; hint text shown when primary is not offered for the chosen seat | AC 3 |
| `PlaceDeviceDialog.test.tsx` › lend label when the chosen seat's occupant is not the owner | DEV-04 |
| `PlaceDeviceDialog.test.tsx` › return mode shows the confirm sentence with the seat code and no picker | REG-03 |
| `PlaceDeviceDialog.test.tsx` › shows the refusal message in the alert (each placement code) | AC 2 |
| `PlaceDeviceDialog.test.tsx` › loading / error (with retry) / empty states for rooms and seats; truncated seat notice | picker states |

Static-render tests use `renderToStaticMarkup` (no jsdom), as `DevicesView.test.tsx` and `MemberPickerDialog.test.tsx` do. `PlaceDeviceFields` is tested directly; `EntityFormDialog` is not needed in the test (it only wraps children).

## Approach
1. **Copy** (`src/ui/copy/devices.ts`). Add:
   - `columns.actions: "Actions"` (header is `sr-only`).
   - `actions: { place: "Place", move: "Move", return: "Return", placeAria: (inv) => \`Place device ${inv}\`, moveAria: (inv) => \`Move device ${inv}\`, returnAria: (inv) => \`Return device ${inv} to inventory\` }`.
   - `place: { titles: { place, move, return }, submit: { place: "Place", lend: "Lend", move: "Move", return: "Return to inventory" }, room: "Room", seats: "Seat", role: "Role", roomsLoading, roomsError, roomsEmpty, seatsLoading, seatsError, seatsEmpty, seatsTruncated: (n) => ..., pickRoom: "Choose a room", pickSeat: "Choose a seat.", emptySeat: "Empty", current: "Current", hasPrimary: "Has a primary device", cannotSeat: "Cannot seat", lendHint: (name) => \`Lent to ${name}'s seat as secondary.\`, primaryUnavailable: "Primary is not available for this seat.", returnConfirm: (inv, seatCode) => \`Return ${inv} from seat ${seatCode} to inventory?\` }`.
   - Role labels reuse `devicesCopy.roles`. Refusal messages come from `apiErrorMessage` (`src/ui/copy/api.ts:24,36-39`); `api.ts` is not changed.
2. **API** (`devices-api.ts`). Inside `createDevicesApi`, add `isDevice = (b) => typeof b === "object" && b !== null && typeof b.id === "string"` and:
   - `get(id)`: GET `/api/devices/${encodeURIComponent(id)}`, `isDevice` or `fail("internal")`.
   - `place(id, body: PlacementBody)`: PUT `/api/devices/${encodeURIComponent(id)}/placement`, `content-type: application/json`, `JSON.stringify(body)`, same check.
   - `PlacementBody = { seatId: string; role: DeviceRole; expectedSeatId: string | null } | { seatId: null; expectedSeatId: string | null }` is exported from `place-device.ts` as a type and imported with `import type` (no runtime cycle). SIM-013.5's "Move to inventory" reuses `place(id, {seatId:null, expectedSeatId})` and `get`; it does not need its own `moveToInventory`.
3. **Pure logic** (`place-device.ts`, imports only `@/lib/devices/*`, `@/lib/seats/types` and copy):
   - `type PlaceMode = "place" | "move" | "return"`; `placeModes(d)` per the tests.
   - `seatTarget(seat: SeatDto)` → `{ seatId, occupantId: seat.occupant?.id ?? null, primaryId: seat.devices.find(x => x.role === "primary")?.id ?? null }`. This is reliable despite the 20-device cap: the server orders a seat's devices primary first (`src/server/seats/seats.ts:120`, `order by (d.role = 'primary') desc`), and a seat has at most one primary (invariant 3).
   - `primaryRefusal(d, seat)` calls `decidePlacement` (`src/lib/devices/rules.ts:44`) with `role: "primary"`, `target: seatTarget(seat)`, `current/expectedSeatId` from `d.placement`, and the permission inputs `tier: "user", isOwner: true` (permission is the server's `canPlace`, already true when the dialog opens; comment this). Returns the refusal code or null. `offeredRoles(d, seat)` = `primaryRefusal === null ? ["secondary","primary"] : ["secondary"]`. One rule, in lib; the server remains the guard.
   - `placeVerb(d, seat)`: `"lend"` when `seat.occupant !== null && seat.occupant.id !== d.owner.id`, else `d.placement ? "move" : "place"`.
   - `toPlacementBody(d, target: {seatId, role} | null)`: `expectedSeatId = d.placement?.seatId ?? null`; null target → `{seatId:null, expectedSeatId}`.
   - `planSubmit(d, mode, seat | null, role)` → `{kind:"invalid", message} | {kind:"noop"} | {kind:"send", body}`. Return mode always sends. A role not offered is coerced to secondary. Noop = `decidePlacement(...).kind === "noop"` (same seat and role), and the dialog then just closes.
   - `settle(result)` → `{kind:"done", device?} | {kind:"refetch", message} | {kind:"error", message}` per the tests.
4. **Row actions** (`device-actions.ts`, pure):
   - `export type DeviceRowHandlers = { onPlace?: (device: DeviceDto, mode: PlaceMode) => void }`. SIM-013.4 adds `onEdit?`, SIM-013.5 adds `onDelete?` (both gated by `canEdit`), each appending entries in `rowActions`.
   - `export type RowAction = { key: string; label: string; ariaLabel: string; run: () => void }`.
   - `rowActions(d, h)`: if `h.onPlace`, map `placeModes(d)` to actions with labels from `devicesCopy.actions`. `hasAnyAction(devices, h)` = some row has ≥ 1 action.
   - `DeviceRowActions.tsx`: `({device, handlers})` → `<div className="flex flex-wrap gap-1.5">` of `Button variant="tonal" size="sm"` with `aria-label`; renders nothing when empty.
5. **Table and View**:
   - `DeviceTable` takes `actions?: DeviceRowHandlers` (default `{}`). `const showActions = hasAnyAction(devices, actions)`. When true: a final `<th scope="col" className={HEAD}><span className="sr-only">{devicesCopy.columns.actions}</span></th>` and a final `<td className={CELL}><DeviceRowActions …/></td>`; the `COLUMNS` const is unchanged. Mobile card: `<DeviceRowActions …/>` after the MAC line (renders nothing when no action).
   - `DevicesView` adds `actions?: DeviceRowHandlers` and passes it through. It stays pure.
6. **Silent refresh**:
   - `devices-state.ts`: event `{type:"refresh", id}` → `{...state, latest: id}` (rows and status kept); the existing `loaded` branch then applies the answer. An error answer shows the error card, as today.
   - `useDevices.ts`: `refresh = useCallback(async () => { const id = ++counter.current; dispatch({type:"refresh", id}); const r = await api.list(filter); if (mounted.current) dispatch({type:"loaded", id, result: r}); }, [api, filter])`; return `{ ...state, reload, refresh }`. A device that leaves the current filter (for example returned while "Placed" is shown) drops out of the list on refresh.
7. **Picker hook** (`usePlaceTargets.ts`, `"use client"`): `usePlaceTargets(roomsApi, seatsApi, initialRoomId: string | null)`.
   - `rooms = useRooms(roomsApi)`; `roomId` state starts at `initialRoomId` (the device's `placement.roomId` when moving).
   - Seats state `{status, seats, truncated, errorCode}` loaded when `roomId` changes, with a counter + mounted guard as in `useRoomSeats.ts:57-78`; `roomId === null` → idle with no call.
   - Returns `{ rooms, roomId, setRoomId, seats, retrySeats }`.
8. **Dialog** (`PlaceDeviceDialog.tsx`, `"use client"`), the `RoomFormDialog` pattern (`src/ui/rooms/RoomFormDialog.tsx:21-82`):
   - Outer `PlaceDeviceDialog({ open, device, mode, devicesApi, roomsApi, seatsApi, onClose, onStale, onDone })`: `if (!open || !device) return null`; renders `<PlaceDeviceInner key={`${device.id}:${mode}`} …/>`.
   - Inner state: `current` (a local copy of the device, initialised from the prop), `seatId`, `role` (default `"secondary"`), `error`, `submitting`. Changing the room clears `seatId`; changing the seat resets `role` to secondary when primary is no longer offered.
   - Submit: `planSubmit` → invalid (show message) / noop (`onClose()`) / send → `devicesApi.place(current.id, body)` → `settle`:
     - `done` → `onDone()` (page closes and refreshes).
     - `refetch` (`placement_changed`) → show the message, call `devicesApi.get(current.id)`: ok and still `canPlace` and the mode still applies (`placeModes(fresh)` includes `mode`) → `setCurrent(fresh)` so the next try sends the fresh `expectedSeatId`; otherwise `onDone()`. The page list is refreshed through `onDone` only when the dialog closes; also call an `onStale()` prop that triggers `refresh()` so the row behind the dialog is current.
     - `error` → `setError(message)` (all five refusal codes, `not_allowed` included).
   - `EntityFormDialog` with `title = devicesCopy.place.titles[mode]`, `subtitle = device name · inventory number`, `submitLabel = devicesCopy.place.submit[mode === "return" ? "return" : placeVerb(current, seat) ]` (`place` until a seat is chosen).
   - `PlaceDeviceFields` (exported, props only): in return mode, one `<p>` with `returnConfirm(inv, seatCode)`; otherwise
     - `DialogSelect` (`src/ui/EntityFormDialog.tsx:143-163`) for the room, first option `pickRoom` (empty value); rooms loading/error(+retry)/empty text.
     - Seat `role="radiogroup"` (`aria-label = copy.seats`, `aria-busy` while loading, `max-h-[35dvh] overflow-y-auto`, as `MemberPickerDialog.tsx:53-57`), one `<label><input type="radio" name="seat">` per seat: seat code, occupant name or `emptySeat`, and muted hints `current` (device's current seat), `hasPrimary` (another device is primary there), `cannotSeat`. No seat is disabled (see Assumption 1). Loading/error(+retry)/empty and the truncated notice (`SEAT_LIMITS.list`).
     - Role `role="radiogroup"` (`aria-label = copy.role`) from `offeredRoles`: Secondary always, Primary only when offered; when a seat is chosen and primary is not offered, a muted `primaryUnavailable` line; when `placeVerb === "lend"`, `lendHint(occupant name)`.
   - Errors are shown by `EntityFormDialog`'s `role="alert"` line.
   - Focus: `EntityFormDialog` restores focus to the element focused before opening (`EntityFormDialog.tsx:45-50`), i.e. the row's action button.
9. **Page** (`DevicesPage.tsx`):
   - `roomsApi = useMemo(() => createRoomsApi(apiFetch))`, `seatsApi = useMemo(() => createSeatsApi(apiFetch))`.
   - `const [placing, setPlacing] = useState<{device: DeviceDto; mode: PlaceMode} | null>(null)`.
   - `actions = useMemo(() => ({ onPlace: (device, mode) => setPlacing({device, mode}) }), [])` passed to `DevicesView`.
   - Mount `<PlaceDeviceDialog open={placing !== null} … onClose={() => setPlacing(null)} onStale={() => void refresh()} onDone={() => { setPlacing(null); void refresh(); }} />`.
   - Session or tier is not read: `canPlace` comes from the server.
10. Run every Check: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules:
- R1: all new files are in `src/ui/devices/` and import only `@/lib/*` (`@/lib/devices/rules`, `@/lib/devices/types`, `@/lib/seats/types`, `@/lib/rooms/types`, `@/lib/api/fetch`) and `../*` UI modules (`../rooms/useRooms`, `../rooms/rooms-api`, `../seats/seats-api`, `../EntityFormDialog`, `../Button`, copy). No `src/server/**` import. `pnpm check:layers` enforces it.
- R7: no server change. The client adds no retry of its own; `apiFetch`'s single resend after 401/403 is safe because the PUT is idempotent (a repeat is a 200 no-op).
- R6: the server scopes the PUT, GET and seat list by the token's org; the UI sends no org id.
- D36: every visible string comes from `devicesCopy` or `apiErrorMessage`.
- R4: no create, edit, delete, map placement or server change.
- R5: the tests above.
- R2, R3: not applicable.

## Specialist input used
frontend-developer (`consult-frontend-developer.md`):
- **Adopted:** pure `place-device.ts` with `placeActions` (named `placeModes`), `offeredRoles` built on `decidePlacement`, and the body builder (Rec. 1); `place` in `devices-api.ts` with a shape check (Rec. 2); the `RoomFormDialog` outer/inner pattern with a props-only Fields component (Rec. 3); room-then-seat picker using `createRoomsApi`/`createSeatsApi` (Findings); preselecting the current room (Rec. 3); a silent refresh instead of the skeleton reload (Rec. 4); one `DeviceRowActions` component and one `actions` handler object as the extension point for SIM-013.4/.5 (Rec. 6); the test list (Rec. 7); the `max-h` scroll container (Risks).
- **Changed:** the "primary may be past the 20-device cap" risk does not apply: the server orders a seat's devices primary first (`src/server/seats/seats.ts:120`), so `seatTarget` is reliable and no "keep primary offered on truncation" branch is needed. Return is a separate row action that opens the same dialog in return mode (one confirm sentence, no picker) rather than a button inside the move dialog, so every `canPlace` row shows its actions directly and the refusal surface stays the dialog. On `placement_changed` the dialog refetches the device with a new `get` and stays open, so "Refresh and try again" works in place.
- **Not adopted:** patching the returned `DeviceDto` into state with a reducer action (Rec. 4 option): a filtered list would need filter logic on the client; a silent refresh covers it with less code. Disabling `cannotSeat` seats (Rec. 1, last bullet): see Assumption 1.
- **Open questions answered:**
  - Q1 (cannot-seat): the spec blocks only assignment and requests on a cannot-seat seat (SEA-01, l.232-233: "Such a seat cannot be assigned or requested"); DEV-03/04/05 add no such rule and the server has none. The UI allows placement there and shows a "Cannot seat" hint. Primary still needs an occupant who owns the device (DEV-03).
  - Q2 (lend): a label only. DEV-04 defines lending as secondary placement on another seat, and the server treats it as place/move (`rules.ts:56`). The submit button reads "Lend" when the chosen seat's occupant is not the owner.
  - Q3 (confirm return): the return dialog is a single confirm sentence plus the submit button; it doubles as the place to show a refusal. See Assumption 2.
  - Q4 (silent vs full reload): silent refresh (step 6).
  - Q5 (siblings): yes. SIM-013.4 adds Edit and SIM-013.5 adds Delete, both gated by `canEdit` (their ticket scopes), in the same `DeviceRowActions` component through `DeviceRowHandlers`.

## Assumptions
1. Devices may be placed on a cannot-seat seat (spec SEA-01 only blocks assign/request; the server has no check). Default: allowed, with a "Cannot seat" hint. If Ming wants it blocked, it needs a server rule first (follow-up).
2. Return to inventory opens a small confirm dialog (one sentence, "Return to inventory" button), not a one-click row action. Reason: the refusal messages need a place to show, and an accidental click on a placed primary device would otherwise demote it silently. Default: keep the confirm.
3. The role defaults to Secondary every time a seat is chosen, also when moving a device that is currently primary (ticket: "secondary by default"). Picking the current seat with the other role is a role change (`decidePlacement` returns `move`).
4. The seat picker lists one room at a time (up to 500 seats, `SEAT_LIMITS.list`) with the truncated notice; there is no cross-room seat search. A search box is a follow-up if rooms get large.
5. Focus returns to the opener through `EntityFormDialog`. When the opener is gone after the refresh (for example "Place" became "Move" with a new key), focus falls back to the document; moving it to the h1 (as planned for SIM-013.5's delete) is a follow-up if Ming wants it.
6. Duplicating the `isDevice` check pattern from `seats-api.ts:26-27` is accepted, as SIM-013.2 Assumption 4 accepted the copied `call` helper (follow-up: shared `src/ui/api-call.ts`).
7. Estimated size: about 420 source lines plus about 300 test lines. That is near the ~400-line guide but one coherent dialog, so no split.
8. Hotspots: SIM-013.4 and SIM-013.5 (BACKLOG) will edit `DeviceTable.tsx`, `DevicesView.tsx`, `DevicesPage.tsx`, `device-actions.ts`, `devices-api.ts`, `devices-state.ts`/`useDevices.ts` (they reuse `refresh`) and `src/ui/copy/devices.ts`; they should rebase onto this ticket and only append handlers and entries. SIM-013.5 should reuse `devicesApi.place` and `get` from this ticket instead of adding `moveToInventory`. No other ticket is `IN_PROGRESS`, `REVIEW` or `DONE`.

## Blocking questions
None.

## Split proposal
None.
