Status: READY

# Plan — SIM-012.3: Add and delete seats, release and role gating (room switcher split out)

> **Read first.**
> - **Size:** the full ticket is about **705 production and 405 test lines**. SIM-012.2 overran its production estimate
>   by 54 to 62%, so the full ticket could reach about 1,100 production lines. That is not a size M.
> - **Cut:** the **room switcher moves to a new ticket, proposed as SIM-012.5** (see `## Split proposal`). Nothing in
>   this slice or SIM-012.4 depends on it. This plan covers the seat actions: about **565 production and 330 test
>   lines**, still above the ~400-line guide. The next cut, if Ming wants one, is Add seats (about 100 production lines).
> - **Gate:** no file matches a High path, so `Gate` stays `none`. PR risk tier: medium (default, `src/ui/**`).
> - **No server, API, schema or migration change is needed.**
> - **Browser:** agents do not start a dev server for this ticket. Real dialogs, focus and layout are on Ming's list.

## Scope summary
Ticket (`work/tickets/SIM-012.3/ticket.md`), parts this slice implements:
> "Role gating helpers for this slice's actions. `seat.mine` shows Release, and Admin sees add and delete."
> "Admin: add seats (count 1 to 50) with `POST /api/rooms/[id]/seats`."
> "Admin: delete a seat with `DELETE /api/seats/[id]`, after confirmation."
> "Occupant: release their own seat with `POST /api/seats/[id]/release`, after confirmation."
> "One shared confirm dialog for Delete and Release, stacked over the seat panel."
> "Reload after every success and after any 404, 409 or 422. Branch on `error.code`, never on status."
> "Focus fallback when the control that opened an action no longer exists."

Moved to SIM-012.5: "Room switcher in a thin bar under the header", AC1, and the `AppShell` / `AppShellView` edits.

Spec (`docs/spec-v1.md`):
> SEA-01 (l.229-231): "An Admin adds seats to a room and deletes them through the API and a plain seat list on the room
> page (D47)". "Deleting a seat that has an occupant or any device is refused with a clear message (seatMGT guard)."
> ROO-02 (l.222-224): "Numbers are never reused". "No API or form lets anyone type in a seat code."
> SEA-05 (l.254-255): "always shows current data." "Actions in the panel show only to roles allowed to use them."
> REG-03 (l.388): "A user releases a seat they occupy without approval; the occupant is cleared and DEV-06 runs."

Decisions (`work/decisions.md`):
> D22: "users release their own seat without approval".
> D30: "Seat numbers are never reused (per-room counter)."
> D36: "all user-facing text lives in copy files".
> D47, as quoted in the SIM-012.2 plan (l.26): "the room detail page lists seats in the clean UI kit, with the seat panel
> opened from the list (`?seat=<code>`)".

SIM-012.2 `### Settled for SIM-012.3 and SIM-012.4` applies and is not decided again.

**Spec versus ticket:** no conflict in this slice.
- Release confirmation does not conflict with REG-03. A confirmation is the user's own step, not an approval.
- SHL-01 (l.437-438) still requires a room switcher, so **SIM-012.5 must ship before v1 is done**.
- SEA-05 overrides the consultant's "keep the last good seat": the old seat may stay only while a refetch is in flight.
  A failed refetch shows the error (Approach 4).

## Acceptance criteria → verification
Ticket AC numbers are kept. **AC1 moves to SIM-012.5.**

| # | Criterion (this slice) | How the reviewer verifies it |
|---|---|---|
| 2 | Add and Delete only for an Admin; Release only on a seat marked `mine` | `seat-actions.test.ts` › `canManageSeats`, `canRelease`; `SeatActions.test.tsx` › role matrix; `SeatsView.test.tsx` › "Add only with `onAdd`". Code read: tier comes from `useSession()`, `mine` from the detail seat |
| 3 | Admin adds 1 to 50 seats and the table shows them; an invalid count shows a field error and sends nothing | `seat-actions.test.ts` › `parseAddCount`; `seats-api.test.ts` › `add`. Code read: `submitAdd` returns before the API call on an invalid count. Real behaviour: B2 |
| 4 | Deleting an empty seat confirms, removes it, closes the panel and moves focus to a control that exists | `seat-actions.test.ts` › `actionOutcome` delete, `focusAfterDelete`; `seats-api.test.ts` › `remove`. Real behaviour: B3 |
| 5 | A seat with an occupant or device shows a clear message and is not deleted, including after a concurrent change | `seat-actions.test.ts` › `deleteBlock`, `actionOutcome` `seat_not_empty`. Code read: a blocked seat opens no confirm and sends nothing. Real behaviour: B4 |
| 6 | Release confirms; if the seat changed meanwhile, the page reloads and says so | `seat-actions.test.ts` › `actionOutcome` release `not_allowed`; `seats-api.test.ts` › `release`. Real behaviour: B5 |
| 7 | Unit tests cover role gating, count check, per-action error mapping and the API client | `pnpm test` with the tests below |
| 8 | Project checks and rules | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `no-literals.test.ts` stays green |

### What each tool can prove
- **Vitest** runs in `node` with `renderToStaticMarkup`, with no jsdom. It proves pure logic, the API client with a fake
  fetcher, and markup for given props. Effects, clicks, focus and `showModal` never run.
- **`pnpm build`** proves types, the bundle and the layer split. It proves nothing about runtime dialog or focus order.
- **Scratch harness (optional, reviewer):** the SIM-012.2 fake hook runtime can drive `useRoomSeats` and `useSeatActions`
  from the scratchpad, never committed. It is evidence for state order only. It is not a browser.
- **A real browser** is the only proof of the list below.

## Ming verification after merge
Agents do **not** run these. A missing `SIMAP_DEV_TOKEN_FILE` override could make the server use Ming's real dev token.
Use a local room with seeded data, at 390 px and desktop, in light and dark.

- **B1 Roles:** as User, no Add or Delete; Release only on your own seat. As Manager, no Add or Delete. As Admin, Add and
  Delete; Release too if you sit there.
- **B2 Add:** count 1 and 50 work and the table updates. `0`, `51`, `1.5`, `1e1` and empty show the field error and send
  no request (Network tab). Add works from an empty room. Focus returns to Add after success.
- **B3 Delete:** confirm opens over the panel with focus on **Cancel**. Esc and a scrim press close only the confirm, and
  focus returns to Delete. After confirm, the panel closes with no "Seat not found" flash and focus lands on the next
  row, else the previous row, else Add.
- **B4 Delete refused:** a seat with an occupant, with a device, and a seat that gains an occupant in a second tab after
  the panel opened. Each shows the message, the seat stays and the panel updates.
- **B5 Release:** confirm works; afterwards the panel shows Empty, Release is gone and focus is on the panel heading. If
  another tab gives the seat to someone else first, the page reloads and says the seat changed.
- **B6 In flight:** with a throttled network, press Esc twice during a write and press browser Back during a write. The
  write still finishes, the list reloads, any refusal is shown, and Delete or Release can be opened again.

## Files to create / modify
**No file matches a High path.**

| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/seats/seat-actions.ts` | Create. Pure: `canManageSeats`, `canRelease`, `parseAddCount`, `deleteBlock`, `actionOutcome`, `keepRowsOnError`, `focusAfterDelete` | Pure logic first | No |
| `src/ui/seats/seat-actions.test.ts` | Create | AC2-AC7 | No |
| `src/ui/seats/seats-api.ts` | Generalise `get` (l.19-36) to `call(path, init, read)` as in `rooms-api.ts:20-40`; add `add`, `remove`, `release` | API client | No |
| `src/ui/seats/seats-api.test.ts` | Add write cases | AC7 | No |
| `src/ui/seats/useRoomSeats.ts` | Keep rows on a transient reload failure (l.69); add silent `refresh` | Stale panel, 012.2 review follow-up | No |
| `src/ui/seats/useSeatActions.ts` | Create. Dialog, busy and notice state; runs writes and applies `actionOutcome` | One action flow, reused by SIM-012.4 | No |
| `src/ui/seats/SeatActions.tsx` | Create. Buttons and notice for the panel's `actions` slot | Role-gated controls | No |
| `src/ui/seats/SeatActions.test.tsx` | Create | AC2 | No |
| `src/ui/seats/ConfirmSeatDialog.tsx` | Create. Thin wrapper on `EntityFormDialog`, as `DeleteRoomDialog.tsx:67-94` does | One shared confirm | No |
| `src/ui/seats/AddSeatsDialog.tsx` | Create. Count field on `EntityFormDialog` | Add seats | No |
| `src/ui/seats/SeatActionDialogs.test.tsx` | Create | Dialog markup | No |
| `src/ui/seats/SeatsPage.tsx` | Wire tier, actions, dialogs, delete close and focus | Container | No |
| `src/ui/seats/SeatsView.tsx` | Optional `onAdd` and `notice` props; Add button with `data-add-seats` near the `<h1>` (l.48-51) | Add also works in an empty room | No |
| `src/ui/seats/SeatsView.test.tsx` | Add cases | AC2 | No |
| `src/ui/seats/SeatDetailPanel.tsx` | `tabIndex={-1}` and a ref on the `<h2>` (l.178); optional `focusSignal` prop; correct the comment at l.105 | Settled focus fallback | No |
| `src/ui/seats/SeatDetailPanel.test.tsx` | Add: heading is focusable | Focus target exists | No |
| `src/ui/copy/seats.ts` | Add an `actions` group | D36 | No |

Not changed: `src/ui/EntityFormDialog.tsx` (shared), `src/ui/copy/api.ts`, `src/lib/icons.ts` (Add uses the existing `add`
icon; Delete and Release have text only), `src/ui/index.ts`, and `src/ui/AppShell*.tsx` (SIM-012.5).

### Size estimate
| Area | Production | Tests |
|---|---:|---:|
| `seat-actions.ts` | 110 | 170 |
| `seats-api.ts` | 40 | 70 |
| `useRoomSeats.ts` | 35 | 0 |
| `useSeatActions.ts` | 135 | 0 |
| `SeatsPage.tsx` | 35 | 0 |
| `SeatActions.tsx` | 45 | 40 |
| `ConfirmSeatDialog.tsx` + `AddSeatsDialog.tsx` | 95 | 25 |
| `SeatsView.tsx` + `SeatDetailPanel.tsx` | 35 | 25 |
| `copy/seats.ts` | 35 | 0 |
| **This slice** | **~565** | **~330** |
| Room switcher (SIM-012.5) | ~140 | ~75 |
| **Full ticket** | **~705** | **~405** |

If this slice overruns like SIM-012.2, expect up to about 870 production lines. Record the real `git diff --numstat`
figures, split into production and test, in `impl-log.md` and the PR.

## Data model / migration
None.

## API contract
No endpoint change. Consumed by this slice, verified against the merged routes:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| POST | `/api/rooms/[id]/seats` | `{count}`, integer 1..50, no other key (`validate/seat.ts:18-27`) | 201 `{items: SeatDto[]}` | 400 `invalid_request`, 404 `not_found`, 503, auth codes | admin (`route.ts:40`) |
| DELETE | `/api/seats/[id]` | none | 204, no body | 404 `not_found`, 409 `seat_not_empty`, 503, auth codes | admin (`route.ts:34`) |
| POST | `/api/seats/[id]/release` | none | 200 `SeatDto`, **also when already empty** (`rules.ts:37`) | 404 `not_found`, 409 `not_allowed`, 503, auth codes | user (`release/route.ts:19`) |

`apiFetch` resends once on 401/403 (`fetch.ts:57-69`). That is safe here because those codes come only from `withAuth`,
before any write (R7).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `seat-actions.test.ts` › `canManageSeats`: user and manager false; admin true; null and undefined false | Gating |
| `seat-actions.test.ts` › `canRelease`: follows `seat.mine` for every tier | Gating |
| `seat-actions.test.ts` › `parseAddCount`: `1`, `50`, ` 5 `, `05` valid; empty, `0`, `51`, `-1`, `1.5`, `1e1`, `0x5`, `٥`, `５`, very long digit string invalid | Count bounds |
| `seat-actions.test.ts` › `deleteBlock`: empty null; occupant; device via `deviceCount` when `devices` is empty; both | SEA-01 guard, list cap |
| `seat-actions.test.ts` › `actionOutcome` add: ok; `not_found`; `invalid_request` no reload; each auth code no reload; `unavailable` and `internal` reload and warn before retry | Per-action mapping |
| `seat-actions.test.ts` › `actionOutcome` delete: ok closes; `not_found` closes with message; `seat_not_empty` stays with message; auth no reload; `unavailable` stays and reloads | Per-action mapping |
| `seat-actions.test.ts` › `actionOutcome` release: ok; `not_allowed` says the seat changed; `not_found`; auth no reload; `unavailable` reloads | Per-action mapping |
| `seat-actions.test.ts` › `actionOutcome`: an unknown domain code reloads and shows the API message | Ticket reload rule without reading status |
| `seat-actions.test.ts` › `keepRowsOnError`: `unavailable`, `internal` true; `not_found` and auth codes false | Failed reload |
| `seat-actions.test.ts` › `focusAfterDelete`: next row; previous when last; null when none left; never the deleted code, even if a failed reload kept it | Focus target |
| `seats-api.test.ts` › `add`: POST, encoded path, JSON `{count}`, reads `items`; bad body is `internal` | API client |
| `seats-api.test.ts` › `remove`: DELETE, encoded path, 204 is `null` | API client |
| `seats-api.test.ts` › `release`: POST, encoded path, returns the seat; bad body is `internal` | API client |
| `seats-api.test.ts` › each write: error code read from body; `ApiAccessError` mapped; network error is `unavailable` | Never throws |
| `SeatActions.test.tsx` › role matrix; no buttons unless the view is ready; notice renders in every view | AC2 |
| `SeatActionDialogs.test.tsx` › closed renders nothing; confirm shows the seat code with Vietnamese-safe text intact; Cancel comes before submit; count field is `type="text"` with `inputMode="numeric"` | Dialog markup |
| `SeatsView.test.tsx` › Add only with `onAdd`, also in the empty state; absent when the room is missing; `notice` renders as an alert | Page controls |
| `SeatDetailPanel.test.tsx` › heading has `tabindex="-1"` | Focus target |

## Approach
1. **Pure first.** Write `seat-actions.ts`, the copy and the API client, with their tests.
2. **`parseAddCount(raw)`.** Trim, require ASCII `/^[0-9]+$/`, convert, then reuse `validateSeatAdd({ count })`. Do not call
   `Number(raw)` before the regex: it accepts `1e1` and `0x5`.
3. **`actionOutcome(action, result)`** returns `{ reload, closePanel, message }`, using `result.code` only:
   - No reload for the four auth codes or `invalid_request`. Every other failure reloads. This meets the ticket's
     404/409/422 rule without reading a status.
   - `unavailable` and `internal` may hide a **committed** write. For Add this matters most, because a blind retry would
     create extra seats whose numbers are never reused (D30). Close the dialog, reload, and show "check the list before
     adding again".

   | Action | Code | Result |
   |---|---|---|
   | Add | ok | close dialog, reload |
   | Add | `not_found` | close dialog, reload; the list 404 shows room not-found |
   | Delete | ok | close panel, reload |
   | Delete | `not_found` | close panel, reload, page message "already deleted" |
   | Delete | `seat_not_empty` | panel stays, reload, message |
   | Release | ok | reload |
   | Release | `not_allowed` | reload, message "this seat changed" |
   | Release | `not_found` | reload; the panel shows seat not-found |

4. **`useRoomSeats`.**
   - Add `refreshDetail`: no `loading` flip, reads the current seat from an `openIdRef`, uses `detailCounter`. A closure
     `openId` is unsafe: after Back during a write it would bump the counter, cancel the new seat's load and leave its
     panel on "Loading" for good.
   - On failure, set the detail error. Never show the old seat as current after a failed refetch (SEA-05).
   - Export `refresh()` as `Promise.all([reloadSeats(), refreshDetail()])`.
   - At l.69, keep previous rows only when `keepRowsOnError(code)`. Auth and `not_found` still clear them.
5. **`useSeatActions`.**
   - A `busyRef` blocks a second write until `refresh()` settles, including while the panel still shows the old seat.
   - The confirm is valid only while `pending.seat.code === openCode`, so Back closes it with the panel.
   - **Every confirm result closes the confirm** and reports in the notice.
   - **`onClose` always closes a dialog, even during a write.** Do not ignore Esc while busy (see correction 6). The write
     continues and reports through the notice.
   - A notice carries `seatCode`. It shows in the panel while that seat is open, otherwise on the page. Clear it on the
     next action and when the open seat changes.
6. **Delete close and focus** (`SeatsPage`). On ok or `not_found`, in one tick with no `await` between:
   `setDismissedCode(code)`, `setFocusAfter({ code, codesBefore })`, `router.replace` (only if the URL still shows that
   seat), then `refresh()`.
   - `dismissedCode` treats that seat as closed, so the reload cannot flash "Seat not found". Clear it once the URL no
     longer shows the code.
   - A `useEffect` on `[focusAfter, list]` waits until `list.status !== "loading"`, then focuses the row from
     `focusAfterDelete`, else `[data-add-seats]`, else `#main`. It moves focus only if focus is on `body`, `#main` or the
     deleted row, so it never steals focus from a control the user moved to.
7. **Focus after a write that keeps the panel open.** After `refresh()`, bump `focusSignal`. The panel focuses its heading
   **only if `document.activeElement` is `body` or null**. So a surviving Delete button keeps focus, and a vanished Release
   button falls back to the heading (settled default).
8. **Dialogs.** Render `ConfirmSeatDialog` and `AddSeatsDialog` as **siblings** of `SeatDetailPanel` in `SeatsPage`.
   `ConfirmSeatDialog` takes `title`, `body`, `submitLabel`, `submitting`, `onClose` and `onConfirm`, so SIM-012.4 can use
   it for Remove with no change. `showModal` puts the first focusable element in focus, which is Cancel
   (`EntityFormDialog.tsx:96`), so no autofocus code is needed.
9. **Add field.** `DialogField` with `type="text"`, `inputMode="numeric"`, `icon="event_seat"`, `aria-invalid`, and no
   `required`, `min`, `max` or `maxLength`, so browser validation cannot hide the field error.
10. **Copy** (`seatsCopy.actions`), all English:
    - Delete confirm states that it cannot be undone and that requests for the seat are removed too
      (`init.sql:158` cascades).
    - Release confirm states that the seat's primary device becomes secondary (REG-03, DEV-06).
    - Blocked-delete text states why and **offers no in-app fix** (settled note). Do not reuse `apiCopy.seat_not_empty`,
      which says "Clear them first": an Admin has no UI for that until SIM-012.4 and SIM-013.

**SIM-012.4 readiness, without speculative code:** `actionOutcome`, `useSeatActions`, `SeatActions` and
`ConfirmSeatDialog` each extend by adding a case. Do not add assign, replace, remove or cannot-seat types, props or copy now.

**Rules:** **R1** `src/ui/seats` imports only `@/lib` and `src/ui`. **R2** no migration. **R3** no config. **R4** only the
files above. **R5** tests above and all checks green. **R6** org scoping stays on the server, and an org switch remounts
page state (`AuthGate.tsx:620-622`, `DevGate.tsx:191-193`). **R7** no route handler change. No new library. Copy lives only
in `src/ui/copy/seats.ts`.

## Specialist input used
`consult-frontend-developer.md`, checked against the code.

**Confirmed and adopted:**
- The panel is stale after a write: `loadDetail` is keyed on `openId` (`useRoomSeats.ts:80-99`).
- Calling `retryDetail` flips the panel to loading (l.86), so a silent refresh is needed.
- Sibling dialogs; the `/^\d+$/`-style count check; a text input with numeric mode; Add near the `<h1>`, including the
  empty state; tier from `useSession()`; `mine` from the detail seat; the server code list; `not_allowed` and the 200
  no-op on release.

**Corrected:**

| # | Consultant claim | What the code does | Effect on the plan |
|---|---|---|---|
| 1 | A loading flip unmounts the `actions` slot (l.10) | `{actions}` renders for **every** open view (`SeatDetailPanel.tsx:213`). Only a gate in the caller would unmount it | Buttons gate on `ready`; the notice renders in every view |
| 2 | After delete, focus falls to `#main` (l.14) | The list has not reloaded when the panel closes, so cleanup focuses the **still-present** row (l.137-142). The reload then removes it and focus drops to **`body`** | Focus effect waits for the reload (Approach 6) |
| 3 | Close through the URL, then reload (rec. 6) | If the reload wins, the row is gone while `?seat=` remains, and `panelView` shows "Seat not found" (`seat-view.ts:111-114`) | `dismissedCode` closes it in the same commit |
| 4 | Focus the close button after release (rec. 6) | The settled default says the panel heading (012.2 plan l.274) | Heading |
| 5 | A closure-based silent detail reload is enough (rec. 3) | After Back during a write, it would cancel the new seat's load (`detailCounter`, l.81, l.88) | `openIdRef` |
| 6 | Ignore Esc and scrim while submitting (rec. 5) | A browser may make a repeated `cancel` **non-preventable**. The native dialog would close while React keeps `open`, so the next `showModal` never runs and the button goes dead. The safety noted in the 012.2 plan (l.203) relies on `onCancel` always closing | `onClose` always closes; the write reports by notice |
| 7 | Keep the confirm open for retry on a failure (rec. 2) | Same desync risk, and a retry after an unknown result is unsafe | Every result closes the confirm |
| 8 | No new copy is needed (l.28) | `not_allowed` says only "This action is not allowed", which fails AC6. `seat_not_empty` tells the Admin to do something the UI cannot do yet | New strings in `copy/seats.ts`; `copy/api.ts` unchanged |
| 9 | Build a new confirm dialog with its own focus capture (rec. 5) | `EntityFormDialog` already captures and restores focus (l.45-49), and Cancel is first | Thin wrapper |
| 10 | A failed refetch can keep the last good seat (rec. 3) | SEA-05: "always shows current data" | Kept only while in flight |
| 11 | Keep all rows on any failed reload (l.56 and 012.2 follow-up) | That would also keep rows after an auth failure | Only `unavailable` and `internal` |

**Sibling stacking, verified by reading:** the confirm calls `showModal` after the panel, so it is on top. Esc fires `cancel`
on the top dialog only. A scrim press targets the confirm, so the panel's handlers (l.159-173) do not fire. Real behaviour
is B3.

**Switcher recommendations (rec. 9):** deferred to SIM-012.5, with corrections recorded in `## Split proposal`.

## Assumptions
Non-blocking, each with the default taken:
1. **Switcher split accepted.** The orchestrator or Ming creates SIM-012.5 and narrows this ticket's title, scope and AC1.
   If Ming wants it kept here, add the SIM-012.5 section as a last, separate commit (about +140 production lines).
2. **Stale panel (consult Q1):** the old seat stays visible only while the refetch runs, and actions stay blocked. A failed
   refetch shows the error.
3. **Delete message for devices (consult Q2):** says the seat has devices and cannot be deleted, with no in-app fix or named
   role until SIM-013.
4. **Add control placement (consult Q4):** shown only when the room resolves. With a `truncated` list it still shows, and
   the existing notice applies. New seats past the 500-row cap will not appear in the table.
5. **`SeatDetailPanel` edit (consult Q5):** in scope. The ticket lists `src/ui/seats/*`, and the settled default needs a
   focusable heading.
6. **Release that finds the seat already empty** is a 200 and cannot be told apart from a normal release. The panel simply
   shows Empty, with no "changed" message. AC6's message applies to `not_allowed`.
7. **Manager or Admin who occupies the seat** sees Release (012.2 assumption 2).
8. **Busy label:** the confirm's submit shows the shared "Saving…" (`kitCopy.saving`) rather than changing the shared dialog.
9. **Count input** trims surrounding spaces, since mobile keyboards can add one, and accepts leading zeros.
10. **Nits left alone (R4):** the singular at `copy/seats.ts:34`, the long `h1` code at `SeatsView.tsx:45`, shared `CLIP`, and
    rejecting `.` and `..` room codes.
11. **Hotspots:** no other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board. SIM-012.4 (BACKLOG) will edit the same
    `src/ui/seats` files after this one.

## Blocking questions
None.

## Split proposal
| Slice | Scope | Est. production / test lines | Depends on |
|---|---|---|---|
| **SIM-012.3 (this plan)** | Gating, Add, Delete, Release, confirm, reload and focus | ~565 / ~330 | SIM-012.2 |
| **SIM-012.5 (new)** | Room switcher (ticket AC1, spec SHL-01) | ~140 / ~75 | SIM-012.2 only |
| SIM-012.4 (unchanged) | Picker, assign, replace, remove, cannot-seat | ~470 (012.2 estimate) | SIM-012.3 |

If Ming wants this slice smaller still, cut **Add seats** next (about 100 production lines) into SIM-012.5.

### Settled for SIM-012.5
All verified against the merged code:
- **Placement:** a `flex-none` bar between `</header>` and `<main>` (`AppShellView.tsx:155-157`). Remove the empty slot at
  l.124-125. Take `roomSwitcher?: ReactNode`, rendered only when `session && roomSwitcher`, so `AppShellView.test.tsx` and
  `/dev/shell` render without it. `AppShell` is under `ApiFetchProvider` in both gates.
- **Go does not use `disabled`.** After navigating, the selected room equals the current one, so a disabled Go would drop
  keyboard focus. Go stays enabled and does nothing when the target is empty, current, or a dot code
  (`roomDetailHref` returns null).
- **Current room:** a pure `roomCodeFromPath` matching `/rooms/<code>` and `/rooms/<code>/edit`, with **no**
  `decodeURIComponent`: valid codes need no decoding (`validate/room.ts:13`) and a stray `%` would throw.
- **Refetch:** compare `pathname` with a `lastPath` ref initialised to the first path. A "skip first run" ref would refetch
  under StrictMode replay.
- **Failed refetch:** `useRooms` clears rooms (l.29), so keep the last good list in the switcher and do not change `useRooms`.
- **Select:** native, with a visually hidden label, no navigation on `change`, and a `<button type="button">` outside any form.
