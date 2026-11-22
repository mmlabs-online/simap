# SIM-015.5: Save a room layout through the API

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | M |
| Areas | api, security |
| Gate | none |
| Depends on | SIM-015.4 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | — |

## Goal
An Admin can save a whole room layout in one safe step, without losing another Admin's work.

## Scope reference
- Spec LAY-01, LAY-03, SEA-02.
- D43, D48, D58, D59.
- `work/tickets/SIM-015.1/plan.md`: `## API contract` (PUT, `LayoutSave`, error codes, PUT transaction) and choices
  A1-A14. These are approved and are not decided again.

## Scope
- `PUT /api/rooms/{id}/layout` for Admin, with a 256 KiB body limit, validated before any transaction.
- One transaction in the plan's lock order: room, seats, seat placement, placed fixtures, room grid and floors, version,
  one counts-only audit row.
- Refusals `layout_stale`, `layout_seats_changed` and `layout_too_many_seats`.

## Out of scope
- Creating or deleting seats through the save (LAY-02, decided in SIM-015.2's plan).
- Any migration or editor UI.

## Acceptance criteria
- [ ] PUT is Admin-only, and a valid layout survives a reload.
- [ ] A refused payload, or a seat from another room or org, saves nothing.
- [ ] A stale `baseVersion` returns 409 `layout_stale`, and of two concurrent saves only one succeeds.
- [ ] A changed seat set returns 409 `layout_seats_changed`, with the same answer for a foreign seat id.
- [ ] A save never changes occupants, status, `seat_counter`, devices or legacy fixture rows.
- [ ] Auth codes come only from the wrapper, and domain refusals are 409 or 422 (R7).
- [ ] DB integration tests cover rollback, org scoping, stale and concurrent saves.

## Technical notes
- Files: `src/server/layout/*`, `src/app/api/rooms/[id]/layout/route.ts`, `src/lib/api/error.ts`, `src/ui/copy/api.ts`.

## Test plan
- Unit: route refusal mapping.
- DB: `pnpm test:db`.
- Manual: none in a browser, because this ticket has no UI.

## Notes / answers from Ming
- 2026-11-22 (D59): split from SIM-015.1; Ming approved the split and defaults A1-A14.

## Handoff
