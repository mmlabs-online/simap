# SIM-038: Sync the deploy-simap draft with the deployment repo (Drive secrets)

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | XS |
| Areas | security |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/86 |

## Goal
The simap repo's draft of the deploy workflow matches what runs in `mmlabs-online/deployment` after the Drive-secrets PR, so the draft never drifts from production.

## Scope reference
D61; `docs/requests/deployment-simap-drive.md`; `deploy/deployment-repo/README.md`.

## Scope
- Copy the merged `.github/workflows/deploy-simap.yml` from `mmlabs-online/deployment` into `deploy/deployment-repo/.github/workflows/deploy-simap.yml` (Ming pastes it or gives read access).
- Add the four `SIMAP_*` secret names and the `workflow_dispatch` note to `deploy/deployment-repo/README.md`.

## Out of scope
- Changing the deployment repo itself (done by Ming in another session from the request file).

## Acceptance criteria
- [ ] The draft is byte-identical to the merged deployment-repo file.
- [ ] The README names the four secrets (all-or-none) and says to run `workflow_dispatch` after changing them.

## Technical notes
- Files: `deploy/deployment-repo/**` (High path).
- Risks / open questions: needs the merged file content from the deployment repo.

## Test plan
- Manual: `diff` against the deployment repo file.

## Notes / answers from Ming
- 2026-11-25 (orchestrator): `Needs Ming: M-51` was a wrong reference (M-51 is the SIM-037.1 plan approval). The real blocker, the merged deployment-repo file, is now readable: `mmlabs-online/deployment` was added to the session read-only (main @ 29cb93f, PR #109 merged). Ming asked to run this ticket (2026-11-25).

- 2026-11-25: Plan approved (Ming: "duyệt SIM-038"), assumptions A1-A5 as written.

## Handoff

### 2026-11-25 — claude — BLOCKED
- Agent calls: 1 (planner×1 default 52k; no consult: area security has no consult row)
- Done: plan READY (`plan.md`): copy the merged deploy-simap.yml byte-for-byte, add a README note on the four `SIMAP_*` secrets, and update `scripts/deploy-envfile.test.ts` (A1) because its static check forbids `${{ secrets.`.
- In progress / next: Ming approves the plan (M-56), then implement and review.
- Gotchas: the draft workflow lives in hidden `.github/` (A5); if oxfmt flags the copied YAML, stop instead of reformatting (A2).

### 2026-11-25 — claude — DONE
- Agent calls: 4 (planner×1 default 52k, implementer×1 default 31k, reviewer×1 default 36k, security-ai-generated-code-auditor×1 35k; ~154k total)
- Done: byte copy of deploy-simap.yml from deployment main @ 29cb93f, README secrets note, deploy-envfile tests for the Drive secrets. Review PASS on attempt 1, security no 🔴; PR https://github.com/mmlabs-online/simap/pull/86.
- In progress / next: follow-ups belong in mmlabs-online/deployment (stale envfile comment, migrate gets env_file via x-app, README rotation note), then re-sync this draft.
- Gotchas: production images stay off until a new release with SIM-036.x is deployed (no deploy-simap run since deployment PR #109).
