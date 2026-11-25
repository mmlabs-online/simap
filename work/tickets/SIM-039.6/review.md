## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0. "All matched files use the correct format."
- `pnpm typecheck`: exit 0. Route types generated, tsc reports no errors.
- `pnpm check:layers`: exit 0. "check-layers: 761 files, no violations"
- `pnpm test`: exit 0. "Test Files 288 passed | 1 skipped (289)", "Tests 2935 passed | 7 skipped (2942)"
- `pnpm build`: exit 0. The route table lists `ƒ /map-items`.
- `pnpm test:db`: not run. The orchestrator waived it because no server or DB code changed: `git diff --stat origin/main...HEAD` shows nothing under `src/server/**`, `src/app/api/**` or `db/**`. CI runs it.
- These results match the impl-log claims (288/1 files, 2935/7 tests).

### Acceptance criteria
- [x] 1 Rename, regroup, show/hide, resize and reset are reachable and show their errors inline. Evidence: `MapItemsView.test.tsx › ready: … aria-labelled Edit buttons, no New`; `MapItemFormDialog.test.tsx › shows the key, name and group limits, a group datalist, the checkbox and two size selects`; `map-items-api.test.ts › patch sends PATCH …`, `› reset sends POST /reset …`, `› 409 item_in_use keeps a valid rooms count …`; `map-items-state.test.ts › mapItemErrorMessage …`, `› settleMapItem …`. Code read: `MapItemFormDialog.tsx` `submit` and `ResetMapItemDialog.tsx` `submit` send every refusal to `EntityFormDialog error` (`role="alert"`, `EntityFormDialog.tsx:89-91`). Form state stays in place on error. The Reset button is `Button`, which defaults to `type="button"` (`Button.tsx:36`), so it does not submit the form.
- [x] 1a Warning and confirm before a resize removes images or sprites; 409 gives the room count. Evidence: `map-item-form.test.ts › a resize with effects needs the confirm`, `› a resize without effects needs no confirm`, `› counts images and sprites that no longer fit (e/w swap) …`; `MapItemFormDialog.test.tsx › a resize with effects shows the warning and the confirm; unchanged size does not`; `map-items-state.test.ts › item_in_use names the room count`.
- [x] 1b Fixed size is read-only with a reason, the chair has no show/hide control, and state is shown as text. Evidence: `MapItemFormDialog.test.tsx › fixed-size item: no selects, read-only size and its reason`, `› chair: no show-in-palette checkbox, the chair note instead`; `map-item-form.test.ts › a fixed-size item never sends w/h; the chair never sends hidden`; the Hidden and Fixed size badges are text (`MapItemsView.tsx`).
- [x] 1c No reorder; groups and items in name order. Evidence: `map-items-state.test.ts › groups by name (diacritics, base sensitivity), items by name then key; hidden and all kinds`; `MapItemsView.test.tsx › ready: group headings in name order …, no New`.
- [x] 2 Non-Admins see no page entry. Evidence: `nav.test.ts › mapItems is admin only`, `› admin sees all items incl. roomEditor` (11), `› rail items keep seatMGT order`; `AppShellView.test.tsx › admin on /rooms/A1: nav landmark, 10 links …`; `MapItemsView.test.tsx › forbidden shows the title and a no-access alert …`; `map-items-state.test.ts › admin true; manager, user, null, undefined false`. Code read: below Admin, `MapItemsPage.tsx` renders the forbidden view and mounts no data hook.
- [x] 3 R6 and audit belong to the merged SIM-039.2 server. This diff changes no server, route or migration file. Checks are green (test:db waived, see above).

### Out-of-plan files
- `src/ui/AppShellView.test.tsx`: accepted. The plan wrongly said this file needs no edit. The test pins the admin nav hrefs, so a correct nav change has to update it (9 -> 10 links, `/map-items` after `/device-types`). The edit only follows the planned change.
- `src/ui/mapItems/test-items.ts`: accepted. It is a 15-line `dto()` fixture used only by the new test files and nothing in production imports it. It is justified in impl-log `Out-of-plan files`.
- No High path is touched.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: the page imports `@/ui` only, UI files import `@/lib/**` and relative `src/ui` paths, and `check:layers` passes. D36: all strings are in `src/ui/copy/mapItems.ts` and `src/ui/copy/shell.ts`. R3: no config. R4: within plan (see out-of-plan files). R5: new logic has tests. R6/R7: no server change.

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `mapItemsCopy.errors.inUse(0)` would read "placed in 0 rooms". `errorOf` accepts `rooms >= 0`. The server should never send 0 with `item_in_use`, but `rooms > 0` would be tighter.
- `ResetMapItemBody` always says "Package sprites are cleared.", even when the item has no sprite set. This is harmless.
- `MapItemsPage` computes the `groups` suggestion list on every render. This is negligible.

### Follow-ups (out of scope)
- Amend the LAY-07 and ticket Scope "reorder" wording to "listed alphabetically (D67 1)" (flagged in the plan).
- A9: hiding a floor item may have no visible effect in the editor's floor tool.
