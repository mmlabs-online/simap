# Impl log — SIM-037.9: Devices UI: incoming transfers and nav badge

## Attempt 1

### Files touched
- `src/ui/devices/devices-api.ts`: `incomingHandoffs`, `handoffCount`, `confirmHandoff`, `declineHandoff` (API client).
- `src/ui/devices/transfer-device.ts`: export `NOTHING_CHANGED` (shared list, no behaviour change).
- `src/ui/devices/incoming-transfer.ts` (new): outcomes, `focusAfter`, `badgeCountAfter`, reducer. Also two small types (`IncomingResult`, `IncomingCall`) exported here because `no-literals.test.ts` scans `.tsx` files and flags generics like `=> Promise<...>` in `DevicesPage.tsx`.
- `src/ui/devices/useIncomingHandoffs.ts` (new): list hook.
- `src/ui/devices/IncomingTransfers.tsx` (new): props-only section.
- `src/ui/devices/DevicesView.tsx`: optional `incoming` slot between notice and filter chips.
- `src/ui/devices/DevicesPage.tsx`: wiring, shared `acting` guard (renamed from `cancelling`), post-commit focus effect.
- `src/ui/devices/useHandoffBadge.tsx` (new): provider and hooks, copy of the request badge.
- `src/ui/AppShell.tsx`, `src/ui/AppShellView.tsx`, `src/ui/copy/shell.ts`: nav badge with per-nav screen-reader text (`badge.byNav`, `incomingTransfers`).
- `src/ui/copy/devices.ts`: `incoming` block.

### Tests added
- `devices-api.test.ts` (3 cases), `incoming-transfer.test.ts` (new), `IncomingTransfers.test.tsx` (new), `DevicesView.test.tsx` (placement), `AppShellView.test.tsx` (4 devices badge cases). Existing myRequests cases unchanged.

### Check results
- `pnpm format:check`, `pnpm typecheck`, `pnpm check:layers`, `pnpm test`, `pnpm build`: all exit 0.
- Vitest: `Test Files 261 passed | 1 skipped (262)`, `Tests 2662 passed | 14 skipped (2676)`.

### Manual two-account run
Not run (no second dev account available in this session). Reviewer or Ming can follow the plan's manual steps.

### Out-of-plan files
None.

### Follow-ups
- A third nav badge should trigger a `debt` issue for a shared badge factory (plan, Assumptions).
- While a confirm/decline is in flight, the row Cancel button stays visually enabled but is ignored by the shared guard (needs a `DeviceTable` change, out of plan).

### Scope self-check
Only files in the plan were changed; no server code touched; all new copy is in `src/ui/copy/*`.
