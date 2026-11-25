# SIM-037.13: Device detail page: viewer actions

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | M |
| Areas | ui, ux |
| Gate | none |
| Depends on | SIM-037.6 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/113 |

## Goal
A viewer can act on a device from its detail page (transfer, return, assign, and the other actions their flags allow) without going back to the list.

## Scope reference
docs/spec-v1.md §6 DEV-11; slice 2 split from SIM-037.6 (its plan.md `## Split proposal`).

## Scope
- Render `DeviceRowActions` on the detail page with `onTransfer`, `onReturn`, `onAssign`, plus `onExtend`, `onCancelHandoff`, `onTakeBack`, `onEditHolding`, `onPlace`.
- Mount the existing dialogs (Transfer, Return, Assign, Extend, TakeBack, Place).
- On done: refresh the device and the first history page, show the existing `devicesCopy.*.sent` notices in an `aria-live` region, focus the `h1`.
- Decide whether to extract a shared `useDeviceDialogs` from `DevicesPage`.

## Out of scope
- Edit / Delete (stay on the list page).

## Acceptance criteria
- [ ] The detail page shows exactly the actions the device's server flags allow, and each opens the same dialog as on the list.
- [ ] After an action the page shows the updated device and history, a notice, and focus returns to the heading.
- [ ] All new strings live in `src/ui/copy/*` (D36).

## Technical notes
- See SIM-037.6 plan.md `## Split proposal`. Starting transfer/return/extension depends on the handoff start bug fix (see SIM-037.6 PR #102).

## Test plan
- Component: action gating, dialog open, refresh + notice + focus after done.

## Notes / answers from Ming
Split from SIM-037.6 by the planner (2026-11-25); added by the orchestrator, Ming to confirm.

## Handoff

### 2026-11-26 — claude — DONE
- Agent calls: 5, tokens ~285k total (in/out split not reported): frontend-developer×1 37k, ux-architect×1 44k, planner×1 77k, implementer×1 76k, reviewer×1 51k, all on default models.
- Done: added viewer actions to the detail page, with a silent refresh, a notice and focus back to the h1. The dialog wiring is copied (A1); `DevicesPage` is unchanged. Attempt 1 PASS, no security trigger (UI only). PR #113.
- In progress / next: Ming confirms A1–A7 and merges #113. Follow-up: extract a shared dialogs host.
- Gotchas: the consultants disagreed on extract vs copy; the planner chose to copy. The CI `image` job fails on every branch because of SIM-034's `/Users/mingming` check (BUG-006 to file).
