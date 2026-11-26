# SIM-021.1: Record the production flow run and file bugs

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P1 |
| Size | XS |
| Areas | architecture |
| Gate | none |
| Depends on | SIM-021 |
| Needs Ming | M-8 |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

## Goal
After the first production release, the manual flow run is recorded in `work/tickets/SIM-021/flow-run.md` and every failure is filed as a bug (SIM-021 ACs 2 and 3, split off by its plan).

## Scope reference
`work/tickets/SIM-021/plan.md` (A1); `docs/go-live.md` items 11-14; spec "v1 done means".

## Scope
- Fill `flow-run.md` from Ming's run results (Vietnamese is fine), summary with counts and go/no-go.
- File each FAIL with `/bug` (`Found in: v0.1.0 (production)`, S1/S2/S3), put the BUG id back in the row.

## Out of scope
- The release and the run itself (Ming's steps). Fixing the bugs (their own BUG tickets).

## Acceptance criteria
- [ ] The manual flow run is recorded with results and a summary.
- [ ] Every FAIL row has a BUG id; no personal data in the files.

## Test plan
- Manual: none beyond the run (docs only).

## Notes / answers from Ming
- 2026-11-26: Ming asked Claude to run what it can. Claude ran the signed-out automated checks (A1–A10 in `work/tickets/SIM-021/flow-run.md`): all PASS, one transient edge 503 noted. The signed-in F1–F11 run still needs Ming (accounts, Turnstile); send the results per row and Claude records them and files bugs.
- 2026-11-26: created on SIM-021 plan approval (Ming approved the split).

## Handoff
