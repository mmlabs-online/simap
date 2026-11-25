Status: READY

# Plan — SIM-037.5: Overdue badge, reminder and extension request

**This plan covers slice 1 of 2 (API + pure logic, no UI).** See `## Split proposal`. No High path is touched.

## Scope summary
From `docs/spec-v1.md`:
- DEV-10: "A device whose expiry date has passed (UTC+7 calendar day, D35) shows **Overdue** wherever it is listed. Overdue is computed when read, never stored."
- DEV-10: "Its owner sees an in-app reminder (nav badge and a banner on the Devices page) to ask for an extension or return it; no email in v1. The owner can request an extension (new date, optional note); an Admin or Manager approves (sets the new expiry) or rejects it (OQ-42)."
- DEV-02: "The Devices page filters by all / placed / not placed / org inventory / overdue."
- DEV-08: "A device has at most one pending handoff (transfer, return or extension)."
- OQ-42: "the owner requests a new date, an Admin or Manager approves or rejects; an Admin or Manager can also edit the expiry directly."
- Ticket scope: "Overdue computed on read ... in device DTOs; Devices page filter 'overdue'", "Extension request: owner proposes a new date and note (handoff kind extension); Admin/Manager approves (sets expiry) or rejects; owner can cancel", "Pending extensions listed for Admin/Manager with a nav badge".

Slice 1 delivers: `overdue` in device DTOs, the `overdue` list filter, the extension start/approve/reject/cancel API, the pending-extensions list, and the badge counts (`overdue` for the owner, `extensions` for Manager+). Slice 2 (UI) renders them.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A device whose expiry date is before today (UTC+7) shows Overdue; no expiry never shows Overdue. | `handoffs.db.test.ts › device DTO overdue` (expiry yesterday = true, today = false, null = false, unowned = false, with a pinned `today`); `holding.test.ts › todayUtc7 day boundary` (2026-11-25T16:59:59Z -> 2026-11-25, 17:00:00Z -> 2026-11-26); `devices-routes.test.ts › passes todayUtc7 to the service`; filter: `device.test.ts › parseDeviceQuery accepts overdue`, `devices.db.test.ts › placement=overdue lists only owned past-expiry devices`. |
| 2 | (API half) The owner's overdue count reaches the nav badge: `GET /api/handoffs/count` returns `overdue` = the caller's own owned devices past expiry. (The banner with Extend and Return is slice 2.) | `handoffs.db.test.ts › count: overdue counts only my devices, extensions only for Manager+`; `handoffs-routes.test.ts › count passes today and returns overdue/extensions`. |
| 3 | An extension request with a date not after today is refused; approve sets the new expiry; reject leaves it. | `device.test.ts › validateHandoffStart extension: date <= today -> invalid (newExpiresOn)`; `handoffs-routes.test.ts › POST extension invalid date -> 400`; `handoffs.db.test.ts › approve sets holding_expires_on and audits; reject leaves it`. |
| 4 | Only Admin/Manager can approve or reject; the request counts as the device's one pending handoff. | `handoff-rules.test.ts › extension: confirm/decline Manager+ only, cancel owner or Manager+`; `handoffs.db.test.ts › user approve/reject -> 422 not_allowed (no write); second pending handoff on the device -> 409 handoff_pending; extension while a transfer pending -> 409`. |

## Ming verification after merge
None for slice 1 (API only). The manual check "expiry yesterday in the dev seed" belongs to slice 2.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/devices/types.ts` (l.39, 49-84, 89-94, 123-133) | `PlacementFilter` += `"overdue"`; `DeviceDto.overdue: boolean`; `PendingHandoffDto.newExpiresOn: string \| null`; `HandoffStartValue` += `{ kind: "extension"; newExpiresOn: string; note: string \| null }`; `HandoffBox` += `"extensions"`; `HandoffCountDto` = `{ incoming, returns, extensions, overdue }` | DTO shapes for the API and slice 2 | No |
| `src/lib/devices/handoff-rules.ts` (l.75-118) | Add `decideExtensionStart` (owner only; `not_allowed` > `device_unowned` > `handoff_pending`, R7 order). `decideHandoffAction`: extension `confirm`/`decline` allowed for Manager+ only, `cancel` as other kinds (owner = from, or Manager+); remove the "refused until SIM-037.5" branch and fix the doc comment | State machine for the new kind | No |
| `src/lib/validate/device.ts` (l.23-33, 201-223) | `FILTERS` += `overdue`; `validateHandoffStart(body, today)` accepts `kind: "extension"` with keys `kind, newExpiresOn, note`; `newExpiresOn` required, must pass `parseCalendarDay` and be `> today` (else `{ok:false, field:"newExpiresOn"}`); `validateHandoffBox` accepts `extensions` | Boundary validation | No |
| `src/server/devices/devices.ts` (l.49-197, and the `reload` helper) | `deviceRows` gets `today` bound as `$3` (where-values start at `$4`; update `getDevice` `"d.id = $3"` -> `$4` and every other `deviceRows` caller, found by Grep); select `h.new_expires_on`; `overdue` = `owner_id is not null and holding_expires_on < $3::date` (select expression, so `$3` is always used); `FILTER_SQL.overdue` = same predicate; `listDevices`/`getDevice`/`reload` take `today` | Overdue computed on read; filter | No |
| `src/server/devices/handoffs.ts` (l.58-121, 264-319, 488-521, 605-660) | Add `startExtension` (lock device for update, pending check, insert with `new_expires_on`, audit `device.extension_start`); `confirmExtensionOnce` (lock device, lock handoff, `handoff_not_pending`/`handoff_stale` if owner changed or `new_expires_on <= today`, update `devices.holding_expires_on`, `setConfirmed`, audit `device.extension_confirm` with `fromExpiresOn`/`toExpiresOn`); `confirmHandoff` dispatches by kind and takes `today`; `decline` and `cancel` already generic (audit `device.extension_decline` / `device.extension_cancel`); `listHandoffs` `box="extensions"` (Manager+ else 422 `not_allowed`, org-wide pending extensions); `countHandoffs` takes `today` and adds `extensions` (Manager+) and `overdue` (own devices); `handoffRows` passes the extension kind through `handoffFlags` (no change needed beyond rules) | Core of the feature | No |
| `src/app/api/devices/route.ts`, `src/app/api/devices/[id]/route.ts`, `.../placement/route.ts`, `.../assignment/route.ts`, `.../holding/route.ts` | Pass `todayUtc7(new Date())` to the changed service functions (only those that call `deviceRows`/`reload`; Grep and touch the minimum) | Service signature | No |
| `src/app/api/devices/[id]/handoffs/route.ts` | Pass `todayUtc7(new Date())` to `validateHandoffStart`; route `kind === "extension"` to `startExtension` | New start kind | No |
| `src/app/api/handoffs/[id]/confirm/route.ts` | Pass `todayUtc7(new Date())` to `confirmHandoff` | Stale-date check | No |
| `src/app/api/handoffs/count/route.ts` | Pass `todayUtc7(new Date())` to `countHandoffs` | Overdue count | No |
| `src/server/devices/tx.ts` | Only if a new refusal code is needed; none planned (reuses `handoff_stale`, `handoff_not_pending`, `handoff_pending`, `device_unowned`, `not_allowed`) | — | No |
| Tests (see below) | Update and add | R5 | No |

R1/R7 notes: only route handlers import `src/server/**`; all permission checks (`not_allowed`) run before any lock or write, 401/403 only from `withAuth`.

## Data model / migration
None. `device_handoffs` already has `kind in ('transfer','return','extension')`, `new_expires_on date`, the shape check for extension (`to_member_id is null and new_expires_on is not null`) and the one-pending-per-device unique index (`db/migrations/20261125120000_device_lifecycle.sql` l.53-69). No `.sql` file is touched, so no High path and no `pnpm schema:check`.

## API contract
| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `/api/devices/:id/handoffs` | `{ kind: "extension", newExpiresOn: "YYYY-MM-DD", note?: string }` (existing kinds unchanged) | 201 `HandoffDto` (kind extension, `newExpiresOn` set) | 400 `invalid_request` (date not after today UTC+7, bad shape); 404; 409 `handoff_pending`; 422 `not_allowed` (not the owner), `device_unowned` | Owner only (Manager+ edit the expiry directly via the holding endpoint) |
| POST | `/api/handoffs/:id/confirm` | none | 200 `HandoffDto` (status confirmed; device expiry = `newExpiresOn`) | 404; 409 `handoff_not_pending`, `handoff_stale` (owner changed or date no longer after today); 422 `not_allowed` | Manager+ for kind extension |
| POST | `/api/handoffs/:id/decline` | none | 200 `HandoffDto` (declined; expiry unchanged) | 404; 409 `handoff_not_pending`; 422 `not_allowed` | Manager+ for kind extension |
| POST | `/api/handoffs/:id/cancel` | none | 200 `HandoffDto` | as today | The owner (from) or Manager+ |
| GET | `/api/handoffs?box=extensions` | — | `{ items: HandoffDto[], truncated }` pending extensions, newest first, limit 100 | 400 bad box; 422 `not_allowed` for User | Manager+ |
| GET | `/api/handoffs/count` | — | `{ incoming, returns, extensions, overdue }` (`extensions` 0 for User; `overdue` = caller's own overdue devices) | 401/403 from wrapper only | any member |
| GET | `/api/devices?placement=overdue` | — | `DeviceListResponse`, each `DeviceDto` gains `overdue` | 400 unknown filter | any member |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/devices/holding.test.ts › todayUtc7 day boundary` | 16:59:59Z vs 17:00:00Z across the UTC+7 midnight |
| `src/lib/devices/handoff-rules.test.ts › decideExtensionStart` | owner ok; non-owner User and Manager -> `not_allowed`; unowned; pending -> `handoff_pending`; null actor; permission before pending |
| `src/lib/devices/handoff-rules.test.ts › decideHandoffAction extension` | replaces the old "extension refused" case: Manager/Admin confirm and decline ok; owner cannot confirm/decline; cancel by owner and Manager+; not pending -> `handoff_not_pending`; `handoffFlags` for each role |
| `src/lib/validate/device.test.ts › validateHandoffStart extension` | valid; missing / non-string / malformed / 2026-02-30 / past / today / tomorrow boundary; extra key (`toMemberId`) rejected; note trimmed and 500-char limit; `parseDeviceQuery` accepts `overdue`; `validateHandoffBox` accepts `extensions` |
| `src/app/api/handoffs/handoffs-routes.test.ts` | POST extension 201 and invalid date 400; `box=extensions` passes tier; count passes `today` and returns the 4 fields; confirm passes `today` |
| `src/app/api/devices/devices-routes.test.ts` | `placement=overdue` accepted; service receives `today` |
| `src/server/devices/handoffs.db.test.ts` (CI) | start extension (owner ok, other user 422, unowned 422, second pending 409, transfer pending 409); approve sets expiry + audit meta + `decided_by`; approve by User 422 and no write; approve with `new_expires_on <= today` -> `handoff_stale`; reject leaves expiry; owner cancel; `takeBack` cancels a pending extension; `listHandoffs extensions` (Manager ok, User 422); count semantics; DTO `overdue` and `pendingHandoff.newExpiresOn` |
| `src/server/devices/devices.db.test.ts` (CI) | `placement=overdue` returns only owned devices with expiry before the pinned `today`; yesterday overdue, today not, null never, unowned never |

## Approach
1. `types.ts` and `holding.ts` untouched logic first; then `handoff-rules.ts` + `validate/device.ts` with their unit tests (pure logic first).
2. `devices.ts`: thread `today` through `deviceRows`/`reload`; add `overdue`, `newExpiresOn`, filter.
3. `handoffs.ts`: `startExtension`, `confirmExtensionOnce` (lock order device -> handoff, as `confirmReturnOnce`; no seat/room lock needed because placement does not change), `listHandoffs`/`countHandoffs` extensions. Keep the confirm "permission before any lock" pattern (R7): extend `confirmHandoff`'s early `decideHandoffAction` check, then dispatch.
4. Routes: inject the clock with `todayUtc7(new Date())` only in handlers.
5. Update existing tests that call changed signatures; run `pnpm typecheck`, `pnpm check:layers`, `pnpm test`, `pnpm format:check`; `pnpm test:db` runs in CI (local DB optional).
Rules: R1 (routes only into server), R6 (every query uses `orgQuery`, every join repeats `org_id`), R7 (refusals before side effects), R4 (nothing outside this list), R5.

## Specialist input used
None (fast lane, no consults).

## Assumptions
- Only the owner starts an extension (spec: "The owner can request"); Manager+ use the existing holding edit. A Manager who is also the requester may approve their own request (spec only requires Admin/Manager).
- Extension is allowed on a device with no expiry (approve then sets one); the only date rule is "after today", as in the ticket. No "after the current expiry" rule is added.
- Approve re-checks `new_expires_on > today` and returns 409 `handoff_stale` if the date passed meanwhile; the Manager can reject then.
- Reuses the existing confirm/decline/cancel endpoints (confirm = approve, decline = reject) instead of new routes; slice 2 labels them Approve/Reject.
- Overdue banner data (the owner's overdue devices) comes from `GET /api/devices?placement=overdue` filtered by `mine` in slice 2; no extra endpoint.
- Hotspots (rebase expected): `src/server/devices/handoffs.ts`, `src/lib/devices/handoff-rules.ts`, `src/lib/devices/types.ts`, `src/server/devices/devices.ts` are shared with other SIM-037.x tickets; Grep found no other open ticket specified here, orchestrator to confirm against the board.
- Deactivation/removal (OQ-44) already cancels pending handoffs generically (SIM-037.4); the DB test only covers `takeBack`. Implementer verifies the member-deactivation path does not filter on kind, and records a follow-up if it does.

## Blocking questions
None

## Split proposal
Plan covers **slice 1 (API, rules, validators, DTO/count fields, tests)** only: roughly 250 non-test lines plus tests; the UI is a second cycle.

Slice 2 (new ticket, e.g. `SIM-037.11`, Depends on slice 1; areas ui), not planned here:
- Devices page filter chip "Overdue" (`FILTERS` in `src/ui/devices/devices-state.ts`, `devicesCopy.filters`/`empty`), Overdue chip on rows and in detail (`DevicesView.tsx`, `devices-state.ts` `pendingText` extension text).
- `HandoffCountDto` in `useHandoffBadge.tsx` (`ZERO`), `devices-api.ts` count parser, `badgeCountAfter`/`badgeTotal` in `incoming-transfer.ts`, `shellCopy.badge.devicesBreakdown` and `AppShell.tsx` `badgeLabels` to include overdue and pending extensions.
- Owner banner (Extend / Return) and Extend dialog (date + note, `api.startExtension`), Pending extensions section for Manager+ (Approve / Reject / handled like `PendingReturns`), owner Cancel on the row, `devices-api.ts` additions, `src/ui/copy/devices.ts` copy, UI tests, and a dev-seed device with expiry yesterday for the manual check.
