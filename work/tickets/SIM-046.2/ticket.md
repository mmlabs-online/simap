# SIM-046.2: Profile photos in member lists, member card and seat panel

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P3 |
| Size | M |
| Areas | ui, api |
| Gate | none |
| Depends on | SIM-046, SIM-044.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T09:38Z |
| PR | — |

## Goal
Other members' photos appear where people are listed (Members list, member card, seat panel occupant row), and a Manager+ can remove a member's photo from the member card (SIM-046 slice 3).

## Scope reference
- Split off from the parent plan (batch 2026-11-26-1, Ming 2026-11-26: "duyệt hết theo mặc định"). See the parent's
  plan.md "Split proposal" for the exact files; the parent ticket's acceptance criteria and spec references apply.

## Scope
- `hasPhoto` / `photoVersion` on `MemberDto` (`manage.ts` `memberSelect`) and on the seat occupant (`seats.ts` `seatRows`).
- A list photo cache (reuse `createImageUrlCache`, concurrency 4; failures fall back to initials).
- Photo in the Members list, member card and seat panel occupant row; "Remove photo" on the member card for Manager+.

## Out of scope
- Anything the parent slice already ships; server, schema and API changes (none needed).

## Acceptance criteria
- [ ] Members list, member card and seat panel show the member's photo, or initials when none or on failure.
- [ ] A Manager+ can remove another member's photo from the member card; a User does not see the action.
- [ ] No Drive file id is exposed in any response.
- [ ] All Checks pass.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-3): "duyệt hết theo mặc định"; Q2 default: Remove photo stays visible on own card (F4 follow-up).

## Handoff
