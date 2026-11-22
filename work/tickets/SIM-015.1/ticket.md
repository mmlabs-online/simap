# SIM-015.1: Room layout tile-grid schema and API

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | db, api, security |
| Gate | plan-approval |
| Depends on | SIM-010, SIM-012, SIM-024.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
A room's map has one clean, saved tile-grid data shape that the read-only view (SIM-015.3) and the editor (SIM-015.2) both
use.

## Scope reference
- Spec LAY "Visual style", LAY-01, LAY-02, LAY-03, SEA-02.
- D41, D43, D48, D49, D55, D58. D43 and D48 supersede D20's free-form geometry.

## Scope
- A forward-only migration adding the room size in tiles and tile placement (tile x/y, rotation 0/90/180/270, sprite key)
  for seats and layout fixtures. SIM-008's free-form columns stay until a later contract migration (R2).
- A validated layout payload in `src/lib`: bounds, whole tiles, the four rotations, known sprite keys, and the manifest's
  blocking rule.
- `GET /api/rooms/{code}/layout` for any org member, with seat status derived and never read from storage.
- `PUT /api/rooms/{code}/layout` for Admin: one save of the room size, the existing seats' placement and the fixtures.
- Every query scoped by the verified token's org (R6), and domain refusals as 409/422 (R7).

## Out of scope
- Any map UI (SIM-015.3) or editor UI (SIM-015.2).
- Creating or deleting seats from the layout save (LAY-02, decided in SIM-015.2's plan).
- Dropping the free-form columns.
- Real art, the Credits page and M-10 (SIM-033).
- Device and pending-request overlays (after SIM-013 and SIM-014).

## Acceptance criteria
- [ ] The migration is forward-only, and the previous image keeps working after it is applied.
- [ ] GET returns the room size, each seat's placement and derived status, and the fixtures, for the caller's org only.
- [ ] A room with no saved layout returns a usable default, and its seats stay reachable.
- [ ] PUT is Admin-only, and a valid layout survives a reload.
- [ ] An out-of-bounds, overlapping, wrongly rotated or unknown-sprite payload, or a seat from another room or org, is
      refused and saves nothing.
- [ ] Unit tests cover the payload validation, and DB integration tests cover org scoping and the save.

## Technical notes
- Files: `db/migrations/*`, `src/lib/validate/*`, `src/server/layout/*`, `src/app/api/rooms/[code]/layout/*`.
- High path (`db/migrations/**`), so the plan needs Ming's approval.
- Risks / open questions: concurrent saves by two Admins, and how existing seats get a default placement.

## Test plan
- Unit: layout validation.
- DB: `pnpm schema:check`, `pnpm test:db`.
- Manual: none in a browser, because this ticket has no UI.

## Notes / answers from Ming
- 2026-11-20 (D47): BLOCKED — waiting for pixel-art decisions (D41–D46). Do not start until Ming lifts it; the map tickets bring the tile-grid model and are re-scoped then.
- 2026-11-22 (D58): Ming lifted D47 for the room map tickets and accepted the proposed order. This ticket is re-scoped to the schema and API; the read-only view moved to SIM-015.3.

## Handoff

### 2026-11-20 — claude — BLOCKED (board update, D47)
- Done: set BLOCKED on Ming's instruction (2026-11-20): the room map becomes pixel art; art style and tile size are not decided (D41–D46 on branch `claude/confident-cerf-67q5le`).
- Next: wait for Ming; re-scope against D41–D46 before planning. Seat add/delete without the map moved to SIM-012.

### 2026-11-22 — claude — BACKLOG (re-scope, D58)
- Done: unblocked and re-scoped to the tile-grid schema and API. The original free-form scope is in git history.
- Next: `/run SIM-015.1`; stops at plan approval.
