# Security review — SIM-019

## Attempt 1 — security-ai-generated-code-auditor (Slice A)

Scope: `git diff origin/main...HEAD` on `ticket/SIM-019`. The diff touches these files: `src/app/api/audit/route.ts`, `src/app/api/audit/facets/route.ts`, `src/server/audit/audit.ts`, `src/lib/validate/audit-query.ts`, `src/lib/audit/cursor.ts`, `src/lib/audit/types.ts` and their tests. I also read these for context: `src/server/http/org-scope.ts`, `src/server/http/with-auth.ts`, `src/server/audit/write.ts`, the `meta` writers in `src/server/rooms/rooms.ts`, `db/migrations/20261120150000_init.sql` (`audit_log`, `members`) and `work/tickets/SIM-019/plan.md`.

This was a static, read-only review of the code. I did not run the checks and did not test against a real database (plan A6 leaves that to SIM-026).

**Verdict: 0 🔴, 0 🟡, 5 💭. Nothing blocks a PASS on security grounds.**

### Findings

No 🔴 blockers and no 🟡 should-fix items.

What I checked and found clean:

- **Org isolation (R6).**
  - Every query goes through `orgQuery`, and every WHERE starts with `a.org_id = $1`, which binds `scope.orgId` from the verified token (`src/server/audit/audit.ts:37,77,86`).
  - The `members` join includes `m.org_id = a.org_id` (`audit.ts:58,76`), so a display name from another org cannot leak in through a shared `sub`.
  - The cursor holds only `{at, id}`. `decodeCursor` rejects extra keys such as `org` (`src/lib/audit/cursor.ts:23`). A forged cursor can only move the keyset position inside the caller's own org, which gives no more than the `from`/`to` filters already do. Leaving the cursor unsigned is acceptable.
  - `?org=` in the query string is ignored, and the route test proves it (`route.test.ts:84-91`).
- **Admin-only tier.** Both handlers use `withAuth(..., { tier: "admin" })`. The 403 check comes before the member gate and the handler, so a 403 never touches the DB. Tests cover user, manager, admin and no-token cases for both routes.
- **SQL injection.**
  - Every user value is bound as a positional parameter with an explicit cast (`::uuid`, `::text`, `::timestamptz`, `::int`).
  - The `bind` helper numbers parameters from `$2`, matching how `orgQuery` puts `orgId` first.
  - The only string interpolations are the `$n` placeholders and the compile-time `AUDIT_LIMITS` constants (`audit.ts:79,89`). No request data reaches the SQL text.
- **Input bounds.**
  - `limit` must match `^[1-9]\d{0,2}$` and be at most 100.
  - `entity` must match `^[a-z][a-z0-9_]{0,63}$`.
  - `actor` must be a canonical UUID.
  - `from`/`to` must match a strict `Z` instant regex plus a round-trip check (which rejects 2026-02-30), and `from < to` is enforced.
  - A repeated parameter returns 400.
  - The cursor goes through a base64url charset check, then the JSON shape, the microsecond regex, `Date.parse` and the UUID check.
- **PII.** The DTO has no `org_id` and no email (`toDto`, `audit.ts:25-33`). `displayName` is required by the spec. `meta` is returned as stored, and per `writeAudit` and the current writers it holds only codes, field names and counts.
- **Error leakage.** A thrown error becomes `500 internal`, and the log records only an error code, never the message or SQL (`with-auth.ts`). Validation failures return a bare `invalid_request`. The `field` value from the validator is not sent to the client.
- **Caching.** Both handlers send `Cache-Control: no-store` and `dynamic = "force-dynamic"`.

### Notes (💭)

1. **`meta` holds user-entered text** (`src/server/audit/audit.ts:31`; writers at `src/server/rooms/rooms.ts:105,164,239`). Room `code` values typed by an admin end up in `meta` and come back unchanged. This is safe in the API (it is JSON). The risk is in Slice B, which must render `meta` keys and values only as text: no `dangerouslySetInnerHTML`, no linkifying. **Fix:** add an explicit acceptance criterion or test to SIM-019.2, for example "a meta value like `<img onerror>` renders as literal text".
2. **The facets query is an unbounded scan** (`audit.ts:71-90`). `select distinct` over the org's whole `audit_log`, plus a sort on `display_name`, reads every row before `limit 200` applies. Only an Admin can call it, so a hostile caller has little to gain, but the cost grows with the append-only log. Plan A2 already avoids `count(*)` for the same reason. **Fix (later):** time-box it (for example the last N days), or use a loose index scan or a materialized list once the log is large. File it as a debt follow-up, not a blocker.
3. **Results are silently cut off at 200 actors and 100 entity types** (`src/lib/audit/types.ts:4-5`). This is not a security issue, but an Admin of a large org could not pick actors past 200 in the UI. They could still filter by `actor` UUID through the API. **Fix:** return a `truncated: boolean` flag, or document the limit in Slice B.
4. **Cursor length is not capped before decoding** (`src/lib/audit/cursor.ts:13`). The charset regex and `Buffer.from` run on input of any length. Node's URL and header limits (about 16 KB) bound it, so the impact is negligible. **Optional fix:** add `if (s.length > 256) return null;` first.
5. **Isolation is proven only by SQL text and bindings** (plan A6). The unit tests confirm the `$1` binding and the join text, but nothing runs against a real Postgres. **Follow-up:** make sure SIM-026 includes a two-org test for `/api/audit` and `/api/audit/facets`, including an actor `sub` that is a member of both orgs with different display names.

### Follow-ups (out of scope)

- SIM-019.2 (Slice B): render `meta` and `displayName` as text only (note 1). Admin-only nav and page guard are already in the Slice B plan.
- SIM-026: two-org integration tests for both audit endpoints (note 5).
- Debt candidate: a strategy for facets performance and truncation as `audit_log` grows (notes 2 and 3).
- Writer contract: `writeAudit` documents "codes, field names and counts only", but nothing enforces it. Plan A7 accepts this. If future writers put free text such as notes or emails into `meta`, this endpoint will expose it to Admins. Consider a reviewer rule or an allowlisted `meta` type per action.
