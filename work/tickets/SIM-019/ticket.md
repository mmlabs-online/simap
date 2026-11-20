# SIM-019: Audit-log screen for org admins

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | S |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-010 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | — |
| PR | — |

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
—

## Handoff
