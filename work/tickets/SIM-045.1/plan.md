Status: READY

# Plan — SIM-045.1: My Portal: My seat tab

Slice B of SIM-045 (design in `work/tickets/SIM-045/plan.md` → "Split proposal"). Slice A is merged: `src/ui/portal/**`
exists (`PortalPage`, `PortalTabs`, `portal-state.ts`, `MyDevicesTab`, `ProfileTab`, tests). This ticket adds the My seat
tab and makes it the first and default tab. UI only, no API, no migration.

Gate: **none**. No file below matches a High path in `.claude/loop.config.md`.

Local env for the implementer: Node/pnpm are not on PATH. In PowerShell:
`$fnm = Get-ChildItem "C:\Users\ttngo\AppData\Local\Microsoft\WinGet\Packages\Schniz.fnm_Microsoft.Winget.Source_8wekyb3d8bbwe" -Filter fnm.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName; & $fnm env --shell powershell | Out-String | Invoke-Expression; & $fnm use 22`
then `cmd /c "pnpm ..."`. Local Postgres (only for a manual run): `docker compose -f compose.dev.yml up -d`,
`DATABASE_URL=postgres://simap@127.0.0.1:5432/simap`; `pnpm seed:dev` for fake data.

## Scope summary
- D70 (`docs/spec-v1.md` l.546-548): "One page, "My Portal", for every tier, with three horizontal tabs: **My seat**,
  **My devices**, **Profile**. It shows only the caller's own data and reuses the existing APIs and components (seat
  detail, map view, requests, device actions, display name)."
- POR-01 (l.551-555): "the default tab is My seat" / "Every tab reads only the caller's own member (token `sub` + `org`,
  R6); there is no way to open another member's portal."
- POR-02: My seat (seats the member occupies with room and tags, "View on map", requests with cancel, release, empty
  state) as carried by the ticket scope: "`useMySeats`: `/api/me` → `/api/members/<me.id>` → `/api/seats/<id>` per seat
  (no new API; id only from `/api/me`, R6)." / "'View on map' via `seatResultHref`; release through
  `ConfirmSeatDialog`; my requests with cancel (no mark-seen)." / "Empty state links to `/rooms`."
- SIM-045 plan Questions 6 and 7 (defaults, accepted by approving SIM-045): requests list has Cancel but does not mark
  decisions as seen; seat source composes existing endpoints.

## Acceptance criteria → verification
| # | Criterion (ticket) | How the reviewer verifies it |
|---|---|---|
| 1 | The default tab is My seat; tabs are My seat, My devices, Profile (URL `?tab=`). | `portal-state.test.ts › PORTAL_TABS order and default`, `› parsePortalTab …`, `› portalTabHref: seat → "/portal", devices → "/portal?tab=devices"`; `PortalTabs.test.tsx › three tabs`. Local run: `/portal` opens My seat; `/portal?tab=devices` and `?tab=profile` open those; Left/Right/Home/End cycle through three tabs. |
| 2 | My seat lists every seat the member occupies with room and tags, and "View on map" opens `/rooms/<code>?seat=<seat>`. | `my-seat-state.test.ts › composeMySeats …`, `› seatMapHref`; `MySeatView.test.tsx › row shows seat code, room code, group and project, "View on map" href`. Local run: User with 2 seats sees both; the link opens the room with the seat selected. |
| 3 | Pending requests can be cancelled; release asks for confirmation and refreshes seats and requests. | `MySeatView.test.tsx › Cancel only on pending rows`; `my-seat-state.test.ts › releaseResult`, `› cancel notice via cancelOutcome (existing)`. Local run: Release opens `ConfirmSeatDialog` (Cancel focused first), confirming removes the row and reloads requests; cancel a pending request, row turns Cancelled. |
| 4 | With no seat and no request, an empty state links to Rooms. | `my-seat-state.test.ts › mySeatPhase: no seats and no requests → "empty"`; `MySeatView.test.tsx › empty state has a link to /rooms`. |
| 5 | A seat that disappears (released elsewhere) drops from the list on reload; an error on `/api/members/<id>` shows an error state. | `my-seat-state.test.ts › composeMySeats: seat not_found → dropped; seat now not mine → dropped; other seat error → error`, `› member error → error`; `MySeatView.test.tsx › error alert and Retry`. Local run: release the seat in another tab, reload, row gone. |
| 6 | Unit tests for the seat-list composition, empty-state decision and tab defaults. | `pnpm test` green with the tests in `## Tests to write`. |
| — | Checks | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
None (all checkable locally).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/portal/portal-state.ts` | l.8: `PORTAL_TABS = ["seat","devices","profile"] as const` (default is index 0 = `seat`). Nothing else changes (`devicesPageRedirect` keeps `"/portal?tab=devices"`, now a non-default URL, still valid). | AC1 | No |
| `src/ui/portal/portal-state.test.ts` | Update l.~60-70 (`parsePortalTab`, `portalTabHref` use `devices` as default today) and any `nextTabIndex` count assumptions; add tab-default tests. | AC1, AC6 | No |
| `src/ui/portal/PortalTabs.test.tsx` | Adjust expectations to three tabs (first selected by default). | AC1 | No |
| `src/ui/portal/PortalPage.tsx` | l.26: render `MySeatTab` for `seat`, `MyDevicesTab` for `devices`, else `ProfileTab` (only the active panel mounts). | AC1 | No |
| `src/ui/portal/my-seat-state.ts` | New, pure (see below): `meMemberId`, `composeMySeats`, `seatMapHref`, `mySeatPhase`, `releaseResult`. | AC2-AC6, rule 6 | No |
| `src/ui/portal/my-seat-state.test.ts` | New unit tests. | AC6, R5 | No |
| `src/ui/portal/useMySeats.ts` | New hook: `reload()` runs `apiFetch("/api/me")` → `meMemberId(body)` → `membersApi.get(id)` → `Promise.all(seats.map(s => seatsApi.get(s.id)))` → `composeMySeats`. State `{status: "loading"\|"error"\|"ready", seats: SeatDto[], errorCode}`; stale answers dropped by a counter and `mounted` ref (pattern `src/ui/requests/useMyRequests.ts` l.20-57); `refresh()` refetches without the skeleton. | AC2, AC5 | No |
| `src/ui/portal/MySeatView.tsx` | New pure view: `<h2>` "My seat" (ref, `tabIndex={-1}`); notice (`role="status"`/`"alert"`); loading skeleton; error + Retry; seats list (`<ul aria-label>`, per row: seat code + room code, status-free, group and project tags (`seatsCopy.panel` labels style, `SeatDetailPanel.tsx` l.95-102), "View on map" link `<a>`/`next/link` to `seatMapHref`, "Release seat" button `min-h-11`); empty-seats line with link to `/rooms`; the `requests` slot (children) below. | AC2, AC3, AC4 | No |
| `src/ui/portal/MySeatView.test.tsx` | New SSR tests (pattern `OverdueBanner.test.tsx` l.1-25). | AC6, R5 | No |
| `src/ui/portal/MySeatTab.tsx` | New container. `createSeatsApi`, `createMembersApi`, `createRequestsApi` from `useApiFetch`; `useMySeats`; `useMyRequests(requestsApi)` **without** `onPage`, so mark-seen is never called and the nav badge stays owned by `/requests`; `ConfirmSeatDialog` for release (`seatsCopy.actions.releaseTitle(code)/releaseBody/releaseSubmit`, `submitting` flag, one action at a time via a `busy` ref); release = `seatsApi.release(seat.id)` → map to `ActionResult` via `releaseResult` → `actionOutcome("release", r)` (`seat-actions.ts` l.229, l.311-315); on success or `reload: true`: `await Promise.all([mySeats.refresh(), requests.reload()])`, close dialog, show notice (`message` or "Seat released."), focus the h2. Requests: `MyRequestsView` with `embedded`, `onCancel` as in `MyRequestsPage.tsx` l.48-56 (`cancelOutcome`, `list.reload()`), `newIds={new Set()}`. Also reload requests after a release (release can change nothing in requests, but AC3 asks to refresh both). | AC2-AC5 | No |
| `src/ui/requests/MyRequestsView.tsx` | Optional prop `embedded?: boolean`: renders `<h2>` (`portalCopy.seat.requestsHeading`, passed as `heading?: string` to keep requests copy out of portal) instead of `<h1>`, and drops `p-4 lg:p-6` (l.40-41). Default behaviour unchanged. | Ticket technical notes | No |
| `src/ui/requests/MyRequestsView.test.tsx` (create or extend if present) | Default renders `<h1>` with padding; embedded renders `<h2>` with heading and no padding. | R5 | No |
| `src/ui/copy/portal.ts` | `tabs.seat: "My seat"`; `seat: { heading, empty, emptyLink, noSeats, viewOnMap, release, released, loadFailed, retry, requestsHeading, seatLine }` (D36). | AC1-AC4 | No |

The implementer must not touch other files without recording why in `impl-log.md`. Explicitly **not** touched:
`src/server/**`, `src/app/api/**`, `src/lib/identity/flow.ts` (see Assumption 2), `src/ui/seats/**` (reused as is),
`src/ui/requests/MyRequestsPage.tsx`, `AppShell*`, `nav.ts`.

### `my-seat-state.ts` contract (all pure, tests first)
- `meMemberId(body: unknown): string | null` — `body.member.id` if a non-empty string, else null (R6: the only source
  of the id). Needed because `readMeResult` drops `member.id` (`src/lib/identity/flow.ts` l.114-121) although
  `GET /api/me` returns it (`src/server/members/members.ts` l.28-33).
- `composeMySeats(refs: MemberSeatRef[], results: SeatsResult<SeatDto>[])` →
  `{ ok: true; seats: SeatDto[] } | { ok: false; code: string }`. Rules: result `not_found` → row dropped; `ok` but
  `seat.mine === false` (reassigned meanwhile) → dropped; any other failure → `{ ok: false, code }` (whole tab errors,
  fail closed); order = member `seats` order sorted by room code then seat code (stable, `localeCompare`).
- `seatMapHref(seat: Pick<SeatDto,"roomCode"|"code">): string | null` = `seatResultHref` (`search-state.ts` l.160-163);
  `null` hides the link.
- `mySeatPhase(seatsState, requestsState)` → `"loading" | "error" | "empty" | "content"`; `empty` only when both are
  ready, no seat and no request; a failing requests list does not hide the seats (the requests section shows its own
  error + Retry).
- `releaseResult(r: SeatsResult<SeatDto>): ActionResult`.

## Data model / migration
None.

## API contract
None. Consumed, all existing: `GET /api/me` (`{ member: { id, … } }`, `src/app/api/me/route.ts`), `GET /api/members/:id`
(`withAuth tier:"user"`; `seats: {id, code}[]`, `src/app/api/members/[id]/route.ts`), `GET /api/seats/:id`,
`POST /api/seats/:id/release`, `GET /api/requests/mine`, request cancel (`createRequestsApi`).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `portal-state.test.ts › PORTAL_TABS is seat, devices, profile; DEFAULT_PORTAL_TAB is "seat"` | AC1, AC6 |
| `portal-state.test.ts › parsePortalTab: [] → "seat"; ["devices"], ["profile"], ["seat"] kept; unknown, "", "Seat", duplicates → "seat"` | AC1 |
| `portal-state.test.ts › portalTabHref: seat → "/portal"; devices → "/portal?tab=devices"; profile → "/portal?tab=profile"` | AC1 |
| `portal-state.test.ts › nextTabIndex wraps across three tabs` (existing, count 3) | AC1 |
| `my-seat-state.test.ts › meMemberId: valid body → id; missing member, empty id, non-string, null body → null` | AC5, R6 |
| `my-seat-state.test.ts › composeMySeats: two seats in two rooms → sorted by room then seat code, Vietnamese tag names intact ("Nhóm Hạ Tầng")` | AC2 |
| `my-seat-state.test.ts › composeMySeats: seat not_found dropped; ok but mine=false dropped; zero refs → ok with []` | AC5 |
| `my-seat-state.test.ts › composeMySeats: internal/forbidden on one seat → ok:false with that code` | AC5 |
| `my-seat-state.test.ts › seatMapHref: "/rooms/<code>?seat=<seat>"; room code needing encoding is encoded; null for an unusable room code` | AC2 |
| `my-seat-state.test.ts › mySeatPhase: loading; error; empty only when both ready and empty; seats only → content; requests only → content; requests error + seats ready → content` | AC4, AC6 |
| `my-seat-state.test.ts › releaseResult: ok → {ok:true}; failure keeps code` and `actionOutcome("release") not_allowed → releaseChanged message, reload` | AC3 |
| `MySeatView.test.tsx › rows: seat code, room code, group, project, View on map href, Release button` | AC2, AC3 |
| `MySeatView.test.tsx › no group/project renders the "no tag" text; null map href hides the link` | AC2 |
| `MySeatView.test.tsx › empty state has link to /rooms; loading is aria-busy; error alert + Retry` | AC4, AC5 |
| `MyRequestsView.test.tsx › embedded: h2, heading prop, no page padding; default unchanged` | Ticket notes |
| `PortalTabs.test.tsx › three tabs, first aria-selected by default, aria-controls = panelId` | AC1 |

## Approach
1. `portal-state.ts` tab list + updated tests (tab defaults first, R5).
2. `my-seat-state.ts` + tests (rule 6: pure logic first).
3. Copy (`portal.ts`), then `MyRequestsView` `embedded`/`heading` props + test.
4. `useMySeats`, `MySeatView` (+ test), `MySeatTab`, wire into `PortalPage`.
5. Run all checks; manual run as User with 0, 1, 2 seats, release, cancel a request, 390 px width.
Rules: R1 `src/ui/portal/**` imports ui and `@/lib/**` only (`@/lib/seats/types`, `@/lib/members/types`);
R3 no config; R4 stay in this list, extras go to `impl-log.md`; R6 member id only from `/api/me`, all calls are
token-scoped on the server; R7 no route handler touched; D36 all copy in `src/ui/copy/portal.ts` (existing
`seatsCopy`/`requestsCopy` strings reused). Domain focus: Vietnamese diacritics in tag names and display text; seat
list capped at 500 by the server (no paging needed); N+1 `GET /api/seats/:id` for few seats (typical 0-3) is accepted;
null group/project/room handled.

## Specialist input used
None (Size S, Gate none, fast lane skips consult). The SIM-045 consults (frontend-developer, ux-architect) were
already folded into SIM-045's "Split proposal", which this plan follows.

## Assumptions
1. **Hotspot with SIM-044.1** (IN_PROGRESS in another session): it edits `src/server/seats/**`, `src/server/members/manage.ts`,
   `layout`, `src/ui/members/MembersView.test.tsx`, `src/ui/seats/SeatDetailPanel(.test).tsx` and their route tests. This
   plan touches **none** of those, so no textual overlap and no rebase expected. Behavioural coupling only: my seat reads
   `SeatDto` (id, code, roomCode, mine, group, project) and `MemberDto.seats`; SIM-044.1 changes only `devices`
   / `deviceCount` for Users and keeps `seats`/`seatCount` of members (its AC3 test "B ... seatCount 1, seats [ref]"),
   so My seat works before and after it. My seat shows no device data.
2. `readMeResult` is **not** extended (it is shared by `AuthGate` and `DevGate`); `useMySeats` parses `member.id`
   itself with `meMemberId`. The ticket's `<me.id>` means `/api/me` → `member.id`.
3. Any non-404 failure on a single seat fails the whole seat list (error + Retry) rather than showing partial data.
4. A seat answering `mine: false` (reassigned) is dropped like a 404.
5. Request list is shown in full as the existing My requests does (newest first, "Load more"), including decided
   ones; decisions are not marked seen here, so the "My requests" nav badge keeps counting until `/requests` is opened.
6. After a release, the dialog closes and the notice "Seat released." shows; if the release fails with `not_allowed`
   the existing `releaseChanged` message shows and both lists reload.
7. `SeatsPage` `?seat=` deep link already opens the seat (used by search results today).
8. Other open tickets: SIM-046/SIM-047 are BACKLOG (will edit `PortalPage.tsx`/`ProfileTab` later, not now).

## Questions for Ming (non-blocking, approve = accept the defaults)
1. `member.id` read from `/api/me` in a new small parser, no change to shared `flow.ts` (default) vs. extending `readMeResult`.
2. Any seat load error other than 404 shows the whole tab as an error with Retry (default).
3. Requests list shows all statuses with Cancel on pending only; no mark-seen (default, SIM-045 Q6).

## Blocking questions
None.

## Split proposal
None. Estimated about 350 product + 300 test lines, one cycle.
