# SIM-014.1 security review

## Attempt 1

## Security review: SIM-014.1, attempt 1

**Verdict: no blockers. Nothing to fix in this ticket.** I read every file in impl-log.md's list. I could not run git or any checks, so this is a static read only.

### Findings

🟢 **R6 org scoping holds on every query.** Each statement goes through `orgQuery`, and `orgQuery` throws unless the SQL contains `org_id = $1`. It binds `scope.orgId` itself (`src/server/http/org-scope.ts:21-24`).
- `REQUEST_FROM` repeats org_id on every join (`src/server/requests/requests.ts:63-67`).
- The new occupant join also repeats it: `o.org_id = s.org_id and o.id = s.occupant_id` (`src/server/requests/read.ts:47`). `s.org_id` already equals `q.org_id` through the seats join, so no other org's member name can leak through it.
- `countUnseen` (read.ts:77-78), the member lookup (read.ts:96-97) and the mark-seen update (read.ts:148-152) all filter `org_id = $1`.

🟢 **Tier gating is correct.**
- `GET /api/requests` is `{ tier: "manager" }` (`src/app/api/requests/route.ts:40`).
- `mine` (`src/app/api/requests/mine/route.ts:21`) and `mine/seen` (`src/app/api/requests/mine/seen/route.ts:24`) are `{ tier: "user" }`. Both take the caller only from `ctx.sub`, never from the query or the body.
- `listMyRequests` resolves the member with `org_id = $1 and sub = $2` and filters requests by `q.subject_id = <that member id>` (read.ts:96-105).
- A caller with no member row gets an empty result. It is never widened to other members.

🟢 **Cursor decoding is safe and the limit is bounded.**
- `decodeCursor` (`src/lib/audit/cursor.ts:12-26`) accepts only the base64url charset, exactly the keys `at` and `id`, `at` in microsecond form, and `id` as a canonical UUID.
- All values are bound parameters (`binder`, read.ts:20-25). Only `$n` placeholders are put into the SQL text.
- `limit` must match `^[1-9]\d{0,2}$` and is capped at `REQUEST_LIMITS.maxLimit` (`src/lib/validate/request-query.ts:17,30-35`).
- Repeated parameters are refused, and `status` is checked against an allowlist (request-query.ts:47-53).

🟢 **Mark-seen updates only the caller's row, only forward, and never past now.** The update is `greatest(coalesce(requests_seen_at,'-infinity'), least(coalesce($3, now()), now()))` with `where org_id = $1 and sub = $2::uuid` (read.ts:148-152). `validateSeenBody` refuses extra keys and impossible dates such as Feb 30 (`src/lib/validate/request.ts:23-37`). A caller with no member row changes nothing.

🟢 **R7 holds.** 401 and 403 come only from `withAuth` (`src/server/http/with-auth.ts:70-73`), before the handler runs. The handlers return only 400 / 503 / 200. Validation runs before any write. Mark-seen has no audit row or other side effect apart from the update.

🟢 **No secrets (R3).** The new code has no hardcoded credentials and logs nothing. `Cache-Control: no-store` is set on all three GET/POST responses.

🟡 (optional, not from this diff) **A crafted cursor can cause a 500.** `decodeCursor` relies on `Date.parse` (`src/lib/audit/cursor.ts:24`). V8 accepts impossible dates like `2026-02-30T...` and rolls them over, but Postgres rejects them in the `::timestamptz` cast (read.ts:38,108). The result is a 500 instead of a 400. There is no injection or data exposure. The cursor module is not new here, but this ticket adds new callers.
- Fix: use the same round-trip check `isMicroInstant` uses in `request.ts:23-27` (`new Date(s).toISOString().slice(0,19) === s.slice(0,19)`).
- This fits the follow-up already on file to rename the cursor module.

### Follow-ups (out of scope)
- Harden the date check in `decodeCursor` as described in the 🟡 above, when the cursor module is renamed.
- `read.db.test.ts` was not run locally (no `DATABASE_URL`). The org-isolation and cross-member tests (AC1-AC3) are only proven once CI `test:db` is green, so R5 depends on that run.
