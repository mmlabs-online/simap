# Consult — ux-architect (SIM-014.4)

**SIM-014.4 UX re-check against main (ApprovalsView, MyRequestsView/Page, EntityFormDialog)**

The SIM-014.2 defaults still hold: the outcome mapping, Approve disabled when occupied with Reject enabled, rival names in the Approve text, no device sentence, and no reject reason. The gaps and changes are below.

**Findings**

1. `EntityFormDialog` replaces the submit label with `kitCopy.saving` while `submitting` is true (lines 103-109). A Reject or Approve dialog would then read "Saving..." for the call. The plan says "no shared-component change", so this can't be fixed there. Accept it, or pass `submitting={false}` and guard double-submit with the page-level `busyId` (see R2 below).
2. The dialog's Cancel button defaults to the label "Cancel". My requests already uses "Cancel request" for withdrawing a request. In the Approvals dialog, "Cancel" would only close it, which is confusing next to the status `cancelled`.
3. `showModal()` focuses the first focusable element, which is the dialog's Cancel button. That is the safe default for both actions.
4. On close, the dialog's effect cleanup calls `previous.focus()` on the row button. After `reload()` on the pending filter, that row is gone, so focus is lost. The plan's "focus to h1" is therefore needed, but it must run after the dialog cleanup.
5. The h1 lives in `ApprovalsView` as a plain element, with no ref and no `tabIndex`. Focusing it needs a new view prop, for example `titleRef`, plus `tabIndex={-1}` and `outline-none`. The forbidden branch shares the `title` constant.
6. `ApprovalsView` has no notice slot. `MyRequestsView` renders its notice above the list as `role="status"` or `role="alert"`, so the same pattern fits here.
7. The existing summary `<p aria-live="polite">` already announces the list count after a reload. A separate notice line avoids two competing announcements.
8. The `actions` slot renders as the last child of the card's `flex-col gap-1` stack. `MyRequestsView` wraps its button in a plain `<div>` with `min-h-11`, `size="sm"` and `variant="tonal"`. Approvals should reuse that.
9. `requestsCopy.mine.alreadyDecided(status)` already exists. It lowercases the label and ends with a period. The ticket's notice copy ("This request was already {status}.") is identical, so it should be reused or moved to a shared key, not duplicated.
10. `cancelOutcome` returns `{reload, notice}` and skips the reload for auth codes and `invalid_request`. `settleDecision` should mirror that shape and add `close` and `dialogError`.

**Recommendations**

R1. Button placement:
- Put a `flex flex-wrap gap-2` row at the bottom of the card, with Approve first and Reject second.
- Use `min-h-11` on both. Approve is `variant="filled"` if `Button` has one, otherwise `tonal`. Reject is `tonal`.
- At 390 px the two small buttons fit side by side. `flex-wrap` handles larger font settings.
- The disabled Approve needs its hint visible as text, not only a `title`, because touch devices have no hover. The card already shows "Seat is occupied by X" in the line above.
- Add an `aria-describedby` on the Approve button pointing at that line, or add a short line under the buttons such as "Approve is unavailable while {name} sits here." Prefer the `aria-describedby` and no extra text.
- Disabled buttons drop out of the tab order. If that is a concern, use `aria-disabled` and ignore the click. The default is fine.

R2. Busy state and double-submit:
- Per-row `busyId`: while it is non-null, disable all row buttons on the page (as `cancellingId !== null` does on My requests).
- The dialog submit must also be guarded by the busy flag inside `onSubmit`, because `submitting` shows "Saving...".
- If the dialog's submit shows "Saving...", accept it and note it in the plan. Otherwise leave `submitting` unset and keep a ref guard.

R3. Dialog copy:
- Titles are "Approve request?" and "Reject request?" (not "Approve seat request").
- Use a `cancelLabel` of "Keep pending" on both dialogs, so it can't be read as cancelling the request. If Ming prefers the standard label, "Cancel" is acceptable.
- Approve text: "Assign {requester} to seat {seat} in {room}."
- If rivals are loaded, add: "This also rejects the other pending requests for this seat ({names})."
- Cap the names at about 3 with "and N more". The list is paginated, so say "(from the requests loaded)" only if the Approvals page has more pages. The plan says "best effort", so keep the wording hedged with "at least" when `hasMore` is true.
- Reject text: "Reject {requester}'s request for seat {seat} in {room}? They are notified in My requests." This claims no email, in line with D24. Check that the My requests wording matches.
- Submit labels are "Approve" and "Reject". Keep the primary style for both. The server refuses an unsafe approve, and reject is reversible by requesting again, so there is no need for a destructive style.

R4. Error and notice behaviour:
- Dialog errors for `seat_taken`, `seat_cannot_seat` and `member_not_assignable` use `apiErrorMessage`. "Someone already sits in this seat." reads correctly for approve. Reload in the background.
- After the reload, if the row's `currentOccupant` is now set, Approve is disabled while the dialog is still open. That is fine, but the dialog's Approve submit should then be disabled too, so the user can't retry a known refusal. If the row is gone from the list, close the dialog.
- The no-op 200 notice uses `role="status"` above the list, not an `aria-live` on an element that appears with its text already set. Render the element always and change its text, or rely on `role="status"` being inserted. Both work with static render tests.
- Clear the notice on the next decision and on filter change.
- Tone is `status` for the already-decided notice and for success. Add a short success notice for a clean 200, for example "Request approved." and "Request rejected.", so a decision is visible when the row disappears from the pending list. The plan does not list a success notice. This is the main behavioural gap: after a clean decision on the pending filter, the card simply vanishes with no confirmation (focus on the h1 plus the summary count change is the only signal). Recommend adding it, with copy kept in `requestsCopy`.
- `not_found` closes and reloads with the error notice "This item was not found." Consider request-specific wording such as "This request no longer exists." Optional.

R5. Focus order on close:
- Close the dialog (set state), then focus the h1 in an effect after `reload()` resolves. Do not call it synchronously in the submit handler, because the dialog cleanup would then restore focus to the old button after the h1 focus.
- Use `requestAnimationFrame` or a `useEffect` keyed on a `focusTitle` counter.
- If the opener button still exists (a decision refused and the dialog was cancelled by the user), leave the default focus return to the button. Only move to the h1 after a decision that closed the dialog.

R6. Narrow screens:
- The dialog is `w-[calc(100%-2.5rem)] max-w-[440px]`, which is fine at 390 px. Long requester names and room codes in the dialog text need `break-words`.
- Dialog text should be a single `<p>` per sentence, and the rival names go in the same sentence so screen readers read them in order. A bulleted list is not needed.
- On the card, the buttons wrap under the date line.

R7. Tests (static render, no jsdom):
- Disabled Approve and its described-by hint when `currentOccupant` is set.
- Buttons present only on pending rows.
- All row buttons disabled while `busyId` is set.
- The notice element for each tone.
- The dialog with rivals, with no rivals, and with more than 3 rivals.
- `settleDecision` for each code, including the wrong-status 200 and auth codes (no reload).

**Risks**

- The "Saving..." label (finding 1) is visible for a few hundred milliseconds. It is cosmetic. It is worth a one-line mention in the plan.
- The rival text only counts the loaded page. The approved default accepts this. The hedged wording avoids a false "no other requests" claim, but a Manager on the "approved" or other filters sees no rivals, because only pending rows count. State in the plan that rivals come from the pending list only. If the current filter is not `pending`, the list has no pending rows and no buttons, so this is moot. It matters only when the pending list has more than one page.
- A 200 with a different status than intended (for example, approve returns `cancelled`) must still reload and close the dialog. The ticket already covers this.
- Stale-occupant race: the row says empty, the server says `seat_taken`. The dialog's error and background reload cover it.

**Open questions**

1. Add a success notice ("Request approved." / "Request rejected.") for clean decisions? Recommended yes; the plan is silent.
2. Cancel label in the dialog: "Cancel" (the kit default) or "Keep pending"? Recommended "Keep pending".
3. Accept the "Saving..." label during submit, or have the plan authorise an optional `submittingLabel` on `EntityFormDialog`? The ticket says no shared change, so the default is to accept it.
4. Should the dialog stay open after a refusal with Approve disabled, or close and show the error as a page notice? Recommended: keep it open, as the plan says.

Files read: src/ui/requests/ApprovalsView.tsx, ApprovalsPage.tsx, MyRequestsView.tsx, MyRequestsPage.tsx, requests-state.ts (cancelOutcome), src/ui/EntityFormDialog.tsx, src/ui/copy/requests.ts, src/ui/copy/api.ts, and work/tickets/SIM-014.2/plan.md (Split proposal).
