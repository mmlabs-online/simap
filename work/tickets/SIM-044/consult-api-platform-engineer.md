# SIM-044 — consult: api-platform-engineer

## Findings (read-only; no files changed)

**Current state (all server code is tier-blind for reads):**
- `GET /api/devices` calls `listDevices(pool, scope, sub, tier, filter, today)`. `GET /api/devices/[id]` calls `getDevice(...)`. Both go through `deviceRows` in `src/server/devices/devices.ts` (l.128-162, `FILTER_SQL` l.165). `tier` is only used for `canX` flags in `toDto`. The routes use `withAuth({tier:"user"})`.
- `deviceRows` already has `mine` (`m.sub = $2`). So the User visibility rule is a SQL predicate `m.sub = $2::uuid` on the owner join, added when `tier === "user"`. Do not filter after the query: the limit/`truncated` logic would then be wrong.
- `GET /api/devices/[id]/history` calls `listDeviceHistory(pool, scope, id, q)` (`src/server/devices/history.ts`). It has no `sub` or `tier` parameter. Its existence check (l.37-47) selects `owner_id` only, which is the natural place for the 404 guard. The route must pass `ctx.sub` and `ctx.tier`.
- `GET /api/search` (`src/app/api/search/route.ts`) calls `search(pool, scope, filter)` with no `sub` or `tier`. The device group (`search.ts` l.113-155) matches on name, inventory number, MAC, serial, manufacturer, brand and owner name, with no owner filter. For a User, the device group needs `d.owner_id = (member id of sub)`. The seat and member groups stay as they are. `search()` runs in a repeatable-read read-only tx, so the extra member lookup fits in the same snapshot.
- Search leak: for a User, matching on `m.display_name` (owner name) would reveal that another member holds a device. Restricting rows to held devices removes this, since the owner is then the caller. For Users the owner-name `like` alternative can be dropped.
- Seats: `seatRows` (`src/server/seats/seats.ts` l.102-138) returns `device_count` and a `devices` JSON array (id, name, type, inventoryNumber, role, owner) for everyone. It is used by `getSeat`, `listRoomSeats`, `loadSeat` after writes, and the seat route handlers (`src/app/api/seats/[id]/route.ts`). `tier` is not passed in today.
- Layout: `src/server/layout/layout.ts` l.123-166 returns only `type` and `deviceType` per seat device, with no id, name, inventory number, MAC or owner. This already matches the OQ-55 default, so it needs no leak fix. No LAY-06 gap beyond adding a test that locks this in; no change unless Ming picks a stricter OQ-55 answer.
- Members: `src/server/members/manage.ts` l.75-124 builds `device_count` and a `devices` JSON list (up to `refCap`) per member for everyone (MEM-02). `src/server/members/members.ts` has no device data. The members routes are `src/app/api/members/route.ts` and `[id]/route.ts`, and both need `ctx.tier` and `ctx.sub`.
- Nav: `src/ui/AppShellView.tsx` has no match for `devices` or `Devices`, so the entry is built elsewhere (likely `src/ui/copy/shell.ts` or a nav config; the planner must locate it). The page is `src/app/(app)/devices/**`.
- There is no "my devices" endpoint yet.

## Recommendations

1. **Central helper.** One visibility predicate in `src/server/devices/` (e.g. `heldBySql(tier)`), used from list, detail, search and the seat and member queries. Keep `deviceRows` as the single query. Add `and ($tier <> 'user' or m.sub = $2::uuid)` as a bound parameter rather than string-built SQL. Only Users get the filter; Manager and Admin unchanged (AC1).
2. **Detail and history return 404 via the existing `notFound`** (SYS-01). The check runs inside the read, before any write, so R7 holds. No `forbidden` path. Detail and history use the same predicate.
3. **Former holder loses access** automatically (current `owner_id`); history returns 404. Add a test.
4. **New endpoint `GET /api/devices/mine` (or `/api/me/devices`)** with `withAuth({tier:"user"})` and the same filter for every tier.
   - Keyset-paged (`limit` + `nextCursor`), order by `lower(name), id`.
   - Fields: name, type, inventoryNumber, placement (seat code and role, or in-inventory), expiresOn, overdue, pendingHandoff.
   - Slim DTO without `mac`, `serial` or `canX` unless DEV-12 asks; reusing `deviceRows` with `m.sub = $2` keeps overdue and placement logic identical.
   - A static `mine/route.ts` is safe next to `[id]` (static segments win; `[id]` validates UUIDs anyway).
5. **Seats and members for Users (OQ-55 / OQ-58 defaults).**
   - Pass `tier` into `seatRows`; for a User return full device objects only where `m.sub = $2`, the rest as a count (e.g. `otherDeviceCount`).
   - `SeatDto` in `src/lib/seats/types.ts` changes (`devices` = held only, add `otherDeviceCount`); the seat UI must follow.
   - `loadSeat` after writes also needs the tier; writes unchanged.
   - Members: for a User drop `devices` and `device_count` (or only the caller's own); keep the list, names, employee code and seats.
   - Member picker for transfers (DEV-08) stays; check `useMemberPicker.ts` reads no device fields.
6. **Nav and page.** Hide Devices for Users; the page redirects Users to the dashboard; API stays the guard. Pending-transfer badge out of scope (OQ-59 → SIM-045).
7. **Tests.** Per-tier unit tests in `devices.test.ts`, `search.test.ts`, `devices-routes.test.ts`, `seats.test.ts`, members tests; DB tests (`devices.db.test.ts`, `search.db.test.ts`, `history.db.test.ts`). Cases: Manager/Admin full list; User with zero devices; User holding one of two; former holder; other org; paging on the new endpoint.
8. **Keep `src/server/http/**` unchanged** to stay Medium risk; `ctx.sub` and `ctx.tier` are already available.

## Risks
- **Pending-transfer recipient gap (main conflict).** DEV-08: the recipient sees name, type, inventory number, sender and note before holding it. With `owner = me`, list and detail do not return it. Pending-transfer data must come through "my devices" as an incoming-handoff entry or a separate "incoming handoffs" path. DEV-12's field list does not say this clearly. Confirm/decline in `handoffs.ts` must not rely on `getDevice` for Users; check `reload()` (devices.ts l.605).
- **Write paths reuse the read helper.** `placeDevice`, `updateDevice`, `assignDevice` etc. return a reloaded `DeviceDto`. A User filter inside `deviceRows` could 404 on the reload after an allowed write (e.g. transfer away, return), which would also break R7. Filter in `listDevices` / `getDevice` only, or give the reload an explicit unfiltered flag.
- **Existing UI.** `DeviceDetailPage`, `useDeviceDetail`, `DevicesPage` expect the old behaviour; deep links to a device not held need a not-found state; the seat panel must handle the new seat DTO.
- **Other leak channels.** Audit log API, dashboard device counts (OQ-60), reports/exports, room/seat responses with `owner` (e.g. `listRoomSeats`), the search `owner_name` match, the `owner` field in seat devices.
- **Performance.** Without an index on `devices(org_id, owner_id)` the User filter may scan; a new index needs a forward-only migration (R2).

## Open questions
1. OQ-55 / OQ-58 answers (defaults: sprites for all; seat panel own devices + "N other devices"; Members page stays without devices).
2. What a recipient sees for an incoming transfer before holding it (DEV-08 vs D69). Proposed: an `incoming` section in "my devices", or a separate list, with name, type, inventory number, sender and note only.
3. "My devices" route path and exact fields: also `mac`, `serial`, action flags (`canTransfer`, `canReturn`), or only DEV-12 fields?
4. Return `otherDeviceCount` on the seat DTO for Users? (OQ-55 default: yes.)
5. Dashboard device counts for Users (OQ-60): here or SIM-045?

Relevant files: `src/server/devices/devices.ts`, `src/server/devices/history.ts`, `src/server/search/search.ts`, `src/server/seats/seats.ts`, `src/server/members/manage.ts`, `src/server/layout/layout.ts`, `src/app/api/devices/route.ts`, `src/app/api/devices/[id]/route.ts`, `src/app/api/devices/[id]/history/route.ts`, `src/app/api/search/route.ts`, `src/lib/seats/types.ts`, `docs/spec-v1.md` (DEV-12, OQ-55).
