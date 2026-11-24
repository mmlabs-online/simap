# SIM-014.4: Approvals: Approve and Reject dialogs

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | M |
| Areas | ui, ux |
| Gate | plan-approval |
| Depends on | SIM-014.2 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/67 |

## Goal
Managers approve or reject seat requests from the Approvals page.

## Scope reference
spec REG-01, REG-02; D18, D24, D26. Split out of SIM-014.2 by its approved plan (`work/tickets/SIM-014.2/plan.md` → Split proposal and the defaults recorded under it).

## Scope
- `requests-api.approve(id)` / `reject(id)` (no body); pure `requests-flow.ts` `settleDecision(action, result)`.
- `DecisionDialog.tsx`: one `EntityFormDialog` keyed by request id + action, standard primary submit (no shared-component change). The Approve text names requester, seat and room, plus the other loaded pending requests for the seat (best effort). No device sentence (DEV-06 does not apply).
- Row buttons only on pending rows; Approve disabled with the occupant hint when `currentOccupant` is set, Reject stays enabled.
- Per-row `busyId`; `aria-live` notice ("This request was already {status}." for a no-op 200); focus to the h1 and `reload()` after every decision.

## Out of scope
- A `rivalCount` on the list DTO (follow-up). Reject reason (REG-02). Email (D24).

## Acceptance criteria
- [ ] Approve and Reject go through a confirm dialog and refresh the list; refusals (`seat_taken`, `seat_cannot_seat`, `member_not_assignable`) show their message in the dialog.
- [ ] A decision on a request that is no longer pending shows the "already decided" notice; `not_found` closes and reloads.
- [ ] Pure-logic and static-render tests (no jsdom) cover the action outcomes and the dialog.

## Technical notes
- Builds on SIM-014.2's `src/ui/requests/*` (the `actions` slot on rows). UI copy in `src/ui/copy/requests.ts` (D36).

## Test plan
- Unit: settleDecision for each code; requests-api approve/reject; static render of the dialog.
- Manual: request → approve with two rival requests.

## Notes / answers from Ming
- 2026-11-24: Plan approved (all defaults A1-A6; Ming: "duyệt plan SIM-014.4").

## Handoff

### 2026-11-24 — claude — BLOCKED
- Agent calls: 3, tokens ~143k total (frontend-developer×1 default 40k, ux-architect×1 default 34k, planner×1 default 70k)
- Done: consults (re-check of the SIM-014.2 dialog advice against main), plan.md Status READY, no split (~330 src + ~320 test lines), no High path.
- In progress / next: Ming approves the plan (M-41), then IMPLEMENT.
- Gotchas: stage by explicit path; local shell needs Node via fnm and `cmd /c "pnpm ..."`.

### 2026-11-24 — claude — DONE
- Agent calls: 2, tokens ~127k total (implementer×1 default 75k, reviewer×1 default 52k)
- Done: attempt 1 implemented (20 files, +1226/−23), review PASS with no issues, all checks green, PR #67 opened. This completes the seat-request UI (SIM-014 .2/.3/.4).
- In progress / next: Ming merges PR #67 and runs the three-rival approve check.
- Gotchas: `src/server/identity/verify.test.ts` leeway test is flaky under load (real clock, 1 s margin); follow-up logged.
