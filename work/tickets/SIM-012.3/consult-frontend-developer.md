## Findings

**Merged code (what the slice plugs into)**
- `seats-api.ts:18-53`: `createSeatsApi` only has a private GET helper `get(path, valid)` (line 19). `errorCode` (line 8) and the `ApiAccessError` mapping (lines 22-28) are copied from `rooms-api.ts:9-40`. `rooms-api.ts` already has the write shape: `call(path, init, read)` plus `withBody` (lines 20-48), and `remove` returns `null` on 204 (lines 65-70). The seats client has no write method yet.
- `useRoomSeats.ts:55-71`: `reloadSeats` keeps `prev.seats` and only sets `status: "loading"`. It does not blank the rows.
  - `SeatsView.tsx:35-37` shows the skeleton only when `seats.length === 0`, so rows already stay mounted during a reload.
  - Exceptions: `useRoomSeats.ts:69` empties the rows on a failed reload, and `panelView` (`seat-view.ts:109`) turns the panel into `error` on any list error.
- **The real flicker is the detail, not the rows.** `loadDetail` (`useRoomSeats.ts:80-95`) is keyed on `openId`.
  - After a write `openId` is unchanged, so the detail is NOT refetched. The panel shows stale data (for example the old occupant after a release).
  - Calling `retryDetail` as-is runs `setDetail({ status: "loading", seat: null })` (line 86). `panelView` then returns `loading` (`seat-view.ts:116-125`), the panel body is replaced and the `actions` slot (`SeatDetailPanel.tsx:213`) unmounts.
  - A confirm dialog rendered inside `actions` would be torn down mid-flow.
- `SeatDetailPanel.tsx:126-144`: the close effect depends on `[open]` only.
  - Its cleanup focuses the row `[data-seat-code]` of `codeRef`, else the previous element, else `#main`.
  - After a delete the row is gone and `previous` is the removed row button (disconnected), so focus falls to `#main`. That already satisfies "a control that exists", but `#main` is a weak target.
  - On release the row stays, so the existing cleanup is fine.
  - The cleanup also fires when `open` flips to false, so the panel must close through the URL (`router.replace`, `SeatsPage.tsx:51`).
- `SeatDetailPanel.tsx:155-158`: `onCancel` calls `preventDefault()` and then `onClose`. Esc on a stacked inner dialog fires `cancel` only on the topmost modal dialog. It does not bubble to the panel's `onCancel`. React's `onCancel` is attached per element, but a nested `<dialog>` rendered as a DOM child of the panel dialog is a bubbling concern: `cancel` does not bubble natively, so there is no double close.
- `SeatDetailPanel.tsx:159-173`: the scrim handlers use `e.target === e.currentTarget`. A confirm dialog nested in the panel's DOM would make its own backdrop clicks target the inner dialog, so they will not trigger the panel close. A sibling render also works.
- `EntityFormDialog.tsx:42-51`: `showModal` plus a `previous?.focus()` restore. Its pointer-up closes on any scrim press (no rect check), which is fine for a small centred dialog. The `open` prop keeps it mounted-but-null, so a confirm built the same way needs no change to the panel.
- Tier is on the session: `session.tsx:32` `useSession()`, and `RoomsPage.tsx:24` already does `atLeastTier(session.tier, "admin")`.
  - `audit-state.ts:14` shows the pure helper pattern (`canViewAudit`) to copy for `canManageSeats(tier)`.
  - `seat.mine` comes with the seat DTO (`types.ts:31`), so Release needs no tier.
- Server codes (`seats.ts:23-30`, 48, 320, 375, 424):
  - Delete: 404 `not_found`, 409 `seat_not_empty`.
  - Release: 409 `not_allowed` when the seat is no longer yours; an already-empty seat is a 200 no-op that returns the seat (line 425).
  - Add: 400 `invalid_request`, 404 `not_found` (room gone), plus 401/403 from `withAuth`.
  - `occupant_changed` is only for assign and replace (SIM-012.4), not release.
  - `apiCopy` (`copy/api.ts:21-24`) already has text for all of these, so there is no new API copy.
- Shell: `AppShellView.tsx:124-125` has the empty slot `<div data-slot="room-switcher" />` inside the 64 px header. Its comment says "wired by SIM-010".
  - `AppShell.tsx:9-17` is below `AuthGate` (`layout.tsx:7-9`), so `useApiFetch` is available there. `AppShellView` and its test render without the API context.
  - `AppShellView` already takes `session`, `pathname` and `actions` as props. Its test (`AppShellView.test.tsx:10-52`) renders with these props only.
  - `nav.ts:59-62` `roomDetailHref(code)` returns null for dot segments. Use it for Go.

## Recommendations

1. **`seats-api.ts`, smallest diff** (covers the API-client test AC):
   - Generalise the private `get` into `call(path, init, read)` as in `rooms-api.ts`.
   - Keep the existing `list` and `get` behaviour and tests intact.
   - Add `add(roomId, count)`: `POST /api/rooms/{id}/seats` with `{count}`, 201, validate `Array.isArray(body.items)`.
   - Add `remove(seatId)`: `DELETE /api/seats/{id}`, 204 to `null`.
   - Add `release(seatId)`: `POST /api/seats/{id}/release`, returns `SeatDto` (check `typeof id === "string"`).
   - Never throws, and all calls use `encodeURIComponent`.
2. **Pure module `seat-actions.ts` (or in `seat-view.ts`) holds all unit-testable logic:**
   - `canAddDeleteSeats(tier)` and `canRelease(seat)`.
   - `parseAddCount(raw: string)`. The count input is a string, so reject `""`, `"1.5"`, `"1e1"`, `"0"` and `"51"`. Use `/^\d+$/` and then a range check against `SEAT_LIMITS.addMax`. Do not use `Number(raw)`, which accepts `"1e1"`, `" 5 "` and `"0x5"`. The `validateSeatAdd` in `lib/validate/seat.ts` takes a number, so reuse it after parsing.
   - `outcome(action, code | ok)` returns `{ reload: boolean; close: boolean; message: key }`.
     - Delete: ok to close+reload; `not_found` to close+reload with "already gone"; `seat_not_empty` to reload, stay open, show the message.
     - Release: ok to reload; `not_allowed` to reload with "seat changed".
     - Add: ok to reload; `not_found` to reload (room gone).
     - 401/403 codes and `unavailable`/`internal` do not reload, only show the message and keep the confirm open for retry.
     - Branch on `code` only, as in the ticket.
3. **`useRoomSeats` changes (minimal):**
   - Add `reloadDetail` that refetches without the loading flip. Add a `silent` flag to `loadDetail`, or give a second function that skips `setDetail(loading)` and only sets on result.
   - Keep the last good `seat` while refreshing. If that is too invasive, make `panelView` prefer `detail.seat` while `detail.status === "loading" && detail.seatId === row.id && detail.seat`.
   - Expose one `refresh()` that does `reloadSeats()` plus a silent detail reload. Race note: `listCounter`/`detailCounter` already drop stale responses, so a write followed by a quick reload is safe.
   - To keep rows during a reload, do not change line 69 for write reloads. A failed reload after a write is a legitimate error.
4. **Where the action state lives: `SeatsPage`.** It owns `pending: {kind: "delete"|"release", seat} | null`, `busy`, and an inline `message`. A new `SeatActions` presentational component goes in the `actions` slot of `SeatDetailPanel` (props: `seat`, `canManage`, `onDelete`, `onRelease`). Only render it when `view.kind === "ready"`, which is already how the slot behaves on the other views if you gate in `SeatActions` itself.
5. **Confirm dialog stacking:**
   - Render `ConfirmDialog` as a SIBLING of `SeatDetailPanel` in `SeatsPage`, not inside `actions`. A top-layer `showModal()` call made after the panel's makes it the topmost, regardless of DOM position.
   - This survives `actions` unmounting during a detail reload.
   - Model it on `EntityFormDialog` (`open`, `title`, `onClose`, `onConfirm`, `submitting`, `error`).
   - Put a `useEffect` in it so `previous = document.activeElement` is captured BEFORE `showModal()`. That gives you focus return to the Delete/Release button when the user cancels.
   - Do not let the panel's `[open]` cleanup run at the same time. Keep `submitting` disabling both Confirm and Cancel, and ignore Esc/scrim while `submitting`. Otherwise a write can finish with no visible result.
   - Use "Delete seat" and "Release seat" button labels. Do NOT put the focus on the confirm button by default. Use Cancel as the autofocus for the destructive action.
6. **Focus after delete.**
   - On success: `setPending(null)`, then `router.replace(seatHref(pathname, null))` to close the panel. The existing cleanup falls to `#main` because the row is gone. For a better target, after the reload settles focus the first remaining `[data-seat-code]` row, else the Add seats button (Admin), else `#main`.
   - Implement it as a small pure `focusFallback(root)` helper and call it in a `useEffect` keyed on a "focus request" counter, to run after the list state commits. Do not call it synchronously after `await`: the row is still in the DOM and the panel cleanup will run after it and steal focus.
   - After release: the row stays, so the panel cleanup is not triggered (the panel stays open). Re-focus the Release button's replacement. Since Release disappears (seat no longer mine), focus the panel close button (give it a `ref` or `autoFocus` via `data-autofocus`) instead of letting it drop to `body`.
7. **Admin add seats:** put the control in the room page header area of `SeatsView`, next to the `<h1>`: an "Add seats" Button opening an `EntityFormDialog` with a `DialogField type="number"` (use `inputMode="numeric"`, `min=1`, `max=50`, and `noValidate` handling, since `EntityFormDialog`'s `<form>` has no `noValidate`, so native validation could block the submit and hide the field error; set `type="text" inputMode="numeric"` instead).
   - It shows in the empty state too (`SeatsView.tsx:86-90`: an empty room needs it).
   - Do not place it in the table or in the panel. It needs no seat selection.
   - Gate it by `canManage` passed as a prop. Add the prop to `SeatsViewProps` as optional (`onAdd?: () => void`) so the existing `SeatsView.test.tsx` keeps rendering.
   - After success, close and reload. 50 seats at once can push the list past 500 (`truncated`), so the existing truncated message covers it.
8. **Tier for gating:** `useSession()` in `SeatsPage`, not a new fetch. UI hiding is UX only (the API is `tier: "admin"`); the `forbidden` code maps through `apiErrorMessage`. Do not pass tier into `useRoomSeats`.
9. **Switcher (`RoomSwitcher.tsx` in `src/ui`):**
   - A `"use client"` component that calls `useApiFetch`, `createRoomsApi`, `useRooms`. It is rendered in `AppShell.tsx` and passed as `roomSwitcher` to `AppShellView`, replacing the `data-slot="room-switcher"` div (keep the div as the wrapper so the tests that check the slot still pass).
   - Because `AppShell` mounts once in the layout, the component persists across navigation. So refetch on `pathname` change with a `useEffect(() => { void reload() }, [pathname, reload])`. Note that `useRooms` already loads on mount, so skip the first run (a ref) or you get two list requests.
   - `useRooms` has no loading-guard for the in-flight overlap. It does drop stale responses via `counter`, so overlapping refetches are safe. On a failed refetch, `useRooms` sets `rooms: []` (`useRooms.ts:29`), so the select would empty. Keep the last good list in the switcher (or ignore error states and render disabled with a retry).
   - Selected value is local state, initialised from the path (`/rooms/<code>`) by decoding the segment. Re-sync when the pathname changes. A `change` handler only calls `setValue`. Go calls `router.push(roomDetailHref(code))` and skips when the value equals the current room or is null.
   - Pressing Enter inside a native select does nothing, so Go must be a `<button type="button">`. Do not wrap it in a form with an implicit submit.
   - Label the select with `aria-label` (visually hidden), because the header is tight. At 390 px (`h-16`, many icons already) hide the Go text and keep the icon, or let the switcher wrap to its own row. The ticket asks for a "thin bar under the header", so render it as a sibling `<div>` after `<header>` (`AppShellView.tsx:155`) rather than inside it. That avoids header overflow and the mobile crowding.
   - Make `roomSwitcher?: ReactNode` optional in `AppShellView`, rendered only when `session && roomSwitcher`.
   - Copy goes in `copy/seats.ts` (the ticket says so) or a `shellCopy.roomSwitcher` entry.
10. **Release control:** show only when `seat.mine`, using the DETAIL seat (fresh) and not the list row. A stale `mine` on the list is harmless but the detail is fetched on open.

## Risks

- A silent detail reload that is not added leaves the panel stale after every write. This is the most likely review finding.
- A confirm dialog inside `actions` gets unmounted by a loading flip, which loses the in-flight result and focus. Sibling placement avoids this.
- A native number input inside `EntityFormDialog` can trigger browser validation bubbles and skip the field error. Use a text input with numeric mode.
- `useRooms` clears the list on a failed refetch, so the switcher can go empty after a transient error.
- The switcher refetches on every path change, including `?seat=` changes only if you depend on the search string. Depend on `pathname` only (`usePathname` does not include the query).
- Double write: `apiFetch` re-sends once on 401/403 (CLAUDE.md R7). The handlers return those codes only from `withAuth`, before side effects, so Delete and Release are safe. Still, disable Confirm while `busy` to stop a double click.
- The server delete of a room can leave the page showing a missing room while the switcher still lists it until the next path change. This is minor.
- Cannot be proven by Vitest here (node, static markup, no jsdom):
  - Stacked `showModal` order, Esc going only to the top dialog, and the focus trap.
  - Focus after delete or release (all `focus()` calls and the `[open]` cleanup order).
  - A native select not navigating on arrow keys, and Go-only navigation.
  - The refetch-on-path-change effect and the keep-rows-during-reload behaviour (they need a mounted component).
  - 390 px layout and the clipped text.
  - Provable in unit tests: the pure helpers (gating, count parse, outcome mapping, focus-target selection if written as a pure function over a list of codes), the API client with a fake fetcher, and static markup (`SeatActions` shows Release only when `mine`, and Add/Delete only for admin; the `ConfirmDialog` renders nothing when closed).
  - The manual browser check must be listed in the plan as the proof for these.

## Open questions

1. Is a stale detail after a write acceptable to show briefly, or must the panel keep the old seat until the new one arrives? This recommendation assumes keep-old.
2. Should the delete message for a seat with devices (no in-app fix until SIM-013) say who can clear them? The ticket note allows a message with no fix. Confirm the wording.
3. Should the switcher show all rooms, even for a user whose current path is not a room? This recommendation assumes yes, with an empty selected value and Go disabled.
4. Where should the Add control sit when the list is `truncated` or the room is `missing`? The recommendation hides it unless `resolution.kind === "found"`.
5. `SeatDetailPanel.tsx` change for focus after release: is adding a `data-autofocus`/ref for the close button in scope (touches a merged file by two lines)?
