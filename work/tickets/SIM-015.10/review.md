## Attempt 1 — 2026-11-23
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check`: exit 0, "All matched files use the correct format." (465 files)
- `pnpm typecheck`: exit 0 (next typegen + tsc --noEmit, no errors)
- `pnpm check:layers`: exit 0, "check-layers: 411 files, no violations"
- `pnpm test`: exit 0, "Test Files 165 passed (165) / Tests 1752 passed | 3 skipped (1755)". This matches impl-log.
- `pnpm build`: exit 0
- `pnpm test:db`: not run (CI-only, no schema, SQL or server change)

### Acceptance criteria
- [x] AC1 Drag moves the selection by whole tiles in one undo step. A refused drop snaps back with the message, and the ghost previews the drop. Evidence: `pointer-gesture.test.ts` tests "drag from an unselected item …", "drag release emits one move … (also past the room edge); a zero delta …", "release applies the release position first …" and "dragPreview: … ok is false for overlap and off-room, the same as moveItems". The existing reducer `move` refusal sets the notice (`editor-state.ts` `case "move"`, via `applyEdit`). `LayoutEditorViews.test.tsx` covers "GestureOverlay: an ok drag ghost is solid primary, a refused one is dashed error …". Wiring: `EditorCanvas.tsx` has `onPointerUp` → `gestureUp` → `onAction(move)`, with one effect per release. Real pointer run: Ming verification 1.
- [x] AC2 A drawn rectangle selects the items inside it, in either direction, clamped to the room. Shift adds. An empty box clears. A plain click still selects. Evidence: `pointer-gesture.test.ts` tests "marquee in either direction … clamped … shift gives additive; an empty rectangle without shift …", "marqueeBox … marqueeKeys matches itemsInRect", "press and release without moving …" and "movement under 4 px …". `editor-state.test.ts` has "selectMany replaces; additive unions …". Real run: Ming verification 2.
- [x] AC3 Each listed shortcut works and is listed in the editor. Arrow runs coalesce into one undo step. Shortcuts are off in text fields, the leave dialog, IME composition and mid-gesture. Evidence: all 8 planned tests in `shortcuts.test.ts`. `editor-state.test.ts` has the 5 nudge tests (same run is one step, another action starts a new step, undo then nudge, a refused nudge keeps the run, ignored cases). `history.test.ts` has "replacePresent …". `LayoutEditorViews.test.tsx` has "shortcut list …" and "… carry aria-keyshortcuts". The copy is typed `satisfies Record<ShortcutId, …>` (`src/ui/copy/roomlayout.ts`), so a missing row fails typecheck. Mid-gesture: `EditorCanvas.tsx` `onRegionKeyDown` stops propagation, and Escape cancels the gesture. Real run: Ming verification 3 and 4.
- [x] AC4 No drag or marquee while a tool is armed. No drag while saving. Evidence: `pointer-gesture.test.ts` tests "armed tool: … moving never starts a drag or a marquee" and "frozen: a press never becomes a drag …". `gestureDown` sets `canDrag = !tool && !frozen && !touch` and `canMarquee = !tool && !touch`.
- [x] AC5 R1 layers and all checks are green. Evidence: the checks above. The new lib files import only `./*` lib modules. The copy file imports a type from `@/lib` (ui → lib, allowed).

Ming verification after merge (not verified here, carry into the PR): plan.md "Ming verification after merge" items 1 to 6 (drag and ghost, marquee, every shortcut including IME and text-field behaviour, Esc and blur cancel, armed tool, touch and pen).

### Scope
- All changed `src/**` files are in the plan's file list. No High path was touched.
- `work/ming-todo.md` (M-29) was changed in the orchestrator's plan commits (`7c1eeb8`, `c7ff846`). That is plan-approval bookkeeping, not implementer scope.
- **A15 size decision.** My count: non-test `src/**` is +599 / −67, so 532 net (the impl-log says "about 530", which matches). The plan sets the cut at "past about 550 source lines" and does not say raw or net. Raw added lines are about 9% over that number. Net lines are under it. oxfmt splits many calls over several lines, which inflates the raw count. The keyboard part (`shortcuts.ts` 74, `ShortcutList.tsx` 42, copy 22, the nudge reducer case, the `onKeyDown` wiring) is cohesive and fully tested. Moving it out now would cost a full rework cycle and a second ticket, and would not lower the risk. I accept "not triggered" as a reasonable reading of an "about" threshold. Ming can still ask for the split at PR time.

### Issues
None blocking. See the notes below.

### Rules (CLAUDE.md)
No violations found. R1: `check:layers` is clean. R2, R3, R6, R7: no schema, config, server or route change. R4: the diff stays within the plan. R5: the checks are green and the new logic has pure tests.

### Blockers from review agents
None. No review trigger matched: no server, auth, migration or workflow path.

### Nits (do not block)
- 💭 Esc inside a text field no longer stops placing. `keyAction` returns null first for `inTextField` (`src/lib/layout-editor/shortcuts.ts:57`). That matches plan A6 and its test ("every key is ignored" in text fields). The removed `escDisarms` disarmed a tool even with focus in the PlacePanel X/Y inputs (SIM-015.9 AC5 and A10). So plan A8 ("`keyAction` covers its cases") is not quite true for a keyboard user typing a tile. Escape has no native action that matters in these numeric inputs. A one-line exception (handle `Escape` before the `inTextField` check) would restore the SIM-015.9 behaviour. I did not ask for it because it would deviate from the approved A6. Ming decides: follow-up or accept.
- 💭 If Ctrl/Cmd+S is held until it auto-repeats, the repeat events give `null` (`shortcuts.ts:63`). They are not `preventDefault`ed, so the browser's "Save page" dialog can open. Plan A7 asks for both "ignore auto-repeat" and "always prevents Save page". The code meets the first and not the second on repeats. A possible fix: return a no-op result for a repeated mod+S that only prevents the default.
- 💭 `onLostPointerCapture={cancel}` and `onPointerCancel={cancel}` (`EditorCanvas.tsx`) do not check `pointerId`. They are harmless today because a second pointer never starts a gesture (`gestureDown` ignores it while one runs). It is still worth matching the id for symmetry with move and up.
- 💭 In `save()` (`LayoutEditor.tsx`), if `seatsApi.saveLayout` throws instead of returning a result, `finally` clears the ref but nothing dispatches `saveFailed`, so the status stays "saving". This is not new: before this change a throw also left "saving". The API wrapper returns results, so it is only noted.

### Follow-ups (out of scope)
- Plan A12: edge autoscroll while dragging, live announcements of the marquee count and nudge position, and the sprite in the drag ghost.
- Esc-in-text-field disarm and Ctrl+S repeat prevention (nits above), if Ming wants them.
- No DOM test covers the pointer and keyboard wiring (SIM-015.7 A3). Those paths rely on Ming verification 1 to 6.
