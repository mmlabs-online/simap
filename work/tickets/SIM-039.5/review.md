# Review — SIM-039.5 (slice 1: palette and editor sizes)

## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
Branch `claude/modest-allen-yru4g8` vs `origin/main`.
- `pnpm format:check`: exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers`: exit 0; tsc clean; "check-layers: 741 files, no violations"
- `pnpm test`: exit 0, "Test Files 280 passed | 1 skipped (281); Tests 2881 passed | 7 skipped (2888)"
- `pnpm build`: exit 0
- `pnpm test:db`: not re-run by the reviewer (CI-only check; this ticket changes no server, API or DB code, see AC 3). The implementer's local run had 18 failures in devices/handoffs/members tests (`device_handoffs_decided_check`), which they also saw on the base commit. These are not counted against this ticket. The plan said 9; the count is 18 (follow-up).
- The reviewer's results match impl-log.md.

### Acceptance criteria
- [x] AC 1: the palette shows the Admin's names and groups, sorted by name per D67 (1), with hidden items left out. Evidence:
  - `src/lib/layout-editor/palette.ts` `catalogPalette`: keeps rows with kind seat or fixture and `!hidden`, groups them by the exact group string, and sorts both groups and entries with `localeCompare(…, {sensitivity:"base"})`, then by exact text or key.
  - Tests in `palette.test.ts` › catalogPalette (4 cases: filter, sort independent of input order with Vietnamese names, grouping and empty list, entry fields).
  - `LayoutEditorViews.test.tsx`: "palette renders catalog groups and names …", "palette shows the loading line and the error line with a retry button", "inspector shows the catalog name for a fixture and Desk <code> for a seat".
  - `map-items-api.test.ts`: 4 cases, covering list, non-array body, error code, and ApiAccessError or fetch throw.
  - Wiring: `LayoutEditorPage.tsx` calls `useMapItems`, which feeds `LayoutEditor.tsx` (`catalogPalette`, the `names` map, and the `catalog` dispatch), which feeds `Palette.tsx` (heading is `g.group`, label is `e.name`, plus the status line and retry).
  - All tests pass.
  - The planned manual check (PATCH plus a browser reload) was not run here. It needs Identity and a DB. The unit and view tests cover the behaviour, and the check is part of Ming's verification after merge.
- [x] AC 1a: the editor ghost, hit areas, place/move/rotate refusals and the Save pre-check all use catalog sizes. Evidence:
  - `tiles.ts`, `place-tool.ts`, `pointer-gesture.ts`, `draft.ts` and `save-run.ts` take a defaulted `lookup` and get sizes through `footprintAt`, the same function the validator uses.
  - `editor-state.ts` `editorFootprints` puts layout rows last, so they win over palette rows. It passes `state.footprints` to every op and to `validateLayoutSave` in `savePayload`.
  - `LayoutEditor.tsx` passes `footprints` to `EditorCanvas` and `runSave`.
  - Tests ("catalog lookup" / "catalog sizes" / "runSave footprints"):
    - `tiles.test.ts`: 3, including registry parity without a lookup
    - `place-tool.test.ts`: 1
    - `pointer-gesture.test.ts`: 1
    - `draft.test.ts`: 2
    - `editor-state.test.ts`: 2
    - `save-run.test.ts`: 1 (no PUT is sent)
  - All tests pass. This closes 039.3 A8.
- [x] AC 3: org scoping (R6), audit and checks. `git diff --name-only origin/main...HEAD` lists nothing under `src/server/`, `src/app/api/` or `db/`. The only new request is `GET /api/map-items` (039.1, org-scoped). Checks are green as listed above. The test:db result is recorded in impl-log, and its failures are pre-existing (see Checks).
- AC 2 (art) is out of this slice. It moves to SIM-039.8, as approved by Ming in M-71.

#### Ming verification after merge (for the PR)
- On the deployed app, as an Admin: rename, regroup and hide one item through the API (or the 039.6 page), open a room editor, and check the palette: Admin group headings and names, groups and entries in name order, no hidden item.
- As a Manager, open the room map: nothing changes in slice 1.

### Scope
- Changed product and test files: all of them are on the plan's file list.
- Also changed:
  - `work/ming-todo.md`: M-71, the plan approval record.
  - `work/tickets/SIM-039.5/*`: workflow files.

  These are orchestrator bookkeeping, not product changes. `work/backlog.md` is unchanged.
- No High path was touched.

### Issues
None.

### Rules (CLAUDE.md)
No violations found.
- R1: the new code is in `src/lib/**` (pure) and `src/ui/**`. `src/ui/mapItems/map-items-api.ts` goes through `apiFetch`, and nothing imports `src/server`. `pnpm check:layers` reports no violations.
- R2, R3, R6, R7: no schema, config, query or route change.
- R4: everything in the diff is in the plan.
- R5: new logic has tests, and the checks are green.
- D36: the copy is in `src/ui/copy/roomlayout.ts`.

### Blockers from review agents
None.

### Nits (do not block)
- `src/ui/roomlayout/LayoutEditor.tsx:58-61`: the `names` map is built from the `view.items` prop, not `state.layoutItems`. After an in-place `saveDone`, the names come from the first view until the next remount. There is no visible effect today, because new placements can only come from the palette and the palette supplies their names.
- `src/ui/mapItems/useMapItems.ts:14`: the `enabled` parameter is never passed. It is always the default `true`.

### Follow-ups (out of scope)
- test:db: 18 pre-existing failures in devices/handoffs/members (`device_handoffs_decided_check`) on the base commit. The plan and 039.4 A11 say 9. These need their own bug ticket.
- Update the spec LAY-03 "in the Admin's order" text to the D67 (1) name order (plan A7).
- Slice 2 (art rendering, custom images, placeholder) stays in SIM-039.8.
