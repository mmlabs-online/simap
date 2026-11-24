# Impl log: SIM-013.1

## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/lib/devices/types.ts` | caps in `DEVICE_LIMITS`, `DeviceCreateValue`, `DevicePatchValue` |
| `src/lib/validate/device.ts` | `normalizeMac`, `validateDeviceCreate`, `validateDevicePatch` |
| `src/server/devices/pg-error.ts` | 23505 -> `inventory_number_taken` / `mac_taken` |
| `src/server/devices/devices.ts` | `createDevice`, `updateDevice`, `deleteDevice`; `Refusal.code` widened; `placeDevice` locked read gone -> 404; owner-immutability comment |
| `src/app/api/devices/route.ts` | POST |
| `src/app/api/devices/[id]/route.ts` | PATCH, DELETE |
| `src/lib/api/error.ts`, `src/ui/copy/api.ts` | three new codes and copy (D36) |
| tests: `device.test.ts`, `pg-error.test.ts`, `devices.test.ts`, `devices.db.test.ts`, `devices-routes.test.ts` | plan Tests table |

### Tests added / changed
- `device.test.ts` › normalizeMac (accept/reject), validateDeviceCreate, validateDevicePatch
- `pg-error.test.ts` › the old assertion "devices_org_mac_key -> null" was replaced by the two new mappings plus unrelated 23505 -> null
- `devices.test.ts` › createDevice, updateDevice, deleteDevice, R6 scoping, placeDevice device gone -> 404
- `devices.db.test.ts` › create/edit/delete matrices, D31 delete, uniqueness, delete-vs-place race (CI only)
- `devices-routes.test.ts` › POST/PATCH/DELETE contract, 404/400 before the service, refusals

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck: exit 0; check:layers: 439 files, no violations
- test: Test Files 174 passed (174); Tests 1842 passed | 3 skipped
- build: exit 0
- test:db: NOT run locally (no local DATABASE_URL); runs in CI only. The DB tests are unverified until CI.

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- None.

### Scope self-check
- Could the diff be smaller? No.
