# Review — SIM-037.13

## Attempt 1 — 2026-11-26
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (857 files).
- `pnpm typecheck` — exit 0, next typegen + `tsc --noEmit`, no errors.
- `pnpm check:layers` — exit 0, "check-layers: 802 files, no violations".
- `pnpm test` — exit 0, "Test Files 305 passed | 1 skipped (306); Tests 3102 passed | 9 skipped (3111)".
- `pnpm build` — exit 0, route table printed, build succeeded.
- `pnpm test:db` — not run (no server, SQL or migration change; CI runs it).

Results match impl-log.md attempt 1.

### Acceptance criteria
- [x] The detail page shows exactly the actions the device's server flags allow, and each opens the same dialog as on the list. Evidence:
  - `device-detail-actions.test.ts › detailHandlers: flag table` runs the real `rowActions` with the detail handler set. Each flag alone gives its key, place modes give `place` / `move`+`return`, `canEdit && canDelete` gives `[]`, and a pending handoff with `canCancel` gives the cancel key and hides Extend.
  - `› detailHandlers opens the matching dialog` checks the kind/mode per handler and confirms `onEdit`/`onDelete` are undefined.
  - `DeviceDetailView.test.tsx › actions render after the h1 only when ready`.
  - Code check: `src/ui/devices/useDeviceDetailActions.tsx` mounts the six list dialogs (Transfer, Return, Extend, TakeBack, Place, Assign) with the same props as `DevicesPage.tsx:323-405`, and no Edit/Delete dialog. `DeviceDetailPage.tsx` renders `DeviceRowActions` with these handlers.
- [x] After an action the page shows the updated device and history, a notice, and focus returns to the heading. Evidence:
  - `device-detail-state.test.ts › refresh events` (6 cases). Refresh keeps the shown device, refreshed replaces it, a stale answer is dropped, not_found gives notFound, other errors keep the old device. History is replaced with page 1, a failure keeps the old items, and an older loadMore answer is dropped.
  - `device-detail-actions.test.ts › finishAction` checks the order setNotice → refresh → focus. It also covers the refreshFailed error notice, not_found clearing the notice, and the no-refresh path that keeps the notice and still asks for focus.
  - `› doneNotice per action` covers every dialog kind.
  - `DeviceDetailView.test.tsx › notice region is always mounted; tones map to roles`.
  - Focus effect: `DeviceDetailPage.tsx` sets `focusSeq` and calls `headingRef.current?.focus()` after the commit. The h1 has `tabIndex={-1}` (`DeviceDetailView.tsx:82`).
- [x] All new strings live in `src/ui/copy/*` (D36). Evidence: the only new user-visible strings are `devicesCopy.detail.done.{assigned,holdingSaved,placement}` and `devicesCopy.detail.refreshFailed` in `src/ui/copy/devices.ts`. No string literals were added in JSX.

Ming verification after merge (from plan.md, not verified here):
- Optional: screen reader check (NVDA / VoiceOver) that the notice is announced after Transfer / Give back on the detail page.
- Local run: `/devices/<id>` as owner, Admin and plain member shows the same buttons as the row on `/devices`. Starting a transfer on the detail page shows no skeleton flash, the Pending section and history row appear, and focus is on the h1.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: all new code is in `src/ui/**`, imports only ui and `@/lib`, and `check:layers` is clean.
- R4: every changed file is in the plan's file list. `DevicesPage.tsx`, `DeviceRowActions.tsx`, `device-actions.ts` and the dialog files are unchanged.
- R5: the new logic has unit tests.
- D36: holds.
- R2, R3, R6 and R7 are not affected: no schema, env or server change.
- No High path is touched.

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `useDeviceDetailActions.tsx`: in `done`, a second dialog `onDone` during an in-flight action is dropped silently because of the `acting` guard. This is already recorded as a follow-up in impl-log; it is rare in practice because the buttons are busy-disabled.
- `useDeviceDetailActions.tsx`: the `handlers` `useMemo` relies on a comment to justify omitting `cancel` from its deps. It is correct today because `cancel` only closes over the listed inputs, stable setters and refs. Extracting `cancel`/`refreshAll` with `useCallback` would make that explicit.

### Follow-ups (out of scope)
- Extract a shared device dialogs host used by `DevicesPage` and `DeviceDetailPage` (plan A1).
- `*.gone` cancel copy says "The list has been refreshed", which is list wording on the detail page (plan A5).
