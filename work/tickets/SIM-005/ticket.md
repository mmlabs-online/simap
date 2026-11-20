# SIM-005: Verify Identity tokens on the server and guard /api routes

| Field | Value |
|---|---|
| State | DONE |
| Priority | P0 |
| Size | M |
| Areas | security, api, architecture |
| Gate | plan-approval |
| Depends on | SIM-001 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | pending — Ming opens it from the prefilled compare link (main...ticket/SIM-005) |

## Goal
Every `/api/*` route handler knows who calls it, in which org and with which tier, by verifying the mmlabs Identity access token the tudocuatui way, and refuses everything else.

## Scope reference
spec §2 Organizations/Roles, §3 Auth, AUT-02, AUT-04, SYS-01, §8 Security; D4, D5, D7, D14, D15, D34 (deny list); CLAUDE.md R6.

## Scope
- Port tudocuatui `server/identity.js` + `server/jwks.js` to `src/server/identity/` (ES256 only, JWKS cache/stale/cooldown, refuse `jku`/`x5u`/`jwk`/`x5c`, exact `iss`, `aud`=`simap`, `typ`=`at+jwt`, required claims, 30 s leeway, `email_verified`, UUID `sub`).
- Read `org` and `org_roles`; reject `org` without `org_roles`; map roles to tier (Admin > Manager > User, D15) from `org_roles` only.
- A route helper (e.g. `withAuth(handler, { tier })`) returning 401 (bad token), 403 (no org / tier too low), 503 (JWKS unavailable) in one error shape.
- Org-scoping helper that every org query must use (R6), and a hook for the simap-local deny list of deactivated members (filled by SIM-011).
- `MM_IDENTITY_ISSUER` in `.env.example` (production must be `https://api.mmlabs.online`).

## Out of scope
- Browser sign-in (SIM-006). Member lookup/creation (SIM-007). Database tables (SIM-008).

## Acceptance criteria
- [ ] A valid org token with `simap:manager` in `org_roles` reaches a Manager+ route with `{ sub, email, org, tier: 'manager' }`.
- [ ] Each rejection returns 401 with no details: wrong alg, `typ`, `iss`, `aud`, expired, unknown `kid`, key in header, `email_verified` false, non-UUID `sub`, `org` without `org_roles`.
- [ ] A token without `org`, or with no simap role in `org_roles`, gets 403 on org routes; `roles` (app scope) never grants org access.
- [ ] JWKS unreachable → 503, not 401.
- [ ] Tokens and claims are never logged; unit tests cover every rule above with a local ES256 key and JWKS.

## Technical notes
- Files: `src/server/identity/*`, `src/server/http/*`, `.env.example`; reference tudocuatui `server/identity.js`, `server/jwks.js` and their tests; org-admin-api `docs/consumers.md` (Verifying, Organizations).
- Risks / open questions: High path (auth). Identity tokens can be ~5 KB; keep `MAX_TOKEN_CHARS` large enough.

## Test plan
- Unit: token verification rules, tier mapping, error mapping, org-scope helper.
- Manual: call `/api/me`-like test route with a dev token once M-1 exists.

## Notes / answers from Ming
- Plan approved (2026-11-20, batch 2026-11-20-1) — Ming: "duyệt hết theo mặc định" (every default in plan.md accepted).

## Handoff

### 2026-11-20 — claude — DONE
- Agent calls: 6, ~452k tokens (api-platform-engineer×1 40k, software-architect×1 60k, planner×1 91k, implementer×1 103k, reviewer×1 71k, security auditor×1 86k)
- Done: verifier/JWKS port, withAuth guard, error shape, OrgScope/orgQuery, /api/me; review PASS attempt 1; security 0 🔴 / 2 🟡
- In progress / next: Ming appends MM_IDENTITY_ISSUER= to .env.example; decide on the two 🟡 fixes (default: small commit before merge); Ming opens + merges the PR
- Gotchas: .env.example is unreadable/unwritable for agents (deny rule)
