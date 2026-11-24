# Consult — frontend-developer (SIM-014.2)

## Findings

**Ticket and stub**
- The ticket scope is `src/app/(app)/approvals/page.tsx`, `src/ui/requests/{requests-api,requests-state,useRequests}.ts`, `ApprovalsView.tsx`, and `src/ui/copy/requests.ts`. There is also a `?status=` filter, confirm dialogs and per-row busy state.
- The stub renders `PageSkeleton` with `shellCopy.pages.approvals` (title "Approvals", empty "No pending requests."). The AppShell already hides the `/approvals` link from the `user` tier and shows it to managers (AppShellView.test).
- `src/app/(app)/devices/page.tsx` is just `return <DevicesPage/>` from `@/ui`. Mirror it, and check the `src/ui/index` barrel exports.

**API contract (already built, SIM-014)**
- `GET /api/requests?status=pending|approved|rejected|cancelled&limit&cursor` needs the manager tier. It defaults to pending and returns `RequestPage = { items: RequestListItemDto[]; nextCursor: string|null }`.
  - `limit` defaults to 50, max 100.
  - A bad `status` or a duplicate param returns 400 `invalid_request`.
- `RequestListItemDto` holds `id`, `status`, `seat {id, code, roomId, roomCode}`, `subject {id, displayName}`, `createdAt`, `decidedAt`, `decidedBy`, and `currentOccupant {id, displayName} | null`. The occupant field lets the row warn "seat now taken" before the click.
- `POST /api/requests/[id]/approve` and `/reject` need the manager tier and return the updated `RequestDto` with 200.
  - A bad UUID or a missing request gives 404 `not_found`.
  - If the request is already decided, the call is idempotent and returns the current DTO (200, no error). The UI must therefore read the returned `status`. A manager can click Approve on a request someone else already rejected and get 200 with `status: "rejected"`.
- Approve refusals:
  - 409 `seat_taken`
  - 409 `seat_cannot_seat`
  - 422 `member_not_assignable` (the subject was deactivated)
  - 404 `not_found`
- Reject has only 404 `not_found`. Approving also auto-rejects rival pending requests for the same seat.
- `apiErrorMessage` in `src/ui/copy/api.ts` already has text for `seat_taken`, `seat_cannot_seat`, `member_not_assignable`, `not_found` and `no_linked_member`. No new error codes are needed, so `copy/api.ts` should not change.

**Patterns to copy (devices)**
- `devices-api.ts`: `createDevicesApi(fetcher)` wraps `ApiFetch` in a `call<T>(path, init, read)` helper. It returns `{ok, value} | {ok:false, code}`, never throws, and maps `ApiAccessError` signed_out to `unauthenticated`. It sends JSON bodies and validates the response shape (`internal` on mismatch). Copy this for `requests-api.ts` with `list(status, cursor?)`, `approve(id)` and `reject(id)`. The approve and reject calls have no body.
- `devices-state.ts` and `useDevices.ts`: the reducer has `load` (clears rows), `refresh` (keeps rows) and `loaded` events. A `latest` counter drops stale answers. The hook uses a `mounted` ref and `reload`/`refresh` callbacks. Copy this, but swap the key from placement filter to status.
- `DevicesPage.tsx` (client, uses `useApiFetch` and `useMemo(createApi)`) holds the filter state, the dialog state and the `refresh` calls. `DevicesView.tsx` is a pure view that gets props. It has loading skeleton cards, an error card with Retry (`apiErrorMessage`), an empty card, a `FilterChips` bar with an `aria-live` summary, and an `h1` with `headingRef` focus after a delete.
- `DeleteDeviceDialog` uses `EntityFormDialog` (props `open`, `title`, `subtitle`, `submitLabel`, `submitting`, `error`, `onClose`, `onSubmit`). It is mounted only while a target is set (wrapper plus inner keyed by id). The outcome logic is pure and lives in `delete-device-flow.ts` (`settleDelete` and similar returning `{kind:...}`). `onStale` and `onDone` both trigger `refresh()`. `DeviceRowActions` renders `Button variant="tonal"|"danger" size="sm"` with an `aria-label` per action.
- URL-backed state: only `SeatsPage` uses `useSearchParams`. It wraps the page in `<Suspense>` and uses `router.replace(href, {scroll:false})`. `?status=` has no precedent for filters, so follow the SeatsPage pattern.
- Tests are static render (`renderToStaticMarkup`) plus pure-logic tests with no jsdom, e.g. `DevicesView.test.tsx`, `DeleteDeviceDialog.test.tsx`, `devices-state.test.ts`, `devices-api.test.ts`, `delete-device-flow.test.ts`. There is a copy test and a `no-literals.test.ts` that forbids literal UI strings in components.

## Recommendations
1. **Files** (acceptance criteria 1-3).
   - `src/ui/copy/requests.ts` has filter labels (Pending, Approved, Rejected, Cancelled), per-status empty text, the summary, the approve and reject dialog text, a "seat now taken by X" hint, and "already decided" messages.
   - `requests-api.ts` and `requests-state.ts` (reducer plus `parseStatus`, `emptyText`, `listSummary`, `filterOptions`) are the pure logic.
   - `requests-flow.ts` (a name I'd suggest) holds `settleDecision(action, result)`. Beside it sit `useRequests.ts`, `ApprovalsView.tsx`, `ApprovalsPage.tsx` (client), `DecisionDialog.tsx` (approve or reject, one component keyed by action) and `RequestRowActions`.
   - Also add the exports in `src/ui/index` and replace the stub `page.tsx`. A new `shellCopy.pages.approvals.empty` is not needed if the per-status empties go into `requestsCopy`.
2. **Filter in the URL.** Parse `?status=` with a pure `parseStatus(getAll("status"))` that falls back to `pending` on an invalid or duplicate value. Selecting a chip calls `router.replace` and omits the param for the default. Wrap `ApprovalsPage` in `<Suspense>`, like SeatsPage. Test `parseStatus` and the href builder as pure functions.
3. **Decision outcomes** (pure `settleDecision`, unit tested):
   - On success, if the returned `status` equals the intended one, close and `refresh()`.
   - On success with a different status (idempotent no-op), close, refresh and show a non-blocking notice like "This request was already {status}."
   - 404: close and refresh (the request is gone).
   - 409 `seat_taken`, 409 `seat_cannot_seat` and 422 `member_not_assignable`: keep the dialog open and show `apiErrorMessage`. Call `onStale` to refresh so the row shows the new occupant.
   - 401, 403 and the rest: show the message and keep the dialog open.
   - After an approve, `refresh()` is essential because rivals flip to rejected. Move focus to the h1 afterwards, as devices does.
4. **Per-row busy state.** Fold it into the dialog (`submitting` disables the buttons), as devices does. The ticket also asks for a per-row busy state. Keep `busyId: string | null` in page state and disable that row's buttons while its dialog is submitting. This also stops a double approve from two rows. Only show Approve and Reject when `status === "pending"`.
5. **Row content.** Show the seat as `roomCode / seat.code`, the subject's `displayName`, the created date and, for decided rows, `decidedBy` and `decidedAt`. For pending rows, show an inline warning when `currentOccupant` is set ("Currently occupied by X"). Include the seat and subject names in the confirm text and in the `aria-label`s. Use a table on large screens and cards on small ones, as `DeviceTable` does.
6. **Pagination.** The API pages at 50, max 100. Simplest within scope is a "Load more" button that appends using `nextCursor`. The reducer then needs a `loadMore` event or a `cursor` field. The alternative is to show only the first page with a "showing first 50" note, like the devices `truncated` copy. Pick one in the plan. "Load more" is more correct, because a busy org can have more than 50 pending requests.
7. **Layers (R1).** `src/ui/requests/*` imports only `@/lib/requests/types` and `@/lib/api/fetch`, never `src/server`. `REQUEST_STATUSES` from `@/lib/requests/types` can drive the chips. R7: the UI should only treat 401/403 as auth failures. `apiFetch` re-sends once on those, which is safe here because the API wrapper issues them before any side effect.
8. **Tests** (R5):
   - `requests-api.test.ts`: URL building (status, limit and cursor are encoded), shape validation, error-code extraction, and a thrown error mapped to `unavailable`.
   - `requests-state.test.ts`: reducer load, refresh, stale-id ignore and append.
   - `settleDecision` for every code above.
   - `ApprovalsView.test.tsx`: static render of loading, error, empty per status, a list with a pending row (buttons present), a decided row (no buttons), the occupant warning and the active chip.
   - A dialog static render test.

## Risks
- **Idempotent decisions look like success.** Without the status check in rec 3, the UI would say "Approved" for a request that was already rejected. The same goes for an approve that raced with a rival's approval: it gets 409 `seat_taken`, so the refresh is what makes the list correct.
- **Stale approvals.** Without polling (out of scope), the list can be out of date. The reload after a decision and on a refused action covers the common case. The dialog should name the seat and the person so the manager approves the right one.
- **Suspense plus `useSearchParams`.** A missing Suspense boundary breaks the build with a bailout error (the `pnpm build` check).
- **Filter changes while a request is in flight.** The `latest` id guard handles this, but a dialog opened on a row that disappears after a filter change needs to be closed or tolerate a 404.
- **Copy rules.** `no-literals.test.ts` fails if strings are inline. Role gating is only server-enforced for the API (manager tier). The page for a plain `user` reached by URL will show a 403 error card. Consider a friendly "no access" message, or reuse the existing pattern if other manager-only pages have one.

## Open questions
1. Pagination: "Load more" with a cursor, or first page only with a note? I recommend "Load more".
2. Should an already-decided response (an idempotent 200) show a notice, or just refresh silently? I recommend a short notice.
3. Is a `user`-tier visit to `/approvals` handled by a guard anywhere? My Grep found no tier check under `src/app/(app)`. If none exists, should the page show a no-access state? I suggest a small copy line and not hiding it further.
4. Should the empty-state text for pending stay `shellCopy.pages.approvals.empty` ("No pending requests.") or move into `requestsCopy`? I suggest moving it into `requestsCopy` and removing it from the shell later.
5. Does SIM-014.1 or the spec (REG-01/02, D21/D23/D26) want a reject reason or a note? The API takes no body, so I assume not.

Key files read: src/lib/requests/types.ts, src/app/api/requests/route.ts, src/app/api/requests/[id]/approve/route.ts, src/server/requests/requests.ts, src/ui/devices/devices-api.ts, src/ui/devices/devices-state.ts, src/ui/devices/useDevices.ts, src/ui/devices/DevicesPage.tsx, src/ui/devices/DevicesView.tsx, src/ui/devices/DeleteDeviceDialog.tsx, src/ui/devices/delete-device-flow.ts, src/ui/copy/api.ts, src/ui/seats/SeatsPage.tsx.

I did not read the SIM-014 and SIM-014.1 plan.md files. The contract above comes from the code.
