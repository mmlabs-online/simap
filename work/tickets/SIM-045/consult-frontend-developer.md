# SIM-045 — consult: frontend-developer (read-only)

## Findings

**Reuse state: the Devices page is a monolith.**
- `src/ui/devices/DevicesPage.tsx` (432 lines) owns every owner action: row handlers, 8 dialogs (Transfer, Return, Extend, TakeBack, Place, Assign, DeviceForm, Delete), `refreshAll`, the `act()` helper for handoff confirm/decline/cancel, focus management and the badge update. None of it is a reusable hook.
- `DevicesView.tsx` is pure but carries the page `<h1>`, filter chips and the New button. `DeviceTable`, `rowActions` (`device-actions.ts`), `OverdueBanner`, `IncomingTransfers` are reusable as they are.
- `rowActions` is gated by the server's `can*` flags and `d.mine`; "no actions while a handoff is pending, except cancel" comes from those flags plus `pendingHandoff.canCancel`, so part of the new unit test tests the existing `rowActions`.
- `createDevicesApi` (`devices-api.ts`) has **no client for `GET /api/devices/mine`** (route and `parseMyDevicesQuery` exist from SIM-044); `useDevices(api, filter)` only works with `api.list`.
- `PlaceDeviceDialog` takes a `tier` prop; `bannerHandlers` already limits the banner to Extend, Give back and Cancel.

**No "my seats" endpoint.**
- `GET /api/me` returns `member: { id, displayName, status, needsProfile }`, no seats.
- `GET /api/members/[id]` (tier user) returns `seats: {id, code}[]` (no room, tags or "mine").
- `GET /api/seats/[id]` returns a full `SeatDto` (`roomCode`, `group`, `project`, `mine`, `devices`).
- Without new APIs: `/api/me` (member id) → `/api/members/<id>` → `GET /api/seats/<id>` per seat; acceptable for 1 to a few seats. R6: read `/api/members/<me.member.id>` only, never an id from the URL.
- "View on map": `seatResultHref({roomCode, code})` (`src/ui/search/search-state.ts`) → `/rooms/<room>?seat=<code>`, null for dot-segment room codes; `SeatsPage` consumes `?seat=`.
- Release: `seatsApi.release(seatId)` (`POST /api/seats/:id/release`) with a confirm dialog; check whether it lives in `SeatActions` / `useSeatActions` before extracting.
- Requests with cancel: reuse `MyRequestsView` + `useMyRequests`, but `MyRequestsPage` also owns the mark-seen call that clears the nav badge; embedding it means mark-seen fires on tab view (decide deliberately, OQ-59).

**Profile tab.**
- `ProfileView.tsx` is the first-visit form inside `AuthLayout`; reuse only `profile-form.ts` (`validateProfileName`, `profilePatchInit`, `mapPatchResult`), `profileCopy`, `FilledInput`.
- `mapPatchResult` treats success as `member.needsProfile === false` via `readMeResult`; PATCH `/api/me` takes `{displayName}`, 400 for invalid names.
- Email and role from `Session` (`src/lib/session.ts`: `tier`, `email`); role label via `RoleBadge`.
- Initial display name needs `/api/me`; check whether AuthGate / DevGate already holds it (`useSession` does not expose it).

**Nav, badge and redirect.**
- `src/lib/nav.ts`: add `"portal"` to `NavId` with an existing `IconName` (`src/lib/icons.ts`, e.g. `person` / `account_circle`); add `{ id: "portal", href: "/portal", minTier: "user", placement: "rail" }`; change `devices` to `minTier: "manager"`. `nav.test.ts` hard-coded id lists (l.12, 22, 57) and the "devices" assertion (l.116) must be updated.
- `isActive` prefix-matches, so `/portal` works.
- `AppShell.tsx` passes `badges={{ myRequests, devices }}`; for OQ-59 pass `portal` (request count + handoff total for tier user); Devices keeps the handoff badge for Manager+. Add `portal` to `shellCopy.badge.byNav` and `badgeLabels`. `AppShellView.test.tsx` badge tests (l.224-264) need portal cases.
- Open: keep `myRequests` (`/requests`) in the nav for all tiers (spec unchanged)? Then the request badge shows twice unless the portal badge counts only handoffs and overdue.
- `/devices` redirect is client-only: `useSession().tier` + `router.replace("/portal?tab=devices")` in `DevicesPage` or a thin wrapper; don't mount `useDevices` before the redirect (Users' list calls would otherwise run).
- `/devices/[id]` must stay reachable for held devices; verify `DeviceDetailPage` doesn't depend on the org list or `minTier`; link My devices rows via `deviceDetailHref`.

**Tabs and URL.**
- No tablist exists (grep `tablist`): new `Tabs` component (in `src/ui/portal/` or shared), WAI-ARIA tabs pattern, horizontally scrollable at 390 px.
- URL-state precedent: `ApprovalsPage.tsx` (`useSearchParams` in `<Suspense>`, `router.replace(statusHref(pathname, next), { scroll: false })`), `SearchPage` (`parseSearchParam`, exactly one value).
- Pure helpers: `parsePortalTab(getAll("tab"))` → `seat|devices|profile` (fallback `seat`), `portalTabHref(pathname, tab)`.

**Page placement.** `src/app/(app)/portal/page.tsx` renders `PortalPage` via the `@/ui` barrel; copy in `src/ui/copy/portal.ts`; add `shellCopy.nav.portal` and `shellCopy.pages.portal` (`shell.ts` l.42, l.89).

## Recommendations
1. **Split (the ticket anticipates it).** Extract device-action state from `DevicesPage` into a shared hook (e.g. `useDeviceActions(api, { refresh, ... })` → `{ handlers, dialogs element, notice, busyId, refreshAll }`) used by both pages; duplicating ~400 lines is the main size risk. Suggested: SIM-045.1 (nav, tabs, page, My seat, Profile, redirect) and SIM-045.2 (My devices via the hook + `mine` client). As one ticket it is L.
2. Add `api.listMine(filter?)` to `devices-api.ts`; `useDevices` accepts a loader or `source: "all" | "mine"`. Overdue banner: filter the mine list by `d.overdue` client-side. Check what `parseMyDevicesQuery` supports.
3. "Waiting for my confirmation": `IncomingTransfers` + `useHandoffList(api,"incoming",true)` (`/api/handoffs?box=incoming`); keep `act`, `confirmOutcome`, `declineOutcome` and the badge update (`badgeCountAfter`, `useSetHandoffBadge`).
4. Manager/Admin pass `boxes = []` here; no PendingReturns / PendingExtensions in the portal.
5. Manager+ My devices: same mine endpoint, own devices only, no New / Edit / Delete / Take back; only owner handlers (`onPlace`, `onTransfer`, `onReturn`, `onExtend`, `onCancelHandoff`; `onAssign` / `onEditHolding` only if rules allow); test that Edit/Delete/TakeBack are omitted.
6. Render only the active panel; My seat mounts first by default; Profile fetches no devices.
7. Tests: `portal-tabs.test.ts` (`parsePortalTab`, `portalTabHref`); `portal-actions.test.ts` (User/Manager handlers, no Edit/Delete/TakeBack even with flags true); `nav.test.ts`; badge-count helper; `AppShellView` badge tests; optional SSR render test of Tabs.
8. Deactivated/unlinked member: AuthGate already handles `member_deactivated` / `needsProfile`; the My seat calls surface errors via `apiErrorMessage`; a 404 on `/api/members/<me.id>` is an error state, not empty.
9. Add `portal` to the spec's SHL-01 only if the plan changes the nav list.

## Risks
- Extraction can regress the Devices page; keep its component tests green, no behaviour change.
- Request-badge double counting if `myRequests` and `portal` show the same count (OQ-59).
- N+1 seat fetches; a seat 404 after release in another tab must show a stale state and reload, not a blank list.
- `?tab=` repeated values and the `<Suspense>` boundary (missing Suspense breaks `next build`).
- Client-only redirect flashes the Devices skeleton unless the session check runs before data hooks.
- Nav hide is UX only; SIM-044 already restricts the API. Confirm `/api/members/[id]` for Users leaks nothing beyond the members list.
- R1: `src/ui/portal/**` imports only ui and lib; run `pnpm check:layers`. Sharing a hook from `src/ui/devices/` is allowed.
- R7/R4: no new routes or migrations.

## Open questions
1. OQ-54 / OQ-59 defaults confirmed? Does the portal badge replace the Devices badge for Managers too, or only for Users?
2. Keep My requests as a separate nav entry once My seat lists requests? Does mark-seen fire from the My seat tab?
3. Is `/api/members/[id]` + per-seat `/api/seats/[id]` acceptable, or a small `me/seats` endpoint (exception to "no new APIs")?
4. Manager/Admin owner actions on My devices: only move/place, transfer, return, extend, cancel, or also assign/edit-holding?
5. Split: one L ticket or SIM-045.1 / SIM-045.2?
6. Which existing `IconName` for the portal entry?

Key files: `src/lib/nav.ts`, `src/ui/AppShell.tsx`, `src/ui/AppShellView.tsx`, `src/ui/devices/DevicesPage.tsx`, `src/ui/devices/devices-api.ts`, `src/ui/devices/useDevices.ts`, `src/ui/devices/device-actions.ts`, `src/ui/org/profile-form.ts`, `src/ui/org/ProfileView.tsx`, `src/ui/requests/MyRequestsPage.tsx`, `src/ui/requests/ApprovalsPage.tsx`, `src/ui/search/search-state.ts`, `src/app/api/devices/mine/route.ts`, `src/app/api/me/route.ts`.
