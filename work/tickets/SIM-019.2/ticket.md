# SIM-019.2: Audit-log page UI for org admins

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P2 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-019, SIM-006.2, SIM-022 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

## Goal
Org admins browse and filter the audit log on an Audit page; slice B of the approved SIM-019 plan.

## Scope reference
`work/tickets/SIM-019/plan.md` Slice B (approved 2026-11-20, batch 2026-11-20-3). D35 (UTC+7 days), D52 (management screen: conventional style).

## Scope
- Everything listed under Slice B in `work/tickets/SIM-019/plan.md` (Audit page, nav entry for admins, `src/ui/copy/audit.ts`, UTC+7 day-range helper, `history` icon), calling `/api/audit` and `/api/audit/facets` through SIM-006.2's apiFetch.

## Out of scope
- Export (SIM-018).

## Acceptance criteria
- [ ] Slice B acceptance criteria as written in `work/tickets/SIM-019/plan.md`.
- [ ] All loop checks green; copy follows the SIM-022 convention.

## Technical notes
- Split from an approved plan: the planner reuses that plan's slice; re-plan only what changed on `main` since.

## Test plan
- As in the source plan's slice.

## Notes / answers from Ming
- 2026-11-20 (batch 2026-11-20-3): created from Ming's approval ("duyệt hết theo đề xuất").

- Plan approved (2026-11-20, batch 2026-11-20-5): "ok hết" — every assumption takes its default.
- Merge approved (2026-11-20, batch 2026-11-20-5): "ok hết" on the round that asked "cho merge" per Medium ticket.

## Handoff
