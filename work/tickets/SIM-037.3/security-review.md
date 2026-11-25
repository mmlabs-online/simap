# Security review — SIM-037.3

## Attempt 1

Agent: security-ai-generated-code-auditor (run through general-purpose with the agent file). Scope: `git diff origin/main...HEAD` (35 files), static reading only; no checks or DB run. The impl-log says `test:db`, `migrate:smoke` and `schema:check` await CI.

**Verdict: no 🔴 blockers.** No 🟡 should-fix findings in the code either, only 💭 notes. The three SIM-037.1 follow-ups (security-review.md:44-49) are closed.

### Focus areas checked

- **Auth wrapper and R7.**
  - All six routes use `withAuth(…, { tier: "user" })`; UUID (404), then pool (503), then body or query (400) before the service: `src/app/api/devices/[id]/handoffs/route.ts:11-25`, `src/app/api/handoffs/[id]/{cancel,decline,confirm}/route.ts:9-19`, `src/app/api/handoffs/route.ts:9-19`, `src/app/api/handoffs/count/route.ts:8-16`.
  - `Refusal.status` is typed `404 | 409 | 422` (`src/server/devices/tx.ts:11-14`): the service cannot emit 401/403. Every permission refusal is 422 `not_allowed`.
- **Permission before any write.**
  - Start: `decideTransferStart` before the INSERT (`src/server/devices/handoffs.ts:160-175`), `not_allowed` first (`src/lib/devices/handoff-rules.ts:33-35`).
  - Cancel/decline: decision on an unlocked read, then again on the `FOR UPDATE` row, before the UPDATE (`handoffs.ts:219-233`).
  - Confirm: recipient-only decision before any lock or write (`handoffs.ts:277-285`).
  - Refused actions throw `Abort` before `writeAudit`: no audit row on refusal.
- **R6 org scoping.**
  - Every query via `orgQuery` with `org_id = $1`; every join in `handoffRows` repeats `org_id` (`handoffs.ts:78-84`), as do the new device-row joins (`src/server/devices/devices.ts:138-141`).
  - Another org's handoff id → 404 `not_found` (`handoffs.ts:219-220`, `:268-276`).
  - Another org's member id → no row from the scoped `members` read → 422 `member_not_assignable` (`handoffs.ts:140-145`, `:165`).
  - Backed by composite `(org_id, …)` FKs (`20261125120000_device_lifecycle.sql:63-67`).
- **Recipient-only confirm/decline, sender or Manager+ cancel.** `decideHandoffAction` (`handoff-rules.ts:58-63`) allows confirm/decline only when `toId !== null && actorMemberId === toId`; cancel for the `from` member or Manager+; a User recipient gets 422 on cancel. Viewer flags reuse the same function (`handoff-rules.ts:69-78`).
- **Null member id.** `actorMemberId === null` → `not_allowed` for start and every action (`handoff-rules.ts:33`, `:59`), closing the SIM-037.1 null === null hole; `isOwner` requires `ownerId !== null` (`:32`); list and count return empty/0 with no member row (`handoffs.ts:399`, `:421`); `decided_by_id` always non-null when written.
- **Start under the device lock (SIM-037.1 follow-up).** Recipient `FOR SHARE`, device `FOR UPDATE`, pending read under that lock, decide, INSERT with `from_member_id = owner_id` read under the lock (`handoffs.ts:140-175`). A concurrent second start blocks on the device lock or hits the partial unique index → 409 `handoff_pending` (`src/server/devices/pg-error.ts:23-25`), never a 500.
- **Confirm lock order and re-checks.**
  - Member (share), room (share), seat (update), device (update), handoff (update) (`handoffs.ts:287-338`), matching `placeDevice` and `deactivateMember`; cancel/decline lock only the handoff row.
  - Under all locks (`handoffs.ts:339-342`): still pending (409 `handoff_not_pending`); `owner_id === from_member_id` (409 `handoff_stale`, also catches a device returned to inventory); recipient still active (422) under its share lock; seat unchanged (409 `placement_changed`).
  - Single retry after a full rollback (`handoffs.ts:385-388`).
  - Device update clears the seat and sets `secondary`: deferred primary/occupant trigger satisfied.
- **`decided_by_id` CHECK migration** (`db/migrations/20261125180000_handoff_decided_by.sql:3-5`): forward-only, `not valid` then `validate`; `((status = 'pending') = (decided_by_id is null))` correct both ways; schema-check covers both (`scripts/schema-check.mjs` +745-772); fixtures updated; no app code on main writes `device_handoffs`, so `validate` cannot fail on prod data.
- **Information leaks.** List: only pending handoffs addressed to the caller (`handoffs.ts:405`); note only there and in the parties' action responses. Count: same filter (`:425-427`). Device rows: `pendingHandoff` shows recipient and requester names, not the note (A11, DEV-02). Non-party gets 422 before the status check: can learn only whether the id exists in their own org.
- **Audit meta.** Member ids, inventory number, note, seat id and code; no tokens; no PII beyond `device.assign`; actor from `actorSub`.
- **Secrets.** None; no env or client-exposed config; no LLM call sites.

### Findings

💭 **Rows are locked before a refused User gets the 422** (`handoffs.ts:140-151`): a non-owner User takes `FOR SHARE` on the recipient and `FOR UPDATE` on the device before `decideTransferStart` refuses. No write, R7 holds, short transaction. Same pattern as the SIM-037.1 💭 on delete. Optional early exit; probably not worth it.

💭 **`byManager` in the cancel audit is false when a Manager who is also the recipient cancels** (`handoffs.ts:245`): misleading in history (DEV-11). Fix: `byManager: action === "cancel" && me !== h.from_member_id`, or rename to `byParty`.

💭 **A Manager+ can take over any owned device without the owner agreeing**: transfer to self (A10), then confirm (`handoff-rules.ts:37` only refuses `to === owner`). Allowed by the spec ("A Manager+ may start one for any owned device") and fully audited. Noted so Ming sees it as an accepted capability.

💭 **No DB run yet.** Concurrency claims (no deadlock, one winner on confirm vs cancel, start vs start, confirm vs place) rest on static reading; `handoffs.db.test.ts` and `pnpm schema:check` must be green in CI before PASS (R5).

### Follow-ups (out of scope)
- A5 / SIM-037.4: a pending handoff to or from a deactivated member stays pending. Not exploitable (wrapper 403 `member_deactivated`, `src/server/http/with-auth.ts:73-74`; confirm re-checks `active`), but blocks assign/delete until cancelled. Track in SIM-037.4.
- Still open from SIM-037.1: no indexes on `device_handoffs` member FKs (`from`, `requested_by`, `decided_by`) — speed only.
