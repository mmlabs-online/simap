Status: READY

# Plan — SIM-044: Restrict User device visibility and add a "my devices" API

Gate: plan-approval (P1). Every default below is what the implementer builds unless Ming answers otherwise at the
gate; see **Questions for Ming at approval** at the end. No High path is touched (risk stays Medium).

## Scope summary
- `docs/spec-v1.md` DEV-12: "The server enforces visibility; the UI only hides what the API already withholds. For a
  User: the device list (`GET /api/devices`) returns only devices they hold; device detail and history
  (`/api/devices/[id]`, `/api/devices/[id]/history`) answer 404 for any device they do not hold; device results in
  search (DSH-02) contain only devices they hold. Other device data a User reaches through seats, members or the room
  map is limited as SEA-05, MEM-02 and LAY-06 say."
- DEV-12: "A "my devices" endpoint returns the devices held by the caller's member, for every tier: name, type,
  inventory number, placement (seat code and role, or "in my inventory"), expiry date and overdue flag, and any
  pending handoff. It is bounded (paged) and scoped by the token's `org` (R6)." / "Admins and Managers keep the full
  org list and detail (DEV-01 to DEV-11) and also get their own list from the same "my devices" endpoint." / "Unit
  tests cover the visibility rule per tier (list, detail, history, search)."
- DEV-11: "For a device a User does not hold, the detail and history API answer 404, as for an id from another org
  (SYS-01)."
- DSH-02: "For a User, device results contain only devices they hold (D69, DEV-12)."
- §2 roles, User: "Sees only the devices they hold (owner = their member), never the org's device list (D69, DEV-12)."
- SHL-01: "Devices (Manager+, D69)". SEA-05 / MEM-02 / LAY-06 / OQ-55 / OQ-58: see Split proposal (slice B).
- `work/decisions.md` D69: "Users can no longer list the org's devices. Enforced at the API: `GET /api/devices`,
  device detail and history (`/devices/[id]`) and device results in search (DSH-02) give a User only the devices they
  hold (owner = their member). A new "my devices" API returns the caller's held devices for every tier; Admin and
  Manager keep the full org list and also get their own list."
- D70: My Portal is a separate ticket ("(a) spec + User device restriction + my-devices API; (b) My Portal part 1").

**This plan covers slice A** (device list, detail, history, search, "my devices", pure rule; plus the nav hide only
if Ming picks option B of Q1). Seats / members / layout (ticket AC5) are slice B, see `## Split proposal`.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | For a User, `GET /api/devices` returns only devices they hold; Manager and Admin still get the full org list. | `devices.test.ts › listDevices: User SQL adds the held predicate, Manager/Admin do not`; `devices.db.test.ts › visibility › list per tier` (User sees only own; Manager/Admin see own + other member's + org inventory; User with no member row gets []). |
| 2 | For a User, detail and history of a device they do not hold answer 404 (same as another org's id, SYS-01); no 403 after a side effect (R7). | `devices.db.test.ts › visibility › detail 404 for not held` (body equals the cross-org 404 `{ok:false,status:404,code:"not_found"}`); `history.test.ts › User not holding: notFound, audit query never runs`; `history.db.test.ts › visibility per tier`; `devices-routes.test.ts › history route passes ctx.sub and ctx.tier; refusal 404 not_found`. Reads only, no write path changed; grep shows no new `forbidden`/403 in changed files. |
| 3 | For a User, search (DSH-02) returns only devices they hold. | `search.test.ts › user tier binds sub into the device group; manager/admin do not`; `search.db.test.ts › device group per tier` (User searching another member's device name, MAC or owner name gets no hit; Manager gets it); `search/route.test.ts › passes ctx.sub and ctx.tier`. |
| 4 | "My devices" returns the caller's held devices for every tier, paged and org-scoped, with the DEV-12 fields. | `devices.db.test.ts › listMyDevices` (each tier gets only own devices; org-scoped; placement / expiresOn / overdue / pendingHandoff present; paging over 3 devices with limit 2 gives 2 + cursor then 1 + null; empty member and no member row give `{items:[],nextCursor:null}`); `devices-routes.test.ts › GET /api/devices/mine`; `my-devices-query.test.ts`; `cursor.test.ts`. |
| 5 | Seat, member and layout responses for a User carry no id, name, inventory number, MAC or owner of devices they do not hold. | **Slice B (SIM-044.1)**, not in this PR. See `## Split proposal`. |
| 6 | Devices nav entry hidden for Users; Manager+ keep it. | Depends on Q1. Default (A): moved to SIM-045, not verified here. Option B: `nav.test.ts › user nav has no devices; manager and admin have it`, plus local run as a User: `/devices` redirects to `/`. |
| 7 | Unit tests cover the visibility rule per tier for list, detail, history, search and the new endpoint. | `pnpm test` green with the unit tests in `## Tests to write`; `pnpm test:db` green in CI. |

Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `pnpm test:db` (CI).

## Ming verification after merge
- Sign in on production as a User and as a Manager: Devices page (User sees only own devices), search for another
  member's device name, open a link to another member's device (`/devices/<id>` shows "not found").

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/devices/visibility.ts` (new) | `export type DeviceVisibility = "org" \| "held"`; `deviceVisibility(tier: Tier): DeviceVisibility` (`user` → `held`, else `org`). Pure, imports `Tier` from `@/lib/auth/tier`. | One testable rule (architect R-a). | No |
| `src/lib/devices/visibility.test.ts` (new) | Per-tier unit test. | AC7. | No |
| `src/lib/devices/cursor.ts` (new) | `MyDevicesCursor = { k: string; id: string }`, `encodeMyDevicesCursor` / `decodeMyDevicesCursor`, a copy of `src/lib/members/cursor.ts` l.1-28 (base64url JSON, exactly keys `k`,`id`, `k` at most 480 code points, `id` canonical UUID). | Keyset paging of the new endpoint. | No |
| `src/lib/devices/cursor.test.ts` (new) | Round-trip; rejects non-base64url, extra/missing keys, non-UUID id, overlong `k`, arrays. | Boundary validation (Domain focus). | No |
| `src/lib/validate/my-devices-query.ts` (new) | `parseMyDevicesQuery(params)` → `{limit, cursor?}`, a copy of `device-history-query.ts` l.1-38 with `MY_DEVICES_LIMITS` and the new cursor decoder. | Input validated at the boundary. | No |
| `src/lib/validate/my-devices-query.test.ts` (new) | Default limit; 1 and max ok; 0, max+1, `abc`, duplicate → `limit`; bad/duplicate cursor → `cursor`. | Pagination bounds. | No |
| `src/lib/devices/types.ts` | Add `MY_DEVICES_LIMITS = { defaultLimit: 50, maxLimit: 100 } as const` (next to `DEVICE_HISTORY_LIMITS` l.189) and `MyDevicesPage = { items: DeviceDto[]; nextCursor: string \| null }` (after `DeviceListResponse` l.147). Fix the `pendingHandoff` comment l.84 ("visible org-wide" → "visible to whoever may read the device"). | API contract type. | No |
| `src/server/devices/devices.ts` | (1) Split `deviceRows` (l.128-162) into `queryDeviceRows` (returns `DeviceRow[]`, adds `lower(d.name) as sort_key`) and `deviceRows` (= map `toDto`), same SQL and `$1..$3` binding. (2) `listDevices` (l.173) and `getDevice` (l.200): when `deviceVisibility(tier) === "held"` append ` and coalesce(m.sub = $2::uuid, false)` to the `where`. (3) New `listMyDevices(db, scope, sub, tier, q, today): Promise<MyDevicesPage>` (held predicate for every tier, keyset `(lower(d.name), d.id) > ($4::text, $5::uuid)`, limit `q.limit + 1`). `reload` (l.605) is **not** changed. | AC1, AC2, AC4. | No |
| `src/server/devices/history.ts` | `listDeviceHistory(db, scope, sub, tier, deviceId, q)`. Probe (l.37-46) adds `left join members m on m.org_id = d.org_id and m.id = d.owner_id` and `coalesce(m.sub = $3::uuid, false) as held` with values `[deviceId, sub]`; after the existing `!dev.rows[0]` check, `if (deviceVisibility(tier) === "held" && !dev.rows[0].held) return notFound;` before the audit query. | AC2. | No |
| `src/server/search/search.ts` | `search(pool, scope, f, viewer: { sub: string; tier: Tier })`; `devices(...)` (l.113-155) takes `viewer`; in `match`, when held, prefix `coalesce(m.sub = ${bind(viewer.sub)}::uuid, false) and (...)`. Seat and member groups unchanged. | AC3. | No |
| `src/app/api/devices/mine/route.ts` (new) | `GET`, `withAuth({tier:"user"})`, parse query (400 `invalid_request`), 503 without pool, `listMyDevices(pool, ctx.scope, ctx.sub, ctx.tier, q.value, todayUtc7(new Date()))`, `Cache-Control: no-store`. Pattern: `src/app/api/requests/mine/route.ts`. | AC4. | No |
| `src/app/api/devices/[id]/history/route.ts` | l.20: pass `ctx.sub, ctx.tier`. | AC2. | No |
| `src/app/api/search/route.ts` | l.15: `search(pool, ctx.scope, q.value, { sub: ctx.sub, tier: ctx.tier })`. | AC3. | No |
| `src/server/devices/devices.test.ts` | New SQL-capture tests per tier for list/get/listMyDevices; add `listMyDevices` to the "org scoping (R6)" test (l.200-227). | AC7. | No |
| `src/server/devices/history.test.ts` (new) | Small local `fakeDb` (as in `devices.test.ts` l.27-40): per-tier probe behaviour. | AC2, AC7. | No |
| `src/server/search/search.test.ts` | Per-tier SQL/value assertions; update existing calls to the new signature. | AC3, AC7. | No |
| `src/app/api/devices/devices-routes.test.ts` | History route args (l.21-22 mock already present); new `GET /api/devices/mine` cases. | AC2, AC4. | No |
| `src/app/api/search/route.test.ts` | Assert viewer argument. | AC3. | No |
| `src/server/devices/devices.db.test.ts` | New `describe("devices (db): visibility")` and `describe("devices (db): my devices")`; update existing reads that list or get **another member's / unowned** device as `"user"` to `"manager"` where the test is about something else: l.100-103, l.111-116 (keep `getDevice` loop l.117-131 for manager/admin only and assert 404 for user), l.880-885, l.907 (user z: now assert 404 instead of flags). | AC1, AC2, AC4; keep existing tests honest. | No |
| `src/server/devices/history.db.test.ts` | Helper l.60 passes sub/tier (manager by default); new per-tier cases. | AC2. | No |
| `src/server/search/search.db.test.ts` | Update calls; new device-group per-tier case. | AC3. | No |
| Option B of Q1 only: `src/lib/nav.ts`, `src/lib/nav.test.ts`, `src/ui/devices/DevicesPage.tsx` | `devices` `minTier: "manager"` (l.31); update tests l.7-22, l.57, l.113-117 (use `navItemsFor("manager")`); in `DevicesPage` (session at l.56) `useEffect`: tier `user` → `router.replace("/")`, render nothing meanwhile. `/devices/[id]` stays reachable (Q2). | AC6 (only if Ming keeps it here). | No |

Not in the ticket's file list but needed: `src/lib/validate/my-devices-query.ts(+test)`, `src/app/api/search/route.ts`,
the test files above, and (option B) `src/lib/nav.ts(+test)`. Recorded here so R4 is met.

## Data model / migration
None. No new index needed: `members_org_sub_key unique (org_id, sub)` and `devices_org_owner_idx on devices
(org_id, owner_id)` already exist (`db/migrations/20261120150000_init.sql` l.52, l.138), so the held filter resolves
the caller's member by key and the devices by owner.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/devices` | `?placement=` (unchanged) | `DeviceListResponse` (unchanged shape); User: only `owner = caller's member` | 200, 400, 401/403 (wrapper only), 503 | user+ (filter for user) |
| GET | `/api/devices/[id]` | — | `DeviceDto` | 200; 404 `not_found` for non-UUID, other org, **or (User) not held** | user+ |
| GET | `/api/devices/[id]/history` | `?limit=&cursor=` (unchanged) | `DeviceHistoryPage` (unchanged) | 200, 400; 404 `not_found` as above | user+ |
| GET | `/api/search` | unchanged | `SearchResponse` (unchanged shape); User: device group only held devices | 200, 400, 503 | user+ |
| GET | `/api/devices/mine` (new) | `?limit=1..100` (default 50), `?cursor=` (opaque) | `{ items: DeviceDto[], nextCursor: string \| null }`, ordered `lower(name), id` | 200, 400 `invalid_request`, 401/403 (wrapper only), 503 | every tier; always only the caller's held devices, org-scoped |

`DeviceDto` already carries every DEV-12 field: `name`, `type`, `inventoryNumber`, `placement` (`seatCode`, `role`,
or `null` = in my inventory), `holding.expiresOn`, `overdue`, `pendingHandoff`, plus the action flags SIM-045 needs
(POR-03). Incoming transfers to the caller stay on `GET /api/handoffs?box=incoming` (unchanged; DEV-08 fields).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/devices/visibility.test.ts › user is held; manager and admin are org` | rule per tier |
| `src/lib/devices/cursor.test.ts › round-trips; rejects malformed, extra keys, non-UUID id, overlong k` | cursor bounds |
| `src/lib/validate/my-devices-query.test.ts › defaults to 50; accepts 1 and 100; rejects 0, 101, abc, duplicates, bad cursor` | pagination bounds |
| `src/server/devices/devices.test.ts › listDevices/getDevice: user SQL has "m.sub = $2::uuid" in where; manager/admin SQL does not` | AC1, AC2 |
| `src/server/devices/devices.test.ts › listMyDevices: held predicate for every tier; keyset binds $4 text and $5 uuid only with a cursor; limit+1; nextCursor from the DB sort_key` | AC4 |
| `src/server/devices/devices.test.ts › org scoping (R6)` (extended with `listMyDevices`) | R6 |
| `src/server/devices/history.test.ts › user not holding: notFound and no audit_log query; user holding and manager/admin proceed; unknown id 404 for all` | AC2 |
| `src/server/search/search.test.ts › user tier: device query binds the sub and adds the held predicate; seat/member queries unchanged; manager/admin: no sub bound` | AC3 |
| `src/app/api/devices/devices-routes.test.ts › history passes ctx.scope, ctx.sub, ctx.tier; 404 refusal passes through` | AC2 wiring |
| `src/app/api/devices/devices-routes.test.ts › GET /api/devices/mine: 401 without token; 400 on bad limit/cursor without calling the service; 200 no-store with ctx args and today (UTC+7)` | AC4 wiring |
| `src/app/api/search/route.test.ts › passes { sub, tier } from ctx` | AC3 wiring |
| `devices.db.test.ts › visibility › list per tier: user sees only own (not other member's, not org inventory); manager/admin see all; user with no member row sees []` | AC1 |
| `devices.db.test.ts › visibility › detail: user 404 for other member's and unowned device, equal to the cross-org 404; own device 200` | AC2 |
| `devices.db.test.ts › visibility › pending recipient: 404 on detail before confirm, the device appears in listHandoffs(incoming) with name, type, inventory number; after confirm detail 200` | DEV-08 vs D69 |
| `devices.db.test.ts › visibility › former holder: after transfer confirm, old owner gets 404 on detail and the device leaves their list and "mine"` | former-holder rule |
| `devices.db.test.ts › my devices › every tier gets only own devices; other org's device absent; fields (placement, holding.expiresOn, overdue with TODAY, pendingHandoff); paging limit 2 over 3 (Vietnamese names "Đèn", "an", "Bàn" ordered by lower(name)); empty and no-member-row → []` | AC4, Domain focus |
| `history.db.test.ts › visibility › user: own 200, other member's 404, former holder 404 after transfer confirm; manager: 200 for any` | AC2 |
| `search.db.test.ts › device group per tier: user query matching another member's device name / MAC / that member's name has no device hit; own device found; manager finds both` | AC3 |
| Option B only: `src/lib/nav.test.ts › user nav has no devices; manager and admin have it` | AC6 |

## Approach
1. Add the pure rule `deviceVisibility` and its test.
2. `devices.ts`: split `deviceRows` into `queryDeviceRows` + `deviceRows` without changing SQL semantics (adds
   `sort_key` column only). Add the held clause in `listDevices` and `getDevice` only, appended to the caller's
   `where`, so the limit/`truncated` logic stays right (filter in SQL, never after). **Never** inside
   `deviceRows`/`reload`: writes reload the device for the actor after commit and a filter there would 500 after a
   side effect (architect F4, api risk 2).
3. `listMyDevices` on `queryDeviceRows` with the held clause for every tier; `nextCursor` from the last row's
   `sort_key` + `id` when `rows.length > limit`.
4. History: extend the probe, return the shared `notFound` before the audit query. Route passes `ctx.sub`, `ctx.tier`.
5. Search: viewer param; bound sub in the device group only.
6. New route `src/app/api/devices/mine/route.ts` (static segment wins over `[id]`; `[id]` would 404 "mine" anyway).
7. Update existing tests that silently relied on Users seeing every device; add the new tests.
8. Option B of Q1 only: nav + client redirect.

Rules: **R1** lib stays pure (`visibility.ts`, `cursor.ts`, validator), server files keep `import "server-only"`, the
route is the only entry into server; `pnpm check:layers`. **R6** every query keeps `org_id = $1` (orgQuery), the
caller is identified only by the verified `sub`, the tier only from `ctx.tier`. **R7** visibility refusals are 404
`not_found` from the service, all on read paths before any side effect; no 401/403 outside `withAuth`. **R3** no
config. **R2** no migration. **R5** tests above. `src/server/http/**` unchanged (Medium risk).

## Specialist input used
- api-platform-engineer: adopted SQL predicate (not post-filter), 404 via `notFound`, former holder by current
  owner, `/api/devices/mine` keyset on `lower(name), id`, keep `src/server/http/**` unchanged, write-path reload risk.
  Rejected a slim DTO: full `DeviceDto` is returned because the caller holds the device and SIM-045 needs the action
  flags (architect R-c). Rejected `$tier <> 'user'` as a bound SQL parameter: the clause is chosen in TS from the pure
  rule, still fully parameterised (no user input in SQL text). Dropping the owner-name match for Users: not needed,
  the held predicate already limits hits to the caller's own devices.
- software-architect: adopted R-a (pure rule + per-query clause), R-b, R-c, F4/F5/F6 (incoming transfers stay on
  handoffs), F7/R-g as option B, sequencing risk 1 drives the Q1 default. R-d/R-e/R-f (seats, members, layout) moved
  to slice B. Q4 (write oracle) and Q5 (member email) proposed as follow-ups.

## Assumptions
- No other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (board 2026-11-26), so no rebase hotspot. SIM-045 (BACKLOG)
  depends on this and will build on `/api/devices/mine`; SIM-043 (BACKLOG, app-wide admin) may later add a tier, the
  rule then maps it explicitly.
- Until SIM-045 ships, a User keeps the Devices page (default A) and it lists only their own devices; filters like
  "Org inventory" show empty for them. Incoming transfers, owner actions and the handoff badge keep working there.
- A User with no linked member row matches nothing (fail-closed): empty list, 404 detail, empty "mine".
- The new holder of a device sees its full history, including entries from previous holders (DEV-11 "its history").
- Existing UI needs no change for 404: `device-detail-state.ts` l.25-36 already has a `notFound` state and
  `device-detail-actions.ts` l.58-72 treats a 404 on refresh as "device gone".
- Write actions on a device the User does not hold still answer 422 `not_allowed` / 409 (existence oracle, architect
  F5); out of scope (ticket: device actions unchanged), proposed follow-up.
- Dashboard org device counts unchanged (OQ-60 default: counts only, no rows).

## Blocking questions
None (every open point has a default; Ming answers at the plan gate).

## Split proposal
The full ticket is about 280 lines of product code plus about 450 lines of new/changed tests (signature changes in
seven test files), above one implement/review cycle. Proposed:
- **Slice A, SIM-044 (this plan):** AC1, AC2, AC3, AC4, AC7 (+ AC6 only under Q1 option B).
- **Slice B, SIM-044.1 "Limit device data in seat, member and layout responses for Users" (AC5, Medium, gate
  plan-approval):** design for its planner, from the consults:
  - Seats (`src/server/seats/seats.ts` l.101-185, routes `src/app/api/seats/[id]/route.ts`,
    `src/app/api/rooms/[id]/seats/route.ts`, `src/app/api/seats/[id]/release/route.ts`): `seatRows`/`loadSeat` take a
    `DeviceVisibility`; for `held` the `devices` JSON subquery (l.119-127) adds `and coalesce(m.sub = $2::uuid, false)`;
    `deviceCount` stays the total. `getSeat`, `listRoomSeats`, `releaseSeat` take `tier` (release is User tier and
    returns the seat, architect F2); Manager/Admin-gated writes pass `"org"`. No DTO type change: the panel already
    shows "N more devices are not shown." from `deviceCount - devices.length` (`SeatDetailPanel.tsx` l.46, l.93).
    Known UX gap: "Primary device: None" when the primary belongs to someone else (copy tweak in that slice).
  - Members (`src/server/members/manage.ts` l.111-191, routes `src/app/api/members/route.ts`, `[id]/route.ts`):
    `memberSelect` gets a visibility SQL expression (`true` or `m.sub = $n::uuid`); for others, `device_count` → null
    and `devices` → `[]` in SQL (`case when`). `MemberDto.deviceCount: number | null` (`src/lib/members/types.ts`
    l.45), `MembersView.tsx` l.138/l.173 shows a dash for null (copy in `src/ui/copy/members.ts`). Own row unchanged.
  - Layout: no code change (already only `type` + `deviceType`, `src/server/layout/layout.ts` l.123-166); a
    `layout.db.test.ts` case locks the shape for a User.
  - DB tests: `seats.db.test.ts` (existing l.178-222 to manager + new user cases), `manage.db.test.ts`,
    `layout.db.test.ts`; route tests.
- Alternative if Ming prefers one PR: implement slice B in this ticket too (roughly 700 changed lines).

## Questions for Ming at approval
Each has a proposed default the implementer follows if Ming just approves.

1. **Nav hide and redirect: here or SIM-045?** Hiding the Devices entry and page for Users now removes their only UI
   to confirm incoming transfers, act on their devices and see their badge until My Portal ships (architect risk 1).
   **Default (A): move the nav hide + `/devices` redirect to SIM-045** (orchestrator adds it to SIM-045's scope and
   AC; AC6 leaves SIM-044). The API restriction alone already enforces D69. Option B: do it here (`nav.ts` minTier
   manager, client redirect to `/` in `DevicesPage`), accepting the gap.
2. **Keep `/devices/[id]` reachable for Users for devices they hold?** **Default: yes.** Links from search, the seat
   panel and later My Portal keep working; a device not held shows the existing "not found" state (DEV-11 allows it).
3. **404 for a device not held** (including a pending transfer recipient before they confirm, and unowned
   org-inventory devices). **Default: yes, 404 `not_found` identical to another org's id** (DEV-11, DEV-12, SYS-01).
   The recipient sees name, type, inventory number, sender and note via the incoming handoff list (DEV-08).
4. **A former holder loses access** to detail and history once the device leaves them (transfer confirmed, return
   confirmed, Admin take-back). **Default: yes** (rule is "current owner = me"); the new holder sees the full history.
5. **OQ-55 (devices at seats for Users)** — slice B. **Default: spec default**: sprites draw for every tier; the
   layout API keeps only type/slot per device (no id, name, inventory number, MAC or owner; note the free-text `type`
   string is part of it); the seat panel lists the User's own devices in full and "N more devices are not shown."
   for the rest (count only, from the existing `deviceCount`).
6. **OQ-58 (members list for Users)** — slice B. **Default: spec default**: Users keep the Members page (names,
   employee code, seats); other members' rows carry `devices: []` and `deviceCount: null`; the caller's own row is
   unchanged; the transfer member picker stays. Sub-question: other members' **email** is still returned to Users
   today — **default: unchanged here, follow-up ticket** if Ming wants it hidden.
7. **OQ-60 (dashboard device counts for Users).** **Default: Users keep the org-wide "placed vs. in inventory"
   counts (numbers only); no change in this ticket.**
8. **Endpoint path and shape.** **Default: `GET /api/devices/mine`** (precedent `/api/requests/mine`), returning full
   `DeviceDto` items (including MAC, serial and action flags, since the caller holds the device) with
   `nextCursor`, limit default 50, max 100. Alternative: `/api/me/devices`.
9. **Split.** **Default: slice A here, slice B as SIM-044.1 right after** (seat panel and Members page keep showing
   other members' devices to Users until SIM-044.1 merges; that is today's behaviour, not a regression). Alternative:
   one larger PR.
10. **Write actions on a device not held** still reveal existence (422 `not_allowed`, 409 on a taken inventory
    number). **Default: follow-up ticket**, no change here (ticket says device actions are out of scope).
11. **OQ-59 (nav badge for Users).** **Default: stays with SIM-045** (badge moves to My Portal there); unchanged here.
