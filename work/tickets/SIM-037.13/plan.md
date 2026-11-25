Status: READY

# Plan — SIM-037.13: Device detail page: viewer actions

## Scope summary
- `docs/spec-v1.md` §6 **DEV-11 Device detail and history** (line 342-344):
  > Every member can open a device detail page: all fields, where it is, the current holder (since, note, expiry,
  > overdue), any pending handoff, and its history.
- `work/tickets/SIM-037.6/plan.md` `## Split proposal` (lines 287-291), slice 2:
  > Render `DeviceRowActions` on the detail page with `onTransfer`, `onReturn`, `onAssign` (ticket scope), plus `onExtend`, `onCancelHandoff`, `onTakeBack`, `onEditHolding`, `onPlace`, which come free with `rowActions`.
  > Mount the existing dialogs (`TransferDeviceDialog`, `ReturnDeviceDialog`, `AssignDeviceDialog`, `ExtendDeviceDialog`, `TakeBackDeviceDialog`, `PlaceDeviceDialog`).
  > On `onDone`, refresh the device and the first history page, show the existing `devicesCopy.*.sent` notices in an `aria-live` region, then focus the `h1`.
  > Decide there whether to extract a shared `useDeviceDialogs` from `DevicesPage` (frontend consult §4). Edit/Delete stay on the list page.
- Ticket: "Out of scope: Edit / Delete (stay on the list page)."
- CLAUDE.md D36: "UI copy: English, in `src/ui/copy/<feature>.ts`."

The handoff start bug from the ticket's technical notes (SIM-037.6 PR #102) was fixed by BUG-002 (PR #104, merged), so
starting a transfer, return or extension works on `main`. Nothing in this plan depends on more than that.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | The detail page shows exactly the actions the device's server flags allow, and each opens the same dialog as on the list. | `device-detail-actions.test.ts › detailHandlers: flag table` (each flag alone gives exactly its button key; `canEdit`/`canDelete` true never gives `edit`/`delete`; pending `canCancel` gives the cancel key and hides Extend; `mine && overdue && !pending` gives Extend). `device-detail-actions.test.ts › detailHandlers opens the matching dialog` (each handler calls `open` with the right `kind`/`mode`). `DeviceDetailView.test.tsx › actions render after the h1 only when ready`. Code check: `useDeviceDetailActions.tsx` mounts the same six dialog components the list uses (`TransferDeviceDialog`, `ReturnDeviceDialog`, `ExtendDeviceDialog`, `TakeBackDeviceDialog`, `PlaceDeviceDialog`, `AssignDeviceDialog`), with no Edit/Delete dialog. Local run: `/devices/<id>` as owner, Admin and plain member shows the same buttons as that device's row on `/devices`. |
| 2 | After an action the page shows the updated device and history, a notice, and focus returns to the heading. | `device-detail-state.test.ts › refresh keeps the shown device until the answer; refreshed replaces it; stale answer dropped; 404 gives notFound; other failure keeps the device` and `› history refresh replaces items with the first page and resets the cursor; failure keeps the old items`. `device-detail-actions.test.ts › finishAction: sets the notice before awaiting refresh, then requests focus`, `› refresh failure replaces the notice with refreshFailed (role alert)`, `› refresh not_found clears the notice`, `› doneNotice per action`. `DeviceDetailView.test.tsx › notice region is always mounted (loading, error, notFound, ready); status tone → role=status, error tone → role=alert`. Local run: start a transfer on the detail page → no skeleton flash, Pending section and a `transfer_start` history row appear, the notice is read, focus is on the `h1`. |
| 3 | All new strings live in `src/ui/copy/*` (D36). | Diff check: the only new user-visible strings are under `devicesCopy.detail` in `src/ui/copy/devices.ts`; no string literals in JSX of the new/changed components. |

## Ming verification after merge
- Optional: screen reader check (NVDA / VoiceOver) that the notice is announced after Transfer / Give back on the
  detail page. Everything else is verifiable in a local run.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/devices/device-detail-state.ts` | Add `{type:"refresh",id}` and `{type:"refreshed",id,result}` to `DetailEvent` and `HistoryEvent`; handle them in `detailReducer` (lines 18-31) and `historyReducer` (lines 55-89). | Silent refresh: `load` resets to `INITIAL_*` (line 24, 63), which unmounts the h1, the actions and loses focus. | No |
| `src/ui/devices/device-detail-state.test.ts` | Reducer tests for the new events. | R5. | No |
| `src/ui/devices/useDeviceDetail.ts` | Add `refresh(): Promise<RefreshResult>` (lines 29-57 pattern) that dispatches `refresh` then `refreshed` for detail and history in parallel. | AC2. | No |
| `src/ui/devices/device-detail-actions.ts` (new) | Pure: `DetailDialog` union, `detailHandlers(open, cancel)`, `doneNotice(...)`, `finishAction(deps)`. | Pure logic first (planner rule 6); testable without a DOM. | No |
| `src/ui/devices/device-detail-actions.test.ts` (new) | Unit tests for the pure module. | R5, AC1, AC2. | No |
| `src/ui/devices/useDeviceDetailActions.tsx` (new, `"use client"`) | Hook owning the dialog state, notice, busy id, cancel flow; returns `{ handlers, busyId, notice, dialogs }`. | Dialog host for the detail page (duplicate of the list wiring, see Approach step 4). | No |
| `src/ui/devices/DeviceDetailView.tsx` | Add props `notice` and `actions?: React.ReactNode`; always-mounted `aria-live` region; actions under the h1 in the ready branch. | AC1, AC2. | No |
| `src/ui/devices/DeviceDetailView.test.tsx` | New cases for notice region and actions placement; existing cases unchanged. | R5. | No |
| `src/ui/devices/DeviceDetailPage.tsx` | Create `roomsApi`/`seatsApi`, call `useDeviceDetailActions`, pass `notice`/`actions`, render `dialogs`, add the post-action focus effect. | Wiring. | No |
| `src/ui/copy/devices.ts` | New strings under `detail` (lines 279-301): `done.assigned`, `done.holdingSaved`, `done.placement`, `refreshFailed`. | D36, AC2 (a notice after every action). | No |

`DevicesPage.tsx`, `DeviceRowActions.tsx`, `device-actions.ts` and every dialog file are **not** changed.
**No High path is touched** (no migration, no server, no config, no build/deploy file).

## Data model / migration
None.

## API contract
None (uses the existing `api.get`, `api.history`, `api.cancelHandoff`, `api.handoffCount` and the dialogs' own calls).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `device-detail-state.test.ts › detail refresh keeps status/device and only bumps latest` | No skeleton on refresh. |
| `device-detail-state.test.ts › detail refreshed ok replaces the device in place` | AC2 updated device. |
| `device-detail-state.test.ts › detail refreshed for an older id is dropped` | Stale-answer guard. |
| `device-detail-state.test.ts › detail refreshed not_found → notFound, device null` | Device deleted meanwhile. |
| `device-detail-state.test.ts › detail refreshed other error keeps status ready and the old device` | Failed refresh does not blank the page. |
| `device-detail-state.test.ts › history refresh keeps items, clears loadingMore/moreError, bumps latest; refreshed ok replaces items with page 1 and its nextCursor/holderSince; failure keeps old items; a loadMore answer for an older id after refresh is dropped` | AC2 first history page; loadMore race. |
| `device-detail-actions.test.ts › detailHandlers: flag table` | AC1 gating via real `rowActions` with the detail handler set: `canTransfer`→`transfer`; `canReturn`→`giveBack`; `canAssign`→`assign`; `canEditHolding`→`editHolding`; `canTakeBack`→`takeBack`; `placeModes` → `place`/`move`/`return`; `mine && overdue && !pending`→`extend`; pending `transfer`/`return`/`extension` with `canCancel` → the matching cancel key and no `extend`; `canEdit && canDelete` with all else false → `[]`; all flags false → `[]`. |
| `device-detail-actions.test.ts › detailHandlers opens the matching dialog` | Each handler calls `open({kind, device, mode?})` with the right kind (`transfer`, `return`, `extend`, `takeBack`, `place`+mode, `assign`+`"assign"`, `assign`+`"edit"`), and `onCancelHandoff` calls `cancel(device)`; no `onEdit`/`onDelete` keys. |
| `device-detail-actions.test.ts › doneNotice per action` | transfer/return/extend → `devicesCopy.{transfer,giveBack,extend}.sent(name, inv)`; takeBack → `takeBackDone(device, "all")` (no filter hint); assign `assign` → `detail.done.assigned`; assign `edit` → `detail.done.holdingSaved`; place (any mode) → `detail.done.placement`. Names with Vietnamese diacritics (`Máy trạm`) pass through unchanged. |
| `device-detail-actions.test.ts › finishAction order` | Fakes record calls: `setNotice(notice)` happens before `refresh()` resolves, `requestFocus()` after it resolves. |
| `device-detail-actions.test.ts › finishAction refresh failure` | Refresh `{ok:false, code:"unavailable"}` → final notice `{tone:"error", text: detail.refreshFailed}`, focus still requested. |
| `device-detail-actions.test.ts › finishAction refresh not_found` | Notice cleared (`null`), focus requested (the notFound h1). |
| `device-detail-actions.test.ts › finishAction with a null notice (cancel result with refresh false)` | Cancel error that changed nothing: notice kept, no refresh call, focus requested. |
| `DeviceDetailView.test.tsx › notice region is always mounted` | `<div aria-live="polite">` present in loading, error, notFound and ready markup. |
| `DeviceDetailView.test.tsx › notice tones` | `tone:"status"` → `role="status"` with text; `tone:"error"` → `role="alert"`. |
| `DeviceDetailView.test.tsx › actions render after the h1 only when ready` | `actions={<p>ACTIONS-MARK</p>}`: present after `</h1>` and before the Details section when ready; absent in loading, error, notFound. |

Tests use `renderToStaticMarkup` and plain fakes, as the existing tests do (there is no DOM test library in the repo;
do not add one).

## Approach
1. **Reducers** (`device-detail-state.ts`).
   - `detailReducer`: `refresh` → `{ ...state, latest: id }`. `refreshed` (id must equal `latest`): ok → same as
     `loaded` ok; `not_found` → `{status:"notFound", device:null, errorCode:"not_found"}`; other error → `state`
     unchanged except `latest` (keep the old device).
   - `historyReducer`: `refresh` → `{ ...state, latest: id, loadingMore: false, moreError: false }`. `refreshed` ok →
     same as `loaded` ok (page 1 replaces items); failure → `state` unchanged.
   - Keep `load`/`loaded`/`loadMore`/`moreLoaded` as they are.
2. **Hook** (`useDeviceDetail.ts`): `refresh = useCallback(async () => { const dId = ++detailCounter.current;
   const hId = ++historyCounter.current; dispatch refresh for both; const [d, h] = await Promise.all([api.get(deviceId),
   api.history(deviceId)]); if mounted dispatch refreshed for both; return d.ok ? {ok:true} : {ok:false, code:d.code} })`.
   Export `type RefreshResult = { ok: true } | { ok: false; code: string }`. Return it from the hook. A history failure
   alone does not change the result (the history card keeps its old items).
3. **Pure module** (`device-detail-actions.ts`, imports only `@/lib/...`, `../copy/devices`, `./device-actions` types,
   `./return-device` for `takeBackDone`, `./assign-device`/`./place-device` types):
   - `export type DetailDialog = { kind: "transfer" | "return" | "extend" | "takeBack"; device: DeviceDto } | { kind: "place"; device: DeviceDto; mode: PlaceMode } | { kind: "assign"; device: DeviceDto; mode: AssignMode }`.
   - `detailHandlers(open: (d: DetailDialog) => void, cancel: (device: DeviceDto) => void): DeviceRowHandlers` — the
     eight handlers, never `onEdit`/`onDelete`. `onAssign` and `onEditHolding` both map to `kind:"assign"` with their mode, as the list does.
   - `doneNotice(d: DetailDialog): Notice` per the table above (`Notice = { tone: "status" | "error"; text: string }`).
   - `finishAction({ notice, refresh, setNotice, requestFocus }: { notice: Notice | null; refresh: (() => Promise<RefreshResult>) | null; ... })`:
     `setNotice(notice)`; if `refresh` then `r = await refresh()`; `r.ok === false && r.code === "not_found"` →
     `setNotice(null)`; other failure → `setNotice({tone:"error", text: detail.refreshFailed})`; finally `requestFocus()`.
4. **Dialog host** (`useDeviceDetailActions.tsx`) — **duplicate, do not extract** (see Assumptions A1):
   - Inputs: `{ api, roomsApi, seatsApi, refresh, requestFocus }`.
   - State: `open: DetailDialog | null`, `notice`, `busyId`, `acting` ref (re-entry guard, as `DevicesPage.tsx:67`).
   - `refreshAll = async () => { const [r, count] = await Promise.all([refresh(), api.handoffCount()]); if (count.ok) setBadge(count.value); return r; }` with `setBadge = useSetHandoffBadge()` (keeps the nav badge in step, as the list's `refreshAll` does at `DevicesPage.tsx:104-115`).
   - Handler `open`: `setNotice(null); setOpen(d)`. Handler `cancel` mirrors `DevicesPage.tsx:187-199`: guard with
     `acting`, `setBusyId(device.id)`, `cancelOutcome(await api.cancelHandoff(pending.id), device, pending.kind)`, then
     `finishAction({ notice: outcome.notice, refresh: outcome.refresh ? refreshAll : null, ... })`, release guard.
   - Each dialog's `onDone`: `setOpen(null)`, guard + `setBusyId(device.id)`, `finishAction({ notice: doneNotice(open), refresh: refreshAll, ... })`, release. Assign `onDone(mode)` and Place `onDone()` take the device and mode from the `open` value captured when the dialog was opened.
   - Each dialog's `onStale`: `void refreshAll()` only (no notice, no focus; the dialog shows its own error).
   - `dialogs`: the six dialog elements with the same props as `DevicesPage.tsx:323-405`, each fed
     `open?.kind === "<kind>" ? open.device : null` (Place/Assign: `open={open?.kind === "place"}` etc.).
   - Returns `{ handlers: useMemo(() => detailHandlers(...)), busyId, notice, dialogs }`.
5. **View** (`DeviceDetailView.tsx`): props `notice?: Notice | null` and `actions?: React.ReactNode`. Render the
   `<div aria-live="polite">` (markup copied from `DevicesView.tsx:62-73`) right after the back link, outside every
   status branch. In the ready branch render `{actions}` right after `heading(device.name)` and before the Details section.
6. **Page** (`DeviceDetailPage.tsx`): `roomsApi`/`seatsApi` via `useMemo` as `DevicesPage.tsx:51-52`;
   `const [focusSeq, setFocusSeq] = useState(0)`; `requestFocus = () => setFocusSeq(n => n + 1)`; an effect on
   `focusSeq` (skip 0) calls `headingRef.current?.focus()` after the commit, so a ready → notFound switch focuses the
   new h1 (same reason as `DevicesPage.tsx:83`). Keep the one-shot mount focus effect (lines 18-23) unchanged. Pass
   `notice`, `actions={detail.device && <DeviceRowActions device={detail.device} handlers={handlers} busyId={busyId} />}`, and render `{dialogs}` after the view (outside the view so they survive status changes).
7. **Copy** (`src/ui/copy/devices.ts` under `detail`):
   - `done: { assigned: (name, inv) => \`${name} (${inv}) assigned.\`, holdingSaved: (name, inv) => \`Holding of ${name} (${inv}) saved.\`, placement: (name, inv) => \`Placement of ${name} (${inv}) updated.\` }`
   - `refreshFailed: "The change was saved, but the page could not be refreshed. Reload the page to see the latest state."`
8. Run Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules: **R1** all new code is in `src/ui/**` and imports only ui and `@/lib` (no `src/server`); `check:layers` proves it.
**R4** `DevicesPage` and the dialogs are untouched; the extraction is a follow-up. **R5** pure module and reducers
have unit tests. **D36** every new string in `copy/devices.ts`. R2/R3/R6/R7 not affected (no server, schema or env change).

Size estimate: about 300 lines of product code (host hook ~140, pure module ~70, reducers/hook ~50, view/page ~35,
copy ~10) and about 250 lines of tests. Fits M.

## Specialist input used
- frontend-developer rec 1 (duplicate in a new host file, keep `DevicesPage` untouched, follow-up to unify): **adopted** (A1).
- frontend-developer rec 2 / ux rec 2 (the eight handlers, no Edit/Delete, no `bannerHandlers`, keep `rowActions` order): **adopted**.
- frontend-developer rec 3 / ux rec 4 (silent `refresh()` without `load`; keep old data on failure; 404 → notFound): **adopted**, with explicit `refresh`/`refreshed` reducer events because `loaded` checks `latest`, which only `load` sets today.
- frontend-developer rec 4 / ux rec 1 (always-mounted `aria-live` region outside the ready branch, `takeBackDone(device, "all")`, clear the notice when an action opens): **adopted**.
- frontend-developer rec 5 / ux rec 5 (focus h1 after refresh, keep one-shot effect): **adopted**, focus applied in an effect after commit. Focus also after Assign `edit` and Place (ux rec 5), unlike the list, because AC2 says focus returns after an action.
- frontend-developer rec 6 (`actions` as a ReactNode prop of the pure view): **adopted**.
- ux rec 3 (extract `useDeviceDialogs` from `DevicesPage` now): **rejected** for this ticket, see A1.
- ux rec 5 / open question 2 (notices for Place, Assign, Edit holding with new copy): **adopted** (A2).
- ux rec 7 (`onStale` → silent refresh): **adopted**.
- ux rec 8 (inline overdue line in Holder): **already met** — `OwnerLabel` shows the overdue chip and `holding.expired` today (`DeviceDetailView.test.tsx:88-97`); no `OverdueBanner` on the detail page.
- ux rec 9 (touch target / `className` on `DeviceRowActions`): **not adopted**; same `size="sm"` buttons as the list, consistent; change would touch a shared component (follow-up if wanted).
- ux rec 10 (`role="group"` + `aria-label` on the bar): **not adopted**; needs a `DeviceRowActions` change; each button already has a per-device `aria-label`.
- frontend-developer open question 3 (refresh the nav badge): **adopted** (A4).

## Assumptions
- **A1 (for Ming) — duplicate, do not extract `useDeviceDialogs` now.** The consultants disagree (frontend: duplicate;
  ux: extract). Chosen: duplicate, because it is the smaller risk:
  - The list wiring is entangled with list-only state: `filter` (`takeBackDone(device, filter)`, `filterAfterCreate`),
    `refreshAll` over three handoff lists + overdue list + badge, and `focusTarget`. A shared hook needs a callback
    contract for all of that and a change to `DevicesPage.tsx`, the busiest UI file, in a ticket whose goal is the detail page (R4).
  - `DevicesPage` has no interactive tests (static-markup tests only), so a "pure move" there could regress the list
    without any test noticing.
  - Duplication is bounded (~100 lines of dialog JSX) and reuses every outcome helper and copy string, so drift is limited to wiring.
  - Follow-up to record: "Extract a shared device dialogs host used by `DevicesPage` and `DeviceDetailPage`".
- **A2 — notices for every action.** AC2 says "a notice" after an action, so Assign, Edit holding and Place get new
  notices (`detail.done.*`), though the list shows none. Place's `onDone` also fires when a stale re-fetch shows the
  mode no longer applies (`PlaceDeviceDialog.tsx:219`), so its copy is neutral ("Placement … updated"), not "placed".
- **A3 — refresh failure.** A failed post-action refresh keeps the old device and history and replaces the success
  notice with `detail.refreshFailed` (`role="alert"`). A 404 shows the existing notFound card with no notice (an
  Assign that settles `not_found` as done, `assign-device.ts:104`, would otherwise claim success).
- **A4 — nav badge.** The detail page refreshes the handoff badge after each action (`api.handoffCount` + `useSetHandoffBadge`), as the list does; a failed count keeps the old badge.
- **A5 — existing `*.gone` copy** ("… The list has been refreshed.") is reused for a cancel on a handoff that is no
  longer pending; slightly list-worded on the detail page. Not changed here (shared with the list); follow-up if Ming wants detail wording.
- **A6** — After Take back or Give back the page stays and shows the refreshed state (no redirect to the list).
- **A7** — Starting transfer/return/extension works on `main` (BUG-002, PR #104, merged).
- **Hotspots:** none found. No other ticket in `IN_PROGRESS`/`REVIEW`; SIM-039.7 (`DONE`, PR #111) is about device
  types and is not known to touch these files. If it changed `src/ui/copy/devices.ts`, expect a trivial rebase.

## Blocking questions
None.

## Split proposal
None (estimated ~300 product lines + ~250 test lines, within one cycle).
