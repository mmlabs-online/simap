Status: READY

# Plan — SIM-037.6: Device detail page with history (slice 1 of 2)

This plan covers **slice 1 only**: the history API, a read-only device detail page and the links to it. The
viewer actions (transfer, return, assign and the other dialogs) on the detail page go to slice 2. See `## Split proposal`.

## Scope summary
- `docs/spec-v1.md` §6 **DEV-11 Device detail and history** (lines 342-347):
  > Every member can open a device detail page: all fields, where it is, the current holder (since, note, expiry,
  > overdue), any pending handoff, and its history.
  > The history lists, newest first, every create, assign, transfer (started, cancelled, declined, confirmed),
  > return (started, cancelled, confirmed, Admin return), extension and expiry change: who did it, from and to member,
  > when, note, expiry date, and who confirmed. History is kept when members are deactivated or removed.
- §6 **DEV-02** (lines 286-289): "Every device list and device detail shows where the device is ("at seat X", "in
  <member>'s inventory" or "in org inventory") and any pending transfer or return."
- §DeviceHandoff (line 129): "Device history (DEV-11) is read from these rows and the audit log."
- §DEV-09 (lines 332-333): Admin take-back: "the history records it as an Admin return."
- `work/decisions.md` **D63**: "The device detail page shows the transfer history."
- Ticket scope: "API: device detail by id (...) and its history, newest first, keyset-paged"; "History from handoff
  rows and device audit rows: create, assign, holding edit, transfer/return/extension events, Admin take-back; actor,
  from, to, time, note, expiry, confirmed by"; "UI: `/devices/<id>` page in the clean UI kit; links from the Devices
  list, search and seat panel". Technical note: "history read from audit_log plus device_handoffs, no new table."

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Any member of the org opens a device's page; another org's device id returns not found. | `devices-routes.test.ts › GET /api/devices/:id/history › bad uuid is 404 not_found, no service call`; `history.db.test.ts › a user (lowest tier) reads the history; another org's device id and an unknown id are 404 not_found`; existing `GET /api/devices/:id` already returns 404 for another org (getDevice, devices.ts:200-210); `DeviceDetailView.test.tsx › notFound state shows the not-found copy and a link back to /devices, no retry button`. |
| 2 | The page shows all fields, current location and holder, and any pending handoff. | `DeviceDetailView.test.tsx › ready: name heading, type, inventory number, MAC, serial, manufacturer, brand`, `› placed device links to the room with role chip; unplaced shows in-inventory copy`, `› holder with since date, note, expiry and overdue chip; org inventory when unowned`, `› pending transfer shows chip, recipient and requested-by`. |
| 3 | History lists every lifecycle event newest first with actor, from/to, note, expiry and who confirmed, and survives member deactivation. | `src/lib/devices/history.test.ts` (one case per kind, plus tolerant meta); `history.db.test.ts › create → assign → holding edit → transfer start → confirm → return start → confirm → assign → take-back: kinds newest first, actor, from/to, note, expiry, confirmedBy`, `› a deactivated actor and a deactivated from-member keep their display name`, `› keyset paging: limit 2 walks all rows with no duplicate or gap`; `DeviceHistory.test.tsx › renders kind label, time (UTC+7), actor, from → to, note, expiry, confirmed by`. |
| 4 | Device names in the list, search and seat panel link to the detail page. | `DevicesView.test.tsx › device name links to /devices/<id> (table and mobile card)`; `SearchView.test.tsx › device row links to /devices/<id>` (updated from `/devices`); `SeatDetailPanel.test.tsx › device name links to /devices/<id>`; `nav.test.ts › deviceDetailHref`. |

## Ming verification after merge
- Walk one device on the deployed app (ticket test plan "Manual: walk a device through assign, transfer, return"):
  Admin assigns it, the holder transfers it, the recipient confirms, the recipient returns it, an Admin confirms.
  Open `/devices/<id>` as a plain user after each step: the history grows newest first with the right names, and the
  pending section shows the open handoff until it is confirmed.
- Deactivate a member who appears in that history: their name still shows.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/devices/types.ts` | Add `DeviceHistoryKind`, `DeviceHistoryEntryDto`, `DeviceHistoryPage`, `DEVICE_HISTORY_LIMITS = { defaultLimit: 50, maxLimit: 100 }`, `DEVICE_HISTORY_ACTIONS` (the allowlist, see API contract). | Shared DTO for route, server and UI. | No |
| `src/lib/devices/history.ts` (new) | Pure `toHistoryEntry(row, names)`: raw audit row + joined handoff fields + member-name map → `DeviceHistoryEntryDto` or `null` for an action not in the allowlist. Meta read as `unknown`, every field null-coalesced. | "Unit: history mapping" (ticket test plan); rule 6 pure logic first. | No |
| `src/lib/devices/history.test.ts` (new) | Unit tests of the mapper. | R5. | No |
| `src/lib/validate/device-history-query.ts` (new) | `parseDeviceHistoryQuery(URLSearchParams)` → `{ limit, cursor? }` or `{ ok:false, field }`; reuses `decodeCursor` from `@/lib/audit/cursor`; same `LIMIT_RE`/dup rules as `audit-query.ts:9,53-69`. | Input validation at the boundary. | No |
| `src/lib/validate/device-history-query.test.ts` (new) | Validator tests. | R5, pagination bounds. | No |
| `src/server/devices/history.ts` (new, starts with `import "server-only"`) | `listDeviceHistory(db, scope, deviceId, q)`: org existence check, history query, batched member-name lookup, `holderSince`, keyset `nextCursor`. | The new read. | No (not `src/server/**/auth*` or `src/server/http/**`) |
| `src/server/devices/history.db.test.ts` (new) | DB integration test (`pnpm test:db`). | R5, R6 (cross-org), AC3. | No |
| `src/app/api/devices/[id]/history/route.ts` (new) | `GET` with `withAuth({ tier: "user" })`, `dynamic = "force-dynamic"`, `no-store`; copy the shape of `src/app/api/devices/[id]/route.ts:14-25`. | New endpoint. | No |
| `src/app/api/devices/devices-routes.test.ts` | Add `vi.mock("@/server/devices/history", ...)` next to lines 19-21 and a `describe("GET /api/devices/:id/history")`. | Route tests (R5, R7). | No |
| `src/ui/devices/devices-api.ts` | Add `history(id, cursor?)` → `DevicesResult<DeviceHistoryPage>`; validate `Array.isArray(items)`, `nextCursor` string-or-null, `holderSince` string-or-null, like `list` (lines 206-216). `get` (line 77) is reused unchanged: `call` already forwards `not_found`. | UI client for the new route. | No |
| `src/ui/devices/devices-api.test.ts` | Add `history` cases (path + encoded cursor, shape check, error code forwarding). | R5. | No |
| `src/ui/devices/device-labels.tsx` (new) | Move `PlacementLabel`, `OwnerLabel`, `Details`, `Mac` from `DeviceTable.tsx:15-81` here unchanged and export them; add `DeviceNameLink` (name → `deviceDetailHref(id)`, class `font-semibold text-primary underline`, as `PlacementLabel`'s link). | One copy of the chip/overdue logic for list and detail (frontend consult §3). | No |
| `src/ui/devices/DeviceTable.tsx` | Import the labels from `device-labels.tsx`; wrap the name in the table cell (line 127) and the mobile card (line 157) with `DeviceNameLink`. No other output change. | AC4; reuse. | No |
| `src/ui/devices/DevicesView.test.tsx` | Add the name-link assertion. | AC4. | No |
| `src/lib/nav.ts` | Add `deviceDetailHref(id: string): string` → `/devices/${encodeURIComponent(id)}`. | One href helper (as `roomDetailHref`, line 73). | No |
| `src/lib/nav.test.ts` | Add `describe("deviceDetailHref")`; also assert `isActive` for the Devices nav item on `/devices/<id>`. | R5. | No |
| `src/ui/search/SearchView.tsx` | `DeviceRow` (lines 46-62): link to `deviceDetailHref(hit.id)` instead of `DEVICES_HREF`; drop `DEVICES_HREF` from the import (line 10). Leave the constant in `search-state.ts` (not touched). | AC4. | No |
| `src/ui/search/SearchView.test.tsx` | Update the test at lines 104-106 to expect `href="/devices/<id>"`. | AC4. | No |
| `src/ui/seats/SeatDetailPanel.tsx` | `Device` (lines 23-37): wrap `device.name` in `next/link` to `deviceDetailHref(device.id)`, keep `font-bold`, add `text-primary underline`. | AC4. | No |
| `src/ui/seats/SeatDetailPanel.test.tsx` | Add the link assertion. | AC4. | No |
| `src/ui/devices/device-detail-state.ts` (new) | Pure reducers: `detailReducer` (`loading | error | notFound | ready`, counter-guarded `load`/`loaded`) and `historyReducer` (`loading | error | ready`, `items`, `nextCursor`, `holderSince`, `loadingMore`, `moreError`; `loadMore` appends, a stale id is dropped). Same stale-answer pattern as `devices-state.ts`/`useDevices.ts`. | Testable state without a DOM. | No |
| `src/ui/devices/device-detail-state.test.ts` (new) | Reducer tests. | R5. | No |
| `src/ui/devices/device-history.ts` (new) | Pure copy helpers: `historyKindLabel(kind)`, `historyMemberLabel(ref)` (null → `devicesCopy.history.unknownMember`), `historyFromTo(entry)` (null `from` on assign / null `to` on return = org inventory), `historyExpiryText(entry)`, `historyCause(entry)`. | Formatting kept out of the view. | No |
| `src/ui/devices/device-history.test.ts` (new) | Helper tests. | R5. | No |
| `src/ui/devices/useDeviceDetail.ts` (new) | Client hook: loads `api.get(id)` and `api.history(id)` in parallel; `retryDetail`, `retryHistory`, `loadMore`; `mounted` ref and counters as `useDevices.ts:9-41`. | Container data. | No |
| `src/ui/devices/DeviceDetailView.tsx` (new) | Pure view: back link, `h1` (`tabIndex={-1}`, `headingRef`), fields `<dl>`, "Where it is", "Holder", "Pending handoff", history slot; loading skeleton, error card with Retry, notFound card. Patterns of `DevicesView.tsx`. | AC1, AC2. | No |
| `src/ui/devices/DeviceDetailView.test.tsx` (new) | `renderToStaticMarkup` tests (harness of `DevicesView.test.tsx`). | AC1, AC2. | No |
| `src/ui/devices/DeviceHistory.tsx` (new) | Pure history list in a `Card`: `<ol>`, one `<li>` per entry; skeleton (`aria-busy`), error with Retry (history only), empty state, "Load more" `Button` with busy state, inline error for a failed "Load more". | AC3. | No |
| `src/ui/devices/DeviceHistory.test.tsx` (new) | `renderToStaticMarkup` tests. | AC3. | No |
| `src/ui/devices/DeviceDetailPage.tsx` (new, `"use client"`) | Container: `useApiFetch` + `createDevicesApi`, `useDeviceDetail`, focuses the `h1` once on the first `ready` or `notFound`. | Page/view split as `DevicesPage`. | No |
| `src/app/(app)/devices/[id]/page.tsx` (new) | `await params`, render `<DeviceDetailPage key={id} deviceId={id} />` (as `rooms/[roomCode]/page.tsx:1-10`). | Route `/devices/<id>`. | No |
| `src/ui/index.ts` | `export { DeviceDetailPage } from "./devices/DeviceDetailPage";` next to line 31. | R1: pages import only from `@/ui`. | No |
| `src/ui/copy/devices.ts` | Add `devicesCopy.detail` (back link, section headings, field labels, `holderSince(date)`, `requestedBy(name)`, not-found title/body) and `devicesCopy.history` (title, empty, loadMore, loadMoreFailed, `unknownMember`, `orgInventory` reuse, `confirmedBy(name)`, `kinds: Record<DeviceHistoryKind, string>`, cause labels). | D36: UI copy in `src/ui/copy/<feature>.ts`. | No |
| `src/ui/copy/shell.ts` | Add `pages.deviceDetail: { title: "Device details", empty: "No data yet." }` after line 82. | Same as `roomDetail` (line 79). | No |

**No High path is touched. No migration.** The security reviewer runs (changed paths include `src/server/`).

## Data model / migration
None. History is read from `audit_log` and `device_handoffs` (Architect default; spec line 129). Existing indexes are
enough for one device:
- `audit_log_org_entity_idx on audit_log (org_id, entity, entity_id, created_at desc)` (`db/migrations/20261120150000_init.sql:220`) serves `org_id = $1 and entity = 'device' and entity_id = $2` with the keyset and the `id desc` tiebreak.
- `device_handoffs` is joined by primary key (`id`) plus `org_id`.
- `members` is joined on `(org_id, sub)` (actor) and looked up by `(org_id, id)` (from/to); both are unique keys.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/devices/{id}/history` | Query: `limit` (optional, `1..100`, default 50, `^[1-9]\d{0,2}$`), `cursor` (optional, opaque, from a previous `nextCursor`). A repeated param is invalid. | 200 `DeviceHistoryPage` (below), `Cache-Control: no-store` | 200; 400 `invalid_request` (bad limit/cursor); 401/403 only from `withAuth` (R7); 404 `not_found` (non-UUID id, unknown id, another org's id); 503 `unavailable` (no pool) | `withAuth({ tier: "user" })`: any active member of the org (DEV-11 "Every member"). |
| GET | `/api/devices/{id}` | unchanged | unchanged `DeviceDto` | unchanged | unchanged (reused for the detail half). |

```ts
// src/lib/devices/types.ts
export type DeviceHistoryKind =
  | "create" | "assign" | "holding_update"
  | "transfer_start" | "transfer_cancel" | "transfer_decline" | "transfer_confirm"
  | "return_start" | "return_cancel" | "return_confirm" | "return_take_back"
  | "extension_start" | "extension_cancel" | "extension_decline" | "extension_confirm";

/** The audit actions read as history: `device.<kind>`. Exact match (note `device.return` is a placement move, not a return). */
export const DEVICE_HISTORY_ACTIONS: readonly string[]; // = every DeviceHistoryKind prefixed with "device."

export type DeviceHistoryEntryDto = {
  id: string;                     // audit_log.id
  kind: DeviceHistoryKind;
  at: string;                     // UTC instant, microseconds: YYYY-MM-DDTHH:MM:SS.ffffffZ
  actor: MemberRef | null;        // who did it; null = no member row for actor_sub
  from: MemberRef | null;         // null = org inventory, or no member row
  to: MemberRef | null;           // null = org inventory, or no member row
  note: string | null;
  expiresOn: string | null;       // YYYY-MM-DD
  fromExpiresOn: string | null;   // YYYY-MM-DD, the date before an expiry change
  confirmedBy: MemberRef | null;  // *_confirm and return_take_back: the actor
  cause: "manager" | "take_back" | "deactivation" | null; // why a cancel/decline happened, from meta flags
};

export type DeviceHistoryPage = {
  items: DeviceHistoryEntryDto[];
  nextCursor: string | null;
  holderSince: string | null;     // UTC instant of the latest device.assign / device.transfer_confirm; null when unowned
};
```

Mapping per kind (from the audit writes: `devices.ts:359-362, 483-491, 545-548`; `handoffs.ts:185-194, 241-249,
296-305, 360-369, 446-452, 501-509, 536-539, 590-599, 681-690, 696-704`; `members/manage.ts:432-441`). `h.*` = the
`device_handoffs` row joined on `meta.handoffId`:
| kind | from | to | note | expiresOn | fromExpiresOn | confirmedBy | cause |
|---|---|---|---|---|---|---|---|
| create | null | null | null | null | null | null | null |
| assign | null (org inventory) | `meta.memberId` | `meta.note` | `meta.expiresOn` | null | null | null |
| holding_update | null | `meta.ownerId` | `meta.to.note` | `meta.to.expiresOn` | `meta.from.expiresOn` | null | null |
| transfer_start / _cancel / _decline | `meta.fromMemberId` | `meta.toMemberId` | `meta.note ?? h.note` | null | null | null | `byTakeBack` → take_back, `byDeactivation` → deactivation, `byManager` → manager |
| transfer_confirm | `meta.fromMemberId` | `meta.toMemberId` | `h.note` | `meta.expiresOn` (carried over, OQ-43) | null | actor | null |
| return_start / _cancel | `meta.fromMemberId` | null (org inventory) | `meta.note ?? h.note` | null | null | null | as above |
| return_confirm | `meta.fromMemberId` | null | `h.note` | null | null | actor | null |
| return_take_back | `meta.fromMemberId` | null | null | null | null | actor | null |
| extension_start / _cancel / _decline | `meta.fromMemberId` | null | `meta.note ?? h.note` | `meta.newExpiresOn ?? h.new_expires_on` | null | null | as above |
| extension_confirm | `meta.fromMemberId` | null | `h.note` | `meta.toExpiresOn ?? h.new_expires_on` | `meta.fromExpiresOn` | actor | null |

A meta value that is not a string (or not a canonical UUID for a member id, or not `YYYY-MM-DD` for a date) maps to
null. Member ids map to `MemberRef` through the name map; an id with no member row maps to null.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/devices/history.test.ts › maps each kind to from/to/note/expiry/confirmedBy per the mapping table` (one `it` per row) | AC3 mapping |
| `… › returns null for an action outside the allowlist (device.update, device.place, device.return, device.delete)` | allowlist, `device.return` vs return events |
| `… › tolerates null meta, missing keys, wrong types and a non-uuid member id (all null, no throw)` | meta drift (both consults) |
| `… › cause: byTakeBack, byDeactivation, byManager; byManager false → null` | cancel causes |
| `… › a member id missing from the name map gives null; Vietnamese display name kept as is (Nguyễn Văn Ánh)` | domain focus, removed member |
| `src/lib/validate/device-history-query.test.ts › default limit 50; limit 1 and 100 ok; 0, 101, 1.5, -1, abc, repeated → field limit` | pagination bounds |
| `… › a cursor from encodeCursor is accepted; garbage, wrong keys, millisecond time, repeated → field cursor; blank = absent` | cursor validation |
| `src/app/api/devices/devices-routes.test.ts › GET /api/devices/:id/history › bad uuid is 404 not_found, no service call` | AC1, R7 |
| `… › bad limit / bad cursor is 400 invalid_request, no service call` | boundary |
| `… › passes scope, id and parsed query; returns the page with no-store` | wiring |
| `… › service not_found is 404` | AC1 |
| `src/server/devices/history.db.test.ts › create → assign → holding edit → transfer start → confirm → return start → confirm → assign → take-back: kinds newest first with actor, from/to, note, expiry, confirmedBy` | AC3 (drives the real services in `devices.ts` / `handoffs.ts`, as `handoffs.db.test.ts`) |
| `… › transfer decline, transfer cancel by a manager, extension start → confirm (fromExpiresOn/expiresOn), extension decline` | AC3 remaining kinds, cause |
| `… › a deactivated actor and a deactivated from-member keep their display name` | AC3 "survives deactivation" (MEM deactivate path also writes a `byDeactivation` cancel) |
| `… › a user (lowest tier) reads the history; another org's device id and an unknown id are 404 not_found` | AC1, R6 |
| `… › rows of another device and of other entities are not returned; device.update and placement rows are excluded` | scoping, allowlist |
| `… › keyset paging: limit 2 walks all rows with no duplicate or gap, last page nextCursor null` | pagination (two rows with equal `created_at` inserted in one transaction must both appear: the id tiebreak) |
| `… › holderSince = latest assign/transfer_confirm time; null after take-back` | DEV-11 "since" |
| `src/ui/devices/devices-api.test.ts › history: GET /api/devices/<id>/history, cursor url-encoded; bad shape → internal; 404 → not_found` | UI client |
| `src/ui/devices/device-detail-state.test.ts › detail: load → ready; not_found → notFound; other code → error; stale id dropped` | page states |
| `… › history: first page, loadMore appends, failed loadMore keeps items and sets moreError, stale id dropped, retry resets` | page states |
| `src/ui/devices/device-history.test.ts › kind labels exist for every DeviceHistoryKind; fromTo uses org inventory for null; unknown member label; expiry text` | copy helpers |
| `src/ui/devices/DeviceDetailView.test.tsx › loading skeleton is aria-busy; error has role=alert and Retry; notFound has back link and no Retry` | AC1, ticket "page states (loading …)" |
| `… › ready: name heading, type, inventory number, MAC, serial, manufacturer, brand ("—" style none copy for nulls)` | AC2, empty fields |
| `… › placed device links to the room with role chip; unplaced shows in-inventory copy` | AC2, DEV-02 |
| `… › holder with since date, note, expiry and overdue chip; org inventory when unowned` | AC2 |
| `… › pending transfer shows chip, recipient and requested-by; no pending section without a handoff` | AC2, ticket "pending" state |
| `src/ui/devices/DeviceHistory.test.tsx › empty history shows the empty copy` | ticket "empty history" state |
| `… › renders an ordered list in the given order with kind label, time in UTC+7 (2026-03-05T17:30:00.000000Z → 06 Mar 2026, 00:30), actor, from → to, note, expiry, confirmed by` | AC3, UTC vs UTC+7 |
| `… › unknown member label for null actor; Load more only with nextCursor; busy and failed load-more states; history error does not hide anything else (own Retry)` | AC3, paging UI |
| `src/ui/devices/DevicesView.test.tsx › device name links to /devices/<id> (table and mobile card)` | AC4 |
| `src/ui/search/SearchView.test.tsx › device row links to /devices/<id>` (updated) | AC4 |
| `src/ui/seats/SeatDetailPanel.test.tsx › device name links to /devices/<id>` | AC4 |
| `src/lib/nav.test.ts › deviceDetailHref encodes the id; isActive marks Devices on /devices/<id>` | AC4 |

## Approach
1. **Types and pure mapper.** Add the types to `src/lib/devices/types.ts`. Write `src/lib/devices/history.ts`:
   input row `{ id, action, at, actorSub, actorId, actorName, meta, hNote, hNewExpiresOn }` and a
   `Map<memberId, MemberRef>`; output per the mapping table. Strip the `device.` prefix and check it against
   `DEVICE_HISTORY_ACTIONS`; anything else returns null. Tests first.
2. **Validator.** `src/lib/validate/device-history-query.ts`, modelled on `audit-query.ts:20-71` (limit and cursor
   parts only), reusing `decodeCursor`/`encodeCursor` from `@/lib/audit/cursor`.
3. **Server read** `src/server/devices/history.ts` (`import "server-only"`, every query through `orgQuery` with
   `org_id = $1` on every table and join, R6):
   - a. `select d.owner_id, to_char((select max(a.created_at) from audit_log a where a.org_id = d.org_id and a.entity = 'device' and a.entity_id = d.id and a.action in ('device.assign','device.transfer_confirm')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as holder_since from devices d where d.org_id = $1 and d.id = $2`.
     No row → `notFound` (from `./tx`): unknown id and another org's id look the same. `holderSince` = null when `owner_id` is null.
   - b. History query (keyset as `audit.ts:47-68`):
     `select a.id, a.action, a.actor_sub, am.id as actor_id, am.display_name as actor_name, a.meta, to_char(a.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at, h.note as h_note, to_char(h.new_expires_on, 'YYYY-MM-DD') as h_new_expires_on from audit_log a left join members am on am.org_id = a.org_id and am.sub = a.actor_sub left join device_handoffs h on h.org_id = a.org_id and h.device_id = a.entity_id and h.id = case when a.meta->>'handoffId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (a.meta->>'handoffId')::uuid end where a.org_id = $1 and a.entity = 'device' and a.entity_id = $2 and a.action = any($3::text[]) [and (a.created_at, a.id) < ($4::timestamptz, $5::uuid)] order by a.created_at desc, a.id desc limit $n::int` with `limit + 1`.
     The regex guard keeps a malformed `handoffId` from failing the cast. The cursor timestamp is carried as text with microseconds (api consult §4).
   - c. Collect `fromMemberId`, `toMemberId`, `memberId`, `ownerId` from the page's meta (canonical UUIDs only, deduplicated). Run one batched `select id, display_name from members where org_id = $1 and id = any($2::uuid[])` (no N+1). Members are never hard-deleted (no `delete from members` in `src/server`), and deactivated rows keep `display_name`, so names survive deactivation.
   - d. Map with `toHistoryEntry`, drop nulls, build `nextCursor` from the last row of the page.
   - Read-only, so no transaction is needed.
4. **Route** `src/app/api/devices/[id]/history/route.ts`, in this order: `isCanonicalUuid` → 404; `parseDeviceHistoryQuery(new URL(req.url).searchParams)` → 400 `invalid_request`; `getPool` → 503; call → `apiError(r.status, r.code)` or `Response.json(page, { headers: NO_STORE })`.
   - R7: 401/403 come only from `withAuth`, and the route has no side effect.
   - R1: only the api layer imports `@/server/devices/history`.
   - Add route tests.
5. **DB test** `history.db.test.ts`: reuse the setup helpers of `handoffs.db.test.ts` (org, members, Admin/Manager/user tiers) and drive the real service functions, so the test checks the real audit meta rather than hand-made rows. Add one direct insert of two audit rows with the same `created_at` to cover the paging tiebreak.
6. **UI client**: add `history` to `devices-api.ts` and its tests.
7. **Links (AC4)**: add `deviceDetailHref` to `nav.ts`.
   - Move the four labels to `device-labels.tsx` with their code unchanged, and add `DeviceNameLink`. Update `DeviceTable.tsx`.
   - Change `SearchView.DeviceRow` and `SeatDetailPanel.Device`, and update the three test files.
   - Run `DevicesView.test.tsx` before and after the move. Its output must not change except for the new anchor.
8. **Page.**
   - Write `device-detail-state.ts` and `device-history.ts` first, with their tests.
   - Then write `useDeviceDetail.ts`, `DeviceHistory.tsx`, `DeviceDetailView.tsx` and `DeviceDetailPage.tsx`, then the route file and the `@/ui` export.
   - View content:
     - Back link to `/devices`, then the `h1` with the device name.
     - Fields `<dl>`: type, inventory number, MAC (`Mac`), serial, manufacturer, brand. Each null shows the `devicesCopy.details.none`/`noMac` style copy.
     - "Where it is": `PlacementLabel`.
     - "Holder": `OwnerLabel` with the `line-clamp` override removed (`clamp=""`), so the full note shows. Add `devicesCopy.detail.holderSince(formatAuditTime(holderSince))` when `holderSince` is set.
     - "Pending handoff", only when `pendingHandoff` is set: the `pendingText(d)` chip and "to" line, plus `requestedBy` and `createdAt`.
     - History card.
   - The history card keeps its own status. A history failure shows a Retry inside the card and does not hide the detail. A detail `notFound` hides the history.
   - Reuse `formatAuditTime` from `src/ui/audit/audit-state.ts:41` (ui → ui) for every instant. It shows Asia/Ho_Chi_Minh (D35). Expiry dates are calendar dates and use the existing `expiryText`/plain `YYYY-MM-DD`.
   - The container focuses the `h1` once, when the page first reaches `ready` or `notFound`.
   - Long notes use `whitespace-pre-line` + `CLIP`. Every list uses `<ol>`/`<li>`, the clean UI kit components (`Card`, `Chip`, `Button`) and the layout tokens of `DevicesView`.
9. Run the checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. `pnpm test:db` runs locally with a Postgres if one is available, and in CI.

Rules: R1 (layers as listed; `src/app/(app)/devices/[id]/page.tsx` imports only `@/ui`), R6 (org_id on every table and
join), R7 (read-only, auth codes only from `withAuth`), R3 (no new env), R2 (no schema change), R4 (slice 1 file list only),
R5 (tests above), D36 (copy in `src/ui/copy/devices.ts`).

## Specialist input used
- **frontend-developer**
  - Adopted:
    - Reuse `GET /api/devices/[id]` and `api.get`.
    - Page/view split as `rooms/[roomCode]`.
    - Separate `notFound` state.
    - Extract the labels to a shared file instead of copying them.
    - Separate history status with its own Retry.
    - "Load more" button with limit 50.
    - `deviceDetailHref` in `nav.ts`.
    - The three link sites and their test updates.
    - Pure mapper in `src/lib/devices/history.ts`.
    - Unknown action does not throw.
  - Adopted with a change: two hooks merged into one `useDeviceDetail` plus pure reducers in `device-detail-state.ts`. This means fewer files, and the logic is still unit-tested.
  - Deferred to slice 2: dialog reuse, `DeviceRowActions`, focus after actions, extraction of the dialog wiring from `DevicesPage`.
  - Resolved:
    - Its OQ1 (audit alone vs join): confirm/cancel/decline rows lack the note (api consult). So left-join `device_handoffs` on `meta.handoffId` for note/new expiry only. "Confirmed by" is the confirm row's actor, not `decided_by_id`, which falls back to the target member on deactivation (`manage.ts:414-427`).
    - Its OQ7 (index): `audit_log_org_entity_idx` exists, so no migration.
    - Its risk "entity other than device": checked. Every device lifecycle row uses `entity: "device"` (`handoffs.ts:362` included, `manage.ts:433`), so filter on `entity = 'device' and entity_id = $2` plus an exact action allowlist.
- **api-platform-engineer**
  - Adopted:
    - Separate resource `GET /api/devices/[id]/history`, not embedded in `DeviceDto`.
    - Org existence check first → 404.
    - Left join `device_handoffs`.
    - Batched member lookup.
    - Keyset on `(created_at, id)` with a microsecond text cursor.
    - Default 50 / max 100.
    - 400 `invalid_request`.
    - Exclude `device.delete`.
    - Tolerant mapper.
    - Notes visible to all members in history.
    - No migration.
  - Adopted with a change:
    - The DTO is trimmed: no `handoffId`/`place`/`fields`/`byAdmin`. `byAdmin` becomes `cause`, and placement/field edits are excluded (see Assumptions).
    - `type` is named `kind`, matching `HandoffKind` naming.
  - Rejected: none.

## Assumptions
Planner assumptions for Ming to confirm. They are adopted from the consult recommendations, consistent with the spec, and non-blocking.

1. **History event set = the spec list.** DEV-11 lists create, assign, transfer/return/extension events and expiry change. The ticket adds holding edit and Admin take-back. Field edits (`device.update`) and seat moves (`device.place`/`device.move`/`device.return`) are **not** shown in the device history. They stay visible on the Audit log page. Adding them later is an allowlist change plus mapper rows. (The api consult recommended including `device.update`. Left out per planner rule 1, "do not add requirements".)
2. **Notes are visible to every member in history**, including the notes of start rows, as DEV-11 requires. `PendingHandoffDto` keeps omitting the note. The pending section therefore shows no note, and the history's `*_start` entry shows it. This is intended, not a leak.
3. **"Confirmed by"** is the actor of the `*_confirm` / `return_take_back` audit row. "Who did it" is the actor of each row, so the requester is the actor of the `*_start` entry. No separate "requested by" column is added to history entries.
4. **A member with no member row** (for example a portal Admin acting without a simap member row, `manage.ts:414`) shows as "Unknown member". The current display name is shown, not the name at the time of the event.
5. **"Holder since"** (DEV-11) is the time of the latest `device.assign` or `device.transfer_confirm` audit row. It is returned on `DeviceHistoryPage.holderSince`, so `DeviceDto` is unchanged. The ticket did not name it, but the spec wins.
6. **A deleted device returns 404.** There is no tombstone page, and `device.delete` is never shown.
7. **The search device hit links to the detail page only.** The old `/devices` list link is replaced for every viewer.
8. **Page size 50 with a "Load more" button.** No infinite scroll.
9. **Hotspots:** no other ticket is `IN_PROGRESS`/`REVIEW`/`DONE`. SIM-037.12 (BACKLOG) will touch `DevicesPage.tsx`/`DevicesView.tsx`. This slice does not touch `DevicesPage.tsx`, and touches `DeviceTable.tsx` only for the label move and the name link. Slice 2 may touch `DevicesPage.tsx` if the dialog wiring is extracted, so expect a rebase there.
10. Tests marked `.db.test.ts` follow the existing `pnpm test:db` convention and run in CI. They are not part of `pnpm test`.

## Blocking questions
None.

## Split proposal
The full ticket (history API + detail page + links + viewer actions with dialog reuse) is clearly above one
implement/review cycle. Slice 1 alone is about 550 lines of product code and about 500 lines of tests.
- **Slice 1 (this plan, SIM-037.6):** history API, read-only detail page, links from the list, search and seat panel. It meets all four acceptance criteria.
- **Slice 2 (proposed new ticket SIM-037.13, "Device detail page: viewer actions", Size S-M, ui/ux, depends on SIM-037.6):**
  - Render `DeviceRowActions` on the detail page with `onTransfer`, `onReturn`, `onAssign` (ticket scope), plus `onExtend`, `onCancelHandoff`, `onTakeBack`, `onEditHolding`, `onPlace`, which come free with `rowActions`.
  - Mount the existing dialogs (`TransferDeviceDialog`, `ReturnDeviceDialog`, `AssignDeviceDialog`, `ExtendDeviceDialog`, `TakeBackDeviceDialog`, `PlaceDeviceDialog`).
  - On `onDone`, refresh the device and the first history page, show the existing `devicesCopy.*.sent` notices in an `aria-live` region, then focus the `h1`.
  - Decide there whether to extract a shared `useDeviceDialogs` from `DevicesPage` (frontend consult §4). Edit/Delete stay on the list page.
