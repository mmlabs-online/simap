## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| `src/ui/groups/groups-api.ts` (+ test) | one api factory for groups and projects |
| `src/ui/groups/useList.ts` | generic list loader, two independent lists |
| `src/ui/groups/group-form.ts` (+ test) | pure form logic and diffs |
| `src/ui/groups/delete-flow.ts` (+ test) | deleteStep, impactLines, removeOutcome |
| `src/ui/groups/groups-state.ts` (+ test) | canManageGroups tier gate |
| `src/ui/groups/ListSection.tsx` | generic list section |
| `src/ui/groups/GroupsView.tsx` (+ test) | page body |
| `src/ui/groups/TagFormDialog.tsx` (+ test) | create/edit dialog for both kinds |
| `src/ui/groups/DeleteDialog.tsx` (+ test) | delete dialog with impact counts and forced step |
| `src/ui/groups/GroupsPage.tsx` | page wiring and gate |
| `src/ui/copy/groups.ts` | copy (D36) |
| `src/ui/copy/shell.ts` | nav label and page title typed by NavId |
| `src/lib/nav.ts`, `src/lib/nav.test.ts` | nav entry (manager+) |
| `src/lib/icons.ts` | added `palette`, `sell` (sorted) |
| `src/ui/AppShellView.test.tsx` | nav list changed |
| `src/ui/index.ts` | export GroupsPage |
| `src/app/(app)/groups/page.tsx` | route |

### Tests added / changed
- groups-api.test.ts, group-form.test.ts, delete-flow.test.ts, groups-state.test.ts, GroupsView.test.tsx, TagFormDialog.test.tsx, DeleteDialog.test.tsx (all as listed in the plan, static render, no jsdom)
- nav.test.ts (groups lists, `groups is manager+`), AppShellView.test.tsx (href list, user/manager groups link)

### Checks (actual output summary)
- typecheck: exit=0 (after making `ListState.items` readonly)
- format:check: exit=0 ("All matched files use the correct format")
- check:layers: exit=0 (531 files, no violations)
- test: exit=0 (205 files passed, 2113 passed | 3 skipped)
- build: exit=0 (`/groups` route listed)

### Out-of-plan files
None. No High path touched (icons only edit `src/lib/icons.ts`).

### Follow-ups (noticed, not done)
- Mobile bottom bar now has 9 items for Admins; check a narrow viewport manually.
- No manual browser run was done here (no jsdom, static-render tests only).

### Scope self-check
- Could the diff be smaller? No.
- Diff size: about +1000 lines including tests (source about 750 non-test lines), -3 lines.
