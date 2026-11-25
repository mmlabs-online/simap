## Attempt 1 — 2026-11-25

### Files touched
| File | Required because |
|---|---|
| `src/ui/copy/devices.ts` | `extensions` copy block (D36) |
| `src/ui/copy/shell.ts` | `extensionRequests(n)` and the breakdown part |
| `src/ui/devices/devices-api.ts` | `pendingExtensions` |
| `src/ui/devices/incoming-transfer.ts` | `badgeCountAfter` 4 args, `badgeTotal`, `handoffBoxes(isAdmin, isManager)`, `fetcherFor` |
| `src/ui/devices/useIncomingHandoffs.ts` | uses `fetcherFor`; doc comment |
| `src/ui/devices/extension-device.ts` (new) | approve/reject outcomes |
| `src/ui/devices/PendingExtensions.tsx` (new) | Manager list |
| `src/ui/devices/DevicesPage.tsx` | wiring, three-way list choices, focus, refreshAll |
| `db/seeder.js` | seeded pending extension for Tablet E |
| tests: `devices-api.test.ts`, `incoming-transfer.test.ts`, `AppShellView.test.tsx`, `extension-device.test.ts` (new), `PendingExtensions.test.tsx` (new) | plan test list |

### Tests added / changed
- devices-api.test.ts › pendingExtensions GETs /api/handoffs?box=extensions
- incoming-transfer.test.ts › badgeCountAfter (4 args), badgeTotal (10), handoffBoxes (user/manager/admin), fetcherFor
- extension-device.test.ts › approve/reject ok, gone codes, error codes
- PendingExtensions.test.tsx › rows, no-expiry, gating, busy, empty, error, truncated
- AppShellView.test.tsx › devicesBreakdown with extension parts and {2,1,3,1}
- `db/seeder.test.ts` unchanged (no count asserted).

### Checks (actual output summary)
- typecheck: tsc --noEmit clean; check:layers "785 files, no violations"
- format:check: "All matched files use the correct format."
- test: 297 files passed, 2989 tests passed, 9 skipped
- build: succeeded
- seeder: `pnpm migrate` then `pnpm seed:dev` twice on local Postgres, "seed ok" both times (idempotent)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- None.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: see git diff --stat
