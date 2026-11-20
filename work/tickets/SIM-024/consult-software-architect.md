# Consult: software-architect (SIM-024, 2026-11-20)

SIM-024 architecture consult (read-only)

## Findings
1. **Ticket and Ming's note disagree in three places.** The note is newer and matches D55, so it should win.
   - **Placement.** Ticket §Scope and style guide §8b say "bottom-aligns it in the export canvas". Ming's note and D55 say to place pack sprites by the map's `anchor`. The sprite-map `_doc` agrees with the anchor approach: pack sprites are taller than the 16 px headroom.
   - **Placeholder folder.** The ticket says "placeholder art is produced into the same folder first" (`assets/art/export/`). That breaks the priority export > map > placeholder: placeholder files there would beat the sprite map, and real exports would get mixed with generated junk.
   - **Window keys.** The sprite map has keys outside §7: about 22 `wall.*` keys (accepted by D55) and `window.single` / `window.single.top`. D55 only accepts `wall.*`, so the window keys are not explicitly accepted, and the packer "fails on unknown keys".
2. **The §8 anchor example has an unclear sign.** The text says "offset from tile top-left to sprite top-left". But the example `desk.single.s` is `h:40, tiles:[2,1]`, which has 8 px of overhang above the tile, so its anchor should be `[0,-8]`, not `[0,8]`. The sprite map uses the opposite meaning: the pixel inside the rect that sits on the footprint's top-left. So manifest `anchor = [-ax*scale, -ay*scale]`.
3. **No PNG library is installed.** There is no sharp, pngjs, upng or @img in `node_modules/.pnpm`. Node 22 already has `node:zlib` (`inflateSync`, `deflateSync`, `crc32`), which is all a PNG codec needs. `tsconfig` has `allowJs` and includes `scripts/`, so `.mjs` scripts with JSDoc are typechecked. Vitest already runs `scripts/**/*.test.ts`, as `check-layers.test.ts` shows.
4. **The source sheets are present on this machine** (10 sheets, git-ignored). `assets/art/export/` has only `.gitkeep`, so every key today is either from the map or a placeholder.
5. **The image ships `public/`** (Dockerfile:23), so the atlas goes out with the app. CREDITS.md says built output inside the app is allowed. The free tier requires a credit line.
6. **Some keys have per-direction frames with different footprints.** For example, `desk.single.w/e` are `tiles:[1,2]` while `.s/.n` are `[2,1]`. The footprint has to come from the chosen frame, not from the key.

## Recommendations
**Module boundaries (R1)**
- **`src/lib/sprites/`** holds pure TypeScript with no DOM and no `fs`:
  - `types.ts`: the manifest types and a provisional `RoomLayout` type (tiles, items `{key, x, y, rotation}`). SIM-015.1 can reuse it later from the server.
  - `validate.ts`: the manifest validator.
  - `placement.ts`: tile → px with anchor and integer zoom, rotation → direction (0=s, 90=w, 180=n, 270=e, or whatever is decided; see Open questions), footprint taken from the frame, and depth sort by footprint bottom row.
  - `avatar.ts`: an FNV-1a hash of `sub` that picks ramp indices, plus a grey → ramp mapping function.
  - `keys.json`: **one key registry** that both sides share. Each entry: key, group/layer, `directional`, `blocks`, the canvas rule (`tiled` or `subtile`), and the tile footprint for exports. It contains the §7 keys plus the accepted `wall.*` keys. TypeScript imports it via `resolveJsonModule`; the `.mjs` script imports it with `import ... with { type: "json" }`. This avoids two copies of the key list and avoids making Node run TypeScript (type stripping depends on the Node 22 minor version, and `@/` does not resolve in Node).
- **`scripts/`**
  - `sprites-pack.mjs` is the CLI behind `pnpm sprites:pack`.
  - `scripts/sprites/png.mjs` is a small codec, around 150 lines.
    - Decode: non-interlaced, 8-bit RGBA, RGB, grey, grey+alpha and palette (with tRNS), plus palette at 1, 2 and 4 bits if the Imersa sheets use it. Any other format throws a clear error.
    - Encode: RGBA8, filter 0, fixed deflate level, no tEXt or time chunks. That makes the output byte-for-byte deterministic.
  - `scripts/sprites/raster.mjs`: crop, nearest-neighbour scale, blit, fill rect, and a 1 px outline pass around the alpha silhouette.
  - `scripts/sprites/placeholders.mjs`: placeholder drawing.
  - `scripts/sprites/pack.mjs`: a deterministic shelf packer. It sorts by height and then key, and leaves a 1 px gap.
  - Tests go in `scripts/*.test.ts`, the same pattern as today.
  - This is code in the repo, not a new dependency, so it fits "no new libraries without Ming".
  - Option B is to add `pngjs` as a devDependency: fewer lines to maintain, but it needs Ming's approval. Recommend A.
- **`src/ui/roomlayout/`**
  - One plain canvas with `imageSmoothingEnabled=false` and integer zoom.
  - Layers drawn in order: floor → wall → shadow → furniture → avatar → overlay. The shadow is drawn by code from the footprint, never baked into a sprite (§4).
  - An HTML overlay of focusable seat buttons, with name tags on hover/focus (D50).
  - The manifest loader runs the lib validator on the fetched JSON.
  - Avatar recolouring uses an offscreen canvas, cached per (layer, colour).
  - UI copy goes in `src/ui/copy/roomlayout.ts` (D36).
- **Demo page**: under `src/app/...`, guarded by `notFound()` when `NODE_ENV === "production"`. Fixtures live next to it or in `src/ui/roomlayout/fixtures.ts`, with no API calls.

**Manifest contract**
- Keep §8 exactly. Fix the meaning in the plan: draw position = tile top-left × 32 + anchor, and anchor may be negative.
- Anchor by source:
  - Exports: anchor is `[0, -(h - tilesDeep*32)]`. Width must be `tilesW*32` and height must be `tilesD*32` or `+16`; anything else fails.
  - Sub-tile exports: tight canvas, anchor centred horizontally with the bottom on the tile bottom (or a rule Ming prefers).
  - Map entries: anchor is `-anchor*scale`, or `[0,0]` when the map entry has no anchor (floors and walls).
  - Placeholders: same rule as exports.
- `blocks` comes from `keys.json`, because neither the map nor the exports have it.
- Add an optional top-level `meta` object, which the validator ignores but which is well-formed: `{ generator, sources: {<key>: "export"|"map"|"placeholder"}, credits: [...] }`. This makes provenance visible in review diffs and gives the future Credits page its data.
- The validator rejects:
  - unknown keys, or keys missing from the registry;
  - frames that go outside the atlas size (the loader passes the PNG width and height; tests pass numbers);
  - a directional key missing any of n, e, s or w;
  - `tiles` values that are not whole numbers;
  - an unknown layer.

**Priority and fallback (per key)**
- The order is `export/<key>.png` > map entry whose sheet file exists > in-memory placeholder.
- Placeholders are never written to `export/`. If a debug dump is needed, add `--dump-placeholders <dir>` writing to a git-ignored folder.
- A missing sheet gives a warning plus a summary line, never an error.
- An export that is present but malformed (wrong size, unknown key) is a hard failure, as the ticket says. A sheet that is present but cannot be decoded is also a hard failure, so the problem is not hidden locally.
- Placeholders cover **every** registry key, including all `wall.*` keys and the four directions. They are drawn from simple §3-palette shapes with the outline rule and no baked shadow. Avatar layers are drawn in the palette greys so runtime recolouring works.

**Checked-in atlas and CI**
- Commit the atlas built locally with the sheets (Imersa pixels + placeholders). CREDITS.md allows that, and it is what the phase-1 preview shows.
- CI must **not** rebuild and diff the atlas: without the sheets it would produce all placeholders. CI instead runs a Vitest test that:
  - validates the checked-in `office.json`;
  - reads the IHDR of `office.png` and checks that every frame fits inside it;
  - checks that the keys match `keys.json`.
- Also test placeholder-only packing into a temp dir: it must succeed with no sheets.
- **Overwrite guard**: if the run would turn any key that the existing `meta.sources` marks "map" or "export" into "placeholder", refuse to write `public/sprites/` unless `--force` is given, so a machine without the sheets cannot quietly wipe the Imersa art.

## Risks
- **Overwrite.** A developer or CI run of `sprites:pack` without the sheets could replace the Imersa art in the atlas with placeholders. The guard above prevents it.
- **Licence.** Cut Imersa sprites sit in a public repo (`public/sprites/office.png`). CREDITS treats built output as allowed, but someone could pull the sprites out of it. Ming already judged this (CREDITS note); keep it visible. The credit line is required once the art reaches users. The demo is dev-only, so add a follow-up for the Credits page (§9.4).
- **Codec scope.** If the Imersa sheets use interlacing or 16-bit depth, the decoder needs more work. Check the IHDR of the 10 sheets early in IMPLEMENT.
- **Contract drift.** The provisional `RoomLayout` type could clash with SIM-015.1 (still BLOCKED by D47). Keep it minimal and mark it provisional.
- **Draw order.** Overhanging pack sprites (chairs about 28 px above the tile) need a y-sort within the furniture layer, or chairs and desks will overlap wrongly.

## Open questions (for Ming)
1. Are `window.single` and `window.single.top` accepted keys, like `wall.*` under D55, or dropped until §7 lists them?
2. Should the §8 anchor example be corrected to `[0,-8]` (a doc follow-up), with the meaning confirmed as "added to the tile's top-left"?
3. Is a hand-written PNG codec (no dependency) acceptable, or does Ming prefer `pngjs` as a devDependency?
4. What anchor rule should sub-tile exports use (centred, bottom-aligned)? And which rotation maps to which direction: is 0° = `.s`?
5. Should the credit line ("Office Pixel Art by Imersa Studios") appear on the demo page now, or only with the Credits page later?

Files read by the consultant: ticket.md, docs/art/style-guide.md, assets/art/sprite-map.json, assets/art/CREDITS.md, work/decisions.md, package.json, vitest.config.ts, tsconfig.json, Dockerfile, scripts/check-layers.mjs.
