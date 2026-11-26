Status: READY

# Plan — SIM-057: Check-in room view and home page per role

## Scope summary
`docs/spec-v1.md` PRE-01 (lines 692-701), amending SHL-01:
> - A User lands on the check-in room view after sign-in and org choice (instead of the Dashboard).
> - Manager and Admin keep the Dashboard as home and get a "Check in" nav entry that opens the same view with the
>   same behaviour.
> - The view is a pixel end-user surface (D52): the room map (LAY-06 overlays, zoom, pan, seat detail on click),
>   a "Who's here" list beside the map (below it at 390 px), a room switcher, and a floating "Check in" or "Check out"
>   button.
> - The room shown first: the room of today's active check-in; else the room of the member's most recent check-in
>   where they still have a seat; else their first assigned room by room code; a member with no seat sees the empty
>   state of PRE-02.

SHL-01 (line 667): "A User's home is the check-in room view instead of the Dashboard (PRE-01; D76 amends the OQ-54
answer); Manager and Admin keep the Dashboard as home and get an extra nav entry, "Check in", for the same view."

PRE-02 (line 716), the empty state reused here: "A member with no assigned seat at all sees an empty state: "You don't
have a seat yet" with "Request a seat" (Rooms page). Nothing can be checked in."

`work/decisions.md` D76: "Amends the OQ-54 answer: a User's home is the check-in room view; Manager and Admin keep the
Dashboard as home plus a "Check in" nav entry." D36: UI copy in copy files. D52: pixel end-user surface.

Out of scope (ticket): presence data and API (SIM-058), popup (SIM-059), present/away, name tags (D80), "Who's here"
content and polling (SIM-060), walk animation (SIM-061). The first-room rule takes check-in inputs as parameters; in this
ticket they are always empty, so it falls back to the first assigned room by room code.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A User lands on the check-in room view after sign-in and org choice, instead of the Dashboard. | `src/lib/nav.test.ts` › `homeFor: user → checkin, manager/admin → dashboard`; `src/ui/checkin/HomePage.test.tsx` › `user sees the check-in view at /`. Sign-in returns to `/` (`SignInRoute` → `router.replace(returnTo)`, default `/`), so `/` decides. Local run: `pnpm dev` as a User → `/` shows the check-in view. |
| 2 | Manager and Admin keep the Dashboard as home and have a "Check in" nav entry (desktop and mobile) that opens the same view with the same behaviour. | `nav.test.ts` › `manager and admin: dashboard at /, check in at /checkin`; `AppShellView.test.tsx` › updated admin href list (contains `/checkin`) and new `manager has a Check in link to /checkin; user's first entry is Check in at /` (one `<nav>` serves rail and bottom bar). `HomePage.test.tsx` › `manager/admin see the dashboard at /`. Both `/` (User) and `/checkin` render the same `CheckinPage` component. |
| 3 | The view shows the room map with LAY-06 overlays, zoom, pan and seat detail on click, a "Who's here" list beside the map (below it at 390 px), a room switcher, and a floating "Check in" / "Check out" button slot. | `src/ui/checkin/CheckinView.test.tsx` › `room state: map slot, labelled Who's here section, switcher slot, button slot`; `› grid stacks below lg`. Map is the existing `RoomMapSection` (LAY-06 overlays, zoom, pan, `onSelect`); seat detail is the existing `SeatDetailPanel` via `?seat=`. `src/lib/room-switcher.test.ts` › `checkinRoomHref` / `roomCodeFromQuery` / `checkinGoTarget`. Local run at 1280 px and 390 px: panel beside / below; click a seat opens the detail; switcher changes the room. |
| 4 | The room shown first follows the rule; a member with no seat gets the PRE-02 empty state. | `src/lib/checkin-room.test.ts` (all cases listed under Tests); `CheckinView.test.tsx` › `noSeat state shows "You don't have a seat yet" and a Request a seat link to /rooms`. |
| 5 | Unit tests cover the first-room rule and the nav/home per tier. | `pnpm test` green with the tests listed below. |

All checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

## Ming verification after merge
- Visual check of the view at 390 px on a real phone: the floating button slot (empty in this ticket) and the "Who's
  here" panel do not cover the map's zoom controls or the bottom bar; the bottom bar with 6 (User) / 8 (Manager) / 11
  (Admin) entries stays usable (it already scrolls horizontally).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/checkin-room.ts` (new) | Pure `firstRoom(input)` and `shownRoom(input)` (see Approach step 1). No imports outside `@/lib`. | AC4, rule 6 (pure logic first) | No |
| `src/lib/checkin-room.test.ts` (new) | Unit tests for both functions. | AC4, AC5, R5 | No |
| `src/lib/nav.ts` (lines 4-16, 27-30, 60-68) | Add `NavId` `"checkin"`, `CHECKIN_PATH = "/checkin"`, `DASHBOARD_PATH = "/dashboard"`, item `checkin` (icon `meeting_room`, `minTier: "user"`, rail) after `dashboard`; `homeFor(tier)`; tier-aware `navItemsFor`; `isCheckinView(pathname, tier)`. | AC1, AC2 | No |
| `src/lib/nav.test.ts` | Update id lists (lines 7-20, 26, 44-57), add `homeFor`, per-tier href/order, `isActive` for `/checkin`, `isCheckinView`. | AC5 | No |
| `src/lib/room-switcher.ts` | Add `roomCodeFromQuery(values)`, `checkinRoomHref(pathname, room, seat)`, `checkinGoTarget(pathname, selected, current)`. | AC3 (in-view switcher, URL state) | No |
| `src/lib/room-switcher.test.ts` | Tests for the three helpers. | R5 | No |
| `src/ui/copy/checkin.ts` (new) | `checkinCopy`: title, room heading, switcher label, Who's here heading + placeholder, PRE-02 empty state (`noSeatTitle: "You don't have a seat yet"`, `requestSeat: "Request a seat"`), "Open in room details" link text, load error. Exported for reuse by SIM-059. | D36 | No |
| `src/ui/copy/shell.ts` (lines 52-65, 98-113) | `nav.checkin: "Check in"`; `pages.checkin` title/empty. | `satisfies Record<NavId, string>`, D36 | No |
| `src/ui/checkin/CheckinView.tsx` (new) | Presentational: header (title + room name), switcher slot, state body (`loading` skeleton / `error` + retry / `noSeat` empty state / `room` → grid of map slot + Who's here section), `CheckinButtonSlot`. | AC3, AC4 | No |
| `src/ui/checkin/CheckinView.test.tsx` (new) | Render tests (renderToStaticMarkup, as `AppShellView.test.tsx`). | AC3, AC4 | No |
| `src/ui/checkin/CheckinPage.tsx` (new) | Client container: Suspense around `useSearchParams`; wires `useMySeats`, `useRooms`, `useRoomSeats`, `useRoomLayout`, `useCatalogImages`, `useMemberPhotos`, `RoomMapSection`, `RoomSwitcherView`, `SeatDetailPanel`. | AC3, AC4 | No |
| `src/ui/checkin/HomePage.tsx` (new) | `HomeSwitch({ checkin, dashboard })` picks by `homeFor(useSession().tier)`; `HomePage` = `HomeSwitch` with `<CheckinPage/>` / `<DashboardPage/>`. | AC1, AC2 | No |
| `src/ui/checkin/HomePage.test.tsx` (new) | `HomeSwitch` under `SessionProvider` for user / manager / admin / null. | AC1, AC2, AC5 | No |
| `src/ui/index.ts` | Export `CheckinPage`, `HomePage`. | Pages import from `@/ui` | No |
| `src/app/(app)/page.tsx` | Render `<HomePage />` instead of `<DashboardPage />`. | AC1, AC2 | No |
| `src/app/(app)/checkin/page.tsx` (new) | Render `<CheckinPage />`. | AC2 (Manager/Admin entry; reachable for every tier) | No |
| `src/app/(app)/dashboard/page.tsx` (new) | Render `<DashboardPage />` (the User's Dashboard entry, see Assumptions). | Users keep Dashboard access (OQ-60 answer) | No |
| `src/ui/AppShell.tsx` (line 36) | Pass `roomSwitcher` only when `!isCheckinView(pathname, session.tier)`. | Avoid two switchers; the shell one navigates away from the view | No |
| `src/ui/AppShellView.test.tsx` (lines 141-155, new test after 201) | Admin href list gains `/checkin`; new per-tier nav test. | AC2, AC5 | No |

No High path is touched (checked against `.claude/loop.config.md` → High paths).

## Data model / migration
None.

## API contract
None. The view uses existing endpoints only (`/api/me`, `/api/members/<id>`, `/api/seats/<id>` via `loadMySeats`;
`/api/rooms`; the room seat list and layout via `seatsApi`). No new route handler, so R6/R7 are untouched.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/checkin-room.test.ts` › `active check-in room wins over recent and seats` | Rule 1 |
| › `active check-in wins even when the seat list does not list that room (seat list may lag)` | Rule 1 taken literally from PRE-01 |
| › `no active: most recent check-in whose room has a seat` | Rule 2 |
| › `recent check-in in a room without a seat is skipped; the next recent one with a seat wins` | Rule 2 |
| › `all recent check-ins are in seatless rooms → lowest seat room code` | Rule 2 → 3 |
| › `tie on at: lower room code wins; unparsable at is ignored` | Rule 2 edge |
| › `empty check-in inputs (SIM-057 reality) → lowest room code` | Rule 3 |
| › `unsorted and duplicate seat room codes; "A10" before "A2" (localeCompare, same as composeSeats)` | Rule 3 ordering |
| › `no seats and no active check-in → noSeat` | Rule 4 / PRE-02 |
| › `shownRoom: a requested code in the room list wins` | URL `?room=` |
| › `shownRoom: requested code not in the list falls back to first room; no seat → noSeat` | Unknown `?room=` |
| › `shownRoom: loading while the needed list (rooms for a request, first room otherwise) is not ready` | No wrong-room flash |
| `src/lib/nav.test.ts` › `homeFor: user → checkin, manager/admin → dashboard` | AC1, AC2 |
| › `user: check in at / first, dashboard at /dashboard; manager/admin: dashboard at /, check in at /checkin second` | AC2 per tier |
| › existing id-list tests updated (user 6 ids, manager 8, admin 12, rail order with `checkin` second for admin) | Regression |
| › `isActive: user's check in active on /; manager's check in active on /checkin, dashboard only on /` | Nav highlight |
| › `isCheckinView: /checkin for every tier; / only for user; /rooms never` | Shell switcher hiding |
| `src/lib/room-switcher.test.ts` › `roomCodeFromQuery: none, empty, multiple, invalid chars, too long → null; valid code` | URL input validation |
| › `checkinRoomHref: bare path, room only, room + seat, seat only, encodes values` | URL building |
| › `checkinGoTarget: empty or current selection → null; other code → href with ?room=` | Switcher Go |
| `src/ui/checkin/HomePage.test.tsx` › `user sees the check-in marker; manager and admin see the dashboard marker; no session renders nothing` | AC1, AC2 |
| `src/ui/checkin/CheckinView.test.tsx` › `room state: map slot, Who's here section labelled by its heading, switcher, button slot data-slot="checkin-button"` | AC3 |
| › `grid: lg:grid-cols-[minmax(0,1fr)_300px], single column below lg; Who's here after the map in DOM order` | AC3 390 px |
| › `noSeat state shows the PRE-02 copy and a Request a seat link to /rooms, no map` | AC4 |
| › `loading shows aria-busy skeleton; error shows message and retry` | States |
| `src/ui/AppShellView.test.tsx` › admin href list updated; `manager has /checkin with label Check in; user's first link is / labelled Check in and has /dashboard` | AC2 |

## Approach
1. **`src/lib/checkin-room.ts`** (pure, R1 lib layer):
   ```ts
   export type CheckinInputs = {
     activeCheckinRoom: string | null;            // today's active check-in (SIM-058 supplies it)
     recentCheckins: readonly { roomCode: string; at: string }[]; // ISO timestamps
     seatRoomCodes: readonly string[];            // rooms where the member has a seat
   };
   export type FirstRoom = { kind: "room"; code: string } | { kind: "noSeat" };
   export function firstRoom(input: CheckinInputs): FirstRoom;
   export type ShownRoom = { kind: "loading" } | FirstRoom;
   export function shownRoom(input: {
     requested: string | null; roomCodes: readonly string[] | null; first: FirstRoom | null;
   }): ShownRoom;
   ```
   Order exactly as PRE-01: active → most recent (by `Date.parse(at)` desc; ties by `localeCompare` room code; NaN
   skipped) whose room is in `seatRoomCodes` → lowest of `seatRoomCodes` by `localeCompare` (same as `composeSeats`,
   `src/ui/portal/my-seats.ts:35`) → `noSeat`. `shownRoom`: a requested code present in `roomCodes` wins; if a code is
   requested and `roomCodes` is null → loading; otherwise `first ?? loading`.
2. **`src/lib/nav.ts`**: `homeFor(tier): "checkin" | "dashboard"` (`"checkin"` iff `!atLeastTier(tier, "manager")`).
   `navItemsFor(tier)` keeps filtering by `minTier`, then for a `checkin` home maps `checkin.href → "/"`,
   `dashboard.href → DASHBOARD_PATH` and puts `checkin` first. `isActive` needs no change (`/` stays exact).
   `isCheckinView(pathname, tier)` = `pathname === CHECKIN_PATH || (pathname === "/" && homeFor(tier) === "checkin")`.
   Icon `meeting_room` is already in `ICON_NAMES` (`src/lib/icons.ts:27`), so the icon font subset is unchanged.
3. **`src/lib/room-switcher.ts`**: `roomCodeFromQuery(values: string[])` → null unless exactly one value matching
   `^[A-Z0-9._-]{1,ROOM_LIMITS.code}$` (same charset as `CODE_RE` in `src/lib/validate/room.ts:13`; never echo an
   invalid value). `checkinRoomHref(pathname, room, seat)` builds `pathname?room=…&seat=…` with `URLSearchParams`
   (omits nulls). `checkinGoTarget(pathname, selected, current)` mirrors `goTarget`. Query params avoid the dot-segment
   issue of `roomDetailHref`.
4. **Copy**: `src/ui/copy/checkin.ts` (`checkinCopy`), `shellCopy.nav.checkin = "Check in"`, `shellCopy.pages.checkin`.
   No literals in `.tsx` (the `no-literals.test.ts` scan covers `src/ui` and `src/app`).
5. **`CheckinView.tsx`** (presentational, props-driven): `<div className="p-4 lg:p-6 flex flex-col gap-4">`, `h1`
   title, the switcher slot, then by state. Room state:
   `<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="min-w-0">{map}</div><section
   aria-labelledby={id}>` with an `h2` "Who's here" and the placeholder text (SIM-060 fills it). `lg` (1024 px) is the
   shell's breakpoint; below it the panel stacks under the map (covers 390 px). `CheckinButtonSlot`: `<div
   data-slot="checkin-button" className="pointer-events-none fixed right-4 z-20
   bottom-[calc(68px+env(safe-area-inset-bottom)+1rem)] lg:bottom-6">{children}</div>` with no children in this ticket
   (no dead control ships; SIM-058/059 put the button there with `pointer-events-auto`). No-seat state: Card with the
   PRE-02 title and a `Link href="/rooms"` "Request a seat"; the switcher stays so the member can still look at any
   room.
6. **`CheckinPage.tsx`** (client; inner component inside `<Suspense>` like `SeatsPage`, `src/ui/seats/SeatsPage.tsx:294`):
   - `requested = roomCodeFromQuery(searchParams.getAll("room"))`, `param = parseSeatParam(searchParams.getAll("seat"))`.
   - `mySeats = useMySeats(apiFetch, seatsApi)`; when ready, `first = firstRoom({ activeCheckinRoom: null,
     recentCheckins: [], seatRoomCodes: mySeats.seats.map(s => s.roomCode) })` (empty check-in inputs until SIM-058;
     leave a one-line comment naming SIM-058/SIM-060). `mySeats` error → error state with retry (`mySeats.reload`).
   - `rooms = useRooms(roomsApi)` for the switcher and for validating `requested`; keep the last good list with
     `keepGoodRooms`.
   - `shown = shownRoom({ requested, roomCodes: rooms ready ? codes : null, first })`.
   - Map and detail as in `SeatsPage.tsx:61-80`: `useRoomSeats(roomsApi, seatsApi, shownCode ?? "", openCode)`,
     `useRoomLayout`, `placedArtEntries`, `useCatalogImages`, `RoomMapSection` (no `editHref`), `panelView` +
     `SeatDetailPanel` with `useMemberPhotos` for the occupant photo. Seat actions are not wired here: `actions` is a
     `Link` "Open in room details" to `roomDetailHref(code)` + `?seat=` where the existing actions (request, assign…)
     live. Do not import `SeatsPage` or the management dialogs.
   - Open seat: `router.push(checkinRoomHref(pathname, requested, code), { scroll: false })`; close:
     `router.replace(checkinRoomHref(pathname, requested, null), { scroll: false })` (keeps `?room=` only if it was
     there, so `/` and `/checkin` behave the same).
   - Switcher: `RoomSwitcherView` (`src/ui/RoomSwitcher.tsx:16`) with local `selected` synced to the shown code; Go →
     `checkinGoTarget(pathname, selected, shownCode)` → `router.push`. Reusing the view keeps select + Go (no
     navigation on arrow keys); its fixed `id` is safe because the shell switcher is hidden on this route (step 7).
7. **Shell**: `AppShell.tsx:36` → `roomSwitcher={session && !isCheckinView(pathname, session.tier) ? <RoomSwitcher
   pathname={pathname} /> : undefined}`.
8. **Routes**: `src/app/(app)/page.tsx` → `<HomePage />`; new `checkin/page.tsx` → `<CheckinPage />`; new
   `dashboard/page.tsx` → `<DashboardPage />`. `HomeSwitch` returns null without a session (children render only
   with a session under `AppShellView`, `src/ui/AppShellView.tsx:210`, so there is no Dashboard flash for a User).
9. Run `pnpm format`, then all Checks.

Rules: R1 — `src/lib/*` stays pure (no `@/ui`, no server); UI imports `@/lib` and `@/ui` only; pages import `@/ui`;
`pnpm check:layers` enforces. R2/R6/R7 — no schema, query or route-handler change. R3 — no config. R4 — no presence
data, popup, tags or polling. R5 — tests above. D36 — copy in `src/ui/copy/checkin.ts` and `shell.ts`.

## Specialist input used
- frontend-developer 1 / ux-architect 1 (pure first-room function with tests): adopted. Rejected the "active check-in
  only if a seat is held" filter: PRE-01 states the rule without that condition, D82 already ends a check-in on seat
  loss, and the client seat list may lag the presence data; test pins the literal behaviour.
- Both: `homeFor(tier)` in `nav.ts`, `NavId "checkin"`, `minTier`-based Manager/Admin entry: adopted, with a tier-aware
  `navItemsFor` so a User's first entry is "Check in" at `/`.
- Both: `/` as a client switch, not a redirect: adopted (no flash, no back-button trap, `SignInRoute` already returns
  to `/`).
- URL: `/checkin` (frontend) over `/check-in` (ux): `/checkin` chosen; plan choice, matches the `checkin` id.
- Both: do not reuse `SeatsPage`; reuse `RoomMapSection`, `useRoomLayout`, `useCatalogImages`, `SeatDetailPanel`,
  `?seat=`: adopted. Seat actions replaced by a link to Room detail to keep the slice small.
- ux 4 / frontend 4: in-view switcher with `?room=`, hide the shell switcher on the view: adopted; reuse
  `RoomSwitcherView` rather than a new control.
- ux 5: switcher lists all rooms, first room only from seats: adopted.
- ux 3 / frontend 4: floating slot as an empty positioned container above the bottom bar with safe-area inset:
  adopted. "Who's here" as a labelled section with a placeholder: adopted.
- Breakpoint: Tailwind `lg` (1024 px, shell breakpoint) per ux 3: adopted.
- Risk "User Dashboard access" (both open questions): resolved as an assumption below, not blocking.
- N+1 of `loadMySeats` (frontend risk): accepted for P0; noted as a follow-up.

## Assumptions
- **A User keeps a Dashboard entry**, at the new `/dashboard` route, as the second rail entry after "Check in" (`/`).
  Reason: D76 only changes the home; OQ-60's answer says Users keep the Dashboard counts. If Ming prefers to drop the
  Dashboard for Users, it is a small change (filter it out for a `checkin` home and delete `dashboard/page.tsx`).
- A User's home entry is labelled "Check in" (same label as the Manager/Admin extra entry), icon `meeting_room`.
- `/checkin` is open to every tier (same view); a User reaching it by URL sees no nav highlight (their entry is `/`).
- Breakpoint for "beside vs below" is `lg` (1024 px), so 390 px stacks as the spec requires.
- The "Who's here" panel ships visible with a heading and placeholder text; the floating button container ships empty
  (no disabled control). SIM-058/059/060 fill both.
- With no seat, the empty state replaces the map, and the switcher still lets the member look at any room
  (`?room=` shows that room's map).
- Spec drift to flag: SHL-01 line 665 still says "The home page stays the Dashboard unless OQ-54 changes it", while
  line 667, PRE-01 and D76 amend it. This plan follows line 667/D76; a doc tidy of line 665 is a follow-up (not in
  this ticket's files).
- Gate: P0 with no High path; the ticket reads `high-paths+P1` as not covering P0, so no plan approval. If Ming reads
  it as P1-and-above, set `plan-approval` before IMPLEMENT.
- Hotspots: open tickets SIM-055 and SIM-056 (IN_PROGRESS) do not list `nav.ts`, `AppShell*`, `copy/shell.ts`,
  `ui/index.ts` or `app/(app)/page.tsx` in their plans; `src/ui/index.ts` is a common append point, so a trivial rebase
  is possible. SIM-059/060 will build on `src/ui/checkin/**` and `checkinCopy`.
- Follow-ups: a `/api/me` seats summary to replace the N+1 `loadMySeats` on the home page; spec line 665 tidy.

## Blocking questions
None.

## Split proposal
None. Estimate about 450 non-test lines plus about 350 test lines: at the upper edge of one cycle, but every part is
needed for the acceptance criteria. If the implementer exceeds about 550 non-test lines, the seat-detail panel wiring
(step 6, `SeatDetailPanel` + `useMemberPhotos`) can move to a follow-up, keeping `onSelect` as a link to Room detail
with `?seat=`.
