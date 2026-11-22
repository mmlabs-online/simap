# Security review — SIM-011

## Attempt 1

## Security review: SIM-011, attempt 1 (read-only)

**Verdict: no blockers.** Two should-fix items and a few notes are below.

I only had Read, Grep and Glob, so I could not run `git diff` or any of the Checks. I reviewed the files the plan lists by reading them directly. R5 (green checks) still needs the orchestrator's check run.

### Findings

**🔴 Blockers:** none.

**🟡 1. A Manager can lock every Admin out of simap, and only a DB edit can undo it.**
- Where: `/home/user/simap/src/server/members/manage.ts:336-434` (`deactivateMember` only refuses self, at :366/:369) and `/home/user/simap/src/server/http/with-auth.ts:73-75` (the gate runs on every route, including `reactivate`).
- Risk: a Manager can deactivate any other member, Admins included (plan A4). After that, the gate refuses every call from those members with 403 `member_deactivated`, including `POST /api/members/[id]/reactivate`. A rogue or compromised Manager could deactivate all other Managers and Admins. Nobody left could reactivate them, and the mmlabs admin portal cannot change `members.status`. The only way back is a manual DB update.
- This is a known, documented assumption (A4), not an implementation bug. But it is a privilege-escalation-shaped gap: a lower tier can deny service to a higher tier.
- Fix (for Ming to decide, not a code change in this attempt): either make deactivate/reactivate Admin-tier only, or record a runbook step in `work/ming-todo.md` (the SQL to reactivate a member). Raise A4 explicitly when Ming confirms the assumptions.

**🟡 2. The `"dup"` marker collides with a real query value.**
- Where: `/home/user/simap/src/lib/validate/member-query.ts:18-22, 26`.
- `get()` returns the string `"dup"` to mean "this param was repeated". That is the same value a client sends with `?q=dup`, so searching for exactly `dup` returns 400 `invalid_request`.
- Not exploitable (it fails closed). It is a correctness bug in input validation, and the same pattern would be dangerous if it were ever copied to a param where `"dup"` is a valid value.
- Fix: return a unique symbol (`const DUP = Symbol("dup")`) or `{ dup: true }` instead of the string. Add a test that `?q=dup` passes.

**🟢 Verified clean:**
- **R6 (org scoping):**
  - Every SQL statement in `manage.ts` and `gate.ts` goes through `orgQuery`.
  - Every subquery and join repeats `org_id = $1`: the counts and ref lists at `manage.ts:114-124`, the group join at :124, `SEAT_SET` at :329-330, the impact at :297-301 and the release updates at :378-398.
  - Parameter numbering is right. `bind()` returns `$${values.length + 1}` because `$1` is the org (:143-146). The update `sets` start at `$3` (:272) with values `[id, ...]`.
  - The group check (:259-265) and the composite FK keep a cross-org `groupId` out.
  - Roles come only from the token (`with-auth.ts:69-70`).
- **SQL injection:**
  - The column names in `updateMember` come from the fixed `COLUMN` map, keyed by `changedFields`, which only returns the three known fields (`profile.ts:7,14`).
  - The search term is a bound parameter, escaped with `escapeLike` (`search.ts:3`) and `escape '\'`.
  - The cursor parts are bound and cast to `::text` / `::uuid`.
  - `refCap` and the limits are constants.
- **R7 (auth codes):**
  - Order is verify, then org, then tier, then gate, then handler (`with-auth.ts:57-79`). The gate's 403 comes before any side effect.
  - A gate failure fails closed with 503 (:76-79).
  - Service refusals are only 400/404/409 (`manage.ts:27-36`). No handler returns 401/403.
- **Deny list:**
  - `gate.ts:12-24` runs one lookup per call and caches nothing.
  - `globalThis.__simapAuth` caches only the function, not results.
  - A missing row counts as `active`.
  - `/api/me`'s insert uses `on conflict (org_id, sub) do nothing` (`members.ts:62`), so a deactivated member cannot reset their status through first-visit creation.
- **R1:**
  - Routes import only `@/server/*` and `@/lib/*`.
  - `gate.ts`, `manage.ts` and `pg-error.ts` start with `import "server-only"`.
  - `src/lib/members/*` and `src/lib/validate/member*.ts` import only lib code.
  - `gate.ts:4` imports `MemberGate` from `with-auth` as a type only, so the circular import is harmless.
- **R3:**
  - No new env vars or secrets.
  - Logs carry event codes only.
  - Audit meta holds field names and counts only (`manage.ts:284, 424-430`).
  - DTOs never include `sub` (`toDto`, :86-107).
  - The invitations DTO leaves out `identity_invitation_id` and `invited_by_sub` (:210-216).
- **Authorization tiers:**
  - list and detail are `user`.
  - PATCH, deactivate, reactivate, deactivation-impact and invitations are `manager`.
  - Self-deactivation is refused (:366).
- **Input bounds:**
  - Body validators reject unknown keys and empty objects (`member.ts:67-102`).
  - The employee code is ASCII-only, 1-32 characters, stored uppercase.
  - `q` is capped at 80 code points, `limit` at 100, cursor `k` at 320, and detail ref lists at 500.
  - The `[id]` param is checked with `isCanonicalUuid` before any DB access.
- **Caching:** success responses send `Cache-Control: no-store`, and so does `apiError` (`respond.ts:6`).

**🟢 Notes (accepted by plan, no action needed):**
- Users can see member emails and employee codes (A7, spec §2).
- A request already past the gate when the member is deactivated can still finish (A10, allowed by the ticket).
- Every guarded route now needs the DB: with no pool, `/api/*` returns 503. This is intended fail-closed behaviour.

### Follow-ups (out of scope)
- Settle A4 with Ming: who may deactivate Admins, and how an org recovers if every Manager+ is deactivated.
- Any future query-param parser copied from `member-query.ts` should not use a string as the duplicate marker.

### Files reviewed
- /home/user/simap/src/server/http/with-auth.ts
- /home/user/simap/src/server/members/gate.ts
- /home/user/simap/src/server/members/manage.ts
- /home/user/simap/src/server/members/pg-error.ts
- /home/user/simap/src/server/members/members.ts (grep only)
- /home/user/simap/src/server/http/org-scope.ts
- /home/user/simap/src/server/http/respond.ts
- /home/user/simap/src/app/api/members/route.ts
- /home/user/simap/src/app/api/members/invitations/route.ts
- /home/user/simap/src/app/api/members/[id]/route.ts
- /home/user/simap/src/app/api/members/[id]/deactivate/route.ts
- /home/user/simap/src/app/api/members/[id]/reactivate/route.ts
- /home/user/simap/src/app/api/members/[id]/deactivation-impact/route.ts
- /home/user/simap/src/lib/validate/member.ts
- /home/user/simap/src/lib/validate/member-query.ts
- /home/user/simap/src/lib/members/cursor.ts
- /home/user/simap/src/lib/members/search.ts
- /home/user/simap/src/lib/members/profile.ts
- /home/user/simap/work/tickets/SIM-011/plan.md
