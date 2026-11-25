## Attempt 1 — 2026-11-25

Slice 1 only (API, data, DTO). The UI slice is SIM-037.8.

### Files touched
| File | Required because |
|---|---|
| db/migrations/20261125180000_handoff_decided_by.sql (new, High path) | decided_by_id CHECK (A8, 037.1 follow-up) |
| scripts/schema-check.mjs | insHandoff and the raw confirmed insert carry decided_by_id; two new CHECK checks |
| src/test/db/fixtures.ts | addHandoff sets decided_by_id; new addTransfer |
| src/lib/devices/types.ts | Handoff DTOs; DeviceDto canTransfer, pendingHandoff; canDelete/canAssign comments |
| src/lib/devices/handoff-rules.ts (new) | pure start/cancel/confirm/decline rules and viewer flags |
| src/lib/devices/handoff-rules.test.ts (new) | rules matrix |
| src/lib/validate/device.ts, device.test.ts | validateHandoffStart, validateHandoffBox + tests |
| src/server/devices/tx.ts (new) | Abort/inTx/refuse/Result/Db/actorMemberId moved out of devices.ts |
| src/server/devices/devices.ts | imports tx, re-exports types; deviceRows joins pending handoff; toDto flags |
| src/server/devices/handoffs.ts (new) | start, cancel, decline, confirm, list, count; audit |
| src/server/devices/pg-error.ts, pg-error.test.ts | 23505 device_handoffs_one_pending_idx -> handoff_pending |
| src/server/devices/handoffs.db.test.ts (new), devices.db.test.ts | DB integration tests |
| src/app/api/devices/[id]/handoffs/route.ts, src/app/api/handoffs/{route,count/route,[id]/cancel|decline|confirm/route}.ts (new) | endpoints |
| src/app/api/handoffs/handoffs-routes.test.ts (new), src/app/api/devices/devices-routes.test.ts | route contract tests |
| src/lib/api/error.ts, src/ui/copy/api.ts | 3 new codes; handoff_pending reworded |
| src/ui/devices/{device-form.test.ts,DevicesView.test.tsx,place-device.test.ts,PlaceDeviceDialog.test.tsx} | new required DTO fields in fixtures |

### Tests added / changed
- handoff-rules.test.ts (decideTransferStart, decideHandoffAction matrix, viewer flags); device.test.ts (validateHandoffStart/Box); pg-error.test.ts; handoffs-routes.test.ts; devices-routes.test.ts (POST handoffs)
- handoffs.db.test.ts (start, cancel/decline, confirm, concurrency, list/count, decided_by_id); devices.db.test.ts (pending transfer DTO and delete). Written, NOT run locally (no Docker).
- Plan deviation: "assign refuses with a real pending transfer" is not testable (a transfer needs an owned device, so assign answers device_owned first); the existing handoff_pending assign test stays.

### Checks (actual output summary)
- typecheck: exit 0
- check:layers: 683 files, no violations
- format:check: All matched files use the correct format
- test: 257 files passed | 1 skipped; 2587 tests passed | 14 skipped
- build: exit 0
- test:db, migrate, migrate:smoke, schema:check: NOT run (no Docker/DATABASE_URL); await CI

### Out-of-plan files
None (the four UI test fixtures are in the plan's literal list). The DTO uses a `hf` member join (from-member sub) instead of a member lookup, to keep the existing "no member lookup" unit test valid.

### Follow-ups (noticed, not done)
- Deactivating a member does not cancel their pending handoffs (A5, SIM-037.4).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: ~+330 / -90 tracked, plus new files.
