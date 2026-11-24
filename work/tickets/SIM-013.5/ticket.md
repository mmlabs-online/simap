# SIM-013.5: Device delete dialog with Move to inventory

| Field | Value |
|---|---|
| State | BLOCKED |
| Priority | P1 |
| Size | S |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-013.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | — |

## Goal
Members delete their devices; a device at a seat is moved to inventory first (D31).

## Scope reference
spec DEV-01, DEV-02; D31, D36. Split out of SIM-013.2 by its approved plan (`work/tickets/SIM-013.2/plan.md` → Split proposal and the choices it records for later slices).

## Scope
- `DeleteDeviceDialog` with pure `delete-device-flow.ts`: opens in the placed step when the row shows a seat; a 409 `device_placed` also moves to it (then `GET /api/devices/:id` to learn the seat).
- "Move to inventory" = `PUT /api/devices/:id/placement` `{seatId: null, expectedSeatId}`; after it, an explicit "Delete device" confirm (never an automatic delete). `placement_changed` reloads; `not_found` closes and reloads.
- Delete button only where `canEdit`.

## Out of scope
- Place, move and return dialog (SIM-013.3). Any server or API change.

## Acceptance criteria
- [ ] Deleting an inventory device works after a confirm.
- [ ] Deleting a placed device offers "Move to inventory" and then an explicit delete confirm.
- [ ] Stale placement (`placement_changed`) and a device removed elsewhere are handled without a silent delete.
- [ ] Pure-logic and static-render tests (no jsdom) cover the delete flow steps.

## Technical notes
- Builds on `src/ui/devices/*` from SIM-013.2 and the merged device API. UI copy in `src/ui/copy/devices.ts` (D36). Whichever of SIM-013.3/.4/.5 lands first adds the row-actions column.

## Test plan
- Unit: delete-device-flow; static render of the dialog steps.
- Manual: delete an inventory device; delete a placed device.

## Notes / answers from Ming
Waiting for Ming: plan approval (P1 gate, M-38)

## Handoff

### 2026-11-24 — claude — BLOCKED
- Agent calls: 2, tokens ~109k total (frontend-developer×1 default 40k, planner×1 default 69k)
- Done: consult (consult-frontend-developer.md), plan.md Status READY, no split (~260 src + ~220 test lines), no High path.
- In progress / next: Ming approves the plan (M-38), then IMPLEMENT. The branch is stacked on ticket/SIM-013.4; rebase onto main (`git rebase --onto origin/main origin/ticket/SIM-013.4`) once PR #63 is merged.
- Gotchas: local shell needs Node via fnm (`fnm use 22`); no Python.
