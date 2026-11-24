Status: READY

# Plan — SIM-011.2: Members page UI: list, edit and deactivate dialogs

**High paths: none.** Every file below is under `src/ui/**`, `src/app/(app)/members/page.tsx` or `src/ui/index.ts`.
None matches a High path in `.claude/loop.config.md` (no migrations, no `src/server/**`, no `src/proxy.*`, no
config). Gate policy is `high-paths+P1` and this ticket is **P1**, so the orchestrator's approval gate still applies
by priority, not because of a High path.

## Scope summary
Spec `docs/spec-v1.md`:
- MEM-01 (l.292-307): "A Manager+ edits a member's simap fields (display name, employee code (unique in the org if
  set), group)." / "simap never deletes an Identity account; only the admin portal does (D34)." / "A Manager+ can
  **deactivate** a member in simap … Reactivation undoes it (D34)." / "Deactivating or removing a member who still
  occupies seats or owns placed devices warns with the counts and offers to release the seats and return the devices
  to inventory in the same step (D34)." / "Managers edit simap fields (display name, employee code, group); the
  account itself is managed in Identity." / "The Members page also lists the org's pending invitations sent from
  simap (read-only; no seat can be assigned to them) (D16)."
- MEM-02 (l.311-313): "The member page or card lists every seat the member occupies and every device they own, with
  counts. It is searchable."

`work/decisions.md`:
- D12: "Every person is an mmlabs Identity account … A member is simap's profile of one account in one org."
- D16 (a): "a member appears on the account's first visit; Managers assign only known members; pending invitations
  sent from simap are listed read-only."
- D17: "Display name … editable by Managers."
- D34: "Members are never deleted in simap: Manager+ deactivate (simap-local) or an Admin removes them from the org."
- D36: "all user-facing text lives in copy files … Names/data keep Vietnamese diacritics (display, sort, search)."
- D35 (dates in the invitations list): "Times stored in UTC and shown in UTC+7 (Asia/Ho_Chi_Minh)."

Ticket scope: the page, `src/ui/members/*`, `src/ui/copy/members.ts` and the `src/ui/index.ts` export. Users see
no action buttons, the page says accounts are managed in mmlabs, and there is no delete action. Server/API changes
are out of scope (they shipped in SIM-011).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Users see the list read-only; Managers see Edit and Deactivate/Reactivate actions. | `MembersView.test.tsx` › "user sees no actions, no invitations section, accounts note present", "manager sees Edit + Deactivate on active rows and Edit + Reactivate on deactivated rows". Locally (`pnpm dev`): sign in as a User, no action column and no buttons. |
| 2 | Deactivating a member with seats/devices shows the counts and, on confirm, calls deactivate with `release:true`; a stale dialog re-fetches on `member_not_empty`. | `deactivate-flow.test.ts` › "step is release when seats or placed devices > 0", "impactLines lists non-zero counts incl. pending requests", "releaseFor(release) is true", "member_not_empty → reload-impact", "not_found → done". `members-api.test.ts` › "deactivate posts JSON body {release:true}". Code read: `DeactivateMemberDialog` calls `loadImpact()` on the `reload-impact` action. |
| 3 | Edit maps `employee_code_taken` and `invalid_request` to inline messages. | `member-form.test.ts` › "submitErrorAction: employee_code_taken → inline code message", "invalid_request → inline generic message (group message when only group changed)", "not_found → close-reload", "other → apiErrorMessage". Code read: the message goes to `EntityFormDialog`'s `error` slot (`role="alert"`). |
| 4 | Search restarts the list; "Load more" pages with the cursor. | `members-api.test.ts` › "list builds q/status/limit/cursor, omits blank q, encodes cursor". `members-state.test.ts` › "appendUnique drops repeated ids", "listQuery trims q". `MembersView.test.tsx` › "Load more shown only when hasMore; loadingMore text". Code read: `useMembers` bumps `counter` on query change and `loadMore` drops results whose counter is stale (same as `useAudit`). |
| 5 | All copy lives in `src/ui/copy/members.ts`; view and api-client unit tests pass. | `pnpm test` (incl. existing `src/ui/copy/no-literals.test.ts` and `copy.test.ts`, which scan the new `.tsx` and copy files); `pnpm typecheck && pnpm check:layers`; `pnpm format:check`; `pnpm build`. |
| 6 | (Ticket scope) `<InvitePeople />` from SIM-009 stays on the Members page. | Code read of `src/app/(app)/members/page.tsx`: it still renders `<InvitePeople />`. Locally as a Manager (non-dev-token sign-in): the Invite button shows in the Members header. |

## Ming verification after merge
- Manual (ticket test plan): with a real Identity sign-in, deactivate a member who holds a seat: the dialog shows the
  counts; after confirm the seat is free on `/seats`; switch the filter to "Deactivated" and Reactivate.
- The Invite button shows next to the Members title for a Manager with a real (non-dev-token) session
  (`InvitePeople` returns null in dev-token mode, so the reviewer cannot see it locally).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/app/(app)/members/page.tsx` | Modify: replace `PageSkeleton` with `<MembersPage headerAction={<InvitePeople />} />`; keep the `InvitePeople` import | Ticket scope; keep SIM-009's button | No |
| `src/ui/index.ts` | Modify: add `export { MembersPage } from "./members/MembersPage";` (keep the `InvitePeople` line) | Ticket scope; pages import from `@/ui` | No |
| `src/ui/copy/members.ts` | Create: `membersCopy` (`as const`) | D36, AC5 | No |
| `src/ui/members/members-api.ts` | Create: `createMembersApi(fetcher)` + `MembersApi` type | API client | No |
| `src/ui/members/members-api.test.ts` | Create | R5, AC2/AC4 | No |
| `src/ui/members/members-state.ts` | Create: pure helpers (`listQuery`, `appendUnique`, `moreCount`, `invitationRoleLabel`, `formatInviteDate`, `STATUS_FILTERS`) | Pure logic first; testable without React | No |
| `src/ui/members/members-state.test.ts` | Create | R5, AC4 | No |
| `src/ui/members/useMembers.ts` | Create: list hook (mirror `src/ui/audit/useAudit.ts`) | Search + Load more | No |
| `src/ui/members/usePendingInvitations.ts` | Create: invitations hook, runs only when `enabled` | Manager-only section; a failure there must not break the list | No |
| `src/ui/members/member-form.ts` | Create: `MemberForm`, `formFromMember`, `toPatchBody`, `submitErrorAction` | Edit logic, tested in isolation | No |
| `src/ui/members/member-form.test.ts` | Create | R5, AC3 | No |
| `src/ui/members/deactivate-flow.ts` | Create: `deactivateStep`, `impactLines`, `releaseFor`, `deactivateErrorAction` | Dialog logic kept pure (like `src/ui/rooms/delete-flow.ts`) | No |
| `src/ui/members/deactivate-flow.test.ts` | Create | R5, AC2 | No |
| `src/ui/members/MembersView.tsx` | Create: pure view (props only) | Ticket scope | No |
| `src/ui/members/PendingInvitations.tsx` | Create: pure read-only section | MEM-01 / D16 (a) | No |
| `src/ui/members/MembersView.test.tsx` | Create: `renderToStaticMarkup` tests (also renders `PendingInvitations` through the view) | R5, AC1/AC4 | No |
| `src/ui/members/EditMemberDialog.tsx` | Create: inner-keyed dialog over `EntityFormDialog` | MEM-01 edit | No |
| `src/ui/members/DeactivateMemberDialog.tsx` | Create: impact load, plain/release confirm, re-fetch on `member_not_empty` | MEM-01 deactivate, AC2 | No |
| `src/ui/members/ReactivateMemberDialog.tsx` | Create: small confirm over `EntityFormDialog` | MEM-01 reactivate (consult §6, consistent error handling) | No |
| `src/ui/members/MembersPage.tsx` | Create: container (`useApiFetch`, `useMemo(createMembersApi)`, `useSession`, dialog union state, search debounce) | Ticket scope | No |

Do **not** edit `src/lib/api/error.ts` or `src/ui/copy/api.ts`: every code needed is already there
(`src/ui/copy/api.ts:17-19`). Do not touch `src/app/api/**` or `src/server/**`.

## Data model / migration
None.

## API contract
None changed. The UI consumes the endpoints SIM-011 shipped (`src/app/api/members/**`, types in
`src/lib/members/types.ts`):

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/members?q=&status=&limit=&cursor=` | `status` `active` (default) / `deactivated` / `all`; `limit` ≤ 100; `q` ≤ 80 code points | `MemberListResponse {items, nextCursor, groups}` | 200, 400 `invalid_request` | user+ |
| PATCH | `/api/members/[id]` | `{displayName?, employeeCode?, groupId?}`, strict, non-empty; blank/null code clears | `MemberDto` | 200, 400 `invalid_request`, 404 `not_found`, 409 `employee_code_taken` | manager+ |
| GET | `/api/members/[id]/deactivation-impact` | — | `DeactivationImpact {occupiedSeats, placedDevices, primaryDevicesToDemote, pendingRequests}` | 200, 404 | manager+ |
| POST | `/api/members/[id]/deactivate` | JSON body `{release: boolean}` (required; not a query param) | `MemberDto` | 200, 404, 409 `member_not_empty`, 409 `cannot_deactivate_self` | manager+ |
| POST | `/api/members/[id]/reactivate` | — | `MemberDto` | 200, 404 | manager+ |
| GET | `/api/members/invitations` | — | `{items: PendingInvitationDto[]}` | 200, 403 for Users | manager+ |

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `members-api.test.ts` › list: builds `/api/members?status=active&limit=50`, adds `q` only when non-blank, adds encoded `cursor` | AC4 |
| `members-api.test.ts` › list: body without array `items`/`groups` or with non-string, non-null `nextCursor` → `{ok:false, code:"internal"}` | robustness |
| `members-api.test.ts` › update: PATCH to `/api/members/<encoded id>` with JSON body incl. `employeeCode: null` | AC3 |
| `members-api.test.ts` › impact hits `/deactivation-impact`; deactivate POSTs `{release:true}` / `{release:false}`; reactivate POSTs | AC2 |
| `members-api.test.ts` › error code from `{error:{code}}`; non-JSON error → `internal`; `ApiAccessError("signed_out")` → `unauthenticated`; network throw → `unavailable` | error shape |
| `members-api.test.ts` › invitations: returns `items`; non-array → `internal` | MEM-01 |
| `members-state.test.ts` › `listQuery` trims q, drops blank q, sets status and `MEMBER_LIMITS.defaultLimit` | AC4 |
| `members-state.test.ts` › `appendUnique` keeps order and drops ids already present | Load more race |
| `members-state.test.ts` › `moreCount(5, 3) = 2`, `moreCount(2, 2) = 0`, never negative | MEM-02 capped refs |
| `members-state.test.ts` › `invitationRoleLabel("simap:manager") = "Manager"`, unknown role → raw string | consult §1 |
| `members-state.test.ts` › `formatInviteDate` shows a UTC instant late on day N as day N+1 in UTC+7 (e.g. `2026-03-05T17:30:00Z` → `06 Mar 2026`); invalid input → returned as is; `null` → `membersCopy.invitations.noExpiry` | D35, UTC vs UTC+7 |
| `member-form.test.ts` › `toPatchBody`: unchanged → `unchanged`; only changed keys sent; blank name → invalid (displayName message); code `"ab.c-1"` → `"AB.C-1"`; bad code `"a b"` → invalid (code message); clearing the code → `employeeCode: null`; group change → `groupId`, "No group" → `null`; Vietnamese name `"Nguyễn Thị Ánh"` passes unchanged (NFC) | AC3, domain focus |
| `member-form.test.ts` › `submitErrorAction`: `employee_code_taken` → inline code-taken message; `invalid_request` → inline generic message, or the group message when the patch has only `groupId`; `not_found` → `close-reload`; other → `apiErrorMessage(code)` | AC3 |
| `deactivate-flow.test.ts` › `deactivateStep`: all zero → `plain`; seats > 0 or placed devices > 0 → `release`; only pending requests → `plain` | AC2 |
| `deactivate-flow.test.ts` › `impactLines`: one line per non-zero count, order seats, devices, primaries, pending requests; singular/plural | AC2 |
| `deactivate-flow.test.ts` › `releaseFor("release") === true`, `releaseFor("plain") === false` | AC2 |
| `deactivate-flow.test.ts` › `deactivateErrorAction`: `member_not_empty` → `reload-impact`; `not_found` → `done`; `cannot_deactivate_self` / other → `message` with `apiErrorMessage` | AC2 stale dialog |
| `MembersView.test.tsx` › user: no Actions header, no Edit/Deactivate/Reactivate buttons, no invitations section, accounts-managed-in-mmlabs note present | AC1 |
| `MembersView.test.tsx` › manager: Edit + Deactivate on an active row, Edit + Reactivate on a deactivated row, "Deactivated" status text, invitations section rendered, `headerAction` node rendered | AC1, MEM-01 |
| `MembersView.test.tsx` › loading (`aria-busy`), error (`role="alert"` + retry), empty with no query/default filter (`shellCopy.pages.members.empty`), empty with a query (`membersCopy.emptyFiltered`) | states |
| `MembersView.test.tsx` › "Load more" only when `hasMore`; `loadingMore` shows the loading text and disables it | AC4 |
| `MembersView.test.tsx` › seatCount 22 with 20 refs shows "+2 more"; null group shows "No group"; null employee code shows the placeholder from copy; Vietnamese display name renders as is | MEM-02, domain focus |
| `MembersView.test.tsx` › invitations: role label, sent/expiry dates, "No expiry", empty text, error with retry | MEM-01 / D16 |

Existing tests that must keep passing and now cover new files: `src/ui/copy/no-literals.test.ts` (scans every new
`.tsx`; copy files must have no Vietnamese diacritics), `src/ui/copy/copy.test.ts` (every copy string NFC, non-empty,
no `??`).

## Approach
1. **Copy** `src/ui/copy/members.ts` (`export const membersCopy = { … } as const`, like `src/ui/copy/rooms.ts`):
   title (reuse `shellCopy.pages.members.title` in the view), `accountsNote` ("Accounts are managed in mmlabs. Members
   can't be deleted here; deactivate them instead." — wording free, meaning fixed), search label/placeholder, status
   filter aria-label + labels (Active / Deactivated / All), column heads, `statusLabels`, `noGroup`, `noCode`,
   `moreRefs(n)`, device ref text helper (name, inventory number, primary/secondary), action label functions
   (`editLabel(name)`, `deactivateLabel(name)`, `reactivateLabel(name)`), edit dialog (title, field labels, code hint,
   `fieldErrors.{displayName, employeeCode, group}`, `invalidRequest`), deactivate dialog (title, plain body, release
   body: "Confirming releases these seats, returns the devices to inventory and cancels pending requests", impact line
   functions with plural forms, submit labels), reactivate dialog, invitations section (heading, note "Invited
   people can't be assigned seats until they join", columns, `noExpiry`, empty, error), `loadMore`, `loadingMore`,
   `retry`, `emptyFiltered`. No Vietnamese diacritics in the copy file (no-literals test l.52-60). Role labels reuse
   `invitationsCopy.roles` (`src/ui/copy/invitations.ts:8`).
2. **`members-api.ts`**: copy the file-local `fail` / `errorCode` / `call` / `json` / `withBody` from
   `src/ui/rooms/rooms-api.ts:5-48` (same pattern as the audit and groups clients). Methods: `list(query, cursor?)`
   (builds `URLSearchParams`; omit blank `q`; validate `items`/`groups` arrays and `nextCursor` string|null, else
   `internal`), `update(id, patch: MemberPatchValue)`, `impact(id)` → `/deactivation-impact`, `deactivate(id,
   release)` → POST body `{release}`, `reactivate(id)`, `invitations()` → validates `items` array. Ids through
   `encodeURIComponent`. Type `MemberPatchValue` from `@/lib/validate/member` (lib, allowed by R1).
3. **`members-state.ts`** (pure): `MemberQuery = {q: string; status: MemberStatusFilter}`; `listQuery(q, status)`;
   `appendUnique(prev, next)` by id; `moreCount(count, shown)`; `invitationRoleLabel(role)` with fallback to the raw
   role; `formatInviteDate(iso | null)` using an `Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Ho_Chi_Minh", day:
   "2-digit", month: "short", year: "numeric"})` modelled on `src/ui/audit/audit-state.ts:30-44` (date only; do not
   import from `ui/audit` to keep features independent); `STATUS_FILTERS` options for `FilterChips`.
4. **`useMembers(api, query)`**: mirror `src/ui/audit/useAudit.ts` (counter + `mounted` ref; `reload` bumps the
   counter and resets the list; `loadMore` captures the counter, appends with `appendUnique`, drops stale results).
   Extra state: `groups` replaced from each first page (`reload`). `query` must be memoised in the container so the
   effect only restarts on a real change. **`usePendingInvitations(api, enabled)`**: when `enabled` is false returns
   `null` and makes no request (Users would get 403); otherwise `{status, items, errorCode, reload}`, independent of the
   list state.
5. **`member-form.ts`**: like `src/ui/rooms/room-form.ts:38-60`. `MemberForm = {displayName, employeeCode, groupId}`
   (strings; `""` = no group / no code). `formFromMember(m)`. `toPatchBody(form, member)` →
   `{kind:"unchanged"} | {kind:"invalid", message} | {kind:"ok", body}`: validate with `normalizeDisplayName` /
   `normalizeEmployeeCode` from `@/lib/validate/member` (l.22, l.52), compare against the member's current values
   (compare normalized code to `member.employeeCode`), blank code → `null`, `""` group → `null`. `submitErrorAction
   (code, body)` → `{kind:"message", text} | {kind:"close-reload"}` as in the tests table.
6. **`deactivate-flow.ts`**: `deactivateStep(impact)` via `needsRelease` from `@/lib/members/deactivation` (lib,
   l.4); `impactLines(impact)` like `src/ui/rooms/delete-flow.ts:11-19` with four counts; `releaseFor(step)`;
   `deactivateErrorAction(code)` → `reload-impact | done | message`.
7. **`MembersView`** (pure, props only; no hooks that fetch, no import of `InvitePeople`): header with `h1`,
   `headerAction?: ReactNode` slot next to it, the accounts note (all tiers). Controls: labelled search input
   (`FilledInput` or a native input with `aria-label` from copy) and `FilterChips` for status. Table like `AuditView`
   (`Card` + `overflow-x-auto`, `min-w-*`): name, email, employee code, group (colour dot styled as in
   `src/ui/groups/GroupsView.tsx:74-79` + name, or `noGroup`), status text (deactivated rows dimmed **and** labelled),
   seats (count + `<ul>` of codes + `moreRefs`), devices (count + `<ul>` + `moreRefs`), and an Actions column only
   when `canManage`. Users get no action column and no disabled buttons. States: loading skeleton with
   `aria-busy="true"`, error `role="alert"` + `apiErrorMessage` + retry, empty (unfiltered → `shellCopy.pages.members.
   empty`; filtered → `emptyFiltered`), "Load more" button. Renders `<PendingInvitations>` when `invitations !==
   null`.
8. **Dialogs** (inner component keyed by member id, like `src/ui/rooms/RoomFormDialog.tsx` / `DeleteRoomDialog.tsx`,
   over `EntityFormDialog`, `DialogField`, `DialogSelect`):
   - `EditMemberDialog`: name (`required`, `maxLength={DISPLAY_NAME_MAX}`), code (`maxLength={EMPLOYEE_CODE_MAX}`,
     `autoComplete="off"`, `spellCheck={false}`, hint optional), group select (`noGroup` + `groups` from the list
     response). `unchanged` → close without request; `invalid` → inline error; on ok → `api.update`, success →
     `onDone()` (container reloads + closes); errors → `submitErrorAction`.
   - `DeactivateMemberDialog`: loads impact on open, submit disabled until loaded; `plain` → plain confirm (mentions
     cancelled pending requests when `pendingRequests > 0` via `impactLines`); `release` → counts + release text;
     confirm → `api.deactivate(id, releaseFor(step))`; `reload-impact` → re-run the impact load and show the new
     counts (user confirms again); `done` → close + reload; `message` → inline error.
   - `ReactivateMemberDialog`: confirm → `api.reactivate(id)`; `not_found` → close + reload; else inline error.
9. **`MembersPage`** (container, `"use client"`): `useApiFetch`, `useMemo(() => createMembersApi(fetcher))`,
   `useSession` → `canManage = atLeastTier(tier, "manager")` (`@/lib/tier`). Search input state + 250 ms debounce to
   the committed `q` (Enter / clearing commits immediately); status filter state; `useMembers`,
   `usePendingInvitations(api, canManage)`; dialog union state `{kind:"edit"|"deactivate"|"reactivate", member} |
   null`; after any successful action call `reload()` (and the invitations reload is not needed). Accepts
   `headerAction?: ReactNode` and passes it through.
10. **Page + barrel**: `page.tsx` → `import { InvitePeople, MembersPage } from "@/ui";` rendering
    `<MembersPage headerAction={<InvitePeople />} />`. `InvitePeople` keeps its own tier/dev-token checks. Add the
    `MembersPage` export to `src/ui/index.ts`.
11. Run the Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`.

Rules: **R1** — UI imports only `@/lib/**` (`@/lib/members/*`, `@/lib/validate/member`, `@/lib/api/*`, `@/lib/tier`)
and other `src/ui` files; the page imports `@/ui` and nothing from server; `pnpm check:layers` verifies. **R4** — stay
in the file list. **R5** — tests above. **D36** — all text in `members.ts`; aria-labels as copy functions.
R2/R3/R6/R7 not applicable (no schema, env, query or route change).

## Specialist input used
`consult-frontend-developer.md` (SIM-011.2; the SIM-011 consult is superseded where they differ):
- Finding 1 (shipped API: `deactivation-impact` route, `{release}` JSON body, capped refs, groups in list response,
  separate invitations call) — adopted; it drives the API contract above.
- Finding 2-3 (current page, RoomsPage/useAudit/delete-flow patterns, `no-literals` rules) — adopted.
- Rec. 1 file list — adopted, plus `members-state.ts`, `usePendingInvitations.ts`, `ReactivateMemberDialog.tsx` to
  keep pure helpers testable and the invitations failure isolated.
- Rec. 2-3 (api client, hook, debounce, dedupe, invitations only for managers) — adopted.
- Rec. 4 (view, states, "+N more", deterministic dates) — adopted; date helper is local (UTC+7, D35) instead of
  importing `formatAuditTime` across features.
- Rec. 5 (edit dialog, `toPatchBody`, error mapping, maxLength) — adopted.
- Rec. 6 (deactivate dialog, `member_not_empty` re-fetch, no opt-out, reactivate confirm dialog) — adopted.
- Rec. 7-8 (copy, tests) — adopted; the optional `useMembers` reducer test is replaced by the pure `appendUnique` /
  `listQuery` tests (light-test policy).
- Open questions 1-6 — answered by the defaults in Assumptions A1-A6.

## Assumptions
- **A1 Status filter (Active / Deactivated / All) is in scope.** Without it Reactivate is unreachable (API default
  `active`), and AC1 names Reactivate. Small UI-only addition; default filter `active`.
- **A2 Capped refs only.** Rows show counts plus up to 20 refs with "+N more" (`MEMBER_LIMITS.listRefs`). No row
  expansion via `GET /api/members/[id]`; that goes to follow-ups if Ming wants full lists in the table (MEM-02 "with
  counts" is met by the counts).
- **A3 Self-deactivation**: no client-side hiding (the session has no member id); rely on the server's 409
  `cannot_deactivate_self`, shown inline in the dialog via `apiErrorMessage`.
- **A4 Invite button placement**: `page.tsx` still renders `<InvitePeople />`, passed as a `headerAction` slot so it
  sits in the page header next to the title (the view stays pure).
- **A5 No UI restriction by target role**: Managers see Edit/Deactivate on every row (incl. Admins); any rule would be
  a server change outside this ticket.
- **A6 No "keep seats" opt-out** in the Deactivate dialog: the server refuses `release:false` when a release is needed;
  Cancel is the opt-out (matches AC2).
- A7 Edit is offered on deactivated rows too (the server allows it); Deactivate is swapped for Reactivate there.
- A8 Users can see emails and employee codes of org members (the list endpoint is open to every tier, SIM-011);
  invitation emails are Manager+ only.
- A9 Dates in the invitations list are date-only in Asia/Ho_Chi_Minh (D35).
- A10 Hotspot: SIM-017.3 (Search page UI, `IN_PROGRESS`) likely adds an export to `src/ui/index.ts`. Expect a
  one-line rebase conflict there; keep both exports. No other open ticket touches `src/app/(app)/members/page.tsx`.
- A11 Size: about 650-750 production lines plus tests, above the ~400-line guide. Kept as one slice because it is
  already the approved slice 2 of SIM-011, the code is mostly copied from existing patterns (rooms/audit), and every
  piece is needed for the ACs. If the implementer goes clearly past that, use the fallback split under Split proposal.

## Blocking questions
None.

## Split proposal
None (see A11). Fallback only if the diff gets out of hand during implementation: (a) list + search + status filter +
Load more + invitations section + page/barrel (AC1 read-only part, AC4, AC5); (b) Edit / Deactivate / Reactivate
dialogs (AC1 actions, AC2, AC3). This plan covers both.
