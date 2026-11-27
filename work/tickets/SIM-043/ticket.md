# SIM-043: Let an app-wide simap admin access every org

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P2 |
| Size | M |
| Areas | security, api, architecture |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | M-83, M-84 |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | claude@2026-11-27T02:23:21Z |
| PR | — |

## Goal
An account that holds an app-wide simap admin role in Identity can open and manage any org in simap without being
added to each org as a member, so mmlabs staff can support every org from one account.

## Scope reference
**None fits; this conflicts with the spec.** `docs/spec-v1.md` §2 *Roles*: "org data is never authorized from `roles`";
`simap:member` (app scope) "grants no org access"; §2 "Super Admin … simap has no Super Admin screen of its own";
AUT-02 "A valid token without `org` or without a simap org role gets 403 on org routes". Decisions D5, D10, D14 and
rule R6 ("roles come only from `org_roles`"). The ticket can only run after Ming records a new decision that
supersedes these points (M-83) and Identity can mint such tokens (M-84). Raised by Ming's team on 2026-11-26
("admin với permission app-wide … đúng ra phải access được tất cả org").

## Scope
- Read one app-scope role from the verified token's `roles` claim (key fixed by the M-83 decision, e.g.
  `simap:superadmin`), with exact-key matching like `tierFromOrgRoles`.
- In `withAuth`, a token with `org` and that role gets the admin tier in that org even if `org_roles` holds no simap
  role. The org scope still comes only from the verified `org` claim.
- Member gate and `/api/me` for an account with no `members` row in the org: behaviour per M-83 (create a member row
  on first visit, or a virtual member that is not listed).
- Audit every request (or at least every write) that is authorized only by the app-wide role, with the actor's `sub`.
- Org picker: list every org for such an account, as far as Identity returns them (M-84).

## Out of scope
- The org-admin-api change itself (minting org tokens for non-members, listing all orgs): M-84, another repo.
- A simap screen to create orgs or appoint admins (D10 stays).
- Changes to how normal `org_roles` tiers work.

## Acceptance criteria
- [ ] A token with `org` = X, the app-wide role in `roles`, and no simap role in `org_roles` gets the admin tier in org X
  (route tests: an admin-tier route returns 2xx, not 403 `forbidden`).
- [ ] Any other value in `roles` (including `simap:member`, `simap:admin` in app scope, or a near-miss key) still grants
  nothing: the same token gets 403 `forbidden`, as today.
- [ ] The app-wide role never widens scope: every query still uses `ctx.scope` from the verified `org` claim, and a
  token without `org` still gets 403 `org_required`.
- [ ] A request authorized only by the app-wide role writes an audit row in org X naming the actor `sub` and marking the
  cross-org access (shape per plan).
- [ ] The member gate and `/api/me` behave as M-83 decides for an app-wide admin with no `members` row; a deactivated
  member row still gives 403 `member_deactivated`.
- [ ] Spec §2, AUT-02, AUT-04 and `CLAUDE.md` R6 are updated to match the new decision.

## Technical notes
- Files: `src/server/identity/verify.ts` (today: "`roles` (app scope) is never read"), `src/server/http/with-auth.ts`,
  `src/lib/auth/tier.ts`, `src/server/members/gate.ts`, `src/server/members/members.ts`, `src/server/audit/*`,
  route tests (`with-auth.test.ts`, `verify.test.ts`), `docs/spec-v1.md`, `CLAUDE.md`.
- High paths: `src/server/identity/**`, `src/server/http/**` → plan approval required.
- Risks / open questions: (1) Identity must refuse to put the app-wide role in `roles` for anyone but staff; simap trusts
  the claim. (2) Does the app-wide admin appear in the org's member list, seat assignment and dashboards? (3) Should the
  app-wide admin be read-only by default? (4) `apiFetch` re-mint on 403 must not loop when Identity refuses the org.

## Test plan
- Unit: `verify.test.ts` (roles parsing, invalid shapes fail closed), `tier.test.ts`, `with-auth.test.ts` (grant, no
  grant, no `org`, deactivated row, audit call).
- Manual: with a staff test account holding the role, pick an org it is not a member of and open rooms/seats; check the
  audit list.

## Notes / answers from Ming
- 2026-11-26 Ming (M-83, D75): role key `admin:super-admin`; full Admin access (read and CRUD) in every org. Still open for the plan gate: member row on first visit, audit shape.
<Answers to blocking questions and "Plan approved (YYYY-MM-DD)" lines go here.>

- 2026-11-27: M-84 answered by org-admin-api (ADR-0030) and marked done by Ming. Contract in D86: role key `simap:super-admin`, check `org_access == "super_admin"`, `org_roles: []`, picker items have `access`, handle 429 on `/auth/token`. Release waits for M-90 (org-admin-api deploy + setup).

- Plan approved (2026-11-27): Ming "duyệt SIM-043, tách slice 2" — plan slice 1 with defaults Q1–Q15; slice 2 split into SIM-043.1.

## Handoff

### 2026-11-27 — claude — BLOCKED
- Agent calls: 3 (api-platform-engineer×1 36k, software-architect×1 54k, planner×1 90k; default models)
- Done: consults, plan READY (slice 1 of a proposed split; follows D86 over the older ticket wording); plan gate (High paths); M-91 added.
- In progress / next: Ming approves the plan and Q1–Q15 → implement slice 1; create the slice-2 ticket if the split is approved.
- Gotchas: ticket Scope/Notes/AC1 still say the old role key and lack the `org_access` condition; D86 wins.
