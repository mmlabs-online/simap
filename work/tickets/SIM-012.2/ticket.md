# SIM-012.2: Room detail page, seat table and seat panel

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-012 |
| Needs Ming | — |
| Attempts | 1 |
| Created | 2026-11-22 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/42 |

## Goal
Everyone opens a room and sees its seats as a list with full seat detail. Admins add and delete seats, Managers manage
occupants and the cannot-seat flag, and occupants release their own seat, all without the pixel map.

## Scope reference
- `work/tickets/SIM-012/ticket.md`: AC3, the UI halves of AC4, AC5 and AC6, and the manual test.
- `work/tickets/SIM-012/plan.md`, `## Split proposal`: its 12 settled defaults apply and are not decided again.
- `work/tickets/SIM-012/consult-frontend-developer.md`.
- Spec SEA-01..05, ROO-02, DEV-06, REG-03 and the room switcher; D18, D22, D26, D32, D36, D47, D52.

## Scope
- Room detail page at `/rooms/[roomCode]`, resolving the code to an id from `GET /api/rooms`, with a not-found state.
- Seat table (code, status, occupant, devices) with loading, empty, error and `truncated` states.
- Seat panel at `?seat=<code>` with occupant, devices, read-only tags and the cannot-seat reason.
- Admin: add and delete seats.
- Manager+: assign, replace with confirmation, remove, and set or clear cannot-seat with a required reason.
- Occupant: release their own seat.
- Active-member picker over `GET /api/members?status=active`.
- Room switcher in the shell, and a link from the room card to the detail page.
- UI copy in `src/ui/copy/seats.ts`.

## Out of scope
- Any server, API, schema or migration change (SIM-012).
- Any map, canvas, sprite, avatar or pixel skin (SIM-015.x, D47).
- Device actions (SIM-013), seat requests (SIM-014), tag editing (SIM-016).

## Acceptance criteria
- [ ] The room detail page lists every seat (code, status, occupant, devices). Choosing a row opens the panel at
      `?seat=<code>`, Back closes it, and a refresh restores it.
- [ ] An unknown room code, or a seat code not in this room, shows a not-found state.
- [ ] Each action appears only for the role allowed to use it, and a seat marked `mine` shows Release.
- [ ] Assigning to an occupied seat asks "X sits here. Replace with Y?". If the occupant changed meanwhile, the page
      reloads and asks again with the current name.
- [ ] A cannot-seat seat shows its reason and has Assign disabled. Setting the flag requires a reason.
- [ ] Deleting a seat with an occupant or device shows a clear message and leaves the seat in place.
- [ ] The page works at 390 px and by keyboard, and status is not shown by colour alone.
- [ ] Unit tests cover role gating, the `?seat` parser, replace-confirm text, the API client and the view states.

## Technical notes
- Files: `src/app/(app)/rooms/[roomCode]/page.tsx`, `src/ui/seats/*`, `src/ui/copy/seats.ts`, `src/ui/index.ts`,
  `src/ui/rooms/RoomCard.tsx`, and the shell for the room switcher.
- `useSearchParams` is new in `src/ui`, so wrap it in `<Suspense>`.
- `SeatDetailPanel` stays props-driven with no map assumptions, so a later pixel skin can wrap it (D52).
- Clip the cannot-seat reason visually, because stacked combining marks can draw over nearby UI (SIM-012 security).
- Risks: stale data after a concurrent change; picker height inside the dialog at 390 px.

## Test plan
- Unit: the logic listed in the acceptance criteria.
- Manual: assign, replace, release, cannot-seat, add and delete on a seeded local room, at 390 px and desktop, by
  keyboard.

## Notes / answers from Ming
- 2026-11-22: Ming asked to create this ticket from the SIM-012 split proposal.

## Handoff

### 2026-11-22 — claude — DONE (slice 1, read path)
- Agent calls: 6, tokens 467k plus reviewer Attempt 2 (usage not reported when this entry was written) (frontend-developer×1 73k, planner×1 155k, implementer×2 141k, reviewer×2 100k + pending; models from agent files, no overrides)
- Done: room page, seat table, panel at `?seat`, not-found states and room card link. Review PASS on attempt 2. Checks green (1368 tests). PR: https://github.com/mmlabs-online/simap/pull/42
- In progress / next: Ming decides whether to create SIM-012.3 and SIM-012.4 from the plan, and runs browser checks B1-B4.
- Gotchas: no write action shipped. No agent opened a browser, so native dialog, focus, Back and layout are unverified.
