# Implementation log — SIM-013.2

## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/ui/copy/devices.ts` | D36 copy for the page |
| `src/ui/devices/devices-api.ts` | `list(filter)` API boundary |
| `src/ui/devices/devices-state.ts` | pure helpers and the race-guard reducer |
| `src/ui/devices/useDevices.ts` | reload on filter change |
| `src/ui/devices/DeviceTable.tsx` | table plus stacked list (AC1) |
| `src/ui/devices/DevicesView.tsx` | page body, filter, states (AC1-3) |
| `src/ui/devices/DevicesPage.tsx` | container wiring |
| `src/app/(app)/devices/page.tsx` | route renders the new page (AC5) |
| `src/ui/index.ts` | one-line `DevicesPage` export (R1) |
| `src/ui/devices/devices-api.test.ts`, `devices-state.test.ts`, `DevicesView.test.tsx` | plan's tests |

### Tests added / changed
- devices-api.test.ts: list sends placement=all/placed/inventory; 200 shape and malformed bodies; error code and non-JSON; access errors and network failure.
- devices-state.test.ts: placementText, emptyText, filterOptions, listSummary, devicesReducer (load, loaded, stale id ignored).
- DevicesView.test.tsx: placement/role/link/inventory; MAC dash, diacritics owner, You tag; caption, th scope, no actions; filter radios; loading/error; empty per filter; truncated.

### Checks (actual output summary)
- format:check: exit 0
- typecheck + check:layers: exit 0
- test: Test Files 179 passed (179); Tests 1886 passed | 3 skipped (1889)
- build: exit 0; `/devices` listed as dynamic route

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Extract a shared `call`/`errorCode` helper (duplicated in rooms-api, seats-api, devices-api).
- `FilterChips` has no arrow-key navigation (shared component).
- `pnpm seed:dev` creates no devices.

### Scope self-check
- Could the diff be smaller? No; every file is in the plan. Small addition not listed in the plan: `devicesCopy.typeLine` (the "type · inventory no." line of the stacked list) to avoid a JSX literal.
- Diff size: about +900 lines including tests, -10.
