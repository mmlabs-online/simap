# SIM-016.2: Groups and Projects management page

| Field | Value |
|---|---|
| State | DONE |
| Priority | P2 |
| Size | M |
| Areas | ui |
| Gate | none |
| Depends on | SIM-016 |
| Needs Ming | — |
| Attempts | 0 |
| Created | 2026-11-24 |
| Claimed by | — |
| PR | https://github.com/mmlabs-online/simap/pull/69 |

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

### 2026-11-24 — claude — DONE
- Agent calls: 4, tokens ~264k total (frontend-developer×1 default 43k, planner×1 default 75k, implementer×1 default 89k, reviewer×1 default 56k)
- Done: one slice with generic api/list/dialogs, 30 files +1691/−5, review PASS with no issues, all checks green, PR #69 opened.
- In progress / next: Ming merges PR #69 and checks the narrow-screen bottom bar (9 items for Admins). Then SIM-016.3 (seat tag dialog + deadlock fix), which can reuse `groups-api.ts`.
- Gotchas: none new.
