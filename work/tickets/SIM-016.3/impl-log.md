## Attempt 1 — 2026-11-24

### Files touched
| File | Required because |
|---|---|
| src/server/seats/seats.ts | setSeatTags locks group/project only when the id changes (deadlock fix) |
| src/server/groups/groups.ts | deleteGroup comment corrected (no "cannot deadlock" claim). deleteProject comment had no such claim, left as is |
| src/server/groups/groups.db.test.ts | ordering test (group and project) and "different group still checked" test |
| src/ui/seats/seat-tags.ts, seat-tags.test.ts (new) | pure logic: initialSelection, tagsPatch, tagOptions, ListLoader type |
| src/ui/seats/SeatTagsDialog.tsx, .test.tsx (new) | tags dialog (loader type lives in seat-tags.ts because no-literals.test.ts mis-reads `Promise<` in .tsx as JSX text) |
| src/ui/seats/seats-api.ts, seats-api.test.ts | setTags PATCH |
| src/ui/seats/seat-actions.ts, seat-actions.test.ts | setTags action, `tags` button rule, TagsDialog type, outcome |
| src/ui/seats/SeatActions.tsx, SeatActions.test.tsx | Tags button (onTags) |
| src/ui/seats/useSeatActions.ts | requestTags, setTags, confirm early return |
| src/ui/seats/SeatsPage.tsx | groups api, onTags, dialog wiring |
| src/ui/copy/seats.ts | Tags copy (D36); `tagsUnchanged` from the plan not needed (unchanged submit just closes) |

### Tests added / changed
- groups.db.test.ts › tag write with unchanged group / project does not wait on a forced delete's lock. Written first: it FAILED before the server fix (blocked, 3 s timeout, 2 failed), and passes after.
- groups.db.test.ts › changing to a different group still checks it
- seat-tags.test.ts (tagsPatch, tagOptions); seat-actions.test.ts (tags matrix, setTags outcomes); seats-api.test.ts › setTags; SeatActions.test.tsx › Tags button; SeatTagsDialog.test.tsx

### Checks (actual output summary)
- format:check: exit 0, all files formatted
- typecheck: exit 0
- check:layers: exit 0, 535 files, no violations
- test: exit 0, 207 files passed, 2124 passed | 3 skipped
- build: exit 0
- test:db: exit 0, 10 files, 136 tests passed

### Out-of-plan files
None. GET /api/groups and /api/projects are tier "user" (confirmed in route.ts), so a Manager can load the lists.

### Follow-ups (noticed, not done)
- The SIM-012 assign vs delete race can still deadlock (500 on one side); comment now says so.
- While lists load or fail, the submit stays enabled but the selects are disabled, so a submit just closes (no change).

### Scope self-check
- Could the diff be smaller? No
- Diff size: about +480 / -10 lines including tests
