SIM-013 UI consult (read-only). Findings, then Recommendations, Risks, Open questions.

## Findings
- Nothing exists yet for devices. `src/app/(app)/devices/page.tsx` is a `PageSkeleton` stub using `shellCopy.pages.devices`. There is no `src/server/devices`, `src/lib/devices`, `src/ui/devices` or `/api/devices`.
- The DB is ready. `db/migrations/20261120150000_init.sql` (lines 112-139, 223-262) already has `devices`:
  - `seat_id` is null for inventory.
  - `role` is primary or secondary; a primary requires a seat.
  - `inventory_number` is unique per org; `mac` is unique per org when set and stored lowercase and colon-separated.
  - `owner_id` references `members`.
  - A partial unique index allows one primary per seat.
  - A deferred constraint trigger, `devices_primary_owner_is_occupant`, checks that the primary is owned by the occupant. Use its errcode 23514 for the "DB again" check.
- The seats code is the template for the server side.
  - `src/lib/seats/rules.ts` holds pure rule functions with tests (`decideOccupantChange`, `decideRelease`, `decideDelete`).
  - `src/server/seats/seats.ts` holds the SQL, and `pg-error.ts` maps constraint errors to codes.
  - Route handlers use `withAuth(..., {tier})`, `isCanonicalUuid`, `readJson`, a `validateX` function from `src/lib/validate/*`, and `apiError`.
  - Seats already show devices read-only through `SeatDeviceDto` and `SeatDetailPanel`.
- The rooms UI is the closest page template, in `src/ui/rooms/`:
  - `RoomsPage` is the container. It builds the api with `useApiFetch`, `createRoomsApi`, `useSession` and `atLeastTier`, and it holds a `Dialog` union state.
  - `RoomsView` is a pure view with `status` and `errorCode` props.
  - `useRooms` loads data with stale-response guards.
  - `rooms-api.ts` is a factory that returns `{ok, value|code}` and never throws.
  - `RoomFormDialog` has an outer wrapper that returns null when closed and an inner component keyed by id. It uses `EntityFormDialog`, `DialogField` and `DialogSelect`, with a pure `room-form.ts` (form to body, with an invalid/unchanged result).
  - `DeleteRoomDialog` loads impact and shows a warning step.
  - `/rooms/page.tsx` is just `return <RoomsPage/>`, re-exported from `@/ui`.
- Audit is the filter template. `AuditView` uses `DialogSelect` and a pure `audit-state.ts`.
- `MemberPickerDialog`, `MemberPickerFields`, `useMemberPicker` and `member-picker.ts` already exist in `src/ui/seats/`. They give a debounced, paged member search that the owner field (Admin only) can reuse. They may need to be moved or generalized so `ui/devices` doesn't import from `ui/seats`.
- `SeatDto.devices` and `SeatDto.occupant` can feed a seat picker.
- Copy: D36 says strings go in `src/ui/copy/<feature>.ts`. `no-literals.test.ts` and `copy.test.ts` enforce this.
  - `src/ui/copy/api.ts` has a `satisfies Record<ApiErrorCode, string>`, so every new code added to `API_ERROR_CODES` in `src/lib/api/error.ts` needs text.
  - Existing relevant codes are `member_not_empty`, `not_allowed` and `not_found`.
- Tests:
  - UI tests use `renderToStaticMarkup` from `react-dom/server` on pure View components. `AuditView.test.tsx` is the pattern, with a `render(partial props)` helper and noop handlers.
  - There are also pure-logic tests for `*-api` (a fake fetcher), `*-form`, `*-state` and `seat-actions`.
  - There is no jsdom. Logic goes in pure modules.
  - Server tests are `*.test.ts` with a mock pool, plus `*.db.test.ts` run by `pnpm test:db`.
- Session (`src/lib/session.ts`) has only `{tier, email, orgName}`, with no member id. `/api/me` returns `member` (the member row, presumably with `id`) and `sub`. `SeatDto.mine` is computed on the server for this reason.

## Recommendations
**Server and rules (R1, R6, R7)**
1. Put the placement rules in `src/lib/devices/rules.ts`, pure and unit-tested. Use `decidePlacement({role, deviceOwner, seatOccupant, seatHasPrimary, actorIsOwner, tier})`. It should return ok, `not_allowed` or a 422/409 refusal, each tied to the acceptance criteria. Add `canEdit(tier, isOwner)` and `canMove(tier, isOwner)`. The permission matrix is: edit and delete are owner or Admin (D19); place, move, lend and return are owner or Manager+; create is for your own member, and an Admin can create for anyone.
2. Put the SQL in `src/server/devices/devices.ts` (starting with `import "server-only"`), with `pg-error.ts` mapping 23505 to inventory-number-taken or MAC-taken, and 23514 to a primary refusal. Do the check in app code and keep the DB trigger as the backstop. Decide each refusal before any write so the 401/403 codes never come late (R7).
3. Routes:
   - `GET/POST /api/devices` (query `?placement=all|placed|inventory`).
   - `PATCH/DELETE /api/devices/[id]`.
   - `PUT /api/devices/[id]/placement` with `{seatId, role}` or `{seatId: null}` for inventory. A single endpoint covers lend, move and return, which gives DEV-03/04/05.
   - A delete of a placed device returns 409 with a new code such as `device_placed`, so the dialog can offer "Move to inventory".
   - Wrap each in `withAuth`, with tier "user" for these routes and finer owner/Manager checks in the server function. Add the routes to `routes-guarded.test.ts`.
4. Include in `DeviceDto`: id, type, inventoryNumber, mac, name, owner `{id, displayName}`, `seat: {id, code, roomCode, role} | null`, and `mine` or `canEdit`/`canMove` computed on the server, like `SeatDto.mine`. This avoids needing the member id in the session.
5. Add new codes to `API_ERROR_CODES` and `apiCopy`: `inventory_number_taken`, `mac_taken`, `device_placed`, `primary_refused`, and similar. Put the MAC normalization and format check in `src/lib/validate/device.ts` and use it on both client and server.

**UI files** (all under `src/ui/devices/`, exported through `@/ui`)
- `DevicesPage.tsx` is the container, modeled on `RoomsPage`. It holds the dialog union `none | form | delete | place`.
- `DevicesView.tsx` is pure and holds the `DeviceTable` (a native table, responsive with a stacked layout on small screens). Columns are name, type, inventory no., MAC, owner and placement ("at seat X" or "in inventory"). Row actions are gated by `canEdit`/`canMove` from the dto.
- `devices-state.ts` is the pure filter model: `PlacementFilter = all|placed|inventory`, with the filter applied client-side or sent as a query param. Provide `filterDevices` and the empty-state text per filter.
- Use a filter control with `role="tablist"` or radio-style buttons. The Audit `DialogSelect` also works, but segmented buttons suit three fixed options. Keep the filter state in the container and in the URL query if cheap.
- `DeviceFormDialog.tsx` follows the `RoomFormDialog` outer/inner pattern with `device-form.ts` (pure: `toCreateBody`, `toPatchBody`, MAC normalize/validate). The type field is a free-text input with a `<datalist>` of PC, Laptop, Monitor, IP phone and Other (D37). On edit the owner field is read-only. On create, show the owner picker only to Admins; otherwise the owner is the caller.
- `PlaceDeviceDialog.tsx` has a seat picker (loaded from the rooms and seats api) and a role select. Primary is offered only when the rules allow it, and secondary is the default. Lend, move and return share this dialog.
- `DeleteDeviceDialog.tsx` is the D31 flow. If the device is placed, show the warning with a "Move to inventory" action, then allow delete. Run it from the 409 `device_placed` response, not only from a client check.
- `devices-api.ts` is the factory pattern from `rooms-api.ts`. Pull the duplicated `call`/`errorCode` helper out into a shared module only if it stays inside this ticket's plan (R4); otherwise copy it and note a follow-up.
- `useDevices.ts` follows `useRooms.ts` (the counter and mounted guards).
- Copy goes in `src/ui/copy/devices.ts`. The existing `shellCopy.pages.devices` stays for the title.
- The `devices/page.tsx` renders `<DevicesPage/>`.

**Testability (Vitest node env, no jsdom)**
- Pure logic tests: `rules.test.ts` (the full permission and role matrix), `device-form.test.ts`, `devices-state.test.ts`, and `devices-api.test.ts` with a fake fetcher.
- View tests with `renderToStaticMarkup`: placement text for every device, the three filter states, action buttons hidden by role, and the loading/error/empty states.
- Server tests: `devices.test.ts` with a mock pool, and `devices.db.test.ts` for the unique, primary-owner and one-primary-per-seat constraints.
- No test can click or type, so the dialog logic (which actions are offered, which step the delete is in) must live in pure functions, as in `seat-actions.ts`.

## Risks
- The session has no member id, so the UI cannot tell "my device" by itself. Compute ownership on the server (`mine`/`canEdit`/`canMove` on the dto), or the UI will show buttons the API will refuse. Do not trust the UI as the guard.
- Concurrency: moving a device and changing a seat occupant race. Lock the seat and device rows (or use the DB trigger as the backstop) and map the 23514 error to a clear message, not a 500.
- DEV-06 (demote on occupant change) lives in the seats code, which already exists and may be partly done in SIM-012. Verify that `setOccupant`, `releaseSeat`, request approval and forced room delete all demote primaries. If any path is missing, it belongs in this ticket's tests or in a follow-up (R4).
- Lists: seats show a capped device list (`listDevices: 20`). The Devices page needs pagination or a cap on all devices (the audit and member picker use cursors), or a large org will load everything.
- MAC handling: users type `AA-BB-...`, `aabb...` or mixed case. Normalize to the stored form on both sides, and treat an empty string as null (so it doesn't collide on the unique index).
- Deleting a member who owns devices is already blocked by `member_not_empty` (the FK is on delete restrict). Check that the copy still fits.
- The `ui/seats` picker reuse crosses a feature folder. That is allowed by layers (ui to ui) but couples the features.

## Open questions
1. Does the filter run on the server (a query param, paged) or only on the client? I recommend the server, so paging stays correct.
2. Who may create for another member: Admin only (DEV-01), as I read it. Confirm that a Manager creating for others is out, since Managers can place but not create for others.
3. Can the Devices page show everyone's devices to a plain User (read all, edit own)? The spec says "every device list", so I assume yes, but this should be stated in the plan.
4. Should placing a device on a seat with no occupant as secondary be allowed? DEV-03 says secondary has no ownership check, so I assume yes.
5. Does the seat picker list all rooms and seats of the org (the existing room-seats endpoint is per room), or do we need a new light seat-search endpoint?
6. Primary on move: when a device moves from seat A (primary) to seat B, does the old seat simply have no primary? The spec implies yes; confirm.
7. Is a "device detail" view needed (DEV-02 mentions device detail), or does the list row plus dialog count as the detail? The ticket scope only names `DeviceTable` and `DeviceFormDialog`.

Key paths: `d:\project\simap-game-ui\src\ui\rooms\` (templates), `d:\project\simap-game-ui\src\ui\EntityFormDialog.tsx`, `d:\project\simap-game-ui\src\ui\audit\AuditView.test.tsx`, `d:\project\simap-game-ui\src\lib\seats\rules.ts`, `d:\project\simap-game-ui\src\server\seats\seats.ts`, `d:\project\simap-game-ui\src\app\api\seats\[id]\occupant\route.ts`, `d:\project\simap-game-ui\db\migrations\20261120150000_init.sql`, `d:\project\simap-game-ui\src\ui\copy\api.ts`, `d:\project\simap-game-ui\src\app\(app)\devices\page.tsx`.
