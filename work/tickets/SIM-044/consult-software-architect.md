# SIM-044 — consult: software-architect (read-only)

## Findings

F1. The reads that need changing take tier/sub inconsistently today, and none filters by holder.
- `listDevices` and `getDevice` (`src/server/devices/devices.ts` l.173-210) already receive `tier` and `sub`. They share `deviceRows`, which joins `members m` on the owner and binds the caller's sub as `$2`, so "held by caller" is `coalesce(m.sub = $2::uuid, false)`, the same expression as `mine`.
- `listDeviceHistory(db, scope, deviceId, q)` (`src/server/devices/history.ts`) has no tier or sub. Its existence probe (`select d.owner_id ... from devices d`) is where to add the holder check and return `notFound`.
- `search(pool, scope, f)` (`src/server/search/search.ts` l.113-184) has no tier or sub; the route (`src/app/api/search/route.ts:15`) doesn't pass them. The device `select` already joins `members m` on the owner.
- `seatRows` (`src/server/seats/seats.ts` l.102-138) builds a `devices` JSON array (id, name, type, inventory number, role, owner) for every device at the seat; it takes only `sub`. `getSeat`, `listRoomSeats` and `loadSeat` all use it.
- `memberSelect` (`src/server/members/manage.ts` l.111-126) embeds `device_count` and a `devices` ref list (id, name, inventory number, seat). `listMembers` and `getMember` take neither tier nor sub. `GET /api/members` and `GET /api/members/[id]` are User tier.

F2. Write responses also leak through the seat path. `loadSeat` is the return value of `releaseSeat` (`/api/seats/[id]/release`, User tier) and of every other seat write (seats.ts l.419-556). A User releasing their seat gets back the full device list of that seat. Not mentioned in the ticket's scope.

F3. The layout API already meets the OQ-55 default. `readLayoutRows` (`src/server/layout/layout.ts` l.123-166) returns per device only `{ type, deviceType: { id, slot, hasImage, imageVersion, sprite } }`: no device id, name, inventory number, MAC or owner. LAY-06 needs only a test that locks the shape for the User tier.

F4. Post-write `reload()` (devices.ts l.605) uses `deviceRows` with `rows[0]!`. A holder filter inside `deviceRows` would crash any write where the caller doesn't end up holding the device (undefined dto, 500 after a side effect).

F5. R7 and 404 are safe for the reads (no side effects; 404 is a domain code). Writes: a User acting on a device they don't hold gets 422 `not_allowed` (e.g. `updateDevice` l.408) while an unknown id gets 404, which still leaks existence (and the inventory-number 409 on PATCH leaks inventory numbers). Device actions are out of scope.

F6. The incoming-transfer path is already separate and correct: `listHandoffs(box=incoming)` and `countHandoffs` (`src/server/devices/handoffs.ts` l.734-797) give name, type, inventory number, sender and note (DEV-08) without device detail access. "404 for a device not held" doesn't block confirm/decline.

F7. Nav and page:
- The Devices nav entry is `src/lib/nav.ts` l.31 (`minTier: "user"`), tests `src/lib/nav.test.ts` l.7-22 and 116; not in the ticket's file list.
- The tier is known only on the client (D4), so the redirect must be client-side in `DevicesPage` / `DeviceDetailPage` from `session.tier`.
- Today the Devices page is where Users confirm incoming transfers (`IncomingTransfers`, `src/ui/devices/DevicesPage.tsx` l.236) and act on their own devices; the handoff badge (`useHandoffBadge`) hangs off the Devices entry.

F8. No change needs `src/server/http/**` or other High globs, so it stays Medium if the plan avoids `with-auth.ts` / `org-scope.ts`.

## Recommendations

R-a: one pure rule plus one SQL fragment per query, not a generic wrapper.
- Pure rule `deviceVisibility(tier): "org" | "held"` in `src/lib/devices/visibility.ts`, unit-tested per tier.
- Clauses: `listDevices` / `getDevice`: `and coalesce(m.sub = $2::uuid, false)`; history probe: `and exists (select 1 from members m where m.org_id = d.org_id and m.id = d.owner_id and m.sub = $3::uuid)`; search devices: bound `m.sub = $n::uuid`.
- A user with no member row matches nothing (fail-closed).
- Not in `deviceRows` or `reload`; a `visibleOnly` flag or the clause in `listDevices` / `getDevice` only (F4).

R-b: `getDevice` returns `notFound` when the filtered query is empty. History: `listDeviceHistory(db, scope, sub, tier, id, q)`, `notFound` from the probe. Same 404 code and body as a cross-org id (route tests assert it). "Former holder loses access" follows from "current owner = me".

R-c: `GET /api/devices/mine` (precedent `/api/requests/mine`; static segment wins over `[id]`).
- Server `listMyDevices(db, scope, sub, tier, cursor, limit, today)` on `deviceRows` with `where d.owner_id = (select id from members where org_id = $1 and sub = $2::uuid)`, keyset on `(lower(d.name), d.id)` matching the existing `order by`.
- Response `{ items: DeviceDto[], nextCursor }`; DeviceDto already carries the POR-03 fields and action flags.
- Cursor validator in `src/lib/validate/` like the member and search cursors; bounded `limit`.
- Incoming transfers stay on `/api/handoffs?box=incoming` (F6).

R-d: `seatRows` gets `tier`. For a User filter the JSON subquery to `m.sub = $2::uuid` and add `otherDeviceCount` computed in SQL. Keep `deviceCount` as the total (number only, OQ-60 spirit). Thread `tier` through `getSeat`, `listRoomSeats`, `loadSeat` (covers F2); test the release route.

R-e: `listMembers` / `getMember` get `tier` and `sub`. For a User, other members get `devices: []` and `deviceCount: null` (type `number | null`); the caller's own row keeps both. Do it in SQL with `case when ...` so nothing is fetched and dropped.

R-f: LAY-06 no code change; DB test asserting a User's `seatDevices` entries contain only `type` and `deviceType`.

R-g: `devices` → `minTier: "manager"` in `src/lib/nav.ts`, update `nav.test.ts`, add `src/lib/nav.ts` to the plan; client-side redirect (F7).

R-h: unit tests for the pure rule and route wiring; DB tests per tier (`devices.db.test.ts`, `history.db.test.ts`, `search.db.test.ts`, `seats.db.test.ts`, members db test) for: held by me, held by another, org inventory, former holder after transfer confirm, id from another org, caller with no member row.

## Risks

1. Sequencing regression (highest): hiding the Devices page for Users before SIM-045 (My Portal) ships removes their only UI to confirm incoming transfers, place, transfer, return, request extensions, and their badge. API filtering alone does not break the page (it shows their own devices).
2. Hiding `/devices/[id]` for Users breaks links from search and the seat panel to their own devices' detail and history; DEV-11 allows that.
3. The existence oracle on writes (F5) remains (422/409 vs 404); detail 404 hides contents, not existence. Record the acceptance.
4. DTO type changes (`deviceCount: number | null`, `otherDeviceCount`) touch `src/lib/members/types.ts`, `src/lib/seats/types.ts` and UI consumers (`src/ui/seats/**`, `src/ui/members/**`), not in the ticket's file list (R4 friction).
5. Filtering inside `deviceRows` or `reload` would cause post-commit 500s (F4).

## Open questions (for Ming at the plan gate)

1. Move hiding the Devices nav entry and page for Users to SIM-045 (lands with My Portal)? Recommended: API filtering in SIM-044, nav hide and redirect in SIM-045.
2. Keep `/devices/[id]` reachable for Users for devices they hold? Recommended: yes.
3. Confirm "404 for a device not held" and "a former holder loses access to detail and history".
4. Write actions on a device not held: 404 instead of 422? Recommended: follow-up ticket.
5. OQ-58: should Users see other members' email in `GET /api/members`? Returned today; recommended: follow-up.
6. Endpoint path `/api/devices/mine` (recommended) or `/api/me/devices`?
