
## Attempt 1

Files touched: everything in plan.md's file list (new: my-requests.ts(+test), SegmentedFilter(+test), SeatCard(+test), MyRequestRow(+test), MyRequestsPanel(+test); modified: globals.css, icons.ts, Chip.tsx, PageHeader.tsx, layout-blocks.test.tsx, index.ts, MySeatView(+test), MySeatTab(+test), copy/portal.ts; deleted: MyRequestsView(+test)). Each is required as the plan's table states.

Adaptations to the merged SIM-066 blocks (additive):
- `SectionCard` body padding cannot be zeroed, so the request list sits in a `-m-4 sm:-m-5` wrapper (as the plan allowed).
- `Pill` success tone switched from tertiary (blue) to the new success tokens; the SIM-066 assertion in layout-blocks.test.tsx was updated; the Live preview pill turns green (Assumption 8).
- `PageHeader.titleAdornment` wraps heading and adornment in a flex row.
- `MySeatView`: noSeat line now renders inside the "Your assigned seats" section (header with count 0).

Tests added: see plan; all listed cases written.

Checks: format:check OK; typecheck exit 0; check:layers "977 files, no violations"; test "Test Files 371 passed | 1 skipped, Tests 3594 passed | 7 skipped"; build exit 0.

Out-of-plan files: none. Follow-ups: per plan (unused shellCopy.pages.myRequests, API status filter, auto-load on empty filter).

Scope self-check: only plan files changed; MySeatTab diff is the import and the requests prop only.
