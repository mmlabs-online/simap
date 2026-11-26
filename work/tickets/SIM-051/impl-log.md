
# Implementation log — SIM-051

## Attempt 1
### Files touched
- `src/lib/devices/visibility.ts` (+ `.test.ts`): `hiddenFromActor`, `hiddenHandoffFromActor` — required because: one pure rule next to the read rule.
- `src/server/devices/devices.ts`: `updateDevice` and `placeDevice` throw `Abort(notFound)` for a hidden device after the locked read, before `canEdit` / `decidePlacement` — required because: criterion 1.
- `src/server/devices/handoffs.ts`: `startTransfer`/`startReturn`/`startExtension` check after the device read; cancel/decline (`closeHandoff`) and `confirmHandoff` return 404 for a User who is neither sender nor recipient at the first read — required because: criteria 1, 3.
- `devices.test.ts`, `devices.db.test.ts`, `handoffs.db.test.ts`: updated 422 -> 404 for User non-holders; added tests (inventory clash on foreign device, third-party handoff actions, Manager/Admin unchanged).

### Tests added
- visibility unit tests; devices.test.ts unknown-id equality; devices.db inventory-clash 404; handoffs.db third-party cancel/decline/confirm 404 (manager cancel still ok). Recipient confirm/decline already covered by existing passing tests.

### Check results
- format:check: all matched files use the correct format; typecheck exit 0; check:layers: 864 files, no violations
- test: Test Files 328 passed | 1 skipped; Tests 3286 passed | 9 skipped
- build exit 0
- test:db: Test Files 22 passed; Tests 337 passed

### Out-of-plan files
None.

### Follow-ups
- A User on an unowned device now gets 404 on extension start (was 422 device_unowned); consistent with "unowned = not held". Tests updated.
- Route test files needed no change.

### Scope self-check
Only plan files touched; decision functions unchanged.
