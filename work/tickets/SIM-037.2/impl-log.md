## Attempt 1 — 2026-11-25

Slice 1 only (API, data, SIM-037.1 carry-overs). The UI slice is SIM-037.7.

### Files touched
| File | Required because |
|---|---|
| `src/lib/devices/holding.ts` (new) | `todayUtc7`, `parseCalendarDay` (D35) |
| `src/lib/devices/holding.test.ts` (new) | tests for the above |
| `src/lib/devices/types.ts` | new limits, serial/manufacturer/brand, `holding`, `canAssign`, `canEditHolding`, `AssignValue`, `HoldingPatchValue` |
| `src/lib/devices/rules.ts`, `rules.test.ts` | `canAssign`, `canManageHolding` and matrix test |
| `src/lib/validate/device.ts`, `device.test.ts` | `optText`, `noteText`, shared `DEVICE_KEYS`, `validateAssign`, `validateHoldingPatch` |
| `src/server/devices/pg-error.ts`, `pg-error.test.ts` | `serial_taken` mapping |
| `src/server/devices/devices.ts` | new columns in reads/create/update; `assignDevice`, `updateHolding` |
| `src/server/devices/devices.test.ts`, `devices.db.test.ts` | scripted and DB tests |
| `src/app/api/devices/[id]/assignment/route.ts` (new), `.../holding/route.ts` (new) | endpoints |
| `src/app/api/devices/devices-routes.test.ts` | route tests, `createValue` fixture |
| `src/lib/api/error.ts`, `src/ui/copy/api.ts` | `serial_taken`, `not_assigned`; reworded `device_owned`, `member_not_assignable` |
| `src/server/search/search.ts`, `search.db.test.ts` | match serial, manufacturer, brand |
| `src/server/export/export.ts`, `export.test.ts` | Serial, Manufacturer, Brand CSV columns |
| `src/ui/devices/delete-device-flow.ts`, `DeleteDeviceDialog.tsx` and their tests | carry-over: dead "move to inventory first" flow removed; `stale` on `device_owned`/`handoff_pending` |
| `src/ui/copy/devices.ts` | carry-over: "Not placed" filter, empty text; removed `placedBody`, `moved`, `submit.placed` |
| `src/ui/devices/devices-state.test.ts` | labels follow the copy |
| `src/ui/devices/DevicesView.test.tsx`, `PlaceDeviceDialog.test.tsx`, `place-device.test.ts`, `device-form.test.ts` | DTO fixtures |

### Tests added / changed
- holding.test.ts: todayUtc7 around 17:00 UTC, parseCalendarDay.
- rules.test.ts: canAssign / canManageHolding matrix.
- device.test.ts: serial/manufacturer/brand create and patch, holding keys refused, validateAssign, validateHoldingPatch.
- pg-error.test.ts: serial_taken.
- devices.test.ts: assignDevice (user before any query, lock order, refusals), updateHolding (user, unowned, unchanged, note-only, clear expiry), updateDevice new columns.
- devices.db.test.ts: assign (admin, manager, audit), user/owned refusals, expiry round trip, concurrent assigns, deactivated/missing/other-org member, assign then delete, pending handoff, holding edit with audit from/to, serial uniqueness and DTO. Written, not run here.
- devices-routes.test.ts: POST assignment and PATCH holding (400s, past expiry at a fixed UTC+7 date, 200, refusals).
- search.db.test.ts: match by serial, manufacturer, brand (folded). Written, not run here.
- export.test.ts: columns and row order.
- delete-device-flow.test.ts, DeleteDeviceDialog.test.tsx, devices-state.test.ts: carry-overs.

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0; `pnpm check:layers`: "636 files, no violations".
- format:check: oxfmt, no issues (ran `pnpm format` first).
- test: "Test Files 242 passed | 1 skipped (243); Tests 2400 passed | 9 skipped (2409)". `routes-guarded.test.ts` timed out once at 5 s in the first full run (load) and passed in the next full run.
- build: `pnpm build` exit 0.
- test:db: NOT run, no Docker/Postgres here; awaits CI.
- `rg "moveBody|settleMove|afterRefetch|placedBody" src/ui`: nothing for devices (only unrelated `removeBody` in seats).

### Out-of-plan files
- `src/ui/devices/devices-api.test.ts` — its `DeviceCreateValue` body fixture needed the three new keys to typecheck.
- `src/ui/devices/device-form.test.ts` expectation (the file was in the plan for the DTO fixture): `toCreateBody` goes through `validateDeviceCreate`, so the body now carries `serial/manufacturer/brand: null`; expectation updated. No change to `device-form.ts`.

### Follow-ups (noticed, not done)
- A8 debt (to file as GitHub issue, label `debt`, `project:simap`; no `gh` here): deactivating a member does not count unplaced owned devices (`src/server/members/manage.ts` line 298 `seat_id is not null`), so a deactivated member can keep devices in their inventory. SIM-037.4 (return) should decide.
- A9: `docs/spec-v1.md` DEV-01 lines 279-281 still describe the "Move to inventory" delete warning; Ming or a docs ticket to update.
- SIM-037.7: UI for assign dialog, holding edit, new form fields and list display.

### Scope self-check
- Could the diff be smaller? No; every change maps to the plan list or a typecheck-forced fixture.
- Diff size: see `git diff --shortstat` at commit (about +1100 / -230 including tests).
