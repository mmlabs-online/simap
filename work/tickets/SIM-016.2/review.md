# Review — SIM-016.2

## Attempt 1 — 2026-11-24
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit=0, "All matched files use the correct format." (585 files)
- `pnpm typecheck`: exit=0
- `pnpm check:layers`: exit=0, "check-layers: 531 files, no violations"
- `pnpm test`: exit=0, "Test Files 205 passed (205)", "Tests 2113 passed | 3 skipped (2116)"
- `pnpm build`: exit=0, "Compiled successfully", `/groups` route listed
- `pnpm test:db`: CI-only; no server or SQL change in this diff.

These match the impl-log Attempt 1 numbers.

### Acceptance criteria
- [x] Managers list, create, edit and delete groups and projects; a duplicate name or code shows its message. Evidence:
  `groups-api.test.ts` covers paths, methods, the encoded id, the `groups`/`projects` list keys, `?force=true` only
  when forced, and "409 domain codes resolve to a failed result". `group-form.test.ts` covers create/patch bodies,
  unchanged edits, field messages and Vietnamese diacritics. `GroupsView.test.tsx` covers rows, New/Edit/Delete and
  the aria-labels. `TagFormDialog.tsx` shows `apiErrorMessage(result.code)`, and `src/ui/copy/api.ts` L43-44 has
  the `group_name_taken` and `project_code_taken` texts.
- [x] Deleting a used group or project shows the counts and clears tags only after confirmation. Evidence:
  `delete-flow.test.ts` (deleteStep, impactLines, removeOutcome: `in_use` gives reload, `not_found` gives done) and
  `DeleteDialog.test.tsx` (forced body lists the counts and the cleared-not-deleted note; forced and plain submit
  labels differ; submit is disabled before the impact loads). Code read: in `DeleteDialog.tsx`, `force` is
  `step === "forced"` from the loaded impact, and an `in_use` reply reloads the impact instead of forcing.
- [x] Users do not see the page or the nav entry. Evidence: `nav.test.ts › groups is manager+`,
  `AppShellView.test.tsx › user has no approvals or groups link; manager has them`, `groups-state.test.ts`,
  `GroupsView.test.tsx › forbidden ...`. Code read: `GroupsPage` returns the forbidden view before
  `GroupsLoaded` mounts any data hook.
- [x] Static-render and pure-logic tests (no jsdom) cover the views and dialogs. Evidence: every new UI test uses
  `renderToStaticMarkup` and no jsdom environment is set. `pnpm test` is green.

Not verified by the reviewer: the manual browser runs in AC1 and AC2 (create the duplicate "Nhóm A", then delete a
used group). There is no browser in this environment. The PR should list them for Ming.

### Issues
None.

### Scope
Every changed file is in the plan's file list. No High path is touched. `src/server/**`, `src/app/api/**`,
`src/lib/groups/**`, `src/lib/validate/**`, `src/ui/copy/api.ts` and `src/ui/rooms/**` are unchanged (`codeInput`
is only imported).

### Rules (CLAUDE.md)
No violations found. R1: `src/ui/groups/**` imports only `@/lib/**` and ui modules, and the route imports `@/ui`
(check:layers is green). D36: all copy is in `src/ui/copy/groups.ts` and `shell.ts`. R2, R3, R6 and R7 do not
apply, because there is no server, schema or env change.

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `GroupsPage.tsx` passes an inline `onDone={() => done(dialog.target.kind)}`. `DeleteInner.loadImpact` depends on
  `onDone`, so any re-render of `GroupsLoaded` while the delete dialog is open fetches the impact again. This is
  harmless and is the same as `DeleteRoomDialog`.
- After an `in_use` reply, the dialog silently switches to the forced step. A short "the counts changed" line would
  make this clearer.

### Follow-ups (out of scope)
- The mobile bottom bar now has 9 items for Admins. Check a narrow viewport and file an overflow fix if needed (from
  the impl-log).
