Status: READY

# Plan — SIM-041: Add the 2dPig "Pixel Office" (CC0) pack as a second bundled art source

## Scope summary
- Ticket goal: "Give more library items real art instead of placeholders by adding a second licence-checked pack, 2dPig "Pixel Office" (CC0), to the sprite map, so the map and the "Map items" art picker offer more looks."
- Ticket scope: "Map 2dPig sprites onto **existing registry keys that are placeholders today** ... only where a sprite fits the key's footprint and view; the rest stay placeholders." Plus the `CREDITS.md` row, the licence text, the Credits page entry, `asset-candidates.md` row 2 -> accepted, and a repacked `public/sprites/office.png/json`.
- D45: "only CC0, CC-BY or explicit commercial + modify packs; screenshot kept; `CREDITS.md` row; in-app Credits page."
- D54: "phase 1: cut objects from original sheets via `assets/art/sprite-map.json`, 16 px packs scaled 2x to the 32 px grid; keys with no source keep placeholders."
- D66 point 5: "The packed atlas of the licensed bundled pack is committed."
- Ming 2026-11-26 (M-81 waived): no screenshot; `D:\project\PixelOffice\LICENSE.txt` (CC0 1.0) copied to `assets/art/licences/2dpig-pixel-office.txt` is the licence evidence, and the CREDITS.md row names that file in the Screenshot column.
- Out of scope: new keys/catalog rows (SIM-042), recolouring (D54 phase 2), avatars, comshadow (stays rejected).

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | `pnpm sprites:pack` builds the atlas with every mapped 2dPig key as `map` source; no Imersa key changes source. | `scripts/sprites/committed-atlas.test.ts` › "every sprite-map key is a map frame..." passes. `git diff public/sprites/office.json` shows `meta.sources` changing only for the new keys (placeholder -> map); the 55 existing Imersa keys keep `map`. Pack output logs no "source sheet missing" warning. |
| 2 | Each mapped 2dPig sprite has rect, scale (2), anchor in `sprite-map.json`; tiles match the registry; verified by crop (D54). | `pnpm sprites:pack` has no "tiles ... must be ..." error (`pack.mjs:114-118`). The impl-log has a table of the final rects and a crop check per key (implementer's scratch crop viewed with Read; reviewer may repeat it). `pack.test.ts` new test (below). |
| 3 | `CREDITS.md` has a 2dPig row: "CC0 1.0", commercial yes, modify yes, derived keys; licence text in `assets/art/licences/`. | Read `assets/art/CREDITS.md`; `git ls-files assets/art/licences` lists `2dpig-pixel-office.txt`, content equals `D:\project\PixelOffice\LICENSE.txt`. Screenshot column cites that file (M-81 waived). |
| 4 | Credits page lists 2dPig with an https link; `credits.test.ts` parity passes; comshadow absent. | `src/lib/credits.test.ts` (parity, no empty field, https, no "comshadow") and `src/ui/credits/CreditsPage.test.tsx` pass. In `pnpm dev`, `/credits` shows both packs. |
| 5 | Committed atlas test and all Checks pass. | `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `pnpm test` (includes `committed-atlas.test.ts`, `bundled.test.ts`), `pnpm build` all green per `.claude/loop.config.md` Checks. |

## Ming verification after merge
- In `/dev/roommap` and the "Map items" art picker, look at the new looks (sofa, coffee table, window, elevator, doors, PC) next to the Imersa art. The art is a different style and scale (16 px front view scaled 2x); Ming decides whether any mapped key looks too out of place and should go back to a placeholder (one-line removal from `sprite-map.json` plus repack).

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `assets/art/sources/2dpig-office/PixelOfficeAssets.png` (new, copy from `D:\project\PixelOffice\`) | Copy the one sheet used. CC0, so committed (the Imersa `.gitignore` entry covers only `imersa-office/`). | Source for the cuts; lets anyone repack. | no |
| `assets/art/licences/2dpig-pixel-office.txt` (new) | Copy of `D:\project\PixelOffice\LICENSE.txt` (CC0 1.0). | D45 evidence (M-81 waived). | no |
| `assets/art/sprite-map.json` | Add `sources["2dpig-office"] = { files: { assets: "assets/art/sources/2dpig-office/PixelOfficeAssets.png" }, tile: 16, pack: "Pixel Office, 2dPig (CC0 1.0)" }` and the sprite entries below. Update `_doc` line 6 (sources not committed) to say "except CC0 packs such as 2dpig-office". Remove the mapped keys from the `missing` list (lines 485-508) and fix `device.pc` / `window.double` / `table.coffee` / `sofa` / `door` wording there. | AC1, AC2 | no |
| `assets/art/CREDITS.md` | Add a row after line 8: Pack "Pixel Office", Author "2dPig", URL `https://2dpig.itch.io/pixel-office`, Licence "CC0 1.0 Universal (Public Domain Dedication; `LICENSE.txt` in the zip)", Commercial yes, Modify yes, Attribution `Pixel Office by 2dPig (https://2dpig.itch.io/pixel-office)` (README: "No attribution is required but it is greatly appreciated"), Screenshot `licences/2dpig-pixel-office.txt` (no screenshot: Ming waived M-81), Sprites derived = the mapped keys. Extend the line 16-22 note: the 2dPig sheet is committed (CC0), zip sha256 `62e9aaea59dfd967e2f5c51bd3466fe3a1222c1b1ca8f19c0de4385c40ca5ce5`. | AC3 | no |
| `src/lib/credits.ts` | Add the 2dPig entry (same pack, author, url, attribution as the row; licence "CC0 1.0 (public domain): no attribution required, credited anyway."). | AC4 | no |
| `src/lib/credits.test.ts` | Add an exact-attribution check for 2dPig; keep parity and comshadow checks. Note the row parser splits on unescaped `|`, so no `|` in the new cells. | AC4, R5 | no (low) |
| `src/lib/sprites/bundled.test.ts` | Line 28: replace the hard-coded `55` with `Object.keys(map.sprites).length` (the set-equality assertion at line 27 already holds). Rename the test title (line 23). | The hard-coded 55 breaks as soon as keys are added. | no (low) |
| `scripts/sprites/pack.test.ts` | Add a test: a map with two sources (a tiny "imersa" and a tiny "cc0" sheet written to temp files, scale 1 and 2) packs both as `map`, and the 2x cut has doubled frame size. | Acceptance "pack.test.ts (map source for a 2dPig key)". | no (low) |
| `docs/art/asset-candidates.md` | Row 2 (line 11): size "16x16", hint "CC0 1.0 (LICENSE.txt in zip)", status "**accepted 2026-11-26** (CC0; `licences/2dpig-pixel-office.txt`)". | Ticket scope | no |
| `public/sprites/office.png`, `public/sprites/office.json` | Repacked (`pnpm sprites:pack`). | D66 (5), AC1 | no |

`committed-atlas.test.ts`: no edit needed (its assertions already adapt to the map keys); it must pass after the repack. **High paths touched: none.**

## Data model / migration
None.

## API contract
None.

## Sprite map entries (the core of this plan)
Source sheet: `assets` = `PixelOfficeAssets.png` (256x160, 16 px art). All entries: `"source": "2dpig-office"`, `"sheet": "assets"`, `"scale": 2`.

**Important, read first.** The rects below were read by eye from a 256x160 view; they are good to about +-4 px and the sheet has no atlas JSON. The implementer must NOT copy them blindly. Procedure for each key (D54 "verified by crop"):
1. Write a scratch script in the session scratchpad (not the repo) that uses `scripts/sprites/png.mjs` `decodePng` to find the tight bounding box of non-transparent pixels in the search region. Print `[x, y, w, h]`.
2. Crop that rect (and the x2 result via `raster.mjs` `crop`/`scaleNearest`), write the PNG to the scratchpad and view it with Read. Confirm it is the intended object, front view, with no neighbour pixels.
3. Put the tight rect in `sprite-map.json`. Sprite sizes below are cross-checked against the example scene (`PixelOffice.png`/`LargePixelOffice.png`, scene px = sheet px).

| Key | Tiles (registry) | Sprite and search region on the sheet (approx.) | Expected size (source px) | Scale | Anchor (source px, `anchor` = pixel of the rect on the footprint's top-left; manifest anchor = -anchor*scale) |
|---|---|---|---|---|---|
| `window.double` | [2,1] = 64x32 | The dark-blue two-pane window, region x 56-92, y 94-120 | ~26x21 (scene 132-236 x 320-404 /4) | 2 | `[-3, 5]` (centre in 32 px width; 5 px headroom above, bottom-aligned). Adjust to the real w/h: `x = -(32-w)/2`, `y = h-16`. |
| `elevator` | [2,2] = 64x64 | The blue glass sliding double door (two leaves in one frame), region x 90-130, y 90-125. Not in the ticket's candidate list but it is an existing placeholder whose 2x2 footprint the 32x31 door fits exactly. | ~32x31 (scene 444-572 x 328-452 /4) | 2 | `[0, -1]` (bottom-aligned in 32 px height: `y = h-32`) |
| `door.s`, `door.n` | [1,2] = 32x64 | One leaf of the same glass door (left half of the rect found for `elevator`, `w/2` wide, same y/h). The glass door has no handed front/back, so the same rect serves `.s` and `.n`. | ~16x31 | 2 | `[0, -1]` (same rule as elevator) |
| `sofa` | [2,1] = 64x32 | A front-view two-seat sofa. The sheet has a column of four coloured sofas at about x 116-158, y 62-136 (grey, green, blue, orange). Pick the grey one (neutral next to Imersa greys); use blue if grey is not a clean front view. | ~33x16 (scene 744-876 x 416-480 /4) | 2 | `[0, 0]` (66 px wide, overhangs 2 px right; or crop to 32 px wide if the sofa has a 1 px outline margin) |
| `table.coffee` | [2,1] = 64x32 | The plain orange table (no items on it), region x 84-112, y 44-62 | ~26x16 (scene 144-246 x 410-476 /4) | 2 | `[-3, 0]` (centre: `x = -(32-w)/2`) |
| `device.pc` | null (sub-tile, <=32x32) | The beige computer unit (CRT/tower), front view, region x 225-250, y 115-150. Map it only if the crop is clearly a PC front view; otherwise keep the placeholder. | ~10x14 (scene cubicle monitor) | 2 | `[-3, -2]` (centre in 32 px, bottom-aligned: `x = -(16-w)/2`, `y = -(16-h)` for a 16 px tile; adjust so the sprite sits at the tile bottom-centre like the Imersa device anchors) |

Tiles in each entry must equal the registry value (the packer errors otherwise, `pack.mjs:114-118`). `device.pc` has `tiles: null` in the registry, so its map entry uses `[1, 1]` (as `device.monitor.*` do).

**Stay placeholders (list in impl-log with the reason):**
- `door.e`, `door.w` (2x1 footprints): the pack has no side-view door.
- `shelf.books`: the only shelf-like sprite is the drinks fridge (24x30), which is not books and is too wide.
- `rack.server`: the vending machine / fridge (24x34, 24x30) would be 48 px wide in a 32 px footprint and does not look like a rack.
- `whiteboard`: the sheet has a wall calendar (17x11) and a white wall panel; neither is clearly a whiteboard. Map the panel only if the crop clearly reads as a board; default is placeholder.
- `lamp.floor`, `device.phone`, `device.other`, `device.monitor.dual`, `desk.pair.*`, `stairs`, `partition.glass`, `label.sign`: no matching sprite.
- Everything else already has Imersa art and is not touched (rule in the ticket: "no Imersa key changes source").

Expected result: 6 to 8 new `map` keys (`window.double`, `elevator`, `door.s`, `door.n`, `sofa`, `table.coffee`, plus `device.pc` and maybe `whiteboard`), so `sources` goes from 55 to 61-63 `map` keys. The implementer drops any key whose crop does not look right, and records it.

## Tests to write
| Test (file › name) | Covers |
|---|---|
| `scripts/sprites/pack.test.ts` › "packs a 16 px second source at scale 2 next to a scale-1 source, both as map" | A second source in `sprite-map.json` works; 2x frame is doubled; tiles check |
| `src/lib/credits.test.ts` › "2dPig entry has the exact attribution string" (and existing parity test) | AC4, `CREDITS.md` and `credits.ts` stay in sync, comshadow absent |
| `src/lib/sprites/bundled.test.ts` › existing committed-atlas test, now count-agnostic | Bundled set equals sprite-map keys after the repack |
| `scripts/sprites/committed-atlas.test.ts` (existing, unchanged) | JSON/PNG pairing; every sprite-map key is `map` |
| `src/ui/credits/CreditsPage.test.tsx` (existing) | Must stay green with two entries; if it asserts "one card", change it to `CREDITS.length` |

## Approach
Local env note (no shell for the planner; for the implementer): Node/pnpm are not on PATH. In PowerShell:
`$fnm = Get-ChildItem "C:\Users\ttngo\AppData\Local\Microsoft\WinGet\Packages\Schniz.fnm_Microsoft.Winget.Source_8wekyb3d8bbwe" -Filter fnm.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName; & $fnm env --shell powershell | Out-String | Invoke-Expression; & $fnm use 22` then `cmd /c "pnpm ..."`.

1. Copy `D:\project\PixelOffice\PixelOfficeAssets.png` to `assets/art/sources/2dpig-office/` and `LICENSE.txt` to `assets/art/licences/2dpig-pixel-office.txt`. Run `git status` and confirm both are tracked (not ignored); `.gitignore:16-17` only ignores `imersa-office/`.
2. Confirm `assets/art/sources/imersa-office/` exists locally (it does on this machine), so the pack run has both packs' sheets and the `guard()` (`pack.mjs:203-220`) will not refuse. Never use `--force`.
3. Find and verify each rect (procedure above). Add the `2dpig-office` source and the sprite entries to `sprite-map.json`; update `_doc` and `missing`.
4. Run `pnpm sprites:pack`. Expect no warnings and no errors. Check `git diff public/sprites/office.json`: only new keys flip to `map`; no Imersa key changes source.
5. Update `bundled.test.ts` (count), add the `pack.test.ts` test, update `credits.ts` + `credits.test.ts`, `CREDITS.md`, `asset-candidates.md`.
6. Run `pnpm test`, `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check` (oxfmt on the JSON/MD/TS files you touched), `pnpm build`. Also run the full suite once because other tests read the committed `office.json` (SIM-033 plan note on `SeatOverlay.test.tsx`).
7. Manual: `pnpm dev`, open `/dev/roommap` and the "Map items" art picker, and look at each new sprite (sofa, table, window, elevator, door, PC), including that frames are not clipped and that anchors place them on their footprint. If one looks wrong, fix its anchor or drop the key and repack.
8. Impl-log: final rect table, crop checks, the keys left as placeholders with reasons, the sheet sha256, and the new `meta.version`.

Rules: R1-R2, R6-R7 not touched (no server, schema or endpoint). R3: no config. R4: new keys and recolouring are follow-ups (SIM-042, D54 phase 2). R5: tests listed.

## Specialist input used
None (no consult files).

## Assumptions
- A1 Elevator: mapped although it is not in the ticket's candidate list, because the ticket allows any existing placeholder key whose footprint fits, and the glass door fits `elevator` [2,2] better than any `door.*` key. If Ming prefers not to show an elevator as a door, drop it.
- A2 Door: only `door.s`/`door.n` get a (half-leaf) cut; `door.e/w` stay placeholders. The half leaf may look odd; drop `door.*` if it does.
- A3 Rects are estimates; the implementer finalises them with the bbox/crop procedure and records them. If the sheet turns out to hold different objects than assumed (for example no plain coffee table), the key stays a placeholder.
- A4 CREDITS.md Screenshot column holds the licence text path, not a screenshot (Ming waived M-81).
- A5 The committed 2dPig sheet is CC0, so committing it is allowed (unlike Imersa). Only `PixelOfficeAssets.png` is committed (the example scene is not used).
- A6 Mixed styles (front view 16 px x2 beside the Imersa top-down-ish 32 px art) are accepted by the ticket (risks section).
- Hotspots: `assets/art/sprite-map.json`, `public/sprites/office.*`, `src/lib/credits.ts`, `assets/art/CREDITS.md` may also be edited by SIM-042 (BACKLOG, not yet started); expect a rebase and a repack if it lands first. No other IN_PROGRESS/REVIEW/DONE ticket lists these files.

## Blocking questions
None.

## Split proposal
None. About 150 changed lines excluding the binary atlas.
