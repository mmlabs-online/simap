# SIM-015.4: Default room layout and layout read API

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | api, security |
| Gate | none |
| Depends on | SIM-015.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | — |

## Goal
Any org member can read a room's map data, including a usable default for a room nobody has arranged yet.

## Scope reference
- Spec LAY-01, LAY-06, "Room view (all roles)", SEA-02.
- D43, D48, D58, D59.
- `work/tickets/SIM-015.1/plan.md`: `## API contract` (GET, `LayoutResponse`, default layout) and choices A1-A14. These are
  approved and are not decided again.

## Scope
- A pure `defaultLayout` in `src/lib/sprites/default-layout.ts`, using the plan's grid rule.
- `GET /api/rooms/{id}/layout` for any org member, returning `LayoutResponse`.
- Read in one `repeatable read, read only` transaction, scoped by the verified token's org (R6).
- Seat status derived, never read from storage. The avatar seed is the member id, and raw `sub` is never returned.
- In a saved room, a seat with no valid placement takes the first free slot, or is listed in `unplaced`.

## Out of scope
- `PUT` and the save transaction (SIM-015.5).
- Any migration or map UI (SIM-015.1, SIM-015.3).
- The `pending` overlay state (SIM-014).

## Acceptance criteria
- [ ] GET returns the room size, each seat's placement and derived status, and the fixtures, for the caller's org only.
- [ ] A room with no saved layout returns a usable default without writing anything, and its seats stay reachable.
- [ ] The default layout passes the SIM-015.1 layout rules, so an Admin can save it unchanged.
- [ ] A room over 500 seats returns the first 500 with `truncated: true`.
- [ ] A bad id, or a room in another org, returns 404.
- [ ] The response never contains a raw Identity `sub`.
- [ ] Unit tests cover `defaultLayout`, and DB integration tests cover org scoping and the read.

## Technical notes
- Files: `src/lib/sprites/default-layout.ts`, `src/server/layout/layout.ts`, `src/app/api/rooms/[id]/layout/route.ts`.
- `pnpm build` confirms the `[id]` route path.

## Test plan
- Unit: default layout.
- DB: `pnpm test:db`.
- Manual: none in a browser, because this ticket has no UI.

## Notes / answers from Ming
- 2026-11-22 (D59): split from SIM-015.1; Ming approved the split and defaults A1-A14.

## Handoff
