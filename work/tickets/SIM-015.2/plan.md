Status: READY

# Plan: SIM-015.2: Tile layout editor, slice 1 of 3 (pure editor core)

This plan replaces the ticket's free-form scope with D43 and the spec, as the ticket asks ("Re-scope its free-form text
against D43 at planning", D58/D59 note). The whole editor is larger than one implement/review cycle, so this plan
covers **slice 1 only**: the pure editor model in `src/lib/layout-editor/`, with unit tests. Slices 2 and 3 are under
`## Split proposal`. Approve the defaults under `## Assumptions` (A1 to A14) now, because slice 1 builds the save plan
that slices 2 and 3 use.

## Scope summary
Scope sources quoted (the spec wins over the ticket text, CLAUDE.md "Scope"):

- spec `docs/spec-v1.md` LAY "Visual style" (l.327-330): "The room view and the editor are **pixel-art, top-down, on a
  32 px tile grid** ... Sprites scale by whole numbers only (2×, 3×, 4× ...). No game engine or new library: DOM or
  plain canvas (stack unchanged)."
- LAY-01 (l.338-343): "A room has a size in tiles (width × height). An Admin opens the room's editor, places items on
  whole tiles and saves. Positions survive reloads and sessions." / "Items: seat desks (a desk sprite may cover several
  tiles), fixtures, and walls/floor. Rotation in 4 directions only; size is fixed by the sprite; no free resize." /
  "Items cannot overlap where the manifest says they block (e.g. two desks on one tile)."
- LAY-02 (l.345-347): "Each desk on the grid is one seat record. Placing a desk creates a seat and its code (ROO-02).
  Removing a desk deletes the seat, with the SEA-01 guard."
- LAY-03 (l.349-351): "An Admin adds, moves, rotates and deletes fixtures from the sprite palette: door, window, wall,
  stairs, elevator, server rack, cabinet, pillar, plant, blocked area, label. They are saved with the room."
- LAY-05 (l.353-355): "Sprite palette, click/drag to place, rotate (R), delete, multi-select and move a group by whole
  tiles, zoom 2×/3×/4× and pan, undo of the last steps before save. All of this is saved in one layout save. Desktop
  only."
- SEA-01 (l.231): "Deleting a seat that has an occupant or any device is refused with a clear message (seatMGT guard)."
- ROO-02 (l.222-224): "A new seat's code is `<room code>-<NN>` ... No API or form lets anyone type in a seat code."
- `work/decisions.md`: D43 "The editor places items on whole 16 px tiles, 4 rotations, fixed sprite sizes; a room has
  a size in tiles. Supersedes D20's free-form editor"; D48 "Tile size 32 px ...; editor logic unchanged (whole tiles, 4
  rotations). Supersedes '16 px' in D41/D43"; D59 "seats use `desk.single`; the implied chair tile must be valid ...;
  a stale save gets 409"; D58 "until then the committed atlas stays placeholder-only".
- Ticket "Change from Ming (D43)": "the editor places sprites on whole tiles, rotates in 4 directions, no resize, no
  free snap; palette of sprites from the manifest; multi-select moves by whole tiles; undo before save. Porting
  seatMGT's `LayoutEditor` is now reference only."
- Ticket "Out of scope": floor-plan background image (D20, later). Still out of scope.

Dropped from the ticket's original scope (superseded by D43): dnd-kit port, resize, 8 px snap, free rotation.
The ticket's AC5 "Unit tests cover snap math and the layout diff/save payload" becomes "unit tests cover tile math,
group moves, rotation, undo, the layout diff and the save payload". Slice 1 delivers that criterion.

**Slice 1 delivers:** a pure, framework-free editor model with these parts:
- a draft built from `GET /api/rooms/{id}/layout`
- tile math and hit tests
- place, move (group), rotate, delete, place-from-tray and room-resize operations, each checked by the shared
  `checkLayoutRules`
- a snapshot undo stack
- the dirty check
- the palette list from the registry
- the save plan (seat deletes, seat creates, mapping created seats to new desks, and a PUT body that passes
  `validateLayoutSave`)

Slice 1 has no UI, no network calls and no route changes.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Pixel to tile conversion works at zoom 2, 3 and 4 with 32 px tiles (`TILE`), clamps to the room, and turns a drag into a whole-tile delta. | `src/lib/layout-editor/tiles.test.ts` › "pointToTile …", "dragDelta …" pass in `pnpm test` |
| 2 | Placing a desk or fixture is refused (with the `layout_*` rule code and no change to the draft) when it is out of bounds, overlaps a blocking item, or its desk chair tile is out of bounds or blocked. A valid place adds exactly one item. | `draft.test.ts` › "placeItem …" |
| 3 | Moving a multi-selection moves every item by the same whole-tile delta, or refuses the whole move when any item would leave the room or overlap an item outside the selection. | `draft.test.ts` › "moveItems …" |
| 4 | Rotate steps directional sprites 0→90→180→270→0 in place, using the registry footprint per direction. It refuses when the new footprint or chair is out of bounds or overlapping, and refuses when the selection has no directional sprite. Non-directional items in a mixed selection stay at 0. | `draft.test.ts` › "rotateItems …" |
| 5 | Delete removes fixtures. It drops new (not yet created) desks. It records existing seats in `removed`. | `draft.test.ts` › "deleteItems …" |
| 6 | An unplaced seat (tray) can be placed on the map. Saving is blocked while the tray is not empty. | `draft.test.ts` › "placeFromTray …", `save-plan.test.ts` › "planSave refuses while seats are unplaced" |
| 7 | Room resize accepts 1 to 64 per side. It refuses when any item or chair would fall outside. Full-room floor zones stretch with the room; other zones are clipped, and empty zones are dropped. | `draft.test.ts` › "resizeRoom …" |
| 8 | Undo restores the previous draft. Each committed operation is one step. A refused operation adds no step. The stack is capped at 50. | `history.test.ts` |
| 9 | Dirty is false for a fresh draft and after an undo back to it, and true after any committed change. | `save-plan.test.ts` › "isDirty …" |
| 10 | The save plan lists seat deletes (existing seats removed in the draft) and new desks to create, in add order. `assignCreatedSeats` maps created seats by ascending `seq` onto new desks in add order, including room codes with Vietnamese diacritics. `buildSavePayload` yields a body that `validateLayoutSave` accepts with exact keys, and refuses while a desk has no seat id. | `save-plan.test.ts` (the payload test feeds the result to `validateLayoutSave`) |
| 11 | The palette lists `desk.single` as the only seat sprite and every base fixture sprite whose group is an allowed fixture group, and nothing else (no floor, chair, avatar or overlay keys). | `palette.test.ts` |
| 12 | `draftToRoomLayout` gives a `RoomLayout` that `buildDrawList` can paint (new desks get their local key as id and an empty code). | `draft.test.ts` › "draftToRoomLayout …" |
| 13 | R1: the new code is lib-only (no React, no `server-only`, no `@/ui` or `@/server` imports). All checks are green. | `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build` |

Original ticket AC1 to AC4 (survive reload, `<room>-NN` on add, delete refusal message, leave confirmation) are
verified in slices 2 and 3 (see `## Split proposal`).

## Ming verification after merge
None for slice 1 (no user-visible change). The 20+ seat manual run belongs to slices 2 and 3.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/validate/layout.ts` | Export `SEAT_SPRITES` and `FIXTURE_GROUPS` (l.40-58; today they are module consts). Add `export function spriteInfo(sprite: string): { group: string; directional: boolean } \| null`, read from the existing `SPRITES` map (l.63-72). No rule change. | The palette and rotate must use the validator's own lists, not a copy (consult risk "palette must be built from REGISTRY and the validator's group lists"). | No |
| `src/lib/layout-editor/types.ts` (new) | `EditorItem`, `Draft`, `OpResult` types (see Approach step 1). | Shared model | No |
| `src/lib/layout-editor/tiles.ts` (new) | `pointToTile`, `dragDelta`, `footprintCells`, `itemAt`, `itemsInRect` | AC1, hit testing and marquee for slice 2 | No |
| `src/lib/layout-editor/draft.ts` (new) | `draftFromLayout`, `draftToRoomLayout`, `rulesInput`, `placeItem`, `placeFromTray`, `moveItems`, `rotateItems`, `deleteItems`, `resizeRoom` | AC2 to AC7, AC12 | No |
| `src/lib/layout-editor/history.ts` (new) | `UNDO_LIMIT = 50`, `startHistory`, `commit`, `undo`, `canUndo` | AC8 | No |
| `src/lib/layout-editor/save-plan.ts` (new) | `isDirty`, `planSave`, `assignCreatedSeats`, `buildSavePayload`, `restoreRemovedSeat`, `forgetDeletedSeat` | AC6, AC9, AC10 | No |
| `src/lib/layout-editor/palette.ts` (new) | `paletteEntries()` from `REGISTRY` plus the exports above | AC11 | No |
| `src/lib/layout-editor/tiles.test.ts` (new) | Tests | R5 | No |
| `src/lib/layout-editor/draft.test.ts` (new) | Tests | R5 | No |
| `src/lib/layout-editor/history.test.ts` (new) | Tests | R5 | No |
| `src/lib/layout-editor/save-plan.test.ts` (new) | Tests | R5 | No |
| `src/lib/layout-editor/palette.test.ts` (new) | Tests | R5 | No |

No file matches a High path in `.claude/loop.config.md`. Expected size: about 350 to 400 source lines plus tests.

## Data model / migration
None. Slice 1 is client-side pure code. The PUT contract from SIM-015.5 is used as is.

## API contract
None changed. Slice 1 builds bodies for the existing endpoints, which slices 2 and 3 will call:

| Method | Path | Request | Response | Codes | Permission |
|---|---|---|---|---|---|
| PUT | `/api/rooms/{id}/layout` (existing, `src/app/api/rooms/[id]/layout/route.ts:27-42`) | `{baseVersion, w, h, floors, seats[{id,sprite,x,y,rotation}], fixtures[{sprite,x,y,rotation}]}`, exact keys | `LayoutResponse` | 400 `invalid_request`; 409 `layout_stale`, `layout_seats_changed`; 422 `layout_*`, `layout_too_many_seats` | admin |
| POST | `/api/rooms/{id}/seats` (existing) | `{count}` (1 to `SEAT_LIMITS.addMax` = 50) | 201 `{items: SeatDto[]}` (has `id`, `code`, `seq`) | 400, 404 | admin |
| DELETE | `/api/seats/{id}` (existing) | none | 204 | 409 `seat_not_empty` (SEA-01 guard, `src/server/seats/seats.ts:319-320`), 404 | admin |

Facts from the code that the plan relies on:
- The PUT never creates or deletes seats. It refuses with 409 `layout_seats_changed` unless the submitted seat ids
  equal the room's seats exactly (`src/server/layout/save.ts:68-71`).
- The PUT replaces all fixtures that have a `sprite_key` (`save.ts:91-115`).
- Seat add and seat delete do not change `layout_version`. Only the PUT bumps it (`save.ts:117-123`), so the
  delete → create → PUT sequence keeps the same `baseVersion`.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `tiles.test.ts` › "pointToTile maps pixels to tiles at zoom 2, 3, 4 (64, 96, 128 px per tile)" | AC1 |
| `tiles.test.ts` › "pointToTile clamps negative and past-the-edge points into 0..w-1 / 0..h-1" | AC1 |
| `tiles.test.ts` › "dragDelta is a whole-tile difference and 0 below one tile, also for negative drags" | AC1 |
| `tiles.test.ts` › "itemAt returns the topmost item whose footprint covers the tile (seat over fixture), null on empty tile" | hit test |
| `tiles.test.ts` › "itemsInRect selects items whose footprint intersects the rectangle, in either drag direction" | marquee |
| `draft.test.ts` › "draftFromLayout keeps seats with ids and codes, gives fixtures local keys, copies unplaced into the tray" | model |
| `draft.test.ts` › "draftFromLayout of an unsaved default layout (defaultLayout of 0 and 5 seats) is valid" | empty room / saved:false |
| `draft.test.ts` › "placeItem adds a fixture / a new desk with seatId null" | AC2 |
| `draft.test.ts` › "placeItem refuses out of bounds, overlap with a blocking item, desk chair outside the room, chair on a blocker" | AC2 |
| `draft.test.ts` › "placeItem allows a non-blocking fixture over a blocking one" | LAY-01 "where the manifest says they block" |
| `draft.test.ts` › "placeItem refuses an unknown or floor sprite (layout_unknown_sprite)" | AC2 |
| `draft.test.ts` › "moveItems moves a group by (dx, dy); refused as a whole at the room edge; refused on overlap with an unselected item; allowed when selected items swap through each other's old cells" | AC3 |
| `draft.test.ts` › "rotateItems cycles desk.single 0→90→180→270→0 and the footprint follows the registry (2×1 ↔ 1×2)" | AC4 |
| `draft.test.ts` › "rotateItems refuses a rotate that pushes footprint or chair out of bounds; refuses a selection of only non-directional sprites; leaves non-directional items at 0 in a mixed selection" | AC4 |
| `draft.test.ts` › "deleteItems drops fixtures and new desks, moves existing seats to removed" | AC5 |
| `draft.test.ts` › "placeFromTray places a tray seat as desk.single rotation 0 and removes it from the tray; refused on overlap" | AC6 |
| `draft.test.ts` › "resizeRoom: 1 and 64 accepted, 0 and 65 refused, shrink cutting an item or chair refused, full-room floor stretched, partial floor clipped, empty zone dropped" | AC7 |
| `draft.test.ts` › "draftToRoomLayout feeds buildDrawList without unknown keys for desk.single and fixtures (test manifest)" | AC12 |
| `history.test.ts` › "commit then undo restores the previous draft; undo at the start is a no-op" | AC8 |
| `history.test.ts` › "a refused op is not committed (no step)" | AC8 |
| `history.test.ts` › "the stack keeps the last 50 steps" | AC8 |
| `history.test.ts` › "startHistory(saved draft) clears past steps" | after save |
| `save-plan.test.ts` › "isDirty false for fresh draft, true after a move, false after undo to the start" | AC9 |
| `save-plan.test.ts` › "planSave refuses while seats are unplaced" | AC6 |
| `save-plan.test.ts` › "planSave lists deletes of removed existing seats and creates of new desks in add order" | AC10 |
| `save-plan.test.ts` › "assignCreatedSeats maps created seats by ascending seq onto new desks in add order (room code `Phòng-A`)" | AC10, diacritics |
| `save-plan.test.ts` › "assignCreatedSeats refuses a count mismatch" | AC10 |
| `save-plan.test.ts` › "buildSavePayload passes validateLayoutSave with exact keys (no code, no key, fixtures without id)" | AC10 |
| `save-plan.test.ts` › "buildSavePayload refuses while a desk has no seat id or the tray is not empty" | AC10 |
| `save-plan.test.ts` › "restoreRemovedSeat puts a refused delete back at its baseline place, else into the tray" | slice 3 refusal path |
| `palette.test.ts` › "palette has desk.single as the only seat entry and only base keys of FIXTURE_GROUPS; no floor/chair/avatar/overlay" | AC11 |
| `palette.test.ts` › "directional entries are listed once by base key (door, cabinet.filing)" | AC11 |

## Approach
1. **Model** (`types.ts`). Rotation stays `Rotation` from `src/lib/sprites/layout.ts:5`.
   ```ts
   type EditorItem = { key: string; kind: "seat" | "fixture"; sprite: string; x: number; y: number;
     rotation: Rotation; seatId: string | null; code: string | null };
   type Draft = { w: number; h: number; floors: FloorZone[]; items: EditorItem[];
     tray: { id: string; code: string }[]; removed: { id: string; code: string }[]; nextKey: number };
   type OpResult = { ok: true; draft: Draft } | { ok: false; code: LayoutRuleCode };
   ```
   - Item keys are local and stable within a session: `s:<seatId>` for existing seats, `n:<k>` for new desks and
     `f:<k>` for fixtures, with `k` taken from `nextKey`.
   - Drafts are immutable. Each operation returns a new draft.
2. **Rules reuse.** `rulesInput(draft)` maps a draft to `LayoutRulesInput` (`src/lib/validate/layout.ts:31-37`).
   - Every operation builds the candidate draft and calls `checkLayoutRules`.
   - On failure, the operation returns `{ok:false, code}` and the caller keeps the old draft.
   - The rules are not duplicated. Footprints come from `footprintOf` (l.75-79) and chairs from `chairFor`
     (`src/lib/sprites/placement.ts:35-53`), via the validator.
   - The validator checks the whole layout, so a single check covers the moved items against everything else. For
     the hit test only, `tiles.ts` computes cells with `footprintOf` and `resolveFrameKey`.
3. **Tile math** (`tiles.ts`). Pixels per tile = `TILE * zoom` (`TILE` = 32, `placement.ts:7`). `pointToTile`
   floors and clamps. `dragDelta(start, now, zoom)` = `tile(now) - tile(start)` without clamping, so the group-move
   refusal decides the bounds.
4. **Operations** (`draft.ts`):
   - `moveItems` is all-or-nothing, which keeps whole-tile group moves simple.
   - `rotateItems` turns each directional item in place, anchored at its top-left tile (x, y), and leaves
     non-directional items at 0. This is needed because `checkLayoutRules` refuses rotation ≠ 0 on them (l.118-120).
   - `deleteItems`: an item with `seatId !== null` goes to `removed`. A new desk (`seatId === null`) disappears.
   - `placeFromTray(seatId, x, y)` places a tray seat as `desk.single`, rotation 0.
   - `resizeRoom` keeps items at their tile coordinates. It does not shift items when the room shrinks.
5. **Undo** (`history.ts`) is snapshot-based: `{ past: Draft[]; present: Draft }`.
   - `commit` pushes the present onto `past` and drops the oldest entry beyond 50.
   - There is no redo (the spec only asks for "undo of the last steps").
   - In slice 2, one drag gives one commit: the drag preview is not committed.
6. **Save plan** (`save-plan.ts`). The sequence (A3) is deletes, then creates, then PUT. Each step is pure here, and
   slice 3 performs the calls.
   - `planSave(draft)` returns `{ok:false, reason:"unplaced"}` while the tray is not empty. Otherwise it returns
     `{ok:true, deletes: draft.removed, createKeys: keys of seat items with seatId null, in ascending k}`.
   - `assignCreatedSeats(draft, createKeys, created)` sorts `created` by `seq` and zips the result with
     `createKeys`. It sets `seatId`, `code` and `key = s:<id>`, and refuses on a length mismatch.
   - `buildSavePayload(draft, baseVersion)` returns `LayoutSaveValue` with exactly the keys that
     `validateLayoutSave` requires (l.192, 222, 235). It refuses while any seat item has `seatId === null` or the tray
     is not empty.
   - `forgetDeletedSeat(draft, id)` removes a seat from `removed` after a successful DELETE.
   - `restoreRemovedSeat(draft, baseline, id)` handles a refused DELETE. It puts the seat back at its baseline
     placement if the rules allow, else into the tray. It does not add an undo step.
   - `isDirty(baseline, draft)` compares a normalised form: w, h, floors, items sorted by key without `key`,
     `tray` ids, and `removed` ids.
7. **Palette** (`palette.ts`).
   - `paletteEntries()` returns `{ sprite, kind, group, directional }[]`: the seat entry `desk.single` first, then
     fixture base keys sorted by group and then by key.
   - Directional keys are collapsed to their base key, using the same `.slice(0, -2)` rule as `SPRITES` in
     `src/lib/validate/layout.ts:68-70`.
   - There are no labels here. Copy belongs in `src/ui/copy/` in slice 2 (D36).
8. **Rules applied.**
   - R1: only `@/lib/**` imports, no React, no `server-only`.
   - R4: only the files listed above.
   - R5: every exported function has a test.
   - R6, R7: not touched, since there are no route or server changes.
   - Domain focus: diacritics in room codes (seat-code mapping test), empty fields (a room with 0 seats, an empty
     tray, empty fixtures), bounds (1 and 64 tiles, `LAYOUT_LIMITS.grid`).
9. Run the checks (`eval "$(fnm env --shell bash)"` first): `pnpm format:check`, `pnpm typecheck`,
   `pnpm check:layers`, `pnpm test`, `pnpm build`. `pnpm test:db` is CI-only and not affected.

## Specialist input used
- consult-frontend-developer.md:
  - Finding 1 (stale ticket text, 32 px tile): adopted. The plan re-scopes against D43, D48 and the spec.
  - Finding 2 and Recommendation 2: adopted, but with deferred seat create/delete (A3) instead of creating seats
    immediately at add time. Immediate create breaks "undo before save" and "All of this is saved in one layout save"
    (LAY-05).
  - Finding 3 and Recommendation 4: adopted. `checkLayoutRules`, `footprintOf` and `chairFor` are reused, not copied.
  - Finding 5 (R1 layers, pure core in lib): adopted.
  - Finding 6 (snap math becomes tile math): adopted (AC1).
  - Recommendation 3 (partial-failure handling): adopted as `restoreRemovedSeat` now and the UI flow in slice 3.
  - Recommendation 5 (undo of about 50 steps, one step per drag): adopted.
  - Recommendation 6 (leave guard): planned in slice 2 (A9).
  - Recommendation 7 (admin-only page): slice 2 (A10).
  - Recommendation 8 (tests, including the payload fed to `validateLayoutSave`): adopted.
  - Recommendation 10 (keyboard): slice 2 (A11).
  - Risk "truncated" (refuse to edit): adopted as A6.
- consult-ux-architect.md:
  - Recommendation 2 (pure reducer in lib, no dnd-kit, pointer events): adopted. There is no new dependency, since
    the stack is frozen.
  - Recommendation 5 (defer deletes to Save; order deletes, creates, PUT): adopted (A3).
  - Finding "unplaced tray, save needs all seats": adopted (A5).
  - Recommendation 9 (rotated multi-tile footprints come from the registry and are never swapped; chair bounds):
    adopted in the tests.
  - Recommendation 10 (three-way split): adopted as the `## Split proposal`.
  - Risk "allowedZooms may be empty for big rooms": slice 2. At most 64 tiles × 32 px × 4 = 8192 px, which equals
    `MAX_CANVAS_SIDE`, so every zoom fits a 64-tile room unless sprite overhang widens the bounds. Slice 2 reuses
    `clampZoom`.
  - Open question "redo": rejected for now (rule 1, the spec says undo only).
- Rejected from both consults: a delete-impact pre-check endpoint. It is a new API, and the server's 409
  `seat_not_empty` already gives the SEA-01 message (`src/ui/copy/api.ts:21`).

## Assumptions
Defaults for Ming to approve with the plan (P1 plan-approval gate). None of them blocks slice 1.

- **A1 Split.** SIM-015.2 is split into three slices (see `## Split proposal`). This plan is slice 1 (pure core). The
  orchestrator files slices 2 and 3 as new tickets (proposed IDs SIM-015.6 and SIM-015.7) after approval. The
  ticket's Goal, Scope and Technical notes text is stale (free-form, `[code]` instead of `[roomCode]`). The orchestrator
  should update `ticket.md` to this plan's scope, because the planner only writes `plan.md`.
- **A2 Tile and sprites.** The tile is 32 px (D48, `TILE`). `desk.single` is the only seat sprite (D59,
  `SEAT_SPRITES`). Multi-tile desks (LAY-01 "a desk sprite may cover several tiles", for example the existing
  `desk.pair.*` keys) are not enabled here. Enabling them is a validator change for a later ticket.
- **A3 Seat create/delete timing.** Desk add and delete stay local until Save (keeps undo and "one save", LAY-05). On
  Save, slice 3 runs:
  1. `DELETE /api/seats/{id}` for each removed existing seat. On a 409 `seat_not_empty`, stop: restore that desk, show
     the SEA-01 message naming the seat code, and do not send the PUT. Earlier successful deletes stay done.
  2. `POST /api/rooms/{id}/seats {count}` for the new desks, in chunks of 50. The server assigns `<room>-NN` (ROO-02),
     and new desks get their codes in the order they were added.
  3. `PUT /api/rooms/{id}/layout`.

  If step 3 fails after step 2, the created seats exist without a saved place. They appear in the default or
  unplaced position on reload. This is accepted and shown to the admin as a message.
- **A4 New desk label.** A new desk shows "New" until Save, because the code is only known after the POST. The editor
  never invents a code (ROO-02).
- **A5 Unplaced seats.** Unplaced seats (`unplaced[]` from GET) go into a tray. Save is disabled until every tray seat
  is placed or deleted, because the PUT needs the exact seat set.
- **A6 Truncated rooms.** When the GET has `truncated: true` (more than 500 seats), the editor opens read-only with a
  message. A full-layout PUT would drop seats (`layout_too_many_seats`).
- **A7 Unsaved rooms.** A room with `saved: false` starts from the computed default layout (`defaultLayout`: 3×2
  pitch, `floor.wood` floor). The first Save stores it.
- **A8 Room size and floors.**
  - Room size (w × h, 1 to 64) is editable in the Inspector (LAY-01). A shrink that would cut an item is refused.
  - Floors are not painted in this ticket: they pass through unchanged. A full-room zone stretches with the room,
    and other zones are clipped.
  - Floor painting (LAY-01 "walls/floor") is a follow-up. Walls are placed as fixtures (group `wall`).
- **A9 Leave guard (slice 2).** The editor confirms before leaving when the draft is dirty, in three cases:
  - `beforeunload` for reload or tab close
  - a capture-phase click guard on same-origin `<a>` links (shell nav rail, breadcrumbs)
  - the editor's own Back and Cancel controls

  The browser Back button inside the App Router is not intercepted (the App Router has no route-change blocker). It
  is a documented limitation unless Ming wants a history-sentinel guard.
- **A10 Access (slice 2).** `/rooms/[roomCode]/edit` shows a "not allowed" state to tiers below admin (`canManageSeats`,
  `src/ui/seats/seat-actions.ts:170`). The server enforces this anyway: the PUT, POST and DELETE are admin-tier. The
  entry point is an admin-only "Edit layout" link in the room page's map card (`RoomMapSection`), using
  `roomEditorHref` (`src/lib/nav.ts:54`). The route param is `[roomCode]`, not `[code]`.
- **A11 Controls (slice 2):**
  - Pan by scrolling, the same as `RoomMap`.
  - Zoom 2/3/4 with `ZoomControl`.
  - Click a palette item, then click a tile to place it. Drag selected items to move them.
  - Shift-click and marquee for multi-select.
  - Keys: R rotates, Delete or Backspace deletes, Ctrl+Z undoes, arrow keys move the selection by one tile, Esc
    deselects.
  - The editor chrome uses the clean UI kit (D52). A narrow screen shows a "use a desktop" notice (LAY-05).
- **A12 Palette.** The palette is every base fixture sprite of the validator's 16 groups plus `desk.single`. The
  registry has no `pillar` sprite yet (LAY-03 lists one). Pillar appears when the registry gains it (SIM-033 or an art
  ticket), with no code change. Placeholder art until SIM-033 (D58) is expected and noted in the PRs.
- **A13 Conflicts.** On 409 `layout_stale` or `layout_seats_changed`, the editor shows the existing copy
  (`src/ui/copy/api.ts:30-31`) with a Reload action. It never merges or retries silently.
- **A14 Hotspots.** No other ticket is `IN_PROGRESS`, `REVIEW` or `DONE` on the board (`work/backlog.md`), so no rebase
  is expected. Slice 1 touches the shared file `src/lib/validate/layout.ts` with exports only.

## Blocking questions
None.

## Split proposal
The full editor (pure core, canvas interaction, palette, inspector, page, leave guard, seat add/delete orchestration)
is well over 400 changed lines, and the ticket says it is "Most likely ticket to need rework". Proposed slices:

1. **SIM-015.2, slice 1: editor core (this plan).** Pure `src/lib/layout-editor/*` plus tests. It covers the
   reworded AC5 (tile math, group move, rotate, undo, diff and save payload). Low risk, no UI.
2. **SIM-015.6, slice 2: editor UI and save of placement (proposed).**
   - The page `src/app/(app)/rooms/[roomCode]/edit/page.tsx` (today a `PageSkeleton` stub).
   - `src/ui/roomlayout/LayoutEditor*.tsx`, `Palette.tsx` and `Inspector.tsx`, with a pointer overlay over the existing
     canvas painter (`paint.ts`, `buildDrawList`).
   - Copy in `src/ui/copy/roomlayout.ts`.
   - `seatsApi.saveLayout`, and `version` added to `MapView`. `toMapView` drops `version` today
     (`src/lib/sprites/map-view.ts:72-82`), and the PUT needs it as `baseVersion`.
   - An admin-only "Edit layout" link in `RoomMapSection`.
   - Move, rotate and delete for fixtures, and move/rotate/place-from-tray for existing seats, with undo, room size
     and zoom/pan.
   - The leave guard (A9) and conflict handling (A13).
   - Verifies ticket AC1 (positions survive reload) and AC4 (leave confirmation), with component tests for the guard
     and the error mapping, plus the manual 20+ seat run and a 64×64 room.
3. **SIM-015.7, slice 3: desk add and delete (proposed).** Placing a `desk.single` from the palette, deleting a
   desk, and the Save sequence of A3 (DELETE, then POST, then PUT) with partial-failure messages.
   - Verifies ticket AC2 (`<room>-NN` with the next number after Save) and AC3 (deleting a desk with an occupant or
     device is refused with the SEA-01 message and the desk comes back).
   - Component tests for the Save sequence use a fake `seatsApi`.

This plan covers slice 1 only.
