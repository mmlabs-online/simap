# SIM-014 security review

## Attempt 1

## Security review — SIM-014, attempt 1 (slice 1: request state machine and write API)

**Verdict: no blockers.** No 🔴 and no 🟡. There are three 🟢 notes; the first may be worth a small fix.

I read every file listed in `impl-log.md`. I also read `with-auth.ts`, `org-scope.ts`, `identity/verify.ts`, the `seat_requests` / `seats` / `members` DDL in `db/migrations/20261120150000_init.sql`, and `deactivateMember` in `src/server/members/manage.ts`. I could not run git, the checks, or `pnpm test:db`. The DB tests have still never run (impl-log says CI only).

### What I checked and found clean

**R6 org scoping**
- Every query in `d:\project\simap-game-ui\src\server\requests\requests.ts` goes through `orgQuery` with `org_id = $1`.
- Every join repeats `org_id`: `loadRequest` at 66-71, and the approve pre-read at 170-172.
- The schema uses composite `(org_id, x)` FKs for seat, subject, created_by and decided_by (init.sql:158-161), so a request can't point at another org's row.
- Scope comes only from `withAuth` (`scopeFor(org)` from the verified token). The tier comes only from the token's `org_roles` (`tierFromOrgRoles`, with-auth.ts:69).

**Authorization**
- Self-only create (D23): `d:\project\simap-game-ui\src\lib\validate\request.ts:12-13` refuses any key other than `seatId`. The subject is always the caller's own member, looked up by token `sub` (requests.ts:110, insert at 128 uses `me.id` for both subject and created_by).
- Manager+ approve/reject: `{ tier: "manager" }` on `approve/route.ts:19` and `reject/route.ts:19`. The route test covers User → 403.
- Own-only cancel: the request is locked with `subject_id = me.id` (requests.ts:285, 97). Another member's request, a request in another org, or a caller with no member all get the same 404, so request ids don't leak.

**R7**
- All 401/403 codes come from `withAuth` before the handler runs.
- The service only returns 404/409/422. `inTx` maps the seat conflict to 409 and anything unexpected rolls back and becomes 500. No auth code can come after a write.
- Path `id` is checked with `isCanonicalUuid` → 404. `sub` is validated as a canonical UUID in verify.ts:137, so the `$2::uuid` cast in `lockMembers` cannot throw.

**Lock order and races**
- The order is members (for share, one statement, `order by id`) → room share → seat update → request rows. This matches the rooms.ts order (steps 0-3) and `setOccupant`, and it reuses `lockSeatIn` / `writeOccupant` unchanged.
- Reject and cancel take members → request only. That is a subset of the same order, so there is no cycle with approve.
- I found no deadlock in any of these pairs:
  - approve vs `deactivateMember`
  - approve vs forced `deleteSeat` / `deleteRoom` (cascade)
  - approve vs `setOccupant`
  - approve vs `releaseSeat`
- **Approve vs cancel:** they serialize on the request row. Approve re-reads the status after locking (requests.ts:185-192), so a cancelled request becomes a no-op with nothing written.
- **Concurrent approves on the same seat:** they serialize on the seat lock. The second one sees its request already auto-rejected (no-op) or the seat taken (409, rolled back).
- **Approve vs deactivating the subject:** the subject is locked `for share` and its status checked under the lock (requests.ts:179-181). Deactivate's `update members` waits.
- **Create vs approve:** both hold the seat lock, so no new pending rival can appear while approve rejects the rivals.

**Secrets:** none added; no env, logging or client-bundle changes.

### Findings

🟢 1. **Duplicate-create can return 500 under a narrow race** — `requests.ts:142-149`
- **Risk:** The race window is:
  1. `on conflict ... do nothing` hits an existing pending row.
  2. Before the follow-up select runs, a reject (Manager), a cancel (the same user in another tab) or a member deactivate commits on that row. None of these take the seat lock.
  3. The select gets a fresh READ COMMITTED snapshot and finds no pending row, so `rows[0]!.id` throws and the caller gets a 500.
- **Impact:** Nothing is written (the insert did nothing and the transaction rolls back), and `apiFetch` does not re-send on 500. So there is no integrity or security impact, only a spurious error.
- **Fix (either works):**
  - Wrap the insert + select in a loop of at most 2 tries, retrying the insert when the select finds nothing.
  - Or make `rejectRequest` / `cancelRequest` take room share → seat update before `lockRequest`. This keeps the lock order and fully serializes them with create and approve.

🟢 2. **A Manager can create and then approve their own request** — `src/app/api/requests/route.ts:25` (tier `user`, so Manager+ can create)
- **Risk:** None. This is equivalent to direct assign (SEA-03), which Managers already have, so it grants no new privilege.
- Spec REG-02 says "Only Users go through the approval flow". If that is meant to be enforced, it's a spec/UI decision for Ming, not a security gap.
- **Fix:** none needed. Possible follow-up: hide "Request" for Manager+ in the UI.

🟢 3. **No cap on pending requests per member** — `requests.ts:125-131`
- **Risk:** A User can open one pending request on every empty seat in the org, which floods the Approvals page (a nuisance, not a breach). It is bounded by the seat count, and the partial unique index prevents exact duplicates. Approving one request does not reject the same subject's requests on other seats; that matches the spec, since one person may hold several seats (spec §140).
- **Fix:** follow-up only. Optionally add a per-member pending cap (count under the member's `for share` lock, then 409/422).

### Follow-ups (out of scope)
- Get the first CI run of `pnpm test:db` (`requests.db.test.ts`) green before PASS (R5). The concurrency tests are what back the lock-order claims above.
- Already in the plan: auto-reject pending requests on direct assign, release or cannot-seat. Until that lands, a pending request can exist on a seat that has since been taken. Approve handles this safely (409 `seat_taken`, rolled back).

Files reviewed:
- `d:\project\simap-game-ui\src\server\requests\requests.ts`
- `d:\project\simap-game-ui\src\server\seats\seats.ts`
- `d:\project\simap-game-ui\src\lib\requests\rules.ts`
- `d:\project\simap-game-ui\src\lib\validate\request.ts`
- `d:\project\simap-game-ui\src\app\api\requests\route.ts`
- `d:\project\simap-game-ui\src\app\api\requests\[id]\approve\route.ts`
- `d:\project\simap-game-ui\src\app\api\requests\[id]\reject\route.ts`
- `d:\project\simap-game-ui\src\app\api\requests\[id]\cancel\route.ts`
- `d:\project\simap-game-ui\src\server\http\with-auth.ts`
- `d:\project\simap-game-ui\src\server\http\org-scope.ts`
- `d:\project\simap-game-ui\src\server\members\manage.ts` (deactivateMember)
- `d:\project\simap-game-ui\db\migrations\20261120150000_init.sql`
