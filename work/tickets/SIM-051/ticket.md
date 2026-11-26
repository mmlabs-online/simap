# SIM-051: Answer 404 for write actions on a device a User does not hold

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P2 |
| Size | S |
| Areas | api, security |
| Gate | none |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-26T08:09Z |
| PR | — |

## Goal
A User acting on a device they do not hold gets the same 404 as for an unknown id, so writes no longer reveal that a
device exists (follow-up Q10 of SIM-044).

## Scope reference
`docs/spec-v1.md` DEV-12 (404 for devices not held, same as SYS-01 cross-org); D69. Follow-up from
`work/tickets/SIM-044/plan.md` Q10.

## Scope
- Device write routes (edit, place/move, transfer, return, extension, cancel handoff, …): for a User, a device whose
  current owner is not their member answers 404 `not_found` instead of 422 `not_allowed`, before any side effect.
- PATCH inventory-number conflict (409) must not be reachable for a device the User does not hold.
- Pending incoming transfer: the recipient's confirm/decline path keeps working (handoff routes, not device detail).

## Out of scope
- Manager/Admin (unchanged); read paths (done in SIM-044).

## Acceptance criteria
- [ ] For a User, every device write on a device they do not hold answers 404 with the same body as an unknown id; nothing is written or audited.
- [ ] A User acting on their own device behaves as today.
- [ ] The recipient of a pending transfer can still confirm/decline it.
- [ ] Manager and Admin get today's codes.
- [ ] Route and DB tests per action and tier.

## Technical notes
- Files: `src/server/devices/devices.ts` (`not_allowed` refusals l.398/461/502/565/615), `src/server/devices/handoffs.ts`, `src/lib/devices/visibility.ts`, route tests.
- Risk: R7 — 404 is a domain code; keep it before any write.

## Test plan
- Unit + DB: each write per tier (own, other's, unowned, unknown id).

## Notes / answers from Ming

## Handoff
