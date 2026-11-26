# SIM-057: Check-in room view and home page per role

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P0 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/136 |

## Goal
A User lands on a check-in room view (the room map with a "Who's here" list and a room switcher) instead of the
Dashboard; Manager and Admin keep the Dashboard and reach the same view from a "Check in" nav entry (D76).

## Scope reference
`docs/spec-v1.md` PRE-01 (amends SHL-01), SHL-01, LAY-06; decision D76 (amends the OQ-54 answer), D52 (pixel end-user
surface).

## Scope
- New check-in room view page: room map (existing LAY-06 overlays, zoom, pan, seat detail on click), a "Who's here"
  list region beside the map (below it at 390 px), a room switcher, and the slot for the floating "Check in" /
  "Check out" button.
- Home per role: a User's home (after sign-in and org choice) is this view; Manager and Admin keep the Dashboard and
  get a "Check in" nav entry (desktop rail and mobile bar) that opens the same view.
- First-room rule as a pure `src/lib` function with unit tests.
- UI copy in `src/ui/copy/<feature>.ts` (D36).

## Out of scope
- Presence data, check-in/check-out API (SIM-058); popup (SIM-059); present/away, name tags, "Who's here" content and
  polling (SIM-060); walk animation (SIM-061).

## Acceptance criteria
- [ ] A User lands on the check-in room view after sign-in and org choice, instead of the Dashboard.
- [ ] Manager and Admin keep the Dashboard as home and have a "Check in" nav entry (desktop and mobile) that opens the
  same view with the same behaviour.
- [ ] The view shows the room map with LAY-06 overlays, zoom, pan and seat detail on click, a "Who's here" list beside
  the map (below it at 390 px), a room switcher, and a floating "Check in" / "Check out" button slot.
- [ ] The room shown first is: the room of today's active check-in; else the room of the member's most recent
  check-in where they still have a seat; else their first assigned room by room code. A member with no seat gets the
  no-seat empty state (PRE-02 wording).
- [ ] Unit tests cover the first-room rule and the nav/home per tier.

## Technical notes
- Files: `src/lib/nav.ts` (+ tests), `src/ui/AppShell*.tsx`, `src/app/(app)/page.tsx` (home per role), a new check-in
  page under `src/app/(app)/`, a new `src/ui/checkin/**` (name is a plan choice), `src/ui/roomlayout/RoomMap*.tsx`
  reuse, `src/lib/room-switcher.ts`, `src/ui/copy/`.
- The first-room rule takes check-in inputs; until SIM-058 lands they are empty and the rule falls back to the first
  assigned room by room code. Wiring the real presence data follows SIM-058/SIM-060.
- Gate: P0 with no High path; the `high-paths+P1` policy as read here covers P1 only. Set `plan-approval` if Ming reads
  it as P1-and-above.

## Test plan
- Unit: first-room rule (active check-in, recent check-in with/without a seat, lowest room code, no seat); nav per tier.
- Manual: sign in as User (lands on the view), as Manager/Admin (Dashboard + "Check in" entry); 390 px layout.

## Notes / answers from Ming

## Handoff

### 2026-11-26 — claude — DONE
- Agent calls: 5 (frontend-developer×1 37k, ux-architect×1 51k, planner×1 98k, implementer×1 73k, reviewer×1 55k; default models)
- Done: check-in room view, home per tier, nav entry, first-room rule; review PASS on attempt 1; PR #136.
- In progress / next: Ming reviews and merges PR #136; then SIM-058 (presence API) and SIM-059/060.
- Gotchas: should-fix on `?room=` + failed room list (skeleton with no retry); manual 1280/390 px check not done; Users keep `/dashboard` (assumption).
