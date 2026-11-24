## SIM-011.2 frontend consult: Members page UI

No High path is hit. All changes are under `src/ui/**`, `src/app/(app)/members/page.tsx` and `src/ui/index.ts` (UI/pages layer). No `src/server/http/**`, auth, config or migration files are touched. `src/lib/api/error.ts` and `src/ui/copy/api.ts` already contain every needed code, so there is no reason to edit them. Gate is none, so the Medium/Low path applies.

### Findings

**1. The shipped API differs from the SIM-011 consult. Build against the code, not the consult.** All of it is in `src/app/api/members/**` and `src/lib/members/types.ts`.
- `GET /api/members?q=&status=active|deactivated|all&limit=&cursor=`
  - Open to every tier.
  - Defaults: status `active`, limit 50 (max 100), q at most 80 code points.
  - Returns `MemberListResponse {items: MemberDto[], nextCursor, groups: MemberGroupRef[]}`. Groups come on every page, so the edit dialog needs no separate groups call.
  - Search matches display name, email and employee code, accent-folded.
- `MemberDto` has `{id, displayName, email, employeeCode, group: {id,name,color}|null, status, seatCount, deviceCount, seats: {id,code}[], devices: {id,name,inventoryNumber,role,seatId,seatCode}[]}`.
  - The list is capped at `listRefs` = 20 per kind, so counts can exceed the list length. The view must show "+N more" using `seatCount - seats.length` (same for devices).
- `GET /api/members/[id]` returns one member with refs capped at 500 (user tier).
- `PATCH /api/members/[id]` (manager) takes `{displayName?, employeeCode?, groupId?}`. Unknown keys are rejected and an empty body is rejected.
  - Employee code: blank or `null` clears it. Otherwise it must match `[A-Za-z0-9._-]{1,32}` and the server uppercases it.
  - Returns the updated `MemberDto`.
  - Errors: 400 `invalid_request` (also returned for a missing group), 404 `not_found`, 409 `employee_code_taken`.
  - There is no `invalid_group` response from PATCH in practice. `memberConflict` maps it to `invalidRequest`. The copy for `invalid_group` exists but is unused here.
- `GET /api/members/[id]/deactivation-impact` (manager) returns `{occupiedSeats, placedDevices, primaryDevicesToDemote, pendingRequests}`. The route is `deactivation-impact`, not `deactivate-impact`.
- `POST /api/members/[id]/deactivate` (manager) takes the body `{release: boolean}`, which is required and strict. Do not use a `?release=` query parameter.
  - It returns the updated `MemberDto`.
  - 409 `member_not_empty` when the member needs a release and `release:false` was sent. The ticket AC calls this `member_not_empty` and it matches the code.
  - 409 `cannot_deactivate_self`.
  - Deactivating an already-deactivated member is a no-op that returns 200 (self is refused first).
  - With release it also cancels pending seat requests, so the dialog should say so (`pendingRequests`).
  - "Needs release" means `occupiedSeats>0 || placedDevices>0`. Reuse `needsRelease` from `@/lib/members/deactivation` (pure lib, so UI may import it).
- `POST /api/members/[id]/reactivate` (manager) is idempotent and returns a `MemberDto`.
- `GET /api/members/invitations` (manager) returns `{items: PendingInvitationDto[]}` with `{id, email, role, createdAt, expiresAt|null}`.
  - It is not part of the list response, so it is a separate call.
  - Expired ones are already filtered out server-side.
  - `role` is a raw string such as `simap:user` or `simap:manager`. Map it with `invitationsCopy.roles` and fall back to the raw value for unknown roles.
  - Do not call it for Users (403).
- The `status` filter defaults to `active`. Deactivated members therefore do not show unless asked. The ticket scope does not mention a filter, but Reactivate is unreachable without one. See Recommendation 6.

**2. Current UI state.**
- `src/app/(app)/members/page.tsx` renders `<InvitePeople />` in a `flex justify-end px-4 pt-4` wrapper above a `PageSkeleton`. `InvitePeople` already returns null for Users and in dev-token mode.
- `src/ui/index.ts` exports `RoomsPage`, `AuditPage`, `GroupsPage`, `DevicesPage` and `InvitePeople`. There is no `MembersPage` yet.
- `src/ui/members/` does not exist. `src/ui/copy/members.ts` does not exist.
- `shellCopy.pages.members` has `{title: "Members", empty: "No members yet."}`.
- `Session = {tier, email, orgName?, devToken?}` (`src/lib/session.ts`). It has no member id or sub.
- Already on main and relevant:
  - The deny-list gate is `src/server/members/gate.ts`.
  - `/api/members` is already consumed by `src/ui/seats/seats-api.ts` (member picker), so the list endpoint is exercised and `MEMBER_LIMITS` is shared.
  - The sidebar nav already has `/members` (`src/lib/nav.ts`, minTier user).
  - Search results (`src/lib/search/types.ts`) have a `members` group. Nothing links to `/members?q=`, so there is no deep-link requirement.
- Error copy needed is in `apiCopy.errors`: `employee_code_taken`, `member_not_empty`, `cannot_deactivate_self`, `invalid_group`, `member_deactivated`. `apiErrorMessage` covers unknown codes.

**3. Patterns to copy** (rooms/audit/invitations).
- `RoomsPage` (container with `useApiFetch`, `useMemo(createXApi)`, `useSession`, a `Dialog` union state) → pure `RoomsView` → `useRooms`.
- `createRoomsApi`: `call/withBody/errorCode` are file-local and return `{ok,value}|{ok:false,code}`. Duplicate them in `members-api.ts`, as the groups and audit APIs did.
- `useAudit`: counter-based stale guard, `mounted` ref, `reload`/`loadMore`, and `loadMore` re-checks `counter` so a restart drops it. Mirror it with a `query: {q, status}` object.
- Inner-keyed dialog (`RoomFormDialog`/`DeleteRoomDialog`) over `EntityFormDialog`. It renders `error` as `role="alert"`, has native `<dialog>` focus handling, and keeps submit disabled via `submitting`.
- `DialogField`/`DialogSelect` for inputs. `Chip` takes `{label, icon?, color?, onColor?}`. Group colour is a string from the DB (`MemberGroupRef.color`), so check how `GroupsView` renders colour (and its contrast) before passing it to `Chip`.
- `no-literals.test.ts` scans every `.tsx` in `src/ui` and `src/app` (not tests) for JSX text and for string literals in `aria-label|title|placeholder|alt|label|subtitle|submitLabel|cancelLabel|emptyText|description`. All text, including aria-labels, must come from `src/ui/copy/members.ts`. Spell dynamic labels as functions, e.g. `editLabel(name)`.
- `copy.test.ts` also checks copy files, so look at it for any shape constraints before adding the new file.

### Recommendations

1. **Files** (matches the ticket scope):
   - `src/ui/members/MembersPage.tsx`: container.
   - `MembersView.tsx`: pure, props only.
   - `useMembers.ts`: list state.
   - `members-api.ts` with `createMembersApi(fetcher)`.
   - `member-form.ts`: form state and patch building, tested in isolation.
   - `deactivate-flow.ts`: dialog logic kept pure and tested, as `delete-flow.ts` does.
   - `EditMemberDialog.tsx`, `DeactivateMemberDialog.tsx`.
   - `PendingInvitations.tsx`: small pure subcomponent.
   - Tests: `members-api.test.ts`, `MembersView.test.tsx`, `member-form.test.ts`, `deactivate-flow.test.ts`.
   - `src/ui/copy/members.ts`.
   - Export `MembersPage` from `src/ui/index.ts` (keep `InvitePeople`).
   - Layout note: `page.tsx` becomes `<MembersPage />`, with `<InvitePeople />` kept.
     - Either render both in `page.tsx` (`<InvitePeople />` in the header strip above `<MembersPage />`), which keeps the SIM-009 placement, or pass it as a `headerAction` slot into `MembersPage`/`MembersView` so the button sits in the page header next to the title. Prefer the slot, since a view with its own `<h1>` otherwise has the invite button floating above it. Hard requirement: do not drop `<InvitePeople />`.
     - If rendering `InvitePeople` inside the view, remember the view stays pure, so inject it as a `ReactNode` prop rather than importing it in the view.

2. **`members-api.ts`.** `list({q?, status?, limit?}, cursor?)`, `get(id)` (optional), `update(id, patch)`, `impact(id)`, `deactivate(id, release)`, `reactivate(id)`, `invitations()`. Build `URLSearchParams`, omitting `q` when blank, and `encodeURIComponent` the ids. `list` must validate `items` and `groups` with `Array.isArray` and `nextCursor` as `string|null`, else `fail("internal")`.

3. **`useMembers(api, query)`.** Same shape as `useAudit` (state `loading|error|ready`, `items`, `nextCursor`, `groups`, `loadingMore`, `errorCode`, `reload`, `loadMore`).
   - Keep `groups` from the latest first page. Replace it on each reload, since later pages return the same groups.
   - A query change restarts the list and the counter drops any in-flight `loadMore`.
   - Page `loadMore` with `state.nextCursor`. De-duplicate appended items by id for safety, since the keyset cursor is stable but a reload racing a deactivation could repeat a row.
   - Debounce the search input (~250 ms) in the container only, and pass the committed `q` to the hook. Do not debounce Enter or clear.
   - `useMembers` is mounted unconditionally for all tiers.
   - Load pending invitations in a separate hook or effect only when `canManage`. A failed invitations call must not break the member list (show a small inline error with retry in that section only).

4. **`MembersView` (pure).** Props: `status`, `items`, `groups?` (not needed in the view), `canManage`, `query`/`search` value, `statusFilter`, `hasMore`, `loadingMore`, `errorCode`, `invitations` (`{status, items, errorCode}` or null for Users), `headerAction`, and handlers `onSearch`, `onStatusFilter`, `onRetry`, `onLoadMore`, `onEdit`, `onDeactivate`, `onReactivate`, `onRetryInvitations`.
   - Header: `h1` title, a note that accounts are managed in mmlabs and members cannot be deleted here (visible to everyone, as the ticket says "the page says accounts are managed in mmlabs").
   - Controls: a labelled search input (`<label>`, visible text or `aria-label` from copy) and a status filter. Reuse `FilterChips` with Active / Deactivated / All, `ariaLabel` from copy.
   - Table styled like `AuditView` (`Card overflow-x-auto`, `min-w`, `th` heads):
     - Columns: name, email, employee code, group (Chip, "No group" when null), status, seats, devices, then Actions only when `canManage`.
     - A deactivated row shows a status text label such as "Deactivated" (not colour alone) and dimmer styling.
     - The seats and devices cells show the count, then the capped ref list as text (seat code; device name with inventory number and a role hint). Use `<ul>` and "+N more" when `count > refs.length`.
   - Users get no action column, no action buttons and no invite button, and nothing is rendered disabled.
   - Buttons use `aria-label`s containing the member name via copy functions, e.g. `editLabel(name)`, `deactivateLabel(name)`, `reactivateLabel(name)`.
   - States:
     - Loading: `aria-busy` skeleton.
     - Error: `role="alert"` plus `apiErrorMessage` and a retry button.
     - Empty with no query: `shellCopy.pages.members.empty`.
     - Empty with a query or non-default status: a "No members match" message.
     - "Load more" button with `loadingMore` text.
   - Pending invitations section, Manager+ only:
     - Heading, read-only list (email, role label, sent date, expiry date, "No expiry" when null) and an empty text.
     - A note that invited people cannot be assigned seats until they join (spec MEM-01, D16).
     - Format dates with a deterministic helper. Reuse the audit date formatter if suitable. Avoid locale-dependent output that makes `renderToStaticMarkup` tests flaky (the audit view already handles timezone with `formatAuditTime`).
   - Self row: the session has no member id, so the view cannot hide Deactivate on the user's own row. Rely on the server `cannot_deactivate_self` (409) and show `apiErrorMessage` in the dialog. Optionally compare `session.email` to `member.email`, case-insensitively, to hide the self Deactivate. That is a cosmetic extra and needs an explicit decision. Recommend keeping the server refusal only, to avoid stale-session surprises.

5. **`EditMemberDialog`.**
   - Fields: display name (`DialogField`, `required`), employee code (`DialogField`, `autoCapitalize="characters"`, `spellCheck={false}`, `autoComplete="off"`, hint that it is optional), and group (`DialogSelect`, "No group" plus `groups`).
   - `member-form.ts` mirrors `room-form.ts`:
     - `formFromMember`.
     - `toPatchBody(form, member)` returns `unchanged | invalid(message) | ok(body)` and sends only changed fields, so a no-op closes without a request.
     - Client validation reuses `normalizeDisplayName` and `normalizeEmployeeCode` from `@/lib/validate/member`. These are pure lib, which UI may import, as `room-form` does with `@/lib/validate/room`. Send a blank code as `null` to clear it.
     - Per-field inline messages in copy: displayName, employeeCode (1-32 of letters, digits, dot, dash, underscore), group.
   - Error mapping on submit: `employee_code_taken` (409) → the field-specific message in the dialog `error` slot, `invalid_request` → generic "check and try again" (or a group-specific message when only the group changed), `not_found` → close and reload (as rooms do), and anything else → `apiErrorMessage`.
   - Cannot place per-field error under the field since `EntityFormDialog` has a single `error` slot. Inline in the dialog error line is acceptable per the AC ("inline messages").
   - On success call `reload()` and close.
   - Consider `maxLength` on the inputs (80 for name, 32 for code) using the exported constants.
   - Edit a deactivated member: allowed server-side. Offering Edit on deactivated rows is fine, so keep it simple and show the same actions except Deactivate becomes Reactivate.

6. **`DeactivateMemberDialog`.**
   - On open, load the impact (inner-keyed, like `DeleteRoomDialog`), with submit disabled until it loads.
   - If `!needsRelease(impact)`: show a plain confirm, call `deactivate(id, false)`, then `onDone`.
   - Otherwise show the counts (seats, placed devices, primaries to be demoted to secondary, pending requests that will be cancelled) and say that confirming releases the seats and returns devices to inventory. Confirm calls `deactivate(id, true)`. This matches the AC "on confirm, calls deactivate with `release:true`", so no opt-out checkbox is needed. The cancel button is the opt-out.
   - Error handling:
     - `member_not_empty` → re-run `loadImpact()` so the dialog updates its counts (the stale-dialog AC), and leave the user to confirm again.
     - `not_found` → close and reload.
     - `cannot_deactivate_self` and anything else → `apiErrorMessage` inline.
   - Re-fetch races: ignore a stale impact response if the member changes (the keyed inner component handles that).
   - Pure `deactivate-flow.ts`: `impactLines(impact)` (pluralised via copy functions), `deactivateStep(impact)` returning `"plain" | "release"`, and `releaseFor(step)`. Unit test those and the error-to-action mapping (`member_not_empty` → `reload-impact`, `not_found` → `done`).
   - Reactivate needs no dialog: a direct button with a pending state, and on success `reload()`. Show an inline error if it fails (a small `role="alert"` above the table or a `Reactivate` confirm dialog). A simple confirm dialog through `EntityFormDialog` keeps error handling consistent and cheap, so prefer it.
   - Deactivating a member in the default "Active" filter removes them from the list on reload. After Deactivate, the row disappears unless the filter is "All" or "Deactivated". That is expected, so the status filter is what makes Reactivate reachable. Include the filter (Recommendation 4) even though the ticket scope does not list it, or Reactivate cannot be tested manually. Flag as a small scope addition (see Open question 1).

7. **Copy (`src/ui/copy/members.ts`).** Group strings: title/intro/accountsNote, search label/placeholder, status filter labels, column heads, statusLabels (`active`, `deactivated`), noGroup, counts and "+N more" helpers, action labels as functions of the member name, edit and deactivate/reactivate dialog titles and bodies, impact line helpers, field labels and field errors, invitations section, loadMore/loadingMore, retry, emptyFiltered. Use the `satisfies`-free `as const` object like `roomsCopy`. Vietnamese names and diacritics pass through untouched.

8. **Tests (R5, light).**
   - `members-api.test.ts` with a fake fetcher: URL and query building (blank `q` omitted, cursor encoded), body shapes (`{release:true}`, patch with `null` code), error code extraction, `ApiAccessError` mapping, malformed list body → `internal`.
   - `MembersView.test.tsx` via `renderToStaticMarkup`: User sees no action buttons, no invitations section and no invite slot content beyond what is passed. Manager sees Edit and Deactivate, and Reactivate on deactivated rows. Loading, error, empty, empty-filtered and "Load more" states. A "+N more" case when the count exceeds the refs. The accounts-managed-in-mmlabs note is present for both tiers. Vietnamese names render.
   - `member-form.test.ts`: unchanged, invalid name, invalid code, clearing the code, group change.
   - `deactivate-flow.test.ts`: step selection, lines, error mapping.
   - A pure test for the `useMembers` reducer or stale guard if extracted. At minimum, test that a query change drops late responses with the counter logic extracted as a function. Optional given light-test policy.
   - Manual: deactivate a member who holds a seat, check the dialog counts, confirm that the seat is freed on `/seats`, switch to the Deactivated filter and Reactivate.

### Risks

- **Reactivate unreachable without a status filter** (default `active`). Adding Active/Deactivated/All is a small addition beyond the ticket text but required for AC1 ("Deactivate/Reactivate actions"). Low risk since the API already supports it.
- **Capped ref lists** (20): the view must not imply the lists are complete. MEM-02 says "every seat and device". Use the count with "+N more", and optionally a row expansion that calls `GET /api/members/[id]` (cap 500). The expansion is an optional extra beyond the ticket. Decide with the planner.
- **PII**: the list shows emails and employee codes to Users (spec says Users view members). Invitation emails are Manager+ only, which matches the route.
- **Self-deactivation**: the server refuses it, but the UI cannot tell which row is the user's (no member id in `Session`). The error shows only after confirm. Acceptable, mention in the PR.
- **Stale impact on confirm**: handled by the `member_not_empty` re-fetch. There is a rare race where release succeeded elsewhere and the member is already deactivated. The server then returns a no-op 200, which is fine.
- **Deactivation with release also cancels pending requests** (server behaviour). The dialog must state this, otherwise the user is surprised. `impact.pendingRequests` supports it even when seats/devices are zero (plain confirm should still mention cancelling pending requests when `pendingRequests>0`).
- **`no-literals.test.ts`** is a regex heuristic. A literal in a prop like `aria-label` or JSX text fails the test. Any text in table cells such as "—" for empty values is a non-letter, so it passes, but prefer copy anyway.
- **`InvitePeople` regression**: replacing `page.tsx` could drop the SIM-009 button. Cover it by keeping a render path test only if cheap (the page is a thin server component, so a test is not necessary), and call it out for the reviewer.
- **Date rendering** in server-rendered tests: use the same timezone-stable formatter as audit.
- Race between search typing and "Load more": the counter guard handles it.
- Layers (R1): UI files may import `@/lib/**` only. They must not import `@/server/**`. `check:layers` enforces it, so do not import `needsRelease` from a server module (it lives in `@/lib/members/deactivation`, fine).

### Open questions

1. Is the status filter (Active/Deactivated/All) in scope? It is not in the ticket scope list, but Reactivate cannot be used without it (default `active`). Recommend yes, as part of the "Reactivate" AC.
2. Should the list row expand to show uncapped seats and devices via `GET /api/members/[id]`, or is the capped inline list (20, with "+N more") enough for MEM-02? Recommend capped only for this ticket and a follow-up for expansion.
3. Hide Deactivate on the user's own row by email comparison, or rely on the server's `cannot_deactivate_self`? Recommend rely on the server.
4. Where should the invite button sit: keep above the page as in SIM-009 (`page.tsx` strip), or in the page header via a slot? Recommend the slot for layout, with `InvitePeople` still rendered from `page.tsx`.
5. Should Edit and Deactivate be offered for members who are Admins, or for the Manager's own row? The server does not restrict this (only self-deactivation is refused). Recommend not restricting in the UI. If Ming wants a rule (such as Managers cannot deactivate Admins), it is a server change in SIM-011 and out of scope here.
6. Should the Deactivate dialog offer an opt-out ("Deactivate but keep seats") given the server supports `release:false` only when the member has nothing to release? The server refuses `release:false` with seats or devices, so the AC and API match "release or cancel". No opt-out is needed. Confirm with the planner.

Key files read: `/home/user/simap/work/tickets/SIM-011.2/ticket.md`, `/home/user/simap/work/tickets/SIM-011/consult-frontend-developer.md`, `/home/user/simap/work/tickets/SIM-011/plan.md` (split section), `/home/user/simap/src/app/api/members/**`, `/home/user/simap/src/server/members/manage.ts`, `/home/user/simap/src/lib/members/{types,deactivation}.ts`, `/home/user/simap/src/lib/validate/{member,member-query}.ts`, `/home/user/simap/src/ui/rooms/*`, `/home/user/simap/src/ui/audit/{AuditView,useAudit}.tsx`, `/home/user/simap/src/ui/EntityFormDialog.tsx`, `/home/user/simap/src/ui/invitations/InvitePeople.tsx`, `/home/user/simap/src/ui/copy/{rooms,invitations,shell,no-literals.test}.ts`, `/home/user/simap/src/app/(app)/members/page.tsx`, `/home/user/simap/src/ui/index.ts`, `/home/user/simap/.claude/loop.config.md`.
