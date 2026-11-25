## Attempt 1 — 2026-11-25

Plan approved by Ming 2026-11-25. The place-mode "Return" label is unchanged (plan default).

### Files touched
| File | Required because |
|---|---|
| `src/ui/devices/devices-api.ts` | `startReturn`, `takeBack`, `listHandoffs`/`pendingReturns`, two-field `handoffCount` |
| `src/ui/devices/return-device.ts` (new) | Pure logic: `toReturnBody`, `settleReturn`, `confirmReturnOutcome`, `settleTakeBack`, `takeBackDone`, `takeBackBody` |
| `src/ui/devices/transfer-device.ts` | `cancelOutcome` takes the handoff kind |
| `src/ui/devices/incoming-transfer.ts` | Export `handoffActionFailed`; focus per list; `badgeCountAfter` with two lists; `badgeTotal`; `handoffBoxes` |
| `src/ui/devices/useIncomingHandoffs.ts` | `useHandoffList(api, box, enabled)`; `useIncomingHandoffs` kept as wrapper |
| `src/ui/devices/device-actions.ts` | `onCancelHandoff` (kind-aware), `onReturn`, `onTakeBack` |
| `src/ui/devices/devices-state.ts` | "Return pending" chip |
| `src/ui/devices/ReturnDeviceDialog.tsx` (new) | Start a return |
| `src/ui/devices/TakeBackDeviceDialog.tsx` (new) | Admin take-back confirmation |
| `src/ui/devices/PendingReturns.tsx` (new) | Admin list of pending returns |
| `src/ui/devices/DevicesPage.tsx` | Wiring: `refreshAll`, `act(list, ...)`, dialogs, `PendingReturns` |
| `src/ui/devices/useHandoffBadge.tsx` | Context holds `{incoming, returns}` |
| `src/ui/AppShell.tsx`, `src/ui/AppShellView.tsx` | Badge sum and `badgeLabels` sr-only override |
| `src/ui/copy/devices.ts`, `src/ui/copy/shell.ts` | D36 copy |
| tests (see below) | Tests |

### Tests added / changed
- `devices-api.test.ts` › handoffCount two fields / defaults; startReturn; takeBack; pendingReturns
- `return-device.test.ts` (new) › toReturnBody, settleReturn, confirmReturnOutcome, settleTakeBack, takeBackDone, takeBackBody
- `transfer-device.test.ts` › existing cancelOutcome cases pass `"transfer"`; new return-kind case
- `incoming-transfer.test.ts` › focusAfter with list, badgeCountAfter with two lists, badgeTotal, handoffBoxes
- `device-actions.test.ts` › rename to `onCancelHandoff`; giveBack, cancelReturn, takeBack, aria, busy cases
- `devices-state.test.ts` › return chip; extension is null
- `ReturnDeviceDialog.test.tsx`, `TakeBackDeviceDialog.test.tsx`, `PendingReturns.test.tsx` (new) › markup
- `AppShellView.test.tsx` › badgeLabels override; devicesBreakdown copy
- `DevicesView.test.tsx` › handler rename only

### Checks (actual output summary)
- typecheck: `pnpm typecheck` exit 0; `pnpm check:layers`: "726 files, no violations"
- format:check: "All matched files use the correct format."
- test: `pnpm test` 2760 passed, 1 failed (`scripts/dev-process.test.ts` "root exits first; the orphan grandchild is still stopped", a process-tree timing test under full-suite load). It is not in the diff; it passes alone with my changes (21/21) and on the base.
- build: `pnpm build` exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- The take-back submit button is not danger-styled (`EntityFormDialog` has no variant), as noted in the plan.
- `scripts/dev-process.test.ts` orphan-grandchild test is flaky under full-suite load on Windows.
- Not run locally: the manual run with seeded data (return, Admin confirm, Admin take-back). Left for the PR review.

### Scope self-check
- Could the diff be smaller? No; the new files mirror their siblings.
- Diff size: about +565 / -125 on modified files, plus 8 new files.
