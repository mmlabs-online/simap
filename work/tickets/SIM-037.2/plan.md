Status: READY

# Plan — SIM-037.2: Assign from org inventory and new device fields (slice 1 of 2: API, data and SIM-037.1 carry-overs)

This plan covers **slice 1** only (see `## Split proposal`). Slice 1 ships every server behaviour in the ticket
(assign, holding edit, serial/manufacturer/brand in create/edit/list/search/CSV, audit rows), the two SIM-037.1
carry-overs, and only the UI changes the new DTO forces (fixtures) or that the carry-overs need. The Assign dialog,
the holding-edit dialog, the new form fields and the list display of the new fields go to slice 2.

**High path: none.** No file in this plan matches a High path in `.claude/loop.config.md` (no migration, nothing under
`src/server/http/**`, `src/proxy.*`, config, Docker or deploy files). The schema is already in place
(`db/migrations/20261125120000_device_lifecycle.sql`, SIM-037.1). The ticket still has Gate `plan-approval` (P1), and
the security review trigger fires (changes under `src/server/`).

## Scope summary
- `docs/spec-v1.md` §6 DEV-01 (lines 273-275): "A device has name, type, inventory number (unique), and optional MAC
  (unique if set; format checked), serial number (unique if set, trimmed, at most 100 characters), manufacturer and
  brand (free text, at most 100 characters each). Owner is optional: empty means the device is in the org inventory."
- DEV-01 (lines 276-278): "An Admin edits any device's fields; the owner edits their own device's fields. Editing never
  changes the owner: only DEV-07 to DEV-09 do."
- DEV-07 (lines 307-312): "An Admin or Manager assigns a device in the org inventory to an active member, with an
  optional note (at most 500 characters) and an optional expiry date (empty = no expiry; a calendar date, not in the
  past). The device then belongs to that member and is in their inventory, not placed; the member places it
  themselves. No confirmation by the member is needed. An owned device cannot be assigned (it must be transferred or
  returned first)." / "An Admin or Manager edits the current assignment's note and expiry date (this is also how an
  extension is granted, DEV-10)."
- DEV-02 (lines 284-286): "The Devices page filters by all / placed / not placed / org inventory / overdue." (source of
  the "Not placed" rename).
- `work/decisions.md` D63: "Admin/Manager assigns one to a member with an optional note and an optional expiry (no
  expiry allowed); it lands in the member's inventory, not placed. … New optional fields: serial number, manufacturer,
  brand." D35: "Times stored in UTC and shown in UTC+7 (Asia/Ho_Chi_Minh) for every org in v1." D36: UI copy in copy
  files.
- Ticket scope: "Audit rows `device.assign` and `device.holding_update` with member ids, note and expiry in meta."
- SIM-037.1 follow-ups (`work/tickets/SIM-037.1/impl-log.md` lines 46-47): "DeleteDeviceDialog.tsx /
  delete-device-flow.ts still have a "move to inventory first" branch for a placed device; unreachable now … Remove in
  SIM-037.2." and "`inventory` filter label "Inventory" vs "Org inventory" overlap (A4): rename to "Not placed" in
  SIM-037.2."

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Admin and Manager can assign an org-inventory device; a User cannot; assigning an owned device is refused (409/422). | `src/lib/devices/rules.test.ts › canAssign / canManageHolding matrix`; `src/server/devices/devices.test.ts › assignDevice: user → 422 not_allowed before any query`, `› owned device → 409 device_owned`; `src/server/devices/devices.db.test.ts › assign: admin and manager succeed`, `› two concurrent assigns: one ok, one 409 device_owned`; `src/app/api/devices/devices-routes.test.ts › POST assignment`. |
| 2 | After assign the device belongs to the member, is not placed, and shows note and expiry; expiry empty means no expiry. | `devices.db.test.ts › assign sets owner, keeps seat null, returns holding {note, expiresOn}` and `› assign without expiry → holding.expiresOn null`; `› expiry round-trips as YYYY-MM-DD (no day shift)`. UI display is slice 2. |
| 3 | An expiry date in the past is refused; note over 500 chars is refused. | `src/lib/validate/device.test.ts › validateAssign / validateHoldingPatch` (yesterday UTC+7 refused, today allowed, 501 chars refused, 500 allowed, `2026-02-30` refused); `src/lib/devices/holding.test.ts › todayUtc7 around 17:00 UTC`; route test `› past expiry → 400 invalid_request` with a fixed system time. |
| 4 | Serial (unique per org when set), manufacturer and brand can be set and edited and appear in the list, search and CSV export. | `device.test.ts › create/patch accept serial, manufacturer, brand; blank → null; > 100 refused`; `devices.db.test.ts › create and patch with serial/manufacturer/brand; duplicate serial → 409 serial_taken`, `› list DTO carries them`; `src/server/devices/pg-error.test.ts › devices_org_serial_key → serial_taken`; `src/server/search/search.db.test.ts › finds a device by serial, manufacturer, brand (diacritics folded)`; `src/server/export/export.test.ts › devices header and row include Serial, Manufacturer, Brand`. Showing them in the Devices table and form is slice 2. |
| 5 | Each assign and holding edit writes one audit row. | `devices.db.test.ts › assign writes one device.assign row with memberId, note, expiresOn`; `› holding edit writes one device.holding_update row with from/to`; `› no-op holding edit writes no row`; `› refused assign writes no row`. |
| 6 | (carry-over) Filter "Inventory" reads "Not placed". | `src/ui/devices/devices-state.test.ts › filter labels` expects `"Not placed"`; `› listSummary` expects `"12 devices · Not placed"`. |
| 7 | (carry-over) The unreachable "move to inventory first" delete flow is gone. | `src/ui/devices/delete-device-flow.test.ts` and `DeleteDeviceDialog.test.tsx` cover only confirm/delete; `rg "moveBody\|settleMove\|afterRefetch\|placedBody" src/ui` returns nothing. |
| 8 | Checks green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` locally; `pnpm test:db` green in CI (no Docker on this machine, SIM-037.1 note). |

## Ming verification after merge
None for slice 1 (no UI flow changes beyond copy). The ticket's "Manual: assign with and without expiry" moves to
slice 2.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/devices/holding.ts` (new) | Pure `todayUtc7(now: Date): string` and `parseCalendarDay(s: unknown): string \| null` (strict `YYYY-MM-DD`, real date, year 2000-2100). | Expiry is a UTC+7 calendar date (D35); shared by validator, route and slice-2 UI. | No |
| `src/lib/devices/holding.test.ts` (new) | Unit tests (see Tests). | R5. | No |
| `src/lib/devices/types.ts` (lines 1-47) | `DEVICE_LIMITS` + `serial: 100, manufacturer: 100, brand: 100, note: 500`; `DeviceCreateValue`/`DevicePatchValue` + `serial`, `manufacturer`, `brand` (`string \| null`); `DeviceDto` + `serial`, `manufacturer`, `brand`, `holding: { note; expiresOn } \| null`, `canAssign`, `canEditHolding`; new `AssignValue = { memberId; note; expiresOn }`, `HoldingPatchValue = Partial<{ note: string \| null; expiresOn: string \| null }>`. | DTO and validator value types (A1). | No |
| `src/lib/devices/rules.ts` (lines 4-12) | Add `canAssign = (tier) => atLeast(tier, "manager")` and `canManageHolding = (tier) => atLeast(tier, "manager")`. | DEV-07 permission; distinct from `canEdit` (owner must not extend their own loan). | No |
| `src/lib/devices/rules.test.ts` | Permission matrix for both (admin, manager true; user false). | Ticket test plan "permission matrix". | No |
| `src/lib/validate/device.ts` (lines 78-132) | Add `optText(v, max)` (null/undefined/blank → null, invalid → undefined); one `DEVICE_KEYS` constant for create and patch; serial/manufacturer/brand in create (missing → null) and patch; new `validateAssign(body, today)` and `validateHoldingPatch(body, today)` (note: NFC, trim, ≤ 500 code points, line breaks allowed, other control/format chars refused; expiresOn via `parseCalendarDay`, `>= today`). | Boundary validation; holding fields never accepted by create/PATCH. | No |
| `src/lib/validate/device.test.ts` | New cases (see Tests). | R5. | No |
| `src/server/devices/pg-error.ts` (lines 3-27) | Add `"serial_taken"` to `DeviceConflictCode`; map 23505 on `devices_org_serial_key`. | Raw 23505 would be a 500. | No |
| `src/server/devices/pg-error.test.ts` | One case for the mapping. | R5. | No |
| `src/server/devices/devices.ts` | `DeviceRow`/`toDto`/`deviceRows` SELECT (lines 64-126) gain `serial, manufacturer, brand, holding_note, to_char(d.holding_expires_on, 'YYYY-MM-DD') as holding_expires_on`; flags `canAssign`/`canEditHolding`; `createDevice` INSERT (lines 316-324) adds the three columns; `COLUMNS` (337-342) and the `updateDevice` current-row SELECT (355-367) add them; new `assignDevice` and `updateHolding`; `Refusal.code` gains `"member_not_assignable" \| "not_assigned"`. | Core of the ticket. | No |
| `src/server/devices/devices.test.ts` | Scripted-DB unit tests for both new functions and the new columns. | R5. | No |
| `src/server/devices/devices.db.test.ts` | DB integration tests (see Tests). | Ticket test plan "assign races". | No |
| `src/app/api/devices/[id]/assignment/route.ts` (new) | `POST`, same shape as `placement/route.ts`: uuid check, pool, `readJson`, `validateAssign(body, todayUtc7(new Date()))`, `assignDevice`. | Assign endpoint. | No |
| `src/app/api/devices/[id]/holding/route.ts` (new) | `PATCH`, same shape, `validateHoldingPatch`, `updateHolding`. | Holding edit endpoint. | No |
| `src/app/api/devices/devices-routes.test.ts` | Cases for both routes and the new DTO fields. | R5, R7. | No |
| `src/lib/api/error.ts` (lines 35-40) | Add `"serial_taken"`, `"not_assigned"`. | Closed error-code list. | No |
| `src/ui/copy/api.ts` (lines 25, 43, new) | Messages for `serial_taken`, `not_assigned`; generalise `member_not_assignable` and `device_owned` wording (A4). | `satisfies Record<ApiErrorCode, string>` forces texts. | No |
| `src/server/search/search.ts` (lines 116-133) | SELECT unchanged in shape; add `like("d.serial", p)`, `like("d.manufacturer", p)`, `like("d.brand", p)` to `alts`. | AC4 "appear in … search" (A6). | No |
| `src/server/search/search.db.test.ts` | Match by serial / manufacturer / brand, folded. | R5. | No |
| `src/server/export/export.ts` (lines 53-88) | Devices: columns `Serial`, `Manufacturer`, `Brand` after `MAC`; SELECT and `map` aligned. | AC4 CSV. | No |
| `src/server/export/export.test.ts` (and `export.db.test.ts` if it asserts the header) | Header and row order. | R5. | No |
| `src/ui/devices/delete-device-flow.ts` | Remove `DeleteStep`, `deleteStep`, `moveBody`, `settleMove`, `MoveSettled`, `afterRefetch`, `RefetchSettled`, the `placed` branch of `settleDelete`; `DeleteSettled` = done / error (+ `stale: boolean` for `device_owned`, `handoff_pending`). | Carry-over (impl-log line 46). | No |
| `src/ui/devices/DeleteDeviceDialog.tsx` | Plain confirm dialog: no `step`, `moved`, `refetch`; on a stale refusal show the message and call `onStale`. | Carry-over; `device_owned` becomes reachable via an assign race. | No |
| `src/ui/devices/delete-device-flow.test.ts`, `src/ui/devices/DeleteDeviceDialog.test.tsx` | Shrink to the confirm flow. | Follow the code. | No |
| `src/ui/copy/devices.ts` (lines 7, 29-36, 93) | `filters.inventory: "Not placed"`; `empty.inventory: "No devices are unplaced."`; remove `delete.submit.placed`, `placedBody`, `moved` (keep `delete.submit` as a single `confirm` label). | Carry-overs. | No |
| `src/ui/devices/devices-state.test.ts`, `DevicesView.test.tsx` | Expected labels follow the copy. | Follow the copy. | No |
| DeviceDto fixtures: `src/ui/devices/device-actions.test.ts`, `device-form.test.ts`, `DevicesView.test.tsx`, `place-device.test.ts`, `PlaceDeviceDialog.test.tsx` | Add the new DTO fields (`serial: null, …, holding: null, canAssign: false, canEditHolding: false`). | `pnpm typecheck`. | No |

Not touched: `src/server/members/manage.ts` (see A8), `src/server/audit/*` (no allowlist exists; `writeAudit` takes any
action string), `src/lib/search/types.ts` / `SearchView.tsx` (A6), any migration.

## Data model / migration
None. All columns and constraints exist (`20261125120000_device_lifecycle.sql` lines 7-31): `serial`, `manufacturer`,
`brand` (trimmed, non-empty, ≤ 100), `holding_note` (trimmed, non-empty, ≤ 500), `holding_expires_on date`, unique
partial index `devices_org_serial_key (org_id, serial) where serial is not null`, `devices_unowned_no_holding_check`.
The validator always stores null instead of an empty string, so the non-empty checks never fire from the app.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `/api/devices/{id}/assignment` | `{ memberId: uuid, note?: string \| null, expiresOn?: "YYYY-MM-DD" \| null }`; no other keys | 200 `DeviceDto` | 400 `invalid_request` (body, past or impossible date, note > 500); 404 `not_found` (device); 409 `device_owned`, `handoff_pending`; 422 `not_allowed`, `member_not_assignable` (member missing or not active); 401/403 only from `withAuth` | Wrapper `user`; domain Manager+ |
| PATCH | `/api/devices/{id}/holding` | Non-empty partial `{ note?: string \| null, expiresOn?: "YYYY-MM-DD" \| null }`; null or blank clears | 200 `DeviceDto` (unchanged → same DTO, no audit row) | 400 `invalid_request`; 404 `not_found`; 409 `not_assigned` (device unowned); 422 `not_allowed` | Wrapper `user`; domain Manager+ |
| POST | `/api/devices` | + optional `serial`, `manufacturer`, `brand` (`string \| null`, blank → null, ≤ 100) | 201/200 as today | + 409 `serial_taken` | Admin (unchanged) |
| PATCH | `/api/devices/{id}` | + optional `serial`, `manufacturer`, `brand`; holding keys stay unknown (400) | as today | + 409 `serial_taken` | owner or Admin (unchanged) |
| GET | `/api/devices`, `/api/devices/{id}` | — | `DeviceDto` + `serial`, `manufacturer`, `brand`, `holding: { note: string \| null, expiresOn: string \| null } \| null` (null iff unowned), `canAssign` (Manager+ and unowned), `canEditHolding` (Manager+ and owned) | as today | as today |
| GET | `/api/export?kind=devices` | — | CSV + `Serial`, `Manufacturer`, `Brand` after `MAC` | as today | as today |

Filter value `?placement=inventory` keeps its wire name; only the label changes (A5).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/devices/holding.test.ts › todayUtc7` at `2026-11-25T16:59:59.999Z` → `2026-11-25`, at `17:00:00Z` → `2026-11-26`, at `2026-12-31T17:00Z` → `2027-01-01` | D35, UTC vs UTC+7 (Domain focus) |
| `holding.test.ts › parseCalendarDay` accepts `2028-02-29`; refuses `2026-02-30`, `2026-13-01`, `2026-1-5`, `1999-12-31`, `2101-01-01`, non-strings, `2026-11-25T00:00` | strict date |
| `src/lib/devices/rules.test.ts › canAssign / canManageHolding` admin, manager true; user false | permission matrix |
| `src/lib/validate/device.test.ts › validateDeviceCreate` serial/manufacturer/brand: missing → null, `"  "` → null, trimmed, NFC (`"Nguyễn"` → NFC), 100 ok / 101 refused, control char refused, `holdingNote`/`ownerId` unknown key refused | DEV-01 fields, diacritics, empty/null |
| `device.test.ts › validateDevicePatch` same for the three fields; `{ serial: null }` alone is a valid patch; `{ note: "x" }` refused (unknown key) | holding not editable via PATCH |
| `device.test.ts › validateAssign` memberId required canonical uuid; note 500 ok / 501 refused; note with `\n` ok, with `\u0007` refused; blank note → null; expiresOn absent/null/`""` → null; `today` allowed, `yesterday` refused; extra key refused; non-object body refused | DEV-07 limits, AC3 |
| `device.test.ts › validateHoldingPatch` empty object refused; only-note patch ignores expiry rule; past expiry refused; `expiresOn: null` clears | edit rules (A3) |
| `src/server/devices/pg-error.test.ts › devices_org_serial_key → serial_taken` | 23505 mapping |
| `src/server/devices/devices.test.ts › assignDevice: user → 422 not_allowed, zero queries` | R7 order |
| `devices.test.ts › assignDevice lock order: member for share, then device for update, then update, then audit` | deadlock-safe order vs `deactivateMember` |
| `devices.test.ts › assignDevice: inactive member → 422 member_not_assignable; owned → 409 device_owned; pending handoff → 409; missing device → 404; no write, no audit on refusal` | refusals |
| `devices.test.ts › updateHolding: user → 422 before any query; unowned → 409 not_assigned; unchanged → no update, no audit; changed note only → SET holding_note only` | holding edit |
| `devices.test.ts › updateDevice writes serial/manufacturer/brand; audit fields list names them` | DEV-01 edit |
| `src/server/devices/devices.db.test.ts › assign (admin and manager): owner set, seat null, role unchanged, holding returned, one device.assign audit row with memberId, note, expiresOn` | AC1, AC2, AC5 |
| `devices.db.test.ts › assign without note/expiry → holding { note: null, expiresOn: null }` | "empty = no expiry" |
| `devices.db.test.ts › expiry 2026-12-31 round-trips unchanged` (with the pg client in a non-UTC TZ if the harness allows, else as is) | `to_char` day-shift guard |
| `devices.db.test.ts › two concurrent assigns on one device: exactly one ok, the other 409 device_owned; one audit row` | ticket race test |
| `devices.db.test.ts › assign to a deactivated member → 422 member_not_assignable, device unchanged` | active-member rule |
| `devices.db.test.ts › assign then delete → 409 device_owned` | delete vs assign |
| `devices.db.test.ts › holding edit: note + expiry changed, one device.holding_update row with from/to; unowned → 409 not_assigned` | AC5, DEV-07 edit |
| `devices.db.test.ts › create/patch with serial; duplicate serial in same org → 409 serial_taken; same serial in another org ok; two devices with null serial ok` | AC4 uniqueness |
| `src/app/api/devices/devices-routes.test.ts › POST assignment`: 400 bad body, 400 past expiry (system time fixed via `vi.setSystemTime`), 200 DTO; `› PATCH holding`: 400 empty body, 200 | route wiring |
| `src/server/search/search.db.test.ts › matches serial, manufacturer and brand (case and diacritics folded, e.g. "nguyen" matches manufacturer "Nguyễn"; "sn-00" matches serial "SN-0042")` | AC4 search |
| `src/server/export/export.test.ts › devices columns include Serial, Manufacturer, Brand after MAC; row aligned; null → empty cell` | AC4 CSV |
| `src/ui/devices/delete-device-flow.test.ts › settleDelete: ok/not_found → done; device_owned, handoff_pending → error + stale; other → error` | carry-over |
| `src/ui/devices/DeleteDeviceDialog.test.tsx › renders the confirm body only` | carry-over |
| `src/ui/devices/devices-state.test.ts › filter labels / listSummary` with "Not placed" | carry-over |

## Approach
1. **Pure helpers.** `src/lib/devices/holding.ts`: `todayUtc7(now)` = `new Date(now.getTime() + 7*3_600_000).toISOString().slice(0, 10)`;
   `parseCalendarDay` uses the same real-date check as `dayStart` in `src/lib/audit/day-range.ts` (lines 5-14), plus
   the year bound. Never `new Date().toISOString().slice(0,10)` without the offset. Rules in `rules.ts`. Types in
   `types.ts`.
2. **Validators** (`src/lib/validate/device.ts`). `optText` for the three optional fields; one `DEVICE_KEYS` constant
   for create and patch (holding keys stay unknown there). `validateAssign(body, today)` /
   `validateHoldingPatch(body, today)`: note via a `noteText` that allows `\n` (normalise `\r\n` → `\n`), refuses other
   `\p{Cc}\p{Cf}`, NFC, trim, ≤ 500 code points (same unit as Postgres `char_length`), blank → null; expiry via
   `parseCalendarDay` and `>= today` (string compare). The clock is injected, so the validator stays pure (lib layer, R1).
3. **pg-error** mapping `serial_taken` (409 by `inTx` default).
4. **Reads.** Extend `deviceRows` SELECT with the five columns, reading the date with
   `to_char(d.holding_expires_on, 'YYYY-MM-DD')` (pg would parse `date` into a local-TZ JS Date). `toDto` builds
   `holding` only when `owner_id` is not null, and `canAssign = owner_id === null && canAssign(tier)`,
   `canEditHolding = owner_id !== null && canManageHolding(tier)`.
5. **create / update.** INSERT adds `serial, manufacturer, brand` (`$6..$8`). `COLUMNS` gains the three pairs and the
   locked SELECT reads them; the existing `changed` filter compares `null` correctly. Audit meta stays
   `{ fields, from/to only for inventory number }`.
6. **assignDevice** (new, `devices.ts`). `if (!canAssign(tier))` → resolve 422 `not_allowed` before `inTx` (R7, like
   `createDevice`). In the transaction: (a) `select id, status from members where org_id = $1 and id = $2 for share`;
   missing or `status <> 'active'` → 422 `member_not_assignable` (same code and lock as `src/server/seats/seats.ts`
   lines 397-406); (b) `select owner_id, seat_id, inventory_number from devices … for update`; missing → 404;
   `owner_id` not null → 409 `device_owned`; (c) pending handoff → 409 `handoff_pending` (same query as
   `deleteDevice` line 424-429); (d) one `update devices set owner_id = $3, holding_note = $4, holding_expires_on = $5::date, updated_at = now() where org_id = $1 and id = $2`
   (seat stays null, role untouched); (e) `writeAudit` `device.assign`, meta
   `{ memberId, note, expiresOn, inventoryNumber }`; (f) `reload`. Lock order member → device matches
   `deactivateMember` (member → rooms → seats → devices), so no deadlock; the share lock blocks a concurrent
   deactivation until commit, and the status is read under it.
7. **updateHolding** (new). Manager+ check before `inTx`. Lock the device row (`owner_id, holding_note,
   to_char(holding_expires_on,'YYYY-MM-DD')`); missing → 404; unowned → 409 `not_assigned`; compute changed keys;
   none → `reload` without audit; else SET only the changed columns (names from a fixed map, values as parameters),
   audit `device.holding_update` meta `{ ownerId, fields, from: { note, expiresOn }, to: { note, expiresOn } }`.
8. **Routes.** Two new files copied from `src/app/api/devices/[id]/placement/route.ts` (lines 11-26): `withAuth`
   tier `user`, uuid → 404, pool → 503, `readJson` → 400, validator with `todayUtc7(new Date())` → 400, domain result.
   `src/app/api/routes-guarded.test.ts` enumerates route files, so it checks the new ones use `withAuth`.
9. **Error codes and copy.** `error.ts` + `copy/api.ts` (`serial_taken`: "Another device already has this serial
   number."; `not_assigned`: "This device is not assigned to anyone any more. Refresh and try again.";
   `member_not_assignable`: "This member can't be assigned. They may have been deactivated.";
   `device_owned`: "This device has an owner, so it is no longer in the org inventory.").
10. **Search and export.** Add the three `like` alternatives (null columns simply do not match). Export columns and
    `map` aligned; `csvCell` already prefixes formula starters (`src/lib/export/csv.ts` line 13-19).
11. **Carry-overs.** Strip the dead delete flow and rename the filter label; update tests and the DTO fixtures.
12. Run all Checks; `pnpm test:db` runs in CI.

Rules: **R1** validators and the date helper are pure `lib`; routes are the only entry into `src/server/**`; run
`pnpm check:layers`. **R2** no schema change. **R6** every query has `org_id = $1` via `orgQuery`; the target member
is resolved by `(org_id, id)`. **R7** 401/403 only from `withAuth`; permission refusals are 422 before any query;
domain refusals 409/422; no 401/403 after the write. **R3** nothing new in env. **R4** slice 2 items stay out.
**R5** tests listed above.

## Specialist input used
- api-platform-engineer §1 assign endpoint `POST /assignment`, lock member `for share` then device, 409 `device_owned`,
  pending-handoff check — **adopted**. Its new code `member_inactive` — **rejected** in favour of the existing
  `member_not_assignable` (422), which seats and requests already use for the same rule and the UI already handles;
  missing member also maps to it (as seats does), so the UI never confuses it with a missing device (404 closes dialogs).
- api §2 `PATCH /holding`, Manager+ only (`canManageHolding`, not `canEdit`), 409 `not_assigned`, no-op without audit — **adopted**.
- api §2 / OQ1 "past" rule only when the expiry changes — **adopted in a simpler form**: the validator checks every
  `expiresOn` it receives; the client (slice 2) sends only changed keys, so an overdue holding's note stays editable (A3).
- api §3 flat `holdingNote`/`holdingExpiresOn` vs frontend A nested `holding` — **nested chosen** (A1).
- api §3 `to_char` for the date, `canAssign`/`canEditHolding` flags — **adopted**.
- api §4 `optText`, shared key constant, 100-char limits, no holding keys in create/PATCH — **adopted**.
- api §5 `serial_taken` — **adopted**. §6 UTC+7 helper with injected clock, 400 `invalid_request` for a past date,
  year bounds — **adopted** (helper in `src/lib/devices/holding.ts`).
- api §7 audit meta — **adopted** (note text included because the ticket asks for it, A7).
- api §8 search match on the new fields — **adopted**; export Serial/Manufacturer/Brand — **adopted**; holding note
  and expiry as CSV columns (OQ2) — **rejected** for now: not in the ticket's acceptance criteria (rule 1), easy to add
  with SIM-037.5 (overdue) if Ming wants it (A6).
- api §9 concurrency analysis and DB tests — **adopted**. OQ3 `impactOf` counts only placed devices (verified:
  `src/server/members/manage.ts` line 298 `seat_id is not null`) — not changed here (A8).
- frontend A types, `DEVICE_LIMITS` — **adopted**. Frontend B-D, G-H (form fields, Assign dialog, holding line,
  Details column, row actions, `devices-api` methods) — **deferred to slice 2**, recorded there.
- frontend E/F copy rename and dead delete flow removal — **adopted** (with `onStale` on `device_owned`/`handoff_pending`).
  Its rename of `inInventory` ("In inventory") — **not adopted** (A5).
- frontend OQ3 a Manager may assign to themselves — **adopted** (no self check; spec does not forbid it).

## Assumptions
For Ming to approve with the plan (each is reversible):
- **A1 DTO shape:** nested `holding: { note: string | null; expiresOn: string | null } | null`, null exactly when the
  device is unowned (mirrors `owner` / `placement`). Alternative: flat `holdingNote` / `holdingExpiresOn`.
- **A2 Past expiry is a 400 `invalid_request`** (input validation at the boundary, clock injected), not a domain
  409/422. "Today" in UTC+7 is allowed; the upper bound is year 2100.
- **A3 Holding edit:** only the keys sent are applied and checked; sending `expiresOn` re-checks "not in the past", so
  an overdue holding can still get a note edit or have its expiry cleared, and extending needs a date ≥ today.
  `null` (or blank) clears note or expiry. An unchanged edit is a no-op with no audit row.
- **A4 Error codes:** reuse `device_owned` (409), `handoff_pending` (409), `member_not_assignable` (422, also for a
  missing member); new `not_assigned` (409) and `serial_taken` (409). The `device_owned` and
  `member_not_assignable` messages are reworded to fit both their old and new uses.
- **A5 Rename scope:** only the filter label (`filters.inventory` → "Not placed") and its empty text change; the
  `?placement=inventory` wire value, the `inInventory` placement text ("In inventory") and the CSV `Location`
  value `inventory` stay.
- **A6 "Appear in search"** = the device is found by serial, manufacturer or brand; the search hit DTO and
  `SearchView` do not change. CSV gets Serial, Manufacturer, Brand only (no holding columns).
- **A7 Audit meta carries the note text** (ticket scope), although `writeAudit`'s doc comment says meta holds codes,
  field names and counts. A note is free text an Admin/Manager types, not a secret; the audit view renders it as text.
- **A8 Pre-existing gap, not fixed here:** deactivating a member does not count unplaced owned devices
  (`manage.ts` line 298), so a deactivated member can keep devices in their inventory. Assign itself refuses inactive
  members. The implementer files a `debt` issue (`project:simap`) so SIM-037.4 (return) can decide.
- **A9 Spec wording:** DEV-01 lines 279-281 still describe the "Move to inventory" delete warning; under D63 an
  unowned device is never placed, so that flow is dead and is removed. The spec text should be updated by Ming or a
  docs ticket; this plan does not edit the spec (planner writes plan.md only).
- **A10 Note** allows line breaks (`\n`), refuses other control characters; length is counted in code points, like
  Postgres `char_length`.
- **A11** No pending-handoff check on holding edit (extensions are SIM-037.5).
- **Hotspots:** SIM-036.3 is `DONE` on the board (its `ticket.md` still says BACKLOG); if its branch adds error codes
  it touches `src/lib/api/error.ts` and `src/ui/copy/api.ts` too — expect a trivial rebase. SIM-037.3 to 037.6 will
  edit `devices.ts`, `types.ts`, `rules.ts`, `validate/device.ts` after this one.

## Blocking questions
None.

## Split proposal
The full ticket is about 650-750 changed production lines plus tests (server ~400, UI ~350), well over one
implement/review cycle. Split:

- **Slice 1 — SIM-037.2 (this plan):** API and data. Assign and holding endpoints, serial/manufacturer/brand in
  validators, create/update, list DTO, search and CSV, `serial_taken`, audit rows, error codes and messages, plus the
  SIM-037.1 carry-overs (filter "Not placed", dead delete flow removed) and the DTO fixture updates. Estimate ~420
  added production lines (~100 removed) and ~400 test lines.
- **Slice 2 — new ticket SIM-037.7 "Devices UI: assign dialog, note/expiry edit and new device fields"** (depends on
  SIM-037.2; Areas ui; P1; Size M; Gate none unless Ming wants plan approval). Scope from the frontend consult B-D,
  G-H: serial/manufacturer/brand in `DeviceFormFields` and `device-form.ts` (blank → null, diff like `mac`); a
  "Details" column (manufacturer · brand over serial) and a mobile line; holding sub-line in the owner cell
  ("Until YYYY-MM-DD" / "No expiry"); `AssignDeviceDialog` with modes assign / edit (reused `MemberPickerFields` +
  `useMemberPicker(seatsApi.activeMembers)`, note textarea with counter, expiry date with a "No expiry" checkbox,
  `min` from `todayUtc7`); pure `assign-device.ts` (`toAssignBody`, `toHoldingBody` sending only changed keys,
  `settle` mapping `device_owned`/`not_assigned`/`member_not_assignable`); `devices-api.assign` / `updateHolding`;
  row actions "Assign" (`canAssign`) and "Note / expiry" (`canEditHolding`); copy; tests. Acceptance: ticket AC 2
  and AC 4 UI parts, plus Ming's manual check "assign with and without expiry". SIM-037.3 keeps depending on
  SIM-037.2; its UI part may want SIM-037.7 first.
