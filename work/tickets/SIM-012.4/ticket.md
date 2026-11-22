# SIM-012.4: Member picker, assign, replace, remove and cannot-seat

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P1 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-012.3 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | claude@2026-11-22T10:26:31Z |
| PR | — |

## Goal
Managers and Admins seat people safely from the seat panel: assign, replace with confirmation, remove, and block a seat
with a reason.

## Scope reference
- `work/tickets/SIM-012.2/ticket.md`: AC3, AC4 and AC5.
- `work/tickets/SIM-012.2/plan.md`, `## Split proposal` and "Settled for SIM-012.3 and SIM-012.4": those defaults apply and
  are not decided again.
- Spec SEA-01, SEA-03, DEV-06; D18, D26, D32, D36, D47.

## Scope
- Active-member picker over `GET /api/members?status=active`: debounced search, stale responses dropped, a radio list
  with name and employee code, and "Load more" by cursor.
- Assign and replace with `PUT /api/seats/[id]/occupant`, always sending `expectedOccupantId`.
- Replace confirmation: "X sits here. Replace with Y?", with the shown occupant's id and name kept in one snapshot.
- Re-ask after `occupant_changed`, as settled in the plan. Never resend without a new confirmation.
- Remove the occupant with `{memberId: null, expectedOccupantId}`, after confirmation.
- Set or clear cannot-seat with `PATCH /api/seats/[id]/cannot-seat`. The reason is a single-line field validated with
  `validateCannotSeat`.
- Role gating for these actions (Manager+). A Manager who is the occupant sees Release, not Remove.
- UI copy in `src/ui/copy/seats.ts`.

## Out of scope
- Any server, API, schema or migration change.
- Device actions (SIM-013), seat requests (SIM-014), tag editing (SIM-016).
- Any map or pixel skin (SIM-015.x, D47).

## Acceptance criteria
- [ ] Assign, Replace, Remove and cannot-seat actions appear only for Manager and Admin.
- [ ] The picker lists active members, searches by name, loads more, and pressing Enter in search does not submit.
- [ ] Assigning to an empty seat updates the table and panel.
- [ ] Assigning to an occupied seat asks "X sits here. Replace with Y?".
- [ ] If the occupant changed meanwhile, the page reloads and asks again with the current state and sends nothing until
      confirmed.
- [ ] A cannot-seat seat shows its reason and has Assign disabled. Setting the flag requires a valid reason.
- [ ] A member who became unassignable is refused with a message, the picker reloads and the dialog stays open.
- [ ] Unit tests cover role gating, the re-ask decision, replace text, the reason check, the picker's stale handling and
      the API client.

## Technical notes
- Files: `src/ui/seats/*`, `src/ui/copy/seats.ts`.
- The picker list needs its own `max-h` in `dvh` with `overflow-y-auto`, because `EntityFormDialog` has no scrolling body.
- "Load more" must be `type="button"`, and `q` is at most 80 characters.
- Vitest here runs static markup in node, so stacked dialogs, focus and real concurrency need a browser.

## Test plan
- Unit: the logic listed in the acceptance criteria.
- Manual: assign, replace, remove and cannot-seat on a local room with seeded data; a concurrent change from a second tab;
  390 px and desktop.

## Notes / answers from Ming
- 2026-11-22: Ming asked to create this ticket from the SIM-012.2 split proposal.

## Handoff
