SIM-014 consult (frontend/UI). Read-only.

## Findings
- The schema is already in `db/migrations/20261120150000_init.sql`. `seat_requests` has: status in pending/approved/rejected/cancelled, `subject_id`, `created_by_id`, `decided_by_id`, `decided_at` and a `decided_check`. It has a partial unique index `(org_id, seat_id, subject_id) where status='pending'`, so the dedupe can use `insert ... on conflict do nothing`. The FK to seats is `on delete cascade`. `members.requests_seen_at timestamptz null` also exists, so the "last opened My requests" marker needs no migration (R2). Whether a note field is used is open (see Open questions).
- Seat writes already follow a pattern, which SIM-014 should copy:
  - `src/server/seats/seats.ts` has `inTx`, `orgQuery`, `lockSeat`/`lockSeatIn`, `demotePrimary` (DEV-06), `writeAudit`, and `refuse(status, code)`/`Abort`.
  - Pure decisions live in `src/lib/seats/rules.ts` (`decideOccupantChange`, `decideRelease`) with tests.
  - Routes use `withAuth(handler, { tier })` from `@/server/http/with-auth`.
  - `setOccupant` locks the member row first (`for share`), then the room, then the seat. Approve must keep the same lock order.
- Client side:
  - `src/ui/seats/seats-api.ts` has `createSeatsApi(fetcher)`. Every method returns `{ok:true,value}|{ok:false,code}` and never throws. It uses `ApiAccessError` and validates the response shape. `useApiFetch()` provides the fetcher, and pages memoize the api with `useMemo`.
  - `seat-actions.ts` holds the pure logic: `seatButtons(tier, seat)`, `actionOutcome(action, result)` (code-driven, never HTTP status), and AUTH_CODES. `useSeatActions.ts` holds dialog, busy and notice state, with a `busyRef` re-entry guard. `SeatActions.tsx` is a props-only button row. `SeatsPage.tsx` wires the pieces together and maps dialog kinds to a `ConfirmSeatDialog` config (title, body, submitLabel).
  - `SeatDto` has `mine`, `occupant`, `cannotSeat` and `status`. It has no field for "I have a pending request on this seat".
- Nav: `src/lib/nav.ts` already lists `approvals` (minTier manager, `placement: "rail"`, icon `fact_check`). The `/approvals` page is a `PageSkeleton` stub. `AppShellView.tsx` renders nav items as `<Link>` with an icon in a `w-14 h-8` pill, and the label is `shellCopy.nav[item.id]`. `src/ui/copy/shell.ts` has `pages.approvals`. There is no "My requests" nav entry or page. `/members` is in nav but I saw no page for it.
- `Session` (`src/lib/session.ts`) is `{tier, email, orgName?, devToken?}`. It has no member id.
- List and filter reference: `src/ui/audit/` is the model, with `audit-api.ts`, `audit-state.ts` (pure), `useAudit.ts` (stale-response counter, `reload`, `loadMore` with cursor) and `AuditView.tsx`. It has its own `AuditView.test.tsx`.
- Tests: `vitest.config.ts` uses `environment: "node"`, includes `src/**/*.test.{ts,tsx}`, and has no jsdom. UI tests either render with `renderToStaticMarkup` (`SeatActions.test.tsx`, `AuditView.test.tsx`) or test pure `*.ts` modules. `src/ui/copy/no-literals.test.ts` enforces D36, so all strings go in `src/ui/copy/<feature>.ts`. There are also `src/app/api/routes-guarded.test.ts` (new routes probably must be registered or guarded there) and `*.db.test.ts` files for DB integration.

## Recommendations
**Layout and state machine (acceptance criterion 5)**
- Put the state machine in `src/lib/requests/rules.ts` as pure code with tests. The decisions are:
  - `decideCreate({seatOccupied, cannotSeat, actorIsSubject, existingPending})` returns `create | noop_duplicate | refuse_occupied | refuse_cannot_seat`.
  - `decideDecision({status, action})` returns `apply` or `noop` when the status is not pending.
  - `decideCancel({status, actorMemberId, createdById/subjectId})` returns `cancel | refuse | noop`.
- Server: `src/server/requests/requests.ts` (`import "server-only"`) with `createRequest`, `listRequests`, `listMyRequests`, `approve`, `reject`, `cancel` and `markSeen`.
- Routes under `src/app/api/requests/**`: `GET/POST /api/requests`, `GET /api/requests/mine`, `POST /api/requests/[id]/approve|reject|cancel`, `POST /api/requests/mine/seen`, and `GET /api/requests/mine/unread` (or a count inside `mine`).
- Auth: R7 auth codes come only from the `withAuth` tier gate. Use tier `user` for create, mine and cancel, and tier `manager` for list, approve and reject. Cancel must scope the row to the caller's member id, and anything else refuses with 409/422 (not 403 after a read). Domain refusals are `seat_occupied`, `seat_cannot_seat`, `not_allowed`, `request_not_found`, plus `member_required` (no linked member). I could not see the existing code list, so confirm it in `ui/copy/api.ts` and add the new codes there.
- Approve transaction, in this order: lock the subject member row, then the seat via the lock helpers. Re-check that the seat is empty and not cannot-seat and that the request is pending. Then `demotePrimary`, set `seats.occupant_id` and inherit the group (reuse `inheritedGroup`), mark this request approved with `decided_by_id`/`decided_at`, and reject the other pending requests for that seat (`update ... where seat_id=$ and status='pending' and id<>$`). Write audit rows. Prefer reusing the `setOccupant` internals over duplicating them.
- What approve should do when the seat is now occupied is an open question (see below).

**"Request this seat" placement**
- Put it in the seat detail panel (`SeatActions`), as one more entry in `seatButtons(tier, seat)`: `requestSeat: seat.status==="empty" && !seat.cannotSeat` for a signed-in user.
- Spec says "any signed-in user with a linked member" and Manager+ assign directly (SEA-03). So show it to every tier when the seat is empty (so Managers can see it as well), or Users only. Pick one and test it. I would show it to Users only, because Managers already have Assign.
- Add `"request"` and `"cancelRequest"` to `SeatAction`, a `requestSeat` method on a new `requests-api`, and a `kind: "request"` entry in `SeatDialog`. Use a confirm dialog through the existing `ConfirmSeatDialog` branch in `SeatsPage`, with copy in `src/ui/copy/requests.ts`. The plain API (`createRequestsApi`) should mirror the `seats-api` result shape.
- Add `myRequest: {id, status} | null` or `hasPendingRequest: boolean` to `SeatDto`, computed in `seatRows`, so the panel can show "Request pending" with a Cancel button and the Request button is disabled. That is a server change in the seats query, so scope it in the plan. The fallback is to rely on the server `noop_duplicate` response and show "already requested". For the first version the fallback is simpler: the create endpoint returns 200 with `{created:false}`, and the UI shows "You already requested this seat".
- `actionOutcome` gets new branches: `seat_occupied`, `seat_cannot_seat` and `not_found` reload and show a message; auth codes and `invalid_request` do not reload.

**Approvals page** (`src/app/(app)/approvals/page.tsx`, `src/ui/requests/*`)
- Copy `src/ui/audit/`: `requests-api.ts`, pure `requests-state.ts`, `useRequests.ts` (stale counter and cursor `loadMore`), and `ApprovalsView.tsx` taking props so it can be rendered with `renderToStaticMarkup`.
- Filter by status with a native `<select>` or a radio/segmented chip group (`Chip` exists), values `pending` (default) / `approved` / `rejected` / `cancelled` / `all`. Keep the filter in a `?status=` URL param, parsed by a pure validator in `src/lib/validate/requests-query.ts`, like `audit-query`.
- Each row shows seat code and room, requester, created, and status. Pending rows get Approve and Reject buttons. Approve and reject go through a confirm dialog (approving shows who is currently the occupant, and how many rival requests will be rejected, if the list API returns a rival count).
- A decision busy flag per row disables only that row's buttons. After any action, reload the list. A non-pending response (`noop`) reloads silently with a notice.
- Keep Approvals out of the nav pill for Users. `minTier: "manager"` already does that.

**My requests**
- Add a nav entry `myRequests` (`/requests`, min tier `user`, rail) in `src/lib/nav.ts`, plus `shellCopy.nav` and an icon check (`src/lib/icons.ts` plus `icons.test.ts`; there may be a fixed icon whitelist). The page path `/requests` needs its own `(app)/requests/page.tsx`. Alternative: a "My requests" tab on the same page. A separate page is simpler and does not touch the manager-only route.
- List: status chip, seat, room, created/decided date, and Cancel on pending rows (cancel confirm dialog).
- The badge counts requests where `status` in (approved, rejected) and `decided_at > coalesce(requests_seen_at, 'epoch')` for the caller's member. Cancelled (by self) is excluded. Opening the page calls `POST /api/requests/mine/seen`, which sets `requests_seen_at = now()`.
- Badge in the shell: add an optional `badges?: Partial<Record<NavId, number>>` prop to `AppShellView` (pure, props-driven, so it renders in the existing `AppShellView.test.tsx` style), and a `useRequestBadge()` hook in the container that GETs the count on mount and when the route changes (and on window focus). Clear the badge immediately after the page marks seen. Render it as a small pill at the icon corner with an `aria-label`/`sr-only` text such as "3 newly decided" so it is not only a colour cue. Both mobile bottom bar and desktop rail share the same `<Link>` markup, so one change covers both.

**Data fetching**
- No cache layer exists; use the `useApiFetch` + `createXApi` + hook pattern. No polling (D24). Fetch on mount, on focus and after writes. `mounted`/counter guards for stale responses, as `useAudit` does.

**Testability (node env, no jsdom)**
- Unit tests for `lib/requests/rules.ts`, `seat-actions.ts` additions (`seatButtons`, `actionOutcome`), `requests-state.ts` (filter, badge count), `requests-api.ts` (fetch stub, result mapping), and `renderToStaticMarkup` tests for `ApprovalsView`, `MyRequestsView` and `SeatActions` with the new button. Add DB integration tests (`requests.db.test.ts`) for the transaction: two rival requests, approve one, check the other is rejected and the primary device demoted, in the same style as `seats.db.test.ts`. Add route tests like `seats-routes.test.ts` (auth wrapper first, no side effect on 403 paths). Update `routes-guarded.test.ts` for new routes. Strings go in `src/ui/copy/requests.ts` (D36), and `no-literals.test.ts` must stay green.

## Risks
- Approve while the seat state changed: an occupied seat or a seat set to cannot-seat after the request was filed. Without an explicit rule, approving could replace an occupant silently (a Manager's approval is not the same as "Replace", D18). I recommend refusing with `seat_occupied` / `seat_cannot_seat`, leaving the request pending, and letting the Manager reject it or free the seat.
- Deadlock or race: approve takes member, seat and request locks. A simultaneous `setOccupant` locks member then room then seat. Use the same order and lock request rows after the seat. Test two concurrent approvals of rival requests (the second must find the seat occupied or the request rejected).
- Subject member deactivated between request and approval: `member_not_assignable` (422), as in setOccupant.
- Cancel and approve racing: whichever commits first wins; the other must be a no-op or refuse with no error side effect, with the response saying the current status.
- `apiFetch` re-sends once on 401/403 (R7): all auth refusals must come from `withAuth` before any write. Do not do the "member linked?" check after a write. A caller with no linked member needs a domain code (422), not 403.
- Badge semantics: a request decided while the user is on the page, or `requests_seen_at` being null for an existing member, would show every old decided request as unread on first release. Because the column is null for everyone, treat null as "nothing unread" for existing rows (for example, lazily set to `now()` on first call) or the first badge will be noisy. Needs a decision.
- Adding fields to `SeatDto` ripples through `seats.ts`, tests and the room list query (500 seats). Per-seat pending-request lookups in the list query could be slow; keep it to the detail query only.
- A seat delete cascades requests (ROO-01), so My requests can lose rows silently. Acceptable per schema comment, but the badge count must not break on it.
- Notes/free text: `note` column exists. If used, it must be validated and length-limited (a validator in `src/lib/validate/`). Not requested by ticket, so leave out.

## Open questions
1. Approve against an occupied or cannot-seat seat: refuse (recommended) or replace like Assign? Spec REG-02 says "seats the subject" only.
2. Is "Request this seat" shown to Manager+ too, or Users only? Spec REG-01 says any signed-in user with a linked member; SEA-03 says Manager+ assign directly.
3. A user with no linked member (REG-01 says "with a linked member"): which code and message? Is the member row always created at sign-in (`/api/me`)? I did not confirm this.
4. Does "pending" for a seat that is occupied later stay pending, or does assigning a seat directly (SEA-03) also reject pending requests? Spec REG-02 only covers approve, but the same rival logic should probably run on direct assign for consistency. Out of this ticket's stated scope unless Ming says otherwise.
5. Badge initial value for existing members (null `requests_seen_at`). See Risks.
6. Add `hasPendingRequest` to the seat detail DTO now, or ship the "already requested" response only?
7. `/requests` as a separate nav item, or fold My requests into the Approvals nav for Users (so Users would see an "Approvals" entry too)? Recommend a separate page.
8. Manager approving or rejecting their own request: allowed? (Managers can assign directly, so a self-request is pointless but harmless.)

Key files: d:\project\simap-game-ui\work\tickets\SIM-014\ticket.md, d:\project\simap-game-ui\db\migrations\20261120150000_init.sql, d:\project\simap-game-ui\src\server\seats\seats.ts, d:\project\simap-game-ui\src\lib\seats\rules.ts, d:\project\simap-game-ui\src\ui\seats\seat-actions.ts, d:\project\simap-game-ui\src\ui\seats\useSeatActions.ts, d:\project\simap-game-ui\src\ui\seats\SeatActions.tsx, d:\project\simap-game-ui\src\ui\seats\SeatsPage.tsx, d:\project\simap-game-ui\src\ui\seats\seats-api.ts, d:\project\simap-game-ui\src\ui\audit\useAudit.ts, d:\project\simap-game-ui\src\ui\AppShellView.tsx, d:\project\simap-game-ui\src\lib\nav.ts, d:\project\simap-game-ui\src\app\(app)\approvals\page.tsx.
