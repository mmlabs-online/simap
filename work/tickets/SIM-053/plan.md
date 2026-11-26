Status: READY

# Plan — SIM-053: My Portal and device dialog polish (SIM-045, SIM-045.1, SIM-048 follow-ups)

## Scope summary
Ticket scope (`work/tickets/SIM-053/ticket.md`), quoted:
- "My seat: one empty state only when there is no seat and no request (`MyRequestsView` `hideEmpty`/`emptyText` prop); with requests but no seat, the seat section shows a short "no seat" line."
- "My seat button text "Release seat" (POR-02)."
- "`loadMySeats` keeps the real error code from `/api/me` / `/api/members` instead of `internal`."
- "My devices: a failed refresh after Confirm/Decline shows a notice; a failed `loadMore` shows its error."
- "Move "latest notice wins" into a pure helper with a unit test."
- "Move dialog: a device lent before D72 shows its current seat (read-only) and a hint why other seats are not offered."
- Out of scope: new features, server changes. UI only (Areas: ui), no API, no schema.

Already fixed by SIM-054 / SIM-051 on main? Checked: no. SIM-054 only moved My requests into My seat (`MySeatTab` embeds
`MyRequestsView embedded`); `hideEmpty` does not exist, so `MySeatView` (`empty` card, `MySeatView.tsx:115`) and
`MyRequestsView` (own empty card, `MyRequestsView.tsx:83`) can both show an empty state when there is no seat and no
request (the defect). `portalCopy.seat.release` is still "Release" (`copy/portal.ts:12`). `loadMySeats` still returns
`fail("internal")` (`my-seats.ts:49,51,53,55`). `useMyDevices.loadMore` failure still only sets `errorCode` and
`MyDevicesView` shows it only when `status === "error"` (`MyDevicesView.tsx:79`). SIM-051 (device 404 for Users) touches
server routes only; no overlap.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | No seat and no request shows exactly one empty state with the Rooms link. | `MySeatTab.test.tsx › no seat and no request renders one empty state` (count of "You do not have a seat yet." = 1, no "No requests" text, one `/rooms` link); `MyRequestsView.test.tsx › hideEmpty hides the empty card and heading when ready and empty`; `MySeatView.test.tsx › requests but no seat shows the no-seat line, not the empty card`. |
| 2 | The release button reads "Release seat". | `MySeatView.test.tsx` row test asserts button text "Release seat" via `portalCopy.seat.release`. |
| 3 | Seat-load errors show the server's error code message. | `my-seats.test.ts › loadMySeats keeps the code of a failed /api/me` and `… of a failed /api/members/<id>` (body `{error:{code:"forbidden"}}` gives `{ok:false, code:"forbidden"}`; non-JSON body gives `internal`; thrown `ApiAccessError` gives its code). `MySeatView.test.tsx` already renders `apiErrorMessage(errorCode)`. |
| 4 | Failed refresh after Confirm/Decline and failed "Load more" each show a message; rows stay. | `portal-state.test.ts › refreshFailureNotice` cases; `MyDevicesView.test.tsx › ready with errorCode shows the load-more alert and keeps the rows`; `MyDevicesTab` flow covered by the helper test (the tab only wires the helper). |
| 5 | The latest-notice rule is a pure helper with unit tests. | `portal-state.test.ts › latestNotice` (newer wins, equal seq prefers incoming, null handling). |
| 6 | The move dialog explains a pre-D72 lent device's current seat. | `place-device.test.ts › lentSeat` cases; `PlaceDeviceDialog.test.tsx › user moving a device lent before D72 sees its current seat and the hint`. |

## Ming verification after merge
None.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/requests/MyRequestsView.tsx` | Add `hideEmpty?: boolean`; when `hideEmpty && state === "ready" && items.length === 0` return `null` (no heading, no card). Lines 11-42 (props), 43-53 (return early). | One empty state (AC1). `emptyText` is not needed: with a seat and no request the existing `requestsCopy.mine.empty` card stays. | No |
| `src/ui/requests/MyRequestsView.test.tsx` | Add hideEmpty test. | AC1 | No |
| `src/ui/portal/MySeatTab.tsx` | Compute `const empty = seats.status === "ready" && seatTabEmpty(...)` once; pass `empty` to `MySeatView` and `hideEmpty={empty}` to `MyRequestsView` (lines 99-102, 108). Pass `requestsCount`-free `noSeatLine` data via existing props. | AC1 | No |
| `src/ui/portal/MySeatView.tsx` | When `status === "ready" && seats.length === 0 && !empty`, render `<p>{t.noSeat}</p>` (new, near line 115). | AC1 "no seat" line | No |
| `src/ui/portal/MySeatView.test.tsx` | Update release button assertion; add no-seat-line test. | AC1, AC2 | No |
| `src/ui/portal/MySeatTab.test.tsx` (new) | Render-level test of the empty combination (mock `useMySeats`/`useMyRequests` or render `MySeatView` + `MyRequestsView` with the same derived props). If mocking the hooks is heavy, test via the pure derivation plus the two views and say so in impl-log. | AC1 | No |
| `src/ui/copy/portal.ts` | `seat.release: "Release seat"`; add `seat.noSeat: "You do not have a seat."`; `devices.loadMoreFailed: "Could not load more devices."`, `devices.refreshFailed: "Could not refresh the lists. Reload to see the latest."`. **Hotspot** (see Assumptions). | AC2, AC1, AC4 | No |
| `src/ui/seats/seats-api.ts` | `export` the existing `errorCode(res)` helper (line 17). No behaviour change. | AC3 reuses the one error-shape reader (no duplicate parser). | No |
| `src/ui/portal/my-seats.ts` | In `loadMySeats`: `if (!me.ok) return fail(await errorCode(me))`; same for `res` of `/api/members/<id>`; in `catch`, map `ApiAccessError` as `seats-api.ts:41` does (`signed_out` to `unauthenticated`, else `e.code`), otherwise `unavailable`. Keep `internal` only for a malformed 200 body. Lines 43-65. | AC3 | No |
| `src/ui/portal/my-seats.test.ts` | Add AC3 tests next to `describe("loadMySeats")` (line 61). | AC3 | No |
| `src/ui/portal/portal-state.ts` | Add pure `latestNotice(a, b)` over `{ seq: number; notice: Notice \| null }` (higher `seq` wins; tie prefers `b`; a null notice with a higher `seq` clears) and pure `refreshFailureNotice(incoming: unknown[] \| null, devices: RefreshResult): Notice \| null` (incoming `null` or `devices.ok === false` gives an error notice: `apiErrorMessage(code)` when a code is known, else `portalCopy.devices.refreshFailed`). | AC4, AC5 | No |
| `src/ui/portal/portal-state.test.ts` | Tests for both helpers. | AC4, AC5 | No |
| `src/ui/portal/MyDevicesTab.tsx` | Replace `shown`/`useEffect(() => setShown(notice))` (lines 55-57, 84, 87) with two stamped sources (host notice from `useDeviceDetailActions`, incoming outcome), a `useRef` counter for `seq`, and `latestNotice(...)`. In `act()` (lines 88-99) read the `Promise.all` results (`inc`, the `myDevices.refresh()` result) and, if `refreshFailureNotice(...)` is non-null, stamp it as the incoming source. | AC4, AC5 | No |
| `src/ui/portal/useMyDevices.ts` | In `loadMore` (line 66) set `errorCode: null` together with `loadingMore: true`, so a retry clears the old message; failure branch (line 70) already keeps rows and sets `errorCode` (verify `appendPage` in `requests-state.ts` resets `errorCode` on success; if not, reset there in the hook, not in `requests-state.ts`). | AC4 | No |
| `src/ui/portal/MyDevicesView.tsx` | Under the table (line 96-106): `status === "ready" && errorCode !== null && devices.length > 0` renders `<p role="alert">` with `portalCopy.devices.loadMoreFailed` + `apiErrorMessage(errorCode)`; keep the Load more button so the user can retry. | AC4 | No |
| `src/ui/portal/MyDevicesView.test.tsx` | Add load-more-error test. | AC4 | No |
| `src/ui/copy/devices.ts` | In `place` (line 238-262) add `lentCurrent: (seatCode: string, name: string) => ...` ("Currently on seat C-02, lent to Binh.") and `lentMoveHint: "You can move this device only to a seat you occupy, so other seats are not listed."`. | AC6 | No |
| `src/ui/devices/place-device.ts` | Add pure `lentSeat(d: DeviceDto, seats: SeatDto[], tier: Tier): SeatDto \| null`: tier `user`, `d.placement` set, seat with `id === d.placement.seatId` found in `seats`, its `occupant` non-null and `occupant.id !== d.owner?.id`; otherwise null (not found, e.g. truncated list, gives no hint). | AC6 | No |
| `src/ui/devices/place-device.test.ts` | Tests for `lentSeat`. | AC6 | No |
| `src/ui/devices/PlaceDeviceDialog.tsx` | In `PlaceDeviceFields` (mode `place`/`move`, after the room select, line ~98) when `lentSeat(device, seats.seats, tier)` is non-null and `seats.status === "ready"`, render a read-only `<p>` with `copy.lentCurrent(...)` and `copy.lentMoveHint` (HINT style). No new interaction. | AC6 | No |
| `src/ui/devices/PlaceDeviceDialog.test.tsx` | Add test in `describe("PlaceDeviceFields picker")` (line 98). | AC6 | No |

No file outside this list should change; none matches a High path.

## Data model / migration
None.

## API contract
None.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/portal/my-seats.test.ts › loadMySeats keeps the code of a failed /api/me` | AC3 (403 body `{error:{code:"forbidden"}}`, non-JSON gives `internal`) |
| `src/ui/portal/my-seats.test.ts › loadMySeats keeps the code of a failed /api/members/<id>` | AC3 |
| `src/ui/portal/my-seats.test.ts › loadMySeats maps a thrown ApiAccessError` | AC3 |
| `src/ui/portal/portal-state.test.ts › latestNotice` (newer seq wins; tie; null clears; both null) | AC5 |
| `src/ui/portal/portal-state.test.ts › refreshFailureNotice` (both ok gives null; incoming null gives generic message; devices code gives `apiErrorMessage`) | AC4 |
| `src/ui/requests/MyRequestsView.test.tsx › hideEmpty renders nothing when ready and empty; still renders items and loading/error` | AC1 |
| `src/ui/portal/MySeatView.test.tsx › Release button reads "Release seat"`; `› no seat with requests shows the no-seat line and no empty card` | AC1, AC2 |
| `src/ui/portal/MySeatTab.test.tsx › no seat and no request renders one empty state` | AC1 |
| `src/ui/portal/MyDevicesView.test.tsx › load-more error shows an alert and keeps rows and the button` | AC4 |
| `src/ui/devices/place-device.test.ts › lentSeat` (user + lent seat gives seat; own seat, unplaced, manager tier, seat not in list give null) | AC6 |
| `src/ui/devices/PlaceDeviceDialog.test.tsx › user moving a device lent before D72 sees its current seat and the hint` (and no hint for a manager or an own seat) | AC6 |

Domain focus: Vietnamese diacritics in the occupant name in the lent line (use a name like "Nguyễn Bình" in the AC6 test); empty/null `occupant` and `owner` handled by `lentSeat`; pagination bounds covered by the load-more test (`hasMore` and an error together).

## Approach
1. Pure first: `lentSeat` (place-device.ts), `latestNotice` and `refreshFailureNotice` (portal-state.ts), `loadMySeats` error codes (my-seats.ts, export `errorCode` from seats-api.ts), each with unit tests.
2. Copy: add the new strings and change "Release" to "Release seat" in `copy/portal.ts` / `copy/devices.ts` (D36: no literals in components; `no-literals.test.ts` guards this).
3. Views: `hideEmpty` in `MyRequestsView`; no-seat line in `MySeatView`; load-more alert in `MyDevicesView`; lent-seat lines in `PlaceDeviceFields`.
4. Wiring: `MySeatTab` (one `empty` value feeds both views); `MyDevicesTab` (stamped notices + `refreshFailureNotice`); `useMyDevices.loadMore` clears the old error on retry.
5. Rules: R1 holds (ui imports only lib/ui; `ApiAccessError` comes from `@/lib/api/fetch`, as `seats-api.ts` already does); R4 (nothing outside the list); R5 run `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Specialist input used
None (fast lane, no consult files).

## Assumptions
- `emptyText` from the ticket text is dropped: `hideEmpty` alone is enough, because the requests empty card remains correct when a seat exists.
- "Latest notice wins" means: of the host notice (row actions via `useDeviceDetailActions`) and the incoming outcome (Confirm/Decline/refresh failure), the one set most recently is shown. A per-tab `seq` counter stamps each set; exact shape of the helper's argument is the implementer's choice if the tests cover the rules above.
- `incoming.refresh()` returns `null` also when a newer refresh replaced it; that case may show the generic refresh notice. Accepted as rare; the rows stay either way.
- Hotspots: SIM-046.1 (Profile photo) and SIM-047.1 (Profile pixel look) are both in `PLANNING` and edit the Profile tab. Overlap with this ticket is only `src/ui/copy/portal.ts` (they add keys under `profile`; this ticket edits `seat` and `devices` keys), so expect a trivial rebase conflict at most. This ticket does not touch `ProfileTab*.tsx`, `PortalTabs.tsx`, `AppShell.tsx` or `portal-state.ts` profile helpers; SIM-046.1 may also add to `portal-state.ts` is not planned (its ticket names `photo-api.ts` and `AppShell.tsx`), so no overlap there.
- `MySeatTab.test.tsx` may need hook mocking (`useApiFetch`, `useSetRequestBadge`); if the harness cost is high, cover AC1 with the view-level tests plus a test of the derived `empty`/`hideEmpty` pair and record it in impl-log.
- Size S, about 250-350 changed lines including tests; one cycle.

## Blocking questions
None.

## Split proposal
None.
