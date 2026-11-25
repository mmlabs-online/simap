## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format." (863 files)
- `pnpm typecheck` — exit 0
- `pnpm check:layers` — exit 0, "check-layers: 808 files, no violations"
- `pnpm test` — exit 0, "Test Files 308 passed | 1 skipped (309)", "Tests 3125 passed | 7 skipped (3132)"; matches impl-log
- `pnpm build` — exit 0
- `pnpm test:db` — not run (CI-only, needs Postgres; no server/SQL change in this ticket)

### Acceptance criteria
- [x] AC1 The detail page shows exactly the actions the server flags allow, each opening the same dialog as on the list —
  evidence: `device-detail-actions.test.ts › detailHandlers › has the 8 handlers and no onEdit/onDelete`,
  `› rowActions on a device with every flag true lists no Edit/Delete; a plain viewer has none`,
  `› each handler opens its dialog kind with the device (and mode); cancel calls onCancel`, `dialogFor › returns the
  device only for the matching kind`; `DeviceDetailView.test.tsx › ready renders the actions node; loading, error and
  notFound do not`, `› DeviceRowActions gating: holder sees Transfer and Give back, a plain viewer none, never Edit or
  Delete` (all pass). Code read: `DeviceDetailDialogs.tsx:41-80` mounts the same six dialog components as the list
  with the same prop shapes; `device-detail-actions.ts:24-36` has exactly the 8 handlers. Gating stays in
  `rowActions` (server flags), unchanged.
- [x] AC2 After an action the page shows the updated device and history, a notice, and focus on the heading —
  evidence: `device-detail-state.test.ts › refresh events` (4 cases: silent detail refresh, Retry drops a late
  refreshed, history refresh to page 1 / keep on error / stale dropped, late moreLoaded dropped);
  `device-detail-actions.test.ts › doneNotice`, `› detailCancelOutcome`, `› refreshOk / afterRefresh` (2 cases);
  `DeviceDetailView.test.tsx › the live region is mounted in every status and empty without a notice`, `› status
  notice is role=status, error is role=alert, notFound still shows it` (all pass). Container wiring checked by code
  read (see "Page wiring" below). Manual checks M1-M7 not run (no browser / dev token here, as in impl-log).
- [x] AC3 All new strings in `src/ui/copy/*` (D36) — evidence: `src/ui/copy/devices.ts:301-309`
  (`devicesCopy.detail.done.*`); `DeviceDetailDialogs.tsx`, `DeviceDetailPage.tsx`, `device-detail-actions.ts` and
  the `DeviceDetailView.tsx` additions contain no user-facing literal; `doneNotice` test asserts the texts come from
  `devicesCopy`.

Ming verification after merge (carry to the PR):
- Screen reader (VoiceOver or NVDA) on the deployed app: after Transfer on `/devices/<id>`, the notice is announced
  and focus lands on the device name heading.
- Manual walk M1-M7 from plan.md (no one ran them yet; impl-log "Deviations").

### Page wiring (code read, no DOM tests)
- Silent refresh: `refresh` events keep `status`/`device` and items (`device-detail-state.ts:30`, `:78-80`); stale
  answers drop via the shared counters (`useDeviceDetail.ts:54-65`, reducer `event.id !== state.latest`); a failed
  `refreshed` returns the state unchanged (`device-detail-state.ts:32-34`, `:82`); `not_found` goes to `notFound`.
  A Retry (`load`) or a later refresh supersedes an earlier one. API calls never throw (`devices-api.ts:30`), so
  `busy`/`acting` cannot get stuck.
- Focus: `DeviceDetailPage.tsx:48-50` depends on `focusRequest` only, which changes only in `finish` (`:62`) and the
  no-refresh cancel branch (`:89`); unrelated renders do not move focus. It runs after commit, so it targets the
  heading of the current branch (ready or notFound). The first-load effect (`:41-45`) is unchanged.
- Double submit: `acting` is set synchronously before any await in both `finish` (`:55`) and cancel (`:76-77`); the
  cancel path hands over to `finish` synchronously (`:85-86`), so there is no gap. `busyId={busy ? device.id : null}`
  (`:115`) disables every bar button via `rowActions` (`device-actions.ts:152`) through the cancel call and the
  post-action refresh.
- Dialog snapshot: the dialogs read their device from the `dialog` slot (`DeviceDetailDialogs.tsx:43,49,54,59,65,75`,
  `dialogFor`), never from `detail.device`; inner dialogs are keyed by `device.id` (and mode), so a refresh
  (`onStale`) or even a `notFound` does not unmount an open dialog.
- Live region: `DeviceDetailView.tsx:95-106` sits after the back link, outside every status branch, so it stays
  mounted across ready → notFound.
- `onStale` → `refreshDevice()` (detail only, silent, no notice or focus change) (`DeviceDetailPage.tsx:138`); the
  dialog shows its own error. `onDone`: Transfer/Return/Extend/TakeBack report the device they acted on (their
  snapshot); Place/Assign report the slot with its mode (`DeviceDetailDialogs.tsx:69,79`); `onDone` closes the slot,
  then `finish(doneNotice(done))` (`DeviceDetailPage.tsx:95-98`).
- Cancel outcomes: `detailCancelOutcome` keeps `cancelOutcome`'s `refresh` flag and replaces only the gone notice
  (`device-detail-actions.ts:70-80`); ok / gone / changed errors refresh via `finish`, NOTHING_CHANGED codes set the
  error notice, clear busy and focus the heading without a refresh. Missing `pendingHandoff` or `acting` returns early.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: new code only in `src/ui/**`, imports `@/lib/devices/types` and ui modules; `check:layers`
clean. R4: changed files = plan's file list plus the ticket's own `work/` files; `DevicesPage.tsx` untouched; no High
path. R5: checks green, new reducer events and helpers have tests. D36: see AC3. R2/R3/R6/R7 not affected (no
server, SQL or route change).

### Blockers from review agents
None.

### Nits (do not block)
- `DeviceDetailView.tsx:95` the always-present empty live-region `div` is a child of the `flex flex-col gap-4`
  container, so it adds one extra `gap-4` between the back link and the heading even with no notice. Same pattern as
  the list; acceptable, but a zero-gap wrapper would avoid the blank space.
- `useDeviceDetail.ts:64` `refresh` returns `refreshOk(d, h)` even when its answers were superseded by a newer
  request (only possible with a Retry during the refresh); the notice could then say "could not be updated" for an
  answer the page ignored. Very unlikely, no user impact beyond the notice.

### Follow-ups (out of scope)
- Dialog error texts reused on the detail page still say "The list has been refreshed."
  (`devicesCopy.giveBack.errors.alreadyUnowned` and `takeBack.errors.alreadyUnowned`, `src/ui/copy/devices.ts:91,104`).
  A page-neutral wording would fit both pages.
- Use `DeviceDetailDialogs` + `DetailDialog` in `DevicesPage` (from impl-log, low priority).
- Ming to confirm the reworded `## Test plan` line in `ticket.md` (no DOM in Vitest) and plan Assumptions 1-8.
