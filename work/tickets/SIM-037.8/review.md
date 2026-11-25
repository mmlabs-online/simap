## Attempt 1 — 2026-11-25
Verdict: PASS

Scope: slice 1 only (sender side: Transfer action and dialog, pending chip, Cancel transfer, notice region), as approved
with A1-A12. The recipient side (incoming list, Confirm / Decline, nav badge; ticket AC 3 and AC 4 for Confirm /
Decline) is SIM-037.9 and is not judged here. UI only: no `src/server/**`, `src/app/api/**`, `db/**`, config or deploy
file changed, so no review-trigger agent applies.

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (742 files).
- `pnpm typecheck` — exit 0.
- `pnpm check:layers` — exit 0, "check-layers: 688 files, no violations".
- `pnpm test` — exit 0, "Test Files 259 passed | 1 skipped (260)", "Tests 2631 passed | 14 skipped (2645)". The two
  known-flaky files (`scripts/dev-process.test.ts`, `src/app/api/routes-guarded.test.ts`) passed in the full run this
  time; impl-log reported them failing under load and passing alone, which is consistent with the known flake, not a
  mismatch.
- `pnpm build` — exit 0.
- `pnpm test:db` — not run (CI-only, needs Postgres); no server or DB change in this diff.

### Acceptance criteria
- [x] 1 Transfer shown exactly when `canTransfer` (owner / Manager+ / never org inventory) — evidence:
  `src/ui/devices/device-actions.ts:77-84` gates only on the server flag; `device-actions.test.ts › transfer actions ›
  transfer is shown only with canTransfer and onTransfer, after place and before edit`, `› an org-inventory row (owner
  null, canTransfer false) has no transfer`; `DevicesView.test.tsx › a Transfer button follows canTransfer`. Server flag
  covered by SIM-037.3.
- [x] 2 Started transfer shows "Transfer pending" / "To <name>"; sender or Manager+ can cancel — evidence:
  `devices-state.ts:33-41` `pendingText`; `DeviceTable.tsx:35-43` chip + "To" line in table and card;
  `devices-state.test.ts › pendingText` (3 cases, diacritics kept); `DevicesView.test.tsx › shows the chip and 'To
  Hương' in the table and the card, and keeps the owner`, `› Cancel transfer button with its aria-label when canCancel;
  none when false`, `› busyId disables the buttons of that row`; `device-actions.test.ts › cancelTransfer is first,
  gated by a transfer pendingHandoff with canCancel`, `› busyId disables every action of that row only`;
  `devices-api.test.ts › startTransfer sends POST /api/devices/<id>/handoffs …`, `› cancelHandoff sends POST
  /api/handoffs/<id>/cancel with no body`; `transfer-device.test.ts › cancelOutcome › ok shows the cancelled notice and
  refreshes`. Page wiring `DevicesPage.tsx:69-82` (guard ref, busyId, notice, refresh, heading focus).
- [x] 4 Stale start / cancel shows a message and refreshes — evidence: `transfer-device.test.ts › settleTransfer`
  (`it.each` over `handoff_pending`, `not_allowed`, `device_unowned`, `invalid_recipient` → error + stale;
  `member_not_assignable` → reload picker; `unavailable` / `internal` → no stale; `not_found` → done), `› cancelOutcome`
  (`it.each` `handoff_not_pending` / `not_found` → `gone` + refresh; `not_allowed` → error + refresh; auth codes and
  `unavailable` → error, no refresh); `DevicesView.test.tsx › notice region is always mounted; error tone has
  role=alert`. Dialog keeps open and calls `onStale` on stale (`TransferDeviceDialog.tsx:110-114`, A9).
- [x] 5 All new strings in `src/ui/copy/*` (D36) — evidence: diff read; new user-facing text is only in
  `src/ui/copy/devices.ts:33-57`; `.tsx` files reference `devicesCopy` / `seatsCopy`; tests import the copy objects.
- [x] 6 Checks green — see above.
- Extraction proof: `src/ui/devices/AssignDeviceDialog.test.tsx` is unchanged in the diff and passes.

Ming verification after merge (not verified here; carry to the PR), from plan.md:
1. A transfers an owned device to B with a diacritic note: row shows "Transfer pending · To B" and Cancel transfer;
   Transfer, Assign and Delete are gone.
2. A cancels: row returns to normal, notice says cancelled.
3. Restart the transfer; Manager C sees Cancel transfer on A's device and can cancel.
4. Two tabs: cancel in one, then Cancel in the other: message appears and the list refreshes.
- Confirming as B needs SIM-037.9 (or the API); A1: no release between SIM-037.8 and SIM-037.9.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: only `src/ui/**` and `@/lib/**` imports (`validateHandoffStart` from `src/lib/validate`),
`check:layers` clean. R3: no config. R4: every changed source file is in the plan's file table; `work/ming-todo.md`
(M-59) and `ticket.md` are loop bookkeeping. R5: new logic has tests. R7: UI only; gating uses server flags, no client
re-check. D36 respected.

### Blockers from review agents
None (no review trigger applies).

### Nits (do not block)
- `DevicesPage.tsx:98` `onNew` does not clear the notice, unlike every other dialog opener (plan Approach 6: "Opening
  any other dialog clears the notice"). Harmless: the old notice stays accurate.
- `TransferDeviceDialog.tsx:52` `aria-describedby` sits on a role-less wrapper `<div>`; some screen readers ignore
  descriptions on generic elements. Matches the plan ("on the radiogroup wrapper"); passing an `aria-describedby` prop
  through to the `role="radiogroup"` element would be more robust.
- `devices-api.ts:57-60` `oneHandoff` reuses `isDevice` (an id-is-string check); correct per plan, but the name reads
  oddly. A neutral `hasId` would be clearer.
- impl-log follow-up: the plan's test table says a non-canonical member id gives "the generic message", Approach 3 maps
  `toMemberId` to `pickerNone`. The implementer followed Approach 3 (consistent with assign); acceptable.

### Follow-ups (out of scope)
- SIM-037.9 (recipient side) as in plan.md `## Split proposal`; it should start after this slice merges (A12 hotspots:
  `DevicesPage.tsx`, `DevicesView.tsx`).
