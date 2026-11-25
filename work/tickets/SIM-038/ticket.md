# SIM-038: Sync the deploy-simap draft with the deployment repo (Drive secrets)

| Field | Value |
|---|---|
| State | PLANNING |
| Priority | P2 |
| Size | XS |
| Areas | security |
| Gate | plan-approval |
| Depends on | — |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-25 |
| Claimed by | claude@2026-11-25T04:11:29Z |
| PR | — |

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

## Handoff
