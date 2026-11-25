## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (780 files)
- `pnpm typecheck && pnpm check:layers` — exit 0, "check-layers: 726 files, no violations"
- `pnpm test` — full run: 1 failed | 2760 passed | 14 skipped. The failure is `src/server/identity/verify.test.ts` › "expired beyond 30 s leeway; within leeway ok; ..." (line 169, a `now() - 29` vs 30 s leeway timing assertion under full-suite load). The file is not in the diff; re-run alone: 26/26 passed. `scripts/dev-process.test.ts` passed in this full run. Treated as an unrelated flaky timing test, not a blocker.
- `pnpm build` — exit 0
- `pnpm test:db` — CI only; no server or SQL change in this diff.

impl-log reported the flaky `dev-process` test instead of `verify.test.ts`. Both are timing tests outside the diff, so this is not a claim mismatch about the change.

### Acceptance criteria
- [x] Owner or Manager+ can start and cancel a return from the Devices page; only Admins see Confirm. Evidence: `device-actions.ts:56-69,105-112` gates on `canReturn` / `pendingHandoff.canCancel` with kind-aware keys. `device-actions.test.ts` › "giveBack only when canReturn ...", "cancelReturn for a pending return ...". `return-device.test.ts` › `toReturnBody`, `settleReturn` (stale codes `handoff_pending`, `not_allowed`, `device_unowned`). `transfer-device.test.ts` › "return kind: its own cancelled and gone notices". `PendingReturns.test.tsx` › "Confirm only with canConfirm ...". `incoming-transfer.test.ts` › "handoffBoxes: non-Admin -> ['incoming'] only". `DevicesPage.tsx:63` passes `enabled=false` for non-Admins, so `box=returns` is never fetched; `useIncomingHandoffs.ts:26,35` short-circuits. This matches server `handoffs.ts:613` (`tier !== "admin"` gives 422).
- [x] Admins see each pending return (device, from, note) and confirm it; the device then shows as unowned. Evidence: `PendingReturns.tsx` renders name, typeLine, From and note; `PendingReturns.test.tsx` (7 cases, including empty renders nothing, error with Retry, truncated, busy). `confirmReturnOutcome` tests: ok and the hint only under `placed`; `handoff_not_pending` / `not_found` give the gone notice and a refresh; auth / unavailable do not refresh; `placement_changed` is an error and refreshes. `DevicesPage.tsx` `act("returns", ...)` then `refreshAll()` reloads the device list. The local manual run was not done; it is left for Ming's PR check.
- [x] Admin Take back works after a confirm dialog, including on a deactivated member's device. Evidence: `TakeBackDeviceDialog.tsx` (an `EntityFormDialog` confirm) calls `api.takeBack`. The row action is gated only on the server's `canTakeBack` and is danger-styled (`device-actions.ts:121-129`). Tests: `device-actions.test.ts` › "takeBack when canTakeBack (danger), also with a pending transfer ..."; `TakeBackDeviceDialog.test.tsx` (owner, seat / "not placed", the transfer-cancel sentence only for a transfer); `return-device.test.ts` › `settleTakeBack`, `takeBackBody`. `devices-api.test.ts` › "takeBack posts to /api/devices/:id/take-back with no body ...". The deactivated-member case is a server flag (SIM-037.4); the UI adds no gate of its own.
- [x] Admins see the number of pending returns in the Devices nav badge (summed with incoming transfers, aria breakdown). Evidence: `AppShell.tsx` sets `badges.devices = badgeTotal(handoffs)` and passes `badgeLabels`. `AppShellView.tsx:104` applies the override. `useHandoffBadge.tsx` holds `HandoffCountDto`. Tests: `AppShellView.test.tsx` › badgeLabels override and `devicesBreakdown` cases; `incoming-transfer.test.ts` › `badgeCountAfter` with two lists, `badgeTotal`; `devices-api.test.ts` › "handoffCount returns {incoming, returns}; missing or non-number returns -> 0; missing incoming -> internal". The existing badge tests are still green.
- [x] All new strings live in `src/ui/copy/*` (D36). Evidence: new keys are in `src/ui/copy/devices.ts` (`actions.giveBack*/takeBack*/cancelReturn*`, `giveBack`, `takeBack`, `returns`, `pending.returnChip`) and `src/ui/copy/shell.ts` (`pendingReturns`, `devicesBreakdown`). I grepped the new `.tsx` files; the only JSX literals are punctuation (see Nits).

### Issues
None.

### Scope
Every changed product file is in the plan's file list. `work/ming-todo.md` (M-67) and the ticket and work files are loop bookkeeping. No High path is touched; the expected tier is Medium.

### Rules (CLAUDE.md)
No violations found.
- R1: only `src/ui/**` changed; check:layers is clean.
- R7: the UI does not retry domain codes.
- R5: new logic has tests.
- R4: no out-of-plan refactor.
- R2, R3 and R6: not touched.

### Blockers from review agents
None. No review trigger path was changed.

### Nits (do not block)
- `src/ui/devices/TakeBackDeviceDialog.tsx:17`: the sentence is assembled in JSX with the literals `", "` and `"."` around `copy.withOwner` / `copy.onSeat`. A single copy function (e.g. `takeBack.where(owner, seat|null)`) would keep the whole sentence in D36 copy.
- `devicesCopy.takeBack.effect` ("It becomes unowned and leaves its seat.") is shown even when the body already says "not placed". Consider a variant without the seat clause.
- `settleReturn` / `settleTakeBack` treat `not_found` as done, so `onDone` shows "Return of X sent" or "X is back in the org inventory" for a device that was deleted meanwhile. This mirrors the existing `settleTransfer` behaviour.
- The `useHandoffList` dependency on `api.pendingReturns` / `api.incomingHandoffs` identity relies on `api` being memoized in `DevicesPage` (it is). That is fine, but worth a comment.

### Ming verification (carry into the PR)
- Manual local run with `pnpm seed:dev`:
  1. As a User, give a device back with a note, then cancel it.
  2. Give it back again, then as an Admin confirm it. The row shows "Org inventory" with no owner or seat.
  3. As an Admin, take back a device of a deactivated member. Also take back a device with a pending transfer: the transfer is cancelled.
- Badge: as an Admin, the number equals incoming plus returns, and the screen-reader text gives the breakdown.

### Follow-ups (out of scope)
- Flaky timing tests under full-suite load on Windows: `src/server/identity/verify.test.ts` (leeway case, line 169) and `scripts/dev-process.test.ts` (orphan grandchild). Candidate `debt` issue.
- Danger-styled submit for `EntityFormDialog` (take-back confirm), as noted in the plan.
