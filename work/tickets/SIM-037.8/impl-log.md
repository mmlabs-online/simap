# Implementation log — SIM-037.8 (slice 1: sender side)

## Attempt 1

### Files touched
- `src/ui/copy/devices.ts` — transfer / pending / action strings (D36).
- `src/ui/devices/NoteField.tsx` (new) — shared note field extracted from the assign dialog.
- `src/ui/devices/AssignDeviceDialog.tsx` — renders `NoteField`; markup unchanged (its test passes unchanged).
- `src/ui/seats/MemberPickerDialog.tsx` — optional `occupantLabel`, `listLabel` (defaults unchanged).
- `src/ui/devices/transfer-device.ts` (new) — `toTransferBody`, `settleTransfer`, `cancelOutcome`.
- `src/ui/devices/TransferDeviceDialog.tsx` (new) — `TransferDeviceFields` and the dialog.
- `src/ui/devices/devices-api.ts` — `startTransfer`, `cancelHandoff`.
- `src/ui/devices/device-actions.ts` — transfer and cancelTransfer actions, `disabled`, `busyId`.
- `src/ui/devices/DeviceRowActions.tsx` — `busyId`, `disabled`.
- `src/ui/devices/devices-state.ts` — `pendingText`.
- `src/ui/devices/DeviceTable.tsx` — pending chip and "To <name>", `busyId`.
- `src/ui/devices/DevicesView.tsx` — `busyId`, always-mounted notice region.
- `src/ui/devices/DevicesPage.tsx` — transfer dialog, cancel handler, notice, focus.

### Tests added
- New: `transfer-device.test.ts`, `TransferDeviceDialog.test.tsx`.
- Extended: `device-actions.test.ts`, `devices-state.test.ts`, `devices-api.test.ts`, `DevicesView.test.tsx`, `seats/MemberPickerDialog.test.tsx`.

### Checks
- `pnpm format:check`: all matched files use the correct format.
- `pnpm typecheck && pnpm check:layers`: exit 0; "check-layers: 688 files, no violations".
- `pnpm test`: 2629 passed, 2 failed (`scripts/dev-process.test.ts`, `src/app/api/routes-guarded.test.ts`, known flaky under load); re-run alone: 2 files, 26 tests passed.
- `pnpm build`: exit 0.

### Out-of-plan files
None.

### Follow-ups
- Plan inconsistency: the test plan says a non-canonical member id gives "the generic message"; Approach 3 maps `toMemberId` to `pickerNone`. I followed Approach 3 (same as assign) and the test asserts only `kind: "invalid"`.
- Slice 2 (SIM-037.9) as in the plan.

### Scope self-check
Only plan files touched; no slice 2 items; no server, config or DB change.
