Status: READY

# Plan — SIM-013.2: Devices page UI (slice 1 of 3: list, placement and filter)

The whole ticket comes to about 1,000 source lines without tests (see `## Split proposal`), so this plan covers
**slice 1 only**. Slice 1 is a read-only Devices page. It lists every device with its placement and filters by
all / placed / inventory on the server. Create and edit are planned for **SIM-013.4**, and delete with "Move to
inventory" for **SIM-013.5**. Both sub-IDs are free in `work/backlog.md`, which has rows up to SIM-013.3 only. The
split proposal also records the decisions already made for those slices, so their planners do not reopen them.

## Scope summary
- `docs/spec-v1.md` DEV-02 (line 270): "Every device list and device detail shows "at seat X" or "in inventory". The
  Devices page filters by all / placed / inventory." **This slice covers it.**
- DEV-01 (lines 260-267): type datalist (D37), create for self or (Admin) anyone, edit/delete by owner or Admin
  (D19), "Editing a device cannot change its owner", and "Deleting a device that is placed at a seat is blocked: a
  warning … offers "Move to inventory"; delete is allowed once it is in inventory (D31)". **This goes to SIM-013.4
  and SIM-013.5.**
- `work/decisions.md`:
  - D36: "UI copy is English by default; all user-facing text lives in copy files … Names/data keep Vietnamese
    diacritics (display, sort, search)."
  - D19 and D31 apply to the later slices.
  - D37: "Device type: suggested list (PC, Laptop, Monitor, IP phone, Other) plus free text." (SIM-013.4)
- Ticket AC1: "The Devices list shows placement for every device, and the filter shows all, placed or inventory
  devices." Ticket AC4 (part): "View and pure-logic tests (static render, no jsdom) cover the table, the filter …"

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The Devices list shows placement for every device: "At seat X" (with its role) or "In inventory". | `src/ui/devices/DevicesView.test.tsx` › "table and stacked list show 'At seat C302-01' with a Primary/Secondary tag and a link to /rooms/C302 for a placed device, and 'In inventory' for an unplaced one". `devices-state.test.ts` › "placementText". |
| 2 | The filter shows all, placed or inventory devices, applied on the server. | `devices-api.test.ts` › "list(filter) sends GET /api/devices?placement=<filter>". `DevicesView.test.tsx` › "filter chips: three radios, the active one aria-checked". `devices-state.test.ts` › "a stale answer for an older filter is dropped". |
| 3 | Loading, error (with retry), empty per filter and truncated states render. | `DevicesView.test.tsx` › "loading", "error shows apiErrorMessage and Try again", "empty text per filter, Show all only when filtered", "truncated notice". |
| 4 | View and pure-logic tests (static render, no jsdom) cover the table and the filter (slice-1 part of ticket AC4). | `pnpm test` runs the three new test files. No jsdom import or environment is used. |
| 5 | The `/devices` route renders the new page instead of the skeleton. | `src/app/(app)/devices/page.tsx` imports `DevicesPage` from `@/ui`. `pnpm build` and `pnpm check:layers` are green. |

Every Check must be green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.
The no-literals and copy tests (`src/ui/copy/no-literals.test.ts`, `copy.test.ts`) must also stay green.

## Ming verification after merge
- Local run (`pnpm dev`, dev token): open `/devices` and switch All / Placed / Inventory. Each switch reloads the
  list, and the empty text follows the filter. At a narrow viewport (below `md`) the stacked list replaces the table.
  `pnpm seed:dev` creates no devices, so to see rows Ming either waits for SIM-013.4 (create dialog) or adds devices
  through `POST /api/devices`.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/copy/devices.ts` | new: `devicesCopy` (strings listed in Approach step 1) | D36; `no-literals.test.ts` forbids literals in `.tsx` | no |
| `src/ui/devices/devices-api.ts` | new: `createDevicesApi(fetcher)` with `list(filter)`. `call`, `errorCode` and `fail` are copied from `src/ui/rooms/rooms-api.ts:5-40` | the API boundary for the page | no |
| `src/ui/devices/devices-state.ts` | new, pure: `FILTERS`, `filterOptions()`, `placementText`, `emptyText`, `listSummary`, `devicesReducer` + `INITIAL_DEVICES` | pure logic first; the filter race guard can be tested | no |
| `src/ui/devices/useDevices.ts` | new, `"use client"`: `useDevices(api, filter)` built on `devicesReducer` | loads the list again whenever the filter changes | no |
| `src/ui/devices/DeviceTable.tsx` | new, pure: a table at `md` and up, a stacked `<ul>` below `md`, one shared row model | AC1 | no |
| `src/ui/devices/DevicesView.tsx` | new, pure page body (header, filter, states, table) | AC1–3 | no |
| `src/ui/devices/DevicesPage.tsx` | new, `"use client"` container: api `useMemo`, filter `useState`, `useDevices` | page wiring, as in `RoomsPage.tsx:20-26` | no |
| `src/app/(app)/devices/page.tsx` | replace `PageSkeleton` with `<DevicesPage />` | AC5 | no |
| `src/ui/index.ts` | add `export { DevicesPage } from "./devices/DevicesPage";` after line 22 | pages import UI through `@/ui` (R1) | no |
| `src/ui/devices/devices-api.test.ts` | new | AC2 | no |
| `src/ui/devices/devices-state.test.ts` | new | AC1, AC2 | no |
| `src/ui/devices/DevicesView.test.tsx` | new | AC1–3 | no |

No file matches a High path. No server, lib or API file changes, and `src/lib/icons.ts` gets no new icon names: the
plan uses only existing ones (`lan`).

## Data model / migration
None.

## API contract
None changed. Consumed (merged in SIM-013, `src/app/api/devices/route.ts:12-23`):

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/devices?placement=all\|placed\|inventory` | query `placement` | 200 `{ items: DeviceDto[], truncated: boolean }`, ordered by `lower(d.name), d.id` (`src/server/devices/devices.ts:125`) and capped at `DEVICE_LIMITS.list` = 1000, truncated **per filter** (`devices.ts:131-159`) | 400 `invalid_request`, 401/403 from the wrapper, 503 `unavailable` | any member |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/devices/devices-api.test.ts` › "list(filter) sends GET /api/devices?placement=all / placed / inventory" (fake fetcher, pattern `src/ui/rooms/rooms-api.test.ts:7-18`) | AC2 |
| `devices-api.test.ts` › "list returns { items, truncated } on 200; a body without an items array or with a non-boolean truncated → { ok:false, code:'internal' }" | boundary |
| `devices-api.test.ts` › "a 400 { error: { code: 'invalid_request' } } → { ok:false, code:'invalid_request' }; a non-JSON error body → 'internal'" | error shape |
| `devices-api.test.ts` › "ApiAccessError signed_out → 'unauthenticated'; another ApiAccessError keeps its code; a network rejection → 'unavailable'" | error shape |
| `src/ui/devices/devices-state.test.ts` › "placementText: placed → 'At seat C302-01'; null → 'In inventory'" | AC1, DEV-02 |
| `devices-state.test.ts` › "emptyText: all → shellCopy.pages.devices.empty; placed and inventory → their own copy" | AC3 |
| `devices-state.test.ts` › "filterOptions: order all, placed, inventory, with copy labels" | AC2 |
| `devices-state.test.ts` › "listSummary: 0 / 1 / 12 devices with the filter label (singular/plural)" | AC2 a11y |
| `devices-state.test.ts` › "devicesReducer: load sets loading and clears items; loaded with the latest id → ready (items, truncated) or error (code); a loaded event with an older id is ignored (filter race)" | AC2, filter race risk |
| `src/ui/devices/DevicesView.test.tsx` › "placed device: 'At seat C302-01', the Primary tag, href=/rooms/C302; secondary shows the Secondary tag; inventory device: 'In inventory', no link" | AC1 |
| `DevicesView.test.tsx` › "MAC shown, or the no-MAC dash when null; owner with diacritics (e.g. 'Nguyễn Thị Hà') rendered as is; 'You' tag only when mine" | AC1, Domain focus (diacritics, nulls) |
| `DevicesView.test.tsx` › "filter chips: role=radiogroup with the copy aria-label, three radios, only the current filter aria-checked=true" | AC2 |
| `DevicesView.test.tsx` › "loading renders aria-busy and no table; error renders role=alert with apiErrorMessage(code) and Try again" | AC3 |
| `DevicesView.test.tsx` › "empty: all → 'No devices yet.' with no Show all button; placed / inventory → their text and Show all" | AC3 |
| `DevicesView.test.tsx` › "truncated=true renders the truncated notice; false does not" | AC3, size bound |
| `DevicesView.test.tsx` › "table has a caption and th scope=col for each column; no Edit/Delete/Place controls in this slice" | a11y, R4 |

## Approach
1. **Copy** (`src/ui/copy/devices.ts`, English, no diacritics, following `rooms.ts`). `devicesCopy` contains:
   - `retry: "Try again"`, `filterLabel: "Show devices"`.
   - `filters: { all: "All", placed: "Placed", inventory: "Inventory" }`.
   - `columns: { name, type, inventoryNumber: "Inventory no.", mac: "MAC", owner, placement }`.
   - `caption: "Devices and where they are"`.
   - `noMac: "—"`, `you: "You"`.
   - `atSeat: (seatCode) => \`At seat ${seatCode}\``, `inInventory: "In inventory"`.
   - `roles: { primary: "Primary", secondary: "Secondary" }`.
   - `empty: { placed: "No devices are placed at a seat.", inventory: "No devices in inventory." }`. The "all" text
     stays `shellCopy.pages.devices.empty`.
   - `showAll: "Show all devices"`.
   - `summary: (n, label) => \`${n} ${n === 1 ? "device" : "devices"} · ${label}\``.
   - `truncated: (n) => \`Showing the first ${n} devices.\``.

   Seat codes are already `<room>-NN` and unique per org (spec §4 line 126, invariant 7 line 145), so "At seat
   C302-01" is unambiguous without adding the room code.
2. **API** (`devices-api.ts`). Copy `DevicesResult<T>`, `fail`, `errorCode` and `call` from `rooms-api.ts:5-40`;
   extracting a shared helper is a follow-up (R4). `list(filter: PlacementFilter)` sends
   `GET /api/devices?placement=${filter}`, always with the parameter. `parseDeviceQuery` accepts every value
   (`src/lib/validate/device.ts:21-28`). It checks `Array.isArray(body.items) && typeof body.truncated === "boolean"`,
   otherwise `fail("internal")`. Export `type DevicesApi = ReturnType<typeof createDevicesApi>`. Later slices add
   `get`, `create`, `update`, `remove` and `moveToInventory` here.
3. **Pure state** (`devices-state.ts`, imports only `@/lib/devices/types` and copy):
   - `FILTERS = ["all","placed","inventory"] as const`, and `filterOptions(): ChipOption<PlacementFilter>[]` (type
     from `../Chip`).
   - `placementText(p: DevicePlacementDto | null)` and `emptyText(filter)`.
   - `listSummary(n, filter)` = `devicesCopy.summary(n, devicesCopy.filters[filter])`.
   - `DevicesState = { status: "loading"|"error"|"ready"; items; truncated; errorCode; latest }`.
   - `devicesReducer` handles two events: `{type:"load", id}` gives `{...INITIAL, latest:id}`, and
     `{type:"loaded", id, result}` is ignored unless `id === state.latest`. This is the `member-picker.ts:46-79`
     pattern, reduced to one request kind. Clearing the items on load keeps rows of the old filter from showing under
     the new filter's label.
4. **Hook** (`useDevices.ts`). `useReducer(devicesReducer, INITIAL_DEVICES)`, a `counter` ref, and a `mounted` ref as
   in `useRooms.ts:12-20`. `reload = useCallback(async () => { const id = ++counter.current; dispatch({type:"load",id});
   const r = await api.list(filter); if (mounted.current) dispatch({type:"loaded", id, result: r}); }, [api, filter])`,
   and `useEffect(() => void reload(), [reload])`. It returns `{ ...state, reload }`. The reducer drops stale answers.
5. **DeviceTable** (pure, props `{ devices: DeviceDto[] }`):
   - Uses `CELL`/`HEAD` from `AuditView.tsx:25-26`.
   - At `md` and up: `<div className="hidden md:block"><Card className="overflow-x-auto"><table className="w-full border-collapse">`
     with `<caption className="sr-only">`, then `th scope="col"` for name, type, inventory no., MAC, owner and placement.
   - Below `md`: `<ul className="md:hidden flex flex-col gap-2">`. Each `<li>` holds a `Card` with the bold name, a
     muted line `type · inventoryNumber`, the owner, the placement and the MAC.
   - Both layouts use two small local components:
     - `PlacementLabel`: placed → `next/link` to `roomDetailHref(roomCode)` (`src/lib/nav.ts:59-62`; plain text if it
       returns null) with `placementText`, plus `<Chip label={devicesCopy.roles[role]} />`. Inventory → a muted span.
     - `OwnerLabel`: `displayName` plus a `Chip` "You" when `mine`.
   - The MAC is shown in `font-mono`, or `devicesCopy.noMac` when it is null.
   - This slice has no actions column. SIM-013.3, SIM-013.4 and SIM-013.5 add one, gated by `canPlace`/`canEdit`.
6. **DevicesView** (pure). Props are `{ status, devices, truncated, errorCode, filter, onFilter, onRetry }`. The page
   shell follows `RoomsView.tsx:34-42` (`p-4 lg:p-6 flex flex-col gap-4`, h1 `shellCopy.pages.devices.title`). Below
   the h1:
   - Toolbar: `FilterChips` (`src/ui/Chip.tsx:14-55`), with `ariaLabel = devicesCopy.filterLabel`, then
     `<p aria-live="polite">` containing `listSummary` when the status is ready.
   - The loading skeleton, error card and empty card follow `RoomsView.tsx:44-71`. The empty card adds a tonal
     `Button` `showAll` that calls `onFilter("all")` when `filter !== "all"`.
   - When `truncated` is true, a muted notice `devicesCopy.truncated(DEVICE_LIMITS.list)`.
   - Then `DeviceTable`.
7. **DevicesPage** (`"use client"`):
   `const api = useMemo(() => createDevicesApi(apiFetch), [apiFetch]); const [filter, setFilter] = useState<PlacementFilter>("all"); const s = useDevices(api, filter);`
   Then render `DevicesView`. The filter lives in component state only and is not put in the URL. Session or tier is
   not read in this slice.
8. **Route + export**: `page.tsx` becomes `import { DevicesPage } from "@/ui"; export default function Page() { return <DevicesPage />; }`.
9. Run all Checks.

Rules:
- R1: `src/ui/devices/*` imports only `@/lib/*`, `../*` UI and `next/link`. The page imports `@/ui`.
  `pnpm check:layers` enforces this.
- D36/no-literals: every visible string comes from `devicesCopy`/`shellCopy`.
- R4: no create, edit or delete in this slice.
- R5: the tests above.
- R2, R3, R6 and R7 do not apply because nothing changes on the server. The UI adds no retry logic of its own.

## Specialist input used
- frontend-developer:
  - **Adopted:**
    - The DTO and the files under `src/ui/devices/`, `page.tsx` through `@/ui`, and the pure View.
    - The server-side filter with a stale-response guard, now a pure reducer so it can be tested.
    - `placementText`/`emptyText` in `devices-state.ts`, the truncated notice, and copying the rooms `call` pattern
      (extraction recorded as a follow-up).
  - **Adopted for later slices** (split proposal):
    - `device-form.ts` on top of the lib validators, with `normalizeMac` for the MAC comparison and `ownerId` sent
      only by an Admin.
    - `deviceErrorMessage` overriding `member_not_assignable`.
    - The delete flow driven by the 409, returning to confirm after the move.
  - **Open questions answered from the code:**
    - Q1: the stale code is 409 `placement_changed` (`src/lib/devices/rules.ts:46`).
    - Q2: after the move the dialog goes back to the confirm step.
    - Q3: the owner can go back to "Me".
    - Q4: the server already orders by `lower(name), id` (`devices.ts:125`), so the client does not sort.
    - Q5: there is no inactive tag (the DTO has no status).
- ux-architect:
  - **Adopted:**
    - The Audit table styles, and `FilterChips` for the filter.
    - The empty state per filter with "Show all" instead of "New".
    - The `aria-live` summary, a visually hidden caption and `th scope=col`.
    - The "You" tag for `mine`, the MAC in monospace or a dash, and the role as a text `Chip`.
    - A link to the room, because `/rooms/[roomCode]` exists (`src/app/(app)/rooms/[roomCode]/page.tsx`).
    - Two layouts (a table at `md` and up, a `<ul>` below) fed from one set of label components.
  - **Changed:**
    - The placement reads "At seat C302-01" with no extra room code, because seat codes already include the room
      code and are unique (spec line 126).
  - **Adopted for later slices:**
    - Action labels that include the inventory number.
    - Hiding the actions column when no row has an action.
    - Focus going to the h1 after a delete.
    - An inline owner picker instead of a nested modal.
    - Opening the dialog straight in the placed step when the row is placed.
  - **Open questions:**
    - Q1: server-side filter.
    - Q2: any member may create (`rules.ts:12`, `devices.ts:304-317`).
    - Q3: inline picker (see the split proposal).
    - Q4: a visible second confirm.
    - Q5: `placement_changed`.
    - Q6: yes, link to the room.
    - Q7: whichever of SIM-013.3 and SIM-013.4 merges first adds the actions column; the other one rebases onto it.
  - **Not adopted:** arrow-key navigation for `FilterChips`. It is a shared kit component, so the change is a
    follow-up.

## Assumptions
1. Seat codes are unique per org and include the room code, so no room code is added to the placement text.
2. The filter is not kept in the URL. A reload resets it to "All". This is cheap to add later.
3. There is no pagination. The cap of 1000 per filter with the truncated notice is enough for spec §8's "hundreds of
   devices". Paging is a follow-up if an org grows past it.
4. Duplicating the `call`/`errorCode` code from `rooms-api.ts` (and `seats-api.ts`) is accepted for now. Follow-up:
   extract a shared `src/ui/api-call.ts`.
5. Hotspots: `src/ui/index.ts` gets a one-line export, which SIM-014.2 and SIM-014.3 (BACKLOG) will also touch. No
   ticket is currently `IN_PROGRESS`, `REVIEW` or `DONE`.
6. `pnpm seed:dev` creates no devices. Adding fake devices is a possible follow-up (local data only); it is not in
   this ticket.

## Blocking questions
None.

## Split proposal
Estimate for the whole ticket: about 1,000 source lines without tests. The list is about 450 lines, the
form/owner-picker about 330 and the delete flow about 220. That is more than one cycle, so there are three slices:

| Slice | Scope | Closes (ticket AC) | Depends on |
|---|---|---|---|
| **SIM-013.2 (this plan)** | Read-only Devices page: `devices-api.list`, `devices-state`, `useDevices`, `DeviceTable` (table plus stacked list), `DevicesView` with the server-side filter and truncated notice, `DevicesPage`, the route, `devicesCopy` (list part). About 450 lines. | AC1; AC4 (table, filter) | SIM-013.1 |
| SIM-013.4 | Create and edit: `device-form.ts`, `DeviceFormDialog.tsx`, `devices-api.create/update`, "New device" button (every member), and an Edit row action gated by `canEdit`. About 330 lines. | AC2 (create/edit, edit button gating); AC4 (dialog logic) | SIM-013.2 |
| SIM-013.5 | Delete: `delete-device-flow.ts`, `DeleteDeviceDialog.tsx`, `devices-api.get/remove/moveToInventory`, and a Delete row action gated by `canEdit`. About 220 lines. | AC2 (delete button gating); AC3; AC4 (delete logic) | SIM-013.2 (SIM-013.4 if the actions column comes from it) |

SIM-013.3 (place dialog) still depends only on SIM-013.2. The first of SIM-013.3, SIM-013.4 and SIM-013.5 to merge
adds the actions column. The ticket's manual test plan item ("create, edit and delete a device; delete a placed
device") moves to SIM-013.4 and SIM-013.5.

**Decisions already made for SIM-013.4**, from the consults and the code:
- **Form logic.** `device-form.ts` (pure) defines `DeviceForm` with string fields and `owner: { kind: "me" } | { kind:
  "member"; member: PickerMember }`.
  - `toCreateBody(form, { isAdmin })` and `toPatchBody(form, device)` call `validateDeviceCreate` /
    `validateDevicePatch` (`src/lib/validate/device.ts:94-133`) and map `field` to copy. They do not use their own
    regexes.
  - The patch compares `normalizeMac(form.mac)` with `device.mac`, so `AA-BB-…` for the same address is unchanged. A
    blank MAC sends `null`.
  - `ownerId` is sent only when `isAdmin` is true and a member was picked. A non-Admin must never send it, because
    the server answers 422 `not_allowed` (`devices.ts:317`).
- **Owner picker** (Admin only, `atLeastTier(session.tier, "admin")` as in `RoomsPage.tsx:24`). There is no nested
  modal. Inside `DeviceFormDialog`, a radio pair offers "Me" (the default) or "Another member". Choosing "Another
  member" mounts an inline `MemberPickerFields` (`src/ui/seats/MemberPickerDialog.tsx:21-116`, `occupantId={null}`),
  driven by `useMemberPicker(seatsApi.activeMembers, 0)` (`useMemberPicker.ts:16`, `seats-api.ts:141`). That way the
  member list loads only when it is needed. On edit, the owner is read-only text for everyone.
- **Type field.** `<input list>` with a `useId` datalist taken from `devicesCopy.typeSuggestions` (D37), and
  `maxLength` from `DEVICE_LIMITS`.
- **Error messages.**
  - `deviceErrorMessage(code)` maps `member_not_assignable` to "This member is inactive, so they can't own a
    device." Every other code goes through `apiErrorMessage`. The shared `api.ts:25` text stays unchanged.
  - On create, `not_found` means the owner is gone: show the error and keep the dialog open. On edit, `not_found`
    calls `onDone`.

**Decisions already made for SIM-013.5**, D31:
- **Opening step.** The dialog opens in the `placed` step when `device.placement` is set, and in `confirm`
  otherwise.
- **Confirm step.** The confirm step calls `DELETE /api/devices/:id`. A 409 `device_placed` carries no seat
  (`devices.ts:433`), so the dialog calls `GET /api/devices/:id` and moves to `placed` with that placement.
- **Move to inventory.** In the placed step, "Move to inventory" sends `PUT …/placement` with
  `{ seatId: null, expectedSeatId }` (`expectedSeatId` is required, `validate/device.ts:40`).
  - On success the dialog goes back to `confirm`, with an explicit "Delete device" button. It never deletes
    automatically.
  - A 409 `placement_changed` (`rules.ts:46`) makes the dialog call `GET` again and show the new step with the
    `apiErrorMessage`.
- **Not found.** `not_found` on any call means done.
- **Permission.** Owner and Admin both pass `canPlace` (`rules.ts:5`, `atLeast(tier, "manager")` includes admin), so
  a row with `canEdit` can always move the device to inventory.
- **After the delete.** Focus moves to the h1 (`tabIndex={-1}`).
