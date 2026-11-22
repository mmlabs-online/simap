# SIM-012.5: Room switcher in the app shell

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P1 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-012.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | claude@2026-11-22T10:06:21Z |
| PR | — |

## Goal
People move between rooms from any signed-in page without going back to the room list.

## Scope reference
- Spec SHL-01 (app shell with role-aware nav).
- `work/tickets/SIM-012.3/ticket.md`: the original AC1, moved here.
- `work/tickets/SIM-012.3/plan.md`, `## Split proposal`, "Settled for SIM-012.5": those defaults apply and are not decided
  again.
- D36, D47.

## Scope
- A thin bar between the header and main content, with a native `<select>` of the org's rooms and a **Go** button.
- A `roomSwitcher?: ReactNode` prop on `AppShellView`, rendered only when there is a session and a switcher. Remove the
  empty `room-switcher` slot from the header.
- A pure `roomCodeFromPath` for `/rooms/<code>` and `/rooms/<code>/edit`, with no `decodeURIComponent`.
- Refetch rooms when the path changes, compared with a `lastPath` ref. Keep the last good list after a failed refetch.
- UI copy in `src/ui/copy/`.

## Out of scope
- Any server, API, schema or migration change, and any change to `useRooms`.
- Seat actions (SIM-012.3, SIM-012.4).
- A floor-level map or any pixel skin (SIM-015.x, D47, D49).

## Acceptance criteria
- [ ] The switcher lists the org's rooms on every signed-in page and preselects the current room on a room page.
- [ ] A room opens only when Go is pressed. Changing the select, including arrow keys on the closed select, does not
      navigate.
- [ ] Go stays focusable and does nothing when the target is empty, already current, or a dot code.
- [ ] A newly created room appears after navigation, and a failed refetch keeps the last good list.
- [ ] The select has an accessible label, and the bar fits at 390 px without crowding the header.
- [ ] Unit tests cover `roomCodeFromPath`, the Go decision and the shell rendering with and without a switcher.

## Technical notes
- Files: `src/ui/AppShell.tsx`, `src/ui/AppShellView.tsx`, a new `src/ui/RoomSwitcher.tsx`, a small pure helper, and UI copy.
- `AppShell` is under `ApiFetchProvider` in both gates. `AppShellView.test.tsx` and `/dev/shell` must render without a
  switcher.
- Go does not use `disabled`, because focus would drop after navigating to the selected room.
- Estimate: about 140 production and 75 test lines.
- Vitest here runs static markup in node, so effects, keyboard behaviour and navigation need a browser.

## Test plan
- Unit: the logic listed in the acceptance criteria.
- Manual: switch rooms by mouse and keyboard, create a room and navigate, simulate a failed refetch, at 390 px and desktop.

## Notes / answers from Ming
- 2026-11-22: Ming asked to create this ticket, moving the room switcher out of SIM-012.3.

## Handoff
