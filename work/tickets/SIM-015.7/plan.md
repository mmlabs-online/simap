Status: READY

# Plan: SIM-015.7: Layout editor UI and save of placement (slice 2a: editor shell, edit, save, guard)

The ticket's scope (move, rotate, delete, tray placement, resize, palette placement, drag, marquee, zoom, keyboard,
save, leave guard, conflicts, access) is about 1,500 source lines of UI. That is far past one implement/review cycle,
and the SIM-015.2 plan warned that the editor is the ticket most likely to need rework. This plan covers **slice 2a
only**. Slice 2a has everything the ticket's four acceptance criteria need: the page and its access states, the
editor state, the canvas with click selection, the Inspector, Save, conflict handling and the leave guard. Placing
items (palette and tray), resizing the room, and the pointer/keyboard polish move to the proposed SIM-015.9 and
SIM-015.10 (see `## Split proposal`). Ming approves the defaults A1 to A16 with the plan (P1 gate). None of them
blocks.

## Scope summary
Scope sources quoted (the spec wins over the ticket, CLAUDE.md "Scope"):

- spec `docs/spec-v1.md` LAY-01 (l.338-340): "A room has a size in tiles (width × height). An Admin opens the room's
  editor, places items on whole tiles and saves. Positions survive reloads and sessions."
- LAY-03 (l.349-351): "An Admin adds, moves, rotates and deletes fixtures from the sprite palette ... They are saved
  with the room." This slice covers move, rotate and delete. Add (palette) is SIM-015.9.
- LAY-05 (l.353-355): "Sprite palette, click/drag to place, rotate (R), delete, multi-select and move a group by whole
  tiles, zoom 2×/3×/4× and pan, undo of the last steps before save. All of this is saved in one layout save. Desktop
  only." This slice covers: rotate, delete, multi-select (shift-click), group move by whole tiles (buttons), zoom and
  pan, undo, one save, and desktop only. Palette and click-to-place are SIM-015.9. Drag, marquee and the R key are
  SIM-015.10.
- `work/decisions.md`:
  - D43: "The editor places items on whole ... tiles, 4 rotations, fixed sprite sizes; a room has a size in tiles."
  - D48: "Tile size 32 px".
  - D59: "seats use `desk.single`; the implied chair tile must be valid; ... a stale save gets 409".
  - D58: "until then the committed atlas stays placeholder-only".
  - D36: "all user-facing text lives in copy files".
  - D52: "the layout editor's chrome" uses "the clean UI kit without pixel art".
  - D2: "Vitest. First phase has light unit tests only (no e2e ...)".
- SIM-015.2 `plan.md` (approved 2026-11-23). Binding assumptions:
  - A5: "Save is disabled until every tray seat is placed or deleted".
  - A6: "When the GET has `truncated: true` ... the editor opens read-only with a message".
  - A8: room size and floors pass through.
  - A9: leave guard on `beforeunload`, "a capture-phase click guard on same-origin `<a>` links", and "the editor's own
    Back and Cancel controls". "The browser Back button ... is not intercepted".
  - A10: "a 'not allowed' state to tiers below admin (`canManageSeats`) ... an admin-only 'Edit layout' link in the
    room page's map card (`RoomMapSection`), using `roomEditorHref`".
  - A11: controls.
  - A12: palette.
  - A13: "On 409 `layout_stale` or `layout_seats_changed`, the editor shows the existing copy
    (`src/ui/copy/api.ts:30-31`) with a Reload action. It never merges or retries silently."
- SIM-015.2 `review.md` follow-ups:
  - "`checkLayoutRules` does not enforce the count caps ... Slice 2/3 should refuse the place or validate the payload
    before the PUT." This plan validates the whole payload with `validateLayoutSave` before the PUT. The place-time
    refusal comes with placement in SIM-015.9.
  - "After `assignCreatedSeats`, new desk keys change ... selection state must be remapped or cleared after Save."
    This plan clears the selection on every successful save.
  - Nits: "`deleteItems` with an empty selection and `moveItems` with `(0, 0)` ... a naive caller would commit a
    no-op undo step." The reducer skips these. "`placeFromTray` with an id that is not in the tray returns
    `layout_unknown_sprite`." Not used in this slice.
- Ticket "Out of scope": placing new desks and deleting desks (SIM-015.8), floor painting, floor-plan background (D20).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Positions and rotations survive a reload after save. Save sends one PUT with `baseVersion` = the loaded `version` and the moved or rotated placements. The PUT response becomes the new baseline and version, so a second save in the same session is not stale. | `seats-api.test.ts` › "saveLayout PUTs the JSON body and maps the response with its version"; `editor-state.test.ts` › "move and rotate then savePayload carries the new placements and baseVersion", "saveDone resets baseline, history, selection and version from the response"; `map-view.test.ts` › "toMapView keeps version". A real reload is under Ming verification. |
| 2 | Leaving with unsaved changes asks for confirmation. This covers tab close and reload (`beforeunload`), same-origin in-app links (capture-phase guard), and the editor's own Back control (confirm dialog). There is no prompt when the draft is clean or after a successful save. Browser Back is not intercepted (A9). | `leave-guard.test.ts` (all cases listed under Tests); `LayoutEditorViews.test.tsx` › "leave dialog renders Stay and Leave" |
| 3 | Non-admins cannot use the editor. They get a "not allowed" state and the layout is never fetched. The "Edit layout" link shows for admins only. Truncated rooms open read-only with no Save. | `editor-page.test.ts` › "editorGate …"; `LayoutEditorViews.test.tsx` › "not allowed view", "truncated view has no Save"; `RoomMapSection.test.tsx` › "Edit layout link only with editHref" |
| 4 | A 409 `layout_stale` or `layout_seats_changed` shows the API copy with a Reload button. Reload refetches the layout and rebuilds the draft. Other failures map to Retry, access or fix states and never claim success. | `save-errors.test.ts` (every kind); `LayoutEditorViews.test.tsx` › "save error banner shows Reload for both 409 codes, Try again for unavailable, no button for a rule code" |
| 5 | Edit operations go through the core. Refusals show short inline copy and add no undo step. No-op moves and deletes add no step. Seats cannot be deleted in this slice (the button is disabled, with the reason shown). Undo restores the draft and drops selected keys that no longer exist. | `editor-state.test.ts` (listed below) |
| 6 | Save is blocked, with a visible reason, while the tray is not empty (A5), while the room is truncated (A6), and when the payload fails `validateLayoutSave` (count caps, review follow-up). In those cases no PUT is sent. | `editor-state.test.ts` › "savePayload refuses unplaced / invalid payload / pending seat changes"; `LayoutEditorViews.test.tsx` › "toolbar shows the Save block reason" |
| 7 | Clicking the canvas selects the topmost item under the pointer. Shift-click toggles. A click outside the room or on an empty tile clears the selection. Canvas coordinates account for `bounds` overhang and zoom. | `canvas-point.test.ts` |
| 8 | R1 layers and all checks are green. `RoomMap.test.tsx` stays green after the atlas hook is extracted. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` |

## Ming verification after merge
Ming runs these locally with `pnpm dev`, the dev token and a real DB. The reviewer has no Postgres or Identity here.
1. As admin, open a room with 20+ seats → "Edit layout". Move a seat and a fixture, rotate a seat and a door, delete a
   fixture, then Save. Reload the page: positions, rotations and the deletion are kept. The room page map matches.
2. Make a change, then try a nav-rail link, the editor's Back, and reload/close the tab. Each one asks first. After
   Save, none of them asks. Browser Back does not ask (A9, documented limit).
3. Open the same room in two tabs. Save in tab 1, then save in tab 2: tab 2 shows the stale message and Reload. Next,
   add a seat in the seat table and then save from the editor: tab shows "seats changed" and Reload.
4. As a user or manager, open `/rooms/<code>/edit`: tab shows "not allowed" and has no Edit link on the room page.
5. A 64×64 room opens and saves at zoom 2. With the placeholder atlas, 64 × 32 × 2 = 4096 px fits `MAX_CANVAS_AREA`
   exactly. If sprite overhang makes the map too large, the editor shows the "too large" state (A14). Report it, and
   it becomes a follow-up.
6. Below 1024 px wide, the page shows the "use a desktop" notice.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/sprites/map-view.ts` | Add `version: number` to `MapView` (l.4-14). `toMapView` (l.50-83) requires `isInt(body.version) && body.version >= 0` and copies it. | `baseVersion` for the PUT (ticket scope; consult FE finding 4). | No |
| `src/lib/sprites/map-view.test.ts` | Add `version` to fixtures, plus a test that version is kept and a missing version gives null. | R5 | No |
| `src/ui/seats/seats-api.ts` | Add `saveLayout(roomId, body: LayoutSaveValue)`: PUT `/api/rooms/{id}/layout`, JSON, result through `toMapView` (same as `layout`, l.68-76). | Ticket scope | No |
| `src/ui/seats/seats-api.test.ts` | Add `version` to the layout fixture (l. with `saved: true`), plus saveLayout tests. | R5 | No |
| `src/ui/roomlayout/RoomMapSection.test.tsx` | Add `version: 1` to `view()` (l.8-22), plus Edit link tests. | Type change, AC3 | No |
| `src/ui/roomlayout/RoomMapSection.tsx` | Add an optional prop `editHref?: string`. When set and `!view?.truncated`, render a `next/link` "Edit layout" in the header (l.50-53), also for an empty map. | A10 | No |
| `src/ui/seats/SeatsPage.tsx` | Pass `editHref={canManageSeats(tier) ? roomEditorHref(roomCode) : undefined}` to `RoomMapSection` (l.180). | A10 | No |
| `src/lib/layout-editor/editor-state.ts` (new) | Pure reducer `editorReducer`, `initEditor(view)`, `editorFlags(state)`, `savePayload(state)` (Approach step 2). | Core wiring, AC1, AC5, AC6 | No |
| `src/lib/layout-editor/save-errors.ts` (new) | `saveErrorKind(code)` → `conflict \| access \| gone \| invalid \| retry`. | AC4 | No |
| `src/lib/layout-editor/canvas-point.ts` (new) | `canvasTile(offset, bounds, zoom, w, h): Point \| null` (unclamped: null outside the room). | AC7 | No |
| `src/ui/roomlayout/editor-page.ts` (new) | Pure `editorGate({tier, isDesktop, resolution, load})` → `checking \| desktop \| not_allowed \| loading \| missing \| error \| read_only \| ready` (the too-large canvas state stays in `EditorCanvas`). | AC3, LAY-05 desktop | No |
| `src/ui/roomlayout/leave-guard.ts` (new) | `leaveHref(event, location)`, `onBeforeUnload(e)`, `attachLeaveGuard(win, doc, onLink)` → detach. DOM types only, no React. | AC2 | No |
| `src/ui/roomlayout/useLeaveGuard.ts` (new) | Hook: attaches while `dirty`. Returns `{pending, request(href), leave(), stay(), disarm()}`. `leave()` detaches, then `router.push`. | AC2 | No |
| `src/ui/roomlayout/useAtlas.ts` (new) | `useAtlas(): {atlas, failed}`, moved verbatim from `RoomMap.tsx:42-58`. | Shared by RoomMap and the editor (consult FE risk "duplicating RoomMap") | No |
| `src/ui/roomlayout/RoomMap.tsx` | Use `useAtlas()` and drop the moved code. No behaviour change. | Same | No |
| `src/ui/roomlayout/EditorCanvas.tsx` (new) | Paints `draftToRoomLayout(present)` with `buildDrawList` and `paintRoom`, using `{}` seat views (no occupancy). Adds a transparent click layer (`canvasTile` + `itemAt`) and DOM outlines for selected items. Handles the too-large state with `allowedZooms` and `clampZoom`. | AC7, zoom/pan | No |
| `src/ui/roomlayout/EditorInspector.tsx` (new) | Selection summary. Rotate, Delete (disabled for seats, with the reason), and move buttons ↑↓←→. Room size read-out. Tray count and list (read-only in this slice). "Items" list of buttons (`aria-pressed`) in reading order, as the keyboard path to select. | LAY-05, A11 (keyboard reachability) | No |
| `src/ui/roomlayout/EditorToolbar.tsx` (new) | Back, Undo, `ZoomControl`, the "Unsaved changes" indicator, Save (`aria-busy` while saving), and the Save block reason line. | LAY-05, AC6 | No |
| `src/ui/roomlayout/EditorViews.tsx` (new) | Presentational views: gate states (not allowed, desktop notice, read-only truncated, missing, error), `SaveErrorBanner`, `LeaveDialog` (on `EntityFormDialog`, cancel "Stay", submit "Leave"), and the live status line. | AC2 to AC4, testable with `renderToStaticMarkup` | No |
| `src/ui/roomlayout/LayoutEditor.tsx` (new) | Client container: `useReducer(editorReducer, view, initEditor)`. Runs the save flow (`savePayload` → `seatsApi.saveLayout` → `saveDone`/`saveFailed`). Wires `useLeaveGuard(dirty)`, Reload and zoom. | Ticket scope | No |
| `src/ui/roomlayout/LayoutEditorPage.tsx` (new) | `"use client"`. Reads the session tier and the desktop media query, then `editorGate`. Only for admins: `useRooms` + `resolveRoom` → `useRoomLayout`. Mounts `LayoutEditor` with a key that changes on each loaded view. | AC3, A6 | No |
| `src/ui/roomlayout/index.ts` | Export `LayoutEditorPage`. | Page import via `@/ui` | No |
| `src/ui/index.ts` | Re-export `LayoutEditorPage` (as `SeatsPage` is). | Same | No |
| `src/app/(app)/rooms/[roomCode]/edit/page.tsx` | Replace the `PageSkeleton` stub: `await params` and render `<LayoutEditorPage key={roomCode} roomCode={roomCode} />` (same pattern as `rooms/[roomCode]/page.tsx:3-10`). | Ticket scope | No |
| `src/ui/copy/roomlayout.ts` | Add an `editor` block: labels, gate states, refusal short texts per `LayoutRuleCode`, the seat-delete reason, Save block reasons, leave dialog, conflict note ("Your unsaved changes will be discarded"), "Saved", `itemName(item)`, and announcements. | D36 | No |
| Tests (new): `editor-state.test.ts`, `save-errors.test.ts`, `canvas-point.test.ts` in `src/lib/layout-editor/`; `editor-page.test.ts`, `leave-guard.test.ts`, `LayoutEditorViews.test.tsx` in `src/ui/roomlayout/` | See Tests | R5 | No |

No file matches a High path. Expected size: about 750 to 850 source lines (much of it JSX), plus tests. That is above
the ~400 guide. Each piece left in is needed by one of the four ticket criteria. Everything that is not needed is
split out (see `## Split proposal`; A1 offers a smaller cut).

## Data model / migration
None.

## API contract
No endpoint changes. The client starts calling the existing PUT:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | `/api/rooms/{id}/layout` (`src/app/api/rooms/[id]/layout/route.ts:27-42`) | `LayoutSaveValue` from `buildSavePayload`, exact keys | 200 `LayoutResponse`, with the new `version` (`src/server/layout/save.ts:117-142` re-reads the rows) | 400 `invalid_request`; 409 `layout_stale`, `layout_seats_changed`; 422 `layout_*`, `layout_too_many_seats`; 404; 401/403 from `withAuth` only | admin |

R7 note: 401/403 come only from `withAuth` before the save (route.ts:41), so `apiFetch`'s single resend (D7) cannot
repeat an applied PUT. A network failure after the server applied the save shows "Try again". The retry then gets a
409 `layout_stale` and offers Reload. This is accepted (A13: never merge).

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `map-view.test.ts` › "toMapView keeps version; a missing or negative version gives null" | AC1 |
| `seats-api.test.ts` › "saveLayout PUTs the JSON body to /api/rooms/{id}/layout and maps the response with its version" | AC1 |
| `seats-api.test.ts` › "saveLayout returns the error code for 409 layout_stale and fail('internal') for a bad body" | AC4 |
| `editor-state.test.ts` › "initEditor builds draft and baseline from the view, version as baseVersion, not dirty" | AC1 |
| `editor-state.test.ts` › "select replaces, additive select toggles, selectNone clears" | AC7 |
| `editor-state.test.ts` › "move by (1,0) commits one step; a refused move (edge, overlap) keeps the draft, adds no step and sets the refusal notice" | AC5 |
| `editor-state.test.ts` › "move or delete with an empty selection does nothing (no undo step)" | AC5, review nit |
| `editor-state.test.ts` › "rotate cycles a seat 0→90; rotate of only non-directional items is refused with layout_bad_rotation" | AC5 |
| `editor-state.test.ts` › "delete removes selected fixtures; a selection with a seat is refused with the seat reason and changes nothing" | AC5 |
| `editor-state.test.ts` › "undo restores the previous draft and drops selected keys that no longer exist" | AC5 |
| `editor-state.test.ts` › "move and rotate then savePayload carries the new placements and baseVersion, and passes validateLayoutSave" | AC1 |
| `editor-state.test.ts` › "savePayload refuses: unplaced (tray not empty), invalid payload (fixtures over LAYOUT_LIMITS.fixtures → no PUT), pending seat changes (removed or new desks present)" | AC6 |
| `editor-state.test.ts` › "saveDone resets baseline, history, selection and version from the response; dirty false" | AC1, review follow-up |
| `editor-state.test.ts` › "saveFailed keeps the draft and history and records the code; editing during error is allowed but Save stays off for a conflict" | AC4 |
| `editor-state.test.ts` › "editorFlags: dirty, canUndo, canSave and saveBlock reason for a truncated (read-only) view" | AC3, AC6 |
| `save-errors.test.ts` › "layout_stale and layout_seats_changed are conflict" | AC4 |
| `save-errors.test.ts` › "unauthenticated, forbidden, member_deactivated, org_required are access; not_found is gone" | AC4 |
| `save-errors.test.ts` › "layout_out_of_bounds, layout_overlap, layout_bad_rotation, layout_unknown_sprite, layout_too_many_seats, invalid_request are invalid; unavailable, internal and unknown codes are retry" | AC4 |
| `canvas-point.test.ts` › "maps an offset to a tile at zoom 2, 3, 4" | AC7 |
| `canvas-point.test.ts` › "adds negative bounds.x/y (sprite overhang) before converting" | AC7 |
| `canvas-point.test.ts` › "returns null left of / above / past the room" | AC7 |
| `editor-page.test.ts` › "editorGate: user and manager → not_allowed before any load; unknown desktop → checking; narrow → desktop; admin + loading/missing/error → those; truncated → read_only; else ready" | AC3, LAY-05 |
| `leave-guard.test.ts` › "onBeforeUnload calls preventDefault and sets returnValue" | AC2 |
| `leave-guard.test.ts` › "leaveHref returns the href of a same-origin <a> found via closest()" | AC2 |
| `leave-guard.test.ts` › "leaveHref ignores: non-left button, ctrl/meta/shift/alt click, defaultPrevented, target=_blank, download, other origin, same-page #hash, no anchor" | AC2 |
| `leave-guard.test.ts` › "attachLeaveGuard adds beforeunload on window and a capture-phase click on document; detach removes both" (fake targets recording listeners) | AC2 |
| `leave-guard.test.ts` › "the click listener prevents default, stops propagation and calls onLink(href) for a guarded link; leaves other clicks alone" | AC2 |
| `leave-guard.test.ts` › "leaveDecision(dirty, href): clean → go, dirty → ask" (used by Back and by `useLeaveGuard.request`) | AC2 |
| `LayoutEditorViews.test.tsx` › "not allowed view shows the copy and a link back to the room" | AC3 |
| `LayoutEditorViews.test.tsx` › "truncated read-only view shows the A6 message and no Save button" | AC3, A6 |
| `LayoutEditorViews.test.tsx` › "desktop notice shows the copy and a link to the room" | LAY-05 |
| `LayoutEditorViews.test.tsx` › "save error banner shows Reload for both 409 codes, Try again for unavailable, no button for a rule code; role=alert" | AC4 |
| `LayoutEditorViews.test.tsx` › "leave dialog renders Stay and Leave" | AC2 |
| `LayoutEditorViews.test.tsx` › "toolbar shows the Save block reason, the dirty indicator, disabled Undo when canUndo is false" (render `EditorToolbar`) | AC6 |
| `LayoutEditorViews.test.tsx` › "inspector disables Delete for a seat with the reason via aria-describedby; Items list names a seat with a diacritic code (Phòng-A-01)" | AC5, domain focus |
| `RoomMapSection.test.tsx` › "Edit layout link only with editHref, also on an empty map, hidden when truncated" | AC3 |

## Approach
1. **`version` and `saveLayout`.** Add `version` in `map-view.ts`, and update the fixtures that `pnpm typecheck` flags.
   `saveLayout` reuses `call`, uses `{method:"PUT", headers: content-type json, body: JSON.stringify(body)}`, and reads
   the response through `toMapView`.
2. **Editor state (pure, `src/lib/layout-editor/editor-state.ts`).**
   ```ts
   type EditorState = {
     history: History; baseline: Draft; baseVersion: number; readOnly: boolean;
     selection: string[];
     notice: { kind: "refused"; code: LayoutRuleCode | "seat_delete" } | { kind: "done"; what: "moved" | "rotated" | "deleted" | "undone" | "saved" } | null;
     save: { status: "idle" | "saving" } | { status: "error"; code: string };
   };
   type EditorAction =
     | { type: "select"; key: string; additive: boolean } | { type: "selectNone" }
     | { type: "move"; dx: number; dy: number } | { type: "rotate" } | { type: "delete" } | { type: "undo" }
     | { type: "saveStart" } | { type: "saveDone"; view: MapView } | { type: "saveFailed"; code: string };
   ```
   - `initEditor(view)` = `draftFromLayout(view.layout, view.unplaced)` as both baseline and present,
     `baseVersion = view.version`, `readOnly = view.truncated`.
   - Every edit calls the core op. `ok` → `commit` and a `done` notice. Refused → keep state and set a `refused`
     notice. An empty selection or `(0,0)` → state unchanged. `delete` with any seat in the selection → `seat_delete`
     notice (desk delete is SIM-015.8). All edits are ignored while `readOnly` or `saving`.
   - `undo` filters `selection` to keys present in the restored draft.
   - `saveDone(view)` re-inits from the view: new baseline, `startHistory`, `baseVersion = view.version`, empty
     selection (review follow-up), `saved` notice.
   - `editorFlags` returns `dirty = isDirty(baseline, present)`, `canUndo`, `canSave` (dirty, not readOnly, not
     saving, no conflict error, `savePayload` ok) and `saveBlock` (`unplaced | read_only | invalid | null`).
   - `savePayload(state)`:
     1. `planSave` refuses `unplaced`.
     2. Non-empty `deletes` or `createKeys` → `pending_seats` (cannot happen until SIM-015.8, which replaces this
        branch with the A3 sequence).
     3. `buildSavePayload(present, baseVersion)`.
     4. `validateLayoutSave(value)`. A failure → `invalid` with its code (count caps, floor-cell cap).
3. **Errors (`save-errors.ts`).** The kind table is in Tests. The banner text is `apiErrorMessage(code)`
   (`copy/api.ts:37`), which already has the layout codes (l.26-32). Conflict adds the editor's "Your unsaved changes
   will be discarded" note and a Reload button. Retry re-runs Save. Access and gone show the message plus a link to
   the room or `/rooms`.
4. **Canvas (`EditorCanvas`).**
   - Uses `useAtlas()`, which is extracted from `RoomMap` with no behaviour change.
   - `list = buildDrawList(draftToRoomLayout(present), {}, atlas.manifest)` is memoised on `present`.
   - Paints with `paintRoom` at `clampZoom(zoom, allowedZooms(list.bounds))`. Null → `RoomMapStatus status="tooLarge"`.
   - Inside the same scroll region markup as `RoomMap.tsx:89-104`: a canvas, then an absolutely positioned click
     layer (`div`, `aria-hidden`, since the Inspector Items list is the accessible path).
   - `onClick`: offset = `clientX - rect.left` (rect of the inner relative div, which is scroll-safe), then
     `canvasTile`. Null → `selectNone`. Otherwise `itemAt(present, x, y)`: null → `selectNone`, else
     `select(key, e.shiftKey)`.
   - Selected items get an outline `div` at `(x*TILE - bounds.x)*zoom` with footprint size from `footprintCells`.
     The outline uses a solid border plus a dashed inner line (not colour alone). There is no animation.
5. **Inspector and toolbar.**
   - The Inspector shows the selection count and, for a single item, its name, x, y and rotation.
   - Buttons: Rotate, Delete (`disabled` + `aria-describedby` reason when a seat is selected), and ↑ ↓ ← → (each
     click = one undo step; no coalescing, A12).
   - Room size w × h is read-only (resize is SIM-015.9). The tray count and list are read-only, with the A5 reason.
   - The Items list holds one button per item in reading order (`seatOrder`-style y, x, key), labelled via
     `itemName`: "Desk C302-01 at 4, 7" or "door at 0, 3". It is a scrollable `max-h` list.
   - The toolbar has Back (`roomDetailHref(code) ?? "/rooms"` through `useLeaveGuard.request`), Undo, `ZoomControl`
     (independent zoom, default 2, A13), the dirty indicator and Save.
   - Live region: one `role="status"` line for the notice (refusal short text, "Moved", "Saved" ...). Errors go to
     `role="alert"`.
6. **Leave guard (A9, `leave-guard.ts` + `useLeaveGuard`).**
   - While `dirty && !saving`: a `window` `beforeunload` listener (preventDefault + `returnValue = ""`) and a
     `document` click listener with `{capture: true}`. The capture phase runs before React's root listener, so it runs
     before `next/link`'s `onClick`. On a guarded link it calls `preventDefault` + `stopPropagation`, then
     `request(href)` → `LeaveDialog` opens.
   - Stay closes the dialog. Leave detaches first, then `router.push(href)`, so the guard does not catch its own
     navigation.
   - After `saveDone`, `dirty` is false and the effect detaches.
   - `leaveDecision` is shared with the Back button.
   - Browser Back is not intercepted. This goes in the PR text.
7. **Page (`LayoutEditorPage`).**
   - Outer component: `tier = useSession()?.tier` and `isDesktop` from a `useSyncExternalStore` media hook on
     `(min-width: 1024px)` (server snapshot `null` → `checking`).
   - It renders the gate views from `editorGate` before mounting any data hooks, so non-admins never fetch (A10). It
     also never mounts the editor on narrow screens, so no guard is registered there.
   - Inner admin component: `useRooms(roomsApi)` + `resolveRoom` (`seat-view.ts:36-41`; no seat list or detail
     fetch), then `useRoomLayout(seatsApi, roomId)`. `truncated` → read-only view (A6).
   - `LayoutEditor` is keyed on a counter bumped each time `state.view` changes identity, so Reload after a conflict
     rebuilds the draft. A `layout_seats_changed` reload can return the same `version`.
8. **Copy (D36).** Everything goes in `roomlayoutCopy.editor`. Seat codes are data and are shown as is (diacritics
   kept).
9. **Rules.**
   - R1: lib files import only `@/lib/**`. UI imports lib and ui. The page imports `@/ui` only. `check:layers`
     enforces this.
   - R3: no config.
   - R4: only the files above.
   - R5: tests as listed.
   - R6 and R7: no server change. The server enforces admin tier and org scope on the PUT.
   - Domain focus: diacritics (Items list test), empty fields (room with 0 fixtures, empty map still has the Edit link,
     empty selection no-ops), bounds (canvas edge null, 64×64 manual run).
10. **Checks** (in bash, `eval "$(fnm env --shell bash)"` first): `pnpm format:check`,
    `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`. `pnpm test:db` is CI-only and not affected.

## Specialist input used
- consult-frontend-developer.md:
  - Recommendation 1 (page / editor / canvas / Palette / Inspector / toolbar / banner structure, pure reducer,
    `key` remount on Reload, `editHref` prop instead of tier): adopted. The Palette moves to SIM-015.9.
  - Recommendation 2 (pointer state machine, drag, marquee, `setPointerCapture`): deferred to SIM-015.10. This slice
    uses click only.
  - Recommendation 3 (keyboard shortcuts): deferred to SIM-015.10. This slice gives keyboard access through
    Inspector buttons and the Items list, which meets WCAG 2.1.1 without shortcuts.
  - Recommendation 4 (save sequence, count-limit check before PUT, clear selection after save): adopted. The limit
    check reuses `validateLayoutSave` instead of a hand-written count check. DELETE/POST stay out (SIM-015.8).
  - Recommendation 5 (capture-phase link guard, `beforeunload`, injectable confirm, disarm after save): adopted. The
    confirm is the app's `EntityFormDialog` (answers its open question 1).
  - Recommendation 6 (pure error mapping): adopted as `saveErrorKind`.
  - Recommendation 7 (testing-library with jsdom): rejected. The repo has neither, and `vitest.config.ts:16` uses
    `environment: "node"`. Every UI test is `renderToStaticMarkup`. Adding them is a tooling change under D2 (A3).
    Pointer tests move with pointer work.
  - Risk "`bounds` may not start at 0,0": adopted (`canvasTile` subtracts `bounds`, `placement.ts:101-106`).
  - Risk "Stale seatViews": adopted (paint with `{}`).
  - Risk "`useRoomLayout` keeps the old view": handled by the keyed remount.
- consult-ux-architect.md:
  - Layout (toolbar / canvas / inspector, Save disabled with reason while the tray is not empty): adopted. The
    palette column comes in SIM-015.9.
  - Seat Delete disabled with the reason: adopted (its question 2: yes, disabled until SIM-015.8).
  - Short inline refusal copy, no history step on refusal, live region, non-colour outline, reduced motion: adopted.
  - Inspector Items list as the keyboard selection path: adopted.
  - Leave dialog Stay/Leave, disarm before post-save navigation: adopted.
  - Desktop gating that does not mount the editor: adopted, by width only (A11).
  - Conflict copy that says local edits are discarded: adopted.
  - Its question 3 (does the PUT return the new version): yes (`save.ts:140-142` returns `readLayoutRows`).
  - Its question 4 (stay or return after save): stay with "Saved" (A13).
  - Its question 6 (marquee): deferred to SIM-015.10. Shift-click multi-select is in this slice.
  - Its question 7 (floors pass through): yes (A8 of SIM-015.2; `draftToRoomLayout` paints them).
  - Ctrl+S, arrow coalescing, "Keyboard shortcuts" disclosure: SIM-015.10.
  - Risk "R7 resend after applied PUT": not possible, because 401/403 only come from `withAuth` before the save (see
    API contract).

## Assumptions
Defaults for Ming to approve with the plan.

- **A1 Split.** SIM-015.7 is cut to slice 2a (this plan). The orchestrator files SIM-015.9 (placement and resize) and
  SIM-015.10 (pointer and keyboard polish) after approval, and updates `ticket.md` scope text. If Ming prefers smaller
  PRs, a fallback cut moves the leave guard into its own ticket. The default keeps it here because it is ticket AC2.
- **A2 Dependency of SIM-015.8.** Desk add needs the palette, so SIM-015.8 should depend on SIM-015.9 as well as
  SIM-015.7 (board change by the orchestrator).
- **A3 Test tooling.** No jsdom or testing-library (D2, `vitest.config.ts` node env). The "component tests" for the
  guard and the error mapping are:
  - `renderToStaticMarkup` tests of the presentational views
  - unit tests of the guard's handlers and attach/detach, with fake event targets
  - unit tests of the pure error and gate functions

  This matches every existing UI test in the repo. Adding a DOM test environment would need Ming's decision.
- **A4 Seats in this slice.** Existing seats can be moved and rotated. They cannot be deleted (button disabled, with
  the reason "To remove a desk, delete its seat in the seat table."). `savePayload` refuses if seat deletes or creates
  are ever pending. SIM-015.8 replaces that branch.
- **A5 Tray.** Rooms with unplaced seats open normally. The tray list is visible but Save is disabled with "Place all
  seats before saving" until SIM-015.9 adds tray placement. This is a short-lived gap, accepted because placement and
  the palette share one mechanism.
- **A6 Room size.** Shown read-only. Resize UI is SIM-015.9.
- **A7 Truncated rooms (SIM-015.2 A6).** The editor shows the read-only message and a link back, without the canvas or
  Save. The "Edit layout" link is hidden for truncated rooms.
- **A8 Edit link placement.** The link is in the map card header (`RoomMapSection`) only. The unused `roomEditor` nav
  item with `placement: "room"` (`src/lib/nav.ts:35-41`) stays untouched.
- **A9 Leave confirm.** Uses the app dialog (`EntityFormDialog`), not `window.confirm`. `beforeunload` uses the
  browser's own prompt (the only option). Leave guard limits as in SIM-015.2 A9: browser Back and programmatic
  `router.push` from other code are not intercepted.
- **A10 Conflict UX.** The banner offers Reload, which discards local edits (the copy says so). There is no "keep
  editing and merge". Save stays disabled while a conflict is shown, but other edits are allowed so the user can note
  what they changed.
- **A11 Desktop only.** The gate checks `(min-width: 1024px)` only. There is no pointer-type check, so tablets in
  landscape get the editor.
- **A12 Undo granularity.** Each button press or click edit is one undo step (cap 50). Coalescing is reconsidered with
  arrow keys in SIM-015.10.
- **A13 Zoom and after-save.** The editor zoom is independent from the room page (default 2). After a successful
  save the editor stays open with a "Saved" status, and history is reset (undo past a save is not offered).
- **A14 Large rooms.** The editor uses the same canvas budget as the map. A 64×64 room fits only zoom 2 (4096 px,
  exactly `MAX_CANVAS_AREA`). If real art overhang (SIM-033) pushes bounds past it, the editor shows "too large". A
  follow-up then decides on a smaller zoom or tiling. With the placeholder atlas (D58) the manual 64×64 run is
  expected to fit.
- **A15 Item names.** Seats are named "Desk <code>". Fixtures use their sprite key with dots replaced by spaces
  (e.g. "cabinet filing"), produced by a copy function. Proper palette labels come with the palette (SIM-015.9) and
  can then replace it.
- **A16 Hotspots.** No other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on `work/backlog.md`, so no rebase is
  expected. SIM-015.8, 015.9 and 015.10 will edit `editor-state.ts`, `LayoutEditor.tsx`, `EditorInspector.tsx` and
  `copy/roomlayout.ts` after this one. Run them in that order.

## Blocking questions
None.

## Split proposal
The ticket's slice 2 is split again. SIM-015.8 (desk add/delete) is already filed.

1. **SIM-015.7, slice 2a (this plan): editor shell, edit, save, guard.**
   - Page, gates (not allowed, desktop, truncated, missing, error), Edit link.
   - `version` and `saveLayout`, pure editor state.
   - Canvas paint with click and shift-click select and outlines.
   - Inspector: move buttons, rotate, delete fixtures, Items list, read-only tray and size.
   - Toolbar: Back, Undo, Zoom, Save.
   - Save with the pre-PUT check, conflict and Reload, leave guard.
   - Verifies all four ticket criteria.
2. **SIM-015.9, slice 2b (proposed): palette, tray placement and room resize.**
   - `Palette` from `paletteEntries()` with labels.
   - Armed tool + click a tile → `placeItem` / `placeFromTray`, Esc to disarm, ghost on hover.
   - Place-time refusal when fixtures reach `LAYOUT_LIMITS.fixtures` (review follow-up).
   - Room size inputs → `resizeRoom`.
   - Unblocks Save for rooms with unplaced seats (A5).
   - Covers LAY-03 "adds" and LAY-01 room size.
   - Size S/M.
3. **SIM-015.10, slice 2c (proposed): pointer and keyboard polish.**
   - Pointer drag-move with whole-tile ghost preview (one commit on pointerup, rAF throttle).
   - Marquee multi-select (`itemsInRect`), `setPointerCapture`, `touch-action` only while dragging.
   - Keyboard shortcuts R, Delete/Backspace, Ctrl/Cmd+Z, arrows, Esc, Ctrl+S, with a visible shortcut list and
     arrow coalescing.
   - Covers LAY-05 "click/drag", "rotate (R)", "multi-select" by rectangle.
   - Size M.
4. **SIM-015.8 (filed): desk add and delete.** Depends on SIM-015.7 and SIM-015.9 (A2). Replaces the
   `pending_seats` branch with the DELETE → POST → PUT sequence (SIM-015.2 A3).

This plan covers slice 2a only.
