
## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| src/ui/requests/MyRequestsView.tsx | `hideEmpty` prop (AC1) |
| src/ui/portal/MySeatTab.tsx | one `empty` value feeds both views (AC1) |
| src/ui/portal/MySeatView.tsx | "no seat" line when requests exist (AC1) |
| src/ui/copy/portal.ts | "Release seat", `seat.noSeat`, `devices.loadMoreFailed/refreshFailed` (AC1, 2, 4) |
| src/ui/seats/seats-api.ts | export `errorCode` (AC3) |
| src/ui/portal/my-seats.ts | keep real error code, map `ApiAccessError` (AC3) |
| src/ui/portal/portal-state.ts | `latestNotice`, `refreshFailureNotice` (AC4, AC5) |
| src/ui/portal/MyDevicesTab.tsx | stamped notices + refresh failure notice (AC4, AC5) |
| src/ui/portal/useMyDevices.ts | `loadMore` clears the old error on retry (AC4) |
| src/ui/portal/MyDevicesView.tsx | load-more error alert (AC4) |
| src/ui/copy/devices.ts | `place.lentCurrent`, `place.lentMoveHint` (AC6) |
| src/ui/devices/place-device.ts | pure `lentSeat` (AC6) |
| src/ui/devices/PlaceDeviceDialog.tsx | read-only current seat + hint (AC6) |
| tests (see below) | plan test list |

### Tests added / changed
- my-seats.test.ts › loadMySeats error codes (me, members, thrown ApiAccessError)
- portal-state.test.ts › latestNotice, refreshFailureNotice
- MyRequestsView.test.tsx › hideEmpty
- MySeatView.test.tsx › no-seat line (release label assertion already uses `portalCopy.seat.release`)
- MySeatTab.test.tsx (new) › one empty state. Hook mocking is heavy (auth/fetch contexts), so it renders MySeatView + MyRequestsView with the props the tab derives from `seatTabEmpty`.
- MyDevicesView.test.tsx › load-more error
- place-device.test.ts › lentSeat; PlaceDeviceDialog.test.tsx › lent device sees seat and hint

### Checks (actual output summary)
- typecheck: pass (tsc clean); check:layers: 865 files, no violations
- format:check: all matched files use the correct format
- test: 329 files passed, 1 skipped; 3307 tests passed, 9 skipped
- build: pass
- test:db: 22 files, 342 tests passed

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- The "no seat" line also shows while requests are loading or errored (seats empty and `empty` false). Acceptable; not narrowed.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +330 / -15 lines including tests.
