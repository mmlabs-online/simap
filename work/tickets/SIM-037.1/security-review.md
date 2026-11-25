# Security review — SIM-037.1

## Attempt 1

Security audit: SIM-037.1, review attempt 1 (`git diff origin/main...HEAD`). Agent: security-ai-generated-code-auditor (run through general-purpose with the agent file; static reading only, no checks or DB run).

Verdict: **no 🔴 blockers**. One 🟡 should-fix (documentation only, rollback window) and a few 💭 notes. Every focus area holds in the new code.

### Focus areas checked
- **R6 org scoping.**
  - Every new or changed query keeps `org_id = $1` through `orgQuery`, including the pending-handoff read at `src/server/devices/devices.ts:423-428` and the `left join members m on m.org_id = d.org_id and m.id = d.owner_id` joins at `devices.ts:118`, `search.ts:119`, `export.ts:70`, `seats.ts:125`.
  - Every `device_handoffs` FK is composite on `(org_id, …)` and points at `devices_org_id_key` / `members_org_id_key` (migration `20261125120000_device_lifecycle.sql` lines ~63-67; init.sql:53, :132). A handoff can never cross orgs. MATCH SIMPLE: NULL `to_member_id` / `decided_by_id` skips the FK check, as intended.
  - Tier still comes only from `org_roles` (`with-auth.ts:69`). No RLS in the project, so no RLS gap.
- **R7 Admin-only create and delete before side effects.**
  - `createDevice` returns 422 `not_allowed` before `inTx` opens, with no query (`devices.ts:313`); tested in `devices.test.ts:260`.
  - `deleteDevice` refuses through `decideDelete` (not_allowed first, `rules.ts:308`) after a locked read and before the DELETE or audit write (`devices.ts:410-445`).
  - Both routes keep `{ tier: "user" }`; a refusal is a domain 422, never a late 401/403.
- **Null-owner equality hole closed.**
  - `updateDevice`: `cur.owner_id !== null && me === cur.owner_id` (`devices.ts:370`). `actorMemberId` can return null (member gate treats a missing row as active, `gate.ts:22`). Tested in `devices.test.ts:271`.
  - `placeDevice`: `cur[0].owner_id !== null && me[0]?.id === cur[0].owner_id` (`devices.ts:259`).
  - `deleteDevice` no longer looks at ownership for permission.
  - `toDto` uses `coalesce(m.sub = $2, false)` (`devices.ts:116`): `mine` false, `canEdit` Admin-only for unowned.
- **Migration constraints and FKs.**
  - `drop not null` keeps `devices_owner_fkey`; NULL owner skips the composite FK.
  - `devices_unowned_not_placed_check` and `devices_unowned_no_holding_check` added `not valid` then validated; cannot fail (all rows owned).
  - Serial, manufacturer, brand, note checks: trimmed, non-empty, length-bounded; NULL passes.
  - Handoffs: `kind`, `status`, `shape` checks; partial unique `device_handoffs_one_pending_idx`; device FK `on delete cascade`. The delete holds `FOR UPDATE` on the device row, so a concurrent handoff INSERT blocks on its FK `KEY SHARE` lock and then fails.
- **Unowned devices cannot be placed.**
  - App refuses at `rules.ts:335` after permission and stale-view checks, only when `target !== null`, owner read under the device lock (`devices.ts:230-261`).
  - DB refuses through the immediate CHECK, mapped to 422 `device_unowned` (`pg-error.ts:23-25`, `devices.ts:54`).
  - `canPlace` false for unowned in the DTO (`devices.ts:98`).
  - Tested in `devices.db.test.ts:232-252` and schema-check section 10.

### Findings

🟡 **The previous image still has the null === null hole; the rollback note doesn't mention it.** Evidence: origin/main `src/server/devices/devices.ts` ~`:380` (`canEdit(tier, me === cur.owner_id)` in `updateDevice`) and ~`:432` (same in `deleteDevice`).
- Applies while the old image runs against the migrated schema (rolling deploy or rollback) and unowned devices exist: a User with no `members` row can edit or delete any unowned device in their org. Having no member row is possible (gate treats missing row as active; the row is created by `/api/me`). Needs the device UUID.
- The plan's Downgrade note only says old inner joins hide unowned devices; `update`/`delete` select by id without a join.
- Low likelihood, impact within the org, but an unrecorded authorization gap.
- **Fix:** one line in the plan Downgrade note and in the `db/migrations/README.md` schema section: "rolling back after unowned devices exist re-opens the null-owner edit/delete hole for members without a member row; fix forward instead of rolling back."

💭 **Non-Admins take a row lock before they are refused** (`devices.ts:410-428`). Optional: mirror `createDevice` with an early `tier !== "admin"` 422 before `inTx`; keep `decideDelete`'s check as second line.

💭 **`device_handoffs_decided_check` only ties `decided_at` to status** (migration ~line 55); nothing requires `decided_by_id` null while pending. Tighten in SIM-037.3.

💭 **The DB doesn't tie `from_member_id` to `devices.owner_id`** (can't with a CHECK). SIM-037.3 must check it under the device lock (comment at `devices.ts:422`).

### Follow-ups (out of scope)
- SIM-037.3: insert handoffs under the device `FOR UPDATE` lock; check `from_member_id` is the current owner and `to_member_id` an active member of the same org.
- `device_handoffs` has no indexes on member FKs (`from`, `requested_by`, `decided_by`): member-delete speed only; leave to slices that query them.
