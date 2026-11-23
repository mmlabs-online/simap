Consult report for SIM-015.7 (editor UI, save, leave guard). I read the ticket, LAY-01/03/05, the core exports in src/lib/layout-editor, RoomMap.tsx, SeatOverlay.tsx, validate/layout.ts and copy/api.ts. I did not read RoomMapSection, the edit stub, the seatsApi code or SIM-015.2 plan.md in detail, so those points are inferred and marked below.

FINDINGS
- Core is ready. Operations return OpResult (`ok` or a LayoutRuleCode), and history has commit/undo with a 50-step limit. isDirty compares against a baseline. buildSavePayload refuses with `unplaced` (tray not empty) or `missing_seat_id`. planSave, assignCreatedSeats, forgetDeletedSeat and restoreRemovedSeat cover the delete-then-create-then-PUT order. tiles.ts has pointToTile, dragDelta, itemAt and itemsInRect.
- RoomMap is read-only: a canvas under an HTML overlay with one button per seat, plus a scroll region with tabIndex 0. The editor can reuse the paint pipeline and zoom controls, but the overlay needs a separate editor variant. It cannot reuse SeatOverlay, because that is seat-only, uses click for a dialog, and has no fixtures.
- Error copy already exists in copy/api.ts for all layout_* codes, including layout_stale and layout_seats_changed. Layout rule codes can therefore be shown from this copy, but a refused edit needs shorter inline wording (see below).
- Not in the core, so the UI must add them: count limits before PUT (LAYOUT_LIMITS: fixtures 2000, floors 64, seats SEAT_LIMITS.list). Key remap after save is handled by assignCreatedSeats, but only for new desks, which are SIM-015.8. In this slice, keys for existing seats stay `s:<id>`, so remapping is trivial. Clear the selection after a successful save anyway.

RECOMMENDATIONS
Layout (desktop grid, `lg:`):
- Top toolbar: Back/Cancel, Undo, Rotate, Delete, zoom 2x/3x/4x (reuse ZoomControl), room size inputs (w and h, 1 to 64, Apply), dirty indicator ("Unsaved changes"), Save.
- Left column is the palette: fixtures grouped by FIXTURE_GROUPS from paletteEntries(), each a toggle button showing the sprite thumbnail and name, with aria-pressed. Place mode is armed by choosing an entry. Esc disarms it.
- Centre is the canvas in the scroll region. Right column is the inspector for the selection: kind, sprite, code, x/y, rotation, and number inputs for x/y as a keyboard path to move. Below it sits the seat tray: a list of unplaced seats, each button arming "place seat <code>" (a tray seat with no position cannot be dragged, so arm it and click a tile). Show a tray count. Save is disabled while the tray is non-empty, with a reason line "Place all seats before saving" (planSave "unplaced").
- Keep the editor as `LayoutEditor` (state, with History in useReducer), plus presentational `Palette`, `Inspector`, `Tray`, `EditorCanvas` (pointer overlay). Keep pointer maths in lib via tiles.ts so it is unit-testable.

Flows:
- Select: click an item (itemAt), shift-click to toggle, drag a rectangle on empty tiles (itemsInRect). The selected-item highlight is drawn in a DOM overlay (outline), not only by colour.
- Move: pointer drag uses dragDelta. Show a ghost preview outline during the drag and commit one history step on pointer up. If the result is refused, snap back and give feedback. Arrow keys move the selection by 1 tile, each a commit. Consider coalescing repeated key presses into fewer undo steps, otherwise 50 steps run out fast. This is an open question.
- Rotate: R key or button (rotateItems). Delete: Delete/Backspace or button. Seats in this slice are not deletable, as desk delete is SIM-015.8, so disable Delete for seats and say why (tooltip and aria-describedby), rather than silently ignoring the key. Deleting a seat probably means deleteItems moves it to the tray or removed list, so confirm in the core what it does before wiring it.
- Place: arm an entry, then click a tile (placeItem or placeFromTray). Keep armed after placing so several can be placed, and disarm with Esc.
- Resize room: Apply calls resizeRoom. If it is refused (items out of bounds, layout_out_of_bounds), keep the old size and show the message inline.
- Undo: Ctrl/Cmd+Z and button. Do not offer redo, because the core has no redo. Do not take Ctrl+Z while a text input has focus.
- Save: build the payload (check count limits first), then PUT. While saving, disable inputs and set aria-busy. On success, set baseline = draft, bump baseVersion from the response (confirm the response carries the new version, which I did not verify), clear the selection, and reset history, since undo past a save is confusing. Show a polite "Saved" status.
- Conflicts: 409 layout_stale or layout_seats_changed gives a blocking alert with a single Reload button, which refetches and rebuilds the draft. Discarding local edits is acceptable here because A13 says never merge. Offer "Keep editing" only if the tray stays untouched. Other 4xx/5xx show an inline alert with the api.ts message and Retry. Never claim success on failure.
- Leave guard: beforeunload while dirty. For in-app links, intercept clicks on anchors under the app shell (capture-phase click listener on document, or a wrapper around next/link) and show a confirm dialog "Discard changes?" with Stay and Leave. The editor's own Back/Cancel use the same dialog. Browser Back is explicitly not intercepted (A9). Mark the dialog focus trap and restore focus to the trigger. Remove the guard after a successful save and before the post-save navigation, or the guard fires on its own redirect.

Feedback for refused operations:
- A refusal is `{ok:false, code}`. Map code to short inline text in copy/roomlayout.ts (D36), for example layout_overlap: "That tile is taken", layout_out_of_bounds: "That's outside the room". Show it in an aria-live="polite" status line under the toolbar (role="status"), auto-clearing after a few seconds, and also flash the red ghost at the target tile during drags. Do not rely on colour alone, and do not reuse the long api.ts strings for these.
- Do not add a history step on refusal.

Keyboard and a11y:
- The canvas region has a roving "cursor" tile or keeps a list of items as buttons (a hidden or visible "Items" list in the inspector) so every item is reachable without a pointer. A simple approach is a listbox of items in the inspector (reading order, label "desk C302 at 4,7"). Selecting there is equivalent to clicking. Placement by keyboard: arm, then use the x/y inputs plus Enter, or arrow keys to move a cursor tile and Enter to place.
- Shortcuts: R, Delete, Ctrl+Z, Esc, arrows, Ctrl+S (preventDefault, same as Save). Document them in a visible "Keyboard shortcuts" disclosure. Do not trigger shortcuts in inputs or when a dialog is open.
- Announce operations in the live region ("Moved C302 to 4,7", "Rotated to 90", "Undid last change"). All controls need visible focus (reuse the ring-primary style in RoomMap).
- Respect prefers-reduced-motion (no animated ghost).

Desktop-only (LAY-05):
- Below `lg` (1024 px), the page renders a notice instead of the editor: "The layout editor needs a larger screen. Open it on a desktop." with a link back to the room. Choose between CSS only (`hidden lg:block` / `lg:hidden`) or a matchMedia hook. CSS-only is simpler and testable, but the component still mounts and registers the leave guard, so prefer not mounting the editor (matchMedia hook, or SSR-safe default) so a dirty-less mobile page cannot trigger it. Also touch-only devices with a wide viewport (tablets) are not covered by a width check. Decide whether to also test `(pointer: fine)`.

Access and truncated rooms:
- Non-admins get a "not allowed" state before any editor load (A10); do not fetch layout for them. Admin-only "Edit layout" link in RoomMapSection. Truncated rooms (A6) show a read-only notice with a link back, no Save.
- Route-level: 401/403 handled by the existing auth wrapper pattern; keep the editor's load error distinct (loading / error / not allowed / truncated / desktop notice).

Tests (acceptance: leave guard and error mapping):
- Leave guard: dirty then beforeunload is prevented; clean then not; link click while dirty opens the dialog, Stay keeps the page, Leave navigates; the guard is removed after save.
- Error mapping: a pure function `mapSaveError(status, code)` returning kind `reload | retry | fix` plus copy key, covering layout_stale, layout_seats_changed, layout_too_many_seats, layout_out_of_bounds / overlap, network failure and 401/403. Test it as pure lib code, with one component test that the Reload button appears for both 409 codes.
- Pointer maths and the refusal-to-copy map should also be pure and tested.

RISKS
- The leave guard on in-app links is the hardest piece. Next's App Router has no official navigation-blocking API, so capturing anchor clicks misses router.push calls made in code (R1 allows these in pages). The ticket scope accepts this for links and Back/Cancel only, but state the limit in the handoff.
- seatsApi.saveLayout and the `version` added to MapView: confirm toMapView and every consumer and test fixture are updated, and that the PUT's new version is returned or refetched. Otherwise a second save in the same session hits layout_stale against itself.
- R7: a 401/403 coming back after the PUT has applied could cause apiFetch to re-send once. Confirm the PUT is idempotent by baseVersion (the repeat should produce a 409 layout_stale, which would mislead the user into a false conflict after a real success). Handle by refetching on a 409 right after our own save, or flagging this to Ming.
- Pointer overlay over a scaled canvas inside a scroll container: pointer coordinates must subtract the scroll offset and region bounds (use getBoundingClientRect on the inner div, not the scroll region). Use setPointerCapture so a drag does not stick when leaving the region.
- Large rooms (64x64 at 4x = 1024 px, more with 2000 fixtures): rebuilding the draw list on every pointer move is expensive. Paint from the committed draft only and draw the drag preview as a cheap DOM overlay, committing once on pointer up.
- 50-step undo and arrow-key moves can silently push out earlier history (see coalescing question).
- Reload after a conflict discards edits. This is acceptable by A13 but must be said plainly in the dialog.

OPEN QUESTIONS
1. Arrow-key moves: coalesce consecutive presses on the same selection into one undo step, or one step each?
2. Can an existing seat be removed to the tray in this slice (is deleteItems on a seat allowed and tray-producing), or disabled until SIM-015.8? Spec LAY-02 says removing a desk deletes the seat under the SEA-01 guard, which is SIM-015.8 territory.
3. Does the PUT response return the new version and layout, or must the UI refetch?
4. After a successful save, stay in the editor (my default, with a "Saved" status) or return to /rooms/[code]?
5. Desktop-only gating: width only (1024 px) or also pointer type?
6. Is multi-select with drag-rectangle in this slice? LAY-05 lists it and itemsInRect exists, so I assume yes, and group move uses moveItems with all keys.
7. Floor zones appear in the draft but floor painting is out of scope. Confirm they render and survive moves and resize unchanged, and that resize refusal accounts for them.
