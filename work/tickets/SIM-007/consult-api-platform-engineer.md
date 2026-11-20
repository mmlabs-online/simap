# Consult — api-platform-engineer — SIM-007 (2026-11-20, batch 2026-11-20-4)

## Findings
- GET /api/me today (src/app/api/me/route.ts): withAuth tier "user", returns flat `{sub,email,org,tier}`, no-store, no DB. Consumers: `readMeResult` in src/lib/identity/flow.ts reads only `tier` and `email` from the body, ignores extra fields. The AuthGate gate (src/ui/auth/AuthGate.tsx:198) treats 200+tier+email as "ready". So additive fields are safe; renaming or nesting `tier`/`email` would break the gate (and `route.test.ts`, which asserts the current shape).
- withAuth: memberGate is `allowAll` (SIM-011 will replace it with a deny list). The order is: verify, org required, tier, memberGate, handler. A first-visit user has no member row, so SIM-007 must not add a "member must exist" gate. Create-on-first-call lives in the handler only. No change to src/server/http/** is needed.
- Org scope: `ctx.scope` (OrgScope) plus `orgQuery` in src/server/http/org-scope. Rooms service pattern: `server-only`, `Db` type, `Result<T>` with `{ok:false,status,code}` refusals, route does `getPool()` -> 503 `unavailable`, `readJson` -> 400 `invalid_request`, validator in src/lib/validate/*.ts returning `{ok:false,field}`. Error body is only `{error:{code}}`; codes are in `API_ERROR_CODES` (src/lib/api/error.ts).
- members table (init migration, SIM-008) already has everything needed: `unique(org_id, sub)` (members_org_sub_key), `email text not null` with a non-blank check, `display_name text not null` with a `btrim(display_name) <> ''` check, `status`, `group_id`, `employee_code`. `sub` is `uuid`. No length check in the DB, and no NFC check.
- NFC convention: validators call `.normalize("NFC").trim()` and count `.length` (UTF-16 units) (src/lib/validate/room.ts). Rooms name max is 120.
- Edge: `email` in the token can be `null` (`AuthContext.email: string | null`), but `members.email` is NOT NULL.

## Recommendations
**Files:** new `src/server/members/members.ts` (+ test), new `src/lib/validate/member.ts` (+ test, includes the display-name default), edit `src/app/api/me/route.ts` (+ `route.test.ts`), plus the `src/ui/org/*` client work. No migration needed (R2 is not triggered; the schema already supports this).

**GET /api/me contract (keep it flat, additive):**
```
200 { sub, email, org, tier,
      member: { id, displayName, status, needsProfile: boolean } }
```
- Keep `sub`, `email`, `org`, `tier` unchanged so the SIM-006.2 gate keeps working.
- `needsProfile` means "created on first visit and name not yet confirmed". The criterion says a display name is required on the first visit, but the row's `display_name` is NOT NULL, so the first call must insert a default (email local part). Without a flag the UI cannot tell "first visit" from "returning". Preferred: add `profile_confirmed_at` via an expand-only migration. If a migration is not wanted, the fallback is to derive `needsProfile` from `created_at = updated_at`, which is fragile, and I do not recommend it. Needs Ming/planner choice (see open question 1). Note that a migration touches the High path `db/migrations`.
- Create-on-first-call as a single statement, no read-then-insert race:
  `insert into members (org_id, sub, email, display_name) values ($1,$2,$3,$4) on conflict (org_id, sub) do nothing`, followed by `select ... where org_id=$1 and sub=$2`. This is two statements; it is correct under READ COMMITTED since the conflicting insert blocks until the other transaction commits, so the follow-up select always sees the row. Do this on one connection/in one tx. Alternative: `on conflict (org_id, sub) do update set email = members.email returning ...` as a one-statement form, which writes the row on every call (avoid that).
- Should the email be refreshed on later calls? Do not update `display_name` on GET. Optionally refresh `email` only if it changed (cheap `update ... where email is distinct from $`), or leave it for later. Pick one and test it.
- Default display name: email local part (before the last "@"), NFC, trimmed, truncated to the max; if the email is null or the result is blank, fall back to a fixed placeholder such as the first 8 chars of `sub`. Do not 5xx on a null email. For the `email` column when the token has none, the insert would violate NOT NULL, so either return 403/422-style refusal or store a placeholder. Needs a decision (open question 2).
- Deactivated member: GET must not resurrect or reactivate. `on conflict do nothing` keeps the status, and the handler returns the row as is. Enforcement stays with SIM-011's memberGate (already 403 `member_deactivated` before the handler).
- Concurrency test: DB integration test (`*.db.test.ts`, `pnpm test:db`) firing N parallel `getOrCreateMe` calls for the same (org, sub), asserting one row and identical ids; a second case with different orgs for the same sub gives two rows (R6).
- Scope all queries via `ctx.scope` / `orgQuery` (R6); `sub` comes from the verified token only, never from the body.

**PATCH /api/me:**
- Tier "user". Body `{ displayName: string }`, strict: unknown keys give 400 (same as rooms). Parse with `readJson`; `ok:false` gives 400 `invalid_request`.
- Validation (lib/validate/member.ts): must be a string, `normalize("NFC").trim()`, then 1 to 80 characters (counted in code points, not UTF-16 units, to be fair to emoji/diacritics; rooms use `.length`, either is acceptable but be explicit), reject control characters (`\p{Cc}`) and collapse internal whitespace runs optionally. Reuse of the same limit in the DB is not necessary; the service is the single writer.
- Behaviour: update `display_name`, `updated_at = now()`, and (if the migration is added) set `profile_confirmed_at = coalesce(profile_confirmed_at, now())`. Return the same `member` object (or the full /api/me body) with 200, no-store. Idempotent: the same body gives the same result.
- If the member row does not exist yet (PATCH before any GET): either create-then-update in the same service call (recommended, makes the API order-independent) or 404 `not_found`. Recommend create-then-update.
- Error codes: reuse `invalid_request` (400) for all validation failures (consistent with rooms; the body carries no field). Add no new codes unless the UI needs a distinct "name_required"; if so add it to `API_ERROR_CODES`. 503 `unavailable` when no pool.
- Deactivated: handled earlier by the gate (403).
- Audit: ROO routes use `writeAudit`; a self display-name change is probably not audited in v1. Flag it as a planner call.

**Client compatibility:** extend `MeResult`/`readMeResult` additively (optional `member`), keep `viewForMe` behaviour for 200 with tier+email. A `needsProfile` 200 should route to the first-visit screen after the gate says ready, not be a new error state. Org picker/switcher runs before `/api/me` (needs `GET /auth/orgs` from Identity, client only; no server work).

**High paths:** none required. `src/server/http/**` (with-auth) stays untouched: do not put member creation into `memberGate`, because SIM-011 owns it. `src/server/identity/**` untouched. `db/migrations` is touched only if the `profile_confirmed_at` column is chosen; that is the one High-path decision to surface to Ming at the plan gate.

## Risks
- Using the `created_at = updated_at` heuristic instead of an explicit flag: breaks when Managers edit names (SIM-011) or on clock ties.
- Null token email vs NOT NULL column gives a 500 on first visit if not handled.
- Insert-then-select on separate pool connections is still fine, but a read replica or autocommit pooler (pgbouncer transaction mode) is not an issue here; just use one `withTx` for clarity.
- Changing the `/api/me` shape (nesting or renaming) breaks the AuthGate and the existing route test.
- Display-name inconsistencies: NFC on write only; seeded or SIM-011 edits must use the same validator.

## Open questions
1. Add an expand-only migration for `members.profile_confirmed_at` (touches High path `db/migrations`, needs Ming's approval) or accept a weaker first-visit signal?
2. What to store/do when the token has no email (null)? Reject with a 403/400, or placeholder?
3. Display name max (suggest 80) and whether to reject control chars only or also collapse whitespace.
4. Should PATCH before any GET auto-create the member (recommended)?
5. Does a self name change need an audit row (D28)?
6. Should GET /api/me refresh `members.email` when the token email changes?
