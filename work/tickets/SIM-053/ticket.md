# SIM-053: My Portal and device dialog polish (SIM-045, SIM-045.1, SIM-048 follow-ups)

| Field | Value |
|---|---|
| State | DONE |
| Priority | P3 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T09:38Z |
| PR | — |

## Goal
Clear the small UX defects and test gaps the reviews of SIM-045, SIM-045.1 and SIM-048 left as follow-ups.

## Scope reference
`docs/spec-v1.md` POR-01..POR-03, DEV-04/05 (D72); follow-ups in `work/tickets/SIM-045/review.md`,
`work/tickets/SIM-045.1/review.md`, `work/tickets/SIM-048/review.md`.

## Scope
- My seat: one empty state only when there is no seat and no request (`MyRequestsView` `hideEmpty`/`emptyText` prop); with requests but no seat, the seat section shows a short "no seat" line.
- My seat button text "Release seat" (POR-02).
- `loadMySeats` keeps the real error code from `/api/me` / `/api/members` instead of `internal`.
- My devices: a failed refresh after Confirm/Decline shows a notice; a failed `loadMore` shows its error.
- Move "latest notice wins" into a pure helper with a unit test.
- Move dialog: a device lent before D72 shows its current seat (read-only) and a hint why other seats are not offered.

## Out of scope
- New features; server changes.

## Acceptance criteria
- [ ] No seat and no request shows exactly one empty state with the Rooms link.
- [ ] The release button reads "Release seat".
- [ ] Seat-load errors show the server's error code message.
- [ ] Failed refresh after Confirm/Decline and failed "Load more" each show a message; rows stay.
- [ ] The latest-notice rule is a pure helper with unit tests.
- [ ] The move dialog explains a pre-D72 lent device's current seat.

## Technical notes
- Files: `src/ui/portal/**`, `src/ui/requests/MyRequestsView.tsx`, `src/ui/devices/PlaceDeviceDialog.tsx`, `src/ui/devices/place-device.ts`, `src/ui/copy/*`, tests.

## Test plan
- Unit / view tests for each item.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-3): "duyệt hết theo mặc định".

## Handoff
