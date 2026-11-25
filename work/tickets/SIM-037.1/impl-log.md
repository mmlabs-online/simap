## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| db/migrations/20261125120000_device_lifecycle.sql (new, High path) | nullable owner, invariant 5 CHECK, new columns, serial unique index, `device_handoffs` (AC 1, 3, 5; R2) |
| db/migrations/README.md (High path) | schema docs for the migration |
| scripts/schema-check.mjs | stage 1 owned device before the migration; section 10 device lifecycle checks |
| db/seeder.js | one unowned seed device (Bộ sạc D) |
| src/lib/devices/types.ts, rules.ts | `DeviceCreateValue` without ownerId, `unowned` filter, nullable owner, `canDelete`; `canCreate`, `decideDelete`, `device_unowned` rule |
| src/lib/validate/device.ts | `unowned` filter; `ownerId` is an unknown key on create |
| src/lib/search/types.ts, src/lib/seats/types.ts | nullable owner |
| src/lib/api/error.ts | codes `device_unowned`, `device_owned`, `handoff_pending` |
| src/server/devices/devices.ts | left join, null-safe DTO, `unowned` filter, owner read under device lock, Admin-only create/delete, pending handoff check |
| src/server/devices/pg-error.ts | map `devices_unowned_not_placed_check` to `device_unowned` (422) |
| src/server/search/search.ts, export/export.ts, seats/seats.ts | left joins so unowned devices are not dropped |
| src/ui/copy/devices.ts, copy/api.ts | Org inventory labels, new error messages, removed owner-picker copy (D36) |
| src/ui/devices/devices-state.ts, device-form.ts, DeviceFormDialog.tsx, DevicesPage.tsx, DeviceTable.tsx, device-actions.ts, place-device.ts | filter, no owner picker, New device for Admins only, null-safe owner, delete gated by `canDelete` |
| src/ui/search/SearchView.tsx, src/ui/seats/SeatDetailPanel.tsx | null-safe owner |
| src/test/db/fixtures.ts | `addDevice` nullable owner, `addHandoff` |
| tests (see below) | R5 |

### Tests added / changed
- src/lib/devices/rules.test.ts › canCreate; unowned device placement refusals; decideDelete order
- src/lib/validate/device.test.ts › `unowned` filter; ownerId rejected on create
- src/server/devices/pg-error.test.ts › unowned CHECK mapping, serial check ignored
- src/server/devices/devices.test.ts › create Admin-only (no query for non-Admin); update of unowned device by user; delete matrix
- src/server/devices/devices.db.test.ts › unowned list/get/filter; place unowned refused (and DB backstop); create Admin unowned; delete matrix with handoffs; uniqueness as Admin (NOT RUN, no DB)
- src/server/search/search.db.test.ts, export/export.db.test.ts › unowned device (NOT RUN, no DB)
- src/app/api/devices/devices-routes.test.ts › ownerId -> 400; device_unowned / device_owned / handoff_pending pass-through
- src/ui/devices/{device-form,DeviceFormDialog,DevicesView,devices-state,device-actions,place-device,PlaceDeviceDialog}.test.* › no owner fields, Org inventory, canDelete, four filters
- scripts/schema-check.mjs section 10 (NOT RUN, no DB)

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0; `pnpm check:layers` ok
- format:check: ok (after `pnpm format`)
- test: `pnpm test` Test Files 240 passed, 1 failed; Tests 2374 passed, 1 failed. The failure is scripts/dev-process.test.ts (real process tree, flaky under full-suite load); in isolation it passes 21/21 both with my changes and on the baseline.
- build: `pnpm build` exit 0
- pnpm migrate / schema:check / test:db: NOT RUN. Docker and a local Postgres are not available in this environment. The migration SQL, section 10 of schema-check and the *.db.test.ts changes are therefore unexecuted; CI runs `pnpm test:db`, Ming or the reviewer should run `pnpm schema:check` against compose.dev.yml.

### Out-of-plan files
- src/ui/devices/DevicesView.test.tsx, PlaceDeviceDialog.test.tsx, place-device.test.ts, devices-state.test.ts: listed under "UI tests" in the plan.
- None else.

### Follow-ups (noticed, not done)
- src/ui/devices/DeleteDeviceDialog.tsx / delete-device-flow.ts still have a "move to inventory first" branch for a placed device; unreachable now that only unowned (never placed) devices can be deleted. Remove in SIM-037.2.
- `inventory` filter label "Inventory" vs "Org inventory" overlap (A4): rename to "Not placed" in SIM-037.2.
- New columns are not in the DTO/POST yet (A9).

### Scope self-check
- Could the diff be smaller? No. Source diff is ~330 changed non-test lines plus schema-check section 10.
- Diff size: +709 / -448 tracked lines (tests included), plus the new migration (~75 lines).
