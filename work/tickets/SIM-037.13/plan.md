Status: READY

# Plan — SIM-037.13: Device detail page: viewer actions

## Scope summary
- Ticket goal: "A viewer can act on a device from its detail page (transfer, return, assign, and the other actions
  their flags allow) without going back to the list."
- Ticket scope:
  > Render `DeviceRowActions` on the detail page with `onTransfer`, `onReturn`, `onAssign`, plus `onExtend`,
  > `onCancelHandoff`, `onTakeBack`, `onEditHolding`, `onPlace`.
  > Mount the existing dialogs (Transfer, Return, Assign, Extend, TakeBack, Place).
  > On done: refresh the device and the first history page, show the existing `devicesCopy.*.sent` notices in an
  > `aria-live` region, focus the `h1`.
  > Decide whether to extract a shared `useDeviceDialogs` from `DevicesPage`.
- Out of scope (ticket): "Edit / Delete (stay on the list page)."
- `docs/spec-v1.md` §6 **DEV-11** (lines 342-344): "Every member can open a device detail page: all fields, where it is,
  the current holder (since, note, expiry, overdue), any pending handoff, and its history." The actions themselves are
  the existing DEV-07..DEV-10 flows; this ticket only exposes them on the detail page. No server or API change.
- SIM-037.6 plan.md `## Split proposal` (slice 2) is the origin of this ticket.
- `work/decisions.md` **D36**: "all user-facing text lives in copy files".

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The detail page shows exactly the actions the device's server flags allow, and each opens the same dialog as on the list. | `device-detail-actions.test.ts › detailHandlers: has the 8 handlers and no onEdit/onDelete`; `› rowActions(device, detailHandlers) on a device with every flag true lists no Edit/Delete`; `› each handler opens its dialog kind with the device (and mode for assign/edit-holding/place)`; `› dialogFor picks the device only for the matching kind`. `DeviceDetailView.test.tsx › ready: holder with canTransfer/canReturn shows Transfer and Give back; plain viewer shows no action bar`; `› canEdit/canDelete true never render Edit or Delete`; `› actions are not rendered in loading, error or notFound`. `DeviceDetailDialogs.tsx` mounts the same six dialog components the list uses (code read). Manual check M1-M4. |
| 2 | After an action the page shows the updated device and history, a notice, and focus returns to the heading. | Refresh: `device-detail-state.test.ts › detail refresh keeps ready+device while in flight, replaces on ok, notFound on not_found, keeps data on other errors, drops stale`; `› history refresh keeps items while in flight, replaces with page 1 on ok, keeps items on error, drops a late loadMore`; `device-detail-actions.test.ts › refreshOk`. Notice: `› doneNotice per kind` and `› afterRefresh`. Region: `DeviceDetailView.test.tsx › live region is always mounted (ready, notFound, loading, error) and empty without a notice; status notice → role=status, error → role=alert`. Focus and the call order (close → notice → refresh → focus) live in `DeviceDetailPage.tsx`, which needs a DOM to run: checked by code read and manual checks M1-M6. |
| 3 | All new strings live in `src/ui/copy/*` (D36). | `src/ui/copy/devices.ts` diff adds `devicesCopy.detail.done.*`; grep of the new/changed `.tsx`/`.ts` files shows no string literal shown to users; `device-detail-actions.test.ts` asserts the notices come from `devicesCopy`. |

**Test plan wording (flag for Ming):** the ticket says "Component: action gating, dialog open, refresh + notice + focus
after done". Vitest runs in node with no DOM and jsdom is not allowed, so this becomes: "Pure helpers
(`device-detail-actions.ts`, reducer events) + `renderToStaticMarkup` of `DeviceDetailView` for gating, dialog choice,
notice and live region; the container's focus and call order are checked by code read and the manual walk." The
implementer updates the ticket's `## Test plan` line to this wording and notes it in `## Handoff`.

## Ming verification after merge
- With a screen reader (VoiceOver or NVDA) on the deployed app: after Transfer on `/devices/<id>`, the notice is
  announced and focus lands on the device name heading. (The reviewer cannot run a screen reader.)

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/devices/device-detail-state.ts` | Add `refresh` / `refreshed` events to `DetailEvent` (lines 18-20) and `HistoryEvent` (lines 55-59); handle them in `detailReducer` (line 23) and `historyReducer` (line 62). Existing `load`/`loaded`/`loadMore`/`moreLoaded` unchanged. | Silent refresh without a skeleton (both consults: `load` resets to `INITIAL_*`, which unmounts the h1, dialogs and live region). | No |
| `src/ui/devices/device-detail-state.test.ts` | New cases for the refresh events. | R5. | No |
| `src/ui/devices/useDeviceDetail.ts` | Add `refresh(): Promise<boolean>` (after `loadMore`, line 50) and `refreshDevice(): Promise<void>` (detail only, for `onStale`); return them (line 57). | Container data. | No |
| `src/ui/devices/device-detail-actions.ts` (new, pure) | Types `DetailDialog`, `DetailDone`, `DeviceNotice`; `detailHandlers(open, onCancel)`; `dialogFor(dialog, kind)`; `doneNotice(done)`; `detailCancelOutcome(result, device, kind)`; `refreshOk(detail, history)`; `afterRefresh(notice, ok)`. | Rule 6 pure logic first; testable without a DOM. | No |
| `src/ui/devices/device-detail-actions.test.ts` (new) | Unit tests of the helpers. | R5, AC1-AC3. | No |
| `src/ui/devices/DeviceDetailDialogs.tsx` (new) | Renders the six existing dialogs from one `DetailDialog` slot; maps each dialog's `onDone` to `onDone(done: DetailDone)`. | Keeps `DeviceDetailPage` small; mounts "the same dialog as on the list". | No |
| `src/ui/devices/DeviceDetailPage.tsx` | Wire the dialog slot, handlers, cancel-handoff, notice state, busy state, focus request; pass `actions` and `notice` to the view; render `DeviceDetailDialogs`. Keep the first-load focus effect (lines 18-23) as is. | AC1, AC2. | No |
| `src/ui/devices/DeviceDetailView.tsx` | Add props `actions?: React.ReactNode` and `notice?: DeviceNotice \| null` (type at lines 15-24). Always-mounted `<div aria-live="polite">` right after the back link (line 86), outside the status branches, with the same `p role="status"`/`role="alert"` markup as `DevicesView.tsx:62-73`. In the `ready` branch, wrap `heading(device.name)` (line 118) and `actions` in `flex flex-wrap items-center justify-between gap-3`. | AC1, AC2. | No |
| `src/ui/devices/DeviceDetailView.test.tsx` | New cases for actions and the live region. | AC1, AC2. | No |
| `src/ui/copy/devices.ts` | Add `devicesCopy.detail.done` after `notFoundBody` (line 300): `assigned(name, inv)`, `holdingSaved(name, inv)`, `placed(name, inv)`, `moved(name, inv)`, `returnedToInventory(name, inv)`, `handoffGone`, `refreshFailed`. | D36; Assumptions 3, 4, 5. | No |
| `work/tickets/SIM-037.13/ticket.md` | Reword the `## Test plan` line (see above). | Flagged wording change. | No |

**No High path. No server, API or migration change. `DevicesPage.tsx` is not touched** (Assumption 1). The security
reviewer is not triggered (no `src/server/` path).

## Data model / migration
None.

## API contract
None. The page uses the existing `api.get`, `api.history`, `api.cancelHandoff` and the dialogs' existing calls.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/devices/device-detail-state.test.ts › detail refresh: keeps status ready and the device while in flight; ok replaces the device; not_found → notFound (device null); other error keeps status and device; a stale refreshed is dropped` | AC2 silent refresh |
| `… › detail: a load (Retry) after a refresh drops the late refreshed answer` | race |
| `… › history refresh: keeps items while in flight and clears loadingMore; ok replaces items, nextCursor, holderSince with page 1; error keeps items, status and nextCursor; stale dropped` | AC2, pagination reset |
| `… › history: a moreLoaded that started before a refresh is dropped` | race with "Load more" |
| `src/ui/devices/device-detail-actions.test.ts › detailHandlers: exposes onAssign, onEditHolding, onPlace, onTransfer, onReturn, onExtend, onTakeBack, onCancelHandoff; no onEdit/onDelete` | AC1 |
| `… › rowActions(device with every can* flag true, mine+overdue, no pending, detailHandlers) has no edit/delete key; plain viewer (all false, not mine) has none` | AC1 gating |
| `… › each handler calls open with its kind and the device; onAssign → {assign, mode "assign"}, onEditHolding → {assign, mode "edit"}, onPlace(move) → {place, mode "move"}; onCancelHandoff calls onCancel, not open` | AC1 "opens the same dialog" |
| `… › dialogFor returns the device only for the matching kind, null otherwise and for a null slot` | dialog mounting |
| `… › doneNotice: transfer/return/extend use devicesCopy.transfer/giveBack/extend.sent; takeBack = takeBackDone(device, "all") with no filter hint; assign → detail.done.assigned, edit → holdingSaved; place/move/return → placed/moved/returnedToInventory; all tone status; Vietnamese name kept (Máy trạm)` | AC2 notice, AC3 |
| `… › detailCancelOutcome: ok = cancelOutcome text; handoff_not_pending and not_found → detail.done.handoffGone, refresh true; other codes pass cancelOutcome through (refresh false for nothing-changed codes)` | cancel notice on detail |
| `… › refreshOk: detail ok + history ok → true; detail not_found → true whatever history; detail error → false; history error → false` | refresh failure rule |
| `… › afterRefresh: ok keeps the notice; failed + status notice → error tone, "<text> <refreshFailed>"; failed + error notice → error tone with both texts; failed + null → refreshFailed alone` | Assumption 5 |
| `src/ui/devices/DeviceDetailView.test.tsx › ready renders the actions node next to the heading; actions are not rendered in loading, error or notFound` | AC1 |
| `… › with DeviceRowActions + detailHandlers: holder with canTransfer and canReturn shows Transfer and Give back; plain viewer renders no button; canEdit/canDelete true never render Edit or Delete` | AC1 gating in markup |
| `… › live region aria-live=polite is present and empty without a notice in ready, loading, error and notFound` | AC2 always-mounted region |
| `… › status notice renders role=status, error notice role=alert; notFound still shows the notice` | AC2 |

## Approach
1. **Reducers** (`device-detail-state.ts`). Tests first.
   - `DetailEvent` adds `{ type: "refresh"; id }` → `{ ...state, latest: id }` (no reset), and
     `{ type: "refreshed"; id; result }` → stale id: unchanged; ok: `ready` + new device; `not_found`: `notFound`,
     device null; any other code: `state` unchanged.
   - `HistoryEvent` adds `refresh` → `{ ...state, latest: id, loadingMore: false, moreError: false }`, and
     `refreshed` → stale: unchanged; ok: same object as `loaded` ok (page 1); error: `{ ...state }` unchanged.
     A `moreLoaded` in flight is dropped by the existing `event.id !== state.latest` check.
2. **Hook** (`useDeviceDetail.ts`). `refresh` bumps both counters, dispatches both `refresh` events, awaits
   `Promise.all([api.get(deviceId), api.history(deviceId)])`, dispatches both `refreshed` when `mounted`, returns
   `refreshOk(d, h)`. `refreshDevice` does the same for the detail only (used by `onStale`; history does not change
   on a refused action).
3. **Pure helpers** (`device-detail-actions.ts`), imports `@/lib/devices/types`, `../copy/devices`,
   `./transfer-device` (`cancelOutcome`), `./return-device` (`takeBackDone`), `./devices-api` (types only), ui → ui/lib only (R1).
   - `type DetailDialog = { kind: "transfer" | "return" | "extend" | "takeBack"; device } | { kind: "assign"; device; mode: AssignMode } | { kind: "place"; device; mode: PlaceMode }`.
   - `type DetailDone = DetailDialog` (the done event carries the dialog's kind, mode and the device: the dialog's
     returned device for transfer/return/extend/takeBack, the slot snapshot for assign/place).
   - `detailHandlers(open: (d: DetailDialog) => void, onCancel: (d: DeviceDto) => void): DeviceRowHandlers` with
     exactly the 8 handlers.
   - `dialogFor(slot, kind)`, `doneNotice(done)`, `detailCancelOutcome(...)`, `refreshOk(...)`, `afterRefresh(...)` as in the test table.
4. **Dialogs** (`DeviceDetailDialogs.tsx`, no `"use client"` needed beyond the page's). Props: `dialog`, `api`,
   `seatsApi`, `roomsApi`, `onClose`, `onStale`, `onDone(done)`. Renders `TransferDeviceDialog`, `ReturnDeviceDialog`,
   `ExtendDeviceDialog`, `TakeBackDeviceDialog` with `device={dialogFor(dialog, kind)}`, and `PlaceDeviceDialog` /
   `AssignDeviceDialog` with `open={dialog?.kind === kind}`, `device`, `mode` (same prop shapes as
   `DevicesPage.tsx:323-405`). The dialog's device comes from the slot (a snapshot set on open), never from
   `detail.device`, so a refresh does not swap it mid-dialog.
5. **Container** (`DeviceDetailPage.tsx`):
   - `roomsApi`/`seatsApi` via `createRoomsApi`/`createSeatsApi` (as `DevicesPage.tsx:51-52`).
   - State: `dialog: DetailDialog | null`, `notice: DeviceNotice | null`, `busy: boolean`, `focusRequest: number`;
     ref `acting`.
   - `open(d)`: `setNotice(null); setDialog(d)`.
   - `finish(notice)`: `acting.current = true; setBusy(true); setNotice(notice); const ok = await refresh();
     setNotice(afterRefresh(notice, ok)); setBusy(false); acting.current = false; setFocusRequest(n => n + 1)`.
   - `onDone(done)`: `setDialog(null); void finish(doneNotice(done))`.
   - `onCancel(device)`: guard `acting.current || !device.pendingHandoff`; `setBusy(true); setNotice(null)`;
     `outcome = detailCancelOutcome(await api.cancelHandoff(p.id), device, p.kind)`; if `outcome.refresh` →
     `finish(outcome.notice)`, else set the notice, clear busy, request focus.
   - `onStale`: `void refreshDevice()` (no notice change, no focus move; the dialog shows its own stale error).
   - Focus: `useEffect(() => { if (focusRequest > 0) headingRef.current?.focus(); }, [focusRequest])`, applied after
     commit so it hits the heading of the new branch (`ready` or `notFound`), as `DevicesPage.tsx:84-101` does.
   - `handlers = useMemo(() => detailHandlers(open, onCancel), [api, refresh])`.
   - View props: `actions={detail.device && <DeviceRowActions device={detail.device} handlers={handlers} busyId={busy ? detail.device.id : null} />}`, `notice={notice}`.
6. **View** (`DeviceDetailView.tsx`): the two new props and markup as in the file table. The live region sits after the
   back link and before the status branches, so it stays mounted when a refresh turns `ready` into `notFound`.
7. **Copy**: add `devicesCopy.detail.done` (English, `(name, inv)` style of `transfer.sent`):
   `assigned: (n, i) => \`${n} (${i}) assigned.\``, `holdingSaved: (n, i) => \`Note and expiry of ${n} (${i}) saved.\``,
   `placed: (n, i) => \`${n} (${i}) placed at a seat.\``, `moved: (n, i) => \`${n} (${i}) moved.\``,
   `returnedToInventory: (n, i) => \`${n} (${i}) returned to inventory.\``,
   `handoffGone: "This request is no longer pending. The page has been refreshed."`,
   `refreshFailed: "The page could not be updated. Reload to see the latest data."`.
8. Update the ticket `## Test plan` line. Run the checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`,
   `pnpm test`, `pnpm build`.

Manual checks (local, `pnpm dev` with a dev token and `pnpm seed:dev` data; the reviewer or implementer records them in impl-log):
- **M1** As the holder of a device: open `/devices/<id>`. Transfer and Give back show; Edit and Delete never show.
  Transfer → pick a member → submit. The page does not flash a skeleton; the notice "Transfer of … sent…" shows; the
  Pending handoff section and a "Cancel transfer" button appear; the history's top entry is the transfer start; focus
  is on the device name heading (Tab goes to the next control after it).
- **M2** Cancel transfer → cancelled notice, pending section gone, history grows, focus on the heading. Give back →
  sent notice, pending return shown.
- **M3** As an Admin: Assign an org-inventory device, then Note/expiry, then Place, Move and Return to inventory, then
  Take back on an owned device. Each shows its notice, updates the "Where it is"/"Holder" sections and the history,
  and focuses the heading. The take-back notice has no list-filter hint.
- **M4** As a plain user who does not hold the device: no action bar.
- **M5** As the holder of an overdue device: Extend → extension notice, pending extension shown.
- **M6** Refresh failure (optional): in DevTools block `/api/devices/<id>` after opening a dialog, then submit. The
  old data stays, the notice shows with "The page could not be updated…" as an alert, focus on the heading.
- **M7** Delete the device in another tab, then do any action on the stale page (for example cancel): the page turns
  into "Device not found", the notice stays visible, focus on that heading.

Rules: R1 (all new code is in `src/ui/**`; imports `@/lib/*` and ui modules only; no `src/server` import;
`pnpm check:layers`), R4 (file list above; `DevicesPage.tsx` untouched), R5 (tests above), R7 (no new route; the
dialogs' calls are unchanged), D36 (new strings in `src/ui/copy/devices.ts`), R2/R3/R6 not affected.

## Specialist input used
- **frontend-developer**
  - Adopted: silent refresh with new reducer events and tests (rec. 2); notice and always-mounted live region outside
    the status branches (rec. 3); focus by a counter + `useEffect` (rec. 3); dialog device from its own slot, not from
    `detail.device` (rec. 4); cancel-handoff with `acting` ref, `busyId = device.id`, `cancelOutcome`, refresh only
    if `outcome.refresh` (rec. 4); `actions` slot in the view, no `hasAnyAction` (rec. 5); pure helpers + static markup
    and the reworded test plan (rec. 6); `takeBackDone(device, "all")` (rec. 4).
  - Adopted with a change: busy state covers the post-action refresh too, so the bar is disabled until the refresh
    lands (rec. 4 "hide or disable"; disable chosen, so the bar does not jump).
  - Rejected: extracting `useDeviceDialogState` + a shared dialogs component into `DevicesPage` (rec. 1). See Assumption 1.
- **ux-architect**
  - Adopted: header row with `h1` and the action bar, `flex-wrap`, no menu, `rowActions` order unchanged, bar absent
    outside `ready` (recs. 1-2); silent refresh, keep data on failure and show an error notice (rec. 4); clear the
    notice when a dialog opens (rec. 5); focus the heading after every action including Place and Assign-edit
    (rec. 6); stay on the page after a transfer or return, `notFound` on 404 (recs. 7-8); copy in
    `devicesCopy.detail` (rec. 9).
  - Adopted with a change: the live region sits right below the back link, not below the heading row, because it must
    stay mounted across `ready` → `notFound` and the h1 lives inside those branches (rec. 5).
  - Rejected: list parity "no notice" for Place and Assign-edit (rec. 5, OQ3). The ticket's AC2 asks for a notice
    after an action. See Assumption 3.
  - Rejected: `useDeviceDialogs` extraction (rec. 3). See Assumption 1.

## Assumptions
Planner assumptions, non-blocking, for Ming to confirm.

1. **No extraction from `DevicesPage`; the dialogs are wired again on the detail page.** The list's `onDone` bodies
   differ per dialog (`refreshDevices` vs `refreshAll` with three handoff lists, the overdue list and the nav badge;
   `takeBackDone` with the list filter; focus only for Assign "assign"). A shared hook would have to carry all of that
   through callbacks, and `DevicesPage` has no test that can catch a focus or notice regression without a DOM.
   The detail page uses one `DetailDialog` union slot instead of six `useState` slots. The new
   `DeviceDetailDialogs.tsx` is generic (slot in, `onDone(done)` out), so the list can adopt it later. Follow-up: "Use
   `DeviceDetailDialogs` + `DetailDialog` in `DevicesPage`" (low priority).
2. **Take-back notice on the detail page = `takeBackDone(device, "all")`**, that is
   `devicesCopy.takeBack.done(name, inv)` ("… is back in the org inventory.") with no list-filter hint
   (`return-device.ts:93-99`). No new string.
3. **Place and Assign show a notice on the detail page**, unlike the list (AC2 asks for "a notice" after an action,
   and the existing `*.sent` strings do not cover these). New strings: `detail.done.assigned`, `holdingSaved`,
   `placed`, `moved`, `returnedToInventory`. The list stays silent for these (unchanged, R4).
4. **Cancel "gone" notice on the detail page** says "The page has been refreshed." (`detail.done.handoffGone`) instead
   of the list's "The list has been refreshed." (`transfer/giveBack/extend.gone`). Other cancel outcomes reuse
   `cancelOutcome` as is.
5. **A failed refresh keeps the old device and history** (no skeleton, no `error` state). The notice turns into an
   error (`role="alert"`) with the action's text followed by `detail.done.refreshFailed`; focus still goes to the
   heading. A refresh whose detail answer is `not_found` is not a failure: the page shows "Device not found" with the
   notice. `onStale` refreshes the device only, silently.
6. **History after an action resets to page 1** (extra "Load more" pages are dropped; the new event is on top). A
   "Load more" answer that started before the refresh is dropped.
7. **Focus goes to the `h1` after every action**, including Assign "edit" and Place (the list skips focus for
   Assign "edit"). The first-load focus is unchanged.
8. **The action bar is disabled (`busyId`) while a cancel or a post-action refresh is in flight**, to prevent a double
   submit; it is not hidden.
9. **Live region position:** right below the "Back to devices" link, above the heading, always mounted.
10. **Handoff start fix is in.** PR #102 is SIM-037.6's own PR (merged, a4548e9 per `work/tickets/BUG-002/plan.md:64`).
    The start-insert bug was fixed by BUG-002 (board: MERGED). The code confirms it: `src/server/devices/handoffs.ts:179-181`,
    `236-238` and `291-294` use the guarded `from (select $1::uuid as org_id) o where o.org_id = $1::uuid` form. Checked
    by grep on the checked-out branch `claude/modest-allen-yru4g8`, which is based on `main`. Starting a transfer,
    return or extension therefore works in M1, M2 and M5.
11. **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (board). SIM-037.12 is merged. `DevicesPage.tsx`
    is not touched.
12. **Test plan wording** changes from "Component" to "pure helpers + `renderToStaticMarkup`" (no DOM, no jsdom). The
    container's call order and focus are checked by code read and manual checks M1-M7.

## Blocking questions
None.

## Split proposal
None. Estimate: about 330 product lines (reducers +30, hook +30, `device-detail-actions.ts` ~90,
`DeviceDetailDialogs.tsx` ~90, `DeviceDetailPage.tsx` +60, `DeviceDetailView.tsx` +25, copy +10) and about 250 test
lines. This is under the 450-line limit and fits size M.
