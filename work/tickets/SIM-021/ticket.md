# SIM-021: Go-live checklist and first production deploy

| Field | Value |
|---|---|
| State | MERGED |
| Priority | P1 |
| Size | S |
| Areas | architecture, security |
| Gate | plan-approval |
| Depends on | SIM-004, SIM-009, SIM-015.2, SIM-016, SIM-017, SIM-018, SIM-019.2, SIM-027 |
| Needs Ming | M-1, M-2, M-3 |
| Attempts | 2 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | #115 |

## Goal
simap runs in production at `simap.mmlabs.online` with a first org, and seatMGT's main flows are checked by hand.

## Scope reference
spec "v1 done means"; D6, D8.

## Scope
- Checklist in `docs/go-live.md`: Identity app settings, tunnel, DB, first release, first org and admin.
- Manual run of seatMGT's flows (sign in, manager assigns, devices, request flow, layout designer) on production; findings become BUG tickets.

## Out of scope
- The release itself (Ming's step).

## Acceptance criteria
- [x] The checklist exists and every item has an owner.
- [ ] The manual flow run is recorded with results.
- [ ] Bugs found are filed with `/bug`.

## Technical notes
- Files: `docs/go-live.md`, `work/ming-todo.md`.
- Risks / open questions: Light unit tests only (D2): integration bugs show up here.

## Test plan
- Unit: none.
- Manual: the flow run itself.

## Notes / answers from Ming
- 2026-11-25: M-1, M-2, M-3 done (Ming). Gate set to plan-approval (P1 policy `high-paths+P1`).
- 2026-11-26: Plan approved by Ming (all 7 gate questions take their defaults; A1-A10 as written). Earlier note (M-78): On approval the orchestrator creates SIM-021.1 (flow run + bugs).

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 2 (software-architect×1 70k, planner×1; default models)
- Done: plan READY. This PR ships `docs/go-live.md` (items 0-14, owners, checks, rollback), `flow-run.md` template (~60 rows from spec IDs) and ming-todo M-77; ACs 2-3 (flow run, bugs) move to new SIM-021.1 after the first release.
- In progress / next: Ming approves A1-A10 and the 7 gate questions (M-78); then create SIM-021.1, implement, review (+ security area).
- Gotchas: Turnstile comment in `src/lib/identity/config.ts` is High path — separate ticket if Ming wants simap's own widget.

### 2026-11-26 — claude — DONE
- Agent calls: 7 since approval (implementer×3: 44k, 51k, 32k; reviewer×3: 78k, 75k, 40k; security-ai-generated-code-auditor×1 50k; default models).
- Done: `docs/go-live.md` (items 0-14 with owner/check, rollback incl. restore-failed, guarded first-release recreate, lockout recovery SQL in a transaction), `flow-run.md` (74 rows F1-F11 incl. org isolation both ways), ming-todo M-77. Review: attempt 1 REWORK (F6 order, citations), attempt 2 REWORK (F6.14/F6.18 preconditions, CONNECT filter, recreate path), attempt 3 PASS. Security 🟡 items 5-8 applied in attempt 2. AC1 met; ACs 2-3 (flow run, bugs) moved to SIM-021.1 per the approved plan.
- In progress / next: Ming merges, runs `docs/go-live.md` (M-77) incl. release 0.1.0 (M-8), then the flow run; then `/run SIM-021.1`.
- Gotchas: spec contradiction DEV-01 last bullet + D31 vs D63 (placed devices always have an owner) — needs a spec clean-up; stale Turnstile comment in `src/lib/identity/config.ts` (High path) — separate ticket if wanted; remove test accounts' `simap:*` roles after the run.
