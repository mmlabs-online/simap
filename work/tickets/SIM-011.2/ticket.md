# SIM-011.2: Members page UI: list, edit and deactivate dialogs

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | ui |
| Gate | plan-approval |
| Depends on | SIM-011 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-22 |
| Claimed by | claude@2026-11-24T13:30:01Z |
| PR | — |

## Goal
Managers manage members from the Members page; Users see the same list read-only. Slice 2 of SIM-011 (split approved by Ming with the SIM-011 plan, 2026-11-22).

## Scope reference
spec MEM-01, MEM-02; D12, D16 (a), D17, D34, D36. `work/tickets/SIM-011/plan.md` → *Split proposal*.

## Scope
- `src/app/(app)/members/page.tsx` → `<MembersPage />`; `src/ui/members/*`: `MembersPage`, pure `MembersView`, `useMembers` (search, "Load more"), `members-api`, `member-form`, `EditMemberDialog`, `DeactivateMemberDialog` (impact counts, release choice, re-fetch on `member_not_empty`), pending invitations section (Manager+); `src/ui/copy/members.ts`; `src/ui/index.ts` export.
- Users see no action buttons; the page says accounts are managed in mmlabs; no delete action.

## Out of scope
- Server/API changes (SIM-011); removing from the org and Identity sync (SIM-020); groups management (GRP-01).

## Acceptance criteria
- [ ] Users see the list read-only; Managers see Edit and Deactivate/Reactivate actions.
- [ ] Deactivating a member with seats/devices shows the counts and, on confirm, calls deactivate with `release:true`; a stale dialog re-fetches on `member_not_empty`.
- [ ] Edit maps `employee_code_taken` and `invalid_request` to inline messages.
- [ ] Search restarts the list; "Load more" pages with the cursor.
- [ ] All copy lives in `src/ui/copy/members.ts`; view and api-client unit tests pass.

## Technical notes
- Files: see Scope. Build from `work/tickets/SIM-011/consult-frontend-developer.md` §Recommendations 2-3 and the SIM-011 API contract.
- Risks / open questions: none beyond SIM-011's assumptions A1–A11. SIM-009 adds `<InvitePeople />` to `src/app/(app)/members/page.tsx` and `src/ui/index.ts`; keep it when replacing the page.

## Test plan
- Unit: `MembersView` (renderToStaticMarkup: User vs Manager, states), `members-api` with a fake fetcher, dialog flow logic.
- Manual: deactivate a member who holds a seat.

## Notes / answers from Ming
- 2026-11-24: rerun after the 2026-11-23 escalation (option 1 in `escalation.md`: subagents launch again in this session); Ming ran `/run SIM-011.2`.

Waiting for Ming: plan approval (policy `high-paths+P1`; this ticket is P1)
- 2026-11-24 Plan approved (Ming: "plan-approval"; covers assumptions A1–A6, A10–A11). M-45 (renumbered from M-44, which main already used).

## Handoff

### 2026-11-23 — claude — ESCALATED
- Agent calls: 2, tokens 0/0 (frontend-developer×2 model unknown — launch failed).
- Done: claim and Prepare only (on branch `ticket/SIM-011.2`).
- In progress / next: retry once subagents can launch.
- Gotchas: both frontend-developer launches returned `400 The requested model is not supported`; no consult or product files changed. Escalation copied to `escalation.md`.

### 2026-11-24 — claude — BLOCKED
- Agent calls: 2, ~134k tokens (frontend-developer×1 opus 77.7k, planner×1 opus 56.4k; per-call in/out split not reported)
- Done: rerun after the 2026-11-23 escalation; consult (ui) and plan READY. No High path, but the gate policy is now `high-paths+P1` and this ticket is P1, so Gate was raised to `plan-approval`.
- In progress / next: Ming approves `plan.md` (M-45: assumptions A1–A6 and A10–A11). Then `/run SIM-011.2` resumes at IMPLEMENT.
- Gotchas: SIM-017.3 (IN_PROGRESS elsewhere) likely touches `src/ui/index.ts`: expect a one-line conflict. Plan is ~650–750 lines with a fallback split. Session branch `claude/confident-cerf-67q5le`.

