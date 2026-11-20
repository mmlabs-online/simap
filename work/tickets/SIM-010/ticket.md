# SIM-010: Rooms: CRUD, seat codes and room list

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | api, ui, db |
| Gate | none |
| Depends on | SIM-003, SIM-005, SIM-008 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-20T07:24:39Z |
| PR | — |

## Goal
Admins manage the org's rooms, seat codes stay consistent automatically, and everyone sees the room list with occupancy.

## Scope reference
spec ROO-01, ROO-02, SYS-02, SYS-03; D29, D30.

## Scope
- Routes: list (all), create/edit/delete (Admin); delete impact + forced delete as seatMGT `deleteRoom(force)`.
- Seat code generation from the room counter (never reused, D30); room code change regenerates seat codes in one transaction (D29).
- Rooms page with room cards and occupancy ring ported from seatMGT.
- Audit row for every change.

## Out of scope
- Seat detail (SIM-012), layout (SIM-015.x).

## Acceptance criteria
- [ ] A duplicate room code in the same org is refused; the same code in another org is allowed.
- [ ] Renaming `C302` to `C303` renames all its seats to `C303-NN` atomically.
- [ ] Deleting the last seat and adding a new one gives the next number, not the deleted one.
- [ ] Non-Admins get 403 on writes; the UI hides the actions.
- [ ] Unit tests cover code generation, rename mapping and the delete-impact rules.

## Technical notes
- Files: `src/server/rooms/*`, `src/app/api/rooms/**`, `src/app/(app)/rooms/*`, `src/ui/rooms/*`; reference seatMGT `src/lib/actions/rooms.ts`, `src/components/dashboard/*`.
- Risks / open questions: —

## Test plan
- Unit: code generation, rename, delete impact.
- Manual: create/rename/delete rooms as Admin and as User.

## Notes / answers from Ming
- Plan approved (2026-11-20, batch 2026-11-20-2) — Ming: "duyệt hết … còn lại theo đề xuất". Q21: split — this ticket = Slice A (API); Slice B → SIM-010.2 (Rooms UI). Q22: uppercase room codes (already in plan). Others take their defaults. Build only after SIM-023 is merged (uses ctx.scope).
- 2026-11-20 (batch 2026-11-20-2, Q22): Ming: room codes are always uppercase; the input uppercases as the user types and the server stores uppercase. Plan to be revised; plan approval still pending.

## Handoff
