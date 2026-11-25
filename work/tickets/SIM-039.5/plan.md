Status: READY

# Plan — SIM-039.5: Editor palette and map rendering from the catalog (slice 1: palette and editor sizes)

The ticket is bigger than one implement/review cycle (see `## Split proposal`). This plan covers **slice 1 only**:
the "Add items" palette from `GET /api/map-items` and the editor's sizes (ghost, hit areas, place/move/rotate checks,
save pre-check) from the catalog. Rendering of art (custom image → package sprite → built-in frame → placeholder),
image loading and the OQ-53 bottom-left alignment move to a new ticket, proposed as **SIM-039.8**.

## Scope summary
- Ticket Goal: "The editor's "Add items" palette and both maps show the org's catalog: names, groups, order, hidden
  flags, sizes and art." Slice 1 = names, groups, order, hidden flags, sizes (editor). Art = slice 2.
- Ticket Scope: "Palette from `GET /api/map-items`; editor ghost and hit areas use catalog sizes." (slice 1, all of it)
- `docs/spec-v1.md` LAY-03: "The palette is the org's map item catalog (LAY-07): only items marked "shown in palette",
  under the Admin's group names, in the Admin's order, with the Admin's item names, sizes and art."
- LAY-01: "An item's footprint is its catalog size (width × height at rotation 0; 90° and 270° swap width and
  height) … The validator, layout read and editor take footprints from the org's catalog, not from the sprite
  registry alone."
- D67 (1): "catalog items are listed alphabetically by name" (supersedes "in the Admin's order" in LAY-03 and the
  ticket's "order"); D67 (2): "hidden items are not returned to non-Admin members, Admins still get them".
- SIM-039.1 plan, sibling note for 039.5: "palette from `GET /api/map-items` (… Admins get hidden rows, so the
  palette still filters `hidden`), items in name order, groups in name order; placed items drawn from the layout
  response's referenced items (039.3), not from the palette list." 039.1 A1: "Groups have no stored order; 039.5/039.6
  show groups in name order."
- SIM-039.3 plan A8: "The editor still checks with registry sizes and still offers hidden items … until 039.5."
  Slice 1 closes A8.
- D66 (7): "the validator, `resolveLayout`, placement and editor take footprints from the catalog."
- `src/lib/map-items/types.ts:18`: "Add items" palette = kind seat|fixture and !hidden.

## Acceptance criteria → verification
Slice 1 covers AC 1 in full and AC 3. AC 2 (art) is slice 2 (SIM-039.8).

| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Palette shows Admin names/groups/order and hides hidden items (order = D67 1: groups and items by name). | `palette.test.ts` › `catalogPalette*` tests; `LayoutEditorViews.test.tsx` › "palette renders catalog groups and names …"; `map-items-api.test.ts` › `list*`. Local run: as Admin, `PATCH /api/map-items/plant.large {"name":"Cây xanh","group":"Decor"}` and `{"hidden":true}` on `sofa…`, reload `/rooms/<code>/edit`: "Decor" heading with "Cây xanh", no sofa entry, groups and entries in name order. |
| 1a | (Ticket Scope) Editor ghost and hit areas use catalog sizes; place/move/rotate refusals and the Save pre-check use the same sizes as the server (closes 039.3 A8). | `tiles.test.ts`, `place-tool.test.ts`, `pointer-gesture.test.ts`, `draft.test.ts`, `editor-state.test.ts`, `save-run.test.ts` lookup cases (listed below). Local run: resize an unplaced fixture to 3×1 via `PATCH`, reload the editor: ghost is 3 tiles wide, placing it next to a wall refuses with the overlap notice where a 2×1 fits. |
| 3 | Every query is scoped by the token's org (R6); Admin-only writes are audited; checks green including `pnpm test:db` run locally. | Slice 1 adds no server code, query or write: `git diff --name-only main` lists nothing under `src/server/`, `src/app/api/`, `db/`. The only new request is `GET /api/map-items` (039.1, org-scoped, `tier:"user"`). Checks: `pnpm format:check`, `pnpm typecheck && pnpm check:layers`, `pnpm test`, `pnpm build`, and `pnpm test:db` locally (record results in impl-log; the 9 handoffs failures are pre-existing, 039.4 A11). |

## Ming verification after merge
- On the deployed app, as Admin: rename / regroup / hide one item through the API (or the 039.6 page once merged),
  open a room editor, check the palette. As a Manager, open the room map: nothing changes in slice 1 (art is
  slice 2).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/lib/layout-editor/palette.ts` | Add pure `catalogPalette(items: readonly MapItemDto[]): { group: string; entries: PaletteEntry[] }[]`; `PaletteEntry` gains `name`; remove `editorPalette()` (only caller `LayoutEditor.tsx:27`). Keep `paletteEntries()` (used by `library.test.ts:27`, `place-tool.test.ts:17`). | AC 1 | no |
| `src/lib/layout-editor/palette.test.ts` | Replace the `editorPalette` block (lines 38-45) with `catalogPalette` tests. | R5 | no |
| `src/lib/sprites/map-view.ts` | `MapView.items: LayoutItem[]`; `toMapView` maps `body.items` (missing or not an array → `[]`; entries failing the shape check dropped). | Q5: `LayoutResponse.items` is dropped today (`map-view.ts:88-131`); the editor needs placed items' sizes, hidden ones included | no |
| `src/lib/sprites/map-view.test.ts` | items cases. | R5 | no |
| `src/lib/layout-editor/tiles.ts` | `footprintCells`, `footprintBox`, `itemAt`, `itemsInRect` take `lookup: FootprintLookup = registryFootprints` and use `footprintAt(sprite, rotation, lookup) ?? [1, 1]` (lines 29-65). | AC 1a (hit areas, marquee) | no |
| `src/lib/layout-editor/tiles.test.ts` | lookup cases. | R5 | no |
| `src/lib/layout-editor/place-tool.ts` | `tryPlace(draft, tool, x, y, lookup = registryFootprints)`, `placementPreview(draft, tool, tile, lookup = registryFootprints)` with `footprintAt(sprite, 0, lookup)` (line 57). | AC 1a (ghost) | no |
| `src/lib/layout-editor/place-tool.test.ts` | lookup cases. | R5 | no |
| `src/lib/layout-editor/pointer-gesture.ts` | `GestureCtx.footprints?: FootprintLookup`; `gestureDown` `itemAt(..., ctx.footprints)` (line 56), `gestureUp` `marqueeKeys(..., ctx.footprints)` (line 119); `dragPreview(draft, g, lookup = registryFootprints)` (127-139), `marqueeKeys(draft, g, lookup = …)` (149-152). | AC 1a (drag ghost, hit) | no |
| `src/lib/layout-editor/pointer-gesture.test.ts` | lookup cases. | R5 | no |
| `src/lib/layout-editor/draft.ts` | `checked(next, lookup)` → `checkLayoutRules(rulesInput(next), lookup)` (line 92); trailing `lookup = registryFootprints` on `withoutDeskFixtures` (82-88, passes it to `fixturesOnDesks`), `placeItem`, `placeFromTray`, `moveItems`, `rotateItems`, `resizeRoom`. `turnable` keeps `spriteInfo` (A4). | AC 1a | no |
| `src/lib/layout-editor/draft.test.ts` | lookup cases. | R5 | no |
| `src/lib/layout-editor/editor-state.ts` | `EditorState` gains `layoutItems: LayoutItem[]`, `palette: MapItemDto[]`, `footprints: FootprintLookup`; exported `editorFootprints(layoutItems, palette)` = `catalogFootprints([...palette, ...layoutItems], registryFootprints)` (layout rows last, so they win, K1); `initEditor(view, palette = [])`; new action `{ type: "catalog"; items: MapItemDto[] }` (rebuilds `palette` + `footprints`, history untouched); every op in `reduce` passes `state.footprints`; `savePayload` → `validateLayoutSave(built.value, state.footprints)` (line 99); `saveDone` → `initEditor(action.view, state.palette)` (line 230). | AC 1a, Q1 | no |
| `src/lib/layout-editor/editor-state.test.ts` | `view()` fixture gets `items: []`; catalog cases. | R5 | no |
| `src/lib/layout-editor/save-run.ts` | `SaveInput.footprints?: FootprintLookup`; `validateLayoutSave(built.value, input.footprints)` (line 100). | AC 1a (save pre-check = server) | no |
| `src/lib/layout-editor/save-run.test.ts` | one lookup case. | R5 | no |
| `src/ui/mapItems/map-items-api.ts` (new) | `createMapItemsApi(fetcher)` with `list()` → `GET /api/map-items`, `{ ok, value: MapItemDto[] } | { ok:false, code }`; same `call` / `ApiAccessError` mapping as `src/ui/deviceTypes/device-types-api.ts:12-43`. Slice 2 adds `getImage`, 039.6 the writes. | AC 1 | no |
| `src/ui/mapItems/map-items-api.test.ts` (new) | fake fetcher tests. | R5 | no |
| `src/ui/mapItems/useMapItems.ts` (new) | Thin hook `useMapItems(api, enabled)` → `{ status: "loading" \| "ready" \| "error"; items; reload }` (no logic beyond the call). | AC 1 | no |
| `src/ui/roomlayout/LayoutEditorPage.tsx` | `AdminEditor` (lines 46-92) creates the api, calls `useMapItems`, passes `palette={…}` to `LayoutEditor`. The editor mounts as today (no wait on the palette). | AC 1 | no |
| `src/ui/roomlayout/LayoutEditor.tsx` | Drop `GROUPS` (line 27); prop `palette: { status; items; reload }`; `useEffect` dispatches `{type:"catalog"}` when `items` change; `groups = useMemo(catalogPalette(items))`; `names` map (palette ∪ `view.items`, layout rows win) for `toolName` (52-59) and the inspector; `footprints={state.footprints}` to `EditorCanvas`; `runSave({... footprints: state.footprints})` (71-79). | AC 1, 1a | no |
| `src/ui/roomlayout/Palette.tsx` | Heading = `g.group` verbatim (line 31, drop `c.groups`); entry label = `e.name` (line 42); `status` prop: loading line, or error line + "Try again" button calling `onRetry`. | AC 1, Q6 | no |
| `src/ui/roomlayout/EditorCanvas.tsx` | Prop `footprints?: FootprintLookup`; pass to `placementPreview` (92), `dragPreview` (93), `marqueeKeys`/`footprintBox` (97-98, 259), and `ctxRef` (72-73). | AC 1a | no |
| `src/ui/roomlayout/EditorInspector.tsx` | Prop `names?: ReadonlyMap<string, string>`; `label` (30) and the single-selection name (65) use `copy.itemName(i, names?.get(i.sprite))`. | AC 1 (Admin names, K5) | no |
| `src/ui/copy/roomlayout.ts` | `itemName(item, catalogName?)`: seats unchanged ("New desk" / "Desk <code>"), fixtures `catalogName ?? sprite.replaceAll(".", " ")` (187-192); remove `palette.groups` (109-127); add `palette.loading`, `palette.failed`, `palette.retry`. | D36, AC 1 | no |
| `src/ui/roomlayout/LayoutEditorViews.test.tsx` | Replace the palette tests at 155-180 (`editorPalette`, `copy.palette.groups`) with catalog-based ones. | R5 | no |
| `src/ui/roomlayout/RoomMapSection.test.tsx` | `view()` fixture (line 8) gets `items: []` (type only). | typecheck | no |

No file matches a High path. Size estimate: ~300 product lines, ~350 test lines.

## Data model / migration
None.

## API contract
None changed. Consumed (039.1, unchanged): `GET /api/map-items` → `200 {items: MapItemDto[]}` sorted by
`lower(name), builtin_key`; hidden rows only for Admins; any member (`tier:"user"`). The editor is Admin-only, so
the palette filters `hidden` itself.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `palette.test.ts` › catalogPalette keeps kind seat and fixture only and drops hidden rows (floor, chair, hidden fixture, hidden desk all absent) | AC 1, Q7 |
| `palette.test.ts` › catalogPalette sorts groups and entries by name, case- and accent-insensitive, then by builtinKey (Vietnamese names: "Bàn", "ban", "Cây", "Ánh") and does not depend on input order | AC 1, D67 1, domain focus |
| `palette.test.ts` › catalogPalette groups by the exact group string; an empty list gives [] | AC 1, empty |
| `palette.test.ts` › catalogPalette entry carries name, kind and directional from the DTO; desk.single is a seat entry | AC 1 |
| `map-view.test.ts` › toMapView maps items; a missing or non-array items gives []; a malformed entry is dropped, the view stays | Q5 |
| `tiles.test.ts` › footprintCells/footprintBox use the lookup: a 2×1 registry key sized 3×1 covers 3 cells at 0° and 1×3 at 90° | AC 1a |
| `tiles.test.ts` › itemAt hits the third tile of a catalog-widened item; itemsInRect selects it from that tile | AC 1a |
| `tiles.test.ts` › without a lookup the results equal the registry sizes (unchanged callers) | regression |
| `place-tool.test.ts` › placementPreview ghost has the catalog size; tryPlace with the lookup refuses an overlap the registry size would allow | AC 1a |
| `pointer-gesture.test.ts` › gestureDown hit and marquee use ctx.footprints; dragPreview boxes have the catalog size | AC 1a |
| `draft.test.ts` › moveItems / rotateItems / resizeRoom pass the lookup (a widened item at the edge refuses the move with layout_out_of_bounds); withoutDeskFixtures uses it | AC 1a |
| `editor-state.test.ts` › initEditor builds footprints from view.items; a "catalog" action adds palette sizes, keeps history and selection; layout rows win over palette rows for the same key | AC 1a, K1 |
| `editor-state.test.ts` › place uses the palette size after "catalog"; savePayload refuses with the catalog size (validateLayoutSave with state.footprints); saveDone keeps the palette | AC 1a |
| `save-run.test.ts` › runSave pre-check uses input.footprints (a draft valid by registry but overlapping by catalog fails before the PUT, no PUT sent) | AC 1a |
| `map-items-api.test.ts` › list returns items; a non-array body gives internal; 403 body code is returned; ApiAccessError signed_out → unauthenticated; fetch throw → unavailable | AC 1 |
| `LayoutEditorViews.test.tsx` › palette renders catalog groups and names in the given order, Vietnamese name intact; pressed entry; disabled; loading and error+retry states | AC 1, Q6 |
| `LayoutEditorViews.test.tsx` › inspector shows the catalog name for a fixture and "Desk <code>" for a seat | AC 1, K5 |

## Approach
1. `map-view.ts`: add `items` with a tolerant per-entry shape check (builtinKey/name/group strings, integer w/h,
   kind in the 4 kinds, booleans, `art` an object). Fix the two typed fixtures.
2. Geometry: add the defaulted `lookup` parameter to `tiles.ts`, `place-tool.ts`, `pointer-gesture.ts`, `draft.ts`,
   `save-run.ts`; all sizes go through `footprintAt` (same function and default as the validator,
   `validate/layout.ts:102,132,200,339`). No module state (consult R2).
3. `editor-state.ts`: state fields, `editorFootprints`, `catalog` action, pass `state.footprints` everywhere.
4. `palette.ts`: `catalogPalette` — filter `(kind === "seat" || kind === "fixture") && !hidden`; group by `group`;
   compare `a.localeCompare(b, "en", { sensitivity: "base" })` then `builtinKey`; explicit sort, not the server order.
5. UI: `map-items-api.ts` + `useMapItems`; wire page → editor → palette/canvas/inspector; copy.
6. Rules: R1 — new code in `src/lib/**` (pure) and `src/ui/**` (client through `apiFetch`), no `src/server` import;
   `pnpm check:layers`. R6 — no new query; the GET is org-scoped by 039.1. R7 — no route change. R3 — no config.
   R4 — art, images, `buildDrawList`, `paint.ts`, `RoomMap` untouched (slice 2). R5 — tests above. D36 — copy in
   `src/ui/copy/roomlayout.ts`.

## Specialist input used
consult-frontend-developer.md:
- F1/F2/R1 (pure `catalogPalette`, explicit name sort, filter hidden, `name` on the entry, Admin group heading):
  adopted.
- F3/R2/F9 (lookup on editor state + defaulted parameters, `footprintAt`, no global): adopted (Q1).
- F8/Q5 (`MapView` drops `items`; editor lookup from `layout.items` ∪ palette, layout rows first): adopted (K1).
- R7/Q6 (palette fetch failure: no registry fallback, message + retry, editor keeps working): adopted.
- Q7 (no chair in the palette): adopted.
- F9 `layout_item_hidden` copy: already mapped (`save-errors.ts:10`, `copy/api.ts:32`); nothing to do.
- F4-F7, R3-R6, Q2-Q4, K2-K4, K7 (art, image op, image cache, placeholder, overhang): deferred to slice 2 with
  proposed defaults (see Split proposal).
- 039.4 security 🟡 (cross-org ETag): already fixed (`src/server/map-items/image.ts:178-198`, org hash +
  `Vary: Authorization`); no action.

## Assumptions
Questions for Ming (Q1-Q7 from the consult, resolved as defaults; none blocks slice 1):
- **A1 (Q1) Lookup location.** Editor state field `footprints`, plus defaulted `lookup` parameters on the pure
  geometry functions. Not stored in the undo history.
- **A2 (Q6) Palette load failure.** The palette shows "Could not load the item list" with "Try again"; no registry
  fallback (it would offer hidden or renamed items the server refuses). Tray placement, move, rotate, delete, resize
  and Save keep working with the layout's own catalog sizes.
- **A3 (Q7) Palette content.** Only `kind` seat or fixture and not hidden. `chair.office` and floors never appear.
  If an Admin hides `desk.single`, the palette has no desk entry; unplaced seats in the tray can still be placed.
- **A4 Rotation.** `turnable` keeps `spriteInfo(...).directional`. The DTO's `directional` is derived from the same
  registry (039.1 "Directional/layer/defaults derived from the registry"), so the result is identical.
- **A5 Group headings verbatim.** Palette headings are the stored `group` string as the Admin set it (LAY-03 "under
  the Admin's group names"). Until an Admin renames them, orgs see the library group keys ("cabinet",
  "circulation", "desk") instead of today's titles ("Cabinets", "Stairs and lifts", "Desks"); the `palette.groups`
  copy is removed. Alternative, if Ming prefers: show the old title when the stored group equals a library key.
- **A6 Entry names.** Every palette entry, desk included, shows the catalog `name` (seed: "desk single", "plant
  large"). Placed seats keep "Desk <code>" / "New desk" in the tool line and the inspector; placed fixtures show the
  catalog name from the layout's `items` (hidden ones included, K5), else the key with spaces.
- **A7 Order.** D67 (1) replaces "in the Admin's order" (LAY-03, ticket AC 1 "order"): groups and entries sort by
  name (case- and accent-insensitive, then key). The spec text update is the follow-up already noted in 039.1 A1.
- **A8 Stale catalog.** If an Admin resizes or hides an item in another tab, this editor keeps its sizes until the
  next reload. The server re-checks on save and its 422s are already mapped (`save-errors.ts:5-11`).
- **A9 Interim drawing.** Until slice 2, a resized fixture is still drawn at its frame size from the top-left while
  its ghost, outline and hit area use the catalog box. Visible only after an Admin resizes an item (API only until
  039.6).
- **A10 test:db.** No DB code changes; `pnpm test:db` runs locally for AC 3 and its result is recorded; the handoffs
  failures are pre-existing (039.4 A11).
- **AC 2 wording vs spec (flag).** Ticket AC 2 "a failing image draws the placeholder" conflicts with the spec
  chain (`docs/spec-v1.md:400-401`, LAY-06 line 443: "A custom image that cannot be loaded falls back the same
  way"): custom image → chosen package sprite → built-in frame → square placeholder. The spec wins (CLAUDE.md). A
  failing image on a library item draws its package sprite or built-in frame; the placeholder shows only when no
  frame exists. Proposed AC for SIM-039.8: "a failing image falls back to the package sprite, then the built-in frame,
  then the placeholder."
- Hotspots: no open ticket (IN_PROGRESS/REVIEW/DONE) edits these files. SIM-037.5 (DONE) does not touch
  `src/ui/roomlayout/**` or `src/lib/layout-editor/**`. SIM-039.6 (BACKLOG) will reuse `src/ui/mapItems/map-items-api.ts`.

## Blocking questions
None.

## Split proposal
The whole ticket is ~650 product lines (slice 1 ~300; art rendering ~300-350: `item-art.ts` resolver,
`buildDrawList` items/art, generalised image op, `paint.ts`, item image cache, `useCatalogImages`, RoomMap/
EditorCanvas/SeatsPage wiring), so it is split:

- **Slice 1 = SIM-039.5 (this plan):** palette from the catalog, editor sizes from the catalog, `MapView.items`,
  map-items API client. AC 1 and AC 3.
- **Slice 2 = new ticket SIM-039.8 "Map rendering from the catalog: per-direction art and custom images"**
  (P1, M, ui, depends on SIM-039.5, gate plan-approval). Ticket Scope lines 2-3 and AC 2 (reworded as above), plus
  "Generalise the image draw op used for device types". Defaults proposed now for its plan (Ming may answer
  with this plan):
  - **Q2** No atlas placeholder frame for items exists (only the device-sized `DEVICE_SPRITE.other`,
    `device-slots.ts:138`); add a painted `placeholder` op (hatched square, the item's catalog box).
  - **Q3** For a sprite smaller than the catalog box: shadow, sort row and `blocks` use the frame's own size; all
    cells of the catalog box stay blocked for placement (server rule, 039.3).
  - **Q4** Item image ops carry the box (32·w × 32·h, bottom-left); `paintRoom` extends upward by the decoded
    image's extra height; `bounds` reserves a fixed +32 px overhang only for items with a ready custom image.
  - Direction: directional items use `ROTATION_TO_DIR` (0 → `s`, code mapping, 039.1 A2); non-directional items and
    floors use `s`; implied chairs use `chair.office` art for the chair's own direction.
  - Images: `GET /api/map-items/<key>/art/<dir>/image` via `apiFetch`, `blob:` URLs cached per
    `{key, dir, imageVersion}`, only for directions actually placed; a failed load stays failed until the version
    changes or the page reloads; draw inputs from the layout's `items`, never the palette list.
