# Consult — frontend-developer (SIM-014.4)

Consult for SIM-014.4 (read-only). I checked the earlier consults' dialog advice and the SIM-014.2 split defaults against the code now on the branch.

## Findings
**Still valid, with no change:**
- `ApprovalsView` already has the `actions?: (item) => ReactNode` slot. It is rendered last inside each row's Card (`ApprovalsView.tsx:135`).
- `useRequests` already exposes `reload()`. It sets the state to LOADING, so the list flashes the skeleton and the focused row unmounts. This is the reason for the plan's "focus to the h1" rule.
- `EntityFormDialog` takes `open`, `title`, `subtitle`, `submitLabel`, `submitting`, `error`, `onClose`, `onSubmit` and `children`.
  - The submit button is always `bg-primary`. There is no destructive variant, so Reject also gets a primary button. This matches the plan ("no shared-component change").
  - The dialog returns null when closed, uses a native `<dialog>`, returns focus to the trigger on close, and the error line has `role="alert"`.
  - `submitting` swaps the label to `kitCopy.saving` ("Saving..."). That is slightly off for Approve and Reject but acceptable.
  - Cancel and Esc stay active while `submitting`. `onClose` must therefore ignore calls while a decision is in flight. Otherwise the dialog can close and the result will still arrive.
- The `approve` and `reject` routes are tier `manager`. They return `r.value`, a request DTO, for both a fresh decision and a no-op (`requests.ts:182`, `:255` return `loadRequest`). A bad uuid gives 404 `not_found`.
- `api.ts` already has messages for `seat_taken`, `seat_cannot_seat`, `member_not_assignable` and `not_found`.

**Changed since the earlier consults (from SIM-014.3):**
1. `requests-api.ts` now uses `call<T>(path, init, read)`. `approve` and `reject` are one-liners that mirror `cancel` (lines 82-85). The `read` argument is `(b) => isRequestDto(b) ? b : null`, and the return type is `RequestsResult<RequestDto>`.
   ```ts
   approve: (id) => call<RequestDto>(`/api/requests/${encodeURIComponent(id)}/approve`, { method: "POST" }, readDto)
   reject:  ... `/reject` ...
   ```
   Pull `readDto` out so cancel, approve and reject share it. No body or content-type header is needed.
2. `cancelOutcome` (`requests-state.ts:62-90`) is the pattern to copy for `settleDecision(action, result)`.
   - It returns `{reload, notice: {tone, text}}`.
   - It has an `AUTH_CODES` list. Auth codes and `invalid_request` do not reload.
   - Notice text uses `requestsCopy.mine.alreadyDecided(label)`, which lowercases the label ("This request was already approved.").
   - `settleDecision` needs two more fields because the dialog is involved: `close: boolean` and `dialogError: string | null`.
   - Suggested table:

   | Result | close | reload | Notice or dialog error |
   |---|---|---|---|
   | ok, status equals the intended status (`approve` gives `approved`, `reject` gives `rejected`) | yes | yes | success status text |
   | ok, any other status | yes | yes | `alreadyDecided` (status tone) |
   | `not_found` | yes | yes | page notice, using `apiErrorMessage("not_found")` |
   | `seat_taken`, `seat_cannot_seat`, `member_not_assignable` | no | yes (background) | dialog error |
   | auth codes, `invalid_request` | no | no | dialog error |
   | `unavailable` or `internal` | no | no (the list is unchanged) | dialog error |

   - For `unavailable` or `internal`, reloading is optional but harmless. The plan said "anything else gives a message and the dialog stays open", so keep the no-reload.
3. `MyRequestsPage` shows the busy and notice pattern to reuse: a `mounted` ref, one `cancellingId`, and every other row button `disabled={cancellingId !== null}`. This is a page-wide lock, not per row. The ticket says "per-row `busyId`". Use a single `busyId` state, but disable all row buttons while it is non-null, as the My requests page does. Per-row labelling ("Approving...") applies only to the row whose id matches.
4. The notice is rendered as `role="status"` for the status tone and `role="alert"` for the error tone (`MyRequestsView.tsx:43-52`). Copy that markup. The ticket says "`aria-live` notice". `role="status"` covers it, and the 'status' tone should stay polite.
5. `ApprovalsView` has no notice area and no heading ref yet. This is a change to the view that earlier plans did not cover:
   - Add `notice?` and `headingRef?` props. The h1 must get `ref`, `tabIndex={-1}` and `outline-none` as in `DevicesView.tsx:41-47`.
   - Keep the h1 in the `forbidden` branch consistent.
   - The notice paragraph should always be mounted, or at least the container with `aria-live`. A live region that appears together with its text is announced unreliably, so a node that is present empty from the start is safer. `MyRequestsView` mounts it conditionally, so match it only if tests do not care.

## Recommendations
File by file:
- `src/ui/requests/requests-api.ts`: add `approve` and `reject` (see above), extend the tests in `requests-api.test.ts` (URL, POST, no body, a non-DTO body gives `internal`, 404 gives `not_found`).
- `src/ui/requests/requests-state.ts`: add `DecisionAction = "approve" | "reject"`, `DecisionOutcome` and `settleDecision`. Keep it pure and reuse `AUTH_CODES`. Add `rivalNames(items, target)`: the other loaded `pending` requests with the same `seat.id` (confirm the field name in `RequestListItemDto`), excluding `target.id`. Make it a pure helper so it is unit tested.
- `src/ui/copy/requests.ts`: add a `decision` block.
  - Titles: `approveTitle`, `rejectTitle`.
  - Body: `approveBody(requester, seat, room)`, and the rival sentence `rivalsLine(names)` ("Approving rejects the other pending requests for this seat (A, B)."). Cap long name lists, for example three names and "and N more". The list is paged, so say "loaded", or word it as best effort, and never imply completeness.
  - `rejectBody` and the submit labels `Approve`/`Reject`.
  - Button labels, the busy label, the occupied hint for the disabled Approve, and the success notices ("Request approved." / "Request rejected.").
- `src/ui/requests/DecisionDialog.tsx`: it takes `{target: {item, action} | null, items, submitting, error, onClose, onConfirm}` and renders `EntityFormDialog` with `key={`${item.id}:${action}`}` and `open={target !== null}`. `open` with the key remounts the native dialog cleanly. The body is plain `<p>` text. There are no fields, so children carry only the paragraphs. Make it pure, because the parent owns the state and tests can then use `renderToStaticMarkup`. Note that `EntityFormDialog` renders only a `<dialog>` when `open`. A static render will not call `showModal`, but the markup (h2, body, error `role="alert"`, submit label) can still be asserted.
- `src/ui/requests/ApprovalsPage.tsx`: in `ApprovalsLoaded` add `target`, `busyId`, `dialogError` and `notice` state and a `mounted` ref. The `actions` function returns Approve and Reject buttons only for `it.status === "pending"`, with `min-h-11` as on My requests. Approve gets `disabled={busyId !== null || it.currentOccupant != null}`. Show the occupant hint with `aria-describedby` pointing at the hint text, because a disabled button cannot be focused and so the hint must be visible text in the row (`ApprovalsView` already shows "Seat is occupied by X" on pending rows, so the hint can be a short line such as "Reject the request or free the seat first" tied via `aria-describedby`; do not duplicate the occupant name).
- Submit flow:
  ```
  setBusyId(id); setDialogError(null)
  const o = settleDecision(action, await api[action](id))
  if (o.reload) void requests.reload()   // background for refusals, awaited otherwise
  if (o.close) setTarget(null)
  setNotice(o.notice); setDialogError(o.dialogError)
  if (mounted) setBusyId(null)
  ```
  After a closing outcome, call `headingRef.current?.focus()` after the reload settles (as `DevicesPage.tsx:93` does: `refresh().then(() => headingRef.current?.focus())`). EntityFormDialog's own cleanup restores focus to the previous element, which has been unmounted, so the h1 focus must run after that cleanup. Run it in the `.then` of `reload()`, or in a `useEffect` keyed on closing.
- Guard against double submit: the submit button is disabled via `submitting`, but Enter in a form with no input fields is not an issue. `onClose` while `busyId` is set should be a no-op.
- When the filter changes while a dialog is open: the filter chips are behind the modal, so it cannot happen. When the list reload removes the dialog's target (a rival was decided), close the dialog only if the item is gone AND no error is showing. The simplest rule is to keep the target in state as a copy and not tie it to the list.
- Tests (no jsdom):
  - `requests-state.test.ts`: `settleDecision` for each code and each status; `rivalNames`.
  - `requests-api.test.ts`: approve and reject.
  - `DecisionDialog.test.tsx`: approve text names requester, seat, room and rivals; reject text; error text in `role="alert"`; the key and submit label.
  - `ApprovalsView.test.tsx` (extend it): the `actions` slot renders buttons only on pending rows; the notice region renders with `role="status"`; the h1 carries `tabindex="-1"`.
- Add `ApprovalsView`'s notice and `headingRef` props to the existing test fixture builders in `ApprovalsView.test.tsx`. Because they are optional, existing tests keep passing.

## Risks
- `reload()` sets LOADING, which unmounts the row Card and the buttons. The state is held in the page (not the row), so this is safe, but any focus that is on the row is lost. That is the reason for the h1 focus. Without the focus step, keyboard users land on `<body>`.
- Background reload while the dialog is open (refusals): the list underneath flips to the skeleton while the modal is open. It is invisible behind the modal, but if the reload drops the target item, `rivalNames` computed from the loaded items changes mid-dialog. Compute the dialog's text from the snapshot taken when the dialog was opened (`target` holds the item copy) and refresh only the rival names, or accept that they update.
- The state flip LOADING during `reload()` while `busyId` is non-null could leave the buttons disabled forever if the page unmounts mid-call. Guard setState with the `mounted` ref, as `MyRequestsPage` does.
- R7 reminder: `apiFetch` re-sends once on 401/403. Approve and reject are idempotent on the server (no-op on non-pending), so a repeat is safe, but the repeat could return a different status than the user intended. That is covered by the "any other status gives alreadyDecided" row.
- Approve disabled when `currentOccupant` is set rests on the loaded row. A stale row can still hit `seat_taken`, which is handled in the dialog.
- `cancelOutcome`'s notice text lowercases the status label ("already approved"). Reuse `requestsCopy.mine.alreadyDecided` instead of adding a second copy of the sentence, or move it up to `requestsCopy.alreadyDecided` and keep `mine.alreadyDecided` pointing at it. Do not duplicate it.
- The primary-coloured Reject confirm button is visually the same as Approve. Make the dialog title and submit label carry the difference ("Reject request", "Reject").

## Open questions
1. Disabled Approve and its occupant hint: the default stands (disabled), but confirm the exact hint wording with Ming, or just use the default text proposed above.
2. Should `not_found` show a page notice ("This item was not found.") after closing? The ticket says "closes and reloads" only. I recommend a notice so the user knows why the row vanished. If Ming says no, set `notice: null` in the outcome.
3. Does `RequestListItemDto` expose `seat.id`? The rival lookup needs it. If it exposes only `seat.code` and `seat.roomCode`, match on that pair. Check `src/lib/requests/types.ts` before coding.
