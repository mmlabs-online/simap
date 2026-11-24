# Consult — ux-architect (SIM-014.2)

## Findings

Read-only consult for SIM-014.2 (Approvals page UI).

**Backend contract (SIM-014, already merged)**
- `GET /api/requests?status=<pending|approved|rejected|cancelled>&limit&cursor` (manager tier). It returns `{items: RequestListItemDto[], nextCursor}`, newest first, keyset-paged. The default limit is 50 and the max is 100.
- `RequestListItemDto` is `{id, status, seat{id,code,roomId,roomCode}, subject{id,displayName}, createdAt, decidedAt, decidedBy|null, currentOccupant|null}` (`src/lib/requests/types.ts`).
- `POST /api/requests/[id]/approve` and `/reject` (manager tier) return a plain `RequestDto`. They do not return the rival list or the number of requests auto-rejected. The server audit meta holds `rejectedRivals`, but the client never sees it.
- A decision on a request that is no longer pending is a no-op that returns the current request with 200. The UI can detect it by checking `status !== "approved"/"rejected"` against the action it sent, or by reloading.
- Refusals:
  - 409 `seat_taken`: the seat now has an occupant (D18, approval never replaces an occupant).
  - 409 `seat_cannot_seat`: the D26 flag is set.
  - 422 `member_not_assignable`: the subject is deactivated or unassignable.
  - 404 `not_found`.
  - 503 `unavailable`.
- All of these codes already have messages in `src/ui/copy/api.ts` via `apiErrorMessage`. I found no `request_*` codes, so no new API copy is needed. Reject has no domain refusals.
- There is no rival data in the list DTO. The list does include a seat code, so rivals can be derived client-side by grouping the loaded `pending` items by `seat.id`. This is only complete when the whole pending list is loaded (see Risks).
- The page stub is `src/app/(app)/approvals/page.tsx` (PageSkeleton, `shellCopy.pages.approvals`). The nav hides Approvals below manager (`nav.ts`), but the page itself has no guard. `AuditPage` is the pattern: `canViewAudit(session?.tier)` renders a "forbidden" view and never mounts the data hook.

**Existing UI patterns to reuse**
- Page layout: `<div className="p-4 lg:p-6 flex flex-col gap-4">`, `h1 text-h2 font-extrabold text-on-surface`, `Card`, `Button` (variants tonal/danger, size sm).
- State machine: a pure `*View` (props: `status: loading|error|ready|forbidden`, `errorCode`, `onRetry`), a `*Page` that wires session/apiFetch, `use*` hook, `*-api.ts` factory over `useApiFetch`, and `*-state.ts` for pure logic. See `src/ui/audit/*` and `src/ui/rooms/*`. Tests are static render plus pure logic.
- Loading is a pulsing `Card` with `aria-busy`. Error is a Card with `role="alert" text-error` and a tonal Retry button. Empty is a Card `px-6 py-12 text-center text-sm font-medium text-on-surface-variant`.
- `FilterChips` (`src/ui/Chip.tsx`) is a ready radiogroup for status. `Chip` is a static tag. `Avatar` and `RoleBadge` exist.
- Confirm dialog: `EntityFormDialog` (native `<dialog>`, `title`, `subtitle`, `submitLabel`, `submitting`, `error` inline `role=alert`, `onClose`, `onSubmit`). `DeleteRoomDialog` shows the pattern: mounted per item with `key`, `submitting` blocks the button, an error stays inside the dialog, and `not_found` closes the dialog and refreshes.
  - Check whether `EntityFormDialog` can render a danger-styled submit for Reject. If it can't, flag it rather than forking the dialog.
- Wide data: the Audit table uses `overflow-x-auto` with `min-w-[40rem]`. That is a poor fit here (see narrow screens below).
- Time: `formatAuditTime` exists in `audit-state.ts`. There is no relative-age helper.

## Recommendations

**List layout.** Use a stacked card list (one `Card` per request), not a table.
- Row line 1: requester name (bold) with an `Avatar`, plus a status chip for non-pending filters.
- Row line 2: "Seat A1-03 · Room A1" (room code, linking to `/rooms/<code>` is optional).
- Row line 3: current occupant. Show "Currently: Name" when `currentOccupant` is set. Otherwise show "Seat is empty" in muted text.
  - When the occupant is set, a pending request is un-approvable (409 `seat_taken`). Show a warning chip "Seat taken" and disable Approve, keeping Reject enabled. The server stays the authority, so the 409 message still has to be handled.
  - Disabling Approve on a visible occupant follows D18. Confirm with Ming (see questions).
- Row line 4: age. Show "Requested 2 days ago" with the absolute time in a `title` or `<time dateTime>`. Add a pure relative-time helper in `requests-state.ts` that takes `now` as a parameter so it stays testable. For decided rows show "Approved by X · date" using `decidedBy` and `decidedAt`.
- Rival requests: in `requests-state.ts`, `rivalsOf(items)` groups pending items by `seat.id`. For a pending row with N>1 on the same seat, show a chip "2 other requests for this seat" with the other requesters' names in the text (`+N more` after 2). Add a subtle hint in the Approve dialog: "Approving rejects the other 2 pending requests for this seat (Name1, Name2)." This is the only place the auto-reject consequence shows, which is why it matters.
- Sort: keep the API order (newest first). Optionally visually group rivals by an indented label rather than re-sorting.
- Actions: `Approve` (primary, `check` icon) and `Reject` (danger or tonal) in the card footer. Show them only for pending rows. Add `aria-label`s with the requester and seat, like `roomsCopy.editLabel(code)`.

**Status filter.** Use `FilterChips` with 4 options in the order pending, approved, rejected, cancelled. The default is pending and the label is "Status".
- Keep the filter in `?status=`. Parse it with a pure `parseStatusParam(raw)` that falls back to `pending` for unknown or missing values. Use `useSearchParams` and `router.replace` (no history spam), and keep `page.tsx` as a server component that renders a client page inside Suspense if needed. Check what the Next 16 build requires for `useSearchParams`.
- Changing the filter resets the list and cursor. Add a `Load more` button when `nextCursor` is set, like Audit, because the spec allows more than 50 requests.
- Count badges per status are not available (the API has no counts). Do not invent them.

**Confirm dialogs.** Use two dialogs, or one dialog with `kind: "approve"|"reject"`.
- Approve: title "Approve request?". Body: "Name will be seated at A1-03 in Room A1. Their current primary device, if any, becomes secondary." (Check DEV-06 wording against the spec before copying.) Add the rival sentence when there are rivals. Submit label "Approve".
- Reject: title "Reject request?". Body: "Name's request for A1-03 will be rejected. This can't be undone." Submit label "Reject". Do not add a reason field (the API takes none).
- Per-row busy: hold `busyId` in the hook. While it is set, disable that row's buttons and the dialog submit. Other rows stay usable. Use a distinct `key` per request for the dialog (like `DeleteInner`).
- Outcome mapping (a pure `actionOutcome(action, result)` in `requests-state.ts`):
  - ok with the expected status: close, reload the list, optional success note "Approved".
  - ok with a different status (no-op, someone else decided): close, reload, show a "Already decided" note. Use `aria-live=polite`.
  - `not_found`: close and reload (as in `DeleteRoomDialog`).
  - `seat_taken`, `seat_cannot_seat`, `member_not_assignable`: keep the dialog open and show `apiErrorMessage(code)` in the dialog error. Offer Cancel and Reject as the way forward. After a `seat_taken` refusal, reload the list in the background so the occupant shows.
  - Any other code: show `apiErrorMessage`.
- Reload after a decision. Rival rows disappear from "pending" automatically when reloaded.

**Copy.** Put everything in `src/ui/copy/requests.ts` (D36): filter labels, status names, row strings, dialogs, empty text per filter, "approvedBy", and the age strings. `no-literals.test.ts` will fail on literals in components. Check `copy.test.ts` for the shape it expects.

**Empty states.**
- Pending, none: "No pending requests." (existing `shellCopy.pages.approvals.empty`). Add a hint like "New requests appear here."
- Other filters, none: "No approved requests yet", and the same for rejected and cancelled. Use `emptyFor(status)` in copy.
- Error: the Audit retry Card. Forbidden (user tier reaching `/approvals`): the no-access Card, as in AuditPage, with no fetch.

**Narrow screens (390 px).**
- Cards stack in a single column (`grid gap-3`). Row content uses `flex-col sm:flex-row sm:items-center sm:justify-between`.
- Buttons go full-width at the bottom (`flex gap-2`, each `flex-1 sm:flex-none`, min touch height). Use `break-words` on names and `min-w-0`.
- `FilterChips` is 4 chips with `px-4`, so it will overflow around 390 px. Wrap it in `overflow-x-auto`, or shorten labels. Check with a static class assertion plus a manual check.
- Dialog max width is 440 px with `w-[calc(100%-2.5rem)]`, already fine.

**Files and tests (matching the ticket scope).**
- `requests-api.ts`: `createRequestsApi(apiFetch)` with `list(status, cursor)`, `approve(id)`, `reject(id)`. Use `{ok, value}|{ok:false, code}` like `rooms-api`. Test URL building, and that an unknown error body maps to `internal`.
- `requests-state.ts`: `parseStatusParam`, `rivalsOf`, `relativeAge(now)`, `actionOutcome`, `canApprove(item)`. Pure tests.
- `useRequests.ts`: `status`, `items`, `hasMore`, `busyId`, `reload`, `loadMore`, `decide(action,id)`. Guard against stale responses when the filter changes quickly (see how `useAudit` handles it, and copy it).
- `ApprovalsView.tsx`: pure, with static-render tests (no jsdom) for loading, error, forbidden, empty per filter, pending rows with rivals and occupant, decided rows, and the busy row. The dialogs are in separate components and are tested via pure state plus static render of the closed and open shells where possible.
- `page.tsx`: replace the stub with a client `ApprovalsPage`, session-gated for manager and above (add `canDecide(tier)` in state).

## Risks
1. Rivals derived client-side are incomplete when pending requests exceed one page (limit 50), or when the first page is partial. The count could then be wrong, and a "2 others" chip could understate. Mitigations:
   - Word the copy as "also requested by ..." only for loaded rivals, or
   - Ask SIM-014 backend for a `rivalCount` in `RequestListItemDto` (a small additive change, but out of this ticket's scope per R4).
2. Approve button disabled by the listed `currentOccupant` may be stale. The server stays the authority, and the 409 message must stay visible.
3. The apiFetch 401/403 re-send (R7) means a double approve is possible only via auth codes, which the wrapper emits before side effects. This should be safe, but per-row `busyId` must still prevent a user double-click.
4. `?status=` handling with `useSearchParams` can force dynamic rendering or a Suspense boundary in Next 16 builds. Verify with `pnpm build`.
5. `EntityFormDialog` has a fixed primary submit style. A danger variant for Reject may need a small prop addition, which touches a shared component (check kit tests).
6. No relative-time helper exists, and locale or timezone differences between server and client could cause hydration mismatches. Compute age only client-side after mount, or pass `now` from state, and keep the static-render tests deterministic.
7. The no-op response (HTTP 200 with a different status) looks like success to a naive client. Compare `value.status` against the intended outcome.

## Open questions
1. Should Approve be disabled when the list shows `currentOccupant`, or enabled so the server returns 409 and the message explains it? Recommend disabling plus an explanatory chip.
2. Is a "rivals" hint acceptable as best-effort client-side grouping, or should the list DTO gain `rivalCount` or `rivals[]`? Both are possible. A DTO change is cleaner but out of scope here.
3. After a decision, should the page show a transient success note ("Approved A1-03 for Name, 2 other requests rejected")? The rejected count is not returned. Recommend a short note without the count.
4. Should the requester name link to the member or the seat detail (`/rooms/<code>`)? Not required by the ACs. Recommend only the room code link, or none.
5. Does the Approve dialog need to mention demoting the subject's primary device (DEV-06)? I did not verify the exact wording in the spec, so please confirm the copy with Ming.
6. Does the decided-rows view need the decider and time? The DTO has `decidedBy` and `decidedAt`, so I recommend showing them.

Key files: src/lib/requests/types.ts, src/lib/requests/rules.ts, src/server/requests/read.ts, src/app/api/requests/route.ts, src/ui/audit/AuditView.tsx, src/ui/audit/AuditPage.tsx, src/ui/rooms/DeleteRoomDialog.tsx, src/ui/EntityFormDialog.tsx, src/ui/Chip.tsx, src/ui/copy/api.ts, src/ui/copy/shell.ts, src/app/(app)/approvals/page.tsx.
