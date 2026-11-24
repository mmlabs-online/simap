# SIM-014.3: Request a seat, My requests and nav badge

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-014.1 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/66 |

## Goal
Slice 4 of 4 of seat requests: Users request an empty seat from the seat panel, follow their requests and see a badge for newly decided ones.

## Scope reference
spec REG-01, REG-02; D21, D23, D24, D26. Split out of SIM-014 by its approved plan (`work/tickets/SIM-014/plan.md` → Split proposal).

## Scope
- "Request this seat" in the seat panel (`seatButtons`, `actionOutcome`; Users only).
- `/requests` page (My requests) with Cancel on pending rows; nav entry `myRequests` in `src/lib/nav.ts`.
- `badges` prop on `AppShellView` and `useRequestBadge` (fetch on mount, route change and focus; no polling, D24); opening My requests marks them seen.

## Out of scope
- Email notifications (D24). Polling or push.

## Acceptance criteria
- [ ] A User sees "Request this seat" on an empty, seatable seat; a duplicate request shows "already requested".
- [ ] My requests lists the caller's requests with status, and Cancel works on pending ones.
- [ ] The nav badge shows the number of newly decided requests and clears after My requests is opened.
- [ ] Static-render and pure-logic tests (no jsdom) cover the button rules, the page and the badge.

## Technical notes
- Builds on `src/lib/requests/*`, `src/server/requests/*` and `src/app/api/requests/**` from SIM-014. UI copy in `src/ui/copy/requests.ts` (D36).

## Test plan
- Unit: seat-actions additions, badge state; static render of the views.
- Manual: request a seat, see it approved, badge appears and clears.

## Notes / answers from Ming
- 2026-11-24: Plan approved without the split (Ming: "k tách", answering "say 'không tách' to keep one ticket"). All defaults; the SIM-014.5 contents of the Split proposal are folded into this ticket. No SIM-014.5 is filed.

## Handoff

### 2026-11-24 — claude — BLOCKED
- Agent calls: 3, tokens ~200k total (frontend-developer×1 default 54k, ux-architect×1 default 46k, planner×1 default 100k)
- Done: consults (frontend-developer, ux-architect), plan.md Status READY with a split proposal: SIM-014.3 = Request this seat + My requests page + nav entry (~430 src lines); SIM-014.5 = New markers, mark-seen and the nav badge.
- In progress / next: Ming approves the plan and split (M-40). On approval: file SIM-014.5 on the board, narrow this ticket's AC3/AC4, then IMPLEMENT.
- Gotchas: this slice changes `requests-api.ts`'s internal `call` to `call(path, init, read)`; SIM-014.4 builds approve/reject on it.

### 2026-11-24 — claude — DONE
- Agent calls: 3, tokens ~265k total (planner×1 re-plan default 65k, implementer×1 default 128k, reviewer×1 default 72k)
- Done: one slice (split declined), 35 files +1799/−35, review PASS with no issues, all checks green, PR #66 opened.
- In progress / next: Ming merges PR #66 and does the manual checks in the PR. Then SIM-014.4 (approve/reject dialogs) builds on the new `call(path, init, read)` in `requests-api.ts`.
- Gotchas: no local end-to-end run (no Identity session here); hooks are covered by typecheck/build only.
