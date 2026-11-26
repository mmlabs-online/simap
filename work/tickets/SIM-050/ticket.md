# SIM-050: Hide other members' email from Users

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | S |
| Areas | api, security |
| Gate | none |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/127 |

## Goal
A User no longer receives other members' email addresses from the members API or search, so D69's privacy intent
covers contact data too (follow-up Q6 of SIM-044).

## Scope reference
`docs/spec-v1.md` MEM-02, OQ-58 (default: Users keep the Members page with names, employee code and seats); D69.
Follow-up from `work/tickets/SIM-044/plan.md` Q6 and SIM-044.1. **Needs Ming at plan time:** confirm that email is
not part of what Users see (OQ-58 default lists names, employee code and seats only).

## Scope
- `GET /api/members` and `/api/members/[id]`: for a User, other members' `email` is null (in SQL); the caller's own row keeps it.
- Search (DSH-02) member group: for a User, do not match on other members' email.
- UI: Members list / member card show nothing (or "-") where email is withheld.

## Out of scope
- Manager/Admin responses (unchanged); invitations.

## Acceptance criteria
- [ ] For a User, other members' `email` is null in list and detail responses; the caller's own row keeps it.
- [ ] For a User, searching by another member's email returns no member result; searching by name still works.
- [ ] Manager and Admin responses and search are unchanged.
- [ ] UI renders withheld email without errors.
- [ ] Per-tier unit and DB tests for members and search.

## Technical notes
- Files: `src/server/members/manage.ts` (l.119 `m.email`, l.163 search `like(m.email)`), `src/server/search/search.ts`, `src/lib/members/types.ts`, `src/ui/members/**`, tests.

## Test plan
- DB: `manage.db.test.ts`, `search.db.test.ts` per tier.

## Notes / answers from Ming
- Plan approved (2026-11-26, batch 2026-11-26-2): "duyệt hết theo mặc định"; Q1 default: hide email from Users (own email still shown).

## Handoff

### 2026-11-26 — claude — DONE
- Agent calls: 4, ~129k tokens (planner×1 sonnet 27k, implementer×1 default 38k, reviewer×1 sonnet 26k, security-ai-generated-code-auditor×1 default 38k; consult skipped, fast lane; batch 2026-11-26-2).
- Done: email null for other members for Users (list, detail, `q`); UI dash; per-tier DB test; review PASS attempt 1; PR #127.
- In progress / next: Ming merges PR #127.
- Gotchas: email hiding reuses the device `visible` condition; reviewer saw one unexplained `pnpm test` exit 1, green on re-run.
