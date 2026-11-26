# SIM-051: Answer 404 for write actions on a device a User does not hold

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | S |
| Areas | api, security |
| Gate | none |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/128 |

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
- Plan approved (2026-11-26, batch 2026-11-26-2): "duyệt hết theo mặc định"; plan assumptions accepted (handoff party keeps 422, no member row = holds nothing).

## Handoff

### 2026-11-26 — claude — DONE
- Agent calls: 4, ~214k tokens (planner×1 sonnet 48k, implementer×1 default 65k, reviewer×1 default 51k, security-ai-generated-code-auditor×1 default 50k; consult skipped, fast lane; batch 2026-11-26-2).
- Done: hidden-device/handoff 404 for Users on edit, place, transfer, return, extension, cancel, decline, confirm; tests; review PASS attempt 1; PR #128.
- In progress / next: Ming merges PR #128; consider a follow-up for the device dialogs treating `not_found` as done, and the inventory-number oracle (security F1).
- Gotchas: unowned device now 404 for Users (was 422 `device_unowned`).
