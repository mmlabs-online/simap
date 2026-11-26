# SIM-059: Pixel check-in popup

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-057, SIM-058 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T15:42Z |
| PR | — |

## Goal
A member who has not checked in today gets a pixel-style popup on the room view that lists their rooms and checks
them in with one click, or lets them "Just look".

## Scope reference
`docs/spec-v1.md` PRE-02, PRE-01 (floating button), PRE-03; decisions D52 (pixel end-user surface), D35/D79 (UTC+7),
D76.

## Scope
- Modal popup over the check-in room view; room list with locked rooms; "Check in to <room>" and "Just look";
  no-seat empty state; floating "Check in" / "Check out" button wired to SIM-058.
- Any data the popup needs (per room: seat code, checked-in count, last check-in) from the SIM-058 endpoints, or a
  small read addition if the plan finds one is missing.

## Out of scope
- Walk-in animation (SIM-061; this ticket only triggers the end state); provider skip logic beyond "no popup when
  already checked in from any source" (SIM-063).

## Acceptance criteria
- [ ] A member with no check-in today (from any source) sees a modal popup on arrival, in the room's pixel style
  (pixel frame, title bar in the room's wall colour, 3D pixel buttons, body text in the normal font, D52).
- [ ] It lists every room where the member has a seat: layout thumbnail, room name and code, the member's seat code,
  how many are checked in now, and the member's last check-in there (UTC+7 date and time, or "never"); rooms without
  a seat are listed below, locked, with "Request a seat" opening that room's map for REG-01.
- [ ] Changing the selected room switches the room behind the popup.
- [ ] "Check in to <room>" checks in (PRE-03) and closes the popup; "Just look" closes it without checking in and the
  floating "Check in" button stays; the popup shows once per page load.
- [ ] A member with no seat at all sees "You don't have a seat yet" with "Request a seat" (Rooms page); nothing can be
  checked in.
- [ ] Keyboard-operable and screen-reader labelled (focus trap, Escape = "Just look"); works at 390 px; component
  tests cover show/hide rules, locked rooms and the empty state.

## Technical notes
- Files: `src/ui/checkin/**` (from SIM-057), `src/ui/copy/`, client API wrapper in `src/ui/`/`src/lib/`.
- Gate `plan-approval` because of the `high-paths+P1` policy (P1).

## Test plan
- Unit/component: popup visibility (no check-in, checked in, after "Just look"), room list ordering and lock state,
  Escape, empty state.
- Manual: User with two rooms, check in, reload (no popup); 390 px; keyboard only.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-6): "duyệt hết theo mặc định"; Q1 default (SIM-060 after Ming merges SIM-059); Q2 one PR in two ordered commits (A, B); Q3 global `--px-wall` title bar, per-room colour as follow-up.

## Handoff
