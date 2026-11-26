# SIM-045.1: My Portal: My seat tab

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-045 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T05:30Z |
| PR | — |

## Goal
My Portal gets its My seat tab (slice B of SIM-045): the member sees the seats they occupy, their seat requests, and
can release a seat, without leaving the portal.

## Scope reference
`docs/spec-v1.md` POR-01 (default tab My seat), POR-02; D70. Design: `work/tickets/SIM-045/plan.md` → "Split proposal",
slice B; consults in `work/tickets/SIM-045/`.

## Scope
- Tab list becomes My seat, My devices, Profile; default `seat`.
- `useMySeats`: `/api/me` → `/api/members/<me.id>` → `/api/seats/<id>` per seat (no new API; id only from `/api/me`, R6).
- "View on map" via `seatResultHref`; release through `ConfirmSeatDialog`; my requests with cancel (no mark-seen).
- Empty state links to `/rooms`.

## Out of scope
- A new `/api/me/seats` endpoint (alternative only if Ming asks).

## Acceptance criteria
- [ ] The default tab is My seat; tabs are My seat, My devices, Profile (URL `?tab=`).
- [ ] My seat lists every seat the member occupies with room and tags, and "View on map" opens `/rooms/<code>?seat=<seat>`.
- [ ] Pending requests can be cancelled; release asks for confirmation and refreshes seats and requests.
- [ ] With no seat and no request, an empty state links to Rooms.
- [ ] A seat that disappears (released elsewhere) drops from the list on reload; an error on `/api/members/<id>` shows an error state.
- [ ] Unit tests for the seat-list composition, empty-state decision and tab defaults.

## Technical notes
- Files: `src/ui/portal/**`, `src/ui/requests/MyRequestsView.tsx` (optional embedded prop), `src/ui/copy/portal.ts`.

## Test plan
- Unit: `portal-state.test.ts`, `useMySeats` composition.
- Manual: User with 0, 1, 2 seats; release; cancel a request.

## Notes / answers from Ming

## Handoff
