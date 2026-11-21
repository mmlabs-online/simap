Status: READY

# Plan — SIM-019.2: Audit-log page UI for org admins

Slice B of the approved SIM-019 plan (`work/tickets/SIM-019/plan.md`, approved 2026-11-20, batch 2026-11-20-3). Slice A
(`/api/audit`, `/api/audit/facets`, `src/lib/audit/{types,cursor}.ts`) is already on `main`. SIM-006.2 (apiFetch,
`useApiFetch`) and SIM-022 (copy convention, `src/ui/copy/*`, `no-literals.test.ts`) are on `main`. I re-checked the
codebase: the approved Slice B table is reused, with two corrections (see "Changes vs the SIM-019 Slice B table").

## Scope summary
Ticket: "Org admins browse and filter the audit log on an Audit page." Scope: "Everything listed under Slice B in
`work/tickets/SIM-019/plan.md` (Audit page, nav entry for admins, `src/ui/copy/audit.ts`, UTC+7 day-range helper,
`history` icon), calling `/api/audit` and `/api/audit/facets` through SIM-006.2's apiFetch." Out of scope: "Export
(SIM-018)."

Spec SYS-03 (`docs/spec-v1.md` 422-427): "Admins of the org see an audit-log screen: newest first, filter by actor,
entity type and date range, paginated (D28)." D35: "stored in UTC, shown in Asia/Ho_Chi_Minh (UTC+7) for every org in
v1". D52: "Management screens (members, devices, approvals, groups/projects, audit log, ...) use the clean UI kit without
pixel art. Body text, tables and forms never use a pixel font." D36: UI copy in English in `src/ui/copy/<feature>.ts`.
R1: UI never imports server code. R6 holds server-side already (Slice A).

### Changes vs the SIM-019 Slice B table (code on `main` moved on)
1. `AuditView` does **not** take `fetcher`. The repo pattern (`RoomsPage` / `RoomsView`) is: a client `AuditPage` calls
   `useApiFetch()` and `useSession()`, a pure `AuditView` renders from props. The page wrapper imports `AuditPage` from
   `@/ui`.
2. `src/ui/AppShellView.tsx` needs no edit: it renders the rail from `navItemsFor(session.tier)` and labels from
   `shellCopy.nav[item.id]`. This keeps the plan off SIM-007.2's hotspot files (`AuthGate.tsx`, `views.tsx`,
   `AppShellView.tsx`, `flow.ts`): none of them is touched.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | "Only Admins can open the page" (SIM-019 criterion 1, page half) | `src/ui/audit/AuditView.test.tsx` › "forbidden status shows the no-access message and no table or filters"; `src/ui/audit/audit-state.test.ts` › "canViewAudit: admin true, manager/user/no session false"; `src/lib/nav.test.ts` › "audit is admin only". No-request guarantee: `AuditPage` mounts the data hook only in the admin branch (code review point: hook lives in `AuditLoaded`, rendered only when `canViewAudit`). |
| 2 | Newest first, filter by actor, entity type, date range, paginated (SYS-03) | `AuditView.test.tsx` › "renders rows in the given order", "filters render with facet options"; `audit-api.test.ts` › "list builds the query from filter and cursor"; `audit-state.test.ts` › "load more appends and keeps filters", "changing a filter resets the list and cursor". |
| 3 | Dates are UTC+7 (D35) | `src/lib/audit/day-range.test.ts` (cases below); `AuditView.test.tsx` › "times render in Asia/Ho_Chi_Minh" (a `...T17:30:00.000000Z` row shows 00:30 next day). |
| 4 | Actor display names, null-safe | `AuditView.test.tsx` › "Vietnamese display name renders intact", "null displayName shows Unknown member plus first 8 chars of sub". |
| 5 | Loading / empty / error states, no HTML injection from `meta` | `AuditView.test.tsx` › "loading shows aria-busy", "empty shows empty text", "error shows apiErrorMessage with retry", "meta renders as text, a `<script>` string is escaped". |
| 6 | Copy convention (SIM-022), clean UI kit | `no-literals.test.ts`, `copy.test.ts` pass unchanged; no pixel font class used (review by reading `AuditView.tsx`). |
| 7 | All loop checks green | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. |

## Ming verification after merge
- Sign in as Admin, change a room (creates an audit row), open Audit from the nav, confirm the new row, actor display
  name, filters (actor, entity, from/to) and "Load more". Sign in as Manager and User: no Audit nav entry; opening
  `/audit` directly shows the no-access message.
- Visual check of the table on a narrow (mobile) width.

## Files to create / modify
No file matches a High path (`loop.config.md`): all are `src/lib/**`, `src/ui/**`, `src/app/(app)/**`. Predicted tier: Medium.
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/nav.ts` | `NavId` adds `"audit"`; item `{id:"audit", href:"/audit", icon:"history", minTier:"admin", placement:"rail"}` appended after `approvals` (before `roomEditor`, so it is last in the rail) | Admin-only nav entry | No |
| `src/lib/nav.test.ts` | admin total 6 -> 7, admin rail ends with `audit`, new "audit is admin only" test | Nav tests pin the lists (lines 13-27) | No |
| `src/lib/icons.ts` | add `"history"` after `"group"` (alphabetical; `icons.test.ts` enforces sorted) | `Icon` only accepts listed names | No |
| `src/ui/copy/shell.ts` | `nav.audit: "Audit log"`, `pages.audit: { title: "Audit log", empty: "No audit entries yet." }` | `nav` is `satisfies Record<NavId,string>` (line 16) | No |
| `src/ui/copy/audit.ts` (new) | page strings, filter labels, column headers, no-access / empty-after-filter text, "Load more", "Unknown member", action label map (`room.create` "Created a room", `room.update` "Updated a room", `room.delete` "Deleted a room"), `actionLabel(action)` falling back to the raw action | D36; `copy.test.ts` globs `./*.ts` so it is checked automatically | No |
| `src/lib/audit/day-range.ts` (new) | `dayRangeToInstants(fromDay?: string, toDay?: string)`: `YYYY-MM-DD` calendar days in UTC+7 -> `{from?, to?}` UTC `...Z` instants; `from` = start of that day, `to` = start of the day after the "to" day (exclusive); invalid day string -> `null` | D35; Slice A API takes UTC instants (A3) | No |
| `src/lib/audit/day-range.test.ts` (new) | tests below | R5 | No |
| `src/ui/audit/audit-api.ts` (new) | `createAuditApi(fetcher: ApiFetch)` -> `list(filter, cursor?)`, `facets()`; builds the query string; resolves to `{ok,value}` / `{ok:false,code}`, never throws; same shape as `src/ui/rooms/rooms-api.ts` lines 1-47 | Isolates `apiFetch`, mirrors rooms | No |
| `src/ui/audit/audit-api.test.ts` (new) | tests below | R5 | No |
| `src/ui/audit/audit-state.ts` (new) | pure: `canViewAudit(tier)`, filter state type, `toApiFilter(state)` (uses `dayRangeToInstants`), `formatAuditTime(at)`, `actorLabel(actor)`, `metaEntries(meta)` | Logic out of components, unit tested (no DOM test lib in the repo; views are tested with `renderToStaticMarkup`) | No |
| `src/ui/audit/audit-state.test.ts` (new) | tests below | R5 | No |
| `src/ui/audit/useAudit.ts` (new) | client hook: loads facets once; loads list on filter change (stale responses dropped, same pattern as `useRooms.ts`); `loadMore` appends with `nextCursor`; exposes `status`, `items`, `hasMore`, `loadingMore`, `errorCode`, `reload` | Data loading | No |
| `src/ui/audit/AuditView.tsx` (new) | pure view: heading, filters (actor `<select>`, entity `<select>`, from/to `type="date"` inputs, reset), table (When, Who, Action, Entity, Details), "Load more", loading/empty/error/forbidden states; reuses `Card`, `Button`, `DialogSelect` / `DialogField` styling; no pixel font (D52) | The screen | No |
| `src/ui/audit/AuditView.test.tsx` (new) | `renderToStaticMarkup` tests below | R5 | No |
| `src/ui/audit/AuditPage.tsx` (new) | `"use client"`: `useSession()` + `canViewAudit`; non-admin -> `<AuditView status="forbidden" …/>` without mounting the hook; admin -> `AuditLoaded` (calls `useApiFetch`, `createAuditApi`, `useAudit`) | Page glue, like `RoomsPage.tsx` | No |
| `src/app/(app)/audit/page.tsx` (new) | `export default function Page() { return <AuditPage />; }` | Route, like `src/app/(app)/rooms/page.tsx` | No |
| `src/ui/index.ts` | add `export { AuditPage } from "./audit/AuditPage";` (one line at the end; **rebase hotspot**, see Assumptions) | Convention, page imports from `@/ui` | No |

Estimated change: about 450-550 lines including tests. Over the ~400 guide, but one coherent UI slice that Ming already
approved as "S"; no further split proposed (see Split proposal).

## Data model / migration
None.

## API contract
None (consumes the existing `GET /api/audit` and `GET /api/audit/facets` from SIM-019, unchanged).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/audit/day-range.test.ts` › "from day starts at 00:00 UTC+7 (2026-03-05 -> 2026-03-04T17:00:00.000Z)" | D35 boundary |
| › "to day is exclusive: the start of the next day in UTC+7 (2026-03-05 -> 2026-03-05T17:00:00.000Z)" | Exclusive end |
| › "month and year rollover (2026-12-31 as to -> 2026-12-31T17:00:00.000Z; 2026-03-01 as from -> 2026-02-28T17:00:00.000Z; 2028-02-29 leap day to -> 2028-02-29T17:00:00.000Z)" | Calendar edges |
| › "absent or empty day -> key omitted" | Optional filters |
| › "invalid day ('2026-02-30', 'abc', '2026-3-5') -> null" | Boundary validation |
| › "from later than to -> null (so the API is never sent from >= to)" | Range |
| `src/ui/audit/audit-api.test.ts` › "list sends actor, entity, from, to, limit, cursor as query params, omits blanks" | Query build (uses an injected fetch stub) |
| › "list returns {ok, items, nextCursor} on 200" | Happy path |
| › "403 / 401 / 400 error bodies map to the error code; malformed body -> internal" | Error codes |
| › "ApiAccessError signed_out -> unauthenticated; other thrown error -> unavailable" | Mirrors rooms-api |
| › "facets returns actors and entities; wrong shape -> internal" | Facets |
| › "actor value with special characters is URL-encoded" | Encoding |
| `src/ui/audit/audit-state.test.ts` › "canViewAudit: admin true; manager, user, null session false" | Criterion 1 |
| › "toApiFilter: blank -> absent; days -> UTC instants; limit default" | Filter mapping |
| › "formatAuditTime: 2026-03-05T17:30:00.123456Z -> shows 06 Mar 2026, 00:30 (Asia/Ho_Chi_Minh)" | D35 display |
| › "actorLabel: name as is (Vietnamese diacritics 'Nguyễn Văn Á' unchanged); null -> 'Unknown member' + sub.slice(0,8)" | A5 |
| › "metaEntries: null -> []; object -> key/value strings; nested object stringified; long value truncated" | A7 |
| › "actionLabel: room.create known; unknown 'seat.assign' -> raw string" | A8 |
| `src/ui/audit/AuditView.test.tsx` › "forbidden status shows no-access and no filters/table" | Criterion 1 |
| › "loading shows aria-busy and no rows" | States |
| › "empty (no filters) vs empty with filters show different text" | States |
| › "error shows apiErrorMessage text and a retry button" | States |
| › "ready renders rows in the given order with actor names and localized times" | Criteria 2-4 |
| › "Vietnamese display name renders intact" | Domain focus |
| › "null entityId and null meta render without 'null' or 'undefined' text" | Empty/null fields |
| › "meta containing <script> is escaped" | A7 |
| › "Load more button only when hasMore; disabled while loadingMore" | Pagination |
| › "filter selects list facet options; selected values reflect state" | Filters |
| `src/lib/nav.test.ts` › "audit is admin only; admin rail ends with audit; user/manager lists unchanged" | Nav |
| Existing, must still pass: `src/lib/icons.test.ts` (sorted, covers nav icons), `src/ui/copy/copy.test.ts` (labels cover every NavId, NFC), `src/ui/copy/no-literals.test.ts` (no literals in `.tsx`, no diacritics in copy) | Conventions |

## Approach
1. `history` icon, `NavId`/nav item, `shell.ts` copy, `nav.test.ts` update (small, keeps typecheck green: `shellCopy.nav` is exhaustive over `NavId`).
2. `src/lib/audit/day-range.ts` + test (pure, `lib` layer). Implement with fixed offset arithmetic on `Date.UTC`, not the host time zone, so the test result does not depend on the machine's TZ. Validate the day by round-tripping through `Date.UTC`.
3. `src/ui/copy/audit.ts`.
4. `audit-api.ts`, `audit-state.ts` + tests (injected fetcher, mirrors `rooms-api.ts`). Types from `@/lib/audit/types` (lib, allowed for ui; no server import, R1).
5. `useAudit.ts` (counter ref for stale responses as in `useRooms.ts`), `AuditView.tsx`, `AuditPage.tsx`, `src/app/(app)/audit/page.tsx`, `src/ui/index.ts` export, view test.
6. Time display uses `Intl.DateTimeFormat("en-GB", {timeZone:"Asia/Ho_Chi_Minh", ...})`. Date inputs are plain `type="date"` (browser-local calendar day string, interpreted as UTC+7 by `dayRangeToInstants`).
7. Run `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.
Rules: R1 (ui imports lib and ui only, `@/` alias), R3 (no config), R4 (stay in the file list), R5 (tests above), D36 (all strings in `src/ui/copy/audit.ts`; API errors through `apiErrorMessage`), D52 (clean kit, no pixel font).

## Specialist input used
None (fast lane: Size S, Gate none, no consult).

## Assumptions
Non-blocking; each has a default and Ming can overrule in the batch round. None blocks.
- **B1 (default) Page route is `/audit`**, nav label "Audit log", icon `history`, admin-only, last item in the rail (all from the approved SIM-019 Slice B).
- **B2 (default) Entity select holds the raw entity codes from facets** (e.g. `room`), shown as-is. A friendlier label map is a follow-up if more entities appear.
- **B3 (default) Page size is the API default (50)**; no page-size control. Filters are applied immediately on change (no "Apply" button); from/to are calendar days in UTC+7 (D35), either may be empty.
- **B4 (default) Facet failure is non-fatal**: if `/api/audit/facets` fails, the filter selects show only "All" and the list still loads; an error on the list shows the error state with retry.
- **B5 (default) `meta` shown as a compact "key: value" list** (text only, long values truncated by `metaEntries`), per SIM-019 A7.
- **B6 No DOM testing library is added.** State logic is in pure modules and views are tested with `renderToStaticMarkup`, as in `RoomsView.test.tsx`. "No request for non-admin" is guaranteed structurally (hook mounted only in the admin branch) and reviewed by reading `AuditPage.tsx`; it is not a runtime test. Alternative (needs a stack decision, not taken): add `@testing-library/react` + jsdom.
- **B7 Hotspots / rebase.** SIM-007.2 (same batch) edits `src/ui/auth/AuthGate.tsx`, `src/ui/auth/views.tsx`, `src/ui/AppShellView.tsx`, `src/lib/identity/flow.ts`: **none of these is touched here, no overlap.** Shared small-edit files that other open tickets may also touch: `src/ui/index.ts` (one export line), `src/lib/nav.ts`, `src/lib/nav.test.ts`, `src/ui/copy/shell.ts`, `src/lib/icons.ts`. Expect at most a trivial rebase (append-only edits).
- **B8 Dependency state.** SIM-019, SIM-006.2 and SIM-022 are on `main` (verified: `src/app/api/audit/*`, `src/lib/api/fetch.ts`, `src/ui/auth/api-fetch-context.tsx`, `src/ui/copy/no-literals.test.ts` exist).
- **B9 No security-review trigger:** nothing under `src/server/` or `.env.example`; the existing auditor triggers do not match.

## Blocking questions
None.

## Split proposal
None. If the diff exceeds the guide during implementation, the fallback cut is (1) nav + icon + shell copy + `day-range` + `audit-api` + `audit-state` and (2) the view/hook/page, but the default is a single PR.
