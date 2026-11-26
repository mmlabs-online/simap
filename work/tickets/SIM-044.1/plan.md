Status: READY

# Plan — SIM-044.1: Limit device data in seat, member and layout responses for Users

Gate: plan-approval (P1). Slice B of SIM-044 (merged). Every default below is what the implementer builds unless Ming
answers otherwise at the gate; see **Questions for Ming at approval** at the end. No High path is touched (risk stays
Medium; `src/server/http/**` unchanged).

## Scope summary
- `docs/spec-v1.md` SEA-05 (l.258-260): "Any user opens a seat's detail: code, room, status, occupant, primary device,
  secondary devices with their owners, group/project tags. For a User, device details at the seat follow DEV-12: only
  the devices they hold are shown in full; what the panel shows about other devices is OQ-55."
- MEM-02 (l.399-401): "For a User the API omits the devices (and device counts) of other members (D69); whether Users
  see the members list at all is OQ-58."
- LAY-06 (l.468-469): "Whether Users still see the sprites of devices they do not hold (sprite only, no details) is
  OQ-55; the layout API never gives a User more about such a device than that answer allows (D69)."
- DEV-12 (l.369): "Other device data a User reaches through seats, members or the room map is limited as SEA-05,
  MEM-02 and LAY-06 say."
- OQ-55 default (l.824-827), approved 2026-11-26 (SIM-044 plan Q5): "sprites still draw for every tier, and for a User
  the layout API returns per such device only its type/slot (no id, name, inventory number, MAC or owner); the seat
  panel lists the User's own devices in full and only "N other devices" for the rest."
- OQ-58 default (l.836-837), approved 2026-11-26 (SIM-044 plan Q6): "yes (names, employee code, seats), without other
  members' devices (MEM-02, D69); the member picker for transfers (DEV-08) stays either way." Other members' email:
  follow-up (Ming, same approval).
- `work/decisions.md` D69: "Users can no longer list the org's devices. ... give a User only the devices they hold
  (owner = their member)."
- Design: `work/tickets/SIM-044/plan.md` → "Split proposal", slice B; architect R-d, R-e, R-f, F2, F3; api-platform
  items "Seats", "Layout", "Members".

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | For a User, seat detail, room seat list and the release response list only devices they hold; `deviceCount` is the total. | `seats.test.ts › seat reads per tier: user SQL adds "coalesce(m.sub = $2::uuid, false)" to the devices subquery only (device_count subquery unchanged)`; `seats.db.test.ts › visibility › user` (detail, list and release: only own devices, incl. own device lent to another seat; other member's and unowned devices absent; `deviceCount` = total; user with no member row gets `devices: []`); `seats-routes.test.ts › GET seat, GET room seats, POST release pass ctx.sub and ctx.tier`. |
| 2 | Manager and Admin seat responses are unchanged. | `seats.db.test.ts › visibility › manager and admin see every device` (same seat as AC1); existing list/detail test (l.178-222) passes with tier `"manager"`; `seats.test.ts` asserts manager/admin SQL has no `m.sub = $2` in the devices subquery and Manager/Admin-only writes (setOccupant, setCannotSeat, setSeatTags, addSeats) never add it. |
| 3 | For a User, `GET /api/members` and `/api/members/[id]` give other members `devices: []` and `deviceCount: null`; their own row is unchanged. | `manage.test.ts › listMembers/getMember per tier: user binds sub as $2 and wraps device_count/devices in "case when coalesce(m.sub = $2::uuid, false)"; manager/admin SQL and values unchanged`; `manage.db.test.ts › visibility › user` (own row: real count + refs; other member: `null` + `[]`; seats, names, employee code unchanged; detail of another member: same; no member row: every row hidden); `manage.db.test.ts › visibility › manager and admin unchanged`; `members/route.test.ts › list and detail pass ctx.sub and ctx.tier`; `MembersView.test.tsx › null deviceCount renders a dash`. |
| 4 | Layout responses for a User carry only `type` and `deviceType` per seat device (DB test). | `layout.db.test.ts › seatDevices for a User who holds none of them: each entry has exactly keys type, deviceType; deviceType exactly id, slot, hasImage, imageVersion, sprite; JSON has no device id, name, inventory number, MAC or owner`. |
| 5 | Per-tier unit and DB tests for seats, members and layout. | `pnpm test` green with the tests in `## Tests to write`; `pnpm test:db` green in CI. |
| — | UX gap (ticket technical notes): "Primary device: None" when the primary belongs to someone else. | `SeatDetailPanel.test.tsx › hidden devices: primary and secondary show "None shown"; no hidden devices: "None"`. |

Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `pnpm test:db` (CI).

## Ming verification after merge
- Sign in on production as a User: open a seat that holds another member's device (panel shows only own devices plus
  "N more devices are not shown."; primary shows "None shown"); open Members (other members show "-" under Devices,
  own row shows own devices). Sign in as a Manager: same seat and Members page show everything.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/seats/seats.ts` | (1) `seatRows` (l.102-138) gets `visibility: DeviceVisibility` after `sub`; when `"held"` the devices JSON subquery `where` (l.126) becomes `d.org_id = s.org_id and d.seat_id = s.id and coalesce(m.sub = $2::uuid, false)`. The `device_count` subquery (l.118) is **not** changed (stays the total). (2) `loadSeat` (l.140) gets `visibility` too. (3) `getSeat(db, scope, sub, tier, id)` (l.145), `listRoomSeats(db, scope, sub, tier, roomId)` (l.155), `releaseSeat(db, scope, actorSub, tier, seatId)` (l.439) take `tier: Tier` and pass `deviceVisibility(tier)` (release: to all three `loadSeat` calls l.455, l.470). (4) Manager/Admin-gated writes pass the literal `"org"`: `addSeats` (l.335), `setOccupant` (l.419, l.435), `setCannotSeat` (l.485, l.501), `setSeatTags` (l.520, l.556); comment: "route is Manager+/Admin, D69 filter not needed". Imports `Tier` from `@/lib/auth/tier`, `deviceVisibility`/`DeviceVisibility` from `@/lib/devices/visibility`. | AC1, AC2 (architect R-d, F2). | No |
| `src/app/api/seats/[id]/route.ts` | l.17: `getSeat(pool, ctx.scope, ctx.sub, ctx.tier, id)`. | AC1. | No |
| `src/app/api/rooms/[id]/seats/route.ts` | l.19: `listRoomSeats(pool, ctx.scope, ctx.sub, ctx.tier, id)`. | AC1. | No |
| `src/app/api/seats/[id]/release/route.ts` | l.15: `releaseSeat(pool, ctx.scope, ctx.sub, ctx.tier, id)`. | AC1 (F2). | No |
| `src/server/members/manage.ts` | (1) `MemberRow.device_count: number \| null` (l.75). (2) `memberSelect(refCap, visible: string \| null)` (l.111): `null` → today's SQL byte for byte; a string (a SQL boolean) → `case when ${visible} then (select count(*)::int ...) end as device_count` and `case when ${visible} then coalesce((select json_agg(x) ...), '[]'::json) else '[]'::json end as devices`. (3) `listMembers(db, scope, sub, tier, f)` (l.137): when `deviceVisibility(tier) === "held"` call `bind(sub)` **first** (so it is `$2`) and pass `` `coalesce(m.sub = $2::uuid, false)` ``; else `null` (no extra value bound). (4) `loadMember(db, scope, id, viewerSub: string \| null)` (l.174): with a sub, values `[id, viewerSub]` and visible `coalesce(m.sub = $3::uuid, false)`. (5) `getMember(db, scope, sub, tier, id)` (l.184) passes `held ? sub : null`. (6) `mustLoad` (l.235, used by Manager-tier update/deactivate/reactivate) passes `null`. | AC3 (architect R-e: in SQL, nothing fetched and dropped). | No |
| `src/app/api/members/route.ts` | l.15: `listMembers(pool, ctx.scope, ctx.sub, ctx.tier, q.value)`. | AC3. | No |
| `src/app/api/members/[id]/route.ts` | l.19: `getMember(pool, ctx.scope, ctx.sub, ctx.tier, id)`. | AC3. | No |
| `src/lib/members/types.ts` | `MemberDto.deviceCount: number \| null` (l.45) with comment "null: hidden from a User for another member (MEM-02, D69); `devices` is then []". | AC3 contract. | No |
| `src/ui/members/MembersView.tsx` | l.138: `deviceMore = m.deviceCount === null ? 0 : moreCount(...)`; l.173: when `m.deviceCount === null` render `<span aria-hidden="true">{membersCopy.hiddenDevices}</span><span className="sr-only">{membersCopy.hiddenDevicesLabel}</span>`, else today's output. | AC3 UI (dash for null). | No |
| `src/ui/copy/members.ts` | Add `hiddenDevices: "-"` and `hiddenDevicesLabel: "Not shown"` (next to `noCode` l.22). | D36 copy. | No |
| `src/ui/seats/SeatDetailPanel.tsx` | In `SeatBody` (l.43-107): when `hidden > 0`, the empty primary text (l.80) and empty secondary text (l.91) use `seatsCopy.panel.noneShown`; otherwise `noPrimary` / `noSecondary` as today. "N more devices are not shown." (l.93) unchanged. | Ticket technical note (UX gap). | No |
| `src/ui/copy/seats.ts` | Add `panel.noneShown: "None shown"` (after `noSecondary` l.29). | D36 copy. | No |
| `src/server/seats/seats.test.ts` | Update `releaseSeat` calls (l.87, l.127, l.153) with tier `"user"`; import `getSeat`, `listRoomSeats`; new per-tier SQL tests. | AC1, AC2, AC5. | No (Low) |
| `src/server/seats/seats.db.test.ts` | Existing calls get a tier: l.189, l.209, l.214, l.218 → `"manager"` (the test is about list/detail mechanics); release calls l.372, l.412, l.417, l.422, l.426, l.475 → `"user"` (release is the occupant's action; assertions there are about occupancy, not devices). New `describe("seats (db): device visibility")`. | AC1, AC2, AC5. | No (Low) |
| `src/app/api/seats/seats-routes.test.ts` | Assert service args for GET seat, GET room seats, POST release (User and Manager). | AC1 wiring. | No (Low) |
| `src/server/members/manage.test.ts` | Existing `listMembers` calls (l.194, l.205) get `SUB, "manager"`; their value assertions stay identical (proves "unchanged"); new user-tier cases for list and get. | AC3, AC5. | No (Low) |
| `src/server/members/manage.db.test.ts` | Existing calls get `actorSub, "manager"`: l.200, l.295 (and `Parameters<typeof listMembers>[2]` → `[4]`), l.314, l.330, l.335, l.337. New `describe("members (db): device visibility")`. | AC3, AC5. | No (Low) |
| `src/app/api/members/route.test.ts` | Assert `listMembers` / `getMember` args per tier (l.89-109 test and a Manager case). | AC3 wiring. | No (Low) |
| `src/ui/members/MembersView.test.tsx` | New case: a row with `deviceCount: null, devices: []` renders the dash and "Not shown", no "+N more". | AC3 UI. | No (Low) |
| `src/ui/seats/SeatDetailPanel.test.tsx` | New cases for "None shown" vs "None". | UX gap. | No (Low) |
| `src/server/layout/layout.db.test.ts` | New case in `describe("getRoomLayout seatDevices (db)")` (l.841). | AC4, AC5. | No (Low) |

Not in the ticket's file list but needed: `src/ui/copy/seats.ts` (the panel copy tweak lives there, D36),
`src/server/seats/seats.test.ts`, `src/server/members/manage.test.ts`, `src/app/api/members/route.test.ts`,
`src/ui/members/MembersView.test.tsx`, `src/ui/seats/SeatDetailPanel.test.tsx` (signature changes and new tests).
Recorded here so R4 is met. **Not changed:** `src/lib/seats/types.ts` (no `SeatDto` change: `deviceCount` stays a
number, the hidden count is `deviceCount - devices.length`, already rendered at `SeatDetailPanel.tsx` l.46/l.93 and
`seat-view.ts` l.57-65), `src/server/layout/layout.ts` (already OQ-55 shape, architect F3).

Expected size: about 90 changed lines of product code, about 250 of tests. One cycle.

## Data model / migration
None. Indexes already cover the predicates: `members_org_sub_key unique (org_id, sub)`, `devices_org_owner_idx`
(`db/migrations/20261120150000_init.sql` l.52, l.138); the seat device subquery already joins `members m` on the owner.

## API contract
No new endpoint, no path change. Response shapes per tier:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/seats/[id]` | — | `SeatDto`; User: `devices` = only devices whose owner is the caller's member; `deviceCount` = total at the seat | unchanged (200, 404, 503) | user+ |
| GET | `/api/rooms/[id]/seats` | — | `RoomSeatsResponse`; per seat as above (cap `listDevices` = 20 applied after the filter) | unchanged | user+ |
| POST | `/api/seats/[id]/release` | — | `SeatDto` as above for a User; Manager/Admin full | unchanged (200, 404, 409 `not_allowed`) | user+ |
| GET | `/api/members` | unchanged | `MemberListResponse`; User: rows where `m.sub ≠ caller` get `deviceCount: null`, `devices: []` | unchanged | user+ |
| GET | `/api/members/[id]` | — | `MemberDto` as above | unchanged | user+ |
| GET | `/api/rooms/[id]/layout` | — | unchanged (`seatDevices`: `{type, deviceType}` only, every tier) | unchanged | user+ |

`MemberDto.deviceCount` becomes `number | null` (Manager/Admin always get a number). Write responses of Manager+/Admin
seat and member routes are unchanged.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/server/seats/seats.test.ts › getSeat/listRoomSeats: user SQL has "and coalesce(m.sub = $2::uuid, false)" inside the devices subquery, the device_count subquery has no "m.sub"; manager/admin SQL has no "m.sub = $2" beyond "o.sub = $2"; sub bound as $2 in both` | AC1, AC2 |
| `src/server/seats/seats.test.ts › releaseSeat as user reloads with the held filter (noop and release paths); setOccupant/setCannotSeat/setSeatTags/addSeats reloads never add it` | AC1 (F2), AC2 |
| `src/server/seats/seats.test.ts › org scoping (R6)` (existing, now with `getSeat`/`listRoomSeats` as user too) | R6 |
| `seats.db.test.ts › device visibility › user occupant X: seat has X's primary, Y's secondary, an unowned secondary; detail, room list and release response show only X's primary; deviceCount 3` | AC1 |
| `seats.db.test.ts › device visibility › user Y on X's seat sees only Y's device (lent); user Z (no devices) sees devices [] and deviceCount 3; a sub with no member row sees []` | AC1, fail-closed |
| `seats.db.test.ts › device visibility › X's device placed on Y's seat appears for user X on Y's seat` | AC1 (held, not seat-owned) |
| `seats.db.test.ts › device visibility › manager and admin see all 3 with owners, same as before` | AC2 |
| `seats.db.test.ts › device visibility › user list cap: 22 own + 3 others → 20 shown, deviceCount 25` | cap after filter |
| `src/app/api/seats/seats-routes.test.ts › GET seat, GET room seats, POST release pass (scope, "s1", "user", ID) for a User and "manager" for a Manager` | AC1 wiring |
| `src/server/members/manage.test.ts › listMembers user: values [org, sub, status, ...], SQL has "case when coalesce(m.sub = $2::uuid, false)" for device_count and devices; manager/admin: values and SQL as before` | AC3 |
| `src/server/members/manage.test.ts › getMember user: values [org, id, sub], "$3::uuid"; manager: [org, id]` | AC3 |
| `manage.db.test.ts › device visibility › user A (Nguyễn Văn Ân) with 2 devices, member B with 1 device and 1 seat: list as A → A: deviceCount 2 and 2 refs; B: deviceCount null, devices [], seatCount 1, seats [ref], name/employee code unchanged` | AC3, Domain focus (diacritics) |
| `manage.db.test.ts › device visibility › getMember as user: B → null/[]; A → full; status filter, q search and paging behave the same for user and manager (same ids)` | AC3 |
| `manage.db.test.ts › device visibility › a user sub with no member row: every row null/[]; manager and admin: every row full` | AC3, fail-closed |
| `src/app/api/members/route.test.ts › User list/detail pass (scope, "s1", "user", ...); Manager passes "manager"` | AC3 wiring |
| `src/ui/members/MembersView.test.tsx › deviceCount null renders "-" and "Not shown", no device refs, no "+N more"` | AC3 UI |
| `src/ui/seats/SeatDetailPanel.test.tsx › deviceCount 2, devices [] → primary and secondary "None shown" and "2 more devices are not shown."; deviceCount 0 → "None"` | UX gap |
| `layout.db.test.ts › seatDevices for a User: member X's primary and secondary at X's seat, read with member Y's sub: entries have exactly keys ["deviceType","type"], deviceType keys exactly ["hasImage","id","imageVersion","slot","sprite"] or null; JSON has no device id, name, inventory number, MAC or owner id` | AC4 |

## Approach
1. Seats: add the `visibility` parameter to `seatRows`/`loadSeat`, the held clause inside the devices JSON subquery
   only. `$2` is already the caller's sub (bound for `mine`), so no new value. The clause is chosen in TS from the pure
   rule (`deviceVisibility`), no user input in SQL text. `device_count` stays the total (OQ-55: "N other devices").
2. Thread `tier` through `getSeat`, `listRoomSeats`, `releaseSeat` and their routes. Manager/Admin-only writes pass
   `"org"`.
3. Members: `memberSelect` gets a nullable visibility expression; `null` keeps today's SQL so Manager/Admin queries are
   byte-identical. For a User the counts and refs of others become `null` / `[]` in SQL (`case when`). Thread `sub`,
   `tier` through `listMembers`, `getMember` and the two GET routes; `mustLoad` passes `null`.
4. `MemberDto.deviceCount: number | null`; `MembersView` shows a dash (with screen-reader text) for null. Fix the
   type errors `pnpm typecheck` reports (expected: only `MembersView.tsx`).
5. Seat panel copy: "None shown" for empty primary/secondary when devices are hidden.
6. Layout: DB test only.
7. Update existing tests to the new signatures (tier chosen so each test keeps its intent), add the new tests.

Rules: **R1** lib stays pure (`visibility.ts` reused, types only), server files keep `import "server-only"`, routes are
the only entry; `pnpm check:layers`. **R6** every query keeps `org_id = $1` via `orgQuery`; the caller is identified
only by the verified `ctx.sub`, the tier only by `ctx.tier` (from `org_roles`). **R7** no new refusal at all; reads only
filter, release keeps its 409 `not_allowed`; no 401/403 outside `withAuth`. **R2** no migration. **R3** no config.
**R5** tests above.

## Specialist input used
(From `work/tickets/SIM-044/consult-*.md`; no new consult for this slice.)
- software-architect: adopted R-d (tier through `seatRows`/`getSeat`/`listRoomSeats`/`loadSeat`, `deviceCount` stays
  total), F2 (release response is User tier, so it is filtered), R-e (members `null`/`[]` in SQL with `case when`),
  R-f / F3 (layout test only). **Rejected** R-d's new `otherDeviceCount` field: `deviceCount - devices.length` already
  gives it and the panel already renders it, so no `SeatDto` change and fewer UI files (architect risk 4, R4 friction).
  Q5 (member email) stays a follow-up (Ming, 2026-11-26).
- api-platform-engineer: adopted "seats: full objects only where `m.sub = $2`, the rest as a count" and "members: drop
  devices and count for others, keep names, code, seats"; layout unchanged. Rejected the `$tier <> 'user'` bound
  parameter form (same reason as in SIM-044: the clause is picked in TS from the pure rule, still parameterised) and
  the `SeatDto` change (see above).
- SIM-044 plan "Split proposal" slice B: followed as written, except the seat writes: only Manager/Admin-gated writes
  pass `"org"`; release (User tier) passes the caller's tier.

## Assumptions
- No other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (board 2026-11-26: only SIM-044.1 is `PLANNING`), so no rebase
  hotspot. SIM-045 (BACKLOG, My Portal) may read `/api/seats` or `/api/members` later and will see this shape.
- A primary device on a User's own seat is always theirs: primary needs owner = occupant
  (`src/lib/devices/rules.ts` l.88-93), and occupant changes and transfers demote or unplace it (`seats.ts` l.252-261,
  `handoffs.ts` l.444, l.498). So the place dialog's `seatTarget` (`src/ui/devices/place-device.ts` l.22-28, uses
  `seat.devices` primary) stays correct for a User, who may only place on their own seat (D72); the server stays the
  guard (409 `seat_has_primary`) in any case.
- Unowned (org inventory) devices placed at a seat are "not held" and hidden from Users (counted in `deviceCount`).
- A User with no member row sees no device at any seat and every member row as hidden (fail-closed).
- The seat list row (`SeatsView`, `deviceSummary` in `seat-view.ts` l.57-65) needs no change: it shows the User's own
  device names and "+N more" from the total.
- The members `q` search still matches name, email and employee code only (no device fields), so it reveals nothing
  about devices.
- Other members' email stays visible to Users (out of scope, follow-up approved by Ming). The write-action existence
  oracle stays a follow-up (out of scope).
- Dashboard counts unchanged (OQ-60 default). Exports are Manager+ and audit is Admin
  (`src/app/api/export/[kind]/route.ts` l.25, `src/app/api/audit/route.ts` l.19), so no other User channel remains.

## Blocking questions
None (every open point has a default; Ming answers at the plan gate).

## Split proposal
None (about 90 lines of product code plus about 250 of tests; one cycle).

## Questions for Ming at approval
Each has a proposed default the implementer follows if Ming just approves.

1. **Seat panel text for hidden devices.** OQ-55 says "N other devices"; the panel already shows "N more devices are
   not shown." (also used when the 200-device cap is reached). **Default: keep the existing text** (ticket scope), no
   new copy.
2. **"Primary device: None" when the primary belongs to someone else.** The panel cannot know whether a hidden device
   is the primary (sending that would be one more fact). **Default: when some devices are hidden, empty primary and
   secondary show "None shown"; otherwise "None" as today.** Alternative: also send a `hasHiddenPrimary` flag.
3. **Members page, Devices column for other members (User view).** **Default: "-" with screen-reader text "Not
   shown"; the caller's own row unchanged.** Alternative: hide the Devices column for Users entirely.
4. **`deviceCount` at a seat stays the total for Users** (they learn how many devices sit at a seat, not which).
   **Default: yes** (OQ-55 default, approved).
5. **Unowned org-inventory devices at a seat** are hidden from Users like other members' devices. **Default: yes**
   (D69: "only the devices they hold").
6. **Manager/Admin seat writes** (assign, cannot-seat, tags, add) keep returning full device data, passing a fixed
   `"org"` visibility because their routes already require Manager/Admin. **Default: yes.** Alternative: thread
   `tier` through those writes too (about 8 more lines and route changes, no behaviour change today).
