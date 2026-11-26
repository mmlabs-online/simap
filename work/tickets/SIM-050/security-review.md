# Security review — SIM-050

## Attempt 1

**Summary: PASS from a security standpoint. A User can no longer get another member's email from the list, the detail, or the `q` filter used as a search, and I found no other User-tier endpoint that returns it. R6 and R7 hold. There are no blockers or should-fix items; I have two notes.**

I worked read-only with Grep and Read. I had no Bash, so I did not re-run the checks myself; check results come from `impl-log.md`.

### Findings

No 🔴 blockers. No 🟡 should-fix items.

💭 **The email rule is tied to the device-visibility rule** (`src/server/members/manage.ts:155-156`, `:190`, `:207`)
- Email is withheld by the same `visible` condition that hides devices: `deviceVisibility(tier) === "held"`, which is true only for the `user` tier (`src/lib/devices/visibility.ts:6-7`).
- Today this is correct. The risk: if someone later loosens device visibility for Users (for example, devices made visible org-wide), other members' emails would become visible with no test failing on the email side.
- **Fix (optional, later):** give email its own rule, such as `emailVisibility(tier)` in `src/lib/members/`, or add a comment at line 155 saying the condition also guards email. The new DB test at `manage.db.test.ts:497` already catches a regression in the current shape.

💭 **Search by email is correctly closed for Users** (`manage.ts:158-162`)
- For a User the email term is `(like(m.email) and coalesce(m.sub = $2::uuid, false))`, so an email-substring search can only ever match the caller's own row.
- So there is no yes/no test that would reveal another member's email; the match is an AND inside one SQL expression.
- Paging and sort order use `lower(display_name), id`, not email, so they reveal nothing either.
- The test `manage.db.test.ts:512-516` covers this: another member's email gives `[]`, the shared domain matches only the caller's own row, and name and employee code still match.

### Other ways member data leaves the server (all checked)
- **Export** (`src/server/export/export.ts:29,97`) selects `m.email`, but the route `src/app/api/export/[kind]/route.ts:25` is `{ tier: "manager" }`. Fine.
- **`GET /api/members/invitations`** (pending invitation emails) is `{ tier: "manager" }`. Fine.
- **Edit, deactivate and reactivate routes** return a full row through `mustLoad(..., null)` (email shown), but all are `{ tier: "manager" }`. Fine.
- **`GET /api/members/[id]/photo`** is open to Users but returns only image bytes, no member fields.
- **DSH-02 search** (`src/server/search/search.ts`): the only server code that selects `email` is export, members, invitations and the auth context. Search has none, which matches the plan.
- **`/api/me` and the app shell** show only the caller's own token email. Fine.
- **Audit log:** `member.update` stores only changed field names, not values.

### R6 (org scoping)
- Every query in the changed code keeps `m.org_id = $1` and goes through `orgQuery`. The subqueries repeat `org_id = $1`.
- Bind order is kept: `sub` is `$2` in `listMembers` and `$3` in `loadMember`, after `id` at `$2`.
- The tier comes from `ctx.tier`, set by the auth wrapper from `org_roles` (`with-auth.ts:67-71`).

### R7 (auth error codes)
- No new 401 or 403 responses and no new auth codes. Both GET routes stay `{ tier: "user" }` through `withAuth`, and the changed code only reads.

### Client side
- `MembersView.tsx` shows `m.email ?? membersCopy.hiddenEmail` ("-"). `EditMemberDialog.tsx` uses `member.email ?? undefined`.
- The email is withheld in SQL, so it never reaches the browser.
- No secrets, env values or new client-exposed env variables were added.

### Follow-ups (out of scope)
- If OQ-58 or D69 is ever widened, consider a separate email-visibility rule (first note above) so device and email privacy can change independently.
- Optionally add a test asserting that every User-tier route returning member-shaped rows has a null email for other members, as a guard for future endpoints such as seat-request or handoff responses.

Files reviewed: `src/server/members/manage.ts`, `src/server/members/manage.db.test.ts`, `src/lib/devices/visibility.ts`, `src/server/export/export.ts`, `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`, `src/app/api/members/[id]/photo/route.ts`, `src/app/api/members/invitations/route.ts`, `src/app/api/export/[kind]/route.ts`.
