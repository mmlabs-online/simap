# Consult — frontend-developer (SIM-014.3)

Consult report for SIM-014.3 (read-only; nothing was edited or run).

## Findings

**API contracts, already merged (SIM-014 and SIM-014.1):**
- `POST /api/requests` takes `{seatId}` and has tier `user`. It returns 201 for a new request and 200 with the existing pending `RequestDto` on a duplicate.
- The refusals are 404 `not_found`, 409 `seat_taken`, 409 `seat_cannot_seat`, 422 `no_linked_member` and 422 `member_not_assignable`.
- `seat_taken` and `no_linked_member` copy already exists in `src/ui/copy/api.ts` (lines 33-34), as do `seat_cannot_seat` and `member_not_assignable`, so no new error copy is needed.
- Both 200 and 201 come back as `res.ok`. The client cannot tell a duplicate from a create unless the api wrapper returns the status or the DTO's `status`.
- `POST /api/requests/[id]/cancel` takes no body and has tier `user`. It returns 200 with the DTO, or 200 as a no-op if the request is already non-pending.
- `GET /api/requests/mine` takes `cursor` and `limit` and returns `{items: MyRequestDto[] (RequestDto & isNew), unseen, nextCursor}`.
  - `unseen` counts all the caller's rows, not just the page.
  - For a caller with no member row it returns `{items: [], unseen: 0, nextCursor: null}`.
- `POST /api/requests/mine/seen` takes `{}` or `{seenUpTo}` and returns `{unseen, requestsSeenAt}`.
  - `seenUpTo` must be a microsecond ISO string, such as `...00.123456Z`. A millisecond form, a missing fraction or an offset gives 400.
  - The SIM-014.1 plan says the UI should send the newest `decidedAt` it displayed, taken verbatim from the API. This keeps a decision that lands after the list load unseen.
  - An absent `seenUpTo` means now.
  - The server never moves the value backwards and caps it at now.

**Existing UI that can be reused:**
- `src/ui/requests/requests-api.ts` has only `list` (GET). It needs `create`, `cancel`, `mine(cursor?)` and `markSeen(seenUpTo?)`.
  - The current `call` helper hardcodes `{method:"GET"}` and has no body support. Copy the init/read shape from `createSeatsApi`, which has the same `call` but takes `init` and a `read`.
  - The api has two shapes of 401/403 handling: an `ApiAccessError` mapped to a code, and `res.ok` false mapped through `errorCode`. Keep both.
- `requests-state.ts` has `ListState`, `appendPage` and `formatRequestTime`. `ListState.items` is typed `RequestListItemDto[]`, which includes `currentOccupant` and not `isNew`. My requests needs `MyRequestDto[]` and the `unseen` count, so make `ListState` generic or add a `MyListState`.
- `useRequests(api, status)` is hard-wired to `api.list(status)`. Write a sibling `useMyRequests` (reload, loadMore, same stale-response counter and mounted guards) instead of bending the existing hook.
- `ApprovalsView.tsx` (not read in detail) is the template for My requests rows and the loading, error and empty states. `ApprovalsPage` sets the page pattern: a client component, `useApiFetch` plus `useMemo(createRequestsApi)`, and a route file at `src/app/(app)/approvals/page.tsx`.
- `requestsCopy` is Approvals-only. Add a `mine` section to `src/ui/copy/requests.ts`: title, empty state, a "New" marker, Cancel, "already requested" and "Request this seat". Keep it under D36.
- `seatButtons(tier, seat)` returns `SeatButtons` and `SeatActions.tsx` renders it.
  - `SeatDto` has `status`, `cannotSeat`, `occupant` and `mine`, but no `hasPendingRequest`. The SIM-014 plan deferred that field to this slice.
  - A request button rule needs no new field: show it when `seat.occupant === null && !seat.cannotSeat`.
  - Tier: "Users only" is ambiguous. `canAssign` already covers manager and above, and those tiers can assign directly. Use the literal tier `user`, as the ticket scope says.
- `actionOutcome(action, result)` has a final fallthrough that treats any unknown action as release. Adding `"request"` to the `SeatAction` union means adding an explicit branch, or release copy (`releaseChanged`) will leak into request failures.
- `useSeatActions.run(action, seatCode, started, call)` is generic. Add a `requestSeat(seat)` that calls `run("request", seat.code, null, () => requestsApi.create(seat.id))`.
  - `run` types `call` as `Promise<ActionResult>`, so the requests api result has to be mapped to `{ok}` or `{ok:false, code}`.
  - `run` always reloads on non-auth failures. That is correct after `seat_taken`, because the seat changed. It is wasted on success, where the seat does not change.
  - `useSeatActions` takes a `SeatsApi`. Either inject a second api or add `requestSeat` to the hook's props. Keep the R1 layering (ui to lib) intact.
- `src/lib/nav.ts` has `NavId` (7 ids), a `NAV_ITEMS` list and `isActive`. `shellCopy.nav` is `satisfies Record<NavId,string>`, so adding `myRequests` makes the compiler force the copy entry.
  - `isActive` for `/requests` matches `/requests/...` only, so it does not clash with `/approvals`. The `/requests` route must not exist as an API-only path in the app tree. Only `src/app/api/requests` exists, so a page at `src/app/(app)/requests/page.tsx` is fine.
  - The nav rail is `placement:"rail"`, `minTier:"user"`. Choose an icon from `IconName` (src/lib/icons, not read).
- `AppShellView` is a pure presentational component. The nav `<Link>` renders an `Icon` in a `span` plus a label. A badge needs an absolutely positioned count on that span, with an accessible name such as "N newly decided requests". It also needs an optional `badges?: Partial<Record<NavId, number>>` prop so existing tests and `dev/shell/page.tsx` keep compiling. `AppShell.tsx` is the one place that calls the hook and passes `badges`.

## Recommendations

1. **api (AC1, AC2, AC3):** extend `createRequestsApi` with the four methods. Make `call` take `init` and a `read`, and make `create` return `{created: boolean, request}` using `res.status === 201`. Add unit tests in `requests-api.test.ts` modelled on `seats-api.test.ts`. Test shape validation too: an invalid body gives `internal`, and a missing `unseen` gives `internal`.
2. **Seat button (AC1):** add `request: boolean` to `SeatButtons`, true when `tier === "user"` (decide per Q1), the seat is empty and the seat is not cannot-seat. Cover it in `seat-actions.test.ts` as a tier by occupied or empty by cannotSeat table. Add `"request"` to `SeatAction` and `actionOutcome` with explicit branches:
   - success: no reload needed, with a message such as "Request sent" or "Request already sent";
   - `seat_taken`, `seat_cannot_seat` or `not_found`: reload;
   - `no_linked_member`: message only, no reload;
   - `not_found`: close the panel (deleteGone).
3. **Duplicate, "already requested" (AC1):** the server returns 200 on a duplicate, so the "already requested" message must come from `created === false`. Do not show a failure. Either `create` returns the created flag and `requestSeat` sets the notice from it, or `ActionResult` gains an optional `info`. Use `role="alert"` or `role="status"` consistently with the existing notice. `SeatActions` renders notices as `role="alert"` with `text-error`. A success or info message in error red would be wrong, so add a variant or a second prop for info notices.
4. **Hide the button when already requested (optional):** `hasPendingRequest` on `SeatDto` needs a server change (out of scope, R4). Leave the seat DTO alone and rely on the 200 response, as the SIM-014 plan suggests.
5. **My requests page (AC2):** add `src/app/(app)/requests/page.tsx` and `MyRequestsPage`, `MyRequestsView` and `useMyRequests`.
   - Rows show seat line, status (reuse `statusLabel`), requested time and decided line (`decidedLine`), plus a "New" marker where `isNew`.
   - A Cancel button shows on `status === "pending"` rows only.
   - A cancel click calls `cancel(id)` and then reloads the list. Disable that row's button while busy.
   - A `not_found` or no-op 200 is fine and just reloads.
   - Pagination reuses Load more with the cursor.
6. **Seen flow (AC3):**
   - After the first page of My requests loads, compute `maxDecidedAt` over the rows where `isNew`. Compare the microsecond strings lexicographically, which is safe because they have the same fixed-width format. Call `markSeen(maxDecidedAt)`. If there are no new rows, skip the call.
   - Do not call `markSeen` with no argument. That sets it to now and would hide a decision that landed after the list load.
   - After a successful mark, update the shell badge to the returned `unseen`.
   - Opening page 2 with Load more may reveal more new rows, so mark again only on a change.
   - Keep the `isNew` markers on the page for that visit, even after the mark, so users can still see which rows were new.
7. **Badge hook (AC3):** `useRequestBadge(api)` in `src/ui/requests/`. It fetches `mine` (use `limit=1` to keep it cheap, since `unseen` is global) on mount, on pathname change and on window focus/visibility. No polling (D24). It must:
   - guard against stale responses with a counter, as in `useRequests`;
   - return 0 on any failure and never throw;
   - skip fetching when `session` is null;
   - receive a setter or a refresh callback from `MyRequestsPage` after `markSeen`, so the badge clears at once instead of waiting for the next route change.
   Share one state through a small context or a custom event. Simplest: `AppShell` owns the hook and exposes `{unseen, setUnseen, refresh}` via a context provider that `MyRequestsPage` consumes. The alternative is for `MyRequestsPage` to rely on the route-change refetch, since the badge refetches on pathname change, so leaving My requests clears it anyway. That is simpler but leaves the badge stale while on the page.
   - The effect on route change must run after `markSeen` resolves, otherwise it races. On `/requests` the badge fetch races the mark call. Fix by either awaiting the mark inside the page and then calling `refresh`, or ignoring the pathname fetch while `pathname === "/requests"`.
8. **AppShellView badges (AC3, AC4):** add `badges?: Partial<Record<NavId, number>>` and render a count pill for values > 0 (cap at "9+"). Put an `aria-label` or visually hidden text on the link, such as "My requests, 3 new". Static render tests assert the pill and the label, and no pill at 0.
9. **Tests (AC4, no jsdom):**
   - seat-actions: `seatButtons.request` table and `actionOutcome("request", ...)` per code.
   - requests-state: any `maxDecidedAt` helper (including empty and mixed microsecond strings) and any badge-count formatting.
   - Static render with `renderToStaticMarkup`, as in `ApprovalsView.test.tsx`: `MyRequestsView` for loading, error, empty, rows with Cancel (pending only) and the New marker.
   - `AppShellView` badge rendering and the `nav.test.ts` additions: the `myRequests` item is visible to a user and to higher tiers, is active only on `/requests`, and is not confused with `/approvals`.
   - Update `shellCopy.nav.myRequests`, `routes` copy if the page uses a title skeleton like `shell.routes.approvals`, and `src/ui/index.ts` exports.

## Risks

- **Late 401/403 repeating a write (R7):** `apiFetch` re-sends once on 401/403. A duplicate `create` is safe (200 with the existing request) and `cancel` is idempotent. `markSeen` is monotonic. All the writes in this slice are idempotent, so this is low risk, but document it in the plan.
- **Microsecond precision:** do not parse `decidedAt` with `Date`. Use the string as-is, or the seen call will 400 or clear too much. This is the main correctness trap in the slice.
- **Badge race:** the focus/route fetch can overwrite a just-cleared badge with a stale count. Guard with the counter or ignore stale responses, and clear after the mark resolves.
- **`run()` fallthrough:** a new `"request"` action without an explicit branch gets release's `not_allowed` copy and always reloads.
- **Success notice style:** `SeatActions` notice is error-styled and the notice is dropped when the open seat changes. An info notice for "already requested" needs a non-error style.
- **`ListState` typing:** `ListState.items` is `RequestListItemDto[]`. Reusing it for `MyRequestDto` needs a generic, or unsafe casts creep in.
- **Users with no member row:** `no_linked_member` (422) on create, and an empty list from `mine`. The My requests empty state should not claim "no requests" in an error-like way. A calm message is enough.
- **Manager/Admin on My requests:** the nav entry has `minTier:"user"`, so all tiers see it. Managers can already approve or assign, so decide whether the "Request this seat" button shows for them (Q1). The server accepts every tier.
- **Layers:** `AppShell` (`src/ui`) must only call `requests-api` through `useApiFetch`. No server imports, per `pnpm check:layers`.

## Open questions

1. Should "Request this seat" show for Managers and Admins, who can assign directly, or for tier `user` only? The ticket says "Users only". My reading is the literal tier `user`, but managers may also have their own seat requests (the API allows it). Ming to confirm.
2. Does My requests need status filtering or only one flat newest-first list? The API has no status filter for `mine`, and the ticket says only "lists requests". Assume a flat list.
3. Should the badge count come from a dedicated `limit=1` call to `mine`, or is there a lighter endpoint? There isn't one, so the `limit=1` call is the plan, but it makes a DB read per focus or route change. Acceptable per D24.
4. How should the seat panel show an existing pending request for the caller (the button stays, and the 200 response says "already requested")? Is that enough, or should a `hasPendingRequest` field on `SeatDto` ship (a server change, so a separate slice)?
5. Cancel confirmation: a direct click or a confirm dialog? The Release flow uses a confirm dialog. Cancel of a pending request is low-risk and reversible (the user can request again), so no dialog is my suggestion.

Files read: src/ui/seats/seat-actions.ts, src/ui/seats/useSeatActions.ts, src/ui/seats/SeatActions.tsx, src/ui/requests/requests-api.ts, src/ui/requests/requests-state.ts, src/ui/requests/useRequests.ts, src/ui/requests/ApprovalsPage.tsx, src/ui/copy/requests.ts, src/lib/nav.ts, src/ui/AppShellView.tsx, src/ui/AppShell.tsx, src/lib/requests/types.ts, src/app/api/requests/route.ts, src/app/api/requests/mine/route.ts, src/app/api/requests/mine/seen/route.ts, src/app/api/requests/[id]/cancel/route.ts, work/tickets/SIM-014/plan.md, work/tickets/SIM-014.1/plan.md.
