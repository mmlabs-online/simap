## Findings

**Existing patterns SIM-012.4 extends (SIM-012.3 code)**
- `useSeatActions.ts:8-11` has the `SeatDialog` union (add | delete | release). Every non-add kind carries `seat`, and `:68-71` closes a dialog whose `seat.code !== openCode` (the Back rule). New kinds (assign, replace, remove, cannotSeat) must carry `seat` too, or Back will not close them.
- `run()` (`useSeatActions.ts:43-65`) has one `busyRef`/`busy` flag. It closes only `d === started` (identity compare, `:56`). It calls `actionOutcome(action, await call())`, which takes an `ActionResult` of `{ok:true}` or `{ok:false, code}`. `ActionResult` drops the success value, and nothing carries the refetched seat. The re-ask needs the fresh `SeatDto`, so it cannot go through `run()` as is.
- `actionOutcome` (`seat-actions.ts:49-80`) falls through to the `release` branch for any action other than add or delete. A new action would silently get `releaseChanged` copy. Extend the `SeatAction` union (`seat-actions.ts:8`) and add explicit branches. Auth codes and `invalid_request` do not reload (`:54`). That matches R7 and the settled table.
- `seats-api.ts:21-81`: `call()` never throws and returns `SeatsResult<T>`. `json(isSeat)` validates the body. There is no `members` client in `src/ui` (grep found only server route tests). The API shape is `MemberListResponse {items: MemberDto[], nextCursor: string|null, groups}` (`lib/members/types.ts:37-54`). The query accepts `q` (NFC, whitespace collapsed, max 80 code points; `member-query.ts:25-31`), `status`, `limit` and `cursor`. A repeated param returns 400 (`:19-21`).
- `EntityFormDialog.tsx`:
  - The effect `:42-51` calls `showModal()`, and its cleanup calls `close()` then `previous?.focus()`, where `previous` is `document.activeElement` at open time.
  - `onCancel` calls `preventDefault` then `onClose` (`:60-63`). Esc on a stacked dialog fires `cancel` only on the topmost native dialog.
  - The `<form onSubmit>` is at `:86`, with a submit button always present (`:103`), so Enter in a text input submits (implicit submission).
  - `overflow-hidden` is at `:71`, and `max-w-[440px]` limits the width.
- `ConfirmSeatDialog.tsx` and `AddSeatsDialog.tsx` are simple presentational wrappers. `AddSeatsDialog` mounts its inner component only while open (`:20-22`), so its field state resets on each open. Copy this pattern for the picker and the reason field.
- `SeatsPage.tsx:121-134` hard-codes confirm text for delete and release. `SeatsPage.tsx:164-178` renders the two dialogs as siblings with a single `dialog` state. Neither can hold a picker with a confirm on top of it.
- `SeatActions.tsx:23-24` names the Admin check `remove` and uses `canManageSeats` (Admin only). Manager+ gating needs a new predicate. `atLeastTier` is already imported in `seat-actions.ts:3`. Do not reuse `canManageSeats` for the Manager actions.
- `useRoomSeats.ts:57-62` and `:91-105` show the repo's stale-response idiom: a `useRef` counter plus a `mounted` ref, with the result dropped when `id !== counter.current`. Use the same idiom for the picker.
- `validateCannotSeat` (`lib/validate/seat.ts:45-65`) normalises with NFC and trims. It refuses reasons that are empty, too long, contain invisible characters, or lack a visible one. For `{cannotSeat:false}` it refuses any non-null `reason`, so send exactly `{cannotSeat:false}`. Send the validator's trimmed `value.reason`, not the raw input.
- The existing tests (`SeatActionDialogs.test.tsx:1-43`) use `renderToStaticMarkup` and assert on markup strings. `useEffect`, `showModal` and focus never run.

## Recommendations

1. **Members client (AC "API client").**
   - Add `src/ui/seats/members-api.ts`, or put it in `seats-api.ts` with a new `members` method. Name it `listActive({q, cursor, limit})`.
   - Build the query with `URLSearchParams`: `status=active`, `limit`, and `q` only when the trimmed text is non-empty.
   - Cap `q` client-side at 80 code points with `[...q].length` (not `.length`) and slice by code points (`MEMBER_LIMITS.q`).
   - Never send duplicate params. Pass `cursor` verbatim and never decode it.
   - Return `SeatsResult<{items, nextCursor}>`. Validate `Array.isArray(items)` and `typeof nextCursor`. Reuse `errorCode` from `seats-api.ts`, either by moving it to a shared file or by exporting it.
   - Test with a fake `ApiFetch`, as `seats-api.test.ts` does.
2. **Add `seatsApi.setOccupant(seatId, {memberId, expectedOccupantId})` and `seatsApi.setCannotSeat(seatId, body)`.**
   - `PUT .../occupant` always sends both keys, with `expectedOccupantId` as `null` for an empty seat, never omitted. `validateOccupantPut` rejects a missing key (`validate/seat.ts:35-38`).
   - Both return a `SeatDto` through `json(isSeat)`.
   - Test that the bodies match the validators exactly.
3. **Picker hook (`useMemberPicker`, UI layer).**
   - State: `{q, items, nextCursor, status: loading|ready|error, loadingMore}`.
   - Debounce about 300 ms with a `setTimeout` in an effect keyed on `q`, and `clearTimeout` in the cleanup. Fire the first load immediately on open with an empty `q`.
   - Keep a `requestId` ref. A new search, a reload after `member_not_assignable`, or an unmount increments it, so late responses are dropped (as at `useRoomSeats.ts:59-62`).
   - Load more must be tied to the query that produced the cursor. Capture `{id, q, cursor}`. If `id` changed when the response arrives, drop it and do not append. Otherwise append, de-duplicating by `id` in case a member shifted across pages. A new search resets `items` and `nextCursor`.
   - Do not issue a second load-more while one is in flight. This is a `loadingMore` guard, like `busyRef`.
   - Keep the previously selected member id only if it is still in the list. After a reload because of `member_not_assignable`, clear the selection if that member is gone, so the user cannot submit a stale radio.
   - Extract the pure decisions so they can be unit-tested. Examples: `isCurrent(requestId, latest)`, `mergePage(prev, page, reset)`, `clampQuery(raw)` and `nextRequest(state)`.
4. **Picker UI.**
   - The search input is `type="search"` or `text`. Add `onKeyDown` that calls `preventDefault` on Enter, only when the key event is not composing (`!e.nativeEvent.isComposing`, for Vietnamese IME).
   - The list is `role="radiogroup"` with native `<input type="radio">` inputs inside labels. Show `displayName` and `employeeCode` (a null code shows nothing, not "null").
   - The list wrapper gets `max-h-[40dvh] overflow-y-auto` (or similar). The dialog is capped at 440px and has no body scroll (`EntityFormDialog.tsx:71`).
   - "Load more" is `<button type="button">`. A live region (`role="status"`) announces loading and empty results, and an error line has a Retry that is also `type="button"`.
   - An empty-seat Assign has the submit disabled until a radio is chosen. Do not use `required` or `maxLength`, matching the existing test assertion pattern at `SeatActionDialogs.test.tsx:41`.
5. **Dialog state model, stacked dialogs and focus.**
   - Add one state, `{kind: "assign", seat, selected?: MemberRef, confirm?: ConfirmSnapshot}`, where `confirm` is the second layer. This keeps one `dialog` and one `busy`, and the Back rule at `useSeatActions.ts:68-71` still closes both.
   - Render the confirm as a sibling `ConfirmSeatDialog` with `open={confirm != null}`. The picker `<dialog>` stays open and mounted beneath it. A native `<dialog>` nested inside another dialog's `<form>` would also work, but the sibling keeps the picker's form out of the confirm.
   - While the confirm is open, disable the picker's submit and search, or leave them inert behind the modal. The top-layer modal already makes the picker inert.
   - Focus: `ConfirmSeatDialog` calls `showModal()`, and the browser focuses the first focusable element, which is Cancel (as the `ConfirmSeatDialog.tsx:3` comment says). On confirm close, the cleanup returns focus to the picker's submit button. Check this in a browser.
   - A subtle trap is in the cleanup order of `EntityFormDialog.tsx:46-50`. If the picker and the confirm unmount in the same commit (a successful replace), both cleanups run. The confirm's `previous` lives inside the unmounting picker, so its `.focus()` is a no-op, but make sure the picker's own cleanup (which returns to the Assign or Replace opener) runs last and the opener still exists. The settled rule is to fall back to the panel heading (`tabIndex={-1}`) when the opener is gone. The `focusSignal` counter at `useSeatActions.ts:62` already does this for reloads.
   - Esc on the confirm closes only the confirm (`onCancel` runs on the top dialog). Check that Esc and the scrim do not close the picker through `onPointerUp` (`EntityFormDialog.tsx:64-70`).
6. **Replace confirmation snapshot.**
   - Build it once when Submit is pressed on an occupied seat: `{seatId, expectedOccupantId, occupantName, memberId, memberName}`. Use the same object for the text and the request, as the settled plan says, so they cannot disagree. The occupant must not be read again from the live `detail` at confirm time.
   - Put the text in `copy/seats.ts` as `replaceBody(occupantName, memberName)` → "X sits here. Replace with Y?". Use `occupant.displayName` as given. Do not interpolate into markup unescaped (React escapes it already).
   - An empty seat sends `expectedOccupantId: null` and needs no replace confirmation. AC3 says "assigning to an empty seat updates the table and panel", not "asks".
   - Remove confirm: `{memberId: null, expectedOccupantId: snapshot.id}`, with the occupant name in the text.
   - If the picked member is already the shown occupant, either exclude them from the list or disable that radio. Otherwise "Replace X with X" is possible.
7. **Re-ask after `occupant_changed` (pure function, in `seat-actions.ts`).**
   - On `occupant_changed`, call `seatsApi.get(seat.id)` right away and feed the result to `decideReask({chosen, result})`. Return a discriminated union:
     - `{kind:"ask", snapshot}` when there is a new occupant, and the dialog switches to the new snapshot.
     - `{kind:"askAssign"}` when the seat is now empty, a plain assign confirm with `expectedOccupantId: null`.
     - `{kind:"done"}` when the occupant is already the chosen member: close, and still reload.
     - `{kind:"cannotSeat", reason}` when the seat is now cannot-seat: close, and the panel shows the reason.
     - `{kind:"error", code}` when the refetch failed: show the message and send nothing.
   - The result is a fresh dialog state with `confirm` replaced, never a resend. `run()` must not auto-retry, and the settled table says never retry on its own.
   - For Remove, `occupant_changed` gives reload plus a message only, and no re-ask is specified there.
   - Refresh the list and detail after the refetch (`refresh()` is already the reload path). Do not let the stale snapshot survive: replace it with the refetched seat's occupant.
   - Because the existing `run()` identity-closes (`d === started`), build the new dialog object and `setDialog(newObject)` before `run()` finishes. Otherwise line 56 closes the old dialog and the re-ask flashes. Either bypass `run()`'s generic close for this action or return the next dialog from the outcome.
8. **Other refusals.**
   - `member_not_assignable` (422): keep the dialog open, show an inline error, reload the picker (clear the selection, bump the request id), and also `refresh()` the seat. Do not close. This differs from the generic path at `useSeatActions.ts:56`. Add an `outcome.keepDialog` flag.
   - `seat_cannot_seat`: close and show the reason (the panel reads it from the refreshed detail).
   - `not_found`: close and reload.
   - Other codes: use `apiErrorMessage(code)`.
   - 401/403 codes never reload (`seat-actions.ts:54`), which is correct for R7.
9. **Cannot-seat dialog.**
   - A single-line `<input type="text">`, not a textarea. Do not use `maxLength`, so the validator is the only authority (as the existing Add field does).
   - On submit, run `validateCannotSeat({cannotSeat:true, reason})`. A failure shows a field error and sends nothing. Send `checked.value`, the trimmed and NFC form.
   - Clearing needs a confirm or at least a plain button (Manager+) with `{cannotSeat:false}`.
   - Assign is disabled, not hidden, on a cannot-seat seat, with the reason shown. The server's `seat_cannot_seat` still covers the race.
   - For an occupied seat, check whether the server accepts the flag. SEA/D-docs may refuse or allow it. I did not verify this, and it is not in the settled table.
10. **Role gating.**
    - Add `canSeatActions(tier)` = `atLeastTier(tier, "manager")` in `seat-actions.ts`. Pure and unit-tested over null, undefined, user, manager and admin, like the existing `canManageSeats` tests.
    - Remove is shown when Manager+ and the viewer is not the occupant. A Manager who is the occupant (`seat.mine`) sees Release, not Remove (`canRelease` at `seat-actions.ts:19`). Make this one pure function, `seatButtons(tier, seat)`, so `SeatActions.tsx` renders from its result. This replaces the Admin-only `remove` flag at `SeatActions.tsx:24`.
    - An Admin sees Delete as well. The assign, replace and remove buttons come from `occupant`: no occupant shows Assign, an occupant shows Replace and Remove.
11. **What can be unit-tested (node, static markup).** Test pure code and markup only. Never test effects, focus or `<dialog>` open state.
    - Role gating and `seatButtons`.
    - `decideReask` for all five outcomes plus a refetch failure.
    - Replace text and the snapshot builder, with a hard check that `expectedOccupantId` equals the shown occupant id.
    - The cannot-seat reason check: empty, whitespace, newline, invisible character, over-length and valid (the trim result).
    - The picker's pure reducer and stale handling: drop a stale response, reset on a new query, append and de-duplicate on load more, no double load more, and selection cleared after a reload.
    - Query clamping with surrogate pairs and diacritics (`[...q]`), and the debounce decision as a pure function of the timer (or inject a scheduler and drive it with Vitest fake timers).
    - The API client: query-string building (no `q` when blank, no duplicate keys, cursor passthrough), both write bodies, and the error-code mapping.
    - `actionOutcome` for the new actions: `member_not_assignable` keeps the dialog, auth codes do not reload.
    - Static markup: the radio list shows the name and code; "Load more" and the search carry the right `type`; Assign is `disabled` on a cannot-seat seat; there is no `required`/`maxLength`.
    - Browser-only (list these in the manual plan): Enter in the search box does not submit, IME composition, stacked-dialog focus and Esc, scrolling at 390px, and the real two-tab concurrency.
12. **Copy.** All strings in `src/ui/copy/seats.ts` under `actions` (D36). Add them before writing tests so the tests import the copy.

## Risks

- `run()`'s generic dialog close and `actionOutcome`'s fall-through to Release text are the likeliest ways to break the re-ask and `member_not_assignable` rules by accident. Change them with explicit per-action branches plus tests.
- `actionOutcome` always reloads after any non-auth refusal. That is wanted for `occupant_changed`, but the dialog it closes may be the re-ask dialog just created. Sequence matters: write the new dialog after the reload decision, or have the outcome carry the next dialog.
- Without a request-id guard, an old search result can overwrite a newer one, and a late load-more page can be appended to a different query. Both are silent wrong-list bugs, and the test is what catches them.
- IME Enter: `keydown` Enter during composition is not a submit. Guard with `isComposing`, or Vietnamese input will fire prevent-default mid-composition and confuse the field.
- Stale radio selection after the list changes could assign an unlisted or deactivated member. The server refuses (`member_not_assignable`), but the UI must clear the selection.
- Focus return after a successful assign can land on a removed opener (`EntityFormDialog.tsx:49`). Only a browser check confirms the `focusSignal` fallback.
- A `PATCH` for cannot-seat on an occupied seat is unspecified here (see rec. 9).
- Estimated size is about 470 lines of production code (split proposal, `plan.md:235`). A members client plus picker hook plus reducer plus four dialogs can push past that. If it does, cut Remove or the cannot-seat dialog into a follow-up rather than thinning tests (R4, R5).

## Open questions

1. Does the server accept `cannotSeat: true` on an occupied seat, or refuse it? The ticket says only "set a cannot-seat flag with a reason". Check `src/server` and the spec (SEA-01/SEA-03) before deciding whether the UI hides the control for occupied seats.
2. The existing "assign" error `seat_cannot_seat` closes the dialog and shows the reason. Is that also the intended re-ask outcome when the refetch shows the seat became cannot-seat? The settled plan says "close and show the reason", so I assumed yes.
3. Page size for the picker: use the server default (`MEMBER_LIMITS.defaultLimit`) or a smaller `limit` such as 20? The ticket does not say. Default to the server default unless the list is too long for 390px.
4. Should the picker exclude the current occupant, or show them disabled? I recommend excluding or disabling them. The ticket does not say.
