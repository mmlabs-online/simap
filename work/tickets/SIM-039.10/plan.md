Status: READY

# Plan — SIM-039.10: Map items art: atlas previews

## Scope summary
Ticket scope (slice 2b of SIM-039.6, split in `work/tickets/SIM-039.9/plan.md` § Split proposal):
- "Package and library frame previews at 1× and 2× (pixelated canvas from the atlas) in each direction panel."
- "Frame thumbnails in the inline sprite browser and on its confirm step."
- "A short note when the atlas fails to load (the text-only list stays)."
- "A row thumbnail for items that only have a package sprite."

Spec: `docs/spec-v1.md` LAY-07, "previewed at 1× and 2×". Out of scope: custom image previews (done in 039.9) and map rendering (039.8).
No server, DB or API change; ui + copy only.

## Acceptance criteria → verification
| # | Criterion | How the reviewer verifies it |
|---|---|---|
| 1 | Package and library art show 1× and 2× previews; the browser shows frame thumbnails. | Unit tests for the rect helpers (below). Local run: open Art for a directional item, see 1× and 2× canvases for a library direction and for a chosen package sprite. Open "Choose package sprite" and see a thumbnail per row and one on the "Selected" step. SSR tests in `MapItemArtDialog.test.tsx` / `SpriteBrowser.test.tsx` check the canvases are present when an atlas is passed. |
| 2 | If the atlas fails, the page still works with the text list and shows a note. | `MapItemArtDialog.test.tsx`: with `atlasFailed` the note text is rendered and the panels and browser still render. Local run: block `/sprites/office.json` in devtools, the dialog still works and shows the note. |
| 3 | Checks green; frame rect logic has unit tests (canvas drawing is checked manually). | `pnpm typecheck`, `pnpm check:layers`, `pnpm format:check`, `pnpm test`. |

## Ming verification after merge
Visual look of the canvases (pixel sharpness, alignment) in a real browser. This is the "checked manually" part of the ticket.

## Files to create / modify
| File | Change | Required because | High path? |
|---|---|---|---|
| `src/ui/mapItems/frame-preview.ts` | New. Pure helpers (see Approach). | Frame rect logic must be unit-tested (AC 3). | No |
| `src/ui/mapItems/frame-preview.test.ts` | New. Unit tests. | R5. | No |
| `src/ui/mapItems/FramePreview.tsx` | New, `"use client"`. Thin `<canvas>` component: takes `atlas`, `frameKey`, `scale` or `box`, `label`. A `useEffect` draws one `drawImage` with the rect from the helper, smoothing off at 1×/2×. | Canvas drawing, kept thin. | No |
| `src/ui/mapItems/map-item-art.ts` | Add `panelFrameKey(item, dir)` and `thumbSprite(item)` (pure). | Which frame a panel or row shows. | No |
| `src/ui/mapItems/map-item-art.test.ts` | Add tests for the two helpers. | R5. | No |
| `src/ui/mapItems/MapItemArtDialog.tsx` | `ArtBodyProps` gets optional `atlas?: Atlas \| null` and `atlasFailed?: boolean`. In each panel, when `view.source !== "image"` and the atlas is ready, show the 1× and 2× `FramePreview`s. Show the atlas note once (above the panels) when failed. Pass `atlas` to `SpriteBrowser`. The dialog takes the same two props. | AC 1, 2. | No |
| `src/ui/mapItems/SpriteBrowser.tsx` | Optional `atlas` prop. A small thumbnail in each radio row and a larger one in the staged block. No change when `atlas` is null. | AC 1. | No |
| `src/ui/mapItems/MapItemsView.tsx` | Optional `atlas` prop. Row thumbnail falls back to `FramePreview` of `thumbSprite(item)` when `thumbUrl` gives null. | "Row thumbnail for items that only have a package sprite". | No |
| `src/ui/mapItems/MapItemsPage.tsx` | Call `useAtlas()` once in `MapItemsLoaded` and pass `atlas` / `failed` to the view and dialog. | One atlas load, shared. | No |
| `src/ui/copy/mapItems.ts` | `art.atlasFailed` note, `art.frameAlt(key)` (and the thumb alt). | D36. | No |
| `src/ui/mapItems/MapItemArtDialog.test.tsx`, `SpriteBrowser.test.tsx`, `MapItemsView.test.tsx` | Add cases below. | R5. | No |

Nothing here matches a High path in `.claude/loop.config.md` (all `src/ui/**` and copy). The implementer should recheck that list before starting.

## Data model / migration
None.

## API contract
None.

## Tests to write
All in node env, no DOM. Components are tested with `renderToStaticMarkup` like the existing `*.test.tsx`. Use a plain fake atlas object (`{ manifest: { frames }, image: {} as HTMLImageElement }`); SSR never runs the effect.

| Test (file › name) | Covers |
|---|---|
| `frame-preview.test.ts › frameRect` | Frame `{x,y,w,h}` gives the source rect and, for scale 1 and 2, destination `w*scale`, `h*scale`. |
| `frame-preview.test.ts › frameRect missing frame` | Unknown key returns null. |
| `frame-preview.test.ts › frameRect integer only` | Non-integer or <= 0 scale is rejected (null) or clamped to 1; pick one and assert it. |
| `frame-preview.test.ts › containRect` | A frame larger than the thumbnail box scales down, keeps the aspect ratio, is centred, and `smooth` is true only when scale < 1. |
| `frame-preview.test.ts › containRect small frame` | A frame smaller than the box is drawn at integer scale 1, centred, `smooth` false (not upscaled blurry). |
| `frame-preview.test.ts › containRect 1x1 frame, zero-size frame` | Edge: a 1×1 frame is drawn; w or h of 0 returns null. |
| `map-item-art.test.ts › panelFrameKey` | Chosen sprite is returned when no image; the library key is `resolveFrameKey(builtinKey, rotation for dir)`: directional `chair.s` style vs plain key, per direction n/e/s/w; null when the key is not in the registry; null when the source is "image". |
| `map-item-art.test.ts › thumbSprite` | Order s, n, e, w; only allowed directions (a non-directional item ignores `n/e/w`); null when no sprite. |
| `MapItemArtDialog.test.tsx › atlas previews` | With an atlas that has the frame, a library or sprite panel renders two `<canvas>` (1× and 2×) with the `1×` and `2×` captions; an image panel still renders `<img>` and no canvas. |
| `MapItemArtDialog.test.tsx › atlas failed` | With `atlasFailed`, the note text is shown, and "Choose package sprite" and the panels still render. |
| `MapItemArtDialog.test.tsx › atlas loading` | `atlas` null and not failed: no note, no canvas, no crash. |
| `SpriteBrowser.test.tsx › thumbnails` | With an atlas, one canvas per frame row and one on the staged block; without an atlas the existing text-only output is unchanged. |
| `SpriteBrowser.test.tsx › frame missing in atlas` | A key missing from the manifest renders no canvas and the row text stays. |
| `MapItemsView.test.tsx › sprite-only row thumb` | Item with a sprite and no image shows a canvas; with an image the `<img>` still wins; with neither, no thumbnail. |

## Approach
1. Pure helpers in `frame-preview.ts` (lib-free; types from `@/lib/sprites/types`):
   - `frameRect(frame, scale)` returns `{ sx, sy, sw, sh, dw, dh }` or null.
   - `containRect(frame, box)` returns `{ sx, sy, sw, sh, dx, dy, dw, dh, smooth }` or null.
   `frame` is `{x,y,w,h}` from `atlas.manifest.frames[key]`.
2. In `map-item-art.ts`, `panelFrameKey(item, dir)`: `hasImage` gives null; else the `art[dir].sprite`; else the library key. The library key is `resolveFrameKey(item.builtinKey, DIR_ROTATION[dir])` (import from `@/lib/sprites/placement`; this is lib, so R1 is fine). `DIR_ROTATION` is the inverse of `ROTATION_TO_DIR` (s 0, e 90, n 180, w 270). Check that `placement.ts` does not pull anything non-lib into the ui bundle. If it does, build the key locally with `REGISTRY` and `isFrameKey` instead (same rule as `resolveFrameKey`, ~4 lines). The panel only draws when the manifest has the frame; otherwise it shows the existing `previewNA` text.
3. `FramePreview.tsx` sets `canvas.width/height` to the destination size in CSS pixels, `imageSmoothingEnabled = smooth`, and does one `drawImage(atlas.image, sx, sy, sw, sh, dx, dy, dw, dh)`. It uses `style={{ imageRendering: "pixelated" }}`, `role="img"` and an `aria-label` from the copy. If `getContext` returns null it does nothing. No tint or other paint logic. Do not reuse `paintRoom`.
4. Wire the atlas: `useAtlas()` in `MapItemsLoaded` (once, on page load, so row thumbs work too) and pass `atlas` / `atlasFailed` as optional props. Every new prop is optional so existing tests and callers keep working.
5. The failure note is a single `<p role="status">` in the dialog body, only when `atlasFailed`. The page does not show it on the list (the list has no atlas content except the sprite-only thumb, which just stays absent).
6. Rules: R1 holds (ui imports lib and `../roomlayout/*` types/hooks. `useAtlas` and `Atlas` live in `src/ui/roomlayout`, which is ui; run `pnpm check:layers` to confirm ui to ui imports are allowed). D36: all strings in `src/ui/copy/mapItems.ts`. R3/R6/R7 are not touched.

## Specialist input used
None (fast lane, no consults).

## Assumptions
- A1. The atlas is loaded once at page level (not only when the dialog opens), because the sprite-only row thumbnail needs it on the list. This is one extra 2-file fetch that the room pages already do, so the browser cache is likely to serve it. The 039.9 note said "loaded when the dialog opens"; this plan deviates only for that reason.
- A2. Previews show for the sources "sprite" and "library". When a custom image wins, the existing image 1×/2× stays and no frame preview is added (the hidden sprite stays text only, as in 039.9).
- A3. The row thumbnail priority is: custom image (existing), then chosen package sprite. Items on the library frame only get no thumbnail (ticket: "items that only have a package sprite"). Row size matches the existing `size-8` (32 px) `<img>`, drawn with `containRect`.
- A4. Frames wider than the panel scroll horizontally (the existing `overflow-x-auto` container is reused). Frames are at most 4 tiles (128 px) wide so 2× is 256 px; this fits the 760 px dialog.
- A5. While the atlas is loading nothing is shown (no spinner); it is a few KB of local static files. The existing `previewNA` text is not shown while loading, only when the atlas is ready and the frame is missing.
- A6. Hotspots: `MapItemArtDialog.tsx`, `SpriteBrowser.tsx`, `MapItemsView.tsx` and `MapItemsPage.tsx` were last changed by SIM-039.9 (merged). No other open ticket was checked for edits to them; the orchestrator should check `work/backlog.md` for open `ui` tickets touching `src/ui/mapItems/**`.
- A7. Size estimate: S, about 220 changed product lines (helpers 60, `FramePreview` 40, wiring 70, copy 10, art helpers 40) plus about 180 test lines. This is within one cycle.

## Blocking questions
None.

## Split proposal
None.
