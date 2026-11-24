Status: READY

# Plan — SIM-014.3: Request a seat, My requests and nav badge (slice A: Request this seat + My requests with Cancel)

This ticket is about 650 source lines across all three bullets, before tests (estimate under `## Split proposal`). That
is well over one implement/review cycle. This plan covers **slice A only**:
- "Request this seat" in the seat panel.
- The `/requests` page (My requests) with Cancel.
- The `myRequests` nav entry.

The "New" markers, the mark-seen call and the nav badge (ticket AC3) move to **SIM-014.5**. See `## Split proposal`.

## Scope summary
- spec REG-01 (`docs/spec-v1.md:371-375`): "**REG-01 Request a seat** (any signed-in user with a linked member) —
  From the detail of an empty seat, a user requests it, and a pending request is created. — A second identical pending
  request (same seat and member) creates nothing new. — A request for an occupied seat is refused. — A User may
  request a seat in any room of the org (D21), for themselves only (D23)."
- spec REG-02 (`docs/spec-v1.md:382-385`): "Manager+ assign directly without a request (SEA-03). Only Users go through
  the approval flow. — The requester can cancel their own pending request (D24). — "My requests" lists the user's
  requests with their status; a badge counts requests decided since the user last opened it. No email (D24)." (The
  badge sentence goes to SIM-014.5.)
- D21 "Users may request a seat in any room of the org."
- D23 "Users request seats only for themselves; Managers assign others directly."
- D24 "Requesters can cancel pending requests; decisions show in-app ("Yêu cầu của tôi" with a badge), no email."
- D26 "Keep the per-seat "không xếp chỗ" flag with a reason; it blocks assignment and requests."
- D36 "UI copy is English by default; all user-facing text lives in copy files."
- Ticket scope bullets 1 and 2. Bullet 3 (badge) goes to SIM-014.5.
- Contracts used unchanged (SIM-014 and SIM-014.1, merged):
  - `POST /api/requests {seatId}`, tier `user`. It returns 201 when it creates a request and 200 with the existing pending request on a duplicate (`src/app/api/requests/route.ts:22-25`).
  - `POST /api/requests/[id]/cancel`. It returns 200 with the DTO. A request that is no longer pending also returns 200, as a no-op with its current status. Another member's id or an unknown id returns 404 `not_found` (`src/server/requests/requests.ts:280-294`).
  - `GET /api/requests/mine?cursor&limit` returns `MyRequestsPage` (`src/lib/requests/types.ts:28-29`).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A User sees "Request this seat" on an empty seat that can be seated. A duplicate request shows "already requested". (ticket AC1) | `seat-actions.test.ts` › "seatButtons.request: user only, empty, not cannot-seat" (table), › "requestResult maps created/duplicate/failure", › "actionOutcome request: sent and duplicate are info notices without reload". `SeatActions.test.tsx` › "user sees Request this seat on an empty seat", › "info notice renders as role=status, not alert". Local run (`pnpm dev`, User token): open an empty seat, click it, see "Request sent…". Click again and see "You already requested this seat." |
| 2 | My requests lists the caller's requests with their status, and Cancel works on pending ones. (ticket AC2) | `MyRequestsView.test.tsx` (loading, error, empty, rows with a status chip, Cancel on pending rows only, busy disables Cancel, notice roles). `requests-state.test.ts` › `cancelOutcome` table. `requests-api.test.ts` › create, cancel and mine cases. Local run: `/requests` lists the request, Cancel turns it into "Cancelled", and the nav shows "My requests" active. |
| 3 | The nav badge shows the number of newly decided requests and clears after My requests is opened. (ticket AC3) | **Moved to SIM-014.5** (see `## Split proposal`). Not verified in this slice. |
| 4 | Static-render and pure-logic tests (no jsdom) cover the button rules and the page. (ticket AC4, minus the badge, which goes to SIM-014.5) | The tests listed in `## Tests to write` exist and pass. Run `pnpm test`, `pnpm typecheck && pnpm check:layers`, `pnpm format:check` and `pnpm build`. No test imports jsdom. |

## Ming verification after merge
- Sign in for real (Identity, `pnpm dev:token` or a hosted build) as a **User** with a linked member. Request an empty seat, then:
  - see it in My requests;
  - cancel it;
  - request it again;
  - have a Manager approve it through the API (the Approve dialog arrives in SIM-014.4) and see the status "Approved" with the "decided by" line.
- At about 360 px width as a Manager (6 rail items) and as an Admin (7 rail items), check that the bottom bar scrolls horizontally, that no item is cut off at the left, and that "My requests" can be reached.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/requests/requests-api.ts` | Change `call` (lines 19-39) to `call(path, init, read)`. `read` gets `(body, status)`, so `create` can tell 201 from 200. Keep `list` working as it does now. Add `create(seatId)` (POST JSON `{seatId}` → `RequestCreateResult`, `created = status === 201`, body must have string `id` and `status`). Add `cancel(id)` (POST `/api/requests/${encodeURIComponent(id)}/cancel`, no body → `RequestDto`). Add `mine(cursor?)` (GET `/api/requests/mine?limit=50[&cursor]` → `MyRequestsPage`, which needs an `items` array, `nextCursor` as a string or null, and `unseen` as a number). | AC1, AC2 | no |
| `src/ui/requests/requests-api.test.ts` | Add create, cancel and mine cases in the style of the existing `list` cases (lines 17-41). | AC1, AC2, AC4 | no |
| `src/ui/requests/requests-state.ts` | Make `ListState` (lines 11-17) and `appendPage` (lines 42-52) generic: `ListState<T = RequestListItemDto>`, `appendPage<T>`. These are type-only changes and Approvals is unaffected. Add pure `cancelOutcome(result)` (see Approach step 6). | AC2 | no |
| `src/ui/requests/requests-state.test.ts` | Add a `cancelOutcome` table and one `appendPage` case with `MyRequestDto`. | AC2, AC4 | no |
| `src/ui/requests/useMyRequests.ts` | New. A sibling of `useRequests.ts` (same counter and `mounted` guards and the same `reload`/`loadMore` shape) that calls `api.mine(cursor?)`. | AC2 | no |
| `src/ui/requests/MyRequestsView.tsx` | New. The pure page body, modelled on `ApprovalsView.tsx:55-149`. | AC2 | no |
| `src/ui/requests/MyRequestsView.test.tsx` | New. Static render tests with `renderToStaticMarkup`, as in `ApprovalsView.test.tsx`. | AC2, AC4 | no |
| `src/ui/requests/MyRequestsPage.tsx` | New. A client container: `useApiFetch`, `useMemo(createRequestsApi)`, `useMyRequests`, cancel flow with `cancellingId` and a notice. | AC2 | no |
| `src/app/(app)/requests/page.tsx` | New. `import { MyRequestsPage } from "@/ui"` (the same shape as `src/app/(app)/approvals/page.tsx`). | AC2 | no |
| `src/ui/index.ts` | Export `MyRequestsPage`, next to line 26. | route import via `@/ui` | no |
| `src/ui/copy/requests.ts` | Add a `mine` section (strings listed in Approach step 7). | D36 | no |
| `src/ui/seats/seat-actions.ts` | Add `"request"` to `SeatAction` (lines 8-15). Change `ActionResult` (line 16) to `{ ok: true; duplicate?: true } \| { ok: false; code }`. Add `request: boolean` to `SeatButtons` and `seatButtons` (lines 43-64). Add `info?: string` to `Outcome` (lines 199-205). Add an explicit `"request"` branch in `actionOutcome` (lines 211-274) for both success and failure. Add pure `requestResult(r)`. | AC1 | no |
| `src/ui/seats/seat-actions.test.ts` | Add a `request` button table, `requestResult` cases and `actionOutcome("request", …)` cases. | AC1, AC4 | no |
| `src/ui/seats/useSeatActions.ts` | Take `requestsApi: Pick<RequestsApi, "create">`. Add `info` state (`{ seatCode, text } \| null`), set from `outcome.info` in `run` (lines 64-86) and cleared with the notice. Clear it when `openCode` changes (lines 60-62). Add `requestSeat(seat)`. | AC1 | no |
| `src/ui/seats/SeatActions.tsx` | Add props `info: string \| null` and `onRequest`. Render the info line as `role="status"` with a non-error colour. Add `buttons.request` to the "any button" chain (lines 41-46). Add the "Request this seat" button, disabled while `busy`. | AC1 | no |
| `src/ui/seats/SeatActions.test.tsx` | Update the `render` helper (lines 24-38) with the new props. Add tests for the request button and the info line. | AC1, AC4 | no |
| `src/ui/seats/SeatsPage.tsx` | Create `requestsApi` with `useMemo(() => createRequestsApi(apiFetch))` and pass it to `useSeatActions` (line 95). Pass `info` (only when `actions.info?.seatCode === openCode`) and `onRequest={(s) => void actions.requestSeat(s)}` to `<SeatActions>` (lines 198-209). | AC1 | no |
| `src/ui/copy/seats.ts` | Add `actions.request`, `requestSent` and `requestDuplicate` (in the `actions` block, lines 36+). | D36 | no |
| `src/lib/nav.ts` | Add `"myRequests"` to `NavId` (lines 4-11). Add `{ id: "myRequests", href: "/requests", icon: "inbox", minTier: "user", placement: "rail" }` right after `members` (line 26). | AC2 (nav entry, ticket scope) | no |
| `src/lib/nav.test.ts` | Update the id lists and the rail-order test (lines 7-33). Add `isActive` cases for `/requests`. | AC4 | no |
| `src/lib/icons.ts` | Add `"inbox"` to `ICON_NAMES` in alphabetical order, between `history` and `lan` (lines 16-17). | `Icon` only accepts listed names | no |
| `src/ui/copy/shell.ts` | Add `nav.myRequests: "My requests"` (lines 9-17; `satisfies Record<NavId,string>` forces it). Add `pages.myRequests: { title: "My requests", empty: "You have no seat requests yet." }` (lines 35-44). | D36 | no |
| `src/ui/AppShellView.tsx` | Bottom bar overflow only: the rail row `div` (line 61) and the `Link` class (lines 69-70). See Approach step 9. No other change. | The 6th and 7th rail items would be clipped at 360 px | no |

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
| › "mine: GET /api/requests/mine?limit=50, cursor appended and encoded; missing unseen or items not an array → internal" | AC2 |
| › existing `list` tests unchanged and green (refactored `call`) | no regression |
| `src/ui/requests/requests-state.test.ts` › "cancelOutcome": ok with status `cancelled` → reload and `cancelled` text (status tone). Ok with `approved` or `rejected` → reload and `alreadyDecided` text. `not_found` → reload and `apiErrorMessage`. Auth codes and `invalid_request` → no reload and alert. `unavailable` → reload and alert. | AC2 |
| › "appendPage works for MyRequestDto pages" | AC2 typing |
| `src/ui/requests/MyRequestsView.test.tsx` › "loading shows aria-busy skeleton" | AC2 |
| › "error shows apiErrorMessage as role=alert and a Try again button" | AC2 |
| › "empty shows the mine empty text" | AC2 |
| › "ready rows: seat line, status chip for every status incl. Pending, requested time (Asia/Ho_Chi_Minh), decided line for non-pending rows with Vietnamese diacritics in the decider's name kept" | AC2, domain focus (diacritics, UTC→UTC+7) |
| › "Cancel only on pending rows; cancellingId disables every Cancel and labels the busy one" | AC2 |
| › "notice: status tone → role=status, error tone → role=alert" | AC2 |
| › "Load more shows only when hasMore; loadingMore disables it" | pagination |
| `src/lib/nav.test.ts` › id lists: user `[dashboard, rooms, devices, members, myRequests]`; manager adds `approvals`; admin has 8 items; rail order `[dashboard, rooms, devices, members, myRequests, approvals, audit]` | AC2 nav |
| › "isActive: /requests and /requests/x are active for myRequests; /approvals and /requestsx are not" | AC2 nav |
| `src/lib/icons.test.ts` (existing, unchanged) still passes with `inbox` added in order | icon list |
| `src/ui/copy/no-literals.test.ts` (existing, unchanged) passes, so the new `.tsx` files have no literals | D36 |

## Approach
1. **requests-api** (`src/ui/requests/requests-api.ts`).
   - Change `call` to `call<T>(path, init: RequestInit, read: (body: unknown, status: number) => T | null)`. The existing body (lines 23-38) stays, with `res.status` passed to `read`. `list` passes `{ method: "GET" }`.
   - `create(seatId)`: init `{ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seatId }) }` (the shape of `seats-api.ts:80-85`).
     - `read` returns `{ created: status === 201, request: body as RequestDto }` when `body` is an object with a string `id` and a string `status`. Otherwise it returns null, which maps to `internal`.
     - Use the existing `RequestCreateResult` type (`src/lib/requests/types.ts:16`).
   - `cancel(id)`: `{ method: "POST" }`. Same `RequestDto` check.
   - `mine(cursor?)`: `URLSearchParams` with `limit = REQUEST_LIMITS.defaultLimit` and an optional `cursor`. `read` checks `items` is an array, `nextCursor` is a string or null, and `unseen` is a finite number.
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
   - `seatsCopy.actions` gets:
     - `request: "Request this seat"`
     - `requestSent: "Request sent. A manager will review it."`
     - `requestDuplicate: "You already requested this seat."` (AC1 "already requested").
   - The page title comes from `shellCopy.pages.myRequests.title`. Reuse `statusLabel`, `seatLine`, `requestedAt`, `decidedLine`, `retry`, `loadMore` and `loadingMore`.
8. **MyRequestsView** (pure).
   - Props: `{ state: "loading" | "error" | "ready"; items: MyRequestDto[]; hasMore; loadingMore; errorCode; cancellingId: string | null; notice: { tone; text } | null; onRetry; onLoadMore; onCancel(item) }`.
   - Layout follows `ApprovalsView.tsx:55-149`. Use a `<ul aria-label={mine.listLabel}>` of Cards with `min-w-0 break-words` and `flex-wrap` rows.
   - Each row shows:
     - the seat line;
     - a status `Chip` for **every** status, including Pending (the status is the point of this page);
     - `<time>` for the requested time;
     - the decided line for non-pending rows with a `decidedAt`.
   - Pending rows get a `Button variant="tonal" size="sm" className="min-h-11"`, labelled `cancelling` when `cancellingId === item.id`, and disabled while any cancel is in flight.
   - The notice renders above the list: `role="status"` for the status tone, `role="alert" text-error` for errors.
   - `isNew` is **not** rendered in this slice (SIM-014.5).
9. **Nav entry and bottom-bar overflow**.
   - `nav.ts` gets the `myRequests` entry after `members`. `shell.ts` gets the copy. `icons.ts` gets `inbox`.
   - Adding the entry makes 6 rail items for a Manager and 7 for an Admin. Each item is at least 64 px wide (the `w-14` pill plus `px-1`), so the bar is wider than a 360 px screen. Admin already has 6 items today. In `AppShellView.tsx`:
     - the row `div` at line 61 becomes `flex lg:flex-col gap-1.5 w-full justify-start overflow-x-auto lg:overflow-visible`. Use `justify-start`, not `justify-around`, so overflow never clips the first item;
     - the `Link` (lines 69-70) gains `flex-1 min-w-16 lg:flex-none lg:min-w-0`. On wide phones the items still share the width evenly; on narrow ones they keep 64 px and the row scrolls.
   - No badge markup in this slice.
10. **Rules.**
    - R1: all new code is in `src/ui/**` and `src/lib/**`. The page route imports only `@/ui`. Run `pnpm check:layers`.
    - R2: no schema change.
    - R3: no config.
    - R4: only the files listed here.
    - R5: tests as listed.
    - R6 and R7: no server change. The writes in this slice are idempotent if `apiFetch` re-sends once on 401/403: a duplicate create returns 200 with the existing request, and a cancel of a non-pending request is a 200 no-op.

## Specialist input used
- frontend Rec 1 (api `call(init, read)`, `create` returns a created flag from 201) — **adopted**. It reuses the existing `RequestCreateResult` type, and `read` gets the status.
- frontend Rec 2 and ux finding (explicit `"request"` branch before the release fall-through, no reload on success, reload on `seat_taken`/`seat_cannot_seat`, `not_found` closes the panel, `no_linked_member` message only) — **adopted**.
- frontend Rec 3 and ux Rec 2 (duplicate is info, not failure; a non-error `role="status"` line) — **adopted** as a separate `info` state and prop, so `routeNotice` and the page notice stay untouched.
- frontend Rec 4 and ux Q4 (no `hasPendingRequest` on `SeatDto`; the 200 duplicate is the source of truth) — **adopted**. ux's "disabled Requested state after success" — **rejected**: it adds local state that is lost on reopen anyway, and AC1 wants the duplicate message to be reachable.
- frontend Rec 5 and ux Rec 3 (My requests rows, Cancel on pending only, Load more, status Chip on every row) — **adopted**. ux's "Browse rooms" link in the empty state — **replaced** by one line of guidance text (no new link-button component).
- frontend Rec 6-8 and ux Rec 4 (seen flow, `useRequestBadge`, `badges` prop, 9+ cap, sr-only count) — **deferred** to SIM-014.5 with the recommendations carried over.
- ux Rec 5 (rail capacity at 360 px) — **adopted** as Approach step 9.
- ux Rec 6 and frontend Rec 9 (tests, no jsdom) — **adopted** for the parts in this slice.
- ux "hide the button when the session has no linked member" — **rejected**: `Session` does not carry it, so the 422 `no_linked_member` message from `copy/api.ts:34-35` is shown instead.
- Consult open questions answered from the scope sources:
  - Request button tier is `user` only, by REG-02 "Only Users go through the approval flow" and D23.
  - My requests is a flat newest-first list with no filter, by REG-02 ("lists the user's requests with their status"); the `mine` API has no filter.
  - The badge endpoint question goes to SIM-014.5.

## Assumptions
1. **"Request this seat" shows for the exact tier `user` only** (REG-02, D23, ticket "Users only"). The server accepts every tier (SIM-014 plan, Assumption 1). Hiding the button from Manager and Admin is UX only, since they assign directly.
2. **My requests is visible to every tier** (`minTier: "user"`), because a Manager or Admin can also hold requests created through the API. It sits right after Members in the rail. *Default for Ming: keep it.*
3. **Cancel has no confirm dialog.** The spec and the decisions are silent. It is low-risk and reversible (the user can request again), and the button shows a busy state. *Default for Ming: no confirm. A confirm would reuse `ConfirmSeatDialog`, at about 30 lines.*
4. **The icon is `inbox`** (a Material Symbols name). It is added to `ICON_NAMES`, which also changes the font subset URL.
5. **There is no "View my requests" link in the seat panel after a request** (ux Q6). This is an optional nicety, left as a follow-up.
6. **Hotspots:**
   - `src/ui/requests/requests-api.ts` and `src/ui/copy/requests.ts` are also extended by **SIM-014.4** (BACKLOG; `approve`/`reject`). That ticket should build on the `call(path, init, read)` shape introduced here, so expect a rebase if both run in parallel.
   - `src/ui/AppShellView.tsx`, `src/ui/requests/MyRequestsPage.tsx` and `requests-api.ts` are extended again by SIM-014.5, which runs after this slice.
   - No other open ticket (IN_PROGRESS, REVIEW or DONE) edits these files.
7. **Size:** about 430 source lines plus tests. This is slightly over the guide, but it is the smallest slice that gives a User the whole request → follow → cancel flow.
8. **Follow-ups** (not in this slice, R4):
   - `hasPendingRequest` on `SeatDto`, a server change already listed by SIM-014 for the LAY-06 marker;
   - "View my requests" link after a request;
   - a design pass on the mobile bottom bar for many items (a "More" menu instead of a scrollable bar) if Ming dislikes the scroll.

## Blocking questions
None.

## Split proposal
Estimated source lines for the whole ticket (without tests):
- api: about 70
- seat panel (`seat-actions`, `SeatActions`, `useSeatActions`, `SeatsPage`): about 85
- My requests (hook, view, page, route): about 230
- nav, copy and shell: about 45
- badge (`markSeen`, `useRequestBadge`, context, `AppShellView` badges, `AppShell`, seen flow on the page, "New" chip): about 220

That totals about 650 lines.

| Slice | Title | Contents | Areas | Depends on |
|---|---|---|---|---|
| **SIM-014.3 (this plan)** | Request a seat and My requests | "Request this seat" (User only, duplicate → "already requested"), the `/requests` page with Cancel and Load more, the `myRequests` nav entry, and the bottom-bar overflow fix. Ticket AC1, AC2 and the matching part of AC4. | ui, ux | SIM-014.1 |
| **SIM-014.5** (new) | My requests: New markers, mark seen and nav badge | `requests-api.markSeen(seenUpTo?)`. A "New" chip on `isNew` rows, kept for the visit. After the first successful load, call `markSeen` with the newest `decidedAt` among the `isNew` rows, compared as verbatim µs strings and never `Date`-parsed; never call it without an argument; mark again only when Load more reveals a newer one. `useRequestBadge` in `AppShell`: `mine` with `limit=1` on mount, on pathname change and on window focus/visibility; no polling (D24); stale-response counter; keeps the last count on failure; skipped without a session. A small context so `MyRequestsPage` sets the badge from the seen response at once, with no race against the pathname fetch. `AppShellView` gets `badges?: Partial<Record<NavId, number>>` (hidden at 0, "9+" cap, visible numeral `aria-hidden`, sr-only "N new decisions" in the link). Tests: max-`decidedAt` helper, badge text, static render of the shell badge and the New chip. Ticket AC3 and the badge part of AC4. | ui, ux | SIM-014.3 |
