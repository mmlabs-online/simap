# SIM-013 security review

## Attempt 1

## Security review: SIM-013, attempt 1 (slice 1: device read API and placement endpoint)

**Verdict: no blockers (🔴).** One 🟡 hardening fix that fits in the ticket, plus 🟢 notes. I read the files named in `impl-log.md`, the auth wrapper, the org-scope helper, the `devices` and `members` schema in `db/migrations/20261120150000_init.sql`, and the other code that writes to `devices` (`manage.ts`, `seats.ts`, `rooms.ts`). I could not run git or the checks. `devices.db.test.ts` has not been run anywhere yet (it is CI-only, per `impl-log.md`).

### Findings

🟡 **d:\project\simap-game-ui\src\server\devices\devices.ts:185-190, 222-229, 246-248: the permission check uses the owner read before the lock.**
- `isOwner` and `ownerId` (passed to `decidePlacement`, and written to the audit `meta.ownerId` at line 275) come from `dev[0]`, the read at line 188 taken before the device is locked.
- The locked read at line 225 already selects `owner_id`, but the result type at line 222 drops it, and only `seat_id` is compared against the earlier read.
- **Risk today: none.** No code path updates `devices.owner_id`. But SIM-013 later slices / device edit (owner or Admin, D19) will add an owner change. Once that exists, a user who just lost a device could still move it (stale `isOwner = true`). The deferred trigger at init.sql:243-246 only backstops the primary role, not secondary placements.
- **Fix:** type `cur` as `{ seat_id; role; owner_id }`. Use `cur[0].owner_id` for `isOwner`, `ownerId` and the audit meta. Optionally refuse with 409 `placement_changed` when `cur[0].owner_id !== dev[0].owner_id`. Add one fake-db test for that case.

🟢 **R6 (org scoping) is correct.**
- Every query goes through `orgQuery` with `org_id = $1`, and the org comes only from `ctx.scope`, which `withAuth` builds from the verified token's `org` claim (with-auth.ts:67-71).
- Every join in `deviceRows` repeats `org_id` (devices.ts:112-114). The schema has composite `(org_id, id)` foreign keys for owner and seat (init.sql:133-134), so cross-org references are impossible at the DB level too.
- The tier comes only from `tierFromOrgRoles(orgRoles)` (with-auth.ts:69).

🟢 **Authorization matches the plan and D19/D22.**
- `canPlace` = owner or Manager+; `canEdit` = owner or Admin (rules.ts:5-9).
- `decidePlacement` checks permission first, before the stale-view and invariant checks (rules.ts:45).
- `isOwner` compares the caller's member id (looked up by `sub` within the org) with the device owner. A missing member row safely gives `false`.

🟢 **R7 is clean.**
- Placement refusals are 422 `not_allowed` and 409 domain codes. There is no 401/403 outside `withAuth`.
- Every refusal is thrown as `Abort` inside the transaction before the update or audit write, so it rolls back.
- The route answers 400/404 before calling the service (placement/route.ts:14-20).

🟢 **No cross-org id leaks.**
- A device or target seat from another org gives 404, the same answer as a missing id (devices.ts:191, 201, 234).
- Non-canonical ids get 404 in the route.

🟢 **Locking and races are sound.**
- Lock order is rooms for share (sorted by id), then seats for update (sorted by id, across rooms), then the device. This matches rooms.ts:213-224 and `deactivateMember`, so I found no deadlock cycle.
- The stale old-seat case gives `placement_changed` (line 229).
- A seat deleted under you gives 404: `deleteRoom` takes the room lock for update, so placement waits, then finds no locked seat.
- The unlocked primary read at line 239 is safe, because the only other writers on a seat's devices (seats.ts:249, manage.ts:381/395, rooms.ts:247) only demote or clear.
- The DB backstops (the unique index `devices_one_primary_per_seat` and the deferred trigger) map to 409 around `withTx`, so the commit-time error is caught.

🟢 **Secrets: none.** No secrets, env reads, or client-bundle exposure in the diff. `NEXT_PUBLIC_SIMAP_DEV_TOKEN` in with-auth.ts:112 is an existing flag, not a secret, and only applies in development.

💭 **devices.ts:201: target seat 404 comes before the permission check.** A non-owner User learns whether a seat id exists in their own org (404 vs 422). This is same-org only, and seats are visible to users anyway. Acceptable; no change needed.

### Follow-ups (out of scope)
- **Pre-existing edge in `deactivateMember` (manage.ts:329-361, 392-398).** Its locked seat set is computed before it waits. If a concurrent `placeDevice` moves the member's device from seat A to seat B and commits, deactivation then clears the device on seat B without holding B's lock. The outcome is still valid (inventory, secondary role), but it bends the "seat lock serialises device writes on a seat" rule the new code relies on (devices.ts:235). Recheck when SIM-014 touches the seat lock order.
- **Run `devices.db.test.ts` (`pnpm test:db`) before PASS (R5)**, especially the lock-wait test that should end in `owner_not_occupant`.
