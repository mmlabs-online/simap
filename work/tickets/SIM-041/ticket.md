# SIM-041: Add the 2dPig "Pixel Office" (CC0) pack as a second bundled art source

| Field | Value |
|---|---|
| State | BACKLOG |
| Priority | P2 |
| Size | S |
| Areas | ui |
| Gate | none |
| Depends on | SIM-033 |
| Needs Ming | M-81 |
| Attempts | 0 |
| Created | 2026-11-26 |
| Claimed by | — |
| PR | — |

## Goal
Give more library items real art instead of placeholders by adding a second licence-checked pack, 2dPig
"Pixel Office" (CC0), to the sprite map, so the map and the "Map items" art picker offer more looks.

## Scope reference
- D45 (only CC0, CC-BY or explicit commercial + modify packs; screenshot kept; `CREDITS.md` row; in-app Credits page).
- D54 (phase 1: cut objects from original sheets via `assets/art/sprite-map.json`, 16 px packs scaled 2× to the 32 px
  grid; keys with no source keep placeholders).
- D66 point 5 (the packed atlas of the bundled packs is committed). `docs/art/asset-candidates.md` row 2.
- Ming 2026-11-26: "2 và 3" (find replacement packs; use more of what we have). comshadow stays rejected (D45: games-only
  licence, modification not stated).

## Scope
- New source `2dpig-office` in `assets/art/sprite-map.json` (sheets from `D:\project\PixelOffice.zip`, sha256
  `62e9aaea59dfd967e2f5c51bd3466fe3a1222c1b1ca8f19c0de4385c40ca5ce5`: `PixelOfficeAssets.png` 256×160, `PixelOffice.png`).
- Map 2dPig sprites onto **existing registry keys that are placeholders today** (candidates: `sofa`, `door.*`,
  `window.double`, `table.coffee`, `shelf.books`, `lamp.floor`, `whiteboard`, `rack.server`, `device.phone`,
  `device.pc`), only where a sprite fits the key's footprint and view; the rest stay placeholders.
- `CREDITS.md` row, licence text copied to `assets/art/licences/2dpig-pixel-office.txt`, screenshot (M-81),
  Credits page entry (`src/lib/credits.ts`), `asset-candidates.md` row 2 → accepted.
- Repack `public/sprites/office.png/json`.

## Out of scope
- New library keys or catalog rows (SIM-042). Recolouring to the style-2 palette (D54 phase 2). Avatars.
- The comshadow pack.

## Acceptance criteria
- [ ] `pnpm sprites:pack` builds the atlas with every mapped 2dPig key as `map` source; no Imersa key changes source.
- [ ] Each mapped 2dPig sprite has a rect, scale (2 for 16 px art) and anchor in `sprite-map.json`, tiles match the
      registry, verified by crop as for Imersa (D54).
- [ ] `CREDITS.md` has a 2dPig row with licence "CC0 1.0", commercial yes, modify yes, and the derived keys; licence
      text and screenshot are in `assets/art/licences/`.
- [ ] The Credits page lists 2dPig with an https link; `credits.test.ts` parity with `CREDITS.md` passes and comshadow
      is still absent.
- [ ] Committed atlas test (`scripts/sprites/committed-atlas.test.ts`) and all Checks pass.

## Technical notes
- Files: `assets/art/sprite-map.json`, `assets/art/sources/2dpig-office/*` (CC0 allows committing the sheets, unlike
  Imersa; keep `.gitignore` consistent), `assets/art/CREDITS.md`, `assets/art/licences/`, `docs/art/asset-candidates.md`,
  `src/lib/credits.ts` (+ test), `public/sprites/office.*`.
- Risks: 2dPig is a front/side view and smaller-scale than Imersa, so mixed styles on one map; directional keys
  (`door.n/e/s/w`) may only get one view; map only what looks right and list the rest in the impl-log.
- Ming packs the real atlas from a PC (M-63 precedent): the Imersa sheets are git-ignored, so the implementer must
  run `sprites:pack` where both packs' sheets exist or the guard refuses to overwrite.

## Test plan
- Unit: `credits.test.ts`, `registry.test.ts`, `committed-atlas.test.ts`, `pack.test.ts` (map source for a 2dPig key).
- Manual: `/dev/roommap` and "Map items" art picker show the new sprites.

## Notes / answers from Ming
- 2026-11-26 Ming: "bỏ M-81" — no screenshot needed; the CC0 `LICENSE.txt` from the zip, copied to `assets/art/licences/2dpig-pixel-office.txt`, is the licence evidence (D45). The CREDITS.md row names that file in the Screenshot column.

## Handoff
