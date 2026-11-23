## Attempt 1 — 2026-11-23
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (459 files)
- `pnpm typecheck && pnpm check:layers`: exit 0, "check-layers: 405 files, no violations"
- `pnpm test`: exit 0, "Test Files 163 passed (163); Tests 1719 passed | 3 skipped (1722)" (matches impl-log)
- `pnpm build`: exit 0, `ƒ /rooms/[roomCode]/edit` listed
- `pnpm test:db`: not run (CI-only, no Postgres here). The diff has no SQL, migration or `src/server/**` change.

### Acceptance criteria
Plan verification table:
- [x] 1 Fixture place from the palette goes into the save payload, survives the save round trip and is selected. Evidence: `editor-state.test.ts` › "place with a fixture tool commits one step, selects the new f: key, keeps the tool armed, notice placed" and "a placed fixture is in savePayload and passes validateLayoutSave; saveDone with that view keeps it and is clean"; `place-tool.test.ts` › "tryPlace fixture: …" (key `f:1`, overlap and out-of-bounds codes, seat sprite refused). Real reload: Ming verification 1.
- [x] 2 Tray seat placing, tool advance/disarm, Save enabled once the tray is empty. Evidence: `editor-state.test.ts` › "tray tool advances to the next tray seat, then disarms", "placing the last tray seat empties the tray: canSave true, saveBlock null, savePayload has the seat at its tile" (checks `saveBlock` is "unplaced" before, null after); `LayoutEditorViews.test.tsx` › "inspector tray rows are Place buttons named with the seat code (Phòng-A-03) …".
- [x] 3 Resize commits one step and saves w/h; same size is a no-op; cut-off refused as `resize_cut` with the inline message (`aria-describedby="size-refused"`); out of 1–64 refused; bad input parsed out. Evidence: `editor-state.test.ts` › three "resize …" tests; `place-tool.test.ts` › "parseWhole …", "parseRoomSize accepts 1 and 64; rejects 0, 65, empty and non-integers"; `LayoutEditorViews.test.tsx` › "room size form shows labelled W and H inputs …". Code: `editor-state.ts` `resize` case maps an in-range refusal to `resize_cut` (`resizeRoom` refuses in range only through `checked`, and since items never shift, only a cut-off item can cause it).
- [x] 4 Fixture limit refused at place time, allowed at limit − 1, no undo step. Evidence: `place-tool.test.ts` › "tryPlace refuses fixture_limit at LAYOUT_LIMITS.fixtures, allows at limit − 1"; `editor-state.test.ts` › "place at the fixture limit sets the fixture_limit notice and adds no step" (2000 fixtures on a 64×64 room, `history.past` length 0).
- [x] 5 Palette is fixtures only, grouped with headings, `aria-pressed`; re-arm disarms; Esc disarms; arm clears the selection; armed click places; ghost tinted and dashed when refused. Evidence: `palette.test.ts` › "fixturePalette has no seat entries …"; `LayoutEditorViews.test.tsx` › "palette renders a heading per group …", "every FIXTURE_GROUPS entry has a palette heading in the copy", "place panel shows …"; `editor-state.test.ts` › "arm sets the tool and clears the selection; …"; `place-tool.test.ts` › "placementPreview …", "escDisarms …". Wiring read in code: `EditorCanvas.tsx` `onClick` calls `onPlace` while `tool` is set; ghost uses the same `(x*TILE - bounds.x)*effective` formula as the selection outlines; `LayoutEditor.tsx` root `onKeyDown` uses `escDisarms` with `guard.pending`. The real click, hover and Esc behaviour is Ming verification 2 (no DOM env, A3).
- [x] 6 Place, arm and resize ignored while saving or read-only; undo restores; stale tray tool cleared. Evidence: `editor-state.test.ts` › "place, arm and resize are ignored while saving" (also read-only arm), "undo of a place and of a resize; a tray tool whose seat is no longer in the tray is cleared", "saveDone clears the tool".
- [x] 7 R1 layers and all checks green. Evidence: the checks above.

Ming verification after merge (not verified here, carry to the PR): items 1–6 of plan.md "Ming verification after merge" (fixture place + rotate + reload; ghost/taken/Esc/Done placing/toggle; tray placing unblocks Save and survives reload; keyboard-only place panel; shrink refused / allowed shrink saves, undo restores; optional 2000-fixture limit on the dev DB).

### Scope
Every changed source file is in the plan's file list. `EditorViews.tsx` (listed) needed no change, as impl-log notes. Work files: `ming-todo.md` (M-28, plan approval record), ticket, plan, consults, impl-log. No High path changed. Source size is about 485 lines, under the A13 limit of 550.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: `place-tool.ts` and `palette.ts` import only `@/lib/**` and local lib files; the UI imports ui and lib (`check:layers` clean). D36: all new copy is in `src/ui/copy/roomlayout.ts`. R5: new logic has unit and static-render tests. R2/R3/R6/R7: no schema, config, server or route change.

### Blockers from review agents
None (no review trigger path changed).

### Nits (do not block)
- `src/ui/roomlayout/Palette.tsx` `PlacePanel`: the X/Y inputs are not `disabled` while frozen (only the Place button is). The reducer ignores the place anyway, so it is cosmetic.
- `PlacePanel` keeps its X/Y text and `bad` flag across tool changes, because it stays mounted and only returns null. A `key` on the tool in `LayoutEditor.tsx` would reset it, as `RoomSizeForm` does with its size key.
- `src/ui/roomlayout/EditorInspector.tsx` now uses `useState` but has no `"use client"`. It works because only the client `LayoutEditor` imports it; adding the directive would make that explicit.
- `LayoutEditorViews.test.tsx` imports `@/lib/...` after `../copy/roomlayout`. The import order differs from the other files (oxfmt does not flag it).

### Follow-ups (out of scope)
- Name the item that blocks a shrink in the `resize_cut` message (UX consult Rec 7; plan left it out).
- Hover ghost, click-to-place and Esc wiring have no automated test until a DOM test env exists (SIM-015.7 A3).
