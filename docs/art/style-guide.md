# simap pixel-art style guide

Status: v1 draft, 2026-11-20. Decisions: D41–D46, D48–D52 (`work/decisions.md`). Reference mockup: the "Simap Room Map"
artifact (style 2, 32 px, UI A). Everything in that mockup is placeholder art drawn by code; it shows the target
quality, not final sprites.

## 0. Phase 1: reuse packs as they are (D53)

To ship the map sooner, phase 1 uses objects cut from free packs **with their original colours**. Sections 3–5
(palette, drawing rules) apply in phase 2, when Ming recolours and touches up the art.

Phase 1 rules:
- Licences still apply (D45, section 9): no pack is used before its licence row is in `assets/art/CREDITS.md`.
- Prefer **one main pack** for floors, walls, desks and chairs so the room looks consistent; fill gaps from a second
  pack only when needed.
- Packs drawn at 16 px are scaled 2× with nearest-neighbour to the 32 px grid (no redraw).
- Nobody cuts sprites by hand: the pack's original sheet is stored in `assets/art/sources/<pack>/` and
  `assets/art/sprite-map.json` lists, for each key, the source sheet and the rectangle to cut (plus scale and
  anchor). The packing script (SIM-024) cuts, scales and packs them.
- Keys with no source in any accepted pack keep the code-drawn placeholder (for example `rack.server`, `device.phone`,
  `whiteboard`) until drawn in phase 2.

## 1. Where the pixel style is used (D52)

| Pixel / game style | Clean UI kit (no pixel art) |
|---|---|
| Sign-in and org picker screens | Members, Devices, Approvals |
| Room browser and room map (availability, who sits where) | Groups and projects, audit log, CSV export |
| My seat, request a seat, "My requests" | Manager dashboard and numbers |
| Seat panel opened from the map | Room and seat management tables; the layout editor's chrome (its canvas is pixel art) |

Rules:
- Body text, numbers, tables and forms are never in a pixel font, on any screen. Pixel styling goes into art, frames,
  headings and decoration only, so everything stays readable.
- The clean UI kit (SIM-003) stays the base for both columns. Pixel surfaces add art and pixel accents; they do not
  replace the kit's controls.

## 2. Grid and rendering

- Tile: **32 × 32 px** (D48). Rooms are measured in tiles (width × height).
- Sprites snap to whole tiles. A sprite may cover several tiles (a desk is 2 × 1, a meeting table 3 × 2).
- Rotation: 0°, 90°, 180°, 270° only. A sprite that needs different art per direction ships one frame per direction
  (`.n`, `.e`, `.s`, `.w`); symmetric sprites ship one frame.
- Scaling: whole numbers only (1×, 2×, 3×), `image-rendering: pixelated`, no smoothing, no sub-pixel positions.
- View: top-down with a 3/4 tilt. Horizontal surfaces (desk tops, floors) are seen from above; front faces (desk
  front, wall face, cabinet front) are visible as a 4–8 px band below the top.

## 3. Palette (style 2, "modern office")

One palette for every sprite. Art from other packs is recoloured to it (Pixelorama: Image → Palette → map to palette).
Add a colour only by updating this table.

| Role | Hex | Use |
|---|---|---|
| Outline | `#2a3140` | 1 px outline on every object sprite (not floors or walls) |
| Shadow | `#202a3a` at 18% | soft contact shadow under objects |
| Carpet / alt / line | `#d9dee5` `#d2d8e0` `#c6cdd7` | work zone floor |
| Lavender / alt / line | `#d3cdea` `#cbc4e5` `#bcb3db` | meeting zone floor |
| Wood floor / line | `#eadfca` `#d8c9ae` | lounge / entrance floor |
| Wall top / highlight | `#8b95a7` `#a2acbc` | wall top face |
| Wall face / shade / base | `#eef1f5` `#dfe3ea` `#98a1b0` | wall front face, skirting |
| Glass / highlight / frame | `#bfe3f5` `#eaf7ff` `#7d8896` | windows, glass partitions |
| Desk top / highlight | `#f6f5f2` `#ffffff` | desk surfaces |
| Desk front / dark / leg | `#d8d3ca` `#c3bdb2` `#8c95a3` | desk faces and legs |
| Chair / dark / highlight / base | `#2f8f8a` `#236e6b` `#4fb3ac` `#3a4250` | office chairs (teal accent) |
| Screen frame / screen / screen light / glare | `#262b33` `#3b7dd4` `#6aa3ee` `#d6e8ff` | monitors, laptops |
| PC / PC light / LED green / LED blue | `#353b45` `#4a515d` `#5ee08f` `#38bdf8` | PC towers, racks |
| Light device / dark | `#b9c0ca` `#9aa2ad` | laptop body |
| Keyboard / keys | `#e3e6ea` `#c6ccd4` | keyboards, mice |
| Plant leaf / dark / light, pot / pot dark | `#4ea56b` `#337a4d` `#7cc893`, `#f2efe9` `#d6d1c6` | plants |
| Cabinet / dark / handle | `#bcc4ce` `#9ea7b2` `#eef1f4` | filing cabinets, doors |
| Wood furniture / dark | `#c9a27a` `#a5805c` | shelves |
| Soft furniture / dark / light | `#5a7bd6` `#4462b5` `#7d98e3` | sofas |
| Table / dark | `#ead9c0` `#cdb995` | meeting and coffee tables |
| Accent warm | `#e86a5a` `#f2c14e` | mugs, books, lamp, small details |
| State: mine / pending / cannot | `#14b8a6` `#f59e0b` `#ef4444` | overlays (section 6) |

Avatars use their own small ramps (section 5); they still take the outline colour.

## 4. Drawing rules

- Light comes from the top-left: highlights on top and left edges (1–2 px), darker tone on bottom and right.
- Outline: 1 px `#2a3140` around the silhouette of every object. Inner lines use a darker tone of the fill, never the
  outline colour.
- No pure black (`#000`) or pure white for large areas; pure white only for small highlights.
- Shadows: a soft band 3–4 px tall under the object's bottom edge, `#202a3a` at 18%, drawn on the floor layer, not
  baked into the sprite.
- Dithering: none. Gradients: none. Use 2–3 flat tones per material.
- Detail density: a 2 × 1 desk carries 1–3 small props (monitor, keyboard, mug); keep at least 4 px of empty desk.
- Text in art: none (no readable words in sprites). Labels are HTML.

## 5. Avatars (D44, D51)

- Size 18 × 24 px drawn inside a 32 × 32 cell, two views: **front** (seen from the desk's far side) and **back** (seen
  from behind the chair). Seated pose only in v1.
- Layers, each a separate frame so colours can be swapped at runtime: `body` (skin), `hair` (3 styles × 2 views),
  `shirt`, optional `accessory` (glasses, headphones) later.
- Colours are picked from fixed ramps by a hash of the Identity `sub` (stable per person):
  skin `#f6d0b1 #e8b48f #c98e66 #8d5a3b`; hair `#2b2118 #5a3a22 #b07a3a #1f2a44 #a33b3b #3b2b4a`;
  shirt `#e05d5d #3a7bd5 #2fa36b #8e5bd6 #f0a03c #3fb5b0 #5a6b8c`.
- No faces that imitate real people; no photos.

## 6. Seat states and overlays (LAY-06)

State is never shown by colour alone: each state has a shape.

| State | On the map | Name-tag dot |
|---|---|---|
| Occupied | avatar on the chair | green `#16a34a` |
| Empty | empty chair | grey `#8a93a3` |
| My seat | teal tint over the desk + teal outline when selected | teal `#14b8a6` |
| Request pending | amber speech bubble with "!" above the chair | amber `#f59e0b` |
| Cannot seat | red round "no" sign on the desk | red `#ef4444` |
| Selected / hover / focus | HTML outline (white 2 px + teal ring), not part of the sprite | — |

Name tags (D50): HTML, not pixel: dark pill `rgba(22,27,37,.92)`, white Inter 12 px semibold, status dot, seat number;
shown only on hover or keyboard focus, at every zoom.

## 7. Sprite inventory for v1 (32 px)

Source column: **draw** = in-house; **adapt** = start from a free pack that passed the licence check
(`docs/art/asset-candidates.md`), then recolour and fix to these rules.

| Group | Key(s) | Tiles | Frames | Source |
|---|---|---|---|---|
| Floors | `floor.carpet`, `floor.carpet.alt`, `floor.lavender`, `floor.wood` | 1×1 | 1 each | draw (simple) |
| Walls | `wall.top`, `wall.face`, `wall.face.shade`, `wall.base`, corners `wall.corner.*` | 1×1 / 1×2 | 9-slice set | draw |
| Openings | `door`, `window.double`, `partition.glass` | 1×2, 2×1, 1×1 | n/e/s/w where needed | adapt or draw |
| Desks | `desk.single`, `desk.pair` (back to back with screen) | 2×1, 2×2 | n/e/s/w | adapt |
| Chairs | `chair.office` | 1×1 | n/e/s/w | adapt |
| Devices (D37) | `device.monitor`, `device.monitor.dual`, `device.pc`, `device.laptop`, `device.phone`, `device.other` | sub-tile props | 1 (+ facing) | adapt / draw phone |
| Desk props | `prop.keyboard`, `prop.mouse`, `prop.mug`, `prop.papers` | sub-tile | 1 | draw |
| Storage | `cabinet.filing`, `shelf.books`, `rack.server` | 1×1–2×1 | 1 | adapt / draw rack |
| Meeting / lounge | `table.meeting`, `table.coffee`, `sofa`, `whiteboard`, `lamp.floor` | various | 1–2 | adapt / draw whiteboard |
| Plants | `plant.small`, `plant.large` | 1×1 | 1 | adapt |
| Circulation | `stairs`, `elevator` | 2×2 | 1 | draw |
| Markers | `marker.blocked` (area), `label.sign` | 1×1 | 1 | draw |
| Overlays | `state.cannot`, `state.pending`, `state.mine.tint` | sub-tile | 1 | draw |
| Avatars | `avatar.body.front/back`, `avatar.hair.{1..3}.front/back`, `avatar.shirt.front/back` | 1×1 cell | layered | draw |
| Sign-in scene | `scene.signin` (a small office vignette) | about 12×7 tiles | 1 | composed from the above |

About 45 sprites plus frames. Estimate for Ming (M-5): 3–4 days at 32 px.

## 8. Files and naming

- Working files: `assets/art/src/<group>.pxo` (Pixelorama) or `.aseprite`. Not shipped.
- Palette files: `assets/art/palette/simap-style2.gpl` (GIMP/Pixelorama/Aseprite/Piskel), `.hex`, and a swatch
  `.png`. Avatar layers are drawn in the three greys at the end of the palette; the app recolours them.
- **Export convention (what Ming exports):** one PNG per frame in `assets/art/export/`, named exactly by its key
  (`desk.single.s.png`, `chair.office.n.png`, `device.laptop.png`). Canvas width = tiles wide × 32; canvas height =
  tiles deep × 32 + 16 px headroom on top for tall things (monitors, plants, people). The bottom edge of the canvas
  is the bottom edge of the footprint tiles. Transparent background; no shadow baked in. Sub-tile props (devices,
  desk props) use a tight canvas and are placed by code. A packing script (SIM-024) builds `office.png` + `office.json`
  from this folder, so nobody edits the atlas or JSON by hand.
- Licence record: `assets/art/CREDITS.md`, one row per adapted source (section 9).
- Export: one atlas `public/sprites/office.png` (power-of-two not required, 1 px transparent gap between frames) and
  `public/sprites/office.json`:

```json
{
  "tile": 32,
  "frames": {
    "desk.single.s": { "x": 0, "y": 0, "w": 64, "h": 40, "anchor": [0, 8], "tiles": [2, 1], "blocks": true },
    "chair.office.n": { "x": 66, "y": 0, "w": 22, "h": 24, "anchor": [5, -4], "tiles": [1, 1], "blocks": false }
  },
  "layers": ["floor", "wall", "shadow", "furniture", "avatar", "overlay"]
}
```

- `anchor` = offset in px from the tile's top-left to the sprite's top-left (sprites with a front face overhang their
  tiles). `blocks` = whether another blocking item may share the tile.
- Keys are stable: the app code refers only to keys, so replacing `office.png` + `office.json` changes the art without
  code changes. Removing or renaming a key is a code change.

## 8b. Sprite map (phase 1)

```json
{
  "sources": { "2dpig-office": { "file": "assets/art/sources/2dpig-office/sheet.png", "tile": 16 } },
  "sprites": {
    "chair.office.s": { "source": "2dpig-office", "rect": [48, 32, 16, 16], "scale": 2, "tiles": [1, 1] },
    "desk.single.s":  { "source": "2dpig-office", "rect": [0, 64, 32, 24], "scale": 2, "tiles": [2, 1] }
  }
}
```

`rect` is `[x, y, w, h]` in source pixels. The script scales by `scale`, places the result bottom-aligned in the
export canvas (section 8 convention) and packs the atlas. Exported PNGs in `assets/art/export/` (drawn or recoloured
art) override the map for the same key, so phase 2 replaces sprites one by one.

## 9. Licence workflow (D45)

1. Only CC0, CC-BY, or a free pack whose page explicitly allows commercial use and modification (and does not limit
   use to games). Screenshot the licence text and save it as `assets/art/licences/<pack>.png`.
2. Add a row to `assets/art/CREDITS.md` before using any pixel of the pack.
3. After adapting, the sprite follows this guide (palette, outline, light) so mixed sources look like one set.
4. The in-app Credits page reads `CREDITS.md`.
