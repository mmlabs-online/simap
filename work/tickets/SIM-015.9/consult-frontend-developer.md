Consult for SIM-015.9 (frontend). I read the code only, with no edits and no checks run. I did not open plan.md, save-plan.ts or the existing tests. The claim that Save unblocks by itself once the tray is empty is inferred from `savePayload` in editor-state.ts, which calls `planSave`. I did not read `planSave` itself.

## Findings
- **Core ops are ready.** `placeItem`, `placeFromTray` and `resizeRoom` (draft.ts) all return `OpResult`, which is either `{ok:true, draft}` or `{ok:false, code}`. Each runs `checkLayoutRules`, so bounds and overlap are refused for free.
- **Resize refusal.** `resizeRoom` refuses 1–64 violations and any resize that cuts an item off with `layout_out_of_bounds`. The copy "That would leave the room." exists in `roomlayout.ts` (line 60). Items never shift, floors are stretched or clipped, and empty floor zones are dropped.
- **Fixture limit is not enforced in the core.** `placeItem` has no count check. `LAYOUT_LIMITS.fixtures` (2000) is checked only in `validateLayoutSave`. At 2000 fixtures a place succeeds in the draft and Save then says "can't be saved yet". The `LayoutRuleCode` type has no member for this, so you need a new refusal.
- **`placeItem` creates a seat for any seat sprite.** `paletteEntries()` lists seat sprites first, with `kind:"seat"`. Placing one gives `seatId:null` and a `n:<k>` key. `savePayload` then returns `pending_seats`, so Save stays blocked. That is desk-add territory (SIM-015.8).
- **`placeFromTray` is fixed to `desk.single`.** It takes `(draft, seatId, x, y, rotation)`. The tray key is `s:<id>`.
- **Editor state and UI.**
  - `EditorAction` has no place, resize or tool actions.
  - `EditorNotice.done.what` is only moved, rotated, deleted, undone or saved.
  - `applyEdit` takes a `what` and a selection override.
  - `EditorCanvas` has a single click handler and calls `onPick(key|null, shift)`.
  - `EditorInspector` shows the room size as read-only text, and the tray as a plain `<ul>` of codes.
  - The `frozen` guard (read-only or saving) must wrap the new actions too.
- **Armed tool and resize input are UI state.** `LayoutEditor` already holds `zoom` as `useState`, and the armed tool can sit next to it. The reducer handles all draft changes.
- **Accessibility gap.** The click layer is `aria-hidden`, and the Items list is the keyboard path for select. Placement needs a keyboard path too: the tile is the click target, so an armed tool alone is mouse-only.

## Recommendations
1. **Reducer in `src/lib/layout-editor/editor-state.ts`, with pure tests.**
   - Add `{type:"place", sprite, x, y, rotation?}`, `{type:"placeTray", seatId, x, y}` and `{type:"resize", w, h}`.
   - All three are no-ops while `frozen`.
   - Use `applyEdit` and extend `what` with "placed" and "resized".
   - Select the new item after a place. A fixture's key is `f:${draft.nextKey}`, taken before the op. A tray seat's key is `s:${id}`.
   - Put the fixture-limit check in the reducer, or in a thin `placeFixture` wrapper in draft.ts, which is easier to test. Count `items.filter(kind==="fixture")` against `LAYOUT_LIMITS.fixtures`.
   - Add a refused code `"fixture_limit"` to `EditorNotice`, plus copy in `roomlayout.ts` `refused`.
   - Tests are cheap if you build a draft with 2000 fixtures programmatically.
2. **Palette excludes seat sprites.** Filter `paletteEntries()` to `kind==="fixture"` in the UI, or add a helper in palette.ts. Desk add is SIM-015.8, and an armed seat sprite would leave Save blocked with a confusing reason. Group the palette by `group`, with labels reusing `itemName`-style text (`sprite.replaceAll(".", " ")`) from the copy file. Use `aria-pressed` buttons.
3. **Tools.**
   - Armed tool type: `{kind:"fixture", sprite} | {kind:"tray", seatId} | null`, held in `LayoutEditor` `useState`.
   - Esc disarms through a keydown listener in `LayoutEditor` or on the editor root.
   - The canvas gets `tool` and `onPlace(x,y)`. When armed, a click places instead of picking.
   - Disarm after placing a tray seat, since each seat is used once. Keep a fixture armed for repeated placing, but check whether the plan agrees.
   - Clear the tool if the tray seat disappears, for example after undo.
4. **Ghost.** Track the hover tile in the canvas with `canvasTile` and an `onMouseMove` handler. Draw an absolute-positioned div outline sized with `footprintOf(sprite, rotation)`, like the selection outlines. Tint it red when the tile is taken or out of bounds, using a dry-run of `placeItem`. Drawing the real sprite needs atlas painting, so an outline is the cheap option.
5. **Directional fixtures.** Place at rotation 0 and let the existing Rotate button turn them after placing. Adding a rotation picker to the palette would go beyond the ticket.
6. **Keyboard path for placing.**
   - Tray list items become buttons that arm the tray tool.
   - Add a "Place" action for the armed tool, using x/y number inputs or the current selection's tile. Alternatively, place at the first free tile in reading order, then move it with the existing Move buttons.
   - The placement result shows in the status line, which is `role=status`.
7. **Resize.**
   - Two controlled text inputs for w and h in the inspector, with real `<label>`s and `inputMode=numeric`.
   - Commit on an Apply button or Enter, not on every keystroke. Intermediate values like "" or 6 would hit the refusal path.
   - The inline refusal message sits in an element that `aria-describedby` references. Reuse `refused.layout_out_of_bounds`, or add a more specific "That would cut off an item" for resize.
   - Reset the inputs when `draft.w` or `draft.h` change, for example after undo or save.
   - Disable the inputs when read-only or saving.
8. **Save unblock.** There is no extra work here, because `planSave` already stops blocking once the tray is empty. Add a test that moving the last tray seat flips `editorFlags.canSave` to true. Remove or adjust the A5 text only if it still shows with an empty tray.
9. **Tests.** Reducer tests for place, placeTray, resize, the refusal paths, the fixture limit, `frozen`, and undo of each. Static-render tests for the Palette (aria-pressed, no seat entries) and for the inspector with tray buttons and resize inputs. A pure helper for the Esc and tool reducer logic can be tested as a function. Add a round-trip test that `savePayload` includes a newly placed fixture.

## Risks
- Placing a seat sprite from the palette leaves Save permanently blocked, so exclude seats (rec 2).
- A 2000-fixture place succeeds silently unless the new check goes in. Large draft arrays are copied on each edit (`items` is cloned), which is fine at the 2000 cap.
- The tool state and the tray can go out of sync after undo. A stale `seatId` makes `placeFromTray` refuse with `layout_unknown_sprite`, and the message "That item doesn't exist." would be misleading. Clear the tool when the seat is gone.
- Hover ghost and click use `canvasTile` with the clamped zoom. The unclamped `zoom` prop is a different value, so use `effective` as the click handler already does.
- No DOM tests exist, so click, hover and Esc behaviour is covered only by manual testing. Keep the handlers thin and the logic in pure functions.
- The `EditorNotice` type grows. Update `EditorStatusLine` copy for every new `what` and refused code, or TypeScript will flag the missing keys, which is useful.

## Open questions
1. Should a fixture tool stay armed after each place (multi-place), or disarm after one?
2. Should tray seats always be placed as `desk.single` (the core hard-codes it), or should the sprite be selectable? I assume the former, as in SIM-015.2.
3. Is "no seat sprites in the palette" correct until SIM-015.8, or does the ticket intend them to show disabled with a reason?
4. Resize: is a dedicated "would cut off an item" message wanted, or is the generic out-of-bounds copy enough?
5. Keyboard placement of tray seats and fixtures is not in the ticket. Should this slice provide it, or does it wait for SIM-015.10?

Files to touch: `d:\project\simap-game-ui\src\lib\layout-editor\editor-state.ts` and its test, possibly `draft.ts` and `palette.ts`, `d:\project\simap-game-ui\src\ui\roomlayout\LayoutEditor.tsx`, `EditorCanvas.tsx`, `EditorInspector.tsx`, a new `Palette.tsx`, `d:\project\simap-game-ui\src\ui\copy\roomlayout.ts`, and `LayoutEditorViews.test.tsx`.
