SIM-033 consult (software-architect, read-only)

## Findings

**Pipeline (scripts/sprites/pack.mjs, scripts/sprites-pack.mjs)**
- F1. For each key the packer picks `assets/art/export/<key>.png`, then the sprite map, then a placeholder. A missing sheet only logs a warning and falls back to a placeholder. A malformed sheet is an error. `selfCheck` makes sure the manifest keys equal the registry. `guard()` refuses to overwrite a committed atlas if any `map`/`export` frame would turn into a placeholder, unless `--force` is passed. So if someone without the sheets runs `pnpm sprites:pack` or `--no-map`, it fails safely instead of quietly wiping the real atlas. Running `pnpm sprites:pack --no-map --force` still would wipe it. Nothing in `.github/workflows` runs `sprites:pack` (grep found no match), so CI and the image build use the committed atlas as it is. AC4 already holds structurally.
- F2. The committed `public/sprites/office.json` has `meta.version` "4bd6e375f175" (sha256 of the PNG, first 12 chars) and `meta.sources` per key. About 42 keys are still placeholders: avatars, state, desk.pair, door, elevator, stairs, sofa, wall.base, wall.face.shade, window.double, device.pc/phone/other/monitor.dual and others. The rest are `map` (Imersa).
- F3. **`scripts/sprites/committed-atlas.test.ts:27-32` will fail now.** "committed atlas is placeholder-only (M-10 default)" only accepts placeholder/export. Its own comment says to delete it once Ming allows the Imersa build, which D66 point 5 does. Without this change, `pnpm test` is red and R5 blocks PASS.
- F4. Registry and keys are consistent. `registry.test.ts` checks sprite-map keys and footprints against `keys.json`. `committed-atlas.test.ts` checks that the manifest keys and `blocks` match the registry and that the manifest validates against the PNG size. Nothing checks that the committed JSON and PNG come from the same pack run (version equals the PNG hash), or that every sprite-map key is really `map` in the committed manifest.

**Delivery to production and caching**
- F5. Dockerfile line 25 `COPY --from=build /app/public ./public` ships both atlas files. `public/` holds only `.gitkeep` and the two atlas files, and `.dockerignore` does not exclude `public`. So the atlas reaches the image without touching Dockerfile or `.dockerignore`. The build stage runs `COPY . .`, so a local `docker build` from Ming's tree would copy `assets/art/sources/imersa-office/` into the build stage. It never reaches the runtime stage (only standalone, `.next/static` and `public` are copied). CI checkouts never have the sheets because they are git-ignored.
- F6. Cache-busting is already in place. `src/ui/roomlayout/loadAtlas.ts` fetches `office.json` with `cache: "no-cache"` and loads `office.png?v=<meta.version>`. Since the version is a content hash, a changed PNG gets a new URL. Cloudflare includes the query string in its cache key by default. `next.config.ts` sets no cache headers for `/sprites`. No change needed.

**Licence compliance**
- F7. `LICENSE.txt` requires the credit "Office Pixel Art by Imersa Studios" in your credits, with a link to https://imersastudios.itch.io/office-pixel-art "if you can". It forbids redistributing the assets "edited or not, alone or in an asset pack, template or tileset (they can only ship inside your project)". `CREDITS.md` already has the exact attribution text, and the screenshot `assets/art/licences/imersa-office.png` exists, so AC2's "screenshot and credits row in place" is already met.
- F8. **`assets/art/CREDITS.md:16` says "this repo is public".** D45 ("the repo stays private") and D60 ("The repo is private") say the opposite. This matters: a packed atlas committed to a *public* repo could count as redistributing a "tileset", which the licence forbids. In a private repo, the atlas only ships inside the app, which is allowed.
- F9. `LICENSE.txt` sits only inside the git-ignored sources folder. The only committed licence evidence is the screenshot.
- F10. There is no Credits page or credits data anywhere in `src/` yet (grep for credits/Imersa found nothing). Spec §"Art per item" (line 402) says every bundled third-party package is credited on the in-app Credits page.

**Package sprite list (scope point 2)**
- F11. `spriteChoices` (`src/ui/mapItems/map-item-art.ts:46`) and `DEVICE_SPRITE_FAMILIES` (`src/lib/sprites/device-sprites.ts`) list every registry key, placeholder-only ones included. On the server, `spriteAllowedFor` (`src/lib/map-items/art.ts:22`, used by `src/server/map-items/edit.ts:238`) checks only the registry and group. "Exactly the bundled keys" is therefore not true today on either side.

**High paths**
- F12. The minimal change touches no High path: the test, CREDITS.md, a lib credits module, a page under `src/app/credits`, and the UI filter. Dockerfile and `.dockerignore` would only change for optional hardening (R2 below). `next.config.ts` is High and not needed. The gate stays plan-approval because of P1.

## Recommendations

- R1 (AC4, R5): Delete the placeholder-only test and add tests for the committed state instead:
  - (a) `meta.version` equals `sha256(office.png).slice(0,12)`, which catches a hand-edited or mismatched JSON/PNG pair;
  - (b) every key in `assets/art/sprite-map.json` has `meta.sources[key] === "map"`, so the real art can't silently disappear;
  - (c) every other key is `placeholder` or `export`.
  The existing `pack.test.ts` `--no-map` and placeholder tests run on temp roots and can stay. Also check that a test confirms `guard()` refuses `--no-map` over a `map` atlas without `--force`, and add one if it's missing.
- R2 (AC1, licence): Keep the Dockerfile unchanged. Optional hardening, a High path that Ming must approve: add `assets/art/sources` to `.dockerignore` so the sheets can't enter even the build stage of a local build. Don't exclude all of `assets/`, because R4 may need `sprite-map.json`.
- R3 (AC3, R1 layers): Store the credits as typed data in `src/lib/credits.ts`: pack, author, URL, licence name, attribution text. Pages can import lib, and UI copy goes in `src/ui/copy/credits.ts` (D36). Don't parse the Markdown at runtime, because `assets/` is not app code. Add a Vitest test that reads `assets/art/CREDITS.md` and asserts every table row's attribution text appears verbatim in `credits.ts`, and the reverse. This covers "exact attribution text" and the ticket's "Unit: Credits data rendering". Render the URL as a link (`rel="noopener noreferrer"`).
- R4 (scope point 2): The cheapest option is UI-only: filter `spriteChoices` and the device sprite picker by `atlas.manifest.meta.sources[k] === "map"`. With no `meta`, fall back to today's full list. The server would still accept placeholder keys. The stronger option is a lib-level `BUNDLED_KEYS`, used by `spriteAllowedFor` and `deviceSpriteAllowed` too. It could be generated, or a committed copy with a test asserting it equals the sprite-map keys; importing `assets/` from `src/lib` slips past `check:layers` (`layerOf` returns null) but breaks the "lib is pure src" intent. Ask Ming which one (Q2). If the server narrows, existing picks of non-bundled keys still need to render (fallback chain) and must not 422 when other fields are edited.
- R5 (licence hygiene): Fix `CREDITS.md:16` to say private and explain why the atlas commit is allowed (D66 point 5: it ships inside the app only). Copy the licence text to a committed `assets/art/licences/imersa-office-LICENSE.txt`. It is licence text, not an asset, and gives evidence next to the screenshot.
- R6 (AC3): Link to the Credits page from somewhere reachable without admin rights. Suggested: the app shell footer or header, plus the sign-in view. Put it in `src/app/credits/page.tsx` as a static page that doesn't depend on the auth gate.
- R7: Record in the impl-log that the atlas was packed from the Free v1.0 zip (sha256 already in CREDITS.md) and the `meta.version`. That way the next repack can be checked.

## Risks

- K1: Repo visibility. If the repo is ever made public, the committed atlas is probably a licence breach (counts as redistributing a "tileset"). Worth one line in decisions or CREDITS.md: "atlas commit assumes a private repo".
- K2: Running `pnpm sprites:pack --force` (or `--no-map --force`) without the sheets silently downgrades the atlas. The new R1(b) test catches this in CI.
- K3: Narrowing the server validation (R4, strong option) may turn already-saved package picks of placeholder-only keys invalid. This touches SIM-039.x behaviour (R4 ticket scope). If chosen, keep it read-tolerant.
- K4: Under D61 and D66, desks and devices draw at fixed slot offsets. Real Imersa frames for the 55 map keys (e.g. `desk.single`, `device.monitor`) may overhang differently than the placeholders, so the manual check should look at a desk with devices. `SeatOverlay.test.tsx` reads the committed `office.json`, so check its expectations don't depend on placeholder sizes.
- K5: The atlas grows. Still one request, and the PNG is hash-busted, so the only cost is a one-time download per version.

## Open questions

- Q1: Is the repo private, and will it stay private? CREDITS.md says public; D45 and D60 say private. This decides whether the atlas commit is licence-safe.
- Q2: Should "package sprite list = exactly the bundled keys" be enforced only in the UI browser (cheap, reversible) or also server-side? And what happens to picks already saved that point at non-bundled keys?
- Q3: Where should the Credits link appear (footer of every page, sign-in, map view), and should `/credits` be reachable when signed out?
- Q4: Do the in-house placeholder sprites deserve a line on the Credits page ("other sprites: simap"), or only the third-party packs? The licence only requires the latter.
- Q5: Should the optional `.dockerignore` hardening (High) be part of this ticket, or go to a follow-up?

Files: d:\project\simap-game-ui\scripts\sprites\committed-atlas.test.ts, d:\project\simap-game-ui\scripts\sprites\pack.mjs, d:\project\simap-game-ui\assets\art\CREDITS.md, d:\project\simap-game-ui\src\ui\roomlayout\loadAtlas.ts, d:\project\simap-game-ui\src\ui\mapItems\map-item-art.ts, d:\project\simap-game-ui\src\lib\map-items\art.ts, d:\project\simap-game-ui\src\lib\sprites\device-sprites.ts, d:\project\simap-game-ui\Dockerfile, d:\project\simap-game-ui\.dockerignore, d:\project\simap-game-ui\public\sprites\office.json
