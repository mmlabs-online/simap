# SIM-012.6: Remove occupant and set or clear cannot-seat

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-012.4 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | claude@2026-11-22T11:01:04Z |
| PR | — |

## Goal
Managers and Admins can remove an occupant from a seat and block or unblock a seat with a reason, from the seat panel.

## Scope reference
- Spec SEA-01, SEA-03, DEV-06; D18, D26, D32, D36, D47.
- `work/tickets/SIM-012.4/ticket.md`: the remaining parts of AC1, AC6 and AC8.
- `work/tickets/SIM-012.4/plan.md`, `## Split proposal`, "Settled for SIM-012.6": those defaults apply and are not decided
  again.

## Scope
- Remove the occupant after confirmation with `PUT /api/seats/[id]/occupant` and `{memberId: null, expectedOccupantId}`,
  using the occupant id that was shown.
- Remove stays available on a cannot-seat seat. On `occupant_changed`: reload and show a message, with no re-ask and no
  retry. On `not_found`: close and reload.
- A Manager or Admin who is the occupant sees Release, not Remove.
- Set cannot-seat with `PATCH /api/seats/[id]/cannot-seat`, on empty and occupied seats. The reason is a single-line
  field without `maxLength`, checked with `validateCannotSeat`, and the validator's value is what is sent. On an occupied
  seat the dialog says the occupant stays until removed.
- Clear cannot-seat with exactly `{cannotSeat: false}`, after a small confirmation.
- UI copy in `src/ui/copy/seats.ts`.

## Out of scope
- Any server, API, schema or migration change.
- Accent-insensitive member search (DSH-02).
- A hook test harness.
- Device actions (SIM-013), seat requests (SIM-014), tag editing (SIM-016).
- Any map or pixel skin (SIM-015.x, D47).

## Acceptance criteria
- [ ] Remove and the set and clear cannot-seat actions appear only for Manager and Admin.
- [ ] A Manager or Admin who is the occupant sees Release, not Remove.
- [ ] Remove asks for confirmation and sends the shown occupant id. If the occupant changed, the page reloads, shows a
      message and sends nothing more.
- [ ] Setting cannot-seat requires a valid reason. An invalid reason shows a field error and sends nothing.
- [ ] Clearing cannot-seat asks for confirmation and sends exactly `{cannotSeat: false}`.
- [ ] Unit tests cover the role gating, the reason check, the Remove and cannot-seat request bodies and their refusal
      outcomes.

## Technical notes
- Files: `src/ui/seats/*`, `src/ui/copy/seats.ts`.
- Clearing loses the reason for good, because the audit row stores only `hasReason`. Changing a reason is clear then set,
  and PATCH has no concurrency token, so the last write wins.
- Vitest here runs static markup in node, so dialogs, focus and real concurrency need a browser.
- Estimate: about 200 production lines.

## Test plan
- Unit: the logic listed in the acceptance criteria.
- Manual: remove, set and clear cannot-seat on a local room with seeded data; a concurrent change from a second tab;
  390 px and desktop.

## Notes / answers from Ming
- 2026-11-22: Ming asked to create this ticket from the SIM-012.4 split proposal and run it.

## Handoff
