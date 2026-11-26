## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (920 files)
- `pnpm typecheck && pnpm check:layers` — exit 0; types generated, tsc clean; "check-layers: 865 files, no violations"
- `pnpm test` — exit 0; "Test Files 329 passed | 1 skipped (330)", "Tests 3307 passed | 9 skipped (3316)"
- `pnpm build` — exit 0
- `pnpm test:db` (local docker Postgres, throwaway DB) — exit 0; "Test Files 22 passed (22)", "Tests 342 passed (342)"

My results match impl-log.md.

### Acceptance criteria
- [x] No seat and no request shows exactly one empty state with the Rooms link — evidence: `MySeatTab.tsx:93-94,109` computes one `empty` and passes it to `MySeatView` and to `MyRequestsView hideEmpty`; `MyRequestsView.tsx:46` returns null when ready and empty; `MySeatTab.test.tsx › no seat and no request renders one empty state` (one `portalCopy.seat.empty`, no `requestsCopy.mine.empty`, no requests heading, one `href="/rooms"`); `MyRequestsView.test.tsx › hideEmpty renders nothing…`; `MySeatView.test.tsx › requests but no seat shows the no-seat line, not the empty card`. All pass. The tab test renders the two views with the tab's derived props rather than the tab itself (hooks need auth/fetch contexts). The plan allowed this and impl-log records it. The wiring in `MySeatTab.tsx` is three lines, and I checked it by reading it.
  - About the follow-up the implementer left: while requests are loading or have errored, `MySeatView.tsx:115-117` shows "You do not have a seat." because `empty` is false. This **meets** AC1. The AC covers the settled case with no seat and no request, and that case shows exactly one empty state. During loading or after an error the line is true (the seats list loaded and is empty). It is a single short line, not a second empty state, and it has no Rooms link. The ticket scope only says what to show "with requests but no seat" and is silent on loading/error. One cosmetic side effect: when requests finish loading with zero items, the line is replaced by the empty card, which causes a small layout swap. That is a nit (see below), not a blocker.
- [x] The release button reads "Release seat" — evidence: `src/ui/copy/portal.ts:12` `release: "Release seat"`; `MySeatView.test.tsx:41` asserts the button text equals `portalCopy.seat.release`.
- [x] Seat-load errors show the server's error code message — evidence: `my-seats.ts:49,53` use `errorCode(res)` (exported from `seats-api.ts:17`, no behaviour change), and `my-seats.ts:62-65` maps `ApiAccessError` the same way as `seats-api.ts:40-42`; `my-seats.test.ts › loadMySeats error codes` (forbidden kept for /api/me and /api/members/<id>, non-JSON → internal, signed_out → unauthenticated, other throw → unavailable). `MySeatView` already renders `apiErrorMessage(errorCode)`.
- [x] Failed refresh after Confirm/Decline and failed "Load more" each show a message; rows stay — evidence: `MyDevicesTab.tsx:99-105` turns the `Promise.all` results into `refreshFailureNotice` and shows it; `useMyDevices.refresh` keeps the rows on failure (pre-existing); `MyDevicesView.tsx:100-104` shows an alert under the table when ready with rows and an `errorCode`, and the Load more button stays for a retry; `useMyDevices.ts:66` clears the old error on retry, and `appendPage` / a successful refresh reset it. Tests: `portal-state.test.ts › refreshFailureNotice` (3 cases), `MyDevicesView.test.tsx › load-more error shows an alert and keeps rows and the button`. I checked that `refresh()` never sets `errorCode`, so a refresh failure cannot falsely show the "load more" alert.
- [x] The latest-notice rule is a pure helper with unit tests — evidence: `portal-state.ts:60-65` `latestNotice`; `portal-state.test.ts › latestNotice` (higher seq wins, tie prefers b, a newer clear wins, both null). Wired in `MyDevicesTab.tsx:61-67`.
- [x] The move dialog explains a pre-D72 lent device's current seat — evidence: `place-device.ts:39-44` `lentSeat`; `PlaceDeviceDialog.tsx:71,101-105` shows a read-only hint line; copy `devices.ts:258-261`. Tests: `place-device.test.ts › lentSeat` (lent → seat; own seat, unplaced, manager, seat missing from the list, seat with no occupant → null), `PlaceDeviceDialog.test.tsx › user moving a device lent before D72…` (Vietnamese name "Nguyễn Bình" kept; no hint for a manager or for the user's own seat).

Ming verification after merge: none (per plan).

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: the new imports are ui → ui/lib only (`ApiAccessError` from `@/lib/api/fetch`); check:layers is clean. R3/R2/R6/R7: no server, schema or env changes. R4: every changed source file is in the plan's file list; there are no out-of-plan files. D36: all new strings are in `src/ui/copy/*` and no-literals passes. R5: checks are green and the new logic has tests.

### Blockers from review agents
None.

### Nits (do not block)
- `MySeatView.tsx:115`: the "no seat" line also shows while requests are loading. When they then load empty, the line is swapped for the empty card (a brief layout shift). To avoid that, gate the line on requests being ready, e.g. pass a `noSeatLine` flag from `MySeatTab` (`seats.length === 0 && requests.status === "ready" && requests.items.length > 0`).
- `portal-state.test.ts`: the new `describe` blocks and `import { apiErrorMessage }` sit between imports; `import { ApiAccessError }` now comes after them. It works because imports are hoisted, but move the new blocks below the imports.
- `PlaceDeviceDialog.tsx:101`: the `lent.occupant &&` check is redundant (`lentSeat` only returns a seat that has an occupant). It is harmless as a type narrowing.

### Follow-ups (out of scope)
- If the no-seat line during loading turns out to be distracting in use, narrow it as described in the first nit.
- `lentSeat` finds the seat only in the selected room's seat list. If the user switches to another room in the dialog, the hint disappears. That is acceptable for now; a hint tied to `device.placement` (seat code from the DTO) would make it independent of the room.
