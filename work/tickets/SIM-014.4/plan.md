Status: READY

# Plan — SIM-014.4: Approvals: Approve and Reject dialogs

This is the second slice of SIM-014.2 (`work/tickets/SIM-014.2/plan.md` → `## Split proposal`). The plan keeps every
default recorded there. It changes only UI files: no server, API, DTO, migration or shared-component
(`EntityFormDialog`) change. Estimate: ~330 source lines and ~320 test lines. That fits one cycle, so no split.

## Scope summary
`docs/spec-v1.md` REG-02 (lines 377-381):
> - [ ] Approving seats the subject (demoting any primary, DEV-06), marks the request approved, and rejects every other
>   pending request for that seat, all in one transaction.
> - [ ] Rejecting marks the request rejected. Approving or rejecting a request that is not pending changes nothing.

REG-01 (line 374): "A request for an occupied seat is refused." This is the basis for disabling Approve when the seat
is occupied.

`work/decisions.md`:
- D18 "Assigning to an occupied seat asks for confirmation, then replaces the occupant ...". This applies to direct
  assignment, not to approval. Approval never replaces an occupant: the server refuses with `seat_taken`
  (`src/server/requests/requests.ts:198`).
- D24 "decisions show in-app ("Yêu cầu của tôi" with a badge), no email." So there is no email, and the Reject text
  tells the Manager the requester sees the decision in My requests.
- D26 "per-seat 'không xếp chỗ' flag ... blocks assignment and requests". In this slice it appears only as the
  `seat_cannot_seat` refusal (`requests.ts:199`).
- D36: all UI copy goes in `src/ui/copy/requests.ts`.

Ticket (ticket.md lines 24-27, 33-35):
> - `requests-api.approve(id)` / `reject(id)` (no body); pure `requests-flow.ts` `settleDecision(action, result)`.
> - `DecisionDialog.tsx`: one `EntityFormDialog` keyed by request id + action, standard primary submit (no shared-component change). The Approve text names requester, seat and room, plus the other loaded pending requests for the seat (best effort). No device sentence (DEV-06 does not apply).
> - Row buttons only on pending rows; Approve disabled with the occupant hint when `currentOccupant` is set, Reject stays enabled.
> - Per-row `busyId`; `aria-live` notice ("This request was already {status}." for a no-op 200); focus to the h1 and `reload()` after every decision.

Defaults kept from SIM-014.2 plan lines 172-186 (quoted in short form):
- Outcomes: a 200 with the intended status closes the dialog and reloads. A 200 with another status closes, reloads
  and shows "This request was already {status}.". A 404 `not_found` closes and reloads. 409 `seat_taken` /
  `seat_cannot_seat` and 422 `member_not_assignable` keep the dialog open with `apiErrorMessage(code)` and reload the
  list in the background. Any other code shows a message and keeps the dialog open.
- Approve is disabled when `currentOccupant` is set; Reject stays enabled.
- The Approve text names the requester, seat and room. When other loaded pending requests share the seat, it adds
  "Approving rejects the other pending requests for this seat (names)." This is best effort. There is no device
  sentence.
- Reject has no reason field. "Success note without a rival count."

Backend used (merged, unchanged): `POST /api/requests/{id}/approve` and `/reject`, tier `manager`, no body. Both
return a `RequestDto` for a fresh decision and for a no-op on a non-pending request (`requests.ts:182`, `:197`,
`:255`). A missing request or a bad uuid gives 404 `not_found` (`:181`, `:191`, `:254`). Approve refusals are 422
`member_not_assignable` (`:186`), 409 `seat_taken` (`:198`) and 409 `seat_cannot_seat` (`:199`).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1a | Approve and Reject go through a confirm dialog. | `RequestRowActions.test.tsx` checks that the row buttons only call `onApprove(item)` / `onReject(item)` (open), and that there is no direct API call in the row. `DecisionDialog.test.tsx` checks the dialog markup (title, body, submit label). In `ApprovalsPage.tsx`, the API call is made only from the dialog's `onConfirm` (code read). |
| 1b | Refresh the list after a decision. | `requests-flow.test.ts` › `settleDecision` checks `reload: true` for ok/approved, ok/rejected, ok/other status, `not_found`, `seat_taken`, `seat_cannot_seat` and `member_not_assignable`. In `ApprovalsPage.tsx`, `requests.reload()` is called whenever `outcome.reload` is set (code read). |
| 1c | The refusals `seat_taken`, `seat_cannot_seat` and `member_not_assignable` show their message in the dialog. | `requests-flow.test.ts` checks `close: false` and `dialogError === apiErrorMessage(code)` for each of them. `DecisionDialog.test.tsx` checks that the error text appears inside `role="alert"`. |
| 2a | A decision on a request that is no longer pending shows the "already decided" notice. | `requests-flow.test.ts` checks that approve returning `rejected` / `cancelled` and reject returning `approved` give `close: true`, `reload: true` and notice `{tone:"status", text:"This request was already rejected."}` etc. `ApprovalsView.test.tsx` checks that a status notice renders in `role="status"`. |
| 2b | `not_found` closes and reloads. | `requests-flow.test.ts` checks `not_found` gives `close: true`, `reload: true`, and an error-tone notice with `apiErrorMessage("not_found")`. |
| 3 | Pure-logic and static-render tests (no jsdom) cover the action outcomes and the dialog. | `pnpm test` is green. The new tests are listed below, and none of them imports jsdom or `@testing-library`. |
| 4 | Ticket-scope behaviour: buttons only on pending rows, Approve disabled when occupied while Reject stays enabled, every row button disabled while busy, busy label on the busy row. | `RequestRowActions.test.tsx` (static render). |
| 5 | Focus moves to the h1 after a decision that closes the dialog. | `ApprovalsView.test.tsx` checks that the h1 has `tabindex="-1"`. In `ApprovalsPage.tsx`, the focus call runs in `reload().then(...)` and only after a closing outcome (code read). Local run: when the dev token is available, approve a request and check that `document.activeElement` is the h1. |
| 6 | Checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test` and `pnpm build` are all green. |

## Ming verification after merge
- Ticket manual test, "request → approve with two rival requests". Sign in as users A, B and C and have each
  request the same empty seat. Then sign in as a Manager and open Approvals → Approve A. The dialog names B and C. After
  Approve, the dialog closes, "Request approved." is announced, A's row leaves the Pending list, and B and C appear under
  Rejected. This needs several real Identity accounts, so the reviewer cannot run it locally.
- On a 390 px phone, check that Approve and Reject sit side by side or wrap cleanly, and that long Vietnamese names wrap
  in the dialog.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/requests/requests-api.ts` | Pull out `readDto = (b) => isRequestDto(b) ? b : null` and use it in `cancel` (lines 82-85). Add `approve(id)` and `reject(id)`: `call<RequestDto>(\`/api/requests/${encodeURIComponent(id)}/approve\` (or `/reject`), { method: "POST" }, readDto)`. No body and no content-type header. | Ticket scope bullet 1 | No |
| `src/ui/requests/requests-state.ts` | `export` the existing `AUTH_CODES` (line 60) so the new module reuses it. Add `occupantHintId(requestId)` → `` `occupant-${requestId}` `` (a shared id for the occupant line and `aria-describedby`). | Reuse, with no duplicate list; the occupant hint | No |
| `src/ui/requests/requests-flow.ts` (new) | Pure code: `DecisionAction = "approve" \| "reject"`, `DecisionOutcome`, `settleDecision(action, result)`, and `rivalNames(items, target)`. | Ticket scope bullet 1 (file name from the ticket) | No |
| `src/ui/copy/requests.ts` | Add a `decision` block. The strings are listed under Approach step 2. | D36 | No |
| `src/ui/requests/DecisionDialog.tsx` (new) | A presentational wrapper around `EntityFormDialog`, keyed `${id}:${action}`. | Ticket scope bullet 2 | No |
| `src/ui/requests/RequestRowActions.tsx` (new) | Pure row buttons (Approve and Reject) for the `actions` slot. | Ticket scope bullet 3. Keeping them in their own file lets static-render tests cover the disabled and busy rules without jsdom. | No |
| `src/ui/requests/ApprovalsView.tsx` | Add the optional props `notice` and `headingRef`. The h1 gets `ref`, `tabIndex={-1}` and `outline-none` (the `DevicesView.tsx:41-47` pattern). Render the notice paragraph below the h1 (the `MyRequestsView.tsx:43-52` markup). Give the pending occupant line `id={occupantHintId(it.id)}`, only when `currentOccupant` is set. | Focus target and notice region (ticket scope bullet 4); hint target (bullet 3) | No |
| `src/ui/requests/ApprovalsPage.tsx` | In `ApprovalsLoaded`: state for `target`, `busyId`, `dialogError` and `notice`, plus `mounted` and `headingRef` refs. Wire `actions` to `RequestRowActions`, render `DecisionDialog`, add the submit flow, and clear the notice on filter change. | Ticket scope bullets 3-4 | No |
| `src/ui/requests/requests-api.test.ts` | Extend it with approve and reject tests. | R5 | No |
| `src/ui/requests/requests-flow.test.ts` (new) | Tests for `settleDecision` and `rivalNames`. | R5, AC3 | No |
| `src/ui/requests/DecisionDialog.test.tsx` (new) | Static render of the dialog. | AC3 | No |
| `src/ui/requests/RequestRowActions.test.tsx` (new) | Static render of the row buttons. | AC3 | No |
| `src/ui/requests/ApprovalsView.test.tsx` | Extend it: notice tones, h1 `tabindex`, occupant line id, and the `actions` slot. | AC3 | No |

Not touched: `src/ui/EntityFormDialog.tsx`, `src/ui/index.ts` (the new components are internal to the requests
folder), anything under `src/server/**` or `src/app/api/**`, and `src/lib/**`.

## Data model / migration
None.

## API contract
None. The existing endpoints are used without change (see Scope summary).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `requests-api.test.ts` › "approve: POST /api/requests/<encoded id>/approve with no body and no content-type; 200 -> DTO; 404 -> not_found; 409 seat_taken -> code; body without id -> internal" | api approve |
| `requests-api.test.ts` › "reject: POST /api/requests/<encoded id>/reject with no body; 200 -> DTO; fetch throws -> unavailable; signed_out -> unauthenticated" | api reject |
| `requests-flow.test.ts` › "settleDecision: approve -> approved and reject -> rejected close, reload, success notice (status tone), no dialog error" | clean decision |
| `requests-flow.test.ts` › "settleDecision: ok with another status (approve->rejected, approve->cancelled, reject->approved) closes, reloads, notice 'This request was already <status>.'" | AC2 no-op 200 |
| `requests-flow.test.ts` › "settleDecision: not_found closes, reloads, error notice apiErrorMessage('not_found')" | AC2 |
| `requests-flow.test.ts` › "settleDecision: seat_taken, seat_cannot_seat, member_not_assignable keep dialog open, reload in background, dialogError = apiErrorMessage(code), no notice" | AC1 refusals |
| `requests-flow.test.ts` › "settleDecision: each auth code and invalid_request keep dialog open, no reload, dialogError" | R7 auth path |
| `requests-flow.test.ts` › "settleDecision: unavailable, internal and an unknown code keep dialog open, no reload, dialogError (unknown -> internal text)" | other errors |
| `requests-flow.test.ts` › "rivalNames: other pending requests on the same seat.id, excluding the target; decided rows and other seats ignored; empty when none" | best-effort rivals |
| `DecisionDialog.test.tsx` › "null target renders nothing" | closed state |
| `DecisionDialog.test.tsx` › "approve: title 'Approve request?', body names requester, seat and room; submit 'Approve'; cancel 'Keep pending'" | dialog text |
| `DecisionDialog.test.tsx` › "approve with rivals: 2 names listed; 5 rivals -> 3 names and 'and 2 more'; partial list -> 'including' wording; no rivals -> no rival sentence" | rival sentence |
| `DecisionDialog.test.tsx` › "reject: title 'Reject request?', body names requester, seat, room and My requests; submit 'Reject'; no rival sentence" | reject text |
| `DecisionDialog.test.tsx` › "error renders inside role=alert; submitting shows the kit saving label and disables submit" | AC1 dialog error |
| `DecisionDialog.test.tsx` › "Vietnamese name (Nguyễn Thị Ánh) rendered unchanged" | domain focus: diacritics |
| `RequestRowActions.test.tsx` › "pending, empty seat: Approve then Reject, both enabled, min-h-11" | buttons |
| `RequestRowActions.test.tsx` › "non-pending item renders nothing" (one case per approved/rejected/cancelled) | pending only |
| `RequestRowActions.test.tsx` › "occupied seat: Approve disabled with aria-describedby=occupantHintId(id); Reject enabled" | occupant rule |
| `RequestRowActions.test.tsx` › "busyId set: every button disabled; the busy row shows 'Approving...' or 'Rejecting...' for its action, other rows keep their labels" | busy state |
| `ApprovalsView.test.tsx` › "h1 has tabindex=-1 (ready and forbidden)" | focus target |
| `ApprovalsView.test.tsx` › "notice: status tone -> role=status, error tone -> role=alert, null -> neither" | notice region |
| `ApprovalsView.test.tsx` › "occupied pending row: occupant line carries id occupantHintId(id); empty seat line has no id" | hint target |
| `ApprovalsView.test.tsx` › "actions slot output rendered inside each card" | slot wiring |

There is no bug test because this is not a bug ticket.

## Approach
1. **API** (`requests-api.ts`): add `readDto`, `approve` and `reject` as described in the file table. They mirror
   `cancel`, so `call` gives the error mapping (fetch throws → `unavailable`, `signed_out` → `unauthenticated`, non-DTO
   → `internal`).
2. **Copy** (`copy/requests.ts`, new `decision` block). Use these strings unless Ming says otherwise:
   - `approve: "Approve"`, `reject: "Reject"`, `approving: "Approving..."`, `rejecting: "Rejecting..."` (row buttons;
     the dialog submit labels reuse `approve` and `reject`).
   - `approveTitle: "Approve request?"`, `rejectTitle: "Reject request?"`, `keepPending: "Keep pending"`.
   - `approveBody(requester, seat, room)` → `` `Assign ${requester} to seat ${seat} in room ${room}.` ``
   - `rivalsLine(names, more, partial)`. The names are joined with ", ", and `more > 0` adds `` ` and ${more} more` ``.
     When `partial` is false the line is `` `Approving rejects the other pending requests for this seat (${list}).` ``.
     When it is true the line is `` `Approving also rejects other pending requests for this seat, including ${list}.` ``.
   - `rejectBody(requester, seat, room)` →
     `` `Reject ${requester}'s request for seat ${seat} in room ${room}? They will see the decision in My requests.` ``
     (D24: in-app, no email).
   - `approved: "Request approved."`, `rejected: "Request rejected."`.
   - The "already decided" text reuses `requestsCopy.mine.alreadyDecided` and is not duplicated.
3. **Pure flow** (`requests-flow.ts`):
   ```ts
   export type DecisionAction = "approve" | "reject";
   export type DecisionOutcome = {
     close: boolean; reload: boolean;
     notice: { tone: "status" | "error"; text: string } | null;
     dialogError: string | null;
   };
   export function settleDecision(action: DecisionAction, result: RequestsResult<RequestDto>): DecisionOutcome
   export function rivalNames(items: RequestListItemDto[], target: RequestListItemDto): string[]
   ```
   `settleDecision` maps results as follows:

   | Result | close | reload | notice | dialogError |
   |---|---|---|---|---|
   | ok, `approve`→`approved` or `reject`→`rejected` | true | true | status, `decision.approved` / `decision.rejected` | null |
   | ok, any other status | true | true | status, `mine.alreadyDecided(statusLabel[status])` | null |
   | `not_found` | true | true | error, `apiErrorMessage("not_found")` | null |
   | `seat_taken`, `seat_cannot_seat`, `member_not_assignable` | false | true | null | `apiErrorMessage(code)` |
   | `AUTH_CODES` or `invalid_request` | false | false | null | `apiErrorMessage(code)` |
   | anything else | false | false | null | `apiErrorMessage(code)` |

   `rivalNames` keeps the rows where `status === "pending"`, `seat.id === target.seat.id` and `id !== target.id`,
   and returns their `subject.displayName` values in list order. The DTO has `seat.id`
   (`src/lib/requests/types.ts:9`), which answers frontend open question 3.
4. **`DecisionDialog.tsx`** (pure; no state, no effects of its own).
   - Props: `{ target: DecisionTarget | null; submitting: boolean; error: string | null; onClose(); onConfirm() }`.
   - `DecisionTarget = { item: RequestListItemDto; action: DecisionAction; rivals: string[]; partial: boolean }` is
     exported from this file.
   - When `target` is null it returns null. Otherwise it renders
     `<EntityFormDialog key={`${item.id}:${action}`} open title=... submitLabel=... cancelLabel={keepPending} submitting error onClose onSubmit={(e) => { e.preventDefault(); onConfirm(); }}>`.
   - Children are one `<p className="text-sm break-words">` for the body and, for approve with rivals, a second `<p>`
     with `rivalsLine(first 3 names, rivals.length - 3 clamped at 0, partial)`.
   - It shows no device sentence (SIM-014.2 default).
5. **`RequestRowActions.tsx`** (pure).
   - Props: `{ item, busy: { id: string; action: DecisionAction } | null, onApprove(item), onReject(item) }`.
   - It returns null unless `item.status === "pending"`. Otherwise it renders `<div className="flex flex-wrap gap-2 pt-1">`
     with two buttons:
     - Approve: `variant="filled"`, `size="sm"`, `className="min-h-11"`, `disabled={busy !== null || item.currentOccupant !== null}`,
       and `aria-describedby={item.currentOccupant ? occupantHintId(item.id) : undefined}`.
     - Reject: `variant="tonal"`, `size="sm"`, `className="min-h-11"`, `disabled={busy !== null}`.
   - The label is `approving` / `rejecting` only on the row and action that match `busy`.
6. **`ApprovalsView.tsx`**: make the additions listed in the file table. The notice reuses the MyRequestsView markup
   (it is mounted only when it has content, with `role="status"` or `role="alert"`, which counts as the ticket's
   "aria-live" region). The existing summary `aria-live` stays.
7. **`ApprovalsPage.tsx` (`ApprovalsLoaded`)**:
   - State: `target: DecisionTarget | null`, `busy` (the `busyId` plus the action), `dialogError`, `notice`. Refs:
     `mounted` (the MyRequestsPage pattern) and `headingRef`.
   - Opening a dialog (`onApprove` / `onReject`): if `busy` is set, ignore it. Otherwise `setNotice(null)`,
     `setDialogError(null)` and `setTarget({ item, action, rivals: rivalNames(requests.items, item), partial: requests.hasMore })`.
     The target is a snapshot, so a background reload does not change the dialog text.
   - `onClose`: if `busy !== null`, return, so Esc or Cancel during the call is ignored. Otherwise clear `target` and
     `dialogError`. On this path EntityFormDialog's own cleanup returns focus to the row button.
   - `onConfirm`: if `busy` is set or `target` is null, return. Then:
     ```
     setBusy({id, action}); setDialogError(null)
     const o = settleDecision(action, await api[action](id))
     if (!mounted.current) return
     setNotice(o.notice); setDialogError(o.dialogError)
     if (o.close) { setTarget(null); void requests.reload().then(() => { if (mounted.current) headingRef.current?.focus() }) }
     else if (o.reload) void requests.reload()
     setBusy(null)
     ```
     Focus goes to the h1 in `reload().then`. That runs after the dialog's cleanup has called `previous.focus()`, so the
     h1 keeps focus (the `DevicesPage.tsx:93` pattern). A refusal leaves the dialog open: the list reloads behind it and
     the error shows in `role="alert"`.
   - `submitting={busy !== null}` is passed to the dialog. The kit's "Saving..." label shows briefly on submit. This
     is accepted because a shared-component change is out of scope.
   - `onFilter`: `setNotice(null)`, then `router.replace(...)` as before.
   - Render `<><ApprovalsView ... headingRef notice actions={(it) => <RequestRowActions .../>} /><DecisionDialog .../></>`.
     `ApprovalsPageInner`'s forbidden branch does not change.
8. Run the checks: `pnpm format`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

How the rules are met:
- R1: every new file is under `src/ui/requests/` and imports only `@/lib/requests/types`, `@/lib/api/fetch`, `src/ui/*`
  siblings and copy files. There is no server import, and `pnpm check:layers` confirms it.
- R2/R6: there is no schema or server change.
- R3: there is no config.
- R5: the tests are listed above.
- R7: the client treats 401/403 codes as "nothing changed" (no reload, dialog stays open). `apiFetch` may send the
  request again once after a 401/403. Approve and reject are server no-ops on non-pending requests, so if the re-send
  finds the request already decided, it gets a 200 with a different status. That falls into the "already decided" row.
- D36: all text lives in `copy/requests.ts`, and names show as given (Vietnamese diacritics are kept).

## Specialist input used
- frontend #1 (`approve`/`reject` mirror `cancel`, shared `readDto`): adopted.
- frontend #2 / ux #10 (outcome table with `close` and `dialogError`, reuse of `AUTH_CODES`): adopted. It lives in
  `requests-flow.ts`, not `requests-state.ts`, because the ticket names that file.
- frontend #3 / ux R2 (one `busyId` locks every row button; busy label only on the matching row): adopted.
- frontend #4-5 / ux #5-6 (notice markup copied from MyRequestsView; `headingRef` with `tabIndex={-1}`): adopted. The
  "always-mounted live region" idea was not adopted: the ux consult notes that both approaches work, and matching
  MyRequestsView keeps one pattern.
- frontend rec "`rivalNames` pure helper", open question 3 (`seat.id`): adopted. `seat.id` exists (`types.ts:9`).
- frontend/ux "cap 3 names + and N more", ux "hedge when hasMore": adopted as `rivalsLine(names, more, partial)`. This
  keeps the approved best-effort default and avoids claiming the list is complete.
- frontend "snapshot target, don't tie the dialog to the list" / ux R4 "close dialog if the row is gone; disable submit
  if now occupied": the snapshot was adopted and the auto-close / auto-disable was not. The server refuses again with
  the same message, so the extra logic is not needed for the ACs (rule 1).
- frontend/ux focus ordering (focus the h1 after the reload settles, after the dialog cleanup; leave the default focus
  return on a user cancel): adopted.
- frontend/ux `onClose` ignored while busy: adopted.
- ux R1 (Approve `filled`, Reject `tonal`, `min-h-11`, flex-wrap, `aria-describedby` on the existing occupant line
  instead of extra text): adopted. `Button` has `filled` (`Button.tsx:5`).
- ux R3 copy (titles, approve and reject bodies, "Keep pending"): adopted, with "in room" added to match `seatLine`.
  The Reject body says "They will see the decision in My requests" (D24).
- ux Q1 / frontend Q2 success and `not_found` notices: adopted. The SIM-014.2 defaults already include a "Success
  note". The `not_found` notice reuses the existing `apiErrorMessage("not_found")` text and adds no new copy.
- ux Q3 "Saving..." label: accepted as is (no shared-component change), as both consults recommend.
- ux Q4 (dialog stays open after a refusal): adopted. It matches the ticket and the default.
- frontend open question 1 (hint wording): no new hint text. The disabled Approve is described by the existing "Seat
  is occupied by X" line. This is listed as an assumption.

## Assumptions
These are non-blocking. Each has a default that Ming can change at the plan gate.
- A1. The occupant hint is the existing visible line "Seat is occupied by {name}", linked to the disabled Approve with
  `aria-describedby`. No extra hint sentence is added.
- A2. Clean decisions show "Request approved." / "Request rejected." as a status notice. `not_found` shows "This item
  was not found." as an error notice after the dialog closes and the list reloads. To drop either, set `notice: null`
  in that row of `settleDecision`.
- A3. The dialog's cancel button reads "Keep pending" so it is not confused with the `cancelled` status. The kit
  default "Cancel" would also work.
- A4. While the call is in flight, the submit button reads the kit's "Saving..." instead of "Approving...", because
  `EntityFormDialog` is not changed. The row button shows "Approving..." / "Rejecting...".
- A5. Rival names come only from the loaded pending list. When more pages exist, the sentence uses "including". When
  no rivals are loaded, there is no rival sentence. The full rival count stays a follow-up (`rivalCount`, ticket Out of
  scope).
- A6. Refusal reloads run in the background with the dialog open. The list behind the modal flashes the loading card,
  and this is accepted.
- Hotspots: no ticket in IN_PROGRESS, REVIEW or DONE touches these files (`work/backlog.md` shows only BACKLOG tickets
  besides this one). SIM-014.3 already merged its changes to `requests-api.ts` and `copy/requests.ts`.
- Follow-ups (R4, not in scope): `rivalCount` on `RequestListItemDto`; an optional `submittingLabel` on
  `EntityFormDialog` to replace "Saving..."; a destructive submit style for Reject; moving `mine.alreadyDecided` to a
  shared key.

## Blocking questions
None.

## Split proposal
None. This is already the second slice of SIM-014.2, at about 330 source lines.
