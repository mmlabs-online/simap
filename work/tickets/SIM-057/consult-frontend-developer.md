## Findings
- Home: `src/app/(app)/page.tsx` is a server page that just renders `<DashboardPage />`. Tier is only known client-side (`useSession()?.tier`, as in SeatsPage), so home-per-role needs a small client wrapper at `/`. I found no existing post-sign-in redirect (grep for `router.replace("/")` and `redirect(` found nothing), so "after sign-in and org choice" most likely lands on `/`.
- Nav: `src/lib/nav.ts` holds `NAV_ITEMS` with `NavId`, `minTier` and `placement`. `AppShellView` renders `navItemsFor(tier)` filtered to rail. `shellCopy.nav` in `src/ui/copy/shell.ts` is typed `satisfies Record<NavId, string>`, so a new `NavId` forces a label there. `isActive` treats `/` as an exact match. Nothing yet tells a User and a Manager apart for home.
- Room switcher: `src/lib/room-switcher.ts` and `src/ui/RoomSwitcher.tsx` are the shell switcher. They are path-driven: `roomCodeFromPath` plus `goTarget` navigate to `/rooms/<code>`. They do not fit a view whose selected room is page state.
- Map: `RoomMapSection` is a Card with a heading, an edit link, and the `RoomMap` with zoom, pan and `onSelect`. `SeatsPage` wires it through `useRoomSeats` and `useRoomLayout` (via `roomsApi` and `seatsApi`) and opens the seat detail through `?seat=` with `router.push`. The seat detail and seat-table code in `SeatsPage` is large and mixed with management actions.
- Own seats: `loadMySeats` / `useMySeats` in `src/ui/portal/` (`/api/me`, then `/api/members/<id>`, then one `/api/seats/<id>` each). The result is sorted by `roomCode` and each `SeatDto` carries `roomId` and `roomCode`. It makes N+1 calls but is reusable, and it gives the "first assigned room by room code" fallback.
- Spec: the PRE-01 text matches the ticket. SHL-01 line 665 still says "The home page stays the Dashboard unless OQ-54 changes it", while line 667 and D76 amend that. The spec contradicts itself in a minor way, so flag it. PRE-02 owns the no-seat empty state: "You don't have a seat yet" with a "Request a seat" link to the Rooms page.

## Recommendations
1. `src/lib/checkin-room.ts` (pure, with a test file). Suggested signature: `firstRoomCode({ activeCheckinRoom, recentCheckins: {roomCode, at}[], seatRoomCodes })` returning `string | null`.
   - Rule 1: today's active check-in room. Still require that the member holds a seat there, to be safe.
   - Rule 2: the most recent check-in (latest `at`) whose room is in `seatRoomCodes`.
   - Rule 3: the lowest of `seatRoomCodes`. Sort by code with a stable comparison and match `loadMySeats` (`localeCompare`) to avoid a mismatch.
   - Return null when `seatRoomCodes` is empty (no-seat state).
   - Tests: active wins; recent with seat; recent room without a seat skipped, falling through to the next recent check-in and then to the lowest code; a tie on `at`; empty inputs; unsorted and duplicate codes.
   - In SIM-057 the check-in inputs are empty.
2. Home per role: add a pure `homeFor(tier)` or `isCheckinHome(tier)` in `src/lib/nav.ts`, with tests. Add `NavId` `"checkin"` with `href: "/checkin"`, `minTier: "manager"`, `placement: "rail"`. A User gets no rail entry, because the view is their home. Put it after the dashboard, and add the `shellCopy.nav.checkin` label "Check in" and a `pages.checkin` entry.
   - Add `exactTier` or `maxTier` semantics if needed; `minTier: "manager"` already gives Manager and Admin.
   - For a User, either keep the Dashboard item out of `navItemsFor` or make its `href` the check-in view. The cleaner option is for the User's "Home" item to go to `/`, rendered by the wrapper.
   - Tests: nav items per tier (User has no "Check in" or Dashboard entry; Manager and Admin have both), `isActive` for `/checkin`, and a placement check.
3. Routing: make `/` render a client `HomePage` that shows the check-in view for a User and the Dashboard otherwise (decide while the session is still loading to avoid a Dashboard flash for a User; reuse the session loading state). Add `src/app/(app)/checkin/page.tsx` rendering the same `CheckinPage`. This avoids a redirect, keeps "same behaviour", and keeps Manager and Admin access.
4. UI: create `src/ui/checkin/CheckinPage.tsx`, with its own hook that reuses `useMySeats`, `useRoomsApi`, `useRoomLayout` and `RoomMapSection`. Add an optional `heading` or `actions` prop to `RoomMapSection`, or compose `RoomMap` directly. Do not reuse `SeatsPage`.
   - Layout: a `lg:grid` with the map and a "Who's here" aside (placeholder text until SIM-060), stacking below the map at 390 px.
   - Room switcher: a local `<select>` (listing rooms the member can view, i.e. all rooms) bound to page state, or `?room=<code>` in the URL. Prefer the query param so it is shareable and survives reload.
   - Floating button slot: a `fixed bottom-4 right-4` container. At 390 px keep it clear of the mobile bottom bar (add the bar height and the safe-area inset). Render it disabled or hidden until SIM-058, and expose a `children` or slot prop.
   - Seat detail on click: reuse the seat panel via `?seat=`. Check how much of the `SeatsPage` detail panel can be imported without the management actions.
   - Copy in `src/ui/copy/checkin.ts` (D36), with the PRE-02 empty-state wording and a link to `/rooms`.
5. Layers (R1): `src/lib/checkin-room.ts` stays pure. The UI imports only `@/lib` and `@/ui`. Run `pnpm check:layers`, `pnpm typecheck`, `pnpm test` and `pnpm format:check`. No new API, no schema change, so no migration (R2).

## Risks
- The `useMySeats` N+1 fetch on every home load for a User is heavy. It is acceptable for P0, but a note or a later `/api/me` seats summary would help.
- A flash of the wrong home while the session loads, and a Manager landing on the check-in view by mistake, are both real risks. Add a test for the wrapper that covers loading, user, manager and admin.
- `RoomMap` tag and avatar behaviour is spec'd for D80 (always-visible name tags, adjacent-seat readability) in SIM-060 only. Do not attempt it here.
- The `shellCopy.nav` `satisfies Record<NavId, string>` and `byNav` and `badges` types will break at compile time until updated, so grep other `Record<NavId` uses (AppShellView.test).
- The existing `RoomSwitcher` shows "Go" navigation on `/rooms/<code>`. A second, different room switcher on the check-in page next to the shell's one could confuse users, so make sure there is a clear label and distinct copy. The shell switcher on the check-in page should probably keep working as a link to Room detail.
- Gate: this is a P0 with no High path, so no plan approval is needed, but it is an open reading (see below).

## Open questions
- Should a User get no "Check in" rail entry (my recommendation, since the view is their home), or also have one? The spec says only Manager and Admin get the extra entry, but a User still needs to reach home from the rail, so a "Home" item is needed. What should its label and icon be? Today's Dashboard item has `minTier: "user"`, so a User sees it. Does the User keep a "Dashboard" entry pointing to the Dashboard (SHL-01 lists the Dashboard as a page, while D76 says only that the home changes)? Please confirm.
- The URL for the new page (`/checkin` is my assumption).
- Should the SHL-01 line 665 wording be cleaned up in the spec (the stale OQ-54 sentence)?
- Does "room switcher" mean a new in-view control (recommended) or the shell's existing one?
- Is `plan-approval` wanted for this P0 (see the ticket's technical notes)?
