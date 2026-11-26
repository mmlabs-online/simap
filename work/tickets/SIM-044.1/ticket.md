# SIM-044.1: Limit device data in seat, member and layout responses for Users

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | api, architecture, security |
| Gate | plan-approval |
| Depends on | SIM-044 |
| Needs Ming | M-88 |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T05:09Z |
| PR | — |

## Goal
Seat, member and layout responses no longer reveal other members' devices to a User (slice B of SIM-044, D69).

## Scope reference
`docs/spec-v1.md` DEV-12, SEA-05, MEM-02, LAY-06; D69. OQ-55 and OQ-58 spec defaults (approved with SIM-044's plan,
2026-11-26). Design: `work/tickets/SIM-044/plan.md` → "Split proposal", slice B; consults in `work/tickets/SIM-044/`.

## Scope
- Seats: `seatRows` / `loadSeat` / `getSeat` / `listRoomSeats` / `releaseSeat` take the device visibility; for a User
  the `devices` list holds only their own devices, `deviceCount` stays the total (panel shows "N more devices are not
  shown.").
- Members: for a User, other members' rows get `devices: []` and `deviceCount: null` in SQL; own row unchanged; UI shows
  a dash for null.
- Layout: no code change; a DB test locks the User shape (only `type` + `deviceType`).

## Out of scope
- Other members' email for Users (follow-up); write-action existence oracle (follow-up).

## Acceptance criteria
- [ ] For a User, seat detail, room seat list and the release response list only devices they hold; `deviceCount` is the total.
- [ ] Manager and Admin seat responses are unchanged.
- [ ] For a User, `GET /api/members` and `/api/members/[id]` give other members `devices: []` and `deviceCount: null`; their own row is unchanged.
- [ ] Layout responses for a User carry only `type` and `deviceType` per seat device (DB test).
- [ ] Per-tier unit and DB tests for seats, members and layout.

## Technical notes
- Files: `src/server/seats/seats.ts`, `src/app/api/seats/**`, `src/app/api/rooms/[id]/seats/route.ts`,
  `src/server/members/manage.ts`, `src/app/api/members/**`, `src/lib/members/types.ts`, `src/ui/members/MembersView.tsx`,
  `src/ui/copy/members.ts`, `src/ui/seats/SeatDetailPanel.tsx` (primary-device copy), tests.
- Known UX gap: "Primary device: None" when the primary belongs to someone else (copy tweak here).

## Test plan
- DB: `seats.db.test.ts`, `manage.db.test.ts`, `layout.db.test.ts`; route tests.

## Notes / answers from Ming
Waiting for Ming: plan approval (P1 gate)
- Plan approved (2026-11-26), Ming: "duyệt SIM-044.1, dùng mặc định" — all six defaults in plan.md "Questions for Ming at approval".

## Handoff

### 2026-11-26 — claude — BLOCKED
- Agent calls: 1 (planner×1 default). Consult skipped: SIM-044's consults and plan "Split proposal" cover slice B.
- Done: plan.md READY (~90 lines product, ~250 tests; no High path).
- In progress / next: Ming approves the plan (6 questions with defaults), then implement.
- Gotchas: none.
