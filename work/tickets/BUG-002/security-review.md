# Security review — BUG-002

## Attempt 1

BUG-002 security review, attempt 1. I found no blockers and nothing that needs fixing. Verdict: PASS from security. I read the code, the migration and the test file; I did not run any checks.

**Findings**

🟢 **R6 org scoping holds.**
- All three inserts are at `d:\project\simap-game-ui\src\server\devices\handoffs.ts`:179-181 (transfer), :236-238 (return) and :291-294 (extension).
- Each one takes `org_id` from `o.org_id`, which is `$1::uuid`. `orgQuery` always binds `$1` to `scope.orgId` from the verified token (`d:\project\simap-game-ui\src\server\http\org-scope.ts`:24), so the caller cannot supply or override it.
- The ids used in each insert were checked against the org earlier in the same function:
  - The device row is read with `where org_id = $1 and id = $2 for update` (:155, :216, :272). A missing row aborts with notFound before the insert (:158, :219, :275).
  - The recipient (`to_member_id`) is read with an org filter (:149).
  - `me` comes from `actorMemberId(c, scope, …)`.
- The database also enforces this. The migration has composite foreign keys `(org_id, device_id)` → `devices` and `(org_id, from/to/requested_by_id)` → `members` (`d:\project\simap-game-ui\db\migrations\20261125120000_device_lifecycle.sql`:63-66). An id from another org fails the insert even if the code checks were wrong.

🟢 **Parameter numbering and casts are correct.**
- Transfer: 5 values give `$2`–`$6` (device, from=owner, to, requested_by=me, note).
- Return: 4 values give `$2`–`$5`, and `to_member_id` is the literal `null`.
- Extension: 4 values give `$2`–`$5`. `$3` (me) is used for both `from_member_id` and `requested_by_id`, with the same `::uuid` cast both times, so Postgres cannot infer conflicting types.
- The casts match the column types in the migration: uuid for the ids, `note text`, `new_expires_on date` (lines 40-46).
- The kind and null pattern in each insert satisfies the kind check constraint (:59-61).
- The new test checks the full value arrays with `scope.orgId` first (`d:\project\simap-game-ui\src\server\devices\handoffs.test.ts`:72-73, 81-82, 94-95).

🟢 **R7: nothing is written before a refusal.** In each function the decision refusal is thrown (:174, :232, :287) before the insert and `writeAudit`. Everything before that point is a locking read (`for share` / `for update`) inside `inTx`, so a refusal rolls the transaction back. The fix adds no 401/403.

🟢 **No secrets** appear in the changed code or the test, which uses fixed fake UUIDs.

💭 **Note:** `where o.org_id = $1::uuid` is always true. It exists only so the text-only `orgQuery` guard accepts the statement, and it matches the existing pattern in `writeAudit`. The real protection is the `$1` binding plus the composite foreign keys, which is fine.

**Follow-ups (out of scope)**
- The `orgQuery` guard only checks the SQL text, so any insert can satisfy it with this always-true filter. A dedicated `orgInsert` helper, or a guard that recognises inserts, would be clearer. That code is under `src/server/http/**`, a High path, so Ming has to decide.
