Status: READY

# Plan: SIM-015.9: Layout editor palette, tray placement and room resize (slice 2b)

This slice adds placing to the SIM-015.7 editor. Admins can place fixtures from a palette and place tray seats on the
map, and they can resize the room. A place-time fixture limit is added. All edits go through the existing pure core
(`placeItem`, `placeFromTray`, `resizeRoom` in `src/lib/layout-editor/draft.ts`), which stays unchanged. The new
logic is in pure `src/lib` code with unit tests. The UI is tested with static renders (SIM-015.7 A3: no DOM test
environment). Ming approves the defaults A1 to A14 with the plan (P1 gate). None of them blocks.

## Scope summary
- spec `docs/spec-v1.md`:
  - LAY-01 (l.338-340): "A room has a size in tiles (width × height). An Admin opens the room's editor, places items
    on whole tiles and saves. Positions survive reloads and sessions."
  - LAY-03 (l.349-351): "An Admin adds, moves, rotates and deletes fixtures from the sprite palette: door, window,
    wall, stairs, elevator, server rack, cabinet, pillar, plant, blocked area, label. They are saved with the room."
    This slice covers "adds". Move, rotate and delete shipped in SIM-015.7.
  - LAY-05 (l.353-355): "Sprite palette, click/drag to place, ...". This slice covers the palette and click to place.
    Drag is SIM-015.10 (ticket "Out of scope").
- `work/decisions.md`:
  - D43: whole tiles, 4 rotations, fixed sprite sizes, "a room has a size in tiles".
  - D59: "seats use `desk.single`". Tray seats are placed as `desk.single` (`placeFromTray`, draft.ts:110-134).
  - D36: copy lives in copy files.
  - D52: the editor chrome uses the clean UI kit.
  - D2: light Vitest unit tests.
- SIM-015.7 `plan.md` → Split proposal item 2 (approved 2026-11-23): "`Palette` from `paletteEntries()` with labels.
  Armed tool + click a tile → `placeItem` / `placeFromTray`, Esc to disarm, ghost on hover. Place-time refusal when
  fixtures reach `LAYOUT_LIMITS.fixtures` (review follow-up). Room size inputs → `resizeRoom`. Unblocks Save for rooms
  with unplaced seats (A5)."
- SIM-015.7 A3 (no jsdom/testing-library; static-render plus pure tests) and A15 ("Proper palette labels come with the
  palette (SIM-015.9)").
- SIM-015.2 `review.md` follow-up: "`checkLayoutRules` does not enforce the count caps (`LAYOUT_LIMITS.fixtures`
  2000 ...) ... should refuse the place".
- Ticket "Out of scope": desk add/delete (SIM-015.8), pointer drag, marquee and shortcuts (SIM-015.10), floor painting.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | An Admin places a fixture from the palette. It goes into the save payload and survives the save round trip. The new fixture is selected after placing. | `editor-state.test.ts` › "place with a fixture tool commits one step, selects the new f: key, keeps the tool armed", "a placed fixture is in savePayload and passes validateLayoutSave; saveDone with that view keeps it and is clean"; `place-tool.test.ts` › "tryPlace fixture …". A real reload is under Ming verification 1. |
| 2 | A tray seat can be placed. The tool then moves to the next tray seat, or disarms when the tray is empty. Once the tray is empty, Save is enabled and the payload carries the seat. | `editor-state.test.ts` › "placing the last tray seat empties the tray: canSave true, saveBlock null, savePayload has the seat at its tile"; "tray tool advances to the next tray seat, then disarms"; `LayoutEditorViews.test.tsx` › "inspector tray rows are Place buttons …" |
| 3 | A room size change commits one undo step and saves (payload `w`/`h`). A resize that would cut off an item is refused with an inline message next to the size inputs, and the draft is unchanged. Invalid input (empty, not a whole number, outside 1–64) shows a message and does not call the op. | `editor-state.test.ts` › "resize …" (3 tests); `place-tool.test.ts` › "parseRoomSize …"; `LayoutEditorViews.test.tsx` › "room size form …" |
| 4 | A new fixture beyond `LAYOUT_LIMITS.fixtures` is refused at place time with its own message. The draft is unchanged and no undo step is added. At limit − 1, the place still works. | `place-tool.test.ts` › "tryPlace refuses fixture_limit at LAYOUT_LIMITS.fixtures, allows at limit − 1"; `editor-state.test.ts` › "place at the fixture limit sets the fixture_limit notice and adds no step" |
| 5 | The palette lists fixtures only (no `desk.single`), grouped with headings, as `aria-pressed` buttons. Clicking the armed entry again disarms it. Esc disarms. Arming clears the selection. While a tool is armed, a canvas click places instead of selecting. A ghost shows the footprint on hover, marked when the place would be refused. | `palette.test.ts` › "fixturePalette …"; `LayoutEditorViews.test.tsx` › "palette …", "place panel …"; `editor-state.test.ts` › "arm / disarm …"; `place-tool.test.ts` › "placementPreview …", "escDisarms …". Click, hover and Esc wiring is checked by hand (Ming verification 2), because there is no DOM test env (A3). |
| 6 | Place, arm and resize are ignored while saving or read-only. Undo of a place or resize restores the draft, and the tool is cleared if its tray seat is gone. | `editor-state.test.ts` › "place, arm and resize are ignored while saving", "undo of a place and of a resize; a tray tool whose seat is no longer in the tray is cleared" |
| 7 | R1 layers and all checks are green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` |

## Ming verification after merge
Ming runs these locally with `pnpm dev`, the dev token and a real DB. The reviewer has no Postgres or Identity here.
1. As admin, open a room's editor. Pick "plant large" in the palette and click two free tiles. Two plants appear. Pick
   a door, place it, then press Rotate. Save and reload the page: the plants and the turned door are still there, and
   the room page map matches.
2. While a tool is armed, hovering the map shows a box at the tile, in a different colour and with a dashed border on
   a taken tile. Clicking a taken tile shows "That tile is taken." Esc (with focus in the editor) and "Done placing"
   both disarm. Clicking the armed palette entry again also disarms it.
3. In a room with unplaced seats (make one in the seat table without a position, or use a seeded one), the Save
   reason says "Place all seats before saving." Click "Place <code>" in the tray, then a free tile. When the tray is
   empty, Save is enabled. Save and reload: the seat is on the map.
4. Keyboard only: Tab to a palette entry, press Enter, type X/Y in the place panel, press Place. The status line
   announces "Placed." Do the same for a tray seat.
5. Shrink the room so that an item would fall outside. The inline message appears and nothing changes. Shrink it to
   a size that keeps all items, then Save and reload: the new size is kept and floors are clipped. Undo before saving
   restores the old size.
6. (Optional, dev DB only) Seed a room with 2000 fixtures. Placing another one shows the fixture limit message.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/layout-editor/place-tool.ts` (new) | Pure helpers: the `Tool` type, `tryPlace`, `placementPreview`, `nextTool`, `reconcileTool`, `escDisarms`, `parseWhole`, `parseRoomSize` (Approach step 1). | AC1-AC5; fixture limit (review follow-up) | No |
| `src/lib/layout-editor/place-tool.test.ts` (new) | Unit tests | R5 | No |
| `src/lib/layout-editor/editor-state.ts` | `tool` in `EditorState` (l.14-22) and `initEditor` (l.35-46). New actions `arm`, `disarm`, `place`, `resize` (l.24-33). Notice codes `fixture_limit` and `resize_cut`, and `what` values `placed` and `resized` (l.10-12, `applyEdit` l.92-107). Undo reconciles the tool (l.141-151). | AC1-AC4, AC6 | No |
| `src/lib/layout-editor/editor-state.test.ts` | New tests (listed below). The existing tests stay. | R5 | No |
| `src/lib/layout-editor/palette.ts` | Add `fixturePalette(): { group: string; entries: PaletteEntry[] }[]` built from `paletteEntries()` (l.14-33), fixtures only, in its order. `paletteEntries` stays unchanged. | AC5; no seat sprites until SIM-015.8 (A2) | No |
| `src/lib/layout-editor/palette.test.ts` | Add `fixturePalette` tests | R5 | No |
| `src/ui/roomlayout/Palette.tsx` (new) | `Palette` (grouped `aria-pressed` buttons in a `max-h` scroll area, disabled while frozen) and `PlacePanel` (armed line `role="status"`, X/Y inputs, Place button, "Done placing" button; shown only while a tool is armed). | AC5, keyboard path (A6) | No |
| `src/ui/roomlayout/EditorInspector.tsx` | Tray rows (l.94-103) become "Place <code>" buttons (`aria-pressed` for the armed seat). The read-only size line (l.92) becomes `RoomSizeForm` (in the same file), keyed on `${w}x${h}` so it resets on undo or save. New props: `tool`, `onArmTray`, `onResize`, `resizeRefused`. | AC2, AC3 | No |
| `src/ui/roomlayout/EditorCanvas.tsx` | New props `tool` and `onPlace(x, y)`. While a tool is armed, the click (l.53-64) calls `onPlace` instead of `onPick`. Hover tile state (`onMouseMove`/`onMouseLeave` on the click layer l.86-91, set only when the tile changes). Ghost div from a memoised `placementPreview`. `cursor-crosshair` while armed. | AC5 (ghost, click to place) | No |
| `src/ui/roomlayout/LayoutEditor.tsx` | Wire the new actions. The right column (l.71-89) becomes `PlacePanel` + `Palette` + `EditorInspector`. Add an `onKeyDown` on the root div (l.49) using `escDisarms`, ignored while the leave dialog is open. | AC5 | No |
| `src/ui/roomlayout/EditorViews.tsx` | `EditorStatusLine` (l.141-153) compiles against the new notice codes. No logic change unless TypeScript asks for it. | type | No |
| `src/ui/copy/roomlayout.ts` | `editor.refused.fixture_limit` and `resize_cut`. `done.placed` and `done.resized`. A `palette` block: heading, group headings for the 16 `FIXTURE_GROUPS`, armed line, place panel labels, "Done placing". Inspector: tray `placeSeat(code)`, size form labels, Apply, and the parse error. | D36 | No |
| `src/ui/roomlayout/LayoutEditorViews.test.tsx` | Static-render tests for the Palette, PlacePanel, tray buttons and the size form, plus a test that every group has a heading. | R5 | No |

No file matches a High path. Expected size: about 450 source lines (about 150 lib, the rest JSX and copy), plus
tests. That is slightly above the ~400 guide. It is kept in one slice because the three parts share the tool, notice
and inspector changes, and the ticket is already a split slice. If it grows past about 550 source lines, the
implementer stops and records it (A13 offers a cut).

## Data model / migration
None.

## API contract
None. Saving uses the existing PUT `/api/rooms/{id}/layout` through `savePayload` → `seatsApi.saveLayout`
(SIM-015.7). Tray seats are existing room seats, so placing all of them sends the full seat id set that the server
requires (`src/server/layout/save.ts:70`, `layout_seats_changed` otherwise). R7 is unaffected.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `place-tool.test.ts` › "tryPlace fixture: ok returns the draft and key f:<nextKey>; a taken or off-room tile returns the core code; a seat sprite is refused as layout_unknown_sprite" | AC1, A2 |
| `place-tool.test.ts` › "tryPlace refuses fixture_limit at LAYOUT_LIMITS.fixtures, allows at limit − 1" (a 64×64 draft with generated 1×1 fixtures on distinct tiles; the implementer picks a 1×1 fixture sprite via `footprintOf`) | AC4 |
| `place-tool.test.ts` › "tryPlace tray: ok returns key s:<id> and removes the seat from the tray; an id not in the tray is refused" | AC2 |
| `place-tool.test.ts` › "placementPreview gives the tile, the footprint size at rotation 0 and ok/refused (incl. fixture_limit), and null without a tool" | AC5 |
| `place-tool.test.ts` › "nextTool keeps a fixture tool; a tray tool moves to tray[0] or null" | AC2 |
| `place-tool.test.ts` › "reconcileTool clears a tray tool whose seat is not in the tray; keeps fixture tools" | AC6 |
| `place-tool.test.ts` › "escDisarms only for Escape, with a tool armed, no dialog open, not defaultPrevented" | AC5 |
| `place-tool.test.ts` › "parseWhole accepts '0', ' 12 '; rejects '', '1.5', '-1', '1e2', 'abc'" | AC3, A6 |
| `place-tool.test.ts` › "parseRoomSize accepts 1 and 64; rejects 0, 65, empty and non-integers" | AC3 |
| `editor-state.test.ts` › "arm sets the tool and clears the selection; arming the same tool again disarms; disarm clears; arming a tray seat not in the tray does nothing" | AC5 |
| `editor-state.test.ts` › "place with a fixture tool commits one step, selects the new f: key, keeps the tool armed, notice placed" | AC1 |
| `editor-state.test.ts` › "place without a tool, or on a taken tile, adds no step; the refusal sets the notice" | AC1, AC5 |
| `editor-state.test.ts` › "place at the fixture limit sets the fixture_limit notice and adds no step" | AC4 |
| `editor-state.test.ts` › "a placed fixture is in savePayload and passes validateLayoutSave; saveDone with that view keeps it and is clean" | AC1 |
| `editor-state.test.ts` › "tray tool advances to the next tray seat, then disarms" (view with `unplaced` S3 and a fourth seat, codes with diacritics) | AC2 |
| `editor-state.test.ts` › "placing the last tray seat empties the tray: canSave true, saveBlock null, savePayload has the seat at its tile" | AC2 |
| `editor-state.test.ts` › "resize to a larger size commits one step, savePayload has the new w/h; the same size is a no-op" | AC3 |
| `editor-state.test.ts` › "resize that cuts off an item is refused as resize_cut and keeps the draft and history" | AC3 |
| `editor-state.test.ts` › "resize out of 1–64 is refused as layout_out_of_bounds" | AC3 |
| `editor-state.test.ts` › "place, arm and resize are ignored while saving" | AC6 |
| `editor-state.test.ts` › "undo of a place and of a resize; a tray tool whose seat is no longer in the tray is cleared" | AC6 |
| `editor-state.test.ts` › "saveDone clears the tool" | AC6 |
| `palette.test.ts` › "fixturePalette has no seat entries, groups in paletteEntries order, and the flattened entries equal the fixture entries of paletteEntries" | AC5 |
| `LayoutEditorViews.test.tsx` › "palette renders a heading per group and aria-pressed buttons; the armed sprite is pressed; no desk.single entry; all buttons disabled when disabled" | AC5 |
| `LayoutEditorViews.test.tsx` › "every FIXTURE_GROUPS entry has a palette heading in the copy" | D36 |
| `LayoutEditorViews.test.tsx` › "place panel shows the armed item name, labelled X and Y inputs, Place and Done placing; renders nothing without a tool" | AC5, A6 |
| `LayoutEditorViews.test.tsx` › "inspector tray rows are Place buttons named with the seat code (Phòng-A-03); the armed one is pressed; disabled when disabled" | AC2, domain focus |
| `LayoutEditorViews.test.tsx` › "room size form shows labelled W and H inputs with the draft size and Apply; resizeRefused shows the inline message referenced by aria-describedby" | AC3 |
| `LayoutEditorViews.test.tsx` › status line: "EditorStatusLine shows placed, resized, fixture_limit and resize_cut copy" | AC3, AC4 |

## Approach
1. **Pure helpers (`src/lib/layout-editor/place-tool.ts`, imports `@/lib/**` only).**
   ```ts
   export type Tool = { kind: "fixture"; sprite: string } | { kind: "tray"; seatId: string };
   export type PlaceResult =
     | { ok: true; draft: Draft; key: string }
     | { ok: false; code: LayoutRuleCode | "fixture_limit" };
   tryPlace(draft, tool, x, y): PlaceResult
   placementPreview(draft, tool | null, tile | null): { x; y; w; h; ok: boolean } | null
   nextTool(tool, draft): Tool | null; reconcileTool(tool | null, draft): Tool | null
   escDisarms(key, { armed, dialogOpen, defaultPrevented }): boolean
   parseWhole(s): number | null; parseRoomSize(w, h): { ok: true; w; h } | { ok: false }
   ```
   - Fixture branch:
     1. A sprite in `SEAT_SPRITES` → `layout_unknown_sprite`. Desk add is SIM-015.8 (A2), and this guard stops a
        `n:` desk that would block Save with `pending_seats`.
     2. A fixture count of `LAYOUT_LIMITS.fixtures` or more → `fixture_limit`, before the op runs.
     3. Otherwise `placeItem(draft, sprite, x, y, 0)`. The key is `f:${draft.nextKey}`, read before the op.
   - Tray branch: `placeFromTray(draft, seatId, x, y, 0)`. The key is `s:${seatId}`.
   - `placementPreview` uses `footprintOf(sprite, 0)` (`desk.single` for tray) for the size and `tryPlace(...).ok`
     for the tint.
   - `draft.ts` stays unchanged. The limit is editor-local, like `seat_delete`, because the server already refuses
     the payload (A4).
2. **Reducer (`editor-state.ts`).**
   - Add `tool: Tool | null` to the state (`initEditor` sets null, so `saveDone` clears it).
   - New actions: `{type:"arm"; tool}`, `{type:"disarm"}`, `{type:"place"; x; y}`, `{type:"resize"; w; h}`. While
     `frozen`, `arm`, `place` and `resize` return the state unchanged. `disarm` always works.
   - `arm`:
     - Arming the tool that is already armed (same sprite or seat) disarms it.
     - A tray seat that is not in the tray does nothing.
     - Otherwise it sets the tool and clears the selection.
   - `place`:
     - No tool → no change.
     - `tryPlace` refused → `refused` notice, no history step, and the tool stays armed.
     - ok → commit, `done: "placed"`, selection `[key]`, and `tool = nextTool(tool, newDraft)`.
     - Reuse `applyEdit`. Widen its `what` and pass the selection, then set `tool`. A stale non-conflict save error is
       cleared there as for other edits.
   - `resize`:
     - Same `w` and `h` → no change.
     - `resizeRoom` refused: inside 1–64 → `resize_cut` (only an item outside can cause this, since items never shift),
       otherwise `layout_out_of_bounds`.
     - ok → `applyEdit(..., "resized")`, selection kept.
   - `undo` additionally sets `tool = reconcileTool(state.tool, history.present)`.
   - Notice type: `refused.code: LayoutRuleCode | "seat_delete" | "fixture_limit" | "resize_cut"`. `done.what` gains
     `"placed" | "resized"`. Keys stay unique: `nextKey` only grows, undo restores it with the draft, and `saveDone`
     renumbers from the view.
3. **Palette (`palette.ts` + `Palette.tsx`).**
   - `fixturePalette()` groups `paletteEntries().filter(kind === "fixture")` by `group`, keeping their order.
   - `Palette` props: `groups`, `armed: string | null` (sprite), `disabled`, `onArm(sprite)`.
     - Layout: a `<section>` with `<h2>` "Add items", then per group an `<h3>` from `copy.palette.groups[group]`
       (falling back to the group key) and a `<ul>` of `<button type="button" aria-pressed>`.
     - The label is `copy.itemName({ kind: "fixture", sprite, code: null })` (A5).
     - The list sits in a `max-h-64 overflow-auto` area. There are no thumbnails (A7).
   - `PlacePanel` props: `toolName: string | null`, `disabled`, `onPlace(x, y)`, `onDone()`.
     - It renders nothing when `toolName` is null.
     - Otherwise: a `role="status"` line "Placing <name>. Click a tile on the map, or enter a tile and press Place. Esc
       stops." Then labelled X and Y inputs (`inputMode="numeric"`, local string state, default "0"), a Place button and
       "Done placing".
     - A bad X/Y (from `parseWhole`) shows an inline message and does not dispatch. An off-room tile goes through the
       op and shows "That would leave the room."
   - `toolName` comes from the LayoutEditor: the fixture label, or `copy.itemName` of the tray seat ("Desk <code>").
4. **Inspector (`EditorInspector.tsx`).**
   - Tray rows become `<button aria-pressed={armed seat}>` "Place <code>", calling `onArmTray(id)`. They are disabled
     when `disabled`. The heading and count stay.
   - `RoomSizeForm({ w, h, disabled, refused, onResize })` is a `<form>` with labelled W and H inputs
     (`inputMode="numeric"`, local strings) and an "Apply size" submit button.
   - Submit runs `parseRoomSize`. A failure shows "Enter a whole number from 1 to 64." locally. Success calls
     `onResize(w, h)`.
   - `refused` (from `notice.code === "resize_cut"`) shows "Some items would be outside the smaller room. Move or
     delete them first." in an element with an id that the inputs reference via `aria-describedby`.
   - The form is mounted with `key={`${w}x${h}`}`, so undo and save reset the inputs with no effect hook.
5. **Canvas (`EditorCanvas.tsx`).**
   - `hover` is a `useState<Point | null>`. `onMouseMove` → `canvasTile` with `effective` zoom, the same code as the
     click (consult risk: clamped zoom). State is set only when x or y changes. `onMouseLeave` → null.
   - Armed click: tile null → nothing. Otherwise `onPlace(tile.x, tile.y)`. Unarmed click: unchanged.
   - Ghost: `useMemo(() => placementPreview(draft, tool, hover), [draft, tool, hover])`, drawn as a
     `pointer-events-none` absolute div at `(x*TILE - bounds.x)*effective`, sized `w*TILE*effective`.
     - ok: `border-2 border-primary bg-primary/20`.
     - refused: `border-2 border-dashed border-error bg-error/20`, so the state is not shown by colour alone.
   - The click layer gets `cursor-crosshair` while armed. The layer stays `aria-hidden`, because the PlacePanel is
     the accessible path.
6. **Container (`LayoutEditor.tsx`).**
   - Dispatch the new actions. `resizeRefused = notice?.kind === "refused" && notice.code === "resize_cut"`.
   - Root `onKeyDown`: if `escDisarms(e.key, { armed: state.tool !== null, dialogOpen: guard.pending !== null,
     defaultPrevented: e.defaultPrevented })` → dispatch `disarm`.
   - The right column is a `flex flex-col gap-4` wrapper with `PlacePanel`, `Palette` and `EditorInspector`, in that
     order. `fixturePalette()` is memoised once, at module level.
7. **Copy (D36, `roomlayout.ts`).**
   - `refused.fixture_limit`: "This room already has the most fixtures it can hold."
   - `refused.resize_cut`: the size-specific text above.
   - `done.placed`: "Placed."; `done.resized`: "Room size changed."
   - `palette.groups`: Cabinets, Stairs and lifts (circulation), Doors, Labels, Lamps, Markers, Partitions, Plants,
     Props, Racks, Shelves, Sofas, Tables, Walls, Whiteboards, Windows.
   - Labels for the panel, the tray button and the size form.
   - Seat codes are data and are shown as is.
8. **Rules.**
   - R1: `place-tool.ts` and `palette.ts` import `@/lib/**` only. The UI imports ui and lib. `check:layers` enforces
     this.
   - R3 and R6/R7: no config or server change.
   - R4: only the files above.
   - R5: tests as listed.
   - Domain focus:
     - diacritics: the tray button and tray-tool tests use "Phòng-A-03"
     - empty fields: an empty tray hides the tray section, there is no tool, empty X/Y input
     - bounds: sizes 1 and 64, limit − 1 and the limit, placing at an off-room tile
9. **Checks** (in bash, `eval "$(fnm env --shell bash)"` first): `pnpm format:check`,
   `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. `pnpm test:db` is CI-only and not affected.

## Specialist input used
- consult-frontend-developer.md:
  - Rec 1 (reducer actions, `frozen` guard, select the new item, keys `f:${nextKey}` / `s:${id}`, `fixture_limit`
    code): adopted. The limit check goes in the new pure `tryPlace`, not in `draft.ts`, which keeps the SIM-015.2 core
    unchanged and is just as testable.
  - Rec 2 (palette excludes seat sprites, grouped, `aria-pressed`): adopted, plus a reducer-side guard (A2).
  - Rec 3 (tool type, Esc, canvas `tool` + `onPlace`, clear a stale tray tool): adopted. The tool lives in
    `EditorState` rather than `useState`, so undo, save and refusals stay in tested pure code. Its open question 1
    (stamp or one-shot): stamp for fixtures, auto-advance for tray seats (A3).
  - Rec 4 (outline ghost, dry-run tint, `effective` zoom): adopted.
  - Rec 5 (rotation 0, then Rotate): adopted. The placed item is selected, so Rotate is ready at once.
  - Rec 6 (keyboard path): adopted as the PlacePanel X/Y form and tray buttons (A6).
  - Rec 7 (resize on Apply, labels, `aria-describedby`, reset on draft change): adopted. The reset uses a `key` on the
    form instead of an effect.
  - Rec 8 (Save unblock needs no extra code, test the flag flip): adopted. `planSave` (save-plan.ts:30-37) only checks
    `tray.length`.
  - Rec 9 (tests): adopted.
  - Open question 2 (tray seats as `desk.single`): yes, per D59 and the core.
  - Open question 4 (dedicated resize message): yes (`resize_cut`).
- consult-ux-architect.md:
  - Rec 1 (arming clears the selection; the tool survives selection and refusals; Esc scoped to the editor wrapper,
    not while the dialog is open; stamp mode with "Done placing"): adopted. The tool is cleared by save, because the
    editor re-inits from the view (A3).
  - Rec 2 (palette at the top of the aside, `<h3>` per group, toggle to disarm, armed status line, scroll area):
    adopted. Thumbnails are not included (A7).
  - Rec 3 (tray rows as Place buttons, auto-arm the next seat): adopted.
  - Rec 4 (ghost with tint, `pointer-events-none`, crosshair, memoise per tile): adopted. The hover state changes only
    when the tile changes, and the preview is memoised on it.
  - Rec 5 (X/Y + Place keyboard path, results in the status line): adopted.
  - Rec 6 (fixture limit copy, palette not disabled at the limit): adopted. The count in the message is left out, to
    keep the copy a plain string.
  - Rec 7 (size form, strict parse, size-specific refusal message, no-op on the same size, one undo step): adopted.
    Naming the first item that blocks the resize is left out (follow-up if wanted).
  - Rec 8 (disabled states): adopted.
  - Rec 9 (tests): adopted.
  - Risk "key collision after delete and place": not possible, because `nextKey` only grows (Approach step 2).
  - Open question on clip-floor preview: no (core clips).

## Assumptions
Defaults for Ming to approve with the plan.

- **A1 Tool state in the reducer.** `EditorState.tool` keeps undo, save and refusal behaviour in pure, tested code.
  Zoom stays in `useState`.
- **A2 Palette is fixtures only until SIM-015.8.** `desk.single` is not shown, and `tryPlace` refuses seat sprites.
  SIM-015.8 adds the desk entry together with its DELETE/POST save sequence. Placing a seat sprite today would leave
  Save blocked with `pending_seats`.
- **A3 Tool lifetime.**
  - A fixture tool stays armed after each place (stamp mode) until Esc, "Done placing", or a second click on its
    palette entry.
  - A tray tool advances to the next tray seat (in tray order) and disarms when the tray is empty.
  - A refused place keeps the tool. Save clears it.
- **A4 Fixture limit is editor-local.** It uses a new notice code `fixture_limit` (like `seat_delete`), not a new
  `LayoutRuleCode`. The server already rejects an oversized payload (400 via `validateLayoutSave`), and the
  `savePayload` pre-check from SIM-015.7 stays as a second guard.
- **A5 Palette labels.** Entry labels reuse `itemName` ("plant large", "cabinet filing"). Group headings are new copy.
  Hand-written per-sprite names wait for the real art (SIM-033), because the registry keys are placeholders for some
  sprites.
- **A6 Keyboard placing.** The PlacePanel gives an X/Y + Place form while a tool is armed, and tray rows are buttons.
  Arrow-key ghost moving is SIM-015.10.
- **A7 Ghost and palette visuals.** The ghost is a tinted outline box, not the sprite. There are no atlas thumbnails
  in the palette. Both can come with SIM-033 art.
- **A8 Rotation.** New fixtures and tray seats are placed at rotation 0. The Rotate button turns them afterwards, and
  the new item is selected so Rotate is ready. There is no rotation picker.
- **A9 Resize.**
  - It is applied on "Apply size" (or Enter), not on each keystroke.
  - A shrink that would cut off any item is refused as a whole, with the inline message. The editor does not say
    which item blocks it.
  - Floors are stretched or clipped by the core (SIM-015.2).
  - A size up to 64×64 is allowed. If the larger canvas exceeds the zoom budget, the existing "zoom limited" or "too
    large" states apply (SIM-015.7 A14).
- **A10 Esc scope.** Esc is handled on the editor root, so it works when focus is inside the editor: the canvas
  region is focusable and is focused by a click. It is ignored while the leave dialog is open or when another handler
  already called `preventDefault`.
- **A11 Off-room click.** A click outside the room while armed does nothing (no notice).
- **A12 Drag-to-place** (LAY-05 "click/drag to place") is SIM-015.10 with the other pointer work (ticket "Out of
  scope").
- **A13 Size fallback.** If the diff grows past about 550 source lines, cut the room resize (form, `resize` action,
  copy) into SIM-015.11. Palette and tray placement stay here. The default is one slice.
- **A14 Hotspots.** No other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on `work/backlog.md`, so no rebase is
  expected. SIM-015.10 and SIM-015.8 will edit `editor-state.ts`, `EditorCanvas.tsx`, `LayoutEditor.tsx`,
  `EditorInspector.tsx`, `Palette.tsx` and `copy/roomlayout.ts` after this ticket. Run them after it merges.

## Blocking questions
None.

## Split proposal
None. This is already slice 2b of the SIM-015.7 split. A13 gives the fallback cut (room resize → SIM-015.11) if the
size guide is exceeded.
