Status: READY

# Plan — SIM-014.3: Request a seat, My requests and nav badge

One slice covers the whole ticket (Ming declined the split on 2026-11-24, "k tách"):
- "Request this seat" in the seat panel.
- The `/requests` page (My requests) with Cancel, "New" markers and the mark-seen call.
- The `myRequests` nav entry with its badge (`useRequestBadge`, `badges` prop on `AppShellView`).

## Scope summary
- spec REG-01 (`docs/spec-v1.md:371-375`): "**REG-01 Request a seat** (any signed-in user with a linked member) —
  From the detail of an empty seat, a user requests it, and a pending request is created. — A second identical pending
  request (same seat and member) creates nothing new. — A request for an occupied seat is refused. — A User may
  request a seat in any room of the org (D21), for themselves only (D23)."
- spec REG-02 (`docs/spec-v1.md:382-385`): "Manager+ assign directly without a request (SEA-03). Only Users go through
  the approval flow. — The requester can cancel their own pending request (D24). — "My requests" lists the user's
  requests with their status; a badge counts requests decided since the user last opened it. No email (D24)."
- D21 "Users may request a seat in any room of the org."
- D23 "Users request seats only for themselves; Managers assign others directly."
- D24 "Requesters can cancel pending requests; decisions show in-app ("Yêu cầu của tôi" with a badge), no email."
- D26 "Keep the per-seat "không xếp chỗ" flag with a reason; it blocks assignment and requests."
- D36 "UI copy is English by default; all user-facing text lives in copy files."
- Ticket scope bullets 1, 2 and 3; out of scope: email, polling or push (D24).
- Contracts used unchanged (SIM-014 and SIM-014.1, merged):
  - `POST /api/requests {seatId}`, tier `user`. It returns 201 when it creates a request and 200 with the existing pending request on a duplicate (`src/app/api/requests/route.ts:22-25`).
  - `POST /api/requests/[id]/cancel`. It returns 200 with the DTO. A request that is no longer pending also returns 200, as a no-op with its current status. Another member's id or an unknown id returns 404 `not_found` (`src/server/requests/requests.ts:280-294`).
  - `GET /api/requests/mine?cursor&limit` returns `MyRequestsPage` = `{ items: MyRequestDto[]; unseen: number; nextCursor }`, where `MyRequestDto = RequestDto & { isNew: boolean }` (`src/lib/requests/types.ts:28-29`). `limit` accepts 1-100 (`src/lib/validate/request-query.ts:17`). `isNew` and `unseen` mean "approved or rejected with `decided_at` after `requests_seen_at`" (`src/server/requests/read.ts:66`, `116-117`).
  - `POST /api/requests/mine/seen` with `{}` or `{ seenUpTo }` (a microsecond ISO instant, `src/lib/validate/request.ts:29-37`) returns `RequestsSeenResult = { unseen; requestsSeenAt }` (`src/lib/requests/types.ts:31`, `src/app/api/requests/mine/seen/route.ts`). The server moves `requests_seen_at` forward only and never past now; **`{}` means now** (`src/server/requests/read.ts:137-162`), which is why the UI never sends it.
  - Decided instants are rendered by the server with one fixed `to_char` format in UTC (`read.ts:96`, `153`), so two of them compare correctly as plain strings.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A User sees "Request this seat" on an empty seat that can be seated. A duplicate request shows "already requested". (ticket AC1) | `seat-actions.test.ts` › "seatButtons.request: user only, empty, not cannot-seat" (table), › "requestResult maps created/duplicate/failure", › "actionOutcome request: sent and duplicate are info notices without reload". `SeatActions.test.tsx` › "user sees Request this seat on an empty seat", › "info notice renders as role=status, not alert". Local run (`pnpm dev`, User token): open an empty seat, click it, see "Request sent…". Click again and see "You already requested this seat." |
| 2 | My requests lists the caller's requests with their status, and Cancel works on pending ones. (ticket AC2) | `MyRequestsView.test.tsx` (loading, error, empty, rows with a status chip, Cancel on pending rows only, busy disables Cancel, notice roles). `requests-state.test.ts` › `cancelOutcome` table. `requests-api.test.ts` › create, cancel and mine cases. Local run: `/requests` lists the request, Cancel turns it into "Cancelled", and the nav shows "My requests" active. |
| 3 | The nav badge shows the number of newly decided requests and clears after My requests is opened. (ticket AC3) | `request-badge.test.ts` › `newestDecidedAt`, `badgeText`, `mergeNewIds`. `requests-api.test.ts` › markSeen cases. `AppShellView.test.tsx` › "badge: count on the myRequests link, hidden at 0, 9+ cap, numeral aria-hidden, sr-only text". `MyRequestsView.test.tsx` › "New chip on rows in newIds only". Local run (`pnpm dev` + `pnpm seed:dev` or a Manager approving through the API with a second token): as the User, the "My requests" rail item shows "1"; open `/requests`, the decided row shows "New" and the badge disappears; navigate away and back, the badge stays gone. |
| 4 | Static-render and pure-logic tests (no jsdom) cover the button rules, the page and the badge. (ticket AC4) | The tests listed in `## Tests to write` exist and pass. Run `pnpm test`, `pnpm typecheck && pnpm check:layers`, `pnpm format:check` and `pnpm build`. No test imports jsdom. |

## Ming verification after merge
- Sign in for real (Identity, `pnpm dev:token` or a hosted build) as a **User** with a linked member. Request an empty seat, then:
  - see it in My requests;
  - cancel it;
  - request it again;
  - have a Manager approve it through the API (the Approve dialog arrives in SIM-014.4); as the User, focus the tab or change page and see the badge "1" on My requests; open My requests, see the status "Approved" with the "decided by" line and a "New" chip, and see the badge clear.
- At about 360 px width as a Manager (6 rail items) and as an Admin (7 rail items), check that the bottom bar scrolls horizontally, that no item is cut off at the left, that "My requests" can be reached and that its badge is not clipped.
- With a screen reader (or the accessibility tree), the My requests link reads e.g. "My requests, 1 new decision".

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/requests/requests-api.ts` | Change `call` (lines 19-39) to `call(path, init, read)`. `read` gets `(body, status)`, so `create` can tell 201 from 200. Keep `list` working as it does now. Add `create(seatId)` (POST JSON `{seatId}` → `RequestCreateResult`, `created = status === 201`, body must have string `id` and `status`). Add `cancel(id)` (POST `/api/requests/${encodeURIComponent(id)}/cancel`, no body → `RequestDto`). Add `mine(cursor?, limit?)` (GET `/api/requests/mine?limit=<limit ?? 50>[&cursor]` → `MyRequestsPage`, which needs an `items` array, `nextCursor` as a string or null, and `unseen` as a finite number). Add `markSeen(seenUpTo: string)` (POST JSON `{ seenUpTo }` to `/api/requests/mine/seen` → `RequestsSeenResult`; the argument is required by type, so `{}` is never sent). | AC1, AC2, AC3 | no |
| `src/ui/requests/requests-api.test.ts` | Add create, cancel, mine and markSeen cases in the style of the existing `list` cases (lines 17-41). | AC1-AC4 | no |
| `src/ui/requests/requests-state.ts` | Make `ListState` (lines 11-17) and `appendPage` (lines 42-52) generic: `ListState<T = RequestListItemDto>`, `appendPage<T>`. These are type-only changes and Approvals is unaffected. Add pure `cancelOutcome(result)` (Approach step 6). | AC2 | no |
| `src/ui/requests/requests-state.test.ts` | Add a `cancelOutcome` table and one `appendPage` case with `MyRequestDto`. | AC2, AC4 | no |
| `src/ui/requests/request-badge.ts` | New, pure. `newestDecidedAt(items, after?)`, `mergeNewIds(prev, items)`, `badgeText(n)` (Approach step 10). | AC3 | no |
| `src/ui/requests/request-badge.test.ts` | New. Pure tests for the three helpers. | AC3, AC4 | no |
| `src/ui/requests/useRequestBadge.tsx` | New, `"use client"`. `RequestBadgeProvider` (context `{ count, set }`) plus the `useRequestBadge` fetch logic, and `useSetRequestBadge()` for the page (Approach step 11). | AC3 | no |
| `src/ui/requests/useMyRequests.ts` | New. A sibling of `useRequests.ts` (same counter and `mounted` guards and the same `reload`/`loadMore` shape) that calls `api.mine(cursor?)`. Exposes the items of each loaded page to the seen flow (Approach step 12). | AC2, AC3 | no |
| `src/ui/requests/MyRequestsView.tsx` | New. The pure page body, modelled on `ApprovalsView.tsx:55-149`, with a "New" chip for ids in `newIds`. | AC2, AC3 | no |
| `src/ui/requests/MyRequestsView.test.tsx` | New. Static render tests with `renderToStaticMarkup`, as in `ApprovalsView.test.tsx`. | AC2-AC4 | no |
| `src/ui/requests/MyRequestsPage.tsx` | New. A client container: `useApiFetch`, `useMemo(createRequestsApi)`, `useMyRequests`, the cancel flow with `cancellingId` and a notice, and the seen flow (`newIds`, `markedUpTo`, `markSeen`, `useSetRequestBadge`). | AC2, AC3 | no |
| `src/app/(app)/requests/page.tsx` | New. `import { MyRequestsPage } from "@/ui"` (the same shape as `src/app/(app)/approvals/page.tsx`). | AC2 | no |
| `src/ui/index.ts` | Export `MyRequestsPage`, next to line 26. | route import via `@/ui` | no |
| `src/ui/copy/requests.ts` | Add a `mine` section (strings in Approach step 7). | D36 | no |
| `src/ui/seats/seat-actions.ts` | Add `"request"` to `SeatAction` (lines 8-15). Change `ActionResult` (line 16) to `{ ok: true; duplicate?: true } \| { ok: false; code }`. Add `request: boolean` to `SeatButtons` and `seatButtons` (lines 43-64). Add `info?: string` to `Outcome` (lines 199-205). Add an explicit `"request"` branch in `actionOutcome` (lines 211-274) for both success and failure. Add pure `requestResult(r)`. | AC1 | no |
| `src/ui/seats/seat-actions.test.ts` | Add a `request` button table, `requestResult` cases and `actionOutcome("request", …)` cases. | AC1, AC4 | no |
| `src/ui/seats/useSeatActions.ts` | Take `requestsApi: Pick<RequestsApi, "create">`. Add `info` state (`{ seatCode, text } \| null`), set from `outcome.info` in `run` (lines 64-86) and cleared with the notice. Clear it when `openCode` changes (lines 60-62). Add `requestSeat(seat)`. | AC1 | no |
| `src/ui/seats/SeatActions.tsx` | Add props `info: string \| null` and `onRequest`. Render the info line as `role="status"` with a non-error colour. Add `buttons.request` to the "any button" chain (lines 41-46). Add the "Request this seat" button, disabled while `busy`. | AC1 | no |
| `src/ui/seats/SeatActions.test.tsx` | Update the `render` helper (lines 24-38) with the new props. Add tests for the request button and the info line. | AC1, AC4 | no |
| `src/ui/seats/SeatsPage.tsx` | Create `requestsApi` with `useMemo(() => createRequestsApi(apiFetch))` and pass it to `useSeatActions` (line 95). Pass `info` (only when `actions.info?.seatCode === openCode`) and `onRequest={(s) => void actions.requestSeat(s)}` to `<SeatActions>` (lines 198-209). | AC1 | no |
| `src/ui/copy/seats.ts` | Add `actions.request`, `requestSent` and `requestDuplicate` (in the `actions` block, lines 36+). | D36 | no |
| `src/lib/nav.ts` | Add `"myRequests"` to `NavId` (lines 4-11). Add `{ id: "myRequests", href: "/requests", icon: "inbox", minTier: "user", placement: "rail" }` right after `members` (line 26). | AC2, AC3 (nav entry, ticket scope) | no |
| `src/lib/nav.test.ts` | Update the id lists and the rail-order test (lines 7-33). Add `isActive` cases for `/requests`. | AC4 | no |
| `src/lib/icons.ts` | Add `"inbox"` to `ICON_NAMES` in alphabetical order, between `history` and `lan` (lines 16-17). | `Icon` only accepts listed names | no |
| `src/ui/copy/shell.ts` | Add `nav.myRequests: "My requests"` (lines 9-17; `satisfies Record<NavId,string>` forces it). Add `pages.myRequests: { title: "My requests", empty: "You have no seat requests yet." }` (lines 35-44). Add `badge: { newDecisions: (n: number) => …, overflow: "9+" }` (Approach step 7). | D36 | no |
| `src/ui/AppShellView.tsx` | (a) Bottom-bar overflow: the rail row `div` (line 61) and the `Link` class (lines 69-70), Approach step 9. (b) New optional prop `badges?: Partial<Record<NavId, number>>` (props at lines 19-31) and the badge markup inside the icon pill (lines 72-81) plus an sr-only line in the link, Approach step 13. | AC3; the 6th and 7th rail items would be clipped at 360 px | no |
| `src/ui/AppShellView.test.tsx` | Update "admin on /rooms/A1: … 6 links" (lines 80-94) to 7 links with `/requests` after `/members`. Add the badge tests. | AC3, AC4; existing test breaks with the new entry | no |
| `src/ui/AppShell.tsx` | Wrap the shell in `RequestBadgeProvider`; read the count with `useRequestBadge(pathname)` and pass `badges={{ myRequests: count }}` (lines 10-24). | AC3 | no |

No file matches a High path.

## Data model / migration
None.

## API contract
None. No endpoint, DTO or server change. The UI consumes the merged contracts listed under `## Scope summary`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/seats/seat-actions.test.ts` › "seatButtons.request: user only, empty, not cannot-seat": the cases are tier {user, manager, admin, null} × {empty, occupied, own seat (`mine`, occupied), empty and cannot-seat}. `request` is true only for user, empty and not cannot-seat. The existing buttons are unchanged. | AC1 button rule |
| › "requestResult maps created/duplicate/failure": `{ok:true, value:{created:true}}` → `{ok:true}`; `created:false` → `{ok:true, duplicate:true}`; `{ok:false, code}` → `{ok:false, code}` | AC1 duplicate |
| › "actionOutcome request: sent and duplicate are info notices without reload": both give `reload:false, closePanel:false, message:null`. `info` is `requestSent` or `requestDuplicate`. | AC1 |
| › "actionOutcome request failures": `seat_taken` and `seat_cannot_seat` → reload, message `apiErrorMessage(code)`, no info. `not_found` → reload, closePanel, `deleteGone`. `no_linked_member` and `member_not_assignable` → no reload, `apiErrorMessage`. Auth codes and `invalid_request` → no reload. `not_allowed` is **not** `releaseChanged`. `unavailable` → reload with the api message. | AC1, fall-through trap |
| › existing `actionOutcome` success for other actions still reloads, and `delete` still closes the panel (regression of the reshaped ok branch) | no regression |
| `src/ui/seats/SeatActions.test.tsx` › "user sees Request this seat on an empty seat; not on occupied or cannot-seat; manager and admin never" | AC1 |
| › "a user with only the request button still gets the button row" (the any-button chain) | AC1 |
| › "info notice renders as role=status, not alert; error notice stays role=alert" | AC1 feedback |
| › "busy disables Request this seat" | AC1 |
| `src/ui/requests/requests-api.test.ts` › "create: POST /api/requests with JSON {seatId}; 201 → created true; 200 → created false" | AC1 |
| › "create: 409 seat_taken → code; 422 no_linked_member → code; body without id → internal; fetch throws → unavailable; signed_out → unauthenticated" | AC1 errors |
| › "cancel: POST /api/requests/<encoded id>/cancel with no body; 200 → DTO; 404 → not_found" | AC2 |
| › "mine: GET /api/requests/mine?limit=50, cursor appended and encoded; limit=1 when given; missing unseen or items not an array → internal" | AC2, AC3 |
| › "markSeen: POST /api/requests/mine/seen with JSON {seenUpTo} exactly as given (µs string unchanged); 200 → {unseen, requestsSeenAt}; unseen not a number → internal; 400 → invalid_request" | AC3 |
| › existing `list` tests unchanged and green (refactored `call`) | no regression |
| `src/ui/requests/requests-state.test.ts` › "cancelOutcome": ok with status `cancelled` → reload and `cancelled` text (status tone). Ok with `approved` or `rejected` → reload and `alreadyDecided` text. `not_found` → reload and `apiErrorMessage`. Auth codes and `invalid_request` → no reload and alert. `unavailable` → reload and alert. | AC2 |
| › "appendPage works for MyRequestDto pages" | AC2 typing |
| `src/ui/requests/request-badge.test.ts` › "newestDecidedAt: max decidedAt among isNew rows only; ignores rows with isNew false or decidedAt null; null when none" | AC3 |
| › "newestDecidedAt: compares as strings, keeps microseconds verbatim (`…12.123457Z` beats `…12.123456Z`, which `Date` would collapse to the same ms); returned value is the exact input string" | AC3, domain focus (µs instants) |
| › "newestDecidedAt with after: null when nothing is newer than after; the newer value when one is" | AC3 Load more |
| › "mergeNewIds: adds ids of isNew rows, keeps earlier ids even when a later page reports isNew false" | AC3 (New kept for the visit) |
| › "badgeText: 0 and negatives → null; 1..9 → the number; 10 and 120 → \"9+\"" | AC3 |
| `src/ui/requests/MyRequestsView.test.tsx` › "loading shows aria-busy skeleton" | AC2 |
| › "error shows apiErrorMessage as role=alert and a Try again button" | AC2 |
| › "empty shows the mine empty text" | AC2 |
| › "ready rows: seat line, status chip for every status incl. Pending, requested time (Asia/Ho_Chi_Minh), decided line for non-pending rows with Vietnamese diacritics in the decider's name kept" | AC2, domain focus (diacritics, UTC→UTC+7) |
| › "New chip only on rows whose id is in newIds; none when newIds is empty" | AC3 |
| › "Cancel only on pending rows; cancellingId disables every Cancel and labels the busy one" | AC2 |
| › "notice: status tone → role=status, error tone → role=alert" | AC2 |
| › "Load more shows only when hasMore; loadingMore disables it" | pagination |
| `src/ui/AppShellView.test.tsx` › "admin on /rooms/A1: nav landmark, 7 links, one aria-current" (updated: `["/", "/rooms", "/devices", "/members", "/requests", "/approvals", "/audit"]`) | nav entry, no regression |
| › "badge: badges={{myRequests:3}} renders 3 inside the /requests link with aria-hidden and an sr-only \"3 new decisions\"; 1 → \"1 new decision\"; 12 → visible \"9+\" and sr-only \"12 new decisions\"; 0 or no prop → no badge markup" | AC3 |
| › "badge for a nav id the tier cannot see is not rendered" (e.g. `badges={{approvals:2}}` for a user) | AC3 |
| `src/lib/nav.test.ts` › id lists: user `[dashboard, rooms, devices, members, myRequests]`; manager adds `approvals`; admin has 8 items; rail order `[dashboard, rooms, devices, members, myRequests, approvals, audit]` | AC2 nav |
| › "isActive: /requests and /requests/x are active for myRequests; /approvals and /requestsx are not" | AC2 nav |
| `src/lib/icons.test.ts` (existing, unchanged) still passes with `inbox` added in order | icon list |
| `src/ui/copy/no-literals.test.ts` (existing, unchanged) passes, so the new `.tsx` files have no literals | D36 |

`useRequestBadge`, `useMyRequests` and `MyRequestsPage` are thin hooks/containers with no jsdom test (the project has no jsdom, ticket AC4); their decisions live in the pure helpers above (`newestDecidedAt`, `mergeNewIds`, `badgeText`, `cancelOutcome`), and the local run in AC3 covers the wiring.

## Approach
1. **requests-api** (`src/ui/requests/requests-api.ts`).
   - Change `call` to `call<T>(path, init: RequestInit, read: (body: unknown, status: number) => T | null)`. The existing body (lines 23-38) stays, with `res.status` passed to `read`. `list` passes `{ method: "GET" }`.
   - `create(seatId)`: init `{ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seatId }) }` (the shape of `seats-api.ts:80-85`).
     - `read` returns `{ created: status === 201, request: body as RequestDto }` when `body` is an object with a string `id` and a string `status`. Otherwise it returns null, which maps to `internal`.
     - Use the existing `RequestCreateResult` type (`src/lib/requests/types.ts:16`).
   - `cancel(id)`: `{ method: "POST" }`. Same `RequestDto` check.
   - `mine(cursor?, limit = REQUEST_LIMITS.defaultLimit)`: `URLSearchParams` with `limit` and an optional `cursor`. `read` checks `items` is an array, `nextCursor` is a string or null, and `unseen` is a finite number.
   - `markSeen(seenUpTo: string)`: POST JSON `{ seenUpTo }` to `/api/requests/mine/seen`. `read` checks `unseen` is a finite number and `requestsSeenAt` is a string or null → `RequestsSeenResult`. The string is passed through untouched (no `Date`, no re-formatting).
   - No method throws. All of them go through the one bearer `apiFetch`.
2. **Seat button rule and outcome** (`src/ui/seats/seat-actions.ts`).
   - `request: tier === "user" && seat.occupant === null && !seat.cannotSeat`. This is an exact tier check, not `atLeastTier`, because REG-02 says "Only Users go through the approval flow" and Manager+ assign directly. An own seat (`mine`) always has an occupant, so it is excluded.
   - `requestResult(r: RequestsResult<RequestCreateResult>): ActionResult` returns `{ok:true}`, `{ok:true, duplicate:true}` or `{ok:false, code}`. The HTTP status is read only inside `requests-api`, so `actionOutcome` still decides from the result alone (its doc comment at lines 207-210 still holds).
   - `actionOutcome`:
     - The ok branch first handles `action === "request"`: `{ reload: false, closePanel: false, message: null, info: result.duplicate ? requestDuplicate : requestSent }`. The seat is unchanged, so there is no reload. The other actions keep `reload: true`.
     - The failure branch adds a `"request"` block **before** the final release fall-through (line 269):
       - `not_found` → reload, closePanel, `deleteGone`;
       - `no_linked_member` and `member_not_assignable` → `reload: false`, `apiErrorMessage(code)`;
       - anything else (`seat_taken`, `seat_cannot_seat`, `unavailable`, `internal`) → reload, `apiErrorMessage(code)`.
     - The auth codes and `invalid_request` early return (lines 216-218) already apply.
3. **useSeatActions** (`src/ui/seats/useSeatActions.ts`).
   - New prop `requestsApi: Pick<RequestsApi, "create">` (type import from `../requests/requests-api`; ui → ui, R1 holds).
   - `info` state: `setInfo(null)` where `run` clears the notice (line 74), `setInfo(outcome.info ? { seatCode, text: outcome.info } : null)` after the outcome, and the `openCode` effect (lines 60-62) also drops `info`.
   - `requestSeat: (seat) => run("request", seat.code, null, async () => requestResult(await requestsApi.create(seat.id)))`. Passing `started = null` leaves any open dialog alone, because `setDialog((d) => (d === null ? null : d))` is a no-op. Busy is held for the duration.
   - Return `info` alongside `notice`.
4. **SeatActions and SeatsPage**.
   - `SeatActions` renders the info line before the buttons as `<p role="status" className="text-sm font-semibold text-on-surface">`. Notices stay `role="alert"` with `text-error`.
   - The "Request this seat" button is `variant="tonal"` (the panel's existing style) and `disabled={busy}`.
   - `SeatsPage`:
     - creates `requestsApi` with `useMemo`;
     - passes `info={actions.info && actions.info.seatCode === openCode ? actions.info.text : null}`;
     - passes `onRequest={(s) => void actions.requestSeat(s)}`.
   - The button stays enabled after a success. The 200 duplicate response is the source of truth for "already requested" (AC1), and repeat clicks are idempotent server-side.
5. **useMyRequests** (`src/ui/requests/useMyRequests.ts`).
   - Copy `useRequests.ts` (lines 8-75) with `ListState<MyRequestDto>` and `api.mine(cursor?)`.
   - `reload` on mount. `loadMore` with the counter guard.
   - Take an optional `onPage(items: MyRequestDto[])` callback, called once per successful page (first load, reload, Load more) with that page's items, kept in a ref so it does not re-trigger effects. The seen flow (step 12) hangs off it.
   - Return `{status, items, hasMore, loadingMore, errorCode, reload, loadMore}`.
6. **Cancel flow** (`MyRequestsPage.tsx` and pure `cancelOutcome` in `requests-state.ts`).
   - `cancelOutcome(result: RequestsResult<RequestDto>): { reload: boolean; notice: { tone: "status" | "error"; text: string } }`:
     - ok and `value.status === "cancelled"` → reload, status `mine.cancelled`;
     - ok and another status (the cancel was a server no-op because a Manager decided first) → reload, status `mine.alreadyDecided(statusLabel)`;
     - `AUTH_CODES` or `invalid_request` → no reload, error `apiErrorMessage`;
     - otherwise (`not_found`, `unavailable`, `internal`) → reload, error `apiErrorMessage`.
     Use a local `AUTH_CODES` list identical to `seat-actions.ts:18`. Do not import the seats module.
   - The page holds `cancellingId: string | null` and `notice`. `onCancel(item)`:
     1. returns if `cancellingId !== null`;
     2. sets it and clears the notice;
     3. calls `await api.cancel(item.id)`;
     4. computes `cancelOutcome`;
     5. sets the notice and, if `reload`, awaits `reload()`;
     6. clears `cancellingId` (only while mounted).
   - **No confirm dialog**: see Assumption 3.
   - No tier gate on the page, because every tier has requests. A caller with no member row gets an empty page from the API and sees the calm empty text.
7. **Copy** (D36).
   - `requestsCopy.mine` gets:
     - `empty: "You have no seat requests yet. Open a room and choose an empty seat to request it."`
     - `cancel: "Cancel request"`
     - `cancelling: "Cancelling..."`
     - `cancelled: "Request cancelled."`
     - `alreadyDecided: (status) => \`This request was already ${status.toLowerCase()}.\``
     - `listLabel: "My seat requests"`
     - `newChip: "New"`
   - `seatsCopy.actions` gets:
     - `request: "Request this seat"`
     - `requestSent: "Request sent. A manager will review it."`
     - `requestDuplicate: "You already requested this seat."` (AC1 "already requested").
   - `shellCopy.badge` gets `newDecisions: (n) => (n === 1 ? "1 new decision" : \`${n} new decisions\`)` and `overflow: "9+"`.
   - The page title comes from `shellCopy.pages.myRequests.title`. Reuse `statusLabel`, `seatLine`, `requestedAt`, `decidedLine`, `retry`, `loadMore` and `loadingMore`.
8. **MyRequestsView** (pure).
   - Props: `{ state: "loading" | "error" | "ready"; items: MyRequestDto[]; newIds: ReadonlySet<string>; hasMore; loadingMore; errorCode; cancellingId: string | null; notice: { tone; text } | null; onRetry; onLoadMore; onCancel(item) }`.
   - Layout follows `ApprovalsView.tsx:55-149`. Use a `<ul aria-label={mine.listLabel}>` of Cards with `min-w-0 break-words` and `flex-wrap` rows.
   - Each row shows:
     - the seat line;
     - a status `Chip` for **every** status, including Pending (the status is the point of this page);
     - a second `Chip` with `mine.newChip` when `newIds.has(item.id)`, using `color="var(--primary-container)"` / `onColor="var(--on-primary-container)"` so it differs from the status chip (both variables exist, `globals.css:30-31`);
     - `<time>` for the requested time;
     - the decided line for non-pending rows with a `decidedAt`.
   - Pending rows get a `Button variant="tonal" size="sm" className="min-h-11"`, labelled `cancelling` when `cancellingId === item.id`, and disabled while any cancel is in flight.
   - The notice renders above the list: `role="status"` for the status tone, `role="alert" text-error` for errors.
   - The view reads `newIds`, never `item.isNew` directly, so a reload after Cancel (which returns `isNew: false` for rows already marked seen) does not drop the chip during the visit.
9. **Nav entry and bottom-bar overflow**.
   - `nav.ts` gets the `myRequests` entry after `members`. `shell.ts` gets the copy. `icons.ts` gets `inbox`.
   - Adding the entry makes 6 rail items for a Manager and 7 for an Admin. Each item is at least 64 px wide (the `w-14` pill plus `px-1`), so the bar is wider than a 360 px screen. Admin already has 6 items today. In `AppShellView.tsx`:
     - the row `div` at line 61 becomes `flex lg:flex-col gap-1.5 w-full justify-start overflow-x-auto lg:overflow-visible`. Use `justify-start`, not `justify-around`, so overflow never clips the first item;
     - the `Link` (lines 69-70) gains `flex-1 min-w-16 lg:flex-none lg:min-w-0`. On wide phones the items still share the width evenly; on narrow ones they keep 64 px and the row scrolls.
10. **Pure badge helpers** (`src/ui/requests/request-badge.ts`).
    - `newestDecidedAt(items: Pick<MyRequestDto, "isNew" | "decidedAt">[], after?: string | null): string | null` returns the greatest `decidedAt` among rows with `isNew && decidedAt !== null`, compared with plain string `>` (the server's fixed UTC µs format makes that a correct order; never `Date`-parsed, which would drop the microseconds and could leave the newest decision unseen). With `after`, it returns null unless the max is `> after`. It returns the input string verbatim.
    - `mergeNewIds(prev: ReadonlySet<string>, items): ReadonlySet<string>` returns `prev` plus the ids of `isNew` rows (returns `prev` itself when nothing is added, so React state does not churn).
    - `badgeText(n: number): string | null` → null when `n <= 0`, `String(n)` for 1-9, `shellCopy.badge.overflow` ("9+") above 9.
11. **useRequestBadge and the shared state** (`src/ui/requests/useRequestBadge.tsx`, `"use client"`).
    - `RequestBadgeProvider` holds `count` (number, starts at 0) and a `seq` ref, and exposes `{ count, set(n) }` through a context. `set` bumps `seq` before setting the count, so an older in-flight fetch can never overwrite a newer value.
    - `useRequestBadge(pathname: string): number` (used in `AppShell` under the provider):
      - `useApiFetch()` and `useMemo(createRequestsApi)`. `AppShell` is always rendered inside `ApiFetchProvider` (`AuthGate.tsx:620-622`, `DevGate.tsx:191-193`), and the `generation` key there remounts it on an org switch, so the count resets per org.
      - Skipped when `useSession()` is null.
      - `refresh()`: `const my = ++seq.current; const r = await api.mine(undefined, 1);` then, only if `my === seq.current` and still mounted and `r.ok`, set `count = r.value.unseen`. On failure it keeps the last count (no flicker, no error UI).
      - Triggers: on mount, on every `pathname` change, on `window` `focus`, and on `document` `visibilitychange` when it becomes visible. **No interval or polling** (D24, ticket out of scope). Listeners are removed on unmount.
    - `useSetRequestBadge(): (n: number) => void` returns the provider's `set` (a no-op outside the provider).
    - Race note: opening `/requests` triggers a pathname refresh that may answer before or after the page's `markSeen`. The page's `set(unseen)` bumps `seq`, so a pathname response that started earlier is discarded; a pathname response that starts later already reads the moved `requests_seen_at`. Either order ends on the post-seen count.
12. **Seen flow on My requests** (`MyRequestsPage.tsx`).
    - State `newIds` (`ReadonlySet<string>`, starts empty) and a ref `markedUpTo: string | null` (starts null).
    - `onPage(items)` passed to `useMyRequests`:
      1. `setNewIds((prev) => mergeNewIds(prev, items))`;
      2. `const upTo = newestDecidedAt(items, markedUpTo.current)`; if null, stop (**never call `markSeen` without an argument**, because `{}` means "now" on the server and would mark decisions the user has not been shown);
      3. set `markedUpTo.current = upTo` before the call (so a fast Load more does not send the same value twice);
      4. `const r = await api.markSeen(upTo)`; if ok and mounted, `setBadge(r.value.unseen)`. On failure, do nothing visible; the badge stays and the next visit retries (`markedUpTo` is per visit).
    - So the first successful load marks up to the newest shown decision; Load more marks again only when it reveals a newer one; a reload after Cancel re-runs `onPage` but the rows it gets are already seen (`isNew: false`), so no extra call.
    - If the newest decisions are not on the first page (more than 50 newer requests), the badge clears for what was shown and keeps counting the rest until Load more reveals them. This follows the approved "newest shown decidedAt" rule (Assumption 9).
13. **Badge in the shell** (`AppShellView.tsx`, `AppShell.tsx`).
    - `AppShellView` gets `badges?: Partial<Record<NavId, number>>` (type import of `NavId` from `@/lib/nav`, already imported from there). The prop is optional, so `src/app/dev/shell/page.tsx` and the existing tests need no change.
    - In the nav map, `const text = badgeText(badges?.[item.id] ?? 0)`. When `text` is not null:
      - the icon pill `span` (line 74) gains `relative`, and inside it renders `<span aria-hidden="true" className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error-container text-on-error-container border border-surface text-[10px] font-extrabold leading-[18px] text-center">{text}</span>` (`--color-error-container` and `--color-on-error-container` exist in `globals.css:154-155`);
      - the link gets `<span className="sr-only">{shellCopy.badge.newDecisions(n)}</span>` after the label, so the accessible name is e.g. "My requests 1 new decision" with the exact count even when "9+" is shown.
    - Badges render only on items the tier can already see (the map runs over `navItems`).
    - `AppShell` becomes `<RequestBadgeProvider><ShellWithBadge …/></RequestBadgeProvider>` (an inner component so `useRequestBadge` runs under the provider), passing `badges={{ myRequests: count }}`. `MyRequestsPage` is rendered as a child of `AppShell` (`src/app/(app)/layout.tsx:8`), so it is inside the provider.
14. **Rules.**
    - R1: all new code is in `src/ui/**` and `src/lib/**`. The page route imports only `@/ui`. Run `pnpm check:layers`.
    - R2: no schema change.
    - R3: no config.
    - R4: only the files listed here.
    - R5: tests as listed.
    - R6 and R7: no server change. The writes in this ticket are idempotent if `apiFetch` re-sends once on 401/403: a duplicate create returns 200 with the existing request, a cancel of a non-pending request is a 200 no-op, and `markSeen` only moves `requests_seen_at` forward (`greatest(...)`, `read.ts:149-151`).

## Specialist input used
- frontend Rec 1 (api `call(init, read)`, `create` returns a created flag from 201) — **adopted**. It reuses the existing `RequestCreateResult` type, and `read` gets the status.
- frontend Rec 2 and ux finding (explicit `"request"` branch before the release fall-through, no reload on success, reload on `seat_taken`/`seat_cannot_seat`, `not_found` closes the panel, `no_linked_member` message only) — **adopted**.
- frontend Rec 3 and ux Rec 2 (duplicate is info, not failure; a non-error `role="status"` line) — **adopted** as a separate `info` state and prop, so `routeNotice` and the page notice stay untouched.
- frontend Rec 4 and ux Q4 (no `hasPendingRequest` on `SeatDto`; the 200 duplicate is the source of truth) — **adopted**. ux's "disabled Requested state after success" — **rejected**: it adds local state that is lost on reopen anyway, and AC1 wants the duplicate message to be reachable.
- frontend Rec 5 and ux Rec 3 (My requests rows, Cancel on pending only, Load more, status Chip on every row) — **adopted**. ux's "Browse rooms" link in the empty state — **replaced** by one line of guidance text (no new link-button component).
- frontend Rec 6-8 and ux Rec 4 (seen flow with the newest shown `decidedAt` as a verbatim µs string and never an argument-less call, `useRequestBadge` on mount/route/focus without polling, the shared badge state so the page updates the badge at once, `badges` prop, 9+ cap, sr-only count, New chip kept for the visit) — **adopted** as Approach steps 10-13 (previously deferred to the declined SIM-014.5 split).
- ux Rec 5 (rail capacity at 360 px) — **adopted** as Approach step 9.
- ux Rec 6 and frontend Rec 9 (tests, no jsdom) — **adopted**.
- ux "hide the button when the session has no linked member" — **rejected**: `Session` does not carry it, so the 422 `no_linked_member` message from `copy/api.ts:34-35` is shown instead.
- Consult open questions answered from the scope sources:
  - Request button tier is `user` only, by REG-02 "Only Users go through the approval flow" and D23.
  - My requests is a flat newest-first list with no filter, by REG-02 ("lists the user's requests with their status"); the `mine` API has no filter.
  - The badge count source is `GET /api/requests/mine?limit=1` → `unseen` (no dedicated count endpoint exists and none is added; REG-02 "a badge counts requests decided since the user last opened it").

## Assumptions
1. **"Request this seat" shows for the exact tier `user` only** (REG-02, D23, ticket "Users only"). The server accepts every tier (SIM-014 plan, Assumption 1). Hiding the button from Manager and Admin is UX only, since they assign directly.
2. **My requests is visible to every tier** (`minTier: "user"`), because a Manager or Admin can also hold requests created through the API. It sits right after Members in the rail. The badge therefore also shows for every tier (it is 0 for callers with no decided requests). *Approved default.*
3. **Cancel has no confirm dialog.** It is low-risk and reversible (the user can request again), and the button shows a busy state. *Approved default.*
4. **The icon is `inbox`** (a Material Symbols name). It is added to `ICON_NAMES`, which also changes the font subset URL.
5. **There is no "View my requests" link in the seat panel after a request** (ux Q6). Left as a follow-up.
6. **Hotspots:**
   - `src/ui/requests/requests-api.ts` and `src/ui/copy/requests.ts` are also extended by **SIM-014.4** (BACKLOG; `approve`/`reject`). That ticket should build on the `call(path, init, read)` shape introduced here, so expect a rebase if both run in parallel.
   - No other open ticket (IN_PROGRESS, REVIEW or DONE) edits these files.
7. **Size:** about 650 source lines plus tests, over the ~400-line guide. Ming declined the split (ticket Notes, 2026-11-24), so the reviewer should expect one larger diff.
8. **The badge refreshes only on mount, route change, focus and visibility** (ticket scope bullet 3, D24 no polling). A decision made while the user stays on one page with the tab focused appears at the next navigation or focus.
9. **Mark-seen marks only what was shown** (approved default from the split proposal): the newest `decidedAt` among `isNew` rows on loaded pages. A decided request older than the first page keeps counting until Load more shows it. In normal use (fewer than 50 requests per person) opening the page clears the badge completely.
10. **The "New" chip stays for the whole visit** (until the page unmounts), even after a reload after Cancel; it is gone on the next visit because the server then reports `isNew: false`.
11. **Follow-ups** (not in this ticket, R4):
    - `hasPendingRequest` on `SeatDto`, a server change already listed by SIM-014 for the LAY-06 marker;
    - "View my requests" link after a request;
    - a design pass on the mobile bottom bar for many items (a "More" menu instead of a scrollable bar) if Ming dislikes the scroll.

## Blocking questions
None.

## Split proposal
None. Ming declined the split on 2026-11-24 ("k tách"); this plan covers the whole ticket, and no SIM-014.5 is filed.
