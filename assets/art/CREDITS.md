# Art credits and licences

One row per third-party source used in `public/sprites/` (D45). Add the row before using the source. Licence
screenshots live in `assets/art/licences/`. Sprites drawn in-house need no row.

| Pack | Author | URL | Licence (exact name) | Commercial | Modify | Attribution text | Screenshot | Sprites derived |
|---|---|---|---|---|---|---|---|---|
| Office Pixel Art (Free v1.0) | Imersa Studios | https://imersastudios.itch.io/office-pixel-art | Custom itch.io licence (page "License" section + `LICENSE.txt` in the zip): "Use the assets in personal and commercial projects (games, apps, videos, game jams)." / "Edit and recolour them, and mix them with other assets." Not allowed: resell or redistribute the assets themselves, AI training, NFT. Free tier: credit required. | yes | yes | Office Pixel Art by Imersa Studios (https://imersastudios.itch.io/office-pixel-art) | `licences/imersa-office.png` | every `imersa-office` key in `assets/art/sprite-map.json` (floors, walls, window, desk, chair, monitor, laptop, mug, papers, filing cabinet, meeting table, plants, wall clock, desk lamp, water cooler, trash bin, projector screen, flip chart) |
| Pixel Office | 2dPig | https://2dpig.itch.io/pixel-office | CC0 1.0 Universal (Public Domain Dedication; `LICENSE.txt` in the zip) | yes | yes | Pixel Office by 2dPig (https://2dpig.itch.io/pixel-office) | `licences/2dpig-pixel-office.txt` (licence text; no screenshot, Ming waived M-81 on 2026-11-26) | every `2dpig-office` key in `assets/art/sprite-map.json` (window.double, door.s, door.n, sofa, table.coffee) |

Rejected (no row, not used):
- Modern Office Interior Tileset, Cute SCKR (comshadow), https://comshadow.itch.io/modern-office-interior-tileset,
  checked 2026-11-20: paid ($3.99 minimum), terms say "Personal and commercial use allowed in game projects." (limited
  to games), modification not mentioned, no licence row under "More information", marked "AI Assisted, Graphics".
  Screenshot: `licences/comshadow-modern-office.png`.

Note: the 2dPig sheet `assets/art/sources/2dpig-office/PixelOfficeAssets.png` is CC0, so it is committed (zip sha256
`62e9aaea59dfd967e2f5c51bd3466fe3a1222c1b1ca8f19c0de4385c40ca5ce5`).

Note: the Imersa licence forbids redistributing the asset files, so the original sheets in
`assets/art/sources/imersa-office/` are git-ignored and never committed; copy them from the downloaded zip (Free v1.0,
sha256 `bac93deafbf82181262539fbf2339590f88c68ab16033dff37de2fffc1f3bfcd`): `Props/_Atlases/*`,
`Tilesets/Floors/office_floors_tileset.png`, `Tilesets/Walls_Plain/office_walls_tileset.png`. This repo is private
(D45, D60). The packed atlas in `public/sprites/` is built output that ships inside the app (D66 point 5), which the
licence allows, so it is committed. That commit assumes a private repo: making the repo public would redistribute the
pack, so ask Ming first.
