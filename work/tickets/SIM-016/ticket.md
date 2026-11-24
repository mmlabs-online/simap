# SIM-016: Groups, projects and seat tags

| Field | Value |
|---|---|
| State | REVIEW |
| Priority | P2 |
| Size | S |
| Areas | api, ui |
| Gate | none |
| Depends on | SIM-012 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-20 |
| Claimed by | claude@2026-11-24T10:52:20Z |
| PR | — |

## Goal
Managers maintain group and project labels and tag seats with them.

## Scope reference
spec GRP-01, GRP-02, SEA-04; D34 (delete warns, clears tags).

## Scope
Re-scoped by the plan's split (slice 1 = API and logic):
- CRUD API for groups (name, colour) and projects (code, name), unique per org.
- Tag/untag a seat through the API (`PATCH /api/seats/[id]/tags`).
- Delete in use: delete-impact counts; refuse without `force`, clear tags on a forced delete.

## Out of scope
- Reporting by group.
- Groups/Projects management page (SIM-016.2) and the seat-detail tag dialog (SIM-016.3).

## Acceptance criteria
- [ ] Names/codes are unique within the org.
- [ ] Deleting a used group clears it from seats and members after confirmation.
- [ ] Users cannot change tags (403).
- [ ] Unit tests cover delete impact.

## Technical notes
- Files: `src/server/groups/*`, `src/app/api/groups/**`, `src/ui/groups/*`.
- Risks / open questions: —

## Test plan
- Unit: delete impact.
- Manual: tag seats and delete a used group.

## Notes / answers from Ming
—

## Handoff
