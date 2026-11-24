Status: READY

# Plan: SIM-015.10: Layout editor drag, marquee and keyboard shortcuts (slice 2c)

This slice adds pointer drag-move, rectangle (marquee) selection and keyboard shortcuts to the SIM-015.7/015.9
editor. All decisions sit in two new pure `src/lib/layout-editor` modules (a pointer gesture machine and a key
mapper) and a small reducer change (`selectMany`, `nudge` with undo coalescing). The components only translate DOM
events into those calls. UI tests stay static-render plus pure tests (SIM-015.7 A3: no DOM test environment). Ming
approves the defaults A1 to A17 with the plan (P1 gate). None of them blocks.

## Scope summary
- spec `docs/spec-v1.md` LAY-05 (l.353-355): "Sprite palette, click/drag to place, rotate (R), delete, multi-select
  and move a group by whole tiles, zoom 2×/3×/4× and pan, undo of the last steps before save. All of this is saved in
  one layout save. Desktop only." This slice covers "drag" (move), "rotate (R)", "multi-select" by rectangle and the
  keyboard side of delete, move and undo. "Drag to place" from the palette is not in the ticket scope (see A16).
- SIM-015.7 `plan.md` → Split proposal item 3 (approved 2026-11-23): "Pointer drag-move with whole-tile ghost preview
  (one commit on pointerup, rAF throttle). Marquee multi-select (`itemsInRect`), `setPointerCapture`, `touch-action`
  only while dragging. Keyboard shortcuts R, Delete/Backspace, Ctrl/Cmd+Z, arrows, Esc, Ctrl+S, with a visible
  shortcut list and arrow coalescing."
- SIM-015.7 A12: "Each button press or click edit is one undo step (cap 50). Coalescing is reconsidered with arrow
  keys in SIM-015.10." SIM-015.7 A3: no jsdom/testing-library; static-render plus pure tests.
- SIM-015.9 A10: "Esc is handled on the editor root, so it works when focus is inside the editor: the canvas region is
  focusable and is focused by a click. It is ignored while the leave dialog is open or when another handler already
  called `preventDefault`."
- SIM-015.7 `review.md` nits used here: "a shift-click on an empty tile clears the whole selection; many editors keep
  the selection on shift-click of empty space. ... only a UX note for SIM-015.10" (A3), and "`save` reads
  `flags.canSave` from the render closure ... A ref guard ... would make a duplicate PUT impossible" (A17, because
  Ctrl+S adds a second save trigger).
- `work/decisions.md`: D43 (whole tiles), D36 (copy in copy files), D52 (clean UI kit chrome), D2 (light Vitest).
- Ticket "Out of scope": palette, tray, resize (SIM-015.9); desk add/delete (SIM-015.8).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Dragging a selection moves it by whole tiles with one undo step. A refused drop (overlap, outside the room) snaps back: the draft is unchanged, no undo step is added and the refusal message shows in the status line. A whole-tile ghost previews the drop, marked when it would be refused. | `pointer-gesture.test.ts` › "drag release emits one move …", "drag from an unselected item …", "release applies the release position first …", "dragPreview …"; `editor-state.test.ts` (existing) › "move by (1,0) commits one step; a refused move … sets the refusal notice"; `LayoutEditorViews.test.tsx` › "GestureOverlay …". Real pointer run: Ming verification 1. |
| 2 | A drawn rectangle selects the items inside it (either direction, clamped to the room). Shift adds to the selection. An empty rectangle without Shift clears it. A plain click still selects as before. | `pointer-gesture.test.ts` › "marquee …", "press and release without moving …", "movement under 4 px …"; `editor-state.test.ts` › "selectMany …". Real run: Ming verification 2. |
| 3 | Each listed shortcut works and is listed in the editor: R, Delete/Backspace, Ctrl/Cmd+Z, arrows (one undo step per run of moves), Esc, Ctrl/Cmd+S. Not active in text fields, in the leave dialog, during IME composition or mid-gesture. | `shortcuts.test.ts` (all tests below); `editor-state.test.ts` › nudge tests; `LayoutEditorViews.test.tsx` › "shortcut list …", "aria-keyshortcuts …". Real run: Ming verification 3. |
| 4 | Drag and marquee never start while a placement tool is armed (a press places, as in SIM-015.9). Drag does not start while saving. | `pointer-gesture.test.ts` › "armed tool …", "frozen …" |
| 5 | R1 layers and all checks are green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` |

## Ming verification after merge
Ming runs these locally with `pnpm dev`, the dev token and a real DB, on a room with 20+ seats (ticket test plan).
1. Drag one seat two tiles right: a ghost box follows by whole tiles, the seat moves on release, Undo puts it back in
   one step. Shift-click three items and drag one of them: all three move together. Drag a seat onto another item or
   past the room edge: the ghost is dashed red, and on release nothing moves and "That tile is taken." or "That would
   leave the room." shows. Drag an unselected item: it becomes the only selection and moves.
2. Press on empty floor and draw a box over several seats (also right-to-left, bottom-to-top): they are selected.
   Shift and a second box adds more. A box over empty floor clears the selection. A plain click still selects one item.
   Shift-click on empty floor keeps the selection (A3).
3. Click the map, then: R turns the selection; Delete and Backspace delete a fixture (a seat shows the desk message);
   arrows move the selection; press → four times then Ctrl+Z: it returns to where it started in one step; Esc clears
   the selection, and with a palette tool armed Esc stops placing; Ctrl+S saves (no browser "Save page" dialog). Type
   in the room size Width input: Backspace edits the text and deletes nothing, Ctrl+Z undoes the text only. With a
   Vietnamese IME (Unikey/Telex) on, typing in the size input does not trigger R. Open "Keyboard shortcuts" under the
   Inspector: every key above is listed.
4. While dragging, press Esc: the drag is cancelled with no change. Drag and release outside the browser window: no
   stuck ghost.
5. With a palette tool armed, press and move on the map: no drag or box starts; release places the item.
6. Touch or pen on a touchscreen laptop (if available): a tap selects; a touch swipe scrolls the map (A1). Report how a
   pen drag behaves; it may scroll instead of drag (A1).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/layout-editor/pointer-gesture.ts` (new) | Pure gesture machine: `Gesture`, `PointerSample`, `GestureCtx`, `GestureEffect`, `gestureDown/Move/Up/Cancel`, `dragPreview`, `marqueeBox`, `marqueeKeys`, `DRAG_THRESHOLD_PX` (Approach step 2). | AC1, AC2, AC4 | No |
| `src/lib/layout-editor/pointer-gesture.test.ts` (new) | Unit tests | R5 | No |
| `src/lib/layout-editor/shortcuts.ts` (new) | Pure `keyAction(input, ctx)`, `isTextField(el)`, `SHORTCUTS` ids (Approach step 4). | AC3 | No |
| `src/lib/layout-editor/shortcuts.test.ts` (new) | Table tests | R5 | No |
| `src/lib/layout-editor/editor-state.ts` | `nudge: string \| null` in `EditorState` (l.18-27) and `initEditor` (l.44-56). Actions `selectMany` and `nudge` (l.29-42). Reducer cases, and a wrapper that resets `nudge` on every other action (l.119-193). | AC2, AC3 coalescing | No |
| `src/lib/layout-editor/editor-state.test.ts` | New tests (below); existing tests stay. | R5 | No |
| `src/lib/layout-editor/history.ts` | Add `replacePresent(h, next)` after `commit` (l.10-12). | Coalescing | No |
| `src/lib/layout-editor/history.test.ts` | One test | R5 | No |
| `src/lib/layout-editor/canvas-point.ts` | Add `canvasCell(offset, bounds, zoom)` (unclamped, never null) and `clampTile(p, w, h)`. `canvasTile` (l.9-20) becomes `canvasCell` + the null check, same results. | Drag uses unclamped tiles, marquee clamped (A4) | No |
| `src/lib/layout-editor/canvas-point.test.ts` | Tests for `canvasCell` and `clampTile`; existing tests stay. | R5 | No |
| `src/lib/layout-editor/tiles.ts` | Add `footprintBox(item): {x, y, w, h}` next to `footprintCells` (l.28-36). | Shared by outlines and the drag ghost | No |
| `src/lib/layout-editor/tiles.test.ts` | One test | R5 | No |
| `src/lib/layout-editor/place-tool.ts` | Remove `escDisarms` (l.64-69); `keyAction` replaces it. | No dead code (A8) | No |
| `src/lib/layout-editor/place-tool.test.ts` | Remove the `escDisarms` test; its cases move to `shortcuts.test.ts`. | Same | No |
| `src/ui/roomlayout/EditorCanvas.tsx` | Click layer: `onClick` (l.75-83, l.109) replaced by pointer handlers driving the gesture machine, with pointer capture, rAF throttle, `touch-none` while dragging, Esc cancel, region focus on press. Props: `onPlace`/`onPick` (l.23-25) replaced by `frozen` and `onAction(effect)`. Outlines (l.125-143) use `footprintBox`. Renders `GestureOverlay`. | AC1, AC2, AC4 | No |
| `src/ui/roomlayout/GestureOverlay.tsx` (new) | Presentational: drag ghost boxes (ok/refused) and the marquee rectangle with the would-be selection outlines, in px. | AC1, AC2; static-render testable | No |
| `src/ui/roomlayout/ShortcutList.tsx` (new) | `<details>` "Keyboard shortcuts" with a `<dl>` of `<kbd>` keys from `SHORTCUTS` + copy, plus the mouse rows. | AC3 "listed in the editor" | No |
| `src/ui/roomlayout/LayoutEditor.tsx` | Root `onKeyDown` (l.69-77) uses `keyAction`. Canvas props (l.101-110) become `frozen` + `onAction={dispatch}`. `ShortcutList` under the Inspector (l.111-137). Save ref guard (l.58-66, A17). | AC3 | No |
| `src/ui/roomlayout/EditorToolbar.tsx` | `aria-keyshortcuts` on Undo (l.30) and Save (l.36). | AC3, a11y | No |
| `src/ui/roomlayout/EditorInspector.tsx` | `aria-keyshortcuts` on Rotate and Delete (l.70-81). | AC3, a11y | No |
| `src/ui/copy/roomlayout.ts` | `editor.shortcuts` block: summary, rows per shortcut id (keys + action text), mouse rows (D36). | AC3, D36 | No |
| `src/ui/roomlayout/LayoutEditorViews.test.tsx` | Static-render tests for `ShortcutList`, `GestureOverlay` and the `aria-keyshortcuts` attributes. | R5 | No |

No file matches a High path. Expected size: about 430 source lines (about 230 lib, the rest JSX and copy), plus
tests. If it grows past about 550 source lines, the implementer stops and records it (A15 gives the cut).

## Data model / migration
None.

## API contract
None. Ctrl/Cmd+S calls the existing `save()` in `LayoutEditor.tsx` (PUT `/api/rooms/{id}/layout`, SIM-015.7). R7 is
unaffected.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `pointer-gesture.test.ts` › "down ignores a non-primary pointer, a non-left button, and a second pointer while a gesture runs" | AC1, AC2 |
| `pointer-gesture.test.ts` › "press and release without moving: on an item selects it (shift toggles), on an empty tile or outside the room clears the selection, shift on empty space keeps it (no effect)" | AC2, A3 |
| `pointer-gesture.test.ts` › "armed tool: release places at the tile, outside the room emits nothing, moving never starts a drag or a marquee" | AC4 |
| `pointer-gesture.test.ts` › "movement under 4 px on the same tile stays a press; 4 px or a tile change starts a drag on an item and a marquee on empty space" | AC1, AC2 |
| `pointer-gesture.test.ts` › "drag from an unselected item emits selectMany [hit] (shift: selection + hit) and drags those keys; from a selected item drags the whole selection with no select effect" | AC1, A2 |
| `pointer-gesture.test.ts` › "drag release emits one move with the whole-tile delta from unclamped tiles (also past the room edge); a zero delta emits nothing" | AC1, A4 |
| `pointer-gesture.test.ts` › "release applies the release position first: a press released 3 tiles away with no move event in between emits selectMany then move" | AC1 (rAF flush) |
| `pointer-gesture.test.ts` › "frozen: a press never becomes a drag and still selects on release; a marquee still selects" | AC4, A5 |
| `pointer-gesture.test.ts` › "touch: press only; a tap selects, moving never drags or draws a marquee" | A1 |
| `pointer-gesture.test.ts` › "marquee in either direction selects the itemsInRect keys with tiles clamped into the room; shift gives additive; an empty rectangle without shift gives selectMany [] (clears)" | AC2 |
| `pointer-gesture.test.ts` › "cancel from press, drag and marquee returns idle with no effects; move and up of another pointerId are ignored" | AC1, AC2 |
| `pointer-gesture.test.ts` › "move returns the same gesture object while the tile does not change" | rAF dedupe |
| `pointer-gesture.test.ts` › "dragPreview: null for a non-drag or zero delta; boxes are the footprint boxes shifted by the delta; ok is false for overlap and off-room, the same as moveItems" | AC1 |
| `pointer-gesture.test.ts` › "marqueeBox gives the normalised tile rect; marqueeKeys matches itemsInRect" | AC2 |
| `canvas-point.test.ts` › "canvasCell adds negative bounds and is not clamped (negative and past-the-room cells); clampTile clamps into 0..w-1 and 0..h-1" | A4 |
| `tiles.test.ts` › "footprintBox gives x, y, w, h from the rotated footprint (a 2×1 sprite at 90 is 1×2)" | AC1 |
| `history.test.ts` › "replacePresent keeps past and swaps present" | AC3 |
| `editor-state.test.ts` › "selectMany replaces; additive unions without toggling; unknown keys are dropped; an empty non-additive list clears" | AC2 |
| `editor-state.test.ts` › "consecutive nudges with the same selection are one undo step; one undo returns to the state before the run" | AC3, A9 |
| `editor-state.test.ts` › "a nudge after another action (inspector move, select, rotate, undo) starts a new undo step" | AC3, A9 |
| `editor-state.test.ts` › "undo after a run, then a nudge, commits a new step and does not overwrite the restored state" | A9 |
| `editor-state.test.ts` › "a refused nudge sets the refusal notice, keeps the draft and does not end the run" | AC3, A9 |
| `editor-state.test.ts` › "nudge is ignored while saving, with an empty selection and for (0,0)" | AC3 |
| `shortcuts.test.ts` › "maps r and R to rotate, Delete and Backspace to delete, the four arrows to nudge (±1), Ctrl+Z and Cmd+Z to undo, Ctrl+S and Cmd+S to save, Escape to escape" | AC3 |
| `shortcuts.test.ts` › "in a text field (input, textarea, select, contenteditable) every key is ignored, incl. Backspace, Ctrl+Z and Ctrl+S" | AC3, A6 |
| `shortcuts.test.ts` › "ignored with the dialog open, when defaultPrevented, while composing (IME), with Alt, and mid-gesture" | AC3, A6 |
| `shortcuts.test.ts` › "unmapped: Shift+Ctrl+Z, Ctrl+Y, Ctrl+R, Ctrl+Delete, Shift+Arrow, Space, Enter" | A7 |
| `shortcuts.test.ts` › "repeat: arrows and undo repeat; R, Delete, Backspace and save ignore auto-repeat" | A7 |
| `shortcuts.test.ts` › "with no selection, arrows, R and Delete give null (the region scrolls); Escape gives null when nothing is armed or selected" | A7, A8 |
| `shortcuts.test.ts` › "isTextField: INPUT, TEXTAREA, SELECT and contentEditable are true; BUTTON, DIV and null are false" | A6 |
| `shortcuts.test.ts` › "SHORTCUTS lists each action once" | AC3 |
| `place-tool.test.ts` › remove the `escDisarms` test | A8 |
| `LayoutEditorViews.test.tsx` › "shortcut list: a details with the summary, a row with <kbd> keys for every SHORTCUTS id, and the mouse rows" | AC3 |
| `LayoutEditorViews.test.tsx` › "Undo and Save (toolbar) and Rotate and Delete (inspector) carry aria-keyshortcuts" | AC3 |
| `LayoutEditorViews.test.tsx` › "GestureOverlay: an ok drag ghost is solid primary, a refused one is dashed error, a marquee is a dashed rect with outlines for its items, nothing for an idle gesture" | AC1, AC2 |

Domain focus: IME composition (Vietnamese Telex in the size input) in `shortcuts.test.ts`; empty fields (empty
selection, empty marquee, zero delta); bounds (drag past the edge, marquee clamped at the edges, negative `bounds`
overhang in `canvasCell`).

## Approach
1. **Small pure helpers.**
   - `canvas-point.ts`: `canvasCell(offset, bounds, zoom)` = the floor math of `canvasTile` without the null check.
     `canvasTile` calls it and keeps its null check. `clampTile(p, w, h)` clamps into the room.
   - `tiles.ts`: `footprintBox(item)` = top-left plus width and height from `footprintCells` (the math now inline in
     `EditorCanvas.tsx:128-130`).
   - `history.ts`: `replacePresent(h, next) = { past: h.past, present: next }`.
2. **Gesture machine (`pointer-gesture.ts`, imports `@/lib/**` and `./editor-state` types only).**
   ```ts
   export const DRAG_THRESHOLD_PX = 4;
   export type PointerSample = {
     id: number; offset: Point; cell: Point; shift: boolean; // cell = canvasCell (unclamped)
   };
   export type DownSample = PointerSample & { primary: boolean; button: number; pointerType: string };
   export type GestureCtx = { draft: Draft; selection: readonly string[]; tool: Tool | null; frozen: boolean };
   export type Gesture =
     | { kind: "idle" }
     | { kind: "press"; id: number; origin: Point; cell: Point; hit: string | null; shift: boolean;
         canDrag: boolean; canMarquee: boolean }
     | { kind: "drag"; id: number; cell0: Point; cell: Point; keys: string[] }
     | { kind: "marquee"; id: number; cell0: Point; cell: Point; additive: boolean }; // cells clamped
   export type GestureEffect = Extract<EditorAction,
     { type: "select" | "selectNone" | "selectMany" | "move" | "place" }>;
   type Step = { gesture: Gesture; effects: GestureEffect[] };
   gestureDown(g, s: DownSample, ctx): Step
   gestureMove(g, s, ctx): Step
   gestureUp(g, s, ctx): Step
   gestureCancel(): Gesture
   dragPreview(draft, g): { ok: boolean; boxes: Box[] } | null
   marqueeBox(g): Box | null; marqueeKeys(draft, g): string[]
   ```
   - Down: a gesture already running, `!primary` or `button !== 0` → unchanged. Otherwise `press`, with
     `hit = inRoom ? itemAt(draft, cell)?.key ?? null : null`. `canDrag = !tool && !frozen && pointerType !== "touch"`.
     `canMarquee = !tool && pointerType !== "touch"`.
   - Move (same `id` only):
     - `press`: stays while the distance from `origin` is under the threshold and the cell is the same. Otherwise, if
       `hit` and `canDrag` → `drag`; if no `hit` and `canMarquee` → `marquee` with clamped cells; else unchanged.
     - Drag keys: `hit` in the selection → the selection. Otherwise `shift` → selection + hit, else `[hit]`, plus an
       effect `selectMany(keys, false)`.
     - `drag`/`marquee`: update `cell` (clamped for marquee). Return the same object when the cell is unchanged.
   - Up (same `id` only): run Move with the release sample first, so the result never depends on the last rAF. Then:
     - `press`: with a tool, `place(cell)` when in the room, else nothing. Without a tool: `hit` → `select(hit, shift)`;
       no hit → `selectNone`, or nothing when `shift` (A3).
     - `drag`: `move(cell − cell0)` unless the delta is (0,0). The reducer's `move` already refuses atomically with the
       notice (`editor-state.ts:135-139`), which is the snap back.
     - `marquee`: `selectMany(marqueeKeys, additive)`.
     - Always ends in `idle`.
   - `dragPreview`: `moveItems(draft, keys, dx, dy).ok` and the `footprintBox` of each key shifted by the delta. It
     is the same rule as the commit, so the ghost never disagrees with the drop.
3. **Reducer (`editor-state.ts`).**
   - `{ type: "selectMany"; keys: string[]; additive: boolean }`: drop unknown keys. Additive → union in selection
     order then new keys; otherwise replace. It is not frozen-gated (selection is not an edit, as `select` today).
   - `{ type: "nudge"; dx; dy }`: ignored when frozen, with an empty selection or (0,0). `moveItems` refused → refusal
     notice, `nudge` kept. ok → if `state.nudge === sig(selection)` then `replacePresent`, else `commit`. Notice
     `done: "moved"`, `nudge = sig(selection)` (`sig` = the selection keys joined, in order).
   - Rename the current switch to an inner `reduce`. `editorReducer(s, a)` = `reduce(s, a)`, then for any action other
     than `nudge`, set `nudge` to null if it is not already null. `initEditor` sets `nudge: null`, so `saveDone` resets
     it as well.
4. **Key mapper (`shortcuts.ts`).**
   ```ts
   export type ShortcutId = "rotate" | "delete" | "nudge" | "undo" | "save" | "escape";
   export const SHORTCUTS: readonly ShortcutId[] = ["rotate", "delete", "nudge", "undo", "save", "escape"];
   export type KeyInput = { key: string; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean;
     repeat: boolean; composing: boolean; defaultPrevented: boolean; inTextField: boolean };
   export type KeyCtx = { dialogOpen: boolean; gesturing: boolean; armed: boolean; hasSelection: boolean };
   export type KeyResult = { type: "rotate" | "delete" | "undo" | "save" | "escape" }
     | { type: "nudge"; dx: number; dy: number } | null;
   keyAction(input, ctx): KeyResult
   isTextField(el: { tagName?: string; isContentEditable?: boolean } | null): boolean
   ```
   - Null first when: `inTextField`, `dialogOpen`, `defaultPrevented`, `composing`, `alt`, or `gesturing`.
   - `mod = ctrl || meta`. With `mod` and no `shift`: `z` → undo (repeat allowed), `s` → save (not on repeat). Every
     other `mod` combination → null. The key is lower-cased, so Caps Lock is fine.
   - Without `mod`: `r` → rotate; `Delete`/`Backspace` → delete (neither on repeat, and only with a selection).
     Arrows without `shift` → nudge (repeat allowed, only with a selection). `Escape` → escape when `armed ||
     hasSelection`.
5. **Canvas (`EditorCanvas.tsx`).**
   - New props `frozen: boolean` and `onAction: (a: GestureEffect) => void`. `onPick` and `onPlace` go.
   - Gesture state: a `useRef<Gesture>` (source of truth for the handlers) mirrored into `useState` for rendering. An
     `apply(step)` helper sets both (the state only when the object changes) and calls `onAction` for each effect in
     order.
   - `sample(e)`: offset from the click layer's `getBoundingClientRect()` (scroll-safe, as today), and
     `cell = canvasCell(offset, bounds, effective)`.
   - `onPointerDown`: `gestureDown`. When it leaves `idle`: `e.currentTarget.setPointerCapture(e.pointerId)`, and
     focus the region (`regionRef.current?.focus({ preventScroll: true })`) so shortcuts work after a click. Do not
     call `preventDefault` (that would also stop the focus), and use `select-none` on the layer instead.
   - `onPointerMove`: keep the latest sample in a ref and schedule one `requestAnimationFrame` if none is pending. The
     frame runs `gestureMove` on the latest sample. The existing hover handlers for the armed ghost
     (`onMouseMove`/`onMouseLeave`) stay as they are.
   - `onPointerUp`: cancel a pending frame, then `gestureUp` with the up event's own sample, then release the capture.
   - `onPointerCancel` and `onLostPointerCapture`: `gestureCancel`. After an up, the gesture is already idle, so the
     later `lostpointercapture` does nothing.
   - While a gesture is active: a `window` `blur` listener cancels it (effect keyed on the gesture kind). A
     `useEffect` on `[draft, effective]` cancels a running gesture (a stale delta after undo or zoom). The rAF frame is
     cancelled on unmount.
   - The region `onKeyDown`, while a gesture is active: Escape cancels it and calls `preventDefault`. Every key is
     stopped from propagating (`stopPropagation`, no `preventDefault`), so no shortcut fires mid-gesture.
   - The layer class adds `touch-none` while the gesture is `drag` or `marquee` (A1). `onClick` is removed. The armed
     place goes through the machine (press → up → `place`), so a click can never fire twice.
   - The outlines use `footprintBox`. `<GestureOverlay>` gets `dragPreview(draft, gesture)` (memoised on
     `[draft, gesture]`), and `marqueeBox` plus the boxes of `marqueeKeys`, along with `bounds` and `effective`.
6. **`GestureOverlay.tsx` (presentational).**
   - Converts tile boxes to px with `(x * TILE - bounds.x) * zoom`, as the existing ghost does.
   - A drag ghost box uses the SIM-015.9 ghost classes: ok `border-2 border-primary bg-primary/20`; refused
     `border-2 border-dashed border-error bg-error/20`. The state is not shown by colour alone.
   - The marquee is a `border border-dashed border-primary bg-primary/10` rect, with a thin outline for each would-be
     selected item.
   - Everything is `pointer-events-none`, with `data-testid` `drag-ghost`, `marquee`. There is no animation.
7. **Container (`LayoutEditor.tsx`).**
   - Root `onKeyDown`:
     ```ts
     const r = keyAction({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey, alt: e.altKey,
       repeat: e.repeat, composing: e.nativeEvent.isComposing, defaultPrevented: e.defaultPrevented,
       inTextField: isTextField(e.target as HTMLElement | null) },
       { dialogOpen: guard.pending !== null, gesturing: false, armed: tool !== null,
         hasSelection: state.selection.length > 0 });
     ```
     `gesturing` is false here, because the canvas stops keys mid-gesture (step 5). It stays in `KeyCtx` so the rule
     is tested. When `r` is set, call `e.preventDefault()`, then:
     - `rotate` / `delete` / `undo` → dispatch
     - `nudge` → `{ type: "nudge", dx, dy }`
     - `save` → `void save()`, which returns early unless `canSave`. The visible Save reason explains a block.
     - `escape` → `disarm` if a tool is armed, else `selectNone`
   - The canvas gets `frozen={frozen}` and `onAction={dispatch}`. `<ShortcutList />` goes after `EditorInspector` in
     the right column.
   - Save guard (A17): a `useRef(false)`, set when the PUT starts and cleared when it ends; `save()` returns early
     while it is set.
8. **Shortcut list and copy.**
   - `ShortcutList` is a `<details>` (closed) with `<summary>` "Keyboard shortcuts". Inside is a `<dl>`: for each
     `SHORTCUTS` id, `<dt>` holds the keys as `<kbd>` elements and `<dd>` the action. Then a short "Mouse" `<dl>`.
   - Copy (`editor.shortcuts`), typed `Record<ShortcutId, { keys: string[]; action: string }>` so a missing row fails
     typecheck:
     - rotate: `["R"]` "Turn the selection"
     - delete: `["Delete", "Backspace"]` "Delete the selection"
     - nudge: `["Arrow keys"]` "Move the selection by one tile. Moves in a row undo together."
     - undo: `["Ctrl+Z", "Cmd+Z"]` "Undo"
     - save: `["Ctrl+S", "Cmd+S"]` "Save the layout"
     - escape: `["Esc"]` "Cancel a drag, stop placing, or clear the selection"
   - Mouse rows: "Drag an item: move the selection", "Drag on empty floor: select an area", "Shift: add to the
     selection".
   - `aria-keyshortcuts`: Rotate `"R"`, Delete `"Delete Backspace"`, Undo `"Control+Z Meta+Z"`, Save
     `"Control+S Meta+S"` (`Button` spreads `...rest`, `src/ui/Button.tsx:37,59`).
9. **Rules.**
   - R1: the new lib files import only `@/lib/**` and local lib files. The UI imports ui and lib. `check:layers`
     enforces this.
   - R2, R3, R6, R7: no schema, config, server or route change.
   - R4: only the files above.
   - R5: tests as listed.
10. **Checks** (in bash, `eval "$(fnm env --shell bash)"` first): `pnpm format:check`,
    `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. `pnpm test:db` is CI-only and not affected.

## Specialist input used
- consult-frontend-developer.md:
  - Finding "do not feed the raw canvas offset to `dragDelta`" (bounds overhang): adopted. Drag uses tile cells from
    `canvasCell`, which adds `bounds`. `dragDelta` and `pointToTile` stay unused.
  - Finding/Rec "clamped variant": adopted as `clampTile` for the marquee. Drag stays unclamped so the core refuses an
    off-room drop (A4).
  - Rec 1 (pure reducer-style gesture machine with press/drag/marquee, threshold, select-then-drag, effects): adopted.
    The effects are an array, because a release can both start and finish a drag.
  - Rec 2 (pointer events only, remove `onClick`, armed place in the machine): adopted.
  - Rec 3 (capture, primary only, one pointer id, lost capture as cancel): adopted.
  - Rec 4 (touch): option (b) adopted, mouse and pen only, see A1. Its open question 1 is answered by A1.
  - Rec 5 (rAF, the release flushes the last position, dedupe): adopted. The up applies its own sample in pure code
    (tested).
  - Rec 6 (ghost from a dry-run `moveItems`, memoised; tile-aligned marquee): adopted.
  - Rec 7 (scroll-safe offsets; no autoscroll): adopted, autoscroll is a follow-up (A12).
  - Rec 8 (pure `shortcutFor`, wrapper scope, guards, Backspace in inputs, arrows scroll with no selection, focus the
    region on press): adopted as `keyAction`. Its open question 2 (Ctrl+S in inputs): strict, not in text fields (A6).
    Its open question 4 (no redo): confirmed, unmapped (A7).
  - Rec 9 (no-clock coalescing via a `lastMove` field and a separate nudge action): adopted as `nudge` (A9). Its
    open question 5: no clock (A9).
  - Rec 10 (list and handler from one table, test): adopted. `Record<ShortcutId, …>` makes drift a type error.
  - Rec 11, 12 (tests, layers): adopted.
  - Risk "stale delta after zoom or draft change": adopted (cancel on `[draft, effective]`). Risk "Ctrl+S while
    saving": covered by `canSave` plus the ref guard (A17).
- consult-ux-architect.md:
  - Rec 1 (state machine, threshold, select-then-drag, shift-marquee additive, `selectMany`): adopted.
  - Rec 2 (ghost with the `place-ghost` styling and a `moveItems` verdict, existing refusal strings, cancel with no
    notice): adopted. "Keep the originals dimmed" is not done: the originals are painted on the canvas. Their
    selection outlines stay in place.
  - Rec 3 (marquee rect with live highlight, capture, rAF): adopted, tile-snapped (it matches `itemsInRect`).
    "`touch-action: none` set in pointerdown": not possible as written, because the browser reads `touch-action` at
    pointerdown (A1).
  - Rec 4 (key table, Esc priority, guards, `isComposing`, Ctrl+S always prevented): adopted. Ctrl+S is not handled
    inside text fields, because the ticket says "not active in inputs" (A6). "R/arrows/Delete only on the canvas
    region, not on buttons": rejected. Those keys have no native action on a button, and pressing R again after
    clicking Rotate is the expected case (A6).
  - Rec 5 (time-window coalescing with a timestamp in the action): rejected for the no-clock rule (A9). Inspector
    buttons stay one step per click (SIM-015.7 A12): adopted.
  - Rec 6 (`<details>` closed under the Inspector, `<kbd>`, `<dl>`, `aria-keyshortcuts`): adopted.
    `aria-describedby` on the region: not done, because `aria-keyshortcuts` on the buttons covers it.
  - Rec 7 (announce marquee count and nudge position): deferred (A12). The click layer is `aria-hidden`, and the
    Items list stays the assistive path. The Inspector shows the count.
  - Rec 8 (tests, `e.repeat` ignored for R/Delete): adopted.
  - Its open questions: 1 → A4 (refused tiles and off-room drops show the message); 2 → yes (A8); 3 → out (A7);
    4 → closed disclosure (A10); 5 → no clock (A9); 6 → tray seats are not on the map, so they are not in a marquee or
    drag (A13).
  - Risk "Delete with a mixed selection": kept as refuse-all (A11).

## Assumptions
Defaults for Ming to approve with the plan.

- **A1 Touch and pen.**
  - Drag and marquee start only with a mouse or a pen.
  - A touch press is a tap: it selects, or places while armed. A touch swipe keeps scrolling the map, because the
    layer keeps the default `touch-action`. The browser then fires `pointercancel`, which cancels the press.
  - `touch-none` is applied while a drag or marquee runs, as the ticket says. The browser reads `touch-action` at
    pointerdown, so this only matters for later pointers. On a touchscreen a pen may scroll instead of dragging (then
    it cancels with no change). The spec is "Desktop only", and the Inspector move buttons and arrow keys remain.
- **A2 Drag target.**
  - A press on a selected item drags the whole selection.
  - A press on an unselected item selects it alone (with Shift: adds it), then drags.
  - A press on empty floor or outside the room starts a marquee.
- **A3 Shift-click on empty space keeps the selection** (SIM-015.7 review nit). This changes SIM-015.7 AC7 for
  Shift only; a plain click on empty space still clears. Shift+marquee adds (union, no toggle).
- **A4 Drop and marquee bounds.**
  - The drag delta comes from unclamped tiles. A drop past the room edge is refused by the core ("That would leave the
    room."), and so is an overlap ("That tile is taken."). Both snap back with the message.
  - The marquee is clamped into the room.
  - The threshold is 4 px or a tile change. A smaller movement is a click.
- **A5 While saving** (`frozen`), a drag does not start (the press stays a click). Click-select and the marquee still
  work, as selection already does today.
- **A6 Shortcut scope.**
  - Shortcuts use the editor root `onKeyDown` only, so they work when focus is inside the editor. A press on the map
    focuses the map region.
  - They are off in text fields (input, textarea, select, contenteditable). That includes Ctrl+S and Ctrl+Z, so text
    undo stays native. They are also off while the leave dialog is open, during IME composition (Vietnamese
    Telex/VNI), with Alt held, and mid-gesture (only Esc works there, and it cancels).
  - They are active on buttons (Inspector, Palette, toolbar). Space and Enter are never mapped.
- **A7 Key details.**
  - R, Delete, Backspace and Ctrl/Cmd+S ignore auto-repeat. Arrows and Ctrl/Cmd+Z repeat.
  - Shift+Arrow, Ctrl+Shift+Z and Ctrl+Y are unmapped (there is no redo).
  - Inside the editor, Ctrl/Cmd+S always prevents the browser's "Save page", even when Save is blocked. The visible
    Save reason explains why nothing happens.
  - Arrows, R, Delete and Esc call `preventDefault` only when they act. With nothing selected, the arrows scroll the
    focused map region as before.
- **A8 Esc order.** Cancel a drag or marquee, else stop placing, else clear the selection. `escDisarms` is removed;
  `keyAction` covers its cases.
- **A9 Arrow coalescing.**
  - Consecutive arrow moves of the same selection, with no other action in between, are one undo step. There is no
    time window.
  - A refused arrow (edge, overlap) shows the message and keeps the run.
  - Inspector move buttons stay one step per click (SIM-015.7 A12). A pointer drag is always one step.
  - A run that returns to its start leaves a no-op undo step. This is harmless, because Save uses `isDirty` against
    the baseline.
- **A10 Shortcut list.** A closed "Keyboard shortcuts" disclosure under the Inspector, with the mouse gestures. Rotate,
  Delete, Undo and Save carry `aria-keyshortcuts`. Keys are written as "Ctrl+Z, Cmd+Z" (no OS detection).
- **A11 Delete with a seat in the selection** stays refuse-all with the desk message (SIM-015.7 A4). Desk delete is
  SIM-015.8.
- **A12 Not in this slice (follow-ups).** Edge autoscroll while dragging. Live announcements of the marquee count and
  nudge position. Showing the sprite instead of a box in the ghost (SIM-033 art).
- **A13 Tray seats** are not on the map, so they are never in a drag or marquee.
- **A14 Hotspots.** No other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on `work/backlog.md`, so no rebase is
  expected. SIM-015.8 will later edit `editor-state.ts`, `LayoutEditor.tsx`, `EditorInspector.tsx` and
  `copy/roomlayout.ts`.
- **A15 Size fallback.** If the diff grows past about 550 source lines, the keyboard part moves to SIM-015.11:
  `shortcuts.ts`, the `nudge` action and coalescing, `ShortcutList`, and `aria-keyshortcuts`. Drag and marquee stay
  here. The default is one slice.
- **A16 Drag to place.** LAY-05 "click/drag to place" is met by click-to-place (SIM-015.9) plus drag-to-move after
  placing. Dragging a palette entry onto the map is not in this ticket's scope. It becomes a follow-up if Ming wants
  it.
- **A17 Save guard.** Ctrl+S is a second trigger for Save, so `save()` gets the ref guard suggested in the SIM-015.7
  review, and a duplicate PUT cannot start.

## Blocking questions
None.

## Split proposal
None. This is slice 2c of the SIM-015.7 split. A15 gives the fallback cut (keyboard part → SIM-015.11) if the size
guide is exceeded.
