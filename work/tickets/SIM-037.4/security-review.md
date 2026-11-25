# Security review — SIM-037.4

## Attempt 1

Agent: security-ai-generated-code-auditor (run through general-purpose with the agent file). Scope: `git diff origin/main...HEAD` (27 files), static reading only. No checks or DB tests were run. The impl-log says `test:db` was NOT RUN locally (no Docker or `DATABASE_URL`) and is waiting on CI.

**Verdict: no 🔴 blockers.** One 🟡 should-fix: a new lock cycle between deactivation and handoff decisions, caused by the `decided_by_id` FK. Everything else is 💭 notes.

### Focus areas checked

- **Auth wrapper and R7.**
  - Take-back is `withAuth(…, { tier: "admin" })` (`src/app/api/devices/[id]/take-back/route.ts:19`). The wrapper answers 403 `forbidden` before the handler runs (`src/server/http/with-auth.ts:70`). In the handler the order is UUID (404), then pool (503), then the service (`take-back/route.ts:11-16`).
  - The service checks again as defence in depth: `tier !== "admin" || me === null` gives 422 `not_allowed` before any transaction (`src/server/devices/handoffs.ts:596-597`).
  - `box=returns` for a non-Admin is 422 `not_allowed`, returned before any query (`handoffs.ts:613`).
  - `Refusal.status` is still typed `404 | 409 | 422` (`src/server/devices/tx.ts:13`). No handler in the diff returns 401 or 403.
- **Admin-only return confirm.**
  - Inside `decideHandoffAction`, a return with action confirm is allowed only when `actorMemberId !== null && tier === "admin"`. Decline of a return is never allowed. Every action on an extension is refused (`src/lib/devices/handoff-rules.ts:95-100`). Permission is checked before status.
  - `confirmHandoff` decides on the unlocked row before it dispatches to `confirmReturnOnce` (`handoffs.ts:506-517`). `kind` cannot change, and `tier` comes from the token, so not re-checking permission under the lock is safe.
  - The User-tier owner, a Manager and a portal Admin with no member row all get 422.
  - `handoffFlags` reuses the same function (`handoff-rules.ts:108-118`), so `canConfirm` and `canDecline` cannot drift from what is enforced.
- **Return start.**
  - The device is locked `for update`, then the pending read runs under that lock, then `decideReturnStart` (permission, then `device_unowned`, then `handoff_pending`), then the INSERT with `from_member_id = owner_id` read under the lock (`handoffs.ts:210-236`).
  - The null member id case is refused (`handoff-rules.ts:67`).
  - The validator refuses `toMemberId` on a return, because of the allowed-key list per kind. It also refuses `kind: "extension"` (`src/lib/validate/device.ts:203-213`).
- **Take-back.**
  - Order: `lockPlacement` (room share → seat update → device update), then owner null → 422, then the pending handoff `for update`, then a pending return → 409. The seat is re-checked before any write (`handoffs.ts:533-548`).
  - The cancel of a pending transfer, the single `clearDevice` UPDATE and both audit rows all run in one transaction (`:549-584`).
  - The retry happens only on `placement_changed`, after a full rollback (`:598-601`).
- **R6 org scoping.**
  - Every new query goes through `orgQuery` with `org_id = $1`: `startReturn`, `lockPlacement`, `clearDevice`, `setConfirmed`, take-back's pending read, the returns list filter (`handoffs.ts:623`) and the count (`:653-656`).
  - The deactivation UPDATE is scoped by `org_id = $1` (`src/server/members/manage.ts:425-426`).
  - The joins in `handoffRows` repeat `org_id` (`handoffs.ts:83-87`). An id from another org gets 404.
  - `count.returns` is computed only when `tier === "admin"`, from the verified token (`handoffs.ts:654`, `:657`).
- **Confirm and race re-checks.**
  - Return confirm locks room → seat → device → handoff (`handoffs.ts:469-470`). Under the locks it re-checks that the handoff is pending, that `owner_id = from_member_id` (409 `handoff_stale`) and that the seat is unchanged (`:472-474`).
  - Confirm vs take-back: take-back refuses a pending return with 409, and a confirm that loses the race sees `device_unowned` or `handoff_stale`.
  - Confirm vs cancel: both lock the handoff row, so there is one winner.
  - Start vs start: both lock the device row, and the partial unique index backs this up.
  - Deactivation vs confirm or take-back on the device and handoff rows: both sides take room → seat → device → handoff, the same order. The exception is the FK lock in the 🟡 below.
- **Information exposure.** The `box=returns` list, notes included, is Admin only. The count is 0 for non-Admins. Device rows still carry no note.
- **Audit rows.**
  - Each of start, cancel, confirm and take-back writes one row. A take-back that cancels a transfer also writes `device.transfer_cancel` with `byTakeBack: true`.
  - Deactivation writes one `device.<kind>_cancel` row per cancelled handoff, with `byDeactivation: true`, and adds `cancelledHandoffs` to the `member.deactivate` meta.
  - Every refusal throws `Abort` before `writeAudit`.
  - The actor always comes from `actorSub`. The meta holds no tokens or PII beyond member ids and the note.
- **Secrets.** No secrets, no env or client-exposed config, no LLM call sites.

### Findings

🟡 **New lock cycle: deactivation vs cancel, return self-confirm or take-back by the member being deactivated** (`src/server/members/manage.ts:228`, `:423-427`; `src/server/devices/handoffs.ts:293-299`, `:397-405`, `:550-557`).
- **Cause.** `deactivateMember` locks the target member row `FOR UPDATE` (`lockMember`, manage.ts:228). It now also updates that member's pending `device_handoffs` (`:423-427`). Every handoff decision writes `decided_by_id = me`. The FK check on that column takes `FOR KEY SHARE` on the actor's member row, and `FOR KEY SHARE` conflicts with `FOR UPDATE`.
- **Interleaving.** Member X runs `closeHandoff` and locks handoff H `for update` (`:289`). A Manager's deactivation of X locks X, then waits on H. X's UPDATE of H then waits for the key-share lock on X. That is a deadlock.
- **Other paths with the same cycle:**
  - An Admin self-confirming a return of their own device (A1). This path also holds the device's seat, which deactivation locks before the handoffs.
  - An Admin doing a take-back that cancels a transfer addressed to themselves.
- **Effect.** Postgres aborts one side with `40P01`, which `inTx` rethrows as a 500. Nothing is corrupted, because the losing transaction rolls back. But the plan's claim "There is no reverse order, so no cycle" (plan.md Approach 10) is wrong, and the cycle exists only since this diff.
- **Fix.** In `deactivateMember`, lock the target `for no key update` instead of `for update`. The status UPDATE is a non-key update. `for no key update` does not conflict with `FOR KEY SHARE`, and it still conflicts with the `for share` that `startTransfer` and `confirmTransferOnce` take on the recipient. Add a lock-mode parameter to `lockMember`, or inline the select. Add a two-connection test in `manage.db.test.ts`: the sender holds a cancel open on H while the Manager deactivates them, with no deadlock and one winner.

💭 **Deactivation decider fallback misattributes the decision** (`manage.ts:428`). A portal Admin with no member row records `decided_by_id` as the deactivated member (A6). The audit row's `actorSub` keeps the true actor, so history (DEV-11) should read the decider from audit, not from `decided_by_id`, for `byDeactivation` rows. Accepted in the plan; noted for SIM-037.6.

💭 **Deactivation cancel audit has no `inventoryNumber`** (`manage.ts:433-439`). The other `device.*_cancel` rows carry it (`handoffs.ts:310`, `:567`). Not a security issue, but history built only from audit meta is inconsistent. Fix: add `inventory_number` via `update … from devices` or a join in the `returning`.

💭 **`canTakeBack` is true for an Admin with no member row** (`src/server/devices/devices.ts:108`). The service then refuses with 422 `not_allowed` (`handoffs.ts:597`). This affects UI only; enforcement is correct. Optional: gate the flag on the caller having a member row, as the other flags effectively do.

💭 **Return list and count are empty for a portal Admin with no member row** (`handoffs.ts:615`, `:649`). This matches confirm needing a member row. No security impact.

💭 **Rows are locked before the take-back refusal** (`handoffs.ts:533-547`). An unowned device or a pending return is refused only after room, seat, device and handoff are locked. There is no write, R7 holds, and the transaction is short. Same pattern as the SIM-037.3 💭.

💭 **No DB run yet.** The concurrency claims rest on static reading:
- take-back vs transfer confirm (`handoffs.db.test.ts:565`)
- return confirm vs cancel
- deactivate vs confirm

`pnpm test:db` must be green in CI before PASS (R5).

### Follow-ups (out of scope)
- A10 (accepted): a start that races the owner's deactivation can stay pending. File the `debt` issue at PR time, as the plan says.
- A3: the future remove-from-org path must reuse the deactivation cancel step, including the lock-mode fix above.
- Still open from SIM-037.1 and A9: no indexes on the `device_handoffs` member FKs, and none for the org-wide pending-returns query. This affects speed only.
