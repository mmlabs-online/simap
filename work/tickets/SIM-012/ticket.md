# SIM-012: Seat list, add/delete seats, seat detail and occupancy

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | L |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-010, SIM-011 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/41 |

## Goal
Admins add and delete a room's seats without the map, everyone sees the room's seats as a list, and anyone sees a seat's full detail; Managers assign, replace and remove occupants safely; users release their own seat.

## Scope reference
spec SEA-01..05, ROO-02, DEV-06, REG-03 (seat); D18, D22, D26, D30, D32, D47 (seats managed without the map; supersedes SEA-01 "from the layout designer" for now).

## Scope
- Admin adds seats to a room and deletes them through the API, e.g. `POST /api/rooms/{code}/seats {count}` and `DELETE /api/seats/{code}` (D47): next number from the room counter (`allocateSeatSeq` from SIM-010), never reused (D30); delete refused when the seat has an occupant or any device (SEA-01 guard); audit row. New seats get the schema's default geometry; no API accepts geometry.
- Room detail page (`/rooms/[code]`): seats as a plain table (code, status, occupant, devices) with the clean UI kit (UI style A, no pixel art); Admin add/delete actions; room switcher and route re-key (moved here from SIM-010.2 out of scope).
- Seat detail panel (code, room, status, occupant, devices, tags) ported from seatMGT `SeatDetailPanel`, opened from the seat list (`?seat=<code>`), not from a map.
- Assign / remove (Manager+); replace with confirmation (D18); primary demotion (DEV-06) in the same transaction.
- Cannot-seat flag with reason (Manager+), blocking assign/request (D26).
- Group inheritance on assign when the seat has none (D32); self-release by the occupant (D22).
- Picker shows only active members known to simap.

## Out of scope
- Any map: canvas, sprites, avatars, seat/fixture geometry, tile/grid columns, seatMGT `RoomView`/`LayoutEditor` ports (SIM-015.x, BLOCKED, D47).
- Device actions (SIM-013), requests (SIM-014), tag editing (SIM-016).

## Acceptance criteria
- [ ] An Admin adds seats to `C302` after `C302-01..03` were issued and `-03` deleted, and gets `C302-04` onward; non-Admins get 403.
- [ ] Deleting a seat with an occupant or a device is refused with a clear message; an empty seat is deleted and its number is not reused.
- [ ] The room detail page lists every seat (code, status, occupant, devices); choosing a row opens the panel at `?seat=<code>`.
- [ ] Assigning to an occupied seat asks "X sits here. Replace with Y?" and on confirm demotes X's primary device.
- [ ] A cannot-seat seat cannot be assigned (server refuses, UI disables).
- [ ] The occupant can release their own seat; others cannot.
- [ ] A seat with no group takes the occupant's group on assign.
- [ ] Unit tests cover assign/replace/release rules and demotion.

## Technical notes
- Files: `src/server/seats/*`, `src/app/api/seats/**`, `src/app/api/rooms/[code]/seats/*`, `src/app/(app)/rooms/[code]/*`, `src/ui/seats/*` (SeatsTable, SeatDetailPanel); reference seatMGT `src/lib/actions/seats.ts` + tests.
- Risks / open questions: —

## Test plan
- Unit: occupancy rules, seat add (counter) and delete guard.
- Manual: assign, replace, release on a seeded room.

## Notes / answers from Ming
- 2026-11-20 (D47): seat add/delete and the seat list fold into this ticket (SIM-010 was already approved); clean UI kit only, no map. The planner may propose a split.

## Handoff

### 2026-11-20 — claude — BACKLOG (board update, D47)
- Done: scope extended per Ming (D47): seat add/delete API, room detail page with a seats table, panel opened via `?seat=<code>`; map work excluded; Size M → L.
- Next: plan after SIM-010 and SIM-011 merge; the planner should consider an API/UI split.

### 2026-11-22 — claude — DONE (API slice)
- Agent calls: 9, tokens 699k, in/out split not reported (api-platform-engineer×1 60k, frontend-developer×1 54k, planner×1 135k, implementer×2 137k, reviewer×2 181k, security-ai-generated-code-auditor×2 134k; models from agent files, no overrides)
- Done: seat API, occupancy rules and tests. Reviewer PASS on attempt 2. Checks green (1195 unit, 51 DB tests). PR: https://github.com/mmlabs-online/simap/pull/41
- In progress / next: Ming decides on the open security 🟡 items and on creating SIM-012.2 (UI) from the plan's split proposal.
- Gotchas: security Attempt 2 says REWORK with no 🔴, so it does not block under the loop rules. The UI halves of AC3-AC6 are not done. Real HTTP with a real Identity token is unverified.
