# SIM-019: Audit-log screen for org admins

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | S |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-010 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | pending — Ming opens it from the prefilled compare link (main...ticket/SIM-019) |

## Goal
Org admins can look up who changed what and when.

## Scope reference
spec SYS-03; D28.

## Scope
- `GET /api/audit` (Admin): newest first, filter by actor, entity type, date range, bounded pages.
- Audit page with actor display names.

## Out of scope
- Export of the audit log.

## Acceptance criteria
- [ ] Only Admins can open the page and the route (403 otherwise).
- [ ] Filters combine and paginate correctly.
- [ ] Rows show only the caller's org.
- [ ] Unit tests cover filter parsing.

## Technical notes
- Files: `src/server/audit/*`, `src/app/api/audit/*`, `src/app/(app)/audit/*`.
- Risks / open questions: —

## Test plan
- Unit: filter parsing.
- Manual: check entries after a few changes.

## Notes / answers from Ming
- Plan approved (2026-11-20, batch 2026-11-20-3) — Ming: "duyệt hết theo đề xuất" (every proposal in the batch round accepted). Split: this ticket = Slice A (API); Slice B → SIM-019.2 (Audit page).

## Handoff

### 2026-11-20 — claude — DONE
- Agent calls: 4, ~305k tokens (planner×1 sonnet 84k, implementer×1 58k, reviewer×1 n/a, security auditor×1 79k)
- Done: Slice A audit API (/api/audit with filters + keyset cursor, /api/audit/facets); review PASS attempt 1 (one should-fix: impossible cursor date → 500); security 0 🔴 / 0 🟡
- In progress / next: Ming decides on the cursor fix (default before merge), opens + merges; SIM-019.2 after SIM-006.2
- Gotchas: real-DB behaviour pending (SIM-026 follow-up)
