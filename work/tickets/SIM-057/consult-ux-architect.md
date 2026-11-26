## Findings (SIM-057, consult, read-only)

Code state (paths under /home/user/simap/src):
- `lib/nav.ts`: a static `NAV_ITEMS` list. `navItemsFor(tier)` filters by `minTier`, and `placement` is "rail" or "room". `NavId` is a union, and `ui/copy/shell.ts` `nav` is typed `satisfies Record<NavId, string>`, so a new id forces a copy label. `isActive` treats href "/" as exact-match only.
- `app/(app)/page.tsx` always renders `<DashboardPage />`. It has no tier branch, and a server component cannot read the in-memory session (D4).
- `ui/AppShellView.tsx` renders rail items from `navItemsFor(session.tier)` (desktop rail and mobile bottom bar are the same `<nav>`). The shell already renders a shell-level `RoomSwitcher` (`ui/RoomSwitcher.tsx`). It navigates to `/rooms/<code>` via `goTarget` / `roomDetailHref`.
- `RoomMapSection` (zoom state inside) is wrapped in a Card and takes a `MapLoadState`. `SeatsPage` wires the seat detail through the `?seat=` URL param, using `useRoomSeats`, `useRoomLayout`, `useCatalogImages` and `SeatDetailPanel`. All of it is coupled to `roomCode` and `usePathname`.
- Own-seat data: `ui/portal/my-seats.ts` `loadMySeats` and `useMySeats` give the caller's `SeatDto[]`, already sorted by `roomCode` then seat code. `/api/me` supplies the member id. That is the only existing "assigned rooms" source.
- `DashboardPage`, `DevicesPage` and others already treat Users specially. `DevicesPage` redirects Users to My Portal (`devicesPageRedirect`). I did not verify which `/api/rooms` and layout endpoints a User may call. Spec says room view is "all roles", so they are probably open.
- Spec checks: SHL-01 and PRE-01 agree with the ticket. SHL-01 line 665 ("home stays the Dashboard unless OQ-54 changes it") is now superseded by line 667 and D76. D80 (name tags always visible, readable when adjacent) applies to this view. SIM-057 has no tags or presence data, so D80 belongs to SIM-060.

## Recommendations

1. **First-room rule (AC4, unit tests).** Add a pure `src/lib/checkin-room.ts` (or `lib/presence/first-room.ts`) with an input like `{ activeCheckinRoom: string|null, recentCheckins: {roomCode, at}[], seats: {roomCode, code}[] }`.
   - Return `{ kind: "room", code } | { kind: "no-seat" }`.
   - Order of checks: active check-in room (only if the member still has a seat there); else the most recent check-in whose room still has a seat (tie-break by later time, then room code); else the lowest room code of assigned seats; else no-seat.
   - Compare room codes with the same `localeCompare` as `composeSeats`.
   - Run the active-check-in rule through the same "still has a seat" filter. D82 normally ends such a check-in, but it keeps the function safe against stale data.
   - Tests: each branch, a check-in room with no seat is skipped, tie-break, empty inputs (the SIM-057 reality until SIM-058), multiple seats in one room, and case/ordering of codes like "A10" vs "A2" (decide `localeCompare` versus numeric; match what the rest of the app does).
2. **Nav/home per tier (AC1, AC2, AC5).**
   - Add `NavId` "checkin" with a new `checkin` label in `shellCopy.nav`. Use href `/check-in`, `minTier: "manager"`, placement "rail". Pick an existing `IconName`.
   - Add a pure `homeFor(tier)` in `lib/nav.ts`. Return `"/"` for Manager and Admin and the check-in route for a User.
   - Do NOT make a User's home the same URL as a Dashboard. Keep `/` as a thin client switch: `app/(app)/page.tsx` renders a small client component that reads `useSession().tier` and renders either `DashboardPage` or `CheckinPage`. No redirect flash, and "after sign-in" (`SignInRoute` returns to `/`) works without touching auth. Alternatively redirect Users from `/` to `/check-in` client-side, but that adds a flash and a back-button trap.
   - Recommended: render the check-in view directly at `/` for a User so there is one URL for them. Manager and Admin use `/check-in`.
   - Nav tests: a User sees no Dashboard-only change beyond the decision in Q1. Manager and Admin see "dashboard" and "checkin". Check entry order, `isActive` for `/check-in`, and `homeFor` per tier.
   - Mobile bar: the rail already scrolls horizontally (`overflow-x-auto`, `min-w-16`). The Manager and Admin bars gain one more entry (Admin already has about 10). Check 390 px for reachability, as the existing rule tolerates horizontal scroll.
3. **View structure (AC3).** Do not reuse `SeatsPage` whole. It carries the seat table, add and assign dialogs and the room-detail URL.
   - Extract or reuse the small pieces: `useRoomLayout`, `useCatalogImages`, `placedArtEntries`, `RoomMapSection` (give it props to hide the heading card chrome and the edit link, both already optional), and `SeatDetailPanel` with `useRoomSeats` for seat detail on click.
   - Keep seat detail on `?seat=` with `seatHref(pathname, code)` so both routes behave the same.
   - New `src/ui/checkin/`: `CheckinPage` (client, Suspense for `useSearchParams`), `WhosHerePanel` (empty shell region, SIM-060 fills it), `CheckinButtonSlot` (floating, bottom-right; above the mobile bottom bar via `bottom` offset plus `env(safe-area-inset-bottom)`). It should render nothing active until SIM-058. Decide whether the slot is a disabled button or an empty positioned container. I recommend an empty container with a `data-` hook so no dead control ships.
   - Layout from the mockup: `grid-template-columns: minmax(0,1fr) 300px` with a stack at 900 px; the mockup breakpoint is 900, while the ticket says "below it at 390 px". Use Tailwind `lg` (1024, the shell's breakpoint) so the rail and the 300 px panel do not squeeze the map. Confirm with Ming's mockup. Use `min-w-0` on the map column.
   - Copy in `src/ui/copy/checkin.ts` (D36), including the PRE-02 empty state "You don't have a seat yet" and "Request a seat" (link `/rooms`). Reuse that exact string for SIM-059 by exporting it from one place.
4. **Room switcher.** The shell `RoomSwitcher` goes to `/rooms/<code>`, which leaves the check-in view. Add a view-local switcher (or an `onSelect`-style mode) that sets `?room=<code>` on the check-in route. Reuse `visibleSelection` and `keepGoodRooms` from `lib/room-switcher.ts`. Extend `lib/room-switcher.ts` with a pure `checkinRoomHref(code)` and a `roomCodeFromQuery`, with tests. Cover both the dot-segment case (`roomDetailHref` returns null for "." and "..") and an unknown code in `?room=` (fall back to the first-room rule). Decide whether the shell switcher shows or hides on this route; two switchers would be confusing. Recommend hiding the shell one on the check-in route (`pathname` check in `AppShell`) and using the in-view one.
5. **Which rooms the switcher lists.** The spec says the switcher presence is across the org (everyone sees presence in every room), and PRE-02 lists unseated rooms locked. So list all rooms from the rooms API (as `RoomSwitcher` does). The first-room rule picks the initial room only from seats. Do not restrict the list to assigned rooms.
6. **Data wiring for the rule.** `loadMySeats` is N+1 (me, member, one `/api/seats/<id>` per seat). The rule only needs room codes, so use the `MemberSeatRef`s if they carry the room code; otherwise reuse `useMySeats`. Check `MemberSeatRef` fields before choosing. For a User, wait for the seats load before choosing the room, and show a skeleton rather than the lowest room flashing.
7. **Tests (R5).** Vitest for `first-room`, `nav`/`homeFor`, switcher helpers, and a render test for the home switch by tier (follow `AppShellView.test.tsx`). Run `pnpm check:layers`, `pnpm typecheck`, `pnpm format:check` and `pnpm test`. The lib module must stay pure: no `@/ui` or server imports, and use the `@/` alias.
8. **A11y and pixel surface (D52).** The "Who's here" region should be a labelled `<section aria-labelledby>`; the map keeps its keyboard focus path to seat detail. The floating button needs a focus ring and must not cover the map's pan controls on 390 px.

## Risks
- Spec drift: SHL-01 line 665 still says "home stays the Dashboard unless OQ-54 changes it". It also says Dashboard is a page in the nav for all. Line 667 handles that, so I flag it only for a doc tidy.
- If "/" renders the Dashboard for a short time before the session tier is known, a User sees a flash. Render nothing or a skeleton until `useSession()` resolves (AuthGate already gates, so it is probably resolved).
- Mobile bar for Admin is already crowded; adding "Check in" may push entries off-screen at 390 px.
- Two room switchers (shell plus in-view) and the shell one navigating away from the view would break the "same behaviour" criterion.
- Gate: P0, no High path, `plan-approval` is none. As the ticket says, Ming may read the policy as P1-and-above. The files touched (nav, shell, home) are not in the listed High paths as far as I can tell (I did not open `.github/risk-tiers.yml`). Worth confirming.
- R6/R7: no new API here, so none. When SIM-058 adds the presence input, the rule must take it as a parameter, not fetch it inside `src/lib`.

## Open questions
1. Does a User keep a "Dashboard" nav entry? SHL-01 says the home is the check-in view for a User, but does not say whether the Dashboard stays reachable for them. If Users have no Dashboard entry, what is the User's nav entry for the home view, and what is its label ("Check in", too)? The ticket says Manager and Admin get "an extra entry", which implies a User's existing "/" entry now points at the view. Recommend: for a User, the first rail entry is "Check in" at "/", and Dashboard is hidden.
2. Is the route for the Manager and Admin entry `/check-in`, or `/?view=checkin`? The ticket leaves the URL open; I recommend `/check-in`.
3. Should the room choice be reflected in the URL (`?room=`) so a reload or share keeps it? Recommend yes.
4. Should the empty "Who's here" and floating button slot ship visible before SIM-058/060, or hidden? Recommend a visible empty panel with the heading, and a hidden button container.
5. Breakpoint for "beside vs below": 390 px per the ticket, versus the mockup's 900 px and the shell's 1024 px. Which one wins?
6. Does the first-room rule treat a room the member has a seat in but that no longer exists or is deleted as no-seat? (Rule takes room codes from seats, so this should not arise; confirm.)

Files read: /home/user/simap/work/tickets/SIM-057/ticket.md, /home/user/simap/docs/spec-v1.md (SHL-01, PRE-01, PRE-02, LAY-06), /home/user/simap/work/decisions.md (D76 to D83 grep), src/lib/nav.ts, src/lib/room-switcher.ts, src/app/(app)/page.tsx, src/ui/AppShellView.tsx, src/ui/roomlayout/RoomMapSection.tsx, src/ui/seats/SeatsPage.tsx, src/ui/portal/my-seats.ts, src/ui/portal/useMySeats.ts, src/ui/copy/shell.ts. I did not open the mockup beyond grepping its layout rules, and did not read D76 in full (the grep omitted that line).
