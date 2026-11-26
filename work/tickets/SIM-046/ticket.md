# SIM-046: A User places devices only on seats they occupy

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | S |
| Areas | api, security |
| Gate | none |
| Depends on | — |
| Needs Ming | M-81 |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

## Goal
A User can place or move their devices only onto a seat they occupy, so devices are not parked on other people's
seats (Ming, 2026-11-26).

## Scope reference
**Conflicts with the spec.** `docs/spec-v1.md` DEV-04 "The device's owner places it as secondary on **any** seat" and
DEV-03 "Secondary placement has no ownership check beyond the device having an owner"; DEV-05 (moves follow DEV-03).
D19 (Manager+ move any owned device) is kept. The ticket supersedes DEV-04 for the User tier once Ming confirms M-81;
the spec change (DEV-03/04/05 and a new D-entry) ships with this ticket.

## Scope
- Placement rule for the User tier: the target seat's occupant must be the caller's member, for primary and secondary.
- Same rule for move (seat to seat); moving back to the owner's inventory stays allowed.
- Refusal as a domain error (422, e.g. `seat_not_yours`) before any write (R7).
- UI seat pickers for a User list only the seats they occupy; the server is the guard.
- Spec: amend DEV-03, DEV-04, DEV-05; add the decision to `work/decisions.md`.

## Out of scope
- Manager+ placement (D19 unchanged: any owned device on any seat).
- Moving devices already lent to other seats (proposed default: they stay until next moved; no data change).
- Auto-return when the User leaves the seat (DEV-06 unchanged).

## Acceptance criteria
- [ ] A User placing or moving their device onto a seat whose occupant is not their member gets 422 `seat_not_yours`
  (name per plan) and nothing is written or audited.
- [ ] A User placing onto a seat they occupy works as today (primary rules of DEV-03 unchanged).
- [ ] A User can still move their device back to their inventory from any seat it sits on.
- [ ] Manager and Admin can still place any owned device on any seat (D19).
- [ ] For a User, the seat picker in the device actions offers only seats they occupy; with none, it says so.
- [ ] Unit tests for the placement decision per tier (own seat, other's seat, empty seat, inventory).
- [ ] DEV-03/04/05 in the spec and a new D-entry describe the rule.

## Technical notes
- Files: `src/lib/devices/*` (`decidePlacement`), `src/server/devices/devices.ts`, `src/ui/devices/**` (seat picker),
  `src/ui/copy/*`, `docs/spec-v1.md`, `work/decisions.md`.
- Risks / open questions (M-81): an empty seat counts as "not yours" (default yes); does the rule also bind Managers
  for their own devices (default no, D19); what happens to devices a User already lent to other seats (default: left
  as they are).

## Test plan
- Unit: `decidePlacement` per tier and seat ownership; route test for the 422.
- Manual: as User, try another member's seat and own seat; as Manager, any seat.

## Notes / answers from Ming

## Handoff
