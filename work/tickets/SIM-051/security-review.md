# Security review — SIM-051

## Attempt 1

**SIM-051 attempt 1, security review: PASS with no blockers.** For a User, every device and handoff write route now returns a device or handoff they cannot see with the same `{404, not_found}` as an unknown id. That 404 comes after only reads and row locks: no update, insert or audit runs first. R6 and R7 both hold.

This was read-only, and I had no shell. I didn't run `git diff` or any checks. I judged the code on the branch as it stands against the plan, and the check results come from impl-log.md.

### What I checked

**Body validation order.** In all three routes (`src/app/api/devices/[id]/route.ts` PATCH, `.../placement/route.ts` PUT, `.../handoffs/route.ts` POST) the steps run in this order:
1. `isCanonicalUuid` gives 404.
2. A missing pool gives 503.
3. `readJson` / `validate*` give 400 `invalid_request`.
4. Only then does the server function run.

Steps 1–3 don't depend on the database, so a bad body gets the same 400 whether the device exists or not. The validation error doesn't reveal anything.

**`updateDevice`** (`src/server/devices/devices.ts:459-463`). The order is: device missing gives 404, hidden gives 404, then `canEdit` gives 422. The check sits before the UPDATE, so the 409 for an inventory-number clash on someone else's device can no longer be reached. `devices.db.test.ts:486` pins this, including that the row and the audit count stay unchanged.

**`placeDevice`** (`devices.ts:292-336`). Before the hidden check, the only possible refusals are `notFound`: unknown device (l.292) and unknown target seat (l.302). Both have the same body as the hidden case. `placement_changed` (409) and `decidePlacement` both come after the hidden check (l.335). No 409 or 422 can come back ahead of it.

**`startTransfer` / `startReturn` / `startExtension`** (`src/server/devices/handoffs.ts:159-160, 221-222, 278-279`). The hidden check runs straight after the locked device read and before the pending check (409 `handoff_pending`), the decision (422) and the insert and audit. The member `for share` read in `startTransfer` (l.147) only reads and never refuses.

**`closeHandoff` (cancel/decline, l.350-353) and `confirmHandoff` (l.633-634).** The hidden check runs on the first read, before `decideHandoffAction`. The sender and recipient are not hidden, so the recipient can still confirm and decline. Tests cover a third-party User getting 404 (`handoffs.db.test.ts:472, 719`) and a Manager still being able to cancel.

**Writes refused by tier alone** (create l.399, assign l.504, holding l.566, delete l.617, take-back `handoffs.ts:729`). These return 422 before any query, whatever the id, so nothing leaks.

**R6.** Every new code path reads through `orgQuery` with `org_id = $1` from the token's scope. Another org's id still lands on the `!row` 404, so it looks the same as an unknown id and the same as a hidden device.

**R7.** No 401 or 403 is added anywhere. The new 404s are domain refusals that come before any write: an `Abort` inside `inTx` rolls back, and `confirmHandoff` returns before it opens a transaction.

**The pure rules** (`src/lib/devices/visibility.ts`). `hiddenFromActor` is true for a User when the device has no owner, belongs to someone else, or the User has no member row. It is always false for Manager and Admin. `hiddenHandoffFromActor` uses the same logic for sender and recipient, and a `null` `to_member_id` (return or extension) can never match a null member. Both are correct.

### Findings

No 🔴 blockers.

🟡 **Should-fix: none that block this ticket.** One item is a separate existence oracle outside this ticket's scope, so I put it under follow-ups (F1) rather than here.

💭 **Notes**
- `src/server/devices/devices.ts:296-320` (`placeDevice`): before the hidden check, a User sending another member's device id with a `seatId` still takes `FOR SHARE` locks on rooms and `FOR UPDATE` locks on seats. They are released when the transaction rolls back, so the response gives nothing away. It does allow some lock contention and a timing difference, which this review was told not to cover. Optional fix: read `owner_id` without a lock right after the first device read (l.286) and refuse there too, keeping the locked re-check at l.335 for races.
- `src/server/devices/handoffs.ts:352, 634`: a User who is a party to a handoff on a device they no longer hold still gets the 422/409 codes (`not_allowed`, `handoff_not_pending`), not 404. Examples are the sender of a finished transfer, or the recipient of a declined one. This matches the approved assumption that a party keeps today's 422, and they already know the handoff because they took part in it. Nothing new leaks.
- `handoffs.ts` `startExtension`: a User on a device with no owner now gets 404 where it used to get 422 `device_unowned`. This follows from "no owner means not held" and the impl-log records it. Manager and Admin still get `device_unowned` from `startReturn` (test at `handoffs.db.test.ts:452`).
- I didn't find a test that checks a User acting on another org's handoff id gets the same 404 as an unknown handoff id. Organisation scoping is structural (`LITE` filters on `org_id = $1`), so this is low risk. A one-line assertion would pin it.

### Follow-ups (out of scope)
- **F1 (🟡, separate oracle):** a User who owns a device can PATCH its `inventoryNumber` to probe whether *any* device in the organisation already uses a given inventory number. A clash gives 409 and a free number gives 200 (and a real change plus an audit row). That reveals devices the User cannot see by inventory number, not by id. Possible fixes: let only an Admin change the inventory number, or answer a clash for a User with a generic refusal. This needs a spec decision (DEV-01 says the owner may edit the inventory number).
- **F2 (💭):** optionally move the hidden check in `placeDevice` ahead of the seat and room locks, as in the first note.
- **F3 (💭):** add an assertion that cancel, decline and confirm on another org's handoff id return the same 404 as an unknown handoff id.

Files reviewed: `src/lib/devices/visibility.ts`, `src/server/devices/devices.ts`, `src/server/devices/handoffs.ts`, `src/app/api/devices/[id]/route.ts`, `src/app/api/devices/[id]/placement/route.ts`, `src/app/api/devices/[id]/handoffs/route.ts`, `src/server/devices/devices.db.test.ts`, `src/server/devices/handoffs.db.test.ts`.
