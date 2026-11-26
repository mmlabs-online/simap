# Implementation log — SIM-045

## Attempt 1 — 2026-11-26 (slice A; My seat is SIM-045.1; Questions for Ming: defaults followed)

### Files touched
| File | Required because |
|---|---|
| `src/app/(app)/portal/page.tsx` (new) | `/portal` route (AC1) |
| `src/ui/index.ts` | export `PortalPage` |
| `src/ui/portal/portal-state.ts` (+ `.test.ts`) | tab parsing/href/keys, `portalHandlers`, badge total, redirect, `profileOutcome` |
| `src/ui/portal/PortalTabs.tsx` (+ `.test.tsx`) | WAI-ARIA tabs |
| `src/ui/portal/PortalPage.tsx` | Suspense + `useSearchParams` container |
| `src/ui/portal/useMyDevices.ts` | cursor-paged `mine` list hook |
| `src/ui/portal/MyDevicesView.tsx` (+ `.test.tsx`) | pure My devices view |
| `src/ui/portal/MyDevicesTab.tsx` | container reusing `useDeviceDetailActions`, incoming transfers, overdue banner |
| `src/ui/portal/ProfileTab.tsx`, `ProfileTabView.tsx` (+ `.test.tsx`) | display-name edit, read-only email/role |
| `src/ui/copy/portal.ts` (new), `src/ui/copy/shell.ts` | copy (D36), nav label, page title, `portalBreakdown`, badge label |
| `src/lib/nav.ts` (+ `nav.test.ts`) | portal entry; Devices `minTier: "manager"` |
| `src/ui/AppShell.tsx` (+ `AppShellView.test.tsx`) | portal badge count and label |
| `src/ui/devices/devices-api.ts` (+ `devices-api.test.ts`) | `listMine` |
| `src/ui/devices/DevicesPage.tsx` | wrapper redirecting Users to `/portal?tab=devices` before data hooks mount |
| `src/ui/devices/useDeviceDetailActions.tsx` | doc comment only |

### Tests added / changed
- `portal-state.test.ts`: parsePortalTab, portalTabHref, nextTabIndex, portalHandlers, rowActions rules (no edit/delete/takeBack/assign/editHolding; pending cancel only; overdue extend + give back), portalBadgeTotal, portalBreakdown, devicesPageRedirect, profileOutcome
- `PortalTabs.test.tsx`, `MyDevicesView.test.tsx`, `ProfileTabView.test.tsx`, `devices-api.test.ts › listMine`
- `nav.test.ts` (user without devices, with portal; admin 12 items; portal isActive), `AppShellView.test.tsx` (portal badge; existing devices-badge cases moved to manager; 11 admin links)

### Checks (actual output summary)
- format:check: All matched files use the correct format.
- typecheck + check:layers: exit 0; "check-layers: 838 files, no violations"
- test: Test Files 319 passed | 1 skipped; Tests 3203 passed | 7 skipped
- build: exit 0, `/portal` in the route list
- test:db: not run (no DB code touched)

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Not run in a browser (no local run at 390 px / keyboard / Network-tab checks); reviewer or Ming should do the manual checks from the plan.
- In My devices a Confirm/Decline notice and a row-action notice come from two sources (`incomingNotice` vs the host's `notice`); the host's wins, and an older incoming notice can reappear when the host's is cleared.
- "Waiting for my confirmation" is an `aria-label` on a section wrapping `IncomingTransfers`, which keeps its own count heading ("N incoming transfers").
- The `MyDevicesView` test checks "in my inventory" placement only via the shared `DeviceTable`; not asserted separately.

### Scope self-check
- Could the diff be smaller? No (new page, hook, views and tests are all in the plan).
- Diff size: see `git show --stat`.

## Attempt 2 — 2026-11-26 (REWORK)

### Fixes
- Issue 1: `MyDevicesTab.tsx` keeps one `shown` notice; `useEffect(() => setShown(notice), [notice])` takes each new host notice; `act` clears it at the start and sets the outcome notice after the call; `incomingNotice` removed. `useDeviceDetailActions` unchanged. Manual sequence (Transfer A, then Confirm an incoming transfer shows the Confirm result; a failed Confirm shows its error) not run in a browser; verified by code reading only.
- Issue 2: `useMyDevices.refresh` no longer sets `status: "error"` on failure (returns `{ ok: false, code }`, rows stay); `MyDevicesView` shows the error card only when `devices.length === 0`.
- Test: `MyDevicesView.test.tsx` "error with rows keeps the table and shows no error card".

### Checks
- format:check: All matched files use the correct format.
- typecheck + check:layers: exit 0; "check-layers: 838 files, no violations"
- test: Test Files 319 passed | 1 skipped; Tests 3204 passed | 7 skipped
- build: exit 0

Out-of-plan files: none. Follow-ups: the two-source notice follow-up from attempt 1 is resolved.
