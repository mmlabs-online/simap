Status: READY

# Plan — SIM-045: My Portal part 1: My seat, My devices, display name

This plan covers **slice A** only (see `## Split proposal`): the `/portal` page with tabs, the nav entry and badge,
the Devices nav hide + `/devices` redirect for Users, the **My devices** tab and the **Profile** tab. **My seat** is
slice B (SIM-045.1). The nav hide ships in the same PR as My devices, so a User never loses the incoming-transfer
screen (consult-ux-architect, Risks "Sequencing").

Gate: **none**. No file in this plan matches a High path in `.claude/loop.config.md` (no migrations, no
`src/server/**`, no `src/proxy.*`, no `**/config.*`, no `.env.example`).

## Scope summary
`docs/spec-v1.md`:
- D70 (l.546-548): "One page, "My Portal", for every tier, with three horizontal tabs: **My seat**, **My devices**,
  **Profile**. It shows only the caller's own data and reuses the existing APIs and components (seat detail, map view,
  requests, device actions, display name). Clean UI kit (D52); copy in `src/ui/copy/<feature>.ts` (D36)."
- POR-01 (l.551-555): "My Portal is in the nav for every tier (SHL-01). The three tabs are horizontal,
  keyboard-operable and addressable by URL (e.g. `?tab=seat|devices|profile`); the default tab is My seat. Works at
  390 px." / "Every tab reads only the caller's own member (token `sub` + `org`, R6); there is no way to open another
  member's portal." / "A member with no linked member record, or a deactivated member, gets the same refusal as other
  org pages."
- POR-03 (l.565-574): "Lists the devices the member holds, from the "my devices" endpoint (DEV-12): name, type,
  inventory number, placement (seat code and role, or "in my inventory"), expiry date and **Overdue** (DEV-10)." /
  "Per device, the owner actions that already exist: move / place at a seat or back to my inventory (DEV-03 to
  DEV-05), transfer to a member (DEV-08), return to the org inventory (DEV-09), request an extension (DEV-10), and
  cancel a pending handoff they started. Each action shows only when the rules allow it (e.g. none while a handoff is
  pending, except cancel)." / "A "Waiting for my confirmation" list shows transfers to the member (device name, type,
  inventory number, sender, note) with Confirm and Decline (DEV-08)." / "The overdue banner of DEV-10 shows here." /
  "Manager and Admin see their own devices here; the full org list stays on the Devices page (D70)."
- POR-04 (l.577-579): "The member edits their own display name (existing own-display-name API, D17; same
  validation)." / "Email and simap role are shown read-only with "managed in mmlabs" (AUT-04)." (Photo and character:
  SIM-046 / SIM-047, out of scope.)
- SHL-01 (l.651-653): "Pages: … Devices (Manager+, D69), Approvals (Manager+), My Portal (every tier, D70). The home
  page stays the Dashboard unless OQ-54 changes it. The device-count badge for Users: OQ-59."
- OQ-54 default (l.822-823): "the Dashboard stays the home page for every tier; My Portal is a nav entry."
- OQ-59 default (l.839-841): "Users have no Devices entry; the badge moves to the My Portal entry and counts transfers
  waiting for their confirmation plus their overdue devices. Manager+ keep the Devices badge (Admins: pending returns
  too) and get the same My Portal badge for their own items."
- Ticket AC6 (moved from SIM-044, `work/tickets/SIM-044/plan.md` Q1/Q2 defaults l.195-201): Devices nav entry hidden
  for Users, `/devices` redirects Users to My Portal client-side, `/devices/[id]` stays reachable for held devices.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | My Portal is in the nav for every tier; horizontal, keyboard-operable tabs (WAI-ARIA), addressable by `?tab=`; works at 390 px. **Slice A:** tabs My devices + Profile, default My devices. **Slice B** adds My seat as first and default tab. | `nav.test.ts › every tier has portal`; `portal-state.test.ts › parsePortalTab …`, `› portalTabHref …`, `› nextTabIndex …`; `PortalTabs.test.tsx › renders tablist/tab/tabpanel with roving tabIndex and aria links`. Local run (`pnpm dev`) at 390 px and desktop as User and Manager: Left/Right/Home/End move and activate tabs, URL changes to `/portal?tab=profile` and back, reload keeps the tab, no horizontal page scroll. |
| 2 | My seat (seats, View on map, requests with cancel, release, empty state). | **Slice B (SIM-045.1), not verified here.** |
| 3 | My devices lists held devices with placement, expiry and Overdue, offers only the actions the rules allow, shows "Waiting for my confirmation" with Confirm / Decline, and the overdue banner. | `portal-state.test.ts › portalHandlers keeps only owner actions`, `› rowActions with portal handlers: no edit/delete/takeBack/assign/editHolding even with flags true`, `› pending handoff: only cancel`; `MyDevicesView.test.tsx` (rows, empty, error + retry, load more, incoming slot, banner slot); `devices-api.test.ts › listMine …`. Local run as User and Manager: place/move, back to inventory, transfer, give back, extend, cancel each work from My devices; a transfer to the User shows under "Waiting for my confirmation" and Confirm/Decline work; badge updates at once. |
| 4 | Profile edits the display name with the existing validation; email and role are read-only ("managed in mmlabs"). | `ProfileTabView.test.tsx` (read-only email/role + "managed in mmlabs", no `autofocus`, field errors from `validateProfileName`); `portal-state.test.ts › profileOutcome …`. Local run: save a Vietnamese name with diacritics ("Nguyễn Thị Ánh"), reload, value persists; blank → "required" error; whitespace-only → required. |
| 5 | Only the caller's own data shows; a deactivated member gets the same refusal as other org pages. | Code review: portal calls only `/api/devices/mine`, `/api/handoffs?box=incoming`, `/api/handoffs/count`, `/api/me` (GET/PATCH) and the existing device action routes; no id read from the URL. `/portal` lives under `src/app/(app)/` (same `AuthGate` as other org pages). Local run: deactivate a test member (Admin), the member sees the existing deactivated screen on `/portal`. |
| 6 | Devices nav entry hidden for Users (`minTier: "manager"`); `/devices` redirects Users to `/portal?tab=devices` client-side without fetching the org list; `/devices/[id]` stays reachable for held devices. | `nav.test.ts › user has no devices; manager and admin have it`; `portal-state.test.ts › devicesPageRedirect: user → /portal?tab=devices, manager/admin → null`. Local run as User: open `/devices` → lands on My devices, Network tab shows no `GET /api/devices?placement=…`; open `/devices/<held id>` from a My devices row → detail page works. |
| 7 | Unit tests for the tab state / URL parsing, the per-device action rules and the badge count. | `pnpm test` green with the tests in `## Tests to write`. |
| — | Checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` (Suspense around `useSearchParams` is required for build). |

## Ming verification after merge
None (everything is checkable in a local run). Optional: a quick look at 390 px on a real phone.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/app/(app)/portal/page.tsx` | New thin page: `import { PortalPage } from "@/ui"; export default … <PortalPage />` (mirror `src/app/(app)/approvals/page.tsx` l.1-5). | AC1 | No |
| `src/ui/index.ts` | Export `PortalPage` next to l.31-33. | AC1 (pages import via the `@/ui` barrel) | No |
| `src/ui/portal/portal-state.ts` | Pure: `PORTAL_TABS = ["devices","profile"] as const` (slice B prepends `"seat"`), `PortalTab`, `DEFAULT_PORTAL_TAB = PORTAL_TABS[0]`, `parsePortalTab(values: string[])` (exactly one known value, else default; mirror `parseStatusParam`, `src/ui/requests/requests-state.ts` l.28-33), `portalTabHref(pathname, tab)` (default → bare pathname, else `?tab=`; mirror `statusHref` l.36-38), `tabId(tab)` / `panelId(tab)`, `nextTabIndex(key, current, count)` (ArrowLeft/ArrowRight wrap, Home, End, else null), `portalHandlers(h: DeviceRowHandlers)` (keeps only `onPlace`, `onTransfer`, `onReturn`, `onExtend`, `onCancelHandoff`), `portalBadgeTotal(c: HandoffCountDto) = c.incoming + c.overdue`, `devicesPageRedirect(tier)` (`"user"` → `"/portal?tab=devices"`, else null), `profileOutcome(out: PatchOutcome)` → `{ notice, fieldError }`. | AC1, AC3, AC4, AC6, AC7 | No |
| `src/ui/portal/portal-state.test.ts` | Unit tests (see below). | AC7, R5 | No |
| `src/ui/portal/PortalTabs.tsx` | Presentational WAI-ARIA tabs: `role="tablist"` + `aria-label`, buttons `role="tab"`, `id`, `aria-selected`, `aria-controls`, roving `tabIndex` (0 on active, -1 else), `onKeyDown` via `nextTabIndex` (automatic activation, focus follows). Equal-width tabs (`flex-1`), `min-h-11` (44 px), D52 tokens like the nav (`AppShellView.tsx` l.82-91). Props: `tabs`, `labels`, `active`, `onSelect`. | AC1 | No |
| `src/ui/portal/PortalTabs.test.tsx` | SSR markup test (pattern: `src/ui/devices/OverdueBanner.test.tsx` l.1-25). | AC1, AC7 | No |
| `src/ui/portal/PortalPage.tsx` | Client container. Exported `PortalPage` wraps `PortalLoaded` in `<Suspense>` with a skeleton (pattern `ApprovalsPage.tsx` l.137-155). `PortalLoaded`: `useSearchParams().getAll("tab")` → `parsePortalTab`; `<h1>` from `shellCopy.pages.portal.title`; `PortalTabs`; `onSelect` → `router.replace(portalTabHref(pathname, tab), { scroll: false })`; renders **only** the active panel (`role="tabpanel"`, `id=panelId`, `aria-labelledby=tabId`, `tabIndex={0}`): `MyDevicesTab` or `ProfileTab`. | AC1, AC5 | No |
| `src/ui/portal/useMyDevices.ts` | Hook: `GET /api/devices/mine` via `api.listMine(cursor?)`; state `ListState<DeviceDto>` + `appendPage` reused from `src/ui/requests/requests-state.ts` l.14-20, l.45-55; `reload()`, `loadMore()`, `refresh(): Promise<RefreshResult>` (refetch first page without skeleton, shape of `RefreshResult` in `src/ui/devices/useDeviceDetail.ts` l.12-13); stale answers dropped by counter (pattern `src/ui/devices/useDevices.ts` l.8-41). | AC3 | No |
| `src/ui/portal/MyDevicesView.tsx` | Pure view: `<h2>` "My devices" (ref, `tabIndex={-1}` for focus), notice (`role="status"` / `role="alert"`), `banner` and `incoming` slots, loading skeleton, error + Retry (`apiErrorMessage`), empty state, `DeviceTable` (`src/ui/devices/DeviceTable.tsx` l.22-30; its owner column already shows expiry and the Overdue chip, `device-labels.tsx` OwnerLabel l.35-60), "Load more" when `hasMore`. | AC3 | No |
| `src/ui/portal/MyDevicesView.test.tsx` | SSR tests. | AC3, AC7 | No |
| `src/ui/portal/MyDevicesTab.tsx` | Container. `createDevicesApi`, `createRoomsApi`, `createSeatsApi` from `useApiFetch` (as `DevicesPage.tsx` l.49-52); `useMyDevices`; `useHandoffList(api, "incoming", true)` (`useIncomingHandoffs.ts` l.12); **dialogs and row handlers from the existing `useDeviceDetailActions`** (`src/ui/devices/useDeviceDetailActions.tsx` l.29-43, returns `{ handlers, busyId, notice, dialogs }` l.161) with `refresh = myDevices.refresh`, `tier = session.tier`, `requestFocus` = My devices heading; row handlers = `portalHandlers(handlers)`. Incoming Confirm/Decline: one-at-a-time `act` with `confirmOutcome(r, item, "all")` / `declineOutcome` (`incoming-transfer.ts` l.31-50), then `incoming.refresh()` + `myDevices.refresh()` + `api.handoffCount()` → `useSetHandoffBadge()`, focus via `focusAfter` (same as `DevicesPage.tsx` l.121-148, incoming list only). `OverdueBanner` (props l.13-19) with `devices = items`, `truncated = nextCursor !== null`, `handlers = bannerHandlers(portalHandlers(handlers))`, `onShowAll` focuses the My devices heading. `IncomingTransfers` (props l.9-18) under the heading "Waiting for my confirmation". No PendingReturns / PendingExtensions (those stay on the Devices page for Manager+). | AC3, AC5 | No |
| `src/ui/portal/ProfileTab.tsx` | Container: on mount `apiFetch("/api/me")` → `readMeResult` (`@/lib/identity/flow`) for the current display name (error state + Retry on failure); save with `apiFetch("/api/me", profilePatchInit(name))` → `mapPatchResult` (`src/ui/org/profile-form.ts` l.17-43; pattern `AuthGate.tsx` l.541-568) → `profileOutcome`; email and tier from `useSession()` (`src/lib/session.ts` l.4). | AC4, AC5 | No |
| `src/ui/portal/ProfileTabView.tsx` | Pure form: label/`FilledInput` (`maxLength={DISPLAY_NAME_MAX}`, **no `autoFocus`**), hint/error markup as `ProfileView.tsx` l.54-83, `validateProfileName` on submit, Save button (disabled while saving), status message `role="status"`; read-only rows Email and Role (`shellCopy.tiers[tier]`) with "Managed in mmlabs". | AC4 | No |
| `src/ui/portal/ProfileTabView.test.tsx` | SSR tests. | AC4, AC7 | No |
| `src/ui/copy/portal.ts` | All new strings (D36): tab labels, tablist label, My devices heading/empty/load more/error retry, "Waiting for my confirmation", Profile labels, "Managed in mmlabs", saved/failed notices. | AC1, AC3, AC4 | No |
| `src/ui/copy/shell.ts` | `nav.portal: "My Portal"` (l.38-51, `satisfies Record<NavId,…>` forces it); `pages.portal: { title: "My Portal", empty: … }` (l.82-96); `badge.portalBreakdown(c)` (incoming + overdue parts, reuse `incomingTransfers` / `overdueDevices` l.11-25) and `byNav.portal` (l.77). | AC1, AC7 | No |
| `src/lib/nav.ts` | Add `"portal"` to `NavId` (l.4-16); add `{ id: "portal", href: "/portal", icon: "person", minTier: "user", placement: "rail" }` after `myRequests` (l.33); `devices` `minTier: "manager"` (l.31). | AC1, AC6 | No |
| `src/lib/nav.test.ts` | Update hard-coded id lists (l.7-24, l.57-59): user without `devices`, with `portal`; manager/admin with both. l.113-117: use `navItemsFor("manager")` for the Devices `isActive` case; add portal `isActive` case. | AC1, AC6, AC7 | No |
| `src/ui/AppShell.tsx` | `badges` gets `portal: portalBadgeTotal(handoffs)`; `badgeLabels` gets `portal: shellCopy.badge.portalBreakdown(handoffs)` (l.24-27). Devices badge unchanged (only rendered for Manager+ now). | AC1 (OQ-59) | No |
| `src/ui/AppShellView.test.tsx` | Add portal badge cases next to the badge tests (l.224-264): count and label render on the portal entry; a User has no Devices entry. | AC7 | No |
| `src/ui/devices/devices-api.ts` | Add `listMine(cursor?: string)` → `GET /api/devices/mine[?cursor=…]`, validates `{ items: array, nextCursor: string|null }` → `MyDevicesPage` (`src/lib/devices/types.ts` l.150); next to `list` (l.224-235). | AC3 | No |
| `src/ui/devices/devices-api.test.ts` | `listMine` path, cursor encoding, malformed body → `internal`, error code passthrough. | AC3, AC7 | No |
| `src/ui/devices/DevicesPage.tsx` | Rename the current body (l.47-432) to a non-exported `DevicesPageContent`; new exported `DevicesPage` reads `useSession()`, computes `devicesPageRedirect(session?.tier)`, and when non-null runs `useEffect(() => router.replace(target))` and renders `null`; `null` session also renders `null`; otherwise `<DevicesPageContent />`. No behaviour change for Manager+, no data hooks mount before the check. | AC6 | No |
| `src/ui/devices/useDeviceDetailActions.tsx` | Doc comment only (l.26-28): now also the dialog host of My Portal → My devices. No code change. | Accuracy of the reused hook's contract | No |

The implementer must not touch other files without recording why in `impl-log.md`. Explicitly **not** touched:
`src/server/**`, `src/app/api/**`, `db/**`, `DeviceDetailView.tsx` (its "Back to devices" link at l.90 keeps
`/devices`; Users pass through the redirect).

## Data model / migration
None.

## API contract
None (no new or changed endpoint). Endpoints consumed, all existing: `GET /api/devices/mine` (SIM-044,
`src/app/api/devices/mine/route.ts`, `limit`/`cursor` per `src/lib/validate/my-devices-query.ts`),
`GET /api/handoffs?box=incoming`, `GET /api/handoffs/count`, `POST /api/handoffs/:id/{confirm,decline,cancel}`,
the device action routes used by the existing dialogs, `GET /api/me`, `PATCH /api/me`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/ui/portal/portal-state.test.ts › parsePortalTab: [] → default; ["profile"] → profile; ["devices"] → devices; unknown, "", "Profile" (case) → default; repeated ["profile","profile"] and ["profile","devices"] → default` | AC1, AC7 |
| `portal-state.test.ts › portalTabHref: default tab → "/portal"; profile → "/portal?tab=profile"` | AC1 |
| `portal-state.test.ts › nextTabIndex: ArrowRight/ArrowLeft wrap at both ends; Home → 0; End → last; other keys → null; count 1 stays 0` | AC1 (keyboard) |
| `portal-state.test.ts › portalHandlers keeps only onPlace/onTransfer/onReturn/onExtend/onCancelHandoff` | AC3, AC7 |
| `portal-state.test.ts › rowActions(device with every can* true, mine, overdue false, no pending, portalHandlers(all)) has no edit/delete/takeBack/assign/editHolding key` (Admin/Manager flags) | AC3, AC7 |
| `portal-state.test.ts › pending transfer started by me (canCancel): only the cancel action; pending not cancellable: no actions` | AC3 (POR-03 "none while a handoff is pending, except cancel") |
| `portal-state.test.ts › overdue mine, no pending: extend and give back present` | AC3 (DEV-10) |
| `portal-state.test.ts › portalBadgeTotal = incoming + overdue; returns/extensions ignored; all zero → 0` | AC1 (OQ-59), AC7 |
| `portal-state.test.ts › devicesPageRedirect: user → "/portal?tab=devices"; manager, admin → null; undefined → null` | AC6 |
| `portal-state.test.ts › profileOutcome: saved → status notice; invalid → fieldError "invalid"; retry → error notice; access → error notice from apiErrorMessage` | AC4 |
| `src/ui/portal/PortalTabs.test.tsx › tablist label; one tab aria-selected=true with tabIndex 0, others -1; aria-controls = panel id; ids stable` | AC1 |
| `src/ui/portal/MyDevicesView.test.tsx › rows with Vietnamese names render name, type, inventory number, placement ("in my inventory" for none), expiry, Overdue chip` | AC3 |
| `MyDevicesView.test.tsx › empty state text; error shows alert + Retry; Load more only when hasMore; incoming and banner slots render above the list` | AC3 |
| `src/ui/portal/ProfileTabView.test.tsx › email and role shown read-only with "Managed in mmlabs"; input has no autofocus; required/invalid errors show with aria-invalid; saving disables the button` | AC4 |
| `src/ui/devices/devices-api.test.ts › listMine: GET /api/devices/mine; cursor is encoded; malformed body → internal; 4xx code passed through` | AC3 |
| `src/lib/nav.test.ts › user: dashboard, search, rooms, members, myRequests, portal (no devices); manager/admin include devices and portal; isActive portal on /portal` | AC1, AC6 |
| `src/ui/AppShellView.test.tsx › portal badge count and label render on My Portal` | AC1 |
| `src/ui/copy/shell portalBreakdown (in portal-state.test.ts or AppShellView.test.tsx) › 0, only incoming, only overdue, both` | AC1 |

## Approach
1. **Nav and copy.** `nav.ts` (portal entry, Devices `manager`), `shell.ts` (nav/pages/badge), update `nav.test.ts`.
2. **Pure state.** `portal-state.ts` + tests first (R5, rule 6).
3. **API client.** `devices-api.ts › listMine` + test.
4. **Tabs + page.** `PortalTabs`, `PortalPage` with Suspense, `page.tsx`, barrel export. Only the active panel mounts
   (Profile fetches no devices; My devices mounts only on its tab).
5. **My devices.** `useMyDevices`, `MyDevicesView`, `MyDevicesTab` reusing `useDeviceDetailActions` (dialogs:
   Transfer, Return, Extend, Place; TakeBack/Assign dialogs exist in the host but no handler opens them because
   `portalHandlers` drops those handlers), `IncomingTransfers`, `OverdueBanner`, `DeviceTable`. Reusing the
   detail-page host means **`DevicesPage` is not refactored** (lower regression risk than extracting a new hook).
6. **Profile.** `ProfileTab` + `ProfileTabView` reusing `profile-form.ts`.
7. **Badge.** `AppShell.tsx` portal badge + label; `AppShellView.test.tsx`.
8. **Redirect.** `DevicesPage` wrapper; check in a local run that no `/api/devices?placement=` request is sent as a User.
9. Run all checks.

Rules: **R1** `src/ui/portal/**` imports only ui and `@/lib/**`; the page imports `@/ui` only; `pnpm check:layers`.
**R3** no config. **R4** no server/API change; follow-ups go to `impl-log.md`. **R5** tests above. **R6** every call
is token-scoped on the server; the portal reads no member id from the URL. **R7** no route handler touched. **D36**
copy in `src/ui/copy/portal.ts` / `shell.ts`. Domain focus: Vietnamese diacritics in names (tests use them), expiry
dates come pre-computed from the server in UTC+7 (`overdue` flag), empty/null placement and holding, `nextCursor`
paging bounds (server default 50, max 100).

## Specialist input used
- frontend-developer 1 (shared hook): **adopted differently** — instead of extracting a new hook from `DevicesPage`,
  reuse the existing `useDeviceDetailActions` (already a one-device dialog host with handlers, busy, notice and badge
  refresh); avoids touching `DevicesPage` beyond the redirect.
- frontend-developer 2 (`listMine` client): adopted. Separate `useMyDevices` instead of a `source` flag on
  `useDevices` (different response shape: cursor paging, not `truncated`).
- frontend-developer 3, 4 (IncomingTransfers + `useHandoffList("incoming")`, no returns/extensions boxes): adopted.
- frontend-developer 5 (Manager+ owner handlers only, test Edit/Delete/TakeBack omitted): adopted as
  `portalHandlers`; also drops Assign/EditHolding (Question 4).
- frontend-developer 6 (render only the active panel), 7 (tests), 8 (deactivated via AuthGate; errors via
  `apiErrorMessage`): adopted.
- frontend-developer "No my seats endpoint" / Q3 and ux-architect "Seat list gap": resolved for slice B — compose
  `/api/me` → `/api/members/<me.member.id>` → `/api/seats/<id>`; no new API needed (see Split proposal).
- frontend-developer/ux-architect redirect (session check before data hooks, render nothing): adopted; target
  `/portal?tab=devices` (ux Q6 suggestion).
- ux-architect 1 (WAI-ARIA tabs, automatic activation, 44 px, equal width, Suspense): adopted.
- ux-architect 2 (structure: thin page, container, pure views, `portal-state.ts`): adopted.
- ux-architect 5 (no autofocus, status message, reuse `profileCopy` / `profile-form.ts`, not `ProfileView`): adopted.
- ux-architect 6 (portal badge; Manager+ keep Devices badge; `myRequests` stays): adopted per OQ-59 default.
- ux-architect 4 ("Load more" paging of `mine`): adopted.
- ux-architect 9 / frontend-developer 1 (split): adopted with a different cut — the nav hide must ship with My
  devices, so slice A = shell + nav/redirect + My devices + Profile, slice B = My seat.
- ux-architect "bottom bar overflow": checked, the bar already has `overflow-x-auto`
  (`AppShellView.tsx` l.72); no change.
- frontend-developer Q6 (icon): `person` (already in `src/lib/icons.ts` l.29), no new glyph.

## Assumptions
- No other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` (board 2026-11-26), so no rebase hotspot. SIM-044.1
  (BLOCKED) will touch `src/server/members/manage.ts` / seats server code, not files in this plan.
- The `mine` list after an action reloads from the first page (refresh); later pages loaded with "Load more" are
  dropped then. Acceptable for a personal list (default page 50).
- The overdue banner reads overdue devices from the loaded `mine` pages; a User with overdue devices beyond page one
  still sees the count in the nav badge (`/api/handoffs/count` is total).
- In slice A the default tab is My devices (the only device-related screen Users need now); slice B makes My seat
  first and default, as POR-01 requires.
- `/devices/[id]` for Users: no nav entry is highlighted there (Devices hidden, `isActive` is prefix-based); accepted.
- Display name after save: nothing in `Session` or the shell shows it, so no shell update is needed.
- Admin on My devices sees their own devices through the same `mine` endpoint; Admin-only actions stay on the
  Devices page.

## Questions for Ming
Non-blocking: the implementer follows the default if Ming just approves.
1. **Split.** Default: slice A (this plan) now, slice B SIM-045.1 "My Portal: My seat tab" next (see below).
2. **Badge (OQ-59).** Default: My Portal badge = transfers waiting for me + my overdue devices, for every tier;
   Manager+ keep the Devices badge unchanged (it also counts their own incoming/overdue, so those show on both
   entries). Alternative: Manager+ Devices badge counts only returns + extensions.
3. **Redirect target for Users on `/devices`.** Default: `/portal?tab=devices`.
4. **Manager/Admin actions in My devices.** Default: only owner actions (place/move, back to inventory, transfer,
   give back, extend, cancel). Edit holding, take back, edit, delete stay on the Devices page.
5. **Nav icon.** Default: `person`.
6. **Slice B, My requests.** Default: the "My requests" nav entry stays; the My seat tab lists requests with Cancel but
   does **not** mark decisions as seen (the badge stays owned by `/requests`).
7. **Slice B, seat source.** Default: compose existing endpoints (`/api/me` → `/api/members/<own id>` →
   `/api/seats/<id>` per seat); no new API. Alternative: a small `GET /api/me/seats` (a new API, against the ticket's
   out-of-scope line).

## Blocking questions
None.

## Split proposal
Estimated full ticket: about 900 product lines + 600 test lines; slice A alone is about 550 product + 350 test lines,
above the ~400 guide but not separable further without shipping the nav hide before My devices or a one-tab page.
- **Slice A, SIM-045 (this plan):** AC1 (with tabs My devices + Profile), AC3, AC4, AC5, AC6, AC7 (tab parsing,
  action rules, badge).
- **Slice B, SIM-045.1 "My Portal: My seat tab" (S/M, ui, gate none, depends on SIM-045):** AC2 and the POR-01
  default tab. Design for its planner:
  - `PORTAL_TABS` becomes `["seat","devices","profile"]` (default `seat`), tests updated.
  - `useMySeats`: `GET /api/me` → `member.id` → `GET /api/members/<id>` (`seats: {id, code}[]`, cap 500,
    `src/server/members/manage.ts` l.117-119) → `GET /api/seats/<id>` in parallel via `seatsApi.get`
    (`src/ui/seats/seats-api.ts` l.91) for `roomCode`, `group`, `project`, `mine`. A 404 on `/api/members/<id>` is an
    error state; a seat 404 (released elsewhere) drops the row and reloads. R6: the id comes only from `/api/me`.
  - "View on map": `seatResultHref({ roomCode, code })` (`src/ui/search/search-state.ts` l.160-163), hidden when null.
  - Release: `ConfirmSeatDialog` (`src/ui/seats/ConfirmSeatDialog.tsx`) with `seatsCopy.actions.releaseTitle/Body/
    Submit`, `seatsApi.release` (l.109-110), `canRelease` and `actionOutcome("release", …)`
    (`src/ui/seats/seat-actions.ts` l.191, l.229, l.311-315); refresh seats and requests after.
  - Requests: `useMyRequests` + `MyRequestsView` with a new optional prop that renders an `<h2>` and no page padding
    (`MyRequestsView.tsx` l.40-41), no mark-seen (Question 6); Cancel via `requests-state.ts › cancelOutcome`.
  - Empty state (no seat, no request) links to `/rooms`.
- Alternative if Ming prefers one PR: implement slice B here too (about 1,500 changed lines, L).
