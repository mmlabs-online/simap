## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
Run by the reviewer on `ticket/SIM-013.5` (Node 22 via fnm, `pnpm.cmd`). Every exit code was checked.
- `pnpm format:check`: exit 0. "All matched files use the correct format." (526 files)
- `pnpm typecheck`: exit 0. `next typegen && tsc --noEmit` clean.
- `pnpm check:layers`: exit 0. "check-layers: 472 files, no violations"
- `pnpm test`: exit 0. "Test Files 186 passed (186)", "Tests 1958 passed | 3 skipped (1961)"
- `pnpm build`: exit 0. "Compiled successfully", route table printed.
- `pnpm test:db`: runs in CI only. This ticket has no server or DB change.

These match the impl-log claims (186 files, 1958 passed, 3 skipped; 472 files, no violations).

### Acceptance criteria
- [x] Deleting an inventory device works after a confirm. Evidence:
  - `delete-device-flow.test.ts` › "deleteStep: inventory device → confirm; placed device → placed" and "settleDelete: ok and not_found → done".
  - `DeleteDeviceDialog.test.tsx` › "confirm step: names the device and says it can't be undone; no seat text".
  - `devices-api.test.ts` › "remove sends DELETE /api/devices/<id>; 204 → ok; …".
  - `device-actions.test.ts` › "Delete only when canEdit and onDelete; marked danger; after edit".
  - Code: `DeleteDeviceDialog.tsx:87` (the `confirm` branch of `submit`) is the only call site of `api.remove`.
- [x] Deleting a placed device offers "Move to inventory" and then an explicit delete confirm. Evidence:
  - `delete-device-flow.test.ts` › "settleMove: ok → confirm carrying the returned device (never done)" and "moveBody sends seatId null and the device's current seatId as expectedSeatId".
  - `delete-device-flow.test.ts` › "deleteSubmitLabel per step".
  - `DeleteDeviceDialog.test.tsx` › "placed step: …" and "confirm after a move shows the moved note".
  - Code: the `placed` branch (`DeleteDeviceDialog.tsx:92-102`) calls only `api.place(current.id, moveBody(current))`. On success it sets `current` and `moved` and calls `onStale()`, with no `remove` call.
- [x] Stale placement (`placement_changed`) and a device removed elsewhere are handled without a silent delete. Evidence:
  - `delete-device-flow.test.ts` › "settleMove: not_found → done; placement_changed → refetch with message; other → error", "settleDelete: device_placed → placed with the device_placed message", "settleDelete: not_allowed / unavailable → error with apiErrorMessage" and "afterRefetch: ok → device; not_found → done; other code → error".
  - Code: `refetch()` (`DeleteDeviceDialog.tsx:71-80`) calls only `api.get`. `not_found` → `onDone` closes the dialog and refreshes the list (`DevicesPage.tsx:91-94`).
- [x] Pure-logic and static-render tests (no jsdom) cover the delete flow steps. Evidence:
  - `delete-device-flow.test.ts` makes pure calls.
  - `DeleteDeviceDialog.test.tsx` uses `renderToStaticMarkup`.
  - Neither file imports jsdom or sets a jsdom environment. Both pass in `pnpm test`.
- Delete button only where `canEdit` (ticket scope). Evidence:
  - `device-actions.ts:48` (`onDelete && d.canEdit`).
  - `DevicesView.test.tsx` › "Delete buttons on canEdit rows with aria-label 'Delete device <inv>'".
- Focus after a delete (plan decision). Evidence:
  - `DevicesView.tsx` h1 has `tabIndex={-1}` (test "h1 is focusable (tabindex -1)").
  - `DevicesPage.tsx:93` focuses it after `refresh()` resolves.

Ming verification after merge (not verified here; carry into the PR):
- Local `/devices`, deleting an inventory device: one confirm, the list refreshes, and focus lands on the "Devices" heading.
- Deleting a placed device: the dialog names the seat, then "Move to inventory", then the confirm. If you cancel at the confirm, the row shows "In inventory". Delete again to remove it.
- Delete buttons appear only on your own rows as User/Manager, and on every row as Admin.

### Scope
- Every changed `src/` file is in the plan's file list.
- `work/ming-todo.md` (M-38 plan-approval entry) is the orchestrator's gate bookkeeping, not implementation.
- No High path is touched. No server, API or migration change.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: only `src/ui/**` changed; imports go ui → ui and ui → `@/lib`. `check:layers` is clean.
- R2/R6/R7: no server or schema changes.
- R3: no config or secrets.
- R4: within the plan.
- R5: new logic has tests and the checks are green.
- D36: all copy is in `src/ui/copy/devices.ts`, and the no-literals and copy tests pass.

### Blockers from review agents
None. No review trigger path was changed.

### Nits (do not block)
- `DeleteDeviceDialog.tsx`: if the user closes the dialog while a request is in flight, the async handlers still call `onStale`/`onDone` after unmount. This is harmless (only a list refresh and heading focus), but a later cleanup could guard it with an "active" ref.
- In the `confirm` step, if a `device_placed` refetch finds the device in inventory again (a double race), the dialog stays on confirm and shows the `device_placed` message. This is acceptable because nothing is deleted silently.

### Follow-ups (out of scope)
- Danger-styled submit variant in `EntityFormDialog` for destructive dialogs (plan assumption 2, impl-log follow-up).
