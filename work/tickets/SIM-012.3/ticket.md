# SIM-012.3: Room switcher, add and delete seats, release and role gating

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P1 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-012.2 |
| Needs Ming | — |
| Attempts | 2 |
| Created | 2026-11-22 |
| Claimed by | claude@2026-11-22T09:11:04Z |
| PR | — |

## Goal
People move between rooms from the shell, Admins add and delete seats, and an occupant releases their own seat, with
each action shown only to the role allowed to use it.

## Scope reference
- `work/tickets/SIM-012.2/ticket.md`: AC3, AC6 and the Release part of the role criteria.
- `work/tickets/SIM-012.2/plan.md`, `## Split proposal` and "Settled for SIM-012.3 and SIM-012.4": those defaults apply and
  are not decided again.
- Spec SEA-01, ROO-02, REG-03 and the room switcher; D22, D30, D36, D47.

## Scope
- Room switcher in a thin bar under the header: a native `<select>` and a **Go** button, with no navigation on `change`.
  It shows on every signed-in page and refetches rooms when the path changes.
- Role gating helpers for this slice's actions. `seat.mine` shows Release, and Admin sees add and delete.
- Admin: add seats (count 1 to 50) with `POST /api/rooms/[id]/seats`.
- Admin: delete a seat with `DELETE /api/seats/[id]`, after confirmation.
- Occupant: release their own seat with `POST /api/seats/[id]/release`, after confirmation.
- One shared confirm dialog for Delete and Release, stacked over the seat panel.
- Reload after every success and after any 404, 409 or 422. Branch on `error.code`, never on status.
- Focus fallback when the control that opened an action no longer exists.
- UI copy in `src/ui/copy/seats.ts`.

## Out of scope
- Any server, API, schema or migration change.
- Member picker, assign, replace, remove and cannot-seat (SIM-012.4).
- Device actions (SIM-013), seat requests (SIM-014), tag editing (SIM-016).
- Any map or pixel skin (SIM-015.x, D47).

## Acceptance criteria
- [ ] The switcher lists the org's rooms and opens the chosen room only when Go is pressed. Arrow keys on the closed
      select do not navigate.
- [ ] Add and Delete appear only for an Admin, and Release appears only on a seat marked `mine`.
- [ ] An Admin adds 1 to 50 seats and the table shows them. An invalid count shows a field error and sends nothing.
- [ ] Deleting an empty seat asks for confirmation, removes it, closes the panel and moves focus to a control that exists.
- [ ] A seat with an occupant or device shows a clear message and is not deleted, including when the server refuses
      after a concurrent change.
- [ ] Release asks for confirmation. If the seat changed meanwhile, the page reloads and says so.
- [ ] Unit tests cover role gating, the count check, the per-action error mapping and the API client.

## Technical notes
- Files: `src/ui/seats/*`, `src/ui/copy/seats.ts`, `src/ui/AppShell.tsx`, `src/ui/AppShellView.tsx`, a new room switcher
  component in `src/ui`.
- `AppShellView` takes `roomSwitcher?: ReactNode`, so its existing tests render without it.
- Until SIM-013, the UI cannot clear a seat's devices, so the delete message for such a seat has no in-app fix yet.
- Vitest here runs static markup in node, so stacked dialogs, focus and real navigation need a browser.

## Test plan
- Unit: the logic listed in the acceptance criteria.
- Manual: switch rooms by mouse and keyboard; add, delete and release on a local room with seeded data, at 390 px and
  desktop.

## Notes / answers from Ming
- 2026-11-22 (orchestrator): the plan defers the room switcher (AC1) to a proposed SIM-012.5 to keep the slice smaller. Not yet decided by Ming; the PR must state that AC1 is not delivered.
- 2026-11-22: Ming asked to create this ticket from the SIM-012.2 split proposal.

## Handoff
