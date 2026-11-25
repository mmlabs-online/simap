# Review — SIM-039.8

## Attempt 1 — 2026-11-25
Verdict: PASS

### Checks (run by reviewer)
- `pnpm format:check` — exit 0, "All matched files use the correct format."
- `pnpm typecheck` — exit 0 (next typegen + tsc --noEmit, no errors).
- `pnpm check:layers` — exit 0, "check-layers: 782 files, no violations".
- `pnpm test` — exit 0, "Test Files 295 passed | 1 skipped (296); Tests 3002 passed | 7 skipped (3009)". Matches impl-log.
- `pnpm build` — exit 0.
- `pnpm test:db` — not run (no server, API or DB change; `git diff origin/main...HEAD -- src/server src/app db docs` is empty).

### Acceptance criteria
- [x] 1 Custom art on editor and read-only map; fallback custom image → package sprite → library frame → placeholder —
  evidence: chain in `src/lib/sprites/item-art.ts:66-96` matches spec "Art per item" order (image only when ready and
  `imageFits`; missing package frame pushed to `unknown` then library frame; then placeholder); tests
  `item-art.test.ts` › "a ready image that fits wins", "image not ready falls to the package sprite, then the library
  frame, then the placeholder", "a decoded size that does not fit counts as failed"; `placement.test.ts:464`, `:488`,
  `:525`, desk/chair/floor image case; `paint.test.ts` item image 1:1, placeholder, missing-source isolation (all
  pass). Wiring: `RoomMapSection.tsx:51` (`items={view.items}`), `RoomMap.tsx` / `EditorCanvas.tsx` pass
  `{ items, image: catalogImages?.itemSize }`, `SeatsPage.tsx:68`, `LayoutEditor.tsx:74-82,199`,
  `LayoutEditorPage.tsx:85`.
- [x] 1b Nothing customised → byte-identical (LAY-03) — evidence: `placement.test.ts:441` "seed catalog rows change
  nothing" builds rows from every `LIBRARY_ITEMS` entry (seats, fixtures, floors, `chair.office`) with null sprites and
  no images, which is what the DB seed stores (`db/migrations/20261125200000_map_items.sql:14-17`, art sprite columns
  nullable, seeded null); places every directional item at all four rotations (non-directional items may not rotate:
  `validate/layout.ts:172`), seats with devices (so implied chairs and device slots are covered) and 2×2 floor zones;
  asserts `toEqual` against the list without items, and >100 ops. Guaranteed also by construction:
  `placement.ts:220` shift is 0 for the library frame when the row size equals the library default.
- [x] 2 Resized item's package sprite bottom-left aligned — evidence: `placement.test.ts:498` (1×1 `plant.small` in a
  3×2 `cabinet.filing` at 0/90/180/270, frame y and shadow follow the sprite's own tile), `:514` (resized library frame
  shifted one tile; unresized unchanged).
- [x] 3 Bearer `blob:` URLs once per key/dir/version — evidence: `map-items-api.ts` `getArtImage` goes through the
  `apiFetch` fetcher; `map-items-api.test.ts` (encoded path, non-png not ok, 404, signed_out, fetch failure);
  `catalog-images.test.ts` item cases (one load per `{key, dir, version}`, version bump revokes `blob:1` and reloads,
  removed entry revoked `blob:2`, failed stays failed, devices and items share one cache, `itemSize` per version);
  `item-art.test.ts` › `placedArtEntries` (only placed dirs with images, deduped, chair direction equals
  `chairFor(...).key` suffix for all four rotations). Checks green.

Specific points asked by the orchestrator:
- Import cycle: `item-art.ts` imports only `@/lib/map-items/types` (value: `MAP_ITEM_LIMITS`; that file imports only a
  type from `sprites/types`) and type-only `./layout`, `./types`. No import of `map-items/art`, `library` or
  `placement`. `ROTATION_DIR` duplication is asserted equal to `ROTATION_TO_DIR` in `item-art.test.ts` (itemArtDir case).
- Blob URLs revoked: existing `createImageUrlCache` revoke-on-drop/version-bump and `dispose` on unmount now serve
  item entries too (tested above).
- Paint effect deps: `RoomMap.tsx` and `EditorCanvas.tsx` paint effects now depend on `catalogImages` (memo keyed on
  `version`), so a newly decoded source repaints; draw-list memos add `items`.

### Issues
None.

### Rules (CLAUDE.md)
No violations found. R1: new code in `src/lib/**` (pure) and `src/ui/**` only, `pnpm check:layers` clean. R4: every
changed product file is in the plan's file list; `work/ming-todo.md` change is the M-73 approval tick. R5: new logic
has tests. R3/R6/R7: no config, server or route change. D36: no new copy.

### Blockers from review agents
None.

### Nits (do not block)
- Plan Tests listed "itemBox ... matches `footprintAt(..., catalogFootprints(...))` for a 3×1 item"; the test checks the
  swap on `table.meeting` (3×2) but not against `footprintAt`.
- `useCatalogImages` sync guard `seatDevices || items` is always true on the editor page (`editorArt` starts as `[]`),
  so it syncs an empty set before the view loads; harmless.
- `resolveItemArt` pushes a missing package sprite to `unknown` once per placement (duplicates possible), as the
  existing `lookup` does.

### Follow-ups (out of scope)
- From impl-log: `placedArtEntries` derives the chair direction from the rotation, while `placement.ts` uses the
  registry `dir` of the desk frame first; equal for the current library, would diverge for a desk key with a fixed
  registry direction.
