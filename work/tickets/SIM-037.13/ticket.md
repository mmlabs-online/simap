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
| PR | #112 |

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
- [x] The detail page shows exactly the actions the device's server flags allow, and each opens the same dialog as on the list.
- [x] After an action the page shows the updated device and history, a notice, and focus returns to the heading.
- [x] All new strings live in `src/ui/copy/*` (D36).

## Technical notes
- See SIM-037.6 plan.md `## Split proposal`. Starting transfer/return/extension depends on the handoff start bug fix (see SIM-037.6 PR #102).

## Test plan
- Pure helpers (`device-detail-actions.ts`, reducer events) + `renderToStaticMarkup` of `DeviceDetailView` for gating, dialog choice, notice and live region; the container's focus and call order are checked by code read and the manual walk. (Reworded from "Component: action gating, dialog open, refresh + notice + focus after done": Vitest runs in node with no DOM and jsdom is not allowed.)

## Notes / answers from Ming
Split from SIM-037.6 by the planner (2026-11-25); added by the orchestrator, Ming to confirm.

## Handoff
- 2026-11-25 implementer: reworded `## Test plan` as the plan asks (no DOM in Vitest). Ming to confirm.

### 2026-11-25 — claude — DONE
- Agent calls: 5 (frontend-developer×1 42k, ux-architect×1 60k, planner×1 92k, implementer×1 69k, reviewer×1 58k; default models). No security audit (UI only).
- Done: detail page action bar (DeviceRowActions without Edit/Delete), six dialogs via DeviceDetailDialogs, silent refresh in the detail/history reducers, always-mounted aria-live notice, focus to h1 after every action, cancel-handoff with busy/acting guards, new detail notice copy. Review attempt 1 PASS; checks green (3125 tests, build ok).
- In progress / next: Ming merges and walks M1-M7 (screen reader: notice announced, focus on the device name after a Transfer); confirm assumptions 1-8 and the reworded test plan line.
- Gotchas: follow-ups — DevicesPage could adopt DeviceDetailDialogs; two dialog error texts still say "The list has been refreshed." (copy/devices.ts:91,104); empty live region adds a gap; rare wrong "could not be updated" notice if Retry is pressed mid-refresh.
