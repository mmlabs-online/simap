# Security review — SIM-017

## Attempt 1

**Verdict: no blockers. One should-fix (a missing test for the tier gate), the rest are notes.**

I read the source directly. I did not run any of the checks, so the green check results come from impl-log.md and I did not confirm them myself.

### Findings

**🔴 Blockers:** none.

**🟡 Should-fix**

1. **No test covers the step that decides who gets the holders list.**
   - Where: `src/app/api/dashboard/route.ts:14` (`includeHolders: atLeast(ctx.tier, "manager")`). There is no `src/app/api/dashboard/route.test.ts`.
   - Risk: this one line is the server-side boundary that keeps deactivated members' names and seats away from User-tier callers. `dashboard.db.test.ts:157` only checks that `getDashboard` returns `null` when it is handed `false`. Nothing checks that a User-tier token actually leads to `false`. Someone could later change the line to `atLeast(ctx.tier, "user")` or `true` and every check would stay green. R5 asks that new logic has tests. The plan did not list a route test, so this is a gap in the plan, not scope drift.
   - Fix: add `route.test.ts`, following the existing route tests such as `src/app/api/members/route.test.ts`, with stubbed auth deps and a stubbed `getDashboard`:
     - a `user` tier call expects `includeHolders: false` and `deactivatedHolders: null` in the body;
     - `manager` and `admin` calls expect `true`;
     - one more assertion that `Cache-Control: no-store` is on the 200 response.

**🟢 Notes (verified, no action needed)**

2. **Every query is scoped to the caller's org.** `src/server/dashboard/dashboard.ts`:
   - All three queries go through `orgQuery`. It refuses to run SQL that has no `org_id = $1` and binds `$1` from `scope.orgId` (`src/server/http/org-scope.ts:21-24`).
   - `TOTALS_SQL` (lines 29-34): all five subqueries repeat `org_id = $1`.
   - `HOLDERS_SQL` (lines 37-48): `members m.org_id = $1`. Each correlated `seats` subquery has `s.org_id = $1`, including the one inside `exists`. The rooms join is `r.org_id = s.org_id and r.id = s.room_id` (line 41), so a seat cannot pull in a room from another org.
   - The reused `listRooms` (`src/server/rooms/rooms.ts:60-70`) has `where r.org_id = $1`, and its left join is `s.org_id = r.org_id and s.room_id = r.id`.
   - The org comes only from the verified token (`with-auth.ts:67-71`). No value from the request reaches SQL; the only interpolations are the constants in `DASHBOARD_LIMITS`.
   - `dashboard.db.test.ts:165` covers isolation across two orgs for the totals, the room list and the holders total.

3. **Holders are decided on the server, not hidden in the UI.** Below Manager the server sends `deactivatedHolders: null` and never runs `HOLDERS_SQL` (`dashboard.ts:78-82`), so a User-tier response carries no member data. Managers only get id, display name, true seat count and capped seat/room refs (`types.ts:17-25`), with no email or sub.

4. **Auth wrapper order is correct (R7).** `withAuth({ tier: "user" })` returns 401, `org_required`, `forbidden` and `member_deactivated` before the handler runs (`with-auth.ts:60-75`). The handler itself returns only 503 `unavailable` (`route.ts:12`). The route is read-only, so no 401/403 can come after a side effect.

5. **List sizes are capped.**
   - Holders: `limit 50` (`DASHBOARD_LIMITS.holders`), with the true count taken from `count(*) over ()` before the limit. Covered by the 51-holder test at `dashboard.db.test.ts:145`.
   - Seats per holder: `limit 10`.
   - Rooms: `limit 500` in `listRooms`, with `roomsTruncated` computed from the true room total.
   - A small edge case: if the holders page were empty while the true total was above 0, `total` would read 0. With no offset that cannot happen, so it is fine.

6. **The transaction is read-only with repeatable-read isolation.** `withTx` runs `begin` first. `set transaction isolation level repeatable read, read only` runs before the first read (`dashboard.ts:68`), which is the required order, and it applies to the `listRooms` call too because the same client `c` is passed. The statement order is checked at `dashboard.db.test.ts:187-204`.

7. **Responses are not cached.** The 200 response sets `Cache-Control: no-store` (`route.ts:16`). Error responses get it from `apiError` (`src/server/http/respond.ts:6`), and the route has `dynamic = "force-dynamic"`.

8. **Layers and secrets (R1, R3).**
   - `dashboard.ts` starts with `import "server-only"`.
   - The route imports only server code and lib.
   - The UI files (`src/ui/dashboard/*`) import only lib (`@/lib/api/fetch`, `@/lib/dashboard/types`) and call `/api/dashboard` through the bearer `apiFetch`. They contain no secrets, env reads or `console` output.
   - Room links use `roomDetailHref` (`src/lib/nav.ts:63-65`), which applies `encodeURIComponent` and rejects `.` and `..`.
   - There is no `dangerouslySetInnerHTML`; display names render as React text.

### Follow-ups (out of scope)
- None beyond finding 1. If it is not fixed in this rework, record it as a follow-up ticket.
