## Attempt 1 — 2026-11-26

### Files touched
| File | Required because |
|---|---|
| `assets/art/sources/2dpig-office/PixelOfficeAssets.png` (new) | CC0 source sheet, sha256 `797bec77277d0e1144ed6dd536758deef6cabb84d3a0df42b6866c205c146598` (zip sha256 as in CREDITS.md) |
| `assets/art/licences/2dpig-pixel-office.txt` (new) | Byte-identical copy of `D:\project\PixelOffice\LICENSE.txt` (cmp checked); D45 evidence |
| `assets/art/sprite-map.json` | `2dpig-office` source, 5 sprite entries, `_doc` and `missing` updated |
| `assets/art/CREDITS.md` | 2dPig row and sheet note |
| `src/lib/credits.ts`, `src/lib/credits.test.ts` | Credits page entry; exact attribution check |
| `src/lib/sprites/bundled.test.ts` | Count-agnostic assertion (was hard-coded 55) |
| `scripts/sprites/pack.test.ts` | New two-source test; the "placeholders only" warning count 9 -> 10 (one warning per missing sheet, the 2dPig sheet is a new one) |
| `docs/art/asset-candidates.md` | Row 2 accepted |
| `public/sprites/office.png`, `public/sprites/office.json` | Repacked; `meta.version` 4bd6e375f175 -> 8245e17cdb49 |

### Mapped keys: final rects (source px, scale 2, sheet `assets`), verified by crop
Bboxes found by connected-component scan of the sheet (scratch script), then cropped x6 and viewed.
| Key | Rect [x,y,w,h] | Anchor | Packed frame (w x h, manifest anchor) | Crop check |
|---|---|---|---|---|
| window.double | [59,96,26,21] | [-3,5] | 52x42, [6,-10] | Dark-framed two-pane blue window, front, clean |
| door.s | [98,120,16,31] | [0,-1] | 32x62, [0,2] | Blue glass door leaf (one pane plus narrow side panel), clean |
| door.n | [98,120,16,31] | [0,-1] | 32x62, [0,2] | Same cut (no handed view) |
| sofa | [119,66,33,15] | [0,-1] | 66x30, [0,2] | Grey two-seat sofa, front, clean (2 px overhang right) |
| table.coffee | [85,47,26,16] | [-3,0] | 52x32, [6,0] | Plain orange low table, front, clean |

Result: 60 `map` keys (55 Imersa unchanged + 5 new); only door.n, door.s, sofa, table.coffee, window.double flipped placeholder -> map in `office.json`. Pack run: "97 frames (0 export, 60 map, 37 placeholder)", no warnings.

### Left as placeholders (differs from plan estimates)
- `elevator`: the sheet's glass door is a single 16x31 leaf (not a 32x31 double door), so 2x = 32x62 does not fit the 64x64 footprint; used for `door.s/n` (1x2) instead.
- `device.pc`: no PC/tower on the sheet (only a keyboard, thin monitor, black coffee machine).
- `device.phone`: fax/phone at [233,106,15,19] is 30x38 at x2, larger than a 32x32 device slot.
- `door.e/w` (no side view), `shelf.books`, `rack.server`, `whiteboard` (white panel/calendar not clearly a board), `lamp.floor`, `device.other`, `device.monitor.dual`, `desk.pair.*`, `stairs`, `partition.glass`, `label.sign`: no matching sprite.

### Tests added / changed
- `scripts/sprites/pack.test.ts` › "packs a 16 px second source at scale 2 next to a scale-1 source, both as map" (new); "packs placeholders only when sheets are missing" count 10
- `src/lib/credits.test.ts` › exact 2dPig attribution (added to the Imersa test)
- `src/lib/sprites/bundled.test.ts` › count-agnostic

### Checks (actual output summary)
- typecheck: exit 0 (next typegen + tsc)
- check:layers: "816 files, no violations"
- format:check: "All matched files use the correct format."
- test: "Test Files 311 passed | 1 skipped (312); Tests 3136 passed | 9 skipped (3145)"
- build: exit 0

### Out-of-plan files
None.

### Follow-ups (noticed, not done)
- Manual `/dev/roommap` and art-picker look not run (no browser); Ming checks per plan.
- If elevator/PC/phone art is wanted, SIM-042 or a larger pack is needed.

### Scope self-check
- Could the diff be smaller? No (the only extra is the warning-count line in pack.test.ts, forced by the new source).
- Diff size: excluding binary atlas, about +190 / -10 lines (sprite-map.json is most of it).
