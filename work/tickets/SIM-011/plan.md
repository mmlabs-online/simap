Status: READY

# Plan — SIM-011: Members page, profile fields and deactivation

> **Plan approval gate applies.** This plan modifies `src/server/http/with-auth.ts` and `src/server/http/with-auth.test.ts`,
> which match the High path `src/server/http/**` (`.claude/loop.config.md` → High paths). Policy is `high-paths`, so Ming
> must approve this plan before IMPLEMENT, even though the ticket's Gate column says `none`.
>
> **Split:** this plan covers slice 1 only: the members API, the real deny-list gate, validators, the pure impact logic and
> their tests. The Members page UI is slice 2 (`SIM-011.2`, see `## Split proposal`). This matches the SIM-010 / SIM-010.2 split.

## Scope summary
Spec `docs/spec-v1.md` §MEM (lines 292-313):
- MEM-01: "A Manager+ edits a member's simap fields (display name, employee code (unique in the org if set), group)."
- MEM-01: "A Manager+ can **deactivate** a member in simap: the member keeps their history, cannot request seats or own new
  devices, is hidden from pickers, and simap refuses their calls to org data (app-local deny list, `consumers.md` item 11).
  Reactivation undoes it (D34)."
- MEM-01: "Deactivating or removing a member who still occupies seats or owns placed devices warns with the counts and offers
  to release the seats and return the devices to inventory in the same step (D34)."
- MEM-01: "The Members page also lists the org's pending invitations sent from simap (read-only; no seat can be assigned to
  them) (D16)."
- MEM-02: "The member page or card lists every seat the member occupies and every device they own, with counts. It is
  searchable."
- DEV-06 (line 287): "Every path that removes or replaces an occupant turns the seat's primary device into secondary, in the
  same transaction."
- §2 role table (line 64): User "Views all rooms, seats, members and devices of the org." Manager (line 63): "Manages members".

`work/decisions.md`:
- D12: "A member is simap's profile of one account in one org."
- D16 (a): "a member appears on the account's first visit; Managers assign only known members; pending invitations sent from
  simap are listed read-only."
- D17: "Display name: … editable by Managers".
- D34: "Members are never deleted in simap: Manager+ deactivate (simap-local) or an Admin removes them from the org".
- D36: names keep Vietnamese diacritics (display, sort, search); UI copy in copy files.

Ticket risk: "Deny list must be checked per request (no caching beyond the request)."

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | A deactivated member's next API call to org data is refused; reactivation restores access. | `src/server/members/gate.test.ts` (fake db: `deactivated` row → `"deactivated"`, `active` → `"active"`, no row → `"active"`, null pool / query throw → throws). `src/server/http/with-auth.test.ts › default deps wire the DB member gate`. `src/server/members/manage.db.test.ts › gate: deactivate makes the gate return deactivated; reactivate returns active on the next call`. The existing `with-auth.test.ts` gate test already proves `deactivated` → 403 `member_deactivated` and throw → 503. |
| 2 | Deactivating a member with seats/devices shows the counts and, on confirm, releases them in one transaction with DEV-06 demotion. | API half here: `GET /api/members/[id]/deactivation-impact` returns the counts (`manage.db.test.ts › impact counts seats, placed devices, primaries to demote, pending requests`). `manage.db.test.ts › deactivate with release: seats cleared, primary demoted, owned placed devices returned, other members' secondaries untouched, pending requests cancelled, one audit row, commit passes the deferred trigger`. `manage.db.test.ts › deactivate without release on a non-empty member → 409 member_not_empty, nothing changed`. `manage.test.ts › failure mid-release rolls back`. The dialog showing the counts is SIM-011.2. |
| 3 | Employee code is unique within the org. | `manage.db.test.ts › employee code: duplicate in the same org → 409 employee_code_taken; same code in another org OK; clearing to null frees it`. `src/server/members/pg-error.test.ts`. `src/lib/validate/member.test.ts › normalizeEmployeeCode` (uppercase normalisation makes `e1`/`E1` collide). |
| 4 | Users see the list read-only; Managers see edit actions. | Server half here: `src/app/api/members/route.test.ts › User tier: GET list/detail 200; PATCH, deactivate, reactivate, deactivation-impact, invitations → 403 forbidden`; Manager → passes the guard. UI half (actions hidden for Users) is SIM-011.2. |
| 5 | Unit tests cover the deactivation impact and validation. | `src/lib/members/deactivation.test.ts`, `src/lib/validate/member.test.ts`, `src/lib/validate/member-query.test.ts`, `src/lib/members/cursor.test.ts`, `src/lib/members/search.test.ts`, `src/lib/members/profile.test.ts`, all in `pnpm test` (no DB). |

All Checks green: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`; `pnpm test:db` in CI.

## Ming verification after merge
- Local manual run (ticket test plan "deactivate a member who holds a seat") is easier after SIM-011.2 ships the UI. Until
  then, with `pnpm dev` + dev token: `POST /api/members/<id>/deactivate {"release":true}` for a seeded member who holds a
  seat, then call any `/api/*` route as that member → 403 `member_deactivated`; reactivate → access restored.
- Confirm the defaults listed under `## Assumptions` (A1-A8).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/server/http/with-auth.ts` | Replace `allowAll` in `getAuthDeps()` (line 109) with `dbMemberGate` from `@/server/members/gate`; delete the `allowAll` const (line 36) and update the comment on line 21. No change to `createWithAuth`. | AC1: real deny list | **Yes** (`src/server/http/**`) |
| `src/server/http/with-auth.test.ts` | Add one test: default deps wire `dbMemberGate`. | AC1 | **Yes** (`src/server/http/**`) |
| `src/server/members/gate.ts` (new) | `createMemberGate(getPool)` + `dbMemberGate = createMemberGate(getPool)`. Single indexed lookup, no cache. | AC1 | No |
| `src/server/members/gate.test.ts` (new) | Gate unit tests with a fake pool. | AC1 | No |
| `src/server/members/manage.ts` (new) | `listMembers`, `getMember`, `listGroupOptions`, `listPendingInvitations`, `updateMember`, `getDeactivationImpact`, `deactivateMember`, `reactivateMember`; local `Refusal`/`Result`/`Abort`/`inTx` (copy of the `rooms.ts` lines 14-38 pattern). | MEM-01, MEM-02, AC2, AC3 | No |
| `src/server/members/manage.test.ts` (new) | Fake-Db unit tests (SQL order, lock order, refusals, rollback), like `src/server/rooms/rooms.test.ts`. | R5 | No |
| `src/server/members/manage.db.test.ts` (new) | DB integration tests (`pnpm test:db`) using `src/test/db/fixtures.ts` (`addMember`, `addRoom`, `addSeat`, `addDevice`, `addPendingRequest`). | AC1-AC3 | No |
| `src/server/members/pg-error.ts` (new) | `memberConflict(err)`: 23505 on `members_org_employee_code_key` → `"employee_code_taken"`; 23503 on `members_group_fkey` → `"invalid_group"` (mapped to 400). Mirrors `src/server/rooms/pg-error.ts`. | AC3 | No |
| `src/server/members/pg-error.test.ts` (new) | Unit tests for the mapper. | AC3 | No |
| `src/server/rooms/rooms.ts` | **Comment only**, lines 213-219: add step "0. a member row (`for update`) before any room/seat lock, when deactivating a member (SIM-011)". | Keeps the single documented lock order true (deadlock safety) | No |
| `src/lib/members/types.ts` | Add DTO types: `MemberSeatRef`, `MemberDeviceRef`, `MemberGroupRef`, `MemberDto`, `MemberListResponse`, `PendingInvitationDto`, `DeactivationImpact`, `MemberStatusFilter`, `MEMBER_LIMITS`. Keep `MeMemberDto`. | Shared API contract (lib) | No |
| `src/lib/members/deactivation.ts` (new) | Pure: `needsRelease(impact)`, `decideDeactivation({impact, release, isSelf, status})`. | AC5 (impact logic unit-testable) | No |
| `src/lib/members/deactivation.test.ts` (new) | Unit tests. | AC5 | No |
| `src/lib/members/profile.ts` (new) | Pure: `changedFields(current, patch)` → list of changed field names. | No-op patch writes no audit | No |
| `src/lib/members/profile.test.ts` (new) | Unit tests. | AC5 | No |
| `src/lib/members/cursor.ts` (new) | `encodeMemberCursor({k,id})` / `decodeMemberCursor(s)`; same strictness as `src/lib/audit/cursor.ts`. | Keyset paging | No |
| `src/lib/members/cursor.test.ts` (new) | Unit tests. | Pagination bounds | No |
| `src/lib/members/search.ts` (new) | `escapeLike(s)` (escapes `\`, `%`, `_`). | Correct ILIKE search | No |
| `src/lib/members/search.test.ts` (new) | Unit tests. | AC5 | No |
| `src/lib/validate/member.ts` | Add `normalizeEmployeeCode`, `validateMemberPatch`, `validateDeactivateBody`. Keep existing exports unchanged. | AC3, AC5 | No |
| `src/lib/validate/member.test.ts` | Add tests for the new functions. | AC5 | No |
| `src/lib/validate/member-query.ts` (new) | `parseMemberQuery(params)` (q, status, limit, cursor), pattern of `src/lib/validate/audit-query.ts`. | AC5, bounded pages | No |
| `src/lib/validate/member-query.test.ts` (new) | Unit tests. | AC5 | No |
| `src/lib/api/error.ts` | Add `employee_code_taken`, `member_not_empty`, `cannot_deactivate_self` to `API_ERROR_CODES`. | One error shape | No |
| `src/ui/copy/api.ts` | Add English messages for the three new codes (the `satisfies Record` forces it). | D36; typecheck | No |
| `src/app/api/members/route.ts` (new) | `GET` list (tier `user`). | MEM-02 | No |
| `src/app/api/members/invitations/route.ts` (new) | `GET` pending invitations (tier `manager`). | MEM-01 / D16 | No |
| `src/app/api/members/[id]/route.ts` (new) | `GET` detail (tier `user`), `PATCH` (tier `manager`). | MEM-01, MEM-02 | No |
| `src/app/api/members/[id]/deactivation-impact/route.ts` (new) | `GET` (tier `manager`). | AC2 | No |
| `src/app/api/members/[id]/deactivate/route.ts` (new) | `POST` (tier `manager`). | AC1, AC2 | No |
| `src/app/api/members/[id]/reactivate/route.ts` (new) | `POST` (tier `manager`). | AC1 | No |
| `src/app/api/members/route.test.ts` (new) | Route tests for all six route files (pattern of `src/app/api/rooms/route.test.ts`: `globalThis.__simapAuth` fake, `vi.mock("@/server/members/manage")`). | AC4, codes | No |

`src/app/api/routes-guarded.test.ts` needs no change: it discovers the new `route.ts` files on its own.
Not touched: `src/server/members/members.ts` (`/api/me` keeps its own deactivated check as a fallback), `db/migrations/**`.

## Data model / migration
None. `db/migrations/20261120150000_init.sql` already has everything:
- `members` (lines 37-57): `employee_code text null` + partial unique index `members_org_employee_code_key (org_id, employee_code) where employee_code is not null`; `group_id` + composite FK `members_group_fkey`; `status` check `('active','deactivated')`; `members_org_sub_key unique (org_id, sub)` (the gate's index).
- `seats.occupant_id` (FK `seats_occupant_fkey`, index `seats_org_occupant_idx`); `devices.owner_id`, `seat_id`, `role`, `devices_primary_needs_seat_check`, unique `devices_one_primary_per_seat`; the deferred constraint triggers `devices_primary_owner_trg` / `seats_primary_owner_trg` (lines 225-271) raise 23514 at COMMIT if a primary device's owner is not the seat occupant.
- `seat_requests` (lines 143-166): `seat_requests_decided_check ((status = 'pending') = (decided_at is null))`, `decided_by_id` nullable FK to members.
- `invitations` (lines 190-206).
R2 is met trivially (no schema change).

## API contract
All routes: `export const dynamic = "force-dynamic"`, `Cache-Control: no-store`, wrapped in `withAuth`, `getPool()` null → 503 `unavailable`, non-canonical `[id]` → 404 `not_found` (`isCanonicalUuid`), bodies via `readJson` (`src/server/request/read-json`). Every SQL goes through `orgQuery`; every subquery and join repeats `org_id = $1` (R6). Errors are `{ error: { code } }` only.

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| GET | `/api/members` | Query `q` (optional, trimmed, NFC, whitespace collapsed, ≤ 80 code points), `status` = `active` (default) \| `deactivated` \| `all`, `limit` (`^[1-9]\d{0,2}$`, default 50, max 100), `cursor` (opaque). A repeated param → 400. Unknown params ignored (as audit). | `200 { items: MemberDto[], nextCursor: string \| null, groups: MemberGroupRef[] }`. Order `lower(display_name), id`. `seats`/`devices` per item capped at 20 (`MEMBER_LIMITS.listRefs`); `seatCount`/`deviceCount` are the true counts. `groups` = all org groups ordered by `lower(name), id`, capped at 500 (option source for the edit form until SIM-016). | 400 `invalid_request`, 401, 403 `forbidden`/`member_deactivated`/`org_required`, 503 | user |
| GET | `/api/members/invitations` | none | `200 { items: PendingInvitationDto[] }` where `{ id, email, role, createdAt, expiresAt }`; `status = 'pending' and (expires_at is null or expires_at > now())`, ordered `created_at desc, id`, cap 100. `[]` when SIM-009 has written nothing. No `identity_invitation_id`, no `invited_by_sub`. | 401, 403, 503 | manager |
| GET | `/api/members/[id]` | none | `200 MemberDto` with full `seats`/`devices` lists (cap 500 each, `MEMBER_LIMITS.detailRefs`). | 404 `not_found`, 401, 403, 503 | user |
| PATCH | `/api/members/[id]` | JSON, at least one of `displayName` (string, `normalizeDisplayName`), `employeeCode` (string or `null`; `""`/whitespace → `null`; else `normalizeEmployeeCode`), `groupId` (canonical UUID or `null`). Unknown key or empty object → 400. | `200 MemberDto` (detail shape). No-op patch → 200, no write, no audit. | 400 `invalid_request` (body, or group not in the org), 404 `not_found`, 409 `employee_code_taken`, 401, 403, 503 | manager |
| GET | `/api/members/[id]/deactivation-impact` | none | `200 DeactivationImpact = { occupiedSeats, placedDevices, primaryDevicesToDemote, pendingRequests }` (ints). Preview only; recomputed under lock at confirm. | 404, 401, 403, 503 | manager |
| POST | `/api/members/[id]/deactivate` | JSON `{ release: boolean }` (required; unknown keys → 400) | `200 MemberDto` (detail shape, `status: "deactivated"`). Already deactivated → 200 current DTO, no write, no audit. | 400 `invalid_request`, 404, 409 `member_not_empty` (`release:false` and the member occupies seats or has placed devices), 409 `cannot_deactivate_self`, 401, 403, 503 | manager |
| POST | `/api/members/[id]/reactivate` | none (body ignored) | `200 MemberDto`. Already active → 200, no audit. Seats/devices are **not** restored. | 404, 401, 403, 503 | manager |

`MemberDto` = `{ id, displayName, email, employeeCode: string | null, group: { id, name, color } | null, status: "active" | "deactivated", seatCount, deviceCount, seats: { id, code }[], devices: { id, name, inventoryNumber, role: "primary" | "secondary", seatId: string | null, seatCode: string | null }[] }`. `sub` is never exposed. `deviceCount` counts all owned devices (placed and in inventory, MEM-02 "every device they own").

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `src/lib/validate/member.test.ts › normalizeEmployeeCode: trims, uppercases, accepts A-Z 0-9 . _ - up to 32; rejects inner spaces, diacritics, control chars, 33 chars, non-strings` | AC3, AC5 |
| `src/lib/validate/member.test.ts › validateMemberPatch: each field alone; all three; empty object, array, unknown key → field error; employeeCode "" / "  " / null → null; groupId non-canonical → error; displayName Vietnamese NFC kept` | AC5, domain focus (diacritics, empty/null) |
| `src/lib/validate/member.test.ts › validateDeactivateBody: {release:true/false} ok; missing, non-boolean, extra key → error` | AC5 |
| `src/lib/validate/member-query.test.ts › defaults (status active, limit 50); q trimmed/NFC/collapsed, blank → absent, 81 code points → error; status enum; limit 0, 101, "01", "1e2" → error; duplicated params → error; bad cursor → error` | AC5, pagination bounds |
| `src/lib/members/cursor.test.ts › round-trip incl. Vietnamese key; rejects non-base64url, extra/missing keys, non-uuid id, non-string k, k over 320 code points` | Pagination bounds |
| `src/lib/members/search.test.ts › escapeLike escapes \ % _ and leaves other text (incl. diacritics) unchanged` | Search correctness |
| `src/lib/members/deactivation.test.ts › needsRelease true iff occupiedSeats>0 or placedDevices>0 (pendingRequests alone is false); decideDeactivation: self → refuse_self; already deactivated → noop; non-empty + release false → refuse_not_empty; non-empty + release true → release; empty → deactivate` | AC2, AC5 |
| `src/lib/members/profile.test.ts › changedFields: none when equal; detects each field; null vs value; undefined keys ignored` | No-op audit |
| `src/server/members/gate.test.ts › active row → active; deactivated row → deactivated; no row → active (first visit still works); getPool() null → throws; query error → throws; SQL is org-scoped by sub, no caching between calls (two calls → two queries)` | AC1, ticket risk |
| `src/server/http/with-auth.test.ts › default deps wire the DB member gate (globalThis.__simapAuth.deps.memberGate === dbMemberGate after one guarded call)` | AC1 |
| `src/server/members/pg-error.test.ts › 23505 members_org_employee_code_key → employee_code_taken; 23503 members_group_fkey → invalid_group; other constraints/codes → null` | AC3 |
| `src/server/members/manage.test.ts › deactivate: lock order member → rooms (for share, id order) → seats (for update, id order) → devices/requests; refusals roll back; an error after the seat update rolls back (ROLLBACK issued, no COMMIT)` | AC2, deadlock safety |
| `src/server/members/manage.test.ts › updateMember: no-op → no UPDATE, no audit; group not in org → 400 invalid_request, ROLLBACK; 23505 → 409 employee_code_taken` | AC3 |
| `src/server/members/manage.db.test.ts › impact counts seats, placed devices, primaries to demote, pending requests` | AC2 |
| `src/server/members/manage.db.test.ts › deactivate with release: seats cleared, primary demoted, owned placed devices (incl. a borrowed secondary on another member's seat) returned to inventory as secondary, another member's secondary on the released seat untouched, pending requests where subject cancelled (decided_at set, decided_by = actor member), requests the member created for others untouched, status deactivated, one member.deactivate audit row with counts only, commit passes the deferred trigger` | AC2, DEV-06 |
| `src/server/members/manage.db.test.ts › deactivate without release on a non-empty member → 409 member_not_empty, nothing changed; on an empty member → deactivated (pending requests still cancelled)` | AC2 |
| `src/server/members/manage.db.test.ts › deactivate self → 409 cannot_deactivate_self; deactivate twice → second is a no-op with no second audit row; reactivate → active, member.reactivate audit, seats not restored` | AC1, idempotency |
| `src/server/members/manage.db.test.ts › gate: deactivate makes dbMemberGate return deactivated; reactivate returns active on the next call` | AC1 |
| `src/server/members/manage.db.test.ts › employee code: duplicate in the same org → 409 employee_code_taken; same code in another org OK; clearing to null frees it` | AC3 |
| `src/server/members/manage.db.test.ts › updateMember: changes only given fields, member.update audit meta {fields:[…]} with no values and no self flag; editing a deactivated member works; group of another org → 400` | MEM-01, R6 |
| `src/server/members/manage.db.test.ts › list: search by name with diacritics, by email, by employee code; q containing % and _ matches literally; status filter; pages of 2 over members with equal display names cover every member exactly once; counts are true while refs are capped at 20; other org's members never appear` | MEM-02, pagination, R6 |
| `src/server/members/manage.db.test.ts › invitations: only pending, unexpired, own org; empty table → []` | D16 |
| `src/app/api/members/route.test.ts › no Authorization → 401 on every handler` | Guard |
| `src/app/api/members/route.test.ts › User tier: GET list and detail pass; PATCH, deactivate, reactivate, deactivation-impact, invitations → 403 forbidden` | AC4 |
| `src/app/api/members/route.test.ts › non-canonical id → 404; bad JSON / invalid body / bad query → 400; service refusals map to status+code; responses carry Cache-Control: no-store` | Error shape |

## Approach
1. **Lib first (pure, R1 `lib → lib`).** Types and `MEMBER_LIMITS = { defaultLimit: 50, maxLimit: 100, q: 80, employeeCode: 32, listRefs: 20, detailRefs: 500, invitations: 100, groups: 500 }` in `src/lib/members/types.ts`. `normalizeEmployeeCode` mirrors the room-code rule in `src/lib/validate/room.ts` lines 13-23 (trim, `toUpperCase`, `^[A-Z0-9._-]+$`, 1-32). `validateMemberPatch` follows `validateMePatch` (reject unknown keys; also reject an empty object). Cursor = base64url JSON `{k, id}` where `k` is the DB-returned `lower(display_name)` (never lowercased in JS, so the keyset compares with the same collation). Write the unit tests with each module.
2. **Gate (`src/server/members/gate.ts`, starts with `import "server-only"`).** `createMemberGate(getPool)` returns a `MemberGate`: `const pool = getPool(); if (!pool) throw new Error("db_unavailable")`, then `orgQuery(pool, scope, "select status from members where org_id = $1 and sub = $2", [sub])`; no row → `"active"` (first visit creates the row in `/api/me`; refusing a missing row would lock everyone out); `"deactivated"` → `"deactivated"`. Nothing is cached; `getPool` is read per call. A throw becomes 503 in `withAuth` (fail closed, lines 72-79).
3. **Wire the gate (High path).** In `src/server/http/with-auth.ts`: `import { dbMemberGate } from "@/server/members/gate"`; line 109 `memberGate: dbMemberGate`; remove `allowAll` (line 36); comment on line 21 now says the gate is `members.status`. `createWithAuth` and its DI stay unchanged, so existing tests and the route tests that inject `memberGate` keep working. Order stays: verify → org → tier → gate → handler (a deactivated Manager gets 403 `member_deactivated`; a User calling a Manager route gets 403 `forbidden` without a gate query).
4. **Service `src/server/members/manage.ts`.**
   - Read paths use one query per page: `members m left join groups g on g.org_id = m.org_id and g.id = m.group_id where m.org_id = $1 …`, counts and capped ref lists as correlated subqueries that each repeat `org_id = $1` (`count(*)::int`, `coalesce((select json_agg(…) from (select … order by … limit N) x), '[]')`). Never join seats and devices in one fan-out. Search: `(m.display_name ilike $q escape '\' or m.email ilike $q escape '\' or m.employee_code ilike $q escape '\')` with `$q = '%' || escapeLike(q) || '%'`, always a bound parameter. Keyset: `and (lower(m.display_name), m.id) > ($k, $id) order by lower(m.display_name), m.id limit $limit + 1`.
   - `updateMember`: in a transaction, `select … from members where org_id = $1 and id = $2 for update` (404 if missing). If `groupId` is set, check `select 1 from groups where org_id = $1 and id = $2` → else Abort 400 `invalid_request`. `changedFields` decides; none → return the DTO. Otherwise update only those columns + `updated_at = now()`, `writeAudit(c, scope, { actorSub, action: "member.update", entity: "member", entityId, meta: { fields } })` (names only, no values, no `self`). `inTx` maps `memberConflict`: `employee_code_taken` → 409, `invalid_group` → 400 `invalid_request`.
   - `deactivateMember(db, scope, actorSub, id, release)`, one transaction, lock order:
     1. `select id, sub, status from members where org_id = $1 and id = $2 for update` (404 if missing).
     2. Rooms `for share`, id order: `select id from rooms where org_id = $1 and id in (select s.room_id from seats s where s.org_id = $1 and (s.occupant_id = $2 or s.id in (select d.seat_id from devices d where d.org_id = $1 and d.owner_id = $2 and d.seat_id is not null))) order by id for share`.
     3. The same seat set, `order by id for update`.
     4. Recompute the impact under lock (the same impact query as `getDeactivationImpact`) and call `decideDeactivation`: `refuse_self` → Abort 409 `cannot_deactivate_self`; `noop` → return the DTO; `refuse_not_empty` → Abort 409 `member_not_empty`. Check self before noop.
     5. If release: (a) `update devices set role = 'secondary', updated_at = now() where org_id = $1 and role = 'primary' and seat_id in (select id from seats where org_id = $1 and occupant_id = $2)` (DEV-06: every primary on those seats, whoever owns it); (b) `update seats set occupant_id = null, updated_at = now() where org_id = $1 and occupant_id = $2`; (c) `update devices set seat_id = null, role = 'secondary', updated_at = now() where org_id = $1 and owner_id = $2 and seat_id is not null`.
     6. Always cancel the member's pending requests as subject: `update seat_requests set status = 'cancelled', decided_at = now(), decided_by_id = $3, updated_at = now() where org_id = $1 and subject_id = $2 and status = 'pending'`, where `$3` = the actor's member id (`select id from members where org_id = $1 and sub = $2`, `null` if the actor has no row).
     7. `update members set status = 'deactivated', updated_at = now()`.
     8. One `writeAudit` `member.deactivate` with `meta: { released, seats, devices, demoted, cancelledRequests }` (counts only, no PII).
     The deferred triggers check at COMMIT, so step 5's order is not critical, but (a) before (b) is the clear order.
   - `reactivateMember`: lock the member row, active → noop; else `status = 'active'`, audit `member.reactivate`. Seats and devices are not restored.
   - `getDeactivationImpact`: 404 if the member is not in the org; else the impact query (no locks).
5. **Lock-order comment** in `src/server/rooms/rooms.ts` lines 213-219: add "0. a member row `for update` before any room/seat lock (deactivating a member, SIM-011)". Comment only.
6. **Routes** under `src/app/api/members/**` as in the API contract, copying `src/app/api/rooms/[id]/route.ts` and `…/delete-impact/route.ts`. The list route uses `parseMemberQuery(new URL(req.url).searchParams)`. Routes import only `@/server/*` and `@/lib/*` (R1); no route reads `authorization` (the guarded-routes test checks this).
7. **Error codes:** append the three codes to `src/lib/api/error.ts` and add messages to `src/ui/copy/api.ts`: `employee_code_taken: "This employee code is already used."`, `member_not_empty: "This member still has seats or devices."`, `cannot_deactivate_self: "You can't deactivate yourself."`.
8. Run all Checks. `pnpm test:db` runs in CI; run it locally if Postgres is up.

Rules: R1 (layers above; `pnpm check:layers`), R2 (no migration), R3 (no new env, nothing logged except event codes), R4 (only the listed files), R5 (unit + DB + route tests), R6 (`orgQuery` everywhere; every subquery repeats `org_id = $1`; roles from the token's `org_roles` only, via `withAuth` tiers).

## Specialist input used
`consult-api-platform-engineer.md`:
- Adopted: gate on `members.status` with missing row → active, fail closed, no cache, keep `createWithAuth` DI; verb sub-resources `deactivate`/`reactivate`; `deactivation-impact` preview recomputed under lock; keyset paging on `(lower(display_name), id)` with a new members cursor (audit cursor is `(at,id)`); `q` escaped with `escape '\'`; count subqueries, not joins; capped ref lists with true counts; separate invitations endpoint returning `[]`; `pg-error` mirror for `employee_code_taken`; audit field names and counts only; no `sub` in DTOs; edits allowed on deactivated members; refuse self-deactivation; release covers every primary on the member's seats; lock order rooms → seats → devices/requests.
- Adapted: `release:false` with assignments → 409 (named `member_not_empty`, as recommended, matching `room_not_empty`); the `release` field is required, so no silent default.
- Not adopted: the optional seat/device id lists in the audit meta (counts are enough and keep the meta small).

`consult-frontend-developer.md`:
- Adopted: groups returned with the members list as the option source before GRP-01 (SIM-016); expired-but-pending invitations filtered out; invitations Manager+ only; employee-code NFC/trim; pure impact helpers in `src/lib/members/`; route tests for User 403; DB rollback test.
- Deferred to SIM-011.2: every UI recommendation (MembersPage/View/useMembers/members-api, edit and deactivate dialogs, "Load more", read-only for Users, mmlabs note, deactivated badge, copy in `src/ui/copy/members.ts`).
- Not adopted: invitations embedded on the first list page (a separate endpoint keeps paging simple and lets the permission differ); default page size 25 (50 matches the audit list).

## Assumptions
Defaults chosen where the spec and decisions are silent. Ming, please confirm (none of them block implementation):
- **A1 Deactivation with seats/devices requires release.** `release:false` with occupied seats or placed devices → 409 `member_not_empty`. The UI (SIM-011.2) shows the counts and the only way to confirm is "deactivate and release". Reason: a deactivated member who still occupies seats is "hidden from pickers" yet visible on seats, which creates ghost seats. Alternative if Ming prefers: allow keeping the seats (a one-line change in `decideDeactivation`).
- **A2 Pending seat requests.** Deactivation always cancels pending requests where the member is the subject (`cancelled`, `decided_at` now, `decided_by_id` = actor's member or null). Requests the member created for someone else stay. The count is shown in the impact preview. Spec: a deactivated member "cannot request seats".
- **A3 Employee code format.** Same rule as room codes: trim, uppercase, `A-Z 0-9 . _ -`, 1-32 characters, so `e1` and `E1` are the same code. No migration needed (the existing case-sensitive index works on the normalised value). Stored codes set before this ticket: none exist (no writer yet).
- **A4 Who may deactivate whom.** Self-deactivation is refused (409 `cannot_deactivate_self`). A Manager may deactivate any other member, including an Admin, because simap does not know the target's Identity roles (the token holds only the caller's roles). "Last active Manager/Admin" cannot be detected for the same reason. Any other Manager+ can reactivate, and the admin portal stays available.
- **A5 List defaults.** `status` defaults to `active` (pickers in later tickets get the right set by default). The Members page (SIM-011.2) requests `status=all` and shows a badge.
- **A6 Invitations visible to Manager+ only** (they hold invitee emails; Users "view all … members", but invitees are not members yet). Expired pending invitations are hidden.
- **A7 Users see member emails and employee codes.** Spec §2: User "Views all … members". Search covers display name, email and employee code. Search is diacritic-sensitive (`ilike`; `nguyen` does not match `Nguyễn`). Accent-insensitive search needs the `unaccent` extension, which would be a separate DB ticket.
- **A8 Audit actions.** `member.update` (already used by `/api/me`, with `self: true` there and no `self` here), plus new `member.deactivate` and `member.reactivate`. The audit-log screen (SIM-019) shows any action string, so it needs no change.
- **A9 Lock order.** The member row is locked before rooms and seats. Future writers that check a member while changing occupants (SIM-012 assign, SIM-014 approve) must lock the member row (`for share`) before the room, or they risk a deadlock with deactivation. This is recorded in the `rooms.ts` lock-order comment.
- **A10 Race accepted.** A request already past the gate when the member is deactivated may still finish (per-request check, as the ticket allows). A device placed on a seat in a room that step 2 did not lock is still returned by step 5(c), because the UPDATE locks the row. The counts are recomputed under lock.
- **A11 Cursor content.** The cursor holds the lowercased display name of the page's last row. Only signed-in org users can see it, and they can already read that name.
- **Hotspots:** no ticket in `IN_PROGRESS`, `REVIEW` or `DONE` edits these files (SIM-032 is in `REWORK` and does not touch them). Later tickets SIM-009 / SIM-012 / SIM-013 / SIM-014 will also append to `src/lib/api/error.ts` and `src/ui/copy/api.ts`, so expect trivial rebases.

## Blocking questions
None.

## Split proposal
The full ticket (API + gate + UI + tests) is well above one implement/review cycle (about 400 changed lines). Slices:
- **SIM-011 (this plan): members API, deny-list gate, validators, pure impact logic, tests.** This is still large (most of it is tests), but it is one cohesive server change. AC1, AC3 and AC5 are fully covered. AC2 and AC4 are covered on the server side.
- **SIM-011.2 (new ticket, Areas ui, depends on SIM-011): Members page UI.** `src/app/(app)/members/page.tsx` → `<MembersPage />`; `src/ui/members/*` (`MembersPage`, pure `MembersView`, `useMembers` with search and "Load more", `members-api`, `member-form`, `EditMemberDialog`, `DeactivateMemberDialog` with the impact counts and re-fetch on `member_not_empty`, pending invitations section for Manager+); `src/ui/copy/members.ts`; `src/ui/index.ts` export. Users see no action buttons. The page says accounts are managed in mmlabs, and there is no delete action. It covers the UI halves of AC2 and AC4, the ticket's manual test, and the "No delete action" scope item. Build it from `consult-frontend-developer.md` §Recommendations 2-3.
