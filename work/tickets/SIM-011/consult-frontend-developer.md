## SIM-011 UI/API consult (frontend)

### Findings

**Current state**
- `src/app/(app)/members/page.tsx` is a `PageSkeleton` stub (title and empty text from `shellCopy.pages.members`). Replace it with `<MembersPage />`, as `rooms/page.tsx` does with `<RoomsPage />`.
- Server: only `src/server/members/members.ts` exists (`getOrCreateMember`, `setOwnDisplayName`). It has `Refusal`/`Result` types, `find`, `ensure` and `writeAudit`.
  - `src/lib/validate/member.ts` has `normalizeDisplayName` (1-80 code points, rejects invisible characters) and `validateMePatch`.
  - Missing: the list, edit and deactivate/reactivate services, DTO types for a list member (`@/lib/members/types` has only `MeMemberDto` and `MemberStatus`), and employee-code and group validators.
  - There are no `/api/members` routes. The only `/api` routes are `audit`, `me`, `rooms` and `healthz`/`readyz`.
- Deny list: `src/server/http/with-auth.ts` already has `memberGate(scope, sub) => "active" | "deactivated"`, checked on every request after tier. It fails closed (a throw gives 503) and `member_deactivated` is already an API error code with copy. The default `getAuthDeps` sets `memberGate: allowAll` with a "SIM-011 replaces this" comment. SIM-011 must supply a DB-backed gate: a per-request query of `members.status` by org and sub, with no cache (ticket risk).
  - Decide how a user with no member row yet is treated. `ensure` creates rows on first visit via `/api/me`, so the gate should return "active" when there is no row.
  - `withAuth` tests exist (`createWithAuth` takes injectable deps). Add a gate test.
- Schema (init migration):
  - `members`: `employee_code` (partial unique index per org where not null), `group_id` (composite FK to `groups`), `status`, `email`, `display_name`.
  - `seats.occupant_id`.
  - `devices.owner_id`, `seat_id`, `role`.
  - `invitations`: email, role, `invited_by_sub`, status, `expires_at`, `created_at`. It has a pending-per-email unique index and no token.
  - Deferred triggers raise SQLSTATE 23514 at commit if a primary device's owner is not the seat occupant. So releasing seats must demote primaries in the same transaction (DEV-06), or the transaction fails.
  - No DEV-06 demotion code exists in `src/server` yet. Grep for demote/primary finds nothing outside tests.
  - Releasing a seat clears `occupant_id` and demotes the seat's primary device to `secondary`.
  - "Return devices to inventory" means setting `seat_id = null` and `role = 'secondary'` for devices the member owns that are placed. Check the `devices_primary_needs_seat_check` constraint when ordering the updates.
- Dependencies are missing:
  - SIM-009 server code doesn't exist (no `src/server/invitations`, no `/api/invitations`). Only the table exists.
  - There is no groups API either (GRP-01). The group edit field needs a source of group options. A `groups` table exists, so the members API can return `groups: [{id, name, color}]` itself, or the group field can be a select over a list embedded in the members response. Do not wait for GRP-01.
- UI patterns to copy (rooms feature):
  - Layout: `RoomsPage` (client container: `useApiFetch`, `useMemo(createRoomsApi)`, `useSession`, a `Dialog` union state) → pure `RoomsView` (props only, tested with `renderToStaticMarkup`) → `useRooms` (counter-based stale-response guard, mounted ref).
  - API: `createRoomsApi(fetcher)` returns `{ok,value}|{ok:false,code}` and never throws, mapping `ApiAccessError`. It has local `errorCode`, `call` and `withBody` helpers that are not exported. Duplicating them for members is acceptable; extracting a shared helper is optional and out of scope unless cheap.
  - Dialogs: `DeleteRoomDialog` loads an impact via `GET .../delete-impact`, then submits. It uses the inner-keyed component pattern, `EntityFormDialog` (native `<dialog>`, `title`/`submitLabel`/`submitting`/`error`/`onClose`/`onSubmit`) and `DialogField`/`DialogSelect`.
  - Gating: `atLeastTier(session.tier, ...)` from `@/lib/tier` (UI) and `{ tier: "manager" }` in `withAuth` (server; the server tier module is `@/lib/auth/tier`).
  - Pagination: `useAudit` + `AuditView` use cursor pagination with a "Load more" button, `loadingMore` and a restart on query change. `AuditPage` does not mount the data hook for unauthorised users.
  - Copy: all strings go in `src/ui/copy/<feature>.ts`. `no-literals.test.ts` and `copy.test.ts` guard against literals. New API error codes must be added to `API_ERROR_CODES` (`src/lib/api/error.ts`) and to `apiCopy.errors`; the `satisfies Record` forces this.

### Recommendations

1. **API (`src/app/api/members/**`, `src/server/members/*`), all via `withAuth`, ticket AC refs in brackets**
   - `GET /api/members?q=&cursor=&limit=` is open to every tier (Users read-only). It does the following:
     - Returns `{items, nextCursor, groups}`.
     - Searches display_name, email and employee_code, case-insensitive, with ILIKE metacharacters escaped. Cap `q` length, e.g. 100.
     - Orders by `lower(display_name), id` with a keyset cursor, and enforces a default and max limit (e.g. 25/100).
     - Each item has `{id, displayName, email, employeeCode, groupId, groupName, status, seatCount, deviceCount, seats?, devices?}`. MEM-02 needs the list of seats and devices, not just counts, so include compact lists (seat code and room code; device name and inventory number) or a lazily loaded detail endpoint. Aggregate in the same query by `org_id`, with no N+1. Keep payloads bounded.
     - Returns `pendingInvitations` (email, role, invitedAt, expiresAt) for the first page only (the page without a cursor).
     - Show invitations to Managers and Admins only, since they contain emails. Decide whether Users see them; the spec says "the Members page also lists pending invitations", so confirm (see open questions).
     - The query reads from `invitations` where `status='pending'` and `org_id`, and an empty list is fine when SIM-009 has not written anything (R6).
   - `PATCH /api/members/[id]` requires manager+. Body is `{displayName?, employeeCode?, groupId?}` and rejects unknown keys (same style as `validateMePatch`). Employee code: trim, NFC, 1-N characters, `null` or empty to clear. A unique violation (23505 on `members_org_employee_code_key`) maps to a new `employee_code_taken` error code, handled like `room_code_taken`. A group not in the org (FK failure or a pre-check) maps to `invalid_request`. Writes an audit row `member.update` with the field names (not values of personal data beyond what `setOwnDisplayName` already logs).
   - `GET /api/members/[id]/deactivate-impact` requires manager+. Returns `{seats: n, devices: n}` (seats occupied and placed devices owned, plus the primary devices that would demote). Mirror the room `delete-impact` route.
   - `POST /api/members/[id]/deactivate` with `?release=true` or body `{release: boolean}`:
     - Without release, if the member has seats or placed devices, return a conflict, e.g. `member_in_use` (409), so a stale dialog re-fetches, like `room_not_empty`.
     - With release, run one `withTx` that locks the member row (`for update`), releases seats (clear `occupant_id`, demote primaries per DEV-06), returns owned devices to inventory, sets `status='deactivated'`, and writes audit rows. Prefer sharing an implementation with the future unassign path rather than duplicating the demotion.
     - Deactivating an already-deactivated member is idempotent.
     - Guard against the actor deactivating themselves (and possibly the last admin). That decision is not in the spec, so see open questions.
   - `POST /api/members/[id]/reactivate` requires manager+, is idempotent, and writes audit.
   - Real `memberGate` implementation in `src/server/members/` (`select status from members where org_id=$1 and sub=$2`, no cache), wired in `getAuthDeps` (replace `allowAll`). Unit-test it against a fake db and test that a thrown query gives 503.
   - Add the new error codes to `API_ERROR_CODES` and `apiCopy.errors`: `employee_code_taken`, `member_in_use` and possibly a self-deactivation code.
   - Validators (employee code, group id, search query, cursor) go in `src/lib/validate/member.ts`, which is pure `lib`, for the "unit tests cover validation" AC.
   - Pure impact helpers (counts to lines, step selection) go in `src/lib/members/` (a `deactivate-impact` helper) so they are unit-testable without the DB, covering the AC "unit tests cover the deactivation impact".
2. **UI (`src/ui/members/*`, copy in `src/ui/copy/members.ts`)**
   - Files to create, mirroring rooms: `MembersPage.tsx` (container, `canManage = atLeastTier(session.tier, "manager")`), `MembersView.tsx` (pure), `useMembers.ts` (search + cursor, restart on `q` change, stale guard), `members-api.ts`, `member-form.ts` (form state and client validation reusing `@/lib/validate/member`), `EditMemberDialog.tsx`, `DeactivateMemberDialog.tsx`, and a `member-list`/`PendingInvitations` subcomponent. Export `MembersPage` from `src/ui/index.ts` and add the barrel entry.
   - Page layout: header with the title, a note that accounts are managed in mmlabs (the "no delete action" scope item), a search input (debounce about 250 ms in the container, not in the view, so the view is testable; labelled with `<label>` or `aria-label`), then the list, then the "Pending invitations" section.
   - List as an accessible table, or cards on small screens, following the `AuditView` table style (`overflow-x-auto`, `th` headings). Show name, email, employee code, group chip (`Chip` exists), status badge, and seat and device counts with their lists.
   - Deactivated rows must be visually and textually distinct (status text, not only colour). Use `RoleBadge` or `Chip` for status.
   - Actions render only when `canManage`: Edit, and Deactivate (or Reactivate for deactivated members). Every button gets an `aria-label` that includes the member name, as `editLabel(code)` does in rooms.
   - Users get the same view without the action column and without edit controls. Hide actions entirely rather than disabling them.
   - Edit dialog: `DialogField` for display name and employee code, `DialogSelect` for group (with a "No group" option). Map `invalid_request`, `employee_code_taken` and `not_found` to inline messages. After success, call `reload` and close.
   - Deactivate dialog: load the impact on open (like `DeleteRoomDialog`). If counts are zero, show a plain confirm. If there are seats or devices, show the counts and a checkbox "Release seats and return devices to inventory" (default checked, or make confirm explicit). Submit label changes accordingly, and a conflict or stale state re-loads the impact. Disable submit while the impact loads.
   - Pagination: "Load more" button (as audit) is consistent and accessible. A search change restarts the list.
   - States: loading (`aria-busy` skeleton), error with retry (`role="alert"` plus `apiErrorMessage`), empty (`shellCopy.pages.members.empty`) and an empty-search message ("No members match").
   - Pending invitations section: read-only list (email, role label, sent date, expiry). Show an empty text when none, and a note that no seats can be assigned to them (spec MEM-01).
   - Keep `no-literals` happy: every visible string, plural helper and aria label lives in `src/ui/copy/members.ts`.
3. **Testability (R5)**
   - Unit (Vitest, no DB): the impact calculation and lines, validators (employee code, patch, cursor, search escaping), `memberGate`, and service functions with a fake `Db` as the existing server tests do.
   - `MembersView` via `renderToStaticMarkup`: Users see no action buttons, Managers do, loading/error/empty/deactivated variants and the pending section.
   - `members-api` tests with a fake fetcher (like `rooms-api.test.ts`), `useMembers` stale-response logic as a pure function if possible, and dialog flow logic (the `delete-flow.ts` pattern) kept in a separate testable module.
   - DB tests (`pnpm test:db`, `members.db.test.ts` exists): deactivate-with-release in one transaction including the primary-device demotion (the deferred trigger must not fire), employee-code uniqueness per org, search and pagination, and org isolation. A rollback case: if one step fails, nothing is released.
   - Route tests: wrapped by `withAuth` (there is a mark `WITH_AUTH_MARK` test pattern), manager-only tiers, a User gets 403 on PATCH and deactivate.
   - A deactivated member's next API call returns 403 `member_deactivated`, and reactivation restores access (AC1). Cover this with a gate test plus a DB test.

### Risks
- A missing DEV-06 helper: no seat release or demotion code exists, so SIM-011 will either create the first one or depend on an unmerged ticket. A wrong ordering fails at commit with 23514, so the transaction needs updates in the correct order (device updates first, or both in one transaction with a deferred trigger, which is already the design). Test it in the DB suite.
- The gate runs one extra query per request on every route. Add the index use (`members_org_sub_key`) and keep it a single indexed lookup. A DB failure now returns 503 for all calls, which is intended (fail closed). Do not cache beyond the request.
- Race: a request being processed when the member is deactivated can still complete; that is accepted, but the deactivate transaction should lock the member row so concurrent edits and self-service (`setOwnDisplayName` already checks deactivated under lock) serialise.
- Personal data: the member list exposes emails and employee codes to all org users. Confirm that is intended. Pending invitations expose emails of invitees.
- A search `q` with `%` or `_` must be escaped; a cursor must be validated (malformed cursor gives 400, not 500).
- Self-lockout: a manager deactivating themselves or the only admin could lock an org out of administration. Needs a decision.
- Stale impact: counts may change between dialog open and confirm. The server must recheck inside the transaction, and the dialog must re-fetch on `member_in_use`.
- Scope creep (R4): SIM-009 invitation recording, member removal and the Identity sync (SIM-020), and groups management (GRP-01) are out of scope. Use graceful empty states.

### Open questions
1. Should Users see the pending invitations section? It contains invitee emails; the spec bullet does not say. I suggest Manager+ only.
2. Is the member list searchable by email as well as name and employee code? MEM-02 says "searchable" without fields.
3. Can a Manager deactivate themselves, or the last Admin or another Admin or Manager? The spec is silent; a rule such as "not yourself" plus "Managers cannot deactivate Admins" avoids lockout and privilege issues. This needs Ming's decision before planning.
4. Deactivation without release: when a member has seats or devices, is declining the release allowed (deactivate but keep seats), or must the seats be released? The spec says "offers to release", so both should work. What happens to their seats then? They stay occupied by a deactivated member; check the pickers' behaviour ("hidden from pickers", other tickets).
5. Where do group options come from before GRP-01? I suggest the members endpoint returns the org's groups; confirm that the group select is wanted in this ticket (scope says Manager+ edits "group").
6. Page size and the shape of seat and device lists on the list (inline compact lists versus an expandable row or detail endpoint). MEM-02 says "member page or card lists every seat and device".
7. Should a User's own row be editable (display name already has the self-service path in `/api/me`)? Assumption: no, read-only per AC4.
8. Do pending invitations that have passed `expires_at` but still have `status='pending'` count as pending? I suggest filtering on `expires_at is null or expires_at > now()`.

Key files read: `/home/user/simap/work/tickets/SIM-011/ticket.md`, `/home/user/simap/docs/spec-v1.md` (MEM-01, MEM-02, DEV-06), `/home/user/simap/work/decisions.md` (D12, D16, D17, D34), `/home/user/simap/src/server/http/with-auth.ts`, `/home/user/simap/src/server/members/members.ts`, `/home/user/simap/src/lib/validate/member.ts`, `/home/user/simap/src/lib/api/error.ts`, `/home/user/simap/src/ui/copy/api.ts`, `/home/user/simap/src/ui/rooms/*`, `/home/user/simap/src/ui/audit/*`, `/home/user/simap/src/ui/EntityFormDialog.tsx`, `/home/user/simap/db/migrations/20261120150000_init.sql`.
