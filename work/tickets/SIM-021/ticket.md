# SIM-021: Go-live checklist and first production deploy

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | S |
| Areas | architecture, security |
| Gate | none |
| Depends on | SIM-004, SIM-009, SIM-015.2, SIM-016, SIM-017, SIM-018, SIM-019.2, SIM-027 |
| Needs Ming | M-1, M-2, M-3 |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
simap runs in production at `simap.mmlabs.online` with a first org, and seatMGT's main flows are checked by hand.

## Scope reference
spec "v1 done means"; D6, D8.

## Scope
- Checklist in `docs/go-live.md`: Identity app settings, tunnel, DB, first release, first org and admin.
- Manual run of seatMGT's flows (sign in, manager assigns, devices, request flow, layout designer) on production; findings become BUG tickets.

## Out of scope
- The release itself (Ming's step).

## Acceptance criteria
- [ ] The checklist exists and every item has an owner.
- [ ] The manual flow run is recorded with results.
- [ ] Bugs found are filed with `/bug`.

## Technical notes
- Files: `docs/go-live.md`, `work/ming-todo.md`.
- Risks / open questions: Light unit tests only (D2): integration bugs show up here.

## Test plan
- Unit: none.
- Manual: the flow run itself.

## Notes / answers from Ming
—

## Handoff
