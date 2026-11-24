# SIM-016.2: Groups and Projects management page

| Field | Value |
|---|---|
| State | IN_PROGRESS |
| Priority | P2 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-016 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | claude@2026-11-24T11:11:20Z |
| PR | — |

## Goal
Managers create, edit and delete groups and projects from a page.

## Scope reference
spec GRP-01, GRP-02; D34, D36. Split out of SIM-016 by its plan (`work/tickets/SIM-016/plan.md` → Split proposal).

## Scope
- `/groups` page with a Groups list and a Projects list; nav entry in `src/lib/nav.ts` with `minTier: "manager"`.
- Create/edit/delete dialogs; delete shows the delete-impact counts and asks before a forced delete (D34).
- `src/ui/groups/*`, copy in `src/ui/copy/groups.ts`. Template: `src/ui/rooms/*`.

## Out of scope
- Seat tagging UI (SIM-016.3). Any server or API change.

## Acceptance criteria
- [ ] Managers list, create, edit and delete groups and projects; duplicate name/code shows its message.
- [ ] Deleting a used group or project shows the counts and clears tags only after confirmation.
- [ ] Users do not see the page or nav entry.
- [ ] Static-render and pure-logic tests (no jsdom) cover the views and dialogs.

## Test plan
- Unit: api client, state; static render of the views.
- Manual: create, rename and delete a used group.

## Notes / answers from Ming
—

## Handoff
