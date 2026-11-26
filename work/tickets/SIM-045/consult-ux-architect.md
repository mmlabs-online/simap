# SIM-045 — consult: ux-architect (read-only)

Read: the ticket, spec POR-01..04 and D70, the SIM-044 plan, `src/lib/nav.ts`, `AppShell*.tsx`, `DevicesView.tsx`, `ProfileView.tsx`. Not read: page containers (`DevicesPage`, `MyRequestsPage`), hooks/API clients beyond their export lists.

## Findings
- **Nav and badges.** `NAV_ITEMS` / `NavId` in `src/lib/nav.ts` have no portal entry; `navItemsFor` filters by `minTier`. Badges wired in `src/ui/AppShell.tsx`: `{ myRequests: count, devices: badgeTotal(handoffs) }`. Labels from `shellCopy.badge.byNav[NavId]` (`src/ui/copy/shell.ts`) with a `badgeLabels.devices` override. `useRequestBadge` / `useHandoffBadge` take `pathname`; check whether they refresh only on navigation.
- **Rail vs 390 px.** Bottom bar below 1024 px (`flex-col-reverse lg:flex-row`). For Users, Devices leaves and Portal joins (count unchanged). Managers gain one (~8 entries on a 390 px bar); check overflow.
- **Building blocks.** `src/ui/devices/device-actions.ts` has `rowActions(...)` / `RowAction` (already tested). Reusable: `DeviceTable`, `DeviceRowActions`, `IncomingTransfers`, `OverdueBanner`, `bannerHandlers`. `DevicesView` is pure but hard-wires filter chips, "New device", the `/api/devices` list and the page title; My devices needs a new container with the same dialogs. `MyRequestsView` + `useMyRequests` reusable. `seats-api` has `release(seatId)` returning a `SeatDto` with `mine`. `ProfileView` is the first-visit form inside `AuthLayout` (sign-out button, `autoFocus`), not reusable as is; reuse `validateProfileName`, `profilePatchInit`, `mapPatchResult` (`profile-form.ts`) and `profileCopy`. `PATCH /api/me` returns the `GET /api/me` body.
- **Seat list gap.** No "my seats" endpoint found; `SeatDto.mine` is per seat; the ticket says no new APIs. Candidates: `GET /api/me`, search or member detail by own member id, members API. Without one, My seat cannot list occupied seats (a client-side room scan is not acceptable). Main plan blocker.
- **Session shape.** `Session` = `{ tier, email, orgName?, devToken? }`; no display name. Profile reads the name from `GET /api/me`; email and role from the session.
- **Deactivated member.** `AuthGate` handles `/api/me` decisions; the portal under `(app)` inherits the refusal.
- **Seat deep link.** `/rooms/<code>?seat=<seatCode>` via `seatResultHref` (`src/ui/search/search-state.ts`); reuse, don't hand-build.
- **SIM-044 items folded in.** AC6: Devices `minTier: "manager"`, `/devices` redirects Users client-side (`router.replace`, render nothing meanwhile), `/devices/[id]` stays. Rewrite `nav.test.ts` (l.7-22, l.57, l.113-117). Redirect target is My Portal, not `/`. Incoming-transfer confirm and handoff badge for Users land here.
- **Size.** Bigger than M (tab shell, My seat, My devices with paging + dialogs + incoming + banner, Profile, nav/redirect, badge rewiring).

## Recommendations
1. **Tabs (POR-01).** WAI-ARIA tablist (`role="tab"`, `aria-selected`, `aria-controls`, roving `tabIndex`; Left/Right, Home/End, automatic activation; panels `role="tabpanel"` + `aria-labelledby`). `?tab=seat|devices|profile` via `router.replace`. Pure `parsePortalTab(searchParams)` (exactly one value; unknown/repeated/missing → `seat`; mirror `search-state.ts` `getAll("q")`). Mount only the active panel. `useSearchParams` needs a Suspense boundary in `page.tsx` (Next 16). 390 px: equal-width tabs, 44 px targets, no horizontal scroll. Check `src/ui/` for an existing tab component; D52 tokens.
2. **Structure.** Thin `page.tsx`; `src/ui/portal/PortalPage.tsx` client container; pure `PortalView.tsx`; `MySeatTab`, `MyDevicesTab`, `ProfileTab` each with a `use*` hook and a pure view; `portal-state.ts` (tab parser, badge selector, empty-state decision); `src/ui/copy/portal.ts` (D36) plus `shellCopy.pages.portal` and `badge.byNav.portal`.
3. **My seat.** Resolve the seat-list source first (extend an existing response only if no migration/new endpoint; otherwise ask Ming for a small endpoint ticket). Release through a confirm dialog (reuse `ConfirmSeatDialog` if it fits); refresh seats and requests after. Cancel for pending requests only (reuse `MyRequestsView` row actions). Empty state (no seat, no request) links to `/rooms`.
4. **My devices.** Page `GET /api/devices/mine` with `nextCursor` + "Load more". Reuse `DeviceTable` + `rowActions`, `IncomingTransfers` (`/api/handoffs?box=incoming`) under "Waiting for my confirmation", `OverdueBanner` + `bannerHandlers`. Extract dialog wiring (Place, Transfer, Return, Extend, cancel handoff) from `DevicesPage` into a shared hook (`useDeviceOwnerActions`) so the pages don't drift. After an action reload `mine` and the handoff badge (`useSetHandoffBadge`).
5. **Profile.** Display name with `validateProfileName`, `PATCH /api/me` via `apiFetch`. Email and role read-only with "managed in mmlabs". Reuse `profileCopy`; new strings in `portal.ts`. No autofocus; focus the status message on save (`role="status"`). No photo/character placeholders.
6. **Nav and badge (OQ-59).** `portal` in `NavId` / `NAV_ITEMS`, `href: "/portal"`, `minTier: "user"`, icon e.g. `account_circle` (check `IconName` in `src/lib/icons.ts`). Users: request/transfer badge on Portal; Manager+: keep Approvals/Devices badges and add Portal (my overdue + incoming). Pure tested `portalBadge(tier, handoffs, requests, overdue)`. Keep `myRequests` for decision counts.
7. **Redirect.** `DevicesPage` redirects Users with `useEffect` + `router.replace("/portal")`; render nothing meanwhile. UX only (API enforces D69).
8. **Tests.** `portal-tab.test.ts`, badge test, action-visibility tests (extend `device-actions.test.ts`), `nav.test.ts` (user: no devices, has portal; manager: both); light view tests (tab keys, empty state, "Waiting" list).
9. **Split.** SIM-045 = shell + nav + redirect + My seat + Profile; SIM-045.1 = My devices (with the shared action hook). If one PR: order shell, nav, profile, seat, devices.

## Risks
- Seat list source (highest).
- Sequencing: hiding the Devices nav for Users before the portal's device actions work leaves no way to confirm transfers. Ship the nav hide and My devices in the same PR.
- Hotspot: `PlaceDeviceDialog.tsx`, `DevicesPage.tsx`, `place-device.ts` (SIM-048 area); extracting a shared hook widens the conflict surface.
- Bottom bar overflow for Manager/Admin at 390 px (Admin has audit, deviceTypes, mapItems too); check whether the bar scrolls.
- Badge refresh depends on `pathname`; portal actions must call `useSetHandoffBadge` / `useSetRequestBadge`.
- Release/Place dialogs may assume `DeviceRowHandlers` / `useDevices` state from the Devices page; small refactors (R4).
- Display name after save: nothing in `Session` to update; check whether any shell element shows the name.
- Unwrapped `useSearchParams` fails `pnpm build` in Next 16.

## Open questions
1. Source of "my seats": an existing response (`/api/me`, `members/[id]`) or a small API addition?
2. OQ-54 / OQ-59 defaults (Dashboard stays home; Users' badge moves to Portal; Manager+ keep theirs and also get Portal)?
3. Route `/portal`? (recommended)
4. One PR or split SIM-045 / SIM-045.1? (split recommended)
5. Manager/Admin: Devices badge and Portal badge for the same incoming transfer, or only one? Avoid double counting.
6. Redirect target for Users on `/devices`: `/portal?tab=devices` (suggested) or the default tab.

Key files: `src/lib/nav.ts`, `src/ui/AppShell.tsx`, `src/ui/AppShellView.tsx`, `src/ui/devices/DevicesView.tsx`, `src/ui/devices/device-actions.ts`, `src/ui/org/ProfileView.tsx`, `src/ui/org/profile-form.ts`, `src/ui/seats/seats-api.ts`, `work/tickets/SIM-044/plan.md`.
