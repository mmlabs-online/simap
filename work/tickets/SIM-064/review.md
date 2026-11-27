# Review — SIM-064: Layout editor warning for unreachable chairs

## Attempt 1 — 2026-11-27
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck && pnpm check:layers` — exit 0; "check-layers: 1026 files, no violations"
- `pnpm test` — exit 0; "Test Files 395 passed | 1 skipped (396)", "Tests 3838 passed | 9 skipped (3847)" (matches impl-log)
- `pnpm build` — exit 0
- `pnpm test:db` — run locally against the compose DB (`postgres://simap@127.0.0.1:5432/simap`): exit 0, "Test Files 23 passed (23)", "Tests 373 passed (373)". The implementer skipped this check; no DB code changed.
- Verbose run of the new files: 10/10 passed (8 in `reachability.test.ts`, 2 in `EditorWarnings.test.tsx`).

### Acceptance criteria
- [x] The layout editor warns when a chair cannot be reached from any door. Evidence: `reachability.test.ts › chair walled off is unreachable`, `› chair outside the room is unreachable`, `› unplaced new desk uses key and null code`; `EditorWarnings.test.tsx › shows no-door and unreachable seat codes`; wired at `src/ui/roomlayout/LayoutEditor.tsx:89` (useMemo) and `:192` (render after `EditorStatusLine`).
- [x] It warns when a room with seats has no door. Evidence: `reachability.test.ts › seats but no door sets noDoor`, `› door fully blocked in counts as no door`; copy `src/ui/copy/roomlayout.ts` `editor.warnings.noDoor`; component test checks "no usable door".
- [x] The warning never blocks a save. Evidence: `reachability.test.ts › warned draft still saves` (`noDoor` true, `editorFlags(state).canSave` true, `savePayload(state).ok` true). Code: `warnings` is only passed to `<EditorWarnings>`; `editorFlags`, `savePayload`, `runSave` and the reducer are unchanged.
- [x] Unit tests cover reachability on editor drafts (reachable, unreachable, no door). Evidence: `src/lib/layout-editor/reachability.test.ts` (reachable / unreachable / no door / no seats / blocked door / new desk / chair outside / save).

Ming verification after merge: none (plan). The ticket's manual test (wall off a chair, see the warning, save still works) is covered by the unit and component tests above. It was not clicked through in a browser.

### Issues
None.

### Scope
Changed files: `src/lib/layout-editor/reachability.ts`, `reachability.test.ts`, `src/ui/roomlayout/EditorWarnings.tsx`, `EditorWarnings.test.tsx`, `src/ui/roomlayout/LayoutEditor.tsx`, `src/ui/copy/roomlayout.ts` and the ticket work files. All are in the plan's file list. No High path was touched. Block rules and save validation are unchanged (Out of scope respected). The SIM-061 path module (`walkGrid`, `pathFromDoor`) is reused as is.

### Rules (CLAUDE.md)
No violations found. R1: `src/lib/layout-editor/reachability.ts` imports only lib (`@/lib/sprites/walk-path`, `@/lib/validate/layout`, local); the UI imports lib via `@/`; check:layers is clean. D36: copy is in `src/ui/copy/roomlayout.ts`. R5: new logic has tests.

### Blockers from review agents
None.

### Nits (do not block)
- `src/lib/layout-editor/reachability.ts:22-24`: `pathFromDoor` checks `no_chair` before `no_door`. In a room with no door where every seat's chair falls outside the room or has no frame, the result is `noDoor: false` and those seats are listed as unreachable, not as "no usable door". A warning still shows, so this is only a wording difference. A possible fix: set `noDoor` from `grid.entries.length === 0` directly.
- The component test checks the Vietnamese-diacritic seat code (`Phòng-A-01`), which is good. No other notes.

### Follow-ups (out of scope)
- None.
