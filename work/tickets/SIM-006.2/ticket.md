# SIM-006.2: Sign-in gate UI (AuthGate, sign-in screen, /sign-in)

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P0 |
| Size | M |
| Areas | security, ui |
| Gate | none |
| Depends on | SIM-006, SIM-022 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Signed-out users see the sign-in screen in place on any app page and land back on it after signing in, using the SIM-006 auth library; slice S2 of the approved SIM-006 plan.

## Scope reference
`work/tickets/SIM-006/plan.md` slice S2 (approved 2026-11-20, batch 2026-11-20-2): AC1, AC3b, AC4b, AC7. Spec AUT-01/AUT-02; D4, D7.

## Scope
- Everything listed under slice S2 in `work/tickets/SIM-006/plan.md` (return-to, `waitText`, optional `orgName`, Turnstile widget, `runtime.ts`, `AuthLayout`, views, `AuthGate`, apiFetch context, `SignInRoute`, `src/ui/copy/auth.ts`, `(app)/layout.tsx`, `/sign-in`).

## Out of scope
- Account pages (SIM-006.3). Org picker (SIM-007).

## Acceptance criteria
- [ ] AC1, AC3b, AC4b and AC7 exactly as written in `work/tickets/SIM-006/plan.md` slice S2.
- [ ] All loop checks green; copy follows the SIM-022 convention (no-literals test passes).

## Technical notes
- Ming steps before merge: `.env.example` names `NEXT_PUBLIC_MM_IDENTITY_BASE=` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY=`; simap hostnames on the Turnstile widget. Re-plan only if SIM-006 or SIM-022 merged with changes that affect S2.
- Split from an approved plan: the planner reuses that plan's slice; re-plan only what changed on `main` since.

## Test plan
- As in the source plan's slice.

## Notes / answers from Ming
- 2026-11-20 (batch 2026-11-20-2): created from the split Ming approved ("duyệt hết; câu 20 tách 3 phần; … còn lại theo đề xuất").

## Handoff
