## Attempt 1 — 2026-11-25 (slice 1: API, rules, validators, DTO/count fields; UI is SIM-037.11)

### Files touched
| File | Required because |
|---|---|
| `src/lib/devices/types.ts` | `overdue`, `PendingHandoffDto.newExpiresOn`, extension start value, `extensions` box, 4-field count, `overdue` filter |
| `src/lib/devices/handoff-rules.ts` | `decideExtensionStart`; extension confirm/decline Manager+ only, cancel as other kinds |
| `src/lib/validate/device.ts` | `overdue` filter, `validateHandoffStart(body, today)` with `extension`, `extensions` box |
| `src/server/devices/devices.ts` | `today` bound as `$3` in `deviceRows`; `overdue` select expr; `FILTER_SQL.overdue`; `h_new_expires_on`; `listDevices`/`getDevice` take `today` |
| `src/server/devices/handoffs.ts` | `startExtension`, `confirmExtensionOnce`, `confirmHandoff(today)`, `listHandoffs` box `extensions`, `countHandoffs(today)` with `extensions`/`overdue` |
| `src/app/api/devices/route.ts`, `[id]/route.ts`, `[id]/handoffs/route.ts`, `src/app/api/handoffs/[id]/confirm/route.ts`, `count/route.ts` | inject `todayUtc7(new Date())`; route `kind: "extension"` to `startExtension` |
| Tests (see below) | R5 and signature changes |

### Tests added / changed
- `src/lib/devices/handoff-rules.test.ts` › `decideExtensionStart`, `decideHandoffAction extension` (replaces the "extension refused" case; includes `handoffFlags`)
- `src/lib/validate/device.test.ts` › `validateHandoffStart extension` (valid, missing/non-string/malformed/2026-02-30, yesterday/today/tomorrow boundary, extra key, note limit), `parseDeviceQuery` overdue, `validateHandoffBox` extensions; existing calls pass `today`
- `src/app/api/devices/devices-routes.test.ts` › `placement=overdue` passes today; `kind extension` 201 / 400 / refusal; list/get now assert `today`
- `src/app/api/handoffs/handoffs-routes.test.ts` › `box=extensions`; count returns 4 fields and passes today; confirm passes today
- `src/server/devices/handoffs.db.test.ts` (CI only) › new `handoffs (db): extension` block: start, refusals (user, Manager, unowned, second pending, transfer pending), approve (expiry + audit + decided_by), approve/reject by owner or user 422 with no write, stale date and stale owner 409, reject leaves expiry, owner cancel and take-back cancel, `listHandoffs extensions`, count semantics, DTO `overdue` and `placement=overdue` filter (yesterday true; today, null, unowned false). Existing count expectations extended with `extensions: 0, overdue: 0`.
- `src/server/devices/devices.db.test.ts`, `devices.test.ts`: signatures only (pinned `TODAY`). The planned `placement=overdue` DB case is in `handoffs.db.test.ts` (shares the extension fixtures) instead of `devices.db.test.ts`.
- `holding.test.ts › todayUtc7` already covers the 16:59:59Z / 17:00:00Z boundary; unchanged.
- UI test fixtures (`DevicesView`, `PlaceDeviceDialog`, `device-form`, `device-actions`, `place-device`, `incoming-transfer`, `devices-api` tests): new required DTO fields only.

No local Postgres on this machine: the DB tests (`*.db.test.ts`) were typechecked only, NOT run. CI runs `pnpm test:db`. Reviewer should treat the SQL (`overdue` expression, `countHandoffs` query, `confirmExtensionOnce`) as unexecuted locally.

### Checks (actual output summary)
- typecheck: exit 0 (no errors, including the DB tests)
- check:layers: "728 files, no violations"
- format:check: "All matched files use the correct format."
- test (`pnpm test`): 273 files passed, 2 failed, 2798 tests passed. The 2 failures are timeouts under load, unrelated: `scripts/dev-process.test.ts` (passes alone on the stashed baseline) and `src/app/api/routes-guarded.test.ts` (5 passed when re-run alone, on the change and on the baseline). DB tests are skipped locally (no DB).
- build: not run (no config change; typecheck green)

### Out-of-plan files
- `src/ui/devices/return-device.ts`, `transfer-device.ts`: `validateHandoffStart` gained the `today` arg; pass `todayUtc7(new Date())`.
- `src/ui/devices/devices-api.ts` (count parser reads `extensions`/`overdue`), `useHandoffBadge.tsx` (`ZERO`), `incoming-transfer.ts` (fallback count): required by the new `HandoffCountDto`; badge display unchanged.
- `src/ui/copy/devices.ts`: `filters.overdue` / `empty.overdue` entries, needed because `devicesCopy.filters` is indexed by `PlacementFilter`. The chip is NOT added to `FILTERS` (slice 2).
- UI test fixture files listed above: type-only.
- Design deviation: `reload(...)` in `devices.ts` takes `today` as an optional last parameter (default `todayUtc7(new Date())`) instead of threading `today` through every write function (`placeDevice`, `updateDevice`, `assignDevice`, `updateHolding`, `takeBack`) and their routes. Write responses use the real clock; this keeps the diff and signatures small. `listDevices`/`getDevice`/`confirmHandoff`/`countHandoffs` take `today` explicitly as planned.
- `startExtension` is audited as `device.extension_start`; confirm/decline/cancel audit `device.extension_*` through the existing generic names.

### Follow-ups (noticed, not done)
- Member deactivation (`src/server/members/manage.ts`) cancels pending handoffs with no kind filter, so extensions are covered; no DB test for that path with an extension (OQ-44 test covers transfer/return only).
- Slice 2 (SIM-037.11) must add the Overdue chip to `FILTERS`, badge totals using `extensions`/`overdue`, the banner, extend dialog and Manager approval list, and `pendingText` for kind extension.
- Pending requests approved by the requester themself (Manager owner) are allowed, per plan assumptions.

### Scope self-check
- Could the diff be smaller? No for source; about half the diff is tests and fixtures forced by the new required DTO fields and signatures.
- Diff size: about +743 / -130 lines over 30 files before the impl-log (source, non-test, roughly +330).
