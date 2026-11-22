## Findings

**API to UI mapping (shipped)**
- Auth tiers: GET seats and GET seat are `user` (`api/rooms/[id]/seats/route.ts:23`, `api/seats/[id]/route.ts:21`). POST seats and DELETE seat are `admin`. PUT occupant and PATCH cannot-seat are `manager`. POST release is `user`, and its refusal is 409 `not_allowed` (`seats.ts:424`).
- Bad bodies return **400** `invalid_request`, not 422. Only `member_not_assignable` is 422 (`seats.ts:364`). The ticket text says "409/422", so the client must branch on `error.code`, not on status.
- There is **no `invalid_request` message specific to the reason**. The UI must validate the reason client-side with the same rule as `validate/seat.ts:12-13,55-63`, otherwise the user gets only the generic "Some of the information is not valid" (`copy/api.ts:13`). The rule is NFC, trim, 1..200 chars, no control or default-ignorable characters, and at least one visible character.
- Add seats: the body is `{count}` with count 1..50. The response is `201 {items: SeatDto[]}` (`route.ts:38`). It is not a `RoomSeatsResponse`, so reload the list rather than merge. Delete returns 204 with no body, and `call()` must not parse JSON.
- `PUT occupant` needs both `memberId` and `expectedOccupantId`, and both keys are mandatory (`validate/seat.ts:35-36`). Assign to an empty seat sends `expectedOccupantId: null`. Remove sends `memberId: null` with `expectedOccupantId` set to the shown occupant, which is the correct stale guard. Assigning the same person again is a server no-op and returns the seat (`seats.ts:377`).
- Per action and code:

| Action | Code | UI response |
|---|---|---|
| assign / replace | `occupant_changed` (409) | reload, re-ask with the fresh name (AC4) |
| assign / replace | `seat_cannot_seat` (409) | reload; the panel now shows the reason |
| assign | `member_not_assignable` (422) | reload the picker (the member was deactivated) and keep the dialog open |
| remove | `occupant_changed` | does not arise; remove always uses the shown occupant. It can only arise if the seat changed, so treat as reload. |
| release | `not_allowed` (409) | the seat changed under the user; reload and say so |
| release | success | the seat is no longer `mine`. |
| delete | `seat_not_empty` (409) | the seat stays; reload (a device or occupant appeared) |
| any | `not_found` (404) | reload; if the seat is gone, close the panel and show a not-found state |
| any | `forbidden` / `member_deactivated` / `org_required` | `ApiAccessError`, handled by the gate |

- **`seat_not_empty` copy** says "Clear them first." It is also the code from the DB-constraint path (`pg-error` via `seatConflict`, `seats.ts:48`). Fine for delete. Note it can also come from other writes as a trigger conflict (`seats.ts:48` wraps every `inTx`), which the UI would show with delete wording. Keep the mapping per action, not per code.
- `SeatDto.mine` is computed from the token sub (`seats.ts:110`). Release is shown on `mine`. Role gating is for UX only. Nothing returns the caller's member id, so a Manager who occupies the seat sees both Remove and Release.
- Seat list devices are capped at 20 per seat (`listDevices`), with `deviceCount` giving the real count. Detail caps at 200. The table must show `deviceCount` and not `devices.length`. The panel must fetch `GET /api/seats/[id]`. The list is capped at 500 with `truncated`.
- `RoomSeatsResponse.room` gives `{id, code, name}`, so the page only needs `GET /api/rooms` for code to id. `GET /api/rooms` returns `{rooms}` (`rooms-api.ts:54`).
- Members: `GET /api/members` is `user` tier, and returns `{items: MemberDto[], nextCursor, groups}` with `limit` default 50 and max 100, and `q` max 80 after NFC and whitespace collapse (`member-query.ts`). `MemberDto` has `displayName`, `email` and `employeeCode`. The settled default shows name plus employee code; email is also available for disambiguating duplicate names, but the ticket says code, so use the code and fall back to nothing.

**apiFetch (`lib/api/fetch.ts`)**
- It resends once on 401 or on a 403 other than `org_required` (`:57-69`). Per R7 the seat routes return 401/403 only from `withAuth` before any side effect, so a resent PUT, PATCH, POST or DELETE is safe. The write routes use `tier: "manager"` or `"admin"`, so a tier 403 (role dropped meanwhile) is also pre-write.
- A stream body throws instead of resending, and `JSON.stringify` bodies are fine. A resend after a 403 re-mints the token, so a demoted Manager gets `ApiAccessError("forbidden")`, which `createRoomsApi.call` maps to the code `forbidden`. The seats API client needs the same mapping (`rooms-api.ts:27-33`). That includes mapping `signed_out` to `unauthenticated`, and network errors to `unavailable`.
- No defect affecting seat writes. Cheap to reuse: copy `call/errorCode/withBody` from `rooms-api.ts` rather than invent a shared helper; extracting it is outside size M.

**Shell and routing**
- `src/app/(app)/rooms/[roomCode]/page.tsx` is currently a `PageSkeleton` stub, so replace it.
- `AppShellView.tsx:124-125` already has `<div data-slot="room-switcher" />`, inside `{session && ...}`, so pages without a room are unaffected. `AppShell.tsx:9-18` is the only place that uses `usePathname`, and `AppShellView` takes `pathname` as a prop and is rendered in tests without a router or context (`AppShellView.test.tsx`). The switcher must follow the same pattern: derive the current room code from `pathname` with a pure parser (`/rooms/<code>` only, not `/rooms/<code>/edit`), with no `useSearchParams` in the shell. Pass `rooms` and `onSelect` via a new optional prop or slot so existing tests still render.
- The shell sits inside `AuthGate` (layout), so `useApiFetch` is available in `AppShell` but not in `AppShellView`. Add a small `RoomSwitcher` client component (own `useRooms`) mounted by `AppShell`, and keep `AppShellView` pure by taking it as a `roomSwitcher?: ReactNode` prop. That also avoids a second fetch when the session is null.
- Edit sub-route exists: `rooms/[roomCode]/edit/page.tsx`. The detail page must not shadow it, and the switcher on `/rooms/X/edit` should either hide or still navigate to `/rooms/<code>`.
- `AuthGate` renders `<Fragment key={view.generation}>` (`AuthGate.tsx:621`), which remounts all page state on an org switch, so per-org room and seat state cannot leak across orgs. The dev gate uses `lazy` plus its own `Suspense` (`:66-68`), and `useSearchParams` appears nowhere else in `src` (grep). Children are only rendered after the client-side gate is ready (`IdentityGate` shows `CheckingView` until the effect), so the build-time bailout is unlikely to hit, but a `<Suspense>` inside the page (around the inner component that calls `useSearchParams`) is still required by Next 16 and costs nothing. The fallback should be the table skeleton, not null. Put `Suspense` in `SeatsPage`, not in the layout.
- A `pnpm build` is the only proof the Suspense placement satisfies Next's static bailout rule. Vitest cannot prove it.
- `RoomCard` is a server-safe component with no router import (`RoomCard.tsx:1-8`). A `next/link` is already used in the shell view, so adding `Link` to the card title is fine, but the comment "Links nowhere (D47)" must be updated. Cards are also used in `RoomsView.test.tsx`; check the tests don't assert on the heading text only.

**Seat list and detail sync**
- Source of truth: the list (`GET rooms/:id/seats`), plus one detail fetch for the open panel. Two copies of the same seat can disagree, because the detail has 200 devices versus 20 and may be newer.
- Recommended: one `useSeats(roomId)` hook with a request counter (the `useRooms.ts:12-31` pattern). The hook owns `{list, detail}` and exposes `reloadAll()`, which fetches list and detail together. After any write, call `reloadAll()`. Apply a successful write's returned `SeatDto` to the detail immediately (the PUT, release and cannot-seat responses carry full detail), then refresh the list in the background. This avoids the panel flashing to a loading state after each action.
- Do not clear the detail while reloading. Keep showing the previous seat with a busy marker. This is what keeps focus alive (below).
- The panel reads `?seat=<code>`, finds the seat in the list to get the id, then fetches the detail. If the list is still loading, wait for it. If the code is not in the list, show the panel's not-found state. If the list is `truncated`, a seat beyond 500 would show as not-found falsely. Handle by showing the truncation notice in the not-found state, or accept as a documented limit (spec is far from 500 per room).
- A stale-race detail: if the user opens seat A then B quickly, drop the A response (counter keyed by seat id).

**Focus return and dialogs**
- `EntityFormDialog` (`:42-51`) saves `document.activeElement` on open and refocuses it on close, via native `showModal`. Native `showModal` stacks, so an action dialog opened from the panel dialog works in the top layer, and Esc closes only the top one. The panel is a `<dialog>` and the action dialogs are siblings, not children (otherwise closing the panel would also hide the action dialog). The existing `onCancel` preventDefault and `onClose` pattern applies.
- Problem 1: after an action closes, focus goes back to the button in the panel that opened it. If a reload replaces the panel content with a loading state (unmounts the button), focus is lost to `body`. Fix by keeping the panel mounted and content stable (above), and by keying action buttons by their action, not by the seat object.
- Problem 2: row focus return when the panel closes depends on the table row button still being the same DOM node. If the table re-renders with new item objects and stable `key={seat.id}`, React keeps the node. Never key rows by array index or replace the list by a loading state on reload. Keep stale rows visible while reloading.
- Problem 3: after a refresh with `?seat=` in the URL, the panel is opened by URL, so there is no earlier `activeElement` row to return to. Fall back to focusing the table heading or the row for that code via `querySelector` by `data-seat-code`. `EntityFormDialog`'s own fallback (`previous?.focus`) would focus `body`. Write that fallback in the panel.
- Problem 4: delete removes the row, so focus must go to something that still exists, e.g. the next row or the table's "Add seats" button or the list heading. Do not rely on the dialog's refocus.
- Problem 5: the panel's Back (push) versus close-button (replace) behaviour: a panel opened by Back/forward must open and close the `<dialog>` from the URL, not only from clicks. Derive `open` from the parsed `seat` param and call `router.push` / `router.replace`. The `dialog`'s native Esc `cancel` event must call the close path, or the URL and the dialog get out of sync. Use `onCancel` with `preventDefault`, as `EntityFormDialog` does.
- The 390 px risk: a picker with a radio list and a search box inside an `EntityFormDialog` is capped at `max-w-[440px]` with `overflow-hidden` (`:71`), and so the list needs its own `max-h` and `overflow-y-auto`. `EntityFormDialog` has no scrolling body, so a tall picker on a short viewport can push the submit footer off the screen. Set the list height in `dvh`, and do not put the picker in the panel's dialog.

**Smallest split for size M**
- Pure: `seats-api.ts` (client), `seat-view.ts` (role gating, `?seat` parser/validator, replace-confirm text, status label), `copy/seats.ts`.
- Hook: `useSeats.ts` (list, detail, reload, stale drop).
- Views: `SeatsView.tsx` (table and states, pure), `SeatDetailPanel.tsx` (props-driven, pure).
- Container: `SeatsPage.tsx` (resolve room, URL, actions, dialogs), plus `SeatDialogs.tsx` holding one `ActionDialog` for all five cases (assign or replace, cannot-seat, delete confirm, add count, picker) using `EntityFormDialog`, rather than five files. Ship `MemberPicker.tsx` as its own small component because it has debounce and cursor logic. `RoomSwitcher.tsx` is the third client component. That is about 10 files, which fits M only if the dialogs are not split further.
- Add `SeatsPage`, `SeatsView` and `SeatDetailPanel` exports to `src/ui/index.ts`. Layer rule: `src/ui` imports `@/lib` only, and `lib/seats/types.ts` and `lib/validate/seat.ts` are `lib`, so importing them is allowed. Do not import `@/server/**`. `check:layers` proves it.

## Recommendations
1. Branch on `error.code`, never status, and keep an explicit per-action table (above) in `seat-view.ts` so it is unit-testable (AC4, AC5, AC6).
2. Client-validate the cannot-seat reason with the shared validator from `lib/validate/seat.ts` (R1-compliant import of lib), and show a reason-specific message, because the API returns a bare 400 (AC5).
3. Use returned `SeatDto` from PUT, PATCH and release to update the panel in place, then reload the list. Reload both after any 404, 409 or 422 (settled default 9).
4. Keep rows and panel mounted during reload. Add an explicit focus fallback after delete and after a URL-opened panel closes (AC1, keyboard criterion).
5. Room switcher: a `roomSwitcher?: ReactNode` prop on `AppShellView`, mounted by `AppShell`; the current code comes from `pathname`. Keep the `data-slot` fallback when the prop is absent, and update the stale "wired by SIM-010" comment.
6. The panel and the action dialogs are sibling native dialogs. Open the action dialog from a panel button, and when it closes let the browser return focus to that button. Do not close the panel to open an action.
7. Page: a not-found state for an unknown room code is decided only after the rooms list has loaded, so the first render shows a skeleton and not a flash of not-found (AC2). Do not call `/api/rooms/[id]/seats` before the code resolves.
8. Static note in the table: "devices" cell shows `deviceCount`, and "+N more" if `deviceCount > devices.length`.
9. Clip the reason with `overflow-hidden` plus `max-h` on the container (not only `truncate`), as the ticket notes, in both the table and the panel.
10. Manual test: add "Manager who is also the occupant" (Remove and Release both visible) and "role downgraded mid-session".

## Risks
- Focus loss after reload, delete or a URL-opened panel close (above). It is the likeliest accessibility defect, and no Vitest test will show it.
- Panel and action dialog state: if `SeatsPage` renders action dialogs only when `dialog.kind !== "none"`, `EntityFormDialog` returns null when `open` is false (`:53`), so a closing animation or focus return runs in the cleanup of the effect. Follow the `RoomsPage` pattern (`RoomsPage.tsx:46-58`), which works.
- `EntityFormDialog` has `max-w-[440px]` and no body scroll, so the picker may overflow at 390 px.
- `useSearchParams` with no `Suspense` boundary fails only in `pnpm build`, not in dev or Vitest.
- `router.push` for `?seat=` re-renders the page and (without `scroll: false`) can scroll `main` to the top, losing the row position. Pass `{ scroll: false }`.
- A stale list while the panel's detail is fresh: the row shows the old occupant until the list reload returns. Mitigate by patching the list row from the write response.
- `seat_not_empty` is reachable from non-delete writes (`seats.ts:48`), but its copy says "Clear them first" (see above).
- Seats beyond 500 appear as "not found" in the panel when truncated.
- `RoomCard` change touches `RoomsView.test.tsx`.

## Open questions
1. Does a Manager who is the occupant see both Remove and Release? Recommend yes, or hide Release when Remove is shown, to avoid two buttons doing nearly the same thing. A product choice, not an API one.
2. Should the room switcher list only rooms with seats, or all rooms? Recommend all. Also: should it show on `/rooms/<code>/edit`?
3. Where should the dev-gate path (`DevGate`) get the same `useSearchParams` coverage? `DevGate.test.tsx` exists. Is a render test of `SeatsPage` under it expected?

## What a Vitest-only test plan cannot prove
- Native `<dialog>` behaviour: jsdom has no real `showModal` top layer, focus trap or Esc handling, so panel and action dialog stacking, Esc closing only the top dialog, and focus return are not covered. They need the manual test, or a Playwright check, which is not in the stack.
- Next's `useSearchParams` Suspense bailout, which only `pnpm build` can show, and the real `router.push` / Back / refresh behaviour of `?seat=`.
- 390 px layout, picker height, horizontal table scroll and colour-independent status. These are visual and manual.
- Real concurrency (`occupant_changed`) against a live API. `seats.db.test.ts` covers the server half. Only the client mapping can be unit-tested, using a mocked `apiFetch`.
- The `apiFetch` resend of a write, and the gate's reaction (`setAuthLostHandler`). `fetch.test.ts` already covers the resend, not the seat flows.
- Screen reader announcements and the `aria` live region for status changes.

Key files: `d:\project\simap-wt\SIM-012.2\src\ui\AppShellView.tsx:124`, `d:\project\simap-wt\SIM-012.2\src\ui\AppShell.tsx`, `d:\project\simap-wt\SIM-012.2\src\ui\EntityFormDialog.tsx:42-53`, `d:\project\simap-wt\SIM-012.2\src\ui\rooms\rooms-api.ts`, `d:\project\simap-wt\SIM-012.2\src\ui\rooms\useRooms.ts`, `d:\project\simap-wt\SIM-012.2\src\ui\rooms\RoomsPage.tsx`, `d:\project\simap-wt\SIM-012.2\src\ui\auth\AuthGate.tsx:621`, `d:\project\simap-wt\SIM-012.2\src\server\seats\seats.ts`, `d:\project\simap-wt\SIM-012.2\src\lib\validate\seat.ts`, `d:\project\simap-wt\SIM-012.2\src\ui\copy\api.ts`.
