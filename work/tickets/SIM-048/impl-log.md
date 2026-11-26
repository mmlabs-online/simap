# Implementation log — SIM-048

## Attempt 1

### Files touched
- `src/lib/devices/rules.ts`: `seat_not_yours` code, `callerId` input, User rule after the noop line. Required: the single placement rule.
- `src/lib/devices/rules.test.ts`: `callerId` default; existing manager-only cases moved to manager tier; D72 tests (own, other's, empty, inventory, legacy noop, order, manager/admin).
- `src/server/devices/devices.ts`: pass `callerId: me[0]?.id ?? null`. Required: server guard.
- `src/server/devices/devices.test.ts`: seat_not_yours writes nothing; owner_not_occupant case now uses manager.
- `src/server/devices/devices.db.test.ts`, `handoffs.db.test.ts`, `history.db.test.ts`: new user-refusal db case; existing cases that placed a User on an empty/other seat now use the manager tier (the rule would otherwise refuse them). Not run locally (no Postgres).
- `src/lib/api/error.ts`, `src/ui/copy/api.ts`, `src/ui/copy/devices.ts`: code, message, `noOwnSeats` copy.
- `src/app/api/devices/devices-routes.test.ts`: 422 passthrough test.
- `src/ui/devices/place-device.ts`: `ownSeats`, `tier` threaded through `primaryRefusal`/`offeredRoles`/`planSubmit`, `callerId`.
- `src/ui/devices/PlaceDeviceDialog.tsx`, `DevicesPage.tsx`, `useDeviceDetailActions.tsx`, `DeviceDetailPage.tsx`: `tier` prop wiring (session tier, default "user"), filtered picker, empty message.
- `src/ui/devices/place-device.test.ts`, `PlaceDeviceDialog.test.tsx`: updated calls, new ownSeats/picker tests.
- `docs/spec-v1.md` (DEV-03/04/05), `work/decisions.md` (D72).

### Tests added
See list above (rules, devices, routes, db, place-device, dialog).

### Check results
- `pnpm format:check`: all matched files use the correct format
- `pnpm typecheck`: exit 0; `pnpm check:layers`: 816 files, no violations
- `pnpm test`: 311 files passed, 3149 passed, 7 skipped
- `pnpm build`: compiled successfully
- `pnpm test:db`: NOT run (no local Postgres); CI runs it.

### Out-of-plan files
- `src/server/devices/handoffs.db.test.ts`, `history.db.test.ts`: tier changed to manager in three existing placeDevice calls onto empty seats, which the new rule refuses for a User.

### Follow-ups
- `placeVerb` "lend" branch is now unreachable for a User; left as planned.

### Scope self-check
Within plan except the two db test files above.
