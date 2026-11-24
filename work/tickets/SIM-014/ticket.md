# SIM-014: Seat requests — state machine and write API

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P1 |
| Size | M |
| Areas | api |
| Gate | plan-approval |
| Depends on | SIM-012 |
| Needs Ming | M-32 |
| Attempts | 1 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-24T04:09:55Z |
| PR | https://github.com/mmlabs-online/simap/pull/58 |

## Goal
Slice 1 of 4 of seat requests: the request state machine and the write API (create, approve, reject, cancel). Slices
2–4 are SIM-014.1 (read API and decided badge), SIM-014.2 (Approvals page UI) and SIM-014.3 (request button, My
requests page, nav badge).

## Scope reference
spec REG-01, REG-02; D21, D23, D26. Re-scoped 2026-11-24 by the approved plan (`plan.md`, Split proposal).

## Scope
- `src/lib/requests/*` (types, rules), `src/lib/validate/request.ts`, `src/server/requests/*`, `writeOccupant`
  extracted from `src/server/seats/seats.ts`, `POST /api/requests`, `POST /api/requests/[id]/approve|reject|cancel`,
  two new error codes.

## Out of scope
- Email notifications (D24: none). Any read/list endpoint (SIM-014.1) and any UI (SIM-014.2, SIM-014.3).

## Acceptance criteria
- [ ] A second pending request for the same seat by the same member creates nothing.
- [ ] Approving seats the requester, demotes any primary and rejects all other pending requests for that seat.
- [ ] Requests for occupied or cannot-seat seats are refused.
- [ ] The requester can cancel only their own pending request.
- [ ] Unit tests cover the request state machine.

## Technical notes
- Files: `src/server/requests/*`, `src/app/api/requests/**`, `src/app/(app)/approvals/*`, `src/ui/requests/*`; reference seatMGT `src/lib/actions/requests.ts` + tests.
- Risks / open questions: —

## Test plan
- Unit: state machine.
- Manual: none for this slice (request → approve with two rivals is checked after SIM-014.2).

## Notes / answers from Ming
- 2026-11-24: Plan approved (all defaults, assumptions 1-11; Ming: "duyệt plan SIM-014, chạy luôn"). Ticket re-scoped to slice 1 (state machine and write API); SIM-014.1 (read API), SIM-014.2 (Approvals UI), SIM-014.3 (request button, My requests, badge) filed on the board.

## Handoff

### 2026-11-24 — claude — BLOCKED (plan approval)
- Agent calls: 3, tokens ~183k total (api-platform-engineer×1 inherit 38k, frontend-developer×1 inherit 64k, planner×1 inherit 81k; in/out split not reported)
- Done: Gate set to plan-approval (P1 policy); consults saved (ux skipped: max 2 consultants); plan.md READY as slice 1 of 4 (state machine and write API; no migration, no High path).
- In progress / next: Ming approves (M-32). Then the orchestrator re-scopes this ticket to slice 1 and files SIM-014.1 (read API), SIM-014.2 (Approvals UI), SIM-014.3 (request button, My requests, badge).
- Gotchas: slice 1 changes `src/server/seats/seats.ts` (exports, `writeOccupant`); SIM-013 (PR #57) does not touch seats.ts but both append to `src/lib/api/error.ts` and `src/ui/copy/api.ts` (trivial rebase).

### 2026-11-24 — claude — DONE
- Agent calls: 3 this run (implementer×1 inherit 77k, reviewer×1 inherit 64k, security-ai-generated-code-auditor×1 inherit 55k; in/out split not reported); 6 in total for the ticket (~379k).
- Done: slice 1 (state machine and write API, `writeOccupant` extraction), review PASS on attempt 1, security no 🔴/🟡, PR #58.
- In progress / next: Ming merges PR #58 after the first CI run of `pnpm test:db` (`requests.db.test.ts`) is green. Then SIM-014.1.
- Gotchas: security 🟢1 duplicate-create 500 race (retry once or seat-lock reject/cancel); PR #57 and #58 both append to `src/lib/api/error.ts` and `src/ui/copy/api.ts` — the second to merge needs a rebase.

### 2026-11-24 — claude — REWORK (CI `pnpm test:db` red)
- Done: PR #58 CI `ci` job failed in `db integration tests`: `requests.db.test.ts` 5 of 18 failed (run 45324267204). Review PASS was conditional on this run (R5), so the ticket goes back to REWORK attempt 2.
  - 4 create tests: `Error: orgQuery: SQL must filter org_id = $1` thrown at `src/server/requests/requests.ts:125` (the create insert does not pass the orgQuery guard).
  - 1 approve test (`two rivals: occupant set, primary demoted, …`, test line 159): `23514 devices_primary_owner_is_occupant` ("primary device must be owned by the seat occupant") — the test setup or the approve path places a primary that is not owned by the occupant.
- Next: implementer fixes only these failures; reviewer re-checks.
