# SIM-011: Members page, profile fields and deactivation

| Field | Value |
|---|---|
| State | DONE |
| Priority | P1 |
| Size | M |
| Areas | api, ui, security |
| Gate | plan-approval |
| Depends on | SIM-007 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/36 |

## Goal
Managers see the org's members and their footprint, edit simap fields, and deactivate or reactivate members without touching Identity accounts.

## Scope reference
spec MEM-01, MEM-02; D12, D16 (a), D17, D34.

## Scope
- Members list (search, bounded pages) with seats and devices per member; pending invitations section (from SIM-009 data if present).
- Manager+ edits display name, employee code (unique per org), group.
- Deactivate / reactivate (Manager+): feeds the SIM-005 deny list; warns with counts and offers to release seats and return devices in the same step.
- No delete action; text says accounts are managed in mmlabs.

## Out of scope
- Removing from the org and syncing from Identity (SIM-020).

## Acceptance criteria
- [ ] A deactivated member's next API call to org data is refused; reactivation restores access.
- [ ] Deactivating a member with seats/devices shows the counts and, on confirm, releases them in one transaction with DEV-06 demotion.
- [ ] Employee code is unique within the org.
- [ ] Users see the list read-only; Managers see edit actions.
- [ ] Unit tests cover the deactivation impact and validation.

## Technical notes
- Files: `src/server/members/*`, `src/app/api/members/**`, `src/app/(app)/members/*`, `src/ui/members/*`; reference seatMGT `src/lib/actions/members.ts`, `MemberCard.tsx`.
- Risks / open questions: Deny list must be checked per request (no caching beyond the request).

## Test plan
- Unit: impact calculation, validation.
- Manual: deactivate a member who holds a seat.

## Notes / answers from Ming
—

Waiting for Ming: plan approval (High tier)
- 2026-11-22 Plan approved (Ming, in the /run session; covers assumptions A1–A11 and the split into SIM-011 + SIM-011.2).

## Handoff

### 2026-11-22 — claude — BLOCKED
- Agent calls: 3, tokens ~211k total (api-platform-engineer×1 opus 58.6k, frontend-developer×1 opus 58.6k, planner×1 opus 93.8k; per-call in/out split not reported)
- Done: consult (api, ui; security skipped by Max consultants = 2), plan READY. The plan edits `src/server/http/with-auth.ts` and its test (High path `src/server/http/**`), so Gate was raised from `none` to `plan-approval`.
- In progress / next: Ming approves `plan.md` (M-22: assumptions A1–A11, split into SIM-011 server slice + SIM-011.2 Members page UI). After approval, `/run SIM-011` resumes at IMPLEMENT; SIM-011.2 gets added to the board then.
- Gotchas: A9 changes the lock order (member row before room/seats); SIM-012/SIM-014 must follow it. Local Postgres 16 runs as a system service here (no Docker); role/db `simap` created for `pnpm test:db`.

### 2026-11-22 — claude — DONE
- Agent calls: 3 this run, ~228k tokens (implementer×1 opus 105.9k, reviewer×1 opus 66.3k, security-ai-generated-code-auditor×1 opus 56.4k; per-call in/out split not reported). Whole ticket: 6 calls, ~440k.
- Done: plan approved (M-22); attempt 1 implemented; review PASS with all checks green (incl. `pnpm test:db` locally); security review has no 🔴. PR https://github.com/mmlabs-online/simap/pull/36.
- In progress / next: Ming reviews and merges PR #36 and decides on security 🟡1 (A4). Then SIM-011.2 (Members page UI) is runnable.
- Gotchas: every guarded route now needs the DB (503 without it). SIM-012/SIM-014 must lock the member row first (A9). Worked on the session branch `claude/confident-cerf-67q5le`, not `ticket/SIM-011`.

