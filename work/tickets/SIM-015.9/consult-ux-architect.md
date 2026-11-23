**Consult: SIM-015.9 palette, tray placement and room resize (UX and architecture)**

## Findings
- **Core is ready.** `placeItem`, `placeFromTray` and `resizeRoom` in `src/lib/layout-editor/draft.ts` run `checkLayoutRules` and return an `OpResult`. A refusal leaves the draft unchanged.
- **Reducer.** `editor-state.ts` has no `place`, `placeFromTray` or `resize` actions. `applyEdit` only accepts the `what` values moved, rotated and deleted. `EditorNotice` and the `done` copy need new entries for placed and resized.
- **No fixture-limit check.** `placeItem` doesn't check `LAYOUT_LIMITS.fixtures` (2000). That check is a required scope item, and `LayoutRuleCode` has no code for it.
- **`paletteEntries()` lists `desk.single` first.**
  - `placeItem` with a seat sprite makes an `n:` key item. `savePayload` then returns `pending_seats`, and the UI shows the generic "can't be saved yet" text.
  - Desk add is SIM-015.8, so the palette must be fixtures only for now.
- **Tray placement is fixed.** `placeFromTray` always uses `desk.single` at rotation 0. That is fine, and the user rotates afterwards.
- **Click and tray flow.**
  - `EditorCanvas` has a single click layer that is `aria-hidden`. It only calls `onPick`, and the Items list is the keyboard path.
  - The tray in `EditorInspector` is a plain `<ul>` with no controls.
  - The room size is a read-only line.
- **Save gating.** `saveBlock.unplaced` already clears itself when the tray is empty, so A5 needs no change there.
- **Copy.** `itemName` for fixtures is `sprite.replaceAll(".", " ")`, for example "plant small". That is usable as a palette label, but there are no group headings yet.

## Recommendations
1. **Tool state.** Keep it in `LayoutEditor` (or an extended `EditorState` for the testable parts) as `tool: null | {kind:"fixture", sprite} | {kind:"tray", seatId}`.
   - Arming a tool clears the selection. Selecting an item, Esc, Undo, Save or a refused placement does not clear the tool.
   - Esc disarms through a keydown listener on the editor wrapper. It does nothing while a dialog is open and must not collide with the `LeaveDialog`.
   - While a tool is armed, the canvas click places and does not select. The tool stays armed after a placement, so the user can stamp repeatedly. Disarm explicitly with Esc or a "Done placing" button.
2. **Palette layout.** Put it in a left column or at the top of the aside, above the Selection section.
   - Fixture entries only.
   - Group them with `<h3>` plus `<ul>` per `group`, in the order `paletteEntries` returns.
   - Each entry is a `<button aria-pressed>` with the name text. Sprite thumbnails from the atlas are optional and `aria-hidden`.
   - Toggling the same button disarms it.
   - Show an "Armed: plant small. Click a tile to place, Esc to cancel." line with `role="status"`.
   - Collapse groups only if the list is long. Sixteen groups make a long list, so give the palette its own `max-h` scroll area, like the Items list.
3. **Tray as the second tool source.** Make each tray row a button ("Place D-12"). Clicking it arms `{tray, seatId}`.
   - Disable it when the editor is disabled. After a successful placement, auto-arm the next tray seat, or disarm if the tray is empty.
   - Keep the "Seats not placed" heading and its count.
4. **Hover ghost.** Add `onMouseMove` and `onMouseLeave` on the click layer. Convert with `canvasTile`, then draw one translucent div at the tile.
   - Use `footprintOf(sprite, 0)` for the size, and use `pointer-events-none`.
   - Tint the ghost with the primary colour if a dry run of the op is OK, otherwise with the error colour. Compute the dry run with the pure `placeItem` and `placeFromTray`, and memoise it per tile.
   - Don't draw the sprite itself in the first slice. A bordered, tinted box is enough. Add `cursor-crosshair` while armed.
   - Do not rely on the ghost for a11y.
5. **Keyboard and a11y path for placing.** The canvas is `aria-hidden`, so a placement needs a non-pointer route.
   - Add an "Add at tile" block shown while a tool is armed: X and Y number inputs (default 0, 0, with min 0 and max w-1 or h-1) and a "Place" button.
   - A refusal goes to the same `role="status"` line.
   - This is the same trade-off 015.7 made for move (buttons, not drag). Arrow-key ghost navigation can wait for SIM-015.10.
   - Announce results with a polite live region. `EditorStatusLine` already exists, so add the `done.placed` and `done.resized` copy.
6. **Fixture limit.**
   - Add the check in the draft op (`placeItem`, fixture branch: refuse when fixture items are at or above `LAYOUT_LIMITS.fixtures`) so it is unit-testable.
   - Extend `EditorNotice.refused.code` with `"fixture_limit"`, like `seat_delete`, and add copy such as "This room already has the most fixtures it can hold (2000)."
   - The palette buttons are not disabled at the limit. Refuse at place time per the acceptance criterion, and optionally show the count.
7. **Room resize.**
   - Replace the read-only line with a small form: two `<label>`ed number inputs (min 1, max 64, step 1, `inputMode="numeric"`) and an "Apply size" button. Don't resize on every keystroke.
   - Keep the input values as local strings, and reset them to `draft.w` and `draft.h` when the draft changes (undo, save).
   - Parse them strictly: empty or non-integer values show "Enter a whole number from 1 to 64." without calling the op.
   - On `layout_out_of_bounds`, show an inline message near the inputs with `aria-live`, not only in the top status line. Reuse the refused text but add a size-specific variant, for example "Some items would fall outside a smaller room. Move or delete them first." Say what blocks it if cheap, such as the first item that would be cut off. `refused.layout_out_of_bounds` ("That would leave the room.") alone is too vague for a resize.
   - A no-change submit (same w and h) should do nothing. A successful resize commits a history entry, so Undo works.
8. **Disabled states.**
   - Everything is disabled when `readOnly` or saving.
   - The palette stays visible but disabled when read-only, and arming is blocked.
9. **Tests (R5).**
   - Reducer tests: place, tray place (the tray becomes empty and `canSave` flips), resize ok and refused, fixture limit, and the tool state transitions (Esc, arming clears the selection).
   - Static-render tests for the palette (groups, `aria-pressed`), the tray buttons and the size form.
   - A test that no `desk.single` entry appears in the palette.

## Risks
- A refused placement while armed could silently do nothing. Always set a notice.
- A document-level Esc listener can collide with the dialog or an input. Scope it to the editor wrapper and ignore `defaultPrevented`.
- Each ghost move re-runs `checkLayoutRules` over up to 2000 items. Memoise per tile and only compute when the tile changes.
- The stale tray seat id: after undo, the armed tray seat may no longer be in `tray`, or may have come back. Re-validate the tool against the draft each render, and disarm if it is gone.
- Saving a room that has only fixture additions works through the existing `buildSavePayload`. The "survives save and reload" criterion should be checked with a test that goes through `savePayload`. Fixture keys are renumbered on reload (`f:k`), and `nextKey` starts at `layout.fixtures.length`, so watch for a key collision after a delete and a place.
- A large palette (about 16 groups) without a scroll area pushes the Selection section off-screen at the 18rem width.

## Open questions
- Does the palette stay fixtures-only until SIM-015.8, or should desk entries show as disabled with a "coming soon" hint? Recommendation: omit them.
- Should the tool stay armed after a placement (stamp mode, recommended) or disarm each time?
- Is a new fixture's rotation always 0 (rotate afterwards), or does the palette need a rotation picker? Recommendation: 0, then Rotate.
- Does the fixture limit refusal need a new `LayoutRuleCode`? Recommendation: keep it editor-local (`fixture_limit`), because the server already rejects it as a 400.
- Should the resize form also offer a clip-floor preview? The core already clips and drops floors, so no.
