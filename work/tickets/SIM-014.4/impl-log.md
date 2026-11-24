## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| src/ui/requests/requests-api.ts | `readDto`, `approve`, `reject` (plan: API) |
| src/ui/requests/requests-state.ts | `occupantHintId` (shared id for occupant line and aria-describedby) |
| src/ui/requests/requests-flow.ts (new) | `settleDecision`, `rivalNames` |
| src/ui/copy/requests.ts | `decision` copy block (D36) |
| src/ui/requests/DecisionDialog.tsx (new) | confirm dialog |
| src/ui/requests/RequestRowActions.tsx (new) | row Approve/Reject buttons |
| src/ui/requests/ApprovalsView.tsx | `notice`, `headingRef`, h1 tabindex, occupant line id |
| src/ui/requests/ApprovalsPage.tsx | state, decision flow, dialog wiring, focus + reload |
| src/ui/requests/requests-api.test.ts | approve/reject tests |
| src/ui/requests/requests-flow.test.ts (new) | settleDecision, rivalNames tests |
| src/ui/requests/DecisionDialog.test.tsx (new) | dialog static render tests |
| src/ui/requests/RequestRowActions.test.tsx (new) | row button tests |
| src/ui/requests/ApprovalsView.test.tsx | notice, tabindex, hint id, actions slot tests |

### Tests added / changed
- All tests listed in plan "Tests to write" (api x2, flow x7, dialog x6, row actions x4, view x4). Static render only, no jsdom.

### Checks (actual output summary)
- typecheck: exit=0 (`next typegen && tsc --noEmit`); check:layers exit=0 (495 files, no violations)
- format:check: exit=0 ("All matched files use the correct format")
- test: exit=0 (Test Files 194 passed; Tests 2038 passed, 3 skipped). A first full run had one failure in src/server/identity/verify.test.ts (time-based leeway test, unrelated file); it passed in isolation and in the second full run (looks flaky under load).
- build: exit=0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Plan said to export `AUTH_CODES` from requests-state.ts; `settleDecision` does not need it (any non-refusal, non-not_found code means no reload), so it was left unexported.
- Possible flaky `verify.test.ts` leeway test under parallel load.
- Plan follow-ups: `rivalCount` on the list DTO, `submittingLabel` on EntityFormDialog, destructive Reject style.

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +330 source / +330 test lines.
