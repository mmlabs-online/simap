## Consult report, SIM-011 members API contract (read-only; nothing edited)

### Findings (what exists)

- **Error shape:** `apiError(status, code)` in `src/server/http/respond.ts` returns `{ error: { code } }` with no message, plus `Cache-Control: no-store`. Codes live in the closed list `API_ERROR_CODES` in `src/lib/api/error.ts`. It already has `forbidden`, `member_deactivated`, `invalid_request`, `not_found`, `unavailable` and `internal`. New domain codes must be added to that list (the rooms ticket added `room_code_taken` and `room_not_empty` the same way).
- **Guard:** `withAuth(handler, { tier })` in `src/server/http/with-auth.ts` runs in this order. It verifies the token. It requires an `org` claim (`org_required`). It derives the tier from `org_roles` only, and 403 `forbidden` if the tier is too low. Then it calls `memberGate(scope, sub)` on every request, and the handler runs after that.
  - A `deactivated` result gives 403 `member_deactivated`. A gate throw gives 503 and fails closed.
  - `getAuthDeps()` currently wires `memberGate: allowAll`, with the comment "SIM-011 replaces this". The gate is the SIM-005 deny list hook; there is no separate deny table.
  - There is no cache between requests. The gate runs per request, so acceptance criterion 1 needs only a real gate (below).
  - The tier check runs before the gate, so a deactivated Manager gets 403 `member_deactivated`, not 403 `forbidden`.
- **`/api/me` already gates a different way:** `getOrCreateMember` and `setOwnDisplayName` in `src/server/members/members.ts` return 403 `member_deactivated` themselves (`Refusal`, `Result<T>`). Once the real gate exists, `/api/me` is refused by the gate before it reaches that code. Keep both; the in-service check is the safe fallback.
- **The deny list is `members.status`.** There is no table to add. The gate is `select status from members where org_id=$1 and sub=$2`. A missing row must return `"active"`, because first visit creates the member in `/api/me` through `ensure()`. Do not refuse a missing row, or no one could ever become a member.
- **Schema (`db/migrations/20261120150000_init.sql`) already has everything needed, so no migration is required:**
  - `members` has `employee_code` (partial unique index `members_org_employee_code_key`, where not null), `group_id` (composite FK to `groups`), `status` and `updated_at`.
  - `seats.occupant_id` is an FK to members.
  - `devices.owner_id` is an FK. A placed device has `seat_id` not null.
  - `seat_requests` has `subject_id` and `created_by_id`.
  - `invitations` has a status and a unique pending email per org.
  - The deferred triggers enforce invariant 3 (a primary device must be owned by the seat occupant), checked at COMMIT. This is why DEV-06 demotion must be in the same transaction.
- **Patterns to copy:**
  - Service results use `Result<T> | Refusal` with an `Abort` class and `inTx` (`src/server/rooms/rooms.ts`).
  - All SQL goes through `orgQuery`, which binds `$1` as the org.
  - `writeAudit(c, scope, {...})` runs inside the transaction.
  - There is an impact-preview pattern: `GET .../delete-impact` plus `force` on DELETE.
  - The lock-order rule is documented in `rooms.ts`: the room row first (`for share` when only changing an occupant or placement), then seat rows `for update` in ascending id order, then devices and requests.
  - List pagination is in `src/server/audit/audit.ts` and `src/lib/validate/audit-query.ts`: keyset, `limit+1` fetch, `nextCursor`, strict parse (a duplicated param gives 400; limit regex `^[1-9]\d{0,2}$`, default 50, max 100). The cursor is base64url JSON.
  - Route files are `export const dynamic = "force-dynamic"`, with `NO_STORE` headers and `isCanonicalUuid(id)` else 404.
  - `src/app/api/routes-guarded.test.ts` fails unless every exported method is wrapped in `withAuth`.
  - `readJson` plus a `validate*` function that returns `Validated<T>` (`{ok:false, field}`) is the body pattern. `validateMePatch` rejects unknown keys. `normalizeDisplayName` already exists in `src/lib/validate/member.ts`, so reuse it for PATCH.
- **Spec:**
  - MEM-01 and MEM-02 say Manager+ edits display name, employee code (unique if set) and group, and deactivates. The member keeps history and is hidden from pickers.
  - Deactivation warns with counts and offers to release seats and return devices in the same step. There is no delete. Removal from the org is out of scope (SIM-020).
  - MEM-02: the member lists their seats and devices with counts, and is searchable.
  - Pending invitations are listed read-only (D16).
  - DEV-06: every path that removes an occupant demotes the seat's primary device to secondary, in the same transaction.
  - User tier sees all members read-only (spec section 3 role table).

### Recommendations

**Routes** (all via `withAuth`; Users can GET, Managers+ mutate):

1. `GET /api/members?q=&status=&limit=&cursor=` (tier `user`).
   - Order by `lower(display_name), id` and page by keyset on that pair, with the cursor encoding the same pair. Reuse the audit approach: `limit+1`, `nextCursor`, default 50, max 100, strict param parsing, 400 `invalid_request` on bad or duplicated params.
   - Do not reuse `src/lib/audit/cursor.ts`, because its shape is (at, id). Write a small `src/lib/members/cursor.ts`, or make that module generic.
   - `q` is trimmed and capped (for example 80 characters). Match with `ilike` on display_name, email and employee_code, and escape `%`, `_` and `\` (use `escape '\'`). Never interpolate `q`.
   - `status` is `active` (default for pickers), `deactivated` or `all`. Make that an explicit enum; the Members page needs `all`.
   - Item fields: `id, displayName, email, employeeCode, groupId, group {id,name,color}|null, status, seatCount, deviceCount`, plus compact `seats:[{id,code}]` and `devices:[{id,name,seatId|null}]`. Cap the compact lists per member (for example 20) and return the true counts. This keeps a page bounded, with no unbounded join fan-out.
   - Compute the counts with grouped subqueries scoped by `org_id` (`count(*)::int` on `seats.occupant_id` and `devices.owner_id`). Do not join both tables in one query; that multiplies rows.
   - Pending invitations: a separate section. Either put `invitations: [...]` only on the first page (no cursor), capped at 100, or use `GET /api/members/invitations`. The second is simpler and does not complicate paging. Return email, role and createdAt only (no `identity_invitation_id`). The invitations table may be empty because SIM-009 data may not exist; return `[]`.
   - Do not expose `sub` unless the UI needs it. The audit-log screen filters actors by sub, but that is Admin only.
2. `GET /api/members/[id]` (tier `user`). One member with full seat and device lists, for MEM-02 and the edit form. Optional but cheap.
3. `PATCH /api/members/[id]` (tier `manager`). Body keys are only `displayName`, `employeeCode` and `groupId`. Reject unknown or empty bodies with 400.
   - `displayName` goes through `normalizeDisplayName`.
   - `employeeCode` is a string or `null` (clearing). Trim it, 1-32 characters, with a restricted charset or at least no control characters. Decide the casing policy: the unique index is case-sensitive, so either normalize (for example trim only) or document that "e1" and "E1" differ. Put the validator in `src/lib/validate/member.ts` with unit tests.
   - `groupId` is a canonical UUID or `null`. A group that does not exist in the org gives a composite-FK violation (23503), which must map to 400 `invalid_request` or 404, not 500. Preferably check it with an `orgQuery` first.
   - Unique violation 23505 on `members_org_employee_code_key` maps to 409 `employee_code_taken` (new code). Look at `src/server/rooms/pg-error.ts` and mirror it, matching the constraint name.
   - Manager+ editing a deactivated member: allow it (history, tidying), unless the planner decides otherwise.
   - Inside the transaction: `select ... for update` on the member row, update only the changed fields, and `writeAudit` with `action: "member.update"`, `meta: { fields: [...] }` (names only, no values; existing code uses field names and no PII). A no-op patch should write no audit and return the row. Return the full member DTO.
4. `GET /api/members/[id]/deactivation-impact` (tier `manager`). Return `{ occupiedSeats, placedDevices, pendingRequests }` (and optionally the lists). This mirrors `delete-impact`. It is a preview only; the real count is recomputed under lock at confirm.
5. `POST /api/members/[id]/deactivate` with body `{ release: boolean }`, and `POST /api/members/[id]/reactivate` (tier `manager`). A verb sub-resource is clearer than PATCHing `status`, and it keeps PATCH to profile fields. Both are idempotent:
   - Deactivating an already deactivated member returns 200 with the current member (no second audit).
   - Reactivation does not restore seats or devices. Say so in the UI text.
   - Deactivate with `release:false`, when the member holds seats or placed devices: the spec says "offers to release" (D34), so deactivation without release should be allowed. In that case the member stays as occupant and owner while deactivated. That is acceptable for history and consistent with the spec, but it leaves "ghost" seats, so the planner should confirm. The alternative (409 `member_has_assignments` unless `release:true`) matches the room_not_empty `force` pattern. My recommendation is to copy `force`: `release:false` and a non-empty impact gives 409 `member_not_empty`, which forces the UI to show the counts.
   - `release:true` runs in one transaction. Order, per the documented lock order: lock the member row, then the rooms of the member's seats (`for share`), then the member's seat rows `for update` in id order, then devices.
     1. Update the occupied seats: `occupant_id = null`.
     2. Demote the primary device on those seats (DEV-06): `role = 'secondary'`. Primary devices are always owned by the occupant, which is this member, but the generic rule covers all primaries on those seats.
     3. Return all placed devices owned by the member: `seat_id = null, role = 'secondary'`. This includes borrowed secondaries on other seats.
     4. Cancel pending `seat_requests` where `subject_id` is the member (see open question).
     5. Set `status = 'deactivated'`.
     6. `writeAudit` one `member.deactivate` row with counts and `released: true`, plus the seat and device ids if wanted.
   - Order matters: the deferred triggers are checked at commit, but demote or clear within the same transaction in any order. Seats' `occupant_id` is the only FK; devices FK to seats `on delete restrict`, which is not hit here.
   - Self-deactivation by the actor: refuse with 409 (new code `cannot_deactivate_self`) or 403 `forbidden`. A Manager deactivating themselves would lock themselves out immediately. Also consider whether a Manager may deactivate an Admin. Role tiers come only from `org_roles` in the token, not from the member row, so the service does not know the target's tier. Say that to the planner (open question 4).
   - Reactivate: lock, set `status='active'`, audit `member.reactivate`.

**Gate** (acceptance criterion 1): replace `allowAll` in `getAuthDeps()` with a function in `src/server/members/` (for example `memberGate(scope, sub)`) that does the single-row `members.status` query via `orgQuery` on the pool. If no row, return `"active"`. Importing `getPool` in `with-auth.ts` is fine (it is server code). If the pool is null (no DB), throw so the guard returns 503 (fail closed). Keep `createWithAuth` dependency-injected so existing `with-auth.test.ts` is unchanged, and add unit tests for the gate with a fake db.
- One extra query per request is acceptable at this size. Do not cache.
- Test that the guard sends 403 `member_deactivated` for a deactivated caller on any route, and that reactivation restores access on the next call.

**Errors for the new routes:** 400 `invalid_request` (body, params, cursor, limit); 404 `not_found` (non-UUID id, or an id not in the org; orgQuery scoping makes cross-org ids indistinguishable from missing, which is the desired behavior); 409 `employee_code_taken`; 409 `member_not_empty` (if the `release` flag design is adopted); 403 `forbidden`/`member_deactivated` from the guard; 503 `unavailable`. Add each new code to `API_ERROR_CODES` and to the UI copy mapping in `src/ui/copy/members.ts` (D36).

**Role checks:** use `{ tier: "user" }` for GETs and `{ tier: "manager" }` for PATCH, deactivate and reactivate. The UI shows edit actions based on `tier` from `/api/me`, but the server decides. "Users see read-only, Managers see edit" is the acceptance criterion. Test 403 `forbidden` for a User on every mutating route.

**Layering (R1/R2):** validators in `src/lib/validate/member.ts` (pure), DTO types in `src/lib/members/types.ts`, impact calculation as a pure function in `src/lib/members/` (so "unit tests cover the deactivation impact" is testable without DB, like `canDeleteDirectly` in `src/lib/rooms/delete-impact`), and SQL in `src/server/members/`. Routes only in `src/app/api/members/**`. No migration (no schema change; R2 is satisfied trivially). Add a DB integration test to `src/server/members/members.db.test.ts` for the release transaction (seat cleared, primary demoted, devices returned, commit passes the deferred trigger) and for the employee-code unique violation.

### Risks

- **Deferred trigger at commit:** if release leaves a primary device on a seat whose occupant is cleared, commit raises 23514 (surfaced as a 500). The demotion must cover every primary device on the member's seats, not only devices the member owns.
- **Concurrency:** a concurrent seat assignment or device placement for the same member while deactivating can race the impact count. Follow the room/seat lock order and recompute the counts under lock; do not trust the preview.
- **Lock-order deadlocks:** the member row lock must come before seat locks, and seat rows go in ascending id order; do not lock a room while holding a seat lock. Note that room `for share` locks are required for occupant changes in the documented order, so the release step must lock the affected rooms first.
- **Deactivated member as occupant or owner after a no-release deactivation:** pickers hide them, but the seat still shows them. The UI has to show a "deactivated" badge.
- **Pagination correctness:** the sort key `lower(display_name)` is not unique; the tiebreak on id and a matching cursor are required. A page that mixes the count joins can double-count; use subqueries.
- **Lockout:** self-deactivation or deactivating the last active Manager/Admin removes all management access in simap (Identity roles remain, but a deactivated Admin cannot call any API). Reactivation requires another Manager+. Consider refusing to deactivate self and warn about the last Manager.
- **Gate failure mode:** if the gate query errors, every request becomes 503. That is the intended fail-closed behavior, but it needs a test, and the `/api/me` first-visit path must not be broken by the gate (a missing row returns `"active"`).
- **LIKE injection:** unescaped `%` and `_` in `q` are not a security hole (parameterized) but give wrong results and can be slow; escape them.
- **PII:** the audit meta must carry field names and counts only; do not put emails or employee codes in meta.

### Open questions for the planner (or Ming)

1. Should deactivation without release be allowed (spec wording says "offers"), or should a member with assignments require an explicit `release` choice (409 otherwise)? I recommend allowing both choices but forcing the server to refuse silent no-ops: either path must be explicit in the request body.
2. Pending seat requests of the deactivated member (as subject or creator): cancel them in the same transaction? The spec does not say. I recommend cancelling those where the member is the subject (status `cancelled`, `decided_by` the actor, `decided_at` now, since the check constraint requires `decided_at` when not pending), and leaving requests they created for others. Needs a decision, and the count belongs in the impact preview.
3. Employee code rules: length and charset, and case sensitivity (the unique index is case-sensitive).
4. May a Manager deactivate an Admin (or another Manager), and may anyone deactivate themselves? The member row has no role, so tier-based rules would need the target's tier from Identity, which simap does not have. Simplest rule: refuse self-deactivation only, and note the limitation.
5. Should the list default hide deactivated members (spec says hidden from pickers) while the Members page shows all with a badge? I assume the page shows all by default and `status=active` is used by pickers; confirm.
6. Invitations: confirm the shape of the SIM-009 data (it may not exist yet). A separate endpoint returning `[]` when empty is the safe default.
7. Audit action names for the log screen: `member.update` is already used by `/api/me`; confirm `member.deactivate` and `member.reactivate` as new actions. The self-edit path marks `self: true` in meta, which Manager edits should omit.

Files read: `/home/user/simap/work/tickets/SIM-011/ticket.md`, `/home/user/simap/docs/spec-v1.md` (MEM, DEV-06, role table), `/home/user/simap/work/decisions.md` (D12, D16, D17, D34), `/home/user/simap/src/server/http/with-auth.ts`, `/home/user/simap/src/server/http/respond.ts`, `/home/user/simap/src/lib/api/error.ts`, `/home/user/simap/src/server/members/members.ts`, `/home/user/simap/src/server/rooms/rooms.ts`, `/home/user/simap/src/server/audit/audit.ts`, `/home/user/simap/src/server/audit/write.ts`, `/home/user/simap/src/lib/validate/member.ts`, `/home/user/simap/src/lib/validate/audit-query.ts`, `/home/user/simap/src/lib/audit/cursor.ts`, `/home/user/simap/src/app/api/me/route.ts`, `/home/user/simap/src/app/api/rooms/[id]/route.ts`, `/home/user/simap/src/app/api/rooms/[id]/delete-impact/route.ts`, `/home/user/simap/src/app/api/routes-guarded.test.ts`, `/home/user/simap/db/migrations/20261120150000_init.sql`.
